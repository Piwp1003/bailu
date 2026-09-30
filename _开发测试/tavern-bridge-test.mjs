// 验证「助手脚本兼容层」：角色卡自带的开场白菜单 / 操作栏，在白露里能不能真的用起来。
//
// 用真实角色卡的正则脚本（成人游乐园那张会明确检查 triggerSlash，检查不到就弹
// 「环境未配置助手脚本」），跑完整链路：
//   1. 卡片脚本能不能拿到 TavernHelper / setChatMessages / getChatMessages
//   2. getChatMessages("0") 能不能读到这个角色的开场白列表
//   3. 点开场白菜单（setChatMessages 换 swipe）能不能真的把续写的开场换掉
//   4. triggerSlash('/echo ...') 会不会把提示弹出来
//
// 用法：node _test/tavern-bridge-test.mjs
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok, extra });

const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=v;return Promise.resolve(v)},getItem(k){return Promise.resolve(this._d[k]??null)},removeItem(k){delete this._d[k];return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));
await page.route('**fonts.googleapis.com**', r => r.abort());
// generate() 要真的发请求，给个假后端
await page.route('**/chat/completions', async route => {
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
  const reply = '雨还在下，他终于抬起头。';
  if (body.stream) {
    const sse = reply.match(/[\s\S]{1,8}/g)
      .map(c => 'data: ' + JSON.stringify({ choices: [{ delta: { content: c } }] }) + '\n\n').join('') + 'data: [DONE]\n\n';
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  }
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: reply } }] }) });
});

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted === true, { timeout: 20000 });

// —— 造一个带多个开场白的角色 + 一段续写 ——
// 开场白菜单是一整页 HTML，点条目就调 setChatMessages([{message_id:0, swipe_id:N}])，
// 跟真实角色卡（闻述/沈映寒/霍樊/高山仰止）里的写法完全一致。
await page.evaluate(() => {
  myCharacters.push({
    id: 5001, name: '试验体', persona: '测试用', worldbooks: [],
    firstMessage: '开场一：他站在门口。',
    alternateGreetings: ['开场二：她先开口了。', '开场三：雨下得很大。'],
  });
  regexScripts.length = 0;
  regexScripts.push({
    id: 'rx_menu', name: '开场白菜单', find: '【菜单】', isRegex: true, flags: 'g',
    target: 'ai_output', enabled: true, displayOnly: true, promptOnly: false,
    minDepth: null, maxDepth: null, charScope: ['5001'],
    replace: '```html\n<!DOCTYPE html>\n<html><head><meta charset="utf-8"></head><body>\n' +
      '<div id="menu"></div>\n' +
      '<div id="diag"></div>\n' +
      '<script>\n' +
      'var diag = document.getElementById("diag");\n' +
      'if (typeof triggerSlash !== "function") {\n' +
      '  diag.textContent = "环境未配置助手脚本";\n' +
      '} else {\n' +
      '  diag.textContent = "OK";\n' +
      '  var msgs = getChatMessages("0", {include_swipes:true});\n' +
      '  window.__probeSwipes = (msgs && msgs[0] && msgs[0].swipes) || [];\n' +
      '  window.__probeCurrent = (msgs && msgs[0] && msgs[0].swipe_id);\n' +
      '  window.__probeHelper = !!window.TavernHelper;\n' +
      '  var box = document.getElementById("menu");\n' +
      '  window.__probeSwipes.forEach(function(t, i){\n' +
      '    var b = document.createElement("button");\n' +
      '    b.id = "g" + i; b.textContent = t;\n' +
      '    b.onclick = function(){ setChatMessages([{message_id:0, swipe_id:i}]); };\n' +
      '    box.appendChild(b);\n' +
      '  });\n' +
      '}\n' +
      '<\/script>\n</body></html>\n```',
  });
  storySessions = [{
    id: 'ss_bridge', title: '桥接测试', outline: '', extraChars: '',
    chars: [5001], wordCount: 300, secondPerson: false, maxHistory: 20, apiMode: 'main',
    turns: [{ id: 't_open', role: 'ai', charId: 5001, timestamp: Date.now(),
              text: '【菜单】', fromGreeting: true, greetingIndex: 0 }],
    chapters: [], createdAt: Date.now(), updatedAt: Date.now(),
  }];
  currentStorySessionId = 'ss_bridge';
  myApiUrl = 'https://api.test.local/v1'; myApiKey = 'sk-test'; myModel = 'gpt-test';
  subApiUrl = ''; subApiKey = ''; subModel = '';
  switchMainView('storyStudio');
  openStorySession('ss_bridge');
});
await page.waitForTimeout(1800);

const frame = page.frames().find(f => f !== page.mainFrame());
check('开场白菜单渲染成了 iframe', !!frame);

const diag = frame ? await frame.evaluate(() => document.getElementById('diag')?.textContent) : null;
check('卡片不再报「环境未配置助手脚本」', diag === 'OK', '卡片里显示的是: ' + diag);

const api = frame ? await frame.evaluate(() => ({
  helper: !!window.TavernHelper,
  set: typeof window.setChatMessages,
  get: typeof window.getChatMessages,
  slash: typeof window.triggerSlash,
  curId: typeof window.getCurrentMessageId,
})) : {};
check('TavernHelper 和几个裸函数都在',
  api.helper && api.set === 'function' && api.get === 'function' &&
  api.slash === 'function' && api.curId === 'function', JSON.stringify(api));

const swipes = frame ? await frame.evaluate(() => window.__probeSwipes) : null;
check('getChatMessages 读到了这个角色全部 3 个开场白',
  Array.isArray(swipes) && swipes.length === 3 && swipes[0].includes('开场一'),
  JSON.stringify(swipes));

const cur = frame ? await frame.evaluate(() => window.__probeCurrent) : null;
check('当前用的是第几个开场白也对得上', cur === 0, '拿到的是 ' + cur);

// —— 没实现的接口不能把卡片搞崩 ——
// 注意要在"点菜单换开场白"之前做：换完之后新的开场白里没有菜单，iframe 就没了。
const safe = frame ? await frame.evaluate(() => {
  try {
    const v = window.getVariables();
    window.eventOn('x', () => {});
    return { ok: true, v: JSON.stringify(v) };
  } catch (e) { return { ok: false, err: e.message }; }
}) : {};
check('没实现的接口调了也不报错（卡片不会整张崩掉）', safe.ok, JSON.stringify(safe));

