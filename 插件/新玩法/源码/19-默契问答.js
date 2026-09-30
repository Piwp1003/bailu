/* 💞 默契问答：TA 出题考你（关于 TA、关于你们），你也能出题考 TA；答对答错 TA 都有反应，默契值一直记着 */
if (window.__gyxQuiz) return; window.__gyxQuiz = 1;
X.feat('gyxQuiz', { n: '💞 默契问答', desc: 'TA 考你、你考 TA，看看你们有多默契' });
const S = X.store('quiz');
let D = { log: [], mine: {}, taAns: {} };   // log:{cid, dir:'ta'|'me', q, opts, ans, pick, ok, at}; mine[cid]=[{q,a}] 你出的题；taAns[cid][q]=TA 的答案（白露用）
const BANK = [['更喜欢猫还是狗？', ['猫', '狗', '都喜欢', '都不太喜欢']], ['周末最想怎么过？', ['在家躺着', '出门逛逛', '跟你待着', '补觉']], ['最喜欢哪个季节？', ['春天', '夏天', '秋天', '冬天']], ['吵架了谁会先低头？', ['我', '你', '谁也不低头', '一起低头']], ['甜的还是辣的？', ['甜的', '辣的', '都要', '都不要']], ['早起还是熬夜？', ['早起', '熬夜', '看心情', '熬夜然后早起']], ['第一次见面你注意到我哪里？', ['眼睛', '声音', '笑', '手']], ['下雨天想做什么？', ['听雨睡觉', '出去踩水', '看电影', '想你']], ['最想和我去哪？', ['海边', '雪山', '游乐园', '哪都行']], ['我生气的时候你怎么办？', ['哄', '让你冷静一下', '买好吃的', '抱住不放']], ['理想的约会是？', ['看电影', '逛街', '在家做饭', '散步聊天']], ['喝咖啡还是奶茶？', ['咖啡', '奶茶', '都行', '白开水']]];
const seed = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
async function taAsk(c) {
    if (X.bailu()) { const [q, o] = BANK[Math.floor(Math.random() * BANK.length)]; const a = o[seed(c.id + q) % o.length]; return { q, opts: o, ans: a, say: X.cards(['默契', '聊天'], c, 1)[0] || '考考你～' }; }
    const r = await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 16)}\n\n你想出一道「默契题」考她：关于你自己（喜好、习惯、小秘密）或者关于你们之间发生过的事（最好是聊天里真实提到过的）。给 4 个选项，只有一个是对的，其他三个要像真的。\n只输出 JSON：{"q":"题目（用你的口吻）","opts":["选项1","选项2","选项3","选项4"],"ans":"正确的那个选项原文","say":"出题时说的一句话"}`);
    const j = X.json(r); if (j && j.q && Array.isArray(j.opts) && j.opts.includes(j.ans)) return j;
    const [q, o] = X.pick(BANK); return { q, opts: o, ans: o[seed(c.id + q) % o.length], say: '考考你～' };
}
async function react(c, what) {
    if (X.bailu()) return X.cards(['默契', '聊天'], c, 1)[0] || (what.ok ? '答对了！奖励一个亲亲。' : '错啦，要罚你多了解我一点。');
    const t = await X.ask(`${X.who(c)}\n${what.dir === 'ta' ? `你出题考她：「${what.q}」，正确答案是「${what.ans}」，她选了「${what.pick}」，${what.ok ? '答对了' : '答错了'}。` : `她出题考你：「${what.q}」，她心里的答案是「${what.ans}」，你答的是「${what.pick}」，${what.ok ? '你们想的一样' : '你们想的不一样'}。`}\n说一两句反应（口语，按你的性格：得意、害羞、假装生气、撒娇都行）。只输出这句话。`);
    return t ? X.plain(t) : (what.ok ? '默契满分。' : '下次一定。');
}
let CUR = null;
window.gyxQuizOpen = function (who) {
    const c = X.char(who) || X.char(CUR && CUR.cid) || X.cur(); if (!c) return; const cid = String(c.id);
    const L = D.log.filter(x => x.cid === cid), ok = L.filter(x => x.ok).length, pct = L.length ? Math.round(ok / L.length * 100) : 0;
    const q = CUR && CUR.cid === cid ? CUR : null;
    X.panel('gyxQzOv', '💞 默契问答', `<div class="gyx-row">${X.whoSel(cid, 'gyxQuizOpen')}<span class="qz-score">默契值 <b>${pct}</b>%（${ok}/${L.length}）</span></div>
        ${q ? `<div class="qz-q"><em>${X.esc(X.name(c))} 考你：</em><b>${X.esc(q.q)}</b>${q.say ? `<span>${X.esc(q.say)}</span>` : ''}<div class="qz-opts">${q.opts.map((o, i) => `<button class="gyx-btn lite" onclick="gyxQuizPick(${i})">${X.esc(o)}</button>`).join('')}</div></div>` : ''}
        <div class="gyx-row"><button class="gyx-btn" onclick="this.disabled=true;this.textContent='TA 在出题……';gyxQuizTa('${cid}')">让 TA 考我</button></div>
        <div class="gyx-card"><div class="gyx-tip">你来考 TA：写一道题和你心里的答案，看 TA 答不答得上</div><input id="gyxQzQ" class="gyx-in" placeholder="比如：我最喜欢的颜色是？"><input id="gyxQzA" class="gyx-in" placeholder="你心里的答案" style="margin-top:6px"><div class="gyx-row"><button class="gyx-btn" onclick="gyxQuizMine('${cid}')">考 TA</button></div></div>
        <div class="qz-log">${L.slice(0, 20).map(x => `<div>${x.ok ? '✅' : '❌'} <b>${x.dir === 'ta' ? 'TA 考你' : '你考 TA'}</b> ${X.esc(x.q)} <span>答案：${X.esc(x.ans)} · ${x.dir === 'ta' ? '你选' : 'TA 答'}：${X.esc(x.pick)}</span>${x.say ? `<p>💬 ${X.esc(x.say)}</p>` : ''}</div>`).join('')}</div>`);
};
window.gyxQuizTa = async function (cid) { const c = X.char(cid) || X.cur(); const j = await taAsk(c); CUR = Object.assign({ cid: String(c.id) }, j); window.gyxQuizOpen(c.id); return CUR; };
window.gyxQuizPick = async function (i) {
    if (!CUR) return; const c = X.char(CUR.cid), pick = CUR.opts[i], it = { cid: CUR.cid, dir: 'ta', q: CUR.q, opts: CUR.opts, ans: CUR.ans, pick, ok: pick === CUR.ans, at: Date.now() };
    CUR = null; it.say = await react(c, it); D.log.unshift(it); await S.set('d', D); window.gyxQuizOpen(it.cid); return it;
};
window.gyxQuizMine = async function (cid) {
    const c = X.char(cid); const q = ((document.getElementById('gyxQzQ') || {}).value || '').trim(), a = ((document.getElementById('gyxQzA') || {}).value || '').trim(); if (!c || !q || !a) { X.toast(X.v('题目和答案都要写', '还差一点没写')); return; }
    let pick;
    if (X.bailu()) { const opts = X.cards(['默契', '聊天'], c, 1); pick = Math.random() < .5 ? a : (opts[0] || '不知道…'); }
    else pick = X.plain(await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 24)}\n\n她考你：「${q}」。凭你对她的了解回答（不知道就猜）。只输出答案本身，越短越好。`) || '不知道…');
    let ok = pick.includes(a) || a.includes(pick);
    if (!ok && !X.bailu()) { const j = await X.ask(`题目：「${q}」。标准答案：「${a}」。回答：「${pick}」。意思一样吗？只回答「是」或「否」。`); ok = /是/.test(j || ''); }
    const it = { cid: String(c.id), dir: 'me', q, ans: a, pick, ok, at: Date.now() }; it.say = await react(c, it);
    D.log.unshift(it); await S.set('d', D); window.gyxQuizOpen(c.id); return it;
};
X.action({ key: 'gyx_quiz', label: '出一道默契题考她', hint: '关于你、关于你们', need: () => true, run: async c => { const j = await taAsk(c); CUR = Object.assign({ cid: String(c.id) }, j); X.say(c, `💞 ${j.say || '考考你'}\n「${j.q}」\n${j.opts.map((o, i) => 'ABCD'[i] + '. ' + o).join('\n')}\n（去「小功能 → 默契问答」答题）`); X.notify(c, `💞 ${X.name(c)} 出了一道默契题`, j.q, 'gyxQuizOpen'); return '出了一道默契题考你'; } }, 'gyxQuiz');
X.ctx(id => { const L = D.log.filter(x => x.cid === String(id)); if (!L.length) return ''; const ok = L.filter(x => x.ok).length; return `【默契问答】你们玩过 ${L.length} 次默契问答，默契值 ${Math.round(ok / L.length * 100)}%。最近一题：${L[0].q}（${L[0].ok ? '答对' : '答错'}）。`; }, 'gyxQuiz');
X.today(() => { const rows = []; if (CUR) rows.push({ t: '待答', x: `${X.esc(X.name(X.char(CUR.cid)))} 考你：${X.esc(CUR.q)}`, go: `gyxQuizOpen('${CUR.cid}')` }); const L = D.log.filter(x => X.day(new Date(x.at)) === X.day()); if (L.length) rows.push({ t: L.filter(x => x.ok).length + '/' + L.length, x: '今天的默契问答', go: 'gyxQuizOpen()' }); return { title: '💞 默契问答', rows }; }, 'gyxQuiz');
X.css('gyxQzCss', `.qz-score{margin-left:auto;font-size:13px;color:#8e8e93}.qz-score b{font-size:22px;color:#ff5c8a}.qz-q{padding:14px;border-radius:18px;background:linear-gradient(135deg,#fff0f5,#f3f0ff);margin:10px 0}.qz-q em{font-style:normal;font-size:12px;color:#a07}.qz-q b{display:block;font-size:18px;margin:6px 0}.qz-q span{font-size:13px;color:#777}.qz-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.qz-log{font-size:13px;line-height:1.7}.qz-log>div{padding:8px 0;border-bottom:1px solid #f2f2f4}.qz-log span{display:block;font-size:12px;color:#999}.qz-log p{margin:2px 0;color:#8e4ec6}`);
X.mini({ id: 'gyxQuiz', icon: '💞', title: '默契问答', desc: 'TA 考你、你考 TA，看看你们有多默契', onOpen: () => window.gyxQuizOpen() });
window.gyxQuizData = () => D;
(async () => { D = Object.assign(D, await S.get('d', {})); D.log = D.log || []; })();
