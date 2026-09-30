// 📱 小手机：更多小组件 / 款式 / 颜色 / 图片裁剪 / 锁屏图标 / 通知中心上滑收起 / 手机上不显示时间那一行
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });
const shots = process.env.GY_SHOTS;
const vis = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; }, sel);

for (const [vp, tag] of [[{ width: 1280, height: 860 }, '电脑'], [{ width: 390, height: 844 }, '手机']]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/^https?:\/\//, r => r.abort());
  await page.goto(fileUrl(path.join(root, 'index.html')));
  await page.waitForFunction(() => window.__guyuBooted && window.gyPmSet && window.__gyPmWidgetsLoaded, { timeout: 20000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    myCharacters.length = 0;
    myCharacters.push({ id: 9101, name: '沈之遥', handle: '@shen', persona: 'x', worldbooks: [] });
    globalChats['9101'] = [{ sender: 9101, text: '早', timestamp: Date.now() - 3 * 864e5 }, { sender: 9101, text: '今天店里来了只猫', timestamp: Date.now() - 60000 }];
    globalPosts.unshift({ id: 'pw1', char: { id: 9101, name: '沈之遥' }, text: '雨天适合看旧书。', timestamp: Date.now() - 3600000, likes: 3, comments: [] });
    gyPmSet(true);
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => { gyPmUnlock(); });
  await page.waitForTimeout(450);

  // 手机上：状态栏那一行（时间/信号/电量）不显示，只留下拉的小横条
  if (tag === '手机') {
    const sb = await page.evaluate(() => { const s = document.querySelector('#gyPmHome .pm-sb'); const kids = [...s.children].filter(c => getComputedStyle(c).display !== 'none').map(c => c.className); return { h: s.getBoundingClientRect().height, kids }; });
    check(`[${tag}] 不显示时间/信号/电量那一行，只留小横条`, sb.h <= 30 && sb.kids.length === 1 && /pm-ncgrab/.test(sb.kids[0]), JSON.stringify(sb));
  } else {
    check(`[${tag}] 电脑上状态栏照常显示时间`, await page.evaluate(() => /\d{1,2}:\d{2}/.test(document.querySelector('#gyPmHome .pm-sb').innerText)));
  }

  // 锁屏图标
  check(`[${tag}] 桌面上有「锁屏」图标`, await page.evaluate(() => !!document.querySelector('#gyPmHome [data-pmapp="lockscr"]')));
  await page.evaluate(() => gyPmOpen('theater'));
  await page.waitForTimeout(400);
  await page.evaluate(() => gyPmLockNow());
  await page.waitForTimeout(450);
  check(`[${tag}] 在 App 里点锁屏：先回桌面再锁上`, await page.evaluate(() => !document.body.classList.contains('gyphm-app')) && await vis(page, '#gyPmHome .pm-lock'));
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(450);
  check(`[${tag}] 键盘 ↑ / 回车 也能解锁`, !(await vis(page, '#gyPmHome .pm-lock')));
  await page.evaluate(() => { const el = document.querySelector('#gyPmHome [data-pmapp="lockscr"]'); el.scrollIntoView({ block: 'center' }); el.click(); });
  await page.waitForTimeout(300);
  check(`[${tag}] 点「锁屏」图标就锁上`, await vis(page, '#gyPmHome .pm-lock'));
  await page.evaluate(() => gyPmUnlock());
  await page.waitForTimeout(450);

  // 通知中心：上滑收起
  await page.evaluate(() => { globalNotifications.unshift({ text: '沈之遥 给你发了消息', timestamp: Date.now(), chatCharId: 9101 }); gyPmNC(true); });
  await page.waitForTimeout(400);
  check(`[${tag}] 通知中心打开了`, await page.evaluate(() => document.getElementById('gyPmNC').classList.contains('on')));
  const nr = await page.evaluate(() => { const r = document.getElementById('gyPmNC').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - 40 }; });
  await page.mouse.move(nr.x, nr.y); await page.mouse.down(); await page.mouse.move(nr.x, nr.y - 160, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(450);
  check(`[${tag}] 往上一滑就收起来`, await page.evaluate(() => !document.getElementById('gyPmNC').classList.contains('on')));

  // 小组件：每一种都能放上去、画得出来
  const kinds = await page.evaluate(() => Object.keys(window.__gyPmW.WD));
  const want = ['quote', 'fortune', 'food', 'us', 'feed', 'search', 'tags', 'mood', 'year'];
  check(`[${tag}] 新小组件都注册了（今日一句/运势/吃什么/我和TA/动态/搜索/标签/心情/年度进度）`, want.every(k => kinds.includes(k)), kinds.join(','));
  await page.evaluate(() => gyPmNewPage());
  await page.waitForTimeout(600);
  await page.evaluate(() => gyPmEdit(false));
  const bad = await page.evaluate(() => {
    const WD = window.__gyPmW.WD, out = [];
    Object.keys(WD).forEach(k => WD[k].sizes.forEach(z => {
      const vs = (WD[k].vars || [['']]).filter(v => !v[2] || v[2].includes(z));
      (vs.length ? vs : [['']]).forEach(v => { try { const h = WD[k].r({ id: 'x' + k + z + v[0], k, size: z, d: v[0] ? { v: v[0] } : {} }); if (!h || /出错了|undefined|NaN/.test(h)) out.push(k + '/' + z + '/' + v[0]); } catch (e) { out.push(k + '/' + z + '/' + v[0] + ':' + e.message); } });
    }));
    return out;
  });
  check(`[${tag}] 所有小组件 × 所有大小 × 所有款式都画得出来`, bad.length === 0, bad.join(' | '));
  // 放几个上去
  await page.evaluate(() => { gyPmAddW('quote', 'm'); gyPmAddW('food', 's'); gyPmAddW('mood', 't'); gyPmAddW('fortune', 's'); gyPmAddW('us', 'm'); gyPmAddW('search', 'x'); gyPmAddW('tags', 'x'); gyPmAddW('year', 's'); gyPmAddW('feed', 'm'); });
  await page.waitForTimeout(200);
  const pg = await page.evaluate(() => document.querySelectorAll('#gyPmHome .pm-page').length - 1);
  const ovl = await page.evaluate(p => { const rs = [...document.querySelectorAll(`.pm-page[data-page="${p}"] .pm-item`)].map(e => ({ c: e.style.gridColumn, r: e.style.gridRow })); const cells = new Set(); let dup = false; rs.forEach(({ c, r }) => { const [x, w] = c.split('/').map(s => parseInt(s.replace('span', ''))); const [y, h] = r.split('/').map(s => parseInt(s.replace('span', ''))); for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) { const k = (y + b) + ',' + (x + a); if (cells.has(k)) dup = true; cells.add(k); } }); return { n: rs.length, dup }; }, pg);
  check(`[${tag}] 放了 9 个新小组件，各占各的格子不重叠`, ovl.n === 9 && !ovl.dup, JSON.stringify(ovl));
  if (shots) { await page.evaluate(p => gyPmPage(p), pg); await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/pmw-${tag}-new.png` }); }
  // 今日一句：点一下换一句
  const q1 = await page.evaluate(() => document.querySelector('.wk-quote p').innerText);
  await page.evaluate(() => document.querySelector('.wk-quote').click());
  const q2 = await page.evaluate(() => document.querySelector('.wk-quote p').innerText);
  check(`[${tag}] 今日一句：点一下随机换一句`, q1 && q2 && q1 !== q2, q1 + ' → ' + q2);
  // 今天吃什么：摇一下
  await page.evaluate(() => document.querySelector('.wk-food').click());
  await page.waitForTimeout(1500);
  const fd = await page.evaluate(() => document.querySelector('.wk-food b').innerText);
  check(`[${tag}] 今天吃什么：点一下摇出一个`, fd && !/点我/.test(fd), fd);
  // 心情：点一下换
  await page.evaluate(() => document.querySelector('.wk-mood').click());
  const md = await page.evaluate(() => document.querySelector('.wk-mood').innerText);
  check(`[${tag}] 今天心情：点一下选一个`, /开心/.test(md), md);
  // 运势：一天一样（重画还是同一个），小号点一下翻面
  const f1 = await page.evaluate(() => document.querySelector('.wk-fortune').innerText);
  await page.evaluate(() => gyPmHomeRender());
  const f2 = await page.evaluate(() => document.querySelector('.wk-fortune').innerText);
  await page.evaluate(() => document.querySelector('.wk-fortune').click());
  const f3 = await page.evaluate(() => document.querySelector('.wk-fortune').innerText);
  check(`[${tag}] 今日运势：同一天是同一签，点一下翻到幸运色`, f1 === f2 && /宜/.test(f1) && /幸运色/.test(f3), f1 + ' / ' + f3);
  // 我和 TA
  check(`[${tag}] 我和 TA：认识第几天`, /第\s*\d+\s*天/.test(await page.evaluate(() => document.querySelector('.wk-us').innerText)));
  // 动态
  check(`[${tag}] TA 的动态：随机一条角色的推文`, /雨天适合看旧书/.test(await page.evaluate(() => document.querySelector('.wk-feed').innerText)));
  // 搜索
  await page.evaluate(() => document.querySelector('.wk-search').click());
  await page.evaluate(() => { const i = document.getElementById('gyPmSeIn'); i.value = '沈'; i.dispatchEvent(new Event('input')); });
  check(`[${tag}] 搜索条：点开能搜到角色`, /沈之遥/.test(await page.evaluate(() => document.getElementById('gyPmSeRes').innerText)));
  await page.evaluate(() => gyPmCloseSheet());

  // 颜色 / 款式
  const wid = await page.evaluate(() => document.querySelector('.wk-quote').dataset.wid);
  await page.evaluate(id => { gyPmEdit(true); gyPmItemSheet(id); }, wid);
  const sh = await page.evaluate(() => document.getElementById('gyPmSheet').innerText);
  check(`[${tag}] 编辑小组件：有 大小 / 款式 / 颜色`, ['大小', '款式', '颜色', '长条', '手写', '奶油', '摩卡'].every(t => sh.includes(t)), sh.slice(0, 200));
  await page.evaluate(id => { gyPmWSet(id, 'th', 'mocha'); gyPmWSet(id, 'v', 'hand'); }, wid);
  const st = await page.evaluate(id => { const e = document.querySelector(`[data-wid="${id}"]`); return { cls: e.className, bg: getComputedStyle(e).backgroundColor, font: getComputedStyle(e.querySelector('p')).fontFamily }; }, wid);
  check(`[${tag}] 换颜色（摩卡）和款式（手写）马上生效`, /th-mocha/.test(st.cls) && /107, 90, 78/.test(st.bg) && /WenKai|KaiTi|文楷/.test(st.font), JSON.stringify(st));
  await page.evaluate(id => gyPmWSize(id, 'x'), wid);
  await page.waitForTimeout(400);
  check(`[${tag}] 大小能换成长条（一整行宽、一行高）`, await page.evaluate(id => { const e = document.querySelector(`[data-wid="${id}"]`), g = e.parentNode.getBoundingClientRect(), r = e.getBoundingClientRect(); return Math.abs(r.width - g.width) < 2 && r.height > 60 && r.height < 90; }, wid));
  await page.evaluate(() => gyPmCloseSheet());
  // 小组件挑选页：有款式的一排预览，可以先挑款式再放
  await page.evaluate(() => gyPmAddWidget());
  check(`[${tag}] 小组件挑选页：款式一排预览`, await page.evaluate(() => document.querySelectorAll('#gyPmSheet .pm-wg-card[data-k="clock"] .pvs .pv').length >= 5 && document.querySelectorAll('#gyPmSheet .pm-wg-card').length >= 24));
  await page.evaluate(() => { document.querySelector('#gyPmSheet .pm-wg-card[data-k="clock"] .pvs .pv:nth-child(3)').click(); [...document.querySelectorAll('#gyPmSheet .pm-wg-card[data-k="clock"] .nm .chip')][0].click(); });
  check(`[${tag}] 选了「翻页」款式再放上去，就是翻页时钟`, await page.evaluate(() => !!document.querySelector('#gyPmHome .wk-clock .wx-ck.flip')));
  if (shots) { await page.evaluate(() => gyPmEdit(false)); await page.waitForTimeout(200); await page.screenshot({ path: `${shots}/pmw-${tag}-styles.png` }); }

  // ✂️ 图片裁剪：做一张 400×200 的图，裁成 1:1
  await page.evaluate(() => new Promise(res => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#f00'; g.fillRect(0, 0, 200, 200); g.fillStyle = '#00f'; g.fillRect(200, 0, 200, 200);
    c.toBlob(b => { window.__cropFile = new File([b], 'a.png', { type: 'image/png' }); res(); });
  }));
  await page.evaluate(() => { window.__cropOut = null; gyPmCrop(window.__cropFile, 1, 240, u => { window.__cropOut = u; }); });
  await page.waitForTimeout(400);
  check(`[${tag}] 裁剪：在手机屏幕里打开（有框、有缩放条）`, await vis(page, '#gyPmCrop') && await vis(page, '#gyPmCrop .cr-fr') && await vis(page, '#gyPmCrop input[type=range]'));
  if (shots) await page.screenshot({ path: `${shots}/pmw-${tag}-crop.png` });
  // 往左拖到头：框里应该是右半边（蓝色）
  const cr = await page.evaluate(() => { const r = document.querySelector('#gyPmCrop .cr-st').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(cr.x, cr.y); await page.mouse.down(); await page.mouse.move(cr.x - 400, cr.y, { steps: 8 }); await page.mouse.up();
  await page.evaluate(() => { const r = document.querySelector('#gyPmCrop input[type=range]'); r.value = '2'; r.dispatchEvent(new Event('input')); });
  await page.evaluate(() => document.querySelector('#gyPmCrop .ok').click());
  await page.waitForTimeout(200);
  const out = await page.evaluate(() => new Promise(res => { if (!window.__cropOut) return res(null); const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); const d = g.getImageData(i.width / 2, i.height / 2, 1, 1).data; res({ w: i.width, h: i.height, rgb: [d[0], d[1], d[2]] }); }; i.src = window.__cropOut; }));
  check(`[${tag}] 裁剪：拖动+放大后按「完成」，得到正方形、是拖过去的那一块`, out && out.w === out.h && out.w >= 200 && out.rgb[2] > 200 && out.rgb[0] < 60, JSON.stringify(out));
  check(`[${tag}] 裁剪完成后关掉`, !(await vis(page, '#gyPmCrop')));

  check(`[${tag}] 没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 300));
  await ctx.close();
}
await browser.close();
const badR = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - badR.length) + '/' + results.length + ' 通过');
process.exit(badR.length ? 1 : 0);
