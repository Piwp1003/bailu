// v211：白露「字词」字卡（拼一句 / 连发 / 夹在整句里，比例能调）+ 口头禅互相传染 / 我们的书 / 你还记得吗 / 我们的暗号 / 调查问卷 / 兑换券 / 提问箱
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


const NEW = [['gyxEcho', 'gyx_echo', 'gyxEchoW'], ['gyxOurBook', 'gyx_ourbook', 'gyxOurBookW'], ['gyxCode', 'gyx_code', 'gyxCodeW'], ['gyxSurvey', 'gyx_survey', 'gyxSurveyW'], ['gyxCoupon', 'gyx_coupon', 'gyxCouponW'], ['gyxAskBox', 'gyx_askbox', 'gyxAskBoxW']];
const reg = await page.evaluate(NEW => { const miss = []; const ks = gyMemExList(); NEW.forEach(([f, a, w]) => { if (!GYX.FEATS.some(x => x.id === f)) miss.push(f + ':开关'); if (!GY_AUTONOMY_ACTIONS.some(x => x.key === a)) miss.push(f + ':自主'); if (!window.__gyPmW.WD[w]) miss.push(f + ':小组件'); if (!ks.includes(f)) miss.push(f + ':记忆'); if (!GY_MINI_FEATURES.some(x => x.id === f)) miss.push(f + ':小功能'); }); const wr = NEW.map(([, , w]) => { try { return window.__gyPmW.WD[w].r({ size: 'm' }); } catch (e) { return 'ERR ' + e.message; } }).filter(h => /ERR/.test(h)); return { miss, wr }; }, NEW);
check(`${tag} 6 个新插件都登记好了：开关 / 自主行动 / 小组件 / 记忆总览 / 小功能`, !reg.miss.length && !reg.wr.length, JSON.stringify(reg));

if (BAILU) {
  const wd = await page.evaluate(async () => {
    window.__bailuNoBuiltin = false; await bailuAddBuiltin(true);
    const words = bailuCards.cards.filter(c => c.kinds.includes('字词')).length; const groups = bailuCards.groups.map(g => g.name).filter(n => /内置/.test(n)); bailuCards.cfg.builtinWV = 1; const again = await bailuAddBuiltin();
    const ch = myCharacters[0], base = ['今天有点累，但看到你消息就好多了。', '你吃饭了没？'];
    const join = bailuWordify(base, ch, 1), burst = bailuWordify(base, ch, 2), mix = bailuWordify(base, ch, 3), whole = bailuWordify(base, ch, 0);
    bailuOpen && bailuOpen(); await new Promise(r => setTimeout(r, 300)); const cfgTxt = document.body.innerText.includes('字词字卡') || (typeof bailuTab === 'function');
    return { words, groups, again, join, burst, mix, whole };
  });
  check(`${tag} 字词字卡：内置六千多个字词和颜文字（分两组），老用户升级不重复；拼成一句 / 一词一条连发 / 整句里夹字词 / 整句，四种都能出`, wd.words > 6000 && wd.groups.includes('内置颜文字') && wd.again === 0 && wd.join.length === 2 && !wd.base && wd.join.every(t => t.length <= 40) && wd.burst.length >= 2 && wd.mix.some((t, i) => t.length > [17, 6][i]) && wd.whole[1] === '你吃饭了没？', JSON.stringify(wd));
}

// 🗣️ 口头禅传染
const echo = await page.evaluate(async () => { const sid = '9991', T = Date.now(); for (let i = 0; i < 5; i++) globalChats[sid].push({ sender: 'me', text: '救命，好困呀', timestamp: T - 50000 + i * 1000 }); globalChats[sid].push({ sender: 9991, text: '救命，你怎么这么可爱', timestamp: T - 1000 }); await gyxEchoScan(sid); const G = gyxEchoData().got[sid] || []; const cx = __gyxCtxFor(9991); document.getElementById('gyxEchoOv')?.remove(); return { got: G.map(x => x.w + ':' + x.dir), cx: /口头禅/.test(cx) }; });
check(`${tag} 口头禅互相传染：数出你的口头禅，TA 第一次说的时候记下来`, echo.got.includes('救命:ta') && echo.cx, JSON.stringify(echo));

// 📖 我们的书
const book = await page.evaluate(async () => { const B = await gyxOurBookMake('9991'); const pg = document.getElementById('gyxObPage').innerText; gyxOurBookGo(1); const pg2 = document.getElementById('gyxObPage').innerText; const h = gyxOurBookHtml('9991'); document.getElementById('gyxObOv')?.remove(); return { title: B.title, ch: Object.keys(B.ch).length, pg: pg.slice(0, 30), pg2: pg2.slice(0, 10), html: /序/.test(h) && /第1章/.test(h) }; });
check(`${tag} 我们的书：按月分章，有封面、序、目录，能翻页、能导出`, book.ch >= 1 && book.title && /序/.test(book.pg2) && book.html, JSON.stringify(book));

