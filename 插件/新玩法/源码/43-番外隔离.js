/* 🎬 番外隔离：长按 / 右键一条消息 →「标为番外」：这条照样留在聊天里，但不进聊天总结、不进向量记忆、不进生活小档案，TA 平时不会当真；也能开「番外模式」，从现在起发的都算番外（随时关）。小剧场的某一场也能标番外，不进小剧场记忆 */
if (window.__gyxSide) return; window.__gyxSide = 1;
X.feat('gyxSide', { n: '🎬 番外隔离', desc: '消息 / 小剧场可以标成番外：留着看，但不进记忆' });
const S = X.store('side');
let D = { mode: {}, ctx: false, log: [] };   // mode[cid] = true：番外模式开着；ctx：番外连「最近聊天」都不给 TA 看
const H = sid => (typeof globalChats !== 'undefined' && globalChats[sid]) || [];
function mark(sid, i, on) {
    const m = H(sid)[i]; if (!m || m.sender === 'system') return false;
    if (on) { m.side = true; m.embVec = []; } else { delete m.side; if (Array.isArray(m.embVec) && !m.embVec.length) delete m.embVec; }   // 空向量＝已处理过但永远检索不到
    try { saveAllData(); } catch (e) {} paintAll(); return true;
}
window.gyxSideMark = (i, on) => mark(String(currentChatSessionId), i, on);
window.gyxSideMode = async (sid, on) => { sid = String(sid || currentChatSessionId); D.mode[sid] = !!on; await S.set('d', D); D.log.unshift({ at: Date.now(), sid, on: !!on }); X.toast(on ? X.v('番外模式开了', '接下来都算番外') : X.v('回到正片', '番外模式关了'), on ? '这段时间发的都不进记忆' : ''); bar(); };
// 番外模式开着：新消息自动标番外
let lens = {};
function sweepNew() { if (!X.on('gyxSide')) return; Object.keys(D.mode).forEach(sid => { if (!D.mode[sid]) return; const L = H(sid); for (let i = lens[sid] || 0; i < L.length; i++) { const m = L[i]; if (m && m.sender !== 'system' && !m.side) { m.side = true; m.embVec = []; } } lens[sid] = L.length; }); Object.keys(D.mode).forEach(sid => { if (!D.mode[sid]) lens[sid] = H(sid).length; }); }
// 气泡上标一下
function paintAll() {
    const area = document.getElementById('chatMessagesArea'); if (!area || typeof currentChatSessionId === 'undefined') return; const L = H(currentChatSessionId);
    area.querySelectorAll('.chat-bubble').forEach(b => { const m = /showChatContextMenu\(event,\s*(\d+)\)/.exec(b.getAttribute('oncontextmenu') || ''); if (!m) return; const on = !!(L[+m[1]] && L[+m[1]].side); b.classList.toggle('gyx-side', on && X.on('gyxSide')); });
}
function bar() {
    const area = document.getElementById('chatMessagesArea'); let b = document.getElementById('gyxSideBar');
    const on = X.on('gyxSide') && typeof currentChatSessionId !== 'undefined' && D.mode[String(currentChatSessionId)];
    if (!on) { if (b) b.remove(); return; }
    if (!b && area) { b = document.createElement('div'); b.id = 'gyxSideBar'; b.innerHTML = '🎬 番外模式中：这段不进记忆 <a onclick="gyxSideMode(null,false)">回到正片</a>'; area.parentNode.insertBefore(b, area); }
}
// ---------- 记忆那边把番外滤掉 ----------
function swapOut(sid, fn) { const L = globalChats[sid]; if (!Array.isArray(L) || !L.some(m => m && m.side)) return fn(); globalChats[sid] = L.filter(m => !m || !m.side); let r; try { r = fn(); } finally { const now = globalChats[sid]; const added = now.slice(L.filter(m => !m || !m.side).length); globalChats[sid] = L.concat(added); } return r; }
function hooks() {
    const sum = window.checkAndAutoSummarizeChat;
    if (typeof sum === 'function' && !sum.__gyxSide) { const w = function (sid) { if (!X.on('gyxSide')) return sum.apply(this, arguments); const a = arguments; return swapOut(sid, () => sum.apply(this, a)); }; Object.keys(sum).forEach(k => { try { w[k] = sum[k]; } catch (e) {} }); w.__gyxSide = 1; window.checkAndAutoSummarizeChat = w; try { checkAndAutoSummarizeChat = w; } catch (e) {} }
    const emb = window.embedMessageInBackground;
    if (typeof emb === 'function' && !emb.__gyxSide) { const w = function (msg) { if (X.on('gyxSide') && msg && (msg.side || (typeof currentChatSessionId !== 'undefined' && D.mode[String(currentChatSessionId)]))) { msg.embVec = []; return Promise.resolve(); } return emb.apply(this, arguments); }; Object.keys(emb).forEach(k => { try { w[k] = emb[k]; } catch (e) {} }); w.__gyxSide = 1; window.embedMessageInBackground = w; try { embedMessageInBackground = w; } catch (e) {} }
    const th = window.getCharTheaterLogs;
    if (typeof th === 'function' && !th.__gyxSide) { const w = function () { const r = th.apply(this, arguments); return X.on('gyxSide') && Array.isArray(r) ? r.filter(l => !l || !l.side) : r; }; Object.keys(th).forEach(k => { try { w[k] = th[k]; } catch (e) {} }); w.__gyxSide = 1; window.getCharTheaterLogs = w; try { getCharTheaterLogs = w; } catch (e) {} }
    const hist = window.buildTimeAwareHistoryText;
    if (typeof hist === 'function' && !hist.__gyxSide) { const w = function (msgs) { if (X.on('gyxSide') && D.ctx && Array.isArray(msgs)) arguments[0] = msgs.filter(m => !m || !m.side); return hist.apply(this, arguments); }; Object.keys(hist).forEach(k => { try { w[k] = hist[k]; } catch (e) {} }); w.__gyxSide = 1; window.buildTimeAwareHistoryText = w; try { buildTimeAwareHistoryText = w; } catch (e) {} }
    const cm = window.showChatContextMenu;
    if (typeof cm === 'function' && !cm.__gyxSide) {
        const w = function (e, idx) { const x = cm.apply(this, arguments); try { if (!X.on('gyxSide')) return x; const m = H(currentChatSessionId)[idx], menu = document.getElementById('chatContextMenu'); if (menu && m && m.sender !== 'system') { const b = document.createElement('button'); b.className = 'context-btn'; b.textContent = m.side ? '🎬 取消番外（算回正片）' : '🎬 标为番外（不进记忆）'; b.onclick = () => { menu.style.display = 'none'; mark(String(currentChatSessionId), idx, !m.side); }; const del = [...menu.children].find(c => /删除/.test(c.textContent)); menu.insertBefore(b, del || null); } } catch (er) {} return x; };
        Object.keys(cm).forEach(k => { try { w[k] = cm[k]; } catch (e) {} }); w.__gyxSide = 1; window.showChatContextMenu = w; try { showChatContextMenu = w; } catch (e) {}
    }
    const rr = window.renderChatMessages;
    if (typeof rr === 'function' && !rr.__gyxSide) { const w = function () { const x = rr.apply(this, arguments); try { paintAll(); bar(); } catch (e) {} return x; }; Object.keys(rr).forEach(k => { try { w[k] = rr[k]; } catch (e) {} }); w.__gyxSide = 1; window.renderChatMessages = w; try { renderChatMessages = w; } catch (e) {} }
}
// 小剧场：标番外
window.gyxSideTheater = (i, on) => { const L = (typeof globalTheaterLogs !== 'undefined' ? globalTheaterLogs : []); const it = L[L.length - 1 - i]; if (!it) return; it.side = !!on; try { saveAllData(); } catch (e) {} window.gyxSideOpen(); };
window.gyxSideCfg = async v => { D.ctx = !!v; await S.set('d', D); };
window.gyxSideOpen = function () {
    const sid = typeof currentChatSessionId !== 'undefined' ? String(currentChatSessionId || '') : '', L = H(sid).map((m, i) => ({ m, i })).filter(x => x.m && x.m.side);
    const TL = (typeof globalTheaterLogs !== 'undefined' ? globalTheaterLogs : []).slice().reverse().slice(0, 30);
    X.panel('gyxSdOv', '🎬 番外隔离', `<div class="gyx-tip">番外：留在聊天里能看，但不进聊天总结、向量记忆、生活小档案、小剧场记忆，TA 平时不会当真。长按 / 右键任何一条消息都能「标为番外」。</div>
        ${sid ? `<div class="gyx-row"><button class="gyx-btn${D.mode[sid] ? ' lite' : ''}" onclick="gyxSideMode('${sid}',${!D.mode[sid]});gyxSideOpen()">${D.mode[sid] ? '关掉番外模式，回到正片' : '在现在这个聊天开番外模式'}</button></div>` : ''}
        <label class="gyx-row gyx-tip"><input type="checkbox" ${D.ctx ? 'checked' : ''} onchange="gyxSideCfg(this.checked)"> 番外连「最近的聊天」都不给 TA 看（不勾＝TA 回话时还看得到刚才的番外，只是不往记忆里记）</label>
        <div class="gyx-tip">这个聊天里的番外（${L.length} 条）</div>${L.slice(-30).reverse().map(x => `<div class="sd-it"><span>${X.esc(X.plain(x.m.text).slice(0, 60))}</span><a onclick="gyxSideMark(${x.i},false);gyxSideOpen()">算回正片</a></div>`).join('') || '<div class="gyx-tip">没有</div>'}
        ${TL.length ? `<details><summary class="gyx-tip">🎭 小剧场（最近 ${TL.length} 场）——标成番外的不进小剧场记忆</summary>${TL.map((l, i) => `<div class="sd-it"><span>${X.esc(l.summary || l.scene || '').slice(0, 50)}</span><a onclick="gyxSideTheater(${i},${!l.side})">${l.side ? '算回正片' : '标为番外'}</a></div>`).join('')}</details>` : ''}`);
};
window.gyxSideData = () => D;
X.action({ key: 'gyx_side', label: '想跟她来一段「番外」：不算数的平行剧情（不进记忆）', hint: '突然的脑洞、想演点不一样的', need: c => !D.mode[String(c.id)], run: async c => { await window.gyxSideMode(String(c.id), true); return (await X.reach(c, '你想跟她来一段「番外」——一段不算数、和平时的你们无关的剧情（可以是别的身份、别的时代、如果……）。用一两句话起个头，邀请她接着演；告诉她这段是番外')) ? '开了一段番外' : null; } }, 'gyxSide');
X.ctx(id => D.mode[String(id)] ? '【番外模式】现在你们在演一段番外：不当真、不算你们真实发生过的事，演完就翻篇。' : '', 'gyxSide');
X.today(() => { const n = X.chars().reduce((a, c) => a + H(String(c.id)).filter(m => m && m.side && X.day(new Date(m.timestamp || 0)) === X.day()).length, 0); const on = Object.keys(D.mode).filter(k => D.mode[k]); return { title: '🎬 番外', rows: (on.length ? [{ t: '🎬', x: `<b>${on.map(k => X.esc(X.name(X.char(k)))).join('、')} 在番外模式</b>`, go: 'gyxSideOpen()' }] : []).concat(n ? [{ t: n + ' 条', x: '今天的番外（不进记忆）', go: 'gyxSideOpen()' }] : []) }; }, 'gyxSide');
X.widget('gyxSideW', { n: '番外', sizes: ['s'], tap: () => window.gyxSideOpen(), r: w => { const on = Object.keys(D.mode).filter(k => D.mode[k]).length; return X.gw(w, '🎬', '番外', [on ? '番外模式中' : '正片']); } }, 'gyxSide');
X.mem({ k: 'gyxSide', ico: '🎬', n: '番外（不进记忆的消息）', d: '删掉＝算回正片（消息本身不删）', items: c => H(String(c.id)).filter(m => m && m.side), text: m => X.plain(m.text), edit: (m, v) => { m.text = v; }, del: (c, i) => { const m = H(String(c.id)).filter(x => x && x.side)[i]; if (m) { delete m.side; if (Array.isArray(m.embVec) && !m.embVec.length) delete m.embVec; } }, meta: m => new Date(m.timestamp || 0).toLocaleString(), save: async () => { try { saveAllData(); } catch (e) {} } }, 'gyxSide');
X.css('gyxSdCss', `.chat-bubble.gyx-side{outline:1.5px dashed rgba(142,78,198,.55);outline-offset:2px;position:relative}.chat-bubble.gyx-side::after{content:'番外';position:absolute;top:-9px;right:6px;font-size:10px;padding:0 5px;border-radius:6px;background:#8e4ec6;color:#fff;line-height:16px}
#gyxSideBar{text-align:center;font-size:12.5px;padding:6px;background:rgba(142,78,198,.1);color:#8e4ec6}#gyxSideBar a{margin-left:8px;cursor:pointer;text-decoration:underline}
.sd-it{display:flex;gap:8px;align-items:center;padding:6px 2px;border-bottom:1px solid #f2f2f2;font-size:13px}.sd-it span{flex:1}.sd-it a{color:#1d9bf0;cursor:pointer;font-size:12px;white-space:nowrap}`);
X.mini({ id: 'gyxSide', icon: '🎬', title: '番外隔离', desc: '消息 / 小剧场标成番外：留着看，但不进记忆；也能开番外模式', cat: '回忆', onOpen: () => window.gyxSideOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.mode = D.mode || {}; D.log = D.log || []; hooks(); Object.keys(globalChats || {}).forEach(k => { lens[k] = H(k).length; }); setInterval(() => { hooks(); sweepNew(); }, 1500); })();
