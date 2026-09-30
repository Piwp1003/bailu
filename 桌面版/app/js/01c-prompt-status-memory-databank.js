// ✂️ 这个文件是从 01-core-state-infra.js 拆出来的第 3 段（原来一个文件太大，改起来容易改坏）。
// 跟 01-core-state-infra.js 以及同一组的其它段共用一个全局作用域，index.html 里的加载顺序不能换。
function gyPromptBudget() {
    try { const v = localStorage.getItem(GY_PB_KEY); if (v !== null && v !== '') return gyNum(v, 6000); } catch (e) {}
    return 6000;
}
function gyPromptBudgetSet(v) { try { localStorage.setItem(GY_PB_KEY, String(gyNum(v, 6000))); } catch (e) {} }
const GY_REF_CAP = 1500;
let __gyLastPromptReport = null;
function gyPromptAssemble(sections, char) {
    try {
        const budget = gyPromptBudget();
        const refs = sections.filter(x => x.pri !== 'keep');
        const refTotal0 = refs.reduce((a, x) => a + x.t.length, 0);
        const report = { char: char && char.name, budget, before: refTotal0, cut: [], dropped: [], at: Date.now(),
                         sizes: sections.map(x => ({ k: x.k, n: x.t.length, keep: x.pri === 'keep', pri: x.pri })) };
        if (budget > 0 && refTotal0 > budget) {
            // ① 每段截短：留开头（标题和说明）+ 留结尾（总结、归档这类都是越往后越新），中间较早的略过
            refs.forEach(x => {
                if (x.t.length > GY_REF_CAP) { report.cut.push(x.k); x.t = x.t.slice(0, 200) + '\n（……中间较早的略过）\n' + x.t.slice(-(GY_REF_CAP - 200)); }
            });
            // ② 还超：从最不要紧的开始整段拿掉
            let total = refs.reduce((a, x) => a + x.t.length, 0);
            const order = refs.slice().sort((a, b) => b.pri - a.pri);
            for (const x of order) {
                if (total <= budget) break;
                total -= x.t.length; report.dropped.push(x.k); x.t = '';
            }
            report.after = total;
        } else report.after = refTotal0;
        report.keepTotal = sections.filter(x => x.pri === 'keep').reduce((a, x) => a + x.t.length, 0);
        __gyLastPromptReport = report;
        return sections.map(x => x.t).join('');
    } catch (e) { return sections.map(x => x.t).join(''); }
}
const GY_SEC_NAMES = { humanFeel: '人味强化协议', tpes: '时间感知', persona: '人设', greet: '这一局的开场', user: '用户是谁',
    voice: '打字指纹', 'mem.tweet': '推文记忆总结', 'mem.chat': '聊天总结', 'mem.group': '群聊话题', schedule: '日程与生活轨迹',
    theater: '小剧场', letters: '通过的信', diary: '自己写过的日记', anniv: '纪念日', reading: '一起读过的书', film: '一起看过的电影',
    box: '各小功能注入', profile: '资料页', faction: '势力', relation: '人物关系', mood: '情绪', body: '身体状态',
    plugin: '插件规则', pluginHook: '插件脚本', fmt: '格式规则', anchor: '身份提醒' };
function gyPromptReportText() {
    const r = __gyLastPromptReport;
    if (!r) return '还没有生成过内容。先跟某个角色聊一句，再回来看。';
    const nm = k => GY_SEC_NAMES[k] || (k.startsWith('wb.') ? '世界书（' + k.slice(3) + '）' : k.startsWith('preset.') ? '预设（' + k.slice(7) + '）' : k);
    const rows = r.sizes.filter(x => x.n > 0).map(x => `${x.keep ? '🔒' : '📎'} ${nm(x.k)}：${x.n} 字${r.dropped.includes(x.k) ? '　→ 这次拿掉了' : r.cut.includes(x.k) ? '　→ 截短了' : ''}`);
    return `最近一次（${r.char || ''}）：\n骨架 🔒 ${r.keepTotal} 字（人设/世界书/预设/关系/格式，永远保留）\n参考资料 📎 ${r.before} 字 → 实际带上 ${r.after} 字（上限 ${r.budget > 0 ? r.budget : '不限'}）\n\n${rows.join('\n')}\n\n` +
        (r.keepTotal > 12000 ? '⚠️ 骨架本身就很长（多半是世界书/预设），这部分不会被自动裁——可以去「注入内容管理」或世界书里关掉用不上的条目。' : '');
}

// 🪪 身份提醒：角色一多，最常见的错是"把别人的推文当成用户发的""把自己当成别人""跟不认识的人很熟"
function gyIdentityAnchor(char) {
    try {
        if (!char) return '';
        const me = (typeof userDisplayName === 'function') ? userDisplayName(char) : '用户';
        return `\n【🪪 身份提醒】你是"${char.name}"，只是你自己。"用户"指的是${me}——屏幕前直接跟你互动的那个人。
推文、评论、帖子、礼物、消息是谁发的、谁送的，一律以写明的发布者为准：没写明是${me}的，就不是${me}；别人的东西不要当成自己的，也不要当成${me}的。\n`;
    } catch (e) { return ''; }
}

// 两个人能不能有往来（用户永远可以）。互动总开关关着的时候，角色和角色之间一律不往来；
// needRelation：还要求关系网里真有这条线（送礼这种事，陌生人之间不会发生）
function gyCharsMayInteract(aId, bId, needRelation) {
    try {
        if (String(aId) === 'me' || String(bId) === 'me' || String(aId) === String(bId)) return true;
        const on = (typeof isGlobalCharInteractionEnabled === 'function') ? isGlobalCharInteractionEnabled() : true;
        if (!on) return false;
        if (!needRelation) return true;
        return (typeof charRelationships !== 'undefined' ? charRelationships : []).some(r =>
            (String(r.fromId) === String(aId) && String(r.toId) === String(bId)) || (String(r.fromId) === String(bId) && String(r.toId) === String(aId)));
    } catch (e) { return false; }
}

// ===================== 🟢 状态流水：TA 一天里的每一次状态 =====================
function gyStatusLogTrim(char) {
    try {
        if (!char || !Array.isArray(char.statusLog)) return;
        const days = gyNum(statusLogKeepDays, 60);
        if (days > 0) {
            const cut = Date.now() - days * 86400000;
            while (char.statusLog.length && char.statusLog[0].at < cut) char.statusLog.shift();
        }
    } catch (e) {}
}
// 聊天里状态栏每更新一次、日程/自主模式/说到做到换一次"此刻在做什么"，都记一笔，
// 角色日历点开某一天就能翻那天所有的状态（收成卡片）。保留几天用户自己定（statusLogKeepDays，记忆总览里改）。
// 保留天数在 记忆总览 →「🟢 状态记录保留几天」里改；填 0 ＝ 一直留着
let statusLogKeepDays = 60;
function gyStatusLogAdd(char, entry) {
    try {
        if (!char || !entry) return;
        if (!Array.isArray(char.statusLog)) char.statusLog = [];
        const e = Object.assign({ at: Date.now() }, entry);
        const last = char.statusLog[char.statusLog.length - 1];
        // 同一段内容连着来两次（重生成、流式补发）只记一次
        if (last && (last.seg || '') === (e.seg || '') && (last.activity || '') === (e.activity || '') && e.at - last.at < 10 * 60000) return;
        char.statusLog.push(e);
        gyStatusLogTrim(char);
    } catch (e) {}
}

