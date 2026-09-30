// v202：小手机神秘学（塔罗更多牌阵、雷诺曼、符文、易经、星座、灵摆、求签、灵数、占星骰子）、
//       新小组件（神秘学/信件/日记/匿名区/论坛/每日一问/骰子/TA 的待办）、今日运势再摇一次、
//       角色立绘差分（跟着心情换）、微信模式滚动条平时透明
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
await page.waitForFunction(() => window.__guyuBooted && window.gyMystic && window.__gyPmW && window.__gyPmW.WD.mystic, { timeout: 20000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  myCharacters.length = 0;
  myCharacters.push({ id: 9701, name: '顾言', worldbooks: [], todos: [{ text: '买花', done: false }, { text: '回邮件', done: true }],
    diaryData: { letters: [{ id: 'L1', title: '给你的第一封信', content: '见字如面。今天路过那家店，想起你。', date: Date.now() - 3600e3, author: 'char' }], diaries: [{ id: 'D1', title: '晴', content: '今天擦了一下午书架，心里很安静。', date: Date.now() - 7200e3, author: 'char' }] } });
  globalChats['9701'] = [{ sender: 9701, text: '在呢', timestamp: Date.now() - 60000 }];
  try { anonPosts.unshift({ id: 'anon_1', anonName: '夜猫子', text: '有些话只敢在这里说', timestamp: Date.now(), replies: [] }); } catch (e) {}
  try { forumThreads.unshift({ id: 'ft_1', title: '大家最近在看什么书', content: '求推荐', author: '书虫', replies: [], timestamp: Date.now() }); } catch (e) {}
});

// ---------- 易经：卦名对得上 ----------
const hx = await page.evaluate(() => {
  const D = window.__gyMysticDO; const out = [];
  for (let i = 0; i < 30; i++) { const x = D.iching(); out.push(x.ben.n >= 1 && x.ben.n <= 64 && (!x.zhi || (x.zhi.n >= 1 && x.zhi.n <= 64)) && x.lines.every(v => v >= 6 && v <= 9)); }
  return out.every(Boolean);
});
check('易经：三枚铜钱摇六次，本卦 / 之卦都落在 64 卦里', hx);
const hexNames = await page.evaluate(() => { const orig = Math.random; const out = {};
  const force = vals => { let i = 0; Math.random = () => vals[i++]; const r = window.__gyMysticDO.iching(); Math.random = orig; return r.ben.name; };
  out.qian = force(Array(18).fill(0.1));   // 每次都是「正」→ 3+3+3 = 9 老阳 → 本卦全阳
  out.kun = force(Array(18).fill(0.9));    // 每次都是「反」→ 2+2+2 = 6 老阴 → 本卦全阴
  return out; });
check('易经：六爻全阳 = 乾，全阴 = 坤', hexNames.qian === '乾' && hexNames.kun === '坤', JSON.stringify(hexNames));

// ---------- 各种占卜都能用、每次都是随机的 ----------
const dv = await page.evaluate(() => {
  const D = window.__gyMysticDO;
  const lot = new Set(Array.from({ length: 20 }, () => D.lot().poem.join())).size;
  const l9 = D.lenormand(9), r5 = D.rune(5);
  return { lot, l9: new Set(l9.cards.map(c => c[0])).size, r5: new Set(r5.runes.map(x => x.r[1])).size, life: D.life('2000-01-01').n, pend: ['是', '否', '再等等', '换个问法'].includes(D.pendulum('会下雨吗').a), astro: !!D.astro().p };
});
check('求签：20 次签诗几乎都不一样（真随机拼的）', dv.lot >= 15, JSON.stringify(dv));
check('雷诺曼九宫格 9 张不重复、符文五颗不重复', dv.l9 === 9 && dv.r5 === 5, JSON.stringify(dv));
check('生命灵数：2000-01-01 → 4；灵摆、占星骰子都有结果', dv.life === 4 && dv.pend && dv.astro, JSON.stringify(dv));

