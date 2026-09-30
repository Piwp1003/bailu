// 🎲 生活里的意外（日程里随机碰上点事）+ 今天面板能上下滑 的回归测试。
// 无头浏览器真的跑 index.html，AI 请求拦成本地假响应，不联网、不动你的存档。
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('dialog', d => d.accept());

let DICE = {};
const prompts = [];
await page.route(/^https?:\/\//, async r => {
  const u = r.request().url();
  if (!/chat\/completions/.test(u)) return r.abort();
  let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
  const all = JSON.stringify(body.messages || body.prompt || '');
  prompts.push(all);
  let content = '好的';
  if (all.includes('你碰上了一件计划外的事')) content = JSON.stringify(DICE);
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});

const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && typeof window.gyLifeRoll === 'function', { timeout: 20000 });
await page.waitForTimeout(1000);

const pad = n => String(n).padStart(2, '0');
await page.evaluate((pad0) => {
  const pad = n => String(n).padStart(2, '0');
  const h = new Date().getHours();
  myApiKey = 'sk-test'; myApiUrl = 'https://api.test.local/v1'; myModel = 'm';
  myCharacters.length = 0;
  myCharacters.push(
    { id: 8101, name: '沈之遥', handle: '@shen', persona: '旧书店老板', worldbooks: [], actMode: 'auto',
      schedule: { text: `${pad(h)}:00 去街角的旧货市场淘书\n23:59 睡觉`, generatedAt: Date.now() } },
    { id: 8102, name: '顾迟', handle: '@gu', persona: '夜班医生', worldbooks: [], actMode: 'auto',
      schedule: { text: `${pad(h)}:00 在家补觉\n23:59 睡觉`, generatedAt: Date.now() } },
    { id: 8103, name: '路人甲', handle: '@lu', persona: '谁也不认识', worldbooks: [] });
  charRelationships.length = 0;
  charRelationships.push({ id: 'r1', fromId: 8101, toId: 8102, label: '老朋友' });
  globalTheaterLogs.length = 0;
  setAutoFeature('charAutonomy', true, true);
  setAutoFeature('charTheater', true, true);
  localStorage.setItem('settingEnableCharInteraction', 'true');
  quietHoursEnabled = false;
}, 0);

// ---------- 一、跟日程走的随机 ----------
const ch = await page.evaluate(() => ({ out: __gyLifeDiceChance(myCharacters[0]), home: __gyLifeDiceChance(myCharacters[1]) }));
check('出门在外（淘书）比在家补觉更容易碰上事', ch.out > ch.home * 3, JSON.stringify(ch));
check('不是必然：每 5 分钟只是一个概率', ch.out > 0 && ch.out < 0.5, JSON.stringify(ch));

DICE = { what: '你在旧货摊上翻到一本缺了封面的诗集，扉页写着陌生人的名字', who: '', feel: 2, weight: 0.7 };
const r1 = await page.evaluate(() => gyLifeRoll(8101));
const p1 = prompts[prompts.length - 1] || '';
check('碰上的事按此刻的日程来写（提示词里有「去街角的旧货市场淘书」）', p1.includes('旧货市场淘书'), p1.slice(0, 200));
check('提示词里只列关系网上认识的人', p1.includes('顾迟') && !p1.includes('路人甲'));
check('碰上的事记下来了', r1 && r1.h && r1.h.what.includes('诗集'), JSON.stringify(r1));
const evs = await page.evaluate(() => (myCharacters[0].lifeEvents || []).map(e => e.t));
check('变成 TA 身上发生的事（自主决策时会看到）', evs.some(t => t.includes('诗集') && t.includes('淘书')), JSON.stringify(evs));
check('进了 TA 的 prompt（聊天时可能自然提起）', await page.evaluate(() => (__gyLifeCtxFor(8101) || '').includes('诗集')));
check('getBoxPrompt 里也带上了', await page.evaluate(() => (getBoxPrompt(myCharacters[0]) || '').includes('今天碰上的事')));

// 再碰一次：最近碰上过的会告诉模型，别重复
DICE = { what: '你在街口被一只橘猫跟了半条街', who: '', feel: 1, weight: 0.3 };
await page.evaluate(() => gyLifeRoll(8101));
check('最近碰上过的会告诉模型「别再是同一类」', (prompts[prompts.length - 1] || '').includes('诗集'));

// 碰上认识的人：两边都知道
DICE = { what: '你在市场门口撞见顾迟拎着一袋橘子', who: '顾迟', feel: 2, weight: 0.8 };
await page.evaluate(() => gyLifeRoll(8101));
const both = await page.evaluate(() => ({
  th: globalTheaterLogs.some(l => l.dice && l.charBId === 8102),
  a: (myCharacters[0].lifeEvents || []).some(e => e.t.includes('撞见顾迟')),
  b: (myCharacters[1].lifeEvents || []).some(e => e.t.includes('碰上了沈之遥') && e.t.includes('撞见你'))
}));
check('碰上认识的人：记进「Ta们在做什么」', both.th, JSON.stringify(both));
check('碰上认识的人：两个人身上都记下了（对方那边视角是"撞见你"）', both.a && both.b, JSON.stringify(both));

