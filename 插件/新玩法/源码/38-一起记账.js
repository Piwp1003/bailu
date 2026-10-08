/* 🧾 一起记账：在原来的「钱包」上加一个「我自己记一笔」——你花了什么、进账多少，直接记进钱包流水（分类、备注都有），不另做一本账；TA 会看你的账本吐槽两句、提醒你记账，每周给你一份花钱小结。钱包没开时就先记在插件里 */
if (window.__gyxBook) return; window.__gyxBook = 1;
X.feat('gyxBook', { n: '🧾 一起记账', desc: '自己记一笔进钱包流水，TA 看账本吐槽、每周小结' });
const S = X.store('book');
let D = { own: [], cfg: { per: 35, remind: '21:30' }, week: '' };   // own: 钱包没开时记在这 {at, amt, why, tag}
const TAGS = ['🍚 吃饭', '🧋 奶茶咖啡', '🛍️ 购物', '🚇 交通', '🏠 房租水电', '🎮 娱乐', '💄 美妆', '📚 学习', '🎁 送礼', '💊 医疗', '💰 收入', '📦 其他'];
const W = () => window.gyWallet && window.gyWallet.log && (typeof isAutoOn !== 'function' || isAutoOn('walletOn')) ? window.gyWallet : null;
// 我的流水：钱包开着就读钱包里「我」的流水，否则读插件自己的
function rows() { const w = W(); let L = []; try { if (w) L = w.log('me').map(e => ({ at: e.at, amt: e.amt, why: e.why, tag: e.tag || '' })); } catch (e) {} return L.concat(D.own).sort((a, b) => b.at - a.at); }
const sumDay = (L, k) => L.filter(e => X.day(new Date(e.at)) === k && e.amt < 0).reduce((a, e) => a - e.amt, 0);
window.gyxBookAdd = async function (o) {
    o = o || {}; const g = id => ((document.getElementById(id) || {}).value || '').trim();
    const amt = +(o.amt != null ? o.amt : g('gyxBkA')), why = o.why != null ? o.why : g('gyxBkW'), tag = o.tag || window.GYX_BK_TAG || TAGS[0], inc = /收入/.test(tag);
    if (!amt) { X.toast(X.v('金额还没填', '多少钱？')); return null; }
    let ok = false; const w = W();
    try { if (w) { const r = inc ? await w.income('me', amt, why || tag.replace(/^\S+\s/, ''), { tag: tag.replace(/^\S+\s/, '') }) : await w.spend('me', amt, why || tag.replace(/^\S+\s/, ''), { tag: tag.replace(/^\S+\s/, '') }); ok = !!(r && !r.skipped); } } catch (e) {}
    if (!ok) { D.own.unshift({ at: Date.now(), amt: inc ? amt : -amt, why: why || tag.replace(/^\S+\s/, ''), tag: tag.replace(/^\S+\s/, '') }); await S.set('d', D); }
    const c = X.cur(); if (c && !X.auto(c) && Math.random() * 100 < (+D.cfg.per || 0)) comment(c, { amt, why, tag, inc });
    X.toast(X.v('记上了', '好，记下了', '又是一笔'), `${inc ? '+' : '-'}¥${amt} ${why || tag}`);
    if (document.getElementById('gyxBkOv')) window.gyxBookOpen(); return { amt, why, tag, wallet: ok };
};
async function comment(c, e) {
    const L = rows(), today = sumDay(L, X.day()), same = L.filter(x => x.tag && e.tag && x.tag === e.tag.replace(/^\S+\s/, '') && Date.now() - x.at < 7 * 86400000).length;
    return X.reach(c, `她刚记了一笔账：${e.inc ? '收入' : '花了'} ¥${e.amt}（${e.why || e.tag}）。今天一共花了 ¥${Math.round(today)}，这一周「${e.tag.replace(/^\S+\s/, '')}」记了 ${same} 笔。按你的性格说一句（吐槽、心疼、夸她省、说下次你请……别说教）`);
}
function report(days) {
    const L = rows().filter(e => Date.now() - e.at < days * 86400000), out = L.filter(e => e.amt < 0), by = {};
    out.forEach(e => { const k = e.tag || '其他'; by[k] = (by[k] || 0) - e.amt; });
    return { total: Math.round(out.reduce((a, e) => a - e.amt, 0) * 100) / 100, inc: Math.round(L.filter(e => e.amt > 0).reduce((a, e) => a + e.amt, 0) * 100) / 100, by: Object.entries(by).sort((a, b) => b[1] - a[1]), n: L.length };
}
async function weekly(c) {
    const r = report(7); if (!r.n) return null; D.week = X.day(); await S.set('d', D);
    return X.reach(c, `这一周她记账：花了 ¥${r.total}，收入 ¥${r.inc}；花得最多的是 ${r.by.slice(0, 3).map(([k, v]) => k + ' ¥' + Math.round(v)).join('、')}。给她一份你的「这周花钱小结」（按你的性格，30~100 字）`);
}
window.GYX_BK_TAG = TAGS[0];
window.gyxBookTag = t => { window.GYX_BK_TAG = t; window.gyxBookOpen(); };
window.gyxBookOpen = function () {
    const L = rows(), r = report(7), td = sumDay(L, X.day()), max = r.by.length ? r.by[0][1] : 1;
    X.panel('gyxBkOv', '🧾 一起记账', `<div class="bk-top"><div><span>今天花了</span><b>¥${Math.round(td * 100) / 100}</b></div><div><span>这周</span><b>¥${r.total}</b></div>${r.inc ? `<div><span>这周收入</span><b>¥${r.inc}</b></div>` : ''}</div>
        <div class="gyx-row">${TAGS.map(t => `<span class="gyx-chip ${window.GYX_BK_TAG === t ? 'on' : ''}" onclick="gyxBookTag('${t}')">${t}</span>`).join('')}</div>
        <div class="gyx-row"><input id="gyxBkA" class="gyx-who" type="number" step="0.01" placeholder="金额" style="width:100px"><input id="gyxBkW" class="gyx-who" placeholder="买了什么（可空）" style="flex:1" onkeydown="if(event.key==='Enter')gyxBookAdd()"><button class="gyx-btn" onclick="gyxBookAdd()">记一笔</button></div>
        <div class="gyx-tip">${W() ? '记进原来「钱包」里你的流水（会从卡上扣/入账，账单和小票都在钱包里）' : '钱包没开，先记在这里'}</div>
        ${r.by.length ? `<div class="gyx-card"><div class="gyx-tip">这周花在哪儿</div>${r.by.map(([k, v]) => `<div class="bk-b"><span>${X.esc(k)}</span><i style="width:${v / max * 100}%"></i><em>¥${Math.round(v)}</em></div>`).join('')}</div>` : ''}
        <div class="bk-list">${L.slice(0, 40).map(e => `<div class="bk-it"><span>${new Date(e.at).toLocaleDateString().slice(5)} ${X.esc(e.tag || '')}</span><p>${X.esc(e.why || '')}</p><b class="${e.amt > 0 ? 'in' : ''}">${e.amt > 0 ? '+' : ''}${e.amt}</b></div>`).join('') || '<div class="gyx-tip">还没有账</div>'}</div>
        <div class="gyx-row gyx-tip">默认模式的 TA 看到你记账，有 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.per}" style="width:60px" onchange="gyxBookCfg('per',+this.value)">% 的可能说两句；每晚 <input class="gyx-who" type="time" value="${D.cfg.remind}" onchange="gyxBookCfg('remind',this.value)"> 今天还没记就提醒你。</div>`);
};
window.gyxBookCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxBookData = () => ({ D, rows: rows(), week: report(7) });
async function tick() {
    if (!X.on('gyxBook')) return; const c = X.cur(); if (!c || X.auto(c)) return; const now = new Date(), [h, m] = String(D.cfg.remind || '21:30').split(':').map(Number);
    if (now.getHours() * 60 + now.getMinutes() >= h * 60 + m && D.nag !== X.day()) { D.nag = X.day(); await S.set('d', D); if (!rows().some(e => X.day(new Date(e.at)) === X.day())) X.reach(c, '她今天还没记账，提醒她一下（轻松一点，可以问问今天买了什么）'); }
    if (now.getDay() === 0 && D.week !== X.day() && now.getHours() >= 20) await weekly(c);
}
X.action({ key: 'gyx_book', label: '翻翻她的账本：吐槽 / 心疼 / 提醒记账 / 这周小结', hint: '她最近花钱的样子', need: () => rows().length > 0,
    run: async c => { if (new Date().getDay() === 0 && D.week !== X.day()) return (await weekly(c)) ? '给你做了这周的花钱小结' : null; const e = rows()[0]; return (await comment(c, { amt: Math.abs(e.amt), why: e.why, tag: e.tag || '其他', inc: e.amt > 0 })) ? '看了你的账本' : null; } }, 'gyxBook');
