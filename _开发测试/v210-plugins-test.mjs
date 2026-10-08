// v210：记忆加强插件（生活小档案 / 总结滚雪球 / 番外隔离 / 好感两层）+ 12 个独一无二的新玩法插件
//       + 语音条「转文字」挪进右键菜单 + 桌面上的 TA 按角色换立绘
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

// 全部登记好：开关、自主行动、今天、小组件、记忆总览、小功能
const NEW = [['gyxNotes', 'gyx_notes', 'gyxNotesW'], ['gyxRoll', 'gyx_roll', 'gyxRollW'], ['gyxSide', 'gyx_side', 'gyxSideW'], ['gyxDual', 'gyx_dual', 'gyxDualW'],
  ['gyxTime', 'gyx_time', 'gyxTimeW'], ['gyxEye', 'gyx_eye', 'gyxEyeW'], ['gyxSwap', 'gyx_swap', 'gyxSwapW'], ['gyxStar', 'gyx_star', 'gyxStarW'], ['gyxBeat', 'gyx_beat', 'gyxBeatW'], ['gyxWalk', 'gyx_walk', 'gyxWalkW'],
  ['gyxShake', 'gyx_shake', 'gyxShakeW'], ['gyxDuo', 'gyx_duo', 'gyxDuoW'], ['gyxReel', 'gyx_reel', 'gyxReelW'], ['gyxBottle', 'gyx_bottle', 'gyxBottleW'], ['gyxHome', 'gyx_home', 'gyxHomeW'], ['gyxTape', 'gyx_tape', 'gyxTapeW']];
const reg = await page.evaluate(NEW => {
  const miss = [];
  const ks = typeof gyMemExList === 'function' ? gyMemExList() : [];
  NEW.forEach(([f, a, w]) => {
    if (!GYX.FEATS.some(x => x.id === f)) miss.push(f + ':开关');
    if (!GY_AUTONOMY_ACTIONS.some(x => x.key === a)) miss.push(f + ':自主');
    if (!window.__gyPmW.WD[w]) miss.push(f + ':小组件');
    if (!ks.includes(f)) miss.push(f + ':记忆');
    if (!GY_MINI_FEATURES.some(x => x.id === f)) miss.push(f + ':小功能');
  });
  const wr = NEW.map(([, , w]) => { try { return window.__gyPmW.WD[w].r({ size: 'm' }); } catch (e) { return 'ERR ' + e.message; } }).filter(h => /ERR/.test(h));
  return { miss, wr };
}, NEW);
check(`${tag} 16 个新插件都登记好了：开关 / 自主行动 / 小组件 / 记忆总览 / 小功能`, !reg.miss.length && !reg.wr.length, JSON.stringify(reg));

// 📇 生活小档案 + 聊天里说过的约定进小约定
const notes = await page.evaluate(async () => { await gyxNotesTidy(9991, true); const L = gyxNotesData().notes['9991'] || []; const pr = (gyxPromiseData().list || []).filter(x => x.src === 'chat'); const cx = __gyxCtxFor(9991); document.getElementById('gyxNtsOv')?.remove(); return { L: L.map(x => x.text), pr: pr.map(x => x.what), cx: /生活小档案/.test(cx) }; });
check(`${tag} 生活小档案：从聊天里记下喜好（${BAILU ? '白露认「我喜欢…」' : '模型整理'}），进 TA 的提示词${BAILU ? '' : '；「下次一起」进小约定'}`, notes.L.some(t => /辣/.test(t)) && notes.cx && (BAILU || notes.pr.some(t => /看海/.test(t))), JSON.stringify(notes));

// 🧊 总结滚雪球 + 几天前
const roll = await page.evaluate(async () => { const c = myCharacters[0], before = c.chatSummary.split('\n').length; const n = await gyxRollNow(9991, true); const after = c.chatSummary.split('\n').length; const rel = gyxRollRel(Date.now() - 3 * 864e5); const txt = typeof getRecentChatSummaryText === 'function' ? String(getRecentChatSummaryText(c.chatSummary, 5)) : ''; document.getElementById('gyxRollOv')?.remove(); return { before, after, n, rel, has: /回顾/.test(c.chatSummary), relTxt: /前|上周|上个月|昨天|今天/.test(txt) }; });
check(`${tag} 总结滚雪球：老总结浓缩成回顾（原文归档能恢复），时间显示成「几天前」`, roll.after < roll.before && roll.has && /天前/.test(roll.rel), JSON.stringify(roll));

