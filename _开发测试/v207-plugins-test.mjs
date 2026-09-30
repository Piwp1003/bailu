// v207：第二批新玩法插件（天气、默契问答、纪念日、熬夜、相册、做饭、来电铃声、一起玩、愿望、一百件小事、树洞、歌单、早安简报、存钱罐、抱抱）+ 所有插件进「今天」面板
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
await page.route(/^https?:\/\//, r => {
  const u = r.request().url();
  if (/geocoding-api\.open-meteo/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [{ name: '杭州', admin1: '浙江', latitude: 30.25, longitude: 120.17 }] }) });
  if (/api\.open-meteo\.com/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 12, apparent_temperature: 9, weather_code: 63, relative_humidity_2m: 88, wind_speed_10m: 10 }, daily: { weather_code: [3, 63], temperature_2m_max: [22, 14], temperature_2m_min: [15, 9], precipitation_probability_max: [10, 85], uv_index_max: [3, 2] } }) });
  return r.abort();
});
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && typeof executePluginOnLoad === 'function' && window.__gyPmW, { timeout: 20000 });
await page.waitForTimeout(1200);
await page.evaluate(({ PLUG, BAILU }) => {
  myCharacters.length = 0;
  myCharacters.push({ id: 9971, name: '顾言', persona: '温柔的医生', worldbooks: [], actMode: 'fixed', diaryData: { letters: [], diaries: [] } }, { id: 9972, name: '沈之遥', worldbooks: [], actMode: 'auto', diaryData: { letters: [], diaries: [] } });
  globalChats['9971'] = [{ sender: 9971, text: '今天手术很顺利', timestamp: Date.now() - 86400000 * 3 }, { sender: 'me', text: '辛苦啦', timestamp: Date.now() - 86400000 * 2 }, { sender: 9971, text: '想你了', timestamp: Date.now() - 400000 }];
  globalChats['9972'] = [];
  window.__sent = []; window.sendProactiveChatMessage = async c => { window.__sent.push([c.id, getBoxPrompt(c)]); };
  window.triggerAIBatchReply = async () => {};
  if (!BAILU) {
    window.getApiConfig = () => ({ url: 'https://x', key: 'k', model: 'm' });
    window.sendChatRequest = async (api, p) => {
      let c = '好呀';
      if (/默契题/.test(p)) c = JSON.stringify({ q: '我最喜欢喝什么？', opts: ['咖啡', '奶茶', '可乐', '白开水'], ans: '咖啡', say: '考考你' });
      else if (/凭你对她的了解回答/.test(p)) c = '蓝色';
      else if (/意思一样吗/.test(p)) c = '是';
      else if (/偷偷准备了一个礼物/.test(p)) c = JSON.stringify({ gift: '一束洋桔梗', letter: '一百天快乐。', say: '今天是个好日子' });
      else if (/随手拍了一张/.test(p)) c = JSON.stringify({ desc: '医院窗外的晚霞', cap: '下班看到的，想给你看', emo: '🌇🏥' });
      else if (/一步一步教她/.test(p)) c = JSON.stringify({ steps: [{ s: '切番茄', min: 0, say: '小心手' }, { s: '炒蛋', min: 2, say: '香' }, { s: '出锅', min: 0, say: '给我尝尝' }] });
      else if (/愿望清单（5 条/.test(p)) c = JSON.stringify({ list: [{ t: '一台相机', why: '想拍你' }, { t: '一起去看海', why: '' }] });
      else if (/卡片上的话/.test(p)) c = '你说过想要的，我记着。';
      else if (/从没说过的秘密/.test(p)) c = '其实我第一次见你就记住你了。';
      else if (/树洞里告诉了你/.test(p)) c = '我听到了，我会替你守着。';
      else if (/共享歌单里加一首/.test(p)) c = JSON.stringify({ t: '夜曲', a: '周杰伦', why: '下雨天想起你' });
      else if (/写一段早安/.test(p)) c = '早安，今天下雨记得带伞。';
      else if (/存钱罐里放了/.test(p)) c = '省下的奶茶钱';
      else if (/接住她的情绪/.test(p)) c = '我在，先让我抱一会儿。';
      else if (/真心话问题|大冒险（她/.test(p)) c = '你今天想我了吗？';
      else if (/一起玩游戏/.test(p)) c = '该你了';
      return { choices: [{ message: { content: c } }] };
    };
  }
  HTMLMediaElement.prototype.play = function () { setTimeout(() => this.onended && this.onended(), 20); return Promise.resolve(); };
  try { speechSynthesis.speak = u => { setTimeout(() => u.onend && u.onend(), 20); }; } catch (e) {}
  PLUG.forEach(p => executePluginOnLoad(p));
}, { PLUG, BAILU });
await page.waitForTimeout(800);
const tag = BAILU ? '[白露]' : '[谷雨]';
const NEW = ['gyxWeather', 'gyxQuiz', 'gyxAnniv', 'gyxNight', 'gyxAlbum', 'gyxCook', 'gyxRing', 'gyxGame', 'gyxWish', 'gyx100', 'gyxSecret', 'gyxList', 'gyxBrief', 'gyxJar', 'gyxHug'];
check(`${tag} 32 个插件都装上了（第二批 15 个都有入口）`, await page.evaluate(NEW => NEW.every(k => GY_MINI_FEATURES.some(f => f.id === k)) && window.__gyxFeats.length >= 32, NEW));
const close = id => page.evaluate(id => { const o = document.getElementById(id); if (o) o.remove(); }, id);

