// 💬 聊天里说到做到：要什么就做什么（写日记不再变成写信、匿名论坛发帖不再变成发推文），
//    自主模式那张表里的每件事都能从聊天里做到，「今天」面板跟着数据变
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('dialog', d => d.accept());
await page.route(/^https?:\/\//, async r => {
  if (!/chat\/completions/.test(r.request().url())) return r.abort();
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{"n": 60, "why": "想你了"}' } }] }) });
});
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && window.GY_CHAT_ACTS && window.gyChatActsRunOne && typeof GY_AUTONOMY_ACTIONS !== 'undefined'
  && GY_AUTONOMY_ACTIONS.some(a => a.key === 'takeout_self') && GY_AUTONOMY_ACTIONS.some(a => a.key === 'web_explore'), { timeout: 20000 });
await page.waitForTimeout(800);

await page.evaluate(() => {
  myApiKey = 'sk-test'; myApiUrl = 'https://api.test.local/v1'; myModel = 'm';
  myCharacters.length = 0;
  myCharacters.push({ id: 8301, name: '林未', handle: '@lin', persona: '夜班护士', worldbooks: [], actMode: 'fixed', diaryData: { letters: [], diaries: [] } });
  setAutoFeature('chatActions', true, true);
  // 间谍：只记"被叫了"，不真的去调接口
  window.__calls = [];
  const spy = (name, ret) => function () { window.__calls.push({ name, args: Array.from(arguments).slice(1).map(x => typeof x === 'object' ? JSON.stringify(x) : x) }); return Promise.resolve(typeof ret === 'function' ? ret.apply(null, arguments) : ret); };
  window.autonomyWriteDiary = spy('diary', '写了篇日记：测试');
  window.autoGenerateAnonPostForChar = spy('anon', { success: true });
  window.autoGenerateForumThreadForChar = spy('forum', { success: true });
  window.executeGeneration = spy('tweet', undefined);
  window.generateProactiveLetter = spy('letter', (c) => { c.diaryData.letters.unshift({ id: 'L' + Date.now(), title: '信', content: '…', date: Date.now(), author: 'char' }); return true; });
  const A = k => GY_AUTONOMY_ACTIONS.find(a => a.key === k);
  A('moment_self').need = () => true; A('moment_self').run = spy('moment', '发了条朋友圈');
  A('web_explore').need = () => true; A('web_explore').run = spy('web_explore', '上网看了看');
  A('takeout_self').need = () => true; A('takeout_self').run = spy('takeout_self', '给自己点了外卖');
});

