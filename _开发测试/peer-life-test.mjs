// 📨 角色之间自己来往 + ⏳ 时间管理大师列出所有功能 的回归测试。
// 无头浏览器真的跑 index.html，AI 请求拦成本地假响应，不联网、不动你的存档。
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('dialog', d => d.accept());

let PEER = {};                 // 下一次"找熟人"要回什么
let DECIDE = { action: 'nothing', reason: '在忙', param: '', nextIn: 60 };   // 下一次自主决策回什么
const prompts = [];
await page.route(/^https?:\/\//, async r => {
  const u = r.request().url();
  if (!/chat\/completions/.test(u)) return r.abort();
  let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
  const all = JSON.stringify(body.messages || body.prompt || '');
  prompts.push(all);
  let content = '好的';
  if (all.includes('一般隔多久会做一次')) {
    // 习惯：日记 3 天一次；找熟人 2 小时一次；小剧场 1 天；匿名区几乎不做
    content = JSON.stringify({ diary: { n: 4320, why: '想起来才写' }, peer: { n: 120, why: '闲了就找人' }, theater: { n: 1440, why: '一天见一次' }, anon: { n: 0, why: '不爱匿名' }, comment: { n: 300, why: '刷到就评' } });
  } else if (all.includes('拿起手机，想着要不要联系')) {
    content = JSON.stringify(PEER);
  } else if (all.includes('【你能做的事】')) {
    content = JSON.stringify(DECIDE);
  }
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});

const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && typeof window.gyPeerRun === 'function', { timeout: 20000 });
await page.waitForTimeout(1200);

await page.evaluate(() => {
  myApiKey = 'sk-test'; myApiUrl = 'https://api.test.local/v1'; myModel = 'm';
  myCharacters.length = 0;
  myCharacters.push(
    { id: 8001, name: '沈之遥', handle: '@shen', persona: '旧书店老板，嘴硬心软', worldbooks: [], actMode: 'auto' },
    { id: 8002, name: '顾迟', handle: '@gu', persona: '夜班医生，话少', worldbooks: [] },
    { id: 8003, name: '陌路人', handle: '@mo', persona: '谁也不认识', worldbooks: [] });
  charRelationships.length = 0;
  charRelationships.push({ id: 'r1', fromId: 8001, toId: 8002, label: '暗恋' }, { id: 'r2', fromId: 8002, toId: 8001, label: '老朋友' });
  globalPosts.length = 0;
  globalPosts.push({ id: 'p9', char: myCharacters[1], text: '今晚又是夜班。', timestamp: Date.now() - 3600000, replies: [], stats: { comments: 0, likes: 0, retweets: 0 } });
  globalTheaterLogs.length = 0;
  window.gyPeerLog.length = 0;
  setAutoFeature('charTheater', true, true);
  setAutoFeature('charAutonomy', true, true);
  setAutoFeature('phoneOn', true, true);
  localStorage.setItem('settingEnableCharInteraction', 'true');
});

// ---------- 一、只跟关系网上的人来往 ----------
const n0 = prompts.length;
const rNo = await page.evaluate(() => gyPeerRun(8003, { manual: true }));
check('不认识任何人的角色：不来往，也不花一次调用', rNo && rNo.blocked === 'norel' && prompts.length === n0, JSON.stringify(rNo));

PEER = { to: '顾迟', kind: 'chat', summary: '问他下班没', lines: [{ who: '沈之遥', t: '下班了吗' }, { who: '顾迟', t: '刚交完班' }, { who: '沈之遥', t: '顺路给你留了本书' }] };
const r1 = await page.evaluate(() => gyPeerRun(8001, { manual: true }));
const p1 = prompts[prompts.length - 1] || '';
check('提示词里只有关系网上的人（有顾迟、没有陌路人）', p1.includes('顾迟') && !p1.includes('陌路人'), p1.slice(0, 200));
check('提示词里带着两个方向的关系（暗恋 / 老朋友）', p1.includes('暗恋') && p1.includes('老朋友'));
check('私聊记下来了', r1 && r1.entry && r1.entry.kind === 'chat' && r1.entry.lines.length === 3, JSON.stringify(r1).slice(0, 200));

