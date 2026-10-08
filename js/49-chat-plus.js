/* ============================================================
   js/49 —— 聊天四件小事
   ------------------------------------------------------------
   全在 设置 → 互动与描写 →「💬 聊天补丁」里开关，四个各自独立：

   ① 🖐️ 手动模式：攒着的几句当**一条**回（默认开）
      手动模式下你可能连着说三四句再让 TA 回。以前 TA 常常一句一句分开答，
      结果是三四条意思差不多的车轱辘话。现在会明确告诉它：
      这几句是一口气说完的一条话，整体回一次，不要每句都回一遍。

   ② 👥 群聊里打 @ 弹人名（默认开）
      在群聊输入框里打一个 @，底下弹出这个群的成员 + 「所有人」，点一下补全。
      群里人一多，靠手打名字很容易打错——打错了那个人就不会被叫到。

   ③ 🧭 TA 也可以去群里说话，不是只能来找你（默认关）
      自主模式的动作表里多一项：TA 挑一个此刻合适的群，在里面说一句
      （对着群里另一个角色说，也可能只是自言自语）。默认关——它会真的发消息、花调用。

   ④ 🖼️ 推文 / 日记 / 信件配图（三个地方各一个开关，默认都关）
      **不让模型在正文里写 [IMG:…]**——那样正文里会多出一截标记，
      而且模型经常写得不对。改成跟聊天发图**完全同一套**：
      内容写完之后单独问一次"这条要配什么图"，再照那句描述去取图。
      取图走哪一档（跟聊天一样 / 图库里挑 / 真生图 / 网上搜）自己选，
      也可以设成不是每条都配（多少条配一次）。

   ①③ 在「注入内容管理」里能看到、能单独关；
   ④ 借的是 📷「角色发图片」那一套，图源设置也在那儿，不用配第二遍。
   ============================================================ */