// 🧩 你还记得吗（默契问答里的回忆题）
const mq = await page.evaluate(async () => { const q = await gyxQuizMem('9991'); const it = await gyxQuizPick(q.opts.indexOf(q.ans)); document.getElementById('gyxQzOv')?.remove(); return { kind: q.kind, ok: it.ok, logKind: gyxQuizData().log[0].kind }; });
check(`${tag} 你还记得吗：TA 从聊天总结里挑一天出回忆题，答了有反应`, mq.kind === 'mem' && mq.ok && mq.logKind === 'mem', JSON.stringify(mq));

// 🔐 暗号
const code = await page.evaluate(async () => { gyxCodeOpen('9991'); document.getElementById('gyxCdW').value = '月亮'; document.getElementById('gyxCdM').value = '我想你了'; await gyxCodeAdd('9991'); const sid = '9991'; const n0 = globalChats[sid].length; globalChats[sid].push({ sender: 'me', text: '今晚的月亮好圆', timestamp: Date.now() }); const cx = __gyxCtxFor(9991); await new Promise(r => setTimeout(r, 3500)); const said = globalChats[sid].slice(n0 + 1).filter(m => m.sender == 9991).length; const it = await gyxCodeInvent('9991'); document.getElementById('gyxCdOv')?.remove(); return { cx: /刚刚说了暗号「月亮」/.test(cx), said, used: gyxCodeData().codes['9991'].find(x => x.w === '月亮').n, inv: !!it }; });
check(`${tag} 我们的暗号：你说了暗号，TA 知道是什么意思并照约定回${BAILU ? '（白露直接回一句）' : ''}；TA 也能提议新暗号`, (BAILU || code.cx) && code.used === 1 && code.inv && (!BAILU || code.said >= 1), JSON.stringify(code));

// 📋 调查问卷
const sv = await page.evaluate(async () => { const r1 = await gyxSurveyStart('9991', 'sv_love', 'ta'); gyxSurveyStart('9991', 'sv_love', 'both'); gyxSurveyFill(['恋人', 5, ['声音'], '我', '海边', 4, '我爱你']); const r2 = await gyxSurveySubmit(); const t = document.getElementById('gyxSvOv').innerText; document.getElementById('gyxSvOv')?.remove(); return { ta: r1.ans.ta.length, me: r2.ans.me, cmp: /题想的一样/.test(t), cm: !!r2.comment }; });
check(`${tag} 调查问卷：发给 TA 填（每题都答）、一起填对比哪些想的一样、TA 写评语`, sv.ta === 7 && sv.me[0] === '恋人' && sv.me[1] === 5 && sv.cmp && sv.cm, JSON.stringify(sv));

// 🎟️ 兑换券
const cp = await page.evaluate(async () => { await gyxCouponGive('9991'); const it = gyxCouponData().list[0]; const n0 = globalChats['9991'].length; await gyxCouponUse(it.id); await new Promise(r => setTimeout(r, 1800)); const used = !!it.used, chat = globalChats['9991'].slice(n0).map(m => m.text).join('|'); document.getElementById('gyxCoupOv')?.remove(); return { name: it.name, used, chat: /我要用/.test(chat) }; });
check(`${tag} 兑换券：TA 送券，撕下来用，聊天里说「我要用」、TA 兑现`, cp.used && cp.chat && /券/.test(cp.name), JSON.stringify(cp));

// 📮 提问箱
const ab = await page.evaluate(async () => { gyxAskBoxOpen('9991'); document.getElementById('gyxAbQ').value = '你有喜欢的人吗？'; document.getElementById('gyxAbA').checked = true; await gyxAskBoxSend('9991'); await gyxAskBoxNow('9991'); const x = gyxAskBoxData().qs[0]; const t = document.getElementById('gyxAbOv').innerText; document.getElementById('gyxAbOv')?.remove(); return { a: x.a, from: x.from, t: /其实是你/.test(t) }; });
check(`${tag} 提问箱：匿名投问题，TA 公开回答`, ab.a && ab.from === 'anon' && ab.t, JSON.stringify(ab));

const acts = await page.evaluate(async () => { const out = {}; for (const a of ['gyx_echo', 'gyx_ourbook', 'gyx_code', 'gyx_code_new', 'gyx_survey', 'gyx_coupon', 'gyx_coupon_use', 'gyx_askbox', 'gyx_quiz']) { const d = GY_AUTONOMY_ACTIONS.find(x => x.key === a); try { out[a] = d.need(myCharacters[0]) ? String(await d.run(myCharacters[0])) : '不需要'; } catch (e) { out[a] = 'ERR ' + e.message; } } return out; });
check(`${tag} 新插件的自主行动跑起来不报错`, !Object.values(acts).some(v => /ERR/.test(v)), JSON.stringify(acts));

check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
