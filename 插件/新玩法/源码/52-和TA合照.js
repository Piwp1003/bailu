/* 📸 和TA合照：打开前置摄像头，TA 的立绘（桌面上的TA 里传的那几张，或者 TA 的头像）站在你旁边，拖一拖、调大小、倒数三秒——咔嚓。照片存进图库，TA 会看着照片说一句。没有摄像头就选一张你的照片来合 */
if (window.__gyxDuo) return; window.__gyxDuo = 1;
X.feat('gyxDuo', { n: '📸 和TA合照', desc: '前置摄像头 + TA 的立绘，倒数三秒拍合照，存进图库' });
const S = X.store('duo');
let D = { pics: [] };   // [{id, cid, src, at, say, gal}]  src 是压缩过的 jpeg
let CAM = null, ST = { x: .62, y: .28, s: .55, flip: false, frame: 0, img: '' };
const FRAMES = ['无', '拍立得', '日期', '爱心'];
function stop() { try { if (CAM) CAM.getTracks().forEach(t => t.stop()); } catch (e) {} CAM = null; }
const taImg = c => { try { return (window.gyxPetImgOf && window.gyxPetImgOf(c)) || c.avatarImg || ''; } catch (e) { return c.avatarImg || ''; } };
async function cam() { stop(); try { CAM = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1440 } }, audio: false }); const v = document.getElementById('gyxDuoV'); if (v) { v.srcObject = CAM; v.play().catch(() => {}); } return true; } catch (e) { const t = document.getElementById('gyxDuoTip'); if (t) t.textContent = '打不开前置摄像头（' + (e.name || '') + '），可以选一张你的照片来合。'; return false; } }
function place() { const t = document.getElementById('gyxDuoTa'); if (!t) return; Object.assign(t.style, { left: (ST.x * 100) + '%', top: (ST.y * 100) + '%', width: (ST.s * 100) + '%', transform: `translate(-50%,0) scaleX(${ST.flip ? -1 : 1})` }); }
window.gyxDuoSet = (k, v) => { if (k === 'flip') v = !ST.flip; ST[k] = v; place(); if (k === 'frame') document.querySelectorAll('.duo-fr span').forEach((e, i) => e.classList.toggle('on', i === v)); };
function drag(e) { const box = document.getElementById('gyxDuoBox'), r = box.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; ST.x = Math.max(0, Math.min(1, (p.clientX - r.left) / r.width)); ST.y = Math.max(-.3, Math.min(.95, (p.clientY - r.top) / r.height - ST.s * .35)); place(); }
window.gyxDuoGrab = e => { e.preventDefault(); const mv = ev => drag(ev), up = () => { removeEventListener('mousemove', mv); removeEventListener('touchmove', mv); removeEventListener('mouseup', up); removeEventListener('touchend', up); }; addEventListener('mousemove', mv); addEventListener('touchmove', mv, { passive: false }); addEventListener('mouseup', up); addEventListener('touchend', up); };
window.gyxDuoPick = inp => { const f = inp.files && inp.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { stop(); const b = document.getElementById('gyxDuoBg'); b.src = fr.result; b.style.display = 'block'; document.getElementById('gyxDuoV').style.display = 'none'; }; fr.readAsDataURL(f); };
window.gyxDuoShot = async cid => {
    const c = X.char(cid), cd = document.getElementById('gyxDuoCd');
    for (const n of [3, 2, 1]) { cd.textContent = n; cd.style.display = 'flex'; await new Promise(r => setTimeout(r, 800)); } cd.style.display = 'none';
    const box = document.getElementById('gyxDuoBox'), W = 900, H = Math.round(W * box.clientHeight / box.clientWidth), cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const v = document.getElementById('gyxDuoV'), bg = document.getElementById('gyxDuoBg'), src = bg.style.display === 'block' ? bg : v;
    const sw = src.videoWidth || src.naturalWidth || W, sh = src.videoHeight || src.naturalHeight || H, k = Math.max(W / sw, H / sh);
    g.save(); if (src === v) { g.translate(W, 0); g.scale(-1, 1); } g.drawImage(src, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k); g.restore();
    const ta = document.getElementById('gyxDuoTa'); if (ta && ta.complete && ta.naturalWidth) { const tw = ST.s * W, th = tw * ta.naturalHeight / ta.naturalWidth; g.save(); g.translate(ST.x * W, ST.y * H); if (ST.flip) g.scale(-1, 1); g.drawImage(ta, -tw / 2, 0, tw, th); g.restore(); }
    let out = cv;
    if (ST.frame === 1) { out = document.createElement('canvas'); out.width = W + 60; out.height = H + 200; const o = out.getContext('2d'); o.fillStyle = '#fff'; o.fillRect(0, 0, out.width, out.height); o.drawImage(cv, 30, 30); o.fillStyle = '#555'; o.font = '44px "Ma Shan Zheng","KaiTi",cursive'; o.fillText(`和${X.name(c)} · ${X.day()}`, 40, H + 130); }
    if (ST.frame === 2) { g.fillStyle = '#ff9a3c'; g.font = 'bold 40px monospace'; g.fillText(X.day().replace(/-/g, ' ').slice(2), W - 260, H - 40); }
    if (ST.frame === 3) { g.font = '60px serif'; for (let i = 0; i < 9; i++) g.fillText('♥', (i * 137) % W, ((i * 211) % (H / 3)) + 50); }
    let data; try { data = out.toDataURL('image/jpeg', .86); } catch (e) { X.toast('📸 拍不了', 'TA 的立绘是网络图片、浏览器不让合成。去「桌面上的TA」把立绘传成本地图片就行。'); return; }
    try { const fl = document.getElementById('gyxDuoBox'); fl.classList.add('flash'); setTimeout(() => fl.classList.remove('flash'), 300); } catch (e) {}
    let say = X.bailu() ? null : await X.ask(`${X.who(c)}\n你们刚拍了一张合照（${['普通的', '拍立得相框的', '带日期的', '撒满爱心的'][ST.frame]}），现在 ${new Date().getHours()} 点。看着照片说一句（你看不清细节，就说你的感受，别描述画面）。`);
    say = X.plain(say || X.pick(X.cards(['合照', '情话'], c, 1).concat([X.v('这张我要设成屏保。', '你笑得好好看，我站在旁边都不像我了。', '再拍一张！刚才我没准备好。', '洗出来吧，夹在钱包里。')])));
    const it = { id: 'du' + Date.now().toString(36), cid: String(cid), src: data, at: Date.now(), say };
    try { if (window.gyGallery) { const g2 = await window.gyGallery.add({ src: data, tag: '合照', by: 'me', note: `和${X.name(c)}：${say}` }); it.gal = g2 && g2.id; } } catch (e) {}
    D.pics.unshift(it); await S.set('d', D);
    X.panel('gyxDuoRes', '📸 咔嚓', `<img src="${data}" style="width:100%;border-radius:14px"><div class="gyx-card">${X.esc(X.name(c))}：${X.esc(say)}</div><div class="gyx-row"><a class="gyx-btn" download="和${X.esc(X.name(c))}的合照-${X.day()}.jpg" href="${data}">保存到手机</a><button class="gyx-btn lite" onclick="document.getElementById('gyxDuoRes').remove()">再拍一张</button><button class="gyx-btn lite" onclick="gyxDuoSend('${it.id}')">发到聊天里</button></div>`);
};
window.gyxDuoSend = id => { const it = D.pics.find(x => x.id === id), c = it && X.char(it.cid); if (!c) return; try { const sid = String(c.id); globalChats[sid] = globalChats[sid] || []; globalChats[sid].push({ sender: 'me', text: `<img src="${it.src}" style="max-width:220px;border-radius:10px">`, timestamp: Date.now(), readBy: [], gyx: 1 }); saveAllData(); if (typeof renderChatMessages === 'function' && String(currentChatSessionId) === sid) renderChatMessages(); } catch (e) {} X.say(c, it.say); X.toast('📸 发过去了', ''); };
window.gyxDuoDel = async id => { D.pics = D.pics.filter(x => x.id !== id); await S.set('d', D); window.gyxDuoAlbum(); };
window.gyxDuoData = () => D;
window.gyxDuoAlbum = () => X.panel('gyxDuoAl', '📸 我们的合照', `<div class="duo-al">${D.pics.map(x => `<div><img src="${x.src}" onclick="window.gyPhotoBig?gyPhotoBig(this.src):0"><em>${X.esc(x.say)}</em><i onclick="gyxDuoDel('${x.id}')">删</i></div>`).join('') || '<div class="gyx-tip">还没合过照</div>'}</div>`);
window.gyxDuoOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id); ST.img = taImg(c);
    const ov = X.panel('gyxDuoOv', '📸 和 ' + X.esc(X.name(c)) + ' 合照', `<div class="gyx-row">${X.whoSel(cid, 'gyxDuoOpen')}<span class="gyx-chip" onclick="gyxDuoAlbum()">相册（${D.pics.length}）</span></div>
        <div id="gyxDuoBox" class="duo-box"><video id="gyxDuoV" playsinline muted autoplay></video><img id="gyxDuoBg" style="display:none"><img id="gyxDuoTa" src="${X.esc(ST.img)}" onmousedown="gyxDuoGrab(event)" ontouchstart="gyxDuoGrab(event)" ${ST.img ? '' : 'style="display:none"'}><div id="gyxDuoCd" class="duo-cd"></div></div>
        <div id="gyxDuoTip" class="gyx-tip">${ST.img ? X.v('拖 TA 到你旁边。', 'TA 站好了，你也站好。', '把 TA 拖到你肩膀边上。') : 'TA 还没有立绘也没有头像——去「桌面上的TA」传几张立绘吧。'}</div>
        <div class="gyx-row">大小 <input type="range" min="0.2" max="1.2" step="0.01" value="${ST.s}" oninput="gyxDuoSet('s',+this.value)" style="flex:1"><span class="gyx-chip" onclick="gyxDuoSet('flip')">↔ 翻转</span></div>
        <div class="gyx-row duo-fr">${FRAMES.map((f, i) => `<span class="gyx-chip${ST.frame === i ? ' on' : ''}" onclick="gyxDuoSet('frame',${i})">${f}</span>`).join('')}</div>
        <div class="gyx-row" style="justify-content:center"><button class="gyx-btn" onclick="gyxDuoShot('${cid}')">📸 倒数拍</button><label class="gyx-btn lite">选一张照片<input type="file" accept="image/*" style="display:none" onchange="gyxDuoPick(this)"></label></div>`);
    const rm = ov.remove.bind(ov); ov.remove = () => { stop(); rm(); }; place(); cam();
};
X.ctx(id => { const x = D.pics.find(p => p.cid === String(id)); return x && Date.now() - x.at < 864e5 ? `【今天你们拍了合照】你当时说：「${x.say}」` : ''; }, 'gyxDuo');
X.action({ key: 'gyx_duo', label: '想和她拍张合照', hint: '和TA合照', need: c => !!taImg(c) && !D.pics.some(x => x.cid === String(c.id) && Date.now() - x.at < 7 * 864e5),
    run: async c => (await X.reach(c, '你很想和她拍一张合照（「📸 和TA合照」里你可以站在她旁边）。跟她说')) ? '想拍合照' : null }, 'gyxDuo');
