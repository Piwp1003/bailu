/* 🍁 随机掉落收藏册：打开 App 的时候，屏幕上偶尔会飘下来一个 TA 留的小东西——一片叶子、一颗糖、一张小纸条、一枚星星……点一下捡起来，收进图鉴，第一次捡到的 TA 会附一句话。有普通、稀有、传说三种，传说的很难遇到 */
if (window.__gyxDrop) return; window.__gyxDrop = 1;
X.feat('gyxDrop', { n: '🍁 随机掉落收藏册', desc: '屏幕上偶尔飘下 TA 留的小东西，捡起来收进图鉴' });
const S = X.store('drop');
const ITEMS = [
    ['leaf', '🍁', '一片枫叶', 1], ['leaf2', '🍃', '一片绿叶', 1], ['petal', '🌸', '一片花瓣', 1], ['candy', '🍬', '一颗糖', 1], ['choco', '🍫', '一块巧克力', 1], ['note', '📝', '一张小纸条', 1], ['shell', '🐚', '一枚贝壳', 1], ['button', '🔘', '一颗纽扣', 1], ['ticket', '🎫', '一张旧票根', 1], ['feather', '🪶', '一根羽毛', 1], ['stone', '🪨', '一颗小石子', 1], ['clover3', '☘️', '三叶草', 1], ['cookie', '🍪', '一块小饼干', 1], ['bandaid', '🩹', '一张创可贴', 1], ['pencil', '✏️', '一截铅笔', 1], ['sock', '🧦', '一只袜子', 1],
    ['star', '⭐', '一颗星星', 2], ['moon', '🌙', '一弯月亮', 2], ['heart', '💗', '一颗心', 2], ['letter', '💌', '一封没寄出的信', 2], ['ring', '💍', '一枚戒指（玩具的）', 2], ['key', '🔑', '一把小钥匙', 2], ['bear', '🧸', '一只小熊', 2], ['clover4', '🍀', '四叶草', 2], ['photo', '🖼️', '一张拍立得', 2], ['shellpearl', '🦪', '藏着珍珠的贝壳', 2], ['music', '🎵', '一段旋律', 2], ['balloon', '🎈', '一只气球', 2], ['umbrella', '☂️', '一把小伞', 2],
    ['comet', '☄️', '一颗流星', 3], ['crown', '👑', '一顶小王冠', 3], ['rainbow', '🌈', '一截彩虹', 3], ['crystal', '🔮', '会发光的水晶球', 3], ['unicorn', '🦄', '一只独角兽', 3], ['firefly', '✨', '一瓶萤火虫', 3], ['lovekey', '🗝️', '打开 TA 心的钥匙', 3]
];
const RAR = { 1: ['普通', '#9aa5b1'], 2: ['稀有', '#4c8dff'], 3: ['传说', '#ff9f1a'] };
const NOTE = { 1: ['路上看到的，觉得你会喜欢。', '顺手给你留的。', '收好，别弄丢了。', '今天想你的时候捡的。'], 2: ['这个可不好找，找了很久。', '留给你的，只有你能捡到。', '偷偷放这儿的，被你发现了。'], 3: ['……这个是我最珍贵的东西，给你了。', '能捡到这个，说明我们缘分很深。', '这个世界上只有一个，现在是你的了。'] };
let D = { got: {}, day: '', today: 0, cfg: { p: 35, max: 5 } };   // got[cid][itemId] = {n, first, note}
function roll() { const r = Math.random(); const rar = r < .04 ? 3 : r < .25 ? 2 : 1; return X.pick(ITEMS.filter(i => i[3] === rar)); }
function drop(it, c) {
    if (document.getElementById('gyxDropIt') || !it) return false; c = c || X.cur(); if (!c) return false;
    const el = document.createElement('div'); el.id = 'gyxDropIt'; el.className = 'drop-it r' + it[3]; el.innerHTML = `<span>${it[1]}</span>`; el.title = '点一下捡起来';
    el.style.left = Math.round(X.rnd(.12, .82) * innerWidth) + 'px'; el.setAttribute('data-i', it[0]); el.setAttribute('data-c', String(c.id));
    el.onclick = () => window.gyxDropPick(); document.body.appendChild(el);
    setTimeout(() => { const e = document.getElementById('gyxDropIt'); if (e && e === el) { e.classList.add('gone'); setTimeout(() => e.remove(), 900); } }, 60000);
    return true;
}
window.gyxDropNow = (itemId, cid) => { const it = itemId ? ITEMS.find(i => i[0] === itemId) : roll(); return drop(it, X.char(cid) || X.cur()); };
window.gyxDropPick = async () => {
    const el = document.getElementById('gyxDropIt'); if (!el) return null; const id = el.getAttribute('data-i'), cid = el.getAttribute('data-c'), it = ITEMS.find(i => i[0] === id), c = X.char(cid);
    el.classList.add('got'); setTimeout(() => el.remove(), 700); if (!it || !c) return null;
    const G = (D.got[cid] = D.got[cid] || {}), first = !G[id];
    if (first) { let note = X.bailu() ? null : X.plain(await X.ask(`${X.who(c)}\n你偷偷给她留了「${it[2]}」，她刚捡到了。写一句附在上面的小纸条（20 字以内）。`) || ''); G[id] = { n: 1, first: Date.now(), note: note || X.pick(X.cards(['情话'], c, 1).filter(x => x.length <= 24).concat(NOTE[it[3]])) }; }
    else G[id].n++;
    await S.set('d', D);
    X.toast(`${it[1]} ${first ? X.v('新收集', '第一次捡到', '图鉴 +1') : '又捡到一个'}：${it[2]}`, first ? `${RAR[it[3]][0]} · ${X.name(c)}：${G[id].note}` : `已经有 ${G[id].n} 个了`);
    return { id, first, n: G[id].n };
};
async function maybe(force) {
    if (!X.on('gyxDrop')) return; const d = X.day(); if (D.day !== d) { D.day = d; D.today = 0; }
    if (D.today >= (+D.cfg.max || 5) || document.hidden) return; if (!force && Math.random() * 100 >= (+D.cfg.p || 35)) return;
    if (drop(roll())) { D.today++; await S.set('d', D); }
}
window.gyxDropCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxDropData = () => D;
window.gyxDropOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), G = D.got[cid] || {}, n = Object.keys(G).length;
    X.panel('gyxDropOv', '🍁 收藏册', `<div class="gyx-row">${X.whoSel(cid, 'gyxDropOpen')}<span class="gyx-tip">${n} / ${ITEMS.length} · 今天掉了 ${D.day === X.day() ? D.today : 0} 个</span></div>
        ${[1, 2, 3].map(r => `<div class="drop-h" style="color:${RAR[r][1]}">${RAR[r][0]}</div><div class="drop-grid">${ITEMS.filter(i => i[3] === r).map(i => { const g = G[i[0]]; return `<div class="${g ? 'on' : ''}" title="${g ? X.esc(g.note) : ''}"><span>${g ? i[1] : '？'}</span><b>${g ? X.esc(i[2]) : '？？？'}</b>${g ? `<em>×${g.n}</em><i>${X.esc(g.note)}</i>` : ''}</div>`; }).join('')}</div>`).join('')}
        <div class="gyx-row gyx-tip">打开 App 时掉落的概率 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.p}" style="width:56px" onchange="gyxDropCfg('p',+this.value)">% · 一天最多 <input class="gyx-who" type="number" min="0" value="${D.cfg.max}" style="width:50px" onchange="gyxDropCfg('max',+this.value)"> 个</div>`);
};
X.ctx(id => { const G = D.got[String(id)] || {}, k = Object.keys(G); if (!k.length) return ''; const last = k.sort((a, b) => G[b].first - G[a].first)[0], it = ITEMS.find(i => i[0] === last); return `【你偷偷给她留的小东西】她已经捡到 ${k.length} 种，最近一个是「${it ? it[2] : last}」。`; }, 'gyxDrop');
X.action({ key: 'gyx_drop', label: '偷偷在她的屏幕上留个小东西', hint: '随机掉落', need: () => !document.getElementById('gyxDropIt') && !document.hidden, run: async c => drop(roll(), c) ? '留了个小东西' : null }, 'gyxDrop');
X.today(() => { const rows = []; X.chars().forEach(c => { const G = D.got[String(c.id)] || {}; Object.keys(G).filter(k => X.day(new Date(G[k].first)) === X.day()).forEach(k => { const it = ITEMS.find(i => i[0] === k); if (it) rows.push({ t: it[1], x: '新收集：' + it[2], go: `gyxDropOpen('${c.id}')` }); }); }); return { title: '🍁 收藏册', rows }; }, 'gyxDrop');
X.widget('gyxDropW', { n: '收藏册', sizes: ['s', 'm'], tap: () => window.gyxDropOpen(), r: w => { const c = X.cur(), G = c ? D.got[String(c.id)] || {} : {}, k = Object.keys(G); return X.gw(w, k.length ? (ITEMS.find(i => i[0] === k.sort((a, b) => G[b].first - G[a].first)[0]) || [, '🍁'])[1] : '🍁', '收藏册', [k.length + ' / ' + ITEMS.length, k.some(x => (ITEMS.find(i => i[0] === x) || [])[3] === 3) ? '有传说级！' : '']); } }, 'gyxDrop');
X.mem({ k: 'gyxDrop', ico: '🍁', n: '收藏册', d: '捡到的小东西和 TA 附的话', items: c => { const G = D.got[String(c.id)] || {}; return Object.keys(G).map(k => Object.assign(G[k], { k })); }, text: x => x.note, edit: (x, v) => { x.note = v; }, del: (c, i) => { const G = D.got[String(c.id)] || {}; delete G[Object.keys(G)[i]]; }, meta: x => { const it = ITEMS.find(i => i[0] === x.k); return (it ? it[1] + ' ' + it[2] : x.k) + ' ×' + x.n; }, save: () => S.set('d', D) }, 'gyxDrop');
X.css('gyxDropCss', `.drop-it{position:fixed;top:-60px;z-index:99990;font-size:40px;cursor:pointer;animation:dropf 6s ease-in forwards,drops 2.4s ease-in-out infinite;filter:drop-shadow(0 4px 6px rgba(0,0,0,.2));user-select:none}.drop-it span{display:inline-block}.drop-it.r2 span{filter:drop-shadow(0 0 8px #7fb0ff)}.drop-it.r3 span{filter:drop-shadow(0 0 12px #ffc95c);animation:dropg 1.2s ease-in-out infinite}@keyframes dropf{to{top:62vh}}@keyframes drops{50%{transform:translateX(18px) rotate(14deg)}}@keyframes dropg{50%{transform:scale(1.15)}}.drop-it.got{animation:dropgot .6s forwards}@keyframes dropgot{to{transform:scale(2) translateY(-30px);opacity:0}}.drop-it.gone{transition:opacity .8s;opacity:0}.drop-h{font-weight:800;margin:12px 0 6px;font-size:13px}.drop-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}.drop-grid>div{border-radius:14px;background:#f5f5f7;padding:8px 6px;text-align:center;position:relative;opacity:.55}.drop-grid>div.on{opacity:1;background:#fffaf2}.drop-grid span{font-size:28px;display:block}.drop-grid b{display:block;font-size:12px}.drop-grid em{position:absolute;top:4px;right:6px;font-style:normal;font-size:11px;color:#c07a2a}.drop-grid i{display:block;font-style:normal;font-size:10.5px;color:#999;line-height:1.35;margin-top:2px}`);
X.mini({ id: 'gyxDrop', icon: '🍁', title: '随机掉落收藏册', desc: '捡 TA 留在屏幕上的小东西', cat: '回忆', onOpen: () => window.gyxDropOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.got = D.got || {}; D.cfg = Object.assign({ p: 35, max: 5 }, D.cfg || {}); setTimeout(() => maybe(), 20000); setInterval(() => { if (Math.random() < .2) maybe(true); }, 900000); })();
