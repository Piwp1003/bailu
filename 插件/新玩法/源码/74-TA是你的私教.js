/* 🏃 TA 是你的私教：拉伸、睡前瑜伽、十分钟燃脂、久坐放松……选一套，TA 在旁边数节拍、念动作、给你喝彩（也会小小吐槽你偷懒），一个动作一个倒计时。练完记一笔，连续打卡 TA 都看在眼里。身体不舒服就停，TA 不会怪你 */
if (window.__gyxCoach) return; window.__gyxCoach = 1;
X.feat('gyxCoach', { n: '🏃 TA 是你的私教', desc: '拉伸 / 瑜伽 / 燃脂，TA 数节拍念动作给你喝彩，记打卡' });
const S = X.store('coach');
let D = { log: [], cfg: { voice: true, style: '温柔' } };   // [{id, cid, plan, sec, done, at, say}]
const PLANS = {
    '早起唤醒': { ico: '🌤️', steps: [['原地踏步', 40, '慢慢抬膝，把身体叫醒'], ['手臂画圈', 30, '向前十圈，再向后十圈'], ['左右侧弯', 30, '手举过头，往一边慢慢弯'], ['开合跳', 30, '跳不动就改成开合步，没关系'], ['深呼吸', 30, '吸四秒，呼六秒']] },
    '久坐放松': { ico: '💺', steps: [['颈部拉伸', 30, '头慢慢往一边歪，别用力压'], ['耸肩放下', 30, '耸到耳朵，再一下子放松'], ['扩胸', 30, '双手在背后交叉，挺胸'], ['坐姿扭转', 40, '转向一边，手扶椅背'], ['手腕绕环', 20, '打字累了吧，转一转'], ['站起来伸懒腰', 20, '踮脚，往上够']] },
    '睡前瑜伽': { ico: '🌙', steps: [['婴儿式', 60, '跪坐，身体趴下，手往前伸'], ['猫牛式', 60, '吸气抬头塌腰，呼气拱背低头'], ['仰卧扭转', 60, '躺着，膝盖倒向一边'], ['靠墙抬腿', 90, '腿搭在墙上，放松'], ['摊尸式', 90, '什么都不用做，听我说话就好']] },
    '十分钟燃脂': { ico: '🔥', steps: [['开合跳', 40, '热起来'], ['休息', 15, '喘口气'], ['深蹲', 40, '膝盖别超过脚尖'], ['休息', 15, '喝口水'], ['高抬腿', 30, '能抬多高抬多高'], ['休息', 15, '快一半了'], ['平板支撑', 30, '屁股别撅起来'], ['休息', 15, '最后一组'], ['登山跑', 30, '冲！'], ['拉伸', 60, '慢慢放松下来']] },
    '眼睛休息': { ico: '👀', steps: [['闭眼', 30, '什么都不看'], ['看远处', 30, '找窗外最远的地方'], ['转眼球', 30, '上下左右，慢一点'], ['掌心捂眼', 30, '搓热手心，盖在眼睛上']] }
};
const CHEER = { 温柔: ['做得很好。', '慢慢来，我陪着你。', '累了就少做一点，没关系。', '你今天也很棒。', '呼吸别憋着。'], 严格: ['不许偷懒！', '还有一半，坚持住！', '我看着呢，再来。', '腰挺直！', '最后十秒，别停！'] };
let RUN = null;
function say(c, t) { const b = document.getElementById('gyxCoSay'); if (b) b.textContent = t; if (D.cfg.voice) X.speak(c, t); }
async function lines(c, plan) {
    if (X.bailu()) return null;
    const j = X.json(await X.ask(`${X.who(c)}\n她要做「${plan}」，你当私教陪她（${D.cfg.style}一点）。给每个动作开始时说一句话（短、口语、可以夹一点点私心），再给一句开场、一句结束。\n动作：${PLANS[plan].steps.map(s => s[0]).join('、')}\n只输出 JSON：{"start":"","steps":["第1个动作说的话"],"end":""}`));
    return j && Array.isArray(j.steps) ? j : null;
}
function tickRun() {
    if (!RUN) return; const c = X.char(RUN.cid), P = PLANS[RUN.plan], st = P.steps[RUN.i];
    if (RUN.paused) return;
    RUN.left--; RUN.total++;
    const b = document.getElementById('gyxCoT'); if (b) b.textContent = RUN.left;
    const ring = document.getElementById('gyxCoRing'); if (ring) ring.style.setProperty('--p', Math.round((1 - RUN.left / st[1]) * 100));
    if (RUN.left === Math.floor(st[1] / 2) && st[0] !== '休息' && st[1] >= 30) say(c, X.pick(X.cards(['加油', '情话'], c, 1).concat(CHEER[D.cfg.style] || CHEER['温柔'])));
    if (RUN.left <= 3 && RUN.left > 0) try { navigator.vibrate && navigator.vibrate(40); } catch (e) {}
    if (RUN.left <= 0) { RUN.i++; if (RUN.i >= P.steps.length) return finish(true); start(); }
}
function start() { const c = X.char(RUN.cid), st = PLANS[RUN.plan].steps[RUN.i]; RUN.left = st[1]; paint(); say(c, (RUN.L && RUN.L.steps && RUN.L.steps[RUN.i]) ? X.plain(RUN.L.steps[RUN.i]) : `${st[0]}，${st[1]} 秒。${st[2]}。`); }
async function finish(done) {
    if (!RUN) return; clearInterval(RUN.t); const r = RUN, c = X.char(r.cid); RUN = null; X.stopSpeak();
    const end = done ? ((r.L && r.L.end) || X.pick(['练完啦！今天的你闪闪发光。', '好，收工。去喝水，然后抱一下。', '做完了？我就知道你可以。'])) : X.pick(['今天就到这儿吧，能动一动已经很好了。', '没关系，下次我们再继续。']);
    const it = { id: 'co' + Date.now().toString(36), cid: r.cid, plan: r.plan, sec: r.total, done: !!done, at: Date.now(), say: X.plain(end), steps: r.i }; D.log.unshift(it); await S.set('d', D);
    if (D.cfg.voice) X.speak(c, it.say); window.gyxCoachOpen(r.cid, it.id);
}
function paint() {
    const b = document.getElementById('gyxCoRun'); if (!b || !RUN) return; const P = PLANS[RUN.plan], st = P.steps[RUN.i];
    b.innerHTML = `<div class="co-step">${RUN.i + 1} / ${P.steps.length}</div><div id="gyxCoRing" class="co-ring" style="--p:0"><b id="gyxCoT">${RUN.left}</b></div><div class="co-name">${X.esc(st[0])}</div><div class="gyx-tip" style="text-align:center">${X.esc(st[2])}</div><div id="gyxCoSay" class="co-say"></div>
        <div class="co-next">${P.steps.slice(RUN.i + 1, RUN.i + 3).map(s => `下一个：${X.esc(s[0])} ${s[1]}″`).join(' · ')}</div>
        <div class="gyx-row" style="justify-content:center"><button class="gyx-btn lite" onclick="gyxCoachPause()">${RUN.paused ? '▶ 继续' : '⏸ 暂停'}</button><button class="gyx-btn lite" onclick="gyxCoachSkip()">跳过 ›</button><button class="gyx-btn lite" onclick="gyxCoachStop()">不练了</button></div>`;
}
window.gyxCoachGo = async (cid, plan, fast) => {
    const c = X.char(cid) || X.cur(); if (!c || !PLANS[plan]) return; if (RUN) clearInterval(RUN.t);
    RUN = { cid: String(c.id), plan, i: 0, left: 0, total: 0, L: null };
    X.panel('gyxCoOv', PLANS[plan].ico + ' ' + plan, `<div id="gyxCoRun" class="co-run"><div class="gyx-tip" style="text-align:center">${X.esc(X.name(c))} ${X.v('在换衣服……', '准备好了，在等你', '把垫子铺好了')}</div></div><div class="gyx-tip" style="text-align:center">⚠️ 哪里疼、头晕就停下来，TA 不会怪你</div>`);
    const ov = document.getElementById('gyxCoOv'), rm = ov.remove.bind(ov); ov.remove = () => { if (RUN) { clearInterval(RUN.t); RUN = null; X.stopSpeak(); } rm(); };
    RUN.L = await lines(c, plan); if (!RUN) return;
    say(c, X.plain((RUN.L && RUN.L.start) || X.pick(['好，开始了。跟着我。', '准备——开始！', '今天我陪你练。'])));
    start(); RUN.t = setInterval(tickRun, fast ? 5 : 1000);
};
window.gyxCoachPause = () => { if (RUN) { RUN.paused = !RUN.paused; paint(); } };
window.gyxCoachSkip = () => { if (!RUN) return; RUN.left = 1; tickRun(); };
window.gyxCoachStop = () => finish(false);
window.gyxCoachCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxCoachData = () => D;
const streak = cid => { const ds = new Set(D.log.filter(x => x.cid === cid && x.done).map(x => X.day(new Date(x.at)))); const d = new Date(); if (!ds.has(X.day(d))) d.setDate(d.getDate() - 1); let n = 0; while (ds.has(X.day(d))) { n++; d.setDate(d.getDate() - 1); } return n; };
window.gyxCoachOpen = function (who, hl) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), L = D.log.filter(x => x.cid === cid), last = hl && L.find(x => x.id === hl);
    X.panel('gyxCoOv', '🏃 TA 是你的私教', `<div class="gyx-row">${X.whoSel(cid, 'gyxCoachOpen')}<span class="gyx-tip">连续 ${streak(cid)} 天 · 一共 ${L.filter(x => x.done).length} 次</span></div>
        ${last ? `<div class="gyx-card"><b>${last.done ? '✅ 练完了' : '⏹ 先到这儿'}</b> · ${X.esc(last.plan)} · ${Math.round(last.sec / 60)} 分钟<div>${X.esc(X.name(c))}：${X.esc(last.say)}</div></div>` : ''}
        <div class="co-plans">${Object.keys(PLANS).map(k => `<div onclick="gyxCoachGo('${cid}','${k}')"><span>${PLANS[k].ico}</span><b>${k}</b><em>${Math.round(PLANS[k].steps.reduce((a, s) => a + s[1], 0) / 60)} 分钟 · ${PLANS[k].steps.length} 个动作</em></div>`).join('')}</div>
        <div class="gyx-row gyx-tip">TA 的风格 ${['温柔', '严格'].map(s => `<span class="gyx-chip${D.cfg.style === s ? ' on' : ''}" onclick="gyxCoachCfg('style','${s}');gyxCoachOpen('${cid}')">${s}</span>`).join('')} <label><input type="checkbox" ${D.cfg.voice ? 'checked' : ''} onchange="gyxCoachCfg('voice',this.checked)"> TA 念出来</label></div>
        <div style="font-weight:700;margin:12px 0 4px">打卡记录</div>${L.slice(0, 20).map(x => `<div class="gyx-tip">${new Date(x.at).toLocaleString()} · ${x.done ? '✅' : '⏹'} ${X.esc(x.plan)} · ${Math.round(x.sec / 60)} 分钟</div>`).join('') || '<div class="gyx-tip">还没练过</div>'}`);
};
X.ctx(id => { const L = D.log.filter(x => x.cid === String(id)); if (!L.length) return ''; const x = L[0]; return `【你是她的私教】连续打卡 ${streak(String(id))} 天。${Date.now() - x.at < 864e5 ? `今天她刚做了「${x.plan}」${x.done ? '' : '（没做完）'}。` : ''}`; }, 'gyxCoach');
X.action({ key: 'gyx_coach', label: '叫她起来活动一下，你陪着', hint: 'TA 是你的私教', need: c => !D.log.some(x => x.cid === String(c.id) && Date.now() - x.at < 864e5),
    run: async c => { const h = new Date().getHours(), p = h < 10 ? '早起唤醒' : h >= 21 ? '睡前瑜伽' : X.pick(['久坐放松', '眼睛休息', '十分钟燃脂']); X.notify(c, `🏃 ${X.esc(X.name(c))}：${X.v('起来动一动？', '我陪你练一会儿', '该活动啦')}`, p, () => window.gyxCoachGo(c.id, p)); return (await X.reach(c, `你想叫她起来做一组「${p}」，你在旁边陪她（「🏃 TA 是你的私教」里）。用你的风格叫她`)) ? '叫你起来活动' : null; } }, 'gyxCoach');
