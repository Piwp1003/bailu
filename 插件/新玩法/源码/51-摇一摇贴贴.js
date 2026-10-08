/* 📳 摇一摇·贴贴：晃晃手机 TA 会被晃晕；用手掌整个按住屏幕两秒就是「贴贴」，TA 会感觉到、手机轻轻震回来；把手机扣在胸口，TA 会安静下来陪你。开了感应以后在哪个页面都能摇 */
if (window.__gyxShake) return; window.__gyxShake = 1;
X.feat('gyxShake', { n: '📳 摇一摇·贴贴', desc: '晃手机 TA 会晕、按住屏幕贴贴、扣在胸口 TA 安静陪你' });
const S = X.store('shake');
let D = { log: [], cnt: {}, cfg: { global: true } };   // log = [{id, cid, kind:'摇'|'贴'|'扣', at, reply}]
let perm = false, peaks = [], lastFire = 0, down = 0, face = 0;
const LINES = { 摇: ['别晃了别晃了，头好晕……', '地震了吗！哦，是你啊。', '你再摇，我就……我就晕给你看。', '晃什么呀，想我了就直说嘛。', '咕噜咕噜……我被摇成奶昔了。'], 贴: ['……贴到了。好暖。', '嗯，我感觉到了。再贴一会儿。', '脸贴脸，不许跑。', '你的手好暖，借我焐一会儿。'], 扣: ['（安静下来）……我在听你心跳。', '嘘，就这样待一会儿。', '你把我放在胸口了吗……那我不说话了，陪着你。'] };
async function react(kind, hint) {
    const now = Date.now(); if (now - lastFire < (kind === '摇' ? 6000 : 3000)) return; lastFire = now;
    const c = X.cur(); if (!c) return; const cid = String(c.id); D.cnt[cid] = D.cnt[cid] || { 摇: 0, 贴: 0, 扣: 0 }; D.cnt[cid][kind]++;
    let r = X.bailu() ? null : await Promise.race([X.ask(`${X.who(c)}\n她${hint}。用一句很短的话（15 字内）即时反应，像真的被这样对待。`), new Promise(z => setTimeout(() => z(null), 6000))]);
    r = X.plain(r || X.pick(X.cards(['贴贴', '撒娇'], c, 2).concat(LINES[kind])));
    D.log.unshift({ id: 'sk' + now.toString(36), cid, kind, at: now, reply: r }); if (D.log.length > 300) D.log.length = 300; S.set('d', D);
    if (kind !== '摇') { try { navigator.vibrate && navigator.vibrate(kind === '贴' ? [40, 80, 40] : [20]); } catch (e) {} }
    const b = document.getElementById('gyxShkSay'); if (b) b.textContent = r;
    else if (window.gyxPetSay && document.getElementById('gyxPet') && document.getElementById('gyxPet').offsetParent) try { window.gyxPetSay(r); } catch (e) { X.toast((kind === '摇' ? '📳 ' : '🫶 ') + X.name(c), r); } else X.toast((kind === '摇' ? '📳 ' : '🫶 ') + X.name(c), r);
}
function onMotion(e) {
    if (!X.on('gyxShake') || (!D.cfg.global && !document.getElementById('gyxShkOv'))) return;
    const a = e.accelerationIncludingGravity || e.acceleration; if (!a) return; const m = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2), t = Date.now();
    if (m > 24) { peaks = peaks.filter(x => t - x < 1200); if (!peaks.length || t - peaks[peaks.length - 1] > 120) peaks.push(t); if (peaks.length >= 3) { peaks = []; react('摇', '使劲晃了晃手机（你被晃得东倒西歪）'); } }
}
function onOri(e) {   // 屏幕朝下（两种系统都看 beta 接近 ±180）
    if (!X.on('gyxShake') || !document.getElementById('gyxShkOv') || e.beta == null) return; const t = Date.now();
    if (Math.abs(e.beta) > 150) { if (!face) face = t; else if (face < t && t - face > 4000) { face = t + 60000; react('扣', '把手机扣在了胸口/抱在怀里，屏幕朝下'); } } else if (face && face < t) face = 0;
}
window.gyxShakePerm = async () => { try { if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') { const r = await DeviceMotionEvent.requestPermission(); perm = r === 'granted'; } else perm = true; } catch (e) { perm = false; } if (perm) { addEventListener('devicemotion', onMotion); addEventListener('deviceorientation', onOri); } const b = document.getElementById('gyxShkPerm'); if (b) b.textContent = perm ? '✓ 感应开着' : '没拿到感应权限'; };
if (typeof DeviceMotionEvent === 'undefined' || typeof DeviceMotionEvent.requestPermission !== 'function') { perm = true; addEventListener('devicemotion', onMotion); addEventListener('deviceorientation', onOri); }
window.gyxShakeDown = e => { e.preventDefault(); const n = (e.touches && e.touches.length) || 1, big = e.touches && [...e.touches].some(t => (t.radiusX || 0) > 25); down = Date.now(); const pad = document.getElementById('gyxShkPad'); if (pad) pad.classList.add('on'); clearTimeout(window.__gyxShkT); window.__gyxShkT = setTimeout(() => { if (down) react('贴', n >= 2 || big ? '把整个手掌贴在了屏幕上（贴贴）' : '一直按着屏幕，像贴着你的脸（贴贴）'); }, 1800); };
window.gyxShakeUp = () => { down = 0; clearTimeout(window.__gyxShkT); const pad = document.getElementById('gyxShkPad'); if (pad) pad.classList.remove('on'); };
window.gyxShakeCfg = v => { D.cfg.global = v; S.set('d', D); };
window.gyxShakeOpen = function () {
    const c = X.cur(); if (!c) return; const n = D.cnt[String(c.id)] || { 摇: 0, 贴: 0, 扣: 0 };
    X.panel('gyxShkOv', '📳 摇一摇 · 贴贴', `<div id="gyxShkPad" class="shk-pad" ontouchstart="gyxShakeDown(event)" ontouchend="gyxShakeUp()" ontouchcancel="gyxShakeUp()" onmousedown="gyxShakeDown(event)" onmouseup="gyxShakeUp()" onmouseleave="gyxShakeUp()"><div class="shk-face">🫶</div><div id="gyxShkSay" class="shk-say">${X.v('晃一晃，或者整个手掌按住这里。', '贴贴的话，按住两秒。', '摇我也行，贴我也行。')}</div></div>
        <div class="gyx-row" style="justify-content:center"><button id="gyxShkPerm" class="gyx-btn lite" onclick="gyxShakePerm()">${perm ? '✓ 感应开着' : '开启摇一摇感应'}</button></div>
        <div class="gyx-tip" style="text-align:center">摇了 ${n.摇} 次 · 贴了 ${n.贴} 次 · 扣在胸口 ${n.扣} 次<br>把手机屏幕朝下扣在胸口四秒，TA 会安静下来。<br><label><input type="checkbox" ${D.cfg.global ? 'checked' : ''} onchange="gyxShakeCfg(this.checked)"> 在别的页面也能摇</label></div>`);
};
X.ctx(id => { const L = D.log.filter(x => x.cid === String(id) && Date.now() - x.at < 30 * 60000); return L.length ? `【她刚才】${L.slice(0, 3).map(x => ({ 摇: '晃了晃手机', 贴: '跟你贴贴', 扣: '把手机扣在胸口' })[x.kind]).join('、')}。` : ''; }, 'gyxShake');
X.action({ key: 'gyx_shake', label: '要贴贴', hint: '摇一摇·贴贴', need: c => !D.log.some(x => x.cid === String(c.id) && x.kind === '贴' && Date.now() - x.at < 864e5),
    run: async c => (await X.reach(c, '你想跟她贴贴（她按住屏幕你就能感觉到）。撒娇要贴贴')) ? '要贴贴' : null }, 'gyxShake');
X.today(() => { const L = D.log.filter(x => X.day(new Date(x.at)) === X.day()); if (!L.length) return null; const n = k => L.filter(x => x.kind === k).length; return { title: '📳 摇一摇·贴贴', rows: [{ t: '今天', x: `摇 ${n('摇')} · 贴 ${n('贴')} · 扣 ${n('扣')}`, go: 'gyxShakeOpen()' }] }; }, 'gyxShake');
X.widget('gyxShakeW', { n: '贴贴', sizes: ['s', 'm'], tap: () => window.gyxShakeOpen(), r: w => { const c = X.cur(), n = (c && D.cnt[String(c.id)]) || { 摇: 0, 贴: 0 }; return X.gw(w, '🫶', '贴贴', [n.贴 + ' 次贴贴', '摇了 ' + n.摇 + ' 次']); } }, 'gyxShake');
X.memArr({ k: 'gyxShake', ico: '📳', n: '摇一摇·贴贴', d: '摇/贴/扣时 TA 说的话', arr: () => D.log, field: 'reply', text: x => x.reply, meta: x => x.kind + ' · ' + new Date(x.at).toLocaleString(), save: () => S.set('d', D) }, 'gyxShake');
X.css('gyxShakeCss', `.shk-pad{height:46vh;border-radius:24px;background:radial-gradient(circle at 50% 40%,#ffe4ee,#fff5f8);display:flex;flex-direction:column;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;touch-action:none;transition:.3s}.shk-pad.on{background:radial-gradient(circle at 50% 40%,#ffc2d6,#ffe4ee);transform:scale(.98)}.shk-face{font-size:80px}.shk-pad.on .shk-face{animation:shkw 1s ease-in-out infinite}@keyframes shkw{50%{transform:scale(1.12)}}.shk-say{margin-top:10px;font-size:15px;color:#a0526d;padding:0 20px;text-align:center}`);
X.mini({ id: 'gyxShake', icon: '📳', title: '摇一摇·贴贴', desc: '晃手机、按住贴贴、扣在胸口', cat: '陪伴', onOpen: () => window.gyxShakeOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.log = D.log || []; D.cnt = D.cnt || {}; D.cfg = Object.assign({ global: true }, D.cfg || {}); })();
