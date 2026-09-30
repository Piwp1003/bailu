// 两件事一起测：
//   1) 流式开关现在管不管得到「聊天」——聊天要求模型返回一整段JSON，做不到逐字，
//      但能做到「按气泡」：数组里哪条写完了就先发哪条。核心是 extractStreamingReplies，
//      它必须**宁可少捞一条，也绝不能把半截货当成完整回复发出去**。
//   2) 群聊转私聊——角色可以给某条回复加 [MOVETOCHAT]，这条就进1v1私聊、不进群。
//      开关关掉时标记要被抹干净，绝不能让 "[MOVETOCHAT]" 五个字原样出现在用户眼前。
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('dialog', d => d.accept());

let lastBody = null, lastPrompt = null;
let nextReplies = [{ delay: 1, text: '好' }];

await page.route(/^https?:\/\//, r => r.abort());
await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=v;return Promise.resolve(v)},getItem(k){return Promise.resolve(this._d[k]??null)},removeItem(k){return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));

await page.route('**/chat/completions', async route => {
  try { lastBody = JSON.parse(route.request().postData() || '{}'); } catch (e) { lastBody = {}; }
  lastPrompt = JSON.stringify(lastBody.messages || []);
  const payload = JSON.stringify({ replies: nextReplies });
  if (lastBody && lastBody.stream) {
    // 真的按 SSE 格式回，走的是 streamCompletionText 里读 reader 的那条路
    const chunks = [];
    for (let i = 0; i < payload.length; i += 24) {
      chunks.push('data: ' + JSON.stringify({ choices: [{ delta: { content: payload.slice(i, i + 24) } }] }) + '\n\n');
    }
    chunks.push('data: [DONE]\n\n');
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: chunks.join('') });
  }
  return route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: payload } }] })
  });
});

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof window.triggerAIBatchReply === 'function', { timeout: 15000 });
await page.waitForTimeout(400);

const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok, extra: String(extra).slice(0, 300) });

// ============ 第一部分：半截JSON捞完整回复 ============
check('有 extractStreamingReplies 这个函数',
  await page.evaluate(() => typeof window.extractStreamingReplies === 'function'));

const partial = await page.evaluate(() => {
  const f = window.extractStreamingReplies;
  return {
    // 第三条还没写完 —— 只能捞前两条
    half: f('{"replies":[{"delay":1,"text":"我刚看到"},{"delay":2,"text":"你说的那个"},{"delay":1,"text":"还没写'),
    // 文字里带花括号和转义引号，不能把大括号数错
    braces: f('{"replies":[{"text":"含 {花括号} 和 \\"引号\\" 的一句"}]}'),
    // 思维链拼在最前面（推理模型流式的常见形态），里面的花括号不能影响解析
    think: f('<think>让我想想{</think>{"replies":[{"text":"想好了"}]}'),
    // 刚开了个头，一条都没写完
    empty: f('{"replies":['),
    // 压根不是JSON（模型没按格式来）—— 不许瞎猜，交给最终那次完整解析兜底
    garbage: f('我今天有点累，不想说话。'),
    // 一个字都还没有
    nothing: f(''),
    // 完整的两条
    full: f('{"replies":[{"text":"一"},{"text":"二"}]}'),
  };
});
check('半截JSON里只捞出写完的那两条，没写完的那条不发',
  partial.half.length === 2 && partial.half[1].text === '你说的那个', JSON.stringify(partial.half));
check('回复文字里带花括号/转义引号也能正确切分',
  partial.braces.length === 1 && partial.braces[0].text.includes('{花括号}') && partial.braces[0].text.includes('"引号"'),
  JSON.stringify(partial.braces));
check('思维链里的花括号不会把解析带偏',
  partial.think.length === 1 && partial.think[0].text === '想好了', JSON.stringify(partial.think));
check('数组刚开头、一条都没写完时不发任何东西', partial.empty.length === 0, JSON.stringify(partial.empty));
check('模型没按JSON格式返回时不硬猜（交给最终解析兜底）', partial.garbage.length === 0, JSON.stringify(partial.garbage));
check('空字符串不报错也不返回内容', partial.nothing.length === 0, JSON.stringify(partial.nothing));
check('完整JSON能捞出全部两条', partial.full.length === 2, JSON.stringify(partial.full));

