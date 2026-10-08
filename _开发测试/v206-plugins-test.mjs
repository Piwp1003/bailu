// v206：新玩法插件（插件/新玩法/新玩法全家桶.json）——导入后每个都能用；谷雨走模型、白露走字卡
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
  myCharacters.push({ id: 9961, name: '顾言', persona: '温柔的医生', worldbooks: [], actMode: 'fixed', diaryData: { letters: [{ id: 'L1', title: '给你', content: '见字如面。\n想你。', date: Date.now(), author: 'char' }], diaries: [] } },
                    { id: 9962, name: '沈之遥', worldbooks: [], actMode: 'auto', diaryData: { letters: [], diaries: [] } });
  globalChats['9961'] = [{ sender: 9961, text: '今天手术很顺利', timestamp: Date.now() - 600000 }, { sender: 'me', text: '辛苦啦', timestamp: Date.now() - 500000 }, { sender: 9961, text: '想你了', timestamp: Date.now() - 400000 }];
  globalChats['9962'] = [];
  window.__sent = []; window.sendProactiveChatMessage = async c => { window.__sent.push([c.id, getBoxPrompt(c)]); };
  window.triggerAIBatchReply = async () => {};
  if (!BAILU) {
    window.getApiConfig = () => ({ url: 'https://x', key: 'k', model: 'm' });
    window.__asks = [];
    window.sendChatRequest = async (api, p) => {
      window.__asks.push(p); let c = '好呀';
      if (/又删掉了/.test(p)) c = JSON.stringify({ text: '其实我今天有点吃醋', why: '怕她觉得我小气' });
      else if (/深夜电台/.test(p)) c = JSON.stringify({ title: '雨夜频道', segs: [{ t: 'open', s: '晚上好' }, { t: 'song', s: '送你一首', song: '晴天 - 周杰伦' }, { t: 'night', s: '晚安' }] });
      else if (/昨晚做了一个梦/.test(p)) c = JSON.stringify({ title: '会飞的手术室', mood: '奇怪', text: '梦见手术室飘在云上。', tell: '我昨晚梦到你来医院找我了' });
      else if (/SVG/.test(p)) c = JSON.stringify({ title: '小猫', say: '画得丑别笑', svg: '<svg viewBox="0 0 200 200"><script>alert(1)</script><circle cx="100" cy="100" r="50" stroke="red" fill="none" onclick="x()"/></svg>' });
      else if (/交换日记/.test(p)) c = '看到你写的了。我这几天在忙。你最近睡得好吗？';
      else if (/时间胶囊/.test(p)) c = '给未来的你：那天也要开心。';
      else if (/明信片/.test(p)) c = JSON.stringify({ place: '大理', scene: 'lake', text: '洱海边风很大，想你。', stamp: '苍山洱海' });
      else if (/小约定/.test(p)) c = JSON.stringify({ what: '喝够八杯水', hour: 21, reward: '一个抱抱', say: '今天要喝够八杯水哦' });
      else if (/删掉/.test(p)) c = JSON.stringify({ text: '其实我今天有点吃醋', why: '怕她觉得我小气' });
      else if (/睡前故事/.test(p)) c = '从前有一只小熊。它困了。晚安。';
      else if (/叫她起床/.test(p)) c = '起床啦懒猪';
      else if (/屏幕角落/.test(p)) c = '在干嘛呢';
      else if (/养了/.test(p)) c = '我刚给团子喂了猫粮';
      else if (/一起专注|休息|结束了/.test(p)) c = '加油，我陪你';
      return { choices: [{ message: { content: c } }] };
    };
  }
  window.__played = 0; HTMLMediaElement.prototype.play = function () { window.__played++; setTimeout(() => this.onended && this.onended(), 20); return Promise.resolve(); };
  try { speechSynthesis.speak = u => { setTimeout(() => u.onend && u.onend(), 20); }; } catch (e) {}
  window.__desk = []; window.gyDesk = { isDesk: true, petShow: o => __desk.push(['show', o]), petHide: () => __desk.push(['hide']), petSay: t => __desk.push(['say', t]), onPet: cb => { window.__deskCb = cb; } };
  PLUG.forEach(p => executePluginOnLoad(p));
}, { PLUG, BAILU });
await page.waitForTimeout(800);
const tag = BAILU ? '[白露]' : '[谷雨]';

