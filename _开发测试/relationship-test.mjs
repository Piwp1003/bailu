// 「角色跟用户有关系的时候，别因为人设写着高冷就变成不活人」
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('dialog', d => d.accept());

let calls = [];
await page.route(/^https?:\/\//, r => r.abort());
await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=v;return Promise.resolve(v)},getItem(k){return Promise.resolve(this._d[k]??null)},removeItem(k){return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));
await page.route('**/chat/completions', async route => {
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
  const m = body.messages || [];
  calls.push(m.map(x => String(x.content || '')).join('\n@@@\n'));
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: '{"replies":[{"delay":0,"text":"嗯。"}]}' } }] }) });
});

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof window.getRelationshipContextPrompt === 'function', { timeout: 15000 });
await page.waitForTimeout(400);

const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok, extra });

const COOL = '三十四岁，旧书店老板。沉默寡言，话很少，不爱说话，独来独往。';

await page.evaluate((persona) => {
  myCharacters.length = 0;
  myCharacters.push({ id: 9001, name: '沈之遥', handle: '@shen', persona, worldbooks: [] });
  myCharacters.push({ id: 9002, name: '路人甲', handle: '@lu', persona, worldbooks: [] });
  currentUser.name = '阿岚';
  myApiUrl = 'https://api.test.local/v1'; myApiKey = 'sk-test'; myModel = 'gpt-test';
  charRelationships.length = 0;
}, COOL);

// ---- 1. 没有关系记录：老行为不变 ----
let p = await page.evaluate(() => getRelationshipContextPrompt(myCharacters[0]));
check('没有任何关系时，还是那句"你现在谁都不认识"', p.includes('谁都不认识'), p.slice(0, 200));
check('没关系的高冷角色仍然走"只点赞"分支', await page.evaluate(() => isCoolTowardUser(myCharacters[0])));

// ---- 2. 跟用户建立关系之后 ----
await page.evaluate(() => {
  charRelationships.push({ fromId: 9001, toId: 'me', label: '情侣' });
  charRelationships.push({ fromId: 9001, toId: 9002, label: '旧识' });
});
p = await page.evaluate(() => getRelationshipContextPrompt(myCharacters[0]));

check('跟用户的关系被单独拎出来放最前面', p.trim().startsWith('【你和阿岚的关系】：情侣'), p.slice(0, 160));
check('说明了态度由关系决定，而不是由默认性格决定', p.includes('由这份关系决定'), p.slice(0, 600));
check('明说了人设里的高冷写的是面对泛泛之交时的状态', p.includes('泛泛之交'), p.slice(0, 600));
check('"沉默＝缺席"这层意思说清楚了',
  p.includes('不该是"干脆不出现"') && p.includes('不在场'), p.slice(0, 800));

// ★ 关键：这段话对**任何**关系标签都得成立，不能只为"情侣"这种亲近关系写
// 标签还是用户自己能随便新建的，所以更不能按关键词分支
const LABELS = ['情侣', '敌对', '宿敌', '上司下属', '债主', '前任', '师徒', '一面之缘', '我自己编的一个标签'];
const labelFails = [];
for (const label of LABELS) {
  const txt = await page.evaluate((lb) => {
    charRelationships.length = 0;
    charRelationships.push({ fromId: 9001, toId: 'me', label: lb });
    return getRelationshipContextPrompt(myCharacters[0]);
  }, label);
  // 标签必须原样出现；不能出现任何预设"你们关系很好"的措辞
  const ok = txt.includes('【你和阿岚的关系】：' + label)
    && txt.includes('由这份关系决定')
    && txt.includes('不在场')
    && !/亲近的人|关系里的人|你们很亲密|感情好/.test(txt);
  if (!ok) labelFails.push(label + ' → ' + txt.slice(0, 200));
}
check('九种关系标签（含自定义）都能正常生成，且措辞不预设"关系亲近"',
  labelFails.length === 0, labelFails.join('\n       '));

const hostile = await page.evaluate(() => {
  charRelationships.length = 0;
  charRelationships.push({ fromId: 9001, toId: 'me', label: '敌对' });
  return getRelationshipContextPrompt(myCharacters[0]);
});
check('敌对关系下，给的落地方式包含"呛回去/冷嘲/不想理"这类，而不是让它变热情',
  hostile.includes('呛回去') && hostile.includes('明确表示不想理'), hostile.slice(0, 700));
