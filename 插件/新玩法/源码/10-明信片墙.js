/* 🏞️ 明信片墙：TA 出门时会寄明信片给你——正面是那里的风景，背面是 TA 的手写字、邮戳和邮票；收集成一面墙和一串足迹 */
if (window.__gyxPost) return; window.__gyxPost = 1;
X.feat('gyxPost', { n: '🏞️ 明信片墙', desc: 'TA 出门时寄明信片给你：风景、邮戳、手写字；收集成一面墙和足迹' });
const S = X.store('postcard');
let D = { list: [], cfg: { per: 8 } };
const SCENES = ['sea', 'mountain', 'city', 'snow', 'forest', 'lake', 'desert', 'town', 'field', 'night'];
const PLACES = [['大理', 'lake'], ['青岛', 'sea'], ['哈尔滨', 'snow'], ['重庆', 'city'], ['西双版纳', 'forest'], ['敦煌', 'desert'], ['杭州', 'lake'], ['厦门', 'sea'], ['成都', 'town'], ['呼伦贝尔', 'field'], ['京都', 'town'], ['冰岛', 'night'], ['瑞士', 'mountain'], ['巴黎', 'city'], ['北海道', 'snow'], ['稻城亚丁', 'mountain']];
function seed(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6; }; }
// 画风景（正面）
function scene(type, key) {
    const r = seed(key), P = (a, b) => a + r() * (b - a);
    const sky = { sea: ['#8ecdf5', '#e7f6ff'], mountain: ['#9ec5e8', '#f3f7fb'], city: ['#f7b58b', '#ffe5c9'], snow: ['#c9dcef', '#f4f8fc'], forest: ['#a8dcc0', '#eefaf1'], lake: ['#b7d6f2', '#f5fbff'], desert: ['#f5c98b', '#fff2d9'], town: ['#ffc7a8', '#fff0e3'], field: ['#9fd3f3', '#f2fbff'], night: ['#0f1a3a', '#3a3f7a'] }[type] || ['#a9d3f5', '#f2f8ff'];
    let g = `<defs><linearGradient id="s${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs><rect width="300" height="200" fill="url(#s${key})"/>`;
    const sunY = P(40, 80); if (type === 'night') { for (let i = 0; i < 40; i++) g += `<circle cx="${P(0, 300)}" cy="${P(0, 120)}" r="${P(.4, 1.4)}" fill="#fff" opacity="${P(.4, 1)}"/>`; g += `<path d="M0 60 Q 80 ${P(20, 50)} 160 70 T 300 50" stroke="#7fffd4" stroke-width="${P(8, 16)}" fill="none" opacity=".35"/><circle cx="240" cy="40" r="14" fill="#fdf6d8"/>`; }
    else g += `<circle cx="${P(60, 240)}" cy="${sunY}" r="${P(12, 22)}" fill="${type === 'city' || type === 'town' || type === 'desert' ? '#ff8a5b' : '#fff6c9'}" opacity=".9"/>`;
    const hills = (y, col, amp) => { let d = `M0 ${y}`; for (let x = 0; x <= 300; x += 30) d += ` Q ${x + 15} ${y - P(0, amp)} ${x + 30} ${y + P(-amp / 3, amp / 3)}`; return `<path d="${d} L300 200 L0 200 Z" fill="${col}"/>`; };
    if (type === 'sea') g += `<rect y="${P(110, 125)}" width="300" height="90" fill="#3d9ad8"/>` + [0, 1, 2, 3].map(i => `<path d="M${P(0, 250)} ${130 + i * 16} q 10 -5 20 0" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>`).join('') + `<path d="M0 175 Q 150 160 300 185 L300 200 L0 200 Z" fill="#f4dfb4"/>`;
    if (type === 'mountain' || type === 'snow') { g += `<path d="M-10 170 L${P(60, 90)} ${P(50, 70)} L${P(120, 150)} 170 Z" fill="${type === 'snow' ? '#dfe9f5' : '#7d93b5'}"/><path d="M90 175 L${P(170, 200)} ${P(35, 60)} L310 175 Z" fill="${type === 'snow' ? '#eef4fb' : '#5f7aa3'}"/>` + hills(170, type === 'snow' ? '#ffffff' : '#88b58f', 12); }
    if (type === 'forest' || type === 'field') { g += hills(140, '#9ccf9f', 20) + hills(165, '#6fb07a', 16); for (let i = 0; i < (type === 'forest' ? 16 : 5); i++) { const x = P(0, 300), y = P(140, 185), h = P(18, 34); g += `<path d="M${x} ${y} l${h / 3} 0 l${-h / 6} ${-h} z" fill="#2f7d4f"/>`; } if (type === 'field') for (let i = 0; i < 30; i++) g += `<circle cx="${P(0, 300)}" cy="${P(165, 198)}" r="2" fill="${X.pick(['#ffd166', '#ff8fb1', '#fff'])}"/>`; }
    if (type === 'lake') g += hills(120, '#8fb4a3', 18) + `<rect y="125" width="300" height="75" fill="#7fb7df"/><path d="M40 150 h60 M150 165 h80 M60 180 h40" stroke="#fff" stroke-width="2" opacity=".6"/>`;
    if (type === 'desert') g += hills(150, '#e9b872', 30) + hills(175, '#d99a52', 20);
    if (type === 'city' || type === 'town') { for (let i = 0; i < 12; i++) { const w = P(16, 30), h = type === 'city' ? P(40, 110) : P(20, 45), x = i * 26 + P(-4, 4); g += `<rect x="${x}" y="${190 - h}" width="${w}" height="${h}" fill="${type === 'city' ? X.pick(['#6b5b95', '#88799f', '#4f4a7a']) : X.pick(['#e9c9a8', '#f3dcc4', '#d9b08c'])}"/>`; if (type === 'town') g += `<path d="M${x - 2} ${190 - h} l${w / 2 + 2} -10 l${w / 2 + 2} 10 z" fill="#b5524a"/>`; for (let k = 0; k < 4; k++) g += `<rect x="${x + 4}" y="${195 - h + k * 10}" width="4" height="4" fill="#ffe7a0" opacity="${r() > .4 ? .9 : .2}"/>`; } g += `<rect y="190" width="300" height="10" fill="#555"/>`; }
    if (type === 'night') g += hills(160, '#1c2445', 20);
    return `<svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice">${g}</svg>`;
}
async function write(c) {
    if (X.bailu()) { const [pl, ty] = X.pick(PLACES); return { place: pl, scene: ty, text: X.cards(['明信片', '信', '聊天'], c, 2).join('\n') || `到${pl}了，想你。`, stamp: pl }; }
    const r = await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 12)}\n\n你出门了（旅行 / 出差 / 去某个地方办事 / 回老家……选一个符合你身份和你们最近聊天的地方，真实存在的地名），在那里给她寄了一张明信片。\n写明信片背面（手写，40~120 字，像真的明信片：那里的天气、看到的一样东西、想起她的一个瞬间）。\n风景类型从这些里挑一个最像那里的：${SCENES.join(' / ')}\n只输出 JSON：{"place":"地名","scene":"风景类型","text":"明信片背面的字","stamp":"邮票上印的字（2~6 个字）"}`);
    const j = X.json(r); if (j && j.place && j.text) return j;
    const [pl, ty] = X.pick(PLACES); return { place: pl, scene: ty, text: r ? X.plain(r).slice(0, 200) : `到${pl}了。`, stamp: pl };
}
async function send(c) {
    c = c || X.cur(); if (!c) return null;
    const j = await write(c);
    const it = { id: 'pc' + Date.now(), cid: String(c.id), at: Date.now(), arrive: Date.now() + X.rnd(0.5, 3) * 86400000, place: String(j.place), scene: SCENES.includes(j.scene) ? j.scene : X.pick(SCENES), text: String(j.text), stamp: String(j.stamp || j.place).slice(0, 8), seen: false };
    D.list.unshift(it); await S.set('d', D);
    X.say(c, `我在${it.place}，给你寄了张明信片，过几天就到。`);
    return it;
}
window.gyxPostSend = async (id, now) => { const it = await send(X.char(id) || X.cur()); if (it && now) { it.arrive = Date.now(); await S.set('d', D); await tick(); } return it; };
async function tick() { if (!X.on('gyxPost')) return;
    for (const it of D.list) if (!it.arrived && Date.now() >= it.arrive) { it.arrived = Date.now(); const c = X.char(it.cid); X.notify(c, `🏞️ 收到一张明信片：来自${it.place}，${X.name(c)} 寄的`, '', 'gyxPostOpen'); }
    await S.set('d', D);
    const k = X.day(); if (D.last === k) return; D.last = k; await S.set('d', D);
    for (const c of X.chars()) { if (X.auto(c)) continue; if (Math.random() * 100 < (+D.cfg.per || 0)) { await send(c); break; } }
}
X.action({ key: 'gyx_postcard', label: '出门时给对方寄一张明信片', hint: '在外面看到好看的地方', need: () => true, run: async c => (await send(c)) ? '在外面给你寄了张明信片' : null }, 'gyxPost');
function cardHtml(it) {
    const c = X.char(it.cid), d = new Date(it.at);
    return `<div class="pc-card" onclick="this.classList.toggle('flip')"><div class="pc-in"><div class="pc-f">${scene(it.scene, it.id)}<b class="pc-pl">${X.esc(it.place)}</b></div>
        <div class="pc-b"><div class="pc-tx gyx-hand">${X.esc(it.text).replace(/\n/g, '<br>')}<div class="pc-sig">—— ${X.esc(X.name(c))}</div></div><div class="pc-r"><div class="pc-st"><span>${X.esc(it.stamp)}</span><em>¥1.2</em></div><div class="pc-pm">${X.esc(it.place)}<br>${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}</div><div class="pc-to">To: ${X.esc(X.me(c))}</div></div></div></div></div>`;
}
window.gyxPostOpen = function () {
    const got = D.list.filter(i => i.arrived), way = D.list.filter(i => !i.arrived);
    got.forEach(i => i.seen = true); S.set('d', D);
    const foot = [...new Set(got.map(i => i.place))];
    X.panel('gyxPcOv', '🏞️ 明信片墙', `<div class="gyx-row">${X.whoSel((X.cur() || {}).id, 'gyxPostWho')}<button class="gyx-btn lite" onclick="this.disabled=true;gyxPostSend(GYX_POST_WHO,true).then(()=>gyxPostOpen())">让 TA 现在寄一张</button></div>
        ${way.length ? `<div class="gyx-tip">📮 在路上的：${way.map(i => `${X.esc(X.name(X.char(i.cid)))} 从${X.esc(i.place)}寄出`).join('、')}</div>` : ''}
        ${foot.length ? `<div class="pc-foot">📍 足迹：${foot.map(p => `<span>${X.esc(p)}</span>`).join('')}</div>` : ''}
        <div class="gyx-tip">点明信片翻到背面。</div><div class="pc-wall">${got.length ? got.map(cardHtml).join('') : '<div class="gyx-tip">还没有收到明信片。</div>'}</div>
        <div class="gyx-row gyx-tip">默认模式的 TA 每天有 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.per}" style="width:60px" onchange="gyxPostCfg(+this.value)">% 的可能出门寄一张；自主模式的 TA 自己决定。</div>`);
};
window.GYX_POST_WHO = '';
window.gyxPostWho = v => { window.GYX_POST_WHO = v; };
window.gyxPostCfg = v => { D.cfg.per = v; S.set('d', D); };
window.gyxPostData = () => D;
X.ctx(id => { const L = D.list.filter(i => i.cid === String(id)).slice(0, 3); if (!L.length) return ''; return '【你寄过的明信片】' + L.map(i => `${new Date(i.at).toLocaleDateString()} 在${i.place}${i.arrived ? '（她收到了）' : '（还在路上）'}`).join('；'); }, 'gyxPost');
X.css('gyxPcCss', `
.pc-wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin:10px 0}
.pc-card{perspective:900px;cursor:pointer;aspect-ratio:3/2}.pc-card:nth-child(odd){transform:rotate(-1.2deg)}.pc-card:nth-child(even){transform:rotate(1deg)}
.pc-in{position:relative;width:100%;height:100%;transition:transform .7s cubic-bezier(.3,1.3,.4,1);transform-style:preserve-3d}.pc-card.flip .pc-in{transform:rotateY(180deg)}
.pc-f,.pc-b{position:absolute;inset:0;backface-visibility:hidden;border-radius:6px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,.14);background:#fff;border:6px solid #fff;box-sizing:border-box}
.pc-f svg{width:100%;height:100%;display:block}.pc-pl{position:absolute;left:10px;bottom:8px;color:#fff;font-size:18px;text-shadow:0 2px 6px rgba(0,0,0,.4);font-family:"Noto Serif SC",serif;letter-spacing:.1em}
.pc-b{transform:rotateY(180deg);background:#fffdf6;display:flex;padding:8px}.pc-tx{flex:1;font-size:15px;line-height:1.6;color:#3b3530;overflow:auto;padding-right:8px;border-right:1px solid #e8dfcf}.pc-sig{text-align:right;margin-top:4px}
.pc-r{width:76px;display:flex;flex-direction:column;align-items:center;gap:6px;padding-left:6px}.pc-st{width:52px;height:62px;border:2px dashed #d6a86a;background:#fff3e0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;color:#b5524a;text-align:center}.pc-st em{font-style:normal;font-size:10px;color:#999}
.pc-pm{width:58px;height:58px;border-radius:50%;border:2px solid rgba(80,80,160,.5);color:rgba(80,80,160,.8);font-size:10px;display:flex;align-items:center;justify-content:center;text-align:center;transform:rotate(-14deg);margin-top:-18px;margin-left:-26px;background:rgba(255,255,255,.3)}
.pc-to{font-size:11px;color:#8a7f6e;margin-top:auto;align-self:flex-start}
.pc-foot{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;margin:6px 0}.pc-foot span{padding:3px 10px;border-radius:999px;background:#eef6ff;color:#2f6fb3}
`);
X.today(() => { const now = Date.now(); const rows = D.list.filter(i => !i.arrived).map(i => ({ t: '在路上', x: `${X.esc(X.name(X.char(i.cid)))} 从${X.esc(i.place)}寄出`, go: 'gyxPostOpen()' })).concat(D.list.filter(i => i.arrived && X.day(new Date(i.arrived)) === X.day()).map(i => ({ t: '今天到了', x: `来自${X.esc(i.place)}的明信片`, go: 'gyxPostOpen()' }))); return { title: '🏞️ 明信片', rows }; }, 'gyxPost');
X.mini({ id: 'gyxPost', icon: '🏞️', title: '明信片墙', desc: 'TA 出门时寄明信片给你：风景、邮戳、手写字；收集成一面墙和足迹', onOpen: () => window.gyxPostOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.list = D.list || []; D.cfg = Object.assign({ per: 8 }, D.cfg || {}); setInterval(tick, 10 * 60000); setTimeout(tick, 18000); })();
X.widget('gyxPostW', { n: '明信片', sizes: ['s', 'm'], tap: () => window.gyxPostOpen(), r: w => { const go = D.list.find(i => !i.arrived), last = D.list.find(i => i.arrived); return X.gw(w, '🏞️', '明信片墙', [go ? '从' + X.esc(go.place) + '寄出' : (last ? '来自' + X.esc(last.place) : '等 TA 寄一张'), D.list.filter(i => i.arrived).length + ' 张收到了']); } }, 'gyxPost');
X.memArr({ k: 'gyxPost', ico: '🏞️', n: '寄来的明信片', d: 'TA 从各地寄给你的话', arr: () => D.list, text: x => x.text, field: 'text', meta: x => x.place + ' · ' + new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxPost');
