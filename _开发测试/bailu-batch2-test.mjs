// 白露第二批：字卡分组/去重/覆盖追加/宽松 JSON、真人节奏（条数权重、已读、已读不回）、
// 聊天小动作（表情、表情包、引用、拍一拍）、信 8~12 句、格言、随机来电、心情手账、小玩法
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
await page.route(/^https?:\/\//, r => r.abort());
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && window.bailuCards && window.__bailuPlayLoaded, { timeout: 20000 });
await page.waitForTimeout(1500);

// ---- 导入别的字卡软件的整包：带分组、结尾多逗号 ----
const imp = await page.evaluate(async () => {
  myCharacters.length = 0;
  myCharacters.push({ id: 9501, name: '顾言', handle: '@gu', persona: '医生', worldbooks: [], diaryData: { letters: [], diaries: [] } });
  globalChats['9501'] = [];
  window.bailuOpen();
  const pack = `{
    "customReplies": ["在忙，等我", "好想你", "吃饭没", "早点睡", "乖", "别闹", "嗯嗯", "我在呢", "今天好累", "你真好", "想见你", "晚安",],
    "customPokes": ["的脑袋",],
    "customStatuses": ["值班中", "在路上"],
    "customMottos": ["慢慢来"],
    "customIntros": ["顾言|今天也在"],
    "customEmojis": ["🥺", "(。・ω・。)"],
    "customReplyGroups": [{"name": "甜", "color": "#f06292", "items": ["好想你", "你真好", "想见你"]}, {"name": "凶", "color": "#e57373", "items": ["别闹"]},],
  }`;
  const f = new File([pack], 'pack.json', { type: 'application/json' });
  const inp = { files: [f], value: '' };
  await window.bailuUpload(inp);
  const B = window.bailuCards;
  return { n: B.cards.length, groups: B.groups.map(g => g.name), kinds: [...new Set(B.cards.map(c => c.kinds[0]))].sort().join(','), sweet: B.cards.filter(c => c.g && (B.groups.find(g => g.id === c.g) || {}).name === '甜').length };
});
check('导入整包（结尾多逗号也能读）：字卡、拍一拍、状态、格言、开场、表情都进来了', imp.n === 19 && /拍一拍/.test(imp.kinds) && /格言/.test(imp.kinds) && /表情/.test(imp.kinds), JSON.stringify(imp));
check('分组也跟着进来，字卡归对了组', imp.groups.includes('甜') && imp.groups.includes('凶') && imp.sweet === 3, JSON.stringify(imp));
check('字卡库里能看到分组条', await page.evaluate(() => document.querySelectorAll('#bailuOv .bl-g').length === 2));

// 追加同样的：重复的跳过
const again = await page.evaluate(async () => { await window.bailuPaste.call(null); document.getElementById('bailuPaste').value = '好想你\n新的一句'; document.getElementById('bailuPasteKind').value = '聊天'; await window.bailuPaste(); return window.bailuCards.cards.length; });
check('追加：重复的跳过，只多了新的一张', again === 20, String(again));

// ---- 停用一组：TA 就不用这一组 ----
const offRes = await page.evaluate(async () => {
  const g = window.bailuCards.groups.find(x => x.name === '甜'); await window.bailuGroupToggle(g.id);
  const c = window.bailuCards.cfg; Object.assign(c, { emojiP: 0, stickerP: 0, quoteP: 0, pokeP: 0, silence: 0 });
  const tpl = '沈之遥\n请用 JSON：{"replies":[{"delay":1,"text":"..."}]}';
  let bad = 0; for (let i = 0; i < 200; i++) { const v = JSON.parse(bailuAnswer(tpl, 'at triggerAIBatchReply')); v.replies.forEach(r => { if (/好想你|你真好|想见你/.test(r.text)) bad++; }); }
  await window.bailuGroupToggle(g.id);
  return bad;
});
check('整组停用：200 次回复里一句都没用到那一组', offRes === 0, String(offRes));

// ---- 条数：大多数时候就一句 ----
const dist = await page.evaluate(() => {
  const tpl = '请用 JSON：{"replies":[{"delay":1,"text":"..."}]}'; const cnt = {};
  for (let i = 0; i < 600; i++) { const v = JSON.parse(bailuAnswer(tpl, 'at triggerAIBatchReply')); cnt[v.replies.length] = (cnt[v.replies.length] || 0) + 1; }
  return cnt;
});
check('回复条数按权重：1 条最多（约 75%），2 条次之，3 条很少', dist[1] > 380 && dist[1] < 520 && (dist[2] || 0) > 80 && (dist[3] || 0) < 30, JSON.stringify(dist));

