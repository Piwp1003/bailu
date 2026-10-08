// v225：🧩 按「谷雨功能盘点」合并——合集入口（标签页里直接显示插件面板）、插件打包成组合版、旧插件自动拿掉、
//        所在地并进行程与天气、她的真实情况并进生活小档案、回顾节奏自定义、小生命更多种类 + 自定义、游戏进 🎮、7 个新的自主行动
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
await page.waitForFunction(() => window.__guyuBooted && typeof executePluginOnLoad === 'function', { timeout: 20000 });
await page.waitForTimeout(1200);
await page.evaluate(({ PLUG }) => {
  if (window.bailuCards) window.__bailuNoBuiltin = true;
  localStorage.setItem('gyTimeCfg', JSON.stringify({ custom: { on: false }, user: { place: '', tz: '' }, log: [] }));
  myCharacters.push({ id: 9991, name: 'Leon', persona: '法国摄影师', worldbooks: [], diaryData: { letters: [], diaries: [] } });
  const now = Date.now(), H = [];
  for (let i = 0; i < 40; i++) H.push({ sender: i % 2 ? 9991 : 'me', text: i % 2 ? '嗯嗯' : '好困啊今天好困', timestamp: now - (40 - i) * 3600000, readBy: [] });
  globalChats['9991'] = H;
  PLUG.forEach(p => executePluginOnLoad(p));
}, { PLUG });
await page.waitForFunction(() => typeof gyxFairOpen === 'function' && typeof gyxNotesShared === 'object', { timeout: 10000 });
await page.waitForTimeout(2500);

// ① 合集：每个标签点开，插件的面板就画在合集里，不另弹一层
const hub = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms)); const bad = [], seen = [];
  for (const F of gyHubFolders()) {
    if (!F.live) continue; seen.push(F.id);
    for (const m of F.members) {
      gyHubOpen(F.id, m); await sleep(m[0] === '@' || !/^gyx/.test(m) ? 120 : 600);
      const b = document.getElementById('gyHubBody');
      const ok = b && (b.querySelector('.gyx-inhub') || b.querySelector('.gyhb-card') || document.getElementById('gyxHugOv'));   // 抱抱是全屏的，自己一层
      if (!ok) bad.push(F.id + ':' + m);
      document.querySelectorAll('body > .gyx-ov, #gyxHugOv').forEach(e => e.remove());
    }
    gyHubClose();
  }
  // 插件自己关掉面板（比如点了「去聊天」）＝ 合集一起关
  gyHubOpen('hub_voice', 'gyxFair'); await sleep(300);
  document.getElementById('gyxFairOv').remove(); await sleep(100);
  const closed = !document.getElementById('gyHubOv');
  // 不在合集里打开就还是原来的弹窗
  gyxFairOpen(); const alone = !!document.querySelector('body > #gyxFairOv.gyx-ov'); document.getElementById('gyxFairOv').remove();
  // 小功能列表：合集出现、被合进去的不再单独出现
  switchMainView('settings'); await sleep(200);
  if (!document.getElementById('miniFeatureList')) { const d = document.createElement('div'); d.id = 'miniFeatureList'; document.body.appendChild(d); }
  renderMiniFeaturePanel(); const list = [...document.querySelectorAll('#miniFeatureList .set-entry-title')].map(b => b.textContent).join('|');
  return { seen: seen.length, bad, closed, alone, hasHub: /我们的约定/.test(list) && /早安晚安/.test(list), noKid: !/愿望清单/.test(list) && !/兑换券/.test(list) && !/^八卦网$/m.test(list.split('|').join('\n')), noGame: !/文字冒险/.test(list) };
});
check(`${tag} 合集：${hub.seen} 个合集，每个标签都直接显示在合集里；插件自己关面板合集一起关；单独打开还是原来的弹窗`, hub.seen >= 14 && !hub.bad.length && hub.closed && hub.alone, JSON.stringify(hub));
check(`${tag} 小功能列表：出现合集入口，被合进去的、八卦网、进了 🎮 的游戏都不再单独占一格`, hub.hasHub && hub.noKid && hub.noGame, JSON.stringify(hub));