// 🕰️ 现在几点：钉在聊天 prompt 最后。新导入的角色卡开场白、上一条的状态栏里常写着"凌晨两点"，
// 模型会顺着那个时间往下演，大白天还在说"这么晚了快睡吧"。这里明确告诉它那些都是过去的时间。
function gyNowAnchorNote() {
    try {
        const d = new Date();
        const s = d.toLocaleString('zh-CN', { hour12: false, weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const h = d.getHours();
        const part = h < 5 ? '深夜' : h < 9 ? '早上' : h < 12 ? '上午' : h < 14 ? '中午' : h < 18 ? '下午' : h < 22 ? '晚上' : '深夜';
        return `\n【🕰️ 现在的真实时间】：${s}（${part}）。开场白、聊天记录、上一条状态栏里写的时间都是**过去**的，不代表现在；你此刻的作息、在做的事、状态栏里的时间，一律按现在这个真实时间来，不要接着上一条的时间往下写（只有你们此刻正在当面相处、剧情里的时间在往前推的时候，才按剧情里推进到的时间来）。\n`;
    } catch (e) { return ''; }
}

// ===================== 🧹 没有标签的思考（"好的，我来梳理一下……"）=====================
// DeepSeek 这类模型被预设要求"先想再答"、又没走 reasoning_content 通道时，会把思考直接写在正文前面，
// 不带任何标签。实际见过的两种：
//   · 推文：第一段是"好的，我来梳理一下这个爆料推文的创作要点……"，空一行才是正文；
//   · 评论：思考和回复糊成一整段——"好的，林发了条动态……我的回应要直接……说完就走。本事不小，敢发这种话。"
// 判断刻意保守：必须**以"好的/嗯/OK"这类开场白开头**，并且开头一小段里至少两处"在分析任务"的词
// （人设/回应/语气/字数/她这是……）。正常说话几乎不会同时满足，所以不会误删正文。
const GY_THINK_OPENER_RE = /^\s*(?:好的|好|嗯+|OK|Okay|行|明白了?|收到|我来|让我)[，,。！!：:\s]/i;
const GY_THINK_META_RE = /她这是|她[是在想要]|用户|推文|动态|人设|设定|回应|我需要|需要|语气|字数|创作|要点|梳理|分析|考虑|反应|表现|把握|输出|素材|角色|关键点|首先|其次|现在是.{0,20}[点时]|时间显示|说完就|留点空间/g;
const GY_THINK_SENT_META_RE = /她|用户|推文|动态|人设|设定|回应|我需要|需要|语气|字数|创作|要点|梳理|分析|考虑|反应|表现|把握|输出|素材|角色|关键点|说完就|留点空间|时间显示/;
function gyMetaHits(s) { const m = String(s || '').match(GY_THINK_META_RE); return m ? m.length : 0; }
// 返回 {rest, thinking}；判断不是这种情况就返回 null（调用方原样用原文）
function gySplitUntaggedThinking(text) {
    try {
        if (!text || typeof text !== 'string') return null;
        const src = text.trim();
        if (!GY_THINK_OPENER_RE.test(src)) return null;
        if (gyMetaHits(src.slice(0, 160)) < 2) return null;
        // ① 分了段的：从头往后扔掉"像在分析"的段落，剩下的是正文
        const tryBlocks = (blocks, joiner) => {
            if (blocks.length < 2) return null;
            let k = 0;
            while (k < blocks.length - 1 && (k === 0 || gyMetaHits(blocks[k]) >= 2)) k++;
            const rest = blocks.slice(k).join(joiner).trim();
            if (!rest) return null;
            return { rest, thinking: blocks.slice(0, k).join(joiner).trim() };
        };
        const paras = src.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
        let r = tryBlocks(paras, '\n\n');
        if (r) return r;
        const lines = src.split(/\n/).map(x => x.trim()).filter(Boolean);
        r = tryBlocks(lines, '\n');
        if (r) return r;
        // ② 糊成一整段的：从最后一句往前收，碰到第一句"在分析"的就停——后面收到的就是真正要说的话
        const sents = src.match(/[^。！？!?…\n]+[。！？!?…」”"』）)]*\s*/g) || [src];
        let cut = sents.length;
        while (cut > 0 && !GY_THINK_SENT_META_RE.test(sents[cut - 1])) cut--;
        if (cut <= 0 || cut >= sents.length) return null;
        const rest = sents.slice(cut).join('').trim();
        if (rest.replace(/[\s。！？!?…，,]/g, '').length < 2) return null;
        return { rest, thinking: sents.slice(0, cut).join('').trim() };
    } catch (e) { return null; }
}

// 渲染侧兜底（推文/评论/营销号）：存档里已经带着思考的**旧内容**（修好之前生成的）打开就干净。
// 只认成对的思考标签（<think> 一类、不含 <details>）和上面那种开场白式的无标签思考。
// 收纳盒开着时，摘下来的不扔，在正文上方给一个很小的可折叠 💭。
function gyPeelReasoningForDisplay(text) {
    const out = { rest: text, html: '' };
    try {
        if (!text || typeof text !== 'string') return out;
        const parts = [];
        let t = text;
        const tags = ['think', 'thinking', 'reasoning', 'thought', 'custom_think', 'SECRET'];
        tags.forEach(tag => {
            t = t.replace(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'), (m0, inner) => { if (inner.trim()) parts.push(inner.trim()); return ''; });
        });
        if (parts.length && !t.trim()) return out;   // 全删光了说明判断错了，原样显示
        const u = gySplitUntaggedThinking(t);
        if (u) { parts.push(u.thinking); t = u.rest; }
        if (!parts.length) return out;
        out.rest = t.replace(/^\s+/, '');
        if (typeof reasoningVaultOn !== 'undefined' && reasoningVaultOn) {
            out.html = `<details class="gyrv-inline" onclick="event.stopPropagation()"><summary>💭</summary><div class="gyrv-inline-body">${escapeHtml(parts.join('\n\n―――――\n\n'))}</div></details>`;
        }
    } catch (e) { return { rest: text, html: '' }; }
    return out;
}

// ===================== 📊 聊天气泡里的状态栏 =====================
// 常见写法：[STATUS_START][TIME]…[/TIME][LOCATION]…[/LOCATION]…[STATUS_END]，
// 也有 <status>…</status> / <状态栏>…</状态栏>。只在显示时摘，不改存档。
const GY_CHAT_STATUS_LABELS = {
    TIME: '时间', DATE: '日期', LOCATION: '地点', PLACE: '地点', WEATHER: '天气', VOICE: '心声', INNER: '心声', THOUGHT: '心声',
    MOOD: '心情', EMOTION: '情绪', OUTFIT: '穿着', CLOTHES: '穿着', ACTION: '在做', ACTIVITY: '在做', BILL: '账单', MONEY: '钱包',
    PHONE_NOTIF: '手机通知', PHONE_SAFARI: '搜索记录', PHONE_SEARCH: '搜索记录', PHONE_MEMO: '备忘录', PHONE_MUSIC: '在听',
    HEART: '心跳', AFFECTION: '好感', FAVOR: '好感', BODY: '身体', STATE: '状态'
};
// 找出一段文字里的"状态栏"那一截（只读，不改原文）。优先认**角色卡自己带的状态栏正则**——
// 每张卡的格式都不一样（<baixinghe_status> 时间:"…"、<jsy_status>[DateTime|…]、<闻述状态>地点：…），
// 靠写死几种通用格式是认不全的，但卡片作者自己写的那条正则一定认得出自己的格式。
// 认不出再退回通用写法：<xxx_status>…</xxx_status>、<xxx状态>…</xxx状态>、[XXX_START]…[XXX_END]。
function gyFindStatusSegment(text, charId) {
    if (!text || typeof text !== 'string') return null;
    const hits = [];
    try {
        for (const sc of (regexScripts || [])) {
            if (!sc || sc.enabled === false || !sc.isRegex || !sc.find || sc.promptOnly) continue;
            if (!regexScriptMatchesChar(sc, charId)) continue;
            const named = /状态|status/i.test(sc.name || '');
            const scoped = Array.isArray(sc.charScope) && sc.charScope.length > 0;
            if (!named || (!scoped && !sc.displayOnly)) continue;
            const lit = parseRegexLiteral(sc.find);
            let re;
            try { re = new RegExp(lit.pattern, String(sc.flags || lit.flags || '').replace(/g/g, '')); } catch (e) { continue; }
            const m = re.exec(text);
            if (m && m[0].length >= 12 && !hits.some(h => m.index < h.end && m.index + m[0].length > h.start)) hits.push({ start: m.index, end: m.index + m[0].length, seg: m[0] });
        }
        // 一张卡可能有好几块状态栏（上面一块、下面一块），都收进来
        if (hits.length) {
            hits.sort((a, b) => a.start - b.start);
            return { start: hits[0].start, end: hits[0].end, seg: hits.map(h => h.seg).join('\n'), viaCard: true, all: hits };
        }
    } catch (e) { /* 卡片正则写坏了就走通用识别 */ }
    const tagName = '([A-Za-z_]*[Ss]tatus[A-Za-z_]*|[\\u4e00-\\u9fa5A-Za-z]{0,10}状态栏?)';
    let m = text.match(new RegExp('<' + tagName + '>[\\s\\S]*?<\\/\\1>'));
    if (!m) m = text.match(/\[([A-Z][A-Z0-9]{1,20})_START\][\s\S]*?(?:\[\1_END\]|$)/);
    // 被截断、只有开标签的：从开标签一直到末尾都算
    if (!m) m = text.match(new RegExp('<' + tagName + '>[\\s\\S]*$'));
    if (m) return { start: m.index, end: m.index + m[0].length, seg: m[0], viaCard: false };
    return null;
}
function gyExtractChatStatus(text, charId) {
    const res = { rest: text, rows: [], raw: '', seg: '', viaCard: false };
    try {
        if (!text || typeof text !== 'string') return res;
        const f = gyFindStatusSegment(text, charId);
        if (!f) return res;
        res.seg = f.seg; res.viaCard = f.viaCard;
        if (f.all && f.all.length > 1) {
            let r = text; f.all.slice().sort((a, b) => b.start - a.start).forEach(h => { r = r.slice(0, h.start) + r.slice(h.end); });
            res.rest = r.replace(/\n{3,}/g, '\n\n').trim();
        } else res.rest = (text.slice(0, f.start) + text.slice(f.end)).replace(/\n{3,}/g, '\n\n').trim();
        let inner = f.seg.replace(/^<[^>]+>|<\/[^>]+>$/g, '').replace(/^\[[A-Z0-9]+_START\]|\[[A-Z0-9]+_END\]$/g, '');
        res.raw = inner.trim() || f.seg;
        // 通用卡片用的字段：[KEY]值[/KEY] / [Key|值|值] / 键：值 / 键:"值"
        let r;
        const re1 = /\[([A-Za-z][A-Za-z0-9_]{0,24})\]([\s\S]*?)\[\/\1\]/g;
        while ((r = re1.exec(inner))) { const v = r[2].trim(); if (v) res.rows.push({ k: GY_CHAT_STATUS_LABELS[r[1].toUpperCase()] || r[1], v }); }
        if (!res.rows.length) {
            const re2 = /\[([A-Za-z][A-Za-z0-9_]{0,24})\|([^\]]*)\]/g;
            while ((r = re2.exec(inner))) { const v = r[2].split('|').map(x => x.trim()).filter(Boolean).join(' · '); if (v) res.rows.push({ k: GY_CHAT_STATUS_LABELS[r[1].toUpperCase()] || r[1], v }); }
        }
        if (!res.rows.length) {
            inner.split('\n').map(x => x.trim()).filter(Boolean).forEach(line => {
                const kv = line.match(/^([^：:]{1,12})[：:]\s*(.+)$/);
                const v = kv ? kv[2].replace(/^["“]|["”]$/g, '') : line;
                if (v && v !== '|') res.rows.push(kv ? { k: kv[1], v } : { k: '', v });
            });
        }
    } catch (e) { return { rest: text, rows: [], raw: '', seg: '', viaCard: false }; }
    return res;
}
// 状态栏卡片：角色卡自己带了状态栏正则的，就用**卡片作者设计的那张**（跟推文/日记里同一套渲染，
// 完整 HTML 页面会进 iframe）；没有的用白露自己的通用小卡。都收在一个可折叠框里，最新一条默认展开。
function gyChatStatusBlockHtml(st, charId, depth, openIt, keyForIds) {
    if (!st || !st.seg) return '';
    let inner = '';
    // 跟推文里同一套渲染：卡片自带的显示正则 + 项目自己的状态卡（蓝框那种）。渲染出东西了就用它
    if (typeof renderMarkdownLite === 'function') {
        try {
            let h = renderMarkdownLite(st.seg, charId, depth, { statusContext: 'chat' });
            if (typeof namespaceInjectedIds === 'function') h = namespaceInjectedIds(h, keyForIds || ('cs' + depth));
            const made = h && (/class="ai-status-(block|chip)/.test(h) || (st.viaCard && h.indexOf(st.seg.slice(0, 20)) === -1)
                || /<(div|table|section|details|ul|img|svg)\b/i.test(h.replace(/<br\s*\/?>/gi, '')));
            if (made) inner = `<div class="gy-chat-status-card">${h}</div>`;
        } catch (e) { inner = ''; }
    }
    if (!inner && !st.rows.length) {
        // 认不出字段：把那一截原样（去掉标签）放进去，总比什么都不显示强
        const plain = String(st.raw || st.seg || '').replace(/<[^>]+>/g, ' ').replace(/\[\/?[A-Za-z0-9_]+\]/g, ' ').replace(/[ \t]+/g, ' ').trim();
        if (!plain) return '';
        inner = `<div class="gy-chat-status-body"><div class="gy-cs-row"><span>${escapeHtml(plain.slice(0, 1200)).replace(/\n/g, '<br>')}</span></div></div>`;
    }
    if (!inner) {
        inner = `<div class="gy-chat-status-body">${st.rows.map(r => `<div class="gy-cs-row">${r.k ? `<b>${escapeHtml(r.k)}</b>` : ''}<span>${escapeHtml(r.v).replace(/\n/g, '<br>')}</span></div>`).join('')}</div>`;
    }
    const first = st.rows.find(r => /时间|日期|地点|Date|Time|Location/i.test(r.k));
    // 折叠时那一行：优先从状态栏原文里找个"日期/时间"，找不到再用第一个时间/地点字段
    let sum = '';
    try {
        const plain = String(st.seg || '').replace(/<[^>]*>/g, ' ').replace(/\[[A-Za-z_]+\|/g, ' ').replace(/[|\]]/g, ' ');
        const tm = plain.match(/(\d{4}\s*[-/.年]\s*\d{1,2}\s*[-/.月]\s*\d{1,2}\s*日?)?\s*((?:星期|周)[一二三四五六日天])?\s*(?:[上下]午|凌晨|傍晚|晚上|深夜)?\s*\d{1,2}\s*[:：.]\s*\d{2}/);
        if (tm && tm[0].trim().length >= 4) sum = escapeHtml(tm[0].replace(/\s+/g, ' ').trim().slice(0, 36));
    } catch (e) {}
    if (!sum && first) sum = escapeHtml(String(first.v).replace(/<[^>]*>?/g, '').trim().slice(0, 36));
    if (!sum) sum = '状态栏';
    const wide = inner.indexOf('gy-chat-status-card') !== -1 ? ' with-card' : '';
    // 默认收着，点了才展开（用户要求）；展开过的记住，重画不会又合上
    const __k = 'gyst_' + (keyForIds || depth);
    const __open = !!(window.__gyStOpen && window.__gyStOpen[__k]);
    return `<details class="gy-chat-status${wide}"${__open ? ' open' : ''} ontoggle="(window.__gyStOpen=window.__gyStOpen||{})['${__k}']=this.open" onclick="event.stopPropagation()"><summary>📊 ${sum}</summary>${inner}</details>`;
}
function gyChatStatusCardHtml(rows) {
    if (!rows || !rows.length) return '';
    const first = rows.find(r => /时间|地点/.test(r.k));
    const sum = first ? escapeHtml(first.v).slice(0, 40) : '状态';
    return `<details class="gy-chat-status" onclick="event.stopPropagation()"><summary>📊 ${sum}</summary><div class="gy-chat-status-body">${
        rows.map(r => `<div class="gy-cs-row">${r.k ? `<b>${escapeHtml(r.k)}</b>` : ''}<span>${escapeHtml(r.v).replace(/\n/g, '<br>')}</span></div>`).join('')
    }</div></details>`;
}

// ===================== 💭 思维链收纳盒（总开关）=====================
// 关（默认）= 跟以前一模一样：各处照旧剥掉，什么都不留。
// 开 = 各处照旧剥掉（正文、状态栏、JSON 解析一律不受影响），但剥下来的那段**不扔**，
//      连同"是哪个功能、什么时候、哪个模型"一起收进收纳盒（js/51 负责存和看）。
//      聊天气泡另外挂一个很小的 💭，点开直接看这一轮的思考。
// ⚠️ 收纳盒只"旁观"，永远不改任何函数的返回值——所以开和关对生成结果本身零影响。
let reasoningVaultOn = false;
const GY_VAULT_GENERIC_TAGS = ['think', 'thinking', 'reasoning', 'thought', 'reason', 'custom_think'];
// 从一段原始模型输出里把"会被剥掉的那些思考"全捞出来（只读，不改原文）
function gyCollectReasoning(text) {
    const out = [];
    if (!text || typeof text !== 'string') return out;
    const push = (x) => { x = String(x || '').trim(); if (x && !out.includes(x)) out.push(x); };
    let rest = text;
    try {
        // ① 开头的思维链块（包括 <details> 这种只在开头才算的格式）
        const lead = stripLeadingReasoningBlocks(rest);
        if (lead && lead.collapsedBlocks && lead.collapsedBlocks.length) {
            lead.collapsedBlocks.forEach(b => push(b.reasoning));
            rest = lead.rest;
        }
        // ② 任意位置的成对标签：用户配置的格式 + 常见的通用标签名
        const pairs = [];
        (reasoningFormats || []).forEach(fmt => {
            if (fmt.enabled === false || !fmt.prefix || !fmt.suffix) return;
            // 用户自己加的格式也算；只有 <details> 例外——角色卡常拿它做折叠面板，不能当思考收
            if (fmt.name === 'details/summary' || /^<details/i.test(fmt.prefix)) return;
            pairs.push([escapeRegExpLiteral(fmt.prefix), escapeRegExpLiteral(fmt.suffix)]);
        });
        GY_VAULT_GENERIC_TAGS.forEach(tag => pairs.push([`<${tag}\\b[^>]*>`, `</${tag}>`]));
        pairs.forEach(([pre, suf]) => {
            try {
                const re = new RegExp(pre + '([\\s\\S]*?)' + suf, 'gi');
                rest = rest.replace(re, (m0, inner) => { push(inner); return ''; });
            } catch (e) { /* 拼不出合法正则就跳过 */ }
        });
        // ③ 只有开标签、没闭合（被 max_tokens 截断 / 模型忘了闭）：开标签后面那一截
        const open = /<(think|thinking|reasoning|thought|reason|custom_think)\b[^>]*>/i.exec(rest);
        if (open) push(rest.slice(open.index + open[0].length));
        // ④ 没有标签、靠"正式输出标记"分界的：标记前面那一大段
        const mk = rest.lastIndexOf(FINAL_ANSWER_MARKER);
        if (mk > 0) push(rest.slice(0, mk));
        // ⑤ 没标签也没标记、以"好的，我来梳理一下……"开头的
        else { const u = gySplitUntaggedThinking(rest); if (u) push(u.thinking); }
        // ⑥ 要求输出 JSON 的（聊天、群聊…）：JSON 前面那一大段没标签的文字就是思考
        //    （状态栏那一截不算）
        const js = rest.search(/\{\s*"(replies|reply|messages|text|posts|comments|stateUpdate)"/);
        if (js > 0) {
            let pre = rest.slice(0, js);
            try { const sf = gyFindStatusSegment(pre, undefined); if (sf) pre = pre.slice(0, sf.start) + pre.slice(sf.end); } catch (e) {}
            pre = pre.replace(/```(?:json)?\s*$/i, '').trim();
            if (pre.replace(/\s/g, '').length >= 30) push(pre);
        }
    } catch (e) { console.warn('[思维链收纳盒] 识别出错（不影响正常使用）：', e); }
    return out;
}
// 交给 js/51 存起来；js/51 还没加载好时先排队
function gyVaultCapture(parts, feature, reqKey, model, via) {
    try {
        if (!reasoningVaultOn || !parts || !parts.length) return;
        const rec = { t: Date.now(), feature: feature || '其它', key: reqKey || '', model: model || '', via: via || '', text: parts.join('\n\n―――――\n\n') };
        if (typeof window.gyReasoningVaultSink === 'function') window.gyReasoningVaultSink(rec);
        else (window.__gyVaultPending = window.__gyVaultPending || []).push(rec);
    } catch (e) { /* 收纳失败绝不能影响生成 */ }
}
function gyVaultCaptureFromData(data, feature, api, via) {
    try {
        if (!reasoningVaultOn || !data || data.error) return;
        const c = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (typeof c !== 'string' || !c) return;
        const parts = gyCollectReasoning(c);
        gyVaultDiag(feature, c, parts, api, via || '普通');
        gyVaultCapture(parts, feature, api && api.__gyReqKey, api && api.model, via);
    } catch (e) {}
}
// 🩺 体检记录：最近 20 次请求"模型到底吐了什么、认出思考没有、有没有状态栏"——收纳盒里能看
function gyVaultDiag(feature, raw, parts, api, via) {
    try {
        const L = window.__gyVaultDiag = window.__gyVaultDiag || (JSON.parse(localStorage.getItem('gy_vault_diag') || '[]') || []);
        let st = false; try { st = !!gyFindStatusSegment(String(raw || ''), undefined); } catch (e) {}
        L.unshift({ t: Date.now(), f: feature || '其它', m: (api && api.model) || '', via: via || '', n: (parts || []).length,
            len: String(raw || '').length, st, head: String(raw || '').slice(0, 260), tail: String(raw || '').length > 260 ? String(raw).slice(-200) : '' });
        L.length = Math.min(L.length, 20);
        localStorage.setItem('gy_vault_diag', JSON.stringify(L));
    } catch (e) {}
}
// 给某一次请求打个"取件码"：聊天气泡上的 💭 靠它找到自己那一轮的思考
function gyVaultTagApi(api) {
    if (!reasoningVaultOn || !api) return api;
    return Object.assign({}, api, { __gyReqKey: 'rq' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) });
}

// 🐛 修复"评论/回帖里混入一整段思考过程"：部分模型（尤其没有走标准reasoning_content通道、只是被prompt
// 要求"想清楚再回答"的模型）会把整段思考过程原样写在最终回复前面，不带任何<think>之类的标签——这种情况
// stripLeadingReasoningBlocks 认不出来（它靠配置好的前后缀标签匹配），思考过程就会原样变成"回复正文"。
// 经验规律：这类文本里，模型思考完之后给出的真正答案几乎总是全文最后一段（往往就是一两句话），
// 前面大段的分析/草稿都在这段之前。这里只在明显超出预期字数（超过expectedMaxLen的2.5倍）时才生效，
// 退化成"只取最后一段"、把前面的思考过程扔掉；长度正常的普通回复完全不受影响，避免误伤。
// 🐛 "[QUOTE:12] 原样出现在聊天气泡里" 的兜底。
//
// [QUOTE:N] / [MOVETOCHAT] / [NUDGE] / [EMO:xxx] 这几个方括号标记是**给代码看的暗号**，
// 各自的解析逻辑在前面都跑过了。能活到这一步的都是没被认出来的漏网之鱼，常见两种：
//   1. 模型把标记写在了句子**末尾**而不是开头（prompt里写了"加在最前面"也拦不住它）；
//   2. 预设/角色卡教了它一个当前场景根本没启用的标记（比如1v1聊天里写 [MOVETOCHAT]）。
// 不管哪种，原样显示给用户看都是"内部实现漏出来了"，跟那坨 ```json 是同一类事故。
//
// ⚠️ 这个函数只跑在 **AI 输出** 的清洗链路上，永远不碰用户自己打的字——
// 用户真想在消息里打 "[QUOTE:1]" 这几个字符，那是他的自由，不该被吃掉。
// 也刻意**没有**清理 [回复N]：论坛体/楼层小说的正文里本来就可能出现这种写法，
// 那是内容不是标记，只有评论区那条解析路径知道该不该处理它。
function stripLeftoverMarkers(text) {
    if (!text || typeof text !== 'string') return text;
    let t = text
        .replace(/\[\s*QUOTE\s*:\s*\d+\s*\]/ig, '')
        .replace(/\[\s*MOVETOCHAT\s*\]/ig, '')
        .replace(/\[\s*NUDGE\s*\]/ig, '')
        .replace(/\[\s*EMO\s*:\s*emo_[\w-]+\s*\]/ig, '')
        .replace(/\[\s*ACT\s*[:：][^\]]*\]/ig, '');   // 💬 js/52 的行动标记：已经执行过的/没认出来的都不许露出来
    if (t === text) return text;
    // 只收拾标记留下的多余空格，不动正文本身的换行结构
    return t.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
}

// ⚠️ 别图省事把 stripLeftoverMarkers 塞进这个函数里当"公共清洗"。试过，会出事：
// 评论区那几条路径是**先**调这个函数、**后**才解析 [MOVETOCHAT] 和 [EMO:xxx] 的
// （见 js/09 和 js/10），标记在这里就被清掉的话，转私聊和表情包会直接失效——
// 而且是那种"功能没报错，只是再也不触发了"的哑火，最难发现。
// 标记的清理必须放在**各自解析完之后**，谁解析谁负责。
function stripUndelimitedReasoningIfOverLength(text, expectedMaxLen) {
    if (!text) return text;
    // 优先用"正式输出标记"精确切割（如果模型遵循了prompt里的要求），比长度启发式准得多。
    const marked = extractAfterFinalMarker(text);
    if (marked !== text) return marked.trim();

    // 🐛 修复"评论/推文里思维链跑出来"：这个函数原本只有一条"太长就取最后一段"的长度启发式，
    // 完全没走项目里那套成熟的思维链格式识别（<think>/<thinking>/<details>/SECRET 等）。
    // 于是模型只要用了这些标准写法，或者把整段思考写成**一整段不分段**的文字，
    // 就会原封不动地糊在评论区里（一整段的情况连"取最后一段"都救不了，因为只有一段）。
    // 这里先按已知格式精确剥一遍，再落到长度启发式兜底。
    let pre = String(text);
    if (typeof stripPairedReasoningAnywhere === 'function') {
        try { pre = stripPairedReasoningAnywhere(pre); } catch (e) { /* 剥离失败就用原文 */ }
    }
    if (typeof stripLeadingReasoningBlocks === 'function') {
        try {
            const r = stripLeadingReasoningBlocks(pre);
            // stripLeadingReasoningBlocks 在不同版本里可能返回字符串或 {text,...}，两种都兼容
            const got = (typeof r === 'string') ? r : (r && typeof r.text === 'string' ? r.text : null);
            if (got !== null && got.trim()) pre = got;
        } catch (e) { /* 同上 */ }
    }
    // 以"好的，……"开头、思考和回复糊在一起的（不管长短都查，判断本身很保守）
    {
        const u = gySplitUntaggedThinking(pre);
        if (u && u.rest) {
            if (reasoningVaultOn) gyVaultCapture([u.thinking], gyDetectFeature(), '', '', '无标签');
            return u.rest.trim();
        }
    }
    // 常见的"没有闭合标签"的中文思考开场：思考过程：/分析：/我的思路：…… 后面跟一大段，
    // 真正要说的话往往在最后一个空行之后。只在确实超长时才动手，避免误伤正常长评论。
    const t0 = pre.trim();
    const t = t0;
    const limit = (typeof expectedMaxLen === 'number' && expectedMaxLen > 0) ? expectedMaxLen : 100;
    if (t.length <= limit * 2.5) return t;
    const paragraphs = t.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length <= 1) {
        // 只有一整段、又长得离谱：多半是模型把思考和结论写成了一坨。
        // 试着按"思考类开场白"截断——找不到就只能原样返回（宁可多显示，也不敢乱切用户的正文）。
        const m = t.match(/(?:^|\n)\s*(?:思考过程|思路|分析|推理|我的思考|Reasoning|Thinking)\s*[:：][\s\S]*?(?:\n\s*(?:回复|输出|正式回复|最终回复|Answer|Response)\s*[:：]\s*)([\s\S]+)$/i);
        if (m && m[1] && m[1].trim()) {
            if (reasoningVaultOn) gyVaultCapture([t.slice(0, t.length - m[1].length)], gyDetectFeature(), '', '', '无标签·按长度切');
            return m[1].trim();
        }
        return t;
    }
    if (reasoningVaultOn) gyVaultCapture([paragraphs.slice(0, -1).join('\n\n')], gyDetectFeature(), '', '', '无标签·按长度切');
    return paragraphs[paragraphs.length - 1];
}

// 小说/续写场景专用的思维链展示：受 showNovelReasoning 开关控制——开着就沿用全局思维链设置
// （reasoningDisplayMode，默认'collapse'折叠展示），关掉则不管全局设置是什么，这里一律强制把思维链正文剥掉、
// 完全不显示（哪怕全局设成了'off'原样保留，小说这边开关关了也不展示，两个开关互不影响对方场景）。
// 拆成两步返回而不是直接拼好一个字符串：调用方要对"剥离后的正文"跑 applyRegexScripts（角色状态栏这类HTML
// 卡片全靠这一步正则脚本转换出来，很多正则是从文本开头^锚定匹配的，思维链如果已经堵在最前面会导致锚点
// 永远匹配不上）——而且不管是烘焙阶段的正则、还是渲染阶段的displayOnly正则，只要 reasoningHtml 曾经跟正文
// 拼在一起存过档，锚点问题就还会在渲染那一刻复发。所以调用方存档时也不要把两者拼死，reasoningHtml应该
// 单独存一个字段（参考 novel.storyTurns / novel.chapters 里的 reasoningHtml 字段），渲染时在
// renderMarkdownLite(text,...) 外面单独拼接，正文本身永远保持"从AI原始正文本该开始的地方开始"。
function extractReasoningForNovel(text) {
    if (!text || typeof text !== 'string') return { rest: text, reasoningHtml: '' };
    // 优先用"正式输出标记"精确切割——模型没有走<think>标签、只是把思考过程原样堆在正文前面时，
    // 靠这个标记能干净利落地拿到标记之后的正式内容，思考过程整个丢弃（小说场景不需要展示思考过程本身）。
    const marked = extractAfterFinalMarker(text);
    if (marked !== text) return { rest: marked.trim(), reasoningHtml: '' };
    const reasoningOff = typeof showNovelReasoning !== 'undefined' && !showNovelReasoning;
    if (reasoningOff || reasoningDisplayMode === 'off') {
        // 关闭展示：仍然要把思维链剥掉不让它进入正文，只是不生成展示用的折叠框HTML
        return { rest: stripLeadingReasoningBlocks(text).rest, reasoningHtml: '' };
    }
    const { collapsedBlocks, rest } = stripLeadingReasoningBlocks(text);
    if (collapsedBlocks.length === 0) return { rest: text, reasoningHtml: '' };
    if (reasoningDisplayMode === 'strip') return { rest, reasoningHtml: '' };
    return { rest, reasoningHtml: buildReasoningCollapseHtml(collapsedBlocks) };
}

function renderReasoningFormatsList() {
    const container = document.getElementById('reasoningFormatsList');
    if (!container) return;
    const modeSelect = document.getElementById('reasoningDisplayModeSelect');
    if (modeSelect) modeSelect.value = reasoningDisplayMode;
    if (!reasoningFormats || reasoningFormats.length === 0) { container.innerHTML = '<div style="color:#8b98a5; font-size:13px;">暂无思维链格式</div>'; return; }
    container.innerHTML = reasoningFormats.map(fmt => `
        <div style="display:flex; align-items:center; gap:8px; background:white; padding:8px; border-radius:6px; border:1px solid #eff3f4;">
            <input type="checkbox" ${fmt.enabled !== false ? 'checked' : ''} onchange="toggleReasoningFormat('${fmt.id}')" title="启用/禁用">
            <div style="flex:1; min-width:0;">
                <div style="font-size:13px; font-weight:bold;">${escapeHtml(fmt.name) || '未命名格式'}</div>
                <div style="font-size:12px; color:#536471; word-break:break-all;"><code class="md-inlinecode">${escapeHtml(fmt.prefix)}</code> ... <code class="md-inlinecode">${escapeHtml(fmt.suffix)}</code></div>
            </div>
            <span style="color:#f91880; cursor:pointer; flex-shrink:0;" onclick="deleteReasoningFormat('${fmt.id}')">删除</span>
        </div>`).join('');
}
function toggleReasoningFormat(id) {
    const fmt = reasoningFormats.find(f => f.id === id);
    if (fmt) { fmt.enabled = fmt.enabled === false ? true : false; saveAllData(); renderReasoningFormatsList(); }
}
function deleteReasoningFormat(id) {
    reasoningFormats = reasoningFormats.filter(f => f.id !== id);
    saveAllData();
    renderReasoningFormatsList();
}
function addReasoningFormat() {
    const name = document.getElementById('newReasoningFormatName').value.trim();
    const prefix = document.getElementById('newReasoningFormatPrefix').value.trim();
    const suffix = document.getElementById('newReasoningFormatSuffix').value.trim();
    if (!prefix || !suffix) return alert('前缀和后缀都要填写，两个都不能为空。');
    reasoningFormats.push({ id: 'rf_' + Date.now(), name: name || '未命名格式', prefix, suffix, enabled: true });
    document.getElementById('newReasoningFormatName').value = '';
    document.getElementById('newReasoningFormatPrefix').value = '';
    document.getElementById('newReasoningFormatSuffix').value = '';
    saveAllData();
    renderReasoningFormatsList();
}
function saveReasoningDisplayMode() {
    const sel = document.getElementById('reasoningDisplayModeSelect');
    if (sel) reasoningDisplayMode = sel.value;
    saveAllData();
}

// ===================== MVU 变量更新块（状态栏）识别与应用 =====================
// 有些预设（比如"MoM"系列）会强制要求AI在每次回复里附上一段
// <UpdateVariable><Analysis>...</Analysis><JSONPatch>[ {op,path,value}, ... ]</JSONPatch></UpdateVariable>
// 这种"变量补丁"块，本来在酒馆里是由专门的插件解析掉、更新到一套隐藏的角色状态数值上，
// 再单独渲染成好看的状态栏——如果什么都不处理，这段本该被隐藏的JSON就会原样糊在聊天气泡最前面，
// 又长又难看（这正是"角色卡自带状态栏显示不出来"这个问题的根源）。这里做三件事：
// 1）无论这个块实际出现在正文开头还是结尾（不同预设/模型习惯不一样，不能假设固定位置），都识别出来并从可见正文里去掉；
// 2）把里面的 op（replace/delta/insert/remove/move）应用到按"聊天session"分桶的状态树上
//    （path是"/角色/谢云霄/疲劳度"这种斜杠分隔路径，delta是"在原有数值基础上加/减"，其余op按标准JSON Patch语义处理）；
// 3）把应用后的状态树快照存到这条消息对象上，渲染消息时读这个快照画一个真正的状态栏卡片出来
//    （存在消息自己身上而不是只存一份"最新状态"，这样翻旧消息/群聊分叉的时候，每条消息都能显示"当时那一刻"的数值，不会全部显示成最新值）。
let mvuStats = {}; // { [sessionId]: 任意深度的嵌套对象树，按 JSONPatch 的 path 逐级存放 }
function getMvuStatsScope(sessionId) {
    const key = sessionId || '__default__';
    if (!mvuStats[key]) mvuStats[key] = {};
    return mvuStats[key];
}

// 从 text 的 startIdx（必须是个 '[' ）开始，找跟它配对的那个 ']'，正确跳过字符串内部的转义字符/引号，
// 避免数组元素的字符串值里恰好带个 ] 就被提前截断——跟 extractJsonObject 找 {} 是同一套思路，这里换成找 []。
function extractBalancedJsonArray(text, startIdx) {
    let depth = 0, inStr = false, strCh = '', esc = false, end = -1;
    for (let i = startIdx; i < text.length; i++) {
        let ch = text[i];
        if (inStr) {
            if (esc) { esc = false; }
            else if (ch === '\\') { esc = true; }
            else if (ch === strCh) { inStr = false; }
            continue;
        }
        if (ch === '"' || ch === "'") { inStr = true; strCh = ch; continue; }
        if (ch === '[') depth++;
        else if (ch === ']') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) return null;
    return text.slice(startIdx, end + 1);
}
// 跟 extractJsonObject 里同一套"宽松修复"逻辑：先直接尝试解析，失败再修一遍字符串内部的裸换行/多余逗号这些
// AI输出常见的小毛病，修完再试一次——两次都失败才彻底放弃，返回null（调用方会当成"没有补丁"处理，不影响正文显示）。
function tryParseJsonArrayLoose(candidate) {
    try { return JSON.parse(candidate); } catch (e) {}
    let fixed = '', inStr = false, esc = false;
    for (let j = 0; j < candidate.length; j++) {
        let c = candidate[j];
        if (inStr) {
            if (esc) { fixed += c; esc = false; continue; }
            if (c === '\\') { fixed += c; esc = true; continue; }
            if (c === '"') { inStr = false; fixed += c; continue; }
            if (c === '\n') { fixed += '\\n'; continue; }
            if (c === '\r') { continue; }
            if (c === '\t') { fixed += '\\t'; continue; }
            fixed += c; continue;
        }
        if (c === '"') { inStr = true; fixed += c; continue; }
        fixed += c;
    }
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(fixed); } catch (e2) {}
    // 跟 tryParseJsonCandidate 共用同一个兜底修复：文本字段内部没转义的引号（对话里引用一句话时常见）
    try { return JSON.parse(repairUnescapedInnerQuotes(fixed)); } catch (e3) { return null; }
}

// 在文本里找变量补丁块：优先找标准的 <UpdateVariable>...</UpdateVariable> 包裹（块内通常还带一段
// <Analysis>分析说明文字</Analysis>，一起当成"要隐藏的部分"清掉）；找不到这层包裹时，再找
// 单独出现的 <JSONPatch>...</JSONPatch>（前面常紧跟着一段同样要隐藏的 <EventEval>...</EventEval>
// 人类可读小结，比如"疲劳-1，欲望+0..."这种）——这是另一种同样常见的写法，没有外层UpdateVariable包裹，
// 真实角色卡（作者直接把这段焊在开场白里）就是这么写的。这两种"有明确标签"的写法不要求出现在开头/结尾，
// 正文中间出现也认，因为标签名本身就足够独特，不会跟普通台词混淆。都找不到才退而求其次，
// 只在文本贴着开头或贴着结尾的位置找一段"数组元素都长得像{op,path,...}"的裸JSON数组——这种没有任何
// 标签包裹的情况没法这么自信，不敢在正文中间随便找，避免把角色台词里凑巧出现的普通方括号内容误判成这个格式。
function extractMvuPatchBlock(text) {
    if (!text || typeof text !== 'string') return null;
    const wrapped = text.match(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/i);
    if (wrapped) {
        const patchTagMatch = wrapped[0].match(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/i);
        let patchArr = null;
        if (patchTagMatch) patchArr = tryParseJsonArrayLoose(patchTagMatch[1].trim());
        if (!patchArr) {
            const idx = wrapped[0].indexOf('[');
            if (idx !== -1) { const arr = extractBalancedJsonArray(wrapped[0], idx); if (arr) patchArr = tryParseJsonArrayLoose(arr); }
        }
        return { fullMatch: wrapped[0], patch: patchArr };
    }
    const standaloneEventPatch = text.match(/(?:<EventEval>[\s\S]*?<\/EventEval>\s*)?<JSONPatch>([\s\S]*?)<\/JSONPatch>/i);
    if (standaloneEventPatch) {
        const patchArr = tryParseJsonArrayLoose(standaloneEventPatch[1].trim());
        return { fullMatch: standaloneEventPatch[0], patch: patchArr };
    }
    const trimmed = text.trim();
    const tryBareArrayAt = (idx) => {
        if (idx === -1) return null;
        const arrText = extractBalancedJsonArray(trimmed, idx);
        if (!arrText) return null;
        const parsed = tryParseJsonArrayLoose(arrText);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(o => o && typeof o === 'object' && 'op' in o && 'path' in o)) {
            return { fullMatch: arrText, patch: parsed };
        }
        return null;
    };
    if (/^\s*\[/.test(trimmed)) {
        const res = tryBareArrayAt(trimmed.indexOf('['));
        if (res) return res;
    }
    const lastOpenIdx = trimmed.lastIndexOf('[');
    if (lastOpenIdx !== -1) {
        const arrText = extractBalancedJsonArray(trimmed, lastOpenIdx);
        if (arrText && trimmed.slice(lastOpenIdx + arrText.length).trim().length === 0) {
            const parsed = tryParseJsonArrayLoose(arrText);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(o => o && typeof o === 'object' && 'op' in o && 'path' in o)) {
                return { fullMatch: arrText, patch: parsed };
            }
        }
    }
    return null;
}

// 把一条JSONPatch操作应用到状态树上：path是"/角色/谢云霄/疲劳度"这种斜杠分隔路径，中间节点不存在就自动建空对象；
// 遇到未知/处理不了的op，宁可直接赋值兜底，也不抛错打断整个补丁的应用（调用方还会再包一层try/catch兜底）。
function applyMvuPathOp(root, op) {
    if (!op || typeof op.path !== 'string' || !op.path) return;
    const segs = op.path.split('/').filter(s => s.length > 0).map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (segs.length === 0) return;
    let node = root;
    for (let i = 0; i < segs.length - 1; i++) {
        const key = segs[i];
        if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
        node = node[key];
    }
    const lastKey = segs[segs.length - 1];
    const action = (op.op || 'replace').toLowerCase();
    if (action === 'delta') {
        const cur = parseFloat(node[lastKey]);
        const d = parseFloat(op.value);
        node[lastKey] = (isNaN(cur) ? 0 : cur) + (isNaN(d) ? 0 : d);
    } else if (action === 'remove') {
        delete node[lastKey];
    } else if (action === 'move' && typeof op.from === 'string') {
        const fromSegs = op.from.split('/').filter(s => s.length > 0);
        let fromNode = root;
        for (let i = 0; i < fromSegs.length - 1; i++) { if (typeof fromNode[fromSegs[i]] !== 'object' || fromNode[fromSegs[i]] === null) fromNode[fromSegs[i]] = {}; fromNode = fromNode[fromSegs[i]]; }
        const fromKey = fromSegs[fromSegs.length - 1];
        node[lastKey] = fromNode[fromKey];
        delete fromNode[fromKey];
    } else if (action === 'insert' && Array.isArray(node[lastKey])) {
        node[lastKey].push(op.value);
    } else {
        node[lastKey] = op.value;
    }
}

// 处理一条AI回复文本：识别+剥离变量补丁块，把补丁应用到这个session的状态树上，
// 返回 { cleanText, snapshot }——snapshot只有在这条消息确实带了补丁块时才非null，是应用完这条补丁之后、
// 当时那一刻的状态树深拷贝（用来渲染这条消息专属的状态栏）。没有补丁块的普通消息原样返回，不受任何影响。
function processMvuPatchInText(text, sessionId) {
    if (!text || typeof text !== 'string') return { cleanText: text, snapshot: null };
    const found = extractMvuPatchBlock(text);
    if (!found) return { cleanText: text, snapshot: null };
    const cleanText = text.replace(found.fullMatch, '').trim();
    if (!found.patch || !Array.isArray(found.patch)) return { cleanText, snapshot: null };
    const root = getMvuStatsScope(sessionId);
    found.patch.forEach(op => { try { applyMvuPathOp(root, op); } catch (e) { console.error('应用MVU变量补丁的某一条操作时出错，已跳过：', op, e); } });
    let snapshot = null;
    try { snapshot = JSON.parse(JSON.stringify(root)); } catch (e) { snapshot = null; }
    return { cleanText, snapshot };
}

// 把状态快照渲染成状态栏卡片：按"倒数第二层"的路径分组当标题（比如"角色 / 谢云霄"），最后一层的key当字段名——
// 结构不确定（有的卡两层，有的卡三层）时按实际层数展开，不强行假设固定层数。数字字段额外按正负上色，
// 一眼就能看出这轮是涨了还是掉了，不用自己心算前后两次的差值。
function renderMvuStatusBarHtml(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return '';
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const groups = {};
    const walk = (node, pathSegs) => {
        if (node === null || typeof node !== 'object') return;
        const entries = Object.entries(node);
        const allLeaf = entries.every(([, v]) => v === null || typeof v !== 'object');
        const groupTitle = pathSegs.length > 0 ? pathSegs.join(' / ') : '状态';
        if (allLeaf) {
            if (entries.length === 0) return;
            groups[groupTitle] = groups[groupTitle] || [];
            entries.forEach(([k, v]) => groups[groupTitle].push({ label: k, value: v }));
            return;
        }
        entries.forEach(([k, v]) => {
            if (v !== null && typeof v === 'object') walk(v, [...pathSegs, k]);
            else { groups[groupTitle] = groups[groupTitle] || []; groups[groupTitle].push({ label: k, value: v }); }
        });
    };
    walk(snapshot, []);
    const groupKeys = Object.keys(groups);
    if (groupKeys.length === 0) return '';
    const fieldHtml = (label, value) => {
        const isNum = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value)));
        const numVal = isNum ? Number(value) : null;
        const valClass = isNum ? (numVal > 0 ? 'mvu-stat-pos' : (numVal < 0 ? 'mvu-stat-neg' : '')) : '';
        return `<span class="mvu-stat-field"><b>${esc(label)}</b><span class="mvu-stat-value ${valClass}">${esc(value)}</span></span>`;
    };
    const bodyHtml = groupKeys.map(gk => `
        <div class="mvu-stat-group">
            <div class="mvu-stat-group-title">${esc(gk)}</div>
            <div class="mvu-stat-group-fields">${groups[gk].map(f => fieldHtml(f.label, f.value)).join('')}</div>
        </div>`).join('');
    return `<div class="mvu-status-bar">${bodyHtml}</div>`;
}

// ===================== 记忆召回面板（"数据库"类预设常见格式）本地轻量实现 =====================
// 有些预设（比如"星河璀璨数据库"）会让AI每轮在输出里带一段 <recall>AM001（标题）AM002（标题2）...</recall>
// （这轮用到的历史记忆编码）+ 可选的 <supplement>- [标签] 补充内容\n...</supplement>（旁支线索）。
// 酒馆那边真正的"数据库"扩展靠一个远程脚本（本app不会去加载运行来路不明的远程代码，这类脚本一律不执行）
// 维护一张可以被AI持续读写的"记忆表格"，命中编码后从表格里查出对应内容、渲染成好看的召回面板。
// 这里做一个本地、完全可审查的轻量平替：记忆表格由用户自己在设置里维护（增删改查，也可以配合正则/宏
// 让AI在文本里输出新的记忆条目、后续再手动登记），召回面板的渲染、编码识别、旁支解析这些"看得见"的部分
// 照着同样的思路自己实现，不依赖任何远程脚本；查不到的编码会显示"本地记忆库里还没有这条记录"，不会报错卡死。
let memoryEntries = {}; // { [sessionId]: [{code, title, content, source}] }
function getMemoryEntries(sessionId) {
    const key = sessionId || '__default__';
    if (!memoryEntries[key]) memoryEntries[key] = [];
    return memoryEntries[key];
}
function findMemoryEntry(sessionId, code) {
    const list = getMemoryEntries(sessionId);
    return list.find(e => (e.code || '').toUpperCase() === (code || '').toUpperCase()) || null;
}

// 识别文本里的 <recall>...</recall> / <supplement>...</supplement> 两种块（各自独立，出现任意一个就处理，
// 都没有就返回null）。这两个标签名足够独特，不限制只能出现在开头/结尾，正文中间出现也认。
function extractRecallSupplementBlock(text) {
    if (!text || typeof text !== 'string') return null;
    const recallMatch = text.match(/<recall>([\s\S]*?)<\/recall>/i);
    const supplementMatch = text.match(/<supplement>([\s\S]*?)<\/supplement>/i);
    if (!recallMatch && !supplementMatch) return null;
    const fullMatches = [];
    if (recallMatch) fullMatches.push(recallMatch[0]);
    if (supplementMatch) fullMatches.push(supplementMatch[0]);
    return { fullMatches, recallRaw: recallMatch ? recallMatch[1] : '', supplementRaw: supplementMatch ? supplementMatch[1] : '' };
}
// <recall>正文里形如 "AM001（初遇时的桥段）AM002（...）" 这种"编码+紧跟的括号标题"写法，
// 从原始文本里把编码列表（去重、保留首次出现顺序）和每个编码对应的行内标题分别抠出来。
function parseAmCodesFromRecall(raw) {
    const matches = (raw || '').match(/AM\d+/gi) || [];
    const seen = new Set(); const codes = [];
    matches.forEach(c => { const up = c.toUpperCase(); if (!seen.has(up)) { seen.add(up); codes.push(up); } });
    return codes;
}
function extractAmTitleFromRecall(raw, code) {
    try {
        const m = (raw || '').match(new RegExp(code + '[（(]([^）)]+)[）)]'));
        return m ? m[1].trim() : '';
    } catch (e) { return ''; }
}
// <supplement>正文是"- [标签] 内容\n（可能换行接着写更多内容）\n- [下一个标签] ..."这种列表写法
function parseSupplementItems(raw) {
    const lines = (raw || '').split('\n');
    const items = [];
    let current = null;
    lines.forEach(line => {
        const m = line.match(/^\s*-\s*\[([^\]]+)\]\s*(.*)/);
        if (m) { if (current) items.push(current); current = { tag: m[1].trim(), content: m[2].trim() }; }
        else if (current && line.trim()) current.content += '\n' + line.trim();
    });
    if (current) items.push(current);
    return items;
}
function renderRecallPanelHtml(sessionId, recallRaw, supplementRaw) {
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const codes = parseAmCodesFromRecall(recallRaw || '');
    const items = parseSupplementItems(supplementRaw || '');
    if (codes.length === 0 && items.length === 0) return '';
    const recallHtml = codes.map(code => {
        const inlineTitle = extractAmTitleFromRecall(recallRaw, code);
        const entry = findMemoryEntry(sessionId, code);
        const displayTitle = inlineTitle || (entry ? entry.title : '') || '无题';
        const body = entry ? entry.content : '（本地记忆库里还没有这条记录，可以在设置的"记忆库管理"里手动补上）';
        const source = entry ? entry.source : '';
        return `<div class="recall-item"><div class="recall-item-header"><span class="recall-item-code">${esc(code)}</span><span class="recall-item-title">${esc(displayTitle)}</span></div><div class="recall-item-body">${esc(body)}</div>${source ? `<div class="recall-item-source">来自：${esc(source)}</div>` : ''}</div>`;
    }).join('');
    const supplementHtml = items.map(it => `<div class="recall-item"><span class="recall-tag">${esc(it.tag)}</span><div class="recall-item-body">${esc(it.content)}</div></div>`).join('');
    const summary = `📖 记忆召回${codes.length ? `（${codes.length}）` : ''}${items.length ? ` · 旁支线索（${items.length}）` : ''}`;
    return `<details class="recall-panel"><summary>${summary}</summary>${recallHtml ? `<div class="recall-section-title">流转</div>${recallHtml}` : ''}${supplementHtml ? `<div class="recall-section-title">旁支</div>${supplementHtml}` : ''}</details>`;
}
// 处理一条AI回复文本：识别+剥离recall/supplement块，返回{cleanText, recallHtml}——recallHtml只有
// 确实识别到这类块时才非空字符串，调用方把它拼在正文前面展示；没有这类块的普通消息原样返回，不受影响。
function processRecallBlockInText(text, sessionId) {
    if (!text || typeof text !== 'string') return { cleanText: text, recallHtml: '' };
    const found = extractRecallSupplementBlock(text);
    if (!found) return { cleanText: text, recallHtml: '' };
    let cleanText = text;
    found.fullMatches.forEach(m => { cleanText = cleanText.replace(m, ''); });
    cleanText = cleanText.trim();
    const recallHtml = renderRecallPanelHtml(sessionId, found.recallRaw, found.supplementRaw);
    return { cleanText, recallHtml };
}

// 记忆库管理UI：跟正则脚本/思维链格式列表同一套风格，按当前打开的聊天/续写session分桶展示。
function renderMemoryEntriesList(sessionId) {
    const container = document.getElementById('memoryEntriesList');
    if (!container) return;
    const list = getMemoryEntries(sessionId);
    if (list.length === 0) { container.innerHTML = '<div style="color:#8b98a5; font-size:13px;">这个会话还没有登记任何记忆条目</div>'; return; }
    container.innerHTML = list.map((e, idx) => `
        <div style="display:flex; align-items:flex-start; gap:8px; background:white; padding:8px; border-radius:6px; border:1px solid #eff3f4;">
            <div style="flex:1; min-width:0;">
                <div style="font-size:13px; font-weight:bold;">${escapeHtml(e.code)} <span style="font-weight:normal; color:#536471;">${escapeHtml(e.title || '')}</span></div>
                <div style="font-size:12px; color:#536471; white-space:pre-wrap; word-break:break-all;">${escapeHtml(e.content || '')}</div>
                ${e.source ? `<div style="font-size:11px; color:#8b98a5;">来源：${escapeHtml(e.source)}</div>` : ''}
            </div>
            <span style="color:#f91880; cursor:pointer; flex-shrink:0;" onclick="deleteMemoryEntry('${sessionId}', ${idx})">删除</span>
        </div>`).join('');
}
function addMemoryEntry(sessionId) {
    const code = document.getElementById('newMemoryCode')?.value.trim();
    const title = document.getElementById('newMemoryTitle')?.value.trim();
    const content = document.getElementById('newMemoryContent')?.value.trim();
    const source = document.getElementById('newMemorySource')?.value.trim();
    if (!code) return alert('请填写记忆编码（比如 AM001）');
    if (!content) return alert('请填写记忆内容');
    getMemoryEntries(sessionId).push({ code, title, content, source });
    ['newMemoryCode', 'newMemoryTitle', 'newMemoryContent', 'newMemorySource'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = ''; });
    saveAllData();
    renderMemoryEntriesList(sessionId);
}
function deleteMemoryEntry(sessionId, idx) {
    getMemoryEntries(sessionId).splice(idx, 1);
    saveAllData();
    renderMemoryEntriesList(sessionId);
}

