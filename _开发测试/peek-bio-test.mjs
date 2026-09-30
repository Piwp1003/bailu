// 👣 偷翻日记（没被允许的，按人设决定翻不翻，留痕迹，TA 记得）+ 🕘 过往签名 + 论坛/匿名区回帖 + 自己发朋友圈
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('dialog', d => d.accept());
let PEEK = { look: true, why: '忍不住', trace: '书签从第三页挪到了最后一页，还沾了点墨水', remember: '她说最近总是失眠' };
let DECIDE = { plan: [], nextIn: 60 };
const prompts = [];
await page.route(/^https?:\/\//, async r => {
  const u = r.request().url();
  if (!/chat\/completions/.test(u)) return r.abort();
  let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
  const all = JSON.stringify(body.messages || body.prompt || '');
  prompts.push(all);
  let content = 'NO';
  if (all.includes('【你能做的事】')) content = JSON.stringify(DECIDE);
  else if (all.includes('你在逛小说论坛')) content = '这个设定我喜欢，楼主继续写';
  else if (all.includes('你在逛匿名论坛')) content = '说真的，别熬夜了';
  else if (all.includes('看，还是不看')) content = JSON.stringify(PEEK);
  else if (all.includes('你想发一条朋友圈')) content = JSON.stringify({ moment: '店里来了只三花。', comments: [{ who: '顾迟', t: '明天去看' }, { who: '陌生人', t: '好可爱' }] });
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && GY_AUTONOMY_ACTIONS.some(a => a.key === 'diary_peek'), { timeout: 20000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  myApiKey = 'sk-test'; myApiUrl = 'https://api.test.local/v1'; myModel = 'm';
  myCharacters.length = 0;
  myCharacters.push({ id: 8401, name: '沈之遥', handle: '@shen', persona: '旧书店老板，好奇心重', worldbooks: [], actMode: 'auto', bio: '旧书店，下午两点开门' },
                     { id: 8402, name: '顾迟', handle: '@gu', persona: '夜班医生', worldbooks: [] });
  charRelationships.length = 0; charRelationships.push({ id: 'r1', fromId: 8401, toId: 8402, label: '老朋友' });
  localStorage.setItem('settingEnableCharInteraction', 'true');
  globalUserDiaries.length = 0;
  // 一篇只让顾迟偷看、没让沈之遥看；一篇主动邀请顾迟看
  globalUserDiaries.push({ id: 'd1', title: '失眠', content: '最近总是失眠，凌晨三点还醒着。', date: Date.now() - 3600000, mode: 'peek', reactions: [{ charId: 8402, status: 'pending', dueAt: Date.now() + 9e9 }] },
                         { id: 'd2', title: '给你看', content: '今天很开心。', date: Date.now(), mode: 'invite', reactions: [{ charId: 8402, status: 'pending', dueAt: Date.now() + 9e9 }] });
  forumThreads.length = 0;
  forumThreads.push({ id: 'ft1', title: '【原创】雨夜书店', author: '楼主', charId: 'me', content: '写了个小故事……', replies: [], timestamp: Date.now() });
  anonPosts.length = 0;
  anonPosts.push({ id: 'anon_1', charId: 'me', anonName: '匿名用户', anonId: 'User', text: '又失眠了', timestamp: Date.now(), replies: [], stats: { likes: 0, comments: 0 } });
  globalNotifications.length = 0;
  setAutoFeature('charAutonomy', true, true);
});

// ---------- 一、偷翻日记 ----------
const need = await page.evaluate(() => { const a = GY_AUTONOMY_ACTIONS.find(x => x.key === 'diary_peek'); return { shen: a.need(myCharacters[0]), gu: a.need(myCharacters[1]) }; });
check('没被允许看的日记：沈之遥可能去翻（在他能做的事里）', need.shen, JSON.stringify(need));
check('被允许看的、主动邀请的：不算偷翻（顾迟那边没有这件事）', !need.gu, JSON.stringify(need));

DECIDE = { plan: [{ action: 'diary_peek', after: 0, reason: '好奇' }], nextIn: 60 };
const r1 = await page.evaluate(async () => { const r = await runAutonomyTurn(myCharacters[0], true); return (r.entries || []).map(e => e.result); });
const d1 = await page.evaluate(() => globalUserDiaries.find(d => d.id === 'd1'));
check('翻了：日记上留下了痕迹', (d1.secretPeeks || []).length === 1 && d1.secretPeeks[0].trace.includes('书签'), JSON.stringify(d1.secretPeeks));
check('日志里不写翻了什么（不剧透）', r1[0] && !r1[0].includes('日记'), JSON.stringify(r1));
const nt = await page.evaluate(() => globalNotifications.map(n => n.text));
check('通知只说"好像被人翻过"，不说是谁', nt.some(t => t.includes('好像被人翻过')) && !nt.some(t => t.includes('沈之遥') && t.includes('翻')), JSON.stringify(nt));
await page.evaluate(() => { switchMainView('diary'); switchDiaryTab('mydiary'); renderMyDiaryArea(); });
await page.waitForTimeout(200);
const ui = await page.evaluate(() => document.getElementById('myDiaryListContainer').innerText);
check('日记页上能看到痕迹', ui.includes('这篇好像被人翻过') && ui.includes('书签'), ui.slice(0, 200));
check('日记页上也不写是谁', !/沈之遥.*翻/.test(ui));
const ctx = await page.evaluate(() => getBoxPrompt(myCharacters[0]));
check('TA 记得这件事：进了 TA 的提示词（被问起按人设应对）', ctx.includes('偷偷翻过') && ctx.includes('失眠') && ctx.includes('按你的人设来'), ctx.slice(0, 200));
check('同一篇翻过就不再翻', await page.evaluate(() => !GY_AUTONOMY_ACTIONS.find(x => x.key === 'diary_peek').need(myCharacters[0])));

