/* 🧂 风格调料：TA 说话的味道一项项勾——幽默一点、烟火气、情绪更浓、带出身边的人、更主动表达爱、深度共鸣不说教、自然网感、打字随性。全局勾一套，单个 TA 也能自己一套，还能自己加一句。 */
if (window.__gyxSpice) return; window.__gyxSpice = 1;
X.feat('gyxSpice', { n: '🧂 风格调料', desc: 'TA 说话的味道一项项勾：幽默、烟火气、情绪浓、群像、主动表达爱、深度共鸣、网感、打字随性' });
const S = X.store('spice');
const SP = {
    humor: { ico: '😆', n: '幽默一点', t: '在符合人设的前提下更幽默风趣一点：会接梗、会自嘲、会冷不丁冒一句好笑的，但不油、不低俗、不硬抖机灵。' },
    life: { ico: '🍜', n: '烟火气', t: '话题多落在生活切片：身边的小事、今天看到听到的、想起的过去、打算的以后、偶尔的感性时刻。看到有意思的会主动分享给她，不必总等她开口。' },
    emo: { ico: '🌊', n: '情绪更浓', t: '情绪更浓一点、反馈更鲜明：开心就是真开心，委屈就是真委屈，吃醋就是吃醋，不要永远淡淡的、四平八稳的。' },
    crowd: { ico: '👥', n: '带出身边的人', t: '聊天里自然带出你们身边的人和事：朋友、家人、同事、宠物、喜欢的明星……这些人各有各的设定和性格，别弄混、别凭空改。' },
    sweet: { ico: '💌', n: '更主动表达爱', t: '更主动地表达爱：想她了就说，自然的情话，偶尔一句正经的告白；见面时更主动牵手、拥抱、亲吻。但要符合你的人设，嘴硬的人就用嘴硬的方式。' },
    deep: { ico: '🫂', n: '深度共鸣', t: '她想认真聊心事的时候，先接住她的情绪，再按你自己的经历和感受真诚回应；不说教、不讲大道理、不像 AI 那样只列建议不给情绪。' },
    net: { ico: '📱', n: '自然网感', t: '能自然用网络流行语、梗、表情包、颜文字，像真的每天在网上冲浪的人；不用恶俗的梗，不开贬低女性的玩笑。' },
    loose: { ico: '⌨️', n: '打字随性', t: '打字可以很随性：不加标点、用空格断句，偶尔打错字再补一句纠正，倒装、缩写、黑话都行；看情境用，别每句都这样，别故意写得难读。' }
};
const KS = Object.keys(SP);
const PL = (id, d) => { try { return typeof gyPL === 'function' ? gyPL(id, d) : d; } catch (e) { return d; } };   // 📜 内置提示词库（js/88）里改过就用改过的
const spText = k => PL('spice.' + k, SP[k].t);
KS.forEach(spText);
let D = { g: {}, per: {}, log: [] };   // g：全局勾的；per[cid] = { own: bool, set: {}, note: '' }
const perOf = c => D.per[String(c && c.id)] || null;
const setOf = c => { const p = perOf(c); return p && p.own ? (p.set || {}) : D.g; };
const actives = c => KS.filter(k => setOf(c)[k]);
const logIt = (cid, t) => { D.log.unshift({ id: 'sp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), cid: cid ? String(cid) : '', at: Date.now(), t }); D.log = D.log.slice(0, 150); };
window.gyxSpiceToggle = async (scope, k, v) => {
    if (scope === 'g') D.g[k] = !!v;
    else { const p = D.per[scope] = D.per[scope] || { own: true, set: Object.assign({}, D.g), note: '' }; p.set[k] = !!v; }
    logIt(scope === 'g' ? '' : scope, `${v ? '加了' : '去掉了'}「${SP[k].n}」${scope === 'g' ? '（全局）' : ''}`);
    await S.set('d', D); window.gyxSpiceOpen(scope === 'g' ? null : scope, true);
};
window.gyxSpiceOwn = async (cid, v) => {
    const p = D.per[cid] = D.per[cid] || { own: false, set: {}, note: '' };
    p.own = !!v; if (v && !Object.keys(p.set || {}).length) p.set = Object.assign({}, D.g);
    logIt(cid, v ? '用自己的一套调料' : '跟着全局的调料'); await S.set('d', D); window.gyxSpiceOpen(cid, true);
};
window.gyxSpiceNote = async (cid, v) => { const p = D.per[cid] = D.per[cid] || { own: false, set: {}, note: '' }; p.note = String(v || '').slice(0, 300); logIt(cid, p.note ? '自己加了一句：' + p.note.slice(0, 30) : '删了自己加的那句'); await S.set('d', D); };
window.gyxSpiceOpen = function (who, keep) {
    const c = X.char(who) || X.cur();
    const chips = (scope, set) => `<div class="sp-grid">${KS.map(k => `<label class="sp-c${set[k] ? ' on' : ''}"><input type="checkbox" ${set[k] ? 'checked' : ''} onchange="gyxSpiceToggle('${scope}','${k}',this.checked)"><b>${SP[k].ico} ${SP[k].n}</b><span>${X.esc(spText(k))}</span></label>`).join('')}</div>`;
    const p = c ? perOf(c) || { own: false, set: {}, note: '' } : null;
    const ov = X.panel('gyxSpiceOv', '🧂 风格调料', `<div class="gyx-tip">勾上的每一项都会告诉 TA。别全勾——调料放多了就串味了，挑两三样最想要的。</div>
        <div class="du-h" style="font-weight:700;margin:12px 0 6px">全局（所有 TA）</div>${chips('g', D.g)}
        ${c ? `<div class="du-h" style="font-weight:700;margin:16px 0 6px;display:flex;align-items:center;gap:8px">单个 TA ${X.whoSel(c.id, 'gyxSpiceOpen')}</div>
        <label class="gyx-row"><input type="checkbox" ${p.own ? 'checked' : ''} onchange="gyxSpiceOwn('${c.id}',this.checked)"> ${X.esc(X.name(c))} 用自己的一套（不跟全局）</label>
        ${p.own ? chips(String(c.id), p.set || {}) : `<div class="gyx-tip">现在跟着全局：${actives(c).map(k => SP[k].ico + SP[k].n).join('、') || '什么都没勾'}</div>`}
        <div class="gyx-tip" style="margin-top:10px">再给 ${X.esc(X.name(c))} 自己加一句（只对 TA 生效）：</div>
        <textarea class="gyx-in" style="width:100%;min-height:60px;box-sizing:border-box" placeholder="比如：说话爱带「嘛」「啦」；生气时只回一个字" onchange="gyxSpiceNote('${c.id}',this.value)">${X.esc(p.note || '')}</textarea>` : ''}`);
    if (keep && ov) { const b = ov.querySelector('.gyx-box'); if (b && window.__gyxSpiceSt) b.scrollTop = window.__gyxSpiceSt; }
    if (ov) { const b = ov.querySelector('.gyx-box'); if (b) b.addEventListener('scroll', () => { window.__gyxSpiceSt = b.scrollTop; }); }
};
X.ctx(id => {
    const c = X.char(id); if (!c) return '';
    const a = actives(c), p = perOf(c), note = p && p.note;
    if (!a.length && !note) return '';
    return `【说话的味道（她挑的调料，自然地带出来，别刻意表演）】\n${a.map(k => '- ' + spText(k)).join('\n')}${note ? '\n- ' + note : ''}`;
}, 'gyxSpice');
X.action({ key: 'gyx_spice', label: '带着她挑的味道找她聊一句', hint: '烟火气就分享身边小事、网感就丢个梗、主动表达爱就说句情话',
    need: c => actives(c).some(k => ['life', 'net', 'sweet', 'crowd', 'humor'].includes(k)),
    run: async c => {
        const a = actives(c).filter(k => ['life', 'net', 'sweet', 'crowd', 'humor'].includes(k)); const k = X.pick(a);
        const why = { life: '刚碰到一件生活里的小事（看到的、吃到的、想起的），想分享给她', net: '刷到一个很好笑的梗/表情包，第一个想到她，丢给她', sweet: '突然很想她，忍不住说句情话（按你的性子说）', crowd: '身边的朋友/家人/宠物刚发生了件事，跟她八卦一下', humor: '想到个好笑的事，逗逗她' }[k];
        if (X.bailu()) { const t = X.cards(['聊天'], c, 1)[0]; if (!t) return null; X.say(c, t); return '找她说了句话'; }
        return (await X.reach(c, why)) ? `带着「${SP[k].n}」找她聊了一句` : null;
    } }, 'gyxSpice');
X.today(() => { const c = X.cur(); if (!c) return null; const a = actives(c); const ch = D.log.filter(x => X.day(new Date(x.at)) === X.day());
    return { title: '🧂 风格调料', rows: (a.length ? [{ t: X.name(c), x: a.map(k => SP[k].ico + SP[k].n).join('、'), go: `gyxSpiceOpen('${c.id}')` }] : []).concat(ch.slice(0, 2).map(x => ({ t: '今天', x: X.esc(x.t), go: 'gyxSpiceOpen()' }))) }; }, 'gyxSpice');
X.widget('gyxSpiceW', { n: '风格调料', sizes: ['s', 'm'], tap: () => window.gyxSpiceOpen(), r: w => { const c = X.cur(); const a = c ? actives(c) : KS.filter(k => D.g[k]);
    return X.gw(w, '🧂', c ? X.name(c) + ' 的调料' : '风格调料', [a.length ? a.map(k => SP[k].ico).join(' ') : '还没勾', a.map(k => SP[k].n).join('、')]); } }, 'gyxSpice');
X.mem({ k: 'gyxSpice', ico: '🧂', n: '风格调料', d: '给这个 TA 自己加的那句调料，和调过的记录',
    items: c => { const p = perOf(c); return (p && p.note ? [{ id: '__note', cid: String(c.id), at: Date.now(), t: p.note, note: 1 }] : []).concat(D.log.filter(x => x.cid === String(c.id))); },
    text: x => x.t, edit: (x, v) => { if (x.note) { const p = D.per[x.cid]; if (p) p.note = String(v).slice(0, 300); } else x.t = v; },
    del: (c, i) => { const p = perOf(c); if (p && p.note && i === 0) { p.note = ''; return; } const L = D.log.filter(x => x.cid === String(c.id)); const it = L[p && p.note ? i - 1 : i]; const k = D.log.indexOf(it); if (k >= 0) D.log.splice(k, 1); },
    meta: x => x.note ? '自己加的一句' : new Date(x.at).toLocaleString(), save: () => S.set('d', D) }, 'gyxSpice');
X.css('gyxSpiceCss', `.sp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:520px){.sp-grid{grid-template-columns:1fr}}
.sp-c{border:1.5px solid rgba(0,0,0,.08);border-radius:14px;padding:9px 11px;cursor:pointer;display:flex;flex-direction:column;gap:3px;position:relative}.sp-c input{position:absolute;right:10px;top:10px}
.sp-c span{font-size:11.5px;color:#888;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.sp-c.on{border-color:#ffb547;background:#fffaf0}`);
X.mini({ id: 'gyxSpice', icon: '🧂', title: '风格调料', desc: '幽默、烟火气、情绪浓、群像、主动表达爱、深度共鸣、网感、打字随性——一项项勾', cat: '关系', onOpen: () => window.gyxSpiceOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.g = D.g || {}; D.per = D.per || {}; D.log = Array.isArray(D.log) ? D.log : []; })();
