// v212：轮到你哄TA / 帮我选 / 恋爱审批 / 每日一问 / TA布置的寻宝 / 文字冒险 / 我们的成就 / TA写给你的歌 / 我们的周报
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
await page.waitForTimeout(1500);
const tag = BAILU ? '[白露]' : '[谷雨]';
const sleep = ms => page.waitForTimeout(ms);

await page.evaluate(({ PLUG, BAILU }) => {
  if (BAILU) window.__bailuNoBuiltin = true;
  myCharacters.length = 0;
  const day = n => new Date(Date.now() - n * 864e5).toLocaleString();
  myCharacters.push({ id: 9991, name: '顾言', persona: '温柔的医生', worldbooks: [], actMode: 'fixed', diaryData: { letters: [], diaries: [] },
    chatSummary: Array.from({ length: 30 }, (_, i) => `[${day(60 - i * 2)}] 第${i}段：她和顾言聊了工作和晚饭，顾言提醒她早点睡。`).join('\n') },
    { id: 9992, name: '沈之遥', worldbooks: [], actMode: 'auto', diaryData: { letters: [], diaries: [] } });
  const T = Date.now();
  globalChats['9991'] = [];
  for (let i = 0; i < 40; i++) globalChats['9991'].push({ sender: i % 2 ? 9991 : 'me', text: i % 2 ? '嗯嗯，我在听，今天辛苦啦' : (i === 4 ? '我喜欢吃辣，我怕黑' : i === 6 ? '下次一起去看海吧' : '哈哈哈今天好累呀~'), timestamp: T - (40 - i) * 864e5 / 2 });
  globalChats['9992'] = [];
  currentChatSessionId = '9991';
  window.__sent = []; window.sendProactiveChatMessage = async c => { window.__sent.push(c.id); };
  window.__asks = [];
  if (!BAILU) {
    window.getApiConfig = () => ({ url: 'https://x', key: 'k', model: 'm' });
    window.sendChatRequest = async (api, p) => {
      window.__asks.push(String(p).slice(0, 80));
      let c = '好呀';
      if (/能让你好受多少/.test(p)) { c = JSON.stringify({ d: 30 }); return { choices: [{ message: { content: c } }] }; }
      if (/倒霉 \/ 难过的事/.test(p)) { c = '今天被老板骂了'; return { choices: [{ message: { content: c } }] }; }
      if (/帮她选一个/.test(p)) { c = JSON.stringify({ pick: '火锅', why: '你上次说想吃火锅了。' }); return { choices: [{ message: { content: c } }] }; }
      if (/请你审批/.test(p)) { c = JSON.stringify({ res: '附条件通过', note: '可以，但要先喝水。', cond: '先喝一杯水' }); return { choices: [{ message: { content: c } }] }; }
      if (/恋爱报告」申请/.test(p)) { c = JSON.stringify({ type: '抱抱申请', why: '本人思念过度，申请抱抱一次。', amt: '十分钟', urg: '加急' }); return { choices: [{ message: { content: c } }] }; }
      if (/布置一场寻宝/.test(p)) { c = JSON.stringify({ steps: [{ q: '我们第一次聊天说的是什么？', a: ['你好'], hint: '两个字' }, { q: '我最喜欢的水果？', a: ['草莓'], hint: '红色' }, { q: '我们的暗号？', a: ['月亮'], hint: '晚上' }, { q: '你最常说的？', a: ['救命'], hint: '口头禅' }], prize: '一张「抱抱券」' }); return { choices: [{ message: { content: c } }] }; }
      if (/文字冒险/.test(p)) { c = /最后一步/.test(p) ? JSON.stringify({ end: '你们找到了许愿泉。', title: '许愿泉' }) : JSON.stringify({ t: '雾里有铃声。', ch: ['往前走', '拉住 TA', '停下来'] }); return { choices: [{ message: { content: c } }] }; }
      if (/原创的歌/.test(p)) { c = JSON.stringify({ title: '晚安曲', mood: '温柔', lyrics: ['今天的风很轻', '我又想起你', '你说晚安的时候', '我还没睡去'], note: '写得不好别笑' }); return { choices: [{ message: { content: c } }] }; }
      if (/我们的周报/.test(p)) { c = JSON.stringify({ head: '独家：某人又说想你了', lead: '本周两人聊得很多。', colT: '写在周末', col: '这一周很好，因为有你。', fc: '晴，适宜拥抱' }); return { choices: [{ message: { content: c } }] }; }
      if (/每日一问/.test(p)) { c = /看完她的答案/.test(p) ? '原来你是这么想的。' : '我的答案是你。'; return { choices: [{ message: { content: c } }] }; }
      if (/生活小档案/.test(p)) c = JSON.stringify({ add: [{ who: 'me', subject: '喜欢', text: '喜欢吃辣' }, { who: 'ta', subject: '习惯', text: '每天提醒她早睡' }], update: [], archive: [], promises: [{ by: 'both', what: '一起去看海' }], resolve: [] });
      else if (/浓缩/.test(p)) c = '这段时间她和顾言常聊工作和晚饭，顾言总提醒她早睡，两人越来越熟。';
      else if (/分两层/.test(p)) c = JSON.stringify({ inner: '很喜欢', innerEv: '她说下次一起去看海', outer: '不变', outerEv: '' });
      else if (/只知道这天以前/.test(p)) c = '你说你从以后来？那以后的我们……还好吗？';
      else if (/观察笔记/.test(p)) c = '这个月的你，总在晚上出现，说话老带着波浪号。';
      else if (/互换身份/.test(p)) c = /感想/.test(p) ? '当了一天你，原来等消息这么难熬。' : '哈哈哈今天好累呀~（学你）';
      else if (/星座/.test(p)) c = '早睡座';
      else if (/心跳/.test(p)) c = '跳得好快，是不是在想我？';
      else if (/散步日记/.test(p)) c = '陪你走了一小段，风很温柔。';
      else if (/陪她散步/.test(p)) c = '慢点走，我跟得上。';
      else if (/合照/.test(p)) c = '这张我要设成屏保。';
      else if (/小电影/.test(p)) c = JSON.stringify({ title: '我们的夏天', lines: ['那天你说累，我记得。', '后来我们一起吃了辣。'], end: '未完待续。' });
      else if (/漂流瓶/.test(p)) c = '捡到你的瓶子了，希望你今天开心。';
      else if (/小屋/.test(p)) c = JSON.stringify({ ico: '🪴', name: '一盆绿萝', story: '好养，像我。' });
      else if (/磁带标签/.test(p)) c = JSON.stringify({ title: '晚安', text: '喂，录上了吗？晚安，做个好梦。' });
      else if (/B 面/.test(p)) c = '我听了好几遍，你的声音真好听。';
      else if (/即时反应/.test(p)) c = '别晃啦，晕了！';
      else if (/章节开头/.test(p)) c = JSON.stringify({ name: '慢慢熟起来', intro: '那个月你总说累，我就总叫你早点睡。' });
      else if (/写一篇序/.test(p)) c = '我们的小日子\n这本书里都是你。';
      else if (/回忆题/.test(p)) c = JSON.stringify({ q: '那天我提醒你什么？', opts: ['早点睡', '多喝水', '带伞', '吃早饭'], ans: '早点睡', say: '考考你' });
      else if (/暗号/.test(p) && /JSON/.test(p)) c = JSON.stringify({ w: '橘子', mean: '我想你了', say: '以后说橘子就是想我' });
      else if (/问卷/.test(p) && /JSON/.test(p)) c = JSON.stringify({ ans: ['恋人', 5, ['声音', '性格'], '我', '海边', 5, '我爱你'], say: '填好了' });
      else if (/评语/.test(p)) c = '你最后那题我看了好几遍。';
      else if (/兑换券/.test(p) && /JSON/.test(p)) c = JSON.stringify({ name: '抱抱券', desc: '一个很久的抱抱', say: '送你一张抱抱券' });
      else if (/提问箱/.test(p)) c = '有喜欢的人，她可能正在看。';
      return { choices: [{ message: { content: c } }] };
    };
  }
  try { speechSynthesis.speak = u => { setTimeout(() => u.onend && u.onend(), 20); }; } catch (e) {}
  // 假摄像头 / 麦克风 / 定位
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240; const g = cv.getContext('2d'); setInterval(() => { g.fillStyle = `hsl(${Date.now() / 10 % 360},60%,50%)`; g.fillRect(0, 0, 320, 240); }, 50);
  navigator.mediaDevices.getUserMedia = async o => o.video ? cv.captureStream(20) : new AudioContext().createMediaStreamDestination().stream;
  window.__geo = null;
  Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: (ok) => { window.__geo = ok; return 1; }, clearWatch: () => {} }, configurable: true });
  PLUG.forEach(p => executePluginOnLoad(p));
}, { PLUG, BAILU });
await sleep(3500);