// 按人设决定不翻
await page.evaluate(() => globalUserDiaries.push({ id: 'd3', title: '秘密', content: '不告诉你', date: Date.now(), mode: 'peek', reactions: [] }));
const card = await page.evaluate(() => (gyTaRhythm(myCharacters[0]) || []).find(r => r.act === 'diary_peek'));
check('时间管理大师那张卡不写"上一次是什么时候"（不然一看就露馅）', card && !card.last, JSON.stringify(card));

PEEK = { look: false, why: '偷看不好' };
await page.evaluate(async () => { await runAutonomyTurn(myCharacters[0], true); });
check('TA 决定不翻：没有痕迹', await page.evaluate(() => !(globalUserDiaries.find(d => d.id === 'd3').secretPeeks || []).length));

// ---------- 二、过往签名 ----------
DECIDE = { plan: [{ action: 'bio_update', after: 0, reason: '心情变了', param: '今天不开门' }, { action: 'bio_update', after: 0, reason: '又变了', param: '明天也不开' }], nextIn: 60 };
await page.evaluate(async () => { await runAutonomyTurn(myCharacters[0], true); });
check('改了两次签名，过往签名里记着两条', await page.evaluate(() => (myCharacters[0].bioHistory || []).map(x => x.bio).join('|') === '旧书店，下午两点开门|今天不开门'), await page.evaluate(() => JSON.stringify(myCharacters[0].bioHistory)));
await page.evaluate(() => { switchMainView('profile', '8401'); });
await page.waitForTimeout(300);
check('TA 的主页签名下面有「🕘 过往签名（2）」', await page.evaluate(() => (document.getElementById('profBioHist') || {}).innerText === '🕘 过往签名（2）'));
await page.evaluate(() => document.querySelector('#profBioHist span').click());
await page.waitForTimeout(200);
const bh = await page.evaluate(() => (document.getElementById('gyBioHistModal') || {}).innerText || '');
check('点开能看到现在的签名和以前的每一条', bh.includes('明天也不开') && bh.includes('今天不开门') && bh.includes('旧书店，下午两点开门'), bh.slice(0, 200));
await page.evaluate(() => document.getElementById('gyBioHistModal').remove());
// 你在编辑页改，也记
await page.evaluate(() => gyBioRemember(myCharacters[1], '旧签名'));
check('编辑页里改签名也记进过往', await page.evaluate(() => (myCharacters[1].bioHistory || []).some(x => x.bio === '旧签名')));

// ---------- 三、论坛 / 匿名区回帖、发朋友圈 ----------
globalThis.x = 0;
DECIDE = { plan: [{ action: 'forum_reply', after: 0, reason: '感兴趣' }, { action: 'anon_reply', after: 0, reason: '看不下去' }, { action: 'moment_self', after: 0, reason: '想发' }], nextIn: 60 };
await page.evaluate(async () => { globalNotifications.length = 0; await runAutonomyTurn(myCharacters[0], true); });
const fr = await page.evaluate(() => ({ f: forumThreads[0].replies.map(r => r.author + '：' + r.content), a: anonPosts[0].replies.map(r => r.text),
  m: gyPeerMoments(8401), n: globalNotifications.map(n => n.text) }));
check('论坛回帖：真的回在那个帖子里', fr.f.includes('沈之遥：这个设定我喜欢，楼主继续写'), JSON.stringify(fr.f));
check('匿名区回帖：真的回了', fr.a.includes('说真的，别熬夜了'), JSON.stringify(fr.a));
check('匿名区的通知不写是谁', fr.n.some(t => t.includes('有人在匿名区回了一条')) && !fr.n.some(t => t.includes('沈之遥') && t.includes('匿名')), JSON.stringify(fr.n));
check('发朋友圈：进了 TA 手机的朋友圈，只留认识的人的评论', fr.m.length === 1 && fr.m[0].t === '店里来了只三花。' && fr.m[0].cm.length === 1 && fr.m[0].cm[0].by === '顾迟', JSON.stringify(fr.m));

check('整个过程没有页面报错', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
