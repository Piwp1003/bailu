/* ============================================================
   🕰️ 感知真实时间（总开关，v213）
   ------------------------------------------------------------
   开着（默认，跟以前一样）：角色知道现在现实里是几点、几号、星期几，
     知道离上次说话过了多久，聊天记录每条带「3小时前」这种标记，日程按钟点走。
   关上：角色**不感知现实时间**——
     · 聊天记录里不再带「刚刚 / 3小时前 / 中间过去了约 2 天」这些标记，只按先后顺序；
     · 不再告诉 TA「现在的真实时间」「距离上次互动过了多久」（TPES、钉在最后那一行、开场白时间提醒都不发）；
     · 「你今天的日程」那段不再按钟点对照（最近几天的经历、还惦记着的事照常给，只是去掉日期）；
     · 「累 / 困 / 饿」这种按时间推出来的身体状态不发；
     · 写信、看日记时「这封信是 X 天前寄到的」那句不发；
     · 各个功能里「现在是 2026/10/7 星期三 14:03」这类句子，发出去之前统一抹掉（不管是哪个功能拼的）；
     · 换成一段规矩：剧情里的时间只跟着你们的对话和剧情自己往前走，不说「早安 / 这么晚了 / 好久不见」这类靠现实时间才成立的话，
       除非对方先说起。
   只管「发给模型的内容」，界面上的时间、日历、通知照常显示。
   白露：字卡里写了时间条件（晚上 / 22点-2点 / 周末 / 春天……）的，关上以后不抽。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyTimeSense) return;
    window.__gyTimeSense = true;

    // ---------- 开关 ----------
    try {
        if (typeof AUTO_FEATURE_DEFS !== 'undefined' && !AUTO_FEATURE_DEFS.some(f => f.key === 'timeSense'))
            AUTO_FEATURE_DEFS.push({ key: 'timeSense', label: '感知真实时间', group: '活人感',
                desc: '开着：角色知道现实里现在几点、几号、星期几，知道你们隔了多久没说话，聊天记录带「3小时前」这种标记。关上：角色不感知现实时间——这些都不发给 TA，剧情里的时间只跟着你们的对话自己往前走，TA 也不会说「早安」「这么晚了」「好久不见」这种靠现实时间才成立的话（你先说了就顺着你）。',
                where: '所有发给模型的内容（聊天、群聊、主动消息、推文、日记、信……）', cost: '不花钱，关上还略省字数' });
    } catch (e) {}
    const on = () => { try { return typeof isAutoOn === 'function' ? isAutoOn('timeSense') : true; } catch (e) { return true; } };
    window.gyTimeSenseOn = on;
    window.gyTimeSenseSet = function (v) {
        try { if (typeof autoFeatureSwitches !== 'undefined') autoFeatureSwitches.timeSense = !!v; } catch (e) {}
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        document.querySelectorAll('.gyts-sw').forEach(x => { x.checked = !!v; });
        try { if (typeof renderAutoFeatureList === 'function' && document.getElementById('autoFeatureList')) renderAutoFeatureList(); } catch (e) {}
        const say = v ? ['🕰️ 角色感知真实时间', '知道现在几点、隔了多久'] : ['🌫️ 角色不再感知现实时间', '时间只跟着你们的剧情走'];
        try { showToast('', say[0], say[1], null, null, false); } catch (e) {}
    };

    // ---------- 关上时：发出去的内容里抹掉的东西 ----------
    const TAG_RE = /^\[(?:刚刚|\d+分钟前|\d+小时前|昨天|\d+天前|\d{4}\/\d{1,2}\/\d{1,2})\] ?/gm;
    const GAP_RE = /^——（中间过去了约[^）\n]*）——\n?/gm;
    const stripHist = s => typeof s === 'string' ? s.replace(GAP_RE, '').replace(TAG_RE, '') : s;
    const DT = '\\d{4}\\s*[\\/\\-年.]\\s*\\d{1,2}\\s*[\\/\\-月.]\\s*\\d{1,2}\\s*[日号]?';
    const SCRUB = [
        /【(?:当前|现在的|🕰️ 现在的)真实时间】[^\n]*\n?/g,
        new RegExp('(?:现在|此刻|当前)(?:的真实时间|的时间|时间)?(?:是|为|：|:)\\s*' + DT + '[^。\\n]*[。]?', 'g'),
        new RegExp('(?:现在|此刻)(?:是|：|:)\\s*(?:星期|周)[一二三四五六日天][^。\\n]*[。]?', 'g'),
        /【这封信是大约[^】]*】[^\n]*/g,
        /【这篇日记是大约[^】]*】[^\n]*/g
    ];
    function scrub(s) {
        if (typeof s !== 'string' || !s) return s;
        let t = s;
        SCRUB.forEach(re => { re.lastIndex = 0; t = t.replace(re, ''); });
        return stripHist(t);
    }
    function scrubContent(c) {
        if (typeof c === 'string') return scrub(c);
        if (Array.isArray(c)) return c.map(m => {
            if (!m || typeof m !== 'object') return m;
            if (typeof m.content === 'string') return Object.assign({}, m, { content: scrub(m.content) });
            if (Array.isArray(m.content)) return Object.assign({}, m, { content: m.content.map(p => p && p.type === 'text' && typeof p.text === 'string' ? Object.assign({}, p, { text: scrub(p.text) }) : p) });
            return m;
        });
        return c;
    }
    window.gyTimeScrub = scrubContent;

    const RULE = `【不按现实时间走】这一局不跟现实里的钟表挂钩：
- 你不知道、也不去猜现实里现在是几点、几号、星期几、白天还是夜里，也不去算离上次说话隔了多久。
- 不主动说「早安 / 晚安 / 这么晚了还不睡 / 好久不见 / 今天周末」这类要靠现实时间才成立的话；对方先说了，就顺着对方给的时间接。
- 剧情里的时间只跟着你们的对话和剧情往前走：剧情里写到天黑了就是天黑了，没写到就别自己定一个钟点。
- 聊天记录按先后顺序看就行，里面不带时间。
`;
    window.__gyTimeOffDef = RULE;
    const PLR = () => typeof gyPL === 'function' ? gyPL('time.off', RULE) : RULE;
    window.gyTimeSenseRule = () => on() ? '' : PLR();

    // ---------- 套到各个函数上 ----------
    const injOk = k => { try { return typeof injOn === 'function' ? injOn(k) : true; } catch (e) { return true; } };
    function wrap(name, make) {
        const f = window[name]; if (typeof f !== 'function' || f.__gyTimeSense) return;
        const w = make(f);
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} });
        w.__gyTimeSense = true; window[name] = w;
        try { (0, eval)(name + ' = window.' + name); } catch (e) {}
    }
    function hookAll() {
        wrap('buildTimeAwareHistoryText', f => function () { const r = f.apply(this, arguments); return on() ? r : stripHist(r); });
        wrap('buildTimeAwareHistoryTurns', f => function () {
            const r = f.apply(this, arguments);
            if (on() || !Array.isArray(r)) return r;
            return r.map(t => t && typeof t.content === 'string' ? Object.assign({}, t, { content: stripHist(t.content) }) : t);
        });
        // TPES：关上时换成「不按现实时间走」那段规矩（注入内容管理里关了「时间感知」就连这段也不发）
        wrap('getTpesPromptText', f => function () { if (on()) return f.apply(this, arguments); return injOk('core.tpes') ? PLR() : ''; });
        wrap('getTpesNowLine', f => function () { return on() ? f.apply(this, arguments) : ''; });
        wrap('gyNowAnchorNote', f => function () { return on() ? f.apply(this, arguments) : ''; });
        wrap('aliveBodyPrompt', f => function () { return on() ? f.apply(this, arguments) : ''; });
        // 聊天里那段「时间感知与状态延续」：只留状态延续和 stateUpdate 那条要求
        wrap('getTimeAwarenessPrompt', f => function (sid, char) {
            const r = f.apply(this, arguments);
            if (on() || !r) return r;
            let s = '';
            if (char && char.lifeState && char.lifeState.activity)
                s += `\n- 你上一次被记录到的生活状态是："${char.lifeState.activity}"。你不是停在原地等对方，而是从那个状态自然地接着往下过；回复里透出的状态和它连得上就行，不用交代中间过了多久。`;
            const m = String(r).match(/\n- 额外任务[^\n]*/);
            if (m) s += m[0];
            return s ? `\n【状态延续 — 仅供你内部判断，不要复述本段】：${s}\n` : '';
        });
        // 日程：去掉「今天的日程」（按钟点对照的那段），待办去掉日期
        wrap('getScheduleContextPrompt', f => function () {
            const r = f.apply(this, arguments);
            if (on() || !r) return r;
            return String(r)
                .replace(/\n【你今天的日程安排[\s\S]*?(?=\n【|$)/, '')
                .replace(/^(- .*?)（(?:\d{4}-\d{2}-\d{2}(?:（[^）]*）)?|就是今天|没定[^）]*)）$/gm, '$1');
        });
        // 最后一道：所有发出去的请求过一遍（各功能自己拼的「现在是 2026/10/7 星期三 14:03」）
        const rw = window.gyTaRewrite;
        if (!rw || !rw.__gyTimeSense) {
            const base = typeof rw === 'function' ? rw : (c => c);
            const w = function (content) { const c = base.apply(this, arguments); return on() ? c : scrubContent(c); };
            if (typeof rw === 'function') Object.keys(rw).forEach(k => { try { w[k] = rw[k]; } catch (e) {} });
            w.__gyTimeSense = true; window.gyTaRewrite = w;
        }
    }

    // ---------- 设置里：TPES 那一行上面放一个总开关 ----------
    function mountRow() {
        const tp = document.getElementById('tpesEnabled'); if (!tp || document.getElementById('gyTimeSenseRow')) return;
        const row = tp.closest('.input-group'); if (!row) return;
        const d = document.createElement('div'); d.id = 'gyTimeSenseRow'; d.className = 'input-group checkbox-group'; d.style.cssText = 'margin-top:10px;margin-bottom:0;';
        d.innerHTML = `<input type="checkbox" class="gyts-sw" ${on() ? 'checked' : ''} onchange="gyTimeSenseSet(this.checked)"><label style="margin:0;font-size:14px;color:#536471;">🕰️ <b>感知真实时间</b>（总开关。关上＝角色不知道现实里几点几号、隔了多久，时间只跟着剧情走；下面的 TPES 也跟着不发）</label>`;
        row.parentNode.insertBefore(d, row);
    }

    hookAll(); mountRow();
    setInterval(() => { hookAll(); mountRow(); }, 3000);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { hookAll(); mountRow(); });
})();