check(`${tag} 17 个插件都装上了，小功能里都有入口`, await page.evaluate(() => ['gyxIntro', 'gyxVary', 'gyxSwitch', 'gyxPet', 'gyxRadio', 'gyxStudy', 'gyxDream', 'gyxDoodle', 'gyxJournal', 'gyxWorld', 'gyxGrow', 'gyxCapsule', 'gyxPost', 'gyxLetter', 'gyxPromise', 'gyxWake', 'gyxDraft'].every(k => GY_MINI_FEATURES.some(f => f.id === k))));

// 🧸 桌面上的 TA
const pet = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 300)); const e = document.getElementById('gyxPet'); const t = await gyxPetTalk(); e.click && e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 })); e.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); await new Promise(r => setTimeout(r, 300)); e.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return { vis: !!e && getComputedStyle(e).display !== 'none', t, b: document.getElementById('gyxPetB').textContent, chat: String(currentChatSessionId) }; });
check(`${tag} 桌面上的 TA：角落里有小 TA，会冒泡说话，双击去聊天（单击是理 TA，v209 起）`, pet.vis && pet.t && pet.b && pet.chat === '9961', JSON.stringify(pet));

// 📻 深夜电台
const rd = await page.evaluate(async () => { const ep = await gyxRadioMake(GYX.char(9961)); gyxRadioOpen(); await gyxRadioPlay(ep.id); const t = document.getElementById('gyxRdOv').innerText; document.getElementById('gyxRdOv').remove(); return { title: ep.title, n: ep.segs.length, t: t.slice(0, 200) }; });
check(`${tag} 深夜电台：一期节目（开场→…→晚安），能收听`, rd.n >= 2 && /FM/.test(rd.t) && /晚安|电台/.test(rd.t), JSON.stringify(rd));

// 📚 自习室
const st = await page.evaluate(async () => { gyxStudyOpen(); document.getElementById('gyxStTask') && (document.getElementById('gyxStTask').value = '写论文'); await gyxStudyStart(); const s = gyxStudyState(); const t = document.getElementById('gyxStOv').innerText; const ctx = getBoxPrompt(myCharacters[0]); await gyxStudyStop(); document.getElementById('gyxStOv').remove(); return { s: !!s, task: s && s.task, t: /专注/.test(t), ctx: /一起自习/.test(ctx), msgs: globalChats['9961'].filter(m => m.gyx).length }; });
check(`${tag} 一起自习室：开始计时、TA 说话、聊天时 TA 知道在自习、结束有记录`, st.s && st.task === '写论文' && st.t && st.ctx && st.msgs >= 2, JSON.stringify(st));

// 🌙 梦
const dr = await page.evaluate(async () => { const it = await gyxDreamTell(GYX.char(9961)); gyxDreamOpen(9961); const t = document.getElementById('gyxDrOv').innerText; document.getElementById('gyxDrOv').remove(); return { it: !!it, t: t.slice(0, 120), last: globalChats['9961'].slice(-1)[0].text }; });
check(`${tag} TA 的梦：TA 讲昨晚的梦，梦的本子里有这一篇`, dr.it && /梦/.test(dr.last) && dr.t.length > 10, JSON.stringify(dr));

