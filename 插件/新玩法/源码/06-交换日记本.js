/* 📓 交换日记本：一本你们轮流写的本子——手写字、纸张、胶带和贴纸；你写完一页，TA 过一阵接着写 */
if (window.__gyxJournal) return; window.__gyxJournal = 1;
X.feat('gyxJournal', { n: '📓 交换日记本', desc: '你们轮流写的本子：手写字、纸张、胶带、贴纸；你写完 TA 过一阵接着写' });
const S = X.store('journal');
let D = { books: {}, cfg: { minH: 1, maxH: 10 } };   // books[cid] = { pages:[{by, text, at, deco, stickers}], pending:{at} , paper }
const PAPERS = [['格子', 'grid'], ['横线', 'line'], ['牛皮纸', 'kraft'], ['点点', 'dot'], ['空白', 'plain']];
const TAPES = ['#f7c5cc', '#c9e4ff', '#d6f5d6', '#ffe8a8', '#e3d4ff', '#ffd6b8'];
const STK = ['🌷', '⭐', '🍓', '☁️', '🐱', '🌙', '💌', '🍀', '🎀', '☕', '🌻', '🫧', '🐻', '🍰', '✨', '💗'];
const book = cid => (D.books[cid] = D.books[cid] || { pages: [], pending: null, paper: 'grid' });
let CID = '', PG = -1, EDIT = null;
async function taWrite(c) {
    const b = book(String(c.id)); const last = b.pages.slice(-4).map(p => `${p.by === 'me' ? X.me(c) : '你'}写的：\n${p.text}`).join('\n\n');
    if (X.bailu()) return X.cards(['日记', '信', '聊天'], c, 4).join('\n') || '今天也想你。';
    const r = await X.ask(`${X.who(c)}\n你们有一本交换日记本，轮流写。最近几页：\n\n${last || '（这是第一页）'}\n\n最近的聊天：\n${X.recent(c, 10)}\n\n轮到你写了。像写在纸上的日记：先回应她上一页写的（接她的话、回答她的问题），再写写你这几天的事和想法，可以问她一个问题留给她下一页回答。口语，真诚，80~260 字，分几段。不要标题，不要动作描写的括号。只输出正文。`);
    return r ? r.replace(/^["“]|["”]$/g, '').trim() : null;
}
async function taTurn(cid) {
    const c = X.char(cid); if (!c) return;
    const t = await taWrite(c); if (!t) return;
    const b = book(cid); b.pending = null;
    b.pages.push({ by: 'ta', text: t, at: Date.now(), tape: X.pick(TAPES), stickers: [X.pick(STK)].concat(Math.random() < .5 ? [X.pick(STK)] : []) });
    await S.set('d', D);
    X.notify(c, `📓 ${X.name(c)} 在交换日记本上写了新的一页`, '', 'gyxJournalOpen');
    X.say(c, '📓 交换日记我写好了，轮到你了。');
    if (document.getElementById('gyxJnOv') && CID === cid) { PG = book(cid).pages.length - 1; paint(); }
}
window.gyxJournalTaNow = cid => taTurn(String(cid || CID));
async function tick() { if (!X.on('gyxJournal')) return;
    for (const cid of Object.keys(D.books)) { const b = D.books[cid]; if (b.pending && Date.now() >= b.pending.at) await taTurn(cid); }
}
function pageHtml(p, i, b) {
    const c = X.char(CID);
    const who = p.by === 'me' ? '我' : X.name(c);
    return `<div class="jn-page paper-${b.paper || 'grid'} ${p.by}"><i class="jn-tape" style="background:${p.tape || TAPES[i % TAPES.length]}"></i>
        <div class="jn-meta">${new Date(p.at).toLocaleDateString()} · ${X.esc(who)}</div>
        <div class="jn-text gyx-hand">${X.esc(p.text).replace(/\n/g, '<br>')}</div>
        <div class="jn-stk">${(p.stickers || []).map((s, k) => `<span style="transform:rotate(${(k * 37 % 30) - 15}deg)">${s}</span>`).join('')}</div>
        <div class="jn-no">— ${i + 1} —</div></div>`;
}
function paint() {
    const bd = document.getElementById('gyxJnBody'); if (!bd) return;
    const c = X.char(CID), b = book(CID), n = b.pages.length;
    if (EDIT) {
        bd.innerHTML = `<div class="jn-page paper-${b.paper} me"><i class="jn-tape" style="background:${EDIT.tape}"></i><div class="jn-meta">${new Date().toLocaleDateString()} · 我</div>
            <textarea id="gyxJnTx" class="jn-ta gyx-hand" placeholder="写点什么给 TA……">${X.esc(EDIT.text || '')}</textarea>
            <div class="jn-stk">${EDIT.stickers.map((s, k) => `<span onclick="gyxJournalStk(${k},1)">${s}</span>`).join('')}</div></div>
            <div class="jn-pick">${STK.map(s => `<span onclick="gyxJournalStk('${s}')">${s}</span>`).join('')}</div>
            <div class="gyx-row">胶带：${TAPES.map(t => `<i class="jn-tp${EDIT.tape === t ? ' on' : ''}" style="background:${t}" onclick="gyxJournalTape('${t}')"></i>`).join('')}</div>
            <div class="gyx-row"><button class="gyx-btn" onclick="gyxJournalSave()">写好了，交给 TA</button><button class="gyx-btn lite" onclick="gyxJournalEdit(false)">先不写</button></div>`;
        return;
    }
    if (PG < 0 || PG >= n) PG = n - 1;
    const mine = n === 0 || b.pages[n - 1].by === 'ta';
    bd.innerHTML = `<div class="gyx-row">${X.whoSel(CID, 'gyxJournalWho')}<span class="gyx-tip">纸：</span>${PAPERS.map(([t, k]) => `<span class="gyx-chip ${b.paper === k ? 'on' : ''}" onclick="gyxJournalPaper('${k}')">${t}</span>`).join('')}</div>
        ${n ? pageHtml(b.pages[PG], PG, b) : `<div class="jn-page paper-${b.paper} cover"><div class="jn-cv gyx-hand">我和${X.esc(X.name(c))}的<br>交换日记</div></div>`}
        <div class="gyx-row" style="justify-content:space-between"><button class="gyx-btn lite" ${PG <= 0 ? 'disabled' : ''} onclick="gyxJournalGo(-1)">‹ 上一页</button><span class="gyx-tip">${n ? PG + 1 + ' / ' + n : '还是空的'}</span><button class="gyx-btn lite" ${PG >= n - 1 ? 'disabled' : ''} onclick="gyxJournalGo(1)">下一页 ›</button></div>
        <div class="gyx-row">${mine ? '<button class="gyx-btn" onclick="gyxJournalEdit(true)">✏️ 轮到我写</button>' : (b.pending ? `<span class="gyx-tip">本子在 ${X.esc(X.name(c))} 那儿，TA 大概 ${Math.max(1, Math.round((b.pending.at - Date.now()) / 3600000))} 小时内写好</span><button class="gyx-btn lite" onclick="gyxJournalTaNow()">催一下</button>` : '<button class="gyx-btn lite" onclick="gyxJournalEdit(true)">✏️ 再写一页</button>')}</div>
        <div class="gyx-row gyx-tip">TA 拿到本子后过 <input class="gyx-who" type="number" min="0" step="0.5" value="${D.cfg.minH}" style="width:60px" onchange="gyxJournalCfg('minH',+this.value)"> ~ <input class="gyx-who" type="number" min="0" step="0.5" value="${D.cfg.maxH}" style="width:60px" onchange="gyxJournalCfg('maxH',+this.value)"> 小时写好</div>`;
}
window.gyxJournalOpen = function (who) { CID = String(who || CID || (X.cur() || {}).id || ''); EDIT = null; PG = book(CID).pages.length - 1; X.panel('gyxJnOv', '📓 交换日记本', '<div id="gyxJnBody"></div>'); paint(); };
window.gyxJournalWho = v => { CID = String(v); PG = -1; EDIT = null; paint(); };
window.gyxJournalGo = d => { PG += d; paint(); };
window.gyxJournalPaper = k => { book(CID).paper = k; S.set('d', D); paint(); };
window.gyxJournalCfg = (k, v) => { D.cfg[k] = Math.max(0, v || 0); S.set('d', D); };
window.gyxJournalEdit = on => { EDIT = on ? { text: '', stickers: [], tape: X.pick(TAPES) } : null; paint(); };
window.gyxJournalStk = (s, del) => { const t = document.getElementById('gyxJnTx'); if (t) EDIT.text = t.value; if (del) EDIT.stickers.splice(s, 1); else EDIT.stickers.push(s); paint(); };
window.gyxJournalTape = t => { const x = document.getElementById('gyxJnTx'); if (x) EDIT.text = x.value; EDIT.tape = t; paint(); };
window.gyxJournalSave = async function () {
    const t = ((document.getElementById('gyxJnTx') || {}).value || '').trim(); if (!t) { X.toast('还没写呢'); return; }
    const b = book(CID); b.pages.push({ by: 'me', text: t, at: Date.now(), tape: EDIT.tape, stickers: EDIT.stickers });
    const h = X.rnd(Math.min(D.cfg.minH, D.cfg.maxH), Math.max(D.cfg.minH, D.cfg.maxH)); b.pending = { at: Date.now() + h * 3600000 };
    EDIT = null; PG = b.pages.length - 1; await S.set('d', D); paint();
    X.toast('📓 本子交给 TA 了', `大概 ${Math.max(1, Math.round(h))} 小时内写好`);
};
X.ctx(id => { const b = D.books[String(id)]; if (!b || !b.pages.length) return ''; const p = b.pages[b.pages.length - 1]; return `【交换日记本】你们有一本轮流写的交换日记。最新一页是${p.by === 'me' ? '她' : '你'}写的：「${p.text.slice(0, 200)}」${b.pending ? '（本子现在在你这儿，你还没写）' : ''}`; }, 'gyxJournal');
X.action({ key: 'gyx_journal', label: '在交换日记本上写一页', hint: '本子在你这儿，或者你想先写', need: c => { const b = D.books[String(c.id)]; return !b || !b.pages.length || b.pages[b.pages.length - 1].by === 'me'; }, run: async c => { await taTurn(String(c.id)); return '在交换日记本上写了一页'; } }, 'gyxJournal');
X.css('gyxJnCss', `
#gyxJnOv .gyx-box{background:#f6f1e7}#gyxJnOv .gyx-hd{background:rgba(246,241,231,.92)}
.jn-page{position:relative;min-height:340px;margin:10px 4px;padding:28px 24px 30px;border-radius:6px;background-color:#fffdf7;box-shadow:0 1px 2px rgba(0,0,0,.08),0 12px 28px rgba(120,90,40,.12);color:#3b3530}
.paper-grid{background-image:linear-gradient(#ebe4d6 1px,transparent 1px),linear-gradient(90deg,#ebe4d6 1px,transparent 1px);background-size:22px 22px}
.paper-line{background-image:linear-gradient(transparent 31px,#dcd3c2 32px);background-size:100% 32px}
.paper-dot{background-image:radial-gradient(#d9cfbd 1.2px,transparent 1.4px);background-size:20px 20px}
.paper-kraft{background:#d9c19b linear-gradient(135deg,rgba(255,255,255,.1),rgba(0,0,0,.04));color:#3b2a18}
.jn-page.ta{transform:rotate(.4deg)}.jn-page.me{transform:rotate(-.4deg)}
.jn-tape{position:absolute;top:-10px;left:50%;width:110px;height:24px;margin-left:-55px;transform:rotate(-3deg);opacity:.85;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.jn-meta{font-size:12px;color:#9a8f7f;margin-bottom:8px}.jn-text{font-size:21px;line-height:32px;white-space:normal;word-break:break-all}
.jn-ta{width:100%;min-height:240px;border:none;background:transparent;font-size:21px;line-height:32px;resize:vertical;outline:none;color:#3b3530}
.jn-stk{position:absolute;right:14px;bottom:26px;display:flex;gap:4px;font-size:30px}.jn-stk span{cursor:pointer}
.jn-no{position:absolute;left:0;right:0;bottom:6px;text-align:center;font-size:11px;color:#b3a894}
.jn-cv{display:flex;align-items:center;justify-content:center;min-height:280px;text-align:center;font-size:34px;line-height:1.6;color:#6b5a45}
.jn-pick{display:flex;flex-wrap:wrap;gap:6px;font-size:24px;margin:6px 0}.jn-pick span{cursor:pointer}
.jn-tp{display:inline-block;width:34px;height:14px;border-radius:2px;cursor:pointer;margin:0 3px;opacity:.85}.jn-tp.on{outline:2px solid #3b3530}
`);
X.today(() => ({ title: '📓 交换日记', rows: Object.entries(D.books).filter(([, b]) => b.pages.length).map(([cid, b]) => { const last = b.pages[b.pages.length - 1]; return { t: X.name(X.char(cid)), x: b.pending ? '本子在 TA 那儿，还没写好' : (last.by === 'ta' ? '<b>轮到你写了</b>' : '等 TA 拿走本子'), go: `gyxJournalOpen('${cid}')` }; }) }), 'gyxJournal');
X.mini({ id: 'gyxJournal', icon: '📓', title: '交换日记本', desc: '你们轮流写的本子：手写字、纸张、胶带、贴纸；你写完 TA 过一阵接着写', onOpen: () => window.gyxJournalOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.books = D.books || {}; D.cfg = Object.assign({ minH: 1, maxH: 10 }, D.cfg || {}); setInterval(tick, 60000); setTimeout(tick, 12000); })();
X.widget('gyxJournalW', { n: '交换日记', sizes: ['s', 'm'], tap: () => window.gyxJournalOpen(), r: w => { const E = Object.entries(D.books).filter(([, b]) => b.pages.length); if (!E.length) return X.gw(w, '📓', '交换日记', ['写第一页']); const [cid, b] = E.sort((a, c) => c[1].pages[c[1].pages.length - 1].at - a[1].pages[a[1].pages.length - 1].at)[0], l = b.pages[b.pages.length - 1]; return X.gw(w, '📓', '交换日记', [b.pending ? '本子在 TA 那儿' : (l.by === 'me' ? '等 TA 写' : '轮到你写了'), X.esc(X.name(X.char(cid))) + ' · ' + b.pages.length + ' 页', X.esc(X.plain(l.text || '').slice(0, 30))]); } }, 'gyxJournal');
X.mem({ k: 'gyxJournal', ico: '📓', n: '交换日记', d: '你们轮流写的每一页', items: c => ((D.books[String(c.id)] || {}).pages || []), text: x => x.text, meta: x => (x.by === 'me' ? '你写的' : 'TA 写的') + ' · ' + new Date(x.at).toLocaleString(), edit: (x, v) => { x.text = v; }, del: (c, i) => { const b = D.books[String(c.id)]; if (b) b.pages.splice(i, 1); }, save: () => S.set('d', D) }, 'gyxJournal');
