/* =====================================================================
   js/24 —— 💗 关系账本 + 🗣️ 八卦网
   原来是插件（白露关系账本插件.json / 白露八卦网插件.json），v97 起内置。装过旧插件的可以在「🔌 插件」页删掉。

   ⚠️ 每个各自一个 IIFE，别合并：它们之间有同名的顶层符号。
   ⚠️ 原插件的 `code` 钩子（每次拼 prompt 都跑）内置之后改成统一由
      js/06 的 getBoxPrompt() 调用各自暴露的 window.__gyXxxCtxFor；
      关系账本的 `onResponse` 钩子改由 js/02 的 runBoxResponseHooks() 调用。
   ===================================================================== */

// ============ 关系账本 ============
/* ===========================================================================
   💗 白露关系账本 —— 好感度不再是一个没来由的数字，是一本带原因的流水账
   ---------------------------------------------------------------------------
   以前的好感度：一个数字，涨了跌了都不知道为什么，角色也用不上它。
   这里换成一本账：每一笔都有「什么时候、加减多少、因为什么事」，
   注进 prompt 的不是数字，是那几件事本身——角色说「你上次那样我记着呢」
   的时候，是真的有那条记录，不是模型顺口编的。

   钱从哪来（三个来源，都不额外调 API）：
     · 跟着「情绪惯性」走（推荐）：v87 那个开关每轮回复已经带出 mood/moodWhy 了，
       这边只是把它记进账本。零成本。
     · 让模型单独给（可选）：每轮多要两个字段 rel/relWhy。会明确限定"只有聊天那一轮才给"，
       写推文/日记/信件的时候不要加，免得数字混进正文。
     · 事件自动记账：读音乐盒和行程插件的存档——一起听了多久、一起去过哪儿、
       约了被拒过几次，都自动折成分数。纯本地读，不花钱。
   还能手动加一笔。

   ⚠️ 主程序里那个 enableAffinitySystem / char.affinity（关系网上的 💗 徽章和线粗细）
      会被这个插件接管并同步，所以关系网那边也会跟着动。
   =========================================================================== */
