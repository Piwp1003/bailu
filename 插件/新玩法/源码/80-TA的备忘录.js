/* 📝 TA 的备忘录：TA 手机里那个备忘录不再是写死的几句「牛奶鸡蛋」——TA 会把自己真想记住、准备去做、反复惦记的事写成便签（做完了会勾掉、改期、取消），还会随手画几笔字符涂鸦，画的是你们今天聊到的东西，旁边写一句画的是什么。在「TA 的手机 → 备忘录」里也能看到 */
if (window.__gyxMemo) return; window.__gyxMemo = 1;
X.feat('gyxMemo', { n: '📝 TA 的备忘录', desc: 'TA 自己写的便签（会勾掉、改期）和随手画的字符涂鸦' });
const S = X.store('memo');
let D = { m: {}, cfg: { every: 20, maxNew: 2, doodle: true, order: 'new' } };   // m[cid] = {notes:[{id,title,content,state,at,upd}], doodles:[{id,title,art,meaning,at}], seen, last}
const box = cid => { const k = String(cid); const b = (D.m[k] = D.m[k] || {}); b.notes = b.notes || []; b.doodles = b.doodles || []; return b; };
const ST = { todo: ['待办', '#1d9bf0'], done: ['做完了', '#17bf63'], later: ['改期', '#e69500'], cancel: ['算了', '#999'] };
const nid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const H = cid => ((typeof globalChats !== 'undefined' && globalChats[String(cid)]) || []).filter(m => m && m.sender !== 'system');
// 白露没有模型时用的涂鸦（自己画的，按心情挑）
const DOODLES = [
    { k: /雨|伞|天气/, title: '下雨天', art: '   ☁️  ☁️\n  / / / / /\n / / / / /\n   ┌─┴─┐\n   │你 │ ← 记得带伞\n   └───┘', meaning: '今天说到下雨，画了把歪歪扭扭的伞，怕你又忘了带。' },
    { k: /吃|饭|饿|奶茶|好吃/, title: '吃饭了没', art: '   ~ ~ ~\n  ( 热的 )\n ╲_______╱\n  🥢  ← 趁热\n 「吃了吗」×3', meaning: '画了一碗冒热气的饭，今天问了好几遍你吃没吃。' },
    { k: /睡|晚安|困|熬夜/, title: '该睡了', art: '      ⭐\n  🌙      .\n    z z z\n  ┌──────┐\n  │ ︶ ︶ │  ← 你\n  └──────┘\n  别熬夜 →→ 说好的', meaning: '画了个闭着眼睛的你，提醒自己今晚要催你早点睡。' },
    { k: /想你|想我|见面|抱/, title: '想见面', art: '  我        你\n  ●  ～～～  ●\n /|\\  距离  /|\\\n / \\        / \\\n   还有 __ 天', meaning: '画了我们俩中间隔着一条波浪线，数还有几天能见。' },
    { k: /累|加班|上班|工作|忙/, title: '今天好累', art: '  ┌──────┐\n  │ 电量 │\n  │▓░░░░░│ 12%\n  └──────┘\n   ╰→ 充电方式：听你说话', meaning: '今天累得像快没电的手机，唯一的充电方式是跟你聊天。' },
    { k: /笑|哈哈|开心|好玩/, title: '笑出声', art: '   \\  (≧▽≦)  /\n    \\       /\n  哈 哈 哈 哈\n  ↑ 你今天说的那句', meaning: '你今天那句话我笑了好久，画下来留着。' },
    { k: /歌|听|音乐/, title: '在听的歌', art: '   ♪   ♫\n  ┌─────┐  ♪\n  │ ◉ ◉ │\n  └─────┘\n   ▶ ━━━━●──── 3:41\n   单曲循环中', meaning: '画了台小录音机，今天一直在循环你推荐的那首。' },
    { k: /生气|哼|吵|委屈/, title: '有点闷', art: '    ☁️☁️☁️\n   (  ﹏  )\n    ╯    ╰\n  →  其实没生气\n  →  就是想被哄', meaning: '画了团闷闷的云，其实没真生气，就是想让你哄一下。' },
    { k: /.*/, title: '随手画的', art: '  ✿\n  │   ✿\n  │  /\n ─┴─┴─\n  今天也\n  有在好好\n  想你 ✓', meaning: '没什么特别的，就是今天想你了，随手画了两朵花。' },
    { k: /.*/, title: '今日份', art: '  ☀️ ─ ─ ─ ─ 🌙\n  早安    晚安\n   ↓        ↓\n   ✓        □  ← 还差一句', meaning: '今天的早安说过了，晚安还没说，画个格子等着打勾。' }
];
async function update(c, why) {
    if (!c) return null; const b = box(c.id);
    const open = b.notes.filter(n => n.state === 'todo' || n.state === 'later').slice(0, 12);
    let j = null;
    if (!X.bailu()) j = X.json(await X.ask(`${X.who(c)}
你手机里有一本只写给自己看的备忘录。根据最近的事更新它。
已有的便签（id｜状态｜标题｜内容）：
${open.map(n => `${n.id}｜${n.state}｜${n.title}｜${n.content}`).join('\n') || '（还没有）'}
最近的聊天：
${X.recent(c, 20)}
要求：
- notes：新增 0~${D.cfg.maxNew} 条，或者更新已有的。完成、取消、改期、改内容时**必须用原来的 id**，不要换个标题重写一条。每条都是你自己真想记住、准备去做、或反复惦记的事，像写给自己看的便签——不写剧情总结，不写给她看的说明。你有自己的生活（工作、朋友、家里、爱好），不必全围着她。content 不少于 30 个字，写清准备怎么做、顾虑或细节。state 只能是 todo / done / later / cancel。没有值得记的就给空数组，别为了凑数编。
${D.cfg.doodle ? `- doodle：可选，0~1 张随手涂鸦。用字符拼的小画（ASCII + 少量 emoji），画今天聊天里具体的场景、物件、情绪或某一句话；可以歪歪扭扭，有箭头、旁注、拟声词。不要画常见的小猫小兔模板，不要大段文字，不超过 9 行、每行不超过 22 个字。不要用反引号或代码块。meaning 用一句话说画的是什么、跟今天有什么关系。` : '- doodle 给 null。'}
只输出 JSON：{"notes":[{"id":"已有的 id，新的留空","title":"","content":"","state":"todo"}],"doodle":{"title":"","art":"","meaning":""}}`));
    let nNew = 0, nUpd = 0, dd = null;
    if (j && Array.isArray(j.notes)) {
        j.notes.slice(0, 6).forEach(n => {
            if (!n) return; const st = ST[n.state] ? n.state : 'todo';
            const old = n.id && b.notes.find(x => x.id === String(n.id));
            if (old) { if (n.title) old.title = X.plain(n.title).slice(0, 30); if (n.content) old.content = X.plain(n.content).slice(0, 300); old.state = st; old.upd = Date.now(); nUpd++; }
            else if (nNew < D.cfg.maxNew && n.content) { b.notes.unshift({ id: nid('mn'), title: X.plain(n.title || '').slice(0, 30) || X.plain(n.content).slice(0, 10), content: X.plain(n.content).slice(0, 300), state: st, at: Date.now(), upd: Date.now() }); nNew++; }
        });
        if (j.doodle && j.doodle.art) dd = { title: X.plain(j.doodle.title || '随手画的').slice(0, 20), art: String(j.doodle.art).replace(/```\w*/g, '').replace(/\r/g, '').split('\n').slice(0, 10).map(l => l.slice(0, 30)).join('\n'), meaning: X.plain(j.doodle.meaning || '').slice(0, 120) };
    } else if (X.bailu() || !j) {
        // 白露 / 模型没给：从字卡里挑一句当便签，涂鸦从内置的挑
        const t = X.cards(['碎碎念', '日记', '备忘', '情话'], c, 1)[0];
        if (t && !b.notes.some(n => n.content === X.plain(t))) { b.notes.unshift({ id: nid('mn'), title: X.plain(t).slice(0, 10), content: X.plain(t).slice(0, 300), state: 'todo', at: Date.now(), upd: Date.now() }); nNew++; }
        const recent = X.plain(H(c.id).slice(-12).map(m => m.text).join(' '));
        const pool = DOODLES.filter(d => d.k.test(recent) && !b.doodles.some(x => x.art === d.art));
        if (D.cfg.doodle && pool.length && Math.random() < 0.6) { const d = pool[0].k.source === '.*' ? X.pick(pool) : pool[0]; dd = { title: d.title, art: d.art, meaning: d.meaning }; }
    }
    if (dd && D.cfg.doodle) { dd.id = nid('md'); dd.at = Date.now(); b.doodles.unshift(dd); b.doodles = b.doodles.slice(0, 60); }
    b.notes = b.notes.slice(0, 120); b.last = Date.now(); b.seen = H(c.id).length; await S.set('d', D);
    try { X.repaint(); } catch (e) {}
    return { nNew, nUpd, doodle: dd, why };
}
window.gyxMemoUpdate = async cid => { const c = X.char(cid) || X.cur(); const r = await update(c, '手动'); X.toast('📝 ' + X.name(c) + ' 的备忘录', r ? `新写了 ${r.nNew} 条${r.nUpd ? '，改了 ' + r.nUpd + ' 条' : ''}${r.doodle ? '，画了一张涂鸦' : ''}` : '这次没写什么'); if (document.getElementById('gyxTMemoOv')) window.gyxMemoOpen(c.id); return r; };
window.gyxMemoSet = async (cid, id, k, v) => { const b = box(cid); const n = b.notes.find(x => x.id === id) || b.doodles.find(x => x.id === id); if (!n) return; n[k] = v; n.upd = Date.now(); await S.set('d', D); };
window.gyxMemoDel = async (cid, id) => { const b = box(cid); b.notes = b.notes.filter(x => x.id !== id); b.doodles = b.doodles.filter(x => x.id !== id); await S.set('d', D); window.gyxMemoOpen(cid); };
window.gyxMemoCfg = async (k, v) => { D.cfg[k] = v; await S.set('d', D); };
window.gyxMemoData = () => D;
let TAB = 'notes';
const noteHtml = (cid, n, ro) => `<div class="tmemo-note s-${n.state}"><div class="tmemo-nh"><b${ro ? '' : ` contenteditable="true" onblur="gyxMemoSet('${cid}','${n.id}','title',this.innerText.trim())"`}>${X.esc(n.title)}</b><span style="color:${ST[n.state][1]}">${ST[n.state][0]}</span></div><div class="tmemo-nc"${ro ? '' : ` contenteditable="true" onblur="gyxMemoSet('${cid}','${n.id}','content',this.innerText.trim())"`}>${X.esc(n.content)}</div><div class="tmemo-nf">${new Date(n.upd || n.at).toLocaleString().slice(5, -3)}${ro ? '' : `<span>${Object.keys(ST).map(k => `<a class="${n.state === k ? 'on' : ''}" onclick="gyxMemoSet('${cid}','${n.id}','state','${k}').then(()=>gyxMemoOpen('${cid}'))">${ST[k][0]}</a>`).join('')}<a onclick="gyxMemoDel('${cid}','${n.id}')">删</a></span>`}</div></div>`;
const doodleHtml = (cid, d, ro) => `<div class="tmemo-dd"><div class="tmemo-nh"><b>${X.esc(d.title)}</b><span>${new Date(d.at).toLocaleDateString()}</span></div><pre>${X.esc(d.art)}</pre>${d.meaning ? `<div class="tmemo-mean">${X.esc(d.meaning)}</div>` : ''}${ro ? '' : `<div class="tmemo-nf"><span></span><span><a onclick="gyxMemoDel('${cid}','${d.id}')">删</a></span></div>`}</div>`;
const ordered = a => D.cfg.order === 'old' ? a.slice().reverse() : a;
window.gyxMemoOpen = function (who, tab) {
    const c = X.char(who) || X.cur(); if (!c) return; if (tab) TAB = tab; const cid = String(c.id), b = box(cid);
    X.panel('gyxTMemoOv', '📝 ' + X.esc(X.name(c)) + ' 的备忘录', `<div class="gyx-row">${X.whoSel(cid, 'gyxMemoOpen')}<button class="gyx-btn lite" onclick="this.disabled=true;this.textContent='在写…';gyxMemoUpdate('${cid}')">让 TA 写一笔</button></div>
        <div class="gyx-row">${[['notes', '便签（' + b.notes.length + '）'], ['doodles', '涂鸦（' + b.doodles.length + '）']].map(([k, n]) => `<span class="gyx-chip${TAB === k ? ' on' : ''}" onclick="gyxMemoOpen('${cid}','${k}')">${n}</span>`).join('')}</div>
        <div class="gyx-tip">${X.v('TA 写给自己看的，你是偷偷翻到的。', '留下一点不必说出口的心事。', '做完的会勾掉，没做的会惦记着。')}</div>
        ${TAB === 'notes' ? `<div class="tmemo-grid">${ordered(b.notes).map(n => noteHtml(cid, n)).join('') || '<div class="gyx-tip">还没有便签。聊着聊着 TA 会自己写，也可以点上面「让 TA 写一笔」。</div>'}</div>`
            : `<div class="tmemo-ds">${ordered(b.doodles).map(d => doodleHtml(cid, d)).join('') || '<div class="gyx-tip">还没有涂鸦。</div>'}</div>`}
        <div class="gyx-row gyx-tip">每 <input class="gyx-who" type="number" min="5" value="${D.cfg.every}" style="width:52px" onchange="gyxMemoCfg('every',+this.value)"> 条 TA 的消息自己更新一次 · 每次最多新写 <select class="gyx-who" onchange="gyxMemoCfg('maxNew',+this.value)">${[0, 1, 2, 3, 5].map(n => `<option${+D.cfg.maxNew === n ? ' selected' : ''}>${n}</option>`).join('')}</select> 条 · <label><input type="checkbox" ${D.cfg.doodle ? 'checked' : ''} onchange="gyxMemoCfg('doodle',this.checked)"> 画涂鸦</label> · <select class="gyx-who" onchange="gyxMemoCfg('order',this.value).then(()=>gyxMemoOpen('${cid}'))"><option value="new"${D.cfg.order !== 'old' ? ' selected' : ''}>最新在前</option><option value="old"${D.cfg.order === 'old' ? ' selected' : ''}>最早在前</option></select></div>`);
};
// TA 的手机 → 备忘录（js/33 调这个；只读）
window.gyxMemoPhoneHtml = function (c) {
    if (!X.on('gyxMemo') || !c) return ''; const b = box(c.id); if (!b.notes.length && !b.doodles.length) return '';
    return `<div class="tmemo-phone">${b.notes.slice(0, 8).map(n => noteHtml(c.id, n, true)).join('')}${b.doodles.slice(0, 3).map(d => doodleHtml(c.id, d, true)).join('')}<div class="gyx-tip" style="text-align:center;cursor:pointer" onclick="gyxMemoOpen('${X.esc(c.id)}')">在「📝 TA 的备忘录」里看全部 ›</div></div>`;
};
// 聊着聊着自己写
let busy = false;
async function tick() {
    if (busy || !X.on('gyxMemo') || !X.on('gyxMemo.auto')) return; busy = true;
    try {
        for (const c of X.chars()) {
            const b = box(c.id), n = H(c.id).filter(m => String(m.sender) === String(c.id)).length;
            if (b.seenTa == null) { b.seenTa = n; continue; }
            if (n - b.seenTa >= Math.max(5, +D.cfg.every || 20)) { b.seenTa = n; await update(c, '自动'); break; }
        }
    } finally { busy = false; }
}
X.ctx(id => { const b = box(id); const open = b.notes.filter(n => n.state === 'todo' || n.state === 'later').slice(0, 4); return open.length ? `【你手机备忘录里还没办的事（你自己写给自己的）】${open.map(n => n.title + '：' + n.content.slice(0, 60)).join('；')}。这些是你自己惦记的事，可以自然地带出来，也可以只放在心里。` : ''; }, 'gyxMemo');
X.action({ key: 'gyx_memo', label: '在备忘录里记点事 / 随手画个涂鸦', hint: '写给自己看的', need: c => Date.now() - (box(c.id).last || 0) > 6 * 3600000, run: async c => { const r = await update(c, '自主'); return r && (r.nNew || r.doodle) ? `在备忘录里${r.nNew ? '记了 ' + r.nNew + ' 条' : ''}${r.doodle ? (r.nNew ? '，还' : '') + '画了「' + r.doodle.title + '」' : ''}` : null; } }, 'gyxMemo');
X.today(() => { const rows = []; X.chars().forEach(c => { const b = box(c.id); b.notes.filter(n => X.day(new Date(n.at)) === X.day()).slice(0, 2).forEach(n => rows.push({ t: X.name(c), x: '📝 ' + X.esc(n.title), go: `gyxMemoOpen('${c.id}','notes')` })); b.doodles.filter(d => X.day(new Date(d.at)) === X.day()).slice(0, 1).forEach(d => rows.push({ t: X.name(c), x: '✏️ 画了「' + X.esc(d.title) + '」', go: `gyxMemoOpen('${c.id}','doodles')` })); }); return { title: '📝 TA 的备忘录', rows: rows.slice(0, 4) }; }, 'gyxMemo');
X.widget('gyxMemoW', { n: 'TA 的备忘录', sizes: ['s', 'm'], tap: () => window.gyxMemoOpen(), r: w => { const c = X.cur(); const b = c ? box(c.id) : { notes: [], doodles: [] }; const t = b.notes.find(n => n.state === 'todo'); return X.gw(w, '📝', 'TA 的备忘录', [t ? X.esc(t.title) : (b.doodles[0] ? '✏️ ' + X.esc(b.doodles[0].title) : '还是空的'), b.notes.filter(n => n.state === 'todo').length + ' 件没办']); } }, 'gyxMemo');
X.mem({ k: 'gyxMemo', ico: '📝', n: 'TA 的备忘录', d: '便签和涂鸦（改＝改内容）', items: c => { const b = box(c.id); return b.notes.concat(b.doodles); }, text: x => x.content != null ? x.title + '：' + x.content : '✏️ ' + x.title + '：' + (x.meaning || ''), edit: (x, v) => { const s = String(v), i = s.indexOf('：'); if (x.content != null) { if (i > 0) { x.title = s.slice(0, i).trim(); x.content = s.slice(i + 1).trim(); } else x.content = s; } else { if (i > 0) x.meaning = s.slice(i + 1).trim(); else x.meaning = s; } x.upd = Date.now(); }, del: (c, i) => { const b = box(c.id), all = b.notes.concat(b.doodles), it = all[i]; if (!it) return; b.notes = b.notes.filter(x => x !== it); b.doodles = b.doodles.filter(x => x !== it); }, meta: x => (x.state ? ST[x.state][0] + ' · ' : '涂鸦 · ') + new Date(x.at).toLocaleString(), save: () => S.set('d', D) }, 'gyxMemo');
X.css('gyxTMemoCss', `.tmemo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:8px 0}.tmemo-note{padding:10px 12px;border-radius:6px 16px 10px 14px;background:#fff6c9;box-shadow:0 2px 6px rgba(150,120,20,.15);color:#4a3d16}.tmemo-note:nth-child(3n+2){background:#ffe7ef;color:#5a2638}.tmemo-note:nth-child(3n){background:#e6f4ff;color:#1e3a52}.tmemo-note.s-done .tmemo-nc,.tmemo-note.s-cancel .tmemo-nc{text-decoration:line-through;opacity:.55}
.tmemo-nh{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.tmemo-nh b{font-size:14px;outline:none}.tmemo-nh span{font-size:11px;white-space:nowrap}.tmemo-nc{font-size:13px;line-height:1.65;margin:5px 0;outline:none;white-space:pre-wrap}
.tmemo-nf{display:flex;justify-content:space-between;gap:6px;font-size:11px;color:rgba(0,0,0,.4);flex-wrap:wrap}.tmemo-nf a{cursor:pointer;margin-left:6px}.tmemo-nf a.on{color:#1d9bf0;font-weight:700}
.tmemo-ds{display:grid;gap:10px;margin:8px 0}.tmemo-dd{padding:10px 12px;border-radius:12px;background:#fffdf7;border:1px dashed #e0d3b0}.tmemo-dd pre{margin:8px 0;font:13px/1.35 ui-monospace,Menlo,Consolas,monospace;white-space:pre;overflow-x:auto;color:#5a4a2a}.tmemo-mean{font-size:12.5px;color:#8a7a5a;font-style:italic}
.tmemo-phone{display:grid;gap:8px;padding:4px}`);
X.mini({ id: 'gyxMemo', icon: '📝', title: 'TA 的备忘录', desc: 'TA 写给自己的便签和涂鸦', cat: '陪伴', onOpen: () => window.gyxMemoOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.m = D.m || {}; D.cfg = Object.assign({ every: 20, maxNew: 2, doodle: true, order: 'new' }, D.cfg || {}); setInterval(tick, 15000); })();