const th1 = await page.evaluate(() => ({ a: gyPhoneForgetThreads && 1, bitsA: gyPeerBits(8001, 8002), bitsB: gyPeerBits(8002, 8001) }));
check('沈之遥手机里：自己说的是「我」', th1.bitsA[0].w === '我' && th1.bitsA[1].w === '顾迟', JSON.stringify(th1.bitsA));
check('顾迟手机里：同一段对话，视角反过来', th1.bitsB[0].w === '沈之遥' && th1.bitsB[1].w === '我', JSON.stringify(th1.bitsB));
check('也记进了「Ta们在做什么」（给记忆总结用）', await page.evaluate(() => globalTheaterLogs.some(l => l.peer && l.kind === 'chat')));

// ---------- 二、各种方式 ----------
PEER = { to: '顾迟', kind: 'letter', summary: '写了封没敢寄太长的信', title: '那本书', body: '书我放在柜台最左边了，你下班顺路来拿。别误会，就是正好多了一本。' };
await page.evaluate(() => gyPeerRun(8001, { manual: true }));
const mails = await page.evaluate(() => ({ a: gyPeerMails(8001), b: gyPeerMails(8002) }));
check('写信：寄出的人信箱里是「寄给」', mails.a.length === 1 && mails.a[0].out === true && mails.a[0].title === '那本书', JSON.stringify(mails.a));
check('写信：收信的人信箱里是「来自」', mails.b.length === 1 && mails.b[0].out === false && mails.b[0].who === '沈之遥');

// 对方有没回的信 → 下次提示词里会提
PEER = { kind: 'none' };
await page.evaluate(() => gyPeerRun(8002, { manual: true }));
check('收到信还没回：下次轮到对方时提示词里会提醒', (prompts[prompts.length - 1] || '').includes('你还没回'));

PEER = { to: '顾迟', kind: 'gift', summary: '送了条围巾', item: '灰色围巾', itemDesc: '夜里冷' };
await page.evaluate(() => gyPeerRun(8001, { manual: true }));
check('送东西：真的进了对方的随身物', await page.evaluate(() => !window.gyKit || window.gyKit.list(8002).some(x => x.name === '灰色围巾')));

PEER = { to: '顾迟', kind: 'comment', summary: '在他推文底下留言', comment: '记得吃饭', reply: '嗯' };
await page.evaluate(() => gyPeerRun(8001, { manual: true }));
const cm = await page.evaluate(() => globalPosts[0].replies.map(r => r.char.name + '：' + r.text));
check('评论推文：评论真的出现在对方推文底下，对方还回了一句', cm.includes('沈之遥：记得吃饭') && cm.includes('顾迟：嗯'), JSON.stringify(cm));

PEER = { to: '顾迟', kind: 'call', summary: '半夜打了个电话', minutes: 12, lines: [{ who: '沈之遥', t: '睡了吗' }, { who: '顾迟', t: '在值班' }] };
await page.evaluate(() => gyPeerRun(8001, { manual: true }));
const calls = await page.evaluate(() => gyPeerCalls(8002));
check('打电话：对方通话记录里是呼入', calls.length === 1 && calls[0].out === false && calls[0].minutes === 12, JSON.stringify(calls));

PEER = { to: '顾迟', kind: 'moment', summary: '发了条朋友圈', moment: '今天书店来了只猫。', lines: [{ who: '顾迟', t: '什么颜色的' }] };
await page.evaluate(() => gyPeerRun(8001, { manual: true }));
const mo = await page.evaluate(() => gyPeerMoments(8001));
check('朋友圈：有正文，底下有对方的评论', mo.length === 1 && mo[0].cm[0].by === '顾迟', JSON.stringify(mo));

PEER = { to: '顾迟', kind: 'money', summary: '转了点钱', amount: 52, note: '上次的饭钱' };
await page.evaluate(() => gyPeerRun(8001, { manual: true }));
check('转账：记下来了，对话里显示成转账', await page.evaluate(() => gyPeerBits(8002, 8001).some(x => /转账/.test(x.t))));

