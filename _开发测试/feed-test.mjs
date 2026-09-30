// 验证推特板块两个真 bug 的修复：
//   1. 回复错位 —— 角色明明在回第 1 条评论，却被挂到第 3 条下面、还 @ 了错的人
//   2. 所有路人共用 @npc_user —— 十个路人长得一模一样，像同一个人自言自语
//
// 用法：node _test/feed-test.mjs
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok, extra });

const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
page.setDefaultTimeout(15000);
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('dialog', d => d.accept());

await page.route(/^https?:\/\//, r => r.abort());
await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=v;return Promise.resolve(v)},getItem(k){return Promise.resolve(this._d[k]??null)},removeItem(k){delete this._d[k];return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));

// 角色回应 NPC 评论时，让它明确回"第 1 条"——就是截图里那种情况：
// 回的是矿石鉴定师问的"咒术符号"，而那条是列表里的第 1 条，不是最后一条。
let aiReply = '[回复1]\n那些不是咒术，是能量衰减的拓扑图示。';
let interestedIdx = [1, 3];
let npcArgueReply = '楼上这话说得就外行了。';
await page.route('**/chat/completions', route => {
  const body = route.request().postData() || '';
  // 生成路人评论那一轮：返回三个各不相同的路人，各自带账号名
  if (body.includes('路人NPC网友')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      choices: [{ message: { content: JSON.stringify([
        { name: '璃月矿石鉴定师', handle: '@liyue_ore', text: '夫人画的是咒术符号吗？' },
        { name: '至冬吃瓜群众',   handle: '@snezh_tea',  text: '会议画图太真实了。' },
        { name: '匿名研究员',     handle: '@anon_lab',   text: '那位小姐的应对优雅又锋利。' },
      ]) } }]
    }) });
  }
  // "谁想插嘴"的筛选请求
  if (body.includes('谁会有兴趣凑过去说一句')) {
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(interestedIdx) } }] }) });
  }
  // 路人之间接话
  if (body.includes('接话')) {
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: npcArgueReply } }] }) });
  }
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: aiReply } }] }) });
});

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted === true, { timeout: 20000 });

await page.evaluate(() => {
  myApiUrl = 'https://api.test.local/v1'; myApiKey = 'sk-test'; myModel = 'gpt-test';
  subApiUrl = ''; subApiKey = ''; subModel = '';
  myCharacters.length = 0;
  myCharacters.push({ id: 3001, name: '多托雷（执行官）', handle: '@Il_Dottore', persona: '执行官，冷淡傲慢。', worldbooks: [] });
  npcIdentities = {};
  charReplyDelayEnabled = false;   // 测试里不等，直接看结果
  // 前半段先关掉"路人互相接话"，好让"回复错位"那几条断言在干净的三条评论上验；
  // 后面验接话功能时再单独打开。
  npcArgueProb = 0;
  globalPosts.length = 0;
  globalPosts.push({
    id: 'p_feed', char: myCharacters[0], charId: 3001,
    text: '今日会议纪要：影响她画图。', timestamp: Date.now(),
    stats: { comments: 0, likes: 0, retweets: 0 }, replies: [],
  });
});

// 触发一轮路人评论 + 角色回应
await page.evaluate(async () => {
  await spawnNpcComments('p_feed', false, { triggerName: '', triggerText: '' });
});
await page.waitForTimeout(1200);

const state = await page.evaluate(() => {
  const p = globalPosts.find(x => x.id === 'p_feed');
  return p.replies.map(r => ({
    name: r.char ? r.char.name : r.name,
    handle: r.char ? r.char.handle : null,
    emoji: r.char ? r.char.avatarEmoji : null,
    color: r.char ? r.char.themeColor : null,
    id: r.id, parentId: r.parentId, replyTo: r.replyTo,
    text: (r.text || '').slice(0, 24),
    isChar: !!(r.char && String(r.char.id) === '3001'),
  }));
});

const npcs = state.filter(r => !r.isChar);
const charReply = state.find(r => r.isChar);

check('三条路人评论都生成了', npcs.length === 3, JSON.stringify(npcs.map(n => n.name)));

