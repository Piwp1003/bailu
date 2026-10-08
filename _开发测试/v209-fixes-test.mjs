// v209：这一轮的修复和新东西——开场预览、钱包闪、语音拉取模型 + 三种语音条、选文件/文件夹、TA 每天重想节奏、
//       白露一万条字卡 + 批量改组、桌面上的 TA（立绘按情绪、点一下理 TA、右键菜单）、记忆总览收插件、
//       小功能整理（分组 / 合并 / 设置类挪走）、换个世界、神秘学加量
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
  if (/\/models$/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'gpt-4o' }, { id: 'tts-1' }, { id: 'tts-1-hd' }, { id: 'FunAudioLLM/CosyVoice2-0.5B' }] }) });
  if (/audio\/voice\/list/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: [{ uri: 'speech:my-voice:abc', customName: '我克隆的声音' }] }) });
  return r.abort();
});
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && typeof executePluginOnLoad === 'function' && window.__gyPmW, { timeout: 20000 });
await page.waitForTimeout(1500);
const tag = BAILU ? '[白露]' : '[谷雨]';

// 💸 钱包不再狂闪：页面静着的时候 DOM 不该一直在变
const idle = await page.evaluate(async () => { let n = 0; const mo = new MutationObserver(m => { n += m.filter(x => x.type === 'childList').length; }); mo.observe(document.body, { childList: true, subtree: true }); gyWalletPanel(); await new Promise(r => setTimeout(r, 2500)); mo.disconnect(); return n; });
check(`${tag} 钱包页不再一直重画（之前有个改目录文字→触发自己的循环，2.5 秒几百次）`, idle < 40, 'childList 变化 ' + idle);

await page.evaluate(({ PLUG, BAILU }) => {
  myCharacters.length = 0;
  myCharacters.push({ id: 9991, name: '顾言', persona: '温柔的医生', worldbooks: [], actMode: 'fixed', diaryData: { letters: [], diaries: [] } }, { id: 9992, name: '沈之遥', worldbooks: [], actMode: 'auto', diaryData: { letters: [], diaries: [] } });
  globalChats['9991'] = [{ sender: 9991, text: '哈哈今天好开心', timestamp: Date.now() - 400000 }]; globalChats['9992'] = [];
  window.__sent = []; window.sendProactiveChatMessage = async c => { window.__sent.push(c.id); };
  window.__asks = 0;
  if (!BAILU) {
    window.getApiConfig = () => ({ url: 'https://x', key: 'k', model: 'm' });
    const old = window.sendChatRequest;
    window.sendChatRequest = async (api, p) => {
      let c = '好呀';
      if (/点了你一下/.test(p)) c = JSON.stringify({ say: '嗯？想我了？', mood: '害羞' });
      else if (/换个世界/.test(p) && /JSON/.test(p)) c = JSON.stringify({ f: { 学院: '拉文克劳', 年级: '六年级', 魔杖: '雪松木·凤凰羽毛', 守护神: '雪鸮' }, why: '我大概会是拉文克劳吧，喜欢安静看书。' });
      else if (/番外小剧场/.test(p)) c = '大礼堂的蜡烛悬在半空，他把一本旧书推到你面前……';
      else if (/帮她解读/.test(p)) c = '这张牌是说你最近太累了，先休息。';
      return { choices: [{ message: { content: c } }] };
    };
    window.callChatCompletionAPI = async (api, msgs) => { window.__asks++; const p = JSON.stringify(msgs); const keys = [...p.matchAll(/- ([a-z_0-9]+)：/g)].map(m => m[1]); const o = {}; keys.forEach((k, i) => { o[k] = { n: i === 0 ? 0 : 300, why: '想到就做' }; }); window.__habKeys = keys; return { choices: [{ message: { content: JSON.stringify(o) } }] }; };
    try { autoFeatureSwitches.charAutonomy = true; } catch (e) {}
  }
  try { speechSynthesis.speak = u => { setTimeout(() => u.onend && u.onend(), 20); }; } catch (e) {}
  PLUG.forEach(p => executePluginOnLoad(p));
}, { PLUG, BAILU });
await page.waitForTimeout(2500);

