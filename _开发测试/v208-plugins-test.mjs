// v208：查重之后的第三批插件（一起旅行、吵架和好、情侣头像、追剧进度、给TA过生日、一起记账）+ 哄睡的故事选择 + 所有插件的小手机桌面小组件
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.accept());
await page.route(/^https?:\/\//, r => r.abort());
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && typeof executePluginOnLoad === 'function' && window.__gyPmW, { timeout: 20000 });
await page.waitForTimeout(1200);
await page.evaluate(({ PLUG, BAILU }) => {
  myCharacters.length = 0;
  const bd = new Date(); bd.setDate(bd.getDate() + 5);
  myCharacters.push({ id: 9981, name: '顾言', persona: '温柔的医生', birthdate: '1996-' + String(bd.getMonth() + 1).padStart(2, '0') + '-' + String(bd.getDate()).padStart(2, '0'), worldbooks: [], actMode: 'fixed', diaryData: { letters: [], diaries: [] } }, { id: 9982, name: '沈之遥', worldbooks: [], actMode: 'auto', diaryData: { letters: [], diaries: [] } });
  globalChats['9981'] = [{ sender: 9981, text: '想你了', timestamp: Date.now() - 400000 }];
  globalChats['9982'] = [];
  window.__sent = []; window.sendProactiveChatMessage = async c => { window.__sent.push([c.id, getBoxPrompt(c)]); };
  window.triggerAIBatchReply = async () => {};
  if (!BAILU) {
    window.getApiConfig = () => ({ url: 'https://x', key: 'k', model: 'm' });
    window.sendChatRequest = async (api, p) => {
      let c = '好呀';
      if (/排行程/.test(p)) c = JSON.stringify({ plan: [{ d: 1, title: '到达洱海', items: [{ t: '14:00', what: '骑车环海' }] }, { d: 2, title: '古城', items: [{ t: '10:00', what: '逛大理古城' }] }], pack: ['防晒', '身份证'], hi: '想和你在洱海边吹风' });
      else if (/冷战/.test(p)) c = /道歉信/.test(p) ? '对不起，是我太急了。以后我先听你说完。' : '别生气了好不好，我错了';
      else if (/一起追《/.test(p)) c = '这集男主终于说出口了';
      else if (/透露一点你想要的/.test(p)) c = '最近好想要一支钢笔……算了没什么';
      else if (/刚吹完蜡烛/.test(p)) c = '谢谢你，这是我过得最好的生日。';
      else if (/睡前故事/.test(p)) c = '从前有一只小熊，它住在云朵上……晚安。';
      return { choices: [{ message: { content: c } }] };
    };
  }
  HTMLMediaElement.prototype.play = function () { setTimeout(() => this.onended && this.onended(), 20); return Promise.resolve(); };
  try { speechSynthesis.speak = u => { setTimeout(() => u.onend && u.onend(), 20); }; } catch (e) {}
  PLUG.forEach(p => executePluginOnLoad(p));
}, { PLUG, BAILU });
await page.waitForTimeout(1500);
const tag = BAILU ? '[白露]' : '[谷雨]';
const NEW = ['gyxTrip', 'gyxMakeup', 'gyxAvatar', 'gyxShow', 'gyxBday', 'gyxBook'];
const ins = await page.evaluate(NEW => ({ miss: NEW.filter(k => !GY_MINI_FEATURES.some(f => f.id === k)), n: (window.__gyxFeats || []).length, dup: GY_MINI_FEATURES.filter(f => /gyxWeather|gyxList|睡前故事/.test(f.id + f.title)).map(f => f.id) }), NEW).catch(e => ({ err: e.message }));
check(`${tag} 第三批 6 个插件都装上了；重复的（天气、歌单、单独的睡前故事）没有`, ins.miss && !ins.miss.length && !ins.dup.length, JSON.stringify(ins));
const close = id => page.evaluate(id => { const o = document.getElementById(id); if (o) o.remove(); }, id);