// 🎨 涂鸦
const dw = await page.evaluate(async () => {
  gyxDoodleOpen(); const cv = document.getElementById('gyxDwCv'); const r = cv.getBoundingClientRect();
  const ev = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: r.left + x, clientY: r.top + y, pointerId: 1 }));
  ev('pointerdown', 20, 20); ev('pointermove', 80, 90); ev('pointerup', 80, 90);
  document.getElementById('gyxDwCap').value = '一只猫'; window.__gyxDoodleAlways = true;
  await gyxDoodleSend(); await new Promise(r => setTimeout(r, 400));
  const H = globalChats['9961']; const mine = H.filter(m => m.sender === 'me' && m.mediaUrl).pop(), ta = H.filter(m => m.sender === 9961 && m.mediaUrl).pop();
  const svg = ta ? atob(ta.mediaUrl.split(',')[1]) : '';
  return { mine: mine && /^data:image\/png/.test(mine.mediaUrl) && /\[涂鸦\].*一只猫/.test(mine.text), ta: !!ta, safe: svg && !/script|onclick/.test(svg) };
});
check(`${tag} 涂鸦互传：画一笔发过去（聊天里是图），TA 回一张自己画的（脚本被清掉）`, dw.mine && dw.ta && dw.safe, JSON.stringify(dw));

// 📓 交换日记本
const jn = await page.evaluate(async () => { gyxJournalOpen(9961); gyxJournalEdit(true); document.getElementById('gyxJnTx').value = '今天看到一只猫，好像你。'; gyxJournalStk('🐱'); document.getElementById('gyxJnTx').value = '今天看到一只猫，好像你。'; await gyxJournalSave(); await gyxJournalTaNow('9961'); const t = document.getElementById('gyxJnOv').innerText; document.getElementById('gyxJnOv').remove(); return { t: t.slice(0, 160), ctx: /交换日记/.test(getBoxPrompt(myCharacters[0])) }; });
check(`${tag} 交换日记本：你写一页交给 TA，TA 接着写下一页`, /2 \/ 2/.test(jn.t) && jn.ctx, JSON.stringify(jn));

// 🪐 平行世界
const wd = await page.evaluate(async () => { const before = globalChats['9961'].length; const id = await gyxWorldFork(9961, 1, '如果我没回', '我没有回他的消息'); const inW = globalChats['9961'].length; const ctx = getBoxPrompt(myCharacters[0]); await gyxWorldSwitch(9961, 'main'); return { before, inW, back: globalChats['9961'].length, ctx: /平行世界/.test(ctx) }; });
check(`${tag} 平行世界：从第 2 句分岔（聊天只剩前两句 + 如果），切回主线原样都在`, wd.inW === 3 && wd.back === wd.before && wd.ctx, JSON.stringify(wd));

// 🌱 养小生命
const gr = await page.evaluate(async () => { const p = await gyxGrowNew('cat', 9961, '团子'); const w0 = p.water; await gyxGrowCare(p.id, 'me'); await gyxGrowTaCare(p.id); const t = document.getElementById('gyxGrOv').innerText; document.getElementById('gyxGrOv').remove(); return { up: gyxGrowData().list[0].exp > 0 && gyxGrowData().list[0].water > w0 - 1, t: /团子/.test(t) && /喂猫粮/.test(t), log: gyxGrowData().list[0].log.length, ctx: /团子/.test(getBoxPrompt(myCharacters[0])) }; });
check(`${tag} 一起养小生命：养一只小猫，你喂 / TA 也喂还来汇报，TA 聊天时知道它`, gr.up && gr.t && gr.log >= 3 && gr.ctx, JSON.stringify(gr));

// ⏳ 时间胶囊
const cp = await page.evaluate(async () => { gyxCapsuleOpen(); document.getElementById('gyxCpTx').value = '一年后的我：还爱他吗'; document.getElementById('gyxCpTo').value = 'me'; await gyxCapsuleSeal(); const it = await gyxCapsuleTaBury(9961); it.open = Date.now() - 1000; const D = gyxCapsuleData(); await new Promise(r => setTimeout(r, 1000)); gyxCapsuleOpen(); const hidden = /埋在土里/.test(document.getElementById('gyxCpOv').innerText); await gyxCapsuleCrack(it.id); const t = document.getElementById('gyxCpRead').innerText; document.getElementById('gyxCpRead').remove(); const ov = document.getElementById('gyxCpOv'); if (ov) ov.remove(); return { n: D.list.length, mineLocked: D.list.find(x => x.from === 'me').open > Date.now(), hidden, t: t.slice(0, 80) }; });
check(`${tag} 时间胶囊：你埋的到日子前拆不开；TA 偷偷埋的你不知道，到了能拆开读`, cp.n === 2 && cp.mineLocked && cp.t.length > 5, JSON.stringify(cp));