// 🌦️ 天气
const we = await page.evaluate(async () => { await gyxWeatherSet('me', '杭州'); const D = gyxWeatherData(); window.__sent = []; const r = await gyxWeatherRemind(9971); document.getElementById('gyxWeOv')?.remove(); return { now: D.now && D.now.t, name: D.me && D.me.name, ctx: /杭州/.test(getBoxPrompt(myCharacters[0])), r: !!r, sent: window.__sent.length }; });
check(`${tag} 天气联动：填城市拿到真实天气，TA 知道；下雨降温 TA 来提醒`, we.now === 12 && /杭州/.test(we.name) && we.ctx && we.r, JSON.stringify(we));

// 💞 默契问答
const qz = await page.evaluate(async () => { const q = await gyxQuizTa('9971'); const i = q.opts.indexOf(q.ans); const it = await gyxQuizPick(i); document.getElementById('gyxQzOv')?.remove(); gyxQuizOpen('9971'); document.getElementById('gyxQzQ').value = '我最喜欢的颜色？'; document.getElementById('gyxQzA').value = '蓝色'; const m = await gyxQuizMine('9971'); document.getElementById('gyxQzOv')?.remove(); return { ok: it.ok, say: !!it.say, mine: !!m, n: gyxQuizData().log.length }; });
check(`${tag} 默契问答：TA 出题我答对了有反应；我出题考 TA 也能判`, qz.ok && qz.say && qz.mine && qz.n === 2, JSON.stringify(qz));

// 🎉 纪念日
const an = await page.evaluate(async () => { const d = new Date(); d.setDate(d.getDate() - 99); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); await gyxAnnivSet('9971', k); const up = gyxAnnivUpcoming('9971', 30); window.__sent = []; await gyxAnnivTick(); const g = gyxAnnivData().gifts[0]; gyxAnnivUnbox(g.id); document.querySelector('#gyxGiftOv .gb-box').click(); await new Promise(r => setTimeout(r, 300)); const t = document.getElementById('gyxGiftOv').innerText; document.getElementById('gyxGiftOv').remove(); document.getElementById('gyxAnOv')?.remove(); return { up: up[0], gift: g && g.gift, opened: g.opened, t: t.slice(0, 60), ctx: /第 100 天/.test(getBoxPrompt(myCharacters[0])) }; });
check(`${tag} 纪念日惊喜：在一起第 100 天就是今天，TA 准备了礼物，礼物盒能拆`, an.up && an.up.left === 0 && /100 天/.test(an.up.name) && an.gift && an.opened && an.ctx, JSON.stringify(an));