// ✈️ 一起旅行
const tp = await page.evaluate(async () => { gyxTripOpen(); const st = new Date(); const k = X => X.getFullYear() + '-' + String(X.getMonth() + 1).padStart(2, '0') + '-' + String(X.getDate()).padStart(2, '0'); const t = await gyxTripNew({ to: '大理', start: k(st), days: 2, cid: '9981' }); const txt = document.getElementById('gyxTpOv').innerText; window.__sent = []; const A = GY_AUTONOMY_ACTIONS.find(a => a.key === 'gyx_trip'); const r = await A.run(myCharacters[0]); document.getElementById('gyxTpOv')?.remove(); return { days: t.plan.length, pack: t.pack.length, on: /旅行中/.test(txt), run: r, ctx: /大理/.test(getBoxPrompt(myCharacters[0])) }; });
check(`${tag} 一起旅行：TA 排好每天的行程和要带的东西；出发当天 TA 陪你走、知道在旅行`, tp.days === 2 && tp.pack >= 2 && tp.on && tp.run && tp.ctx, JSON.stringify(tp));

// 🌧️ 吵架和好
const mk = await page.evaluate(async () => { await gyxMakeupStart('他忘了回消息', '9981'); const ctx1 = /冷战/.test(getBoxPrompt(myCharacters[0])); const r1 = await gyxMakeupCoax('9981'); await gyxMakeupCoax('9981'); const r3 = await gyxMakeupCoax('9981'); document.getElementById('gyxMkCard').value = '我也有不对'; await gyxMakeupCard('9981'); gyxMakeupPinky('9981'); const ov = document.getElementById('gyxMkPk'); ov.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 3300)); const it = gyxMakeupData().log[0]; document.getElementById('gyxMkOv')?.remove(); return { ctx1, k1: r1 && r1.kind, k3: r3 && r3.kind, ended: !!it && it.how === '拉钩', still: !!gyxMakeupData().on['9981'], ctx2: /刚和好/.test(getBoxPrompt(myCharacters[0])) }; });
check(`${tag} 吵架和好：冷战时 TA 知道、来哄你，哄不好就写道歉信；递和好卡；长按拉钩就和好了`, mk.ctx1 && mk.k1 === 'coax' && mk.k3 === 'letter' && mk.ended && !mk.still && mk.ctx2, JSON.stringify(mk));

// 💑 情侣头像
const av = await page.evaluate(async () => { gyxAvatarCfg(false); const it = await gyxAvatarGen('9981', 'moon'); await gyxAvatarUse(it.id); const used = currentUser.avatarImg === it.me && myCharacters[0].avatarImg === it.ta; await gyxAvatarBack('9981'); const back = myCharacters[0].avatarImg !== it.ta; document.getElementById('gyxAvOv')?.remove(); return { img: /^data:image\/png/.test(it.me) && /^data:image\/png/.test(it.ta), used, back }; });
check(`${tag} 情侣头像：做一对拼在一起的头像，一键换上，也能换回原来的`, av.img && av.used && av.back, JSON.stringify(av));

// 📺 追剧进度
const sh = await page.evaluate(async () => { gyxShowOpen(); gyxShowWho('9981'); document.getElementById('gyxShN').value = '漫长的季节'; document.getElementById('gyxShT').value = '12'; const s = await gyxShowAdd(); await gyxShowTaEp(s.id); await gyxShowTaEp(s.id); document.getElementById('gyxShM' + s.id).value = '好压抑但好看'; await gyxShowEp(s.id); const ctx = getBoxPrompt(myCharacters[0]); document.getElementById('gyxShOv')?.remove(); return { me: s.me, ta: s.ta, notes: s.notes.length, spoil: /不能剧透/.test(ctx) }; });
check(`${tag} 追剧进度：你看完一集 TA 来聊（短评都记着），TA 看得比你快就不剧透`, sh.me === 1 && sh.ta === 2 && sh.notes >= 2 && sh.spoil, JSON.stringify(sh));

// 🎂 给 TA 过生日
const bd = await page.evaluate(async () => { gyxBdayOpen('9981'); const t0 = document.getElementById('gyxBdPl').innerText; await gyxBdaySet('9981', 'cake', '草莓奶油两层'); await gyxBdaySet('9981', 'gift', '一支钢笔'); const h = await gyxBdayHint('9981'); document.getElementById('gyxBdPl').remove(); gyxBdayParty('9981'); const say = await gyxBdayBlow('9981'); const out = document.getElementById('gyxBdOv').classList.contains('out'); gyxBdayClose(); return { left: /5/.test(t0), h: !!h, say: !!say, out, log: gyxBdayData().log.length }; });
check(`${tag} 给 TA 过生日：用资料里的生日倒数，准备清单，TA 会透露心愿；开派对吹蜡烛 TA 有反应`, bd.left && bd.h && bd.say && bd.out && bd.log === 1, JSON.stringify(bd));