// 🎭 番外隔离
const side = await page.evaluate(async () => { currentChatSessionId = '9991'; gyxSideMark(globalChats['9991'].length - 1, true); const m = globalChats['9991'][globalChats['9991'].length - 1], was = m.side === true; let embedded = false; const msg = { text: 'x', side: true }; try { await embedMessageInBackground(msg); } catch (e) {} embedded = !!(msg.embVec && msg.embVec.length); gyxSideMark(globalChats['9991'].length - 1, false); return { side: was, embedded }; });
check(`${tag} 番外隔离：标成番外的消息不进向量记忆`, side.side && !side.embedded, JSON.stringify(side));

// 💞 好感两层
const dual = await page.evaluate(async () => { await gyxDualSet('9991', 'o', 1, '测试'); if (!window.bailuCards) await gyxDualJudge('9991'); const s = gyxDualData().st['9991']; const cx = __gyxCtxFor(9991); document.getElementById('gyxDualOv')?.remove(); return { i: s.i, o: s.o, log: s.log.length, cx: /两层/.test(cx), act: GY_AUTONOMY_ACTIONS.find(a => a.key === 'gyx_dual').need(myCharacters[0]) }; });
check(`${tag} 好感两层：心里/面上分开记，有证据才挪；心口不一时 TA 会「不小心流露」`, dual.o === 1 && dual.log >= 1 && dual.cx && dual.act, JSON.stringify(dual));

// ⏳ 时光机：聊天不进现在的聊天记录
const tm = await page.evaluate(async () => { const n0 = globalChats['9991'].length; await gyxTimeGo('9991', Date.now() - 10 * 864e5); document.getElementById('gyxTmIn').value = '你好呀，过去的你'; await gyxTimeSend(); const box = document.getElementById('gyxTmChat').innerText; document.getElementById('gyxTmOv')?.remove(); return { box: box.length, n: globalChats['9991'].length - n0, sum: /有一条|你好呀/.test(box) }; });
check(`${tag} 时光机：和过去的 TA 聊天，TA 回了，聊的不进现在的聊天记录`, tm.n === 0 && tm.box > 10, JSON.stringify(tm));

// 👀 TA眼中的你
const eye = await page.evaluate(async () => { const r = await gyxEyeWrite('9991'); const t = document.getElementById('gyxEyeOv').innerText; document.getElementById('gyxEyeOv')?.remove(); return { ok: !!r, t: /观察笔记|这个月/.test(t) }; });
check(`${tag} TA眼中的你：写出这个月的观察笔记（带统计）`, eye.ok && eye.t, JSON.stringify(eye));

// 🔄 互换身份
const sw = await page.evaluate(async () => { await gyxSwapStart('9991', 3); const cx = /互换身份/.test(__gyxCtxFor(9991)); await gyxSwapEnd('9991'); const t = document.getElementById('gyxSwapOv').innerText; document.getElementById('gyxSwapOv')?.remove(); return { cx, log: /感想/.test(t) && !/还没换过/.test(t) }; });
check(`${tag} 互换身份：开始后 TA 提示词里知道在演你；换回来写感想`, sw.cx && sw.log, JSON.stringify(sw));

// ✨ 星图
const star = await page.evaluate(async () => { gyxStarOpen('9991'); await new Promise(r => setTimeout(r, 200)); const cv = document.getElementById('gyxStarCv'); const pts = (cv.__pts || []).length; document.getElementById('gyxStarIn').value = '第一次一起熬夜'; await gyxStarAdd('9991'); await new Promise(r => setTimeout(r, 200)); const pts2 = (document.getElementById('gyxStarCv').__pts || []).length; await gyxStarName('9991'); await new Promise(r => setTimeout(r, 100)); document.getElementById('gyxStarOv')?.remove(); return { pts, pts2 }; });
check(`${tag} 我们的星图：回忆变成星星，能自己摘一颗挂上去`, star.pts > 5 && star.pts2 === star.pts + 1, JSON.stringify(star));

// 💓 听心跳（点屏幕版）
const beat = await page.evaluate(async () => { gyxBeatOpen('9991'); for (let i = 0; i < 8; i++) { gyxBeatTap('9991'); await new Promise(r => setTimeout(r, 750)); } await new Promise(r => setTimeout(r, 400)); const t = document.getElementById('gyxBtMsg').innerText; document.getElementById('gyxBeatOv')?.remove(); return { t }; });
check(`${tag} 让 TA 听心跳：跟着点 8 下量出心跳，TA 说了话`, /\d{2}/.test(beat.t) && /次\/分钟/.test(beat.t), JSON.stringify(beat));