// 🎬 开场预览
const intro = await page.evaluate(async () => { gyxIntroOpen(); const fns = ['gyxIntroSet', 'gyxIntroPick', 'gyxIntroAll', 'gyxIntroCat', 'gyxIntroSrc', 'gyxIntroPreview'].filter(f => typeof window[f] !== 'function'); gyxIntroAll(0); gyxIntroPick(Object.keys(window.__gyxIntroLib.styles)[2]); const k = gyxIntroPreview(); await new Promise(r => setTimeout(r, 300)); const shown = !!document.getElementById('gyxIntro'); document.getElementById('gyxIntro')?.remove(); document.getElementById('gyxInOv')?.remove(); return { fns, k, shown }; });
check(`${tag} 开场动画：▶ 预览、勾选、全选全不选都能用了（之前这几个函数丢了，点了没反应）`, !intro.fns.length && intro.shown, JSON.stringify(intro));

// 📂 选文件：点开时 accept 补上「什么都能选」
const fa = await page.evaluate(async () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,.txt'; document.body.appendChild(i); i.addEventListener('click', e => e.preventDefault()); i.click(); const a = i.accept; const j = document.createElement('input'); j.type = 'file'; j.accept = 'image/*'; document.body.appendChild(j); j.addEventListener('click', e => e.preventDefault()); j.click(); const b = j.accept; i.remove(); j.remove(); gyFolderOpen(); await new Promise(r => setTimeout(r, 400)); const t = document.getElementById('gyFolderModal').innerText; document.getElementById('gyFolderModal').remove(); return { a, b, panel: /连接文件夹|不支持直接读写/.test(t), entry: GY_MINI_FEATURES.some(f => f.id === 'folder') }; });
check(`${tag} 手机选文件：只写了扩展名的上传框点开时能选任何文件，图片框不动；「📂 手机文件夹」页面在`, /\*\/\*/.test(fa.a) && fa.b === 'image/*' && fa.panel && fa.entry, JSON.stringify(fa));

if (!BAILU) {
  // 🎙️ 拉取模型 / 音色 + 三种语音条
  const vo = await page.evaluate(async () => { gyVoiceOpen && gyVoiceOpen(); await gyVoiceSetProv('def', 'openai'); await gyVoiceSetF('def', 'url', 'https://api.siliconflow.cn/v1/audio/speech'); await gyVoiceSetF('def', 'key', 'sk-x'); await gyVoiceSetF('def', 'model', ''); await gyVoicePull('def', 'model'); const dl = document.querySelector('datalist[id^="gyvoDL_def_model"]'); const models = dl ? [...dl.options].map(o => o.value) : []; await gyVoicePull('def', 'voice'); const dv = document.querySelector('datalist[id^="gyvoDL_def_voice"]'); const voices = dv ? [...dv.options].map(o => o.value) : []; return { models, voices, pullBtns: document.querySelectorAll('.gyvo-pull').length }; });
  check(`${tag} 语音模型：能「⟳ 拉取模型」和「拉取音色」，下拉里挑（TTS 的排前面）`, vo.models[0] && /tts|Cosy/i.test(vo.models[0]) && vo.voices.includes('speech:my-voice:abc') && vo.pullBtns >= 2, JSON.stringify(vo));
  const vb = await page.evaluate(async () => { document.querySelectorAll('.gyvo-ov,#gyVoOv,.gyvo-wrap').forEach(e => e.remove()); globalChats['9991'].push({ sender: 9991, text: '[语音] 想你了', timestamp: Date.now() }); switchMainView('chat'); switchChatSession(9991); const out = {}; for (const st of ['wx', 'wave', 'pill']) { await gyVoiceStyle(st); renderChatMessages(); const b = document.querySelector('.gyvc .gyvc-bar'); out[st] = b ? b.className : ''; } return out; });
  check(`${tag} 语音条：微信款 / 声波条 / 胶囊播放器三种，设置里切换`, /s-wx/.test(vb.wx) && /s-wave/.test(vb.wave) && /s-pill/.test(vb.pill), JSON.stringify(vb));
  // 🔁 TA 每天重想一遍自己的节奏；从没做过的也能排出下一次
  const hb = await page.evaluate(async () => { const c = myCharacters[1]; window.__asks = 0; await gyTaEnsureHabits(); const a1 = window.__asks; await gyTaEnsureHabits(); const a2 = window.__asks; const k2 = (window.__habKeys || [])[1]; const h = c.taHabit && c.taHabit.m && c.taHabit.m[k2]; const ready = k2 ? gyTaActReady(c, k2, false) : null; const rh = (gyTaRhythm(c) || []).find(r => r.act === k2); return { a1, a2, keys: (window.__habKeys || []).length, day: c.taHabit && c.taHabit.day, ms: h && h.ms, readyIsBool: typeof ready === 'boolean', next: rh && rh.next, first: rh && rh.first }; });
  check(`${tag} TA 的节奏：每天自己重新想一遍（一天只问一次），从没做过的也从定下来那天开始算`, hb.a1 === 1 && hb.a2 === 1 && hb.day && hb.ms === 300 * 60000 && hb.readyIsBool && hb.next > Date.now() && hb.first, JSON.stringify(hb));
} else {
  // 🃏 白露：一万条内置字卡 + 批量改组
  const bc = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 1500)); const g = bailuCards.groups.find(x => /内置字卡/.test(x.name)); const n = g ? bailuCards.cards.filter(c => c.g === g.id).length : 0; const uniq = new Set(bailuCards.cards.filter(c => g && c.g === g.id).map(c => c.t)).size; bailuOpen(); bailuMulti(1); bailuF && bailuF('g', g.id); bailuSelAll(); const sel = document.querySelector('.bl-batch-on b').textContent; await bailuBatch('kind', '聊天'); const changed = bailuCards.cards.filter(c => c.g === g.id && c.kinds[0] === '聊天').length; await bailuBatch('kind', '通用'); bailuSelNone(); bailuMulti(0); document.getElementById('bailuOv').remove(); return { n, uniq, sel, changed }; });
  check(`${tag} 一万多条内置字卡（不重复、全是通用），能多选批量改类型 / 分组`, bc.n >= 10000 && bc.uniq === bc.n && bc.changed === bc.n, JSON.stringify(bc));
}

