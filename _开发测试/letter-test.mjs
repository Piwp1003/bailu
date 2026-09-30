// 专测「用户给角色写信 → 角色回信」这条链路，以及角色在别处记不记得这件事
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('dialog', d => d.accept());

let lastPrompt = null;
await page.route(/^https?:\/\//, r => r.abort());
await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=v;return Promise.resolve(v)},getItem(k){return Promise.resolve(this._d[k]??null)},removeItem(k){return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));
await page.route('**/chat/completions', async route => {
  try { lastPrompt = JSON.parse(route.request().postData() || '{}'); } catch (e) { lastPrompt = {}; }
  return route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: '{"title":"见字如面","content":"你信里提到的那件事，我记得。\\n下次见面再说吧。"}' } }] })
  });
});

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof window.sendUserLetter === 'function', { timeout: 15000 });
await page.waitForTimeout(400);

const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok, extra });
const promptText = () => JSON.stringify(lastPrompt && lastPrompt.messages || []);

// ---- 准备角色 ----
await page.evaluate(() => {
  myCharacters.length = 0;
  myCharacters.push({ id: 9001, name: '沈之遥', persona: '沉默寡言的旧书店老板', worldbooks: [], diaryData: { letters: [], diaries: [] }, pendingLetterReplies: [] });
  myApiUrl = 'https://api.test.local/v1'; myApiKey = 'sk-test'; myModel = 'gpt-test';
  currentUser.name = '林';
  letterReplyDelayMin = 60; letterReplyDelayMax = 360;
  currentDiaryCharId = 9001; currentDiaryTab = 'letter';
});

// ---- 1. 功能齐不齐 ----
for (const [label, fn] of [
  ['写信给TA（入口）', 'openUserLetterCompose'],
  ['寄出', 'sendUserLetter'],
  ['到点自动回信', 'resolveDueLetterReplies'],
  ['⚡立即回复', 'forceReplyNowForLetter'],
  ['回复某封来信', 'replyToLetterFromDetail'],
  ['通信记忆', 'buildLetterThreadContext'],
]) check('有「' + label + '」这个功能', await page.evaluate(f => typeof window[f] === 'function', fn));
check('页面上有「✍️ 写信给TA」按钮', (await page.locator('#btnOpenUserLetterCompose').count()) === 1);
check('信件详情页有「↩️ 回复这封信」按钮', (await page.locator('#btnReplyToThisLetter').count()) === 1);
check('设置里能自定义回信等待时间', (await page.locator('#letterReplyDelayMinInput').count()) === 1
  && (await page.locator('#letterReplyDelayMaxInput').count()) === 1);

// ---- 2. 寄一封信出去 ----
const sent = await page.evaluate(() => {
  document.getElementById('userLetterTitleInput').value = '关于那本没还的书';
  document.getElementById('userLetterContentInput').value = '书我弄丢了，对不起。你会生气吗？';
  sendUserLetter();
  const char = myCharacters[0];
  return {
    letterCount: char.diaryData.letters.length,
    author: char.diaryData.letters[0].author,
    pending: (char.pendingLetterReplies || []).length,
    dueInMin: Math.round(((char.pendingLetterReplies[0] || {}).dueAt - Date.now()) / 60000)
  };
});
check('信寄出去了，存进了信件列表', sent.letterCount === 1 && sent.author === 'user', JSON.stringify(sent));
check('排进了「等待回信」队列', sent.pending === 1, JSON.stringify(sent));
check('等待时间落在设置的 60~360 分钟内', sent.dueInMin >= 59 && sent.dueInMin <= 361, sent.dueInMin + ' 分钟');

// ---- 3. 还没回信的时候，角色在聊天里就该记得这件事 ----
const p1 = await page.evaluate(() => buildBasePrompt(myCharacters[0], true, ''));
check('聊天提示词里出现了这封信', p1.includes('关于那本没还的书'), p1.slice(-400));
check('提醒角色「收到了信还没回」', p1.includes('还没来得及回'), p1.slice(-400));

// ---- 4. ⚡立即回复：不等那几个小时 ----
await page.evaluate(() => forceReplyNowForLetter(9001, myCharacters[0].diaryData.letters[0].id));
await page.waitForTimeout(400);
const replied = await page.evaluate(() => {
  const char = myCharacters[0];
  return {
    count: char.diaryData.letters.length,
    newest: char.diaryData.letters[0],
    pending: (char.pendingLetterReplies || []).length
  };
});
check('立即回复真的生成了回信', replied.count === 2 && replied.newest.author === 'char', JSON.stringify(replied.newest).slice(0, 160));
check('回信挂在了用户那封信上（replyToId）', !!replied.newest.replyToId, JSON.stringify(replied.newest.replyToId));
check('回完之后从等待队列里移除', replied.pending === 0, String(replied.pending));

