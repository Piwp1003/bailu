/* ============================================================
   👑 群聊加料（v210）：群主 / 管理员 / 群公告 · 只围观的群 · 拼手气红包
   ------------------------------------------------------------
   以前的群：成员只是一串角色 id，你永远在群里，群里没有谁说了算，
   红包和转账只能发在私聊里。这里补三样：
   1. 群主、管理员、群公告：在「聊天选项」里设。改了会在群里留一条系统消息，
      每个成员回话时都知道这个群叫什么、谁是群主谁是管理员、公告写了什么。
      你不是群主也不是管理员时，禁言那一栏会提示要群主或管理员来。
   2. 只围观的群：建群时勾「我不加入，只围观」（或者在聊天选项里改）。你不在群里，
      输入框换成「▶ 让他们接着聊」；角色们自己聊，不会对你说话、不会 @ 你。
      可以设每隔几分钟自动接着聊（只在 app 开着的时候，会花 API，默认不自动）。
   3. 拼手气红包：在群里点 💸（要先开钱包）。份额在发的那一刻由程序随机分好，
      谁抢到多少是程序算的、写进聊天记录给大家看——模型不许自己编「我抢了 34 块」。
      角色也能在群里发：回复末尾写 [拼手气红包:金额|个数|祝福]。24 小时没抢完的退回。
   ⚠️ 只动 groupChats 里的群对象（多了 owner / admins / notice / observe / observeEvery 几个字段），
      都跟着主存档备份。js/05b 里加了两个钩子：gyGroupInfoPrompt / gyGroupObserveLatest。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyGroupPlus) return;
    window.__gyGroupPlus = true;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const plain = t => String(t || '').replace(/<[^>]+>/g, '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    const G = id => (typeof groupChats !== 'undefined' ? groupChats : []).find(g => g.id === id);
    const H = sid => (typeof globalChats !== 'undefined' && globalChats[sid]) || [];
    const charOf = id => (typeof myCharacters !== 'undefined' ? myCharacters : []).find(c => String(c.id) === String(id));
    const userName = () => { try { return (typeof userDisplayName === 'function' ? userDisplayName() : (currentUser && currentUser.name)) || '你'; } catch (e) { return '你'; } };
    const nameOf = id => String(id) === 'me' ? userName() : ((charOf(id) || {}).name || '某人');
    const on = k => { try { return typeof isAutoOn === 'function' ? isAutoOn(k) : true; } catch (e) { return true; } };
    const save = () => { try { saveAllData(); } catch (e) {} };
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };
    const sidNow = () => (typeof currentChatSessionId !== 'undefined' && currentChatSessionId != null) ? String(currentChatSessionId) : '';
    const rerender = sid => { try { if (sidNow() === String(sid) && typeof renderChatMessages === 'function') renderChatMessages(); else if (typeof renderChatCharList === 'function') renderChatCharList(); } catch (e) {} };
    const sys = (gid, text) => { if (!globalChats[gid]) globalChats[gid] = []; globalChats[gid].push({ sender: 'system', text, timestamp: Date.now() }); };
    const ownerOf = g => g.owner == null ? 'me' : g.owner;   // 老群没设过：默认你是群主（群是你建的）
    const roleOf = (g, id) => String(ownerOf(g)) === String(id) ? '群主' : ((g.admins || []).map(String).includes(String(id)) ? '管理员' : '');
    const userManages = g => !g.observe && (String(ownerOf(g)) === 'me' || (g.admins || []).map(String).includes('me'));

    // ---------- 开关 ----------
    try {
        if (typeof AUTO_FEATURE_DEFS !== 'undefined') {
            [{ key: 'groupLucky', label: '群里的拼手气红包', group: '背后', desc: '群里能发拼手气红包（要先开钱包）。份额发出时由程序随机分好，角色抢到多少是程序算的；角色自己也会偶尔在群里发（回复末尾写标记，不额外调用）。', cost: '不额外调用', where: '群聊里点 💸' },
             { key: 'groupObserveAuto', label: '只围观的群自己接着聊', group: '背后', defaultOff: true, desc: '你只围观、不在里面的群，按每个群自己设的间隔（聊天选项里调），隔一会儿让 1~3 个成员接着聊几句。只在 app 开着的时候跑。关掉后只能你手动点「▶ 让他们接着聊」。', cost: '每次接着聊 1~3 次调用（几个人开口就几次）', where: '群聊 → 聊天选项 → 群资料' }]
                .forEach(d => { if (!AUTO_FEATURE_DEFS.some(f => f.key === d.key)) AUTO_FEATURE_DEFS.push(d); });
        }
    } catch (e) {}

    // ---------- 1) 群资料：给每个成员的提示 ----------
    window.gyGroupInfoPrompt = function (sid, char) {
        try {
            const g = G(sid); if (!g) return '';
            const mem = (g.members || []).map(id => { const r = roleOf(g, id); return nameOf(id) + (r ? '（' + r + '）' : ''); });
            if (!g.observe) mem.push(userName() + (roleOf(g, 'me') ? '（' + roleOf(g, 'me') + '）' : ''));
            const me = char ? roleOf(g, char.id) : '';
            let s = `\n【这个群】群名「${g.name || '群聊'}」；成员：${mem.join('、')}。`;
            if (g.notice) s += `群公告：${String(g.notice).slice(0, 200)}。`;
            if (me) s += `你在这个群里是${me}。`;
            if (g.observe) s += `${userName()}不在这个群里——群里只有你们几个，她看不到也不会说话，你们不要对她说话、不要 @ 她。`;
            if (on('groupLucky') && on('walletOn')) s += `\n【群红包】群里的红包谁抢到多少，以聊天记录里系统写的为准，不要自己编金额。你想在群里发拼手气红包的话，在某条回复最末尾加上 [拼手气红包:总金额|个数|祝福]（例：[拼手气红包:52|4|周五快乐]），钱从你自己的钱包出；不是每次都发，有由头才发。`;
            return s + '\n';
        } catch (e) { return ''; }
    };
    window.gyGroupObserveLatest = function (sid, trig) {
        const g = G(sid); if (!g || !g.observe) return '';
        return `（${userName()}不在这个群里，只是在旁边看；你们看不到她，别对她说话、别 @ 她。）群里最新的消息是——${trig || '（群里安静了一会儿）'}\n你们几个自己接着聊：可以接这个话头，也可以自然地开个新话题，像真的群友那样。`;
    };

    // ---------- 2) 聊天选项里的「群资料」 ----------
    window.gyGrpSet = function (gid, k, v) {
        const g = G(gid); if (!g) return;
        const who = userName();
        if (k === 'owner') { const old = ownerOf(g); if (String(old) === String(v)) return; g.owner = v === 'me' ? 'me' : v; g.admins = (g.admins || []).filter(x => String(x) !== String(v)); sys(gid, `${nameOf(old)} 把群主转让给了「${nameOf(v)}」`); }
        else if (k === 'admin') { const [id, yes] = v; g.admins = (g.admins || []).filter(x => String(x) !== String(id)); if (yes) g.admins.push(id); sys(gid, yes ? `${who} 把「${nameOf(id)}」设为管理员` : `${who} 取消了「${nameOf(id)}」的管理员`); }
        else if (k === 'notice') { const t = String(v || '').trim(); if (t === (g.notice || '')) return; g.notice = t; sys(gid, t ? `${who} 发布了群公告：\n${t}` : `${who} 清空了群公告`); }
        else if (k === 'observe') { g.observe = !!v; sys(gid, v ? `${who} 退出了群聊（还能在旁边看）` : `${who} 回到了群聊`); }
        else if (k === 'observeEvery') { g.observeEvery = Math.max(0, +v || 0); }
        save(); rerender(gid); paintOptions(gid); paintObsBar();
    };
    function paintOptions(gid) {
        const sec = document.getElementById('groupSpeakOrderSection'); if (!sec) return;
        let box = document.getElementById('gyGrpPlusBox');
        const g = G(gid);
        if (!g) { if (box) box.style.display = 'none'; return; }
        if (!box) { box = document.createElement('div'); box.id = 'gyGrpPlusBox'; sec.parentNode.insertBefore(box, sec.nextSibling); }
        box.style.display = 'block';
        const mem = g.members || [], own = String(ownerOf(g));
        box.innerHTML = `<div class="gygp-box"><label class="gygp-h">👑 群资料</label>
            <div class="gygp-row">群主 <select onchange="gyGrpSet('${g.id}','owner',this.value)">${(g.observe ? [] : ['me']).concat(mem).map(id => `<option value="${esc(id)}"${String(id) === own ? ' selected' : ''}>${esc(nameOf(id))}${String(id) === 'me' ? '（你）' : ''}</option>`).join('')}</select></div>
            <div class="gygp-row">管理员 <span class="gygp-chips">${(g.observe ? [] : ['me']).concat(mem).filter(id => String(id) !== own).map(id => `<label><input type="checkbox" ${(g.admins || []).map(String).includes(String(id)) ? 'checked' : ''} onchange="gyGrpSet('${g.id}','admin',[${JSON.stringify(id)},this.checked])"> ${esc(nameOf(id))}</label>`).join('') || '<em>没有别人了</em>'}</span></div>
            <div class="gygp-row col">群公告<textarea rows="2" placeholder="写点群公告（选填），每个成员都看得到" onchange="gyGrpSet('${g.id}','notice',this.value)">${esc(g.notice || '')}</textarea></div>
            <label class="gygp-row"><input type="checkbox" ${g.observe ? 'checked' : ''} onchange="gyGrpSet('${g.id}','observe',this.checked)"> 我不在这个群里，只围观（他们自己聊，不会对你说话）</label>
            ${g.observe ? `<div class="gygp-row">自动接着聊 <select onchange="gyGrpSet('${g.id}','observeEvery',this.value)">${[[0, '不自动'], [3, '每 3 分钟'], [10, '每 10 分钟'], [30, '每 30 分钟'], [120, '每 2 小时']].map(([v, n]) => `<option value="${v}"${(+g.observeEvery || 0) === v ? ' selected' : ''}>${n}</option>`).join('')}</select>${on('groupObserveAuto') ? '' : '<em>（总开关「只围观的群自己接着聊」关着）</em>'}</div>` : ''}
            ${userManages(g) ? '' : '<div class="gygp-tip">你现在不是群主也不是管理员——按规矩，禁言、改公告要群主或管理员来（这里还是让你改，系统消息会写是谁改的）。</div>'}
        </div>`;
    }
    function hookOptions() {
        const f = window.openChatOptions; if (typeof f !== 'function' || f.__gyGrp) return;
        const w = function (id) { const r = f.apply(this, arguments); try { paintOptions(String(id).startsWith('g_') ? String(id) : ''); } catch (e) {} return r; };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyGrp = true; window.openChatOptions = w;
    }
    // 建群时：我不加入，只围观
    function hookCreate() {
        const op = window.openCreateGroupModal;
        if (typeof op === 'function' && !op.__gyGrp) {
            const w = function () { const r = op.apply(this, arguments); try { const m = document.getElementById('createGroupChatModal'); const b = m && m.querySelector('.modal-box'); if (b && !document.getElementById('gyGrpObsNew')) { const d = document.createElement('label'); d.className = 'gygp-new'; d.innerHTML = '<input type="checkbox" id="gyGrpObsNew"> 👀 我不加入，只围观（让他们自己聊）'; const btn = b.querySelector('.btn-primary'); if (btn) b.insertBefore(d, btn); else b.appendChild(d); } const cb = document.getElementById('gyGrpObsNew'); if (cb) cb.checked = false; } catch (e) {} return r; };
            Object.keys(op).forEach(k => { try { w[k] = op[k]; } catch (e) {} }); w.__gyGrp = true; window.openCreateGroupModal = w; try { openCreateGroupModal = w; } catch (e) {}
        }
        const sv = window.saveGroupChat;
        if (typeof sv === 'function' && !sv.__gyGrp) {
            const w = function () { const n0 = (groupChats || []).length; const cb = document.getElementById('gyGrpObsNew'); const obs = !!(cb && cb.checked); const r = sv.apply(this, arguments); try { if (groupChats.length > n0) { const g = groupChats[groupChats.length - 1]; g.owner = obs ? g.members[0] : 'me'; if (obs) { g.observe = true; sys(g.id, `${userName()} 建了这个群，自己没进来，在旁边看`); } save(); paintObsBar(); } } catch (e) {} return r; };
            Object.keys(sv).forEach(k => { try { w[k] = sv[k]; } catch (e) {} }); w.__gyGrp = true; window.saveGroupChat = w; try { saveGroupChat = w; } catch (e) {}
        }
    }

    // ---------- 3) 只围观：输入框换成按钮 + 接着聊 ----------
    const busy = {};
    async function observeTick(gid, why) {
        const g = G(gid); if (!g || !g.observe || busy[gid] || typeof triggerAIBatchReply !== 'function') return false;
        const muted0 = (g.mutedMembers || []).slice(), order0 = g.speakOrder;
        const pool = (g.members || []).filter(id => !muted0.map(String).includes(String(id)));
        if (!pool.length) { toast('👀 群里没人能说话', '成员都被禁言了'); return false; }
        busy[gid] = true; paintObsBar();
        const L = H(gid).filter(m => m && m.sender !== 'system'), last = L[L.length - 1];
        const sh = pool.slice().sort(() => Math.random() - 0.5);
        const first = sh.filter(id => !last || String(id) !== String(last.sender));
        const k = Math.max(1, Math.min(pool.length, 1 + Math.floor(Math.random() * Math.min(3, pool.length))));
        const pick = first.concat(sh.filter(id => first.indexOf(id) < 0)).slice(0, k);
        const n0 = H(gid).length;
        try {
            g.mutedMembers = (g.members || []).filter(id => !pick.map(String).includes(String(id)));
            g.speakOrder = 'sequential';   // 这一轮被点到的必须开口
            const trig = last ? `${nameOf(last.sender)}：${plain(last.text).slice(0, 200)}` : (g.notice ? '群公告：' + g.notice : '（群刚建好，还没人说话）');
            await triggerAIBatchReply(gid, trig);
            if (H(gid).length === n0) await triggerAIBatchReply(gid, trig);   // 都没开口（比如都回了 NO）：再叫一次
        } catch (e) { console.warn('[群聊加料] 接着聊失败', e); }
        finally { g.mutedMembers = muted0; g.speakOrder = order0; busy[gid] = false; g.observeLast = Date.now(); save(); paintObsBar(); }
        return H(gid).length > n0;
    }
    window.gyGroupObserveTick = observeTick;
    function paintObsBar() {
        const area = document.getElementById('chatInputArea'); if (!area) return;
        const g = G(sidNow()), want = !!(g && g.observe);
        area.classList.toggle('gygp-obs', want);
        let bar = document.getElementById('gyObsBar');
        if (!want) { if (bar) bar.remove(); return; }
        if (!bar) { bar = document.createElement('div'); bar.id = 'gyObsBar'; area.insertBefore(bar, area.firstChild); }
        bar.innerHTML = `<span>👀 你不在这个群里，只能看</span><button ${busy[g.id] ? 'disabled' : ''} onclick="this.disabled=true;gyGroupObserveTick('${g.id}','手动')">${busy[g.id] ? '他们在聊…' : '▶ 让他们接着聊'}</button>`;
    }
    window.gyGroupObservePaint = paintObsBar;
    setInterval(async () => {
        if (!on('groupObserveAuto')) return;
        for (const g of (typeof groupChats !== 'undefined' ? groupChats : [])) {
            if (!g.observe || !(+g.observeEvery > 0) || busy[g.id]) continue;
            const L = H(g.id), lastAt = Math.max(g.observeLast || 0, (L[L.length - 1] || {}).timestamp || 0);
            if (Date.now() - lastAt >= g.observeEvery * 60000) { await observeTick(g.id, '自动'); break; }
        }
    }, 30000);

    // ---------- 4) 拼手气红包 ----------
    const r2 = n => Math.round(n * 100) / 100;
    function split(total, count) {   // 二倍均值：每份至少 0.01
        let left = Math.round(total * 100), k = count; const out = [];
        while (k > 1) { const max = Math.max(1, Math.floor(left / k * 2) - 1); let a = 1 + Math.floor(Math.random() * max); a = Math.min(a, left - (k - 1)); out.push(a); left -= a; k--; }
        out.push(left);
        return out.sort(() => Math.random() - 0.5).map(x => x / 100);
    }
    const findLucky = id => { for (const sid in (globalChats || {})) { const L = globalChats[sid] || []; for (let i = L.length - 1; i >= 0; i--) { const m = L[i]; if (m && m.type === 'money' && m.money && m.money.id === id) return { sid, m, mo: m.money }; } } return null; };
    function luckyText(mo) {
        const got = (mo.grabs || []).map(x => `${nameOf(x.who)} ￥${x.amt.toFixed(2)}`).join('、');
        const best = mo.status === 'done' && mo.grabs.length > 1 ? mo.grabs.slice().sort((a, b) => b.amt - a.amt)[0] : null;
        return `［拼手气红包］${nameOf(mo.from)} 发的，共 ￥${mo.amt.toFixed(2)} · ${mo.count} 个${mo.note ? ' · ' + mo.note : ''}　已抢 ${(mo.grabs || []).length}/${mo.count}${got ? '：' + got : ''}${best ? '　手气最佳：' + nameOf(best.who) : ''}${mo.status === 'expired' ? '　（没抢完的已退回）' : ''}`;
    }
    async function grab(id, who) {
        const f = findLucky(id); if (!f) return null; const mo = f.mo;
        if (mo.status !== 'open' || !(mo.left || []).length) return null;
        if ((mo.grabs || []).some(x => String(x.who) === String(who))) return null;
        const amt = mo.left.shift(); mo.grabs.push({ who, amt, at: Date.now() });
        try { const W = window.gyWallet; if (W && W.earn) { const rp = (W.cards(who) || []).find(c => c.kind === 'redpacket'); await W.earn(who, amt, '抢到 ' + nameOf(mo.from) + ' 的拼手气红包', rp ? rp.id : ''); } } catch (e) {}
        if (!mo.left.length) { mo.status = 'done'; const best = mo.grabs.length > 1 ? mo.grabs.slice().sort((a, b) => b.amt - a.amt)[0] : null; sys(f.sid, `🧧 ${nameOf(mo.from)} 的红包被抢完了${best ? '，手气最佳：' + nameOf(best.who) + '（￥' + best.amt.toFixed(2) + '）' : ''}`); }
        f.m.text = luckyText(mo); save(); rerender(f.sid);
        return amt;
    }
    window.gyLuckyGrab = async id => { const f = findLucky(id); if (!f) return; const g = G(f.sid); if (g && g.observe) { toast('👀 你不在这个群里', '抢不了'); return; } const a = await grab(id, 'me'); if (a != null) toast('🧧 抢到了 ￥' + a.toFixed(2), (f.mo.note || '') + (f.mo.status === 'done' ? ' · 抢完了' : '')); else toast('🧧 没抢到', f.mo.status === 'open' ? '你已经抢过了' : '已经抢完了'); };
    function scheduleGrabs(gid, mo) {
        const g = G(gid); if (!g) return;
        const muted = (g.mutedMembers || []).map(String);
        (g.members || []).filter(id => String(id) !== String(mo.from) && !muted.includes(String(id))).forEach(id => {
            if (Math.random() > 0.85) return;   // 有人没看见
            setTimeout(() => grab(mo.id, id), 1500 + Math.random() * 14000);
        });
    }
    async function sendLucky(gid, from, total, count, note) {
        const g = G(gid); if (!g) return null;
        total = r2(+total || 0); count = Math.max(1, Math.min(100, parseInt(count) || 1));
        if (total < count * 0.01) { toast('🧧 金额太少了', '每个至少 0.01'); return null; }
        try { const W = window.gyWallet; if (W && W.pay) await W.pay(from, total, '发拼手气红包 · ' + (g.name || '群聊')); } catch (e) {}
        const mo = { id: 'lk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'lucky', amt: total, count, note: String(note || '恭喜发财，大吉大利').slice(0, 40), from: String(from), to: gid, status: 'open', at: Date.now(), left: split(total, count), grabs: [] };
        if (!globalChats[gid]) globalChats[gid] = [];
        globalChats[gid].push({ sender: String(from) === 'me' ? 'me' : from, type: 'money', money: mo, timestamp: Date.now(), readBy: [], text: luckyText(mo) });
        save(); rerender(gid); scheduleGrabs(gid, mo);
        return mo;
    }
    window.gyLuckySend = sendLucky;
    window.gyLuckyOpen = function (gid) {
        gid = gid || sidNow(); const g = G(gid); if (!g) return;
        if (g.observe) { toast('👀 你不在这个群里', '发不了红包'); return; }
        if (!on('walletOn')) { toast('🧧 先打开钱包', '设置 → ⚙️ 自动化功能 → 💰 钱包'); return; }
        if (!on('groupLucky')) { toast('🧧 群红包关着', '设置 → ⚙️ 自动化功能 → 🎭 背着你发生的事'); return; }
        let o = document.getElementById('gyLuckyOv'); if (!o) { o = document.createElement('div'); o.id = 'gyLuckyOv'; o.className = 'gygp-ov'; o.onclick = e => { if (e.target === o) o.remove(); }; document.body.appendChild(o); }
        o.innerHTML = `<div class="gygp-lk"><div class="gygp-lk-h">🧧 拼手气红包<small>${esc(g.name || '群聊')}</small></div>
            <label>总金额<input id="gyLkAmt" type="number" min="0.01" step="0.01" value="52"></label>
            <label>红包个数<input id="gyLkCnt" type="number" min="1" max="100" value="${Math.max(1, (g.members || []).length)}"></label>
            <label>祝福<input id="gyLkNote" maxlength="40" placeholder="恭喜发财，大吉大利"></label>
            <div class="gygp-tip">每个人抢到多少是随机的，发出那一刻就分好了。钱从你的钱包扣，24 小时没抢完的退回。</div>
            <div class="gygp-lk-btns"><button onclick="document.getElementById('gyLuckyOv').remove()">取消</button><button class="ok" onclick="gyLuckySend('${gid}','me',document.getElementById('gyLkAmt').value,document.getElementById('gyLkCnt').value,document.getElementById('gyLkNote').value).then(m=>{if(m)document.getElementById('gyLuckyOv').remove()})">塞钱进红包</button></div></div>`;
    };
    // 群里点 💸：换成拼手气红包
    function hookSendUI() {
        const f = window.gyWalletSendUI; if (typeof f !== 'function' || f.__gyGrp) return;
        const w = function () { if (sidNow().startsWith('g_')) return window.gyLuckyOpen(sidNow()); return f.apply(this, arguments); };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyGrp = true; window.gyWalletSendUI = w; try { gyWalletSendUI = w; } catch (e) {}
    }
    // 卡片样子
    function hookCard() {
        const f = window.gyMoneyCardHtml; if (typeof f !== 'function' || f.__gyGrp) return;
        const w = function (msg) {
            const mo = msg && msg.money; if (!mo || mo.kind !== 'lucky') return f.apply(this, arguments);
            const mine = (mo.grabs || []).find(x => x.who === 'me');
            const best = mo.status === 'done' && mo.grabs.length > 1 ? mo.grabs.slice().sort((a, b) => b.amt - a.amt)[0] : null;
            const canGrab = mo.status === 'open' && !mine && String(mo.from) !== 'me' && !(G(mo.to) || {}).observe;
            return `<div class="gywl-tx red gygp-lucky s-${esc(mo.status)}"><div class="gywl-tx-main"><div class="gywl-seal">🧧</div><div class="gywl-tx-txt"><div class="gywl-tx-amt">拼手气红包</div><div class="gywl-tx-memo">${esc(mo.note)}</div></div></div>
                <div class="gygp-grabs">${(mo.grabs || []).map(x => `<span${best && best === x ? ' class="best"' : ''}>${esc(nameOf(x.who))} ￥${x.amt.toFixed(2)}${best && best === x ? ' 👑' : ''}</span>`).join('')}</div>
                <div class="gywl-foot${canGrab ? ' acts' : ''}">${canGrab ? `<button type="button" class="gywl-b yes" onclick="gyLuckyGrab('${mo.id}')">抢</button>` : ''}<span>${mine ? '你抢到 ￥' + mine.amt.toFixed(2) + ' · ' : ''}${mo.status === 'open' ? '已抢 ' + mo.grabs.length + '/' + mo.count : mo.status === 'done' ? '抢完了 · 共 ￥' + mo.amt.toFixed(2) : '过期了，没抢完的退回了'}</span></div></div>`;
        };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyGrp = true; window.gyMoneyCardHtml = w; try { gyMoneyCardHtml = w; } catch (e) {}
    }
    // 角色在群里发：[拼手气红包:金额|个数|祝福]
    const TAG = /\[\s*拼手气红包\s*[:：]\s*([^\]]*)\]/g;
    function hookTag() {
        const ex = window.gyChatActsExtract;
        if (typeof ex === 'function' && !ex.__gyGrp) {
            const w = function (text, char, isGroup) {
                if (typeof text === 'string' && /\[\s*拼手气红包/.test(text)) {
                    const found = []; arguments[0] = text.replace(TAG, (m0, body) => { found.push(body); return ''; }).replace(/[ \t]{2,}/g, ' ').trim();
                    const gid = sidNow();
                    if (isGroup && char && gid.startsWith('g_') && found.length && on('groupLucky') && on('walletOn')) {
                        const [a, n, note] = String(found[0]).split(/[|｜]/); const amt = parseFloat(a), cnt = parseInt(n);
                        if (amt > 0 && cnt > 0) setTimeout(() => sendLucky(gid, char.id, Math.min(amt, 9999), Math.min(cnt, 50), note), 400);
                    }
                }
                return ex.apply(this, arguments);
            };
            Object.keys(ex).forEach(k => { try { w[k] = ex[k]; } catch (e) {} }); w.__gyGrp = true; window.gyChatActsExtract = w;
        }
        const st = window.stripLeftoverMarkers;
        if (typeof st === 'function' && !st.__gyGrp) { const w = function (t) { if (typeof t === 'string' && t.indexOf('拼手气红包') >= 0) arguments[0] = t.replace(TAG, '').trim(); return st.apply(this, arguments); }; Object.keys(st).forEach(k => { try { w[k] = st[k]; } catch (e) {} }); w.__gyGrp = true; window.stripLeftoverMarkers = w; try { stripLeftoverMarkers = w; } catch (e) {} }
    }
    // 24 小时没抢完：退回
    setInterval(async () => {
        try {
            for (const sid in (globalChats || {})) for (const m of (globalChats[sid] || [])) {
                const mo = m && m.type === 'money' && m.money; if (!mo || mo.kind !== 'lucky' || mo.status !== 'open' || Date.now() - mo.at < 864e5) continue;
                const back = r2((mo.left || []).reduce((a, b) => a + b, 0)); mo.left = []; mo.status = 'expired';
                try { if (back > 0 && window.gyWallet) await window.gyWallet.earn(mo.from, back, '拼手气红包没抢完，退回'); } catch (e) {}
                m.text = luckyText(mo); save();
            }
        } catch (e) {}
    }, 60000);

    // ---------- 5) 自主行动 / 今天 / 小组件 / 记忆总览 ----------
    try {
        if (typeof GY_AUTONOMY_ACTIONS !== 'undefined' && !GY_AUTONOMY_ACTIONS.some(a => a.key === 'group_observe_talk')) GY_AUTONOMY_ACTIONS.push({
            key: 'group_observe_talk', label: '在她只围观的那个群里跟群友聊几句', hint: '她不在群里，只在旁边看',
            need: c => on('groupObserveAuto') && (groupChats || []).some(g => g.observe && (g.members || []).map(String).includes(String(c.id))),
            run: async c => { const g = (groupChats || []).find(x => x.observe && (x.members || []).map(String).includes(String(c.id))); return g && await observeTick(g.id, '自主') ? '在「' + (g.name || '群') + '」里聊了几句' : null; }
        });
        if (typeof GY_AUTONOMY_ACTIONS !== 'undefined' && !GY_AUTONOMY_ACTIONS.some(a => a.key === 'group_lucky')) GY_AUTONOMY_ACTIONS.push({
            key: 'group_lucky', label: '在群里发个拼手气红包', hint: '有由头才发（过节、请客、高兴）',
            need: c => on('groupLucky') && on('walletOn') && (groupChats || []).some(g => !g.observe && (g.members || []).map(String).includes(String(c.id))),
            run: async c => { const gs = (groupChats || []).filter(g => !g.observe && (g.members || []).map(String).includes(String(c.id))); const g = gs[Math.floor(Math.random() * gs.length)]; if (!g) return null; const n = (g.members || []).length + 1; const mo = await sendLucky(g.id, c.id, [8.88, 20, 52, 66, 88][Math.floor(Math.random() * 5)], n, ['大家辛苦啦', '请喝奶茶', '今天高兴', '抢！'][Math.floor(Math.random() * 4)]); return mo ? '在「' + (g.name || '群') + '」发了个拼手气红包' : null; }
        });
    } catch (e) {}
    function todayHtml() {
        const rows = [];
        (typeof groupChats !== 'undefined' ? groupChats : []).forEach(g => {
            const L = H(g.id).filter(m => m && m.timestamp && new Date(m.timestamp).toDateString() === new Date().toDateString());
            if (g.observe && L.length) rows.push([`👀 ${g.name || '群'}`, `今天聊了 ${L.filter(m => m.sender !== 'system').length} 条`, g.id]);
            const lk = L.filter(m => m.type === 'money' && m.money && m.money.kind === 'lucky');
            if (lk.length) rows.push([`🧧 ${g.name || '群'}`, `${lk.length} 个拼手气红包`, g.id]);
        });
        if (!rows.length) return '';
        return `<div class="gyt-sec gygp-tsec"><h4>👑 群聊</h4>${rows.slice(0, 4).map(r => `<div class="gyt-row click" onclick="try{switchMainView('chat');switchChatSession('${r[2]}')}catch(e){}"><span class="gyt-t">${esc(r[0])}</span><span class="gyt-x">${esc(r[1])}</span></div>`).join('')}</div>`;
    }
    function paintToday() { ['gyToday', 'gyTodayM'].forEach(id => { const b = document.getElementById(id); if (!b) return; b.querySelectorAll('.gygp-tsec').forEach(n => n.remove()); const h = todayHtml(); if (h) b.insertAdjacentHTML('beforeend', h); }); }
    function hookToday() { const f = window.gyTodayRender; if (typeof f !== 'function' || f.__gyGrp) return; const w = function () { const r = f.apply(this, arguments); try { paintToday(); } catch (e) {} return r; }; Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyGrp = true; window.gyTodayRender = w; }
    function regWidget() {
        const W = window.__gyPmW; if (!W || !W.WD) return false; if (W.WD.gyGroupW) return true;
        W.WD.gyGroupW = { n: '围观的群', sizes: ['s', 'm'], tap: () => { const g = (groupChats || []).find(x => x.observe) || (groupChats || [])[0]; if (g) try { switchMainView('chat'); switchChatSession(g.id); } catch (e) {} },
            r: w => { const g = (groupChats || []).find(x => x.observe); const m = g ? H(g.id).filter(x => x.sender !== 'system').slice(-1)[0] : null;
                if (w.size === 's') return `<div class="gyinr-w s"><b>👀</b><em>${g ? esc(g.name || '群') : '没有围观的群'}</em></div>`;
                return `<div class="gyinr-w m"><div class="h"><b>👀</b><span>${g ? esc(g.name || '群') : '围观的群'}</span></div><em>${m ? esc(nameOf(m.sender)) + '：' + esc(plain(m.text).slice(0, 36)) : (g ? '还没人说话' : '建群时勾「只围观」')}</em></div>`; } };
        return true;
    }
    function regMem() {
        if (typeof window.gyMemExAdd !== 'function') return false;
        const items = c => { const out = []; for (const sid in (globalChats || {})) (globalChats[sid] || []).forEach(m => { const mo = m && m.type === 'money' && m.money; if (mo && mo.kind === 'lucky') (mo.grabs || []).forEach(x => { if (String(x.who) === String(c.id)) out.push({ m, mo, x }); }); if (mo && mo.kind === 'lucky' && String(mo.from) === String(c.id)) out.push({ m, mo, sent: true }); }); return out.reverse(); };
        window.gyMemExAdd({ k: 'gyLucky', ico: '🧧', n: '群里的拼手气红包', d: 'TA 发的、抢到的（改＝改祝福语）', on: () => true, items,
            text: it => it.mo.note || '', meta: it => (it.sent ? `TA 发的 ￥${it.mo.amt.toFixed(2)} · ${it.mo.count} 个` : `从 ${nameOf(it.mo.from)} 那抢到 ￥${it.x.amt.toFixed(2)}`) + ' · ' + new Date(it.mo.at).toLocaleString(),
            edit: (it, v) => { it.mo.note = String(v).slice(0, 40); it.m.text = luckyText(it.mo); },
            del: (c, i) => { const it = items(c)[i]; if (!it) return; if (it.sent) { const L = globalChats[it.mo.to] || []; const k = L.indexOf(it.m); if (k >= 0) L.splice(k, 1); } else { it.mo.grabs = it.mo.grabs.filter(x => x !== it.x); it.m.text = luckyText(it.mo); } },
            save });
        return true;
    }

    // ---------- 样式 ----------
    const css = document.createElement('style');
    css.textContent = `.gygp-box{margin:10px 0;padding:10px;border-radius:8px;border:1px solid #f4b400;background:rgba(244,180,0,.06)}.gygp-h{font-size:14px;color:#b07d00}
.gygp-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;margin-top:8px}.gygp-row.col{flex-direction:column;align-items:stretch}.gygp-row select,.gygp-row textarea{border:1px solid #e3d29a;border-radius:6px;padding:5px 8px;font-size:13px;background:#fff}
.gygp-chips{display:flex;flex-wrap:wrap;gap:6px}.gygp-chips label{display:flex;align-items:center;gap:3px;font-size:12px;background:#fff;padding:3px 8px;border-radius:999px;border:1px solid #eee}.gygp-row em{font-style:normal;font-size:11.5px;color:#999}
.gygp-tip{font-size:11.5px;color:#8b98a5;margin-top:8px;line-height:1.5}.gygp-new{display:flex;gap:6px;align-items:center;font-size:13px;margin:10px 0;color:#536471}
#chatInputArea.gygp-obs>*:not(#gyObsBar){display:none!important}#gyObsBar{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:8px 12px;box-sizing:border-box;font-size:13px;color:#536471}
#gyObsBar button{border:none;border-radius:999px;padding:8px 16px;background:#1d9bf0;color:#fff;font-size:14px;cursor:pointer}#gyObsBar button[disabled]{opacity:.6}
.gygp-grabs{display:flex;flex-wrap:wrap;gap:4px;padding:0 12px 6px;font-size:11.5px}.gygp-grabs span{background:rgba(255,255,255,.6);border-radius:8px;padding:1px 6px;color:#a0522d}.gygp-grabs span.best{font-weight:700}
.gygp-ov{position:fixed;inset:0;z-index:100060;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:16px}
.gygp-lk{width:min(340px,100%);border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.25);padding:0 0 14px}
.gygp-lk-h{background:linear-gradient(135deg,#e5484d,#f76b6b);color:#ffe6a8;font-size:18px;font-weight:700;padding:18px 18px 14px}.gygp-lk-h small{display:block;font-size:12px;font-weight:400;color:#ffe6a8cc;margin-top:2px}
.gygp-lk label{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 18px 0;font-size:14px}.gygp-lk input{flex:1;max-width:180px;border:1px solid #eee;border-radius:8px;padding:6px 8px;font-size:14px;text-align:right}
.gygp-lk .gygp-tip{padding:0 18px}.gygp-lk-btns{display:flex;gap:10px;justify-content:flex-end;padding:12px 18px 0}.gygp-lk-btns button{border:none;border-radius:999px;padding:8px 16px;cursor:pointer;background:#f0f2f5}.gygp-lk-btns button.ok{background:#e5484d;color:#fff}`;
    document.head.appendChild(css);

    function hookAll() { hookOptions(); hookCreate(); hookSendUI(); hookCard(); hookTag(); hookToday(); try { paintObsBar(); } catch (e) {} }
    hookAll(); setInterval(hookAll, 3000);
    // 进出聊天时更新输入框那一栏
    const rrHook = () => { const f = window.renderChatMessages; if (typeof f !== 'function' || f.__gyGrp) return; const w = function () { const r = f.apply(this, arguments); try { paintObsBar(); } catch (e) {} return r; }; Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyGrp = true; window.renderChatMessages = w; try { renderChatMessages = w; } catch (e) {} };
    rrHook(); setInterval(rrHook, 3000);
    let n1 = 0; const iv1 = setInterval(() => { if (regMem() || ++n1 > 80) clearInterval(iv1); }, 500);
    let n2 = 0; const iv2 = setInterval(() => { if (regWidget() || ++n2 > 240) clearInterval(iv2); }, 500);
})();
