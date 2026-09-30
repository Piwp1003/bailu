/* ===========================================================================
   js/29 —— 🌐 角色联网探索
   ---------------------------------------------------------------------------
   角色能聊的东西，全都来自你给的人设和你们说过的话。世界在外面变，TA 不知道；
   TA "喜欢"的东西也只是人设里的一个词，不会自己往深里走。

   这里让 TA 真的去外面看一眼：
     ① TA 按自己的人设想一个**现在想了解的东西**（不是你给关键词，是 TA 自己挑）
     ② 拿这个关键词去搜；**两段式**：先看搜索结果页，从里面挑最相关的几条
        点进去读正文——搜索结果页剥完标签是一坨导航和广告，正文才有东西
     ③ 读不明白可以**换个词再搜一轮**（轮数你定，默认 1 轮）
     ④ 用自己的口吻写一段"我看到了什么、我怎么想"——不是摘要，是感想
     ⑤ 存进探索记录，**进 prompt**，以后聊天时是真的知道这件事
     ⑥ 可以选择让 TA 主动私聊发给你

   v106 起下面这些全部可调，而且**自主模式跑的是同一份配置**
   （不会出现"设置改了、自主模式还按老参数跑"）：
     · 喂给模型的网页字数上限（默认 1500，以前写死 4000——最贵的就是这一段）
     · 一次探索最多搜几轮
     · 两段式点进去读几条正文
     · 感想写多少字
     · 写感想那次走主 API 还是副 API

   ⚠️ 关于"联网"这件事的实话：
      纯前端 fetch 别人家网站基本都会被 CORS 拦。所以给四种来源：
        · DuckDuckGo lite（默认，免 key，自己带 CORS 头）
        · Jina 读取代理（质量最好，但**匿名访问会 401**，要去 jina.ai 免费注册拿 key）
        · 自定义接口（你自己的 SearXNG / Tavily / 反代）
        · 不联网（一个请求都不发）
      抓不到就自动退回"只用模型知道的"继续写，不卡住也不弹错。
      APK 版走原生网络通道，不受 CORS 限制。
   =========================================================================== */
