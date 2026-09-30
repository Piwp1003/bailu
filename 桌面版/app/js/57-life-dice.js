/* ===========================================================================
   js/57 —— 🎲 生活里的意外：日程里随机碰上点事
   ---------------------------------------------------------------------------
   人的一天不是照着日程表一格一格走完的。走在路上、上着班、待在家里，
   总会冒出点计划外的事——大的小的、好的坏的、跟谁有关的、跟谁都无关的。
   正是这些事让人突然想发条推、想找个人说说、想写两笔，或者什么都不想做。

   这里给自主模式的角色加上这一层：
     · 什么时候碰上是随机的：每个角色每天的"运气"不一样（有的日子平平淡淡，有的日子事一件接一件），
       出门在外比窝在家里更容易碰上事，睡觉时间不碰
     · 碰上什么由模型按此刻的日程、所在的地方、天气、认识的人现写，不从固定清单里抽，
       最近碰上过的会告诉它，别重复
     · 碰上认识的人（关系网上的）会记进「Ta们在做什么」，两个人都知道
     · 碰上的事会：变成 TA 身上发生的事（js/53，可能让 TA 马上想想要不要做点什么）、
       影响情绪（开了情绪惯性的话）、进 TA 的 prompt（聊天/发推时可能自然提起）
   多容易触发：「由 TA 自己决定」的角色不给挡位，按 TA 自己的节奏；默认模式的角色由你在今天面板里给每个人调（默认关）。
   花钱：触发一次一次调用。开关 lifeDice（活人感一组）。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyLifeDiceLoaded) return;
    window.__gyLifeDiceLoaded = true;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' && Array.isArray(myCharacters)) ? myCharacters : [];
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const isOn = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : false;
    const plain = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const isAutoChar = c => { try { return isOn('charAutonomy') && typeof getCharActMode === 'function' && getCharActMode(c) === 'auto'; } catch (e) { return false; } };
    // 以前 CAP = 40，只留最近 40 件事；现在不设上限（注进 prompt 的只取最近几条，不会越来越长）

    (function regDef(tries) {
        try {
            if (typeof AUTO_FEATURE_DEFS !== 'undefined' && Array.isArray(AUTO_FEATURE_DEFS)) {
                if (!AUTO_FEATURE_DEFS.some(d => d.key === 'lifeDice')) AUTO_FEATURE_DEFS.push({
                    key: 'lifeDice', label: '生活里的意外：日程里随机碰上点事',
                    desc: '按 TA 此刻的日程、在哪、天气、认识的人，随机触发一件计划外的事。触发的事会进 TA 的情绪和 prompt；自主模式的角色还可能因此去做点什么。多容易触发：「由 TA 自己决定」的角色按自己的节奏；默认模式的角色在今天面板里给每个人调（默认关）。',
                    cost: '碰上一次一次调用。多久碰上一次是随机的：每个角色每天运气不同，出门在外更容易碰上事，睡觉时不碰',
                    group: '活人感', where: '今天面板 → ⏳ 时间管理大师 → 每个角色的「🎲 随机事件已触发」'
                });
                return;
            }
        } catch (e) {}
        if ((tries || 0) < 20) setTimeout(() => regDef((tries || 0) + 1), 300);
    })(0);

    /* ---------- 多容易碰上事：随机，不是闹钟 ---------- */
    // 多容易触发：
    //   · 「由 TA 自己决定」的角色——不给挡位，TA 自己的节奏（每天运气不同 + 此刻在做什么）
    //   · 默认模式的角色——你给每个人调挡（默认关，不会悄悄花钱）
    const RATES = { off: { k: 0, t: '关' }, low: { k: 0.4, t: '少' }, mid: { k: 1, t: '正常' }, high: { k: 2.2, t: '多' } };
    const rateOf = c => (c && RATES[c.diceRate]) ? c.diceRate : 'off';
    window.gyLifeDiceRate = function (charId, v) {
        const c = charOf(charId); if (!c) return null;
        if (v && RATES[v]) { c.diceRate = v; if (typeof saveAllData === 'function') saveAllData(); }
        return rateOf(c);
    };
    const selfPaced = c => isAutoChar(c);
    const eligible = c => selfPaced(c) || rateOf(c) !== 'off';

    // 同一个角色同一天的"运气"是定的（刷新不会变），不同的日子差很多
    function luck(c) {
        const s = String(c.id) + '|' + new Date().toISOString().slice(0, 10);
        let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        const r = ((h >>> 0) % 10000) / 10000;
        return 0.15 + Math.pow(r, 2) * 2.6;    // 大多数日子平淡，偶尔一天特别多事
    }
    const nowLine = c => { try { return typeof aliveNowLine === 'function' ? aliveNowLine(c) : null; } catch (e) { return null; } };
    const OUT = /出门|路上|外面|街|逛|买|店|超市|商场|车|地铁|公交|打车|机场|车站|公园|学校|上课|教室|公司|上班|办公|开会|医院|餐厅|饭店|咖啡|酒吧|散步|跑步|健身|旅行|约|见面|聚|排练|演出|比赛|拍摄|采访|出差|工地|店里|门口/;
    const HOME = /睡|休息|在家|宅|躺|补觉|洗澡/;
    // 每 5 分钟一次的概率。平均下来：醒着、正常运气、正常频率，大约三小时碰上一件
    function chance(c) {
        const base = 5 / 180;
        const ln = nowLine(c);
        const txt = ((ln && ln.text) || '') + ' ' + ((c.lifeState && c.lifeState.activity) || '');
        let k = luck(c) * (selfPaced(c) ? 1 : RATES[rateOf(c)].k);
        if (!k) return 0;
        if (OUT.test(txt)) k *= 2;
        else if (HOME.test(txt)) k *= 0.4;
        // 刚碰上过一件，短时间里再碰上的机会小一点（但不是不可能）
        const last = (c.happenings || []).slice(-1)[0];
        if (last && Date.now() - last.at < 30 * 60000) k *= 0.3;
        return Math.min(0.5, base * k);
    }
    function asleep(c) {
        try { if (typeof isInQuietHours === 'function' && isInQuietHours()) return true; } catch (e) {}
        const ln = nowLine(c);
        return !!(ln && /睡觉|入睡|睡了|熟睡/.test(ln.text));
    }

    /* ---------- 碰上一件事 ---------- */
    let busy = false;
    async function roll(c, manual) {
        if (!c) return { blocked: 'nochar' };
        if (!manual && (!isOn('lifeDice') || !eligible(c))) return { blocked: 'switch' };
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key || typeof callChatCompletionAPI !== 'function') return { blocked: 'api' };
        if (busy) return { blocked: 'busy' };
        busy = true;
        try {
            const ln = nowLine(c);
            let where = '';
            try { if (typeof window.__gyMapCtxFor === 'function') where = plain(window.__gyMapCtxFor(c.id)).slice(0, 400); } catch (e) {}
            let known = [];
            try { if (typeof window.gyPeerRelsOf === 'function') known = window.gyPeerRelsOf(c.id); } catch (e) {}
            const recent = (c.happenings || []).slice(-6).map(h => '· ' + h.what).join('\n');
            const nowStr = new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const ask = `现在是${nowStr}。
你是${c.name}。${plain(c.persona).slice(0, 500)}
${ln ? `按你今天的日程，你这会儿在：${ln.text}` : (c.lifeState && c.lifeState.activity ? `你这会儿在：${c.lifeState.activity}` : '你今天没排什么日程。')}
${where ? where + '\n' : ''}${known.length ? `你认识的人（只有这几个是你认识的）：${known.map(k => k.name + (k.out ? '（' + k.out + '）' : '')).join('、')}\n` : ''}${recent ? `你最近已经碰上过这些，这次别再是同一类：\n${recent}\n` : ''}
就在这会儿，你碰上了一件计划外的事。
写一件符合你此刻在做的事、在的地方、你这个人的事：可大可小，可好可坏，可以跟人有关也可以跟谁都无关，
不用戏剧化，真实的生活大多是小事，偶尔也会有大事。别写成套路。
只有在说得通的情况下才碰上认识的人（对方也得可能出现在那儿）。

只输出 JSON，不要解释：{"what":"用"你"来写，30字以内，这件事是什么","who":"碰上的认识的人的名字，没有就留空","feel":-3到3之间的整数（这事让你心里怎么样）,"weight":0到1之间的小数（这事对你来说有多大、会不会想为它做点什么）}`;
            const msgs = [{ role: 'user', content: ask }];
            const data = await callChatCompletionAPI(api, msgs, 1);
            const raw = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
            let r = (typeof parseModelJson === 'function') ? parseModelJson(raw) : null;
            if (Array.isArray(r)) r = r[0];
            const what = r ? plain(r.what).slice(0, 60) : '';
            if (!what) return { blocked: 'parse', raw: String(raw).slice(0, 120) };
            const feel = Math.max(-3, Math.min(3, Math.round(parseFloat(r.feel) || 0)));
            let weight = parseFloat(r.weight); if (!isFinite(weight)) weight = 0.4; weight = Math.max(0, Math.min(1, weight));
            const whoName = plain(r.who);
            const other = whoName ? chars().find(x => String(x.id) !== String(c.id) && x.name === whoName && known.some(k => String(k.id) === String(x.id))) : null;
            const h = { at: Date.now(), what, where: (ln && ln.text) || (c.lifeState && c.lifeState.activity) || '', who: other ? other.name : '', feel, weight };
            if (!Array.isArray(c.happenings)) c.happenings = [];
            c.happenings.push(h);
            // 情绪：开了情绪惯性才动
            try {
                if (feel && isOn('aliveMood') && typeof aliveMoodValue === 'function') {
                    const old = aliveMoodValue(c);
                    c.mood = { v: Math.max(-5, Math.min(5, feel * 1.3 * 0.7 + old * 0.3)), why: what.slice(0, 40), at: Date.now() };
                }
            } catch (e) {}
            // 碰上认识的人：两个人都知道（记进「Ta们在做什么」，js/53 会把它变成两个人身上发生的事）
            if (other && typeof addTheaterLog === 'function') {
                addTheaterLog({ id: 'th_d' + Date.now().toString(36), at: Date.now(), dice: true, weight,
                    evA: (h.where ? '（' + h.where + '时）' : '') + what,
                    evB: `碰上了${c.name}：` + what.replace(/你/g, c.name).replace(new RegExp(other.name, 'g'), '你'),
                    charAId: c.id, charBId: other.id, charAName: c.name, charBName: other.name,
                    relation: '偶遇', summary: '🎲 ' + what.replace(/^你/, c.name).slice(0, 30), scene: `${h.where ? '（' + h.where + '）' : ''}${what.replace(/你/g, c.name)}`, statusA: '', statusB: '' });
                try { if (typeof updateTheaterMemoryAsync === 'function') { updateTheaterMemoryAsync(c); updateTheaterMemoryAsync(other); } } catch (e) {}
            } else if (typeof window.gyLifeEvent === 'function') {
                window.gyLifeEvent(c.id, (h.where ? '（' + h.where + '时）' : '') + what, weight);
            }
            if (typeof saveAllData === 'function') saveAllData();
            try { if (typeof window.gyTodayRender === 'function') window.gyTodayRender(); } catch (e) {}
            // 🔔 后台触发的也弹一条，点了跳到今天面板里 TA 那一格（手动点的那次外面会自己弹）
            if (!manual && typeof window.gyNotifyJump === 'function')
                window.gyNotifyJump(c, '🎲 随机事件已触发 · ' + c.name, what.replace(/^你/, ''), { today: String(c.id) });
            return { ok: true, h };
        } catch (e) { console.warn('[生活里的意外] 跳过：', e); return { blocked: 'error' }; }
        finally { busy = false; }
    }
    window.gyLifeRoll = async function (charId, manual) {
        const c = charOf(charId);
        const r = await roll(c, manual !== false);
        if (manual !== false) {
            try {
                if (r && r.h) showToast('', '🎲 随机事件已触发 · ' + c.name, r.h.what.replace(/^你/, ''), null, null, false);
                else if (r && r.blocked === 'api') showToast('', '🎲 生活里的意外', '先去设置里填好 API', null, null, false);
            } catch (e) {}
        }
        return r;
    };
    window.gyLifeHappenings = (charId, sinceMs) => { const c = charOf(charId); const t = Date.now() - (sinceMs || 86400000); return c ? (c.happenings || []).filter(h => h.at > t) : []; };

    async function tick() {
        try {
            if (!isOn('lifeDice')) return;
            if (typeof isGenerating !== 'undefined' && isGenerating) return;
            const cand = chars().filter(c => eligible(c) && !asleep(c) && Math.random() < chance(c));
            if (!cand.length) return;
            await roll(cand[Math.floor(Math.random() * cand.length)], false);   // 一轮最多一件
        } catch (e) {}
    }
    if (!window.__gyLifeDiceTimer) window.__gyLifeDiceTimer = setInterval(tick, 5 * 60000);
    window.__gyLifeDiceTick = tick;
    window.__gyLifeDiceChance = c => chance(c);

    /* ---------- 进 TA 的 prompt：今天碰上的事，聊天/发推时可能自然提起 ---------- */
    window.__gyLifeCtxFor = function (charId) {
        try {
            const hs = window.gyLifeHappenings(charId, 12 * 3600000).slice(-4);
            if (!hs.length) return '';
            const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? m + ' 分钟前' : Math.round(m / 60) + ' 小时前'; };
            return `【你今天碰上的事（不用刻意提，想说就说）】\n${hs.map(h => '· ' + ago(h.at) + (h.where ? '，' + h.where + '时' : '') + '：' + h.what).join('\n')}`;
        } catch (e) { return ''; }
    };

    /* ---------- 今天面板里那一块 ---------- */
    window.gyLifeTodayHtml = function (c) {
        try {
            const hs = window.gyLifeHappenings(c.id);
            const face = f => f >= 2 ? '😆' : f === 1 ? '🙂' : f === 0 ? '😐' : f === -1 ? '😕' : '😣';
            const hm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
            const on = isOn('lifeDice');
            const auto = selfPaced(c);
            const pace = auto
                ? `<span class="gyt-rh-pace" title="「由 TA 自己决定」的角色不用调挡：每天运气不同，出门在外更容易触发">多容易触发：TA 自己的节奏</span>`
                : `<select onclick="event.stopPropagation()" onchange="gyLifeDiceRate('${esc(c.id)}', this.value)" title="默认模式的角色：你来定多容易触发随机事件">${Object.entries(RATES).map(([k, v]) => `<option value="${k}"${rateOf(c) === k ? ' selected' : ''}>随机事件：${v.t}</option>`).join('')}</select>`;
            return `<div class="gyt-rh-gt">🎲 随机事件已触发${on ? '' : '（开关关着，只能手动触发）'}</div>
                <div class="gyt-rh-q">${hs.length ? hs.slice().reverse().map(h => `<div><span>${hm(h.at)}</span><b>${face(h.feel)} ${esc(h.what)}</b>${h.where ? `<em>${esc(h.where)}</em>` : ''}</div>`).join('') : '<div><em>今天还没触发过随机事件。</em></div>'}</div>
                <div class="gyt-rh-dice"><button type="button" onclick="event.stopPropagation(); this.disabled=true; this.textContent='触发中…'; gyLifeRoll('${esc(c.id)}').then(()=>{ try{ gyTodayRender(); }catch(e){} })">🎲 现在触发一个</button>
                ${pace}</div>`;
        } catch (e) { return ''; }
    };
    try {
        const st = document.createElement('style');
        st.textContent = `
.gyt-rh-dice{display:flex;gap:8px;align-items:center;margin:6px 0 2px;flex-wrap:wrap;}
.gyt-rh-dice button{width:auto;margin:0;padding:5px 12px;border-radius:999px;border:1px dashed rgba(139,152,165,.6);background:transparent;color:inherit;font-size:12px;cursor:pointer;}
.gyt-rh-pace{font-size:11.5px;opacity:.55;}
.gyt-rh-dice select{width:auto;margin:0;padding:4px 8px;border-radius:999px;border:1px solid rgba(139,152,165,.4);background:transparent;color:inherit;font-size:12px;}
`;
        document.head.appendChild(st);
    } catch (e) {}
})();
