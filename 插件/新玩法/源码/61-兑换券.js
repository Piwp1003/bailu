/* 🎟️ 兑换券：TA 会送你各种券——抱抱券、不许生气券、陪聊到天亮券、任性一次券……想用的时候撕一张，TA 必须兑现。你也能给 TA 写券，TA 会挑个时候来用 */
if (window.__gyxCoupon) return; window.__gyxCoupon = 1;
X.feat('gyxCoupon', { n: '🎟️ 兑换券', desc: 'TA 送你各种券，撕一张 TA 就得兑现；你也能给 TA 写券' });
const S = X.store('coupon');
let D = { list: [] };   // [{id, cid, from:'ta'|'me', name, desc, at, exp, used, said}]
const IDEAS = [['抱抱券', '一个很久的抱抱，不许先松手'], ['不许生气券', '不管我做了什么，这次都不许生气'], ['陪聊到天亮券', '今晚聊到你睡着为止'], ['任性一次券', '你说什么就是什么'], ['早安电话券', '明早我打电话叫你起床'], ['夸夸券', '认真夸你十句，不重样'], ['听你吐槽券', '只听，不讲道理'], ['甜品券', '给你买一份你想吃的甜的'], ['撒娇券', '对你撒一次娇，你不许嫌弃'], ['唱歌券', '给你唱一首歌'], ['免罚券', '这次的错可以一笔勾销'], ['陪看电影券', '你选片，我陪着']];
const COL = ['#ff8fab', '#ffb86b', '#7bd3b8', '#8fb4ff', '#c79bff', '#ffd36b'];
const col = id => COL[[...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COL.length];
async function give(c, why) {
    let j = X.bailu() ? null : X.json(await X.ask(`${X.who(c)}\n你想送她一张「兑换券」${why ? '（' + why + '）' : ''}——她什么时候拿出来用，你都得兑现。\n已经送过的：${D.list.filter(x => x.cid === String(c.id) && x.from === 'ta').map(x => x.name).join('、') || '（还没有）'}\n最近的聊天：\n${X.recent(c, 10)}\n只输出 JSON：{"name":"券名（2~8 字，以「券」结尾）","desc":"能兑换什么（一句话）","say":"送券时说的话"}`));
    if (!j || !j.name) { const [n, d] = X.pick(IDEAS.filter(x => !D.list.some(y => y.cid === String(c.id) && y.name === x[0] && !y.used)).concat([IDEAS[0]])); j = { name: n, desc: d, say: X.v(`送你一张「${n}」，什么时候用都行。`, `「${n}」一张，收好。`, `这张「${n}」给你，过期不候——骗你的，永久有效。`) }; }
    const it = { id: 'cp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), cid: String(c.id), from: 'ta', name: String(j.name).slice(0, 10), desc: String(j.desc || '').slice(0, 40), at: Date.now(), used: null };
    D.list.unshift(it); await S.set('d', D); X.say(c, `🎟️ ${X.plain(j.say || '')}`); return it;
}
window.gyxCouponUse = async id => {
    const it = D.list.find(x => x.id === id); if (!it || it.used) return; const c = X.char(it.cid); it.used = Date.now(); await S.set('d', D);
    if (it.from === 'ta') {
        try { const sid = String(c.id); globalChats[sid] = globalChats[sid] || []; globalChats[sid].push({ sender: 'me', text: `🎟️ 我要用「${it.name}」！`, timestamp: Date.now(), readBy: [], gyx: 1 }); saveAllData(); if (typeof renderChatMessages === 'function' && String(currentChatSessionId) === sid) renderChatMessages(); } catch (e) {}
        if (X.bailu()) { it.said = X.pick(X.cards(['兑换券', '情话'], c, 2).concat([`好，「${it.name}」收到。${it.desc}——我说到做到。`, `认账认账，「${it.name}」现在兑现。`])); setTimeout(() => X.say(c, it.said), 1500); }
        else await X.reach(c, `她刚刚撕下了你送她的「${it.name}」（${it.desc}）。你必须兑现：现在就照券上写的做（用文字把兑现的过程做出来），可以假装不情愿但一定要做到`);
    }
    window.gyxCouponOpen(it.cid);
};
window.gyxCouponWrite = async cid => { const n = ((document.getElementById('gyxCoupN') || {}).value || '').trim(), d = ((document.getElementById('gyxCoupD') || {}).value || '').trim(); if (!n) return; D.list.unshift({ id: 'cp' + Date.now().toString(36), cid: String(cid), from: 'me', name: /券$/.test(n) ? n : n + '券', desc: d, at: Date.now(), used: null }); await S.set('d', D); const c = X.char(cid); if (c) X.say(c, X.bailu() ? (X.cards(['情话'], c, 1)[0] || '收到你的券了，我会好好用的。') : (X.plain(await X.ask(`${X.who(c)}\n她给你写了一张兑换券「${n}」（${d || '没写说明'}），以后你能拿出来用。收到时说一句话。`)) || '收好了，到时候你可别赖账。')); window.gyxCouponOpen(cid); };
window.gyxCouponGive = async cid => { const c = X.char(cid) || X.cur(); await give(c, '她向你讨的'); window.gyxCouponOpen(c.id); };
window.gyxCouponDel = async id => { const x = D.list.find(y => y.id === id); D.list = D.list.filter(y => y.id !== id); await S.set('d', D); window.gyxCouponOpen(x && x.cid); };
window.gyxCouponData = () => D;
const ticket = x => `<div class="cpn-t${x.used ? ' used' : ''}" style="--c:${col(x.id)}"><div class="cpn-l"><b>${X.esc(x.name)}</b><span>${X.esc(x.desc || '')}</span><em>${x.from === 'ta' ? 'TA 送你的' : '你写给 TA 的'} · ${new Date(x.at).toLocaleDateString()}${x.used ? ' · 已于 ' + new Date(x.used).toLocaleDateString() + ' 兑换' : ''}</em></div><div class="cpn-r">${x.used ? '已用' : x.from === 'ta' ? `<a onclick="gyxCouponUse('${x.id}')">撕下来用</a>` : '等 TA 用'}<i onclick="gyxCouponDel('${x.id}')">✕</i></div></div>`;
window.gyxCouponOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), L = D.list.filter(x => x.cid === cid);
    X.panel('gyxCoupOv', '🎟️ 兑换券', `<div class="gyx-row">${X.whoSel(cid, 'gyxCouponOpen')}<button class="gyx-btn lite" onclick="this.disabled=true;gyxCouponGive('${cid}')">跟 TA 讨一张</button></div>
        <div class="cpn-h">TA 送你的</div>${L.filter(x => x.from === 'ta').map(ticket).join('') || '<div class="gyx-tip">还没有，去讨一张？</div>'}
        <div class="cpn-h">你写给 TA 的</div>${L.filter(x => x.from === 'me').map(ticket).join('') || '<div class="gyx-tip">还没写过</div>'}
        <div class="gyx-card"><div class="gyx-row"><input id="gyxCoupN" class="gyx-who" style="flex:1" placeholder="券名（陪我打游戏券）"><input id="gyxCoupD" class="gyx-who" style="flex:2" placeholder="能兑换什么"><button class="gyx-btn" onclick="gyxCouponWrite('${cid}')">写给 TA</button></div></div>`);
};
X.ctx(id => { const mine = D.list.filter(x => x.cid === String(id) && x.from === 'me' && !x.used), got = D.list.filter(x => x.cid === String(id) && x.from === 'ta' && !x.used), just = D.list.find(x => x.cid === String(id) && x.used && x.from === 'ta' && Date.now() - x.used < 15 * 60000); if (!mine.length && !got.length && !just) return ''; return `【兑换券】${got.length ? '你送她的、她还没用的：' + got.map(x => x.name).join('、') + '。' : ''}${mine.length ? '她写给你的、你还能用的：' + mine.map(x => `${x.name}（${x.desc}）`).join('、') + '。' : ''}${just ? `她刚用了「${just.name}」（${just.desc}），你得兑现。` : ''}`; }, 'gyxCoupon');
X.action({ key: 'gyx_coupon', label: '送她一张兑换券', hint: '抱抱券、不许生气券……', need: c => D.list.filter(x => x.cid === String(c.id) && x.from === 'ta' && !x.used).length < 6, run: async c => { const it = await give(c, ''); return it ? '送了一张「' + it.name + '」' : null; } }, 'gyxCoupon');
X.action({ key: 'gyx_coupon_use', label: '拿出她写给你的券来用', hint: '她写给你的兑换券', need: c => D.list.some(x => x.cid === String(c.id) && x.from === 'me' && !x.used),
    run: async c => { const it = X.pick(D.list.filter(x => x.cid === String(c.id) && x.from === 'me' && !x.used)); it.used = Date.now(); await S.set('d', D); if (X.bailu()) { X.say(c, `🎟️ 我要用「${it.name}」！`); return '用了一张券'; } return (await X.reach(c, `你拿出她写给你的「${it.name}」（${it.desc}），理直气壮地要她兑现`)) ? '用了一张「' + it.name + '」' : null; } }, 'gyxCoupon');