// ---------- 小手机里 ----------
await page.evaluate(() => { gyPmSet(true); gyPmUnlock(); });
await page.waitForTimeout(600);
await page.evaluate(() => { ['mystic', 'letter', 'tadiary', 'anonw', 'forumw', 'question', 'dice', 'tatodo', 'fortune'].forEach(k => gyPmAddW(k, 'm')); });
await page.waitForTimeout(500);
const ws = await page.evaluate(() => { const o = {}; ['mystic', 'letter', 'tadiary', 'anonw', 'forumw', 'question', 'dice', 'tatodo'].forEach(k => { const el = [...document.querySelectorAll('#gyPmHome [data-wid]')].find(e => e.querySelector('.gw-my,.gw-lt,.gw-dy,.gw-an,.gw-fo,.gw-q,.gw-dc,.gw-tt') && e.innerText && (k === 'mystic' ? e.querySelector('.gw-my') : k === 'letter' ? e.querySelector('.gw-lt') : k === 'tadiary' ? e.querySelector('.gw-dy') : k === 'anonw' ? e.querySelector('.gw-an') : k === 'forumw' ? e.querySelector('.gw-fo') : k === 'question' ? e.querySelector('.gw-q') : k === 'dice' ? e.querySelector('.gw-dc') : e.querySelector('.gw-tt'))); o[k] = el ? el.innerText.replace(/\s+/g, ' ').slice(0, 40) : null; }); return o; });
check('新小组件：信件显示最近收到的那封', /第一封信/.test(ws.letter || ''), JSON.stringify(ws));
check('新小组件：TA 的日记、匿名区、论坛、TA 的待办都有内容', /擦了一下午/.test(ws.tadiary || '') && /只敢在这里说/.test(ws.anonw || '') && /看什么书/.test(ws.forumw || '') && /买花/.test(ws.tatodo || ''), JSON.stringify(ws));
check('新小组件：每日一问、骰子、神秘学', ws.question && /每日一问/.test(ws.question) && ws.dice && ws.mystic, JSON.stringify(ws));
check('小组件列表里能加到这些新的', await page.evaluate(() => ['mystic', 'letter', 'tadiary', 'anonw', 'forumw', 'question', 'dice', 'tatodo'].every(k => !!window.__gyPmW.WD[k])));

// 每日一问：问 TA
const asked = await page.evaluate(() => { const el = [...document.querySelectorAll('#gyPmHome [data-wid]')].find(e => e.querySelector('.gw-q')); el.querySelector('[data-act="ask"]').click(); return globalChats['9701'].filter(m => m.sender === 'me').slice(-1)[0].text; });
check('每日一问：点「问 TA」就发到聊天里', /？/.test(asked), asked);
await page.evaluate(() => gyPmHome());
await page.waitForTimeout(300);

// 神秘学面板
await page.evaluate(() => gyMystic('lot'));
await page.evaluate(() => gyMysticDo('lot'));
const lotTxt = await page.evaluate(() => document.getElementById('gyPmSheet').innerText);
check('神秘学面板：求签出签诗、解曰，还能让 TA 解读 / 发给 TA', /签/.test(lotTxt) && /解曰/.test(lotTxt) && /让 顾言 解读/.test(lotTxt) && /发给 顾言/.test(lotTxt), lotTxt.slice(0, 200));
const tabs = await page.evaluate(() => { const out = {}; for (const k of ['lenormand', 'rune', 'iching', 'zodiac', 'astro']) { gyMysticDo(k, 3); out[k] = document.querySelector('#gyPmSheet .gm-body').innerText.replace(/\s+/g, ' ').slice(0, 400); } return out; });
check('雷诺曼 / 符文 / 易经 / 星座 / 占星骰子都能出结果', Object.values(tabs).every(t => t && t.length > 8) && /卦/.test(tabs.iching) && /综合/.test(tabs.zodiac), JSON.stringify(tabs));
await page.evaluate(() => gyMysticDo('pendulum'));
await page.waitForTimeout(1900);
check('灵摆：摆一会儿再给答案', await page.evaluate(() => ['是', '否', '再等等', '换个问法'].includes(document.querySelector('#gyPmSheet .gm-ans').innerText.trim())));
const sent = await page.evaluate(() => { gyMysticSend('9701'); return globalChats['9701'].slice(-1)[0].text; });
check('结果能发给 TA', /灵摆/.test(sent), sent);
await page.evaluate(() => gyPmCloseSheet());

