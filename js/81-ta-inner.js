/* ============================================================
   💭 TA 的心声 · 身体感受 · 情绪词（v210）
   ------------------------------------------------------------
   以前 TA 的「状态」散在好几处：
     · 情绪惯性（aliveMood）每轮给一个 -5~5 的数和一句原因；
     · 关系账本（js/24）把好感一笔笔记成带原因的流水；
     · 身体状态（aliveBody）是本地按日程推算的累/困/饿；
     · 角色卡自带的状态栏里有「心声 / 身体」，但只在那条气泡里显示，过一条就没了。
   缺的是：TA 这一轮**心里真实在想、没说出口**的话，和身上具体哪儿不舒服。

   这里做的事：
   1. 新开关「TA 的心声和身体感受」（活人感组，默认关）。打开后每轮聊天 JSON 里多要三个字段
      inner / feel / moodWords——不额外调用。
   2. 角色卡自带状态栏里写了「心声 / 身体 / 心情」的，也收下来（零成本，开关关着也收）。
   3. 存在角色身上：char.inner（最新一份）+ char.innerLog（最近 40 份，跟着主存档备份）。
   4. 看的地方：聊天里**单击 TA 的头像**弹出的小气泡下面多一张心声便签 + 关系账本最近一笔；
      点「TA 的状态」打开整页（好感流水、情绪、身体、心声历史）；「🌐 此刻」页每个角色多两行；
      记忆总览里能改能删；今天面板、小手机小组件也有。
   5. 下一轮把上一轮的心声悄悄注回去，心事不会一轮就散；但仍然要求 TA 别直接说出来。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyInnerLoaded) return;
    window.__gyInnerLoaded = true;

    const KEY = 'aliveInner';
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []).filter(c => c && !c.members);
    const charById = id => chars().find(c => String(c.id) === String(id));
    const on = () => { try { return typeof isAutoOn === 'function' && isAutoOn(KEY); } catch (e) { return false; } };
    const isBailu = () => window.GY_APP_NAME === '白露';
    const ago = at => { const m = (Date.now() - at) / 60000; return m < 1 ? '刚刚' : m < 60 ? Math.round(m) + ' 分钟前' : m < 1440 ? Math.round(m / 60) + ' 小时前' : Math.round(m / 1440) + ' 天前'; };
    const save = () => { try { saveAllData(); } catch (e) {} };

    // ---------- 1) 开关：放进「活人感」那一组，紧跟「身上的状态会累积」 ----------
    try {
        if (typeof AUTO_FEATURE_DEFS !== 'undefined' && !AUTO_FEATURE_DEFS.some(f => f.key === KEY)) {
            const i = AUTO_FEATURE_DEFS.findIndex(f => f.key === 'aliveBody');
            AUTO_FEATURE_DEFS.splice(i >= 0 ? i + 1 : AUTO_FEATURE_DEFS.length, 0, {
                key: KEY, label: 'TA 的心声和身体感受', group: '活人感', defaultOff: true,
                desc: 'TA 每轮回复时顺带写下这一轮**心里真实在想、但没说出口**的话（可以跟嘴上说的不一样），身上哪儿有什么感觉，和 1~3 个情绪词。聊天里单击 TA 的头像就能看到心声便签；整页在头像气泡里点「TA 的状态」。下一轮会把这份心事悄悄带回去，TA 不会一轮就忘，但也不会直接说破。角色卡自带的状态栏里写了心声/身体的，开关关着也会收下来。',
                cost: '不额外调用，只在回复的 JSON 里多三个字段（大约多 60~150 字输出）',
                where: '聊天里单击 TA 的头像 → 心声便签 /「TA 的状态」整页；🌐 此刻；记忆总览'
            });
        }
    } catch (e) {}

    // ---------- 2) 存 ----------
    function put(char, o, src) {
        if (!char || !o) return null;
        const t = String(o.t || '').trim().slice(0, 400);
        const feel = (o.feel || []).filter(x => x && (x.p || x.s)).slice(0, 4).map(x => ({ p: String(x.p || '').slice(0, 12), s: String(x.s || '').slice(0, 80) }));
        const words = (o.words || []).map(w => String(w).trim()).filter(Boolean).slice(0, 4).map(w => w.slice(0, 8));
        if (!t && !feel.length && !words.length) return null;
        const it = { id: 'in' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: Date.now(), t, feel, words, src: src || 'chat' };
        try { const m = char.mood; if (m && m.at && Date.now() - m.at < 60000) { it.mv = Math.round(m.v * 10) / 10; it.why = m.why || ''; } } catch (e) {}
        char.inner = it;
        char.innerLog = Array.isArray(char.innerLog) ? char.innerLog : [];
        char.innerLog.unshift(it);
        if (char.innerLog.length > 40) char.innerLog.length = 40;
        try { paintToday(); } catch (e) {}
        return it;
    }
    function feelOf(v) {
        if (!v) return [];
        if (Array.isArray(v)) return v.map(x => typeof x === 'string' ? (m => m ? { p: m[1], s: m[2] } : { p: '', s: x })(x.match(/^([^：:]{1,8})[：:]\s*(.+)$/)) : { p: x.p || x.part || '', s: x.s || x.feel || x.text || '' });
        if (typeof v === 'object') return Object.keys(v).map(k => ({ p: k, s: String(v[k]) }));
        return String(v).split(/[；;\n]/).map(x => x.trim()).filter(Boolean).map(x => (m => m ? { p: m[1], s: m[2] } : { p: '', s: x })(x.match(/^([^：:]{1,8})[：:]\s*(.+)$/)));
    }
    const wordsOf = v => Array.isArray(v) ? v : String(v || '').split(/[、,，/｜|\s]+/);
    window.gyInnerCapture = function (char, parsed) {
        try {
            if (!char || !parsed || typeof parsed !== 'object') return;
            const t = parsed.inner || parsed.innerThought || parsed.hidden_thought || '';
            const feel = feelOf(parsed.feel || parsed.body || parsed.organs);
            const words = wordsOf(parsed.moodWords || parsed.moods || '');
            if (!t && !feel.length && !words.filter(Boolean).length) return;
            put(char, { t, feel, words }, 'chat');
        } catch (e) {}
    };
    // 每条回复都会走 aliveCaptureMood（正常回复 / 重新生成 / 主动消息三条路都调它），套在它外面
    function hookCapture() {
        const f = window.aliveCaptureMood; if (typeof f !== 'function' || f.__gyInner) return;
        const w = function (char, parsed) { const r = f.apply(this, arguments); window.gyInnerCapture(char, parsed); return r; };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyInner = true; window.aliveCaptureMood = w; try { aliveCaptureMood = w; } catch (e) {}
    }
    // 角色卡自带的状态栏：里面写了「心声 / 身体 / 心情」就收下（不管开关，零成本）
    function hookStatusLog() {
        const f = window.gyStatusLogAdd; if (typeof f !== 'function' || f.__gyInner) return;
        const w = function (char, entry) {
            const r = f.apply(this, arguments);
            try {
                if (entry && entry.seg && typeof gyExtractChatStatus === 'function') {
                    const rows = (gyExtractChatStatus(entry.seg, char && char.id).rows || []);
                    const get = re => rows.filter(x => re.test(x.k || '')).map(x => String(x.v || '').trim()).filter(Boolean);
                    const t = get(/心声|内心|心里|想法|OS/i).join(' ');
                    const body = get(/身体|身上|体感|器官/);
                    const mood = get(/^(心情|情绪)$/);
                    if (t || body.length) { put(char, { t, feel: feelOf(body.join('；')), words: wordsOf(mood.join('、')) }, 'card'); save(); }
                }
            } catch (e) {}
            return r;
        };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyInner = true; window.gyStatusLogAdd = w; try { gyStatusLogAdd = w; } catch (e) {}
    }

    // ---------- 3) 每轮向模型多要三个字段（跟情绪惯性那两个字段写在一起） ----------
    function innerNote() {
        if (!on() || isBailu()) return '';
        return `\n【额外字段·心声】：在上面那个聊天 JSON 里再多三个字段（只在这个带 replies 的聊天 JSON 里给，写推文、日记、信件时都不要加）：
"inner"：这一轮你**心里真实在想、但没说出口**的话，第一人称，60~150 字。可以跟你嘴上说的不一样——嘴硬心软、偷偷高兴、在害怕、在算计、在委屈都行，要具体，别写成总结。只写你自己知道的事；她没说出口的心思你不知道，别替她编。这段话绝对不要说进 replies 里。
"feel"：此刻身上 1~3 处具体感受，写成 {"部位":"一句感受，可以带点拟人的吐槽"}，例如 {"胃":"空了一下午，在抗议","眼皮":"打架打了半小时"}。没什么特别的感觉就给 {}，不要硬编病痛。
"moodWords"：1~3 个词说此刻的情绪，可以互相矛盾，例如 ["开心","有点慌"]。\n`;
    }
    function hookNote() {
        const f = window.aliveMoodFormatNote; if (typeof f !== 'function' || f.__gyInner) return;
        const w = function () { let a = ''; try { a = f.apply(this, arguments) || ''; } catch (e) {} return a + innerNote(); };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyInner = true; window.aliveMoodFormatNote = w; try { aliveMoodFormatNote = w; } catch (e) {}
    }

    // ---------- 4) 下一轮悄悄注回去 ----------
    window.__gyInnerCtxFor = function (charId) {
        try {
            if (!on()) return '';
            const c = charById(charId); const it = c && c.inner;
            if (!it || !it.t || Date.now() - it.at > 12 * 3600000) return '';
            return `【你${ago(it.at)}心里想的（没说出口，只有你自己知道）】${it.t}${it.words && it.words.length ? '（当时的情绪：' + it.words.join('、') + '）' : ''}\n心事不会一轮就散，会悄悄影响你这一轮的语气；但别把它直接说出来，除非这一轮发生的事让你想说了。`;
        } catch (e) { return ''; }
    };
    try { if (typeof GY_BOX_CTX !== 'undefined' && !GY_BOX_CTX.some(x => x[0] === '__gyInnerCtxFor')) GY_BOX_CTX.push(['__gyInnerCtxFor', '心声']); } catch (e) {}

    // ---------- 5) 头像气泡里的心声便签（js/05b showCharLifeStatePopup 调这个） ----------
    function relBits(c) {
        try {
            const R = window.gyRel; if (!R || typeof R.book !== 'function') return null;
            const bk = R.book(c.id) || [], last = bk[bk.length - 1];
            return { sc: Math.round(R.score(c.id) * 10) / 10, stage: R.stage(c.id), last, n: bk.length };
        } catch (e) { return null; }
    }
    window.gyInnerPopupHtml = function (char) {
        try {
            if (!char) return '';
            const it = char.inner, rel = relBits(char);
            let h = '';
            if (it) {
                h += `<div class="gyinr-note"><div class="gyinr-note-h">💭 心声<span>${ago(it.at)}${it.src === 'card' ? ' · 状态栏' : ''}</span></div>`
                    + (it.t ? `<div class="gyinr-note-t">${esc(it.t)}</div>` : '')
                    + (it.words && it.words.length ? `<div class="gyinr-words">${it.words.map(w => `<i>${esc(w)}</i>`).join('')}</div>` : '')
                    + (it.feel && it.feel.length ? `<div class="gyinr-feel">${it.feel.map(f => `<div>${f.p ? `<b>${esc(f.p)}</b>` : ''}${esc(f.s)}</div>`).join('')}</div>` : '')
                    + '</div>';
            } else if (!isBailu() && !on()) {
                h += `<div class="gyinr-hint">想看 TA 没说出口的话：设置 → ⚙️ 自动化功能 → 🫀 活人感 → 打开「TA 的心声和身体感受」</div>`;
            }
            if (rel && rel.last) h += `<div class="gyinr-rel">💗 ${esc(rel.stage)} · 最近一笔 <b style="color:${rel.last.d > 0 ? '#f91880' : '#5b7fff'}">${rel.last.d > 0 ? '+' : ''}${rel.last.d}</b> ${esc(rel.last.why || '')}</div>`;
            h += `<div class="gyinr-more" onclick="event.stopPropagation();document.getElementById('charStatusBubble').style.display='none';gyInnerOpen('${esc(char.id)}')">TA 的状态 ›</div>`;
            return h;
        } catch (e) { return ''; }
    };

    // ---------- 6) 「TA 的状态」整页 ----------
    function bar(label, v, max, color, sub) {
        const pct = Math.max(0, Math.min(100, Math.round(v / max * 100)));
        return `<div class="gyinr-vital"><div class="gyinr-vital-h"><span>${label}</span><b>${sub}</b></div><div class="gyinr-prog"><span style="width:${pct}%;background:${color}"></span></div></div>`;
    }
    window.gyInnerOpen = function (charId) {
        const list = chars(); const c = charById(charId) || list.find(x => String(x.id) === String(window.currentChatSessionId)) || list[0];
        if (!c) return;
        let ov = document.getElementById('gyInnerOv');
        if (!ov) { ov = document.createElement('div'); ov.id = 'gyInnerOv'; ov.className = 'gyinr-ov'; ov.onclick = e => { if (e.target === ov) ov.remove(); }; document.body.appendChild(ov); }
        const rel = relBits(c);
        let mv = 0; try { mv = typeof aliveMoodValue === 'function' ? aliveMoodValue(c) : 0; } catch (e) {}
        let body = []; try { body = typeof aliveBodyState === 'function' && isAutoOn('aliveBody') ? aliveBodyState(c).map(x => x.t) : []; } catch (e) {}
        const it = c.inner, log = c.innerLog || [];
        const bk = rel && window.gyRel ? (window.gyRel.book(c.id) || []).slice(-8).reverse() : [];
        ov.innerHTML = `<div class="gyinr-box"><div class="gyinr-hd"><b>💭 TA 的状态</b><select onchange="gyInnerOpen(this.value)">${list.map(x => `<option value="${esc(x.id)}"${String(x.id) === String(c.id) ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select><a onclick="document.getElementById('gyInnerOv').remove()">✕</a></div><div class="gyinr-bd">
            <div class="gyinr-sub">随故事更新 · ${it ? '上次更新 ' + ago(it.at) : '还没捕捉到'}</div>
            <div class="gyinr-grid">
              ${rel ? bar('💗 关系', rel.sc + 100, 200, rel.sc >= 0 ? '#f91880' : '#5b7fff', esc(rel.stage) + ' ' + (rel.sc > 0 ? '+' : '') + rel.sc) : ''}
              ${bar('🌡️ 情绪', mv + 5, 10, mv >= 0 ? '#ffb74d' : '#7986cb', (mv > 0 ? '+' : '') + mv.toFixed(1) + (c.mood && c.mood.why ? ' · ' + esc(c.mood.why) : ''))}
            </div>
            ${it && it.words && it.words.length ? `<div class="gyinr-sec"><h4>情绪气泡</h4><div class="gyinr-words big">${it.words.map(w => `<i>${esc(w)}</i>`).join('')}</div></div>` : ''}
            <div class="gyinr-sec"><h4>💭 心声</h4>${it && it.t ? `<div class="gyinr-note"><div class="gyinr-note-t">${esc(it.t)}</div></div>` : `<div class="gyinr-empty">${on() ? '心声还没记录，聊一轮就有了。' : '「活人感 → TA 的心声和身体感受」关着；角色卡状态栏里写了心声的也会出现在这里。'}</div>`}</div>
            <div class="gyinr-sec"><h4>🫀 身体</h4>${(it && it.feel && it.feel.length) || body.length ? `<div class="gyinr-feel">${(it && it.feel || []).map(f => `<div>${f.p ? `<b>${esc(f.p)}</b>` : ''}${esc(f.s)}</div>`).join('')}${body.map(t => `<div><b>推算</b>${esc(t)}</div>`).join('')}</div>` : '<div class="gyinr-empty">暂时没有身体感受的记录。</div>'}</div>
            ${bk.length ? `<div class="gyinr-sec"><h4>💗 好感为什么变 <a onclick="document.getElementById('gyInnerOv').remove();gyrelOpen('${esc(c.id)}')">关系账本 ›</a></h4>${bk.map(e => `<div class="gyinr-led"><b style="color:${e.d > 0 ? '#f91880' : '#5b7fff'}">${e.d > 0 ? '+' : ''}${e.d}</b><span>${esc(e.why || '')}</span><em>${esc(e.src || '')} · ${ago(e.at)}</em></div>`).join('')}</div>` : ''}
            ${log.length > 1 ? `<div class="gyinr-sec"><h4>🕰️ 之前的心声</h4>${log.slice(1, 20).map(x => `<div class="gyinr-hist"><em>${ago(x.at)}${x.words && x.words.length ? ' · ' + esc(x.words.join('、')) : ''}${x.mv != null ? ' · 情绪 ' + (x.mv > 0 ? '+' : '') + x.mv : ''}</em>${x.t ? esc(x.t) : (x.feel || []).map(f => esc((f.p ? f.p + '：' : '') + f.s)).join('；')}</div>`).join('')}</div>` : ''}
            <div class="gyinr-sub">心声和身体只有你看得到，TA 不会知道你看过。在记忆总览里能改能删。</div>
        </div></div>`;
    };

    // ---------- 7) 「此刻」页每个角色多两行（js/25 调这个） ----------
    window.gyInnerNowRows = function (c) {
        try {
            const it = c && c.inner; if (!it) return '';
            const r = (l, v) => v ? `<div class="gynow-row"><i>${l}</i><s>${v}</s></div>` : '';
            return r('💭 心声', it.t ? `${esc(it.t.length > 80 ? it.t.slice(0, 80) + '…' : it.t)}　<span style="color:#8b98a5;font-size:11.5px;">${ago(it.at)}</span> <a style="color:#1d9bf0;cursor:pointer;font-size:12px" onclick="gyInnerOpen('${esc(c.id)}')">全部</a>` : '')
                + r('🫀 感觉', (it.feel || []).map(f => esc((f.p ? f.p + '：' : '') + f.s)).join('；'))
                + r('🫧 情绪词', (it.words || []).map(esc).join('、'));
        } catch (e) { return ''; }
    };

    // ---------- 8) 记忆总览 / 今天 / 小手机小组件 ----------
    function regMem() {
        if (typeof window.gyMemExAdd !== 'function') return false;
        window.gyMemExAdd({ k: 'gyInner', ico: '💭', n: 'TA 的心声', d: 'TA 没说出口的话（最近 40 份）', on: () => true,
            items: c => (c && c.innerLog) || [], text: x => x.t || (x.feel || []).map(f => (f.p ? f.p + '：' : '') + f.s).join('；'),
            edit: (x, v) => { x.t = v; }, del: (c, i) => { (c.innerLog || []).splice(i, 1); if (c.inner && !(c.innerLog || []).some(x => x.id === c.inner.id)) c.inner = (c.innerLog || [])[0] || null; },
            meta: x => new Date(x.at).toLocaleString() + (x.words && x.words.length ? ' · ' + x.words.join('、') : ''), save });
        return true;
    }
    function todayHtml() {
        const L = chars().filter(c => c.inner && Date.now() - c.inner.at < 864e5).sort((a, b) => b.inner.at - a.inner.at).slice(0, 3);
        if (!L.length) return '';
        return `<div class="gyt-sec gyinr-tsec"><h4>💭 TA 的心声</h4>${L.map(c => `<div class="gyt-row click" onclick="gyInnerOpen('${esc(c.id)}')"><span class="gyt-t">${esc(c.name)}</span><span class="gyt-x">${esc((c.inner.t || (c.inner.words || []).join('、')).slice(0, 40))}${(c.inner.t || '').length > 40 ? '…' : ''}</span></div>`).join('')}</div>`;
    }
    function paintToday() { ['gyToday', 'gyTodayM'].forEach(id => { const b = document.getElementById(id); if (!b) return; b.querySelectorAll('.gyinr-tsec').forEach(n => n.remove()); const h = todayHtml(); if (h) b.insertAdjacentHTML('beforeend', h); }); }
    function hookToday() {
        const f = window.gyTodayRender; if (typeof f !== 'function' || f.__gyInner) return;
        const w = function () { const r = f.apply(this, arguments); try { paintToday(); } catch (e) {} return r; };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyInner = true; window.gyTodayRender = w;
    }
    function regWidget() {
        const W = window.__gyPmW; if (!W || !W.WD) return false; if (W.WD.gyInnerW) return true;
        W.WD.gyInnerW = { n: 'TA 的心声', sizes: ['s', 'm'], tap: () => window.gyInnerOpen(window.currentChatSessionId),
            r: w => { const c = charById(window.currentChatSessionId) || chars().filter(x => x.inner).sort((a, b) => b.inner.at - a.inner.at)[0]; const it = c && c.inner;
                if (w.size === 's') return `<div class="gyinr-w s"><b>💭</b><em>${it ? esc((it.words || [])[0] || '有心事') : '还没有'}</em></div>`;
                return `<div class="gyinr-w m"><div class="h"><b>💭</b><span>${c ? esc(c.name) + ' 的心声' : 'TA 的心声'}</span></div><em>${it && it.t ? esc(it.t.slice(0, 46)) + (it.t.length > 46 ? '…' : '') : '还没捕捉到'}</em></div>`; } };
        return true;
    }

    // ---------- 9) 样式 ----------
    const css = document.createElement('style'); css.id = 'gyInnerCss';
    css.textContent = `.gyinr-note{margin-top:8px;padding:9px 11px;border-radius:12px;background:linear-gradient(135deg,#fff8d6,#ffefc2);color:#5a4a1f;box-shadow:0 2px 8px rgba(160,120,20,.12);transform:rotate(-.4deg);text-align:left}
.gyinr-note-h{font-size:12px;font-weight:700;display:flex;justify-content:space-between;gap:8px}.gyinr-note-h span{font-weight:400;color:#a08a50;font-size:11px}
.gyinr-note-t{font-size:13px;line-height:1.65;margin-top:3px;white-space:pre-wrap}
.gyinr-words{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.gyinr-words i{font-style:normal;font-size:11.5px;padding:2px 9px;border-radius:12px;background:rgba(255,255,255,.75);color:#8a5a00;border:1px solid #f2d78a}
.gyinr-words.big i{font-size:13px;padding:4px 12px;background:#fff4f8;border-color:#ffd0e2;color:#c2185b}
.gyinr-feel{margin-top:6px;font-size:12px;line-height:1.6}.gyinr-feel b{display:inline-block;margin-right:6px;padding:0 6px;border-radius:6px;background:#ffe0e0;color:#c0392b;font-size:11px}
.gyinr-hint{margin-top:6px;font-size:11px;color:#8b98a5}.gyinr-rel{margin-top:6px;font-size:12px;color:#536471}
.gyinr-more{margin-top:6px;font-size:12px;color:#1d9bf0;cursor:pointer;text-align:right}
.gyinr-ov{position:fixed;inset:0;z-index:100050;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:16px}
.gyinr-box{width:min(460px,100%);max-height:86vh;display:flex;flex-direction:column;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.25)}
.gyinr-hd{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #f0f0f2}.gyinr-hd b{flex:1;font-size:16px}.gyinr-hd select{border:1px solid #e3e3e8;border-radius:10px;padding:4px 8px;background:#fafafa}.gyinr-hd a{cursor:pointer;color:#999;font-size:18px}
.gyinr-bd{overflow:auto;padding:12px 16px 18px}.gyinr-sub{font-size:11.5px;color:#8b98a5;margin:4px 0 8px}
.gyinr-grid{display:grid;gap:8px}.gyinr-vital{padding:10px 12px;border-radius:14px;background:#f7f8fa}.gyinr-vital-h{display:flex;justify-content:space-between;font-size:12.5px;gap:8px}.gyinr-vital-h b{font-weight:600;color:#333;text-align:right}
.gyinr-prog{height:6px;border-radius:3px;background:#e9ebef;margin-top:6px;overflow:hidden}.gyinr-prog span{display:block;height:100%;border-radius:3px}
.gyinr-sec{margin-top:14px}.gyinr-sec h4{margin:0 0 6px;font-size:13.5px;display:flex;justify-content:space-between}.gyinr-sec h4 a{font-weight:400;font-size:12px;color:#1d9bf0;cursor:pointer}
.gyinr-empty{font-size:12.5px;color:#8b98a5}.gyinr-led{display:flex;gap:8px;align-items:baseline;font-size:12.5px;padding:4px 0;border-bottom:1px dashed #f0f0f2}.gyinr-led span{flex:1}.gyinr-led em{font-style:normal;color:#aaa;font-size:11px}
.gyinr-hist{font-size:12.5px;line-height:1.6;padding:6px 0;border-bottom:1px dashed #f0f0f2}.gyinr-hist em{display:block;font-style:normal;color:#aaa;font-size:11px}
.gyinr-w{height:100%;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:10px;box-sizing:border-box}.gyinr-w.s{align-items:center;text-align:center}.gyinr-w b{font-size:24px}.gyinr-w.s b{font-size:28px}.gyinr-w em{font-style:normal;font-size:12px;line-height:1.45;opacity:.85}.gyinr-w .h{display:flex;gap:6px;align-items:center;font-weight:600;font-size:13px}.gyinr-w .h b{font-size:18px}
body.dark-mode .gyinr-box,body.dark .gyinr-box{background:#1e1f22;color:#e8e8e8}body.dark-mode .gyinr-vital,body.dark .gyinr-vital{background:#2a2b2f}`;
    document.head.appendChild(css);

    function hookAll() { hookCapture(); hookStatusLog(); hookNote(); hookToday(); }
    hookAll(); setInterval(hookAll, 4000);
    let n1 = 0; const iv1 = setInterval(() => { if (regMem() || ++n1 > 80) clearInterval(iv1); }, 500);
    let n2 = 0; const iv2 = setInterval(() => { if (regWidget() || ++n2 > 240) clearInterval(iv2); }, 500);
})();