// —— 点菜单第 3 项，看续写的开场有没有真的换掉 ——
const beforeText = await page.evaluate(() => storySessions[0].turns[0].text);
await frame.locator('#g2').click();
await page.waitForTimeout(900);
const after = await page.evaluate(() => ({
  count: storySessions[0].turns.length,
  first: storySessions[0].turns[0].text,
  idx: storySessions[0].turns[0].greetingIndex,
  fromGreeting: storySessions[0].turns[0].fromGreeting,
}));
check('点菜单能把开场换成第 3 个开场白', after.first.includes('雨下得很大'),
  `换之前: ${beforeText.slice(0, 20)} / 换之后: ${after.first.slice(0, 30)}`);
check('是「换掉」不是「又追加一条」', after.count === 1, '现在有 ' + after.count + ' 轮');
check('换完之后开场还排在第一位，序号也记下来了',
  after.fromGreeting === true && after.idx === 2, JSON.stringify(after));

// —— triggerSlash 的提示 ——
const toast = await page.evaluate(async () => {
  window.__toastSeen = null;
  const orig = window.showToast;
  window.showToast = (a, t, c) => { window.__toastSeen = c; };
  // triggerSlash 现在支持 | 串多条命令，所以是异步的，要 await
  const r = await window.gyTavernBridge.triggerSlash('/echo severity=info 已切换到旋转木马');
  window.showToast = orig;
  return { ok: r && r.ok, text: window.__toastSeen };
});
check('triggerSlash(/echo) 会弹提示，并且把 severity= 参数剥掉',
  toast.ok && toast.text === '已切换到旋转木马', JSON.stringify(toast));


// ================= 楼层模型：跟同类软件对齐 =================
// 造一段有开场白 + 用户 + AI 的续写，验证 message_id / range / 写接口 / 事件
await page.evaluate(() => {
  const s = storySessions[0];
  s.turns = [
    { id: 'm0', role: 'ai',   charId: 5001, text: '开场：他站在门口。', fromGreeting: true, greetingIndex: 0, timestamp: Date.now() },
    { id: 'm1', role: 'user', text: '我走过去。', timestamp: Date.now() },
    { id: 'm2', role: 'ai',   charId: 5001, text: '版本A', swipes: ['版本A', '版本B'], currentSwipe: 0, timestamp: Date.now() },
    { id: 'm3', role: 'user', text: '然后呢？', timestamp: Date.now(), hidden: true },
  ];
  renderSsTurns();
});
await page.waitForTimeout(400);

const floors = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#ssTurns .ss-meta')).map(e => e.textContent.trim().split(' ')[0]));
check('楼层号从 0 开始（跟同类软件的 message_id 一致）',
  floors[0] === '#0楼' && floors[1] === '#1楼', JSON.stringify(floors));

// 桥接方法有同步也有异步（generate / getModelList / installExtension 这些是 async），
// 统一 await 一下再取 value
const B = async (m, ...a) => page.evaluate(async ({ m, a }) => {
  const r = await window.gyTavernBridge[m].apply(window.gyTavernBridge, a);
  return r && typeof r === 'object' && 'value' in r ? r.value : r;
}, { m, a });

check('getLastMessageId 是最后一楼的号', (await B('getLastMessageId')) === 3);

const all = await B('getChatMessages', '0-{{lastMessageId}}', {});
check('getChatMessages 能取整段，message_id 就是楼层下标',
  all.length === 4 && all.map(m => m.message_id).join(',') === '0,1,2,3', JSON.stringify(all.map(m => m.message_id)));
check('role 翻译成同类软件的说法（ai → assistant）',
  all[0].role === 'assistant' && all[1].role === 'user', all.map(m => m.role).join(','));
check('隐藏楼层带上 is_hidden', all[3].is_hidden === true);

const last = await B('getChatMessages', -1, {});
check('负数是深度：-1 就是最后一楼', last.length === 1 && last[0].message_id === 3, JSON.stringify(last.map(m => m.message_id)));

const onlyUser = await B('getChatMessages', '0-3', { role: 'user' });
check('能按 role 筛选', onlyUser.length === 2 && onlyUser.every(m => m.role === 'user'), JSON.stringify(onlyUser.map(m => m.message_id)));

const unhidden = await B('getChatMessages', '0-3', { hide_state: 'unhidden' });
check('能按隐藏状态筛选', unhidden.length === 3, JSON.stringify(unhidden.map(m => m.message_id)));

const withSwipes = await B('getChatMessages', 2, { include_swipes: true });
check('include_swipes 能拿到那一楼的所有版本',
  withSwipes[0].swipes.length === 2 && withSwipes[0].swipe_id === 0, JSON.stringify(withSwipes[0].swipes));

// 写：改任意一楼的正文（以前只支持第 0 楼）
await B('setChatMessages', [{ message_id: 1, message: '我停在原地。' }], {});
await page.waitForTimeout(300);
check('setChatMessages 能改任意一楼的正文，不再只有开场白',
  (await page.evaluate(() => storySessions[0].turns[1].text)) === '我停在原地。');

// 写：切别的楼层的 swipe
await B('setChatMessages', [{ message_id: 2, swipe_id: 1 }], {});
await page.waitForTimeout(300);
check('setChatMessages 能切任意一楼的版本（swipe）',
  (await page.evaluate(() => storySessions[0].turns[2].text)) === '版本B');

// 写：隐藏
await B('setChatMessages', [{ message_id: 0, is_hidden: true }], {});
await page.waitForTimeout(300);
check('setChatMessages 能隐藏楼层（is_hidden）',
  (await page.evaluate(() => storySessions[0].turns[0].hidden)) === true);

// 楼层变量
await B('insertOrAssignVariables', { 好感度: 5, 状态: { 疲劳: 2 } }, { type: 'message', message_id: 2 });
await page.waitForTimeout(200);
const mv = await B('getVariables', { type: 'message', message_id: 2 });
check('楼层变量能写能读（同类软件的 type:message）',
  mv.好感度 === 5 && mv.状态.疲劳 === 2, JSON.stringify(mv));