(function () {
    'use strict';

    const LSK = 'gy_chatplus_cfg';
    // artOn 拆成三个地方各一个；artMode = 用哪一档取图；artRate = 多少条配一次（%）
    const S = { one: true, at: true, groupTalk: false,
                artPost: false, artDiary: false, artLetter: false,
                artMode: 'same', artRate: 100 };
    try { Object.assign(S, JSON.parse(localStorage.getItem(LSK) || '{}') || {}); } catch (e) {}
    const save = () => { try { localStorage.setItem(LSK, JSON.stringify(S)); } catch (e) {} };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (t, m) => { try { if (typeof showToast === 'function') showToast('', t, m, null, null, false); } catch (e) {} };
    const on = k => { try { return !window.gyInjectOn || window.gyInjectOn(k); } catch (e) { return true; } };

    /* ================= ① 攒着的几句当一条回 ================= */
    // js/05 在拼「最新消息」那一段时会叫这个函数，返回空字符串就等于什么都没加
    window.gyBatchOneNote = function (triggerText) {
        if (!S.one) return '';
        if (!on('chatplus.one')) return '';
        const n = String(triggerText || '').split('\n').filter(x => x.trim()).length;
        if (n < 2) return '';
        return `\n【⚠️ 上面这 ${n} 句是对方**一口气说完的一条话**，不是 ${n} 次分开的发言。\n` +
               `整体理解、回一次就够；不要一句一句分开答，更不要把同一个意思换几种说法重复说。】\n`;
    };

    /* ================= ② 群聊里打 @ 弹人名 ================= */
    const AT_ID = 'gyAtPop';
    let atOn = false;
    function members() {
        try {
            const sid = currentChatSessionId;
            const g = (typeof groupChats !== 'undefined' ? groupChats : []).find(x => String(x.id) === String(sid));
            if (!g) return null;
            return (g.members || []).map(id =>
                (typeof myCharacters !== 'undefined' ? myCharacters : []).find(c => String(c.id) === String(id)))
                .filter(Boolean);
        } catch (e) { return null; }
    }
    function atClose() { const p = document.getElementById(AT_ID); if (p) p.remove(); atOn = false; }
    function atOpen(list, word) {
        const inp = document.getElementById('chatInput'); if (!inp) return;
        atClose();
        const hit = list.filter(n => !word || n.toLowerCase().indexOf(word.toLowerCase()) >= 0);
        if (!hit.length) return;
        const box = document.createElement('div');
        box.id = AT_ID; box.className = 'gyat-pop';
        box.innerHTML = hit.map(n => `<button type="button" class="gyat-row" data-n="${esc(n)}">${esc(n)}</button>`).join('');
        const host = inp.closest('.chat-input-area') || inp.parentElement;
        host.style.position = host.style.position || 'relative';
        host.appendChild(box);
        atOn = true;
        box.addEventListener('mousedown', ev => {
            ev.preventDefault();                       // 别让输入框失焦
            const r = ev.target.closest('.gyat-row'); if (!r) return;
            const v = inp.value;
            const i = v.lastIndexOf('@');
            inp.value = (i >= 0 ? v.slice(0, i) : v) + '@' + r.dataset.n + ' ';
            atClose(); inp.focus();
        });
    }
    function atCheck() {
        if (!S.at) return atClose();
        const inp = document.getElementById('chatInput'); if (!inp) return;
        const mem = members(); if (!mem) return atClose();       // 不是群聊
        const v = inp.value;
        const i = v.lastIndexOf('@');
        if (i < 0) return atClose();
        const word = v.slice(i + 1);
        if (/\s/.test(word)) return atClose();                   // @ 后面已经空格了＝选完了
        atOpen(['所有人'].concat(mem.map(c => c.name)), word);
    }
    function atBind() {
        const inp = document.getElementById('chatInput');
        if (!inp || inp.dataset.gyAt) return;
        inp.dataset.gyAt = '1';
        inp.addEventListener('input', atCheck);
        inp.addEventListener('blur', () => setTimeout(atClose, 150));
        inp.addEventListener('keydown', e => { if (e.key === 'Escape' && atOn) { e.stopPropagation(); atClose(); } });
    }

    /* ================= ③ TA 去群里说话 ================= */
    function groupsOf(char) {
        try {
            return (typeof groupChats !== 'undefined' ? groupChats : [])
                .filter(g => (g.members || []).some(id => String(id) === String(char.id)));
        } catch (e) { return []; }
    }
    async function groupTalk(char) {
        const gs = groupsOf(char);
        if (!gs.length) return '（TA 不在任何群里）';
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key || typeof callChatCompletionAPI !== 'function') return '';
        // 让 TA 自己挑一个群、自己想说什么
        const menu = gs.map((g, i) => {
            const last = ((typeof globalChats !== 'undefined' && globalChats[g.id]) || []).slice(-4)
                .map(m => {
                    const who = m.sender === 'me' ? (currentUser && currentUser.name) || '用户'
                        : ((myCharacters || []).find(c => String(c.id) === String(m.sender)) || {}).name || '';
                    return `　· ${who}：${String(m.text || '').slice(0, 30)}`;
                }).join('\n');
            return `${i + 1}. 【${g.name}】（${(g.members || []).length} 人）\n${last || '　（最近没人说话）'}`;
        }).join('\n');
        const ask = `现在的真实时间：${new Date().toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' })}。
你想在某个群里说句话。这是你在的群和它们最近聊到哪儿了：

${menu}

挑**一个**你此刻真的会去说话的群，说一句你会说的话。
· 对着群里某个人说就 @ 他的名字；只是感慨一句也行
· 一句就够，别发长篇；也别对着用户说——这是群里，用户不一定在看
只回一行，格式：序号|你要说的那句话
例：2|@沈砚 你那本书还在不在`;
        const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(char, false, '') : '';
        const d = await callChatCompletionAPI(api, buildStructuredMessages(base, [], ask));
        if (d && d.error) return '';
        let t = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
        if (typeof stripReasoningBlocks === 'function') t = stripReasoningBlocks(t);
        t = t.split('\n').map(x => x.trim()).filter(Boolean)[0] || '';
        const m = t.match(/^(\d+)\s*[|｜]\s*([\s\S]+)$/);
        if (!m) return '';
        const g = gs[Math.max(0, Math.min(gs.length - 1, parseInt(m[1]) - 1))];
        const say = m[2].replace(/^["'“”「」]+|["'“”「」]+$/g, '').slice(0, 200);
        if (!g || !say) return '';
        try {
            if (typeof globalChats === 'undefined') return '';
            const arr = globalChats[g.id] = globalChats[g.id] || [];
            arr.push({ sender: char.id, text: say, timestamp: Date.now(), readBy: [] });
            if (typeof saveAllData === 'function') saveAllData();
            if (typeof currentChatSessionId !== 'undefined' && String(currentChatSessionId) === String(g.id)
                && typeof renderChatMessages === 'function') renderChatMessages();
            if (typeof addNotification === 'function')
                addNotification(`<b>${esc(char.name)}</b> 在「${esc(g.name)}」里说了句话`, null, g.id, char, '');
        } catch (e) {}
        return '在「' + g.name + '」里说了句话';
    }
    const groupTalkScened = c => (typeof window.gyInjectInSceneSoft === 'function')
        ? window.gyInjectInSceneSoft('groupTalk', () => groupTalk(c)) : groupTalk(c);

    function hookAutonomy() {
        try {
            if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || !Array.isArray(GY_AUTONOMY_ACTIONS)) return;
            if (GY_AUTONOMY_ACTIONS.some(a => a.key === 'group_talk')) return;
            GY_AUTONOMY_ACTIONS.splice(GY_AUTONOMY_ACTIONS.length - 1, 0, {
                key: 'group_talk',
                label: '去某个群里说句话',
                hint: '不是找用户，是在群里跟别人说——想起谁了、想问句话、或者只是感慨一句',
                need: (char) => !!S.groupTalk && groupsOf(char).length > 0,
                run: async (char) => (await groupTalkScened(char)) || '想在群里说点什么，又算了'
            });
            console.info('[聊天补丁] 已经把「去某个群里说句话」加进自主模式的动作表');
        } catch (e) { console.warn('[聊天补丁] 挂自主模式失败', e); }
    }

    /* ================= ④ 推文 / 日记 / 信件配图 =================
       跟聊天发图**同一条路**：js/42 的取图函数（卡片/图库/生图/网上搜）原样拿来用，
       图源、接口、参考图那些设置都在 📷 那边，这儿不再配第二遍。

       跟聊天唯一的不同是"怎么知道该配什么图"：
       聊天里是 TA 自己在回复里带 [IMG:]，这儿**不让模型写标记**——
       内容写完之后单独问一次「这条要配什么图」，拿到一句描述再去取图。
       这样正文永远是干净的，也不会出现"模型忘了写标记就没图"。 */
    const ART_WHERE = { post: '推文', diary: '日记', letter: '信件' };
    const busy = Object.create(null);

    function artOnFor(kind) {
        return kind === 'post' ? !!S.artPost : kind === 'diary' ? !!S.artDiary : !!S.artLetter;
    }
    // 取图那一档：'same' = 跟聊天一样（这个角色在 📷 里设的那档）
    function artMode(charId) {
        if (S.artMode !== 'same') return S.artMode;
        try { return (typeof window.gyPhotoModeOf === 'function') ? window.gyPhotoModeOf(charId) : 'off'; } catch (e) { return 'off'; }
    }

    // 问一次：这条要配什么图
    async function askArt(char, kind, text) {
        try {
            if (typeof callChatCompletionAPI !== 'function' || typeof getApiConfig !== 'function') return '';
            const api = getApiConfig(true);
            if (!api || !api.key) return '';
            const ask = `你刚写完这条${ART_WHERE[kind]}：\n「${String(text || '').replace(/<[^>]+>/g, '').slice(0, 300)}」\n\n` +
                `你要给它配一张图（你自己拍的 / 你手边的 / 你看到的那种）。\n` +
                `只回一句话，说清楚这张图上是什么，20 字以内，不要引号，不要"一张……的图片"这种说法。\n` +
                `如果这条内容配图反而奇怪（比如纯情绪、纯吐槽），就只回"不配"两个字。`;
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(char, false, '') : '';
            const d = await callChatCompletionAPI(api, buildStructuredMessages(base, [], ask));
            if (d && d.error) return '';
            let t = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
            if (typeof stripReasoningBlocks === 'function') t = stripReasoningBlocks(t);
            t = t.split('\n').map(x => x.trim()).filter(Boolean)[0] || '';
            t = t.replace(/^["'“”「」\[]+|["'“”「」\]]+$/g, '').slice(0, 60);
            if (!t || /^不配/.test(t)) return '';
            return t;
        } catch (e) { return ''; }
    }
    // ⚠️ 场景 key 得写成**字面量**：体检是按 gyInjectInSceneSoft('xxx', () => 函数 …) 这个形状
    //    静态扫的，传变量的话它认不出来，会报"这个函数没挂场景"。
    const askArtScened = (c, k, t) => {
        if (typeof window.gyInjectInSceneSoft !== 'function') return askArt(c, k, t);
        if (k === 'diary') return window.gyInjectInSceneSoft('diary', () => askArt(c, k, t));
        if (k === 'letter') return window.gyInjectInSceneSoft('letter', () => askArt(c, k, t));
        return window.gyInjectInSceneSoft('post', () => askArt(c, k, t));
    };

    // 给一条记录配图：rec 上写 mediaUrl。rec 已经有图 / 抽签没抽中 / 取不到图，都安安静静地算了
    async function artOne(rec, char, kind, text) {
        if (!rec || rec.mediaUrl || rec.gyArt) return false;
        rec.gyArt = 1;                                    // 不管成没成，这条只考虑一次
        if (!artOnFor(kind) || !char) return false;
        if (Math.random() * 100 >= (S.artRate == null || isNaN(Number(S.artRate)) ? 100 : Number(S.artRate))) return false;   // 0＝一张都不配
        const mode = artMode(char.id);
        if (mode === 'off' || mode === 'card') return false;   // 卡片档是"只写文字描述"，配图没意义
        if (busy[kind]) return false;
        busy[kind] = 1;
        try {
            const desc = await askArtScened(char, kind, text);
            if (!desc) return false;
            const got = (typeof window.gyPhotoGet === 'function') ? await window.gyPhotoGet(char.id, desc, false, mode) : null;
            if (!got || !got.src) return false;
            rec.mediaUrl = got.src;
            rec.gyArtDesc = desc;
            if (typeof saveAllData === 'function') saveAllData();
            try {
                if (kind === 'post' && typeof renderPosts === 'function') renderPosts();
                if (kind !== 'post') artPaintDetail();
            } catch (e) {}
            return true;
        } finally { busy[kind] = 0; }
    }

    // 扫一遍刚出炉的东西（5 分钟内的），给还没图的那些配一张
    async function artScan() {
        if (!S.artPost && !S.artDiary && !S.artLetter) return;
        const fresh = t => t && (Date.now() - t) < 5 * 60000;
        try {
            if (S.artPost && typeof globalPosts !== 'undefined') {
                for (const p of globalPosts.slice(0, 6)) {
                    if (!p || p.mediaUrl || p.gyArt || !fresh(p.timestamp)) continue;
                    const c = (myCharacters || []).find(x => String(x.id) === String(p.char && p.char.id));
                    await artOne(p, c, 'post', p.text);
                }
            }
            for (const c of (typeof myCharacters !== 'undefined' ? myCharacters : [])) {
                const dd = c && c.diaryData; if (!dd) continue;
                if (S.artDiary) for (const d of (dd.diaries || []).slice(0, 2))
                    { if (d && fresh(d.date) && d.author !== 'user') await artOne(d, c, 'diary', d.content); }
                if (S.artLetter) for (const d of (dd.letters || []).slice(0, 2))
                    { if (d && fresh(d.date) && d.author !== 'user') await artOne(d, c, 'letter', d.content); }
            }
        } catch (e) { console.warn('[聊天补丁] 配图时出错', e); }
    }
    window.gyArtScan = artScan;
    let artT = null;
    const artKick = () => { if (artT) return; artT = setTimeout(() => { artT = null; artScan(); }, 1500); };

    // 日记/信件详情页没有放图的地方，画完之后自己补一张进去（不动 js/08 的渲染）
    function artPaintDetail() {
        try {
            const box = document.getElementById('diaryDetailContent'); if (!box) return;
            const id = (typeof viewingDiaryId !== 'undefined') ? viewingDiaryId : null;
            const c = (myCharacters || []).find(x => String(x.id) === String(typeof currentDiaryCharId !== 'undefined' ? currentDiaryCharId : ''));
            if (!c || !c.diaryData) return;
            const rec = [...(c.diaryData.diaries || []), ...(c.diaryData.letters || [])].find(x => x && x.id === id);
            const old = box.querySelector('.gyart-shot'); if (old) old.remove();
            if (!rec || !rec.mediaUrl) return;
            const w = document.createElement('div');
            w.className = 'gyart-shot';
            w.innerHTML = `<img src="${esc(rec.mediaUrl)}" loading="lazy"
                onclick="if(typeof gyPhotoBig==='function')gyPhotoBig(this.src)">` +
                (rec.gyArtDesc ? `<span class="gyart-desc">${esc(rec.gyArtDesc)}</span>` : '');
            box.appendChild(w);
        } catch (e) {}
    }
    ['openDiaryDetail', 'renderDiaryContent'].forEach(fn => {
        const f0 = window[fn];
        if (!f0 || !f0.call || f0.__gyArt) return;
        window[fn] = function () { const r = f0.apply(this, arguments); try { setTimeout(artPaintDetail, 30); } catch (e) {} return r; };
        window[fn].__gyArt = true;
    });

    /* ================= 注册 / 开关 / 设置 ================= */
    window.gyChatPlusSet = function (k, v) {
        S[k] = (k === 'artMode') ? String(v) : (k === 'artRate') ? (isNaN(parseInt(v)) ? 100 : Math.max(0, Math.min(100, parseInt(v)))) : !!v;
        save();
        if (k === 'at' && !v) atClose();
        if (/^art/.test(k)) artKick();
    };
    window.gyChatPlusRead = () => Object.assign({}, S);
    function fillUI() {
        try {
            [['gyCpOne', 'one'], ['gyCpAt', 'at'], ['gyCpGroupTalk', 'groupTalk'],
             ['gyCpArtPost', 'artPost'], ['gyCpArtDiary', 'artDiary'], ['gyCpArtLetter', 'artLetter']]
                .forEach(([id, k]) => { const el = document.getElementById(id); if (el) el.checked = !!S[k]; });
            const m = document.getElementById('gyCpArtMode'); if (m) m.value = S.artMode;
            const r = document.getElementById('gyCpArtRate'); if (r) r.value = S.artRate;
        } catch (e) {}
    }
    const op0 = window.openSettingsPanel;
    if (op0 && op0.call && !op0.__gyCp) {
        window.openSettingsPanel = function (k) { const r = op0.apply(this, arguments); if (k === 'interaction') setTimeout(fillUI, 60); return r; };
        window.openSettingsPanel.__gyCp = true;
    }
    // 进聊天/重画消息之后把 @ 面板和配图都重新接上
    ['switchChatSession', 'renderChatMessages', 'renderPosts', 'switchMainView', 'saveTempDiary'].forEach(fn => {
        const f0 = window[fn];
        if (!f0 || !f0.call || f0.__gyCp) return;
        window[fn] = function () { const r = f0.apply(this, arguments); try { setTimeout(() => { atBind(); artKick(); }, 30); } catch (e) {} return r; };
        window[fn].__gyCp = true;
    });

    try {
        const st = document.createElement('style');
        st.id = 'gyChatPlusCss';
        st.textContent = `
.gyat-pop { position: absolute; left: 12px; right: 12px; bottom: 100%; margin-bottom: 6px; z-index: 60;
    max-height: 210px; overflow-y: auto; border-radius: 10px; background: var(--gy-bg, #fff);
    border: 1px solid var(--gy-line, #cfd9de); box-shadow: 0 8px 26px rgba(0,0,0,.16); }
.gyat-row { display: block; width: 100%; padding: 10px 14px; border: 0; background: none; cursor: pointer;
    text-align: left; font-size: 14px; color: inherit; font-family: inherit; }
.gyat-row:hover { background: rgba(var(--gy-accent-rgb, 29,155,240), .10); }
.gyart-shot { display: block; margin: 12px 0 2px; max-width: 360px; }
.gyart-shot img { display: block; width: 100%; border-radius: 10px; cursor: zoom-in; }
.gyart-shot .gyart-desc { display: block; font-size: 12px; opacity: .55; margin-top: 4px; }
`;
        document.head.appendChild(st);
    } catch (e) {}

    const boot = () => { try { fillUI(); atBind(); hookAutonomy(); artKick(); } catch (e) {} };
    if (document.readyState === 'complete') setTimeout(boot, 1300);
    else window.addEventListener('load', () => setTimeout(boot, 1300));

    console.info('[聊天补丁] 已加载：攒着的当一条回 / 群聊 @ 补全 / TA 去群里说话 / 推文日记信件配图');
})();