// 给"添加脚本"表单里的角色下拉框填上当前所有角色，每次列表刷新都重新填一遍（角色可能是刚导入的新角色）
function populateRegexCharScopeOptions() {
    const sel = document.getElementById('newRegexCharScope');
    if (!sel) return;
    const prevValue = sel.value;
    const chars = (typeof myCharacters !== 'undefined' ? myCharacters : []) || [];
    sel.innerHTML = '<option value="">🌐 全局（不限定角色，默认）</option>' + chars.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if (chars.some(c => c.id === prevValue)) sel.value = prevValue; // 保留用户已经选中的角色，避免每次刷新列表都被重置回"全局"
}

function renderNewRegexCharScopeHint() {
    const sel = document.getElementById('newRegexCharScope');
    const hint = document.getElementById('newRegexCharScopeHint');
    if (!sel || !hint) return;
    hint.innerText = sel.value ? '💡 已绑定角色：这条脚本只会在渲染该角色自己发的帖子/评论/回信/日记/续写/小说/论坛内容时生效，不会影响其它角色。' : '';
}

function renderRegexScriptsList() {
    populateRegexCharScopeOptions();
    const container = document.getElementById('regexScriptsList');
    if (!container) return;
    if (!regexScripts || regexScripts.length === 0) { container.innerHTML = '<div style="color:#8b98a5; font-size:13px;">暂无正则脚本</div>'; return; }
    const targetLabel = { ai_output: 'AI回复', user_input: '我的消息', both: '双向' };
    const charNameById = {};
    (typeof myCharacters !== 'undefined' ? myCharacters : []).forEach(c => { charNameById[c.id] = c.name; });
    container.innerHTML = regexScripts.map(s => {
        const scopeTag = s.displayOnly ? ' 👁️仅显示' : (s.promptOnly ? ' 🤖仅发AI' : ` [${targetLabel[s.target] || s.target}]`);
        const hasDepthLimit = typeof s.minDepth === 'number' || typeof s.maxDepth === 'number';
        const depthTag = hasDepthLimit ? ` 📏深度${typeof s.minDepth === 'number' ? s.minDepth : '0'}~${typeof s.maxDepth === 'number' ? s.maxDepth : '∞'}` : '';
        // 绑定了专属角色的脚本，标签上直接把角色名标出来，一眼能看出这条只对谁生效
        const charTag = (Array.isArray(s.charScope) && s.charScope.length > 0)
            ? ` 🎭${s.charScope.map(id => escapeHtml(charNameById[id] || '未知角色')).join('/')}专属`
            : '';
        return `
        <div style="display:flex; align-items:center; gap:8px; background:white; padding:8px; border-radius:6px; border:1px solid #eff3f4;">
            <input type="checkbox" ${s.enabled !== false ? 'checked' : ''} onchange="toggleRegexScriptEnabled('${s.id}')" title="启用/禁用">
            <div style="flex:1; min-width:0;">
                <div style="font-size:13px; font-weight:bold;">${escapeHtml(s.name) || '未命名脚本'} <span style="font-weight:normal; font-size:11px; color:#8b98a5;">${scopeTag}${s.isRegex ? ' 🔤正则' : ''}${depthTag}${charTag}</span></div>
                <div style="font-size:12px; color:#536471; word-break:break-all; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; cursor:pointer;" title="点击展开/收起完整内容" onclick="toggleRegexPreviewExpand(this)">${escapeHtml(s.find)} → ${s.replace ? escapeHtml(s.replace) : '(删除)'}</div>
            </div>
            <span style="color:#f91880; cursor:pointer; flex-shrink:0;" onclick="deleteRegexScript('${s.id}')">删除</span>
        </div>`;
    }).join('');
}

