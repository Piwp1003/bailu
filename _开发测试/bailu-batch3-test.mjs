// 白露第三批：字卡条件（时间/周末/心情）、关键词触发、每个角色单独一套概率、按角色导出、语音库、图片默认走图库
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.accept());
await page.route(/^https?:\/\//, r => r.abort());
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && window.bailuCards && window.__bailuPlayLoaded && window.bailuMoodOf, { timeout: 20000 });
await page.waitForTimeout(1500);

// 当前时段（和引擎用同一张表），好写一张「此刻一定满足」的卡
const slot = await page.evaluate(() => { const h = new Date().getHours(); return h + '点-' + ((h + 1) % 24) + '点'; });   // 用「几点到几点」，不受时段边界影响
const parsed = await page.evaluate(async (slot) => {
  myCharacters.length = 0;
  myCharacters.push({ id: 9601, name: '顾言', worldbooks: [], diaryData: { letters: [], diaries: [] } }, { id: 9602, name: '沈之遥', worldbooks: [], diaryData: { letters: [], diaries: [] } });
  globalChats['9601'] = []; globalChats['9602'] = [];
  window.bailuOpen();
  window.bailuImp('mode', 'replace'); window.appConfirm = async () => true;
  document.getElementById('bailuPaste').value = [
    '#类型:聊天 角色:顾言', '平常的一句', '平常的第二句', '平常的第三句', '平常的第四句',
    `{if ${slot}}此刻才说的话`,
    '{if 周末 工作日}永远不会说的话',
    '{关键词 累 困}累了就去睡，我陪你。',
    '#类型:聊天 角色:顾言 条件:我心情:难过', '别难过，我在。',
    '#类型:聊天 角色:沈之遥', '沈之遥的一句', '沈之遥的第二句'
  ].join('\n');
  await window.bailuPaste(); window.bailuImp('mode', 'add');
  const cs = window.bailuCards.cards;
  const k = cs.find(c => /陪你/.test(c.t)), s = cs.find(c => /此刻/.test(c.t));
  return { n: cs.length, keys: k && k.keys, cond: s && s.cond, txt: k && k.t };
}, slot);
check('字卡里能写 {if …} 条件、{关键词 …}，读进来之后字卡本身干干净净', parsed.n === 10 && JSON.stringify(parsed.keys) === '["累","困"]' && parsed.cond && parsed.cond[0] === slot && parsed.txt === '累了就去睡，我陪你。', JSON.stringify(parsed));

const hdr = await page.evaluate(async () => { window.bailuImp('mode', 'add'); document.getElementById('bailuPaste').value = '#类型:聊天|推文 角色:顾言 条件:晚上|深夜\n还不睡？'; await window.bailuPaste(); const c = window.bailuCards.cards.find(x => x.t === '还不睡？'); const r = { kinds: c.kinds, chars: c.chars, cond: c.cond }; window.bailuCards.cards.splice(window.bailuCards.cards.indexOf(c), 1); return r; });
check('标签行里「条件:晚上|深夜」整个算一个条件（不会把「深夜」当成角色名）', JSON.stringify(hdr) === JSON.stringify({ kinds: ['聊天', '推文'], chars: ['顾言'], cond: ['晚上|深夜'] }), JSON.stringify(hdr));

const ask = (said) => `沈之遥\n【⚠️最新消息 - 请务必围绕这些来回复】：\n我：${said}\n\n请用 JSON：{"replies":[{"delay":1,"text":"..."}]}`;
const runs = async (said, n, who) => page.evaluate(({ p, n, who }) => {
  const out = []; const ch = myCharacters.find(c => c.name === who);
  for (let i = 0; i < n; i++) { window.__bl_last = ch; const v = JSON.parse(bailuAnswer(p.replace('沈之遥', who), 'at triggerAIBatchReply')); v.replies.forEach(r => out.push(r.text)); }
  return out;
}, { p: ask(said), n, who });
await page.evaluate(() => Object.assign(window.bailuCards.cfg, { emojiP: 0, stickerP: 0, quoteP: 0, pokeP: 0, silence: 0, keyP: 100, condP: 0 }));

let r = await runs('今天真的好累', 20, '顾言');
check('你说到关键词（累）：TA 用那张字卡回', r.every(t => /陪你/.test(t)), JSON.stringify(r.slice(0, 5)));
r = await runs('今天天气不错', 80, '顾言');
check('没说到关键词：那张字卡不会冒出来', !r.some(t => /陪你/.test(t)), JSON.stringify(r.filter(t => /陪你/.test(t))));
check('条件满足不了的字卡（又要周末又要工作日）永远不用', !r.some(t => /永远不会/.test(t)));
check('条件没满足的（我心情:难过，今天没记）不用', !r.some(t => /别难过/.test(t)));
await page.evaluate(() => { window.bailuCards.cfg.condP = 100; });
r = await runs('今天天气不错', 20, '顾言');
check('此刻满足条件的字卡优先（condP 拉满时每次都是它）', r.every(t => /此刻才说/.test(t)), JSON.stringify(r.slice(0, 5)));

