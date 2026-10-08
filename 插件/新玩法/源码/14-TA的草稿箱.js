/* ✏️ TA 的草稿箱：TA 有时打了一句又删掉——聊天里会闪一下「对方正在输入…」然后没了；那些没发出去的话，都在 TA 的草稿箱里。偶尔还会发出来又撤回 */
if (window.__gyxDraft) return; window.__gyxDraft = 1;
X.feat('gyxDraft', { n: '✏️ TA 的草稿箱', desc: 'TA 打了又删掉、没发出去的话；聊天里会闪一下「正在输入」，偶尔还会撤回' });
const S = X.store('draft');
let D = { list: [], cfg: { p: 15, recall: 5, ta: 'some' } };
const seen = {};
async function draft(c) {
    if (X.bailu()) { const t = X.cards(['草稿', '聊天'], c, 1)[0]; return t ? { text: t, why: '' } : null; }
    const r = await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 14)}\n\n刚才回她之前，你在输入框里打了一句话，犹豫了一下，又删掉了，没发出去。那是一句什么话？（可能是太直白的想念、没说出口的醋意、想问又不敢问的事、一句撒娇、一个没说完的心事……要符合你的性格和此刻的气氛）\n只输出 JSON：{"text":"那句删掉的话","why":"为什么删掉（你心里的一句话）"}`);
    const j = X.json(r); return j && j.text ? j : null;
}
function typing(c, ms) {
    const area = document.getElementById('chatMessagesArea'); if (!area || String(currentChatSessionId) !== String(c.id)) return;
    let t = document.getElementById('gyxTyping'); if (!t) { t = document.createElement('div'); t.id = 'gyxTyping'; area.parentNode.insertBefore(t, area.nextSibling); }
    t.innerHTML = `${X.esc(X.name(c))} 正在输入<i></i><i></i><i></i>`; t.classList.add('on');
    clearTimeout(t.__h); t.__h = setTimeout(() => t.classList.remove('on'), ms);
}
async function maybe(c, force) {
    if (!force && Math.random() * 100 >= (+D.cfg.p || 0)) return null;
    typing(c, X.rnd(2500, 6000));
    const d = await draft(c); if (!d) return null;
    const it = { id: 'df' + Date.now(), cid: String(c.id), at: Date.now(), text: String(d.text), why: String(d.why || '') };
    // 偶尔：发出来了，又撤回
    if (force === 'recall' || (!force && Math.random() * 100 < (+D.cfg.recall || 0))) {
        const m = X.say(c, it.text); it.recalled = true;
        recallLater(c, m, it, force ? 50 : X.rnd(1800, 4000));
    }
    D.list.unshift(it); await S.set('d', D); return it;
}
// 撤回：把那条换成「撤回了一条消息」；记下撤回的是什么、她当时在不在看
function recallLater(c, m, it, ms) {
    setTimeout(async () => {
        try {
            const sid = String(c.id), H = globalChats[sid] || []; const i = H.indexOf(m); if (i < 0) return;
            const live = String(currentChatSessionId) === sid && document.visibilityState !== 'hidden' && (() => { const v = document.getElementById('view-chat'); return !!v && v.style.display !== 'none'; })();
            it.live = live; it.recalled = true;
            H.splice(i, 1, { sender: 'system', text: `「${X.name(c)}」撤回了一条消息`, timestamp: m.timestamp, gyxRecall: it.id });
            await S.set('d', D); saveAllData();
            if (String(currentChatSessionId) === sid) renderChatMessages();
        } catch (e) {}
    }, ms);
}
// 偷看：点「撤回了一条消息」后面那个小字
window.gyxRecallPeek = async id => {
    const it = D.list.find(x => x.id === id); if (!it) return;
    it.peeked = Date.now(); await S.set('d', D);
    X.toast(X.v('偷看到了', '被你看到了', '嘘——'), '「' + it.text.slice(0, 30) + '」');
    try { renderChatMessages(); } catch (e) {}
};
function paintRecall() {
    const area = document.getElementById('chatMessagesArea'); if (!area || !X.on('gyxDraft')) return;
    const L = ((typeof globalChats !== 'undefined' && globalChats[currentChatSessionId]) || []).filter(m => m && m.sender === 'system' && /撤回了一条消息$/.test(m.text || ''));
    const spans = [...area.querySelectorAll('.chat-system-msg span')].filter(sp => /撤回了一条消息$/.test(sp.textContent || ''));
    for (let k = 1; k <= Math.min(L.length, spans.length); k++) {
        const m = L[L.length - k], sp = spans[spans.length - k]; if (!m.gyxRecall) continue;
        const it = D.list.find(x => x.id === m.gyxRecall); if (!it || sp.querySelector('.rc-peek')) continue;
        const a = document.createElement('i'); a.className = 'rc-peek' + (it.peeked ? ' seen' : '');
        if (it.peeked) a.textContent = `「${it.text}」`; else { a.textContent = '偷看一眼'; a.onclick = e => { e.stopPropagation(); window.gyxRecallPeek(it.id); }; }
        sp.appendChild(a);
    }
}
// TA 自己决定撤回：某条回复末尾带 [撤回]，那条发出来几秒后撤回
const RC = /\[\s*撤回\s*\]/g, waitRecall = [];
function hookRecall() {
    const ex = window.gyChatActsExtract;
    if (typeof ex === 'function' && !ex.__gyxRecall) {
        const w = function (text, char) {
            if (typeof text === 'string' && char && /\[\s*撤回\s*\]/.test(text)) {
                text = text.replace(RC, '').replace(/[ \t]{2,}/g, ' ').trim(); arguments[0] = text;
                if (X.on('gyxDraft') && D.cfg.ta !== 'off' && text) waitRecall.push({ cid: String(char.id), text, at: Date.now() });
            }
            return ex.apply(this, arguments);
        };
        Object.keys(ex).forEach(k => { try { w[k] = ex[k]; } catch (e) {} }); w.__gyxRecall = 1; window.gyChatActsExtract = w;
    }
    const st = window.stripLeftoverMarkers;
    if (typeof st === 'function' && !st.__gyxRecall) {
        const w = function (t) { if (typeof t === 'string' && t.indexOf('撤回') >= 0) arguments[0] = t.replace(RC, '').trim(); return st.apply(this, arguments); };
        Object.keys(st).forEach(k => { try { w[k] = st[k]; } catch (e) {} }); w.__gyxRecall = 1; window.stripLeftoverMarkers = w; try { stripLeftoverMarkers = w; } catch (e) {}
    }
    const rr = window.renderChatMessages;
    if (typeof rr === 'function' && !rr.__gyxRecall) { const w = function () { const x = rr.apply(this, arguments); try { paintRecall(); } catch (e) {} return x; }; Object.keys(rr).forEach(k => { try { w[k] = rr[k]; } catch (e) {} }); w.__gyxRecall = 1; window.renderChatMessages = w; try { renderChatMessages = w; } catch (e) {} }
}
function flushRecall() {
    for (let q = waitRecall.length - 1; q >= 0; q--) {
        const w = waitRecall[q]; if (Date.now() - w.at > 120000) { waitRecall.splice(q, 1); continue; }
        const c = X.char(w.cid); if (!c) { waitRecall.splice(q, 1); continue; }
        const H = (globalChats[w.cid] || []); const m = H.slice().reverse().find(x => String(x.sender) === w.cid && !x.gyxRecallQ && x.timestamp >= w.at - 5000 && X.plain(x.text) === X.plain(w.text));
        if (!m) continue;
        m.gyxRecallQ = 1; waitRecall.splice(q, 1);
        const it = { id: 'df' + Date.now() + Math.random().toString(36).slice(2, 4), cid: w.cid, at: Date.now(), text: X.plain(m.text), why: 'TA 自己发完又撤回的', self: 1 };
        D.list.unshift(it); recallLater(c, m, it, X.rnd(1500, 3500));
    }
}
window.gyxDraftMake = (id, how) => maybe(X.char(id) || X.cur(), how || true);
function watch() { if (!X.on('gyxDraft')) return;
    X.chars().forEach(c => {
        const H = (typeof globalChats !== 'undefined' && globalChats[c.id]) || []; const m = H[H.length - 1]; if (!m) return;
        const k = String(c.id); if (seen[k] == null) { seen[k] = m.timestamp; return; }
        if (m.timestamp <= seen[k]) return; seen[k] = m.timestamp;
        if (String(m.sender) === String(c.id) && !m.gyx && Date.now() - m.timestamp < 60000) setTimeout(() => maybe(c), X.rnd(1500, 5000));
    });
}
window.gyxDraftOpen = function (who) {
    const c = X.char(who) || X.cur(), cid = c ? String(c.id) : '';
    const L = D.list.filter(d => !cid || d.cid === cid);
    X.panel('gyxDfOv', '✏️ TA 的草稿箱', `<div class="gyx-row">${X.whoSel(cid, 'gyxDraftOpen')}</div>
        <div class="gyx-tip">TA 打了又删掉、没发出去的话。${L.length ? '点一条，看 TA 当时为什么删掉。' : ''}</div>
        ${L.map(d => `<div class="df-it" onclick="this.classList.toggle('why')"><div class="df-t"><span>${X.esc(d.text)}</span><i></i></div><div class="df-m">${new Date(d.at).toLocaleString()}${d.recalled ? (d.self ? ' · TA 自己撤回的' : ' · 发出去又撤回了') + (d.peeked ? ' · 你偷看到了' : d.live ? ' · 你当时在看' : '') : ' · 没发'}</div>${d.why ? `<div class="df-w">💭 ${X.esc(d.why)}</div>` : ''}</div>`).join('') || '<div class="gyx-tip">还是空的。聊着聊着就会有了。</div>'}
        <div class="gyx-row gyx-tip">TA 每次回你时，有 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.p}" style="width:60px" onchange="gyxDraftCfg('p',+this.value)">% 的可能打了一句又删掉；其中 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.recall}" style="width:60px" onchange="gyxDraftCfg('recall',+this.value)">% 是发出来又撤回。</div>
        ${X.bailu() ? '' : `<div class="gyx-row gyx-tip">TA 自己决定撤回（回复里带 [撤回]）：<select class="gyx-who" onchange="gyxDraftCfg('ta',this.value)">${[['off', '从不'], ['some', '偶尔'], ['often', '常常']].map(([v, n]) => `<option value="${v}"${D.cfg.ta === v ? ' selected' : ''}>${n}</option>`).join('')}</select></div>`}
        <div class="gyx-tip">聊天里「撤回了一条消息」后面有个「偷看一眼」，点了 TA 会知道你看到了。</div>`);
};
window.gyxDraftCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxDraftData = () => D;
X.ctx(id => {
    const d = D.list.find(x => x.cid === String(id) && Date.now() - x.at < 6 * 3600000);
    let s = '';
    if (d) s = `【你心里】你刚才${d.recalled ? '发了' : '打过'}一句「${d.text}」${d.recalled ? '又撤回了' : '又删掉了，没发'}。` + (!d.recalled ? '她不知道，别主动提。' : d.peeked ? '她偷看到了撤回的内容（她知道你说了什么）。按你的性格应对——嘴硬、害羞、装没事、干脆承认都行。' : d.live ? '她当时正在看聊天，可能看到了，也可能没看清。她要是问起，按你的性格应对。' : '她当时不在，大概没看到；她要是问你撤回了什么，按你的性格决定说不说。');
    if (!X.bailu() && D.cfg.ta !== 'off') s += `\n【撤回】只在私聊 / 群聊回复里可以用：如果某句话你发出去就后悔了（太直白、说漏嘴、冲动了），可以在那条回复末尾加 [撤回]，它会显示一下然后变成「撤回了一条消息」。${D.cfg.ta === 'often' ? '想撤就撤，但一轮最多一条。' : '很少用，大多数时候不要撤，一轮最多一条。'}`;
    return s.trim();
}, 'gyxDraft');
X.action({ key: 'gyx_draft', label: '打了一句话又删掉（没发出去）', hint: '有些话说不出口', need: () => true, run: async c => (await maybe(c, true)) ? '（打了一句又删掉了）' : null }, 'gyxDraft');
X.css('gyxDfCss', `
#gyxTyping{font-size:12px;color:#8e8e93;padding:0 16px;height:0;overflow:hidden;transition:height .25s;flex-shrink:0}#gyxTyping.on{height:20px}
#gyxTyping i{display:inline-block;width:4px;height:4px;border-radius:50%;background:#8e8e93;margin-left:3px;animation:dfDot 1.2s infinite}#gyxTyping i:nth-child(2){animation-delay:.2s}#gyxTyping i:nth-child(3){animation-delay:.4s}
@keyframes dfDot{0%,100%{opacity:.2}40%{opacity:1}}
.df-it{padding:12px 14px;border-radius:16px;background:#f7f7f9;margin:8px 0;cursor:pointer}
.df-t{font-size:15px;line-height:1.6;display:flex;align-items:center}.df-t span{background:linear-gradient(#1d1d1f,#1d1d1f) no-repeat left 55%/0 1.5px;animation:dfDel 1.4s .6s forwards}.df-t i{display:inline-block;width:2px;height:1.1em;background:#1d9bf0;margin-left:2px;animation:dfCur 1s steps(1) infinite}
@keyframes dfDel{to{background-size:100% 1.5px;color:#aaa}}@keyframes dfCur{50%{opacity:0}}
.df-m{font-size:11.5px;color:#aaa;margin-top:4px}
.rc-peek{font-style:normal;margin-left:6px;color:#1d9bf0;cursor:pointer;font-size:11.5px}.rc-peek.seen{color:#8e8e93;cursor:default}.df-w{display:none;font-size:13px;color:#8e4ec6;margin-top:6px}.df-it.why .df-w{display:block}
`);
X.today(() => { const L = D.list.filter(d => X.day(new Date(d.at)) === X.day()); const R = L.filter(d => d.recalled); return { title: '✏️ 草稿箱', rows: L.length ? [{ t: L.length + ' 句', x: 'TA 今天打了又删掉的话' + (R.length ? `，撤回了 ${R.length} 条${R.some(d => d.peeked) ? '（你偷看过）' : ''}` : ''), go: 'gyxDraftOpen()' }] : [] }; }, 'gyxDraft');
X.mini({ id: 'gyxDraft', icon: '✏️', title: 'TA 的草稿箱', desc: 'TA 打了又删掉、没发出去的话；聊天里会闪一下「正在输入」，偶尔还会撤回', onOpen: () => window.gyxDraftOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.list = D.list || []; D.cfg = Object.assign({ p: 15, recall: 5, ta: 'some' }, D.cfg || {}); setInterval(watch, 2500); setInterval(() => { hookRecall(); flushRecall(); }, 1200); hookRecall(); })();
X.widget('gyxDraftW', { n: 'TA 的草稿箱', sizes: ['s', 'm'], tap: () => window.gyxDraftOpen(), r: w => { const d = D.list[0]; return X.gw(w, '✏️', 'TA 的草稿箱', d ? [D.list.filter(x => X.day(new Date(x.at)) === X.day()).length + ' 句没发出去', '「' + X.esc(d.text.slice(0, 24)) + '…」'] : ['TA 还没删过什么']); } }, 'gyxDraft');
X.memArr({ k: 'gyxDraft', ico: '✏️', n: 'TA 没发出去的话', d: '打了又删的', arr: () => D.list, text: x => x.text, field: 'text', meta: x => new Date(x.at).toLocaleString() + (x.why ? ' · ' + x.why : ''), save: () => S.set('d', D) }, 'gyxDraft');