// ---------- 一、名字认对 ----------
const keyOf = t => page.evaluate(t => { const r = gyChatActsExtract('好。' + t, myCharacters[0], false); return r.acts.map(a => a.key).join(','); }, t);
check('[ACT:写日记] → 写日记（不是写信）', (await keyOf('[ACT:写日记]')) === 'diary', await keyOf('[ACT:写日记]'));
check('[ACT:匿名论坛发帖|x] → 匿名区（不是推文）', (await keyOf('[ACT:匿名论坛发帖|最近好累]')) === 'anon', await keyOf('[ACT:匿名论坛发帖|最近好累]'));
check('[ACT:去匿名区发帖] → 匿名区', (await keyOf('[ACT:去匿名区发帖]')) === 'anon', await keyOf('[ACT:去匿名区发帖]'));
check('[ACT:论坛发帖] → 论坛', (await keyOf('[ACT:论坛发帖]')) === 'forum', await keyOf('[ACT:论坛发帖]'));
check('[ACT:发朋友圈] → 朋友圈（不是推文）', (await keyOf('[ACT:发朋友圈]')) === 'moment', await keyOf('[ACT:发朋友圈]'));
check('[ACT:回信] → 写信', (await keyOf('[ACT:回信]')) === 'letter', await keyOf('[ACT:回信]'));
check('[ACT:写信] → 写信', (await keyOf('[ACT:写信]')) === 'letter', await keyOf('[ACT:写信]'));
check('[ACT:发推文] 还是推文', (await keyOf('[ACT:发推文]')) === 'post', await keyOf('[ACT:发推文]'));
check('[ACT:给自己点外卖] → 自主表里的 takeout_self（不是给你点）', (await keyOf('[ACT:给自己点外卖]')) === 'auto:takeout_self', await keyOf('[ACT:给自己点外卖]'));
check('[ACT:web_explore] → 桥到自主表', (await keyOf('[ACT:web_explore]')) === 'auto:web_explore', await keyOf('[ACT:web_explore]'));
check('没带标记、默认模式：「我这就去写篇日记」也认成写日记', (await keyOf('我这就去写篇日记。')) === 'diary', await keyOf('我这就去写篇日记。'));
check('没带标记：「我去匿名论坛发一条」→ 匿名区', (await keyOf('我去匿名论坛发一条吐槽。')) === 'anon', await keyOf('我去匿名论坛发一条吐槽。'));
check('没带标记：「我去论坛发个帖」→ 论坛', (await keyOf('我去论坛发个帖问问。')) === 'forum', await keyOf('我去论坛发个帖问问。'));
check('没带标记：「我发个朋友圈」→ 朋友圈', (await keyOf('等下我发个朋友圈。')) === 'moment', await keyOf('等下我发个朋友圈。'));
check('「你去写日记吧」不算 TA 要做', (await keyOf('你去写日记吧。')) === '', await keyOf('你去写日记吧。'));

// ---------- 二、真的去做了对的那件 ----------
const run = async (t) => page.evaluate(async t => {
  const c = myCharacters[0];
  const before = window.__calls.length;
  const r = gyChatActsExtract(t, c, false);
  for (const a of r.acts) await gyChatActsRunOne(c, a);
  return window.__calls.slice(before).map(x => x.name).join(',');
}, t);
let got = await run('[ACT:写日记|今天的夜班]');
check('写日记：叫的是日记函数，没叫写信', got === 'diary', got);
got = await run('[ACT:匿名论坛发帖|最近好累]');
check('匿名论坛发帖：叫的是匿名区，没发推', got === 'anon', got);
got = await run('[ACT:论坛发帖|求推荐]');
check('论坛发帖：叫的是论坛', got === 'forum', got);
got = await run('[ACT:发朋友圈|下班了]');
check('发朋友圈：叫的是朋友圈', got === 'moment', got);
got = await run('[ACT:web_explore]');
check('自主表里才有的事（上网）：经桥真的做了', got === 'web_explore', got);
got = await run('[ACT:给自己点外卖]');
check('自主表里才有的事（给自己点外卖）：经桥真的做了', got === 'takeout_self', got);
check('经桥做的记进了自主日志', await page.evaluate(() => (myCharacters[0].autonomyLog || []).some(l => l.action === 'web_explore' && l.fromChat)));

// 方向：对方开口让写的，日记函数收到 by=user；匿名发帖的方向里写着"对方让你做的"
const dir = await page.evaluate(async () => {
  const c = myCharacters[0];
  globalChats['8301'] = [{ sender: 'me', text: '你去匿名论坛发个帖子吐槽一下我呗', timestamp: Date.now() }];
  window.__calls = []; gyChatActsResetRecent();
  gyChatActsRun(c, '8301', gyChatActsExtract('行吧。[ACT:匿名区|吐槽你]', c, false).acts);
  await new Promise(r => setTimeout(r, 2600));
  return window.__calls.map(x => x.name + ':' + x.args.join('|')).join(' / ');
});
check('对方开口让做的：匿名发帖的方向里写着"对方让你做的"', /anon:.*让你去做的/.test(dir), dir);

