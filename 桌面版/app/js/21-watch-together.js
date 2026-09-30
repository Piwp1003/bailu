/* =====================================================================
   js/21 —— 🎬 一起看电影
   跟音乐盒是一对：那边是一起听，这边是一起看。功能对齐（片库 / 皮肤 /
   一起看的对象 / 时长统计 / 记忆总结 / 口味），但形态完全不同：

   · 是**页面**不是悬浮窗（片子占地方，悬浮窗放不下）
   · 可以切全屏；全屏时角色的话变成**弹幕**从右往左飘过去
   · 弹幕/画面上点一下，弹出一个**能拖能缩放**的悬浮聊天窗
   · 视频本身**不存**——太大了（一部片子几个 G，IndexedDB 塞不下，
     存进去备份文件也就废了）。存的是片名、封面（从视频里截的一帧）、
     字幕、看到哪儿、角色的每一条评论、你们的每一句讨论。
     电脑上用 File System Access 记住文件句柄，下次一键接着看；
     手机上每次重新选一下文件，进度和评论照样都在。

   · 角色看的不是画面，是**字幕**。srt/vtt/ass 解析成带时间轴的句子，
     每隔几分钟把这一段台词喂给 TA，让 TA 自己决定要不要说话——
     跟一起阅读那套"不硬凑评论"是同一个逻辑。没字幕就退化成"纯陪看"，
     只记进度不评论，一次 API 都不调。
   ===================================================================== */

