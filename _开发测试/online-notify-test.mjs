// 🌐 在线找资源（歌/片/书）+ 第二批自主动作（转发/影评/改日程/改签名/刷手机/分享歌…）+ 🔔 每件事弹通知能跳
// 所有外网请求都拦成本地假响应（iTunes / archive.org / 维基文库 / 古登堡），不联网。
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('dialog', d => d.accept());
let DECIDE = { plan: [], nextIn: 60 };
const prompts = [];
const J = o => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
await page.route(/^https?:\/\//, async r => {
  const u = r.request().url();
  if (/itunes\.apple\.com\/search/.test(u)) {
    const cb = new URL(u).searchParams.get('callback');
    return r.fulfill({ status: 200, contentType: 'text/javascript', body: `${cb}(${JSON.stringify({ results: [{ trackName: '晴天', artistName: '周杰伦', previewUrl: 'https://audio.test/qingtian.m4a', artworkUrl100: 'https://img.test/100x100.jpg' }] })});` });
  }
  if (/archive\.org\/advancedsearch/.test(u)) {
    const q = decodeURIComponent(new URL(u).searchParams.get('q') || '');
    if (/mediatype:movies/.test(q)) return r.fulfill(J({ response: { docs: [{ identifier: 'the_kid_1921', title: 'The Kid', creator: 'Chaplin', year: '1921' }] } }));
    return r.fulfill(J({ response: { docs: [{ identifier: 'jazz_cc', title: 'Night Jazz', creator: 'CC Band' }] } }));
  }
  if (/archive\.org\/metadata\/the_kid_1921/.test(u)) return r.fulfill(J({ files: [{ name: 'the_kid.ogv' }, { name: 'the_kid.mp4' }] }));
  if (/archive\.org\/metadata\/jazz_cc/.test(u)) return r.fulfill(J({ files: [{ name: 'track1.mp3' }] }));
  if (/zh\.wikisource\.org.*list=search/.test(u)) return r.fulfill(J({ query: { search: [{ title: '紅樓夢/第001回', snippet: '甄士隱夢幻識通靈' }] } }));
  if (/zh\.wikisource\.org.*action=parse/.test(u)) return r.fulfill(J({ parse: { text: { '*': '<div><p>' + '此開卷第一回也。作者自云：曾歷過一番夢幻之後，故將真事隱去。'.repeat(30) + '</p></div>' } } }));
  if (/gutendex\.com/.test(u)) return r.fulfill(J({ results: [] }));
  if (!/chat\/completions/.test(u)) return r.abort();
  let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
  const all = JSON.stringify(body.messages || body.prompt || '');
  prompts.push(all);
  let content = 'NO';
  if (all.includes('【你能做的事】')) content = JSON.stringify(DECIDE);
  else if (all.includes('写一段真实的感想')) content = '看完《海上钢琴师》，一直在想他为什么不下船。大概有些人的世界本来就只有八十八个键那么大，可那已经够他用一辈子了。';
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && window.gyResSearch && window.gyActNotify && GY_AUTONOMY_ACTIONS.some(a => a.key === 'npc_contact'), { timeout: 20000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  myApiKey = 'sk-test'; myApiUrl = 'https://api.test.local/v1'; myModel = 'm';
  myCharacters.length = 0;
  myCharacters.push({ id: 8301, name: '沈之遥', handle: '@shen', persona: '旧书店老板', worldbooks: [], actMode: 'auto', bio: '旧书店，下午两点开门' },
                     { id: 8302, name: '顾迟', handle: '@gu', persona: '夜班医生', worldbooks: [] });
  globalPosts.length = 0;
  globalPosts.push({ id: 'p_gu1', char: myCharacters[1], text: '夜班结束，天亮了。', timestamp: Date.now() - 60000, replies: [], stats: { comments: 0, likes: 0, retweets: 0 } });
  globalNotifications.length = 0;
  setAutoFeature('charAutonomy', true, true);
});