// ---- 小动作全开 ----
const deco = await page.evaluate(() => {
  Object.assign(window.bailuCards.cfg, { emojiP: 100, stickerP: 100, quoteP: 100, pokeP: 100 });
  const tpl = '【你的表情包/图片库】：[ID: emo_a1, 内涵描述: 笑], [ID: emo_b2, 内涵描述: 哭]。\n可以在其中一条回复的text最前面加上 [QUOTE:编号]（编号对照下面列表）：\n1. 我: 今天好冷\n2. 顾言: 多穿点\n\n请用 JSON：{"replies":[{"delay":1,"text":"..."}]}';
  const v = JSON.parse(bailuAnswer(tpl, 'at triggerAIBatchReply'));
  Object.assign(window.bailuCards.cfg, { emojiP: 0, stickerP: 0, quoteP: 0, pokeP: 0 });
  const all = v.replies.map(r => r.text).join(' | ');
  return { all, nudge: currentUser.nudgeText };
});
check('话里夹了表情字卡', /🥺|ω/.test(deco.all), deco.all);
check('顺手发了张表情包（从这次给的表情包清单里挑）', /\[EMO:emo_(a1|b2)\]/.test(deco.all), deco.all);
check('引用了你说过的某一句', /^\[QUOTE:[12]\]/.test(deco.all), deco.all);
check('拍了拍你，拍的那句话用的是拍一拍字卡', /\[NUDGE\]/.test(deco.all) && deco.nudge === '的脑袋', JSON.stringify(deco));

// ---- 已读不回 ----
const sil = await page.evaluate(() => { window.bailuCards.cfg.silence = 100; const v = JSON.parse(bailuAnswer('如果决定不回复，请直接返回 {"replies": []}。\n{"replies":[{"delay":1,"text":"..."}]}', 'at triggerAIBatchReply')); window.bailuCards.cfg.silence = 0; return v.replies.length; });
check('已读不回：概率拉满时就真的不回', sil === 0, String(sil));

// ---- 信：8~12 句，字卡不够就用 TA 平时的话补 ----
const letter = await page.evaluate(() => { const t = bailuAnswer('给用户写一封信', 'at generateProactiveLetter'); return t.split(/\n\n/).length; });
check('信写得够长（字卡不够时拿平时的话补）', letter >= 8, String(letter));

// ---- 先已读，再回 ----
await page.evaluate(() => { Object.assign(window.bailuCards.cfg, { readMin: 0.3, readMax: 0.3, delayMin: 1.5, delayMax: 1.5 }); globalChats['9501'].push({ sender: 'me', text: '在吗', timestamp: Date.now(), readBy: [] }); window.__rp = triggerAIBatchReply('9501', '在吗'); });
await page.waitForTimeout(900);
const mid = await page.evaluate(() => { const arr = globalChats['9501']; const me = arr.filter(m => m.sender === 'me').pop(); return { read: (me.readBy || []).includes(9501), replied: arr.some(m => String(m.sender) === '9501') }; });
check('你发完先「已读」，TA 想一会儿才回', mid.read && !mid.replied, JSON.stringify(mid));
await page.waitForFunction(() => globalChats['9501'].some(m => String(m.sender) === '9501'), { timeout: 8000 }).catch(() => {});
check('然后 TA 回了', await page.evaluate(() => globalChats['9501'].some(m => String(m.sender) === '9501')), await page.evaluate(() => JSON.stringify(globalChats['9501'].slice(-3))));

// ---- 聊天顶上的格言 ----
await page.evaluate(() => { document.getElementById('bailuOv') && document.getElementById('bailuOv').remove(); try { switchMainView('chat'); } catch (e) {} try { openChatSession ? openChatSession('9501') : null; } catch (e) {} });
await page.evaluate(() => { try { currentChatSessionId = '9501'; } catch (e) {} const i = document.getElementById('chatInputArea'); if (i) i.style.display = 'flex'; });
await page.waitForTimeout(2300);
check('聊天顶上有一句格言（格言字卡）', await page.evaluate(() => { const m = document.getElementById('bailuMotto'); return m && m.style.display !== 'none' && /慢慢来/.test(m.textContent); }));

// ---- 随机来电 ----
const call = await page.evaluate(() => { let got = null; const r0 = window.gyCallRing; window.gyCallRing = (c, why) => { got = { name: c.name, why }; return true; }; window.bailuCards.cfg.callP = 100; window.bailuTestCall(); window.gyCallRing = r0; window.bailuCards.cfg.callP = 25; return got; });
check('随机来电：掷中了就打过来', call && call.name === '顾言', JSON.stringify(call));

// ---- 心情手账 ----
const mood = await page.evaluate(async () => { window.bailuCards.cfg.moodSkip = 0; await window.bailuMoodTa(); await window.bailuPlay('mood'); const d = new Date(); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); bailuMoodDay(k); bailuMoodSet(k, '开心'); document.getElementById('bailuMoodNote').value = '今天不错'; await bailuMoodSave(k); return { cal: document.querySelectorAll('#bailuPlayOv .bp-day').length, today: document.querySelector('#bailuPlayOv .bp-day.today').innerText }; });
check('心情手账：月历、TA 今天自己记了一笔、我记了开心', mood.cal >= 28 && /😊/.test(mood.today), JSON.stringify(mood));

