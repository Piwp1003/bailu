/* ===========================================================================
   js/56 —— 📨 角色之间自己来往（开了小剧场之后）
   ---------------------------------------------------------------------------
   小剧场演的是"两个人碰上了"。可认识的人之间，更多时候不是见面，是用手机：
   发消息、写信、转账、送东西、打电话、在对方推文底下评论、朋友圈里互动……
   这些白露里本来就有，只是以前只有"TA 对你"这一个方向。

   开了小剧场（charTheater）之后，这里让角色**彼此之间**也用这些功能：
     · 只在关系网上连过线的两个人之间发生——不认识的人不会凭空找上门
     · 找谁、用什么方式、说什么，一次调用由发起的那个人自己定，关系决定语气
       （死对头可能在推文底下阴阳一句，暗恋的人可能写了信又不敢寄太长……）
     · 结果存进两个人各自的手机：消息 / ✉️ 信件 / 📞 通话 / 朋友圈，打开「TA 的手机」就能翻到
     · 转账会真的走钱包（钱包开着的话），送的东西会真的进对方的随身物，评论会真的出现在推文底下
     · 同时记一笔进「Ta们在做什么」，攒够了会总结进各自的记忆——TA 们之后会自然提起

   什么时候发生：
     · 自主模式的角色：多一个动作「📨 找熟人」，TA 自己决定什么时候去（时间管理大师里有这张卡）
     · 其余角色：后台隔一阵掷一次骰子（频率在「Ta们在做什么」页顶上调），每次最多一对
   花钱：每次来往一次调用。开关 peerLife（跟着小剧场，默认开；小剧场关着它就不动）。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyPeerLoaded) return;
    window.__gyPeerLoaded = true;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' && Array.isArray(myCharacters)) ? myCharacters : [];
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const isOn = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : false;
    const interOn = () => { try { return typeof isGlobalCharInteractionEnabled !== 'function' || isGlobalCharInteractionEnabled(); } catch (e) { return false; } };
    const toast = (t, d) => { try { if (typeof showToast === 'function') showToast('', t, d, null, null, false); } catch (e) {} };
    const uid = () => 'pe_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    // 存档：window.gyPeerLog 跟着主存档走（js/04 的快照/读档里登记过）
    if (!Array.isArray(window.gyPeerLog)) window.gyPeerLog = [];
    const LOG = () => { if (!Array.isArray(window.gyPeerLog)) window.gyPeerLog = []; return window.gyPeerLog; };
    // 以前 LOG_CAP = 400，超了删最早的；现在不设上限，全留着

    // 频率（只管后台那一路；自主模式的角色按自己的习惯）
    const CFG_KEY = 'gy_peer_cfg';
    let CFG = { rate: 'mid' };
    try { Object.assign(CFG, JSON.parse(localStorage.getItem(CFG_KEY) || '{}') || {}); } catch (e) {}
    const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(CFG)); } catch (e) {} };
    // 每 10 分钟掷一次的概率 → 平均多久一次
    const RATES = { low: { p: 0.08, t: '很少（平均两小时一次）' }, mid: { p: 0.25, t: '默认（平均四十分钟一次）' }, high: { p: 0.6, t: '频繁（平均十几分钟一次）' }, off: { p: 0, t: '不自己发生（只在自主模式里 / 手动点）' } };

    /* ---------- 开关 ---------- */
    (function regDef(tries) {
        try {
            if (typeof AUTO_FEATURE_DEFS !== 'undefined' && Array.isArray(AUTO_FEATURE_DEFS)) {
                if (!AUTO_FEATURE_DEFS.some(d => d.key === 'peerLife')) AUTO_FEATURE_DEFS.push({
                    key: 'peerLife', label: '角色之间自己来往（私聊 / 写信 / 转账 / 送东西 / 打电话 / 评论…）',
                    desc: '开了「角色之间的后台小剧场」才会动。只在关系网上连过线的两个人之间发生，存进各自的手机。',
                    cost: '每次来往一次调用；后台频率在「Ta们在做什么」页顶上调，默认平均四十分钟一次',
                    group: '背后', where: '「Ta们在做什么」页；TA 的手机 → 消息 / 信件 / 通话 / 朋友圈'
                });
                return;
            }
        } catch (e) {}
        if ((tries || 0) < 20) setTimeout(() => regDef((tries || 0) + 1), 300);
    })(0);
    const gateOn = () => isOn('charTheater') && isOn('peerLife') && interOn();

    /* ---------- 关系网：谁认识谁 ---------- */
    function relsOf(c) {
        const out = [];
        try {
            const rels = (typeof charRelationships !== 'undefined' && Array.isArray(charRelationships)) ? charRelationships : [];
            const seen = new Set();
            rels.forEach(r => {
                if (!r) return;
                const me = String(c.id);
                const other = String(r.fromId) === me ? String(r.toId) : String(r.toId) === me ? String(r.fromId) : '';
                if (!other || other === 'me' || other === me || seen.has(other)) return;
                const oc = charOf(other); if (!oc) return;
                seen.add(other);
                const outR = rels.find(x => String(x.fromId) === me && String(x.toId) === other);
                const backR = rels.find(x => String(x.fromId) === other && String(x.toId) === me);
                out.push({ c: oc, out: (outR && outR.label) || '', back: (backR && backR.label) || '' });
            });
        } catch (e) {}
        return out;
    }
    window.gyPeerRelsOf = id => { const c = charOf(id); return c ? relsOf(c).map(r => ({ id: r.c.id, name: r.c.name, out: r.out, back: r.back })) : []; };
    const between = (a, b) => LOG().filter(e => e && ((String(e.aId) === String(a) && String(e.bId) === String(b)) || (String(e.aId) === String(b) && String(e.bId) === String(a))));
    window.gyPeerLastOf = id => { let t = 0; LOG().forEach(e => { if (e && e.at > t && (String(e.aId) === String(id) || String(e.bId) === String(id))) t = e.at; }); return t; };
    window.gyPeerLastBetween = (a, b) => { let t = 0; between(a, b).forEach(e => { if (e.at > t) t = e.at; }); return t; };

    const KIND = {
        chat:    { ico: '💬', name: '私聊',       say: '发消息，你一句我一句（3 到 8 句）' },
        letter:  { ico: '✉️', name: '写信',       say: '有些话适合写下来，写一封信寄给对方（回对方没回的信也算）' },
        money:   { ico: '💸', name: '转账',       say: '转一笔钱 / 发个红包，带一句备注（还钱、请客、借钱、随份子、就是想给…）' },
        gift:    { ico: '🎁', name: '送东西',     say: '送对方一样具体的东西' },
        call:    { ico: '📞', name: '打电话',     say: '直接打个电话，写下通话里的几句' },
        comment: { ico: '🗨️', name: '评论推文',   say: '在对方最近那条推文底下公开评论一句（别人都看得见）', need: (a, b) => !!latestPost(b) },
        moment:  { ico: '🌀', name: '朋友圈',     say: '自己发一条朋友圈，对方在底下点赞或评论' }
    };
    function latestPost(c) {
        try {
            const week = Date.now() - 7 * 86400000;
            return (typeof globalPosts !== 'undefined' ? globalPosts : []).find(p => p && p.char && String(p.char.id) === String(c.id) && (p.timestamp || 0) > week) || null;
        } catch (e) { return null; }
    }
    const plain = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    /* ---------- 一次来往 ---------- */
    let busy = false;
    async function run(initiator, opts) {
        const o = opts || {};
        if (!initiator) return { blocked: 'nochar' };
        if (!o.manual && !gateOn()) return { blocked: 'switch' };
        if (!interOn()) return { blocked: 'interaction' };
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key || typeof callChatCompletionAPI !== 'function') return { blocked: 'api' };
        let rels = relsOf(initiator);
        if (o.toId) rels = rels.filter(r => String(r.c.id) === String(o.toId));
        if (!rels.length) return { blocked: 'norel' };
        if (busy) return { blocked: 'busy' };
        busy = true;
        try {
            // 候选人太多就挑最近来往少的 + 随机，最多 5 个
            const pick = rels.slice().sort(() => Math.random() - 0.5).slice(0, 5);
            const nowStr = new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const who = pick.map(r => {
                const b = r.c;
                const hist = between(initiator.id, b.id).slice(-4).map(e => `    · ${e.aName}${KIND[e.kind] ? '（' + KIND[e.kind].name + '）' : ''}：${e.summary}`).join('\n');
                const th = (typeof globalTheaterLogs !== 'undefined' ? globalTheaterLogs : []).filter(l => l && !l.peer
                    && ((String(l.charAId) === String(initiator.id) && String(l.charBId) === String(b.id)) || (String(l.charBId) === String(initiator.id) && String(l.charAId) === String(b.id))))
                    .slice(-2).map(l => `    · 碰面：${l.summary}`).join('\n');
                const owed = between(initiator.id, b.id).filter(e => e.kind === 'letter' && String(e.bId) === String(initiator.id)).slice(-1)[0];
                const answered = owed && between(initiator.id, b.id).some(e => e.kind === 'letter' && String(e.aId) === String(initiator.id) && e.at > owed.at);
                const lp = latestPost(b);
                return `【${b.name}】
  人设：${plain(b.persona).slice(0, 300)}
  你对 TA：${r.out || '（没写）'}；TA 对你：${r.back || '（没写）'}
${hist || th ? '  你们最近：\n' + [hist, th].filter(Boolean).join('\n') + '\n' : ''}${owed && !answered ? `  TA 给你寄过一封信《${owed.title || '无题'}》，你还没回：${plain(owed.body).slice(0, 120)}\n` : ''}${lp ? `  TA 最近发的推文：${plain(lp.text).slice(0, 80)}\n` : ''}`;
            }).join('\n');
            const kinds = Object.entries(KIND).map(([k, v]) => `- ${k}：${v.ico}${v.name}——${v.say}`).join('\n');
            const ask = `现在是${nowStr}。你（${initiator.name}）拿起手机，想着要不要联系一下身边认识的人。

你认识的人（只有这几个，都是关系网上跟你有关系的）：
${who}

可以用的方式：
${kinds}
- none：这会儿谁都不想联系

要求：
1. 按你们之间的关系来：关系决定你找不找 TA、用什么方式、什么语气。亲近的人可能随手转账、半夜打电话；关系差的可能只在推文底下阴阳一句；关系一般的就别写得太亲热。
2. 按你的性格和此刻的处境来，要具体，别写"最近还好吗"这种空话，最好接着你们最近发生过的事。
3. 用户不在场，这是你们两个人之间的事。对方的回应也由你写出来（按对方的人设和对你的关系）。

各字段按 kind 填，用不到的留空：
- chat / call / moment：lines 里写对话、通话里的几句、朋友圈底下的评论（who 写说话人名字）
- letter：title 信的标题，body 正文（80~300 字）
- money：amount 金额（元），note 备注
- gift：item 送的东西，itemDesc 一句描述
- call：minutes 通话几分钟
- moment：moment 你发的朋友圈正文
- comment：comment 你的评论，reply 对方的回复（可以不回，留空）

只输出 JSON，不要用 \`\`\` 包，不要写注释：
{"to":"对方名字","kind":"上面的一个","summary":"15字以内，一句话概括这次来往","lines":[{"who":"说话人名字","t":"一句话"}],"title":"","body":"","amount":0,"note":"","item":"","itemDesc":"","minutes":0,"moment":"","comment":"","reply":""}`;
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(initiator, false, '') : ('你是' + initiator.name + '。' + plain(initiator.persona).slice(0, 800));
            const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
            const data = await callChatCompletionAPI(api, msgs, 1);
            const raw = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
            let r = (typeof parseModelJson === 'function') ? parseModelJson(raw) : null;
            if (Array.isArray(r)) r = r[0];
            if (!r || !r.kind) return { blocked: 'parse', raw: String(raw).slice(0, 120) };
            const kind = String(r.kind).trim();
            if (kind === 'none') return { ok: true, none: true };
            if (!KIND[kind]) return { blocked: 'kind', raw: kind };
            const tgtR = pick.find(x => x.c.name === String(r.to || '').trim()) || pick.find(x => String(r.to || '').indexOf(x.c.name) !== -1) || (pick.length === 1 ? pick[0] : null);
            if (!tgtR) return { blocked: 'to', raw: String(r.to || '') };
            if (KIND[kind].need && !KIND[kind].need(initiator, tgtR.c)) return { blocked: 'need', raw: kind };
            const e = await apply(initiator, tgtR, kind, r);
            return e ? { ok: true, entry: e } : { blocked: 'apply' };
        } catch (e) {
            console.warn('[角色来往] 跳过：', e);
            return { blocked: 'error', raw: String(e && e.message || e) };
        } finally { busy = false; }
    }

    async function apply(A, rel, kind, r) {
        const B = rel.c;
        const names = [A.name, B.name];
        const lines = (Array.isArray(r.lines) ? r.lines : []).map(x => ({ who: String((x && x.who) || '').trim(), t: plain(x && x.t).slice(0, 200) }))
            .filter(x => x.t).map(x => ({ w: x.who === B.name || (x.who && B.name.indexOf(x.who) !== -1 && x.who.length >= 2) ? 'b' : 'a', t: x.t })).slice(0, 12);
        const e = { id: uid(), at: Date.now(), kind, aId: A.id, bId: B.id, aName: A.name, bName: B.name,
            rel: `${A.name}→${B.name}：${rel.out || '认识'}` + (rel.back ? `；${B.name}→${A.name}：${rel.back}` : ''),
            summary: plain(r.summary).slice(0, 30) || (KIND[kind].name), lines };
        let scene = '';
        if (kind === 'chat') {
            if (!lines.length) return null;
            scene = lines.map(x => (x.w === 'a' ? A.name : B.name) + '：' + x.t).join('\n');
        } else if (kind === 'letter') {
            e.title = plain(r.title).slice(0, 30) || '无题';
            e.body = String(r.body || '').replace(/<[^>]+>/g, '').trim().slice(0, 1500);
            if (!e.body) return null;
            scene = `${A.name} 给 ${B.name} 寄了一封信《${e.title}》：${e.body.slice(0, 80)}${e.body.length > 80 ? '…' : ''}`;
        } else if (kind === 'money') {
            e.amount = Math.round(Math.max(0, parseFloat(r.amount) || 0) * 100) / 100;
            e.note = plain(r.note).slice(0, 40);
            if (!e.amount) return null;
            // 钱包开着就真走账：A 付得起才算转成；付不起就记成"想转没转成"
            try {
                if (window.gyWallet && isOn('walletOn')) {
                    const p = await window.gyWallet.spend(A.id, e.amount, '转账给' + B.name + (e.note ? '（' + e.note + '）' : ''));
                    if (p && p.ok === false) { e.failed = true; e.summary = '想给' + B.name + '转 ￥' + e.amount + '，钱不够'; }
                    else if (!(p && p.skipped)) { await window.gyWallet.income(B.id, e.amount, A.name + '转来的' + (e.note ? '（' + e.note + '）' : '')); e.wallet = true; }
                }
            } catch (err) {}
            scene = e.failed ? e.summary : `${A.name} 给 ${B.name} 转了 ￥${e.amount}${e.note ? '，备注「' + e.note + '」' : ''}`;
            if (lines.length) scene += '\n' + lines.map(x => (x.w === 'a' ? A.name : B.name) + '：' + x.t).join('\n');
        } else if (kind === 'gift') {
            e.item = plain(r.item).slice(0, 20); e.itemDesc = plain(r.itemDesc).slice(0, 60);
            if (!e.item) return null;
            try { if (window.gyKit && typeof window.gyKit.add === 'function') { window.__gyPeerApplying = true; window.gyKit.add(B.id, e.item, e.itemDesc || ('是' + A.name + '送的'), A.id, A.name); e.kit = true; } } catch (err) {} finally { window.__gyPeerApplying = false; }
            scene = `${A.name} 送了 ${B.name} 一样东西：${e.item}${e.itemDesc ? '（' + e.itemDesc + '）' : ''}`;
            if (lines.length) scene += '\n' + lines.map(x => (x.w === 'a' ? A.name : B.name) + '：' + x.t).join('\n');
        } else if (kind === 'call') {
            e.minutes = Math.max(1, Math.round(parseFloat(r.minutes) || 1));
            if (!lines.length) return null;
            scene = `${A.name} 给 ${B.name} 打了 ${e.minutes} 分钟电话：\n` + lines.map(x => (x.w === 'a' ? A.name : B.name) + '：' + x.t).join('\n');
        } else if (kind === 'comment') {
            const post = latestPost(B);
            const txt = plain(r.comment).slice(0, 140);
            if (!post || !txt) return null;
            e.postId = post.id; e.postText = plain(post.text).slice(0, 60); e.comment = txt; e.reply = plain(r.reply).slice(0, 140);
            try {
                if (!post.replies) post.replies = [];
                if (!post.stats) post.stats = { comments: 0, likes: 0, retweets: 0 };
                const c1 = { id: 'r_' + Date.now() + Math.floor(Math.random() * 100), parentId: null, char: A, text: txt, timestamp: Date.now(), likes: 0, liked: false, likedBy: [] };
                post.replies.push(c1); post.stats.comments = (parseInt(post.stats.comments) || 0) + 1;
                if (e.reply) {
                    post.replies.push({ id: 'r_' + (Date.now() + 1) + Math.floor(Math.random() * 100), parentId: c1.id, char: B, text: e.reply, timestamp: Date.now() + 1000, likes: 0, liked: false, likedBy: [], replyTo: A.name });
                    post.stats.comments++;
                }
            } catch (err) {}
            scene = `${A.name} 在 ${B.name} 的推文「${e.postText}」底下评论：${txt}` + (e.reply ? `\n${B.name} 回：${e.reply}` : '');
        } else if (kind === 'moment') {
            e.moment = plain(r.moment).slice(0, 300);
            if (!e.moment) return null;
            scene = `${A.name} 发了条朋友圈：${e.moment}` + (lines.length ? '\n' + lines.map(x => (x.w === 'a' ? A.name : B.name) + '：' + x.t).join('\n') : '');
        }
        LOG().push(e);
        // 也记一笔进「Ta们在做什么」：那边的记忆总结会把它喂回两个人各自的记忆
        try {
            if (typeof addTheaterLog === 'function') addTheaterLog({
                id: 'th_' + e.id, at: e.at, peer: true, kind, peerId: e.id,
                charAId: A.id, charBId: B.id, charAName: A.name, charBName: B.name,
                relation: e.rel, summary: KIND[kind].ico + ' ' + e.summary, scene: scene.slice(0, 600), statusA: '', statusB: ''
            });
            if (typeof updateTheaterMemoryAsync === 'function') { updateTheaterMemoryAsync(A); updateTheaterMemoryAsync(B); }
        } catch (err) {}
        try { if (typeof window.gyPhoneForgetThreads === 'function') window.gyPhoneForgetThreads(); } catch (err) {}
        if (typeof saveAllData === 'function') saveAllData();
        try {
            const cb = document.getElementById('settingNotifyCharInteraction');
            if (!cb || cb.checked) {
                // 点一下跳去 B 的手机看这段（信 → 信件，电话 → 通话，其余 → 消息）；手机没开就跳「Ta们在做什么」
                const app = kind === 'letter' ? 'mail' : kind === 'call' ? 'calls' : kind === 'moment' ? 'moment' : 'msg';
                const jump = (isOn('phoneOn') && typeof window.gyPhoneOpenApp === 'function') ? { fn: 'gyPhoneOpenApp', args: [String(B.id), app] } : { view: 'theater' };
                if (typeof window.gyNotifyJump === 'function') window.gyNotifyJump(A, '👀 ' + A.name + ' → ' + B.name + '：' + KIND[kind].ico + ' ' + e.summary, e.rel || '', jump);
                else toast('👀 ' + A.name + ' → ' + B.name, KIND[kind].ico + ' ' + e.summary);
            }
        } catch (err) {}
        try {
            const v = document.getElementById('view-theater');
            if (v && v.style.display !== 'none' && typeof renderTheaterPage === 'function') renderTheaterPage();
            if (kind === 'comment' && typeof renderPosts === 'function') renderPosts();
        } catch (err) {}
        return e;
    }

    window.gyPeerRun = async function (charId, opts) {
        const o = Object.assign({ manual: true }, opts || {});
        let c = charId != null ? charOf(charId) : null;
        if (!c) {
            const cand = chars().filter(x => relsOf(x).length);
            if (!cand.length) { toast('📨 角色来往', '关系网上还没有连线的人。先去「关系网」给两个角色连一条线。'); return { blocked: 'norel' }; }
            c = cand[Math.floor(Math.random() * cand.length)];
        }
        const r = await run(c, o);
        if (o.manual && r && r.blocked) {
            const why = { api: '先去设置里填好 API', norel: c.name + ' 在关系网上还没跟谁连过线', busy: '上一次还没弄完', interaction: '「角色之间互动」总开关关着', parse: '模型没按格式回，再试一次' }[r.blocked] || '这次没成（' + r.blocked + '）';
            toast('📨 角色来往', why);
        } else if (o.manual && r && r.none) toast('📨 ' + c.name, '拿起手机看了一圈，谁都没找。');
        return r;
    };

    /* ---------- 给手机看的 ---------- */
    const other = (e, id) => String(e.aId) === String(id) ? { id: e.bId, name: e.bName } : { id: e.aId, name: e.aName };
    const mineOf = id => LOG().filter(e => e && (String(e.aId) === String(id) || String(e.bId) === String(id)));
    // 消息列表里跟某个人那条对话要显示的几句。w：'我' 是手机主人，否则是对方名字
    window.gyPeerBits = function (cId, peerId) {
        const out = [];
        between(cId, peerId).forEach(e => {
            const me = String(e.aId) === String(cId);
            const nm = me ? e.bName : e.aName;
            const sp = x => (x.w === 'a') === me ? '我' : nm;
            const aSide = me ? '我' : nm;
            let t = e.at;
            const push = (w, s) => out.push({ at: t++, w, t: s });
            if (e.kind === 'chat') e.lines.forEach(x => push(sp(x), x.t));
            else if (e.kind === 'letter') push(aSide, `［信］《${e.title}》`);
            else if (e.kind === 'money') { push(aSide, e.failed ? '［转账失败］余额不足' : `［转账］￥${e.amount}${e.note ? ' ' + e.note : ''}`); (e.lines || []).forEach(x => push(sp(x), x.t)); }
            else if (e.kind === 'gift') { push(aSide, `［礼物］${e.item}`); (e.lines || []).forEach(x => push(sp(x), x.t)); }
            else if (e.kind === 'call') push(aSide, `［通话 ${e.minutes} 分钟］`);
            else if (e.kind === 'comment') push(aSide, `［评论了推文］${e.comment}`);
        });
        return out;
    };
    window.gyPeerMails = id => mineOf(id).filter(e => e.kind === 'letter').map(e => ({ at: e.at, out: String(e.aId) === String(id), who: other(e, id).name, title: e.title, body: e.body }));
    window.gyPeerCalls = id => mineOf(id).filter(e => e.kind === 'call').map(e => ({ at: e.at, out: String(e.aId) === String(id), who: other(e, id).name, minutes: e.minutes, summary: e.summary,
        lines: e.lines.map(x => [(x.w === 'a') === (String(e.aId) === String(id)) ? '我' : other(e, id).name, x.t]) }));
    window.gyPeerMoments = id => mineOf(id).filter(e => e.kind === 'moment').map(e => ({ at: e.at, by: e.aName, t: e.moment,
        cm: Array.isArray(e.cm) ? e.cm : e.lines.filter(x => x.w === 'b').map(x => ({ by: e.bName, t: x.t })) }));
    window.gyPeerAll = id => (id == null ? LOG() : mineOf(id)).slice();

    /* ---------- 自主模式：多一个动作 ---------- */
    (function regAct(tries) {
        try {
            if (typeof GY_AUTONOMY_ACTIONS !== 'undefined' && Array.isArray(GY_AUTONOMY_ACTIONS)) {
                if (!GY_AUTONOMY_ACTIONS.some(a => a.key === 'peer')) GY_AUTONOMY_ACTIONS.splice(Math.max(0, GY_AUTONOMY_ACTIONS.length - 1), 0, {
                    key: 'peer', label: '找关系网里认识的人', hint: '用手机：私聊、写信、转账、送东西、打电话、在 TA 推文底下评论、发朋友圈…',
                    need: c => gateOn() && relsOf(c).length > 0,
                    run: async c => { const r = await run(c, { manual: true }); return r && r.entry ? ('找了' + r.entry.bName + '：' + r.entry.summary) : (r && r.none ? '拿起手机又放下了' : null); }
                });
                return;
            }
        } catch (e) {}
        if ((tries || 0) < 20) setTimeout(() => regAct((tries || 0) + 1), 300);
    })(0);

    /* ---------- 后台：隔一阵掷一次 ---------- */
    const autoMode = c => { try { return isOn('charAutonomy') && typeof getCharActMode === 'function' && getCharActMode(c) === 'auto'; } catch (e) { return false; } };
    async function tick() {
        try {
            if (!gateOn()) return;
            const rate = RATES[CFG.rate] || RATES.mid;
            if (!rate.p || Math.random() > rate.p) return;
            if (typeof isGenerating !== 'undefined' && isGenerating) return;
            if (typeof isInQuietHours === 'function' && isInQuietHours()) return;
            // 自主模式的角色按自己的习惯（走上面那个动作），这里只管其余的
            const cand = chars().filter(c => !autoMode(c) && relsOf(c).length);
            if (!cand.length) return;
            await run(cand[Math.floor(Math.random() * cand.length)], {});
        } catch (e) {}
    }
    if (!window.__gyPeerTimer) window.__gyPeerTimer = setInterval(tick, 10 * 60000);
    window.__gyPeerTick = tick;   // 测试用

    /* ---------- 「Ta们在做什么」页顶上的一条控制栏 ---------- */
    window.gyPeerSetRate = function (v) { if (RATES[v]) { CFG.rate = v; saveCfg(); } };
    window.gyPeerRate = () => CFG.rate;
    function bar() {
        const n = LOG().length;
        const off = !gateOn();
        return `<div class="gype-bar">
            <div class="gype-h">📨 角色之间的来往<span>${n ? '一共 ' + n + ' 次，都存在各自的手机里' : '还没有过'}</span></div>
            <div class="gype-row">
              <select onchange="gyPeerSetRate(this.value)" title="后台多久发生一次（自主模式的角色按自己的习惯）">
                ${Object.entries(RATES).map(([k, v]) => `<option value="${k}"${CFG.rate === k ? ' selected' : ''}>${esc(v.t)}</option>`).join('')}
              </select>
              <button type="button" onclick="gyPeerRunBtn(this)">📨 现在让谁找个人</button>
            </div>
            ${off ? `<div class="gype-off">${isOn('charTheater') ? '「角色之间自己来往」关着' : '小剧场关着'}，不会自己发生；点上面的按钮照样能来一次。</div>` : ''}
        </div>`;
    }
    window.gyPeerRunBtn = async function (btn) {
        const old = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = '在想找谁…'; }
        try { await window.gyPeerRun(null, { manual: true }); } finally { if (btn) { btn.disabled = false; btn.textContent = old; } }
        try { if (typeof renderTheaterPage === 'function') renderTheaterPage(); } catch (e) {}
    };
    function hookTheater() {
        const r0 = window.renderTheaterPage;
        if (typeof r0 !== 'function' || r0.__gype) return false;
        window.renderTheaterPage = function () {
            const r = r0.apply(this, arguments);
            try {
                const list = document.getElementById('theaterLogList');
                if (list && !list.querySelector('.gype-bar')) list.insertAdjacentHTML('afterbegin', bar());
            } catch (e) {}
            return r;
        };
        window.renderTheaterPage.__gype = true;
        return true;
    }
    (function tryHook(n) { if (!hookTheater() && n < 20) setTimeout(() => tryHook(n + 1), 300); })(0);

    try {
        const st = document.createElement('style');
        st.textContent = `
.gype-bar{margin:0 0 14px;padding:12px 14px;border-radius:14px;border:1px solid rgba(139,152,165,.35);background:rgba(29,155,240,.04);}
.gype-h{font-weight:700;font-size:14px;}
.gype-h span{font-weight:400;font-size:12px;color:#8b98a5;margin-left:8px;}
.gype-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}
.gype-row select{flex:1;min-width:180px;padding:7px 10px;border-radius:10px;border:1px solid rgba(139,152,165,.5);background:transparent;color:inherit;font-size:13px;}
.gype-row button{width:auto;margin:0;padding:7px 14px;border-radius:999px;border:none;background:var(--gy-accent,#1d9bf0);color:#fff;font-size:13px;cursor:pointer;}
.gype-row button:disabled{opacity:.6;}
.gype-off{font-size:12px;color:#8b98a5;margin-top:8px;line-height:1.6;}
`;
        document.head.appendChild(st);
    } catch (e) {}
})();