await B('insertOrAssignVariables', { 状态: { 心情: '好' } }, { type: 'message', message_id: 2 });
const mv2 = await B('getVariables', { type: 'message', message_id: 2 });
check('嵌套变量是深合并，不会把兄弟字段冲掉',
  mv2.状态.疲劳 === 2 && mv2.状态.心情 === '好', JSON.stringify(mv2.状态));

// 聊天变量走白露自己的 {{getvar}} 那份存储
await B('insertOrAssignVariables', { 章节: 3 }, { type: 'chat' });
const chatVar = await page.evaluate(() => {
  const s = storySessions[0];
  return getVarScopeStore(ssScopeId(s)).章节;
});
check('聊天变量落到白露自己的变量桶里（{{getvar}} 能读到同一份）', chatVar === 3, '读到 ' + chatVar);

// 插入 / 删除楼层
await B('createChatMessages', [{ role: 'user', message: '插进来的一楼' }], { insert_before: 1 });
await page.waitForTimeout(300);
const afterInsert = await page.evaluate(() => storySessions[0].turns.map(t => t.text.slice(0, 6)));
check('createChatMessages 能插到指定楼层前面',
  afterInsert[1] === '插进来的一楼', JSON.stringify(afterInsert));

// 事件
const events = await page.evaluate(async () => {
  const seen = [];
  const orig = window.gyTavernEmit;
  window.gyTavernEmit = (t, p) => { seen.push(t); return orig(t, p); };
  const s = storySessions[0];
  const turn = s.turns.find(t => t.swipes && t.swipes.length > 1);
  swipeSsTurn(turn.id, 1);
  window.gyTavernEmit = orig;
  return seen;
});
check('切版本会广播 message_swiped 事件', events.includes('message_swiped'), JSON.stringify(events));


// ================= 接上白露已有功能的那批接口 =================

// —— 世界书 ——
await page.evaluate(() => {
  worldbooks.length = 0;
  worldbooks.push({ id: 77, title: '旧书店设定', content: '门口有棵梧桐。', keywords: '书店,梧桐', isGlobal: true, category: '场景' });
  myCharacters[myCharacters.length - 1].worldbooks = [77];
});
// 世界书现在是同类软件的两层结构：**分类 ＝ 书名**，一本书里装很多条目
await page.evaluate(() => {
  worldbooks.push({ id: 78, title: '梧桐树', content: '门口那棵。', keywords: '梧桐',
    isGlobal: false, category: '场景', secondaryKeywords: '树,叶子', secondaryLogic: 'and_any',
    priority: 50, depth: 3, depthRole: 'user', stickyTurns: 2, cooldownTurns: 1, delayTurns: 0 });
});
const wbNames = await B('getWorldbookNames');
check('getWorldbookNames 给的是"书名"＝白露的分类', wbNames.includes('场景'), JSON.stringify(wbNames));

const bookEntries = await B('getWorldbook', '场景');
check('一本书里装着这个分类下的所有条目',
  bookEntries.length === 2 && bookEntries.map(e => e.name).sort().join(',') === '旧书店设定,梧桐树',
  JSON.stringify(bookEntries.map(e => e.name)));

const deep = bookEntries.find(e => e.name === '梧桐树');
check('条目字段跟同类软件几乎 1:1（次要关键词/顺序/深度/身份/粘性/冷却都在）',
  deep.secondary_keys.includes('树') && deep.selective === true && deep.order === 50
  && deep.depth === 3 && deep.role === 'user' && deep.sticky === 2 && deep.cooldown === 1,
  JSON.stringify(deep));
check('位置也翻译成同类软件的叫法',
  deep.position === 'after_character_definition', deep.position);

const wb = await B('getWorldbook', '场景');
const oldShop = wb.find(e => e.name === '旧书店设定');
check('世界书条目按同类软件的字段名给出（name/content/keys/enabled）',
  oldShop.content.includes('梧桐') && oldShop.keys.includes('梧桐') && oldShop.enabled === true, JSON.stringify(oldShop));
check('白露的「全局世界书」映射成同类软件的常驻条目 constant', oldShop.constant === true);

await B('replaceWorldbook', '场景', [{ name: '旧书店设定', content: '门口的梧桐今年没发芽。', order: 7 }]);
check('卡片能改书里某一条的正文和顺序',
  (await page.evaluate(() => {
    const w = worldbooks.find(x => x.id === 77);
    return w.content.includes('没发芽') && w.priority === 7;
  })));

await B('replaceWorldbook', '新的一本', [{ name: '新条目', content: '内容', keys: ['k'] }]);
check('往新书里写条目 = 在白露里新建一条并归到那个分类',
  await page.evaluate(() => {
    const w = worldbooks.find(x => x.title === '新条目');
    return !!w && w.category === '新的一本' && w.keywords === 'k';
  }));

// —— 正则 ——
const rx = await B('getTavernRegexes', {});
check('getTavernRegexes 列出的是白露自己的正则脚本',
  rx.some(r => r.script_name === '开场白菜单'), JSON.stringify(rx.map(r => r.script_name)));
check('不把十几万字符的 replaceString 整个吐给卡片，只给长度',
  rx.every(r => r.replace_string_length !== undefined && r.replace_string === undefined));

// —— 宏（完整版，走 applyMacros）——
await page.evaluate(() => {
  const s = storySessions[0];
  macroSetVar(ssScopeId(s), '神乐光.好感度', 5);
});
// 分发器会自动把 {charId} 作为最后一个参数补上，这里直接调所以要自己给
const macro = await B('substitudeMacros', '{{char}} 对 {{user}} 的好感度是 {{getvar::神乐光.好感度}}', { charId: '5001' });
check('substitudeMacros 走完整的 applyMacros（{{char}} / 点号路径 getvar 都能用）',
  macro.includes('试验体') && macro.includes('5'), macro);

// —— 三条你批准的改动 ——
const dotted = await page.evaluate(() => {
  const s = storySessions[0];
  return { 嵌套: macroGetVar(ssScopeId(s), '神乐光.好感度'),
           整个对象: macroGetVar(ssScopeId(s), '神乐光') };
});
check('{{getvar}} 支持点号路径（改动①）', dotted.嵌套 === '5', JSON.stringify(dotted));
check('整个对象读出来是 JSON，不再是 [object Object]',
  dotted.整个对象.includes('好感度'), dotted.整个对象);

