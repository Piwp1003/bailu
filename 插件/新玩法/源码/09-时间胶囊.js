/* ⏳ 时间胶囊：写给未来某天的信，到日子才能拆；TA 也会偷偷埋几封，哪天突然寄到 */
if (window.__gyxCapsule) return; window.__gyxCapsule = 1;
X.feat('gyxCapsule', { n: '⏳ 时间胶囊', desc: '写给未来某天的信，到日子才能拆；TA 也会偷偷埋几封' });
const S = X.store('capsule');
let D = { list: [], cfg: { taOn: true, per: 10 } };   // {id, from:'me'|cid, to:'ta'|'me', cid, text, sealed, open(at), opened, hidden}
async function taBury(c) {
    const days = Math.round(X.rnd(3, 60));
    let text;
    if (X.bailu()) text = X.cards(['信', '日记', '聊天'], c, 3).join('\n');
    else text = await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 16)}\n\n你偷偷写了一封信，埋进时间胶囊，${days} 天后她才会收到（她现在不知道）。写给 ${days} 天后的她：可以是现在不好意思说的话、对那时候的你们的猜想、想让她那天记起的某件小事。100~300 字，口语，真诚。只输出信的正文。`);
    if (!text) return null;
    const it = { id: 'cp' + Date.now(), from: String(c.id), to: 'me', cid: String(c.id), text: text.trim(), sealed: Date.now(), open: Date.now() + days * 86400000, opened: false, hidden: true };
    D.list.push(it); await S.set('d', D); return it;
}
window.gyxCapsuleTaBury = id => taBury(X.char(id) || X.cur());
async function deliver(it) {
    const c = X.char(it.cid); it.arrived = Date.now(); await S.set('d', D);
    if (it.from === 'me') {
        X.notify(null, `⏳ 你 ${new Date(it.sealed).toLocaleDateString()} 埋下的时间胶囊到了`, it.to === 'me' ? '写给自己的' : `写给 ${X.name(c)} 的`, 'gyxCapsuleOpen');
        if (it.to === 'ta' && c) { const ctx = `她 ${new Date(it.sealed).toLocaleDateString()} 写给你、封进时间胶囊的信今天到了，你刚读完。信里写着：「${it.text.slice(0, 400)}」`; await X.reach(c, ctx); }
    } else {
        X.notify(c, `⏳ 一个时间胶囊寄到了——${X.name(c)} ${Math.round((it.open - it.sealed) / 86400000)} 天前偷偷埋下的`, '点开拆', 'gyxCapsuleOpen');
        X.say(c, '⏳ 我很久以前埋的一个胶囊，今天该到你手上了。');
    }
}
async function tick() { if (!X.on('gyxCapsule')) return;
    for (const it of D.list) if (!it.arrived && Date.now() >= it.open) await deliver(it);
    // TA 偷偷埋：默认模式的 TA 每天有一点点概率；自主模式的 TA 自己决定
    if (!D.cfg.taOn) return;
    const k = X.day(); if (D.last === k) return; D.last = k; await S.set('d', D);
    for (const c of X.chars()) { if (X.auto(c)) continue; if (Math.random() * 100 < (+D.cfg.per || 0)) { await taBury(c); break; } }
}
X.action({ key: 'gyx_capsule', label: '偷偷写一封信埋进时间胶囊（很久以后她才收到）', hint: '现在不好意思说的话', need: () => D.cfg.taOn, run: async c => (await taBury(c)) ? '（偷偷埋了一个时间胶囊）' : null }, 'gyxCapsule');
window.gyxCapsuleOpen = function (tab) {
    const now = Date.now(), cs = X.chars();
    const mine = D.list.filter(i => i.from === 'me'), theirs = D.list.filter(i => i.from !== 'me' && (i.arrived || !i.hidden));
    const buried = D.list.filter(i => i.from !== 'me' && i.hidden && !i.arrived).length;
    const card = it => { const ready = it.arrived || now >= it.open; const c = X.char(it.cid); return `<div class="cp-it${ready ? ' ready' : ''}${it.opened ? ' opened' : ''}"><div class="cp-cap">${ready ? (it.opened ? '📜' : '💊') : '🔒'}</div><div class="cp-m"><b>${it.from === 'me' ? (it.to === 'me' ? '写给未来的自己' : '写给 ' + X.esc(X.name(c))) : X.esc(X.name(c)) + ' 写给你'}</b><span>${new Date(it.sealed).toLocaleDateString()} 封存 · ${ready ? '已经可以拆了' : '还有 ' + Math.ceil((it.open - now) / 86400000) + ' 天'}</span>${it.opened ? `<p class="gyx-hand">${X.esc(it.text).replace(/\n/g, '<br>')}</p>` : ''}</div>${ready && !it.opened ? `<button class="gyx-btn" onclick="gyxCapsuleCrack('${it.id}')">拆开</button>` : ''}</div>`; };
    X.panel('gyxCpOv', '⏳ 时间胶囊', `
        <div class="cp-new"><div class="gyx-row">写给：<select id="gyxCpTo" class="gyx-who"><option value="me">未来的自己</option>${cs.map(c => `<option value="${X.esc(c.id)}">${X.esc(X.name(c))}</option>`).join('')}</select> 什么时候拆：<input id="gyxCpAt" class="gyx-who" type="date" min="${X.day(new Date(now + 86400000))}" value="${X.day(new Date(now + 30 * 86400000))}"></div>
        <textarea id="gyxCpTx" class="gyx-in gyx-hand" rows="5" placeholder="写给那天的……" style="font-size:18px"></textarea><div class="gyx-row"><button class="gyx-btn" onclick="gyxCapsuleSeal()">封起来埋掉</button><span class="gyx-tip">封起来之后，到日子之前谁都看不到（你也看不到）。</span></div></div>
        ${theirs.length || buried ? `<div class="gyx-tip">TA 写给你的${buried ? ` · 还有 ${buried} 个你不知道在哪的胶囊埋在土里` : ''}</div>${theirs.map(card).join('')}` : ''}
        ${mine.length ? '<div class="gyx-tip">你埋下的</div>' + mine.slice().reverse().map(card).join('') : ''}
        <div class="gyx-row gyx-tip"><label><input type="checkbox" ${D.cfg.taOn ? 'checked' : ''} onchange="gyxCapsuleCfg('taOn',this.checked)"> TA 会偷偷埋胶囊</label>（默认模式的 TA 每天 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.per}" style="width:60px" onchange="gyxCapsuleCfg('per',+this.value)">% 的可能；自主模式的 TA 自己决定）</div>`);
};
window.gyxCapsuleCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxCapsuleSeal = async function () {
    const t = ((document.getElementById('gyxCpTx') || {}).value || '').trim(); if (!t) { X.toast('还没写呢'); return; }
    const to = (document.getElementById('gyxCpTo') || {}).value || 'me', at = (document.getElementById('gyxCpAt') || {}).value;
    const open = at ? new Date(at + 'T08:00:00').getTime() : Date.now() + 30 * 86400000;
    const c = to === 'me' ? null : X.char(to);
    D.list.push({ id: 'cp' + Date.now(), from: 'me', to: to === 'me' ? 'me' : 'ta', cid: c ? String(c.id) : '', text: t, sealed: Date.now(), open, opened: false });
    await S.set('d', D);
    const ov = document.getElementById('gyxCpOv'); if (ov) { ov.querySelector('.cp-new').classList.add('bury'); setTimeout(() => window.gyxCapsuleOpen(), 900); }
    X.toast('⏳ 埋好了', `${new Date(open).toLocaleDateString()} 才能拆`);
    if (c) X.reach(c, `她刚写了一封信给你，封进了时间胶囊，${new Date(open).toLocaleDateString()} 才能拆（你现在看不到内容，只知道有这么一封）`);
};
window.gyxCapsuleCrack = async function (id) {
    const it = D.list.find(x => x.id === id); if (!it) return;
    it.opened = true; it.arrived = it.arrived || Date.now(); await S.set('d', D);
    const c = X.char(it.cid);
    const ov = X.panel('gyxCpRead', '', `<div class="cp-read"><div class="cp-shell"><i></i><i></i></div><div class="cp-paper gyx-hand"><div class="cp-d">${new Date(it.sealed).toLocaleDateString()} 写 · ${new Date().toLocaleDateString()} 拆</div>${X.esc(it.text).replace(/\n/g, '<br>')}<div class="cp-sig">—— ${it.from === 'me' ? '过去的你' : X.esc(X.name(c))}</div></div></div>`);
    ov.addEventListener('click', () => window.gyxCapsuleOpen(), { once: true });
    if (it.from !== 'me' && c) setTimeout(() => X.reach(c, `她刚拆开了你 ${Math.round((Date.now() - it.sealed) / 86400000)} 天前偷偷埋下的时间胶囊，信里你写的是：「${it.text.slice(0, 300)}」`), 4000);
};
X.css('gyxCpCss', `
.cp-new{border-radius:18px;background:linear-gradient(160deg,#fff8ec,#fdeee0);padding:10px 14px;margin-bottom:10px;transition:transform .8s cubic-bezier(.6,-.3,.7,1),opacity .8s}.cp-new.bury{transform:translateY(60px) scale(.3);opacity:0}
.cp-it{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:16px;background:#f7f7f9;margin:8px 0}.cp-it.ready{background:#fff4e0}.cp-cap{font-size:28px}.cp-m{flex:1}.cp-m b{display:block;font-size:14px}.cp-m span{font-size:12px;color:#8e8e93}.cp-m p{font-size:18px;line-height:1.8;margin:8px 0 0}
.cp-read{padding:20px 0;display:flex;flex-direction:column;align-items:center}.cp-shell{position:relative;width:90px;height:40px;margin-bottom:-10px}.cp-shell i{position:absolute;top:0;width:45px;height:40px;background:linear-gradient(135deg,#ffd6a5,#ffadad);border-radius:20px 0 0 20px;left:0;animation:cpL 1s forwards}.cp-shell i+i{left:45px;border-radius:0 20px 20px 0;background:linear-gradient(135deg,#bde0fe,#cdb4db);animation:cpR 1s forwards}
@keyframes cpL{to{transform:translate(-40px,-10px) rotate(-30deg);opacity:.4}}@keyframes cpR{to{transform:translate(40px,-10px) rotate(30deg);opacity:.4}}
.cp-paper{width:100%;box-sizing:border-box;padding:24px 22px;background:#fffdf5;border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.1);font-size:20px;line-height:1.9;color:#3b3530;animation:cpUp 1s .5s both}.cp-d{font-size:13px;color:#a09380;margin-bottom:10px;font-family:-apple-system,sans-serif}.cp-sig{text-align:right;margin-top:14px}
@keyframes cpUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
`);
X.today(() => { const now = Date.now(), rows = []; const ready = D.list.filter(i => (i.arrived || now >= i.open) && !i.opened && (i.from === 'me' || i.arrived)); if (ready.length) rows.push({ t: '可以拆了', x: `<b>${ready.length} 个胶囊到了</b>`, go: 'gyxCapsuleOpen()' }); const next = D.list.filter(i => i.from === 'me' && !i.opened && now < i.open).sort((a, b) => a.open - b.open)[0]; if (next) rows.push({ t: '还有 ' + Math.ceil((next.open - now) / 86400000) + ' 天', x: '下一个你埋的胶囊', go: 'gyxCapsuleOpen()' }); return { title: '⏳ 时间胶囊', rows }; }, 'gyxCapsule');
X.mini({ id: 'gyxCapsule', icon: '⏳', title: '时间胶囊', desc: '写给未来某天的信，到日子才能拆；TA 也会偷偷埋几封', onOpen: () => window.gyxCapsuleOpen() });
window.gyxCapsuleData = () => D;
(async () => { D = Object.assign(D, await S.get('d', {})); D.list = D.list || []; D.cfg = Object.assign({ taOn: true, per: 10 }, D.cfg || {}); setInterval(tick, 5 * 60000); setTimeout(tick, 15000); })();
