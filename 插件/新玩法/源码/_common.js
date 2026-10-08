/* ---- 新玩法插件的公用小工具（每个插件都带一份，谁先加载谁建好，后面的直接用） ---- */
if (!window.GYX) (function () {
    const X = {};
    // 🔋 插件体检 / 省电：记下每个插件开的定时器（靠每个插件末尾的 //# sourceURL=gyx-plugin/名字.js 认出是谁开的），省电模式下让它们跑慢一点
    try {
        if (!window.__gyxTimerWrap) {
            window.__gyxTimerWrap = 1; window.__gyxTimers = [];
            try { window.__gyxSaver = JSON.parse(localStorage.getItem('gyxSaver') || 'null') || { on: false, fac: 3, hid: 6, anim: true, auto: true }; } catch (e) { window.__gyxSaver = { on: false, fac: 3, hid: 6, anim: true, auto: true }; }
            const _si = window.setInterval.bind(window), _ci = window.clearInterval.bind(window);
            window.setInterval = function (fn, ms, ...a) {
                if (typeof fn !== 'function') return _si(fn, ms, ...a);
                let who = null; try { const m = String(new Error().stack || '').split('\n').slice(2).join('\n').match(/gyx-plugin\/([^:)\s]+?)\.js/); /* 跳过第一行（Error）和第二行（这个包装函数自己） */ if (m) { try { who = decodeURIComponent(m[1]); } catch (e) { who = m[1]; } } } catch (e) {}
                if (!who) return _si(fn, ms, ...a);
                const T = { who, ms: +ms || 0, runs: 0, cost: 0, last: 0, skip: 0, at: Date.now() };
                const w = function () { const sv = window.__gyxSaver; if (sv && sv.on) { const f = document.hidden ? +sv.hid || 1 : +sv.fac || 1; if (f > 1 && Date.now() - T.last < T.ms * f - 50) { T.skip++; return; } } T.last = Date.now(); const t0 = performance.now(); try { return fn.apply(this, a); } finally { T.cost += performance.now() - t0; T.runs++; } };
                const id = _si(w, ms); T.id = id; window.__gyxTimers.push(T); return id;
            };
            window.clearInterval = function (id) { const L = window.__gyxTimers || [], i = L.findIndex(t => t.id === id); if (i >= 0) L.splice(i, 1); return _ci(id); };
        }
    } catch (e) {}
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
    X.store = name => { try { (window.__gyxStoreNames = window.__gyxStoreNames || []).push('gyx_' + name); } catch (e) {} const lf = (typeof localforage !== 'undefined' && localforage.createInstance) ? localforage.createInstance({ name: 'gyx_' + name, storeName: 'kv' }) : null; return { get: async (k, d) => { try { const v = lf && await lf.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set: async (k, v) => { try { if (lf) await lf.setItem(k, v); } catch (e) {} } }; };
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
    // 🗓️ 回顾类的节奏（周报、我们的书、星图、TA 眼中的你、回忆放映、TA 写给你的歌……）：多久总结一次你自己定。
    //    每个插件 X.recapDef 登记自己能怎么调，X.recap(key) 读你选的；在「📚 回顾 → ⚙️ 多久总结一次」里改
    const RK = 'gyxRecap'; let RC = {}; try { RC = JSON.parse(localStorage.getItem(RK) || '{}') || {}; } catch (e) {}
    X.RECAP = window.__gyxRecapDefs = window.__gyxRecapDefs || [];
    X.recapDef = (key, def) => { if (!X.RECAP.some(d => d.key === key)) X.RECAP.push(Object.assign({ key }, def)); };
    X.recap = key => { const d = X.RECAP.find(x => x.key === key) || {}, c = RC[key] || {}; return { v: c.v != null ? c.v : d.def, auto: c.auto != null ? !!c.auto : d.autoDef !== false }; };
    X.recapSet = (key, k, v) => { RC[key] = Object.assign({}, RC[key], { [k]: v }); try { localStorage.setItem(RK, JSON.stringify(RC)); } catch (e) {} };
    const p2 = n => String(n).padStart(2, '0');
    X.UNITS = { half: '半个月', month: '一个月', season: '一个季度', year: '一年' };
    X.unitStart = (t, unit) => { const d = new Date(t); d.setHours(0, 0, 0, 0); if (unit === 'year') { d.setMonth(0, 1); } else if (unit === 'season') { d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1); } else if (unit === 'half') { d.setDate(d.getDate() <= 15 ? 1 : 16); } else d.setDate(1); return d.getTime(); };
    X.unitKey = (t, unit) => { const d = new Date(t), y = d.getFullYear(), m = d.getMonth() + 1; return unit === 'year' ? y + '' : unit === 'season' ? y + '-Q' + Math.ceil(m / 3) : unit === 'half' ? y + '-' + p2(m) + (d.getDate() <= 15 ? '上' : '下') : y + '-' + p2(m); };
    X.unitPrev = (t, unit) => X.unitKey(X.unitStart(t, unit) - 1, unit);
    // 弹窗文字不固定：给几种说法，随机挑一个
    X.v = (...a) => X.pick(a);
    X.auto = c => { try { return typeof getCharActMode === 'function' ? getCharActMode(c) === 'auto' : c.actMode === 'auto'; } catch (e) { return false; } };
    // 放进自主行动：功能关了、或者「TA 自己做」关了，TA 就不会选它
    X.action = (def, fid) => { try { if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || GY_AUTONOMY_ACTIONS.some(a => a.key === def.key)) return; const need = def.need; def.need = c => (!fid || (X.on(fid) && X.on(fid + '.auto'))) && (!need || need(c)); GY_AUTONOMY_ACTIONS.push(def); } catch (e) {} };
    const MINIS = [];
    function syncMini() { try { if (typeof GY_MINI_FEATURES === 'undefined') return; MINIS.forEach(([d, fid]) => { const i = GY_MINI_FEATURES.findIndex(f => f.id === d.id); const on = !fid || X.on(fid); if (on && i < 0 && typeof registerMiniFeature === 'function') registerMiniFeature(d); if (!on && i >= 0) GY_MINI_FEATURES.splice(i, 1); }); } catch (e) {} }
    X.mini = (def, fid) => { MINIS.push([def, fid || def.id]); syncMini(); };
    // 小手机桌面小组件：手机页还没加载好就等一会儿再登记；功能关了小组件显示「关着」而不是报错
    const WQ = [];
    function wFlush() { const W = window.__gyPmW; if (!W || !W.WD) return false; WQ.splice(0).forEach(([k, def, fid]) => { if (W.WD[k]) return; const r = def.r, tap = def.tap; if (fid) { def.r = w => X.on(fid) ? r(w) : `<div class="gw-x s"><b>💤</b><em>${X.esc(def.n)}（关着）</em></div>`; if (tap) def.tap = w => X.on(fid) ? tap(w) : (window.gyxSwitchOpen ? window.gyxSwitchOpen() : 0); } W.WD[k] = def; }); return true; }
    let wTimer = null;
    X.widget = (k, def, fid) => { WQ.push([k, def, fid]); if (wFlush() || wTimer) return; let n = 0; wTimer = setInterval(() => { if (wFlush() || ++n > 120) { clearInterval(wTimer); wTimer = null; } }, 500); };
    // 记忆总览：插件记下的东西登记进「记忆总览 → 🧩 其它记忆」，能改能删（功能关了这一节就不显示）
    X.mem = (def, fid) => { const reg = () => { if (typeof window.gyMemExAdd !== 'function') return false; window.gyMemExAdd(Object.assign({ on: () => !fid || X.on(fid) }, def)); return true; }; if (!reg()) { let n = 0; const iv = setInterval(() => { if (reg() || ++n > 80) clearInterval(iv); }, 500); } };
    // 常见情况：一个数组里每条带 cid —— 按角色筛出来
    X.memArr = (o, fid) => { const items = c => (o.arr() || []).filter(x => x && String(o.cid ? o.cid(x) : x.cid) === String(c.id)); X.mem({ k: o.k, ico: o.ico, n: o.n, d: o.d, items, text: x => String(o.text(x) || ''), meta: o.meta || (x => x.at ? new Date(x.at).toLocaleString() : ''), edit: (x, v) => { if (o.edit) o.edit(x, v); else x[o.field] = v; }, del: (c, i) => { const it = items(c)[i], A = o.arr(), j = A.indexOf(it); if (j >= 0) A.splice(j, 1); }, save: async () => { await o.save(); } }, fid); };
    // 通用小组件外观：大图标 + 标题 + 几行字（小号只显示图标和第一行）
    X.gw = (w, icon, title, lines) => { lines = (lines || []).filter(Boolean); return w.size === 's' ? `<div class="gw-x s"><b>${icon}</b><em>${lines[0] != null ? lines[0] : X.esc(title)}</em></div>` : `<div class="gw-x m"><div class="h"><b>${icon}</b><span>${X.esc(title)}</span></div>${lines.slice(0, 3).map(l => `<em>${l}</em>`).join('') || '<em>还没有内容</em>'}</div>`; };
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
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyx = true; window.gyTodayRender = w;
    };
    setInterval(() => { X.todayHook(); }, 3000);
    // 统一的弹窗（小手机风格）
    X.panel = function (id, title, html, cls) {
        // 🧩 正在「合集」里打开（js/79）：直接画在合集的标签下面，不另弹一层
        let host = null; try { host = typeof window.gyHubHost === 'function' ? window.gyHubHost(id, title) : null; } catch (e) {}
        if (host) {
            const old = document.getElementById(id); if (old) old.remove();
            const el =document.createElement('div'); el.id = id; el.className = 'gyx-inhub ' + (cls || ''); el.setAttribute('data-gy-nopage', '1');
            el.innerHTML = `<div class="gyx-box"><div class="gyx-bd">${html}</div></div>`;
            host.appendChild(el); return el;
        }
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
.gw-x{height:100%;display:flex;flex-direction:column;justify-content:center;gap:3px;overflow:hidden}.gw-x.s{align-items:center;text-align:center}.gw-x.s b{font-size:30px;font-weight:normal;line-height:1.1}.gw-x .h{display:flex;align-items:center;gap:6px;margin-bottom:2px}.gw-x .h b{font-size:20px;font-weight:normal}.gw-x .h span{font-weight:600;font-size:13.5px}.gw-x em{font-style:normal;font-size:12px;color:var(--pm-sub,#888);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.gyx-btn{padding:9px 16px;border-radius:14px;border:none;background:#1d1d1f;color:#fff;cursor:pointer;font-family:inherit;font-size:14px}.gyx-btn.lite{background:#f2f2f4;color:#1d1d1f}.gyx-btn:disabled{opacity:.4}
.gyx-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}.gyx-tip{font-size:12.5px;color:#8e8e93;line-height:1.7;margin:6px 0}
.gyx-who,.gyx-in{padding:8px 10px;border-radius:12px;border:1px solid #e5e5ea;background:#fafafa;font-family:inherit;font-size:14px;box-sizing:border-box}.gyx-in{width:100%}
textarea.gyx-in{resize:vertical;line-height:1.7}
.gyx-card{background:#f7f7f9;border-radius:16px;padding:12px 14px;margin:8px 0}
.gyx-chip{display:inline-block;padding:5px 11px;border-radius:999px;background:#f2f2f4;font-size:13px;cursor:pointer;margin:2px}.gyx-chip.on{background:#1d1d1f;color:#fff}
.gyx-hand{font-family:"Ma Shan Zheng","Zhi Mang Xing","Long Cang","Xingkai SC","STXingkai","华文行楷","KaiTi","STKaiti","楷体",cursive}
.gyx-ov.dark .gyx-box{background:#1c1c1e;color:#f5f5f7}.gyx-inhub>.gyx-box>.gyx-bd{padding:2px 18px 18px}.gyx-inhub.dark{background:#1c1c1e;color:#f5f5f7;border-radius:0 0 22px 22px}.gyx-ov.dark .gyx-hd{background:rgba(28,28,30,.9)}
`);
    // 手写字体（联网时加载，不联网就用系统里的楷体/行楷）
    if (!document.getElementById('gyxFont')) { const l = document.createElement('link'); l.id = 'gyxFont'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Long+Cang&display=swap'; document.head.appendChild(l); }
    // 把上面的由头 / 各插件的注入挂进提示词
    const hook = () => { try { if (typeof GY_BOX_CTX !== 'undefined' && !GY_BOX_CTX.some(x => x[0] === '__gyxCtxFor')) GY_BOX_CTX.push(['__gyxCtxFor', '新玩法插件']); } catch (e) {} };
    hook(); setInterval(hook, 3000);
    window.GYX = X;
})();
const X = window.GYX;
