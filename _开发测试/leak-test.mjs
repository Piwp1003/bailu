// 专测「原始JSON / 思维链跑进聊天气泡」和「流式开关」
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('dialog', d => d.accept());

let lastBody = null;
await page.route(/^https?:\/\//, r => r.abort());
await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=v;return Promise.resolve(v)},getItem(k){return Promise.resolve(this._d[k]??null)},removeItem(k){return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));
await page.route('**/chat/completions', async route => {
  try { lastBody = JSON.parse(route.request().postData() || '{}'); } catch (e) { lastBody = {}; }
  if (lastBody.stream) {
    return route.fulfill({ status: 200, contentType: 'text/event-stream',
      body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: '流式回来的内容' } }] }) + '\n\ndata: [DONE]\n\n' });
  }
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: '非流式回来的内容' } }] }) });
});

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof window.unwrapAiEnvelopeText === 'function', { timeout: 15000 });
await page.waitForTimeout(400);

const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok, extra });

// ---- 1. 截图里那坨 JSON：不管从哪条路进来，都不能原样显示 ----
const LEAKED = '```json\n' + JSON.stringify({
  replies: [
    { delay: 1, text: '嗯，我们刚吃完。' },
    { delay: 2, text: '不过给你留了饭。' },
    { delay: 1, text: '现在要过来吗？' }
  ],
  stateUpdate: '准备开始收拾厨房和洗碗。',
  statusTypeLabel: '忙'
}, null, 2);

const r1 = await page.evaluate((raw) => unwrapAiEnvelopeText(raw), LEAKED);
check('带```json围栏的信封被拆开', !r1.includes('```') && !r1.includes('"replies"'), r1.slice(0, 120));
check('三句话都还在', r1.includes('刚吃完') && r1.includes('留了饭') && r1.includes('过来吗'), r1);

// 没有闭合围栏的版本（截图里就是这种，模型没写结尾的```）
const r2 = await page.evaluate((raw) => unwrapAiEnvelopeText(raw), LEAKED.replace(/```$/, ''));
check('围栏没闭合也能拆', !r2.includes('```json') && r2.includes('刚吃完'), r2.slice(0, 120));

// 裸 JSON 不带围栏
const r3 = await page.evaluate((raw) => unwrapAiEnvelopeText(raw), LEAKED.replace(/^```json\n/, ''));
check('不带围栏的裸JSON也能拆', !r3.includes('"replies"') && r3.includes('刚吃完'), r3.slice(0, 120));

// 只有 stateUpdate 没有 replies
const r4 = await page.evaluate(() => unwrapAiEnvelopeText('{"stateUpdate":"在厨房洗碗","statusTypeLabel":"忙"}'));
check('只有状态没有台词时转成动作描写', r4 === '(在厨房洗碗)', r4);

// ---- 2. 渲染侧兜底：已经存坏在历史里的旧消息，这次打开就该正常显示 ----
const rendered = await page.evaluate((raw) => renderPlainChatText(raw), LEAKED);
check('历史里存坏的旧消息渲染时也会被拆开', !rendered.includes('```') && rendered.includes('刚吃完'), rendered.slice(0, 160));

// ---- 3. 正常聊天内容一个字都不能被动 ----
const normals = [
  '今天天气不错，要不要出去走走？',
  '(他放下手里的书，抬头看了你一眼)嗯。',
  '我写了段代码给你看：\n```js\nconsole.log(1)\n```\n就这样',
  '{这不是JSON，只是用了花括号}',
];
for (const n of normals) {
  const out = await page.evaluate((x) => unwrapAiEnvelopeText(x), n);
  check('正常内容不被改动：' + n.slice(0, 14), out === n, '变成了：' + out);
}

// ---- 4. 思维链 ----
const think1 = await page.evaluate(() => processReasoningInText('<think>我要想想怎么回</think>你来啦。'));
check('开头的<think>被剥掉', think1.trim() === '你来啦。', think1);

const think2 = await page.evaluate(() => processReasoningInText('好的，我来想想。<think>他刚吃完饭，应该问要不要过来</think>要过来吗？'));
check('夹在正文中间的<think>也被剥掉（以前会漏）',
  !think2.includes('<think>') && !think2.includes('应该问要不要过来') && think2.includes('要过来吗'), think2);

const think3 = await page.evaluate(() => processReasoningInText('<thinking>abc</thinking><think>def</think>正文在这里'));
check('多种思维链标签混用也能剥干净',
  !think3.includes('abc') && !think3.includes('def') && think3.includes('正文在这里'), think3);

const think4 = await page.evaluate(() => processReasoningInText('这里有个<details>折叠面板</details>是角色卡自己的'));
check('<details>不会被全文乱删（角色卡在用）', think4.includes('折叠面板'), think4);

const think5 = await page.evaluate(() => processReasoningInText('<think>全都是思考没有正文</think>'));
check('全被判成思维链时不返回空消息', think5.trim().length > 0, JSON.stringify(think5));

// reasoning_content 走的也是 <think> 这条路
const think6 = await page.evaluate(() => unwrapAiEnvelopeText('<think>先想想</think>```json\n{"replies":[{"delay":1,"text":"好啊"}]}\n```'));
check('思维链+JSON信封同时出现也能处理', think6.trim() === '好啊', think6);

// ---- 5. 流式开关 ----
await page.evaluate(() => {
  myApiUrl = 'https://api.test.local/v1'; myApiKey = 'sk-test'; myModel = 'gpt-test';
});
await page.evaluate(() => { enableStreaming = true; });
await page.evaluate(() => streamCompletionText({ url: myApiUrl, key: myApiKey, model: myModel }, '写点东西', () => {}));
check('开关打开时请求带 stream:true', lastBody && lastBody.stream === true, JSON.stringify(lastBody && lastBody.stream));

await page.evaluate(() => { enableStreaming = false; });
lastBody = null;
const nonStream = await page.evaluate(async () => {
  let got = '';
  await streamCompletionText({ url: myApiUrl, key: myApiKey, model: myModel }, '写点东西', (t, done) => { if (done) got = t; });
  return got;
});
check('开关关掉时请求不带 stream', lastBody && !lastBody.stream, JSON.stringify(lastBody && lastBody.stream));
check('关掉流式后依然能拿到完整内容', nonStream === '非流式回来的内容', nonStream);

const uiOk = await page.evaluate(() => {
  const cb = document.getElementById('settingEnableStreaming');
  if (!cb) return 'DOM里没有这个开关';
  cb.checked = false; saveGlobalInteractionSettings();
  const off = (enableStreaming === false) && localStorage.getItem('settingEnableStreaming') === 'false';
  cb.checked = true; saveGlobalInteractionSettings();
  const on = (enableStreaming === true);
  return off && on ? true : ('off=' + off + ' on=' + on);
});
check('设置页的开关能真正改到变量并存下来', uiOk === true, String(uiOk));

await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