// 心情条件：记一笔「难过」，那张就能用了
await page.evaluate(async () => { await window.bailuPlay('mood'); const d = new Date(); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); bailuMoodDay(k); bailuMoodSet(k, '委屈'); await bailuMoodSave(k); document.getElementById('bailuPlayOv').remove(); });
const mood = await page.evaluate(() => { const c = window.bailuCards.cards.find(x => /别难过/.test(x.t)); c.cond = ['我心情:委屈']; return window.bailuMoodOf(myCharacters[0]); });
r = await runs('今天天气不错', 30, '顾言');
check('心情条件：你今天记了「委屈」，「别难过」那张就会用到', mood.me === '委屈' && r.some(t => /别难过/.test(t)), JSON.stringify({ mood, r: r.slice(0, 6) }));
check('认不出的条件会被标出来（比如「下雨」）', await page.evaluate(() => !window.bailuCondKnown('下雨') && window.bailuCondKnown('晚上|深夜') && window.bailuCondKnown('22点-2点') && window.bailuCondKnown('我心情:累')));

// ---- 每个角色单独一套概率 ----
await page.evaluate(async () => { window.bailuCards.cfg.condP = 0; window.bailuCfgScope('顾言'); await window.bailuCfg('w1', '0'); await window.bailuCfg('w2', '100'); await window.bailuCfg('w3', '0'); window.bailuCfgScope(''); });
const cnt = await page.evaluate(() => {
  const count = who => { const out = {}; for (let i = 0; i < 60; i++) { const n = JSON.parse(bailuAnswer(`${who}\n请用 JSON：{"replies":[{"delay":1,"text":"..."}]}`, 'at triggerAIBatchReply')).replies.length; out[n] = (out[n] || 0) + 1; } return out; };
  return { gu: count('顾言'), shen: count('沈之遥') };
});
check('单独给顾言调成「每次回两条」：顾言回两条，沈之遥还是跟着全局走', cnt.gu[2] === 60 && (cnt.shen[1] || 0) > 30, JSON.stringify(cnt));
check('字卡库里单独调过的项是标出来的', await page.evaluate(() => { window.bailuCfgScope('顾言'); const n = document.querySelectorAll('#bailuOv .bl-cfg.own').length; window.bailuCfgScope(''); return n === 3; }));

// ---- 按角色导出 ----
const ex = await page.evaluate(() => { window.saveTextFileForApp = () => {}; window.bailuF('char', '沈之遥'); const t = window.bailuExportShown(); window.bailuF('char', ''); const t2 = (() => { window.bailuF('char', '顾言'); const x = window.bailuExportShown(); window.bailuF('char', ''); return x; })(); return { shen: JSON.parse(t), gu: JSON.parse(t2) }; });
check('按角色导出：只有这个人的字卡', ex.shen.length === 2 && ex.shen.every(c => c.角色.includes('沈之遥')), JSON.stringify(ex.shen));
check('导出带着条件和关键词，导回来还是一样', ex.gu.some(c => c.关键词 && c.关键词.includes('累')) && ex.gu.some(c => c.条件), JSON.stringify(ex.gu.slice(-3)));

// ---- 语音库 ----
const voice = await page.evaluate(async () => {
  window.bailuCards.cfg.voiceP = 100;
  const wav = new Uint8Array([82,73,70,70,36,0,0,0,87,65,86,69,102,109,116,32,16,0,0,0,1,0,1,0,64,31,0,0,64,31,0,0,1,0,8,0,100,97,116,97,0,0,0,0]);
  const mk = n => new File([wav], n, { type: 'audio/wav' });
  document.querySelector('#bailuOv details[ontoggle]').open = true; await new Promise(r => setTimeout(r, 200));
  document.getElementById('bailuVoiceChar').value = '顾言';
  await window.bailuVoiceUpload({ files: [mk('晚安.wav'), mk('笑.wav')], value: '' });
  const box = document.getElementById('bailuVoiceBox').innerText;
  const a = await window.bailuVoice(myCharacters[0], '随便说点');
  const b = await window.bailuVoice(myCharacters[1], '随便说点');
  return { box: /共 2 段/.test(box), a: !!a && /^blob:/.test(a), b };
});
check('语音库：上传两段顾言的声音', voice.box, JSON.stringify(voice));
check('打电话时顾言说话会放他的声音；沈之遥没有就不放', voice.a && voice.b === null, JSON.stringify(voice));

// ---- 图片：默认从图库挑 ----
check('TA 发图默认走图库（不接 API）', await page.evaluate(() => window.gyPhotoModeOf('9601') === 'bank'));

// ---- 🩸 经期：字卡条件「经期」+ 头一次记经期自动加一组「经期关心」 ----
const pr = await page.evaluate(async () => {
  window.sendProactiveChatMessage = async () => {};
  await gyPeriodStart(); await new Promise(r => setTimeout(r, 400));
  window.bailuCards.cards.forEach(x => { if (/此刻|别难过/.test(x.t)) x.off = true; });   // 顾言专属的带条件字卡会更优先，先停掉
  const c = window.bailuCards.cards.filter(x => (x.cond || []).includes('经期'));
  Object.assign(window.bailuCards.cfg, { condP: 100, emojiP: 0, stickerP: 0, quoteP: 0, pokeP: 0, silence: 0 });
  const out = []; for (let i = 0; i < 10; i++) JSON.parse(bailuAnswer('顾言\n请用 JSON：{"replies":[{"delay":1,"text":"..."}]}', 'at triggerAIBatchReply')).replies.forEach(r => out.push(r.text));
  return { n: c.length, known: window.bailuCondKnown('经期') && window.bailuCondKnown('经期快到'), hits: out.filter(t => c.some(x => x.t === t)).length, all: out.length };
});
check('经期：头一次记就加了一组「经期关心」字卡，经期里 TA 优先用它们', pr.n >= 8 && pr.known && pr.hits === pr.all, JSON.stringify(pr));

check('整个过程没有页面报错', errs.length === 0, errs.join(' | ').slice(0, 400));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
