/* 🔄 互换身份一天：今天 TA 来演你——学你的口头禅、你的语气、你平时对 TA 的样子；你来演 TA。到点自动换回来，TA 会写一段「当了一天你」的感想 */
if (window.__gyxSwap) return; window.__gyxSwap = 1;
X.feat('gyxSwap', { n: '🔄 互换身份一天', desc: 'TA 学你说话、你演 TA，一天后换回来写感想' });
const S = X.store('swap');
let D = { on: {}, log: [] };   // on[cid] = {from, until, seen}; log = [{id, cid, from, to, text, at}]
const H = cid => ((typeof globalChats !== 'undefined' && globalChats[cid]) || []).filter(m => m && m.sender !== 'system' && !m.side);
const herLines = cid => H(cid).filter(m => m.sender === 'me').map(m => X.plain(m.text)).filter(t => t.length >= 2 && t.length <= 40);
const isOn = cid => { const o = D.on[String(cid)]; return !!o && Date.now() < o.until; };
function sample(cid) { const L = herLines(cid).slice(-200); const w = {}; L.forEach(t => (t.match(/[一-龥]{2,3}[~～!！?？]*|[哈嘿呜嘻]{2,}/g) || []).forEach(k => w[k] = (w[k] || 0) + 1)); return { lines: L.slice(-12), top: Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]) }; }
window.gyxSwapStart = async (cid, hours) => { const c = X.char(cid) || X.cur(); if (!c) return; D.on[String(c.id)] = { from: Date.now(), until: Date.now() + (hours || 24) * 36e5, seen: H(String(c.id)).length }; await S.set('d', D);
    X.say(c, X.bailu() ? (herLines(String(c.id)).slice(-1)[0] || '那今天我就是你啦') : (await X.ask(`${X.who(c)}\n今天你们互换身份：你来演她（她的口头禅、语气、平时对你的样子），她来演你。用「她」的口吻跟「你（现在是她演的）」打个招呼，开始今天。只说这一句。\n她平时说话的样子：\n${sample(String(c.id)).lines.join('\n')}`)) || X.v('好，今天我是你了。那……你今天得像我一样宠着我。', '换好啦。从现在起我就是你，你就是我。')); X.toast('🔄 换好了', '到 ' + new Date(D.on[String(c.id)].until).toLocaleString() + ' 换回来'); window.gyxSwapOpen(c.id); };