(function () {
    if (window.__gyWebLoaded) return;
    window.__gyWebLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyWebBox', 'explore')          // 带兜底的存档口：localforage 用不了就退 localStorage，两条都断才报错
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyWebBox', storeName: 'explore' })
            : null);
    const KEY = 'gyWeb_state';

    const PRESETS = [
        { k: 'ddg', name: 'DuckDuckGo（默认 · 免 key）',
          url: 'https://lite.duckduckgo.com/lite/?q={q}',
          note: '直连 DDG 的精简结果页，自己带 CORS 头，不用注册。' },
        { k: 'jina', name: 'Jina 读取代理（质量最好 · 要 key）',
          url: 'https://r.jina.ai/{u}', search: 'https://r.jina.ai/https://duckduckgo.com/html/?q={q}',
          needKey: true,
          note: '把网页转成干净的纯文本。⚠️ 现在匿名访问会返回 401（你日志里那条就是），去 jina.ai 免费注册拿个 key 填在下面。' },
        { k: 'custom', name: '自定义接口', url: '', search: '',
          note: '你自己的 SearXNG / Tavily / 反代。搜索地址里用 {q} 占位关键词；正文地址（选填）里用 {u} 占位网址。' },
        { k: 'none', name: '不联网（只用模型知道的）', url: '', search: '',
          note: '一个网络请求都不发。TA 还是会挑题目、写感想，只是内容来自模型自己的知识。' }
    ];
    const presetOf = k => PRESETS.find(p => p.k === k) || PRESETS[0];

    // 「读正文」这一步走哪条路。搜索结果页只给外链，正文要再抓一次；
    // 浏览器里直连别人家网页会被对方 CORS 拦掉，所以这里给几条常见的代理。
    // {u} = 原样拼上去；{U} = URL 编码后拼上去。
    const READ_PROXIES = [
        { v: '',                                        name: '直连（APK / exe 用这个）' },
        { v: 'https://api.allorigins.win/raw?url={U}',  name: 'AllOrigins（免 key）' },
        { v: 'https://api.codetabs.com/v1/proxy?quest={U}', name: 'CodeTabs（免 key）' },
        { v: 'https://corsproxy.io/?{U}',               name: 'corsproxy.io（免 key）' },
        { v: 'https://api.cors.lol/?url={U}',           name: 'cors.lol（免 key）' },
        { v: 'https://r.jina.ai/{u}',                   name: 'Jina（干净，但要 key）' }
    ];

    let S = {
        src: 'ddg',
        url: '',            // 自定义：搜索地址（含 {q}）
        readUrl: '',        // 自定义：读正文地址（含 {u}），留空就直接 fetch 原网址
        key: '',            // Jina 那档的 key
        maxChars: 1500,     // 喂给模型的网页文字上限
        rounds: 1,          // 一次探索最多搜几轮
        deep: 2,            // 两段式：点进去读几条正文（0 = 只读搜索结果页）
        sayChars: 80,       // 感想字数
        sayApi: 'auto',     // 写感想那次走哪个：auto=跟全 app 一样（副API优先）/ main=强制主API / sub=强制副API
        max: 30,            // 每个角色最多留几条
        inject: 3,          // 注进 prompt 的最多几条
        lastRunAt: 0,
        gapMin: 180,        // 自动跑的最小间隔（分钟）
        lastGoodRead: '',   // 上次真的读到正文的那条路（下次先试它）
        lastLink: '',       // 上次搜到的第一条外链（体检拿它当靶子，比 example.com 真实）
        log: {}             // { 角色id: [{id, at, topic, why, text, src, rounds, sources}] }
    };
    // 自主模式（js/14 的 GY_AUTONOMY_ACTIONS）跑的就是这一份 S，不另起一套参数。
    window.gyWebConfig = () => JSON.parse(JSON.stringify(S));

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const uid = () => 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const on = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : false;
    // 不设上下限：用户填多少就是多少（只挡不是数字的情况）。lo/hi 两个参数留着是为了不改调用处。
    const num = (v, lo, hi, dft) => { const n = parseFloat(v); return isFinite(n) ? n : dft; };
    // 记录里"看的是哪几个站"——URL 太长，只留域名+一小截
    const shortUrl = u => String(u || '').replace(/^https?:\/\//i, '').slice(0, 40);
    const ago = t => { const d = Math.floor((Date.now() - t) / 86400000);
        return d <= 0 ? '今天' : d === 1 ? '昨天' : d < 30 ? d + ' 天前' : Math.round(d / 30) + ' 个月前'; };

    async function save() { try { if (LF) await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) { console.warn('[联网探索] 存档失败', e); } }
    async function load() {
        try { if (LF) { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } } catch (e) {}
        if (!S.log || typeof S.log !== 'object') S.log = {};
        if (!PRESETS.some(p => p.k === S.src)) S.src = 'ddg';
    }
    const listOf = id => { const k = String(id); if (!Array.isArray(S.log[k])) S.log[k] = []; return S.log[k]; };

    /* ===================== 抓取 ===================== */
    let lastErr = '';      // 上一次没成的原因（抓网页失败 / 接口报错 / 模型没按格式回），显示在功能页上

    function headers() {
        const p = presetOf(S.src);
        return (p.needKey && S.key) ? { Authorization: 'Bearer ' + S.key } : {};
    }
    async function grab(url, ms) {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), ms || 20000);
        try {
            const res = await fetch(url, { signal: ctl.signal, headers: headers() });
            if (!res.ok) throw new Error('HTTP ' + res.status + (res.status === 401 ? '（这个来源需要 key，去功能页里填）' : ''));
            return await res.text();
        } finally { clearTimeout(timer); }
    }
    // HTML → 能读的文字
    function toText(raw) {
        return String(raw || '')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
            .replace(/\s+/g, ' ').trim();
    }
    // 顺手把页面里的图片地址抠出来——角色上网看到喜欢的图会存进自己的图库（js/34）
    function pickImgs(raw, base) {
        const out = [];
        const re = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi;
        let m;
        while ((m = re.exec(String(raw))) && out.length < 8) {
            let u = m[1];
            if (u.indexOf('//') === 0) u = 'https:' + u;
            if (!/^https?:\/\//i.test(u)) continue;
            if (/\.svg(\?|$)|sprite|logo|icon|avatar|1x1|pixel|blank/i.test(u)) continue;   // 图标和埋点像素不要
            out.push(u);
        }
        return out;
    }
    /* 从搜索结果页里把外链抠出来（DDG lite 会把真实网址包在 uddg= 参数里）。
       ⚠️ 以前这里**只认 href="..."**，也就是只认网页 HTML。
       可 Jina 那一档（app 自己写着"质量最好 · 最稳"的那个）回的是 **markdown 纯文本**：
           1. [漕运 - 维基百科](https://zh.wikipedia.org/wiki/漕运)
       一个 href 都没有 → 抠出 0 条外链 → 读正文那个循环**一次都没进去** →
       记录里永远是「正文没读到，只用了搜索结果页」。
       而体检查的是"这条路能不能读网页"，跟抠不抠得出链接是两回事，所以体检全绿也没用。
       现在：先按 HTML 抠，一条都没抠到就按 markdown / 裸网址再抠一遍。 */
    function pickLinks(raw, n) {
        const out = [], seen = new Set();
        const add = (u) => {
            try {
                const dd = String(u).match(/[?&]uddg=([^&]+)/);
                if (dd) u = decodeURIComponent(dd[1]);
            } catch (e) {}
            u = String(u).replace(/[)\]，。、,.;；]+$/, '');        // markdown 里常把标点粘在网址屁股上
            if (!/^https?:\/\//i.test(u)) return false;
            if (/duckduckgo\.com|jina\.ai|w3\.org|\.(css|js|png|jpg|jpeg|gif|svg|ico)(\?|$)/i.test(u)) return false;
            const host = u.split('/')[2] || u;
            if (seen.has(host)) return false;   // 一个站只取一条，免得三条都来自同一个页面
            seen.add(host);
            out.push(u);
            return out.length >= n;
        };
        const s = String(raw || '');
        let m;
        // ① 网页 HTML
        const re = /href\s*=\s*["']([^"']+)["']/gi;
        while ((m = re.exec(s)) && out.length < n * 4) { if (add(m[1])) break; }
        if (out.length) return out;
        // ② markdown：[标题](网址)
        const re2 = /\]\(\s*(https?:\/\/[^\s)]+)\s*\)/g;
        while ((m = re2.exec(s)) && out.length < n * 4) { if (add(m[1])) break; }
        if (out.length) return out;
        // ③ 实在没有就抠裸网址（纯文本反代、SearXNG 的 json 之类）
        const re3 = /https?:\/\/[^\s"'<>)\]\\]+/g;
        while ((m = re3.exec(s)) && out.length < n * 4) { if (add(m[0])) break; }
        return out;
    }

    /* 读正文用哪个地址。
       · 自己填了「读正文地址」就用自己的（必须带 {u} 或 {U}）
       · 否则 jina 那档走 r.jina.ai/{u}
       · 其余情况直连原网址 {u}
       {u} = 原样拼上去（jina、大多数反代都要这个）
       {U} = URL 编码后拼上去（allorigins、corsproxy 这类 ?url= 参数式的要这个） */
    /* 读正文要试几条路。
       以前只试一条：默认是"直连"，而浏览器（还有 exe 里那个 webview）直连别人家网页
       基本都会被对方的 CORS 拦掉——于是每一条都失败，退回搜索结果页，
       记录里永远写着"正文没读到"。参数没错、代码没错，就是那一条路走不通。
       现在按顺序试：你自己填的 → 这个来源自带的 → 几个免 key 的公共代理。
       哪条成了就把它记下来（S.lastGoodRead），下次第一个试它，不用每次从头撞一遍。 */
    function readChain() {
        const out = [];
        const push = v => { if (v && out.indexOf(v) < 0) out.push(v); };
        const mine = String(S.readUrl || '').trim();
        push(S.lastGoodRead);                       // 上次成功的那条排最前
        if (mine && /\{u\}/i.test(mine)) push(mine);
        if (S.src === 'jina') push('https://r.jina.ai/{u}');
        push('{u}');                                 // 直连（APK / exe 里可能行）
        READ_PROXIES.forEach(p => { if (p.v) push(p.v); });
        // jina 那条没 key 会 401，没填 key 就别浪费一次请求。
        // ⚠️ 但**你自己填的那条、和上次真成过的那条，不能替你删掉**——
        //    以前在「读正文地址」里填 r.jina.ai 又没填 key 的话，这一条会被悄悄滤掉，
        //    于是"我明明填了地址"却连一个请求都没发出去，页面上还什么都不说。
        //    现在照发，401 了会明明白白告诉你"这条路要 key"。
        return out.filter(v => v === mine || v === S.lastGoodRead
            || !(v.indexOf('r.jina.ai') >= 0 && !S.key && S.src !== 'jina'));
    }
    const routeName = v => !v ? '直连'
        : v === '{u}' ? '直连'
        : (READ_PROXIES.find(p => p.v === v) || {}).name || v.replace(/^https?:\/\//, '').slice(0, 24);
    function fillRead(tpl, u) {
        return String(tpl).replace(/\{u\}/g, u).replace(/\{U\}/g, encodeURIComponent(u));
    }
    /* ===================== 🩺 体检：到底哪条路能用 =====================
       "读正文条数填了 3，记录里还是写着正文没读到"——这件事光看代码是查不出来的，
       因为参数和逻辑都没错，错的是**那几条路在你这台机器上走不通**：
       浏览器里直连会被对方网站的 CORS 拦、公共代理会限流或者干脆挂了、
       Jina 不填 key 直接 401。每条路失败的样子还都不一样。

       所以给一颗按钮：拿一个固定的小网页，把每条路各试一次，
       挨个报"成了 / 被 CORS 拦了 / 401 要 key / 超时 / HTTP xxx"。
       哪条成了就一键选它。不猜，直接量。 */
    /* ⚠️ 体检以前只打 example.com 这一个地址。可"能不能读 example.com"
       跟"能不能读你真要读的那个站"是两回事：CORS 头、反爬、代理黑名单
       全是**按站**来的。于是就有了"体检全绿，记录里还是正文没读到"。
       现在优先拿**上一次真搜到的那条外链**来体检，没有再退回 example.com，
       并且把测的是哪个地址写在结果上面。 */
    const PROBE_URL = 'https://example.com/';
    let probeRows = [];        // [{name, tpl, ok, msg, ms}]
    let probeUrl = '';         // 这次体检打的是哪个地址
    let probing = false;
    window.gywebProbe = async function () {
        if (probing) return;
        probing = true; probeRows = []; renderPanel();
        const target = String(S.lastLink || '').trim() || PROBE_URL;
        probeUrl = target;
        const list = [{ v: '{u}', name: '直连' }]
            .concat(READ_PROXIES.filter(x => x.v).map(x => ({ v: x.v, name: x.name })));
        const mine = String(S.readUrl || '').trim();
        if (mine && /\{u\}/i.test(mine) && !list.some(x => x.v === mine)) list.unshift({ v: mine, name: '你自己填的那条' });
        for (const r of list) {
            const t0 = Date.now();
            let ok = false, msg = '';
            try {
                const body = await grab(fillRead(r.v, target), 12000);
                const t = toText(body);
                if (t.length < 60) { msg = '通了，但只拿到 ' + t.length + ' 个字（多半被反爬页挡了）'; }
                else { ok = true; msg = '能用，拿到 ' + t.length + ' 个字'; }
            } catch (e) {
                const m = String(e.message || e);
                msg = /Failed to fetch|NetworkError|load failed/i.test(m) ? '被对方网站的 CORS 拦了（浏览器里直连基本都这样）'
                    : /abort/i.test(m) ? '超时，没等到回应'
                    : /401/.test(m) ? '401：这条路要 key'
                    : /429/.test(m) ? '429：被限流了，过会儿再试'
                    : m;
            }
            probeRows.push({ name: r.name, tpl: r.v, ok, msg, ms: Date.now() - t0 });
            renderPanel();
        }
        probing = false;
        const good = probeRows.find(x => x.ok);
        if (good && !mine) { S.readUrl = good.tpl === '{u}' ? '' : good.tpl; await save(); }
        renderPanel();
    };

    /* 📷 给 js/42（角色发图 · 「网上搜一张」那档）用：按关键词抓一张现成的图。
       复用这儿现成的两样东西：搜索来源（p.search）和读正文的那条代理链（readChain），
       别处再写一遍就是第二份要维护的抓取逻辑。
       路子：搜一页 → 先从结果页上抠图 → 没有就点进第一条外链再抠 → 还没有就算了。
       抓不到返回空字符串，**不抛错**——发图那边会安安静静退回文字卡片。 */
    window.gyWebPickImg = async function (q) {
        try {
            const kw = String(q || '').trim();
            if (!kw || S.src === 'none') return '';
            const p = presetOf(S.src);
            const tpl = (S.src === 'custom') ? S.url : (p.search || p.url);
            if (!tpl || tpl.indexOf('{q}') < 0) return '';
            const ok = u => u && /^https?:\/\//i.test(u);
            let raw = '';
            try { raw = await grab(tpl.replace('{q}', encodeURIComponent(kw + ' 图片')), 15000); } catch (e) { return ''; }
            const first = pickImgs(raw).filter(ok);
            if (first.length) return first[0];
            const links = pickLinks(raw, 2);
            for (const u of links) {
                for (const t of readChain()) {
                    try {
                        const body = await grab(fillRead(t, u), 12000);
                        const imgs = pickImgs(body).filter(ok);
                        if (imgs.length) return imgs[0];
                        break;                 // 这条外链读到了但没图，换下一条外链
                    } catch (e) { /* 这条路不通，换下一条 */ }
                }
            }
            return '';
        } catch (e) { return ''; }
    };

    let deepInfo = '';     // 上一次"读正文"到底读成了几条，显示在功能页上
    let gotImgs = [];      // 这一轮抓到的图片地址（给"角色存图"用）

    // 一轮搜索：返回 {text, sources[], deepInfo}
    async function searchOnce(q) {
        if (S.src === 'none') return { text: '', sources: [] };
        const p = presetOf(S.src);
        const tpl = (S.src === 'custom') ? S.url : (p.search || p.url);
        if (!tpl || tpl.indexOf('{q}') < 0) { lastErr = '这个来源没配好搜索地址（要带 {q}）'; return { text: '', sources: [] }; }
        let raw = '';
        try { raw = await grab(tpl.replace('{q}', encodeURIComponent(q))); }
        catch (e) { lastErr = String(e.message || e); return { text: '', sources: [] }; }

        const listText = toText(raw);
        const deep = num(S.deep, 0, 5, 2);
        if (deep === 0) return { text: listText.slice(0, num(S.maxChars, 200, 20000, 1500)), sources: ['（只读了搜索结果页）'] };

        // 两段式：点进去读正文。读一条算一条，全失败就退回搜索结果页那坨字。
        //
        // ⚠️ v108 修的一个真 bug：这里以前写的是
        //        readTpl = (S.src === 'custom') ? (S.readUrl || '{u}') : (p.url || '{u}')
        //    而 ddg 那一档的 p.url 是**搜索地址**（.../lite/?q={q}），里面根本没有 {u}。
        //    于是 replace('{u}', …) 什么都没换，每一条"正文"抓的都是同一个搜索结果页——
        //    读正文条数填几都一样，永远只看得到搜索结果页。现在按 readChain() 挨个试。
        const links = pickLinks(raw, deep);
        if (links[0]) S.lastLink = links[0];     // 体检拿它当靶子，比 example.com 说明问题
        const chain = readChain();
        const parts = [], srcs = [];
        let okN = 0, failN = 0, usedRoute = '';
        // 每条路各自为什么没成，分开记。
        // ⚠️ 以前只留第一条失败原因（而第一条几乎永远是"直连被 CORS 拦"），
        //    于是代理被限流、代理 403、反爬页这些真原因一个都看不见——
        //    页面上永远写着"直连被拦了"，你换多少条代理都还是这句话。
        const why = {};   // { '路的名字': '原因' }
        const note = (tpl, msg) => { const k = routeName(tpl); if (!why[k]) why[k] = msg; };
        gotImgs = pickImgs(raw);        // 搜索结果页上的图先收着
        for (const u of links) {
            let got = false;
            for (const tpl of chain) {          // 一条路不行就换下一条
                try {
                    const body = await grab(fillRead(tpl, u), 15000);
                    const t = toText(body);
                    if (t.length < 120) { note(tpl, `通了但只回了 ${t.length} 个字（多半是反爬页或者代理在限流）`); continue; }
                    gotImgs = gotImgs.concat(pickImgs(body)).slice(0, 12);
                    parts.push(`【${u.split('/')[2]}】${t}`);
                    srcs.push(u);
                    okN++; got = true;
                    usedRoute = routeName(tpl);
                    S.lastGoodRead = tpl;        // 记住这条能用，下次先试它
                    break;
                } catch (e) {
                    const msg = String(e.message || e);
                    // 同样一句 Failed to fetch，直连和代理的意思完全不同，别都说成"对方的 CORS"
                    const net = /Failed to fetch|NetworkError|load failed/i.test(msg);
                    note(tpl, !net ? msg
                        : (tpl === '{u}' || !tpl) ? '被对方网站的 CORS 拦了（浏览器里直连基本都这样）'
                        : '这个代理没通（挂了、限流、或者它自己没给 CORS 头）');
                    lastErr = msg;
                }
            }
            if (!got) failN++;
        }
        if (okN) { try { save(); } catch (e) {} }    // 把 lastGoodRead 存下来
        const whyTxt = Object.keys(why).slice(0, 2).map(k => `「${k}」${why[k]}`).join('；')
                     + (Object.keys(why).length > 2 ? `；另外 ${Object.keys(why).length - 2} 条也没通` : '');
        // 把"到底读到没读到"记下来，功能页上直说，别让人以为参数没生效
        deepInfo = deep === 0 ? '只读搜索结果页（读正文条数填的 0）'
                 // 一条外链都没抠出来：读正文那一步**根本没跑**，跟路通不通没关系。
                 // 这种情况以前只写"找到 0 条外链"，谁也看不出是什么意思。
                 : !links.length ? '这一页里一条外链都没抠出来，所以读正文那步根本没跑'
                   + '（这个来源回的可能不是网页 HTML，或者它压根没给外链——换成 DuckDuckGo 那档试试）'
                 : `找到 ${links.length} 条外链，正文读成 ${okN} 条${usedRoute ? `（走的「${usedRoute}」）` : ''}`
                   + (failN ? `、失败 ${failN} 条：${whyTxt}${chain.length > 1 ? `（${chain.length} 条路都试过了）` : ''}` : '');
        const joined = parts.length ? parts.join('\n\n') : listText;
        return { text: joined.slice(0, num(S.maxChars, 200, 20000, 1500)),
                 sources: srcs.length ? srcs : ['（正文没读到，只用了搜索结果页）'],
                 deepInfo };
    }

    /* ===================== 一次完整的探索 ===================== */
    let busy = false;
    const tell = m => { const e = document.getElementById('gywebStatus'); if (e) e.innerText = m; };

    /* ⚠️ 这个模块以前**从来没看过接口返回里的 error**，也没看过模型到底回了什么。
       于是 key 过期、限流、模型名写错、网络断、模型回了一段大白话……
       最后全都显示成同一句「没想出要搜什么」——你只会以为是角色不想搜，
       其实是请求就没成功。现在把真实原因抠出来告诉你。 */
    function apiFail(d) {
        if (!d) return '接口没有任何返回（多半是网络断了或者被挡了）';
        if (d.error) return '接口报错：' + (d.error.message || d.error.type || JSON.stringify(d.error).slice(0, 80));
        const msg = d.choices && d.choices[0] && d.choices[0].message;
        if (!msg) return '接口返回里没有内容（结构对不上，可能是中转站的问题）';
        const t = String(msg.content || '').trim();
        if (!t) return '模型回了个空的（有时候是被安全策略挡了，或者上下文太长）';
        return '';
    }
    // 模型不按 JSON 格式回的时候，尽量从大白话里把要搜的词捞出来，别整轮作废
    function salvageTopic(raw) {
        let t = String(raw || '');
        if (typeof stripReasoningBlocks === 'function') t = stripReasoningBlocks(t);
        t = t.replace(/```[a-z]*|```/gi, '').trim();
        let m = t.match(/"q"\s*[:：]\s*"([^"]{1,40})"/);            // JSON 坏了但字段还在
        if (m) return m[1].trim();
        m = t.match(/[「“"']([^」“”"']{2,30})[」”"']/);                 // 引号里的那个词
        if (m) return m[1].trim();
        m = t.match(/(?:想搜|搜索|搜一下|查一下|查查|了解一下)[：: ]*([^\n。，,]{2,30})/);
        if (m) return m[1].trim();
        const first = t.split(/[\n。！!？?]/).map(x => x.trim()).filter(Boolean)[0] || '';
        if (first && first.length <= 30 && !/^[{\[]/.test(first)) return first;
        return '';
    }

    // 🎬 报场景（Soft：自主模式调过来的时候不抢）——注入页里"自动跑"和"手动点"能分开设
    window.gywebRun = async function (charId, opts) {
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('web', () => gywebRunInner(charId, opts));
        return gywebRunInner(charId, opts);
    };
    const gywebRunInner = async function (charId, opts) {
        const o = opts || {};
        const c = charOf(charId);
        if (!c) return null;
        if (busy) { tell('上一次还没跑完。'); return null; }
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { tell('还没配 API Key。'); return null; }
        // ⚠️ getApiConfig 的参数名是 isSubTask：true = 副API优先（副的没配全就退回主的），
        //    false = **只用主 API**。名字很容易读反，这里写清楚。
        const apiSay = S.sayApi === 'main' ? getApiConfig(false)
                     : S.sayApi === 'sub'  ? getApiConfig(true)
                     : api;
        busy = true; lastErr = '';
        try {
            // ① 挑题目
            tell(`${c.name} 正在想看点什么…`);
            const had = webSrc('had') ? listOf(c.id).slice(-6).map(x => '· ' + x.topic).join('\n') : '';
            // 最近跟你聊了什么、今天在干嘛——不给这些，TA 搜的永远是人设里那几个词
            let hint = '';
            try {
                if (webSrc('chat')) {
                    const arr = ((typeof globalChats !== 'undefined' && globalChats[String(c.id)]) || [])
                        .filter(x => x && x.text && x.sender !== 'system').slice(-6)
                        .map(x => (x.sender === 'me' ? '对方：' : '你：') + String(x.text).replace(/<[^>]+>/g, '').slice(0, 24));
                    if (arr.length) hint += `\n你们最近聊到：\n${arr.join('\n')}\n`;
                }
                if (webSrc('sched') && c.schedule && c.schedule.text)
                    hint += `\n你今天：${String(c.schedule.text).replace(/\s+/g, ' ').slice(0, 60)}\n`;
            } catch (e) {}
            const ask1 = `你有点闲，想上网看点东西。
按你自己的人设和最近的处境，挑**一个你此刻真的会去搜的东西**——可以是你本来就喜欢的领域、
最近惦记的事、别人提过让你好奇的名词，也可以是很日常的（"附近有什么好吃的""这个牌子的琴弦哪种好"）。
${hint}${had ? `你最近已经查过这些，别重复：\n${had}\n` : ''}
只输出 JSON，不要解释：{"q":"你要搜的关键词，越具体越好，不超过20字","why":"你为什么想看这个，不超过20字"}`;
            const d1 = await callChatCompletionAPI(api, buildStructuredMessages(buildBasePrompt(c, false, ''), [], ask1));
            const bad1 = apiFail(d1);
            if (bad1) { lastErr = bad1; tell('挑题目这一步就没成：' + bad1); return null; }
            const raw1 = String(d1.choices[0].message.content || '');
            let r1 = (typeof parseModelJson === 'function') ? parseModelJson(raw1) : null;
            if (Array.isArray(r1)) r1 = r1[0];
            let topic = String((r1 && r1.q) || '').trim().slice(0, 30);
            const why = String((r1 && r1.why) || '').trim().slice(0, 30);
            // JSON 没解析出来不代表模型没说——它可能就是用大白话回的，先捞一把
            if (!topic) topic = salvageTopic(raw1).slice(0, 30);
            if (!topic) {
                const say = raw1.replace(/\s+/g, ' ').trim().slice(0, 60);
                lastErr = '模型没按格式回，它说的是：' + (say || '（空）');
                tell('没读懂模型想搜什么。它回的是：' + (say || '（空）'));
                return null;
            }

            // ②③ 搜（可以多轮：读完觉得没读明白就换个词再搜）
            const maxRounds = num(S.rounds, 1, 5, 1);
            let web = '', sources = [], usedRounds = 0, tried = [];
            for (let i = 0; i < maxRounds; i++) {
                usedRounds++;
                tried.push(topic);
                tell(`正在查「${topic}」…${maxRounds > 1 ? `（第 ${usedRounds}/${maxRounds} 轮）` : ''}`);
                const r = await searchOnce(topic);
                if (r.text) { web = r.text; sources = r.sources; }
                if (r.deepInfo) tell(`正在查「${topic}」…${r.deepInfo}`);
                if (i === maxRounds - 1) break;
                // 还有余量：问一句"够不够"，不够就让 TA 换个说法
                tell('看看够不够…');
                const askMore = `你想搜的是「${topic}」${why ? `（因为${why}）` : ''}。
${web ? `这是搜到的内容：\n${web.slice(0, 800)}\n` : '（这一轮什么都没搜到。）'}
够不够回答你想知道的？够了就 done=true；不够的话换一个更可能搜到的说法再搜一次。
已经试过：${tried.join('、')}
只输出 JSON：{"done": true或false, "next": "换成搜这个，不超过20字"}`;
                const dm = await callChatCompletionAPI(api, buildStructuredMessages('', [], askMore));
                let rm = (typeof parseModelJson === 'function') ? parseModelJson(dm.choices?.[0]?.message?.content || '') : null;
                if (Array.isArray(rm)) rm = rm[0];
                if (!rm || rm.done !== false) break;
                const nx = String(rm.next || '').trim().slice(0, 30);
                if (!nx || tried.includes(nx)) break;
                topic = nx;
            }

            // ④ 写感想
            tell(`${c.name} 正在看…`);
            // 🎲 感想字数设成「TA 定」：给个占位数，发请求前 js/53 会把"xx字以内"换成"长短你自己定"
            const nChars = (typeof gyTaFieldOn === 'function' && gyTaFieldOn(c, 'web.sayChars')) ? 91008 : num(S.sayChars, 20, 600, 80);
            const ask2 = `你刚刚上网搜了「${topic}」${why ? `（因为${why}）` : ''}。
${web ? `搜到的内容（网页原文，可能很乱，自己挑有用的看）：\n${web}\n` : '（这次没能联网，就按你自己知道的写。）'}
用你自己的口吻写一段"我看到了什么、我怎么想"。要求：
· 不是摘要也不是百科，是**你的反应**——哪一条让你意外、哪一条你不同意、勾起了什么。
· 如果内容一看就是广告、乱码或者跟你要搜的东西对不上，就直说"没搜到什么有用的"，别硬编。
· ${nChars} 字以内，像人说话，不要引号不要旁白。`;
            const d2 = await callChatCompletionAPI(apiSay, buildStructuredMessages(buildBasePrompt(c, false, ''), [], ask2));
            const bad2 = apiFail(d2);
            if (bad2) { lastErr = bad2; tell('搜完了，但写感想这一步没成：' + bad2); return null; }
            let text = (d2.choices?.[0]?.message?.content || '').trim().replace(/^["'“”「」]+|["'“”「」]+$/g, '');
            if (typeof stripReasoningBlocks === 'function') text = stripReasoningBlocks(text);
            if (typeof applyRegexScripts === 'function') { try { text = applyRegexScripts(text, 'ai_output', c.id); } catch (e) {} }
            if (!text) { tell('这次什么都没写出来。'); return null; }

            // 🖼️ 看到喜欢的图就往自己的图库里存一张（js/34，开关 galleryCharSave）。
            //    存的是**私库**——那是 TA 自己的相册，别人看不到。
            try {
                if (gotImgs.length && window.gyGallery && typeof window.gyGallery.charSave === 'function') {
                    const pick = gotImgs[Math.floor(Math.random() * gotImgs.length)];
                    await window.gyGallery.charSave(c.id, pick, topic, '上网看「' + topic + '」的时候留下的');
                }
            } catch (e) { console.warn('[联网探索] 存图失败', e); }

            const entry = { id: uid(), at: Date.now(), topic, why, text: text.slice(0, Math.max(200, nChars * 4)),
                            src: web ? S.src : 'none', rounds: usedRounds, sources: sources.slice(0, 4),
                            deep: deepInfo };   // 这一条到底读到了正文还是只读了搜索页，记下来备查
            const arr = listOf(c.id);
            arr.push(entry);
            const keep = num(S.max, 1, 200, 30);
            if (arr.length > keep) arr.splice(0, arr.length - keep);
            S.lastRunAt = Date.now();
            await save();
            renderPanel(); renderMemHub();

            if (typeof addNotification === 'function') {
                addNotification(`<b>${c.name}</b> 在网上看到了点东西 🌐`, null, null, c,
                    `${topic}　—　${entry.text.slice(0, 40)}`, { jump: { fn: 'gywebOpen' } });   // 点了打开「上网看看」页（以前写的 feature 名没人认识，点了没反应）
            }
            const wantShare = (o.share !== undefined) ? o.share : on('webExploreShare');
            if (wantShare && typeof deliverCharMoveToChatMessage === 'function') {
                try { deliverCharMoveToChatMessage(c, entry.text, null); } catch (e) {}
                // 🔗 顺手把 TA 刚读的那个网页转过来——不然你只看见一段感想，
                //    不知道 TA 到底在说什么、从哪儿看来的。点卡片能直接打开原网页。
                try { pushLinkCard(c, entry); } catch (e) {}
            }
            tell(lastErr ? '（这次没抓到网页：' + lastErr + '，用的是 TA 自己知道的）' : '');
            return entry;
        } catch (e) {
            tell('出错了：' + (e.message || e));
            return null;
        } finally { busy = false; }
    };

    /* ===================== 注进 prompt ===================== */
    /* 🧾 挑题目的时候读什么——登记到「注入内容管理 → ② 生成时读什么」 */
    const webSrc = k => { try { return !window.gyInjectSrc || window.gyInjectSrc.on('web', k); } catch (e) { return true; } };
    (function regSrc(tries) {
        try {
            if (window.gyInjectSrc && typeof window.gyInjectSrc.def === 'function') {
                window.gyInjectSrc.def({
                    feat: 'web', icon: '🌐', title: '联网探索：TA 决定搜什么的时候',
                    note: '不给素材的话，TA 每次搜的都是人设里那几个词，翻来覆去。给了才会出现"你昨天说的那个牌子"这种真实的好奇。',
                    items: [
                        { k: 'chat',  label: '你们最近聊到的话题', desc: '最近六句里提过的东西。' },
                        { k: 'sched', label: '今天的日程', desc: '今天要出门的人，搜的东西不一样。' },
                        { k: 'had',   label: '最近已经查过什么', desc: '给了才不会翻来覆去搜同一个词。' }
                    ]
                });
                return;
            }
        } catch (e) {}
        if ((tries || 0) < 12) setTimeout(() => regSrc((tries || 0) + 1), 500);
    })(0);

    window.__gyWebCtxFor = function (charId) {
        try {
            if (!on('webExplore')) return '';
            const arr = listOf(charId);
            if (!arr.length) return '';
            const n = num(S.inject, 1, 10, 3);
            const recent = arr.slice(-n).reverse();
            return `\n【你自己上网看到过的东西（真的发生过，是你自己去查的）】\n`
                + recent.map(x => `· ${ago(x.at)}查了「${x.topic}」：${x.text}`).join('\n')
                + `\n⚠️ 这几段是**你当时写下的原话**，只是提醒你"你知道这件事"。\n`
                + `写推文、写日记、聊天、发评论的时候，**绝对不要把上面的句子原样搬出来**——\n`
                + `那是你早就说过的话，再说一遍会像复读机。要用**这一刻的说法**重新讲，\n`
                + `而且多半只该带出其中一点，不是整段。\n`
                + `这些是你自己的见闻，不是别人告诉你的。聊到相关话题时你是真的知道；\n`
                + `没聊到就别硬往外倒——真人不会一开口就汇报自己今天搜了什么。\n`;
        } catch (e) { return ''; }
    };

    /* 这个角色会不会自己去上网。
       default 跟全局走 / on 一定去 / off 不去 / self 让 TA 按人设自己决定。
       self 这一档不调 API：不碰网络、不识字、根本不是现代人的角色本来就不该去。 */
    window.gywebWants = function (c) {
        if (!c) return false;
        const m = c.webMode || 'default';
        if (m === 'off') return false;
        if (m === 'on') return true;
        if (m === 'self') {
            const p = String(c.persona || '') + ' ' + String(c.bio || '');
            if (/古代|江湖|武林|仙|修真|中世纪|不识字|文盲|山里|与世隔绝|不碰电子|没有手机/.test(p)) return false;
            if (/好奇|爱查|爱看|研究|求知|上网|冲浪|资讯|记者|学者|极客|程序/.test(p)) return true;
            return true;   // 看不出来就当会——跟 default 一致，不平白少掉一个人
        }
        return true;
    };

    /* ===================== 自动跑 ===================== */
    async function autoTick() {
        try {
            if (!on('webExplore')) return;
            // 🎲 间隔「TA 定」（全局按钮打开、或者角色是「由 TA 自己决定」模式）：每分钟看一眼，谁按自己说的节奏到点了谁去；
            //    其余角色照旧按全局间隔
            const gapTa = c => typeof gyTaFieldOn === 'function' && (gyTaFieldOn(c, 'web.gapMin') || gyTaFieldOn(c, 'charWebGap'));
            const gap = num(S.gapMin, 30, 1440, 180) * 60000;
            const gOk = Date.now() - (S.lastRunAt || 0) >= gap;
            if (!gOk && !chars().some(gapTa)) return;
            /* 🩹 v114：角色资料页上那个「这个角色自己上网看东西」以前**填了完全没用**——
               存进 char.webMode 之后没有任何代码读它，谁都照样被轮到。现在真的按它筛。
               多一档 self ＝ 让 TA 自己按人设决定要不要上网（不调 API，看人设关键词）。 */
            const last = c => { const a = listOf(c.id); return a.length ? a[a.length - 1].at : 0; };
            const todayN = c => { const d0 = new Date(); d0.setHours(0, 0, 0, 0); return listOf(c.id).filter(x => x.at >= d0.getTime()).length; };
            const cTa = (c, k) => typeof gyTaCharOn === 'function' && gyTaCharOn(c, k);
            // 🩹 角色资料页上的「最短间隔 / 一天最多」以前存了没人读，现在真的按它筛；设成 TA 定的按 TA 自己说的来
            const cs = chars().filter(c => window.gywebWants(c)).filter(c => {
                let g = gyNum(c.webGapMin, 0) > 0 ? gyNum(c.webGapMin, 0) * 60000 : 0;
                if (gapTa(c)) g = gyTaGapMs(c, 'web', g || gap);
                else if (!gOk) return false;
                if (g && Date.now() - last(c) < g) return false;
                const pd = cTa(c, 'charWebPerDay') ? (typeof gyTaCount === 'function' ? gyTaCount(c, 'webPerDay', 0) : 0) : gyNum(c.webPerDay, 0);
                if (pd > 0 && todayN(c) >= pd) return false;
                return true;
            });
            if (!cs.length) return;
            const pick = cs.slice().sort((a, b) => last(a) - last(b))[0];
            if (pick) {
                await window.gywebRun(pick.id);
                if (typeof gyTaAfter === 'function' && gapTa(pick)) gyTaAfter(pick, 'web');
            }
        } catch (e) { console.warn('[联网探索] 自动跑出错：', e); }
    }

    /* ===================== 页面 ===================== */
    const CSS = `
    /* 🔗 转发的网页卡片：像个链接预览，点了直接开原网页 */
    .gyweb-lk{width:min(268px,84%);margin:8px 0;border-radius:14px;overflow:hidden;
        border:1px solid rgba(128,128,128,.24);background:rgba(128,128,128,.06);}
    .gyweb-lk-hd{font-size:10.5px;letter-spacing:.1em;color:#8b98a5;padding:8px 12px 4px;}
    .gyweb-lk-t{font-size:13.5px;font-weight:700;padding:0 12px;line-height:1.5;}
    .gyweb-lk-w{font-size:11.5px;color:#8b98a5;padding:3px 12px 0;line-height:1.6;}
    .gyweb-lk-list{padding:8px 10px 10px;display:flex;flex-direction:column;gap:5px;}
    .gyweb-lk-a{display:flex;align-items:center;gap:7px;text-decoration:none;color:inherit;
        background:rgba(128,128,128,.1);border-radius:9px;padding:7px 9px;font-size:11.5px;transition:.15s;}
    .gyweb-lk-a:hover{background:rgba(var(--gy-accent-rgb),.14);}
    .gyweb-lk-fav{font-size:13px;}
    .gyweb-lk-h{font-weight:600;white-space:nowrap;}
    .gyweb-lk-u{flex:1;min-width:0;color:#8b98a5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .gyweb-lk-go{color:var(--gy-accent);font-weight:700;}

    #gywebModal{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.45);display:none;
        align-items:center;justify-content:center;padding:16px;}
    #gywebModal.on{display:flex;}
    .gyweb-box{width:100%;max-width:640px;max-height:86vh;overflow-y:auto;background:var(--gy-game-box-bg,#fff);
        color:var(--gy-game-box-fg,#0f1419);border-radius:16px;padding:16px 18px 22px;}
    .gyweb-hd{display:flex;align-items:center;font-size:16px;font-weight:800;margin-bottom:10px;}
    .gyweb-hint{font-size:12.5px;color:#8b98a5;line-height:1.8;}
    .gyweb-sec{border:1px solid rgba(128,128,128,.22);border-radius:12px;padding:12px;margin-bottom:12px;}
    .gyweb-sec h4{margin:0 0 8px;font-size:14px;}
    .gyweb-in{width:100%;padding:8px 10px;border:1px solid rgba(128,128,128,.35);border-radius:8px;
        background:transparent;color:inherit;font-size:13px;box-sizing:border-box;margin-bottom:8px;}
    .gyweb-probe{border:1px solid rgba(128,128,128,.25);border-radius:10px;overflow:hidden;margin:6px 0 4px;}
    .gyweb-probe-row{display:flex;align-items:center;gap:8px;padding:7px 10px;font-size:12px;
        border-bottom:1px solid rgba(128,128,128,.14);}
    .gyweb-probe-row:last-child{border-bottom:none;}
    .gyweb-probe-row.ok{background:rgba(0,186,124,.08);}
    .gyweb-probe-row.bad{color:#8b98a5;}
    .gyweb-probe-row b{white-space:nowrap;}
    .gyweb-probe-row span{flex:1;min-width:0;}
    .gyweb-probe-row i{font-style:normal;color:var(--gy-accent,#1d9bf0);cursor:pointer;white-space:nowrap;}
    .gyweb-btn{border:1px solid #1d9bf0;color:#1d9bf0;background:transparent;border-radius:999px;
        padding:5px 13px;font-size:13px;cursor:pointer;white-space:nowrap;}
    .gyweb-btn.solid{background:#1d9bf0;color:#fff;}
    .gyweb-btn.ghost{border-color:rgba(128,128,128,.4);color:#8b98a5;}
    .gyweb-pick{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;
        border:1px solid rgba(128,128,128,.3);font-size:13px;cursor:pointer;margin:0 6px 6px 0;}
    .gyweb-pick.on{border-color:#1d9bf0;color:#1d9bf0;}
    .gyweb-item{border:1px solid rgba(128,128,128,.2);border-radius:10px;padding:9px 11px;margin-bottom:8px;}
    .gyweb-item b{font-size:13.5px;}
    .gyweb-item p{margin:4px 0 0;font-size:13px;line-height:1.75;}
    .gyweb-item i{font-style:normal;font-size:11.5px;color:#8b98a5;}
    .gyweb-x{color:#f91880;cursor:pointer;font-size:12px;float:right;}
    .gyweb-num{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 0;
        border-bottom:1px solid rgba(128,128,128,.12);font-size:13px;}
    .gyweb-num input{width:88px;padding:6px 8px;border:1px solid rgba(128,128,128,.35);
        border-radius:8px;background:transparent;color:inherit;}
    .gyweb-num em{font-style:normal;font-size:11.5px;color:#8b98a5;flex:1 0 100%;}
    `;

    let openChar = null;

    function mount() {
        if (document.getElementById('gywebModal')) return;
        const st = document.createElement('style'); st.id = 'gywebStyle'; st.textContent = CSS;
        document.head.appendChild(st);
        const m = document.createElement('div');
        m.id = 'gywebModal';
        m.innerHTML = `<div class="gyweb-box">
            <div class="gyweb-hd">🌐 联网探索<button class="gyweb-btn ghost" style="margin-left:auto" onclick="gywebClose()">关闭</button></div>
            <div id="gywebBody"></div>
        </div>`;
        document.body.appendChild(m);
    }
    window.gywebOpen = function () { mount(); document.getElementById('gywebModal').classList.add('on'); renderPanel(); };
    window.gywebClose = function () { const m = document.getElementById('gywebModal'); if (m) m.classList.remove('on'); };

    window.gywebSet = async function (k, v) { S[k] = v; await save(); renderPanel(); };
    window.gywebSetNum = async function (k, v, lo, hi, dft) { S[k] = num(v, lo, hi, dft); await save(); };
    window.gywebPickChar = function (id) { openChar = (String(openChar) === String(id)) ? null : String(id); renderPanel(); };
    window.gywebDel = async function (cid, eid) {
        S.log[String(cid)] = listOf(cid).filter(x => x.id !== eid);
        await save(); renderPanel(); renderMemHub();
    };
    window.gywebRunPick = function () {
        const sel = document.getElementById('gywebWho');
        const id = sel ? sel.value : '';
        if (!id) { tell('先选个角色。'); return; }
        window.gywebRun(id, { share: !!(document.getElementById('gywebShareNow') || {}).checked });
    };

    function renderPanel() {
        const body = document.getElementById('gywebBody');
        if (!body) return;
        const cs = chars();
        const p = presetOf(S.src);
        const req = (typeof gyReqBox === 'function') ? gyReqBox([
            { sw: 'webExplore' }, { api: true },
            { ok: cs.length > 0, text: '还没有角色', jump: 'openCharacterCenter()', go: '去建一个' },
            { ok: !(p.needKey && !S.key), text: '这个来源需要 key，下面那个框还是空的', jump: '', go: '' },
            { ok: !(S.src === 'custom' && !String(S.url || '').includes('{q}')), text: '自定义搜索地址没填、或者里面没有 {q}', jump: '', go: '' }
        ], { title: '想让 TA 自己上网看看，还差这些' }) : '';

        const numRow = (k, label, lo, hi, dft, unit, note) => `
            <div class="gyweb-num">
                <span style="flex:1;min-width:130px;">${label}</span>
                <input type="number" min="${lo}" value="${S[k]}"
                    onchange="gywebSetNum('${k}',this.value,${lo},${hi},${dft})">
                <span class="gyweb-hint">${unit}</span>
                <em>${note}</em>
            </div>`;

        body.innerHTML = `
            ${req}
            <div class="gyweb-hint" style="margin-bottom:12px;">
                TA 会<b>自己挑一个想了解的东西</b>去搜，读完用自己的口吻写一段感想，存进探索记录，
                并且进 prompt——以后聊到相关话题时 TA 是真的知道。<br>
                💰 一次探索 ≈ 2 次调用（挑题目 + 写感想），多开一轮搜索就多 1 次。
                <b>自主模式跑的是同一份配置</b>，不用改两遍。
            </div>

            <div class="gyweb-sec">
                <h4>🔌 从哪儿取内容</h4>
                <div>${PRESETS.map(x => `<span class="gyweb-pick ${S.src === x.k ? 'on' : ''}" onclick="gywebSet('src','${x.k}')">${esc(x.name)}</span>`).join('')}</div>
                <div class="gyweb-hint" style="margin:4px 0 8px;">${esc(p.note)}</div>
                ${p.needKey ? `<input class="gyweb-in" type="password" value="${esc(S.key)}" placeholder="把 key 粘在这里（只存在你本机）"
                    onchange="gywebSet('key', this.value.trim())">` : ''}
                ${S.src === 'custom' ? `
                    <input class="gyweb-in" value="${esc(S.url)}" placeholder="搜索地址，例：https://你的searxng/search?q={q}&format=json"
                        onchange="gywebSet('url', this.value.trim())">` : ''}
                ${S.src !== 'none' ? `
                    <div class="gyweb-hint" style="margin:8px 0 4px;"><b>读正文走哪条路</b>（决定「点进去读几条正文」到底读不读得到）</div>
                    <div>${READ_PROXIES.map(x => `<span class="gyweb-pick ${String(S.readUrl || '') === x.v ? 'on' : ''}" onclick="gywebSet('readUrl','${x.v}')">${esc(x.name)}</span>`).join('')}</div>
                    <input class="gyweb-in" value="${esc(S.readUrl)}" placeholder="或者自己填一条，{u}=原网址、{U}=编码后的网址"
                        onchange="gywebSet('readUrl', this.value.trim())">
                    <div class="gyweb-hint">
                        搜索结果页拿到的是<b>一串外链</b>，正文得再点进去抓一次。浏览器里直连别人家网页
                        会被对方的 CORS 拦掉，所以这一步多半要挂个代理。
                    </div>
                    <div style="margin:8px 0 2px;">
                        <button class="gyweb-btn" onclick="gywebProbe()" ${probing ? 'disabled' : ''}>
                            ${probing ? '正在挨个试…' : '🩺 体检：看看哪条路在你这儿能用'}</button>
                        <span class="gyweb-hint">不调 API，只发几个网络请求。</span>
                    </div>
                    ${probeRows.length ? `<div class="gyweb-probe">
                        <div class="gyweb-hint" style="padding:2px 2px 6px;">这次打的是
                          <b>${esc(shortUrl(probeUrl))}</b>${probeUrl === PROBE_URL ? '（还没搜过，先拿个示例站试；<b>能读它不代表能读别的站</b>——CORS 和反爬是按站来的）' : '（上次真搜到的那条外链）'}</div>
                        ${probeRows.map(r => `
                        <div class="gyweb-probe-row ${r.ok ? 'ok' : 'bad'}">
                            <b>${r.ok ? '✓' : '✗'} ${esc(r.name)}</b>
                            <span>${esc(r.msg)}　${r.ms} ms</span>
                            ${r.ok ? `<i onclick="gywebSet('readUrl','${r.tpl === '{u}' ? '' : r.tpl}')">用这条</i>` : ''}
                        </div>`).join('')}
                        ${!probing && !probeRows.some(x => x.ok) ? `<div class="gyweb-hint" style="color:#f91880;padding:6px 2px;">
                            一条都没通。这说明不是参数问题，是网络这一层过不去：<br>
                            · 公共代理常年限流／时好时坏，过一会儿再体检一次多半就好了<br>
                            · 或者去 jina.ai 免费注册拿个 key，上面来源选 Jina（最稳）<br>
                            · 有自己的反代／SearXNG 的话，填在下面那一栏里最靠谱<br>
                            在这之前，探索照样能跑，只是 TA 读的是搜索结果页那一坨，不是正文。</div>` : ''}
                    </div>` : ''}` : ''}
                ${deepInfo ? `<div class="gyweb-hint">上次读正文：${esc(deepInfo)}</div>` : ''}
                ${lastErr ? `<div class="gyweb-hint" style="color:#f91880;">上次没成的原因：${esc(lastErr)}</div>` : ''}
                ${S.src !== 'none' ? `<div class="gyweb-hint">⚠️ 抓不到时会自动退回"只用模型知道的"继续写，不会卡住也不会弹错。</div>` : ''}
            </div>

            <div class="gyweb-sec">
                <h4>🎚️ 怎么搜、读多少、写多长</h4>
                ${numRow('deep', '点进去读几条正文', 0, 5, 2, '条',
                  '两段式：先看搜索结果页，再点进最相关的几条读正文。填 0 就只读搜索结果页（那一坨里一半是导航和广告）。每多一条多一次网络请求，不多花 token。')}
                ${numRow('rounds', '一次探索最多搜几轮', 1, 5, 1, '轮',
                  '读完让 TA 判断够不够，不够就换个说法再搜。每多一轮多 1 次调用。')}
                ${numRow('maxChars', '喂给模型的网页字数上限', 200, 20000, 1500, '字',
                  '这是整个功能最贵的一段。1500 字足够写一段感想；调到 4000 以上账单会明显变厚。')}
                ${numRow('sayChars', '感想写多少字', 20, 600, 80, '字以内', '写长了更像读后感，写短了更像随口一句。')}
                <div class="gyweb-num" style="border-bottom:none;">
                    <span style="flex:1;min-width:130px;">写感想那次走哪个 API</span>
                    <select class="gyweb-in" style="width:auto;margin:0;" onchange="gywebSet('sayApi', this.value)">
                        <option value="auto" ${S.sayApi === 'auto' ? 'selected' : ''}>跟全 app 一样（副 API 优先）</option>
                        <option value="main" ${S.sayApi === 'main' ? 'selected' : ''}>强制走主 API</option>
                        <option value="sub"  ${S.sayApi === 'sub'  ? 'selected' : ''}>强制走副 API</option>
                    </select>
                    <em>带着一整段网页的那次最贵。想省钱就把它甩给便宜的那个模型。
                        （挑题目那次很短，一直跟随默认。）</em>
                </div>
            </div>

            <div class="gyweb-sec">
                <h4>🎯 现在就让谁去看看</h4>
                <select class="gyweb-in" id="gywebWho">
                    ${cs.length ? cs.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') : '<option value="">（还没有角色）</option>'}
                </select>
                <label class="gyweb-hint" style="display:flex;align-items:center;gap:6px;margin-bottom:8px;cursor:pointer;">
                    <input type="checkbox" id="gywebShareNow" style="width:15px;height:15px;"> 看完顺便私聊发给我
                </label>
                <button class="gyweb-btn solid" onclick="gywebRunPick()">🌐 让 TA 去看看</button>
                <span class="gyweb-hint" id="gywebStatus" style="margin-left:8px;"></span>
                <div class="gyweb-hint" style="margin-top:6px;">手动点不受开关限制——开关只决定 TA 会不会自己去。</div>
            </div>

            <div class="gyweb-sec">
                <h4>⚙️ 自动探索的节奏</h4>
                ${numRow('gapMin', '最短间隔', 30, 1440, 180, '分钟', '开关开着时，每隔这么久挑一个"最久没探索过"的角色去看一次。')}
                ${numRow('max', '每人最多存', 1, 200, 30, '条', '超了自动丢最老的。')}
                ${numRow('inject', '注进 prompt', 1, 10, 3, '条', '注得多 TA 记得多，但每轮聊天都要带着。')}
            </div>

            <div class="gyweb-sec">
                <h4>📚 探索记录</h4>
                ${cs.length ? cs.map(c => {
                    const arr = listOf(c.id);
                    const open2 = String(openChar) === String(c.id);
                    return `<div style="margin-bottom:8px;">
                        <div class="gyweb-pick ${open2 ? 'on' : ''}" onclick="gywebPickChar('${c.id}')">${esc(c.name)}　${arr.length} 条</div>
                        ${open2 ? (arr.length ? arr.slice().reverse().map(x => `
                            <div class="gyweb-item">
                                <span class="gyweb-x" onclick="gywebDel('${c.id}','${x.id}')">删</span>
                                <b>${esc(x.topic)}</b>　<i>${ago(x.at)}${x.why ? '　·　' + esc(x.why) : ''}${x.src === 'none' ? '　·　没联网' : ''}${x.rounds > 1 ? '　·　搜了 ' + x.rounds + ' 轮' : ''}</i>
                                <p>${esc(x.text)}</p>
                                ${(x.sources && x.sources.length) ? `<i style="display:block;margin-top:4px;">看的是：${x.sources.map(u => esc(shortUrl(u))).join('、')}</i>` : ''}
                                ${(x.deep && /没读到|失败/.test(String(x.sources || ''))) || (x.deep && !(x.sources || []).some(u => /^https?:/.test(u)))
                                    ? `<i style="display:block;margin-top:2px;opacity:.75;">为什么没读到：${esc(x.deep)}　<u style="cursor:pointer;" onclick="gywebProbe()">去体检</u></i>` : ''}
                            </div>`).join('') : '<div class="gyweb-hint" style="padding:6px 2px;">还没查过什么。</div>') : ''}
                    </div>`;
                }).join('') : '<div class="gyweb-hint">还没有角色。</div>'}
            </div>`;
    }

    /* ===================== 🔗 转发网页 =====================
       角色分享感想的时候，把**刚刚读的那个网页**一起转过来。
       没有这一条的话，你只看见 TA 叽里呱啦一段，不知道在说什么、从哪儿看来的。 */
    function hostOf(u) { try { return String(u).split('/')[2] || String(u).slice(0, 24); } catch (e) { return ''; } }
    function pushLinkCard(c, entry) {
        if (typeof globalChats === 'undefined') return;
        const srcs = (entry.sources || []).filter(u => /^https?:\/\//i.test(u));
        if (!srcs.length) return;                      // 没真读到网页就不发卡片
        const sid = String(c.id);
        if (!globalChats[sid]) globalChats[sid] = [];
        globalChats[sid].push({
            sender: c.id, type: 'weblink', timestamp: Date.now(), readBy: [],
            weblink: { topic: entry.topic, why: entry.why || '',
                       gist: String(entry.text || '').slice(0, 60),
                       links: srcs.slice(0, 3).map(u => ({ u, h: hostOf(u) })) },
            text: `［看的这个］${entry.topic}　${srcs[0]}`
        });
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        try {
            if (typeof currentChatSessionId !== 'undefined' && String(currentChatSessionId) === sid
                && typeof renderChatMessages === 'function') renderChatMessages();
        } catch (e) {}
    }
    window.gyWebLinkHtml = function (msg) {
        const w = msg.weblink || {};
        const ls = w.links || [];
        return `
        <div class="gyweb-lk">
          <div class="gyweb-lk-hd">🔗 TA 刚看的</div>
          <div class="gyweb-lk-t">${esc(w.topic || '')}</div>
          ${w.why ? `<div class="gyweb-lk-w">${esc(w.why)}</div>` : ''}
          <div class="gyweb-lk-list">
            ${ls.map(x => `<a class="gyweb-lk-a" href="${esc(x.u)}" target="_blank" rel="noreferrer noopener">
                <span class="gyweb-lk-fav">🌐</span>
                <span class="gyweb-lk-h">${esc(x.h)}</span>
                <span class="gyweb-lk-u">${esc(String(x.u).replace(/^https?:\/\//, '').slice(0, 46))}</span>
                <span class="gyweb-lk-go">↗</span></a>`).join('')}
          </div>
        </div>`;
    };
    // 手动把某一条探索转发到某个人的私聊
    window.gywebShareEntry = function (charId, entryId) {
        const c = charOf(charId); if (!c) return;
        const e = listOf(charId).find(x => x.id === entryId);
        if (!e) return;
        try { if (typeof deliverCharMoveToChatMessage === 'function') deliverCharMoveToChatMessage(c, e.text, null); } catch (err) {}
        pushLinkCard(c, e);
        try { if (typeof switchMainView === 'function') { switchMainView('chat'); if (typeof switchChatSession === 'function') switchChatSession(charId); } } catch (err) {}
    };

    /* ===================== 记忆总览里的那一块 ===================== */
    function memHubHtml(charId) {
        const arr = listOf(charId);
        return `
          <label style="font-size:15px;">🌐 联网探索</label>
          <div style="font-size:12px; color:#536471; margin-bottom:8px;">
            TA 自己上网看过的东西。这些会进 TA 的 prompt——聊到相关话题时 TA 是真的知道。
          </div>
          <div style="display:flex;align-items:center;gap:10px;background:white;padding:10px 12px;border-radius:8px;border:1px solid #eff3f4;margin-bottom:8px;">
            <b style="font-size:18px;color:#1d9bf0;">${arr.length}</b><span style="font-size:13px;">条探索记录</span>
            <button type="button" class="btn-edit-small" style="margin-left:auto;" onclick="gywebOpen()">打开联网探索</button>
            <button type="button" class="btn-edit-small" onclick="gywebRun('${charId}')">让 TA 现在去看看</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;">
          ${arr.length ? arr.slice().reverse().slice(0, 30).map(x => `
            <div style="background:white;padding:8px 10px;border-radius:6px;border:1px solid #eff3f4;">
              <div style="font-size:13px;"><b>${esc(x.topic)}</b>　<span style="font-size:11px;color:#8b98a5;">${ago(x.at)}${x.src === 'none' ? '　·　没联网' : ''}</span>
                <span style="color:#f91880;cursor:pointer;float:right;font-size:12px;" onclick="gywebDelEntry('${charId}','${x.id}')">删除</span></div>
              <div style="font-size:13px;color:#536471;line-height:1.7;margin-top:2px;">${esc(x.text)}</div>
              ${(x.sources || []).some(u => /^https?:/i.test(u))
                ? `<div style="margin-top:5px;"><button type="button" class="btn-edit-small" onclick="gywebShareEntry('${charId}','${x.id}')">🔗 让 TA 把这个网页转给我</button></div>` : ''}
            </div>`).join('') : '<div style="color:#8b98a5;font-size:13px;">还没有记录</div>'}
          </div>`;
    }
    // 🗑️ 记忆总览里删一条探索记录（删了就不再进 prompt）
    window.gywebDelEntry = async function (charId, entryId) {
        const arr = listOf(charId);
        const i = arr.findIndex(x => x.id === entryId);
        if (i < 0) return;
        if (!confirm('删掉这条探索记录？删了 TA 就不记得看过这个了。')) return;
        arr.splice(i, 1);
        await save();
        renderMemHub();
    };
    function renderMemHub() {
        const host = document.getElementById('memoryHubContent');
        if (!host) return;
        const id = (typeof currentMemoryHubTargetId !== 'undefined') ? currentMemoryHubTargetId : null;
        let box = document.getElementById('gywebMemHubBox');
        if (String(id || '').startsWith('g_') || !id) { if (box) box.remove(); return; }
        if (!box) {
            box = document.createElement('div');
            box.id = 'gywebMemHubBox'; box.className = 'input-group';
            box.style.cssText = 'margin-top:20px; border-top:1px dashed #1d9bf0; padding-top:15px;';
            host.appendChild(box);
        }
        box.innerHTML = memHubHtml(id);
    }
    function hookMemHub() {
        try {
            ['selectMemoryHubTarget', 'renderMemoryHubContent'].forEach(fn => {
                const orig = window[fn];
                if (typeof orig !== 'function' || orig.__gywebPatched) return;
                window[fn] = function () { const r = orig.apply(this, arguments);
                    try { setTimeout(renderMemHub, 0); } catch (e) {} return r; };
                window[fn].__gywebPatched = true;
            });
        } catch (e) {}
    }

    /* ===================== 自主模式里多一个动作 ===================== */
    function hookAutonomy() {
        try {
            if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || !Array.isArray(GY_AUTONOMY_ACTIONS)) return;
            if (GY_AUTONOMY_ACTIONS.some(a => a.key === 'web_explore')) return;
            GY_AUTONOMY_ACTIONS.splice(GY_AUTONOMY_ACTIONS.length - 1, 0, {
                key: 'web_explore',
                label: '上网查点自己感兴趣的东西',
                hint: '自己挑个题目去搜，读完写一段感想',
                need: () => on('webExplore'),
                // 走的是同一个 gywebRun，所以功能页里调的字数/轮数/主副 API 这里全都算数
                run: async (char) => {
                    const e = await window.gywebRun(char.id, { share: on('webExploreShare') });
                    return e ? ('上网查了「' + e.topic + '」') : null;
                }
            });
        } catch (e) { console.warn('[联网探索] 挂自主模式失败：', e); }
    }

    (async function init() {
        await load();
        mount();
        hookMemHub();
        hookAutonomy();
        if (typeof registerMiniFeature === 'function') {
            registerMiniFeature({
                id: 'web_explore', icon: '🌐', title: '联网探索',
                desc: 'TA 自己挑个题目去网上看看，读完写一段感想，聊到了是真的知道',
                onOpen: () => window.gywebOpen()
            });
        }
        setTimeout(autoTick, 90000);
        if (!window.__gyWebTimer) window.__gyWebTimer = setInterval(autoTick, 20 * 60000);
        console.info('[联网探索] 已加载');
    })();
})();
