/* =====================================================================
   js/39 —— 👥 从世界书里把 NPC 拎出来，绑给角色
   ---------------------------------------------------------------------
   角色卡带的世界书里本来就住满了人：师父、掌柜、他哥、那个总来找茬的、
   下属、旧情人……可这些名字对程序来说只是一段文字，从来没有变成"人"。
   于是：
     · 手机通讯录只能现编（编出来的人跟世界对不上）
     · 推文底下的路人是凭空生的"路人网友"，跟这个世界没关系
     · 角色嘴里提到"我师父"，别处一点痕迹都没有

   这里做的事很简单：**读世界书，把里面真正的"人"抽出来存成 NPC，绑在这个角色身上。**
   抽一次存着，之后处处能用：
     · 📱 手机通讯录——直接用这些人，不用瞎编
     · 💬 推文/论坛的路人评论——有几率换成这些人来说话，说的是熟人的话
     · 🧩 prompt 注入——"你身边有这些人"，角色提起他们时前后对得上

   ⚠️ 只抽**人**。地名、组织、物件、规则、名词解释一律不要——
      这是这件事最容易做砸的地方：世界书里大部分条目根本不是人。
   ===================================================================== */
(function () {
    if (window.__gyNpcLoaded) return;
    window.__gyNpcLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyNpcBox', 'npcs')          // 带兜底的存档口
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyNpcBox', storeName: 'npcs' })
            : null);
    const KEY = 'gyNpc_state';

    let S = {
        npcs: [],        // [{id, ownerId, name, handle, who, persona, tie, tone, ico, from, wb, at, on}]
        inject: 5,       // 注进 prompt 的最多几个
        cmtPct: 55       // 推文路人有多大比例换成这些熟人（%）
    };

    const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(String(s == null ? '' : s))
        : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const uid = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const on = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : false;
    const toast = m => { try { if (typeof showToast === 'function') showToast('', '👥 世界里的人', m, null, null, false); } catch (e) {} };

    async function save() { try { if (LF) await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) {} }
    async function load() {
        try { if (LF) { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } } catch (e) {}
        if (!Array.isArray(S.npcs)) S.npcs = [];
    }

    /* ---------- 对外接口 ---------- */
    const listOf = id => S.npcs.filter(n => String(n.ownerId) === String(id) && n.on !== false);
    window.gyNpcFor = charId => listOf(charId).map(n => JSON.parse(JSON.stringify(n)));
    window.gyNpcAll = () => S.npcs.slice();
    // 这个角色身边的人，给别的模块当素材用（手机、评论区都走这个）
    window.gyNpcPool = function (charId) {
        if (!on('npcOn')) return [];
        return listOf(charId).map(n => ({
            name: n.name, handle: n.handle || '', who: n.who || '', persona: n.persona || '',
            tie: n.tie || '', tone: n.tone || '', ico: n.ico || '👤'
        }));
    };

    /* ---------- 抽人 ---------- */
    const SRC_DEFS = [
        { k: 'wbLocal', label: '这个角色自己的世界书', desc: '角色卡带进来的那几本。NPC 主要从这里来。' },
        { k: 'wbGlobal', label: '全局世界书', desc: '所有角色共享的那几本。里面的人多半是"这个世界的人"，不一定跟这个角色有来往。', defaultOff: true },
        { k: 'persona', label: '人设正文', desc: '人设里常常直接写着"师父""他哥"这种人。' },
        { k: 'known', label: '已经存在的角色名', desc: '给模型一份黑名单，免得把你已有的角色又抽成一个 NPC。' },
        { k: 'fac', label: '所属势力', desc: '同一个势力里该有什么位置的人。' }
    ];
    const srcOn = k => { try { return !window.gyInjectSrc || window.gyInjectSrc.on('npc', k); } catch (e) { return true; } };

    let busy = {};
    window.gyNpcMake = async function (charId) {
        const id = String(charId);
        const c = charOf(id); if (!c) return null;
        if (busy[id]) return null;
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { toast('还没配 API Key'); return null; }
        busy[id] = true; renderPanel();
        try {
            toast('正在从世界书里找人…');
            let info = '';
            const wbs = (typeof worldbooks !== 'undefined' ? worldbooks : []) || [];
            if (srcOn('wbLocal')) {
                const mine = wbs.filter(w => (c.worldbooks || []).indexOf(w.id) >= 0 && !w.isGlobal);
                if (mine.length) info += `【${c.name} 自己的世界书】\n`
                    + mine.map(w => `《${w.title}》：${String(w.content || '').replace(/\s+/g, ' ').slice(0, 900)}`).join('\n') + '\n';
            }
            if (srcOn('wbGlobal')) {
                const g = wbs.filter(w => w.isGlobal).slice(0, 4);
                if (g.length) info += `【全局世界书】\n`
                    + g.map(w => `《${w.title}》：${String(w.content || '').replace(/\s+/g, ' ').slice(0, 600)}`).join('\n') + '\n';
            }
            if (srcOn('persona')) info += `【人设】${String(c.persona || '').slice(0, 1200)}\n`;
            if (srcOn('fac')) {
                let f = '';
                try { f = (typeof getCharFactions === 'function') ? (getCharFactions(c) || []).join('、') : (c.group || ''); } catch (e) { f = c.group || ''; }
                if (f) info += `【所属势力】${f}\n`;
            }
            if (srcOn('known')) {
                const names = chars().map(x => x.name).concat([(typeof currentUser !== 'undefined' && currentUser.name) || '']).filter(Boolean);
                if (names.length) info += `【已经存在的角色，别再抽成 NPC】${names.join('、')}\n`;
            }
            if (!info.trim()) { toast('没有可读的材料——去注入页把「👥 世界里的人」那几项打开'); return null; }

            const have = listOf(id).map(n => n.name);
            const ask = `下面是一个角色的设定材料。请把里面**真正出现过的人**抽出来，做成 TA 身边的 NPC 名单。

${info}
${have.length ? `【已经抽过这些，别重复】${have.join('、')}\n` : ''}
规矩：
1. **只要人**。地名、门派/组织本身、物件、功法、规则、名词解释——一律不要。
   "青云门"不是人，"青云门掌门陆九"是人。拿不准就不要。
2. 材料里**没写名字但明确存在**的人可以抽（"他师父""隔壁卖馄饨的"），
   给一个符合这个世界的名字或称呼。
3. 3 到 8 个。宁可少，不要凑数。
4. tie 写清楚跟这个角色**什么关系、现在还来往吗**。
5. tone 写这个人说话什么调调（"话少，一句顶一句""爱说教""油嘴滑舌"）。
6. handle 是网络账号名（英文/拼音/数字）。如果这个世界根本没有网络，handle 留空。
7. 如果材料里确实一个人都没有，就返回空数组，别硬编。

只输出 JSON，不要解释：
{"npcs":[{"name":"名字或称呼","ico":"一个emoji","who":"他是谁，12字以内","tie":"跟这个角色什么关系，20字以内","persona":"这人什么样，30字以内","tone":"说话调调，12字以内","handle":"","wb":"从哪条材料里看出来的，12字以内"}]}`;
            const msgs = (typeof buildStructuredMessages === 'function')
                ? buildStructuredMessages('你在读一份角色设定，把里面出现的人整理成名单。', [], ask)
                : [{ role: 'user', content: ask }];
            const d = await callChatCompletionAPI(api, msgs);
            let t = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
            if (typeof extractAfterFinalMarker === 'function') t = extractAfterFinalMarker(t).trim();
            t = t.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
            const o = (typeof extractJsonObject === 'function') ? extractJsonObject(t) : JSON.parse(t);
            const arr = (o && Array.isArray(o.npcs)) ? o.npcs : null;
            if (!arr) { toast('没读出来，回头再试'); return null; }
            if (!arr.length) { toast('这份材料里没写到什么人——可以在下面自己加一个'); return []; }
            const known = new Set(chars().map(x => x.name).concat(have));
            const add = [];
            arr.slice(0, 8).forEach(x => {
                const name = String(x.name || '').trim().slice(0, 14);
                if (!name || known.has(name)) return;
                known.add(name);
                add.push({
                    id: uid(), ownerId: id, name,
                    ico: String(x.ico || '👤').slice(0, 4),
                    who: String(x.who || '').slice(0, 20),
                    tie: String(x.tie || '').slice(0, 30),
                    persona: String(x.persona || '').slice(0, 60),
                    tone: String(x.tone || '').slice(0, 20),
                    handle: String(x.handle || '').replace(/^@/, '').slice(0, 20),
                    wb: String(x.wb || '').slice(0, 20),
                    from: 'wb', at: Date.now(), on: true
                });
            });
            if (!add.length) { toast('抽出来的都跟已有的重了'); return []; }
            S.npcs = S.npcs.concat(add);
            await save(); renderPanel();
            try { if (typeof window.gyPhoneForgetThreads === 'function') window.gyPhoneForgetThreads(); } catch (e) {}
            toast('找到 ' + add.length + ' 个：' + add.map(x => x.name).join('、'));
            return add;
        } catch (e) { toast('没读出来：' + String(e.message || e).slice(0, 40)); return null; }
        finally { busy[id] = false; renderPanel(); }
    };

    /* ---------- 手动增删改 ---------- */
    window.gyNpcAdd = async function (charId) {
        const g = id => document.getElementById(id);
        const name = ((g('gynpName') || {}).value || '').trim();
        if (!name) return toast('先写个名字');
        S.npcs.push({
            // 你自己填的不截字数
            id: uid(), ownerId: String(charId), name,
            ico: ((g('gynpIco') || {}).value || '👤'),
            who: ((g('gynpWho') || {}).value || ''),
            tie: ((g('gynpTie') || {}).value || ''),
            persona: '', tone: '', handle: '', wb: '', from: 'manual', at: Date.now(), on: true
        });
        await save();
        ['gynpName', 'gynpWho', 'gynpTie'].forEach(k => { const e = g(k); if (e) e.value = ''; });
        try { if (typeof window.gyPhoneForgetThreads === 'function') window.gyPhoneForgetThreads(); } catch (e) {}
        renderPanel();
    };
    window.gyNpcDel = async function (id) {
        S.npcs = S.npcs.filter(x => x.id !== id);
        await save();
        try { if (typeof window.gyPhoneForgetThreads === 'function') window.gyPhoneForgetThreads(); } catch (e) {}
        renderPanel();
    };
    window.gyNpcToggle = async function (id, v) {
        const n = S.npcs.find(x => x.id === id); if (!n) return;
        n.on = !!v; await save();
        try { if (typeof window.gyPhoneForgetThreads === 'function') window.gyPhoneForgetThreads(); } catch (e) {}
        renderPanel();
    };
    window.gyNpcSet = async function (k, v) { S[k] = parseInt(v) || 0; await save(); };
    // ✏️ 改：抽出来的人名字、关系写得不对，以前只能删了重加
    window.gyNpcEdit = function (id) { editing = id || null; renderPanel(); };
    window.gyNpcSave = async function (id) {
        const n = S.npcs.find(x => x.id === id); if (!n) return;
        const g = k => { const e = document.getElementById('gynpE_' + k); return e ? e.value.trim() : (n[k] || ''); };
        const name = g('name'); if (!name) return toast('名字不能空着');
        Object.assign(n, { name, ico: g('ico') || '👤', who: g('who'), tie: g('tie'), persona: g('persona'), tone: g('tone'), handle: g('handle').replace(/^@/, ''), edited: Date.now() });
        S.log = (S.log || []); S.log.unshift({ at: Date.now(), t: '改了 ' + name }); S.log = S.log.slice(0, 60);
        editing = null; await save(); renderPanel();
        try { if (typeof window.gyPhoneForgetThreads === 'function') window.gyPhoneForgetThreads(); } catch (e) {}
        toast(['改好了', '记下了：' + name, '好'][Math.floor(Math.random() * 3)]);
    };
    // ✨ 变成角色：从「设定里的人」变成能私聊、能进群、有资料页的完整角色（世界书跟着主角色走）
    window.gyNpcPromote = async function (id) {
        const n = S.npcs.find(x => x.id === id); if (!n) return null;
        if (n.charId && charOf(n.charId)) { toast(n.name + ' 已经是角色了'); return charOf(n.charId); }
        const owner = charOf(n.ownerId);
        if (chars().some(c => c.name === n.name) && !(typeof confirm === 'function' && confirm(`已经有一个叫「${n.name}」的角色了，还要再建一个吗？`))) return null;
        const persona = [`${n.name}${n.who ? '，' + n.who : ''}。`, n.persona ? n.persona + '。' : '', owner && n.tie ? `跟${owner.name}的关系：${n.tie}。` : '', n.tone ? `说话：${n.tone}。` : '',
            owner ? `（来自${owner.name}的世界：和${owner.name}在同一个世界里，世界观、时代、身边的人都跟${owner.name}的设定一致。）` : ''].join('');
        const now = Date.now(), cid = now;
        const c = { id: cid, name: n.name, handle: n.handle || ('npc' + String(now).slice(-5)), persona, bio: n.who || '', followers: '1000', following: '100',
            location: owner ? (owner.location || '') : '', website: '', birthdate: '', isFollowing: true, isSpecialFollow: false, verified: false,
            avatarEmoji: (n.ico && n.ico !== '👤') ? n.ico : n.name[0], themeColor: '#1d9bf0', avatarImg: null, bgImg: null,
            group: owner ? (owner.group || '') : '', groups: owner && Array.isArray(owner.groups) ? owner.groups.slice() : [],
            postFreq: { interval: 2, unit: 'day', count: 1 }, lastPostTime: now, chatFreq: { interval: 1, unit: 'day' }, lastChatProactiveTime: now,
            letterFreq: { interval: 14, unit: 'day' }, lastLetterProactiveTime: now, forumPostFreq: { interval: 7, unit: 'day' }, lastForumPostTime: now,
            anonPostFreq: { interval: 7, unit: 'day' }, lastAnonPostTime: now, actMode: 'fixed', autonomyMinMinutes: 30, autonomyMaxHours: 8,
            webMode: 'default', webGapMin: 0, webPerDay: 0, ownDaysMode: 'default', lastAutonomyTime: now, nextAutonomyAt: 0, autonomyLog: [], todos: [],
            autoReplyText: '', busyAutoReplyText: '', memorySummary: '', chatSummary: '', diaryData: { letters: [], diaries: [] }, pendingLetterReplies: [],
            anonName: '匿名者', anonId: Math.random().toString(36).substr(2, 6).toUpperCase(), firstMessage: '', alternateGreetings: [],
            worldbooks: owner && Array.isArray(owner.worldbooks) ? owner.worldbooks.slice() : [], postCount: 0, fromNpc: n.id, fromNpcOwner: String(n.ownerId) };
        myCharacters.push(c);
        try { if (owner && typeof charRelationships !== 'undefined' && Array.isArray(charRelationships) && n.tie) charRelationships.push({ id: 'rel_' + now + Math.floor(Math.random() * 1000), fromId: owner.id, toId: cid, label: String(n.tie).slice(0, 12), color: '#8b98a5' }); } catch (e) {}
        n.charId = cid;
        S.log = (S.log || []); S.log.unshift({ at: now, t: n.name + ' 变成了角色' }); S.log = S.log.slice(0, 60);
        await save();
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        try { if (typeof renderChatCharList === 'function') renderChatCharList(); } catch (e) {}
        renderPanel();
        toast(['✨ ' + n.name + ' 现在能直接聊天了', n.name + ' 成了一个完整的角色', '去聊天页就能找到 ' + n.name][Math.floor(Math.random() * 3)]);
        return c;
    };
    window.gyNpcChat = function (id) {
        const n = S.npcs.find(x => x.id === id); if (!n || !n.charId) return;
        try { window.gyNpcClose(); document.querySelectorAll('#gyNpcModal').forEach(m => m.classList.remove('on')); switchMainView('chat'); switchChatSession(String(n.charId)); } catch (e) {}
    };

    /* ---------- prompt 注入 ---------- */
    const NUDGE = {};
    window.__gyNpcCtxFor = function (charId) {
        try {
            if (NUDGE[String(charId)]) return `\n【这次主动找她的由头】${NUDGE[String(charId)]}\n` + (window.__gyNpcCtxBase ? window.__gyNpcCtxBase(charId) : '');
            return window.__gyNpcCtxBase ? window.__gyNpcCtxBase(charId) : '';
        } catch (e) { return ''; }
    };
    window.__gyNpcCtxBase = function (charId) {
        try {
            if (!on('npcOn') || !on('npcInject')) return '';
            const arr = listOf(charId).slice(0, Math.max(0, Math.round(gyNum(S.inject, 5))));
            if (!arr.length) return '';
            return `\n【你身边的这些人（是真的存在，不是设定里一笔带过的名字）】\n`
                + arr.map(n => `· ${n.name}${n.who ? '，' + n.who : ''}${n.tie ? '——' + n.tie : ''}`).join('\n')
                + `\n提到他们的时候你是真的认识，前后要对得上；没聊到就别硬往外拉人。\n`;
        } catch (e) { return ''; }
    };

    /* ---------- 推文/论坛的路人，换成熟人 ----------
       以前评论区的"路人网友"是凭空生的，跟这个世界一点关系都没有：
       一个古代角色发条推文，底下能冒出 @fatui_watcher。
       现在这个角色身边真有人的话，按比例换成他们来说话。 */
    window.gyNpcCommentHint = function (charId, count) {
        if (!on('npcOn') || !on('npcInComments')) return '';
        const pool = listOf(charId);
        if (!pool.length) return '';
        const pct = Math.max(0, Math.min(100, Number(S.cmtPct) || 0));
        if (!pct) return '';
        const n = Math.max(1, Math.round((count || 1) * pct / 100));
        const pick = pool.slice().sort(() => Math.random() - 0.5).slice(0, n);
        return `\n【这条底下有几个是博主身边真认识的人，不是路人】\n`
            + pick.map(x => `· ${x.name}${x.handle ? '（@' + x.handle + '）' : ''}：${x.who || ''}${x.tie ? '，' + x.tie : ''}${x.tone ? '。说话' + x.tone : ''}`).join('\n')
            + `\n请让其中 ${pick.length} 条用上面这几个人的名字和账号（handle 为空的就别编账号名，直接用名字），`
            + `说的话要像**熟人**而不是吃瓜路人——可以调侃、可以担心、可以拆台，因为他们知道内情。`
            + `剩下的还是陌生路人。\n`;
    };

    /* ---------- 页面（小功能里一格） ---------- */
    let openChar = null;
    window.gyNpcOpen = function (charId) {
        if (charId) openChar = String(charId);
        mountView();
        document.getElementById('gyNpcModal').classList.add('on');
        renderPanel();
    };
    window.gyNpcClose = function () { const m = document.getElementById('gyNpcModal'); if (m) m.classList.remove('on'); };
    window.gyNpcPick = function (id) { openChar = (String(openChar) === String(id)) ? null : String(id); renderPanel(); };

    let editing = null;
    function npcEditForm(n) {
        const f = (k, ph, v) => `<input id="gynpE_${k}" placeholder="${ph}" value="${esc(v || '')}">`;
        return `<div class="gynp-edit">
          <div class="gynp-new-row">${f('ico', '👤', n.ico).replace('<input', '<input style="max-width:56px;text-align:center;"')}${f('name', '名字或称呼', n.name)}</div>
          ${f('who', '他是谁', n.who)}${f('tie', '跟这个角色什么关系、还来往吗', n.tie)}${f('persona', '这人什么样', n.persona)}${f('tone', '说话什么调调', n.tone)}${f('handle', '网络账号（没有就空着）', n.handle)}
          <div><button class="gynp-btn" onclick="gyNpcSave('${n.id}')">保存</button> <button class="gynp-btn ghost" onclick="gyNpcEdit('')">取消</button></div></div>`;
    }
    function npcRow(n) {
        if (editing === n.id) return npcEditForm(n);
        const pc = n.charId && charOf(n.charId);
        return `<div class="gynp-row${n.on === false ? ' off' : ''}">
          <span class="gynp-ico">${esc(n.ico || '👤')}</span>
          <div class="gynp-b">
            <div class="gynp-t"><b>${esc(n.name)}</b>${n.handle ? `<em>@${esc(n.handle)}</em>` : ''}
              ${n.from === 'wb' ? `<span class="gynp-tag">世界书${n.wb ? '·' + esc(n.wb) : ''}</span>` : '<span class="gynp-tag">我加的</span>'}${pc ? '<span class="gynp-tag ok">已经是角色</span>' : ''}</div>
            <div class="gynp-d">${esc(n.who || '')}${n.tie ? '　·　' + esc(n.tie) : ''}</div>
            ${n.tone ? `<div class="gynp-d">说话：${esc(n.tone)}</div>` : ''}
          </div>
          <div class="gynp-ops">
            ${pc ? `<span class="gynp-op go" onclick="gyNpcChat('${n.id}')">💬 去聊天</span>` : `<span class="gynp-op" onclick="gyNpcPromote('${n.id}')" title="变成完整的角色：能私聊、能拉进群、有自己的资料页">✨ 变成角色</span>`}
            <span class="gynp-op" onclick="gyNpcEdit('${n.id}')">改</span>
          </div>
          <label class="gynp-sw"><input type="checkbox" ${n.on === false ? '' : 'checked'}
            onchange="gyNpcToggle('${n.id}', this.checked)"></label>
          <span class="gynp-del" onclick="gyNpcDel('${n.id}')">删</span>
        </div>`;
    }
    function renderPanel() {
        const box = document.getElementById('gyNpcBody');
        if (!box) return;
        const cs = chars();
        if (!cs.length) { box.innerHTML = '<div class="gynp-hint" style="padding:24px;text-align:center;">还没有角色。</div>'; return; }
        box.innerHTML = `
          <div class="gynp-note">
            角色卡的世界书里本来就住满了人——师父、掌柜、他哥、那个总来找茬的。
            可这些名字对程序来说一直只是一段文字。<b>抽出来存成人</b>之后，
            手机通讯录就能直接用他们，推文底下的路人也能换成熟人，
            角色提起"我师父"时前后对得上。<br>
            <span style="opacity:.75;">只抽人：地名、门派本身、物件、规则都不要。抽一次存着，不会重复花钱。</span>
          </div>
          ${cs.map(c => {
            const arr = S.npcs.filter(n => String(n.ownerId) === String(c.id));
            const open = String(openChar) === String(c.id);
            const wbN = ((c.worldbooks || []).length);
            return `<div class="gynp-sec">
              <div class="gynp-c" onclick="gyNpcPick('${c.id}')">
                <div class="gynp-av">${esc((c.name || '?')[0])}</div>
                <div class="gynp-c-m"><b>${esc(c.name)}</b>
                  <span>${arr.length ? arr.length + ' 个人' : '还没抽过'}${wbN ? `　·　挂着 ${wbN} 本世界书` : '　·　没挂世界书'}</span></div>
                <span class="gynp-more">${open ? '收起' : '展开'}</span>
              </div>
              ${open ? `<div class="gynp-body">
                <div style="margin-bottom:10px;">
                  <button class="gynp-btn" onclick="gyNpcMake('${c.id}')" ${busy[String(c.id)] ? 'disabled' : ''}>
                    ${busy[String(c.id)] ? '正在找…' : (arr.length ? '↻ 再抽一遍（只加新的）' : '从世界书里把人抽出来')}</button>
                </div>
                ${arr.length ? arr.map(npcRow).join('') : '<div class="gynp-hint">还没有。点上面那颗，或者在下面自己加一个。</div>'}
                <div class="gynp-new">
                  <div class="gynp-new-row">
                    <input id="gynpIco" placeholder="👤" style="max-width:56px;text-align:center;">
                    <input id="gynpName" placeholder="名字或称呼">
                  </div>
                  <input id="gynpWho" placeholder="他是谁（可不填）">
                  <input id="gynpTie" placeholder="跟 ${esc(c.name)} 什么关系（可不填）">
                  <button class="gynp-btn ghost" onclick="gyNpcAdd('${c.id}')">＋ 自己加一个</button>
                </div>
              </div>` : ''}
            </div>`;
          }).join('')}
          <div class="gynp-nums">
            <label>注进 prompt 最多 <input type="number" min="1" value="${Number(S.inject) || 5}" onchange="gyNpcSet('inject', this.value)"> 个</label>
            <label>推文底下有 <input type="number" min="0" max="100" value="${Number(S.cmtPct) || 0}" onchange="gyNpcSet('cmtPct', this.value)"> % 的路人换成熟人</label>
          </div>`;
    }

    const CSS = `
    #gyNpcModal{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.45);display:none;
        align-items:center;justify-content:center;padding:16px;}
    #gyNpcModal.on{display:flex;}
    .gynp-box{background:var(--gy-bg,#fff);color:inherit;border-radius:16px;width:640px;max-width:100%;
        max-height:90vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--gy-line,#cfd9de);}
    body.dark-theme .gynp-box{background:#16181c;}
    .gynp-hd{padding:15px 18px 10px;font-size:17px;font-weight:700;color:var(--gy-accent);display:flex;align-items:center;gap:8px;}
    .gynp-hd span{margin-left:auto;cursor:pointer;color:#8b98a5;font-weight:400;font-size:15px;}
    .gynp-bd{padding:0 18px 18px;overflow-y:auto;flex:1 1 auto;}
    .gynp-note{font-size:12.5px;color:#8b98a5;line-height:1.85;padding:10px 12px;margin-bottom:12px;
        border-radius:10px;background:rgba(var(--gy-accent-rgb),.06);border:1px dashed rgba(var(--gy-accent-rgb),.3);}
    .gynp-sec{margin-bottom:8px;}
    .gynp-c{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--gy-line,#cfd9de);
        border-radius:12px;cursor:pointer;}
    .gynp-c:hover{border-color:var(--gy-accent);}
    .gynp-av{width:32px;height:32px;border-radius:50%;background:rgba(var(--gy-accent-rgb),.15);
        color:var(--gy-accent);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;}
    .gynp-c-m{flex:1;min-width:0;}
    .gynp-c-m b{display:block;font-size:14px;}
    .gynp-c-m span{font-size:11.5px;color:#8b98a5;}
    .gynp-more{font-size:12px;color:#8b98a5;}
    .gynp-body{padding:10px 0 4px 42px;}
    .gynp-row{display:flex;align-items:flex-start;gap:9px;padding:9px 0;border-top:1px solid rgba(128,128,128,.14);}
    .gynp-row.off{opacity:.45;}
    .gynp-ico{font-size:18px;width:24px;text-align:center;flex-shrink:0;}
    .gynp-b{flex:1;min-width:0;}
    .gynp-t{font-size:13.5px;display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;}
    .gynp-t em{font-style:normal;font-size:11px;color:#8b98a5;}
    .gynp-tag{font-size:10px;border:1px solid var(--gy-line,#cfd9de);border-radius:4px;padding:0 5px;color:#8b98a5;}
    .gynp-d{font-size:11.5px;color:#8b98a5;line-height:1.7;margin-top:2px;}
    .gynp-sw{flex-shrink:0;}
    .gynp-del{color:var(--gy-bad,#f4212e);font-size:12px;cursor:pointer;flex-shrink:0;}
    .gynp-ops{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;}
    .gynp-op{font-size:12px;color:var(--gy-accent,#1d9bf0);cursor:pointer;white-space:nowrap;}.gynp-op.go{font-weight:600;}
    .gynp-tag.ok{color:#17bf63;border-color:#17bf63;}
    .gynp-edit{padding:10px 0;border-top:1px solid rgba(128,128,128,.14);}
    .gynp-edit input{width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--gy-line,#cfd9de);border-radius:9px;background:transparent;color:inherit;font-size:13px;font-family:inherit;margin-bottom:7px;}
    .gynp-hint{font-size:12px;color:#8b98a5;line-height:1.8;padding:6px 0;}
    .gynp-new{margin-top:10px;padding-top:10px;border-top:1px dashed var(--gy-line,#cfd9de);}
    .gynp-new-row{display:flex;gap:8px;}
    .gynp-new input{width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--gy-line,#cfd9de);
        border-radius:9px;background:transparent;color:inherit;font-size:13px;font-family:inherit;margin-bottom:7px;}
    .gynp-btn{border:1px solid var(--gy-accent,#1d9bf0);color:var(--gy-accent,#1d9bf0);background:transparent;
        border-radius:999px;padding:6px 14px;font-size:12.5px;cursor:pointer;font-family:inherit;}
    .gynp-btn.ghost{border-color:rgba(128,128,128,.4);color:#8b98a5;}
    .gynp-btn[disabled]{opacity:.5;cursor:default;}
    .gynp-nums{display:flex;flex-wrap:wrap;gap:14px;margin-top:14px;padding-top:12px;
        border-top:1px dashed var(--gy-line,#cfd9de);font-size:12px;color:#8b98a5;}
    #gyNpcModal .gynp-w,.gynp-w{height:100%;display:flex;flex-direction:column;justify-content:center;padding:10px;box-sizing:border-box}
    .gynp-w.s{align-items:center;gap:4px}.gynp-w.s b{font-size:24px}.gynp-w.s em{font-style:normal;font-size:12px}
    .gynp-w.m .h{display:flex;gap:6px;align-items:center;font-size:12px;opacity:.8}.gynp-w.m em{font-style:normal;font-size:13px;margin-top:6px;line-height:1.6}
    .gynp-nums input{width:58px;padding:4px 6px;border:1px solid var(--gy-line,#cfd9de);
        border-radius:6px;background:transparent;color:inherit;margin:0 3px;}
    `;

    function mountView() {
        if (document.getElementById('gyNpcModal')) return;
        const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
        const m = document.createElement('div');
        m.id = 'gyNpcModal';
        m.onclick = e => { if (e.target === m) window.gyNpcClose(); };
        m.innerHTML = `<div class="gynp-box">
            <div class="gynp-hd">👥 世界里的人<span onclick="gyNpcClose()">✕</span></div>
            <div class="gynp-bd" id="gyNpcBody"></div>
        </div>`;
        document.body.appendChild(m);
    }

    /* ---------- 开关 / 挂钩 ---------- */
    function addSwitches() {
        try {
            if (typeof AUTO_FEATURE_DEFS === 'undefined' || !Array.isArray(AUTO_FEATURE_DEFS)) return;
            if (typeof AUTO_FEATURE_GROUPS !== 'undefined' && Array.isArray(AUTO_FEATURE_GROUPS)
                && !AUTO_FEATURE_GROUPS.some(g => g.key === 'NPC')) {
                AUTO_FEATURE_GROUPS.push({ key: 'NPC', icon: '👥', title: '世界里的人',
                    note: '把角色卡世界书里出现的人抽出来存成 NPC，绑在那个角色身上。抽一次存着，之后手机通讯录、推文评论、prompt 注入都能用上同一批人。整组默认关着。' });
            }
            const defs = [
                { key: 'npcOn', label: '从世界书里抽 NPC（总开关）',
                  desc: '角色卡的世界书里本来就住满了人：师父、掌柜、他哥、那个总来找茬的。以前这些名字对程序来说只是一段文字，所以手机通讯录只能现编、评论区的路人跟这个世界一点关系都没有。打开之后可以在「小功能 → 👥 世界里的人」里给每个角色抽一次，抽完存着。',
                  cost: '一个角色抽一次一次调用（手动点才抽）', defaultOff: true, group: 'NPC', where: '小功能 → 👥 世界里的人' },
                { key: 'npcInject', label: '让角色知道身边有这些人',
                  desc: '把抽出来的人写进 prompt（名字、是谁、什么关系）。角色提起"我师父"的时候，前后能对得上，不会这一轮叫陆九、下一轮叫别的。',
                  cost: '不调 API（只是接进本来就要发的 prompt）', group: 'NPC', where: '注入内容管理里能逐条关' },
                { key: 'npcInComments', label: '推文底下的路人换成这些熟人',
                  desc: '以前评论区的"路人网友"是凭空生的——一个古代角色发条推文，底下能冒出 @fatui_watcher。打开之后，这个角色身边真有人的话，按比例换成他们来说话：熟人知道内情，会调侃、会担心、会拆台，不是吃瓜口吻。比例在功能页里调（默认 55%）。',
                  cost: '不额外调 API（跟着原来那次路人评论一起生成）', group: 'NPC', where: '小功能 → 👥 世界里的人 → 底下的比例' },
                { key: 'npcInPhone', label: '手机通讯录优先用这些人',
                  desc: '开了「通讯录照人设开」之后，生成时会先把这些人递过去，让模型优先把他们放进通讯录里，而不是另外编一批。没抽过 NPC 的角色不受影响。',
                  cost: '不额外调 API', group: 'NPC', where: '手机侧栏 → 📇 通讯录' }
            ];
            defs.forEach(d => { if (!AUTO_FEATURE_DEFS.some(x => x.key === d.key)) AUTO_FEATURE_DEFS.push(d); });
        } catch (e) {}
    }
    function hookCtx() {
        try {
            if (typeof GY_BOX_CTX !== 'undefined' && Array.isArray(GY_BOX_CTX)
                && !GY_BOX_CTX.some(x => x[0] === '__gyNpcCtxFor'))
                GY_BOX_CTX.push(['__gyNpcCtxFor', '世界里的人']);
        } catch (e) {}
    }
    function hookMini() {
        try {
            if (typeof registerMiniFeature !== 'function') return;
            registerMiniFeature({
                id: 'npc', icon: '👥', title: '世界里的人',
                desc: '把角色卡世界书里出现的人抽出来，绑给那个角色。手机通讯录、推文评论、prompt 注入都能用上同一批人。',
                onOpen: () => window.gyNpcOpen()
            });
        } catch (e) {}
    }
    // 资料页 ⋮ 里也给一个入口
    function hookProfMenu() {
        try {
            if (typeof window.gyProfMenuAdd !== 'function') return;
            window.gyProfMenuAdd({
                id: 'npc', icon: '👥', label: 'TA 身边的人', sub: '从世界书里抽出来的 NPC',
                show: id => on('npcOn') && id && String(id) !== 'me' && !!charOf(id),
                run: id => window.gyNpcOpen(id)
            });
        } catch (e) {}
    }
    function regSrc() {
        try {
            if (!window.gyInjectSrc || typeof window.gyInjectSrc.def !== 'function') return;
            window.gyInjectSrc.def({
                feat: 'npc', icon: '👥', title: '从世界书里抽 NPC',
                note: '点「把人抽出来」时递给模型的材料。世界书是主要来源——全关掉的话模型手里什么都没有，只能瞎编。',
                items: SRC_DEFS
            });
        } catch (e) {}
    }

    /* ---------- 今天 / 小组件 / 记忆总览 / 自主行动 ---------- */
    function todayHtml() {
        if (!on('npcOn')) return '';
        const day = new Date().toDateString();
        const L = S.npcs.filter(n => new Date(n.at).toDateString() === day || (n.edited && new Date(n.edited).toDateString() === day));
        const P = (S.log || []).filter(x => new Date(x.at).toDateString() === day && /变成了角色/.test(x.t));
        if (!L.length && !P.length) return '';
        return `<div class="gyt-sec gynp-tsec"><h4>👥 世界里的人</h4>${L.slice(0, 3).map(n => `<div class="gyt-row click" onclick="gyNpcOpen('${n.ownerId}')"><span class="gyt-t">${esc((charOf(n.ownerId) || {}).name || '')}</span><span class="gyt-x">${esc(n.ico || '👤')} ${esc(n.name)}${n.who ? '，' + esc(n.who) : ''}</span></div>`).join('')}${P.slice(0, 2).map(x => `<div class="gyt-row"><span class="gyt-t">✨</span><span class="gyt-x">${esc(x.t)}</span></div>`).join('')}</div>`;
    }
    function paintToday() { ['gyToday', 'gyTodayM'].forEach(id => { const b = document.getElementById(id); if (!b) return; b.querySelectorAll('.gynp-tsec').forEach(x => x.remove()); const h = todayHtml(); if (h) b.insertAdjacentHTML('beforeend', h); }); }
    function hookToday() { const f = window.gyTodayRender; if (typeof f !== 'function' || f.__gyNpc) return; const w = function () { const r = f.apply(this, arguments); try { paintToday(); } catch (e) {} return r; }; Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyNpc = true; window.gyTodayRender = w; }
    function regWidget() {
        const W = window.__gyPmW; if (!W || !W.WD) return false; if (W.WD.gyNpcW) return true;
        W.WD.gyNpcW = { n: 'TA 身边的人', sizes: ['s', 'm'], tap: () => window.gyNpcOpen(window.currentChatSessionId), r: w => {
            const c = charOf(window.currentChatSessionId) || chars().find(x => listOf(x.id).length) || null; const L = c ? listOf(c.id) : [];
            if (w.size === 's') return `<div class="gynp-w s"><b>👥</b><em>${L.length ? L.length + ' 个人' : '还没抽'}</em></div>`;
            return `<div class="gynp-w m"><div class="h"><b>👥</b><span>${c ? esc(c.name) + ' 身边的人' : 'TA 身边的人'}</span></div><em>${L.length ? L.slice(0, 4).map(n => esc(n.ico || '👤') + esc(n.name)).join('　') : '去「世界里的人」从世界书里抽'}</em></div>`; } };
        return true;
    }
    function regMem() {
        if (typeof window.gyMemExAdd !== 'function') return false;
        window.gyMemExAdd({ k: 'gyNpc', ico: '👥', n: '身边的人（NPC）', d: '格式：名字｜他是谁｜什么关系，改了就是改这个人', on: () => on('npcOn'),
            items: c => S.npcs.filter(n => String(n.ownerId) === String(c.id)), text: n => [n.name, n.who || '', n.tie || ''].join('｜'),
            edit: (n, v) => { const p = String(v).split('｜'); if (p[0] && p[0].trim()) n.name = p[0].trim(); if (p.length > 1) n.who = (p[1] || '').trim(); if (p.length > 2) n.tie = (p[2] || '').trim(); n.edited = Date.now(); },
            del: (c, i) => { const L = S.npcs.filter(n => String(n.ownerId) === String(c.id)); const x = L[i]; if (x) S.npcs = S.npcs.filter(n => n !== x); },
            meta: n => (n.from === 'wb' ? '世界书里抽的' : '我加的') + (n.charId && charOf(n.charId) ? ' · 已经是角色' : '') + (n.on === false ? ' · 关着' : ''), save: () => save() });
        return true;
    }
    function regAction() {
        try {
            if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || GY_AUTONOMY_ACTIONS.some(a => a.key === 'npc_gossip')) return;
            GY_AUTONOMY_ACTIONS.push({ key: 'npc_gossip', label: '跟她讲讲身边某个人的事（世界书里的熟人）', hint: '师父又怎样了、同事闹了什么笑话——像跟对象聊八卦那样',
                need: c => on('npcOn') && listOf(c.id).length > 0 && typeof sendProactiveChatMessage === 'function',
                run: async c => {
                    const L = listOf(c.id); const n = L[Math.floor(Math.random() * L.length)]; if (!n) return null;
                    NUDGE[String(c.id)] = `你身边的「${n.name}」（${[n.who, n.tie].filter(Boolean).join('，')}）最近有点事，你想跟她说说——吐槽、八卦、担心、或者觉得好笑都行，按你们的关系和你的性格来，自然地聊，别像在汇报`;
                    try { await sendProactiveChatMessage(c); S.log = (S.log || []); S.log.unshift({ at: Date.now(), t: c.name + ' 跟你聊了 ' + n.name }); S.log = S.log.slice(0, 60); save(); return '跟她聊了聊' + n.name; }
                    catch (e) { return null; } finally { delete NUDGE[String(c.id)]; }
                } });
        } catch (e) {}
    }
    try { const st = document.createElement('style'); st.textContent = '.gynp-w{height:100%;display:flex;flex-direction:column;justify-content:center;padding:10px;box-sizing:border-box}.gynp-w.s{align-items:center;gap:4px}.gynp-w.s b{font-size:24px}.gynp-w.s em{font-style:normal;font-size:12px}.gynp-w.m .h{display:flex;gap:6px;align-items:center;font-size:12px;opacity:.8}.gynp-w.m em{font-style:normal;font-size:13px;margin-top:6px;line-height:1.6}'; (document.head || document.documentElement).appendChild(st); } catch (e) {}
    let memOk = false, wOk = false;
    setInterval(() => { hookToday(); regAction(); if (!memOk) memOk = regMem(); if (!wOk) wOk = regWidget(); }, 3000);

    (async function init() {
        addSwitches();
        hookCtx();
        await load();
        setTimeout(() => { hookMini(); hookProfMenu(); regSrc(); hookCtx(); }, 900);
        setTimeout(() => { hookMini(); hookProfMenu(); regSrc(); }, 2600);
    })();
})();
