// 「删掉角色在帖子下的评论之后，评论框空着点回复 = 让角色重新评论一次」
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
  const msgs = body.messages || [];
  const last = String((msgs[msgs.length - 1] || {}).content || body.prompt || '');
  calls.push(last);
  return route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: nextReply(calls.length) } }] })
  });
});
// 每个测试自己决定角色"回了什么"：默认就是普通一句话
let nextReply = (n) => '角色的新评论 ' + n;

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof window.postUserComment === 'function', { timeout: 15000 });
await page.waitForTimeout(400);

const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok, extra });

// 一条用户发的推文 + 一个会评论的角色
async function seed(replies) {
  await page.evaluate((list) => {
    myCharacters.length = 0;
    myCharacters.push({ id: 9001, name: '沈之遥', handle: '@shen', persona: '旧书店老板', worldbooks: [] });
    myApiUrl = 'https://api.test.local/v1'; myApiKey = 'sk-test'; myModel = 'gpt-test';
    npcReplyProb = 0;              // 关掉路人，只测角色
    postWordLimit = 50;
    globalPosts.length = 0;
    globalPosts.push({
      id: '5001', char: { ...currentUser }, text: '今天在旧书店躲雨。',
      timestamp: Date.now(), stats: { comments: 0, likes: 0, retweets: 0 },
      replies: list.map((r, i) => r.me
        ? { id: 'r_me_' + i, parentId: null, char: { ...currentUser }, text: r.text, timestamp: Date.now(), likes: 0, likedBy: [] }
        : { id: 'r_ch_' + i, parentId: 'r_me_0', char: myCharacters[0], text: r.text, timestamp: Date.now(), likes: 0, likedBy: [] })
    });
    switchMainView('home');
    renderSinglePostDetail('5001');
    document.getElementById('view-post-detail').style.display = 'block';
    const inp = document.getElementById('myCommentInput');
    if (inp) inp.value = '';
  }, replies);
  await page.waitForTimeout(300);
}
const replyTexts = () => page.evaluate(() =>
  (globalPosts[0].replies || []).map(r => ((r.char && r.char.id === 'me') ? '我：' : 'TA：') + r.text));

// ---- 1. 我评论过、角色的回复被删掉了 → 空着点回复要能重新生成 ----
calls = [];
await seed([{ me: true, text: '雨好大啊' }]);
await page.evaluate(() => postUserComment('5001'));
await page.waitForTimeout(1800);
check('空着点回复触发了一次生成', calls.length === 1, '实际发了 ' + calls.length + ' 次');
check('用的是我最后那条评论当触发点', calls[0] && calls[0].includes('雨好大啊'), (calls[0] || '').slice(0, 150));
check('角色的新评论落地了', (await replyTexts()).some(t => t.startsWith('TA：角色的新评论')), JSON.stringify(await replyTexts()));
check('没有凭空多出一条我的评论',
  (await replyTexts()).filter(t => t.startsWith('我：')).length === 1, JSON.stringify(await replyTexts()));

// ---- 2. 我有好几条评论：应该拿最后那条 ----
calls = [];
await seed([{ me: true, text: '雨好大啊' }, { me: true, text: '书都受潮了吧' }]);
await page.evaluate(() => postUserComment('5001'));
await page.waitForTimeout(1800);
check('拿的是最后一条评论，不是第一条',
  calls[0] && calls[0].includes('书都受潮了吧'), (calls[0] || '').slice(0, 150));

// ---- 3. 我一条评论都没发过 → 不该硬生成，要说清楚为什么 ----
calls = [];
await seed([]);
// 通知条最多同时显示 2 条（设置里可调），前面两轮留下的"回复了您的评论"会把名额占满——先清掉
await page.evaluate(() => { document.getElementById('toastContainer').innerHTML = ''; });
await page.evaluate(() => postUserComment('5001'));
await page.waitForTimeout(900);
check('没有我的评论时不触发生成', calls.length === 0, '却发了 ' + calls.length + ' 次');
check('会弹提示说明原因，而不是默默没反应',
  await page.evaluate(() => (document.getElementById('toastContainer').innerText || '').includes('没什么可以重新生成')),
  await page.evaluate(() => document.getElementById('toastContainer').innerText));

// ---- 4. 输入框里有字时，还是照常发评论（别把正常流程弄坏） ----
calls = [];
await seed([]);
await page.evaluate(() => { document.getElementById('myCommentInput').value = '第一次评论'; return postUserComment('5001'); });
await page.waitForTimeout(1800);
const t4 = await replyTexts();
check('有内容时正常发评论', t4.some(t => t === '我：第一次评论'), JSON.stringify(t4));
check('发完也照常触发了角色回应', calls.length === 1, '发了 ' + calls.length + ' 次');
check('发完输入框清空', await page.evaluate(() => document.getElementById('myCommentInput').value === ''));

// ---- 5. 提示语要能被看见 ----
await seed([{ me: true, text: '雨好大啊' }]);
check('我评论过之后，输入框提示"留空点回复"',
  (await page.getAttribute('#myCommentInput', 'placeholder')).includes('留空点回复'),
  await page.getAttribute('#myCommentInput', 'placeholder'));
