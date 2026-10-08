// v214：备份补全（插件和小盒子数据一起备份）+ 未来的TA / 表情包工坊 / 我们的等级 / TA是你的私教 / 随机掉落收藏册 / 睡前三件好事 / 省电模式
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
      if (/年以后/.test(p)) { return { choices: [{ message: { content: '你来啦，五年后的我们还是很好。' } }] }; }
      if (/做一张表情包/.test(p)) { return { choices: [{ message: { content: '想你了' } }] }; }
      if (/当私教陪她/.test(p)) { return { choices: [{ message: { content: JSON.stringify({ start: '开始啦', steps: ['第一个', '第二个', '第三个', '第四个', '第五个'], end: '练完啦' }) } }] }; }
      if (/三件好事/.test(p) && /JSON/.test(p)) { return { choices: [{ message: { content: JSON.stringify({ three: ['你回我消息', '吃了火锅', '晚风很舒服'], tomorrow: '早上第一个说早安' }) } }] }; }
      if (/交换了今天的好事/.test(p)) { return { choices: [{ message: { content: '晚安，明天见。' } }] }; }
      if (/附在上面的小纸条/.test(p)) { return { choices: [{ message: { content: '给你的。' } }] }; }
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




const NEW = [['gyxMeme', 'gyx_meme', 'gyxMemeW'], ['gyxLevel', 'gyx_level', 'gyxLevelW'], ['gyxCoach', 'gyx_coach', 'gyxCoachW'], ['gyxDrop', 'gyx_drop', 'gyxDropW'], ['gyxGood', 'gyx_good', 'gyxGoodW'], ['gyxSaver', 'gyx_saver', 'gyxSaverW']];
const reg = await page.evaluate(NEW => { const miss = []; const ks = gyMemExList(); NEW.forEach(([f, a, w]) => { if (!GYX.FEATS.some(x => x.id === f)) miss.push(f + ':开关'); if (!GY_AUTONOMY_ACTIONS.some(x => x.key === a)) miss.push(f + ':自主'); if (!window.__gyPmW.WD[w]) miss.push(f + ':小组件'); if (!ks.includes(f)) miss.push(f + ':记忆'); if (!GY_MINI_FEATURES.some(x => x.id === f)) miss.push(f + ':小功能'); }); const wr = NEW.map(([, , w]) => { try { return window.__gyPmW.WD[w].r({ size: 'm' }); } catch (e) { return 'ERR ' + e.message; } }).filter(h => /ERR/.test(h)); return { miss, wr }; }, NEW);
check(`${tag} 6 个新插件都登记好了：开关 / 自主行动 / 小组件 / 记忆总览 / 小功能`, !reg.miss.length && !reg.wr.length, JSON.stringify(reg));

// 💾 备份补全
const bk = await page.evaluate(async () => {
  await gyxStarOpen('9991'); document.getElementById('gyxStarIn').value = '备份测试的星星'; await gyxStarAdd('9991'); document.getElementById('gyxStarOv')?.remove();
  const ex = await gyBackupExtraCollect(); const dbs = Object.keys(ex.idb);
  let saved = null; window.saveTextFileForApp = (n, t) => { saved = t; };
  await exportData(); const j = JSON.parse(saved || '{}');
  const lf = localforage.createInstance({ name: 'gyx_star', storeName: 'kv' }); await lf.removeItem('d'); const gone = !(await lf.getItem('d'));
  window.appConfirm = async () => false;
  const f = new File([saved], 'b.json'); importData({ target: { files: [f] } });
  await new Promise(r => setTimeout(r, 2500));
  const back = await lf.getItem('d'); const main = await localforage.getItem('myTwitterAppData');
  return { dbs: dbs.filter(n => /^gyx_/.test(n)).length, hasStar: dbs.includes('gyx_star'), inExport: !!(j.__gyExtra && j.__gyExtra.idb && j.__gyExtra.idb.gyx_star), gone, back: !!(back && back.extra && back.extra.some(x => x.text === '备份测试的星星')), clean: !main.__gyExtra, btn: !!document.getElementById('gyExtraRow') || !document.getElementById('setPanel-data') };
});
check(`${tag} 备份补全：导出备份带上了插件和小盒子的数据，导入时写回去，主存档里不留这一大块`, bk.dbs >= 1 && bk.hasStar && bk.inExport && bk.gone && bk.back && bk.clean, JSON.stringify(bk));

// 🔮 未来的 TA
const fu = await page.evaluate(async () => { await gyxTimeGo('9991', Date.now() + 5 * 365 * 864e5); document.getElementById('gyxTmIn').value = '五年后的你好吗'; await gyxTimeSend(); const ov = document.getElementById('gyxTmOv'); const r = { fu: ov.classList.contains('fu'), t: ov.innerText.includes('年后') }; ov.remove(); return r; });
check(`${tag} 时光机加了「未来的 TA」：去见几年后的 TA 聊天`, fu.fu && fu.t, JSON.stringify(fu));