// 不认识的人不会被当成"认识的人"
DICE = { what: '你看见路人甲在摊前砍价', who: '路人甲', feel: 0, weight: 0.2 };
await page.evaluate(() => gyLifeRoll(8101));
check('模型写了不认识的人：不算碰上熟人，不进小剧场', await page.evaluate(() => !globalTheaterLogs.some(l => l.dice && l.charBId === 8103)));

// 开关：关着不自己碰，手动照样能碰
await page.evaluate(() => setAutoFeature('lifeDice', false, true));
const n0 = prompts.length;
await page.evaluate(async () => { const r0 = Math.random; Math.random = () => 0; try { for (let i = 0; i < 3; i++) await __gyLifeDiceTick(); } finally { Math.random = r0; } });
check('开关关着：后台不自己碰', prompts.length === n0);
await page.evaluate(() => setAutoFeature('lifeDice', true, true));
DICE = { what: '你发现常去的那家面馆关门了', who: '', feel: -1, weight: 0.4 };
await page.evaluate(async () => { const r0 = Math.random; Math.random = () => 0; try { await __gyLifeDiceTick(); } finally { Math.random = r0; } });
check('开关开着、骰子掷中：后台自己碰上了一件', prompts.length === n0 + 1);
check('默认模式的角色，挡位是「关」：不碰', await page.evaluate(() => !(myCharacters[2].happenings || []).length));
// 你给默认模式的角色调了挡：它也会随机触发
DICE = { what: '你在便利店门口被雨困住了', who: '', feel: -1, weight: 0.3 };
await page.evaluate(() => { gyLifeDiceRate(8103, 'high'); myCharacters[0].actMode = 'fixed'; myCharacters[1].actMode = 'fixed'; });
check('默认模式的角色调到「多」之后更容易触发', await page.evaluate(() => __gyLifeDiceChance(myCharacters[2]) > 0));
await page.evaluate(async () => { const r0 = Math.random; Math.random = () => 0; try { await __gyLifeDiceTick(); } finally { Math.random = r0; } });
check('调了挡的默认模式角色：后台会随机触发', await page.evaluate(() => (myCharacters[2].happenings || []).some(h => h.what.includes('便利店'))));
await page.evaluate(() => { myCharacters[0].actMode = 'auto'; myCharacters[1].actMode = 'auto'; });

// ---------- 二、今天面板 ----------
await page.evaluate(() => { gyTodaySet(true); });
await page.waitForTimeout(200);
await page.evaluate(() => { document.querySelectorAll('#gyToday details').forEach(d => d.open = true); gyTodayRender(); document.querySelectorAll('#gyToday details').forEach(d => d.open = true); });
await page.waitForTimeout(200);
const html = await page.evaluate(() => document.getElementById('gyToday').innerHTML);
check('时间管理大师里有「🎲 随机事件已触发」和手动按钮', html.includes('随机事件已触发') && html.includes('现在触发一个'));
const blocks = await page.evaluate(() => ({ auto: gyLifeTodayHtml(myCharacters[0]), fixed: gyLifeTodayHtml(myCharacters[2]) }));
check('自主决定的角色：不给挡位，写着「TA 自己的节奏」', !blocks.auto.includes('<select') && blocks.auto.includes('TA 自己的节奏'));
check('默认模式的角色：有挡位让你调（关/少/正常/多，刚才调成了「多」）', blocks.fixed.includes('<select') && blocks.fixed.includes('value="off"') && /value="high" selected/.test(blocks.fixed));
check('默认模式的角色：没调过的默认是「关」', await page.evaluate(() => { myCharacters.push({ id: 8199, name: '新人', persona: '', worldbooks: [] }); const r = gyLifeDiceRate(8199); myCharacters.pop(); return r === 'off'; }));
check('默认模式的角色也出现在时间管理大师里', html.includes('路人甲') && html.includes('默认模式'));
check('碰上的事列在里面', html.includes('诗集'));
const sc = await page.evaluate(async () => {
  const el = document.querySelector('.sidebar-right-content');
  const before = el.scrollTop;
  el.scrollTop = 600;
  await new Promise(r => setTimeout(r, 50));
  return { sh: el.scrollHeight, chh: el.clientHeight, top: el.scrollTop, before, ov: getComputedStyle(el).overflowY };
});
check('今天面板内容比屏幕高时，右栏能自己上下滑', sc.sh > sc.chh && sc.top > sc.before && sc.ov === 'auto', JSON.stringify(sc));
await page.mouse.move(1100, 400);
const t0 = await page.evaluate(() => { const el = document.querySelector('.sidebar-right-content'); el.scrollTop = 0; return 0; });
await page.mouse.wheel(0, 500);
await page.waitForTimeout(300);
check('鼠标滚轮在右栏上滚得动', await page.evaluate(() => document.querySelector('.sidebar-right-content').scrollTop > 0));

// ---------- 三、跟着存档走 ----------
await page.evaluate(() => saveAllData({ immediate: true }));
await page.waitForTimeout(300);
await page.reload();
await page.waitForFunction(() => window.__guyuBooted, { timeout: 20000 });
await page.waitForTimeout(800);
check('重开后碰上的事还在', await page.evaluate(() => (myCharacters.find(c => c.id === 8101).happenings || []).length >= 4));

check('整个过程没有页面报错', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
