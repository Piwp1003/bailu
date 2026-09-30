/* 🍳 一起做饭：选一道菜，TA 一步一步教你做——每一步有计时器，TA 在旁边说话（能用 TA 的声音念）；做完拍张照给 TA 看，你们做过的菜都记着 */
if (window.__gyxCook) return; window.__gyxCook = 1;
X.feat('gyxCook', { n: '🍳 一起做饭', desc: 'TA 一步一步教你做菜，陪你做完' });
const S = X.store('cook');
let D = { log: [], cfg: { voice: true } };
let K = null;   // 正在做：{cid, dish, steps:[{s, min, say}], i, t0, timer, left}
const IDEAS = ['番茄炒蛋', '可乐鸡翅', '蛋炒饭', '红烧肉', '清炒时蔬', '酸辣土豆丝', '葱油拌面', '番茄牛腩', '麻婆豆腐', '蒸蛋羹', '咖喱饭', '寿喜锅', '三明治', '松饼', '热红酒', '红糖姜茶', '皮蛋瘦肉粥', '宫保鸡丁', '糖醋排骨', '冬阴功汤'];
const LOCAL = { '番茄炒蛋': [['番茄切块，鸡蛋打散加一点点盐', 0, '刀小心点，我看着呢'], ['热锅倒油，油热了倒蛋液，凝固就盛出来', 2, '蛋别炒太老，嫩一点好吃'], ['再加点油，下番茄炒出汁', 3, '可以压一压，汁多一点'], ['倒回鸡蛋，加盐和一点点糖，翻匀', 1, '好香，我都闻到了'], ['出锅！', 0, '第一口给我尝尝']], '蛋炒饭': [['隔夜饭打散，鸡蛋打匀', 0, '隔夜饭最好吃'], ['油热下蛋液，快速划散', 1, '手快一点'], ['下米饭大火翻炒', 3, '炒到米粒跳起来'], ['加盐、葱花，翻匀出锅', 1, '真厉害']], '红糖姜茶': [['姜切片', 0, '多切几片，暖一点'], ['水里放姜煮开', 5, '等水开的时候陪我说说话'], ['加红糖再煮一会儿', 3, '小心烫'], ['倒出来，慢慢喝', 0, '喝完肚子就暖了']] };
async function recipe(c, dish) {
    if (X.bailu() || !X.who) { const r = LOCAL[dish] || LOCAL['番茄炒蛋']; return r.map(([s, min, say]) => ({ s, min, say: X.cards(['做饭', '聊天'], c, 1)[0] || say })); }
    const j = X.json(await X.ask(`${X.who(c)}\n她想和你一起做「${dish}」，你来一步一步教她。步骤要真实可做（家常做法），每步写清楚做什么、大概要几分钟（不需要等就写 0），再加一句你在旁边会说的话（按你的性格：心疼、调侃、夸她、偷吃……）。4~9 步。\n只输出 JSON：{"steps":[{"s":"这一步做什么","min":分钟数,"say":"你说的话"}]}`));
    if (j && Array.isArray(j.steps) && j.steps.length) return j.steps.map(x => ({ s: String(x.s || ''), min: Math.max(0, +x.min || 0), say: String(x.say || '') }));
    const r = LOCAL[dish] || LOCAL['番茄炒蛋']; return r.map(([s, min, say]) => ({ s, min, say }));
}
window.gyxCookStart = async function (dish, who) {
    const c = X.char(who) || X.cur(); if (!c) return; dish = String(dish || '').trim() || X.pick(IDEAS);
    const b = document.getElementById('gyxCkBody'); if (b) b.innerHTML = `<div class="ck-wait">${X.esc(X.name(c))} 在想「${X.esc(dish)}」怎么做……</div>`;
    const steps = await recipe(c, dish);
    K = { cid: String(c.id), dish, steps, i: 0, t0: Date.now(), left: 0 };
    paint(); say(); return K;
};
function say() { if (!K) return; const st = K.steps[K.i], c = X.char(K.cid); if (st && st.say && D.cfg.voice) X.speak(c, st.say); }
window.gyxCookNext = function (d) {
    if (!K) return; clearInterval(K.timer); K.left = 0; K.i = Math.max(0, K.i + (d || 1));
    if (K.i >= K.steps.length) return done(); paint(); say();
};
window.gyxCookTimer = function () {
    if (!K) return; const st = K.steps[K.i]; clearInterval(K.timer); K.left = Math.round((st.min || 1) * 60);
    K.timer = setInterval(() => { if (!K) return; K.left--; const e = document.getElementById('gyxCkT'); if (e) e.textContent = mmss(K.left); if (K.left <= 0) { clearInterval(K.timer); ding(); X.toast(X.v('⏰ 时间到了', '⏰ 好了，下一步', '⏰ 叮！'), K.steps[K.i].s); const c = X.char(K.cid); if (D.cfg.voice) X.speak(c, X.pick(['好了，可以下一步了', '时间到啦', '叮，好了'])); } }, 1000); paint();
};
const mmss = s => String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0') + ':' + String(Math.max(0, s) % 60).padStart(2, '0');
function ding() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, .18].forEach(t => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 1320; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.001, a.currentTime + t); g.gain.exponentialRampToValueAtTime(.2, a.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + t + .4); o.start(a.currentTime + t); o.stop(a.currentTime + t + .45); }); } catch (e) {} }
async function done(photo) {
    if (!K) return; const k = K; K = null; clearInterval(k.timer);
    const it = { cid: k.cid, dish: k.dish, at: Date.now(), min: Math.round((Date.now() - k.t0) / 60000), photo: '' };
    D.log.unshift(it); await S.set('d', D);
    const b = document.getElementById('gyxCkBody');
    if (b) b.innerHTML = `<div class="ck-done"><b>🎉 「${X.esc(it.dish)}」做好啦</b><span>用了 ${it.min} 分钟</span><label class="gyx-btn">📷 拍张照给 TA 看<input type="file" accept="image/*" style="display:none" onchange="gyxCookPhoto(this)"></label><button class="gyx-btn lite" onclick="gyxCookOpen()">回去</button></div>`;
    const c = X.char(it.cid); X.reach(c, `你刚陪她一起做完了「${it.dish}」，说说（想尝一口、夸她、或者调侃她手忙脚乱）`);
}
window.gyxCookDone = () => done();
window.gyxCookPhoto = function (inp) {
    const f = inp.files && inp.files[0]; if (!f) return; const r = new FileReader();
    r.onload = async () => { const it = D.log[0]; if (!it) return; it.photo = r.result; await S.set('d', D); const c = X.char(it.cid); const sid = String(c.id); if (!globalChats[sid]) globalChats[sid] = []; globalChats[sid].push({ sender: 'me', text: `[照片] 我做的「${it.dish}」`, mediaUrl: r.result, timestamp: Date.now(), readBy: [] }); try { saveAllData(); } catch (e) {} try { if (typeof triggerAIBatchReply === 'function') triggerAIBatchReply(sid, `[照片] 我做的「${it.dish}」`); } catch (e) {} X.toast(X.v('发给 TA 看了', 'TA 看到了'), it.dish); window.gyxCookOpen(); };
    r.readAsDataURL(f);
};
function paint() {
    const b = document.getElementById('gyxCkBody'); if (!b || !K) return;
    const st = K.steps[K.i], c = X.char(K.cid);
    b.innerHTML = `<div class="ck-top"><b>${X.esc(K.dish)}</b><span>第 ${K.i + 1} / ${K.steps.length} 步</span></div>
        <div class="ck-bar"><i style="width:${(K.i + 1) / K.steps.length * 100}%"></i></div>
        <div class="ck-step">${X.esc(st.s)}</div>
        ${st.say ? `<div class="ck-say">💬 ${X.esc(X.name(c))}：${X.esc(st.say)}</div>` : ''}
        ${st.min ? `<div class="ck-tm"><b id="gyxCkT">${K.left ? mmss(K.left) : mmss(st.min * 60)}</b><button class="gyx-btn lite" onclick="gyxCookTimer()">${K.left ? '重新计时' : '⏱ 开始计时 ' + st.min + ' 分钟'}</button></div>` : ''}
        <div class="gyx-row" style="justify-content:space-between"><button class="gyx-btn lite" ${K.i ? '' : 'disabled'} onclick="gyxCookNext(-1)">上一步</button><button class="gyx-btn" onclick="gyxCookNext(1)">${K.i === K.steps.length - 1 ? '做好了！' : '下一步'}</button></div>`;
}
window.gyxCookOpen = function (who) {
    X.panel('gyxCkOv', '🍳 一起做饭', '<div id="gyxCkBody"></div>');
    if (K) return paint();
    const c = X.char(who) || X.cur(), b = document.getElementById('gyxCkBody');
    b.innerHTML = `<div class="gyx-row">和谁：${X.whoSel((c || {}).id, 'gyxCookWho')}<label><input type="checkbox" ${D.cfg.voice ? 'checked' : ''} onchange="gyxCookCfg(this.checked)"> TA 出声说话</label></div>
        <div class="gyx-row"><input id="gyxCkDish" class="gyx-in" placeholder="想做什么菜？（空着＝TA 随便挑一道）" style="flex:1"><button class="gyx-btn" onclick="gyxCookStart(document.getElementById('gyxCkDish').value, GYX_CK_WHO)">开始</button></div>
        <div class="gyx-row">${X.pick([IDEAS.slice(0, 10), IDEAS.slice(10)]).map(d => `<span class="gyx-chip" onclick="gyxCookStart('${d}', GYX_CK_WHO)">${d}</span>`).join('')}</div>
        ${D.log.length ? '<div class="gyx-tip">我们做过的菜</div>' + D.log.slice(0, 20).map(x => `<div class="ck-log">${x.photo ? `<img src="${x.photo}">` : '🍽️'} <b>${X.esc(x.dish)}</b><span>${new Date(x.at).toLocaleDateString()} · 和 ${X.esc(X.name(X.char(x.cid)))}</span></div>`).join('') : ''}`;
    window.GYX_CK_WHO = String((c || {}).id || '');
};
window.GYX_CK_WHO = '';
window.gyxCookWho = v => { window.GYX_CK_WHO = v; };
window.gyxCookCfg = v => { D.cfg.voice = v; S.set('d', D); };
window.gyxCookState = () => K;
window.gyxCookData = () => D;
X.action({ key: 'gyx_cook', label: '约她一起做顿饭（你教她做一道菜）', hint: '饭点前后', need: () => { const h = new Date().getHours(); return (h >= 10 && h <= 13) || (h >= 16 && h <= 20); }, run: async c => (await X.reach(c, `快到饭点了，你想约她一起做「${X.pick(IDEAS)}」（你教她，在「小功能 → 一起做饭」里），用你的方式约她`)) ? '约你一起做饭' : null }, 'gyxCook');
X.ctx(id => K && K.cid === String(id) ? `【一起做饭】你们正在一起做「${K.dish}」，现在是第 ${K.i + 1} 步：${K.steps[K.i].s}` : '', 'gyxCook');
X.today(() => { const rows = []; if (K) rows.push({ t: '正在做', x: `${X.esc(K.dish)}（第 ${K.i + 1}/${K.steps.length} 步）`, go: 'gyxCookOpen()' }); D.log.filter(x => X.day(new Date(x.at)) === X.day()).forEach(x => rows.push({ t: '做好了', x: X.esc(x.dish), go: 'gyxCookOpen()' })); return { title: '🍳 一起做饭', rows }; }, 'gyxCook');
X.css('gyxCkCss', `.ck-wait{padding:40px 0;text-align:center;color:#8e8e93}.ck-top{display:flex;justify-content:space-between;align-items:baseline}.ck-top b{font-size:20px}.ck-top span{font-size:13px;color:#8e8e93}.ck-bar{height:6px;border-radius:3px;background:#f0f0f3;margin:10px 0}.ck-bar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#ffb86b,#ff7a59);transition:width .4s}
.ck-step{font-size:22px;line-height:1.6;padding:18px 16px;border-radius:18px;background:#fff7ec;margin:10px 0;min-height:90px}.ck-say{font-size:14px;color:#8e4ec6;margin:6px 2px}.ck-tm{display:flex;align-items:center;gap:14px;margin:12px 0}.ck-tm b{font-size:40px;font-weight:300;font-variant-numeric:tabular-nums}
.ck-done{display:flex;flex-direction:column;align-items:center;gap:12px;padding:30px 0}.ck-done b{font-size:22px}.ck-done span{color:#8e8e93}.ck-log{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:14px}.ck-log img{width:40px;height:40px;object-fit:cover;border-radius:8px}.ck-log span{font-size:12px;color:#aaa;margin-left:auto}`);
X.mini({ id: 'gyxCook', icon: '🍳', title: '一起做饭', desc: 'TA 一步一步教你做菜：计时器、TA 在旁边说话、做完拍照给 TA 看', onOpen: () => window.gyxCookOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.log = D.log || []; D.cfg = Object.assign({ voice: true }, D.cfg || {}); })();
