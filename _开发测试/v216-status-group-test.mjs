// v216：💭 心声/身体/情绪词（接情绪惯性、关系账本、状态栏）· 📦 分模块备份 · 🫶 气泡表情回应 · 📝 TA 的备忘录
//       · 👑 群主/管理员/公告 · 👀 只围观的群 · 🧧 拼手气红包 · 🛠️ 报错分类 / JSON 修一次 / 约定≠已发生
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

await page.evaluate(({ PLUG, BAILU }) => {
  if (BAILU) window.__bailuNoBuiltin = true;
  myCharacters.length = 0;
  myCharacters.push({ id: 9991, name: '顾言', persona: '温柔的医生', worldbooks: [], actMode: 'fixed', diaryData: { letters: [], diaries: [] } },
    { id: 9992, name: '沈之遥', persona: '话多的摄影师', worldbooks: [], actMode: 'fixed', diaryData: { letters: [], diaries: [] } },
    { id: 9993, name: '林夏', persona: '冷淡的程序员', worldbooks: [], actMode: 'fixed', diaryData: { letters: [], diaries: [] } });
  const T = Date.now();
  globalChats['9991'] = [];
  for (let i = 0; i < 12; i++) globalChats['9991'].push({ sender: i % 2 ? 9991 : 'me', text: i % 2 ? '嗯嗯，我在听，今天下雨记得带伞' : (i === 10 ? '哈哈哈笑死我了，你好可爱' : '今天好累呀~'), timestamp: T - (12 - i) * 60000, readBy: [] });
  currentChatSessionId = '9991';
  autoFeatureSwitches.aliveMood = true; autoFeatureSwitches.aliveInner = true; autoFeatureSwitches.walletOn = true; autoFeatureSwitches.groupLucky = true;
  window.__saved = []; window.saveTextFileForApp = (name, text) => { window.__saved.push({ name, text }); };
  window.__prompts = [];
  if (!BAILU) {
    myApiUrl = 'https://x'; myApiKey = 'k'; myModel = 'm'; try { enableStreaming = false; } catch (e) {}
    window.getApiConfig = () => ({ url: 'https://x', key: 'k', model: 'm' });
    window.__mock = async (api, p) => {
      const s = typeof p === 'string' ? p : JSON.stringify(p);
      window.__prompts.push(s);
      let c = '好呀';
      if (/JSON 修复工具/.test(s)) c = '{"replies":[{"delay":1,"text":"修好了的话"}]}';
      else if (/只写给自己看的备忘录/.test(s)) c = JSON.stringify({ notes: [{ id: '', title: '给她买伞', content: '她老是不带伞，周末去商场挑一把轻一点的折叠伞，颜色要她喜欢的浅蓝色，放她包里。', state: 'todo' }], doodle: { title: '雨天', art: ' ☁️ ☁️\n / / /\n ☂️ ← 给你的', meaning: '今天说到下雨，画了把伞。' } });
      else if (/\{"replies"/.test(s) || /replies/.test(s)) c = JSON.stringify({ replies: [{ delay: 1, text: '我在群里说一句' }], stateUpdate: '在聊天', mood: 2, moodWhy: '她夸我', inner: '其实我想她想得要命，但不能说太快。', feel: { '胃': '空了一下午在抗议' }, moodWords: ['开心', '有点慌'] });
      return { choices: [{ message: { content: c } }] };
    };
    window.sendChatRequest = window.__mock;
  }
  PLUG.forEach(p => executePluginOnLoad(p));
}, { PLUG, BAILU });
await page.waitForFunction(() => typeof gyxReactOpen === 'function' && typeof gyxMemoOpen === 'function', { timeout: 10000 });
await page.waitForTimeout(1500);

// ===== 💭 心声 =====
const inn = await page.evaluate(() => {
  const c = myCharacters[0];
  const sw = AUTO_FEATURE_DEFS.find(f => f.key === 'aliveInner');
  const note = aliveMoodFormatNote();
  aliveCaptureMood(c, { mood: 2, moodWhy: '她夸我', inner: '其实想她想得要命。', feel: { '胃': '空了一下午在抗议', '眼皮': '在打架' }, moodWords: ['开心', '有点慌'] });
  const ctxT = getBoxPrompt(c);
  // 卡片自带的状态栏
  gyStatusLogAdd(myCharacters[1], { seg: '<status>心声：她怎么还不回我\n身体：肩膀：酸\n心情：烦躁</status>', src: 'chat' });
  const popup = gyInnerPopupHtml(c);
  showCharLifeStatePopup(c.id, null);
  const inBubble = !!document.querySelector('#charStatusBubble .gyinr-note');
  document.getElementById('charStatusBubble').style.display = 'none';
  gyInnerOpen(c.id); const pg = document.getElementById('gyInnerOv').innerText; document.getElementById('gyInnerOv').remove();
  const now = gyInnerNowRows(c);
  return { sw: !!(sw && sw.group === '活人感'), note: /"inner"/.test(note) && /"feel"/.test(note), t: c.inner && c.inner.t, feel: c.inner && c.inner.feel.length, words: c.inner && c.inner.words.join(','), ctx: /心里想的/.test(ctxT), card: myCharacters[1].inner && myCharacters[1].inner.t, cardSrc: myCharacters[1].inner && myCharacters[1].inner.src, popup: /心声/.test(popup) && /有点慌/.test(popup), inBubble, pg: /TA 的状态/.test(pg) && /想她想得要命/.test(pg) && /胃/.test(pg), now: /心声/.test(now) && /胃/.test(now), log: (c.innerLog || []).length };
});
check(`${tag} 心声：新开关在活人感组；打开后格式说明多要 inner/feel/moodWords${BAILU ? '（白露没有模型，不多要）' : ''}`, inn.sw && (BAILU ? !inn.note : inn.note), JSON.stringify(inn));
check(`${tag} 心声：每轮回复里的心声 / 身体 / 情绪词存在角色身上，下一轮悄悄注回去`, inn.t && inn.feel === 2 && inn.words === '开心,有点慌' && inn.ctx && inn.log >= 1, JSON.stringify(inn));
check(`${tag} 心声：角色卡自带状态栏里写的心声 / 身体也收下来`, inn.card === '她怎么还不回我' && inn.cardSrc === 'card', JSON.stringify(inn));
check(`${tag} 心声：单击头像的气泡里有心声便签；「TA 的状态」整页、「此刻」页都能看到`, inn.popup && inn.inBubble && inn.pg && inn.now, JSON.stringify(inn));

// ===== 📦 分模块备份 =====
const bk = await page.evaluate(async () => {
  gyModExportOpen(); const opts = document.querySelectorAll('#gyModOv input[data-m]').length; const apiChecked = document.querySelector('#gyModOv input[data-m="api"]').checked; document.getElementById('gyModOv').remove();
  const out = await gyModExportGo(['chars', 'chats', 'extra']);
  const file = JSON.parse(window.__saved[window.__saved.length - 1].text);
  // 改一下现在的数据：多一个角色、改主题、改聊天
  const theme0 = uiTheme;
  myCharacters.push({ id: 9999, name: '路人', worldbooks: [] }); globalChats['9991'].push({ sender: 'me', text: '这条是导出之后才说的', timestamp: Date.now() });
  const has = gyModImportOpen(file); document.getElementById('gyModOv').remove();
  const r = await gyModImportGo(['chars'], { noAsk: true });
  const afterChars = myCharacters.length, lastChat = globalChats['9991'][globalChats['9991'].length - 1].text;
  // 完整备份也认
  const full = getFullDataSnapshot(); const has2 = gyModImportOpen(full); document.getElementById('gyModOv').remove();
  return { opts, apiChecked, mods: file.mods, hasKey: 'myApiKey' in file.data, hasChars: Array.isArray(file.data.myCharacters), extra: !!file.__gyExtra, has, keys: r && r.nKeys, afterChars, lastChat, theme: uiTheme === theme0, has2 };
});
check(`${tag} 分模块备份：导出时可勾（默认不勾 API），只带勾的那几块`, bk.opts === 10 && !bk.apiChecked && bk.hasChars && !bk.hasKey && bk.extra, JSON.stringify(bk));
check(`${tag} 分模块备份：导入时只覆盖勾的（只勾角色：角色回到导出时，聊天还是现在的）`, bk.has.includes('chars') && bk.has.includes('chats') && bk.afterChars === 3 && /导出之后/.test(bk.lastChat) && bk.theme, JSON.stringify(bk));
check(`${tag} 分模块备份：完整备份文件也认得出各个模块`, bk.has2.length >= 7 && bk.has2.includes('api'), JSON.stringify(bk.has2));

// ===== 🫶 表情回应 =====
const rx = await page.evaluate(async () => {
  currentChatSessionId = '9991'; renderChatMessages();
  const L = globalChats['9991']; const i = L.length - 2;
  showChatContextMenu({ preventDefault() {}, pageX: 100, pageY: 100 }, i);
  const pick = document.querySelectorAll('#chatContextMenu .rx-pick button').length;
  gyxReactToggle(i, '❤️');
  const chip = document.querySelectorAll('#chatMessagesArea .rx-chip').length;
  // TA 在回复里贴
  const res = gyChatActsExtract('你今天也太可爱了吧[贴表情:🥰]', myCharacters[0], false);
  await new Promise(r => setTimeout(r, 500));
  const lastMe = [...L].reverse().find(m => m.sender === 'me');
  const ctx = window.__gyxCtxFor('9991');
  const strip = stripLeftoverMarkers('好的[贴表情:😂]');
  gyxReactOpen('9991'); const pnl = document.getElementById('gyxRxOv').innerText; document.getElementById('gyxRxOv').remove();
  return { pick, mine: (L[i].reacts || []).map(r => r.e).join(''), chip, text: res.text, ta: (lastMe.reacts || []).filter(r => r.who == 9991).map(r => r.e).join(''), ctx: /贴的表情/.test(ctx) && /❤️/.test(ctx), strip, pnl: /你贴的/.test(pnl) };
});
check(`${tag} 表情回应：长按菜单最上面一排表情，贴了显示在气泡下面`, rx.pick >= 8 && rx.mine === '❤️' && rx.chip >= 1, JSON.stringify(rx));
check(`${tag} 表情回应：TA 回复里的 [贴表情:🥰] 被摘掉，贴到你最后一句上；TA 看得到你贴了什么`, rx.text === '你今天也太可爱了吧' && rx.ta === '🥰' && rx.ctx && rx.strip === '好的' && rx.pnl, JSON.stringify(rx));

// ===== 📝 备忘录 =====
const mm = await page.evaluate(async () => {
  const r = await gyxMemoUpdate('9991');
  const b = gyxMemoData().m['9991'];
  gyxMemoOpen('9991', 'notes'); const t1 = document.getElementById('gyxTMemoOv').innerText;
  gyxMemoOpen('9991', 'doodles'); const t2 = document.getElementById('gyxTMemoOv').innerText; document.getElementById('gyxTMemoOv').remove();
  const ph = gyxMemoPhoneHtml(myCharacters[0]);
  const id = b.notes[0] && b.notes[0].id; if (id) await gyxMemoSet('9991', id, 'state', 'done');
  const ctx = window.__gyxCtxFor('9991');
  return { nNew: r && r.nNew, notes: b.notes.length, dd: b.doodles.length, t1: t1.length > 30, t2: /\n/.test(t2) || b.doodles.length === 0, ph: ph.length > 50, done: b.notes[0] && b.notes[0].state, ctx };
});
check(`${tag} TA 的备忘录：TA 自己写便签${BAILU ? '（白露用字卡 + 内置涂鸦）' : '（模型写 + 字符涂鸦）'}，能勾掉；TA 手机里的备忘录显示真内容`, (BAILU ? (mm.notes + mm.dd) >= 1 : (mm.nNew === 1 && mm.dd === 1)) && mm.t1 && mm.ph && (!mm.notes || mm.done === 'done'), JSON.stringify(mm));

// ===== 👑 群：群主 / 管理员 / 公告 =====
const gp = await page.evaluate(() => {
  groupChats.push({ id: 'g_t1', name: '周五饭搭子', members: [9991, 9992, 9993], speakOrder: 'all' }); globalChats['g_t1'] = [];
  gyGrpSet('g_t1', 'owner', 9992); gyGrpSet('g_t1', 'admin', [9991, true]); gyGrpSet('g_t1', 'notice', '周五七点老地方');
  const sysL = globalChats['g_t1'].filter(m => m.sender === 'system').map(m => m.text);
  const info = gyGroupInfoPrompt('g_t1', myCharacters[0]);
  openChatOptions('g_t1'); const box = document.getElementById('gyGrpPlusBox'); const bx = box ? box.innerText : ''; closeModal('chatTxtModal');
  return { sys: sysL.length, info, bx: /群主/.test(bx) && /管理员/.test(bx) && /群公告/.test(bx) };
});
check(`${tag} 群：群主 / 管理员 / 公告能设，群里留系统消息，每个成员回话时知道`, gp.sys === 3 && /周五饭搭子/.test(gp.info) && /沈之遥（群主）/.test(gp.info) && /你在这个群里是管理员/.test(gp.info) && /七点老地方/.test(gp.info) && gp.bx, JSON.stringify(gp));

// ===== 👀 只围观 =====
const ob = await page.evaluate(async () => {
  gyGrpSet('g_t1', 'observe', true);
  switchChatSession('g_t1'); await new Promise(r => setTimeout(r, 300));
  const bar = !!document.getElementById('gyObsBar');
  const n0 = globalChats['g_t1'].filter(m => m.sender !== 'system').length;
  window.__prompts.length = 0;
  const nb = window.__bailuNoBuiltin; window.__bailuNoBuiltin = false; try { if (typeof window.bailuAddBuiltin === 'function') await window.bailuAddBuiltin(); } catch (e) {}   // 白露：让成员用内置字卡说话
  let ok = false; for (let t = 0; t < 6 && globalChats['g_t1'].filter(m => m.sender !== 'system').length === n0; t++) ok = await gyGroupObserveTick('g_t1');
  window.__bailuNoBuiltin = nb;
  await new Promise(r => setTimeout(r, 2500));
  const n1 = globalChats['g_t1'].filter(m => m.sender !== 'system').length;
  const g = groupChats.find(x => x.id === 'g_t1');
  const pr = window.__prompts.join('\n');
  const info = gyGroupInfoPrompt('g_t1', myCharacters[0]);
  return { bar, grew: n1 > n0, muted: (g.mutedMembers || []).length, order: g.speakOrder, notTalkToUser: /不在这个群里/.test(info), pr: !window.__prompts.length || /不在这个群里/.test(pr) };
});
check(`${tag} 只围观的群：输入框换成「让他们接着聊」，点一下成员自己聊（之后禁言和发言顺序复原）`, ob.bar && ob.grew && ob.muted === 0 && ob.order === 'all' && ob.notTalkToUser && ob.pr, JSON.stringify(ob));

// ===== 🧧 拼手气红包 =====
const lk = await page.evaluate(async () => {
  gyGrpSet('g_t1', 'observe', false);
  const mo = await gyLuckySend('g_t1', 9991, 10, 3, '周五快乐');
  const a = await gyLuckyGrab(mo.id);
  const mine = mo.grabs.find(x => x.who === 'me');
  const sumOk = Math.abs(mo.grabs.reduce((s, x) => s + x.amt, 0) + (mo.left || []).reduce((s, x) => s + x, 0) - 10) < 0.001;
  const msg = globalChats['g_t1'].find(m => m.money && m.money.id === mo.id);
  const html = gyMoneyCardHtml(msg);
  // 角色在回复里发
  currentChatSessionId = 'g_t1';
  const r = gyChatActsExtract('大家周末快乐[拼手气红包:20|2|周末快乐]', myCharacters[1], true);
  await new Promise(r => setTimeout(r, 800));
  const second = globalChats['g_t1'].filter(m => m.money && m.money.kind === 'lucky').length;
  return { mine: !!mine, sumOk, text: /拼手气红包/.test(msg.text) && /已抢/.test(msg.text) && /你|我/.test(msg.text) !== undefined, html: /拼手气红包/.test(html) && /你抢到/.test(html), stripped: r.text, second };
});
check(`${tag} 拼手气红包：份额发出时分好，抢到多少写进聊天记录给大家看；角色回复里写标记也能发`, lk.mine && lk.sumOk && lk.text && lk.html && lk.stripped === '大家周末快乐' && lk.second === 2, JSON.stringify(lk));

// ===== 🛠️ 报错 / JSON / 约定 =====
const care = await page.evaluate(async () => {
  const e1 = enhanceNetworkErrorMessage('This model\'s maximum context length is 128000 tokens');
  const e2 = enhanceNetworkErrorMessage('HTTP 502: bad gateway');
  const e3 = enhanceNetworkErrorMessage('insufficient_quota');
  const c = myCharacters[0];
  const base = buildBasePrompt(c, false, '', {});
  const item = !!document.body && typeof gyClassifyApiError === 'function';
  let rep = null;
  if (typeof window.__mock === 'function') {
    window.sendChatRequest = window.__mock;
    const bad = { choices: [{ message: { content: '{"replies":[{"delay":1,"text":"他说"你好"呀"}]' } }] };
    rep = await gyRepairChatJson({ url: 'https://x', key: 'k', model: 'm' }, bad, c);
  }
  return { e1: /上下文太长/.test(e1), e2: /中转站到上游/.test(e2), e3: /余额/.test(e3), promise: /约定不等于已经发生/.test(base), item, rep: rep ? !!rep.__gyRepaired : null };
});
check(`${tag} 报错说人话：上下文太长 / 余额不够 这类按文字认出来，状态码那套照旧`, care.e1 && care.e2 && care.e3 && care.item, JSON.stringify(care));
check(`${tag} 「聊天里的约定≠已经发生」进了 prompt 骨架`, care.promise, JSON.stringify(care));
if (!BAILU) check(`${tag} 聊天回复 JSON 坏了：自动修一次`, care.rep === true, JSON.stringify(care));

// 自主行动不报错
const acts = await page.evaluate(async () => { const out = {}; for (const a of ['gyx_react', 'gyx_memo', 'group_lucky', 'group_observe_talk']) { const d = GY_AUTONOMY_ACTIONS.find(x => x.key === a); if (!d) { out[a] = '没有'; continue; } try { out[a] = d.need(myCharacters[0]) ? String(await d.run(myCharacters[0])) : '不需要'; } catch (e) { out[a] = 'ERR ' + e.message; } } return out; });
check(`${tag} 新的自主行动都在，跑起来不报错`, !Object.values(acts).some(v => /ERR|没有/.test(v)), JSON.stringify(acts));

check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