// ---------- 三、prompt 里列出了这些事 ----------
const pr = await page.evaluate(() => gyChatActsPrompt(myCharacters[0], false));
check('prompt 列了写日记 / 匿名论坛发帖 / 论坛发帖 / 发朋友圈', ['[ACT:写日记', '[ACT:匿名论坛发帖', '[ACT:论坛发帖', '[ACT:发朋友圈'].every(x => pr.includes(x)), pr.slice(0, 400));
check('prompt 也列了自主表里的事（上网、给自己点外卖）', pr.includes('[ACT:web_explore') && pr.includes('[ACT:给自己点外卖'));
check('prompt 没列「什么都不做」和偷翻日记', !pr.includes('什么都不做') && !pr.includes('偷翻'));
check('写信的说明不再引到日记上', !pr.includes('信件与日记里收到'));

// ---------- 四、「今天」面板：写完信马上显示下一次 ----------
await page.evaluate(() => {
  const c = myCharacters[0];
  c.actMode = 'auto'; setAutoFeature('charAutonomy', true, true);
  c.letterFreq = { interval: 60, unit: 'min' };
  c.taGap = { letter: { ms: 3 * 3600000, why: '慢慢写', at: Date.now() } };
  c.diaryData.letters = []; c.lastLetterProactiveTime = 0;
  gyTodaySet(true);
  document.querySelectorAll('#gyToday details').forEach(d => d.open = true);
  gyTodayRender();
  document.querySelectorAll('#gyToday details').forEach(d => d.open = true);
});
const letterRow = () => page.evaluate(() => (gyTaRhythm(myCharacters[0]) || []).find(r => r.gk === 'letter') || null);
const hasBar = () => page.evaluate(() => { const el = document.querySelector('#gyToday [data-rhi="8301|letter"]'); return el ? !!el.querySelector('.gyt-rh-bar') : null; });
check('写信之前：信那张卡还没有"下一次"', !((await letterRow()) || {}).next, JSON.stringify(await letterRow()));
await page.evaluate(async () => {
  const c = myCharacters[0];
  c.diaryData.letters.unshift({ id: 'L1', title: '旧信', content: '…', date: Date.now() - 10 * 60000, author: 'char' });
});
const r1 = await letterRow();
check('信存的是 date：算得出下一次（上一次 + TA 说的间隔）', r1 && r1.next > Date.now() && Math.abs(r1.last - (Date.now() - 10 * 60000)) < 5000, JSON.stringify(r1));
// 聊天里写了封信 → 不用切页，面板自己刷新
await page.evaluate(() => { gyTodayRender(); document.querySelectorAll('#gyToday details').forEach(d => d.open = true); myCharacters[0].diaryData.letters = []; gyTodayRender(); });
const before = await hasBar();
await page.evaluate(async () => { await gyChatActsRunOne(myCharacters[0], { key: 'letter', args: [] }); });
await page.waitForTimeout(1200);
const after = await hasBar();
check('聊天里写完信：「今天」上信那张卡自己刷新出了进度（不用切页）', before === false && after === true, before + '→' + after);
check('写完信那张卡的"下一次"有了', ((await letterRow()) || {}).next > Date.now(), JSON.stringify(await letterRow()));

// 日记（自主表 diary）：真实数据里有日记就算"上一次"
const lastDiary = await page.evaluate(() => {
  const c = myCharacters[0];
  c.diaryData.diaries.unshift({ id: 'd1', title: 't', content: 'c', date: Date.now() - 5 * 60000, author: 'char' });
  c.taHabit = { at: Date.now(), m: { diary: { ms: 3600000, at: Date.now(), why: '' } } };
  const r = (gyTaRhythm(c) || []).find(x => x.gk === 'act:diary');
  return r ? r.last : -1;
});
check('没经过自主日志写的日记，时间卡上也有"上一次"', lastDiary > Date.now() - 6 * 60000, String(lastDiary));

check('gyDataChanged 在', await page.evaluate(() => typeof window.gyDataChanged === 'function'));
check('整个过程没有页面报错', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