X.ctx(() => { const r = report(7); return r.n ? `【她的账本】这周花了 ¥${r.total}${r.by.length ? '，最多的是' + r.by[0][0] : ''}。` : ''; }, 'gyxBook');
X.today(() => { const L = rows(), td = sumDay(L, X.day()), n = L.filter(e => X.day(new Date(e.at)) === X.day()).length; return { title: '🧾 记账', rows: [{ t: '¥' + Math.round(td), x: n ? `今天记了 ${n} 笔` : '今天还没记账', go: 'gyxBookOpen()' }] }; }, 'gyxBook');
X.widget('gyxBookW', { n: '记账', sizes: ['s', 'm'], tap: () => window.gyxBookOpen(), r: w => { const L = rows(), r = report(7); return X.gw(w, '🧾', '记账', ['今天 ¥' + Math.round(sumDay(L, X.day())), '这周 ¥' + Math.round(r.total), r.by[0] ? '最多：' + X.esc(r.by[0][0]) : '']); } }, 'gyxBook');
X.css('gyxBkCss', `.bk-top{display:flex;gap:10px;margin:6px 0}.bk-top>div{flex:1;padding:12px;border-radius:16px;background:#f3fbf6;text-align:center}.bk-top span{display:block;font-size:12px;color:#888}.bk-top b{font-size:22px;color:#2a9d8f}
.bk-b{display:flex;align-items:center;gap:8px;font-size:13px;margin:4px 0}.bk-b span{width:70px}.bk-b i{height:8px;border-radius:4px;background:#8fd3c1}.bk-b em{font-style:normal;color:#888;font-size:12px}
.bk-list{max-height:40vh;overflow:auto}.bk-it{display:flex;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid #f2f2f2;font-size:13.5px}.bk-it span{font-size:12px;color:#999;width:92px;flex-shrink:0}.bk-it p{flex:1;margin:0}.bk-it b{font-weight:600}.bk-it b.in{color:#2a9d8f}`);
X.mini({ id: 'gyxBook', icon: '🧾', title: '一起记账', desc: '自己记一笔进钱包流水，TA 看账本吐槽、每周小结', onOpen: () => window.gyxBookOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.own = D.own || []; D.cfg = Object.assign({ per: 35, remind: '21:30' }, D.cfg || {}); setTimeout(tick, 60000); setInterval(tick, 15 * 60000); })();
