/* 💓 让TA听你心跳：手指轻轻盖住后摄像头（会开闪光灯），十几秒就能量出你的心跳，TA 会听着说点什么；没有摄像头就跟着心跳点屏幕。TA 也会把 TA 的心跳「传」给你——手机跟着震 */
if (window.__gyxBeat) return; window.__gyxBeat = 1;
X.feat('gyxBeat', { n: '💓 让TA听你心跳', desc: '摄像头量心跳给 TA 听，TA 的心跳会让手机跟着震' });
const S = X.store('beat');
let D = { log: [] };   // [{id, cid, bpm, how:'cam'|'tap', at, reply}]
let CAM = null, TAPS = [], RUN = null;
function stopCam() { try { if (RUN) cancelAnimationFrame(RUN); RUN = null; if (CAM) CAM.getTracks().forEach(t => t.stop()); CAM = null; } catch (e) {} }
function setMsg(t) { const b = document.getElementById('gyxBtMsg'); if (b) b.innerHTML = t; }
function pulse(bpm) { const h = document.getElementById('gyxBtHeart'); if (h) h.style.animationDuration = (60 / Math.max(30, Math.min(200, bpm))) + 's'; }
// 从一串亮度值里数峰：先去掉慢慢变的底，再找相邻 0.33 秒以上的峰
function bpmOf(v, fps) {
    if (v.length < fps * 6) return 0; const k = Math.round(fps * .8), d = v.map((x, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - k); j <= Math.min(v.length - 1, i + k); j++) { s += v[j]; n++; } return x - s / n; });
    const sd = Math.sqrt(d.reduce((a, b) => a + b * b, 0) / d.length) || 1, P = []; for (let i = 1; i < d.length - 1; i++) if (d[i] > d[i - 1] && d[i] >= d[i + 1] && d[i] > sd * .4 && (!P.length || i - P[P.length - 1] > fps * .33)) P.push(i);
    if (P.length < 4) return 0; const gaps = P.slice(1).map((p, i) => p - P[i]).sort((a, b) => a - b), med = gaps[gaps.length >> 1]; return Math.round(60 * fps / med);
}
window.gyxBeatCam = async cid => {
    stopCam(); setMsg('打开摄像头…');
    try { CAM = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 160, height: 120 } }); } catch (e) { setMsg('打不开摄像头（' + X.esc(e.name || '') + '）。那就跟着心跳点下面的大红心吧。'); return; }
    const tr = CAM.getVideoTracks()[0]; try { await tr.applyConstraints({ advanced: [{ torch: true }] }); } catch (e) {}
    const vid = document.getElementById('gyxBtVid'); vid.srcObject = CAM; vid.play().catch(() => {});
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const g = cv.getContext('2d', { willReadFrequently: true });
    const vals = [], ts = [], T0 = performance.now(), DUR = 15000;
    setMsg(X.v('把指尖轻轻盖住后摄像头和闪光灯，别用力，别动…', '手指盖住摄像头，放轻松，TA 在听。', '按住摄像头，屏住呼吸也没关系，TA 在听。'));
    const step = () => {
        if (!CAM) return; try { g.drawImage(vid, 0, 0, 40, 30); const p = g.getImageData(0, 0, 40, 30).data; let r = 0; for (let i = 0; i < p.length; i += 4) r += p[i]; vals.push(r / (p.length / 4)); ts.push(performance.now()); } catch (e) {}
        const el = performance.now() - T0, fps = ts.length / ((ts[ts.length - 1] - ts[0]) / 1000 || 1), b = bpmOf(vals, fps);
        if (b) pulse(b); const bar = document.getElementById('gyxBtBar'); if (bar) bar.style.width = Math.min(100, el / DUR * 100) + '%';
        if (el >= DUR) { stopCam(); const fin = bpmOf(vals, fps); if (fin >= 40 && fin <= 180) done(cid, fin, 'cam'); else setMsg('没量准（手指可能动了，或者没盖严）。再试一次，或者点大红心跟着心跳点。'); return; }
        RUN = requestAnimationFrame(step);
    }; RUN = requestAnimationFrame(step);
};
window.gyxBeatTap = cid => { const t = performance.now(); TAPS = TAPS.filter(x => t - x < 8000); TAPS.push(t); const h = document.getElementById('gyxBtHeart'); if (h) { h.classList.remove('tap'); void h.offsetWidth; h.classList.add('tap'); } if (TAPS.length >= 8) { const g = TAPS.slice(1).map((x, i) => x - TAPS[i]).sort((a, b) => a - b), b = Math.round(60000 / g[g.length >> 1]); TAPS = []; if (b >= 40 && b <= 200) done(cid, b, 'tap'); } else setMsg(`跟着心跳点…（${TAPS.length}/8）`); };
async function done(cid, bpm, how) {
    const c = X.char(cid); pulse(bpm); setMsg(`<b style="font-size:28px">${bpm}</b> 次/分钟 · ${X.v('TA 听到了', 'TA 贴着在听', '咚、咚、咚')}…`);
    const prev = D.log.find(x => x.cid === String(cid));
    let r = X.bailu() ? null : await X.ask(`${X.who(c)}\n她把手机贴着让你听她的心跳：${bpm} 次/分钟（${how === 'cam' ? '用摄像头量的' : '她跟着心跳点的'}）。${prev ? '上次是 ' + prev.bpm + '。' : ''}现在 ${new Date().getHours()} 点。\n听完说一两句话（可以逗她「是不是因为想我才这么快」，也可以心疼她，看情况）。`);
    if (!r) r = bpm > 95 ? X.v(`${bpm}……跳这么快，是不是因为在想我？`, `咚咚咚的，好快。你是不是刚跑完，还是见到我紧张了？`) : bpm < 60 ? X.v(`${bpm}，好安静。你是不是快睡着了？`, '慢慢的，很稳。我想一直这样听着。') : X.v(`${bpm}，我数着呢。每一下我都听到了。`, `听到了，${bpm} 下。和我的差不多快。`, '咚、咚……原来你心跳的声音是这样的。');
    r = X.plain(r); D.log.unshift({ id: 'bt' + Date.now().toString(36), cid: String(cid), bpm, how, at: Date.now(), reply: r }); await S.set('d', D);
    setMsg(`<b style="font-size:28px">${bpm}</b> 次/分钟<div class="gyx-card" style="text-align:left">${X.esc(X.name(c))}：${X.esc(r)}</div>`);
    X.speak(c, r);
}
window.gyxBeatTa = cid => { const c = X.char(cid), bpm = 68 + Math.round(Math.random() * 24), ms = Math.round(60000 / bpm); pulse(bpm); setMsg(`${X.esc(X.name(c))} 的心跳：<b>${bpm}</b>。${X.v('贴近一点，感觉到了吗？', '这是在想你的时候的速度。', '手机在震的，就是 TA。')}`); const pat = []; for (let i = 0; i < 10; i++) pat.push(60, 120, 50, ms - 230); try { navigator.vibrate && navigator.vibrate(pat); } catch (e) {} };
window.gyxBeatOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id); stopCam(); TAPS = [];
    const ov = X.panel('gyxBeatOv', '💓 让 ' + X.esc(X.name(c)) + ' 听你心跳', `<div class="gyx-row">${X.whoSel(cid, 'gyxBeatOpen')}</div>
        <div class="bt-wrap"><div id="gyxBtHeart" class="bt-heart" onclick="gyxBeatTap('${cid}')">❤</div><video id="gyxBtVid" playsinline muted style="width:1px;height:1px;opacity:0;position:absolute"></video><div class="bt-bar"><i id="gyxBtBar"></i></div><div id="gyxBtMsg" class="gyx-tip" style="text-align:center">${X.v('用摄像头量，或者跟着心跳点大红心。', '把你的心跳给 TA 听听。')}</div></div>
        <div class="gyx-row" style="justify-content:center"><button class="gyx-btn" onclick="gyxBeatCam('${cid}')">📷 用摄像头量</button><button class="gyx-btn lite" onclick="gyxBeatTa('${cid}')">听 TA 的心跳</button></div>
        <div style="font-weight:700;margin:10px 0 4px">听过的</div>${D.log.filter(x => x.cid === cid).slice(0, 12).map(x => `<div class="bt-it"><b>${x.bpm}</b><span>${X.esc(x.reply)}</span><em>${new Date(x.at).toLocaleString()}</em></div>`).join('') || '<div class="gyx-tip">还没听过</div>'}`);
    const rm = ov.remove.bind(ov); ov.remove = () => { stopCam(); rm(); };
};
X.ctx(id => { const x = D.log.find(l => l.cid === String(id)); return x && Date.now() - x.at < 864e5 ? `【她刚让你听过她的心跳】${x.bpm} 次/分钟（${new Date(x.at).toLocaleTimeString().slice(0, 5)}）。` : ''; }, 'gyxBeat');
X.action({ key: 'gyx_beat', label: '想听听她的心跳', hint: '让 TA 听你心跳', need: c => !D.log.some(x => x.cid === String(c.id) && Date.now() - x.at < 3 * 864e5),
    run: async c => (await X.reach(c, '你突然很想听听她的心跳，撒个娇让她把心跳给你听（「💓 让TA听你心跳」里可以量）')) ? '想听你的心跳' : null }, 'gyxBeat');