(function () {
  if (window.__gyFilmBoxLoaded) return;
  window.__gyFilmBoxLoaded = true;

  // ---------- 存储 ----------
  const DB = (typeof window.gyStore === 'function')
    ? window.gyStore('gyFilmBox', 'default')          // 带兜底的存档口
    : ((typeof localforage !== 'undefined')
        ? localforage.createInstance({ name: 'gyFilmBox' })
        : null);
  const KEY = 'state';

  let S = {
    films: [],              // 片库
    cur: null,              // 当前片子 id
    skin: 'noir',
    watch: {
      chars: [],            // 正在一起看的角色 id
      // ⚠️ "TA 什么时候说话"那三项**不存在这里**，走全局的 AUTO_FEATURE_DEFS
      //    （filmScene / filmPause / filmEnd）。一件事只能有一个开关，
      //    否则会出现"设置页关了、这边还开着"的鬼打墙。
      sceneMin: 5,          // 隔几分钟看一次这段字幕（纯参数，不花钱）
      danmu: true,          // 全屏时走弹幕
      danmuSpeed: 1,        // 弹幕速度倍率
      danmuSize: 15,        // 弹幕字号
      danmuOpacity: 0.92,
      chatOpen: false
    },
    chatBox: { x: null, y: null, w: 320, h: 380 },   // 悬浮聊天窗的位置和大小
    taste: {},              // {角色id: 一句观影口味}
    stats: { total: { ms: 0, films: 0 }, byChar: {} },
    memory: {}              // {角色id: 一起看的记忆}
  };

  let video = null;           // <video>
  let curUrl = null;          // createObjectURL 出来的地址
  let fileHandles = {};        // {filmId: FileSystemFileHandle}（能存就存）
  let lastSceneAt = -1;        // 上次让角色看字幕的时间点（秒）
  let watchTickMs = 0;         // 本次累计观看时长
  let lastTickTs = 0;
  let danmuTrackBusyUntil = [];// 弹幕轨道占用到什么时候，防止重叠
  let libQuery = '';           // 片库搜索框里的字

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtT = t => {
    if (!isFinite(t) || t < 0) t = 0;
    const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = Math.floor(t % 60);
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  };
  function fmtDur(ms) {
    ms = Math.max(0, ms || 0);
    const min = Math.floor(ms / 60000);
    if (min < 1) return '不到 1 分钟';
    if (min < 60) return min + ' 分钟';
    const h = Math.floor(min / 60), m = min % 60;
    return h + ' 小时' + (m ? ' ' + m + ' 分' : '');
  }
  const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
  const charById = id => chars().find(c => String(c.id) === String(id));
  const watchers = () => (S.watch.chars || []).map(charById).filter(Boolean);
  const curFilm = () => S.films.find(f => f.id === S.cur) || null;
  // 这次一起看是谁约的谁：{角色id: 'me'（你约 TA）| 'char'（TA 约你）}
  const byOf = id => ((S.watch.by || {})[String(id)] === 'char') ? 'char' : 'me';
  const uname = c => (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
  const byLine = c => {
    if (!c || !(S.watch.chars || []).map(String).includes(String(c.id))) return '';
    return byOf(c.id) === 'char'
      ? `\n【这次一起看是你发起的】是你约${uname(c)}来一起看的。`
      : `\n【这次一起看是${uname(c)}发起的】是${uname(c)}约你来一起看的，你答应了。`;
  };

  async function save() {
    try {
      if (!DB) return;
      // __shown 是"这条弹幕这次放过了"的运行时标记，不该进存档（会越存越脏，
      // 而且下次打开时它是 true，评论就再也不飘了）。存之前剥掉。
      const clean = JSON.parse(JSON.stringify(S, (k, v) => k === '__shown' ? undefined : v));
      await DB.setItem(KEY, clean);
    } catch (e) { console.warn('[一起看] 存档失败', e); }
  }
  async function load() {
    try {
      if (!DB) return;
      const d = await DB.getItem(KEY);
      if (d) S = Object.assign(S, d, { watch: Object.assign(S.watch, d.watch || {}) });
      if (!S.stats) S.stats = { total: { ms: 0, films: 0 }, byChar: {} };
      // 句柄单独存（结构化克隆能存 FileSystemFileHandle，但不该混进 state 里跟着导出）
      const h = await DB.getItem('handles');
      if (h) fileHandles = h;
    } catch (e) { console.warn('[一起看] 读档失败', e); }
  }
  async function saveHandles() { try { if (DB) await DB.setItem('handles', fileHandles); } catch (e) {} }

  function toast(t, d) {
    if (typeof showToast === 'function') showToast('🎬', t, d || '', null, null, false);
    else console.log('[一起看]', t, d || '');
  }

  // ================= 字幕解析 =================
  // srt / vtt / ass 三种都吃。统一成 [{start, end, text}]（秒）
  function parseTime(str) {
    // 00:01:23,456 / 00:01:23.456 / 0:01:23.45(ass)
    const m = String(str).trim().match(/(\d+):(\d+):(\d+)[.,](\d+)/);
    if (!m) return NaN;
    const frac = m[4].length === 2 ? +m[4] / 100 : +m[4] / 1000;   // ass 是百分秒
    return +m[1] * 3600 + +m[2] * 60 + +m[3] + frac;
  }
  function stripTags(t) {
    return String(t)
      .replace(/\{[^}]*\}/g, '')          // ass 的 {\pos(...)} 之类
      .replace(/<[^>]+>/g, '')            // vtt/srt 里的 <i> <b>
      .replace(/\\N|\\n/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function parseSubtitle(text, filename) {
    const name = String(filename || '').toLowerCase();
    const raw = String(text).replace(/\r/g, '');
    let out = [];

    if (name.endsWith('.ass') || name.endsWith('.ssa') || /^\[Script Info\]/mi.test(raw)) {
      // ass：Dialogue: 0,0:00:12.34,0:00:14.00,Style,,0,0,0,,台词
      raw.split('\n').forEach(line => {
        if (!/^Dialogue\s*:/i.test(line)) return;
        const parts = line.slice(line.indexOf(':') + 1).split(',');
        if (parts.length < 10) return;
        const st = parseTime(parts[1]), en = parseTime(parts[2]);
        const txt = stripTags(parts.slice(9).join(','));
        if (isFinite(st) && txt) out.push({ start: st, end: isFinite(en) ? en : st + 2, text: txt });
      });
    } else {
      // srt / vtt：靠空行分块
      raw.split(/\n\s*\n/).forEach(block => {
        const lines = block.split('\n').filter(l => l.trim());
        if (!lines.length) return;
        const tl = lines.find(l => l.includes('-->'));
        if (!tl) return;
        const [a, b] = tl.split('-->');
        const st = parseTime(a), en = parseTime(b);
        if (!isFinite(st)) return;
        const txt = stripTags(lines.slice(lines.indexOf(tl) + 1).join(' '));
        if (txt) out.push({ start: st, end: isFinite(en) ? en : st + 2, text: txt });
      });
    }
    out.sort((a, b) => a.start - b.start);
    return out;
  }
  // 取某个时间区间内的台词，拼成一段（喂给角色看的就是这个）
  function subsBetween(film, from, to, maxChars) {
    if (!film || !film.subs || !film.subs.length) return '';
    const lines = film.subs.filter(s => s.start >= from && s.start < to).map(s => s.text);
    let t = lines.join('\n');
    const cap = maxChars || 1200;
    if (t.length > cap) t = t.slice(-cap);   // 留后半段，离"现在"更近
    return t;
  }
  function subAt(film, sec) {
    if (!film || !film.subs) return '';
    const s = film.subs.find(x => sec >= x.start && sec <= x.end);
    return s ? s.text : '';
  }

  // ================= 皮肤 =================
  // 五种，差别不只是换个颜色：底纹、边框、字体感觉、控件形状都不一样
  const SKINS = [
    { k: 'noir',   name: '午夜场',  desc: '纯黑 + 琥珀色，带一点老胶片颗粒' },
    { k: 'velvet', name: '放映厅',  desc: '暗红丝绒幕布 + 烫金，最有仪式感' },
    { k: 'vhs',    name: '录像带',  desc: 'CRT 扫描线、色散字，像在看录像带' },
    { k: 'strip',  name: '胶片',    desc: '两侧打孔的胶片边，褪色暖调' },
    { k: 'clean',  name: '素白',    desc: '几乎没有装饰，只有画面和字' }
  ];
  const skinOf = k => SKINS.find(s => s.k === k) || SKINS[0];

  // ================= 样式 =================
  // 这一整套是专门为"看片"写的，不套用 app 里已有的卡片/按钮样式：
  // 影院本来就该是暗的，跟浅色/深色主题都不跟随，免得看片时突然一片白。
  const css = document.createElement('style');
  css.id = 'gyFilmBoxStyle';
  css.textContent = `
  #view-watch-together { padding:0 !important; }
  .fb-wrap { --fb-ink:#f4efe6; --fb-dim:#9a9187; --fb-accent:#e8b04b; --fb-bg:#0a0a0b; --fb-panel:#141416; --fb-line:#26262a;
    background:var(--fb-bg); color:var(--fb-ink); min-height:100%; font-family:inherit; }

  /* —— 皮肤 —— */
  .fb-wrap[data-skin="velvet"] { --fb-accent:#d4a253; --fb-bg:#150a0c; --fb-panel:#201013; --fb-line:#3a1c21; --fb-dim:#a98d8d; }
  .fb-wrap[data-skin="vhs"]    { --fb-accent:#5ce1e6; --fb-bg:#07080d; --fb-panel:#0f1119; --fb-line:#1e2233; --fb-dim:#7d86a3; }
  .fb-wrap[data-skin="strip"]  { --fb-accent:#c98a3c; --fb-bg:#17140f; --fb-panel:#211d16; --fb-line:#3a3226; --fb-dim:#a3937a; }
  .fb-wrap[data-skin="clean"]  { --fb-accent:#111214; --fb-bg:#f2f1ee; --fb-panel:#ffffff; --fb-line:#dedbd4; --fb-ink:#15161a; --fb-dim:#6c6f76; }

  /* —— 顶部：片名 + 工具 —— */
  .fb-top { display:flex; align-items:center; gap:12px; padding:16px 20px 12px; border-bottom:1px solid var(--fb-line); flex-wrap:wrap; }
  .fb-mark { font-size:11px; letter-spacing:.32em; color:var(--fb-accent); text-transform:uppercase; }
  .fb-title { font-size:20px; font-weight:800; letter-spacing:.02em; margin-top:2px; }
  .fb-sub { font-size:12px; color:var(--fb-dim); margin-top:3px; }
  .fb-top-actions { margin-left:auto; display:flex; gap:8px; flex-wrap:wrap; }
  .fb-btn { background:transparent; color:var(--fb-ink); border:1px solid var(--fb-line); border-radius:999px;
    padding:7px 14px; font-size:12.5px; cursor:pointer; transition:.15s; white-space:nowrap; }
  .fb-btn:hover { border-color:var(--fb-accent); color:var(--fb-accent); }
  .fb-btn.solid { background:var(--fb-accent); border-color:var(--fb-accent); color:#15120a; font-weight:700; }
  .fb-wrap[data-skin="clean"] .fb-btn.solid { color:#fff; }
  .fb-btn.ghost { border-style:dashed; color:var(--fb-dim); }

  /* —— 银幕 —— */
  .fb-stage { position:relative; background:#000; margin:0; }
  .fb-wrap[data-skin="strip"] .fb-stage { border-left:18px solid transparent; border-right:18px solid transparent;
    background-image:repeating-linear-gradient(180deg,#0000 0 10px,#2b2620 10px 22px),repeating-linear-gradient(180deg,#0000 0 10px,#2b2620 10px 22px);
    background-position:left top,right top; background-size:18px 100%,18px 100%; background-repeat:no-repeat; background-clip:border-box; }
  .fb-stage video { display:block; width:100%; max-height:64vh; background:#000; }
  .fb-wrap.fb-fs .fb-stage video { max-height:100vh; height:100vh; object-fit:contain; }
  .fb-wrap[data-skin="noir"] .fb-stage::after,
  .fb-wrap[data-skin="strip"] .fb-stage::after { content:''; position:absolute; inset:0; pointer-events:none; opacity:.06;
    background-image:radial-gradient(#fff 1px,transparent 1px); background-size:3px 3px; mix-blend-mode:screen; }
  .fb-wrap[data-skin="vhs"] .fb-stage::after { content:''; position:absolute; inset:0; pointer-events:none; opacity:.22;
    background:repeating-linear-gradient(180deg,rgba(0,0,0,.5) 0 1px,transparent 1px 3px); }
  .fb-wrap[data-skin="velvet"] .fb-stage { box-shadow:0 0 0 6px #2a1216, 0 0 40px rgba(0,0,0,.8) inset; }

  /* 没选片子时的空银幕 */
  .fb-empty-stage { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px;
    min-height:320px; color:var(--fb-dim); text-align:center; padding:30px; }
  .fb-empty-stage .fb-big { font-size:44px; opacity:.5; }

  /* —— 弹幕层 —— */
  .fb-danmu { position:absolute; inset:0; overflow:hidden; pointer-events:none; z-index:5; }
  .fb-danmu-item { position:absolute; white-space:nowrap; font-weight:700; letter-spacing:.02em;
    text-shadow:0 1px 3px rgba(0,0,0,.95), 0 0 12px rgba(0,0,0,.6); will-change:transform; }
  .fb-wrap[data-skin="vhs"] .fb-danmu-item { text-shadow:1.5px 0 0 rgba(255,0,80,.55), -1.5px 0 0 rgba(0,220,255,.55), 0 1px 3px #000; }
  @keyframes fbFly { from { transform:translateX(0); } to { transform:translateX(var(--fb-fly)); } }

  /* 全屏时右上角那排 */
  .fb-fs-bar { position:absolute; top:14px; right:14px; z-index:20; display:none; gap:8px; }
  .fb-wrap.fb-fs .fb-fs-bar { display:flex; }
  .fb-fs-bar .fb-btn { background:rgba(0,0,0,.45); backdrop-filter:blur(6px); color:#fff; border-color:rgba(255,255,255,.25); }

  /* —— 控制条 —— */
  .fb-ctrl { display:flex; align-items:center; gap:12px; padding:12px 20px; border-bottom:1px solid var(--fb-line); flex-wrap:wrap; }
  .fb-wrap.fb-fs .fb-ctrl { position:absolute; left:0; right:0; bottom:0; z-index:20; border:0;
    background:linear-gradient(transparent,rgba(0,0,0,.85)); padding-bottom:22px; }
  .fb-play { width:44px; height:44px; border-radius:50%; border:1px solid var(--fb-accent); background:transparent;
    color:var(--fb-accent); font-size:16px; cursor:pointer; flex-shrink:0; transition:.15s; }
  .fb-play:hover { background:var(--fb-accent); color:#15120a; }
  .fb-time { font-size:12px; color:var(--fb-dim); font-variant-numeric:tabular-nums; flex-shrink:0; }
  .fb-seek { position:relative; flex:1; min-width:120px; height:22px; cursor:pointer; display:flex; align-items:center; }
  .fb-seek-track { position:relative; width:100%; height:4px; border-radius:2px; background:var(--fb-line); overflow:visible; }
  .fb-seek-fill { position:absolute; left:0; top:0; bottom:0; border-radius:2px; background:var(--fb-accent); }
  .fb-seek-head { position:absolute; top:50%; width:11px; height:11px; border-radius:50%; background:var(--fb-accent); transform:translate(-50%,-50%); }
  .fb-mark-dot { position:absolute; top:50%; width:7px; height:7px; border-radius:50%; transform:translate(-50%,-50%);
    background:#fff; border:1.5px solid var(--fb-accent); cursor:pointer; pointer-events:auto; }
  .fb-mark-dot:hover { transform:translate(-50%,-50%) scale(1.5); }

  /* —— 下半部分：字幕行 / 评论 / 片库 —— */
  .fb-body { padding:18px 20px 40px; max-width:900px; margin:0 auto; }
  .fb-nowline { font-size:15px; line-height:1.7; min-height:26px; padding:12px 16px; border-left:2px solid var(--fb-accent);
    background:var(--fb-panel); border-radius:0 8px 8px 0; margin-bottom:18px; }
  .fb-nowline.empty { color:var(--fb-dim); border-left-color:var(--fb-line); font-style:italic; }
  .fb-sec-title { font-size:11px; letter-spacing:.28em; color:var(--fb-dim); text-transform:uppercase; margin:26px 0 12px; }
  .fb-cmt { display:flex; gap:11px; padding:11px 0; border-bottom:1px dashed var(--fb-line); }
  .fb-cmt-at { font-size:11px; color:var(--fb-accent); font-variant-numeric:tabular-nums; flex-shrink:0; width:52px;
    cursor:pointer; padding-top:2px; }
  .fb-cmt-body { flex:1; min-width:0; }
  .fb-cmt-who { font-size:12px; font-weight:700; margin-bottom:3px; }
  .fb-cmt-quote { font-size:11.5px; color:var(--fb-dim); font-style:italic; margin-bottom:4px;
    border-left:2px solid var(--fb-line); padding-left:8px; }
  .fb-cmt-text { font-size:14px; line-height:1.6; }

  /* 片库 */
  .fb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(132px,1fr)); gap:14px; }
  .fb-card { background:var(--fb-panel); border:1px solid var(--fb-line); border-radius:10px; overflow:hidden; cursor:pointer; transition:.15s; }
  .fb-card:hover { border-color:var(--fb-accent); transform:translateY(-2px); }
  .fb-card.on { border-color:var(--fb-accent); box-shadow:0 0 0 1px var(--fb-accent) inset; }
  .fb-poster { width:100%; aspect-ratio:2/3; object-fit:cover; display:block; background:#000; }
  .fb-poster-none { width:100%; aspect-ratio:2/3; display:flex; align-items:center; justify-content:center; font-size:26px; opacity:.35; background:#000; }
  .fb-card-info { padding:8px 9px; }
  .fb-card-name { font-size:12.5px; font-weight:700; line-height:1.35; word-break:break-all; }
  .fb-card-meta { font-size:10.5px; color:var(--fb-dim); margin-top:3px; }
  .fb-prog { height:2px; background:var(--fb-line); }
  .fb-prog i { display:block; height:100%; background:var(--fb-accent); }

  /* —— 悬浮聊天窗（能拖能缩放）—— */
  .fb-chat { position:fixed; z-index:2400; display:none; flex-direction:column;
    background:rgba(16,16,18,.94); backdrop-filter:blur(14px); color:#f4efe6;
    border:1px solid rgba(255,255,255,.14); border-radius:14px; box-shadow:0 18px 60px rgba(0,0,0,.6);
    min-width:230px; min-height:200px; overflow:hidden; }
  .fb-chat.on { display:flex; }
  .fb-chat-head { display:flex; align-items:center; gap:8px; padding:9px 12px; cursor:move; user-select:none;
    border-bottom:1px solid rgba(255,255,255,.1); flex-shrink:0; }
  .fb-chat-head b { font-size:12.5px; }
  .fb-chat-head .fb-x { margin-left:auto; cursor:pointer; opacity:.6; font-size:14px; padding:0 4px; }
  .fb-chat-head .fb-x:hover { opacity:1; }
  .fb-chat-body { flex:1; overflow-y:auto; padding:10px 12px; display:flex; flex-direction:column; gap:8px; min-height:0; }
  .fb-msg { max-width:82%; padding:7px 11px; border-radius:12px; font-size:13px; line-height:1.5; word-break:break-word; }
  .fb-msg.them { background:rgba(255,255,255,.09); align-self:flex-start; }
  .fb-msg.me { background:var(--fb-accent,#e8b04b); color:#15120a; align-self:flex-end; }
  .fb-msg .fb-msg-who { font-size:10.5px; opacity:.65; margin-bottom:2px; }
  .fb-msg .fb-msg-at { font-size:10px; opacity:.5; margin-top:2px; }
  .fb-chat-in { display:flex; gap:7px; padding:9px 10px; border-top:1px solid rgba(255,255,255,.1); flex-shrink:0; }
  .fb-chat-in input { flex:1; min-width:0; background:rgba(255,255,255,.08); border:0; border-radius:999px;
    padding:8px 13px; color:#f4efe6; font-size:13px; outline:none; }
  .fb-chat-in button { background:var(--fb-accent,#e8b04b); color:#15120a; border:0; border-radius:999px;
    padding:8px 14px; font-size:12.5px; font-weight:700; cursor:pointer; }
  .fb-chat-grip { position:absolute; right:0; bottom:0; width:16px; height:16px; cursor:nwse-resize;
    background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.35) 50%); }

  /* —— 弹窗（导入 / 设置 / 片库管理）复用 app 的 modal 外壳，但内部自己排 —— */
  .fb-modal-body { max-height:70vh; overflow-y:auto; }
  .fb-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px dashed #2a2a2e; flex-wrap:wrap; }
  .fb-field { display:block; font-size:12px; color:#8b98a5; margin:12px 0 4px; }
  .fb-chip { display:inline-block; padding:6px 12px; margin:3px; border-radius:999px; border:1px solid #cfd9de;
    font-size:12px; cursor:pointer; }
  .fb-chip.on { border-color:#1d9bf0; background:rgba(29,155,240,.12); color:#1d9bf0; }

  @media (max-width:900px) {
    .fb-top { padding:12px 14px 10px; }
    .fb-title { font-size:17px; }
    .fb-body { padding:14px 14px 90px; }
    .fb-ctrl { padding:10px 14px; gap:9px; }
    .fb-stage video { max-height:44vh; }
    .fb-grid { grid-template-columns:repeat(auto-fill,minmax(104px,1fr)); gap:10px; }
  }`;
  document.head.appendChild(css);

  // ================= 页面骨架 =================
  function mountView() {
    if (document.getElementById('view-watch-together')) return;
    const host = document.querySelector('.main-content') || document.body;
    const v = document.createElement('div');
    v.id = 'view-watch-together';
    v.style.display = 'none';
    v.innerHTML = `
      <div class="fb-wrap" id="fbWrap" data-skin="noir">
        <div class="fb-top">
          <div>
            <div class="fb-mark">Watch together</div>
            <div class="fb-title" id="fbTitle">一起看电影</div>
            <div class="fb-sub" id="fbSub">还没有选片子</div>
          </div>
          <div class="fb-top-actions">
            <button type="button" class="fb-btn solid" onclick="fbPickVideo()">📂 打开片子</button>
            <button type="button" class="fb-btn" onclick="fbOpenLibrary()">🎞️ 片库</button>
            <button type="button" class="fb-btn" onclick="if(window.gyResOpen) gyResOpen('film')">🌐 在线找片</button>
            <button type="button" class="fb-btn" onclick="fbOpenWatchers()">👥 一起看</button>
            <button type="button" class="fb-btn" onclick="fbOpenSettings()">⚙️ 设置</button>
            <button type="button" class="fb-btn" onclick="fbAskNow()">🗣️ 问问 TA</button>
            <button type="button" class="fb-btn" onclick="fbAskPick()">🎯 让 TA 挑</button>
            <button type="button" class="fb-btn" onclick="fbToggleChat()">💬 聊天</button>
          </div>
        </div>

        <div class="fb-stage" id="fbStage">
          <div class="fb-empty-stage" id="fbEmptyStage">
            <div class="fb-big">🎬</div>
            <div>选一个本地视频文件开始。<br>
              <span style="font-size:12px;">片子本身不会被存进来——只记片名、封面、字幕、看到哪儿和你们说过的话。</span></div>
            <button type="button" class="fb-btn solid" onclick="fbPickVideo()">📂 打开片子</button>
            <button type="button" class="fb-btn" onclick="if(window.gyResOpen) gyResOpen('film')">🌐 在线找片（不用自己上传）</button>
          </div>
          <div class="fb-danmu" id="fbDanmu"></div>
          <div class="fb-fs-bar">
            <button type="button" class="fb-btn" onclick="fbToggleChat()">💬</button>
            <button type="button" class="fb-btn" onclick="fbToggleFs()">⛶ 退出全屏</button>
          </div>
        </div>

        <div class="fb-ctrl" id="fbCtrl" style="display:none;">
          <button type="button" class="fb-play" id="fbPlayBtn" onclick="fbTogglePlay()">▶</button>
          <span class="fb-time" id="fbTimeNow">0:00</span>
          <div class="fb-seek" id="fbSeek" onclick="fbSeekClick(event)">
            <div class="fb-seek-track">
              <div class="fb-seek-fill" id="fbSeekFill" style="width:0%"></div>
              <div class="fb-seek-head" id="fbSeekHead" style="left:0%"></div>
            </div>
          </div>
          <span class="fb-time" id="fbTimeAll">0:00</span>
          <button type="button" class="fb-btn" onclick="fbToggleFs()">⛶</button>
        </div>

        <div class="fb-body" id="fbBody"></div>
      </div>`;
    host.appendChild(v);

    // 悬浮聊天窗（挂 body 上，全屏时也在）
    const chat = document.createElement('div');
    chat.className = 'fb-chat';
    chat.id = 'fbChat';
    chat.innerHTML = `
      <div class="fb-chat-head" id="fbChatHead">
        <b id="fbChatTitle">💬 边看边聊</b>
        <span class="fb-x" onclick="fbToggleChat()">✕</span>
      </div>
      <div class="fb-chat-body" id="fbChatBody"></div>
      <div class="fb-chat-in">
        <input id="fbChatInput" placeholder="说点什么…" onkeydown="if(event.key==='Enter')fbSend()">
        <button type="button" onclick="fbSend()">发送</button>
      </div>
      <div class="fb-chat-grip" id="fbChatGrip"></div>`;
    // ⚠️ 必须挂在 #fbWrap 里面，不能挂 body 上。
    //    进全屏的是 #fbWrap，浏览器**只渲染全屏元素及其子树**——挂在 body 上的话，
    //    全屏时这个聊天窗根本不显示，也点不到，看起来就是"X 点了没反应/关不掉"。
    //    它是 position:fixed，放进 #fbWrap 里照样按视口定位，非全屏时行为不变。
    (v.querySelector('.fb-wrap') || document.body).appendChild(chat);
    bindChatDragResize();
  }

  // ---------- 悬浮聊天窗：拖动 + 缩放 ----------
  function bindChatDragResize() {
    const box = document.getElementById('fbChat');
    const head = document.getElementById('fbChatHead');
    const grip = document.getElementById('fbChatGrip');
    if (!box || !head || !grip) return;

    let mode = null, sx = 0, sy = 0, ox = 0, oy = 0, ow = 0, oh = 0;
    const pt = e => (e.touches && e.touches[0]) ? e.touches[0] : e;

    function down(m) {
      return function (e) {
        // 关闭按钮在标题栏里，按下去不能算"开始拖窗"——
        // 拖动逻辑里有 preventDefault，抢走 mousedown 之后那一下点击就可能不触发了。
        if (e.target && e.target.closest && e.target.closest('.fb-x')) return;
        const p = pt(e);
        mode = m; sx = p.clientX; sy = p.clientY;
        const r = box.getBoundingClientRect();
        ox = r.left; oy = r.top; ow = r.width; oh = r.height;
        e.preventDefault();
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
        document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', up);
      };
    }
    function move(e) {
      if (!mode) return;
      const p = pt(e);
      const dx = p.clientX - sx, dy = p.clientY - sy;
      if (mode === 'drag') {
        // 不许拖出屏幕：至少留 60px 在里面，不然抓不回来
        const x = Math.min(window.innerWidth - 60, Math.max(60 - ow, ox + dx));
        const y = Math.min(window.innerHeight - 40, Math.max(0, oy + dy));
        box.style.left = x + 'px'; box.style.top = y + 'px'; box.style.right = 'auto'; box.style.bottom = 'auto';
      } else {
        box.style.width = Math.max(230, Math.min(window.innerWidth - 20, ow + dx)) + 'px';
        box.style.height = Math.max(200, Math.min(window.innerHeight - 20, oh + dy)) + 'px';
      }
      e.preventDefault();
    }
    function up() {
      if (!mode) return;
      mode = null;
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up);
      const r = box.getBoundingClientRect();
      S.chatBox = { x: r.left, y: r.top, w: r.width, h: r.height };
      save();
    }
    head.addEventListener('mousedown', down('drag'));
    head.addEventListener('touchstart', down('drag'), { passive: false });
    grip.addEventListener('mousedown', down('resize'));
    grip.addEventListener('touchstart', down('resize'), { passive: false });
  }

  function applyChatBoxGeom() {
    const box = document.getElementById('fbChat');
    if (!box) return;
    const g = S.chatBox || {};
    const w = Math.min(g.w || 320, window.innerWidth - 20);
    const h = Math.min(g.h || 380, window.innerHeight - 20);
    box.style.width = w + 'px'; box.style.height = h + 'px';
    // 没存过位置、或者存的位置已经在屏幕外了（换了设备/转了屏），就回到右下角
    let x = g.x, y = g.y;
    if (x == null || y == null || x > window.innerWidth - 60 || y > window.innerHeight - 40 || x < 60 - w || y < 0) {
      x = Math.max(10, window.innerWidth - w - 16);
      y = Math.max(10, window.innerHeight - h - 90);
    }
    box.style.left = x + 'px'; box.style.top = y + 'px';
  }

  window.fbToggleChat = function () {
    const box = document.getElementById('fbChat');
    if (!box) return;
    const on = !box.classList.contains('on');
    box.classList.toggle('on', on);
    S.watch.chatOpen = on; save();
    if (on) { applyChatBoxGeom(); renderChat(); }
  };

  // ================= 弹幕 =================
  function flyDanmu(name, text, color) {
    const layer = document.getElementById('fbDanmu');
    if (!layer || !S.watch.danmu) return;
    const el = document.createElement('div');
    el.className = 'fb-danmu-item';
    el.style.fontSize = (S.watch.danmuSize || 15) + 'px';
    el.style.opacity = String(S.watch.danmuOpacity == null ? .92 : S.watch.danmuOpacity);
    el.style.color = color || '#fff';
    el.innerHTML = `<span style="opacity:.75;font-weight:600;">${esc(name)}：</span>${esc(text)}`;
    layer.appendChild(el);

    const W = layer.clientWidth || 640;
    const w = el.offsetWidth || 200;
    const lineH = (S.watch.danmuSize || 15) * 1.9;
    const tracks = Math.max(3, Math.floor((layer.clientHeight * 0.62) / lineH));
    // 挑一条现在没被占住的轨道；都占着就挑最快空出来的那条
    const now = Date.now();
    if (danmuTrackBusyUntil.length !== tracks) danmuTrackBusyUntil = new Array(tracks).fill(0);
    let t = danmuTrackBusyUntil.findIndex(x => x < now);
    if (t < 0) t = danmuTrackBusyUntil.indexOf(Math.min.apply(null, danmuTrackBusyUntil));
    el.style.top = (12 + t * lineH) + 'px';
    el.style.left = W + 'px';

    const dur = Math.max(4200, (W + w) / (0.13 * (S.watch.danmuSpeed || 1)));
    // 这条弹幕的"尾巴"离开右边缘之前，这条轨道不能再放新的，否则会追尾
    danmuTrackBusyUntil[t] = now + dur * (w + 40) / (W + w);
    el.style.setProperty('--fb-fly', '-' + (W + w + 20) + 'px');
    el.style.animation = `fbFly ${dur}ms linear forwards`;
    setTimeout(() => el.remove(), dur + 200);
  }

  // ================= 视频 =================
  function ensureVideo() {
    if (video) return video;
    video = document.createElement('video');
    video.playsInline = true;
    video.controls = false;
    video.preload = 'metadata';
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', () => {
      const f = curFilm();
      if (f) {
        f.dur = video.duration || f.dur || 0;
        if (f.pos && f.pos > 2 && f.pos < (f.dur - 5)) video.currentTime = f.pos;
        if (!f.cover) setTimeout(grabCover, 800);
        save();
      }
      paintCtrl();
    });
    video.addEventListener('play', () => { lastTickTs = Date.now(); paintCtrl(); });
    video.addEventListener('pause', () => { flushTick(); paintCtrl(); onPaused(); });
    video.addEventListener('ended', () => { flushTick(); onEnded(); });
    const stage = document.getElementById('fbStage');
    stage.insertBefore(video, stage.firstChild);
    return video;
  }

  function flushTick() {
    if (!lastTickTs) return;
    const d = Date.now() - lastTickTs;
    lastTickTs = 0;
    if (d < 1000 || d > 3600000) return;
    watchTickMs += d;
    if (!S.stats) S.stats = { total: { ms: 0, films: 0 }, byChar: {} };
    S.stats.total.ms += d;
    watchers().forEach(c => {
      const k = String(c.id);
      if (!S.stats.byChar[k]) S.stats.byChar[k] = { ms: 0, films: 0, first: Date.now() };
      S.stats.byChar[k].ms += d;
    });
    save();
  }

  function onTimeUpdate() {
    if (!video) return;
    if (lastTickTs && Date.now() - lastTickTs > 15000) { flushTick(); lastTickTs = Date.now(); }
    paintCtrl();
    const f = curFilm();
    if (f) {
      f.pos = video.currentTime;
      // ⚠️ 以前只把进度写进内存，指望暂停/切页时顺带存下来——直接关标签页就丢了。
      //    这里每 10 秒落一次盘（不是每帧，那样太费）。
      if (!video.__lastPosSave || Date.now() - video.__lastPosSave > 10000) { video.__lastPosSave = Date.now(); save(); }
    }
    // 字幕行
    const line = document.getElementById('fbNowLine');
    if (line) {
      const t = subAt(f, video.currentTime);
      line.textContent = t || '（这一段没有台词）';
      line.classList.toggle('empty', !t);
    }
    // 到点的评论走弹幕
    if (f && f.comments) {
      f.comments.forEach(c => {
        if (c.__shown) return;
        if (Math.abs(video.currentTime - c.at) < 0.6) {
          c.__shown = true;
          if (isFs()) flyDanmu(c.name, c.text, '#fff');
        }
      });
    }
    maybeSceneComment();
  }

  function paintCtrl() {
    const f = curFilm();
    const ctrl = document.getElementById('fbCtrl');
    const empty = document.getElementById('fbEmptyStage');
    if (ctrl) ctrl.style.display = (video && f) ? 'flex' : 'none';
    if (empty) empty.style.display = (video && video.src) ? 'none' : 'flex';
    if (!video) return;
    const btn = document.getElementById('fbPlayBtn');
    if (btn) btn.textContent = video.paused ? '▶' : '❚❚';
    const dur = video.duration || (f && f.dur) || 0;
    const pct = dur ? (video.currentTime / dur * 100) : 0;
    const fill = document.getElementById('fbSeekFill'); if (fill) fill.style.width = pct + '%';
    const head = document.getElementById('fbSeekHead'); if (head) head.style.left = pct + '%';
    const t1 = document.getElementById('fbTimeNow'); if (t1) t1.textContent = fmtT(video.currentTime);
    const t2 = document.getElementById('fbTimeAll'); if (t2) t2.textContent = fmtT(dur);
  }

  function paintMarks() {
    const track = document.querySelector('#fbSeek .fb-seek-track');
    if (!track) return;
    track.querySelectorAll('.fb-mark-dot').forEach(d => d.remove());
    const f = curFilm();
    const dur = (video && video.duration) || (f && f.dur) || 0;
    if (!f || !dur) return;
    (f.comments || []).forEach(c => {
      const d = document.createElement('div');
      d.className = 'fb-mark-dot';
      d.style.left = (c.at / dur * 100) + '%';
      d.title = c.name + '：' + c.text;
      d.onclick = ev => { ev.stopPropagation(); if (video) video.currentTime = Math.max(0, c.at - 3); };
      track.appendChild(d);
    });
  }

  window.fbTogglePlay = function () { if (!video) return; if (video.paused) video.play().catch(() => {}); else video.pause(); };
  window.fbSeekClick = function (e) {
    if (!video) return;
    const el = document.getElementById('fbSeek');
    const r = el.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const dur = video.duration || 0;
    if (dur) { video.currentTime = p * dur; lastSceneAt = video.currentTime; }
  };
  const isFs = () => { const w = document.getElementById('fbWrap'); return !!w && w.classList.contains('fb-fs'); };
  window.fbToggleFs = function () {
    const w = document.getElementById('fbWrap');
    if (!w) return;
    const on = !w.classList.contains('fb-fs');
    w.classList.toggle('fb-fs', on);
    try {
      if (on && w.requestFullscreen) w.requestFullscreen().catch(() => {});
      else if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    } catch (e) {}
    paintCtrl();
  };
  document.addEventListener('fullscreenchange', () => {
    const w = document.getElementById('fbWrap');
    if (w && !document.fullscreenElement) w.classList.remove('fb-fs');
  });

  // ================= 打开片子 =================
  const canFsApi = () => typeof window.showOpenFilePicker === 'function';

  async function openFileObject(file, presetFilmId) {
    if (!file) return;
    ensureVideo();
    if (curUrl) { try { URL.revokeObjectURL(curUrl); } catch (e) {} }
    curUrl = URL.createObjectURL(file);
    video.src = curUrl;

    let f = presetFilmId ? S.films.find(x => x.id === presetFilmId) : null;
    if (!f) {
      // 同名的当成同一部片子（换设备重新选文件时接着看，靠的就是这个）
      const base = file.name.replace(/\.[^.]+$/, '');
      f = S.films.find(x => x.title === base || x.file === file.name);
      if (!f) {
        f = { id: 'f' + Date.now().toString(36), title: base, file: file.name,
              subs: [], comments: [], chat: [], pos: 0, dur: 0, cover: '', addedAt: Date.now() };
        S.films.unshift(f);
        if (!S.stats) S.stats = { total: { ms: 0, films: 0 }, byChar: {} };
        S.stats.total.films++;
        watchers().forEach(c => {
          const k = String(c.id);
          if (!S.stats.byChar[k]) S.stats.byChar[k] = { ms: 0, films: 0, first: Date.now() };
          S.stats.byChar[k].films++;
        });
      }
    }
    S.cur = f.id;
    (f.comments || []).forEach(c => { delete c.__shown; });
    lastSceneAt = -1;
    await save();
    paintAll();
    toast('打开了《' + f.title + '》', f.subs && f.subs.length ? `已有 ${f.subs.length} 行字幕` : '还没导字幕——现在是纯陪看，不会评论');
  }

  window.fbPickVideo = async function () {
    if (canFsApi()) {
      try {
        const [h] = await window.showOpenFilePicker({
          types: [{ description: '视频', accept: { 'video/*': ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v'] } }]
        });
        const file = await h.getFile();
        await openFileObject(file);
        const f = curFilm();
        if (f) { fileHandles[f.id] = h; await saveHandles(); }   // 记住句柄，下次一键接着看
        return;
      } catch (e) { if (e && e.name === 'AbortError') return; /* 不支持就走下面的 input */ }
    }
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'video/*';
    inp.onchange = () => { if (inp.files && inp.files[0]) openFileObject(inp.files[0]); };
    inp.click();
  };

  // 🌐 在线的片子（js/59 在线找资源）：不用选文件，直接放链接。进度、字幕、评论跟本地片子一样记
  window.fbOpenUrl = async function (url, title, extra) {
    if (!url) return null;
    ensureVideo();
    if (curUrl) { try { URL.revokeObjectURL(curUrl); } catch (e) {} curUrl = null; }
    let f = S.films.find(x => x.url === url);
    if (!f) {
      f = { id: 'f' + Date.now().toString(36), title: String(title || '在线影片'), file: '', url,
            subs: [], comments: [], chat: [], pos: 0, dur: 0, cover: (extra && extra.cover) || '', addedAt: Date.now(), online: true, note: (extra && extra.note) || '' };
      S.films.unshift(f);
      if (!S.stats) S.stats = { total: { ms: 0, films: 0 }, byChar: {} };
      S.stats.total.films++;
    }
    video.src = url;
    S.cur = f.id;
    (f.comments || []).forEach(c => { delete c.__shown; });
    lastSceneAt = -1;
    await save();
    paintAll();
    toast('打开了《' + f.title + '》', '在线播放，进度和评论照样记');
    return f;
  };
  // 只加进片库，先不打开
  window.fbAddUrl = async function (url, title, extra) {
    if (!url) return null;
    let f = S.films.find(x => x.url === url);
    if (!f) {
      f = { id: 'f' + Date.now().toString(36), title: String(title || '在线影片'), file: '', url,
            subs: [], comments: [], chat: [], pos: 0, dur: 0, cover: (extra && extra.cover) || '', addedAt: Date.now(), online: true, note: (extra && extra.note) || '' };
      S.films.unshift(f);
      await save(); try { paintAll(); } catch (e) {}
    }
    return f;
  };
  // 按片名在片库里找（邀请卡 / TA 点名要看的那部）：先全等，再互相包含
  window.fbFindFilm = function (title) {
    const n = s => String(s || '').replace(/[《》「」"'“”\s]/g, '').toLowerCase();
    const t = n(title); if (!t) return null;
    return S.films.find(f => n(f.title) === t) || S.films.find(f => n(f.title) && (n(f.title).indexOf(t) !== -1 || t.indexOf(n(f.title)) !== -1)) || null;
  };
  window.fbCurFilmId = () => S.cur || null;
  // 片库里点"接着看"：电脑上能直接恢复，手机上要重选一次
  window.fbResume = async function (id) {
    const fu = S.films.find(x => x.id === id);
    if (fu && fu.url) { await window.fbOpenUrl(fu.url, fu.title); try { if (fu.pos && video) video.currentTime = fu.pos; } catch (e) {} return; }
    const h = fileHandles[id];
    if (h && h.getFile) {
      try {
        let p = await h.queryPermission({ mode: 'read' });
        if (p !== 'granted') p = await h.requestPermission({ mode: 'read' });
        if (p === 'granted') { await openFileObject(await h.getFile(), id); return; }
      } catch (e) { console.warn('[一起看] 恢复文件句柄失败', e); }
    }
    const f = S.films.find(x => x.id === id);
    toast('要重新选一下文件', (f ? `《${f.title}》` : '这部片子') + ' 的进度和评论都还在，选中同一个文件就能接着看。');
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'video/*';
    inp.onchange = () => { if (inp.files && inp.files[0]) openFileObject(inp.files[0], id); };
    inp.click();
  };

  window.fbImportSub = function () {
    const f = curFilm();
    if (!f) return toast('先打开一部片子', '字幕要挂在某部片子上。');
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.srt,.vtt,.ass,.ssa,text/plain';
    inp.onchange = () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = async () => {
        const subs = parseSubtitle(String(r.result || ''), file.name);
        if (!subs.length) return toast('没解析出字幕', '支持 srt / vtt / ass，看看文件对不对。');
        f.subs = subs;
        await save(); paintAll();
        toast('字幕导好了', `${subs.length} 行。往后 TA 就能"看懂"在演什么了。`);
      };
      r.readAsText(file, 'utf-8');
    };
    inp.click();
  };

  // 从当前画面截一帧当封面
  function grabCover() {
    try {
      const f = curFilm();
      if (!f || !video || !video.videoWidth) return;
      const cv = document.createElement('canvas');
      const W = 240;
      cv.width = W; cv.height = Math.round(W * video.videoHeight / video.videoWidth);
      cv.getContext('2d').drawImage(video, 0, 0, cv.width, cv.height);
      f.cover = cv.toDataURL('image/jpeg', 0.7);
      save(); paintLibrary();
    } catch (e) { /* 跨域或还没解码出来，算了 */ }
  }
  window.fbGrabCover = function () { grabCover(); toast('封面换成这一帧了', ''); };

  // ================= 角色说话 =================
  function pushComment(char, text, quote) {
    const f = curFilm();
    if (!f) return;
    if (!f.comments) f.comments = [];
    const c = { at: video ? video.currentTime : 0, charId: char.id, name: char.name,
                text: text, quote: quote || '', ts: Date.now(), __shown: true };
    f.comments.push(c);
    f.comments.sort((a, b) => a.at - b.at);
    if (!f.chat) f.chat = [];
    f.chat.push({ who: 'char', name: char.name, text: text, at: Date.now(), atSec: c.at });
    save();
    if (isFs()) flyDanmu(char.name, text);
    renderChat(); paintComments(); paintMarks();
  }

    // 报一下场景：这段生成属于「film」那一场，好让「注入内容管理」能单独设它读什么（soft＝外层已经有场景就不抢）

  async function askChar() {

      const a = arguments;

      if (typeof window.gyInjectInSceneSoft === 'function')

          return window.gyInjectInSceneSoft('film', () => askCharInner.apply(null, a));

      return askCharInner.apply(null, a);

  }

  async function askCharInner(char, ask, sysExtra) {
    const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
    if (!api || !api.key) return '';
    try {
      const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(char, false, '') : '';
      const sys = base + byLine(char) + (sysExtra || '');
      const msgs = (typeof buildStructuredMessages === 'function')
        ? buildStructuredMessages(sys, [], ask) : (sys + '\n\n' + ask);
      const data = await callChatCompletionAPI(api, msgs);
      return ((data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '').trim();
    } catch (e) { console.warn('[一起看] 调用失败', e); return ''; }
  }

  // 每隔 sceneMin 分钟，把这一段字幕给角色看一眼，让 TA 自己决定说不说
  let sceneBusy = false;
  async function maybeSceneComment() {
    if (sceneBusy || !video || video.paused) return;
    if (typeof isAutoOn === 'function' && !isAutoOn('filmScene')) return;   // 🔌 跟设置里那个是同一个开关
    const f = curFilm();
    if (!f || !f.subs || !f.subs.length) return;       // 没字幕就是纯陪看，不调 API
    const cs = watchers();
    if (!cs.length) return;
    const gap = Math.max(0.05, gyNum(S.watch.sceneMin, 5)) * 60;
    if (lastSceneAt < 0) { lastSceneAt = video.currentTime; return; }
    if (video.currentTime - lastSceneAt < gap) return;

    const from = lastSceneAt, to = video.currentTime;
    lastSceneAt = to;
    const seg = subsBetween(f, from, to);
    if (!seg || seg.length < 20) return;

    sceneBusy = true;
    try {
      for (const c of cs) {
        const ask = `你在和对方一起看《${f.title}》，现在看到 ${fmtT(to)}。刚刚这几分钟的台词是：
---
${seg}
---
你**不需要**每次都说话。只有当这一段里真有让你有感触、想吐槽、想问、或者戳到你的东西时才开口；
没有的话就老实说没有，不要为了凑数硬评论。
只输出严格 JSON，不要 markdown：
{"say": true或false, "quote": "戳到你的那一句原台词（没有就空字符串）", "text": "你想说的话，像看片时随口说的，不超过40字"}`;
        const raw = await askChar(c, ask);
        const p = (typeof extractJsonObject === 'function') ? extractJsonObject(raw) : null;
        if (p && p.say && p.text) pushComment(c, String(p.text).slice(0, 120), p.quote || '');
      }
    } finally { sceneBusy = false; }
  }

  // 你一暂停，TA 接一句
  let pauseBusy = false;
  async function onPaused() {
    if (pauseBusy) return;
    if (typeof isAutoOn === 'function' && !isAutoOn('filmPause')) return;   // 🔌 同上
    const f = curFilm(); const cs = watchers();
    if (!f || !cs.length || !video) return;
    if (video.currentTime < 5 || (video.duration && video.currentTime >= video.duration - 1)) return;
    pauseBusy = true;
    try {
      const c = cs[Math.floor(Math.random() * cs.length)];
      const near = subsBetween(f, Math.max(0, video.currentTime - 90), video.currentTime, 500);
      const ask = `你在和对方一起看《${f.title}》，TA 刚按了暂停（现在 ${fmtT(video.currentTime)}）。
${near ? '刚才这一段的台词：\n' + near : '（这部片子没导字幕，你不知道具体在演什么，那就聊点别的，比如问 TA 怎么了）'}
说一句话，像真的在旁边被暂停打断了那样，不超过30字。只输出这句话本身。`;
      const t = await askChar(c, ask);
      if (t) {
        const line = t.replace(/^["「]|["」]$/g, '').slice(0, 100);
        pushComment(c, line, '');
        // 多个人一起看的时候，第二个人接不接话交给 TA 自己按人设定（跟音乐盒一样，不掷骰子）
        if (typeof secondVoice === 'function') await secondVoice(c, line);
      }
    } finally { pauseBusy = false; }
  }

  // 看完
  async function onEnded() {
    const f = curFilm();
    if (!f) return;
    if (typeof isAutoOn === 'function' && !isAutoOn('filmEnd')) { toast('看完了', '《' + f.title + '》'); return; }   // 🔌 同上
    const cs = watchers();
    for (const c of cs) {
      const ask = `你刚和对方一起看完《${f.title}》。说一句看完之后的第一反应，符合你的人设，不超过40字。只输出这句话。`;
      const t = await askChar(c, ask);
      if (t) pushComment(c, t.replace(/^["「]|["」]$/g, '').slice(0, 120), '');
    }
    afterWatch('end');
    await summarizeWatch(false);
    toast('看完了', '要不要让 TA 写篇观后感？在片库里点《' + f.title + '》的「✍️ 观后感」。');
  }

  // 💬 看完 / 散场之后，TA 像真人一样在私聊里再说两句（js/28 gyAfterActivity）。一场只触发一次。
  function afterWatch(reason) {
    try {
      const f = curFilm(); const cs = watchers();
      if (!f || !cs.length || typeof window.gyAfterActivity !== 'function') return;
      const key = f.id + '|' + (S.watch.t0 || 0);
      if (S.watch.afterKey === key) return;
      const mins = S.watch.t0 ? (Date.now() - S.watch.t0) / 60000 : 0;
      if (!(f.chat || []).length && mins < 3 && reason !== 'end') return;   // 刚拉进来就散了，不算一起看过
      S.watch.afterKey = key; save();
      const talk = (f.chat || []).slice(-16).map(m => `${m.name}：${m.text}`).join('\n');
      const summary = `一起看《${f.title}》${reason === 'end' ? '，整部看完了' : '，看到 ' + fmtT(video ? video.currentTime : (f.pos || 0)) + ' 就先散了'}。`
        + (talk ? `\n看的时候聊过的：\n${talk}` : '');
      cs.forEach(c => window.gyAfterActivity(c.id, '一起看电影', summary, { by: byOf(c.id), mins }));
    } catch (e) { console.warn('[一起看] 事后消息没发出去：', e); }
  }

  // 把这次一起看总结成一段记忆（跟音乐盒一个路子）
  async function summarizeWatch(manual) {
    const f = curFilm(); const cs = watchers();
    if (!f || !cs.length || !(f.chat || []).length) { if (manual) toast('还没什么可记的', '先一起看一会儿。'); return; }
    const log = (f.chat || []).slice(-40).map(m => `${m.name}：${m.text}`).join('\n');
    for (const c of cs) {
      const prev = (S.memory || {})[String(c.id)] || '';
      const ask = `下面是你和对方一起看《${f.title}》时说过的话。请用第二人称（"你……"）概括成一段简短记忆：你们一起看了什么、你当时说了什么、什么感觉。100字以内，只输出这段话。
${prev ? `\n【你之前记住的】\n${prev}\n（把新的并进去，太旧的可以省略）\n` : ''}
【这次】
${log}`;
      const t = await askChar(c, ask);
      if (t) { if (!S.memory) S.memory = {}; S.memory[String(c.id)] = t.slice(0, 400); }
    }
    await save();
    if (manual) toast('记住了', cs.map(c => c.name).join('、') + ' 会记得你们一起看过这部。');
  }
  window.fbSummarize = () => summarizeWatch(true);

  // 观后感 → 存进 char.filmNotes，聊天时角色会自然提起
  window.fbWriteNote = async function (filmId) {
    const f = S.films.find(x => x.id === filmId) || curFilm();
    const cs = watchers();
    if (!f) return;
    if (!cs.length) return toast('先选一起看的角色', '👥 一起看 里挑一个。');
    toast('正在写…', '让 TA 好好想想');
    for (const c of cs) {
      const mine = (f.comments || []).filter(x => String(x.charId) === String(c.id)).map(x => x.text).join('；');
      const talk = (f.chat || []).slice(-30).map(m => `${m.name}：${m.text}`).join('\n');
      const ask = `你和对方一起看完了《${f.title}》。结合你看的时候说过的话和你们的讨论，用第一人称写一篇观后感。
${mine ? '【你看的时候说过】' + mine + '\n' : ''}${talk ? '【你们的讨论】\n' + talk : ''}
150~250字，符合你的人设和语气，不要写成影评格式，就是你自己的感受。只输出正文。`;
      const t = await askChar(c, ask);
      if (!t) continue;
      if (!Array.isArray(c.filmNotes)) c.filmNotes = [];
      c.filmNotes.unshift({ id: 'fn' + Date.now().toString(36), filmTitle: f.title, content: t, at: Date.now() });
    }
    if (typeof saveAllData === 'function') saveAllData();
    toast('写好了', '在角色资料里能看到，以后聊天 TA 也会提起。');
  };

  // ================= 边看边聊 =================
  window.fbSend = async function () {
    const inp = document.getElementById('fbChatInput');
    if (!inp) return;
    const text = inp.value.trim();
    if (!text) return;
    const f = curFilm();
    if (!f) return toast('先打开一部片子', '');
    inp.value = '';
    if (!f.chat) f.chat = [];
    const atSec = video ? video.currentTime : 0;
    f.chat.push({ who: 'me', name: (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '我',
                  text: text, at: Date.now(), atSec: atSec });
    await save(); renderChat();

    const cs = watchers();
    if (!cs.length) return;
    const near = subsBetween(f, Math.max(0, atSec - 120), atSec, 600);
    const hist = (f.chat || []).slice(-10).map(m => `${m.name}：${m.text}`).join('\n');
    for (const c of cs) {
      const ask = `你在和对方一起看《${f.title}》，现在 ${fmtT(atSec)}。
${near ? '刚才这一段的台词：\n' + near + '\n' : ''}你们刚才的对话：
${hist}
对方刚说：「${text}」
回一句，像一边看片一边随口聊天那样，不超过50字。只输出这句话。`;
      const t = await askChar(c, ask);
      if (t) pushComment(c, t.replace(/^["「]|["」]$/g, '').slice(0, 150), '');
    }
  };

  function renderChat() {
    const box = document.getElementById('fbChatBody');
    const title = document.getElementById('fbChatTitle');
    if (!box) return;
    const f = curFilm();
    const cs = watchers();
    if (title) title.textContent = '💬 ' + (cs.length ? '和 ' + cs.map(c => c.name).join('、') + ' 边看边聊' : '边看边聊（还没选人）');
    if (!f || !(f.chat || []).length) {
      box.innerHTML = `<div style="color:#8a8a90;font-size:12.5px;text-align:center;padding:24px 8px;line-height:1.7;">
        ${cs.length ? '还没聊过。看到什么想说的直接打字。' : '先在「👥 一起看」里挑个人。'}</div>`;
      return;
    }
    box.innerHTML = (f.chat || []).slice(-60).map(m => `
      <div class="fb-msg ${m.who === 'me' ? 'me' : 'them'}">
        ${m.who === 'me' ? '' : `<div class="fb-msg-who">${esc(m.name)}</div>`}
        ${esc(m.text)}
        <div class="fb-msg-at">${fmtT(m.atSec || 0)}</div>
      </div>`).join('');
    box.scrollTop = box.scrollHeight;
  }

  // ================= 页面渲染 =================
  function paintAll() { paintHead(); paintCtrl(); paintBody(); paintMarks(); renderChat(); }

  function paintHead() {
    const w = document.getElementById('fbWrap');
    if (w) w.dataset.skin = S.skin || 'noir';
    const f = curFilm();
    const t = document.getElementById('fbTitle');
    const s = document.getElementById('fbSub');
    if (t) t.textContent = f ? f.title : '一起看电影';
    if (s) {
      const cs = watchers();
      s.textContent = f
        ? [ f.subs && f.subs.length ? `${f.subs.length} 行字幕` : '没字幕（纯陪看，不会评论）',
            cs.length ? '和 ' + cs.map(c => c.name).join('、') + ' 一起看' : '还没选一起看的人',
            (f.comments || []).length ? `${f.comments.length} 条评论` : '' ].filter(Boolean).join(' · ')
        : '还没有选片子';
    }
  }

  function paintBody() {
    const box = document.getElementById('fbBody');
    if (!box) return;
    const f = curFilm();
    box.innerHTML = `
      ${f ? `<div class="fb-nowline empty" id="fbNowLine">（这一段没有台词）</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
          <button type="button" class="fb-btn" onclick="fbImportSub()">💬 ${f.subs && f.subs.length ? '换字幕' : '导入字幕'}</button>
          <button type="button" class="fb-btn" onclick="fbGrabCover()">🖼️ 用这一帧当封面</button>
          <button type="button" class="fb-btn" onclick="fbWriteNote('${f.id}')">✍️ 观后感</button>
          <button type="button" class="fb-btn ghost" onclick="fbSummarize()">🧠 存进记忆</button>
        </div>` : ''}
      <div class="fb-sec-title">TA 说过的话</div>
      <div id="fbComments"></div>
      <div class="fb-sec-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span>片库</span>
        <input id="fbLibSearch" placeholder="搜片名…" oninput="fbSearchLib(this.value)"
               style="flex:1;min-width:110px;max-width:220px;background:var(--fb-panel);border:1px solid var(--fb-line);
                      color:var(--fb-ink);border-radius:999px;padding:5px 12px;font-size:12px;outline:none;letter-spacing:0;text-transform:none;">
        <button type="button" class="fb-btn" style="padding:4px 10px;" onclick="fbStep(-1)">◀ 上一部</button>
        <button type="button" class="fb-btn" style="padding:4px 10px;" onclick="fbStep(1)">下一部 ▶</button>
      </div>
      <div class="fb-grid" id="fbLibrary"></div>`;
    paintComments(); paintLibrary();
  }

  function paintComments() {
    const el = document.getElementById('fbComments');
    if (!el) return;
    const f = curFilm();
    const list = (f && f.comments) || [];
    if (!list.length) {
      el.innerHTML = `<div style="color:var(--fb-dim);font-size:13px;padding:10px 0;line-height:1.7;">
        还没有。${f && f.subs && f.subs.length ? '放着看一会儿，TA 觉得有意思才会开口——没意思就不说，不硬凑。' : '这部片子还没导字幕，TA 看不懂在演什么，只能纯陪看。'}</div>`;
      return;
    }
    el.innerHTML = list.map(c => `
      <div class="fb-cmt">
        <div class="fb-cmt-at" onclick="fbJump(${c.at})">${fmtT(c.at)}</div>
        <div class="fb-cmt-body">
          <div class="fb-cmt-who">${esc(c.name)}</div>
          ${c.quote ? `<div class="fb-cmt-quote">「${esc(c.quote)}」</div>` : ''}
          <div class="fb-cmt-text">${esc(c.text)}</div>
        </div>
      </div>`).join('');
  }
  window.fbJump = function (sec) { if (video) { video.currentTime = Math.max(0, sec - 3); lastSceneAt = video.currentTime; } };

  function paintLibrary() {
    const el = document.getElementById('fbLibrary');
    if (!el) return;
    if (!S.films.length) {
      el.innerHTML = `<div style="grid-column:1/-1;color:var(--fb-dim);font-size:13px;padding:8px 0;">还是空的。打开一部片子就会记在这儿。</div>`;
      return;
    }
    const list = libQuery ? S.films.filter(f => String(f.title).toLowerCase().includes(libQuery)) : S.films;
    if (!list.length) {
      el.innerHTML = `<div style="grid-column:1/-1;color:var(--fb-dim);font-size:13px;padding:8px 0;">没有叫这个名字的。</div>`;
      return;
    }
    el.innerHTML = list.map(f => {
      const pct = f.dur ? Math.min(100, (f.pos || 0) / f.dur * 100) : 0;
      return `<div class="fb-card ${f.id === S.cur ? 'on' : ''}" onclick="fbResume('${f.id}')" title="${esc(f.title)}">
        ${f.cover ? `<img class="fb-poster" src="${f.cover}" alt="">` : `<div class="fb-poster-none">🎞️</div>`}
        <div class="fb-prog"><i style="width:${pct}%"></i></div>
        <div class="fb-card-info">
          <div class="fb-card-name">${esc(f.title)}</div>
          <div class="fb-card-meta">${f.dur ? fmtT(f.pos || 0) + ' / ' + fmtT(f.dur) : '还没看过'}${(f.comments || []).length ? ' · ' + f.comments.length + ' 条' : ''}</div>
        </div>
      </div>`;
    }).join('');
  }

  // ================= 弹窗：一起看的人 / 设置 / 片库管理 =================
  function modal(id, html) {
    let m = document.getElementById(id);
    if (!m) { m = document.createElement('div'); m.id = id; m.className = 'modal-overlay'; document.body.appendChild(m); }
    m.innerHTML = html;
    m.style.display = 'flex';
    return m;
  }
  window.fbCloseModal = function (id) { const m = document.getElementById(id); if (m) m.style.display = 'none'; };

  window.fbOpenWatchers = function () {
    const cs = chars();
    const inList = watchers();
    modal('fbWatchersModal', `
      <div class="modal-box" style="width:440px;">
        <h2>👥 和谁一起看</h2>
        <div class="form-hint">点「邀请」会真的问一句，TA 按人设决定答不答应——不想看是可以拒绝的。
          可以同时拉好几个人，人多的时候一个说完另一个会自己决定要不要接话。
          一个人都没有 = 你自己安静看片，一次 API 都不调。</div>
        ${inList.length ? `<div style="font-size:12.5px;color:#536471;line-height:1.7;margin-top:10px;">
          现在和你一起看的是 <b>${esc(inList.map(c => c.name).join('、'))}</b>。
          <button type="button" class="btn-edit-small" style="color:#f91880;border-color:#f91880;margin-left:6px;" onclick="fbLeave()">结束这次一起看</button>
          <br><span style="color:#8b98a5;">结束时会先把这次聊的总结进 TA 的记忆。</span></div>` : ''}
        <div class="fb-modal-body" style="margin:14px 0;">
          ${cs.length ? cs.map(c => {
            const on = (S.watch.chars || []).map(String).includes(String(c.id));
            return `
            <div style="padding:10px 0;border-bottom:1px dashed #eff3f4;">
              <div style="display:flex;align-items:center;gap:8px;">
                <b style="flex:1;">${on ? '🎬 ' : ''}${esc(c.name)}</b>
                <button type="button" class="btn-edit-small ${on ? '' : ''}" onclick="fbInvite('${c.id}')">${on ? '在看（点这里请 TA 走）' : '邀请'}</button>
              </div>
              <div style="display:flex;gap:6px;margin-top:6px;">
                <input id="fbTaste_${c.id}" value="${esc((S.taste || {})[String(c.id)] || '')}"
                       placeholder="TA 的观影口味（一句话，会影响 TA 怎么看这部片子）"
                       style="flex:1;min-width:0;padding:6px 9px;border:1px solid #cfd9de;border-radius:6px;font-size:12.5px;">
                <button type="button" class="btn-edit-small" onclick="fbSaveTaste('${c.id}')">存</button>
                <button type="button" class="btn-edit-small" onclick="fbGenTaste('${c.id}')">✨ TA 自己写</button>
              </div>
            </div>`;
          }).join('') : '<div style="font-size:13px;color:#8b98a5;">还没有角色。</div>'}
        </div>
        <button type="button" class="btn-cancel" onclick="fbCloseModal('fbWatchersModal')">好了</button>
      </div>`);
  };
  // by：'me'＝你约的 TA（默认），'char'＝TA 约的你（从 TA 发来的邀请卡进来）
  window.fbToggleWatcher = function (id, on, by) {
    const a = (S.watch.chars || []).map(String);
    if (!S.watch.by) S.watch.by = {};
    if (on) {
      if (!a.length) S.watch.t0 = Date.now();             // 这一场从现在算
      if (!a.includes(String(id)) || by) S.watch.by[String(id)] = by === 'char' ? 'char' : 'me';
    } else delete S.watch.by[String(id)];
    S.watch.chars = on ? Array.from(new Set(a.concat([String(id)]))) : a.filter(x => x !== String(id));
    save(); paintHead(); renderChat();
  };
  window.fbGenTaste = async function (id) {
    const c = charById(id);
    if (!c) return;
    const t = await askChar(c, '用一句话说说你平时爱看什么电影、看片时是什么样的人（会不会说话、爱不爱剧透、看到哪种镜头会走神）。不超过30字，只输出这句话。');
    if (t) { if (!S.taste) S.taste = {}; S.taste[String(id)] = t.replace(/^["「]|["」]$/g, '').slice(0, 60); save(); fbOpenWatchers(); }
  };

  window.fbOpenSettings = function () {
    const w = S.watch;
    const on = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : true;
    modal('fbSetModal', `
      <div class="modal-box" style="width:430px;">
        <h2>⚙️ 一起看的设置</h2>
        <div class="fb-modal-body">
          ${(typeof gyReqBox === 'function') ? gyReqBox([{ api: true },
              { ok: (S.watch.chars || []).length > 0, text: '还没邀请任何角色一起看', jump: 'fbOpenWatchers()', go: '去邀请' },
              { ok: !!curFilm(), text: '还没打开片子', jump: 'fbPickVideo()', go: '去选片' }
          ], { title: 'TA 要开口说话，得先满足这些' }) : ''}
          <div class="fb-field">皮肤</div>
          <div>${SKINS.map(s => `<span class="fb-chip ${S.skin === s.k ? 'on' : ''}" onclick="fbSetSkin('${s.k}')" title="${esc(s.desc)}">${s.name}</span>`).join('')}</div>

          <div class="fb-field">TA 什么时候说话（这几项决定花多少钱）</div>
          <div style="font-size:11.5px;color:#8b98a5;line-height:1.7;margin-bottom:6px;">
            这三个跟「设置 → 🔌 自动功能开关 → 📺 一起看/一起读」里的<b>是同一个开关</b>，在哪儿点都一样。</div>
          <label class="fb-row" style="cursor:pointer;"><input type="checkbox" ${on('filmScene') ? 'checked' : ''} onchange="fbSetAuto('filmScene',this.checked)" style="width:16px;height:16px;">
            <span style="flex:1;"><b>看到有想法的地方自己开口</b><br><span style="font-size:11.5px;color:#8b98a5;">每隔一段把这段字幕给 TA 看一眼，有感触才说。没字幕的片子不会触发。<b>这是主要开销</b>。</span></span></label>
          <div class="fb-row"><span style="font-size:13px;flex:1;">隔几分钟看一段</span>
            <input type="number" value="${w.sceneMin}" onchange="fbSet('sceneMin',gyNum(this.value,5))" style="width:70px;padding:5px 8px;border:1px solid #cfd9de;border-radius:6px;">
            <span style="font-size:12px;color:#8b98a5;">分钟</span></div>
          <label class="fb-row" style="cursor:pointer;"><input type="checkbox" ${on('filmPause') ? 'checked' : ''} onchange="fbSetAuto('filmPause',this.checked)" style="width:16px;height:16px;">
            <span style="flex:1;"><b>你一暂停 TA 接一句</b><br><span style="font-size:11.5px;color:#8b98a5;">每次暂停一次调用。</span></span></label>
          <label class="fb-row" style="cursor:pointer;"><input type="checkbox" ${on('filmEnd') ? 'checked' : ''} onchange="fbSetAuto('filmEnd',this.checked)" style="width:16px;height:16px;">
            <span style="flex:1;"><b>看完给个感想</b></span></label>

          <div class="fb-field">弹幕（全屏时）</div>
          <label class="fb-row" style="cursor:pointer;"><input type="checkbox" ${w.danmu ? 'checked' : ''} onchange="fbSet('danmu',this.checked)" style="width:16px;height:16px;">
            <span style="flex:1;"><b>全屏时 TA 的话走弹幕</b><br><span style="font-size:11.5px;color:#8b98a5;">关掉就只记在下面的列表里，不飘。</span></span></label>
          <div class="fb-row"><span style="font-size:13px;flex:1;">速度</span>
            <input type="range" min="0.5" max="2" step="0.1" value="${w.danmuSpeed}" oninput="fbSet('danmuSpeed',+this.value)" style="flex:1;"></div>
          <div class="fb-row"><span style="font-size:13px;flex:1;">字号</span>
            <input type="range" min="11" max="26" step="1" value="${w.danmuSize}" oninput="fbSet('danmuSize',+this.value)" style="flex:1;"></div>
          <div class="fb-row" style="border:0;"><span style="font-size:13px;flex:1;">不透明度</span>
            <input type="range" min="0.3" max="1" step="0.05" value="${w.danmuOpacity}" oninput="fbSet('danmuOpacity',+this.value)" style="flex:1;"></div>

          <div class="fb-field">一起看了多久</div>
          <div style="font-size:13px;line-height:1.9;">
            总共 <b>${fmtDur((S.stats && S.stats.total.ms) || 0)}</b>，${(S.stats && S.stats.total.films) || 0} 部片子。
            ${chars().filter(c => (S.stats.byChar || {})[String(c.id)]).map(c => {
              const d = S.stats.byChar[String(c.id)];
              return `<div style="font-size:12.5px;color:#536471;">· 和 <b>${esc(c.name)}</b>：${fmtDur(d.ms)}，${d.films || 0} 部</div>`;
            }).join('')}
            <button type="button" class="btn-edit-small" style="margin-top:6px;" onclick="fbResetStats()">清零统计</button>
          </div>
          ${Object.keys(S.memory || {}).length ? `<div class="fb-field">TA 记住的</div>
            ${chars().filter(c => (S.memory || {})[String(c.id)]).map(c => `
              <div style="font-size:12.5px;color:#536471;line-height:1.7;padding:6px 0;border-bottom:1px dashed #eff3f4;">
                <b style="color:#1d9bf0;">${esc(c.name)}</b>：${esc(S.memory[String(c.id)])}
                <button type="button" class="btn-edit-small" onclick="fbForget('${c.id}')">忘掉</button></div>`).join('')}` : ''}
        </div>
        <button type="button" class="btn-cancel" onclick="fbCloseModal('fbSetModal')">关闭</button>
      </div>`);
  };
  // 这三项走全局开关表（跟「自动功能开关」页里是同一个），别在这儿另存一份
  window.fbSetAuto = function (k, v) {
    if (typeof setAutoFeature === 'function') setAutoFeature(k, v);
    fbOpenSettings();
  };
  window.fbSet = function (k, v) { S.watch[k] = v; save(); if (k === 'sceneMin') lastSceneAt = video ? video.currentTime : -1; };
  window.fbGet = k => (S.watch || {})[k]; // 🎛️ 给「全部开关」页读（js/54）
  window.fbSetSkin = function (k) { S.skin = k; save(); paintHead(); fbOpenSettings(); };
  // 记忆总览（js/65）用：读 / 改 / 删「一起看的记忆」
  window.fbMemGet = id => ((S.memory || {})[String(id)] || '');
  window.fbMemSet = function (id, v) { S.memory = S.memory || {}; v = String(v || '').trim(); if (v) S.memory[String(id)] = v; else delete S.memory[String(id)]; save(); };
  window.fbForget = function (id) { if (S.memory) delete S.memory[String(id)]; save(); fbOpenSettings(); };

  window.fbOpenLibrary = function () {
    modal('fbLibModal', `
      <div class="modal-box" style="width:440px;">
        <h2>🎞️ 片库</h2>
        <div class="form-hint">视频文件本身没有存进来，这里记的是片名、封面、字幕、进度和说过的话。删掉只删这些记录，不动你的文件。</div>
        <div class="fb-modal-body" style="margin:14px 0;">
          ${S.films.length ? S.films.map(f => `
            <div class="fb-row">
              <b style="flex:1;min-width:0;word-break:break-all;">${esc(f.title)}</b>
              <span style="font-size:11.5px;color:#8b98a5;">${f.dur ? fmtT(f.pos || 0) + '/' + fmtT(f.dur) : '未看'}</span>
              <button type="button" class="btn-edit-small" onclick="fbRename('${f.id}')">改名</button>
              <button type="button" class="btn-edit-small" onclick="fbCloseModal('fbLibModal');fbResume('${f.id}')">接着看</button>
              <button type="button" class="btn-edit-small" style="color:#f91880;border-color:#f91880;" onclick="fbDelFilm('${f.id}')">删</button>
            </div>`).join('') : '<div style="font-size:13px;color:#8b98a5;">还是空的。</div>'}
        </div>
        <button type="button" class="btn-cancel" onclick="fbCloseModal('fbLibModal')">关闭</button>
      </div>`);
  };
  window.fbRename = async function (id) {
    const f = S.films.find(x => x.id === id); if (!f) return;
    const n = (typeof appPrompt === 'function') ? await appPrompt('改成什么名字？', f.title) : prompt('改成什么名字？', f.title);
    if (n && n.trim()) { f.title = n.trim(); await save(); paintAll(); fbOpenLibrary(); }
  };
  window.fbDelFilm = async function (id) {
    const f = S.films.find(x => x.id === id); if (!f) return;
    const ok = (typeof appConfirm === 'function') ? await appConfirm(`删掉《${f.title}》的记录？\n\n字幕、进度、TA 说过的话都会没。视频文件本身不受影响。`) : confirm('删掉？');
    if (!ok) return;
    S.films = S.films.filter(x => x.id !== id);
    delete fileHandles[id]; saveHandles();
    if (S.cur === id) { S.cur = null; if (video) { video.pause(); video.removeAttribute('src'); video.load(); } }
    await save(); paintAll(); fbOpenLibrary();
  };

  // ================= 跟音乐盒对齐的那几件事 =================
  // 音乐盒有的，这边都得有：邀请 / 结束 / 主动问一句 / 让 TA 挑片 / 多人接话 /
  // 口味手动编辑 / 重置统计 / 上一部下一部 / 搜片库。

  const tasteOf = c => (S.taste || {})[String(c.id)] ? `\n【TA 的观影口味】${S.taste[String(c.id)]}` : '';
  const chatSoFar = () => {
    const f = curFilm();
    return ((f && f.chat) || []).slice(-8).map(m => `${m.name}：${m.text}`).join('\n') || '（还没聊过）';
  };

  // —— 邀请：不是打个勾就完事，TA 会按人设决定答不答应 ——
  window.fbInvite = async function (id) {
    const c = charById(id);
    if (!c) return;
    const already = (S.watch.chars || []).map(String).includes(String(id));
    if (already) return fbToggleWatcher(id, false);   // 已经在看了就是"请TA走"
    const f = curFilm();

    // 📨 v105：邀请发成私聊里的一张卡（js/28），不再是后台偷偷问一句 + 一个八秒就没的 toast。
    //    答应了卡片直接变成"进放映厅"的入口，拒绝了卡片上留着 TA 那句话。
    if (typeof window.gyInviteSend === 'function') {
      await window.gyInviteSend({
        char: c, kind: 'film',
        title: f ? f.title : '',
        filmId: f ? f.id : '',
        sub: tasteOf(c) ? '' : '',
        ask: `对方想邀请你一起看${f ? `《${f.title}》` : '一部电影'}。
${tasteOf(c)}
按你的人设决定答不答应——不想看、没心情、正忙都可以拒绝，不用勉强自己。
只输出严格 JSON，不要 markdown：{"ok": true或false, "line": "你的回答，一句话，不超过30字"}`,
        onYes: (r) => {
          fbToggleWatcher(id, true, 'me');
          if (f) { if (!f.chat) f.chat = []; f.chat.push({ who: 'char', name: c.name, text: r.line || '好啊。', at: Date.now(), atSec: video ? video.currentTime : 0 }); }
          save(); renderChat();
          if (document.getElementById('fbWatchersModal')) fbOpenWatchers();
        },
        onNo: () => { if (document.getElementById('fbWatchersModal')) fbOpenWatchers(); }
      });
      return;
    }

    // 兜底：js/28 没加载时还按老路走
    toast('问问 TA…', `看看${c.name}想不想一起看`);
    const ask = `对方想邀请你一起看${f ? `《${f.title}》` : '一部电影'}。
${tasteOf(c)}
按你的人设决定答不答应——不想看、没心情、正忙都可以拒绝，不用勉强自己。
只输出严格 JSON，不要 markdown：{"yes": true或false, "text": "你的回答，一句话，不超过30字"}`;
    const raw = await askChar(c, ask);
    const p = (typeof extractJsonObject === 'function') ? extractJsonObject(raw) : null;
    const yes = p ? !!p.yes : true;
    const line = (p && p.text) || (yes ? '好啊。' : '现在不太想看。');
    if (yes) {
      fbToggleWatcher(id, true);
      if (f) { if (!f.chat) f.chat = []; f.chat.push({ who: 'char', name: c.name, text: line, at: Date.now(), atSec: video ? video.currentTime : 0 }); }
      await save(); renderChat();
      toast(c.name + ' 来了', line);
    } else { toast(c.name + ' 这次不看', line); }
    if (document.getElementById('fbWatchersModal')) fbOpenWatchers();
  };

  // —— 结束这次一起看（先存进记忆）——
  window.fbLeave = async function () {
    const cs = watchers();
    const f = curFilm();
    afterWatch('leave');                                  // 先把"刚才聊了什么"交给事后那条消息（下面会清掉）
    if (cs.length && f && (f.chat || []).length >= 4) await summarizeWatch(false);
    S.watch.chars = []; S.watch.by = {}; S.watch.t0 = 0;
    if (f) f.chat = [];
    await save(); paintHead(); renderChat();
    if (document.getElementById('fbWatchersModal')) fbOpenWatchers();
    toast('结束了这次一起看', '刚才聊的已经总结进 TA 的记忆里了。');
  };

  // —— 主动问 TA 一句 ——
  window.fbAskNow = async function () {
    const cs = watchers();
    if (!cs.length) return toast('还没人一起看', '先在「👥 一起看」里邀请一个角色。');
    const f = curFilm();
    const c = cs[Math.floor(Math.random() * cs.length)];
    const near = f ? subsBetween(f, Math.max(0, (video ? video.currentTime : 0) - 120), video ? video.currentTime : 0, 500) : '';
    const said = await askChar(c, `你在和对方一起看${f ? `《${f.title}》` : '电影'}${video ? '，现在 ' + fmtT(video.currentTime) : ''}。
${near ? '刚才这一段的台词：\n' + near + '\n' : ''}${tasteOf(c)}
对方想听你说点什么。随口说一句，像看片时突然开口那样，不超过40字。只输出这句话。`);
    if (said) { pushComment(c, said.replace(/^["「]|["」]$/g, '').slice(0, 120), ''); await secondVoice(c, said); }
  };

  // —— 让 TA 从片库里挑一部 ——
  window.fbAskPick = async function () {
    const cs = watchers();
    if (!cs.length) return toast('还没人一起看', '先邀请一个角色。');
    if (S.films.length < 2) return toast('片库里片子太少', '至少有两部才好意思让 TA 挑。');
    const c = cs[Math.floor(Math.random() * cs.length)];
    const menu = S.films.map((f, i) => `${i + 1}. ${f.title}`).join('\n');
    const raw = await askChar(c, `你正在和对方一起看电影，现在轮到你挑一部。

【片库里有】
${menu}
${tasteOf(c)}

【你们刚才聊的】
${chatSoFar()}

挑一部你现在想看的，说一句为什么（20~40字，口语，像随口说的）。
只输出严格 JSON，不要 markdown：{"n": 序号数字, "why": "为什么想看这部"}`);
    const p = (typeof extractJsonObject === 'function') ? extractJsonObject(raw) : null;
    const n = p && +p.n;
    if (!n || n < 1 || n > S.films.length) return toast('TA 没挑出来', '再试一次？');
    const f = S.films[n - 1];
    toast(c.name + ' 想看《' + f.title + '》', (p && p.why) || '');
    if (f.id !== S.cur) fbResume(f.id);
  };

  // —— 多人一起看时，第二个人接不接话交给 TA 自己按人设决定 ——
  async function secondVoice(firstChar, said) {
    const cs = watchers().filter(x => String(x.id) !== String(firstChar.id));
    if (!cs.length || !said) return;
    const c2 = cs[Math.floor(Math.random() * cs.length)];
    const raw = await askChar(c2, `你们几个在一起看电影。${firstChar.name}刚说：「${said}」
你想接话就接一句（不超过30字），不想接就只输出 NO 两个字母。按你的人设来，不用硬聊。
只输出这句话或 NO。`);
    const t = (raw || '').trim();
    if (t && t.toUpperCase() !== 'NO' && t.length < 80) pushComment(c2, t.replace(/^["「]|["」]$/g, ''), '');
  }

  // —— 口味：手动写 / 让 TA 自己写 ——
  window.fbSaveTaste = function (id) {
    const el = document.getElementById('fbTaste_' + id);
    if (!el) return;
    if (!S.taste) S.taste = {};
    S.taste[String(id)] = el.value.trim();
    save(); toast('存好了', '');
  };

  // —— 重置统计 ——
  window.fbResetStats = async function () {
    const ok = (typeof appConfirm === 'function') ? await appConfirm('把"一起看了多久"的统计清零？\n\n片库、评论、记忆都不受影响。') : confirm('清零？');
    if (!ok) return;
    S.stats = { total: { ms: 0, films: 0 }, byChar: {} };
    await save(); fbOpenSettings();
  };

  // —— 上一部 / 下一部 ——
  window.fbStep = function (d) {
    if (!S.films.length) return;
    let i = S.films.findIndex(f => f.id === S.cur);
    if (i < 0) i = 0;
    const n = (i + d + S.films.length) % S.films.length;
    fbResume(S.films[n].id);
  };

  // —— 片库搜索 ——（libQuery 声明在文件顶部，paintLibrary 要用）
  window.fbSearchLib = function (v) { libQuery = String(v || '').trim().toLowerCase(); paintLibrary(); };

  // ================= 记忆注入 =================
  // 一起看的记忆 + 写过的观后感，跟音乐盒/一起阅读一样喂回 prompt
  window.getFilmPrompt = function (char) {
    try {
      if (!char) return '';
      let out = '';
      const m = (S.memory || {})[String(char.id)];
      if (m) {
        out += '\n【你和对方一起看过的电影】：' + m;
        const f = curFilm();
        if (f && (S.watch.chars || []).map(String).includes(String(char.id)) && video && !video.paused) {
          out += `\n【你此刻正在和对方一起看】《${f.title}》，看到 ${fmtT(video.currentTime)}。`;
        }
        out += '\n';
      }
      if (Array.isArray(char.filmNotes) && char.filmNotes.length) {
        out += '\n【你写过的观后感，聊天时如果合适可以自然提起，不用每次都提】：\n'
             + char.filmNotes.slice(0, 2).map(n => `《${n.filmTitle || '一部电影'}》：${String(n.content || '').slice(0, 80)}……`).join('\n') + '\n';
      }
      return out;
    } catch (e) { return ''; }
  };

  // ================= 接入 app =================
  function openView() {
    mountView();
    if (typeof switchMainView === 'function') switchMainView('watchTogether');
    paintAll();
    if (S.watch.chatOpen) { const b = document.getElementById('fbChat'); if (b) { b.classList.add('on'); applyChatBoxGeom(); renderChat(); } }
  }
  window.fbOpenView = openView;
  // 核心切到这一页时回调（js/07 的 watchTogether 分支里调）
  window.fbOnEnterView = function () {
    paintAll();
    if (S.watch.chatOpen) { const b = document.getElementById('fbChat'); if (b) { b.classList.add('on'); applyChatBoxGeom(); renderChat(); } }
  };

  (async function init() {
    await load();
    mountView();
    if (typeof registerMiniFeature === 'function') {
      registerMiniFeature({
        id: 'watch_together', icon: '🎬', title: '一起看电影',
        desc: '打开本地视频，选个角色一起看。全屏时 TA 的话变成弹幕飘过去',
        onOpen: openView
      });
    }
    // 手机顶栏标题
    try { if (typeof mobileViewTitles !== 'undefined') mobileViewTitles.watchTogether = '一起看电影'; } catch (e) {}
    // 显示/隐藏这一页交给核心的 switchMainView（js/07 里有正式分支，也进了 hideAllViews 的名单）。
    // ⚠️ 别再回去 patch switchMainView：核心末尾有一段"谁都没显示就退回主页"的兜底，
    //    patch 是在原函数返回之后才显示页面的，那时候兜底已经把主页放出来了，
    //    结果主页时间线和播放器叠在一起（截图里真出现过）。
    //    这里只留"离开这一页要做的事"，由核心分支之外的 hideAllViews 之后统一触发。
    const sw0 = window.switchMainView;
    if (typeof sw0 === 'function' && !sw0.__fbLeaveHook) {
      window.switchMainView = function (viewId) {
        if (viewId !== 'watchTogether') {
          try {
            if (video && !video.paused) video.pause();   // 别让声音在后台一直响
            const cb = document.getElementById('fbChat');
            if (cb) cb.classList.remove('on');
          } catch (e) {}
        }
        return sw0.apply(this, arguments);
      };
      window.switchMainView.__fbLeaveHook = true;
    }
    console.info('[一起看电影] 已加载。入口：设置 → 🧩 小功能 → 一起看电影');
  })();
})();
