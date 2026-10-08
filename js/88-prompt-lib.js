/* ============================================================
   📜 内置提示词与内置世界书（v213）
   ------------------------------------------------------------
   谷雨自己写死在代码里、每次都会发给模型的那些「规矩」和「说明」，全部列在一页里，能看、能改、能恢复默认：
     · 🧾 说话的规矩：人味强化协议、动作描写格式（允许 / 不允许两版）、约定≠已发生；
     · 🕰️ 时间：时间感知协议 TPES、聊天里的时间感知规矩、「现在的真实时间」提醒、不感知时间时的规矩；
     · 📖 内置世界书：相处模式（四种）、风格调料（八样）、别把她写弱（七条）——这三个插件装了才有。
   {{名字}} 是空位，发出去之前会换成实际内容（比如 {{现在}} 换成现在的时间）；改的时候留着它就行，删掉也不会报错。
   改过的存在 localStorage（会跟着备份走）；最上面那个开关关掉＝全部用默认的，改过的还留着。
   开关（发不发）还是在「注入内容管理」里；这一页管的是「发的是什么字」。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyPromptLib) return;
    window.__gyPromptLib = true;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };
    const KEY = 'gyPromptLib';
    let O = { on: true, ov: {}, log: [] };
    try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v) O = Object.assign(O, v); } catch (e) {}
    O.ov = O.ov || {}; O.log = Array.isArray(O.log) ? O.log : [];
    const store = () => { try { localStorage.setItem(KEY, JSON.stringify(O)); } catch (e) {} window.__gyPLOv = O; };
    window.__gyPLOv = O;
    const defs = () => (typeof GY_PL_DEFS !== 'undefined' ? GY_PL_DEFS : {});

    // 目录：id → 标题、在哪用、空位说明。没登记的（以后新加的）也会列出来，放在「其它」里
    const G = [
        { g: '🧾 说话的规矩', items: [
            ['core.humanFeel', '人味强化协议', '每次生成都在最前面（设置 → 聊天 → 人味强化协议 打开时）'],
            ['core.fmtOn', '格式规则 · 允许动作描写', '「允许角色使用动作与心理描写」打开时用这句'],
            ['core.fmtOff', '格式规则 · 不要动作描写', '上面那个关着时用这句'],
            ['core.promise', '约定≠已经发生', '聊天、日记、推文、信都带']] },
        { g: '🕰️ 时间', items: [
            ['core.tpes', '时间感知协议 TPES', '感知真实时间开着、TPES 打开时', '{{睡眠时段}}：按设置里的休息时间段生成的一句'],
            ['core.timeRules', '聊天里的时间感知规矩', '聊天回复时，跟在「现在几点、隔了多久」后面'],
            ['core.now', '「现在的真实时间」提醒', '聊天回复的最后', '{{现在}}：现在的时间；{{时段}}：早上 / 下午 / 深夜……'],
            ['time.off', '不感知时间时的规矩', '「感知真实时间」关上时，代替 TPES']] },
        { g: '🕐 这一幕', items: [
            ['chat.scene', '让 TA 交「这一幕」的要求', '聊天回复时（「聊天里显示这一幕」开着）；JSON 那几个字段名别改']] },
        { g: '📖 内置世界书 · 相处模式', plug: 'gyxBond', items: [
            ['bond.healthy', '🌿 健康恋爱', '选了这种相处模式的 TA'], ['bond.longterm', '🍵 举案齐眉', '选了这种相处模式的 TA'],
            ['bond.childhood', '🎒 青梅竹马', '选了这种相处模式的 TA'], ['bond.rivals', '⚡ 欢喜冤家', '选了这种相处模式的 TA']] },
        { g: '📖 内置世界书 · 风格调料', plug: 'gyxSpice', items: [
            ['spice.humor', '😆 幽默一点'], ['spice.life', '🍜 烟火气'], ['spice.emo', '🌊 情绪更浓'], ['spice.crowd', '👥 带出身边的人'],
            ['spice.sweet', '💌 更主动表达爱'], ['spice.deep', '🫂 深度共鸣'], ['spice.net', '📱 自然网感'], ['spice.loose', '⌨️ 打字随性']] },
        { g: '📖 内置世界书 · 别把她写弱', plug: 'gyxFair', items: [
            ['fair.strong', '💪 不矮化她'], ['fair.facts', '🍳 不替她编设定'], ['fair.noControl', '🔓 不支配'], ['fair.noRage', '🧊 不暴走'],
            ['fair.noJargon', '🗣️ 说人话'], ['fair.noPronoun', '🏷️ 不叫她「某人」'], ['fair.equal', '⚖️ 平等']] }
    ];
    // 打开页面前，把还没被用过的那几条默认文字也取到（有的要等第一次生成才会登记）
    function warm() {
        try {
            const d = defs();
            if (!d['core.humanFeel'] && typeof GY_PL_HUMANFEEL !== 'undefined') d['core.humanFeel'] = GY_PL_HUMANFEEL;
            if (!d['core.tpes'] && typeof GY_PL_TPES !== 'undefined') d['core.tpes'] = GY_PL_TPES;
            if (!d['core.timeRules'] && typeof GY_PL_TIMERULES !== 'undefined') d['core.timeRules'] = GY_PL_TIMERULES;
            if (!d['core.now'] && typeof GY_PL_NOW !== 'undefined') d['core.now'] = GY_PL_NOW;
            if (!d['core.fmtOn']) d['core.fmtOn'] = '你可以使用括号(如()或【】)来进行动作描写和心理描写。';
            if (!d['core.fmtOff']) d['core.fmtOff'] = '不要有多余的动作描写或心理描写，直接输出说话或正文内容。';
            if (!d['core.promise'] && typeof window.gyPromiseRule === 'function') window.gyPromiseRule();
            if (!d['time.off'] && window.__gyTimeOffDef) d['time.off'] = window.__gyTimeOffDef;
            if (!d['chat.scene'] && window.__gySceneDef) d['chat.scene'] = window.__gySceneDef;
        } catch (e) {}
    }
    const cur = id => (O.on !== false && typeof O.ov[id] === 'string') ? O.ov[id] : (defs()[id] || '');
    const logIt = t => { O.log.unshift({ id: 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), at: Date.now(), t }); O.log = O.log.slice(0, 100); };
    const titleOf = id => { for (const g of G) for (const it of g.items) if (it[0] === id) return it[1]; return id; };

    window.gyPLSave = function (id, v) {
        const d = defs()[id] || '';
        if (String(v) === d) { delete O.ov[id]; logIt(`「${titleOf(id)}」改回了默认`); }
        else { O.ov[id] = String(v); logIt(`改了「${titleOf(id)}」`); }
        store(); toast(['✏️ 改好了', '📜 存好了', '✅ 下一次生成就用这个'][Math.floor(Math.random() * 3)], titleOf(id)); window.gyPLOpen(true);
    };
    window.gyPLReset = function (id) { if (!(id in O.ov)) return; delete O.ov[id]; logIt(`「${titleOf(id)}」恢复了默认`); store(); toast('↩️ 恢复默认了', titleOf(id)); window.gyPLOpen(true); };
    window.gyPLOn = function (v) { O.on = !!v; store(); toast(v ? '📜 用你改过的版本' : '📜 全部用默认的', v ? '' : '改过的还留着，再打开就回来'); window.gyPLOpen(true); };
    window.gyPLExport = function () {
        const txt = JSON.stringify({ gyPromptLib: 1, ov: O.ov }, null, 1);
        try { if (typeof window.saveTextFileForApp === 'function') return window.saveTextFileForApp('谷雨-内置提示词-改过的.json', txt); } catch (e) {}
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = '内置提示词-改过的.json'; a.click();
    };
    window.gyPLImport = function () {
        const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
        i.onchange = async () => { try { const j = JSON.parse(await i.files[0].text()); const ov = j && j.ov; if (!ov || typeof ov !== 'object') throw 0; let n = 0; Object.keys(ov).forEach(k => { if (typeof ov[k] === 'string') { O.ov[k] = ov[k]; n++; } }); logIt(`导入了 ${n} 条`); store(); toast('📥 导入好了', n + ' 条'); window.gyPLOpen(true); } catch (e) { toast('导入失败', '不是内置提示词导出的文件'); } };
        i.click();
    };
    window.gyPLFilter = function (q) { q = String(q || '').trim(); document.querySelectorAll('#gyPLOv .gypl2-it').forEach(el => { el.style.display = !q || el.dataset.s.indexOf(q) >= 0 ? '' : 'none'; }); window.__gyPLQ = q; };
    window.gyPLOpen = function (keep) {
        warm();
        let ov = document.getElementById('gyPLOv'); const st = ov ? ov.querySelector('.gypl2-box').scrollTop : 0;
        if (!ov) { ov = document.createElement('div'); ov.id = 'gyPLOv'; ov.className = 'gypl2-ov'; ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.appendChild(ov); }
        const d = defs(), known = new Set(G.flatMap(g => g.items.map(x => x[0])));
        const others = Object.keys(d).filter(k => !known.has(k));
        const groups = G.concat(others.length ? [{ g: '🧩 其它', items: others.map(k => [k, k]) }] : []);
        const plugOn = p => !p || (window.GYX && window.GYX.FEATS && window.GYX.FEATS.some(f => f.id === p));
        const card = ([id, t, where, vars]) => {
            const has = d[id] != null, edited = typeof O.ov[id] === 'string';
            return `<div class="gypl2-it" data-s="${esc((t + ' ' + (where || '') + ' ' + cur(id)).toLowerCase())}"><div class="gypl2-h"><b>${esc(t)}</b>${edited ? '<i class="gypl2-ed">改过</i>' : ''}<span>${esc(where || '')}</span></div>
                ${vars ? `<div class="gypl2-v">空位：${esc(vars)}</div>` : ''}
                ${has ? `<textarea class="gypl2-ta" id="gyPLta_${esc(id).replace(/\W/g, '_')}">${esc(cur(id))}</textarea>
                <div class="gypl2-row"><button class="gypl2-btn" onclick="gyPLSave('${esc(id)}',document.getElementById('gyPLta_${esc(id).replace(/\W/g, '_')}').value)">保存</button>${edited ? `<button class="gypl2-btn lite" onclick="gyPLReset('${esc(id)}')">恢复默认</button>` : ''}<em>${cur(id).length} 字</em></div>`
                    : `<div class="gypl2-v">还没用到过（相关功能关着，或者还没生成过）。</div>`}</div>`;
        };
        ov.innerHTML = `<div class="gypl2-box"><div class="gypl2-hd"><b>📜 内置提示词与内置世界书</b><span class="gypl2-x" onclick="document.getElementById('gyPLOv').remove()">✕</span></div>
            <div class="gypl2-tip">谷雨自己写在代码里、每次发给 TA 的规矩和说明都在这里，能直接改。<b>{{…}}</b> 是空位，发出去前会换成实际内容。发不发去「注入内容管理」开关；这里管发的是什么字。</div>
            <div class="gypl2-row top"><label><input type="checkbox" ${O.on !== false ? 'checked' : ''} onchange="gyPLOn(this.checked)"> 用我改过的版本（关掉＝全部用默认的）</label>
                <span style="flex:1"></span><button class="gypl2-btn lite" onclick="gyPLExport()">导出改过的</button><button class="gypl2-btn lite" onclick="gyPLImport()">导入</button>${typeof openSettingsPanel === 'function' ? `<button class="gypl2-btn lite" onclick="document.getElementById('gyPLOv').remove();openSettingsPanel('inject')">注入内容管理 ›</button>` : ''}</div>
            <input class="gypl2-q" placeholder="搜一搜：标题或文字里的词" value="${esc(window.__gyPLQ || '')}" oninput="gyPLFilter(this.value.toLowerCase())">
            ${groups.map(g => `<div class="gypl2-sec">${esc(g.g)}${g.plug && !plugOn(g.plug) ? '<span>（这个插件没装，装了才会用到）</span>' : ''}</div>${g.items.map(card).join('')}`).join('')}
            ${O.log.length ? `<div class="gypl2-sec">改动记录</div>${O.log.slice(0, 12).map(x => `<div class="gypl2-v">${new Date(x.at).toLocaleString()} · ${esc(x.t)}</div>`).join('')}` : ''}</div>`;
        if (window.__gyPLQ) window.gyPLFilter(window.__gyPLQ);
        if (keep) ov.querySelector('.gypl2-box').scrollTop = st;
    };

    // ---------- 入口：注入内容管理页顶上 / 小功能 ----------
    function mount() {
        const p = document.getElementById('setPanel-inject');
        if (p && !document.getElementById('gyPLEntry')) { const d = document.createElement('div'); d.id = 'gyPLEntry'; d.className = 'gypl2-entry'; d.innerHTML = '📜 <b>内置提示词与内置世界书</b><span>谷雨自己写的那些规矩，能看能改 ›</span>'; d.onclick = () => window.gyPLOpen(); p.insertBefore(d, p.firstChild); }
        try { if (typeof registerMiniFeature === 'function' && !(typeof GY_MINI_FEATURES !== 'undefined' && GY_MINI_FEATURES.some(f => f.id === 'promptLib'))) registerMiniFeature({ id: 'promptLib', icon: '📜', title: '内置提示词', desc: '谷雨写在代码里的规矩和内置世界书：人味强化、时间感知、相处模式、风格调料……都能改', onOpen: () => window.gyPLOpen() }); } catch (e) {}
    }
    // ---------- 今天 / 小组件 / 记忆总览 ----------
    function todayHtml() {
        const L = O.log.filter(x => new Date(x.at).toDateString() === new Date().toDateString()); if (!L.length) return '';
        return `<div class="gyt-sec gypl2-tsec"><h4>📜 内置提示词</h4>${L.slice(0, 3).map(x => `<div class="gyt-row click" onclick="gyPLOpen()"><span class="gyt-t">${new Date(x.at).toTimeString().slice(0, 5)}</span><span class="gyt-x">${esc(x.t)}</span></div>`).join('')}</div>`;
    }
    function paintToday() { ['gyToday', 'gyTodayM'].forEach(id => { const b = document.getElementById(id); if (!b) return; b.querySelectorAll('.gypl2-tsec').forEach(n => n.remove()); const h = todayHtml(); if (h) b.insertAdjacentHTML('beforeend', h); }); }
    function hookToday() { const f = window.gyTodayRender; if (typeof f !== 'function' || f.__gyPL) return; const w = function () { const r = f.apply(this, arguments); try { paintToday(); } catch (e) {} return r; }; Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyPL = true; window.gyTodayRender = w; }
    function regWidget() {
        const W = window.__gyPmW; if (!W || !W.WD) return false; if (W.WD.gyPLW) return true;
        W.WD.gyPLW = { n: '内置提示词', sizes: ['s', 'm'], tap: () => window.gyPLOpen(), r: w => { const n = Object.keys(O.ov).length;
            return w.size === 's' ? `<div class="gypl2-w s"><b>📜</b><em>${n ? '改过 ' + n + ' 条' : '都是默认'}</em></div>` : `<div class="gypl2-w m"><div class="h"><b>📜</b><span>内置提示词</span></div><em>${n ? `改过 ${n} 条${O.on === false ? '（现在用默认）' : ''}` : '都是默认的'}</em><small>${O.log[0] ? esc(O.log[0].t) : '点开看看谷雨都跟 TA 说了什么'}</small></div>`; } };
        return true;
    }
    function regMem() {
        if (typeof window.gyMemExAdd !== 'function') return false;
        window.gyMemExAdd({ k: 'gyPromptLib', ico: '📜', n: '改过的内置提示词', d: '所有 TA 共用；删掉＝恢复默认', on: () => Object.keys(O.ov).length > 0,
            items: () => Object.keys(O.ov).map(id => ({ id, t: O.ov[id] })), text: x => x.t,
            edit: (x, v) => { O.ov[x.id] = String(v); }, del: (c, i) => { const id = Object.keys(O.ov)[i]; if (id) { delete O.ov[id]; logIt(`「${titleOf(id)}」恢复了默认`); } },
            meta: x => titleOf(x.id), save: () => store() });
        return true;
    }
    const css = document.createElement('style'); css.id = 'gyPLCss';
    css.textContent = `.gypl2-ov{position:fixed;inset:0;z-index:100030;background:rgba(0,0,0,.32);display:flex;align-items:center;justify-content:center;padding:14px}
.gypl2-box{background:#fff;color:#1d1d1f;border-radius:20px;width:min(720px,100%);max-height:92vh;overflow:auto;padding:0 18px 20px;box-sizing:border-box;box-shadow:0 24px 60px rgba(0,0,0,.2)}
.gypl2-hd{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:14px 0 10px;background:rgba(255,255,255,.95);font-size:17px}.gypl2-x{cursor:pointer;color:#999;padding:2px 6px}
.gypl2-tip{font-size:12.5px;color:#7b8794;line-height:1.7}
.gypl2-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:6px;font-size:13px}.gypl2-row.top{margin:10px 0}.gypl2-row em{font-style:normal;font-size:11.5px;color:#9aa;margin-left:auto}
.gypl2-btn{border:none;border-radius:999px;padding:6px 14px;background:var(--gy-accent,#1d9bf0);color:#fff;font-size:12.5px;cursor:pointer}.gypl2-btn.lite{background:rgba(var(--gy-accent-rgb,29,155,240),.1);color:var(--gy-accent,#1d9bf0)}
.gypl2-q{width:100%;box-sizing:border-box;padding:8px 12px;border-radius:12px;border:1px solid rgba(0,0,0,.1)!important;font-size:13px;margin-bottom:4px}
.gypl2-sec{font-size:13.5px;font-weight:700;color:#536471;margin:18px 0 6px}.gypl2-sec span{font-weight:400;font-size:12px;color:#9aa}
.gypl2-it{border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:10px 12px;margin-top:8px}
.gypl2-h{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.gypl2-h span{font-size:11.5px;color:#9aa;margin-left:auto}
.gypl2-ed{font-style:normal;font-size:11px;padding:1px 8px;border-radius:9px;background:#fff4e5;color:#d9822b}
.gypl2-v{font-size:12px;color:#8b98a5;margin-top:4px;line-height:1.6}
.gypl2-ta{width:100%;box-sizing:border-box;min-height:90px;margin-top:8px;padding:8px 10px;border-radius:10px;border:1px solid rgba(0,0,0,.1)!important;font-size:12.5px;line-height:1.7;resize:vertical;font-family:inherit}
.gypl2-entry{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 14px;margin-bottom:12px;border-radius:14px;cursor:pointer;background:rgba(var(--gy-accent-rgb,29,155,240),.07);font-size:14px}.gypl2-entry span{font-size:12px;color:#7b8794;margin-left:auto}
body.dark-theme .gypl2-box{background:#16181c;color:#e7e9ea}body.dark-theme .gypl2-hd{background:rgba(22,24,28,.95)}body.dark-theme .gypl2-ta,body.dark-theme .gypl2-q{background:#0d0f12;color:#e7e9ea}
.gypl2-w{height:100%;display:flex;flex-direction:column;justify-content:center;padding:10px;box-sizing:border-box}.gypl2-w.s{align-items:center;gap:4px}.gypl2-w.s b{font-size:24px}.gypl2-w.s em{font-style:normal;font-size:12px}
.gypl2-w.m .h{display:flex;gap:6px;align-items:center;font-size:12px;opacity:.8}.gypl2-w.m em{font-style:normal;font-size:15px;font-weight:700;margin-top:6px}.gypl2-w.m small{font-size:11px;opacity:.65;margin-top:2px}`;
    (document.head || document.documentElement).appendChild(css);
    let memOk = false, wOk = false;
    function tick() { mount(); hookToday(); if (!memOk) memOk = regMem(); if (!wOk) wOk = regWidget(); }
    tick(); setInterval(tick, 3000);
})();
