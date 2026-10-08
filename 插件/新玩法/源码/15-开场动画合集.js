/* 🎬 开场动画合集：20 种开场（手机锁屏、星空、胶片倒数、拍立得、信纸、雨窗、打字机、聊天气泡、心电图、花瓣、极简、月相、霓虹、杂志封面、登机牌、电影票、便利贴、萤火虫、暖色大地、电台调频），上百句文案随机；想用哪几种、文案从哪来都能自己选，也能整个关掉用回原来的 */
if (window.__gyxIntro) return; window.__gyxIntro = 1;
X.feat('gyxIntro', { n: '🎬 开场动画合集', desc: '打开时放一段开场（20 种样式随机），关掉就用回原来的开场', auto: false });
const EARLY = __INTRO_EARLY__;
const K = 'gyxIntroCfg';
const getC = () => { try { return JSON.parse(localStorage.getItem(K) || 'null') || {}; } catch (e) { return {}; } };
const setC = c => { try { localStorage.setItem(K, JSON.stringify(c)); } catch (e) {} };
// 把开场代码装进「页面一打开就跑」的位置（谷雨 / 白露的 index.html 里有个小钩子会读它）
function install() {
    let E = {}; try { E = JSON.parse(localStorage.getItem('gyEarly') || '{}') || {}; } catch (e) {}
    const c = getC();
    if (c.on && X.on('gyxIntro')) E.gyxIntro = EARLY; else delete E.gyxIntro;
    try { localStorage.setItem('gyEarly', JSON.stringify(E)); } catch (e) {}
}
// 下次开场要用的东西先存好：TA 最近说过的话、名字、头像、白露的开场字卡
function cache() {
    const c = getC(); c.app = X.bailu() ? '白露' : '谷雨';
    const cs = X.chars(), ta = [];
    cs.forEach(ch => ((typeof globalChats !== 'undefined' && globalChats[ch.id]) || []).slice(-60).forEach(m => { if (String(m.sender) === String(ch.id)) { const t = X.plain(String(m.text || '').replace(/^\s*[\[【]\s*语音\s*[\]】]/, '')); if (t.length >= 4 && t.length <= 26) ta.push([t, X.name(ch)]); } }));
    const cur = X.cur();
    c.cache = Object.assign(c.cache || {}, { ta: ta.slice(-80), ta0: cur ? X.name(cur) : '', me: X.me(cur) });
    try { if (X.bailu() && window.bailuDraw) c.cache.cards = window.bailuDraw('开场', null, 30).filter(Boolean); } catch (e) {}
    try { if (cur && cur.avatarImg && /^data:/.test(cur.avatarImg) && cur.avatarImg.length < 400000) c.cache.av = cur.avatarImg; } catch (e) {}
    setC(c);
}
function lib() { if (!window.__gyxIntroLib) { window.__gyxIntroNoAuto = true; try { new Function(EARLY)(); } catch (e) {} window.__gyxIntroNoAuto = false; } return window.__gyxIntroLib; }
function relib() { delete window.__gyxIntroLib; return lib(); }
window.gyxIntroOpen = function () {
    const c = getC(), L = lib(); if (!L) return;
    const ids = Object.keys(L.styles), sel = c.styles && c.styles.length ? c.styles : ids, cats = Object.keys(L.cats), cs = c.cats && c.cats.length ? c.cats : cats, src = c.src || { lib: true, custom: true, ta: true, cards: true };
    const mine = c.custom || [];
    X.panel('gyxInOv', '🎬 开场动画', `
        <label class="gyx-row"><input type="checkbox" ${c.on ? 'checked' : ''} onchange="gyxIntroSet('on',this.checked)"> <b>用这套开场</b>（关掉就用回原来的）</label>
        <label class="gyx-row"><input type="checkbox" ${c.once ? 'checked' : ''} onchange="gyxIntroSet('once',this.checked)"> 一天只放一次（当天第一次打开）</label>
        <div class="gyx-row">怎么挑：<label><input type="radio" name="gyxInM" ${c.mode !== 'seq' ? 'checked' : ''} onchange="gyxIntroSet('mode','rand')"> 每次随机</label><label><input type="radio" name="gyxInM" ${c.mode === 'seq' ? 'checked' : ''} onchange="gyxIntroSet('mode','seq')"> 轮流来</label>　速度 <input type="range" min="0.5" max="2" step="0.1" value="${c.speed || 1}" onchange="gyxIntroSet('speed',+this.value)"></div>
        <div class="gyx-tip">勾选想要的（在勾选的里面挑），点 ▶ 预览：<span class="gyx-chip" onclick="gyxIntroAll(1)">全选</span><span class="gyx-chip" onclick="gyxIntroAll(0)">全不选</span></div>
        <div class="in-grid">${ids.map(k => `<label class="in-it ${sel.includes(k) ? 'on' : ''}"><input type="checkbox" ${sel.includes(k) ? 'checked' : ''} onchange="gyxIntroPick('${k}')"><span>${X.esc(L.styles[k].n)}${/^u_/.test(k) ? ' <em>自己的</em>' : ''}</span><b onclick="event.preventDefault();gyxIntroPreview('${k}')">▶</b></label>`).join('')}</div>
        <div class="gyx-tip">文案从哪来：</div>
        <div class="gyx-row">${[['lib', '内置文案'], ['custom', '我自己写的'], ['ta', 'TA 对我说过的话'], ['cards', '白露「开场」字卡']].map(([k, n]) => `<label><input type="checkbox" ${src[k] !== false ? 'checked' : ''} onchange="gyxIntroSrc('${k}')"> ${n}</label>`).join('　')}</div>
        <div class="gyx-tip">内置文案要哪几类：</div>
        <div class="gyx-row">${cats.map(k => `<label class="in-cat"><input type="checkbox" ${cs.includes(k) ? 'checked' : ''} onchange="gyxIntroCat('${k}')"> ${k}</label>`).join('')}</div>
        <label class="gyx-tip" style="display:block">大标题（空着＝${X.bailu() ? '白露' : '谷雨'}）<input class="gyx-in" value="${X.esc(c.title || '')}" onchange="gyxIntroSet('title',this.value)"></label>
        <label class="gyx-tip" style="display:block">自己写的文案，一行一句（可以用「正文|落款」，{ta}＝TA 的名字，{me}＝你的名字）<textarea class="gyx-in" rows="4" onchange="gyxIntroSet('lines',this.value.split('\\n').map(s=>s.trim()).filter(Boolean))">${X.esc((c.lines || []).join('\n'))}</textarea></label>
        <div class="gyx-row"><button class="gyx-btn" onclick="gyxIntroPreview()">随机预览一个</button></div>
        <hr style="border:none;border-top:1px solid #eee">
        <div class="gyx-tip"><b>自己做开场 / 改样子</b><br>
        · 改现有的：每种开场的 CSS 都放在「设置 → CSS 美化 → 示例」的「🎬 开场动画」里，点一下加进 CSS 框，改完保存，下次打开就生效。<br>
        · 加新的：写一段 HTML + CSS，或者上传别人分享的开场（.json / .html）。模板里能用 {title} {line} {sign} {date} {time} {ta} {me}。</div>
        ${mine.map((u, i) => `<div class="in-my"><b>${X.esc(u.n)}</b><span onclick="gyxIntroEdit(${i})">改</span><span onclick="gyxIntroPreview('${u.id}')">预览</span><span onclick="gyxIntroExport(${i})">导出</span><span class="del" onclick="gyxIntroDel(${i})">删</span></div>`).join('')}
        <div class="gyx-row"><button class="gyx-btn lite" onclick="gyxIntroEdit(-1)">＋ 新建一个开场</button><label class="gyx-btn lite">上传开场<input type="file" accept=".json,.html,.htm,.css,.txt" multiple style="display:none" onchange="gyxIntroUpload(this)"></label><button class="gyx-btn lite" onclick="gyxIntroExport(-1)">把某个内置的复制成我的</button></div>
        <div id="gyxInEd"></div>`);
};
// 面板上的开关、勾选、预览（之前漏了这几个，导致「▶ 预览」点了没反应）
const ALLSRC = { lib: true, custom: true, ta: true, cards: true };
window.gyxIntroSet = (k, v) => { const c = getC(); c[k] = v; setC(c); if (k === 'on') { if (v) cache(); install(); } };
window.gyxIntroPick = k => { const c = getC(), all = Object.keys(lib().styles); let s = c.styles && c.styles.length ? c.styles.filter(x => x === '__none' || all.includes(x)) : all.slice(); s = s.filter(x => x !== '__none'); s = s.includes(k) ? s.filter(x => x !== k) : s.concat(k); c.styles = s.length ? s : ['__none']; setC(c); window.gyxIntroOpen(); };
window.gyxIntroAll = v => { const c = getC(); c.styles = v ? Object.keys(lib().styles) : ['__none']; setC(c); window.gyxIntroOpen(); };
window.gyxIntroCat = k => { const c = getC(), all = Object.keys(lib().cats); let s = c.cats && c.cats.length ? c.cats.slice() : all.slice(); s = s.includes(k) ? s.filter(x => x !== k) : s.concat(k); c.cats = s.length ? s : all; setC(c); };
window.gyxIntroSrc = k => { const c = getC(); c.src = Object.assign({}, ALLSRC, c.src || {}); c.src[k] = c.src[k] === false; setC(c); };
window.gyxIntroPreview = function (id) {
    cache(); const L = relib(); if (!L) { X.toast(X.v('开场没加载出来', '预览失败了'), '刷新一下再试'); return null; }
    const c = getC(), all = Object.keys(L.styles); let pool = id && L.styles[id] ? [id] : (c.styles || []).filter(k => L.styles[k]); if (!pool.length) pool = all;
    const old = document.getElementById('gyxIntro'); if (old) old.remove();
    const ov = document.getElementById('gyxInOv'); if (ov) ov.style.visibility = 'hidden';
    const r = L.play(X.pick(pool));
    const back = () => { if (document.getElementById('gyxIntro')) return setTimeout(back, 300); if (ov) ov.style.visibility = ''; }; setTimeout(back, 400);
    return r;
};
const TPL = { n: '我的开场', html: '<div class="bg"></div>\n<div class="box">\n  <div class="t">{title}</div>\n  <div class="s">{line}</div>\n  <div class="sg">{sign}</div>\n</div>', css: '.bg{position:absolute;inset:0;background:linear-gradient(160deg,#ffe3ec,#e3ecff)}\n.box{text-align:center;color:#333}\n.t{font-size:48px;letter-spacing:.2em;animation:giIn 1s both}\n.s{margin-top:12px;font-size:16px;animation:giIn 1s .5s both}\n.sg{font-size:12px;opacity:.6}' };
window.gyxIntroEdit = function (i, base) {
    const c = getC(), u = i >= 0 ? (c.custom || [])[i] : (base || TPL), box = document.getElementById('gyxInEd'); if (!box) return;
    box.innerHTML = `<div class="gyx-card"><input id="gyxInN" class="gyx-in" value="${X.esc(u.n)}" placeholder="名字">
        <div class="gyx-tip">HTML（{title} 大标题、{line} 那句话、{sign} 落款、{date} 日期、{time} 时间、{ta} TA 的名字、{me} 你的名字）</div><textarea id="gyxInH" class="gyx-in in-code" rows="7">${X.esc(u.html)}</textarea>
        <div class="gyx-tip">CSS（直接写 .bg / .t 这样的类名就行，会自动只作用在这个开场里；能用内置动画 giIn / giUp / giPop / giDrop / giTw / giBreath）</div><textarea id="gyxInC" class="gyx-in in-code" rows="9">${X.esc(u.css)}</textarea>
        <div class="gyx-row"><button class="gyx-btn" onclick="gyxIntroSaveMy(${i})">保存</button><button class="gyx-btn lite" onclick="gyxIntroTry()">先预览</button></div></div>`;
    box.scrollIntoView({ block: 'nearest' });
};
const readEd = () => ({ n: (document.getElementById('gyxInN') || {}).value || '我的开场', html: (document.getElementById('gyxInH') || {}).value || '', css: (document.getElementById('gyxInC') || {}).value || '' });
window.gyxIntroTry = function () { const c = getC(), u = readEd(); c.custom = (c.custom || []).filter(x => x.id !== 'u_try').concat([Object.assign({ id: 'u_try' }, u)]); setC(c); relib(); window.gyxIntroPreview('u_try'); c.custom = c.custom.filter(x => x.id !== 'u_try'); setC(c); };
window.gyxIntroSaveMy = function (i) {
    const c = getC(), u = readEd(); c.custom = c.custom || [];
    if (i >= 0) c.custom[i] = Object.assign(c.custom[i], u); else { const it = Object.assign({ id: 'u_' + Date.now().toString(36) }, u); c.custom.push(it); if (c.styles && c.styles.length) c.styles.push(it.id); }
    setC(c); relib(); install(); X.toast(X.v('存好了', '你的开场做好了', '已保存'), u.n); window.gyxIntroOpen();
};
window.gyxIntroDel = function (i) { const c = getC(); const u = (c.custom || [])[i]; if (!u) return; c.custom.splice(i, 1); if (c.styles) c.styles = c.styles.filter(x => x !== u.id); setC(c); relib(); install(); window.gyxIntroOpen(); };
// 导出一个自己的开场（发给别人）；-1＝把某个内置的复制一份成「我的」，方便在它基础上改
window.gyxIntroExport = function (i) {
    const c = getC(), L = lib();
    if (i < 0) {
        const ids = Object.keys(L.styles).filter(k => !/^u_/.test(k));
        const box = document.getElementById('gyxInEd'); if (!box) return;
        box.innerHTML = `<div class="gyx-card"><div class="gyx-tip">复制哪一个？</div>${ids.map(k => `<span class="gyx-chip" onclick="gyxIntroCopy('${k}')">${X.esc(L.styles[k].n)}</span>`).join('')}</div>`; return;
    }
    const u = (c.custom || [])[i]; if (!u) return;
    const txt = JSON.stringify({ gyxIntro: 1, n: u.n, html: u.html, css: u.css }, null, 1);
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = '开场-' + u.n + '.json'; a.click(); } catch (e) {}
    try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (e) {}
    X.toast(X.v('导出好了', '打包好了，也复制到剪贴板了'), u.n);
};
window.gyxIntroCopy = function (k) {
    const L = lib(), s = L.styles[k]; if (!s) return;
    // 用一句示例文案把内置样式的 HTML 画出来，占位符换回 {title} {line} {sign}
    const html = s.f({ t: '§LINE§', s: '§SIGN§' }).replace(/§LINE§/g, '{line}').replace(/§SIGN§/g, '{sign}');
    window.gyxIntroEdit(-1, { n: s.n + '（我改的）', html, css: s.c.replace(/\}/g, '}\n') });
};
window.gyxIntroUpload = function (inp) {
    const fs = [...(inp.files || [])]; inp.value = ''; if (!fs.length) return;
    let n = 0; const c = getC(); c.custom = c.custom || [];
    return Promise.all(fs.map(f => f.text().then(t => {
        let list = [];
        try { const j = JSON.parse(t); list = Array.isArray(j) ? j : [j]; } catch (e) {
            const st = (t.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || (/\.css$/i.test(f.name) ? t : '');
            const body = (t.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [])[1] || t.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<\/?(html|head|body)[^>]*>/gi, '');
            list = [{ n: f.name.replace(/\.[^.]+$/, ''), html: /\.css$/i.test(f.name) ? TPL.html : body.trim(), css: st }];
        }
        list.forEach(u => { if (u && (u.html || u.css)) { const it = { id: 'u_' + Date.now().toString(36) + (n++), n: u.n || u.name || '上传的开场', html: u.html || TPL.html, css: u.css || '' }; c.custom.push(it); if (c.styles && c.styles.length) c.styles.push(it.id); } });
    }))).then(() => { setC(c); relib(); install(); X.toast(X.v(`加了 ${n} 个开场`, `收到 ${n} 个新开场`), ''); window.gyxIntroOpen(); });
};
/* ---- 放进「设置 → CSS 美化 → 示例」：每种开场一个按钮，点一下把它的 CSS 加进 CSS 框 ---- */
const pretty = css => css.replace(/\}/g, '}\n').replace(/\{/g, ' {\n    ').replace(/;(?!\s*\})/g, ';\n    ').replace(/\n\s*\n/g, '\n').trim();
function egHook() {
    const f = window.gyCssEgRender; if (typeof f !== 'function' || f.__gyxIn) return;
    const w = function () {
        const r = f.apply(this, arguments);
        try {
            if (!X.on('gyxIntro')) return r;
            const box = document.getElementById('gyCssEg'), L = lib(); if (!box || !L) return r;
            const kw = ((document.getElementById('gyCssEgSearch') || {}).value || '').trim().toLowerCase();
            const ids = Object.keys(L.styles).filter(k => !kw || '开场动画'.includes(kw) || L.styles[k].n.toLowerCase().includes(kw));
            if (!ids.length) return r;
            const g = document.createElement('div'); g.className = 'gy-css-grp';
            g.innerHTML = `<div class="gy-css-grp-hd">🎬 开场动画（插件）</div><div class="gy-cssEg-line"><button type="button" class="gy-cssEg gyx-ineg" data-k="__base">公共动画 / 跳过按钮</button>${ids.map(k => `<button type="button" class="gy-cssEg gyx-ineg" data-k="${k}">${X.esc(L.styles[k].n)}</button>`).join('')}</div>`;
            box.appendChild(g);
        } catch (e) {}
        return r;
    };
    w.__gyxIn = true; window.gyCssEgRender = w;
}
document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.gyx-ineg'); if (!b) return;
    e.stopPropagation();
    const L = lib(), k = b.dataset.k, ta = document.getElementById('globalCSSInput'); if (!ta || !L) return;
    const code = k === '__base' ? L.base : L.cssOf(k);
    const name = k === '__base' ? '公共部分' : L.styles[k].n;
    ta.value = (ta.value && !ta.value.endsWith('\n') ? ta.value + '\n\n' : ta.value) + `/* 🎬 开场动画 · ${name}（改这里就能改这个开场的样子） */\n${pretty(code)}\n`;
    try { ta.focus(); ta.scrollTop = ta.scrollHeight; } catch (er) {}
    X.toast(X.v('已加进 CSS 框', '放进去了，改完记得保存'), name + '（改完点最底下的保存，下次打开生效）');
}, true);
// CSS 框里跟开场有关的（带 #gyxIntro 的规则、@keyframes）存一份给开场用——开场比 CSS 框加载得早
function takeCss() {
    try {
        if (typeof globalCustomCSS === 'undefined') return;
        const src = String(globalCustomCSS || ''); const out = []; let i = 0, depth = 0, start = 0;
        for (; i < src.length; i++) { const ch = src[i]; if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { const blk = src.slice(start, i + 1); const head = blk.slice(0, blk.indexOf('{')); if (/#gyxIntro/.test(head) || (/@keyframes/.test(head) && /#gyxIntro|gi[A-Z]/.test(src) && /gi[A-Z]|intro/i.test(head))) out.push(blk.replace(/\/\*[\s\S]*?\*\//g, '').trim()); start = i + 1; } } else if (depth === 0 && ch === '/' && src[i + 1] === '*') { const e2 = src.indexOf('*/', i + 2); if (e2 < 0) break; i = e2 + 1; start = i + 1; } }
        const css = out.join('\n'); const c = getC(); if (c.userCss !== css) { c.userCss = css; setC(c); }
    } catch (e) {}
}
window.gyxIntroTakeCss = takeCss;
X.css('gyxInCss', `.in-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}.in-it{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:12px;background:#f2f2f4;font-size:13px}.in-it.on{background:#1d1d1f;color:#fff}.in-it span{cursor:pointer;flex:1}.in-it b{cursor:pointer;padding:0 4px;font-weight:normal;opacity:.8}.in-it input{margin:0 6px 0 0}.in-it em{font-style:normal;font-size:11px;opacity:.7}.in-cat{margin-right:10px;font-size:13px}.in-my{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:12px;background:#f7f7f9;margin:6px 0;font-size:13.5px}.in-my b{flex:1;font-weight:500}.in-my span{color:#1d9bf0;cursor:pointer}.in-my .del{color:#e0245e}.in-code{font-family:Menlo,Consolas,monospace;font-size:12.5px;line-height:1.5}`);
X.mini({ id: 'gyxIntro', icon: '🎬', title: '开场动画合集', desc: '20 种开场样式、上百句文案随机；想用哪几种自己选，也能关掉用回原来的', onOpen: () => window.gyxIntroOpen() });
addEventListener('gyx:feat', e => { if (e.detail && e.detail.id === 'gyxIntro') install(); });
(() => { const c = getC(); if (c.on == null) { c.on = true; setC(c); } install(); cache(); lib(); egHook(); takeCss(); setInterval(() => { egHook(); takeCss(); }, 3000); setInterval(cache, 5 * 60000); })();
X.widget('gyxIntroW', { n: '开场动画', sizes: ['s'], tap: () => window.gyxIntroOpen(), r: w => X.gw(w, '🎬', '开场动画', ['换开场']) }, 'gyxIntro');
