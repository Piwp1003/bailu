/* 🕯️ 睡前三件好事：每晚睡前一个小仪式——你写下今天的三件好事（再小都算），和一件明天期待的事；TA 也写 TA 的，然后互相看。到点 TA 会来提醒，攒下来是一本只有好事的本子 */
if (window.__gyxGood) return; window.__gyxGood = 1;
X.feat('gyxGood', { n: '🕯️ 睡前三件好事', desc: '每晚写三件好事和一件明天期待的事，TA 也写，攒成好事本' });
const S = X.store('good');
let D = { days: {}, cfg: { hour: 22, remind: true }, told: {} };   // days[cid][day] = {me:[], meT:'', ta:[], taT:'', at, re}
const rec = (cid, d) => { const k = String(cid); D.days[k] = D.days[k] || {}; return (D.days[k][d] = D.days[k][d] || {}); };
async function taWrite(c, r) {
    if (r.ta && r.ta.length) return r;
    let j = X.bailu() ? null : X.json(await X.ask(`${X.who(c)}\n睡前小仪式：写下你今天的三件好事（具体、小小的也行，可以和她有关），再写一件明天期待的事。\n今天的聊天：\n${X.recent(c, 16)}\n只输出 JSON：{"three":["","",""],"tomorrow":""}`));
    if (!j || !Array.isArray(j.three)) { const cs = X.cards(['日记', '情话', '聊天'], c, 4).map(t => X.plain(t).slice(0, 30)); j = { three: [cs[0] || '今天你回我消息很快', cs[1] || '晚饭挺好吃的', cs[2] || '现在能跟你说晚安'], tomorrow: cs[3] || '明天早上第一个跟你说早安' }; }
    r.ta = j.three.slice(0, 3).map(t => X.plain(t)); r.taT = X.plain(j.tomorrow || ''); await S.set('d', D); return r;
}
window.gyxGoodSave = async (cid) => {
    const c = X.char(cid) || X.cur(); const v = i => ((document.getElementById('gyxGd' + i) || {}).value || '').trim(); const me = [v(0), v(1), v(2)].filter(Boolean); if (!me.length) { X.toast('🕯️ 写一件就行', '再小的事都算'); return null; }
    const r = rec(c.id, X.day()); r.me = me; r.meT = v('T'); r.at = Date.now(); await S.set('d', D); await taWrite(c, r);
    r.re = X.plain((X.bailu() ? null : await X.ask(`${X.who(c)}\n睡前你们交换了今天的好事。她写的：${r.me.join('；')}；明天期待：${r.meT || '（没写）'}。你写的：${r.ta.join('；')}。看完她的，说一句晚安前的话（温柔、可以回应她写的某一件）。`)) || X.pick(['今天也辛苦了。晚安，明天见。', '有好事就够了。晚安。', '你写的第一件，我也很开心。晚安。']));
    await S.set('d', D); window.gyxGoodOpen(c.id); return r;
};
window.gyxGoodData = () => D;
window.gyxGoodCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
const streak = cid => { const all = D.days[String(cid)] || {}, d = new Date(); if (!(all[X.day(d)] || {}).me) d.setDate(d.getDate() - 1); let n = 0; while ((all[X.day(d)] || {}).me) { n++; d.setDate(d.getDate() - 1); } return n; };
window.gyxGoodOpen = function (who, day) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), all = D.days[cid] || {}, today = X.day(), r = (day ? all[day] : all[today]) || {}, ks = Object.keys(all).filter(k => all[k].me).sort().reverse(), show = day || today;
    X.panel('gyxGdOv', '🕯️ 睡前三件好事', `<div class="gyx-row">${X.whoSel(cid, 'gyxGoodOpen')}<span class="gyx-tip">连续 ${streak(cid)} 晚 · 一共 ${ks.length} 晚</span></div>
        <div class="gd-pg"><em>${show}</em>${r.me ? `<div class="gd-two"><div><b>你</b><ol>${r.me.map(t => `<li>${X.esc(t)}</li>`).join('')}</ol>${r.meT ? `<div class="gd-t">明天期待：${X.esc(r.meT)}</div>` : ''}</div><div><b>${X.esc(X.name(c))}</b><ol>${(r.ta || []).map(t => `<li>${X.esc(t)}</li>`).join('')}</ol>${r.taT ? `<div class="gd-t">明天期待：${X.esc(r.taT)}</div>` : ''}</div></div>${r.re ? `<div class="gd-re gyx-hand">${X.esc(r.re)}</div>` : ''}`
        : show === today ? `<div class="gyx-tip">${X.v('今天有什么好事？再小都算。', '睡前想三件好事，会睡得好一点。', '写完我们交换着看。')}</div>${[0, 1, 2].map(i => `<input id="gyxGd${i}" class="gyx-in gd-in" placeholder="${['第一件好事', '第二件', '第三件'][i]}">`).join('')}<input id="gyxGdT" class="gyx-in gd-in" placeholder="明天期待的一件事"><div class="gyx-row"><button class="gyx-btn" onclick="this.disabled=true;this.textContent='交换中…';gyxGoodSave('${cid}')">写好了，交换</button></div>` : '<div class="gyx-tip">这天没写</div>'}</div>
        ${day ? `<div class="gyx-row"><button class="gyx-btn lite" onclick="gyxGoodOpen('${cid}')">回到今天</button></div>` : ''}
        <div style="font-weight:700;margin:12px 0 4px">好事本</div><div class="gd-cal">${ks.slice(0, 60).map(k => `<span onclick="gyxGoodOpen('${cid}','${k}')">${k.slice(5)}</span>`).join('') || '<span class="gyx-tip">还是空的</span>'}</div>
        <div class="gyx-row gyx-tip"><label><input type="checkbox" ${D.cfg.remind ? 'checked' : ''} onchange="gyxGoodCfg('remind',this.checked)"> 每晚</label><input class="gyx-who" type="number" min="0" max="23" value="${D.cfg.hour}" style="width:52px" onchange="gyxGoodCfg('hour',+this.value)"> 点 TA 来提醒</div>`);
};
async function tick() {
    if (!X.on('gyxGood') || !D.cfg.remind) return; const h = new Date().getHours(), d = X.day(); if (h !== +D.cfg.hour) return;
    for (const c of X.chars().slice(0, 1).concat(X.cur() ? [X.cur()] : []).filter((v, i, a) => a.indexOf(v) === i)) { const k = String(c.id) + d; if (D.told[k] || (rec(c.id, d).me)) continue; D.told[k] = 1; await S.set('d', D); X.notify(c, `🕯️ ${X.esc(X.name(c))}：${X.v('睡前三件好事，写了吗？', '今天的好事是什么呀？', '来交换今天的三件好事')}`, '写完一起看', () => window.gyxGoodOpen(c.id)); }
}
X.ctx(id => { const r = (D.days[String(id)] || {})[X.day()]; if (r && r.me) return `【今晚你们交换了三件好事】她：${r.me.join('；')}${r.meT ? '；明天期待：' + r.meT : ''}。你：${(r.ta || []).join('；')}。`; const y = new Date(); y.setDate(y.getDate() - 1); const p = (D.days[String(id)] || {})[X.day(y)]; return p && p.meT ? `【她昨晚说今天期待】${p.meT}——可以问问她怎么样了。` : ''; }, 'gyxGood');
X.action({ key: 'gyx_good', label: '睡前叫她一起写今天的三件好事', hint: '睡前小仪式', need: c => new Date().getHours() >= 20 && !(rec(c.id, X.day()).me),
    run: async c => { await taWrite(c, rec(c.id, X.day())); return (await X.reach(c, '快睡了，你想和她交换今天的三件好事（「🕯️ 睡前三件好事」里，你已经写好了）。温柔地叫她去写')) ? '叫你一起写三件好事' : null; } }, 'gyxGood');
