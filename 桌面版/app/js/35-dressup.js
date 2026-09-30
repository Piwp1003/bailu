/* ===========================================================================
   js/35 —— 🎀 换装：头像 / 资料背景 / 手机壁纸 / app 壁纸
   ---------------------------------------------------------------------------
   换一张头像在真实社交里从来不是一件"设置项"——它是一件**会被注意到的事**。
   谁先发现、发现了说什么、没发现算不算冷淡，全是内容。

   所以这里做的不是"多几个上传框"，是三件事：

   1. **图从图库来**（js/34）。公共图库大家都能挑；角色私库只有 TA 自己能挑。
   2. **换之前要说一声**：私聊里出一张卡，**卡上直接把那张图放出来**——
      "我想把头像换成这张，行吗"。同意了立刻生效，不同意就作罢。
      · 你给角色换 → TA 决定同不同意
      · 角色想给自己换 / 想给你换 → 你按同意或算了
   3. **换完之后谁会注意到**：不是全世界一起弹通知。
      按**关系网 + 人设**决定谁会开口提——关系近的、爱观察的先看见；
      也可以你自己指定"让所有人都注意到 / 谁都别提"。

   能换的四样：
     · 角色头像            · 角色资料背景图
     · 角色手机壁纸 / 图标风格（js/33 那台手机）
     · 你自己的 app 壁纸（全局背景）

   💰 花钱的地方两处，都有开关：问角色同不同意（一次调用）、
      让注意到的人开口说一句（每人一次）。你自己直接换是零成本。
   =========================================================================== */
