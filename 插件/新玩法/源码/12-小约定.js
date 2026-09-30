/* 🤙 小约定：TA 跟你定小约定（喝水、早睡、吃早饭……），到点来检查；做到了有奖励，没做到会被念叨；你也能跟 TA 定 */
if (window.__gyxPromise) return; window.__gyxPromise = 1;
X.feat('gyxPromise', { n: '🤙 小约定', desc: 'TA 跟你定小约定、到点来检查，做到有奖励；你也能跟 TA 定' });
const S = X.store('promise');
let D = { list: [], stars: 0, cfg: { taPer: 30 } };   // {id, cid, by:'ta'|'me', what, due, done:null|true|false, checked, day, reward}
const IDEAS = [['今天喝够八杯水', 21], ['十二点前睡觉', 24], ['好好吃早饭', 10], ['出门走一走，晒晒太阳', 18], ['今天不喝奶茶', 22], ['中午睡个午觉', 15], ['晚饭吃点蔬菜', 20], ['把那件拖了很久的事做完', 22], ['做十分钟拉伸', 22], ['少看一会儿手机，早点躺下', 23]];
const REWARDS = ['一个亲亲', '周末陪你看电影', '一杯你想喝的', '听你讲一个小时废话', '给你点份甜品', '一个很久的抱抱', '一首只唱给你的歌', '明天早上叫你起床'];
const dueAt = h => { const d = new Date(); d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0); if (d.getTime() < Date.now() + 30 * 60000) d.setTime(d.getTime() + 86400000); return d.getTime(); };
async function propose(c) {
    let what, h, say;
    if (X.bailu()) { [what, h] = X.pick(IDEAS); say = `我们约好：${what}。我到时候来检查。`; }
    else {
        const r = await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 14)}\n\n你想跟她定一个今天的小约定（关心她身体或者心情的小事，比如喝水、早睡、按时吃饭、出去走走、别熬夜、少喝冰的……最好和她最近的状态有关）。再说一个做到了你给她的小奖励。\n只输出 JSON：{"what":"约定的事（10 字左右）","hour":到几点检查(0-23 的数字),"reward":"奖励","say":"你跟她说这个约定的话（口语，一两句）"}`);
        const j = X.json(r); if (j && j.what) { what = j.what; h = +j.hour; say = j.say; var reward = j.reward; }
        else { [what, h] = X.pick(IDEAS); say = `跟你定个小约定：${what}。`; }
    }
    const it = { id: 'pr' + Date.now(), cid: String(c.id), by: 'ta', what: String(what), due: dueAt(isFinite(h) ? h : 22), done: null, day: X.day(), reward: (typeof reward !== 'undefined' && reward) || X.pick(REWARDS), at: Date.now() };
    D.list.unshift(it); await S.set('d', D);
    X.say(c, `🤙 ${X.plain(say || it.what)}`);
    return it;
}
window.gyxPromiseTa = id => propose(X.char(id) || X.cur());
window.gyxPromiseMine = async function () {
    const c = X.char(window.GYX_PR_WHO) || X.cur(); const w = ((document.getElementById('gyxPrW') || {}).value || '').trim(), t = (document.getElementById('gyxPrT') || {}).value || '22:00';
    if (!c || !w) { X.toast('写下约定的事'); return; }
    const [hh, mm] = t.split(':').map(Number);
    const it = { id: 'pr' + Date.now(), cid: String(c.id), by: 'me', what: w, due: dueAt(hh + (mm || 0) / 60), done: null, day: X.day(), at: Date.now() };
    D.list.unshift(it); await S.set('d', D);
    X.reach(c, `她跟你定了一个小约定：你要「${w}」，${new Date(it.due).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 她会来检查。答应她，按你的性格`);
    window.gyxPromiseOpen();
};
window.gyxPromiseMark = async function (id, ok) {
    const it = D.list.find(x => x.id === id); if (!it) return; it.done = !!ok; it.checked = Date.now();
    if (ok && it.by === 'ta') D.stars++;
    await S.set('d', D);
    const c = X.char(it.cid);
    if (it.by === 'ta') await X.reach(c, ok ? `你们约好的「${it.what}」她做到了！夸她，兑现你说的奖励：${it.reward}` : `你们约好的「${it.what}」她没做到。按你的性格念叨她两句（心疼多过生气），再哄一下`);
    else await X.reach(c, ok ? `她确认你做到了你们的约定「${it.what}」，她很开心` : `她说你没做到你们的约定「${it.what}」。按你的性格认错或撒娇，保证下次`);
    window.gyxPromiseOpen();
};
// 到点：TA 来检查（问你做到没有）
async function tick() { if (!X.on('gyxPromise')) return;
    for (const it of D.list) {
        if (it.done !== null || it.asked || Date.now() < it.due) continue;
        it.asked = Date.now(); await S.set('d', D);
        const c = X.char(it.cid); if (!c) continue;
        if (it.by === 'ta') { await X.reach(c, `到点了，来检查你们的小约定「${it.what}」她做到没有（问她，等她回答）`); X.notify(c, `🤙 ${X.name(c)} 来检查约定了：${it.what}`, '做到了吗？', 'gyxPromiseOpen'); }
        else { const ok = Math.random() < 0.8; it.done = ok; it.checked = Date.now(); await S.set('d', D); await X.reach(c, ok ? `你们约好你要「${it.what}」，你做到了，跟她说一声（可以邀功）` : `你们约好你要「${it.what}」，你没做到……跟她坦白`); }
    }
    // 默认模式的 TA 每天按概率提一个约定；自主模式的 TA 自己决定
    const k = X.day(); if (D.last === k) return; const h = new Date().getHours(); if (h < 8) return;
    D.last = k; await S.set('d', D);
    for (const c of X.chars()) { if (X.auto(c)) continue; if (Math.random() * 100 < (+D.cfg.taPer || 0)) { await propose(c); break; } }
}
X.action({ key: 'gyx_promise', label: '跟对方定一个今天的小约定（到点来检查）', hint: '关心她：喝水、早睡、吃饭……', need: c => !D.list.some(x => x.cid === String(c.id) && x.day === X.day() && x.by === 'ta'), run: async c => (await propose(c)) ? '跟你定了个小约定' : null }, 'gyxPromise');
window.gyxPromiseOpen = function () {
    const now = Date.now(), open = D.list.filter(x => x.done === null), past = D.list.filter(x => x.done !== null).slice(0, 20);
    const ok = D.list.filter(x => x.by === 'ta' && x.done === true).length, all = D.list.filter(x => x.by === 'ta' && x.done !== null).length;
    const tm = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    window.GYX_PR_WHO = window.GYX_PR_WHO || String((X.cur() || {}).id || '');
    X.panel('gyxPrOv', '🤙 小约定', `<div class="pr-stat"><div><b>${D.stars}</b>攒到的奖励</div><div><b>${all ? Math.round(ok / all * 100) : 0}%</b>做到的</div><div><b>${open.length}</b>进行中</div></div>
        ${open.map(it => { const c = X.char(it.cid); return `<div class="pr-it ${it.by}"><div class="pr-l"><b>${X.esc(it.what)}</b><span>${it.by === 'ta' ? X.esc(X.name(c)) + ' 跟你约的' : '你跟 ' + X.esc(X.name(c)) + ' 约的'} · ${tm(it.due)} ${now >= it.due ? '该检查了' : '检查'}${it.reward ? ' · 🎁 ' + X.esc(it.reward) : ''}</span></div>${it.by === 'ta' ? `<button class="gyx-btn" onclick="gyxPromiseMark('${it.id}',1)">做到了</button><button class="gyx-btn lite" onclick="gyxPromiseMark('${it.id}',0)">没做到</button>` : `<button class="gyx-btn lite" onclick="gyxPromiseMark('${it.id}',1)">TA 做到了</button><button class="gyx-btn lite" onclick="gyxPromiseMark('${it.id}',0)">没做到</button>`}</div>`; }).join('') || '<div class="gyx-tip">现在没有约定。</div>'}
        <div class="gyx-row"><button class="gyx-btn lite" onclick="this.disabled=true;gyxPromiseTa(GYX_PR_WHO).then(()=>gyxPromiseOpen())">让 TA 跟我定一个</button></div>
        <div class="gyx-card"><div class="gyx-tip">你跟 TA 定一个（TA 到点会来汇报）：</div><div class="gyx-row">${X.whoSel(window.GYX_PR_WHO, 'gyxPromiseWho')}<input id="gyxPrW" class="gyx-who" placeholder="比如：今天不许熬夜" style="flex:1"><input id="gyxPrT" class="gyx-who" type="time" value="22:00"><button class="gyx-btn" onclick="gyxPromiseMine()">约好了</button></div></div>
        ${past.length ? '<div class="gyx-tip">以前的约定</div>' + past.map(it => `<div class="pr-old">${it.done ? '✅' : '❌'} ${X.esc(it.what)} <span>${new Date(it.due).toLocaleDateString()} · ${it.by === 'ta' ? 'TA 约你' : '你约 TA'}</span></div>`).join('') : ''}
        <div class="gyx-row gyx-tip">默认模式的 TA 每天有 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.taPer}" style="width:60px" onchange="gyxPromiseCfg(+this.value)">% 的可能跟你定一个；自主模式的 TA 自己决定。</div>`);
};
window.gyxPromiseWho = v => { window.GYX_PR_WHO = v; };
window.gyxPromiseCfg = v => { D.cfg.taPer = v; S.set('d', D); };
window.gyxPromiseData = () => D;
X.ctx(id => { const L = D.list.filter(x => x.cid === String(id) && x.done === null); if (!L.length) return ''; return '【你们的小约定】' + L.map(x => x.by === 'ta' ? `你跟她约好「${x.what}」，${new Date(x.due).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 检查，做到了给她：${x.reward}` : `她跟你约好你要「${x.what}」`).join('；') + '。聊天时可以提醒 / 惦记着。'; }, 'gyxPromise');
X.widget('gyxPromise', { n: '小约定', sizes: ['s', 'm'], tap: () => window.gyxPromiseOpen(), r: w => { const L = D.list.filter(x => x.done === null); if (w.size === 's') return `<div class="gw-pr2 s"><b>🤙</b><em>${L.length ? L.length + ' 个约定' : '没有约定'}</em></div>`; return `<div class="gw-pr2 m"><b>🤙 小约定</b>${L.slice(0, 3).map(x => `<em>· ${X.esc(x.what)}</em>`).join('') || '<em>今天还没有约定</em>'}</div>`; } });
X.css('gyxPrCss', `
.pr-stat{display:flex;gap:8px;margin:6px 0 10px}.pr-stat div{flex:1;background:#f7f7f9;border-radius:14px;padding:10px;text-align:center;font-size:12px;color:#8e8e93}.pr-stat b{display:block;font-size:22px;color:#1d1d1f}
.pr-it{display:flex;gap:8px;align-items:center;padding:10px 12px;border-radius:16px;background:#fff6e8;margin:8px 0}.pr-it.me{background:#eef6ff}.pr-l{flex:1}.pr-l b{display:block;font-size:15px}.pr-l span{font-size:12px;color:#8e8e93}.pr-it .gyx-btn{padding:7px 12px;font-size:13px}
.pr-old{font-size:13px;padding:4px 2px}.pr-old span{color:#aaa;font-size:12px;margin-left:6px}
.gw-pr2{height:100%;display:flex;flex-direction:column;justify-content:center;gap:3px}.gw-pr2.s{align-items:center}.gw-pr2.s b{font-size:30px;font-weight:normal}.gw-pr2 em{font-style:normal;font-size:12.5px;color:var(--pm-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`);
X.today(() => ({ title: '🤙 小约定', rows: D.list.filter(x => x.done === null).map(x => ({ t: new Date(x.due).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), x: X.esc(x.what) + (x.by === 'ta' ? ` <em>${X.esc(X.name(X.char(x.cid)))} 约你的</em>` : ' <em>你约 TA 的</em>'), go: 'gyxPromiseOpen()' })) }), 'gyxPromise');
X.mini({ id: 'gyxPromise', icon: '🤙', title: '小约定', desc: 'TA 跟你定小约定、到点来检查，做到有奖励；你也能跟 TA 定', onOpen: () => window.gyxPromiseOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.list = D.list || []; D.cfg = Object.assign({ taPer: 30 }, D.cfg || {}); setInterval(tick, 60000); setTimeout(tick, 16000); })();