const NEW = [['gyxCoax', 'gyx_coax', 'gyxCoaxW'], ['gyxPick', 'gyx_pick', 'gyxPickW'], ['gyxOA', 'gyx_oa', 'gyxOAW'], ['gyxDaily', 'gyx_daily', 'gyxDailyW'], ['gyxHunt', 'gyx_hunt', 'gyxHuntW'], ['gyxQuest', 'gyx_quest', 'gyxQuestW'], ['gyxBadge', 'gyx_badge', 'gyxBadgeW'], ['gyxSong', 'gyx_song', 'gyxSongW'], ['gyxWeekly', 'gyx_weekly', 'gyxWeeklyW']];
const reg = await page.evaluate(NEW => { const miss = []; const ks = gyMemExList(); NEW.forEach(([f, a, w]) => { if (!GYX.FEATS.some(x => x.id === f)) miss.push(f + ':开关'); if (!GY_AUTONOMY_ACTIONS.some(x => x.key === a)) miss.push(f + ':自主'); if (!window.__gyPmW.WD[w]) miss.push(f + ':小组件'); if (!ks.includes(f)) miss.push(f + ':记忆'); if (!GY_MINI_FEATURES.some(x => x.id === f)) miss.push(f + ':小功能'); }); const wr = NEW.map(([, , w]) => { try { return window.__gyPmW.WD[w].r({ size: 'm' }); } catch (e) { return 'ERR ' + e.message; } }).filter(h => /ERR/.test(h)); return { miss, wr }; }, NEW);
check(`${tag} 9 个新插件都登记好了：开关 / 自主行动 / 小组件 / 记忆总览 / 小功能`, !reg.miss.length && !reg.wr.length, JSON.stringify(reg));