// 🧾 一起记账
const bk = await page.evaluate(async () => { gyxBookOpen(); window.GYX_BK_TAG = '🧋 奶茶咖啡'; document.getElementById('gyxBkA').value = '18'; document.getElementById('gyxBkW').value = '生椰拿铁'; const r = await gyxBookAdd(); const d = gyxBookData(); const t = document.getElementById('gyxBkOv').innerText; document.getElementById('gyxBkOv').remove(); return { r: !!r, has: d.rows.some(e => /生椰拿铁/.test(e.why) && e.amt === -18), week: d.week.total >= 18, t: /18/.test(t), wallet: r && r.wallet }; });
check(`${tag} 一起记账：记一笔（钱包开着就记进钱包流水），有今天/本周统计`, bk.r && bk.has && bk.week && bk.t, JSON.stringify(bk));

// 🌙 哄睡：故事可以选讲法，讲过的进故事本（不另做睡前故事插件）
const sl = await page.evaluate(async () => { gyxWakeOpen(); gyxSleepKind('us'); const chips = document.querySelectorAll('#gyxWkSet .gyx-chip').length; const t = await gyxSleepStart(); gyxSleepStop(); gyxWakeOpen(); const book = /故事本/.test(document.getElementById('gyxWkSet').innerText); document.getElementById('gyxWkSet').remove(); return { t: !!t, chips, book }; });
check(`${tag} 哄睡：睡前故事能选讲法（童话/我们俩/接着讲/小日常/点题），讲过的收进故事本`, sl.t && sl.chips >= 10 && sl.book, JSON.stringify(sl));

// 🤖 自主行动
const acts = await page.evaluate(() => ['gyx_trip', 'gyx_makeup', 'gyx_avatar', 'gyx_show', 'gyx_bday_hint', 'gyx_book'].filter(k => !GY_AUTONOMY_ACTIONS.some(a => a.key === k)));
check(`${tag} 第三批都在 TA 的自主行动里`, !acts.length, JSON.stringify(acts));

// 📅 今天面板
const td = await page.evaluate(async () => { gyTodaySet(true); gyTodayRender(); await new Promise(r => setTimeout(r, 200)); const t = document.getElementById('gyToday').innerText; GYX.set('gyxBook', false); gyTodayRender(); const off = !/🧾 记账/.test(document.getElementById('gyToday').innerText); GYX.set('gyxBook', true); gyTodaySet(false); return { miss: ['旅行', '追剧', '的生日', '记账'].filter(k => !t.includes(k)), off }; });
check(`${tag} 「今天」面板：旅行、追剧、TA 的生日、记账都有；关掉就不显示`, !td.miss.length && td.off, JSON.stringify(td));

// 📱 小组件：每个插件都有，大小两种都能画，功能关了显示「关着」
const wd = await page.evaluate(() => {
  const W = window.__gyPmW.WD, keys = Object.keys(W).filter(k => /^gyx/.test(k)), bad = [];
  keys.forEach(k => ['s', 'm'].forEach(size => { if (!(W[k].sizes || []).includes(size)) return; try { const h = W[k].r({ id: 't_' + k, k, size, d: {} }); if (!h || typeof h !== 'string') bad.push(k + ':' + size + ' 空'); } catch (e) { bad.push(k + ':' + size + ' ' + e.message); } }));
  GYX.set('gyxJar', false); const offH = W.gyxJarW.r({ id: 'x', k: 'gyxJarW', size: 's', d: {} }); GYX.set('gyxJar', true);
  return { n: keys.length, keys, bad, off: /关着/.test(offH) };
});
check(`${tag} 小组件：插件都有小手机桌面小组件（${wd.n} 个），都能正常显示；功能关了显示「关着」`, wd.n >= 30 && !wd.bad.length && wd.off, JSON.stringify({ n: wd.n, bad: wd.bad, off: wd.off }));

check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 500));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