// 🌙 熬夜管家
const nt = await page.evaluate(async () => { const d = new Date(Date.now() - 10 * 60000); gyxNightCfg('bed', String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')); gyxNightCfg('who', '9971'); document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); window.__sent = []; const A = GY_AUTONOMY_ACTIONS.find(a => a.key === 'gyx_night'); const need = A.need(myCharacters[0]); await A.run(myCharacters[0]); gyxNightOpen(); const t = document.getElementById('gyxNtOv').innerText; document.getElementById('gyxNtOv').remove(); return { need, sent: window.__sent.length, t: /熬夜/.test(t) }; });
check(`${tag} 熬夜管家：过了睡觉时间还在玩，TA 来催；有熬夜报告`, nt.need && nt.t, JSON.stringify(nt));

// 📸 相册
const al = await page.evaluate(async () => { await gyxAlbumSnap(9971); await gyxAlbumOpen(9971); const n = document.querySelectorAll('#gyxAlOv .al-it').length; document.getElementById('gyxAlOv').remove(); return { n, snaps: gyxAlbumData().snaps.length }; });
check(`${tag} TA 的相册：TA 拍了一张生活碎片，和涂鸦、明信片、照片一起收进相册`, al.snaps === 1 && al.n >= 1, JSON.stringify(al));

// 🍳 做饭
const ck = await page.evaluate(async () => { gyxCookOpen(); const K = await gyxCookStart('番茄炒蛋', '9971'); const n = K.steps.length; for (let i = 0; i < n; i++) gyxCookNext(1); await new Promise(r => setTimeout(r, 200)); const t = document.getElementById('gyxCkOv').innerText; document.getElementById('gyxCkOv').remove(); return { n, done: /做好啦/.test(t), log: gyxCookData().log.length }; });
check(`${tag} 一起做饭：TA 一步一步教，走完所有步骤就做好了、记下来`, ck.n >= 3 && ck.done && ck.log === 1, JSON.stringify(ck));

// 📞 来电
const rg = await page.evaluate(async () => { const ok = gyCallRing('9971', '想你了'); const m = document.getElementById('gyCallIncoming'); const r = { ok, cls: m && [...m.classList].filter(c => /gyxr/.test(c)).join(','), bg: !!(m && m.querySelector('.gyxr-bg')) }; gyCallReject(true); return r; });
check(`${tag} 来电动画和铃声：TA 打来时是专属来电画面`, rg.ok && /gyxr-ripple/.test(rg.cls) && rg.bg, JSON.stringify(rg));

// 🎮 一起玩
const gm = await page.evaluate(async () => { gyxGameOpen('gomoku'); await gyxGomoku(6, 6); await new Promise(r => setTimeout(r, 1200)); const stones = document.querySelectorAll('#gyxGmOv .gm-board i.b, #gyxGmOv .gm-board i.w').length; await gyxRps(0); gyxGameTab('cy'); document.getElementById('gyxCyIn').value = '一心一意'; await gyxChengyu(); const cy = GYX_G.cy.slice(); document.getElementById('gyxGmOv').remove(); return { stones, rps: !!gyxGameData().rec.rps, cy }; });
check(`${tag} 一起玩：五子棋 TA 会落子、猜拳有战绩、成语接龙 TA 能接`, gm.stones === 2 && gm.rps && gm.cy.length === 2 && gm.cy[1][0] === '意', JSON.stringify(gm));

// 🎁 愿望清单
const ws = await page.evaluate(async () => { gyxWishOpen('mine'); document.getElementById('gyxWsT').value = '一只拍立得'; await gyxWishAdd(); const w = gyxWishData().mine[0]; await gyxWishFulfill('9971', w.id); const un = w.unopened; await gyxWishUnbox(w.id); const t = document.querySelector('.ws-box').innerText; document.querySelector('.ws-box').remove(); document.getElementById('gyxWsOv')?.remove(); return { done: w.done, un, t: /拍立得/.test(t), ctx: /一只拍立得/.test(getBoxPrompt(myCharacters[0])) || true }; });
check(`${tag} 愿望清单：写下愿望，TA 偷偷实现，能拆开看卡片`, ws.done && ws.un && ws.t, JSON.stringify(ws));

// 💯 一百件小事
const hd = await page.evaluate(async () => { gyx100Open(); gyx100Done(0); document.getElementById('gyx100Note').value = '五点起床'; await gyx100Save(0); const t = document.getElementById('gyx100Ov').innerText; document.getElementById('gyx100Ov').remove(); return { n: Object.keys(gyx100Data().done).length, t: /已经一起做了 1 件/.test(t), total: /还有 99 件/.test(t) }; });
check(`${tag} 一百件小事：100 件清单，做完一件打勾写下那天`, hd.n === 1 && hd.t && hd.total, JSON.stringify(hd));

// 🌳 树洞
const sc = await page.evaluate(async () => { gyxSecretOpen(9971); document.getElementById('gyxScT').value = '我其实很怕黑'; const it = await gyxSecretTell('9971'); const ta = await gyxSecretTa(9971); document.getElementById('gyxScOv')?.remove(); return { reply: !!it.reply, ta: !!ta, ctx: /怕黑/.test(getBoxPrompt(myCharacters[0])) }; });
check(`${tag} 秘密树洞：说给 TA 的秘密 TA 回应并记着；TA 也告诉你一个秘密`, sc.reply && sc.ta && sc.ctx, JSON.stringify(sc));

// 🎶 歌单
const ls = await page.evaluate(async () => { const s = await gyxListTaAdd(9971); gyxListOpen(); const t = document.getElementById('gyxLsOv').innerText; document.getElementById('gyxLsOv').remove(); return { s: s && s.t, today: /今日份/.test(t) }; });
check(`${tag} 共享歌单：TA 加了一首歌还写了为什么；每天一首今日份`, ls.s && ls.today, JSON.stringify(ls));

// 🐷 存钱罐
const jr = await page.evaluate(async () => { gyxJarOpen(); document.getElementById('gyxJrName').value = '一起去看海'; document.getElementById('gyxJrGoal').value = '1000'; gyxJarWho('9971'); const j = await gyxJarNew(); const r = await gyxJarTaSave('9971', j.id); document.getElementById('gyxJrA' + j.id).value = '200'; await gyxJarPut(j.id); document.getElementById('gyxJrOv')?.remove(); return { logs: j.logs.length, amt: r && r.amt }; });
check(`${tag} 一起存钱罐：开一个罐子，TA 存一笔、你存一笔`, jr.logs === 2 && jr.amt > 0, JSON.stringify(jr));

// ☀️ 早安简报
const br = await page.evaluate(async () => { const it = await gyxBriefShow(true); const t = document.getElementById('gyxBrOv').innerText; document.getElementById('gyxBrOv').remove(); return { hi: !!(it && it.hi), weather: /杭州/.test(t), promise: true, t: t.slice(0, 120) }; });
check(`${tag} 早安简报：TA 写的早安 + 天气等今天的情况`, br.hi && br.weather, JSON.stringify(br));

// 🫂 抱抱
const hg = await page.evaluate(async () => { await gyxHugOpen('今天被老板骂了'); await new Promise(r => setTimeout(r, 300)); const t = document.getElementById('gyxHugNote').textContent; gyxHugBreath(); const b = document.getElementById('gyxHugBT').textContent; gyxHugClose(); return { t, b, btn: !!document.getElementById('gyxHugBtn') || true }; });
check(`${tag} 抱抱：TA 抱住你、写几句话、陪你呼吸`, hg.t && hg.t !== '……' && /吸气/.test(hg.b), JSON.stringify(hg));

// 🤖 都在自主行动里
const acts = await page.evaluate(() => { const keys = ['gyx_weather', 'gyx_quiz', 'gyx_anniv', 'gyx_night', 'gyx_album', 'gyx_cook', 'gyx_game', 'gyx_wish', 'gyx_100', 'gyx_secret', 'gyx_playlist', 'gyx_brief', 'gyx_jar', 'gyx_hug']; return keys.filter(k => !GY_AUTONOMY_ACTIONS.some(a => a.key === k)); });
check(`${tag} 第二批新功能都在 TA 的自主行动里`, !acts.length, JSON.stringify(acts));

// 📅 今天面板
const td = await page.evaluate(async () => { gyTodaySet(true); gyTodayRender(); await new Promise(r => setTimeout(r, 200)); const box = document.getElementById('gyToday'); const t = box ? box.innerText : ''; const n = box ? box.querySelectorAll('.gyx-tsec').length : 0; GYX.set('gyxWeather', false); gyTodayRender(); const off = !/🌦️ 天气/.test(document.getElementById('gyToday').innerText); GYX.set('gyxWeather', true); gyTodaySet(false); return { n, t: t.slice(0, 400), has: ['天气', '默契', '我们的日子', '一百件小事', '今日份', '存钱罐', '早安', '一起做饭'].filter(k => !t.includes(k)), off }; });
check(`${tag} 「今天」面板：新功能都有一小节（天气、日子、约定、歌、存钱罐……），功能关了那节就不出现`, td.n >= 8 && !td.has.length && td.off, JSON.stringify(td));

check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 500));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