// 塔罗：更多牌阵
const tr = await page.evaluate(() => { const w = [...document.querySelectorAll('#gyPmHome .wk-fortune')].pop(); const id = w.dataset.wid; gyPmTarot(id, 'cross'); const n = document.querySelectorAll('#gyPmSheet .tr-row .tr-card').length; gyPmTarot(id, 'yesno'); const yn = document.getElementById('gyPmSheet').innerText; const chips = [...document.querySelectorAll('#gyPmSheet .chip')].map(c => c.innerText).join('|'); gyPmCloseSheet(); return { n, yn: /答案：/.test(yn), chips }; });
check('塔罗：凯尔特十字 10 张、是 / 否 有答案、还有身心灵 / 关系五张 / 这个月等牌阵', tr.n === 10 && tr.yn && /凯尔特十字/.test(tr.chips) && /身心灵/.test(tr.chips) && /这个月/.test(tr.chips) && /雷诺曼/.test(tr.chips), JSON.stringify(tr));
// 今日运势：再摇一次会变
const roll = await page.evaluate(() => { const el = [...document.querySelectorAll('#gyPmHome .wk-fortune')].pop(); const id = el.dataset.wid; const a = el.innerText; const seen = new Set([a]); for (let i = 0; i < 6; i++) { gyPmFortuneRoll(id); seen.add([...document.querySelectorAll('#gyPmHome .wk-fortune')].pop().innerText); } return { n: seen.size, t: a.replace(/\s+/g, ' ').slice(0, 80) }; });
check('今日运势：多了幸运物 / 方位 / 关键词，点「↻」再摇一次会换', roll.n >= 3 && /🍀/.test(roll.t) && /「/.test(roll.t), JSON.stringify(roll));

await page.evaluate(() => { gyPmSet(false); });
await page.waitForTimeout(400);