await page.evaluate(() => {
  storySessions[0].turns[2].mvuSnapshot = { 角色: { 谢云霄: { 疲劳度: 7 } } };
  storySessions[0].turns[2].data = { 卡片自己写的: true };
});
const merged = await B('getVariables', { type: 'message', message_id: 2 });
check('楼层变量读的时候把 MVU 快照合进来（改动②）',
  merged.角色.谢云霄.疲劳度 === 7 && merged.卡片自己写的 === true, JSON.stringify(merged));

await B('insertOrAssignVariables', { 新写的: 1 }, { type: 'message', message_id: 2 });
const afterWrite = await page.evaluate(() => ({
  data: storySessions[0].turns[2].data,
  mvu: storySessions[0].turns[2].mvuSnapshot,
}));
check('但写只写进 turn.data，绝不碰 MVU 树（改动②的另一半）',
  afterWrite.data.新写的 === 1 && !('新写的' in afterWrite.mvu), JSON.stringify(afterWrite));

const chatChanged = await page.evaluate(async () => {
  const seen = [];
  const orig = window.gyTavernEmit;
  window.gyTavernEmit = (t, p) => { seen.push(t); return orig(t, p); };
  storySessions.push({ id: 'ss_other', title: '另一段', outline: '', chars: [], extraChars: '',
    wordCount: 300, secondPerson: false, maxHistory: 20, apiMode: 'main',
    turns: [], chapters: [], createdAt: Date.now(), updatedAt: Date.now() });
  openStorySession('ss_other');
  await new Promise(r => setTimeout(r, 200));
  window.gyTavernEmit = orig;
  openStorySession('ss_bridge');
  return seen;
});
check('切换续写会话会发 CHAT_CHANGED（改动③）',
  chatChanged.includes('chat_id_changed'), JSON.stringify(chatChanged));

// —— 斜杠命令：接到白露真实功能上 ——
await page.evaluate(() => { storySessions[0].turns[1].hidden = false; });
await page.evaluate(() => window.gyTavernBridge.triggerSlash('/hide 1'));
await page.waitForTimeout(300);
check('/hide 真的隐藏了那一楼（白露的「不进 prompt」）',
  (await page.evaluate(() => storySessions[0].turns[1].hidden)) === true);
await page.evaluate(() => window.gyTavernBridge.triggerSlash('/unhide 1'));
await page.waitForTimeout(300);
check('/unhide 能取消隐藏',
  (await page.evaluate(() => storySessions[0].turns[1].hidden)) === false);

const slashVar = await page.evaluate(async () => {
  await window.gyTavernBridge.triggerSlash('/setvar key=进度 第三章');
  return await window.gyTavernBridge.triggerSlash('/getvar 进度');
});
check('/setvar 和 /getvar 走白露自己那份变量存储', slashVar.value === '第三章', JSON.stringify(slashVar));

const chained = await page.evaluate(async () => {
  await window.gyTavernBridge.triggerSlash('/setvar key=计数 1 | /addvar key=计数 4');
  const s = storySessions[0];
  return macroGetVar(ssScopeId(s), '计数');
});
check('支持 | 串多条命令（/setvar | /addvar）', chained === '5', '算出来 ' + chained);

// —— 提示词注入 ——
await B('injectPrompts', [{ id: 'test_inj', role: 'system', content: '【临时注入】现在是雨天。', position: 'in_chat', depth: 0 }]);
const injected = await page.evaluate(() => buildSsHistory(storySessions[0]).map(m => m.content).join('\n'));
check('injectPrompts 的内容真的进了发给 AI 的历史', injected.includes('【临时注入】现在是雨天。'));
check('注入的内容不落存档正文', !(await page.evaluate(() => storySessions[0].turns.map(t => t.text).join(''))).includes('【临时注入】'));
await B('uninjectPrompts', ['test_inj']);
const afterUninject = await page.evaluate(() => buildSsHistory(storySessions[0]).map(m => m.content).join('\n'));
check('uninjectPrompts 能撤掉', !afterUninject.includes('【临时注入】'));

// —— 生成：走白露续写自己那条链路 ——
const gen = await page.evaluate(async () => {
  const r = await window.gyTavernBridge.generate({ user_input: '接着写。' }, null, { charId: '5001' });
  return r;
});
check('generate 能真的生成，用的是白露的 API 配置和设定',
  gen && gen.ok && typeof gen.value === 'string' && gen.value.length > 0, JSON.stringify(gen).slice(0, 160));
check('generate 不会自己往楼层里加内容（跟同类软件一致）',
  (await page.evaluate(() => storySessions[0].turns.length)) === 5, '现在 ' + (await page.evaluate(() => storySessions[0].turns.length)) + ' 楼');

// —— 卡片那一侧真的拿得到这些接口 ——
await page.evaluate(() => {
  const s = storySessions[0];
  s.turns.push({ id: 'tprobe', role: 'ai', charId: 5001, text: '【菜单】', timestamp: Date.now() });
  renderSsTurns();
});
await page.waitForTimeout(1500);
const probeFrame = page.frames().find(f => f !== page.mainFrame());
const surface = probeFrame ? await probeFrame.evaluate(() => {
  const want = ['generate','generateRaw','stopAllGeneration','getWorldbookNames','getWorldbook',
    'getTavernRegexes','formatAsTavernRegexedString','formatAsDisplayedMessage','injectPrompts',
    'getCharacterNames','getCharAvatarPath','getPresetNames','loadPreset','getLorebooks','getChatHistoryBrief'];
  const missing = want.filter(k => typeof window[k] !== 'function' && typeof (window.TavernHelper||{})[k] !== 'function');
  return { missing, wbSync: (window.getWorldbookNames() || []).length, names: window.getCharacterNames() };
}) : null;
check('卡片里这些接口全都在（不再是空桩）', surface && surface.missing.length === 0,
  surface ? JSON.stringify(surface.missing) : '拿不到 iframe');
check('世界书名单在卡片里能同步读到', surface && surface.wbSync > 0, JSON.stringify(surface));
check('角色名单在卡片里能同步读到', surface && surface.names.includes('试验体'), JSON.stringify(surface && surface.names));


// ================= 扩展 / 脚本按钮 / 模型列表 =================

