/* 📞 来电动画和铃声：TA 打来时有专属的来电画面（波纹、心跳、星空、模糊头像、自己的壁纸……）和铃声（几段自带的旋律，也能上传自己的），每个角色可以不一样；你打给 TA 时还有「嘟——嘟——」的等待音 */
if (window.__gyxRing) return; window.__gyxRing = 1;
X.feat('gyxRing', { n: '📞 来电动画和铃声', desc: 'TA 打来时的专属来电画面和铃声；TA 也会偷偷给自己换一套' });
const S = X.store('ring');
let D = { def: { theme: 'ripple', tone: 'soft', vol: .5 }, chars: {} };   // chars[cid]={theme,tone,wall,toneData}
const THEMES = { ripple: '波纹', heart: '心跳', stars: '星空', blur: '模糊头像', glass: '毛玻璃', sunset: '日落', wall: '自己的壁纸' };
// 自带铃声：几段原创的小旋律（音名序列）
const TONES = { soft: ['轻轻的', [76, 79, 83, 79, 76, 72, 74, 76], .28], bright: ['明亮', [72, 76, 79, 84, 79, 76, 79, 84], .2], lullaby: ['摇篮曲', [67, 72, 71, 69, 67, 64, 65, 67], .38], bubble: ['泡泡', [84, 88, 91, 88, 84, 86, 88, 84], .14], retro: ['老式电话', 'retro', 0], harp: ['竖琴', [60, 64, 67, 72, 76, 79, 84, 88], .12], none: ['静音', [], 0] };
const SUBS = ['想你了，来电…', '邀请你语音通话…', '在等你接起来…', '有话想跟你说…', '想听听你的声音…', '正在呼叫你…'];
let AC = null, LOOP = null, SRC = null;
function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
function playTone(key, vol, data) {
    stopTone(); vol = vol == null ? .5 : vol;
    if (data) { try { SRC = new Audio(data); SRC.loop = true; SRC.volume = vol; SRC.play().catch(() => {}); } catch (e) {} return; }
    const t = TONES[key] || TONES.soft; if (!t[1] || !t[1].length) return;
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const once = () => {
        const a = AC, now = a.currentTime;
        if (t[1] === 'retro') { for (let r = 0; r < 2; r++) { const o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain(); o.frequency.value = 440; o2.frequency.value = 480; o.connect(g); o2.connect(g); g.connect(a.destination); const s = now + r * .5; g.gain.setValueAtTime(.001, s); g.gain.linearRampToValueAtTime(.12 * vol, s + .02); g.gain.setValueAtTime(.12 * vol, s + .38); g.gain.linearRampToValueAtTime(.001, s + .4); o.start(s); o2.start(s); o.stop(s + .41); o2.stop(s + .41); } return 2600; }
        t[1].forEach((n, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = midi(n); o.connect(g); g.connect(a.destination); const s = now + i * t[2]; g.gain.setValueAtTime(.001, s); g.gain.exponentialRampToValueAtTime(.18 * vol, s + .02); g.gain.exponentialRampToValueAtTime(.001, s + t[2] * 2.2); o.start(s); o.stop(s + t[2] * 2.4); });
        return t[1].length * t[2] * 1000 + 900;
    };
    const go = () => { const ms = once(); LOOP = setTimeout(go, ms); }; go();
}
function stopTone() { clearTimeout(LOOP); LOOP = null; try { if (SRC) { SRC.pause(); SRC = null; } } catch (e) {} }
window.gyxRingStop = stopTone;
const cfgOf = cid => Object.assign({}, D.def, D.chars[String(cid)] || {});
function dress(cid) {
    const m = document.getElementById('gyCallIncoming'); if (!m) return; const c = X.char(cid), f = cfgOf(cid);
    Object.keys(THEMES).forEach(k => m.classList.remove('gyxr-' + k)); m.classList.add('gyxr-' + f.theme);
    let bg = m.querySelector('.gyxr-bg'); if (!bg) { bg = document.createElement('div'); bg.className = 'gyxr-bg'; m.insertBefore(bg, m.firstChild); }
    bg.innerHTML = f.theme === 'stars' ? Array.from({ length: 50 }, () => `<i style="left:${X.rnd(0, 100)}%;top:${X.rnd(0, 100)}%;animation-delay:${X.rnd(0, 3)}s"></i>`).join('') : f.theme === 'ripple' || f.theme === 'heart' ? '<b></b><b></b><b></b>' : '';
    let url = ''; if (f.theme === 'wall' && f.wall) url = f.wall; if (f.theme === 'blur') { try { const t = document.createElement('div'); t.style.cssText = 'position:fixed;left:-999px'; t.innerHTML = getAvatarHTML(c, 64); document.body.appendChild(t); const m2 = /url\(["']?(.*?)["']?\)/.exec(getComputedStyle(t.firstElementChild).backgroundImage || ''); t.remove(); if (m2) url = m2[1]; } catch (e) {} }
    bg.style.backgroundImage = url ? `url("${url}")` : '';
    const sub = document.getElementById('gyInSub'); if (sub) sub.dataset.gyx = X.pick(SUBS);
    playTone(f.tone, f.vol, f.toneData);
    // 🎁 TA 偷偷换过：这次来电才让你发现
    const sp = D.surprise && D.surprise[String(cid)];
    if (!sp) { const o = m.querySelector('.gyxr-sp'); if (o) o.remove(); }
    if (sp) { let t = m.querySelector('.gyxr-sp'); if (!t) { t = document.createElement('div'); t.className = 'gyxr-sp'; m.appendChild(t); } t.innerHTML = `✨ ${X.esc(X.name(c))} 偷偷换的${sp.line ? '：「' + X.esc(sp.line) + '」' : ''}`; const L = (D.swapLog || []).find(x => x.at === sp.at); if (L) L.found = Date.now(); delete D.surprise[String(cid)]; S.set('d', D); }
}
function hook() {
    const r = window.gyCallRing; if (typeof r !== 'function' || r.__gyx) return;
    const w = function (who) { const ok = r.apply(this, arguments); try { if (ok && X.on('gyxRing')) { const id = who && who.id != null ? who.id : who; dress(id); } } catch (e) {} return ok; };
    w.__gyx = true; window.gyCallRing = w;
    ['gyCallAccept', 'gyCallReject'].forEach(n => { const f = window[n]; if (typeof f !== 'function' || f.__gyx) return; const g = function () { stopTone(); return f.apply(this, arguments); }; g.__gyx = true; window[n] = g; });
    // 你打给 TA：等 TA 接的时候放「嘟——」
    const st = window.gyCallStart; if (typeof st === 'function' && !st.__gyx) { const g = async function (id, incoming) { if (!incoming && X.on('gyxRing') && D.def.ringback !== false) playTone('retro', D.def.vol * .6); try { return await st.apply(this, arguments); } finally { stopTone(); } }; g.__gyx = true; window.gyCallStart = g; }
    // 倒计时文字换成更像真人的
    setInterval(() => { const s = document.getElementById('gyInSub'); if (s && s.dataset.gyx && /邀请你语音通话/.test(s.innerText)) s.innerText = s.innerText.replace('邀请你语音通话…', s.dataset.gyx); }, 300);
}
window.gyxRingOpen = function (who) {
    const c = X.char(who) || X.cur(); const cid = c ? String(c.id) : ''; const f = cfgOf(cid), own = !!D.chars[cid];
    X.panel('gyxRgOv', '📞 来电动画和铃声', `<div class="gyx-row">${X.whoSel(cid, 'gyxRingOpen')}<label><input type="checkbox" ${own ? 'checked' : ''} onchange="gyxRingOwn('${cid}',this.checked)"> TA 用自己的一套（不勾＝跟默认一样）</label></div>
        <div class="gyx-tip">来电画面</div><div class="gyx-row">${Object.entries(THEMES).map(([k, n]) => `<span class="gyx-chip ${f.theme === k ? 'on' : ''}" onclick="gyxRingSet('${cid}','theme','${k}')">${n}</span>`).join('')}</div>
        ${f.theme === 'wall' ? `<label class="gyx-btn lite">上传来电壁纸<input type="file" accept="image/*" style="display:none" onchange="gyxRingFile('${cid}','wall',this)"></label>` : ''}
        <div class="gyx-tip">铃声</div><div class="gyx-row">${Object.entries(TONES).map(([k, t]) => `<span class="gyx-chip ${f.tone === k && !f.toneData ? 'on' : ''}" onclick="gyxRingSet('${cid}','tone','${k}')">${t[0]}</span>`).join('')}<label class="gyx-chip ${f.toneData ? 'on' : ''}">上传铃声<input type="file" accept="audio/*" style="display:none" onchange="gyxRingFile('${cid}','toneData',this)"></label></div>
        <div class="gyx-row">音量 <input type="range" min="0" max="1" step=".05" value="${f.vol}" onchange="gyxRingSet('${cid}','vol',+this.value)"> <label><input type="checkbox" ${D.def.ringback !== false ? 'checked' : ''} onchange="D_RB(this.checked)"> 你打给 TA 时放「嘟——」</label></div>
        <div class="gyx-row"><button class="gyx-btn" onclick="gyxRingPreview('${cid}')">预览来电</button><button class="gyx-btn lite" onclick="gyxRingStop()">停</button></div>`);
};
window.D_RB = v => { D.def.ringback = v; S.set('d', D); };
window.gyxRingOwn = async (cid, v) => { if (v) D.chars[cid] = Object.assign({}, D.def); else delete D.chars[cid]; await S.set('d', D); window.gyxRingOpen(cid); };
window.gyxRingSet = async (cid, k, v) => { const t = D.chars[cid] || D.def; t[k] = v; if (k === 'tone') delete t.toneData; await S.set('d', D); if (k === 'tone') playTone(v, t.vol); if (k !== 'vol') window.gyxRingOpen(cid); };
window.gyxRingFile = (cid, k, inp) => { const f = inp.files && inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = async () => { const t = D.chars[cid] || D.def; t[k] = r.result; await S.set('d', D); window.gyxRingOpen(cid); }; r.readAsDataURL(f); };
window.gyxRingPreview = cid => { const o = document.getElementById('gyxRgOv'); if (o) o.remove(); if (window.gyCallRing && window.gyCallRing(cid, '（预览）')) setTimeout(() => { try { window.gyCallReject(true); } catch (e) {} }, 6000); };
window.gyxRingData = () => D;
// 自主行动：TA 偷偷给自己的来电换一套（画面 + 铃声），等你下次接电话才发现
async function swap(c) {
    const cid = String(c.id), f = cfgOf(cid);
    const th = X.pick(Object.keys(THEMES).filter(k => k !== f.theme && (k !== 'wall' || f.wall))), tn = X.pick(Object.keys(TONES).filter(k => k !== f.tone && k !== 'none'));
    const line = X.bailu() ? (X.cards(['情话', '聊天'], c, 1)[0] || '') : (await X.ask(`${X.who(c)}\n你偷偷把自己打给她时的来电画面换成了「${THEMES[th]}」、铃声换成了「${TONES[tn][0]}」，她下次接你电话时才会发现。留一句话给她（15 字以内，像你会说的）。只输出这句话。`) || '');
    D.chars[cid] = Object.assign({}, f, { theme: th, tone: tn }); delete D.chars[cid].toneData;
    const at = Date.now(); D.surprise = D.surprise || {}; D.surprise[cid] = { at, line: X.plain(line).slice(0, 30) };
    D.swapLog = D.swapLog || []; D.swapLog.unshift({ id: 'rs' + at.toString(36), cid, at, theme: th, tone: tn, line: X.plain(line).slice(0, 30) }); D.swapLog = D.swapLog.slice(0, 40);
    await S.set('d', D); return th;
}
window.gyxRingSwap = id => swap(X.char(id) || X.cur());
X.action({ key: 'gyx_ring_swap', label: '偷偷给自己的来电换个画面和铃声（她下次接电话才发现）', hint: '一个小惊喜，不用告诉她', need: c => !(D.surprise || {})[String(c.id)] && !(D.swapLog || []).some(x => x.cid === String(c.id) && Date.now() - x.at < 5 * 864e5),
    run: async c => (await swap(c)) ? '偷偷换了来电画面和铃声' : null }, 'gyxRing');
X.today(() => ({ title: '📞 来电', rows: (D.swapLog || []).filter(x => x.found && X.day(new Date(x.found)) === X.day()).map(x => ({ t: X.esc(X.name(X.char(x.cid))), x: `偷偷换了来电：${THEMES[x.theme] || ''} · ${(TONES[x.tone] || [''])[0]}`, go: `gyxRingOpen('${x.cid}')` })) }), 'gyxRing');
X.widget('gyxRingW', { n: '来电', sizes: ['s', 'm'], tap: () => window.gyxRingOpen(), r: w => { const c = X.cur(), f = c ? cfgOf(c.id) : D.def; return X.gw(w, '📞', '来电', [THEMES[f.theme] || '', (TONES[f.tone] || [''])[0] + ' 铃声']); } }, 'gyxRing');
X.memArr({ k: 'gyxRing', ico: '📞', n: 'TA 偷偷换的来电', d: 'TA 换来电画面 / 铃声时留的话', arr: () => D.swapLog || [], field: 'line', text: x => (x.line || '（没留话）') + `（${THEMES[x.theme] || ''} · ${(TONES[x.tone] || [''])[0]}）`, meta: x => new Date(x.at).toLocaleString() + (x.found ? ' · 你发现了' : ' · 还没发现'), save: () => S.set('d', D) }, 'gyxRing');
X.css('gyxRgCss', `#gyCallIncoming .gyxr-bg{position:absolute;inset:0;overflow:hidden;background-size:cover;background-position:center;z-index:0;pointer-events:none}#gyCallIncoming .gyin-box{position:relative;z-index:1}
#gyCallIncoming.gyxr-ripple .gyxr-bg{background:radial-gradient(circle at 50% 35%,#4b6cb7,#182848)}#gyCallIncoming.gyxr-ripple .gyxr-bg b,#gyCallIncoming.gyxr-heart .gyxr-bg b{position:absolute;left:50%;top:32%;width:160px;height:160px;margin:-80px;border-radius:50%;border:2px solid rgba(255,255,255,.5);animation:rgR 2.4s ease-out infinite}#gyCallIncoming .gyxr-bg b:nth-child(2){animation-delay:.8s}#gyCallIncoming .gyxr-bg b:nth-child(3){animation-delay:1.6s}
#gyCallIncoming.gyxr-heart .gyxr-bg{background:radial-gradient(circle at 50% 35%,#ff6b9a,#6a1b3d)}#gyCallIncoming.gyxr-heart .gyxr-bg b{border-color:rgba(255,200,220,.6);animation:rgH 1.1s ease-in-out infinite}
#gyCallIncoming.gyxr-stars .gyxr-bg{background:radial-gradient(ellipse at 50% 30%,#2b2f4a,#05060d)}#gyCallIncoming.gyxr-stars .gyxr-bg i{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;animation:giTw 2.4s infinite}
#gyCallIncoming.gyxr-blur .gyxr-bg{filter:blur(30px) brightness(.7) saturate(1.3);transform:scale(1.2)}#gyCallIncoming.gyxr-wall .gyxr-bg{filter:brightness(.75)}
#gyCallIncoming.gyxr-glass .gyxr-bg{background:linear-gradient(135deg,#a1c4fd,#c2e9fb,#fbc2eb);filter:saturate(1.2)}#gyCallIncoming.gyxr-sunset .gyxr-bg{background:linear-gradient(180deg,#ff9a8b,#ff6a88 45%,#5f2c82)}
#gyCallIncoming .gyxr-sp{position:absolute;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2;background:rgba(255,255,255,.18);backdrop-filter:blur(8px);color:#fff;font-size:12.5px;padding:6px 12px;border-radius:999px;white-space:nowrap;max-width:90%;overflow:hidden;text-overflow:ellipsis}
#gyCallIncoming[class*="gyxr-"] .gyin-av{animation:rgPop 1.2s ease-in-out infinite}
@keyframes rgR{from{transform:scale(.6);opacity:.9}to{transform:scale(2.6);opacity:0}}@keyframes rgH{0%,100%{transform:scale(1)}15%{transform:scale(1.25)}30%{transform:scale(1)}45%{transform:scale(1.15)}}@keyframes rgPop{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}@keyframes giTw{0%,100%{opacity:.2}50%{opacity:1}}`);
X.mini({ id: 'gyxRing', icon: '📞', title: '来电动画和铃声', desc: 'TA 打来时的专属来电画面和铃声，每个人可以不一样', onOpen: () => window.gyxRingOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.def = Object.assign({ theme: 'ripple', tone: 'soft', vol: .5 }, D.def || {}); D.chars = D.chars || {}; hook(); setInterval(hook, 3000); })();
