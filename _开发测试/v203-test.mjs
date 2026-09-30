// v203：返回（系统返回键 / 左边缘右滑 / 鼠标侧键）、经期记录（预测、日历、小组件、提醒、角色记得/照顾、自主模式自己决定）
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.accept());
await page.route(/^https?:\/\//, r => r.abort());
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && window.gyBack && window.gyPeriodOpen && window.__gyPmW && window.__gyPmW.WD.period, { timeout: 20000 });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  myCharacters.length = 0;
  myCharacters.push({ id: 9801, name: '顾言', worldbooks: [], actMode: 'fixed', diaryData: { letters: [], diaries: [] } },
                    { id: 9802, name: '沈之遥', worldbooks: [], actMode: 'auto', diaryData: { letters: [], diaries: [] } });
  globalChats['9801'] = [{ sender: 9801, text: '在呢', timestamp: Date.now() - 60000 }]; globalChats['9802'] = [];
});

// ================= 返回 =================
await page.evaluate(() => { switchMainView('settings'); switchMainView('notifications'); });
check('鼠标侧键：回到上一页', await page.evaluate(() => { window.dispatchEvent(new MouseEvent('mouseup', { button: 3 })); return getComputedStyle(document.getElementById('view-settings')).display !== 'none'; }));
await page.waitForTimeout(400);
await page.evaluate(() => { switchMainView('notifications'); });
await page.waitForTimeout(400);
// 左边缘往右滑
const sw = async () => page.evaluate(() => {
  const mk = (type, x, y) => { const t = new Touch({ identifier: 1, target: document.body, clientX: x, clientY: y }); document.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true })); };
  mk('touchstart', 8, 400); mk('touchmove', 60, 402); mk('touchmove', 140, 404); mk('touchend', 150, 404);
});
await sw();
check('从左边缘往右滑：回到上一页', await page.evaluate(() => getComputedStyle(document.getElementById('view-settings')).display !== 'none'));
await page.waitForTimeout(400);
// 弹窗先关
await page.evaluate(() => { openModal('cropModal'); });
await page.waitForTimeout(200);
check('有弹窗时先关弹窗（页面不动）', await page.evaluate(() => { const ok = gyBack(); const m = document.getElementById('cropModal'); return ok && getComputedStyle(m).display === 'none' && getComputedStyle(document.getElementById('view-settings')).display !== 'none'; }));
await page.waitForTimeout(400);
// 系统返回键（浏览器历史）
await page.evaluate(() => { switchMainView('notifications'); });
await page.waitForTimeout(500);
await page.evaluate(() => history.back());
await page.waitForTimeout(600);
check('系统返回键：回到上一页，还能接着按', await page.evaluate(() => getComputedStyle(document.getElementById('view-settings')).display !== 'none' && history.state && history.state.gyBack));
// 聊天里：回联系人
await page.waitForTimeout(400);
await page.evaluate(() => { switchMainView('chat'); switchChatSession('9801'); });
await page.waitForTimeout(300);
check('聊天里返回：回到联系人列表', await page.evaluate(() => { gyBack(); const a = document.getElementById('chatInputArea'); return !a || a.style.display === 'none'; }));
// 小手机
await page.waitForTimeout(400);
await page.evaluate(() => { gyPmSet(true); gyPmUnlock(); gyPmOpen('diary'); });
await page.waitForTimeout(500);
check('小手机：返回＝退一层 / 回桌面', await page.evaluate(() => { gyBack(); return !document.body.classList.contains('gyphm-app'); }));
await page.evaluate(() => gyPmSet(false));
await page.waitForTimeout(400);

