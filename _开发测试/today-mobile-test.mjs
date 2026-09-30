// 📱 手机上的「今天」：底栏第二个按钮变成日历，点进去就是今天面板（时间管理大师、随机事件都在），能滑能点。
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('dialog', d => d.accept());
await page.route(/^https?:\/\//, r => r.abort());
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && typeof window.gyTodaySet === 'function', { timeout: 20000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  myCharacters.length = 0;
  myCharacters.push({ id: 1, name: '沈之遥', persona: 'x', worldbooks: [], actMode: 'auto',
    happenings: [{ at: Date.now() - 600000, what: '你在旧货摊上翻到一本诗集', where: '去旧货市场淘书', feel: 2 }] });
  setAutoFeature('charAutonomy', true, true); setAutoFeature('lifeDice', true, true);
  gyTodaySet(false);
});

// 关着：还是话题广场
await page.evaluate(() => openMobileTrendsView());
check('「今天」关着：底栏还是话题（放大镜）', await page.evaluate(() => document.getElementById('mnav-search').title !== '今天' && !document.getElementById('gyTodayM')));

// 打开
await page.evaluate(() => gyTodaySet(true));
check('「今天」开着：底栏第二个按钮换成日历', await page.evaluate(() => document.getElementById('mnav-search').title === '今天' && document.querySelector('#mnav-search rect') !== null));
await page.tap('#mnav-search');
await page.waitForTimeout(300);
const st = await page.evaluate(() => {
  const m = document.getElementById('gyTodayM');
  const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  return { box: vis(m), trends: vis(document.getElementById('mobileTrendsListContainer')), title: (document.getElementById('mtbCenterTitle') || {}).innerText,
           html: m ? m.innerHTML : '' };
});
check('点进去：看得到今天面板', st.box, JSON.stringify({ box: st.box }));
check('话题标签收起来了（跟桌面右栏一样）', !st.trends);
check('顶栏标题是「今天」', st.title === '今天', st.title);
check('时间管理大师、随机事件都在', st.html.includes('时间管理大师') && st.html.includes('随机事件已触发'));

// 展开之后能往下滑，点得开时间卡
await page.evaluate(() => document.querySelectorAll('#gyTodayM details').forEach(d => d.open = true));
await page.waitForTimeout(200);
const tall = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight * 1.5);
await page.mouse.wheel(0, 800);
await page.evaluate(() => window.scrollBy(0, 800));
await page.waitForTimeout(200);
check('内容长了能往下滑', tall && await page.evaluate(() => window.scrollY > 0));
const tile = await page.$('#gyTodayM [data-rhi]');
if (tile) { await tile.scrollIntoViewIfNeeded(); await tile.tap(); }
await page.waitForTimeout(300);
check('点一张时间卡能弹出详情', await page.evaluate(() => !!document.querySelector('#gyTileModal .gtm-card')));
const inView = await page.evaluate(() => { const r = document.querySelector('#gyTileModal .gtm-card').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; });
check('详情卡不超出手机屏幕', inView);
await page.evaluate(() => { const m = document.getElementById('gyTileModal'); if (m) m.click(); });

// 关掉：还原
await page.evaluate(() => gyTodaySet(false));
check('关掉「今天」：底栏图标、话题广场都还原', await page.evaluate(() => document.getElementById('mnav-search').title === '话题' && !document.getElementById('gyTodayM')
  && getComputedStyle(document.getElementById('mobileTrendsListContainer')).display !== 'none'));

check('整个过程没有页面报错', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
