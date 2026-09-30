// 💬 微信模式：设置里切换；电脑端＝电脑版微信（侧栏+会话列表+右侧聊天），手机端＝手机微信（四个标签 + 点进去顶上「‹ 标题」）
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });
const shots = process.env.GY_SHOTS;
const vis = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, sel);

async function setup(vp) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/^https?:\/\//, r => r.abort());
  await page.goto(fileUrl(path.join(root, 'index.html')));
  await page.waitForFunction(() => window.__guyuBooted && window.gyWxSet, { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    myCharacters.length = 0;
    myCharacters.push({ id: 9101, name: '沈之遥', handle: '@shen', persona: 'x', bio: '旧书店，下午两点开门', worldbooks: [] },
                       { id: 9102, name: '顾迟', handle: '@gu', persona: 'y', worldbooks: [] });
    globalChats['9101'] = [{ sender: 'me', text: '在吗', timestamp: Date.now() - 90000 }, { sender: 9101, text: '今天店里来了只猫', timestamp: Date.now() - 60000 }];
    globalChats['9102'] = [{ sender: 'me', text: '下班了吗', timestamp: Date.now() - 3600000 }];
    groupChats.length = 0; groupChats.push({ id: 'g_1', name: '夜宵小分队', members: [9101, 9102] });
    globalChats['g_1'] = [{ sender: 9102, text: '谁去吃烧烤', timestamp: Date.now() - 120000 }];
    globalPosts.unshift({ id: 'p_wx', char: { id: 9101, name: '沈之遥' }, text: '雨天适合看书。<br><br><jsy_status><br>[DateTime|2026/9/24 21:45]<br>[Location|旧书店柜台]<br>[Mood|有点困]</jsy_status>', timestamp: Date.now() - 5000, replies: [{ char: { name: '顾迟' }, text: '借我一本' }], stats: {} });
    globalChats['9102'].push({ sender: 9102, text: '刚下班<br><jsy_status>[Location|医院门口]</jsy_status>', timestamp: Date.now() - 3000000 });
  });
  return { ctx, page, errs };
}
async function turnOnFromSettings(page, tag) {
  await page.evaluate(() => switchMainView('settings'));
  await page.waitForTimeout(200);
  check(`[${tag}] 设置首页有「微信模式」一条（带开关）`, await vis(page, '#gyWxSetEntry') && await page.evaluate(() => !!document.querySelector('#gyWxSetEntry .gywx-sw')));
  check(`[${tag}] 左上角/顶栏不再单独放按钮`, await page.evaluate(() => !document.getElementById('gyWxBtnDesk') && !document.getElementById('gyWxBtnMob')));
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-settings.png` });
  await page.evaluate(() => document.getElementById('gyWxSetEntry').click());
  await page.waitForTimeout(300);
}

/* ---------------- 🖥️ 电脑 ---------------- */
{
  const tag = '电脑';
  const { ctx, page, errs } = await setup({ width: 1280, height: 860 });
  await turnOnFromSettings(page, tag);
  check(`[${tag}] 微信模式里播放条收着`, await page.evaluate(() => { const r = document.getElementById('gymRoot'); return !r || r.style.display === 'none'; }));
  check(`[${tag}] 切过去：开关亮了、是电脑版布局`, await page.evaluate(() => document.body.classList.contains('gywx') && document.body.classList.contains('gywx-desk') && document.querySelector('#gyWxSetEntry .gywx-sw').classList.contains('on')));
  check(`[${tag}] 最左窄侧栏 + 会话列表都在，白露两边栏收起来了`, await vis(page, '#gyWxSide') && await vis(page, '#gyWxList') && !(await vis(page, '.sidebar-left')));
  const lt = await page.evaluate(() => document.getElementById('gyWxList').innerText);
  check(`[${tag}] 会话列表：私聊+群聊+最后一句`, lt.includes('今天店里来了只猫') && lt.includes('顾迟：谁去吃烧烤') && lt.includes('刚下班'), lt.slice(0, 200));
  check(`[${tag}] 右边：还没选聊天时是灰底大 logo`, await vis(page, '#gyWxPane .welcome'));
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-welcome.png` });

  await page.evaluate(() => document.querySelector('[data-wxchat="9101"]').click());
  await page.waitForTimeout(400);
  const c = await page.evaluate(() => ({ sid: String(currentChatSessionId), pane: getComputedStyle(document.getElementById('gyWxPane')).display, sel: !!document.querySelector('[data-wxchat="9101"].sel'), chatX: document.getElementById('view-chat').getBoundingClientRect().left }));
  check(`[${tag}] 点会话：右边就是聊天，列表里那条变绿`, c.sid === '9101' && c.pane === 'none' && c.sel && c.chatX >= 330, JSON.stringify(c));
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-chat.png` });

  await page.evaluate(() => gyWxSearch('夜宵'));
  const sr = await page.evaluate(() => document.getElementById('gyWxCells').innerText);
  check(`[${tag}] 搜索框能筛`, sr.includes('夜宵小分队') && !sr.includes('顾迟：下班'), sr);
  await page.evaluate(() => gyWxSearch(''));

  await page.evaluate(() => document.querySelector('.wx-si[data-wxtab="contacts"]').click());
  await page.evaluate(() => document.querySelector('[data-wxcontact="9101"]').click());
  await page.waitForTimeout(150);
  const pc = await page.evaluate(() => document.getElementById('gyWxPane').innerText);
  check(`[${tag}] 通讯录点人：右边出资料卡`, pc.includes('沈之遥') && pc.includes('旧书店，下午两点开门') && pc.includes('发消息'), pc.slice(0, 200));
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-card.png` });
  await page.evaluate(() => { localStorage.setItem('phoneOn', 'true'); try { setAutoFeature('phoneOn', true, true); } catch (e) {} });
  await page.evaluate(() => [...document.querySelectorAll('#gyWxPane .wx-cbtn')].find(b => b.innerText.includes('手机')).click());
  await page.waitForTimeout(500);
  check(`[${tag}] 资料卡「TA 的手机」：能打开，不被挡住`, await page.evaluate(() => getComputedStyle(document.getElementById('gyWxPane')).display === 'none' && !!document.querySelector('.gyph-screen, [id*="phone"] .gyph-screen, .gyph-phone')));
  await page.evaluate(() => document.querySelector('.wx-si[data-wxtab="contacts"]').click());
  await page.evaluate(() => document.querySelector('[data-wxcontact="9101"]').click());
  await page.evaluate(() => [...document.querySelectorAll('#gyWxPane .wx-cbtn')].find(b => b.innerText.includes('发消息')).click());
  await page.waitForTimeout(300);
  check(`[${tag}] 资料卡「发消息」→ 回到聊天`, await page.evaluate(() => String(currentChatSessionId) === '9101' && document.querySelector('.wx-si.on').dataset.wxtab === 'chats'));

  await page.evaluate(() => document.querySelector('.wx-si[data-wxtab="moments"]').click());
  await page.waitForTimeout(150);
  const mo = await page.evaluate(() => (document.getElementById('gyWxMo') || {}).innerText || '');
  check(`[${tag}] 朋友圈：单独弹一个窗`, mo.includes('雨天适合看书。') && mo.includes('顾迟：借我一本'), mo.slice(0, 200));
  check(`[${tag}] 没有悬浮的 ＋ 发帖按钮`, await page.evaluate(() => { const f = document.getElementById('fabPost'); return !f || getComputedStyle(f).display === 'none'; }));
  check(`[${tag}] 朋友圈窗口右上角有相机`, await page.evaluate(() => !!document.querySelector('#gyWxMo .mo-bar [title="发朋友圈"]')));
  const moh = await page.evaluate(() => document.getElementById('gyWxMo').innerHTML);
  check(`[${tag}] 朋友圈里的状态栏：折成一条可展开的，不露 <br>/<jsy_status> 原文`, moh.includes('gy-chat-status') && !mo.includes('<br>') && !mo.includes('jsy_status') && !mo.includes('[Location|'), mo.slice(0, 300));
  const lp = await page.evaluate(() => document.querySelector('[data-wxchat="9102"] .wx-p').innerText);
  check(`[${tag}] 会话列表预览：状态栏不进预览`, lp === '刚下班', lp);
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-moments.png` });
  await page.evaluate(() => document.getElementById('gyWxMo').remove());

  await page.evaluate(() => document.querySelector('.wx-si[data-wxtab="today"]').click());
  await page.waitForTimeout(250);
  const td = await page.evaluate(() => { const b = document.getElementById('gyToday'); const r = b && b.getBoundingClientRect(); return { on: document.body.classList.contains('gywx-today'), w: r ? r.width : 0, x: r ? r.left : 0 }; });
  check(`[${tag}] 侧栏「今天」：今天面板从右边滑出来`, td.on && td.w > 200 && td.x > 800, JSON.stringify(td));
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-today.png` });
  await page.evaluate(() => document.getElementById('gyWxTodayX').click());
  check(`[${tag}] 点 × 收回去`, await page.evaluate(() => !document.body.classList.contains('gywx-today')));
  await page.evaluate(() => gyJump({ today: 'x' }));
  await page.waitForTimeout(100);
  check(`[${tag}] 通知里点「今天」也能打开`, await page.evaluate(() => document.body.classList.contains('gywx-today')));
  await page.evaluate(() => gyWxToday(false));
  await page.evaluate(() => gyWxGo({ view: 'profile', param: '9101' }));
  await page.waitForTimeout(400);
  const pw = await page.evaluate(() => document.querySelector('.main-content').getBoundingClientRect().width);
  check(`[${tag}] 别的页面（主页/个人主页）保持正常宽度，不被拉满`, pw < 800, String(pw));
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-profile.png` });
  await page.evaluate(() => document.querySelector('.wx-si[data-wxtab="apps"]').click());
  const ap = await page.evaluate(() => document.getElementById('gyWxList').innerText);
  check(`[${tag}] 小程序：各个功能都在`, ['音乐', '一起看电影', '购物', '论坛', 'TA们在做什么'].every(t => ap.includes(t)), ap.slice(0, 200));
  await page.reload();
  await page.waitForFunction(() => window.__guyuBooted && window.gyWxSet, { timeout: 20000 });
  await page.waitForTimeout(400);
  check(`[${tag}] 刷新后还是微信模式`, await page.evaluate(() => document.body.classList.contains('gywx-desk')));
  await page.evaluate(() => document.querySelector('.wx-si[data-wxtab="menu"]').click());
  await page.waitForTimeout(100);
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-menu.png` });
  await page.evaluate(() => document.querySelector('#gyWxMenu [data-wxback]').click());
  await page.waitForTimeout(200);
  check(`[${tag}] 切回白露：主题色还是原来的，不是微信绿`, await page.evaluate(() => { const c = getComputedStyle(document.body).getPropertyValue('--gy-accent').trim(); return c !== '#07c160' && !document.body.classList.contains('gywx'); }), await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--gy-accent')));
  check(`[${tag}] ≡ 菜单「切回白露」回到原样`, await page.evaluate(() => !document.body.classList.contains('gywx') && !document.body.classList.contains('gywx-desk')) && await vis(page, '.sidebar-left'));
  check(`[${tag}] 没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 300));
  await ctx.close();
}

/* ---------------- 📱 手机 ---------------- */
{
  const tag = '手机';
  const { ctx, page, errs } = await setup({ width: 390, height: 844 });
  await turnOnFromSettings(page, tag);
  const st = await page.evaluate(() => ({ mob: document.body.classList.contains('gywx-mob'), txt: document.getElementById('gyWxBody').innerText, tabs: document.getElementById('gyWxTabs').innerText }));
  check(`[${tag}] 切过去：手机布局 + 底部四个标签`, st.mob && ['微信', '通讯录', '发现', '我'].every(t => st.tabs.includes(t)), JSON.stringify(st).slice(0, 200));
  check(`[${tag}] 聊天列表`, st.txt.includes('今天店里来了只猫') && st.txt.includes('顾迟：谁去吃烧烤'), st.txt.slice(0, 200));
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-chats.png` });
  await page.evaluate(() => document.querySelector('[data-wxchat="9101"]').click());
  await page.waitForTimeout(400);
  const ic = await page.evaluate(() => ({ away: document.body.classList.contains('gywx-away'), sid: String(currentChatSessionId), bar: document.getElementById('gyWxBarT').textContent }));
  check(`[${tag}] 点进聊天：顶上「‹ 沈之遥 ···」`, ic.away && ic.sid === '9101' && ic.bar === '沈之遥' && await vis(page, '#gyWxBar') && !(await vis(page, '.mobile-bottom-nav')), JSON.stringify(ic));
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-inchat.png` });
  await page.evaluate(() => document.querySelector('#gyWxBar .l').click());
  await page.waitForTimeout(200);
  check(`[${tag}] ‹ 回到微信`, await page.evaluate(() => !document.body.classList.contains('gywx-away')) && await vis(page, '#gyWx'));
  await page.evaluate(() => gyWxTab('contacts'));
  await page.evaluate(() => document.querySelector('[data-wxcontact="9101"]').click());
  const card = await page.evaluate(() => document.getElementById('gyWxBody').innerText);
  check(`[${tag}] 通讯录点人出资料卡`, card.includes('旧书店，下午两点开门') && card.includes('发消息'), card.slice(0, 200));
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-card.png` });
  await page.evaluate(() => { try { setAutoFeature('phoneOn', true, true); } catch (e) {} });
  await page.evaluate(() => [...document.querySelectorAll('#gyWxBody .wx-cbtn')].find(b => b.innerText.includes('手机')).click());
  await page.waitForTimeout(500);
  check(`[${tag}] 资料卡「看看 TA 的手机」：能打开，不被挡住`, await page.evaluate(() => document.body.classList.contains('gywx-away') && !!document.querySelector('.gyph-screen')), await page.evaluate(() => document.body.className));
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-phone.png` });
  await page.evaluate(() => gyWxHome());
  await page.evaluate(() => { gyWxTab('discover'); });
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-discover.png` });
  await page.evaluate(() => gyWxSub('moments'));
  const mo = await page.evaluate(() => document.getElementById('gyWxBody').innerText);
  check(`[${tag}] 朋友圈`, mo.includes('雨天适合看书。') && mo.includes('顾迟：借我一本'), mo.slice(0, 200));
  check(`[${tag}] 没有悬浮的 ＋ 发帖按钮`, await page.evaluate(() => { const f = document.getElementById('fabPost'); return !f || getComputedStyle(f).display === 'none'; }));
  await page.evaluate(() => document.querySelector('#gyWxTop .wx-r').click());
  await page.waitForTimeout(200);
  check(`[${tag}] 朋友圈右上角相机 = 发推文`, await page.evaluate(() => getComputedStyle(document.getElementById('postCreateModal')).display !== 'none'));
  await page.evaluate(() => closeModal('postCreateModal'));
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-moments.png` });
  await page.evaluate(() => gyWxTab('me'));
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-me.png` });
  await page.evaluate(() => [...document.querySelectorAll('#gyWxBody .wx-row')].find(r => r.innerText.includes('设置')).click());
  await page.waitForTimeout(300);
  check(`[${tag}] 我 → 设置：顶上是「‹ 系统设置」`, await page.evaluate(() => document.getElementById('gyWxBarT').textContent === '系统设置'));
  if (shots) await page.screenshot({ path: `${shots}/wx-${tag}-settings-in.png` });
  await page.evaluate(() => document.getElementById('gyWxSetEntry').click());
  await page.waitForTimeout(200);
  check(`[${tag}] 设置里再点一下切回白露`, await page.evaluate(() => !document.body.classList.contains('gywx') && localStorage.getItem('gyWxMode') === '0') && await vis(page, '.mobile-bottom-nav'));
  check(`[${tag}] 没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 300));
  await ctx.close();
}
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
