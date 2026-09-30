/* 🎮 一起玩：和 TA 玩小游戏——五子棋（TA 会边下边说话）、猜拳、真心话大冒险、成语接龙、猜数字；战绩都记着 */
if (window.__gyxGame) return; window.__gyxGame = 1;
X.feat('gyxGame', { n: '🎮 一起玩', desc: '五子棋、猜拳、真心话大冒险、成语接龙、猜数字' });
const S = X.store('game');
let D = { rec: {} };   // rec[game] = {win, lose, draw}
let G = { tab: 'gomoku', who: '' };
const rec = (g, r) => { const x = D.rec[g] = D.rec[g] || { win: 0, lose: 0, draw: 0 }; x[r]++; S.set('d', D); };
async function talk(c, what, fallback) {
    if (X.bailu()) return X.cards(['游戏', '聊天'], c, 1)[0] || fallback;
    const t = await X.ask(`${X.who(c)}\n你们正在一起玩游戏。${what}\n说一句（口语，不超过 30 字，按你的性格：得意、耍赖、让着她、嘴硬……）。只输出这句话。`);
    return t ? X.plain(t) : fallback;
}
function bubble(t) { const b = document.getElementById('gyxGmSay'); if (b && t) { b.textContent = '💬 ' + t; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } }
const who = () => X.char(G.who) || X.cur();
/* ---------- 五子棋 ---------- */
const N = 13; let B = null, over = false, busy = false;
function gNew() { B = Array.from({ length: N }, () => Array(N).fill(0)); over = false; }
function five(b, x, y, p) { for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { let n = 1; for (const s of [1, -1]) { let i = x + dx * s, j = y + dy * s; while (i >= 0 && j >= 0 && i < N && j < N && b[i][j] === p) { n++; i += dx * s; j += dy * s; } } if (n >= 5) return true; } return false; }
function score(b, x, y, p) { let t = 0; for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { let n = 1, open = 0; for (const s of [1, -1]) { let i = x + dx * s, j = y + dy * s; while (i >= 0 && j >= 0 && i < N && j < N && b[i][j] === p) { n++; i += dx * s; j += dy * s; } if (i >= 0 && j >= 0 && i < N && j < N && b[i][j] === 0) open++; } t += n >= 5 ? 1e6 : Math.pow(10, n) * (open === 2 ? 2 : open === 1 ? 1 : .1); } return t; }
function aiMove() { let best = null, bs = -1; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { if (B[i][j]) continue; let near = false; for (let a = -2; a <= 2 && !near; a++) for (let b = -2; b <= 2; b++) { const x = i + a, y = j + b; if (x >= 0 && y >= 0 && x < N && y < N && B[x][y]) { near = true; break; } } if (!near) continue; const s = score(B, i, j, 2) * 1.1 + score(B, i, j, 1) + Math.random(); if (s > bs) { bs = s; best = [i, j]; } } return best || [Math.floor(N / 2), Math.floor(N / 2)]; }
window.gyxGomoku = async function (i, j) {
    if (over || busy || B[i][j]) return; B[i][j] = 1; paint();
    const c = who();
    if (five(B, i, j, 1)) { over = true; rec('gomoku', 'win'); paint(); bubble(await talk(c, '五子棋她赢了你。', '好吧你赢了……再来一局！')); return; }
    busy = true; await new Promise(r => setTimeout(r, 450 + Math.random() * 500));
    const [x, y] = aiMove(); B[x][y] = 2; busy = false; paint();
    if (five(B, x, y, 2)) { over = true; rec('gomoku', 'lose'); paint(); bubble(await talk(c, '五子棋你赢了她。', '嘿嘿，我赢了。')); return; }
    const cnt = B.flat().filter(Boolean).length; if (cnt === N * N) { over = true; rec('gomoku', 'draw'); paint(); return; }
    if (Math.random() < .18) bubble(await talk(c, score(B, x, y, 2) > 1000 ? '你快连成一排了，得意中。' : score(B, i, j, 1) > 1000 ? '她快连成了，你在紧张地堵。' : '下棋中随口说一句。', X.pick(['该你了', '想好再下哦', '这步有点意思'])));
};
/* ---------- 猜拳 ---------- */
const RPS = ['✊ 石头', '✌️ 剪刀', '🖐 布'];
window.gyxRps = async function (m) { const t = Math.floor(Math.random() * 3), r = m === t ? 'draw' : (m - t + 3) % 3 === 2 ? 'win' : 'lose'; rec('rps', r); G.rps = { m, t, r }; paint(); bubble(await talk(who(), `猜拳：她出${RPS[m]}，你出${RPS[t]}，${{ win: '她赢了', lose: '你赢了', draw: '平局' }[r]}。`, { win: '让你的', lose: '哈哈我赢了', draw: '再来！' }[r])); };
/* ---------- 真心话大冒险 ---------- */
const TRUTH = ['第一次心动是什么时候？', '最想和我一起做的一件事？', '手机里最近一张照片是什么？', '有没有偷偷想过我？', '你最近一次哭是因为什么？', '说一个没告诉过我的小秘密', '你觉得我哪里最可爱？'], DARE = ['给我发一句最肉麻的话', '学一声猫叫（发语音）', '夸我十个字以上', '把你现在的样子描述给我听', '唱一句你最近循环的歌', '给我起一个新外号'];
window.gyxTod = async function (kind, forTa) {
    const c = who();
    if (forTa) { const q = ((document.getElementById('gyxTodQ') || {}).value || '').trim() || X.pick(kind === 't' ? TRUTH : DARE); G.tod = { q, forTa: true, a: '……' }; paint(); const a = X.bailu() ? (X.cards(['真心话', '聊天'], c, 1)[0] || '不告诉你～') : X.plain(await X.ask(`${X.who(c)}\n你们在玩真心话大冒险，她给你出了${kind === 't' ? '真心话' : '大冒险'}：「${q}」。认真回答 / 完成它（用文字描述你做了什么），按你的性格，可以害羞可以耍赖。一两句话。只输出回答。`) || '……'); G.tod.a = a; paint(); return a; }
    let q = X.pick(kind === 't' ? TRUTH : DARE);
    if (!X.bailu()) { const t = await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 10)}\n你们在玩真心话大冒险，轮到你给她出一个${kind === 't' ? '真心话问题' : '大冒险（她在手机这头能做到的）'}，要跟你们的关系有关、有点小心思。只输出题目。`); if (t) q = X.plain(t); }
    G.tod = { q, forTa: false }; paint();
};
window.gyxTodAnswer = async function () { const a = ((document.getElementById('gyxTodA') || {}).value || '').trim(); if (!a || !G.tod) return; G.tod.mine = a; paint(); bubble(await talk(who(), `真心话大冒险：你问她「${G.tod.q}」，她的回答是「${a}」。`, '嘿嘿，记住了')); };
/* ---------- 成语接龙 ---------- */
const IDIOMS = '一心一意 意气风发 发扬光大 大显身手 手舞足蹈 蹈常袭故 故步自封 封妻荫子 子虚乌有 有口皆碑 碑林墨海 海阔天空 空前绝后 后来居上 上下一心 心花怒放 放虎归山 山清水秀 秀外慧中 中流砥柱 柱石之坚 坚定不移 移花接木 木已成舟 舟车劳顿 顿开茅塞 塞翁失马 马到成功 功成名就 就地取材 材高知深 深入浅出 出人头地 地久天长 长命百岁 岁月如梭 梭天摸地 天长地久 久别重逢 逢凶化吉 吉人天相 相亲相爱 爱不释手 手到擒来 来日方长 长此以往 往返徒劳 劳苦功高 高高在上 上善若水 水到渠成 成竹在胸 胸有成竹 竹报平安 安居乐业 业精于勤 勤能补拙 拙嘴笨舌 舌战群儒 儒雅风流 流连忘返 返老还童 童言无忌 忌讳如深 深情厚谊 谊切苔岑 心心相印 印累绶若 若即若离 离合悲欢 欢天喜地 地大物博 博大精深 深思熟虑 虑周藻密 密不透风 风花雪月 月下老人 人山人海 海誓山盟 盟山誓海 海枯石烂 烂醉如泥 泥牛入海'.split(' ');
window.gyxChengyu = async function () {
    const w = ((document.getElementById('gyxCyIn') || {}).value || '').trim(); if (!w) return; G.cy = G.cy || [];
    const last = G.cy[G.cy.length - 1]; if (last && w[0] !== last[last.length - 1]) { bubble('要用「' + last[last.length - 1] + '」开头哦'); return; }
    G.cy.push(w); const c = who();
    let r = IDIOMS.find(x => x[0] === w[w.length - 1] && !G.cy.includes(x));
    if (!r && !X.bailu()) { const t = X.plain(await X.ask(`成语接龙：上一个是「${w}」，请用「${w[w.length - 1]}」字开头接一个四字成语（不要用这些：${G.cy.join('、')}）。接不上就回答「认输」。只输出成语或「认输」。`) || ''); if (t && t !== '认输' && t[0] === w[w.length - 1]) r = t.slice(0, 6); }
    if (!r) { rec('cy', 'win'); G.cy.push('（TA 认输了）'); paint(); bubble(await talk(c, '成语接龙你接不上了，认输。', '好吧……我认输')); return; }
    G.cy.push(r); paint();
};
/* ---------- 猜数字 ---------- */
window.gyxGuess = async function () { const v = +((document.getElementById('gyxGsIn') || {}).value || 0); if (!G.gs) G.gs = { n: 1 + Math.floor(Math.random() * 100), k: 0 }; G.gs.k++; const n = G.gs.n; if (v === n) { rec('guess', 'win'); G.gs.msg = `猜中了！就是 ${n}，用了 ${G.gs.k} 次`; paint(); bubble(await talk(who(), `猜数字她 ${G.gs.k} 次猜中了。`, '这么快！')); G.gs = null; return; } G.gs.msg = v < n ? `${v}？再大一点` : `${v}？再小一点`; paint(); };
/* ---------- 画面 ---------- */
function paint() {
    const b = document.getElementById('gyxGmBody'); if (!b) return; const r = k => { const x = D.rec[k] || { win: 0, lose: 0, draw: 0 }; return `你 ${x.win} : ${x.lose} TA${x.draw ? ' · 平 ' + x.draw : ''}`; };
    let h = '';
    if (G.tab === 'gomoku') { if (!B) gNew(); h = `<div class="gm-rec">${r('gomoku')}</div><div class="gm-board" style="grid-template-columns:repeat(${N},1fr)">${B.map((row, i) => row.map((v, j) => `<i onclick="gyxGomoku(${i},${j})" class="${v === 1 ? 'b' : v === 2 ? 'w' : ''}"></i>`).join('')).join('')}</div><div class="gyx-row"><button class="gyx-btn lite" onclick="gyxGameNew()">${over ? '再来一局' : '重新开始'}</button><span class="gyx-tip">你执黑先下</span></div>`; }
    if (G.tab === 'rps') h = `<div class="gm-rec">${r('rps')}</div><div class="gm-rps">${RPS.map((x, i) => `<button onclick="gyxRps(${i})">${x}</button>`).join('')}</div>${G.rps ? `<div class="gm-res">你 ${RPS[G.rps.m]} vs ${RPS[G.rps.t]} TA<br><b>${{ win: '你赢了', lose: 'TA 赢了', draw: '平局' }[G.rps.r]}</b></div>` : ''}`;
    if (G.tab === 'tod') h = `<div class="gyx-row"><button class="gyx-btn" onclick="gyxTod('t')">TA 问我真心话</button><button class="gyx-btn" onclick="gyxTod('d')">TA 给我大冒险</button></div>${G.tod && !G.tod.forTa ? `<div class="gm-q">${X.esc(G.tod.q)}</div>${G.tod.mine ? `<div class="gyx-tip">你：${X.esc(G.tod.mine)}</div>` : `<div class="gyx-row"><input id="gyxTodA" class="gyx-in" placeholder="你的回答" style="flex:1"><button class="gyx-btn" onclick="gyxTodAnswer()">回答</button></div>`}` : ''}
        <div class="gyx-card"><div class="gyx-tip">轮到你问 TA：</div><input id="gyxTodQ" class="gyx-in" placeholder="空着＝随机一个"><div class="gyx-row"><button class="gyx-btn lite" onclick="gyxTod('t',1)">真心话</button><button class="gyx-btn lite" onclick="gyxTod('d',1)">大冒险</button></div>${G.tod && G.tod.forTa ? `<div class="gm-q">${X.esc(G.tod.q)}<p>${X.esc(X.name(who()))}：${X.esc(G.tod.a)}</p></div>` : ''}</div>`;
    if (G.tab === 'cy') h = `<div class="gm-rec">${r('cy')}</div><div class="gm-cy">${(G.cy || []).map((w, i) => `<span class="${i % 2 ? 'ta' : ''}">${X.esc(w)}</span>`).join('') || '<span class="gyx-tip">你先说一个成语</span>'}</div><div class="gyx-row"><input id="gyxCyIn" class="gyx-in" placeholder="${G.cy && G.cy.length ? '用「' + G.cy[G.cy.length - 1].slice(-1) + '」开头' : '比如：一心一意'}" style="flex:1" onkeydown="if(event.key==='Enter')gyxChengyu()"><button class="gyx-btn" onclick="gyxChengyu()">接</button><button class="gyx-btn lite" onclick="GYX_G.cy=[];gyxGameTab('cy')">重来</button></div>`;
    if (G.tab === 'guess') h = `<div class="gm-rec">${r('guess')}</div><div class="gm-q">TA 心里想了一个 1~100 的数${G.gs && G.gs.msg ? `<p>${X.esc(G.gs.msg)}</p>` : ''}</div><div class="gyx-row"><input id="gyxGsIn" type="number" class="gyx-in" style="flex:1" onkeydown="if(event.key==='Enter')gyxGuess()"><button class="gyx-btn" onclick="gyxGuess()">猜</button></div>`;
    b.innerHTML = `<div class="gyx-row">${X.whoSel(G.who || (who() || {}).id, 'gyxGameWho')}${[['gomoku', '⚫ 五子棋'], ['rps', '✊ 猜拳'], ['tod', '💬 真心话大冒险'], ['cy', '📜 成语接龙'], ['guess', '🔢 猜数字']].map(([k, n]) => `<span class="gyx-chip ${G.tab === k ? 'on' : ''}" onclick="gyxGameTab('${k}')">${n}</span>`).join('')}</div><div id="gyxGmSay" class="gm-say"></div>${h}`;
}
window.GYX_G = G;
window.gyxGameTab = t => { G.tab = t; paint(); };
window.gyxGameWho = v => { G.who = v; paint(); };
window.gyxGameNew = () => { gNew(); paint(); };
window.gyxGameOpen = function (tab) { if (tab) G.tab = tab; X.panel('gyxGmOv', '🎮 一起玩', '<div id="gyxGmBody"></div>'); paint(); };
window.gyxGameData = () => D;
X.action({ key: 'gyx_game', label: '约她一起玩个小游戏（五子棋 / 猜拳 / 真心话……）', hint: '无聊的时候', need: () => true, run: async c => (await X.reach(c, `你有点无聊，想约她一起玩${X.pick(['五子棋', '真心话大冒险', '成语接龙', '猜拳', '猜数字'])}（在「小功能 → 一起玩」里），用你的方式约她`)) ? '约你一起玩游戏' : null }, 'gyxGame');
X.ctx(() => { const t = Object.entries(D.rec).map(([k, x]) => `${{ gomoku: '五子棋', rps: '猜拳', cy: '成语接龙', guess: '猜数字' }[k] || k} ${x.win}:${x.lose}`).join('，'); return t ? `【一起玩的战绩（她:你）】${t}` : ''; }, 'gyxGame');
X.today(() => { const t = Object.entries(D.rec).map(([k, x]) => `${{ gomoku: '五子棋', rps: '猜拳', cy: '成语接龙', guess: '猜数字' }[k] || k} ${x.win}:${x.lose}`).join(' · '); return { title: '🎮 一起玩', rows: t ? [{ t: '战绩', x: t, go: 'gyxGameOpen()' }] : [] }; }, 'gyxGame');
X.css('gyxGmCss', `.gm-say{min-height:22px;font-size:14px;color:#8e4ec6;margin:6px 2px}.gm-say.pop{animation:giIn .4s both}@keyframes giIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.gm-rec{font-size:13px;color:#8e8e93;text-align:center;margin:4px 0}
.gm-board{display:grid;gap:0;aspect-ratio:1;background:#e8c48c;padding:8px;border-radius:10px;box-shadow:inset 0 0 0 2px #c79a58;background-image:linear-gradient(#b8894a 1px,transparent 1px),linear-gradient(90deg,#b8894a 1px,transparent 1px);background-size:calc((100% - 16px)/13) calc((100% - 16px)/13);background-position:calc(8px + (100% - 16px)/26) calc(8px + (100% - 16px)/26)}
.gm-board i{aspect-ratio:1;border-radius:50%;cursor:pointer;margin:12%}.gm-board i.b{background:radial-gradient(circle at 35% 30%,#666,#000);box-shadow:0 2px 3px rgba(0,0,0,.4)}.gm-board i.w{background:radial-gradient(circle at 35% 30%,#fff,#ccc);box-shadow:0 2px 3px rgba(0,0,0,.3)}
.gm-rps{display:flex;gap:10px;justify-content:center;margin:14px 0}.gm-rps button{font-size:22px;padding:14px 16px;border-radius:18px;border:none;background:#f2f2f4;cursor:pointer}.gm-res{text-align:center;font-size:18px;line-height:1.8}.gm-res b{font-size:22px;color:#ff5c8a}
.gm-q{padding:14px;border-radius:16px;background:#fff4f8;font-size:17px;margin:10px 0}.gm-q p{font-size:14px;color:#8e4ec6;margin:8px 0 0}.gm-cy{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.gm-cy span{padding:6px 10px;border-radius:12px;background:#eef6ff}.gm-cy span.ta{background:#fff0f5}`);
X.mini({ id: 'gyxGame', icon: '🎮', title: '一起玩', desc: '五子棋、猜拳、真心话大冒险、成语接龙、猜数字', onOpen: () => window.gyxGameOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.rec = D.rec || {}; })();
