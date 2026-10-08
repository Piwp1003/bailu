/* 🧸 桌面上的 TA：屏幕角落常驻一个小 TA，时不时冒个泡跟你说话。每个角色可以传好几张立绘，按 TA 此刻的情绪换；点一下＝理 TA 一下，TA 当场回你；双击去聊天；右键菜单里能回到项目 */
if (window.__gyxPet) return; window.__gyxPet = 1;
X.feat('gyxPet', { n: '🧸 桌面上的 TA', desc: '屏幕角落常驻一个小 TA，时不时冒个泡；点一下去聊天' });
const S = X.store('pet');
let C = { on: true, desk: false, who: '', x: null, y: null, size: 64, freq: 20, shape: 'round', img: '', per: {}, poke: true, pokeChat: true };
const MOODS = ['默认', '开心', '难过', '生气', '害羞', '困', '想你', '惊讶', '撒娇', '认真'];
const MOOD = {};   // 现在的情绪 MOOD[cid] = {m, at}
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
    e.addEventListener('contextmenu', ev => { ev.preventDefault(); menu(ev.clientX, ev.clientY); });
    e.addEventListener('dblclick', ev => { ev.preventDefault(); goChat(); });
    return e;
}
function who() { return X.char(C.who) || X.cur(); }
// ---------- 立绘：每个角色好几张，按此刻的情绪挑 ----------
const perOf = c => (c && C.per && C.per[String(c.id)]) || null;
const shapeOf = c => { const p = perOf(c); return p && p.imgs && p.imgs.length ? (p.shape || 'free') : C.shape; };
function moodNow(c) {
    if (!c) return '默认'; const cid = String(c.id), m = MOOD[cid];
    if (m && Date.now() - m.at < 20 * 60000) return m.m;
    const h = new Date().getHours(); if (h >= 1 && h < 6) return '困';
    try { const v = typeof aliveMoodValue === 'function' ? aliveMoodValue(c) : 0; if (v >= 3) return '开心'; if (v <= -4) return '生气'; if (v <= -2) return '难过'; } catch (e) {}
    try { const H = (globalChats[cid] || []).filter(x => String(x.sender) === cid).slice(-2).map(x => String(x.text || '')).join(' ');
        const K = [['开心', /哈哈|嘿嘿|开心|太好了|好耶|笑死/], ['难过', /难过|伤心|哭|委屈|唉/], ['生气', /生气|气死|哼|烦死|不理你/], ['害羞', /害羞|脸红|才没有|讨厌啦/], ['想你', /想你|想见你|好想/], ['惊讶', /什么[?？!！]|真的假的|天哪|居然/], ['撒娇', /抱抱|亲亲|要你|嘛~|嘛～/], ['困', /困|晚安|睡了|好累/]];
        for (const [k, re] of K) if (re.test(H)) return k; } catch (e) {}
    return '默认';
}
function imgOf(c) {
    const p = perOf(c);
    if (p && p.imgs && p.imgs.length) { const m = moodNow(c), L = p.imgs.filter(x => x.mood === m); const D2 = p.imgs.filter(x => x.mood === '默认'); return (X.pick(L.length ? L : D2.length ? D2 : p.imgs) || {}).src || ''; }
    return (C.imgAll && C.img) || '';   // 没传立绘的角色：用 TA 自己的头像（除非你勾了「所有人共用一张」）
}
function place() {
    const e = document.getElementById('gyxPet'); if (!e) return;
    if (C.x == null) { C.x = innerWidth - C.size - 14; C.y = Math.round(innerHeight * 0.42); }
    C.x = Math.max(0, Math.min(innerWidth - C.size, C.x)); C.y = Math.max(0, Math.min(innerHeight - C.size, C.y));
    Object.assign(e.style, { left: C.x + 'px', top: C.y + 'px', '--ps': C.size + 'px' });
    e.classList.toggle('left', C.x < innerWidth / 2);
}
function paint() {
    const e = el(); const on = C.on && X.on('gyxPet'); e.style.display = on && !(C.desk && window.gyDesk) ? '' : 'none'; if (!on) return;
    const c = who(); const a = document.getElementById('gyxPetA'), im = imgOf(c);
    a.className = 'pt-a ' + (shapeOf(c) === 'free' && im ? 'free' : '');
    if (im) a.innerHTML = `<img src="${X.esc(im)}" alt="">`;
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
window.gyxPetImgOf = c => { try { return imgOf(c) || (c && c.avatarImg) || ''; } catch (e) { return (c && c.avatarImg) || ''; } };   // 合照等插件用：这个角色此刻的立绘
function goChat() {
    const c = who(); if (!c) return;
    try { if (typeof switchMainView === 'function') switchMainView('chat'); if (typeof switchChatSession === 'function') switchChatSession(String(c.id)); } catch (er) {}
}
// 点一下＝理 TA 一下：TA 当场回你（还会换成那个情绪的立绘）
let pokeBusy = false, pokeN = 0, pokeAt = 0;
async function poke() {
    const c = who(); if (!c) return;
    const e = document.getElementById('gyxPet'); if (e) { e.classList.remove('hop'); void e.offsetWidth; e.classList.add('hop'); }
    if (!C.poke) return goChat();
    if (pokeBusy) return; pokeBusy = true;
    pokeN = Date.now() - pokeAt < 60000 ? pokeN + 1 : 1; pokeAt = Date.now();
    try {
        let say, mood;
        if (X.bailu()) { say = X.cards(['拍一拍', '桌宠', '聊天'], c, 1)[0] || X.pick(['嗯？叫我？', '在呢', '干嘛戳我～', '我在这儿']); }
        else {
            const j = X.json(await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 8) || '（还没聊）'}\n\n你是待在她屏幕角落里的小小的你。她刚刚伸手点了你一下（理了你一下）${pokeN > 1 ? `，一分钟里已经第 ${pokeN} 次了` : ''}。当场回她一句（口语，20 字以内，按你的性格和此刻的心情），再选一个你现在的情绪：${MOODS.join('/')}。\n只输出 JSON：{"say":"一句话","mood":"情绪"}`));
            say = j && j.say ? X.plain(String(j.say)).slice(0, 40) : X.pick(['嗯？叫我？', '在呢', '干嘛戳我～']); mood = j && MOODS.includes(j.mood) ? j.mood : null;
        }
        if (mood) MOOD[String(c.id)] = { m: mood, at: Date.now() };
        paint(); desk(); bubble(say); lastSay = Date.now();
        if (C.pokeChat) X.say(c, say, { gyxPoke: 1 });
        X.speak && C.voice && X.speak(c, say);
        return say;
    } finally { pokeBusy = false; }
}
window.gyxPetPoke = poke;
function tap() { poke(); }
// 右键（手机长按）菜单
function menu(x, y) {
    let m = document.getElementById('gyxPetMenu'); if (m) m.remove();
    m = document.createElement('div'); m.id = 'gyxPetMenu';
    const items = [['👆 理 TA 一下', 'gyxPetPoke()'], ['💬 去聊天', 'gyxPetGoChat()'], ['🏠 返回项目', 'gyxPetHome()'], ['🎨 立绘和设置', 'gyxPetOpen()'], ['🙈 先收起小 TA', "gyxPetSet('on',false)"]];
    m.innerHTML = items.map(([t, f]) => `<div onclick="document.getElementById('gyxPetMenu').remove();${f}">${t}</div>`).join('');
    document.body.appendChild(m);
    const r = m.getBoundingClientRect(); m.style.left = Math.min(x, innerWidth - r.width - 6) + 'px'; m.style.top = Math.min(y, innerHeight - r.height - 6) + 'px';
    setTimeout(() => addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { m.remove(); removeEventListener('pointerdown', off, true); } }, true), 0);
}
window.gyxPetGoChat = goChat;
// 返回项目：关掉盖在上面的弹窗、回到主页（桌面版：把主窗口叫出来）
window.gyxPetHome = function () {
    try { if (window.gyDesk && window.gyDesk.showMain) window.gyDesk.showMain(); } catch (e) {}
    try { if (typeof gyCloseAllOverlays === 'function') gyCloseAllOverlays(); } catch (e) {}
    try { if (document.body.classList.contains('gyphm') && typeof window.gyPmHome === 'function') window.gyPmHome(); else if (typeof switchMainView === 'function') switchMainView('home'); } catch (e) {}
};
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
let lastWho = null;
function watch() { if (!X.on('gyxPet')) return;
    const c = who();
    if (c && String(c.id) !== lastWho) { lastWho = String(c.id); MOOD[lastWho] = MOOD[lastWho]; paint(); desk(); } if (!c || !C.on || typeof globalChats === 'undefined') return;
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
        <div class="gyx-row"><span class="gyx-btn" onclick="gyxPetTalk()">让 TA 说一句</span>${C.img ? `<label><input type="checkbox" ${C.imgAll ? 'checked' : ''} onchange="gyxPetSet('imgAll',this.checked)"> 没传立绘的角色都用以前传的那张</label><span class="gyx-btn lite" onclick="gyxPetOldTo()">把以前那张给现在这个角色</span>` : ''}</div>
        <div class="gyx-tip">小 TA 跟着你现在聊天的人走：换了聊天对象，桌面上的图就换成那个人的立绘（没传就是 TA 的头像）。想固定一个人，在上面「是谁」里选。</div>
        <div class="gyx-row"><label><input type="checkbox" ${C.poke ? 'checked' : ''} onchange="gyxPetSet('poke',this.checked)"> 点一下＝理 TA（TA 当场回你）</label><label><input type="checkbox" ${C.pokeChat ? 'checked' : ''} onchange="gyxPetSet('pokeChat',this.checked)"> TA 的回应也发进聊天</label><label><input type="checkbox" ${C.voice ? 'checked' : ''} onchange="gyxPetSet('voice',this.checked)"> 用 TA 的声音念</label></div>
        <hr style="border:none;border-top:1px solid #eee">
        ${(() => { const c = X.char(window.GYX_PET_WHO || C.who) || who(); if (!c) return ''; const p = perOf(c) || { imgs: [] }; return `<div class="gyx-tip"><b>${X.esc(X.name(c))} 的立绘</b>（可以传好几张，每张标一个情绪；TA 什么心情就换哪张，没有对应的就用「默认」）　看谁的：<select class="gyx-who" onchange="GYX_PET_WHO=this.value;gyxPetOpen()">${cs.map(x => `<option value="${X.esc(x.id)}"${String(x.id) === String(c.id) ? ' selected' : ''}>${X.esc(X.name(x))}</option>`).join('')}</select></div>
        <div class="pt-imgs">${p.imgs.map((x, i) => `<div class="pt-im"><img src="${X.esc(x.src)}"><select onchange="gyxPetMood('${c.id}',${i},this.value)">${MOODS.map(m => `<option${m === x.mood ? ' selected' : ''}>${m}</option>`).join('')}</select><span onclick="gyxPetDelImg('${c.id}',${i})">删</span></div>`).join('') || '<div class="gyx-tip">还没传，用的是头像。</div>'}</div>
        <div class="gyx-row"><label class="gyx-btn lite">＋ 传立绘（可以一次选好几张）<input type="file" accept="image/*" multiple style="display:none" onchange="gyxPetAddImgs('${c.id}',this)"></label>${p.imgs.length ? `<span class="gyx-chip ${p.shape !== 'round' ? 'on' : ''}" onclick="gyxPetShape('${c.id}','free')">立绘（透明底）</span><span class="gyx-chip ${p.shape === 'round' ? 'on' : ''}" onclick="gyxPetShape('${c.id}','round')">圆框</span>` : ''}</div>
        <div class="gyx-tip">现在的情绪：${moodNow(c)}（看 TA 最近说的话、心情和时间；点一下理 TA 时，TA 会自己选）</div>`; })()}
        <div class="gyx-tip">点一下＝理 TA，双击去聊天，按住能拖，右键（手机长按）有菜单：理 TA / 去聊天 / 返回项目 / 立绘和设置 / 先收起。TA 发来消息时你不在聊天页，小 TA 会先冒泡告诉你；深夜会打瞌睡。</div>`);
};
window.gyxPetSet = async (k, v) => { C[k] = v; await S.set('cfg', C); paint(); desk(); if (k === 'shape' || k === 'img' || k === 'on') window.gyxPetOpen(); };
window.GYX_PET_WHO = '';
window.gyxPetOldTo = () => { const c = X.char(window.GYX_PET_WHO || C.who) || who(); if (!c || !C.img) return; perSet(String(c.id), p => p.imgs.push({ src: C.img, mood: '默认' })); };
const perSet = async (cid, f) => { C.per = C.per || {}; const p = C.per[cid] = C.per[cid] || { imgs: [], shape: 'free' }; f(p); await S.set('cfg', C); paint(); desk(); window.gyxPetOpen(); };
window.gyxPetAddImgs = (cid, inp) => { const fs = [...(inp.files || [])]; Promise.all(fs.map(f => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }))).then(L => { const guess = n => (MOODS.find(m => n.includes(m)) || '默认'); perSet(String(cid), p => L.forEach((src, i) => p.imgs.push({ src, mood: guess(fs[i].name || '') }))); }); };
window.gyxPetMood = (cid, i, m) => perSet(String(cid), p => { if (p.imgs[i]) p.imgs[i].mood = m; });
window.gyxPetDelImg = (cid, i) => perSet(String(cid), p => p.imgs.splice(i, 1));
window.gyxPetShape = (cid, v) => perSet(String(cid), p => { p.shape = v; });
window.gyxPetImg = inp => { const f = inp.files && inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => window.gyxPetSet('img', r.result); r.readAsDataURL(f); };
window.gyxPetTalk = async () => { const t = await line('busy'); bubble(t); lastSay = Date.now(); return t; };
X.action({ key: 'gyx_pet', label: '在她屏幕角落冒个泡，说句话', hint: '她在忙别的时候', need: c => C.on && (!C.who || String(C.who) === String(c.id)) && Date.now() - lastSay > 10 * 60000, run: async c => { const t = await line('busy'); if (!t) return null; bubble(t); lastSay = Date.now(); if (window.gyDesk && C.desk) try { window.gyDesk.petSay(t); } catch (e) {} return '在你屏幕角落冒了个泡：' + t; } }, 'gyxPet');
/* ---- 桌面版 exe：小 TA 真的待在电脑桌面上（关掉 / 最小化窗口也在） ---- */
function avatarSrc(c) {
    const im = imgOf(c); if (im) return im;
    if (!c) return '';
    if (c.avatarImg && /^(data:|https?:|blob:|file:)/.test(c.avatarImg)) return c.avatarImg;
    try { const t = document.createElement('div'); t.style.cssText = 'position:fixed;left:-999px;top:0'; t.innerHTML = getAvatarHTML(c, 64); document.body.appendChild(t); const bg = getComputedStyle(t.firstElementChild).backgroundImage; t.remove(); const m = /url\(["']?(.*?)["']?\)/.exec(bg || ''); if (m) return m[1]; } catch (e) {}
    return '';
}
function desk() {
    const D2 = window.gyDesk; if (!D2 || !D2.petShow) return;
    const want = C.on && C.desk && X.on('gyxPet');
    try { if (want) { const c = who(); D2.petShow({ img: avatarSrc(c), name: X.name(c), letter: (X.name(c) || 'T')[0], size: C.size, shape: shapeOf(c) === 'free' && imgOf(c) ? 'free' : 'round', x: C.dx, y: C.dy }); } else D2.petHide(); } catch (e) {}
}
window.gyxPetDesk = desk;
if (window.gyDesk && window.gyDesk.onPet) window.gyDesk.onPet(ev => {
    if (!ev) return;
    if (ev.type === 'click') tap();
    if (ev.type === 'poke') poke();
    if (ev.type === 'chat') goChat();
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
#gyxPetMenu{position:fixed;z-index:100012;min-width:150px;padding:6px;border-radius:14px;background:rgba(255,255,255,.96);backdrop-filter:blur(14px);box-shadow:0 12px 34px rgba(0,0,0,.2);font-size:14px;color:#1d1d1f}#gyxPetMenu div{padding:9px 12px;border-radius:10px;cursor:pointer}#gyxPetMenu div:hover{background:#f2f2f4}
.pt-imgs{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}.pt-im{width:92px;display:flex;flex-direction:column;gap:4px;align-items:center;padding:6px;border-radius:12px;background:#f7f7f9}.pt-im img{width:80px;height:80px;object-fit:contain}.pt-im select{width:100%;font-size:12px}.pt-im span{font-size:12px;color:#e0245e;cursor:pointer}
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
X.widget('gyxPetW', { n: '桌面上的TA', sizes: ['s', 'm'], tap: () => window.gyxPetOpen(), r: w => { const c = X.cur(); return X.gw(w, '🧸', '桌面上的TA', [c ? X.esc(X.name(c)) + ' 在桌面陪你' : '让 TA 来桌面上待着', '点一下设置 TA 待在哪']); } }, 'gyxPet');
