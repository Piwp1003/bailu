/* ===========================================================================
   js/74 —— 🩸 经期记录（用户的）
   ---------------------------------------------------------------------------
   · 记：哪天来、哪天走；每天的流量、痛经程度、症状、心情、备注。
   · 算：平均周期 / 经期天数（也能自己定），预测下次、排卵日、易孕期；日历上都标出来。
   · 提醒：提前 N 天（默认 2 天）+ 当天，通知你。
   · 角色：
       - 默认模式（按固定频率）的角色：都记得、都会提醒——快来之前提前说一声、来的那天主动找你、
         可能给你点一杯热的；经期里聊天会更体贴（知道你第几天、疼不疼）。
       - 自主模式的角色：自己决定记不记、提不提醒（自主行动的菜单里多了几件事，TA 自己挑）。
       - 你在聊天里跟 TA 说了「来例假了」，TA 就知道了。
   · 小手机小组件「经期」；日历（小手机的日历、「我的日历」）上都能看到。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyPeriodLoaded) return;
    window.__gyPeriodLoaded = true;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pad = n => String(n).padStart(2, '0');
    const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const parse = k => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d); };
    const addD = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
    const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);   // b - a（天）
    const todayK = () => key(new Date());
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };
    const uname = () => (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '你';
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []).filter(c => c && !c.members);
    const LF = (typeof localforage !== 'undefined' && localforage.createInstance) ? localforage.createInstance({ name: 'gyPeriod', storeName: 'd' }) : null;

    const FLOW = ['没有', '少', '中', '多', '很多'];
    const PAIN = ['不疼', '有点疼', '疼', '很疼'];
    const SYMS = ['腹痛', '腰酸', '头痛', '胸胀', '长痘', '胀气', '犯困', '没力气', '情绪低落', '容易烦', '想吃甜的', '失眠', '手脚冰凉', '恶心', '拉肚子'];
    const MOODS = ['开心', '平静', '烦躁', '低落', '敏感', '焦虑', '累', '想被抱抱'];
    let D = { periods: [], days: {}, cfg: { cycleAuto: true, cycle: 28, lenAuto: true, len: 5, before: 2, remind: true, share: true, excl: [] }, aware: {}, done: {} };
    async function load() { try { const d = LF && await LF.getItem('d'); if (d && typeof d === 'object') { D = Object.assign(D, d); D.cfg = Object.assign({ cycleAuto: true, cycle: 28, lenAuto: true, len: 5, before: 2, remind: true, share: true, excl: [] }, d.cfg || {}); } } catch (e) {} }
    async function save() { try { if (LF) await LF.setItem('d', D); } catch (e) {} try { window.dispatchEvent(new CustomEvent('gy:period')); } catch (e) {} }
    const ready = load();
    window.gyPeriodData = () => D;

    /* =================== 计算 =================== */
    const sorted = () => D.periods.filter(p => p && p.start).sort((a, b) => a.start < b.start ? -1 : 1);
    function avgCycle() {
        if (!D.cfg.cycleAuto) return Math.max(15, +D.cfg.cycle || 28);
        const P = sorted(), ds = [];
        for (let i = 1; i < P.length; i++) { const x = diff(P[i - 1].start, P[i].start); if (x >= 15 && x <= 60) ds.push(x); }
        const L = ds.slice(-6); return L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length) : Math.max(15, +D.cfg.cycle || 28);
    }
    function avgLen() {
        if (!D.cfg.lenAuto) return Math.max(1, +D.cfg.len || 5);
        const L = sorted().filter(p => p.end).map(p => diff(p.start, p.end) + 1).filter(x => x >= 1 && x <= 12).slice(-6);
        return L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length) : Math.max(1, +D.cfg.len || 5);
    }
    const endOf = p => p.end || addD(p.start, avgLen() - 1);
    function status(k) {
        k = k || todayK();
        const P = sorted(), cyc = avgCycle(), len = avgLen();
        const cur = P.find(p => p.start <= k && endOf(p) >= k);
        const last = P.filter(p => p.start <= k).pop();
        const out = { has: P.length > 0, cycle: cyc, len, inPeriod: !!cur, day: cur ? diff(cur.start, k) + 1 : 0, last: last ? last.start : null };
        if (!last) return out;
        let next = addD(last.start, cyc);
        if (cur) next = addD(cur.start, cyc);
        out.late = 0;
        if (!cur && next <= k) { out.late = diff(next, k); }
        if (out.late > 0) { out.next = k; out.toNext = 0; } else { out.next = next; out.toNext = diff(k, next); }
        const ov = addD(out.late > 0 ? addD(k, cyc) : next, -14);
        const ovThis = addD(last.start, cyc - 14);
        out.ovulation = ovThis >= k ? ovThis : ov;
        out.toOv = diff(k, out.ovulation);
        out.fertile = !cur && Math.abs(diff(ovThis, k) + 0) <= 5 && diff(ovThis, k) >= -5 && diff(ovThis, k) <= 1;
        out.ovDay = ovThis === k;
        out.cycleDay = diff(last.start, k) + 1;
        return out;
    }
    window.gyPeriodNow = status;
    // 日历上这一天是什么：'pd' 记下的经期 / 'pp' 预测的经期 / 'ov' 排卵日 / 'fe' 易孕期
    function dayKind(k) {
        const P = sorted(); if (!P.length) return '';
        if (P.some(p => p.start <= k && endOf(p) >= k)) return 'pd';
        const last = P[P.length - 1], cyc = avgCycle(), len = avgLen();
        for (let i = 0; i < 4; i++) {
            const s = addD(last.start, cyc * (i + 1));
            if (k >= s && k <= addD(s, len - 1) && k > endOf(last)) return 'pp';
            const ov = addD(s, -14);
            if (k === ov) return 'ov';
            if (diff(ov, k) >= -5 && diff(ov, k) <= 1 && k > endOf(last)) return 'fe';
        }
        return '';
    }
    window.gyPeriodCell = k => { const x = dayKind(k); return x ? ' gypr-' + x : ''; };
    const phaseText = s => {
        s = s || status();
        if (!s.has) return '还没记过';
        if (s.inPeriod) return `经期第 ${s.day} 天`;
        if (s.late > 0) return `推迟 ${s.late} 天了`;
        if (s.ovDay) return '今天是排卵日';
        if (s.fertile) return '易孕期';
        return s.toNext === 0 ? '预计今天来' : `还有 ${s.toNext} 天`;
    };
    window.gyPeriodPhase = () => phaseText();
    function dayRec(k) { return D.days[k] || null; }
    const recText = r => r ? [r.flow != null && r.flow > 0 ? '流量' + FLOW[r.flow] : '', r.pain != null && r.pain > 0 ? PAIN[r.pain] : '', (r.sym || []).join('、'), r.mood ? '心情' + r.mood : '', r.note || ''].filter(Boolean).join('，') : '';
    window.gyPeriodDayRow = function (k) {
        const x = dayKind(k), r = dayRec(k);
        if (!x && !r) return '';
        const lab = { pd: '经期', pp: '预计经期', ov: '排卵日', fe: '易孕期' }[x] || '经期记录';
        return `<div class="ev" onclick="gyPeriodOpen('${k}')" style="cursor:pointer"><i style="background:#e5566f"></i><div><b>🩸 ${lab}${x === 'pd' ? ' · 第 ' + (diff(sorted().filter(p => p.start <= k).pop().start, k) + 1) + ' 天' : ''}</b><span>${esc(recText(r) || '点开记录今天的情况')}</span></div></div>`;
    };

    /* =================== 记录的动作 =================== */
    function startOn(k) {
        const P = sorted();
        const hit = P.find(p => p.start <= k && endOf(p) >= k);
        if (hit) return hit;
        // 挨着上一次（三天内）就当同一次，只是往后延
        const prev = P.filter(p => p.start < k).pop();
        if (prev && prev.end && diff(prev.end, k) <= 2) { prev.end = null; return prev; }
        const p = { start: k, end: null }; D.periods.push(p);
        // 后面几天要是已经被别的一次占着（补记），就合并
        return p;
    }
    window.gyPeriodStart = async function (k) { k = k || todayK(); await ready; startOn(k); await save(); onChange('start', k); paintAll(); };
    window.gyPeriodEnd = async function (k) {
        k = k || todayK(); await ready;
        const p = sorted().filter(x => x.start <= k).pop(); if (!p) return;
        p.end = k < p.start ? p.start : k; await save(); onChange('end', k); paintAll();
    };
    window.gyPeriodClearDay = async function (k) {
        await ready;
        const p = sorted().find(x => x.start <= k && endOf(x) >= k); if (!p) return;
        if (p.start === k) { if (p.end && p.end > k) p.start = addD(k, 1); else D.periods = D.periods.filter(x => x !== p); }
        else p.end = addD(k, -1);
        await save(); paintAll();
    };
    window.gyPeriodSetDay = async function (k, f, v) {
        await ready;
        const r = D.days[k] = D.days[k] || {};
        if (f === 'sym') { r.sym = r.sym || []; r.sym = r.sym.includes(v) ? r.sym.filter(x => x !== v) : r.sym.concat(v); }
        else if (f === 'flow' || f === 'pain') { r[f] = +v; if (f === 'flow' && +v > 0 && !sorted().some(p => p.start <= k && endOf(p) >= k)) startOn(k); }
        else r[f] = v;
        await save(); paintAll();
    };
    window.gyPeriodCfg = async function (k, v) {
        await ready;
        if (k === 'excl') { const L = D.cfg.excl || []; D.cfg.excl = L.includes(v) ? L.filter(x => x !== v) : L.concat(v); }
        else if (typeof D.cfg[k] === 'boolean') D.cfg[k] = !!v;
        else D.cfg[k] = +v;
        await save(); paintAll();
    };

    /* =================== 角色知不知道 =================== */
    const isAuto = c => typeof getCharActMode === 'function' ? getCharActMode(c) === 'auto' : c.actMode === 'auto';
    // 默认模式：都知道（除非你在设置里不让 TA 知道）；自主模式：TA 自己记下了 / 你跟 TA 说过，才知道
    function knows(c) {
        if (!c || !D.cfg.share || (D.cfg.excl || []).includes(String(c.id))) return false;
        if (!isAuto(c)) return true;
        return !!(D.aware[String(c.id)]);
    }
    window.gyPeriodKnows = id => knows(chars().find(c => String(c.id) === String(id)));
    const NUDGE = {};   // 这次主动找你的由头
    window.__gyPeriodCtxFor = function (charId) {
        const c = chars().find(x => String(x.id) === String(charId));
        if (!c || !knows(c)) return '';
        const s = status(); if (!s.has) return '';
        const who = typeof userDisplayName === 'function' ? userDisplayName(c) : uname();
        const r = dayRec(todayK()), rt = recText(r);
        let t = '';
        if (s.inPeriod) t = `【${who}的生理期】${who}现在在经期第 ${s.day} 天${rt ? '（她今天记的：' + rt + '）' : ''}。你知道这件事。聊天时自然地体贴一点——按你自己的性格来：可以问她疼不疼、让她别碰凉的、多喝热的、早点休息；${s.day <= 2 ? '头两天通常最难受。' : ''}别每句话都提，也别说教。`;
        else if (s.late > 0) t = `【${who}的生理期】她的例假比预计晚了 ${s.late} 天还没来。你知道这件事，可以不动声色地关心一下她最近累不累、有没有不舒服，别吓她。`;
        else if (s.toNext <= Math.max(2, +D.cfg.before || 2)) t = `【${who}的生理期】她的例假预计 ${s.toNext === 0 ? '今天' : s.toNext + ' 天后'}来。你记得这件事，可以提醒她别吃冰的、包里带好卫生巾、这几天早点睡——按你的性格，用你的方式。`;
        const n = NUDGE[String(c.id)];
        if (n) t += `\n【这次主动找她的由头】${n}。就为了这个来找她，自然地说，别解释你为什么知道。`;
        return t;
    };
    function hookCtx() { try { if (typeof GY_BOX_CTX !== 'undefined' && Array.isArray(GY_BOX_CTX) && !GY_BOX_CTX.some(x => x[0] === '__gyPeriodCtxFor')) GY_BOX_CTX.push(['__gyPeriodCtxFor', '经期']); } catch (e) {} }

    // 让 TA 主动来找你一次（带着由头）
    async function reachOut(c, why) {
        if (typeof sendProactiveChatMessage !== 'function') return false;
        NUDGE[String(c.id)] = why;
        try { await sendProactiveChatMessage(c); return true; } catch (e) { return false; } finally { delete NUDGE[String(c.id)]; }
    }
    async function orderWarm(c) {
        try {
            const on = typeof isAutoOn === 'function' ? isAutoOn('takeoutOn') : true;
            if (on && typeof window.gytoCharOrder === 'function') { const r = await window.gytoCharOrder(c.id, pick(['红糖姜茶', '热的桂圆红枣茶', '一碗热汤', '热可可', '暖胃的粥'])); if (r) return '给你点了「' + r.shop + '」'; }
            if (typeof window.gymallCharBuy === 'function' && typeof window.gymallHasProducts === 'function' && window.gymallHasProducts()) { const n = await window.gymallCharBuy(c.id, 'me', pick(['暖宝宝', '热水袋', '红糖', '暖腹贴'])); if (n) return '给你买了「' + n + '」'; }
        } catch (e) {}
        return null;
    }
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const canWarm = () => { try { return ((typeof isAutoOn !== 'function' || isAutoOn('takeoutOn')) && typeof window.gytoCharOrder === 'function') || (typeof window.gymallCharBuy === 'function' && typeof window.gymallHasProducts === 'function' && window.gymallHasProducts()); } catch (e) { return false; } };
    const once = (k) => { if (D.done[k]) return false; D.done[k] = Date.now(); return true; };

    // 自主模式：几件跟经期有关的事，放进 TA 自己挑的菜单里
    function hookActions() {
        if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || !Array.isArray(GY_AUTONOMY_ACTIONS) || GY_AUTONOMY_ACTIONS.some(a => a.key === 'period_note')) return;
        const S = () => status();
        GY_AUTONOMY_ACTIONS.push(
            { key: 'period_note', label: '把对方的经期记在心上', hint: '以后到日子了你会记得提醒 / 照顾她；不想记就不选',
              need: c => D.cfg.share && S().has && isAuto(c) && !D.aware[String(c.id)] && !(D.cfg.excl || []).includes(String(c.id)),
              run: async c => { D.aware[String(c.id)] = Date.now(); await save(); return '把你的经期记在心上了'; } },
            { key: 'period_remind', label: '提醒对方经期快到了', hint: '快来了：让她别吃冰的、带好东西',
              need: c => knows(c) && S().has && !S().inPeriod && S().toNext <= Math.max(2, +D.cfg.before || 2) && !D.done['rm:' + c.id + ':' + S().next],
              run: async c => { once('rm:' + c.id + ':' + S().next); await save(); return (await reachOut(c, `她的例假大概 ${S().toNext === 0 ? '今天' : S().toNext + ' 天后'}来，提前提醒她`)) ? '提醒你经期快到了' : null; } },
            { key: 'period_care', label: '关心一下正在经期的对方', hint: '问问她疼不疼、吃了没',
              need: c => knows(c) && S().inPeriod && !D.done['care:' + c.id + ':' + todayK()],
              run: async c => { once('care:' + c.id + ':' + todayK()); await save(); return (await reachOut(c, `她在经期第 ${S().day} 天，想关心一下她`)) ? '关心了你一下' : null; } },
            { key: 'period_warm', label: '给经期里的对方点杯热饮 / 买暖宝宝', hint: '真的下单',
              need: c => knows(c) && S().inPeriod && canWarm() && !D.done['warm:' + c.id + ':' + (S().last || '')],
              run: async c => { once('warm:' + c.id + ':' + (S().last || '')); await save(); return await orderWarm(c); } }
        );
    }

    /* =================== 定时：提醒你 + 默认模式的角色 =================== */
    let busy = false;
    async function tick() {
        if (busy) return; busy = true;
        try {
            await ready; const s = status(); if (!s.has) return;
            const tk = todayK(), before = Math.max(0, +D.cfg.before || 0);
            // 提醒你自己
            if (D.cfg.remind) {
                if (!s.inPeriod && s.toNext > 0 && s.toNext <= before && once('u:soon:' + s.next)) notify(`🩸 经期预计 ${s.toNext} 天后来`, '记得带好卫生巾，这几天别吃冰的');
                if (!s.inPeriod && s.toNext === 0 && s.late === 0 && once('u:day:' + s.next)) notify('🩸 经期预计今天来', '来了的话点一下「今天来了」');
                if (s.late >= 3 && once('u:late:' + tk)) notify(`🩸 这次晚了 ${s.late} 天`, '有空记一下，也别太担心');
            }
            if (!D.cfg.share) return;
            // 默认模式的角色：记得、提醒、来的那天找你
            for (const c of chars()) {
                if (isAuto(c) || !knows(c)) continue;
                if (!s.inPeriod && s.toNext > 0 && s.toNext <= before && once('rm:' + c.id + ':' + s.next)) { await save(); await reachOut(c, `她的例假大概 ${s.toNext} 天后来，提前提醒她`); continue; }
                if (s.inPeriod && s.day === 1 && once('d1:' + c.id + ':' + s.last)) {
                    await save();
                    await reachOut(c, '她今天来例假了，关心她一下');
                    if (Math.random() < 0.5 && once('warm:' + c.id + ':' + s.last)) { await save(); await orderWarm(c); }
                    continue;
                }
                if (s.inPeriod && s.day > 1 && s.day <= 3 && Math.random() < 0.5 && once('care:' + c.id + ':' + tk)) { await save(); await reachOut(c, `她在经期第 ${s.day} 天，问问她今天怎么样`); }
            }
            await save();
        } catch (e) { console.warn('[经期] 定时检查出错：', e); } finally { busy = false; }
    }
    function notify(t, b) {
        toast(t, b);
        try { if (typeof addNotification === 'function') addNotification(`<b>${esc(t)}</b>　${esc(b)}`, null, null, null, b, { jump: { fn: 'gyPeriodOpen' } }); } catch (e) {}
    }
    window.gyPeriodTick = tick;
    // 记录变了：默认模式的角色当天就知道
    async function onChange(what, k) {
        if (what === 'start' && k === todayK()) setTimeout(tick, 1500);
        try { if (typeof window.gyDataChanged === 'function') window.gyDataChanged('period'); } catch (e) {}
    }
    // 你在聊天里说了「来例假了」：这个角色就知道了（自主模式也一样）；还没记的话问你要不要记上
    const SAY = /(来(了)?(大姨妈|例假|月经|姨妈)|大姨妈来|例假来|月经来|生理期|姨妈痛|痛经)/;
    function hookChat() {
        if (typeof window.sendChatMessage !== 'function' || window.sendChatMessage.__gyPr) return;
        const f0 = window.sendChatMessage;
        window.sendChatMessage = async function () {
            try {
                const inp = document.getElementById('chatInput'), t = inp ? inp.value : '', sid = typeof currentChatSessionId !== 'undefined' ? String(currentChatSessionId) : '';
                if (t && SAY.test(t) && sid) {
                    D.aware[sid] = Date.now(); save();
                    const s = status();
                    if (!s.inPeriod && /来/.test(t)) setTimeout(() => { if (!status().inPeriod) askStart(); }, 400);
                }
            } catch (e) {}
            return f0.apply(this, arguments);
        };
        window.sendChatMessage.__gyPr = true;
    }
    function askStart() {
        const el = document.createElement('div'); el.className = 'gypr-ask';
        el.innerHTML = `<span>🩸 要记成今天来例假了吗？</span><b onclick="gyPeriodStart();this.parentNode.remove()">记上</b><i onclick="this.parentNode.remove()">不用</i>`;
        document.body.appendChild(el); setTimeout(() => el.remove(), 9000);
    }

    /* =================== 界面 =================== */
    let VM = null, SEL = null;
    window.gyPeriodOpen = async function (k) {
        await ready;
        SEL = k || todayK(); const d = parse(SEL); VM = [d.getFullYear(), d.getMonth()];
        let ov = document.getElementById('gyPrOv'); if (ov) ov.remove();
        ov = document.createElement('div'); ov.id = 'gyPrOv'; ov.className = 'modal-overlay';
        ov.innerHTML = '<div class="modal-box gypr-box" id="gyPrBox"></div>';
        document.body.appendChild(ov); ov.style.display = 'flex';
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        paint();
    };
    function paint() {
        const box = document.getElementById('gyPrBox'); if (!box) return;
        const s = status(), tk = todayK(), [y, m] = VM;
        const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
        let cells = ''; for (let i = 0; i < first; i++) cells += '<i></i>';
        for (let d = 1; d <= days; d++) { const k = key(new Date(y, m, d)); const r = dayRec(k); cells += `<span class="c${window.gyPeriodCell(k)}${k === tk ? ' today' : ''}${k === SEL ? ' sel' : ''}" onclick="gyPeriodPick('${k}')"><b>${d}</b>${r && ((r.sym || []).length || r.note || r.mood || r.pain) ? '<u></u>' : ''}</span>`; }
        const pct = s.has ? Math.min(1, (s.cycleDay || 1) / s.cycle) : 0, C = 2 * Math.PI * 52;
        const r = dayRec(SEL) || {}, inP = sorted().some(p => p.start <= SEL && endOf(p) >= SEL), isToday = SEL === tk;
        const chips = (f, L, cur) => L.map((n, i) => `<span class="ch${cur === i ? ' on' : ''}" onclick="gyPeriodSetDay('${SEL}','${f}',${i})">${n}</span>`).join('');
        const cs = chars();
        box.innerHTML = `<div class="gypr-hd"><b>🩸 经期记录</b><span onclick="document.getElementById('gyPrOv').remove()">✕</span></div>
            <div class="gypr-top">
                <svg viewBox="0 0 120 120" width="120" height="120"><circle cx="60" cy="60" r="52" fill="none" stroke="#f5dde2" stroke-width="10"/><circle cx="60" cy="60" r="52" fill="none" stroke="${s.inPeriod ? '#e5566f' : '#f19bb0'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 60 60)"/></svg>
                <div class="gypr-ring"><em>${s.has ? '周期第 ' + (s.cycleDay || 1) + ' 天' : ''}</em><b>${esc(phaseText(s))}</b><span>${s.has && !s.inPeriod && s.next ? '下次 ' + s.next.slice(5).replace('-', '月') + '日' : s.inPeriod ? '已经 ' + s.day + ' 天' : '点下面「今天来了」开始'}</span></div>
                <div class="gypr-btns">${s.inPeriod ? `<button onclick="gyPeriodEnd()">今天走了</button>` : `<button class="pri" onclick="gyPeriodStart()">今天来了</button>`}
                    <p>平均周期 <b>${s.cycle}</b> 天<br>经期 <b>${s.len}</b> 天${s.has && s.ovulation ? `<br>排卵日 ${s.ovulation.slice(5).replace('-', '月')}日` : ''}</p></div>
            </div>
            <div class="gypr-nav"><i onclick="gyPeriodMonth(-1)">‹</i><b>${y} 年 ${m + 1} 月</b><i onclick="gyPeriodMonth(1)">›</i></div>
            <div class="gypr-cal">${'日一二三四五六'.split('').map(w => `<i class="w">${w}</i>`).join('')}${cells}</div>
            <div class="gypr-lg"><span><i class="pd"></i>经期</span><span><i class="pp"></i>预计经期</span><span><i class="fe"></i>易孕期</span><span><i class="ov"></i>排卵日</span></div>
            <div class="gypr-day"><div class="dh"><b>${SEL.slice(5).replace('-', '月')}日${isToday ? ' · 今天' : ''}</b>
                ${inP ? `<span onclick="gyPeriodEnd('${SEL}')">这天走的</span><span onclick="gyPeriodClearDay('${SEL}')">这天不是经期</span>` : `<span onclick="gyPeriodStart('${SEL}')">这天来的</span>`}</div>
                <div class="row"><em>流量</em>${chips('flow', FLOW, r.flow)}</div>
                <div class="row"><em>痛经</em>${chips('pain', PAIN, r.pain)}</div>
                <div class="row"><em>症状</em>${SYMS.map(x => `<span class="ch${(r.sym || []).includes(x) ? ' on' : ''}" onclick="gyPeriodSetDay('${SEL}','sym','${x}')">${x}</span>`).join('')}</div>
                <div class="row"><em>心情</em>${MOODS.map(x => `<span class="ch${r.mood === x ? ' on' : ''}" onclick="gyPeriodSetDay('${SEL}','mood','${r.mood === x ? '' : x}')">${x}</span>`).join('')}</div>
                <textarea placeholder="备注（想说什么都行）" onchange="gyPeriodSetDay('${SEL}','note',this.value)">${esc(r.note || '')}</textarea></div>
            <details class="gypr-set"><summary>⚙️ 周期设置和提醒</summary>
                <label><input type="checkbox" ${D.cfg.cycleAuto ? 'checked' : ''} onchange="gyPeriodCfg('cycleAuto',this.checked)"> 周期按记录自动算</label>　<label>否则固定 <input type="number" min="15" max="60" value="${D.cfg.cycle}" onchange="gyPeriodCfg('cycle',this.value)"> 天</label><br>
                <label><input type="checkbox" ${D.cfg.lenAuto ? 'checked' : ''} onchange="gyPeriodCfg('lenAuto',this.checked)"> 经期天数按记录自动算</label>　<label>否则固定 <input type="number" min="1" max="12" value="${D.cfg.len}" onchange="gyPeriodCfg('len',this.value)"> 天</label><br>
                <label><input type="checkbox" ${D.cfg.remind ? 'checked' : ''} onchange="gyPeriodCfg('remind',this.checked)"> 提醒我</label>　提前 <input type="number" min="0" max="7" value="${D.cfg.before}" onchange="gyPeriodCfg('before',this.value)"> 天 + 当天<br>
                <label><input type="checkbox" ${D.cfg.share ? 'checked' : ''} onchange="gyPeriodCfg('share',this.checked)"> 让角色知道</label>
                <div class="who">${cs.map(c => `<span class="ch${(D.cfg.excl || []).includes(String(c.id)) ? '' : ' on'}" onclick="gyPeriodCfg('excl','${esc(c.id)}')">${esc(c.remark || c.name)} · ${isAuto(c) ? (D.aware[String(c.id)] ? '自己记下了' : '自己决定记不记') : '会记得、会提醒'}</span>`).join('')}</div>
                <div class="tip">默认模式的角色：都记得，快来之前提前说、来的那天主动找你、可能给你点杯热的，经期里聊天会更体贴。自主模式的角色：自己决定记不记、提不提醒；你在聊天里跟 TA 说「来例假了」，TA 就知道了。点名字可以不让某个人知道。</div>
            </details>
            <details class="gypr-set"><summary>📜 以前的记录（${sorted().length} 次）</summary>${sorted().slice().reverse().slice(0, 24).map(p => `<div class="his"><b>${p.start}</b> → ${p.end || '（进行中 / 按平均天数算）'}　${p.end ? diff(p.start, p.end) + 1 + ' 天' : ''}</div>`).join('') || '<div class="tip">还没有</div>'}</details>`;
    }
    window.gyPeriodPick = k => { SEL = k; paint(); };
    window.gyPeriodMonth = n => { let [y, m] = VM; m += n; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } VM = [y, m]; paint(); };
    function paintAll() {
        paint();
        try { const X = window.__gyPmW; if (X && X.render) X.render(); } catch (e) {}
        try { const n = document.getElementById('gyPmApp'); if (n && document.body.classList.contains('gyphm-native') && n.querySelector('.pmc') && typeof window.gyPmCalendar === 'function') window.gyPmCalendar(); } catch (e) {}
    }

    /* =================== 小组件 + 入口 =================== */
    function widget() {
        const X = window.__gyPmW; if (!X || !X.WD || X.WD.period) return !!(X && X.WD && X.WD.period);
        X.WD.period = {
            n: '经期', sizes: ['s', 'm'],
            tap: () => window.gyPeriodOpen(),
            act: (w, a) => { if (a === 'start') window.gyPeriodStart(); if (a === 'end') window.gyPeriodEnd(); },
            r: w => {
                const s = status(), C = 2 * Math.PI * 30, pct = s.has ? Math.min(1, (s.cycleDay || 1) / s.cycle) : 0;
                const ring = `<svg viewBox="0 0 72 72" width="72" height="72"><circle cx="36" cy="36" r="30" fill="none" stroke="rgba(229,86,111,.18)" stroke-width="7"/><circle cx="36" cy="36" r="30" fill="none" stroke="#e5566f" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 36 36)"/></svg>`;
                const big = s.has ? (s.inPeriod ? s.day : s.late > 0 ? '+' + s.late : s.toNext) : '—';
                const sub = !s.has ? '点开记录' : s.inPeriod ? '经期第几天' : s.late > 0 ? '推迟了几天' : '天后来';
                if (w.size === 's') return `<div class="gw-pr s"><div class="rg">${ring}<b>${big}</b></div><em>${esc(phaseText(s))}</em></div>`;
                const tk = todayK(); let strip = '';
                for (let i = -2; i <= 4; i++) { const k = addD(tk, i); strip += `<i class="${window.gyPeriodCell(k).trim().replace('gypr-', '')}${i === 0 ? ' t' : ''}">${parse(k).getDate()}</i>`; }
                return `<div class="gw-pr m"><div class="rg">${ring}<b>${big}</b><span>${sub}</span></div><div class="rt"><em>🩸 ${esc(phaseText(s))}</em><div class="strip">${strip}</div><span class="bt" data-act="${s.inPeriod ? 'end' : 'start'}">${s.inPeriod ? '今天走了' : '今天来了'}</span></div></div>`;
            }
        };
        return true;
    }
    function entries() {
        try { if (typeof registerMiniFeature === 'function' && !(typeof GY_MINI_FEATURES !== 'undefined' && GY_MINI_FEATURES.some(f => f.id === 'period'))) registerMiniFeature({ id: 'period', icon: '🩸', title: '经期记录', desc: '记经期、预测下次和排卵日、提前提醒；角色也会记得、会照顾你', onOpen: () => window.gyPeriodOpen() }); } catch (e) {}
        // 「我的日历」那一页的入口
        const idx = document.getElementById('upIndex'), after = document.getElementById('upEntryMycal');
        if (idx && after && !document.getElementById('upEntryPeriod')) {
            const b = after.cloneNode(true); b.id = 'upEntryPeriod'; b.removeAttribute('onclick'); b.onclick = () => window.gyPeriodOpen();
            const t = b.querySelector('.set-entry-title'), d = b.querySelector('.set-entry-desc'), i = b.querySelector('.set-entry-ico');
            if (t) t.textContent = '经期记录'; if (d) d.textContent = '记经期、预测下次、提前提醒，角色也会照顾你'; if (i) i.textContent = '🩸';
            after.parentNode.insertBefore(b, after.nextSibling);
        }
    }

    const CSS = `
#gyPrOv{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:14px}
#gyPrOv .gypr-box{background:#fff;color:#222;border-radius:20px;width:min(560px,100%);max-height:92vh;overflow:auto;padding:16px 18px;box-sizing:border-box}
.gypr-hd{display:flex;justify-content:space-between;font-size:18px;margin-bottom:8px}.gypr-hd span{cursor:pointer;color:#999}
.gypr-top{display:flex;align-items:center;gap:14px;position:relative}.gypr-top svg{flex-shrink:0}
.gypr-ring{position:absolute;left:0;top:0;width:120px;height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.gypr-ring em{font-style:normal;font-size:10.5px;color:#b7707e}.gypr-ring b{font-size:15px;color:#c23a55;line-height:1.3}.gypr-ring span{font-size:10.5px;color:#999}
.gypr-btns{flex:1}.gypr-btns button{padding:10px 18px;border-radius:14px;border:none;background:#f7e3e7;color:#c23a55;font-size:15px;font-family:inherit;cursor:pointer}.gypr-btns button.pri{background:#e5566f;color:#fff}
.gypr-btns p{font-size:12.5px;color:#888;margin:8px 0 0;line-height:1.7}.gypr-btns p b{color:#c23a55}
.gypr-nav{display:flex;justify-content:center;align-items:center;gap:16px;margin:12px 0 6px}.gypr-nav i{font-style:normal;cursor:pointer;padding:2px 10px;border-radius:8px;background:#f4f4f6}
.gypr-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.gypr-cal i.w{font-style:normal;text-align:center;font-size:11px;color:#aaa}
.gypr-cal .c{position:relative;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#fafafa}
.gypr-cal .c.today{box-shadow:inset 0 0 0 2px #333}.gypr-cal .c.sel{outline:2px solid #e5566f}.gypr-cal .c u{position:absolute;bottom:4px;width:4px;height:4px;border-radius:50%;background:#e5566f}
.gypr-pd{background:#e5566f!important;color:#fff}.gypr-pp{background:repeating-linear-gradient(135deg,#fde6ea 0 5px,#fff 5px 10px)!important;color:#c23a55;box-shadow:inset 0 0 0 1px #f3b2c0}
.gypr-fe{background:#efe6fb!important;color:#7a4fb3}.gypr-ov{background:#9b6ad6!important;color:#fff}
.gypr-lg{display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;color:#888;margin:8px 2px}.gypr-lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.gypr-lg i.pd{background:#e5566f}.gypr-lg i.pp{background:#fde6ea;box-shadow:inset 0 0 0 1px #f3b2c0}.gypr-lg i.fe{background:#efe6fb}.gypr-lg i.ov{background:#9b6ad6}
.gypr-day{border-top:1px solid #f0f0f0;margin-top:8px;padding-top:10px}.gypr-day .dh{display:flex;gap:12px;align-items:center;margin-bottom:6px}.gypr-day .dh span{font-size:12.5px;color:#c23a55;cursor:pointer}
.gypr-day .row{display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin:6px 0}.gypr-day .row em{font-style:normal;font-size:12px;color:#999;width:34px}
.gypr-box .ch{padding:4px 10px;border-radius:999px;background:#f4f4f6;font-size:12.5px;cursor:pointer}.gypr-box .ch.on{background:#e5566f;color:#fff}
.gypr-day textarea{width:100%;box-sizing:border-box;border:1px solid #eee;border-radius:12px;padding:8px;font-family:inherit;margin-top:6px;min-height:52px}
.gypr-set{border-top:1px solid #f0f0f0;margin-top:10px;padding-top:8px;font-size:13px;line-height:2}.gypr-set summary{cursor:pointer;font-weight:600}.gypr-set input[type=number]{width:52px;padding:2px 6px;border-radius:8px;border:1px solid #ddd}
.gypr-set .who{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0}.gypr-set .tip{font-size:12px;color:#999;line-height:1.6}.gypr-set .his{font-size:12.5px;color:#666}
.gypr-ask{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:100001;background:rgba(30,30,32,.9);color:#fff;border-radius:16px;padding:10px 14px;display:flex;gap:12px;align-items:center;font-size:13.5px}
.gypr-ask b{color:#ff9fb2;cursor:pointer}.gypr-ask i{font-style:normal;color:#aaa;cursor:pointer}
.pmc-grid .gypr-pd,.gymc-cell.gypr-pd{background:#e5566f!important;color:#fff!important;border-radius:10px}.pmc-grid .gypr-pp,.gymc-cell.gypr-pp{background:#fde6ea!important;border-radius:10px}
.pmc-grid .gypr-fe,.gymc-cell.gypr-fe{background:#f1e9fc!important;border-radius:10px}.pmc-grid .gypr-ov,.gymc-cell.gypr-ov{background:#b893e6!important;color:#fff!important;border-radius:10px}
.gw-pr{height:100%;display:flex;align-items:center;gap:12px}.gw-pr.s{flex-direction:column;justify-content:center;gap:4px}.gw-pr .rg{position:relative;width:72px;height:72px;flex-shrink:0}
.gw-pr .rg b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:22px;color:#e5566f;font-family:var(--pm-num,inherit)}.gw-pr .rg span{position:absolute;left:0;right:0;bottom:-16px;text-align:center;font-size:10.5px;color:var(--pm-sub)}
.gw-pr em{font-style:normal;font-size:12px;color:var(--pm-sub)}.gw-pr .rt{flex:1;display:flex;flex-direction:column;gap:8px}.gw-pr .rt em{font-size:13px;color:var(--pm-text)}
.gw-pr .strip{display:flex;gap:3px}.gw-pr .strip i{flex:1;font-style:normal;text-align:center;font-size:11px;border-radius:7px;padding:3px 0;background:var(--pm-fill)}.gw-pr .strip i.t{box-shadow:inset 0 0 0 1.5px var(--pm-text)}
.gw-pr .strip i.pd{background:#e5566f;color:#fff}.gw-pr .strip i.pp{background:#fde6ea;color:#c23a55}.gw-pr .strip i.fe{background:#efe6fb}.gw-pr .strip i.ov{background:#9b6ad6;color:#fff}
.gw-pr .bt{align-self:flex-start;font-size:12px;padding:3px 10px;border-radius:10px;background:#fde6ea;color:#c23a55;cursor:pointer}
`;
    function boot() {
        if (!document.getElementById('gyPrCss')) { const st = document.createElement('style'); st.id = 'gyPrCss'; st.textContent = CSS; document.head.appendChild(st); }
        widget();   // 小组件要在桌面第一次画之前就登记好（不然存着的「经期」小组件会被当成不认识的）
        const loop = () => { hookCtx(); hookActions(); hookChat(); widget(); entries(); };
        loop();
        ready.then(() => { loop(); setTimeout(tick, 8000); const rr = () => { if (!window.__guyuBooted) return setTimeout(rr, 800); const paint = () => { try { if (document.querySelector('#gyPmHome .pm-lock') || document.body.classList.contains('gyphm-edit')) return setTimeout(paint, 1500); const X = window.__gyPmW; if (X && X.render && document.body.classList.contains('gyphm') && !document.body.classList.contains('gyphm-app')) X.render(); } catch (e) {} }; setTimeout(paint, 1500); }; rr(); });
        setInterval(loop, 2500);
        setInterval(tick, 5 * 60000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