// 🏞️ 明信片
const pc = await page.evaluate(async () => { const it = await gyxPostSend(9961, true); gyxPostOpen(); const b = document.getElementById('gyxPcOv'); const r = { place: it.place, svg: !!b.querySelector('.pc-f svg'), foot: /足迹/.test(b.innerText) }; b.remove(); return r; });
check(`${tag} 明信片墙：TA 寄来一张（正面风景 + 背面手写 + 邮戳），墙上和足迹里有`, pc.place && pc.svg && pc.foot, JSON.stringify(pc));

// 💌 拆信仪式
const lt = await page.evaluate(async () => { window.currentDiaryTab = 'letter'; try { currentDiaryTab = 'letter'; currentDiaryCharId = 9961; } catch (e) {} let called = 0; const o = window.openDiaryDetail; await new Promise(r => setTimeout(r, 3200)); openDiaryDetail('L1'); const ov = document.getElementById('gyxLtOv'); const has = !!ov; ov.querySelector('.lt-wax').click(); await new Promise(r => setTimeout(r, 1600)); const read = ov.classList.contains('read') && /想你/.test(ov.innerText); gyxLetterClose(); await new Promise(r => setTimeout(r, 500)); return { has, read }; });
check(`${tag} 拆信仪式：打开 TA 的信先是火漆信封，按火漆掰开、信纸滑出来`, lt.has && lt.read, JSON.stringify(lt));

// 🤙 小约定
const pr = await page.evaluate(async () => { const it = await gyxPromiseTa(9961); window.__sent = []; await gyxPromiseMark(it.id, 1); const r = { what: it.what, stars: gyxPromiseData().stars, sent: window.__sent.length && /做到了/.test(window.__sent[0][1]) }; const o = document.getElementById('gyxPrOv'); if (o) o.remove(); return r; });
check(`${tag} 小约定：TA 跟你定约定，你做到了 TA 来夸、兑现奖励`, pr.what && pr.stars === 1 && pr.sent, JSON.stringify(pr));

// ⏰ 叫醒与哄睡
const wk = await page.evaluate(async () => { await gyxWakeAdd(); const a = gyxWakeData().alarms[0]; a.who = '9961'; gyxWakeTest(a.id); await new Promise(r => setTimeout(r, 400)); const ov = document.getElementById('gyxWkOv'); const r = { ring: !!ov, s: ov && document.getElementById('gyxWkS').textContent }; window.__sent = []; await gyxWakeUp(); r.gone = !document.getElementById('gyxWkOv'); r.morning = window.__sent.length === 1; const t = await gyxSleepStart(); r.story = !!t; gyxSleepStop(); const o = document.getElementById('gyxWkSet'); if (o) o.remove(); return r; });
check(`${tag} 叫醒与哄睡：闹钟响 TA 来叫、起来后 TA 说早安；哄睡讲故事配白噪音`, wk.ring && wk.s && wk.gone && wk.morning && wk.story, JSON.stringify(wk));

// ✏️ 草稿箱
const df = await page.evaluate(async () => { switchMainView('chat'); switchChatSession('9961'); const it = await gyxDraftMake(9961, 'recall'); await new Promise(r => setTimeout(r, 300)); const last = globalChats['9961'].slice(-1)[0]; gyxDraftOpen(9961); const t = document.getElementById('gyxDfOv').innerText; document.getElementById('gyxDfOv').remove(); return { it: it && it.text, recalled: last.sender === 'system' && /撤回/.test(last.text), t: t.includes(it.text), ctx: /删掉|撤回/.test(getBoxPrompt(myCharacters[0])) }; });
check(`${tag} TA 的草稿箱：TA 打了又删 / 发了又撤回，草稿箱里看得到，TA 心里也记得`, df.it && df.recalled && df.t && df.ctx, JSON.stringify(df));