// 🧸 桌面上的 TA：立绘按情绪、点一下理 TA、右键菜单
const pet = await page.evaluate(async () => {
  const png = c => { const cv = document.createElement('canvas'); cv.width = cv.height = 8; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 8, 8); return cv.toDataURL(); };
  gyxPetSet('who', '9991'); const f = (n, c) => new File([Uint8Array.from(atob(png(c).split(',')[1]), x => x.charCodeAt(0))], n, { type: 'image/png' });
  await new Promise(r => { gyxPetAddImgs('9991', { files: [f('默认.png', '#888'), f('害羞.png', '#f9c')] }); setTimeout(r, 600); });
  const n = (document.querySelectorAll('.pt-im').length);
  const before = globalChats['9991'].length;
  const say = await gyxPetPoke();
  await new Promise(r => setTimeout(r, 200));
  const img = document.querySelector('#gyxPetA img'); const bub = document.getElementById('gyxPetB').textContent;
  document.getElementById('gyxPet').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 300, clientY: 300 }));
  const menu = document.getElementById('gyxPetMenu') ? document.getElementById('gyxPetMenu').innerText : '';
  document.getElementById('gyxPetMenu')?.remove(); document.getElementById('gyxPetOv')?.remove();
  return { n, say, bub, chat: globalChats['9991'].length - before, img: img ? img.src.slice(0, 30) : '', menu };
});
check(`${tag} 桌面上的 TA：能传好几张立绘标情绪；点一下＝理 TA，TA 当场回你（也进聊天）；右键有「返回项目」`, pet.n === 2 && pet.say && pet.bub && pet.chat >= 1 && /^data:image/.test(pet.img) && /返回项目/.test(pet.menu) && /理 TA/.test(pet.menu), JSON.stringify(pet));

// 🎭 换个世界
const th = await page.evaluate(async () => { const r = await gyxTheaterNew({ world: 'hp', cids: ['9991'], me: true }); const card = r.cards['9991'].f; await gyxTheaterGo(r.id, '我举手问他这本书哪来的'); const t = document.getElementById('gyxThOv').innerText; document.getElementById('gyxThOv')?.remove(); return { card, scenes: r.scenes.length, house: !!card['学院'], hasCard: /学院/.test(t) }; });
check(`${tag} 换个世界：TA 保持人设进哈利波特，出设定卡（学院、年级、魔杖、守护神……），能接着演`, th.house && th.scenes >= 3 && th.hasCard, JSON.stringify(th));

