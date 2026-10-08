/* ❄️ 总结滚雪球：原来的聊天总结越攒越长、越老越模糊。这个插件把最老的一批总结再浓缩成一条「回顾」（再多了浓缩成「大回顾」），越久越精炼但不丢——被浓缩掉的原文收进存档，记忆总览里能看、能改、能放回去；TA 想起这些事时用「3天前」「上个月」这种说法，而不是一串日期 */
if (window.__gyxRoll) return; window.__gyxRoll = 1;
X.feat('gyxRoll', { n: '❄️ 总结滚雪球', desc: '旧的聊天总结再浓缩成回顾 / 大回顾，原文存档不丢；记忆里用「3天前」' });
const S = X.store('roll');
let D = { arch: {}, log: [], cfg: { keep: 24, batch: 12, big: 10, rel: true } };   // arch[cid] = [{at, raw, into}]
const parse = l => { const m = String(l).match(/^\s*\[([^\]]+)\]\s*(.*)$/); let at = null; if (m) { const t = Date.parse(m[1].replace(/\//g, '-').replace(/-(\d)-/g, '-0$1-')); at = isNaN(t) ? (isNaN(Date.parse(m[1])) ? null : Date.parse(m[1])) : t; } return { at, body: m ? m[2].trim() : String(l).trim(), raw: String(l).trim() }; };
const isRoll = b => /^【(大)?回顾/.test(b);
const isBig = b => /^【大回顾/.test(b);
const md = t => { const d = new Date(t); return `${d.getMonth() + 1}月${d.getDate()}日`; };
// 「3天前」「上个月」「去年秋天」
function rel(t) {
    if (!t) return '记不清哪天';
    const d = (Date.now() - t) / 86400000;
    if (d < 1) return new Date(t).getDate() === new Date().getDate() ? '今天' : '昨天';
    if (d < 2) return '昨天'; if (d < 3) return '前天'; if (d < 7) return Math.floor(d) + '天前';
    if (d < 14) return '上周'; if (d < 31) return Math.round(d / 7) + '周前'; if (d < 62) return '上个月';
    if (d < 365) return Math.round(d / 30) + '个月前';
    const y = new Date(t), s = ['冬天', '冬天', '春天', '春天', '春天', '夏天', '夏天', '夏天', '秋天', '秋天', '秋天', '冬天'][y.getMonth()];
    return (new Date().getFullYear() - y.getFullYear() === 1 ? '去年' : (new Date().getFullYear() - y.getFullYear()) + '年前的') + s;
}
window.gyxRollRel = rel;
async function condense(c, items, big) {
    const span = `${md(items[0].at || Date.now())}～${md(items[items.length - 1].at || Date.now())}`;
    let t;
    if (X.bailu()) t = items.map(x => x.body.replace(/^【[^】]*】/, '').split(/[。！？\n]/)[0].slice(0, 24)).join('；');
    else t = X.plain(await X.ask(`下面是你（${X.name(c)}）和她${span}之间${big ? '几段回顾' : '的聊天总结'}，按时间排好：\n${items.map(x => '· ' + x.body).join('\n')}\n\n把它们浓缩成一段${big ? '更精炼的「大回顾」（80~150 字）' : '「回顾」（100~180 字）'}：留下发生过的事、关系的变化、说过的重要的话和情绪，删掉重复和琐碎的；用第三人称客观地写。只输出这段话。`) || '');
    if (!t) return null;
    return `[${new Date(items[items.length - 1].at || Date.now()).toLocaleString()}] 【${big ? '大回顾' : '回顾'}·${span}】${t}`;
}
async function roll(c, force) {
    if (!c || !c.chatSummary) return 0;
    const cid = String(c.id); let lines = c.chatSummary.split('\n').filter(l => l.trim()).map(parse), n = 0;
    const plain = lines.filter(x => !isRoll(x.body));
    if (plain.length > Math.max(6, +D.cfg.keep || 24) || (force && plain.length > 4)) {
        const take = plain.slice(0, Math.min(Math.max(3, +D.cfg.batch || 12), plain.length - 2));
        const line = await condense(c, take, false);
        if (line) { const at = lines.indexOf(take[0]); lines = lines.filter(x => !take.includes(x)); lines.splice(at, 0, parse(line)); (D.arch[cid] = D.arch[cid] || []).push(...take.map(x => ({ at: x.at, raw: x.raw, into: line.slice(0, 60) }))); n += take.length; }
    }
    const rolls = lines.filter(x => isRoll(x.body) && !isBig(x.body));
    if (rolls.length > Math.max(4, +D.cfg.big || 10)) {
        const take = rolls.slice(0, Math.ceil(rolls.length / 2));
        const line = await condense(c, take, true);
        if (line) { const at = lines.indexOf(take[0]); lines = lines.filter(x => !take.includes(x)); lines.splice(at, 0, parse(line)); (D.arch[cid] = D.arch[cid] || []).push(...take.map(x => ({ at: x.at, raw: x.raw, into: line.slice(0, 60) }))); n += take.length; }
    }
    if (n) { c.chatSummary = lines.map(x => x.raw).join('\n'); try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {} D.log.unshift({ at: Date.now(), cid, n }); D.log = D.log.slice(0, 100); await S.set('d', D); }
    return n;
}
window.gyxRollNow = async (cid, force) => { const c = X.char(cid) || X.cur(); const n = await roll(c, force !== false); X.toast(n ? X.v(`浓缩了 ${n} 条`, `整理好了 ${n} 条旧总结`) : X.v('还不用浓缩', '旧总结还不多'), n ? '原文收在存档里' : ''); if (document.getElementById('gyxRlOv')) window.gyxRollOpen(cid); return n; };
// 把存档里的原文放回去（撤销一次浓缩）
window.gyxRollRestore = async (cid, i) => { const c = X.char(cid), A = D.arch[String(cid)] || []; const it = A[i]; if (!c || !it) return; c.chatSummary = ((c.chatSummary || '') + '\n' + it.raw).split('\n').filter(l => l.trim()).map(parse).sort((a, b) => (a.at || 0) - (b.at || 0)).map(x => x.raw).join('\n'); A.splice(i, 1); try { saveAllData(); } catch (e) {} await S.set('d', D); window.gyxRollOpen(cid); };
// ---------- 注入的时候：日期换成「3天前」 ----------
function hook() {
    const g = window.getRecentChatSummaryText;
    if (typeof g === 'function' && !g.__gyxRoll) { const w = function (str, limit) { const r = g.apply(this, arguments); if (!X.on('gyxRoll') || !D.cfg.rel) return r; return String(r || '').split('\n').map(l => { const x = parse(l); return x.at ? `（${rel(x.at)}）${x.body}` : l; }).join('\n'); }; w.__gyxRoll = 1; window.getRecentChatSummaryText = w; try { getRecentChatSummaryText = w; } catch (e) {} }
    const f = window.aliveFadeOne;
    if (typeof f === 'function' && !f.__gyxRoll) { const w = function (it, now) { const r = f.apply(this, arguments); if (!X.on('gyxRoll') || !D.cfg.rel || !it || !it.at) return r; return String(r).replace(/^·\s*\d+月\d+日/, '· ' + rel(it.at)); }; w.__gyxRoll = 1; window.aliveFadeOne = w; try { aliveFadeOne = w; } catch (e) {} }
    // 大回顾 / 回顾 也要被想起来：getRecentChatSummaryText 只取最后几行，这里把最近一条回顾补在前面
    return typeof g === 'function';
}
X.ctx(id => { const c = X.char(id); if (!c || !c.chatSummary) return ''; const L = c.chatSummary.split('\n').map(parse).filter(x => isRoll(x.body)); if (!L.length) return ''; return '【更早以前的你们（回顾）】' + L.slice(-3).map(x => `（${rel(x.at)}）${x.body.replace(/^【[^】]*】/, '')}`).join('\n'); }, 'gyxRoll');
async function tick() { if (!X.on('gyxRoll')) return; hook(); for (const c of X.chars()) { const k = c.chatSummary ? c.chatSummary.split('\n').length : 0; if (k > Math.max(6, +D.cfg.keep || 24)) await roll(c); } }
window.gyxRollCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxRollOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), L = (c.chatSummary || '').split('\n').filter(l => l.trim()).map(parse), A = D.arch[cid] || [];
    X.panel('gyxRlOv', '❄️ 总结滚雪球', `<div class="gyx-row">${X.whoSel(cid, 'gyxRollOpen')}<button class="gyx-btn lite" onclick="this.disabled=true;gyxRollNow('${cid}')">现在浓缩一次</button></div>
        <div class="gyx-tip">现在 TA 的聊天总结有 ${L.length} 条（其中回顾 ${L.filter(x => isRoll(x.body)).length} 条）。超过 <input class="gyx-who" type="number" min="6" value="${D.cfg.keep}" style="width:56px" onchange="gyxRollCfg('keep',+this.value)"> 条就把最老的 <input class="gyx-who" type="number" min="3" value="${D.cfg.batch}" style="width:56px" onchange="gyxRollCfg('batch',+this.value)"> 条浓缩成一条回顾；回顾多于 <input class="gyx-who" type="number" min="4" value="${D.cfg.big}" style="width:56px" onchange="gyxRollCfg('big',+this.value)"> 条再浓缩成大回顾。</div>
        <label class="gyx-row gyx-tip"><input type="checkbox" ${D.cfg.rel ? 'checked' : ''} onchange="gyxRollCfg('rel',this.checked)"> TA 想起这些事时用「3天前」「上个月」的说法</label>
        <div class="rl-list">${L.slice().reverse().map(x => `<div class="rl-it ${isBig(x.body) ? 'big' : isRoll(x.body) ? 'roll' : ''}"><em>${rel(x.at)}</em>${X.esc(x.body)}</div>`).join('') || '<div class="gyx-tip">还没有聊天总结（原来的「聊天自动总结」开着才会有）</div>'}</div>
        ${A.length ? `<details><summary class="gyx-tip">📦 浓缩掉的原文存档（${A.length} 条，能放回去）</summary>${A.slice().reverse().map((x, j) => `<div class="rl-it old"><em>${rel(x.at)}</em>${X.esc(parse(x.raw).body)} <a onclick="gyxRollRestore('${cid}',${A.length - 1 - j})">放回去</a></div>`).join('')}</details>` : ''}`);
};
window.gyxRollData = () => D;
X.action({ key: 'gyx_roll', label: '想起很久以前你们之间的一件事，跟她提一句', hint: '那些已经变成回顾的旧事', need: c => !!(c.chatSummary && /【(大)?回顾/.test(c.chatSummary)), run: async c => { const L = c.chatSummary.split('\n').map(parse).filter(x => isRoll(x.body)); const it = X.pick(L); return (await X.reach(c, `你突然想起${rel(it.at)}你们之间的事：${it.body.replace(/^【[^】]*】/, '').slice(0, 120)}。挑其中一个小细节，自然地跟她提起（带点怀念，别复述）`)) ? '想起了以前的事' : null; } }, 'gyxRoll');
X.today(() => ({ title: '❄️ 总结滚雪球', rows: D.log.filter(x => X.day(new Date(x.at)) === X.day()).map(x => ({ t: '❄️', x: `${X.esc(X.name(X.char(x.cid)))} 的 ${x.n} 条旧总结浓缩成了回顾`, go: `gyxRollOpen('${x.cid}')` })) }), 'gyxRoll');
X.widget('gyxRollW', { n: '我们的回顾', sizes: ['s', 'm'], tap: () => window.gyxRollOpen(), r: w => { const c = X.cur(), L = c && c.chatSummary ? c.chatSummary.split('\n').map(parse).filter(x => isRoll(x.body)) : []; const x = L[L.length - 1]; return X.gw(w, '❄️', '我们的回顾', x ? [rel(x.at), X.esc(x.body.replace(/^【[^】]*】/, '').slice(0, 40))] : ['还没有回顾']); } }, 'gyxRoll');
X.mem({ k: 'gyxRoll', ico: '📦', n: '浓缩掉的总结原文', d: '总结滚雪球收起来的原文（删了就真没了；想放回去去「总结滚雪球」里点放回去）', items: c => D.arch[String(c.id)] || [], text: x => parse(x.raw).body, edit: (x, v) => { const p = parse(x.raw); x.raw = x.raw.replace(p.body, v); }, del: (c, i) => { (D.arch[String(c.id)] || []).splice(i, 1); }, meta: x => rel(x.at) + ' · 浓缩进：' + (x.into || ''), save: () => S.set('d', D) }, 'gyxRoll');
X.css('gyxRlCss', `.rl-list{max-height:50vh;overflow:auto;margin:8px 0}.rl-it{padding:8px 6px;border-bottom:1px solid #f2f2f2;font-size:13.5px;line-height:1.6}.rl-it em{font-style:normal;font-size:11.5px;color:#999;margin-right:6px}.rl-it.roll{background:#f3f8ff}.rl-it.big{background:#eef0ff;font-weight:500}.rl-it.old{opacity:.7}.rl-it a{color:#1d9bf0;cursor:pointer;font-size:12px}`);
X.mini({ id: 'gyxRoll', icon: '❄️', title: '总结滚雪球', desc: '旧总结浓缩成回顾 / 大回顾，原文存档不丢；TA 用「3天前」来想', cat: '回忆', onOpen: () => window.gyxRollOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.arch = D.arch || {}; D.log = D.log || []; D.cfg = Object.assign({ keep: 24, batch: 12, big: 10, rel: true }, D.cfg || {}); hook(); setTimeout(tick, 30000); setInterval(tick, 10 * 60000); })();
