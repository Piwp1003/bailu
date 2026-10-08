/* 🫂 相处模式：每个 TA 选一种你们相处的样子——健康恋爱 / 举案齐眉 / 青梅竹马 / 欢喜冤家，或者自己写。每种写清楚侧重和禁忌，TA 按这个相处，不再千人一面。 */
if (window.__gyxBond) return; window.__gyxBond = 1;
X.feat('gyxBond', { n: '🫂 相处模式', desc: '每个 TA 一种相处的样子（健康恋爱 / 举案齐眉 / 青梅竹马 / 欢喜冤家 / 自己写）' });
const S = X.store('bond');
const MODES = {
    healthy: { ico: '🌿', n: '健康恋爱', s: '平等、尊重、能好好沟通的稳定关系',
        t: '平等、尊重、能沟通的稳定亲密关系。尊重打底，信任和吸引一起往前走。可以有矛盾，但不靠羞辱、控制、牺牲自己来证明爱；吵完要留出沟通、修复、重新理解对方的余地。',
        no: '别把稳定写成无聊，别把成熟写成没情绪。',
        act: '想到一件想跟她商量的事（小到周末吃什么，大到以后的打算），认真问问她的想法' },
    longterm: { ico: '🍵', n: '举案齐眉', s: '老夫老妻，爱沉进日常和默契里',
        t: '长期伴侣式的关系，爱意沉进日常和默契里：彼此太熟了，很多话不用说全；会唠叨、会惦记对方吃没吃饭；表达很直白，不扭捏。',
        no: '别把老夫老妻写成冷淡，也别为了加戏硬塞外部狗血。',
        act: '像过了很多年的人那样，随口唠叨一句日常（提醒她带东西、问她晚上想吃什么、分享家里的小事）' },
    childhood: { ico: '🎒', n: '青梅竹马', s: '太熟了，从熟悉慢慢越界',
        t: '从很熟的关系慢慢变成恋人，核心是「惯性被打破」：你们知道对方的过去和黑历史，见过对方最真实最狼狈的样子；以前习以为常的小动作，现在突然会让人心跳。',
        no: '别忽略这么多年相处留下的心理惯性——不会一夜之间变得陌生又客气。',
        act: '想起一件你们小时候/以前的旧事（她的黑历史、一起闯的祸、她早忘了的小细节），拿来逗逗她或者突然有点心动' },
    rivals: { ico: '⚡', n: '欢喜冤家', s: '表面互怼，底下全是在意',
        t: '表层是斗嘴和互怼，底层是在意和靠近：嘴硬、爱抬杠，把她惹恼了又马上回头哄、撒娇；吵来吵去从来不会真伤到彼此。',
        no: '别用伤害冒充暧昧，也别让你太快服软——嘴硬是这段关系的乐趣。',
        act: '找个由头跟她抬两句杠（嘴上不饶人），然后又忍不住哄她一下' }
};
const PL = (id, d) => { try { return typeof gyPL === 'function' ? gyPL(id, d) : d; } catch (e) { return d; } };   // 📜 内置提示词库（js/88）里改过就用改过的
const bondText = k => PL('bond.' + k, MODES[k].t + '\n禁忌：' + MODES[k].no);
Object.keys(MODES).forEach(bondText);
let D = { m: {}, log: [] };   // m[cid] = { k, custom, at }
const modeOf = c => D.m[String(c && c.id)] || null;
const label = x => !x ? '还没选' : x.k === 'custom' ? '✍️ 自己写的' : (MODES[x.k] ? MODES[x.k].ico + ' ' + MODES[x.k].n : '还没选');
async function setMode(cid, k, custom, why) {
    const c = X.char(cid); if (!c) return;
    const old = modeOf(c);
    if (!k) delete D.m[String(cid)]; else D.m[String(cid)] = { k, custom: k === 'custom' ? String(custom || (old && old.custom) || '').slice(0, 600) : '', at: Date.now() };
    D.log.unshift({ id: 'bd' + Date.now().toString(36), cid: String(cid), at: Date.now(), t: `${label(old)} → ${label(D.m[String(cid)])}`, why: why || '你选的' }); D.log = D.log.slice(0, 120);
    await S.set('d', D);
}
window.gyxBondSet = async (cid, k) => { await setMode(cid, k); X.toast(X.v('换好了', '记下了', '好'), `${X.name(X.char(cid))}：${label(modeOf(X.char(cid)))}`); window.gyxBondOpen(cid); };
window.gyxBondCustom = async (cid, v) => { await setMode(cid, 'custom', v); window.gyxBondOpen(cid); };
window.gyxBondGuess = async cid => {
    const c = X.char(cid); if (!c) return;
    if (X.bailu()) return X.toast('白露没接模型', '点一下想要的那种就行');
    const j = X.json(await X.ask(`${X.who(c)}\n下面是你和她最近的聊天：\n${X.recent(c, 30)}\n\n从这几种里挑一种最像你们现在相处样子的：${Object.keys(MODES).map(k => k + '=' + MODES[k].n + '（' + MODES[k].s + '）').join('；')}。\n只回 JSON：{"k":"healthy|longterm|childhood|rivals","why":"一句话理由"}`));
    if (!j || !MODES[j.k]) return X.toast('没看出来', '你直接挑一种吧');
    await setMode(cid, j.k, '', '看聊天猜的：' + String(j.why || '').slice(0, 40));
    X.toast(X.v('看了看你们的聊天', '猜了一下'), `像是「${MODES[j.k].n}」`); window.gyxBondOpen(cid);
};
window.gyxBondOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return X.toast('还没有角色');
    const cid = String(c.id), cur = modeOf(c);
    X.panel('gyxBondOv', '🫂 相处模式', `<div class="gyx-row">${X.whoSel(cid, 'gyxBondOpen')}${X.bailu() ? '' : `<button class="gyx-btn lite" onclick="this.disabled=true;this.textContent='在看…';gyxBondGuess('${cid}')">看聊天帮我猜</button>`}</div>
        <div class="bd-grid">${Object.keys(MODES).map(k => { const m = MODES[k]; return `<div class="bd-c${cur && cur.k === k ? ' on' : ''}" onclick="gyxBondSet('${cid}','${k}')"><b>${m.ico} ${m.n}</b><span>${m.s}</span><em>禁忌：${m.no}</em></div>`; }).join('')}
        <div class="bd-c${cur && cur.k === 'custom' ? ' on' : ''}" onclick="gyxBondSet('${cid}','custom')"><b>✍️ 自己写</b><span>写你们独有的相处方式</span></div></div>
        ${cur && cur.k === 'custom' ? `<textarea class="gyx-in bd-ta" placeholder="比如：表面上是上司和下属，私下里他什么都听你的……写侧重点和禁忌" onchange="gyxBondCustom('${cid}',this.value)">${X.esc(cur.custom || '')}</textarea>` : ''}
        ${cur ? `<div class="gyx-row"><button class="gyx-btn lite" onclick="gyxBondSet('${cid}','')">不用相处模式</button></div>` : ''}
        <div class="du-h" style="font-weight:700;margin:12px 0 6px">换过的记录</div>${D.log.filter(x => x.cid === cid).slice(0, 20).map(x => `<div class="gyx-tip">${new Date(x.at).toLocaleDateString()} · ${X.esc(x.t)}　<span style="opacity:.7">${X.esc(x.why)}</span></div>`).join('') || '<div class="gyx-tip">还没换过</div>'}
        <div class="gyx-tip" style="margin-top:10px">${X.bailu() ? '白露没接模型：相处模式会让 TA 主动找你时说对应的话（从字卡里挑）。' : '选了之后每轮都会告诉 TA，按这个样子跟你相处。'}</div>`);
};
X.ctx(id => {
    const c = X.char(id), m = c && modeOf(c); if (!m) return '';
    if (m.k === 'custom') return m.custom ? `【你们的相处模式（她定的）】${m.custom}` : '';
    const M = MODES[m.k]; if (!M) return '';
    return `【你们的相处模式：${M.n}】${bondText(m.k)}`;
}, 'gyxBond');
X.action({ key: 'gyx_bond', label: '按你们的相处方式来一下', hint: '欢喜冤家就抬杠、青梅竹马就翻旧事、老夫老妻就唠叨', need: c => !!modeOf(c),
    run: async c => { const m = modeOf(c); const why = m.k === 'custom' ? `按你们的相处方式（${String(m.custom).slice(0, 80)}），自然地找她说句话` : MODES[m.k].act;
        if (X.bailu()) { const t = X.cards(['聊天'], c, 1)[0]; if (!t) return null; X.say(c, t); return '按相处方式说了句话'; }
        return (await X.reach(c, why)) ? '按你们的相处方式找她说了句话' : null; } }, 'gyxBond');
