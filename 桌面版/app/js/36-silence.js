/* ===========================================================================
   js/36 —— 🕯️ 你很久没回消息的时候
   ---------------------------------------------------------------------------
   现在的角色是"你不说话，TA 就不存在"。你上一句停在半路，隔了两天回来，
   TA 还在原地等着，跟没事人一样接上——这是这个 app 里最出戏的一处。

   真人不是这样的。真人会**自己想**：是不是在忙、是不是我说错了话、
   是不是不想理我了、还是干脆把我忘了。然后**根据自己想出来的那个答案**
   有不同的反应——有人再发一条，有人干脆不发了，有人开始阴阳，有人担心你。

   所以这一块做的是：
     ① 攒够了"你多久没回"这个时长
     ② 让 TA **先想一想为什么**（在心里过一遍，不是直接对你说话）
     ③ 按想出来的那个原因，决定**做什么**：再问一句 / 说点别的 / 什么都不做 /
        发一条明显在赌气的 / 或者在自己那边默默记一笔
     ④ 想出来的那个原因**存进记忆**，之后你回来了，TA 是带着这个念头跟你说话的

   ⏱️ 多久算"很久"，两种模式：
     · **你自己定**：填一个小时数，到点就触发
     · **让 TA 自己感受**：不给固定时长——按你们的关系、聊天的密度、
       上一句停在什么地方，TA 自己判断"这算久吗"。
       黏的人几小时就觉得久，本来就疏远的人一周都不算什么。

   💰 一次触发 = 一次调用（想原因和决定做什么合并成同一次）。
      默认关着，打开之后每个角色最多每 6 小时被触发一次。
   =========================================================================== */
