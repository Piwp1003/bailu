/* ===========================================================================
   js/33 —— 📱 TA 的手机（只能看，不能动）
   ---------------------------------------------------------------------------
   为什么不是"再做一套导航"：白露里已经有私聊、推文、日记、日程、随身物、
   联网探索、八卦网了——再套一个手机壳，只是把同样的东西重排一遍，
   你要多维护一套入口，角色的行为一点没变多。

   这一页做的是另一件事：**视角**。

   你看到的不是"白露的功能换个排法"，而是**TA 那台设备现在的样子**——
   壁纸、电量、今天走了多少步、屏幕用了几小时、一排带红点的图标。
   最要紧的是**下拉通知栏**：里面有你不认识的人和事。
     「妈妈：记得吃饭」「排练室老周：周三还来吗」「3 条未读，一个没备注的号码」
   现在角色的生活是通过你能看到的入口反馈给你的，等于世界围着你转；
   通知栏让你看到**一个不围着你转的生活**，而且你只能看，插不进去。

   ⚠️ 只读。这一版**不能**替 TA 点开消息、回复、下单、改任何东西。
      看到的每一条都来自已经存在的数据（日程 / 钱包 / 随身物 / 包裹 / 浏览记录
      / 音乐 / 日子 / 位置），手机只是换一种方式把它们摆出来。

   🔒 能看到多少，你自己定（钱包页那种下拉框）：
      · 全部都能看
      · 按好感度解锁（默认）——刚认识只看得到桌面和几个基础 app，
        熟了才解锁账单、相册、消息列表这些私密的。锁着的图标看得见红点、点不开。
      · 逐个勾——跟好感度无关，你说哪个能看就哪个能看

   💰 花钱的地方只有一处：让模型写一批通知（开关 phoneNotifAi，默认关）。
      桌面、电量、步数、本地通知、所有 app 的内容，全都是本地的，一次都不调。
   =========================================================================== */