X.today(() => { const ch = D.log.filter(x => X.day(new Date(x.at)) === X.day()).length;
    return { title: '🫂 相处模式' + (ch ? `（今天换了 ${ch} 次）` : ''), rows: X.chars().filter(c => modeOf(c)).slice(0, 5).map(c => ({ t: X.name(c), x: X.esc(label(modeOf(c))), go: `gyxBondOpen('${c.id}')` })) }; }, 'gyxBond');
X.widget('gyxBondW', { n: '相处模式', sizes: ['s', 'm'], tap: () => window.gyxBondOpen(), r: w => { const c = X.cur(); const m = c && modeOf(c); const M = m && MODES[m.k];
    return X.gw(w, M ? M.ico : '🫂', c ? X.name(c) : '相处模式', [M ? M.n : m ? '自己写的' : '还没选', M ? M.s : m ? String(m.custom || '').slice(0, 20) : '点开选一种']); } }, 'gyxBond');
X.mem({ k: 'gyxBond', ico: '🫂', n: '相处模式', d: '现在的相处模式（自己写的可以直接改）和换过的记录',
    items: c => { const m = modeOf(c); const cur = m ? [{ id: '__cur', cid: String(c.id), at: m.at, t: m.k === 'custom' ? m.custom : label(m), cur: 1 }] : []; return cur.concat(D.log.filter(x => x.cid === String(c.id))); },
    text: x => x.t, edit: (x, v) => { if (x.cur) { const m = D.m[x.cid]; if (m) { m.k = 'custom'; m.custom = String(v).slice(0, 600); } } else x.t = v; },
    del: (c, i) => { const m = modeOf(c); if (m && i === 0) { delete D.m[String(c.id)]; return; } const L = D.log.filter(x => x.cid === String(c.id)); const it = L[m ? i - 1 : i]; const k = D.log.indexOf(it); if (k >= 0) D.log.splice(k, 1); },
    meta: x => (x.cur ? '现在用的 · ' : '') + new Date(x.at).toLocaleString(), save: () => S.set('d', D) }, 'gyxBond');
X.css('gyxBondCss', `.bd-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}@media(max-width:520px){.bd-grid{grid-template-columns:1fr}}
.bd-c{border:1.5px solid rgba(0,0,0,.08);border-radius:14px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:4px}.bd-c span{font-size:12.5px;color:#555}.bd-c em{font-style:normal;font-size:11.5px;color:#999;line-height:1.5}
.bd-c.on{border-color:#ff7aa8;background:#fff5f8}.bd-ta{width:100%;min-height:90px;margin-top:10px;box-sizing:border-box}`);
X.mini({ id: 'gyxBond', icon: '🫂', title: '相处模式', desc: '每个 TA 一种相处的样子：健康恋爱 / 老夫老妻 / 青梅竹马 / 欢喜冤家 / 自己写', cat: '关系', onOpen: () => window.gyxBondOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.m = D.m || {}; D.log = Array.isArray(D.log) ? D.log : []; })();