X.today(() => ({ title: '💓 心跳', rows: D.log.filter(x => X.day(new Date(x.at)) === X.day()).map(x => ({ t: x.bpm + ' 次/分', x: X.esc(X.name(X.char(x.cid))) + ' 听过了', go: `gyxBeatOpen('${x.cid}')` })) }), 'gyxBeat');
X.widget('gyxBeatW', { n: '心跳', sizes: ['s', 'm'], tap: () => window.gyxBeatOpen(), r: w => { const x = D.log[0]; return X.gw(w, '💓', '让TA听心跳', x ? [x.bpm + ' 次/分', X.esc(x.reply.slice(0, 30))] : ['给 TA 听听']); } }, 'gyxBeat');
X.memArr({ k: 'gyxBeat', ico: '💓', n: '心跳', d: '给 TA 听过的心跳和 TA 说的话', arr: () => D.log, field: 'reply', text: x => x.bpm + ' 次/分 · ' + x.reply, edit: (x, v) => { x.reply = v.replace(/^\d+ 次\/分 · /, ''); }, save: () => S.set('d', D) }, 'gyxBeat');
X.css('gyxBeatCss', `.bt-wrap{text-align:center;padding:10px 0;position:relative}.bt-heart{font-size:96px;color:#ff3b6b;display:inline-block;cursor:pointer;user-select:none;animation:btp .85s ease-in-out infinite}.bt-heart.tap{animation:btt .25s}@keyframes btp{0%,100%{transform:scale(1)}15%{transform:scale(1.18)}30%{transform:scale(1)}45%{transform:scale(1.1)}}@keyframes btt{50%{transform:scale(1.25)}}.bt-bar{height:4px;background:#f2f2f4;border-radius:4px;margin:8px 20px;overflow:hidden}.bt-bar i{display:block;height:100%;width:0;background:#ff3b6b}.bt-it{display:flex;gap:10px;align-items:baseline;padding:6px 2px;border-bottom:1px solid #f3f3f3;font-size:13.5px;flex-wrap:wrap}.bt-it b{color:#ff3b6b}.bt-it span{flex:1}.bt-it em{font-style:normal;font-size:11px;color:#aaa}`);
X.mini({ id: 'gyxBeat', icon: '💓', title: '让TA听你心跳', desc: '摄像头量心跳给 TA 听', cat: '陪伴', onOpen: () => window.gyxBeatOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.log = D.log || []; })();