// ---------- 一、在线找资源 ----------
const mus = await page.evaluate(async () => (await gyResSearch('music', '晴天')).map(x => [x.src, x.title, x.url || '']));
check('找歌：iTunes 官方试听（JSONP，不怕跨域）', mus.some(x => x[0] === 'itunes' && x[1] === '晴天' && x[2].includes('qingtian')), JSON.stringify(mus));
check('找歌：互联网档案馆的完整开放授权音频', mus.some(x => x[0] === 'ia' && x[1] === 'Night Jazz'), JSON.stringify(mus));
await page.evaluate(() => gyResOpen('music', '晴天'));
await page.waitForFunction(() => document.querySelectorAll('#gyResModal .gyres-it').length > 0, { timeout: 8000 });
check('弹窗里列出了结果，有试听和放进音乐盒', await page.evaluate(() => { const t = document.getElementById('gyResModal').innerText; return t.includes('试听') && t.includes('放进音乐盒'); }));
await page.evaluate(() => gyResAdd(0, false, null));
await page.waitForTimeout(300);
check('放进音乐盒：歌单「🌐 在线找的」里有了', await page.evaluate(() => typeof gymHasTrack === 'function' && gymHasTrack('https://audio.test/qingtian.m4a')));
await page.evaluate(() => gyResOpen('music', 'jazz'));
await page.waitForFunction(() => document.querySelectorAll('#gyResModal .gyres-it').length > 1, { timeout: 8000 });
await page.evaluate(() => gyResAdd(1, false, null));
await page.waitForTimeout(400);
check('档案馆的歌：先查文件清单，拿到能直接放的 mp3 再加', await page.evaluate(() => gymHasTrack('https://archive.org/download/jazz_cc/track1.mp3')));

const films = await page.evaluate(async () => { const r = await gyResSearch('film', 'chaplin'); const u = await gyResResolve('film', r[0]); return { n: r.length, u }; });
check('找片：拿到档案馆的 mp4 直链', films.u === 'https://archive.org/download/the_kid_1921/the_kid.mp4', JSON.stringify(films));
await page.evaluate(() => gyResOpen('film', 'chaplin'));
await page.waitForFunction(() => document.querySelectorAll('#gyResModal .gyres-it').length > 0, { timeout: 8000 });
await page.evaluate(() => gyResAdd(0, false, null));
await page.waitForTimeout(400);
check('放进片库：在线的片子也在片库里', await page.evaluate(async () => { gyResClose(); fbOpenLibrary(); await new Promise(r => setTimeout(r, 200)); const ok = document.body.innerText.includes('The Kid'); try { fbCloseModal('fbLibModal'); } catch (e) {} return ok; }));

const book = await page.evaluate(async () => { const r = await gyResSearch('book', '红楼梦 第一回'); const t = await gyResBookText(r[0]); return { title: r[0] && r[0].title, len: t.length }; });
check('找书：维基文库的中文古籍，正文拿到了', book.title === '紅樓夢/第001回' && book.len > 200, JSON.stringify(book));
const b2 = await page.evaluate(async () => { const r = await gyResSearch('book', '红楼梦'); const t = await gyResBookText(r[0]); const b = await rtImportText(r[0].title, t, { src: 'wikisource' }); return b ? { t: b.title, ch: b.chapters.length } : null; });
check('放上书架：在线的书变成了一本能读的书', b2 && b2.ch > 0, JSON.stringify(b2));
await page.evaluate(() => gyResClose());

// ---------- 二、第二批动作 ----------
const keys = await page.evaluate(() => GY_AUTONOMY_ACTIONS.map(a => a.key));
const want = ['retweet', 'review', 'schedule_change', 'bio_update', 'phone_scroll', 'gossip_tell', 'song_share', 'group_call', 'npc_contact'];
check('第二批都接进了动作表', want.every(k => keys.includes(k)), want.filter(k => !keys.includes(k)).join(' '));
check('不写小说、不续写故事', !keys.some(k => /novel|story|continue/.test(k)));

