/* 📖 我们的书：把你们的聊天按月排成一本能翻页的书——每个月是一章，TA 给每章起名、写一段开头，正文挑那个月最值得留下的对话。TA 还会写一篇序。能导出成网页文件、能打印成 PDF */
if (window.__gyxOurBook) return; window.__gyxOurBook = 1;
X.feat('gyxOurBook', { n: '📖 我们的书', desc: '聊天按月排成一本能翻页的书，TA 写序和章节名，能导出' });
const S = X.store('ourbook');
let D = { books: {}, cfg: { per: 24 } };   // books[cid] = {title, pre, ch:{'2026-10':{name, intro, at}}, at}
const ym = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const H = cid => ((typeof globalChats !== 'undefined' && globalChats[cid]) || []).filter(m => m && m.sender !== 'system' && !m.side && m.timestamp && X.plain(m.text));
const bookOf = cid => (D.books[String(cid)] = D.books[String(cid)] || { title: '', pre: '', ch: {} });
// 一章挑哪些话：长的、带情绪的、带「想你/喜欢/对不起/第一次」的优先，按时间排回去
function pickMsgs(L, n) {
    const sc = m => { const t = X.plain(m.text); return Math.min(t.length, 60) / 10 + (/想你|喜欢|爱|对不起|谢谢|第一次|一起|晚安|抱|难过|开心|生气|别走|等你/.test(t) ? 4 : 0) + (/[？?！!]/.test(t) ? 1 : 0); };
    return L.map((m, i) => ({ m, i, s: sc(m) + Math.random() })).sort((a, b) => b.s - a.s).slice(0, n).sort((a, b) => a.i - b.i).map(x => x.m);
}
function months(cid) { const M = {}; H(cid).forEach(m => (M[ym(m.timestamp)] = M[ym(m.timestamp)] || []).push(m)); return M; }
async function writeCh(c, mo, L) {
    const B = bookOf(c.id); if (B.ch[mo] && B.ch[mo].name) return B.ch[mo];
    const sum = String(c.chatSummary || '').split('\n').filter(l => { const m = l.match(/^\[([^\]]+)\]/); return m && ym(new Date(m[1].replace(/\s*[上下]午/, ' ')).getTime() || 0) === mo; }).map(l => l.replace(/^\[[^\]]+\]\s*/, '')).join('\n');
    let j = X.bailu() ? null : X.json(await X.ask(`${X.who(c)}\n你们在把聊天记录排成一本书，${mo} 是其中一章。\n这个月的总结：\n${sum || '（没有）'}\n这个月的几句话：\n${pickMsgs(L, 14).map(m => (m.sender === 'me' ? '她：' : '你：') + X.plain(m.text).slice(0, 80)).join('\n')}\n\n给这一章起个名字（2~8 字，像小说章节名），再写一段章节开头（你的口吻，像在回忆，60~120 字）。\n只输出 JSON：{"name":"","intro":""}`));
    if (!j || !j.name) j = { name: X.pick(['初见', '慢慢熟起来', '晚安以后', '下雨的那几天', '想你的时候', '吵吵闹闹', '小日子', '在一起的第 N 天', '风很温柔', '那些夜里']), intro: (sum.split('\n')[0] || X.cards(['回忆', '日记'], c, 1)[0] || '这个月，我们说了很多话。') };
    B.ch[mo] = { name: X.plain(j.name).slice(0, 14), intro: X.plain(j.intro), at: Date.now() }; return B.ch[mo];
}
async function make(c) {
    const cid = String(c.id), M = months(cid), ks = Object.keys(M).sort(); if (!ks.length) return null; const B = bookOf(cid);
    for (const k of ks) await writeCh(c, k, M[k]);
    if (!B.pre) { B.pre = X.plain((!X.bailu() && await X.ask(`${X.who(c)}\n你们的聊天被排成了一本书，从 ${ks[0]} 到 ${ks[ks.length - 1]}，一共 ${ks.length} 章：${ks.map(k => B.ch[k].name).join('、')}。\n给这本书写一篇序（你的口吻，写给她，120~220 字），再起个书名。格式：第一行书名，后面是序。`)) || ''); if (B.pre) { const ls = B.pre.split(/\n+/); B.title = ls[0].replace(/[《》#\s]/g, '').slice(0, 16); B.pre = ls.slice(1).join('\n') || B.pre; } }
    if (!B.title) B.title = `${X.name(c)}和${X.me(c)}`; if (!B.pre) B.pre = `从 ${ks[0]} 开始，我们说过的话都在这里了。` + (X.cards(['情话', '回忆'], c, 1)[0] || '');
    B.at = Date.now(); await S.set('d', D); return B;
}
// 排成一页一页
function pages(c) {
    const cid = String(c.id), B = bookOf(cid), M = months(cid), ks = Object.keys(M).sort(), P = [], per = Math.max(6, +D.cfg.per || 24), me = X.me(c), ta = X.name(c);
    P.push(`<div class="ob-cover"><b>${X.esc(B.title || ta + '和' + me)}</b><span>${X.esc(ta)} · ${X.esc(me)}</span><em>${ks[0] || ''} — ${ks[ks.length - 1] || ''}</em></div>`);
    P.push(`<div class="ob-pg"><h3>序</h3><div class="ob-tx">${X.esc(B.pre || '').replace(/\n/g, '<br>')}</div><div class="ob-sig">—— ${X.esc(ta)}</div></div>`);
    P.push(`<div class="ob-pg"><h3>目录</h3>${ks.map((k, i) => `<div class="ob-toc"><span>第${i + 1}章 ${X.esc((B.ch[k] || {}).name || k)}</span><em>${k}</em></div>`).join('')}</div>`);
    ks.forEach((k, i) => {
        const ch = B.ch[k] || {}, L = pickMsgs(M[k], per);
        P.push(`<div class="ob-pg ob-chs"><em>第${i + 1}章 · ${k}</em><h2>${X.esc(ch.name || k)}</h2><div class="ob-tx">${X.esc(ch.intro || '').replace(/\n/g, '<br>')}</div></div>`);
        for (let j = 0; j < L.length; j += 8) P.push(`<div class="ob-pg"><div class="ob-hd">${X.esc(ch.name || k)}</div>${L.slice(j, j + 8).map(m => `<p class="${m.sender === 'me' ? 'me' : 'ta'}"><b>${X.esc(m.sender === 'me' ? me : ta)}</b>${X.esc(X.plain(m.text).slice(0, 160))}<i>${new Date(m.timestamp).toLocaleDateString()}</i></p>`).join('')}</div>`);
    });
    P.push(`<div class="ob-cover end"><b>未完待续</b><span>${X.v('下一章，还是我们。', '剩下的，我们慢慢写。', '书没写完，因为我们还没说完。')}</span></div>`);
    return P;
}
let PG = 0, CID = null;
function show() { const c = X.char(CID), P = pages(c), b = document.getElementById('gyxObPage'); if (!b) return; PG = Math.max(0, Math.min(P.length - 1, PG)); b.innerHTML = P[PG]; b.classList.remove('flip'); void b.offsetWidth; b.classList.add('flip'); const n = document.getElementById('gyxObNo'); if (n) n.textContent = (PG + 1) + ' / ' + P.length; }
window.gyxOurBookGo = d => { PG += d; show(); };
window.gyxOurBookMake = async cid => { const c = X.char(cid) || X.cur(); if (!c) return null; const B = await make(c); if (!B) { X.toast('📖 还排不成书', '先多聊几天吧'); return null; } PG = 0; window.gyxOurBookOpen(c.id); return B; };
window.gyxOurBookRedo = async cid => { D.books[String(cid)] = { title: '', pre: '', ch: {} }; await S.set('d', D); return window.gyxOurBookMake(cid); };
window.gyxOurBookHtml = cid => { const c = X.char(cid) || X.cur(); const B = bookOf(c.id); return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${X.esc(B.title || '我们的书')}</title><style>${CSS}body{background:#efe9df;margin:0;padding:20px;font-family:"Songti SC","STSong","SimSun",serif}.ob-page{max-width:560px;margin:0 auto 24px;box-shadow:0 4px 18px rgba(0,0,0,.1)}@media print{body{background:#fff;padding:0}.ob-page{box-shadow:none;page-break-after:always;margin:0 auto}}</style></head><body>${pages(c).map(p => `<div class="ob-page">${p}</div>`).join('')}</body></html>`; };
window.gyxOurBookExport = cid => { const c = X.char(cid) || X.cur(); const h = window.gyxOurBookHtml(c.id), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([h], { type: 'text/html' })); a.download = (bookOf(c.id).title || '我们的书') + '.html'; document.body.appendChild(a); a.click(); a.remove(); };
window.gyxOurBookPrint = cid => { const w = window.open('', '_blank'); if (!w) { X.toast('📖 弹窗被拦了', '先用「导出网页」，再用浏览器打开打印'); return; } w.document.write(window.gyxOurBookHtml(cid)); w.document.close(); setTimeout(() => { try { w.print(); } catch (e) {} }, 600); };
window.gyxOurBookCh = async (cid, mo, k, v) => { const B = bookOf(cid); if (mo === '__title') B.title = v; else if (mo === '__pre') B.pre = v; else { B.ch[mo] = B.ch[mo] || {}; B.ch[mo][k] = v; } await S.set('d', D); };
window.gyxOurBookCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxOurBookData = () => D;
window.gyxOurBookOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), B = bookOf(cid), has = Object.keys(B.ch).length; CID = cid;
    X.panel('gyxObOv', '📖 我们的书', `<div class="gyx-row">${X.whoSel(cid, 'gyxOurBookOpen')}${has ? `<span class="gyx-chip" onclick="gyxOurBookExport('${cid}')">导出网页</span><span class="gyx-chip" onclick="gyxOurBookPrint('${cid}')">打印 / 存 PDF</span><span class="gyx-chip" onclick="this.textContent='重写中…';gyxOurBookRedo('${cid}')">让 TA 重写</span>` : ''}</div>
        ${has ? `<div class="ob-book"><div id="gyxObPage" class="ob-page"></div><div class="gyx-row" style="justify-content:center"><button class="gyx-btn lite" onclick="gyxOurBookGo(-1)">‹ 上一页</button><span id="gyxObNo" class="gyx-tip"></span><button class="gyx-btn lite" onclick="gyxOurBookGo(1)">下一页 ›</button></div></div>
        <details class="gyx-tip"><summary>改书名 / 序 / 章节名</summary><input class="gyx-in" value="${X.esc(B.title)}" onchange="gyxOurBookCh('${cid}','__title','',this.value)"><textarea class="gyx-in" rows="4" onchange="gyxOurBookCh('${cid}','__pre','',this.value)">${X.esc(B.pre)}</textarea>${Object.keys(B.ch).sort().map(k => `<div class="gyx-row"><em style="font-style:normal">${k}</em><input class="gyx-who" style="flex:1" value="${X.esc(B.ch[k].name || '')}" onchange="gyxOurBookCh('${cid}','${k}','name',this.value)"></div>`).join('')}<div class="gyx-row">每章最多 <input class="gyx-who" type="number" min="6" value="${D.cfg.per}" style="width:60px" onchange="gyxOurBookCfg('per',+this.value)"> 句</div></details>`
        : `<div class="gyx-tip">${X.v('把你们说过的话，排成一本书。', '每个月一章，TA 来写章节名和序。', '一本只有你们俩的书。')}</div><button class="gyx-btn" onclick="this.disabled=true;this.textContent='TA 在排版…';gyxOurBookMake('${cid}')">开始做书</button>`}`);
    if (has) show();
};
async function tick() { if (!X.on('gyxOurBook')) return; for (const c of X.chars()) { const B = D.books[String(c.id)]; if (!B || !Object.keys(B.ch).length) continue; const M = months(String(c.id)), last = Object.keys(M).sort().slice(-2, -1)[0]; if (last && !B.ch[last]) { await writeCh(c, last, M[last]); await S.set('d', D); if (X.on('gyxOurBook.auto')) X.notify(c, `📖 ${X.esc(X.name(c))} ${X.v('写完了新的一章', '给你们的书添了一章')}：${X.esc(B.ch[last].name)}`, '我们的书', () => window.gyxOurBookOpen(c.id)); } } }
X.ctx(id => { const B = D.books[String(id)]; if (!B || !B.title) return ''; const ks = Object.keys(B.ch).sort(); return `【你们的书《${B.title}》】已经 ${ks.length} 章，最近一章叫「${(B.ch[ks[ks.length - 1]] || {}).name || ''}」。`; }, 'gyxOurBook');
X.action({ key: 'gyx_ourbook', label: '给你们的书写新的一章', hint: '我们的书', need: c => { const M = months(String(c.id)), ks = Object.keys(M).sort(); const B = D.books[String(c.id)]; return ks.length >= 1 && (!B || ks.some(k => !B.ch[k])); },
    run: async c => { const B = await make(c); if (!B) return null; const ks = Object.keys(B.ch).sort(); return (await X.reach(c, `你把你们的聊天排成了一本书《${B.title}》，刚写完「${B.ch[ks[ks.length - 1]].name}」这一章。告诉她，叫她去「📖 我们的书」翻翻`)) ? '给我们的书写了一章' : null; } }, 'gyxOurBook');
X.today(() => { const rows = []; X.chars().forEach(c => { const B = D.books[String(c.id)]; if (!B) return; Object.keys(B.ch).filter(k => B.ch[k].at && X.day(new Date(B.ch[k].at)) === X.day()).forEach(k => rows.push({ t: '新章节', x: '《' + X.esc(B.title || '') + '》' + X.esc(B.ch[k].name), go: `gyxOurBookOpen('${c.id}')` })); }); return { title: '📖 我们的书', rows }; }, 'gyxOurBook');
X.widget('gyxOurBookW', { n: '我们的书', sizes: ['s', 'm'], tap: () => window.gyxOurBookOpen(), r: w => { const c = X.cur(), B = c && D.books[String(c.id)]; const ks = B ? Object.keys(B.ch).sort() : []; return X.gw(w, '📖', '我们的书', B && B.title ? ['《' + X.esc(B.title) + '》', ks.length + ' 章 · ' + X.esc((B.ch[ks[ks.length - 1]] || {}).name || '')] : ['做一本？']); } }, 'gyxOurBook');
X.mem({ k: 'gyxOurBook', ico: '📖', n: '我们的书', d: '书名、序、每章的名字和开头', items: c => { const B = D.books[String(c.id)]; if (!B) return []; const cid = String(c.id); return [{ cid, k: '__title', t: B.title }, { cid, k: '__pre', t: B.pre }].concat(Object.keys(B.ch).sort().map(k => ({ cid, k, t: B.ch[k].name + '：' + (B.ch[k].intro || '') }))); }, text: x => x.t || '', edit: (x, v) => { const B = D.books[x.cid]; if (!B) return; x.t = v; if (x.k === '__title') B.title = v; else if (x.k === '__pre') B.pre = v; else { const i = v.indexOf('：'); B.ch[x.k] = Object.assign(B.ch[x.k] || {}, i > 0 ? { name: v.slice(0, i), intro: v.slice(i + 1) } : { intro: v }); } }, del: (c, i) => { const B = D.books[String(c.id)]; if (!B) return; if (i === 0) B.title = ''; else if (i === 1) B.pre = ''; else delete B.ch[Object.keys(B.ch).sort()[i - 2]]; }, meta: x => x.k === '__title' ? '书名' : x.k === '__pre' ? '序' : x.k, save: () => S.set('d', D) }, 'gyxOurBook');
const CSS = `.ob-page{background:#fffdf7;border-radius:6px 14px 14px 6px;min-height:420px;padding:26px 24px;box-sizing:border-box;font-family:"Songti SC","STSong","SimSun",serif;color:#3b3127;box-shadow:inset 8px 0 14px -10px rgba(0,0,0,.25);line-height:1.9}.ob-page.flip{animation:bkf .45s ease}@keyframes bkf{from{transform:perspective(900px) rotateY(-14deg);opacity:.4}}.ob-cover{min-height:370px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center}.ob-cover b{font-size:28px;letter-spacing:4px}.ob-cover span{color:#8a7a66}.ob-cover em{font-style:normal;font-size:12px;color:#b0a28e}.ob-pg h3{text-align:center;letter-spacing:6px}.ob-chs{text-align:center;padding-top:60px}.ob-chs em{font-style:normal;font-size:12px;color:#b0a28e}.ob-chs h2{margin:8px 0 18px;letter-spacing:3px}.ob-chs .ob-tx{text-align:left;text-indent:2em}.ob-sig{text-align:right;color:#8a7a66;margin-top:12px}.ob-toc{display:flex;justify-content:space-between;border-bottom:1px dotted #d9cbb5;padding:4px 0}.ob-toc em{font-style:normal;color:#b0a28e;font-size:12px}.ob-hd{font-size:11px;color:#b0a28e;text-align:center;margin-bottom:8px}.ob-pg p{margin:6px 0;font-size:14.5px}.ob-pg p b{font-weight:600;margin-right:6px;color:#7a5c3e}.ob-pg p.me b{color:#b5586c}.ob-pg p i{display:block;font-style:normal;font-size:10.5px;color:#c4b8a6}`;
X.css('gyxOurBookCss', CSS + `.ob-book{background:#e8dfd0;padding:12px;border-radius:16px}`);
X.mini({ id: 'gyxOurBook', icon: '📖', title: '我们的书', desc: '聊天按月排成一本书，TA 写序', cat: '回忆', onOpen: () => window.gyxOurBookOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.books = D.books || {}; D.cfg = Object.assign({ per: 24 }, D.cfg || {}); setTimeout(tick, 60000); setInterval(tick, 3600000); })();