// ---- 5. 生成回信时，角色看得到用户信的原文和历史通信 ----
check('回信的提示词里带了用户来信原文', promptText().includes('书我弄丢了'), promptText().slice(0, 300));
check('回信的提示词里带了通信记录', promptText().includes('通信记录'), promptText().slice(0, 300));

// ---- 6. 回信之后，聊天里也记得 ----
const p2 = await page.evaluate(() => buildBasePrompt(myCharacters[0], true, ''));
check('回信之后聊天提示词里两封信都在', p2.includes('关于那本没还的书') && p2.includes('见字如面'), p2.slice(-500));
check('没有待回信了就不再提醒「还没回」', !p2.includes('还没来得及回'), p2.slice(-300));

// ---- 7. 没通过信的角色，不该平白多出一段 ----
const p3 = await page.evaluate(() => {
  myCharacters.push({ id: 9002, name: '路人甲', persona: 'x', worldbooks: [], diaryData: { letters: [], diaries: [] } });
  return buildBasePrompt(myCharacters[1], true, '');
});
check('没写过信的角色提示词里没有通信段落', !p3.includes('之间的通信'), p3.slice(-200));

// ---- 8. 两个按钮必须**真的看得见**（用户反馈"回信键在哪我怎么没找到"） ----
// 从左边导航直接进「信件与日记」，不经过点 tab 那一步 —— 这条路以前会让「写信给TA」一直隐藏着
await page.evaluate(() => {
  myCharacters[0].diaryData.letters = [
    { id: 'l_char', title: '角色寄来的', content: '见字如面。', date: Date.now(), author: 'char' },
    { id: 'l_old',  title: '老版本存的信（没有 author 字段）', content: '早期数据。', date: Date.now() - 1000 },
    { id: 'l_mine', title: '我写的', content: '我写的信。', date: Date.now() - 2000, author: 'user' },
  ];
  currentDiaryCharId = 9001;
  currentDiaryTab = 'letter';
  switchMainView('diary');
  renderDiaryCharList();          // 这就是导航进来时真正走的那条路
});
await page.waitForTimeout(400);
check('直接进信件页时「✍️ 写信给TA」是可见的（不用先点一下 tab）',
  await page.evaluate(() => getComputedStyle(document.getElementById('btnOpenUserLetterCompose')).display !== 'none'),
  await page.evaluate(() => getComputedStyle(document.getElementById('btnOpenUserLetterCompose')).display));

await page.evaluate(() => openDiaryDetail('l_char'));
await page.waitForTimeout(300);
check('打开角色寄来的信，「↩️ 回复这封信」可见',
  await page.evaluate(() => getComputedStyle(document.getElementById('btnReplyToThisLetter')).display !== 'none'));

await page.evaluate(() => { closeModal('diaryDetailModal'); openDiaryDetail('l_old'); });
await page.waitForTimeout(300);
check('老版本没有 author 字段的信，也要能回复',
  await page.evaluate(() => getComputedStyle(document.getElementById('btnReplyToThisLetter')).display !== 'none'));

await page.evaluate(() => { closeModal('diaryDetailModal'); openDiaryDetail('l_mine'); });
await page.waitForTimeout(300);
check('自己写的信不显示"回复这封信"（回复自己没意义）',
  await page.evaluate(() => getComputedStyle(document.getElementById('btnReplyToThisLetter')).display === 'none'));
await page.evaluate(() => closeModal('diaryDetailModal'));

// 切到日记 tab，写信按钮要收起来
await page.evaluate(() => switchDiaryTab('diary'));
await page.waitForTimeout(300);
check('切到「日记」tab 时写信按钮收起',
  await page.evaluate(() => getComputedStyle(document.getElementById('btnOpenUserLetterCompose')).display === 'none'));
await page.evaluate(() => switchDiaryTab('letter'));

// ---- 9. 信件正文不该混进思维链/代码围栏 ----
const clean = await page.evaluate(() =>
  unwrapAiEnvelopeText('<think>该怎么回这封信呢</think>```json\n{"title":"回信","content":"我不生气。"}\n```'));
check('信件生成的清洗链路能剥掉思维链和围栏',
  !clean.includes('<think>') && !clean.includes('```') && !clean.includes('该怎么回'), clean);

await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
