/* 🎡 帮我选：纠结吃什么、买哪个、去不去的时候，把选项丢给 TA——TA 认真帮你选并说理由（按 TA 记得的你的喜好），或者一起转转盘听天由命。选完过一阵 TA 会来问你「后来怎么样」 */
if (window.__gyxPick) return; window.__gyxPick = 1;
X.feat('gyxPick', { n: '🎡 帮我选', desc: '纠结的时候让 TA 帮你选，或者一起转转盘' });
const S = X.store('pick');
let D = { log: [] };   // [{id, cid, q, opts, pick, why, how:'ta'|'wheel', at, after, ask}]
const PRESET = [['今天吃什么', '火锅/麻辣烫/面/饺子/炸鸡/沙拉/寿司/汉堡'], ['喝什么', '奶茶/咖啡/果茶/可乐/白开水'], ['周末干嘛', '睡懒觉/出去逛/看电影/打游戏/收拾房间'], ['要不要', '要/不要'], ['先做哪件', '']];
const COL = ['#ff9aa2', '#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea', '#d5aaff', '#ffc6ff', '#bde0fe', '#fdffb6'];
async function taPick(c, q, opts) {
    const notes = window.gyxNotesData ? ((window.gyxNotesData().notes || {})[String(c.id)] || []).filter(x => x.who === 'me' && x.tier !== 'old').map(x => x.text).slice(0, 12).join('；') : '';
    if (!X.bailu()) { const j = X.json(await X.ask(`${X.who(c)}\n她在纠结：「${q}」，选项：${opts.join(' / ')}。\n${notes ? '你记得她：' + notes + '\n' : ''}最近的聊天：\n${X.recent(c, 10)}\n帮她选一个，理由要具体、像你会说的话（可以结合她最近的状态），30~70 字。\n只输出 JSON：{"pick":"选项原文","why":""}`)); if (j && opts.includes(j.pick)) return { pick: j.pick, why: X.plain(j.why || '') }; }
    const p = X.pick(opts); return { pick: p, why: X.pick([`选「${p}」。别纠结了，听我的。`, `我觉得「${p}」，你上次说过想试试的吧？`, `「${p}」！就这么定了，不好再怪我。`, `闭着眼都选「${p}」，相信我。`]) };
}
let SP = null;
function wheel(opts, rot) { const n = opts.length, R = 120, a = 2 * Math.PI / n; return `<svg viewBox="-130 -130 260 260" width="240" height="240" style="transform:rotate(${rot}deg);transition:transform 3.6s cubic-bezier(.17,.89,.22,1)">${opts.map((o, i) => { const a0 = i * a - Math.PI / 2, a1 = a0 + a, x0 = R * Math.cos(a0), y0 = R * Math.sin(a0), x1 = R * Math.cos(a1), y1 = R * Math.sin(a1), m = (a0 + a1) / 2; return `<path d="M0 0 L${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 ${a > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}Z" fill="${COL[i % COL.length]}" stroke="#fff" stroke-width="2"/><text x="${(R * .62 * Math.cos(m)).toFixed(1)}" y="${(R * .62 * Math.sin(m)).toFixed(1)}" font-size="${n > 7 ? 11 : 13}" text-anchor="middle" dominant-baseline="middle" fill="#444">${X.esc(o.slice(0, 6))}</text>`; }).join('')}<circle r="16" fill="#fff" stroke="#eee"/></svg>`; }
const optsOf = () => ((document.getElementById('gyxPkO') || {}).value || '').split(/[\/／,，、\n]/).map(s => s.trim()).filter(Boolean);
window.gyxPickPreset = i => { const [q, o] = PRESET[i]; document.getElementById('gyxPkQ').value = q; document.getElementById('gyxPkO').value = o; };
window.gyxPickTa = async cid => { const c = X.char(cid), q = ((document.getElementById('gyxPkQ') || {}).value || '').trim() || '帮我选', opts = optsOf(); if (!c || opts.length < 2) { X.toast('🎡 至少给两个选项', '用 / 隔开'); return null; } const r = await taPick(c, q, opts); const it = { id: 'pk' + Date.now().toString(36), cid: String(cid), q, opts, pick: r.pick, why: r.why, how: 'ta', at: Date.now() }; D.log.unshift(it); await S.set('d', D); window.gyxPickOpen(cid, it.id); return it; };
window.gyxPickSpin = async cid => {
    const c = X.char(cid), q = ((document.getElementById('gyxPkQ') || {}).value || '').trim() || '转盘', opts = optsOf(); if (!c || opts.length < 2) { X.toast('🎡 至少给两个选项', '用 / 隔开'); return null; }
    const i = Math.floor(Math.random() * opts.length), n = opts.length, rot = 360 * 6 - (i + .5) * 360 / n; const box = document.getElementById('gyxPkWheel'); box.innerHTML = `<div class="pk-ptr">▼</div>` + wheel(opts, 0); await new Promise(r => setTimeout(r, 30)); box.querySelector('svg').style.transform = `rotate(${rot}deg)`;
    await new Promise(r => setTimeout(r, SP === 'fast' ? 50 : 3700));
    const why = X.bailu() ? X.pick([`转到「${opts[i]}」了！老天都这么说了。`, `「${opts[i]}」～是不是心里偷偷希望是这个？`, `转盘说「${opts[i]}」，那就它了。`]) : X.plain(await X.ask(`${X.who(c)}\n她纠结「${q}」（${opts.join(' / ')}），你们一起转了转盘，转到「${opts[i]}」。说一句反应（如果你觉得她其实想要别的，也可以说）。`) || `转到「${opts[i]}」！`);
    const it = { id: 'pk' + Date.now().toString(36), cid: String(cid), q, opts, pick: opts[i], why, how: 'wheel', at: Date.now() }; D.log.unshift(it); await S.set('d', D); window.gyxPickOpen(cid, it.id); return it;
};
window.gyxPickAfter = async (id, v) => { const x = D.log.find(y => y.id === id); if (x) { x.after = v; await S.set('d', D); } };
window.gyxPickDel = async id => { const x = D.log.find(y => y.id === id); D.log = D.log.filter(y => y.id !== id); await S.set('d', D); window.gyxPickOpen(x && x.cid); };
window.gyxPickData = () => D;
window.gyxPickOpen = function (who, hl) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), last = hl && D.log.find(x => x.id === hl);
    X.panel('gyxPkOv', '🎡 帮我选', `<div class="gyx-row">${X.whoSel(cid, 'gyxPickOpen')}</div>
        <div class="gyx-row">${PRESET.map((p, i) => `<span class="gyx-chip" onclick="gyxPickPreset(${i})">${p[0]}</span>`).join('')}</div>
        <input id="gyxPkQ" class="gyx-in" placeholder="纠结什么？" value="${last ? X.esc(last.q) : ''}"><textarea id="gyxPkO" class="gyx-in" rows="2" style="margin-top:6px" placeholder="选项，用 / 隔开：火锅 / 麻辣烫 / 面">${last ? X.esc(last.opts.join(' / ')) : ''}</textarea>
        <div class="gyx-row"><button class="gyx-btn" onclick="this.disabled=true;this.textContent='TA 在想…';gyxPickTa('${cid}')">让 TA 帮我选</button><button class="gyx-btn lite" onclick="this.disabled=true;gyxPickSpin('${cid}')">一起转转盘</button></div>
        <div id="gyxPkWheel" class="pk-wh"></div>
        ${last ? `<div class="gyx-card pk-res"><em>${X.esc(X.name(c))} 说</em><b>${X.esc(last.pick)}</b><div>${X.esc(last.why)}</div></div>` : ''}
        <div style="font-weight:700;margin:12px 0 4px">选过的</div>${D.log.filter(x => x.cid === cid).slice(0, 20).map(x => `<div class="pk-it"><span>${X.esc(x.q)}：<b>${X.esc(x.pick)}</b> <em>${x.how === 'wheel' ? '🎡' : '💬'} ${new Date(x.at).toLocaleDateString()}</em></span><input class="gyx-who" placeholder="后来怎么样？" value="${X.esc(x.after || '')}" onchange="gyxPickAfter('${x.id}',this.value)"><i onclick="gyxPickDel('${x.id}')">删</i></div>`).join('') || '<div class="gyx-tip">还没选过</div>'}`);
};
window.__gyxPickFast = () => { SP = 'fast'; };
X.ctx(id => { const x = D.log.find(y => y.cid === String(id) && Date.now() - y.at < 864e5); return x ? `【今天你帮她选过】「${x.q}」→ ${x.pick}${x.after ? '（后来：' + x.after + '）' : ''}。` : ''; }, 'gyxPick');
X.action({ key: 'gyx_pick', label: '问她上次帮她选的那件事后来怎么样', hint: '帮我选', need: c => D.log.some(x => x.cid === String(c.id) && !x.ask && !x.after && Date.now() - x.at > 3 * 36e5 && Date.now() - x.at < 3 * 864e5),
    run: async c => { const x = D.log.find(y => y.cid === String(c.id) && !y.ask && !y.after && Date.now() - y.at > 3 * 36e5); x.ask = Date.now(); await S.set('d', D); return (await X.reach(c, `之前她纠结「${x.q}」，你帮她选了「${x.pick}」。问问她后来怎么样，选对了没`)) ? '问你后来怎么样' : null; } }, 'gyxPick');
