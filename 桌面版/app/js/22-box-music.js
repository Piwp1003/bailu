/* =====================================================================
   js/22 —— 🎵 音乐盒
   原来是插件（白露音乐盒插件.json），v97 起内置。装过旧插件的可以在「🔌 插件」页删掉。

   ⚠️ 每个各自一个 IIFE，别合并：它们之间有同名的顶层符号。
   ⚠️ 原插件的 `code` 钩子（每次拼 prompt 都跑）内置之后改成统一由
      js/06 的 getBoxPrompt() 调用各自暴露的 window.__gyXxxCtxFor；
      关系账本的 `onResponse` 钩子改由 js/02 的 runBoxResponseHooks() 调用。
   ===================================================================== */

// ============ 音乐盒 ============
/* ===========================================================================
   🎵 白露音乐盒 —— 悬浮播放器插件  v2
   ---------------------------------------------------------------------------
   皮肤按"款式"分类，一个款式下有好几个变体，点同一个款式就在它的变体之间轮换：
     · 黑胶款  经典 420×168 / 宽幅 520×150 / 竖版 300×330
     · 迷你条  圆角 320×60  / 图标条 340×56 / 波形条 360×76
     · 卡片款  经典 300×360 / 大封面 280×310 / 左右分栏 420×140
     · 胶囊款  圆点 56×56   / 小药丸 148×48
   曲库 + 歌单分开：歌曲存在曲库里，歌单只存引用，所以同一首歌能同时属于多个歌单，
   从某个歌单里移除也不会把歌本身删掉。
   歌词：上传 .lrc 或粘贴带时间戳的文本，逐行滚动高亮；单击歌词条可以收成一行，再点展开。
   数据存在自己的 localforage 库（gyMusicBox），不进主存档。
   =========================================================================== */
