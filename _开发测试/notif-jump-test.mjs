// 🔔 点通知 / 点弹窗 / 小手机通知中心 / 灵动岛 —— 都要跳到对应的页面
// 用户反馈："点击通知无法跳转到相应功能和页面里去""怎么不能点击弹窗和通知消息跳转到对应页面"
// 这里把各种形式的通知（信件、私聊、群聊、帖子、小功能页、商城、自定义函数、只有一句话的老通知）
// 在三个地方各点一遍，确认都去了该去的地方；再验证"通知页开着时又来了一条"不会点错（按 id 找，不按下标）。
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('dialog', d => d.accept());
await page.route(/^https?:\/\//, r => r.abort());
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && window.gyOpenNotif && window.gyPushNotif && window.gyPmSet, { timeout: 20000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  myCharacters.length = 0;
  myCharacters.push({ id: 9101, name: '沈之遥', handle: '@shen', persona: '旧书店老板', worldbooks: [], diaryData: { letters: [], diaries: [] } },
                     { id: 9102, name: '顾迟', handle: '@gu', persona: '夜班医生', worldbooks: [], diaryData: { letters: [], diaries: [] } });
  groupChats.push({ id: 'g_n1', name: '书店夜班群', members: [9101, 9102] });
  globalChats['9101'] = [{ sender: 9101, text: '在吗', timestamp: Date.now() }];
  globalChats['g_n1'] = [{ sender: 9102, text: '群里有人吗', timestamp: Date.now() }];
  globalPosts.length = 0;
  globalPosts.push({ id: 'p_n1', char: myCharacters[1], text: '夜班结束，天亮了。', timestamp: Date.now() - 60000, replies: [], stats: { comments: 0, likes: 0, retweets: 0 } });
  globalNotifications.length = 0;
  toastMaxVisible = 0;   // 不合并弹窗，每条都弹出来
  window.__fnHit = null;
  window.gyTestFn = (a) => { window.__fnHit = a; switchMainView('settings'); };
});

// ---------- 各种通知怎么造、点完应该在哪 ----------
// make：在页面里造一条通知，返回它的 id；expect：点完之后检查
const KINDS = [
  { k: '信件（js/08 真实路径 saveTempDiary）', toast: true, make: () => {
      currentDiaryCharId = 9102; currentDiaryTab = 'letter';
      tempGeneratedDiary = { id: 'd_t' + Math.random(), title: '夜班之后', content: '天亮了。', date: Date.now(), author: 'char' };
      saveTempDiary();
      currentDiaryCharId = 9101; currentDiaryTab = 'diary';   // 故意切走，看点了能不能切回来
      return globalNotifications[0].id; },
    expect: () => { const v = document.getElementById('view-diary'); return v.style.display !== 'none' && String(currentDiaryCharId) === '9102' && currentDiaryTab === 'letter'; } },
  { k: '日记更新', toast: true, make: () => {
      currentDiaryCharId = 9101; currentDiaryTab = 'diary';
      tempGeneratedDiary = { id: 'd_t' + Math.random(), title: '今天', content: '下雨。', date: Date.now(), author: 'char' };
      saveTempDiary();
      currentDiaryCharId = 9102; currentDiaryTab = 'letter';
      return globalNotifications[0].id; },
    expect: () => document.getElementById('view-diary').style.display !== 'none' && String(currentDiaryCharId) === '9101' && currentDiaryTab === 'diary' },
  { k: '私聊（chatCharId）', toast: true, make: () => addNotification('<b>沈之遥</b> 给您发来消息', null, '9101', myCharacters[0], '在吗').id,
    expect: () => document.getElementById('view-chat').style.display !== 'none' && String(currentChatSessionId) === '9101' },
  { k: '群聊（chatCharId 是群 id）', toast: true, make: () => addNotification('<b>顾迟</b> 在「书店夜班群」里说了句话', null, 'g_n1', myCharacters[1], '').id,
    expect: () => document.getElementById('view-chat').style.display !== 'none' && String(currentChatSessionId) === 'g_n1' },
  { k: '帖子（postId）', toast: true, make: () => addNotification('<b>顾迟</b> 评论了您的帖子', 'p_n1', null, myCharacters[1], '辛苦').id,
    expect: () => document.getElementById('view-post-detail').style.display !== 'none' && document.getElementById('view-post-detail').innerText.includes('夜班结束') },
  { k: '小功能：地图（feature:map）', toast: true, make: () => addNotification('<b>沈之遥</b> 去了码头', null, null, myCharacters[0], '', { feature: 'map' }).id,
    expect: () => document.getElementById('view-feature-page').style.display !== 'none' && (document.getElementById('gyfpTitle') || {}).innerText.includes('行程') },
  { k: '小功能：八卦网（feature:gossip）', toast: true, make: () => addNotification('有人在传话', null, null, null, '', { feature: 'gossip' }).id,
    expect: () => document.getElementById('view-feature-page').style.display !== 'none' && (document.getElementById('gyfpTitle') || {}).innerText.includes('八卦') },
  { k: '商城（view:mall）', toast: true, make: () => addNotification('📦 快递到了', null, null, null, '', { view: 'mall' }).id,
    expect: () => document.getElementById('view-mall').style.display !== 'none' },
  { k: '自定义函数（jump.fn）', toast: true, make: () => { window.__fnHit = null; gyNotifyJump(myCharacters[0], '✨ 测试函数跳转', '', { fn: 'gyTestFn', args: ['ok'] }); return globalNotifications[0].id; },
    expect: () => window.__fnHit === 'ok' && document.getElementById('view-settings').style.display !== 'none' },
  { k: '自主动作 group_talk → 那个群', toast: true, make: () => { gyActNotify(myCharacters[1], { key: 'group_talk', label: '群里说话' }, { ok: true, result: '在「书店夜班群」里说了句话' }); return globalNotifications[0].id; },
    expect: () => document.getElementById('view-chat').style.display !== 'none' && String(currentChatSessionId) === 'g_n1' },
  { k: '只有一句话的老通知（按字面猜：信 → 那个人的信件）', toast: false, make: () => { globalNotifications.unshift({ text: '<b>顾迟</b> 给你寄来了一封信：旧信', timestamp: Date.now() }); currentDiaryCharId = 9101; currentDiaryTab = 'diary'; return null; },
    expect: () => document.getElementById('view-diary').style.display !== 'none' && String(currentDiaryCharId) === '9102' && currentDiaryTab === 'letter' },
];
const kindCount = KINDS.length;
// 把 make/expect 放进页面
await page.evaluate(src => { window.__KINDS = eval(src); }, '[' + KINDS.map(x => `{ make: ${x.make.toString()}, expect: ${x.expect.toString()} }`).join(',') + ']');