// —— bug 2：路人身份 ——
const handles = npcs.map(n => n.handle);
check('每个路人有自己的账号，不再全是 @npc_user',
  new Set(handles).size === 3 && !handles.includes('@npc_user'), JSON.stringify(handles));
check('账号用的是 AI 起的那个（像真人账号）',
  handles.includes('@liyue_ore') && handles.includes('@anon_lab'), JSON.stringify(handles));
const emojis = npcs.map(n => n.emoji);
check('头像也各不相同，不再全是 👤',
  new Set(emojis).size >= 2 && !emojis.includes('👤'), JSON.stringify(emojis));
check('颜色也分开了', new Set(npcs.map(n => n.color)).size >= 2, JSON.stringify(npcs.map(n => n.color)));

// —— bug 1：回复错位 ——
check('角色回应了', !!charReply, JSON.stringify(state.map(s => s.name)));
const target = npcs.find(n => n.id === (charReply || {}).parentId);
check('角色的回复挂在它真正回的那条下面（第 1 条 · 璃月矿石鉴定师）',
  target && target.name === '璃月矿石鉴定师',
  `实际挂在: ${target ? target.name : '(没挂上)'}`);
check('@ 的人也跟着对上了',
  charReply && charReply.replyTo === '璃月矿石鉴定师', '实际 @ 的是: ' + (charReply || {}).replyTo);
check('[回复N] 这个标记不会漏进正文里',
  charReply && !/\[回复\s*\d+\]/.test(charReply.text) && charReply.text.includes('拓扑图示'), charReply && charReply.text);

// 换成回第 2 条，验证不是碰巧
await page.evaluate(() => {
  const p = globalPosts.find(x => x.id === 'p_feed');
  p.replies = p.replies.filter(r => !(r.char && String(r.char.id) === '3001'));
});
aiReply = '[回复2]\n会议记录本就该真实。';
await page.evaluate(async () => {
  const p = globalPosts.find(x => x.id === 'p_feed');
  const npcs = p.replies.map(r => ({ name: r.char.name, text: r.text, _replyId: r.id }));
  await maybeCharsReactToNpcComments(npcs, {
    kind: 'post', post: p, postText: p.text, authorChar: myCharacters[0],
    authorName: myCharacters[0].name, postId: 'p_feed',
  });
});
await page.waitForTimeout(900);
const second = await page.evaluate(() => {
  const p = globalPosts.find(x => x.id === 'p_feed');
  const cr = p.replies.find(r => r.char && String(r.char.id) === '3001');
  const parent = p.replies.find(r => r.id === (cr || {}).parentId);
  return { replyTo: cr && cr.replyTo, parentName: parent && parent.char && parent.char.name };
});
check('回第 2 条时也挂对了（说明是真按标记走，不是碰巧）',
  second.parentName === '至冬吃瓜群众' && second.replyTo === '至冬吃瓜群众', JSON.stringify(second));

// —— 没有标记时退回老行为，不能崩 ——
await page.evaluate(() => {
  const p = globalPosts.find(x => x.id === 'p_feed');
  p.replies = p.replies.filter(r => !(r.char && String(r.char.id) === '3001'));
});
aiReply = '没有标记的一句话。';
await page.evaluate(async () => {
  const p = globalPosts.find(x => x.id === 'p_feed');
  const npcs = p.replies.map(r => ({ name: r.char.name, text: r.text, _replyId: r.id }));
  await maybeCharsReactToNpcComments(npcs, {
    kind: 'post', post: p, postText: p.text, authorChar: myCharacters[0],
    authorName: myCharacters[0].name, postId: 'p_feed',
  });
});
await page.waitForTimeout(900);
const noMark = await page.evaluate(() => {
  const p = globalPosts.find(x => x.id === 'p_feed');
  const cr = p.replies.find(r => r.char && String(r.char.id) === '3001');
  const parent = p.replies.find(r => r.id === (cr || {}).parentId);
  return { text: cr && cr.text, parentName: parent && parent.char && parent.char.name };
});
check('角色没写标记时，退回"挂最后一条"的老行为，不报错也不丢内容',
  noMark.text === '没有标记的一句话。' && noMark.parentName === '匿名研究员', JSON.stringify(noMark));