// 正则列表的查找/替换预览默认只显示两行（超长的正则/替换HTML不会把卡片撑得巨高），点一下展开/收起完整内容
function toggleRegexPreviewExpand(el) {
    const isExpanded = el.dataset.expanded === '1';
    if (isExpanded) {
        el.style.webkitLineClamp = '2';
        el.style.display = '-webkit-box';
        el.dataset.expanded = '0';
    } else {
        el.style.webkitLineClamp = 'unset';
        el.style.display = 'block';
        el.dataset.expanded = '1';
    }
}

function addRegexScript() {
    const name = document.getElementById('newRegexName').value.trim();
    const find = document.getElementById('newRegexFind').value.trim();
    const replace = document.getElementById('newRegexReplace').value;
    const isRegex = document.getElementById('newRegexIsRegex').checked;
    const target = document.getElementById('newRegexTarget').value;
    const displayOnly = document.getElementById('newRegexDisplayOnly')?.checked || false;
    const promptOnly = !displayOnly && (document.getElementById('newRegexPromptOnly')?.checked || false);
    const minDepthRaw = document.getElementById('newRegexMinDepth')?.value;
    const maxDepthRaw = document.getElementById('newRegexMaxDepth')?.value;
    const minDepth = minDepthRaw !== '' && minDepthRaw !== undefined ? parseInt(minDepthRaw) : null;
    const maxDepth = maxDepthRaw !== '' && maxDepthRaw !== undefined ? parseInt(maxDepthRaw) : null;
    const charScopeId = document.getElementById('newRegexCharScope')?.value || '';
    const charScope = charScopeId ? [charScopeId] : null; // 空＝全局脚本，选了角色就只绑定那一个（保留数组形式，以后想支持多选也不用改数据结构）
    if (!find) return alert('请填写"查找内容"');
    if (isRegex) { try { new RegExp(find); } catch (e) { return alert('正则表达式写法有误：' + e.message); } }
    regexScripts.push({ id: 'rx_' + Date.now(), name: name || '未命名脚本', find, replace, isRegex, target, enabled: true, displayOnly, promptOnly, minDepth: isNaN(minDepth) ? null : minDepth, maxDepth: isNaN(maxDepth) ? null : maxDepth, charScope });
    document.getElementById('newRegexName').value = '';
    document.getElementById('newRegexFind').value = '';
    document.getElementById('newRegexReplace').value = '';
    document.getElementById('newRegexIsRegex').checked = false;
    if (document.getElementById('newRegexDisplayOnly')) document.getElementById('newRegexDisplayOnly').checked = false;
    if (document.getElementById('newRegexPromptOnly')) document.getElementById('newRegexPromptOnly').checked = false;
    if (document.getElementById('newRegexCharScope')) document.getElementById('newRegexCharScope').value = '';
    if (document.getElementById('newRegexCharScopeHint')) document.getElementById('newRegexCharScopeHint').innerText = '';
    if (document.getElementById('newRegexMinDepth')) document.getElementById('newRegexMinDepth').value = '';
    if (document.getElementById('newRegexMaxDepth')) document.getElementById('newRegexMaxDepth').value = '';
    saveAllData();
    renderRegexScriptsList();
}

