// v218：🐛 右键消息菜单「闪一下就没了」（输入框看门狗把它当成忘了关的菜单收掉）+ 菜单整块都在屏幕里
//       📄 弹窗变成页面：内容多的点开是一整页（‹ 返回 / 系统返回 / 换页都能收）、小弹窗不动、能关
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';

const root = process.cwd();
const BAILU = fs.existsSync(path.join(root, 'js', '90-bailu-cards.js'));
const PLUG = JSON.parse(fs.readFileSync(path.join(root, '插件', '新玩法', '新玩法全家桶.json'), 'utf8'));
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });
const tag = BAILU ? '[白露]' : '[谷雨]';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function open(mob) {
  const ctx = await browser.newContext(mob ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.dismiss());
  await page.route(/^https?:\/\//, r => r.abort());
  await page.goto(fileUrl(path.join(root, 'index.html')));
  await page.waitForFunction(() => window.__guyuBooted && typeof executePluginOnLoad === 'function' && window.gyPagesSet, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.evaluate(({ PLUG }) => {
    myCharacters.push({ id: 9991, name: '顾言', persona: 'x', worldbooks: [], diaryData: { letters: [], diaries: [] } });
    globalChats['9991'] = []; const T = Date.now();
    for (let i = 0; i < 10; i++) globalChats['9991'].push({ sender: i % 2 ? 9991 : 'me', text: '消息' + i, timestamp: T - (10 - i) * 60000, readBy: [] });
    PLUG.forEach(p => executePluginOnLoad(p));
    switchMainView('chat'); switchChatSession('9991');
  }, { PLUG });
  await page.waitForTimeout(2500);
  return { page, errs };
}

for (const mob of [false, true]) {
  const W = mob ? '手机' : '电脑';
  const { page, errs } = await open(mob);
  // ===== 右键菜单：开着不会被收掉，整块在屏幕里 =====
  const bubbles = page.locator('#chatMessagesArea .chat-bubble');
  const last = bubbles.nth((await bubbles.count()) - 1);
  await last.scrollIntoViewIfNeeded();
  const bx = await last.boundingBox();
  if (mob) await page.evaluate(async () => { const b = [...document.querySelectorAll('#chatMessagesArea .chat-bubble')].pop(); const r = b.getBoundingClientRect(); const idx = +/showChatContextMenu\(event,\s*(\d+)\)/.exec(b.getAttribute('oncontextmenu'))[1]; chatBubbleTouchStart({ touches: [{ pageX: r.left + 10 + scrollX, pageY: r.top + 10 + scrollY }] }, idx); await new Promise(z => setTimeout(z, 700)); return JSON.stringify({ idx, sid: currentChatSessionId, n: (globalChats[currentChatSessionId] || []).length, d: document.getElementById('chatContextMenu').style.display }); });
  else await page.mouse.click(bx.x + 10, bx.y + 10, { button: 'right' });
  const seen = [];
  for (let i = 0; i < 9; i++) { seen.push(await page.evaluate(() => getComputedStyle(document.getElementById('chatContextMenu')).display)); await page.waitForTimeout(400); }
  const geo = await page.evaluate(() => { const r = document.getElementById('chatContextMenu').getBoundingClientRect(); return { t: r.top | 0, b: r.bottom | 0, l: r.left | 0, r: r.right | 0, vw: innerWidth, vh: innerHeight, items: document.getElementById('chatContextMenu').children.length }; });
  check(`${tag}${W} 右键 / 长按消息：菜单打开后一直在（以前 2 秒内被收掉，看着像一直闪）`, seen.every(s => s === 'flex'), seen.join(','));
  check(`${tag}${W} 右键菜单（加了表情、番外那几项变高了）整块都在屏幕里`, geo.t >= 0 && geo.l >= 0 && geo.b <= geo.vh && geo.r <= geo.vw && geo.items >= 7, JSON.stringify(geo));
  await page.evaluate(() => { document.getElementById('chatContextMenu').style.display = 'none'; });

  // ===== 弹窗变成页面 =====
  const pg = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const vis = el => el && el.isConnected && getComputedStyle(el).display !== 'none';
    const out = {};
    out.on = document.body.classList.contains('gy-pages');
    // 插件面板
    gyxReactOpen(); await sleep(300);
    let ov = document.getElementById('gyxRxOv'); const r = ov.getBoundingClientRect(); const main = document.querySelector('.main-content').getBoundingClientRect();
    out.plug = { page: ov.classList.contains('gy-aspage'), title: (ov.querySelector('.gyp-title') || {}).textContent, hdHidden: getComputedStyle(ov.querySelector('.gyx-hd')).display === 'none', l: r.left | 0, w: r.width | 0, ml: main.left | 0, mw: main.width | 0, iw: innerWidth, h: r.height | 0, ih: innerHeight };
    ov.querySelector('.gyp-back').click(); await sleep(150); out.plug.closed = !vis(document.getElementById('gyxRxOv'));
    // 核心的大弹窗
    openMemoryModal(9991); await sleep(300);
    ov = document.getElementById('memoryModal'); out.mem = { page: ov.classList.contains('gy-aspage'), title: (ov.querySelector('.gyp-title') || {}).textContent };
    // 系统返回键 / 左滑：一样能退
    window.gyBack('test'); await sleep(150); out.mem.backClosed = !vis(ov);
    // 小弹窗：还是小弹窗
    openEmoticonPicker(); await sleep(300); const em = document.getElementById('emoticonPickerModal'); out.small = { shown: vis(em), page: em.classList.contains('gy-aspage') }; closeModal('emoticonPickerModal'); await sleep(100);
    // 拖过大小的弹窗：变成页面时不被拖的大小卡住，变回弹窗时大小还回去
    const box = document.querySelector('#memoryModal .modal-box'); box.style.setProperty('width', '333px', 'important');
    openMemoryModal(9991); await sleep(300); out.sized = { w: box.getBoundingClientRect().width | 0 };
    // 换页：开着的页面一起收
    switchMainView('home'); await sleep(200); out.sized.navClosed = !vis(document.getElementById('memoryModal'));
    // 关掉：回到弹窗
    gyPagesSet(false); await sleep(100);
    gyxReactOpen(); await sleep(300); ov = document.getElementById('gyxRxOv'); out.off = { page: ov.classList.contains('gy-aspage'), bar: !!ov.querySelector('.gyp-bar') }; ov.remove();
    openMemoryModal(9991); await sleep(300); out.off.restored = box.style.getPropertyValue('width'); closeModal('memoryModal');
    out.sw = !!document.getElementById('gyPagesSw') || (openSettingsPanel('appearance'), !!document.getElementById('gyPagesSw'));
    gyPagesSet(true); await sleep(100);
    // 打开以后再整个重画（换内容）：顶栏还在，不会叠出两条
    gyxReactOpen(); await sleep(200); gyxReactOpen(); await sleep(300); ov = document.getElementById('gyxRxOv'); out.redraw = { bars: ov.querySelectorAll('.gyp-bar').length, page: ov.classList.contains('gy-aspage') }; ov.remove();
    box.style.removeProperty('width');
    return out;
  });
  const p = pg.plug;
  check(`${tag}${W} 插件面板点开是一整页（${mob ? '整屏' : '占中间一栏'}），顶上「‹ + 标题」，原来的标题栏和 ✕ 收起来`, pg.on && p.page && /气泡表情回应/.test(p.title) && p.hdHidden && p.h >= p.ih - 2 && (mob ? p.w >= p.iw - 2 : (Math.abs(p.l - p.ml) <= 2 && Math.abs(p.w - p.mw) <= 2)), JSON.stringify(pg.plug));
  check(`${tag}${W} 点顶栏的 ‹ 退出页面`, p.closed, JSON.stringify(pg.plug));
  check(`${tag}${W} 核心的大弹窗（记忆管理）也是一页；系统返回键 / 左滑也能退`, pg.mem.page && /记忆管理/.test(pg.mem.title) && pg.mem.backClosed, JSON.stringify(pg.mem));
  check(`${tag}${W} 小弹窗（选表情）还是小弹窗`, pg.small.shown && !pg.small.page, JSON.stringify(pg.small));
  check(`${tag}${W} 拖过大小的弹窗变成页面时照样铺满；点左边栏换页，开着的页面跟着收`, pg.sized.w > 333 && pg.sized.navClosed, JSON.stringify(pg.sized));
  check(`${tag}${W} 外观设置里能关；关掉＝回到弹窗，拖过的大小还回去`, pg.sw && !pg.off.page && !pg.off.bar && pg.off.restored === '333px', JSON.stringify(pg.off));
  check(`${tag}${W} 面板整个重画以后顶栏只有一条`, pg.redraw.bars === 1 && pg.redraw.page, JSON.stringify(pg.redraw));
  check(`${tag}${W} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
  await page.context().close();
}
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
