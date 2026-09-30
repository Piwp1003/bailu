/* ✏️ TA 的草稿箱：TA 有时打了一句又删掉——聊天里会闪一下「对方正在输入…」然后没了；那些没发出去的话，都在 TA 的草稿箱里。偶尔还会发出来又撤回 */
if (window.__gyxDraft) return; window.__gyxDraft = 1;
X.feat('gyxDraft', { n: '✏️ TA 的草稿箱', desc: 'TA 打了又删掉、没发出去的话；聊天里会闪一下「正在输入」，偶尔还会撤回' });
const S = X.store('draft');
let D = { list: [], cfg: { p: 15, recall: 5 } };
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
        setTimeout(() => { try { const H = globalChats[String(c.id)]; const i = H.indexOf(m); if (i >= 0) { H.splice(i, 1, { sender: 'system', text: `「${X.name(c)}」撤回了一条消息`, timestamp: m.timestamp }); saveAllData(); if (String(currentChatSessionId) === String(c.id)) renderChatMessages(); } } catch (e) {} }, force ? 50 : X.rnd(1800, 4000));
    }
    D.list.unshift(it); await S.set('d', D); return it;
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
        ${L.map(d => `<div class="df-it" onclick="this.classList.toggle('why')"><div class="df-t"><span>${X.esc(d.text)}</span><i></i></div><div class="df-m">${new Date(d.at).toLocaleString()}${d.recalled ? ' · 发出去又撤回了' : ' · 没发'}</div>${d.why ? `<div class="df-w">💭 ${X.esc(d.why)}</div>` : ''}</div>`).join('') || '<div class="gyx-tip">还是空的。聊着聊着就会有了。</div>'}
        <div class="gyx-row gyx-tip">TA 每次回你时，有 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.p}" style="width:60px" onchange="gyxDraftCfg('p',+this.value)">% 的可能打了一句又删掉；其中 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.recall}" style="width:60px" onchange="gyxDraftCfg('recall',+this.value)">% 是发出来又撤回。</div>`);
};
window.gyxDraftCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxDraftData = () => D;
X.ctx(id => { const d = D.list.find(x => x.cid === String(id) && Date.now() - x.at < 6 * 3600000); return d ? `【你心里】你刚才打过一句「${d.text}」又删掉了${d.recalled ? '（发出去又撤回了，她可能看到了）' : '，她不知道'}。${d.recalled ? '她要是问起，按你的性格应对。' : '别主动提。'}` : ''; }, 'gyxDraft');
X.action({ key: 'gyx_draft', label: '打了一句话又删掉（没发出去）', hint: '有些话说不出口', need: () => true, run: async c => (await maybe(c, true)) ? '（打了一句又删掉了）' : null }, 'gyxDraft');
X.css('gyxDfCss', `
#gyxTyping{font-size:12px;color:#8e8e93;padding:0 16px;height:0;overflow:hidden;transition:height .25s;flex-shrink:0}#gyxTyping.on{height:20px}
#gyxTyping i{display:inline-block;width:4px;height:4px;border-radius:50%;background:#8e8e93;margin-left:3px;animation:dfDot 1.2s infinite}#gyxTyping i:nth-child(2){animation-delay:.2s}#gyxTyping i:nth-child(3){animation-delay:.4s}
@keyframes dfDot{0%,100%{opacity:.2}40%{opacity:1}}
.df-it{padding:12px 14px;border-radius:16px;background:#f7f7f9;margin:8px 0;cursor:pointer}
.df-t{font-size:15px;line-height:1.6;display:flex;align-items:center}.df-t span{background:linear-gradient(#1d1d1f,#1d1d1f) no-repeat left 55%/0 1.5px;animation:dfDel 1.4s .6s forwards}.df-t i{display:inline-block;width:2px;height:1.1em;background:#1d9bf0;margin-left:2px;animation:dfCur 1s steps(1) infinite}
@keyframes dfDel{to{background-size:100% 1.5px;color:#aaa}}@keyframes dfCur{50%{opacity:0}}
.df-m{font-size:11.5px;color:#aaa;margin-top:4px}.df-w{display:none;font-size:13px;color:#8e4ec6;margin-top:6px}.df-it.why .df-w{display:block}
`);
X.today(() => { const L = D.list.filter(d => X.day(new Date(d.at)) === X.day()); return { title: '✏️ 草稿箱', rows: L.length ? [{ t: L.length + ' 句', x: 'TA 今天打了又删掉的话', go: 'gyxDraftOpen()' }] : [] }; }, 'gyxDraft');
X.mini({ id: 'gyxDraft', icon: '✏️', title: 'TA 的草稿箱', desc: 'TA 打了又删掉、没发出去的话；聊天里会闪一下「正在输入」，偶尔还会撤回', onOpen: () => window.gyxDraftOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.list = D.list || []; D.cfg = Object.assign({ p: 15, recall: 5 }, D.cfg || {}); setInterval(watch, 2500); })();
