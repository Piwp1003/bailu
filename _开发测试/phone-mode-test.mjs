// 📱 小手机模式：设置里切换；电脑=屏幕中间一台手机，手机=整屏；桌面/图标/小组件/Dock；点图标进功能、回桌面；跟微信模式二选一
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
  await page.waitForFunction(() => window.__guyuBooted && window.gyPmSet, { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    myCharacters.length = 0;
    myCharacters.push({ id: 9101, name: '沈之遥', handle: '@shen', persona: 'x', bio: '旧书店', worldbooks: [] }, { id: 9102, name: '顾迟', handle: '@gu', persona: 'y', worldbooks: [] });
    globalChats['9101'] = [{ sender: 9101, text: '今天店里来了只猫<br><jsy_status>[Location|店里]</jsy_status>', timestamp: Date.now() - 60000 }];
    globalChats['9102'] = [{ sender: 'me', text: '下班了吗', timestamp: Date.now() - 3600000 }];
    groupChats.length = 0;
  });
  // 先开微信模式，再开小手机：应该把微信关掉
  await page.evaluate(() => gyWxSet(true, true));
  await page.evaluate(() => switchMainView('settings'));
  await page.waitForTimeout(200);
  check(`[${tag}] 设置首页有「小手机模式」一条（带开关）`, await vis(page, '#gyPmSetEntry'));
  await page.evaluate(() => document.getElementById('gyPmSetEntry').click());
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => ({ pm: document.body.classList.contains('gyphm'), wx: document.body.classList.contains('gywx'), wxLs: localStorage.getItem('gyWxMode') }));
  check(`[${tag}] 切到小手机，微信模式自动关掉`, st.pm && !st.wx && st.wxLs === '0', JSON.stringify(st));
  check(`[${tag}] 进来先是锁屏：时间 + 上滑解锁`, await vis(page, '#gyPmHome .pm-lock') && /上滑解锁/.test(await page.evaluate(() => document.querySelector('#gyPmHome .pm-lock').innerText)));
  if (shots) await page.screenshot({ path: `${shots}/pm-${tag}-lock.png` });
  const lr = await page.evaluate(() => { const r = document.querySelector('#gyPmHome .pm-lock').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 60 }; });
  await page.mouse.click(lr.x, lr.y); await page.waitForTimeout(200);
  check(`[${tag}] 点一下不会解锁（只会跳一下提示）`, await vis(page, '#gyPmHome .pm-lock'));
  await page.mouse.move(lr.x, lr.y); await page.mouse.down(); await page.mouse.move(lr.x, lr.y - 40, { steps: 4 });
  const mid = await page.evaluate(() => document.querySelector('#gyPmHome .pm-lock').style.transform);
  await page.mouse.up(); await page.waitForTimeout(500);
  check(`[${tag}] 滑一点点松手：跟着手指走，然后弹回来`, /translateY\(-/.test(mid) && await vis(page, '#gyPmHome .pm-lock'), mid);
  await page.mouse.move(lr.x, lr.y); await page.mouse.down(); await page.mouse.move(lr.x, lr.y - 220, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(500);
  check(`[${tag}] 上滑解锁`, !(await vis(page, '#gyPmHome .pm-lock')));
  check(`[${tag}] 桌面显示出来了`, await vis(page, '#gyPmHome'));
  check(`[${tag}] 默认桌面：指针时钟 + 日历 + 正在播放 小组件`, await page.evaluate(() => !!document.querySelector('.pm-page[data-page="0"] .wk-aclock .dial') && !!document.querySelector('.pm-page[data-page="0"] .wk-cal') && !!document.querySelector('.pm-page[data-page="0"] .wk-music')));
  await page.evaluate(() => gyPmAddW('recent', 'm'));
  if (tag === '电脑') {
    const r = await page.evaluate(() => { const b = document.getElementById('gyPmHome').getBoundingClientRect(); return { x: b.left, w: b.width, h: b.height }; });
    check(`[${tag}] 电脑上是屏幕正中间一台手机`, r.w > 340 && r.w <= 384 && Math.abs(r.x + r.w / 2 - 640) < 4 && r.h > 700, JSON.stringify(r));
    check(`[${tag}] 白露两边栏都收起来`, !(await vis(page, '.sidebar-left')));
  } else {
    const r = await page.evaluate(() => document.getElementById('gyPmHome').getBoundingClientRect().width);
    check(`[${tag}] 手机上整屏就是这台手机`, r >= 389, String(r));
  }
  const home = await page.evaluate(() => document.getElementById('gyPmHome').innerText);
  check(`[${tag}] 状态栏时间 + 时钟小组件`, /\d\d:\d\d/.test(home) && /周/.test(home), home.slice(0, 100));
  check(`[${tag}] 「最近在聊」小组件：最后一句，状态栏不露出来`, home.includes('沈之遥') && home.includes('今天店里来了只猫') && !home.includes('jsy_status') && !home.includes('Location'), home.slice(0, 300));
  check(`[${tag}] 图标：聊天/推特/信件日记/TA们/今天/日历/音乐/电影/阅读/购物/设置…`, await page.evaluate(() => ['chat', 'home', 'diary', 'theater', 'today', 'calendar', 'music', 'film', 'book', 'mall', 'forum', 'anon', 'beauty', 'set'].every(k => document.querySelector(`#gyPmHome [data-pmapp="${k}"]`))));
  check(`[${tag}] 聊天图标上有未读数`, await page.evaluate(() => { const b = document.querySelector('.pm-app[data-pmapp="chat"] .pm-badge'); return b && +b.innerText >= 1; }));
  if (shots) await page.screenshot({ path: `${shots}/pm-${tag}-home.png` });

  await page.evaluate(() => document.querySelector('.pm-grid .pm-app[data-pmapp="diary"]').click());
  await page.waitForTimeout(400);
  const d1 = await page.evaluate(() => ({ app: document.body.classList.contains('gyphm-app'), t: document.getElementById('gyPmT').textContent, diary: getComputedStyle(document.getElementById('view-diary')).display }));
  check(`[${tag}] 点「信件日记」：屏幕里打开信件与日记，顶上「‹ 桌面  信件与日记」`, d1.app && d1.t === '信件与日记' && d1.diary !== 'none' && await vis(page, '#gyPmBar'), JSON.stringify(d1));
  if (tag === '电脑') {
    const mr = await page.evaluate(() => { const m = document.querySelector('.main-content').getBoundingClientRect(), h = document.getElementById('gyPmBar').getBoundingClientRect(); return { l: m.left, w: m.width, top: m.top, barBottom: h.bottom }; });
    check(`[${tag}] 页面就在手机屏幕里（不是满屏）`, mr.w <= 384 && mr.l > 400 && mr.top >= mr.barBottom - 2, JSON.stringify(mr));
  }
  if (shots) await page.screenshot({ path: `${shots}/pm-${tag}-diary.png` });
  await page.evaluate(() => document.querySelector('#gyPmBar .l').click());
  await page.waitForTimeout(200);
  check(`[${tag}] ‹ 桌面：回到桌面`, await page.evaluate(() => !document.body.classList.contains('gyphm-app')) && await vis(page, '#gyPmHome'));

  // 小组件点进聊天
  await page.evaluate(() => document.querySelector('.pm-last').click());
  await page.waitForTimeout(400);
  const c1 = await page.evaluate(() => ({ sid: String(currentChatSessionId), t: document.getElementById('gyPmT').textContent }));
  check(`[${tag}] 点「最近在聊」直接进那个人的聊天`, c1.sid === '9101' && c1.t === '沈之遥', JSON.stringify(c1));
  if (shots) await page.screenshot({ path: `${shots}/pm-${tag}-chat.png` });
  if (tag === '电脑') {
    await page.evaluate(() => document.getElementById('gyPmInd').click());
    check(`[${tag}] 底下小横杠也能回桌面`, await page.evaluate(() => !document.body.classList.contains('gyphm-app')));
  } else await page.evaluate(() => gyPmHome());

  await page.evaluate(() => document.querySelector('.pm-app[data-pmapp="today"]').click());
  await page.waitForTimeout(300);
  check(`[${tag}] 「今天」图标能打开今天面板`, await vis(page, '#gyTodayM') && await page.evaluate(() => document.getElementById('gyPmT').textContent === '今天'));
  if (shots) await page.screenshot({ path: `${shots}/pm-${tag}-today.png` });
  await page.evaluate(() => gyPmHome());

  await page.evaluate(() => document.querySelector('.pm-app[data-pmapp="beauty"]').click());
  check(`[${tag}] 「美化」：外观/壁纸/图标/字体/锁屏都能调`, await vis(page, '#gyPmSheet.on') && await page.evaluate(() => ['外观', '壁纸', '图标', '字体', '锁屏', '编辑桌面'].every(t => document.getElementById('gyPmSheet').innerText.toUpperCase().includes(t))));
  await page.evaluate(() => document.querySelector('#gyPmSheet .sw span:nth-child(3)').click());
  check(`[${tag}] 选个颜色壁纸就换上`, await page.evaluate(() => /background/.test(document.querySelector('#gyPmHome .pm-wall.home .bg').getAttribute('style') || '')));
  await page.evaluate(() => [...document.querySelectorAll('#gyPmSheet .chip')].find(c => c.innerText === '黑').click());
  check(`[${tag}] 图标换成黑色`, await page.evaluate(() => document.body.classList.contains('pm-st-black')));
  await page.evaluate(() => [...document.querySelectorAll('#gyPmSheet .chip')].find(c => c.innerText === '深色').click());
  check(`[${tag}] 外观换成深色`, await page.evaluate(() => document.body.classList.contains('pm-dark')));
  if (shots) await page.screenshot({ path: `${shots}/pm-${tag}-dark.png` });
  await page.evaluate(() => { [...document.querySelectorAll('#gyPmSheet .chip')].find(c => c.innerText === '浅色').click(); [...document.querySelectorAll('#gyPmSheet .chip')].find(c => c.innerText === '白').click(); });
  check(`[${tag}] 美化里有锁屏壁纸、换图标、小组件、资源库`, await page.evaluate(() => ['锁屏壁纸', '换图标', '小组件', 'App 资源库'].every(t => document.getElementById('gyPmSheet').innerText.includes(t))));
  await page.evaluate(() => document.querySelector('#gyPmSheet .sw span.same').parentNode.querySelectorAll('span')[5].click());
  check(`[${tag}] 锁屏壁纸单独换`, await page.evaluate(() => { gyPmLockNow(); const l = document.querySelector('#gyPmHome .pm-lock'); const b = l && l.querySelector('.pm-wall .bg'); const ok = b && /1c1c1e|28, 28, 30/.test(b.getAttribute('style') || ''); gyPmUnlock(); return ok; }));
  await page.waitForTimeout(450);
  await page.evaluate(() => gyPmIcons());
  check(`[${tag}] 换图标：所有 App 一张表，每个都能换图片`, await page.evaluate(() => document.querySelectorAll('#gyPmSheet .pm-ic-list .row input[type=file]').length >= 20));
  await page.evaluate(() => gyPmCloseSheet());

  // ---- 编辑桌面 ----
  const box = await page.evaluate(() => { const r = document.querySelector('.pm-grid .pm-app[data-pmapp="diary"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 20 }; });
  await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
  await page.waitForTimeout(100);
  check(`[${tag}] 长按图标进「编辑桌面」（图标抖起来，出现 − 和 完成）`, await page.evaluate(() => document.body.classList.contains('gyphm-edit')) && await vis(page, '#gyPmHome .pm-editbar .done'));
  if (shots) await page.screenshot({ path: `${shots}/pm-${tag}-edit.png` });
  // 拖动换位置：把 信件日记 拖到 论坛 上
  const order0 = await page.evaluate(() => [...document.querySelectorAll('.pm-page[data-page="0"] .pm-app')].map(e => e.dataset.pmapp).join(','));
  await page.evaluate(() => document.querySelector('.pm-page[data-page="0"] .pm-app[data-pmapp="today"]').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(100);
  const pA = await page.evaluate(() => { const e = document.querySelector('.pm-page[data-page="0"] .pm-app[data-pmapp="diary"]'), r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 22, pos: e.style.gridColumn + '/' + e.style.gridRow }; });
  const pB = await page.evaluate(() => { const e = document.querySelector('.pm-page[data-page="0"] .pm-app[data-pmapp="forum"]'), r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 22, pos: e.style.gridColumn + '/' + e.style.gridRow }; });
  const gB0 = await page.evaluate(() => { const e = document.querySelector('.pm-page[data-page="0"] .pm-app[data-pmapp="beauty"]'); return e.style.gridColumn + '/' + e.style.gridRow; });
  await page.mouse.move(pA.x, pA.y); await page.mouse.down(); await page.mouse.move(pA.x + 10, pA.y + 5, { steps: 3 }); await page.mouse.move(pB.x, pB.y, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(150);
  const order1 = await page.evaluate(() => [...document.querySelectorAll('.pm-page[data-page="0"] .pm-app')].map(e => e.dataset.pmapp).join(','));
  const gpos = k => page.evaluate(k => { const e = document.querySelector(`.pm-page[data-page="0"] .pm-app[data-pmapp="${k}"]`); return e ? e.style.gridColumn + '/' + e.style.gridRow : ''; }, k);
  check(`[${tag}] 拖到别的图标上：两个互换位置`, (await gpos('diary')) === pB.pos && (await gpos('forum')) === pA.pos, order0 + ' → ' + order1 + ' ' + JSON.stringify([pA.pos, pB.pos, await gpos('diary'), await gpos('forum')]));
  // 拿走一个图标：后面的不会自动往前补
  await page.evaluate(() => document.querySelector('.pm-page[data-page="0"] .pm-app[data-pmapp="film"] .pm-del').click());
  await page.waitForTimeout(100);
  const beautyAfter = await gpos('beauty');
  check(`[${tag}] 收起一个图标：其他图标不自动补位（空着）`, beautyAfter === gB0, gB0 + ' → ' + beautyAfter);
  await page.evaluate(() => { gyPmLibrary(); document.querySelector('#gyPmLibGrid .pm-app[data-pmapp="film"]').click(); gyPmCloseSheet(); });
  check(`[${tag}] App 资源库不再占一页`, await page.evaluate(() => !document.querySelector('.pm-page.lib') && document.querySelectorAll('#gyPmHome .pm-pg i:not(.newpg)').length === document.querySelectorAll('#gyPmHome .pm-page').length));
  // 小组件拖到图标中间：图标自己让开
  const wBefore = await page.evaluate(() => [...document.querySelectorAll('.pm-page[data-page="0"] .pm-item')].map(e => e.dataset.pmapp || e.dataset.wid ? (e.dataset.pmapp || 'W:' + e.className.match(/wk-(\w+)/)[1]) : '').join(','));
  await page.evaluate(() => document.querySelector('.pm-page[data-page="0"] .wk-aclock').scrollIntoView({ block: 'center' }));
  const wA = await page.evaluate(() => { const r = document.querySelector('.pm-page[data-page="0"] .wk-aclock').getBoundingClientRect(); return { x: r.left + 30, y: r.top + 30 }; });
  await page.evaluate(() => { document.querySelector('.pm-page[data-page="0"]').scrollTop = 0; document.querySelectorAll('[class*="toast"]').forEach(e => { if (e.id !== 'gyPmHome') e.style.display = 'none'; }); });
  await page.waitForTimeout(100);
  const wA2 = await page.evaluate(() => { const r = document.querySelector('.pm-page[data-page="0"] .wk-aclock').getBoundingClientRect(); return { x: r.left + 30, y: r.top + 30 }; });
  const wB = await page.evaluate(() => { const e = document.querySelector('.pm-page[data-page="0"] .pm-app[data-pmapp="music"]'), r = e.getBoundingClientRect(); return { x: r.left + 30, y: r.top + 30, x0: r.left, y0: r.top }; });
  await page.mouse.move(wA2.x, wA2.y); await page.mouse.down(); await page.mouse.move(wA2.x + 8, wA2.y + 8, { steps: 3 }); await page.mouse.move(wB.x, wB.y, { steps: 10 }); await page.waitForTimeout(250); await page.mouse.up();
  await page.waitForTimeout(450);
  const wAfter = await page.evaluate(() => [...document.querySelectorAll('.pm-page[data-page="0"] .pm-item')].map(e => (e.dataset.pmapp || 'W:' + (e.className.match(/wk-(\w+)/) || [])[1]) + '@' + e.style.gridColumn + '/' + e.style.gridRow).join(','));
  const ovl = await page.evaluate(() => { const els = [...document.querySelectorAll('.pm-page[data-page="0"] .pm-item')], rs = els.map(e => e.getBoundingClientRect()); for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { if (els[i].dataset.wid && els[j].dataset.wid) continue; const a = rs[i], b = rs[j]; if (a.left < b.right - 6 && b.left < a.right - 6 && a.top < b.bottom - 6 && b.top < a.bottom - 6) return true; } return false; });
  const acR = await page.evaluate(() => { const r = document.querySelector('.pm-page[data-page="0"] .wk-aclock').getBoundingClientRect(); return { x: r.left, y: r.top }; });
  check(`[${tag}] 小组件想放哪放哪（松手在哪就在哪），压到的图标挪开，不重叠`, Math.abs(acR.x - wB.x0) < 8 && Math.abs(acR.y - wB.y0) < 8 && !ovl, JSON.stringify({ acR, wB, ovl, wAfter }));
  // 点图标：改名字
  await page.evaluate(() => document.querySelector('.pm-page[data-page="0"] .pm-app[data-pmapp="music"]').click());
  await page.waitForTimeout(100);
  check(`[${tag}] 编辑时点图标：能改名字/底色/换图片/放进 Dock`, await page.evaluate(() => ['名字', '底色', '换成自己的图片', '放进 Dock'].every(t => document.getElementById('gyPmSheet').innerText.includes(t))));
  await page.evaluate(() => { const i = document.querySelector('#gyPmSheet .in'); i.value = '听歌'; i.dispatchEvent(new Event('input')); });
  check(`[${tag}] 改名字马上生效`, await page.evaluate(() => document.querySelector('.pm-app[data-pmapp="music"] .pm-lb').innerText === '听歌'));
  await page.evaluate(() => [...document.querySelectorAll('#gyPmSheet .it')].find(b => b.innerText.includes('放进 Dock')).click());
  check(`[${tag}] 放进 Dock`, await page.evaluate(() => !!document.querySelector('.pm-dock .pm-app[data-pmapp="music"]')));
  // − 收起来进资源库
  await page.evaluate(() => document.querySelector('.pm-page[data-page="0"] .pm-app[data-pmapp="gossip"] .pm-del').click());
  check(`[${tag}] 点 − 收起来（进 App 资源库，没删）`, await page.evaluate(() => !document.querySelector('.pm-page[data-page="0"] .pm-app[data-pmapp="gossip"]') && (gyPmLibrary(), !!document.querySelector('#gyPmLibGrid .pm-app.off[data-pmapp="gossip"]'))));
  await page.evaluate(() => { document.querySelector('#gyPmLibGrid .pm-app[data-pmapp="gossip"]').click(); gyPmCloseSheet(); });
  check(`[${tag}] 资源库里点它放回桌面`, await page.evaluate(() => !!document.querySelector('.pm-page:not(.lib) .pm-app[data-pmapp="gossip"]')));
  // 加小组件
  await page.evaluate(() => document.querySelector('#gyPmHome .pm-editbar .add').click());
  const wl = await page.evaluate(() => document.getElementById('gyPmSheet').innerText);
  check(`[${tag}] 小组件挑选页：每个都有预览`, await page.evaluate(() => document.querySelectorAll('#gyPmSheet .pm-wg-card .pv .pm-w').length >= 15));
  check(`[${tag}] ＋ 加小组件：15 种`, ['数字时钟', '指针时钟', '日历', '本周', '正在播放', '天气', '电量', '待办', '最近在聊', '联系人', '便签', '纪念日', '相片', '未读', 'TA 说过的话'].every(t => wl.includes(t)), wl);
  await page.evaluate(() => [...document.querySelectorAll('.pm-wg-card')].find(r => r.querySelector('.nm b').innerText === '联系人').querySelector('.nm .chip').click());
  check(`[${tag}] 加了「联系人」小组件`, await page.evaluate(() => !!document.querySelector('.pm-page[data-page="0"] .wk-contact')));
  await page.evaluate(() => { gyPmAddWidget(); [...document.querySelectorAll('.pm-wg-card')].find(r => r.querySelector('.nm b').innerText === '纪念日').querySelector('.nm .chip').click(); });
  await page.evaluate(() => document.querySelector('.pm-page[data-page="0"] .wk-count').click());
  await page.evaluate(() => { const i = document.querySelector('#gyPmSheet .in'); i.value = '见面'; i.dispatchEvent(new Event('input')); const d = document.querySelector('#gyPmSheet input[type=date]'); const t = new Date(Date.now() + 5 * 864e5); d.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; d.dispatchEvent(new Event('change')); });
  const cw = await page.evaluate(() => document.querySelector('.pm-page[data-page="0"] .wk-count').innerText);
  check(`[${tag}] 倒数日：改名字、改日子`, cw.includes('见面') && /还有\s*5/.test(cw.replace(/\n/g, ' ')), cw);
  await page.evaluate(() => gyPmCloseSheet());
  if (shots) await page.screenshot({ path: `${shots}/pm-${tag}-widgets.png` });
  await page.evaluate(() => document.querySelector('#gyPmHome .pm-editbar .done').click());
  check(`[${tag}] 完成：退出编辑`, await page.evaluate(() => !document.body.classList.contains('gyphm-edit')));
  // 待办：点一下打勾
  await page.evaluate(() => gyPmPage(1));
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('.pm-page[data-page="1"] .wg-todo .ti').click());
  check(`[${tag}] 待办：点一下打勾`, await page.evaluate(() => document.querySelector('.pm-page[data-page="1"] .wg-todo .ti').classList.contains('done')));
  await page.evaluate(() => gyPmPage(0));
  await page.waitForTimeout(300);

  // 日历：点日历小组件打开日历 App（你的日程 / 纪念日 / 生日 / 日记）
  await page.evaluate(() => { const t = new Date(); currentUser.customAnniversaries = [{ date: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`, label: '第一次见面' }]; });
  await page.evaluate(() => document.querySelector('.wk-cal').click());
  await page.waitForTimeout(400);
  const cal = await page.evaluate(() => ({ app: document.body.classList.contains('gyphm-native'), t: document.getElementById('gyPmT').textContent, txt: (document.getElementById('gyPmApp') || {}).innerText || '' }));
  check(`[${tag}] 点日历小组件：打开日历 App，看得到今天的纪念日`, cal.app && cal.t === '日历' && cal.txt.includes('第一次见面') && cal.txt.includes('在这一天记一条'), JSON.stringify(cal).slice(0, 300));
  if (shots) await page.screenshot({ path: `${shots}/pm-${tag}-calendar.png` });
  await page.evaluate(() => gyPmCalMove(1));
  check(`[${tag}] 日历能翻月`, await page.evaluate(() => /\d+月/.test(document.querySelector('.pmc-hd b').innerText)));
  await page.evaluate(() => gyPmHome());
  // 🔔 通知中心：从状态栏往下拉
  await page.evaluate(() => { globalNotifications.unshift({ text: '沈之遥 给你发了一条消息', chatCharId: '9101', timestamp: Date.now() }); unreadNotifs = 3; document.querySelectorAll('.toast-item').forEach(t => t.remove()); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.gyPmIsland && gyPmIsland.hide());
  await page.waitForTimeout(500);
  const sbR = await page.evaluate(() => { const r = document.querySelector('#gyPmHome .pm-sb').getBoundingClientRect(); const e = document.elementFromPoint(r.left + 60, r.top + r.height / 2); return { x: r.left + 60, y: r.top + r.height / 2, hit: e && e.outerHTML.slice(0, 90), cls: document.body.className }; });
  await page.mouse.move(sbR.x, sbR.y); await page.mouse.down(); await page.mouse.move(sbR.x, sbR.y + 60, { steps: 4 }); await page.mouse.move(sbR.x, sbR.y + 200, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(400);
  const nc = await page.evaluate(() => ({ on: !!document.querySelector('#gyPmNC.on'), txt: (document.getElementById('gyPmNC') || {}).innerText || '', un: unreadNotifs }));
  check(`[${tag}] 从状态栏往下拉：出来通知中心，通知带具体内容（那句话），不放大时钟，角标清零`, nc.on && nc.txt.includes('通知中心') && nc.txt.includes('沈之遥 给你发了一条消息') && nc.un === 0 && nc.txt.includes('今天店里来了只猫') && !/星期/.test(nc.txt), JSON.stringify(nc).slice(0, 200));
  if (shots) await page.screenshot({ path: `${shots}/pm-${tag}-nc.png` });
  await page.evaluate(() => [...document.querySelectorAll('#gyPmNC .nc-n')].find(n => n.innerText.includes('沈之遥 给你发了')).click());
  await page.waitForTimeout(400);
  check(`[${tag}] 点一条通知：收起通知中心，直接进那个聊天`, await page.evaluate(() => !document.querySelector('#gyPmNC.on') && document.body.classList.contains('gyphm-app') && String(currentChatSessionId) === '9101'));
  await page.evaluate(() => gyPmHome());
  await page.evaluate(() => document.querySelector('#gyPmHome .pm-sb').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 20, pointerId: 7 })));
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 50, clientY: 20, pointerId: 7 })));
  await page.waitForTimeout(200);
  check(`[${tag}] 点一下状态栏也能打开（不用拉）`, await page.evaluate(() => !!document.querySelector('#gyPmNC.on')));
  await page.evaluate(() => document.querySelector('#gyPmNC .nc-grab').click());
  check(`[${tag}] 底下小横条收起`, await page.evaluate(() => !document.querySelector('#gyPmNC.on')));
  // 指针时钟 → 此刻
  await page.evaluate(() => document.querySelector('.wk-aclock').click());
  await page.waitForTimeout(300);
  check(`[${tag}] 点时钟小组件：打开「此刻」`, await page.evaluate(() => document.body.classList.contains('gyphm-app') && document.getElementById('gyPmT').textContent === '此刻'));
  await page.evaluate(() => gyPmHome());
  // 电量 → 省电模式（关掉会自己调 API 的功能，再点恢复）
  const body0 = await page.evaluate(() => { setAutoFeature('autoPost', true, true); setAutoFeature('proactiveChat', true, true); gyPmAddW('battery', 's'); return isAutoOn('aliveBody'); });
  await page.evaluate(() => document.querySelector('.wk-battery').click());
  const sv1 = await page.evaluate(() => ({ on: gyPmSaverOn(), a: isAutoOn('autoPost'), b: isAutoOn('proactiveChat'), body: isAutoOn('aliveBody'), lbl: document.querySelector('.wk-battery').innerText, bat: !!document.querySelector('#gyPmHome .pm-bat.saver') }));
  check(`[${tag}] 点电量：开省电模式，主动发帖/主动聊天这些先关掉，不花钱的留着`, sv1.on && !sv1.a && !sv1.b && sv1.body === body0 && sv1.lbl.includes('省电模式') && sv1.bat, JSON.stringify(sv1));
  await page.evaluate(() => document.querySelector('.wk-battery').click());
  check(`[${tag}] 再点一下：原样恢复`, await page.evaluate(() => !gyPmSaverOn() && isAutoOn('autoPost') && isAutoOn('proactiveChat')));
  // 像真 App 一样：最外层没有返回键；点进下一层才有「‹」，点它回上一层
  await page.evaluate(() => document.querySelector('.pm-dock .pm-app[data-pmapp="set"]').click());
  await page.waitForTimeout(300);
  const nav0 = await page.evaluate(() => document.querySelector('#gyPmBar .nav .l').classList.contains('home') ? 'home' : 'back');
  await page.evaluate(() => switchMainView('memoryHub'));
  await page.waitForTimeout(200);
  const nav1 = await page.evaluate(() => ({ v: document.querySelector('#gyPmBar .nav .l').classList.contains('home') ? 'home' : 'back', t: document.getElementById('gyPmT').textContent }));
  await page.evaluate(() => document.querySelector('#gyPmBar .nav .l').click());
  await page.waitForTimeout(200);
  const nav2 = await page.evaluate(() => ({ app: document.body.classList.contains('gyphm-app'), t: document.getElementById('gyPmT').textContent, set: getComputedStyle(document.getElementById('view-settings')).display }));
  check(`[${tag}] 左上角一直是「‹」：最外层点了回桌面，进下一层点了回上一层`, nav0 === 'back' && nav1.v === 'back' && nav2.app && nav2.set !== 'none' && nav2.t === '系统设置', JSON.stringify({ nav0, nav1, nav2 }));
  await page.evaluate(() => gyPmHome());
  await page.evaluate(() => document.querySelector('.pm-page[data-page="0"] .wk-contact').click());
  await page.waitForTimeout(300);
  check(`[${tag}] 点「联系人」小组件直接进那个人的聊天`, await page.evaluate(() => document.body.classList.contains('gyphm-app') && String(currentChatSessionId) === '9101'));
  check(`[${tag}] 聊天里只有一条顶栏（聊天页自己那条收起来了）`, !(await vis(page, '#gyChatHead')) && await page.evaluate(() => getComputedStyle(document.querySelector('#gyPmBar .nav .l')).visibility === 'visible'));
  check(`[${tag}] 底下回桌面的小横杠看得见`, await page.evaluate(() => { const i = document.querySelector('#gyPmInd i'); const r = i.getBoundingClientRect(); const cs = getComputedStyle(i); return r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) >= 4 && getComputedStyle(document.getElementById('gyPmInd')).display !== 'none'; }));
  await page.evaluate(() => document.querySelector('#gyPmBar .nav .l').click());
  await page.waitForTimeout(200);
  check(`[${tag}] 聊天里点「‹」回到联系人那一层（还在聊天 App 里）`, await page.evaluate(() => document.body.classList.contains('gyphm-app') && document.getElementById('gyPmT').textContent === '聊天'));
  await page.evaluate(() => gyPmHome());

  // 通知里跳转：桌面状态下 switchMainView 也进 App 状态
  await page.waitForTimeout(2600);
  await page.evaluate(() => switchMainView('notifications'));
  await page.waitForTimeout(200);
  check(`[${tag}] 从别处跳到某个页面（比如点通知）：自动进 App 状态，不被桌面挡住`, await page.evaluate(() => document.body.classList.contains('gyphm-app') && document.getElementById('gyPmT').textContent === '通知'));

  await page.reload();
  await page.waitForFunction(() => window.__guyuBooted && window.gyPmSet, { timeout: 20000 });
  await page.waitForTimeout(400);
  check(`[${tag}] 刷新后还是小手机`, await page.evaluate(() => document.body.classList.contains('gyphm')));
  check(`[${tag}] 刷新后桌面还是自己摆的样子（改的名字还在）`, await page.evaluate(() => { const l = document.querySelector('.pm-app[data-pmapp="music"] .pm-lb'); return l && l.innerText === '听歌'; }));
  await page.evaluate(() => gyPmUnlock());
  await page.waitForTimeout(450);
  await page.evaluate(() => document.querySelector('.pm-dock .pm-app[data-pmapp="set"]').click());
  await page.waitForTimeout(300);
  if (shots) await page.screenshot({ path: `${shots}/pm-${tag}-settings.png` });
  await page.evaluate(() => document.getElementById('gyPmSetEntry').click());
  await page.waitForTimeout(200);
  check(`[${tag}] 设置里再点一下切回白露，原样回来`, await page.evaluate(() => !document.body.classList.contains('gyphm') && !document.body.classList.contains('gyphm-desk') && getComputedStyle(document.querySelector('.main-content')).position !== 'fixed' && localStorage.getItem('gyPhoneMode') === '0'));
  check(`[${tag}] 没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 300));
  await ctx.close();
}
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