(function () {
    if (window.__gyDressLoaded) return;
    window.__gyDressLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyDressBox', 'dress')          // 带兜底的存档口
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyDressBox', storeName: 'dress' })
            : null);
    const KEY = 'gyDress_state';

    const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(s == null ? '' : s)
        : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const meName = () => (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : '我';
    const nameOf = id => String(id) === 'me' ? meName() : ((charOf(id) || {}).name || '某人');
    const on = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : false;
    const uid = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const rnd = a => a[Math.floor(Math.random() * a.length)];

    /* 能换的四样。每一样知道自己怎么写进去、写完要刷哪儿。 */
    const KINDS = {
        avatar: { name: '头像', ico: '🙂', who: 'char',
            apply(id, src) { const c = charOf(id); if (!c) return false; c.avatarImg = src; return true; } },
        banner: { name: '资料背景图', ico: '🖼️', who: 'char',
            apply(id, src) { const c = charOf(id); if (!c) return false; c.bgImg = src; return true; } },
        wall:   { name: '手机壁纸', ico: '📱', who: 'char',
            apply(id, src) { if (typeof window.gyPhoneSetWall === 'function') return window.gyPhoneSetWall(id, src); return false; } },
        appbg:  { name: 'app 壁纸', ico: '🌇', who: 'me',
            apply(id, src) {
                try {
                    (0, eval)('globalBgImage = ' + JSON.stringify(src));
                    if (typeof updateGlobalBgStyles === 'function') updateGlobalBgStyles();
                    return true;
                } catch (e) { return false; }
            } }
    };
    const kindOf = k => KINDS[k] || KINDS.avatar;

    let S = {
        log: [],            // [{id, at, kind, target, src, by, note}]
        auto: {},           // { 角色id: 上次自己换的时间 }
        everyGapH: 72,      // 用户自定义：角色多久可能想换一次（小时）
        gapMode: 'fixed',   // fixed 用上面那个数 / self 让 TA 按人设自己定
        noticeMode: 'rel'   // rel 按关系网+人设 / all 所有人都注意到 / none 谁都别提
    };
    async function save() { try { if (LF) await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) {} }
    async function load() {
        try { if (LF) { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } } catch (e) {}
        if (!Array.isArray(S.log)) S.log = [];
        if (!S.auto || typeof S.auto !== 'object') S.auto = {};
    }
    const toast = m => { try { if (typeof showToast === 'function') showToast('', '🎀 换装', m, null, null, false); } catch (e) {} };

    /* ================= 真的换 ================= */
    async function doApply(kind, target, src, by, note) {
        const K = kindOf(kind);
        let ok = false;
        try { ok = K.apply(target, src); } catch (e) { ok = false; }
        if (!ok) { toast('这一样现在换不了'); return false; }
        S.log.unshift({ id: uid(), at: Date.now(), kind, target: String(target), src, by: String(by || 'me'), note: note || '' });
        // 换装记录不设条数上限（以前只留 60 条）
        await save();
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        // 该刷的地方都刷一遍
        try {
            if (typeof renderProfilePage === 'function' && typeof currentProfileId !== 'undefined'
                && String(currentProfileId) === String(target)) renderProfilePage(target);
            if (typeof renderChatMessages === 'function') renderChatMessages();
            if (typeof renderChatCharList === 'function') renderChatCharList();
            if (typeof renderPosts === 'function') renderPosts();
            if (typeof gyPhoneRepaint === 'function') gyPhoneRepaint();
        } catch (e) {}
        toast((K.who === 'me' ? '你的' : nameOf(target) + '的') + K.name + '换好了');
        notice(kind, target, src, by);
        return true;
    }
    window.gyDressApply = doApply;

    /* ================= 谁会注意到 =================
       不是全世界一起弹通知。默认按**关系网 + 人设**挑人：
       跟当事人有关系线的、关系分高的、爱观察的更可能先看见。 */
    function relatedTo(target) {
        const out = [];
        const isMe = String(target) === 'me';
        chars().forEach(c => {
            if (!isMe && String(c.id) === String(target)) return;
            let w = 0;
            // 有关系线的更可能注意到
            try {
                (typeof charRelationships !== 'undefined' ? charRelationships : []).forEach(r => {
                    const a = String(r.fromId), b = String(r.toId);
                    if ((a === String(c.id) && b === String(target)) || (b === String(c.id) && a === String(target))) w += 2;
                });
            } catch (e) {}
            // 跟你熟的更可能注意到你换了东西
            if (isMe) { try { if (window.gyRel) w += Math.max(0, Number(window.gyRel.score(c.id)) || 0) / 40; } catch (e) {} }
            // 同一个势力的
            try {
                if (!isMe && typeof getCharFactions === 'function') {
                    const f1 = getCharFactions(c) || [], t = charOf(target);
                    const f2 = t ? (getCharFactions(t) || []) : [];
                    if (f1.some(x => f2.includes(x))) w += 1.2;
                }
            } catch (e) {}
            if (w > 0) out.push({ c, w });
        });
        return out.sort((a, b) => b.w - a.w);
    }
    async function notice(kind, target, src, by) {
        if (!on('dressNotice')) return;
        const mode = S.noticeMode;
        if (mode === 'none') return;
        let picks = [];
        if (mode === 'all') picks = chars().filter(c => String(c.id) !== String(target)).map(c => ({ c, w: 1 }));
        else {
            const pool = relatedTo(target);
            if (!pool.length) return;
            // 权重越高越可能开口，但不是必然——不然每次都是同一批人
            picks = pool.filter(x => Math.random() < Math.min(0.75, 0.18 + x.w * 0.16)).slice(0, 3);
        }
        if (!picks.length) return;
        const K = kindOf(kind);
        for (const { c } of picks) {
            let line = '';
            try { line = await sayNotice(c, K, target, src); } catch (e) {}
            // 谁开了口、说了什么，记在这次换装那一条上——
            // 角色手机里的聊天和小剧场要用到这件事（见 gyDressRecent / __gyDressCtxFor）
            if (line) {
                const e0 = S.log.find(x => String(x.target) === String(target) && x.kind === kind);
                if (e0) {
                    if (!Array.isArray(e0.saw)) e0.saw = [];
                    if (e0.saw.length < 4) e0.saw.push({ id: String(c.id), name: c.name, line });
                }
            }
        }
        await save();
    }
    async function sayNotice(c, K, target, src) {
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('dress', () => sayNoticeInner(c, K, target, src));
        return sayNoticeInner(c, K, target, src);
    }
    // 「生成时读什么」的开关（没登记过/注入中心还没就绪时一律当开着）
    const srcOn = k => { try { return !window.gyInjectSrc || window.gyInjectSrc.on('dress', k); } catch (e) { return true; } };
    // 最近换过的样子，拼成一小段给模型当素材
    function dressHistLine(charId) {
        try {
            const list = (typeof window.gyDressRecent === 'function') ? (window.gyDressRecent(charId, 5) || []) : [];
            if (!list.length) return '';
            return '\n【最近换过的样子】\n' + list.slice(0, 5).map(x => '· ' + x.text).join('\n') + '\n';
        } catch (e) { return ''; }
    }
    async function sayNoticeInner(c, K, target, src) {
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) return;
        const whose = !srcOn('uname') ? '对方'
            : (String(target) === 'me'
                ? ((typeof userDisplayName === 'function') ? userDisplayName(c) : '对方')
                : nameOf(target));
        const base = (srcOn('base') && typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name);
        const hist = srcOn('hist') ? dressHistLine(c.id) : '';
        const what = srcOn('what') ? `${whose}换了${K.name}` : '有件跟外表有关的小事';
        const ask = `${hist}你注意到${what}。
按你的性格决定要不要开口提这件事——可以夸、可以打趣、可以问一句"怎么突然换了"、
可以阴阳一句，也可以觉得没什么好说的。
不想提就只输出 NO；想说就直接输出那句话，30 字以内，不要引号。`;
        const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
        const d = await callChatCompletionAPI(api, msgs);
        const raw = (d?.choices?.[0]?.message?.content || '').trim();
        if (!raw || raw.toUpperCase().indexOf('NO') === 0) return;
        const t = raw.replace(/^["「]|["」]$/g, '').trim().slice(0, 60);
        if (t && typeof deliverCharMoveToChatMessage === 'function') deliverCharMoveToChatMessage(c, t, null);
        return t;
    }

    /* ================= 这些换装记忆给别处用 =================
       角色手机里的聊天、小剧场都要拿它——"你换头像了"这种话，
       只有真发生过才说得出口。 */
    const agoTxt = t => { const h = Math.round((Date.now() - t) / 3600000);
        return h < 1 ? '刚刚' : h < 24 ? h + ' 小时前' : Math.round(h / 24) + ' 天前'; };
    // 跟某个角色有关的换装：TA 自己换的、别人给 TA 换的、以及 TA 注意到别人换了的
    window.gyDressRecent = function (charId, n) {
        const id = String(charId);
        const out = [];
        (S.log || []).forEach(e => {
            const K = kindOf(e.kind);
            const whose = e.target === 'me' ? '对方' : nameOf(e.target);
            if (String(e.target) === id) {
                out.push({ at: e.at, mine: true,
                    text: `${agoTxt(e.at)}你换了${K.name}${String(e.by) === id ? '（自己想换的）' : '（' + (e.by === 'me' ? '对方' : nameOf(e.by)) + '提议的，你答应了）'}` });
            } else if (String(e.by) === id) {
                out.push({ at: e.at, mine: false, text: `${agoTxt(e.at)}你给${whose}换了${K.name}` });
            }
            (e.saw || []).forEach(w => {
                if (String(w.id) !== id) return;
                out.push({ at: e.at, mine: false, text: `${agoTxt(e.at)}你注意到${whose}换了${K.name}，你当时说的是「${w.line}」` });
            });
        });
        return out.sort((a, b) => b.at - a.at).slice(0, n || 5);
    };
    // 换装这件事在两个人之间留下了什么（小剧场、手机里的对话都用这个）
    window.gyDressBetween = function (aId, bId, n) {
        const A = String(aId), B = String(bId);
        const out = [];
        (S.log || []).forEach(e => {
            const K = kindOf(e.kind);
            const t = String(e.target), by = String(e.by);
            const saw = (e.saw || []).map(x => String(x.id));
            const line = (e.saw || []).find(x => String(x.id) === A || String(x.id) === B);
            const hitA = t === A || by === A || saw.includes(A);
            const hitB = t === B || by === B || saw.includes(B);
            if (!hitA || !hitB) return;
            const who = t === A ? nameOf(A) : t === B ? nameOf(B) : '对方';
            out.push({ at: e.at, text: `${agoTxt(e.at)}${who}换了${K.name}${line ? `，${nameOf(line.id)}说了句「${line.line}」` : ''}` });
        });
        return out.sort((a, b) => b.at - a.at).slice(0, n || 3);
    };
    // 进 prompt 的那一段
    window.__gyDressCtxFor = function (charId) {
        try {
            if (!on('dressNotice') && !on('dressAsk') && !on('dressCharSelf')) return '';
            const arr = window.gyDressRecent(charId, 4);
            if (!arr.length) return '';
            return `\n【换过的样子（真发生过的事）】\n` + arr.map(x => '· ' + x.text).join('\n') +
                `\n换头像、换背景、换壁纸这种事是真的发生了的，别当没这回事；` +
                `但也不用每次开口都提，除非现在正说到相关的。\n`;
        } catch (e) { return ''; }
    };

    /* ================= 换装邀请卡 =================
       卡上**直接把那张图放出来**——不看见图就没法判断同不同意。
       用 js/28 那套请求-回应的管线，卡面自己画（gyDressCardHtml）。 */
    function pushCard(hostId, sender, d) {
        if (typeof globalChats === 'undefined') return null;
        const sid = String(hostId);
        if (!globalChats[sid]) globalChats[sid] = [];
        globalChats[sid].push({
            sender, type: 'dress', dress: d, timestamp: Date.now(), readBy: [],
            text: `［换${kindOf(d.kind).name}］${nameOf(d.from)} 想给 ${nameOf(d.target)} 换一张`
        });
        return d;
    }
    function findCard(id) {
        if (typeof globalChats === 'undefined') return null;
        for (const sid in globalChats) {
            const arr = globalChats[sid] || [];
            for (let i = arr.length - 1; i >= 0; i--) {
                const m = arr[i];
                if (m && m.type === 'dress' && m.dress && m.dress.id === id) return { sid, d: m.dress };
            }
        }
        return null;
    }
    function refresh(charId) {
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        try {
            const open = typeof currentChatSessionId !== 'undefined' && String(currentChatSessionId) === String(charId)
                && document.getElementById('view-chat') && document.getElementById('view-chat').style.display !== 'none';
            if (open && typeof renderChatMessages === 'function') renderChatMessages();
            else if (typeof renderChatCharList === 'function') renderChatCharList();
        } catch (e) {}
    }

    window.gyDressCardHtml = function (msg) {
        const d = msg.dress || {};
        const K = kindOf(d.kind);
        const byMe = String(d.from) === 'me';
        const st = d.status;
        let foot = '';
        if (st === 'pending') {
            foot = byMe
                ? `<div class="gydr-wait"><i></i><i></i><i></i>等 ${esc(nameOf(d.charId))} 回话…</div>`
                : `<div class="gydr-acts">
                     <button type="button" class="gydr-b yes" onclick="gyDressAnswer('${d.id}',true)">换吧</button>
                     <button type="button" class="gydr-b" onclick="gyDressAnswer('${d.id}',false)">还是算了</button>
                   </div>`;
        } else if (st === 'yes') {
            foot = `<div class="gydr-said">${esc(d.line || '换了。')}</div>
                    <div class="gydr-done">✅ 已经换上了</div>`;
        } else {
            foot = `<div class="gydr-said no">${esc(d.line || '这次算了。')}</div>`;
        }
        return `
        <div class="gydr-card s-${esc(st)}">
          <div class="gydr-hd">${K.ico} 换${esc(K.name)}</div>
          <div class="gydr-img ${d.kind === 'avatar' ? 'round' : ''}"><img src="${esc(d.src)}" loading="lazy"></div>
          <div class="gydr-tit">${esc(d.say || (nameOf(d.from) + '想把' + nameOf(d.target) + '的' + K.name + '换成这张'))}</div>
          ${d.note ? `<div class="gydr-sub">${esc(d.note)}</div>` : ''}
          ${foot}
        </div>`;
    };

    // 你提议给某个角色换（TA 决定）
    window.gyDressAsk = async function ({ charId, kind, src, note = '' } = {}) {
        const c = charOf(charId); if (!c || !src) return null;
        const K = kindOf(kind);
        const d = { id: uid(), kind, src, note, charId: String(charId), target: String(kind === 'appbg' ? 'me' : charId),
                    from: 'me', status: 'pending', line: '',
                    say: `${meName()}想把${c.name}的${K.name}换成这张` };
        // 开关关掉 = 不问了，直接换（你说了算）
        if (!on('dressAsk')) { await doApply(kind, d.target, src, 'me', note); return d; }
        pushCard(charId, 'me', d);
        refresh(charId);
        try { if (typeof switchMainView === 'function') { switchMainView('chat'); if (typeof switchChatSession === 'function') switchChatSession(charId); } } catch (e) {}
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { d.status = 'yes'; d.line = ''; await doApply(kind, d.target, src, 'me', note); refresh(charId); return d; }
        try {
            const uname = (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name);
            const ask = `${uname}挑了一张图，想把你的${K.name}换成它${note ? `（说："${note}"）` : ''}。
你没法真的"看见"这张图，但你可以按自己的性格决定要不要让对方替你换——
爱不爱折腾这些、在不在意别人动自己的东西、这会儿是什么心情，都算数。
只输出 JSON：{"ok": true或false, "line": "一句话，25字以内，不要引号"}`;
            const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
            const data = await callChatCompletionAPI(api, msgs);
            let r = (typeof parseModelJson === 'function') ? parseModelJson(data.choices?.[0]?.message?.content || '') : null;
            if (Array.isArray(r)) r = r[0];
            const ok = !r || r.ok !== false;
            d.status = ok ? 'yes' : 'no';
            d.line = String((r && r.line) || '').slice(0, 50) || (ok ? '行啊，换吧。' : '还是算了。');
            if (ok) await doApply(kind, d.target, src, 'me', note);
            refresh(charId);
            if (typeof addNotification === 'function') addNotification(`<b>${c.name}</b> ${ok ? '同意换' : '没同意换'}${K.name}`, null, charId, c, d.line);
        } catch (e) {
            d.status = 'yes'; await doApply(kind, d.target, src, 'me', note); refresh(charId);
        }
        return d;
    };
    // 角色提议（换自己的，或者想给你的 app 壁纸换一张）→ 你来点
    window.gyDressFromChar = function ({ charId, kind, src, note = '', line = '' } = {}) {
        const c = charOf(charId); if (!c || !src) return null;
        const K = kindOf(kind);
        const target = (kind === 'appbg') ? 'me' : String(charId);
        const d = { id: uid(), kind, src, note, charId: String(charId), target,
                    from: String(charId), status: 'pending', line: '',
                    say: target === 'me' ? `${c.name}想把你的${K.name}换成这张` : `${c.name}想把自己的${K.name}换成这张` };
        if (line) {
            if (!globalChats[String(charId)]) globalChats[String(charId)] = [];
            globalChats[String(charId)].push({ sender: charId, text: line, timestamp: Date.now(), readBy: [] });
        }
        pushCard(charId, charId, d);
        refresh(charId);
        if (typeof addNotification === 'function') addNotification(`<b>${c.name}</b> 想换${K.name} ${K.ico}`, null, charId, c, note || '等你回话');
        return d;
    };
    /* 你答完之后 TA 得有个反应。
       以前卡上写死"换上了。/ 这次算了。"——是 TA 提的议，你点了同意或者拒绝，
       TA 一个字不说很奇怪：被答应了会高兴、被拒了可能没所谓也可能有点在意。
       所以这里问一次（默认走副 API，一句话），拿不到就退回原来那两句。 */
    window.gyDressAnswer = async function (id, yes) {
        const f = findCard(id); if (!f) return;
        const d = f.d;
        if (d.status !== 'pending') return;
        d.status = yes ? 'yes' : 'no';
        d.line = yes ? '换上了。' : '这次算了。';
        if (yes) await doApply(d.kind, d.target, d.src, d.from, d.note);
        refresh(f.sid);
        try { await sayBack(d, yes); } catch (e) {}
    };
    // 报场景：这段生成属于「dress」那一场（soft＝外层已有场景就不抢）
    async function sayBack() {
        const a = arguments;
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('dress', () => sayBackInner.apply(null, a));
        return sayBackInner.apply(null, a);
    }
    async function sayBackInner(d, yes) {
        if (!on('dressAsk') && !on('dressCharSelf')) return;
        const c = charOf(d.charId); if (!c) return;
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) return;
        const K = kindOf(d.kind);
        const whose = d.target === 'me' ? '对方的' : '你自己的';
        const base = (srcOn('base') && typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name);
        const hist = srcOn('hist') ? dressHistLine(c.id) : '';
        const uname = (srcOn('uname') && typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
        const what = srcOn('what') ? `把${whose}${K.name}换成一张图` : '换点什么';
        const ask = `${hist}你刚才提议${what}，${uname}${yes ? '答应了，已经换上了' : '说这次算了，没换'}。
按你的性格回一句。${yes ? '可以高兴、可以只是"嗯"、可以顺口说点别的。' : '可以完全没所谓，也可以有点在意、有点扫兴、或者嘴上说没事——别一律写成体贴懂事。'}
一句话 25 字以内，不要引号，不要旁白。按你的性格这会儿真不会开口就只输出 NO。`;
        const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
        const r = await callChatCompletionAPI(api, msgs);
        let t = (r && r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content || '').trim();
        if (!t || t.toUpperCase().indexOf('NO') === 0) return;
        t = t.replace(/^["「]|["」]$/g, '').trim().slice(0, 40);
        if (!t) return;
        d.line = t;                                   // 卡上那句换成 TA 真说的
        const f2 = findCard(d.id); if (f2) refresh(f2.sid);
        // 顺带在聊天里也说一句，不然只有卡上一行字，像系统提示
        try { if (typeof deliverCharMoveToChatMessage === 'function') deliverCharMoveToChatMessage(c, t, null); } catch (e) {}
    }

    // 让 TA 自己挑这张图该换哪一样（顺带给出同不同意）
    // 报场景：这段生成属于「dress」那一场（soft＝外层已有场景就不抢）
    async function askKind() {
        const a = arguments;
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('dress', () => askKindInner.apply(null, a));
        return askKindInner.apply(null, a);
    }
    async function askKindInner(charId, src, note) {
        const c = charOf(charId); if (!c) return;
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { toast('还没配 API Key，先按头像来'); return window.gyDressAsk({ charId, kind: 'avatar', src, note }); }
        toast('问问 ' + c.name + ' 想拿这张图换哪一样…');
        try {
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name);
            const ask = `${(typeof userDisplayName === 'function') ? userDisplayName(c) : '对方'}给你看了一张图${note ? `，还说了一句"${note}"` : ''}，
说这张图给你用，让你自己决定拿来换哪一样。
可选：avatar（你的头像）/ banner（你资料页的背景图）/ wall（你手机的壁纸）。
按你的性格挑一个——有人只肯换壁纸（那是自己看的），有人无所谓什么都行，也有人根本不想换。
只输出 JSON：{"kind":"avatar|banner|wall","ok":true或false,"line":"你要说的一句话，25字以内"}`;
            const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
            const d = await callChatCompletionAPI(api, msgs);
            let t = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
            if (typeof extractAfterFinalMarker === 'function') t = extractAfterFinalMarker(t).trim();
            t = t.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
            let o = (typeof extractJsonObject === 'function') ? extractJsonObject(t) : JSON.parse(t);
            if (Array.isArray(o)) o = o[0];
            const kind = (o && ['avatar', 'banner', 'wall'].indexOf(o.kind) >= 0) ? o.kind : 'avatar';
            const line = String((o && o.line) || '').replace(/^["「]|["」]$/g, '').slice(0, 40);
            if (o && o.ok === false) {
                // TA 自己就不想换：别再发一张要 TA 点的卡，直接在聊天里回一句
                if (line && typeof deliverCharMoveToChatMessage === 'function') deliverCharMoveToChatMessage(c, line, null);
                toast(c.name + '：' + (line || '这次算了'));
                return;
            }
            toast(c.name + ' 想拿它当' + kindOf(kind).name + (line ? '：' + line : ''));
            await window.gyDressAsk({ charId, kind, src, note: note || line });
        } catch (e) {
            toast('没问出来，先按头像来');
            await window.gyDressAsk({ charId, kind: 'avatar', src, note });
        }
    }

    /* ================= 从图库点一张图 → 拿它换什么 ================= */
    window.gyDressPicker = function (im) {
        if (!im) return;
        const cs = chars();
        let ov = document.getElementById('gyDressPick');
        if (!ov) { ov = document.createElement('div'); ov.id = 'gyDressPick'; ov.className = 'modal-overlay';
                   ov.onclick = e => { if (e.target === ov) ov.style.display = 'none'; };
                   document.body.appendChild(ov); }
        ov.innerHTML = `<div class="modal-box" style="width:92%;max-width:380px;">
            <h3 style="margin:0 0 10px;">拿这张图换点什么</h3>
            <img src="${esc(im.src)}" style="width:100%;max-height:170px;object-fit:cover;border-radius:12px;display:block;margin-bottom:12px;">
            <div class="input-group"><label>换什么</label>
                <select id="gydrKind">
                    <option value="self">让 TA 自己看着办（头像 / 背景 / 壁纸）</option>
                    <option value="avatar">角色头像</option>
                    <option value="banner">角色资料背景图</option>
                    <option value="wall">角色手机壁纸</option>
                    <option value="appbg">我自己的 app 壁纸</option>
                </select></div>
            <div class="input-group" id="gydrWhoBox"><label>换给谁</label>
                <select id="gydrWho">${cs.length ? cs.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') : '<option value="">（还没有角色）</option>'}</select></div>
            <div class="input-group"><label>顺便说一句（选填）</label>
                <input type="text" id="gydrNote" placeholder="例：这张挺像你的"></div>
            <div class="form-hint" style="margin-bottom:10px;">
                换角色身上的东西会**先在私聊里问一声**（卡上会把这张图放出来），TA 同意了才换。
                想直接换不问，就去开关里关掉「换之前先问一声」。
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button type="button" class="btn-cancel" style="margin:0;" onclick="document.getElementById('gyDressPick').style.display='none'">取消</button>
                <button type="button" class="btn-primary" style="margin:0;width:auto;" onclick="gyDressGo('${im.id}')">换</button>
            </div></div>`;
        ov.style.display = 'flex';
        const k = document.getElementById('gydrKind');
        const box = document.getElementById('gydrWhoBox');
        k.onchange = () => { box.style.display = k.value === 'appbg' ? 'none' : ''; };
    };
    window.gyDressGo = async function (imgId) {
        const im = (window.gyGallery && window.gyGallery.get(imgId)) || null;
        if (!im) return;
        const kind = (document.getElementById('gydrKind') || {}).value || 'avatar';
        const who = (document.getElementById('gydrWho') || {}).value || '';
        const note = ((document.getElementById('gydrNote') || {}).value || '').trim();
        const ov = document.getElementById('gyDressPick'); if (ov) ov.style.display = 'none';
        try { if (typeof gyGalleryClose === 'function') gyGalleryClose(); } catch (e) {}
        if (kind === 'appbg') { await doApply('appbg', 'me', im.src, 'me', note); return; }
        if (!who) return toast('先去角色中心搓一个角色');
        /* 「让 TA 自己看着办」：这个流程本来就是"先问一声、TA 同意了才换"，
           既然要问，那"这张图拿来当头像还是壁纸"也该让 TA 自己说。
           问一次就把"换哪一样 + 同不同意"一起定了，不多花一次调用。 */
        if (kind === 'self') { await askKind(who, im.src, note); return; }
        await window.gyDressAsk({ charId: who, kind, src: im.src, note });
    };

    /* ================= 角色自己想换 =================
       三种节奏：你自定义多久一次（everyGapH）、交给自主模式（填 0）、
       或者**让 TA 按自己的人设定**（gapMode='self'）——
       爱打扮的人两三天就想换一张，冷淡的人半年不动一次，
       这本来就不该是所有角色一个数。本地算，不调 API。 */
    function gapHoursFor(c) {
        if (S.gapMode !== 'self') return gyNum(S.everyGapH, 72);
        const per = String((c && c.persona) || '') + ' ' + String((c && c.bio) || '');
        let h = 72;
        if (/爱美|讲究|精致|臭美|时髦|潮|自恋|爱打扮|少女|活泼|跳脱|善变/.test(per)) h = 30;
        if (/冷淡|沉默|寡言|懒|不在意|随便|朴素|克制|寡淡|面瘫|古板|守旧/.test(per)) h = 240;
        if (/念旧|长情|执拗|固执/.test(per)) h = 400;
        // 同一个人上下浮动 ±25%，别整齐得像定时器
        const seed = String((c && c.id) || '').split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
        return Math.round(h * (0.75 + (seed % 100) / 200));
    }
    window.gyDressGapOf = charId => gapHoursFor(charOf(charId));
    async function maybeSelfChange(c) {
        if (!on('dressCharSelf')) return false;
        const imgs = (window.gyGallery && window.gyGallery.seenBy(c.id)) || [];
        if (!imgs.length) return false;
        const gap = gapHoursFor(c) * 3600000;
        if (Date.now() - (S.auto[String(c.id)] || 0) < gap) return false;
        S.auto[String(c.id)] = Date.now(); await save();
        const im = rnd(imgs);
        const kind = rnd(['avatar', 'avatar', 'banner', 'wall']);
        window.gyDressFromChar({ charId: c.id, kind, src: im.src,
            note: im.tag || '', line: rnd(['我想换个' + kindOf(kind).name + '。', '这张怎么样？', '看看这个，换成它行吗。']) });
        return true;
    }
    window.gyDressSelfNow = async function (charId) {
        const c = charOf(charId); if (!c) return;
        S.auto[String(charId)] = 0;
        const ok = await maybeSelfChange(c);
        if (!ok) toast('图库里没有 TA 能挑的图');
    };
    function addAutonomy() {
        try {
            if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || !Array.isArray(GY_AUTONOMY_ACTIONS)) return;
            if (GY_AUTONOMY_ACTIONS.some(a => a.key === 'dress_change')) return;
            GY_AUTONOMY_ACTIONS.push({
                key: 'dress_change', label: '想换个头像/壁纸',
                hint: '从图库里挑一张，在私聊里问你行不行——卡上会把那张图放出来',
                need: c => on('dressCharSelf') && !!(window.gyGallery && window.gyGallery.seenBy(c.id).length),
                async run(char) {
                    S.auto[String(char.id)] = 0;
                    await maybeSelfChange(char);
                    return '想换个头像';
                }
            });
        } catch (e) {}
    }
    let beat = null;
    function startBeat() {
        if (beat) return;
        beat = setInterval(async () => {
            if (!on('dressCharSelf') || (S.gapMode !== 'self' && S.everyGapH <= 0)) return;
            const cs = chars();
            if (!cs.length) return;
            try { await maybeSelfChange(rnd(cs)); } catch (e) {}
        }, 10 * 60 * 1000);
    }
    // 💌 聊天 ⋮ 里的「给 TA 换张头像」——图从图库来，挑完发邀请卡，TA 同意才换
    (function regChatAct(tries) {
        try {
            if (typeof window.gyChatActionAdd === 'function' && typeof window.gyGalleryOpen === 'function') {
                window.gyChatActionAdd({
                    id: 'dress', icon: '🎀', label: '给 TA 换张头像 / 背景', sub: '从图库挑，TA 同意才换',
                    // 图库里一张图都没有就不显示——提了也换不了
                    show: () => on('dressAsk') && !!(window.gyGallery && window.gyGallery.all().length),
                    run: () => window.gyGalleryOpen()
                });
                return;
            }
        } catch (e) {}
        if ((tries || 0) < 12) setTimeout(() => regChatAct((tries || 0) + 1), 500);
    })(0);

    window.gyDressSet = async function (k, v) {
        S[k] = (k === 'everyGapH') ? parseInt(v) : v;
        await save();
        try { if (typeof window.gyGalleryRepaint === 'function') window.gyGalleryRepaint(); } catch (e) {}
    };
    window.gyDressCfg = () => JSON.parse(JSON.stringify({ everyGapH: S.everyGapH, noticeMode: S.noticeMode, gapMode: S.gapMode || 'fixed' }));

    /* ---------- 「生成时读什么」登记 ----------
       换装这几句话（TA 注意到你换了样子 / 你答应或拒绝之后 TA 的反应）是现生成的，
       生成时会去读一批东西当素材。以前读什么是写死的，现在逐条登记出来由你决定。 */
    function regSrc() {
        try {
            if (!window.gyInjectSrc || typeof window.gyInjectSrc.def !== 'function') return;
            window.gyInjectSrc.def({
                feat: 'dress', icon: '🎀', title: '有人注意到你换了样子',
                note: '生成这几句话时递给模型的材料。全关掉的话模型手里只剩"换了什么"这一件事实，说出来的话会很空。',
                items: [
                    { k: 'base', label: '这个角色的整份人设与记忆',
                      desc: '走的是跟聊天同一套 prompt（人设、世界书、日程、关系账本、小功能那些）。具体带哪几段，在上面「① prompt 里有哪几段」里按「有人注意到你换了样子」这一场单独设。' },
                    { k: 'what', label: '换的是什么（头像 / 背景 / 壁纸）+ 换的是谁的',
                      desc: '这条关掉模型就不知道在说哪件事了，一般别关。' },
                    { k: 'hist', label: '最近换过的样子（谁提的、谁答应了、谁注意到了）',
                      desc: '让 TA 说得出"你上次那张也挺好看"这种话。关掉之后每次反应都是孤立的。' },
                    { k: 'uname', label: '你在 TA 面前的称呼', desc: '' }
                ]
            });
        } catch (e) {}
    }

    /* ---------- 开关 ---------- */
    function addSwitches() {
        try {
            if (typeof AUTO_FEATURE_DEFS === 'undefined' || !Array.isArray(AUTO_FEATURE_DEFS)) return;
            const defs = [
                { key: 'dressAsk', label: '换之前先在私聊里问一声',
                  desc: '给角色换头像/背景/手机壁纸时，先发一张卡过去——**卡上直接把那张图放出来**，TA 同意了才换。关掉就是你说换就换，不问。',
                  cost: '每次问一次调用', group: '图片', where: '小功能 → 🖼️ 图库 → 点一张图' },
                { key: 'dressCharSelf', label: '角色自己也会想换',
                  desc: '角色从**自己看得到的图**（公共图库 + 自己的私库）里挑一张，在私聊里问你行不行。间隔可以你自己定（默认 72 小时一次），也可以关掉这个节拍、交给自主模式让 TA 自己感受什么时候想换。',
                  cost: '不额外调 API（挑图是本地的；对话那一步走自主模式本来的预算）', defaultOff: true,
                  group: '图片', where: '私聊里的换装卡' },
                { key: 'dressNotice', label: '换完之后别人可能会注意到',
                  desc: '不是全世界一起弹通知：默认按**关系网 + 人设**挑人——有关系线的、同势力的、跟你熟的更可能先看见，然后按自己的性格决定说不说、说什么（夸、打趣、阴阳、或者不提）。也可以改成"所有人都注意到"或者"谁都别提"。',
                  cost: '每个开口的人一次调用（最多 3 个）', group: '图片', where: '小功能 → 🖼️ 图库（换装设置）' }
            ];
            defs.forEach(d => { if (!AUTO_FEATURE_DEFS.some(x => x.key === d.key)) AUTO_FEATURE_DEFS.push(d); });
        } catch (e) {}
    }

    const CSS = `
    .gydr-card{width:min(260px,84%);margin:10px auto;border-radius:16px;overflow:hidden;
        background:var(--gy-accent-soft);border:1px solid var(--gy-accent-line);}
    .gydr-hd{font-size:11.5px;letter-spacing:.1em;color:var(--gy-accent);padding:9px 13px 7px;font-weight:700;}
    .gydr-img{margin:0 13px;border-radius:12px;overflow:hidden;background:rgba(128,128,128,.12);}
    .gydr-img img{width:100%;max-height:180px;object-fit:cover;display:block;}
    .gydr-img.round{width:98px;height:98px;border-radius:50%;margin:0 auto;}
    .gydr-img.round img{height:100%;}
    .gydr-tit{font-size:13.5px;font-weight:600;padding:10px 13px 0;line-height:1.6;}
    .gydr-sub{font-size:12px;color:#8b98a5;padding:3px 13px 0;line-height:1.6;}
    .gydr-said{margin:9px 13px 0;background:rgba(128,128,128,.1);border-radius:9px;padding:8px 10px;
        font-size:12.5px;line-height:1.7;}
    .gydr-said.no{color:#8b98a5;}
    .gydr-done{font-size:12px;color:var(--gy-ok);padding:7px 13px 11px;font-weight:600;}
    .gydr-card.s-no .gydr-img{filter:grayscale(1);opacity:.6;}
    .gydr-acts{display:flex;gap:7px;padding:10px 13px 12px;}
    .gydr-b{flex:1;border-radius:8px;padding:8px 0;font-size:12.5px;font-weight:600;cursor:pointer;
        border:1px solid var(--gy-accent-line);background:transparent;color:var(--gy-accent);transition:.15s;}
    .gydr-b.yes{background:var(--gy-accent);color:var(--gy-accent-fg);border-color:transparent;}
    .gydr-b:hover{opacity:.87;}
    .gydr-wait{display:flex;align-items:center;gap:4px;font-size:12px;color:#8b98a5;padding:10px 13px 12px;}
    .gydr-wait i{width:4px;height:4px;border-radius:50%;background:var(--gy-accent);animation:gydrb 1s infinite;}
    .gydr-wait i:nth-child(2){animation-delay:.15s;} .gydr-wait i:nth-child(3){animation-delay:.3s;margin-right:5px;}
    @keyframes gydrb{0%,60%,100%{opacity:.25;}30%{opacity:1;}}
    `;
    function mount() {
        if (document.getElementById('gydrCss')) return;
        const st = document.createElement('style'); st.id = 'gydrCss'; st.textContent = CSS;
        document.head.appendChild(st);
    }

    (async function init() {
        mount();
        addSwitches();
        await load();
        startBeat();
        setTimeout(addAutonomy, 1500);
        // 注入中心可能比这个模块晚就绪，隔一会儿再登记一次（同 feat 会覆盖，不会重复）
        regSrc();
        setTimeout(regSrc, 1200);
        setTimeout(regSrc, 3000);
    })();
})();