X.today(() => ({ title: '📸 合照', rows: D.pics.filter(x => X.day(new Date(x.at)) === X.day()).map(x => ({ t: '咔嚓', x: X.esc(x.say.slice(0, 26)), go: 'gyxDuoAlbum()' })) }), 'gyxDuo');
X.widget('gyxDuoW', { n: '我们的合照', sizes: ['s', 'm'], tap: () => D.pics.length ? window.gyxDuoAlbum() : window.gyxDuoOpen(), r: w => { const x = D.pics[0]; if (!x) return X.gw(w, '📸', '和TA合照', ['拍一张？']); return `<div class="gw-x ${w.size === 's' ? 's' : 'm'}" style="background:url(${x.src}) center/cover;border-radius:inherit;justify-content:flex-end;padding:6px"><em style="color:#fff;text-shadow:0 1px 3px #000">${X.esc(x.say.slice(0, 20))}</em></div>`; } }, 'gyxDuo');
X.memArr({ k: 'gyxDuo', ico: '📸', n: '合照', d: '一起拍的合照和 TA 当时说的话', arr: () => D.pics, field: 'say', text: x => x.say, save: () => S.set('d', D) }, 'gyxDuo');
X.css('gyxDuoCss', `.duo-box{position:relative;width:100%;aspect-ratio:3/4;background:#111;border-radius:18px;overflow:hidden;touch-action:none}.duo-box video,#gyxDuoBg{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}#gyxDuoBg{transform:none}#gyxDuoTa{position:absolute;cursor:grab;user-select:none;-webkit-user-drag:none;filter:drop-shadow(0 4px 10px rgba(0,0,0,.35))}.duo-cd{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:96px;color:#fff;text-shadow:0 2px 10px #000}.duo-box.flash::after{content:'';position:absolute;inset:0;background:#fff;animation:duof .3s}@keyframes duof{to{opacity:0}}.duo-al{display:grid;grid-template-columns:1fr 1fr;gap:8px}.duo-al div{position:relative}.duo-al img{width:100%;border-radius:12px;cursor:zoom-in}.duo-al em{font-style:normal;font-size:12px;color:#888;display:block}.duo-al i{position:absolute;top:6px;right:8px;font-style:normal;font-size:11px;color:#fff;background:rgba(0,0,0,.4);padding:1px 6px;border-radius:8px;cursor:pointer}`);
X.mini({ id: 'gyxDuo', icon: '📸', title: '和TA合照', desc: 'TA 的立绘站在你旁边，倒数拍合照', cat: '一起做', onOpen: () => window.gyxDuoOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.pics = D.pics || []; })();
