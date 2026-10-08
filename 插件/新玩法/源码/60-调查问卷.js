/* 📋 调查问卷：一份正经又不正经的问卷——单选、多选、打分、填空都有。可以发给 TA 填（TA 按人设一题题认真答），也可以 TA 发给你填、看完写评语，或者你们俩一起填同一份、对比哪些想的一样。内置几份，也能自己出 */
if (window.__gyxSurvey) return; window.__gyxSurvey = 1;
X.feat('gyxSurvey', { n: '📋 调查问卷', desc: '发问卷给 TA 填、TA 发给你填、两个人一起填对比答案，能自己出题' });
const S = X.store('survey');
// 题目：{q, t:'one'|'many'|'rate'|'text', o:[选项]}
const BUILT = [
    { id: 'sv_love', title: '💗 恋爱情况调查', qs: [{ q: '你觉得我们现在是什么关系？', t: 'one', o: ['恋人', '暧昧', '最好的朋友', '说不清'] }, { q: '和我聊天时的心情（1~5）', t: 'rate' }, { q: '最喜欢我哪一点？', t: 'many', o: ['声音', '性格', '会照顾人', '好看', '说话方式', '全部'] }, { q: '吵架了谁先道歉？', t: 'one', o: ['我', '你', '谁对谁道歉', '不用道歉抱一下就好'] }, { q: '想和我一起去的地方', t: 'text' }, { q: '对我们未来的期待（1~5）', t: 'rate' }, { q: '最想对我说但没说出口的一句话', t: 'text' }] },
    { id: 'sv_know', title: '🧩 你了解我吗', qs: [{ q: '我最喜欢的季节', t: 'one', o: ['春天', '夏天', '秋天', '冬天'] }, { q: '我最怕的东西', t: 'text' }, { q: '我难过的时候最需要', t: 'one', o: ['有人陪着', '一个人待着', '吃好吃的', '睡一觉'] }, { q: '我的雷点', t: 'many', o: ['不回消息', '敷衍', '说谎', '迟到', '被比较', '冷暴力'] }, { q: '我早起还是熬夜', t: 'one', o: ['早起', '熬夜', '看心情', '熬夜然后早起'] }, { q: '用一个词形容我', t: 'text' }] },
    { id: 'sv_life', title: '🌱 生活小调查', qs: [{ q: '理想的周末', t: 'one', o: ['在家躺着', '出门逛逛', '和喜欢的人待着', '学点新东西'] }, { q: '最近的睡眠质量（1~5）', t: 'rate' }, { q: '最近让你开心的小事', t: 'text' }, { q: '喜欢的食物类型', t: 'many', o: ['甜', '辣', '酸', '清淡', '炸物', '火锅'] }, { q: '现在最想要的东西', t: 'text' }, { q: '对现在生活的满意度（1~5）', t: 'rate' }] },
    { id: 'sv_if', title: '🌀 如果问卷', qs: [{ q: '如果明天世界末日，今晚做什么？', t: 'text' }, { q: '如果能有一种超能力', t: 'one', o: ['读心', '瞬移', '时间暂停', '隐身'] }, { q: '如果我们没遇见，你现在会在干嘛？', t: 'text' }, { q: '如果只能带三样东西去荒岛', t: 'text' }, { q: '如果可以回到过去某一天', t: 'one', o: ['第一次见面那天', '小时候', '某个遗憾的那天', '不想回去，现在最好'] }] }
];
let D = { mine: [], res: [] };   // mine = 自己出的问卷；res = [{id, cid, sv, title, mode:'ta'|'me'|'both', ans:{me:[], ta:[]}, comment, at}]
const all = () => BUILT.concat(D.mine);
const svOf = id => all().find(x => x.id === id);
function fmt(q, a) { if (a == null || a === '') return '（没答）'; if (q.t === 'rate') return '★'.repeat(+a || 0) + '☆'.repeat(5 - (+a || 0)); return Array.isArray(a) ? a.join('、') : String(a); }
const same = (q, a, b) => q.t === 'many' ? JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort()) : q.t === 'rate' ? Math.abs((+a || 0) - (+b || 0)) <= 1 : String(a || '').trim() === String(b || '').trim();
async function taFill(c, sv) {
    if (!X.bailu()) {
        const j = X.json(await X.ask(`${X.who(c)}\n她给你发了一份问卷《${sv.title}》，认真按你自己的想法填（站在你的角度，对象是她；你不知道的就照你的性格猜）。\n${sv.qs.map((q, i) => `${i}. ${q.q}（${q.t === 'one' ? '单选：' + q.o.join(' / ') : q.t === 'many' ? '多选：' + q.o.join(' / ') : q.t === 'rate' ? '打分 1~5' : '填空，20 字内'}）`).join('\n')}\n\n只输出 JSON：{"ans":[每题的答案：单选写选项原文，多选写数组，打分写数字，填空写文字],"say":"交卷时说的一句话"}`));
        if (j && Array.isArray(j.ans)) return { ans: sv.qs.map((q, i) => { const a = j.ans[i]; if (q.t === 'one') return q.o.includes(a) ? a : q.o[0]; if (q.t === 'many') return (Array.isArray(a) ? a : [a]).filter(x => q.o.includes(x)); if (q.t === 'rate') return Math.max(1, Math.min(5, Math.round(+a || 4))); return X.plain(a || '').slice(0, 60); }), say: X.plain(j.say || '') };
    }
    const cs = X.cards(['问卷', '聊天'], c, sv.qs.length + 1);
    return { ans: sv.qs.map((q, i) => q.t === 'one' ? X.pick(q.o) : q.t === 'many' ? q.o.filter(() => Math.random() < .4).concat([X.pick(q.o)]).filter((v, k, a) => a.indexOf(v) === k) : q.t === 'rate' ? 3 + Math.floor(Math.random() * 3) : (cs[i] || '……不告诉你').slice(0, 40)), say: cs[cs.length - 1] || '填好了，不许笑我。' };
}
async function comment(c, sv, r) {
    const rows = sv.qs.map((q, i) => `${q.q}：她答「${fmt(q, r.ans.me[i])}」${r.mode === 'both' ? '，你答「' + fmt(q, r.ans.ta[i]) + '」' : ''}`).join('\n');
    const t = X.bailu() ? null : await X.ask(`${X.who(c)}\n${r.mode === 'both' ? '你们一起填了同一份问卷' : '她填了你发的问卷'}《${sv.title}》：\n${rows}\n\n看完写几句评语（你的口吻，点到具体的答案，${r.mode === 'both' ? '说说哪些想的一样、哪些不一样' : '有感动的、好笑的、想追问的'}，60~140 字）。`);
    return X.plain(t || X.cards(['问卷', '情话'], c, 1)[0] || (r.mode === 'both' ? `我们有 ${sv.qs.filter((q, i) => same(q, r.ans.me[i], r.ans.ta[i])).length} 题想的一样。剩下的，我慢慢了解你。` : '每一题我都看了。最后那题……我记住了。'));
}
let F = null;   // 正在填：{cid, sv, mode, i, me:[]}
window.gyxSurveyStart = async (cid, sid, mode) => {
    const c = X.char(cid) || X.cur(), sv = svOf(sid); if (!c || !sv) return;
    if (mode === 'ta') { const r = { id: 'sr' + Date.now().toString(36), cid: String(c.id), sv: sid, title: sv.title, mode, ans: { me: [], ta: [] }, at: Date.now() }; const f = await taFill(c, sv); r.ans.ta = f.ans; r.comment = f.say; D.res.unshift(r); await S.set('d', D); window.gyxSurveyView(r.id); return r; }
    F = { cid: String(c.id), sv: sid, mode, me: [] }; paintFill();
};
function paintFill() {
    const sv = svOf(F.sv), c = X.char(F.cid);
    X.panel('gyxSvOv', '📋 ' + X.esc(sv.title), `<div class="gyx-tip">${F.mode === 'both' ? '你们俩一起填，填完对比' : X.esc(X.name(c)) + ' 发给你的问卷'}</div>${sv.qs.map((q, i) => `<div class="sv-q"><b>${i + 1}. ${X.esc(q.q)}</b>${q.t === 'one' ? q.o.map(o => `<label><input type="radio" name="svq${i}" value="${X.esc(o)}"> ${X.esc(o)}</label>`).join('') : q.t === 'many' ? q.o.map(o => `<label><input type="checkbox" name="svq${i}" value="${X.esc(o)}"> ${X.esc(o)}</label>`).join('') : q.t === 'rate' ? `<div class="sv-rate">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="svq${i}" value="${n}"> ${n}</label>`).join('')}</div>` : `<input class="gyx-in" name="svq${i}" placeholder="写点什么">`}</div>`).join('')}
        <div class="gyx-row"><button class="gyx-btn" onclick="this.disabled=true;this.textContent='交卷中…';gyxSurveySubmit()">交卷</button></div>`);
}
window.gyxSurveySubmit = async () => {
    if (!F) return; const sv = svOf(F.sv), c = X.char(F.cid), box = document.getElementById('gyxSvOv');
    const me = sv.qs.map((q, i) => { const els = [...box.querySelectorAll(`[name="svq${i}"]`)]; if (q.t === 'many') return els.filter(e => e.checked).map(e => e.value); if (q.t === 'text') return (els[0] || {}).value || ''; const e = els.find(e => e.checked); return e ? (q.t === 'rate' ? +e.value : e.value) : ''; });
    const r = { id: 'sr' + Date.now().toString(36), cid: F.cid, sv: F.sv, title: sv.title, mode: F.mode, ans: { me, ta: [] }, at: Date.now() };
    if (F.mode === 'both') r.ans.ta = (await taFill(c, sv)).ans;
    F = null; r.comment = await comment(c, sv, r); D.res.unshift(r); await S.set('d', D); window.gyxSurveyView(r.id); return r;
};
window.gyxSurveyFill = (vals) => { if (!F) return; const sv = svOf(F.sv), box = document.getElementById('gyxSvOv'); sv.qs.forEach((q, i) => { const v = vals[i]; [...box.querySelectorAll(`[name="svq${i}"]`)].forEach(e => { if (q.t === 'text') e.value = v; else if (q.t === 'many') e.checked = (v || []).includes(e.value); else e.checked = String(e.value) === String(v); }); }); };
window.gyxSurveyView = id => {
    const r = D.res.find(x => x.id === id), sv = r && svOf(r.sv); if (!r) return; const c = X.char(r.cid), qs = sv ? sv.qs : [];
    const n = r.mode === 'both' ? qs.filter((q, i) => same(q, r.ans.me[i], r.ans.ta[i])).length : 0;
    X.panel('gyxSvOv', '📋 ' + X.esc(r.title), `<div class="gyx-tip">${new Date(r.at).toLocaleString()} · ${r.mode === 'ta' ? X.esc(X.name(c)) + ' 填的' : r.mode === 'me' ? '你填的' : '一起填的 · ' + n + '/' + qs.length + ' 题想的一样'}</div>
        ${qs.map((q, i) => `<div class="sv-q${r.mode === 'both' && same(q, r.ans.me[i], r.ans.ta[i]) ? ' same' : ''}"><b>${i + 1}. ${X.esc(q.q)}</b>${r.mode !== 'ta' ? `<div>你：${X.esc(fmt(q, r.ans.me[i]))}</div>` : ''}${r.mode !== 'me' ? `<div>${X.esc(X.name(c))}：${X.esc(fmt(q, r.ans.ta[i]))}</div>` : ''}</div>`).join('')}
        ${r.comment ? `<div class="gyx-card gyx-hand" style="font-size:16px">${X.esc(X.name(c))}：${X.esc(r.comment)}</div>` : ''}<div class="gyx-row"><button class="gyx-btn lite" onclick="gyxSurveyOpen('${r.cid}')">‹ 回问卷列表</button></div>`);
};
window.gyxSurveyNew = async () => {
    const title = ((document.getElementById('gyxSvT') || {}).value || '').trim(), raw = ((document.getElementById('gyxSvQ') || {}).value || '').trim(); if (!title || !raw) { X.toast('📋 标题和题目都要写', ''); return; }
    // 一行一题：「题目｜选项1/选项2」＝单选；「题目｜多选｜a/b/c」；「题目｜打分」；只有题目＝填空
    const qs = raw.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const p = l.split(/[|｜]/).map(s => s.trim()); if (p.length === 1) return { q: p[0], t: 'text' }; if (/^打分|评分|1~5$/.test(p[1])) return { q: p[0], t: 'rate' }; if (/^多选$/.test(p[1])) return { q: p[0], t: 'many', o: (p[2] || '').split(/[\/／、]/).filter(Boolean) }; return { q: p[0], t: 'one', o: p[1].split(/[\/／、]/).filter(Boolean) }; });
    D.mine.unshift({ id: 'sv' + Date.now().toString(36), title, qs, mine: 1 }); await S.set('d', D); window.gyxSurveyOpen();
};
window.gyxSurveyDel = async (k, id) => { D[k] = D[k].filter(x => x.id !== id); await S.set('d', D); window.gyxSurveyOpen(); };
window.gyxSurveyData = () => D;
window.gyxSurveyOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id);
    X.panel('gyxSvOv', '📋 调查问卷', `<div class="gyx-row">${X.whoSel(cid, 'gyxSurveyOpen')}</div>
        ${all().map(sv => `<div class="sv-card"><b>${X.esc(sv.title)}</b><span>${sv.qs.length} 题${sv.mine ? ' · 你出的 <a onclick="gyxSurveyDel(\'mine\',\'' + sv.id + '\')">删</a>' : ''}</span><div class="gyx-row"><button class="gyx-btn lite" onclick="this.disabled=true;this.textContent='TA 在填…';gyxSurveyStart('${cid}','${sv.id}','ta')">发给 TA 填</button><button class="gyx-btn lite" onclick="gyxSurveyStart('${cid}','${sv.id}','me')">我来填</button><button class="gyx-btn lite" onclick="gyxSurveyStart('${cid}','${sv.id}','both')">一起填·对比</button></div></div>`).join('')}
        <details class="gyx-card"><summary>✏️ 自己出一份</summary><input id="gyxSvT" class="gyx-in" placeholder="问卷标题"><textarea id="gyxSvQ" class="gyx-in" rows="6" style="margin-top:6px" placeholder="一行一题：\n你最喜欢的颜色？｜红/蓝/绿（单选）\n周末想做什么？｜多选｜看电影/逛街/睡觉\n今天开心吗？｜打分\n想对我说什么？（只写题目＝填空）"></textarea><div class="gyx-row"><button class="gyx-btn" onclick="gyxSurveyNew()">出好了</button></div></details>
        <div style="font-weight:700;margin:12px 0 4px">填过的</div>${D.res.filter(x => x.cid === cid).map(x => `<div class="sv-res" onclick="gyxSurveyView('${x.id}')"><b>${X.esc(x.title)}</b><span>${x.mode === 'ta' ? 'TA 填的' : x.mode === 'me' ? '你填的' : '一起填的'} · ${new Date(x.at).toLocaleDateString()}</span><i onclick="event.stopPropagation();gyxSurveyDel('res','${x.id}')">删</i></div>`).join('') || '<div class="gyx-tip">还没填过</div>'}`);
};
X.ctx(id => { const r = D.res.find(x => x.cid === String(id) && x.ans.me.length); if (!r || Date.now() - r.at > 3 * 864e5) return ''; const sv = svOf(r.sv); if (!sv) return ''; return `【她前几天填了问卷《${r.title}》】${sv.qs.slice(0, 6).map((q, i) => q.q + '：' + fmt(q, r.ans.me[i])).join('；')}`; }, 'gyxSurvey');
X.action({ key: 'gyx_survey', label: '给她发一份问卷', hint: '调查问卷', need: c => !D.res.some(x => x.cid === String(c.id) && Date.now() - x.at < 5 * 864e5),
    run: async c => { const sv = X.pick(all()); X.notify(c, `📋 ${X.esc(X.name(c))} ${X.v('给你发了一份问卷', '递过来一张问卷', '想让你填个问卷')}：${X.esc(sv.title)}`, '去填', () => window.gyxSurveyStart(c.id, sv.id, 'me')); return (await X.reach(c, `你给她发了一份问卷《${sv.title}》，想看看她怎么答。半认真半撒娇地让她去填（「📋 调查问卷」里）`)) ? '发了一份问卷' : null; } }, 'gyxSurvey');
X.today(() => ({ title: '📋 调查问卷', rows: D.res.filter(x => X.day(new Date(x.at)) === X.day()).map(x => ({ t: x.mode === 'ta' ? 'TA 填了' : x.mode === 'me' ? '你填了' : '一起填', x: X.esc(x.title), go: `gyxSurveyView('${x.id}')` })) }), 'gyxSurvey');
X.widget('gyxSurveyW', { n: '调查问卷', sizes: ['s', 'm'], tap: () => window.gyxSurveyOpen(), r: w => { const r = D.res[0]; return X.gw(w, '📋', '调查问卷', r ? [X.esc(r.title), r.mode === 'both' ? '一起填的' : r.mode === 'ta' ? 'TA 填的' : '你填的'] : ['发一份？']); } }, 'gyxSurvey');
X.memArr({ k: 'gyxSurvey', ico: '📋', n: '调查问卷', d: '填过的问卷（改的是 TA 的评语）', arr: () => D.res, field: 'comment', text: x => x.title + '：' + (x.comment || ''), edit: (x, v) => { x.comment = v.replace(/^[^：]*：/, ''); }, meta: x => (x.mode === 'ta' ? 'TA 填' : x.mode === 'me' ? '你填' : '一起填') + ' · ' + new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxSurvey');
X.css('gyxSvCss', `.sv-card{padding:12px 14px;border-radius:16px;background:#f7f7f9;margin:8px 0}.sv-card span{font-size:12px;color:#999;margin-left:8px}.sv-card a{color:#c66;cursor:pointer}.sv-q{padding:10px 4px;border-bottom:1px solid #f2f2f4;font-size:14px}.sv-q b{display:block;margin-bottom:6px}.sv-q label{display:inline-block;margin:3px 10px 3px 0;cursor:pointer}.sv-q.same{background:#f0fff4}.sv-q div{color:#555;margin:2px 0}.sv-res{display:flex;gap:8px;align-items:baseline;padding:8px 2px;border-bottom:1px solid #f2f2f4;cursor:pointer}.sv-res span{flex:1;font-size:12px;color:#999}.sv-res i{font-style:normal;font-size:11px;color:#aaa}`);
X.mini({ id: 'gyxSurvey', icon: '📋', title: '调查问卷', desc: '发给 TA 填、TA 发给你、一起填对比', cat: '一起做', onOpen: () => window.gyxSurveyOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.mine = D.mine || []; D.res = D.res || []; })();
