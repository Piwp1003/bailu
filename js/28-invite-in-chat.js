/* ===========================================================================
   js/28 —— 📨 邀请卡片：所有"一起做点什么"都发在私聊里
   ---------------------------------------------------------------------------
   以前几个一起做点什么的功能（一起看电影、一起听歌、一起阅读、约出去），
   邀请这件事是**在后台悄悄发生**的：点一下按钮 → 偷偷调一次 API → 弹个 toast
   说"TA 来了"。问题是：
     · 你在私聊里翻不到这段。明明是"你约了 TA、TA 答应了"这么具体的一件事，
       聊天记录里一个字都没有，下次 TA 也不记得
     · 拒绝了只剩一句 toast，八秒之后就没了
     · 每个功能各写各的，措辞、能不能拒绝、拒绝之后怎么办，四份代码四个样

   v105 起做成**聊天里的一张卡片**：
     · 你发出去的邀请 = 私聊里的一张卡，卡上写清楚是什么事、什么片子/哪首歌/哪个地方
     · TA 按人设决定去不去，答案写在同一张卡上（不是新开一条消息），
       并且带着 TA 自己那句话
     · TA 主动约你的时候，卡上是两个按钮：**你**来点「好啊 / 算了」
     · 答应之后卡片直接变成入口，点一下就进对应的功能页

   卡片的样子是自己画的（.gyiv-*），跟 app 的蓝 + 圆角 + 玻璃感一路，
   深色模式跟着变量走。不是气泡，也不套用任何现成的组件。

   💰 不额外花钱：邀请本来就要问 TA 一次，这里用的还是那一次。
   =========================================================================== */
