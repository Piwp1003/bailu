/* 💞 好感两层：TA 对你的感情分成「心里」和「面上」两层——嘴硬的人心里早就软了，面上还是淡淡的。只在聊天里有实打实的证据时才挪一格，每次挪都记下是哪句话；和「关系账本」的分数是两回事，账本记事，这里记心口不一 */
if (window.__gyxDual) return; window.__gyxDual = 1;
X.feat('gyxDual', { n: '💞 好感两层', desc: '心里怎么想、面上怎么表现分开记，有证据才挪，心口不一会自然流露' });
const S = X.store('dual');
const IN = ['强烈反感', '反感', '提防', '没感觉', '有点在意', '喜欢', '很喜欢', '感情深厚'];
const OUT = ['明显敌对', '冷淡', '客气疏离', '正常', '友好', '亲近', '明显亲近'];
let D = { st: {}, cfg: { every: 20, show: true } };   // st[cid] = {i, o, log:[{id, at, layer, from, to, ev}], seen}
const stOf = cid => (D.st[String(cid)] = D.st[String(cid)] || { i: 5, o: 4, log: [], seen: null });
const msgsOf = cid => ((typeof globalChats !== 'undefined' && globalChats[cid]) || []).filter(m => m && m.sender !== 'system' && !m.side);
const clamp = (v, L) => Math.max(0, Math.min(L.length - 1, v | 0));
function move(cid, layer, to, ev, src) {
    const s = stOf(cid), L = layer === 'i' ? IN : OUT, from = s[layer]; to = clamp(to, L);
    if (to === from) return null;
    s[layer] = to; const it = { id: 'du' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), at: Date.now(), layer, from, to, ev: String(ev || '').slice(0, 80), src: src || 'chat' };
    s.log.unshift(it); return it;
}
async function judge(c, force) {
    const cid = String(c.id), all = msgsOf(cid), s = stOf(cid);
    const fresh = all.slice(force ? Math.max(0, all.length - 40) : (s.seen || 0)); s.seen = all.length; await S.set('d', D);
    if (X.bailu() || fresh.length < 4) return 0;
    const rel = window.gyRel ? `（关系账本里现在是「${(st => typeof st === 'string' ? st : ((st || {}).name || ''))(window.gyRel.stage(cid))}」，仅供参考）` : '';
    const chat = fresh.slice(-50).map(m => (m.sender === 'me' ? '她：' : '你：') + X.plain(m.text).slice(0, 160)).join('\n');
    const j = X.json(await X.ask(`${X.who(c)}\n分两层看你对她的感情：\n心里（真实感受）现在是「${IN[s.i]}」，可选：${IN.join(' / ')}\n面上（表现出来的）现在是「${OUT[s.o]}」，可选：${OUT.join(' / ')}\n${rel}\n\n最近的聊天：\n${chat}\n\n规则：没有实打实的证据就不动；一次最多挪一格；心里和面上可以不一样（嘴硬、害羞、端着、装没事）。动了的话 ev 写聊天里的那句话或那件事。\n只输出 JSON：{"inner":"不变 或 新档位","innerEv":"","outer":"不变 或 新档位","outerEv":""}`));
    if (!j) return 0; let n = 0;
    const st = (k, L, ev, layer) => { const v = L.indexOf(String(j[k] || '')); if (v >= 0 && ev && Math.abs(v - s[layer]) >= 1) { if (move(cid, layer, s[layer] + Math.sign(v - s[layer]), ev, 'auto')) n++; } };
    st('inner', IN, j.innerEv, 'i'); st('outer', OUT, j.outerEv, 'o');
    await S.set('d', D); return n;
}
async function tick() { if (!X.on('gyxDual')) return; for (const c of X.chars()) { const s = stOf(c.id), n = msgsOf(c.id).length; if (s.seen == null) { s.seen = n; continue; } if (n - s.seen >= Math.max(6, +D.cfg.every || 20)) await judge(c); } await S.set('d', D); }
window.gyxDualJudge = async cid => { const c = X.char(cid) || X.cur(); if (!c) return 0; const n = await judge(c, true); window.gyxDualOpen(c.id); return n; };
window.gyxDualSet = async (cid, layer, v, ev) => { move(cid, layer, +v, ev || '你手动调的', 'me'); await S.set('d', D); window.gyxDualOpen(cid); };
window.gyxDualDel = async (cid, id) => { const s = stOf(cid), i = s.log.findIndex(x => x.id === id); if (i >= 0) s.log.splice(i, 1); await S.set('d', D); window.gyxDualOpen(cid); };
window.gyxDualCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxDualData = () => D;
const gap = s => s.i - Math.round(s.o * (IN.length - 1) / (OUT.length - 1));
window.gyxDualOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), s = stOf(cid), g = gap(s);
    const bar = (L, v, layer) => `<div class="du-bar">${L.map((n, k) => `<i class="${k === v ? 'on' : ''}" onclick="gyxDualSet('${cid}','${layer}',${k})">${n}</i>`).join('')}</div>`;
    X.panel('gyxDualOv', '💞 好感两层', `<div class="gyx-row">${X.whoSel(cid, 'gyxDualOpen')}${X.bailu() ? '' : `<button class="gyx-btn lite" onclick="this.disabled=true;this.textContent='在看…';gyxDualJudge('${cid}')">看看最近有没有变</button>`}</div>
        <div class="du-h">💗 心里</div>${bar(IN, s.i, 'i')}<div class="du-h">🙂 面上</div>${bar(OUT, s.o, 'o')}
        <div class="gyx-card gyx-tip">${g >= 2 ? X.v('嘴上淡淡的，心里早就软了。', '面上端着，心里藏不住。', '装作没什么，其实很在意。') : g <= -2 ? X.v('面上热络，心里还隔着一层。', '客客气气的好，心里还没真放进去。') : X.v('心里和面上差不多，挺坦诚的。', '想什么就表现成什么样。')}</div>
        <div class="du-h">为什么挪的</div>${s.log.slice(0, 40).map(x => `<div class="du-it"><span>${x.layer === 'i' ? '心里' : '面上'} ${X.esc((x.layer === 'i' ? IN : OUT)[x.from])} → <b>${X.esc((x.layer === 'i' ? IN : OUT)[x.to])}</b></span><em>${X.esc(x.ev)} · ${new Date(x.at).toLocaleDateString()}</em><i onclick="gyxDualDel('${cid}','${x.id}')">删</i></div>`).join('') || '<div class="gyx-tip">还没挪过</div>'}
        <div class="gyx-row gyx-tip">每聊 <input class="gyx-who" type="number" min="6" value="${D.cfg.every}" style="width:60px" onchange="gyxDualCfg('every',+this.value)"> 句看一次 · <label><input type="checkbox" ${D.cfg.show ? 'checked' : ''} onchange="gyxDualCfg('show',this.checked)"> 告诉 TA 自己现在是哪一档</label></div>
        <div class="gyx-tip">${X.bailu() ? '白露没接 API：点上面的档位手动挪。' : '只在有证据时挪一格，点档位也能手动改。'}</div>`);
};
X.ctx(id => { if (!D.cfg.show) return ''; const s = D.st[String(id)]; if (!s) return ''; const g = gap(s); return `【你对她的感情（两层）】心里：${IN[s.i]}；面上：${OUT[s.o]}。${g >= 2 ? '心里比面上在意得多——按面上的样子说话，但小细节里藏不住。' : g <= -2 ? '面上比心里热络——客气归客气，别装得太过。' : ''}`; }, 'gyxDual');
X.action({ key: 'gyx_dual', label: '一不小心流露一句心里话', hint: '面上淡淡的，心里早就软了', need: c => { const s = D.st[String(c.id)]; return !!s && gap(s) >= 2; },
    run: async c => (await X.reach(c, '你面上一直端着，心里其实很在意她。这次不小心流露一点点真心（说完可能还想找补一下）')) ? '不小心说了句心里话' : null }, 'gyxDual');
