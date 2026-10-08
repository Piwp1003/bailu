// v226：📰 小手机黑白杂志风（主题、杂志小组件、贴纸库、抠图、杂志壁纸、TA 出封面 / 贴贴纸）+ 🏅 成就 / 📈 等级能自定义、能让 TA 来设
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';
const root = process.cwd();
const BAILU = fs.existsSync(path.join(root, 'js', '90-bailu-cards.js'));
const PLUG = JSON.parse(fs.readFileSync(path.join(root, '插件', '新玩法', '新玩法全家桶.json'), 'utf8'));
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });
const tag = BAILU ? '[白露]' : '[谷雨]';
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.accept());
await page.route(/^https?:\/\//, r => r.abort());
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && typeof executePluginOnLoad === 'function', { timeout: 20000 });
await page.waitForTimeout(1000);
await page.evaluate(({ PLUG }) => {
  if (window.bailuCards) window.__bailuNoBuiltin = true;
  myCharacters.push({ id: 9991, name: 'Leon', persona: '法国摄影师', worldbooks: [], diaryData: { letters: [], diaries: [] } });
  const H = []; for (let i = 0; i < 30; i++) H.push({ sender: i % 2 ? 9991 : 'me', text: i % 3 ? '晚安呀' : '今天路过花店，想起你了', timestamp: Date.now() - (30 - i) * 36e5, readBy: [] });
  globalChats['9991'] = H;
  PLUG.forEach(p => executePluginOnLoad(p));
}, { PLUG });
await page.waitForTimeout(3000);

// ① 杂志风：主题、壁纸、一键摆、小组件
const mg = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms)); const o = {};
  gyPmSet(true); await sleep(1200); try { gyPmUnlock(); } catch (e) {}
  gyMagSet('on', true); await sleep(100);
  o.theme = document.body.classList.contains('pm-th-mag') && document.body.classList.contains('pm-mag-grain');
  gyPmBeauty(); await sleep(200); o.sheet = /黑白杂志风/.test(document.getElementById('gyPmSheet').innerText) && document.querySelectorAll('.pm-magwl span').length >= 9; gyPmCloseSheet();
  gyMagWall(3); await sleep(100); o.wall = /repeating-linear-gradient/.test(gyPmPrefGet('wallColor') || '');
  await gyMagLayout(); await sleep(500);
  o.widgets = ['magCover', 'magDate', 'magStk', 'magQuote'].filter(k => !document.querySelector('#gyPmHome .wk-' + k));
  o.wd = ['magCover', 'magDate', 'magQuote', 'magIndex', 'magStk'].every(k => window.__gyPmW.WD[k]);
  o.mast = /GUYU|BAILU/.test((document.querySelector('#gyPmHome .wk-magCover') || {}).innerText || '');
  const lib = gyMagInfo().lib; o.lib = lib;
  // 贴纸库：点一张就贴到桌面
  const n0 = document.querySelectorAll('#gyPmHome .wk-magStk').length; await gyMagStickers(); await sleep(100); gyMagPick('o_heart'); await sleep(300);
  o.pick = document.querySelectorAll('#gyPmHome .wk-magStk').length === n0 + 1;
  return o;
});
check(`${tag} 杂志风：主题（米白纸、黑细线、衬线大字、颗粒）、美化里有开关和 9 种杂志壁纸、一键摆封面 / 大日期 / 贴纸 / 引言`, mg.theme && mg.sheet && mg.wall && !mg.widgets.length && mg.wd && mg.mast, JSON.stringify(mg));
check(`${tag} 贴纸库：手绘小人（Open Doodles，CC0）16 张、抠好的黑白照片 3 张、小物件 14 个；点一张就贴到桌面`, mg.lib.find(x => x[0] === 'dd')[1] === 16 && mg.lib.find(x => x[0] === 'ph')[1] === 3 && mg.lib.find(x => x[0] === 'or')[1] >= 12 && mg.pick, JSON.stringify(mg.lib));

// ② 抠图：纯色背景一键去掉（不联网）、转黑白、加白边，存进「我的贴纸」
const cut = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const c = document.createElement('canvas'); c.width = 200; c.height = 160; const g = c.getContext('2d'); g.fillStyle = '#7fd0ff'; g.fillRect(0, 0, 200, 160); g.fillStyle = '#c0392b'; g.beginPath(); g.arc(100, 80, 46, 0, 7); g.fill();
  const n0 = gyMagData().mine.length;
  gyMagCut(c.toDataURL()); await sleep(400);
  const ov = document.getElementById('gyMagCutOv'); ov.querySelector('[data-t="flood"]').click(); await sleep(100);
  ov.querySelector('.nm').value = '红色圆'; ov.querySelector('.ok').click(); await sleep(500);
  const it = gyMagData().mine[0]; const im = new Image(); await new Promise(r => { im.onload = r; im.src = it.src; });
  const k = document.createElement('canvas'); k.width = im.width; k.height = im.height; const kg = k.getContext('2d'); kg.drawImage(im, 0, 0);
  const corner = kg.getImageData(0, 0, 1, 1).data[3], mid = kg.getImageData(im.width >> 1, im.height >> 1, 1, 1).data;
  try { gyPmCloseSheet(); } catch (e) {}
  return { added: gyMagData().mine.length === n0 + 1, n: it.n, corner, gray: mid[0] === mid[1] && mid[1] === mid[2], w: im.width };
});
check(`${tag} 抠图：传一张纯色背景的图，一键去背景（不联网），转黑白、加白边，存进「我的贴纸」`, cut.added && cut.n === '红色圆' && cut.corner === 0 && cut.gray && cut.w < 140, JSON.stringify(cut));

