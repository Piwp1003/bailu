// 浮层式滚动条：平时透明，鼠标移上去/正在滚动时浮现
// ⚠️ 无头 Chromium 默认带 --hide-scrollbars，不关掉的话这个测试永远是绿的（因为压根没滚动条）
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';

const root = process.cwd();
const browser = await launchBrowser(chromium, {
  ignoreDefaultArgs: ['--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on('dialog', d => d.accept());
await page.route(/^https?:\/\//, r => r.abort());
await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=v;return Promise.resolve(v)},getItem(k){return Promise.resolve(this._d[k]??null)},removeItem(k){return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof window.switchChatSession === 'function', { timeout: 15000 });
await page.waitForTimeout(400);

const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok, extra });

await page.evaluate(() => {
  myCharacters.length = 0;
  myCharacters.push({ id: 9001, name: '沈之遥', persona: '旧书店老板', worldbooks: [] });
  globalChats['9001'] = [];
  for (let i = 0; i < 40; i++) {
    globalChats['9001'].push({ sender: i % 2 ? 'me' : 9001, text: '第 ' + i + ' 条消息，凑长度让聊天区滚起来。', timestamp: Date.now() - (40 - i) * 60000, readBy: ['me'] });
  }
  switchMainView('chat'); switchChatSession('9001');
});
await page.waitForTimeout(500);

const area = page.locator('#chatMessagesArea');
const box = await area.boundingBox();

// ---- 1. 滚动条确实占了位置（宽度恒定，才不会一 hover 就跳版） ----
const geo = await page.evaluate(() => {
  const el = document.getElementById('chatMessagesArea');
  return { gutter: el.offsetWidth - el.clientWidth, overflow: el.scrollHeight > el.clientHeight };
});
check('聊天区确实有内容溢出（测的是真滚动条）', geo.overflow);
check('滚动条恒定占 10px 宽', geo.gutter === 10, '实际 ' + geo.gutter + 'px');

// ---- 2. 鼠标移开：不该点亮 ----
await page.mouse.move(2, 2);
await page.waitForTimeout(1600);   // 等"正在滚动"那 1.2 秒的临时点亮过去
check('鼠标不在上面时滑块是灭的', await page.evaluate(() =>
  !document.getElementById('chatMessagesArea').classList.contains('gy-sb-on')));

// ---- 3. 鼠标移上去：点亮 ----
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(300);
check('鼠标移到聊天区上，滑块点亮', await page.evaluate(() =>
  document.getElementById('chatMessagesArea').classList.contains('gy-sb-on')));

// ---- 4. hover 前后布局不能跳 ----
const w1 = await page.evaluate(() => document.getElementById('chatMessagesArea').clientWidth);
await page.mouse.move(2, 2);
await page.waitForTimeout(300);
const w2 = await page.evaluate(() => document.getElementById('chatMessagesArea').clientWidth);
check('显示/隐藏滑块不会让内容重排', w1 === w2, w1 + ' → ' + w2);

// ---- 5. 正在滚动时也点亮，停手后淡出 ----
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.wheel(0, -300);
await page.waitForTimeout(200);
check('滚动时滑块是亮的', await page.evaluate(() =>
  document.getElementById('chatMessagesArea').classList.contains('gy-sb-on')));
await page.mouse.move(2, 2);
await page.waitForTimeout(1600);
check('停手 1.2 秒后自动淡出', await page.evaluate(() =>
  !document.getElementById('chatMessagesArea').classList.contains('gy-sb-on')));

// ---- 6. 不能因为加了滚动条就出现横向滚动 ----
check('页面没有横向溢出', await page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth));

// ---- 7. CSS 写法本身的回归：不能退回 :hover::-webkit-scrollbar-thumb ----
// 那个写法在 Chromium 里画不出来（滚动条伪元素不跟宿主的 :hover 走），
// 以后谁"顺手简化"回去，这条会红。
// file:// 下 fetch 拿不到本地文件，直接从磁盘读
const cssRaw = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, '');   // 注释里会提到那个失效写法，先剥掉
check('CSS 用的是 .gy-sb-on 而不是失效的 :hover 写法',
  css.includes('.gy-sb-on::-webkit-scrollbar-thumb') && !/[^.\w-]:hover::-webkit-scrollbar-thumb/.test(css));
check('scrollbar-color 被圈在 @supports 里（裸写会让整套样式失效）',
  !/^\s*html\s*\{[^}]*scrollbar-color/m.test(css) || css.includes('@supports not selector(::-webkit-scrollbar)'));

await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