// ============ 准备角色和群聊 ============
async function seed() {
  await page.evaluate(() => {
    myCharacters.length = 0;
    myCharacters.push({ id: 7001, name: '沈之遥', persona: '旧书店老板', worldbooks: [], diaryData: { letters: [], diaries: [] } });
    myCharacters.push({ id: 7002, name: '路明非', persona: '同学', worldbooks: [], diaryData: { letters: [], diaries: [] } });
    groupChats.length = 0;
    groupChats.push({ id: 'g_test', name: '旧书店群', members: [7001], speakOrder: 'all' });
    for (const k of Object.keys(globalChats)) delete globalChats[k];
    globalChats['g_test'] = [];
    globalChats[7001] = [];
    myApiUrl = 'https://api.test.local/v1'; myApiKey = 'sk-test'; myModel = 'gpt-test';
    currentUser.name = '林';
    if (typeof currentlyTypingChars !== 'undefined') currentlyTypingChars.clear();
    currentChatSessionId = 'g_test';
    const v = document.getElementById('view-chat'); if (v) v.style.display = 'block';
  });
}
const groupTexts = () => page.evaluate(() => (globalChats['g_test'] || []).map(m => m.text || ''));
const privTexts = () => page.evaluate(() => (globalChats[7001] || []).map(m => m.text || ''));

// ============ 第二部分：流式开着，聊天也走流式 ============
await seed();
await page.evaluate(() => { enableStreaming = true; });
nextReplies = [{ delay: 1, text: '在的' }, { delay: 1, text: '你说' }];
await page.evaluate(() => { globalChats['g_test'].push({ sender: 'me', text: '在吗', timestamp: Date.now() }); });
await page.evaluate(() => triggerAIBatchReply('g_test', '在吗'));
await page.waitForTimeout(300);

check('流式开着时，聊天的请求体真的带了 stream:true',
  await page.evaluate(() => true) && lastBody && lastBody.stream === true, JSON.stringify(lastBody && lastBody.stream));
let g = await groupTexts();
check('流式路径下两条回复都进了群聊', g.includes('在的') && g.includes('你说'), JSON.stringify(g));
check('流式路径下没有把半截/整坨JSON当成消息发出来',
  g.every(t => !t.includes('"replies"') && !t.includes('{"text"')), JSON.stringify(g));

// ============ 第三部分：流式关掉，行为一模一样 ============
await seed();
await page.evaluate(() => { enableStreaming = false; });
nextReplies = [{ delay: 1, text: '在的' }, { delay: 1, text: '你说' }];
await page.evaluate(() => { globalChats['g_test'].push({ sender: 'me', text: '在吗', timestamp: Date.now() }); });
await page.evaluate(() => triggerAIBatchReply('g_test', '在吗'));
await page.waitForTimeout(300);
check('流式关掉时聊天请求体里没有 stream:true（退回普通请求）',
  !(lastBody && lastBody.stream), JSON.stringify(lastBody && lastBody.stream));
g = await groupTexts();
check('关掉流式后回复内容一模一样', g.includes('在的') && g.includes('你说'), JSON.stringify(g));

// 模型没按格式返回时的兜底：整段当一条发，不能漏
await seed();
await page.evaluate(() => { enableStreaming = true; });
await page.unroute('**/chat/completions');
await page.route('**/chat/completions', route => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ choices: [{ message: { content: '我今天不太想说话。' } }] })
}));
await page.evaluate(() => triggerAIBatchReply('g_test', '在吗'));
await page.waitForTimeout(300);
g = await groupTexts();
check('模型没吐JSON时仍然有兜底（整段当一条发出来）', g.some(t => t.includes('不太想说话')), JSON.stringify(g));

