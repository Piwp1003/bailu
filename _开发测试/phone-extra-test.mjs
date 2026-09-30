// 📱 小手机 v196：灵动岛 / 小组件随意摆 + 拉边调大小 / 字能改 / 一行 4 或 5 个 / 打开方式 / 小窗 / 壁纸景深 + 3D / 实况视频
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });
const shots = process.env.GY_SHOTS;
const vis = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0 && r.width > 0 && r.height > 0; }, sel);
const noToast = page => page.evaluate(() => document.querySelectorAll('.toast-container').forEach(e => e.style.display = 'none'));

for (const [vp, tag] of [[{ width: 1280, height: 900 }, '电脑'], [{ width: 390, height: 844 }, '手机']]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/^https?:\/\//, r => r.abort());
  await page.goto(fileUrl(path.join(root, 'index.html')));
  await page.waitForFunction(() => window.__guyuBooted && window.gyPmSet && window.__gyPmIslandLoaded && window.gyLiveTake, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    myCharacters.length = 0;
    myCharacters.push({ id: 9101, name: '沈之遥', handle: '@shen', persona: 'x', worldbooks: [] });
    globalChats['9101'] = [{ sender: 9101, text: '早', timestamp: Date.now() - 60000 }];
    gyPmSet(true);
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => gyPmUnlock());
  await page.waitForTimeout(450);
  await noToast(page);

  // ---- 🏝 灵动岛 ----
  { await page.waitForTimeout(1200); check(`[${tag}] 平时不显示灵动岛，有事才冒出来`, !(await vis(page, '#gyPmIsl'))); }
  await page.evaluate(() => { globalNotifications.unshift({ text: '沈之遥 给你发了消息：今天下雨了', chatCharId: 9101, timestamp: Date.now() }); });
  await page.waitForTimeout(1600);
  const isl = await page.evaluate(() => { const d = document.getElementById('gyPmIsl'); return { cls: d.className, txt: d.innerText, w: d.getBoundingClientRect().width }; });
  check(`[${tag}] 来通知：灵动岛展开，显示是谁、说了什么`, /big/.test(isl.cls) && /沈之遥/.test(isl.txt) && /下雨/.test(isl.txt), JSON.stringify(isl));
  if (shots) { await page.waitForTimeout(500); await page.screenshot({ path: `${shots}/px-${tag}-island.png` }); }
  await page.evaluate(() => document.getElementById('gyPmIsl').click());
  await page.waitForTimeout(500);
  check(`[${tag}] 点灵动岛上的通知：直接进那个聊天`, await page.evaluate(() => document.body.classList.contains('gyphm-app') && String(currentChatSessionId) === '9101'));
  // ---- 左上角 ----
  check(`[${tag}] 左上角是「‹」返回键（没有小方格了）`, await page.evaluate(() => { const l = document.querySelector('#gyPmBar .nav .l'); return !l.classList.contains('home') && !l.querySelector('.hm'); }));
  // ---- 🪟 小窗 ----
  await page.evaluate(() => document.querySelector('#gyPmBar .nav .r').click());
  await page.waitForTimeout(500);
  const fl = await page.evaluate(() => ({ on: document.body.classList.contains('gyphm-float'), home: getComputedStyle(document.getElementById('gyPmHome')).display, tf: document.querySelector('.main-content').style.transform, box: document.getElementById('gyPmFloat').getBoundingClientRect().width }));
  check(`[${tag}] 右上角「小窗」：App 缩成小窗浮在桌面上`, fl.on && fl.home !== 'none' && /scale\(0\.4/.test(fl.tf) && fl.box > 100, JSON.stringify(fl));
  if (shots) await page.screenshot({ path: `${shots}/px-${tag}-float.png` });
  // 拖一下小窗
  const gb = await page.evaluate(() => { const r = document.querySelector('#gyPmFloat .gb b').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 3, fx: document.getElementById('gyPmFloat').getBoundingClientRect().left }; });
  await page.mouse.move(gb.x, gb.y); await page.mouse.down(); await page.mouse.move(gb.x - 150, gb.y - 120, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(500);
  const fx2 = await page.evaluate(() => document.getElementById('gyPmFloat').getBoundingClientRect().left);
  check(`[${tag}] 小窗能拖，松手自己靠到边上`, fx2 < gb.fx - 40, gb.fx + ' → ' + fx2);
  await page.evaluate(() => document.querySelector('#gyPmFloat [data-fl="max"]').click());
  await page.waitForTimeout(500);
  check(`[${tag}] 小窗点「⤢」放回全屏`, await page.evaluate(() => !document.body.classList.contains('gyphm-float') && !document.querySelector('.main-content').style.transform && document.body.classList.contains('gyphm-app')));
  await page.evaluate(() => { gyPmFloat(true); });
  await page.waitForTimeout(450);
  await page.evaluate(() => gyPmOpen('theater'));
  await page.waitForTimeout(400);
  const pip1 = await page.evaluate(() => { const pp = document.getElementById('gyPmPip'); const inf = window.gyPmPipInfo(); return { pip: !!pp && pp.getBoundingClientRect().width > 80, inf, float: document.body.classList.contains('gyphm-float'), mainTf: document.querySelector('.main-content').style.transform, theater: getComputedStyle(document.getElementById('view-theater')).display, chatInPip: !!(pp && pp.querySelector('#view-chat')) }; });
  check(`[${tag}] 小窗开着时点别的 App：新的全屏打开，小窗里还是原来那个（真的那页，能点）`, pip1.pip && pip1.inf && pip1.inf.live && !pip1.float && !pip1.mainTf && pip1.theater !== 'none' && pip1.chatInPip, JSON.stringify(pip1));
  if (shots) await page.screenshot({ path: `${shots}/px-${tag}-pip.png` });
  await page.evaluate(() => { document.querySelector('#gyPmPip [data-pp="max"]').click(); });
  await page.waitForTimeout(400);
  check(`[${tag}] 点小窗的「⤢」：回到小窗里那个（聊天），小窗收起`, await page.evaluate(() => !document.getElementById('gyPmPip') && String(currentChatSessionId) === '9101' && getComputedStyle(document.getElementById('view-chat')).display !== 'none' && !!document.querySelector('.main-content #view-chat')));
  // 同一页（聊天 → 聊天 App）：小窗里放快照
  await page.evaluate(() => { gyPmFloat(true); });
  await page.waitForTimeout(450);
  await page.evaluate(() => gyPmOpen('chat'));
  await page.waitForTimeout(400);
  check(`[${tag}] 小窗里和新开的是同一页：小窗放原来的快照，点一下回去`, await page.evaluate(() => { const pp = document.getElementById('gyPmPip'); return !!pp && pp.classList.contains('snap') && !window.gyPmPipInfo().live; }));
  await page.evaluate(() => gyPmPipClose());
  await page.evaluate(() => gyPmHome());
  await page.waitForTimeout(400);

  // ---- 打开 App 的方式 ----
  await page.evaluate(() => gyPmBeauty());
  const bt = await page.evaluate(() => document.getElementById('gyPmSheet').innerText);
  check(`[${tag}] 美化里：打开方式（放大/从下往上/推进/卡片/弹出/淡入/翻转）、一行几个、景深、3D、实况视频`, ['打开 APP 的方式', '从图标放大', '翻转', '从右推进', '一行几个图标', '5 个', '景深', '3D 视差', '视频'].every(t => bt.includes(t)), bt.slice(0, 300));
  await page.evaluate(() => [...document.querySelectorAll('#gyPmSheet .chip')].find(c => c.innerText === '翻转').click());
  await page.waitForTimeout(1200);
  check(`[${tag}] 选了「翻转」就记住了`, await page.evaluate(() => gyPmOpenFx() === 'flip'));
  await page.evaluate(() => { gyPmCloseSheet(); gyPmHome(); });
  const anim = await page.evaluate(() => { gyPmOpen('theater'); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(document.getAnimations().map(a => JSON.stringify(a.effect.getKeyframes()[0] || {})).join('|'))))); });
  check(`[${tag}] 打开 App 用的是翻转动画`, /rotateY/.test(anim), anim.slice(0, 200));
  await page.waitForTimeout(600);
  await page.evaluate(() => { gyPmHome(); gyPmPref('openFx', 'zoom'); gyPmCloseSheet(); });

  // ---- 一行 5 个 ----
  await page.evaluate(() => { gyPmPref('cols', 5); gyPmCloseSheet(); });
  await page.waitForTimeout(300);
  const c5 = await page.evaluate(() => { const g = document.querySelector('.pm-page[data-page="0"] .pm-grid'); const ic = document.querySelector('.pm-page[data-page="0"] .pm-app .pm-ic').getBoundingClientRect(); const cols = getComputedStyle(g).gridTemplateColumns.split(' ').length; const xs = new Set([...g.querySelectorAll(':scope > .pm-app')].map(e => Math.round(e.getBoundingClientRect().left))); return { cols, ic: ic.width, xs: xs.size }; });
  await page.evaluate(() => { gyPmPref('cols', 4); gyPmCloseSheet(); });
  await page.waitForTimeout(300);
  const c4 = await page.evaluate(() => document.querySelector('.pm-page[data-page="0"] .pm-app .pm-ic').getBoundingClientRect().width);
  check(`[${tag}] 一行 5 个：5 列、图标小一号；切回 4 个图标变大`, c5.cols === 5 && c5.ic < c4 && c5.ic >= 44, JSON.stringify({ c5, c4 }));

  // ---- 小组件：拉边调大小 ----
  await page.evaluate(() => { gyPmNewPage(); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { gyPmEdit(false); gyPmAddW('quote', 's'); ['diary', 'film', 'book', 'map'].forEach(k => { }); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { gyPmEdit(true); });
  await noToast(page);
  const q0 = await page.evaluate(() => { const e = document.querySelector('#gyPmHome .wk-quote'); const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, sz: e.className.match(/sz-(\w)/)[1] }; });
  await page.mouse.move(q0.l + q0.w - 4, q0.t + q0.h / 2);
  await page.waitForTimeout(80);
  const cur = await page.evaluate(() => document.getElementById('gyPmHome').style.cursor);
  await page.mouse.down(); await page.mouse.move(q0.l + q0.w + 60, q0.t + q0.h / 2, { steps: 4 }); await page.mouse.move(q0.l + q0.w + 170, q0.t + q0.h / 2 - 50, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(450);
  const q1 = await page.evaluate(() => { const e = document.querySelector('#gyPmHome .wk-quote'); const r = e.getBoundingClientRect(); return { l: r.left, w: r.width, h: r.height, sz: e.className.match(/sz-(\w)/)[1] }; });
  check(`[${tag}] 按住小组件右边往外拉：变宽（鼠标放边上会变成调大小的光标）`, cur === 'ew-resize' && q1.w > q0.w + 80 && Math.abs(q1.l - q0.l) < 3, JSON.stringify({ cur, q0, q1 }));
  check(`[${tag}] 拉宽以后里面的排版自动换成宽的那种`, q1.sz !== q0.sz, q0.sz + ' → ' + q1.sz);
  // 往下拉底边
  const q2r = await page.evaluate(() => { const r = document.querySelector('#gyPmHome .wk-quote').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - 4, h: r.height }; });
  await page.mouse.move(q2r.x, q2r.y); await page.mouse.down(); await page.mouse.move(q2r.x, q2r.y + 120, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(450);
  const q2 = await page.evaluate(() => document.querySelector('#gyPmHome .wk-quote').getBoundingClientRect().height);
  check(`[${tag}] 往下拉底边：变高`, q2 > q2r.h + 80, q2r.h + ' → ' + q2);
  // 字能改：编辑时直接点字
  const tx = await page.evaluate(() => { const e = document.querySelector('#gyPmHome .wk-quote [data-tx]'); return !!e; });
  check(`[${tag}] 小组件上的字带着「能改」的标记`, tx);
  await page.evaluate(() => document.querySelector('#gyPmHome .wk-quote [data-tx="h"]').click());
  const ce = await page.evaluate(() => document.activeElement && document.activeElement.isContentEditable && document.activeElement.dataset.tx);
  await page.keyboard.type('今日份');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const tx2 = await page.evaluate(() => document.querySelector('#gyPmHome .wk-quote [data-tx="h"]').innerText);
  check(`[${tag}] 编辑桌面时点小组件上的字：原地改，回车就存`, ce === 'h' && tx2 === '今日份', JSON.stringify({ ce, tx2 }));
  const wid = await page.evaluate(() => document.querySelector('#gyPmHome .wk-quote').dataset.wid);
  await page.evaluate(id => gyPmItemSheet(id), wid);
  check(`[${tag}] 小组件设置里也列出了能改的字`, await page.evaluate(() => document.querySelectorAll('#gyPmSheet .pm-txs input').length >= 1 && document.getElementById('gyPmSheet').innerText.includes('小组件上的字')));
  await page.evaluate(() => { const i = [...document.querySelectorAll('#gyPmSheet .pm-txs input')].find(x => x.dataset.k === 'h'); i.value = ''; i.dispatchEvent(new Event('input')); gyPmCloseSheet(); });
  check(`[${tag}] 清空就回到原来的字`, await page.evaluate(() => document.querySelector('#gyPmHome .wk-quote [data-tx="h"]').innerText === 'TODAY'));
  // 小组件放到任意位置：拖到图标中间也行，图标自己让开
  await page.evaluate(() => { gyPmAddW('mood', 's'); });
  await page.waitForTimeout(400);
  const m0 = await page.evaluate(() => { const r = document.querySelector('#gyPmHome .wk-mood').getBoundingClientRect(); const g = document.querySelector('#gyPmHome .wk-mood').parentNode.getBoundingClientRect(); return { x: r.left + 50, y: r.top + 50, gl: g.left, gt: g.top }; });
  await page.mouse.move(m0.x, m0.y); await page.mouse.down(); await page.mouse.move(m0.x + 10, m0.y + 10, { steps: 3 }); await page.mouse.move(m0.gl + 50 + 37, m0.gt + 50 + 13, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(450);
  const m1 = await page.evaluate(() => { const r = document.querySelector('#gyPmHome .wk-mood').getBoundingClientRect(); const g = document.querySelector('#gyPmHome .wk-mood').parentNode.getBoundingClientRect(); return { dx: r.left - g.left, dy: r.top - g.top }; });
  check(`[${tag}] 小组件不对齐格子也能放（放在哪就在哪）`, Math.abs(m1.dx - 37) < 4 && Math.abs(m1.dy - 13) < 4, JSON.stringify(m1));
  if (shots) await page.screenshot({ path: `${shots}/px-${tag}-free.png` });
  await page.evaluate(() => gyPmEdit(false));

  // ---- 壁纸：景深虚化、3D、锁屏景深 ----
  const wall = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 390; c.height = 844; const g = c.getContext('2d'); g.fillStyle = '#7fa7d9'; g.fillRect(0, 0, 390, 844); g.fillStyle = '#d98f7f'; g.beginPath(); g.arc(195, 330, 120, 0, 7); g.fill(); return c.toDataURL('image/jpeg', .8); });
  await page.evaluate(w => { gyPmBeauty(); gyPmPrefQ('wallBlur', 8, 'x'); gyPmPref('p3d', true); gyPmCloseSheet(); }, wall);
  const w3 = await page.evaluate(() => ({ blur: document.querySelector('#gyPmHome .pm-wall.home .bg').style.filter, p3d: document.getElementById('gyPmHome').classList.contains('pm-3d') }));
  const hr = await page.evaluate(() => { const r = document.getElementById('gyPmHome').getBoundingClientRect(); return { x: r.left + r.width * .9, y: r.top + r.height * .8 }; });
  await page.mouse.move(hr.x, hr.y, { steps: 3 }); await page.waitForTimeout(150);
  const tx3 = await page.evaluate(() => document.getElementById('gyPmHome').style.getPropertyValue('--tx'));
  check(`[${tag}] 桌面景深虚化 + 3D 视差（跟着鼠标动）`, /blur\(8px\)/.test(w3.blur) && w3.p3d && (tag === '手机' || parseFloat(tx3) > .3), JSON.stringify({ w3, tx3 }));
  // 锁屏景深：在锁屏壁纸上涂出主体
  await page.evaluate(w => { gyPmBeauty(); }, wall);
  await page.evaluate(w => { /* 直接设成锁屏壁纸 */ const f = new File([Uint8Array.from(atob(w.split(',')[1]), c => c.charCodeAt(0))], 'w.jpg', { type: 'image/jpeg' }); window.__wf = f; }, wall);
  await page.evaluate(() => { const i = document.createElement('input'); Object.defineProperty(i, 'files', { value: [window.__wf] }); gyPmLockWallFile(i); });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#gyPmCrop .ok').click());
  await page.waitForTimeout(300);
  check(`[${tag}] 锁屏壁纸是照片时：美化里出现「选出主体」`, await page.evaluate(() => document.getElementById('gyPmSheet').innerText.includes('选出主体')));
  await page.evaluate(() => gyPmDepth());
  await page.waitForTimeout(500);
  check(`[${tag}] 景深：打开涂抹界面（画笔 / 橡皮 / 自动抠图）`, await vis(page, '#gyPmCrop.pm-depth canvas') && /自动抠图/.test(await page.evaluate(() => document.getElementById('gyPmCrop').innerText)));
  if (shots) await page.screenshot({ path: `${shots}/px-${tag}-depth.png` });
  const cv = await page.evaluate(() => { const r = document.querySelector('#gyPmCrop canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * .39, w: r.width }; });
  await page.mouse.move(cv.x - 20, cv.y); await page.mouse.down(); await page.mouse.move(cv.x + 20, cv.y + 10, { steps: 6 }); await page.mouse.move(cv.x, cv.y + 30, { steps: 6 }); await page.mouse.up();
  await page.evaluate(() => document.querySelector('#gyPmCrop .ok').click());
  await page.waitForTimeout(600);
  const dep = await page.evaluate(() => ({ lock: !!document.querySelector('#gyPmHome .pm-lock'), fg: !!document.querySelector('#gyPmHome .pm-lock .pm-fg'), z: (() => { const a = document.querySelector('#gyPmHome .pm-lock .pm-fg'), b = document.querySelector('#gyPmHome .pm-lock .lk-t'); return a && b ? +getComputedStyle(a).zIndex > +getComputedStyle(b).zIndex : false; })() }));
  check(`[${tag}] 涂好了：锁屏上主体挡在时间前面`, dep.lock && dep.fg && dep.z, JSON.stringify(dep));
  if (shots) { await noToast(page); await page.screenshot({ path: `${shots}/px-${tag}-lockdepth.png` }); }
  await page.evaluate(() => gyPmUnlock());
  await page.waitForTimeout(450);
  await page.evaluate(() => { gyPmPref('p3d', false); gyPmPrefQ('wallBlur', 0, 'x'); gyPmCloseSheet(); });

  // ---- 实况 / 视频 ----
  const vid = await page.evaluate(() => new Promise(res => {
    const c = document.createElement('canvas'); c.width = 160; c.height = 120; const g = c.getContext('2d'); let n = 0;
    const st = c.captureStream(20), rec = new MediaRecorder(st, { mimeType: 'video/webm' }), parts = [];
    rec.ondataavailable = e => parts.push(e.data); rec.onstop = () => { window.__vf = new File(parts, 'v.webm', { type: 'video/webm' }); res(window.__vf.size); };
    const iv = setInterval(() => { g.fillStyle = `hsl(${n * 20},70%,60%)`; g.fillRect(0, 0, 160, 120); n++; }, 50);
    rec.start(); setTimeout(() => { clearInterval(iv); rec.stop(); }, 900);
  }));
  const p = page.evaluate(() => gyLiveTake(window.__vf));
  await page.waitForTimeout(500);
  check(`[${tag}] 传视频：问要「循环视频」还是「实况」`, await vis(page, '#gyLiveAsk') && /实况/.test(await page.evaluate(() => document.getElementById('gyLiveAsk').innerText)));
  await page.evaluate(() => document.querySelector('#gyLiveAsk [data-m="live"]').click());
  const tok = await p;
  check(`[${tag}] 选了实况：存成一个 gylive 编号`, /^gylive:/.test(tok || ''), String(tok));
  await page.evaluate(t => { gyPmAddW('photo', 's'); const pg = [...document.querySelectorAll('#gyPmHome .pm-page')].pop(); const id = [...pg.querySelectorAll('.wk-photo')].pop().dataset.wid; const w = window.__gyPmW.findW(id); window.__gyPmW.photosOf(w).push(t); window.__gyPmW.save(); gyPmHomeRender(); }, tok);
  await page.waitForTimeout(900);
  const lv = await page.evaluate(() => { const v = [...document.querySelectorAll('#gyPmHome .wk-photo .gylive-v')].pop(); return v ? { live: v.classList.contains('live'), badge: !!v.parentElement.querySelector('.gylive-badge') } : null; });
  check(`[${tag}] 实况放进相片小组件：平时是照片，角上有「实况」小标`, lv && lv.live && lv.badge, JSON.stringify(lv));
  const vr = await page.evaluate(() => { const v = [...document.querySelectorAll('#gyPmHome .wk-photo .gylive-v')].pop(); const r = v.parentElement.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(vr.x, vr.y); await page.mouse.down(); await page.waitForTimeout(450);
  const playing = await page.evaluate(() => [...document.querySelectorAll('#gyPmHome .wk-photo .gylive-v')].pop().classList.contains('on'));
  await page.mouse.up(); await page.mouse.move(5, 5); await page.waitForTimeout(450);
  const stopped = await page.evaluate(() => !([...document.querySelectorAll('#gyPmHome .wk-photo .gylive-v')].pop().classList.contains('on')));
  check(`[${tag}] 实况：按住就动，松开回到照片`, playing && stopped, JSON.stringify({ playing, stopped }));

  check(`[${tag}] 没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 300));
  await ctx.close();
}
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