// —— 模型列表：接的是设置页「拉取模型」同一份逻辑 ——
await page.route('**/v1/models', r => r.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ data: [{ id: 'gpt-test' }, { id: 'claude-test' }, { id: 'text-embedding-test' }] }) }));
const models = await B('getModelList');
// 白露不接 API（地址是 bailu://cards），没有模型列表可拉：能正常返回一个数组、不报错就行
check('getModelList 在白露里正常返回（不接 API，列表可以是空的）',
  Array.isArray(models), JSON.stringify(models));
const sharedFn = await page.evaluate(() => typeof fetchModelListFrom === 'function');
check('设置页和卡片共用同一个拉取函数（fetchModelListFrom）', sharedFn);

// —— 扩展安装：接到白露的插件系统，且必须先问过用户 ——
await page.evaluate(() => { plugins.length = 0; });

// ① 网址形式一律拒绝，不下载执行远程代码
const remote = await page.evaluate(() =>
  window.gyTavernBridge.installExtension('https://github.com/someone/some-extension'));
check('给网址的扩展安装被拒绝（不下载执行远程代码）', remote.ok === false, JSON.stringify(remote));
check('拒绝之后一个插件都没装进去', (await page.evaluate(() => plugins.length)) === 0);

// ② 用户点取消 → 什么都不装
const declined = await page.evaluate(async () => {
  const orig = window.appConfirm;
  window.appConfirm = async () => false;
  const r = await window.gyTavernBridge.installExtension([{ name: '测试插件', type: 'prompt', promptText: 'x' }]);
  window.appConfirm = orig;
  return { r, count: plugins.length };
});
check('用户点取消就一个都不装', declined.r.value === 0 && declined.count === 0, JSON.stringify(declined));

// ③ 用户同意 → 真的进了白露的插件列表
const installed = await page.evaluate(async () => {
  const orig = window.appConfirm;
  let askedText = '';
  window.appConfirm = async (msg) => { askedText = msg; return true; };
  const r = await window.gyTavernBridge.installExtension([
    { name: '雨天氛围', type: 'prompt', description: '给剧情加点雨', promptText: '现在在下雨。' }
  ]);
  window.appConfirm = orig;
  return { r, plugins: plugins.map(p => ({ name: p.name, type: p.type, fromCard: p.fromCard })), askedText };
});
check('同意之后插件真的进了白露的插件系统',
  installed.plugins.length === 1 && installed.plugins[0].name === '雨天氛围' && installed.plugins[0].fromCard === true,
  JSON.stringify(installed.plugins));
check('弹框里把要装什么一条条列清楚了',
  installed.askedText.includes('雨天氛围') && installed.askedText.includes('prompt'), installed.askedText.slice(0, 120));

// ④ script 类要额外警告（它能在主页面跑代码，比卡片权限高）
const scriptWarn = await page.evaluate(async () => {
  const orig = window.appConfirm;
  let asked = '';
  window.appConfirm = async (msg) => { asked = msg; return false; };
  await window.gyTavernBridge.installExtension([{ name: '危险的', type: 'script', code: 'alert(1)' }]);
  window.appConfirm = orig;
  return asked;
});
check('script 类插件额外警告权限更高', scriptWarn.includes('⚠️') && scriptWarn.includes('script'), scriptWarn.slice(-140));

const info = await B('getExtensionInstallationInfo');
check('getExtensionInstallationInfo 列出的是白露的插件',
  info.some(x => x.name === '雨天氛围' && x.from_card === true), JSON.stringify(info));
check('isInstalledExtension 能查到', (await B('isInstalledExtension', '雨天氛围')) === true);

// —— 脚本按钮：接到续写页上方的卡片按钮栏 ——
await B('replaceScriptButtons', '5001', [{ name: '查看手账' }, { name: '回到首页' }]);
await page.waitForTimeout(300);
const bar = await page.evaluate(() => {
  const el = document.getElementById('ssCardButtons');
  return { display: el.style.display, labels: Array.from(el.querySelectorAll('button')).map(b => b.textContent) };
});
check('卡片注册的按钮真的渲染在续写页上',
  bar.display === 'flex' && bar.labels.join(',') === '查看手账,回到首页', JSON.stringify(bar));

const got = await B('getScriptButtons', '5001');
check('getScriptButtons 能读回来', got.length === 2 && got[0].name === '查看手账', JSON.stringify(got));

// 点一下 → 事件名要跟卡片那边 getButtonEvent() 算出来的一致
const clicked = await page.evaluate(() => {
  const seen = [];
  const orig = window.gyTavernEmit;
  window.gyTavernEmit = (t, p) => { seen.push(t); return orig(t, p); };
  clickSsCardButton(0);
  window.gyTavernEmit = orig;
  return seen;
});
check('点按钮发出的事件名跟同类软件的 getButtonEvent 算法一致',
  clicked.includes('5001_查看手账_button_clicked'), JSON.stringify(clicked));

check('按钮注册信息存在会话上（重渲染不会丢）',
  (await page.evaluate(() => storySessions[0].cardButtons.length)) === 2);
await page.evaluate(() => renderSsTurns());
await page.waitForTimeout(200);
check('重新渲染楼层之后按钮还在',
  (await page.evaluate(() => document.querySelectorAll('#ssCardButtons button').length)) === 2);

await B('replaceScriptButtons', '5001', []);
await page.waitForTimeout(200);
check('传空数组能把按钮撤掉',
  (await page.evaluate(() => document.getElementById('ssCardButtons').style.display)) === 'none');


// ================= git 下载 / 音频 / 开场白美化 =================

// —— git 地址：真的下下来，看清楚再装 ——
await page.route('**raw.githubusercontent.com/**', route => {
  const u = route.request().url();
  if (u.endsWith('plugin.json')) {
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ name: '远程来的插件', type: 'prompt', description: '从 GitHub 下的', promptText: 'x' }]) });
  }
  return route.fulfill({ status: 404, body: 'not found' });
});
await page.evaluate(() => { plugins.length = 0; });
const fromGit = await page.evaluate(async () => {
  const orig = window.appConfirm;
  let asked = '';
  window.appConfirm = async (m) => { asked = m; return true; };
  const r = await window.gyTavernBridge.installExtension('https://github.com/someone/some-ext.git');
  window.appConfirm = orig;
  return { r, names: plugins.map(p => p.name), asked };
});
check('git 地址现在真的会下载并安装',
  fromGit.r.ok && fromGit.names.includes('远程来的插件'), JSON.stringify(fromGit.r) + JSON.stringify(fromGit.names));