function deleteRegexScript(id) {
    regexScripts = regexScripts.filter(s => s.id !== id);
    saveAllData();
    renderRegexScriptsList();
}

function toggleRegexScriptEnabled(id) {
    const s = regexScripts.find(s => s.id === id);
    if (s) { s.enabled = !(s.enabled !== false); saveAllData(); }
}


function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ⚠️ 这里以前是 `catch (e) { return null; }` —— 一个字都不留。
//    结果是：模型名填错、key 过期、地址写错、返回了一个 error 对象……全都长一个样子：
//    "已向量化 83 / 260"，数字停在那儿不动，谁也不知道为什么。
//    现在把失败原因留在 window.gyVecLastErr 上，记忆总览那一页直接显示出来。
window.gyVecLastErr = '';
async function getEmbedding(text) {
    if (!text || !text.trim()) return null;
    const api = getVectorApiConfig();
    if (!api.key) { window.gyVecLastErr = '还没配 Embedding 用的 API Key（设置 → API 与模型 → 向量记忆专用API，留空就用主 API）'; return null; }
    try {
        const res = await smartFetch(`${api.url}/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api.key}` },
            body: JSON.stringify({ model: embeddingModel || 'text-embedding-3-small', input: text.slice(0, 3000) })
        });
        let data = null;
        try { data = await res.json(); } catch (e) { data = null; }
        if (!res.ok) {
            const m = (data && (data.error?.message || data.message)) || ('HTTP ' + res.status);
            window.gyVecLastErr = String(m).slice(0, 160)
                + (res.status === 401 ? '（key 不对或没权限）' : res.status === 404 ? '（地址或模型名不对）' : '');
            return null;
        }
        if (data && data.error) { window.gyVecLastErr = String(data.error.message || data.error).slice(0, 160); return null; }
        const vec = data?.data?.[0]?.embedding || null;
        if (!vec) { window.gyVecLastErr = '接口回了个没有 embedding 的东西——多半是模型名不是 embedding 模型'; return null; }
        window.gyVecLastErr = '';
        return vec;
    } catch (e) {
        window.gyVecLastErr = String(e.message || e).slice(0, 160);
        return null;
    }
}

