/* 🧸 桌面上的 TA：屏幕角落常驻一个小 TA，时不时冒个泡跟你说话；点一下就去聊天，拖着能挪位置 */
if (window.__gyxPet) return; window.__gyxPet = 1;
X.feat('gyxPet', { n: '🧸 桌面上的 TA', desc: '屏幕角落常驻一个小 TA，时不时冒个泡；点一下去聊天' });
const S = X.store('pet');
let C = { on: true, desk: false, who: '', x: null, y: null, size: 64, freq: 20, shape: 'round', img: '' };
const LINES_IDLE = ['在干嘛呀', '想你了', '累不累？', '喝口水', '我在这儿呢', '别太晚睡', '摸摸头', '今天有没有好好吃饭', '嘿', '陪着你呢'];
let lastSay = 0, busy = false;
function el() {
    let e = document.getElementById('gyxPet'); if (e) return e;
    e = document.createElement('div'); e.id = 'gyxPet';
    e.innerHTML = `<div class="pt-b" id="gyxPetB"></div><div class="pt-a" id="gyxPetA"></div><i class="pt-z">z</i>`;
    document.body.appendChild(e);
    // 拖动 / 点一下
    let d = null, moved = false;
    e.addEventListener('pointerdown', ev => { if (ev.button === 2) return; d = { x: ev.clientX - e.offsetLeft, y: ev.clientY - e.offsetTop, sx: ev.clientX, sy: ev.clientY }; moved = false; try { e.setPointerCapture(ev.pointerId); } catch (er) {} });
    e.addEventListener('pointermove', ev => { if (!d) return; if (Math.abs(ev.clientX - d.sx) + Math.abs(ev.clientY - d.sy) > 5) moved = true; if (!moved) return; C.x = Math.max(0, Math.min(innerWidth - C.size, ev.clientX - d.x)); C.y = Math.max(0, Math.min(innerHeight - C.size, ev.clientY - d.y)); place(); });
    e.addEventListener('pointerup', () => { if (!d) return; d = null; if (moved) { S.set('cfg', C); return; } tap(); });
    e.addEventListener('contextmenu', ev => { ev.preventDefault(); window.gyxPetOpen(); });
    return e;
}
function who() { return X.char(C.who) || X.cur(); }
function place() {
    const e = document.getElementById('gyxPet'); if (!e) return;
    if (C.x == null) { C.x = innerWidth - C.size - 14; C.y = Math.round(innerHeight * 0.42); }
    C.x = Math.max(0, Math.min(innerWidth - C.size, C.x)); C.y = Math.max(0, Math.min(innerHeight - C.size, C.y));
    Object.assign(e.style, { left: C.x + 'px', top: C.y + 'px', '--ps': C.size + 'px' });
    e.classList.toggle('left', C.x < innerWidth / 2);
}
function paint() {
    const e = el(); const on = C.on && X.on('gyxPet'); e.style.display = on && !(C.desk && window.gyDesk) ? '' : 'none'; if (!on) return;
    const c = who(); const a = document.getElementById('gyxPetA');
    a.className = 'pt-a ' + (C.shape === 'free' && C.img ? 'free' : '');
    if (C.img) a.innerHTML = `<img src="${X.esc(C.img)}" alt="">`;
    else { try { a.innerHTML = getAvatarHTML(c, C.size); } catch (er) { a.innerHTML = `<span>${X.esc((X.name(c) || 'T')[0])}</span>`; } }
    place();
}
function bubble(t, ms) {
    const b = document.getElementById('gyxPetB'); if (!b || !t) return;
    b.textContent = t; b.classList.add('on');
    try { if (window.gyDesk && C.desk && C.on) window.gyDesk.petSay(t); } catch (e) {}
    clearTimeout(b.__t); b.__t = setTimeout(() => b.classList.remove('on'), ms || Math.max(4000, t.length * 280));
}
window.gyxPetSay = bubble;
function tap() {
    const c = who(); if (!c) return;
    const e = document.getElementById('gyxPet'); e.classList.remove('hop'); void e.offsetWidth; e.classList.add('hop');
    try { if (typeof switchMainView === 'function') switchMainView('chat'); if (typeof switchChatSession === 'function') switchChatSession(String(c.id)); } catch (er) {}
}
// 说一句：谷雨问模型要一句短的，白露抽字卡
async function line(kind) {
    const c = who(); if (!c) return null;
    if (X.bailu()) return X.cards(['桌宠', '聊天'], c, 1)[0] || X.pick(LINES_IDLE);
    const hr = new Date().getHours();
    const t = await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 10) || '（还没聊）'}\n\n现在是 ${hr} 点。你是缩在她电脑屏幕角落里的小小的你，${kind === 'idle' ? '她好一会儿没理你了' : '她正在忙别的'}。冒个泡跟她说一句很短的话（不超过 20 个字，口语，像随口一说，别加引号和动作）。只输出这句话。`);
    return (t && X.plain(t).replace(/^["“]|["”]$/g, '').slice(0, 40)) || X.pick(LINES_IDLE);
}
async function tick() { if (!X.on('gyxPet')) return;
    if (!C.on || busy || document.hidden) return;
    const gap = Math.max(1, +C.freq || 20) * 60000;
    if (Date.now() - lastSay < gap * X.rnd(0.6, 1.4)) return;
    busy = true; lastSay = Date.now();
    try { const t = await line('idle'); if (t) bubble(t); } finally { busy = false; }
}
// TA 发来新消息：小人先冒泡
let seen = 0;
function watch() { if (!X.on('gyxPet')) return;
    const c = who(); if (!c || !C.on || typeof globalChats === 'undefined') return;
    const H = globalChats[c.id] || []; const m = H[H.length - 1];
    if (!m || m.timestamp <= seen) return; const first = !seen; seen = m.timestamp;
    if (first || m.sender === 'me' || m.sender === 'system') return;
    const onChat = typeof currentChatSessionId !== 'undefined' && String(currentChatSessionId) === String(c.id) && document.getElementById('chatInputArea') && getComputedStyle(document.getElementById('chatInputArea')).display !== 'none';
    if (!onChat) bubble('💬 ' + X.plain(m.text).replace(/^\s*语音/, '🎤').slice(0, 40));
}
// 困了：深夜打瞌睡
function sleepy() { const e = document.getElementById('gyxPet'); if (e) { const h = new Date().getHours(); e.classList.toggle('zz', h >= 1 && h < 6); } }
window.gyxPetOpen = function () {
    const cs = X.chars();
    X.panel('gyxPetOv', '🧸 桌面上的 TA', `
        <div class="gyx-row"><label><input type="checkbox" ${C.on ? 'checked' : ''} onchange="gyxPetSet('on',this.checked)"> 显示</label></div>
        <div class="gyx-row"><label><input type="checkbox" ${C.desk ? 'checked' : ''} ${window.gyDesk ? '' : 'disabled'} onchange="gyxPetSet('desk',this.checked)"> 放到电脑桌面上（关掉 / 最小化窗口也在）</label></div>
        <div class="gyx-tip">${window.gyDesk ? '桌面上的小 TA 能拖到任何地方；点一下回到聊天，右键打开这里。' : '「放到电脑桌面上」要用新版桌面版 exe（重新打包一次）。手机上小 TA 只能待在应用里。'}</div>
        <div class="gyx-row">是谁：<select class="gyx-who" onchange="gyxPetSet('who',this.value)"><option value="">跟着最近聊天的人</option>${cs.map(c => `<option value="${X.esc(c.id)}"${String(c.id) === String(C.who) ? ' selected' : ''}>${X.esc(X.name(c))}</option>`).join('')}</select></div>
        <div class="gyx-row">大小 <input type="range" min="36" max="240" value="${C.size}" oninput="gyxPetSet('size',+this.value)"> </div>
        <div class="gyx-row">多久冒一次泡（分钟） <input class="gyx-who" type="number" min="1" value="${C.freq}" style="width:80px" onchange="gyxPetSet('freq',+this.value)"></div>
        <div class="gyx-row">样子：<span class="gyx-chip ${C.shape !== 'free' ? 'on' : ''}" onclick="gyxPetSet('shape','round')">圆头像</span><span class="gyx-chip ${C.shape === 'free' ? 'on' : ''}" onclick="gyxPetSet('shape','free')">立绘（透明底 png）</span></div>
        <div class="gyx-row"><label class="gyx-btn lite">换一张图<input type="file" accept="image/*" style="display:none" onchange="gyxPetImg(this)"></label>${C.img ? '<span class="gyx-btn lite" onclick="gyxPetSet(\'img\',\'\')">用回头像</span>' : ''}<span class="gyx-btn" onclick="gyxPetTalk()">让 TA 说一句</span></div>
        <div class="gyx-tip">点小 TA 直接去聊天，按住能拖，右键（手机长按）打开这里。TA 发来消息时你不在聊天页，小 TA 会先冒泡告诉你；深夜会打瞌睡。</div>`);
};
window.gyxPetSet = async (k, v) => { C[k] = v; await S.set('cfg', C); paint(); desk(); if (k === 'shape' || k === 'img' || k === 'on') window.gyxPetOpen(); };
window.gyxPetImg = inp => { const f = inp.files && inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => window.gyxPetSet('img', r.result); r.readAsDataURL(f); };
window.gyxPetTalk = async () => { const t = await line('busy'); bubble(t); lastSay = Date.now(); return t; };
X.action({ key: 'gyx_pet', label: '在她屏幕角落冒个泡，说句话', hint: '她在忙别的时候', need: c => C.on && (!C.who || String(C.who) === String(c.id)) && Date.now() - lastSay > 10 * 60000, run: async c => { const t = await line('busy'); if (!t) return null; bubble(t); lastSay = Date.now(); if (window.gyDesk && C.desk) try { window.gyDesk.petSay(t); } catch (e) {} return '在你屏幕角落冒了个泡：' + t; } }, 'gyxPet');
/* ---- 桌面版 exe：小 TA 真的待在电脑桌面上（关掉 / 最小化窗口也在） ---- */
function avatarSrc(c) {
    if (C.img) return C.img;
    if (!c) return '';
    if (c.avatarImg && /^(data:|https?:|blob:|file:)/.test(c.avatarImg)) return c.avatarImg;
    try { const t = document.createElement('div'); t.style.cssText = 'position:fixed;left:-999px;top:0'; t.innerHTML = getAvatarHTML(c, 64); document.body.appendChild(t); const bg = getComputedStyle(t.firstElementChild).backgroundImage; t.remove(); const m = /url\(["']?(.*?)["']?\)/.exec(bg || ''); if (m) return m[1]; } catch (e) {}
    return '';
}
function desk() {
    const D2 = window.gyDesk; if (!D2 || !D2.petShow) return;
    const want = C.on && C.desk && X.on('gyxPet');
    try { if (want) { const c = who(); D2.petShow({ img: avatarSrc(c), name: X.name(c), letter: (X.name(c) || 'T')[0], size: C.size, shape: C.shape === 'free' && C.img ? 'free' : 'round', x: C.dx, y: C.dy }); } else D2.petHide(); } catch (e) {}
}
window.gyxPetDesk = desk;
if (window.gyDesk && window.gyDesk.onPet) window.gyDesk.onPet(ev => {
    if (!ev) return;
    if (ev.type === 'click') tap();
    if (ev.type === 'menu') window.gyxPetOpen();
    if (ev.type === 'moved') { C.dx = ev.x; C.dy = ev.y; S.set('cfg', C); }
});
X.css('gyxPetCss', `
#gyxPet{position:fixed;z-index:9500;width:var(--ps,64px);height:var(--ps,64px);touch-action:none;cursor:grab;user-select:none;animation:ptBob 3.2s ease-in-out infinite}
#gyxPet .pt-a{width:100%;height:100%;border-radius:50%;overflow:hidden;background:#fff;box-shadow:0 8px 22px rgba(0,0,0,.18),0 0 0 3px #fff;display:flex;align-items:center;justify-content:center;font-size:calc(var(--ps,64px)*.4);color:#555}
#gyxPet .pt-a.free{border-radius:0;background:none;box-shadow:none;overflow:visible}#gyxPet .pt-a.free img{object-fit:contain;filter:drop-shadow(0 6px 10px rgba(0,0,0,.18))}
#gyxPet .pt-a .avatar{width:100%!important;height:100%!important;border:none!important;border-radius:50%;margin:0}
#gyxPet .pt-a img{width:100%;height:100%;object-fit:cover;pointer-events:none;-webkit-user-drag:none}
#gyxPet .pt-b{position:absolute;bottom:calc(100% + 8px);right:0;max-width:220px;width:max-content;padding:8px 12px;border-radius:16px 16px 4px 16px;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);color:#1d1d1f;font-size:13px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,.14);opacity:0;transform:translateY(6px) scale(.9);transform-origin:bottom right;transition:all .35s cubic-bezier(.2,1.2,.3,1);pointer-events:none}
#gyxPet.left .pt-b{right:auto;left:0;border-radius:16px 16px 16px 4px;transform-origin:bottom left}
#gyxPet .pt-b.on{opacity:1;transform:none}
#gyxPet .pt-z{position:absolute;right:-4px;top:-10px;font-style:normal;font-weight:700;color:#8aa4d6;opacity:0}#gyxPet.zz .pt-z{animation:ptZ 2.4s infinite}#gyxPet.zz{animation:ptBob 5s ease-in-out infinite}
#gyxPet.hop{animation:ptHop .5s}
@keyframes ptBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes ptHop{0%{transform:scale(1)}30%{transform:scale(1.15,.85)}60%{transform:translateY(-10px)}100%{transform:none}}
@keyframes ptZ{0%{opacity:0;transform:translate(0,0)}40%{opacity:1}100%{opacity:0;transform:translate(10px,-16px)}}
`);
X.mini({ id: 'gyxPet', icon: '🧸', title: '桌面上的 TA', desc: '屏幕角落常驻一个小 TA，时不时冒个泡；点一下去聊天', onOpen: () => window.gyxPetOpen() });
(async () => {
    C = Object.assign(C, await S.get('cfg', {}));
    const go = () => { if (!window.__guyuBooted) return setTimeout(go, 800); paint(); desk(); lastSay = Date.now(); watch(); };
    addEventListener('gyx:feat', e => { if (e.detail && /^gyxPet/.test(e.detail.id)) { paint(); desk(); } });
    go();
    addEventListener('resize', place);
    setInterval(tick, 30000); setInterval(watch, 2000); setInterval(sleepy, 60000); setTimeout(sleepy, 3000);
})();