// 🚶 散步
const walk = await page.evaluate(async () => { gyxWalkStart('9991'); await new Promise(r => setTimeout(r, 200)); const P = (la, lo) => window.__geo({ coords: { latitude: la, longitude: lo, accuracy: 10 } }); for (let i = 0; i < 8; i++) P(31.2 + i * 0.001, 121.4); await new Promise(r => setTimeout(r, 300)); const live = document.getElementById('gyxWkLive').innerHTML; await gyxWalkStop(); const w = gyxWalkData().walks[0]; document.getElementById('gyxWalkOv')?.remove(); return { dist: Math.round(w.dist), talk: w.talk.length, svg: /polyline/.test(live), diary: w.diary }; });
check(`${tag} 陪你散步：按定位记路线和距离，走一段 TA 说一句，回来写散步日记`, walk.dist > 600 && walk.talk >= 2 && walk.svg && walk.diary, JSON.stringify(walk));

// 📳 摇一摇·贴贴
const shk = await page.evaluate(async () => { gyxShakeOpen(); const ev = m => { const e = new Event('devicemotion'); e.accelerationIncludingGravity = { x: m, y: 0, z: 0 }; dispatchEvent(e); }; for (let i = 0; i < 4; i++) { ev(30); await new Promise(r => setTimeout(r, 150)); ev(1); } await new Promise(r => setTimeout(r, 800)); const pad = document.getElementById('gyxShkPad'); await new Promise(r => setTimeout(r, 3200)); pad.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await new Promise(r => setTimeout(r, 2300)); pad.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); await new Promise(r => setTimeout(r, 300)); const t = document.getElementById('gyxShkSay').innerText; document.getElementById('gyxShkOv')?.remove(); const w = window.__gyPmW.WD.gyxShakeW.r({ size: 'm' }); return { t, w }; });
check(`${tag} 摇一摇·贴贴：晃手机 TA 有反应，按住两秒贴贴`, /1 次贴贴/.test(shk.w) && /摇了 1/.test(shk.w) && shk.t.length > 1, JSON.stringify(shk));

// 📸 合照（假摄像头）→ 图库
const duo = await page.evaluate(async () => { const c = myCharacters[0]; c.avatarImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; gyxDuoOpen('9991'); await new Promise(r => setTimeout(r, 600)); const g0 = window.gyGallery ? window.gyGallery.all().length : 0; await gyxDuoShot('9991'); const res = !!document.getElementById('gyxDuoRes'); document.getElementById('gyxDuoRes')?.remove(); document.getElementById('gyxDuoOv')?.remove(); return { res, pics: gyxDuoData().pics.length, gal: window.gyGallery ? window.gyGallery.all().length - g0 : 1, jpg: /^data:image\/jpeg/.test(gyxDuoData().pics[0]?.src || '') }; });
check(`${tag} 和 TA 合照：前置摄像头 + TA 立绘拍下来，存进图库`, duo.res && duo.pics === 1 && duo.gal === 1 && duo.jpg, JSON.stringify(duo));

// 🎞️ 回忆放映
const reel = await page.evaluate(async () => { await gyxReelMake('9991'); await new Promise(r => setTimeout(r, 400)); const sc = document.getElementById('gyxReelSc'); const t = sc ? sc.innerText : ''; gyxReelNext(); await new Promise(r => setTimeout(r, 200)); document.getElementById('gyxReelPl')?.remove(); document.getElementById('gyxReelOv')?.remove(); return { t }; });
check(`${tag} 回忆放映：用照片和回忆剪出一部小电影并开始放`, reel.t.length > 4, JSON.stringify(reel));

// 🍾 漂流瓶
const btl = await page.evaluate(async () => { gyxBottleOpen('sea'); document.getElementById('gyxBtlIn').value = '今天有点难过'; document.getElementById('gyxBtlTo').value = '9992'; await gyxBottleThrow(); const D = gyxBottleData(); D.out[0].due = 0; await gyxBottleTick(); gyxBottleOpen('sea'); await gyxBottlePick(); const got = document.getElementById('gyxBtlGot').innerText; document.getElementById('gyxBtlOv')?.remove(); return { reply: D.out[0].reply, got: got.length, cx: /漂流瓶/.test(__gyxCtxFor(9992)) }; });
check(`${tag} 漂流瓶：扔出去被别的角色捡到回信（TA 不知道是你），自己也能捡到 TA 们的匿名心里话`, btl.reply && btl.got > 6 && btl.cx, JSON.stringify(btl));

