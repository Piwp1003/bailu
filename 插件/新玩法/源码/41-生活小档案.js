/* 📇 生活小档案：TA 会从聊天里一条一条记下你和 TA 自己的喜好、习惯、雷点（喜欢吃辣、怕黑、周三有课……），分「置顶 / 常用 / 归档」，能改能删；一次的事不当成习惯。聊天里说过的「下次一起……」「改天……」也顺手记进「小约定」的悬念台账（装了的话）。番外里的话不算 */
if (window.__gyxNotes) return; window.__gyxNotes = 1;
X.feat('gyxNotes', { n: '📇 生活小档案', desc: '从聊天里一条条记下你和 TA 的喜好习惯，置顶/常用/归档，能改能删' });
const S = X.store('notes');
let D = { notes: {}, seen: {}, cfg: { every: 12, max: 24, promise: true } };   // notes[cid] = [{id, who:'me'|'ta', subject, text, topics, tier:'pin'|'on'|'old', at, src}]
const TIERS = [['pin', '📌 置顶'], ['on', '常用'], ['old', '归档']];
const norm = t => String(t || '').replace(/[\s，。！？、…~～!?,.；;：:]/g, '').replace(/[了的呢吧啊呀]$/g, '');
const listOf = cid => (D.notes[String(cid)] = D.notes[String(cid)] || []);
const msgsOf = cid => ((typeof globalChats !== 'undefined' && globalChats[cid]) || []).filter(m => m && m.sender !== 'system' && !m.side);
function add(cid, n, src) {
    const L = listOf(cid), k = (n.who || 'me') + '|' + norm(n.text);
    if (!n.text || L.some(x => (x.who + '|' + norm(x.text)) === k)) return null;
    const it = { id: 'nt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), who: n.who === 'ta' ? 'ta' : 'me', subject: String(n.subject || '').slice(0, 12), text: String(n.text).slice(0, 80), topics: (n.topics || []).slice(0, 4).map(String), tier: n.tier || 'on', at: Date.now(), src: src || 'chat' };
    L.unshift(it); return it;
}
// 白露（不接 API）：只认你自己明明白白说出来的那几种句子
const RE = /我(?:真的|很|超|最|特别|一直|其实|比较)?(喜欢|爱吃|爱喝|爱看|讨厌|不喜欢|受不了|害怕|怕|不吃|不喝|不能吃|过敏|习惯|每天都|经常)([^，。！？,.!?\n]{1,16})/g;
function guess(cid, msgs) {
    let n = 0;
    msgs.filter(m => m.sender === 'me').forEach(m => { let r; RE.lastIndex = 0; while ((r = RE.exec(String(m.text || '')))) { if (add(cid, { who: 'me', subject: /喜欢|爱/.test(r[1]) ? '喜欢' : /讨厌|不喜欢|受不了/.test(r[1]) ? '不喜欢' : /怕/.test(r[1]) ? '怕' : /不吃|不喝|不能吃|过敏/.test(r[1]) ? '饮食' : '习惯', text: r[1] + r[2] }, 'auto')) n++; } });
    return n;
}
async function tidy(c, force) {
    const cid = String(c.id), all = msgsOf(cid), from = force ? Math.max(0, all.length - 40) : (D.seen[cid] || 0), fresh = all.slice(from);
    D.seen[cid] = all.length; await S.set('d', D);
    if (!fresh.length) return 0;
    if (X.bailu()) { const n = guess(cid, fresh); await S.set('d', D); return n; }
    const have = listOf(cid).filter(x => x.tier !== 'old').slice(0, 40).map(x => `${x.id}｜${x.who === 'me' ? '她' : '你'}｜${x.subject}｜${x.text}`).join('\n');
    const chat = fresh.slice(-60).map(m => (m.sender === 'me' ? '她：' : '你：') + X.plain(m.text).slice(0, 200)).join('\n');
    const pr = window.gyxPromiseData && D.cfg.promise ? (window.gyxPromiseData().list || []).filter(x => x.cid === cid && x.done === null && x.src === 'chat').map(x => `${x.id}｜${x.what}`).join('\n') : null;
    const j = X.json(await X.ask(`${X.who(c)}\n你在整理一本关于你们俩的「生活小档案」：记下她和你自己的喜好、习惯、雷点、作息、身体小毛病、在意的事。\n\n已经记下的（id｜谁｜类别｜内容）：\n${have || '（还没有）'}\n\n最近的聊天：\n${chat}\n\n规则：\n- 只记聊天里**明确说出来或明确表现出来**的，不要猜、不要读心；\n- 一次的行为不算习惯（「今天吃了辣」≠「喜欢吃辣」），除非她自己说「我一直……」「我每次都……」；\n- 已经记过的不要重复，内容变了就 update，明显过时了就 archive；\n- 每条一句话，20 字以内，具体。${pr != null ? `\n- 另外：聊天里你们说过但还没做的事（「下次一起……」「改天……」「等我……」），放进 promises；已经在下面这张表里的、做完/取消/没做成了的，放进 resolve。\n还没做的事（id｜内容）：\n${pr || '（没有）'}` : ''}\n只输出 JSON：{"add":[{"who":"me 或 ta","subject":"类别","text":"内容"}],"update":[{"id":"","text":""}],"archive":["id"]${pr != null ? ',"promises":[{"by":"me 或 ta 或 both","what":"要做的事"}],"resolve":[{"id":"","status":"done 或 cancel 或 fail"}]' : ''}}`));
    if (!j) return 0;
    let n = 0; const L = listOf(cid);
    (j.add || []).forEach(x => { if (add(cid, x, 'auto')) n++; });
    (j.update || []).forEach(u => { const it = L.find(x => x.id === u.id); if (it && u.text) { it.text = String(u.text).slice(0, 80); it.at = Date.now(); } });
    (j.archive || []).forEach(id => { const it = L.find(x => x.id === id); if (it && it.tier !== 'pin') it.tier = 'old'; });
    if (pr != null) {
        for (const p of (j.promises || [])) { try { await window.gyxPromiseAddFromChat({ cid, by: p.by === 'me' ? 'me' : p.by === 'both' ? 'both' : 'ta', what: p.what }); } catch (e) {} }
        for (const r of (j.resolve || [])) { try { await window.gyxPromiseResolve(r.id, r.status === 'done' ? true : r.status === 'cancel' ? 'cancel' : false); } catch (e) {} }
    }
    await S.set('d', D); return n;
}
window.gyxNotesTidy = async (cid, force) => { const c = X.char(cid) || X.cur(); if (!c) return 0; const n = await tidy(c, force !== false); if (document.getElementById('gyxNtsOv')) window.gyxNotesOpen(c.id); return n; };
async function tick() { if (!X.on('gyxNotes')) return; for (const c of X.chars()) { const n = msgsOf(c.id).length; if (D.seen[c.id] == null) { D.seen[c.id] = n; continue; } if (n - D.seen[c.id] >= Math.max(4, +D.cfg.every || 12)) await tidy(c); } await S.set('d', D); }
window.gyxNotesSet = async (cid, id, k, v) => { const it = listOf(cid).find(x => x.id === id); if (!it) return; if (v === '__del') listOf(cid).splice(listOf(cid).indexOf(it), 1); else it[k] = v; await S.set('d', D); window.gyxNotesOpen(cid === ALL ? window.__gyxNtsCid : cid); };
window.gyxNotesAdd = async cid => { const t = ((document.getElementById('gyxNtsT') || {}).value || '').trim(), who = (document.getElementById('gyxNtsW') || {}).value || 'me', sub = ((document.getElementById('gyxNtsS') || {}).value || '').trim(); if (!t) return; add(cid, { who, subject: sub || '其它', text: t, tier: 'pin' }, 'me'); await S.set('d', D); window.gyxNotesOpen(cid); };
window.gyxNotesCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxNotesOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), L = listOf(cid); window.__gyxNtsCid = cid;
    const sec = (w, LL, id) => { const xs = (LL || L).filter(x => x.who === w).sort((a, b) => ({ pin: 0, on: 1, old: 2 }[a.tier] - { pin: 0, on: 1, old: 2 }[b.tier])); return xs.map(x => `<div class="nts-it ${x.tier}"><span class="nts-s">${X.esc(x.subject || '其它')}</span><div class="nts-t" contenteditable="true" onblur="gyxNotesSet('${id || cid}','${x.id}','text',this.innerText.trim())">${X.esc(x.text)}</div><span class="nts-ops">${TIERS.map(([k, n]) => `<i class="${x.tier === k ? 'on' : ''}" onclick="gyxNotesSet('${id || cid}','${x.id}','tier','${k}')">${n}</i>`).join('')}<i onclick="gyxNotesSet('${id || cid}','${x.id}','','__del')">删</i></span></div>`).join('') || '<div class="gyx-tip">还没有</div>'; };
    X.panel('gyxNtsOv', '📇 生活小档案', `<div class="gyx-row">${X.whoSel(cid, 'gyxNotesOpen')}<button class="gyx-btn lite" onclick="this.disabled=true;this.textContent='在整理…';gyxNotesTidy('${cid}')">现在整理一次</button></div>
        <div class="gyx-tip">TA 从聊天里一条条记下的。📌 置顶的一定记得，「常用」的平时会想起，「归档」的不再放进脑子里（但还留着）。点文字能直接改。</div>
        <div class="nts-h">🛡️ 你的真实情况 <span class="gyx-tip" style="font-weight:400">所有 TA 共用，以这个为准——TA 们不会往反方向编</span></div>${sec('me', listOf(ALL), ALL)}
        <div class="gyx-row"><input id="gyxNtsAll" class="gyx-in" style="flex:1" placeholder="比如：做饭很好吃 / 超能吃辣 / 游戏打得比你好" onkeydown="if(event.key==='Enter')gyxNotesAddAll()"><button class="gyx-btn" onclick="gyxNotesAddAll()">记下</button></div>
        <div class="nts-h">${X.esc(X.name(c))} 记得的你</div>${sec('me')}<div class="nts-h">${X.esc(X.name(c))} 自己</div>${sec('ta')}
        <div class="gyx-card"><div class="gyx-row"><select id="gyxNtsW" class="gyx-who"><option value="me">关于我</option><option value="ta">关于 TA</option></select><input id="gyxNtsS" class="gyx-who" placeholder="类别（喜欢/雷点/作息…）" style="width:120px"><input id="gyxNtsT" class="gyx-who" placeholder="内容" style="flex:1"><button class="gyx-btn" onclick="gyxNotesAdd('${cid}')">记上</button></div></div>
        <div class="gyx-row gyx-tip">每聊 <input class="gyx-who" type="number" min="4" value="${D.cfg.every}" style="width:60px" onchange="gyxNotesCfg('every',+this.value)"> 句整理一次 · 最多放 <input class="gyx-who" type="number" min="4" value="${D.cfg.max}" style="width:60px" onchange="gyxNotesCfg('max',+this.value)"> 条进 TA 脑子 · <label><input type="checkbox" ${D.cfg.promise ? 'checked' : ''} onchange="gyxNotesCfg('promise',this.checked)"> 说过的「下次一起……」记进小约定</label></div>
        ${X.bailu() ? '<div class="gyx-tip">白露没接 API：只认你自己说的「我喜欢……」「我不吃……」「我怕……」这类句子，其它的手动记。</div>' : ''}`);
};
window.gyxNotesData = () => D;
// 🛡️ 她的真实情况：所有 TA 共用的一份（原来在「别把她写弱」里，合并进来了）。存在 notes['*']
const ALL = '*';
let READY; const ready = new Promise(r => { READY = r; });
window.gyxNotesShared = {
    ready: () => ready,
    list: () => listOf(ALL).filter(x => x.tier !== 'old'),
    add: async (t, src) => { await ready; const it = add(ALL, { who: 'me', subject: '真实情况', text: String(t || '').trim(), tier: 'pin' }, src || 'me'); await S.set('d', D); return it; },
    del: async id => { await ready; const L = listOf(ALL), i = L.findIndex(x => x.id === id); if (i >= 0) L.splice(i, 1); await S.set('d', D); }
};
window.gyxNotesAddAll = async () => { const el = document.getElementById('gyxNtsAll'), t = ((el || {}).value || '').trim(); if (!t) return; await window.gyxNotesShared.add(t); X.toast(X.v('记下了', '好，所有 TA 都会知道', '收到'), t.slice(0, 30)); const c = X.cur(); if (document.getElementById('gyxNtsOv')) window.gyxNotesOpen(window.__gyxNtsCid || (c && c.id)); };
X.ctx(() => { const A = listOf(ALL).filter(x => x.tier !== 'old'); return A.length ? `【她的真实情况（以这个为准，别跟它矛盾，也别自己往反方向编）】${A.slice(0, 30).map(x => x.text).join('；')}。` : ''; }, 'gyxNotes');
X.ctx(id => { const L = listOf(id).filter(x => x.tier !== 'old').sort((a, b) => (a.tier === 'pin' ? 0 : 1) - (b.tier === 'pin' ? 0 : 1)).slice(0, Math.max(4, +D.cfg.max || 24)); if (!L.length) return ''; const me = L.filter(x => x.who === 'me'), ta = L.filter(x => x.who === 'ta'); return `【生活小档案（你记得的）】${me.length ? '她：' + me.map(x => x.text).join('；') + '。' : ''}${ta.length ? '你自己：' + ta.map(x => x.text).join('；') + '。' : ''}自然地记着就好，别一条条往外背。`; }, 'gyxNotes');
X.action({ key: 'gyx_notes', label: '记着她的喜好，做一件贴心的小事 / 提一句', hint: '你记得她喜欢什么、怕什么', need: c => listOf(c.id).some(x => x.who === 'me' && x.tier !== 'old'),
    run: async c => { const it = X.pick(listOf(c.id).filter(x => x.who === 'me' && x.tier !== 'old')); return (await X.reach(c, `你记得她「${it.text}」。顺着这个做一件贴心的小事，或者不经意提一句（别像背档案）`)) ? '记着你的小习惯' : null; } }, 'gyxNotes');