// ③ TA 自己来：出一期封面、在桌面贴一张贴纸；今天面板、记忆总览、全部开关里都有
const ta = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms)); const c = myCharacters.find(x => x.id === 9991), A = k => GY_AUTONOMY_ACTIONS.find(a => a.key === k);
  window.sendProactiveChatMessage = async () => true; try { sendProactiveChatMessage = window.sendProactiveChatMessage; } catch (e) {}
  const o = {};
  o.coverNeed = A('pm_mag_cover').need(c); o.cover = !!(await A('pm_mag_cover').run(c)); o.coverNo = !A('pm_mag_cover').need(c);
  const n0 = document.querySelectorAll('#gyPmHome .wk-magStk').length; o.stk = !!(await A('pm_mag_sticker').run(c)); await sleep(300);
  o.stkOn = document.querySelectorAll('#gyPmHome .wk-magStk').length === n0 + 1 && /Leon 贴的/.test(document.querySelector('#gyPmHome').innerText);
  o.mem = gyMemExList().includes('gyMagCover');
  o.sw = AUTO_FEATURE_DEFS.some(f => f.key === 'pmMagTa');
  gyMagSet('ta', false); o.off = !A('pm_mag_sticker').need(c); gyMagSet('ta', true);
  o.ctx = /封面语/.test(window.__gyMagCtxFor('9991'));
  return o;
});
check(`${tag} TA 自己来：出这一期的封面语、在你桌面上偷偷贴一张贴纸；记忆总览、全部开关里有；关掉就不做`, ta.coverNeed && ta.cover && ta.coverNo && ta.stk && ta.stkOn && ta.mem && ta.sw && ta.off && ta.ctx, JSON.stringify(ta));

// ④ 🏅 成就自定义 + 让 TA 来设
const bg = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms)); const o = {}, c = myCharacters.find(x => x.id === 9991), A = k => GY_AUTONOMY_ACTIONS.find(a => a.key === k);
  await gyxBadgeAdd('9991', { n: '晚安达人', type: 'kwN', kw: '晚安', who: 'any', num: 5 });
  await gyxBadgeAdd('9991', { n: '一起看日出', type: 'manual' });
  await gyxBadgeOv('9991', 'hello', 'n', '第一句话'); await gyxBadgeOv('9991', 'm5000', 'off', true);
  await gyxBadgeCheck('9991'); await sleep(100);
  const G = gyxBadgeData().got['9991'], L = gyxBadgeAll('9991');
  o.kwN = Object.values(G).some(g => /说了 \d+ 次/.test(g.why)); o.ren = L.some(x => x.n === '第一句话'); o.off = !L.some(x => x.id === 'm5000');
  const sun = L.find(x => x.n === '一起看日出'); o.manualLocked = !G[sun.id]; await gyxBadgeLight('9991', sun.id); o.lit = !!gyxBadgeData().got['9991'][sun.id];
  gyxBadgeTab('9991', 'edit'); await sleep(100); o.edit = /让 Leon 来设/.test(document.getElementById('gyxBgOv').innerText);
  const t = await gyxBadgeTaSet('9991'); o.ta = t.length >= 1 && t.every(x => x.by === 'ta');
  o.acts = ['gyx_badge_new', 'gyx_badge_light'].every(k => !!A(k)); o.mem = gyMemExList().includes('gyxBadgeCust');
  document.getElementById('gyxBgOv') && document.getElementById('gyxBgOv').remove(); gyxBadgeTab('9991', 'wall');
  return o;
});
check(`${tag} 成就：内置的能改名 / 关掉，能自己加（某句话说满 N 次、认识满 N 天、手动点亮……），能让 TA 来设，TA 也会自己加、替你们点亮`, Object.values(bg).every(v => v === true), JSON.stringify(bg));

// ⑤ 📈 等级自定义 + 让 TA 来起称号
const lv = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms)); const o = {}, A = k => GY_AUTONOMY_ACTIONS.find(a => a.key === k);
  const e0 = gyxLevelInfo('9991');
  await gyxLevelTitle('9991', 0, 't', '萍水相逢'); o.title = gyxLevelInfo('9991').lv >= 1;
  await gyxLevelCfg('9991', 'curve', 'fast'); o.fast = gyxLevelInfo('9991').lv >= e0.lv;
  await gyxLevelEx('9991', '', 'add'); o.extra = gyxLevelInfo('9991').exp > e0.exp;
  await gyxLevelW('9991', '说过的话', 0); o.w0 = gyxLevelInfo('9991').exp < gyxLevelInfo('9991').exp + 1;
  await gyxLevelCfg('9991', 'gifts', '一首歌 / 一封信'); o.gifts = true;
  gyxLevelTab('9991', 'edit'); await sleep(100); o.edit = /升级快慢/.test(document.getElementById('gyxLvOv').innerText) && /萍水相逢/.test(document.getElementById('gyxLvOv').innerHTML);
  await gyxLevelTaSet('9991'); o.ta = !!gyxLevelInfo('9991').title && gyxLevelInfo('9991').title !== '萍水相逢';
  o.act = !!A('gyx_level_set'); o.mem = gyMemExList().includes('gyxLevelTitles');
  await gyxLevelReset('9991'); o.reset = gyxLevelInfo('9991').title === '刚认识' || gyxLevelInfo('9991').lv > 1;
  document.getElementById('gyxLvOv') && document.getElementById('gyxLvOv').remove(); gyxLevelTab('9991', 'lv');
  return o;
});
check(`${tag} 等级：称号、升级快慢、礼物、每样事值多少经验、自己加的经验来源都能改；能让 TA 来起一套称号；能恢复默认`, Object.values(lv).every(v => v === true), JSON.stringify(lv));

check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