// 🔮 神秘学加量
const my = await page.evaluate(async () => { const W = window.__gyPmW.WD, ks = Object.keys(W).filter(k => /^gyxMy_/.test(k)); const x = await gyxMysticDo('tarot3'); const h = W.gyxMy_tarot3.r({ id: 't', k: 'gyxMy_tarot3', size: 'm', d: {} }); const mo = W.gyxMy_moon.r({ id: 't2', k: 'gyxMy_moon', size: 's', d: {} }); return { n: ks.length, cards: x.cs.length, h: /my-card/.test(h), moon: /新月|月|盈|亏|弦/.test(mo) }; });
check(`${tag} 神秘学加量：塔罗、月相、水晶球、天使数字、花语、守护动物、月老灵签……都是小手机小组件（${my.n} 个）`, my.n >= 14 && my.cards === 3 && my.h && my.moon, JSON.stringify(my));

// 🧠 记忆总览：插件记下的东西都在「其它记忆」里，能改能删
const mem = await page.evaluate(async () => { const ks = gyMemExList(); return { n: ks.filter(k => /^gyx/.test(k)).length, has: ['gyxTheater', 'gyxSecret', 'gyxPromise', 'gyxShow', 'gyxDream'].filter(k => !ks.includes(k)) }; });
check(`${tag} 记忆总览：插件的记忆都登记进「🧩 其它记忆」（${mem.n} 节，能改能删）`, mem.n >= 20 && !mem.has.length, JSON.stringify(mem));

// 🧩 小功能整理
const hub = await page.evaluate(async () => {
  switchMainView('settings'); await new Promise(r => setTimeout(r, 300));
  const list = () => { renderMiniFeaturePanel(); return [...document.querySelectorAll('#miniFeatureList .set-entry')].map(b => b.textContent); };
  if (!document.getElementById('miniFeatureList')) { const d = document.createElement('div'); d.id = 'miniFeatureList'; document.body.appendChild(d); }
  const all = list().join('|');
  const hidden = ['TA 的相册', '一起旅行', '纪念日惊喜', '一起存钱罐', 'TA 的声音', '功能开关中心'].filter(t => all.includes(t));
  const tabs = document.querySelectorAll('.gyhub-tabs span').length;
  gyHubTab('陪伴'); const pei = list().join('|'); gyHubTab('all');
  gyGalleryOpen(); await new Promise(r => setTimeout(r, 1000)); const gal = (document.querySelector('#gyGalModal .gyhub-in') || {}).innerText || ''; gyGalleryClose();
  gydayOpen && gydayOpen(); await new Promise(r => setTimeout(r, 1000)); const day = (document.querySelector('#gydayModal .gyhub-in') || {}).innerText || ''; gydayClose && gydayClose();
  gymapOpen(); await new Promise(r => setTimeout(r, 1000)); const map = (document.querySelector('#gymapModal .gyhub-in') || {}).innerText || ''; gymapClose();
  const setE = [...document.querySelectorAll('#setIndex [data-gyhub] .set-entry-title')].map(e => e.textContent);
  gyHubSet(false); await new Promise(r => setTimeout(r, 900)); const flat = list().join('|'); const setOff = document.querySelectorAll('#setIndex [data-gyhub]').length; gyHubSet(true);
  return { hidden, tabs, pei: /桌面上的 TA/.test(pei) && !/音乐盒/.test(pei), gal, day, map, setE, flatHas: /TA 的相册/.test(flat) && /一起旅行/.test(flat), setOff };
});
check(`${tag} 小功能整理：分组标签；照片进图库、早安/旅行进行程与天气、日子类进我们的日子、钱进钱包、设置类挪去设置；关掉开关回到平铺`, !hub.hidden.length && hub.tabs === 5 && hub.pei && /TA 的相册/.test(hub.gal) && /纪念日惊喜/.test(hub.day) && /一起旅行/.test(hub.map) && hub.setE.length >= 3 && hub.flatHas && hub.setOff === 0, JSON.stringify(hub));

check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
