/* 🫶 气泡表情回应：长按 / 右键任何一条消息，给它贴一个表情（❤️😂🥺……），表情贴在气泡下面；TA 看得到你给 TA 哪句话贴了什么。TA 也会偶尔给你的某句话贴一个——只在真被戳到的时候，一轮最多一个，大多数时候不贴 */
if (window.__gyxReact) return; window.__gyxReact = 1;
X.feat('gyxReact', { n: '🫶 气泡表情回应', desc: '长按消息贴表情；TA 看得到，也会偶尔给你的话贴一个' });
const S = X.store('react');
let D = { cfg: { quick: ['❤️', '😂', '🥺', '🥰', '👍', '😮', '😭', '🙏'], ta: 'some' }, log: [] };   // ta: off / some / often；log: TA 贴的记录 [{cid, e, text, at}]
const H = sid => (typeof globalChats !== 'undefined' && globalChats[sid]) || [];
const sidNow = () => (typeof currentChatSessionId !== 'undefined' && currentChatSessionId != null) ? String(currentChatSessionId) : '';
const isMe = w => w === 'me';
const nameOf = w => isMe(w) ? '你' : X.name(X.char(w));
function toggle(sid, i, who, e) {
    const m = H(sid)[i]; if (!m || m.sender === 'system' || !e) return false;
    m.reacts = Array.isArray(m.reacts) ? m.reacts : [];
    const k = m.reacts.findIndex(r => String(r.who) === String(who) && r.e === e);
    if (k >= 0) m.reacts.splice(k, 1);
    else { if (!isMe(who)) m.reacts = m.reacts.filter(r => String(r.who) !== String(who)); m.reacts.push({ who, e, at: Date.now() }); }
    if (!m.reacts.length) delete m.reacts;
    try { saveAllData(); } catch (er) {} paint(); return k < 0;
}
window.gyxReactToggle = (i, e) => { const on = toggle(sidNow(), +i, 'me', e); const menu = document.getElementById('chatContextMenu'); if (menu) menu.style.display = 'none'; return on; };
window.gyxReactCustom = async i => {
    const menu = document.getElementById('chatContextMenu'); if (menu) menu.style.display = 'none';
    const ask = typeof appPrompt === 'function' ? appPrompt : (m, d) => Promise.resolve(prompt(m, d));
    const v = String((await ask('贴什么表情？（一个 emoji）', '🫶')) || '').trim(); if (!v) return;
    const e = Array.from(v).slice(0, 2).join(''); toggle(sidNow(), +i, 'me', e);
};
// TA 贴：贴在 TA 这次回复之前、你最后说的那句上
function taReact(c, e, sid) {
    if (!c || !e) return false;
    sid = sid || String(c.id); const L = H(sid);
    let i = L.length - 1; while (i >= 0 && L[i] && L[i].sender !== 'me') i--;
    if (i < 0) return false;
    const m = L[i]; if ((m.reacts || []).some(r => String(r.who) === String(c.id))) return false;
    toggle(sid, i, c.id, e);
    D.log.unshift({ cid: String(c.id), sid, e, text: X.plain(m.text).slice(0, 60), at: Date.now() }); D.log = D.log.slice(0, 200); S.set('d', D);
    return true;
}
window.gyxReactTa = (cid, e) => taReact(X.char(cid) || X.cur(), e);
// ---------- 模型回复里的 [贴表情:🥰] ----------
const TAG = /\[\s*贴表情\s*[:：]\s*([^\]\s]{1,8})\s*\]/g;
const lastTurn = {};
function hooks() {
    const ex = window.gyChatActsExtract;
    if (typeof ex === 'function' && !ex.__gyxReact) {
        const w = function (text, char, isGroup) {
            if (typeof text === 'string' && char && /\[\s*贴表情/.test(text)) {
                let got = null; text = text.replace(TAG, (m0, e) => { if (!got) got = e; return ''; }).replace(/[ \t]{2,}/g, ' ').trim();
                arguments[0] = text;
                const k = String(char.id);
                if (got && X.on('gyxReact') && D.cfg.ta !== 'off' && Date.now() - (lastTurn[k] || 0) > 20000) { lastTurn[k] = Date.now(); const sid = isGroup ? sidNow() : k; setTimeout(() => taReact(char, Array.from(got).slice(0, 2).join(''), sid), 300); }
            }
            return ex.apply(this, arguments);
        };
        Object.keys(ex).forEach(k => { try { w[k] = ex[k]; } catch (e) {} }); w.__gyxReact = 1; window.gyChatActsExtract = w;
    }
    const st = window.stripLeftoverMarkers;
    if (typeof st === 'function' && !st.__gyxReact) {
        const w = function (t) { if (typeof t === 'string' && t.indexOf('贴表情') >= 0) arguments[0] = t.replace(TAG, '').replace(/[ \t]{2,}/g, ' ').trim(); return st.apply(this, arguments); };
        Object.keys(st).forEach(k => { try { w[k] = st[k]; } catch (e) {} }); w.__gyxReact = 1; window.stripLeftoverMarkers = w; try { stripLeftoverMarkers = w; } catch (e) {}
    }
    const cm = window.showChatContextMenu;
    if (typeof cm === 'function' && !cm.__gyxReact) {
        const w = function (e, idx) {
            const x = cm.apply(this, arguments);
            try {
                if (!X.on('gyxReact')) return x;
                const m = H(sidNow())[idx], menu = document.getElementById('chatContextMenu');
                if (menu && m && m.sender !== 'system' && !menu.querySelector('.rx-pick')) {
                    const mine = (m.reacts || []).filter(r => isMe(r.who)).map(r => r.e);
                    const d = document.createElement('div'); d.className = 'rx-pick';
                    d.innerHTML = D.cfg.quick.map(q => `<button class="${mine.includes(q) ? 'on' : ''}" onclick="event.stopPropagation();gyxReactToggle(${idx},'${q}')">${q}</button>`).join('') + `<button onclick="event.stopPropagation();gyxReactCustom(${idx})">＋</button>`;
                    menu.insertBefore(d, menu.firstChild);
                }
            } catch (er) {}
            return x;
        };
        Object.keys(cm).forEach(k => { try { w[k] = cm[k]; } catch (e) {} }); w.__gyxReact = 1; window.showChatContextMenu = w; try { showChatContextMenu = w; } catch (er) {}
    }
    const rr = window.renderChatMessages;
    if (typeof rr === 'function' && !rr.__gyxReact) { const w = function () { const x = rr.apply(this, arguments); try { paint(); } catch (e) {} return x; }; Object.keys(rr).forEach(k => { try { w[k] = rr[k]; } catch (e) {} }); w.__gyxReact = 1; window.renderChatMessages = w; try { renderChatMessages = w; } catch (e) {} }
}
// ---------- 气泡下面画出来 ----------
function paint() {
    const area = document.getElementById('chatMessagesArea'); if (!area) return; const sid = sidNow(), L = H(sid);
    area.querySelectorAll('.rx-row').forEach(n => n.remove());
    if (!X.on('gyxReact')) return;
    area.querySelectorAll('.chat-bubble').forEach(b => {
        const mm = /showChatContextMenu\(event,\s*(\d+)\)/.exec(b.getAttribute('oncontextmenu') || ''); if (!mm) return;
        const i = +mm[1], m = L[i]; if (!m || !(m.reacts || []).length) return;
        const by = {}; m.reacts.forEach(r => { (by[r.e] = by[r.e] || []).push(r.who); });
        const row = document.createElement('div'); row.className = 'rx-row' + (m.sender === 'me' ? ' me' : '');
        row.innerHTML = Object.keys(by).map(e => { const ws = by[e], mine = ws.some(isMe); return `<span class="rx-chip${mine ? ' mine' : ''}" title="${X.esc(ws.map(nameOf).join('、'))}" onclick="${mine ? `gyxReactToggle(${i},'${e}')` : ''}">${e}${ws.length > 1 ? `<b>${ws.length}</b>` : (!isMe(ws[0]) ? `<i>${X.esc(nameOf(ws[0]).slice(0, 4))}</i>` : '')}</span>`; }).join('');
        b.after(row);
    });
}
// ---------- 告诉 TA ----------
const told = {};
X.ctx(id => {
    const sid = String(id), L = H(sid), out = [];
    for (let i = Math.max(0, L.length - 30); i < L.length; i++) { const m = L[i]; if (!m || String(m.sender) !== sid) continue; (m.reacts || []).filter(r => isMe(r.who) && Date.now() - r.at < 864e5).forEach(r => out.push(`「${X.plain(m.text).slice(0, 30)}」→ ${r.e}`)); }
    let s = out.length ? `【她给你的话贴的表情（最近一天）】${out.slice(-5).join('；')}。这是她看完你那句话的反应，不用逐个回应，心里有数就行。` : '';
    if (!X.bailu() && D.cfg.ta !== 'off') s += `\n【贴表情】只在私聊 / 群聊回复里可以用：如果她刚才某句话真的戳到你了（好笑、心动、感动、赞同、惊讶），可以在你某条回复的最末尾加上 [贴表情:🥰]（换成一个最贴切的普通 emoji），意思是给她那句话贴了个表情。${D.cfg.ta === 'often' ? '想贴就贴，但一轮最多一个。' : '大多数时候不要贴，一轮最多一个，别每轮都贴、别为了刷存在感贴。'}写推文、日记、信件时不要用。`;
    return s.trim();
}, 'gyxReact');
// 白露没有模型：TA 看完你的消息，偶尔按你说的话贴一个
const KW = [[/哈哈|笑死|hhh|233|好好笑/, ['😂', '🤣']], [/想你|爱你|喜欢你|亲亲|抱抱|么么/, ['🥰', '❤️', '🫶']], [/累|难过|哭|委屈|烦|不开心|emo/, ['🥺', '🫂']], [/好吃|吃了|饭/, ['😋']], [/真的吗|居然|竟然|天哪/, ['😮']], [/谢谢|辛苦/, ['🙏', '❤️']]];
const seenLen = {};
function bailuWatch() {
    if (!X.bailu() || !X.on('gyxReact') || D.cfg.ta === 'off') return;
    X.chars().forEach(c => {
        const sid = String(c.id), L = H(sid), n = L.length; if (seenLen[sid] == null) { seenLen[sid] = n; return; } if (n <= seenLen[sid]) { seenLen[sid] = n; return; }
        const fresh = L.slice(seenLen[sid]); seenLen[sid] = n;
        if (!fresh.some(m => String(m.sender) === sid)) return;
        let i = L.length - 1; while (i >= 0 && L[i].sender !== 'me') i--; if (i < 0) return;
        const t = X.plain(L[i].text); const hit = KW.find(([re]) => re.test(t));
        const p = (D.cfg.ta === 'often' ? 0.35 : 0.12) * (hit ? 2 : 1);
        if (Math.random() < p) taReact(c, hit ? X.pick(hit[1]) : X.pick(['❤️', '🥰', '👍']), sid);
    });
}
// ---------- 面板 ----------
function stats(cid) {
    const L = H(String(cid)); let me = 0, ta = 0; const top = {};
    L.forEach(m => (m.reacts || []).forEach(r => { if (isMe(r.who)) me++; else ta++; top[r.e] = (top[r.e] || 0) + 1; }));
    return { me, ta, top: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5) };
}
window.gyxReactCfg = async (k, v) => { if (k === 'quick') v = Array.from(String(v).replace(/[\s,，]/g, '')).reduce((a, ch) => { if (/\p{Extended_Pictographic}/u.test(ch) || !a.length) a.push(ch); else a[a.length - 1] += ch; return a; }, []).slice(0, 10); D.cfg[k] = v; await S.set('d', D); };
window.gyxReactData = () => D;
window.gyxReactOpen = function (who) {
    const c = X.char(who) || X.cur(); const st = c ? stats(c.id) : { me: 0, ta: 0, top: [] };
    const L = c ? H(String(c.id)).map((m, i) => ({ m, i })).filter(x => (x.m.reacts || []).length).slice(-30).reverse() : [];
    X.panel('gyxRxOv', '🫶 气泡表情回应', `${c ? `<div class="gyx-row">${X.whoSel(c.id, 'gyxReactOpen')}</div>` : ''}
        <div class="gyx-tip">${X.v('长按 / 右键任何一条消息，最上面一排就是表情。', '喜欢 TA 哪句话，就给它贴一个。', '贴了的 TA 看得到。')}再点一下自己贴的就是撤回。</div>
        <div class="rx-stat"><div><b>${st.me}</b><span>你贴的</span></div><div><b>${st.ta}</b><span>TA 贴的</span></div><div><b>${st.top.map(x => x[0]).join('') || '—'}</b><span>最常用</span></div></div>
        ${L.map(x => `<div class="rx-it"><span>${x.m.sender === 'me' ? '你' : X.esc(X.name(c))}：${X.esc(X.plain(x.m.text).slice(0, 40))}</span><em>${x.m.reacts.map(r => r.e + (isMe(r.who) ? '' : '·' + X.esc(nameOf(r.who)))).join(' ')}</em></div>`).join('') || '<div class="gyx-tip">还没有贴过表情</div>'}
        <div class="gyx-card"><div class="gyx-tip">长按菜单里那一排（直接改，最多 10 个）</div><input class="gyx-in" value="${X.esc(D.cfg.quick.join(' '))}" onchange="gyxReactCfg('quick',this.value)">
        <div class="gyx-row gyx-tip">TA 给你贴表情：${[['off', '不贴'], ['some', '偶尔'], ['often', '常常']].map(([k, n]) => `<span class="gyx-chip${D.cfg.ta === k ? ' on' : ''}" onclick="gyxReactCfg('ta','${k}').then(()=>gyxReactOpen('${c ? c.id : ''}'))">${n}</span>`).join('')}</div></div>`);
};
X.action({ key: 'gyx_react', label: '给她刚才说的那句话贴个表情', hint: '不用回一大段，贴一个就够了', need: c => { const L = H(String(c.id)), m = L[L.length - 1]; return D.cfg.ta !== 'off' && !!m && m.sender === 'me' && !(m.reacts || []).some(r => String(r.who) === String(c.id)); },
    run: async c => { const L = H(String(c.id)), t = X.plain((L[L.length - 1] || {}).text); const hit = KW.find(([re]) => re.test(t)); const e = hit ? X.pick(hit[1]) : X.pick(['❤️', '🥰', '👍', '🫶']); return taReact(c, e) ? '给你那句话贴了 ' + e : null; } }, 'gyxReact');