// 恢复正常路由
await page.unroute('**/chat/completions');
await page.route('**/chat/completions', async route => {
  try { lastBody = JSON.parse(route.request().postData() || '{}'); } catch (e) { lastBody = {}; }
  lastPrompt = JSON.stringify(lastBody.messages || []);
  const payload = JSON.stringify({ replies: nextReplies });
  if (lastBody && lastBody.stream) {
    const chunks = [];
    for (let i = 0; i < payload.length; i += 24) {
      chunks.push('data: ' + JSON.stringify({ choices: [{ delta: { content: payload.slice(i, i + 24) } }] }) + '\n\n');
    }
    chunks.push('data: [DONE]\n\n');
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: chunks.join('') });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: payload } }] }) });
});

// ============ 第四部分：群聊转私聊 ============
check('设置里有「允许角色从群聊转私聊」这个开关',
  (await page.locator('#settingEnableGroupMoveToChat').count()) === 1);
const toggleWorks = await page.evaluate(() => {
  const cb = document.getElementById('settingEnableGroupMoveToChat');
  cb.checked = false; saveGlobalInteractionSettings();
  const offOk = enableGroupMoveToChat === false && localStorage.getItem('settingEnableGroupMoveToChat') === 'false';
  cb.checked = true; saveGlobalInteractionSettings();
  const onOk = enableGroupMoveToChat === true;
  loadGlobalInteractionSettings();
  return { offOk, onOk, afterLoad: enableGroupMoveToChat };
});
check('开关能存能读，改完立刻生效（不用刷新）',
  toggleWorks.offOk && toggleWorks.onOk && toggleWorks.afterLoad === true, JSON.stringify(toggleWorks));

// 提示词里的选项：只在群聊出现
await seed();
await page.evaluate(() => { enableStreaming = false; enableGroupMoveToChat = true; });
nextReplies = [{ delay: 1, text: '嗯' }];
await page.evaluate(() => triggerAIBatchReply('g_test', '在吗'));
await page.waitForTimeout(200);
const groupPrompt = lastPrompt;
check('群聊的提示词里给了角色「转私聊」这个选项', groupPrompt.includes('MOVETOCHAT'), groupPrompt.slice(-400));

await page.evaluate(() => triggerAIBatchReply('7001', '在吗'));
await page.waitForTimeout(200);
check('1v1聊天的提示词里没有这段（本来就是私聊，再转没意义）',
  !lastPrompt.includes('MOVETOCHAT'), lastPrompt.slice(-300));

await page.evaluate(() => { enableGroupMoveToChat = false; });
await page.evaluate(() => triggerAIBatchReply('g_test', '在吗'));
await page.waitForTimeout(200);
check('开关关掉后，群聊提示词里也不再给这个选项', !lastPrompt.includes('MOVETOCHAT'), lastPrompt.slice(-300));

// 开关打开：真的转进私聊，且不进群；而且**私聊不占群聊的队**，两边各走各的节奏
await seed();
await page.evaluate(() => { enableStreaming = false; enableGroupMoveToChat = true; });
nextReplies = [
  { delay: 1, text: '[MOVETOCHAT]刚才那事，我私下跟你说' },  // 私聊那条排在**前面**
  { delay: 1, text: '大家好啊' },                              // 群里这条排在后面
];
const runP = page.evaluate(() => triggerAIBatchReply('g_test', '在吗'));

// 关键的一刻：私聊那条排在群聊那条前面，但它不该把群聊卡住。
// 群聊第一条约1秒到；私聊要先"切窗口"（1.5~4秒）再打字，所以这时候还没到。
await page.waitForTimeout(1400);
g = await groupTexts();
let p = await privTexts();
check('私聊那条排在前面，也没有把群聊卡住（群里先出声）',
  g.some(t => t.includes('大家好啊')), JSON.stringify(g));
check('私聊那条还在路上（真人得先切到私聊窗口，不会群里刚说完下一秒就到）',
  p.length === 0, JSON.stringify(p));

