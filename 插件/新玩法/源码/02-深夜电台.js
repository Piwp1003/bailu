/* 📻 TA 的深夜电台：晚上 TA 用自己的声音开一期只给你听的节目——开场、聊今天、读你的心情、点一首歌、晚安 */
if (window.__gyxRadio) return; window.__gyxRadio = 1;
X.feat('gyxRadio', { n: '📻 深夜电台', desc: 'TA 用自己的声音开一期只给你听的节目：聊今天、读你的心情、点歌、说晚安' });
const S = X.store('radio');
let D = { eps: [], cfg: { auto: true, at: '22:30', who: '' }, last: '' };
let PLAY = null;   // { ep, i, stop }
const FM = c => (87.5 + (String(c && c.id || c && c.name || '1').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % 200) / 10).toFixed(1);
async function script(c) {
    const today = X.day(), mood = (() => { try { const d = window.gyMoodData && window.gyMoodData().days[today]; return d && d.me ? `她今天在心情手账里记的是「${d.me.m}」${d.me.note ? '：' + d.me.note : ''}` : ''; } catch (e) { return ''; } })();
    if (X.bailu()) {
        const open = X.cards(['电台', '开场', '聊天'], c, 1)[0] || '晚上好，这里是只放给你听的电台。';
        const mid = X.cards(['电台', '聊天'], c, 3);
        const night = X.cards(['晚安', '聊天'], c, 1)[0] || '晚安，明天见。';
        return { title: '今晚的电台', segs: [{ t: 'open', s: open }].concat(mid.map(s => ({ t: 'talk', s }))).concat([{ t: 'song', s: '接下来这首歌送给你。', song: '' }, { t: 'night', s: night }]) };
    }
    const r = await X.ask(`${X.who(c)}\n最近你们的聊天：\n${X.recent(c, 24) || '（今天还没怎么聊）'}\n${mood ? '\n' + mood + '\n' : ''}\n现在是晚上。你要开一期只放给${X.me(c)}一个人听的深夜电台（FM ${FM(c)}，你是主持人），用你自己的说话方式。节目分几段：\n1. 开场（像电台主持人那样开场，但带着你的性格）\n2. 聊聊今天（从你们今天聊过的事里挑一两件，说说你的想法）\n3. 读听众来信（听众就是她：${mood ? '读她今天的心情手账，回应她' : '想象她今天可能的心情，回应她'}）\n4. 点一首歌送给她（真实存在的歌，说为什么选它）\n5. 晚安（哄她睡觉）\n每段 2~5 句话，口语，像真的在说话，不要动作描写和括号。\n只输出 JSON：{"title":"这期节目的名字","segs":[{"t":"open","s":"..."},{"t":"talk","s":"..."},{"t":"letter","s":"..."},{"t":"song","s":"...","song":"歌名 - 歌手"},{"t":"night","s":"..."}]}`);
    const j = X.json(r);
    if (j && Array.isArray(j.segs) && j.segs.length) return j;
    return { title: '今晚的电台', segs: [{ t: 'open', s: r ? X.plain(r) : '晚上好，今天也辛苦了。' }, { t: 'night', s: '晚安，早点睡。' }] };
}
async function make(c) {
    c = c || X.char(D.cfg.who) || X.cur(); if (!c) return null;
    const j = await script(c);
    const ep = { id: 'ep' + Date.now(), cid: String(c.id), at: Date.now(), title: j.title || '今晚的电台', segs: j.segs.map(x => ({ t: x.t || 'talk', s: String(x.s || ''), song: x.song || '' })) };
    D.eps.unshift(ep); await S.set('d', D);
    return ep;
}
window.gyxRadioMake = make;
function segName(t) { return { open: '开场', talk: '聊聊今天', letter: '听众来信', song: '点歌', night: '晚安' }[t] || '聊聊'; }
function stop() { if (PLAY) { PLAY.stopped = true; PLAY = null; } X.stopSpeak(); paintPlayer(); }
window.gyxRadioStop = stop;
async function playSong(ep, seg) {
    const q = String(seg.song || '').split(/\s*[-–—]\s*/)[0].trim(); if (!q) return;
    try { const t = window.gymFindTrack && window.gymFindTrack(q); if (t && window.gymPlayTrackId) { window.gymPlayTrackId(t.id); return 'box'; } } catch (e) {}
    return 'none';
}
window.gyxRadioPlay = async function (id, from) {
    stop();
    const ep = D.eps.find(e => e.id === id) || D.eps[0]; if (!ep) return;
    const c = X.char(ep.cid);
    const P = PLAY = { ep, i: from || 0, stopped: false };
    paintPlayer();
    while (!P.stopped && P.i < ep.segs.length) {
        const seg = ep.segs[P.i]; paintPlayer();
        await new Promise(res => { X.speak(c, seg.s, res).then(r => { if (!r) res(); }); setTimeout(res, 12000 + seg.s.length * 400); });
        if (P.stopped) break;
        if (seg.t === 'song' && seg.song) { const r = await playSong(ep, seg); P.song = r; paintPlayer(); if (r === 'box') await new Promise(res => setTimeout(res, 3000)); }
        P.i++;
        await new Promise(res => setTimeout(res, 700));
    }
    if (PLAY === P) { PLAY = null; paintPlayer(); }
};
window.gyxRadioSearch = q => { if (window.gyWmOpen) window.gyWmOpen('https://music.163.com/#/search/m/?s=' + encodeURIComponent(q) + '&type=1'); };
function paintPlayer() {
    const b = document.getElementById('gyxRdNow'); if (!b) return;
    const ep = PLAY ? PLAY.ep : D.eps[0]; if (!ep) { b.innerHTML = '<div class="gyx-tip">还没有节目。点下面「让 TA 现在开播」。</div>'; return; }
    const c = X.char(ep.cid), i = PLAY ? PLAY.i : -1;
    b.innerHTML = `<div class="rd-disc${PLAY ? ' on' : ''}"><div class="rd-in">${X.esc(X.name(c)[0] || '')}</div></div>
        <div class="rd-fm">FM ${FM(c)} · ${X.esc(X.name(c))}的频道</div><div class="rd-t">${X.esc(ep.title)}</div>
        <div class="rd-wave${PLAY ? ' on' : ''}">${'<i></i>'.repeat(24)}</div>
        <div class="rd-segs">${ep.segs.map((s, k) => `<div class="rd-seg${k === i ? ' cur' : ''}" onclick="gyxRadioPlay('${ep.id}',${k})"><em>${segName(s.t)}</em><p>${X.esc(s.s)}</p>${s.song ? `<p class="sg">🎵 ${X.esc(s.song)} <b onclick="event.stopPropagation();gyxRadioSearch('${X.esc(s.song).replace(/'/g, '')}')">去听</b></p>` : ''}</div>`).join('')}</div>
        <div class="gyx-row" style="justify-content:center">${PLAY ? '<button class="gyx-btn" onclick="gyxRadioStop()">⏹ 停</button>' : `<button class="gyx-btn" onclick="gyxRadioPlay('${ep.id}')">▶ 收听</button>`}</div>`;
    const cur = b.querySelector('.rd-seg.cur'); if (cur) cur.scrollIntoView({ block: 'nearest' });
}
window.gyxRadioOpen = function () {
    const ov = X.panel('gyxRdOv', '📻 TA 的深夜电台', `<div id="gyxRdNow" class="rd-now"></div>
        <div class="gyx-row"><button class="gyx-btn" id="gyxRdGo" onclick="gyxRadioNew()">让 TA 现在开播</button>${X.whoSel(D.cfg.who || (X.cur() || {}).id, 'gyxRadioWho')}</div>
        <div class="gyx-row"><label><input type="checkbox" ${D.cfg.auto ? 'checked' : ''} onchange="gyxRadioCfg('auto',this.checked)"> 每晚</label><input class="gyx-who" type="time" value="${D.cfg.at}" onchange="gyxRadioCfg('at',this.value)"> TA 自己开播，开播时通知你</div>
        <div class="gyx-tip">接了「TA 的声音」就是 TA 自己的声音在念；点歌如果音乐盒里有就直接放，没有可以「去听」。</div>
        <div class="rd-list">${D.eps.slice(1).map(e => `<div class="gyx-card" onclick="gyxRadioPlay('${e.id}')">📻 ${X.esc(e.title)} <span class="gyx-tip">${new Date(e.at).toLocaleDateString()} · ${X.esc(X.name(X.char(e.cid)))}</span></div>`).join('')}</div>`, 'dark');
    paintPlayer(); return ov;
};
window.gyxRadioWho = v => { D.cfg.who = v; S.set('d', D); };
window.gyxRadioCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxRadioNew = async function () {
    const b = document.getElementById('gyxRdGo'); if (b) { b.disabled = true; b.textContent = 'TA 在准备稿子……'; }
    const ep = await make(); if (b) { b.disabled = false; b.textContent = '让 TA 现在开播'; }
    if (ep) { window.gyxRadioOpen(); window.gyxRadioPlay(ep.id); }
    return ep;
};
// 每晚到点：TA 自己开播
async function tick() { if (!X.on('gyxRadio')) return;
    if (!D.cfg.auto) return;
    const now = new Date(), [h, m] = String(D.cfg.at || '22:30').split(':').map(Number);
    if (now.getHours() * 60 + now.getMinutes() < h * 60 + m || D.last === X.day()) return;
    D.last = X.day(); await S.set('d', D);
    const ep = await make(); if (!ep) return;
    const c = X.char(ep.cid);
    X.notify(c, `📻 ${X.name(c)} 的深夜电台开播了：${ep.title}`, '点开收听', 'gyxRadioOpen');
    X.say(c, `📻 今晚的电台开播了——《${ep.title}》，只放给你听。去「小功能 → 深夜电台」收听。`);
}
X.action({ key: 'gyx_radio', label: '晚上给她开一期只给她听的电台', hint: '用你自己的声音', need: c => { const h = new Date().getHours(); return (h >= 20 || h < 2) && !D.eps.some(e => e.cid === String(c.id) && X.day(new Date(e.at)) === X.day()); }, run: async c => { const ep = await make(c); if (!ep) return null; X.notify(c, X.v(`📻 ${X.name(c)} 开播了：${ep.title}`, `📻 ${X.name(c)} 的电台开始了——${ep.title}`, `📻 今晚 ${X.name(c)} 的节目：${ep.title}`), X.v('点开收听', '只放给你听', '去听听'), 'gyxRadioOpen'); return '给你开了一期电台：' + ep.title; } }, 'gyxRadio');
X.css('gyxRdCss', `
#gyxRdOv .gyx-box{background:linear-gradient(170deg,#1b1d2e,#2a2140);color:#f2f0ff}#gyxRdOv .gyx-hd{background:rgba(27,29,46,.85)}#gyxRdOv .gyx-tip{color:#a9a3c9}#gyxRdOv .gyx-card{background:rgba(255,255,255,.07);cursor:pointer}#gyxRdOv .gyx-btn{background:#f2f0ff;color:#1b1d2e}#gyxRdOv .gyx-who{background:#2e2b45;color:#fff;border-color:#443f66}
.rd-now{text-align:center;padding:6px 0 4px}
.rd-disc{width:132px;height:132px;margin:6px auto 10px;border-radius:50%;background:repeating-radial-gradient(circle,#111 0 2px,#1c1c22 2px 4px);box-shadow:0 14px 34px rgba(0,0,0,.5),inset 0 0 0 2px rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center}
.rd-disc.on{animation:rdSpin 6s linear infinite}.rd-in{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#ffb3c7,#b9a6ff);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px}
@keyframes rdSpin{to{transform:rotate(360deg)}}
.rd-fm{font-size:12px;letter-spacing:.2em;color:#b8b0e6}.rd-t{font-size:19px;margin:4px 0 8px}
.rd-wave{display:flex;gap:3px;justify-content:center;align-items:flex-end;height:26px;margin-bottom:8px}.rd-wave i{width:3px;height:4px;border-radius:2px;background:#b9a6ff}.rd-wave.on i{animation:rdW 1s ease-in-out infinite}
${Array.from({ length: 24 }, (_, i) => `.rd-wave.on i:nth-child(${i + 1}){animation-delay:${(i * 0.07 % 1).toFixed(2)}s}`).join('')}
@keyframes rdW{0%,100%{height:4px}50%{height:24px}}
.rd-segs{text-align:left;max-height:34vh;overflow:auto;margin:6px 0}.rd-seg{padding:8px 10px;border-radius:12px;cursor:pointer;opacity:.6}.rd-seg.cur{opacity:1;background:rgba(255,255,255,.08)}.rd-seg em{font-style:normal;font-size:11.5px;color:#b8b0e6}.rd-seg p{margin:3px 0;font-size:14px;line-height:1.7}.rd-seg .sg b{color:#ffb3c7;cursor:pointer;margin-left:6px}
`);
X.today(() => { const e = D.eps.find(x => X.day(new Date(x.at)) === X.day()); const rows = e ? [{ t: '📻 今晚', x: `${X.esc(X.name(X.char(e.cid)))}的电台《${X.esc(e.title)}》`, go: `gyxRadioOpen()` }] : (D.cfg.auto ? [{ t: D.cfg.at, x: '今晚 TA 会开播', go: 'gyxRadioOpen()' }] : []); return { title: '📻 深夜电台', rows }; }, 'gyxRadio');
X.mini({ id: 'gyxRadio', icon: '📻', title: '深夜电台', desc: 'TA 用自己的声音开一期只给你听的节目：聊今天、读你的心情、点歌、说晚安', onOpen: () => window.gyxRadioOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.cfg = Object.assign({ auto: true, at: '22:30', who: '' }, D.cfg || {}); D.eps = D.eps || []; setInterval(tick, 60000); setTimeout(tick, 15000); })();