X.today(() => ({ title: '🎡 帮我选', rows: D.log.filter(x => X.day(new Date(x.at)) === X.day()).map(x => ({ t: x.how === 'wheel' ? '转盘' : 'TA 选', x: X.esc(x.q) + '：' + X.esc(x.pick), go: `gyxPickOpen('${x.cid}')` })) }), 'gyxPick');
X.widget('gyxPickW', { n: '帮我选', sizes: ['s', 'm'], tap: () => window.gyxPickOpen(), r: w => { const x = D.log[0]; return X.gw(w, '🎡', '帮我选', x ? [X.esc(x.pick), X.esc(x.q)] : ['纠结了？']); } }, 'gyxPick');
X.memArr({ k: 'gyxPick', ico: '🎡', n: '帮我选', d: '纠结过的事、选了什么、后来怎么样', arr: () => D.log, text: x => x.q + '→' + x.pick + (x.after ? '｜后来：' + x.after : ''), edit: (x, v) => { const m = v.match(/^(.*?)→(.*?)(?:｜后来：(.*))?$/); if (m) { x.q = m[1]; x.pick = m[2]; if (m[3] != null) x.after = m[3]; } }, meta: x => (x.how === 'wheel' ? '转盘' : 'TA 选的') + ' · ' + new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxPick');
X.css('gyxPkCss', `.pk-wh{position:relative;display:flex;justify-content:center;margin:6px 0}.pk-ptr{position:absolute;top:-4px;left:50%;transform:translateX(-50%);z-index:2;color:#e0567a;font-size:20px}.pk-res em{font-style:normal;font-size:12px;color:#999}.pk-res b{display:block;font-size:22px;margin:4px 0}.pk-it{display:flex;gap:6px;align-items:center;padding:6px 2px;border-bottom:1px solid #f3f3f3;font-size:13.5px;flex-wrap:wrap}.pk-it span{flex:1;min-width:150px}.pk-it em{font-style:normal;font-size:11px;color:#aaa}.pk-it input{width:130px}.pk-it i{font-style:normal;font-size:11px;color:#aaa;cursor:pointer}`);
X.mini({ id: 'gyxPick', icon: '🎡', title: '帮我选', desc: '纠结的时候让 TA 帮你选 / 转转盘', cat: '生活', onOpen: () => window.gyxPickOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.log = D.log || []; })();

// 🎮 放进聊天里的游戏列表（和五子棋、UNO、猜拳在一起）；小功能里就不单独占一格了（js/79 看到这里登记了会藏起来）
(function () {
    const reg = () => { if (typeof registerMiniGame !== 'function') return false; registerMiniGame({ id: 'gyxPick', name: '帮我选', icon: '🎡', getStatus: () => null, onResume: () => window.gyxPickOpen(), onStart: (sid, opp) => window.gyxPickOpen(String((opp || [])[0] || sid || '')) }); return true; };
    const unreg = () => { try { registeredMiniGames = registeredMiniGames.filter(g => g.id !== 'gyxPick'); } catch (e) {} };
    addEventListener('gyx:feat', e => { if (e.detail && e.detail.id === 'gyxPick') e.detail.on ? reg() : unreg(); });
    if (X.on('gyxPick') && !reg()) { let n = 0; const iv = setInterval(() => { if (reg() || ++n > 60) clearInterval(iv); }, 500); }
})();
