/* ☀️ TA 的早安简报：每天早上第一次打开，TA 给你一份只属于你的简报——天气、今天的日程、约定、快到的纪念日、经期、今日份歌曲……最上面是 TA 写给你的早安 */
if (window.__gyxBrief) return; window.__gyxBrief = 1;
X.feat('gyxBrief', { n: '☀️ TA 的早安简报', desc: '每天早上一份简报：天气、日程、约定、纪念日，TA 写给你的早安' });
const S = X.store('brief');
let D = { cfg: { from: 5, to: 11, who: '', pop: true }, last: '', log: [] };
function facts() {
    const f = [];
    try { const W = window.gyxWeatherData && window.gyxWeatherData(); if (W && W.now && W.me) f.push(['🌦️', `${W.me.name} 今天 ${Math.round(W.now.min)}~${Math.round(W.now.max)}°，降水 ${W.now.rain}%`]); } catch (e) {}
    try { const k = X.day(), L = (typeof gyMyDayAll === 'function' ? gyMyDayAll() : []).filter(x => x && x.date === k); L.forEach(x => f.push(['🗓️', `${x.time || '今天'} ${x.text}`])); } catch (e) {}
    try { const P = window.gyxPromiseData && window.gyxPromiseData(); (P && P.list || []).filter(x => x.done === null).forEach(x => f.push(['🤙', `约定：${x.what}`])); } catch (e) {}
    try { X.chars().forEach(c => (window.gyxAnnivUpcoming ? window.gyxAnnivUpcoming(c.id, 7) : []).forEach(a => f.push(['🎉', `${a.left === 0 ? '今天' : a.left + ' 天后'}：${a.name}`]))); } catch (e) {}
    try { const s = window.gyPeriodNow && window.gyPeriodNow(); if (s && s.has) { if (s.inPeriod) f.push(['🩸', `经期第 ${s.day} 天，多喝热水`]); else if (s.toNext <= 3) f.push(['🩸', `经期大概 ${s.toNext} 天后来`]); } } catch (e) {}
    try { const L = window.gyxListData && window.gyxListData(); if (L && L.songs && L.songs.length) { const k = X.day(); let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const s = L.songs[h % L.songs.length]; f.push(['🎶', `今日份：《${s.t}》${s.a}`]); } } catch (e) {}
    try { const G = window.gyxGrowData && window.gyxGrowData(); (G && G.list || []).forEach(p => f.push(['🌱', `${p.name}等着你去照顾`])); } catch (e) {}
    try { const C = window.gyxCapsuleData && window.gyxCapsuleData(); const r = (C && C.list || []).filter(i => !i.opened && (i.arrived || (i.from === 'me' && Date.now() >= i.open))); if (r.length) f.push(['⏳', `${r.length} 个时间胶囊可以拆了`]); } catch (e) {}
    return f;
}
async function make(c, force) {
    c = c || X.char(D.cfg.who) || X.cur(); if (!c) return null;
    const f = facts(), d = new Date();
    let hi;
    if (X.bailu()) hi = X.cards(['早安', '聊天'], c, 2).join('\n') || '早安，今天也要好好的。';
    else hi = X.plain(await X.ask(`${X.who(c)}\n现在是 ${d.getMonth() + 1} 月 ${d.getDate()} 日早上。她今天的情况：\n${f.map(x => '- ' + x[1]).join('\n') || '- 没什么特别的安排'}\n最近的聊天：\n${X.recent(c, 8)}\n\n给她写一段早安（60~140 字）：像你本人说话，可以挑上面一两件事叮嘱她，不用全提。只输出这段话。`) || '早安，今天也要好好的。');
    const it = { day: X.day(), cid: String(c.id), hi, f, at: Date.now() };
    D.log.unshift(it); D.log = D.log.slice(0, 60); D.last = X.day(); await S.set('d', D);
    return it;
}
function show(it) {
    const c = X.char(it.cid), d = new Date(it.at), WK = '日一二三四五六';
    const ov = document.createElement('div'); ov.id = 'gyxBrOv'; ov.className = 'gyx-ov';
    let av = ''; try { av = getAvatarHTML(c, 44); } catch (e) {}
    ov.innerHTML = `<div class="br-card"><div class="br-sun"></div><div class="br-d"><b>${d.getDate()}</b><span>${d.getMonth() + 1} 月 · 星期${WK[d.getDay()]}</span></div>
        <div class="br-hi"><div class="br-who">${av}<b>${X.esc(X.name(c))}</b><em>的早安</em></div><p class="gyx-hand">${X.esc(it.hi).replace(/\n/g, '<br>')}</p></div>
        ${it.f.length ? `<div class="br-fs">${it.f.map(x => `<div><i>${x[0]}</i>${X.esc(x[1])}</div>`).join('')}</div>` : ''}
        <button class="gyx-btn" onclick="document.getElementById('gyxBrOv').remove()">${X.v('早安 ☀️', '起床啦', '好，今天也加油', '知道啦')}</button></div>`;
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
}
window.gyxBriefShow = async (force) => { const it = (!force && D.log[0] && D.log[0].day === X.day()) ? D.log[0] : await make(null, true); if (it) show(it); return it; };
async function tick() {
    if (!X.on('gyxBrief')) return; const h = new Date().getHours(); if (h < D.cfg.from || h >= D.cfg.to || D.last === X.day()) return;
    const c = X.char(D.cfg.who) || X.cur(); if (!c) return; if (X.auto(c) && !X.on('gyxBrief.auto')) return;
    const it = await make(c); if (!it) return;
    X.say(c, '☀️ ' + it.hi);
    if (D.cfg.pop) show(it);
}
window.gyxBriefOpen = function () {
    X.panel('gyxBrSet', '☀️ 早安简报', `<div class="gyx-row">谁来说早安：<select class="gyx-who" onchange="gyxBriefCfg('who',this.value)"><option value="">最近聊天的人</option>${X.chars().map(c => `<option value="${X.esc(c.id)}"${String(c.id) === String(D.cfg.who) ? ' selected' : ''}>${X.esc(X.name(c))}</option>`).join('')}</select></div>
        <div class="gyx-row">早上 <input class="gyx-who" type="number" min="0" max="23" value="${D.cfg.from}" style="width:60px" onchange="gyxBriefCfg('from',+this.value)"> 点到 <input class="gyx-who" type="number" min="1" max="24" value="${D.cfg.to}" style="width:60px" onchange="gyxBriefCfg('to',+this.value)"> 点之间第一次打开时</div>
        <label class="gyx-row"><input type="checkbox" ${D.cfg.pop ? 'checked' : ''} onchange="gyxBriefCfg('pop',this.checked)"> 弹出简报卡片（不勾＝只在聊天里说早安）</label>
        <div class="gyx-tip">简报里会放：天气、今天的日程、小约定、快到的纪念日、经期、今日份歌曲、小生命、能拆的时间胶囊（装了对应插件才有）。</div>
        <div class="gyx-row"><button class="gyx-btn" onclick="document.getElementById('gyxBrSet').remove();gyxBriefShow(true)">现在来一份</button></div>
        ${D.log.slice(0, 7).map(x => `<div class="gyx-tip">${x.day} · ${X.esc(X.name(X.char(x.cid)))}：${X.esc(x.hi.slice(0, 40))}…</div>`).join('')}`);
};
window.gyxBriefCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxBriefData = () => D;
X.action({ key: 'gyx_brief', label: '早上给她一份早安简报', hint: '天气、日程、约定……', need: () => { const h = new Date().getHours(); return h >= D.cfg.from && h < D.cfg.to && D.last !== X.day(); }, run: async c => { const it = await make(c); if (!it) return null; X.say(c, '☀️ ' + it.hi); if (D.cfg.pop) show(it); return '给你写了早安简报'; } }, 'gyxBrief');
X.today(() => { const it = D.log[0]; return { title: '☀️ 早安', rows: it && it.day === X.day() ? [{ t: X.name(X.char(it.cid)), x: X.esc(it.hi.slice(0, 50)) + (it.hi.length > 50 ? '…' : ''), go: 'gyxBriefShow()' }] : [] }; }, 'gyxBrief');
X.css('gyxBrCss', `.br-card{position:relative;overflow:hidden;width:min(400px,92vw);max-height:90vh;overflow-y:auto;background:linear-gradient(170deg,#fff8e7,#ffe9ef 60%,#eef3ff);border-radius:26px;padding:22px 20px 18px;box-shadow:0 24px 60px rgba(0,0,0,.2);animation:giUp .7s cubic-bezier(.2,1.2,.3,1) both;color:#3b3024}
.br-sun{position:absolute;right:-40px;top:-40px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,#ffd97a,#ffb86b 60%,transparent 70%);opacity:.6;animation:brSun 6s ease-in-out infinite}
@keyframes brSun{50%{transform:scale(1.1)}}@keyframes giUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
.br-d{position:relative}.br-d b{font-size:56px;font-weight:300;line-height:1}.br-d span{display:block;font-size:13px;color:#a08a70}
.br-hi{position:relative;margin:14px 0;padding:14px;border-radius:18px;background:rgba(255,255,255,.7)}.br-who{display:flex;align-items:center;gap:8px}.br-who em{font-style:normal;font-size:12px;color:#999}.br-hi p{font-size:19px;line-height:1.8;margin:8px 0 0}
.br-fs div{display:flex;gap:8px;padding:7px 2px;font-size:14px;border-bottom:1px dashed rgba(0,0,0,.08)}.br-fs i{font-style:normal}.br-card .gyx-btn{margin-top:14px;width:100%}`);
X.mini({ id: 'gyxBrief', icon: '☀️', title: '早安简报', desc: '每天早上 TA 给你一份简报：天气、日程、约定、纪念日、早安', onOpen: () => window.gyxBriefOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.cfg = Object.assign({ from: 5, to: 11, who: '', pop: true }, D.cfg || {}); D.log = D.log || []; const go = () => { if (!window.__guyuBooted) return setTimeout(go, 1000); setTimeout(tick, 6000); }; go(); setInterval(tick, 10 * 60000); })();