// ---------- 🧍 立绘（插件：不在项目里，导入「插件/角色立绘差分.json」才有） ----------
check('立绘不在项目里（没装插件时没有）', await page.evaluate(() => !window.__gySpriteLoaded && !document.getElementById('gySpriteBtn')));
const fsm = await import('fs');
const plug = JSON.parse(fsm.readFileSync(path.join(root, '插件', '角色立绘差分.json'), 'utf8'));
await page.evaluate(p => { const np = Object.assign({}, p[0], { id: 'plg_test' }); plugins.push(np); executePluginOnLoad(np); }, plug);
await page.waitForFunction(() => window.__gySpriteLoaded && window.gySpriteOpen, { timeout: 5000 });
check('导入插件后立绘功能就有了', await page.evaluate(() => typeof window.gySpriteOpen === 'function'));
const png = (color) => { return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='80'><rect width='40' height='80' fill='${color}'/></svg>`)}`; };
await page.evaluate(({ a, b, c }) => {
  window.gySpriteOpen('9701');
}, { a: png('red'), b: png('blue'), c: png('green') });
await page.waitForTimeout(300);
const panel = await page.evaluate(() => document.getElementById('gySpriteBox').innerText);
check('立绘面板：每个表情一格，能上传 / 生图 / 抠底', /默认/.test(panel) && /害羞/.test(panel) && /生图/.test(panel) && /上传/.test(panel), panel.slice(0, 120));
await page.evaluate(async ({ a, b, c }) => {
  const mk = (name, src) => fetch(src).then(r => r.blob()).then(bl => new File([bl], name, { type: 'image/svg+xml' }));
  await window.gySpriteUp({ files: [await mk('normal.svg', a), await mk('生气.svg', b), await mk('sad-难过.svg', c)], value: '' }, '');
  document.getElementById('gySpriteOv').remove();
  try { switchMainView('chat'); switchChatSession('9701'); } catch (e) {}
}, { a: png('red'), b: png('blue'), c: png('green') });
await page.waitForTimeout(1600);
const sp0 = await page.evaluate(() => { const el = document.getElementById('gySprite'); return el && { shown: el.style.display !== 'none' && getComputedStyle(el).display !== 'none', face: el.dataset.face, src: el.querySelector('img:not(.old)').src.slice(0, 60), h: el.getBoundingClientRect().height }; });
check('立绘站在聊天区里（上传时按文件名自动归了表情）', sp0 && sp0.shown && sp0.h > 100 && sp0.face === '默认', JSON.stringify(sp0));
const srcOf = m => `(gySpriteData().chars['9701'].sprites.find(s => s.mood === '${m}') || {}).src`;
const face1 = await page.evaluate((js) => { runBoxResponseHooks(myCharacters[0], '9701', { replies: [{ text: '你又这样' }], face: '生气' }); gySpritePaint(); const el = document.getElementById('gySprite'); return { face: el.dataset.face, blue: el.querySelector('img:not(.old)').src === eval(js) }; }, srcOf('生气'));
check('TA 这一轮说自己「生气」：立绘换成生气那张', face1.face === '生气' && face1.blue, JSON.stringify(face1));
const face2 = await page.evaluate((js) => { runBoxResponseHooks(myCharacters[0], '9701', { replies: [{ text: '呜呜呜，你怎么才来' }] }); gySpritePaint(); const el = document.getElementById('gySprite'); return { face: el.dataset.face, green: el.querySelector('img:not(.old)').src === eval(js) }; }, srcOf('难过'));
check('没说表情就看字眼：「呜呜呜」→ 哭 → 没有哭的立绘就用难过那张', face2.face === '哭' && face2.green, JSON.stringify(face2));
const prompt = await page.evaluate(() => getBoxPrompt(myCharacters[0]));
check('有立绘的角色：提示 TA 在回复里写 face（只列 TA 有的表情）', /"face"/.test(prompt) && /生气/.test(prompt) && !/害羞/.test(prompt.split('【立绘表情】')[1] || ''), prompt.slice(-160));
const hid = await page.evaluate(() => { gySpriteToggle(); const a = getComputedStyle(document.getElementById('gySprite')).display; gySpriteToggle(); const b = getComputedStyle(document.getElementById('gySprite')).display; return [a, b]; });
check('聊天栏上的 🧍 一点就藏起来 / 再点放出来', hid[0] === 'none' && hid[1] !== 'none', JSON.stringify(hid));
const cut = await page.evaluate(async () => { const cv = document.createElement('canvas'); cv.width = 60; cv.height = 60; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 60, 60); g.fillStyle = '#c33'; g.fillRect(20, 10, 20, 40); const out = await gySpriteCutBg(cv.toDataURL()); const im = new Image(); await new Promise(r => { im.onload = r; im.src = out; }); const c2 = document.createElement('canvas'); c2.width = 60; c2.height = 60; const g2 = c2.getContext('2d'); g2.drawImage(im, 0, 0); return { corner: g2.getImageData(2, 2, 1, 1).data[3], mid: g2.getImageData(30, 30, 1, 1).data[3] }; });
check('一键抠底：白底变透明，人物还在', cut.corner === 0 && cut.mid === 255, JSON.stringify(cut));

// ---------- 微信模式滚动条 ----------
const fs = await import('fs');
const wcss = fs.readFileSync(path.join(root, 'wechat-mode.css'), 'utf8');
const sb = /body\.gywx ::-webkit-scrollbar-thumb,\s*body\.gywx\.dark-theme ::-webkit-scrollbar-thumb \{ background-color: transparent/.test(wcss) && /body\.gywx \.gy-sb-on::-webkit-scrollbar-thumb/.test(wcss);
check('微信模式：滚动条平时透明，鼠标放上去才出来', sb);

check('整个过程没有页面报错', errs.length === 0, errs.join(' | ').slice(0, 400));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
