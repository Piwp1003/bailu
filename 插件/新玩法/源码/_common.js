/* ---- 新玩法插件的公用小工具（每个插件都带一份，谁先加载谁建好，后面的直接用） ---- */
if (!window.GYX) (function () {
    const X = {};
    X.bailu = () => !!window.bailuCards;                                   // 白露：不接模型，用字卡
    X.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    X.pick = a => a[Math.floor(Math.random() * a.length)];
    X.rnd = (a, b) => a + Math.random() * (b - a);
    X.toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };
    X.chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []).filter(c => c && !c.members);
    X.char = id => X.chars().find(c => String(c.id) === String(id));
    X.cur = () => { try { const s = typeof currentChatSessionId !== 'undefined' && currentChatSessionId; if (s && X.char(s)) return X.char(s); } catch (e) {} let best = null, bt = -1; X.chars().forEach(c => { const H = (typeof globalChats !== 'undefined' && globalChats[c.id]) || []; const t = H.length ? H[H.length - 1].timestamp || 0 : 0; if (t > bt) { bt = t; best = c; } }); return best; };
    X.name = c => c ? (c.remark || c.name || 'TA') : 'TA';
    X.me = c => { try { return typeof userDisplayName === 'function' && c ? userDisplayName(c) : ((typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '你'); } catch (e) { return '你'; } };
    X.day = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    X.plain = t => String(t || '').replace(/<[^>]+>/g, '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    X.persona = c => String((c && (c.persona || c.description)) || '').slice(0, 900);
    X.recent = (c, n) => ((typeof globalChats !== 'undefined' && c && globalChats[c.id]) || []).filter(m => m.sender !== 'system').slice(-(n || 16)).map(m => (m.sender === 'me' ? X.me(c) : X.name(c)) + '：' + X.plain(m.text).slice(0, 120)).join('\n');
    X.store = name => { const lf = (typeof localforage !== 'undefined' && localforage.createInstance) ? localforage.createInstance({ name: 'gyx_' + name, storeName: 'kv' }) : null; return { get: async (k, d) => { try { const v = lf && await lf.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set: async (k, v) => { try { if (lf) await lf.setItem(k, v); } catch (e) {} } }; };
    X.json = t => { try { const m = String(t || '').match(/\{[\s\S]*\}|\[[\s\S]*\]/); return m ? JSON.parse(m[0]) : null; } catch (e) { return null; } };
    // 问模型（谷雨）。白露没有模型：返回 null，由各插件自己从字卡里拼
    X.ask = async function (prompt, extra) {
        if (X.bailu()) return null;
        try {
            const api = typeof getApiConfig === 'function' ? getApiConfig(true) : null;
            if (!api || !api.url || typeof sendChatRequest !== 'function') return null;
            const d = await sendChatRequest(api, prompt, extra);
            return String((d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim() || null;
        } catch (e) { return null; }
    };
    X.who = c => `你是${X.name(c)}。${X.persona(c)}\n（你正在和${X.me(c)}谈恋爱，她是你最重要的人。）`;
    // 白露：从字卡里抽几句（没有这个类型就用聊天字卡）
    X.cards = (kinds, c, n) => { if (!window.bailuDraw) return []; for (const k of [].concat(kinds, '聊天')) { try { const r = window.bailuDraw(k, c, n || 1).filter(Boolean); if (r.length) return r; } catch (e) {} } return []; };
    // TA 主动来找你（带着由头）
    const NUDGE = {};
    X.reach = async (c, why) => { if (!c || typeof sendProactiveChatMessage !== 'function') return false; NUDGE[String(c.id)] = why; try { await sendProactiveChatMessage(c); return true; } catch (e) { return false; } finally { delete NUDGE[String(c.id)]; } };
    window.__gyxNudgeFor = id => NUDGE[String(id)] ? `【这次主动找她的由头】${NUDGE[String(id)]}。就为这个来找她，自然地说。` : '';
    const CTX = [];
    window.__gyxCtxFor = id => [window.__gyxNudgeFor(id)].concat(CTX.map(f => { try { return f(id) || ''; } catch (e) { return ''; } })).filter(Boolean).join('\n');
    X.ctx = (f, fid) => CTX.push(id => (!fid || X.on(fid)) ? f(id) : '');
    // TA 直接发一条消息进聊天
    X.say = function (c, text, extra) {
        if (!c || typeof globalChats === 'undefined') return null;
        const sid = String(c.id); if (!globalChats[sid]) globalChats[sid] = [];
        const m = Object.assign({ sender: c.id, text: String(text), timestamp: Date.now(), readBy: [], gyx: 1 }, extra || {});
        globalChats[sid].push(m);
        try { saveAllData(); } catch (e) {}
        try { if (String(currentChatSessionId) === sid && typeof renderChatMessages === 'function') renderChatMessages(); } catch (e) {}
        try { if (typeof renderChatCharList === 'function') renderChatCharList(); } catch (e) {}
        return m;
    };
    X.notify = (c, text, desc, fn) => { try { addNotification(text, null, c ? c.id : null, c, desc || '', fn ? { jump: { fn } } : undefined); } catch (e) {} };
    X.speak = async (c, text, onEnd) => { try { if (window.gyVoiceSpeak) return await window.gyVoiceSpeak(c, text, { onEnd }); } catch (e) {} try { const u = new SpeechSynthesisUtterance(X.plain(text)); u.lang = 'zh-CN'; if (onEnd) u.onend = onEnd; speechSynthesis.speak(u); return 'browser'; } catch (e) { if (onEnd) onEnd(); return null; } };
    X.stopSpeak = () => { try { if (window.gyVoiceStop) window.gyVoiceStop(); } catch (e) {} try { speechSynthesis.cancel(); } catch (e) {} };
    // 功能开关：每个新功能都能单独关；「TA 自己会不会做」也能单独关（id + '.auto'）
    const FK = 'gyxFeat'; let FS = {}; try { FS = JSON.parse(localStorage.getItem(FK) || '{}') || {}; } catch (e) {}
    X.FEATS = window.__gyxFeats = window.__gyxFeats || [];
    X.feat = (id, def) => { if (!X.FEATS.some(f => f.id === id)) X.FEATS.push(Object.assign({ id, def: true, auto: true }, def)); };
    X.on = id => { const f = X.FEATS.find(x => x.id === id.replace(/\.auto$/, '')); const d = f ? (/\.auto$/.test(id) ? f.auto !== false : f.def !== false) : true; return FS[id] == null ? d : !!FS[id]; };
    X.set = (id, v) => { FS[id] = !!v; try { localStorage.setItem(FK, JSON.stringify(FS)); } catch (e) {} try { window.dispatchEvent(new CustomEvent('gyx:feat', { detail: { id, on: !!v } })); } catch (e) {} syncMini(); };
    // 弹窗文字不固定：给几种说法，随机挑一个
    X.v = (...a) => X.pick(a);
    X.auto = c => { try { return typeof getCharActMode === 'function' ? getCharActMode(c) === 'auto' : c.actMode === 'auto'; } catch (e) { return false; } };
    // 放进自主行动：功能关了、或者「TA 自己做」关了，TA 就不会选它
    X.action = (def, fid) => { try { if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || GY_AUTONOMY_ACTIONS.some(a => a.key === def.key)) return; const need = def.need; def.need = c => (!fid || (X.on(fid) && X.on(fid + '.auto'))) && (!need || need(c)); GY_AUTONOMY_ACTIONS.push(def); } catch (e) {} };
    const MINIS = [];
    function syncMini() { try { if (typeof GY_MINI_FEATURES === 'undefined') return; MINIS.forEach(([d, fid]) => { const i = GY_MINI_FEATURES.findIndex(f => f.id === d.id); const on = !fid || X.on(fid); if (on && i < 0 && typeof registerMiniFeature === 'function') registerMiniFeature(d); if (!on && i >= 0) GY_MINI_FEATURES.splice(i, 1); }); } catch (e) {} }
    X.mini = (def, fid) => { MINIS.push([def, fid || def.id]); syncMini(); };
    X.widget = (k, def) => { const W = window.__gyPmW; if (W && W.WD && !W.WD[k]) W.WD[k] = def; };
    X.repaint = () => { try { const W = window.__gyPmW; if (W && W.render && document.body.classList.contains('gyphm') && !document.body.classList.contains('gyphm-app') && !document.querySelector('#gyPmHome .pm-lock')) W.render(); } catch (e) {} };
    X.whoSel = (sel, on) => `<select class="gyx-who" onchange="${on}(this.value)">${X.chars().map(c => `<option value="${X.esc(c.id)}"${String(c.id) === String(sel) ? ' selected' : ''}>${X.esc(X.name(c))}</option>`).join('')}</select>`;
    // 「今天」面板：每个插件往里加一小节（功能关了就不出现）
    const TODAY = [];
    X.today = (fn, fid) => { TODAY.push([fn, fid]); X.todayHook(); };
    X.todayHtml = function () {
        let h = '';
        TODAY.forEach(([fn, fid]) => {
            if (fid && !X.on(fid)) return;
            let r = null; try { r = fn(); } catch (e) {}
            if (!r || !r.rows || !r.rows.length) return;
            h += `<div class="gyt-sec gyx-tsec"><h4>${r.title}</h4>` + r.rows.map(w => `<div class="gyt-row${w.go ? ' click' : ''}"${w.go ? ` onclick="${w.go}"` : ''}><span class="gyt-t">${X.esc(w.t || '')}</span><span class="gyt-x">${w.x || ''}</span></div>`).join('') + '</div>';
        });
        return h;
    };
    X.todayPaint = function () { ['gyToday', 'gyTodayM'].forEach(id => { const b = document.getElementById(id); if (!b) return; b.querySelectorAll('.gyx-tsec').forEach(n => n.remove()); const h = X.todayHtml(); if (h) b.insertAdjacentHTML('beforeend', h); }); };
    X.todayHook = function () {
        const f = window.gyTodayRender; if (typeof f !== 'function' || f.__gyx) return;
        const w = function () { const r = f.apply(this, arguments); try { X.todayPaint(); } catch (e) {} return r; };
        w.__gyx = true; window.gyTodayRender = w;
    };
    setInterval(() => { X.todayHook(); }, 3000);
    // 统一的弹窗（小手机风格）
    X.panel = function (id, title, html, cls) {
        let ov = document.getElementById(id); if (ov) ov.remove();
        ov = document.createElement('div'); ov.id = id; ov.className = 'gyx-ov ' + (cls || '');
        ov.innerHTML = `<div class="gyx-box"><div class="gyx-hd"><b>${title}</b><span class="gyx-x" onclick="document.getElementById('${id}').remove()">✕</span></div><div class="gyx-bd">${html}</div></div>`;
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov); return ov;
    };
    X.css = (id, t) => { if (document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = t; document.head.appendChild(s); };
    X.css('gyxBaseCss', `
.gyx-ov{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.32);display:flex;align-items:center;justify-content:center;padding:14px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Microsoft YaHei",sans-serif}
.gyx-box{background:#fff;color:#1d1d1f;border-radius:22px;width:min(560px,100%);max-height:92vh;overflow:auto;box-sizing:border-box;box-shadow:0 24px 60px rgba(0,0,0,.2)}
.gyx-hd{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;background:rgba(255,255,255,.9);backdrop-filter:blur(12px);font-size:17px}.gyx-x{cursor:pointer;color:#999;padding:2px 6px}
.gyx-bd{padding:4px 18px 18px}
.gyx-btn{padding:9px 16px;border-radius:14px;border:none;background:#1d1d1f;color:#fff;cursor:pointer;font-family:inherit;font-size:14px}.gyx-btn.lite{background:#f2f2f4;color:#1d1d1f}.gyx-btn:disabled{opacity:.4}
.gyx-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}.gyx-tip{font-size:12.5px;color:#8e8e93;line-height:1.7;margin:6px 0}
.gyx-who,.gyx-in{padding:8px 10px;border-radius:12px;border:1px solid #e5e5ea;background:#fafafa;font-family:inherit;font-size:14px;box-sizing:border-box}.gyx-in{width:100%}
textarea.gyx-in{resize:vertical;line-height:1.7}
.gyx-card{background:#f7f7f9;border-radius:16px;padding:12px 14px;margin:8px 0}
.gyx-chip{display:inline-block;padding:5px 11px;border-radius:999px;background:#f2f2f4;font-size:13px;cursor:pointer;margin:2px}.gyx-chip.on{background:#1d1d1f;color:#fff}
.gyx-hand{font-family:"Ma Shan Zheng","Zhi Mang Xing","Long Cang","Xingkai SC","STXingkai","华文行楷","KaiTi","STKaiti","楷体",cursive}
.gyx-ov.dark .gyx-box{background:#1c1c1e;color:#f5f5f7}.gyx-ov.dark .gyx-hd{background:rgba(28,28,30,.9)}
`);
    // 手写字体（联网时加载，不联网就用系统里的楷体/行楷）
    if (!document.getElementById('gyxFont')) { const l = document.createElement('link'); l.id = 'gyxFont'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Long+Cang&display=swap'; document.head.appendChild(l); }
    // 把上面的由头 / 各插件的注入挂进提示词
    const hook = () => { try { if (typeof GY_BOX_CTX !== 'undefined' && !GY_BOX_CTX.some(x => x[0] === '__gyxCtxFor')) GY_BOX_CTX.push(['__gyxCtxFor', '新玩法插件']); } catch (e) {} };
    hook(); setInterval(hook, 3000);
    window.GYX = X;
})();
const X = window.GYX;
