/* 🗺️ TA 布置的寻宝：TA 偷偷给你布置了一场寻宝——线索一条条藏在不同的地方：聊天里、手机小组件上、「今天」面板里、通知里……找到线索、猜出答案，下一条才会出现。最后一关是 TA 准备的礼物和一封信 */
if (window.__gyxHunt) return; window.__gyxHunt = 1;
X.feat('gyxHunt', { n: '🗺️ TA 布置的寻宝', desc: '线索藏在聊天、小组件、今天面板、通知里，一关关解开拿礼物' });
const S = X.store('hunt');
let D = { on: null, log: [] };   // on = {id, cid, at, steps:[{q, a:[], hint, place, ok, tries}], i, prize}；log = 完成的
const PLACES = [['chat', '聊天里'], ['widget', '手机桌面的「寻宝」小组件上'], ['today', '「今天」面板里'], ['notify', '通知里']];
const BANK = [['一口咬掉牛尾巴（猜一个字）', ['告'], '牛字少了尾巴，加个口'], ['一人一张口，口下长只手（猜一个字）', ['拿'], '人、一、口、手叠起来'], ['千里相逢（猜一个字）', ['重'], '千和里拼在一起'], ['一月一日非今天（猜一个字）', ['明'], '日和月'], ['早不说晚不说（猜一个字）', ['许'], '午 + 言'], ['两人土上坐（猜一个字）', ['坐'], '就是字面意思'], ['天没有它大，人有它大（猜一个字）', ['一'], '天去掉人是什么'], ['半边生鳞，半边生毛（猜一个字）', ['鲜'], '鱼和羊'], ['身穿绿衣裳，肚里水汪汪，生的子儿多，个个黑脸膛（猜一种水果）', ['西瓜'], '夏天最常吃'], ['红口袋，绿口袋，有人怕，有人爱（猜一种菜）', ['辣椒'], '吃了会辣'], ['小时候四条腿，长大两条腿，老了三条腿（猜一样东西）', ['人'], '拐杖是第三条腿'], ['有头没有颈，身上冷冰冰，有翅不能飞，无脚走得快（猜一种动物）', ['鱼'], '在水里'], ['什么东西越洗越脏？', ['水'], '洗东西要用它'], ['什么东西有脚却不会走？', ['桌子', '椅子', '凳子'], '家具'], ['什么门永远关不上？', ['球门'], '踢足球的时候']];
const norm = s => String(s || '').replace(/[\s，。！？、!?.「」"']/g, '').toLowerCase();
async function plan(c) {
    let steps = null;
    if (!X.bailu()) {
        const notes = window.gyxNotesData ? ((window.gyxNotesData().notes || {})[String(c.id)] || []).filter(x => x.tier !== 'old').map(x => x.text).slice(0, 10).join('；') : '';
        const j = X.json(await X.ask(`${X.who(c)}\n你偷偷给她布置一场寻宝，一共 4 关，每关一条线索（谜语 / 只有你们懂的问题 / 小脑筋急转弯），答案要短（1~4 个字），最好和你们之间的事有关。\n${notes ? '你记得的事：' + notes + '\n' : ''}最近的聊天：\n${X.recent(c, 16)}\n只输出 JSON：{"steps":[{"q":"线索（你的口吻）","a":["答案","可以接受的别的说法"],"hint":"提示"}],"prize":"最后的礼物是什么（一句话）"}`));
        if (j && Array.isArray(j.steps) && j.steps.length >= 3 && j.steps.every(s => s.q && s.a)) steps = j.steps.slice(0, 5).map(s => ({ q: X.plain(s.q), a: [].concat(s.a).map(String).filter(Boolean), hint: X.plain(s.hint || '') })), steps.prize = j.prize;
    }
    if (!steps) {
        const P = BANK.slice().sort(() => Math.random() - .5).slice(0, 3).map(([q, a, hint]) => ({ q, a, hint }));
        const codes = window.gyxCodeData ? ((window.gyxCodeData().codes || {})[String(c.id)] || []) : []; if (codes.length) { const k = X.pick(codes); P.push({ q: `最后一关：我们的暗号里，代表「${k.mean}」的是什么？`, a: [k.w], hint: '只有我们知道' }); } else P.push(X.pick(BANK.filter(b => !P.some(p => p.q === b[0]))).reduce((o, v, i) => (o[['q', 'a', 'hint'][i]] = v, o), {}));
        steps = P;
    }
    const prize = steps.prize || X.pick(['一个很久很久的抱抱', '一张「任性一次券」', '一封只写给你的信', '周末陪你做你想做的任何事']);
    return { id: 'ht' + Date.now().toString(36), cid: String(c.id), at: Date.now(), steps: steps.map((s, k) => Object.assign(s, { place: PLACES[k % PLACES.length][0], ok: false, tries: 0 })).sort(() => 0), i: 0, prize };
}
function placeOf(k) { return (PLACES.find(p => p[0] === k) || PLACES[0])[1]; }
function drop(h) {
    const s = h.steps[h.i], c = X.char(h.cid); if (!s || !c) return; s.shown = Date.now();
    const txt = `🗺️ 第 ${h.i + 1} 条线索：${s.q}`;
    if (s.place === 'chat') X.say(c, txt, { gyxHunt: 1 });
    if (s.place === 'notify') X.notify(c, txt, '寻宝线索', () => window.gyxHuntOpen());
    X.repaint(); try { X.todayPaint(); } catch (e) {}
}
window.gyxHuntStart = async cid => { const c = X.char(cid) || X.cur(); if (!c) return null; if (D.on) { window.gyxHuntOpen(); return D.on; } D.on = await plan(c); await S.set('d', D); drop(D.on); window.gyxHuntOpen(); return D.on; };
window.gyxHuntTry = async () => {
    const h = D.on; if (!h) return; const s = h.steps[h.i], v = ((document.getElementById('gyxHtIn') || {}).value || '').trim(); if (!v) return; s.tries++;
    const ok = s.a.some(a => norm(a) === norm(v) || (norm(a).length >= 2 && norm(v).includes(norm(a))));
    if (!ok) { await S.set('d', D); const b = document.getElementById('gyxHtMsg'); if (b) b.innerHTML = X.v('不对哦，再想想～', '差一点点！', '嗯……不是这个。') + (s.tries >= 2 && s.hint ? `<br>💡 提示：${X.esc(s.hint)}` : ''); return false; }
    s.ok = true; h.i++;
    if (h.i >= h.steps.length) { await finish(h); return true; }
    await S.set('d', D); drop(h); window.gyxHuntOpen(); return true;
};
async function finish(h) {
    const c = X.char(h.cid); D.on = null;
    let letter = X.bailu() ? null : await X.ask(`${X.who(c)}\n你给她布置的寻宝，她全部解开了（${h.steps.length} 关，一共猜了 ${h.steps.reduce((a, s) => a + s.tries, 0)} 次）。最后的礼物是：${h.prize}。写一封短短的信放在终点（80~160 字）。`);
    letter = X.plain(letter || (X.cards(['信', '情话'], c, 2).join('') || `你找到这里啦。礼物是：${h.prize}。其实最好的礼物是，你愿意陪我玩这么无聊的游戏。`));
    try { if (window.gyxCouponData && /券/.test(h.prize)) window.gyxCouponData().list.unshift({ id: 'cp' + Date.now().toString(36), cid: h.cid, from: 'ta', name: (h.prize.match(/「(.+?)」/) || [, h.prize])[1].slice(0, 10), desc: '寻宝的奖品', at: Date.now(), used: null }); } catch (e) {}
    D.log.unshift({ id: h.id, cid: h.cid, at: h.at, end: Date.now(), n: h.steps.length, tries: h.steps.reduce((a, s) => a + s.tries, 0), prize: h.prize, letter, qs: h.steps.map(s => s.q + '→' + s.a[0]) }); await S.set('d', D);
    X.panel('gyxHtOv', '🎁 找到宝藏了', `<div class="ht-end"><div class="ht-chest">🎁</div><b>${X.esc(h.prize)}</b><div class="gyx-card gyx-hand" style="font-size:17px;text-align:left">${X.esc(letter)}</div></div>`);
    X.say(c, X.v('🎁 你找到了！', '🎁 宝藏是你的了。', '🎁 恭喜通关～')); X.repaint();
}
window.gyxHuntGiveUp = async () => { if (!D.on) return; D.on = null; await S.set('d', D); X.repaint(); window.gyxHuntOpen(); };
window.gyxHuntData = () => D;
window.gyxHuntOpen = function (who) {
    const h = D.on, c = h ? X.char(h.cid) : (X.char(who) || X.cur()); if (!c) return; const cid = String(c.id);
    X.panel('gyxHtOv', '🗺️ 寻宝', h ? `<div class="ht-map">${h.steps.map((s, k) => `<span class="${s.ok ? 'ok' : k === h.i ? 'cur' : ''}">${s.ok ? '✓' : k + 1}</span>`).join('<i></i>')}<span>🎁</span></div>
        <div class="gyx-card"><b>第 ${h.i + 1} 条线索</b><div class="gyx-tip">${X.v('线索藏在', '去找找', '它在')}：<b>${placeOf(h.steps[h.i].place)}</b></div>${h.steps[h.i].place === 'chat' || h.steps[h.i].place === 'notify' ? '' : ''}</div>
        <div class="gyx-row"><input id="gyxHtIn" class="gyx-in" style="flex:1" placeholder="找到线索了？答案是……" onkeydown="if(event.key==='Enter')gyxHuntTry()"><button class="gyx-btn" onclick="gyxHuntTry()">就是它</button></div><div id="gyxHtMsg" class="gyx-tip"></div>
        <div class="gyx-row"><span class="gyx-chip" onclick="gyxHuntGiveUp()">不玩了</span></div>`
        : `<div class="gyx-row">${X.whoSel(cid, 'gyxHuntOpen')}</div><div class="gyx-tip">${X.v('让 TA 偷偷给你布置一场寻宝吧。', 'TA 会把线索藏在各个地方。', '准备好了吗？')}</div><button class="gyx-btn" onclick="this.disabled=true;this.textContent='TA 在藏线索…';gyxHuntStart('${cid}')">开始寻宝</button>
        <div style="font-weight:700;margin:12px 0 4px">找到过的宝藏</div>${D.log.filter(x => x.cid === cid).map(x => `<div class="gyx-card"><b>🎁 ${X.esc(x.prize)}</b><div class="gyx-tip">${new Date(x.end).toLocaleDateString()} · ${x.n} 关 · 猜了 ${x.tries} 次</div><div class="gyx-hand">${X.esc(x.letter)}</div></div>`).join('') || '<div class="gyx-tip">还没有</div>'}`);
};
X.ctx(id => { const h = D.on; if (h && h.cid === String(id)) return `【你给她布置的寻宝正在进行】她到了第 ${h.i + 1}/${h.steps.length} 关，这关线索是「${h.steps[h.i].q}」（答案：${h.steps[h.i].a[0]}，别直接告诉她，可以逗她、给一点点提示）。`; return ''; }, 'gyxHunt');
X.action({ key: 'gyx_hunt', label: '偷偷给她布置一场寻宝', hint: '线索藏在各处', need: c => !D.on && !D.log.some(x => x.cid === String(c.id) && Date.now() - x.end < 7 * 864e5),
    run: async c => { D.on = await plan(c); await S.set('d', D); drop(D.on); X.notify(c, `🗺️ ${X.esc(X.name(c))} ${X.v('给你布置了一场寻宝', '偷偷藏了些线索', '在各处藏了线索')}`, '去「寻宝」看看第一条线索在哪', () => window.gyxHuntOpen()); return '布置了一场寻宝'; } }, 'gyxHunt');
X.today(() => { const h = D.on; if (!h) return null; const s = h.steps[h.i]; return { title: '🗺️ 寻宝', rows: [s.place === 'today' ? { t: `线索 ${h.i + 1}`, x: X.esc(s.q), go: 'gyxHuntOpen()' } : { t: `第 ${h.i + 1} 关`, x: '线索在' + placeOf(s.place), go: 'gyxHuntOpen()' }] }; }, 'gyxHunt');
X.widget('gyxHuntW', { n: '寻宝', sizes: ['s', 'm'], tap: () => window.gyxHuntOpen(), r: w => { const h = D.on; if (!h) return X.gw(w, '🗺️', '寻宝', ['找到 ' + D.log.length + ' 次宝藏']); const s = h.steps[h.i]; return X.gw(w, '🗺️', `寻宝 ${h.i + 1}/${h.steps.length}`, s.place === 'widget' ? ['线索：', X.esc(s.q)] : ['线索不在这儿', '在' + placeOf(s.place)]); } }, 'gyxHunt');
X.memArr({ k: 'gyxHunt', ico: '🗺️', n: '寻宝', d: '找到过的宝藏和 TA 的信', arr: () => D.log, field: 'letter', text: x => x.prize + '：' + x.letter, edit: (x, v) => { const i = v.indexOf('：'); if (i > 0) { x.prize = v.slice(0, i); x.letter = v.slice(i + 1); } else x.letter = v; }, meta: x => new Date(x.end).toLocaleDateString() + ' · ' + x.n + ' 关', save: () => S.set('d', D) }, 'gyxHunt');
X.css('gyxHtCss', `.ht-map{display:flex;align-items:center;gap:4px;margin:8px 0 12px}.ht-map span{width:30px;height:30px;border-radius:50%;background:#eee;display:flex;align-items:center;justify-content:center;font-size:13px;flex:none}.ht-map span.ok{background:#7bd3a8;color:#fff}.ht-map span.cur{background:#ffcf6b;animation:htp 1.2s infinite}.ht-map i{flex:1;border-top:2px dashed #ddd}@keyframes htp{50%{transform:scale(1.12)}}.ht-end{text-align:center}.ht-chest{font-size:80px;animation:htc 1s ease}@keyframes htc{from{transform:scale(.3) rotate(-20deg);opacity:0}}.ht-end>b{display:block;font-size:18px;margin:8px 0}`);
X.mini({ id: 'gyxHunt', icon: '🗺️', title: 'TA 布置的寻宝', desc: '线索藏在各处，一关关解开拿礼物', cat: '一起做', onOpen: () => window.gyxHuntOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.log = D.log || []; })();