X.today(() => { const L = D.log.filter(x => X.day(new Date(x.at)) === X.day()); return { title: '🏃 私教打卡', rows: L.length ? L.map(x => ({ t: x.done ? '✅' : '⏹', x: X.esc(x.plan) + ' · ' + Math.round(x.sec / 60) + ' 分钟', go: `gyxCoachOpen('${x.cid}')` })) : [{ t: '还没练', x: '动一动？', go: 'gyxCoachOpen()' }] }; }, 'gyxCoach');
X.widget('gyxCoachW', { n: '私教打卡', sizes: ['s', 'm'], tap: () => window.gyxCoachOpen(), r: w => { const c = X.cur(), n = c ? streak(String(c.id)) : 0; return X.gw(w, '🏃', '私教打卡', [n ? '连续 ' + n + ' 天' : '今天还没练', D.log[0] ? X.esc(D.log[0].plan) : '']); } }, 'gyxCoach');
X.memArr({ k: 'gyxCoach', ico: '🏃', n: '私教打卡', d: '练过的和 TA 说的话', arr: () => D.log, field: 'say', text: x => x.plan + '：' + x.say, edit: (x, v) => { x.say = v.replace(/^[^：]*：/, ''); }, meta: x => new Date(x.at).toLocaleString() + (x.done ? ' · 完成' : ' · 中途停'), save: () => S.set('d', D) }, 'gyxCoach');
X.css('gyxCoCss', `.co-plans{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.co-plans div{border-radius:16px;background:#f5f7fa;padding:12px;cursor:pointer}.co-plans span{font-size:28px}.co-plans b{display:block}.co-plans em{font-style:normal;font-size:11.5px;color:#999}.co-run{text-align:center;padding:6px 0}.co-step{font-size:12px;color:#999}.co-ring{width:150px;height:150px;margin:8px auto;border-radius:50%;background:conic-gradient(#34c759 calc(var(--p)*1%),#e9f5ec 0);display:flex;align-items:center;justify-content:center;position:relative}.co-ring:before{content:'';position:absolute;inset:10px;border-radius:50%;background:#fff}.co-ring b{position:relative;font-size:52px;font-weight:800;font-variant-numeric:tabular-nums}.co-name{font-size:22px;font-weight:800}.co-say{min-height:46px;margin:10px auto;max-width:360px;padding:9px 14px;border-radius:16px;background:#f0fbf3;color:#26733d;font-size:14.5px}.co-next{font-size:12px;color:#aaa}`);
X.mini({ id: 'gyxCoach', icon: '🏃', title: 'TA 是你的私教', desc: '拉伸 / 瑜伽 / 燃脂，TA 陪你练', cat: '生活', onOpen: () => window.gyxCoachOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.log = D.log || []; D.cfg = Object.assign({ voice: true, style: '温柔' }, D.cfg || {}); })();
