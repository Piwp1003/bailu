/* ⏳ 时光机：选一个过去的日子，和「那时候的 TA」聊天——TA 只知道那天以前的事，不知道后来发生了什么；也能往前开，去见一年后、五年后的 TA（TA 会照你们现在的样子想象以后的日子）。聊的内容单独存，不会混进现在 TA 的记忆 */
if (window.__gyxTime) return; window.__gyxTime = 1;
X.feat('gyxTime', { n: '⏳ 时光机', desc: '和过去某一天的 TA、或者几年后的 TA 聊天' });
const S = X.store('time');
let D = { ses: [] };   // [{id, cid, date(ms), msgs:[{who:'me'|'ta', t, at}], at, note}]
const H = cid => ((typeof globalChats !== 'undefined' && globalChats[cid]) || []).filter(m => m && m.sender !== 'system' && !m.side && m.timestamp);
const fmt = t => { const d = new Date(t); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; };
const ago = t => { if (t > Date.now() + 864e5) { const y = Math.round((t - Date.now()) / 365 / 864e5); return y + ' 年后'; } const n = Math.round((Date.now() - t) / 864e5); return n < 1 ? '今天' : n < 31 ? n + ' 天前' : n < 365 ? Math.round(n / 30) + ' 个月前' : (n / 365).toFixed(1).replace('.0', '') + ' 年前'; };
let CUR = null;
function before(c, t) {
    const cid = String(c.id), old = H(cid).filter(m => m.timestamp <= t);
    const sum = String(c.chatSummary || '').split('\n').filter(l => { const m = l.match(/^\[([^\]]+)\]/); const d = m ? Date.parse(m[1].replace(/\//g, '-').replace(/[上下]午/, '')) : NaN; return !isNaN(d) && d <= t; }).slice(-12).join('\n');
    return { old, sum, chat: old.slice(-30).map(m => (m.sender === 'me' ? '她：' : '你：') + X.plain(m.text).slice(0, 140)).join('\n') };
}
async function reply(c, ses) {
    const b = before(c, ses.date);
    if (X.bailu()) {   // 白露：从那天以前 TA 自己说过的话里挑
        const mine = b.old.filter(m => String(m.sender) === String(c.id)).map(m => X.plain(m.text)).filter(t => t.length > 3);
        return mine.length ? X.pick(mine.slice(-80)) : (X.cards(['时光机', '回忆'], c, 1)[0] || '……那时候的我，还不太会说话呢。');
    }
    const talk = ses.msgs.slice(-16).map(m => (m.who === 'me' ? '她：' : '你：') + m.t).join('\n');
    if (ses.date > Date.now() + 864e5) {   // 🔮 未来的 TA
        if (X.bailu()) return X.pick(X.cards(['未来', '情话', '晚安'], c, 3).concat(['那时候的你，现在过得很好。别担心。', '我还在。一直都在。', '你从过去来的吧？那时候的你好小一只。', '以后的日子，比你想的还要好。']));
        const yrs = Math.max(1, Math.round((ses.date - Date.now()) / 365 / 864e5)), sum = String(c.chatSummary || '').split('\n').slice(-10).join('\n');
        return (await X.ask(`${X.who(c)}\n现在是 ${yrs} 年以后（${fmt(ses.date)}）。你是 ${yrs} 年后的你——照你们现在的关系和你的性格，想象这几年你们一起过成了什么样（细节可以温柔地想象，但别编太戏剧化的大事）。\n她是从「现在」穿越过来见你的，你记得她那时候的样子。\n你们现在（也就是你的过去）的事：\n${sum || '（刚认识不久）'}\n最近的聊天：\n${X.recent(c, 12)}\n\n她说：\n${talk}\n\n用 ${yrs} 年后的你的口吻回她一条（可以怀念「那时候」、可以剧透一点点未来但别全说、可以心疼过去的她）。只回你说的话。`)) || '……你来了啊。';
    }
    return (await X.ask(`${X.who(c)}\n现在是 ${fmt(ses.date)}。你只知道这天以前发生的事，之后的一切你都不知道（不要剧透、也不要假装知道）。\n她说她是从「以后」来的，来看看那时候的你。\n\n你那时候的记忆：\n${b.sum || '（还没什么）'}\n那几天的聊天：\n${b.chat || '（你们刚认识）'}\n\n她来找你说的话：\n${talk}\n\n用那时候的你说话的样子、那时候你们的关系远近，回她一条（只回你说的话）。`)) || '……（那时候的 TA 没反应过来）';
}
window.gyxTimeGo = async (cid, t) => { const c = X.char(cid); if (!c) return; CUR = { id: 'tm' + Date.now().toString(36), cid: String(cid), date: +t, msgs: [], at: Date.now() }; D.ses.unshift(CUR); await S.set('d', D); window.gyxTimeOpen(cid); };
window.gyxTimeSend = async () => {
    const inp = document.getElementById('gyxTmIn'); const t = (inp && inp.value || '').trim(); if (!t || !CUR) return; inp.value = '';
    const c = X.char(CUR.cid); CUR.msgs.push({ who: 'me', t, at: Date.now() }); paintChat();
    const r = await reply(c, CUR); CUR.msgs.push({ who: 'ta', t: X.plain(r), at: Date.now() }); await S.set('d', D); paintChat();
};
window.gyxTimeResume = id => { CUR = D.ses.find(x => x.id === id) || null; if (CUR) window.gyxTimeOpen(CUR.cid); };
window.gyxTimeDel = async id => { D.ses = D.ses.filter(x => x.id !== id); if (CUR && CUR.id === id) CUR = null; await S.set('d', D); window.gyxTimeOpen(); };
window.gyxTimeBack = () => { CUR = null; window.gyxTimeOpen(); };
function paintChat() { const b = document.getElementById('gyxTmChat'); if (!b || !CUR) return; const c = X.char(CUR.cid); b.innerHTML = CUR.msgs.map(m => `<div class="tm-m ${m.who}"><span>${X.esc(m.t)}</span></div>`).join('') || `<div class="gyx-tip" style="text-align:center">${X.v('那时候的 TA 还不知道你会来。', '你从以后来，TA 还什么都不知道。', '说点什么吧，别吓到 TA。')}</div>`; b.scrollTop = 1e9; }
window.gyxTimeOpen = function (who) {
    const c = X.char(who || (CUR && CUR.cid)) || X.cur(); if (!c) return; const cid = String(c.id);
    if (CUR && CUR.cid === cid) {
        X.panel('gyxTmOv', `${CUR.date > Date.now() ? '🔮' : '⏳'} ${fmt(CUR.date)}的 ${X.esc(X.name(c))}`, `<div class="gyx-tip">${ago(CUR.date)}的 TA。这里聊的不会进现在 TA 的记忆。<a style="float:right;cursor:pointer" onclick="gyxTimeBack()">← 换一天</a></div><div id="gyxTmChat" class="tm-chat"></div><div class="gyx-row"><input id="gyxTmIn" class="gyx-in" style="flex:1" placeholder="对那时候的 TA 说…" onkeydown="if(event.key==='Enter')gyxTimeSend()"><button class="gyx-btn" onclick="gyxTimeSend()">发送</button></div>`, CUR.date > Date.now() ? 'tm fu' : 'tm');
        paintChat(); return;
    }
    const all = H(cid), first = all.length ? all[0].timestamp : Date.now(), days = [];
    [1, 7, 30, 90, 180, 365].forEach(n => { const t = Date.now() - n * 864e5; if (t > first) days.push(t); }); if (all.length) days.push(first + 36e5);
    X.panel('gyxTmOv', '⏳ 时光机', `<div class="gyx-row">${X.whoSel(cid, 'gyxTimeOpen')}</div><div class="gyx-tip">选一天，去见那时候的 TA。TA 只知道那天以前的事。</div>
        <div class="gyx-row">${days.map(t => `<span class="gyx-chip" onclick="gyxTimeGo('${cid}',${t})">${t === first + 36e5 ? '刚认识那天' : ago(t)}</span>`).join('') || '<span class="gyx-tip">你们还没聊过，没有过去可以去。</span>'}</div>
        <div class="tm-h">🔮 往前开：去见以后的 TA</div><div class="gyx-row">${[1, 3, 5, 10].map(y => `<span class="gyx-chip tm-fu" onclick="gyxTimeGo('${cid}',${Date.now() + y * 365 * 864e5})">${y} 年后</span>`).join('')}</div>
        <div class="gyx-row"><input type="date" id="gyxTmD" class="gyx-who" value="${X.day(new Date(Math.max(first, Date.now() - 30 * 864e5)))}"><button class="gyx-btn" onclick="gyxTimeGo('${cid}',new Date(document.getElementById('gyxTmD').value+'T23:59').getTime())">去这天</button></div>
        <div class="tm-h">去过的</div>${D.ses.filter(x => x.cid === cid).slice(0, 30).map(x => `<div class="tm-it" onclick="gyxTimeResume('${x.id}')"><b>${fmt(x.date)}</b><em>${X.esc((x.msgs.find(m => m.who === 'ta') || {}).t || '还没说话')}</em><i onclick="event.stopPropagation();gyxTimeDel('${x.id}')">删</i></div>`).join('') || '<div class="gyx-tip">还没去过</div>'}`);
};
X.action({ key: 'gyx_time', label: '翻到以前自己说过的话，跟她聊聊那时候', hint: '那时候的我们', need: c => H(String(c.id)).filter(m => String(m.sender) === String(c.id) && Date.now() - m.timestamp > 20 * 864e5).length > 3,
    run: async c => { const L = H(String(c.id)).filter(m => String(m.sender) === String(c.id) && Date.now() - m.timestamp > 20 * 864e5); const m = X.pick(L); return (await X.reach(c, `你翻到${ago(m.timestamp)}自己说过的一句话：「${X.plain(m.text).slice(0, 60)}」。跟她聊聊那时候的你们，和现在比有什么不一样`)) ? '翻到了以前的自己' : null; } }, 'gyxTime');
X.today(() => { const rows = []; X.chars().forEach(c => { const y = H(String(c.id)).filter(m => { const d = new Date(m.timestamp), n = new Date(); return d.getMonth() === n.getMonth() && d.getDate() === n.getDate() && d.getFullYear() < n.getFullYear(); }); if (y.length) rows.push({ t: '往年今天', x: `${X.esc(X.name(c))}：${X.esc(X.plain(y[0].text).slice(0, 24))}`, go: `gyxTimeGo('${c.id}',${y[y.length - 1].timestamp})` }); }); return { title: '⏳ 时光机', rows }; }, 'gyxTime');
X.widget('gyxTimeW', { n: '时光机', sizes: ['s', 'm'], tap: () => window.gyxTimeOpen(), r: w => { const c = X.cur(); const L = c ? H(String(c.id)).filter(m => String(m.sender) === String(c.id) && Date.now() - m.timestamp > 7 * 864e5) : []; const m = L.length ? L[Math.floor(Date.now() / 36e5) % L.length] : null; return X.gw(w, '⏳', '时光机', m ? [ago(m.timestamp), X.esc(X.plain(m.text).slice(0, 30))] : ['去见过去的 TA']); } }, 'gyxTime');
X.memArr({ k: 'gyxTime', ico: '⏳', n: '时光机', d: '和过去的 TA 聊过的（不进现在 TA 的记忆）', arr: () => D.ses, text: x => x.note || x.msgs.map(m => (m.who === 'me' ? '我：' : 'TA：') + m.t).join(' / ').slice(0, 200), edit: (x, v) => { x.note = v; }, meta: x => '去了 ' + fmt(x.date), save: () => S.set('d', D) }, 'gyxTime');
X.css('gyxTmCss', `.gyx-ov.tm .gyx-box{background:linear-gradient(#f6efe2,#efe4cf)}.gyx-ov.tm .gyx-hd{background:rgba(246,239,226,.92)}.tm-chat{height:52vh;overflow:auto;padding:8px 2px;filter:sepia(.25)}.tm-m{display:flex;margin:6px 0}.tm-m span{max-width:78%;padding:8px 12px;border-radius:16px;background:#fff;font-size:14px;line-height:1.6}.tm-m.me{justify-content:flex-end}.tm-m.me span{background:#d9c7a3}.tm-h{font-weight:700;margin:14px 0 4px}.gyx-chip.tm-fu{background:linear-gradient(135deg,#d9e8ff,#efe3ff)}.gyx-ov.tm.fu .gyx-box{background:linear-gradient(#eef3ff,#f3eaff)}.gyx-ov.tm.fu .gyx-hd{background:rgba(238,243,255,.92)}.gyx-ov.tm.fu .tm-chat{filter:none}.gyx-ov.tm.fu .tm-m.me span{background:#c9d7ff}.tm-it{display:flex;flex-direction:column;padding:8px 4px;border-bottom:1px solid #f0f0f0;cursor:pointer;position:relative}.tm-it em{font-style:normal;font-size:12px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tm-it i{position:absolute;right:4px;top:9px;font-style:normal;font-size:11px;color:#aaa}`);
X.mini({ id: 'gyxTime', icon: '⏳', title: '时光机', desc: '去见过去的 TA，或者几年后的 TA', cat: '回忆', onOpen: () => window.gyxTimeOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.ses = D.ses || []; })();