(function () {
    if (window.__gyRelLoaded) { try { gyrelOpen(); } catch (e) {} return; }
    window.__gyRelLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyRelBox', 'ledger')          // 带兜底的存档口：localforage 用不了就退 localStorage，两条都断才报错
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyRelBox', storeName: 'ledger' })
            : null);
    const KEY = 'gyRel_state';

    const DEF_STAGES = [
        { at: -100, name: '恨' }, { at: -60, name: '厌恶' }, { at: -25, name: '反感' },
        { at: -8, name: '冷淡' }, { at: 0, name: '陌生' }, { at: 12, name: '眼熟' },
        { at: 30, name: '朋友' }, { at: 55, name: '在意' }, { at: 80, name: '很重要' }
    ];

    let S = {
        led: {},            // { 角色id: [{id, at, d, why, src}] }
        keep: 0,            // 每个角色最多留多少条，0 ＝ 不限
        inject: 6,          // 注进 prompt 的最近几条原因
        fromMood: true,     // 跟着「情绪惯性」记账（零成本）
        askModel: false,    // 让模型每轮单独给 rel/relWhy
        fromEvents: true,   // 从音乐盒 / 行程插件的记录里自动记账
        syncAffinity: true, // 同步到主程序的 char.affinity + 关系网
        showNumber: false,  // 注进 prompt 时要不要把分数报给角色（默认不报，只给阶段和事）
        stages: null,
        seen: {},           // 事件去重
        seenMood: {},       // { 角色id: 上次记过的 mood.at }
        base: {}            // { 角色id: 基准分 } —— 用户直接把好感度设成某个数时存这儿
    };

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const uid = p => (p || 'r') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const stages = () => (Array.isArray(S.stages) && S.stages.length) ? S.stages.slice().sort((a, b) => a.at - b.at) : DEF_STAGES;
    const uname = c => (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';

    async function save() { if (LF) { try { await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) { console.warn('[关系账本] 存档失败', e); } } }
    async function load() {
        if (LF) { try { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } catch (e) {} }
        if (!Array.isArray(S.stages) || !S.stages.length) S.stages = DEF_STAGES.map(x => Object.assign({}, x));
        if (!S.led || typeof S.led !== 'object') S.led = {};
        if (!S.seen) S.seen = {};
        if (!S.seenMood) S.seenMood = {};
        if (!S.base || typeof S.base !== 'object') S.base = {};
    }

    // ---------- 账本本身 ----------
    function book(id) { const k = String(id); if (!Array.isArray(S.led[k])) S.led[k] = []; return S.led[k]; }
    // 总分 = 你直接设定的基准分 + 账本上每一笔的加减。
    // 分成两截是为了让"自定义好感度"和"流水账"不打架：你把它设成 60 之后，
    // 后面自动记的那些笔照样在 60 上面加加减减，而不是把你设的数字冲掉。
    function baseOf(id) { const v = parseFloat(S.base[String(id)]); return isNaN(v) ? 0 : v; }
    function score(id) {
        const t = baseOf(id) + book(id).reduce((a, e) => a + (parseFloat(e.d) || 0), 0);
        // 不再夹在 −100 ~ 100 里：你想设 500 就是 500（进度条那边自己封了宽度，不会画爆）
        return Math.round(t * 10) / 10;
    }
    // 直接把某个角色的好感度设成一个数（账本一笔都不动）
    window.gyrelSetScore = async function (charId, v) {
        const el = document.getElementById('gyrelScore' + charId);
        const raw = (v !== undefined && v !== null) ? v : (el ? el.value : '');
        const n = parseFloat(raw);
        if (isNaN(n)) return;
        const target = Math.round(n * 10) / 10;   // 不设上下限
        const sum = book(charId).reduce((a, e) => a + (parseFloat(e.d) || 0), 0);
        S.base[String(charId)] = Math.round((target - sum) * 10) / 10;
        syncOne(charId);
        await save();
        try { renderPanel(); renderMemHub(); } catch (e) {}
    };
    window.gyrelResetScore = async function (charId) {
        delete S.base[String(charId)];
        syncOne(charId);
        await save();
        try { renderPanel(); renderMemHub(); } catch (e) {}
    };
    function stageOf(sc) {
        const list = stages();
        let cur = list[0];
        list.forEach(s => { if (sc >= s.at) cur = s; });
        return cur ? cur.name : '陌生';
    }
    async function add(charId, d, why, src) {
        const v = parseFloat(d);
        if (isNaN(v) || v === 0) return null;
        const b = book(charId);
        const e = { id: uid(), at: Date.now(), d: Math.round(v * 10) / 10, why: String(why || ''), src: src || '手动' };   // 一笔加减多少不封顶、原因不截字
        b.push(e);
        const keep = parseInt(S.keep) || 0;
        if (keep > 0 && b.length > keep) b.splice(0, b.length - keep);
        syncOne(charId);
        await save();
        try { renderPanel(); renderMemHub(); } catch (x) {}
        return e;
    }
    // 对外：别的插件/脚本可以直接记一笔
    window.gyRel = {
        add: (charId, d, why, src) => add(charId, d, why, src || '外部'),
        score, stage: id => stageOf(score(id)),
        book: id => book(id).slice()
    };

    // 跟主程序的好感度系统对上，关系网那边的 💗 徽章和线粗细就会跟着动
    //
    // ⚠️ enableAffinitySystem 是主程序里的顶层 let，不是 window 上的属性——
    //    直接写 window.enableAffinitySystem 会新建一个同名属性，而读裸标识符的地方
    //    （关系网画徽章那儿）还是看的 let，等于白设。间接 eval 跑在全局作用域里，
    //    能真正赋到那个 let 上。插件系统本来就靠 new Function 跑，eval 的可用性是一样的。
    function turnOnMainAffinity() {
        try {
            if (typeof enableAffinitySystem !== 'undefined' && enableAffinitySystem) return;
            (0, eval)('enableAffinitySystem = true');
            const box = document.getElementById('enableAffinitySystem');
            if (box) box.checked = true;
        } catch (e) { console.warn('[关系账本] 打不开主程序的好感度开关：', e); }
    }
    // 关系网那三页哪一页开着就重画哪一页，不然要退出去再进来才看得到新数字。
    // （势力总览 / 某个势力的成员 / 某个角色的关系图，💗 在后两页上）
    const shown = id => { const v = document.getElementById(id); return v && v.style.display !== 'none'; };
    function repaintNetwork() {
        try {
            if (shown('view-faction-network')) {
                if (typeof renderFactionNetworkGrid === 'function') renderFactionNetworkGrid();
                if (typeof renderFactionOverviewList === 'function') renderFactionOverviewList();
            }
            if (shown('view-faction-members') && typeof renderFactionMembersGrid === 'function'
                && typeof currentRelationsFactionName !== 'undefined' && currentRelationsFactionName) {
                renderFactionMembersGrid(currentRelationsFactionName);
            }
            if (shown('view-char-relations') && typeof renderCharRelationsView === 'function'
                && typeof currentRelationCharId !== 'undefined' && currentRelationCharId) {
                renderCharRelationsView(currentRelationCharId);
            }
        } catch (e) {}
    }
    /* v108 修：syncOne 以前只把数字写进内存里的 c.affinity，
       ①不打开 enableAffinitySystem（关系网靠它决定画不画 💗，不开就等于没同步）
       ②不调 saveAllData（刷新一下就回到旧值）
       ③不重画关系网（那一页开着的话看不到变化）
       ——所以"账本里改了数，关系网纹丝不动"。现在三件一起做。 */
    function syncOne(charId) {
        if (!S.syncAffinity) return;
        const c = chars().find(x => String(x.id) === String(charId));
        if (!c) return;
        turnOnMainAffinity();
        c.affinity = score(charId);
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        repaintNetwork();
    }
    // syncAll 会被频繁调用（每次切页），所以先比一遍，真有变化才写、才存。
    //
    // ⚠️ 还有一个时序坑：本模块的 init 在脚本加载时就跑了，那时 loadAllData() 还没执行，
    //    myCharacters 是空的，而且紧接着 loadAllData 会把 enableAffinitySystem 从存档里
    //    读回 false，把这里刚打开的开关又盖掉。所以光在 init 里同步一次是不够的，
    //    必须在切页时再对一遍——尤其是进「关系网」那一页之前。
    function syncAll() {
        if (!S.syncAffinity) return;
        const list = chars();
        if (!list.length) return;
        let changed = false;
        list.forEach(c => { const v = score(c.id); if (c.affinity !== v) { c.affinity = v; changed = true; } });
        if (typeof enableAffinitySystem === 'undefined' || !enableAffinitySystem) { turnOnMainAffinity(); changed = true; }
        if (!changed) return;
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        repaintNetwork();
    }

    // ---------- 来源①：跟着「情绪惯性」走（零成本）----------
    // v87 的 aliveMood 每轮回复已经把 mood/moodWhy 存在 char.mood 上了，
    // 这里只是盯着它变没变，变了就记一笔。不多发一个字。
    function scanMood() {
        if (!S.fromMood) return;
        chars().forEach(c => {
            const m = c.mood;
            if (!m || !m.at) return;
            const k = String(c.id);
            if (S.seenMood[k] === m.at) return;
            const first = S.seenMood[k] === undefined;
            S.seenMood[k] = m.at;
            if (first) return;                  // 第一次见到就只记下时间，不补历史
            const v = parseFloat(m.v);
            if (isNaN(v) || Math.abs(v) < 0.8) return;
            // 情绪是 -5~5，折成账本的 -2.5~2.5：单轮聊天不该一下子改变关系
            add(c.id, v / 2, m.why || '聊天里的一来一回', '聊天');
        });
    }

    // ---------- 来源②：音乐盒 / 行程插件的记录 ----------
    async function scanEvents() {
        if (!S.fromEvents || typeof localforage === 'undefined') return;
        // 一起出去过的地方
        try {
            const st = await localforage.createInstance({ name: 'gyMapBox', storeName: 'maps' }).getItem('gyMap_state');
            (st && st.date && st.date.logs || []).forEach(l => {
                const k = 'd:' + l.id;
                if (S.seen[k]) return;
                S.seen[k] = 1;
                if (l.ok) add(l.charId, l.mins >= 120 ? 4 : 2.5, `一起去了${l.spot}${l.act ? '，' + l.act : ''}`, '一起出去');
                else add(l.charId, -1.5, `约${l.spot}没约成`, '一起出去');
            });
        } catch (e) {}
        // 一起听歌的时长：每满一小时记一笔
        try {
            const st = await localforage.createInstance({ name: 'gyMusicBox', storeName: 'tracks' }).getItem('gyMusic_state');
            const per = (st && st.stats && (st.stats.per || st.stats.byChar)) || {};
            Object.keys(per).forEach(cid => {
                const ms = (typeof per[cid] === 'number') ? per[cid] : (per[cid] && per[cid].ms) || 0;
                const hrs = Math.floor(ms / 3600000);
                for (let h = 1; h <= hrs; h++) {
                    const k = 'm:' + cid + ':' + h;
                    if (S.seen[k]) continue;
                    S.seen[k] = 1;
                    add(cid, 1, `一起听歌满 ${h} 小时`, '一起听');
                }
            });
        } catch (e) {}
        await save();
    }

    // ---------- 注进 prompt ----------
    const ledgerOn = () => (typeof isAutoOn === 'function') ? isAutoOn('relLedger') : true;

    window.__gyRelCtxFor = function (charId) {
        try {
            if (!ledgerOn()) return '';          // 🔌 总开关关了：一个字都不注入
            const c = chars().find(x => String(x.id) === String(charId));
            if (!c) return '';
            const b = book(charId);
            const sc = score(charId);
            if (!b.length && sc === 0) return '';
            const n = Math.max(0, Math.round(gyNum(S.inject, 6)));
            const recent = b.slice(-n).reverse();
            const day = t => { const x = new Date(t); const d = Math.floor((Date.now() - t) / 86400000);
                return d <= 0 ? '今天' : d === 1 ? '昨天' : d < 30 ? d + ' 天前' : `${x.getMonth() + 1}月${x.getDate()}日`; };
            let out = `\n【你对${uname(c)}的感觉】：现在是「${stageOf(sc)}」${S.showNumber ? `（${sc > 0 ? '+' : ''}${sc}）` : ''}。`;
            if (recent.length) {
                out += `\n最近让它变成这样的事：\n` + recent.map(e =>
                    `· ${day(e.at)}　${e.d > 0 ? '拉近了一点' : '推远了一点'}　${e.why || '（没记原因）'}`).join('\n');
            }
            out += `\n这不是让你报数字或者演一个等级——是让你知道你们**走到哪一步了、以及为什么**。
你的语气、边界感、主动程度、愿不愿意示弱，都该跟这个阶段对得上；上面那些事是真发生过的，提到的时候你是真的记得。
关系不会因为这一轮就跳档，也不会无缘无故升温。\n`;
            // 让模型顺手给这一轮的增减（只在聊天那一轮）
            if (S.askModel) {
                out += `【额外字段·关系】：**只有当这一轮你输出的是聊天用的那个 JSON（带 replies 数组的）时**，才在里面多加两个字段：
"rel"：-5 到 5 的数字，这一轮之后你对${uname(c)}的感觉往哪边动了多少（大部分时候是 0 或 ±1，别每轮都给大数）。
"relWhy"：不超过 15 个字说明因为什么。
写推文、日记、信件、小说、论坛帖的时候**绝对不要**加这两个字段，也不要把它们写进正文里。\n`;
            }
            return out;
        } catch (e) { return ''; }
    };

    // 回复钩子那边会调这个
    window.__gyRelCapture = function (char, parsed) {
        try {
            if (!ledgerOn()) return;             // 🔌 总开关关了：也不记账
            if (!S.askModel || !char || !parsed) return;
            const v = parseFloat(parsed.rel);
            if (isNaN(v) || v === 0) return;
            add(char.id, v / 2, String(parsed.relWhy || '').slice(0, 40) || '这一轮的来回', '聊天');
        } catch (e) {}
    };

    // ---------- 样式 ----------
    const CSS = `
#gyrelModal{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;padding:16px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;}
#gyrelModal.on{display:flex;}
.gyrel-box{background:#fff;border-radius:16px;width:720px;max-width:100%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;}
body.dark-theme .gyrel-box{background:#16181c;color:#e7e9ea;}
.gyrel-hd{padding:15px 18px 9px;font-size:17px;font-weight:700;color:#f91880;display:flex;align-items:center;gap:8px;}
.gyrel-tabs{display:flex;gap:4px;padding:0 18px;border-bottom:1px solid rgba(128,128,128,.2);flex-wrap:wrap;}
.gyrel-tab{border:none;background:none;padding:9px 12px;font-size:13.5px;cursor:pointer;color:#8b98a5;border-bottom:2px solid transparent;font-family:inherit;}
.gyrel-tab.on{color:#f91880;border-bottom-color:#f91880;font-weight:700;}
.gyrel-bd{padding:14px 18px 16px;overflow-y:auto;flex:1 1 auto;}
.gyrel-sec{margin-bottom:16px;}
.gyrel-sec>h4{margin:0 0 8px;font-size:13px;color:#f91880;}
.gyrel-hint{font-size:12px;color:#8b98a5;line-height:1.7;margin-bottom:8px;}
.gyrel-in{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cfd9de;border-radius:8px;font-size:13px;background:transparent;color:inherit;outline:none;margin-bottom:8px;font-family:inherit;}
.gyrel-in:focus{border-color:#f91880;}
.gyrel-btn{border:1px solid #f91880;background:#f91880;color:#fff;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer;margin:0 6px 6px 0;font-family:inherit;}
.gyrel-btn.ghost{background:transparent;color:#f91880;}
.gyrel-btn.danger{background:transparent;border-color:#8b98a5;color:#8b98a5;}
.gyrel-mini{border:none;background:rgba(128,128,128,.12);border-radius:6px;padding:4px 9px;font-size:11px;cursor:pointer;color:inherit;font-family:inherit;margin:0 4px 4px 0;}
.gyrel-mini.on{background:#f91880;color:#fff;}
.gyrel-modes{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
/* 角色一栏 */
.gyrel-c{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px dashed rgba(128,128,128,.25);cursor:pointer;}
.gyrel-c:last-child{border-bottom:none;}
.gyrel-av{width:36px;height:36px;border-radius:50%;background:#e6e9ea;color:#0f1419;font-size:15px;display:flex;align-items:center;
  justify-content:center;flex:0 0 auto;background-size:cover;background-position:center;}
body.dark-theme .gyrel-av{background:#2f3336;color:#e7e9ea;}
.gyrel-c-m{flex:1 1 auto;min-width:0;}
.gyrel-c-m b{display:block;font-size:14px;}
.gyrel-c-m span{font-size:11.5px;color:#8b98a5;}
.gyrel-num{font-size:15px;font-weight:700;flex:0 0 auto;font-variant-numeric:tabular-nums;}
.gyrel-bar{height:6px;border-radius:3px;background:rgba(128,128,128,.18);position:relative;margin-top:5px;overflow:hidden;}
.gyrel-bar i{position:absolute;top:0;bottom:0;border-radius:3px;}
.gyrel-bar i.p{background:#f91880;left:50%;}
.gyrel-bar i.n{background:#5b7fff;right:50%;}
.gyrel-bar u{position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(128,128,128,.5);}
/* 一条账 */
.gyrel-e{display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px dashed rgba(128,128,128,.2);font-size:13px;}
.gyrel-e:last-child{border-bottom:none;}
.gyrel-d{font-weight:700;min-width:44px;text-align:right;flex:0 0 auto;font-variant-numeric:tabular-nums;}
.gyrel-d.p{color:#f91880;}
.gyrel-d.n{color:#5b7fff;}
.gyrel-e-m{flex:1 1 auto;min-width:0;}
.gyrel-e-m span{display:block;font-size:11px;color:#8b98a5;margin-top:2px;}
.gyrel-x{color:#8b98a5;cursor:pointer;flex:0 0 auto;font-size:12px;}
.gyrel-x:hover{color:#f91880;}
.gyrel-stage{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.gyrel-stage input[type=number]{width:76px;padding:6px 8px;border:1px solid #cfd9de;border-radius:6px;font-size:13px;background:transparent;color:inherit;}
.gyrel-stage input[type=text]{flex:1;min-width:0;padding:6px 8px;border:1px solid #cfd9de;border-radius:6px;font-size:13px;background:transparent;color:inherit;}
@media (max-width:600px){ .gyrel-box{max-height:92vh;} }`;

    // ---------- DOM ----------
    function mount() {
        const st = document.createElement('style'); st.id = 'gyrelStyle'; st.textContent = CSS;
        document.head.appendChild(st);
        const m = document.createElement('div');
        m.id = 'gyrelModal';
        m.innerHTML = `<div class="gyrel-box">
            <div class="gyrel-hd">💗 关系账本<button class="gyrel-btn ghost" style="margin-left:auto" onclick="gyrelClose()">关闭</button></div>
            <div class="gyrel-tabs">
              <button class="gyrel-tab" id="gyrelTab-list" onclick="gyrelTab('list')">谁跟你到哪一步了</button>
              <button class="gyrel-tab" id="gyrelTab-rule" onclick="gyrelTab('rule')">怎么记账</button>
              <button class="gyrel-tab" id="gyrelTab-stage" onclick="gyrelTab('stage')">阶段划分</button>
            </div>
            <div class="gyrel-bd" id="gyrelBody"></div></div>`;
        m.addEventListener('click', e => { if (e.target === m) gyrelClose(); });
        document.body.appendChild(m);
    }

    let tab = 'list', openChar = null;
    window.gyrelOpen = function (charId) {
        if (charId) { openChar = String(charId); tab = 'list'; }
        document.getElementById('gyrelModal').classList.add('on'); renderPanel();
    };
    window.gyrelClose = function () { document.getElementById('gyrelModal').classList.remove('on'); };
    window.gyrelTab = function (t) { tab = t; renderPanel(); };
    window.gyrelPick = function (id) { openChar = (openChar === String(id)) ? null : String(id); renderPanel(); };

    function renderPanel() {
        const box = document.getElementById('gyrelModal');
        if (!box || !box.classList.contains('on')) return;
        ['list', 'rule', 'stage'].forEach(t => {
            const el = document.getElementById('gyrelTab-' + t);
            if (el) el.className = 'gyrel-tab' + (t === tab ? ' on' : '');
        });
        document.getElementById('gyrelBody').innerHTML = tab === 'list' ? tabList() : tab === 'rule' ? tabRule() : tabStage();
    }

    function avatar(c) {
        return c.avatarImg
            ? `<div class="gyrel-av" style="background-image:url('${c.avatarImg}')"></div>`
            : `<div class="gyrel-av">${esc(c.avatarEmoji || (c.name || '?')[0])}</div>`;
    }
    function entryRow(charId, e) {
        const d = new Date(e.at);
        return `<div class="gyrel-e">
            <div class="gyrel-d ${e.d > 0 ? 'p' : 'n'}">${e.d > 0 ? '+' : ''}${e.d}</div>
            <div class="gyrel-e-m">${esc(e.why || '（没记原因）')}
              <span>${d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}　来自：${esc(e.src || '手动')}</span></div>
            <span class="gyrel-x" onclick="gyrelDel('${charId}','${e.id}')">删</span>
        </div>`;
    }
    function tabList() {
        const cs = chars();
        if (!cs.length) return '<div class="gyrel-hint" style="padding:20px 0;text-align:center;">还没有角色。</div>';
        return cs.map(c => {
            const sc = score(c.id), b = book(c.id);
            const w = Math.min(50, Math.abs(sc) / 2);
            const open = openChar === String(c.id);
            return `<div class="gyrel-sec" style="margin-bottom:10px;">
              <div class="gyrel-c" onclick="gyrelPick('${c.id}')">
                ${avatar(c)}
                <div class="gyrel-c-m">
                  <b>${esc(c.name)}　<span style="font-weight:400;color:#f91880;">${esc(stageOf(sc))}</span></b>
                  <span>${b.length} 笔记录${b.length ? '　·　最近：' + esc((b[b.length - 1].why || '').slice(0, 18)) : ''}</span>
                  <div class="gyrel-bar"><i class="${sc >= 0 ? 'p' : 'n'}" style="width:${w}%"></i><u></u></div>
                </div>
                <div class="gyrel-num" style="color:${sc >= 0 ? '#f91880' : '#5b7fff'}">${sc > 0 ? '+' : ''}${sc}</div>
              </div>
              ${open ? `<div style="padding:6px 0 0 46px;">
                <div style="margin-bottom:8px;">
                  <input class="gyrel-in" id="gyrelWhy" placeholder="因为什么事？比如「她记得我不吃香菜」" style="margin-bottom:6px;">
                  <input class="gyrel-in" id="gyrelD" type="number" step="0.5" placeholder="加减多少（负数是减）" style="max-width:180px;display:inline-block;margin-bottom:6px;">
                  <button class="gyrel-btn" onclick="gyrelAddManual('${c.id}')">记一笔</button>
                  ${b.length ? `<button class="gyrel-btn danger" onclick="gyrelClear('${c.id}')">清空这个人的账</button>` : ''}
                </div>
                <div style="margin-bottom:10px;padding:8px 10px;border:1px dashed rgba(128,128,128,.35);border-radius:8px;">
                  <div class="gyrel-hint" style="margin-bottom:6px;">
                    <b>直接设成</b>：不想一笔一笔记的时候，把好感度拨到你想要的数字（常用 −100 ~ 100，但不设上下限）。
                    账本一笔都不会动，以后自动记的那些还是在这个数上面加减。${baseOf(c.id) ? `　当前基准 ${baseOf(c.id) > 0 ? '+' : ''}${baseOf(c.id)}` : ''}
                  </div>
                  <input class="gyrel-in" id="gyrelScore${c.id}" type="number" step="0.5" value="${sc}" style="max-width:140px;display:inline-block;">
                  <button class="gyrel-btn" onclick="gyrelSetScore('${c.id}')">设定</button>
                  ${baseOf(c.id) ? `<button class="gyrel-btn ghost" onclick="gyrelResetScore('${c.id}')">清掉基准</button>` : ''}
                </div>
                ${b.length ? b.slice().reverse().slice(0, 40).map(e => entryRow(c.id, e)).join('')
                           : '<div class="gyrel-hint">还没有记录。上面可以手动记一笔，或者去「怎么记账」把自动来源打开。</div>'}
              </div>` : ''}
            </div>`;
        }).join('');
    }
    function tabRule() {
        const moodOn = (typeof isAutoOn === 'function') ? isAutoOn('aliveMood') : false;
        const sw = (k, title, desc, warn) => `<label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;padding:9px 0;">
            <input type="checkbox" ${S[k] ? 'checked' : ''} onchange="gyrelSet('${k}',this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;">
            <span><b>${title}</b><br><span style="font-size:11.5px;color:#8b98a5;line-height:1.7;">${desc}</span>${warn ? `<br><span style="font-size:11.5px;color:#f91880;">${warn}</span>` : ''}</span></label>`;
        return `
        ${(typeof gyReqBox === 'function') ? gyReqBox([
            { sw: 'relLedger' },
            { ok: !!(S.fromMood || S.askModel || S.fromEvents), text: '三个记账来源一个都没开，账本不会自己长', jump: '', go: '' },
            { ok: !(S.fromMood && !moodOn), text: '开了「跟着情绪惯性走」，但「🫀 情绪会留到下一轮」是关的，这一项收不到东西', jump: "gyJumpToSwitch('aliveMood')", go: '去打开' }
        ], { title: '想让好感度自己动起来，还差这些' }) : ''}
        <div class="gyrel-sec">
          <h4>💰 分数从哪来</h4>
          <div class="gyrel-hint">三个来源可以同时开。<b>都不额外调 API</b>——第一个是蹭主程序已经在要的字段，第二个是每轮多两个字段，第三个是读别的插件的存档。</div>
          ${sw('fromMood', '跟着「情绪惯性」走（推荐，零成本）',
              '主程序 v87 的「情绪会留到下一轮」每轮已经带出情绪值和原因了，这边直接把它折成账本上的一笔（-5~5 折成 ±2.5，单轮不会让关系跳档）。一个字都不多发。',
              moodOn ? '' : '⚠️ 你还没打开「设置 → 🫀 活人感 → 情绪会留到下一轮」，这一项现在收不到东西。')}
          ${sw('askModel', '让模型每轮单独给一个数',
              '每轮多要 rel / relWhy 两个字段。会明确写清"只有聊天那一轮才加，写推文日记信件绝对不要加"，防止数字混进正文。跟上面那项可以同时开，两边都会记。')}
          ${sw('fromEvents', '一起听歌 / 一起出去，自动记账',
              '读音乐盒和行程与天气插件的存档：一起出去成了 +2.5（超过两小时 +4），约了没约成 −1.5，一起听歌每满一小时 +1。按记录 id 去重，不会重复记。纯本地读。')}
          ${sw('syncAffinity', '同步到主程序的好感度系统',
              '把总分写进 char.affinity 并打开 enableAffinitySystem，这样「势力关系网」页上的 💗 徽章和连线粗细也会跟着动。')}
          ${sw('showNumber', '把分数本身也告诉角色',
              '默认<b>不报数字</b>，只告诉 TA 现在是哪个阶段、以及最近发生了哪几件事——人是靠事和感觉判断关系的，不是靠看自己的好感度条。除非你想要那种数值恋爱游戏的感觉，否则建议关着。')}
        </div>

        <div class="gyrel-sec">
          <h4>⚙️ 参数</h4>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <span style="font-size:13px;color:#8b98a5;min-width:130px;">注进 prompt 的最近几条</span>
            <input class="gyrel-in" id="gyrelInject" type="number" min="0" value="${S.inject}" style="max-width:90px;margin:0;">
            <span style="font-size:12px;color:#8b98a5;">条原因（0 ＝ 只给阶段不给事）</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <span style="font-size:13px;color:#8b98a5;min-width:130px;">每人最多存多少笔</span>
            <input class="gyrel-in" id="gyrelKeep" type="number" min="0" value="${S.keep}" style="max-width:90px;margin:0;">
            <span style="font-size:12px;color:#8b98a5;">0 ＝ 不限</span>
          </div>
          <button class="gyrel-btn" onclick="gyrelSaveNums()">💾 保存</button>
          <button class="gyrel-btn ghost" onclick="gyrelScanNow()">🔄 现在扫一遍事件</button>
          <div id="gyrelStatus" style="font-size:12px;color:#8b98a5;margin-top:6px;"></div>
        </div>

        <div class="gyrel-sec">
          <h4>📄 现在注给角色的是什么样</h4>
          <select class="gyrel-in" id="gyrelPreviewWho" onchange="gyrelPreview()" style="max-width:220px;display:inline-block;">
            ${chars().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') || '<option value="">还没有角色</option>'}
          </select>
          <button class="gyrel-btn ghost" onclick="gyrelPreview()">看看</button>
          <pre id="gyrelPreview" style="white-space:pre-wrap;word-break:break-all;font-size:12px;color:#8b98a5;background:rgba(128,128,128,.06);border-radius:8px;padding:10px;margin-top:8px;max-height:260px;overflow:auto;font-family:inherit;"></pre>
        </div>`;
    }
    function tabStage() {
        return `
        <div class="gyrel-sec">
          <h4>🪜 阶段划分</h4>
          <div class="gyrel-hint">分数落到哪一档，注进 prompt 的就是那个名字。左边填这一档从多少分开始，右边填叫什么。改完记得保存。</div>
          <div id="gyrelStageList">
            ${stages().map((s, i) => `<div class="gyrel-stage">
                <input type="number" value="${s.at}" data-i="${i}" class="gyrel-sat">
                <input type="text" value="${esc(s.name)}" data-i="${i}" class="gyrel-sname">
                <span class="gyrel-x" onclick="gyrelDelStage(${i})">删</span>
              </div>`).join('')}
          </div>
          <button class="gyrel-btn" onclick="gyrelSaveStages()">💾 保存阶段</button>
          <button class="gyrel-btn ghost" onclick="gyrelAddStage()">＋ 加一档</button>
          <button class="gyrel-btn danger" onclick="gyrelResetStages()">恢复默认</button>
        </div>`;
    }

    window.gyrelSet = function (k, v) { S[k] = !!v; save(); if (k === 'syncAffinity' && v) syncAll(); renderPanel(); };
    // 🎛️ 给「全部开关」页读当前状态用（js/54）
    window.gyrelGet = k => !!S[k];
    window.gyrelSaveNums = function () {
        const g = id => { const e = document.getElementById(id); return e ? parseInt(e.value) : NaN; };
        const i = g('gyrelInject'), k = g('gyrelKeep');
        if (!isNaN(i)) S.inject = Math.max(0, i);   // 不设上限
        if (!isNaN(k)) S.keep = Math.max(0, k);
        if (S.keep > 0) Object.keys(S.led).forEach(id => { const b = S.led[id]; if (b.length > S.keep) b.splice(0, b.length - S.keep); });
        save(); renderPanel();
        const st = document.getElementById('gyrelStatus'); if (st) st.innerText = '保存好了。';
    };
    window.gyrelAddManual = async function (charId) {
        const w = document.getElementById('gyrelWhy'), d = document.getElementById('gyrelD');
        const st = () => document.getElementById('gyrelStatus');
        const v = d ? parseFloat(d.value) : NaN;
        if (isNaN(v) || v === 0) { alert('填一个不等于 0 的分数（负数是减）。'); return; }
        await add(charId, v, (w && w.value) || '', '手动');
        renderPanel();
    };
    window.gyrelDel = async function (charId, id) {
        S.led[String(charId)] = book(charId).filter(e => e.id !== id);
        syncOne(charId); await save(); renderPanel(); renderMemHub();
    };
    window.gyrelClear = async function (charId) {
        S.led[String(charId)] = [];
        syncOne(charId); await save(); renderPanel(); renderMemHub();
    };
    window.gyrelScanNow = async function () {
        const st = document.getElementById('gyrelStatus'); if (st) st.innerText = '正在扫…';
        scanMood(); await scanEvents();
        renderPanel();
        const st2 = document.getElementById('gyrelStatus'); if (st2) st2.innerText = '扫完了。';
    };
    window.gyrelPreview = function () {
        const sel = document.getElementById('gyrelPreviewWho');
        const out = document.getElementById('gyrelPreview');
        if (!out) return;
        const id = sel && sel.value;
        out.innerText = id ? (window.__gyRelCtxFor(id) || '（这个角色还没有任何记录，暂时什么都不会注入）') : '还没有角色。';
    };
    window.gyrelAddStage = function () { S.stages = stages().concat([{ at: 0, name: '新阶段' }]); save(); renderPanel(); };
    window.gyrelDelStage = function (i) { const l = stages(); l.splice(i, 1); S.stages = l; save(); renderPanel(); };
    window.gyrelResetStages = function () { S.stages = DEF_STAGES.map(x => Object.assign({}, x)); save(); renderPanel(); };
    window.gyrelSaveStages = function () {
        const ats = [...document.querySelectorAll('.gyrel-sat')];
        const nms = [...document.querySelectorAll('.gyrel-sname')];
        const out = [];
        ats.forEach((el, i) => {
            const at = parseFloat(el.value);
            const name = (nms[i] && nms[i].value || '').trim();
            if (!isNaN(at) && name) out.push({ at, name });   // 分数线和名字都不设限
        });
        if (out.length) S.stages = out.sort((a, b) => a.at - b.at);
        save(); renderPanel();
    };

    // ---------- 记忆总览里的那一块 ----------
    function memHubHtml(charId) {
        const b = book(charId), sc = score(charId);
        return `
          <label style="font-size:15px;">💗 关系账本</label>
          <div style="font-size:12px; color:#536471; margin-bottom:8px;">
            你和 TA 走到哪一步、以及为什么。这些原因会进 TA 的 prompt——不是给 TA 看数字，是让 TA 记得这些事真的发生过。
          </div>
          <div style="display:flex;align-items:center;gap:10px;background:white;padding:10px 12px;border-radius:8px;border:1px solid #eff3f4;margin-bottom:8px;">
            <b style="font-size:20px;color:${sc >= 0 ? '#f91880' : '#5b7fff'};">${sc > 0 ? '+' : ''}${sc}</b>
            <span style="font-size:14px;font-weight:bold;">${esc(stageOf(sc))}</span>
            <span style="font-size:12px;color:#8b98a5;margin-left:auto;">${b.length} 笔</span>
            <button type="button" class="btn-edit-small" onclick="gyrelOpen('${charId}')">打开账本</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;">
          ${b.length ? b.slice().reverse().slice(0, 30).map(e => `
            <div style="display:flex;align-items:flex-start;gap:8px;background:white;padding:8px;border-radius:6px;border:1px solid #eff3f4;">
              <b style="min-width:42px;text-align:right;color:${e.d > 0 ? '#f91880' : '#5b7fff'};">${e.d > 0 ? '+' : ''}${e.d}</b>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;">${esc(e.why || '（没记原因）')}</div>
                <div style="font-size:11px;color:#8b98a5;">${new Date(e.at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}　${esc(e.src || '')}</div>
              </div>
              <span style="color:#f91880;cursor:pointer;flex-shrink:0;" onclick="gyrelDel('${charId}','${e.id}')">删除</span>
            </div>`).join('') : '<div style="color:#8b98a5;font-size:13px;">还没有记录</div>'}
          </div>`;
    }
    function renderMemHub() {
        const host = document.getElementById('memoryHubContent');
        if (!host) return;
        const id = (typeof currentMemoryHubTargetId !== 'undefined') ? currentMemoryHubTargetId : null;
        let box = document.getElementById('gyrelMemHubBox');
        if (String(id || '').startsWith('g_') || !id) { if (box) box.remove(); return; }
        if (!box) {
            box = document.createElement('div');
            box.id = 'gyrelMemHubBox';
            box.className = 'input-group';
            box.style.cssText = 'margin-top:20px; border-top:1px dashed #f91880; padding-top:15px;';
            host.appendChild(box);
        }
        box.innerHTML = memHubHtml(id);
    }

    // ---------- 入口 & 钩子 ----------
    function addEntries() {
        const menu = document.querySelector('#setIndex .set-menu');
        if (menu && !document.getElementById('gyrelSetEntry')) {
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = 'set-entry'; btn.id = 'gyrelSetEntry';
            btn.onclick = () => gyrelOpen();
            btn.innerHTML = '<span class="set-entry-ico">💗</span><span class="set-entry-main"><span class="set-entry-title">关系账本</span><span class="set-entry-desc">好感度不是一个数字，是一本带原因的流水账</span></span><span class="set-entry-arrow">›</span>';
            const sep = menu.querySelector('.set-menu-sep');
            if (sep) menu.insertBefore(btn, sep); else menu.appendChild(btn);
        }
    }
    function hookMemHub() {
        try {
            ['selectMemoryHubTarget', 'renderMemoryHubContent'].forEach(fn => {
                const orig = window[fn];
                if (typeof orig !== 'function' || orig.__gyrelPatched) return;
                window[fn] = function () {
                    const r = orig.apply(this, arguments);
                    try { setTimeout(renderMemHub, 0); } catch (e) {}
                    return r;
                };
                window[fn].__gyrelPatched = true;
            });
        } catch (e) { console.warn('[关系账本] 挂记忆总览失败：', e); }
    }

    (async function init() {
        await load();
        mount();
        addEntries();
        hookMemHub();
        syncAll();
        const sw = window.switchMainView;
        if (typeof sw === 'function' && !sw.__gyrelPatched) {
            window.switchMainView = function () {
                // 进任何一页之前先把好感度对一遍（有变化才写），这样「关系网」那一页
                // 一进去看到的就是账本里的最新数字，不用退出去再进来
                try { syncAll(); } catch (e) {}
                const r = sw.apply(this, arguments);
                try { setTimeout(addEntries, 0); } catch (e) {}
                return r;
            };
            window.switchMainView.__gyrelPatched = true;
        }
        // 情绪是每轮都会变的，盯紧一点；事件类的慢慢扫就行。都是纯本地。
        setInterval(() => { try { scanMood(); } catch (e) {} }, 20000);
        setInterval(() => { try { scanEvents(); } catch (e) {} }, 5 * 60000);
        setTimeout(() => { try { scanEvents(); } catch (e) {} }, 8000);
        console.info('[关系账本] 已加载：' + Object.keys(S.led).length + ' 个人的账，共 '
            + Object.keys(S.led).reduce((a, k) => a + S.led[k].length, 0) + ' 笔');
    })();
})();

// ============ 八卦网 ============
/* ===========================================================================
   🗣️ 白露八卦网 —— 你听到的事，是二手的、变形的、带立场的
   ---------------------------------------------------------------------------
   小剧场已经能让角色背着你发生事了，但你看到的是**上帝视角的原文**——
   干净、准确、全知。真实世界不是这样：你听到的永远是某个人转述给你的版本，
   TA 漏掉了一半、加上了自己的判断、可能还把人记错了。

   这个插件干的事：
     1. 盯着小剧场记录和"一起出去"的记录，把发生过的事收进传闻池。
     2. 挑一个**不在场但有关系**的角色，让 TA 用自己的立场转述给你——
        明确要求失真：漏细节、记混时间地点、说反因果、甚至记错人。
     3. 你可以拿这个版本去**问当事人**，TA 会否认、纠正、承认，或者反问你从哪听来的。
     4. 面板里能"开天眼"：实际发生的 / 传出去的版本 / 差在哪儿，三栏对照着看。

   于是你知道的事情不再天然是真的——得自己去问、去对峙、去判断信谁。

   💰 花钱的地方只有两处：转述一次一次调用、对峙一次一次调用。
      自动传播**默认关**，不打开的话它一次 API 都不会调。
   =========================================================================== */
(function () {
    if (window.__gyGossipLoaded) { try { gygsOpen(); } catch (e) {} return; }
    window.__gyGossipLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyGossipBox', 'rumors')          // 带兜底的存档口：localforage 用不了就退 localStorage，两条都断才报错
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyGossipBox', storeName: 'rumors' })
            : null);
    const KEY = 'gyGossip_state';

    let S = {
        rumors: [],       // [{id, srcId, at, subjects:[id], truth, told:{by,at,text,distort}|null, asks:[{who,at,q,a}]}]
        seen: {},         // 已经收进池的事件 id
        keep: 40,         // 传闻池最多留多少条
        inject: 3,        // 每个角色最多注入几条相关传闻
        fromTheater: true,
        fromDates: true,
        tellUser: true,   // 转述给你（要调 API）
        distort: true,    // 转述时会不会失真（关掉就是如实转述，只保留说话人的口吻和立场）
        distortLevel: 'mid',  // light 只有一点出入 | mid 至少一处对不上 | heavy 走样得厉害
        auto: false,      // 自动传播：每隔一段时间自己挑一条讲给你（默认关）
        autoHours: 6,     // 自动传播的间隔（小时）
        lastAuto: 0,
        godMode: true     // 面板里显示"实际发生的"那一栏
    };
    // 给测试和排查用：这份是出厂默认值，改过之后对照着看
    window.__gyGossipDefaults = { distort: true, distortLevel: 'mid', auto: false, godMode: true };

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const uid = p => (p || 'g') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const uname = c => (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
    const ago = t => { const d = Math.floor((Date.now() - t) / 86400000);
        return d <= 0 ? '今天' : d === 1 ? '昨天' : d < 30 ? d + ' 天前' : new Date(t).toLocaleDateString('zh-CN'); };

    async function save() { if (LF) { try { await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) { console.warn('[八卦网] 存档失败', e); } } }
    async function load() {
        if (LF) { try { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } catch (e) {} }
        if (!Array.isArray(S.rumors)) S.rumors = [];
        if (!S.seen) S.seen = {};
    }

    // ---------- 收事件进池 ----------
    async function collect() {
        let added = 0;
        // 小剧场
        if (S.fromTheater && typeof globalTheaterLogs !== 'undefined' && Array.isArray(globalTheaterLogs)) {
            globalTheaterLogs.forEach(l => {
                if (!l || !l.id || S.seen[l.id]) return;
                S.seen[l.id] = 1;
                S.rumors.push({
                    id: uid(), srcId: l.id, at: l.at || Date.now(), kind: 'theater',
                    subjects: [l.charAId, l.charBId].filter(x => x != null),
                    names: [l.charAName, l.charBName].filter(Boolean),
                    truth: (l.summary || '') + (l.scene ? '\n' + l.scene : ''),
                    told: null, asks: []
                });
                added++;
            });
        }
        // 一起出去（行程插件的记录）
        if (S.fromDates && typeof localforage !== 'undefined') {
            try {
                const st = await localforage.createInstance({ name: 'gyMapBox', storeName: 'maps' }).getItem('gyMap_state');
                (st && st.date && st.date.logs || []).forEach(l => {
                    if (!l || !l.id || S.seen['d:' + l.id] || !l.ok) return;
                    S.seen['d:' + l.id] = 1;
                    const c = charOf(l.charId);
                    S.rumors.push({
                        id: uid(), srcId: l.id, at: l.at || Date.now(), kind: 'date',
                        subjects: [l.charId], names: [l.charName || (c && c.name) || ''],
                        truth: `${l.charName} 和${(typeof currentUser !== 'undefined' && currentUser.name) || '用户'}一起去了${l.spot}${l.act ? '，' + l.act : ''}，待了 ${l.mins} 分钟。`,
                        told: null, asks: []
                    });
                    added++;
                });
            } catch (e) {}
        }
        const keep = Math.max(1, parseInt(S.keep) || 40);
        if (S.rumors.length > keep) S.rumors.splice(0, S.rumors.length - keep);
        if (added) await save();
        return added;
    }

    // 谁可能听说这件事：跟当事人有关系、但自己不在场的角色
    function hearers(r) {
        const subj = (r.subjects || []).map(String);
        const rels = (typeof charRelationships !== 'undefined' && Array.isArray(charRelationships)) ? charRelationships : [];
        const linked = new Set();
        rels.forEach(x => {
            const f = String(x.fromId), t = String(x.toId);
            if (subj.includes(f) && !subj.includes(t)) linked.add(t);
            if (subj.includes(t) && !subj.includes(f)) linked.add(f);
        });
        let out = chars().filter(c => linked.has(String(c.id)));
        // 谁都没关系的话，随便找个不在场的——世界上总有爱传话的人
        if (!out.length) out = chars().filter(c => !subj.includes(String(c.id)));
        return out;
    }
    function relLabel(aId, bId) {
        const rels = (typeof charRelationships !== 'undefined' && Array.isArray(charRelationships)) ? charRelationships : [];
        const x = rels.find(r => (String(r.fromId) === String(aId) && String(r.toId) === String(bId))
                              || (String(r.toId) === String(aId) && String(r.fromId) === String(bId)));
        return x ? (x.label || '') : '';
    }

    // ---------- 转述（花钱：一次调用）----------
    let busy = false;
    function tell(msg) { const e = document.getElementById('gygsStatus'); if (e) e.innerText = msg;
        else if (typeof showToast === 'function') showToast('', '八卦网', msg, null, null, false); }

    // 自主模式「跟你八卦」（js/58）：这个角色能讲给你听的传闻（TA 听说过、又不是当事人）
    window.gygsRumorsFor = function (charId) {
        try { return (S.rumors || []).filter(r => r && !r.told && hearers(r).some(c => String(c.id) === String(charId))).map(r => ({ id: r.id, text: r.text || r.truth || '', names: r.names || [] })); }
        catch (e) { return []; }
    };
    window.gygsTell = async function (rumorId, byId) {
        if (busy) { tell('还在生成上一条，等一下。'); return null; }
        const r = S.rumors.find(x => x.id === rumorId);
        if (!r) return null;
        const cands = hearers(r);
        if (!cands.length) { tell('没有人能来跟你说这件事——当事人之外没有别的角色。'); return null; }
        const c = byId ? (charOf(byId) || cands[0]) : cands[Math.floor(Math.random() * cands.length)];
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { tell('还没配 API Key。'); return null; }

        busy = true; tell(`正在让 ${c.name} 跟你说这件事…`);
        try {
            const who = (r.names || []).join(' 和 ');
            const myRel = (r.subjects || []).map(id => {
                const t = charOf(id); const lb = relLabel(c.id, id);
                return t ? `你跟${t.name}${lb ? '是' + lb : '没什么特别关系'}` : '';
            }).filter(Boolean).join('；');
            const RULE = {
                off: `1. **如实转述**：时间、地点、人是谁、前因后果，都要跟上面写的一致。不要漏掉关键的，也不要加上没发生的。`,
                light: `1. 你不是当事人，是听来的，所以细节上会有**一点点**出入——比如记不清具体时间、少提一个细节、程度说得略重或略轻。但主要的事实（谁、跟谁、发生了什么）不要说错。`,
                mid: `1. 你**不是当事人，也没亲眼看见**，是听来的。所以细节一定会有偏差：可以只记得一半、把时间地点记混、把因果说反、或者把程度夸大缩小。**至少要有一处跟原文对不上。**`,
                heavy: `1. 这话已经传了好几手了，走样得厉害。**至少有两三处跟原文对不上**：可以把因果整个说反、把其中一个人记成别人、把小事说成大事，甚至掺进一段其实没发生的推测——但你说的时候是当真事说的，你自己也信。`
            };
            const lv = S.distort ? (RULE[S.distortLevel] || RULE.mid) : RULE.off;
            const ask = `你从别人那儿听说了一件事，现在想跟${uname(c)}提起它。

【你听到的那件事】（${ago(r.at)}，关于 ${who}）：
${r.truth}

【怎么转述——这是重点】
${lv}
2. 你会带着自己的立场说。${myRel || '你跟他们都不算太熟'}——这决定你偏向谁、语气是幸灾乐祸、担心、不屑、还是纯八卦。${S.distort ? '' : '（事实要准，但语气和态度还是你自己的。）'}
3. **不要**说"我听说"然后原样复述一遍。真人转述是压缩过、加工过、掺了自己判断的，会有"反正我觉得""你猜怎么着"这种。
4. 一到三句话，像随口跟人提起，不是做汇报。按你自己的说话习惯来。

只输出 JSON，不要解释、不要 markdown 围栏：
{"text":"你要说的那几句话","distort":"${S.distort ? '你这个版本跟实际发生的差在哪儿，一句话，20字以内' : '这次是如实转述，这一项填空字符串'}"}`;
            const messages = buildStructuredMessages(buildBasePrompt(c, false, ''), [], ask);
            const data = await callChatCompletionAPI(api, messages);
            const raw = (data.choices?.[0]?.message?.content || '');
            let p = (typeof parseModelJson === 'function') ? parseModelJson(raw) : null;
            if (Array.isArray(p)) p = p[0];
            let text = (p && p.text) || String(raw).trim();
            text = String(text).trim().replace(/^["'“”「」]+|["'“”「」]+$/g, '');
            if (typeof applyRegexScripts === 'function') { try { text = applyRegexScripts(text, 'ai_output', c.id); } catch (e) {} }
            if (!text) { tell('模型这次没给出东西，再点一次。'); return null; }
            r.told = { by: c.id, byName: c.name, at: Date.now(), text,
                       distort: S.distort ? ((p && p.distort) || '') : '', faithful: !S.distort };
            await save();
            renderPanel();
            if (typeof addNotification === 'function') addNotification(`<b>${c.name}</b> 跟你说了点关于 ${who} 的事 🗣️`, null, c.id, c, text);
            // 通知里也留一条，点了直接进八卦网——只弹 toast 的话，人不在屏幕前就永远错过了
            if (typeof addNotification === 'function') addNotification(`<b>${c.name}</b> 跟你说了点事 🕸️`, null, null, c, text, { feature: 'gossip' });
            else if (typeof showToast === 'function') showToast(typeof getAvatarHTML === 'function' ? getAvatarHTML(c, 40) : '', c.name + ' 跟你说', text, null, null, false);
            tell('');
            return text;
        } catch (e) { tell('出错了：' + (e.message || e)); return null; }
        finally { busy = false; }
    };

    // ---------- 去问当事人（花钱：一次调用）----------
    window.gygsAsk = async function (rumorId, whoId) {
        if (busy) { tell('还在生成上一条，等一下。'); return null; }
        const r = S.rumors.find(x => x.id === rumorId);
        const c = charOf(whoId);
        if (!r || !c || !r.told) return null;
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { tell('还没配 API Key。'); return null; }
        busy = true; tell(`正在问 ${c.name}…`);
        try {
            const ask = `${uname(c)}拿一件事来问你，说是从${r.told.byName}那儿听来的：
「${r.told.text}」

【实际发生的是】（只有你自己知道，不要原样复述这段）：
${r.truth}

按你的性格决定怎么回应：可以否认、可以纠正对方听错的地方、可以承认、可以避重就轻、可以反问对方从哪儿听来的、也可以干脆不想聊这个。
${S.distort ? '注意对方拿到的版本跟实际有出入——你心里清楚差在哪儿，但要不要点破、点破多少，由你决定。'
             : '对方拿到的版本事实上没说错，但那是从别人嘴里出来的、带着别人的态度。'}
还要考虑：这话是${r.told.byName}传出去的，你对${r.told.byName}是什么态度，会影响你的反应。
一到三句话，用你自己的话说，别写旁白别加引号。只输出这几句话本身。`;
            const messages = buildStructuredMessages(buildBasePrompt(c, false, ''), [], ask);
            const data = await callChatCompletionAPI(api, messages);
            let a = (data.choices?.[0]?.message?.content || '').trim().replace(/^["'“”「」]+|["'“”「」]+$/g, '');
            if (typeof stripReasoningBlocks === 'function') a = stripReasoningBlocks(a);
            if (typeof applyRegexScripts === 'function') { try { a = applyRegexScripts(a, 'ai_output', c.id); } catch (e) {} }
            if (!a) { tell('TA 这次没说什么，再点一次。'); return null; }
            if (!Array.isArray(r.asks)) r.asks = [];
            r.asks.push({ who: c.id, whoName: c.name, at: Date.now(), a });
            await save();
            renderPanel();
            if (typeof addNotification === 'function') addNotification(`你去问了 <b>${c.name}</b> 那件事`, null, c.id, c, a);
            tell('');
            return a;
        } catch (e) { tell('出错了：' + (e.message || e)); return null; }
        finally { busy = false; }
    };

    // ---------- 注进 prompt ----------
    window.__gyGossipCtxFor = function (charId) {
        try {
            const id = String(charId);
            const n = Math.max(0, Math.round(gyNum(S.inject, 3)));
            if (!n) return '';
            let out = '';
            const mine = S.rumors.filter(r => r.told).slice(-20).reverse();

            // ① 我是当事人：外面在传我的事
            const about = mine.filter(r => (r.subjects || []).map(String).includes(id)).slice(0, n);
            if (about.length) {
                out += `\n【外面在传关于你的事】：\n` + about.map(r => {
                    const asked = (r.asks || []).some(a => String(a.who) === id);
                    return `· ${ago(r.told.at)}　${r.told.byName} 跟${(typeof currentUser !== 'undefined' && currentUser.name) || '对方'}说：「${r.told.text}」`
                        + (asked ? '（对方已经拿这个来问过你了）' : '');
                }).join('\n')
                + (S.distort
                    ? `\n这些是传出去的版本，跟实际发生的不完全一样——你自己知道真的是怎么回事。要不要澄清、在意不在意有人在背后说你，看你的性格。\n`
                    : `\n这些是别人转述出去的版本，事情本身没说错，但语气和立场是转述者自己的。在意不在意有人在背后议论你，看你的性格。\n`);
            }
            // ② 我是转述的那个人：我跟对方说过这些
            const told = mine.filter(r => r.told && String(r.told.by) === id).slice(0, n);
            if (told.length) {
                out += `\n【你跟对方说过的闲话】：\n` + told.map(r => `· ${ago(r.told.at)}　你说：「${r.told.text}」`).join('\n')
                + `\n这些是你自己转述的版本（你也是听来的，未必准）。对方要是提起，你得接得住；要是当事人来找你对质，你自己掂量怎么办。\n`;
            }
            return out;
        } catch (e) { return ''; }
    };

    // ---------- 样式 ----------
    const CSS = `
#gygsModal{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;padding:16px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;}
#gygsModal.on{display:flex;}
.gygs-box{background:#fff;border-radius:16px;width:760px;max-width:100%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;}
body.dark-theme .gygs-box{background:#16181c;color:#e7e9ea;}
.gygs-hd{padding:15px 18px 9px;font-size:17px;font-weight:700;color:#7856ff;display:flex;align-items:center;gap:8px;}
.gygs-tabs{display:flex;gap:4px;padding:0 18px;border-bottom:1px solid rgba(128,128,128,.2);flex-wrap:wrap;}
.gygs-tab{border:none;background:none;padding:9px 12px;font-size:13.5px;cursor:pointer;color:#8b98a5;border-bottom:2px solid transparent;font-family:inherit;}
.gygs-tab.on{color:#7856ff;border-bottom-color:#7856ff;font-weight:700;}
.gygs-bd{padding:14px 18px 16px;overflow-y:auto;flex:1 1 auto;}
.gygs-sec{margin-bottom:16px;}
.gygs-sec>h4{margin:0 0 8px;font-size:13px;color:#7856ff;}
.gygs-hint{font-size:12px;color:#8b98a5;line-height:1.7;margin-bottom:8px;}
.gygs-in{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cfd9de;border-radius:8px;font-size:13px;background:transparent;color:inherit;outline:none;margin-bottom:8px;font-family:inherit;}
.gygs-btn{border:1px solid #7856ff;background:#7856ff;color:#fff;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer;margin:0 6px 6px 0;font-family:inherit;}
.gygs-btn.ghost{background:transparent;color:#7856ff;}
.gygs-btn.danger{background:transparent;border-color:#8b98a5;color:#8b98a5;}
.gygs-mini{border:none;background:rgba(128,128,128,.12);border-radius:6px;padding:4px 9px;font-size:11px;cursor:pointer;color:inherit;font-family:inherit;margin:0 4px 4px 0;}
.gygs-mini.on{background:#7856ff;color:#fff;}
/* 一条传闻 */
.gygs-r{border:1px solid rgba(128,128,128,.25);border-radius:12px;padding:12px;margin-bottom:12px;}
.gygs-r-hd{display:flex;align-items:center;gap:8px;font-size:12px;color:#8b98a5;margin-bottom:8px;flex-wrap:wrap;}
.gygs-r-hd b{color:#7856ff;font-size:12.5px;}
.gygs-lane{border-left:3px solid rgba(128,128,128,.3);padding:2px 0 2px 10px;margin-bottom:9px;}
.gygs-lane.truth{border-left-color:#8b98a5;}
.gygs-lane.told{border-left-color:#7856ff;}
.gygs-lane.ask{border-left-color:#17bf63;}
.gygs-lane u{display:block;text-decoration:none;font-size:11px;color:#8b98a5;margin-bottom:2px;}
.gygs-lane p{margin:0;font-size:13px;line-height:1.75;}
.gygs-diff{font-size:11.5px;color:#f91880;background:rgba(249,24,128,.08);border-radius:6px;padding:5px 8px;margin-top:5px;}
.gygs-blur{filter:blur(4px);cursor:pointer;user-select:none;}
.gygs-blur:hover{filter:blur(0);}
@media (max-width:600px){ .gygs-box{max-height:92vh;} }`;

    function mount() {
        const st = document.createElement('style'); st.id = 'gygsStyle'; st.textContent = CSS;
        document.head.appendChild(st);
        const m = document.createElement('div');
        m.id = 'gygsModal';
        m.innerHTML = `<div class="gygs-box">
            <div class="gygs-hd">🗣️ 八卦网<button class="gygs-btn ghost" style="margin-left:auto" onclick="gygsClose()">关闭</button></div>
            <div class="gygs-tabs">
              <button class="gygs-tab" id="gygsTab-feed" onclick="gygsTab('feed')">听到的话</button>
              <button class="gygs-tab" id="gygsTab-pool" onclick="gygsTab('pool')">还没传开的</button>
              <button class="gygs-tab" id="gygsTab-rule" onclick="gygsTab('rule')">规则</button>
            </div>
            <div class="gygs-bd" id="gygsBody"></div></div>`;
        m.addEventListener('click', e => { if (e.target === m) gygsClose(); });
        document.body.appendChild(m);
    }

    let tab = 'feed';
    window.gygsOpen = function () { document.getElementById('gygsModal').classList.add('on'); collect().then(renderPanel); renderPanel(); };
    window.gygsClose = function () { document.getElementById('gygsModal').classList.remove('on'); };
    window.gygsTab = function (t) { tab = t; renderPanel(); };

    function renderPanel() {
        const box = document.getElementById('gygsModal');
        if (!box || !box.classList.contains('on')) return;
        ['feed', 'pool', 'rule'].forEach(t => {
            const el = document.getElementById('gygsTab-' + t);
            if (el) el.className = 'gygs-tab' + (t === tab ? ' on' : '');
        });
        document.getElementById('gygsBody').innerHTML = tab === 'feed' ? tabFeed() : tab === 'pool' ? tabPool() : tabRule();
    }

    function rumorCard(r, showTruth) {
        const who = (r.names || []).join('、');
        const subjBtns = (r.subjects || []).map(id => {
            const c = charOf(id);
            return c ? `<button class="gygs-mini" onclick="gygsAsk('${r.id}','${c.id}')">去问 ${esc(c.name)}</button>` : '';
        }).join('');
        return `<div class="gygs-r">
            <div class="gygs-r-hd">
              <b>${esc(who || '不知道是谁')}</b>
              <span>${ago(r.at)}　${r.kind === 'date' ? '一起出去' : '小剧场'}</span>
              <span style="margin-left:auto;">
                ${r.told ? '' : `<button class="gygs-mini" onclick="gygsTell('${r.id}')">让人来跟我说</button>`}
                <button class="gygs-mini" onclick="gygsDel('${r.id}')">删</button>
              </span>
            </div>
            ${r.told ? `
              <div class="gygs-lane told"><u>🗣️ ${esc(r.told.byName)} 跟你说的版本${r.told.faithful ? '（如实转述）' : ''}</u><p>${esc(r.told.text)}</p></div>
              ${showTruth ? `<div class="gygs-lane truth"><u>👁️ 实际发生的（开天眼，角色不知道你能看见）</u><p class="gygs-blur" onclick="this.classList.toggle('gygs-blur')" title="点一下看">${esc(r.truth)}</p>
                ${r.told.distort ? `<div class="gygs-diff">差在哪儿：${esc(r.told.distort)}</div>`
                  : (r.told.faithful ? '<div class="gygs-diff" style="color:#17bf63;background:rgba(23,191,99,.08);">这条是如实转述，事实没被改动</div>' : '')}</div>` : ''}
              ${(r.asks || []).map(a => `<div class="gygs-lane ask"><u>❓ 你去问了 ${esc(a.whoName)}，TA 说</u><p>${esc(a.a)}</p></div>`).join('')}
              <div style="margin-top:6px;">${subjBtns}
                <button class="gygs-mini" onclick="gygsTell('${r.id}')">换个人再说一遍</button></div>
            ` : (showTruth
                  // 开着天眼：原文给你看，但默认糊着，点一下才显形——免得一眼扫过去把剧透全吃了
                  ? `<div class="gygs-lane truth"><u>还没人跟你提过这件事（开天眼，点一下看原文）</u>
                       <p class="gygs-blur" onclick="this.classList.remove('gygs-blur')">${esc(r.truth.slice(0, 120))}</p></div>`
                  // 关了天眼：你只知道"他们之间发生过点什么"，具体是什么得等人来跟你说
                  : `<div class="gygs-lane truth"><u>还没人跟你提过这件事</u>
                       <p style="color:#8b98a5;">这俩人之间发生过点什么，但你还不知道是什么。找个人来跟你说说。</p></div>`)}
        </div>`;
    }

    function tabFeed() {
        const told = S.rumors.filter(r => r.told).slice().reverse();
        return `<div class="gygs-hint">这些是角色**转述**给你的版本——不是实录。每一条都可以拿去问当事人。</div>
          <div id="gygsStatus" style="font-size:12px;color:#8b98a5;margin-bottom:8px;"></div>
          ${told.length ? told.map(r => rumorCard(r, S.godMode)).join('')
            : '<div class="gygs-hint" style="padding:20px 0;text-align:center;">还没人跟你说过什么。<br>去「还没传开的」那一页，挑一件事让人来跟你提。</div>'}`;
    }
    function tabPool() {
        const pool = S.rumors.filter(r => !r.told).slice().reverse();
        return `<div class="gygs-hint">这些事已经发生了（来自小剧场记录和"一起出去"的记录），但还没有人跟你提起。
          点「让人来跟我说」，插件会挑一个<b>不在场、但跟当事人有关系</b>的角色，用 TA 的立场转述给你——会失真，这是故意的。</div>
          <button class="gygs-btn ghost" onclick="gygsCollect()">🔄 现在收一遍新发生的事</button>
          <div id="gygsStatus" style="font-size:12px;color:#8b98a5;margin:6px 0 8px;"></div>
          ${pool.length ? pool.map(r => rumorCard(r, S.godMode)).join('')
            : '<div class="gygs-hint" style="padding:20px 0;text-align:center;">池子是空的。<br>先让小剧场跑几场（设置 → AI 增强功能 → 角色之间的后台小剧场），或者去行程插件约角色出去一趟。</div>'}`;
    }
    function tabRule() {
        const sw = (k, title, desc, warn) => `<label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;padding:9px 0;">
            <input type="checkbox" ${S[k] ? 'checked' : ''} onchange="gygsSet('${k}',this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;">
            <span><b>${title}</b><br><span style="font-size:11.5px;color:#8b98a5;line-height:1.7;">${desc}</span>${warn ? `<br><span style="font-size:11.5px;color:#f91880;">${warn}</span>` : ''}</span></label>`;
        const theaterOn = (typeof isAutoOn === 'function') ? isAutoOn('charTheater') : false;
        return `
        <div class="gygs-sec">
          <h4>📥 事从哪儿来</h4>
          ${sw('fromTheater', '角色之间的后台小剧场', '有关系的两个角色背着你发生的事，全都进传闻池。',
              theaterOn ? '' : '⚠️ 你还没打开「设置 → AI 增强功能 → 角色之间的后台小剧场」，池子里不会有新东西进来。')}
          ${sw('fromDates', '你和角色一起出去的事', '行程与天气插件里"约出去"成了的记录，也会变成别人嘴里的谈资——别人会怎么说你俩，就有意思了。')}
        </div>

        <div class="gygs-sec">
          <h4>✏️ 转述的时候要不要改写</h4>
          ${sw('distort', '让转述失真（这是这个插件的核心）',
              '打开＝转述的人会记混、漏掉、说反、甚至记错人，你听到的就不一定是真的，得自己去问去判断。关掉＝<b>如实转述</b>，事实一个字不改，只保留转述者自己的口吻和立场——想要"知道发生了什么，但想听不同的人怎么说这件事"就关掉。')}
          ${S.distort ? `<div style="margin:2px 0 6px;">
            <div class="gygs-hint" style="margin-bottom:6px;">走样到什么程度：</div>
            ${[['light', '一点点', '细节有出入，主要事实不会错'],
               ['mid', '明显', '至少一处对不上——时间地点、因果、程度'],
               ['heavy', '离谱', '传了好几手，把因果说反、把人记错，还会掺进没发生的推测']]
              .map(([k, n, d]) => `<button class="gygs-mini ${S.distortLevel === k ? 'on' : ''}" onclick="gygsLevel('${k}')" title="${d}">${n}</button>`).join('')}
            <div class="gygs-hint" style="margin-top:6px;">${esc({ light: '细节有出入，主要事实不会错。', mid: '至少一处对不上——时间地点、因果、或者程度。', heavy: '传了好几手：把因果说反、把人记错，还会掺进其实没发生的推测，而且说的人自己也信。' }[S.distortLevel] || '')}</div>
          </div>` : '<div class="gygs-hint" style="margin:2px 0 8px;">现在是<b>如实转述</b>：事实不会被改，但每个人说这件事的语气和偏向还是不一样的。</div>'}
        </div>

        <div class="gygs-sec">
          <h4>💰 花钱的地方（只有两处）</h4>
          <div class="gygs-hint">转述一次一次调用、去问当事人一次一次调用。<b>你不点就完全不花钱。</b></div>
          ${sw('auto', '自动传播：隔一段时间自己挑一条讲给你', '不用你点，池子里有货就自己挑一条、挑个人讲给你，带通知。默认关——这是这个插件唯一会自己花钱的地方。')}
          ${S.auto ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0 10px;">
            <span style="font-size:13px;color:#8b98a5;">每隔</span>
            <input class="gygs-in" id="gygsAutoH" type="number" min="1" value="${S.autoHours}" style="max-width:80px;margin:0;">
            <span style="font-size:13px;color:#8b98a5;">小时最多讲一条</span>
          </div>` : ''}
        </div>

        <div class="gygs-sec">
          <h4>👁️ 开天眼</h4>
          ${sw('godMode', '面板里显示"实际发生的是什么"', '关掉之后你就只能看到别人转述的版本，跟角色一样蒙在鼓里——想玩"信谁"的那种感觉就关掉。打开时原文默认是糊的，点一下才看得见。')}
        </div>

        <div class="gygs-sec">
          <h4>⚙️ 参数</h4>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <span style="font-size:13px;color:#8b98a5;min-width:150px;">每个角色最多注入几条传闻</span>
            <input class="gygs-in" id="gygsInject" type="number" min="0" value="${S.inject}" style="max-width:80px;margin:0;">
            <span style="font-size:12px;color:#8b98a5;">条（0 ＝ 不注入，只当个看的）</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <span style="font-size:13px;color:#8b98a5;min-width:150px;">传闻池最多存</span>
            <input class="gygs-in" id="gygsKeep" type="number" min="1" value="${S.keep}" style="max-width:80px;margin:0;">
            <span style="font-size:12px;color:#8b98a5;">条</span>
          </div>
          <button class="gygs-btn" onclick="gygsSaveNums()">💾 保存</button>
          <button class="gygs-btn danger" onclick="gygsClearAll()">清空传闻池</button>
          <div id="gygsStatus" style="font-size:12px;color:#8b98a5;margin-top:6px;"></div>
        </div>

        <div class="gygs-sec">
          <h4>📄 现在注给角色的是什么样</h4>
          <select class="gygs-in" id="gygsPreviewWho" onchange="gygsPreview()" style="max-width:220px;display:inline-block;">
            ${chars().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') || '<option value="">还没有角色</option>'}
          </select>
          <button class="gygs-btn ghost" onclick="gygsPreview()">看看</button>
          <pre id="gygsPreview" style="white-space:pre-wrap;word-break:break-all;font-size:12px;color:#8b98a5;background:rgba(128,128,128,.06);border-radius:8px;padding:10px;margin-top:8px;max-height:260px;overflow:auto;font-family:inherit;"></pre>
        </div>`;
    }

    window.gygsSet = function (k, v) { S[k] = !!v; save(); renderPanel(); };
    // 🎛️ 给「全部开关」页读当前状态用（js/54）
    window.gygsGet = k => !!S[k];
    window.gygsLevel = function (k) { S.distortLevel = k; save(); renderPanel(); };
    window.gygsSaveNums = function () {
        const g = id => { const e = document.getElementById(id); return e ? parseInt(e.value) : NaN; };
        const i = g('gygsInject'), k = g('gygsKeep'), h = g('gygsAutoH');
        if (!isNaN(i)) S.inject = Math.max(0, i);   // 不设上限
        if (!isNaN(k)) S.keep = Math.max(1, k);
        if (!isNaN(h)) S.autoHours = Math.max(1, h);
        if (S.rumors.length > S.keep) S.rumors.splice(0, S.rumors.length - S.keep);
        save(); renderPanel();
        const st = document.getElementById('gygsStatus'); if (st) st.innerText = '保存好了。';
    };
    window.gygsCollect = async function () {
        const n = await collect();
        renderPanel();
        const st = document.getElementById('gygsStatus');
        if (st) st.innerText = n ? `收进来 ${n} 件新的。` : '没有新发生的事。';
    };
    window.gygsDel = async function (id) { S.rumors = S.rumors.filter(r => r.id !== id); await save(); renderPanel(); };
    window.gygsClearAll = async function () { S.rumors = []; S.seen = {}; await save(); renderPanel(); };
    window.gygsPreview = function () {
        const sel = document.getElementById('gygsPreviewWho');
        const out = document.getElementById('gygsPreview');
        if (!out) return;
        const id = sel && sel.value;
        out.innerText = id ? (window.__gyGossipCtxFor(id) || '（这个角色现在既不是当事人、也没转述过什么，不会注入任何东西）') : '还没有角色。';
    };

    // ---------- 自动传播（默认关）----------
    async function autoTick() {
        try {
            if (!S.auto) return;
            const gap = Math.max(0, gyNum(S.autoHours, 6)) * 3600000;
            if (Date.now() - (S.lastAuto || 0) < gap) return;
            await collect();
            const pool = S.rumors.filter(r => !r.told);
            if (!pool.length) return;
            S.lastAuto = Date.now();
            await save();
            const r = pool[Math.floor(Math.random() * pool.length)];
            await gygsTell(r.id);
        } catch (e) { console.warn('[八卦网] 自动传播出错：', e); }
    }

    // ---------- 入口 ----------
    function addEntries() {
        const menu = document.querySelector('#setIndex .set-menu');
        if (menu && !document.getElementById('gygsSetEntry')) {
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = 'set-entry'; btn.id = 'gygsSetEntry';
            btn.onclick = () => gygsOpen();
            btn.innerHTML = '<span class="set-entry-ico">🗣️</span><span class="set-entry-main"><span class="set-entry-title">八卦网</span><span class="set-entry-desc">你听到的事是二手的、变形的、带立场的</span></span><span class="set-entry-arrow">›</span>';
            const sep = menu.querySelector('.set-menu-sep');
            if (sep) menu.insertBefore(btn, sep); else menu.appendChild(btn);
        }
    }

    (async function init() {
        await load();
        mount();
        addEntries();
        const sw = window.switchMainView;
        if (typeof sw === 'function' && !sw.__gygsPatched) {
            window.switchMainView = function () {
                // （好感度同步由上面关系账本自己的切页钩子做；这里以前抄了一行 syncAll()，
                //  但那个函数不在这个模块里，每次切页都白抛一次错，删了）
                const r = sw.apply(this, arguments);
                try { setTimeout(addEntries, 0); } catch (e) {}
                return r;
            };
            window.switchMainView.__gygsPatched = true;
        }
        setTimeout(() => { collect(); }, 6000);
        setInterval(() => { collect(); }, 10 * 60000);          // 收事件是纯本地的，不花钱
        setInterval(() => { autoTick(); }, 15 * 60000);          // 自动传播默认关，开了才会花钱
        console.info('[八卦网] 已加载：池子里 ' + S.rumors.length + ' 条，其中 '
            + S.rumors.filter(r => r.told).length + ' 条已经有人跟你说过了');
    })();
})();