// ---------- 三、在 TA 的手机里翻得到 ----------
await page.evaluate(async () => { await gyPhoneMode('all'); });
await page.evaluate(async () => { await gyPhoneOpen(8002); });
await page.waitForTimeout(300);
const desk = await page.evaluate(() => document.body.innerText);
check('手机桌面上多了「信件」「通话」', desk.includes('信件') && desk.includes('通话'));
await page.evaluate(async () => { await gyPhoneOpenApp(8002, 'mail'); });
await page.waitForTimeout(200);
check('打开信件 app 能看到那封信', await page.evaluate(() => document.body.innerText.includes('那本书')));
await page.evaluate(async () => { await gyPhoneOpenApp(8002, 'msg'); gyPhoneMsgOpen('沈之遥'); });
await page.waitForTimeout(200);
const thread = await page.evaluate(() => document.body.innerText);
check('消息 app 里跟沈之遥那条对话：原话、礼物、转账都在', thread.includes('顺路给你留了本书') && thread.includes('灰色围巾') && thread.includes('52'), '');
await page.evaluate(() => { try { gyCloseAllOverlays(); } catch (e) {} });

// ---------- 四、Ta们在做什么页 ----------
await page.evaluate(() => { switchMainView('theater'); renderTheaterPage(); });
await page.waitForTimeout(200);
check('「Ta们在做什么」页顶上有来往的控制栏', await page.evaluate(() => !!document.querySelector('#theaterLogList .gype-bar')));

// ---------- 五、时间管理大师：所有功能都有卡 ----------
const rows = await page.evaluate(() => (gyTaRhythm(myCharacters[0]) || []).map(r => r.gk));
check('自主角色的卡里有：写日记、找熟人、小剧场', rows.includes('act:diary') && rows.includes('act:peer') && rows.includes('act:theater'), rows.join(' '));
check('也有评论别人、给营销号递料这些', rows.includes('act:comment') && rows.includes('act:tabloid'), rows.join(' '));
await page.evaluate(() => gyTaAskHabits(myCharacters[0]));
const cards = await page.evaluate(() => Object.fromEntries((gyTaRhythm(myCharacters[0]) || []).filter(r => r.act).map(r => [r.act, r.text])));
check('一次调用问完：日记 约 3 天一次', /3 天/.test(cards.diary || ''), JSON.stringify(cards));
check('TA 说几乎不做的（匿名区）显示「几乎不做」', cards.anon === '几乎不做', JSON.stringify(cards));

await page.evaluate(() => { myCharacters[0].evSeenAt = Date.now(); });   // 这一步只看"间隔"，先把身上发生的事都当看过了
await page.evaluate(() => runAutonomyTurn(myCharacters[0], true));
const menuP = prompts.filter(p => p.includes('【你能做的事】')).slice(-1)[0] || '';
check('不拦着：刚找过熟人，菜单里照样有「找熟人」', /- peer：/.test(menuP), menuP.slice(0, 100));
check('TA 说几乎不做的事也摆着，TA 自己掂量', /- anon：[^\n]*几乎不会做/.test(menuP));
check('提示词里说了：可以做好几件、可以马上做也可以等有空再做，而且不套固定组合', menuP.includes('也可以好几件') && menuP.includes('等有空了再做') && menuP.includes('别套固定的组合'));
check('自主决策菜单里：告诉 TA 上次说过多久做一次', menuP.includes('大概隔3 天做一次'), (menuP.match(/diary：.{0,120}/) || [''])[0]);

// ---- 不定时重问：没定过的角色做决定时，不会先去问一遍习惯 ----
const hb0 = prompts.filter(p => p.includes('一般隔多久会做一次')).length;
await page.evaluate(() => { myCharacters[1].actMode = 'auto'; myCharacters[1].taHabit = null; });
await page.evaluate(() => runAutonomyTurn(myCharacters[1], true));
check('不会定时 / 自动去问习惯（做决定前不多花调用）', prompts.filter(p => p.includes('一般隔多久会做一次')).length === hb0);
check('没定过的事卡上写「想做就做」', await page.evaluate(() => { gyTodaySet(true); return (document.getElementById('gyToday') || {}).innerHTML.includes('想做就做'); }));