// 🧸 真的放到桌面上（桌面版 exe 的 window.gyDesk）
const dk = await page.evaluate(async () => { await gyxPetSet('desk', true); gyxPetSay('我在桌面上'); window.__deskCb({ type: 'moved', x: 100, y: 200 }); const vis = getComputedStyle(document.getElementById('gyxPet')).display; await gyxPetSet('desk', false); const o = document.getElementById('gyxPetOv'); if (o) o.remove(); return { show: __desk.some(x => x[0] === 'show'), say: __desk.some(x => x[0] === 'say' && x[1] === '我在桌面上'), hide: __desk.some(x => x[0] === 'hide'), inApp: vis }; });
check(`${tag} 桌面上的 TA：桌面版里能真的放到电脑桌面上（冒泡同步过去），应用里那个就藏起来`, dk.show && dk.say && dk.hide && dk.inApp === 'none', JSON.stringify(dk));

// 🎬 开场动画合集
const intro = await page.evaluate(async () => { const L = window.__gyxIntroLib; const ids = Object.keys(L.styles); const bad = []; for (const id of ids) { try { L.play(id); const o = document.getElementById('gyxIntro'); if (!o || !o.innerText.trim()) bad.push(id); o && o.remove(); document.getElementById('gyxIntroCss')?.remove(); } catch (e) { bad.push(id + ':' + e.message); } } const E = JSON.parse(localStorage.getItem('gyEarly') || '{}'); return { n: ids.length, bad, early: !!E.gyxIntro, cats: Object.keys(L.cats).length, lines: Object.values(L.cats).flat().length }; });
check(`${tag} 开场动画合集：20 种样式都能放、上百句文案，已经装进「页面一打开就跑」的钩子`, intro.n >= 20 && !intro.bad.length && intro.early && intro.lines >= 80, JSON.stringify(intro));

