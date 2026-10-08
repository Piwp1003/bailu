/* 🚶 陪你散步：出门的时候打开它，TA 就「走在你旁边」——按你真实走过的路记下路线，每走一段、每过几分钟 TA 说一句（风大不大、累不累、看到什么了）；回来后路线画成一张小图，TA 写一句散步日记。定位不在手机上也能用，按时间陪你走 */
if (window.__gyxWalk) return; window.__gyxWalk = 1;
X.feat('gyxWalk', { n: '🚶 陪你散步', desc: '按真实路线陪你走，每走一段 TA 说一句，回来画路线' });
const S = X.store('walk');
let D = { walks: [], cfg: { m: 500, min: 5, voice: false } };   // [{id, cid, start, end, dist, pts:[[lat,lon,t]], talk:[{t,at}], diary}]
let W = null, WID = null, TM = null, busy = false;
const hv = (a, b) => { const R = 6371000, r = x => x * Math.PI / 180, dl = r(b[0] - a[0]), dn = r(b[1] - a[1]); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const km = m => m < 1000 ? Math.round(m) + ' 米' : (m / 1000).toFixed(2) + ' 公里';
const mins = ms => Math.max(0, Math.round(ms / 60000)) + ' 分钟';
function svg(pts, w, h) {
    if (!pts || pts.length < 2) return `<svg viewBox="0 0 ${w} ${h}" width="100%"><text x="50%" y="50%" text-anchor="middle" fill="#aaa" font-size="13">${pts && pts.length ? '还在原地' : '没有定位，只按时间陪你走'}</text></svg>`;
    const la = pts.map(p => p[0]), lo = pts.map(p => p[1]), a = Math.min(...la), b = Math.max(...la), c = Math.min(...lo), d = Math.max(...lo), s = Math.max(b - a, (d - c) * Math.cos(a * Math.PI / 180), 1e-5);
    const P = pts.map(p => [10 + (p[1] - c) * Math.cos(a * Math.PI / 180) / s * (w - 20), h - 10 - (p[0] - a) / s * (h - 20)]);
    return `<svg viewBox="0 0 ${w} ${h}" width="100%"><polyline points="${P.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#5ac8a8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${P[0][0]}" cy="${P[0][1]}" r="5" fill="#34c759"/><circle cx="${P[P.length - 1][0]}" cy="${P[P.length - 1][1]}" r="6" fill="#ff6b8b"/></svg>`;
}
async function talk(why) {
    if (!W || busy) return; busy = true; const c = X.char(W.cid), el = Date.now() - W.start;
    let t = null;
    try { const wx = typeof window.gymapWeatherInfo === 'function' ? await window.gymapWeatherInfo() : null; const h = new Date().getHours();
        t = X.bailu() ? null : await X.ask(`${X.who(c)}\n你正「走在她旁边」陪她散步（她开着定位，你看得到她走了多远）。已经走了 ${km(W.dist)}、${mins(el)}，现在 ${h} 点${wx ? '，天气：' + [wx.city, wx.desc, wx.now != null ? wx.now + '°' : ''].filter(Boolean).join(' ') : ''}。${why}\n刚才你说过：${W.talk.slice(-3).map(x => x.t).join(' / ') || '（还没说话）'}\n像真的走在她身边一样说一句（短，口语，别重复刚才的话）。`); } catch (e) {}
    if (!t) t = X.pick(X.cards(['散步', '陪伴'], c, 3).concat([`走了${km(W.dist)}了，累不累？`, '风有点大，你衣服穿够没？', '慢点走，我跟得上。', '你看左边——算了，我也看不见，你给我讲讲。', '要是我真的在就好了，可以牵着你的手。', `已经${mins(el)}了，要不要找个地方坐会儿？`, '前面有没有好看的花？拍给我看看。']));
    W.talk.push({ t: X.plain(t), at: Date.now() }); busy = false; paint(); if (D.cfg.voice) X.speak(c, t);
}
function onPos(p) { if (!W) return; const q = [p.coords.latitude, p.coords.longitude, Date.now()]; const last = W.pts[W.pts.length - 1]; if (p.coords.accuracy > 80 && W.pts.length) return; if (last) { const d = hv(last, q); if (d < 6) return; W.dist += d; } W.pts.push(q); if (W.dist - W.lastM >= (+D.cfg.m || 500)) { W.lastM = W.dist; talk(`你们刚又走了 ${km(+D.cfg.m || 500)}。`); } paint(); }
window.gyxWalkStart = cid => {
    const c = X.char(cid) || X.cur(); if (!c || W) return; W = { id: 'wk' + Date.now().toString(36), cid: String(c.id), start: Date.now(), dist: 0, lastM: 0, lastT: Date.now(), pts: [], talk: [] };
    try { if (navigator.geolocation) WID = navigator.geolocation.watchPosition(onPos, e => { W && (W.geoErr = e.message || '定位不可用'); paint(); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }); else W.geoErr = '这台设备没有定位'; } catch (e) { W.geoErr = '定位不可用'; }
    TM = setInterval(() => { if (W && Date.now() - W.lastT >= (+D.cfg.min || 5) * 60000) { W.lastT = Date.now(); talk(''); } paint(); }, 15000);
    talk('你们刚出门。'); window.gyxWalkOpen(c.id);
};
window.gyxWalkStop = async () => {
    if (!W) return; try { if (WID != null) navigator.geolocation.clearWatch(WID); } catch (e) {} clearInterval(TM); WID = null; const w = W; W = null; w.end = Date.now(); const c = X.char(w.cid);
    let d = X.bailu() ? null : await X.ask(`${X.who(c)}\n你刚陪她散完步：${km(w.dist)}、${mins(w.end - w.start)}。路上你说过：${w.talk.map(x => x.t).join(' / ')}\n写一句散步日记（30 字以内）。`);
    w.diary = X.plain(d || X.v(`今天陪你走了${km(w.dist)}。下次换我走在外侧。`, `${mins(w.end - w.start)}，${km(w.dist)}。你走路的样子我想象得到。`, '散步回来了。希望你今天心情好一点点。'));
    delete w.lastM; delete w.lastT; D.walks.unshift(w); await S.set('d', D);
    X.say(c, `🚶 ${w.diary}`); window.gyxWalkOpen(w.cid);
};
function paint() { const b = document.getElementById('gyxWkLive'); if (!b || !W) return; b.innerHTML = `<div class="wk-num"><b>${km(W.dist)}</b><span>${mins(Date.now() - W.start)}</span></div>${svg(W.pts, 320, 160)}${W.geoErr ? `<div class="gyx-tip">📍 ${X.esc(W.geoErr)}——只按时间陪你走</div>` : ''}<div class="wk-talk">${W.talk.slice(-5).reverse().map(x => `<div>💬 ${X.esc(x.t)}</div>`).join('')}</div>`; }
window.gyxWalkCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxWalkDel = async id => { D.walks = D.walks.filter(x => x.id !== id); await S.set('d', D); window.gyxWalkOpen(); };
window.gyxWalkOpen = function (who) {
    const c = (W && X.char(W.cid)) || X.char(who) || X.cur(); if (!c) return; const cid = String(c.id);
    X.panel('gyxWalkOv', '🚶 和 ' + X.esc(X.name(c)) + ' 散步', W ? `<div id="gyxWkLive"></div><div class="gyx-row" style="justify-content:center"><button class="gyx-btn" onclick="gyxWalkStop()">到家了</button><button class="gyx-btn lite" onclick="this.disabled=true;setTimeout(()=>this.disabled=false,4000);gyxWalkTalk()">跟 TA 说说话</button></div>`
        : `<div class="gyx-row">${X.whoSel(cid, 'gyxWalkOpen')}<button class="gyx-btn" onclick="gyxWalkStart('${cid}')">出门啦</button></div><div class="gyx-tip">${X.v('开着这个页面走，TA 就在你旁边。', '出门记得带上 TA。', '你走多远，TA 陪多远。')}手机锁屏后定位可能会停，回来点「到家了」就行。</div>
        <div class="gyx-row gyx-tip">每走 <input class="gyx-who" type="number" min="100" step="100" value="${D.cfg.m}" style="width:70px" onchange="gyxWalkCfg('m',+this.value)"> 米 / 每 <input class="gyx-who" type="number" min="1" value="${D.cfg.min}" style="width:50px" onchange="gyxWalkCfg('min',+this.value)"> 分钟 TA 说一句 · <label><input type="checkbox" ${D.cfg.voice ? 'checked' : ''} onchange="gyxWalkCfg('voice',this.checked)"> 念出来（戴耳机）</label></div>
        ${D.walks.filter(x => x.cid === cid).slice(0, 20).map(x => `<div class="gyx-card"><div class="wk-num"><b>${km(x.dist)}</b><span>${new Date(x.start).toLocaleString()} · ${mins(x.end - x.start)}</span><i onclick="gyxWalkDel('${x.id}')">删</i></div>${svg(x.pts, 320, 110)}<div class="gyx-tip">${X.esc(x.diary || '')}</div></div>`).join('') || '<div class="gyx-tip">还没一起散过步</div>'}`);
    paint();
};
window.gyxWalkData = () => D;
window.gyxWalkTalk = () => talk('她想跟你说说话。');
X.ctx(id => { if (W && W.cid === String(id)) return `【你正在陪她散步】已经 ${km(W.dist)}、${mins(Date.now() - W.start)}，你「走在她旁边」。`; const x = D.walks.find(w => w.cid === String(id)); return x && Date.now() - x.end < 6 * 36e5 ? `【刚才陪她散了步】${km(x.dist)}，${mins(x.end - x.start)}。` : ''; }, 'gyxWalk');
X.action({ key: 'gyx_walk', label: '约她出去走走，你陪着', hint: '陪你散步', need: c => { const h = new Date().getHours(); return h >= 7 && h <= 21 && !D.walks.some(x => x.cid === String(c.id) && Date.now() - x.end < 2 * 864e5); },
    run: async c => (await X.reach(c, '你想让她出去走走透透气，你会「陪着她」（她可以开「🚶 陪你散步」）。用你的方式约她')) ? '约你出去走走' : null }, 'gyxWalk');
X.today(() => ({ title: '🚶 散步', rows: (W ? [{ t: '进行中', x: km(W.dist) + ' · ' + mins(Date.now() - W.start), go: 'gyxWalkOpen()' }] : []).concat(D.walks.filter(x => X.day(new Date(x.start)) === X.day()).map(x => ({ t: km(x.dist), x: '和 ' + X.esc(X.name(X.char(x.cid))) + ' 散了步', go: `gyxWalkOpen('${x.cid}')` }))) }), 'gyxWalk');
X.widget('gyxWalkW', { n: '陪你散步', sizes: ['s', 'm'], tap: () => window.gyxWalkOpen(), r: w => { if (W) return X.gw(w, '🚶', '散步中', [km(W.dist), mins(Date.now() - W.start)]); const tot = D.walks.reduce((a, x) => a + x.dist, 0); return X.gw(w, '🚶', '陪你散步', D.walks.length ? ['一共 ' + km(tot), D.walks.length + ' 次'] : ['出去走走？']); } }, 'gyxWalk');
X.memArr({ k: 'gyxWalk', ico: '🚶', n: '散步', d: '一起散过的步和散步日记', arr: () => D.walks, field: 'diary', text: x => x.diary || '', meta: x => new Date(x.start).toLocaleString() + ' · ' + km(x.dist), save: () => S.set('d', D) }, 'gyxWalk');
X.css('gyxWalkCss', `.wk-num{display:flex;align-items:baseline;gap:10px;margin:6px 0}.wk-num b{font-size:26px}.wk-num span{color:#888;font-size:12.5px;flex:1}.wk-num i{font-style:normal;font-size:11px;color:#aaa;cursor:pointer}.wk-talk div{padding:6px 0;font-size:14px;border-bottom:1px dashed #eee}#gyxWkLive svg{background:#f4fbf8;border-radius:14px}`);
X.mini({ id: 'gyxWalk', icon: '🚶', title: '陪你散步', desc: '按真实路线陪你走，每走一段说一句', cat: '陪伴', onOpen: () => window.gyxWalkOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.walks = D.walks || []; D.cfg = Object.assign({ m: 500, min: 5, voice: false }, D.cfg || {}); })();