// ---- 做完一件事：顺便定下一次（不另外花调用） ----
DECIDE = { action: 'like', reason: '刷到了', param: '', nextIn: 60, nextSame: 90, sameWhy: '随手' };
const nCalls = prompts.filter(p => p.includes('一般隔多久会做一次')).length;
await page.evaluate(() => { globalPosts.push({ id: 'p10', char: myCharacters[0], text: '书店今天来了只猫。', timestamp: Date.now(), replies: [], stats: { comments: 0, likes: 0, retweets: 0 } }); });
await page.evaluate(() => runAutonomyTurn(myCharacters[1], true));
const likeH = await page.evaluate(() => myCharacters[1].taHabit && myCharacters[1].taHabit.m && myCharacters[1].taHabit.m.like);
check('做完「点赞」：下次大概隔多久用 TA 决策时顺便说的（90 分钟）', likeH && likeH.ms === 90 * 60000 && likeH.why === '随手', JSON.stringify(likeH));
check('而且没有另外去问习惯（不多花调用）', prompts.filter(p => p.includes('一般隔多久会做一次')).length === nCalls);
DECIDE = { action: 'nothing', reason: '在忙', param: '', nextIn: 60 };

// ---- 遇到事了：刚做过的也会摆上桌，还会提前自己拿主意 ----
await page.evaluate(() => { myCharacters[0].evSeenAt = Date.now() - 1000; });
PEER = { to: '沈之遥', kind: 'chat', summary: '回了消息', lines: [{ who: '顾迟', t: '书收到了' }, { who: '沈之遥', t: '嗯' }] };
await page.evaluate(() => { myCharacters[0].nextAutonomyAt = Date.now() + 10 * 3600000; });
await page.evaluate(() => gyPeerRun(8002, { manual: true }));
const ev = await page.evaluate(() => (myCharacters[0].lifeEvents || []).map(e => e.t));
check('别人找了 TA：记成 TA 身上发生的事', ev.some(t => t.includes('顾迟找了你')), JSON.stringify(ev));
await page.evaluate(() => { gyLifeEvent(8001, '在书店门口摔了一跤', 1); });
check('发生了事（权重拉满）：TA 几分钟内就会停下来想想怎么反应', await page.evaluate(() => myCharacters[0].nextAutonomyAt - Date.now() <= 5 * 60000 + 1000));
await page.evaluate(() => runAutonomyTurn(myCharacters[0], true));
const menu2 = prompts.filter(p => p.includes('【你能做的事】')).slice(-1)[0] || '';
check('决策提示词里写着刚发生的事', menu2.includes('摔了一跤') && menu2.includes('顾迟找了你'));
check('看过一次之后，下次不再重复这几件事', await page.evaluate(() => gyTaEventsFor(myCharacters[0]).length === 0));