(function () {
    if (window.__gyPhoneLoaded) return;
    window.__gyPhoneLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyPhoneBox', 'phone')          // 带兜底的存档口
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyPhoneBox', storeName: 'phone' })
            : null);
    const KEY = 'gyPhone_state';

    const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(s == null ? '' : s)
        : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const meName = () => (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : '我';
    const on = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : false;
    const uid = () => 'ph' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const money = n => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
    const rnd = a => a[Math.floor(Math.random() * a.length)];

    /* 同一个人同一天，电量/步数/屏幕时间应该是稳定的——
       每次重画都换一个数就穿帮了。所以用 角色id+日期 做种子，算出来是定的。 */
    function seed(charId, salt) {
        const s = String(charId) + '|' + new Date().toISOString().slice(0, 10) + '|' + (salt || '');
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return ((h >>> 0) % 10000) / 10000;
    }
    const seedInt = (charId, salt, lo, hi) => lo + Math.floor(seed(charId, salt) * (hi - lo + 1));

    let S = {
        mode: 'rel',            // all 全部可看 / rel 按好感度 / manual 逐个勾
        need: { mid: 20, deep: 50 },   // rel 模式下两档的分数线
        allow: {},              // manual 模式：{ appKey: true }
        notif: {},              // { 角色id: [{id, at, app, who, text, unread}] }
        wall: {},               // { 角色id: 壁纸色号，或者 'img:<图片地址>' }
        iconSkin: {},           // { 角色id: 图标风格 }  round 圆角方块 / circle 圆的 / glass 毛玻璃 / flat 扁平
        iconTint: {},           // { 角色id: 'person' 跟人设配色（默认） / 'app' 每个 app 自己的颜色 }
        manual: {},             // { 角色id: true } 你手动挑过壁纸——没这个标记的纯色壁纸都当"自动的"清掉
        lastGen: {},            // { 角色id: 上次生成本地通知的时间 }
        // 借看许可：TA 答应给你看之后，一段时间内**所有 app 都解锁**，不再看好感度。
        // { 角色id: {until, at, line} }；mine 是反过来——TA 看过你的手机
        grant: {}, mine: {}, askedAt: {},
        grantMin: 60,           // 答应之后能看多久（分钟）；0 = 一直能看
        // 悬浮窗：挂在页面上不走，跟着你翻页。x/y 是右下角起算的偏移
        float: { open: false, mini: false, charId: '', x: 24, y: 24 },
        // 看手机这件事本身要被记住：翻了哪个 app、那一屏上是什么，都记一条。
        // 这些会注进 prompt——TA 知道你看过，也知道你看到了什么。
        seen: {},   // { 角色id: [{at, app, name, gist}] }   你看 TA 的
        seenMe: {}, // { 角色id: [{at, gist}] }              TA 看你的
        // 📇 按人设生成的通讯录：{ 角色id: {at, list:[{n, ico, who, src, talk:[...] }]} }
        // 十二个固定联系人（妈妈/爸/房东…）对谁都一样，可现实里有人没家人、
        // 有人不上班、有人手机里只有工作群。这一份是让模型照着人设和世界书开的。
        ppl: {},
        card: {},       // 🃏 卡片格式收进来的：{ 角色id: {msgs, notes, moments} }
        icons: {},      // 🎨 照人设设计的图标：{ 角色id: {motif, deco, c1, c2, apps:{key:emoji}} }
        skinSrc: {}     // 手机配色跟谁：'card' 跟卡片 / 'persona' 跟人设
    };
    async function save() { try { if (LF) await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) { console.warn('[手机] 存档失败', e); } }
    async function load() {
        try { if (LF) { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } } catch (e) {}
        ['notif', 'wall', 'allow', 'lastGen', 'grant', 'mine', 'askedAt', 'seen', 'seenMe', 'iconSkin', 'iconTint', 'manual', 'ppl', 'card', 'icons', 'skinSrc'].forEach(k => { if (!S[k] || typeof S[k] !== 'object') S[k] = {}; });
        if (typeof S.grantMin !== 'number') S.grantMin = 60;
        if (!S.float || typeof S.float !== 'object') S.float = { open: false, mini: false, charId: '', x: 24, y: 24 };
        if (!S.need || typeof S.need !== 'object') S.need = { mid: 20, deep: 50 };
        /* 迁移：v109 第一版打开手机时会**随机**塞一个纯色壁纸，
           于是所有人的手机都是随机的、跟人设没关系。现在改成按人设推，
           所以把那些没有"我手动挑过"标记的纯色壁纸清掉，让它们回到自动。
           （手动挑过的、以及图片壁纸，都原样留着。） */
        Object.keys(S.wall).forEach(k => {
            const v = String(S.wall[k] || '');
            if (/^w[1-5]$/.test(v) && !S.manual[k]) delete S.wall[k];
        });
    }

    /* ================= 每台手机长得像它的主人 =================
       所有角色一台一模一样的蓝壁纸，是这个功能最没说服力的地方——
       手机是很私人的东西，一眼就该看出这是谁的。

       所以壁纸、图标形状、图标配色**从人设里推出来**（本地关键词 + 哈希兜底，
       不调 API）：写"冷淡/沉默/夜"的会拿到暗一档的冷色和方正的图标，
       写"温柔/花/甜"的会拿到暖紫和圆图标，写"军/警/硬"的拿到灰阶方块。
       推不出来的用名字哈希兜底——反正**不会两个人一样**。
       你手动挑过壁纸/图标之后，就以你挑的为准，不再自动推。 */
    const STYLES = {
        cold:  { wall: 'w1', skin: 'flat',   hue: [200, 220], tag: '冷、干净、不爱装饰' },
        night: { wall: 'w5', skin: 'round',  hue: [225, 250], tag: '夜里的人，屏幕常年调到最暗' },
        soft:  { wall: 'w2', skin: 'circle', hue: [285, 320], tag: '软一点的东西，圆的、暖的' },
        warm:  { wall: 'w4', skin: 'round',  hue: [25, 45],   tag: '暖色，桌面上东西不多但都有来历' },
        green: { wall: 'w3', skin: 'round',  hue: [150, 175], tag: '安静、爱干净、有点植物气' },
        hard:  { wall: 'w5', skin: 'flat',   hue: [205, 215], tag: '工具就是工具，不折腾' },
        glass: { wall: 'w1', skin: 'glass',  hue: [195, 215], tag: '讲究，连图标都要透一点' }
    };
    const STYLE_WORDS = [
        ['cold',  /冷|淡漠|疏离|寡言|沉默|面瘫|不苟言笑|克制/],
        ['night', /夜|失眠|熬夜|黑|暗|阴|鬼|吸血|月/],
        ['soft',  /温柔|甜|软|可爱|少女|粉|花|治愈|奶/],
        ['warm',  /烟火|市井|做饭|面馆|老板|热情|爽朗|江湖/],
        ['green', /植物|安静|书|茶|山|林|素|清|医/],
        ['hard',  /军|警|兵|刑|硬|糙|工地|机械|工程|理工/],
        ['glass', /设计|艺术|讲究|精致|时髦|摄影|建筑|品味/]
    ];
    function styleOf(c) {
        const t = String((c.persona || '') + ' ' + (c.bio || '') + ' ' + (c.name || ''));
        for (const [k, re] of STYLE_WORDS) if (re.test(t)) return Object.assign({ key: k }, STYLES[k]);
        // 一个都没命中：按名字哈希挑一档，至少保证人跟人不一样
        const keys = Object.keys(STYLES);
        const k = keys[Math.floor(seed(c.id, 'style') * keys.length) % keys.length];
        return Object.assign({ key: k }, STYLES[k]);
    }
    // 壁纸：没手动挑过就按人设推
    function wallOf(charId) {
        const w = S.wall[String(charId)];
        if (w) return w;
        const c = charOf(charId);
        return c ? styleOf(c).wall : 'w1';
    }
    function skinOf(charId) {
        const k = S.iconSkin[String(charId)];
        if (k) return k;
        const c = charOf(charId);
        return c ? styleOf(c).skin : 'round';
    }
    // 图标配色也跟着人设走：在那个人的色相区间里，每个 app 各偏一点
    function tintOf(charId, i, n) {
        const c = charOf(charId);
        if (!c) return null;
        const st = styleOf(c);
        let [h1, h2] = st.hue;
        try { if (skinSrcOf(charId) === 'card') { const p = cardPalette(charId); if (p) { h1 = p.hue; h2 = p.hue2; } } } catch (e) {}
        const h = Math.round(h1 + (h2 - h1) * (n > 1 ? i / (n - 1) : 0.5));
        const s2 = 42 + Math.round(seed(charId, 'sat' + i) * 26);
        return [`hsl(${h} ${s2}% 62%)`, `hsl(${h} ${s2 + 6}% 40%)`];
    }
    window.gyPhoneStyleOf = charId => { const c = charOf(charId); return c ? styleOf(c) : null; };

    const relScore = id => { try { return (window.gyRel && typeof window.gyRel.score === 'function') ? Number(window.gyRel.score(id)) || 0 : 0; } catch (e) { return 0; } };
    // 这个 app 现在能不能看
    // TA 亲口答应给你看的时候，这段时间里所有 app 都开——
    // 那是"TA 把手机递给你"，比好感度分数更直接。
    function granted(charId) {
        const g = S.grant[String(charId)];
        if (!g) return false;
        if (!g.until) return true;           // 0 分钟 ＝ 一直能看
        return Date.now() < g.until;
    }
    function canSee(charId, app) {
        if (app.lock === 'base') return true;
        if (S.mode === 'all') return true;
        if (granted(charId)) return true;
        if (S.mode === 'manual') return !!S.allow[app.key];
        const sc = relScore(charId);
        return app.lock === 'deep' ? sc >= (Number(S.need.deep) || 50) : sc >= (Number(S.need.mid) || 20);
    }
    function lockHint(app) {
        if (S.mode === 'rel') return '好感度到 ' + (app.lock === 'deep' ? (Number(S.need.deep) || 50) : (Number(S.need.mid) || 20)) + '，或者直接问 TA 借来看';
        if (S.mode === 'manual') return '你在设置里没勾这一项';
        const n = app.lock === 'deep' ? (Number(S.need.deep) || 50) : (Number(S.need.mid) || 20);
        return '好感度到 ' + n + ' 才看得到';
    }

    /* ================= 各个 app 里显示什么 =================
       全部是**读**已经存在的数据。对应模块没装就说"这台机器上没有这个"，不报错。 */
    // 每个 app 有自己的一对渐变色——真手机上的图标不会是一模一样的半透明方块，
    // 一眼能靠颜色认出来，比全都一样好看也好找。dock:true 的那四个固定在底栏。
    const APPS = [
        { key: 'msg',    ico: '💬', name: '消息',   lock: 'deep',  c: ['#5ad06a', '#22a03a'], dock: true, badge: c => unreadOf(c), render: appMsg },
        { key: 'sched',  ico: '📅', name: '日程',   lock: 'base',  c: ['#ff7b6b', '#e0392b'], dock: true, render: appSched },
        { key: 'loc',    ico: '📍', name: '位置',   lock: 'mid',   c: ['#63b3ff', '#2b6fd6'], dock: true, render: appLoc },
        { key: 'wallet', ico: '💳', name: '钱包',   lock: 'deep',  c: ['#2f3640', '#12161c'], dock: true, render: appWallet },
        { key: 'kit',    ico: '🎒', name: '随身物', lock: 'mid',   c: ['#f0a55e', '#c9762a'], render: appKit },
        { key: 'parcel', ico: '📦', name: '包裹',   lock: 'mid',   c: ['#d9a05b', '#a06a25'], render: appParcel },
        { key: 'web',    ico: '🌐', name: '浏览器', lock: 'deep',  c: ['#6fc3f7', '#2d7fb8'], render: appWeb },
        { key: 'music',  ico: '🎵', name: '音乐',   lock: 'mid',   c: ['#ff7aa8', '#e0325f'], render: appMusic },
        { key: 'photo',  ico: '🖼️', name: '相册',   lock: 'deep',  c: ['#ffd36e', '#f0913a'], render: appPhoto },
        { key: 'note',   ico: '📝', name: '备忘录', lock: 'mid',   c: ['#ffe27a', '#e0b33a'], render: appNote },
        { key: 'time',   ico: '⏱️', name: '屏幕时间', lock: 'base', c: ['#8f9bff', '#4b56c9'], render: appTime },
        { key: 'day',    ico: '🎂', name: '日子',   lock: 'mid',   c: ['#c69bff', '#7b45c9'], render: appDay },
        // 🃏 这两个只有卡片里写过（或者按卡片格式生成过）才出现在桌面上
        { key: 'rednote', ico: '📕', name: '小红书', lock: 'mid', c: ['#ff5a6e', '#e02444'], render: c => appRednote(c),
          show: c => !!(S.card[String(c.id)] && S.card[String(c.id)].notes.length) },
        { key: 'moment', ico: '🌀', name: '朋友圈', lock: 'mid', c: ['#7bd88f', '#2f9e55'], render: c => appMoment(c),
          show: c => !!(S.card[String(c.id)] && S.card[String(c.id)].moments.length) || peerMoments(c).length > 0 },
        // 📨 开了小剧场之后，角色彼此之间的来往（js/56）：有过才出现在桌面上
        { key: 'mail', ico: '✉️', name: '信件', lock: 'deep', c: ['#f6c177', '#d08a2e'], render: c => appMail(c),
          show: c => peerMails(c).length > 0 },
        { key: 'calls', ico: '📞', name: '通话', lock: 'mid', c: ['#6fe39a', '#1f9d55'], render: c => appCalls(c),
          show: c => peerCalls(c).length > 0 }
    ];
    const peerMails = c => { try { return typeof window.gyPeerMails === 'function' ? window.gyPeerMails(c.id) : []; } catch (e) { return []; } };
    const peerCalls = c => { try { return typeof window.gyPeerCalls === 'function' ? window.gyPeerCalls(c.id) : []; } catch (e) { return []; } };
    const peerMoments = c => { try { return typeof window.gyPeerMoments === 'function' ? window.gyPeerMoments(c.id) : []; } catch (e) { return []; } };
    const appOf = k => APPS.find(a => a.key === k);

    /* 翻开一个 app，记一条"看到了什么"。
       不是记"打开过消息"这么空——要记得下这一屏上的具体内容，
       不然注进 prompt 里 TA 只知道"你翻过我手机"，不知道你到底看见了什么。 */
    function gistOf(key, c) {
        try {
            switch (key) {
                case 'sched':  return c.schedule && c.schedule.text ? '今天的安排：' + String(c.schedule.text).slice(0, 40) : '日程是空的';
                case 'loc':    { const t = (appLoc(c).match(/<b>(.*?)<\/b>/) || [])[1]; return t ? '定位在「' + t + '」' : '定位没打开'; }
                case 'wallet': { let b = 0, l = null;
                    if (window.gyWallet) { b = window.gyWallet.total(c.id); l = (window.gyWallet.log(c.id) || [])[0]; }
                    return '余额 ￥' + money(b) + (l ? '，最近一笔是' + l.why : ''); }
                case 'kit':    { const k2 = (window.gyKit && window.gyKit.list(c.id)) || [];
                    return k2.length ? '包里有 ' + k2.length + ' 样东西：' + k2.slice(0, 3).map(x => x.name).join('、') : '包是空的'; }
                case 'parcel': { const p2 = (window.gyParcel && window.gyParcel.list(c.id)) || [];
                    return p2.length ? '有 ' + p2.length + ' 个包裹，最近是' + p2[0].name : '没有包裹'; }
                case 'web':    { let a2 = []; try { const cfg = window.gyWebConfig(); a2 = (cfg.log || {})[String(c.id)] || []; } catch (e) {}
                    return a2.length ? '搜过：' + a2.slice(-3).map(x => x.topic).join('、') : '浏览记录是空的'; }
                case 'music':  return '在听什么';
                case 'photo':  return '翻了相册';
                case 'note':   return '看了备忘录';
                case 'time':   return '看了屏幕使用时间和步数';
                case 'day':    { const n = ((c.anniversaries || []).length + (c.birthdate ? 1 : 0));
                    return n ? '日历上标着 ' + n + ' 个日子' : '日历上没有标记'; }
                case 'msg':    { const ct = contactsOf(c);
                    return '消息列表里除了你还有 ' + ct.length + ' 个人：' + ct.map(x => x.n).join('、'); }
            }
        } catch (e) {}
        return '';
    }
    async function noteSeen(charId, key) {
        if (!on('phoneRemember')) return;
        const c = charOf(charId); if (!c) return;
        const a = appOf(key); if (!a) return;
        const k = String(charId);
        if (!Array.isArray(S.seen[k])) S.seen[k] = [];
        const g = gistOf(key, c);
        // 同一个 app 十分钟内翻来翻去只记一条，别把记录刷满
        const last = S.seen[k][0];
        if (last && last.app === key && Date.now() - last.at < 10 * 60000) { last.at = Date.now(); last.gist = g; }
        else S.seen[k].unshift({ at: Date.now(), app: key, name: a.name, gist: g });
        if (S.seen[k].length > 30) S.seen[k].length = 30;
        await save();
    }
    window.gyPhoneSeen = id => (S.seen[String(id)] || []).slice();
    // 🗑️ 记忆总览里删一条（你翻过 TA 的 / TA 翻过你的）
    window.gyPhoneDelSeen = async function (id, which, i) {
        const arr = (S[which] || {})[String(id)];
        if (!Array.isArray(arr) || !arr[i]) return;
        arr.splice(i, 1);
        await save(); paint(); renderMemHub();
    };
    window.gyPhoneClearSeen = async function (id) { delete S.seen[String(id)]; delete S.seenMe[String(id)]; await save(); paint(); renderMemHub(); };

    /* 注进 prompt：TA 知道你看过 TA 的手机，也知道你看到了什么。 */
    window.__gyPhoneCtxFor = function (charId) {
        try {
            if (!on('phoneOn') || !on('phoneRemember')) return '';
            const k = String(charId);
            const mine = (S.seen[k] || []).slice(0, 6);
            const theirs = (S.seenMe[k] || []).slice(0, 3);
            if (!mine.length && !theirs.length) return '';
            const uname = (typeof userDisplayName === 'function') ? userDisplayName(charOf(charId)) : '对方';
            let out = '\n【手机这件事】\n';
            if (mine.length) {
                out += `${uname}看过你的手机。翻过这些：\n` +
                    mine.map(x => `· ${ago(x.at)}　${x.name}——${x.gist}`).join('\n') +
                    `\n这是真发生过的事。你知道对方看见了这些，也知道自己当时是答应了的。` +
                    `按你的性格决定要不要提、怎么提——可以坦然，可以别扭，可以拿这件事开玩笑，也可以什么都不说。\n`;
            }
            if (theirs.length) {
                out += `你也看过${uname}的手机：\n` + theirs.map(x => `· ${ago(x.at)}　${x.gist || '翻了几下'}`).join('\n') + '\n';
            }
            return out;
        } catch (e) { return ''; }
    };
    const empty = t => `<div class="gyph-empty">${esc(t)}</div>`;

    function appSched(c) {
        const s = c.schedule;
        if (!s || !s.text) return empty('今天还没有安排。');
        return `<div class="gyph-card"><div class="gyph-ct">今天</div>
            <div class="gyph-cb">${esc(String(s.text).slice(0, 600))}</div></div>
            ${c.currentStatus ? `<div class="gyph-card"><div class="gyph-ct">此刻</div><div class="gyph-cb">${esc(c.currentStatus)}</div></div>` : ''}`;
    }
    function appLoc(c) {
        let where = '';
        try {
            if (typeof window.__gyMapCtxFor === 'function') {
                // 走 gyInjectRaw 拿没过滤的那份：注入开关管的是 prompt，不该把这块屏幕也弄黑
                const t = (typeof window.gyInjectRaw === 'function'
                    ? window.gyInjectRaw('__gyMapCtxFor', c.id) : window.__gyMapCtxFor(c.id)) || '';
                const m = t.match(/在「(.+?)」/);
                if (m) where = m[1];
            }
        } catch (e) {}
        if (!where) where = c.location || '';
        return where
            ? `<div class="gyph-map"><div class="gyph-pin">📍</div><b>${esc(where)}</b><span>定位于刚刚</span></div>`
            : empty('定位没打开。');
    }
    function appWallet(c) {
        if (!window.gyWallet || typeof window.gyWallet.total !== 'function') return empty('这台机器上没装钱包。');
        let bal = 0, log = [];
        try { bal = window.gyWallet.total(c.id); log = window.gyWallet.log(c.id).slice(0, 8); } catch (e) {}
        return `<div class="gyph-bal">￥${money(bal)}<span>可用余额</span></div>` +
            (log.length ? log.map(x => `<div class="gyph-li">
                <span>${esc(x.why)}</span>
                <b class="${x.amt >= 0 ? 'in' : ''}">${x.amt >= 0 ? '+' : '−'}${money(Math.abs(x.amt))}</b>
            </div>`).join('') : empty('这个月还没有流水。'));
    }
    function appKit(c) {
        const list = (window.gyKit && typeof window.gyKit.list === 'function') ? window.gyKit.list(c.id) : [];
        if (!list.length) return empty('包里什么都没有。');
        return list.slice(0, 20).map(x => `<div class="gyph-li"><span>${esc(x.name)}</span>
            <em>${esc(x.fromName ? x.fromName + '给的' : '自己的')}</em></div>`).join('');
    }
    function appParcel(c) {
        const list = (window.gyParcel && typeof window.gyParcel.list === 'function') ? window.gyParcel.list(c.id) : [];
        if (!list.length) return empty('没有在途的包裹。');
        const st = { shipping: '运输中', arrived: '待收', received: '已收', declined: '已退' };
        return list.slice(0, 12).map(p => `<div class="gyph-li"><span>${esc(p.emoji || '📦')} ${esc(p.name)}</span>
            <em>${esc(st[p.status] || p.status)}</em></div>`).join('');
    }
    function appWeb(c) {
        let arr = [];
        try { const cfg = window.gyWebConfig ? window.gyWebConfig() : null; arr = (cfg && cfg.log && cfg.log[String(c.id)]) || []; } catch (e) {}
        if (!arr.length) return empty('没有浏览记录。');
        return arr.slice().reverse().slice(0, 15).map(x => `<div class="gyph-li col">
            <span>${esc(x.topic)}</span><em>${esc(String(x.text || '').slice(0, 40))}</em></div>`).join('');
    }
    function appMusic(c) {
        // 音乐盒的播放列表是全局的，这里只显示"最近在听什么"
        let cur = '';
        try {
            const el = document.getElementById('gymTitle');
            if (el && el.innerText && el.innerText !== '还没有歌') cur = el.innerText;
        } catch (e) {}
        return cur ? `<div class="gyph-card"><div class="gyph-ct">正在播放</div><div class="gyph-cb">🎵 ${esc(cur)}</div></div>`
                   : empty('最近没听歌。');
    }
    function appPhoto(c) {
        // 没有真的照片——列的是"相册里有什么"，每一条是一段描述 + 日期。
        // 用种子生成，同一个人同一天看到的是同一批，不会每次重画都换。
        const SUBJ = ['窗外的天', '桌上没喝完的那杯', '路边的猫', '加班时的电梯', '一张收据', '刚做好的饭',
                      '手写的一页', '深夜的路口', '朋友的背影', '雨里的伞', '早班车', '楼下的花'];
        const n = seedInt(c.id, 'photo', 4, 9);
        const out = [];
        for (let i = 0; i < n; i++) {
            const d = new Date(Date.now() - seedInt(c.id, 'pd' + i, 0, 40) * 86400000);
            out.push(`<div class="gyph-ph"><div class="gyph-ph-i">🖼️</div>
                <div><b>${esc(SUBJ[seedInt(c.id, 'ps' + i, 0, SUBJ.length - 1)])}</b>
                <span>${d.getMonth() + 1}月${d.getDate()}日</span></div></div>`);
        }
        return `<div class="gyph-grid">${out.join('')}</div>`;
    }
    function appNote(c) {
        // 📝 装了「TA 的备忘录」插件：显示 TA 自己真写的便签和涂鸦
        try { if (typeof window.gyxMemoPhoneHtml === 'function') { const h = window.gyxMemoPhoneHtml(c); if (h) return h; } } catch (e) {}
        const NOTES = ['牛奶 / 鸡蛋 / 洗衣液', '周四之前把材料交上去', '别忘了充话费', '生日礼物：想想送什么',
                       '这本书看到第 87 页', '牙医：下周二下午三点', '房租月底', '记得回电话'];
        const n = seedInt(c.id, 'note', 2, 5);
        const out = [];
        for (let i = 0; i < n; i++) out.push(NOTES[seedInt(c.id, 'nt' + i, 0, NOTES.length - 1)]);
        return [...new Set(out)].map(x => `<div class="gyph-li col"><span>${esc(x)}</span></div>`).join('');
    }
    function appTime(c) {
        const total = seedInt(c.id, 'scr', 90, 480);
        const rows = [['💬 聊天', 0.34], ['🌐 浏览器', 0.22], ['🎵 音乐', 0.16], ['📷 相册', 0.1], ['其他', 0.18]];
        return `<div class="gyph-bal">${Math.floor(total / 60)} 小时 ${total % 60} 分<span>今天的屏幕使用时间</span></div>` +
            rows.map(([n, p]) => {
                const m = Math.round(total * p);
                return `<div class="gyph-bar"><span>${n}</span>
                    <i><b style="width:${Math.round(p * 100)}%"></b></i>
                    <em>${m >= 60 ? Math.floor(m / 60) + '时' + (m % 60) + '分' : m + ' 分'}</em></div>`;
            }).join('') +
            `<div class="gyph-note">走了 ${seedInt(c.id, 'step', 800, 14000)} 步　·　解锁 ${seedInt(c.id, 'unlock', 12, 120)} 次</div>`;
    }
    function appDay(c) {
        const list = [];
        try {
            (c.anniversaries || []).forEach(a => list.push({ d: a.date, t: a.label || a.name || '纪念日' }));
            if (c.birthdate) list.push({ d: c.birthdate, t: '生日' });
        } catch (e) {}
        if (!list.length) return empty('日历上没有标记。');
        return list.slice(0, 12).map(x => `<div class="gyph-li"><span>${esc(x.t)}</span><em>${esc(x.d)}</em></div>`).join('');
    }
    /* ---- 开了「角色互动总开关」之后，TA 手机里还得有别的角色 ----
       关系网上跟 TA 有线的人，本来就该出现在 TA 的通讯录里。
       这些人的对话不是模板，是**真发生过的事**攒出来的：
       小剧场演过的、谁换了头像被谁看见了、你翻过谁的手机。 */
    const interOn = () => { try { return typeof isGlobalCharInteractionEnabled === 'function' && isGlobalCharInteractionEnabled(); } catch (e) { return false; } };
    function peersOf(c) {
        if (!interOn()) return [];
        const out = [];
        try {
            const seen = new Set();
            (typeof charRelationships !== 'undefined' ? charRelationships : []).forEach(r => {
                if (!r) return;
                const a = String(r.fromId), b = String(r.toId), me = String(c.id);
                let other = a === me ? b : b === me ? a : '';
                if (!other || other === 'me' || seen.has(other)) return;
                const oc = (typeof myCharacters !== 'undefined' ? myCharacters : []).find(x => String(x.id) === other);
                if (!oc) return;
                seen.add(other);
                out.push({ n: oc.name, ico: (oc.name || '?').slice(0, 1), peer: oc.id, rel: r.label || '' });
            });
        } catch (e) {}
        // 最近真有来往的排前面（js/56）
        try { if (typeof window.gyPeerLastBetween === 'function') out.sort((x, y) => window.gyPeerLastBetween(c.id, y.peer) - window.gyPeerLastBetween(c.id, x.peer)); } catch (e) {}
        return out.slice(0, 6);
    }
    // 两个角色之间真发生过的事 → 手机里那条对话
    function peerThread(c, peerId, peerName) {
        const bits = [];
        try {
            (typeof globalTheaterLogs !== 'undefined' ? globalTheaterLogs : [])
                .filter(l => l && !l.peer && ((String(l.charAId) === String(c.id) && String(l.charBId) === String(peerId))
                                || (String(l.charBId) === String(c.id) && String(l.charAId) === String(peerId))))
                .slice(-3).forEach(l => {
                    bits.push({ at: l.at, w: '我', t: String(l.summary || '').slice(0, 30) });
                    if (l.scene) bits.push({ at: l.at + 1, w: peerName, t: String(l.scene).replace(/\s+/g, '').slice(0, 40) });
                });
        } catch (e) {}
        try {
            if (typeof window.gyDressBetween === 'function')
                window.gyDressBetween(c.id, peerId, 2).forEach(x => bits.push({ at: x.at, w: peerName, t: x.text.replace(/^[^前]*前/, '') }));
        } catch (e) {}
        // 📨 两个人用手机来往过的（私聊的原话、转账、送的东西、打过的电话…）
        try { if (typeof window.gyPeerBits === 'function') window.gyPeerBits(c.id, peerId).forEach(x => bits.push(x)); } catch (e) {}
        return bits.sort((a, b) => a.at - b.at).slice(-40).map(x => [x.w, x.t]);
    }

    // 消息列表：你是其中一个联系人，其余是"你不认识的人"（本地生成的联系人）
    function contactsOf(c) {
        // 卡片里写过的那些人排最前面——那是真发生过的对话
        const cp = cardPeers(c).map(p => ({ n: p.n, ico: String(p.n).replace(/^群\s*/, '').slice(0, 1) || '💬', unread: 0, card: true }));
        const base = contactsOf0(c).filter(x => !cp.some(y => y.n === x.n));
        return cp.concat(base);
    }
    function contactsOf0(c) {
        const n = seedInt(c.id, 'ct', 3, 6);
        const out = [];
        const used = new Set();
        const ai = pplOf(c);
        if (ai) {
            const peers0 = peersOf(c).filter(p => !ai.some(x => x.n === p.n));
            return peers0.map(p => ({ n: p.n, ico: p.ico, peer: p.peer, rel: p.rel, unread: seedInt(c.id, 'pu' + p.peer, 0, 3) }))
                .concat(ai.map((x, i) => ({ n: x.n, ico: x.ico, who: x.who, unread: seedInt(c.id, 'au' + i, 0, 4) })));
        }
        // 先挑"真有话可说的"那几个：TA 今天有日程，妈妈就会念叨；
        // 钱包里有房租，房东才会来催。凑不够再拿其余的填。
        // 不这么排的话，随机挑中的几个多半都读不到东西，一屋子都是模板。
        const rich = [], plain = [];
        const th = buildThreads(c);
        POOL.forEach(p => ((th[p.n] || []).length ? rich : plain).push(p));
        const order = rich.concat(plain);
        for (let i = 0; i < order.length && out.length < n; i++) {
            const p = i < rich.length ? order[i]
                    : order[rich.length + seedInt(c.id, 'ci' + i, 0, Math.max(0, plain.length - 1))];
            if (!p || used.has(p.n)) continue;
            used.add(p.n);
            out.push({ n: p.n, ico: p.ico, unread: seedInt(c.id, 'cu' + i, 0, 4) });
        }
        // 关系网上的人排在陌生联系人前面——手机里最常聊的本来就是熟人
        const peers = peersOf(c).filter(p => !used.has(p.n)).map((p, i) => {
            used.add(p.n);
            return { n: p.n, ico: p.ico, peer: p.peer, rel: p.rel, unread: seedInt(c.id, 'pu' + p.peer, 0, 3) };
        });
        return peers.concat(out);
    }
    function unreadOf(c) {
        return (S.notif[String(c.id)] || []).filter(x => x.unread).length;
    }
    // 那些"你不认识的人"跟 TA 的对话：本地按种子生成，同一个人同一天是固定的几句。
    // 这不是凭空编故事——它就是这个功能的意义：让你看到一段**你不在场**的日常。
    const TALK = {
        '妈妈': [['妈妈', '吃饭了没'], ['我', '吃了'], ['妈妈', '天冷了加衣服'], ['妈妈', '什么时候回来一趟'], ['我', '过阵子吧']],
        '爸': [['爸', '钱够不够花'], ['我', '够'], ['爸', '不够跟家里说']],
        '房东': [['房东', '这个月的水电麻烦转一下'], ['我', '好，晚上转'], ['房东', '楼道下周检修，注意点']],
        '同事·小吴': [['同事·小吴', '那个表格明天要'], ['我', '知道了'], ['同事·小吴', '你桌上的水杯我帮你收了'], ['我', '谢了']],
        '组长': [['组长', '开会改到十点'], ['我', '收到'], ['组长', '材料记得带']],
        '老同学': [['老同学', '好久没聚了'], ['我', '最近有点忙'], ['老同学', '那下次']],
        '楼下便利店': [['楼下便利店', '你要的那个到货了'], ['我', '明天来拿']],
        '没备注的号码': [['没备注的号码', '在吗'], ['没备注的号码', '……'], ['没备注的号码', '（一条语音）']],
        '快递': [['快递', '您的包裹已放在驿站'], ['快递', '取件码 8823']],
        '医生': [['医生', '复查记得空腹'], ['我', '好']],
        '健身房': [['健身房', '您的私教课还剩 3 节']],
        '银行': [['银行', '账户变动提醒'], ['银行', '还款日快到了']]
    };
    // 通讯录里那些你不认识的人。谁真的会出现在某台手机上，看 buildThreads 算出来谁有话说。
    const POOL = [
        { n: '妈妈', ico: '👩' }, { n: '爸', ico: '👨' }, { n: '房东', ico: '🏠' },
        { n: '同事·小吴', ico: '🧑‍💼' }, { n: '组长', ico: '🧑‍💻' }, { n: '老同学', ico: '🎓' },
        { n: '楼下便利店', ico: '🏪' }, { n: '没备注的号码', ico: '📵' }, { n: '快递', ico: '🚚' },
        { n: '医生', ico: '🩺' }, { n: '健身房', ico: '🏋️' }, { n: '银行', ico: '🏦' }
    ];

    /* ===== 📇 照着人设开一份通讯录 =====
       十二个固定联系人对谁都一样：妈妈、爸、房东、同事、组长……
       可人设里写着"父母双亡""独居""没工作""江湖人"的角色，手机里不该有这些。
       所以给一颗按钮：读**人设 + 世界书**（以及你勾了的其它几样），
       让模型替这个人开一份真正属于 TA 的通讯录，连带每个人会说的话。

       一个角色只花一次调用，结果存下来；想换就点「重开一份」。
       没生成过、或者你把开关关着，就还是用那十二个固定的，行为跟以前一样。 */
    const PPL_SRC = [
        { k: 'persona', label: '人设正文', desc: '最要紧的一条。关掉的话模型只能瞎编。' },
        { k: 'wb',      label: '世界书', desc: '设定里那些人名、地名、组织——通讯录里出现的人才对得上世界。' },
        { k: 'rel',     label: '关系网上的角色', desc: '让模型知道哪些名字是"真人"，别拿去当路人重名。' },
        { k: 'sched',   label: '今天的日程', desc: '有没有工作、几点上班，决定通讯录里有没有同事。' },
        { k: 'bio',     label: '资料页的简介 / 所在地 / 职业', desc: '' },
        { k: 'npc',     label: '世界书里抽出来的 NPC', desc: '「小功能 → 👥 世界里的人」抽过的话，优先把他们放进通讯录，不用另编一套。跟着「手机通讯录优先用这些人」那个开关走。' }
    ];
    const pplSrc = k => { try { return !window.gyInjectSrc || window.gyInjectSrc.on('phonePeople', k); } catch (e) { return true; } };
    let pplBusy = {};
    window.gyPhoneMakePeople = async function (charId) {
        const id = String(charId);
        const c = charOf(id); if (!c) return null;
        if (pplBusy[id]) return null;
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { toast('还没配 API Key'); return null; }
        pplBusy[id] = true;
        try {
            toast('正在照着人设给 ' + c.name + ' 开通讯录…');
            let info = '';
            if (pplSrc('persona')) info += `【人设】${String(c.persona || '').slice(0, 1200)}\n`;
            if (pplSrc('bio')) {
                const bits = [c.bio && ('简介：' + c.bio), c.location && ('所在地：' + c.location)].filter(Boolean);
                if (bits.length) info += `【资料页】${bits.join('　').slice(0, 200)}\n`;
            }
            if (pplSrc('wb')) {
                let wb = '';
                try { if (typeof getCharacterWorldbookText === 'function') wb = getCharacterWorldbookText(c, '', null) || ''; } catch (e) {}
                if (wb) info += `【世界书】${String(wb).replace(/\s+/g, ' ').slice(0, 1200)}\n`;
            }
            if (pplSrc('rel')) {
                const names = chars().filter(x => String(x.id) !== id).map(x => x.name).slice(0, 12);
                if (names.length) info += `【这个世界里已经存在的人（别拿这些名字当路人）】${names.join('、')}\n`;
            }
            if (pplSrc('sched') && c.schedule && c.schedule.text)
                info += `【今天的日程】${String(c.schedule.text).replace(/\s+/g, ' ').slice(0, 200)}\n`;
            /* 👥 世界书里抽出来的那些人（js/39）——这才是最该出现在通讯录里的。
               有这一批就先用他们，别再另编一套跟世界对不上的人。 */
            let npcs = [];
            try { if (pplSrc('npc') && on('npcInPhone') && typeof window.gyNpcPool === 'function') npcs = window.gyNpcPool(id) || []; } catch (e) {}
            if (npcs.length) info += `【TA 身边真实存在的人（优先把这些放进通讯录，别另外编）】\n`
                + npcs.map(x => `· ${x.name}${x.who ? '，' + x.who : ''}${x.tie ? '——' + x.tie : ''}${x.tone ? '。说话' + x.tone : ''}`).join('\n') + '\n';

            const ask = `下面是一个人的设定。请替 TA 开一份**真实的手机通讯录**。

${info}
要求：
0. 上面如果给了「TA 身边真实存在的人」，**先把他们放进通讯录**（名字原样用，别改），
   再按下面的规矩补到 3~6 个。
1. 3 到 6 个联系人。**照着这个人的处境来**——没有家人的就别写"妈妈"，
   不上班的就别写"组长"，江湖人/古代人不会有"健身房"和"银行"。
   可以是这个世界里该有的角色：师父、掌柜、押镖的、坊主、驿站、药铺……
2. 每个人给 1 到 3 句 TA 们发来的消息，**像真的短信**：短、具体、有来由，
   不要寒暄体（别一律"吃饭了没""注意身体"）。可以是催账、问事、抱怨、通知。
3. 备注名要像本人存的（"王姐""三号仓库""没备注的号码"都行），不要写成介绍语。
4. ico 给一个 emoji。
5. src 从这几个里挑一个最贴的，挑不到就留空：
   sched(日程) wallet(钱) mall(包裹) takeout(外卖) kit(随身物) days(节气) map(位置天气) web(看过的网页)

只输出 JSON，不要解释：
{"contacts":[{"n":"备注名","ico":"🏠","who":"这人是谁，10字以内","src":"","talk":["第一句","第二句"]}]}`;
            const msgs = (typeof buildStructuredMessages === 'function')
                ? buildStructuredMessages('你在替一个虚构角色设计 TA 手机里的通讯录。', [], ask)
                : [{ role: 'user', content: ask }];
            const d = await callChatCompletionAPI(api, msgs);
            let t = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
            if (typeof extractAfterFinalMarker === 'function') t = extractAfterFinalMarker(t).trim();
            t = t.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
            const o = (typeof extractJsonObject === 'function') ? extractJsonObject(t) : JSON.parse(t);
            const arr = (o && Array.isArray(o.contacts)) ? o.contacts : null;
            if (!arr || !arr.length) { toast('没开出来，回头再试'); return null; }
            const list = arr.slice(0, 6).map(x => ({
                n: String(x.n || '').trim().slice(0, 12) || '没备注的号码',
                ico: String(x.ico || '📵').slice(0, 4),
                who: String(x.who || '').slice(0, 20),
                src: String(x.src || '').slice(0, 10),
                talk: (Array.isArray(x.talk) ? x.talk : []).slice(0, 3).map(y => String(y).slice(0, 40)).filter(Boolean)
            })).filter(x => x.talk.length);
            if (!list.length) { toast('没开出来，回头再试'); return null; }
            S.ppl[id] = { at: Date.now(), list };
            await save();
            window.gyPhoneForgetThreads();
            paint();
            toast(c.name + ' 的通讯录开好了：' + list.map(x => x.n).join('、'));
            return list;
        } catch (e) { toast('没开出来：' + String(e.message || e).slice(0, 40)); return null; }
        finally { pplBusy[id] = false; }
    };
    window.gyPhoneDropPeople = async function (charId) {
        delete S.ppl[String(charId)];
        await save(); window.gyPhoneForgetThreads(); paint();
        toast('回到默认那十二个联系人了');
    };
    // 这个角色现在用的是哪一份通讯录
    function pplOf(c) {
        if (!on('phoneAiPeople')) return null;
        const p = S.ppl[String(c.id)];
        return (p && Array.isArray(p.list) && p.list.length) ? p.list : null;
    }

    /* ---- 那些"你不认识的人"发来的消息，读的是 TA 真实的一天 ----
       原来是十二段写死的模板，谁的手机翻开都一模一样。
       现在按下面这张表去读 TA 身上真有的东西（日程、账单、包裹、外卖、
       看过的网页、随身物、节气、位置天气、八卦、换装、小剧场），
       挑一条跟这个联系人对得上的，说成那个人会说的话。
       读哪几样由你定：设置 → 🧾 注入内容管理 → ② 生成时读什么。
       一条都读不到（或者你全关了）就退回原来的模板，不会空着。 */
    const SRC_DEFS = [
        { k: 'sched',  label: '今天的日程',      desc: '日程系统排的那一天。同事、组长、健身房这类联系人最常聊这个。' },
        { k: 'wallet', label: '钱包流水',        desc: '房租、水电、还款——房东和银行发来的消息就是从这儿来的。' },
        { k: 'mall',   label: '包裹动态',        desc: '快递、便利店那两条。' },
        { k: 'takeout',label: '外卖订单',        desc: '' },
        { k: 'web',    label: '上网看过的东西',  desc: '老同学、同事聊起来的话题。' },
        { k: 'kit',    label: '随身物',          desc: '医生、妈妈会提的那些。' },
        { k: 'days',   label: '节气与日子',      desc: '爸妈那种"降温了加衣服"的消息。' },
        { k: 'map',    label: '位置与天气',      desc: '' },
        { k: 'gossip', label: '八卦',            desc: '老同学、没备注的号码。', defaultOff: true },
        { k: 'dress',  label: '换过的样子',      desc: '' },
        { k: 'theater',label: '小剧场里发生过的事', desc: '要开着「角色互动总开关」才有内容。' },
        { k: 'persona',label: '人设关键词',      desc: '实在读不到别的时才用，让语气不至于所有人都一样。' }
    ];
    const SRC_BOX = { map: '__gyMapCtxFor', wallet: '__gyWalletCtxFor', mall: '__gyMallCtxFor',
                      takeout: '__gyTakeoutCtxFor', web: '__gyWebCtxFor', kit: '__gyKitCtxFor',
                      days: '__gyDaysCtxFor', gossip: '__gyGossipCtxFor', dress: '__gyDressCtxFor' };
    const srcOn = k => { try { return typeof window.gyInjectSrc !== 'object'
        || typeof window.gyInjectSrc.on !== 'function' || window.gyInjectSrc.on('phoneTalk', k); } catch (e) { return true; } };
    // 从某一类数据里掏出一句能用的短语（不带【小标题】，不带前缀符号）
    function factsFrom(c, k) {
        try {
            if (!srcOn(k)) return [];
            if (k === 'sched') {
                const t = c.schedule && c.schedule.text ? String(c.schedule.text) : '';
                // 切碎一点：整句塞进"…那个，明天要交"里面读起来像机器人
                return t ? t.split(/[\n。；;，,、]/).map(x => x.trim()).filter(x => x.length > 2 && x.length < 17) : [];
            }
            if (k === 'persona') {
                return String(c.persona || '').split(/[，。,\n、]/).map(x => x.trim()).filter(x => x.length > 1 && x.length < 14).slice(0, 4);
            }
            if (k === 'theater') {
                return (typeof globalTheaterLogs !== 'undefined' ? globalTheaterLogs : [])
                    .filter(l => l && (String(l.charAId) === String(c.id) || String(l.charBId) === String(c.id)))
                    .slice(-4).map(l => String(l.summary || '').trim()).filter(Boolean);
            }
            const fn = SRC_BOX[k];
            if (!fn) return [];
            const raw = (typeof window.gyInjectRaw === 'function') ? window.gyInjectRaw(fn, c.id)
                      : (typeof window[fn] === 'function' ? window[fn](c.id) : '');
            if (!raw) return [];
            return String(raw).split('\n')
                .map(x => x.replace(/^[·\-\s]+/, '').trim())
                .filter(x => x && x.indexOf('【') !== 0 && x.length > 3 && x.length < 34)
                .slice(0, 6);
        } catch (e) { return []; }
    }
    // 每个联系人先读哪几样，读到之后怎么说
    const SAY = {
        '妈妈':        [['days', f => f + '，记得吃点热的'], ['map', f => f + '，多穿点'], ['kit', f => '你那个' + f + '还在用吗'], ['sched', f => '今天还要' + f + '？别太累']],
        '爸':          [['wallet', f => '钱还够花吗，' + f + '这些别硬撑'], ['days', f => f + '，家里都好'], ['sched', f => f + '的事顺利吗']],
        '房东':        [['wallet', f => f + '，麻烦这两天转一下'], ['map', f => '楼下' + f + '，注意点']],
        '同事·小吴':   [['sched', f => f + '那个，明天要交'], ['web', f => '你发我的' + f + '我看了'], ['theater', f => f + '的事我听说了']],
        '组长':        [['sched', f => f + '改到十点，别迟到'], ['web', f => f + '的材料记得带']],
        '老同学':      [['theater', f => '听说你' + f + '？'], ['gossip', f => f + '，真的假的'], ['web', f => f + '那个我也看了'], ['dress', f => f + '，我看见了']],
        '楼下便利店':  [['takeout', f => '你要的' + f + '到了'], ['mall', f => f + '，放我这儿了']],
        '没备注的号码':[['gossip', f => f]],
        '快递':        [['mall', f => f], ['takeout', f => f]],
        '医生':        [['kit', f => f + '按时用，别停'], ['sched', f => f + '之前先别吃东西']],
        '健身房':      [['sched', f => f + '之后来一趟？'], ['persona', f => '您的课还剩 3 节']],
        '银行':        [['wallet', f => f + '　账户变动提醒'], ['mall', f => f + '　交易成功']]
    };
    /* 一整台手机的会话一次算完，而不是一个联系人算一次——
       因为要控制"同一路数据最多给两个人用"，还要保证同一句话不会被两个人说。
       同一个角色、同一天，算出来的东西是固定的（seedInt 决定）。 */
    let threadCache = { key: '', map: null };
    function buildThreads(c) {
        if (typeof window.gyInjectInScene === 'function' && window.gyInjectScene() !== 'phoneTalk')
            return window.gyInjectInScene('phoneTalk', () => buildThreads(c));
        const key = String(c.id) + '|' + new Date().toDateString() + '|' + (pplOf(c) ? 'ai' : 'std');
        if (threadCache.key === key && threadCache.map) return threadCache.map;
        const map = {};
        const usedSrc = {};       // 每路数据用了几次
        const usedTxt = new Set();
        // 📇 有按人设开的通讯录就用那一份：说的话是模型写的，
        //    但如果那个人挂了 src，还是会从真实数据里挑一条补进去。
        const ai = pplOf(c);
        if (ai) {
            ai.forEach(x => {
                const lines = x.talk.map(t => [x.n, t]);
                if (x.src && (usedSrc[x.src] || 0) < 2) {
                    const fs = factsFrom(c, x.src).filter(f => !usedTxt.has(f));
                    if (fs.length) {
                        const f = fs[seedInt(c.id, 'f' + x.n + x.src, 0, fs.length - 1)];
                        usedSrc[x.src] = (usedSrc[x.src] || 0) + 1; usedTxt.add(f);
                        lines.push([x.n, String(f).slice(0, 40)]);
                    }
                }
                if (lines.length > 1) {
                    const rep = ['嗯', '知道了', '好', '行', '晚点说'][seedInt(c.id, 'rp' + x.n, 0, 4)];
                    lines.splice(1, 0, ['我', rep]);
                }
                map[x.n] = lines;
            });
            threadCache = { key, map };
            return map;
        }
        const names = POOL.map(p => p.n);
        names.forEach(who => {
            const plan = SAY[who] || [];
            const lines = [];
            for (let i = 0; i < plan.length && lines.length < 2; i++) {
                const [k, tpl] = plan[i];
                if ((usedSrc[k] || 0) >= 2) continue;            // 这路已经有两个人在说了
                const fs = factsFrom(c, k).filter(f => !usedTxt.has(f));
                if (!fs.length) continue;
                const f = fs[seedInt(c.id, 'f' + who + k, 0, fs.length - 1)];
                let t = '';
                try { t = tpl(f); } catch (e) { t = f; }
                t = String(t).slice(0, 40);
                if (!t || lines.some(x => x[1] === t)) continue;
                usedSrc[k] = (usedSrc[k] || 0) + 1;
                usedTxt.add(f);
                lines.push([who, t]);
            }
            map[who] = lines;
        });
        threadCache = { key, map };
        return map;
    }
    // 数据变了就重算（换了日程、下了单、换了头像…）
    window.gyPhoneForgetThreads = function () { threadCache = { key: '', map: null }; };
    function threadOf(c, who) {
        const ct = cardThread(c, who);
        if (ct && ct.length) return ct;
        // 关系网上的人：用真发生过的事，不用模板
        const p = peersOf(c).find(x => x.n === who);
        if (p) {
            const real = peerThread(c, p.peer, who);
            if (real.length) return real;
            return [[who, p.rel ? '（' + p.rel + '，还没发生过什么）' : '（还没发生过什么）']];
        }
        // 读 TA 真实的一天（有按人设开的通讯录就是那一份）
        const lines = (buildThreads(c)[who] || []).slice();
        if (!lines.length && pplOf(c)) return [[who, '……']];
        if (!lines.length) {
            const t = TALK[who] || [[who, '……']];
            const n = seedInt(c.id, 'tk' + who, Math.min(2, t.length), t.length);
            return t.slice(0, n);
        }
        // 中间夹一句 TA 自己的回话，看着才像一来一回
        if (lines.length > 1) {
            const rep = ['嗯', '知道了', '好', '行', '晚点说'][seedInt(c.id, 'rp' + who, 0, 4)];
            lines.splice(1, 0, ['我', rep]);
        }
        return lines;
    }
    function regChatActs() {
        try {
            if (typeof window.gyChatActionAdd !== 'function') return;
            window.gyChatActionAdd({
                id: 'phoneAsk', icon: '📱', label: '问 TA 借手机看', sub: 'TA 自己决定给不给',
                show: id => on('phoneOn') && !!charOf(id),
                run: id => window.gyPhoneAsk(id)
            });
            window.gyChatActionAdd({
                id: 'phoneOffer', icon: '🤲', label: '让 TA 看我的手机', sub: '主动递过去',
                show: id => on('phoneOn') && !!charOf(id),
                run: id => window.gyPhoneOffer(id)
            });
        } catch (e) {}
    }
    function regSrc() {
        try {
            if (!window.gyInjectSrc || typeof window.gyInjectSrc.def !== 'function') return;
            window.gyInjectSrc.def({
                feat: 'phonePeople', icon: '📇', title: '手机通讯录（照人设开的那一份）',
                note: '点「照人设开一份通讯录」时，把下面这些交给模型，让它替这个人开一份真正属于 TA 的联系人。'
                    + '一个角色只花一次调用，开好就存着。全关掉的话模型手里什么都没有，只能瞎编。',
                items: PPL_SRC
            });
            window.gyInjectSrc.def({
                feat: 'phoneTalk', icon: '📱', title: 'TA 手机里那些人发来的消息',
                note: '通讯录里你不认识的那些人（妈妈、房东、同事、快递…）跟 TA 说的话，是照着下面这些真实数据编的。'
                    + '全关掉就退回十二段固定模板，谁的手机翻开都一样。关系网上的角色不走这条路——那些是真发生过的事。',
                items: SRC_DEFS
            });
        } catch (e) {}
    }
    function appMsg(c) {
        const me = (typeof userDisplayName === 'function') ? userDisplayName(c) : meName();
        // 打开了某一条会话
        if (msgWho !== null) {
            if (msgWho === '__me__') {
                let arr = [];
                try { arr = ((typeof globalChats !== 'undefined' && globalChats[String(c.id)]) || [])
                    .filter(x => x && x.text && x.sender !== 'system').slice(-40); } catch (e) {}
                return `<div class="gyph-thd-hd"><span onclick="gyPhoneMsgBack()">‹</span><b>${esc(me)}</b></div>` +
                    (arr.length ? arr.map(x => `<div class="gyph-bub ${x.sender === 'me' ? 'them' : 'self'}">
                        ${esc(String(x.text).replace(/<[^>]+>/g, '').slice(0, 300))}</div>`).join('')
                     : empty('你们还没说过话。'));
            }
            const t = threadOf(c, msgWho);
            return `<div class="gyph-thd-hd"><span onclick="gyPhoneMsgBack()">‹</span><b>${esc(msgWho)}</b></div>` +
                t.map(([w, txt]) => `<div class="gyph-bub ${w === '我' ? 'self' : 'them'}">${esc(txt)}</div>`).join('');
        }
        // 会话列表
        let last = '';
        try {
            const arr = (typeof globalChats !== 'undefined' && globalChats[String(c.id)]) || [];
            const m = arr.filter(x => x && x.text && x.sender !== 'system').slice(-1)[0];
            if (m) last = String(m.text).replace(/<[^>]+>/g, '').slice(0, 24);
        } catch (e) {}
        const mine = `<div class="gyph-msg you" onclick="gyPhoneMsgOpen('__me__')">
            <div class="gyph-av">${esc(me.slice(0, 1))}</div>
            <div><b>${esc(me)}</b><span>${esc(last || '（还没说过话）')}</span></div>
            <i class="gyph-go">›</i>
        </div>`;
        const others = contactsOf(c).map(x => {
            const t = threadOf(c, x.n);
            const tail = t[t.length - 1];
            return `<div class="gyph-msg" onclick="gyPhoneMsgOpen('${esc(x.n)}')">
                <div class="gyph-av">${x.ico}</div>
                <div><b>${esc(x.n)}</b><span>${esc(tail ? ((tail[0] === '我' ? '我：' : '') + tail[1]) : '')}</span></div>
                ${x.unread ? `<i class="gyph-dot">${x.unread}</i>` : '<i class="gyph-go">›</i>'}
            </div>`;
        }).join('');
        return mine + others;
    }
    let msgWho = null;
    window.gyPhoneMsgOpen = function (who) {
        msgWho = who;
        const c = charOf(curId);
        if (c && on('phoneRemember')) {
            const k = String(curId);
            if (!Array.isArray(S.seen[k])) S.seen[k] = [];
            const g = who === '__me__' ? '翻了你们俩的聊天记录'
                : ('翻了 TA 跟「' + who + '」的聊天：' + (threadOf(c, who).slice(-1)[0] || ['', ''])[1]);
            const last = S.seen[k][0];
            if (!(last && last.gist === g && Date.now() - last.at < 10 * 60000)) {
                S.seen[k].unshift({ at: Date.now(), app: 'msg', name: '消息', gist: g });
                if (S.seen[k].length > 30) S.seen[k].length = 30;
                save();
            }
        }
        paint();
    };
    window.gyPhoneMsgBack = function () { msgWho = null; paint(); };

    /* ================= 通知 =================
       两种来源，可切换：
         · 本地拼（默认，一次 API 都不调）——从模板 + 角色现有的数据里凑
         · 让模型写一批（开关 phoneNotifAi）——按人设和最近发生的事写，更像那个人 */
    function localNotif(c) {
        const out = [];
        const push = (app, who, text) => out.push({ id: uid(), at: Date.now() - Math.floor(Math.random() * 6 * 3600000), app, who, text, unread: Math.random() < 0.6 });
        // 来自"你不认识的人"
        const LINES = [
            ['👩', '妈妈', ['记得吃饭', '天冷了加衣服', '什么时候回来', '给你寄了点东西']],
            ['🧑‍💼', '同事·小吴', ['那个表格明天要', '开会改到十点了', '你桌上的水杯我帮你收了']],
            ['🏠', '房东', ['这个月的水电', '楼道要检修']],
            ['📵', '没备注的号码', ['……', '在吗', '（一条语音）']],
            ['🏦', '银行', ['账户变动提醒', '还款日快到了']],
            ['🚚', '快递', ['您的包裹已放在驿站', '取件码 8823']]
        ];
        const n = 2 + Math.floor(Math.random() * 3);
        const used = new Set();
        for (let i = 0; i < n; i++) {
            const L = rnd(LINES);
            if (used.has(L[1])) continue;
            used.add(L[1]);
            push(L[0], L[1], rnd(L[2]));
        }
        // 来自白露自己的数据（真发生过的事）
        try {
            const ps = (window.gyParcel && window.gyParcel.list) ? window.gyParcel.list(c.id) : [];
            const arrived = ps.find(p => p.status === 'arrived');
            if (arrived) push('📦', '快递', arrived.name + ' 到了，等你签收');
        } catch (e) {}
        try {
            if (window.gyWallet && window.gyWallet.log) {
                const l = window.gyWallet.log(c.id)[0];
                if (l) push('💳', '钱包', (l.amt >= 0 ? '入账 ' : '支出 ') + '￥' + money(Math.abs(l.amt)) + '　' + l.why);
            }
        } catch (e) {}
        if (c.schedule && c.schedule.text) push('📅', '日程', String(c.schedule.text).slice(0, 22));
        return out.sort((a, b) => b.at - a.at);
    }
    window.gyPhoneRefresh = async function (charId) {
        const c = charOf(charId); if (!c) return;
        const k = String(charId);
        S.notif[k] = localNotif(c).concat((S.notif[k] || []).slice(0, 6)).slice(0, 14);
        S.lastGen[k] = Date.now();
        await save(); paint();
    };
    window.gyPhoneAiNotif = async function (charId) {
        const c = charOf(charId); if (!c) return;
        if (!on('phoneNotifAi')) return toast('先去开关里打开「让模型写通知」');
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) return toast('还没配 API Key');
        toast('正在让 TA 的手机活过来…');
        try {
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name);
            let job = '';
            try { const w = window.gyWallet; if (w) job = ''; } catch (e) {}
            const ask = `写一批**你手机上刚收到的通知**。这些通知来自你生活里那些
${(typeof userDisplayName === 'function') ? userDisplayName(c) : '对方'}**不认识**的人和事——
家人、同事、房东、医生、你圈子里的人、你常去的店、你在追的东西。
要具体到只可能属于你（"排练室老周：周三还来吗"这种），不要写成通用模板。
${c.schedule && c.schedule.text ? `你今天的安排：${String(c.schedule.text).slice(0, 200)}\n` : ''}
只输出 JSON 数组，5 到 8 条，不要解释：
[{"ico":"一个 emoji","who":"发通知的人或 app，8字以内","text":"通知正文，20字以内"}]`;
            const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
            const data = await callChatCompletionAPI(api, msgs);
            const raw = (data?.choices?.[0]?.message?.content || '').trim();
            const m = raw.match(/\[[\s\S]*\]/);
            const arr = JSON.parse(m ? m[0] : raw);
            if (!Array.isArray(arr) || !arr.length) return toast('这次没写出来');
            const k = String(charId);
            S.notif[k] = arr.slice(0, 8).map(x => ({
                id: uid(), at: Date.now() - Math.floor(Math.random() * 5 * 3600000),
                app: String(x.ico || '🔔').slice(0, 4), who: String(x.who || '').slice(0, 12),
                text: String(x.text || '').slice(0, 40), unread: Math.random() < 0.7
            })).sort((a, b) => b.at - a.at).concat((S.notif[k] || []).slice(0, 4)).slice(0, 14);
            S.lastGen[k] = Date.now();
            await save(); paint();
            toast('刷新了 ' + arr.length + ' 条');
        } catch (e) { console.warn('[手机] AI 通知失败', e); toast('这次没写出来'); }
    };

    /* ================= 页面 ================= */
    let curId = null, curApp = null, shade = false;
    const toast = m => { try { if (typeof showToast === 'function') showToast('', '📱', m, null, null, false); } catch (e) {} };
    const WALLS = ['w1', 'w2', 'w3', 'w4', 'w5'];

    window.gyPhoneOpen = async function (charId) {
        if (!on('phoneOn')) return toast('先去 设置 → ⚙️ 自动化功能 → 📱 手机 打开这一项');
        const c = charOf(charId); if (!c) return;
        curId = String(charId); curApp = null; shade = false;
        // ⚠️ 这里以前会**随机**塞一个壁纸，于是所有人的手机都是随机的、跟人设没关系。
        //    现在壁纸由 wallOf() 按人设推，只有你手动挑过才写进 S.wall。
        // 通知太旧就本地刷一批（不花钱）
        if (!S.notif[curId] || !S.notif[curId].length || Date.now() - (S.lastGen[curId] || 0) > 3 * 3600000) {
            S.notif[curId] = localNotif(c); S.lastGen[curId] = Date.now(); await save();
        }
        mountView();
        try { if (typeof switchMainView === 'function') switchMainView('phone'); } catch (e) {}
        paint();
    };
    window.gyPhoneBack = function () { if (msgWho !== null) { msgWho = null; paint(); } else if (curApp) { curApp = null; paint(); } else { try { switchMainView('profile', curId); } catch (e) {} } };
    window.gyPhoneApp = function (k) {
        const a = appOf(k); const c = charOf(curId);
        if (!a || !c) return;
        if (!canSee(curId, a)) return toast('这个点不开——' + lockHint(a));
        curApp = k; msgWho = null;
        noteSeen(curId, k);      // 记下"看过、看到了什么"（开关 phoneRemember）
        paint();
    };
    window.gyPhoneShade = function () { shade = !shade; paint(); };
    window.gyPhoneRead = async function () {
        (S.notif[curId] || []).forEach(x => { x.unread = false; });
        await save(); paint();
    };
    window.gyPhoneMode = async function (v) { S.mode = v; await save(); paint(); };
    window.gyPhoneNeed = async function (k, v) { S.need[k] = parseInt(v) || 0; await save(); paint(); };
    window.gyPhoneAllow = async function (k, v) { S.allow[k] = !!v; await save(); paint(); };
    window.gyPhoneSwitchChar = function (id) { gyPhoneOpen(id); };
    // 从图库挑一张当壁纸——图库那边点图会走 gyDressPicker，选「角色手机壁纸」就落到这儿
    window.gyPhonePickWall = function () {
        try { if (typeof gyGalleryOpen === 'function') gyGalleryOpen(); } catch (e) {}
        toast('在图库里点一张图，选「角色手机壁纸」');
    };

    function mountView() {
        if (document.getElementById('view-phone')) return;
        const host = document.querySelector('.main-content') || document.body;
        const v = document.createElement('div');
        v.id = 'view-phone'; v.style.display = 'none';
        v.innerHTML = `<div class="header-title"><div class="back-btn" onclick="gyPhoneBack()">←</div>
            <span id="gyphTitle">TA 的手机</span></div><div id="gyphBody"></div>`;
        host.appendChild(v);
        // 让 switchMainView('phone') 认得这一页
        const sw = window.switchMainView;
        if (typeof sw === 'function' && !sw.__gyphPatched) {
            window.switchMainView = function (viewId, param) {
                const me = document.getElementById('view-phone');
                if (viewId === 'phone') {
                    document.querySelectorAll('.main-content > div[id^="view-"]').forEach(x => { x.style.display = 'none'; });
                    if (me) me.style.display = 'block';
                    return;
                }
                // ⚠️ 原来的 switchMainView 不认识 view-phone，它只会把**它知道的**那些页藏起来。
                //    所以离开手机页时得自己把自己藏掉，否则它会一直垫在别的页面下面露出来。
                if (me) me.style.display = 'none';
                return sw.apply(this, arguments);
            };
            window.switchMainView.__gyphPatched = true;
        }
    }

    function paint() {
        const c = charOf(curId);
        // 悬浮窗里那台跟整页里那台是同一份，同一次 paint 画两处，不会不同步
        if (S.float.open && !S.float.mini && c) {
            const fb = document.getElementById('gyphFloatBody');
            if (fb) fb.innerHTML = deviceHtml(c);
        }
        const box = document.getElementById('gyphBody');
        if (!box) return;
        if (!c) { box.innerHTML = empty('找不到这个人。'); return; }
        const t = document.getElementById('gyphTitle');
        if (t) t.innerText = c.name + ' 的手机';
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        const bat = seedInt(curId, 'bat', 8, 99);
        const notif = S.notif[curId] || [];
        const unread = notif.filter(x => x.unread).length;

        box.innerHTML = `
        <div class="gyph-wrap">
          ${deviceHtml(c)}
          <div class="gyph-side">
            <div class="gyph-side-hd">你在看 ${esc(c.name)} 的手机</div>
            <div class="gyph-side-p">只能看，不能替 TA 点开消息、回复或者改任何东西。
              看到的每一条都来自已经存在的数据，手机只是换一种方式把它们摆出来。</div>
            <div class="gyph-acts">
              <button type="button" class="btn-edit-small" onclick="gyPhonePop('${curId}')">📌 挂到页面上</button>
              <button type="button" class="btn-edit-small" onclick="gyPhoneShade()">${shade ? '收起通知栏' : '下拉通知栏'}</button>
              <button type="button" class="btn-edit-small" onclick="gyPhoneRefresh('${curId}')">🔄 刷新通知</button>
              ${on('phoneNotifAi') ? `<button type="button" class="btn-edit-small" onclick="gyPhoneAiNotif('${curId}')">✨ 让 TA 的手机活过来</button>` : ''}
            </div>
            <div class="gyph-side-hd" style="margin-top:14px;">借来看 / 给 TA 看</div>
            <div class="gyph-side-p">"能不能看看你手机"是要开口问的事——私聊里会出现一张卡，
              ${esc(c.name)} 按人设决定给不给，答应了这段时间里所有 app 都开。</div>
            ${granted(curId) ? `<div class="gyph-grant">✅ ${esc(grantText(curId))}${S.grant[curId].line ? '<em>「' + esc(S.grant[curId].line) + '」</em>' : ''}</div>` : ''}
            ${S.mine[curId] ? `<div class="gyph-grant mine">📲 ${esc(c.name)} 看过你的手机${S.mine[curId].line ? '<em>「' + esc(S.mine[curId].line) + '」</em>' : ''}</div>` : ''}
            <div class="gyph-acts">
              <button type="button" class="btn-edit-small" onclick="gyPhoneAsk('${curId}')">📱 问 TA 借来看</button>
              <button type="button" class="btn-edit-small" onclick="gyPhoneOffer('${curId}')">📲 把我的给 TA 看</button>
            </div>
            <div class="gyph-need" style="margin-top:8px;">
              <span>答应之后能看多久</span>
              <select class="gyph-in" style="width:auto;margin:0;" onchange="gyPhoneGrantMin(this.value)">
                ${[-1, 0, 30, 60, 240, 1440].map(m => `<option value="${m}"${Number(S.grantMin) === m ? ' selected' : ''}>${GRANT_LABEL[m]}</option>`).join('')}
              </select>
            </div>
            <div class="gyph-side-hd" style="margin-top:14px;">📇 通讯录</div>
            <div class="gyph-side-p">
              ${S.ppl[curId] && S.ppl[curId].list && S.ppl[curId].list.length
                ? `现在用的是<b>照着 ${esc(c.name)} 的人设开的那一份</b>：${esc(S.ppl[curId].list.map(x => x.n).join('、'))}`
                : `现在是那十二个通用联系人（妈妈、房东、同事…），谁的手机翻开都一样。
                   人设里写着没家人、不上班、或者根本不是现代人的角色，这些人不该出现在 TA 手机里。`}
            </div>
            <div style="margin-bottom:10px;">
              <button class="gyph-btn" onclick="gyPhoneMakePeople('${curId}')">
                ${S.ppl[curId] ? '↻ 重开一份' : '照人设开一份通讯录'}</button>
              ${S.ppl[curId] ? `<button class="gyph-btn ghost" onclick="gyPhoneDropPeople('${curId}')">用回默认的</button>` : ''}
            </div>
            <div class="gyph-side-p" style="opacity:.75;">
              读人设和世界书生成，一个角色只花一次调用，开好就存着。
              读哪几样在 <b>设置 → 🧾 注入内容管理 → ② 生成时读什么 → 📇 手机通讯录</b> 里挑。
            </div>
            <div class="gyph-side-hd" style="margin-top:14px;">🃏 卡片里的手机</div>
            <div class="gyph-side-p">
              ${(() => { const b = S.card[curId]; const n = b ? b.msgs.length + b.notes.length + b.moments.length : 0;
                 return n ? `已经收了 <b>${b.msgs.length}</b> 条消息、<b>${b.notes.length}</b> 篇小红书、<b>${b.moments.length}</b> 条朋友圈——聊天里 TA 用卡片格式写的「手机里的事」都在这儿。`
                          : `聊天里 TA 用卡片格式写「手机里的事」（&lt;msg&gt;、小红书、朋友圈、[消息-谁]…）时，会收进这台手机；发给你的直接变成真消息。`; })()}
              ${cardFormatSpec(c) ? '这张卡自带手机格式，生成时照它来。' : ''}
            </div>
            ${on('phoneCardGen') ? `<div style="margin-bottom:10px;"><button class="gyph-btn" onclick="gyPhoneCardGen('${curId}')">✨ 按卡片格式让手机动起来</button></div>` : ''}
            <div class="gyph-need">
              <span>手机配色</span>
              <select class="gyph-in" style="width:auto;margin:0;" onchange="gyPhoneSkinSrc('${curId}', this.value)">
                <option value="card"${skinSrcOf(curId) === 'card' ? ' selected' : ''}${cardPalette(curId) ? '' : ' disabled'}>跟卡片的样式${cardPalette(curId) ? '' : '（这张卡没带样式）'}</option>
                <option value="persona"${skinSrcOf(curId) === 'persona' ? ' selected' : ''}>跟人设推</option>
              </select>
            </div>
            <div class="gyph-side-hd" style="margin-top:14px;">🎨 图标</div>
            <div class="gyph-side-p">${S.icons[curId]
                ? `现在是照人设设计的一套：<b>${esc(S.icons[curId].motif || '')}</b>${S.icons[curId].why ? '——' + esc(S.icons[curId].why) : ''}`
                : '可以让 TA 按自己的人设设计一套图标：从人设里挑一个最像 TA 的元素，整套图标围着它来。点一次一次调用。'}</div>
            <div style="margin-bottom:10px;">
              <button class="gyph-btn" onclick="gyPhoneIconAi('${curId}')">${S.icons[curId] ? '↻ 重新设计' : '🎨 照人设设计图标'}</button>
              ${S.icons[curId] ? `<button class="gyph-btn ghost" onclick="gyPhoneIconReset('${curId}')">用回默认的</button>` : ''}
            </div>
            <div class="gyph-side-hd" style="margin-top:14px;">壁纸与图标</div>
            <div class="gyph-side-p">
              这台手机默认是<b>按 ${esc(c.name)} 的人设推出来的</b>——${esc(gyPhoneStyleOf(curId).tag)}。
              所以每个角色的手机一眼就不一样。你手动挑过之后就以你挑的为准。
            </div>
            <div class="gyph-walls">
              ${WALLS.map(w => `<span class="gyph-w ${w} ${String(S.wall[curId]) === w ? 'on' : ''}" onclick="gyPhoneSetWall('${curId}','${w}');gyPhoneRepaint()"></span>`).join('')}
              ${(typeof window.gyGalleryOpen === 'function' && window.gyGallery && window.gyGallery.seenBy(curId).length)
                ? `<span class="gyph-w pick" onclick="gyPhonePickWall()" title="从图库挑一张">🖼️</span>` : ''}
              ${(S.wall[curId] || S.iconSkin[curId] || S.iconTint[curId])
                ? `<span class="gyph-w pick" onclick="gyPhoneAutoStyle('${curId}')" title="恢复成按人设推">↺</span>` : ''}
            </div>
            <div class="gyph-need">
              <span>图标配色</span>
              <select class="gyph-in" style="width:auto;margin:0;" onchange="gyPhoneSetTint('${curId}', this.value)">
                <option value="person"${(S.iconTint[curId] || 'person') === 'person' ? ' selected' : ''}>跟着 TA 的风格</option>
                <option value="app"${S.iconTint[curId] === 'app' ? ' selected' : ''}>每个 app 自己的颜色</option>
              </select>
            </div>
            <div class="gyph-need">
              <span>图标形状</span>
              <select class="gyph-in" style="width:auto;margin:0;" onchange="gyPhoneSetSkin('${curId}', this.value)">
                <option value="auto"${!S.iconSkin[curId] ? ' selected' : ''}>跟 ${esc(c.name)} 的人设推</option>
                <option value="round"${S.iconSkin[curId] === 'round' ? ' selected' : ''}>圆角方块</option>
                <option value="circle"${S.iconSkin[curId] === 'circle' ? ' selected' : ''}>圆的</option>
                <option value="glass"${S.iconSkin[curId] === 'glass' ? ' selected' : ''}>毛玻璃</option>
                <option value="flat"${S.iconSkin[curId] === 'flat' ? ' selected' : ''}>纯色扁平</option>
              </select>
            </div>
            <div class="gyph-side-hd" style="margin-top:14px;">能看到多少</div>
            <select class="gyph-in" onchange="gyPhoneMode(this.value)">
              <option value="all"${S.mode === 'all' ? ' selected' : ''}>全部都能看</option>
              <option value="rel"${S.mode === 'rel' ? ' selected' : ''}>按好感度解锁</option>
              <option value="manual"${S.mode === 'manual' ? ' selected' : ''}>我自己逐个勾</option>
            </select>
            ${S.mode === 'rel' ? `
              <div class="gyph-need"><span>一般的（位置/随身物/包裹/音乐/备忘/日子）</span>
                <input type="number" value="${S.need.mid}" onchange="gyPhoneNeed('mid',this.value)"></div>
              <div class="gyph-need"><span>私密的（消息/钱包/浏览器/相册）</span>
                <input type="number" value="${S.need.deep}" onchange="gyPhoneNeed('deep',this.value)"></div>
              <div class="gyph-side-p">现在跟 ${esc(c.name)} 的好感度是 <b>${relScore(curId)}</b>。桌面、日程、屏幕时间永远看得到。</div>` : ''}
            ${S.mode === 'manual' ? `<div class="gyph-checks">${APPS.filter(a => a.lock !== 'base').map(a => `
                <label><input type="checkbox" ${S.allow[a.key] ? 'checked' : ''}
                    onchange="gyPhoneAllow('${a.key}',this.checked)"> ${a.ico} ${esc(a.name)}</label>`).join('')}</div>` : ''}
            ${on('phoneRemember') && (S.seen[curId] || []).length ? `
              <div class="gyph-side-hd" style="margin-top:14px;">你看到过什么</div>
              <div class="gyph-side-p">TA 知道你看过，也知道你看见了这些——聊天时可能会提起来。</div>
              <div class="gyph-seen">${(S.seen[curId] || []).slice(0, 6).map(x =>
                  `<div><b>${esc(x.name)}</b><span>${esc(x.gist || '')}</span><em>${esc(ago(x.at))}</em></div>`).join('')}</div>` : ''}
            <div class="gyph-side-hd" style="margin-top:14px;">换个人</div>
            <select class="gyph-in" onchange="gyPhoneSwitchChar(this.value)">
              ${chars().map(x => `<option value="${x.id}"${String(x.id) === curId ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}
            </select>
          </div>
        </div>`;
    }

    // 机身：整页和悬浮窗共用这一段
    function deviceHtml(c) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        const bat = seedInt(curId, 'bat', 8, 99);
        const notif = S.notif[curId] || [];
        const unread = notif.filter(x => x.unread).length;
        const w = String(wallOf(curId));
        const isImg = w.indexOf('img:') === 0;
        const skin = skinOf(curId);
        // 🃏 配色跟卡片：没手动挑过壁纸的，用卡片自己样式里的两个主色铺一层渐变
        const pal = (!isImg && !S.wall[String(curId)] && skinSrcOf(curId) === 'card') ? cardPalette(curId) : null;
        const palStyle = pal ? `style="background:linear-gradient(168deg, ${pal.a} 0%, color-mix(in srgb, ${pal.b} 70%, #000) 55%, color-mix(in srgb, ${pal.b} 35%, #000) 100%)"` : '';
        return `
          <div class="gyph-dev ${isImg ? 'photo' : esc(w)} skin-${esc(skin)}"
               ${isImg ? `style="background-image:url('${esc(w.slice(4)).replace(/'/g, "\\'")}')"` : palStyle}>
            <div class="gyph-status">
              <span class="gyph-t">${hh}</span>
              <span class="gyph-notch"></span>
              <span class="gyph-right">
                ${unread ? '<i class="gyph-sdot"></i>' : ''}
                <i class="gyph-sig"><b></b><b></b><b></b><b></b></i>
                <i class="gyph-wifi"></i>
                <i class="gyph-batt ${bat < 20 ? 'low' : ''}"><b style="width:${Math.max(6, bat)}%"></b></i>
                <em>${bat}</em>
              </span>
            </div>
            ${shade ? shadeHtml(notif) : (curApp ? appScreen(c) : homeScreen(c))}
            <div class="gyph-home"></div>
          </div>`;
    }
    function homeScreen(c) {
        const notif = S.notif[curId] || [];
        const unread = notif.filter(x => x.unread).length;
        const now = new Date();
        const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
        const vis = a => !a.show || a.show(c);
        const grid = APPS.filter(a => !a.dock && vis(a));
        const dock = APPS.filter(a => a.dock && vis(a));
        return `
        <div class="gyph-screen">
          <div class="gyph-clock">
            <b>${now.getHours()}<i>:</i>${String(now.getMinutes()).padStart(2, '0')}</b>
            <span>${now.getMonth() + 1}月${now.getDate()}日　${week}</span>
          </div>
          ${unread ? `<div class="gyph-peek" onclick="gyPhoneShade()">
              <div class="gyph-peek-i">${esc(notif[0].app || '🔔')}</div>
              <div><b>${esc(notif[0].who)}</b><span>${esc(notif[0].text)}</span></div>
              <em>${unread}</em></div>` : ''}
          <div class="gyph-apps">${grid.map(a => iconHtml(a, c)).join('')}</div>
          <div class="gyph-dock">${dock.map(a => iconHtml(a, c)).join('')}</div>
        </div>`;
    }
    function iconHtml(a, c) {
        const ok = canSee(curId, a);
        const bd = a.badge ? a.badge(c) : 0;
        // 图标配色：跟着这个人的风格走（personal 模式），或者用每个 app 自己那对颜色
        const i = APPS.findIndex(x => x.key === a.key);
        const tint = (S.iconTint[String(curId)] === 'app') ? null : tintOf(curId, i, APPS.length);
        let c1 = tint ? tint[0] : a.c[0], c2 = tint ? tint[1] : a.c[1];
        const ic = S.icons[String(curId)];
        if (ic && S.iconTint[String(curId)] !== 'app' && ic.c1) { const k = i % 2; c1 = k ? (ic.c2 || ic.c1) : ic.c1; c2 = k ? ic.c1 : (ic.c2 || ic.c1); }
        const glyph = (ic && ic.apps && ic.apps[a.key]) || a.ico;
        return `<div class="gyph-app${ok ? '' : ' locked'}" onclick="gyPhoneApp('${a.key}')" title="${ok ? esc(a.name) : esc(lockHint(a))}">
            <div class="gyph-icon${ic ? ' themed' : ''}" style="--c1:${c1};--c2:${c2}">
                <span>${esc(glyph)}</span>${ic && ic.deco ? `<i class="gyph-deco">${esc(ic.deco)}</i>` : ''}
                ${!ok ? '<i class="gyph-lk">🔒</i>' : ''}${bd ? `<i class="gyph-bd">${bd}</i>` : ''}
            </div>
            <span class="gyph-an">${esc(a.name)}</span></div>`;
    }
    function appScreen(c) {
        const a = appOf(curApp);
        let body = '';
        try { body = a.render(c) || ''; } catch (e) { body = empty('这个 app 打不开。'); }
        return `<div class="gyph-screen app">
            <div class="gyph-appbar"><span onclick="gyPhoneBack()">‹</span><b>${a.ico} ${esc(a.name)}</b></div>
            <div class="gyph-appbody">${body}</div>
        </div>`;
    }
    function shadeHtml(notif) {
        return `<div class="gyph-screen shade">
            <div class="gyph-shade-hd"><b>通知</b>
                <span onclick="gyPhoneRead()">全部标为已读</span></div>
            ${notif.length ? notif.map(x => `<div class="gyph-nt${x.unread ? ' new' : ''}">
                <div class="gyph-nt-i">${esc(x.app || '🔔')}</div>
                <div><b>${esc(x.who)}</b><span>${esc(x.text)}</span></div>
                <em>${ago(x.at)}</em>
            </div>`).join('') : empty('没有新通知。')}
            <div class="gyph-pull" onclick="gyPhoneShade()">收起 ⌃</div>
        </div>`;
    }
    const ago = t => { const m = Math.round((Date.now() - t) / 60000);
        return m < 1 ? '刚刚' : m < 60 ? m + '分钟前' : Math.round(m / 60) + '小时前'; };

    /* ================= 借看：一张请求卡 =================
       "能不能看看你的手机"本来就是一件要**开口问、对方可以拒绝**的事。
       所以它不是一个按钮直接生效，而是私聊里的一张卡：你问 → TA 按人设决定 →
       答应了这段时间才解锁。TA 也会反过来问你（自主模式里的一个动作）。
       用的是 js/28 那套邀请卡的管线（同一套"请求-回应"语义），只是句子自己写。 */
    const GRANT_LABEL = { '-1': '让 TA 自己定', 0: '一直能看', 30: '半小时', 60: '一小时', 240: '四小时', 1440: '一整天' };
    /* 「让 TA 自己定」：给不给本来就是 TA 按人设决定的，那"能看多久"凭什么是个全局常数？
       大方的人递过去就不管了，警惕的人五分钟就要回去。
       不额外调 API——用的是 TA 答应时那句话里的语气 + 好感度，本地折一个时长出来。 */
    function grantMsFor(charId, line) {
        const m = Number(S.grantMin);
        if (m >= 0) return m > 0 ? m * 60000 : 0;
        const t = String(line || '');
        // 说话里带"一会儿/别乱翻/快点"是不情不愿；带"随便看/拿去"是无所谓
        if (/一会|几分钟|别乱|别翻|快点|就一下|看完还我/.test(t)) return 10 * 60000;
        if (/随便看|都给你|你自己看|拿去|无所谓|想看就看/.test(t)) return 0;
        const sc = relScore(charId);
        return sc >= 60 ? 0 : sc >= 30 ? 240 * 60000 : sc >= 10 ? 60 * 60000 : 20 * 60000;
    }
    function grantMs() { const m = Number(S.grantMin); return m > 0 ? m * 60000 : 0; }
    function grantText(charId) {
        const g = S.grant[String(charId)];
        if (!g) return '';
        if (!g.until) return 'TA 把手机给你了，一直能看';
        const left = Math.round((g.until - Date.now()) / 60000);
        return left > 0 ? `TA 把手机给你了，还能看 ${left} 分钟` : '上次借看已经过期了';
    }
    // 太频繁地问同一个人显得很怪，隔半小时才让再问一次
    const COOL = 30 * 60000;
    window.gyPhoneAsk = async function (charId) {
        const c = charOf(charId); if (!c) return;
        if (typeof window.gyInviteSend !== 'function') return toast('邀请卡模块没加载');
        const last = S.askedAt[String(charId)] || 0;
        if (Date.now() - last < COOL) {
            const m = Math.ceil((COOL - (Date.now() - last)) / 60000);
            return toast('刚问过，等 ' + m + ' 分钟再问吧');
        }
        S.askedAt[String(charId)] = Date.now(); await save();
        const uname = (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
        await window.gyInviteSend({
            char: c, kind: 'phone', title: '手机',
            say: `${meName()}想看看${c.name}的手机`,
            sub: '看看就好，不动里面的东西',
            ask: `${uname}问你："能不能给我看看你手机？"
手机里有你的聊天记录、相册、账单、搜过什么——这是很私人的东西。
按你自己的性格和你们现在的关系决定给不给看：还不熟、有不想被看到的东西、
正闹别扭、或者单纯觉得没必要，都可以直接拒绝，不用勉强自己迁就。
真的愿意给看的话，也可以有条件（"别翻相册"这种）。
只输出 JSON，不要 markdown：{"ok": true或false, "line": "你要说的一句话，30字以内，像人说话，不要引号"}`,
            onYes: async r => {
                const k = String(charId);
                const ms = grantMsFor(charId, (r && r.line) || '');
                S.grant[k] = { at: Date.now(), until: ms ? Date.now() + ms : 0, line: (r && r.line) || '' };
                await save();
                toast(c.name + ' 把手机给你了');
                paint();
            },
            onNo: async r => {
                delete S.grant[String(charId)];
                await save();
                toast(c.name + ' 没给看');
                paint();
            }
        });
    };
    // 我主动把自己的手机给 TA 看：TA 决定要不要看，看完说一句
    window.gyPhoneOffer = async function (charId) {
        const c = charOf(charId); if (!c) return;
        if (typeof window.gyInviteSend !== 'function') return toast('邀请卡模块没加载');
        const uname = (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
        await window.gyInviteSend({
            char: c, kind: 'phone', title: '手机',
            say: `${meName()}把手机递给了${c.name}`,
            sub: '“你自己看吧”',
            ask: `${uname}把手机递给你："你自己看吧。"
按你的性格决定接不接：好奇、想知道点什么、或者觉得这样不太好、不想窥探别人的隐私，
都是合理的反应。接了的话说一句你看到之后的感受；不接就说为什么。
只输出 JSON：{"ok": true或false, "line": "一句话，30字以内，不要引号"}`,
            onYes: async r => {
                const k = String(charId);
                S.mine[k] = { at: Date.now(), line: (r && r.line) || '' };
                if (!Array.isArray(S.seenMe[k])) S.seenMe[k] = [];
                S.seenMe[k].unshift({ at: Date.now(), gist: '你主动把手机给 TA 看了' + ((r && r.line) ? '，TA 说「' + r.line + '」' : '') });
                if (S.seenMe[k].length > 10) S.seenMe[k].length = 10;
                await save(); paint();
            },
            onNo: async () => { paint(); }
        });
    };
    // TA 反过来问你（自主模式里那一步会调这个）
    window.gyPhoneCharAsk = function (charId, line) {
        const c = charOf(charId); if (!c) return null;
        if (typeof window.gyInviteFromChar !== 'function') return null;
        return window.gyInviteFromChar({
            char: c, kind: 'phone', title: '手机',
            say: `${c.name}想看看${meName()}的手机`,
            sub: '你可以给，也可以不给',
            line: line || '',
            onYes: async () => {
                S.mine[String(charId)] = { at: Date.now(), line: '' };
                const k = String(charId);
                if (!Array.isArray(S.seenMe[k])) S.seenMe[k] = [];
                S.seenMe[k].unshift({ at: Date.now(), gist: '你把手机给 TA 看了，TA 翻了几下' });
                if (S.seenMe[k].length > 10) S.seenMe[k].length = 10;
                await save();
                // 看完说一句（这一步用的是自主模式本来就要花的那次预算之外的一次，所以做成可选）
                try { await charLookLine(c); } catch (e) {}
                paint();
            },
            onNo: async () => {
                try { await charRefusedLine(c); } catch (e) {}
                paint();
            }
        });
    };
        // 报一下场景：这段生成属于「phoneAct」那一场，好让「注入内容管理」能单独设它读什么（soft＝外层已经有场景就不抢）
    async function charLookLine() {
        const a = arguments;
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('phoneAct', () => charLookLineInner.apply(null, a));
        return charLookLineInner.apply(null, a);
    }
    async function charLookLineInner(c) {
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) return;
        const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name);
        const ask = `${(typeof userDisplayName === 'function') ? userDisplayName(c) : '对方'}把手机给你看了。
你翻了几下就还回去了。按你的性格说一句——可以是打趣、可以是看到什么愣了一下、
也可以只是"没什么好看的嘛"。30 字以内，不要引号。`;
        const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
        const d = await callChatCompletionAPI(api, msgs);
        const t = (d?.choices?.[0]?.message?.content || '').trim().replace(/^["「]|["」]$/g, '').slice(0, 60);
        if (t && typeof deliverCharMoveToChatMessage === 'function') deliverCharMoveToChatMessage(c, t, null);
    }
        // 报一下场景：这段生成属于「phoneAct」那一场，好让「注入内容管理」能单独设它读什么（soft＝外层已经有场景就不抢）
    async function charRefusedLine() {
        const a = arguments;
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('phoneAct', () => charRefusedLineInner.apply(null, a));
        return charRefusedLineInner.apply(null, a);
    }
    async function charRefusedLineInner(c) {
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) return;
        const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name);
        const ask = `你刚才想看看${(typeof userDisplayName === 'function') ? userDisplayName(c) : '对方'}的手机，被拒绝了。
按你的性格说一句——可以是识趣地岔开、可以是有点在意、也可以嘴上不饶人。30 字以内，不要引号。`;
        const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
        const d = await callChatCompletionAPI(api, msgs);
        const t = (d?.choices?.[0]?.message?.content || '').trim().replace(/^["「]|["」]$/g, '').slice(0, 60);
        if (t && typeof deliverCharMoveToChatMessage === 'function') deliverCharMoveToChatMessage(c, t, null);
    }
    window.gyPhoneGrantMin = async function (v) { S.grantMin = parseInt(v); await save(); paint(); };
    // 「让 TA 自己定」这一档会折出多少分钟（0 = 不限时）。
    // 暴露出来是为了能直接量它——这段判断藏在借手机流程里，
    // 从外面走一遍要过冷却、过邀请卡，量不到。
    window.gyPhoneGrantGuess = (charId, line) => Math.round(grantMsFor(charId, line) / 60000);
    // 现在这个人给了你多久（mins：0 = 不限时，null = 没给）
    window.gyPhoneGrantState = function (charId) {
        const g = S.grant[String(charId)];
        if (!g) return null;
        return { at: g.at, line: g.line || '',
                 mins: g.until ? Math.max(0, Math.round((g.until - g.at) / 60000)) : 0 };
    };
    /* 给 js/35 换装用：把某个角色的手机壁纸换成一张图。
       传色号（w1~w5）就是纯色渐变，传图片地址就铺成照片壁纸。 */
    window.gyPhoneSetWall = function (charId, src) {
        if (!charId || !src) return false;
        S.wall[String(charId)] = /^(w[1-5])$/.test(src) ? src : ('img:' + src);
        S.manual[String(charId)] = true;      // 手动挑过就不再自动推
        save();
        if (String(charId) === String(curId)) paint();
        return true;
    };
    window.gyPhoneSetTint = async function (charId, v) { S.iconTint[String(charId)] = v; await save(); paint(); };
    // 把手动挑的全清掉，回到"按人设推"
    window.gyPhoneAutoStyle = async function (charId) {
        const k = String(charId);
        delete S.wall[k]; delete S.iconSkin[k]; delete S.iconTint[k]; delete S.manual[k];
        await save(); paint();
        toast('回到按人设推出来的样子');
    };
    window.gyPhoneSetSkin = async function (charId, skin) {
        // 'auto' ＝ 撤掉手动选择，回到按人设推（跟图标配色那一档对齐）
        if (!skin || skin === 'auto') delete S.iconSkin[String(charId)];
        else S.iconSkin[String(charId)] = skin;
        await save(); paint();
    };
    window.gyPhoneRepaint = () => { try { paint(); } catch (e) {} };
    window.gyPhoneWallOf = charId => wallOf(charId);

    /* ---------- 自主模式里的一步：TA 自己开口问 ---------- */
    function addAutonomy() {
        try {
            if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || !Array.isArray(GY_AUTONOMY_ACTIONS)) return;
            if (GY_AUTONOMY_ACTIONS.some(a => a.key === 'phone_peek')) return;
            GY_AUTONOMY_ACTIONS.push({
                key: 'phone_peek', label: '想看看你的手机',
                hint: '开口问你能不能看看你的手机——你可以给也可以不给，两种反应不一样',
                need: () => on('phoneOn') && typeof window.gyInviteFromChar === 'function',
                async run(char) {
                    const line = rnd(['诶，你手机给我看看呗。', '你手机借我瞅一眼？', '我能看看你手机吗。',
                                      '你刚才在看什么？给我看看。']);
                    window.gyPhoneCharAsk(char.id, line);
                    return '问' + ((typeof userDisplayName === 'function') ? userDisplayName(char) : '对方') + '能不能看手机';
                }
            });
        } catch (e) { console.warn('[手机] 注册自主动作失败：', e); }
    }
    // 邀请卡上"答应之后那颗按钮"点了去哪儿
    function addInviteKind() {
        try {
            if (typeof window.GY_INVITE_KINDS !== 'object' || !window.GY_INVITE_KINDS) return;
            if (window.GY_INVITE_KINDS.phone) return;
            window.GY_INVITE_KINDS.phone = {
                ico: '📱', name: '看手机', verb: '看看', go: '去看看',
                accept(inv) { try { gyPhoneOpen(inv.charId); } catch (e) {} }
            };
        } catch (e) {}
    }

    /* ================= 悬浮窗 =================
       整页看着占地方，而且一翻页就没了。悬浮窗把这台手机**挂在页面上**：
       按住顶栏可以拖到任何位置，翻到别的页面它还在，收起来是右下角一个小圆。
       内容跟整页里那台是同一份（同一个 paint()），不会出现两台不同步的手机。 */
    function floatEl() { return document.getElementById('gyphFloat'); }
    window.gyPhonePop = async function (charId) {
        const id = String(charId || curId || (chars()[0] || {}).id || '');
        if (!id) return;
        curId = id; curApp = null; shade = false;
        S.float.open = true; S.float.mini = false; S.float.charId = id;

        const c = charOf(id);
        if (c && (!S.notif[id] || !S.notif[id].length)) { S.notif[id] = localNotif(c); S.lastGen[id] = Date.now(); }
        await save();
        buildFloat();
        paint();
    };
    window.gyPhoneUnpop = async function () { S.float.open = false; await save(); const f = floatEl(); if (f) f.remove(); };
    window.gyPhoneMini = async function () { S.float.mini = !S.float.mini; await save(); buildFloat(); paint(); };
    window.gyPhoneFull = function () { const id = curId; gyPhoneUnpop(); gyPhoneOpen(id); };

    function buildFloat() {
        let f = floatEl();
        if (!S.float.open) { if (f) f.remove(); return; }
        if (!f) {
            f = document.createElement('div');
            f.id = 'gyphFloat';
            document.body.appendChild(f);
        }
        const c = charOf(curId) || {};
        f.className = 'gyph-float' + (S.float.mini ? ' mini' : '');
        f.style.right = (Number(S.float.x) || 24) + 'px';
        f.style.bottom = (Number(S.float.y) || 24) + 'px';
        if (S.float.mini) {
            const un = (S.notif[curId] || []).filter(x => x.unread).length;
            f.innerHTML = `<div class="gyph-ball" onclick="gyPhoneMini()" title="${esc(c.name || '')}的手机">
                📱${un ? `<i>${un}</i>` : ''}</div>`;
        } else {
            f.innerHTML = `
              <div class="gyph-fbar" id="gyphDrag">
                <span class="gyph-fname">📱 ${esc(c.name || '')}</span>
                <span class="gyph-fbtns">
                  <b onclick="gyPhoneFull()" title="整页打开">⤢</b>
                  <b onclick="gyPhoneMini()" title="收起">－</b>
                  <b onclick="gyPhoneUnpop()" title="关掉">×</b>
                </span>
              </div>
              <div id="gyphFloatBody"></div>`;
            bindDrag(f);
        }
    }
    // 按住顶栏拖。用右下角偏移记位置，窗口缩放时不会跑到屏幕外面去。
    function bindDrag(f) {
        const bar = f.querySelector('#gyphDrag');
        if (!bar || bar.__bound) return;
        bar.__bound = true;
        let sx = 0, sy = 0, bx = 0, by = 0, on_ = false;
        const px = e => (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        const py = e => (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
        const down = e => {
            if (e.target.closest('.gyph-fbtns')) return;
            on_ = true; sx = px(e); sy = py(e);
            bx = Number(S.float.x) || 24; by = Number(S.float.y) || 24;
            document.body.classList.add('gyph-dragging'); e.preventDefault();
        };
        const move = e => {
            if (!on_) return;
            const w = f.getBoundingClientRect();
            S.float.x = Math.max(4, Math.min(window.innerWidth - 60, bx - (px(e) - sx)));
            S.float.y = Math.max(4, Math.min(window.innerHeight - 60, by - (py(e) - sy)));
            f.style.right = S.float.x + 'px'; f.style.bottom = S.float.y + 'px';
            e.preventDefault();
        };
        const up = () => { if (!on_) return; on_ = false; document.body.classList.remove('gyph-dragging'); save(); };
        bar.addEventListener('mousedown', down);
        bar.addEventListener('touchstart', down, { passive: false });
        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('mouseup', up);
        window.addEventListener('touchend', up);
    }

    /* ---------- 入口：角色资料页 ⋮ 里的「TA 的手机」 ----------
       原来是关注键旁边一颗单独的 📱，现在跟钱包、纪念日一起收进那个三竖点。 */
    function addProfileBtn() {
        try {
            const old = document.getElementById('profPhoneBtn');
            if (old) old.remove();
            if (typeof window.gyProfMenuAdd !== 'function') return;
            window.gyProfMenuAdd({
                id: 'phone', icon: '📱', label: 'TA 的手机', sub: '桌面、通知栏、TA 的一天',
                show: id => on('phoneOn') && id && String(id) !== 'me' && !!charOf(id),
                run: id => gyPhoneOpen(id)
            });
        } catch (e) {}
    }
    const curProfile = () => (typeof currentProfileId !== 'undefined') ? currentProfileId : null;
    function hookProfile() {
        try {
            const f = window.renderProfilePage;
            if (typeof f !== 'function' || f.__gyphPatched) return;
            window.renderProfilePage = function () {
                const r = f.apply(this, arguments);
                try { setTimeout(addProfileBtn, 0); } catch (e) {}
                return r;
            };
            window.renderProfilePage.__gyphPatched = true;
        } catch (e) {}
    }

    /* ---------- 记忆总览里的那一块 ---------- */
    function memHubHtml(charId) {
        const seen = S.seen[String(charId)] || [];
        const mine = S.seenMe[String(charId)] || [];
        const c = charOf(charId) || {};
        return `
          <label style="font-size:15px;">📱 手机</label>
          <div style="font-size:12px; color:#536471; margin-bottom:8px;">
            你翻过 ${esc(c.name || '')} 手机上的哪些东西、看到了什么。这些会进 TA 的 prompt——
            TA 知道你看过，也知道你看见了哪些。
          </div>
          <div style="display:flex;align-items:center;gap:10px;background:white;padding:10px 12px;border-radius:8px;border:1px solid #eff3f4;margin-bottom:8px;">
            <b style="font-size:18px;color:var(--gy-accent);">${seen.length}</b><span style="font-size:13px;">条查看记录${mine.length ? '　·　TA 看过你 ' + mine.length + ' 次' : ''}</span>
            <button type="button" class="btn-edit-small" style="margin-left:auto;" onclick="gyPhoneOpen('${charId}')">打开 TA 的手机</button>
            ${seen.length || mine.length ? `<button type="button" class="btn-edit-small" onclick="gyPhoneClearSeen('${charId}')">清空</button>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;">
          ${seen.length ? seen.map((x, i) => `
            <div style="background:white;padding:8px 10px;border-radius:6px;border:1px solid #eff3f4;">
              <div style="font-size:13px;"><b>${esc(x.name)}</b>
                <span style="font-size:11px;color:#8b98a5;">　${esc(ago(x.at))}</span>
                <span style="color:#f91880;cursor:pointer;float:right;font-size:12px;" onclick="gyPhoneDelSeen('${charId}','seen',${i})">删除</span></div>
              <div style="font-size:13px;color:#536471;line-height:1.7;margin-top:2px;">${esc(x.gist || '')}</div>
            </div>`).join('') : '<div style="color:#8b98a5;font-size:13px;">还没翻过 TA 的手机</div>'}
          ${mine.map((x, i) => `<div style="background:rgba(128,128,128,.06);padding:8px 10px;border-radius:6px;border:1px dashed #cfd9de;">
              <div style="font-size:13px;color:#536471;">${esc(x.gist)}<span style="font-size:11px;color:#8b98a5;">　${esc(ago(x.at))}</span>
                <span style="color:#f91880;cursor:pointer;float:right;font-size:12px;" onclick="gyPhoneDelSeen('${charId}','seenMe',${i})">删除</span></div>
            </div>`).join('')}
          </div>`;
    }
    function renderMemHub() {
        const host = document.getElementById('memoryHubContent');
        if (!host) return;
        const id = (typeof currentMemoryHubTargetId !== 'undefined') ? currentMemoryHubTargetId : null;
        let box = document.getElementById('gyphMemHubBox');
        if (String(id || '').startsWith('g_') || !id || !on('phoneOn')) { if (box) box.remove(); return; }
        if (!box) {
            box = document.createElement('div');
            box.id = 'gyphMemHubBox'; box.className = 'input-group';
            box.style.cssText = 'margin-top:20px; border-top:1px dashed var(--gy-accent); padding-top:15px;';
            host.appendChild(box);
        }
        box.innerHTML = memHubHtml(id);
    }
    function hookMemHub() {
        try {
            ['selectMemoryHubTarget', 'renderMemoryHubContent'].forEach(fn => {
                const orig = window[fn];
                if (typeof orig !== 'function' || orig.__gyphPatched2) return;
                window[fn] = function () { const r = orig.apply(this, arguments); try { setTimeout(renderMemHub, 0); } catch (e) {} return r; };
                window[fn].__gyphPatched2 = true;
            });
        } catch (e) {}
    }

    /* ---------- 开关 ---------- */
    function addSwitches() {
        try {
            if (typeof AUTO_FEATURE_DEFS === 'undefined' || !Array.isArray(AUTO_FEATURE_DEFS)) return;
            if (typeof AUTO_FEATURE_GROUPS !== 'undefined' && Array.isArray(AUTO_FEATURE_GROUPS)
                && !AUTO_FEATURE_GROUPS.some(g => g.key === '手机')) {
                AUTO_FEATURE_GROUPS.push({ key: '手机', icon: '📱', title: 'TA 的手机',
                    note: '一个视角，不是新功能：看 TA 那台设备现在的样子——桌面、电量、步数、还有下拉通知栏里那些你不认识的人和事。**只能看，不能动**。' });
            }
            const defs = [
                { key: 'phoneOn', label: 'TA 的手机（总开关）',
                  desc: '角色资料页上多一颗 📱。点开是 TA 的手机：壁纸、电量、今天走了多少步、屏幕用了几小时、一排带红点的图标，下拉是通知栏。里面的每一条都来自已经存在的数据（日程/钱包/随身物/包裹/浏览记录/日子），**只能看，不能替 TA 做任何事**。',
                  cost: '不调 API', defaultOff: true, group: '手机', where: '角色资料页 → 📱' },
                { key: 'phoneRemember', label: '记住"你看过 TA 的手机"以及看到了什么',
                  desc: '每翻开一个 app 就记一条——不只是"你翻过我手机"，而是**具体看到了什么**（"余额 ￥1733，最近一笔是一碗面"、"搜过：临安天气"）。这些会进 TA 的 prompt：TA 知道你看过，也知道你看见了哪些，之后聊天时可能提起来（坦然、别扭、开玩笑都有可能）。TA 看过你的手机同样会记。',
                  cost: '不调 API（只是记账，注进本来就要发的 prompt 里）', group: '手机', where: '记忆总览 → 📱 手机' },
                { key: 'phoneAiPeople', label: '通讯录照人设开，不用那十二个通用联系人',
                  desc: '默认每个角色手机里都是妈妈、爸、房东、同事·小吴、组长……对谁都一样。可人设里写着父母双亡、独居、没工作、或者压根不是现代人的角色，手机里不该有这些人。打开之后，可以在手机侧栏点「照人设开一份通讯录」——读人设和世界书，让模型替 TA 开一份真正属于这个人的联系人（师父、掌柜、押镖的、驿站都可能），连带每个人会发来什么消息。**开好就存着**，不重开不再花钱；不打开就还是那十二个，跟以前一模一样。',
                  cost: '一个角色一次调用（手动点才生成，之后一直用那一份）', defaultOff: true, group: '手机', where: '手机侧栏 → 📇 通讯录' },
                { key: 'phoneNotifAi', label: '让模型写通知（更像那个人）',
                  desc: '不用本地模板，而是按人设和最近发生的事写一批通知——会出现只属于这个角色的人和事（"排练室老周：周三还来吗"）。手机页上多一颗「✨ 让 TA 的手机活过来」，**只在你点它的时候才调**。',
                  cost: '点一次一次调用', defaultOff: true, group: '手机', where: '角色资料页 → 📱 → 右边那颗 ✨' }
            ];
            defs.push(
                { key: 'phoneCardIntake', label: '卡片里的"手机里的事"收进 TA 的手机',
                  desc: '角色卡教模型写的 <msg>发送|接收|内容|时间</msg>、小红书、朋友圈、[消息-谁] 这些格式：发给你的变成 TA 真发给你的消息（转账走钱包），跟别人的收进 TA 手机对应的 app，聊天里只留一张「📱 TA 刚在手机上…」小卡。',
                  cost: '不调 API', group: '手机', where: '聊天 → 📱 小卡；TA 的手机 → 消息/小红书/朋友圈' },
                { key: 'phoneCardGen', label: '按卡片格式让手机动起来',
                  desc: '手机侧栏多一颗「✨ 按卡片格式让手机动起来」：照这张卡自己写的手机格式（没有就用通用格式），让模型写一批 TA 最近跟别人的聊天、小红书、朋友圈，收进手机里。只在你点的时候调。',
                  cost: '点一次一次调用', defaultOff: true, group: '手机', where: 'TA 的手机 → 侧栏' }
            );
            defs.forEach(d => { if (!AUTO_FEATURE_DEFS.some(x => x.key === d.key)) AUTO_FEATURE_DEFS.push(d); });
        } catch (e) { console.warn('[手机] 注册开关失败：', e); }
    }

    /* ================= 🃏 角色卡里的手机 =================
       很多卡在世界书里教模型写"手机里发生的事"：
         <msg>发送人|接收人|内容|时间</msg>、<rednote>…</rednote>（小红书）、
         [消息-谁]: …、[语音-谁|时长]: …、[转账-谁]: …、<朋友圈>…</朋友圈>
       以前这些要么是一坨方括号、要么靠同类软件插件才画得出来。现在：
         · 发给你的 → 变成白露里 TA 真发给你的消息（转账走钱包，语音/表情/图片照样是一条消息）
         · 跟别人的 → 收进 TA 手机对应的 app（消息 / 小红书 / 朋友圈）
         · 聊天里只留一张小卡「📱 TA 刚在手机上…」，点开直接跳到那一页
       另外：手机配色可以跟卡片走（从卡自带的状态栏/小组件样式里取色），图标可以照人设重画一套。 */
    // 以前这里有 CARD_CAP（消息 300 / 小红书 60 / 朋友圈 80 条），超了就删最早的——不设上限了，全留着
    const cardOf = id => {
        const k = String(id);
        if (!S.card[k]) S.card[k] = { msgs: [], notes: [], moments: [] };
        ['msgs', 'notes', 'moments'].forEach(x => { if (!Array.isArray(S.card[k][x])) S.card[k][x] = []; });
        return S.card[k];
    };
    const userNames = () => {
        const n = [meName(), '{{user}}', 'user', '你', '我方', 'User'];
        try { if (typeof userDisplayName === 'function') n.push(userDisplayName()); } catch (e) {}
        try { if (currentUser && currentUser.handle) n.push(String(currentUser.handle).replace('@', '')); } catch (e) {}
        return n.filter(Boolean).map(x => String(x).trim().toLowerCase());
    };
    const isUser = s => { const t = String(s || '').trim().toLowerCase(); return !!t && userNames().some(u => u && (t === u || t.indexOf(u) !== -1 && u.length >= 2)); };
    // 名字对不对得上：卡里常写简称（季清衍 → 清衍）
    const isChar = (c, s) => {
        const t = String(s || '').trim(); if (!t) return false;
        const n = String(c.name || '');
        if (t === n || n.indexOf(t) !== -1 || t.indexOf(n) !== -1) return t.length >= 1;
        if (t === '{{char}}' || t === 'char') return true;
        const bits = n.split(/[_&＆\s·・]+/).filter(x => x.length >= 2);
        return bits.some(b => t.indexOf(b) !== -1 || b.indexOf(t) !== -1 && t.length >= 2);
    };
    // 一条"消息内容"里的特殊格式：转账/语音/表情/图片
    function specialOf(t) {
        const s = String(t || '').trim();
        let m;
        if ((m = s.match(/^\[?\s*zz\s*[-：:]\s*([\d.]+)\s*元?\s*\]?$/i))) return { kind: 'money', amt: parseFloat(m[1]) };
        if ((m = s.match(/^\[?\s*yy\s*[-：:]\s*([\s\S]+?)\]?$/i))) return { kind: 'voice', text: m[1] };
        if ((m = s.match(/^\[?\s*bqb\s*[-：:]\s*([\s\S]+?)\]?$/i))) return { kind: 'sticker', text: m[1] };
        if ((m = s.match(/^\[?\s*img\s*[-：:]\s*([\s\S]+?)\]?$/i))) return { kind: 'img', text: m[1] };
        if ((m = s.match(/^\[?\s*music\s*[-：:]\s*([\s\S]+?)\]?$/i))) return { kind: 'music', text: m[1].replace('$', ' - ') };
        return { kind: 'text', text: s };
    }
    const showOf = sp => sp.kind === 'money' ? `［转账］￥${sp.amt}` : sp.kind === 'voice' ? `🎤 ${sp.text}` : sp.kind === 'sticker' ? `［表情］${sp.text}`
        : sp.kind === 'img' ? `［图片］${sp.text}` : sp.kind === 'music' ? `🎵 ${sp.text}` : sp.text;

    // 从一段回复里把手机格式都拿出来。opts.phoneOnly：只收进手机（按卡生成手机内容时用）
    window.gyPhoneIntake = function (c, text, opts) {
        const res = { text: String(text || ''), toMe: [], logged: { msg: 0, note: 0, moment: 0 }, apps: [] };
        try {
            if (!c || !text || !on('phoneCardIntake')) return res;
            const o = opts || {};
            const box = cardOf(c.id);
            const now = Date.now();
            let t = res.text;
            const toMeOk = !o.phoneOnly;
            const log = (a, b, raw, time) => {
                const sp = specialOf(raw);
                box.msgs.push({ at: now + box.msgs.length % 1000, a: String(a).trim(), b: String(b).trim(), t: showOf(sp), time: String(time || '').trim() });
                res.logged.msg++;
            };
            // ① <msg>发送|接收|内容|时间</msg>
            t = t.replace(/<msg>([\s\S]*?)<\/msg>/gi, (m0, inner) => {
                const p = inner.split('|');
                if (p.length < 3) return m0;
                const [a, b, body, time] = [p[0], p[1], p.slice(2, p.length >= 4 ? p.length - 1 : p.length).join('|'), p.length >= 4 ? p[p.length - 1] : ''];
                if (isUser(a)) return '';                                   // 你那边说的话，模型复述的，不收
                if (toMeOk && isChar(c, a) && isUser(b)) { res.toMe.push(specialOf(body)); return ''; }
                log(a, b, body, time); return '';
            });
            // ② [消息-谁]: … / [语音-谁|时长]: … / [转账-谁]: …（小爪机那一套）
            t = t.replace(/\[(消息|语音|转账)[-|]([^\]|]+)(?:\|([^\]]*))?\]\s*[:：]\s*([^\n]+)/g, (m0, kind, who, extra, body) => {
                if (isUser(who)) return '';
                const sp = kind === '转账' ? { kind: 'money', amt: parseFloat(String(body).replace(/[^\d.]/g, '')) || 0 }
                    : kind === '语音' ? { kind: 'voice', text: body.trim() } : specialOf(body);
                if (toMeOk && isChar(c, who)) { res.toMe.push(sp); return ''; }
                box.msgs.push({ at: now + box.msgs.length % 1000, a: who.trim(), b: c.name, t: showOf(sp), time: '' });
                res.logged.msg++; return '';
            });
            // ③ 小红书：帖子 9 段 / 评论 5 段
            t = t.replace(/<rednote>([\s\S]*?)<\/rednote>/gi, (m0, inner) => {
                const p = inner.split('|').map(x => x.trim());
                if (p.length >= 8) {
                    const [id, by, title, sub, body, time, likes, favs, cmts] = p;
                    let n = box.notes.find(x => x.id === id);
                    if (!n) { n = { id, at: now, comments: [] }; box.notes.push(n); }
                    Object.assign(n, { by, title, sub, body, time, likes, favs, cmts });
                    res.logged.note++; return '';
                }
                if (p.length >= 3) {
                    const [id, by, body, time, likes] = p;
                    let n = box.notes.find(x => x.id === id);
                    if (!n) { n = { id, at: now, by: '', title: '（没看到原帖）', comments: [] }; box.notes.push(n); }
                    n.comments.push({ by, t: body, time: time || '', likes: likes || '' });
                    res.logged.note++; return '';
                }
                return m0;
            });
            // ④ 朋友圈
            t = t.replace(/[<＜]朋友圈[>＞]([\s\S]*?)[<＜]\/朋友圈[>＞]/g, (m0, inner) => {
                const body = String(inner).trim(); if (!body) return '';
                box.moments.push({ at: now, by: c.name, t: body.replace(/<[^>]+>/g, ' ').slice(0, 800) });
                res.logged.moment++; return '';
            });
            // 去掉卡片为了"画手机"塞的代码块壳子
            t = t.replace(/```\s*```/g, '').replace(/\n{3,}/g, '\n\n').trim();
            res.text = t;
            if (res.logged.msg) res.apps.push('msg');
            if (res.logged.note) res.apps.push('rednote');
            if (res.logged.moment) res.apps.push('moment');
            if (res.logged.msg + res.logged.note + res.logged.moment) {
                save();
            }
        } catch (e) { console.warn('[卡片手机] 跳过：', e); }
        return res;
    };
    // 聊天里那张"TA 刚在手机上…"小卡
    window.gyPhonePeekHtml = function (msg) {
        const p = msg.phone || {};
        const bits = [];
        if (p.msg) bits.push(`跟别人聊了 ${p.msg} 条`);
        if (p.note) bits.push(`小红书动了 ${p.note} 下`);
        if (p.moment) bits.push(`发了 ${p.moment} 条朋友圈`);
        const app = (p.apps && p.apps[0]) || 'msg';
        return `<div class="gyph-peekcard" onclick="event.stopPropagation(); gyPhoneOpenApp('${esc(msg.sender)}','${esc(app)}')">
            <span class="gyph-pk-i">📱</span><span class="gyph-pk-t"><b>TA 刚在手机上</b>${esc(bits.join('，') || '有点动静')}</span><span class="gyph-pk-go">看看 ›</span></div>`;
    };
    window.gyPhoneOpenApp = async function (charId, app) {
        if (!on('phoneOn')) return toast('先去 🎛️ 全部开关 → 📱 手机 打开「TA 的手机」');
        await window.gyPhoneOpen(charId);
        const a = appOf(app);
        if (a && canSee(curId, a)) { curApp = app; msgWho = null; paint(); }
        else if (a) toast('这个还点不开——' + lockHint(a));
    };
    // 卡里跟别人的对话：按"对方是谁"分组
    function cardPeers(c) {
        const box = S.card[String(c.id)]; if (!box) return [];
        const map = new Map();
        box.msgs.forEach(m => {
            const other = isChar(c, m.a) ? m.b : m.a;
            if (!other || isUser(other)) return;
            const k = String(other).replace(/^群[:：]/, '群 ');
            if (!map.has(k)) map.set(k, []);
            map.get(k).push(m);
        });
        return Array.from(map.entries()).map(([n, list]) => ({ n, list, last: list[list.length - 1].at }))
            .sort((a, b) => b.last - a.last);
    }
    function cardThread(c, who) {
        const p = cardPeers(c).find(x => x.n === who);
        if (!p) return null;
        return p.list.slice(-40).map(m => [isChar(c, m.a) ? '我' : m.a, m.t + (m.time ? `  · ${m.time}` : '')]);
    }
    function appRednote(c) {
        const box = S.card[String(c.id)];
        const notes = box ? box.notes.slice().reverse() : [];
        if (!notes.length) return empty('还没刷到什么。');
        return notes.map(n => `<div class="gyph-rn">
            <div class="gyph-rn-h"><b>${esc(n.title || '')}</b>${n.sub ? `<span>${esc(n.sub)}</span>` : ''}</div>
            <div class="gyph-rn-by">${esc(n.by || '')}${n.time ? ' · ' + esc(n.time) : ''}</div>
            ${n.body ? `<div class="gyph-rn-b">${esc(n.body).replace(/\[img-([^\]]+)\]/gi, '<span class="gyph-rn-img">🖼️ $1</span>')}</div>` : ''}
            ${(n.likes || n.favs || n.cmts) ? `<div class="gyph-rn-st">♡ ${esc(n.likes || 0)}　☆ ${esc(n.favs || 0)}　💬 ${esc(n.cmts || n.comments.length)}</div>` : ''}
            ${n.comments.length ? `<div class="gyph-rn-cm">${n.comments.slice(-6).map(x => `<div><b>${esc(x.by)}</b>${esc(x.t)}</div>`).join('')}</div>` : ''}
        </div>`).join('');
    }
    function appMoment(c) {
        const box = S.card[String(c.id)];
        const ms = (box ? box.moments.slice() : []).concat(peerMoments(c)).sort((a, b) => (b.at || 0) - (a.at || 0));
        if (!ms.length) return empty('朋友圈还是空的。');
        return ms.map(m => `<div class="gyph-mo"><div class="gyph-av">${esc(String(m.by || c.name).slice(0, 1))}</div>
            <div><b>${esc(m.by || c.name)}</b><div class="gyph-mo-t">${esc(m.t)}</div><em>${esc(ago(m.at))}</em>
            ${(m.cm && m.cm.length) ? `<div class="gyph-mo-cm">${m.cm.map(x => `<div><b>${esc(x.by)}</b>：${esc(x.t)}</div>`).join('')}</div>` : ''}</div></div>`).join('');
    }
    // ✉️ 跟别的角色之间的信（js/56）
    function appMail(c) {
        const ls = peerMails(c).slice().reverse();
        if (!ls.length) return empty('信箱是空的。');
        return ls.map(m => `<details class="gyph-mail"><summary><span class="gyph-mail-d">${m.out ? '寄给' : '来自'}</span><b>${esc(m.who)}</b>
            <span class="gyph-mail-t">《${esc(m.title || '无题')}》</span><em>${esc(ago(m.at))}</em></summary>
            <div class="gyph-mail-b">${esc(m.body || '')}</div></details>`).join('');
    }
    // 📞 通话记录（js/56）
    function appCalls(c) {
        const ls = peerCalls(c).slice().reverse();
        if (!ls.length) return empty('没有通话记录。');
        return ls.map(m => `<details class="gyph-call"><summary><span class="gyph-call-d ${m.out ? 'out' : 'in'}">${m.out ? '↗' : '↙'}</span><b>${esc(m.who)}</b>
            <span class="gyph-call-t">${esc(m.minutes)} 分钟 · ${esc(m.summary || '')}</span><em>${esc(ago(m.at))}</em></summary>
            ${(m.lines || []).map(([w, t]) => `<div class="gyph-bub ${w === '我' ? 'self' : 'them'}">${esc(t)}</div>`).join('')}</details>`).join('');
    }

    /* ---------- 按卡片格式让手机动起来（一次调用，手动点）---------- */
    function cardFormatSpec(c) {
        let spec = '';
        try {
            const wbs = (typeof worldbooks !== 'undefined' && Array.isArray(worldbooks)) ? worldbooks : [];
            (c.worldbooks || []).forEach(id => {
                const w = wbs.find(x => x.id === id);
                if (w && /<msg>|<rednote>|\[消息[-|]|朋友圈[>＞]|\[语音[-|]/.test(w.content || '') && spec.length < 3000) spec += '\n' + String(w.content).slice(0, 2400);
            });
        } catch (e) {}
        return spec.trim();
    }
    window.gyPhoneCardGen = async function (charId) {
        const c = charOf(charId); if (!c) return;
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) return toast('还没配 API');
        const spec = cardFormatSpec(c);
        const fmt = spec || `<msg>发送人|接收人|消息内容|MM月DD日 HH:MM</msg>
<rednote>帖子ID|发布者|一级标题|二级标题|帖子内容|MM-DD HH:MM|点赞数|收藏数|评论数</rednote>
<rednote>帖子ID|评论人|评论内容|MM-DD HH:MM|点赞数</rednote>
<朋友圈>一条朋友圈的正文</朋友圈>`;
        toast(`正在翻 ${c.name} 的手机…`);
        try {
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name);
            const now = new Date().toLocaleString('zh-CN', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const ask = `现在是${now}。这一次**不是**在跟对方聊天——写出你手机里最近半天自然发生的事：你跟别人（朋友、家人、同事、群里）的聊天，你刷到或发的小红书，你发的朋友圈。
要求：像真实的手机，零碎、有来有回；按你的人设、处境和世界观来，人物用世界书里真实存在的，没有就合理编；不要写你跟对方（{{user}}）的聊天。
一共 8~16 条，**严格按下面的格式**，一条一行，不要别的文字、不要解释：
${fmt}`;
            const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
            const data = await callChatCompletionAPI(api, msgs);
            const raw = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
            const r = window.gyPhoneIntake(c, raw, { phoneOnly: true });
            const n = r.logged.msg + r.logged.note + r.logged.moment;
            toast(n ? `${c.name} 的手机里多了 ${n} 条` : '这次没写出能认的格式，再点一次试试');
            paint();
        } catch (e) { toast('没翻成：' + (e.message || e)); }
    };

    /* ---------- 手机配色跟卡片走 ---------- */
    const palCache = {};
    function hexOf(s) {
        s = String(s).trim();
        let m = s.match(/^#([0-9a-f]{3})$/i); if (m) return '#' + m[1].split('').map(x => x + x).join('');
        m = s.match(/^#([0-9a-f]{6})$/i); if (m) return '#' + m[1].toLowerCase();
        m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (m) return '#' + [m[1], m[2], m[3]].map(x => Math.min(255, +x).toString(16).padStart(2, '0')).join('');
        return null;
    }
    function hsl(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
        let h = 0, s = 0;
        if (mx !== mn) {
            const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
            h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
        }
        return { h, s, l };
    }
    function cardPalette(charId) {
        const k = String(charId);
        if (palCache[k] && Date.now() - palCache[k].at < 60000) return palCache[k].p;
        let p = null;
        try {
            const list = (typeof regexScripts !== 'undefined' ? regexScripts : []).filter(rs => rs && Array.isArray(rs.charScope)
                && rs.charScope.map(String).includes(k) && typeof rs.replace === 'string' && rs.replace.length > 200);
            const cnt = {};
            list.forEach(rs => {
                (rs.replace.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]+\)/g) || []).forEach(x => {
                    const h = hexOf(x); if (!h) return;
                    const q = hsl(h);
                    if (q.s < 0.25 || q.l < 0.12 || q.l > 0.88) return;       // 黑白灰不算"卡片的颜色"
                    cnt[h] = (cnt[h] || 0) + 1;
                });
            });
            const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
            if (top.length) {
                const a = top[0];
                const hA = hsl(a).h;
                const b = top.find(x => Math.abs(hsl(x).h - hA) > 25) || top[1] || a;
                p = { a, b, hue: Math.round(hA), hue2: Math.round(hsl(b).h) };
            }
        } catch (e) {}
        palCache[k] = { at: Date.now(), p };
        return p;
    }
    const skinSrcOf = id => S.skinSrc[String(id)] || (cardPalette(id) ? 'card' : 'persona');
    window.gyPhoneSkinSrc = async function (charId, v) { S.skinSrc[String(charId)] = v; await save(); paint(); };

    /* ---------- 图标照人设重画 ---------- */
    window.gyPhoneIconAi = async function (charId) {
        const c = charOf(charId); if (!c) return;
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) return toast('还没配 API');
        toast(`在照 ${c.name} 的人设设计图标…`);
        try {
            const keys = APPS.map(a => `${a.key}（${a.name}）`).join('、');
            const persona = String((c.persona || '') + '\n' + (c.bio || '')).slice(0, 2500);
            const prompt = `下面是一个角色的人设。请为 TA 的手机设计一套图标主题：从人设里挑出最能代表 TA 的一个元素（喜欢的东西、职业、性格、审美都行，要具体，不要泛泛的"可爱"），整套图标围绕它。
每个 app 用**一个 emoji** 做图标主体，尽量既像这个 app 的用途、又带着主题元素；再给一个贯穿整套的小装饰 emoji，和两种主题色。
app 列表：${keys}
【人设】
${persona}
只输出 JSON：{"motif":"主题元素，10字以内","why":"为什么，20字以内","deco":"一个装饰emoji","c1":"#十六进制颜色","c2":"#十六进制颜色","apps":{"msg":"emoji", ...每个 app 一个}}`;
            const data = await callChatCompletionAPI(api, [{ role: 'user', content: prompt }]);
            let r = (typeof parseModelJson === 'function') ? parseModelJson(data.choices?.[0]?.message?.content || '') : null;
            if (Array.isArray(r)) r = r[0];
            if (!r || !r.apps) return toast('这次没设计出来，再点一次试试');
            const apps = {};
            Object.keys(r.apps).forEach(k => { const v = String(r.apps[k] || '').trim(); if (appOf(k) && v && v.length <= 8) apps[k] = v; });
            S.icons[String(charId)] = { at: Date.now(), motif: String(r.motif || '').slice(0, 16), why: String(r.why || '').slice(0, 30),
                deco: String(r.deco || '').slice(0, 4), c1: hexOf(r.c1) || null, c2: hexOf(r.c2) || null, apps };
            await save(); paint();
            toast(`换好了：${S.icons[String(charId)].motif || '新图标'}`);
        } catch (e) { toast('没设计成：' + (e.message || e)); }
    };
    window.gyPhoneIconReset = async function (charId) { delete S.icons[String(charId)]; await save(); paint(); };

    /* ---------- 样式 ---------- */
    const CSS = `
    #view-phone{padding:0;}
    .gyph-wrap{display:flex;gap:26px;padding:22px;align-items:flex-start;flex-wrap:wrap;}

    /* ===== 机身 ===== */
    .gyph-dev{width:296px;height:614px;border-radius:44px;flex-shrink:0;position:relative;overflow:hidden;
        display:flex;flex-direction:column;color:#fff;
        box-shadow:0 18px 44px rgba(0,0,0,.28), 0 0 0 10px #16181c, 0 0 0 11.5px #3a3f47,
                   inset 0 0 0 1px rgba(255,255,255,.10);
        font-family:var(--gy-font);}
    /* 壁纸：底色 + 两团柔光，比纯渐变有层次 */
    .gyph-dev:before{content:'';position:absolute;inset:0;pointer-events:none;
        background:radial-gradient(120% 65% at 18% 6%, rgba(255,255,255,.30), transparent 60%),
                   radial-gradient(90% 55% at 88% 96%, rgba(255,255,255,.16), transparent 62%);}
    .gyph-dev.w1{background:linear-gradient(168deg,#5878b8 0%,#2b3f6b 52%,#141d33 100%);}
    .gyph-dev.w2{background:linear-gradient(168deg,#8e6aa6 0%,#4d3164 52%,#241634 100%);}
    .gyph-dev.w3{background:linear-gradient(168deg,#3f8f7c 0%,#1f5b50 52%,#0f2b26 100%);}
    .gyph-dev.w4{background:linear-gradient(168deg,#c2854c 0%,#7a4a25 52%,#331d10 100%);}
    .gyph-dev.w5{background:linear-gradient(168deg,#6c7686 0%,#39414c 52%,#1a1e24 100%);}
    /* 照片壁纸：铺满 + 压一层暗，不然图上的字看不清 */
    .gyph-dev.photo{background-size:cover;background-position:center;background-color:#20242b;}
    .gyph-dev.photo:before{background:linear-gradient(180deg,rgba(0,0,0,.34),rgba(0,0,0,.12) 34%,rgba(0,0,0,.42));}
    /* 图标风格 */
    .gyph-dev.skin-circle .gyph-icon{border-radius:50%;}
    .gyph-dev.skin-glass .gyph-icon{background:rgba(255,255,255,.2) !important;backdrop-filter:blur(10px);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.4);}
    .gyph-dev.skin-flat .gyph-icon{background:var(--c1,#8a94a6) !important;box-shadow:none;}

    /* 状态栏：信号格和电池是画出来的，不是 emoji */
    .gyph-status{display:flex;align-items:center;justify-content:space-between;
        padding:13px 22px 2px;font-size:12px;font-weight:600;flex-shrink:0;position:relative;z-index:3;}
    .gyph-t{letter-spacing:.2px;}
    .gyph-notch{position:absolute;left:50%;transform:translateX(-50%);top:0;
        width:86px;height:23px;border-radius:0 0 14px 14px;background:#0c0e11;}
    .gyph-right{display:flex;align-items:center;gap:5px;}
    .gyph-sdot{width:6px;height:6px;border-radius:50%;background:#ff5a4e;margin-right:1px;}
    .gyph-sig{display:inline-flex;align-items:flex-end;gap:1.5px;height:10px;}
    .gyph-sig b{width:2.5px;background:#fff;border-radius:1px;}
    .gyph-sig b:nth-child(1){height:4px;} .gyph-sig b:nth-child(2){height:6px;}
    .gyph-sig b:nth-child(3){height:8px;} .gyph-sig b:nth-child(4){height:10px;opacity:.45;}
    .gyph-wifi{width:12px;height:9px;position:relative;}
    .gyph-wifi:before{content:'';position:absolute;left:0;bottom:0;width:12px;height:12px;
        border:2px solid #fff;border-radius:50%;clip-path:polygon(0 0,100% 0,50% 50%);}
    .gyph-batt{width:20px;height:10px;border:1.3px solid rgba(255,255,255,.75);border-radius:3px;
        padding:1.2px;position:relative;}
    .gyph-batt:after{content:'';position:absolute;right:-3px;top:3px;width:1.6px;height:4px;
        background:rgba(255,255,255,.75);border-radius:0 1px 1px 0;}
    .gyph-batt b{display:block;height:100%;background:#fff;border-radius:1.5px;}
    .gyph-batt.low b{background:#ff8b7a;}
    .gyph-right em{font-style:normal;font-size:10.5px;opacity:.85;margin-left:1px;}

    .gyph-screen{flex:1;overflow-y:auto;padding:0 16px;position:relative;z-index:2;}
    .gyph-screen::-webkit-scrollbar{width:0;}
    .gyph-home{height:5px;width:112px;border-radius:3px;background:rgba(255,255,255,.55);
        margin:6px auto 9px;flex-shrink:0;position:relative;z-index:3;}

    /* ===== 桌面 ===== */
    .gyph-clock{text-align:center;margin:20px 0 14px;text-shadow:0 2px 10px rgba(0,0,0,.25);}
    .gyph-clock b{display:block;font-size:52px;font-weight:250;line-height:1;letter-spacing:-1px;}
    .gyph-clock b i{font-style:normal;opacity:.55;margin:0 1px;}
    .gyph-clock span{font-size:12.5px;opacity:.9;letter-spacing:.5px;}
    .gyph-peek{display:flex;align-items:center;gap:10px;cursor:pointer;
        background:rgba(255,255,255,.18);backdrop-filter:blur(14px);border-radius:16px;
        padding:10px 12px;margin-bottom:16px;border:1px solid rgba(255,255,255,.16);
        box-shadow:0 4px 14px rgba(0,0,0,.14);transition:.15s;}
    .gyph-peek:hover{background:rgba(255,255,255,.26);}
    .gyph-peek-i{font-size:19px;}
    .gyph-peek>div:nth-child(2){flex:1;min-width:0;}
    .gyph-peek b{display:block;font-size:12px;}
    .gyph-peek span{font-size:11.5px;opacity:.86;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;}
    .gyph-peek em{font-style:normal;background:#ff3b30;color:#fff;font-size:10.5px;font-weight:700;
        min-width:19px;height:19px;border-radius:10px;display:flex;align-items:center;justify-content:center;}

    .gyph-apps{display:grid;grid-template-columns:repeat(4,1fr);gap:17px 6px;padding:2px 0 10px;}
    .gyph-app{text-align:center;cursor:pointer;}
    .gyph-icon{width:52px;height:52px;margin:0 auto 5px;border-radius:14px;position:relative;
        background:linear-gradient(160deg,var(--c1,#8a94a6),var(--c2,#4a525f));
        display:flex;align-items:center;justify-content:center;font-size:25px;
        box-shadow:0 4px 10px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.35);
        transition:transform .16s, box-shadow .16s;}
    .gyph-icon span{filter:drop-shadow(0 1px 1px rgba(0,0,0,.25));}
    .gyph-app:hover .gyph-icon{transform:translateY(-3px) scale(1.04);box-shadow:0 8px 18px rgba(0,0,0,.3);}
    .gyph-app:active .gyph-icon{transform:scale(.94);}
    .gyph-an{font-size:10.5px;opacity:.94;text-shadow:0 1px 3px rgba(0,0,0,.35);}
    .gyph-app.locked .gyph-icon{filter:grayscale(1) brightness(.72);}
    .gyph-app.locked .gyph-an{opacity:.55;}
    .gyph-lk{position:absolute;right:-2px;bottom:-2px;font-size:11px;font-style:normal;
        background:rgba(0,0,0,.55);border-radius:50%;width:17px;height:17px;
        display:flex;align-items:center;justify-content:center;}
    .gyph-bd{position:absolute;right:-5px;top:-5px;background:#ff3b30;color:#fff;font-style:normal;
        font-size:10.5px;font-weight:700;min-width:19px;height:19px;border-radius:10px;
        display:flex;align-items:center;justify-content:center;padding:0 5px;
        border:2px solid rgba(0,0,0,.16);}
    /* 底部 dock */
    .gyph-dock{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px -4px 10px;
        padding:11px 6px 7px;border-radius:24px;
        background:rgba(255,255,255,.16);backdrop-filter:blur(16px);
        border:1px solid rgba(255,255,255,.14);}
    .gyph-dock .gyph-an{display:none;}
    .gyph-dock .gyph-icon{margin-bottom:0;}

    /* ===== app 内页 / 通知栏 ===== */
    .gyph-screen.app,.gyph-screen.shade{background:rgba(10,12,16,.5);backdrop-filter:blur(20px);padding:0;}
    .gyph-appbar{display:flex;align-items:center;gap:6px;padding:12px 16px;font-size:14px;font-weight:600;
        position:sticky;top:0;z-index:2;background:rgba(10,12,16,.55);backdrop-filter:blur(16px);
        border-bottom:1px solid rgba(255,255,255,.08);}
    .gyph-appbar span{cursor:pointer;font-size:23px;line-height:1;opacity:.9;margin-top:-2px;}
    .gyph-appbody{padding:12px 16px 18px;}
    .gyph-empty{opacity:.6;font-size:12.5px;text-align:center;padding:34px 8px;}
    .gyph-card{background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.09);
        border-radius:14px;padding:11px 13px;margin-bottom:9px;}
    .gyph-ct{font-size:10.5px;opacity:.62;margin-bottom:4px;letter-spacing:.6px;}
    .gyph-cb{font-size:12.5px;line-height:1.8;white-space:pre-wrap;}
    .gyph-li{display:flex;align-items:center;gap:8px;padding:10px 2px;font-size:12.5px;
        border-bottom:1px solid rgba(255,255,255,.09);}
    .gyph-li.col{flex-direction:column;align-items:flex-start;gap:2px;}
    .gyph-li span{flex:1;min-width:0;}
    .gyph-li em{font-style:normal;font-size:11px;opacity:.62;}
    .gyph-li b{font-variant-numeric:tabular-nums;}
    .gyph-li b.in{color:#7ee0a5;}
    .gyph-bal{text-align:center;padding:18px 0 14px;font-size:31px;font-weight:700;letter-spacing:-.5px;}
    .gyph-bal span{display:block;font-size:11px;font-weight:400;opacity:.62;margin-top:3px;letter-spacing:.4px;}
    .gyph-bar{display:flex;align-items:center;gap:9px;font-size:11.5px;padding:6px 0;}
    .gyph-bar span{width:62px;flex-shrink:0;}
    .gyph-bar i{flex:1;height:7px;border-radius:4px;background:rgba(255,255,255,.16);overflow:hidden;}
    .gyph-bar i b{display:block;height:100%;background:linear-gradient(90deg,#fff,rgba(255,255,255,.7));border-radius:4px;}
    .gyph-bar em{font-style:normal;width:52px;text-align:right;opacity:.72;}
    .gyph-note{font-size:11px;opacity:.58;line-height:1.8;margin-top:14px;}
    .gyph-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
    .gyph-ph{background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.08);
        border-radius:12px;padding:12px 8px;text-align:center;}
    .gyph-ph-i{font-size:28px;opacity:.9;}
    .gyph-ph b{display:block;font-size:11.5px;margin-top:5px;}
    .gyph-ph span{font-size:10px;opacity:.6;}
    .gyph-map{text-align:center;padding:34px 0;}
    .gyph-pin{font-size:38px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.3));}
    .gyph-map b{display:block;font-size:15.5px;margin-top:8px;}
    .gyph-map span{font-size:11px;opacity:.6;}
    .gyph-icon.themed{position:relative;}
    .gyph-deco{position:absolute;right:-4px;bottom:-4px;font-size:12px;font-style:normal;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35));}
    .gyph-rn{background:rgba(255,255,255,.1);border-radius:12px;padding:10px 11px;margin-bottom:9px;}
    .gyph-rn-h b{display:block;font-size:13px;line-height:1.4;}
    .gyph-rn-h span{display:block;font-size:11px;opacity:.75;margin-top:2px;}
    .gyph-rn-by{font-size:10.5px;opacity:.6;margin:4px 0;}
    .gyph-rn-b{font-size:11.5px;line-height:1.6;opacity:.92;}
    .gyph-rn-img{display:inline-block;margin:4px 0;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,.14);font-size:11px;}
    .gyph-rn-st{font-size:10.5px;opacity:.65;margin-top:6px;}
    .gyph-rn-cm{margin-top:7px;border-top:1px solid rgba(255,255,255,.12);padding-top:6px;display:flex;flex-direction:column;gap:4px;}
    .gyph-rn-cm div{font-size:11px;line-height:1.5;opacity:.88;}
    .gyph-rn-cm b{margin-right:5px;}
    .gyph-mo{display:flex;gap:10px;padding:10px 2px;border-bottom:1px solid rgba(255,255,255,.09);}
    .gyph-mo-cm{margin-top:6px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.07);font-size:11.5px;line-height:1.6;}
    .gyph-mail,.gyph-call{padding:9px 2px;border-bottom:1px solid rgba(255,255,255,.09);font-size:12.5px;}
    .gyph-mail summary,.gyph-call summary{display:flex;align-items:baseline;gap:6px;cursor:pointer;list-style:none;flex-wrap:wrap;}
    .gyph-mail summary::-webkit-details-marker,.gyph-call summary::-webkit-details-marker{display:none;}
    .gyph-mail-d{font-size:11px;opacity:.6;}
    .gyph-mail-t,.gyph-call-t{flex:1;min-width:0;opacity:.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .gyph-mail em,.gyph-call em{font-style:normal;font-size:10.5px;opacity:.5;}
    .gyph-mail-b{margin-top:8px;padding:10px 12px;border-radius:10px;background:rgba(255,248,230,.93);color:#4a3b22;line-height:1.8;white-space:pre-wrap;font-family:serif;}
    .gyph-call-d{font-weight:700;}
    .gyph-call-d.out{color:#5ad06a;}
    .gyph-call-d.in{color:#63b3ff;}
    .gyph-call .gyph-bub{margin-top:6px;}
    .gyph-mo>div:nth-child(2){flex:1;min-width:0;}
    .gyph-mo b{font-size:12px;}
    .gyph-mo-t{font-size:11.5px;line-height:1.6;margin-top:3px;white-space:pre-wrap;}
    .gyph-mo em{font-size:10px;opacity:.55;font-style:normal;}
    .gyph-peekcard{display:inline-flex;align-items:center;gap:10px;margin-top:4px;padding:9px 12px;border-radius:14px;cursor:pointer;
        background:linear-gradient(135deg,#1f2733,#2d3a4d);color:#fff;max-width:300px;box-shadow:0 4px 12px rgba(0,0,0,.12);}
    .gyph-peekcard:hover{filter:brightness(1.1);}
    .gyph-pk-i{font-size:20px;}
    .gyph-pk-t{display:flex;flex-direction:column;font-size:12px;line-height:1.45;opacity:.92;}
    .gyph-pk-t b{font-size:12.5px;}
    .gyph-pk-go{font-size:11.5px;opacity:.75;white-space:nowrap;}
    .gyph-msg{display:flex;align-items:center;gap:11px;padding:10px 2px;
        border-bottom:1px solid rgba(255,255,255,.09);}
    .gyph-av{width:36px;height:36px;border-radius:50%;flex-shrink:0;
        background:linear-gradient(150deg,rgba(255,255,255,.34),rgba(255,255,255,.14));
        display:flex;align-items:center;justify-content:center;font-size:15px;}
    .gyph-msg>div:nth-child(2){flex:1;min-width:0;}
    .gyph-msg b{display:block;font-size:12.5px;}
    .gyph-msg span{font-size:11.5px;opacity:.7;}
    .gyph-msg span.blur{filter:blur(3.5px);user-select:none;}
    .gyph-msg.you b:after{content:'你';font-size:9px;background:rgba(255,255,255,.26);
        border-radius:4px;padding:1px 5px;margin-left:6px;vertical-align:middle;}
    .gyph-go{font-style:normal;opacity:.45;font-size:17px;}
    .gyph-thd-hd{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;
        padding:2px 0 10px;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,.1);}
    .gyph-thd-hd span{cursor:pointer;font-size:22px;line-height:1;opacity:.85;margin-top:-2px;}
    .gyph-bub{max-width:78%;padding:8px 11px;border-radius:14px;font-size:12.5px;line-height:1.65;
        margin-bottom:7px;word-break:break-word;}
    .gyph-bub.them{background:rgba(255,255,255,.16);border-bottom-left-radius:5px;}
    .gyph-bub.self{background:#3ba55c;margin-left:auto;border-bottom-right-radius:5px;}
    .gyph-dot{font-style:normal;background:#ff3b30;color:#fff;font-size:10px;font-weight:700;
        min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;}

    .gyph-shade-hd{display:flex;justify-content:space-between;align-items:center;
        padding:14px 16px 10px;font-size:13.5px;font-weight:600;}
    .gyph-shade-hd span{font-size:11px;opacity:.72;cursor:pointer;font-weight:400;}
    .gyph-nt{display:flex;gap:11px;align-items:flex-start;margin:0 13px 9px;padding:11px 13px;
        border-radius:17px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.08);}
    .gyph-nt.new{background:rgba(255,255,255,.21);box-shadow:0 3px 12px rgba(0,0,0,.14);}
    .gyph-nt-i{font-size:18px;flex-shrink:0;margin-top:1px;}
    .gyph-nt>div:nth-child(2){flex:1;min-width:0;}
    .gyph-nt b{display:block;font-size:12px;margin-bottom:1px;}
    .gyph-nt span{font-size:11.5px;opacity:.86;line-height:1.65;}
    .gyph-nt em{font-style:normal;font-size:10px;opacity:.55;flex-shrink:0;}
    .gyph-shade .gyph-note{padding:0 16px;}
    .gyph-pull{text-align:center;font-size:11px;opacity:.66;padding:12px 0 16px;cursor:pointer;}

    /* ===== 右边那一栏 ===== */
    .gyph-side{flex:1;min-width:240px;max-width:430px;}
    .gyph-side-hd{font-size:14px;font-weight:700;margin-bottom:6px;}
    .gyph-side-p{font-size:12.5px;color:#8b98a5;line-height:1.8;margin-bottom:10px;}
    .gyph-btn{border:1px solid var(--gy-accent,#1d9bf0);color:var(--gy-accent,#1d9bf0);background:transparent;
        border-radius:999px;padding:6px 13px;font-size:12.5px;cursor:pointer;font-family:inherit;margin:0 6px 6px 0;}
    .gyph-btn.ghost{border-color:rgba(128,128,128,.4);color:#8b98a5;}
    .gyph-acts{display:flex;gap:6px;flex-wrap:wrap;}
    .gyph-in{width:100%;padding:9px;border-radius:9px;background:transparent;color:inherit;
        border:1px solid var(--gy-accent-line);margin-bottom:8px;font-family:inherit;}
    .gyph-need{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:6px 0;}
    .gyph-need span{flex:1;min-width:0;color:#8b98a5;}
    .gyph-need input{width:66px;padding:5px 7px;border-radius:7px;background:transparent;color:inherit;
        border:1px solid var(--gy-accent-line);}
    .gyph-grant{font-size:12.5px;background:var(--gy-accent-soft);border-radius:10px;
        padding:10px 12px;margin-bottom:8px;line-height:1.7;}
    .gyph-grant.mine{background:rgba(128,128,128,.1);}
    .gyph-grant em{display:block;font-style:normal;color:#8b98a5;font-size:11.5px;margin-top:2px;}
    .gyph-seen{display:flex;flex-direction:column;gap:5px;max-height:210px;overflow-y:auto;}
    .gyph-seen>div{background:rgba(128,128,128,.07);border-radius:8px;padding:7px 10px;font-size:12px;line-height:1.65;}
    .gyph-seen b{margin-right:6px;}
    .gyph-seen span{color:#8b98a5;}
    .gyph-seen em{font-style:normal;color:#8b98a5;font-size:10.5px;margin-left:6px;}
    .gyph-walls{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px;}
    .gyph-w{width:34px;height:34px;border-radius:9px;cursor:pointer;border:2px solid transparent;
        display:flex;align-items:center;justify-content:center;font-size:15px;transition:.15s;}
    .gyph-w:hover{transform:translateY(-2px);}
    .gyph-w.on{border-color:var(--gy-accent);}
    .gyph-w.w1{background:linear-gradient(160deg,#5878b8,#141d33);}
    .gyph-w.w2{background:linear-gradient(160deg,#8e6aa6,#241634);}
    .gyph-w.w3{background:linear-gradient(160deg,#3f8f7c,#0f2b26);}
    .gyph-w.w4{background:linear-gradient(160deg,#c2854c,#331d10);}
    .gyph-w.w5{background:linear-gradient(160deg,#6c7686,#1a1e24);}
    .gyph-w.pick{background:rgba(128,128,128,.14);}
    .gyph-checks{display:flex;flex-direction:column;gap:5px;font-size:12.5px;}
    .gyph-checks label{display:flex;align-items:center;gap:7px;cursor:pointer;}

    /* ===== 悬浮窗 ===== */
    .gyph-float{position:fixed;z-index:9000;}
    .gyph-float .gyph-dev{width:250px;height:520px;border-radius:38px;
        box-shadow:0 20px 48px rgba(0,0,0,.34), 0 0 0 8px #16181c, 0 0 0 9.5px #3a3f47;}
    .gyph-float .gyph-clock b{font-size:44px;}
    .gyph-float .gyph-icon{width:46px;height:46px;font-size:22px;border-radius:13px;}
    .gyph-float .gyph-apps{gap:14px 4px;}
    .gyph-fbar{display:flex;align-items:center;gap:8px;margin-bottom:7px;padding:6px 12px;
        border-radius:999px;cursor:grab;user-select:none;font-size:12px;
        background:var(--gy-accent);color:var(--gy-accent-fg);
        box-shadow:0 6px 16px rgba(0,0,0,.2);}
    body.gyph-dragging .gyph-fbar{cursor:grabbing;}
    body.gyph-dragging{user-select:none;}
    .gyph-fname{flex:1;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .gyph-fbtns{display:flex;gap:2px;}
    .gyph-fbtns b{width:22px;height:22px;border-radius:50%;cursor:pointer;font-weight:400;
        display:flex;align-items:center;justify-content:center;font-size:14px;transition:.15s;}
    .gyph-fbtns b:hover{background:rgba(255,255,255,.28);}
    .gyph-ball{width:54px;height:54px;border-radius:50%;cursor:pointer;position:relative;
        display:flex;align-items:center;justify-content:center;font-size:25px;
        background:var(--gy-accent);color:var(--gy-accent-fg);
        box-shadow:0 8px 22px rgba(0,0,0,.26);transition:transform .16s;}
    .gyph-ball:hover{transform:scale(1.07);}
    .gyph-ball i{position:absolute;right:-2px;top:-2px;background:#ff3b30;color:#fff;font-style:normal;
        font-size:10.5px;font-weight:700;min-width:19px;height:19px;border-radius:10px;
        display:flex;align-items:center;justify-content:center;padding:0 5px;}

    @media (max-width:900px){
        .gyph-wrap{flex-direction:column;align-items:center;padding:14px;}
        .gyph-dev{width:min(300px,92vw);height:min(620px,72vh);}
        .gyph-side{max-width:none;width:100%;}
        .gyph-float .gyph-dev{width:min(230px,72vw);height:min(470px,58vh);}
    }
    `;
    function mount() {
        if (document.getElementById('gyphCss')) return;
        const st = document.createElement('style'); st.id = 'gyphCss'; st.textContent = CSS;
        document.head.appendChild(st);
    }

    (async function init() {
        mount();
        addSwitches();
        await load();
        hookProfile();
        hookMemHub();
        // ⚠️ 这几件事都要等 loadAllData() 跑完（角色还没读出来的时候 charOf 找不到人），
        //    而本模块的 init 在脚本加载时就跑了，所以统一延后一拍。
        setTimeout(() => {
            addInviteKind(); addAutonomy(); addProfileBtn(); regSrc(); regChatActs();
            if (S.float && S.float.open) {
                curId = S.float.charId || '';
                if (charOf(curId)) { buildFloat(); paint(); } else { S.float.open = false; save(); }
            }
        }, 1500);
    })();
})();