await seed([]);
check('没评论过时提示恢复正常',
  !(await page.getAttribute('#myCommentInput', 'placeholder')).includes('留空点回复'),
  await page.getAttribute('#myCommentInput', 'placeholder'));

// ---- 6. 连点两下不叠 ----
calls = [];
await seed([{ me: true, text: '雨好大啊' }]);
await page.evaluate(() => { postUserComment('5001'); postUserComment('5001'); });
await page.waitForTimeout(1800);
check('连点两次只生成一轮', calls.length === 1, '实际发了 ' + calls.length + ' 次');

// ---- 7. 多条评论时：角色能自己挑一条回，回复挂到它挑的那条下面 ----
calls = [];
nextReply = () => '[回复1]这条我接一下';       // 故意挑第一条，不是最后一条
await seed([
  { me: true, text: '雨好大啊' },
  { me: true, text: '书都受潮了吧' },
  { me: true, text: '要不要我带把伞过去' },
]);
await page.evaluate(() => postUserComment('5001'));
await page.waitForTimeout(1800);
check('提示词里给了编号列表，三条都在',
  calls[0] && calls[0].includes('雨好大啊') && calls[0].includes('书都受潮了吧') && calls[0].includes('要不要我带把伞过去'),
  (calls[0] || '').slice(0, 300));
check('提示词允许它不出声（NO）', calls[0] && calls[0].includes('直接输出 NO'), (calls[0] || '').slice(0, 400));
const parent = await page.evaluate(() => {
  const rs = globalPosts[0].replies;
  const mine = rs.filter(r => r.char && r.char.id === 'me');
  const chReply = rs.find(r => r.char && r.char.id === 9001);
  return chReply ? { parentId: chReply.parentId, firstMineId: mine[0].id, text: chReply.text } : null;
});
check('回复挂到了它挑的那条（第1条）下面，不是默认最后一条',
  parent && parent.parentId === parent.firstMineId, JSON.stringify(parent));
check('[回复N] 这个标记不会留在正文里', parent && parent.text === '这条我接一下', JSON.stringify(parent));

// ---- 8. 角色输出 NO：这一轮就不出声（"条数不固定"靠的就是这个） ----
calls = [];
nextReply = () => 'NO';
await seed([{ me: true, text: '雨好大啊' }, { me: true, text: '书都受潮了吧' }]);
const before8 = (await replyTexts()).length;
await page.evaluate(() => postUserComment('5001'));
await page.waitForTimeout(1800);
check('角色说 NO 就真的不出声，不再强行转成点赞',
  (await replyTexts()).length === before8, JSON.stringify(await replyTexts()));

// ---- 9. 点赞也要落到它挑的那条上 ----
calls = [];
nextReply = () => '[回复2]LIKE';
await seed([{ me: true, text: '雨好大啊' }, { me: true, text: '书都受潮了吧' }]);
await page.evaluate(() => postUserComment('5001'));
await page.waitForTimeout(1800);
check('点赞挂在它挑的第2条上，不是第1条', await page.evaluate(() => {
  const mine = globalPosts[0].replies.filter(r => r.char && r.char.id === 'me');
  return (mine[1].likedBy || []).includes(9001) && !(mine[0].likedBy || []).includes(9001);
}), await page.evaluate(() => JSON.stringify(globalPosts[0].replies.filter(r => r.char && r.char.id === 'me').map(r => ({ t: r.text, likedBy: r.likedBy })))));

// ---- 10. 「角色回复开关」照常生效：关掉的角色一律不参与 ----
calls = [];
nextReply = () => '我来说两句';
await seed([{ me: true, text: '雨好大啊' }]);
await page.evaluate(() => { myCharacters[0].replyToUser = false; });
await page.evaluate(() => postUserComment('5001'));
await page.waitForTimeout(1200);
check('关掉"回复用户"的角色不参与重新生成', calls.length === 0, '却发了 ' + calls.length + ' 次');
await page.evaluate(() => { myCharacters[0].replyToUser = true; });

// ---- 11. 正常发评论那条路不受影响：还是所有人都得回最新那条 ----
calls = [];
nextReply = () => '收到';
await seed([{ me: true, text: '雨好大啊' }]);
await page.evaluate(() => { document.getElementById('myCommentInput').value = '新的一条'; return postUserComment('5001'); });
await page.waitForTimeout(1800);
check('正常发评论时不进"挑一条回"模式（提示词里没有编号列表）',
  calls[0] && !calls[0].includes('编号供你挑选'), (calls[0] || '').slice(0, 200));
check('正常发评论时回复挂在刚发的那条下', await page.evaluate(() => {
  const rs = globalPosts[0].replies;
  const newest = rs.filter(r => r.char && r.char.id === 'me').slice(-1)[0];
  const chReply = rs.find(r => r.char && r.char.id === 9001);
  return chReply && chReply.parentId === newest.id;
}));
nextReply = (n) => '角色的新评论 ' + n;

await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
