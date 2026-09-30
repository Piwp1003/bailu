/* 🌱 一起养一个小生命：一盆花或一只小猫；你们聊得越多长得越好，你能浇水/喂它，TA 也会自己去照顾还跟你汇报 */
if (window.__gyxPet2) return; window.__gyxPet2 = 1;
X.feat('gyxGrow', { n: '🌱 一起养小生命', desc: '一盆花或一只小猫，聊得越多长得越好；TA 也会去照顾它' });
const S = X.store('grow');
let D = { list: [] };   // {id, kind:'plant'|'cat', name, cid, born, exp, water(0-100), love(0-100), last, log:[], chatSeen}
const KINDS = { plant: { n: '一盆花', stages: ['🌰 种子', '🌱 发芽', '🌿 长叶子', '🪴 抽枝', '🌷 开花', '💐 满盆花'], need: '浇水', act: '浇了水', icon: '💧' }, cat: { n: '一只小猫', stages: ['🥚 刚捡回来', '🐱 小奶猫', '🐈 小猫', '😺 半大猫', '🐈‍⬛ 大猫', '👑 猫主子'], need: '喂猫粮', act: '喂了猫粮', icon: '🐟' } };
const STEP = [0, 30, 90, 200, 380, 650];
const stage = p => { let s = 0; STEP.forEach((v, i) => { if (p.exp >= v) s = i; }); return s; };
function decay(p) {   // 时间流逝：水/饱慢慢掉，一天大约掉 40
    const h = (Date.now() - (p.last || Date.now())) / 3600000; if (h <= 0) return;
    p.water = Math.max(0, p.water - h * 1.7); p.love = Math.max(0, p.love - h * 0.8); p.last = Date.now();
}
const mood = p => p.water < 20 ? (p.kind === 'plant' ? '有点蔫了' : '饿得喵喵叫') : p.love < 25 ? '想你们陪陪它' : p.water > 70 && p.love > 60 ? '状态超好' : '还不错';
function log(p, t) { p.log.unshift({ t, at: Date.now() }); if (p.log.length > 200) p.log.length = 200; }
// 你们聊天：每天有新消息就长一点（每 5 条 +1）
function chatGrow() { if (!X.on('gyxGrow')) return;
    let ch = false;
    D.list.forEach(p => { const H = (typeof globalChats !== 'undefined' && globalChats[p.cid]) || []; const n = H.filter(m => m.sender !== 'system').length; if (p.chatSeen == null) { p.chatSeen = n; ch = true; return; } if (n - p.chatSeen >= 5) { const g = Math.floor((n - p.chatSeen) / 5); p.exp += g; p.love = Math.min(100, p.love + g * 2); p.chatSeen += g * 5; ch = true; } });
    if (ch) S.set('d', D);
}
window.gyxGrowCare = async function (id, who) {
    const p = D.list.find(x => x.id === id); if (!p) return; decay(p);
    const K = KINDS[p.kind], s0 = stage(p);
    if (who === 'me') { p.water = Math.min(100, p.water + 35); p.love = Math.min(100, p.love + 8); p.exp += 3; log(p, `你${K.act}`); }
    else if (who === 'pat') { p.love = Math.min(100, p.love + 15); p.exp += 1; log(p, p.kind === 'cat' ? '你摸了摸它，它呼噜呼噜' : '你跟它说了会儿话'); }
    await S.set('d', D);
    if (stage(p) > s0) { const c = X.char(p.cid); X.toast(`${K.stages[stage(p)]}！`, `${p.name} 长大了`); X.say(c, await report(p, 'grow')); }
    paint();
};
async function report(p, why) {
    const c = X.char(p.cid), K = KINDS[p.kind];
    if (X.bailu()) return X.cards(['养成', '聊天'], c, 1)[0] || (why === 'grow' ? `${p.name}${K.stages[stage(p)].slice(2)}了！` : `我刚给${p.name}${K.act}。`);
    const t = await X.ask(`${X.who(c)}\n你们一起养了${K.n}，叫「${p.name}」，现在是「${K.stages[stage(p)]}」阶段，状态：${mood(p)}。\n${why === 'grow' ? '它刚刚长大了一个阶段！' : why === 'care' ? '你刚刚自己去' + K.act + '，顺便看了看它。' : '你想跟她说说它的近况。'}跟她说一句（口语，不超过 50 字，可以带点细节）。只输出这句话。`);
    return t ? X.plain(t) : `我刚去看了看${p.name}。`;
}
// TA 自己去照顾：默认模式的 TA 每天随机一次；自主模式的 TA 自己决定（在行动菜单里）
async function taCare(p) {
    const c = X.char(p.cid); if (!c) return null; decay(p);
    p.water = Math.min(100, p.water + 35); p.exp += 2; log(p, `${X.name(c)} ${KINDS[p.kind].act}`); p.taDay = X.day();
    await S.set('d', D);
    const t = await report(p, 'care'); X.say(c, t); return t;
}
window.gyxGrowTaCare = id => taCare(D.list.find(x => x.id === id));
X.action({ key: 'gyx_grow', label: '去照顾你们一起养的小生命', hint: '浇水 / 喂它，顺便跟她汇报', need: c => D.list.some(p => p.cid === String(c.id) && p.taDay !== X.day()), run: async c => { const p = D.list.find(x => x.cid === String(c.id) && x.taDay !== X.day()); return p && (await taCare(p)) ? `照顾了${p.name}` : null; } }, 'gyxGrow');
async function tick() { if (!X.on('gyxGrow')) return;
    chatGrow();
    for (const p of D.list) { decay(p); const c = X.char(p.cid); if (!c || X.auto(c) || p.taDay === X.day()) continue; const h = new Date().getHours(); if (h >= 9 && h <= 22 && Math.random() < 0.15) await taCare(p); }
    await S.set('d', D); paint(); X.repaint();
}
window.gyxGrowNew = async function (kind, cid, name) {
    const c = X.char(cid) || X.cur(); if (!c) return;
    const p = { id: 'g' + Date.now(), kind, name: name || (kind === 'cat' ? '团子' : '小芽'), cid: String(c.id), born: Date.now(), exp: 0, water: 70, love: 60, last: Date.now(), log: [], chatSeen: null };
    log(p, `你和 ${X.name(c)} 一起${kind === 'cat' ? '捡回了一只小猫' : '种下了一颗种子'}`); D.list.push(p); await S.set('d', D);
    X.say(c, kind === 'cat' ? `以后${p.name}就是我们的猫了。` : `种子种下了，我们一起等${p.name}发芽。`);
    window.gyxGrowOpen(); return p;
};
function art(p) {
    const s = stage(p), sad = p.water < 20;
    if (p.kind === 'plant') {
        const h = [8, 26, 48, 70, 88, 96][s], leaves = [0, 2, 4, 6, 8, 12][s], fl = s >= 4 ? (s === 5 ? 5 : 2) : 0;
        let g = `<path d="M100 170 Q ${sad ? 110 : 100} ${170 - h / 2} ${sad ? 118 : 100} ${170 - h}" stroke="#4f9a5b" stroke-width="4" fill="none" stroke-linecap="round"/>`;
        for (let i = 0; i < leaves; i++) { const y = 165 - (i + 1) * h / (leaves + 1), sd = i % 2 ? 1 : -1; g += `<path d="M${100 + (sad ? i : 0)} ${y} q ${sd * 22} ${-8 + (sad ? 14 : 0)} ${sd * 30} ${4 + (sad ? 10 : 0)} q ${-sd * 14} 8 ${-sd * 30} -4 z" fill="#7cc38a"/>`; }
        for (let i = 0; i < fl; i++) { const x = 100 + (i - (fl - 1) / 2) * 22, y = 170 - h - (i % 2) * 10; g += `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map(a => `<ellipse rx="7" ry="11" transform="rotate(${a}) translate(0 -9)" fill="#ff8fb1"/>`).join('')}<circle r="5" fill="#ffd166"/></g>`; }
        if (s === 0) g = `<ellipse cx="100" cy="164" rx="9" ry="6" fill="#a47148"/>`;
        return `<svg viewBox="0 0 200 220"><path d="M60 170 L140 170 L130 212 L70 212 Z" fill="#d98b5f"/><rect x="54" y="162" width="92" height="12" rx="4" fill="#c7764a"/>${g}</svg>`;
    }
    const sc = [0.5, 0.62, 0.74, 0.86, 1, 1.08][s], col = ['#f4e3c1', '#f2c38b', '#f2c38b', '#e8a86a', '#e8a86a', '#e0955a'][s];
    if (s === 0) return `<svg viewBox="0 0 200 220"><ellipse cx="100" cy="190" rx="60" ry="10" fill="#0001"/><path d="M60 180 q40 -70 80 0 z" fill="#d7b48a"/><circle cx="92" cy="160" r="3" fill="#333"/><circle cx="108" cy="160" r="3" fill="#333"/><path d="M82 142 l6 -14 l8 12 M118 142 l-6 -14 l-8 12" fill="#f2c38b"/></svg>`;
    return `<svg viewBox="0 0 200 220"><ellipse cx="100" cy="200" rx="${60 * sc}" ry="9" fill="#0001"/><g transform="translate(100 200) scale(${sc}) translate(-100 -200)">
        <path d="M150 170 q40 -10 30 -50" stroke="${col}" stroke-width="10" fill="none" stroke-linecap="round" class="gr-tail"/>
        <ellipse cx="100" cy="165" rx="52" ry="38" fill="${col}"/><circle cx="100" cy="105" r="40" fill="${col}"/>
        <path d="M66 85 l-6 -34 l30 20 z M134 85 l6 -34 l-30 20 z" fill="${col}"/><path d="M70 80 l-3 -18 l14 10 z M130 80 l3 -18 l-14 10 z" fill="#ffb3c1"/>
        ${sad ? '<path d="M82 104 q6 -4 12 0 M106 104 q6 -4 12 0" stroke="#333" stroke-width="3" fill="none"/>' : '<circle cx="86" cy="104" r="5" fill="#333"/><circle cx="114" cy="104" r="5" fill="#333"/>'}
        <path d="M96 116 l4 4 l4 -4 z" fill="#ff8fa3"/><path d="M100 120 q-6 8 -12 4 M100 120 q6 8 12 4" stroke="#333" stroke-width="2" fill="none"/>
        <path d="M70 118 l-24 -4 M70 124 l-24 4 M130 118 l24 -4 M130 124 l24 4" stroke="#333" stroke-width="1.5"/></g></svg>`;
}
let SEL = '';
function paint() {
    const b = document.getElementById('gyxGrBody'); if (!b) return;
    if (!D.list.length) {
        b.innerHTML = `<div class="gyx-tip">和谁一起养？</div><div class="gyx-row">${X.whoSel((X.cur() || {}).id, 'gyxGrowWho')}</div>
        <div class="gr-pick"><div onclick="gyxGrowNew('plant',GYX_GROW_WHO)"><span>🌱</span>种一盆花</div><div onclick="gyxGrowNew('cat',GYX_GROW_WHO)"><span>🐱</span>养一只小猫</div></div>`; return;
    }
    const p = D.list.find(x => x.id === SEL) || D.list[0]; SEL = p.id; decay(p);
    const K = KINDS[p.kind], s = stage(p), c = X.char(p.cid), nx = STEP[s + 1];
    b.innerHTML = `<div class="gyx-row">${D.list.map(x => `<span class="gyx-chip ${x.id === p.id ? 'on' : ''}" onclick="gyxGrowSel('${x.id}')">${KINDS[x.kind].stages[stage(x)].split(' ')[0]} ${X.esc(x.name)}</span>`).join('')}<span class="gyx-chip" onclick="gyxGrowAdd()">＋ 再养一个</span></div>
        <div class="gr-stage ${p.kind}">${art(p)}</div>
        <div class="gr-name">${X.esc(p.name)} <em>${K.stages[s]}</em></div><div class="gyx-tip" style="text-align:center">和 ${X.esc(X.name(c))} 一起养的 · 第 ${Math.floor((Date.now() - p.born) / 86400000) + 1} 天 · ${mood(p)}</div>
        <div class="gr-bars"><div>${p.kind === 'cat' ? '饱饱' : '水分'}<i><b style="width:${p.water}%;background:#5ab0ff"></b></i></div><div>开心<i><b style="width:${p.love}%;background:#ff8fb1"></b></i></div><div>成长<i><b style="width:${nx ? Math.min(100, (p.exp - STEP[s]) / (nx - STEP[s]) * 100) : 100}%;background:#7cc38a"></b></i></div></div>
        <div class="gyx-row" style="justify-content:center"><button class="gyx-btn" onclick="gyxGrowCare('${p.id}','me')">${K.icon} ${K.need}</button><button class="gyx-btn lite" onclick="gyxGrowCare('${p.id}','pat')">${p.kind === 'cat' ? '🤚 摸摸' : '💬 跟它说话'}</button></div>
        <div class="gyx-tip">你们多聊天它就长得快；${X.esc(X.name(c))} 也会自己去${K.need}，然后告诉你。</div>
        <div class="gr-log">${p.log.slice(0, 12).map(l => `<div><span>${new Date(l.at).toLocaleString()}</span>${X.esc(l.t)}</div>`).join('')}</div>`;
}
window.GYX_GROW_WHO = '';
window.gyxGrowWho = v => { window.GYX_GROW_WHO = v; };
window.gyxGrowSel = id => { SEL = id; paint(); };
window.gyxGrowAdd = () => { const b = document.getElementById('gyxGrBody'); b.innerHTML = `<div class="gyx-row">${X.whoSel((X.cur() || {}).id, 'gyxGrowWho')}</div><div class="gr-pick"><div onclick="gyxGrowNew('plant',GYX_GROW_WHO)"><span>🌱</span>种一盆花</div><div onclick="gyxGrowNew('cat',GYX_GROW_WHO)"><span>🐱</span>养一只小猫</div></div>`; };
window.gyxGrowOpen = function () { window.GYX_GROW_WHO = String((X.cur() || {}).id || ''); X.panel('gyxGrOv', '🌱 一起养的小生命', '<div id="gyxGrBody"></div>'); paint(); };
window.gyxGrowData = () => D;
X.widget('gyxGrow', { n: '小生命', sizes: ['s', 'm'], tap: () => window.gyxGrowOpen(), r: w => { const p = D.list[0]; if (!p) return '<div class="gw-gr s"><b>🌱</b><em>一起养一个</em></div>'; return `<div class="gw-gr ${w.size}"><div class="a">${art(p)}</div>${w.size === 'm' ? `<div class="t"><b>${X.esc(p.name)}</b><em>${KINDS[p.kind].stages[stage(p)]}</em><em>${mood(p)}</em></div>` : ''}</div>`; } });
X.ctx(id => { const L = D.list.filter(p => p.cid === String(id)); if (!L.length) return ''; return '【你们一起养的】' + L.map(p => `${KINDS[p.kind].n}「${p.name}」（${KINDS[p.kind].stages[stage(p)]}，${mood(p)}）`).join('；') + '。聊天时偶尔可以提到它。'; }, 'gyxGrow');
X.css('gyxGrCss', `
.gr-pick{display:flex;gap:12px;margin:12px 0}.gr-pick div{flex:1;text-align:center;padding:18px 8px;border-radius:18px;background:#f7f7f9;cursor:pointer;font-size:14px}.gr-pick span{display:block;font-size:44px;margin-bottom:6px}
.gr-stage{height:220px;display:flex;justify-content:center;border-radius:20px;background:linear-gradient(180deg,#eef7ff,#f9fbf2)}.gr-stage svg{height:100%}.gr-stage.cat .gr-tail{animation:grTail 1.6s ease-in-out infinite;transform-origin:150px 170px}
@keyframes grTail{0%,100%{transform:rotate(0)}50%{transform:rotate(12deg)}}
.gr-name{text-align:center;font-size:20px;margin-top:8px}.gr-name em{font-style:normal;font-size:13px;color:#8e8e93;margin-left:6px}
.gr-bars{margin:10px 0}.gr-bars div{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#666;margin:5px 0}.gr-bars i{flex:1;height:8px;border-radius:4px;background:#f0f0f3;overflow:hidden}.gr-bars b{display:block;height:100%;border-radius:4px;transition:width .5s}
.gr-log{font-size:12.5px;color:#666;line-height:1.9;max-height:160px;overflow:auto}.gr-log span{color:#aaa;margin-right:8px}
.gw-gr{height:100%;display:flex;align-items:center;gap:8px}.gw-gr.s{flex-direction:column;justify-content:center}.gw-gr .a{height:100%;flex-shrink:0}.gw-gr .a svg{height:100%}.gw-gr .t{display:flex;flex-direction:column;gap:2px}.gw-gr em{font-style:normal;font-size:12px;color:var(--pm-sub)}.gw-gr.s b{font-size:34px;font-weight:normal}
`);
X.today(() => ({ title: '🌱 小生命', rows: D.list.map(p => ({ t: KINDS[p.kind].stages[stage(p)].split(' ')[0] + ' ' + p.name, x: `${mood(p)}${p.taDay === X.day() ? ' · TA 今天照顾过了' : ''}`, go: 'gyxGrowOpen()' })) }), 'gyxGrow');
X.mini({ id: 'gyxGrow', icon: '🌱', title: '一起养小生命', desc: '一盆花或一只小猫，聊得越多长得越好；TA 也会去照顾它', onOpen: () => window.gyxGrowOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.list = D.list || []; setInterval(tick, 20 * 60000); setTimeout(chatGrow, 5000); setInterval(chatGrow, 60000); })();
