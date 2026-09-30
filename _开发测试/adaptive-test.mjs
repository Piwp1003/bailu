// 专测「提示词里不许写死用户名字、不许写死可自定义的时间」
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('dialog', d => d.accept());

let lastPrompt = null;
await page.route(/^https?:\/\//, r => r.abort());
await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=v;return Promise.resolve(v)},getItem(k){return Promise.resolve(this._d[k]??null)},removeItem(k){return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));
await page.route('**/chat/completions', async route => {
  try { lastPrompt = JSON.parse(route.request().postData() || '{}'); } catch (e) { lastPrompt = {}; }
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: '{"title":"回信","content":"收到了。"}' } }] }) });
});

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof window.userDisplayName === 'function', { timeout: 15000 });
await page.waitForTimeout(400);

const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok, extra });
const promptText = () => JSON.stringify((lastPrompt && lastPrompt.messages) || []);

// ============ 一、名字必须是自适应的 ============

// 源码里不能出现"某个具体人名当默认值"。这里用作者的名字做哨兵：
// 它可以出现在"由 XX 制作"的署名里（那是作者署名，不是用户名字），但不能出现在任何提示词/默认资料里。
const jsFiles = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js'));
const badLines = [];
for (const f of jsFiles) {
  const txt = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  txt.split('\n').forEach((line, i) => {
    if (!line.includes('林')) return;
    if (/森林|竹林|园林|林立|林荫|武林|少林|山林|树林|林间|丛林/.test(line)) return;
    if (line.includes('制作')) return;              // 作者署名，允许
    if (/\/[^\/\n]*\|林\|[^\/\n]*\//.test(line)) return;   // 关键词正则里单独一个「林」（树林的林），不是人名
    if (line.trim().startsWith('//')) return;       // 注释里提到没关系
    badLines.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
  });
}
check('源码里没有把具体人名写死进默认资料/提示词', badLines.length === 0, badLines.join('\n       '));

const defaultName = await page.evaluate(() => currentUser.name);
check('新装时的默认用户名是中性的', defaultName === '我', '现在是：' + defaultName);

const nameCases = await page.evaluate(() => {
  const out = {};
  const save = currentUser.name;
  currentUser.name = '';         out.blank = userDisplayName();
  currentUser.name = '   ';      out.spaces = userDisplayName();
  currentUser.name = '我';       out.def = userDisplayName();
  currentUser.name = '阿岚';     out.custom = userDisplayName();
  currentUser.name = save;
  return out;
});
check('名字为空时不会拼出断句', nameCases.blank === '用户', nameCases.blank);
check('名字只有空格时同样兜底', nameCases.spaces === '用户', nameCases.spaces);
check('名字还是默认"我"时提示词里换成"用户"', nameCases.def === '用户', nameCases.def);
check('用户改了名字就用用户自己的名字', nameCases.custom === '阿岚', nameCases.custom);

// 换个名字，提示词里必须立刻跟着变
await page.evaluate(() => {
  myCharacters.length = 0;
  myCharacters.push({ id: 9001, name: '沈之遥', persona: '旧书店老板', worldbooks: [],
    diaryData: { letters: [{ id: 'l1', title: '第一封', content: '你好啊。', date: Date.now() - 3600000, author: 'user' }], diaries: [] },
    pendingLetterReplies: [{ id: 'p1', letterId: 'l1', dueAt: Date.now() + 999999 }] });
  myApiUrl = 'https://api.test.local/v1'; myApiKey = 'sk-test'; myModel = 'gpt-test';
});

for (const nm of ['阿岚', 'Mia', '小满']) {
  const p = await page.evaluate((n) => { currentUser.name = n; return buildBasePrompt(myCharacters[0], true, ''); }, nm);
  check(`用户名改成「${nm}」后提示词跟着变`, p.includes(`你和${nm}之间的通信`) && p.includes(`${nm}寄来的信`), p.slice(-260));
}
const pBlank = await page.evaluate(() => { currentUser.name = ''; return buildBasePrompt(myCharacters[0], true, ''); });
check('名字空着时提示词里也不会出现空档', pBlank.includes('你和用户之间的通信'), pBlank.slice(-260));
await page.evaluate(() => { currentUser.name = '阿岚'; });

// ---- {{user}} 宏：作者层写的占位符，发送前才换成真名 ----
const macro = await page.evaluate(() => {
  const out = {};
  const save = currentUser.name;
  const tpl = '{{user}}走进{{char}}的书店。';
  currentUser.name = '阿岚'; out.custom = applyMacros(tpl, myCharacters[0]);
  currentUser.name = '';     out.blank  = applyMacros(tpl, myCharacters[0]);
  currentUser.name = '我';   out.def    = applyMacros(tpl, myCharacters[0]);
  currentUser.name = save;
  return out;
});
check('{{user}} 换成用户当前的名字', macro.custom === '阿岚走进沈之遥的书店。', macro.custom);
check('名字空着时 {{user}} 不会变成空字符串（主语不能没）', macro.blank === '用户走进沈之遥的书店。', macro.blank);
check('名字还是默认"我"时 {{user}} 也兜底成"用户"', macro.def === '用户走进沈之遥的书店。', macro.def);

// ============ 二、能自定义的时间，提示词里不许写死 ============

// 睡眠时段：设置里改了，提示词就得跟着改
const sleep = await page.evaluate(() => {
  const out = {};
  quietHoursEnabled = true; quietHoursStart = '01:30'; quietHoursEnd = '09:45';
  tpesEnabled = true;
  out.custom = getTpesPromptText();
  quietHoursEnabled = false;
  out.off = getTpesPromptText();
  return out;
});
check('开了休息时间段：提示词里写的是用户设的那个时段',
  sleep.custom.includes('01:30-09:45'), sleep.custom.slice(-300));
check('提示词里不再写死 22:00',
  !sleep.custom.includes('22:00') && !sleep.off.includes('22:00'), sleep.custom.slice(-300));
check('没开休息时间段：提示词不写死任何钟点，交给人设决定',
  !/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(sleep.off.split('睡眠')[1] || sleep.off)
  && sleep.off.includes('作息'), sleep.off.slice(-300));

// 回信：隔了多久回，是用户调的，提示词里必须是真实过去的时间
async function replyPromptWithLetterAge(hoursAgo) {
  await page.evaluate((h) => {
    const char = myCharacters[0];
    char.diaryData.letters = [{ id: 'lx', title: '关于那本书', content: '书我弄丢了。', date: Date.now() - h * 3600000, author: 'user' }];
    char.pendingLetterReplies = [{ id: 'px', letterId: 'lx', dueAt: Date.now() - 1000 }];
  }, hoursAgo);
  await page.evaluate(() => forceReplyNowForLetter(9001, 'lx'));
  await page.waitForTimeout(300);
  return promptText();
}
const p2h = await replyPromptWithLetterAge(2);
check('回信提示词带上了「信是多久前寄到的」', p2h.includes('前寄到你手上的'), p2h.slice(0, 400));
check('等待 2 小时 → 提示词里就是 2 小时', p2h.includes('2小时'), p2h.slice(0, 400));

const p3d = await replyPromptWithLetterAge(72);
check('等待 3 天 → 提示词里就是 3 天（不是写死的固定值）', p3d.includes('3天'), p3d.slice(0, 400));
check('明确要求别写成「刚收到就回」', p3d.includes('刚收到就立刻回'), p3d.slice(0, 400));

// 日记偷看：同一组时间设置，同样要按真实时间差
const diaryPrompt = await page.evaluate(async () => {
  globalUserDiaries.length = 0;
  const entry = { id: 'e1', title: '今天', content: '有点累。', date: Date.now() - 26 * 3600000, mode: 'peek',
    reactions: [{ charId: 9001, status: 'pending', dueAt: Date.now() - 1000 }] };
  globalUserDiaries.push(entry);
  await resolveDiaryReaction(entry, entry.reactions[0]);
  return true;
});
check('日记批注的提示词也带上了真实的时间差',
  diaryPrompt && promptText().includes('前写下的') && promptText().includes('1天'), promptText().slice(0, 400));

await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