X.today(() => ({ title: '🎟️ 兑换券', rows: D.list.filter(x => X.day(new Date(x.used || x.at)) === X.day()).map(x => ({ t: x.used ? '兑换了' : x.from === 'ta' ? '收到' : '写了', x: '「' + X.esc(x.name) + '」', go: `gyxCouponOpen('${x.cid}')` })) }), 'gyxCoupon');
X.widget('gyxCouponW', { n: '兑换券', sizes: ['s', 'm'], tap: () => window.gyxCouponOpen(), r: w => { const L = D.list.filter(x => x.from === 'ta' && !x.used); return X.gw(w, '🎟️', '兑换券', L.length ? [L.length + ' 张能用', '「' + X.esc(L[0].name) + '」'] : ['讨一张？']); } }, 'gyxCoupon');
X.memArr({ k: 'gyxCoupon', ico: '🎟️', n: '兑换券', d: '送过、写过、用过的券', arr: () => D.list, text: x => x.name + '：' + (x.desc || ''), edit: (x, v) => { const i = v.indexOf('：'); if (i > 0) { x.name = v.slice(0, i); x.desc = v.slice(i + 1); } else x.name = v; }, meta: x => (x.from === 'ta' ? 'TA 送的' : '你写的') + (x.used ? ' · 已兑换' : ' · 未用'), save: () => S.set('d', D) }, 'gyxCoupon');
X.css('gyxCoupCss', `.cpn-h{font-weight:700;margin:12px 0 6px}.cpn-t{display:flex;border-radius:14px;overflow:hidden;margin:8px 0;background:var(--c);color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.08)}.cpn-t.used{filter:grayscale(.8);opacity:.6}.cpn-l{flex:1;padding:12px 14px;border-right:2px dashed rgba(255,255,255,.7)}.cpn-l b{font-size:17px;display:block}.cpn-l span{font-size:13px;display:block;opacity:.95}.cpn-l em{font-style:normal;font-size:11px;opacity:.8}.cpn-r{width:84px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:13px;position:relative}.cpn-r a{cursor:pointer;background:rgba(255,255,255,.3);padding:4px 8px;border-radius:10px}.cpn-r i{position:absolute;top:4px;right:6px;font-style:normal;font-size:11px;cursor:pointer;opacity:.7}`);
X.mini({ id: 'gyxCoupon', icon: '🎟️', title: '兑换券', desc: '抱抱券、不许生气券，撕一张 TA 就兑现', cat: '陪伴', onOpen: () => window.gyxCouponOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.list = D.list || []; })();