X.today(() => { const c = X.cur(); if (!c) return null; const r = rec(c.id, X.day()); return { title: '🕯️ 睡前三件好事', rows: [{ t: r.me ? '已交换' : '今晚', x: r.me ? X.esc(r.me[0]) : '还没写', go: `gyxGoodOpen('${c.id}')` }] }; }, 'gyxGood');
X.widget('gyxGoodW', { n: '三件好事', sizes: ['s', 'm'], tap: () => window.gyxGoodOpen(), r: w => { const c = X.cur(); if (!c) return X.gw(w, '🕯️', '三件好事', []); const r = rec(c.id, X.day()); return X.gw(w, '🕯️', '三件好事', [r.me ? '今晚写好了 ✓' : '今晚还没写', '连续 ' + streak(c.id) + ' 晚']); } }, 'gyxGood');
X.mem({ k: 'gyxGood', ico: '🕯️', n: '睡前三件好事', d: '每晚的三件好事（你的｜TA 的）', items: c => { const all = D.days[String(c.id)] || {}; return Object.keys(all).filter(k => all[k].me).sort().reverse().map(k => Object.assign(all[k], { day: k })); }, text: x => x.me.join('；') + '｜' + (x.ta || []).join('；'), edit: (x, v) => { const [a, b] = v.split('｜'); x.me = a.split(/[；;]/).filter(Boolean); if (b != null) x.ta = b.split(/[；;]/).filter(Boolean); }, del: (c, i) => { const all = D.days[String(c.id)] || {}, ks = Object.keys(all).filter(k => all[k].me).sort().reverse(); delete all[ks[i]]; }, meta: x => x.day, save: () => S.set('d', D) }, 'gyxGood');
X.css('gyxGdCss', `.gd-pg{border-radius:18px;padding:14px;background:linear-gradient(#2d2a4a,#463a63);color:#f6efe2;margin:8px 0}.gd-pg em{font-style:normal;font-size:12px;opacity:.7}.gd-pg .gyx-tip{color:#d9cfe9}.gd-in{background:rgba(255,255,255,.12)!important;border-color:rgba(255,255,255,.2)!important;color:#fff!important;margin-top:6px}.gd-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px}.gd-two b{color:#ffd98a}.gd-two ol{margin:6px 0;padding-left:18px;font-size:14px;line-height:1.7}.gd-t{font-size:12.5px;color:#ffd98a}.gd-re{margin-top:10px;font-size:17px;text-align:center;color:#ffe8b8}.gd-cal{display:flex;flex-wrap:wrap;gap:6px}.gd-cal span{padding:4px 9px;border-radius:10px;background:#efeaf7;font-size:12.5px;cursor:pointer;color:#6a4f96}@media(max-width:480px){.gd-two{grid-template-columns:1fr}}`);
X.mini({ id: 'gyxGood', icon: '🕯️', title: '睡前三件好事', desc: '每晚交换三件好事', cat: '陪伴', onOpen: () => window.gyxGoodOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.days = D.days || {}; D.told = D.told || {}; D.cfg = Object.assign({ hour: 22, remind: true }, D.cfg || {}); setInterval(tick, 300000); setTimeout(tick, 30000); })();