// ---- 小玩法：每个都能打开 ----
const tabs = await page.evaluate(async () => { const out = {}; for (const t of ['tarot', 'leno', 'lot', 'coin', 'stat']) { await window.bailuPlay(t); out[t] = document.getElementById('bailuPlayBody').innerText.slice(0, 40); } return out; });
check('今日三牌 / 雷诺曼 / 抽签 / 抛硬币 / 统计都能打开', Object.values(tabs).every(Boolean) && /过去/.test(tabs.tarot) && /条消息/.test(tabs.stat), JSON.stringify(tabs));
await page.evaluate(async () => { await window.bailuPlay('lot'); document.getElementById('bailuLotTa').value = '火锅\n烧烤'; bailuLot(); });
await page.waitForTimeout(4500);
const lot = await page.evaluate(() => document.getElementById('bailuLotR').textContent);
check('抽签：抽出一个结果', /火锅|烧烤/.test(lot), lot);
const sent = await page.evaluate(() => { const n0 = globalChats['9501'].length; bailuPlayWho('9501'); bailuPlaySend(); return globalChats['9501'].slice(n0).map(m => m.text); });
check('结果能发到聊天里', sent.some(t => /抽签抽到了/.test(t)), JSON.stringify(sent));
check('设置里有「小玩法」入口、聊天工具栏有 🎲', await page.evaluate(() => !!document.getElementById('bailuPlayEntry') && !!document.getElementById('bailuPlayBtn')));

// ---- 🤖 自主行动：按权重随机决定 ----
const pw = await page.evaluate(() => {
  const c = window.bailuCards.cfg; c.actW = { post: 0, chat: 0, letter: 0, forum: 0, anon: 0, diary: 5 }; c.activity = 100;
  const tpl = '【你能做的事】\n- post：发推\n- diary：写日记\n- letter：写信\n- nothing：什么都不做\n{"plan":[{"action":"上表里的 key","after":0,"reason":"一句话","param":"看情况填"}],"nextIn":分钟数}';
  const got = {}; for (let i = 0; i < 60; i++) { const v = JSON.parse(bailuAnswer(tpl, 'at runAutonomyTurn')); v.plan.forEach(x => { got[x.action] = (got[x.action] || 0) + 1; }); }
  return got;
});
check('自主行动：按权重掷骰子（只给写日记权重，就只写日记）', Object.keys(pw).length === 1 && pw.diary > 0, JSON.stringify(pw));
const auto = await page.evaluate(async () => {
  window.bailuAuto(); const box = document.getElementById('bailuAutoBody').innerText;
  window.bailuAutoChar('9501', true);
  const ch = myCharacters[0]; ch.autonomyLog = []; ch.diaryData.diaries = []; window.bailuCards.cfg.activity = 100; const n0 = (ch.diaryData.diaries || []).length;
  window.bailuCards.cfg.actW = Object.fromEntries(GY_AUTONOMY_ACTIONS.map(a => [a.key, a.key === 'diary' ? 1 : 0]));
  window.bailuCards.cfg.delayMin = 0; window.bailuCards.cfg.delayMax = 0;
  await window.bailuAutoNow('9501');
  return { panel: /总开关/.test(box) && /每件事的权重/.test(box), mode: ch.actMode, diaries: (ch.diaryData.diaries || []).length - n0, res: document.getElementById('bailuAutoRes').textContent };
});
check('🤖 自主行动面板：总开关、谁自己决定、权重都在', auto.panel && auto.mode === 'auto', JSON.stringify(auto));
check('「现在动一下」：TA 按骰子真的去做了（写了日记）', auto.diaries >= 1, JSON.stringify(auto));
await page.evaluate(() => { document.getElementById('bailuAutoOv').remove(); window.bailuCards.cfg.actW = {}; });

// ---- 去重 / 覆盖 ----
const dd = await page.evaluate(async () => { window.bailuCards.cards.push({ id: 'x1', t: ' 好想你 ', kinds: ['聊天'], chars: [] }); window.bailuOpen(); await window.bailuDedup(); return window.bailuCards.cards.filter(c => c.t.trim() === '好想你').length; });
check('一键去重（前后空格不同也算重复）', dd === 1, String(dd));
const rp = await page.evaluate(async () => { window.appConfirm = async () => true; window.bailuImp('mode', 'replace'); document.getElementById('bailuPaste').value = '只剩这一句'; await window.bailuPaste(); window.bailuImp('mode', 'add'); return window.bailuCards.cards.map(c => c.t); });
check('覆盖：整个库换成这一批', rp.length === 1 && rp[0] === '只剩这一句', JSON.stringify(rp));

check('整个过程没有页面报错', errs.length === 0, errs.join(' | ').slice(0, 400));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