// ================= 经期 =================
const K = n => page.evaluate(n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, n);
const [a0, a1, b0, b1] = [await K(-54), await K(-50), await K(-26), await K(-22)];
await page.evaluate(async ({ a0, a1, b0, b1 }) => { await gyPeriodStart(a0); await gyPeriodEnd(a1); await gyPeriodStart(b0); await gyPeriodEnd(b1); }, { a0, a1, b0, b1 });
const st = await page.evaluate(() => gyPeriodNow());
check('两次记录：平均周期 28 天、经期 5 天，下次预计 2 天后', st.cycle === 28 && st.len === 5 && st.toNext === 2 && !st.inPeriod, JSON.stringify(st));
check('日历上标出预计经期、排卵日', await page.evaluate(({ n2, ov }) => gyPeriodCell(n2).includes('pp') && gyPeriodCell(ov).includes('ov'), { n2: await K(2), ov: await K(-12) }));
// 提醒：提前 2 天
const sent = await page.evaluate(async () => {
  window.__sent = []; window.sendProactiveChatMessage = async (c) => { window.__sent.push({ id: c.id, ctx: getBoxPrompt(c) }); };
  try { setAutoFeature('takeoutOn', true, true); } catch (e) {} window.__orders = []; window.gytoCharOrder = async (id, food) => { window.__orders.push([id, food]); return { shop: food }; };
  window.__notifs = []; const an0 = window.addNotification; window.addNotification = function (t) { window.__notifs.push(String(t)); return an0.apply(this, arguments); };
  await gyPeriodTick();
  return { sent: window.__sent.map(x => [x.id, /提前提醒她/.test(x.ctx), /预计 2 天后来/.test(x.ctx)]), notif: window.__notifs.some(t => /经期预计 2 天后来/.test(t)) };
});
check('提前 2 天：提醒你（通知）', sent.notif, JSON.stringify(sent));
check('提前 2 天：默认模式的顾言主动来提醒（带着由头）；自主模式的沈之遥没记就不来', sent.sent.length === 1 && sent.sent[0][0] === 9801 && sent.sent[0][1] && sent.sent[0][2], JSON.stringify(sent));
// 今天来了
await page.evaluate(async () => { window.__sent = []; await gyPeriodStart(); });
await page.waitForTimeout(2200);
const d1 = await page.evaluate(async () => { await gyPeriodTick(); return { s: gyPeriodNow(), sent: window.__sent.map(x => [x.id, /今天来例假了/.test(x.ctx), /经期第 1 天/.test(x.ctx)]), orders: window.__orders }; });
check('今天来了：经期第 1 天；顾言当天主动来关心', d1.s.inPeriod && d1.s.day === 1 && d1.sent.some(x => x[0] === 9801 && x[1] && x[2]), JSON.stringify(d1));
const ctxs = await page.evaluate(() => ({ gu: __gyPeriodCtxFor(9801), shen: __gyPeriodCtxFor(9802) }));
check('聊天时顾言知道你在经期第几天（会体贴）；沈之遥（自主模式）还不知道', /经期第 1 天/.test(ctxs.gu) && /体贴/.test(ctxs.gu) && ctxs.shen === '', JSON.stringify(ctxs));
// 自主模式：菜单里有这些事，TA 自己挑
const acts = await page.evaluate(() => { const c = myCharacters[1]; return GY_AUTONOMY_ACTIONS.filter(a => /^period_/.test(a.key)).map(a => [a.key, !!a.need(c)]); });
check('自主模式：「记住对方经期」在 TA 能做的事里（记不记 TA 自己定）', acts.some(([k, n]) => k === 'period_note' && n) && acts.some(([k, n]) => k === 'period_care' && !n), JSON.stringify(acts));
const note = await page.evaluate(async () => { const a = GY_AUTONOMY_ACTIONS.find(x => x.key === 'period_note'); const r = await a.run(myCharacters[1]); return { r, ctx: __gyPeriodCtxFor(9802), care: GY_AUTONOMY_ACTIONS.find(x => x.key === 'period_care').need(myCharacters[1]) }; });
check('沈之遥自己决定记下之后：知道了，之后也能自己选「关心一下」', /记在心上/.test(note.r) && /经期第 1 天/.test(note.ctx) && note.care, JSON.stringify(note));
const warm = await page.evaluate(async () => { window.__orders = []; const a = GY_AUTONOMY_ACTIONS.find(x => x.key === 'period_warm'); const r = await a.run(myCharacters[1]); return { r, o: window.__orders }; });
check('点杯热的：真的去下单', /红糖|热|粥|可可|汤/.test(JSON.stringify(warm.o)), JSON.stringify(warm));
// 跟 TA 说「来例假了」TA 就知道
await page.evaluate(async () => { const D = gyPeriodData(); delete D.aware['9802']; switchMainView('chat'); switchChatSession('9802'); document.getElementById('chatInput').value = '我今天来例假了好难受'; window.triggerAIBatchReply = async () => {}; await sendChatMessage(); });
check('在聊天里说「来例假了」：这个角色就知道了', await page.evaluate(() => gyPeriodKnows(9802)));
// 界面
await page.evaluate(() => gyPeriodOpen());
await page.waitForTimeout(200);
await page.evaluate(() => { const k = gyPeriodNow().last; gyPeriodSetDay(k, 'flow', 3); gyPeriodSetDay(k, 'pain', 2); gyPeriodSetDay(k, 'sym', '腰酸'); gyPeriodSetDay(k, 'mood', '想被抱抱'); });
await page.waitForTimeout(200);
const ui = await page.evaluate(() => ({ t: document.getElementById('gyPrBox').innerText, ctx: __gyPeriodCtxFor(9801) }));
check('记录页：环、按钮、日历、流量/痛经/症状/心情/备注、设置', /经期第 1 天/.test(ui.t) && /今天走了/.test(ui.t) && /流量/.test(ui.t) && /痛经/.test(ui.t) && /腰酸/.test(ui.t) && /周期设置/.test(ui.t), ui.t.slice(0, 200));
check('当天记的（流量多、疼、腰酸、想被抱抱）TA 也知道', /流量多/.test(ui.ctx) && /腰酸/.test(ui.ctx) && /想被抱抱/.test(ui.ctx), ui.ctx);
check('返回键先关掉经期记录页', await page.evaluate(() => { gyBack(); return !document.getElementById('gyPrOv'); }));
// 小组件 + 小手机日历
await page.evaluate(() => { gyPmSet(true); gyPmUnlock(); gyPmAddW('period', 'm'); });
await page.waitForTimeout(600);
const w = await page.evaluate(() => { const el = document.querySelector('#gyPmHome .gw-pr'); return el ? el.innerText.replace(/\s+/g, ' ') : null; });
check('小组件「经期」：第几天 + 前后一周的小条', w && /经期第 1 天/.test(w) && /今天走了/.test(w), w);
await page.evaluate(() => gyPmCalendar());
await page.waitForTimeout(300);
check('小手机日历：经期那天标红、有「经期记录」入口和当天那一条', await page.evaluate(() => !!document.querySelector('#gyPmApp .pmc-grid .gypr-pd') && /经期记录/.test(document.getElementById('gyPmApp').innerText) && /🩸 经期/.test(document.getElementById('gyPmApp').innerText)));

check('整个过程没有页面报错', errs.length === 0, errs.join(' | ').slice(0, 400));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