// —— 同一个路人换个帖子还是同一个账号 ——
const stable = await page.evaluate(() => {
  const a = getNpcIdentity('璃月矿石鉴定师');
  const b = getNpcIdentity('璃月矿石鉴定师');
  const c = getNpcIdentity('另一个人');
  return { same: a.handle === b.handle && a.avatarEmoji === b.avatarEmoji, diff: a.handle !== c.handle, h: a.handle };
});
check('同一个路人在别处出现还是同一个账号（像常驻网友，不是一次性路人）',
  stable.same && stable.diff, JSON.stringify(stable));

const persisted = await page.evaluate(async () => {
  saveAllData();
  const d = await localforage.getItem('myTwitterAppData');
  return d && d.npcIdentities && Object.keys(d.npcIdentities).length >= 3;
});
check('路人身份存进了存档（刷新之后还是这些老熟人）', persisted);


// ================= 让评论区活起来 =================

// —— 路人有固定人格，且稳定 ——
const traits = await page.evaluate(() => ({
  a: getNpcTrait('璃月矿石鉴定师'),
  a2: getNpcTrait('璃月矿石鉴定师'),
  b: getNpcTrait('至冬吃瓜群众'),
}));
check('路人有自己的固定人格', !!traits.a && traits.a.length > 2, JSON.stringify(traits));
check('同一个路人的人格是稳定的（到哪都是这个调性）', traits.a === traits.a2, JSON.stringify(traits));

// —— 路人之间互相接话 ——
const argued = await page.evaluate(() => {
  npcArgueProb = 1;   // 必定触发，好验证
  const p = globalPosts.find(x => x.id === 'p_feed');
  const before = p.replies.length;
  const npcs = p.replies.filter(r => r.char && r.char.isNpc).map(r => ({ name: r.char.name, text: r.text, _replyId: r.id }));
  return npcArgueWithEachOther(p, npcs, {}).then(did => {
    const added = p.replies.slice(before);
    const one = added[0];
    const parent = one && p.replies.find(r => r.id === one.parentId);
    return {
      did, text: one && one.text,
      speaker: one && one.char && one.char.name,
      target: parent && parent.char && parent.char.name,
      replyTo: one && one.replyTo,
    };
  });
});
check('路人之间会互相接话', argued.did && argued.text === '楼上这话说得就外行了。', JSON.stringify(argued));
check('接话是挂在被回的那个路人下面的（楼中楼，不是飘在最外层）',
  !!argued.target && argued.replyTo === argued.target, JSON.stringify(argued));
check('接话的和被接的不是同一个人', argued.speaker !== argued.target, JSON.stringify(argued));

// —— 路人点赞 ——
const liked = await page.evaluate(() => {
  const p = globalPosts.find(x => x.id === 'p_feed');
  p.stats.likes = 0; p.stats.retweets = 0;
  p.replies.forEach(r => { r.likes = 0; r.likedBy = []; });
  // 跑几轮，随机性拉平
  for (let i = 0; i < 30; i++) npcCasualLikes(p, p.replies);
  return {
    postLikes: p.stats.likes,
    retweets: p.stats.retweets,
    anyReplyLiked: p.replies.some(r => (r.likes || 0) > 0),
    likedByNpc: p.replies.some(r => (r.likedBy || []).includes('npc')),
  };
});
check('路人会给帖子点赞/转发（不只是评论）', liked.postLikes > 0 && liked.retweets > 0, JSON.stringify(liked));
check('评论也会被点赞', liked.anyReplyLiked && liked.likedByNpc, JSON.stringify(liked));

// —— 角色不秒回 ——
const delay = await page.evaluate(() => {
  charReplyDelayEnabled = true;
  const fresh = { timestamp: Date.now() };
  const old = { timestamp: Date.now() - 60 * 60 * 1000 };
  const r = { fresh: charReplyDelayMs(fresh), old: charReplyDelayMs(old) };
  charReplyDelayEnabled = false;
  r.off = charReplyDelayMs(old);
  return r;
});
check('角色不再秒回，刚发的帖子也要等几秒', delay.fresh >= 4000, JSON.stringify(delay));
check('刷到旧帖子拖得更久（像真的刚看到）', delay.old > delay.fresh, JSON.stringify(delay));
check('开关关掉就是老行为（立刻回）', delay.off === 0, JSON.stringify(delay));

