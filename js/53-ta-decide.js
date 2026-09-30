/* ============================================================
   js/53 —— 🎲 TA 定：能填数字的地方，都可以交给角色自己决定
   ------------------------------------------------------------
   每个"跟角色行为有关"的数字框旁边多一个小按钮「🎲 TA 定」。按下去之后这个框就不用填了：
     · 字数 / 条数（聊天、推文、日记、信、评论、聊天几条、联网感想）——
         生成的时候不再告诉 TA "不超过 N 字"，而是"长短你自己按此刻的心情和要说的事定"。
         （做法：变量换成一个占位数，发请求前把"不超过 占位数 字"整句换掉，其它代码一行不用改。）
     · 频率 / 间隔（发推、主动聊天、写信、论坛、匿名区、联网、回信要等多久、忙完多久回、
         自动模式等几秒再回、自主模式的最快最慢）——
         每做完一次，问 TA 一句"下次大概隔多久"，按 TA 说的来（一次小调用）。
         还没问过的时候先去问，问到之前不会自己跑。
     · 帖子下面几个人来互动——不按数字砍：被点名的、有关系的、最近聊过的一定来，
         其余的按各自性子掷一次（话多的常来，高冷的少来），不调 API。
   不在这里的：温度/采样、正则深度、世界书权重、注入条数、总结频率这些技术参数——交给角色定没有意义。

   另外，这个文件顺手把所有数字框的 min / max 拿掉（技术参数除外）：填多少就是多少，不再被悄悄改掉。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyTaLoaded) return;
    window.__gyTaLoaded = true;

    const LSK = 'gy_ta_decide';
    let ST = { g: {}, real: {} };
    try { Object.assign(ST, JSON.parse(localStorage.getItem(LSK) || '{}') || {}); } catch (e) {}
    if (!ST.g) ST.g = {}; if (!ST.real) ST.real = {};
    const saveST = () => { try { localStorage.setItem(LSK, JSON.stringify(ST)); } catch (e) {} };

    // 数据变了：让开着的「今天」/时间管理大师重画（js/01 的 gyDataChanged 会合并成一次）
    const changed = () => {
        try {
            if (typeof window.gyDataChanged === 'function') window.gyDataChanged('today');
            else if (typeof window.gyTodayRender === 'function') setTimeout(window.gyTodayRender, 50);
        } catch (e) {}
    };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ---------- 哪些框可以「TA 定」 ---------- */
    // scope g＝全局设置；c＝角色编辑页里、每个角色自己的
    // words：字数/条数（占位数 S + 对应的全局变量）
    const WORD_VARS = {
        chatWordLimit: v => { chatWordLimit = v; }, postWordLimit: v => { postWordLimit = v; },
        diaryWordLimit: v => { diaryWordLimit = v; }, letterWordLimit: v => { letterWordLimit = v; },
        commentWordLimit: v => { commentWordLimit = v; },
        chatMsgCountMin: v => { chatMsgCountMin = v; }, chatMsgCountMax: v => { chatMsgCountMax = v; }
    };
    const F = [
        { key: 'limitChat', scope: 'g', kind: 'words', v: 'chatWordLimit', S: 91001 },
        { key: 'limitPost', scope: 'g', kind: 'words', v: 'postWordLimit', S: 91002 },
        { key: 'limitDiary', scope: 'g', kind: 'words', v: 'diaryWordLimit', S: 91003 },
        { key: 'limitLetter', scope: 'g', kind: 'words', v: 'letterWordLimit', S: 91004 },
        { key: 'limitComment', scope: 'g', kind: 'words', v: 'commentWordLimit', S: 91005 },
        { key: 'limitChatMsgCountMin', scope: 'g', kind: 'words', v: 'chatMsgCountMin', S: 91006, also: 'limitChatMsgCountMax' },
        { key: 'limitChatMsgCountMax', scope: 'g', kind: 'words', v: 'chatMsgCountMax', S: 91007, also: 'limitChatMsgCountMin' },
        { key: 'web.sayChars', scope: 'g', kind: 'flag', sel: "input[onchange*=\"gywebSetNum('sayChars'\"]", S: 91008 },
        { key: 'web.gapMin', scope: 'g', kind: 'flag', sel: "input[onchange*=\"gywebSetNum('gapMin'\"]" },
        { key: 'letterReplyDelayMinInput', scope: 'g', kind: 'flag', also: 'letterReplyDelayMaxInput' },
        { key: 'letterReplyDelayMaxInput', scope: 'g', kind: 'flag', also: 'letterReplyDelayMinInput' },
        { key: 'chatBatchDelaySec', scope: 'g', kind: 'flag' },
        { key: 'charInteractMaxInput', scope: 'g', kind: 'flag' },
        { key: 'aliveMinDelay', scope: 'g', kind: 'flag', also: 'aliveMaxDelay' },
        { key: 'aliveMaxDelay', scope: 'g', kind: 'flag', also: 'aliveMinDelay' },
        { key: 'aliveMaxHold', scope: 'g', kind: 'flag' },
        // 每个角色自己的
        { key: 'freqInterval', scope: 'c', unit: 'freqUnit' },
        { key: 'chatFreqInterval', scope: 'c', unit: 'chatFreqUnit' },
        { key: 'letterFreqInterval', scope: 'c', unit: 'letterFreqUnit' },
        { key: 'forumFreqInterval', scope: 'c', unit: 'forumFreqUnit' },
        { key: 'anonFreqInterval', scope: 'c', unit: 'anonFreqUnit' },
        { key: 'charWebGap', scope: 'c' },
        { key: 'charWebPerDay', scope: 'c' },
        { key: 'autonomyMinMinutes', scope: 'c' },
        { key: 'autonomyMaxHours', scope: 'c' }
    ];
    const byKey = k => F.find(f => f.key === k);
    const elOf = f => f.sel ? document.querySelector(f.sel) : document.getElementById(f.key);

    // 间隔类：key → 由哪个开关决定、问 TA 的时候怎么说
    const GAPS = {
        post: { c: 'freqInterval', say: '发一条推文', unit: 'min' },
        chat: { c: 'chatFreqInterval', say: '主动找对方聊天', unit: 'min' },
        letter: { c: 'letterFreqInterval', say: '主动给对方写一封信', unit: 'min' },
        forum: { c: 'forumFreqInterval', say: '在论坛发个帖', unit: 'min' },
        anon: { c: 'anonFreqInterval', say: '去匿名论坛发一条', unit: 'min' },
        web: { c: 'charWebGap', g: 'web.gapMin', say: '上网搜点自己想了解的东西看看', unit: 'min' },
        aliveAfter: { g: 'aliveMinDelay', say: '忙完手头的事之后，看手机回对方消息', unit: 'min', ttl: 12 * 3600000, habit: true },
        letterReply: { g: 'letterReplyDelayMinInput', say: '收到对方的信之后回信', unit: 'min', ttl: 12 * 3600000, habit: true },
        batch: { g: 'chatBatchDelaySec', say: '对方连着发消息的时候，等一等再一起回', unit: 'sec', ttl: 12 * 3600000, habit: true },
        aliveHold: { g: 'aliveMaxHold', say: '在忙或者在睡的时候，最久能多久完全不看手机', q: '你在忙或者在睡的时候，最久能多久完全不看手机', unit: 'min', ttl: 24 * 3600000, habit: true },
        webPerDay: { c: 'charWebPerDay', say: '上网看东西', q: '你一天最多会上网搜东西看几次', unit: 'count', ttl: 24 * 3600000, habit: true },
        autoMin: { c: 'autonomyMinMinutes', say: '自己想起来做点什么', q: '你最快隔多久就会又自己想起来做点什么（发条推、找对方、写点东西…）', unit: 'min', ttl: 24 * 3600000, habit: true },
        autoMax: { c: 'autonomyMaxHours', say: '什么都不主动做', q: '你最长能隔多久什么都不主动做（发推、找对方、写东西都不做）', unit: 'min', ttl: 24 * 3600000, habit: true }
    };
    // 数字框 → 按下「TA 定」时要马上问的那一项
    const FIELD_GAP = {
        freqInterval: 'post', chatFreqInterval: 'chat', letterFreqInterval: 'letter', forumFreqInterval: 'forum', anonFreqInterval: 'anon',
        charWebGap: 'web', charWebPerDay: 'webPerDay', autonomyMinMinutes: 'autoMin', autonomyMaxHours: 'autoMax',
        'web.gapMin': 'web', aliveMinDelay: 'aliveAfter', aliveMaxDelay: 'aliveAfter', aliveMaxHold: 'aliveHold',
        letterReplyDelayMinInput: 'letterReply', letterReplyDelayMaxInput: 'letterReply', chatBatchDelaySec: 'batch'
    };

    /* ---------- 状态读写 ---------- */
    const gOn = k => !!ST.g[k];
    window.gyTaGlobalOn = gOn;
    let FORM = {};                                      // 角色编辑页当前这一份
    // 模式：默认（按固定频率）＝完全按你的设置（填的数，或者你按了 TA 定的那几项）；
    //       由 TA 自己决定＝这些数一律 TA 定。只有一个例外：发推/主动聊天/写信/论坛/匿名这几个"到点就做"的计时器，
    //       你本来填 0（没开）的，自主模式下也还是不开——TA 想做这些走自主模式自己的决定。
    // 自主＝总开关「角色自己决定要做什么」开着 + 这个角色切到了「由 TA 自己决定」
    const autoSwitch = () => (typeof isAutoOn !== 'function') || isAutoOn('charAutonomy');
    const isAuto = c => !!c && autoSwitch() && ((typeof getCharActMode === 'function') ? getCharActMode(c) === 'auto' : c.actMode === 'auto');
    const allChars = () => (typeof myCharacters !== 'undefined' && Array.isArray(myCharacters)) ? myCharacters : [];
    // 全局的框（忙完多久回、回信等多久…）：所有角色都是自主的时候，这些数谁都不用了，一起锁上
    const allAuto = () => { const cs = allChars(); return cs.length > 0 && cs.every(isAuto); };
    window.gyTaAllAuto = allAuto;
    window.gyTaIsAuto = isAuto;
    const FREQ_OF = { freqInterval: 'postFreq', chatFreqInterval: 'chatFreq', letterFreqInterval: 'letterFreq', forumFreqInterval: 'forumPostFreq', anonFreqInterval: 'anonPostFreq' };
    const autoApplies = (char, k) => {
        if (!isAuto(char)) return false;
        const fk = FREQ_OF[k];
        if (fk) { const f = char[fk]; return !!(f && typeof f.interval === 'number' && f.interval > 0); }
        return true;
    };
    window.gyTaCharOn = (char, k) => !!(char && ((char.taDecide && char.taDecide[k]) || autoApplies(char, k)));
    // 某一项对这个角色是不是 TA 定（全局的框：你按了按钮，或者这个角色是自主模式）
    window.gyTaFieldOn = function (char, k) {
        const f = byKey(k); if (!f) return false;
        if (f.scope === 'c') return window.gyTaCharOn(char, k);
        return gOn(k) || isAuto(char);
    };
    const taFor = (char, gk) => { const d = GAPS[gk]; if (!d) return false; return !!((d.g && window.gyTaFieldOn(char, d.g)) || (d.c && window.gyTaCharOn(char, d.c))); };

    /* ---------- 问 TA "下次隔多久" ---------- */
    const asking = {};
    async function askGap(char, gk) {
        const d = GAPS[gk]; if (!char || !d) return;
        const k = String(char.id) + ':' + gk;
        if (asking[k]) return asking[k]; let done; asking[k] = new Promise(r => { done = r; });
        try {
            const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
            if (!api || !api.key || typeof callChatCompletionAPI !== 'function') return;
            const now = new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const u = d.unit === 'sec' ? '秒' : d.unit === 'count' ? '次' : '分钟';
            const q = d.habit
                ? `现在是${now}。按你的性子、你们现在的关系和你的生活节奏，想一想：${d.q || ('你一般' + d.say + '，会隔多久')}？`
                : `现在是${now}。你刚刚${d.say}了（或者该考虑这件事了）。按你的性子、最近的生活节奏和此刻的心情，你下一次大概隔多久会再${d.say}？`;
            const ask = `${q}
${d.unit === 'count' ? '按你自己的习惯定，像个真人。' : '想怎么定就怎么定，可以很快也可以很久，别凑整数，像个真人。'}
只输出 JSON，不要解释：{"n": 数字（单位：${u}）, "why": "一句话，15字以内，你自己的说法"}`;
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(char, false, '') : ('你是' + char.name);
            const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
            const data = await callChatCompletionAPI(api, msgs, 1);
            const raw = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
            let r = (typeof parseModelJson === 'function') ? parseModelJson(raw) : null;
            if (Array.isArray(r)) r = r[0];
            let n = r ? parseFloat(r.n) : NaN;
            if (!isFinite(n)) { const m = String(raw).match(/(\d+(?:\.\d+)?)/); n = m ? parseFloat(m[1]) : NaN; }
            if (!isFinite(n) || n < 0) return;
            if (!char.taGap) char.taGap = {};
            char.taGap[gk] = d.unit === 'count'
                ? { n: Math.round(n), ms: 0, why: String((r && r.why) || '').slice(0, 30), at: Date.now() }
                : { ms: Math.round(n * (d.unit === 'sec' ? 1000 : 60000)), why: String((r && r.why) || '').slice(0, 30), at: Date.now() };
            if (typeof saveAllData === 'function') saveAllData();
            console.info(`[TA 定] ${char.name}：${d.say} → ${n}${u}${r && r.why ? '（' + r.why + '）' : ''}`);
            changed();
            return char.taGap[gk];
        } catch (e) { console.warn('[TA 定] 问间隔失败：', e); }
        finally { asking[k] = null; try { done(char.taGap && char.taGap[gk]); } catch (e) {} changed(); }
    }
    window.gyTaAsk = askGap;

    // 📅「今天」面板用（⏳ 时间管理大师）：自主角色每件事现在的节奏
    const RHYTHM = [
        ['post', '发推', '📝', '上一条推文发出去之后，隔这么久 TA 会再发一条。'],
        ['chat', '主动找你', '💬', '你们最后一句话之后，隔这么久 TA 会自己来找你说话。'],
        ['letter', '写信', '✉️', '上一封信寄出之后，隔这么久 TA 会再给你写一封。'],
        ['forum', '论坛发帖', '🏛️', '上一个帖子之后，隔这么久 TA 会再去论坛发一个。'],
        ['anon', '匿名区', '🎭', '上一条匿名发言之后，隔这么久 TA 会再去匿名区说点什么。'],
        ['web', '上网看东西', '🌐', '上一次上网之后，隔这么久 TA 会再去搜点自己想看的。'],
        ['webPerDay', '一天上网', '📶', '一天里 TA 最多上网看东西的次数。'],
        ['aliveAfter', '忙完多久回你', '📱', 'TA 在忙的时候你发了消息，忙完之后再过这么久 TA 才看手机回你。'],
        ['aliveHold', '最久不看手机', '🔕', '在忙或者在睡的时候，TA 最多这么久完全不看手机，到点了怎么都会看一眼。'],
        ['letterReply', '收到信多久回', '📮', '你寄出一封信之后，TA 大概隔这么久回信。'],
        ['batch', '你连发时等一等', '⏳', '你连着发好几条的时候，TA 会等这么久，等你说完再一起回。']
    ];
    // 这件事上一次是什么时候做的（算"下一次大概什么时候"用）
    // 不管是计时器、自主模式还是聊天里说到做到做的，都看真实数据（信存的是 date，不是 timestamp）
    const tsOf = x => { if (!x) return 0; const v = x.date || x.timestamp || x.time || x.at || 0; const n = typeof v === 'number' ? v : Date.parse(v); return isFinite(n) ? n : 0; };
    const maxOf = (list, pick) => { let t = 0; (list || []).forEach(x => { try { if (pick(x)) t = Math.max(t, tsOf(x)); } catch (e) {} }); return t; };
    const gArr = name => {
        try {
            let v = null;
            if (name === 'globalPosts') v = typeof globalPosts !== 'undefined' ? globalPosts : null;
            else if (name === 'forumThreads') v = typeof forumThreads !== 'undefined' ? forumThreads : null;
            else if (name === 'anonPosts') v = typeof anonPosts !== 'undefined' ? anonPosts : null;
            return Array.isArray(v) ? v : [];
        } catch (e) { return []; }
    };
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);
    function realLast(c, what) {
        try {
            const id = c.id;
            if (what === 'post') return maxOf(gArr('globalPosts'), p => p && p.char && sameId(p.char.id, id) && !p.isRepost);
            if (what === 'forum') return maxOf(gArr('forumThreads'), t => t && sameId(t.authorCharId, id));
            if (what === 'anon') return maxOf(gArr('anonPosts'), p => p && sameId(p.charId, id));
            if (what === 'letter') return maxOf((c.diaryData && c.diaryData.letters) || [], l => l && l.author !== 'user');
            if (what === 'diary') return maxOf((c.diaryData && c.diaryData.diaries) || [], d => d && d.author !== 'user');
            if (what === 'moment') { let t = 0; (Array.isArray(window.gyPeerLog) ? window.gyPeerLog : []).forEach(e => { if (e && e.kind === 'moment' && sameId(e.aId, id) && e.at > t) t = e.at; }); return t; }
            if (what === 'comment') { let t = 0; gArr('globalPosts').forEach(p => (p && p.replies || []).forEach(r => { if (r && r.char && sameId(r.char.id, id) && (r.timestamp || 0) > t) t = r.timestamp; })); return t; }
            if (what === 'nudge') { const h = (typeof globalChats !== 'undefined' && globalChats) ? globalChats[String(id)] : null; let t = 0; (h || []).forEach(m => { if (m && m.sender === 'system' && String(m.text || '').indexOf('"' + c.name + '" 拍了拍') === 0 && (m.timestamp || 0) > t) t = m.timestamp; }); return t; }
            if (what === 'status') return (c.lifeState && c.lifeState.updatedAt) || 0;
            if (what === 'todo_add') { let t = 0; (c.todos || []).forEach(x => { if (x && x.source === 'ai' && (x.createdAt || 0) > t) t = x.createdAt; }); return t; }
            if (what === 'todo_done') { let t = 0; (c.todos || []).forEach(x => { if (x && x.done && (x.doneAt || 0) > t) t = x.doneAt; }); return t; }
        } catch (e) {}
        return 0;
    }
    function lastDone(c, gk) {
        try {
            if (gk === 'post') return Math.max(c.lastPostTime || 0, realLast(c, 'post'));
            if (gk === 'forum') return Math.max(c.lastForumPostTime || 0, realLast(c, 'forum'));
            if (gk === 'anon') return Math.max(c.lastAnonPostTime || 0, realLast(c, 'anon'));
            if (gk === 'chat') { const h = (typeof globalChats !== 'undefined' && globalChats) ? globalChats[c.id] : null; return (h && h.length) ? (h[h.length - 1].timestamp || 0) : 0; }
            if (gk === 'letter') return Math.max(c.lastLetterProactiveTime || 0, realLast(c, 'letter'));
        } catch (e) {}
        return 0;
    }
    window.gyTaRhythm = function (char) {
        if (!isAuto(char)) return null;
        const web = typeof window.gywebWants !== 'function' || window.gywebWants(char);
        return RHYTHM.filter(([gk]) => taFor(char, gk) && (web || (gk !== 'web' && gk !== 'webPerDay'))).map(([gk, label, icon, desc]) => {
            const d = GAPS[gk], g = char.taGap && char.taGap[gk];
            const text = !g ? '' : d.unit === 'count' ? (isFinite(g.n) ? `最多 ${g.n} 次` : '') : fmtGap(g, d);
            const ld = lastDone(char, gk);
            const next = (g && g.ms && ld) ? ld + g.ms : 0;
            return { gk, label, icon, desc, text, why: (g && g.why) || '', at: (g && g.at) || 0, ms: (g && g.ms) || 0, n: g && g.n, last: ld, next, busy: !!asking[String(char.id) + ':' + gk] };
        });
    };
    window.gyTaAskOne = async function (charId, gk) {
        const c = allChars().find(x => String(x.id) === String(charId)); if (!c || !GAPS[gk]) return null;
        const r = await askGap(c, gk);
        try { if (typeof window.gyTodayRender === 'function') window.gyTodayRender(); } catch (e) {}
        return r;
    };
    window.gyTaAskMissing = async function (charId) {
        const c = allChars().find(x => String(x.id) === String(charId)); if (!c) return;
        const list = (window.gyTaRhythm(c) || []).filter(r => !r.text).map(r => r.gk);
        try { showToast('', '🎲 TA 定', list.length ? `在问 ${c.name}（${list.length} 件事）…` : `${c.name} 都定好了，重新问一遍`, null, null, false); } catch (e) {}
        for (const gk of (list.length ? list : RHYTHM.map(r => r[0]).filter(gk => taFor(c, gk)))) await askGap(c, gk);
        try { if (typeof window.gyTodayRender === 'function') window.gyTodayRender(); } catch (e) {}
    };

    /* ---------- ⏳ 时间管理大师：自主模式里每一件能做的事，各有一张时间卡 ----------
       上面那张表只管"到点就做"的几个计时器（发推/找你/写信/论坛/匿名/上网），而且你没填频率的就不出现。
       可自主模式能做的事远不止这些：写日记、评论、给营销号递料、约你出去、送东西、打电话、找关系网里的人……
       这里把自主模式此刻**做得成的每一件事**都列出来，每件一张卡：TA 自己说"这件事我一般多久做一次"。
       · **不定时重问**。卡上的数就放在那：TA 真做了这件事，做的那一次顺便定下一次大概隔多久（不多花调用）。
         想一口气让 TA 全定一遍，点卡片上的 🎲 按钮（一次调用问完所有事）。
       · 真人做事是随机的，常常是**遇到了什么事**才去写日记、发推，而且会一件接一件：
           - 卡上的数不是闹钟，也不拦着：做得成的事全摆上桌，想做随时做（js/14）
           - 一次可以做好几件，每件可以马上做，也可以"等有空再做"（排进 TA 自己的队列）
           - 最近身上发生了事（跟谁来往了、演了一场、收到东西……）：可能让 TA 马上停下来想想怎么反应
           - 没有时间上下限：下次什么时候再想，TA 说多久就多久
       · 决策时会告诉 TA "你上次说大概多久做一次、上次是什么时候、刚发生了什么"，TA 自己掂量 */
    const ACT_META = {
        post: ['📝', '发推', '想说点什么、想记录一下，就发一条推文。'],
        chat: ['💬', '主动找你', '不等你先开口，自己来找你说话。'],
        letter: ['✉️', '给你写信', '有些话不适合发消息说，写成信寄给你。'],
        diary: ['📔', '写日记', '只写给自己看的日记。'],
        forum: ['🏛️', '论坛发帖', '去小说论坛发一个跟兴趣、正事有关的帖子。'],
        anon: ['🎭', '匿名区', '实名说不出口的话，去匿名区说。'],
        comment: ['🗨️', '评论别人', '刷到别人的推文，忍不住说两句。'],
        like: ['❤️', '默默点赞', '看到了，不想说话，只点个赞。'],
        nudge: ['👉', '拍一拍你', '没什么正事，就是想戳你一下。'],
        status: ['🟢', '换状态', '手头的事换了、心情变了，换一下此刻的状态。'],
        todo_done: ['✅', '办掉待办', '把待办清单上的一件事办了。'],
        todo_add: ['🗒️', '记新待办', '刚想起来的、刚答应别人的，记进清单。'],
        theater: ['🎬', '小剧场', '去找关系网里的某个人：约人、堵人、偶遇。演完记进「Ta们在做什么」。'],
        peer: ['📨', '找熟人', '用手机找关系网里认识的人：私聊、写信、转账、送东西、打电话、评论 TA 的帖子……都存在 TA 的手机里。'],
        tabloid: ['📰', '给营销号递料', '把某件事捅出去，让八卦号去写。'],
        music_invite: ['🎵', '约你听歌', '想跟你一起听首歌。'],
        invite_user: ['🚶', '约你出去', '约你出门走走。'],
        go_place: ['📍', '换个地方待', '从一个地方挪到另一个地方。'],
        kit_move: ['🎒', '送/丢东西', '把随身的东西送出去，或者弄丢、用坏。'],
        day_mark: ['🎂', '记日子', '把某一天记成对自己有意义的日子。'],
        web_explore: ['🌐', '上网看看', '上网查点自己感兴趣的东西。'],
        phone_peek: ['📱', '想看你手机', '想看看你的手机。'],
        dress_change: ['🖼️', '换头像壁纸', '想换个头像或者壁纸。'],
        call_invite: ['📞', '给你打电话', '直接打个电话给你。'],
        group_talk: ['👥', '群里说话', '去某个群里说句话。']
    };
    // 跟上面"到点就做"那几张重复的：那张已经在了就不再多列一张
    const ACT_DUP = { post: 'post', chat: 'chat', letter: 'letter', forum: 'forum', anon: 'anon', web_explore: 'web' };
    // 自主动作 key → 去哪份真实数据里找"上一次"
    const REAL_OF = { diary: 'diary', moment_self: 'moment', comment: 'comment', nudge: 'nudge', status: 'status', todo_add: 'todo_add', todo_done: 'todo_done' };
    const actsOf = char => {
        try {
            if (typeof GY_AUTONOMY_ACTIONS === 'undefined') return [];
            return GY_AUTONOMY_ACTIONS.filter(a => a && a.key && a.key !== 'nothing' && (() => { try { return a.need(char); } catch (e) { return false; } })());
        } catch (e) { return []; }
    };
    const metaOf = a => ACT_META[a.key] || [a.icon || '✨', a.short || String(a.label || a.key).slice(0, 8), a.desc || String(a.label || '')];
    // 卡片分三堆：冲着你的 / 跟别人的 / 自己的日子（没登记的算自己的）
    const CAT = {
        chat: 'you', letter: 'you', nudge: 'you', music_invite: 'you', invite_user: 'you', phone_peek: 'you', call_invite: 'you',
        comment: 'others', like: 'others', theater: 'others', peer: 'others', tabloid: 'others', group_talk: 'others'
    };
    const catOf = a => a.cat || CAT[a.key] || 'self';
    // 这件事上一次是什么时候做的：自主日志里做成的那次；发推/论坛这类再看一眼真实数据；找熟人/小剧场看两人之间的记录
    function lastAct(c, key) {
        let t = 0;
        try { (c.autonomyLog || []).forEach(l => { if (l && l.action === key && l.ok !== false && l.at > t) t = l.at; }); } catch (e) {}
        try { if (ACT_DUP[key] && ACT_DUP[key] !== 'web') t = Math.max(t, lastDone(c, ACT_DUP[key]) || 0); } catch (e) {}
        // 不经过自主日志做的（计时器到点、聊天里说到做到、你在界面上点的）：看真实数据
        try { const rk = REAL_OF[key]; if (rk) t = Math.max(t, realLast(c, rk) || 0); } catch (e) {}
        try { if (key === 'peer' && typeof window.gyPeerLastOf === 'function') t = Math.max(t, window.gyPeerLastOf(c.id) || 0); } catch (e) {}
        try {
            if (key === 'theater' && typeof globalTheaterLogs !== 'undefined')
                (globalTheaterLogs || []).forEach(l => { if (l && !l.peer && (String(l.charAId) === String(c.id) || String(l.charBId) === String(c.id)) && l.at > t) t = l.at; });
        } catch (e) {}
        return t;
    }
    const habitOf = (c, key) => (c && c.taHabit && c.taHabit.m && c.taHabit.m[key]) || null;
    const askingH = {};
    // 一次问完（keys 不给就问全部能做的事）
    async function askHabits(char, keys) {
        if (!char) return null;
        const k = String(char.id);
        if (askingH[k]) return askingH[k];
        const run = (async () => {
            try {
                const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
                if (!api || !api.key || typeof callChatCompletionAPI !== 'function') return null;
                let acts = actsOf(char);
                if (keys && keys.length) acts = acts.filter(a => keys.indexOf(a.key) !== -1);
                if (!acts.length) return null;
                const now = new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const list = acts.map(a => `- ${a.key}：${metaOf(a)[2] || a.label}`).join('\n');
                const ask = `现在是${now}。按你的性子、你的生活节奏、你跟身边这些人的关系，想一想下面每件事你**一般隔多久会做一次**：
${list}

像个真人：有的事一天好几次，有的事几个月都不一定做一次，别都差不多，别凑整数。
几乎不会做的事，n 填 0。
只输出 JSON，不要解释：{"事情的key": {"n": 分钟数, "why": "一句话，12字以内，你自己的说法"}, ...}`;
                const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(char, false, '') : ('你是' + char.name);
                const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
                const data = await callChatCompletionAPI(api, msgs, 1);
                const raw = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
                let r = (typeof parseModelJson === 'function') ? parseModelJson(raw) : null;
                if (Array.isArray(r)) r = r[0];
                if (!r || typeof r !== 'object') return null;
                if (!char.taHabit || typeof char.taHabit !== 'object') char.taHabit = { at: 0, m: {} };
                if (!char.taHabit.m) char.taHabit.m = {};
                let got = 0;
                acts.forEach(a => {
                    const v = r[a.key]; if (v == null) return;
                    const n = parseFloat(typeof v === 'object' ? v.n : v);
                    if (!isFinite(n) || n < 0) return;
                    char.taHabit.m[a.key] = { ms: n === 0 ? 0 : Math.round(n * 60000), never: n === 0, why: String((typeof v === 'object' && v.why) || '').slice(0, 24), at: Date.now() };
                    got++;
                });
                if (!got) return null;
                if (!keys || !keys.length) char.taHabit.at = Date.now();
                else if (!char.taHabit.at) char.taHabit.at = Date.now();
                if (typeof saveAllData === 'function') saveAllData();
                console.info(`[TA 定] ${char.name}：定了 ${got} 件事的习惯间隔`);
                return char.taHabit;
            } catch (e) { console.warn('[TA 定] 问习惯失败：', e); return null; }
            finally { askingH[k] = null; changed(); }
        })();
        askingH[k] = run;
        return run;
    }
    window.gyTaAskHabits = askHabits;
    // 以前这里每 3 天自动重问一遍。去掉了：卡上的数放在那，做了那件事才顺便定下一次。
    window.gyTaEnsureHabits = async function () {};
    // 做完一件事：TA 在决策时顺便说了"下次再做这件事大概隔多久"（js/14 的 nextSame）
    window.gyTaActDone = function (char, key, minutes, why) {
        try {
            if (!char || !key || key === 'nothing') return;
            const n = parseFloat(minutes);
            if (!isFinite(n) || n < 0) return;
            if (!char.taHabit || typeof char.taHabit !== 'object') char.taHabit = { at: 0, m: {} };
            if (!char.taHabit.m) char.taHabit.m = {};
            char.taHabit.m[key] = { ms: n === 0 ? 0 : Math.round(n * 60000), never: n === 0, why: String(why || '').slice(0, 24), at: Date.now() };
        } catch (e) {}
        changed();   // 没带 nextSame 也要重画：卡上的"上一次"变了
    };

    /* ---------- 身上刚发生的事：真人往往是遇到事了才去做点什么 ---------- */
    // 存下来的全留着（记忆库「最近碰上的事」里翻得到、删得掉）；做决定时只看上次之后的、最近几条（js/14）
    window.gyLifeEvent = function (charId, text, weight) {
        try {
            const c = allChars().find(x => String(x.id) === String(charId)); if (!c || !text) return;
            if (!Array.isArray(c.lifeEvents)) c.lifeEvents = [];
            c.lifeEvents.push({ at: Date.now(), t: String(text).replace(/\s+/g, ' ').trim() });
            // 自主角色：事情越大越可能让 TA 马上停下来想想（不是每件事都会）
            if (isAuto(c)) {
                const w = Math.max(0, Math.min(1, weight == null ? 0.5 : weight));
                const soon = Date.now() + (1 + Math.random() * 4) * 60000;   // 很快就停下来想想怎么反应（马上做还是放着，TA 自己定）
                if ((!c.nextAutonomyAt || c.nextAutonomyAt > soon) && Math.random() < w) { c.nextAutonomyAt = soon; changed(); }   // 「下次停下来想想」提前了
            }
        } catch (e) {}
    };
    // 上次自己拿主意之后发生的事
    window.gyTaEventsFor = function (char) {
        try {
            const since = Math.max(char.evSeenAt || 0, Date.now() - 2 * 86400000);
            return (char.lifeEvents || []).filter(e => e && e.at > since);
        } catch (e) { return []; }
    };
    // 这件事现在会不会摆上桌（随机，不是闹钟）：
    //   · 没定过间隔 → 会
    //   · 刚发生了事 → 会（TA 说"几乎不做"的事，也有小概率因为这件事破例）
    //   · 过了 TA 说的间隔 → 会
    //   · 还没到 → 越接近越可能，(已过去/间隔)³ 的概率想起来
    window.gyTaActReady = function (char, key, hasEvents) {
        try {
            if (!char || key === 'nothing') return true;
            const h = habitOf(char, key); if (!h) return true;
            if (h.never) return !!hasEvents && Math.random() < 0.15;
            if (hasEvents) return true;
            const last = lastAct(char, key); if (!last || !h.ms) return true;
            const r = (Date.now() - last) / h.ms;
            return r >= 1 || Math.random() < Math.pow(Math.max(0, r), 3);
        } catch (e) { return true; }
    };
    // 事件从哪来：跟谁演了一场 / 跟谁用手机来往了（js/14、js/56 都经 addTheaterLog）、收到别人送的东西（js/25 随身物）
    (function hookEvents(tries) {
        let ok = 0;
        try {
            const at0 = window.addTheaterLog;
            if (typeof at0 === 'function' && !at0.__gyEv) {
                window.addTheaterLog = function (entry) {
                    const r = at0.apply(this, arguments);
                    try {
                        const e = entry || {};
                        const sum = String(e.summary || '').replace(/^\S+\s/, e.peer ? '' : '$&');
                        if (e.dice && e.evA) {
                            const w = e.weight == null ? 0.4 : e.weight;
                            window.gyLifeEvent(e.charAId, e.evA, w);
                            window.gyLifeEvent(e.charBId, e.evB || `碰上了${e.charAName}`, w * 0.7);
                        } else if (e.peer) {
                            window.gyLifeEvent(e.charBId, `${e.charAName}找了你：${sum}`, 0.6);
                            window.gyLifeEvent(e.charAId, `你找了${e.charBName}：${sum}`, 0.15);
                        } else {
                            window.gyLifeEvent(e.charAId, `跟${e.charBName}：${sum}`, 0.4);
                            window.gyLifeEvent(e.charBId, `跟${e.charAName}：${sum}`, 0.4);
                        }
                    } catch (err) {}
                    return r;
                };
                window.addTheaterLog.__gyEv = true;
            }
            if (window.addTheaterLog && window.addTheaterLog.__gyEv) ok++;
        } catch (e) {}
        try {
            const k = window.gyKit;
            if (k && typeof k.add === 'function' && !k.add.__gyEv) {
                const add0 = k.add;
                k.add = function (ownerId, name, desc, from, fromName) {
                    const r = add0.apply(this, arguments);
                    try {
                        if (from && from !== 'self' && !window.__gyPeerApplying) window.gyLifeEvent(ownerId, `收到了${fromName || (from === 'me' ? '对方' : '别人')}送的「${name}」`, from === 'me' ? 0.7 : 0.5);
                    } catch (err) {}
                    return r;
                };
                k.add.__gyEv = true;
            }
            if (k && k.add && k.add.__gyEv) ok++;
        } catch (e) {}
        if (ok < 2 && (tries || 0) < 20) setTimeout(() => hookEvents((tries || 0) + 1), 500);
    })(0);
    // 还有一些事不经过哪个函数，是"数据里多了点东西"：隔几分钟扫一眼（纯本地，不花调用），只扫自主角色
    const clip = t => String(t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
    function scanEvents() {
        try {
            const now = Date.now();
            const posts = (typeof globalPosts !== 'undefined' && Array.isArray(globalPosts)) ? globalPosts : [];
            const today = new Date(); const md = (today.getMonth() + 1) + '-' + today.getDate();
            allChars().filter(isAuto).forEach(c => {
                const since = c.evScanAt || now;   // 第一次扫：只记个起点，不把旧事翻出来
                const id = String(c.id);
                if (c.evScanAt) {
                    // TA 自己的推文底下有人说话了
                    posts.forEach(p => {
                        if (!p || !p.char || String(p.char.id) !== id) return;
                        (p.replies || []).forEach(r => {
                            if (!r || !r.char || (r.timestamp || 0) <= since || String(r.char.id) === id) return;
                            window.gyLifeEvent(c.id, `${r.char.id === 'me' ? '对方' : r.char.name}在你的推文「${clip(p.text)}」底下说：${clip(r.text)}`, r.char.id === 'me' ? 0.5 : 0.35);
                        });
                    });
                    // 刷到对方刚发的推
                    posts.forEach(p => {
                        if (p && p.char && p.char.id === 'me' && (p.timestamp || 0) > since) window.gyLifeEvent(c.id, `刷到对方发了条推：${clip(p.text)}`, 0.2);
                    });
                    // 对方寄来的信
                    ((c.diaryData && c.diaryData.letters) || []).forEach(l => {
                        const t = l && (l.date || l.timestamp || 0);
                        if (l && l.author === 'user' && t > since) window.gyLifeEvent(c.id, `收到对方寄来的信《${clip(l.title) || '无题'}》`, 0.3);
                    });
                }
                // 今天是 TA 记着的日子（一天只记一次）
                if (c.evDayKey !== md) {
                    c.evDayKey = md;
                    const hits = [];
                    const mdOf = d => { const q = String(d || '').match(/(\d{1,2})\D+(\d{1,2})\D*$/); return q ? (+q[1] + '-' + +q[2]) : ''; };   // 2020-09-24 / 9月24日 / 09-24 都认
                    try { (c.anniversaries || []).forEach(a => { if (mdOf(a.date) === md) hits.push(a.label || a.name || '一个日子'); }); } catch (e) {}
                    try { if (c.birthdate && mdOf(c.birthdate) === md) hits.push('自己的生日'); } catch (e) {}
                    hits.forEach(h => window.gyLifeEvent(c.id, `今天是${h}`, 0.5));
                }
                c.evScanAt = now;
            });
        } catch (e) {}
    }
    window.__gyTaScanEvents = scanEvents;
    setTimeout(scanEvents, 8000);
    setInterval(scanEvents, 3 * 60000);
    const fmtMs = ms => fmtGap({ ms }, { unit: 'min' }).replace(/^约 /, '');
    const agoTxt = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? m + ' 分钟前' : m < 1440 ? Math.round(m / 60) + ' 小时前' : Math.round(m / 1440) + ' 天前'; };
    // 决策菜单里附一句"你一般多久做一次、上次是什么时候"
    // 给 js/14 自主决策用：这件事 TA 上次什么时候做的、TA 自己说过多久做一次
    window.gyTaLastAct = (c, key) => { try { return lastAct(c, key) || 0; } catch (e) { return 0; } };
    window.gyTaHabitOf = (c, key) => { try { return habitOf(c, key); } catch (e) { return null; } };
    window.gyTaAgo = t => agoTxt(t);
    window.gyTaFmtMs = ms => fmtMs(ms);
    window.gyTaActNote = function (char, key) {
        try {
            const h = habitOf(char, key); if (!h) return '';
            const last = lastAct(char, key);
            return `；你上次说过这件事${h.never ? '几乎不会做' : '大概隔' + fmtMs(h.ms) + '做一次'}${last ? '，上次是' + agoTxt(last) : ''}`;
        } catch (e) { return ''; }
    };
    function actRows(char, have) {
        return actsOf(char).filter(a => !(ACT_DUP[a.key] && have.has(ACT_DUP[a.key]))).map(a => {
            const [icon, label, desc] = metaOf(a);
            const h = habitOf(char, a.key);
            const last = a.secret ? 0 : lastAct(char, a.key);   // 偷偷做的事：卡上不写"上一次是什么时候"，不然一看就露馅
            const ms = h && !h.never ? h.ms : 0;
            return { gk: 'act:' + a.key, act: a.key, cat: catOf(a), label, icon, desc,
                text: !h ? '' : h.never ? '几乎不做' : '下次约隔 ' + fmtMs(h.ms),
                why: (h && h.why) || '', at: (h && h.at) || 0, ms, last, next: (ms && last) ? last + ms : 0,
                busy: !!askingH[String(char.id)] };
        });
    }
    const rh0 = window.gyTaRhythm;
    window.gyTaRhythm = function (char) {
        const base = rh0(char);
        if (!base) return base;
        const have = new Set(base.map(r => r.gk));
        return base.concat(actRows(char, have));
    };
    const one0 = window.gyTaAskOne;
    window.gyTaAskOne = async function (charId, gk) {
        if (!String(gk).startsWith('act:')) return one0(charId, gk);
        const c = allChars().find(x => String(x.id) === String(charId)); if (!c) return null;
        const r = await askHabits(c, [String(gk).slice(4)]);
        try { if (typeof window.gyTodayRender === 'function') window.gyTodayRender(); } catch (e) {}
        return r;
    };
    const miss0 = window.gyTaAskMissing;
    window.gyTaAskMissing = async function (charId) {
        const c = allChars().find(x => String(x.id) === String(charId));
        const needH = c && actsOf(c).some(a => !habitOf(c, a.key));
        const p = miss0(charId);
        if (needH) await askHabits(c);
        await p;
        try { if (typeof window.gyTodayRender === 'function') window.gyTodayRender(); } catch (e) {}
    };

    // 调用方：拿到"这件事现在该隔多久"。不是 TA 定的原样返回 fallback。
    // 行为类（发推/聊天…）没问过的时候返回 Infinity——问到之前不自己跑；
    // 习惯类（回信、忙完多久回、等几秒）没问过先用 fallback，同时去问。
    window.gyTaGapMs = function (char, gk, fallback) {
        try {
            if (!char || !taFor(char, gk)) return fallback;
            const d = GAPS[gk];
            const g = char.taGap && char.taGap[gk];
            if (g && isFinite(g.ms)) {
                if (d.ttl && Date.now() - (g.at || 0) > d.ttl) askGap(char, gk);
                return g.ms;
            }
            askGap(char, gk);
            return d.habit ? fallback : Infinity;
        } catch (e) { return fallback; }
    };
    // 做完一次之后：问下一次
    window.gyTaAfter = function (char, gk) {
        // 旧的间隔先留着（问到新的之前卡上照样有"下一次"，问失败了也不会从此没了下文），问到了再覆盖
        try { if (char && taFor(char, gk)) askGap(char, gk); } catch (e) {}
        changed();   // 刚做完：卡上"上一次 / 下一次"马上跟着变（问到新间隔之后 askGap 会再刷一次）
    };
    // 次数类（一天最多几次）：没问过先用 fallback，同时去问
    window.gyTaCount = function (char, gk, fallback) {
        try {
            if (!char || !taFor(char, gk)) return fallback;
            const d = GAPS[gk], g = char.taGap && char.taGap[gk];
            if (g && isFinite(g.n)) { if (d.ttl && Date.now() - (g.at || 0) > d.ttl) askGap(char, gk); return g.n; }
            askGap(char, gk);
            return fallback;
        } catch (e) { return fallback; }
    };
    window.gyTaBatchDelayMs = function (sessionId, fallback) {
        try {
            if (String(sessionId).startsWith('g_')) return fallback;
            const c = (myCharacters || []).find(x => String(x.id) === String(sessionId));
            return (c && window.gyTaFieldOn(c, 'chatBatchDelaySec')) ? window.gyTaGapMs(c, 'batch', fallback) : fallback;
        } catch (e) { return fallback; }
    };

    // 帖子下面谁来：被点名/有关系/最近聊过的一定来；其余按性子掷一次
    window.gyTaPickInteracting = function (list, contextText, authorId) {
        const text = String(contextText || '');
        const now = Date.now();
        return (list || []).filter(c => {
            try {
                const h = String(c.handle || '').replace('@', '');
                if (c.name && text.indexOf(c.name) !== -1) return true;
                if (h && text.toLowerCase().indexOf('@' + h.toLowerCase()) !== -1) return true;
                if (typeof charRelationships !== 'undefined' && Array.isArray(charRelationships) && authorId !== undefined
                    && charRelationships.some(r => (String(r.fromId) === String(c.id) && String(r.toId) === String(authorId)) || (String(r.toId) === String(c.id) && String(r.fromId) === String(authorId)))) return true;
                const chat = (typeof globalChats !== 'undefined' && globalChats) ? globalChats[c.id] : null;
                if (chat && chat.length && now - (chat[chat.length - 1].timestamp || 0) < 3 * 86400000) return true;
                const p = String(c.persona || '') + ' ' + String(c.bio || '');
                let pr = 0.3;
                if (/话多|话痨|活泼|外向|爱热闹|八卦|爱凑热闹|自来熟|开朗|跳脱|吵/.test(p)) pr = 0.65;
                if (/高冷|冷淡|寡言|少言|内向|孤僻|不爱说话|社恐|沉默|疏离|冷漠/.test(p)) pr = 0.1;
                return Math.random() < pr;
            } catch (e) { return false; }
        });
    };

    /* ---------- 字数/条数：占位数 ↔ 真实数 ---------- */
    function applyWords() {
        F.filter(f => f.kind === 'words').forEach(f => {
            const set = WORD_VARS[f.v]; if (!set) return;
            const el = document.getElementById(f.key);
            if (gOn(f.key)) {
                set(f.S);
                if (el && (el.value === String(f.S) || el.value === '')) el.value = ST.real[f.key] != null ? ST.real[f.key] : '';
            } else if (el) {
                // 从 TA 定切回来：框里要是还是占位数，换回上次真实填的；然后变量跟着框里的数走
                if (String(el.value) === String(f.S)) el.value = ST.real[f.key] != null ? ST.real[f.key] : '';
                if (el.value !== '') set(gyNum(el.value, 0));
            }
        });
    }
    window.gyTaApplyWords = applyWords;

    // 发请求前把"不超过 91001 字"这类整句换掉
    const SAYS = '长短由你自己定（按此刻的心情、要说的事和你的性子来——想多说就多说，一句话就够也行）';
    const MARK = '\u2063GYTA\u2063';
    const wordRe = n => new RegExp('(?:(?:总|回复)?字数)?(?:不超过|不多于|少于|最多|控制在|大约|约)?\\s*(?<![\\d.])' + n + '\\s*字(?:以内|之内|左右|上下)?(?:（这是硬性上限，不是必须写满）)?', 'g');
    window.gyTaRewrite = function (content) {
        try {
            // 这次请求里有没有「由 TA 自己决定」模式角色的记号（js/06 buildBasePrompt 打的）
            const all = typeof content === 'string' ? content : JSON.stringify(content || '');
            const auto = all.indexOf(MARK) !== -1;
            const act = F.filter(f => f.S && (gOn(f.key) || all.indexOf(String(f.S)) !== -1));
            if (!act.length && !auto) return content;
            // 自主模式：把你设置里现在填的那几个字数换掉（只换"不超过 N 字"这种整句，不碰别的数字）
            const realNums = auto ? Array.from(new Set([
                    typeof chatWordLimit !== 'undefined' ? chatWordLimit : 0, typeof postWordLimit !== 'undefined' ? postWordLimit : 0,
                    typeof diaryWordLimit !== 'undefined' ? diaryWordLimit : 0, typeof letterWordLimit !== 'undefined' ? letterWordLimit : 0,
                    typeof commentWordLimit !== 'undefined' ? commentWordLimit : 0]
                .map(Number)
                .filter(n => isFinite(n) && n > 0 && n < 91000).map(String))) : [];
            const fix = (t) => {
                if (typeof t !== 'string') return t;
                let s = t;
                if (auto) {
                    s = s.split(MARK).join('');
                    s = s.replace(/回复条数在\s*\d+\s*到\s*\d+\s*条之间自己决定/g, '回复几条你自己决定');
                    realNums.forEach(n => { s = s.replace(wordRe(n), SAYS); });
                }
                if (s.indexOf('910') === -1) return s;
                if (auto || gOn('limitChatMsgCountMin') || gOn('limitChatMsgCountMax') || s.indexOf('91006') !== -1) {
                    s = s.replace(/回复条数在\s*\d+\s*到\s*\d+\s*条之间自己决定/g, '回复几条你自己决定')
                         .replace(/在\s*(91006|\d+)\s*到\s*(91007|\d+)\s*条之间/g, (m, a, b) => (a === '91006' || b === '91007') ? '几条' : m);
                }
                act.forEach(f => {
                    const S = String(f.S);
                    if (s.indexOf(S) === -1) return;
                    s = s.replace(wordRe(S), SAYS)
                         .replace(new RegExp(S + '\\s*条', 'g'), '几条（你自己定）')
                         .replace(new RegExp(S, 'g'), '你自己定的');
                });
                return s;
            };
            if (typeof content === 'string') return fix(content);
            if (Array.isArray(content)) return content.map(m => {
                if (!m || typeof m !== 'object') return m;
                if (typeof m.content === 'string') return Object.assign({}, m, { content: fix(m.content) });
                if (Array.isArray(m.content)) return Object.assign({}, m, { content: m.content.map(p => (p && p.type === 'text' && typeof p.text === 'string') ? Object.assign({}, p, { text: fix(p.text) }) : p) });
                return m;
            });
        } catch (e) {}
        return content;
    };

    /* ---------- 按钮 ---------- */
    // 角色编辑页：现在编辑的是谁、是不是自主模式
    const formChar = () => { try { return (typeof editingCharId !== 'undefined' && editingCharId) ? (myCharacters || []).find(x => x.id == editingCharId) : null; } catch (e) { return null; } };
    const formAuto = () => { const s = document.getElementById('charActMode'); return !!(s && s.value === 'auto') && autoSwitch(); };
    // 自主模式下，这个框算不算自动 TA 定（到点就做的那几个计时器：框里是 0 就还是不开）
    const formAutoOn = f => {
        if (f.scope === 'g') return allAuto();
        if (!formAuto()) return false;
        if (FREQ_OF[f.key]) { const el = elOf(f); return !!(el && parseFloat(el.value) > 0); }
        return true;
    };
    const fmtGap = (g, d) => {
        if (!g) return '';
        if (d && d.unit === 'count') return isFinite(g.n) ? `一天最多 ${g.n} 次` : '';
        const m = g.ms / 60000;
        const t = g.ms < 60000 ? `${Math.round(g.ms / 1000)} 秒` : m < 60 ? `${Math.round(m)} 分钟` : m < 48 * 60 ? `${(m / 60).toFixed(m < 600 ? 1 : 0).replace(/\.0$/, '')} 小时` : `${(m / 1440).toFixed(1).replace(/\.0$/, '')} 天`;
        return '约 ' + t;
    };
    const busy = {};
    // 这一项对应的"问 TA"结果，拼成按钮旁边那行小字
    function valText(f) {
        const gk = FIELD_GAP[f.key];
        if (!gk) return f.kind === 'words' || f.key === 'web.sayChars' ? '每次生成时 TA 自己定' : (f.key === 'charInteractMaxInput' ? '按各自性子，谁想来谁来' : '');
        if (busy[f.key]) return '正在问…';
        const d = GAPS[gk];
        if (f.scope === 'c') {
            const c = formChar();
            if (!c) return '保存角色后生成';
            const g = c.taGap && c.taGap[gk];
            return g ? `${fmtGap(g, d)}${g.why ? ' · ' + g.why : ''}` : '点这里让 TA 定';
        }
        const got = (myCharacters || []).filter(c => c.taGap && c.taGap[gk]);
        if (!got.length) return '点这里让大家各自定';
        const s = got.slice(0, 3).map(c => `${c.name} ${fmtGap(c.taGap[gk], d).replace('约 ', '')}`).join('，');
        return s + (got.length > 3 ? ` 等 ${got.length} 位` : '');
    }
    function valTitle(f) {
        const gk = FIELD_GAP[f.key]; if (!gk || f.scope === 'c') return '点一下重新问';
        const d = GAPS[gk];
        const rows = (myCharacters || []).filter(c => c.taGap && c.taGap[gk]).map(c => `${c.name}：${fmtGap(c.taGap[gk], d)}${c.taGap[gk].why ? '（' + c.taGap[gk].why + '）' : ''}`);
        return (rows.length ? rows.join('\n') + '\n\n' : '') + '点一下重新问一遍';
    }
    // 马上问：角色页的问正在编辑的这一位；全局的挨个问所有角色
    async function genNow(f) {
        const gk = FIELD_GAP[f.key]; if (!gk || busy[f.key]) return;
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { try { showToast('', '🎲 TA 定', '还没配置 API，等能用了 TA 会自己定', null, null, false); } catch (e) {} return; }
        let list;
        if (f.scope === 'c') { const c = formChar(); if (!c) { scan(); return; } list = [c]; }
        else list = (myCharacters || []).slice();
        if (!list.length) return;
        busy[f.key] = true; scan();
        let ok = 0;
        try {
            for (let i = 0; i < list.length; i++) {
                if (list.length > 1) { busy[f.key] = true; try { showToast('', '🎲 TA 定', `正在问 ${list[i].name}（${i + 1}/${list.length}）`, null, null, false); } catch (e) {} }
                const r = await askGap(list[i], gk);
                if (r) ok++;
                scan();
            }
        } finally { busy[f.key] = false; scan(); }
        try {
            const c = list[0], g = c.taGap && c.taGap[gk];
            showToast('', '🎲 TA 定', list.length === 1 ? (g ? `${c.name}：${fmtGap(g, GAPS[gk])}${g.why ? '（' + g.why + '）' : ''}` : '没问到，稍后 TA 会自己再定') : `问好了 ${ok}/${list.length} 位`, null, null, false);
        } catch (e) {}
    }
    function paintChip(f, el) {
        let chip = el.__gytaChip;
        if (!chip) {
            chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'gyta-chip';
            chip.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); toggle(f); });
            const val = document.createElement('span');
            val.className = 'gyta-val';
            val.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); genNow(f); });
            let after = el;
            const u = f.unit && document.getElementById(f.unit);
            if (u && u.parentNode === el.parentNode) after = u;
            after.insertAdjacentElement('afterend', chip);
            chip.insertAdjacentElement('afterend', val);
            el.__gytaChip = chip; el.__gytaVal = val;
        }
        const autoOn = formAutoOn(f);
        const on = autoOn || (f.scope === 'c' ? !!FORM[f.key] : gOn(f.key));
        chip.classList.toggle('on', on);
        const ct = on ? (autoOn ? '🎲 TA 定（自主模式）' : '🎲 TA 定中') : '🎲 TA 定';
        if (chip.textContent !== ct) chip.textContent = ct;
        chip.title = autoOn ? '这个角色是「由 TA 自己决定」模式，这一项自动交给 TA；想自己填数，把行为模式改回「按固定频率」'
            : on ? '再点一下改回你自己填的数' : '交给角色自己决定（点了马上问 TA）';
        const val = el.__gytaVal;
        if (val) {
            const t = on ? valText(f) : '';
            const dp = t ? '' : 'none'; if (val.style.display !== dp) val.style.display = dp;
            if (val.textContent !== t) val.textContent = t;
            val.classList.toggle('click', !!FIELD_GAP[f.key] && !busy[f.key]);
            val.title = FIELD_GAP[f.key] ? valTitle(f) : '';
        }
        // 自主模式：框锁住但还点得到——点了告诉你"TA 有自己的节奏"；你自己按的 TA 定：照旧变灰
        el.classList.toggle('gyta-off', on && !autoOn);
        el.classList.toggle('gyta-lock', autoOn);
        el.readOnly = on;
        el.__gytaLocked = autoOn;
        lockHook(el);
        const u = f.unit && document.getElementById(f.unit);
        if (u) { u.classList.toggle('gyta-off', on && !autoOn); u.classList.toggle('gyta-lock', autoOn); u.__gytaLocked = autoOn; lockHook(u); }
    }
    // 🔒 点被锁的框：弹一句"{char}有自己的节奏"＋随机颜文字
    const KAO = ['(｡•̀ᴗ-)✧', '(๑•̀ㅂ•́)و✧', '( ˘ᵕ˘ )', '(っ´ω`)ﾉ', '(*´▽`*)', '(=^･ω･^=)', 'ヾ(•ω•`)o', '(￣▽￣)~*', '(•̀ω•́ )✧', '٩(ˊᗜˋ*)و', '(´• ω •`)ﾉ', '( •̀ .̫ •́ )✧', '(ง •̀_•́)ง', '(〃\'▽\'〃)'];
    function rhythmNote() {
        let who;
        if (document.getElementById('charActMode') && document.getElementById('charActMode').offsetParent !== null && formChar()) who = formChar().name;
        if (!who) {
            const n = document.getElementById('charName');
            if (n && n.offsetParent !== null && n.value && formAuto()) who = n.value;
        }
        if (!who) { const cs = allChars().filter(isAuto).map(c => c.name); who = cs.length > 3 ? cs.slice(0, 3).join('、') + ' 他们' : (cs.join('、') || 'TA'); }
        const msg = `${who}有自己的节奏 ${KAO[Math.floor(Math.random() * KAO.length)]}`;
        try { if (typeof appAlert === 'function') appAlert(msg); else alert(msg); } catch (e) {}
    }
    let lastNote = 0;
    function lockHook(el) {
        if (el.__gytaLockHooked) return;
        el.__gytaLockHooked = true;
        const stop = ev => {
            if (!el.__gytaLocked) return;
            ev.preventDefault(); ev.stopPropagation();
            try { el.blur(); } catch (e) {}
            if (Date.now() - lastNote < 600) return;          // mousedown + focus 只弹一次
            lastNote = Date.now();
            rhythmNote();
        };
        el.addEventListener('mousedown', stop, true);
        el.addEventListener('touchstart', stop, { capture: true, passive: false });
        el.addEventListener('focus', stop, true);
        el.addEventListener('keydown', stop, true);
    }
    function toggle(f) {
        const el = elOf(f);
        if (formAutoOn(f)) { genNow(f); return; }          // 自主模式：按钮就是"再问一次"
        let nowOn;
        if (f.scope === 'c') {
            nowOn = FORM[f.key] = !FORM[f.key];
        } else {
            const on = !gOn(f.key);
            if (on && el && f.S == null) ST.real[f.key] = el.value;
            if (on && el && f.S != null && String(el.value) !== String(f.S)) ST.real[f.key] = el.value;
            ST.g[f.key] = on;
            // 成对的（最少/最多）一起切
            if (f.also) { const o = byKey(f.also); if (o) { const oe = elOf(o); if (on && oe && String(oe.value) !== String(o.S)) ST.real[o.key] = oe.value; ST.g[o.key] = on; } }
            saveST();
            applyWords();
            if (typeof saveAllData === 'function') saveAllData();
            nowOn = on;
        }
        scan();
        if (nowOn && FIELD_GAP[f.key]) { genNow(f); return; }   // 🎲 一按下去就马上问 TA
        try { if (typeof showToast === 'function') showToast('', '🎲 TA 定', nowOn ? '这一项交给角色自己决定了' + (f.scope === 'c' ? '（保存角色后生效）' : '') : '改回你自己定的数', null, null, false); } catch (e) {}
    }

    // 技术参数：保留原来的范围（温度这类是接口本身的要求，不是我们加的限制）
    const KEEP_RANGE = /^(sampler|presetParam|newRegex|newWb)/;
    function scan() {
        try {
            F.forEach(f => { const el = elOf(f); if (el) paintChip(f, el); });
            const pb = document.getElementById('gyPromptBudgetInput');   // 🧹 参考资料上限（js/01）
            if (pb && pb.value === '' && typeof gyPromptBudget === 'function') pb.value = gyPromptBudget();
            document.querySelectorAll('input[type="number"][min], input[type="number"][max]').forEach(el => {
                if (KEEP_RANGE.test(el.id || '') || el.dataset.keepRange) return;
                el.removeAttribute('min'); el.removeAttribute('max');
            });
        } catch (e) {}
    }
    let pending = false;
    const kick = () => { if (pending) return; pending = true; setTimeout(() => { pending = false; scan(); }, 150); };
    try { new MutationObserver(kick).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
    // 行为模式、频率框改了：按钮状态跟着变
    document.addEventListener('change', ev => { const t = ev.target; if (t && (t.id === 'charActMode' || FREQ_OF[t.id])) kick(); }, true);
    setTimeout(scan, 800);

    /* ---------- 角色编辑页：打开时读、保存时写 ---------- */
    function wrap(name, fn) {
        const o = window[name];
        if (typeof o !== 'function' || o.__gyta) return;
        const w = fn(o); w.__gyta = true; window[name] = w;
    }
    function hookForms() {
        wrap('clearForm', o => function () { FORM = {}; const r = o.apply(this, arguments); kick(); return r; });
        wrap('openFormForEdit', o => function (charId) {
            const r = o.apply(this, arguments);
            const c = (myCharacters || []).find(x => x.id == charId);
            FORM = Object.assign({}, (c && c.taDecide) || {});
            kick();
            return r;
        });
        wrap('saveCharacter', o => async function () {
            const before = new Set((myCharacters || []).map(c => String(c.id)));
            const editing = (typeof editingCharId !== 'undefined') ? editingCharId : null;
            const snap = Object.assign({}, FORM);
            const r = await o.apply(this, arguments);
            try {
                let c = editing ? (myCharacters || []).find(x => x.id == editing) : (myCharacters || []).find(x => !before.has(String(x.id)));
                if (c) {
                    c.taDecide = snap;
                    // 新建的角色：按了 TA 定的那几项，存好之后马上问
                    if (!editing) setTimeout(() => { Object.keys(snap).forEach(k => { const gk = FIELD_GAP[k]; if (snap[k] && gk && GAPS[gk].c === k) askGap(c, gk).then(() => scan()); }); }, 300);
                    if (typeof saveAllData === 'function') saveAllData();
                }
            } catch (e) {}
            return r;
        });
        wrap('saveSettings', o => function () { const r = o.apply(this, arguments); applyWords(); return r; });
        const ld = window.loadAllData;
        if (typeof ld === 'function' && !ld.__gyta) {
            window.loadAllData = async function () { const r = await ld.apply(this, arguments); try { absorb(); applyWords(); } catch (e) {} return r; };
            window.loadAllData.__gyta = true;
        }
    }
    hookForms();
    setTimeout(hookForms, 1500);

    /* ---------- 跟着存档走（换设备 / 云同步不丢）---------- */
    const snap0 = window.getFullDataSnapshot;
    if (snap0 && snap0.call && !snap0.__gyta) {
        window.getFullDataSnapshot = function () {
            const d = snap0.apply(this, arguments);
            try { if (d) d.__gyTaDecide = ST; } catch (e) {}
            return d;
        };
        window.getFullDataSnapshot.__gyta = true;
    }
    async function absorb() {
        try {
            const rec = await localforage.getItem('myTwitterAppData');
            if (rec && rec.__gyTaDecide && rec.__gyTaDecide.g && !Object.keys(ST.g).length) {
                ST = rec.__gyTaDecide; if (!ST.real) ST.real = {}; saveST(); applyWords(); scan();
            }
        } catch (e) {}
    }
    setTimeout(() => { absorb(); applyWords(); }, 2500);

    /* ---------- 样式 ---------- */
    try {
        const st = document.createElement('style');
        st.textContent = `
.gyta-chip{margin-left:6px;padding:3px 9px;border-radius:999px;border:1px dashed rgba(139,152,165,.6);background:transparent;color:#8b98a5;font-size:11.5px;cursor:pointer;white-space:nowrap;vertical-align:middle;line-height:1.5;width:auto;}
.gyta-chip:hover{border-color:var(--gy-accent,#1d9bf0);color:var(--gy-accent,#1d9bf0);}
.gyta-val{margin-left:6px;font-size:11.5px;color:var(--gy-accent,#1d9bf0);opacity:.85;vertical-align:middle;}
.gyta-val.click{cursor:pointer;text-decoration:underline dotted;}
.gyta-chip.on{border-style:solid;border-color:var(--gy-accent,#1d9bf0);background:rgba(29,155,240,.1);color:var(--gy-accent,#1d9bf0);font-weight:600;}
input.gyta-off,select.gyta-off{opacity:.35;pointer-events:none;}
input.gyta-lock,select.gyta-lock{opacity:.45;cursor:not-allowed;}
`;
        document.head.appendChild(st);
    } catch (e) {}
})();