// ---- 一次做好几件：马上做的按顺序做掉，"等有空再做"的排进队列 ----
await page.evaluate(() => { myCharacters[0].autoQueue = []; });
DECIDE = { plan: [
  { action: 'like', after: 0, reason: '心情好', nextSame: 30, sameWhy: '顺手' },
  { action: 'status', after: 0, reason: '换个状态', param: '在书店哼歌' },
  { action: 'todo_add', after: 120, reason: '晚点记一下', param: '给顾迟回信' }
], nextIn: 5000 };
globalThis.__t0 = Date.now();
const multi = await page.evaluate(async () => { const r = await runAutonomyTurn(myCharacters[0], true); return { n: (r.entries || []).length, queued: r.queued, next: myCharacters[0].nextAutonomyAt - Date.now(), q: gyAutoQueueOf(myCharacters[0]).map(x => [x.key, Math.round((x.at - Date.now()) / 60000)]), status: (myCharacters[0].lifeState || {}).text || JSON.stringify(myCharacters[0].lifeState || '') }; });
check('一口气做了两件（点赞 + 换状态）', multi.n === 2, JSON.stringify(multi));
check('第三件说了"两小时后"：排进队列，不是马上做', multi.queued === 1 && multi.q.length === 1 && multi.q[0][0] === 'todo_add' && Math.abs(multi.q[0][1] - 120) <= 1, JSON.stringify(multi.q));
check('没有上下限：TA 说 5000 分钟后再想，就是 5000 分钟（以前最多 8 小时）', Math.abs(multi.next / 60000 - 5000) < 2, String(multi.next / 60000));
check('做完的那件顺便定了下次（点赞 30 分钟）', await page.evaluate(() => myCharacters[0].taHabit.m.like.ms === 30 * 60000));
check('今天面板里能看到「打算等会儿做」', await page.evaluate(() => { gyTodayRender(); return (document.getElementById('gyToday') || {}).innerHTML.includes('打算等会儿做'); }));
await page.evaluate(() => { myCharacters[0].autoQueue[0].at = Date.now() - 1000; });
const qr = await page.evaluate(async () => { const e = await gyAutonomyRunQueue(myCharacters[0]); return { e, left: gyAutoQueueOf(myCharacters[0]).length, todo: (myCharacters[0].todos || []).map(t => t.text) }; });
check('到点了：队列里那件真的做了（记了新待办）', qr.e && qr.e.queued && qr.left === 0 && qr.todo.some(t => t.includes('给顾迟回信')), JSON.stringify(qr));
// 事件不只来自那几个例子：推文底下有人说话、对方发推、今天是 TA 记着的日子……扫一眼就记下
await page.evaluate(() => { myCharacters[0].evScanAt = Date.now() - 1000; myCharacters[0].anniversaries = [{ label: '书店开业', date: '2020-' + (new Date().getMonth() + 1) + '-' + new Date().getDate() }]; myCharacters[0].evDayKey = ''; });
await page.evaluate(() => { const p = globalPosts.find(x => x.id === 'p10'); p.replies.push({ id: 'rx', parentId: null, char: { ...currentUser, id: 'me' }, text: '好可爱的猫', timestamp: Date.now(), likes: 0, likedBy: [] }); __gyTaScanEvents(); });
const ev2 = await page.evaluate(() => (myCharacters[0].lifeEvents || []).slice(-3).map(e => e.t));
check('有人在 TA 推文底下说话：记成 TA 身上的事', ev2.some(t => t.includes('好可爱的猫')), JSON.stringify(ev2));
check('今天是 TA 记着的日子：也记下', ev2.some(t => t.includes('书店开业')), JSON.stringify(ev2));
DECIDE = { plan: [], nextIn: 2 };
const nn = await page.evaluate(async () => { const r = await runAutonomyTurn(myCharacters[0], true); return { a: r.entry.action, next: myCharacters[0].nextAutonomyAt - Date.now() }; });
check('什么都不做也行；TA 说 2 分钟后再想就是 2 分钟（以前最少 30 分钟）', nn.a === 'nothing' && nn.next <= 2 * 60000 + 500, JSON.stringify(nn));
DECIDE = { action: 'nothing', reason: '在忙', param: '', nextIn: 60 };

await page.evaluate(() => { gyTodaySet(true); });
await page.waitForTimeout(200);
const today = await page.evaluate(() => (document.getElementById('gyToday') || {}).innerHTML || '');
check('今天面板的时间管理大师按「冲着你的 / 跟别人的 / 自己的日子」分组', today.includes('冲着你的') && today.includes('自己的日子'), today.slice(0, 200));

// 关掉小剧场：找熟人 / 小剧场的卡都没了，后台也不动
await page.evaluate(() => setAutoFeature('charTheater', false, true));
const rows2 = await page.evaluate(() => (gyTaRhythm(myCharacters[0]) || []).map(r => r.gk));
check('关掉小剧场：没有「找熟人」「小剧场」这两张卡', !rows2.includes('act:peer') && !rows2.includes('act:theater'), rows2.join(' '));
const n1 = prompts.length;
await page.evaluate(async () => { for (let i = 0; i < 5; i++) await __gyPeerTick(); });
check('关掉小剧场：后台不会自己来往', prompts.length === n1);

// ---------- 六、跟着存档走 ----------
await page.evaluate(() => saveAllData({ immediate: true }));
await page.waitForTimeout(300);
await page.reload();
await page.waitForFunction(() => window.__guyuBooted, { timeout: 20000 });
await page.waitForTimeout(800);
check('重开后来往记录还在', await page.evaluate(() => (window.gyPeerLog || []).length >= 7), await page.evaluate(() => (window.gyPeerLog || []).length));

check('整个过程没有页面报错', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));

await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