// —— 所有角色都能来，但只花一次筛选请求 ——
await page.evaluate(() => {
  myCharacters.push({ id: 3002, name: '散兵', persona: '毒舌，爱嘲讽。', worldbooks: [] });
  myCharacters.push({ id: 3003, name: '心海', persona: '温和的军师。', worldbooks: [] });
  myCharacters.push({ id: 3004, name: '钟离', persona: '沉稳博学。', worldbooks: [] });
  myCharacters.push({ id: 3005, name: '派蒙', persona: '话痨向导。', worldbooks: [] });
});
interestedIdx = [1, 3];   // 只有第 1、3 个想插嘴
const picked = await page.evaluate(async () => {
  const others = myCharacters.filter(c => c.id !== 3001);
  const r = await pickInterestedChars(others, { postText: '今日会议纪要' }, '路人甲：随便说说');
  return { names: r.map(c => c.name), total: others.length };
});
check('所有角色都进候选（不再只随机抽 2 个）', picked.total === 4, JSON.stringify(picked));
check('筛选出真正感兴趣的那几个', picked.names.length === 2, JSON.stringify(picked.names));

interestedIdx = [];
const none = await page.evaluate(async () => {
  const others = myCharacters.filter(c => c.id !== 3001);
  return (await pickInterestedChars(others, { postText: 'x' }, 'y')).length;
});
check('没人想说就一个都不出场（不硬凑互动）', none === 0, '出场了 ' + none + ' 个');

const fewChars = await page.evaluate(async () => {
  const two = myCharacters.slice(0, 2);
  return (await pickInterestedChars(two, { postText: 'x' }, 'y')).length;
});
check('角色少于等于 2 个时不浪费那次筛选请求，直接全算候选', fewChars === 2, '拿到 ' + fewChars);


// ================= 引用消息 / 秒回开关 =================

// —— 群聊引用：被引用的那句必须带主语，任何角色都不能认领错 ——
const quoted = await page.evaluate(() => {
  myCharacters.push({ id: 7201, name: '甲', persona: 'x', worldbooks: [] });
  myCharacters.push({ id: 7202, name: '乙', persona: 'x', worldbooks: [] });
  currentUser.name = '林';
  const msgs = [
    { sender: 7201, text: '我昨天去了矿区。', timestamp: Date.now() },
    { sender: 7202, text: '那边最近不太平。', timestamp: Date.now() },
    // 用户引用了「乙」说的那句，然后问"这句什么意思"
    { sender: 'me', text: '这句什么意思？', timestamp: Date.now(),
      quote: { name: '乙', text: '那边最近不太平。' } },
  ];
  return {
    group: buildTimeAwareHistoryTurns(msgs, '甲', { groupMode: true }),
    text: buildTimeAwareHistoryText(msgs, '甲'),
  };
});
const userTurn = quoted.group.filter(t => t.role === 'user').map(t => t.content).join('\n');
check('用户消息的引用不再被丢掉（以前 AI 根本看不到引的是什么）',
  userTurn.includes('那边最近不太平'), userTurn);
check('引用里写明了是谁说的（角色才不会认领成自己的话）',
  userTurn.includes('乙 说过'), userTurn);
check('用词是"引用"不是"回复"（"回复X"容易被理解成"我回复了X"）',
  userTurn.includes('引用') && !userTurn.includes('[回复 乙'), userTurn);
check('纯文本版历史也用同一套引用写法', quoted.text.includes('乙 说过'), quoted.text);

// 角色自己带引用的消息同样带主语
const charQuoted = await page.evaluate(() => {
  const msgs = [{ sender: 7201, text: '确实。', timestamp: Date.now(),
    quote: { name: '乙', text: '那边最近不太平。' } }];
  return buildTimeAwareHistoryTurns(msgs, '甲', { groupMode: true })[0].content;
});
check('角色带引用的发言也标了引的是谁',
  charQuoted.includes('甲：') && charQuoted.includes('乙 说过'), charQuoted);