await runP;
g = await groupTexts(); p = await privTexts();
check('带 [MOVETOCHAT] 的那条最终进了1v1私聊', p.some(t => t.includes('我私下跟你说')), JSON.stringify(p));
check('带 [MOVETOCHAT] 的那条**没有**进群聊', !g.some(t => t.includes('我私下跟你说')), JSON.stringify(g));
check('同一批里没带标记的那条照常进群聊（两边同时进行，不是二选一）',
  g.some(t => t.includes('大家好啊')), JSON.stringify(g));
check('私聊里那条带了群名引用，不是没头没尾一句话',
  await page.evaluate(() => (globalChats[7001] || []).some(m => m.quote && String(m.quote.name).includes('旧书店群'))),
  await page.evaluate(() => JSON.stringify((globalChats[7001] || []).map(m => m.quote))));
check('"[MOVETOCHAT]" 这五个字没有漏给用户看见',
  ![...g, ...p].some(t => t.toUpperCase().includes('MOVETOCHAT')), JSON.stringify([...g, ...p]));

// 一次可以私戳好几条，顺序不能乱
await seed();
await page.evaluate(() => { enableStreaming = false; enableGroupMoveToChat = true; });
nextReplies = [
  { delay: 1, text: '[MOVETOCHAT]第一句私下的' },
  { delay: 1, text: '群里这句' },
  { delay: 1, text: '[MOVETOCHAT]第二句私下的' },
];
await page.evaluate(() => triggerAIBatchReply('g_test', '在吗'));
g = await groupTexts(); p = await privTexts();
check('一批里能同时有好几条私聊', p.length === 2, JSON.stringify(p));
check('私聊那几条的先后顺序没乱',
  p[0] && p[0].includes('第一句') && p[1] && p[1].includes('第二句'), JSON.stringify(p));
check('中间那条群聊消息照常留在群里', g.some(t => t.includes('群里这句')), JSON.stringify(g));

// 流式路径也要能转私聊（两条路走的是同一段代码，不能只有一条对）
await seed();
await page.evaluate(() => { enableStreaming = true; enableGroupMoveToChat = true; });
nextReplies = [{ delay: 1, text: '[MOVETOCHAT]流式这条也得进私聊' }];
await page.evaluate(() => triggerAIBatchReply('g_test', '在吗'));
g = await groupTexts(); p = await privTexts();
check('流式路径下 [MOVETOCHAT] 同样生效', p.some(t => t.includes('流式这条也得进私聊')), JSON.stringify(p));
check('流式路径下这条也没进群聊', !g.some(t => t.includes('流式这条也得进私聊')), JSON.stringify(g));

// 开关关掉：标记被抹干净，当普通群消息发
await seed();
await page.evaluate(() => { enableStreaming = false; enableGroupMoveToChat = false; });
nextReplies = [{ delay: 1, text: '[MOVETOCHAT]关了开关它还是写了标记' }];
await page.evaluate(() => triggerAIBatchReply('g_test', '在吗'));
g = await groupTexts(); p = await privTexts();
check('开关关掉时，角色硬写的标记被抹掉、内容当普通群消息发',
  g.some(t => t.includes('关了开关它还是写了标记')), JSON.stringify(g));
check('开关关掉时不会偷偷发进私聊', p.length === 0, JSON.stringify(p));
check('开关关掉时也不会把 "[MOVETOCHAT]" 漏给用户',
  !g.some(t => t.toUpperCase().includes('MOVETOCHAT')), JSON.stringify(g));

// 1v1 里角色写了标记也不该"转私聊"（它已经在私聊里了），只抹标记
await seed();
await page.evaluate(() => { enableStreaming = false; enableGroupMoveToChat = true; });
nextReplies = [{ delay: 1, text: '[MOVETOCHAT]我们本来就在私聊' }];
await page.evaluate(() => triggerAIBatchReply('7001', '在吗'));
p = await privTexts();
check('1v1里写了标记只抹掉标记，消息照常发一次（不重复也不丢）',
  p.filter(t => t.includes('我们本来就在私聊')).length === 1, JSON.stringify(p));
check('1v1里也不会把 "[MOVETOCHAT]" 漏给用户',
  !p.some(t => t.toUpperCase().includes('MOVETOCHAT')), JSON.stringify(p));

await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
