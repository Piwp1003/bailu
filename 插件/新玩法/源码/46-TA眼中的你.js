/* 👀 TA眼中的你：每个月 TA 给你写一页「观察笔记」——这个月的你常在几点出现、总说哪几个词、哪天话特别多、和上个月比哪里变了。写在 TA 的本子上，你能看、能改、能撕 */
if (window.__gyxEye) return; window.__gyxEye = 1;
X.feat('gyxEye', { n: '👀 TA眼中的你', desc: '每个月 TA 写一页关于你的观察笔记' });
const S = X.store('eye');
let D = { notes: [], cfg: { auto: true } };   // [{id, cid, month:'2026-10', text, stat, at}]
X.recapDef('eye', { n: '👀 TA 眼中的你', kind: 'unit', def: 'month', opts: ['half', 'month', 'season'], txt: '多久写一页观察笔记', autoTxt: '一段日子过完，TA 自己把那一页写好' });
const EU = () => X.recap('eye').v || 'month', EUN = () => ({ half: '这半个月', month: '这个月', season: '这个季度' }[EU()] || '这段时间');
const ym = (d = new Date()) => X.unitKey(d, EU());
const H = cid => ((typeof globalChats !== 'undefined' && globalChats[cid]) || []).filter(m => m && m.sender === 'me' && !m.side && m.timestamp);
function stat(cid, month) {
    const L = H(cid).filter(m => ym(new Date(m.timestamp)) === month); if (!L.length) return null;
    const hr = Array(24).fill(0), day = {}, w = {}; let len = 0;
    L.forEach(m => { const d = new Date(m.timestamp); hr[d.getHours()]++; day[X.day(d)] = (day[X.day(d)] || 0) + 1; const t = X.plain(m.text); len += t.length; (t.match(/[一-龥]{2,3}|[\u{1F300}-\u{1FAFF}]|[哈嘿呜嘻]{2,}|[~～]{1,}/gu) || []).forEach(k => { if (!/^(我们|你们|什么|这个|那个|就是|然后|一个|没有|可以|不是|今天|还是|怎么|知道)$/.test(k)) w[k] = (w[k] || 0) + 1; }); });
    const top = Object.entries(w).filter(x => x[1] > 1).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
    const h = hr.indexOf(Math.max(...hr)), bd = Object.entries(day).sort((a, b) => b[1] - a[1])[0];
    return { n: L.length, days: Object.keys(day).length, hour: h, top, big: bd, avg: Math.round(len / L.length) };
}
const when = h => h < 5 ? '深夜' : h < 9 ? '早上' : h < 12 ? '上午' : h < 14 ? '中午' : h < 18 ? '下午' : h < 22 ? '晚上' : '快睡觉的时候';
async function write(c, month, force) {
    const cid = String(c.id); if (!force && D.notes.some(x => x.cid === cid && x.month === month)) return null;
    const st = stat(cid, month); if (!st) return null;
    const prev = D.notes.find(x => x.cid === cid && x.month < month);
    const notes = window.gyxNotesData ? ((window.gyxNotesData().notes || {})[cid] || []).filter(x => x.who === 'me' && x.tier !== 'old').slice(0, 10).map(x => x.text).join('；') : '';
    const facts = `${EUN()}她找你 ${st.days} 天、说了 ${st.n} 句，最常在${when(st.hour)}（${st.hour} 点）出现；话最多的是 ${st.big[0]}（${st.big[1]} 句）；常说「${st.top.join('」「') || '……'}」；平均一句 ${st.avg} 个字。`;
    let text = null;
    if (!X.bailu()) text = await X.ask(`${X.who(c)}\n你在本子上给她写一页「${month} 观察笔记」：你眼中${EUN()}的她。\n${facts}\n${notes ? '你记得的关于她的事：' + notes + '\n' : ''}${prev ? '上个月你写的：' + prev.text.slice(0, 300) + '\n' : ''}最近聊天：\n${X.recent(c, 30)}\n\n要求：用你的口吻，像偷偷写的观察日记；具体到细节（她的小习惯、口头禅、哪天怎么了），和上个月比有什么变化；150~260 字；不要用列表。`);
    if (!text) { const cs = X.cards(['观察', '日记', '情话'], c, 2); text = `${month} · 观察笔记\n${EUN()}你来找我 ${st.days} 天，说了 ${st.n} 句话。你总是在${when(st.hour)}出现，像约好了一样。${st.top.length ? `你老说「${st.top.slice(0, 3).join('」「')}」，我都记住了。` : ''}${st.big[1] > 20 ? `${st.big[0]} 那天你话特别多，一定发生了什么吧。` : ''}${notes ? `还有，我知道你${notes.split('；')[0]}。` : ''}${cs.length ? '\n' + cs.join('\n') : ''}`; }
    const it = { id: 'ey' + Date.now().toString(36), cid, month, text: String(text), stat: st, at: Date.now() };
    D.notes = D.notes.filter(x => !(x.cid === cid && x.month === month)); D.notes.unshift(it); await S.set('d', D); return it;
}
window.gyxEyeWrite = async (cid, month) => { const c = X.char(cid) || X.cur(); if (!c) return null; const r = await write(c, month || ym(), true); window.gyxEyeOpen(c.id); return r; };
window.gyxEyeDel = async id => { const x = D.notes.find(n => n.id === id); D.notes = D.notes.filter(n => n.id !== id); await S.set('d', D); window.gyxEyeOpen(x && x.cid); };
window.gyxEyeEdit = async (id, v) => { const x = D.notes.find(n => n.id === id); if (x) { x.text = v; await S.set('d', D); } };
window.gyxEyeOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), L = D.notes.filter(x => x.cid === cid), st = stat(cid, ym());
    X.panel('gyxEyeOv', '👀 ' + X.esc(X.name(c)) + ' 眼中的你', `<div class="gyx-row">${X.whoSel(cid, 'gyxEyeOpen')}<button class="gyx-btn lite" onclick="this.disabled=true;this.textContent='TA 在写…';gyxEyeWrite('${cid}')">${X.v('让 TA 写这个月的', '偷看这个月的', '请 TA 现在写一页')}</button></div>
        ${st ? `<div class="gyx-tip">${EUN()}到现在：${st.days} 天 · ${st.n} 句 · 常在${when(st.hour)}来${st.top.length ? ' · 常说「' + X.esc(st.top.slice(0, 3).join('」「')) + '」' : ''}</div>` : ''}
        ${L.map(x => `<div class="ey-pg gyx-hand"><div class="ey-m">${x.month}<i onclick="gyxEyeDel('${x.id}')">撕掉</i></div><div contenteditable="true" onblur="gyxEyeEdit('${x.id}',this.innerText)">${X.esc(x.text).replace(/\n/g, '<br>')}</div></div>`).join('') || '<div class="gyx-tip">TA 的本子还是空的。每个月月底 TA 会自己写一页。</div>'}
        <div class="gyx-tip"><label><input type="checkbox" ${X.recap('eye').auto ? 'checked' : ''} onchange="gyxEyeCfg(this.checked)"> 一段日子过完（${X.UNITS[EU()] || '一个月'}一页），TA 自己把那一页写好</label></div>`);
};
window.gyxEyeCfg = v => { D.cfg.auto = v; X.recapSet('eye', 'auto', !!v); S.set('d', D); };
async function tick() { if (!X.on('gyxEye') || !X.recap('eye').auto) return; const last = X.unitPrev(Date.now(), EU()); for (const c of X.chars()) { const it = await write(c, last); if (it && X.on('gyxEye.auto')) X.notify(c, `<b>${X.esc(X.name(c))}</b> ${X.v('写完了上个月的观察笔记', '在本子上写了关于你的一页', '偷偷写了你一整个月')}`, '👀 TA眼中的你', () => window.gyxEyeOpen(c.id)); } }
X.ctx(id => { const x = D.notes.find(n => n.cid === String(id)); return x ? `【你上次写的关于她的观察笔记（${x.month}）】${x.text.slice(0, 220)}` : ''; }, 'gyxEye');
X.action({ key: 'gyx_eye', label: '告诉她你最近观察到她的一个小细节', hint: '你一直在看她', need: c => !!stat(String(c.id), ym()),
    run: async c => { const st = stat(String(c.id), ym()); return (await X.reach(c, `你注意到她${EUN()}总在${when(st.hour)}出现${st.top.length ? '、老说「' + st.top[0] + '」' : ''}。挑一个小细节跟她说，让她知道你一直在看着她`)) ? '说了一个观察到的小细节' : null; } }, 'gyxEye');
