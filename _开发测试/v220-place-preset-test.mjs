// v220：🌏 时间与所在地（自定义时间 / 异地时区）+ 从预设里搬来的三样：🫂 相处模式 · 🧂 风格调料 · 🛡️ 别把她写弱
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
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.dismiss());
await page.route(/^https?:\/\//, r => r.abort());
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && typeof executePluginOnLoad === 'function' && window.gyTimePlaceOpen, { timeout: 20000 });
await page.waitForTimeout(1200);
await page.evaluate(({ PLUG }) => {
  if (window.bailuCards) window.__bailuNoBuiltin = true;
  myCharacters.push({ id: 9991, name: '顾言', persona: '温柔的医生', worldbooks: [], diaryData: { letters: [], diaries: [] } }, { id: 9992, name: '沈之遥', persona: '摄影师', worldbooks: [], diaryData: { letters: [], diaries: [] } });
  globalChats['9991'] = [{ sender: 'me', text: '在吗', timestamp: Date.now() - 60000, readBy: [] }, { sender: 9991, text: '在', timestamp: Date.now(), readBy: [] }];
  currentChatSessionId = '9991';
  PLUG.forEach(p => executePluginOnLoad(p));
}, { PLUG });
await page.waitForFunction(() => typeof gyxBondOpen === 'function' && typeof gyxSpiceOpen === 'function' && typeof gyxFairOpen === 'function', { timeout: 10000 });
await page.waitForTimeout(1500);

// ===== 🌏 时间与所在地 =====
const tp = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const c = myCharacters.find(x => x.id === 9991);
  const out = {};
  gyTimeUser('place', '上海'); gyTimeUser('tz', 'Asia/Shanghai');
  gyTimeChar('9991', 'place', '东京'); gyTimeChar('9991', 'tz', 'Asia/Tokyo');
  const ctx = window.__gyTimePlaceCtxFor('9991');
  out.far = /你在东京/.test(ctx) && /她在上海/.test(ctx) && /异地/.test(ctx) && /点多/.test(ctx);
  // 自定义时间：1998-07-15 21:30 开始
  gyTimeSetMode('custom'); gyTimeSetCustom('1998-07-15T21:30');
  out.mode = gyTimeMode();
  const n = gyTimeNow(); out.now = n.getFullYear() + '-' + (n.getMonth() + 1) + '-' + n.getDate() + ' ' + n.getHours();
  const real = new Date(), rs = real.getFullYear() + '-' + String(real.getMonth() + 1).padStart(2, '0') + '-' + String(real.getDate()).padStart(2, '0') + ' ' + String(real.getHours()).padStart(2, '0') + ':' + String(real.getMinutes()).padStart(2, '0');
  const sent = gyTaRewrite(`【当前真实时间】：${rs}（星期一）。生于1995年3月2日。`);
  out.sent = sent;
  out.shift = /1998-07-15 21:3\d/.test(sent) && /星期三/.test(sent) && /1995年3月2日/.test(sent) && !sent.includes(String(real.getFullYear()));
  const ctx2 = window.__gyTimePlaceCtxFor('9991');
  out.ctx2 = /1998-07-1[56]/.test(ctx2) && /剧情里定的时间/.test(ctx2);
  out.ctxKept = /1998-07-1[56]/.test(gyTaRewrite(ctx2)) && !/[\u2066\u2069]/.test(gyTaRewrite(ctx2));
  gyTimeFreeze(true); const a = gyTimeNow().getTime(); await sleep(1100); out.frozen = gyTimeNow().getTime() === a;
  gyTimeFreeze(false);
  // 页面 / 小功能 / 小组件 / 今天 / 记忆总览 / 自主行动
  const ov = document.getElementById('gyTimePlaceOv'); out.page = !!ov && /自定义时间/.test(ov.innerText) && /东京/.test(ov.innerHTML); if (ov) ov.remove();
  out.mini = (typeof GY_MINI_FEATURES !== 'undefined') && GY_MINI_FEATURES.some(f => f.id === 'timePlace');
  out.act = GY_AUTONOMY_ACTIONS.some(a => a.key === 'time_far_hello' && a.need(c));
  out.widget = !!(window.__gyPmW && window.__gyPmW.WD && window.__gyPmW.WD.gyTimePlaceW) && /东京|你/.test(window.__gyPmW.WD.gyTimePlaceW.r({ size: 'm' }));
  // 不感知：只说在哪，不说几点
  gyTimeSetMode('off'); const ctx3 = window.__gyTimePlaceCtxFor('9991'); out.offCtx = /东京/.test(ctx3) && !/点多/.test(ctx3);
  gyTimeSetMode('real'); out.back = gyTimeMode() === 'real';
  document.querySelectorAll('#gyTimePlaceOv').forEach(x => x.remove());
  return out;
});
check(`${tag} 所在地：你在上海、TA 在东京（时区不同）→ TA 知道两边各几点、知道你们异地`, tp.far, JSON.stringify(tp));
check(`${tag} 自定义时间：从 1998-07-15 21:30 开始往后走；发出去的「现在」换成那一天、星期跟着变；一年以前的日期（生日）不动`, tp.mode === 'custom' && /^1998-7-15 21/.test(tp.now) && tp.shift, JSON.stringify(tp));
check(`${tag} 自定义时间下 TA 那边的时间也按剧情时间算，而且不会被换算两次；「停在这一刻」真的不走`, tp.ctx2 && tp.ctxKept && tp.frozen, JSON.stringify(tp));
check(`${tag} 时间与所在地：页面、小功能入口、自主行动（异地的 TA 说说自己那边）、两地时间小组件`, tp.page && tp.mini && tp.act && tp.widget, JSON.stringify(tp));
check(`${tag} 不感知时间时只说在哪不说几点；切回真实时间`, tp.offCtx && tp.back, JSON.stringify(tp));