check('下下来之后仍然先给你看清楚是什么', fromGit.asked.includes('远程来的插件'), fromGit.asked.slice(0, 100));

// .js 直链 → 当成 script 类插件
await page.route('**/some-script.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'console.log(1)' }));
await page.evaluate(() => { plugins.length = 0; });
const jsPlugin = await page.evaluate(async () => {
  const orig = window.appConfirm;
  let asked = '';
  window.appConfirm = async (m) => { asked = m; return true; };
  await window.gyTavernBridge.installExtension('https://example.com/some-script.js');
  window.appConfirm = orig;
  return { plugins: plugins.map(p => ({ name: p.name, type: p.type, hasCode: !!p.code })), asked };
});
check('.js 直链被当成 script 类插件装进来',
  jsPlugin.plugins.length === 1 && jsPlugin.plugins[0].type === 'script' && jsPlugin.plugins[0].hasCode,
  JSON.stringify(jsPlugin.plugins));
check('script 类照样额外警告一次', jsPlugin.asked.includes('⚠️'), jsPlugin.asked.slice(-100));

// —— 音频 ——
const audio = await page.evaluate(async () => {
  await window.gyTavernBridge.playAudio({ url: 'https://example.com/bgm.mp3', volume: 0.4, loop: true });
  const el = document.getElementById('gyCardAudio');
  const bar = document.getElementById('gyAudioBar');
  return { hasEl: !!el, src: el && el.dataset.src, volume: el && el.volume, loop: el && el.loop, hasBar: !!bar };
});
check('playAudio 建出了真的 <audio> 并带上地址',
  audio.hasEl && audio.src === 'https://example.com/bgm.mp3', JSON.stringify(audio));
check('音量 / 循环参数生效', Math.abs(audio.volume - 0.4) < 0.01 && audio.loop === true, JSON.stringify(audio));
check('右下角出现了能关掉它的控制条', audio.hasBar);

const audioInfo = await B('getCurrentAudio');
check('getCurrentAudio 能读回当前在放什么', audioInfo && audioInfo.url.includes('bgm.mp3'), JSON.stringify(audioInfo));

await page.evaluate(() => window.gyAudioStop());
check('点 ✕ 能把音频停掉、控制条也收走',
  (await page.evaluate(() => !!document.getElementById('gyAudioBar'))) === false);

const audioSurface = await page.evaluate(() => {
  const want = ['playAudio', 'pauseAudio', 'getCurrentAudio', 'setAudioSettings'];
  return want.filter(k => typeof (window.TavernHelper || {})[k] !== 'function');
});
// 主页面没有 TavernHelper（那是 iframe 里的），这里只确认桥接方法齐全
check('音频接口在桥接层齐全', (await page.evaluate(() =>
  ['playAudio','pauseAudio','getCurrentAudio','getAudioSettings','setAudioSettings','getAudioList','replaceAudioList']
    .filter(k => typeof window.gyTavernBridge[k] !== 'function').length)) === 0);

// —— 开场白美化 ——
await page.evaluate(() => {
  // 给「试验体」配一条"开场白美化"正则：把第一条开场白整个换成一页可点的场景菜单
  regexScripts.push({
    id: 'rx_greet_pretty', name: '开场白跳转(美化)', find: '开场一：他站在门口。', isRegex: false,
    target: 'ai_output', enabled: true, displayOnly: true, promptOnly: false,
    minDepth: null, maxDepth: null, charScope: ['5001'],
    replace: '```html\n<!DOCTYPE html>\n<html><head><meta charset="utf-8"></head><body>\n' +
      '<div id="pretty">美化开场白页</div>\n' +
      '<button id="pick2" onclick="setChatMessages([{message_id:0, swipe_id:2}])">选第三个开场</button>\n' +
      '</body></html>\n```',
  });
  // 再加一个没有美化的角色，验证多角色切换
  myCharacters.push({ id: 5002, name: '第二个人', persona: 'x', worldbooks: [],
    firstMessage: '乙的开场。', alternateGreetings: ['乙的另一个开场。'] });
  const s = storySessions[0];
  s.chars = [5001, 5002];
  s.turns = [];
});
await page.evaluate(() => showSsGreetingPicker());
await page.waitForTimeout(1500);

const picker = await page.evaluate(() => {
  const box = document.getElementById('greetingPickerList');
  return {
    open: document.getElementById('greetingPickerModal').style.display === 'flex',
    tabs: Array.from(box.querySelectorAll('.ss-greet-tab')).map(b => b.textContent.trim()),
    hasPretty: !!box.querySelector('.ss-greet-pretty iframe.gy-frontend-frame'),
    hasSwitch: !!box.querySelector('.ss-greet-switch button'),
  };
});
check('挑选框打开了', picker.open);
check('有美化版的直接显示美化开场白（渲染成 iframe）', picker.hasPretty, JSON.stringify(picker));
check('多角色时上面出现角色切换条，有美化的标了 🎨',
  picker.tabs.length === 2 && picker.tabs[0].includes('🎨'), JSON.stringify(picker.tabs));
check('留了「看纯文本列表」的退路', picker.hasSwitch);

// 切到没有美化的那个角色 → 回落成纯文本列表
await page.evaluate(() => ssGreetPickChar('5002'));
await page.waitForTimeout(400);
const second = await page.evaluate(() => {
  const box = document.getElementById('greetingPickerList');
  return {
    pretty: !!box.querySelector('.ss-greet-pretty'),
    cards: box.querySelectorAll('.wb-card:not(#randomGreetingBtn)').length,
    text: box.textContent.includes('乙的开场'),
  };
});
check('切到没有美化的角色，自动回落成纯文本候选列表',
  !second.pretty && second.cards === 2 && second.text, JSON.stringify(second));

// 切回来 → 又是美化版
await page.evaluate(() => ssGreetPickChar('5001'));
await page.waitForTimeout(1200);
check('切回有美化的角色又变回美化版',
  await page.evaluate(() => !!document.querySelector('#greetingPickerList .ss-greet-pretty iframe')));

// 手动切到纯文本
await page.evaluate(() => ssGreetToggleView());
await page.waitForTimeout(400);
check('能手动切到纯文本列表',
  await page.evaluate(() => !document.querySelector('#greetingPickerList .ss-greet-pretty')));
await page.evaluate(() => ssGreetToggleView());
await page.waitForTimeout(1200);

// 点美化页里的场景按钮 → 真的开局 + 挑选框自动关掉
const prettyFrame = page.frames().find(f => f !== page.mainFrame() &&
  f.url() === 'about:srcdoc');
const beforeTurns = await page.evaluate(() => storySessions[0].turns.length);
await page.evaluate(() => {
  const fr = document.querySelector('#greetingPickerList iframe.gy-frontend-frame');
  fr.contentWindow.document.getElementById('pick2').click();
});
await page.waitForTimeout(1200);
const opened = await page.evaluate(() => ({
  turns: storySessions[0].turns.length,
  first: (storySessions[0].turns[0] || {}).text || '',
  idx: (storySessions[0].turns[0] || {}).greetingIndex,
  modal: document.getElementById('greetingPickerModal').style.display,
}));
check('点美化页里的场景，真的用那条开场白开局了',
  opened.turns === beforeTurns + 1 && opened.first.includes('雨下得很大') && opened.idx === 2,
  JSON.stringify(opened));
check('开完局挑选框自动关掉', opened.modal !== 'flex', '现在 display=' + opened.modal);


// —— 用户人设 ——
await page.evaluate(() => {
  userPersonas.length = 0;
  userPersonas.push(
    { id: 'persona_a', label: '本体', data: { name: '林', handle: '@lin', persona: '写小说的。', avatarImg: 'data:image/png;base64,AAA' } },
    { id: 'persona_b', label: '马甲小号', data: { name: '阿林', handle: '@alin', persona: '匿名号。', avatarImg: '' } },
  );
  currentUser.name = '林'; currentUser.handle = '@lin';
  // 人设是随快照塞进 iframe 的，所以要重新造一个卡片楼层，
  // 拿到的才是带上新人设的那份快照——沿用旧 iframe 只会读到设人设之前的空列表。
  const s = storySessions[0];
  s.turns.push({ id: 'tpersona', role: 'ai', charId: 5001, text: '【菜单】', timestamp: Date.now() });
  renderSsTurns();
});
await page.waitForTimeout(1600);

// ⚠️ 不能用"第一个非主 frame"——前面开场白挑选框留下的那个 iframe 还在（只是被隐藏了），
// 它是设人设**之前**建的，快照里当然没有人设。按楼层里那个 iframe 的名字精确找。
const pName = await page.evaluate(() => {
  const list = document.querySelectorAll('#ssTurns iframe.gy-frontend-frame');
  return list.length ? list[list.length - 1].name : null;
});
const pFrame = page.frames().find(f => f.name() === pName);
const persona = pFrame ? await pFrame.evaluate(() => ({
  ids: window.getPersonaIds(),
  names: window.getPersonaNames(),
  current: window.getCurrentPersonaId(),
  one: window.getPersona('persona_b'),
  avatar: window.getPersonaAvatarPath('persona_a'),
})) : null;
check('getPersonaIds 读到的是白露的用户人设',
  persona && persona.ids.join(',') === 'persona_a,persona_b', JSON.stringify(persona && persona.ids));
check('getPersonaNames 给的是人设里的名字',
  persona && persona.names.join(',') === '林,阿林', JSON.stringify(persona && persona.names));
check('能按 id 取到一份人设，字段翻译成同类软件的形状',
  persona && persona.one && persona.one.name === '阿林' && persona.one.title === '马甲小号'
  && persona.one.description === '匿名号。', JSON.stringify(persona && persona.one));
check('getCurrentPersonaId 能推出当前是哪份人设', persona && persona.current === 'persona_a',
  '拿到 ' + (persona && persona.current));
check('getPersonaAvatarPath 能按 id 给对应头像',
  persona && persona.avatar === 'data:image/png;base64,AAA', JSON.stringify(persona && persona.avatar));

// 切换人设要先问过用户
const switched = await page.evaluate(async () => {
  const orig = window.appConfirm; let asked = '';
  window.appConfirm = async (m) => { asked = m; return true; };
  await window.gyTavernBridge.switchPersona('persona_b');
  window.appConfirm = orig;
  return { name: currentUser.name, asked };
});
check('卡片能切换人设，但会先问一句',
  switched.name === '阿林' && switched.asked.includes('马甲小号'), JSON.stringify(switched));

const declinedPersona = await page.evaluate(async () => {
  const orig = window.appConfirm;
  window.appConfirm = async () => false;
  await window.gyTavernBridge.switchPersona('persona_a');
  window.appConfirm = orig;
  return currentUser.name;
});
check('点取消就不切', declinedPersona === '阿林', '现在是 ' + declinedPersona);


// —— 兜底：同类软件 的 161 个接口，一个都不能让卡片调崩 ——
const surfaceAudit = pFrame ? await pFrame.evaluate(() => {
  const names = Object.keys(window.TavernHelper);
  const notFn = names.filter(k => typeof window.TavernHelper[k] !== 'function');
  // 只把**兜底空实现**挨个调一遍——真接上的那些会弹确认框、会重载 iframe，
  // 无差别全调一遍等于自己把测试环境拆了（第一版就是这么把 frame 弄没的）。
  const stubs = names.filter(k => window.TavernHelper[k].__gySafeStub);
  const threw = [];
  stubs.forEach(k => {
    try { window.TavernHelper[k](); } catch (e) { threw.push(k + ': ' + e.message); }
  });
  return { count: names.length, notFn, threw, stubCount: stubs.length };
}) : null;
check('TavernHelper 上没有"不是函数"的成员',
  surfaceAudit && surfaceAudit.notFn.length === 0, JSON.stringify(surfaceAudit && surfaceAudit.notFn));
check('同类软件 161 个接口全都挂上了（不会再 xxx is not a function）',
  surfaceAudit && surfaceAudit.count >= 161, '挂了 ' + (surfaceAudit && surfaceAudit.count) + ' 个');
check('兜底空实现挨个调一遍，一个都不抛异常',
  surfaceAudit && surfaceAudit.threw.length === 0, JSON.stringify(surfaceAudit && surfaceAudit.threw.slice(0, 5)));
console.log(`   （161 个接口里，真接上 ${surfaceAudit.count - surfaceAudit.stubCount} 个，兜底空实现 ${surfaceAudit.stubCount} 个）`);

const safeShapes = pFrame ? await pFrame.evaluate(() => ({
  list: window.getProxyPresetNames(),          // 名单类 → []
  bool: window.isPresetSystemPrompt(),         // 判断类 → false
  obj:  window.getLorebookSettings(),          // get 类 → {}
  prom: window.createLorebook('x') instanceof Promise,   // 写操作 → Promise
})) : null;
check('没实现的接口按名字给了合理的返回值（列表/判断/对象/Promise）',
  safeShapes && Array.isArray(safeShapes.list) && safeShapes.bool === false
  && typeof safeShapes.obj === 'object' && safeShapes.prom === true, JSON.stringify(safeShapes));

// 新接上的那几个
const newly = pFrame ? await pFrame.evaluate(async () => ({
  msgId: window.getMessageId(),
  allVars: Object.keys(window.getAllVariables()),
  detail: (await window.getChatHistoryDetail()).length,
  globalWb: await window.getGlobalWorldbookNames(),
  preset: typeof window.getPreset,
})) : null;
check('getMessageId / getAllVariables 在 iframe 里直接就能答',
  newly && newly.msgId >= 0 && newly.allVars.join(',') === 'chat,global', JSON.stringify(newly));
check('getChatHistoryDetail 能拿到每段续写的楼层', newly && newly.detail >= 1, JSON.stringify(newly && newly.detail));
// 现在返回的是**书名**（分类），不是条目名——「旧书店设定」是条目，它所在的书叫「场景」
check('getGlobalWorldbookNames 给的是含全局条目的那几本书',
  newly && Array.isArray(newly.globalWb) && newly.globalWb.includes('场景'), JSON.stringify(newly && newly.globalWb));


// ================= 群聊身份 / 开场白左右切换 =================

// —— 群聊：历史里必须带说话人名字，否则模型分不清哪句是自己说的 ——
const groupHist = await page.evaluate(() => {
  myCharacters.push({ id: 7101, name: '甲', persona: 'x', worldbooks: [] });
  myCharacters.push({ id: 7102, name: '乙', persona: 'x', worldbooks: [] });
  currentUser.name = '林';
  const msgs = [
    { sender: 'me',   text: '你们俩谁去？', timestamp: Date.now() },
    { sender: 7101,   text: '我去吧。',     timestamp: Date.now() },
    { sender: 7102,   text: '别听他的。',   timestamp: Date.now() },
  ];
  return {
    group: buildTimeAwareHistoryTurns(msgs, '甲', { groupMode: true }),
    solo:  buildTimeAwareHistoryTurns(msgs, '甲', { groupMode: false }),
  };
});
const groupText = groupHist.group.map(t => t.role + '|' + t.content).join('\n');
check('群聊历史里每条角色发言都带上了说话人名字',
  groupText.includes('甲：我去吧') && groupText.includes('乙：别听他的'), groupText);
check('群聊里用户发言也标了名字', groupText.includes('林：你们俩谁去'), groupText);
const soloText = groupHist.solo.map(t => t.content).join('\n');
check('私聊不加名字前缀（只有一个角色，不存在分不清的问题）',
  !soloText.includes('甲：') && soloText.includes('我去吧'), soloText);

// —— 开场白：◀▶ 在所有开场白之间切 ——
await page.evaluate(() => {
  const s = storySessions[0];
  s.chars = [5001];
  s.turns = [];
  currentUser.name = '林';
  // 直接用第 2 个开场白开局
  applySsGreeting({ charId: 5001, charName: '试验体', text: '开场二：她先开口了。', greetingIndex: 1 });
});
await page.waitForTimeout(600);
const openArrows = await page.evaluate(() => {
  const t = storySessions[0].turns[0];
  const sw = document.querySelector('#ssTurns .ss-swipe');
  return { count: t.greetingCount, idx: t.greetingIndex, label: sw ? sw.textContent.replace(/\s+/g, ' ').trim() : null };
});
check('开场那一楼记下了总共几个开场白', openArrows.count === 3, JSON.stringify(openArrows));
check('开场那一楼出现 ◀▶ 并显示"开场 2 / 3"',
  openArrows.label && openArrows.label.includes('开场 2 / 3'), JSON.stringify(openArrows));

await page.evaluate(() => swipeSsTurn(storySessions[0].turns[0].id, 1));
await page.waitForTimeout(600);
const swiped = await page.evaluate(() => ({
  n: storySessions[0].turns.length,
  idx: storySessions[0].turns[0].greetingIndex,
  text: storySessions[0].turns[0].text,
}));
check('点 ▶ 切到下一个开场白（内容真的换了）',
  swiped.idx === 2 && swiped.text.includes('雨下得很大'), JSON.stringify(swiped));
check('切开场白是"换掉"不是"多加一楼"', swiped.n === 1, '现在 ' + swiped.n + ' 楼');

await page.evaluate(() => swipeSsTurn(storySessions[0].turns[0].id, 1));
await page.waitForTimeout(600);
check('切到最后一个再往后会绕回第一个',
  (await page.evaluate(() => storySessions[0].turns[0].greetingIndex)) === 0);

await page.evaluate(() => swipeSsTurn(storySessions[0].turns[0].id, -1));
await page.waitForTimeout(600);
check('点 ◀ 往前切也能绕回最后一个',
  (await page.evaluate(() => storySessions[0].turns[0].greetingIndex)) === 2);

// 开场白走的是完整链路：带美化正则的那个开场白会渲染成 iframe
await page.evaluate(() => {
  regexScripts.push({
    id: 'rx_g0', name: '开场一美化', find: '开场一：他站在门口。', isRegex: false,
    target: 'ai_output', enabled: true, displayOnly: true, promptOnly: false,
    minDepth: null, maxDepth: null, charScope: ['5001'],
    replace: '```html\n<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div>美化过的开场一</div></body></html>\n```',
  });
  swipeSsTurn(storySessions[0].turns[0].id, 1);   // 2 → 0
});
await page.waitForTimeout(1600);
check('切到带美化正则的那个开场白，第一楼直接渲染成美化页（iframe）',
  await page.evaluate(() => !!document.querySelector('#ssTurns iframe.gy-frontend-frame')));

await page.screenshot({ path: '_test/开场白菜单.png' });
await browser.close();

const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
if (pageErrors.length) { console.log('\n页面报错:'); pageErrors.slice(0, 5).forEach(e => console.log('  ' + e)); }
process.exit(bad.length ? 1 : 0);