(function () {
    if (window.__gyInviteLoaded) return;
    window.__gyInviteLoaded = true;

    const on = () => (typeof isAutoOn === 'function') ? isAutoOn('inviteInChat') : true;
    const charOf = id => (typeof myCharacters !== 'undefined' ? myCharacters : [])
        .find(c => String(c.id) === String(id)) || null;
    const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(s || '')
        : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ---------- 每种邀请：图标、说法、答应之后干什么 ----------
       模块想加自己的类型，往 window.GY_INVITE_KINDS 里塞一条就行。 */
    /* accept(inv)：点「进放映厅 ›」这类入口时干什么。inv 可以是完整的邀请，也可以只有 {charId}。
       · inv.filmId / trackId / bookId 在的话，直接打开**那一部 / 那首 / 那本**（TA 自己找来的东西）
       · 没有 id 但有 title：先在片库/曲库/书架里按名字找；还找不到就打开「🌐 在线找」并把名字填好
       · inv.from 决定"这次是谁约的谁"——各功能里 TA 说话时会知道是自己发起的还是你发起的
       openOnYes：TA 约你、你点了「好啊」，而这一页刷新过（回调丢了）时，照样直接打开 */
    const byOf = inv => (inv && inv.from === 'me') ? 'me' : 'char';
    const normT = s => String(s || '').replace(/[《》「」〈〉<>"'“”\s]/g, '').toLowerCase();
    const titleHit = (a, b) => { const x = normT(a), y = normT(b); return !!x && !!y && (x === y || x.indexOf(y) !== -1 || y.indexOf(x) !== -1); };
    const KINDS = {
        film: {
            ico: '🎬', name: '一起看电影', verb: '一起看', openOnYes: true,
            go: '进放映厅', async accept(inv) {
                inv = inv || {};
                try {
                    if (typeof window.fbOpenView === 'function') window.fbOpenView();
                    else if (typeof switchMainView === 'function') switchMainView('watchTogether');
                } catch (e) {}
                let fid = inv.filmId || '';
                try { if (!fid && inv.title && typeof window.fbFindFilm === 'function') { const f = window.fbFindFilm(inv.title); if (f) fid = f.id; } } catch (e) {}
                try {
                    if (fid && typeof window.fbResume === 'function') await window.fbResume(fid);
                    else if (inv.title && typeof window.gyResOpen === 'function') window.gyResOpen('film', inv.title);
                } catch (e) { console.warn('[邀请] 打开片子失败：', e); }
                try { if (typeof window.fbToggleWatcher === 'function') window.fbToggleWatcher(inv.charId, true, byOf(inv)); } catch (e) {}
            }
        },
        music: {
            ico: '🎧', name: '一起听歌', verb: '一起听', openOnYes: true,
            go: '去听', accept(inv) {
                inv = inv || {};
                try { if (typeof window.gymJoinListener === 'function') window.gymJoinListener(inv.charId, byOf(inv)); } catch (e) {}
                try { if (typeof gyOpenFeaturePage === 'function') gyOpenFeaturePage('music'); } catch (e) {}
                try { if (typeof window.gymShow === 'function') window.gymShow(); } catch (e) {}
                let tid = inv.trackId || '';
                try { if (!tid && inv.title && typeof window.gymFindTrack === 'function') { const t = window.gymFindTrack(inv.title); if (t) tid = t.id; } } catch (e) {}
                try {
                    if (tid && typeof window.gymPlayTrackId === 'function') window.gymPlayTrackId(tid);
                    else if (inv.title && typeof window.gyResOpen === 'function') window.gyResOpen('music', inv.title);
                } catch (e) {}
            }
        },
        read: {
            ico: '📖', name: '一起阅读', verb: '一起读', openOnYes: true,
            go: '去读', accept(inv) {
                inv = inv || {};
                let bid = inv.bookId || '';
                try {
                    if (!bid && inv.title && window.__rtState) {
                        const b = (window.__rtState.books || []).find(x => titleHit(x.title, inv.title));
                        if (b) bid = b.id;
                    }
                } catch (e) {}
                try { if (typeof window.rtOpenOverlay === 'function') window.rtOpenOverlay(); else if (typeof gyOpenFeaturePage === 'function') gyOpenFeaturePage('reading_together'); } catch (e) {}
                if (bid) {
                    try { if (typeof window.rtOpenBook === 'function') window.rtOpenBook(bid); } catch (e) {}
                    try { if (typeof window.rtSetCompanion === 'function') window.rtSetCompanion(inv.charId, byOf(inv)); } catch (e) {}
                } else {
                    // 书还没到手：先记着"搭子是谁"，等你在线找到、打开那本书时自动接上
                    window.__rtPendingCompanion = { charId: String(inv.charId), by: byOf(inv) };
                    try { if (inv.title && typeof window.gyResOpen === 'function') window.gyResOpen('book', inv.title); } catch (e) {}
                }
            }
        },
        date: {
            ico: '🤝', name: '约出去', verb: '一起去',
            go: '看地图', accept() {
                try { if (typeof gyOpenFeaturePage === 'function') gyOpenFeaturePage('map'); } catch (e) {}
            },
            // 刷新之后回调没了：交给地图模块按卡上存的数据落地
            answer(inv, yes) { try { if (typeof window.gymapInviteAnswered === 'function') return window.gymapInviteAnswered(inv, yes); } catch (e) {} }
        },
        other: { ico: '💌', name: '邀请', verb: '一起', go: '看看', accept() {} }
    };
    window.GY_INVITE_KINDS = KINDS;
    const kindOf = k => KINDS[k] || KINDS.other;

    /* ---------- 存 / 找 ---------- */
    function pushCard(charId, sender, inv) {
        if (typeof globalChats === 'undefined') return null;
        const sid = String(charId);
        if (!globalChats[sid]) globalChats[sid] = [];
        // text 是给模型和消息列表预览看的纯文字版——卡片本身不参与 prompt 拼装，
        // 但历史里得留一句人话，不然 TA 回头翻记录只看到一条空消息。
        // ⚠️ 写清楚"谁约的谁"：以前只写「［一起看电影］片名」，模型翻记录时分不清是谁发起的
        const msg = {
            sender, type: 'invite', invite: inv, timestamp: Date.now(), readBy: [],
            text: cardText(inv)
        };
        globalChats[sid].push(msg);
        return msg;
    }
    function cardText(inv) {
        const K = kindOf(inv.kind);
        const c = charOf(inv.charId);
        const cn = (c && c.name) || '对方';
        const un = (typeof userDisplayName === 'function') ? userDisplayName(c) : '用户';
        const a = inv.from === 'me' ? un : cn, b = inv.from === 'me' ? cn : un;
        const head = inv.say ? inv.say : `${a}约${b}${K.verb}${inv.title ? `「${inv.title}」` : ''}`;
        const ans = inv.status === 'yes' ? `（${b}答应了）` : inv.status === 'no' ? `（${b}没答应）` : '';
        return `［${K.name}邀请］${head}${inv.sub ? '　' + inv.sub : ''}${ans}`;
    }
    // 回答之后把卡片那条消息的文字也更新掉（历史里模型读的是这段文字）
    function retext(id) {
        const f = findCard(id);
        if (f && f.msg && f.msg.invite) f.msg.text = cardText(f.msg.invite);
    }
    function findCard(id) {
        if (typeof globalChats === 'undefined') return null;
        for (const sid in globalChats) {
            const arr = globalChats[sid] || [];
            for (let i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].type === 'invite' && arr[i].invite && arr[i].invite.id === id) {
                    return { sid, idx: i, msg: arr[i] };
                }
            }
        }
        return null;
    }
    function refresh(charId) {
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        try {
            const open = typeof currentChatSessionId !== 'undefined'
                && String(currentChatSessionId) === String(charId)
                && document.getElementById('view-chat')
                && document.getElementById('view-chat').style.display !== 'none';
            if (open && typeof renderChatMessages === 'function') renderChatMessages();
            else if (typeof renderChatCharList === 'function') renderChatCharList();
        } catch (e) {}
    }
    function jumpTo(charId) {
        try {
            if (typeof switchMainView === 'function') switchMainView('chat');
            if (typeof switchChatSession === 'function') switchChatSession(charId);
        } catch (e) {}
    }

    /* ================= 卡片长什么样 ================= */
    window.gyInviteCardHtml = function (msg, idx) {
        const inv = msg.invite || {};
        const K = kindOf(inv.kind);
        const c = charOf(inv.charId);
        const me = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : { name: '我' };
        const av = (x, n) => (typeof getAvatarHTML === 'function') ? getAvatarHTML(x, n || 38) : '';
        const byMe = inv.from === 'me';
        const who = byMe ? me : (c || { name: '对方' });
        const target = byMe ? (c || { name: '对方' }) : me;

        // 中间那条线：等回话时是虚线 + 心跳，答应了是实线，拒绝了断开
        const linkCls = inv.status === 'yes' ? 'ok' : inv.status === 'no' ? 'no' : 'wait';

        let foot = '';
        if (inv.status === 'pending') {
            foot = byMe
                ? `<div class="gyiv-wait"><span class="gyiv-dots"><i></i><i></i><i></i></span>等 ${esc(target.name)} 回话…</div>`
                : `<div class="gyiv-acts">
                       <button type="button" class="gyiv-btn yes" onclick="gyInviteAnswer('${inv.id}',true)">好啊</button>
                       <button type="button" class="gyiv-btn no" onclick="gyInviteAnswer('${inv.id}',false)">算了</button>
                   </div>`;
        } else if (inv.status === 'yes') {
            foot = `<div class="gyiv-said ok">${inv.line ? esc(inv.line) : '说定了。'}</div>
                    <div class="gyiv-acts"><button type="button" class="gyiv-btn go" onclick="gyInviteGo('${inv.id}')">${esc(K.go)} ›</button></div>`;
        } else {
            foot = `<div class="gyiv-said no">${inv.line ? esc(inv.line) : '这次算了。'}</div>`;
        }

        return `
        <div class="gyiv-row">
          <div class="gyiv-card ${linkCls}" data-kind="${esc(inv.kind || 'other')}">
            <div class="gyiv-tag">${K.ico} ${esc(K.name)}</div>
            <div class="gyiv-people">
              <div class="gyiv-p">${av(who, 38)}<span>${esc(who.name)}</span></div>
              <div class="gyiv-link"><i></i><b>${K.ico}</b><i></i></div>
              <div class="gyiv-p">${av(target, 38)}<span>${esc(target.name)}</span></div>
            </div>
            <div class="gyiv-title">${inv.say ? esc(inv.say)
                : `${esc(who.name)}想跟${esc(target.name)}${esc(K.verb)}${inv.title ? `「${esc(inv.title)}」` : ''}`}</div>
            ${inv.sub ? `<div class="gyiv-sub">${esc(inv.sub)}</div>` : ''}
            ${foot}
          </div>
        </div>`;
    };

    /* ================= 你约 TA ================= */
    // gyInviteSend({char, kind, title, sub, ask, onYes, onNo, jump})
    // ask 不传就用默认措辞。onYes/onNo 是这次邀请谈成/谈崩之后各自要做的事。
    const pendingCb = {};   // { 邀请id: {onYes, onNo} } —— 回调不进存档，只在这次会话里有效
    window.gyInviteSend = async function ({ char, kind = 'other', title = '', sub = '', ask, say = '', onYes, onNo, jump = true, filmId, trackId, bookId, data } = {}) {
        const c = (typeof char === 'object') ? char : charOf(char);
        if (!c) return null;
        const K = kindOf(kind);

        if (!on()) {
            // 开关关了：退回老样子——后台问一句，只弹个提示，不动聊天记录
            const r = await window.gyInviteAsk(c, ask || defaultAsk(c, K, title, sub), true);
            if (typeof showToast === 'function') showToast('', c.name, r.line || (r.ok ? '好啊。' : '这次算了。'), null, c.id, false);
            try { r.ok ? (onYes && onYes(r)) : (onNo && onNo(r)); } catch (e) {}
            return r;
        }

        // say：整句自己写（借看手机那种"请求"不是"一起做点什么"，套不进默认句式）
        const inv = { id: 'iv' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
                      kind, title, sub, say, charId: String(c.id), from: 'me', status: 'pending', line: '' };
        if (filmId) inv.filmId = String(filmId);
        if (trackId) inv.trackId = String(trackId);
        if (bookId) inv.bookId = String(bookId);
        if (data) inv.data = data;
        pendingCb[inv.id] = { onYes, onNo };
        pushCard(c.id, 'me', inv);
        refresh(c.id);
        if (jump) jumpTo(c.id);

        const r = await window.gyInviteAsk(c, ask || defaultAsk(c, K, title, sub), true);
        inv.status = r.ok ? 'yes' : 'no';
        inv.line = r.line || (r.ok ? '好啊。' : '这次算了。');
        retext(inv.id);
        refresh(c.id);
        if (typeof addNotification === 'function') {
            addNotification(`<b>${c.name}</b> ${r.ok ? '答应了' : '婉拒了'}你的邀请（${K.name}）`, null, c.id, c, inv.line);
        }
        try { r.ok ? (onYes && onYes(r)) : (onNo && onNo(r)); } catch (e) {}
        return r;
    };

    function defaultAsk(c, K, title, sub) {
        const uname = (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
        return `${uname}想约你${K.verb}${title ? `「${title}」` : ''}${sub ? `（${sub}）` : ''}。
按你自己的性格决定去不去——在忙、没心情、不喜欢这个、闹着别扭，都可以直接拒绝，不用勉强自己迎合。
只输出 JSON，不要 markdown：{"ok": true或false, "line": "你要说的一句话，30字以内，像人说话，不要引号"}`;
    }

    /* ================= TA 约你 ================= */
    // 卡片上是两个按钮，等**你**来点。TA 主动发起的功能（比如「角色主动约你出去」）走这里。
    // filmId / trackId / bookId：TA 自己找来的那一部 / 那首 / 那本（先用 gyInviteResolveItem 导进来），
    //   存在卡上（进存档），答应之后打开的就是它，而不是一个空的功能页。
    // data：这种邀请落地要用的其它数据（比如约出去的地点、时长），也存在卡上——刷新之后回调没了照样能落地。
    window.gyInviteFromChar = function ({ char, kind = 'other', title = '', sub = '', line = '', say = '', onYes, onNo, notify = true,
                                          filmId, trackId, bookId, foundTitle, data } = {}) {
        const c = (typeof char === 'object') ? char : charOf(char);
        if (!c) return null;
        const K = kindOf(kind);
        const inv = { id: 'iv' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
                      kind, title, sub, say, charId: String(c.id), from: 'char', status: 'pending', line: '', ask: line };
        if (filmId) inv.filmId = String(filmId);
        if (trackId) inv.trackId = String(trackId);
        if (bookId) inv.bookId = String(bookId);
        if (data) inv.data = data;
        const media = { film: 'filmId', music: 'trackId', read: 'bookId' }[kind];
        if (media && title) {
            if (!inv[media]) inv.sub = (sub ? sub + '　' : '') + '没找到能直接放的资源，点进去可以在线找找';
            else if (foundTitle && !titleHit(foundTitle, title)) inv.sub = (sub ? sub + '　' : '') + `找到的是《${foundTitle}》`;
        }
        pendingCb[inv.id] = { onYes, onNo };
        if (line) {
            // TA 开口那句话单独作为一条正常消息，卡片跟在后面——像真人先说一句再发个邀请
            if (!globalChats[String(c.id)]) globalChats[String(c.id)] = [];
            globalChats[String(c.id)].push({ sender: c.id, text: line, timestamp: Date.now(), readBy: [] });
        }
        pushCard(c.id, c.id, inv);
        refresh(c.id);
        if (notify && typeof addNotification === 'function') {
            addNotification(`<b>${c.name}</b> 约你${K.verb}${title ? `「${title}」` : ''} ${K.ico}`, null, c.id, c, line || '等你回话');
        }
        return inv;
    };

    // 你点了「好啊 / 算了」
    window.gyInviteAnswer = async function (id, yes) {
        const found = findCard(id);
        if (!found) return;
        const inv = found.msg.invite;
        if (inv.status !== 'pending') return;
        inv.status = yes ? 'yes' : 'no';
        inv.line = yes ? '（你答应了）' : '（你拒绝了）';
        retext(id);
        refresh(inv.charId);

        const K0 = kindOf(inv.kind);
        const cb = pendingCb[id];
        const fn = cb && (yes ? cb.onYes : cb.onNo);
        const quiet = r => { try { if (r && typeof r.catch === 'function') r.catch(e => console.warn('[邀请] 回调出错：', e)); } catch (e) {} };
        if (typeof fn === 'function') {
            try { quiet(fn(inv)); } catch (e) {}
        } else if (yes || !cb) {
            // 页面刷新过、回调丢了：按卡上存的东西重建
            try {
                if (typeof K0.answer === 'function') quiet(K0.answer(inv, yes));
                else if (yes && K0.openOnYes && typeof K0.accept === 'function') quiet(K0.accept(inv));
            } catch (e) { console.warn('[邀请] 按卡片重建回调失败：', e); }
        }
        delete pendingCb[id];

        // 让 TA 对你的回答接一句（用的是已有的那条投递通道，不额外弹窗）
        const c = charOf(inv.charId);
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (c && api && api.key) {
            try {
                const K = kindOf(inv.kind);
                const p = `你刚才约${(typeof userDisplayName === 'function') ? userDisplayName(c) : '对方'}${K.verb}${inv.title ? `「${inv.title}」` : ''}，`
                    + (yes ? '对方答应了。' : '对方拒绝了。')
                    + `\n按你的性格接一句（高兴、松口气、有点失落、无所谓都行），20 字以内，不要引号不要旁白。不想说就只输出 NO。`;
                const msgs = (typeof buildStructuredMessages === 'function')
                    ? buildStructuredMessages(buildBasePrompt(c, false, ''), [], p) : [{ role: 'user', content: p }];
                const data = await callChatCompletionAPI(api, msgs);
                let t = (data.choices?.[0]?.message?.content || '').trim().replace(/^["'“”「」]+|["'“”「」]+$/g, '');
                if (typeof stripReasoningBlocks === 'function') t = stripReasoningBlocks(t);
                if (t && !(t.toUpperCase().startsWith('NO') && t.length < 5)) {
                    globalChats[String(c.id)].push({ sender: c.id, text: t, timestamp: Date.now(), readBy: [] });
                    refresh(c.id);
                }
            } catch (e) { console.warn('[邀请] TA 对回答的反应没拿到：', e); }
        }
    };

    // 卡片上的「进放映厅 ›」这类入口
    window.gyInviteGo = function (id) {
        const found = findCard(id);
        if (!found) return;
        const inv = found.msg.invite;
        try { kindOf(inv.kind).accept(inv); } catch (e) { console.warn('[邀请] 打开对应功能失败：', e); }
    };

    /* ================= 🔎 TA 自己找来的片 / 歌 / 书：先导进来再发邀请 =================
       gyInviteResolveItem(kind, title) —— kind: 'film' | 'music' | 'read'（'book' 也认）
         1. 先在自己的片库 / 曲库 / 书架里按名字找
         2. 没有就在线找（js/59：只找合法免费的来源），找到能直接放的就导进来
       返回 {filmId} / {trackId} / {bookId}（外加 foundTitle＝真正找到的名字），实在找不到返回 null。
       调用方把返回值展开进 gyInviteFromChar({...}) 就行。 */
    const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
    async function resolveItemInner(kind, title) {
        const t = String(title || '').replace(/[《》「」]/g, '').trim();
        if (!t) return null;
        if (kind === 'film') {
            try { const f = typeof window.fbFindFilm === 'function' ? window.fbFindFilm(t) : null; if (f) return { filmId: f.id, foundTitle: f.title }; } catch (e) {}
            if (typeof window.gyResSearch !== 'function' || typeof window.fbAddUrl !== 'function') return null;
            const hits = await window.gyResSearch('film', t, { limit: 3 }).catch(() => []);
            for (const it of (hits || [])) {
                try {
                    const u = typeof window.gyResResolve === 'function' ? await window.gyResResolve('film', it) : it.url;
                    if (!u) continue;
                    const f = await window.fbAddUrl(u, it.title || t, { note: it.from || '', cover: it.cover || '' });
                    if (f) return { filmId: f.id, foundTitle: f.title };
                } catch (e) {}
            }
            return null;
        }
        if (kind === 'music') {
            try { const tr = typeof window.gymFindTrack === 'function' ? window.gymFindTrack(t) : null; if (tr) return { trackId: tr.id, foundTitle: tr.title }; } catch (e) {}
            if (typeof window.gyResSearch !== 'function' || typeof window.gymAddTrack !== 'function') return null;
            const hits = await window.gyResSearch('music', t, { limit: 3 }).catch(() => []);
            for (const it of (hits || [])) {
                try {
                    const u = typeof window.gyResResolve === 'function' ? await window.gyResResolve('music', it) : it.url;
                    if (!u) continue;
                    const id = window.gymAddTrack({ title: it.title || t, artist: it.artist || '', cover: it.cover || '', src: u, note: it.note || '' }, '💌 TA 推荐的');
                    if (id) return { trackId: id, foundTitle: it.title || t };
                } catch (e) {}
            }
            return null;
        }
        if (kind === 'read' || kind === 'book') {
            try {
                const b = ((window.__rtState && window.__rtState.books) || []).find(x => titleHit(x.title, t));
                if (b) return { bookId: b.id, foundTitle: b.title };
            } catch (e) {}
            if (typeof window.gyResSearch !== 'function' || typeof window.rtImportText !== 'function') return null;
            const hits = await window.gyResSearch('book', t, { limit: 3 }).catch(() => []);
            for (const it of (hits || [])) {
                try {
                    const text = typeof window.gyResBookText === 'function' ? await window.gyResBookText(it) : '';
                    if (!text || text.length < 50) continue;
                    const b = await window.rtImportText(it.title || t, text, { src: it.src });
                    if (b) return { bookId: b.id, foundTitle: b.title };
                } catch (e) {}
            }
            return null;
        }
        return null;
    }
    window.gyInviteResolveItem = async function (kind, title) {
        try { return await withTimeout(resolveItemInner(kind, title), 60000); }
        catch (e) { console.warn('[邀请] 找资源失败：', e); return null; }
    };

    /* ================= 💬 一起做完一件事之后，TA 会再来说两句 =================
       真人打完电话、看完电影、约会回来，常常会再发条消息：回味一下、补一句刚才没说完的、
       吐槽、约下次、害羞……以前各功能结束了就结束了，TA 像被拔了电源。
       gyAfterActivity(charId, kind, summary, {by, mins, group, ask, delay})
         kind    这件事叫什么（"打电话" / "一起看电影"…）
         summary 经过（通话内容、聊了什么、看了哪段…）
         by      'me' ＝ 用户发起的，'char' ＝ TA 自己发起的
         group   群 id：发到群里（这时 charId 是群里替大家开口的那一个）
         ask     整句情境自己写（比如"你打电话过去对方没接"），不套"你们刚结束了…"
       开关：「活人感 → 一起做完事后 TA 会再来说两句」，默认开。按人设，TA 也可能一句都不说。 */
    try {
        if (typeof AUTO_FEATURE_DEFS !== 'undefined' && Array.isArray(AUTO_FEATURE_DEFS) && !AUTO_FEATURE_DEFS.some(f => f.key === 'afterActivity')) {
            AUTO_FEATURE_DEFS.push({ key: 'afterActivity', label: '一起做完事后 TA 会再来说两句',
                desc: '打完电话、一起看完电影、听完歌、读完一段、约出去回来，或者 TA 打给你你没接——过几秒 TA 会像真人一样在私聊里再发一两条：回味、补一句没说完的、吐槽、约下次……按人设来，不想说就不说。',
                cost: '每次活动结束一次调用', group: '活人感', where: '打电话、一起看 / 听 / 读、约出去结束之后；效果在私聊' });
        }
    } catch (e) {}
    const afterRecent = {};
    window.gyAfterActivity = function (charId, kind, summary, opts) {
        const o = opts || {};
        const c = charOf(charId);
        if (!c) return Promise.resolve([]);
        if (typeof isAutoOn === 'function' && !isAutoOn('afterActivity')) return Promise.resolve([]);
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key || typeof callChatCompletionAPI !== 'function') return Promise.resolve([]);
        // 同一件事几秒内被两个出口各触发一次（比如看完了又点了结束）只算一次
        const key = String(c.id) + '|' + kind + '|' + (o.group || '');
        if (afterRecent[key] && Date.now() - afterRecent[key] < 30000) return Promise.resolve([]);
        afterRecent[key] = Date.now();
        const delay = (o.delay != null) ? o.delay : (typeof window.GY_AFTER_DELAY_MS === 'number' ? window.GY_AFTER_DELAY_MS : 3000 + Math.random() * 5000);
        return new Promise(res => setTimeout(() => {
            const run = () => afterInner(c, kind, summary, o);
            const p = (typeof window.gyInjectInSceneSoft === 'function') ? window.gyInjectInSceneSoft(o.group ? 'group' : 'chat', run) : run();
            Promise.resolve(p).then(res, e => { console.warn('[事后] 出错：', e); res([]); });
        }, delay));
    };
    async function afterInner(c, kind, summary, o) {
        const sid = o.group ? String(o.group) : String(c.id);
        if (typeof globalChats === 'undefined') return [];
        if (!globalChats[sid]) globalChats[sid] = [];
        const who = (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
        const turns = (typeof chatHistoryTurns !== 'undefined') ? chatHistoryTurns : 20;
        const recent = (typeof buildTimeAwareHistoryText === 'function')
            ? buildTimeAwareHistoryText(globalChats[sid].slice(-turns), c.name) : '';
        const byTxt = o.by === 'me' ? `是${who}发起的` : (o.by === 'char' ? '是你发起的' : (o.by ? `是${o.by}发起的` : ''));
        const mins = o.mins ? `，大概 ${Math.max(1, Math.round(o.mins))} 分钟` : '';
        const scene = o.ask ? String(o.ask)
            : `你们刚结束了「${kind}」（${byTxt || '刚刚的事'}${mins}）。经过：\n${String(summary || '（没留下什么具体内容）')}`;
        const ask = `${scene}

现在是事后。像真人一样，${o.group ? '在群里' : `在私聊里给${who}`}自然地发 1~2 条消息——回味一下、补一句刚才没说完的、吐槽、约下次、害羞、嘴硬……完全按你的人设和你们现在的关系来。
· 不要复述经过、不要写总结、不要写动作旁白，就是真人随手发的消息
· 如果按你这种性格此刻根本不会再说话，就只输出 NO
只输出 JSON，不要 markdown：{"replies":[{"text":"第一条"},{"text":"第二条（可以没有）"}]}`;
        const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, true, recent) : '';
        const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
        const data = await callChatCompletionAPI(getApiConfig(true), msgs);
        if (!data || data.error) return [];
        let raw = String((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '').trim();
        if (typeof stripReasoningBlocks === 'function') raw = stripReasoningBlocks(raw).trim();
        if (!raw || /^NO\b[.。!！]?$/i.test(raw)) return [];
        let list = [];
        let r = (typeof extractJsonObject === 'function') ? extractJsonObject(raw) : null;
        if (r && !Array.isArray(r) && Array.isArray(r.replies)) list = r.replies;
        else if (Array.isArray(r)) list = r;
        else if (r && typeof r === 'object' && (r.text || r.content)) list = [r];
        list = list.map(x => typeof x === 'string' ? x : (x && (x.text || x.content)) || '');
        if (!list.length && !/^[\[{]/.test(raw)) list = raw.split('\n');
        const out = [];
        list.forEach(t => {
            t = String(t || '').trim().replace(/^["'“”「」]+|["'“”「」]+$/g, '').trim();
            if (typeof applyRegexScripts === 'function') { try { t = applyRegexScripts(t, 'ai_output', c.id); } catch (e) {} }
            if (!t || /^NO\b[.。!！]?$/i.test(t)) return;
            out.push(t);
        });
        if (!out.length) return [];
        const now = Date.now();
        out.slice(0, 3).forEach((t, i) => globalChats[sid].push({ sender: c.id, text: t, timestamp: now + i * 800, readBy: [], afterActivity: kind }));
        refresh(sid);
        if (typeof addNotification === 'function') {
            try { addNotification(`<b>${c.name}</b> ${o.group ? '在群里' : ''}发来消息 💬`, null, sid, c, out[0]); } catch (e) {}
        }
        return out;
    }

    /* ================= 老接口（只记一来一回，不出卡片）================= */
    // 给"结果已经定了、只想把这段留在私聊里"的地方用，比如约出去谈成之后的落地。
    window.gyInviteInChat = function ({ char, myText, reply, ok, jump = true, what } = {}) {
        try {
            const c = (typeof char === 'object') ? char : charOf(char);
            if (!c) return;
            if (!on()) {
                if (typeof showToast === 'function') showToast('', c.name, reply || myText, null, c.id, false);
                return;
            }
            if (!globalChats[String(c.id)]) globalChats[String(c.id)] = [];
            if (myText) globalChats[String(c.id)].push({ sender: 'me', text: myText, timestamp: Date.now(), readBy: [] });
            if (reply) globalChats[String(c.id)].push({ sender: c.id, text: reply, timestamp: Date.now(), readBy: [] });
            refresh(c.id);
            if (reply && typeof addNotification === 'function') {
                addNotification(`<b>${c.name}</b> 回了你的邀请${what ? '（' + what + '）' : ''}`, null, c.id, c, reply);
            }
            if (jump) jumpTo(c.id);
        } catch (e) { console.warn('[邀请] 写进私聊时出错，已跳过：', e); }
    };

    /* 统一的"问 TA 去不去"。返回 {ok, line}。 */
    window.gyInviteAsk = async function (char, ask, fallbackYes = true) {
        const out = { ok: fallbackYes, line: '' };
        try {
            const c = (typeof char === 'object') ? char : charOf(char);
            if (!c) return out;
            const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
            if (!api || !api.key) return out;
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : '';
            const msgs = (typeof buildStructuredMessages === 'function')
                ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: ask }];
            const data = await callChatCompletionAPI(api, msgs);
            const raw = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
            let r = (typeof extractJsonObject === 'function') ? extractJsonObject(raw) : null;
            if (Array.isArray(r)) r = r[0];
            if (r && typeof r === 'object') {
                out.ok = (r.ok !== undefined) ? r.ok !== false : (r.yes !== undefined ? !!r.yes : fallbackYes);
                out.line = String(r.line || r.text || '').trim();
            } else {
                out.line = raw.slice(0, 60);
            }
            out.line = out.line.replace(/^["'“”「」]+|["'“”「」]+$/g, '');
            if (typeof applyRegexScripts === 'function') {
                try { out.line = applyRegexScripts(out.line, 'ai_output', c.id); } catch (e) {}
            }
        } catch (e) { console.warn('[邀请] 问 TA 出错：', e); }
        return out;
    };

    /* =====================================================================
       💌 聊天里的「跟 TA 一起」
       ---------------------------------------------------------------------
       约听歌在音乐盒里、约看片在放映厅里、约出去在地图里、借手机在资料页上——
       每样都得先离开聊天、翻到那一页、再把人找出来。可这些事本来就是
       "正跟 TA 说着话，顺口约一句"，绕这么一圈很奇怪。

       所以统一收到聊天输入框左边那颗 ⋮ 里：往 GY_CHAT_ACTIONS 里塞一条就行。
         { id, icon, label, sub, show(charId)->bool, run(charId) }
       show 返回 false（功能没开、没加载、群聊里用不了）的就不画，
       不会出现点了没反应的死按钮。
       ===================================================================== */
    window.GY_CHAT_ACTIONS = window.GY_CHAT_ACTIONS || [];
    window.gyChatActionAdd = function (item) {
        if (!item || !item.id) return;
        if (window.GY_CHAT_ACTIONS.some(x => x.id === item.id)) return;
        window.GY_CHAT_ACTIONS.push(item);
    };
    const curChat = () => {
        try {
            const id = (typeof currentChatSessionId !== 'undefined') ? currentChatSessionId : null;
            if (!id || String(id).indexOf('g_') === 0) return null;    // 群聊不算
            return charOf(id) ? String(id) : null;
        } catch (e) { return null; }
    };
    window.gyChatActRun = function (id) {
        const cid = curChat(); if (!cid) return;
        const it = (window.GY_CHAT_ACTIONS || []).find(x => x.id === id);
        const m = document.getElementById('chatMoreMenu');
        if (m) m.classList.remove('on');
        if (it && typeof it.run === 'function') { try { it.run(cid); } catch (e) { console.warn('[跟 TA 一起] ' + id, e); } }
    };
    window.gyChatActsRender = function () {
        const menu = document.getElementById('chatMoreMenu');
        if (!menu) return;
        let box = document.getElementById('gyChatActs');
        const cid = curChat();
        const items = !cid ? [] : (window.GY_CHAT_ACTIONS || []).filter(x => {
            try { return typeof x.show !== 'function' || x.show(cid); } catch (e) { return false; }
        });
        if (!items.length) { if (box) box.remove(); return; }
        if (!box) {
            box = document.createElement('div');
            box.id = 'gyChatActs';
            menu.insertBefore(box, menu.firstChild);
        }
        const name = (charOf(cid) || {}).name || 'TA';
        box.innerHTML = `<div class="gyca-hd">跟 ${esc(name)} 一起</div>
          <div class="gyca-grid">${items.map(x => `<button type="button" onclick="gyChatActRun('${x.id}')">
            <span class="gyca-i">${x.icon || '·'}</span>
            <span class="gyca-b"><b>${esc(x.label || '')}</b>${x.sub ? `<em>${esc(x.sub)}</em>` : ''}</span>
          </button>`).join('')}</div>`;
    };

    /* 内置这几条：功能本来就在，只是以前得绕到各自的页面去 */
    const has = n => typeof window[n] === 'function';
    window.gyChatActionAdd({
        id: 'music', icon: '🎧', label: '约 TA 一起听歌', sub: '正在放的这首',
        show: () => has('gymToggleListener'),
        run: id => window.gymToggleListener(id)
    });
    window.gyChatActionAdd({
        id: 'film', icon: '🎬', label: '约 TA 一起看片', sub: '放映厅里那部',
        show: () => has('fbToggleWatcher'),
        run: id => window.fbToggleWatcher(id, true)
    });
    window.gyChatActionAdd({
        id: 'read', icon: '📖', label: '约 TA 一起读书', sub: '去挑一本',
        show: () => has('gyOpenFeaturePage') && has('rtSetCompanion'),
        run: () => window.gyOpenFeaturePage('reading_together')
    });
    window.gyChatActionAdd({
        id: 'date', icon: '🤝', label: '约 TA 出去', sub: '在地图上挑个地方',
        show: () => has('gyOpenFeaturePage') && has('__gyMapCtxFor'),
        run: () => window.gyOpenFeaturePage('map')
    });
})();