// 🎬 自己做开场：勾选、新建、上传、CSS 示例
const my = await page.evaluate(async () => {
  gyxIntroOpen(); const boxes = document.querySelectorAll('#gyxInOv .in-it input[type=checkbox]').length;
  gyxIntroEdit(-1); document.getElementById('gyxInN').value = '我的小窝'; document.getElementById('gyxInH').value = '<div class="bg"></div><div class="t">{title}·{ta}</div><div class="s">{line}</div>'; document.getElementById('gyxInC').value = '.bg{position:absolute;inset:0;background:#123}.t{color:#fff;font-size:40px}';
  gyxIntroSaveMy(-1);
  const L = window.__gyxIntroLib; const id = Object.keys(L.styles).find(k => /^u_/.test(k)); L.play(id); const o = document.getElementById('gyxIntro'); const txt = o.innerText; const css = document.getElementById('gyxIntroCss').textContent; o.remove(); document.getElementById('gyxIntroCss').remove();
  await gyxIntroUpload({ files: [new File(['<html><head><style>.x{color:red}</style></head><body><div class="x">{line}</div></body></html>'], '别人的开场.html', { type: 'text/html' })], value: '' });
  const up = Object.values(window.__gyxIntroLib.styles).some(s => s.n === '别人的开场');
  // CSS 示例
  ['gyCssEg', 'gyCssEgSearch', 'globalCSSInput'].forEach((id, i) => { if (!document.getElementById(id)) { const e = document.createElement(i === 2 ? 'textarea' : i === 1 ? 'input' : 'div'); e.id = id; document.body.appendChild(e); } });
  gyCssEgRender(); const btns = document.querySelectorAll('#gyCssEg .gyx-ineg').length;
  document.querySelector('#gyCssEg .gyx-ineg[data-k="neon"]').click(); const ta = document.getElementById('globalCSSInput').value;
  globalCustomCSS = ta.replace('#ffe6f4', '#00ff00'); gyxIntroTakeCss(); const cfg = JSON.parse(localStorage.getItem('gyxIntroCfg'));
  const ov = document.getElementById('gyxInOv'); if (ov) ov.remove();
  return { boxes, txt, scoped: /#gyxIntro\.s-u_\w+ \.t/.test(css), up, btns, ta: /开场动画 · 霓虹灯牌/.test(ta) && /#gyxIntro\.s-neon/.test(ta), user: /#00ff00/.test(cfg.userCss || '') };
});
check(`${tag} 开场可以一个个勾选；自己新建一个（HTML+CSS，能用 {title}{ta}{line}）、上传别人的都能放`, my.boxes >= 20 && /顾言/.test(my.txt) && my.scoped && my.up, JSON.stringify(my));
check(`${tag} 每种开场的 CSS 都在「CSS 美化 → 示例」里，点一下加进 CSS 框；改了保存，下次开场就用改过的`, my.btns >= 21 && my.ta && my.user, JSON.stringify(my));

// 💬 文案不重样
const vr = await page.evaluate(() => { const out = new Set(); for (let i = 0; i < 30; i++) out.add(gyxVaryText('保存成功')); const off = (GYX.set('gyxVary', false), gyxVaryText('保存成功')); GYX.set('gyxVary', true); return { kinds: out.size, off }; });
check(`${tag} 文案不重样：「保存成功」每次说法不一样；关掉就是原来的字`, vr.kinds >= 3 && vr.off === '保存成功', JSON.stringify(vr));

// 🎛️ 功能开关中心 + 自主行动
const sw = await page.evaluate(() => {
  const keys = ['gyx_pet', 'gyx_radio', 'gyx_study', 'gyx_dream', 'gyx_doodle', 'gyx_journal', 'gyx_world', 'gyx_grow', 'gyx_capsule', 'gyx_postcard', 'gyx_promise', 'gyx_sleep', 'gyx_draft', 'gyx_webmedia', 'gyx_mystic'];
  const missing = keys.filter(k => !GY_AUTONOMY_ACTIONS.some(a => a.key === k));
  const c = myCharacters[0], A = k => GY_AUTONOMY_ACTIONS.find(a => a.key === k);
  const before = !!A('gyx_doodle').need(c);
  GYX.set('gyxDoodle', false); const offMini = !GY_MINI_FEATURES.some(f => f.id === 'gyxDoodle'), offAct = !A('gyx_doodle').need(c);
  GYX.set('gyxDoodle', true); GYX.set('gyxDoodle.auto', false); const autoOff = !A('gyx_doodle').need(c) && GY_MINI_FEATURES.some(f => f.id === 'gyxDoodle');
  GYX.set('gyxDoodle.auto', true);
  gyxSwitchAct('post', false); const postOff = !A('post').need(c); gyxSwitchAct('post', true);
  gyxSwitchOpen(); const t = document.getElementById('gyxSwOv').innerText; gyxSwitchOpen('act'); const t2 = document.getElementById('gyxSwOv').innerText; document.getElementById('gyxSwOv').remove();
  return { missing, before, offMini, offAct, autoOff, postOff, list: /涂鸦互传/.test(t) && /TA 会自己做/.test(t), acts: /发一条推文/.test(t2) };
});
check(`${tag} 每个新功能都在 TA 的自主行动里（15 件新事）`, !sw.missing.length, JSON.stringify(sw.missing));
check(`${tag} 功能开关中心：功能能整个关掉（入口也消失、TA 也不做）；也能只关「TA 自己做」；自主行动能一件件关`, sw.before && sw.offMini && sw.offAct && sw.autoOff && sw.postOff && sw.list && sw.acts, JSON.stringify(sw));
check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 500));
const p2 = await ctx.newPage(); await p2.route(/^https?:\/\//, r => r.abort());
await p2.goto(fileUrl(path.join(root, 'index.html'))); await p2.waitForFunction(() => window.__guyuBooted, { timeout: 20000 });
check(`${tag} 下次打开：开场代码在页面最开始就跑了（原来的开场让位）`, await p2.evaluate(() => window.__gyxIntroOwn === true && !!window.__gyxIntroLib));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
