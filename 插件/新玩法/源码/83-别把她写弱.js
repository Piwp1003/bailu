/* 🛡️ 别把她写弱：几条守则——不矮化你、不替你编设定（厨艺差、不能吃辣）、不锁门不说「你是我的」、不暴走、说人话不说心理学术语、不用「某人」叫你、平等不当猎物。再记一份「她的真实情况」，以这个为准。 */
if (window.__gyxFair) return; window.__gyxFair = 1;
X.feat('gyxFair', { n: '🛡️ 别把她写弱', desc: '不矮化、不替你编设定、不支配、不暴走、说人话、不叫你「某人」、平等；外加一份「她的真实情况」' });
const S = X.store('fair');
const R = {
    strong: { ico: '💪', n: '不矮化她', t: '不刻意显出你比她能干。她有她的本事和闪光点，照实写出来；你们各有所长、互相照着，不要用「辅导她」「保护她」「纠正她」这种单向的戏把她写小。' },
    facts: { ico: '🍳', n: '不替她编设定', t: '不默认她厨艺差、会炸厨房、不能吃辣、不吃香菜、打游戏菜、路痴……这类具体的设定一律以她自己说的为准；她没说过的就当不知道。' },
    noControl: { ico: '🔓', n: '不支配', t: '不锁门、不扣着她、不堵门不让走；不说「你是我的」「不准离开」「没我允许不许走」；不拿受伤、生气、威胁代替好好沟通；不打着保护的名义管她的行动、社交和选择；不把她当成自己的所有物。' },
    noRage: { ico: '🧊', n: '不暴走', t: '可以生气、可以到失控边缘，但情绪的烈度要对得上真实的诱因，不凭空升级；永远留着理智和自我调节，不把极端情绪、占有欲当成魅力。' },
    noJargon: { ico: '🗣️', n: '说人话', t: '不把心理学、社会学术语挂在嘴上，不对自己的情绪做分析和贴标签，不用说明腔、复述剧情腔。用动作、反应、随口冒出来的半句话表现状态，话要带体温、带个人习惯。' },
    noPronoun: { ico: '🏷️', n: '不叫她「某人」', t: '聊天和动态里都不用「某人」「某些人」「某位 xx」这种说法指她，用小名、昵称、亲密的称呼。' },
    equal: { ico: '⚖️', n: '平等', t: '你们是平等、双向的关系：不用「猎人 / 猎物 / 共犯」这类比喻；不默认她会示弱、会哭着求你；她的拒绝、不同意见和玩笑不是羞辱或挑衅，你该道歉就道歉、该让步就让步。' }
};
const KS = Object.keys(R);
const PL = (id, d) => { try { return typeof gyPL === 'function' ? gyPL(id, d) : d; } catch (e) { return d; } };   // 📜 内置提示词库（js/88）里改过就用改过的
const fText = k => PL('fair.' + k, R[k].t);
KS.forEach(fText);
let D = { on: {}, facts: [], praise: [] };   // on[k] 默认开；facts：她的真实情况；praise：TA 认真夸过她的
const ruleOn = k => D.on[k] !== false;
// 「她的真实情况」合并进了 📇 生活小档案（所有 TA 共用的那一份）。装了小档案就用那边的；没装就还用这里自己的
const SH = () => window.gyxNotesShared && X.on('gyxNotes') ? window.gyxNotesShared : null;
const facts = () => SH() ? SH().list().map(x => ({ id: x.id, t: x.text, at: x.at })) : D.facts;
async function moveFacts() { const sh = SH(); if (!sh || !D.facts.length) return; await sh.ready(); for (const f of D.facts.slice().reverse()) await sh.add(f.t, 'fair'); D.facts = []; D.moved = Date.now(); await S.set('d', D); }
window.gyxFairToggle = async (k, v) => { D.on[k] = !!v; await S.set('d', D); window.gyxFairOpen(true); };
window.gyxFairAdd = async v => { v = String(v || '').trim(); if (!v) return; if (SH()) { await SH().add(v); X.toast(X.v('记下了', '好，TA 们都会知道', '收到'), v.slice(0, 30)); return window.gyxFairOpen(true); } D.facts.unshift({ id: 'fa' + Date.now().toString(36), t: v.slice(0, 80), at: Date.now() }); await S.set('d', D); X.toast(X.v('记下了', '好，TA 们都会知道', '收到'), v.slice(0, 30)); window.gyxFairOpen(true); };
window.gyxFairDel = async id => { if (SH()) { await SH().del(id); return window.gyxFairOpen(true); } const i = D.facts.findIndex(x => x.id === id); if (i >= 0) D.facts.splice(i, 1); await S.set('d', D); window.gyxFairOpen(true); };
window.gyxFairOpen = function (keep) {
    const ov = X.panel('gyxFairOv', '🛡️ 别把她写弱', `<div class="gyx-tip">每一条都会告诉 TA。人味强化里已经有的（特质别演过头、别替你说话）这里不重复。</div>
        <div class="fa-list">${KS.map(k => `<label class="fa-r${ruleOn(k) ? ' on' : ''}"><input type="checkbox" ${ruleOn(k) ? 'checked' : ''} onchange="gyxFairToggle('${k}',this.checked)"><div><b>${R[k].ico} ${R[k].n}</b><span>${X.esc(fText(k))}</span></div></label>`).join('')}</div>
        <div class="du-h" style="font-weight:700;margin:16px 0 6px">她的真实情况 <span class="gyx-tip">所有 TA 以这个为准${SH() ? ' · 和 📇 生活小档案里是同一份' : ''}</span></div>
        <div class="gyx-row"><input class="gyx-in" id="gyxFairIn" placeholder="比如：做饭很好吃 / 超能吃辣 / 游戏打得比你好" style="flex:1" onkeydown="if(event.key==='Enter'){gyxFairAdd(this.value);}"><button class="gyx-btn" onclick="gyxFairAdd(document.getElementById('gyxFairIn').value)">记下</button></div>
        ${facts().map(x => `<div class="fa-f"><span>${X.esc(x.t)}</span><i onclick="gyxFairDel('${x.id}')">✕</i></div>`).join('') || '<div class="gyx-tip">还没记。写几条你自己的真实样子，TA 就不会乱编。</div>'}
        ${D.praise.length ? `<div class="du-h" style="font-weight:700;margin:16px 0 6px">TA 认真夸过你的</div>${D.praise.slice(0, 8).map(x => `<div class="gyx-tip">${new Date(x.at).toLocaleDateString()} · ${X.esc(x.who)}：${X.esc(x.t)}</div>`).join('')}` : ''}`);
    if (keep && ov && window.__gyxFairSt) { const b = ov.querySelector('.gyx-box'); if (b) b.scrollTop = window.__gyxFairSt; }
    if (ov) { const b = ov.querySelector('.gyx-box'); if (b) b.addEventListener('scroll', () => { window.__gyxFairSt = b.scrollTop; }); }
};
X.ctx(() => {
    const a = KS.filter(ruleOn).filter(k => !(k === 'facts' && !ruleOn('facts')));
    let s = a.length ? `【守则：别把她写弱】\n${a.map(k => '- ' + fText(k)).join('\n')}` : '';
    if (!SH() && D.facts.length) s += `\n【她的真实情况（以这个为准，别跟它矛盾，也别自己往反方向编）】${D.facts.slice(0, 20).map(x => x.t).join('；')}。`;
    return s.trim();
}, 'gyxFair');
X.action({ key: 'gyx_fair_praise', label: '认真夸她一次具体的本事', hint: '不是哄，是真的佩服她某件事做得好', need: c => ruleOn('strong'),
    run: async c => {
        const F = facts(), f = F.length ? X.pick(F).t : '';
        if (X.bailu()) { const t = X.cards(['夸夸', '聊天'], c, 1)[0]; if (!t) return null; X.say(c, t); D.praise.unshift({ at: Date.now(), who: X.name(c), t: X.plain(t).slice(0, 40) }); D.praise = D.praise.slice(0, 40); await S.set('d', D); return '认真夸了她一句'; }
        const ok = await X.reach(c, `你想起她${f ? '「' + f + '」' : '最近做得很好的一件事'}，是真的佩服、不是哄——具体地夸她一次（说清楚佩服她哪儿），用你自己的方式`);
        if (ok) { D.praise.unshift({ at: Date.now(), who: X.name(c), t: f || '最近做得好的事' }); D.praise = D.praise.slice(0, 40); await S.set('d', D); }
        return ok ? '认真夸了她一次' : null;
    } }, 'gyxFair');