// ② 插件打包：装了合并版，旧的单个插件自动拿掉（原来关着的那一项合并后也关着）；追剧进度、我们的暗号拿掉
const pr = await page.evaluate(() => {
  const keep = plugins.slice();
  plugins.length = 0;
  plugins.push({ id: 'a', name: '🛡️ 别把她写弱', type: 'script', enabled: false, onLoad: '' }, { id: 'b', name: '🗣️ TA怎么说话', type: 'script', enabled: true, onLoad: '' }, { id: 'c', name: '📺 追剧进度', type: 'script', onLoad: '' }, { id: 'd', name: '🌙 TA的梦', type: 'script', onLoad: '' }, { id: 'e', name: '💓 听心跳', type: 'script', onLoad: '' });
  const n = gyHubPrune(true); const names = plugins.map(p => p.name); const fs = JSON.parse(localStorage.getItem('gyxFeat') || '{}');
  plugins.length = 0; keep.forEach(p => plugins.push(p));
  return { n, names, fairOff: fs.gyxFair === false };
});
check(`${tag} 插件合并：装了「TA怎么说话」就拿掉旧的「别把她写弱」（关着的还关着）；追剧进度拿掉；没装合并版的「听心跳」留着`, pr.n === 2 && pr.names.join() === '🗣️ TA怎么说话,🌙 TA的梦,💓 听心跳' && pr.fairOff, JSON.stringify(pr));
await page.evaluate(() => { const f = JSON.parse(localStorage.getItem('gyxFeat') || '{}'); delete f.gyxFair; localStorage.setItem('gyxFeat', JSON.stringify(f)); });

// ③ 所在地并进行程与天气：你的城市 / 时区只存一份；老数据自动搬过去；TA 在哪在「🌏 两地」里改
const pl = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await gymapSetUserCityText('杭州'); gyTimeUser('tz', 'Asia/Tokyo'); await sleep(200);
  const u = gymapUser(); gyTimeChar('9991', 'place', '巴黎'); gyTimeChar('9991', 'tz', 'Europe/Paris');
  const ctx = window.__gyTimePlaceCtxFor('9991');
  gymapOpenTab('place'); await sleep(500); const tab = (document.getElementById('gymapBody') || {}).innerText || '';
  try { gymapClose(); } catch (e) {}
  gyTimePlaceOpen(); const pg = document.getElementById('gyTimePlaceOv').innerText; document.getElementById('gyTimePlaceOv').remove();
  return { u, ctx: /她在杭州/.test(ctx) && /你在巴黎/.test(ctx), tab: /你在哪儿/.test(tab) && /杭州/.test(tab) && /Leon/.test(tab), pg: /行程与天气/.test(pg) && /巴黎/.test(pg) && !/城市（比如 上海）/.test(pg) };
});
check(`${tag} 所在地：你的城市、时区存在行程与天气里（一份）；TA 在哪在「🌏 两地」里改；时间页只留时间模式和一个摘要`, pl.u.city === '杭州' && pl.u.tz === 'Asia/Tokyo' && pl.ctx && pl.tab && pl.pg, JSON.stringify(pl));

// ④ 她的真实情况并进生活小档案（所有 TA 共用一份）
const fa = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await gyxFairAdd('超能吃辣'); await sleep(200); document.getElementById('gyxFairOv') && document.getElementById('gyxFairOv').remove();
  const sh = gyxNotesShared.list().map(x => x.text);
  gyxNotesOpen('9991'); const pg = document.getElementById('gyxNtsOv').innerText; document.getElementById('gyxNtsOv').remove();
  const ctx = window.__gyxCtxFor('9991');
  return { sh, pg: /你的真实情况/.test(pg) && /超能吃辣/.test(pg), ctx: (ctx.match(/超能吃辣/g) || []).length };
});
check(`${tag} 她的真实情况：在「别把她写弱」里记的进了生活小档案的共用那份，TA 只看到一次`, fa.sh.includes('超能吃辣') && fa.pg && fa.ctx === 1, JSON.stringify(fa));

// ⑤ 回顾节奏：多久总结一次自己定；写歌也能定
const rc = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  gyxRecapCfgOpen(); const pg = document.getElementById('gyxRecapCfgOv').innerText; document.getElementById('gyxRecapCfgOv').remove();
  gyxRecapSet('weekly', 'v', '14'); gyxRecapSet('book', 'v', 'season'); document.getElementById('gyxRecapCfgOv') && document.getElementById('gyxRecapCfgOv').remove();
  const G = window.GYX; const r = { weekly: G.recap('weekly').v, book: G.recap('book').v, key: G.unitKey(new Date(2026, 4, 3).getTime(), 'season'), prev: G.unitPrev(new Date(2026, 3, 2).getTime(), 'month') };
  gyxSongOpen('9991'); const sg = document.getElementById('gyxSgOv').innerText; document.getElementById('gyxSgOv').remove();
  gyxRecapSet('weekly', 'v', '7'); gyxRecapSet('book', 'v', 'month'); document.getElementById('gyxRecapCfgOv') && document.getElementById('gyxRecapCfgOv').remove();
  return Object.assign(r, { pg: ['我们的书', '我们的周报', '我们的星图', 'TA 眼中的你', '回忆放映', 'TA 写给你的歌'].filter(t => !pg.includes(t)), song: /多久写一首/.test(sg) });
});
check(`${tag} 回顾节奏：周报、书、星图、观察笔记、回忆放映、写歌各自多久总结一次都能改`, rc.weekly === 14 && rc.book === 'season' && rc.key === '2026-Q2' && rc.prev === '2026-03' && !rc.pg.length && rc.song, JSON.stringify(rc));