(function () {
    if (window.__gySilenceLoaded) return;
    window.__gySilenceLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gySilenceBox', 'silence')          // 带兜底的存档口
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gySilenceBox', storeName: 'silence' })
            : null);
    const KEY = 'gySilence_state';

    const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(s == null ? '' : s)
        : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const on = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : false;
    const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const rnd = a => a[Math.floor(Math.random() * a.length)];
    const hrs = ms => Math.round(ms / 3600000);

    let S = {
        mode: 'feel',       // fixed 你自己定时长 / feel 让 TA 自己感受
        hours: 12,          // fixed 模式下：多少小时算久
        cool: 6,            // 同一个人最少隔几小时才会再触发一次
        log: {},            // { 角色id: [{id, at, gapH, why, mood, act, line}] }
        last: {}            // { 角色id: 上次触发时间 }
    };
    async function save() { try { if (LF) await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) {} }
    async function load() {
        try { if (LF) { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } } catch (e) {}
        ['log', 'last'].forEach(k => { if (!S[k] || typeof S[k] !== 'object') S[k] = {}; });
    }
    const logOf = id => { const k = String(id); if (!Array.isArray(S.log[k])) S.log[k] = []; return S.log[k]; };

    /* ---------- 你最后一次说话是什么时候 ---------- */
    function lastMineAt(charId) {
        try {
            const arr = (typeof globalChats !== 'undefined' && globalChats[String(charId)]) || [];
            for (let i = arr.length - 1; i >= 0; i--) {
                const m = arr[i];
                if (m && m.sender === 'me') return m.timestamp || 0;
            }
            // 一次都没说过话：从这段聊天的第一条算起，没有就不算
            return arr.length ? (arr[0].timestamp || 0) : 0;
        } catch (e) { return 0; }
    }
    // 最后那一句是谁说的、说了什么——"你停在半路"和"TA 最后发了一句没人接"完全是两回事
    function tail(charId) {
        try {
            const arr = ((typeof globalChats !== 'undefined' && globalChats[String(charId)]) || [])
                .filter(m => m && m.text && m.sender !== 'system');
            const last = arr[arr.length - 1];
            if (!last) return null;
            return { mine: last.sender === 'me', text: String(last.text).replace(/<[^>]+>/g, '').slice(0, 60),
                     at: last.timestamp || 0, n: arr.length };
        } catch (e) { return null; }
    }
    // 最近这段时间聊得密不密——判断"这算不算久"要看平时的节奏
    function pace(charId) {
        try {
            const arr = ((typeof globalChats !== 'undefined' && globalChats[String(charId)]) || [])
                .filter(m => m && m.timestamp).slice(-30);
            if (arr.length < 4) return 0;
            const span = arr[arr.length - 1].timestamp - arr[0].timestamp;
            return span > 0 ? Math.round(span / (arr.length - 1) / 60000) : 0;   // 平均隔几分钟一条
        } catch (e) { return 0; }
    }

    /* ---------- 该不该触发 ---------- */
    /* 🧾 这个功能会读什么，登记到「注入内容管理 → ② 生成时读什么」那一页，
       让你自己勾。关掉之后不是不触发，而是判断时手里少了这一样。 */
    const slSrc = k => { try { return !window.gyInjectSrc || window.gyInjectSrc.on('silence', k); } catch (e) { return true; } };
    (function regSrc(tries) {
        try {
            if (window.gyInjectSrc && typeof window.gyInjectSrc.def === 'function') {
                window.gyInjectSrc.def({
                    feat: 'silence', icon: '🕯️', title: '你很久没回消息时，TA 怎么想',
                    note: '"多久算久"和"想成什么样"都是照下面这些算出来的。'
                        + '全关掉就退回一刀切：不管跟谁、聊得多密，都按你填的那个小时数。',
                    items: [
                        { k: 'pace', label: '你们平时的聊天节奏', desc: '五分钟一来一回的人停 6 小时就很反常，三天说一句的停两天不算什么。只在「让 TA 自己感受」模式下起作用。' },
                        { k: 'aff',  label: '好感度', desc: '关系越近，越容易觉得"你怎么不理我"。' },
                        { k: 'who',  label: '最后一句是谁说的', desc: 'TA 说完你没接，比你说完 TA 没接更扎人。' },
                        { k: 'tail', label: '最后那句话的原文', desc: '关掉之后 TA 只知道"隔了多久"，不知道停在哪句上。' }
                    ]
                });
                return;
            }
        } catch (e) {}
        if ((tries || 0) < 12) setTimeout(() => regSrc((tries || 0) + 1), 500);
    })(0);

    function due(c) {
        const t = tail(c.id);
        if (!t) return null;                                  // 一句都没聊过就别演了
        const last = lastMineAt(c.id);
        if (!last) return null;
        const gap = Date.now() - last;
        if (gap < 30 * 60000) return null;                    // 半小时以内不算
        if (Date.now() - (S.last[String(c.id)] || 0) < gyNum(S.cool, 6) * 3600000) return null;
        if (S.mode === 'fixed') {
            return gap >= gyNum(S.hours, 12) * 3600000 ? { gap, t } : null;
        }
        /* feel 模式：不给固定时长，用**平时的节奏**折出一个门槛。
           平时五分钟一来一回的人，停 6 小时就很反常；
           本来就三天说一句的，停两天根本不算什么。
           关系越近，门槛越低（越容易觉得"你怎么不理我"）。 */
        const p = slSrc('pace') ? pace(c.id) : 0;              // 平均间隔（分钟）
        let need = p > 0 ? Math.min(72, Math.max(3, p * 24 / 60)) : 10;   // 小时
        try {
            if (slSrc('aff') && window.gyRel && typeof window.gyRel.score === 'function') {
                const sc = Number(window.gyRel.score(c.id)) || 0;
                need = need * (sc >= 50 ? 0.55 : sc >= 20 ? 0.8 : 1.25);
            }
        } catch (e) {}
        if (slSrc('who') && !t.mine) need *= 0.7;              // 最后一句是 TA 发的、你没接 —— 更扎人
        return gap >= need * 3600000 ? { gap, t, need: Math.round(need) } : null;
    }

    /* ---------- 让 TA 先想一想，再决定做什么 ---------- */
    const ACTS = {
        ask:   '再问一句',
        other: '说点别的',
        cold:  '不说话，自己记着',
        sulk:  '发一条带情绪的',
        care:  '担心你出事'
    };
    async function react(c, info) {
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('silence', () => reactInner(c, info));
        return reactInner(c, info);
    }
    async function reactInner(c, info) {
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) return false;
        const uname = (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
        const g = hrs(info.gap);
        const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name);
        const ask = `${uname}已经 ${g >= 24 ? Math.round(g / 24) + ' 天' : g + ' 小时'}没回你消息了。
你们最后一句话是${info.t.mine ? uname + '说的' : '你说的'}${slSrc('tail') ? `：「${info.t.text}」` : ''}${info.t.mine ? '，你还没回。' : '，一直没人接。'}

先在心里想一想**为什么**——在忙？出事了？我上一句说得不好？还是不想理我了？
这个判断要贴着你的人设和你们的关系来：多疑的人会往坏处想，心大的人根本不当回事，
在意的人会不安，本来就疏远的人可能压根没觉得有什么。

想完再决定做什么：
  ask   再问一句（还是想找 TA）
  other 说点别的（不提这茬，换个话头）
  cold  什么都不说，自己记着（可能是赌气，也可能是识趣）
  sulk  发一条带情绪的（阴阳、赌气、直说不高兴）
  care  担心 TA 出事了
不是每次都要发消息——**cold 是很正常的选择**，别为了有反应而硬发。

只输出 JSON，不要 markdown：
{"why":"你心里认定的原因，25字以内","mood":"你现在的情绪，6字以内","act":"上面五个之一","line":"要发的那句话，35字以内；act 是 cold 就留空"}`;
        const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
        let r = null;
        try {
            const d = await callChatCompletionAPI(api, msgs);
            r = (typeof parseModelJson === 'function') ? parseModelJson(d.choices?.[0]?.message?.content || '') : null;
            if (Array.isArray(r)) r = r[0];
        } catch (e) { console.warn('[冷落] 想不出来', e); return false; }
        if (!r) return false;

        const act = ACTS[r.act] ? r.act : 'ask';
        const why = String(r.why || '').slice(0, 40);
        const mood = String(r.mood || '').slice(0, 12);
        const line = String(r.line || '').replace(/^["「]|["」]$/g, '').trim().slice(0, 70);

        logOf(c.id).unshift({ id: uid(), at: Date.now(), gapH: g, why, mood, act, line });
        // 记录不设条数上限（以前只留 20 条）
        S.last[String(c.id)] = Date.now();
        await save();

        // 情绪落到活人感那套里（如果开着），这样后面几轮的语气都会带着
        try {
            const took = mood && typeof window.gyAliveSetMood === 'function' && window.gyAliveSetMood(c.id, mood, why);
            if (!took && mood) { c.__mood = mood; c.__moodWhy = why; }
        } catch (e) {}

        if (act !== 'cold' && line && typeof deliverCharMoveToChatMessage === 'function') {
            deliverCharMoveToChatMessage(c, line, null);
        } else if (act === 'cold') {
            // 不发消息，但要让你能看到"TA 心里过了一遍"——通知里留一条，聊天记录里不留
            try {
                if (typeof addNotification === 'function') {
                    addNotification(`<b>${c.name}</b> 想了想你为什么没回`, null, c.id, c, why + (mood ? '　·　' + mood : ''));
                }
            } catch (e) {}
        }
        return true;
    }

    /* ---------- 注进 prompt：你回来的时候，TA 是带着这个念头的 ---------- */
    window.__gySilenceCtxFor = function (charId) {
        try {
            if (!on('silenceOn')) return '';
            const arr = logOf(charId);
            if (!arr.length) return '';
            const x = arr[0];
            // 只有在"这个念头还新鲜"的时候才带上——三天前的赌气早就过去了
            if (Date.now() - x.at > 3 * 86400000) return '';
            const back = lastMineAt(charId) > x.at;   // 你已经回来了
            return `\n【你等了很久那件事】：${x.gapH >= 24 ? Math.round(x.gapH / 24) + ' 天' : x.gapH + ' 小时'}没等到回话的时候，` +
                `你心里认定的是「${x.why}」，当时的情绪是「${x.mood}」，你选择了${ACTS[x.act] || '再问一句'}。\n` +
                (back
                    ? `现在对方回来了。你不用假装什么都没发生，也不用非要兴师问罪——` +
                      `按你的性格处理：可以直接问、可以别扭一下、可以装作无所谓、也可以真的已经不在意了。\n`
                    : `你还在等。这个念头会影响你现在说话的语气。\n`);
        } catch (e) { return ''; }
    };

    /* ---------- 心跳 ---------- */
    let beat = null;
    function startBeat() {
        if (beat) return;
        beat = setInterval(async () => {
            if (!on('silenceOn')) return;
            const cs = chars();
            if (!cs.length) return;
            // 一轮最多处理一个人，免得一次醒来所有人一起冒出来
            const shuffled = cs.slice().sort(() => Math.random() - 0.5);
            for (const c of shuffled) {
                const info = due(c);
                if (!info) continue;
                try { await react(c, info); } catch (e) {}
                break;
            }
        }, 15 * 60 * 1000);
    }
    // 手动触发一次（不看冷却，也不看开关——你点了就是要看效果）
    window.gySilenceNow = async function (charId) {
        const c = charOf(charId); if (!c) return;
        const t = tail(c.id);
        if (!t) return toast('还没聊过，没什么可等的');
        const gap = Date.now() - (lastMineAt(c.id) || Date.now());
        toast(c.name + ' 正在想…');
        const ok = await react(c, { gap: Math.max(gap, 3600000), t });
        if (!ok) toast('这次没想出来（多半是 API 没配好）');
    };
    const toast = m => { try { if (typeof showToast === 'function') showToast('', '🕯️', m, null, null, false); } catch (e) {} };

    window.gySilenceLog = id => logOf(id).slice();
    // 🗑️ 记忆总览里删一条（删了就不再进 prompt）
    window.gySilenceDel = async function (charId, entryId) {
        const arr = logOf(charId);
        const i = arr.findIndex(x => x.id === entryId);
        if (i < 0) return;
        arr.splice(i, 1);
        await save();
        try { renderMemHub(); } catch (e) {}
    };
    window.gySilenceCfg = () => JSON.parse(JSON.stringify({ mode: S.mode, hours: S.hours, cool: S.cool }));
    window.gySilenceSet = async function (k, v) {
        S[k] = (k === 'mode') ? String(v) : parseInt(v);
        await save();
        try { renderMemHub(); } catch (e) {}
    };

    /* ---------- 记忆总览里的那一块 ---------- */
    function memHubHtml(charId) {
        const arr = logOf(charId);
        const cfg = S;
        return `
          <label style="font-size:15px;">🕯️ 你很久没回的时候</label>
          <div style="font-size:12px; color:#536471; margin-bottom:8px;">
            TA 自己想过的那些原因。这些会进 prompt——你回来的时候，TA 是带着这个念头跟你说话的。
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:white;padding:10px 12px;border-radius:8px;border:1px solid #eff3f4;margin-bottom:8px;">
            <select onchange="gySilenceSet('mode',this.value)" style="padding:6px 8px;border:1px solid var(--gy-accent-line);border-radius:6px;background:transparent;color:inherit;">
              <option value="feel"${cfg.mode === 'feel' ? ' selected' : ''}>让 TA 自己感受多久算久</option>
              <option value="fixed"${cfg.mode === 'fixed' ? ' selected' : ''}>我自己定一个时长</option>
            </select>
            ${cfg.mode === 'fixed' ? `<span style="font-size:12.5px;">超过
              <input type="number" value="${cfg.hours}" min="1" style="width:60px;padding:5px;border:1px solid var(--gy-accent-line);border-radius:6px;background:transparent;color:inherit;"
                onchange="gySilenceSet('hours',this.value)"> 小时</span>` : ''}
            <button type="button" class="btn-edit-small" style="margin-left:auto;" onclick="gySilenceNow('${charId}')">让 TA 现在想一次</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;">
          ${arr.length ? arr.map(x => `
            <div style="background:white;padding:8px 10px;border-radius:6px;border:1px solid #eff3f4;">
              <div style="font-size:13px;"><span style="color:#f91880;cursor:pointer;float:right;font-size:12px;" onclick="gySilenceDel('${charId}','${x.id}')">删除</span><b>${esc(x.why)}</b>
                <span style="font-size:11px;color:#8b98a5;">　${esc(x.mood)}　·　等了 ${x.gapH >= 24 ? Math.round(x.gapH / 24) + ' 天' : x.gapH + ' 小时'}　·　${esc(ACTS[x.act] || '')}</span></div>
              ${x.line ? `<div style="font-size:13px;color:#536471;line-height:1.7;margin-top:2px;">「${esc(x.line)}」</div>` : '<div style="font-size:12px;color:#8b98a5;margin-top:2px;">（什么都没说）</div>'}
            </div>`).join('') : '<div style="color:#8b98a5;font-size:13px;">还没有过</div>'}
          </div>`;
    }
    function renderMemHub() {
        const host = document.getElementById('memoryHubContent');
        if (!host) return;
        const id = (typeof currentMemoryHubTargetId !== 'undefined') ? currentMemoryHubTargetId : null;
        let box = document.getElementById('gyslMemHubBox');
        if (String(id || '').startsWith('g_') || !id || !on('silenceOn')) { if (box) box.remove(); return; }
        if (!box) {
            box = document.createElement('div');
            box.id = 'gyslMemHubBox'; box.className = 'input-group';
            box.style.cssText = 'margin-top:20px; border-top:1px dashed var(--gy-accent); padding-top:15px;';
            host.appendChild(box);
        }
        box.innerHTML = memHubHtml(id);
    }
    function hookMemHub() {
        try {
            ['selectMemoryHubTarget', 'renderMemoryHubContent'].forEach(fn => {
                const orig = window[fn];
                if (typeof orig !== 'function' || orig.__gyslPatched) return;
                window[fn] = function () { const r = orig.apply(this, arguments); try { setTimeout(renderMemHub, 0); } catch (e) {} return r; };
                window[fn].__gyslPatched = true;
            });
        } catch (e) {}
    }

    /* ---------- 开关 ---------- */
    function addSwitches() {
        try {
            if (typeof AUTO_FEATURE_DEFS === 'undefined' || !Array.isArray(AUTO_FEATURE_DEFS)) return;
            const defs = [
                { key: 'silenceOn', label: '你很久没回消息时，TA 会自己想为什么',
                  desc: '不是简单地再催一句。TA 会**先在心里判断原因**（在忙？我说错话了？不想理我了？——按人设和你们的关系来），再决定做什么：再问一句 / 说点别的 / **什么都不说自己记着** / 发一条带情绪的 / 担心你出事。想出来的那个原因会进记忆，你回来时 TA 是带着它跟你说话的。多久算久有两种模式：你自己定时长，或者让 TA 按你们平时的聊天节奏自己感受。',
                  cost: '一次触发一次调用（想原因和决定做什么合并成一次）；同一个人最少隔 6 小时',
                  defaultOff: true, group: '活人感', where: '记忆总览 → 🕯️ 你很久没回的时候' }
            ];
            defs.forEach(d => { if (!AUTO_FEATURE_DEFS.some(x => x.key === d.key)) AUTO_FEATURE_DEFS.push(d); });
        } catch (e) {}
    }

    (async function init() {
        addSwitches();
        await load();
        hookMemHub();
        startBeat();
    })();
})();