async function makeKind(i) {
  return await page.evaluate(i => {
    switchMainView('home');
    document.getElementById('toastContainer').innerHTML = '';
    let id = window.__KINDS[i].make();
    if (!id) { gyNotifEnsureIds(); id = globalNotifications[0].id; }
    switchMainView('home');
    return String(id);
  }, i);
}
const expectKind = i => page.evaluate(i => { try { return !!window.__KINDS[i].expect(); } catch (e) { return 'ERR ' + e.message; } }, i);
const where = () => page.evaluate(() => [...document.querySelectorAll('.main-content > div[id^="view-"]')].filter(v => v.style.display && v.style.display !== 'none').map(v => v.id).join(',') + ' chat=' + currentChatSessionId + ' diary=' + currentDiaryCharId + '/' + currentDiaryTab);

// ---------- 一、通知页 ----------
for (let i = 0; i < kindCount; i++) {
  const id = await makeKind(i);
  await page.evaluate(() => { document.getElementById('toastContainer').innerHTML = ''; switchMainView('notifications'); });
  await page.waitForTimeout(80);
  const all = await page.evaluate(() => [...document.querySelectorAll('#notificationsSection .notification-item')].every(el => el.getAttribute('onclick') && el.dataset.nid));
  if (i === 0) check('通知页：每一条都能点（都带 data-nid 和点击）', all);
  await page.click(`#notificationsSection .notification-item[data-nid="${id}"]`);
  await page.waitForTimeout(200);
  const ok = await expectKind(i);
  check(`通知页 · ${KINDS[i].k}`, ok === true, ok + ' ' + await where());
}
check('点过的通知标成已读', await page.evaluate(() => globalNotifications.filter(n => n.read).length >= 5));

// ---------- 二、弹窗 ----------
for (let i = 0; i < kindCount; i++) {
  if (!KINDS[i].toast) continue;
  const id = await makeKind(i);
  const has = await page.evaluate(id => !!document.querySelector(`#toastContainer .toast-item[data-nid="${id}"]`), id);
  if (!has) { check(`弹窗 · ${KINDS[i].k}`, false, '没有带 data-nid 的弹窗'); continue; }
  await page.evaluate(id => document.querySelector(`#toastContainer .toast-item[data-nid="${id}"]`).click(), id);
  await page.waitForTimeout(200);
  const ok = await expectKind(i);
  check(`弹窗 · ${KINDS[i].k}`, ok === true, ok + ' ' + await where());
}
// 老式弹窗（不带通知，只给 postId / chatCharId）照样能跳
await page.evaluate(() => { switchMainView('home'); document.getElementById('toastContainer').innerHTML = ''; showToast('', '老弹窗', '', null, 'g_n1'); document.querySelector('#toastContainer .toast-item').click(); });
await page.waitForTimeout(150);
check('老式弹窗（只给群 id）也能跳进群聊', await page.evaluate(() => String(currentChatSessionId) === 'g_n1' && document.getElementById('view-chat').style.display !== 'none'));

