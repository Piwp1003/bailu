/* 🎁 愿望清单：你写下想要的东西，TA 会偷偷记着，哪天悄悄帮你实现一个（礼物盒寄到）；TA 也有自己的愿望清单，你能送 TA 礼物 */
if (window.__gyxWish) return; window.__gyxWish = 1;
X.feat('gyxWish', { n: '🎁 愿望清单', desc: '互相的愿望清单，TA 会偷偷帮你实现一个' });
const S = X.store('wish');
let D = { mine: [], ta: {}, cfg: { per: 6 } };   // mine:{id,t,note,done,by,at,msg}; ta[cid]=[{id,t,why,done,at}]
async function taWishes(c) {
    if (X.bailu()) return ['一起去看一次海', '一台新耳机', '你亲手写的信', '一只毛绒熊', '周末一起睡懒觉'].map(t => ({ t, why: '' }));
    const j = X.json(await X.ask(`${X.who(c)}\n写下你自己的愿望清单（5 条，符合你的身份性格：有想要的东西，也有想和她一起做的事，具体一点）。\n只输出 JSON：{"list":[{"t":"愿望","why":"为什么想要（一句）"}]}`));
    return (j && Array.isArray(j.list) ? j.list : []).slice(0, 8).map(x => ({ t: String(x.t || ''), why: String(x.why || '') })).filter(x => x.t);
}
// TA 偷偷帮你实现一个
async function fulfill(c, w) {
    w = w || X.pick(D.mine.filter(x => !x.done)); if (!c || !w) return null;
    let msg;
    if (X.bailu()) msg = X.cards(['礼物', '信', '聊天'], c, 2).join('\n') || '你说过想要这个，我记着呢。';
    else msg = X.plain(await X.ask(`${X.who(c)}\n她的愿望清单里写着「${w.t}」${w.note ? '（' + w.note + '）' : ''}。你偷偷帮她实现了（买了 / 安排好了 / 做到了），附一张小卡片。写卡片上的话（40~120 字）。只输出卡片内容。`) || '你说过想要的，我一直记着。');
    w.done = true; w.by = String(c.id); w.at = Date.now(); w.msg = msg; w.unopened = true; await S.set('d', D);
    X.notify(c, `🎁 ${X.name(c)} 偷偷实现了你的一个愿望`, '去拆开', 'gyxWishOpen');
    await X.reach(c, `你刚偷偷帮她实现了愿望清单里的「${w.t}」，礼物已经到她那儿了，神秘一点地告诉她去拆`);
    return w;
}
window.gyxWishFulfill = (id, wid) => fulfill(X.char(id) || X.cur(), D.mine.find(x => x.id === wid));
window.gyxWishOpen = async function (tab, who) {
    const T = tab || window.__gyxWsTab || 'mine'; window.__gyxWsTab = T;
    const c = X.char(who) || X.cur(), cid = c ? String(c.id) : '';
    let body = '';
    if (T === 'mine') body = `<div class="gyx-row"><input id="gyxWsT" class="gyx-in" placeholder="想要的东西 / 想做的事" style="flex:2"><input id="gyxWsN" class="gyx-in" placeholder="备注（可空：颜色、链接……）" style="flex:1"><button class="gyx-btn" onclick="gyxWishAdd()">写下</button></div>
        <div class="gyx-tip">你的愿望，TA 都看得到，会偷偷记着。</div>
        ${D.mine.map(w => `<div class="ws-it${w.done ? ' done' : ''}">${w.done ? (w.unopened ? `<b class="ws-new" onclick="gyxWishUnbox('${w.id}')">🎁 拆开</b>` : '✅') : '⭐'}<div><b>${X.esc(w.t)}</b>${w.note ? `<span>${X.esc(w.note)}</span>` : ''}${w.done && !w.unopened ? `<span>${X.esc(X.name(X.char(w.by)))} 帮你实现了 · ${new Date(w.at).toLocaleDateString()}</span><p class="gyx-hand">${X.esc(w.msg || '')}</p>` : ''}</div>${w.done ? '' : `<i onclick="gyxWishDel('${w.id}')">×</i>`}</div>`).join('') || '<div class="gyx-tip">还没写愿望。</div>'}`;
    else { if (c && !D.ta[cid]) { body = '<div class="gyx-tip">TA 在想自己想要什么……</div>'; setTimeout(async () => { D.ta[cid] = (await taWishes(c)).map((x, i) => Object.assign({ id: 'tw' + Date.now() + i, done: false }, x)); await S.set('d', D); window.gyxWishOpen('ta', cid); }, 10); }
        else body = `<div class="gyx-row">${X.whoSel(cid, 'gyxWishTaWho')}</div>${(D.ta[cid] || []).map(w => `<div class="ws-it${w.done ? ' done' : ''}">${w.done ? '✅' : '💭'}<div><b>${X.esc(w.t)}</b>${w.why ? `<span>${X.esc(w.why)}</span>` : ''}${w.done ? `<span>你送给 TA 了 · ${new Date(w.at).toLocaleDateString()}</span>` : ''}</div>${w.done ? '' : `<button class="gyx-btn lite" onclick="gyxWishGive('${cid}','${w.id}')">送给 TA</button>`}</div>`).join('')}<div class="gyx-row"><button class="gyx-btn lite" onclick="GYX_WISH_RESET('${cid}')">让 TA 重新写</button></div>`; }
    X.panel('gyxWsOv', '🎁 愿望清单', `<div class="gyx-row"><span class="gyx-chip ${T === 'mine' ? 'on' : ''}" onclick="gyxWishOpen('mine')">我的愿望</span><span class="gyx-chip ${T === 'ta' ? 'on' : ''}" onclick="gyxWishOpen('ta')">TA 的愿望</span></div>${body}
        <div class="gyx-row gyx-tip">默认模式的 TA 每天有 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.per}" style="width:60px" onchange="gyxWishCfg(+this.value)">% 的可能偷偷实现你一个愿望；自主模式的 TA 自己决定。</div>`);
};
window.gyxWishTaWho = v => window.gyxWishOpen('ta', v);
window.GYX_WISH_RESET = async cid => { delete D.ta[cid]; await S.set('d', D); window.gyxWishOpen('ta', cid); };
window.gyxWishAdd = async () => { const t = ((document.getElementById('gyxWsT') || {}).value || '').trim(); if (!t) return; D.mine.unshift({ id: 'w' + Date.now(), t, note: ((document.getElementById('gyxWsN') || {}).value || '').trim(), done: false }); await S.set('d', D); window.gyxWishOpen('mine'); };
window.gyxWishDel = async id => { D.mine = D.mine.filter(x => x.id !== id); await S.set('d', D); window.gyxWishOpen('mine'); };
window.gyxWishGive = async (cid, id) => { const w = (D.ta[cid] || []).find(x => x.id === id); if (!w) return; w.done = true; w.at = Date.now(); await S.set('d', D); X.reach(X.char(cid), `她送了你一直想要的「${w.t}」，你收到了！按你的性格反应（惊喜、感动、嘴硬……）`); X.toast(X.v('送出去了', '礼物在路上了'), w.t); window.gyxWishOpen('ta', cid); };
window.gyxWishUnbox = async id => { const w = D.mine.find(x => x.id === id); if (!w) return; w.unopened = false; await S.set('d', D); const ov = document.createElement('div'); ov.className = 'ws-box'; ov.onclick = () => { ov.remove(); window.gyxWishOpen('mine'); }; ov.innerHTML = `<div class="ws-card"><div class="ws-e">🎁</div><b>${X.esc(w.t)}</b><p class="gyx-hand">${X.esc(w.msg || '')}</p><small>—— ${X.esc(X.name(X.char(w.by)))}</small></div>`; document.body.appendChild(ov); };
window.gyxWishCfg = v => { D.cfg.per = v; S.set('d', D); };
window.gyxWishData = () => D;
async function tick() { if (!X.on('gyxWish')) return; const k = X.day(); if (D.last === k) return; D.last = k; await S.set('d', D); if (!D.mine.some(x => !x.done)) return; for (const c of X.chars()) { if (X.auto(c)) continue; if (Math.random() * 100 < (+D.cfg.per || 0)) { await fulfill(c); break; } } }
X.action({ key: 'gyx_wish', label: '偷偷实现她愿望清单里的一个愿望', hint: '她写过想要的东西', need: () => D.mine.some(x => !x.done), run: async c => (await fulfill(c)) ? '偷偷实现了你一个愿望' : null }, 'gyxWish');
X.ctx(id => { const L = D.mine.filter(x => !x.done).slice(0, 8); const T = (D.ta[String(id)] || []).filter(x => !x.done).slice(0, 5); let t = ''; if (L.length) t += `【她的愿望清单】${L.map(x => x.t).join('、')}（你知道，可以放在心上）。`; if (T.length) t += `【你自己的愿望清单】${T.map(x => x.t).join('、')}。`; return t; }, 'gyxWish');
X.today(() => ({ title: '🎁 愿望', rows: D.mine.filter(w => w.unopened).map(w => ({ t: '🎁', x: `<b>「${X.esc(w.t)}」实现了，去拆开</b>`, go: `gyxWishUnbox('${w.id}')` })) }), 'gyxWish');
X.css('gyxWsCss', `.ws-it{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:14px;background:#f7f7f9;margin:6px 0}.ws-it.done{background:#fff7e6}.ws-it>div{flex:1}.ws-it b{display:block;font-weight:500}.ws-it span{display:block;font-size:12px;color:#999}.ws-it p{font-size:17px;margin:6px 0 0}.ws-it i{font-style:normal;color:#ccc;cursor:pointer}.ws-new{color:#e07a00;cursor:pointer;white-space:nowrap;animation:gbWig 1.4s infinite}
.ws-box{position:fixed;inset:0;z-index:100006;background:rgba(40,20,30,.6);display:flex;align-items:center;justify-content:center}.ws-card{background:#fffdf6;border-radius:20px;padding:26px 24px;width:min(360px,86vw);text-align:center;animation:giPop .6s cubic-bezier(.3,1.5,.5,1) both}.ws-e{font-size:60px}.ws-card b{font-size:20px}.ws-card p{font-size:19px;line-height:1.8;text-align:left}.ws-card small{color:#999}
@keyframes giPop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:none}}@keyframes gbWig{0%,100%{transform:rotate(0)}5%{transform:rotate(-4deg)}10%{transform:rotate(4deg)}15%{transform:rotate(0)}}`);
X.mini({ id: 'gyxWish', icon: '🎁', title: '愿望清单', desc: '你写下想要的，TA 会偷偷帮你实现；TA 也有愿望清单，你能送 TA 礼物', onOpen: () => window.gyxWishOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.mine = D.mine || []; D.ta = D.ta || {}; D.cfg = Object.assign({ per: 6 }, D.cfg || {}); setTimeout(tick, 30000); setInterval(tick, 30 * 60000); })();
X.widget('gyxWishW', { n: '愿望清单', sizes: ['s', 'm'], tap: () => window.gyxWishOpen(), r: w => { const u = D.mine.filter(x => x.unopened), left = D.mine.filter(x => !x.done); return X.gw(w, '🌠', '愿望清单', [u.length ? '<b>🎁 实现了，去拆</b>' : left.length + ' 个愿望', left[0] ? X.esc(left[0].t) : '写一个愿望', D.mine.filter(x => x.done).length + ' 个实现了']); } }, 'gyxWish');
X.mem({ k: 'gyxWish', ico: '🌠', n: '愿望清单', d: '你的愿望（TA 知道）和 TA 的愿望', items: c => D.mine.concat(D.ta[String(c.id)] || []), text: x => x.t, meta: x => (D.mine.includes(x) ? '你的' : 'TA 的') + (x.done ? ' · 实现了' : ''), edit: (x, v) => { x.t = v; }, del: (c, i) => { const all = D.mine.concat(D.ta[String(c.id)] || []), x = all[i]; let j = D.mine.indexOf(x); if (j >= 0) D.mine.splice(j, 1); else { const L = D.ta[String(c.id)] || []; j = L.indexOf(x); if (j >= 0) L.splice(j, 1); } }, save: () => S.set('d', D) }, 'gyxWish');