// 🏠 小屋：合照、散步自动变成屋里的东西；TA 也会添
const home = await page.evaluate(async () => { gyxHomeOpen('9991'); const t = [...document.querySelectorAll('.hm-it')].map(e => e.title); await gyxHomeGift('9991'); const n = document.querySelectorAll('.hm-it').length; document.getElementById('gyxHomeOv')?.remove(); return { t, n }; });
check(`${tag} 我们的小屋：合照变相框、散步捡回东西；TA 能添一件带故事的`, home.t.includes('合照相框') && home.t.includes('散步捡回来的') && home.n === home.t.length + 1, JSON.stringify(home));

// 📼 留声机：录一盘（假麦克风）→ TA 回 B 面；TA 自己录一盘
const tape = await page.evaluate(async () => { gyxTapeOpen('9991'); await gyxTapeRec('9991'); await new Promise(r => setTimeout(r, 900)); await gyxTapeRec('9991'); await new Promise(r => setTimeout(r, 1500)); await gyxTapeAsk('9991'); await new Promise(r => setTimeout(r, 300)); const d = [...document.querySelectorAll('.tape-cas')].map(e => e.innerText); document.getElementById('gyxTpeOv')?.remove(); return { d }; });
check(`${tag} 留声机：录磁带给 TA，TA 录 B 面；TA 也自己录了一盘`, tape.d.length === 2 && tape.d.some(t => /B 面/.test(t)) && tape.d.some(t => /顾言 录的/.test(t)), JSON.stringify(tape));

// 自主行动都能跑（不报错）
const acts = await page.evaluate(async NEW => { const out = {}; for (const [, a] of NEW) { const d = GY_AUTONOMY_ACTIONS.find(x => x.key === a); try { out[a] = d.need(myCharacters[0]) ? String(await d.run(myCharacters[0])) : '不需要'; } catch (e) { out[a] = 'ERR ' + e.message; } } return out; }, NEW);
check(`${tag} 新插件的自主行动跑起来不报错`, !Object.values(acts).some(v => /ERR/.test(v)), JSON.stringify(acts));

// 今天面板 + 记忆总览能改能删
const tm2 = await page.evaluate(() => { const h = GYX.todayHtml(); return ['生活小档案', '散步', '合照', '漂流瓶', '小屋', '留声机'].filter(k => !h.includes(k)); });
check(`${tag} 今天面板里出现新插件的小节`, !tm2.length, JSON.stringify(tm2));

// 开关关掉：小组件显示「关着」、小功能入口消失
const off = await page.evaluate(() => { GYX.set('gyxTape', false); const w = window.__gyPmW.WD.gyxTapeW.r({ size: 'm' }); const mini = GY_MINI_FEATURES.some(f => f.id === 'gyxTape'); GYX.set('gyxTape', true); return { w: /关着/.test(w), mini }; });
check(`${tag} 每个新插件都能单独关：关了小组件显示「关着」、入口消失`, off.w && !off.mini, JSON.stringify(off));

// 桌面上的 TA：每个角色自己的立绘
const pet = await page.evaluate(() => { const c = myCharacters[0]; return { f: typeof gyxPetImgOf === 'function', img: (gyxPetImgOf(c) || '').slice(0, 20) }; });
check(`${tag} 桌面上的 TA：按角色取立绘（没传就用 TA 的头像）`, pet.f && /^data:image/.test(pet.img), JSON.stringify(pet));

// 语音条「转文字」进右键菜单（谷雨）
if (!BAILU) {
  const vc = await page.evaluate(async () => {
    if (typeof window.gyVoiceToText !== 'function') return { skip: 'no voice' };
    const sid = '9991'; currentChatSessionId = '9991';
    globalChats[sid].push({ sender: 9991, text: '[语音] 我想你了', timestamp: Date.now(), voice: true, voiceText: '我想你了', gyVoice: { text: '我想你了', dur: 3 } });
    try { renderChatMessages(); } catch (e) {}
    await new Promise(r => setTimeout(r, 300));
    const chip = document.querySelectorAll('.gyvc-tx-btn, .gyvc-chip').length;
    const idx = globalChats[sid].length - 1;
    try { showChatContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 100, clientY: 100, pageX: 100, pageY: 100 }, idx); } catch (e) { return { err: e.message }; }
    await new Promise(r => setTimeout(r, 100));
    const m = document.getElementById('chatContextMenu'); const txt = m ? m.innerText : '';
    if (m) m.style.display = 'none';
    return { chip, menu: /转文字/.test(txt), txt: txt.slice(0, 80) };
  });
  check(`${tag} 语音条：转文字挪进右键菜单（气泡上不再有按钮）`, vc.skip || (vc.menu && vc.chip === 0), JSON.stringify(vc));
}

check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
