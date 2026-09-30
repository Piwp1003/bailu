// v199：微信模式通讯录首字母 + 字母索引 / 资料页 / 相册 / 朋友圈赞；小手机气泡不带皮肤尖尖；重新生成空回复不存；自主模式看得到自己的写信写日记习惯
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
const root = process.cwd();
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });
for (const [vp, tag] of [[{ width: 390, height: 844 }, '手机'], [{ width: 1280, height: 860 }, '电脑']]) {
  const page = await (await browser.newContext({ viewport: vp })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/^https?:\/\//, r => r.abort());
  await page.goto(fileUrl(path.join(root, 'index.html')));
  await page.waitForFunction(() => window.__guyuBooted && window.gyWxSet && window.gyWxAlbum, { timeout: 20000 });
  await page.evaluate(() => {
    myCharacters.length = 0;
    ['霍樊', '沈之遥', '顾迟', 'Alice', '白露', '陈默', '周野', '许愿'].forEach((n, i) => myCharacters.push({ id: 9600 + i, name: n, handle: '@c' + i, bio: i === 0 ? '贪嗔痴戒定慧' : '', worldbooks: [] }));
    const now = Date.now();
    globalPosts.unshift({ id: 'q1', char: { id: 9600, name: '霍樊' }, text: '上课比军训累', timestamp: now - 3600e3, replies: [], stats: { likes: 0 }, likedBy: [] },
      { id: 'q2', char: { id: 9600, name: '霍樊' }, text: '求满何时满', timestamp: now - 6 * 864e5, replies: [], stats: { likes: 0 }, likedBy: [] });
    gyWxSet(true, true);
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => { document.querySelectorAll('.toast-container').forEach(e => e.style.display = 'none'); gyWxTab('contacts'); });
  await page.waitForTimeout(300);
  const secs = await page.evaluate(() => [...document.querySelectorAll('#gyWxCells [data-wxl]')].map(e => e.dataset.wxl + ':' + [...(function* () { let n = e.nextElementSibling; while (n && !n.dataset.wxl && n.classList.contains('wx-cell')) { yield n.innerText.trim().split('\n').pop(); n = n.nextElementSibling; } })()].join('/')).join(' '));
  check(`[${tag}] 通讯录按首字母分段（拼音）`, /A:Alice/.test(secs) && /B:白露/.test(secs) && /C:陈默/.test(secs) && /G:顾迟/.test(secs) && /H:霍樊/.test(secs) && /S:沈之遥/.test(secs) && /X:许愿/.test(secs) && /Z:周野/.test(secs), secs);
  check(`[${tag}] 右边有字母索引`, await page.evaluate(() => { const x = document.getElementById('gyWxIdx'); return !!x && x.querySelectorAll('i').length >= 27 && x.getBoundingClientRect().width > 0; }));
  const jz = await page.evaluate(() => { const i = document.querySelector('#gyWxIdx i[data-k="Z"]').getBoundingClientRect(); return { x: i.left + i.width / 2, y: i.top + i.height / 2 }; });
  await page.mouse.click(jz.x, jz.y); await page.waitForTimeout(200);
  const vis = await page.evaluate(() => { const h = document.querySelector('#gyWxCells [data-wxl="Z"]'), sc = document.getElementById('gyWxIdx').__scroller; const a = h.getBoundingClientRect().top, b = sc.getBoundingClientRect().top; const atEnd = sc.scrollTop > 0 && Math.abs(sc.scrollTop + sc.clientHeight - sc.scrollHeight) < 3; return atEnd ? 0 : Math.abs(a - b); });
  check(`[${tag}] 点字母 Z：跳到 Z 那一段`, vis < 8, String(vis));
  await page.evaluate(() => gyWxCard('9600'));
  await page.waitForTimeout(300);
  const pf = await page.evaluate(() => (document.getElementById('gyWxBody') && !document.querySelector('.gywx-desk') ? document.getElementById('gyWxBody') : document.getElementById('gyWxPane')).innerText);
  check(`[${tag}] 资料页：名字 / 微信号 / 朋友资料 / 朋友圈 / 发消息 / 音视频通话`, ['霍樊', '微信号', '朋友资料', '朋友圈', '发消息', '音视频通话'].every(t => pf.includes(t)), pf.slice(0, 200));
  await page.evaluate(() => gyWxAlbum('9600'));
  await page.waitForTimeout(300);
  const al = await page.evaluate(() => (document.querySelector('#gyWxMo .mo-body') || document.getElementById('gyWxBody')).innerText);
  check(`[${tag}] TA 的相册：签名 + 按天排（今天 / 日期）`, /贪嗔痴戒定慧/.test(al) && /今天/.test(al) && /上课比军训累/.test(al) && /月/.test(al), al.slice(0, 200));
  await page.evaluate(() => { const m = document.getElementById('gyWxMo'); if (m) m.remove(); gyWxAlbum('me'); });
  await page.waitForTimeout(300);
  check(`[${tag}] 我的相册：今天有个相机格子（点了发朋友圈）`, await page.evaluate(() => !!document.querySelector('.al-i.cam')));
  await page.evaluate(() => { const m = document.getElementById('gyWxMo'); if (m) m.remove(); gyWxMoments(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const b = [...document.querySelectorAll('.wx-mo .more')][0]; gyWxMoAct(b, b.getAttribute('onclick').match(/'([^']+)'\)/)[1]); });
  await page.evaluate(() => [...document.querySelectorAll('.wx-moact span')][0].click());
  await page.waitForTimeout(200);
  check(`[${tag}] 朋友圈点「··」→ 赞：显示点赞的人`, await page.evaluate(() => !!document.querySelector('.wx-mo .lk')));
  check(`[${tag}] 没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 300));
}
// 小手机：皮肤给气泡加的尖尖收掉
{
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/^https?:\/\//, r => r.abort());
  await page.goto(fileUrl(path.join(root, 'index.html')));
  await page.waitForFunction(() => window.__guyuBooted && window.gyPmSet, { timeout: 20000 });
  await page.evaluate(() => {
    const st = document.createElement('style'); st.textContent = '.chat-bubble{position:relative}.chat-bubble.me::before{content:"";position:absolute;right:-4px;top:12px;width:9px;height:9px;background:#95ec69;transform:rotate(45deg)}'; document.head.appendChild(st);
    myCharacters.length = 0; myCharacters.push({ id: 9700, name: '霍樊', worldbooks: [] });
    globalChats['9700'] = [{ sender: 'me', text: '说了不需要', timestamp: Date.now() }, { sender: 9700, text: '', swipes: ['原来那句', ''], currentSwipe: 1, timestamp: Date.now() }];
    gyPmSet(true); gyPmUnlock(); gyPmOpenChat(9700);
  });
  await page.waitForTimeout(800);
  await page.waitForTimeout(400);
  const tail = await page.evaluate(() => { const b = document.querySelector('.chat-bubble.me'); return b ? { bub: getComputedStyle(b).backgroundColor, tail: getComputedStyle(b, '::before').backgroundColor, content: getComputedStyle(b, '::before').content } : null; });
  check('小手机：自己装的气泡皮肤带的尖尖还在，颜色跟着气泡走（不再是写死的绿色）', tail && tail.content !== 'none' && tail.tail === tail.bub && !/149, 236, 105/.test(tail.tail), JSON.stringify(tail));
  // 用边框拼的三角尖尖也跟着变
  await page.evaluate(() => { const st = document.createElement('style'); st.textContent = '.chat-bubble.other::after{content:"";position:absolute;left:-8px;top:10px;width:0;height:0;border:6px solid transparent;border-right-color:#ffffff}'; document.head.appendChild(st); });
  await page.waitForTimeout(400);
  const tri = await page.evaluate(() => { const b = document.querySelector('.chat-bubble.other'); return b ? { bub: getComputedStyle(b).backgroundColor, r: getComputedStyle(b, '::after').borderRightColor, t: getComputedStyle(b, '::after').borderTopColor } : null; });
  check('边框拼出来的三角尖尖：有颜色的那条边跟着气泡颜色，透明的边还是透明', tri && tri.r === tri.bub && /0\)$|transparent/.test(tri.t), JSON.stringify(tri));
  check('空的那一版不再显示成空气泡，提示翻回去', await page.evaluate(() => /这一版是空的/.test(document.getElementById('view-chat').innerText)));
  // 重新生成拿到空回复：不存成新的一版
  const r = await page.evaluate(async () => {
    const msgs = globalChats['9700']; msgs[1] = { sender: 9700, text: '原来那句', timestamp: Date.now() };
    window.getApiMain = () => ({ key: 'k', url: 'x', model: 'm' });
    window.callChatCompletionAPI = async () => ({ choices: [{ message: { content: '{"replies":[{"content":""},{"text":"   "}]}' } }] });
    chatContextMenuMsgIdx = 1; await contextActionRegenerateChat();
    return { text: msgs[1].text, sw: (msgs[1].swipes || []).length };
  });
  check('重新生成拿到空回复：原来那版还在，不多出一个空的版本', r.text === '原来那句' && r.sw === 0, JSON.stringify(r));
  const r2 = await page.evaluate(async () => {
    window.callChatCompletionAPI = async () => ({ choices: [{ message: { content: '{"replies":[{"content":"我不走"},{"message":"听到没"}]}' } }] });
    chatContextMenuMsgIdx = 1; await contextActionRegenerateChat();
    return globalChats['9700'][1].text;
  });
  check('重新生成：模型写成 content / message 也认得', /我不走/.test(r2) && /听到没/.test(r2), r2);
  check('没有页面报错', errs.length === 0, errs.join(' | ').slice(0, 300));
}
// 自主模式：决策时看得到写信 / 写日记的习惯
{
  const page = await (await browser.newContext()).newPage();
  await page.route(/^https?:\/\//, r => r.abort());
  await page.goto(fileUrl(path.join(root, 'index.html')));
  await page.waitForFunction(() => window.__guyuBooted && typeof runAutonomyTurn === 'function', { timeout: 20000 });
  const p = await page.evaluate(async () => {
    myCharacters.length = 0; const c = { id: 9800, name: '沈之遥', actMode: 'auto', worldbooks: [], diaryData: { letters: [{ id: 'l1', author: 'char', date: Date.now() - 5 * 864e5, content: '…' }], diaries: [] }, taHabit: { m: { letter: { ms: 2 * 864e5, why: '两天一封' } } } };
    myCharacters.push(c);
    let got = '';
    window.getApiConfig = () => ({ key: 'k', url: 'x', model: 'm' });
    window.callChatCompletionAPI = async (api, msgs) => { got = JSON.stringify(msgs); return { choices: [{ message: { content: '{"plan":[],"nextIn":60}' } }] }; };
    await runAutonomyTurn(c, true);
    return got;
  });
  check('自主模式：决策时列出了「你自己的这些习惯」（写信 / 写日记 上次什么时候）', /你自己的这些习惯/.test(p) && /写信/.test(p) && /写日记/.test(p), p.slice(0, 200));
  check('自主模式：到了 TA 自己说的间隔，会提醒「差不多到了」', /差不多到了/.test(p));
}
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