// 🎨 表情包工坊
const mm = await page.evaluate(async () => { const c = myCharacters[0]; c.avatarImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; gyxMemeOpen('9991'); await new Promise(r => setTimeout(r, 300)); gyxMemeSet('bottom', '想你了'); const n0 = globalEmoticons.length, m0 = globalChats['9991'].length; const it = await gyxMemeSave('9991', 1); const ta = await gyxMemeTa('9991'); document.getElementById('gyxMmOv')?.remove(); return { png: /^data:image\/png/.test(it.src), emo: globalEmoticons.length - n0, sent: globalChats['9991'].slice(m0).filter(m => m.mediaUrl).length, ta: ta.by === 'ta' && !!ta.text }; });
check(`${tag} 表情包工坊：配字做表情包，存进表情包库、能直接发；TA 也会做来斗图`, mm.png && mm.emo === 2 && mm.sent === 2 && mm.ta, JSON.stringify(mm));

// 🏃 私教（加速版）
const co = await page.evaluate(async () => { await gyxCoachGo('9991', '眼睛休息', 1); await new Promise(r => setTimeout(r, 1500)); const x = gyxCoachData().log[0]; const t = document.getElementById('gyxCoOv') ? document.getElementById('gyxCoOv').innerText : ''; document.getElementById('gyxCoOv')?.remove(); return { done: x && x.done, plan: x && x.plan, say: x && x.say, t: /连续 1 天/.test(t) }; });
check(`${tag} TA 是你的私教：一个动作一个倒计时，练完打卡、连续天数`, co.done && co.plan === '眼睛休息' && co.say && co.t, JSON.stringify(co));

// 🍁 随机掉落
const dp = await page.evaluate(async () => { gyxDropNow('comet', '9991'); const el = !!document.getElementById('gyxDropIt'); const r1 = await gyxDropPick(); gyxDropNow('comet', '9991'); const r2 = await gyxDropPick(); gyxDropOpen('9991'); const t = document.getElementById('gyxDropOv').innerText; document.getElementById('gyxDropOv').remove(); return { el, first: r1.first, n: r2.n, t: /一颗流星/.test(t) && /传说/.test(t) }; });
check(`${tag} 随机掉落收藏册：飘下来的小东西点一下捡起来，第一次有 TA 的话，收进图鉴`, dp.el && dp.first && dp.n === 2 && dp.t, JSON.stringify(dp));

// 🕯️ 睡前三件好事
const gd = await page.evaluate(async () => { gyxGoodOpen('9991'); ['今天吃到好吃的', '天气很好', '你陪我聊天'].forEach((v, i) => document.getElementById('gyxGd' + i).value = v); document.getElementById('gyxGdT').value = '明天见你'; const r = await gyxGoodSave('9991'); const t = document.getElementById('gyxGdOv').innerText; document.getElementById('gyxGdOv').remove(); return { me: r.me.length, ta: (r.ta || []).length, re: !!r.re, t: /连续 1 晚/.test(t) }; });
check(`${tag} 睡前三件好事：你写三件 + 明天期待，TA 也写，交换着看`, gd.me === 3 && gd.ta === 3 && gd.re && gd.t, JSON.stringify(gd));

// 📈 等级
const lv = await page.evaluate(async () => { const i = gyxLevelInfo('9991'); gyxLevelOpen('9991'); const t = document.getElementById('gyxLvOv').innerText; document.getElementById('gyxLvOv').remove(); return { lv: i.lv, exp: i.exp, title: i.title, src: /说过的话/.test(t) && /经验从哪来/.test(t) }; });
check(`${tag} 我们的等级：各个玩法都算经验，升级有称号`, lv.lv >= 2 && lv.exp > 100 && lv.title && lv.src, JSON.stringify(lv));

// 🔋 省电 / 体检
const sv = await page.evaluate(async () => { const st = gyxSaverStats(); const named = st.filter(b => /我们的成就|随机掉落收藏册|陪你散步|小约定/.test(b.who)).length; await gyxSaverSet('on', true); const calm = document.body.classList.contains('gyx-calm'); gyxSaverOpen(); const t = document.getElementById('gyxSvrOv').innerText; document.getElementById('gyxSvrOv').remove(); await gyxSaverSet('on', false); let n = 0; const id = setInterval(() => n++, 10); await new Promise(r => setTimeout(r, 200)); clearInterval(id); return { plugins: st.length, named, calm, t: /插件体检/.test(t), core: n > 5 }; });
check(`${tag} 省电模式：体检能认出是哪个插件开的定时器；打开后插件动画停掉；核心的定时器不受影响`, sv.plugins >= 10 && sv.named >= 2 && sv.calm && sv.t && sv.core, JSON.stringify(sv));

const acts = await page.evaluate(async () => { const out = {}; for (const a of ['gyx_meme', 'gyx_level', 'gyx_coach', 'gyx_drop', 'gyx_good', 'gyx_saver', 'gyx_time']) { const d = GY_AUTONOMY_ACTIONS.find(x => x.key === a); try { out[a] = d.need(myCharacters[0]) ? String(await d.run(myCharacters[0])) : '不需要'; } catch (e) { out[a] = 'ERR ' + e.message; } } document.getElementById('gyxDropIt')?.remove(); return out; });
check(`${tag} 新插件的自主行动跑起来不报错`, !Object.values(acts).some(v => /ERR/.test(v)), JSON.stringify(acts));

check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
