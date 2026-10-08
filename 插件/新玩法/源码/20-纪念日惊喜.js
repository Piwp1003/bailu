/* 🎉 纪念日惊喜：接原来的纪念日/日历（不用再记一遍）——快到 100 天、520 天、周年、每月纪念日、你在日历里记的日子时，TA 会提前偷偷准备，当天给你一个要亲手拆开的礼物盒 */
if (window.__gyxAnniv) return; window.__gyxAnniv = 1;
X.feat('gyxAnniv', { n: '🎉 纪念日惊喜', desc: '在一起的天数、纪念日倒数，当天 TA 准备惊喜礼物' });
const S = X.store('anniv');
let D = { pairs: {}, extra: [], gifts: [], hinted: {}, cfg: { monthly: true } };   // pairs[cid]={start:'YYYY-MM-DD'}; extra:[{cid,date,name,yearly}]; gifts:[{id,cid,day,name,gift,letter,opened}]
const pd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const dk = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const daysSince = s => Math.floor((new Date(new Date().setHours(0, 0, 0, 0)) - pd(s)) / 86400000) + 1;
// 接下来的纪念日（不限：100 天的倍数、520、1314、每年、每个月、自己加的）
// 日子全从原项目拿：在一起/认识的那天用日历里的（annBaseInfo），纪念日用角色日历 + 你自己记的；插件不再另存一份
function startOf(cid) {
    const c = X.char(cid);
    try { if (c && typeof annBaseInfo === 'function') { const b = annBaseInfo(c); if (b && b.dateStr && b.from !== '兜底') return { start: b.dateStr, label: b.label || '在一起' }; } } catch (e) {}
    return D.pairs[cid] && D.pairs[cid].start ? { start: D.pairs[cid].start, label: '在一起' } : null;
}
function coreDays(cid) {
    const c = X.char(cid), L = [];
    try { (c && c.anniversaries || []).forEach(a => { if (a && a.date && !/相识|认识|相遇|见面|初见|在一起|确定关系/.test(a.event || '')) L.push({ date: a.date, name: a.event || '纪念日', yearly: true }); }); } catch (e) {}
    try { (typeof currentUser !== 'undefined' && currentUser.customAnniversaries || []).forEach(a => a && a.date && L.push({ date: a.date, name: a.label || '纪念日', yearly: true })); } catch (e) {}
    return L;
}
function upcoming(cid, within) {
    const out = [], today = new Date(); today.setHours(0, 0, 0, 0); const p = startOf(cid);
    if (p && p.start) {
        const st = pd(p.start), n = daysSince(p.start);
        const add = (d, name) => { const left = Math.round((d - today) / 86400000); if (left >= 0 && left <= within) out.push({ left, name, date: dk(d) }); };
        for (let k = Math.ceil(n / 100) * 100; k <= n + within; k += 100) { const d = new Date(st); d.setDate(d.getDate() + k - 1); add(d, `在一起 ${k} 天`); }
        [520, 1314, 999, 666, 888].forEach(k => { if (k >= n && k <= n + within) { const d = new Date(st); d.setDate(d.getDate() + k - 1); add(d, `在一起 ${k} 天`); } });
        for (let y = 1; y <= 60; y++) { const d = new Date(st); d.setFullYear(st.getFullYear() + y); add(d, `在一起 ${y} 周年`); }
        if (D.cfg.monthly) for (let m = 1; m <= 24 * 30; m++) { const d = new Date(st); d.setMonth(st.getMonth() + m); if (d - today > within * 86400000) break; if (m % 12) add(d, `在一起 ${m} 个月`); }
    }
    coreDays(cid).concat(D.extra.filter(e => e.cid === cid)).forEach(e => { let d = pd(e.date); if (e.yearly) { d.setFullYear(today.getFullYear()); if (d < today) d.setFullYear(today.getFullYear() + 1); } const left = Math.round((d - today) / 86400000); if (left >= 0 && left <= within) out.push({ left, name: e.name, date: dk(d) }); });
    return out.sort((a, b) => a.left - b.left);
}
window.gyxAnnivUpcoming = (cid, w) => upcoming(String(cid), w || 60);
async function prepare(c, a) {
    let gift, letter;
    if (X.bailu()) { gift = X.pick(['一束花', '一枚戒指', '一张手写卡片', '一个拥抱券', '一只小熊', '一条项链']); letter = X.cards(['纪念日', '信', '聊天'], c, 3).join('\n') || '谢谢你一直在。'; }
    else { const j = X.json(await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 16)}\n\n今天是你们的「${a.name}」。你偷偷准备了一个礼物和一封短信（按你的性格和你们的回忆来选礼物，要具体；信 80~200 字）。\n只输出 JSON：{"gift":"礼物","letter":"信","say":"当天见到她时说的一句话"}`)); gift = (j && j.gift) || '一束花'; letter = (j && j.letter) || '谢谢你一直在。'; a.say = j && j.say; }
    const g = { id: 'gf' + Date.now(), cid: String(c.id), day: a.date, name: a.name, gift, letter, opened: false, at: Date.now() };
    D.gifts.push(g); await S.set('d', D); return g;
}
async function tick() {
    if (!X.on('gyxAnniv')) return;
    for (const c of X.chars()) {
        const cid = String(c.id), up = upcoming(cid, 3);
        for (const a of up) {
            const k = cid + ':' + a.date + ':' + a.name;
            if (a.left > 0 && a.left <= 3 && !D.hinted[k]) { D.hinted[k] = 'hint'; await S.set('d', D); if (X.on('gyxAnniv.auto') || !X.auto(c)) await X.reach(c, `再过 ${a.left} 天就是你们的「${a.name}」，你在偷偷准备惊喜，可以不经意地透露一点点（别说破）`); }
            if (a.left === 0 && D.hinted[k] !== 'done') { D.hinted[k] = 'done'; await S.set('d', D); const g = await prepare(c, a); X.notify(c, `🎉 今天是你们的「${a.name}」，${X.name(c)} 给你准备了礼物`, '去拆开', 'gyxAnnivOpen'); await X.reach(c, `今天是你们的「${a.name}」！你准备了礼物（${g.gift}）和一封信，让她去「纪念日惊喜」里拆开`); }
        }
    }
}
window.gyxAnnivTick = tick;
window.gyxAnnivUnbox = function (id) {
    const g = D.gifts.find(x => x.id === id); if (!g) return;
    const ov = document.createElement('div'); ov.id = 'gyxGiftOv';
    ov.innerHTML = `<div class="gb-stage"><div class="gb-box"><div class="gb-lid"></div><div class="gb-body"></div><div class="gb-rib"></div></div><div class="gb-hint">点一下礼物盒</div>
        <div class="gb-in"><div class="gb-g">🎁 ${X.esc(g.gift)}</div><div class="gb-l gyx-hand">${X.esc(g.letter).replace(/\n/g, '<br>')}<div class="gb-s">—— ${X.esc(X.name(X.char(g.cid)))} · ${X.esc(g.name)}</div></div><button class="gyx-btn lite" onclick="document.getElementById('gyxGiftOv').remove()">收下</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('.gb-box').onclick = () => { ov.classList.add('open'); let s = ''; for (let i = 0; i < 40; i++) s += `<i style="left:${50 + X.rnd(-8, 8)}%;--dx:${X.rnd(-45, 45)}vw;--dy:${X.rnd(-70, -20)}vh;background:${X.pick(['#ff5c8a', '#ffd166', '#5ab0ff', '#7cc38a', '#b9a6ff'])};animation-delay:${X.rnd(0, .3)}s"></i>`; ov.insertAdjacentHTML('beforeend', `<div class="gb-conf">${s}</div>`); g.opened = true; S.set('d', D); };
};
window.gyxAnnivOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), p = startOf(cid) || {}, n = p.start ? daysSince(p.start) : 0, up = upcoming(cid, 400).slice(0, 12);
    const gs = D.gifts.filter(g => g.cid === cid).reverse();
    X.panel('gyxAnOv', '🎉 纪念日惊喜', `<div class="gyx-row">${X.whoSel(cid, 'gyxAnnivOpen')}</div>
        <div class="an-days">${p.start ? `<span>和 ${X.esc(X.name(c))} 在一起</span><b>${n}</b><span>天</span>` : '<span>还没记你们在一起的日子</span>'}</div>
        <div class="gyx-row gyx-tip">日子都跟着原来的「纪念日 / 日历」走：${p.start ? `从 ${p.start}（${X.esc(p.label)}）算起` : '还没找到你们开始的日子'}，在日历里改就行。<button class="gyx-btn lite" onclick="typeof openCharCalendarModal==='function'&&openCharCalendarModal('${cid}')">打开日历</button><label><input type="checkbox" ${D.cfg.monthly ? 'checked' : ''} onchange="gyxAnnivCfg(this.checked)"> 每个月的纪念日也准备</label></div>
        ${gs.filter(g => !g.opened).map(g => `<div class="an-gift" onclick="gyxAnnivUnbox('${g.id}')">🎁 <b>${X.esc(g.name)}</b> 的礼物还没拆 <span>点这里拆开</span></div>`).join('')}
        <div class="gyx-tip">接下来的日子</div>${up.map(a => `<div class="an-up"><b>${a.left === 0 ? '就是今天' : a.left + ' 天后'}</b><span>${X.esc(a.name)}</span><em>${a.date}</em></div>`).join('') || '<div class="gyx-tip">日历里还没有日子</div>'}
        
        ${gs.filter(g => g.opened).length ? '<div class="gyx-tip">收到过的礼物</div>' + gs.filter(g => g.opened).map(g => `<div class="gyx-tip" style="cursor:pointer" onclick="gyxAnnivUnbox('${g.id}')">🎁 ${X.esc(g.name)}：${X.esc(g.gift)}（${g.day}）</div>`).join('') : ''}`);
};
window.gyxAnnivSet = async (cid, v) => { D.pairs[cid] = { start: v }; await S.set('d', D); window.gyxAnnivOpen(cid); X.repaint(); };
window.gyxAnnivCfg = v => { D.cfg.monthly = v; S.set('d', D); };
window.gyxAnnivData = () => D;
X.action({ key: 'gyx_anniv', label: '为快到的纪念日偷偷准备惊喜 / 当天送礼物', hint: '你们的日子就在这几天', need: c => upcoming(String(c.id), 3).length > 0, run: async c => { const up = upcoming(String(c.id), 3)[0]; if (!up) return null; if (up.left === 0) { const g = await prepare(c, up); return (await X.reach(c, `今天是你们的「${up.name}」，你准备了礼物（${g.gift}）和一封信，让她去「纪念日惊喜」里拆开`)) ? '给你准备了纪念日礼物' : null; } return (await X.reach(c, `再过 ${up.left} 天就是你们的「${up.name}」，你在偷偷准备惊喜，不经意地透露一点点（别说破）`)) ? '在偷偷准备纪念日' : null; } }, 'gyxAnniv');
X.ctx(id => { const up = upcoming(String(id), 3)[0], g = D.gifts.filter(x => x.cid === String(id) && !x.opened).pop(); return (up ? `【纪念日惊喜】${up.left === 0 ? '今天' : up.left + ' 天后'}是「${up.name}」，你${up.left === 0 ? '准备了礼物' : '在偷偷准备惊喜'}。` : '') + (g ? `你送她的「${g.name}」礼物（${g.gift}）她还没拆。` : ''); }, 'gyxAnniv');
X.today(() => { const rows = []; X.chars().forEach(c => { const cid = String(c.id); upcoming(cid, 7).slice(0, 2).forEach(a => rows.push({ t: a.left === 0 ? '就是今天' : a.left + ' 天后', x: `${X.esc(a.name)} · ${X.esc(X.name(c))} 在准备惊喜`, go: `gyxAnnivOpen('${cid}')` })); }); D.gifts.filter(g => !g.opened).forEach(g => rows.push({ t: '🎁', x: `<b>${X.esc(g.name)} 的礼物还没拆</b>`, go: `gyxAnnivUnbox('${g.id}')` })); return { title: '🎉 纪念日惊喜', rows }; }, 'gyxAnniv');
X.widget('gyxAnniv', { n: '纪念日礼物', sizes: ['s', 'm'], tap: () => { const g = D.gifts.filter(x => !x.opened).pop(); g ? window.gyxAnnivUnbox(g.id) : window.gyxAnnivOpen(); }, r: w => { const g = D.gifts.filter(x => !x.opened).pop(); if (g) return `<div class="gw-an ${w.size}"><b>🎁</b><em>${X.esc(g.name)} 的礼物</em><em>点一下拆开</em></div>`; const c = X.cur(), up = c && upcoming(String(c.id), 400)[0]; if (!up) return '<div class="gw-an s"><b>🎉</b><em>还没有纪念日</em></div>'; return `<div class="gw-an ${w.size}"><em>${X.esc(up.name)}</em><b>${up.left}<small>天后</small></b>${w.size === 'm' ? `<em>${X.esc(X.name(c))} ${up.left <= 3 ? '在偷偷准备' : '记着呢'}</em>` : ''}</div>`; } }, 'gyxAnniv');
X.css('gyxAnCss', `.an-days{text-align:center;padding:18px 0;border-radius:20px;background:linear-gradient(135deg,#ffe3ec,#ffeedd);margin:8px 0}.an-days b{display:block;font-size:56px;color:#ff5c8a;line-height:1.1;font-weight:600}.an-days span{font-size:13px;color:#a0707e}
.an-up{display:flex;gap:10px;align-items:baseline;padding:7px 4px;border-bottom:1px solid #f4f4f4;font-size:14px}.an-up b{width:80px;color:#ff5c8a;font-size:13px}.an-up span{flex:1}.an-up em{font-style:normal;font-size:11.5px;color:#aaa}
.an-gift{padding:12px 14px;border-radius:16px;background:#fff4e0;margin:8px 0;cursor:pointer;animation:gbWig 1.6s infinite}.an-gift span{float:right;color:#e07a00;font-size:13px}
#gyxGiftOv{position:fixed;inset:0;z-index:100005;background:radial-gradient(circle,#4a2b3d,#1a1016);display:flex;align-items:center;justify-content:center;overflow:hidden}
.gb-stage{position:relative;width:min(380px,90vw);display:flex;flex-direction:column;align-items:center}.gb-box{position:relative;width:160px;height:150px;cursor:pointer;animation:gbWig 1.4s infinite}
.gb-body{position:absolute;bottom:0;left:10px;right:10px;height:100px;background:linear-gradient(135deg,#ff6b9a,#e04378);border-radius:6px}.gb-lid{position:absolute;top:20px;left:0;right:0;height:34px;background:linear-gradient(135deg,#ff85ad,#f0548a);border-radius:6px;z-index:2;transition:transform .7s cubic-bezier(.3,1.6,.5,1)}.gb-rib{position:absolute;left:50%;top:20px;bottom:0;width:22px;margin-left:-11px;background:#ffd166;z-index:3;transition:opacity .4s}
#gyxGiftOv.open .gb-lid{transform:translateY(-120px) rotate(-25deg)}#gyxGiftOv.open .gb-rib{opacity:0}#gyxGiftOv.open .gb-box{animation:none;transform:scale(.8);opacity:.5;transition:all .8s}
.gb-hint{color:#f6d9e4;margin-top:16px;font-size:13px;letter-spacing:.2em}#gyxGiftOv.open .gb-hint{display:none}
.gb-in{display:none;flex-direction:column;align-items:center;gap:12px;margin-top:-40px;animation:giUp .8s .3s both}#gyxGiftOv.open .gb-in{display:flex}.gb-g{font-size:22px;color:#ffd166}.gb-l{background:#fffdf6;color:#3b3024;padding:20px 22px;border-radius:6px;font-size:19px;line-height:1.8;max-height:50vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,.4)}.gb-s{text-align:right;font-size:16px;margin-top:8px}
.gb-conf i{position:absolute;top:45%;width:8px;height:14px;border-radius:2px;animation:gbC 1.6s cubic-bezier(.2,.8,.4,1) forwards}
@keyframes gbC{to{transform:translate(var(--dx),var(--dy)) rotate(540deg);opacity:0}}@keyframes gbWig{0%,100%{transform:rotate(0)}5%{transform:rotate(-4deg)}10%{transform:rotate(4deg)}15%{transform:rotate(0)}}@keyframes giUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
.gw-an{height:100%;display:flex;flex-direction:column;justify-content:center;gap:2px}.gw-an.s{align-items:center}.gw-an b{font-size:30px;font-weight:600;color:#ff5c8a}.gw-an small{font-size:12px;margin-left:2px}.gw-an em{font-style:normal;font-size:12px;color:var(--pm-sub)}`);
X.mini({ id: 'gyxAnniv', icon: '🎉', title: '纪念日惊喜', desc: '在一起第几天、纪念日倒数；当天 TA 准备礼物给你拆', onOpen: () => window.gyxAnnivOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.pairs = D.pairs || {}; D.extra = D.extra || []; D.gifts = D.gifts || []; D.hinted = D.hinted || {}; D.cfg = Object.assign({ monthly: true }, D.cfg || {}); setTimeout(tick, 15000); setInterval(tick, 30 * 60000); })();
X.memArr({ k: 'gyxAnniv', ico: '🎉', n: '纪念日收到的礼物', d: 'TA 准备的礼物和信', arr: () => D.gifts, text: x => x.letter, field: 'letter', meta: x => x.name + ' · ' + x.gift + ' · ' + x.day, save: () => S.set('d', D) }, 'gyxAnniv');