// 太短的不算：跟聊天消息的过滤标准保持一致，这个数字要跟界面上写的对得上
const GY_VEC_MIN_LEN = 10;
window.gyVecTooShort = t => !t || String(t).trim().length < GY_VEC_MIN_LEN;

// 聊天消息发出去之后，后台悄悄给它算一个向量，不阻塞聊天体验，失败了也无所谓
async function embedMessageInBackground(msg) {
    if (!enableVectorMemory || !msg || !msg.text || msg.text.trim().length < GY_VEC_MIN_LEN) return; // 太短的消息（"在吗""哈哈"之类）检索价值低，不值得为它调一次embedding
    try {
        const vec = await getEmbedding(msg.text);
        if (vec) { msg.embVec = vec; saveAllData(); }
    } catch (e) { /* 静默失败 */ }
}

/* ===================== 把还没算过的一次补齐 =====================
   为什么需要这个：
   · 聊天消息只在**发出的那一刻**后台算一次。你是聊到一半才打开向量记忆的，
     那之前的几百条永远轮不上——它们不会自己回头补。
   · 日记/信件/小说/论坛那一批本来是"检索时顺手补"，可那要等你**真的在聊天**、
     而且这个角色**真的走到了检索这一步**。你光看记忆总览，它就一直是 0 / 9。
   所以给一个"点了就补"的入口。点了就跑，不看自动开关——全 app 一条规矩。
   ==================================================================== */
