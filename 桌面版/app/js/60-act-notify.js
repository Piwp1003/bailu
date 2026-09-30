/* ===========================================================================
   js/60 —— 🔔 TA 自己做的每件事都弹通知，点一下跳过去
   ---------------------------------------------------------------------------
   自主模式里 TA 做的事（js/14 的动作表 + js/58 接上的各个小功能）、角色之间的来往（js/56）、
   随机事件（js/57）——做成了就弹一条，同时进「通知」页；点弹窗或通知，直接跳到那件事所在的地方：
   发的推 → 那条推文；写的日记信 → 信件与日记；网购 → 商城；听歌 → 音乐盒；改签名 → TA 的主页……

   有些动作自己本来就会弹、而且点了能跳（发消息、发推、各种邀请卡、来电、八卦……），这里不再重复弹。
   跳转目标：动作自己给了就用它的（js/58 的动作会带），没给就按下面这张表。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyActNotifyLoaded) return;
    window.__gyActNotifyLoaded = true;

    const chars = () => (typeof myCharacters !== 'undefined' && Array.isArray(myCharacters)) ? myCharacters : [];
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;

    /* ---------- 跳 ---------- */
    const groups = () => (typeof groupChats !== 'undefined' && Array.isArray(groupChats)) ? groupChats : [];
    const isVisible = id => { const v = document.getElementById(id); return !!(v && v.style.display && v.style.display !== 'none'); };
    // 私聊 / 群聊都走这里：switchChatSession 认角色 id 也认群 id（群聊的消息也存在 globalChats[群id] 里）
    function openChat(id) {
        const sid = String(id);
        const known = !!charOf(sid) || groups().some(g => String(g.id) === sid)
            || (typeof globalChats !== 'undefined' && globalChats && Object.prototype.hasOwnProperty.call(globalChats, sid));
        switchMainView('chat');
        if (known) { try { switchChatSession(sid); } catch (e) { console.warn('[通知跳转] 打开会话失败：', e); } }
    }
    // 帖子：主页的 / 营销号的（tb_ 开头，详情页也认）/ 匿名区的（详情页不认，去匿名论坛）
    function openPost(pid, anon) {
        const id = String(pid);
        const inAnon = (typeof anonPosts !== 'undefined' && Array.isArray(anonPosts)) && anonPosts.some(p => p && String(p.id) === id);
        const inMain = (typeof globalPosts !== 'undefined' && Array.isArray(globalPosts)) && globalPosts.some(p => p && String(p.id) === id);
        const inTb = (typeof tabloidPosts !== 'undefined' && Array.isArray(tabloidPosts)) && tabloidPosts.some(p => p && String(p.id) === id);
        if (inAnon && !inMain) { switchMainView('anonForum'); scrollToPost(id); return; }
        if (inMain || inTb) { switchMainView('postDetail', id); return; }
        if (anon) { switchMainView('anonForum'); return; }
        switchMainView(id.startsWith('tb_') ? 'tabloid' : 'home');   // 帖子已经删了：退回它原来所在的那一页
    }
    // 匿名区是按 anonPosts 的顺序一条一条画的，按下标找到那一条滚过去
    function scrollToPost(id) {
        setTimeout(() => { try {
            const i = anonPosts.findIndex(p => p && String(p.id) === id);
            const box = document.getElementById('anonFeedSection');
            const el = box && i >= 0 ? box.children[i] : null;
            if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        } catch (e) {} }, 120);
    }
    // 小功能页（js/27 的名单）；不在名单里的按 gy<名字>Open 找找看，再不行去「小功能」总页
    const FEATURE_PAGES = ['music', 'map', 'relations', 'gossip', 'kit', 'days', 'now', 'reading_together', 'emoticon'];
    const FEATURE_ALIAS = { day: 'days', relation: 'relations', reading: 'reading_together', read: 'reading_together', emoji: 'emoticon', weather: 'map', trip: 'map' };
    const FEATURE_FN = { web_explore: 'gywebOpen', web: 'gywebOpen', phone: 'gyPhoneOpen' };
    const FEATURE_VIEW = { mall: 'mall', shop: 'mall', takeout: 'mall', diary: 'diary', letter: 'diary', forum: 'novel', novel: 'novel', chat: 'chat',
                           theater: 'theater', tabloid: 'tabloid', grapevine: 'grapevine', watch: 'watchTogether', watchTogether: 'watchTogether', anon: 'anonForum' };
    function openFeature(f, n) {
        const k = FEATURE_ALIAS[f] || f;
        if (FEATURE_PAGES.includes(k) && typeof gyOpenFeaturePage === 'function') { gyOpenFeaturePage(k); return true; }
        const cid = n && (n.charId || n.chatCharId);
        const fnName = FEATURE_FN[k];
        if (fnName && typeof window[fnName] === 'function') { window[fnName](cid != null ? String(cid) : undefined); return true; }
        if (FEATURE_VIEW[k]) { switchMainView(FEATURE_VIEW[k]); return true; }
        const base = String(k).split('_')[0];
        for (const nm of ['gy' + k + 'Open', 'gy' + base + 'Open', 'gy' + k.charAt(0).toUpperCase() + k.slice(1) + 'Open']) {
            if (typeof window[nm] === 'function') { window[nm](cid != null ? String(cid) : undefined); return true; }
        }
        switchMainView('miniHub');
        return false;
    }
    // 通知里只有一句话：按字面猜去哪（信 / 日记 → 那个人的信件与日记；论坛 → 故事论坛……）
    function charFromText(n) {
        if (n.charId != null && charOf(n.charId)) return charOf(n.charId);
        const t = String(n.text || '');
        const b = t.match(/<b>([^<]+)<\/b>/);
        const byName = nm => chars().find(c => c && (c.name === nm || c.remark === nm));
        if (b && byName(b[1].trim())) return byName(b[1].trim());
        const plain = t.replace(/<[^>]+>/g, '');
        return chars().filter(c => c && c.name).sort((x, y) => y.name.length - x.name.length).find(c => plain.includes(c.name)) || null;
    }
    function textFallback(n) {
        const t = String(n.text || '').replace(/<[^>]+>/g, '') + ' ' + String(n.desc || '');
        const c = charFromText(n);
        if (/你的日记|我的日记/.test(t)) { window.gyJump({ fn: 'gyOpenMyDiary' }); return; }
        if (/信/.test(t) && c) { window.gyJump({ diary: c.id, tab: 'letter' }); return; }
        if (/日记/.test(t) && c) { window.gyJump({ diary: c.id, tab: 'diary' }); return; }
        if (/信|日记/.test(t)) { switchMainView('diary'); return; }
        if (/故事|章节/.test(t)) { switchMainView('novel'); return; }
        if (/论坛/.test(t)) { switchMainView(/匿名/.test(t) ? 'anonForum' : 'novel'); return; }
        if (/营销号|爆料|八卦/.test(t)) { switchMainView('tabloid'); return; }
        if (/群/.test(t)) { const g = groups().find(g => g && g.name && t.includes(g.name)); if (g) { openChat(g.id); return; } }
        if (/消息|私信|拍了拍|来电|电话/.test(t) && c) { openChat(c.id); return; }
        if (/商城|快递|外卖|买|下单/.test(t)) { switchMainView('mall'); return; }
        if (c) { switchMainView('profile', String(c.id)); return; }
        if (!isVisible('view-notifications')) switchMainView('notifications');
    }

    window.gyJump = function (j) {
        if (!j) return;
        try {
            if (j.fn && typeof window[j.fn] === 'function') { window[j.fn].apply(null, j.args || []); return; }
            if (j.chat != null) { openChat(j.chat); return; }
            if (j.postId != null) { openPost(j.postId, j.anon); return; }
            if (j.feature) { openFeature(j.feature, { charId: j.charId }); return; }
            if (j.diary != null) {
                switchMainView('diary');
                const go = () => { try { if (typeof selectDiaryChar === 'function') selectDiaryChar(j.diary); if (j.tab && typeof switchDiaryTab === 'function') switchDiaryTab(j.tab); } catch (e) {} };
                go(); setTimeout(go, 60);   // 立刻切一次（点完马上就是对的），稍后再补一次防止别的刷新把它盖回去
                return;
            }
            if (j.today) {
                if (typeof window.gyTodaySet === 'function' && !(window.gyTodayRead && window.gyTodayRead().on)) window.gyTodaySet(true);
                if (window.innerWidth <= 900 && typeof openMobileTrendsView === 'function') openMobileTrendsView();
                setTimeout(() => { try { const el = document.querySelector(`#gyToday [data-rh="${j.today}"], #gyTodayM [data-rh="${j.today}"]`); if (el) { el.open = true; el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } } catch (e) {} }, 150);
                return;
            }
            if (j.view) { if (j.view === 'postDetail' && j.param) openPost(j.param); else switchMainView(j.view, j.param); return; }
            // fn 指向的函数不存在（插件没装 / 被关了）：按 fn 的名字找个最接近的页面
            if (j.fn) {
                const m = { gyOpenMyDiary: () => { switchMainView('diary'); try { switchDiaryTab('mydiary'); } catch (e) {} }, gyOpenForum: () => switchMainView('novel'), gyOpenNovel: () => switchMainView('novel'),
                            gymapOpen: () => openFeature('map'), gykitOpen: () => openFeature('kit'), gydayOpen: () => openFeature('days'),
                            gyPhoneOpen: () => (j.args && j.args[0] != null) ? switchMainView('profile', String(j.args[0])) : switchMainView('home'),
                            gyPhoneOpenApp: () => switchMainView('theater'), gywebOpen: () => switchMainView('miniHub') }[j.fn];
                if (m) { m(); return; }
                console.warn('[通知跳转] 找不到函数：', j.fn);
                switchMainView('notifications');
            }
        } catch (e) { console.warn('[通知跳转] 失败：', e); }
    };

    // 🔔 所有"点通知"的统一入口：通知页、弹窗、小手机通知中心、灵动岛都走这里。
    // n 可以是通知对象，也可以是它的 id。按 jump → chatCharId（私聊/群聊）→ postId → feature → view → 按字面猜 的顺序找去处。
    window.gyOpenNotif = function (n) {
        if (n == null) return false;
        if (typeof n !== 'object') n = (typeof window.gyNotifFind === 'function') ? window.gyNotifFind(n) : null;
        if (!n) return false;
        // 点过的算已读
        if (!n.read) {
            n.read = true;
            try { if (typeof unreadNotifs !== 'undefined' && unreadNotifs > 0 && !isVisible('view-notifications')) { unreadNotifs--; if (typeof updateNotifBadge === 'function') updateNotifBadge(); } } catch (e) {}
        }
        try {
            if (n.jump && typeof n.jump === 'object' && Object.keys(n.jump).length) { window.gyJump(n.jump); return true; }
            if (n.chatCharId != null && n.chatCharId !== '') { openChat(n.chatCharId); return true; }
            if (n.postId != null && n.postId !== '') { openPost(n.postId, n.isAnon); return true; }
            if (n.feature) { openFeature(n.feature, n); return true; }
            if (n.view) { if (n.view === 'postDetail' && n.param) openPost(n.param); else switchMainView(n.view, n.param); return true; }
            textFallback(n);
        } catch (e) { console.warn('[通知跳转] 失败：', e); }
        return true;
    };

    // 从动作结果里找"刚才评论 / 点赞的那条帖子"
    function lastCommentedPost(c) {
        let best = null, bt = -1;
        for (const p of (typeof globalPosts !== 'undefined' ? globalPosts : []) || []) {
            for (const r of (p && p.replies) || []) {
                if (r && r.char && String(r.char.id) === String(c.id) && (r.timestamp || 0) > bt) { best = p; bt = r.timestamp || 0; }
            }
        }
        return best;
    }
    function likedPost(c, entry) {
        const ps = ((typeof globalPosts !== 'undefined' ? globalPosts : []) || []).filter(p => p && Array.isArray(p.likedBy) && p.likedBy.map(String).includes(String(c.id)));
        const m = String((entry && entry.result) || '').match(/给?\s*(.+?)\s*的帖子/);
        const who = m ? m[1].replace(/^(赞了|给)\s*/, '').trim() : '';
        const byWho = who ? ps.filter(p => p.char && p.char.name === who) : ps;
        const pool = byWho.length ? byWho : ps;
        return pool.find(p => String(p.likedBy[p.likedBy.length - 1]) === String(c.id)) || pool[0] || null;
    }
    const postJump = p => p ? { view: 'postDetail', param: String(p.id) } : { view: 'home' };

    // 动作 → 默认跳去哪（动作自己给了 jump 就用它的）
    const JUMP = {
        letter: c => ({ diary: c.id, tab: 'letter' }), diary: c => ({ diary: c.id, tab: 'diary' }),
        forum: () => ({ view: 'novel' }), anon: () => ({ view: 'anonForum' }),
        comment: (c, e) => postJump(lastCommentedPost(c)),
        like: (c, e) => postJump(likedPost(c, e) || (/评论/.test(String(e && e.result || '')) ? lastCommentedPost(c) : null)),
        tabloid: () => { const t = (typeof tabloidPosts !== 'undefined' && Array.isArray(tabloidPosts)) ? tabloidPosts[0] : null; return t ? { view: 'postDetail', param: String(t.id) } : { view: 'tabloid' }; },
        status: c => ({ view: 'profile', param: String(c.id) }), todo_done: c => ({ view: 'profile', param: String(c.id) }), todo_add: c => ({ view: 'profile', param: String(c.id) }),
        theater: () => ({ view: 'theater' }), peer: () => ({ view: 'theater' }),
        group_talk: (c, e) => {
            const m = String((e && e.result) || '').match(/「(.+?)」/);
            const g = m && groups().find(x => x && x.name === m[1]);
            if (g) return { chat: g.id };
            const mine = groups().filter(x => x && Array.isArray(x.members) && x.members.map(String).includes(String(c.id)));
            return mine.length === 1 ? { chat: mine[0].id } : { view: 'chat' };
        },
        music_invite: c => ({ chat: c.id }), listen_self: () => ({ feature: 'music' }),
        watch_self: () => ({ view: 'watchTogether' }), read_self: () => ({ feature: 'reading_together' }),
        play_self: c => ({ view: 'profile', param: String(c.id) }),
        money_user: c => ({ chat: c.id }), photo_user: c => ({ chat: c.id }), takeout_user: () => ({ view: 'mall' }), gift_user: () => ({ view: 'mall' }),
        shop_self: () => ({ view: 'mall' }), sell_self: () => ({ view: 'mall' }), takeout_self: () => ({ view: 'mall' }),
        web_explore: c => ({ fn: 'gywebOpen', args: [String(c.id)] }), go_place: () => ({ feature: 'map' }),
        kit_move: () => ({ feature: 'kit' }), day_mark: () => ({ feature: 'days' }),
        dress_change: c => ({ view: 'profile', param: String(c.id) }), phone_peek: c => ({ chat: c.id })
    };
    // 这些动作自己就会弹通知、点了也能跳，不重复弹
    const SELF = new Set(['chat', 'nudge', 'post', 'film_invite', 'read_invite', 'game_invite', 'music_invite', 'invite_user', 'phone_peek', 'call_invite']);

    // 弹一条能点的通知（也进通知页）
    window.gyNotifyJump = function (char, title, desc, jump) {
        try {
            const text = String(title || '');
            const fields = { text, postId: null, chatCharId: null, timestamp: Date.now(), jump: jump || null };
            if (char && char.id != null) fields.charId = String(char.id);
            if (desc) fields.desc = String(desc);
            const toast = { avatar: char && typeof getAvatarHTML === 'function' ? getAvatarHTML(char, 40) : '', title: text.replace(/<[^>]+>/g, ''), desc: desc || '' };
            if (typeof window.gyPushNotif === 'function') { window.gyPushNotif(fields, toast); return; }
            // 兜底（js/03 没加载时）
            if (typeof globalNotifications !== 'undefined' && Array.isArray(globalNotifications)) {
                fields.id = 'nt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                globalNotifications.unshift(fields);
                if (typeof unreadNotifs !== 'undefined') unreadNotifs++;
                if (typeof updateNotifBadge === 'function') updateNotifBadge();
            }
            if (typeof showToast === 'function') showToast(toast.avatar, toast.title, toast.desc, null, null, false, fields);
        } catch (e) {}
    };

    const ICON = k => {
        try {
            const a = (typeof GY_AUTONOMY_ACTIONS !== 'undefined' ? GY_AUTONOMY_ACTIONS : []).find(x => x.key === k);
            if (a && a.icon) return a.icon;
        } catch (e) {}
        return { letter: '✉️', diary: '📔', forum: '🏛️', anon: '🎭', comment: '🗨️', like: '❤️', status: '🟢', todo_done: '✅', todo_add: '🗒️',
                 theater: '🎬', peer: '📨', tabloid: '📰', group_talk: '👥', go_place: '📍', kit_move: '🎒', day_mark: '🎂', web_explore: '🌐', dress_change: '🖼️' }[k] || '✨';
    };
    window.gyActNotify = function (char, act, entry) {
        if (!char || !act || !entry || !entry.ok) return;
        if (entry.selfNotified || SELF.has(act.key)) return;
        let jump = entry.jump;
        if (!jump) { try { jump = JUMP[act.key] ? JUMP[act.key](char, entry) : null; } catch (e) { jump = null; } }
        if (!jump) jump = { view: 'profile', param: String(char.id) };
        // 匿名的事：通知里不写是谁
        if (entry.anonymous) { window.gyNotifyJump(null, `${ICON(act.key)} 有人${entry.result || act.label}`, '', jump); return; }
        window.gyNotifyJump(char, `${ICON(act.key)} ${char.name}${entry.queued ? '（之前说好的）' : ''}：${entry.result || act.label}`, entry.reason || '', jump);
    };
})();