window.gyxSwapEnd = async cid => { const o = D.on[String(cid)]; if (!o) return; delete D.on[String(cid)]; const c = X.char(cid); await S.set('d', D); if (c) await review(c, o); window.gyxSwapOpen(cid); };
async function review(c, o) {
    const cid = String(c.id), L = H(cid).filter(m => m.timestamp >= o.from);
    let t = X.bailu() ? null : await X.ask(`${X.who(c)}\n你们刚结束「互换身份一天」：你演了她，她演了你。\n那段时间的聊天：\n${L.slice(-40).map(m => (m.sender === 'me' ? '她（演你）：' : '你（演她）：') + X.plain(m.text).slice(0, 120)).join('\n')}\n\n换回来了。用你自己的口吻写一段感想：当了一天的她，你发现了什么、心疼什么、学到什么；她演的你像不像。120~200 字。`);
    if (!t) t = X.v('当了一天你才知道，原来你每天都在等我回消息。以后我回快一点。', '你演的我……也太像了吧，我平时真的这么黏人吗。', '换回来了。还是当我自己好，可以光明正大地喜欢你。') + (X.cards(['情话'], c, 1)[0] ? '\n' + X.cards(['情话'], c, 1)[0] : '');
    D.log.unshift({ id: 'sw' + Date.now().toString(36), cid, from: o.from, to: Date.now(), text: t, at: Date.now() }); await S.set('d', D);
    X.say(c, t); X.notify(c, `<b>${X.esc(X.name(c))}</b> ${X.v('换回来了，写了感想', '当完一天的你，有话想说')}`, '🔄 互换身份', () => window.gyxSwapOpen(cid));
}
window.gyxSwapOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), o = D.on[cid], sp = sample(cid);
    X.panel('gyxSwapOv', '🔄 互换身份一天', `<div class="gyx-row">${X.whoSel(cid, 'gyxSwapOpen')}</div>
        ${isOn(cid) ? `<div class="gyx-card">现在 <b>${X.esc(X.name(c))}</b> 在演你，你在演 TA。<br><span class="gyx-tip">到 ${new Date(o.until).toLocaleString()} 自动换回来</span><div class="gyx-row"><button class="gyx-btn" onclick="gyxSwapEnd('${cid}')">现在就换回来</button></div></div>`
        : `<div class="gyx-tip">${X.v('今天 TA 学你，你学 TA。', '换个位置，看看对方眼里的自己。', '交换一天，看看谁演得更像。')}</div><div class="gyx-row">${[[3, '3 小时'], [12, '半天'], [24, '一整天']].map(([h, n]) => `<button class="gyx-btn${h === 24 ? '' : ' lite'}" onclick="gyxSwapStart('${cid}',${h})">${n}</button>`).join('')}</div>`}
        ${sp.top.length ? `<div class="gyx-tip">TA 会学的你的口头禅：${sp.top.map(k => `<span class="gyx-chip">${X.esc(k)}</span>`).join('')}</div>` : ''}
        <div style="font-weight:700;margin:12px 0 4px">换回来后的感想</div>${D.log.filter(x => x.cid === cid).map(x => `<div class="gyx-card"><div class="gyx-tip">${new Date(x.from).toLocaleDateString()}</div>${X.esc(x.text).replace(/\n/g, '<br>')}</div>`).join('') || '<div class="gyx-tip">还没换过</div>'}`);
};
X.ctx(id => { if (!isOn(id)) return ''; const sp = sample(String(id)); return `【今天互换身份（游戏）】你在演她：用她的口头禅（${sp.top.join('、') || '照她平时的样子'}）、她的语气、她平时对你的态度说话；她在演你，配合她。她以前说过的话：${sp.lines.slice(-6).join(' / ')}。这是你们之间的小游戏，玩得开心点，到 ${new Date(D.on[String(id)].until).toLocaleTimeString()} 换回来。`; }, 'gyxSwap');
// 白露：没有模型，就用她自己说过的话来「学她」
setInterval(() => { if (!X.bailu() || !X.on('gyxSwap')) return; Object.keys(D.on).forEach(cid => { const o = D.on[cid]; if (Date.now() >= o.until) { const c = X.char(cid); delete D.on[cid]; S.set('d', D); if (c) review(c, o); return; } const n = H(cid).length, last = H(cid).slice(-1)[0]; if (n > o.seen && last && last.sender === 'me' && !last.gyxSwap) { o.seen = n + 1; const c = X.char(cid), L = herLines(cid); if (c && L.length) setTimeout(() => X.say(c, X.pick(L.slice(-120)), { gyxSwap: 1 }), 1200); } else o.seen = Math.max(o.seen, n); }); }, 2000);
setInterval(() => { if (X.bailu()) return; Object.keys(D.on).forEach(cid => { const o = D.on[cid]; if (Date.now() >= o.until) { delete D.on[cid]; S.set('d', D); const c = X.char(cid); if (c && X.on('gyxSwap')) review(c, o); } }); }, 60000);
X.action({ key: 'gyx_swap', label: '提议今天互换身份玩一天', hint: '你演她，她演你', need: c => !isOn(c.id) && herLines(String(c.id)).length > 20 && !D.log.some(x => x.cid === String(c.id) && Date.now() - x.at < 14 * 864e5),
    run: async c => (await X.reach(c, '你突发奇想，想和她「互换身份一天」：你演她、她演你。问问她要不要玩（她答应的话可以在「互换身份」里开始）')) ? '提议互换身份' : null }, 'gyxSwap');
X.today(() => ({ title: '🔄 互换身份', rows: Object.keys(D.on).filter(isOn).map(cid => ({ t: '进行中', x: `${X.esc(X.name(X.char(cid)))} 在演你，到 ${new Date(D.on[cid].until).toLocaleTimeString().slice(0, 5)}`, go: `gyxSwapOpen('${cid}')` })) }), 'gyxSwap');
X.widget('gyxSwapW', { n: '互换身份', sizes: ['s', 'm'], tap: () => window.gyxSwapOpen(), r: w => { const c = X.cur(); return X.gw(w, '🔄', '互换身份', c && isOn(c.id) ? ['进行中', X.esc(X.name(c)) + ' 在演你'] : ['今天换一换？']); } }, 'gyxSwap');
X.memArr({ k: 'gyxSwap', ico: '🔄', n: '互换身份', d: '每次换回来 TA 写的感想', arr: () => D.log, field: 'text', text: x => x.text, meta: x => new Date(x.from).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxSwap');
X.mini({ id: 'gyxSwap', icon: '🔄', title: '互换身份一天', desc: 'TA 学你说话，你演 TA', cat: '一起做', onOpen: () => window.gyxSwapOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.on = D.on || {}; D.log = D.log || []; })();