window.gyVecScan = async function (sessionId, isGroup) {
    const out = { chatAll: 0, chatDone: 0, chatShort: 0, chatTodo: 0,
                  dataAll: 0, dataDone: 0, dataTodo: 0 };
    const history = (typeof globalChats !== 'undefined' && globalChats[sessionId]) || [];
    history.forEach(m => {
        if (!m || !m.text) return;
        out.chatAll++;
        if (m.embVec) out.chatDone++;
        else if (window.gyVecTooShort(m.text)) out.chatShort++;
        else out.chatTodo++;
    });
    const char = isGroup ? null : (typeof myCharacters !== 'undefined' ? myCharacters.find(c => c.id == sessionId) : null);
    if (char && typeof collectCharVectorCandidates === 'function') {
        const cands = await collectCharVectorCandidates(char);
        out.dataAll = cands.length;
        cands.forEach(it => { if (it.ref.embVec) out.dataDone++; else out.dataTodo++; });
        out._cands = cands;
    }
    return out;
};
window.gyVecBackfill = async function (sessionId, isGroup, onProgress) {
    window.gyVecLastErr = '';
    const say = m => { try { if (onProgress instanceof Function) onProgress(m); } catch (e) {} };
    const history = (typeof globalChats !== 'undefined' && globalChats[sessionId]) || [];
    const jobs = [];
    history.forEach(m => {
        if (m && m.text && !m.embVec && !window.gyVecTooShort(m.text))
            jobs.push({ text: m.text, set: v => { m.embVec = v; } });
    });
    const char = isGroup ? null : (typeof myCharacters !== 'undefined' ? myCharacters.find(c => c.id == sessionId) : null);
    if (char && typeof collectCharVectorCandidates === 'function') {
        (await collectCharVectorCandidates(char)).forEach(it => {
            if (!it.ref.embVec) jobs.push({ text: it.text, set: v => { it.ref.embVec = v; } });
        });
    }
    if (!jobs.length) { say('没有要补的，全都算过了。'); return { ok: 0, fail: 0, total: 0 }; }
    let ok = 0, fail = 0;
    const BATCH = 5;
    for (let i = 0; i < jobs.length; i += BATCH) {
        say(`正在补算… ${Math.min(i + BATCH, jobs.length)} / ${jobs.length}`);
        await Promise.all(jobs.slice(i, i + BATCH).map(async j => {
            try { const v = await getEmbedding(j.text); if (v) { j.set(v); ok++; } else fail++; }
            catch (e) { fail++; }
        }));
        // 一路失败就别硬撑着把几百条全试一遍——多半是 key/模型不对
        if (ok === 0 && fail >= 10) { say('连着失败了 10 条，先停下。' + (window.gyVecLastErr || '')); break; }
    }
    try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
    say(fail ? `补完了：成功 ${ok} 条，失败 ${fail} 条。${window.gyVecLastErr ? '失败原因：' + window.gyVecLastErr : ''}`
             : `补完了：${ok} 条全部成功。`);
    return { ok, fail, total: jobs.length };
};

/* 把**所有**会话都补一遍。
   以前只能一个会话一个会话点——你有十个角色就得进去十次，
   而且不进那一页根本不知道哪个还差着。 */
window.gyVecBackfillAll = async function (onProgress) {
    const say = m => { try { if (onProgress instanceof Function) onProgress(m); } catch (e) {} };
    const ids = [];
    try { Object.keys(globalChats || {}).forEach(k => ids.push(k)); } catch (e) {}
    try { (myCharacters || []).forEach(c => { if (ids.indexOf(String(c.id)) < 0) ids.push(String(c.id)); }); } catch (e) {}
    let ok = 0, fail = 0, total = 0, n = 0;
    for (const id of ids) {
        n++;
        const isG = String(id).indexOf('g_') === 0;
        const r = await window.gyVecBackfill(id, isG, m => say(`（${n}/${ids.length}）${m}`));
        ok += r.ok; fail += r.fail; total += r.total;
        if (r.fail >= 10 && r.ok === 0) break;     // key/模型不对，别把几千条全试一遍
    }
    say(fail ? `全部补完：成功 ${ok} 条，失败 ${fail} 条。${window.gyVecLastErr ? '失败原因：' + window.gyVecLastErr : ''}`
             : `全部补完：${ok} 条全部成功。`);
    return { ok, fail, total };
};

/* 一共还差多少条（不分会话）——好在页面上一句话说清楚规模 */
window.gyVecTodoCount = function () {
    let todo = 0, done = 0;
    try {
        Object.keys(globalChats || {}).forEach(k => {
            (globalChats[k] || []).forEach(m => {
                if (!m || !m.text) return;
                if (m.embVec) { done++; return; }
                if (!window.gyVecTooShort(m.text)) todo++;
            });
        });
    } catch (e) {}
    return { todo, done };
};

/* 自动补算：开着的话，闲下来就悄悄补几条，数字会自己往上走。
   默认关着——每补一条都是一次 embedding 调用，得你点头才花这个钱。
   一次只补 8 条、隔 2 分钟一轮，不会突然刷掉一大笔。 */
let gyVecTrickleBusy = false;
async function gyVecTrickle() {
    if (gyVecTrickleBusy) return;
    if (typeof enableVectorMemory === 'undefined' || !enableVectorMemory) return;
    if (typeof isAutoOn === 'function' && !isAutoOn('vecAutoBackfill')) return;
    const api = (typeof getVectorApiConfig === 'function') ? getVectorApiConfig() : null;
    if (!api || !api.key) return;
    gyVecTrickleBusy = true;
    try {
        const jobs = [];
        Object.keys(globalChats || {}).forEach(k => {
            (globalChats[k] || []).forEach(m => {
                if (jobs.length >= 8) return;
                if (m && m.text && !m.embVec && !window.gyVecTooShort(m.text))
                    jobs.push({ text: m.text, set: v => { m.embVec = v; } });
            });
        });
        if (!jobs.length) return;
        let bad = 0;
        for (const j of jobs) {
            try { const v = await getEmbedding(j.text); if (v) j.set(v); else bad++; } catch (e) { bad++; }
            if (bad >= 3) break;                    // 一直失败就停，等你去看看是不是 key 不对
        }
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        try { if (typeof renderMemoryHubVectorMemory === 'function'
            && document.getElementById('memHubVectorStats')
            && document.getElementById('memHubVectorStats').offsetParent !== null
            && typeof currentMemoryHubTargetId !== 'undefined' && currentMemoryHubTargetId)
            renderMemoryHubVectorMemory(currentMemoryHubTargetId, String(currentMemoryHubTargetId).indexOf('g_') === 0); } catch (e) {}
    } finally { gyVecTrickleBusy = false; }
}
setInterval(() => { try { gyVecTrickle(); } catch (e) {} }, 2 * 60 * 1000);

// 语义检索：从这个聊天/角色的历史消息 + 专属资料库里，找出和当前话题最相关的内容
async function getSemanticContext(sessionId, char, queryText) {
    const charHasDataBank = char && dataBank && dataBank.some(d => d.charId == char.id);
    if ((!enableVectorMemory && !charHasDataBank) || !queryText || !queryText.trim()) return '';
    const api = getVectorApiConfig();
    if (!api.key) return '';

    let memoryPart = '', dataBankPart = '';
    const qVec = await getEmbedding(queryText);
    if (!qVec) return '';

    // 1. 向量记忆：从本聊天的历史消息里语义检索（排除掉最近10条，那些已经在常规上下文里了）
    if (enableVectorMemory) {
        const history = globalChats[sessionId] || [];
        const recentTimestamps = new Set(history.slice(-chatHistoryTurns).map(m => m.timestamp));
        const candidates = history.filter(m => m.embVec && !recentTimestamps.has(m.timestamp));
        if (candidates.length > 0) {
            const scored = candidates.map(m => ({ m, score: cosineSimilarity(qVec, m.embVec) }))
                .filter(s => s.score > 0.5)
                .sort((a, b) => b.score - a.score)
                .slice(0, 4)
                .sort((a, b) => a.m.timestamp - b.m.timestamp);
            if (scored.length > 0) {
                memoryPart = `\n【语义检索到的相关历史片段（不一定是最近的对话，但和当前话题相关）】：\n` + scored.map(s => `- ${new Date(s.m.timestamp).toLocaleDateString('zh-CN')}：${s.m.text}`).join('\n') + `\n`;
            }
        }
    }

    // 2. 资料库(RAG)：从这个角色专属的资料库文档片段里语义检索
    if (char && dataBank && dataBank.length > 0) {
        const banks = dataBank.filter(d => d.charId == char.id);
        let allChunks = [];
        banks.forEach(b => (b.chunks || []).forEach(c => { if (c.embVec) allChunks.push({ ...c, bankTitle: b.title }); }));
        if (allChunks.length > 0) {
            const scored = allChunks.map(c => ({ c, score: cosineSimilarity(qVec, c.embVec) }))
                .filter(s => s.score > 0.45)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);
            if (scored.length > 0) {
                dataBankPart = `\n【从${char.name}的专属资料库里检索到的相关内容】：\n` + scored.map(s => `- (来自《${s.c.bankTitle}》) ${s.c.text}`).join('\n') + `\n`;
            }
        }
    }
    // 3. 角色相关的其它数据：日记/信件/小说续写与章节/论坛发帖跟帖/匿名论坛发言，只要是这个角色自己写的都算数。
    // 之前向量记忆只覆盖了聊天消息，这些内容完全没被检索到过——现在统一走 collectCharVectorCandidates 收集、
    // backfillCharVectorEmbeddings 懒加载补embedding（新内容第一次被检索到时才现算，算过一次就跟聊天消息
    // 一样把 embVec 缓存在条目本身上，不用在日记/信件/小说/论坛这几处各自的生成入口分别加一次背景embedding调用）。
    let charDataPart = '';
    if (enableVectorMemory && char) {
        const candidates = await collectCharVectorCandidates(char);
        if (candidates.length > 0) {
            await backfillCharVectorEmbeddings(candidates);
            const scored = candidates.filter(it => it.ref.embVec)
                .map(it => ({ it, score: cosineSimilarity(qVec, it.ref.embVec) }))
                .filter(s => s.score > 0.5)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);
            if (scored.length > 0) {
                charDataPart = `\n【语义检索到的相关日记/信件/小说/论坛发言】：\n` + scored.map(s => `- (${s.it.label}) ${s.it.text.length > 200 ? s.it.text.slice(0, 200) + '…' : s.it.text}`).join('\n') + `\n`;
            }
        }
    }

    let combinedResult = memoryPart + dataBankPart + charDataPart;
    if (combinedResult.length > semanticCharBudget) {
        combinedResult = combinedResult.slice(0, semanticCharBudget) + '\n（因字数预算限制，后续检索内容已省略）\n';
    }
    return combinedResult;
}