// —— 秒回开关 ——
const toggle = await page.evaluate(() => {
  const box = document.getElementById('settingCharReplyDelay');
  if (!box) return { missing: true };
  box.checked = false; saveGlobalInteractionSettings();
  const off = { flag: charReplyDelayEnabled, delay: charReplyDelayMs({ timestamp: Date.now() - 3600000 }) };
  box.checked = true; saveGlobalInteractionSettings();
  const on = { flag: charReplyDelayEnabled, delay: charReplyDelayMs({ timestamp: Date.now() - 3600000 }) };
  return { off, on, saved: localStorage.getItem('settingCharReplyDelay') };
});
check('设置页有"不要秒回"的开关', !toggle.missing);
check('关掉开关 = 立刻回复（老行为）', toggle.off.flag === false && toggle.off.delay === 0, JSON.stringify(toggle.off));
check('打开开关 = 隔一会儿才回', toggle.on.flag === true && toggle.on.delay > 0, JSON.stringify(toggle.on));
check('开关状态存下来了，改完立刻生效不用刷新', toggle.saved === 'true', toggle.saved);

const argueToggle = await page.evaluate(() => {
  const box = document.getElementById('settingNpcArgue');
  if (!box) return { missing: true };
  box.checked = false; saveGlobalInteractionSettings();
  const off = npcArgueProb;
  box.checked = true; saveGlobalInteractionSettings();
  return { off, on: npcArgueProb };
});
check('"路人互相接话"也有开关，关掉就完全不吵',
  argueToggle.off === 0 && argueToggle.on > 0, JSON.stringify(argueToggle));


// ================= 卡片观察者不能拖慢整个界面 =================
// 那个盯着整个 body 的 MutationObserver，回调里必须先做 O(1) 的"有没有卡片等着挂"判断。
// 少了这层判断，聊天记录几百条、或者导入备份重建界面时，回调会被触发上万次、
// 每次扫一大片 DOM，主线程卡死 —— 表现就是"聊天框打不了字""导入备份后只能大退"。
const perf = await page.evaluate(() => {
  myCharacters.push({ id: 4001, name: '压测角色', persona: 'x', worldbooks: [] });
  globalChats['4001'] = [];
  for (let i = 0; i < 400; i++) {
    globalChats['4001'].push({ sender: i % 2 ? 4001 : 'me',
      text: '这是第' + i + '条消息，随便写点内容凑长度。', timestamp: Date.now() - (400 - i) * 60000, readBy: [] });
  }
  switchMainView('chat'); switchChatSession('4001');
  renderChatMessages();                       // 预热一次，不计入
  const t0 = performance.now();
  for (let k = 0; k < 5; k++) renderChatMessages();
  return { per: (performance.now() - t0) / 5, pending: __frontendPending.size };
});
check('没有卡片等着挂载时，观察者不该有任何积压', perf.pending === 0, JSON.stringify(perf));
check('400 条聊天记录重渲染不能慢到卡死界面（单次 < 450ms）',
  perf.per < 450, '实测单次 ' + Math.round(perf.per) + 'ms');

// 输入框在 AI 回复之后仍然可用
const inputOk = await page.evaluate(() => {
  globalChats['4001'].push({ sender: 4001, text: '我在。', timestamp: Date.now(), readBy: [] });
  renderChatMessages();
  const el = document.getElementById('chatInput');
  const r = el.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  el.focus(); el.value = '能打字吗';
  return { disabled: el.disabled, readOnly: el.readOnly, w: Math.round(r.width),
    topIsInput: top === el, typed: el.value, focused: document.activeElement === el };
});
check('AI 回复之后输入框没被禁用、没被别的东西盖住、还能打字',
  !inputOk.disabled && !inputOk.readOnly && inputOk.w > 0 && inputOk.topIsInput
  && inputOk.typed === '能打字吗' && inputOk.focused, JSON.stringify(inputOk));

await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
if (pageErrors.length) { console.log('\n页面报错:'); pageErrors.slice(0, 5).forEach(e => console.log('  ' + e)); }
process.exit(bad.length ? 1 : 0);