// ===== 三个插件 =====
const pl = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const out = {};
  await gyxBondSet('9991', 'rivals'); await sleep(100);
  out.bondCtx = /欢喜冤家/.test(window.__gyxCtxFor('9991')) && /别用伤害冒充暧昧/.test(window.__gyxCtxFor('9991'));
  out.bondOther = !/欢喜冤家/.test(window.__gyxCtxFor('9992'));
  await gyxBondSet('9991', 'custom'); await gyxBondCustom('9991', '表面是上司下属，私下他什么都听她的'); out.bondCustom = /什么都听她的/.test(window.__gyxCtxFor('9991'));
  await gyxSpiceToggle('g', 'humor', true); await gyxSpiceToggle('g', 'life', true);
  out.spiceG = /幽默风趣/.test(window.__gyxCtxFor('9992')) && /生活切片/.test(window.__gyxCtxFor('9992'));
  await gyxSpiceOwn('9991', true); await gyxSpiceToggle('9991', 'humor', false); await gyxSpiceToggle('9991', 'net', true); await gyxSpiceNote('9991', '生气时只回一个字');
  const s1 = window.__gyxCtxFor('9991'); out.spiceOwn = !/幽默风趣/.test(s1) && /网络流行语/.test(s1) && /只回一个字/.test(s1);
  await gyxFairAdd('做饭很好吃'); await gyxFairToggle('noPronoun', false);
  const f = window.__gyxCtxFor('9991'); out.fair = /不矮化|单向的戏/.test(f) && /做饭很好吃/.test(f) && !/某人/.test(f.split('【守则')[1] || '');
  out.acts = ['gyx_bond', 'gyx_spice', 'gyx_fair_praise'].every(k => GY_AUTONOMY_ACTIONS.some(a => a.key === k));
  const W = window.__gyPmW && window.__gyPmW.WD; out.widgets = !!W && ['gyxBondW', 'gyxSpiceW', 'gyxFairW'].every(k => W[k]);
  out.mini = ['gyxBond', 'gyxSpice', 'gyxFair'].every(id => GY_MINI_FEATURES.some(x => x.id === id));
  out.today = /相处模式/.test(GYX.todayHtml ? GYX.todayHtml() : (window.GYX && window.GYX.todayHtml()) || '');
  // 页面能打开
  gyxBondOpen('9991'); out.bondPage = /欢喜冤家/.test(document.getElementById('gyxBondOv').innerText); document.getElementById('gyxBondOv').remove();
  gyxSpiceOpen('9991'); out.spicePage = /烟火气/.test(document.getElementById('gyxSpiceOv').innerText); document.getElementById('gyxSpiceOv').remove();
  gyxFairOpen(); out.fairPage = /做饭很好吃/.test(document.getElementById('gyxFairOv').innerText); document.getElementById('gyxFairOv').remove();
  return out;
});
check(`${tag} 相处模式：给顾言选「欢喜冤家」→ 只有顾言收到这段（侧重 + 禁忌）；自己写的也能用`, pl.bondCtx && pl.bondOther && pl.bondCustom, JSON.stringify(pl));
check(`${tag} 风格调料：全局勾的所有 TA 都有；单个 TA 用自己的一套 + 自己加的一句`, pl.spiceG && pl.spiceOwn, JSON.stringify(pl));
check(`${tag} 别把她写弱：守则 + 她的真实情况进 prompt；关掉的那条不发`, pl.fair, JSON.stringify(pl));
check(`${tag} 三个插件都有：自主行动、小组件、小功能入口、今天、页面`, pl.acts && pl.widgets && pl.mini && pl.today && pl.bondPage && pl.spicePage && pl.fairPage, JSON.stringify(pl));
check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