// ===================== 向量记忆：日记/信件/小说/论坛等"角色自己写过的内容"也纳入语义检索 =====================
// 跟聊天消息（走"发出去就后台embed"）是分开的一套策略：这些内容创建频率低很多、也分散在好几个不同的生成
// 入口（日记/信件生成、续写/一键生成小说、论坛发帖/跟帖、匿名论坛发帖/跟帖……），与其在每一处各自补一次
// "生成完毕后台embed"的调用（容易漏、也容易几处代码渐渐长得不一样），不如在真正检索的这一刻统一收集这个
// 角色名下所有相关内容、把还没算过embedding的条目现算一遍——算过的直接把 embVec 缓存在条目本身上（复用现有的
// 数据结构，不另外维护一份索引），下次检索直接命中缓存，不用重算。
async function collectCharVectorCandidates(char) {
    if (!char) return [];
    const items = [];
    if (char.diaryData) {
        (char.diaryData.diaries || []).forEach(d => { if (d.content) items.push({ kind: 'diary', label: '日记', text: d.content, ref: d }); });
        (char.diaryData.letters || []).forEach(d => { if (d.content) items.push({ kind: 'letter', label: '信件', text: d.content, ref: d }); });
    }
    (typeof globalNovels !== 'undefined' ? globalNovels : []).forEach(n => {
        (n.storyTurns || []).forEach(t => { if (t.charId == char.id && t.text) items.push({ kind: 'novel', label: `《${n.title || '故事'}》续写`, text: t.text, ref: t }); });
        (n.chapters || []).forEach(c => { if (c.charId == char.id && c.content) items.push({ kind: 'novel', label: `《${n.title || '故事'}》第${c.index}章`, text: c.content, ref: c }); });
    });
    (typeof forumThreads !== 'undefined' ? forumThreads : []).forEach(th => {
        if (th.authorCharId == char.id && th.content) items.push({ kind: 'forum', label: `论坛发帖《${th.title}》`, text: th.content, ref: th });
        (th.replies || []).forEach(r => { if (r.charId == char.id && r.content) items.push({ kind: 'forum', label: `论坛回帖《${th.title}》`, text: r.content, ref: r }); });
    });
    (typeof anonPosts !== 'undefined' ? anonPosts : []).forEach(p => {
        if (p.charId == char.id && p.text) items.push({ kind: 'anon', label: '匿名论坛发帖', text: p.text, ref: p });
        (p.replies || []).forEach(r => { if (r.charId == char.id && r.text) items.push({ kind: 'anon', label: '匿名论坛回复', text: r.text, ref: r }); });
    });
    // 太短的内容检索价值低（跟聊天消息的过滤标准保持一致），不值得为它调一次embedding
    return items.filter(it => it.text && it.text.trim().length >= 10);
}

// 找出候选里还没算过embedding的条目，补算（限制并发数，避免内容一多就同时炸出几十个embedding请求）
async function backfillCharVectorEmbeddings(candidates) {
    const pending = candidates.filter(it => !it.ref.embVec);
    if (pending.length === 0) return;
    const BATCH = 5;
    for (let i = 0; i < pending.length; i += BATCH) {
        const batch = pending.slice(i, i + BATCH);
        await Promise.all(batch.map(async it => {
            try { const vec = await getEmbedding(it.text); if (vec) it.ref.embVec = vec; } catch (e) { /* 静默失败，下次检索再试 */ }
        }));
    }
    saveAllData();
}

// ===================== 角色专属资料库 (Data Bank / RAG) =====================
function renderCharDataBankList() {
    const container = document.getElementById('charDataBankList');
    if (!container) return;
    if (!editingCharId) { container.innerHTML = '<span style="color:#536471; font-size:13px;">请先保存角色，再回来上传专属资料库</span>'; return; }
    const banks = dataBank.filter(d => d.charId == editingCharId);
    if (banks.length === 0) { container.innerHTML = '<span style="color:#536471; font-size:13px;">暂未上传任何资料</span>'; return; }
    container.innerHTML = banks.map(b => `
        <div style="display:flex; align-items:center; gap:8px; background:white; padding:8px; border-radius:6px; border:1px solid #eff3f4;">
            <div style="flex:1; min-width:0;">
                <div style="font-size:13px; font-weight:bold;">📄 ${escapeHtml(b.title)}</div>
                <div style="font-size:11px; color:#8b98a5;">已切分 ${b.chunks.length} 个片段 · ${b.chunks.every(c => c.embVec) ? '✅ 已完成向量化' : '⏳ 向量化中...'}</div>
            </div>
            <span style="color:#f91880; cursor:pointer; flex-shrink:0;" onclick="deleteDataBankEntry('${b.id}')">删除</span>
        </div>`).join('');
}

async function deleteDataBankEntry(id) {
    if (!(await appConfirm('确定要删除这份资料库文档吗？'))) return;
    dataBank = dataBank.filter(d => d.id !== id);
    saveAllData();
    renderCharDataBankList();
}

// 简单按字数切分文档为片段（带一点重叠，避免切断上下文）
function chunkText(text, chunkSize = 600, overlap = 80) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + chunkSize));
        i += (chunkSize - overlap);
    }
    return chunks.filter(c => c.trim().length > 10);
}

async function handleDataBankFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!editingCharId) { alert('请先保存角色，再回来上传专属资料库！'); event.target.value = ''; return; }
    if (!enableVectorMemory) { alert('请先在"设置"里勾选"启用向量记忆与资料库语义检索"，并配置好 Embedding 模型！'); event.target.value = ''; return; }
    const api = getVectorApiConfig();
    if (!api.key) { alert('请先配置 API Key！'); event.target.value = ''; return; }

    const ext = file.name.split('.').pop().toLowerCase();
    let extractedText = '';
    try {
        if (ext === 'txt') {
            extractedText = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = e => reject(e);
                reader.readAsText(file, 'UTF-8');
            });
        } else if (ext === 'docx') {
            if (typeof mammoth === 'undefined') throw new Error('库加载失败，请检查网络');
            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = e => reject(e);
                reader.readAsArrayBuffer(file);
            });
            const result = await mammoth.extractRawText({ arrayBuffer });
            extractedText = result.value;
        } else {
            throw new Error('仅支持 .txt 和 .docx 文件');
        }
        if (!extractedText || !extractedText.trim()) throw new Error('文档内容为空！');
    } catch (err) {
        alert('文件读取失败：' + err.message);
        event.target.value = '';
        return;
    }

    const chunks = chunkText(extractedText);
    if (chunks.length === 0) { alert('文档内容过短，无法切分！'); event.target.value = ''; return; }

    const bankEntry = { id: 'db_' + Date.now(), charId: editingCharId, title: file.name, chunks: chunks.map(c => ({ text: c, embVec: null })), createdAt: Date.now() };
    dataBank.push(bankEntry);
    saveAllData();
    renderCharDataBankList();
    event.target.value = '';

    // 后台逐个片段计算向量，边算边刷新列表状态，不阻塞界面
    for (let c of bankEntry.chunks) {
        try { const vec = await getEmbedding(c.text); if (vec) c.embVec = vec; } catch (e) { /* 单个片段失败就跳过 */ }
    }
    saveAllData();
    renderCharDataBankList();
}
// ============================================================================
// 🛟 全局错误兜底：让"点了没反应"变成"点了有提示"
// ----------------------------------------------------------------------------
// 内联 onclick 里抛出的异常，浏览器只会往控制台丢一条，界面上一点动静都没有——
// 用户看到的就是"这个按钮是坏的"，而且完全没有线索。这里统一捞一下：
//   · 同步异常走 window.onerror
//   · Promise 里的异常（async 处理器最常见）走 unhandledrejection
// 只弹一条不打断操作的 toast，并且同一条错误 5 秒内不重复弹，免得循环报错时刷屏。
// ============================================================================
(function installGlobalErrorNotice() {
    let lastMsg = '', lastAt = 0;
    function notice(what, err) {
        try {
            const msg = String((err && (err.message || err.reason || err)) || '未知错误').slice(0, 120);
            const now = Date.now();
            if (msg === lastMsg && now - lastAt < 5000) return;   // 同一条 5 秒内只提示一次
            lastMsg = msg; lastAt = now;
            console.error('[白露] ' + what + '：', err);
            if (typeof showToast === 'function') {
                showToast('<div class="avatar" style="width:40px;height:40px;background:#f91880;color:#fff;font-size:20px;">⚠️</div>',
                    '刚才那一下没成功', msg + '（详情在控制台 F12）', null, null, false);
            }
        } catch (e) { /* 兜底自己不能再炸 */ }
    }
    window.addEventListener('error', function (e) {
        // 图片/脚本加载失败也会走到这儿，但它们没有 error 对象，跳过——只管真正的 JS 异常
        if (!e || !e.error) return;
        notice('出错了', e.error);
    });
    window.addEventListener('unhandledrejection', function (e) {
        if (!e) return;
        notice('异步操作出错', e.reason);
    });
})();

/* ============================================================
   数字框守卫 —— "我明明改了，怎么没保存"
   ------------------------------------------------------------
   小功能页里那些数字框（联网探索的"自动探索的节奏"、日程、NPC、商城、
   钱包、外卖、手机、图库、关系账本…… 十几个模块）都是这么写的：

       <input type="number" min="30" max="1440"
              onchange="gywebSetNum('gapMin', this.value, 30, 1440, 180)">

   两个毛病，实测都能复现：

   ① **onchange 只在失焦时触发**。敲完 60 直接点关闭、或者直接点别处把
      弹窗关掉，这一下根本没存。你以为改了，其实一个字都没进去。

   ② **超出上下限会被悄悄夹回去**。在下限 30 的框里敲 10，存进去的是 30，
      可框里还显示着 10（代码没回填）。等你下次打开——变成 30 了。
      于是看着就是"它自己改回去了 / 存不住"。其实存住了，只是存的
      不是你敲的那个数，而且没人告诉你。

   这里不去改那十几个模块，而是在 document 上蹲一层：
   · 敲字停下 600ms 就先存一次（哪怕你没失焦、没关窗口）
   · （以前还会在失焦时按 min/max 把数夹回去——现在不夹了，不设上下限，填多少存多少）

   只管带着 onchange、又有 min/max 的 number / range 框，别的一律不碰。
   ============================================================ */
(function numBoxGuard() {
    'use strict';
    const isNum = el => el && el.tagName === 'INPUT'
        && (el.type === 'number' || el.type === 'range')
        && typeof el.onchange === 'function';

    const fire = el => { try { el.onchange.call(el, new Event('change')); } catch (e) { console.warn('[白露] 数字框存档失败', e); } };

    // ① 敲字停下来就先存，不等失焦。
    //    有些模块的存档函数会顺手重画一遍面板，框会被换掉、焦点会丢——
    //    所以存完看一眼：框要是没了，就把同一个位置的新框找回来，
    //    焦点和光标位置一起还回去，让人感觉不到刚才重画过。
    let t = null, pending = null;
    document.addEventListener('input', function (e) {
        const el = e.target;
        if (!isNum(el)) return;
        if (el.value === '') return;                 // 清空的过程中别存，等他敲完
        clearTimeout(t);
        pending = el;
        t = setTimeout(() => {
            if (!document.contains(el)) return;      // 已经被换掉了，这一下不用管
            const focused = document.activeElement === el;
            const sig = el.getAttribute('onchange') || '';
            const val = el.value;
            let pos = null;
            try { pos = el.selectionStart; } catch (e2) {}
            fire(el);
            if (!focused || document.contains(el)) return;
            // 框被重画掉了：按 onchange 的原文找回同一个框
            const back = [...document.querySelectorAll('input[onchange]')]
                .find(x => (x.getAttribute('onchange') || '') === sig);
            if (!back) return;
            try {
                back.value = val; back.focus();
                if (pos != null && back.setSelectionRange) back.setSelectionRange(pos, pos);
            } catch (e3) {}
            pending = null;
        }, 600);
    }, true);

    // 敲完立刻去点「关闭」的话，600ms 还没到，那一下就白敲了。
    // 所以只要手指一按下别的地方，就把等着的那一次立刻存掉——
    // 这比等失焦更早，关窗口那种"元素直接从页面上消失、change 根本不触发"也拦得住。
    ['pointerdown', 'mousedown', 'touchstart'].forEach(ev =>
        document.addEventListener(ev, function (e) {
            if (!pending || e.target === pending) return;
            clearTimeout(t);
            const el = pending; pending = null;
            if (document.contains(el)) fire(el);
        }, true));

    // ② 以前这里会在失焦时把超出 min/max 的数硬改回去，还弹「这个数超出范围了」——
    //    那是一道全局的偷偷上限，删了：你填多少就是多少（非数字的框本来就存不进去，不用管）。
})();
