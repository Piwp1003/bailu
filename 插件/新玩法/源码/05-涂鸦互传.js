/* 🎨 涂鸦互传：你在画板上画一笔发过去；TA 会回一张自己画的简笔画；还能拿任何一张接着画 */
if (window.__gyxDoodle) return; window.__gyxDoodle = 1;
X.feat('gyxDoodle', { n: '🎨 涂鸦互传', desc: '画一张发给 TA，TA 也会回你一张自己画的；能在同一张上接着画' });
const S = X.store('doodle');
let G = [];   // 画廊 [{id, src, by:'me'|cid, cid, title, at}]
let BG = null, WHO = '';
const COLORS = ['#1d1d1f', '#e5484d', '#f76b15', '#ffc53d', '#30a46c', '#0090ff', '#8e4ec6', '#ff8fb1', '#ffffff'];
let pen = { c: '#1d1d1f', w: 4, erase: false }, strokes = [];
function cv() { return document.getElementById('gyxDwCv'); }
function redraw() {
    const c = cv(); if (!c) return; const g = c.getContext('2d');
    g.fillStyle = '#fffdf8'; g.fillRect(0, 0, c.width, c.height);
    const done = () => strokes.forEach(s => { g.globalCompositeOperation = 'source-over'; g.strokeStyle = s.erase ? '#fffdf8' : s.c; g.lineWidth = s.w; g.lineCap = g.lineJoin = 'round'; g.beginPath(); s.p.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); if (s.p.length === 1) g.lineTo(s.p[0][0] + .1, s.p[0][1]); g.stroke(); });
    if (BG) { const im = new Image(); im.onload = () => { g.drawImage(im, 0, 0, c.width, c.height); done(); }; im.src = BG; } else done();
}
function bind() {
    const c = cv(); if (!c || c.__b) return; c.__b = 1;
    const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
    let cur = null;
    c.addEventListener('pointerdown', e => { e.preventDefault(); cur = { c: pen.c, w: pen.w * (pen.erase ? 3 : 1), erase: pen.erase, p: [pt(e)] }; strokes.push(cur); try { c.setPointerCapture(e.pointerId); } catch (er) {} redraw(); });
    c.addEventListener('pointermove', e => { if (!cur) return; cur.p.push(pt(e)); redraw(); });
    const up = () => { cur = null; }; c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
}
window.gyxDoodleOpen = function (bgId) {
    const cs = X.chars(); if (!WHO) WHO = String((X.cur() || {}).id || '');
    const src = bgId && (G.find(x => x.id === bgId) || {}).src; BG = src || null; strokes = [];
    X.panel('gyxDwOv', '🎨 涂鸦互传', `
        <div class="gyx-row">画给：${X.whoSel(WHO, 'gyxDoodleWho')}</div>
        <canvas id="gyxDwCv" width="720" height="720"></canvas>
        <div class="dw-tools">${COLORS.map(k => `<i style="background:${k}" class="${pen.c === k && !pen.erase ? 'on' : ''}" onclick="gyxDoodlePen('c','${k}')"></i>`).join('')}
            <input type="range" min="1" max="40" value="${pen.w}" oninput="gyxDoodlePen('w',+this.value)">
            <span class="gyx-chip ${pen.erase ? 'on' : ''}" onclick="gyxDoodlePen('erase',${!pen.erase})">橡皮</span><span class="gyx-chip" onclick="gyxDoodleUndo()">撤销</span><span class="gyx-chip" onclick="gyxDoodleClear()">清空</span></div>
        <input id="gyxDwCap" class="gyx-in" placeholder="画的是什么（可空，TA 看图有时会看岔）">
        <div class="gyx-row"><button class="gyx-btn" onclick="gyxDoodleSend()">发给 TA</button><button class="gyx-btn lite" onclick="gyxDoodleAsk()">让 TA 画一张给我</button></div>
        <div class="gyx-tip">点下面任意一张可以「接着画」——在 TA 画的上面添几笔再发回去。</div>
        <div class="dw-gal">${G.slice(0, 24).map(x => `<div onclick="gyxDoodleOpen('${x.id}')"><img src="${x.src}"><span>${x.by === 'me' ? '我' : X.esc(X.name(X.char(x.cid)))}${x.title ? '·' + X.esc(x.title) : ''}</span></div>`).join('')}</div>`);
    bind(); redraw();
};
window.gyxDoodleWho = v => { WHO = String(v); };
window.gyxDoodlePen = (k, v) => { pen[k] = v; if (k === 'c') pen.erase = false; document.querySelectorAll('#gyxDwOv .dw-tools i').forEach(i => i.classList.toggle('on', !pen.erase && i.style.background.replace(/\s/g, '') === hexRgb(pen.c))); document.querySelectorAll('#gyxDwOv .dw-tools .gyx-chip')[0].classList.toggle('on', pen.erase); };
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16},${(n >> 8) & 255},${n & 255})`; };
window.gyxDoodleUndo = () => { strokes.pop(); redraw(); };
window.gyxDoodleClear = () => { strokes = []; BG = null; redraw(); };
function push(src, by, cid, title) { const it = { id: 'dw' + Date.now() + Math.random().toString(36).slice(2, 5), src, by, cid: String(cid), title: title || '', at: Date.now() }; G.unshift(it); S.set('g', G); return it; }
window.gyxDoodleSend = async function () {
    const c = X.char(WHO) || X.cur(); const k = cv(); if (!c || !k) return;
    if (!strokes.length && !BG) { X.toast('还没画呢'); return; }
    const src = k.toDataURL('image/png'), cap = ((document.getElementById('gyxDwCap') || {}).value || '').trim();
    push(src, 'me', c.id, cap);
    const sid = String(c.id); if (!globalChats[sid]) globalChats[sid] = [];
    const text = `[涂鸦] ${BG ? '在你画的那张上接着画了几笔' : '给你画了一张画'}${cap ? '：' + cap : ''}`;
    globalChats[sid].push({ sender: 'me', text, mediaUrl: src, timestamp: Date.now(), readBy: [] });
    try { saveAllData(); } catch (e) {}
    const ov = document.getElementById('gyxDwOv'); if (ov) ov.remove();
    try { switchMainView('chat'); switchChatSession(sid); } catch (e) {}
    try { if (typeof triggerAIBatchReply === 'function') triggerAIBatchReply(sid, text); } catch (e) {}
    // TA 看了你的画，有时也回一张
    if (Math.random() < 0.5 || window.__gyxDoodleAlways) setTimeout(() => window.gyxDoodleAsk(c.id, cap || '她刚画给你的画'), window.__gyxDoodleAlways ? 10 : 8000 + Math.random() * 20000);
};
/* ---- TA 画画：谷雨让模型画 SVG 简笔画；白露从一套手画风的小图里挑 ---- */
function clean(svg) {
    try {
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml'); const root = doc.documentElement; if (!root || root.nodeName !== 'svg') return null;
        root.querySelectorAll('script,foreignObject,iframe,image,use,a').forEach(n => n.remove());
        root.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => { if (/^on/i.test(a.name) || /href/i.test(a.name)) n.removeAttribute(a.name); }));
        if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', '0 0 200 200');
        root.setAttribute('width', '360'); root.setAttribute('height', '360'); root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const bg = doc.createElementNS('http://www.w3.org/2000/svg', 'rect'); const vb = root.getAttribute('viewBox').split(/[\s,]+/).map(Number);
        bg.setAttribute('x', vb[0]); bg.setAttribute('y', vb[1]); bg.setAttribute('width', vb[2]); bg.setAttribute('height', vb[3]); bg.setAttribute('fill', '#fffdf8'); root.insertBefore(bg, root.firstChild);
        const s = new XMLSerializer().serializeToString(root);
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s)));
    } catch (e) { return null; }
}
const LIB = {
    '爱心': 'M100 160 C 40 120, 20 80, 50 55 C 72 38, 95 50, 100 70 C 105 50, 128 38, 150 55 C 180 80, 160 120, 100 160 Z',
    '小猫': 'M60 80 L55 40 L85 62 Q100 58 115 62 L145 40 L140 80 Q160 110 140 140 Q100 170 60 140 Q40 110 60 80 Z M80 100 l0 6 M120 100 l0 6 M92 122 q8 8 16 0 M60 118 l-25 -4 M60 126 l-25 4 M140 118 l25 -4 M140 126 l25 4',
    '太阳': 'M100 70 a30 30 0 1 0 0.1 0 Z M100 20 l0 25 M100 155 l0 25 M20 100 l25 0 M155 100 l25 0 M43 43 l18 18 M139 139 l18 18 M43 157 l18 -18 M139 61 l18 -18',
    '月亮': 'M125 35 C 70 40, 50 100, 80 140 C 100 165, 140 170, 165 150 C 110 150, 85 90, 125 35 Z M50 50 l0 10 M45 55 l10 0 M160 70 l0 8 M156 74 l8 0',
    '花': 'M100 100 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 M100 88 q-20 -40 0 -50 q20 10 0 50 M112 100 q40 -20 50 0 q-10 20 -50 0 M100 112 q20 40 0 50 q-20 -10 0 -50 M88 100 q-40 20 -50 0 q10 -20 50 0 M100 150 L100 190 M100 175 q20 -15 30 -5',
    '星星': 'M100 25 L118 78 L175 78 L129 110 L147 165 L100 132 L53 165 L71 110 L25 78 L82 78 Z',
    '云和雨': 'M50 110 q-25 0 -25 -22 q0 -22 25 -22 q5 -30 40 -30 q30 0 40 25 q35 -5 40 25 q0 24 -30 24 Z M60 130 l-8 20 M95 130 l-8 20 M130 130 l-8 20 M78 160 l-6 15 M113 160 l-6 15',
    '笑脸': 'M100 30 a70 70 0 1 0 0.1 0 Z M75 80 l0 12 M125 80 l0 12 M65 115 q35 40 70 0',
    '小房子': 'M40 100 L100 45 L160 100 M55 88 L55 165 L145 165 L145 88 M85 165 L85 125 L115 125 L115 165 M120 70 L120 45 L135 45 L135 84',
    '小鱼': 'M40 100 q50 -50 100 0 q-50 50 -100 0 Z M140 100 l30 -25 l0 50 Z M70 95 l0 4 M95 80 q6 20 0 40',
    '我们': 'M60 70 a18 18 0 1 0 0.1 0 Z M140 70 a18 18 0 1 0 0.1 0 Z M60 105 l0 50 M140 105 l0 50 M60 120 L100 130 L140 120 M60 155 l-12 30 M60 155 l12 30 M140 155 l-12 30 M140 155 l12 30 M92 40 q8 -10 16 0 q8 10 -8 20 q-16 -10 -8 -20'
};
function libSvg(name) {
    const d = LIB[name] || LIB['爱心'], col = X.pick(['#e5484d', '#0090ff', '#8e4ec6', '#30a46c', '#f76b15', '#1d1d1f']);
    return `<svg viewBox="0 0 200 200"><defs><filter id="w"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="${Math.floor(Math.random() * 99)}"/><feDisplacementMap in="SourceGraphic" scale="4"/></filter></defs><path d="${d}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#w)"/></svg>`;
}
async function taDraw(c, about) {
    if (X.bailu()) { const n = X.pick(Object.keys(LIB)); return { svg: libSvg(n), title: n, say: X.cards(['涂鸦', '聊天'], c, 1)[0] || '画得不好，别笑我。' }; }
    const r = await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 10)}\n\n${about ? '她刚给你画了一张：' + about + '。你想回她一张画。' : '你想随手画一张小画给她。'}用 SVG 画一张简笔画（像手机上用手指随手画的：几根线条，歪歪扭扭，可以有一两个颜色，可以写一两个字）。\n要求：viewBox="0 0 200 200"；只用 path / circle / ellipse / line / polyline / polygon / rect / text；线条为主（fill 多用 none）；不要 script、不要图片。\n只输出 JSON：{"title":"画的是什么","say":"发画时顺口说的一句话","svg":"<svg ...>...</svg>"}`);
    const j = X.json(r); if (j && j.svg) return j;
    const m = r && r.match(/<svg[\s\S]*<\/svg>/); if (m) return { svg: m[0], title: '', say: '' };
    const n = X.pick(Object.keys(LIB)); return { svg: libSvg(n), title: n, say: '' };
}
window.gyxDoodleAsk = async function (who, about) {
    const c = X.char(who || WHO) || X.cur(); if (!c) return null;
    const b = document.querySelector('#gyxDwOv .gyx-btn.lite'); if (b) { b.disabled = true; b.textContent = 'TA 在画……'; }
    const j = await taDraw(c, about); const src = clean(j.svg) || clean(libSvg('爱心'));
    const it = push(src, c.id, c.id, j.title);
    if (j.say) X.say(c, X.plain(j.say));
    X.say(c, `[涂鸦] 画了${j.title ? '：' + X.plain(j.title) : '一张画'}`, { mediaUrl: src });
    const ov = document.getElementById('gyxDwOv'); if (ov) window.gyxDoodleOpen();
    return it;
};
X.action({ key: 'gyx_doodle', label: '随手画一张小画发给她', hint: '简笔画、涂鸦', need: () => true, run: async c => (await window.gyxDoodleAsk(c.id)) ? '给你画了一张画' : null }, 'gyxDoodle');
X.css('gyxDwCss', `
#gyxDwCv{width:100%;aspect-ratio:1;border-radius:18px;background:#fffdf8;box-shadow:inset 0 0 0 1px #eee;touch-action:none;cursor:crosshair;display:block}
.dw-tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:10px 0}.dw-tools i{width:22px;height:22px;border-radius:50%;cursor:pointer;box-shadow:0 0 0 1px rgba(0,0,0,.12)}.dw-tools i.on{box-shadow:0 0 0 2px #fff,0 0 0 4px #1d1d1f}.dw-tools input{width:100px}
.dw-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px}.dw-gal div{cursor:pointer;text-align:center;font-size:11px;color:#8e8e93}.dw-gal img{width:100%;aspect-ratio:1;border-radius:12px;background:#fffdf8;box-shadow:0 0 0 1px #eee;display:block;margin-bottom:3px}
`);
X.ctx(() => '【涂鸦】聊天里开头带 [涂鸦] 的是你们互相画的画（有一张图）。', 'gyxDoodle');
X.today(() => { const L = G.filter(g => X.day(new Date(g.at)) === X.day()); return { title: '🎨 涂鸦', rows: L.length ? [{ t: L.length + ' 张', x: `今天互相画了 ${L.length} 张（你 ${L.filter(g => g.by === 'me').length} · TA ${L.filter(g => g.by !== 'me').length}）`, go: 'gyxDoodleOpen()' }] : [] }; }, 'gyxDoodle');
X.mini({ id: 'gyxDoodle', icon: '🎨', title: '涂鸦互传', desc: '画一张发给 TA，TA 也会回你一张自己画的；能在同一张上接着画', onOpen: () => window.gyxDoodleOpen() });
(async () => { G = await S.get('g', []); })();
