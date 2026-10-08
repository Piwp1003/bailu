/* ============================================================
   🕐 聊天里的「这一幕」（v213，照电波手机那样）
   ------------------------------------------------------------
   TA 每一轮回复时顺手交一个「这一幕」：
     · 标题＝这一幕的场景名（比如「热饮的余温与老街的雨」）；
     · 内容＝这一幕的场景描写（在哪、天气光线、声音气味、两个人此刻的位置和气氛），不是思考过程。
   聊天里在 TA 这一轮第一条消息上面放一行：头像 + 🕐 + 场景名 + ›，点开在聊天里展开场景描写（灰色小字），再点收起。
   模型这一轮如果还先想了一段（<think> / 推理通道），展开后最下面有个「💭 TA 这一轮在想什么」可以再点开。
   没交场景、只有思考的那一轮：标题用思考里写的「标题：」或者第一句话，展开是思考。
   · 场景跟着消息存，换手机、备份都在；下一轮会把上一幕告诉 TA，场景能接上；
   · 记忆总览里能改场景名和描写；场景那段要求在「📜 内置提示词」里能改。
   开关：全部开关 → 活人感 →「聊天里显示这一幕」「聊天里显示 TA 的思考」。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyChatThink) return;
    window.__gyChatThink = true;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    try {
        if (typeof AUTO_FEATURE_DEFS !== 'undefined') {
            if (!AUTO_FEATURE_DEFS.some(f => f.key === 'chatScene'))
                AUTO_FEATURE_DEFS.push({ key: 'chatScene', label: '聊天里显示这一幕', group: '活人感',
                    desc: 'TA 每一轮回复时顺手写一个「这一幕」：场景名（像「热饮的余温与老街的雨」）和一小段场景描写（在哪、天气、声音、两个人此刻的气氛）。聊天里 TA 这一轮第一条消息上面一行「🕐 场景名 ›」，点开看描写。下一轮会接着上一幕往下写。',
                    where: '私聊 / 群聊里 TA 的消息上方', cost: '每轮多写一百来字（同一次调用里，不多调）' });
            if (!AUTO_FEATURE_DEFS.some(f => f.key === 'chatThink'))
                AUTO_FEATURE_DEFS.push({ key: 'chatThink', label: '聊天里显示 TA 的思考', group: '活人感',
                    desc: '模型这一轮先想了一段的话，留着给你看：有「这一幕」的，展开以后最下面能再点开 TA 的思考；没有的，那一行就直接是思考。不用开思维链收纳盒。只是给你看，不会发回给模型。',
                    where: '私聊 / 群聊里 TA 的消息上方', cost: '不花钱（模型本来就想了，只是不扔掉）' });
        }
    } catch (e) {}
    const isOn = k => { try { return typeof isAutoOn === 'function' ? isAutoOn(k) : true; } catch (e) { return true; } };
    const on = () => isOn('chatThink');
    const sceneOn = () => isOn('chatScene') && !window.bailuCards;   // 白露没有模型，交不了「这一幕」（多出来的要求还会让字卡引擎认错这次在干嘛）
    window.gyChatThinkOn = on;

    // ---------- 思考：存在单独的小库（不进主存档） ----------
    let store = null;
    try { if (typeof localforage !== 'undefined' && localforage.createInstance) store = localforage.createInstance({ name: 'gyChatThink', storeName: 'k' }); } catch (e) {}
    let D = {};          // key → { t: 正文, title, at, cid }
    const open = new Set(), openThink = new Set();
    let saveT = null;
    const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { if (store) store.setItem('d', D); } catch (e) {} }, 400); };
    (async () => { try { if (store) D = (await store.getItem('d')) || {}; } catch (e) {} refreshSoon(); })();

    function titleOf(text) {
        const s = String(text || '');
        const m = s.match(/(?:本轮|这一轮)?(?:标题|题目|title)\s*[:：]\s*[「『"《]?([^\n」』"》]{2,24})/i);
        if (m) return m[1].trim();
        const lines = s.replace(/<[^>\n]*>/g, '\n').split('\n').map(x => x.replace(/^[#>*\-\s\d.、【】\[\]]+/, '').replace(/^(月读|天照|思考|分析|Ecot|Vol\s*\d*)\s*[:：]\s*/i, '').trim()).filter(x => x.length >= 4);
        const first = (lines[0] || '').split(/[。！？!?；;，,]/)[0].trim();
        return first ? (first.length > 16 ? first.slice(0, 16) + '…' : first) : 'TA 想了想';
    }
    window.gyChatThinkSink = function (rec) {
        try {
            if (!on() || !rec || !rec.key || !rec.text || !rec.text.trim()) return;
            const old = D[rec.key];
            const text = old && old.t && old.t !== rec.text && !old.t.includes(rec.text) ? old.t + '\n\n' + rec.text : rec.text;
            D[rec.key] = { t: text.slice(0, 20000), title: (old && old.edited && old.title) || titleOf(text), at: Date.now(), cid: old && old.cid };
            const ks = Object.keys(D); if (ks.length > 500) ks.sort((a, b) => (D[a].at || 0) - (D[b].at || 0)).slice(0, ks.length - 500).forEach(k => delete D[k]);
            save(); refreshSoon();
        } catch (e) {}
    };

    // ---------- 这一幕：让 TA 在回复的 JSON 里交，收下来挂在这一轮第一条消息上 ----------
    const SCENE_DEF = `\n【额外字段·这一幕】：在上面那个 JSON 里再加一个 "scene"：{"title":"这一幕的名字，6 到 12 个字，像小说的小标题（比如：热饮的余温与老街的雨）","desc":"60 到 150 字的场景描写：在哪、天气和光线、周围的声音气味、你们俩此刻的位置和气氛"}。
按你们此刻真实的处境写：隔着手机聊天就写你那边的样子；见了面就写你们在的地方。只写场景，不写对话，不替她做动作、不替她想。场景没变就沿用上一幕的名字，描写接着往下写。
例：{"replies":[...], "stateUpdate":"...", "scene":{"title":"热饮的余温与老街的雨","desc":"老城区的秋雨还在落，……"}}\n`;
    const sceneNote = () => sceneOn() ? (typeof gyPL === 'function' ? gyPL('chat.scene', SCENE_DEF) : SCENE_DEF) : '';
    window.__gySceneDef = SCENE_DEF;
    const pending = {};    // cid → { title, desc, at }
    function sceneFrom(parsed) {
        const s = parsed && (parsed.scene || parsed.Scene || parsed['这一幕']);
        if (!s) return null;
        if (typeof s === 'string') { const t = s.trim(); return t ? { title: titleOf(t), desc: t.slice(0, 600) } : null; }
        const title = String(s.title || s.name || s['标题'] || '').trim().slice(0, 24), desc = String(s.desc || s.text || s.description || s['描写'] || '').trim().slice(0, 800);
        return title || desc ? { title: title || titleOf(desc), desc } : null;
    }
    function hookCapture() {
        const f = window.aliveCaptureMood; if (typeof f !== 'function' || f.__gyScene) return;
        const w = function (char, parsed) { const r = f.apply(this, arguments); try { if (sceneOn() && char) { const s = sceneFrom(parsed); if (s) pending[String(char.id)] = Object.assign(s, { at: Date.now() }); } } catch (e) {} return r; };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyScene = true; window.aliveCaptureMood = w; try { aliveCaptureMood = w; } catch (e) {}
    }
    function hookNote() {
        const f = window.aliveMoodFormatNote; if (typeof f !== 'function' || f.__gyScene) return;
        const w = function () { let a = ''; try { a = f.apply(this, arguments) || ''; } catch (e) {} return a + sceneNote(); };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyScene = true; window.aliveMoodFormatNote = w; try { aliveMoodFormatNote = w; } catch (e) {}
    }
    // 把还没挂上的场景挂到这一轮 TA 的第一条消息上
    function attachPending() {
        let changed = false;
        Object.keys(pending).forEach(cid => {
            const p = pending[cid]; if (!p) return;
            if (Date.now() - p.at > 180000) { delete pending[cid]; return; }
            const sids = [cid].concat((typeof groupChats !== 'undefined' ? groupChats : []).filter(g => (g.members || []).map(String).includes(cid)).map(g => g.id));
            for (const sid of sids) {
                const L = (typeof globalChats !== 'undefined' && globalChats[sid]) || [];
                for (let i = L.length - 1; i >= 0 && i >= L.length - 20; i--) {
                    const m = L[i];
                    if (!m || String(m.sender) !== cid || (m.timestamp || 0) < p.at - 5000) continue;
                    // 往前找到这一轮的第一条（中间没隔着别人的话）
                    let j = i; while (j - 1 >= 0 && L[j - 1] && String(L[j - 1].sender) === cid && (L[j - 1].timestamp || 0) >= p.at - 5000) j--;
                    if (!L[j].scene) { L[j].scene = { title: p.title, desc: p.desc }; changed = true; }
                    delete pending[cid]; break;
                }
                if (!pending[cid]) break;
            }
        });
        if (changed) { try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {} }
        return changed;
    }
    // 下一轮把上一幕告诉 TA，场景能接上
    window.__gySceneCtxFor = function (id) {
        try {
            if (!sceneOn()) return '';
            const L = (typeof globalChats !== 'undefined' && globalChats[String(id)]) || [];
            for (let i = L.length - 1; i >= Math.max(0, L.length - 60); i--) { const s = L[i] && L[i].scene; if (s && (s.title || s.desc)) return `【上一幕】${s.title || ''}${s.desc ? '：' + String(s.desc).slice(0, 200) : ''}`; }
        } catch (e) {}
        return '';
    };
    try { if (typeof GY_BOX_CTX !== 'undefined' && !GY_BOX_CTX.some(x => x[0] === '__gySceneCtxFor')) GY_BOX_CTX.push(['__gySceneCtxFor', '上一幕']); } catch (e) {}

    window.gyChatThinkToggle = function (key) { if (open.has(key)) open.delete(key); else open.add(key); paint(); };
    window.gyChatThinkInner = function (key) { if (openThink.has(key)) openThink.delete(key); else openThink.add(key); paint(); };

    // ---------- 画 ----------
    function curList() { try { return (typeof globalChats !== 'undefined' && globalChats[currentChatSessionId]) || []; } catch (e) { return []; } }
    function paint() {
        const area = document.getElementById('chatMessagesArea'); if (!area) return;
        area.querySelectorAll('.gyth').forEach(n => n.remove());
        area.querySelectorAll('.gyth-next').forEach(n => n.classList.remove('gyth-next'));
        const showT = on(), showS = sceneOn();
        document.body.classList.toggle('gyth-on', showT);
        if (!showT && !showS) return;
        const L = curList(); const done = new Set();
        area.querySelectorAll('.chat-msg-row.other').forEach(row => {
            const b = row.querySelector('.chat-bubble[oncontextmenu]'); if (!b) return;
            const mm = /showChatContextMenu\(event,\s*(\d+)\)/.exec(b.getAttribute('oncontextmenu') || ''); if (!mm) return;
            const idx = +mm[1], msg = L[idx]; if (!msg) return;
            const sc = showS && msg.scene && (msg.scene.title || msg.scene.desc) ? msg.scene : null;
            const th = showT && msg.reasoningKey && !done.has(msg.reasoningKey) ? D[msg.reasoningKey] : null;
            if (!sc && !th) return;
            if (msg.reasoningKey) done.add(msg.reasoningKey);
            if (th && th.cid == null && msg.sender != null) { th.cid = String(msg.sender); save(); }
            const k = 'm' + idx + '_' + (msg.timestamp || 0), isOpen = open.has(k), thOpen = openThink.has(k);
            const title = sc ? (sc.title || titleOf(sc.desc)) : (th.title || 'TA 想了想');
            let body = '';
            if (isOpen) {
                if (sc) body = `<div class="gyth-bd">${esc(sc.desc || '')}</div>${th ? `<div class="gyth-sub" onclick="event.stopPropagation();gyChatThinkInner('${k}')">💭 TA 这一轮在想什么 <i>${thOpen ? '⌄' : '›'}</i></div>${thOpen ? `<div class="gyth-bd think">${esc(th.t)}</div>` : ''}` : ''}`;
                else body = `<div class="gyth-bd">${esc(th.t)}</div>`;
            }
            const av = row.firstElementChild && !row.firstElementChild.classList.contains('chat-bubble-wrapper') ? row.firstElementChild.outerHTML : '<div></div>';
            const d = document.createElement('div'); d.className = 'gyth' + (isOpen ? ' open' : '') + (sc ? ' scene' : '');
            d.innerHTML = `<div class="gyth-av">${av}</div><div class="gyth-main"><div class="gyth-hd" onclick="event.stopPropagation();gyChatThinkToggle('${k}')"><span class="gyth-ic">🕐</span><span class="gyth-t">${esc(title)}</span><i class="gyth-ch">${isOpen ? '⌄' : '›'}</i></div>${body}</div>`;
            row.parentNode.insertBefore(d, row);
            row.classList.add('gyth-next');
        });
    }
    let rT = null;
    function refreshSoon() { clearTimeout(rT); rT = setTimeout(() => { try { paint(); } catch (e) {} }, 120); }
    function hook() {
        const f = window.renderChatMessages; if (typeof f !== 'function' || f.__gyChatThink) return;
        const w = function () { try { attachPending(); } catch (e) {} const r = f.apply(this, arguments); try { paint(); } catch (e) {} return r; };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} });
        w.__gyChatThink = true; window.renderChatMessages = w; try { (0, eval)('renderChatMessages = window.renderChatMessages'); } catch (e) {}
    }

    // ---------- 今天 / 小组件 / 记忆总览 ----------
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []).filter(c => c && !c.members);
    const scenesOf = cid => { const L = (typeof globalChats !== 'undefined' && globalChats[String(cid)]) || []; return L.filter(m => m && m.scene && String(m.sender) === String(cid)); };
    const lastScene = () => { let best = null; chars().forEach(c => { const s = scenesOf(c.id).pop(); if (s && (!best || s.timestamp > best.m.timestamp)) best = { c, m: s }; }); return best; };
    function todayHtml() {
        if (!sceneOn()) return '';
        const day = new Date().toDateString(), rows = [];
        chars().forEach(c => scenesOf(c.id).filter(m => new Date(m.timestamp).toDateString() === day).forEach(m => rows.push({ c, m })));
        if (!rows.length) return '';
        rows.sort((a, b) => b.m.timestamp - a.m.timestamp);
        return `<div class="gyt-sec gyth-tsec"><h4>🕐 今天的几幕</h4>${rows.slice(0, 4).map(x => `<div class="gyt-row"><span class="gyt-t">${esc(x.c.name)}</span><span class="gyt-x">${esc(x.m.scene.title || '')}</span></div>`).join('')}</div>`;
    }
    function paintToday() { ['gyToday', 'gyTodayM'].forEach(id => { const b = document.getElementById(id); if (!b) return; b.querySelectorAll('.gyth-tsec').forEach(n => n.remove()); const h = todayHtml(); if (h) b.insertAdjacentHTML('beforeend', h); }); }
    function hookToday() { const f = window.gyTodayRender; if (typeof f !== 'function' || f.__gyChatThink) return; const w = function () { const r = f.apply(this, arguments); try { paintToday(); } catch (e) {} return r; }; Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyChatThink = true; window.gyTodayRender = w; }
    function regWidget() {
        const W = window.__gyPmW; if (!W || !W.WD) return false; if (W.WD.gyThinkW) return true;
        W.WD.gyThinkW = { n: '这一幕', sizes: ['s', 'm'], tap: () => { try { const x = lastScene(); if (x && typeof switchChatSession === 'function') { switchMainView('chat'); switchChatSession(String(x.c.id)); } } catch (e) {} }, r: w => {
            const x = lastScene();
            if (w.size === 's') return `<div class="gyth-w s"><b>🕐</b><em>${x ? esc(String(x.m.scene.title).slice(0, 8)) : '还没有'}</em></div>`;
            return `<div class="gyth-w m"><div class="h"><b>🕐</b><span>${x ? esc(x.c.name) + ' · 这一幕' : '这一幕'}</span></div><em>${x ? esc(x.m.scene.title) : '聊起来就有了'}</em><small>${x ? esc(String(x.m.scene.desc || '').slice(0, 30)) : ''}</small></div>`; } };
        return true;
    }
    function regMem() {
        if (typeof window.gyMemExAdd !== 'function') return false;
        window.gyMemExAdd({ k: 'gyScene', ico: '🕐', n: '聊天里的「这一幕」', d: '每一轮的场景名和场景描写（改的是描写，名字在描写第一行写「名字｜」可以一起改）', on: () => sceneOn(),
            items: c => scenesOf(c.id).slice().reverse(), text: x => (x.scene.title ? x.scene.title + '｜' : '') + (x.scene.desc || ''),
            edit: (x, v) => { const s = String(v); const i = s.indexOf('｜'); if (i > 0 && i <= 24) { x.scene.title = s.slice(0, i).trim(); x.scene.desc = s.slice(i + 1).trim(); } else x.scene.desc = s.trim(); },
            del: (c, i) => { const m = scenesOf(c.id).slice().reverse()[i]; if (m) delete m.scene; }, meta: x => new Date(x.timestamp).toLocaleString() });
        window.gyMemExAdd({ k: 'gyChatThink', ico: '💭', n: 'TA 的思考（聊天里那行 🕐）', d: '改的是小标题；删掉就是这一段思考不再显示', on: () => on(),
            items: c => Object.keys(D).filter(k => String(D[k].cid) === String(c.id)).sort((a, b) => D[b].at - D[a].at).map(k => Object.assign({ __k: k }, D[k])), text: x => x.title,
            edit: (x, v) => { const it = D[x.__k]; if (it) { it.title = String(v).slice(0, 30); it.edited = true; } },
            del: (c, i) => { const ks = Object.keys(D).filter(k => String(D[k].cid) === String(c.id)).sort((a, b) => D[b].at - D[a].at); if (ks[i]) delete D[ks[i]]; },
            meta: x => new Date(x.at).toLocaleString() + ' · ' + x.t.length + ' 字', save: () => { save(); refreshSoon(); } });
        return true;
    }

    const css = document.createElement('style'); css.id = 'gyChatThinkCss';
    css.textContent = `.gyth{display:flex;align-items:flex-start;gap:8px;margin:6px 0 2px;padding:0 4px}
.gyth-av{flex:none}.gyth-main{flex:1;min-width:0;max-width:78%}
.gyth-hd{display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:#8b8f99;font-size:13px;padding:8px 2px;user-select:none}
.gyth-ic{font-size:12px;filter:grayscale(1);opacity:.75}.gyth-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}
.gyth-ch{font-style:normal;font-size:16px;line-height:1;margin-left:4px;color:#9aa0a8}
.gyth.open .gyth-main{max-width:86%}.gyth.open .gyth-hd{display:flex}
.gyth-bd{white-space:pre-wrap;word-break:break-word;font-size:12.5px;line-height:1.75;color:#7d828c;padding:2px 2px 8px;max-height:60vh;overflow:auto}
.gyth-bd.think{font-size:12px;color:#9a9ea6;border-left:2px solid rgba(127,127,127,.18);padding-left:8px;margin-left:2px}
.gyth-sub{font-size:12px;color:#9a9ea6;cursor:pointer;padding:2px 2px 6px;user-select:none}.gyth-sub i{font-style:normal;margin-left:3px}
.chat-msg-row.gyth-next>:first-child:not(.chat-bubble-wrapper){visibility:hidden}
body.gyth-on .chat-bubble-wrapper .gyrv-chip{display:none}
body.dark-theme .gyth-hd,body.dark-theme .gyth-bd{color:#8b98a5}
.gyth-w{height:100%;display:flex;flex-direction:column;justify-content:center;padding:10px;box-sizing:border-box}.gyth-w.s{align-items:center;gap:4px}.gyth-w.s b{font-size:24px}.gyth-w.s em{font-style:normal;font-size:12px}
.gyth-w.m .h{display:flex;gap:6px;align-items:center;font-size:12px;opacity:.8}.gyth-w.m em{font-style:normal;font-size:13.5px;margin-top:6px}.gyth-w.m small{font-size:11px;opacity:.6;margin-top:2px}`;
    (document.head || document.documentElement).appendChild(css);
    let memOk = false, wOk = false;
    function tick() { hook(); hookCapture(); hookNote(); hookToday(); if (!memOk) memOk = regMem(); if (!wOk) wOk = regWidget(); try { if (attachPending()) refreshSoon(); } catch (e) {} }
    tick(); setInterval(tick, 3000);
})();
