// 白露：不接 API，全靠字卡。开起来、聊天、写信、写日记、自主模式、字卡库、存档和白露分开
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.accept());
const net = [];
await page.route(/^https?:\/\//, r => { net.push(r.request().url()); r.abort(); });
await page.addInitScript(() => { window.__bailuNoBuiltin = true; });   // 这份测试从空字卡库开始（不导入内置一万条）
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && window.__bailuCardsLoaded && window.bailuCards, { timeout: 20000 });
await page.waitForTimeout(2000);

check('标题叫白露', (await page.title()) === '白露', await page.title());
check('不用填 API Key 也能用（自动挂上字卡）', await page.evaluate(() => myApiKey === 'bailu-cards'));

// 字卡：给沈之遥专属聊天字卡 + 信
await page.evaluate(async () => {
  myCharacters.length = 0;
  myCharacters.push({ id: 9401, name: '沈之遥', handle: '@shen', persona: '旧书店老板', worldbooks: [], diaryData: { letters: [], diaries: [] } });
  globalChats['9401'] = [];
  window.bailuOpen();
  document.getElementById('bailuPaste').value = '#类型:聊天 角色:沈之遥\n书店今天没什么人。\n你来了我就不关门。\n#类型:信 角色:沈之遥\n见字如面，{user}。\n店里新到了一批旧书。\n#日记\n今天擦了一下午书架。';
  await window.bailuPaste();
  const c = window.bailuCards.cfg; c.delayMin = 0; c.delayMax = 0; c.silence = 0; c.obey = 100;
});
const n = await page.evaluate(() => window.bailuCards.cards.length);
check('粘贴字卡：加进去了，示例字卡自动收起', n === 5, String(n));
check('字卡库弹窗能打开、列表有字卡', await page.evaluate(() => document.querySelectorAll('#bailuOv .bl-card').length === 5));
await page.evaluate(() => document.getElementById('bailuOv').remove());

// 聊天
await page.evaluate(() => triggerAIBatchReply('9401', '在吗'));
await page.waitForTimeout(3000);
const chat = await page.evaluate(() => (globalChats['9401'] || []).filter(m => String(m.sender) === '9401').map(m => String(m.text)));
check('聊天：TA 回了，回的都是自己的字卡', chat.length >= 1 && chat.every(t => /书店今天没什么人|你来了我就不关门/.test(t)), JSON.stringify(chat));

// 叫 TA 写日记：照做（走真的聊天流程）
await page.evaluate(() => {
  try { setAutoFeature('chatActions', true, true); } catch (e) {}
  if (window.gyChatActsResetRecent) gyChatActsResetRecent();
  window.__did = [];
  window.autonomyWriteDiary = async () => { window.__did.push('diary'); return '写了篇日记'; };
  window.__cap = null;
  const raw = window.streamCompletionText;
  window.streamCompletionText = async function (api, content, onDelta) { window.__cap = content; return raw.apply(this, arguments); };
  window.streamCompletionText.__bailu = true;
  globalChats['9401'].push({ sender: 'user', text: '去写篇日记吧', timestamp: Date.now() });
});
await page.evaluate(() => triggerAIBatchReply('9401', '去写篇日记吧'));
await page.waitForTimeout(3500);
const did = await page.evaluate(() => ({ did: window.__did, last: (globalChats['9401'] || []).slice(-3).map(m => String(m.text).slice(0, 60)) }));
check('你让 TA 写日记：TA 真的去写了日记（不是写信）', did.did.includes('diary'), JSON.stringify(did));

// 写信
const ok = await page.evaluate(async () => { const r = await generateProactiveLetter(myCharacters[0]); const L = myCharacters[0].diaryData.letters[0]; return { r: !!r, t: L ? String(L.content || '') : '' }; });
check('写信：信是用信的字卡拼的', ok.t && /见字如面|旧书/.test(ok.t), JSON.stringify(ok));

// 自主模式
const au = await page.evaluate(async () => { try { const r = await runAutonomyTurn(myCharacters[0], true); return { ok: true, n: (r && r.entries || []).length }; } catch (e) { return { ok: false, e: String(e) }; } });
check('自主模式能跑完一轮（不报错）', au.ok, JSON.stringify(au));

// 存档分开
const ls = await page.evaluate(() => { localStorage.setItem('probe', '1'); const raw = Object.keys(Object.getPrototypeOf(localStorage)).length; const own = []; for (let i = 0; i < window.localStorage.length; i++) own.push(i); return { get: localStorage.getItem('probe') }; });
const rawKeys = await page.evaluate(() => { const k = Storage.prototype.key; return null; });
const raw = await page.evaluate(() => { const out = []; const len = window.localStorage.length; return len; });
check('localStorage 读写正常', ls.get === '1');
const cdp = await ctx.newCDPSession(page);
const dom = await page.evaluate(() => location.origin);
const probe = await page.evaluate(() => { const d = Object.getOwnPropertyDescriptor(Storage.prototype, 'getItem'); return String(d.value).includes('bailu') || String(d.value).includes('P + key'); });
check('localStorage 已套上「bailu:」前缀', probe);
const dbs = await page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : []));
check('本地数据库名字都是白露自己的', dbs.length > 0 && dbs.every(n => /^bailu_/.test(n)), JSON.stringify(dbs));

// 设置里有字卡库入口
await page.evaluate(() => { try { switchMainView('settings'); } catch (e) {} });
await page.waitForTimeout(2500);
check('设置首页：字卡库入口', await page.evaluate(() => !!document.getElementById('bailuEntry')));

check('整个过程没联网请求 AI 接口', !net.some(u => /chat\/completions|\/v1\//.test(u)), net.join(' ').slice(0, 300));
check('整个过程没有页面报错', errs.length === 0, errs.join(' | ').slice(0, 400));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
