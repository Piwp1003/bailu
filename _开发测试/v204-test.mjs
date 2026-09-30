// v204：🎧 一起听 · 一起看（网站放进来：网页版用官方外链播放器；桌面版 / APK 开官方网页；TA 知道在放什么）
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
await page.route(/^https?:\/\//, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>embed</body></html>' }));
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && window.gyWmOpen, { timeout: 20000 });
await page.waitForTimeout(1000);
await page.evaluate(() => {
  myCharacters.length = 0; myCharacters.push({ id: 9901, name: '顾言', worldbooks: [] });
  globalChats['9901'] = [];
  window.__sent = []; window.sendProactiveChatMessage = async c => { window.__sent.push(getBoxPrompt(c)); };
});

// ---- 链接 → 官方外链播放器 ----
const em = await page.evaluate(() => {
  const E = window.gyWmEmbedOf;
  return {
    ne: E('https://music.163.com/#/song?id=186016').src, nel: E('https://music.163.com/playlist?id=123').src,
    bili: E('https://www.bilibili.com/video/BV1GJ411x7h7/?p=2').src, yt: E('https://youtu.be/dQw4w9WgXcQ').src,
    txv: E('https://v.qq.com/x/cover/abc/x0033abcd.html').src, yk: E('https://v.youku.com/v_show/id_XNTk5.html').src,
    sp: E('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC').src, none: E('https://www.iqiyi.com/')
  };
});
check('网易云歌曲 / 歌单 → 官方外链播放器', /outchain\/player\?type=2&id=186016/.test(em.ne) && /type=0&id=123/.test(em.nel), JSON.stringify(em));
check('B 站 / YouTube / 腾讯视频 / 优酷 / Spotify 链接 → 各家官方嵌入播放器', /player\.bilibili\.com.*bvid=BV1GJ411x7h7&page=2/.test(em.bili) && /youtube\.com\/embed\/dQw4w9WgXcQ/.test(em.yt) && /txp\/iframe.*vid=x0033abcd/.test(em.txv) && /player\.youku\.com\/embed\/XNTk5/.test(em.yk) && /open\.spotify\.com\/embed\/track/.test(em.sp) && em.none === null, JSON.stringify(em));