DECIDE = { plan: [
  { action: 'retweet', after: 0, reason: '看到了', param: '夜班|辛苦了' },
  { action: 'schedule_change', after: 0, reason: '改主意了', param: '15:30|去码头看船' },
  { action: 'bio_update', after: 0, reason: '心情变了', param: '今天不开门' },
  { action: 'phone_scroll', after: 0, reason: '无聊', param: '小红书|一只会开门的猫' },
  { action: 'song_share', after: 0, reason: '想让你听', param: '晴天|周杰伦|下雨天就想听这首' }
], nextIn: 120 };
const r1 = await page.evaluate(async () => { const r = await runAutonomyTurn(myCharacters[0], true); return (r.entries || []).map(e => [e.action, e.ok, e.result, JSON.stringify(e.jump || null)]); });
check('五件都做成了', r1.length === 5 && r1.every(x => x[1]), JSON.stringify(r1));
const st = await page.evaluate(() => ({
  rt: globalPosts.find(p => p.quotedPostId === 'p_gu1' && p.char.id === 8301),
  sch: (myCharacters[0].schedule || {}).text || '', bio: myCharacters[0].bio, life: (myCharacters[0].lifeState || {}).activity,
  chat: (globalChats['8301'] || []).map(m => m.text).join('|'), song: gymHasTrack('https://audio.test/qingtian.m4a')
}));
check('转发：出现一条引用了顾迟那条推的新推文', !!st.rt && st.rt.text === '辛苦了');
check('改日程：今天的日程里多了一行「15:30 去码头看船（临时改的）」', st.sch.includes('15:30 去码头看船（临时改的）'), st.sch);
check('改签名：签名换了', st.bio === '今天不开门', st.bio);
check('刷手机：状态变成在刷小红书', st.life === '在刷小红书', st.life);
check('分享歌：私聊里发了一条，带着歌名，试听放进了音乐盒', st.chat.includes('分享了一首歌：《晴天》') && st.song, st.chat.slice(0, 120));

// 影评：要先看过点什么
DECIDE = { plan: [{ action: 'review', after: 0, reason: '看完了', param: '海上钢琴师' }], nextIn: 120 };
await page.evaluate(async () => { myCharacters[0].autonomyLog = (myCharacters[0].autonomyLog || []).concat([{ at: Date.now(), action: 'watch_self', ok: true, result: '在看「海上钢琴师」' }]); await runAutonomyTurn(myCharacters[0], true); });
check('写影评：真的发了一条感想推文', await page.evaluate(() => globalPosts.some(p => p.char.id === 8301 && p.text.includes('八十八个键'))));

// 拉群通话：发一张邀请卡，点好啊就进那个群的通话
const gc = await page.evaluate(async () => {
  groupChats.push({ id: 'g_t1', name: '书店夜班群', members: [8301, 8302] });
  const a = GY_AUTONOMY_ACTIONS.find(x => x.key === 'group_call');
  const need = a.need(myCharacters[0]);
  const r = await a.run(myCharacters[0], '书店');
  const card = (globalChats['8301'] || []).slice().reverse().find(m => m.invite && m.invite.kind === 'groupcall');
  return { need, r: r && r.text, title: card && card.invite.title };
});
check('拉群通话：私聊里来了一张「书店夜班群」的群通话邀请', gc.need && gc.title === '书店夜班群', JSON.stringify(gc));

// ---------- 三、通知 ----------
const nots = await page.evaluate(() => globalNotifications.slice(0, 12).map(n => ({ t: n.text, j: n.jump })));
check('每件事都进了通知，带着跳转目标', ['转发', '改了日程', '签名改成', '在刷小红书', '分享了', '写了段感想'].every(k => nots.some(n => n.t.includes(k) && n.j)), JSON.stringify(nots.map(n => n.t)));
check('自己本来就会弹的（比如分享歌之外的邀请卡）不重复弹：同一件事只有一条', nots.filter(n => n.t.includes('分享了')).length === 1);
// 点通知页里那条"改签名"→ 跳到 TA 的主页
await page.evaluate(() => { switchMainView('notifications'); renderNotifications(); });
await page.waitForTimeout(200);
await page.evaluate(() => { const el = [...document.querySelectorAll('#notificationsSection .notification-item')].find(x => x.innerText.includes('签名改成')); el && el.click(); });
await page.waitForTimeout(300);
check('点通知：跳到 TA 的主页', await page.evaluate(() => { const v = document.getElementById('view-profile'); return v && v.style.display !== 'none'; }));
// 点弹窗：跳到那条转发
await page.evaluate(() => { document.getElementById('toastContainer').innerHTML = ''; gyNotifyJump(myCharacters[0], '测试弹窗', '', { view: 'postDetail', param: globalPosts.find(p => p.quotedPostId === 'p_gu1').id }); });
await page.evaluate(() => document.querySelector('#toastContainer .toast-item').click());
await page.waitForTimeout(300);
check('点弹窗：跳到那条推文', await page.evaluate(() => { const v = document.getElementById('view-post-detail'); return v && v.style.display !== 'none'; }));

check('整个过程没有页面报错', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