// ---------- 三、通知页开着的时候又来了一条：不串号 ----------
const race = await page.evaluate(async () => {
  switchMainView('home');
  const a = addNotification('<b>顾迟</b> 赞了您的帖子 ❤️', 'p_n1', null, myCharacters[1], '');
  switchMainView('notifications');
  const firstBefore = document.querySelector('#notificationsSection .notification-item');
  const staleOnclick = firstBefore.getAttribute('onclick');
  // 新通知进来（走 addNotification）→ 通知页自动重画
  const b = addNotification('<b>沈之遥</b> 给您发来消息', null, '9101', myCharacters[0], '');
  const firstAfter = document.querySelector('#notificationsSection .notification-item');
  const rerendered = firstAfter.dataset.nid === b.id;
  // 别的模块直接 unshift、不叫 updateNotifBadge：兜底的定时检查 1.5 秒内也会重画
  globalNotifications.unshift({ text: '<b>顾迟</b> 回了你一封信：x', timestamp: Date.now() });
  await new Promise(r => setTimeout(r, 1800));
  const rerendered2 = document.querySelectorAll('#notificationsSection .notification-item').length === globalNotifications.length
    && !!document.querySelector('#notificationsSection .notification-item').dataset.nid;
  // 用插队之前那个旧按钮点（以前按下标 0 会打开刚进来的私聊）
  new Function(staleOnclick)();
  await new Promise(r => setTimeout(r, 200));
  return { rerendered, rerendered2, post: document.getElementById('view-post-detail').style.display !== 'none', chat: document.getElementById('view-chat').style.display !== 'none' };
});
check('通知页开着时来了新通知：自动重画，新的在最上面', race.rerendered, JSON.stringify(race));
check('别的模块直接塞进来的通知：也会补上 id 并重画', race.rerendered2, JSON.stringify(race));
check('插队之后点旧的那条：还是打开原来那条（帖子），不是新来的私聊', race.post && !race.chat, JSON.stringify(race));

// ---------- 四、小手机模式：通知中心 + 灵动岛 ----------
await page.evaluate(() => { gyPmSet(true); });
await page.waitForTimeout(600);
await page.evaluate(() => { try { gyPmUnlock(); } catch (e) {} });
await page.waitForTimeout(400);
for (let i = 0; i < kindCount; i++) {
  const id = await makeKind(i);
  await page.evaluate(() => { document.getElementById('toastContainer').innerHTML = ''; gyPmNC(true); });
  await page.waitForTimeout(150);
  const has = await page.evaluate(id => !!document.querySelector(`#gyPmNC .nc-n[data-nid="${id}"]`), id);
  if (!has) { check(`小手机通知中心 · ${KINDS[i].k}`, false, '通知中心里找不到这条'); continue; }
  await page.evaluate(id => document.querySelector(`#gyPmNC .nc-n[data-nid="${id}"]`).click(), id);
  await page.waitForTimeout(250);
  const ok = await expectKind(i);
  check(`小手机通知中心 · ${KINDS[i].k}`, ok === true, ok + ' ' + await where());
}
check('小手机：点完通知进了 App 界面（不是停在桌面）', await page.evaluate(() => document.body.classList.contains('gyphm-app')));
// 通知中心的细节行用上了 desc
check('小手机通知中心：细节行显示通知里带的 desc', await page.evaluate(() => {
  addNotification('📦 快递到了', null, null, null, '顺丰：一箱旧书', { view: 'mall' });
  gyPmNC(true); const t = document.getElementById('gyPmNC').innerText; gyPmNC(false); return t.includes('顺丰：一箱旧书');
}));

// 灵动岛：来一条，岛上弹出来；点之前又来一条，点岛还是打开原来那条
const isl = await page.evaluate(async () => {
  switchMainView('home');
  await new Promise(r => setTimeout(r, 1300));
  const a = addNotification('<b>顾迟</b> 在「书店夜班群」里说了句话', null, 'g_n1', myCharacters[1], '');
  await new Promise(r => setTimeout(r, 1300));
  const d = document.getElementById('gyPmIsl');
  const shown = d && d.classList.contains('m-alert');
  // 岛还亮着，又悄悄进来一条（不弹岛：直接塞进数组最前面）
  globalNotifications.unshift({ id: 'nt_quiet', text: '<b>沈之遥</b> 给您发来消息', chatCharId: '9101', timestamp: Date.now() - 10 * 60000 });
  d.click();
  await new Promise(r => setTimeout(r, 300));
  return { shown, chat: String(currentChatSessionId), view: document.getElementById('view-chat').style.display !== 'none' };
});
check('灵动岛：新通知弹上岛', isl.shown, JSON.stringify(isl));
check('灵动岛：点岛打开的是弹出来的那条（群聊），不是后来插队的', isl.view && isl.chat === 'g_n1', JSON.stringify(isl));
await page.evaluate(() => gyPmSet(false));

check('整个过程没有页面报错', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 400));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