check('敌对关系下也一样不许"完全不出现"',
  hostile.includes('敌意很重') && hostile.includes('不会凭空消失'), hostile.slice(0, 800));
check('敌对角色同样不再被锁进"只能点赞"（有敌意也得能说话）',
  await page.evaluate(() => isCoolTowardUser(myCharacters[0]) === false));

// 恢复成情侣，后面的用例接着用
await page.evaluate(() => {
  charRelationships.length = 0;
  charRelationships.push({ fromId: 9001, toId: 'me', label: '情侣' });
  charRelationships.push({ fromId: 9001, toId: 9002, label: '旧识' });
});
p = await page.evaluate(() => getRelationshipContextPrompt(myCharacters[0]));
check('跟其他角色的关系还在，只是排在后面',
  p.includes('你和其他人的关系') && p.includes('"路人甲"的关系：旧识'), p.slice(0, 600));
check('陌生人规则还在（防止跟没记录的人自来熟）', p.includes('仅限这份名单'));
check('用户不会在"其他人"那份名单里重复出现',
  (p.match(/阿岚/g) || []).length >= 1 && !p.includes('- 你与"阿岚"的关系'), p.slice(0, 600));

// ---- 3. 关键：高冷 + 有关系 → 不再被代码锁死成"只能点赞" ----
check('有关系之后，高冷角色不再被锁进"只点赞"',
  await page.evaluate(() => isCoolTowardUser(myCharacters[0]) === false));
check('同样人设但没跟用户建立关系的角色，仍然是高冷路线',
  await page.evaluate(() => isCoolTowardUser(myCharacters[1]) === true));
check('isCoolPersona 本身没被改坏（还是按关键词判人设）',
  await page.evaluate(() => isCoolPersona(myCharacters[0].persona) === true));
check('hasBondWithUser 认得出双向写法', await page.evaluate(() => {
  charRelationships.push({ fromId: 'me', toId: 9002, label: '网友' });
  const ok = hasBondWithUser(myCharacters[1]);
  charRelationships.pop();
  return ok === true;
}));

// ---- 4. 评论区的提示词里要真的带上这段（不只是函数返回对） ----
calls = [];
await page.evaluate(async () => {
  npcReplyProb = 0; postWordLimit = 50;
  globalPosts.length = 0;
  globalPosts.push({ id: '7001', char: { ...currentUser }, text: '今天下雨了。',
    timestamp: Date.now(), stats: { comments: 0, likes: 0, retweets: 0 }, replies: [] });
  switchMainView('home'); renderSinglePostDetail('7001');
  document.getElementById('myCommentInput').value = '你那边也下了吗';
  await postUserComment('7001');
});
await page.waitForTimeout(2000);
// 两个角色人设一模一样，区别只在于有没有跟用户建关系 —— 正好是一组对照
const forShen = calls.find(c => c.includes('你是"沈之遥"')) || '';
const forLu   = calls.find(c => c.includes('你是"路人甲"')) || '';
check('两个角色都发起了评论请求', !!forShen && !!forLu, '沈之遥=' + !!forShen + ' 路人甲=' + !!forLu);
check('评论生成的提示词里带了"你和阿岚的关系：情侣"',
  forShen.includes('【你和阿岚的关系】：情侣'), forShen.slice(-500));
check('【对照】有关系的高冷角色，拿到的不再是"只能点赞"那版',
  !forShen.includes('你性格高冷，通常只点赞'), '沈之遥还是拿到了只点赞版');
check('【对照】同样人设但没关系的角色，照旧走"只点赞"（这条不该被改坏）',
  forLu.includes('你性格高冷，通常只点赞'), '路人甲没走只点赞版');

// ---- 5. 聊天里也要带上 ----
calls = [];
await page.evaluate(() => {
  globalChats['9001'] = [{ sender: 'me', text: '在吗', timestamp: Date.now(), readBy: [] }];
  switchMainView('chat'); switchChatSession('9001');
  return triggerAIBatchReply('9001', '在吗');
});
await page.waitForTimeout(2000);
check('聊天的提示词里也带了这段关系',
  calls.join('').includes('【你和阿岚的关系】：情侣'), (calls[0] || '').slice(0, 300));

await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