// ⑥ 一起养小生命：11 种 + 自己定一种
const gr = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  gyxGrowOpen(); gyxGrowAdd(); const n = document.querySelectorAll('.gr-pick > div').length;
  gyxGrowKindForm(); document.getElementById('gyxGkN').value = '一只小狐狸'; document.getElementById('gyxGkE').value = '🦊'; document.getElementById('gyxGkNeed').value = '喂肉干';
  window.GYX_GROW_WHO = '9991'; await gyxGrowKindSave(); await sleep(200);
  const D = gyxGrowData(), p = D.list[D.list.length - 1];
  const txt = document.getElementById('gyxGrOv').innerText; document.getElementById('gyxGrOv').remove();
  await gyxGrowNew('dog', '9991'); document.getElementById('gyxGrOv') && document.getElementById('gyxGrOv').remove();
  return { n, kind: p && D.custom[p.kind] && D.custom[p.kind].n, txt: /喂肉干/.test(txt), dog: D.list.some(x => x.kind === 'dog') };
});
check(`${tag} 一起养小生命：花、多肉、向日葵、小树、猫、狗、兔子、仓鼠、鱼、鸟、乌龟，还能自己定一种（比如小狐狸、喂肉干）`, gr.n >= 12 && gr.kind === '一只小狐狸' && gr.txt && gr.dog, JSON.stringify(gr));

// ⑦ 7 个新的自主行动
const ac = await page.evaluate(async (BAILU) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms)); const c = myCharacters.find(x => x.id === 9991); const A = k => GY_AUTONOMY_ACTIONS.find(a => a.key === k);
  const out = {};
  let nudge = '';
  window.sendProactiveChatMessage = async ch => { nudge = (window.__gyMapCtxFor && window.__gyMapCtxFor(ch.id) || '') + (window.__gyRelCtxFor && window.__gyRelCtxFor(ch.id) || '') + (window.__gyMoodCtxFor ? window.__gyMoodCtxFor(ch.id) : ''); return true; };
  try { sendProactiveChatMessage = window.sendProactiveChatMessage; } catch (e) {}
  // 天气
  out.weather = !!A('weather_care');
  // 关系账本
  gyRel.add('9991', 5, '她替我说话', '测试'); const L = gyRel.book('9991'); L.forEach(e => { e.at = Date.now() - 2 * 864e5; });
  out.ledger = !!A('ledger_recall');
  // 皮肤
  out.skin = !!A('skin_gift');
  // 来电
  const rs = A('gyx_ring_swap'); out.ring = !!rs && rs.need(c) ? !!(await rs.run(c)) && !!gyxRingData().surprise['9991'] : !!rs;
  // 统计 / 开场（白露没有这两个模块）
  if (!BAILU) {
    const st = A('stat_tease'); out.stat = st.need(c) && !!(await st.run(c)) && /说了 \d+ 次「困」/.test(nudge) || nudge;
    const is = A('intro_swap'); out.intro = is.need(c) && !!(await is.run(c)) && !!(gyMoodData().intro.gift || JSON.parse(localStorage.getItem('gyxIntroCfg') || '{}').gift);
  } else { out.stat = out.intro = true; }
  return out;
}, BAILU);
check(`${tag} 自主行动：变天提醒、拿聊天统计逗你、提起账本里的一笔、送皮肤、偷偷换开场、偷偷换来电`, Object.values(ac).every(v => v === true), JSON.stringify(ac));

// ⑧ 信：点「收到信」的通知直接拆这封（装了拆信仪式就先看到信封）
const lt = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms)); const c = myCharacters.find(x => x.id === 9991);
  c.diaryData.letters.unshift({ id: 'd_t1', title: '给你', content: '见字如面', date: Date.now(), author: 'char' });
  gyJump({ diary: c.id, tab: 'letter', open: 'd_t1' }); await sleep(800);
  const env = !!document.getElementById('gyxLtOv'); try { gyxLetterClose(); } catch (e) {}
  return { env };
});
check(`${tag} 信：点 TA 寄信的通知直接打开那封，先看到火漆信封`, lt.env, JSON.stringify(lt));

check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
