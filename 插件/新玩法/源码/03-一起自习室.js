/* 📚 一起自习室：番茄钟，TA 在对面「也在忙」；开始/休息/结束 TA 都会说话，偷偷切走太久会被念 */
if (window.__gyxStudy) return; window.__gyxStudy = 1;
X.feat('gyxStudy', { n: '📚 一起自习室', desc: '番茄钟，TA 在对面也在忙；休息时催你喝水，偷偷切走会被念' });
const S = X.store('study');
let D = { focus: 25, rest: 5, rounds: 4, who: '', log: [] };
let T = null;   // { c, phase:'focus'|'rest', end, round, task, away, awayAt, nagged }
const DOING = ['看书', '写东西', '回邮件', '改稿子', '画画', '背单词', '整理资料', '写代码', '看文献', '做表'];
async function line(c, what, extra) {
    if (X.bailu()) return X.cards(['自习', '聊天'], c, 1)[0] || { start: '开始吧，我陪你。', rest: '休息一下，喝口水。', back: '回来了？继续。', done: '辛苦了，今天很棒。', away: '人呢？说好一起学的。' }[what];
    const hint = { start: `你们一起开始专注 ${D.focus} 分钟${T && T.task ? '，她要做的是：' + T.task : ''}。你也在对面忙你的事（${T && T.doing}）。说一句开始前的话。`, rest: '专注时间到了，该休息了。说一句让她休息（催她喝水、活动一下、看看远处）。', back: '休息结束了，叫她回来继续。', done: `今天一共专注了 ${extra || 0} 轮，结束了。夸夸她，说说你刚才在做什么。`, away: '说好一起专注，她偷偷切走去干别的了好一会儿。按你的性格念她一句（别太凶）。' }[what];
    const t = await X.ask(`${X.who(c)}\n${hint}\n只输出一句话（口语，不超过 40 字，不要动作描写）。`);
    return t ? X.plain(t) : null;
}
function msg(c, t) { if (!t) return; X.say(c, t); try { if (window.gyxPetSay) window.gyxPetSay(t); } catch (e) {} }
window.gyxStudyStart = async function () {
    const c = X.char(D.who) || X.cur(); if (!c) { X.toast('先有一个角色'); return; }
    const task = (document.getElementById('gyxStTask') || {}).value || '';
    T = { c, phase: 'focus', end: Date.now() + D.focus * 60000, round: 1, task, doing: X.pick(DOING), away: 0, nagged: 0, t0: Date.now() };
    paint(); mini(true);
    msg(c, await line(c, 'start'));
};
window.gyxStudyStop = async function (quiet) {
    if (!T) return; const r = T; T = null; mini(false); paint();
    const done = r.phase === 'rest' ? r.round : r.round - 1 + (r.end - Date.now() <= 0 ? 1 : 0);
    D.log.unshift({ at: r.t0, min: Math.round((Date.now() - r.t0) / 60000), rounds: done, task: r.task, cid: String(r.c.id) }); await S.set('d', D);
    if (!quiet) msg(r.c, await line(r.c, 'done', done));
};
let busy = false;
async function tick() { if (!X.on('gyxStudy')) return;
    if (!T || busy) return; busy = true;
    try { await tick0(); } finally { busy = false; }
}
async function tick0() {
    const left = T.end - Date.now();
    if (left <= 0) {
        if (T.phase === 'focus') { if (T.round >= D.rounds && D.rounds > 0) { await window.gyxStudyStop(); return; } T.phase = 'rest'; T.end = Date.now() + D.rest * 60000; ring(); msg(T.c, await line(T.c, 'rest')); }
        else { T.phase = 'focus'; T.round++; T.end = Date.now() + D.focus * 60000; T.doing = X.pick(DOING); ring(); msg(T.c, await line(T.c, 'back')); }
    }
    // 专注时切走：超过 90 秒被念（每轮最多两次）
    if (T && T.phase === 'focus' && document.hidden) { if (!T.awayAt) T.awayAt = Date.now(); else if (Date.now() - T.awayAt > 90000 && T.nagged < 2) { T.nagged++; T.awayAt = Date.now(); const t = await line(T.c, 'away'); msg(T.c, t); X.notify(T.c, `📚 ${X.name(T.c)}：${t || '人呢？'}`, '回去自习'); } }
    else if (T) T.awayAt = 0;
    paintTimer();
}
function ring() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.001, a.currentTime); g.gain.exponentialRampToValueAtTime(.2, a.currentTime + .05); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + 1.2); o.start(); o.stop(a.currentTime + 1.3); } catch (e) {} }
const mmss = ms => { ms = Math.max(0, ms); const s = Math.round(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function paintTimer() {
    const t = document.getElementById('gyxStT'), m = document.getElementById('gyxStMini');
    if (T) {
        const left = T.end - Date.now(), tot = (T.phase === 'focus' ? D.focus : D.rest) * 60000, p = 1 - left / tot;
        if (t) { t.textContent = mmss(left); const r = document.getElementById('gyxStRing'); if (r) r.style.strokeDashoffset = String(565 * (1 - Math.min(1, p))); }
        if (m) m.querySelector('b').textContent = (T.phase === 'focus' ? '📚 ' : '☕ ') + mmss(left);
    }
}
function mini(on) {
    let m = document.getElementById('gyxStMini');
    if (!on) { if (m) m.remove(); return; }
    if (!m) { m = document.createElement('div'); m.id = 'gyxStMini'; m.onclick = () => window.gyxStudyOpen(); m.innerHTML = '<b></b>'; document.body.appendChild(m); }
    paintTimer();
}
function paint() {
    const b = document.getElementById('gyxStBody'); if (!b) return;
    const c = T ? T.c : (X.char(D.who) || X.cur());
    const today = D.log.filter(l => X.day(new Date(l.at)) === X.day());
    const week = D.log.filter(l => Date.now() - l.at < 7 * 86400000).reduce((a, l) => a + l.min, 0);
    b.innerHTML = T ? `
        <div class="st-desk"><div class="st-me">你<br><small>${X.esc(T.task || '专注中')}</small></div>
        <div class="st-clock"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" class="bg"/><circle id="gyxStRing" cx="100" cy="100" r="90" class="fg ${T.phase}" style="stroke-dasharray:565;stroke-dashoffset:565"/></svg><div><b id="gyxStT">--:--</b><em>${T.phase === 'focus' ? `第 ${T.round}${D.rounds ? ' / ' + D.rounds : ''} 轮 · 专注` : '休息一下'}</em></div></div>
        <div class="st-ta">${X.esc(X.name(c))}<br><small>在${X.esc(T.doing)}</small></div></div>
        <div class="gyx-row" style="justify-content:center"><button class="gyx-btn lite" onclick="gyxStudyStop()">结束</button></div>
        <div class="gyx-tip" style="text-align:center">专注时偷偷切走太久，TA 会来念你的。</div>` : `
        <div class="gyx-row">和谁：${X.whoSel(D.who || (c || {}).id, 'gyxStudyWho')}</div>
        <input id="gyxStTask" class="gyx-in" placeholder="这次要做什么（可空）">
        <div class="gyx-row">专注 <input class="gyx-who" type="number" min="1" value="${D.focus}" style="width:70px" onchange="gyxStudySet('focus',this.value)"> 分钟 · 休息 <input class="gyx-who" type="number" min="1" value="${D.rest}" style="width:70px" onchange="gyxStudySet('rest',this.value)"> 分钟 · <input class="gyx-who" type="number" min="0" value="${D.rounds}" style="width:70px" onchange="gyxStudySet('rounds',this.value)"> 轮（0＝一直循环）</div>
        <div class="gyx-row"><button class="gyx-btn" onclick="gyxStudyStart()">开始自习</button></div>
        <div class="gyx-card">今天：${today.reduce((a, l) => a + l.rounds, 0)} 轮 · ${today.reduce((a, l) => a + l.min, 0)} 分钟　这周：${week} 分钟</div>
        ${D.log.slice(0, 8).map(l => `<div class="gyx-tip">${new Date(l.at).toLocaleString()} · ${l.min} 分钟 · ${l.rounds} 轮 ${l.task ? '· ' + X.esc(l.task) : ''} · 和 ${X.esc(X.name(X.char(l.cid)))}</div>`).join('')}`;
    paintTimer();
}
window.gyxStudyWho = v => { D.who = v; S.set('d', D); };
window.gyxStudySet = (k, v) => { D[k] = Math.max(0, +v || 0) || (k === 'rounds' ? 0 : 1); S.set('d', D); };
window.gyxStudyOpen = function () { X.panel('gyxStOv', '📚 一起自习室', '<div id="gyxStBody"></div>'); paint(); };
window.gyxStudyState = () => T;
X.action({ key: 'gyx_study', label: '约她一起自习 / 一起专注一会儿', hint: '你也有事要忙的时候', need: () => !T, run: async c => (await X.reach(c, '你想约她一起自习一会儿（「小功能 → 一起自习室」），你也有自己的事要忙')) ? '约你一起自习' : null }, 'gyxStudy');
X.css('gyxStCss', `
.st-desk{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:12px 0}.st-me,.st-ta{flex:1;text-align:center;font-size:14px}.st-me small,.st-ta small{color:#8e8e93}
.st-clock{position:relative;width:190px;height:190px;flex-shrink:0}.st-clock svg{width:100%;height:100%;transform:rotate(-90deg)}.st-clock circle{fill:none;stroke-width:10;stroke-linecap:round}.st-clock .bg{stroke:#f0f0f3}.st-clock .fg{stroke:#ff8a65;transition:stroke-dashoffset 1s linear}.st-clock .fg.rest{stroke:#81c784}
.st-clock>div{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}.st-clock b{font-size:38px;font-weight:600;font-variant-numeric:tabular-nums}.st-clock em{font-style:normal;font-size:12px;color:#8e8e93}
#gyxStMini{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:9400;padding:6px 14px;border-radius:999px;background:rgba(20,20,22,.86);color:#fff;font-size:13px;cursor:pointer;backdrop-filter:blur(10px);font-variant-numeric:tabular-nums}
`);
X.today(() => { const L = D.log.filter(l => X.day(new Date(l.at)) === X.day()); const rows = []; if (T) rows.push({ t: T.phase === 'focus' ? '专注中' : '休息中', x: `和 ${X.esc(X.name(T.c))} 一起${T.task ? ' · ' + X.esc(T.task) : ''}`, go: 'gyxStudyOpen()' }); if (L.length) rows.push({ t: L.reduce((a, l) => a + l.min, 0) + ' 分钟', x: `今天一起自习了 ${L.reduce((a, l) => a + l.rounds, 0)} 轮`, go: 'gyxStudyOpen()' }); return { title: '📚 自习', rows }; }, 'gyxStudy');
X.mini({ id: 'gyxStudy', icon: '📚', title: '一起自习室', desc: '番茄钟，TA 在对面也在忙；休息时催你喝水，偷偷切走会被念', onOpen: () => window.gyxStudyOpen() });
X.ctx(id => T && String(T.c.id) === String(id) ? `【一起自习】你们正在一起自习（${T.phase === 'focus' ? '专注中，她要做的是：' + (T.task || '没说') + '，你在' + T.doing : '休息时间'}）。聊天时别拖着她聊太久，专注时间里可以催她回去学习。` : '', 'gyxStudy');
(async () => { D = Object.assign(D, await S.get('d', {})); D.log = D.log || []; setInterval(tick, 1000); })();