(function () {
    if (window.__gyMusicBoxLoaded) {
        try { document.getElementById('gymRoot').style.display = 'block'; } catch (e) {}
        return;
    }
    window.__gyMusicBoxLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyMusicBox', 'tracks')          // 带兜底的存档口：localforage 用不了就退 localStorage，两条都断才报错
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyMusicBox', storeName: 'tracks' })
            : null);
    const KEY = 'gyMusic_state';

    // ---------- 状态 ----------
    // tracks 是曲库（所有歌只存一份），lists 里只放 id 引用 —— 这样一首歌能同时在多个歌单里，
    // 从歌单移除也不会误删曲库里的原始文件。
    let S = {
        tracks: [],                                   // [{id,title,artist,cover,src,kind,lrc,dur}]
        lists: [{ id: 'all', name: '全部歌曲', ids: null }],  // ids:null = 这是"全部"这个虚拟歌单
        curList: 'all',
        idx: 0,
        skin: 'mini-round',
        showLyrics: false,
        lyrCollapsed: false,      // 歌词条收起来只显示当前一行
        volume: 0.8,
        loop: 'list',
        pos: null,
        hidden: false,
        // 🎧 一起听
        listen: {
            chars: [],          // 正在一起听的角色 id（可以拉好几个）
            sayOnSwitch: true,  // 换歌时说一句
            sayOnLyric: false,  // 唱到某句歌词接一句（最贵，默认关）
            sayOnEnd: true,     // 一首听完给个感想
            lyricMax: 2,        // 一首歌里最多接几次歌词，防止一首歌说个没完
            chatOpen: false     // 聊天区展开没有
        },
        taste: {},              // {角色id: 一句音乐口味}
        stats: { total: { ms: 0, songs: 0 }, byChar: {} },   // 🕒 一起听的时长/首数统计
        memory: {},             // {角色id: 一起听的记忆总结}
        chat: []                // 这次一起听的对话 [{who,name,text,at}]
    };
    let audio = null, blobUrls = {}, lrcLines = [], lrcIdx = -1, dragging = false;
    let wxHid = false;          // 💬 微信模式里临时收起的（不写存档）
    let editingId = null;        // 正在编辑哪首歌（管理面板里的表单）

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmt = t => {
        if (!isFinite(t) || t < 0) t = 0;
        const m = Math.floor(t / 60), s = Math.floor(t % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    };
    // 时长显示：不到 1 分钟说"不到 1 分钟"，超过 1 小时给"X 小时 Y 分"
    function fmtDur(ms) {
        ms = Math.max(0, ms || 0);
        const min = Math.floor(ms / 60000);
        if (min < 1) return '不到 1 分钟';
        if (min < 60) return min + ' 分钟';
        const h = Math.floor(min / 60), m = min % 60;
        return h + ' 小时' + (m ? ' ' + m + ' 分' : '');
    }
    const byId = id => S.tracks.find(t => t.id === id) || null;
    const curListObj = () => S.lists.find(l => l.id === S.curList) || S.lists[0];
    // 当前歌单里的歌（"全部"就是整个曲库；其它歌单按 ids 顺序取，取不到的自动跳过）
    function curTracks() {
        const L = curListObj();
        if (!L || L.ids === null) return S.tracks;
        return L.ids.map(byId).filter(Boolean);
    }
    const cur = () => curTracks()[S.idx] || null;

    async function save() {
        if (!LF) return;
        try { await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) { console.warn('[音乐盒] 存档失败', e); }
    }
    async function load() {
        if (!LF) return;
        try {
            const d = await LF.getItem(KEY);
            if (!d || typeof d !== 'object') return;
            // v1 → v2 迁移：老版本只有一个扁平的 S.list，把它当曲库，歌单只留"全部"
            if (Array.isArray(d.list) && !Array.isArray(d.tracks)) {
                d.tracks = d.list;
                d.lists = [{ id: 'all', name: '全部歌曲', ids: null }];
                d.curList = 'all';
                delete d.list;
            }
            // 老皮肤名 → 新变体名
            const MAP = { mini: 'mini-round', vinyl: 'vinyl-classic', card: 'card-classic', capsule: 'capsule-dot' };
            if (d.skin && MAP[d.skin]) d.skin = MAP[d.skin];
            S = Object.assign(S, d);
            if (!Array.isArray(S.lists) || !S.lists.length) S.lists = [{ id: 'all', name: '全部歌曲', ids: null }];
            if (!S.lists.some(l => l.id === 'all')) S.lists.unshift({ id: 'all', name: '全部歌曲', ids: null });
        } catch (e) { console.warn('[音乐盒] 读档失败', e); }
    }

    async function srcOf(t) {
        if (!t) return '';
        if (t.kind === 'url') return t.src || '';
        if (blobUrls[t.id]) return blobUrls[t.id];
        if (!LF) return '';
        try {
            const blob = await LF.getItem('file_' + t.id);
            if (!blob) return '';
            blobUrls[t.id] = URL.createObjectURL(blob);
            return blobUrls[t.id];
        } catch (e) { return ''; }
    }

    // ---------- 皮肤定义 ----------
    // 分类 → 变体。点同一个分类就在它的变体之间轮着换（用户要的"点这个款式切换样式"）。
    const SKIN_CATS = [
        { cat: 'vinyl', icon: '💿', name: '黑胶款', variants: [
            { k: 'vinyl-classic', n: '经典黑胶',   d: '420 × 168' },
            { k: 'vinyl-wide',    n: '宽幅黑胶',   d: '520 × 150' },
            { k: 'vinyl-tall',    n: '竖版黑胶',   d: '300 × 330' },
            { k: 'vinyl-scale',   n: '刻度波形横', d: '640 × 180' }
        ] },
        { cat: 'mini', icon: '▬', name: '迷你条', variants: [
            { k: 'mini-round',  n: '圆角条',   d: '320 × 60' },
            { k: 'mini-bar',    n: '图标条',   d: '340 × 56' },
            { k: 'mini-wave',   n: '波形条',   d: '360 × 76' },
            { k: 'mini-plain',  n: '极简条',   d: '340 × 70' },
            { k: 'mini-bubble', n: '波形气泡', d: '400 × 80' },
            { k: 'mini-six',    n: '双排六键', d: '420 × 100' }
        ] },
        { cat: 'card', icon: '🖼️', name: '卡片款', variants: [
            { k: 'card-classic', n: '经典卡片',   d: '300 × 360' },
            { k: 'card-cover',   n: '大封面',     d: '280 × 310' },
            { k: 'card-split',   n: '左右分栏',   d: '420 × 140' },
            { k: 'card-vip',     n: 'VIP 竖版大卡', d: '300 × 480' },
            { k: 'card-side',    n: '右侧圆按钮', d: '320 × 360' },
            { k: 'card-circle',  n: '圆封面竖版', d: '280 × 330' },
            { k: 'card-right',   n: '右竖排按钮', d: '300 × 310' }
        ] },
        { cat: 'banner', icon: '🎞️', name: '横幅款', variants: [
            { k: 'banner-vip',   n: '大横幅 VIP',  d: '560 × 230' },
            { k: 'banner-heart', n: '长条音波',    d: '700 × 160' },
            { k: 'banner-wave',  n: '双层音波',    d: '420 × 200' }
        ] },
        { cat: 'fn', icon: '🧩', name: '功能款', variants: [
            { k: 'fn-rec',  n: '推荐歌曲',      d: '360 × 300' },
            { k: 'fn-now',  n: 'NOW PLAYING 带搜索', d: '420 × 210' },
            { k: 'fn-wave', n: '波形+黑底键',   d: '400 × 220' }
        ] },
        { cat: 'special', icon: '🎛️', name: '特殊款', variants: [
            { k: 'sp-pad', n: '平板/视频框',  d: '400 × 420' },
            { k: 'sp-vol', n: '竖排音量条',   d: '96 × 300' }
        ] },
        { cat: 'capsule', icon: '⚪', name: '胶囊款', variants: [
            { k: 'capsule-dot',  n: '圆点',   d: '56 × 56' },
            { k: 'capsule-pill', n: '小药丸', d: '148 × 48' }
        ] }
    ];
    const ALL_SKINS = SKIN_CATS.reduce((a, c) => a.concat(c.variants.map(v => Object.assign({ cat: c.cat }, v))), []);
    const skinInfo = k => ALL_SKINS.find(s => s.k === k) || ALL_SKINS[0];
    const catOf = k => skinInfo(k).cat;

    // ---------- 样式 ----------
    const CSS = `
#gymRoot{position:fixed;z-index:2400;left:auto;right:24px;bottom:96px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;-webkit-user-select:none;user-select:none;}
#gymRoot.gym-drag{opacity:.9;cursor:grabbing;}
.gym-box{background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);overflow:hidden;position:relative;box-sizing:border-box;}
body.dark-theme .gym-box{background:#16181c;box-shadow:0 8px 32px rgba(0,0,0,.5);}
.gym-hd{position:absolute;top:0;left:0;right:0;height:20px;cursor:grab;z-index:3;}
.gym-x{position:absolute;top:6px;right:8px;z-index:5;width:20px;height:20px;border-radius:50%;border:none;
  background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);color:#536471;font-size:13px;line-height:1;cursor:pointer;padding:0;}
.gym-x:hover{background:#eff3f4;}
body.dark-theme .gym-x{background:#2f3336;color:#e7e9ea;box-shadow:0 1px 4px rgba(0,0,0,.5);}
.gym-cover{background:#e6e9ea center/cover no-repeat;flex:0 0 auto;}
body.dark-theme .gym-cover{background-color:#2f3336;}
.gym-t1{font-weight:700;color:#0f1419;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.gym-t2{color:#8b98a5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
body.dark-theme .gym-t1{color:#e7e9ea;}
.gym-bar{position:relative;height:4px;border-radius:2px;background:#e6e9ea;cursor:pointer;flex:1 1 auto;min-width:0;}
body.dark-theme .gym-bar{background:#2f3336;}
.gym-fill{position:absolute;left:0;top:0;bottom:0;border-radius:2px;background:#0f1419;width:0;}
body.dark-theme .gym-fill{background:#e7e9ea;}
.gym-dot{position:absolute;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#fff;border:2px solid #0f1419;left:0;}
body.dark-theme .gym-dot{background:#16181c;border-color:#e7e9ea;}
.gym-time{font-size:10px;color:#8b98a5;font-variant-numeric:tabular-nums;flex:0 0 auto;}
.gym-b{border:none;background:none;padding:0;cursor:pointer;color:#0f1419;display:flex;align-items:center;justify-content:center;flex:0 0 auto;}
.gym-b:hover{opacity:.6;}
.gym-b svg{display:block;}
body.dark-theme .gym-b{color:#e7e9ea;}
.gym-main{background:#0f1419;color:#fff;border-radius:50%;}
body.dark-theme .gym-main{background:#e7e9ea;color:#16181c;}
.gym-main:hover{opacity:.85;}
.gym-row{display:flex;align-items:center;gap:8px;}
.gym-mid{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;}
.gym-wave{display:flex;align-items:flex-end;gap:2px;flex:0 0 auto;overflow:hidden;}
.gym-wave i{flex:1 1 auto;background:#cfd9de;border-radius:1px;min-width:2px;}
.gym-wave i.on{background:#0f1419;}
body.dark-theme .gym-wave i{background:#2f3336;}
body.dark-theme .gym-wave i.on{background:#e7e9ea;}
.gym-vinyl{border-radius:50%;flex:0 0 auto;position:relative;
  background:repeating-radial-gradient(circle at 50% 50%,#1a1a1a 0 2px,#0d0d0d 2px 4px);
  box-shadow:0 3px 12px rgba(0,0,0,.35);}
.gym-vinyl.spin{animation:gymSpin 6s linear infinite;}
@keyframes gymSpin{to{transform:rotate(360deg);}}
.gym-vinyl .gym-cover{position:absolute;left:50%;top:50%;border-radius:50%;box-shadow:0 0 0 3px #fff;}
.gym-vinyl::after{content:"";position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#fff;z-index:2;}

/* ===== 黑胶款 ===== */
.gym-box[data-skin="vinyl-classic"]{width:420px;height:168px;display:flex;align-items:center;gap:16px;padding:0 20px 0 16px;}
.gym-box[data-skin="vinyl-classic"] .gym-vinyl{width:120px;height:120px;}
.gym-box[data-skin="vinyl-classic"] .gym-vinyl .gym-cover{width:44px;height:44px;margin:-22px 0 0 -22px;}
.gym-box[data-skin="vinyl-classic"] .gym-mid{gap:8px;}
.gym-box[data-skin="vinyl-classic"] .gym-t1{font-size:16px;}
.gym-box[data-skin="vinyl-classic"] .gym-t2{font-size:12px;}
.gym-box[data-skin="vinyl-classic"] .gym-ctl{display:flex;align-items:center;gap:16px;margin-top:2px;}
.gym-box[data-skin="vinyl-classic"] .gym-main{width:40px;height:40px;}

.gym-box[data-skin="vinyl-wide"]{width:520px;height:150px;display:flex;align-items:center;gap:18px;padding:0 22px 0 14px;}
.gym-box[data-skin="vinyl-wide"] .gym-vinyl{width:112px;height:112px;}
.gym-box[data-skin="vinyl-wide"] .gym-vinyl .gym-cover{width:40px;height:40px;margin:-20px 0 0 -20px;}
.gym-box[data-skin="vinyl-wide"] .gym-mid{gap:7px;}
.gym-box[data-skin="vinyl-wide"] .gym-t1{font-size:15px;}
.gym-box[data-skin="vinyl-wide"] .gym-t2{font-size:11.5px;}
.gym-box[data-skin="vinyl-wide"] .gym-wave{height:26px;}
.gym-box[data-skin="vinyl-wide"] .gym-ctl{display:flex;align-items:center;justify-content:space-between;}
.gym-box[data-skin="vinyl-wide"] .gym-main{width:38px;height:38px;}

.gym-box[data-skin="vinyl-tall"]{width:300px;height:330px;display:flex;flex-direction:column;align-items:center;gap:10px;padding:22px 18px 16px;}
.gym-box[data-skin="vinyl-tall"] > *{flex:0 0 auto;}
.gym-box[data-skin="vinyl-tall"] .gym-vinyl{width:150px;height:150px;}
.gym-box[data-skin="vinyl-tall"] .gym-vinyl .gym-cover{width:54px;height:54px;margin:-27px 0 0 -27px;}
.gym-box[data-skin="vinyl-tall"] .gym-txt{text-align:center;width:100%;}
.gym-box[data-skin="vinyl-tall"] .gym-t1{font-size:15px;}
.gym-box[data-skin="vinyl-tall"] .gym-t2{font-size:11.5px;margin-top:2px;}
.gym-box[data-skin="vinyl-tall"] .gym-row{width:100%;}
.gym-box[data-skin="vinyl-tall"] .gym-ctl{display:flex;align-items:center;justify-content:space-between;width:100%;padding:0 4px;}
.gym-box[data-skin="vinyl-tall"] .gym-main{width:42px;height:42px;}

/* ===== 迷你条 ===== */
.gym-box[data-skin="mini-round"]{width:320px;height:60px;border-radius:30px;display:flex;align-items:center;gap:10px;padding:0 14px 0 6px;}
.gym-box[data-skin="mini-round"] .gym-cover{width:48px;height:48px;border-radius:50%;}
.gym-box[data-skin="mini-round"] .gym-mid{gap:2px;}
.gym-box[data-skin="mini-round"] .gym-t1{font-size:13px;line-height:1.25;}
.gym-box[data-skin="mini-round"] .gym-t2{font-size:10.5px;line-height:1.2;}
.gym-box[data-skin="mini-round"] .gym-main{width:34px;height:34px;}
.gym-box[data-skin="mini-round"] .gym-hd{height:14px;}
.gym-box[data-skin="mini-round"] .gym-x{top:2px;right:4px;width:16px;height:16px;font-size:11px;}

/* 图标条：一整行图标，进度条压在最底下（图二右上那种） */
.gym-box[data-skin="mini-bar"]{width:340px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:0 16px;}
.gym-box[data-skin="mini-bar"] .gym-main{width:32px;height:32px;}
.gym-box[data-skin="mini-bar"] .gym-t1{font-size:12.5px;max-width:110px;}
.gym-box[data-skin="mini-bar"] .gym-underbar{position:absolute;left:0;right:0;bottom:0;height:3px;background:#e6e9ea;}
body.dark-theme .gym-box[data-skin="mini-bar"] .gym-underbar{background:#2f3336;}
.gym-box[data-skin="mini-bar"] .gym-underbar>i{display:block;height:100%;background:#1d9bf0;width:0;}
.gym-box[data-skin="mini-bar"] .gym-hd{height:12px;}
.gym-box[data-skin="mini-bar"] .gym-x{top:3px;right:3px;width:15px;height:15px;font-size:10px;}

/* 波形条：歌名 + 一整条音波 + 一个大按钮（图一第二个） */
.gym-box[data-skin="mini-wave"]{width:360px;height:76px;border-radius:38px;display:flex;align-items:center;gap:12px;padding:0 12px 0 8px;}
.gym-box[data-skin="mini-wave"] .gym-cover{width:56px;height:56px;border-radius:50%;}
.gym-box[data-skin="mini-wave"] .gym-mid{gap:4px;}
.gym-box[data-skin="mini-wave"] .gym-t1{font-size:14px;}
.gym-box[data-skin="mini-wave"] .gym-t2{font-size:10.5px;}
.gym-box[data-skin="mini-wave"] .gym-wave{height:18px;}
.gym-box[data-skin="mini-wave"] .gym-main{width:40px;height:40px;}
.gym-box[data-skin="mini-wave"] .gym-hd{height:14px;}

/* ===== 卡片款 =====
   ⚠️ 固定高度的 flex 列，子项默认可被压缩：高度算少了几像素，flex 会把音波那行压成 0 高，
   看起来像"音波不见了"其实元素都在。所以统一给 > * 加 flex:0 0 auto，并把高度留够。 */
.gym-box[data-skin="card-classic"]{width:300px;height:360px;display:flex;flex-direction:column;padding:14px;gap:9px;}
.gym-box[data-skin="card-classic"] > *{flex:0 0 auto;}
.gym-box[data-skin="card-classic"] .gym-cover{width:100%;height:150px;border-radius:12px;}
.gym-box[data-skin="card-classic"] .gym-t1{font-size:16px;}
.gym-box[data-skin="card-classic"] .gym-t2{font-size:12px;margin-top:2px;}
.gym-box[data-skin="card-classic"] .gym-wave{height:22px;}
.gym-box[data-skin="card-classic"] .gym-ctl{display:flex;align-items:center;justify-content:space-between;padding:0 4px;}
.gym-box[data-skin="card-classic"] .gym-main{width:46px;height:46px;}

.gym-box[data-skin="card-cover"]{width:280px;height:310px;display:flex;flex-direction:column;padding:12px;gap:8px;}
.gym-box[data-skin="card-cover"] > *{flex:0 0 auto;}
.gym-box[data-skin="card-cover"] .gym-cover{width:100%;height:168px;border-radius:14px;}
.gym-box[data-skin="card-cover"] .gym-t1{font-size:15px;}
.gym-box[data-skin="card-cover"] .gym-t2{font-size:11.5px;margin-top:1px;}
.gym-box[data-skin="card-cover"] .gym-ctl{display:flex;align-items:center;justify-content:space-around;}
.gym-box[data-skin="card-cover"] .gym-main{width:42px;height:42px;}

.gym-box[data-skin="card-split"]{width:420px;height:140px;display:flex;align-items:center;gap:14px;padding:0 18px 0 14px;}
.gym-box[data-skin="card-split"] .gym-cover{width:100px;height:100px;border-radius:12px;}
.gym-box[data-skin="card-split"] .gym-mid{gap:7px;}
.gym-box[data-skin="card-split"] .gym-t1{font-size:16px;}
.gym-box[data-skin="card-split"] .gym-t2{font-size:12px;}
.gym-box[data-skin="card-split"] .gym-ctl{display:flex;align-items:center;gap:18px;}
.gym-box[data-skin="card-split"] .gym-main{width:38px;height:38px;}

/* ===== 胶囊款 ===== */
.gym-box[data-skin="capsule-dot"]{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
.gym-box[data-skin="capsule-dot"] .gym-cover{position:absolute;inset:0;width:56px;height:56px;border-radius:50%;opacity:.45;}
.gym-box[data-skin="capsule-dot"] .gym-main{width:40px;height:40px;position:relative;z-index:2;}
.gym-box[data-skin="capsule-dot"] .gym-hd{height:10px;}
.gym-box[data-skin="capsule-dot"] .gym-x{display:none;}
.gym-cap-ring{position:absolute;inset:2px;border-radius:50%;pointer-events:none;}

.gym-box[data-skin="capsule-pill"]{width:148px;height:48px;border-radius:24px;display:flex;align-items:center;gap:8px;padding:0 12px 0 4px;}
.gym-box[data-skin="capsule-pill"] .gym-cover{width:40px;height:40px;border-radius:50%;}
.gym-box[data-skin="capsule-pill"] .gym-main{width:30px;height:30px;}
.gym-box[data-skin="capsule-pill"] .gym-hd{height:10px;}
.gym-box[data-skin="capsule-pill"] .gym-x{display:none;}
.gym-box[data-skin="capsule-pill"] .gym-underbar{position:absolute;left:10px;right:10px;bottom:5px;height:2px;background:#e6e9ea;border-radius:1px;}
body.dark-theme .gym-box[data-skin="capsule-pill"] .gym-underbar{background:#2f3336;}
.gym-box[data-skin="capsule-pill"] .gym-underbar>i{display:block;height:100%;background:#1d9bf0;width:0;border-radius:1px;}

/* ===== 歌词 ===== */
.gym-lyr{margin-top:8px;background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.18);padding:12px 14px;max-height:190px;overflow-y:auto;scroll-behavior:smooth;cursor:pointer;box-sizing:border-box;}
body.dark-theme .gym-lyr{background:#16181c;}
.gym-lyr.mini{max-height:none;padding:9px 14px;overflow:hidden;}
.gym-lyr p{margin:0;padding:5px 0;font-size:13px;line-height:1.5;color:#8b98a5;text-align:center;transition:color .15s;}
.gym-lyr p.on{color:#0f1419;font-weight:700;font-size:14.5px;}
body.dark-theme .gym-lyr p.on{color:#e7e9ea;}
.gym-lyr.mini p{padding:0;font-size:13.5px;font-weight:700;color:#0f1419;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
body.dark-theme .gym-lyr.mini p{color:#e7e9ea;}
.gym-lyr-empty{font-size:12px;color:#8b98a5;text-align:center;padding:8px 0;line-height:1.7;}
.gym-lyr-tip{font-size:10px;color:#8b98a5;text-align:center;margin-top:6px;}

/* ===== 黑胶款·刻度波形横款 6 ===== */
.gym-box[data-skin="vinyl-scale"]{width:640px;height:180px;display:flex;align-items:center;gap:20px;padding:0 24px 0 14px;}
.gym-box[data-skin="vinyl-scale"] .gym-vinyl{width:140px;height:140px;}
.gym-box[data-skin="vinyl-scale"] .gym-vinyl .gym-cover{width:50px;height:50px;margin:-25px 0 0 -25px;}
.gym-box[data-skin="vinyl-scale"] .gym-mid{gap:9px;}
.gym-box[data-skin="vinyl-scale"] .gym-t1{font-size:16px;}
.gym-box[data-skin="vinyl-scale"] .gym-t2{font-size:12px;}
.gym-box[data-skin="vinyl-scale"] .gym-scale{display:flex;align-items:flex-end;gap:3px;height:30px;overflow:hidden;}
.gym-box[data-skin="vinyl-scale"] .gym-scale i{flex:1 1 auto;min-width:1px;background:#cfd9de;}
.gym-box[data-skin="vinyl-scale"] .gym-scale i.on{background:#0f1419;}
body.dark-theme .gym-box[data-skin="vinyl-scale"] .gym-scale i{background:#2f3336;}
body.dark-theme .gym-box[data-skin="vinyl-scale"] .gym-scale i.on{background:#e7e9ea;}
.gym-box[data-skin="vinyl-scale"] .gym-ctl{display:flex;align-items:center;gap:26px;}
.gym-box[data-skin="vinyl-scale"] .gym-main{width:44px;height:44px;}

/* ===== 迷你条·极简 10 / 气泡 4 / 双排六键 2 ===== */
.gym-box[data-skin="mini-plain"]{width:340px;height:70px;border-radius:14px;display:flex;align-items:center;gap:11px;padding:0 14px;}
.gym-box[data-skin="mini-plain"] .gym-cover{width:46px;height:46px;border-radius:8px;}
.gym-box[data-skin="mini-plain"] .gym-mid{gap:3px;}
.gym-box[data-skin="mini-plain"] .gym-t1{font-size:14.5px;}
.gym-box[data-skin="mini-plain"] .gym-t2{font-size:11px;}
.gym-box[data-skin="mini-plain"] .gym-main{width:34px;height:34px;}
.gym-box[data-skin="mini-plain"] .gym-hd{height:14px;}

.gym-box[data-skin="mini-bubble"]{width:400px;height:80px;border-radius:16px;display:flex;align-items:center;gap:12px;padding:0 16px;overflow:visible;}
.gym-box[data-skin="mini-bubble"]::after{content:"";position:absolute;left:52px;bottom:-11px;width:0;height:0;
  border-left:11px solid transparent;border-right:11px solid transparent;border-top:12px solid #fff;}
body.dark-theme .gym-box[data-skin="mini-bubble"]::after{border-top-color:#16181c;}
.gym-box[data-skin="mini-bubble"] .gym-wave{height:30px;flex:1 1 auto;}
.gym-box[data-skin="mini-bubble"] .gym-main{width:36px;height:36px;}
.gym-box[data-skin="mini-bubble"] .gym-hd{height:14px;}

.gym-box[data-skin="mini-six"]{width:420px;height:100px;display:flex;align-items:center;gap:13px;padding:0 16px 0 12px;}
.gym-box[data-skin="mini-six"] .gym-cover{width:62px;height:62px;border-radius:9px;}
.gym-box[data-skin="mini-six"] .gym-mid{gap:5px;}
.gym-box[data-skin="mini-six"] .gym-t1{font-size:14.5px;}
.gym-box[data-skin="mini-six"] .gym-six{display:grid;grid-template-columns:repeat(3,26px);gap:6px;flex:0 0 auto;}
.gym-box[data-skin="mini-six"] .gym-six .gym-b{width:26px;height:26px;border-radius:50%;background:#0f1419;color:#fff;}
body.dark-theme .gym-box[data-skin="mini-six"] .gym-six .gym-b{background:#e7e9ea;color:#16181c;}
.gym-box[data-skin="mini-six"] .gym-six .gym-b svg{width:12px;height:12px;}

/* ===== 卡片款·VIP 竖版 17 / 右侧圆键 15 / 圆封面 21 / 右竖排 9 ===== */
.gym-box[data-skin="card-vip"]{width:300px;height:480px;display:flex;flex-direction:column;padding:18px 16px 14px;gap:10px;}
.gym-box[data-skin="card-vip"] > *{flex:0 0 auto;}
.gym-box[data-skin="card-vip"] .gym-vip-hd{display:flex;align-items:flex-start;gap:8px;}
.gym-box[data-skin="card-vip"] .gym-vip-badge{margin-left:auto;flex:0 0 auto;border:1px solid #8b98a5;color:#8b98a5;
  border-radius:12px;padding:2px 10px;font-size:10.5px;}
.gym-box[data-skin="card-vip"] .gym-cover{width:100%;height:210px;border-radius:12px;}
.gym-box[data-skin="card-vip"] .gym-txt{text-align:center;}
.gym-box[data-skin="card-vip"] .gym-t1{font-size:18px;}
.gym-box[data-skin="card-vip"] .gym-t2{font-size:12px;margin-top:3px;}
.gym-box[data-skin="card-vip"] .gym-ctl{display:flex;align-items:center;justify-content:space-between;padding:0 4px;}
.gym-box[data-skin="card-vip"] .gym-main{width:44px;height:44px;}

.gym-box[data-skin="card-side"]{width:320px;height:360px;display:flex;gap:12px;padding:14px;}
.gym-box[data-skin="card-side"] .gym-sidecol{display:flex;flex-direction:column;justify-content:center;gap:12px;flex:0 0 auto;}
.gym-box[data-skin="card-side"] .gym-sidecol .gym-b{width:38px;height:38px;border-radius:50%;background:#0f1419;color:#fff;}
body.dark-theme .gym-box[data-skin="card-side"] .gym-sidecol .gym-b{background:#e7e9ea;color:#16181c;}
.gym-box[data-skin="card-side"] .gym-left{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:9px;}
.gym-box[data-skin="card-side"] .gym-left > *{flex:0 0 auto;}
.gym-box[data-skin="card-side"] .gym-cover{width:100%;height:180px;border-radius:12px;}
.gym-box[data-skin="card-side"] .gym-t1{font-size:14.5px;}
.gym-box[data-skin="card-side"] .gym-t2{font-size:11px;margin-top:1px;}

.gym-box[data-skin="card-circle"]{width:280px;height:330px;display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px 16px 14px;}
.gym-box[data-skin="card-circle"] > *{flex:0 0 auto;}
.gym-box[data-skin="card-circle"] .gym-cover{width:170px;height:170px;border-radius:50%;box-shadow:0 6px 22px rgba(0,0,0,.16);}
.gym-box[data-skin="card-circle"] .gym-txt{text-align:center;width:100%;}
.gym-box[data-skin="card-circle"] .gym-t1{font-size:15px;}
.gym-box[data-skin="card-circle"] .gym-t2{font-size:11px;margin-top:2px;}
.gym-box[data-skin="card-circle"] .gym-row{width:100%;}
.gym-box[data-skin="card-circle"] .gym-ctl{display:flex;align-items:center;justify-content:center;gap:18px;}
.gym-box[data-skin="card-circle"] .gym-main{width:40px;height:40px;}

.gym-box[data-skin="card-right"]{width:300px;height:310px;display:flex;flex-direction:column;padding:14px;gap:9px;}
.gym-box[data-skin="card-right"] > *{flex:0 0 auto;}
.gym-box[data-skin="card-right"] .gym-toprow{display:flex;gap:11px;}
.gym-box[data-skin="card-right"] .gym-cover{flex:1 1 auto;height:160px;border-radius:12px;}
.gym-box[data-skin="card-right"] .gym-rcol{display:flex;flex-direction:column;justify-content:center;gap:11px;flex:0 0 auto;}
.gym-box[data-skin="card-right"] .gym-rcol .gym-b{width:36px;height:36px;border-radius:50%;background:rgba(128,128,128,.12);}
/* ⚠️ 上面那条（两级选择器）比 .gym-main（一级）更具体，会把播放键的黑底盖成浅灰，
   在浅色背景上几乎看不见。这里显式把主播放键的样式再写回来。 */
.gym-box[data-skin="card-right"] .gym-rcol .gym-b.gym-main{width:42px;height:42px;background:#0f1419;color:#fff;}
body.dark-theme .gym-box[data-skin="card-right"] .gym-rcol .gym-b.gym-main{background:#e7e9ea;color:#16181c;}
.gym-box[data-skin="card-right"] .gym-t1{font-size:16px;}
.gym-box[data-skin="card-right"] .gym-t2{font-size:12px;margin-top:2px;}

/* ===== 横幅款 11 / 16 / 14 ===== */
.gym-box[data-skin="banner-vip"]{width:560px;height:230px;display:flex;align-items:center;gap:18px;padding:0 22px 0 18px;}
.gym-box[data-skin="banner-vip"] .gym-cover{width:170px;height:170px;border-radius:10px;}
.gym-box[data-skin="banner-vip"] .gym-mid{gap:9px;}
.gym-box[data-skin="banner-vip"] .gym-tagrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.gym-box[data-skin="banner-vip"] .gym-tag{background:#0f1419;color:#fff;border-radius:5px;padding:2px 9px;font-size:10.5px;flex:0 0 auto;}
body.dark-theme .gym-box[data-skin="banner-vip"] .gym-tag{background:#e7e9ea;color:#16181c;}
.gym-box[data-skin="banner-vip"] .gym-tag.ghost{background:rgba(128,128,128,.15);color:inherit;}
.gym-box[data-skin="banner-vip"] .gym-wave{height:34px;}
.gym-box[data-skin="banner-vip"] .gym-t1{font-size:17px;}
.gym-box[data-skin="banner-vip"] .gym-t2{font-size:11.5px;}
.gym-box[data-skin="banner-vip"] .gym-ctl{display:flex;align-items:center;gap:14px;}
.gym-box[data-skin="banner-vip"] .gym-ctl .gym-b{width:38px;height:38px;border-radius:50%;border:1.5px solid #8b98a5;}
.gym-box[data-skin="banner-vip"] .gym-main{width:38px;height:38px;border:none;}

.gym-box[data-skin="banner-heart"]{width:700px;height:160px;display:flex;align-items:center;gap:16px;padding:0 22px 0 16px;}
.gym-box[data-skin="banner-heart"] .gym-cover{width:110px;height:110px;border-radius:10px;}
.gym-box[data-skin="banner-heart"] .gym-mid{gap:7px;}
.gym-box[data-skin="banner-heart"] .gym-t1{font-size:19px;}
.gym-box[data-skin="banner-heart"] .gym-t2{font-size:13px;}
.gym-box[data-skin="banner-heart"] .gym-lowrow{display:flex;align-items:center;gap:14px;}
.gym-box[data-skin="banner-heart"] .gym-wave{height:40px;flex:1 1 auto;}
.gym-box[data-skin="banner-heart"] .gym-main{width:42px;height:42px;}
.gym-box[data-skin="banner-heart"] .gym-heart{flex:0 0 auto;}
.gym-box[data-skin="banner-heart"] .gym-heart svg{width:30px;height:30px;}

.gym-box[data-skin="banner-wave"]{width:420px;height:200px;display:flex;flex-direction:column;justify-content:center;gap:9px;padding:0 20px;}
.gym-box[data-skin="banner-wave"] > *{flex:0 0 auto;}
.gym-box[data-skin="banner-wave"] .gym-wave{height:34px;}
.gym-box[data-skin="banner-wave"] .gym-wave.thin{height:16px;opacity:.55;}
.gym-box[data-skin="banner-wave"] .gym-ctl{display:flex;align-items:center;justify-content:space-between;}
.gym-box[data-skin="banner-wave"] .gym-main{width:48px;height:48px;}

/* ===== 功能款 12 / 7 / 20 ===== */
.gym-box[data-skin="fn-rec"]{width:360px;height:300px;display:flex;flex-direction:column;padding:14px;gap:10px;}
.gym-box[data-skin="fn-rec"] > *{flex:0 0 auto;}
.gym-box[data-skin="fn-rec"] .gym-nowbox{display:flex;align-items:center;gap:11px;background:rgba(128,128,128,.12);border-radius:11px;padding:10px;}
.gym-box[data-skin="fn-rec"] .gym-nowbox .gym-cover{width:52px;height:52px;border-radius:7px;}
.gym-box[data-skin="fn-rec"] .gym-t1{font-size:14px;}
.gym-box[data-skin="fn-rec"] .gym-t2{font-size:11px;}
.gym-box[data-skin="fn-rec"] .gym-recrow{display:flex;align-items:center;gap:10px;}
.gym-box[data-skin="fn-rec"] .gym-main{width:40px;height:40px;}
.gym-box[data-skin="fn-rec"] .gym-recs{display:flex;gap:7px;flex-wrap:wrap;}
.gym-box[data-skin="fn-rec"] .gym-rec{border:none;background:rgba(128,128,128,.14);border-radius:9px;padding:7px 10px;
  font-size:11px;cursor:pointer;color:inherit;flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:inherit;}
.gym-box[data-skin="fn-rec"] .gym-rec:hover{background:#1d9bf0;color:#fff;}

.gym-box[data-skin="fn-now"]{width:420px;height:210px;display:flex;flex-direction:column;padding:12px 14px;gap:9px;}
.gym-box[data-skin="fn-now"] > *{flex:0 0 auto;}
.gym-box[data-skin="fn-now"] .gym-topbar{display:flex;align-items:center;gap:9px;}
.gym-box[data-skin="fn-now"] .gym-nowlabel{font-size:9.5px;letter-spacing:.14em;color:#8b98a5;}
.gym-box[data-skin="fn-now"] .gym-search{flex:1 1 auto;min-width:0;border:1px solid #cfd9de;border-radius:12px;
  padding:4px 10px;font-size:11px;background:transparent;color:inherit;outline:none;font-family:inherit;}
.gym-box[data-skin="fn-now"] .gym-search:focus{border-color:#1d9bf0;}
.gym-box[data-skin="fn-now"] .gym-body{display:flex;gap:12px;flex:1 1 auto;min-height:0;}
.gym-box[data-skin="fn-now"] .gym-cover{width:104px;height:104px;border-radius:9px;}
.gym-box[data-skin="fn-now"] .gym-mid{gap:7px;}
.gym-box[data-skin="fn-now"] .gym-t1{font-size:15px;}
.gym-box[data-skin="fn-now"] .gym-t2{font-size:11px;}
.gym-box[data-skin="fn-now"] .gym-ctl{display:flex;align-items:center;gap:14px;}
.gym-box[data-skin="fn-now"] .gym-main{width:34px;height:34px;}
.gym-box[data-skin="fn-now"] .gym-hits{position:absolute;left:14px;right:14px;bottom:10px;background:#fff;
  border-radius:9px;box-shadow:0 4px 16px rgba(0,0,0,.16);max-height:112px;overflow-y:auto;z-index:8;}
body.dark-theme .gym-box[data-skin="fn-now"] .gym-hits{background:#22252a;}
.gym-box[data-skin="fn-now"] .gym-hit{padding:7px 11px;font-size:12px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.gym-box[data-skin="fn-now"] .gym-hit:hover{background:rgba(29,155,240,.12);}

.gym-box[data-skin="fn-wave"]{width:400px;height:220px;display:flex;flex-direction:column;padding:14px 16px;gap:11px;}
.gym-box[data-skin="fn-wave"] > *{flex:0 0 auto;}
.gym-box[data-skin="fn-wave"] .gym-t1{font-size:15px;}
.gym-box[data-skin="fn-wave"] .gym-wave{height:56px;}
.gym-box[data-skin="fn-wave"] .gym-ctl{display:flex;align-items:center;justify-content:space-between;}
.gym-box[data-skin="fn-wave"] .gym-main{width:70px;height:36px;border-radius:9px;}

/* ===== 特殊款 1 平板 / 19 竖排音量 ===== */
.gym-box[data-skin="sp-pad"]{width:400px;height:420px;display:flex;flex-direction:column;padding:0;gap:0;background:#0f1419;}
body.dark-theme .gym-box[data-skin="sp-pad"]{background:#000;}
.gym-box[data-skin="sp-pad"] .gym-screen{margin:14px 14px 0;border-radius:12px;overflow:hidden;flex:1 1 auto;min-height:0;
  border:3px solid #2b2f33;background:#e6e9ea;}
.gym-box[data-skin="sp-pad"] .gym-cover{width:100%;height:100%;border-radius:0;}
.gym-box[data-skin="sp-pad"] .gym-padfoot{background:#fff;border-radius:0 0 16px 16px;padding:10px 14px 12px;
  display:flex;flex-direction:column;gap:7px;flex:0 0 auto;}
body.dark-theme .gym-box[data-skin="sp-pad"] .gym-padfoot{background:#16181c;}
.gym-box[data-skin="sp-pad"] .gym-ctl{display:flex;align-items:center;justify-content:space-between;}
.gym-box[data-skin="sp-pad"] .gym-main{width:36px;height:36px;}
.gym-box[data-skin="sp-pad"] .gym-x{background:rgba(255,255,255,.9);}

.gym-box[data-skin="sp-vol"]{width:96px;height:300px;border-radius:22px;display:flex;flex-direction:column;
  align-items:center;gap:10px;padding:16px 10px 14px;}
.gym-box[data-skin="sp-vol"] > *{flex:0 0 auto;}
.gym-box[data-skin="sp-vol"] .gym-t1{font-size:13px;text-align:center;width:100%;}
.gym-box[data-skin="sp-vol"] .gym-t2{font-size:10px;text-align:center;width:100%;}
.gym-box[data-skin="sp-vol"] .gym-vbar{flex:1 1 auto;width:8px;border-radius:4px;background:#e6e9ea;position:relative;cursor:pointer;min-height:0;}
body.dark-theme .gym-box[data-skin="sp-vol"] .gym-vbar{background:#2f3336;}
.gym-box[data-skin="sp-vol"] .gym-vfill{position:absolute;left:0;right:0;bottom:0;border-radius:4px;background:#0f1419;height:0;}
body.dark-theme .gym-box[data-skin="sp-vol"] .gym-vfill{background:#e7e9ea;}
.gym-box[data-skin="sp-vol"] .gym-vdot{position:absolute;left:50%;width:16px;height:16px;margin:-8px 0 0 -8px;
  border-radius:50%;background:#fff;border:2px solid #0f1419;bottom:0;}
body.dark-theme .gym-box[data-skin="sp-vol"] .gym-vdot{background:#16181c;border-color:#e7e9ea;}
.gym-box[data-skin="sp-vol"] .gym-main{width:44px;height:44px;}
.gym-box[data-skin="sp-vol"] .gym-hd{height:12px;}

/* ===== 🎧 一起听 ===== */
/* 参与者小条：挂在播放器上方，不用改 11 个皮肤各自的结构 */
.gym-with{display:flex;align-items:center;gap:6px;margin-bottom:6px;padding:4px 8px;border-radius:16px;
  background:rgba(255,255,255,.92);box-shadow:0 3px 12px rgba(0,0,0,.12);width:fit-content;max-width:100%;
  opacity:.55;transition:opacity .18s;cursor:pointer;}
.gym-with:hover,.gym-with.on{opacity:1;}
body.dark-theme .gym-with{background:rgba(22,24,28,.94);}
.gym-with-av{width:22px;height:22px;border-radius:50%;background:#1d9bf0;color:#fff;font-size:11px;
  display:flex;align-items:center;justify-content:center;flex:0 0 auto;overflow:hidden;background-size:cover;background-position:center;}
.gym-with-txt{font-size:11.5px;color:#536471;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
body.dark-theme .gym-with-txt{color:#8b98a5;}
.gym-with-add{width:20px;height:20px;border-radius:50%;border:1px dashed #1d9bf0;color:#1d9bf0;background:none;
  font-size:13px;line-height:1;cursor:pointer;flex:0 0 auto;padding:0;display:flex;align-items:center;justify-content:center;}

/* 角色说话的气泡：飘在播放器上方，几秒后自己淡出 */
.gym-bubble{position:absolute;bottom:calc(100% + 8px);left:0;max-width:300px;z-index:20;
  background:#fff;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:9px 12px;
  display:flex;gap:8px;align-items:flex-start;animation:gymPop .22s ease-out;}
body.dark-theme .gym-bubble{background:#16181c;}
@keyframes gymPop{from{opacity:0;transform:translateY(6px) scale(.96);}to{opacity:1;transform:none;}}
.gym-bubble.out{opacity:0;transition:opacity .5s;}
.gym-bubble .gym-with-av{width:26px;height:26px;font-size:12px;}
.gym-bubble-b{min-width:0;}
.gym-bubble-n{font-size:11px;color:#1d9bf0;font-weight:700;margin-bottom:2px;}
.gym-bubble-t{font-size:12.5px;line-height:1.55;color:#0f1419;word-break:break-word;}
body.dark-theme .gym-bubble-t{color:#e7e9ea;}

/* 聊天区：默认只是一条细缝，点开才展开——不打扰整体观感 */
.gym-chat{margin-top:6px;background:rgba(255,255,255,.92);border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.12);
  overflow:hidden;box-sizing:border-box;}
body.dark-theme .gym-chat{background:rgba(22,24,28,.94);}
.gym-chat-hd{display:flex;align-items:center;gap:6px;padding:6px 11px;cursor:pointer;font-size:11.5px;color:#536471;}
.gym-chat-hd:hover{color:#1d9bf0;}
body.dark-theme .gym-chat-hd{color:#8b98a5;}
.gym-chat-bd{max-height:170px;overflow-y:auto;padding:2px 11px 8px;}
.gym-msg{margin-bottom:7px;font-size:12.5px;line-height:1.55;}
.gym-msg b{color:#1d9bf0;font-size:11px;display:block;margin-bottom:1px;}
.gym-msg.me{text-align:right;}
.gym-msg.me b{color:#8b98a5;}
.gym-msg span{color:#0f1419;}
body.dark-theme .gym-msg span{color:#e7e9ea;}
.gym-chat-in{display:flex;gap:6px;padding:0 11px 9px;}
.gym-chat-in input{flex:1 1 auto;min-width:0;border:1px solid #cfd9de;border-radius:14px;padding:5px 10px;
  font-size:12.5px;background:transparent;color:inherit;outline:none;font-family:inherit;}
.gym-chat-in input:focus{border-color:#1d9bf0;}
.gym-chat-in button{border:none;background:#1d9bf0;color:#fff;border-radius:14px;padding:5px 12px;font-size:12px;cursor:pointer;flex:0 0 auto;font-family:inherit;}
.gym-chat-tools{display:flex;gap:5px;padding:0 11px 8px;flex-wrap:wrap;}

/* ===== 管理面板 ===== */
#gymMgr{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;padding:16px;}
#gymMgr.on{display:flex;}
.gym-mgr-box{background:#fff;border-radius:16px;width:560px;max-width:100%;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;}
body.dark-theme .gym-mgr-box{background:#16181c;color:#e7e9ea;}
.gym-mgr-hd{padding:15px 18px 9px;font-size:17px;font-weight:700;color:#1d9bf0;display:flex;align-items:center;gap:8px;}
.gym-tabs{display:flex;gap:4px;padding:0 18px;border-bottom:1px solid rgba(128,128,128,.2);}
.gym-tab{border:none;background:none;padding:9px 12px;font-size:13.5px;cursor:pointer;color:#8b98a5;border-bottom:2px solid transparent;font-family:inherit;}
.gym-tab.on{color:#1d9bf0;border-bottom-color:#1d9bf0;font-weight:700;}
.gym-mgr-bd{padding:14px 18px 16px;overflow-y:auto;flex:1 1 auto;}
.gym-sec{margin-bottom:16px;}
.gym-sec>h4{margin:0 0 8px;font-size:13px;color:#1d9bf0;}
.gym-hint{font-size:12px;color:#8b98a5;line-height:1.7;margin-bottom:8px;}
.gym-cats{display:grid;grid-template-columns:repeat(auto-fit,minmax(124px,1fr));gap:8px;}
.gym-cat{border:1px solid #cfd9de;border-radius:10px;padding:9px 11px;cursor:pointer;background:transparent;text-align:left;font-family:inherit;}
.gym-cat.on{border-color:#1d9bf0;background:rgba(29,155,240,.08);}
.gym-cat b{display:block;font-size:13px;color:#0f1419;}
body.dark-theme .gym-cat b{color:#e7e9ea;}
.gym-cat span{font-size:11px;color:#8b98a5;font-variant-numeric:tabular-nums;}
.gym-cat em{font-style:normal;color:#1d9bf0;font-size:11px;}
.gym-in{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cfd9de;border-radius:8px;font-size:13px;background:transparent;color:inherit;outline:none;margin-bottom:8px;font-family:inherit;}
.gym-in:focus{border-color:#1d9bf0;}
textarea.gym-in{resize:vertical;min-height:74px;line-height:1.6;}
.gym-btn{border:1px solid #1d9bf0;background:#1d9bf0;color:#fff;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer;margin:0 6px 6px 0;font-family:inherit;}
.gym-btn.ghost{background:transparent;color:#1d9bf0;}
.gym-btn.danger{background:transparent;border-color:#f91880;color:#f91880;}
.gym-tr{display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px dashed rgba(128,128,128,.25);}
.gym-tr:last-child{border-bottom:none;}
.gym-tr.on{background:rgba(29,155,240,.07);border-radius:8px;padding:8px;}
.gym-tr .gym-cover{width:38px;height:38px;border-radius:6px;}
.gym-tr-m{flex:1 1 auto;min-width:0;cursor:pointer;}
.gym-tr-m b{display:block;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.gym-tr-m span{font-size:11px;color:#8b98a5;}
.gym-mini-b{border:none;background:rgba(128,128,128,.12);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;color:inherit;flex:0 0 auto;font-family:inherit;}
.gym-mini-b.on{background:#1d9bf0;color:#fff;}
.gym-empty{font-size:13px;color:#8b98a5;text-align:center;padding:20px 0;line-height:1.8;}
.gym-edit{border:1px solid #1d9bf0;border-radius:12px;padding:12px;margin:8px 0 12px;background:rgba(29,155,240,.04);}
.gym-edit h5{margin:0 0 10px;font-size:13px;color:#1d9bf0;}
.gym-cov-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.gym-cov-row .gym-cover{width:64px;height:64px;border-radius:8px;}
.gym-lbl{font-size:11.5px;color:#8b98a5;display:block;margin-bottom:3px;}
.gym-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;}
.gym-chip{border:1px solid #cfd9de;background:transparent;border-radius:14px;padding:4px 11px;font-size:11.5px;cursor:pointer;color:inherit;font-family:inherit;}
.gym-chip.on{border-color:#1d9bf0;background:#1d9bf0;color:#fff;}
.gym-pl{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px dashed rgba(128,128,128,.25);}
.gym-pl:last-child{border-bottom:none;}
.gym-pl b{flex:1 1 auto;font-size:13.5px;cursor:pointer;}
.gym-pl.on b{color:#1d9bf0;}
@media (max-width:600px){
  #gymRoot{right:12px;bottom:80px;}
  /* 在聊天页里：往上挪一截，别挡住输入框（手机上输入框就在最底下） */
  body:has(#view-chat:not([style*="none"])) #gymRoot{bottom:150px;}
  .gym-box{max-width:calc(100vw - 24px);}
  .gym-box[data-skin="vinyl-wide"],.gym-box[data-skin="card-split"],
  .gym-box[data-skin="vinyl-classic"],.gym-box[data-skin="mini-round"],
  .gym-box[data-skin="mini-bar"],.gym-box[data-skin="mini-wave"],
  .gym-box[data-skin="card-classic"],.gym-box[data-skin="card-cover"],
  .gym-box[data-skin="vinyl-tall"],.gym-box[data-skin="vinyl-scale"],
  .gym-box[data-skin="mini-plain"],.gym-box[data-skin="mini-bubble"],.gym-box[data-skin="mini-six"],
  .gym-box[data-skin="card-vip"],.gym-box[data-skin="card-side"],.gym-box[data-skin="card-circle"],
  .gym-box[data-skin="card-right"],.gym-box[data-skin="banner-vip"],.gym-box[data-skin="banner-heart"],
  .gym-box[data-skin="banner-wave"],.gym-box[data-skin="fn-rec"],.gym-box[data-skin="fn-now"],
  .gym-box[data-skin="fn-wave"],.gym-box[data-skin="sp-pad"]{width:calc(100vw - 24px);}
  .gym-lyr{max-height:150px;}
}`;

    const IC = {
        play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
        prev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14l-11-7z"/></svg>',
        next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5l11 7-11 7z"/></svg>',
        rew: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11 5v14l-9-7zM22 5v14l-9-7z"/></svg>',
        ff: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 5v14l9-7zM2 5v14l9-7z"/></svg>',
        list: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
        lyr: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
        heart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.7-7.7 1.1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
        shuffle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
        stop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>',
        loop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>'
    };

    // ---------- 挂载 ----------
    function mount() {
        const st = document.createElement('style');
        st.id = 'gymStyle'; st.textContent = CSS;
        document.head.appendChild(st);

        const root = document.createElement('div');
        root.id = 'gymRoot';
        root.innerHTML = '<div class="gym-with" id="gymWith" style="display:none"></div>'
            + '<div class="gym-box" id="gymBox"></div>'
            + '<div class="gym-lyr" id="gymLyr" style="display:none" onclick="gymLyrToggleSize(event)"></div>'
            + '<div class="gym-chat" id="gymChat" style="display:none"></div>';
        document.body.appendChild(root);

        const mgr = document.createElement('div');
        mgr.id = 'gymMgr';
        mgr.innerHTML = `<div class="gym-mgr-box">
            <div class="gym-mgr-hd">🎵 音乐盒<button class="gym-btn ghost" style="margin-left:auto" onclick="gymCloseMgr()">关闭</button></div>
            <div class="gym-tabs">
              <button class="gym-tab" id="gymTab-play" onclick="gymTab('play')">播放列表</button>
              <button class="gym-tab" id="gymTab-lib" onclick="gymTab('lib')">曲库 / 添加</button>
              <button class="gym-tab" id="gymTab-skin" onclick="gymTab('skin')">皮肤 / 歌词</button>
              <button class="gym-tab" id="gymTab-listen" onclick="gymTab('listen')">🎧 一起听</button>
              <button class="gym-tab" id="gymTab-toggle" onclick="gymTogglePlayer()" title="播放器悬浮窗显示/收起">🎚️ 播放器</button>
            </div>
            <div class="gym-mgr-bd" id="gymMgrBody"></div></div>`;
        mgr.addEventListener('click', e => { if (e.target === mgr) gymCloseMgr(); });
        document.body.appendChild(mgr);

        audio = new Audio();
        audio.volume = S.volume;
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('play', paint);
        audio.addEventListener('play', () => { if (wxHid) { wxHid = false; if (!S.hidden) { const r = document.getElementById('gymRoot'); if (r) r.style.display = 'block'; } } });
        audio.addEventListener('pause', paint);
        audio.addEventListener('loadedmetadata', () => { const t = cur(); if (t) t.dur = audio.duration; paint(); });
        audio.addEventListener('error', () => {
            const t = cur(); if (!t) return;
            toast('这首放不了', t.kind === 'url'
                ? '这个直链拿不到音频。可能是链接失效、需要登录，或者对方服务器不允许别的网页引用它。'
                : '这个文件读不出来，可能格式不支持或者存档里已经没有它了。');
        });

        if (S.pos) { root.style.left = S.pos.x + 'px'; root.style.top = S.pos.y + 'px'; root.style.right = 'auto'; root.style.bottom = 'auto'; }
        if (S.hidden) root.style.display = 'none';
        // 💬 微信模式里播放条默认收着（只是这次不露出来，不改你在白露里的设置）；一放歌就自己出来
        try { if (localStorage.getItem('gyWxMode') === '1') window.gymWxCollapse(); } catch (e) {}
        bindDrag(root);
        paint();
    }

    function toast(title, desc) {
        if (typeof showToast === 'function') showToast('<div class="avatar" style="width:40px;height:40px;background:#1d9bf0;color:#fff;font-size:19px;">🎵</div>', title, desc, null, null, false);
        else console.warn('[音乐盒]', title, desc);
    }

    function bindDrag(root) {
        let sx = 0, sy = 0, ox = 0, oy = 0;
        const down = e => {
            const p = e.touches ? e.touches[0] : e;
            if (e.target.closest('.gym-b,.gym-bar,.gym-x,button,.gym-lyr')) return;
            dragging = true; root.classList.add('gym-drag');
            const r = root.getBoundingClientRect();
            ox = r.left; oy = r.top; sx = p.clientX; sy = p.clientY;
            root.style.left = ox + 'px'; root.style.top = oy + 'px';
            root.style.right = 'auto'; root.style.bottom = 'auto';
            e.preventDefault();
        };
        const move = e => {
            if (!dragging) return;
            const p = e.touches ? e.touches[0] : e;
            const w = root.offsetWidth, h = root.offsetHeight;
            let x = ox + p.clientX - sx, y = oy + p.clientY - sy;
            x = Math.max(4, Math.min(window.innerWidth - w - 4, x));
            y = Math.max(4, Math.min(window.innerHeight - h - 4, y));
            root.style.left = x + 'px'; root.style.top = y + 'px';
        };
        const up = () => {
            if (!dragging) return;
            dragging = false; root.classList.remove('gym-drag');
            S.pos = { x: parseInt(root.style.left) || 0, y: parseInt(root.style.top) || 0 };
            save();
        };
        root.addEventListener('mousedown', down); root.addEventListener('touchstart', down, { passive: false });
        window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('mouseup', up); window.addEventListener('touchend', up);
    }

    // ---------- 播放器渲染 ----------
    function waveHtml(pct, n) {
        let s = '';
        for (let i = 0; i < n; i++) {
            const h = 5 + ((i * 7919) % 16);   // 固定伪随机，每次渲染形状一致，不会跳
            s += `<i class="${(i / n * 100) < pct ? 'on' : ''}" style="height:${h}px"></i>`;
        }
        return s;
    }

    function paint() {
        const box = document.getElementById('gymBox');
        if (!box) return;
        const t = cur();
        const playing = audio && !audio.paused && !audio.ended;
        const title = t ? esc(t.title || '未命名') : '还没有歌';
        const artist = t ? esc(t.artist || '未知歌手') : '点列表按钮添加';
        const cover = t && t.cover ? `background-image:url('${t.cover}')` : '';
        const pct = (audio && audio.duration) ? (audio.currentTime / audio.duration * 100) : 0;
        const cs = audio ? fmt(audio.currentTime) : '0:00';
        const ds = (audio && audio.duration) ? fmt(audio.duration) : (t && t.dur ? fmt(t.dur) : '0:00');
        box.dataset.skin = S.skin;
        box.ondblclick = null; box.title = '';

        const bar = `<div class="gym-bar" onclick="gymSeek(event)"><div class="gym-fill" style="width:${pct}%"></div><div class="gym-dot" style="left:${pct}%"></div></div>`;
        const mainBtn = `<button class="gym-b gym-main" onclick="gymToggle()" title="${playing ? '暂停' : '播放'}">${playing ? IC.pause : IC.play}</button>`;
        const X = `<button class="gym-x" onclick="gymHide()" title="收起">×</button>`;
        const HD = `<div class="gym-hd"></div>`;
        const bList = `<button class="gym-b" onclick="gymOpenMgr()" title="播放列表">${IC.list}</button>`;
        const bLyr = `<button class="gym-b" onclick="gymToggleLyr()" title="歌词" style="${S.showLyrics ? 'color:#1d9bf0' : ''}">${IC.lyr}</button>`;
        const bPrev = `<button class="gym-b" onclick="gymPrev()">${IC.prev}</button>`;
        const bNext = `<button class="gym-b" onclick="gymNext()">${IC.next}</button>`;
        const times = `<div class="gym-row"><span class="gym-time">${cs}</span><span style="flex:1"></span><span class="gym-time">${ds}</span></div>`;
        const vinyl = `<div class="gym-vinyl ${playing ? 'spin' : ''}"><div class="gym-cover" style="${cover}"></div></div>`;
        const txt = `<div class="gym-txt"><div class="gym-t1">${title}</div><div class="gym-t2">${artist}</div></div>`;

        const K = S.skin;
        if (K === 'vinyl-classic') {
            box.innerHTML = `${HD}${X}${vinyl}<div class="gym-mid">${txt}<div class="gym-row">${bar}</div>${times}
              <div class="gym-ctl">${bList}${bPrev}${mainBtn}${bNext}${bLyr}</div></div>`;
        } else if (K === 'vinyl-wide') {
            box.innerHTML = `${HD}${X}${vinyl}<div class="gym-mid">${txt}
              <div class="gym-wave">${waveHtml(pct, 46)}</div>
              <div class="gym-row">${bar}</div>${times}
              <div class="gym-ctl">${bList}<button class="gym-b" onclick="gymPrev()">${IC.rew}</button>${mainBtn}<button class="gym-b" onclick="gymNext()">${IC.ff}</button>${bLyr}</div></div>`;
        } else if (K === 'vinyl-tall') {
            box.innerHTML = `${HD}${X}${vinyl}${txt}<div class="gym-row">${bar}</div>${times}
              <div class="gym-ctl">${bList}${bPrev}${mainBtn}${bNext}${bLyr}</div>`;
        } else if (K === 'mini-round') {
            box.innerHTML = `${HD}${X}<div class="gym-cover" style="${cover}"></div>
              <div class="gym-mid"><div class="gym-t1">${title}</div><div class="gym-t2">${artist}</div>
              <div class="gym-row">${bar}<span class="gym-time">${cs}</span></div></div>
              ${bPrev}${mainBtn}${bNext}${bList}`;
        } else if (K === 'mini-bar') {
            box.innerHTML = `${HD}${X}
              <button class="gym-b" onclick="gymSetLoop('${S.loop === 'shuffle' ? 'list' : 'shuffle'}')" title="随机" style="${S.loop === 'shuffle' ? 'color:#1d9bf0' : ''}">${IC.shuffle}</button>
              ${bPrev}${mainBtn}${bNext}
              <div class="gym-t1">${title}</div>
              ${bLyr}${bList}
              <div class="gym-underbar"><i style="width:${pct}%"></i></div>`;
        } else if (K === 'mini-wave') {
            box.innerHTML = `${HD}${X}<div class="gym-cover" style="${cover}"></div>
              <div class="gym-mid"><div class="gym-t1">${title}</div><div class="gym-t2">${artist}</div>
              <div class="gym-wave">${waveHtml(pct, 40)}</div></div>
              ${mainBtn}${bList}`;
        } else if (K === 'card-classic') {
            box.innerHTML = `${HD}${X}<div class="gym-cover" style="${cover}"></div>${txt}
              <div class="gym-wave">${waveHtml(pct, 34)}</div><div class="gym-row">${bar}</div>${times}
              <div class="gym-ctl">${bList}${bPrev}${mainBtn}${bNext}${bLyr}</div>`;
        } else if (K === 'card-cover') {
            box.innerHTML = `${HD}${X}<div class="gym-cover" style="${cover}"></div>${txt}
              <div class="gym-row">${bar}</div>${times}
              <div class="gym-ctl">${bLyr}${bPrev}${mainBtn}${bNext}${bList}</div>`;
        } else if (K === 'card-split') {
            box.innerHTML = `${HD}${X}<div class="gym-cover" style="${cover}"></div>
              <div class="gym-mid">${txt}<div class="gym-row">${bar}</div>${times}
              <div class="gym-ctl">${bList}<button class="gym-b" onclick="gymPrev()">${IC.rew}</button>${mainBtn}<button class="gym-b" onclick="gymNext()">${IC.ff}</button>${bLyr}</div></div>`;
        } else if (K === 'vinyl-scale') {
            let sc = '';
            for (let i = 0; i < 60; i++) { const h = 6 + ((i * 6301) % 24); sc += `<i class="${(i / 60 * 100) < pct ? 'on' : ''}" style="height:${h}px"></i>`; }
            box.innerHTML = `${HD}${X}${vinyl}<div class="gym-mid">${txt}
              <div class="gym-scale">${sc}</div><div class="gym-row">${bar}</div>${times}
              <div class="gym-ctl">${bList}<button class="gym-b" onclick="gymPrev()">${IC.rew}</button>${mainBtn}<button class="gym-b" onclick="gymNext()">${IC.ff}</button>${bLyr}</div></div>`;
        } else if (K === 'mini-plain') {
            box.innerHTML = `${HD}${X}<div class="gym-cover" style="${cover}"></div>
              <div class="gym-mid"><div class="gym-t1">${title}</div>
              <div class="gym-t2">${artist} · ${ds}</div></div>${mainBtn}${bList}`;
        } else if (K === 'mini-bubble') {
            box.innerHTML = `${HD}${X}<div class="gym-cover" style="${cover};width:44px;height:44px;border-radius:50%;"></div>
              <div class="gym-wave">${waveHtml(pct, 52)}</div>${mainBtn}${bList}`;
        } else if (K === 'mini-six') {
            box.innerHTML = `${HD}${X}<div class="gym-cover" style="${cover}"></div>
              <div class="gym-mid"><div class="gym-t1">${title}</div><div class="gym-row">${bar}</div>
              <div class="gym-row"><span class="gym-time">${cs}</span><span style="flex:1"></span><span class="gym-time">${ds}</span></div></div>
              <div class="gym-six">
                <button class="gym-b" onclick="gymPrev()">${IC.prev}</button>
                <button class="gym-b" onclick="gymToggle()">${playing ? IC.pause : IC.play}</button>
                <button class="gym-b" onclick="gymNext()">${IC.next}</button>
                <button class="gym-b" onclick="gymNudge(-10)" title="退10秒">${IC.rew}</button>
                <button class="gym-b" onclick="gymStop()" title="停止">${IC.stop}</button>
                <button class="gym-b" onclick="gymNudge(10)" title="进10秒">${IC.ff}</button>
              </div>`;
        } else if (K === 'card-vip') {
            box.innerHTML = `${HD}${X}
              <div class="gym-vip-hd"><div><div class="gym-t1" style="font-size:15px">${title}</div><div class="gym-t2">${artist}</div></div>
                <span class="gym-vip-badge">${t && t.kind === 'url' ? '直链' : '本地'}</span></div>
              <div class="gym-cover" style="${cover}"></div>
              ${txt}<div class="gym-row">${bar}</div>${times}
              <div class="gym-ctl">${bList}${bPrev}${mainBtn}${bNext}${bLyr}</div>`;
        } else if (K === 'card-side') {
            box.innerHTML = `${HD}${X}
              <div class="gym-left"><div class="gym-cover" style="${cover}"></div>${txt}<div class="gym-row">${bar}</div>${times}</div>
              <div class="gym-sidecol">${mainBtn}<button class="gym-b" onclick="gymNext()">${IC.next}</button>
                <button class="gym-b" onclick="gymOpenMgr()">${IC.list}</button></div>`;
        } else if (K === 'card-circle') {
            box.innerHTML = `${HD}${X}<div class="gym-cover ${playing ? 'spin' : ''}" style="${cover}"></div>${txt}
              <div class="gym-row">${bar}</div>${times}
              <div class="gym-ctl">${bList}${bPrev}${mainBtn}${bNext}${bLyr}</div>`;
        } else if (K === 'card-right') {
            box.innerHTML = `${HD}${X}
              <div class="gym-toprow"><div class="gym-cover" style="${cover}"></div>
                <div class="gym-rcol">${bLyr}${mainBtn}${bList}</div></div>
              ${txt}<div class="gym-row">${bar}</div>${times}`;
        } else if (K === 'banner-vip') {
            box.innerHTML = `${HD}${X}<div class="gym-cover" style="${cover}"></div>
              <div class="gym-mid">
                <div class="gym-tagrow"><span class="gym-tag">${t && t.lrc ? '有词' : '无词'}</span>
                  <span class="gym-t1" style="font-size:14px">${title}</span>
                  <span class="gym-tag ghost">${artist}</span></div>
                <div class="gym-wave">${waveHtml(pct, 56)}</div>
                <div class="gym-row">${bar}</div>${times}
                <div class="gym-row"><div class="gym-txt" style="flex:1 1 auto;min-width:0"><div class="gym-t1" style="font-size:15px">${title}</div><div class="gym-t2">${artist}</div></div>
                  <div class="gym-ctl"><button class="gym-b" onclick="gymPrev()">${IC.rew}</button>${mainBtn}
                    <button class="gym-b" onclick="gymNext()">${IC.ff}</button>
                    <button class="gym-b" onclick="gymSetLoop('${S.loop === 'one' ? 'list' : 'one'}')" title="循环" style="${S.loop === 'one' ? 'color:#1d9bf0;border-color:#1d9bf0' : ''}">${IC.loop}</button></div></div>
              </div>`;
        } else if (K === 'banner-heart') {
            box.innerHTML = `${HD}${X}<div class="gym-cover" style="${cover}"></div>
              <div class="gym-mid">${txt}<div class="gym-row">${bar}</div>${times}
                <div class="gym-lowrow">${mainBtn}
                  <button class="gym-b" onclick="gymSetLoop('${S.loop === 'shuffle' ? 'list' : 'shuffle'}')" style="${S.loop === 'shuffle' ? 'color:#1d9bf0' : ''}">${IC.shuffle}</button>
                  <div class="gym-wave">${waveHtml(pct, 60)}</div>
                  <button class="gym-b gym-heart" onclick="gymOpenMgr()">${IC.heart}</button></div></div>`;
        } else if (K === 'banner-wave') {
            box.innerHTML = `${HD}${X}<div class="gym-t1">${title}</div>
              <div class="gym-wave">${waveHtml(pct, 54)}</div>
              <div class="gym-wave thin">${waveHtml(pct, 54)}</div>
              <div class="gym-row">${bar}</div>${times}
              <div class="gym-ctl">${bList}<button class="gym-b" onclick="gymPrev()">${IC.rew}</button>${mainBtn}<button class="gym-b" onclick="gymNext()">${IC.ff}</button>${bLyr}</div>`;
        } else if (K === 'fn-rec') {
            // 推荐位放"角色想听的三首"：一起听的时候点一下就切过去，没人在听就是随机三首
            const recs = gymRecTracks();
            box.innerHTML = `${HD}${X}
              <div class="gym-nowbox"><div class="gym-cover" style="${cover}"></div>
                <div class="gym-mid"><div class="gym-t1">${title}</div><div class="gym-t2">${artist}</div></div>
                ${bList}</div>
              <div class="gym-row">${bar}</div>${times}
              <div class="gym-recrow">${bPrev}${mainBtn}${bNext}<span style="flex:1"></span>${bLyr}</div>
              <div style="font-size:10.5px;color:#8b98a5;">${charsIn().length ? esc(charsIn()[0].name) + '可能想听' : '接下来'}</div>
              <div class="gym-recs">${recs.map(r => `<button class="gym-rec" onclick="gymPlayTrackId('${r.id}')">${esc(r.title || '未命名')}</button>`).join('') || '<span style="font-size:11px;color:#8b98a5;">曲库里再多加几首就有推荐了</span>'}</div>`;
        } else if (K === 'fn-now') {
            box.innerHTML = `${HD}${X}
              <div class="gym-topbar"><span class="gym-nowlabel">NOW PLAYING</span>${bList}
                <input class="gym-search" id="gymQuick" placeholder="搜曲库…" oninput="gymQuickSearch(this.value)" onclick="event.stopPropagation()"></div>
              <div class="gym-body"><div class="gym-cover" style="${cover}"></div>
                <div class="gym-mid">${txt}<div class="gym-row">${bar}</div>${times}
                  <div class="gym-ctl">${bPrev}${mainBtn}${bNext}${bLyr}</div></div></div>
              <div class="gym-hits" id="gymHits" style="display:none"></div>`;
        } else if (K === 'fn-wave') {
            box.innerHTML = `${HD}${X}<div class="gym-t1">${title}</div>
              <div class="gym-wave">${waveHtml(pct, 46)}</div>
              <div class="gym-row">${bar}<span class="gym-time">${cs}</span></div>
              <div class="gym-ctl"><button class="gym-b" onclick="gymToggleLyr()" style="${S.showLyrics ? 'color:#1d9bf0' : ''}">${IC.heart}</button>
                ${bPrev}${mainBtn}${bNext}${bList}</div>`;
        } else if (K === 'sp-pad') {
            box.innerHTML = `${HD}${X}<div class="gym-screen"><div class="gym-cover" style="${cover}"></div></div>
              <div class="gym-padfoot"><div class="gym-row"><span class="gym-time">${cs}</span>${bar}<span class="gym-time">${ds}</span></div>
                <div class="gym-ctl">${bList}${bPrev}${mainBtn}${bNext}${bLyr}</div></div>`;
        } else if (K === 'sp-vol') {
            box.innerHTML = `${HD}<div class="gym-t1">${title}</div><div class="gym-t2">${artist}</div>
              <div class="gym-vbar" onclick="gymSeekV(event)"><div class="gym-vfill" style="height:${pct}%"></div><div class="gym-vdot" style="bottom:${pct}%"></div></div>
              ${mainBtn}`;
            box.ondblclick = () => gymOpenMgr();
        } else if (K === 'capsule-pill') {
            box.innerHTML = `${HD}<div class="gym-cover" style="${cover}"></div>${mainBtn}${bNext}
              <div class="gym-underbar"><i style="width:${pct}%"></i></div>`;
            box.ondblclick = () => gymOpenMgr();
            box.title = (t ? (t.title || '未命名') + ' — ' + (t.artist || '') : '还没有歌') + '（双击打开音乐盒）';
        } else { // capsule-dot
            box.innerHTML = `${HD}<div class="gym-cover" style="${cover}"></div>
              <svg class="gym-cap-ring" viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" fill="none" stroke="rgba(128,128,128,.25)" stroke-width="2"/><circle cx="26" cy="26" r="25" fill="none" stroke="#1d9bf0" stroke-width="2" stroke-linecap="round" stroke-dasharray="${(pct / 100 * 157).toFixed(1)} 157" transform="rotate(-90 26 26)"/></svg>${mainBtn}`;
            box.ondblclick = () => gymOpenMgr();
            box.title = (t ? (t.title || '未命名') + ' — ' + (t.artist || '') : '还没有歌') + '（双击打开音乐盒）';
        }
        paintLyr();
        paintWith();
        paintChat();
    }

    function paintLyr() {
        const el = document.getElementById('gymLyr');
        if (!el) return;
        if (!S.showLyrics || catOf(S.skin) === 'capsule') { el.style.display = 'none'; return; }
        el.style.display = 'block';
        el.style.width = (document.getElementById('gymBox').offsetWidth || 320) + 'px';
        el.classList.toggle('mini', !!S.lyrCollapsed);
        const t = cur();
        if (!t || !t.lrc || !String(t.lrc).trim()) {
            el.classList.remove('mini');
            el.innerHTML = '<div class="gym-lyr-empty">这首还没有歌词。<br>打开音乐盒 → 在曲库里点这首歌的「编辑」，就能上传 .lrc 或直接粘贴。</div>';
            return;
        }
        // 收起态：只显示当前这一行
        if (S.lyrCollapsed) {
            const line = lrcLines.length
                ? (lrcLines[Math.max(0, lrcIdx)] || lrcLines[0]).text
                : String(t.lrc).split('\n').filter(x => x.trim())[0];
            el.innerHTML = `<p>${esc(line || '♪')}</p>`;
            return;
        }
        if (!lrcLines.length) {
            el.innerHTML = String(t.lrc).split('\n').map(l => `<p>${esc(l)}</p>`).join('')
                + '<div class="gym-lyr-tip">单击收起成一行</div>';
            return;
        }
        el.innerHTML = lrcLines.map((l, i) => `<p class="${i === lrcIdx ? 'on' : ''}">${esc(l.text || '♪')}</p>`).join('')
            + '<div class="gym-lyr-tip">单击收起成一行</div>';
        const on = el.querySelector('p.on');
        if (on) el.scrollTop = Math.max(0, on.offsetTop - el.clientHeight / 2 + on.offsetHeight / 2);
    }

    function parseLrc(txt) {
        if (!txt) return [];
        const out = [];
        String(txt).split('\n').forEach(line => {
            const tags = [...line.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
            if (!tags.length) return;
            const text = line.replace(/\[[^\]]*\]/g, '').trim();
            tags.forEach(m => {
                const ms = m[3] ? parseInt((m[3] + '00').slice(0, 3)) : 0;
                out.push({ t: parseInt(m[1]) * 60 + parseInt(m[2]) + ms / 1000, text });
            });
        });
        return out.sort((a, b) => a.t - b.t);
    }

    // 🕒 一起听时长统计：按两次 timeupdate 之间真实流逝的时间累加。
    // 不用 audio.currentTime 的差值，因为拖进度条会跳；也不用定时器，省得播放器暂停了还在偷偷计时。
    let lastTick = 0;
    function tickStats() {
        const now = Date.now();
        const listening = charsIn().length > 0 && audio && !audio.paused && !audio.ended;
        if (!listening) { lastTick = 0; return; }
        if (!lastTick) { lastTick = now; return; }
        const d = now - lastTick;
        lastTick = now;
        if (d <= 0 || d > 5000) return;   // 切后台/休眠回来的那一大段不算数
        if (!S.stats) S.stats = { total: { ms: 0, songs: 0 }, byChar: {} };
        S.stats.total.ms += d;
        charsIn().forEach(c => {
            const k = String(c.id);
            if (!S.stats.byChar[k]) S.stats.byChar[k] = { ms: 0, songs: 0, first: now };
            S.stats.byChar[k].ms += d;
        });
    }

    function onTime() {
        tickStats();
        if (lrcLines.length) {
            let i = -1;
            for (let k = 0; k < lrcLines.length; k++) { if (audio.currentTime >= lrcLines[k].t - 0.15) i = k; else break; }
            if (i !== lrcIdx) {
                lrcIdx = i; paintLyr();
                // 🎧 唱到某句歌词接一句（走 sayOnLyric 开关；一首歌最多接 lyricMax 次，
                //    而且要隔开几句，不然一首歌能说个没完，也很贵）
                // 不掷骰子决定说不说 —— 由角色自己按人设判断这一句值不值得接
                // （不合胃口/不是 TA 会有反应的句子，就返回 NO，askChar 里直接丢掉）。
                // 这里只保留"别一首歌说个没完"的间隔限制，那是节奏问题不是性格问题。
                if (charsIn().length && LS().sayOnLyric && i >= 0
                    && lyricSaidThisSong < (LS().lyricMax || 2)
                    && i - lastSaidLyricIdx >= 4) {
                    lyricSaidThisSong++; lastSaidLyricIdx = i;
                    someoneSay('lyric');
                }
            }
        }
        const box = document.getElementById('gymBox');
        if (!box) return;
        const pct = (audio.duration ? audio.currentTime / audio.duration * 100 : 0);
        const f = box.querySelector('.gym-fill'), d = box.querySelector('.gym-dot');
        if (f) f.style.width = pct + '%';
        if (d) d.style.left = pct + '%';
        const tm = box.querySelector('.gym-time');
        if (tm) tm.textContent = fmt(audio.currentTime);
        const ub = box.querySelector('.gym-underbar > i');
        if (ub) ub.style.width = pct + '%';
        const ring = box.querySelector('.gym-cap-ring circle:last-child');
        if (ring) ring.setAttribute('stroke-dasharray', (pct / 100 * 157).toFixed(1) + ' 157');
        box.querySelectorAll('.gym-wave i').forEach((el, i, arr) => el.classList.toggle('on', (i / arr.length * 100) < pct));
    }

    function onEnded() {
        // 🎧 一首听完给个感想（走 sayOnEnd 开关）。先说再切下一首，不然上下文已经变了。
        if (charsIn().length && LS().sayOnEnd) someoneSay('end');
        if (S.loop === 'one') { audio.currentTime = 0; audio.play(); return; }
        gymNext();
    }

    // ---------- 播放控制 ----------
    window.gymToggle = async function () {
        const L = curTracks();
        if (!L.length) return gymOpenMgr();
        if (!audio.src) { await gymPlayAt(S.idx); return; }
        if (audio.paused) { try { await audio.play(); } catch (e) { toast('放不出来', String(e.message || e)); } }
        else audio.pause();
        paint();
    };
    window.gymPlayAt = async function (i) {
        const L = curTracks();
        if (!L.length) return;
        S.idx = (i + L.length) % L.length;
        const t = cur();
        const src = await srcOf(t);
        if (!src) { toast('这首没有音源', '它的文件可能已经不在了，去曲库里重新添加一次。'); return; }
        audio.src = src;
        lrcLines = parseLrc(t.lrc); lrcIdx = -1;
        lyricSaidThisSong = 0; lastSaidLyricIdx = -1;   // 新的一首，歌词接话次数清零
        lastTick = 0;
        // 🕒 有人在一起听的时候才算"一起听过的首数"
        if (charsIn().length) {
            if (!S.stats) S.stats = { total: { ms: 0, songs: 0 }, byChar: {} };
            S.stats.total.songs++;
            charsIn().forEach(c => {
                const k = String(c.id);
                if (!S.stats.byChar[k]) S.stats.byChar[k] = { ms: 0, songs: 0, first: Date.now() };
                S.stats.byChar[k].songs++;
            });
        }
        try { await audio.play(); } catch (e) { toast('放不出来', String(e.message || e)); }
        paint(); renderMgr(); save();
        // 🎧 换歌时说一句（走 sayOnSwitch 开关）
        if (charsIn().length && LS().sayOnSwitch) setTimeout(() => someoneSay('switch'), 1200);
    };
    // 只读：现在放的是哪首（小手机的「音乐」小组件用）
    window.gymNowInfo = function () {
        const t = cur(); if (!t) return null;
        return { title: t.title || '未命名', artist: t.artist || '', cover: t.cover || '', playing: !!(audio && !audio.paused),
                 t: audio ? audio.currentTime || 0 : 0, d: audio && isFinite(audio.duration) ? audio.duration : (t.dur || 0) };
    };
    window.gymNext = function () {
        const L = curTracks();
        if (!L.length) return;
        if (S.loop === 'shuffle' && L.length > 1) {
            let n; do { n = Math.floor(Math.random() * L.length); } while (n === S.idx);
            return gymPlayAt(n);
        }
        gymPlayAt(S.idx + 1);
    };
    window.gymPrev = function () { if (curTracks().length) gymPlayAt(S.idx - 1); };
    window.gymSeek = function (e) {
        if (!audio || !audio.duration) return;
        const r = e.currentTarget.getBoundingClientRect();
        audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * audio.duration;
        onTime();
    };
    window.gymToggleLyr = function () { S.showLyrics = !S.showLyrics; paint(); save(); };
    // 双排六键里的快退/快进/停止
    window.gymNudge = function (sec) {
        if (!audio || !audio.duration) return;
        audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + sec));
        onTime();
    };
    window.gymStop = function () { if (!audio) return; audio.pause(); audio.currentTime = 0; onTime(); paint(); };
    // 竖排音量条那款的竖向进度（从下往上）
    window.gymSeekV = function (e) {
        if (!audio || !audio.duration) return;
        const r = e.currentTarget.getBoundingClientRect();
        audio.currentTime = Math.max(0, Math.min(1, (r.bottom - e.clientY) / r.height)) * audio.duration;
        onTime();
    };
    // 按歌名在曲库里找（邀请卡 / TA 点名要听的那首）：先全等，再互相包含
    window.gymFindTrack = function (title) {
        const n = x => String(x || '').replace(/[《》「」"'“”\s]/g, '').toLowerCase();
        const t = n(title); if (!t) return null;
        return S.tracks.find(x => n(x.title) === t) || S.tracks.find(x => n(x.title) && (n(x.title).indexOf(t) !== -1 || t.indexOf(n(x.title)) !== -1)) || null;
    };
    window.gymPlayTrackId = function (id) {
        let i = curTracks().findIndex(t => t.id === id);
        if (i < 0) { S.curList = 'all'; i = S.tracks.findIndex(t => t.id === id); }
        if (i >= 0) gymPlayAt(i);
    };
    // 推荐位：一起听时优先推"还没一起听过的"，否则就是接下来几首
    function gymRecTracks() {
        const all = S.tracks || [];
        if (all.length < 2) return [];
        const t = cur();
        const rest = all.filter(x => !t || x.id !== t.id);
        return rest.slice(0, 3);
    }
    // NOW PLAYING 那款的搜索框
    window.gymQuickSearch = function (q) {
        const box = document.getElementById('gymHits');
        if (!box) return;
        q = String(q || '').trim().toLowerCase();
        if (!q) { box.style.display = 'none'; return; }
        const hits = (S.tracks || []).filter(t =>
            String(t.title || '').toLowerCase().includes(q) || String(t.artist || '').toLowerCase().includes(q)).slice(0, 6);
        if (!hits.length) { box.style.display = 'block'; box.innerHTML = '<div class="gym-hit" style="color:#8b98a5">没找到</div>'; return; }
        box.style.display = 'block';
        box.innerHTML = hits.map(t => `<div class="gym-hit" onclick="gymPlayTrackId('${t.id}');document.getElementById('gymHits').style.display='none'">${esc(t.title || '未命名')}<span style="color:#8b98a5"> · ${esc(t.artist || '')}</span></div>`).join('');
    };
    // 单击歌词条：展开 ↔ 只显示当前一行
    window.gymLyrToggleSize = function (e) {
        if (e) e.stopPropagation();
        S.lyrCollapsed = !S.lyrCollapsed;
        paintLyr(); save();
    };
    // 💬 微信模式用：临时收起 / 放回（不写存档，不动 S.hidden）
    window.gymWxCollapse = function () {
        const r = document.getElementById('gymRoot'); if (!r) return;
        if (audio && !audio.paused) return;          // 正在放歌就别收
        if (r.style.display !== 'none') { r.style.display = 'none'; wxHid = true; }
    };
    window.gymWxRestore = function () {
        if (!wxHid) return; wxHid = false;
        const r = document.getElementById('gymRoot'); if (r && !S.hidden) r.style.display = 'block';
    };
    window.gymHide = function () { S.hidden = true; document.getElementById('gymRoot').style.display = 'none'; save(); toast('播放器收起来了', '想再打开：设置 → 🧩 小功能 → 音乐盒（进去就会自动放出来），或者那一页顶上的「🎚️ 播放器」。'); };
    window.gymShow = function () { S.hidden = false; const r = document.getElementById('gymRoot'); if (r) r.style.display = 'block'; save(); };
    // 悬浮播放器的显示/收起。收起之后一定要有地方能放回来，否则就是"再也打不开"。
    window.gymTogglePlayer = function () {
        if (wxHid) { window.gymWxRestore(); toast('播放器出来了', '右下角那个就是。'); }
        else if (S.hidden) { gymShow(); toast('播放器出来了', '右下角那个就是。'); }
        else { gymHide(); }
        try { renderMgr(); } catch (e) {}
    };
    window.gymOpenMgr = function () { document.getElementById('gymMgr').classList.add('on'); renderMgr(); };
    window.gymCloseMgr = function () { document.getElementById('gymMgr').classList.remove('on'); editingId = null; };
    window.gymSetLoop = function (m) { S.loop = m; paint(); renderMgr(); save(); };

    // 点一个款式：已经在这个款式里就换下一个变体，否则跳到这个款式的第一个变体
    window.gymPickCat = function (cat) {
        const c = SKIN_CATS.find(x => x.cat === cat); if (!c) return;
        if (catOf(S.skin) === cat) {
            const i = c.variants.findIndex(v => v.k === S.skin);
            S.skin = c.variants[(i + 1) % c.variants.length].k;
        } else {
            S.skin = c.variants[0].k;
        }
        paint(); renderMgr(); save();
        const inf = skinInfo(S.skin);
        toast(c.name + ' · ' + inf.n, `${inf.d}　再点一下这个款式就换下一个样式（共 ${c.variants.length} 个）`);
    };
    window.gymSetSkin = function (k) { if (skinInfo(k).k === k) { S.skin = k; paint(); renderMgr(); save(); } };

    // ---------- 管理面板 ----------
    let mgrTab = 'play';
    window.gymTab = function (t) { mgrTab = t; editingId = null; renderMgr(); };

    function renderMgr() {
        const mgr = document.getElementById('gymMgr');
        if (!mgr || !mgr.classList.contains('on')) return;
        ['play', 'lib', 'skin', 'listen'].forEach(t => {
            const el = document.getElementById('gymTab-' + t);
            if (el) el.className = 'gym-tab' + (t === mgrTab ? ' on' : '');
        });
        const b = document.getElementById('gymMgrBody');
        if (!b) return;
        b.innerHTML = mgrTab === 'play' ? tabPlay()
            : mgrTab === 'lib' ? tabLib()
            : mgrTab === 'listen' ? tabListen()
            : tabSkin();
    }

    function tabPlay() {
        const L = curListObj();
        const tracks = curTracks();
        const rows = tracks.length ? tracks.map((t, i) => `
            <div class="gym-tr ${i === S.idx ? 'on' : ''}">
              <div class="gym-cover" style="${t.cover ? `background-image:url('${t.cover}')` : ''}"></div>
              <div class="gym-tr-m" onclick="gymPlayAt(${i})" title="点一下就放这首">
                <b>${esc(t.title || '未命名')}</b>
                <span>${esc(t.artist || '未知歌手')}${t.lrc ? ' · 有歌词' : ''}</span>
              </div>
              ${L.ids === null ? '' : `<button class="gym-mini-b" onclick="gymRemoveFromList('${t.id}')" title="只从这个歌单里拿掉，曲库里的歌还在">移出</button>`}
            </div>`).join('') : `<div class="gym-empty">这个歌单是空的。<br>去「曲库 / 添加」把歌加进来。</div>`;

        const pls = S.lists.map(l => `
            <div class="gym-pl ${l.id === S.curList ? 'on' : ''}">
              <b onclick="gymSwitchList('${l.id}')">${l.id === S.curList ? '▶ ' : ''}${esc(l.name)}</b>
              <span style="font-size:11px;color:#8b98a5;">${l.ids === null ? S.tracks.length : l.ids.length} 首</span>
              ${l.id === 'all' ? '' : `<button class="gym-mini-b" onclick="gymRenameList('${l.id}')">改名</button>
              <button class="gym-mini-b" onclick="gymDelList('${l.id}')">删歌单</button>`}
            </div>`).join('');

        return `
        <div class="gym-sec">
          <h4>📚 我的歌单</h4>
          <div class="gym-hint">歌单里存的是"引用"，所以同一首歌可以同时在好几个歌单里；从歌单移出不会删掉曲库里的歌和文件。</div>
          ${pls}
          <div style="margin-top:10px;">
            <input class="gym-in" id="gymNewList" placeholder="新歌单叫什么？比如「深夜」「写东西的时候」" style="margin-bottom:6px;">
            <button class="gym-btn ghost" onclick="gymNewList()">＋ 建一个歌单</button>
          </div>
        </div>
        <div class="gym-sec">
          <h4>🎼 正在放：${esc(L.name)}（${tracks.length} 首）</h4>
          <div style="font-size:12px;margin-bottom:8px;">
            循环：
            <button class="gym-mini-b ${S.loop === 'list' ? 'on' : ''}" onclick="gymSetLoop('list')">列表循环</button>
            <button class="gym-mini-b ${S.loop === 'one' ? 'on' : ''}" onclick="gymSetLoop('one')">单曲循环</button>
            <button class="gym-mini-b ${S.loop === 'shuffle' ? 'on' : ''}" onclick="gymSetLoop('shuffle')">随机</button>
          </div>
          ${rows}
        </div>`;
    }

    function tabLib() {
        const rows = S.tracks.length ? S.tracks.map(t => {
            if (editingId === t.id) return editForm(t);
            const inLists = S.lists.filter(l => l.ids && l.ids.includes(t.id)).map(l => l.name);
            return `
            <div class="gym-tr">
              <div class="gym-cover" style="${t.cover ? `background-image:url('${t.cover}')` : ''}"></div>
              <div class="gym-tr-m" onclick="gymEdit('${t.id}')" title="点开编辑">
                <b>${esc(t.title || '未命名')}</b>
                <span>${esc(t.artist || '未知歌手')} · ${t.kind === 'url' ? '直链' : '本地文件'}${t.lrc ? ' · 有歌词' : ''}${inLists.length ? ' · 在：' + esc(inLists.join('、')) : ''}</span>
              </div>
              <button class="gym-mini-b" onclick="gymEdit('${t.id}')">编辑</button>
              <button class="gym-mini-b" onclick="gymDelTrack('${t.id}')">删除</button>
            </div>`;
        }).join('') : '<div class="gym-empty">曲库是空的。<br>下面可以上传本地音频，或者粘贴一个 mp3 直链。</div>';

        return `
        <div class="gym-sec">
          <h4>➕ 添加音乐</h4>
          <div class="gym-hint">
            <b>本地文件</b>：存进浏览器自己的库里，下次打开还在（不进角色存档，不会把备份撑大）。<br>
            <b>直链</b>：以 .mp3/.m4a/.ogg/.wav 结尾的直接地址。<b>网易云、QQ音乐的分享链接放不了</b>——那是网页地址不是音频地址，而且有版权校验。
          </div>
          <button class="gym-btn" onclick="gymPickFiles()">📁 选择音频文件（可多选）</button>
          <div style="margin-top:10px;">
            <input class="gym-in" id="gymUrl" placeholder="音频直链 https://.../song.mp3">
            <input class="gym-in" id="gymUrlTitle" placeholder="歌名（选填，留空用链接文件名）">
            <input class="gym-in" id="gymUrlArtist" placeholder="歌手（选填）">
            <button class="gym-btn ghost" onclick="gymAddUrl()">加进曲库</button>
          </div>
          <button class="gym-btn ghost" style="margin-top:8px;" onclick="if(window.gyResOpen) gyResOpen('music')">🌐 在线找歌（不用自己上传）</button>
        </div>
        <div class="gym-sec">
          <h4>🗂️ 曲库（${S.tracks.length} 首）</h4>
          <div class="gym-hint">点任意一首打开编辑：改歌名、歌手、换封面、设歌词，以及勾选它属于哪几个歌单。</div>
          ${rows}
        </div>`;
    }

    // 用真表单代替 prompt()：打包成 APK 后 WebView 常常直接屏蔽 prompt/confirm，
    // 那正是"改不了歌名和封面"的原因。
    function editForm(t) {
        const chips = S.lists.filter(l => l.ids !== null).map(l => `
            <button class="gym-chip ${l.ids.includes(t.id) ? 'on' : ''}" onclick="gymToggleInList('${t.id}','${l.id}')">${l.ids.includes(t.id) ? '✓ ' : '＋ '}${esc(l.name)}</button>`).join('');
        return `
        <div class="gym-edit">
          <h5>✏️ 编辑「${esc(t.title || '未命名')}」</h5>
          <div class="gym-cov-row">
            <div class="gym-cover" id="gymEditCover" style="${t.cover ? `background-image:url('${t.cover}')` : ''}"></div>
            <div>
              <button class="gym-btn ghost" onclick="gymPickCover('${t.id}')">换封面</button>
              ${t.cover ? `<button class="gym-btn danger" onclick="gymClearCover('${t.id}')">去掉封面</button>` : ''}
              <div class="gym-hint" style="margin:4px 0 0;">选一张图片就行，会跟着这首歌一起存下来。</div>
            </div>
          </div>
          <label class="gym-lbl">歌名</label>
          <input class="gym-in" id="gymEditTitle" value="${esc(t.title || '')}" placeholder="歌名">
          <label class="gym-lbl">歌手</label>
          <input class="gym-in" id="gymEditArtist" value="${esc(t.artist || '')}" placeholder="歌手">
          ${t.kind === 'url' ? `<label class="gym-lbl">音频直链</label><input class="gym-in" id="gymEditSrc" value="${esc(t.src || '')}">` : ''}
          <label class="gym-lbl">歌词（带 [00:12.34] 时间戳就能逐行滚动，纯文字也行）</label>
          <textarea class="gym-in" id="gymEditLrc" placeholder="[00:00.00]第一句&#10;[00:05.20]第二句">${esc(t.lrc || '')}</textarea>
          <button class="gym-btn ghost" onclick="gymPickLrcFile('${t.id}')">📄 从 .lrc 文件导入</button>
          <div style="margin-top:8px;">
            <label class="gym-lbl">属于哪些歌单（可多选，一首歌能同时在好几个歌单里）</label>
            <div class="gym-chips">${chips || '<span style="font-size:11.5px;color:#8b98a5;">还没有自建歌单，去「播放列表」那一页建一个。</span>'}</div>
          </div>
          <div style="margin-top:12px;">
            <button class="gym-btn" onclick="gymSaveEdit('${t.id}')">保存</button>
            <button class="gym-btn ghost" onclick="gymCancelEdit()">取消</button>
          </div>
        </div>`;
    }

    function tabSkin() {
        const curCat = catOf(S.skin), curInf = skinInfo(S.skin);
        const cats = SKIN_CATS.map(c => {
            const on = c.cat === curCat;
            const i = c.variants.findIndex(v => v.k === S.skin);
            const showing = on ? c.variants[i] : c.variants[0];
            return `<button class="gym-cat ${on ? 'on' : ''}" onclick="gymPickCat('${c.cat}')">
                <b>${c.icon} ${c.name}</b>
                <span>${showing.n}　${showing.d}</span>
                <em>${on ? `第 ${i + 1}/${c.variants.length} 个 · 再点换下一个` : `${c.variants.length} 个样式`}</em>
              </button>`;
        }).join('');
        const all = SKIN_CATS.map(c => `<div style="margin-top:8px;"><b style="font-size:12px;color:#8b98a5;">${c.name}</b><div class="gym-chips">${
            c.variants.map(v => `<button class="gym-chip ${v.k === S.skin ? 'on' : ''}" onclick="gymSetSkin('${v.k}')">${v.n} ${v.d}</button>`).join('')
        }</div></div>`).join('');

        return `
        <div class="gym-sec">
          <h4>🎨 款式（点一个款式就在它的样式之间轮换）</h4>
          <div class="gym-cats">${cats}</div>
          <div class="gym-hint" style="margin-top:10px;">现在用的是 <b>${curInf.n}　${curInf.d}</b>。播放器可以直接拖到任何位置，位置会记住；胶囊款双击打开这个面板。</div>
        </div>
        <div class="gym-sec">
          <h4>🔎 直接挑一个样式</h4>
          ${all}
        </div>
        <div class="gym-sec">
          <h4>📃 歌词</h4>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" ${S.showLyrics ? 'checked' : ''} onchange="gymToggleLyr()" style="width:16px;height:16px;cursor:pointer;">
            <span>播放时在播放器下面显示歌词（胶囊款太小，不显示）</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-top:8px;">
            <input type="checkbox" ${S.lyrCollapsed ? 'checked' : ''} onchange="gymLyrToggleSize()" style="width:16px;height:16px;cursor:pointer;">
            <span>只显示当前这一行（<b>单击歌词条本身也能收起/展开</b>）</span>
          </label>
          <div class="gym-hint" style="margin-top:6px;">每首歌的歌词在「曲库 / 添加」里点开那首歌单独设置。</div>
        </div>`;
    }

    function tabListen() {
        const chars = (typeof myCharacters !== 'undefined' ? myCharacters : []);
        if (!chars.length) return '<div class="gym-empty">还没有角色。<br>先去角色中心建一个，再回来邀请 TA 一起听。</div>';
        const L = LS();
        const inList = charsIn();
        const st = S.stats || (S.stats = { total: { ms: 0, songs: 0 }, byChar: {} });
        const rows = chars.map(c => {
            const on = L.chars.includes(String(c.id));
            const taste = (S.taste || {})[String(c.id)] || '';
            return `<div class="gym-tr ${on ? 'on' : ''}">
              ${avHtml(c)}
              <div class="gym-tr-m" onclick="gymToggleListener('${c.id}')">
                <b>${on ? '🎧 ' : ''}${esc(c.name)}</b>
                <span>${taste ? esc(taste.slice(0, 30)) : '还没写音乐口味'}</span>
              </div>
              <button class="gym-mini-b ${on ? 'on' : ''}" onclick="gymToggleListener('${c.id}')">${on ? '在听' : '邀请'}</button>
            </div>
            <div style="padding:0 0 10px 30px;">
              <input class="gym-in" id="gymTaste_${c.id}" value="${esc(taste)}" placeholder="TA 的音乐口味（一句话，会影响 TA 怎么评价每首歌）" style="margin-bottom:5px;">
              <button class="gym-mini-b" onclick="gymSaveTaste('${c.id}')">保存口味</button>
              <button class="gym-mini-b" onclick="gymGenTaste('${c.id}')">✨ 按人设自动写一句</button>
            </div>`;
        }).join('');

        return `
        <div class="gym-sec">
          <h4>🎧 谁在跟你一起听</h4>
          <div class="gym-hint">
            拉进来的角色会"听见"你在放什么——歌名、歌手、听到第几秒、刚唱到哪一句、这首的整段歌词，都会告诉 TA。
            ${inList.length ? `现在是：<b>${esc(inList.map(c => c.name).join('、')) }</b>。` : '现在没人在听。'}
            ${inList.length ? '<br><button class="gym-btn danger" style="margin-top:8px;" onclick="gymLeaveListen()">结束这次一起听（会先存进记忆）</button>' : ''}
          </div>
          ${rows}
        </div>

        <div class="gym-sec">
          <h4>🗣️ 什么时候开口（每开口一次 = 一次 API 调用）</h4>
          <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;margin-bottom:9px;">
            <input type="checkbox" ${L.sayOnSwitch ? 'checked' : ''} onchange="gymSetSay('sayOnSwitch', this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;">
            <span><b>换歌时说一句</b><br><span style="font-size:11.5px;color:#8b98a5;">每切到一首新的，TA 对这首说点什么。一首歌一次，频率最可控。</span></span>
          </label>
          <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;margin-bottom:9px;">
            <input type="checkbox" ${L.sayOnLyric ? 'checked' : ''} onchange="gymSetSay('sayOnLyric', this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;">
            <span><b>唱到某句歌词时接一句</b><br><span style="font-size:11.5px;color:#8b98a5;">最有"真在听"的感觉，但一首歌可能说好几次，<b>也最贵</b>。需要这首歌有带时间轴的歌词。一首最多接 ${L.lyricMax || 2} 次，而且会隔开几句。</span></span>
          </label>
          <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" ${L.sayOnEnd ? 'checked' : ''} onchange="gymSetSay('sayOnEnd', this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;">
            <span><b>一首听完给个感想</b><br><span style="font-size:11.5px;color:#8b98a5;">整首放完才说一句，像听完之后的那句"……这首不错"。</span></span>
          </label>
          <div class="gym-hint" style="margin-top:10px;">
            三个全关也能用：播放器下面那条聊天缝里点「让 TA 说说这首」「让 TA 点一首」，就只在你点的时候花钱。
          </div>
        </div>

        <div class="gym-sec">
          <h4>🕒 一起听了多久</h4>
          <div class="gym-hint">只统计"有人在一起听 + 正在播放"的那段时间；暂停、拖进度、切后台都不算。</div>
          <div style="font-size:12.5px;line-height:1.9;">
            <b style="color:#1d9bf0;">总共</b>：${fmtDur(st.total.ms)}　·　${st.total.songs} 首
            ${chars.filter(c => st.byChar[String(c.id)]).map(c => {
                const d = st.byChar[String(c.id)];
                return `<br><b>${esc(c.name)}</b>：${fmtDur(d.ms)}　·　${d.songs} 首${d.first ? `　·　从 ${new Date(d.first).toLocaleDateString('zh-CN')} 开始` : ''}`;
            }).join('')}
          </div>
          ${st.total.ms || st.total.songs ? '<button class="gym-mini-b" style="margin-top:8px;" onclick="gymResetStats()">清零重新算</button>' : '<div style="font-size:12px;color:#8b98a5;margin-top:6px;">还没一起听过。拉个人进来放首歌就开始记了。</div>'}
        </div>

        <div class="gym-sec">
          <h4>🧠 一起听的记忆</h4>
          <div class="gym-hint">聊到一定程度点「存进记忆」（或者点上面的「结束这次一起听」），这段会总结成一句话跟着角色走——以后聊天、发推、写日记都可能提起"我们那天听的那首"。</div>
          ${chars.filter(c => (S.memory || {})[String(c.id)]).map(c => `
            <div style="font-size:12px;line-height:1.7;margin-bottom:8px;padding:8px 10px;background:rgba(29,155,240,.06);border-radius:8px;">
              <b style="color:#1d9bf0;">${esc(c.name)}</b>：${esc(S.memory[String(c.id)])}
              <button class="gym-mini-b" style="margin-left:6px;" onclick="gymClearMemory('${c.id}')">清掉</button>
            </div>`).join('') || '<div style="font-size:12px;color:#8b98a5;">还没有记忆。</div>'}
        </div>`;
    }
    window.gymResetStats = function () {
        S.stats = { total: { ms: 0, songs: 0 }, byChar: {} };
        save(); renderMgr();
    };
    // 记忆总览（js/65）用：读 / 改 / 删「一起听的记忆」
    window.gymMemGet = id => ((S.memory || {})[String(id)] || '');
    window.gymMemSet = function (id, v) { S.memory = S.memory || {}; v = String(v || '').trim(); if (v) S.memory[String(id)] = v; else delete S.memory[String(id)]; save(); };
    window.gymClearMemory = function (id) {
        if (S.memory) delete S.memory[String(id)];
        save(); renderMgr();
    };

    // ---------- 歌单操作 ----------
    window.gymSwitchList = function (id) {
        S.curList = id; S.idx = 0;
        paint(); renderMgr(); save();
    };
    window.gymNewList = function () {
        const el = document.getElementById('gymNewList');
        const name = (el && el.value || '').trim();
        if (!name) return toast('先起个名字', '给这个歌单取个名，比如「深夜」。');
        S.lists.push({ id: 'pl' + Date.now() + Math.random().toString(36).slice(2, 5), name, ids: [] });
        if (el) el.value = '';
        save(); renderMgr();
    };
    window.gymRenameList = function (id) {
        const l = S.lists.find(x => x.id === id); if (!l) return;
        const el = document.getElementById('gymNewList');
        const name = (el && el.value || '').trim();
        if (!name) return toast('改成什么名字？', '把新名字填在下面那个输入框里，再点这个「改名」。');
        l.name = name; if (el) el.value = '';
        save(); renderMgr(); paint();
    };
    window.gymDelList = function (id) {
        const i = S.lists.findIndex(x => x.id === id); if (i < 0 || id === 'all') return;
        const name = S.lists[i].name;
        S.lists.splice(i, 1);
        if (S.curList === id) { S.curList = 'all'; S.idx = 0; }
        save(); renderMgr(); paint();
        toast('歌单删了', `「${name}」没了，但里面的歌都还在曲库里。`);
    };
    window.gymRemoveFromList = function (tid) {
        const L = curListObj();
        if (!L || L.ids === null) return;
        L.ids = L.ids.filter(x => x !== tid);
        if (S.idx >= curTracks().length) S.idx = Math.max(0, curTracks().length - 1);
        save(); renderMgr(); paint();
    };
    window.gymToggleInList = function (tid, lid) {
        const l = S.lists.find(x => x.id === lid); if (!l || l.ids === null) return;
        if (l.ids.includes(tid)) l.ids = l.ids.filter(x => x !== tid);
        else l.ids.push(tid);
        save(); renderMgr();
    };

    // ---------- 曲库操作 ----------
    window.gymEdit = function (id) { editingId = id; mgrTab = 'lib'; renderMgr(); };
    window.gymCancelEdit = function () { editingId = null; renderMgr(); };
    window.gymSaveEdit = function (id) {
        const t = S.tracks.find(x => x.id === id); if (!t) return;
        const g = i => { const el = document.getElementById(i); return el ? el.value : null; };
        const nt = g('gymEditTitle'); if (nt !== null) t.title = nt.trim() || t.title;
        const na = g('gymEditArtist'); if (na !== null) t.artist = na.trim();
        const ns = g('gymEditSrc'); if (ns !== null && ns.trim()) t.src = ns.trim();
        const nl = g('gymEditLrc'); if (nl !== null) t.lrc = nl;
        if (cur() && cur().id === id) { lrcLines = parseLrc(t.lrc); lrcIdx = -1; }
        editingId = null;
        save(); renderMgr(); paint();
        toast('改好了', `「${t.title}」已经更新。`);
    };
    window.gymPickCover = function (id) {
        const t = S.tracks.find(x => x.id === id); if (!t) return;
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = () => {
            const f = inp.files && inp.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = () => {
                t.cover = r.result;
                // 编辑框里立刻看到，不用等保存
                const pv = document.getElementById('gymEditCover');
                if (pv) pv.style.backgroundImage = `url('${t.cover}')`;
                save(); paint();
            };
            r.readAsDataURL(f);
        };
        inp.click();
    };
    window.gymClearCover = function (id) {
        const t = S.tracks.find(x => x.id === id); if (!t) return;
        t.cover = ''; save(); renderMgr(); paint();
    };
    window.gymPickLrcFile = function (id) {
        const t = S.tracks.find(x => x.id === id); if (!t) return;
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.lrc,.txt,text/plain';
        inp.onchange = () => {
            const f = inp.files && inp.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = () => {
                const box = document.getElementById('gymEditLrc');
                const txt = String(r.result || '');
                if (box) box.value = txt;           // 填进文本框，用户还能改，点保存才生效
                else { t.lrc = txt; save(); paint(); }
                toast('歌词读进来了', parseLrc(txt).length ? '识别到时间轴，保存后播放会逐行滚动。' : '没识别到时间轴，会当成静态歌词整段显示。');
            };
            r.readAsText(f, 'utf-8');
        };
        inp.click();
    };
    window.gymPickFiles = function () {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'audio/*'; inp.multiple = true;
        inp.onchange = async () => {
            const files = [...(inp.files || [])];
            if (!files.length) return;
            const addTo = curListObj();
            for (const f of files) {
                const id = 'm' + Date.now() + Math.random().toString(36).slice(2, 7);
                try { if (LF) await LF.setItem('file_' + id, f); } catch (e) { toast('存不下', f.name + '：' + (e.message || e)); continue; }
                S.tracks.push({ id, title: f.name.replace(/\.[^.]+$/, ''), artist: '', cover: '', src: '', kind: 'file', lrc: '' });
                if (addTo && addTo.ids !== null) addTo.ids.push(id);   // 正在看某个歌单就顺手加进去
            }
            await save(); renderMgr(); paint();
            toast('加好了', `${files.length} 首进了曲库${addTo && addTo.ids !== null ? '，并加进了「' + addTo.name + '」' : ''}。`);
        };
        inp.click();
    };
    window.gymAddUrl = function () {
        const el = document.getElementById('gymUrl');
        const u = (el && el.value || '').trim();
        if (!u) return toast('先填链接', '把音频的直接地址贴进来。');
        if (/music\.163\.com|y\.qq\.com|kugou|kuwo|bilibili|youtube|spotify/i.test(u)) {
            toast('这个链接放不了', '网易云/QQ音乐这类是网页地址，不是音频文件地址，而且有版权校验，网页里拿不到音频。请用音频直链，或者把文件下载下来用「选择音频文件」。');
            return;
        }
        const id = 'm' + Date.now() + Math.random().toString(36).slice(2, 7);
        const tEl = document.getElementById('gymUrlTitle'), aEl = document.getElementById('gymUrlArtist');
        let name = (tEl && tEl.value || '').trim();
        if (!name) { try { name = decodeURIComponent(u.split('?')[0].split('/').pop() || '').replace(/\.[^.]+$/, ''); } catch (e) { name = '未命名'; } }
        S.tracks.push({ id, title: name || '未命名', artist: (aEl && aEl.value || '').trim(), cover: '', src: u, kind: 'url', lrc: '' });
        const addTo = curListObj();
        if (addTo && addTo.ids !== null) addTo.ids.push(id);
        if (el) el.value = ''; if (tEl) tEl.value = ''; if (aEl) aEl.value = '';
        save(); renderMgr(); paint();
    };
    // 给别的模块用：直接往曲库里加一首（在线找到的歌、TA 分享给你的歌）。listName 给了就顺便放进那个歌单（没有就新建）
    window.gymAddTrack = function (t, listName) {
        if (!t || !t.src) return null;
        const dup = S.tracks.find(x => x.src === t.src);
        const id = dup ? dup.id : ('m' + Date.now() + Math.random().toString(36).slice(2, 7));
        if (!dup) S.tracks.push({ id, title: String(t.title || '未命名'), artist: String(t.artist || ''), cover: t.cover || '', src: t.src, kind: 'url', lrc: '', note: t.note || '' });
        if (listName) {
            let l = S.lists.find(x => x.name === listName && x.ids);
            if (!l) { l = { id: 'pl' + Date.now() + Math.random().toString(36).slice(2, 5), name: listName, ids: [] }; S.lists.push(l); }
            if (l.ids.indexOf(id) === -1) l.ids.push(id);
        }
        save(); try { renderMgr(); paint(); } catch (e) {}
        return id;
    };
    window.gymHasTrack = src => S.tracks.some(x => x.src === src);
    window.gymDelTrack = async function (id) {
        const i = S.tracks.findIndex(x => x.id === id); if (i < 0) return;
        const t = S.tracks[i];
        if (t.kind === 'file' && LF) { try { await LF.removeItem('file_' + id); } catch (e) {} }
        if (blobUrls[id]) { URL.revokeObjectURL(blobUrls[id]); delete blobUrls[id]; }
        S.tracks.splice(i, 1);
        S.lists.forEach(l => { if (l.ids) l.ids = l.ids.filter(x => x !== id); });
        if (S.idx >= curTracks().length) S.idx = Math.max(0, curTracks().length - 1);
        if (editingId === id) editingId = null;
        await save(); renderMgr(); paint();
        toast('删掉了', `「${t.title || '这首'}」已经从曲库和所有歌单里移除。`);
    };

    /* =======================================================================
       🎧 一起听
       -----------------------------------------------------------------------
       跟网易云那个"一起听"最大的不同：对面是 AI，不需要同步两台设备的进度。
       只要把"现在放的是哪首、唱到哪一句、听了多久、刚才你们说了什么"喂给角色，
       TA 就能像真在旁边听一样接话。
       三种开口时机各自独立开关（每次开口 = 一次 API 调用）：
         · 换歌时说一句        sayOnSwitch  默认开
         · 唱到某句歌词接一句  sayOnLyric   默认关（一首歌可能说好几次，最贵）
         · 一首听完给个感想    sayOnEnd     默认开
       ======================================================================= */
    const LS = () => S.listen || (S.listen = { chars: [], sayOnSwitch: true, sayOnLyric: false, sayOnEnd: true, lyricMax: 2, chatOpen: false });
    const charsIn = () => (typeof myCharacters !== 'undefined' ? myCharacters : []).filter(c => LS().chars.includes(String(c.id)));
    let lyricSaidThisSong = 0, lastSaidLyricIdx = -1, asking = false;

    function avHtml(c) {
        if (c && c.avatarImg) return `<div class="gym-with-av" style="background-image:url('${c.avatarImg}')"></div>`;
        return `<div class="gym-with-av">${esc((c && (c.avatarEmoji || (c.name || '?')[0])) || '?')}</div>`;
    }

    // 参与者小条（挂在播放器上方，所以 11 个皮肤都不用改结构）
    function paintWith() {
        const el = document.getElementById('gymWith');
        if (!el) return;
        const cs = charsIn();
        const hasChars = (typeof myCharacters !== 'undefined' && myCharacters.length > 0);
        if (!hasChars) { el.style.display = 'none'; return; }
        el.style.display = 'flex';
        el.className = 'gym-with' + (cs.length ? ' on' : '');
        el.onclick = () => { gymOpenMgr(); gymTab('listen'); };
        el.innerHTML = cs.length
            ? cs.map(avHtml).join('') + `<span class="gym-with-txt">和 ${esc(cs.map(c => c.name).join('、'))} 一起听</span>`
            : `<button class="gym-with-add" title="邀请角色一起听">＋</button><span class="gym-with-txt">邀请谁一起听</span>`;
    }

    // 聊天区：收起来只是一条细缝，点开才展开
    function paintChat() {
        const el = document.getElementById('gymChat');
        if (!el) return;
        const cs = charsIn();
        if (!cs.length || catOf(S.skin) === 'capsule') { el.style.display = 'none'; return; }
        el.style.display = 'block';
        el.style.width = (document.getElementById('gymBox').offsetWidth || 320) + 'px';
        const n = (S.chat || []).length;
        if (!LS().chatOpen) {
            el.innerHTML = `<div class="gym-chat-hd" onclick="gymChatToggle()">💬 <span>跟 ${esc(cs[0].name)}${cs.length > 1 ? ' 等 ' + cs.length + ' 人' : ''}聊这首歌${n ? '（' + n + ' 条）' : ''}</span><span style="margin-left:auto">▸</span></div>`;
            return;
        }
        const msgs = (S.chat || []).slice(-20).map(m => `<div class="gym-msg ${m.who === 'me' ? 'me' : ''}"><b>${esc(m.name)}</b><span>${esc(m.text)}</span></div>`).join('')
            || '<div style="font-size:11.5px;color:#8b98a5;padding:4px 0;">还没说什么。说点什么，或者让 TA 点一首。</div>';
        el.innerHTML = `<div class="gym-chat-hd" onclick="gymChatToggle()">💬 <span>跟 ${esc(cs.map(c => c.name).join('、'))} 一起听</span><span style="margin-left:auto">▾</span></div>
            <div class="gym-chat-bd" id="gymChatBd">${msgs}</div>
            <div class="gym-chat-tools">
              <button class="gym-mini-b" onclick="gymAskPick()">🎧 让 TA 点一首</button>
              <button class="gym-mini-b" onclick="gymAskNow()">💬 让 TA 说说这首</button>
              <button class="gym-mini-b" onclick="gymSaveListenMemory()">🧠 存进记忆</button>
            </div>
            <div class="gym-chat-in">
              <input id="gymChatIn" placeholder="说点什么…" onkeydown="if(event.key==='Enter')gymSendChat()">
              <button onclick="gymSendChat()">发送</button>
            </div>`;
        const bd = document.getElementById('gymChatBd');
        if (bd) bd.scrollTop = bd.scrollHeight;
    }
    window.gymChatToggle = function () { LS().chatOpen = !LS().chatOpen; paintChat(); save(); };

    // 气泡：几秒后自己淡出，不占地方
    let bubbleTimer = null;
    function bubble(c, text) {
        const root = document.getElementById('gymRoot');
        if (!root) return;
        const old = document.getElementById('gymBubble');
        if (old) old.remove();
        if (bubbleTimer) clearTimeout(bubbleTimer);
        const d = document.createElement('div');
        d.className = 'gym-bubble'; d.id = 'gymBubble';
        d.innerHTML = `${avHtml(c)}<div class="gym-bubble-b"><div class="gym-bubble-n">${esc(c.name)}</div><div class="gym-bubble-t">${esc(text)}</div></div>`;
        d.onclick = () => { LS().chatOpen = true; paintChat(); d.remove(); };
        root.appendChild(d);
        bubbleTimer = setTimeout(() => {
            d.classList.add('out');
            setTimeout(() => { try { d.remove(); } catch (e) {} }, 500);
        }, 6500);
    }

    function pushChat(who, name, text) {
        if (!Array.isArray(S.chat)) S.chat = [];
        S.chat.push({ who, name, text, at: Date.now() });
        paintChat(); save();
    }

    // 拼给角色的"现在正在听什么"
    function nowPlayingPrompt() {
        const t = cur();
        if (!t) return '（现在没有在放歌）';
        const pos = audio ? fmt(audio.currentTime) : '0:00';
        const dur = (audio && audio.duration) ? fmt(audio.duration) : '未知';
        let line = '';
        if (lrcLines.length && lrcIdx >= 0) line = lrcLines[lrcIdx].text || '';
        let lrcAll = '';
        if (t.lrc) lrcAll = String(t.lrc).replace(/\[[^\]]*\]/g, '').split('\n').filter(x => x.trim()).slice(0, 40).join('\n');
        return `【正在放】${t.title || '未命名'}${t.artist ? ' —— ' + t.artist : ''}\n【听到】${pos} / ${dur}`
            + (line ? `\n【刚唱到这句】${line}` : '')
            + (lrcAll ? `\n【这首歌的词】\n${lrcAll}` : '（这首没有歌词）');
    }
    function chatSoFar() {
        const l = (S.chat || []).slice(-8);
        if (!l.length) return '（还没说什么）';
        return l.map(m => `${m.name}：${m.text}`).join('\n');
    }
    function otherNames(me) {
        const o = charsIn().filter(c => String(c.id) !== String(me.id)).map(c => c.name);
        return o.length ? `\n【还有谁在一起听】${o.join('、')}——你们能互相听见，可以接对方的话。` : '';
    }
    function tasteOf(c) {
        const t = (S.taste || {})[String(c.id)];
        return t ? `\n【你的音乐口味】${t}` : '';
    }

    // 核心：问某个角色说一句
    // reason: 'switch' 换歌 | 'lyric' 唱到某句 | 'end' 听完 | 'ask' 用户主动问 | 'reply' 回用户的话
        // 报一下场景：这段生成属于「music」那一场，好让「注入内容管理」能单独设它读什么（soft＝外层已经有场景就不抢）
    async function askChar() {
        const a = arguments;
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('music', () => askCharInner.apply(null, a));
        return askCharInner.apply(null, a);
    }
    async function askCharInner(c, reason, extra) {
        if (!c || asking) return null;
        if (typeof getApiConfig !== 'function' || typeof callChatCompletionAPI !== 'function') return null;
        const api = getApiConfig(true);
        if (!api || !api.key) return null;
        asking = true;
        try {
            const why = {
                switch: '这首刚开始放。说一句你对这首歌的第一反应——听过没、喜不喜欢、想起什么。',
                lyric: '刚唱到的那一句正好戳到你了，接一句。就说这一句给你的感觉，别复述歌词。',
                end: '这首刚放完。给一句听完的感想。',
                ask: '对方问你这首歌怎么样，说说你的看法。',
                reply: '接着对方刚说的话往下聊。'
            }[reason] || '说一句。';
            const un = (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
            const byTxt = (LS().by || {})[String(c.id)] === 'char'
                ? `（这次一起听是你发起的：是你约${un}来听的）` : `（这次一起听是${un}发起的：是${un}约你来听的）`;
            const ask = `你正在和${un}一起听歌。${byTxt}

${nowPlayingPrompt()}${otherNames(c)}${tasteOf(c)}

【你们刚才聊的】
${chatSoFar()}${extra ? '\n\n' + extra : ''}

${why}

要求：
1. 就一句话，20~45 个字，像随口说的，不是写乐评。
2. 按你自己的性格和音乐口味来说——不合胃口就直说不喜欢，别每首都夸。
3. 不要复述歌名歌手，对方看得见；也不要说"这首歌让我想起"这种套话开头。
4. 只输出这句话本身，不要引号、不要旁白、不要动作描写。
5. 如果按你的性格，这会儿你根本不会开口（这句没戳到你、你正忙、或者你就是话少），
   那就只输出两个字母 NO，别硬凑。说不说由你自己定。`;
            const messages = buildStructuredMessages(buildBasePrompt(c, false, chatSoFar()), [], ask);
            const data = await callChatCompletionAPI(api, messages);
            if (data && data.error) return null;
            let txt = (data.choices?.[0]?.message?.content || '').trim();
            if (typeof applyRegexScripts === 'function') { try { txt = applyRegexScripts(txt, 'ai_output', c.id); } catch (e) {} }
            txt = txt.replace(/^["'“”「」]+|["'“”「」]+$/g, '').trim();
            // TA 自己决定这会儿不想说话
            if (!txt || /^NO[.。!！]?$/i.test(txt)) return null;
            pushChat(String(c.id), c.name, txt);
            bubble(c, txt);
            return txt;
        } catch (e) {
            console.warn('[音乐盒·一起听] 出错：', e);
            return null;
        } finally { asking = false; }
    }

    // 多人时挑一个说话。一次事件只让一个人开口（省钱），偶尔让第二个人接一句。
    async function someoneSay(reason, extra) {
        const cs = charsIn();
        if (!cs.length) return;
        const c = cs[Math.floor(Math.random() * cs.length)];
        const said = await askChar(c, reason, extra);
        // 第二个人接不接话，也交给 TA 自己按人设决定（不想搭腔就返回 NO），不掷骰子。
        if (said && cs.length > 1) {
            const others = cs.filter(x => String(x.id) !== String(c.id));
            const c2 = others[Math.floor(Math.random() * others.length)];
            await askChar(c2, 'reply', `${c.name}刚说：「${said}」`);
        }
    }

    // ---- 用户能点的几个动作 ----
    window.gymSendChat = async function () {
        const inp = document.getElementById('gymChatIn');
        const v = (inp && inp.value || '').trim();
        if (!v) return;
        if (inp) inp.value = '';
        pushChat('me', (typeof userDisplayName === 'function') ? userDisplayName(charsIn()[0]) : '我', v);
        await someoneSay('reply', `对方刚说：「${v}」`);
    };
    window.gymAskNow = function () { someoneSay('ask'); };
    window.gymSaveListenMemory = async function () { await summarizeListen(true); };

    // 让角色从曲库里点一首
    window.gymAskPick = async function () {
        const cs = charsIn();
        if (!cs.length) return toast('还没人在一起听', '先在「一起听」里邀请一个角色。');
        if (S.tracks.length < 2) return toast('曲库里歌太少', '至少有两首才好意思让 TA 点。');
        const c = cs[Math.floor(Math.random() * cs.length)];
        const api = getApiConfig(true);
        if (!api || !api.key) return toast('还没配 API', '去设置里填一个。');
        const menu = S.tracks.map((t, i) => `${i + 1}. ${t.title || '未命名'}${t.artist ? ' —— ' + t.artist : ''}`).join('\n');
        const ask = `你正在和对方一起听歌。现在轮到你点一首。

【能点的歌】
${menu}
${tasteOf(c)}

【你们刚才聊的】
${chatSoFar()}

从上面挑一首你现在想听的，并说一句为什么想听（20~40字，口语，像随口说的）。
严格只返回 JSON，不要用 \`\`\` 包裹：{"n": 序号数字, "why": "为什么想听这首"}`;
        try {
            const messages = buildStructuredMessages(buildBasePrompt(c, false, chatSoFar()), [], ask);
            const data = await callChatCompletionAPI(api, messages);
            const r = (typeof parseModelJson === 'function') ? parseModelJson(data.choices?.[0]?.message?.content || '') : null;
            const n = r && parseInt(r.n);
            if (!n || n < 1 || n > S.tracks.length) return toast('TA 没挑出来', '模型没给出能用的序号，再点一次试试。');
            const pick = S.tracks[n - 1];
            const why = String((r && r.why) || '').trim();
            if (why) { pushChat(String(c.id), c.name, why); bubble(c, why); }
            // 切到这首：不在当前歌单里就临时切回"全部歌曲"
            let i = curTracks().findIndex(t => t.id === pick.id);
            if (i < 0) { S.curList = 'all'; i = S.tracks.findIndex(t => t.id === pick.id); }
            lyricSaidThisSong = 0; lastSaidLyricIdx = -1;
            await gymPlayAt(i);
        } catch (e) { toast('点歌失败', String(e.message || e)); }
    };

    // 邀请 / 退出
    window.gymToggleListener = async function (id) {
        const L = LS();
        id = String(id);
        if (L.chars.includes(id)) {                       // 已经在听了 → 请 TA 走，不用问
            L.chars = L.chars.filter(x => x !== id);
            if (L.by) delete L.by[id];
            save(); renderMgr(); paint();
            return;
        }
        // 📨 邀请发成私聊里的一张卡（js/28）：以前点一下人就直接进来了，
        //    TA 没有拒绝的余地，聊天记录里也看不出"你叫过 TA 一起听歌"。
        const c = (typeof myCharacters !== 'undefined' ? myCharacters : []).find(x => String(x.id) === id);
        if (c && typeof window.gyInviteSend === 'function') {
            const song = cur();
            await window.gyInviteSend({
                char: c, kind: 'music',
                title: song ? (song.title || '一首歌') : '',
                sub: song && song.artist ? song.artist : '',
                trackId: song ? song.id : '',
                onYes: () => { window.gymJoinListener(id, 'me'); },
                onNo: () => { renderMgr(); }
            });
            return;
        }
        window.gymJoinListener(id, 'me');
    };
    // 给邀请卡片的「去听 ›」用：直接把人加进来（这时候已经答应过了，不用再问一遍）
    // by：'me'＝你约的 TA（默认），'char'＝TA 约的你
    window.gymJoinListener = function (id, by) {
        const L = LS(); id = String(id);
        if (!L.by) L.by = {};
        if (!L.chars.length) L.t0 = Date.now();
        if (!L.chars.includes(id) || by) L.by[id] = by === 'char' ? 'char' : 'me';
        if (!L.chars.includes(id)) L.chars.push(id);
        save(); renderMgr(); paint();
    };

    // 💬 散场之后，TA 像真人一样在私聊里再说两句（js/28 gyAfterActivity）
    function afterListen() {
        try {
            const cs = charsIn();
            if (!cs.length || typeof window.gyAfterActivity !== 'function') return;
            const L = LS();
            const mins = L.t0 ? (Date.now() - L.t0) / 60000 : 0;
            if (!(S.chat || []).length && mins < 3) return;
            const t = cur();
            const talk = (S.chat || []).slice(-16).map(m => `${m.name}：${m.text}`).join('\n');
            const summary = `一起听歌${t ? '，最后放的是《' + (t.title || '未命名') + '》' + (t.artist ? '（' + t.artist + '）' : '') : ''}。`
                + (talk ? `\n听的时候聊过的：\n${talk}` : '');
            cs.forEach(c => window.gyAfterActivity(c.id, '一起听歌', summary, { by: (L.by || {})[String(c.id)] === 'char' ? 'char' : 'me', mins }));
        } catch (e) { console.warn('[音乐盒] 事后消息没发出去：', e); }
    }

    window.gymLeaveListen = async function () {
        afterListen();
        if (charsIn().length && (S.chat || []).length >= 4) await summarizeListen(false);
        LS().chars = []; S.chat = []; LS().by = {}; LS().t0 = 0;
        save(); renderMgr(); paint();
        toast('结束了这次一起听', '刚才聊的已经总结进 TA 的记忆里了。');
    };

    // 把这次一起听总结成一段记忆，通过插件的 code 钩子喂回各功能
    // 报场景：这段生成属于「music」那一场（soft＝外层已有场景就不抢）
    async function summarizeListen() {
        const a = arguments;
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('music', () => summarizeListenInner.apply(null, a));
        return summarizeListenInner.apply(null, a);
    }
    async function summarizeListenInner(manual) {
        const cs = charsIn();
        if (!cs.length || !(S.chat || []).length) { if (manual) toast('还没什么可记的', '先聊几句再存。'); return; }
        const api = getApiConfig(true);
        if (!api || !api.key) return;
        const log = (S.chat || []).map(m => `${m.name}：${m.text}`).join('\n');
        for (const c of cs) {
            try {
                const prev = (S.memory || {})[String(c.id)] || '';
                const ask = `下面是你和对方一起听歌时的对话。请用第二人称（"你……"）把它概括成一段简短记忆：你们一起听了什么、你当时说了什么、心情如何。100字以内，只输出这段话。
${prev ? `\n【你之前记住的】\n${prev}\n（把新的这次并进去，太旧的可以省略）\n` : ''}
【这次的对话】
${log}`;
                const messages = buildStructuredMessages(buildBasePrompt(c, false, log), [], ask);
                const data = await callChatCompletionAPI(api, messages);
                let txt = (data.choices?.[0]?.message?.content || '').trim();
                if (txt) { if (!S.memory) S.memory = {}; S.memory[String(c.id)] = txt.slice(0, 400); }
            } catch (e) { console.warn('[音乐盒] 记忆总结失败', e); }
        }
        await save();
        if (manual) toast('记住了', `${cs.map(c => c.name).join('、')}会记得你们一起听过这些。`);
    }

    // 让角色按人设自己写一句音乐口味
    window.gymGenTaste = async function (id) {
        const c = (typeof myCharacters !== 'undefined' ? myCharacters : []).find(x => String(x.id) === String(id));
        if (!c) return;
        const api = getApiConfig(true);
        if (!api || !api.key) return toast('还没配 API', '去设置里填一个。');
        try {
            const ask = `按你的人设，用一句话说清楚你的音乐口味：平时听什么、受不了什么、什么场合听歌。40字以内，第二人称（"你……"），只输出这一句。`;
            const messages = buildStructuredMessages(buildBasePrompt(c, true, ''), [], ask);
            const data = await callChatCompletionAPI(api, messages);
            const txt = (data.choices?.[0]?.message?.content || '').trim();
            if (txt) { if (!S.taste) S.taste = {}; S.taste[String(c.id)] = txt.slice(0, 120); save(); renderMgr(); }
        } catch (e) { toast('生成失败', String(e.message || e)); }
    };
    window.gymSaveTaste = function (id) {
        const el = document.getElementById('gymTaste_' + id);
        if (!el) return;
        if (!S.taste) S.taste = {};
        S.taste[String(id)] = el.value.trim();
        save(); renderMgr();
    };
    window.gymSetSay = function (k, v) { LS()[k] = !!v; save(); renderMgr(); };
    // 🎛️ 给「全部开关」页读当前状态用（js/54）
    window.gymGetSay = k => !!LS()[k];

    // 设置页入口
    function addSettingsEntry() {

        const menu = document.querySelector('#setIndex .set-menu');
        if (!menu || document.getElementById('gymSetEntry')) return;
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'set-entry'; btn.id = 'gymSetEntry';
        btn.onclick = () => { gymShow(); gymOpenMgr(); };
        btn.innerHTML = '<span class="set-entry-ico">🎵</span><span class="set-entry-main"><span class="set-entry-title">音乐盒</span><span class="set-entry-desc">悬浮播放器：歌单、曲库、皮肤、歌词</span></span><span class="set-entry-arrow">›</span>';
        const sep = menu.querySelector('.set-menu-sep');
        if (sep) menu.insertBefore(btn, sep); else menu.appendChild(btn);
    }

    // 把"一起听的记忆"暴露出去：插件的 code 钩子（每次拼 prompt 都会跑）从这里取，
    // 这样聊天/发推/写日记/评论都会知道"我们一起听过什么"。
    window.__gymMemoryFor = function (charId) {
        try {
            const m = (S.memory || {})[String(charId)];
            if (!m) return '';
            let extra = '';
            // 正在一起听的时候，顺带告诉 TA 此刻在放什么
            if (LS().chars.includes(String(charId)) && cur()) {
                const t = cur();
                extra = `\n【你此刻正在和对方一起听】${t.title || '未命名'}${t.artist ? ' —— ' + t.artist : ''}`;
            }
            return `\n【你和对方一起听歌的记忆】：${m}${extra}\n`;
        } catch (e) { return ''; }
    };

    // 🎧 角色主动约你听歌：往自主模式的动作表里塞一项。
    // GY_AUTONOMY_ACTIONS 是 js/14 里的顶层 const 数组——常量指的是"不能重新赋值"，
    // 往里 push 是可以的。整个自主模式本来就默认关着，所以这一项不会平白花钱。
    function hookAutonomy() {
        try {
            if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || !Array.isArray(GY_AUTONOMY_ACTIONS)) return;
            if (GY_AUTONOMY_ACTIONS.some(a => a.key === 'music_invite')) return;
            GY_AUTONOMY_ACTIONS.splice(GY_AUTONOMY_ACTIONS.length - 1, 0, {
                key: 'music_invite',
                label: '约用户一起听歌',
                hint: '手头有首想放给对方听的歌，或者只是想找个由头待在一起；param 填歌名（可不写，不写就从曲库里挑一首）',
                need: () => (S.tracks && S.tracks.length > 0) || typeof window.gyInviteResolveItem === 'function',
                run: async (char, param) => {
                    const id = String(char.id);
                    // 📨 发一张邀请卡：TA 点了名的那首先找来（曲库里有就用，没有就在线找），你点「好啊」就直接放这首
                    if (typeof window.gyInviteFromChar === 'function') {
                        const want = String(param || '').split(/[|｜]/)[0].replace(/[《》「」]/g, '').trim();
                        let extra = null, title = want;
                        if (want && typeof window.gyInviteResolveItem === 'function') {
                            try { extra = await window.gyInviteResolveItem('music', want); } catch (e) {}
                        }
                        if (!extra && !want && S.tracks.length) {
                            const t = S.tracks[Math.floor(Math.random() * S.tracks.length)];
                            extra = { trackId: t.id }; title = t.title || '';
                        }
                        if (!title && !extra) return null;
                        const tr = extra && extra.trackId ? S.tracks.find(x => x.id === extra.trackId) : null;
                        let inv = null;
                        inv = window.gyInviteFromChar(Object.assign({ char, kind: 'music', title, sub: tr && tr.artist ? tr.artist : '' }, extra || {}, {
                            onYes: () => { try { const K = (window.GY_INVITE_KINDS || {}).music; if (K && K.accept) K.accept(inv || { charId: id, from: 'char', title }); } catch (e) {} }
                        }));
                        return inv ? '约你一起听' + (title ? '「' + title + '」' : '歌') : null;
                    }
                    if (!LS().chars.includes(id)) LS().chars.push(id);
                    gymShow(); LS().chatOpen = true;
                    await save(); paint();
                    // 顺手放一首并让 TA 说一句，像真的在约你
                    if (curTracks().length) {
                        const i = Math.floor(Math.random() * curTracks().length);
                        await gymPlayAt(i);
                    }
                    if (typeof addNotification === 'function') {
                        addNotification(`<b>${char.name}</b> 拉你一起听歌 🎧`, null, char.id, char, '');
                    }
                    return '拉你一起听歌';
                }
            });
            console.info('[音乐盒] 已经把「约用户一起听歌」加进自主模式的动作表');
        } catch (e) { console.warn('[音乐盒] 挂自主模式失败（不影响其它功能）：', e); }
    }

    (async function init() {
        await load();
        mount();
        addSettingsEntry();
        hookAutonomy();
        const sw = window.switchMainView;
        if (typeof sw === 'function' && !sw.__gymPatched) {
            window.switchMainView = function () {
                const r = sw.apply(this, arguments);
                try { if (arguments[0] === 'settings') setTimeout(addSettingsEntry, 0); } catch (e) {}
                return r;
            };
            window.switchMainView.__gymPatched = true;
        }
        console.info('[音乐盒] 已加载，曲库 ' + S.tracks.length + ' 首 / ' + S.lists.length + ' 个歌单');
    })();
})();
