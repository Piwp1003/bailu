/* 🎮 一起玩：给原来的 🎮 小游戏再添三款——猜拳、成语接龙、猜数字（五子棋、真心话大冒险原来就有，不重复做），直接出现在聊天里 🎮 的游戏列表；TA 边玩边说话，战绩都记着 */
if (window.__gyxGame) return; window.__gyxGame = 1;
X.feat('gyxGame', { n: '🎮 小游戏加三款', desc: '猜拳、成语接龙、猜数字，加进聊天里的 🎮' });
const S = X.store('game');
let D = { rec: {} };   // rec[game] = {win, lose, draw}
let G = { tab: 'rps', who: '' };
const rec = (g, r) => { const x = D.rec[g] = D.rec[g] || { win: 0, lose: 0, draw: 0 }; x[r]++; S.set('d', D); };
async function talk(c, what, fallback) {
    if (X.bailu()) return X.cards(['游戏', '聊天'], c, 1)[0] || fallback;
    const t = await X.ask(`${X.who(c)}\n你们正在一起玩游戏。${what}\n说一句（口语，不超过 30 字，按你的性格：得意、耍赖、让着她、嘴硬……）。只输出这句话。`);
    return t ? X.plain(t) : fallback;
}
function bubble(t) { const b = document.getElementById('gyxGmSay'); if (b && t) { b.textContent = '💬 ' + t; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } }
const who = () => X.char(G.who) || X.cur();
/* ---------- 猜拳 ---------- */
const RPS = ['✊ 石头', '✌️ 剪刀', '🖐 布'];
window.gyxRps = async function (m) { const t = Math.floor(Math.random() * 3), r = m === t ? 'draw' : (m - t + 3) % 3 === 2 ? 'win' : 'lose'; rec('rps', r); G.rps = { m, t, r }; paint(); bubble(await talk(who(), `猜拳：她出${RPS[m]}，你出${RPS[t]}，${{ win: '她赢了', lose: '你赢了', draw: '平局' }[r]}。`, { win: '让你的', lose: '哈哈我赢了', draw: '再来！' }[r])); };
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
    if (G.tab === 'rps') h = `<div class="gm-rec">${r('rps')}</div><div class="gm-rps">${RPS.map((x, i) => `<button onclick="gyxRps(${i})">${x}</button>`).join('')}</div>${G.rps ? `<div class="gm-res">你 ${RPS[G.rps.m]} vs ${RPS[G.rps.t]} TA<br><b>${{ win: '你赢了', lose: 'TA 赢了', draw: '平局' }[G.rps.r]}</b></div>` : ''}`;
    if (G.tab === 'cy') h = `<div class="gm-rec">${r('cy')}</div><div class="gm-cy">${(G.cy || []).map((w, i) => `<span class="${i % 2 ? 'ta' : ''}">${X.esc(w)}</span>`).join('') || '<span class="gyx-tip">你先说一个成语</span>'}</div><div class="gyx-row"><input id="gyxCyIn" class="gyx-in" placeholder="${G.cy && G.cy.length ? '用「' + G.cy[G.cy.length - 1].slice(-1) + '」开头' : '比如：一心一意'}" style="flex:1" onkeydown="if(event.key==='Enter')gyxChengyu()"><button class="gyx-btn" onclick="gyxChengyu()">接</button><button class="gyx-btn lite" onclick="GYX_G.cy=[];gyxGameTab('cy')">重来</button></div>`;
    if (G.tab === 'guess') h = `<div class="gm-rec">${r('guess')}</div><div class="gm-q">TA 心里想了一个 1~100 的数${G.gs && G.gs.msg ? `<p>${X.esc(G.gs.msg)}</p>` : ''}</div><div class="gyx-row"><input id="gyxGsIn" type="number" class="gyx-in" style="flex:1" onkeydown="if(event.key==='Enter')gyxGuess()"><button class="gyx-btn" onclick="gyxGuess()">猜</button></div>`;
    b.innerHTML = `<div class="gyx-row">${X.whoSel(G.who || (who() || {}).id, 'gyxGameWho')}${[['rps', '✊ 猜拳'], ['cy', '📜 成语接龙'], ['guess', '🔢 猜数字']].map(([k, n]) => `<span class="gyx-chip ${G.tab === k ? 'on' : ''}" onclick="gyxGameTab('${k}')">${n}</span>`).join('')}</div><div id="gyxGmSay" class="gm-say"></div>${h}`;
}
window.GYX_G = G;
window.gyxGameTab = t => { G.tab = t; paint(); };
window.gyxGameWho = v => { G.who = v; paint(); };
window.gyxGameOpen = function (tab) { if (tab) G.tab = tab; X.panel('gyxGmOv', '🎮 ' + ({ rps: '猜拳', cy: '成语接龙', guess: '猜数字' }[G.tab] || '一起玩'), '<div id="gyxGmBody"></div>'); paint(); };
window.gyxGameData = () => D;
X.action({ key: 'gyx_game', label: '约她玩个小游戏（猜拳 / 成语接龙 / 猜数字）', hint: '无聊的时候', need: () => true, run: async c => (await X.reach(c, `你有点无聊，想约她一起玩${X.pick(['成语接龙', '猜拳', '猜数字'])}（聊天里点 🎮 就能开），用你的方式约她`)) ? '约你一起玩游戏' : null }, 'gyxGame');
X.ctx(() => { const t = Object.entries(D.rec).map(([k, x]) => `${{ rps: '猜拳', cy: '成语接龙', guess: '猜数字' }[k] || k} ${x.win}:${x.lose}`).join('，'); return t ? `【一起玩的战绩（她:你）】${t}` : ''; }, 'gyxGame');
X.today(() => { const t = Object.entries(D.rec).map(([k, x]) => `${{ rps: '猜拳', cy: '成语接龙', guess: '猜数字' }[k] || k} ${x.win}:${x.lose}`).join(' · '); return { title: '🎮 小游戏', rows: t ? [{ t: '战绩', x: t, go: 'gyxGameOpen()' }] : [] }; }, 'gyxGame');
X.css('gyxGmCss', `.gm-say{min-height:22px;font-size:14px;color:#8e4ec6;margin:6px 2px}.gm-say.pop{animation:giIn .4s both}@keyframes giIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.gm-rec{font-size:13px;color:#8e8e93;text-align:center;margin:4px 0}
.gm-board{display:grid;gap:0;aspect-ratio:1;background:#e8c48c;padding:8px;border-radius:10px;box-shadow:inset 0 0 0 2px #c79a58;background-image:linear-gradient(#b8894a 1px,transparent 1px),linear-gradient(90deg,#b8894a 1px,transparent 1px);background-size:calc((100% - 16px)/13) calc((100% - 16px)/13);background-position:calc(8px + (100% - 16px)/26) calc(8px + (100% - 16px)/26)}
.gm-board i{aspect-ratio:1;border-radius:50%;cursor:pointer;margin:12%}.gm-board i.b{background:radial-gradient(circle at 35% 30%,#666,#000);box-shadow:0 2px 3px rgba(0,0,0,.4)}.gm-board i.w{background:radial-gradient(circle at 35% 30%,#fff,#ccc);box-shadow:0 2px 3px rgba(0,0,0,.3)}
.gm-rps{display:flex;gap:10px;justify-content:center;margin:14px 0}.gm-rps button{font-size:22px;padding:14px 16px;border-radius:18px;border:none;background:#f2f2f4;cursor:pointer}.gm-res{text-align:center;font-size:18px;line-height:1.8}.gm-res b{font-size:22px;color:#ff5c8a}
.gm-q{padding:14px;border-radius:16px;background:#fff4f8;font-size:17px;margin:10px 0}.gm-q p{font-size:14px;color:#8e4ec6;margin:8px 0 0}.gm-cy{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.gm-cy span{padding:6px 10px;border-radius:12px;background:#eef6ff}.gm-cy span.ta{background:#fff0f5}`);
// 注册进原来的 🎮 小游戏框架（和五子棋、UNO、狼人杀在同一个列表里），不另开入口
const GAMES = [['gyx_rps', '猜拳', '✊', 'rps'], ['gyx_chengyu', '成语接龙', '📜', 'cy'], ['gyx_guess', '猜数字', '🔢', 'guess']];
function reg() {
    if (typeof registerMiniGame !== 'function') return false;
    GAMES.forEach(([id, name, icon, tab]) => registerMiniGame({ id, name, icon, getStatus: () => null, onResume: () => window.gyxGameOpen(tab),
        onStart: (sid, opp) => { G.who = String((opp || [])[0] || sid || ''); if (tab === 'cy') G.cy = []; if (tab === 'guess') G.gs = null; try { (globalChats[sid] = globalChats[sid] || []).push({ sender: 'system', text: `${icon} ${name}开始啦`, timestamp: Date.now() }); if (typeof renderChatMessages === 'function') renderChatMessages(); } catch (e) {} window.gyxGameOpen(tab); } }));
    return true;
}
function unreg() { try { const ids = GAMES.map(g => g[0]); registeredMiniGames = registeredMiniGames.filter(g => !ids.includes(g.id)); } catch (e) {} }
addEventListener('gyx:feat', e => { if (e.detail && e.detail.id === 'gyxGame') e.detail.on ? reg() : unreg(); });
if (X.on('gyxGame') && !reg()) { let n = 0; const iv = setInterval(() => { if (reg() || ++n > 60) clearInterval(iv); }, 500); }
if (typeof registerMiniGame !== 'function') X.mini({ id: 'gyxGame', icon: '🎮', title: '小游戏', desc: '猜拳、成语接龙、猜数字', onOpen: () => window.gyxGameOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.rec = D.rec || {}; })();
X.widget('gyxGameW', { n: '小游戏战绩', sizes: ['s', 'm'], tap: () => window.gyxGameOpen('rps'), r: w => { const t = Object.entries(D.rec).map(([k, x]) => ({ rps: '猜拳', cy: '成语', guess: '猜数' }[k] || k) + ' ' + x.win + ':' + x.lose); return X.gw(w, '✊', '小游戏', t.length ? t : ['来一局']); } }, 'gyxGame');
