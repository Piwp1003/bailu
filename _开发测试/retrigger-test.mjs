// 「删掉角色的回复之后，输入框空着点发送 = 让 AI 重新回一次」
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('dialog', d => d.accept());

let calls = [];   // 每次 AI 请求发出去的最后一条 user 消息
await page.route(/^https?:\/\//, r => r.abort());
await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=v;return Promise.resolve(v)},getItem(k){return Promise.resolve(this._d[k]??null)},removeItem(k){return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));
await page.route('**/chat/completions', async route => {
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
  const msgs = body.messages || [];
  calls.push(String((msgs[msgs.length - 1] || {}).content || ''));
  return route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: '{"replies":[{"delay":0,"text":"重新生成的回复 ' + calls.length + '"}]}' } }] })
  });
});

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof window.sendChatMessage === 'function', { timeout: 15000 });
await page.waitForTimeout(400);

const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok, extra });

async function seed(msgs) {
  await page.evaluate((list) => {
    myCharacters.length = 0;
    myCharacters.push({ id: 9001, name: '沈之遥', persona: '旧书店老板', worldbooks: [], autoReplyText: '嗯。' });
    myApiUrl = 'https://api.test.local/v1'; myApiKey = 'sk-test'; myModel = 'gpt-test';
    chatMsgCountMin = 1; chatMsgCountMax = 1;
    globalChats['9001'] = list.map(m => ({
      sender: m.me ? 'me' : (m.sys ? 'system' : 9001),
      text: m.text, timestamp: Date.now(), readBy: ['me']
    }));
    switchMainView('chat'); switchChatSession('9001');
    document.getElementById('chatInput').value = '';
    // 每个场景从干净状态开始：上一轮可能还有没跑完的请求，会被防连点的守卫挡住
    if (typeof currentlyTypingChars !== 'undefined') currentlyTypingChars.clear();
    Object.keys(pendingBatchReplyTimers || {}).forEach(k => {
      clearTimeout(pendingBatchReplyTimers[k]); pendingBatchReplyTimers[k] = null;
    });
    if (typeof updateTypingIndicator === 'function') updateTypingIndicator();
  }, msgs);
  await page.waitForTimeout(300);
}
const lastTexts = () => page.evaluate(() =>
  globalChats['9001'].map(m => (m.sender === 'me' ? '我：' : m.sender === 'system' ? '系统：' : 'TA：') + m.text));

// ---- 1. 正常情形：删掉角色回复后，最后一条是自己说的 ----
calls = [];
await seed([{ me: true, text: '我把伞落这儿了' }]);
await page.click('#chatInputArea .chat-input-row .btn-post');
await page.waitForTimeout(1800);
check('空着点发送触发了一次 AI 请求', calls.length === 1, '实际发了 ' + calls.length + ' 次');
check('重新生成用的是最后那条自己说的话', calls[0] && calls[0].includes('我把伞落这儿了'), (calls[0] || '').slice(0, 120));
check('角色的新回复落地了', (await lastTexts()).slice(-1)[0].startsWith('TA：重新生成的回复'), JSON.stringify(await lastTexts()));

// ---- 2. 连发了好几条：要整批一起重新生成，不能只取最后一句 ----
calls = [];
await seed([
  { me: true, text: '我把伞落这儿了' },
  { me: true, text: '明天来拿行吗' },
  { me: true, text: '大概下午' },
]);
await page.click('#chatInputArea .chat-input-row .btn-post');
await page.waitForTimeout(1800);
check('连发的三条会一起重新生成', calls[0] && calls[0].includes('我把伞落这儿了') && calls[0].includes('明天来拿行吗') && calls[0].includes('大概下午'),
  (calls[0] || '').slice(0, 200));

// ---- 3. 中间夹了系统消息（拍一拍之类）不该打断 ----
calls = [];
await seed([
  { me: true, text: '在吗' },
  { sys: true, text: '"沈之遥" 拍了拍你' },
]);
await page.click('#chatInputArea .chat-input-row .btn-post');
await page.waitForTimeout(1800);
check('系统提示不算打断，照样能重新生成', calls.length === 1 && calls[0].includes('在吗'), '发了 ' + calls.length + ' 次');

// ---- 4. 最后一条是角色说的：不该凭空再生一条 ----
calls = [];
await seed([
  { me: true, text: '在吗' },
  { text: '在。' },
]);
const before = (await lastTexts()).length;
await page.click('#chatInputArea .chat-input-row .btn-post');
await page.waitForTimeout(1800);
check('最后一条是角色说的时候不触发', calls.length === 0, '却发了 ' + calls.length + ' 次');
check('也没有往聊天里塞东西', (await lastTexts()).length === before);
check('会弹提示告诉你为什么，而不是默默没反应',
  await page.evaluate(() => (document.getElementById('toastContainer').innerText || '').includes('没什么可以重新生成')),
  await page.evaluate(() => document.getElementById('toastContainer').innerText));

// ---- 5. 输入框里有字的时候，还是照常发消息（不能把正常发送弄坏） ----
calls = [];
await seed([{ me: true, text: '在吗' }]);
await page.fill('#chatInput', '你在忙吗');
await page.click('#chatInputArea .chat-input-row .btn-post');
await page.waitForTimeout(1200);
const texts5 = await lastTexts();
check('有内容时正常发送，消息进了聊天记录', texts5.some(t => t === '我：你在忙吗'), JSON.stringify(texts5));
check('发完输入框清空', (await page.inputValue('#chatInput')) === '');

// ---- 6. 提示语要能被看见 ----
await seed([{ me: true, text: '在吗' }]);
check('最后一条是自己说的时候，输入框提示"留空点发送"',
  (await page.getAttribute('#chatInput', 'placeholder')).includes('留空点发送'),
  await page.getAttribute('#chatInput', 'placeholder'));
await seed([{ me: true, text: '在吗' }, { text: '在。' }]);
check('最后一条是角色说的时候，提示恢复正常',
  !(await page.getAttribute('#chatInput', 'placeholder')).includes('留空点发送'),
  await page.getAttribute('#chatInput', 'placeholder'));

// ---- 7. 连点两下不能叠两次请求 ----
calls = [];
await seed([{ me: true, text: '在吗' }]);
await page.click('#chatInputArea .chat-input-row .btn-post');
await page.click('#chatInputArea .chat-input-row .btn-post');
await page.waitForTimeout(1800);
check('连点两次只发一次请求', calls.length === 1, '实际发了 ' + calls.length + ' 次');

await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