// ---- 打开小窗 ----
await page.evaluate(() => { switchMainView('chat'); switchChatSession('9901'); });
await page.waitForTimeout(300);
check('聊天栏有 🎧，点开「一起听 · 一起看」，默认和当前聊天的人一起', await page.evaluate(() => { document.getElementById('gyWmBtn').click(); const el = document.getElementById('gyWm'); return getComputedStyle(el).display !== 'none' && document.querySelector('#gyWm .who').value === '9901'; }));
const home = await page.evaluate(() => { gyWmHome(); return document.getElementById('gyWmBody').innerText; });
check('网站列表：网易云、QQ 音乐、酷狗、酷我、B 站、腾讯视频、爱奇艺、优酷……', ['网易云音乐', 'QQ 音乐', '酷狗音乐', '酷我音乐', '咪咕音乐', '哔哩哔哩', '腾讯视频', '爱奇艺', '优酷', '芒果 TV', 'YouTube', '抖音'].every(n => home.includes(n)), home.slice(0, 200));
// 贴分享文案
await page.evaluate(() => gyWmGo('分享周杰伦的单曲《晴天》: https://music.163.com/#/song?id=186016 (来自@网易云音乐)'));
await page.waitForTimeout(500);
const r1 = await page.evaluate(() => ({ ifr: (document.querySelector('#gyWmBody iframe') || {}).src || '', np: document.getElementById('gyWmNp').innerText, now: gyWmNow(), note: globalChats['9901'].map(m => m.text).join('|') }));
check('贴网易云分享文案：用官方小播放器放，还认出了《晴天》- 周杰伦', /outchain\/player/.test(r1.ifr) && /晴天/.test(r1.np) && r1.now && r1.now.artist === '周杰伦', JSON.stringify(r1));
check('聊天里记了一笔「一起听：《晴天》」', /一起听：《晴天》/.test(r1.note), r1.note);
const ctx1 = await page.evaluate(() => getBoxPrompt(myCharacters[0]));
check('TA 知道你们正在一起听什么（聊天时会自然聊到）', /正在一起听/.test(ctx1) && /晴天/.test(ctx1), ctx1.slice(-200));
await page.evaluate(() => { window.__sent = []; gyWmTalk(); });
await page.waitForTimeout(200);
check('「让 TA 说说」：TA 马上主动说两句（带着由头）', await page.evaluate(() => window.__sent.length === 1 && /让你说说正在一起听的《晴天》/.test(window.__sent[0])));
// 打不开的网站：给新窗口 + 手动告诉 TA
const r2 = await page.evaluate(() => { gyWmGo('iqiyi'); return document.getElementById('gyWmBody').innerText; });
check('浏览器里放不进来的网站：给「在新窗口打开」和「告诉 TA」', /新窗口打开/.test(r2) && /告诉 TA/.test(r2), r2.slice(0, 120));
await page.evaluate(() => gyWmManual('去有风的地方 - 刘亦菲'));
check('手动告诉 TA：在看什么 / 听什么', await page.evaluate(() => gyWmNow().title === '去有风的地方' && /去有风的地方/.test(getBoxPrompt(myCharacters[0]))));
// 桌面版 / APK 读到的正在播放（模拟网页回报）
await page.evaluate(() => window.__gyWmCb(JSON.stringify({ title: '稻香', artist: '周杰伦', playing: true, t: 42, d: 223, kind: 'audio' })));
const r3 = await page.evaluate(() => ({ np: document.getElementById('gyWmNp').innerText, info: gymNowInfo(), note: globalChats['9901'].slice(-1)[0].text }));
check('读到网页里正在放的：底栏显示进度，聊天记一笔', /稻香/.test(r3.np) && /0:42 \/ 3:43/.test(r3.np) && /稻香/.test(r3.note), JSON.stringify(r3));
check('音乐盒没在放时，灵动岛 / 音乐小组件显示网站里正在放的', r3.info && r3.info.title === '稻香' && r3.info.playing, JSON.stringify(r3.info));
// 读网页的脚本本身：在一个有 mediaSession + audio 的页面上跑一遍
const pr = await page.evaluate(async () => {
  navigator.mediaSession.metadata = new MediaMetadata({ title: '晴天', artist: '周杰伦' });
  const a = document.createElement('audio'); document.body.appendChild(a);
  const r = eval(window.__gyWmProbeSrc); a.remove(); return r;
});
check('读「正在放什么」的脚本：认得出系统媒体信息', pr && pr.title === '晴天' && pr.artist === '周杰伦', JSON.stringify(pr));
// 缩小 / 关掉
check('缩小成胶囊（网页照样在放）、关掉就停', await page.evaluate(() => { gyWmMin(true); const a = getComputedStyle(document.getElementById('gyWm')).display === 'none' && getComputedStyle(document.getElementById('gyWmPill')).display !== 'none'; gyWmMin(false); gyWmClose(); return a && getComputedStyle(document.getElementById('gyWm')).display === 'none' && !document.querySelector('#gyWmBody iframe'); }));
// 音乐盒里贴网易云链接：转到这里
check('音乐盒里贴网易云链接：自动在「一起听」里打开', await page.evaluate(() => { const i = document.createElement('input'); i.id = 'gymUrl'; i.value = 'https://music.163.com/#/song?id=186016'; document.body.appendChild(i); gymAddUrl(); i.remove(); return getComputedStyle(document.getElementById('gyWm')).display !== 'none' && /outchain/.test((document.querySelector('#gyWmBody iframe') || {}).src || ''); }));

check('整个过程没有页面报错', errs.length === 0, errs.join(' | ').slice(0, 400));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