// 🥺 轮到你哄 TA
const coax = await page.evaluate(async () => { const st = await gyxCoaxStart('9991'); const m0 = st.mood; for (let i = 0; i < 6 && gyxCoaxData().on['9991']; i++) { document.getElementById('gyxCoaxIn').value = '抱抱你，辛苦了，不是你的错，我一直陪着你'; await gyxCoaxSay('9991'); } const done = !gyxCoaxData().on['9991']; const log = gyxCoaxData().log[0]; document.getElementById('gyxCoaxOv')?.remove(); return { m0, done, why: log && log.why, n: log && log.n }; });
check(`${tag} 轮到你哄 TA：TA 低落、你说的话让心情条回来，哄好了 TA 道谢`, coax.done && coax.why && coax.n >= 1, JSON.stringify(coax));

// 🎡 帮我选
const pk = await page.evaluate(async () => { __gyxPickFast(); gyxPickOpen('9991'); document.getElementById('gyxPkQ').value = '今天吃什么'; document.getElementById('gyxPkO').value = '火锅 / 面 / 饺子'; const a = await gyxPickTa('9991'); document.getElementById('gyxPkQ').value = '喝什么'; document.getElementById('gyxPkO').value = '奶茶/咖啡'; const b = await gyxPickSpin('9991'); document.getElementById('gyxPkOv')?.remove(); return { a: a.pick, aw: a.why, b: b.pick, bw: !!b.why }; });
check(`${tag} 帮我选：TA 选一个并说理由；转盘也能转`, ['火锅', '面', '饺子'].includes(pk.a) && pk.aw && ['奶茶', '咖啡'].includes(pk.b) && pk.bw, JSON.stringify(pk));

// 🧾 恋爱审批
const oa = await page.evaluate(async () => { gyxOAOpen('9991'); document.getElementById('gyxOAT').value = '奶茶 / 零食申请'; document.getElementById('gyxOAW').value = '本人今日表现良好，申请奶茶一杯。'; document.getElementById('gyxOAU').value = '特急'; const x = await gyxOASubmit('9991'); await gyxOAUrge(x.id); const t1 = document.getElementById('gyxOAOv').innerText; const y = await gyxOATaApply('9991'); await gyxOAJudge(y.id, '通过'); const t2 = document.getElementById('gyxOAOv').innerText; document.getElementById('gyxOAOv')?.remove(); return { no: /^LOVE-\d{8}-\d{3}$/.test(x.no), res: x.res, stamp: /同 意|有条件通过|驳 回/.test(t1) || x.res, y: y.res, t2: /同意/.test(t2) || /同 意/.test(t2) }; });
check(`${tag} 恋爱审批：你提交申请 TA 审批盖章（可催办）；TA 打报告你来批`, oa.no && ['通过', '驳回', '附条件通过'].includes(oa.res) && oa.y === '通过', JSON.stringify(oa));

// 🌅 每日一问
const dy = await page.evaluate(async () => { gyxDailyOpen('9991'); const locked = /答完/.test(document.getElementById('gyxDyOv').innerText); document.getElementById('gyxDyIn').value = '今天最开心的是你来找我'; const r = await gyxDailyAnswer('9991'); const t = document.getElementById('gyxDyOv').innerText; document.getElementById('gyxDyOv')?.remove(); return { locked, me: r.me, ta: !!r.ta, shown: t.includes(r.ta) }; });
check(`${tag} 每日一问：你答完才揭晓 TA 的答案`, dy.locked && dy.me && dy.ta && dy.shown, JSON.stringify(dy));