X.today(() => { const rows = []; X.chars().forEach(c => { const s = D.st[String(c.id)]; if (!s) return; s.log.filter(x => X.day(new Date(x.at)) === X.day()).forEach(x => rows.push({ t: x.layer === 'i' ? '心里' : '面上', x: `${X.esc(X.name(c))}：${X.esc((x.layer === 'i' ? IN : OUT)[x.to])}`, go: `gyxDualOpen('${c.id}')` })); }); return { title: '💞 好感两层', rows }; }, 'gyxDual');
X.widget('gyxDualW', { n: '好感两层', sizes: ['s', 'm'], tap: () => window.gyxDualOpen(), r: w => { const c = X.cur(); if (!c) return X.gw(w, '💞', '好感两层', []); const s = stOf(c.id); return X.gw(w, '💞', X.name(c), ['心里 ' + IN[s.i], '面上 ' + OUT[s.o]]); } }, 'gyxDual');
X.mem({ k: 'gyxDual', ico: '💞', n: '好感两层', d: '心里/面上每一次挪动和证据', items: c => stOf(c.id).log, text: x => x.ev, edit: (x, v) => { x.ev = v; }, del: (c, i) => { stOf(c.id).log.splice(i, 1); }, meta: x => (x.layer === 'i' ? '心里 ' + IN[x.to] : '面上 ' + OUT[x.to]) + ' · ' + new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxDual');
X.css('gyxDualCss', `.du-h{font-weight:700;margin:12px 0 6px;font-size:14px}.du-bar{display:flex;flex-wrap:wrap;gap:4px}.du-bar i{font-style:normal;font-size:12px;padding:5px 9px;border-radius:10px;background:#f2f2f4;cursor:pointer}.du-bar i.on{background:linear-gradient(135deg,#ff8fb1,#c86bff);color:#fff}.du-it{display:flex;flex-direction:column;padding:7px 2px;border-bottom:1px solid #f3f3f3;font-size:13.5px;position:relative}.du-it em{font-style:normal;font-size:12px;color:#888}.du-it i{position:absolute;right:2px;top:8px;font-style:normal;font-size:11px;color:#aaa;cursor:pointer}`);
X.mini({ id: 'gyxDual', icon: '💞', title: '好感两层', desc: '心里怎么想、面上怎么表现，分开记', cat: '回忆', onOpen: () => window.gyxDualOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.st = D.st || {}; D.cfg = Object.assign({ every: 20, show: true }, D.cfg || {}); setTimeout(tick, 25000); setInterval(tick, 60000); })();
