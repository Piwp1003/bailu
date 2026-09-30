// 用真实角色卡的状态栏正则，验证：
//   1. 卡片能不能渲染出来（角色专属正则命中）
//   2. 默认是不是收起状态
//   3. 点一下能不能展开（卡片自带的 <script> 有没有被 id 加后缀弄坏）
//
// 卡片数据是从用户给的 PNG 角色卡里解出来的（tEXt 块里的 chara/ccv3）。
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';

const root = process.cwd();
const card = JSON.parse(fs.readFileSync('_test/card-闻述-状态栏.json', 'utf-8'));

const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|favicon|manifest/i.test(t)) errors.push('CONSOLE: ' + t);
});
page.on('dialog', d => d.accept());

await page.route('**/localforage*.js', r => r.fulfill({ contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=JSON.parse(JSON.stringify(v));return Promise.resolve(v)},getItem(k){return Promise.resolve(this._d[k]!==undefined?this._d[k]:null)},removeItem(k){delete this._d[k];return Promise.resolve()},config(){}};` }));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));

// 卡片状态栏的正文，按 findRegex 要求的字段顺序构造
const statusText = `<闻述状态>
地点：旧书店
时间：雨夜
着装：深色风衣
状态：沉默
脑内：那本册子
想舔哪：无
在哪做：无
多久：无
触发条件：无
搜索普通：书店旧闻
搜索色情：无
搜索秘密1：册子的来历
搜索秘密2：无
评价内容：他今天话很少
评价来源：旁观者
</闻述状态>`;

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof renderStoryStudio === 'function', { timeout: 15000 });
await page.waitForTimeout(500);

const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok, extra });

// 把卡片的正则按白露的格式装进去（markdownOnly -> displayOnly，绑定到这个角色）
await page.evaluate(({ card }) => {
  myCharacters.push({ id: 7001, name: '闻述', persona: '沉默的人。', worldbooks: [] });
  const m = card.findRegex.match(/^\/([\s\S]*)\/([a-z]*)$/);
  regexScripts.push({
    id: 'rx_wenshu_status',
    name: card.scriptName,
    find: card.findRegex,
    replace: card.replaceString,
    isRegex: true,
    target: 'ai_output',
    enabled: true,
    displayOnly: card.markdownOnly === true,   // 卡片里标的是 markdownOnly
    promptOnly: card.promptOnly === true,
    minDepth: null, maxDepth: null,
    charScope: ['7001'],                        // 字符串，模拟界面添加的那条路径
  });
  enableChatScriptExecution = true;             // 用户说这个开关是开着的
  saveAllData();
}, { card });

// —— 渲染 ——
await page.evaluate(({ statusText }) => {
  storySessions = [{
    id: 'ss_cardtest', title: '卡片测试', outline: '', extraChars: '',
    chars: [7001], wordCount: 300, secondPerson: true, maxHistory: 20, apiMode: 'sub',
    turns: [{ id: 't_card', role: 'ai', charId: 7001, timestamp: Date.now(), text: '他把册子推了过来。\n' + statusText }],
    chapters: [], createdAt: Date.now(), updatedAt: Date.now(),
  }];
  currentStorySessionId = 'ss_cardtest';
  switchMainView('storyStudio');
  openStorySession('ss_cardtest');
}, { statusText });
await page.waitForTimeout(700);

check('卡片渲染出来了（角色专属正则命中）',
  (await page.locator('#ssTurns .gy-frontend').count()) === 1,
  '气泡内容: ' + (await page.evaluate(() => {
    const b = document.querySelector('#ssTurns .ss-bubble');
    return b ? b.innerHTML.slice(0, 160) : '(无气泡)';
  })));

check('正文没有被卡片吃掉', await page.evaluate(() =>
  (document.querySelector('#ssTurns .ss-bubble')?.textContent || '').includes('他把册子推了过来')));

check('原始标签已被替换掉，没有裸露', await page.evaluate(() =>
  !(document.querySelector('#ssTurns .ss-bubble')?.textContent || '').includes('<闻述状态>')));

// —— 卡片是一整份 HTML 文档，现在走 iframe 隔离渲染 ——
// 这一段以前是直接在主文档里找卡片元素的。现在卡片被关进 iframe 了，
// 要进到 frame 里面去查——这本身就是修好之后才有的结构：
// 之前卡片的 <script> 是 innerHTML 塞进来的，**根本不会执行**，所谓"点击展开"
// 从来就没真的跑起来过，只是因为默认样式恰好是收起的才看着像对的。
await page.waitForTimeout(1500);

const frameInfo = await page.evaluate(() => {
  const fr = document.querySelector('#ssTurns iframe.gy-frontend-frame');
  if (!fr) return { found: false };
  return { found: true, height: Math.round(fr.getBoundingClientRect().height) };
});
check('卡片被关进独立 iframe 渲染', frameInfo.found, JSON.stringify(frameInfo));
check('iframe 高度是按卡片实际内容撑开的', frameInfo.found && frameInfo.height > 60,
  JSON.stringify(frameInfo));

// 卡片的样式没有漏出去污染白露自己
check('卡片样式没有漏进主文档', await page.evaluate(() =>
  document.querySelectorAll('#ssTurns style, #ssTurns meta, #ssTurns title, #ssTurns link').length === 0));

const frame = page.frames().find(f => f.url() === 'about:srcdoc' || f.name().startsWith('gyfe_'))
           || page.frames().find(f => f !== page.mainFrame());
check('能拿到卡片的 iframe 文档', !!frame);

// —— 默认收起 ——
const collapsed = await frame.evaluate(() => {
  const bd = document.querySelector('[id^="o3-bd"]');
  if (!bd) return { found: false, ids: Array.from(document.querySelectorAll('[id]')).slice(0,8).map(e=>e.id) };
  return { found: true, maxHeight: bd.style.maxHeight, realHeight: bd.getBoundingClientRect().height };
});
check('卡片默认是收起的', collapsed.found && collapsed.realHeight < 5, JSON.stringify(collapsed));

// —— 卡片自带的 <script> 真的跑起来了没有 ——
const scriptRan = await frame.evaluate(() => typeof window.o3Tog === 'function');
check('卡片自带的 <script> 真的执行了（以前 innerHTML 塞进去根本不会跑）', scriptRan);

// —— 真点一下 ——
const beforeH = await frame.evaluate(() =>
  document.querySelector('[id^="o3-bd"]')?.getBoundingClientRect().height);
await frame.locator('[onclick*="o3Tog"]').first().click();
await page.waitForTimeout(1000);   // 卡片有 .7s 过渡动画
const afterState = await frame.evaluate(() => {
  const bd = document.querySelector('[id^="o3-bd"]');
  return { maxHeight: bd?.style.maxHeight, height: bd?.getBoundingClientRect().height };
});
check('点一下能展开', afterState.height > (beforeH || 0) + 20,
  `点前高 ${beforeH}，点后 ${JSON.stringify(afterState)}`);

// 展开之后外面的 iframe 应该跟着变高
const grownH = await page.evaluate(() =>
  Math.round(document.querySelector('#ssTurns iframe.gy-frontend-frame').getBoundingClientRect().height));
check('展开后 iframe 自动跟着长高', grownH > frameInfo.height + 20,
  `展开前 ${frameInfo.height}px，展开后 ${grownH}px`);

// 再点一次收回去
await frame.locator('[onclick*="o3Tog"]').first().click();
await page.waitForTimeout(1000);
const reCollapsed = await frame.evaluate(() => {
  const bd = document.querySelector('[id^="o3-bd"]');
  return { height: bd?.getBoundingClientRect().height };
});
check('再点一下能收回去', reCollapsed.height < 5, JSON.stringify(reCollapsed));

// —— 通栏布局 ——
const layout = await page.evaluate(() => {
  const turns = document.getElementById('ssTurns');
  const bubble = document.querySelector('#ssTurns .ss-bubble');
  if (!turns || !bubble) return null;
  const tw = turns.clientWidth - 30;  // 减掉 padding
  const bw = bubble.getBoundingClientRect().width;
  return { turnsInner: tw, bubbleWidth: bw, ratio: bw / tw };
});
check('气泡是通栏的（占满可用宽度）', layout && layout.ratio > 0.95,
  JSON.stringify(layout));

await page.screenshot({ path: '_test/card-shot.png' });
await browser.close();

const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
if (errors.length) { console.log('\n页面报错:'); errors.slice(0, 5).forEach(e => console.log('  ' + e)); }
process.exit(bad.length ? 1 : 0);