X.today(() => ({ title: '🛡️ 别把她写弱', rows: D.praise.filter(x => X.day(new Date(x.at)) === X.day()).slice(0, 3).map(x => ({ t: x.who + ' 夸你', x: X.esc(x.t), go: 'gyxFairOpen()' })) }), 'gyxFair');
X.widget('gyxFairW', { n: '别把她写弱', sizes: ['s', 'm'], tap: () => window.gyxFairOpen(), r: w => X.gw(w, '🛡️', '别把她写弱', [`${KS.filter(ruleOn).length} 条守则开着`, facts().length ? `她的真实情况 ${facts().length} 条` : '还没记她的真实情况', D.praise[0] ? `${X.esc(D.praise[0].who)} 夸过你` : '']) }, 'gyxFair');
X.mem({ k: 'gyxFair', ico: '🛡️', n: '她的真实情况', d: '所有 TA 共用，以这个为准（在这里改、删都行）', items: () => SH() ? [] : D.facts, text: x => x.t,
    edit: (x, v) => { x.t = String(v).slice(0, 80); }, del: (c, i) => { D.facts.splice(i, 1); }, meta: x => new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxFair');
X.css('gyxFairCss', `.fa-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}.fa-r{display:flex;gap:10px;align-items:flex-start;border:1.5px solid rgba(0,0,0,.07);border-radius:12px;padding:9px 11px;cursor:pointer}
.fa-r div{display:flex;flex-direction:column;gap:3px}.fa-r span{font-size:12px;color:#888;line-height:1.55}.fa-r.on{border-color:#7cc4ff;background:#f4faff}
.fa-f{display:flex;justify-content:space-between;align-items:center;padding:7px 10px;margin-top:6px;border-radius:10px;background:#f6f7f9;font-size:13px}.fa-f i{font-style:normal;color:#aaa;cursor:pointer;padding:0 4px}`);
X.mini({ id: 'gyxFair', icon: '🛡️', title: '别把她写弱', desc: '不矮化、不替你编设定、不支配、不暴走、说人话；记一份你的真实情况', cat: '关系', onOpen: () => window.gyxFairOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.on = D.on || {}; D.facts = Array.isArray(D.facts) ? D.facts : []; D.praise = Array.isArray(D.praise) ? D.praise : []; let n = 0; const iv = setInterval(() => { if (SH() || ++n > 40) { clearInterval(iv); moveFacts(); } }, 500); })();
