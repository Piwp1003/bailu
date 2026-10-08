/* ============================================================
   js/42 —— 角色发图片
   ------------------------------------------------------------
   以前角色在聊天里只能发**表情包**（[EMO:xxx]，从你存的表情里挑）。
   想让 TA 发一张"我拍的窗台"，做不到。

   这个文件给 TA 四种发图的路子，**你自己选走哪条**：

     ① 📇 只发卡片　  不出图，发一张卡，上面写 TA 对这张图的描述。
                      零成本、零延迟、不需要任何画图接口。也是别的路子失败时的兜底。
     ② 🗂️ 从图库里挑  从**这个角色自己的私库 + 公共图库**里，按当下聊的内容挑一张。
                      不会乱生成、不花钱、风格永远对得上人设——前提是你先喂过图。
     ③ 🎨 调接口生图  真的现画一张。要配画图接口（免费的 pollinations 也行）。
     ④ 🌐 网上搜一张  按关键词去网上抓一张现成的。不花钱，但图的质量看运气。

   模式是「全局定一个默认 + 每个角色可以单独覆盖」：
   有图库的角色走②，没喂过图的角色走①，互不打架。

   不管走哪条，聊天里出现的都是**同一张卡**：图（有的话）+ TA 对这张图说的那句话。
   这样即使一张图都出不来，你看到的也是"TA 给你看了什么"，而不是一个裂开的图标。

   ⚠️ 触发方式：模型在回复里写 [IMG:一句话描述]，这一段由下面的 __gyPhotoCtxFor
   注进 prompt 告诉它（在「注入内容管理」里能关）。手动那颗按钮不受任何开关限制，
   点了就发。
   ============================================================ */