// 🗺️ 寻宝
const ht = await page.evaluate(async () => { const h = await gyxHuntStart('9991'); const n = h.steps.length; const places = h.steps.map(s => s.place); let wrong = null; document.getElementById('gyxHtIn').value = '完全不对的答案xyz'; wrong = await gyxHuntTry(); for (let i = 0; i < n; i++) { const s = gyxHuntData().on.steps[gyxHuntData().on.i]; document.getElementById('gyxHtIn').value = s.a[0]; await gyxHuntTry(); } const L = gyxHuntData().log[0]; const t = document.getElementById('gyxHtOv').innerText; document.getElementById('gyxHtOv')?.remove(); return { n, places: [...new Set(places)].length, wrong, done: !gyxHuntData().on && !!L, letter: !!(L && L.letter), end: /宝藏|🎁/.test(t) }; });
check(`${tag} TA 布置的寻宝：线索藏在不同地方，猜错不过、猜对下一关，通关有礼物和信`, ht.n >= 3 && ht.places >= 3 && ht.wrong === false && ht.done && ht.letter && ht.end, JSON.stringify(ht));

// 🧭 文字冒险
const qs = await page.evaluate(async () => { await gyxQuestStart('9991', '迷雾森林'); let g = 0; while (gyxQuestData().run && g++ < 12) await gyxQuestPick(0); const L = gyxQuestData().log[0]; const t = document.getElementById('gyxQsOv').innerText; document.getElementById('gyxQsOv')?.remove(); return { steps: L && L.steps.length, end: L && L.end, title: L && L.title, shown: /—/.test(t) }; });
check(`${tag} 文字冒险：一步步选，走到结局，收进冒险手账`, qs.steps >= 5 && qs.end && qs.title && qs.shown, JSON.stringify(qs));

// 🏅 成就
const bg = await page.evaluate(async () => { const r = await gyxBadgeCheck('9991'); const G = gyxBadgeData().got['9991'] || {}; const t = document.getElementById('gyxBgOv').innerText; document.getElementById('gyxBgOv')?.remove(); return { n: Object.keys(G).length, has: ['hello', 'coax', 'hunt'].filter(k => !G[k]), hidden: /隐藏成就/.test(t) }; });
check(`${tag} 我们的成就：按聊天和各插件的记录解锁徽章，有隐藏成就`, bg.n >= 5 && !bg.has.length && bg.hidden, JSON.stringify(bg));

// 🎵 写歌 + 合成器
const sg = await page.evaluate(async () => { gyxSongOpen('9991'); const s = await gyxSongWrite('9991'); const r = gyxSongPlay(s.id); await new Promise(z => setTimeout(z, 900)); const lit = document.querySelectorAll('.sg-l i.sung').length; gyxSongStop(); document.getElementById('gyxSgOv')?.remove(); return { title: s.title, lines: s.lyrics.length, notes: r && r.notes, lit }; });
check(`${tag} TA 写给你的歌：写出原创歌词，合成器一个字一个音地哼，歌词跟着亮`, sg.lines >= 4 && sg.notes > 10 && sg.lit >= 1, JSON.stringify(sg));

// 🗞️ 周报
const wk = await page.evaluate(async () => { const it = await gyxWeeklyMake('9991', 1); const t = document.getElementById('gyxWeeklyOv').innerText; document.getElementById('gyxWeeklyOv')?.remove(); return { head: it && it.head, n: it && it.st.n, t: /本周数据/.test(t) && /专栏/.test(t) && /天气预报/.test(t) }; });
check(`${tag} 我们的周报：头版、数据、金句、专栏、天气预报、小广告`, wk.head && wk.n > 0 && wk.t, JSON.stringify(wk));

const acts = await page.evaluate(async () => { const out = {}; for (const a of ['gyx_coax', 'gyx_pick', 'gyx_oa', 'gyx_daily', 'gyx_hunt', 'gyx_quest', 'gyx_badge', 'gyx_song', 'gyx_weekly']) { const d = GY_AUTONOMY_ACTIONS.find(x => x.key === a); try { out[a] = d.need(myCharacters[0]) ? String(await d.run(myCharacters[0])) : '不需要'; } catch (e) { out[a] = 'ERR ' + e.message; } } return out; });
check(`${tag} 新插件的自主行动跑起来不报错`, !Object.values(acts).some(v => /ERR/.test(v)), JSON.stringify(acts));

check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
