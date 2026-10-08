/* 🪐 平行世界：从聊天里任意一句话分出一条「如果当时……」的世界线接着聊；几条世界线随时切换、对比 */
if (window.__gyxWorld) return; window.__gyxWorld = 1;
X.feat('gyxWorld', { n: '🪐 平行世界', desc: '从任意一句分出「如果当时……」的世界线接着聊，几条线随时切换' });
const S = X.store('world');
let D = {};   // D[cid] = { active:'main', lines:{ main:{name:'主线', msgs:null, at}, w1:{name, from, msgs, at, note} } }
const W = cid => (D[cid] = D[cid] || { active: 'main', lines: { main: { name: '主线', at: Date.now() } } });
const H = cid => (typeof globalChats !== 'undefined' && globalChats[cid]) || [];
async function save() { await S.set('d', D); }
// 把当前正在聊的那条存回去，再把目标世界线换进聊天
async function switchTo(cid, id) {
    const w = W(cid); if (!w.lines[id]) return;
    w.lines[w.active].msgs = H(cid).slice(); w.lines[w.active].at = Date.now();
    globalChats[cid] = (w.lines[id].msgs || []).slice(); w.active = id;
    try { saveAllData(); } catch (e) {}
    await save();
    try { if (String(currentChatSessionId) === String(cid)) renderChatMessages(); } catch (e) {}
    bar();
}
window.gyxWorldSwitch = (cid, id) => switchTo(String(cid), id);
window.gyxWorldFork = async function (cid, idx, name, note) {
    cid = String(cid); const w = W(cid);
    const src = H(cid); idx = Math.max(-1, Math.min(src.length - 1, +idx));
    const id = 'w' + Date.now().toString(36);
    const base = src.slice(0, idx + 1).map(m => Object.assign({}, m));
    if (note) base.push({ sender: 'system', text: `🪐 平行世界：${note}`, timestamp: Date.now() });
    w.lines[id] = { name: name || ('世界线 ' + (Object.keys(w.lines).length)), from: idx, note: note || '', msgs: base, at: Date.now() };
    await save(); await switchTo(cid, id);
    return id;
};
window.gyxWorldRename = async (cid, id) => { const w = W(String(cid)); const ask = (m, d) => typeof appPrompt === 'function' ? appPrompt(m, d) : Promise.resolve(prompt(m, d)); const n = await ask('给这条世界线起个名字', w.lines[id].name); if (n) { w.lines[id].name = n; await save(); window.gyxWorldOpen(cid); bar(); } };
window.gyxWorldDrop = async (cid, id) => { cid = String(cid); const w = W(cid); if (id === 'main') return; if (w.active === id) await switchTo(cid, 'main'); delete w.lines[id]; await save(); window.gyxWorldOpen(cid); };
// 聊天顶上的一条小提示：现在在哪条世界线
function bar() {
    const area = document.getElementById('chatMessagesArea'); if (!area) return;
    let b = document.getElementById('gyxWorldBar');
    const cid = typeof currentChatSessionId !== 'undefined' ? String(currentChatSessionId || '') : '';
    const w = D[cid];
    if (!w || w.active === 'main' || !w.lines[w.active]) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'gyxWorldBar'; area.parentNode.insertBefore(b, area); }
    b.innerHTML = `🪐 ${X.esc(w.lines[w.active].name)} <span onclick="gyxWorldOpen('${cid}')">切换</span><span onclick="gyxWorldSwitch('${cid}','main')">回主线</span>`;
}
setInterval(bar, 1500);
window.gyxWorldOpen = function (who, pickMode) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), w = W(cid);
    const msgs = H(cid);
    const lines = Object.entries(w.lines).sort((a, b) => a[0] === 'main' ? -1 : b[0] === 'main' ? 1 : a[1].at - b[1].at);
    const last = (id, L) => { const arr = id === w.active ? msgs : (L.msgs || []); const m = arr.filter(x => x.sender !== 'system').slice(-2); return m.map(x => `<p><b>${x.sender === 'me' ? '我' : X.esc(X.name(c))}</b>：${X.esc(X.plain(x.text).slice(0, 60))}</p>`).join(''); };
    X.panel('gyxWdOv', '🪐 平行世界', `<div class="gyx-row">${X.whoSel(cid, 'gyxWorldOpen')}</div>
        <div class="wd-lines">${lines.map(([id, L]) => `<div class="wd-l${id === w.active ? ' on' : ''}"><div class="wd-h"><b>${X.esc(L.name)}</b>${id === w.active ? '<em>正在这条</em>' : ''}${L.note ? `<span class="gyx-tip">如果：${X.esc(L.note)}</span>` : ''}</div>${last(id, L)}
            <div class="gyx-row">${id === w.active ? '' : `<button class="gyx-btn" onclick="gyxWorldSwitch('${cid}','${id}');gyxWorldOpen('${cid}')">去这条</button>`}${id !== 'main' ? `<button class="gyx-btn lite" onclick="gyxWorldRename('${cid}','${id}')">改名</button><button class="gyx-btn lite" onclick="gyxWorldDrop('${cid}','${id}')">删掉</button>` : ''}</div></div>`).join('')}</div>
        <div class="gyx-tip">从哪一句分岔？点一句，写下「如果当时……」，就会从那里长出一条新的世界线（原来的聊天好好地留在它自己那条线上）。</div>
        <input id="gyxWdNote" class="gyx-in" placeholder="如果当时……（比如：我答应了他的告白 / 我们没有吵架 / 他没有出国）">
        <div class="wd-msgs">${msgs.map((m, i) => ({ m, i })).filter(x => x.m.sender !== 'system').slice(-60).reverse().map(({ m, i }) => `<div class="wd-m" onclick="gyxWorldPick(${i})"><b>${m.sender === 'me' ? '我' : X.esc(X.name(c))}</b> ${X.esc(X.plain(m.text).slice(0, 80))}</div>`).join('')}</div>`);
    window.gyxWorldPick = async i => { const note = ((document.getElementById('gyxWdNote') || {}).value || '').trim(); await window.gyxWorldFork(cid, i, note ? '如果' + note.replace(/^如果/, '').slice(0, 14) : '', note); const ov = document.getElementById('gyxWdOv'); if (ov) ov.remove(); try { switchMainView('chat'); switchChatSession(cid); } catch (e) {} X.toast('🪐 进入新的世界线', note || '从这一句接着聊'); };
};
X.ctx(id => { const w = D[String(id)]; if (!w || w.active === 'main' || !w.lines[w.active]) return ''; const L = w.lines[w.active]; return L.note ? `【平行世界】你们现在在一条平行世界线上：在这个世界里，「${L.note}」。顺着这个设定自然地聊下去，别说破。` : ''; }, 'gyxWorld');
X.action({ key: 'gyx_world', label: '跟她玩「如果……」的假设游戏', hint: '如果我们在别的世界相遇', need: () => true, run: async c => (await X.reach(c, X.pick(['你突然想跟她玩一个假设游戏：「如果我们是在另一个世界相遇的……」，你先起个头', '你想问她一个「如果当时……」的问题，关于你们之间的某个瞬间', '你想象了一个平行世界里的你们，想讲给她听'])) ? '跟你玩了个「如果」游戏' : null) }, 'gyxWorld');
X.css('gyxWdCss', `
#gyxWorldBar{text-align:center;font-size:12.5px;padding:5px 10px;background:linear-gradient(90deg,#efe9ff,#e6f3ff);color:#5a4c8c;flex-shrink:0}#gyxWorldBar span{margin-left:10px;color:#1d9bf0;cursor:pointer}
.wd-l{border-radius:16px;padding:10px 14px;margin:8px 0;background:#f7f7f9;border:1px solid transparent}.wd-l.on{border-color:#b9a6ff;background:#f6f3ff}
.wd-h{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.wd-h em{font-style:normal;font-size:11.5px;color:#8e4ec6}.wd-l p{margin:4px 0;font-size:13px;color:#555}
.wd-msgs{max-height:34vh;overflow:auto;margin-top:8px;border-radius:14px;background:#fafafa;padding:4px}.wd-m{padding:7px 10px;font-size:13px;border-radius:10px;cursor:pointer}.wd-m:hover{background:#efe9ff}.wd-m b{color:#8e4ec6;margin-right:4px}
`);
X.today(() => ({ title: '🪐 平行世界', rows: Object.entries(D).filter(([, w]) => w.active && w.active !== 'main' && w.lines[w.active]).map(([cid, w]) => ({ t: X.name(X.char(cid)), x: '现在在「' + X.esc(w.lines[w.active].name) + '」', go: `gyxWorldOpen('${cid}')` })) }), 'gyxWorld');
X.mini({ id: 'gyxWorld', icon: '🪐', title: '平行世界', desc: '从任意一句分出「如果当时……」的世界线接着聊，几条线随时切换', onOpen: () => window.gyxWorldOpen() });
(async () => { D = await S.get('d', {}); })();
X.widget('gyxWorldW', { n: '平行世界', sizes: ['s', 'm'], tap: () => window.gyxWorldOpen && window.gyxWorldOpen(), r: w => { const c = X.cur(), x = c && D[String(c.id)], ln = x && x.active && x.lines[x.active]; return X.gw(w, '🪐', '平行世界', [ln && x.active !== 'main' ? '在「' + X.esc(ln.name) + '」' : '在主线', x ? Object.keys(x.lines).length - 1 + ' 条平行线' : '开一条我们的 AU']); } }, 'gyxWorld');