X.today(() => ({ title: '👀 TA眼中的你', rows: D.notes.filter(x => X.day(new Date(x.at)) === X.day()).map(x => ({ t: x.month, x: X.esc(X.name(X.char(x.cid))) + ' 写了一页观察笔记', go: `gyxEyeOpen('${x.cid}')` })) }), 'gyxEye');
X.widget('gyxEyeW', { n: 'TA眼中的你', sizes: ['s', 'm'], tap: () => window.gyxEyeOpen(), r: w => { const c = X.cur(), x = c && D.notes.find(n => n.cid === String(c.id)), st = c && stat(String(c.id), ym()); return X.gw(w, '👀', 'TA眼中的你', x ? [x.month, X.esc(x.text.replace(/\s+/g, ' ').slice(0, 40))] : st ? ['这个月 ' + st.n + ' 句', '常在' + when(st.hour) + '来'] : ['TA 在看着你']); } }, 'gyxEye');
X.memArr({ k: 'gyxEye', ico: '👀', n: 'TA眼中的你', d: 'TA 每个月写的观察笔记', arr: () => D.notes, field: 'text', text: x => x.text, meta: x => x.month, save: () => S.set('d', D) }, 'gyxEye');
X.css('gyxEyeCss', `.ey-pg{background:repeating-linear-gradient(#fffdf6 0 27px,#e9e3d3 27px 28px);border-radius:14px;padding:12px 16px;margin:10px 0;font-size:17px;line-height:28px;box-shadow:0 2px 8px rgba(0,0,0,.06)}.ey-pg [contenteditable]{outline:none}.ey-m{font-family:inherit;color:#b08a5a;font-size:14px;display:flex;justify-content:space-between}.ey-m i{font-style:normal;font-size:12px;color:#bbb;cursor:pointer}`);
X.mini({ id: 'gyxEye', icon: '👀', title: 'TA眼中的你', desc: 'TA 每个月给你写一页观察笔记', cat: '回忆', onOpen: () => window.gyxEyeOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.notes = D.notes || []; D.cfg = Object.assign({ auto: true }, D.cfg || {}); if (D.cfg.auto === false && !(JSON.parse(localStorage.getItem('gyxRecap') || '{}').eye || {}).hasOwnProperty('auto')) X.recapSet('eye', 'auto', false); setTimeout(tick, 40000); setInterval(tick, 3600000); })();