(function () {
    'use strict';
    /* ⚠️ 样式类名一律用 gypic- 前缀：gyph- 已经被 js/33（手机）占了，
       撞上去的话这儿的卡片会套上手机里那些样式（实测 .gyph-bd 是个红色小角标，
       整个弹窗内容会被压成一条），排查起来很费劲。 */

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyPhotoBox', 'cfg')
        : ((typeof localforage !== 'undefined') ? localforage.createInstance({ name: 'gyPhotoBox', storeName: 'cfg' }) : null);
    const KEY = 'gyPhoto_state';
    // 形象参考图单独一个仓：图是 base64，动辄几百 KB，跟设置混在一起会把那份存档撑爆
    const LFR = (typeof window.gyStore === 'function')
        ? window.gyStore('gyPhotoBox', 'ref')
        : ((typeof localforage !== 'undefined') ? localforage.createInstance({ name: 'gyPhotoBox', storeName: 'ref' }) : null);
    const RKEY = 'gyPhoto_refs';
    // 参考图张数不设上限（以前每个角色最多留 8 张，多的被挤掉）

    const MODES = [
        { k: 'off',  icon: '🚫', name: '不发图',        note: 'TA 不会主动发图片。手动那颗按钮照样能用。' },
        { k: 'card', icon: '📇', name: '只发卡片',      note: '不出图，只发一张卡写清楚"这张图是什么"。零成本零延迟，也是别的路子失败时的兜底。' },
        { k: 'bank', icon: '🗂️', name: '从图库里挑',    note: '从这个角色的私库 + 公共图库里按当下聊的内容挑一张。先去「小功能 → 🖼️ 图库」给 TA 喂几张、打上标签。' },
        { k: 'gen',  icon: '🎨', name: '调接口生图',    note: '真的现画。要配画图接口（下面有免费的一档）。每张要等十几秒。' },
        { k: 'web',  icon: '🌐', name: '网上搜一张',    note: '按关键词去网上抓一张现成的。不花钱，质量看运气；抓不到就退回卡片。' }
    ];
    const modeOf = k => MODES.find(m => m.k === k) || MODES[1];

    // 画图渠道
    const CHANS = [
        { k: 'free', name: 'Pollinations（免费 · 不用 key）',
          note: '直接按关键词出图，不用注册。慢的时候要等十几二十秒，偶尔抽风。' },
        { k: 'openai', name: 'OpenAI 兼容的画图接口（要 key）',
          note: '填接口地址和 key，走 /v1/images/generations。中转站大多支持。' },
        { k: 'tpl', name: '自己填地址模板',
          note: '比如 https://你的服务/img?q={prompt}。{prompt} 会被换成英文关键词。' }
    ];

    let S = {
        mode: 'bank',        // 全局默认（白露：不接 API，默认从你喂的图库里挑）
        charMode: {},        // 角色id → 模式（覆盖全局）
        chan: 'free',
        url: '', key: '', model: 'dall-e-3', size: '1024x1024', tpl: '',
        gapMsg: 6,           // 最少隔几条消息才让 TA 再发一张
        maxDay: 0,           // 旧存档里的字段，已经不用了：不再限制一天几张
        // 生图专用：每个角色长什么样。{ 角色id: { desc:'形象词', seed:12345, on:true } }
        // 没有这个的话，"自拍"每画一次都是另一张脸——那就不是 TA 了。
        look: {},
        refWay: 'none',      // 参考图怎么递给接口（见 REF_WAYS）
        models: [],          // 拉取回来的模型名（缓存着，免得每次都要重拉）
        style: '',           // 全局画风词（写实 / 插画 / 胶片…），拼在每张图后面
        neg: 'text, watermark, logo, extra fingers, deformed',   // 反向词（接口支持才用得上）
        last: {},            // sessionId → 上次发图时这个会话有多少条消息
        day: '', dayN: 0     // 今天发了几张
    };
    window.gyPhotoCfg = () => JSON.parse(JSON.stringify(S));

    /* ---------- 形象参考图：{ 角色id: [{id, src, tag, at}] } ---------- */
    let R = {};
    async function saveR() { try { if (LFR) await LFR.setItem(RKEY, JSON.parse(JSON.stringify(R))); } catch (e) { console.warn('[角色发图] 参考图存档失败（多半是图太大/太多）', e); } }
    async function loadR() { try { if (LFR) { const d = await LFR.getItem(RKEY); if (d && typeof d === 'object') R = d; } } catch (e) {} }
    const refsOf = id => (Array.isArray(R[String(id)]) ? R[String(id)] : []);
    window.gyPhotoRefs = id => refsOf(id).map(x => ({ id: x.id, tag: x.tag, at: x.at }));

    async function save() { try { if (LF) await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) { console.warn('[角色发图] 存档失败', e); } }
    async function load() {
        try { if (LF) { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } } catch (e) {}
        await loadR();
        if (!S.charMode || typeof S.charMode !== 'object') S.charMode = {};
        if (!S.last || typeof S.last !== 'object') S.last = {};
        if (!S.look || typeof S.look !== 'object') S.look = {};
    }

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const nameOf = id => (charOf(id) || {}).name || '';
    const uid = () => 'ph' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const toast = (t, m) => { try { if (typeof showToast === 'function') showToast('', t, m, null, null, false); } catch (e) {} };

    /* ---------- 这个角色到底走哪条路 ---------- */
    window.gyPhotoModeOf = function (charId) {
        const own = S.charMode[String(charId)];
        return (own && MODES.some(m => m.k === own)) ? own : (S.mode || 'card');
    };

    /* ---------- 注进 prompt：告诉模型"你可以发图，这么写" ----------
       挂进 GY_BOX_CTX，js/37 会按【标题】把它当成一段可开关的注入内容，
       在「注入内容管理」里能逐场景决定带不带。 */
    window.__gyPhotoCtxFor = function (charId) {
        const mode = window.gyPhotoModeOf(charId);
        if (mode === 'off') return '';
        let extra = '';
        if (mode === 'bank') {
            // 图库那档：把 TA 手里**真有的**那些图报给模型，免得它描述一张不存在的图
            try {
                const list = (window.gyGallery && window.gyGallery.seenBy)
                    ? window.gyGallery.seenBy(charId).slice(0, 20) : [];
                const tags = [...new Set(list.map(x => (x.tag || x.note || '').trim()).filter(Boolean))].slice(0, 15);
                if (tags.length) extra = `\n你手里现成的图大致是这些：${tags.join('、')}。描述尽量往这些上靠，不然找不到对得上的图。\n`;
                else extra = '\n（你现在手里一张图都没有，真要发的时候只会发一张文字卡片。）\n';
            } catch (e) {}
        }
        // 自拍那一句只在"真能按形象画/挑"的时候教，免得模型老想发自拍却每次都出别人
        const lk = lookOf(charId);
        const selfLine = (mode === 'gen' || mode === 'bank' || mode === 'card')
            ? `\n这张图里**有你自己**的时候（自拍、镜子、合照、给对方看今天穿的），\n`
              + `在方括号最前面加上"自拍|"，像这样：\n`
              + `　　[IMG:自拍|靠在窗边拍的，头发还没干]\n`
              + (mode === 'gen' && !(lk.on && lk.desc)
                  ? `（提醒：你还没被设定过长相，自拍画出来每次都是另一张脸。）\n` : '')
            : '';
        return `\n【发图片】\n`
            + `聊到该给对方看点什么的时候（你拍的、你看到的、你手机里存的），可以发一张图。\n`
            + `写法：在你那句话里单起一行写 [IMG:一句话说清楚这张图是什么]，比如\n`
            + `　　[IMG:办公室窗台上那盆快死的绿萝，旁边压着没喝完的咖啡]\n`
            + `方括号里的那句话**会被当成图片说明显示给对方看**，所以要像你自己拍完随手说的一句，\n`
            + `不是给画图工具写的提示词，不要写"高清、8K、写实"这种。\n`
            + selfLine
            + `别每句都发，聊到了才发；一次最多一张。${extra}`;
    };

    /* ================= 形象：让"自拍"每次都是同一个人 =================
       调接口生图最要命的一点：同一个人画两次就是两张脸。
       所以每个角色存一份**形象词**（长相、发型、常穿什么、气质），
       凡是"本人出镜"的图，都把这段拼在最前面，再加上一个**固定的种子**——
       同样的形象词 + 同样的种子，出来的人才是同一个人。
       不是本人出镜的（TA 拍的猫、窗台、卷宗），一个字都不加，免得每张图都硬塞个人进去。
       ================================================================= */
    function lookOf(charId) {
        const k = String(charId || '');
        const o = S.look[k] || {};
        return { desc: String(o.desc || ''), seed: Number(o.seed) || 0, on: o.on !== false };
    }
    window.gyPhotoLookOf = charId => lookOf(charId);
    window.gyPhotoSetLook = async function (charId, desc) {
        const k = String(charId || ''); if (!k) return;
        const o = S.look[k] || {};
        o.desc = String(desc || '').slice(0, 400);
        if (!o.seed) o.seed = Math.floor(Math.random() * 999999) + 1;   // 第一次写形象词就定一个种子
        if (o.on === undefined) o.on = true;
        S.look[k] = o; await save();
    };
    window.gyPhotoLookOn = async function (charId, v) {
        const k = String(charId || ''); if (!k) return;
        S.look[k] = Object.assign({ desc: '', seed: 0 }, S.look[k] || {}, { on: !!v });
        await save(); render();
    };
    window.gyPhotoReseed = async function (charId) {
        const k = String(charId || ''); if (!k) return;
        S.look[k] = Object.assign({ desc: '', on: true }, S.look[k] || {},
            { seed: Math.floor(Math.random() * 999999) + 1 });
        await save(); render();
        toast('🎲', '换了一张脸的"底子"（种子），下一张自拍开始生效');
    };

    /* 这张图里有没有 TA 自己？
       ① 模型显式写了 [IMG:自拍|…] 最准，优先认；
       ② 没写就按描述里的词猜——"我/自拍/镜子/这身/合照"这些。
       猜错的代价不对等：该加形象词没加，脸就飘了；不该加却加了，无非多个人在画面里。
       所以这儿宁可**多认一点**。 */
    const SELF_RE = /自拍|self\s*ie|镜子|镜中|我的脸|我这张脸|我今天|这身|这套衣服|我穿|合照|和我一起|入镜|出镜|我在|我站|我坐|我躺|我笑/i;
    function isSelf(desc, flag) {
        if (flag) return true;
        return SELF_RE.test(String(desc || ''));
    }

    /* 拼给画图接口的那串词 */
    function buildImgPrompt(charId, desc, self) {
        const bits = [];
        const lk = lookOf(charId);
        if (self && lk.on && lk.desc) bits.push(lk.desc.replace(/\s+/g, ' ').trim());
        bits.push(String(desc || '').trim());
        if (S.style) bits.push(String(S.style).trim());
        return bits.filter(Boolean).join('，').slice(0, 600);
    }
    window.gyPhotoPromptPreview = (charId, desc, self) => buildImgPrompt(charId, desc, isSelf(desc, self));

    /* ---------- 从回复里把 [IMG:xxx] 摘出来 ---------- */
    const RE = /\[(?:IMG|img|图片|照片)[:：]\s*([^\]]{1,140})\]/;
    window.gyPhotoScan = function (text) {
        const t = String(text || '');
        const m = t.match(RE);
        if (!m) return { text: t, desc: '', self: false };
        let raw = String(m[1]).trim();
        // [IMG:自拍|我靠在窗边] —— 竖线前面那个词是"这张图里有没有你自己"
        let self = false;
        const bar = raw.match(/^([^|｜]{1,6})[|｜]\s*(.+)$/);
        if (bar) {
            if (/自拍|本人|我自己|人像|self/i.test(bar[1])) self = true;
            raw = bar[2].trim();
        }
        return { text: t.replace(m[0], '').replace(/\n{3,}/g, '\n\n').trim(), desc: raw, self };
    };

    /* ---------- 频率闸门（手动那颗按钮不走这儿） ---------- */
    function allowed(sessionId) {
        try {
            const today = new Date().toDateString();
            if (S.day !== today) { S.day = today; S.dayN = 0; }
            // （以前这里还有"一天最多 N 张"的上限，删了）
            const n = ((typeof globalChats !== 'undefined' && globalChats[sessionId]) || []).length;
            let last = S.last[sessionId];
            // 聊天记录被删短过（清空重聊、删了几条）的话，记着的那个位置就比现在还靠后，
            // 差出来是负数，会被下面这一条永远挡住——"怎么再也不发图了"。先把它作废。
            if (last !== undefined && last > n) { delete S.last[sessionId]; last = undefined; }
            if (last !== undefined && (n - last) < Math.max(0, S.gapMsg))
                return `离上一张才隔了 ${n - last} 条（要求至少 ${S.gapMsg} 条）`;
            return '';
        } catch (e) { return ''; }
    }

    /* ================= 四条路子 ================= */

    // ② 图库：按描述里的词去 TA 看得到的图里挑
    function fromBank(charId, desc, self) {
        try {
            if (!window.gyGallery || typeof window.gyGallery.seenBy !== 'function') return null;
            let list = window.gyGallery.seenBy(charId);
            if (!list.length) return null;
            const d = String(desc || '');
            // 本人出镜的图，先只在**标了自拍/本人/人像的那些**里找；
            // 一张都没标过就退回全部——不然"发张自拍"会给你一张 TA 拍的猫。
            if (self) {
                const face = list.filter(x => /自拍|本人|人像|头像|照片里是我|selfie/i.test((x.tag || '') + ' ' + (x.note || ''))
                    && String(x.owner || '') === String(charId));
                if (face.length) list = face;
            }
            // 标签/备注里的词跟描述对得上几个字，就算几分；一个都对不上就随便给一张 TA 自己的
            const score = x => {
                const key = ((x.tag || '') + ' ' + (x.note || '')).trim();
                if (!key) return 0;
                let s = 0;
                key.split(/[\s,，、/]+/).filter(w => w.length >= 2).forEach(w => { if (d.includes(w)) s += w.length; });
                if (String(x.owner || '') === String(charId)) s += 0.5;   // 同分优先用 TA 自己的私库
                return s;
            };
            const ranked = list.map(x => ({ x, s: score(x) })).sort((a, b) => b.s - a.s);
            const top = ranked[0];
            if (!top) return null;
            if (top.s > 0) return { src: top.x.src, why: '你图库里的', tag: top.x.tag || '' };
            const mine = list.filter(x => String(x.owner || '') === String(charId));
            const pool = mine.length ? mine : list;
            const pick = pool[Math.floor(Math.random() * pool.length)];
            return pick ? { src: pick.src, why: '你图库里的（没有特别对得上的，随手拿了一张）', tag: pick.tag || '' } : null;
        } catch (e) { return null; }
    }

    // ③ 生图
    async function fromGen(desc, charId, self) {
        const lk = lookOf(charId);
        const q = buildImgPrompt(charId, desc, self);
        const usedLook = !!(self && lk.on && lk.desc);
        // 本人出镜就用**这个角色固定的那个种子**，脸才不会每张都换；
        // 不是本人出镜的随机种子，免得每张风景都长一个样。
        const seed = usedLook && lk.seed ? lk.seed : Math.floor(Math.random() * 999999);
        // 本人出镜才挑参考图——拍窗台用不着照着人画
        const ref = (self && S.refWay !== 'none') ? pickRef(charId, desc) : null;
        const why = ref ? ('现画的（照着' + (ref.tag ? '「' + ref.tag + '」那张' : 'TA 的参考图') + '画的）')
                  : usedLook ? '现画的（按 TA 的形象）' : '现画的';
        if (!q) return null;
        try {
            if (S.chan === 'tpl') {
                const t = String(S.tpl || '').trim();
                if (!t.includes('{prompt}')) return null;
                return { src: t.replace('{prompt}', encodeURIComponent(q)).replace('{seed}', String(seed)), why, prompt: q };
            }
            if (S.chan === 'openai') {
                const base = String(S.url || '').trim().replace(/\/+$/, '');
                if (!base || !S.key) return null;
                const url = /\/v1\/images/.test(base) ? base : base + '/v1/images/generations';
                const body = { model: S.model || 'dall-e-3', prompt: q, n: 1, size: S.size || '1024x1024' };
                // 这两个字段不是所有接口都认；认的（SD 系中转）能少画出六根手指，
                // 不认的一般直接忽略，不会报错。
                if (S.neg) body.negative_prompt = S.neg;
                if (usedLook && lk.seed) body.seed = lk.seed;

                // 🖼️ 参考图：照着这张画。三种递法，按你在设置里选的来。
                let res;
                if (ref && S.refWay === 'edits') {
                    // multipart 上传真文件，走 /v1/images/edits
                    const blob = toBlob(ref.src);
                    if (!blob) throw new Error('这张参考图是外链地址，edits 那档要本地图片，换成 image_url 那档');
                    const fd = new FormData();
                    fd.append('image', blob, 'ref.jpg');
                    fd.append('prompt', q);
                    fd.append('model', S.model || 'gpt-image-1');
                    fd.append('size', S.size || '1024x1024');
                    fd.append('n', '1');
                    const eu = url.replace(/\/images\/generations$/i, '/images/edits');
                    res = await fetch(eu, { method: 'POST', headers: { Authorization: 'Bearer ' + S.key }, body: fd });
                } else {
                    if (ref && S.refWay === 'b64') body.image = ref.src;
                    if (ref && S.refWay === 'url') {
                        if (/^data:/i.test(ref.src)) throw new Error('这张参考图是本地传的、没有网址，image_url 那档用不了（改成 image=base64 那档）');
                        body.image_url = ref.src;
                    }
                    res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.key },
                        body: JSON.stringify(body)
                    });
                }
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const d = await res.json();
                const it = d && d.data && d.data[0];
                if (!it) throw new Error('接口没给图');
                const src = it.url || (it.b64_json ? 'data:image/png;base64,' + it.b64_json : '');
                return src ? { src, why, prompt: q } : null;
            }
            // free：pollinations，直接拼地址就出图。种子固定＝同一张脸。
            // 它的图生图只吃**外链**（image=网址），本地传的图没网址，只能当没有。
            const refUrl = (ref && !/^data:/i.test(ref.src)) ? `&image=${encodeURIComponent(ref.src)}` : '';
            return { src: `https://image.pollinations.ai/prompt/${encodeURIComponent(q)}?nologo=true&width=768&height=768&seed=${seed}${refUrl}`,
                     why: refUrl ? why : (usedLook ? '现画的（按 TA 的形象）' : '现画的'), prompt: q };
        } catch (e) {
            console.warn('[角色发图] 生图失败', e);
            return { err: String(e.message || e) };
        }
    }

    // ④ 网上搜：复用联网探索那条抓取链（js/29 暴露的 gyWebPickImg）
    async function fromWeb(desc) {
        try {
            if (typeof window.gyWebPickImg !== 'function') return null;
            const src = await window.gyWebPickImg(String(desc || '').slice(0, 40));
            return src ? { src, why: '网上找的' } : null;
        } catch (e) { return { err: String(e.message || e) }; }
    }

    /* ---------- 总入口：拿到一张图（拿不到就退回卡片） ---------- */
    async function pickPhoto(charId, desc, mode, selfFlag) {
        const m = mode || window.gyPhotoModeOf(charId);
        const self = isSelf(desc, selfFlag);
        let got = null, err = '';
        if (m === 'bank') got = fromBank(charId, desc, self);
        else if (m === 'gen') got = await fromGen(desc, charId, self);
        else if (m === 'web') got = await fromWeb(self ? desc + ' 人像' : desc);
        if (got && got.err) { err = got.err; got = null; }
        // 图库没挑着 / 生图搜图没成 → 退回卡片，但把原因写在卡上，别让人以为是功能坏了
        if (!got && m !== 'card' && m !== 'off') {
            const why = m === 'bank' ? (self ? '（TA 图库里没有标成自拍/本人的图，先给你一张文字的）' : '（TA 图库里没有对得上的图，先给你一张文字的）')
                      : err ? '（这张没出来：' + err + '）'
                      : '（这张没抓到，先给你一张文字的）';
            return { src: '', why, mode: m, fell: true };
        }
        return got ? Object.assign({ mode: m }, got) : { src: '', why: '', mode: m };
    }

    /* ---------- 往聊天里塞一条图片消息 ---------- */
    async function push(charId, sessionId, desc, opts) {
        const o = opts || {};
        const sid = sessionId || charId;
        if (typeof globalChats === 'undefined') return null;
        if (!globalChats[sid]) globalChats[sid] = [];
        const mode = o.mode || window.gyPhotoModeOf(charId);
        if (mode === 'off' && !o.manual) return null;

        // 先插一张"正在发"的占位卡：生图要等十几秒，不能让聊天窗口干等着没反应
        const self = isSelf(desc, o.self);
        const msg = { type: 'photo', sender: charId, timestamp: Date.now(), readBy: [],
                      photo: { id: uid(), desc: String(desc || '').slice(0, 120), src: '', why: '', mode, self,
                               loading: mode !== 'card' && mode !== 'off' } };
        globalChats[sid].push(msg);
        try { if (typeof currentChatSessionId !== 'undefined' && currentChatSessionId === sid) renderChatMessages(); } catch (e) {}

        const got = await pickPhoto(charId, desc, mode === 'off' ? 'card' : mode, self);
        msg.photo.src = got.src || '';
        msg.photo.why = got.why || '';
        msg.photo.loading = false;
        try {
            S.last[sid] = (globalChats[sid] || []).length;
            const today = new Date().toDateString();
            if (S.day !== today) { S.day = today; S.dayN = 0; }
            S.dayN++;
            await save();
        } catch (e) {}
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        try { if (typeof currentChatSessionId !== 'undefined' && currentChatSessionId === sid) renderChatMessages(); } catch (e) {}
        return msg;
    }

    /* ---------- 给别的地方用：只要一张图，不往聊天里塞 ----------
       推文/日记/信件配图（js/49）走这条：它自己管往哪儿放，这边只负责按描述弄到一张图。
       不走闸门、不记频率——那些是"聊天里发图"的规矩，跟配图无关。 */
    window.gyPhotoGet = async function (charId, desc, self, mode) {
        try {
            if (!desc) return null;
            const m = mode || window.gyPhotoModeOf(charId);
            const got = await pickPhoto(charId, String(desc).slice(0, 120), (m === 'off' || m === 'card') ? 'card' : m, isSelf(desc, self));
            return got || null;
        } catch (e) { console.warn('[角色发图] 取图失败', e); return null; }
    };

    /* ---------- 回复里带了 [IMG:] 就发一张（自动路径，走闸门） ---------- */
    window.gyPhotoFromReply = async function (charId, sessionId, desc, self) {
        try {
            if (!desc) return null;
            if (window.gyPhotoModeOf(charId) === 'off') return null;
            const no = allowed(sessionId || charId);
            if (no) { console.log('[角色发图] 这次不发：' + no); return null; }
            return await push(charId, sessionId, desc, { self: !!self });
        } catch (e) { console.warn('[角色发图] 发图失败', e); return null; }
    };

    /* ---------- 手动：⋮ 里那颗按钮。不受任何开关/闸门限制，点了就发 ---------- */
    window.gyPhotoAsk = async function () {
        try {
            const sid = (typeof currentChatSessionId !== 'undefined') ? currentChatSessionId : '';
            if (!sid) return toast('📷', '先打开一个聊天');
            if (String(sid).startsWith('g_')) return toast('📷', '群聊里暂时不支持手动点发图');
            const c = charOf(sid);
            if (!c) return toast('📷', '这个会话找不到角色');
            const mode = window.gyPhotoModeOf(sid);
            toast('📷 ' + c.name, mode === 'card' ? '正在想发什么…' : '正在找图…（生图可能要十几秒）');
            const got = await askWhat(c);
            const desc = got && got.desc;
            if (!desc) return toast('📷', '这次没想出该发什么');
            await push(c.id, sid, desc, { manual: true, self: !!(got && got.self), mode: mode === 'off' ? 'card' : mode });
        } catch (e) { toast('📷', '没成：' + (e.message || e)); }
    };

    // 手动点的时候问模型一句"你现在会给对方看什么"
    // 🎬 报场景（Soft）：这一问也是一次完整的 prompt，得能在「注入内容管理」里单独设，
    //    不然它就是一次"谁也管不着"的注入。
    async function askWhat(c) {
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('photo', () => askWhatInner(c));
        return askWhatInner(c);
    }
    async function askWhatInner(c) {
        try {
            if (typeof callChatCompletionAPI !== 'function' || typeof getApiConfig !== 'function') return { desc: '', self: false };
            const api = getApiConfig(true);
            if (!api || !api.key) { toast('📷', '还没配 API Key'); return { desc: '', self: false }; }
            const hist = ((typeof globalChats !== 'undefined' && globalChats[c.id]) || []).slice(-6)
                .map(m => (m.sender === 'me' ? '对方：' : '你：') + String(m.text || '').slice(0, 40)).join('\n');
            const ask = `你现在想给对方看一张图（你拍的 / 你手边的 / 你看到的）。
${hist ? '你们刚才在聊：\n' + hist + '\n' : ''}只回一句话，说清楚这张图上是什么，20 字以内，像你随手拍完说的那句。不要引号，不要"这是一张…"。
如果这张图里**有你自己**（自拍、镜子、给对方看今天穿的），就在最前面加"自拍|"，例如：自拍|靠在窗边，头发还没干。`;
            const d = await callChatCompletionAPI(api,
                buildStructuredMessages(typeof buildBasePrompt === 'function' ? buildBasePrompt(c, false, '') : '', [], ask));
            if (d && d.error) { toast('📷', '接口报错：' + (d.error.message || '')); return { desc: '', self: false }; }
            let t = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
            if (typeof stripReasoningBlocks === 'function') t = stripReasoningBlocks(t);
            t = t.replace(/^["'“”「」\[]+|["'“”「」\]]+$/g, '').slice(0, 70);
            // 跟 [IMG:] 那边同一套解析："自拍|" 前缀单独摘出来
            const r = window.gyPhotoScan('[IMG:' + t + ']');
            return { desc: r.desc || t, self: r.self };
        } catch (e) { return { desc: '', self: false }; }
    }

    /* ================= 形象参考图：照着你给的图画 =================
       光靠形象词，模型只能"按描述想象一个人"；给一张参考图，才是"照着这个人画"。
       有的角色本来就有立绘/官方图，直接喂进去最省事。

       每张图能打标签（正面、侧脸、校服、夏天、笑…），发图的时候按当下那句描述
       挑最像的一张——不然"穿校服的自拍"配了张冬装立绘，还是对不上。

       ⚠️ 不同画图接口吃参考图的方式完全不一样，所以下面让你选「怎么递」：
         · 不递　　　只用形象词（默认，什么接口都不会报错）
         · image     body 里塞 image=base64（很多 SD 系中转是这个）
         · image_url body 里塞 image_url=图片地址（**得是外链**，本地传的图没有地址）
         · edits     走 /v1/images/edits，multipart 上传文件（OpenAI 官方那套）
       选错了一般是接口报错或者干脆忽略——发图那边会退回卡片并把错误写在卡上，不会卡住。
       ================================================================= */
    const REF_WAYS = [
        { k: 'none', name: '不递（只用形象词）', note: '什么接口都不会报错。' },
        { k: 'b64',  name: 'body 里 image=base64', note: '很多 SD 系中转吃这个。图是本地传的也能用。' },
        { k: 'url',  name: 'body 里 image_url=地址', note: '要求参考图有外链地址；本地传进来的图没有地址，用不了这档。' },
        { k: 'edits', name: '走 /v1/images/edits 上传文件', note: 'OpenAI 官方那套。模型得支持图生图。' }
    ];
    // 缩一下再存：立绘动不动两三兆，几张就把存档撑爆
    function shrinkImg(file, cb) {
        const r = new FileReader();
        r.onload = () => {
            const im = new Image();
            im.onload = () => {
                const max = 640;
                let w = im.width, h = im.height;
                if (w > max) { h = Math.round(h * max / w); w = max; }
                if (h > max) { w = Math.round(w * max / h); h = max; }
                const cv = document.createElement('canvas');
                cv.width = w; cv.height = h;
                cv.getContext('2d').drawImage(im, 0, 0, w, h);
                try { cb(cv.toDataURL('image/jpeg', 0.85)); } catch (e) { cb(r.result); }
            };
            im.onerror = () => cb(r.result);
            im.src = r.result;
        };
        r.readAsDataURL(file);
    }
    window.gyPhotoRefUpload = function (input, charId) {
        const files = [...(input.files || [])];
        input.value = '';
        if (!files.length) return;
        const tag = ((document.getElementById('gypicRefTag_' + charId) || {}).value || '').trim();
        const k = String(charId);
        let done = 0;
        files.forEach(f => {
            shrinkImg(f, async src => {
                if (!Array.isArray(R[k])) R[k] = [];
                R[k].unshift({ id: uid(), src, tag, at: Date.now() });
                if (++done === files.length) {
                    await saveR(); render();
                    toast('🖼️', `存了 ${done} 张参考图${tag ? '（标签：' + tag + '）' : ''}`);
                }
            });
        });
    };
    window.gyPhotoRefUrl = async function (charId) {
        const el = document.getElementById('gypicRefUrl_' + charId);
        const u = ((el || {}).value || '').trim();
        if (!u) return toast('🖼️', '先填个图片地址');
        const tag = ((document.getElementById('gypicRefTag_' + charId) || {}).value || '').trim();
        const k = String(charId);
        if (!Array.isArray(R[k])) R[k] = [];
        R[k].unshift({ id: uid(), src: u, tag, at: Date.now() });
        await saveR(); render();
        toast('🖼️', '存好了（外链图 image_url 那档也能用）');
    };
    window.gyPhotoRefDel = async function (charId, id) {
        const k = String(charId);
        R[k] = refsOf(k).filter(x => x.id !== id);
        await saveR(); render();
    };
    window.gyPhotoRefTag = async function (charId, id, tag) {
        const x = refsOf(charId).find(y => y.id === id);
        if (!x) return;
        x.tag = String(tag || '');
        await saveR();
    };
    // 按这句描述挑最像的那张参考图
    function pickRef(charId, desc) {
        const list = refsOf(charId);
        if (!list.length) return null;
        const d = String(desc || '');
        const score = x => {
            const key = String(x.tag || '').trim();
            if (!key) return 0;
            let sc = 0;
            key.split(/[\s,，、/]+/).filter(w => w.length >= 1).forEach(w => { if (d.includes(w)) sc += w.length; });
            return sc;
        };
        const ranked = list.map(x => ({ x, s: score(x) })).sort((a, b) => b.s - a.s);
        return ranked[0] ? ranked[0].x : null;
    }
    window.gyPhotoPickRef = (charId, desc) => { const r = pickRef(charId, desc); return r ? { id: r.id, tag: r.tag } : null; };
    // dataURL → Blob（edits 那档要上传真文件）
    function toBlob(src) {
        const m = String(src).match(/^data:([^;]+);base64,(.+)$/);
        if (!m) return null;
        const bin = atob(m[2]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: m[1] });
    }

    /* ---------- 拉模型 / 保存 ----------
       接口地址填的是**出图**那个地址（…/v1/images/generations），
       而拉模型要的是 …/v1/models。这儿自己把地址往回削一段，别让人再填一遍。 */
    function modelsBase(url) {
        let u = String(url || '').trim().replace(/\/+$/, '');
        if (!u) return '';
        u = u.replace(/\/images\/(generations|edits|variations)$/i, '');
        u = u.replace(/\/images$/i, '');
        if (!/\/v\d+$/.test(u)) u += '/v1';
        return u;
    }
    window.gyPhotoPullModels = async function () {
        // ⚠️ 框里是空的就是空的，别偷偷拿存档里的旧值顶上——
        //    那样用户清空了重填、点拉取，拉的还是旧地址，怎么也想不明白。
        const el = id => document.getElementById(id);
        const url = String(el('gypicUrl') ? el('gypicUrl').value : (S.url || '')).trim();
        const key = String(el('gypicKey') ? el('gypicKey').value : (S.key || '')).trim();
        const out = document.getElementById('gypicPullOut');
        if (!url || !key) { if (out) out.innerHTML = '<span style="color:#f4212e;">接口地址和密钥都要先填上</span>'; return; }
        // 先把这两样存下来——拉之前就存，免得拉失败了连填的东西都没了
        S.url = url; S.key = key; await save();
        if (out) out.innerHTML = '正在拉…';
        try {
            if (typeof fetchModelListFrom !== 'function') throw new Error('拉取模型的函数不在（js/04 没加载？）');
            const list = await fetchModelListFrom(modelsBase(url), key);
            const ids = list.map(x => String(x.id || x.name || '')).filter(Boolean);
            if (!ids.length) throw new Error('对面给了个空列表');
            // 画图模型排前面：名字里带 image / dall / flux / sd / stable / kolors / seedream 这些的
            const pic = /image|img|dall|flux|sd[-_.]?\d|stable|diffusion|kolors|seedream|midjourney|mj|画/i;
            ids.sort((a, b) => (pic.test(b) ? 1 : 0) - (pic.test(a) ? 1 : 0));
            S.models = ids.slice(0, 300);
            if (!S.model || ids.indexOf(S.model) < 0) S.model = ids[0];
            await save(); render();
            const n = ids.filter(x => pic.test(x)).length;
            toast('🎨', `拉到 ${ids.length} 个模型` + (n ? `，其中 ${n} 个看着像画图的，已经排在前面` : '，没看出哪个是画图的，自己挑'));
        } catch (e) {
            if (out) out.innerHTML = `<span style="color:#f4212e;">没拉到：${esc(String(e.message || e))}</span>`
                + `<div class="gypic-note">拉不到不影响用——模型名直接手填也行（下面那个框）。</div>`;
        }
    };
    // 从下拉框挑一个：写进文本框 + 存下来。故意**不重画整页**，
    // 免得你正在填的别的框被刷掉。
    window.gyPhotoPickModel = async function (v) {
        S.model = String(v || '').trim();
        const t = document.getElementById('gypicModel');
        if (t) t.value = S.model;
        await save();
    };
    window.gyPhotoSaveApi = async function () {
        const g = id => (document.getElementById(id) || {}).value;
        if (g('gypicUrl') !== undefined) S.url = String(g('gypicUrl') || '').trim();
        if (g('gypicKey') !== undefined) S.key = String(g('gypicKey') || '').trim();
        // 模型名以**文本框**为准。下拉框只是个方便，选了就写进文本框（见 gyPhotoPickModel），
        // 两边都读的话会打架：你在文本框里手打了一个新模型，一保存又被下拉框的旧选项盖回去。
        if (g('gypicModel') !== undefined) S.model = String(g('gypicModel') || '').trim();
        if (g('gypicSize') !== undefined) S.size = String(g('gypicSize') || '').trim() || '1024x1024';
        if (g('gypicTpl') !== undefined) S.tpl = String(g('gypicTpl') || '').trim();
        if (g('gypicStyle') !== undefined) S.style = String(g('gypicStyle') || '').trim();
        if (g('gypicNeg') !== undefined) S.neg = String(g('gypicNeg') || '').trim();
        await save(); render();
        toast('💾', '存好了：' + (S.chan === 'openai' ? (S.model || '（没填模型名）') : (CHANS.find(x => x.k === S.chan) || {}).name));
    };

    /* ---------- 从人设里抽一份形象词 ----------
       人设动辄几千字，里面关于长相的可能就散在三四句里。
       让模型自己把"看得见的那部分"挑出来、写成一串画图能用的词。
       抽完只是填进输入框，你还能改——不直接拿去画。 */
    window.gyPhotoDrawLook = async function (charId) {
        const c = charOf(charId);
        if (!c) return;
        const box = document.getElementById('gypicLook_' + charId);
        const old0 = box ? box.value : '';
        if (box) { box.value = '正在从人设里抽…'; box.disabled = true; }
        let out = '';
        try {
            if (typeof window.gyInjectInSceneSoft === 'function')
                out = await window.gyInjectInSceneSoft('photo', () => drawLookInner(c));
            else out = await drawLookInner(c);
        } catch (e) { out = ''; }
        if (box) { box.disabled = false; box.value = out || old0; }
        if (!out) return toast('🧍', '没抽出来（人设里可能压根没写长相），自己写一句也行');
        await window.gyPhotoSetLook(charId, out);
        render();
        toast('🧍', '抽好了，你可以再改。改完这个角色的自拍就固定成这张脸了');
    };
    async function drawLookInner(c) {
        if (typeof callChatCompletionAPI !== 'function' || typeof getApiConfig !== 'function') return '';
        const api = getApiConfig(true);
        if (!api || !api.key) { toast('🧍', '还没配 API Key'); return ''; }
        const persona = String(c.persona || '').slice(0, 3000);
        const ask = `下面是一个角色的设定。把其中**外观上看得见的那部分**挑出来，写成一串给画图用的描述词。
要求：
· 只写看得见的：性别年纪、发型发色、眼睛、脸型气质、常穿什么、身上显眼的东西（眼镜/疤/配饰）
· 不写性格、经历、职业（除非制服很显眼）、不写"高清 8K 大师杰作"这种废话
· 一行，逗号分隔，60 字以内，中文
· 设定里真没写长相就回：无

设定：
${persona}`;
        const d = await callChatCompletionAPI(api, buildStructuredMessages('', [], ask));
        if (d && d.error) { toast('🧍', '接口报错：' + (d.error.message || '')); return ''; }
        let t = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
        if (typeof stripReasoningBlocks === 'function') t = stripReasoningBlocks(t);
        t = t.replace(/^["'“”「」]+|["'“”「」]+$/g, '').replace(/\s+/g, ' ').trim();
        if (/^无$|^没有|^设定里/.test(t)) return '';
        return t.slice(0, 200);
    }

    // 试画一张这个角色的自拍：看看形象词到底管不管用
    window.gyPhotoTrySelf = async function (charId) {
        const out = document.getElementById('gypicSelfOut_' + charId);
        if (out) out.innerHTML = '正在画…（十几秒）';
        const got = await pickPhoto(charId, '随手拍的一张自拍', 'gen', true);
        if (!out) return;
        out.innerHTML = got.src
            ? `<div style="font-size:11.5px;color:#8b98a5;margin:4px 0;">给接口的词：${esc(got.prompt || '')}</div>
               <img src="${esc(got.src)}" style="max-width:180px;border-radius:10px;"
                    onerror="this.outerHTML='<span style=\'color:#f4212e;font-size:12px\'>地址出来了但图加载不出来（接口抽风或不让外链）</span>'">`
            : `<span style="color:#f4212e;font-size:12px;">没画出来${got.why ? '：' + esc(got.why) : ''}</span>`;
    };

    /* ---------- 聊天里长什么样 ---------- */
    window.gyPhotoCardHtml = function (msg) {
        const ph = msg.photo || {};
        const c = charOf(msg.sender);
        const av = (typeof getAvatarHTML === 'function' && c) ? getAvatarHTML(c, 40) : '';
        const body = ph.loading
            ? `<div class="gypic-wait"><span class="gypic-dots"><i></i><i></i><i></i></span>正在找图…</div>`
            : (ph.src
                ? `<img class="gypic-img" src="${esc(ph.src)}" loading="lazy" onclick="gyPhotoBig('${esc(ph.src)}')"
                       onerror="this.classList.add('bad');this.removeAttribute('src');this.alt='这张图打不开了';">`
                : `<div class="gypic-none">📷</div>`);
        return `<div class="chat-msg-row other">
            <div>${av}</div>
            <div class="chat-bubble-wrapper" style="align-items:flex-start;">
                <div class="gypic-card">
                    ${body}
                    <div class="gypic-desc">${esc(ph.desc || '（没说这是什么）')}</div>
                    ${ph.why ? `<div class="gypic-why">${esc(ph.why)}</div>` : ''}
                </div>
            </div>
        </div>`;
    };
    window.gyPhotoBig = function (src) {
        if (!src) return;
        const m = document.createElement('div');
        m.className = 'gypic-big';
        m.innerHTML = `<img src="${esc(src)}">`;
        m.addEventListener('click', () => m.remove());
        document.body.appendChild(m);
    };

    /* ================= 设置页 ================= */
    function mount() {
        if (document.getElementById('gyPhotoModal')) return;
        // ⚠️ 别用 .modal-overlay 那个类：它在 style.css 里是 display:none，
        //    加 .on 并不会把它打开（那套弹窗是另一条路子开的），照抄会得到一个永远不显示的窗口。
        //    这儿跟别的小功能（图库/地图/关系账本）一样，自己写 #id.on{display:flex}。
        const m = document.createElement('div');
        m.id = 'gyPhotoModal';
        m.innerHTML = `<div class="gypic-box">
            <div class="gypic-hd">📷 角色发图片
              <button type="button" class="btn-edit-small" style="margin-left:auto;" onclick="gyPhotoClose()">关闭</button></div>
            <div class="gypic-bd" id="gyPhotoBody"></div>
        </div>`;
        m.addEventListener('click', e => { if (e.target === m) window.gyPhotoClose(); });
        document.body.appendChild(m);
    }
    window.gyPhotoOpen = function () { mount(); document.getElementById('gyPhotoModal').classList.add('on'); render(); };
    window.gyPhotoClose = function () { const m = document.getElementById('gyPhotoModal'); if (m) m.classList.remove('on'); };

    window.gyPhotoSet = async function (k, v) { S[k] = v; await save(); render(); };
    window.gyPhotoSetNum = async function (k, v, lo, hi, dft) {
        S[k] = gyNum(v, dft); await save();   // 不设上下限
    };
    window.gyPhotoSetChar = async function (id, v) {
        if (!v) delete S.charMode[String(id)]; else S.charMode[String(id)] = v;
        await save(); render();
    };
    window.gyPhotoTest = async function () {
        const el = document.getElementById('gyPhotoTestOut');
        const q = ((document.getElementById('gyPhotoTestQ') || {}).value || '窗台上的一盆绿萝').trim();
        if (el) el.innerHTML = '正在试…（生图那档可能要十几秒）';
        const t0 = Date.now();
        const got = await pickPhoto((chars()[0] || {}).id || '', q, S.mode === 'off' ? 'card' : S.mode);
        if (!el) return;
        el.innerHTML = got.src
            ? `<div style="font-size:12px;color:#00ba7c;">成了，用了 ${Math.round((Date.now() - t0) / 100) / 10} 秒${got.why ? '（' + esc(got.why) + '）' : ''}</div>
               <img src="${esc(got.src)}" style="max-width:220px;border-radius:10px;margin-top:6px;" onerror="this.outerHTML='<div style=\\'color:#f4212e;font-size:12px\\'>地址出来了，但这张图加载不出来——多半是那个接口这会儿抽风，或者这个地址不让别处引用。</div>'">`
            : `<div style="font-size:12px;color:#f4212e;">没出图${got.why ? '：' + esc(got.why) : ''}。这种情况下 TA 会改发一张文字卡片，不会卡住。</div>`;
    };

    function render() {
        const body = document.getElementById('gyPhotoBody');
        if (!body) return;
        const cs = chars();
        const pick = (cur, onSel) => MODES.map(m =>
            `<span class="gypic-pick ${cur === m.k ? 'on' : ''}" onclick="${onSel}('${m.k}')">${m.icon} ${m.name}</span>`).join('');

        body.innerHTML = `
            <div class="gypic-hint">
              TA 想给你看点什么的时候，会在回复里写一行 <code>[IMG:…]</code>，方括号里那句话就是图片说明。
              这一段是<b>注进 prompt</b> 告诉模型的，在「设置 → 注入内容管理」里能关掉（关了 TA 就不会主动发图，
              手动那颗按钮照样用）。
            </div>

            <div class="gypic-sec">
              <h4>① 默认走哪条路</h4>
              <div class="gypic-row">${pick(S.mode, 'gyPhotoSet.bind(null,\'mode\')')}</div>
              <div class="gypic-note">${esc(modeOf(S.mode).note)}</div>
            </div>

            ${(S.mode === 'gen' || Object.values(S.charMode).includes('gen')) ? `
            <div class="gypic-sec">
              <h4>🎨 画图接口</h4>
              <div class="gypic-row">${CHANS.map(x =>
                `<span class="gypic-pick ${S.chan === x.k ? 'on' : ''}" onclick="gyPhotoSet('chan','${x.k}')">${x.name}</span>`).join('')}</div>
              <div class="gypic-note">${esc((CHANS.find(x => x.k === S.chan) || {}).note || '')}</div>
              ${S.chan === 'openai' ? `
                <input class="gypic-in" id="gypicUrl" placeholder="接口地址，如 https://中转站/v1/images/generations" value="${esc(S.url)}"
                       onchange="gyPhotoSet('url', this.value.trim())">
                <input class="gypic-in" id="gypicKey" type="password" placeholder="key" value="${esc(S.key)}"
                       onchange="gyPhotoSet('key', this.value.trim())">
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;">
                  <button class="btn-edit-small" onclick="gyPhotoPullModels()">🔄 拉取模型</button>
                  <button class="btn-edit-small" onclick="gyPhotoSaveApi()">💾 保存</button>
                  <span class="gypic-cnt">${S.models.length ? '已经拉到 ' + S.models.length + ' 个模型' : '还没拉过（模型名也可以直接手填）'}</span>
                </div>
                <div id="gypicPullOut" style="margin-top:6px;font-size:12px;"></div>
                ${S.models.length ? `
                  <select class="gypic-in" id="gypicModelSel" onchange="gyPhotoPickModel(this.value)">
                    ${S.models.map(m => `<option value="${esc(m)}" ${S.model === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}
                  </select>` : ''}
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <input class="gypic-in" id="gypicModel" style="flex:1;min-width:140px;" placeholder="模型名，如 dall-e-3" value="${esc(S.model)}"
                         onchange="gyPhotoSet('model', this.value.trim())">
                  <input class="gypic-in" id="gypicSize" style="width:130px;" placeholder="尺寸 1024x1024" value="${esc(S.size)}"
                         onchange="gyPhotoSet('size', this.value.trim())">
                </div>
                <div class="gypic-note">拉取模型走的是同一个地址往回削一段（…/v1/models）。拉不到不影响用，模型名手填也行。</div>` : ''}
              ${S.chan === 'tpl' ? `
                <input class="gypic-in" id="gypicTpl" placeholder="地址模板，必须带 {prompt}（可选 {seed}）" value="${esc(S.tpl)}"
                       onchange="gyPhotoSet('tpl', this.value.trim())">
                <div style="margin-top:8px;"><button class="btn-edit-small" onclick="gyPhotoSaveApi()">💾 保存</button></div>` : ''}
              <input class="gypic-in" id="gypicStyle" placeholder="画风词（选填）：比如 写实摄影、胶片颗粒 / 日系插画、厚涂" value="${esc(S.style)}"
                     onchange="gyPhotoSet('style', this.value.trim())">
              <input class="gypic-in" id="gypicNeg" placeholder="反向词（选填，接口认才有用）" value="${esc(S.neg)}"
                     onchange="gyPhotoSet('neg', this.value.trim())">
              <div class="gypic-note">画风词会拼在<b>每张图</b>后面，形象词只在"本人出镜"那种图上加。</div>
              <div class="gypic-note" style="margin-top:10px;"><b>参考图怎么递给接口</b>（喂过参考图才用得上；不同接口吃法不一样，选错一般是报错或被忽略，会退回卡片并把错误写在卡上）</div>
              <div class="gypic-row">${REF_WAYS.map(x =>
                `<span class="gypic-pick ${S.refWay === x.k ? 'on' : ''}" onclick="gyPhotoSet('refWay','${x.k}')">${x.name}</span>`).join('')}</div>
              <div class="gypic-note">${esc((REF_WAYS.find(x => x.k === S.refWay) || {}).note || '')}</div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;">
                <input class="gypic-in" id="gyPhotoTestQ" style="flex:1;min-width:160px;margin:0;" value="窗台上的一盆绿萝">
                <button class="btn-edit-small" onclick="gyPhotoTest()">🧪 试一张</button>
              </div>
              <div id="gyPhotoTestOut" style="margin-top:6px;"></div>
            </div>` : `
            <div class="gypic-sec">
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <input class="gypic-in" id="gyPhotoTestQ" style="flex:1;min-width:160px;margin:0;" value="窗台上的一盆绿萝">
                <button class="btn-edit-small" onclick="gyPhotoTest()">🧪 按现在这条路试一张</button>
              </div>
              <div id="gyPhotoTestOut" style="margin-top:6px;"></div>
            </div>`}

            <div class="gypic-sec">
              <h4>② 每个角色可以不一样</h4>
              <div class="gypic-note">留空＝跟上面的默认走。给谁喂过图就把谁调成「从图库里挑」，没喂过的留着走卡片。</div>
              ${cs.length ? cs.map(c => `
                <div class="gypic-crow">
                  <span class="gypic-cname">${esc(c.name)}</span>
                  <select onchange="gyPhotoSetChar('${c.id}', this.value)">
                    <option value="">跟默认（${esc(modeOf(S.mode).name)}）</option>
                    ${MODES.map(m => `<option value="${m.k}" ${S.charMode[String(c.id)] === m.k ? 'selected' : ''}>${m.icon} ${m.name}</option>`).join('')}
                  </select>
                  ${window.gyGallery ? `<i class="gypic-cnt">图库里 ${window.gyGallery.seenBy(c.id).length} 张</i>` : ''}
                </div>`).join('') : '<div class="gypic-note">还没有角色。</div>'}
            </div>

            <div class="gypic-sec">
              <h4>③ 每个角色长什么样（只有生图那档用得上）</h4>
              <div class="gypic-note">
                调接口生图最要命的一点：<b>同一个人画两次就是两张脸</b>。
                所以这儿给每个角色存一份「形象词」——凡是<b>本人出镜</b>的图（自拍、镜子、合照），
                都会把这段拼在最前面，再配上一个<b>固定的种子</b>，出来的才是同一个人。
                不是本人出镜的（TA 拍的猫、窗台、卷宗）一个字都不加。<br>
                怎么判断"本人出镜"：TA 自己会在方括号里写 <code>[IMG:自拍|…]</code>；
                没写的话按描述里的词猜（我、自拍、镜子、这身…）。
              </div>
              ${cs.length ? cs.map(c => {
                const lk = lookOf(c.id);
                const eff = window.gyPhotoModeOf(c.id);
                return `<div class="gypic-look">
                  <div class="gypic-lookhd">
                    <b>${esc(c.name)}</b>
                    ${eff === 'gen' ? '' : `<i class="gypic-cnt">（这个角色现在走「${esc(modeOf(eff).name)}」，形象词用不上）</i>`}
                    <span class="gypic-sp"></span>
                    <label class="gypic-mini"><input type="checkbox" ${lk.on ? 'checked' : ''}
                      onchange="gyPhotoLookOn('${c.id}', this.checked)"> 用这份形象</label>
                  </div>
                  <textarea class="gypic-in" id="gypicLook_${c.id}" rows="2"
                    placeholder="比如：二十七八岁男子，束发，浅色长衫，眉眼清冷，左手常提一只旧灯笼"
                    onchange="gyPhotoSetLook('${c.id}', this.value)">${esc(lk.desc)}</textarea>
                  <div class="gypic-lookft">
                    <button class="btn-edit-small" onclick="gyPhotoDrawLook('${c.id}')">🧍 从人设里抽一份</button>
                    <button class="btn-edit-small" onclick="gyPhotoTrySelf('${c.id}')">🖼️ 试画一张自拍</button>
                    <span class="gypic-cnt">脸的底子（种子）：${lk.seed || '还没定'}</span>
                    <span class="gypic-rs" onclick="gyPhotoReseed('${c.id}')">🎲 换一张脸</span>
                  </div>
                  <div class="gypic-refs">
                    <div class="gypic-refhd">🖼️ 形象参考图
                      <i class="gypic-cnt">${refsOf(c.id).length ? refsOf(c.id).length + ' 张' : '还没喂过'}</i>
                      <span class="gypic-sp"></span>
                      <i class="gypic-cnt">${S.refWay === 'none' ? '（现在设的是"不递给接口"，喂了也只是留着）' : '按下面那句描述挑最像的一张'}</i>
                    </div>
                    ${refsOf(c.id).length ? `<div class="gypic-reflist">${refsOf(c.id).map(x => `
                      <div class="gypic-ref">
                        <img src="${esc(x.src)}" onclick="gyPhotoBig('${esc(x.src)}')">
                        <input value="${esc(x.tag)}" placeholder="标签" onchange="gyPhotoRefTag('${c.id}','${x.id}', this.value)">
                        <span class="gypic-refx" onclick="gyPhotoRefDel('${c.id}','${x.id}')">×</span>
                      </div>`).join('')}</div>` : ''}
                    <div class="gypic-refadd">
                      <input id="gypicRefTag_${c.id}" placeholder="给要传的图打个标签：正面 / 侧脸 / 校服 / 笑">
                      <input type="file" id="gypicRefFile_${c.id}" accept="image/*" multiple style="display:none;"
                             onchange="gyPhotoRefUpload(this, '${c.id}')">
                      <button class="btn-edit-small" onclick="document.getElementById('gypicRefFile_${c.id}').click()">＋ 传图</button>
                    </div>
                    <div class="gypic-refadd">
                      <input id="gypicRefUrl_${c.id}" placeholder="或者贴一个图片网址（image_url 那档只能用网址）">
                      <button class="btn-edit-small" onclick="gyPhotoRefUrl('${c.id}')">＋ 加网址</button>
                    </div>
                  </div>
                  <div id="gypicSelfOut_${c.id}" style="margin-top:6px;"></div>
                  ${eff === 'gen' && !lk.desc ? `<div class="gypic-warn">⚠️ 这个角色走的是生图，但还没写形象词——自拍每画一次都是另一个人。</div>` : ''}
                </div>`;
              }).join('') : '<div class="gypic-note">还没有角色。</div>'}
            </div>

            <div class="gypic-sec">
              <h4>④ 别发太勤</h4>
              <div class="gypic-num"><span>最少隔</span>
                <input type="number" min="0" value="${S.gapMsg}" onchange="gyPhotoSetNum('gapMsg',this.value,0,Infinity,6)">
                <span>条消息才再发一张</span></div>
              <div class="gypic-note">填 0 就是不用隔。只管 TA 自己发的；一天发几张不设上限。聊天框 ⋮ 里那颗 📷 是手动的，<b>点了就发</b>。</div>
            </div>`;
    }

    /* ---------- 入口 / 开关 / 注入登记 ---------- */
    function addEntry() {
        try {
            if (typeof registerMiniFeature !== 'function') return;
            registerMiniFeature({
                id: 'charPhoto', icon: '📷', title: '角色发图片',
                desc: '让 TA 在聊天里发图：只发文字卡片 / 从你喂的图库里挑 / 调接口现画 / 网上搜一张。每个角色可以不一样',
                onOpen: () => window.gyPhotoOpen()
            });
        } catch (e) { console.warn('[角色发图] 注册小功能入口失败', e); }
    }
    function hookCtx() {
        try {
            if (typeof GY_BOX_CTX !== 'undefined' && Array.isArray(GY_BOX_CTX)
                && !GY_BOX_CTX.some(x => x[0] === '__gyPhotoCtxFor'))
                GY_BOX_CTX.push(['__gyPhotoCtxFor', '角色发图片']);
        } catch (e) {}
    }

    const CSS = `
    #gyPhotoModal{display:none;position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.35);
        align-items:center;justify-content:center;padding:16px;}
    #gyPhotoModal.on{display:flex;}
    .gypic-box{background:var(--gy-bg,#fff);color:inherit;border-radius:16px;width:100%;max-width:620px;
        max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.2);}
    .gypic-hd{display:flex;align-items:center;gap:8px;padding:12px 16px;font-weight:700;
        border-bottom:1px solid var(--gy-border,#eff3f4);flex-shrink:0;}
    .gypic-bd{padding:6px 16px 16px;overflow-y:auto;}
    .gypic-card{background:rgba(128,128,128,.07);border:1px solid var(--gy-border,#e6ecf0);border-radius:14px;
        padding:8px;max-width:260px;}
    .gypic-img{display:block;width:100%;max-width:240px;border-radius:10px;cursor:zoom-in;}
    .gypic-img.bad{min-height:60px;background:rgba(128,128,128,.12);}
    .gypic-none{height:110px;display:flex;align-items:center;justify-content:center;font-size:34px;
        background:rgba(128,128,128,.10);border-radius:10px;}
    .gypic-desc{font-size:13.5px;line-height:1.6;margin:7px 2px 0;}
    .gypic-why{font-size:11px;color:#8b98a5;margin:3px 2px 0;}
    .gypic-wait{height:110px;display:flex;align-items:center;justify-content:center;gap:8px;
        font-size:12px;color:#8b98a5;background:rgba(128,128,128,.10);border-radius:10px;}
    .gypic-dots i{display:inline-block;width:5px;height:5px;border-radius:50%;background:#8b98a5;margin:0 1px;
        animation:gyphb 1s infinite;}
    .gypic-dots i:nth-child(2){animation-delay:.2s;} .gypic-dots i:nth-child(3){animation-delay:.4s;}
    @keyframes gyphb{0%,60%,100%{opacity:.3;}30%{opacity:1;}}
    .gypic-big{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:99999;display:flex;
        align-items:center;justify-content:center;cursor:zoom-out;}
    .gypic-big img{max-width:92vw;max-height:92vh;border-radius:8px;}
    .gypic-hint{font-size:12px;color:#8b98a5;line-height:1.8;padding:2px 2px 10px;}
    .gypic-hint code{background:rgba(128,128,128,.12);border-radius:4px;padding:1px 5px;}
    .gypic-sec{border-top:1px solid var(--gy-border,#eff3f4);padding:10px 2px;}
    .gypic-sec h4{margin:0 0 8px;font-size:14px;}
    .gypic-row{display:flex;flex-wrap:wrap;gap:6px;}
    .gypic-pick{border:1px solid var(--gy-border,#cfd9de);border-radius:999px;padding:5px 12px;font-size:12.5px;
        cursor:pointer;transition:.15s;}
    .gypic-pick:hover{border-color:#1d9bf0;color:#1d9bf0;}
    .gypic-pick.on{background:#1d9bf0;border-color:#1d9bf0;color:#fff;font-weight:600;}
    .gypic-note{font-size:11.5px;color:#8b98a5;line-height:1.75;margin-top:7px;}
    .gypic-in{display:block;width:100%;box-sizing:border-box;margin-top:8px;padding:8px 10px;font-size:13px;
        border:1px solid var(--gy-border,#cfd9de);border-radius:8px;background:transparent;color:inherit;}
    .gypic-crow{display:flex;align-items:center;gap:8px;padding:6px 0;flex-wrap:wrap;}
    .gypic-cname{min-width:80px;font-size:13px;}
    .gypic-crow select{padding:5px 8px;border-radius:8px;border:1px solid var(--gy-border,#cfd9de);
        background:transparent;color:inherit;font-size:12.5px;}
    .gypic-cnt{font-style:normal;font-size:11px;color:#8b98a5;}
    .gypic-num{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:5px 0;flex-wrap:wrap;}
    .gypic-num input{width:76px;padding:6px 8px;border:1px solid var(--gy-border,#cfd9de);border-radius:8px;
        background:transparent;color:inherit;}
    .gypic-look{border:1px solid var(--gy-border,#eff3f4);border-radius:12px;padding:8px 10px;margin:8px 0;}
    .gypic-lookhd{display:flex;align-items:center;gap:8px;font-size:13px;flex-wrap:wrap;}
    .gypic-sp{flex:1;}
    .gypic-mini{font-size:11.5px;color:#8b98a5;display:flex;align-items:center;gap:4px;cursor:pointer;}
    .gypic-lookft{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;}
    .gypic-rs{font-size:11.5px;color:#1d9bf0;cursor:pointer;}
    .gypic-rs:hover{text-decoration:underline;}
    .gypic-warn{font-size:11.5px;color:#ffad1f;margin-top:6px;line-height:1.7;}
    textarea.gypic-in{resize:vertical;font-family:inherit;line-height:1.6;}
    .gypic-refs{margin-top:8px;border-top:1px dashed var(--gy-border,#eff3f4);padding-top:8px;}
    .gypic-refhd{display:flex;align-items:center;gap:6px;font-size:12.5px;flex-wrap:wrap;}
    .gypic-reflist{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;}
    .gypic-ref{position:relative;width:78px;}
    .gypic-ref img{width:78px;height:78px;object-fit:cover;border-radius:8px;cursor:zoom-in;display:block;}
    .gypic-ref input{width:78px;box-sizing:border-box;margin-top:3px;font-size:11px;padding:3px 5px;
        border:1px solid var(--gy-border,#cfd9de);border-radius:6px;background:transparent;color:inherit;}
    .gypic-refx{position:absolute;right:-5px;top:-5px;width:18px;height:18px;border-radius:50%;
        background:#f4212e;color:#fff;font-size:12px;line-height:18px;text-align:center;cursor:pointer;}
    .gypic-refadd{display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap;}
    .gypic-refadd input{flex:1;min-width:150px;padding:6px 8px;font-size:12px;
        border:1px solid var(--gy-border,#cfd9de);border-radius:8px;background:transparent;color:inherit;}`;
    const st = document.createElement('style'); st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);

    (async () => {
        await load();
        addEntry(); hookCtx();
        setTimeout(() => { addEntry(); hookCtx(); }, 1500);
        setTimeout(hookCtx, 3500);
    })();
})();
