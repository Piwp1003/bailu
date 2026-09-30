// 把聊天真正发给模型的那份 prompt 原样抓下来（不是读代码猜的，是拦请求拿到的）
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('dialog', d => d.accept());

let captured = null;
await page.route(/^https?:\/\//, r => r.abort());
await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=v;return Promise.resolve(v)},getItem(k){return Promise.resolve(this._d[k]??null)},removeItem(k){return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));
await page.route('**/chat/completions', async route => {
  try { captured = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: '{"replies":[{"delay":1,"text":"嗯。"}]}' } }] }) });
});

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof window.triggerAIBatchReply === 'function', { timeout: 15000 });
await page.waitForTimeout(500);

// 造一个尽量"典型"的场景：有人设、有世界书、有关系、有历史、有导演耳语
await page.evaluate(() => {
  currentUser.name = '阿岚';
  currentUser.gender = '女';
  currentUser.persona = '大学刚毕业，在一家小出版社做校对，话不多但很会听人说话。';
  myApiUrl = 'https://api.test.local/v1'; myApiKey = 'sk-test'; myModel = 'gpt-test';

  allowActionTags = true;
  humanFeelEnabled = true;
  tpesEnabled = true;
  enableAnniversary = true;
  chatWordLimit = 80; chatMsgCountMin = 1; chatMsgCountMax = 3;
  chatReplyStyleMode = 'limit';
  quietHoursEnabled = true; quietHoursStart = '01:00'; quietHoursEnd = '09:00';

  worldbooks.length = 0;
  worldbooks.push({
    id: 1, title: '青柏巷旧书店', category: '默认',
    content: '沈之遥的书店开在青柏巷尽头，门脸很窄，招牌上的字掉了漆。店里常年放着一台老收音机。',
    isGlobal: false, keywords: '书店,青柏巷', weight: 50, priority: 0, probability: 100
  });

  myCharacters.length = 0;
  myCharacters.push({
    id: 9001, name: '沈之遥', handle: '@shen',
    persona: '三十四岁，青柏巷旧书店老板。话少，答话常常隔半拍。不喜欢解释自己。对熟人会有一点笨拙的关心，但不会说出口。',
    worldbooks: [1],
    memorySummary: '最近在推特上抱怨过梅雨天书页发霉；转发过一条关于绝版书的帖子。',
    chatSummary: '【2026-08-20】阿岚说想找一本绝版的《夜航船》，沈之遥说帮她留意。\n【2026-08-22】聊到梅雨天，沈之遥说店里进了除湿机。',
    lifeState: { activity: '在店里整理刚收来的一批旧书', updatedAt: Date.now() - 5 * 3600000 },
    lifeStateHistory: ['关店后在楼上煮面', '去旧货市场收书'],
    diaryData: {
      letters: [{ id: 'l1', title: '关于那本《夜航船》', content: '书我托人问到了，但对方要价太高。你要是真想要，我再想想办法。', date: Date.now() - 26 * 3600000, author: 'user' }],
      diaries: []
    },
    pendingLetterReplies: [{ id: 'p1', letterId: 'l1', dueAt: Date.now() + 7200000 }],
    autoReplyText: '嗯。'
  });

  globalChats['9001'] = [
    { sender: 9001, text: '（把收音机的音量拧小了些）来了。', timestamp: Date.now() - 3 * 3600000, readBy: ['me'] },
    { sender: 'me',  text: '外面下雨了，我进来躲会儿。', timestamp: Date.now() - 3 * 3600000 + 60000, readBy: ['9001'] },
    { sender: 9001, text: '伞放门口。', timestamp: Date.now() - 3 * 3600000 + 120000, readBy: ['me'] },
    { sender: 9001, text: '（推过来一杯热水）', timestamp: Date.now() - 3 * 3600000 + 130000, readBy: ['me'] },
    { sender: 'me',  text: '你这除湿机买了？', timestamp: Date.now() - 40 * 60000, readBy: ['9001'] },
  ];

  switchMainView('chat');
  switchChatSession('9001');
  // 导演耳语也开一下，让这段也出现在 prompt 里
  const anBox = document.getElementById('chatAuthorsNoteBox');
  if (anBox) anBox.style.display = 'block';
  const anInput = document.getElementById('chatAuthorsNote');
  if (anInput) anInput.value = '让沈之遥这一轮稍微多说两句，别只回一个字。';
});
await page.waitForTimeout(300);

await page.evaluate(() => triggerAIBatchReply('9001', '我把那把伞落这儿了，明天来拿行吗？'));
await page.waitForTimeout(1200);

if (!captured) { console.error('没抓到请求'); process.exit(1); }
fs.writeFileSync(path.join(root, '_test', 'chat-prompt-dump.json'), JSON.stringify(captured, null, 2), 'utf8');

const msgs = captured.messages || [];
console.log('共 ' + msgs.length + ' 条 message；请求体其余字段：',
  JSON.stringify(Object.fromEntries(Object.entries(captured).filter(([k]) => k !== 'messages'))));
msgs.forEach((m, i) => {
  console.log('\n' + '='.repeat(80));
  console.log(`[${i}] role = ${m.role}   (${String(m.content).length} 字)`);
  console.log('='.repeat(80));
  console.log(m.content);
});

await browser.close();