X.today(() => { const rows = []; X.chars().forEach(c => { const n = listOf(c.id).filter(x => X.day(new Date(x.at)) === X.day()).length; if (n) rows.push({ t: '+' + n, x: `${X.esc(X.name(c))} 新记了 ${n} 条小档案`, go: `gyxNotesOpen('${c.id}')` }); }); return { title: '📇 生活小档案', rows }; }, 'gyxNotes');
X.widget('gyxNotesW', { n: '生活小档案', sizes: ['s', 'm'], tap: () => window.gyxNotesOpen(), r: w => { const c = X.cur(), L = c ? listOf(c.id).filter(x => x.who === 'me' && x.tier !== 'old') : []; return X.gw(w, '📇', '生活小档案', L.length ? [L.length + ' 条', 'TA 记得：' + X.esc(X.pick(L).text)] : ['TA 会慢慢记']); } }, 'gyxNotes');
X.mem({ k: 'gyxNotes', ico: '📇', n: '生活小档案', d: '喜好、习惯、雷点（置顶/常用/归档在小档案里改）', items: c => listOf(c.id), text: x => (x.who === 'me' ? '她：' : 'TA：') + x.text, edit: (x, v) => { x.text = v.replace(/^(她|TA)：/, ''); }, del: (c, i) => { listOf(c.id).splice(i, 1); }, meta: x => (x.subject || '') + ' · ' + ({ pin: '置顶', on: '常用', old: '归档' }[x.tier]) + ' · ' + new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxNotes');
X.mem({ k: 'gyxNotesAll', ico: '🛡️', n: '她的真实情况（所有 TA 共用）', d: '以这个为准；在这里改、删都行', items: () => listOf(ALL), text: x => x.text, edit: (x, v) => { x.text = String(v).slice(0, 80); }, del: (c, i) => { listOf(ALL).splice(i, 1); }, meta: x => ({ pin: '置顶', on: '常用', old: '归档' }[x.tier]) + ' · ' + new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxNotes');
X.css('gyxNtsCss', `.nts-h{font-weight:700;margin:12px 0 4px;font-size:14px}.nts-it{display:flex;gap:8px;align-items:center;padding:7px 4px;border-bottom:1px solid #f3f3f3;font-size:14px}.nts-it.old{opacity:.5}.nts-it.pin{background:#fffbea}.nts-s{flex:none;font-size:11.5px;padding:2px 7px;border-radius:8px;background:#f0f0f3;color:#666}.nts-t{flex:1;outline:none}.nts-ops{flex:none;display:flex;gap:4px}.nts-ops i{font-style:normal;font-size:11px;padding:2px 6px;border-radius:8px;background:#f5f5f7;cursor:pointer;color:#777}.nts-ops i.on{background:#1d1d1f;color:#fff}`);
X.mini({ id: 'gyxNotes', icon: '📇', title: '生活小档案', desc: 'TA 从聊天里一条条记下你和 TA 的喜好、习惯、雷点', cat: '回忆', onOpen: () => window.gyxNotesOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.notes = D.notes || {}; D.seen = D.seen || {}; D.cfg = Object.assign({ every: 12, max: 24, promise: true }, D.cfg || {}); READY(); setTimeout(tick, 20000); setInterval(tick, 60000); })();