X.today(() => { const td = D.log.filter(x => X.day(new Date(x.at)) === X.day()); let me = 0; X.chars().forEach(c => H(String(c.id)).forEach(m => (m.reacts || []).forEach(r => { if (isMe(r.who) && X.day(new Date(r.at)) === X.day()) me++; }))); if (!td.length && !me) return null; return { title: '🫶 表情回应', rows: [{ t: '今天', x: `你贴了 ${me} 个 · TA 贴了 ${td.length} 个`, go: 'gyxReactOpen()' }].concat(td.slice(0, 2).map(x => ({ t: X.name(X.char(x.cid)), x: `给「${X.esc(x.text.slice(0, 16))}」贴了 ${x.e}`, go: `gyxReactOpen('${x.cid}')` }))) }; }, 'gyxReact');
X.widget('gyxReactW', { n: '表情回应', sizes: ['s', 'm'], tap: () => window.gyxReactOpen(), r: w => { const x = D.log[0]; return X.gw(w, x ? x.e : '🫶', '表情回应', x ? [X.esc(X.name(X.char(x.cid))) + ' 贴了 ' + x.e, '「' + X.esc(x.text.slice(0, 14)) + '」'] : ['长按消息贴表情']); } }, 'gyxReact');
X.mem({ k: 'gyxReact', ico: '🫶', n: '贴过的表情', d: '谁给哪句话贴了什么（改＝换表情）', items: c => { const out = []; H(String(c.id)).forEach(m => (m.reacts || []).forEach(r => out.push({ m, r }))); return out.reverse(); }, text: x => x.r.e, meta: x => `${nameOf(x.r.who)} → 「${X.plain(x.m.text).slice(0, 24)}」 · ${new Date(x.r.at).toLocaleString()}`, edit: (x, v) => { const e = Array.from(String(v).trim()).slice(0, 2).join(''); if (e) x.r.e = e; }, del: (c, i) => { const out = []; H(String(c.id)).forEach(m => (m.reacts || []).forEach(r => out.push({ m, r }))); const it = out.reverse()[i]; if (it) { it.m.reacts = it.m.reacts.filter(r => r !== it.r); if (!it.m.reacts.length) delete it.m.reacts; } }, save: () => { try { saveAllData(); } catch (e) {} paint(); } }, 'gyxReact');
X.css('gyxRxCss', `.rx-pick{display:flex;gap:2px;padding:4px 4px 6px;border-bottom:1px solid rgba(0,0,0,.06);margin-bottom:2px;flex-wrap:wrap;max-width:260px}.rx-pick button{border:none;background:transparent;font-size:20px;line-height:1;padding:5px;border-radius:10px;cursor:pointer}.rx-pick button:hover,.rx-pick button.on{background:rgba(29,155,240,.12)}
.rx-row{display:flex;flex-wrap:wrap;gap:4px;margin:3px 2px 0}.rx-row.me{justify-content:flex-end}.rx-chip{display:inline-flex;align-items:center;gap:3px;font-size:14px;line-height:1;padding:3px 7px;border-radius:12px;background:#fff;border:1px solid #e6e8eb;box-shadow:0 1px 3px rgba(0,0,0,.06);cursor:default}.rx-chip.mine{border-color:#9fd2fb;background:#eef7ff;cursor:pointer}.rx-chip b{font-size:11px;color:#536471}.rx-chip i{font-style:normal;font-size:10.5px;color:#8b98a5}
.rx-stat{display:flex;gap:8px;margin:8px 0}.rx-stat>div{flex:1;text-align:center;padding:10px 4px;border-radius:14px;background:#f6f7f9}.rx-stat b{display:block;font-size:18px}.rx-stat span{font-size:11.5px;color:#8b98a5}
.rx-it{display:flex;gap:8px;justify-content:space-between;padding:7px 2px;border-bottom:1px solid #f2f2f4;font-size:13px}.rx-it em{font-style:normal;white-space:nowrap}`);
X.mini({ id: 'gyxReact', icon: '🫶', title: '气泡表情回应', desc: '长按消息贴表情', cat: '陪伴', onOpen: () => window.gyxReactOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.cfg = Object.assign({ quick: ['❤️', '😂', '🥺', '🥰', '👍', '😮', '😭', '🙏'], ta: 'some' }, D.cfg || {}); D.log = D.log || []; hooks(); setInterval(hooks, 1500); setInterval(bailuWatch, 1500); setTimeout(paint, 800); })();
