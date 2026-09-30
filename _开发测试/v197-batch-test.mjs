// v197 这一批：事后反应 / 谁打给谁 / 邀请时把东西导进来 / 塔罗 / 自定义字体 / 弹窗能拖大小 / 20个问题收藏和不限题数
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
await page.route(/^https?:\/\//, r => r.abort());
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && window.gyAfterActivity && window.__gyModalResizeLoaded && window.gyUserFont, { timeout: 20000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  myCharacters.length = 0;
  myCharacters.push({ id: 9301, name: '沈之遥', handle: '@shen', persona: '旧书店老板', worldbooks: [] });
  globalChats['9301'] = [{ sender: 9301, text: '在吗', timestamp: Date.now() - 60000 }];
  window.GY_AFTER_DELAY_MS = 0;
  window.__prompts = [];
  window.getApiConfig = () => ({ url: 'x', key: 'k', model: 'm' });
  try { myApiKey = 'k'; } catch (e) {} window.myApiKey = 'k';
  window.callChatCompletionAPI = async (api, msgs) => {
    const txt = JSON.stringify(msgs); window.__prompts.push(txt);
    if (/现在是事后/.test(txt)) return { choices: [{ message: { content: '{"replies":[{"text":"刚才电话里忘了说，晚安"}]}' } }] };
    return { choices: [{ message: { content: '喂？是我。' } }] };
  };
  window.sendChatRequest = async (api, p) => ({ choices: [{ message: { content: /塔罗/.test(p) ? '这张牌说你最近太累了，歇歇。' : '{}' } }] });
});

// ---- 电话：TA 打来的，prompt 里要说是 TA 打的；挂了之后 TA 再发一条 ----
await page.evaluate(() => { window.gyCallRing(myCharacters[0], '想听听你声音'); });
await page.waitForTimeout(300);
await page.evaluate(() => window.gyCallAccept && window.gyCallAccept());
await page.waitForTimeout(1500);
const callP = await page.evaluate(() => window.__prompts.join('\n'));
check('TA 打来的电话：跟模型说的是「你打给对方的」，还带着打来的理由', /这通电话是你打给/.test(callP) && /想听听你声音/.test(callP), callP.slice(0, 300));
check('TA 打来的电话：不会再说成「对方刚把电话打过来」', !/刚把电话打过来/.test(callP));
const before = await page.evaluate(() => globalChats['9301'].length);
await page.evaluate(() => { window.__prompts = []; window.gyCallEnd && window.gyCallEnd(); });
await page.waitForTimeout(1500);
const after = await page.evaluate(() => ({ msgs: globalChats['9301'].slice(-3).map(m => (m.sender) + ':' + String(m.text).slice(0, 40)), n: globalChats['9301'].length }));
check('挂了电话：TA 像真人一样又在私聊里发了一句', after.msgs.some(x => /刚才电话里忘了说/.test(x)), JSON.stringify(after));
const rec = await page.evaluate(() => (globalChats['9301'].find(m => /📞/.test(String(m.text))) || {}).text || '');
check('通话记录写清楚了谁打给谁（不是「我：」）', /沈之遥 打给/.test(rec) && !/\n我：/.test(rec), rec.slice(0, 120));

// ---- 通用：看完电影之类，也会有事后反应 ----
const aft = await page.evaluate(async () => (await window.gyAfterActivity(9301, '一起看电影', '看了《海边》', { by: 'me', delay: 0 })) || []);
check('一起看电影之后：TA 也会回头说两句', aft.length >= 1, JSON.stringify(aft));
const aftP = await page.evaluate(() => window.__prompts.slice(-1)[0] || '');
check('事后那句知道是谁发起的（这次是对方约的）', /是.*发起的/.test(aftP) && !/是你发起的/.test(aftP));

// ---- TA 找到的电影：先导进放映厅，再发邀请；答应了打开就是那一部 ----
await page.evaluate(() => {
  window.gyResSearch = async (kind, q) => [{ src: 'test', title: q, url: 'https://example.org/sea.mp4', note: '', page: '', from: 'test' }];
  window.gyResResolve = async (kind, it) => it.url;
});
const ex = await page.evaluate(async () => await window.gyInviteResolveItem('film', '海边的曼彻斯特'));
check('TA 找到的电影：导进了放映厅（有 filmId）', ex && ex.filmId, JSON.stringify(ex));
const found = await page.evaluate(() => { const f = window.fbFindFilm && window.fbFindFilm('海边的曼彻斯特'); return f ? f.url : null; });
check('放映厅里真的有这一部', /sea\.mp4/.test(found || ''), String(found));
await page.evaluate(async (ex) => {
  const inv = window.gyInviteFromChar({ char: myCharacters[0], kind: 'film', title: '海边的曼彻斯特', ...ex, notify: false });
  window.__inv = inv;
}, ex);
await page.evaluate(() => { const inv = window.__inv; window.gyInviteAnswer(inv.id, true); });
await page.waitForTimeout(1500);
const film = await page.evaluate(() => ({ view: (document.getElementById('view-watch-together') || {}).style ? getComputedStyle(document.getElementById('view-watch-together')).display : 'none', src: [...document.querySelectorAll('video')].map(v => v.getAttribute('src') || v.currentSrc || '').join('|') }));
check('答应了邀请：打开的是放映厅，放的就是 TA 找来的那一部', film.view !== 'none' && /sea\.mp4/.test(film.src), JSON.stringify(film));
const card = await page.evaluate(() => (globalChats['9301'].find(m => m.invite && m.invite.id === window.__inv.id) || {}).text || '');
check('邀请卡写着谁约谁，答应之后也记下来了', /约/.test(card) && /答应了/.test(card), card);

// ---- 弹窗能拖大小 ----
await page.evaluate(() => { if (typeof openModal === 'function') openModal('cropModal'); });
await page.waitForTimeout(400);
const g0 = await page.evaluate(() => { const box = document.querySelector('#cropModal .modal-box') || document.querySelector('.modal-overlay[style*="flex"] .modal-box, .modal-overlay.active .modal-box'); if (!box) return null; const r = box.getBoundingClientRect(); const grip = box.querySelector('.gy-rz-se') || document.querySelector('.gy-rz-se'); const gr = grip && grip.getBoundingClientRect(); return { w: r.width, h: r.height, gx: gr ? gr.left + gr.width / 2 : null, gy: gr ? gr.top + gr.height / 2 : null }; });
check('弹窗右下角有拖大小的把手', g0 && g0.gx != null, JSON.stringify(g0));
if (g0 && g0.gx != null) {
  await page.mouse.move(g0.gx, g0.gy); await page.mouse.down(); await page.mouse.move(g0.gx + 120, g0.gy + 80, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(200);
  const g1 = await page.evaluate(() => { const box = document.querySelector('#cropModal .modal-box') || document.querySelector('.modal-overlay[style*="flex"] .modal-box, .modal-overlay.active .modal-box'); const r = box.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  check('拖把手：弹窗变大', g1.w > g0.w + 60 && g1.h > g0.h + 30, JSON.stringify({ g0, g1 }));
}
await page.evaluate(() => { try { closeModal('cropModal'); } catch (e) {} });

// ---- 自定义字体：设置 → 外观 里有入口 ----
await page.evaluate(() => { try { switchMainView('settings'); openSettingsPanel('appearance'); } catch (e) {} });
await page.waitForTimeout(400);
check('设置 → 外观 里有「自定义字体」（上传 / 粘贴链接）', await page.evaluate(() => /自定义字体/.test(document.body.innerText) && !!document.getElementById('gyUfUrl')));

// ---- 20个问题：收藏 ----
const fav = await page.evaluate(() => { const on = window.gyGameFav.toggle({ game: 'tq', kind: 'q', text: '它会飞吗？' }); return { on, n: window.gyGameFav.list('tq').length }; });
check('20个问题：问答能收藏', fav.on && fav.n >= 1, JSON.stringify(fav));

// ---- 小手机：今日运势里抽塔罗 + 让 TA 解读 ----
await page.evaluate(() => { gyPmSet(true); gyPmUnlock(); });
await page.waitForTimeout(600);
await page.evaluate(() => { gyPmAddW('fortune', 'm'); });
await page.waitForTimeout(300);
const wid = await page.evaluate(() => [...document.querySelectorAll('#gyPmHome .wk-fortune')].pop().dataset.wid);
await page.evaluate(id => gyPmTarot(id, 'three'), wid);
await page.waitForTimeout(200);
const tr = await page.evaluate(() => ({ n: document.querySelectorAll('#gyPmSheet .tr-row .tr-card').length, txt: document.getElementById('gyPmSheet').innerText }));
check('今日运势：能抽塔罗（过去·现在·未来三张），每张都有正逆位和牌义', tr.n === 3 && /过去/.test(tr.txt) && /(正位|逆位)/.test(tr.txt) && /牌义/.test(tr.txt), tr.txt.slice(0, 200));
await page.evaluate(id => gyPmTarotRead(id, '9301'), wid);
await page.waitForTimeout(500);
const rd = await page.evaluate(() => document.getElementById('gyPmTrRead').innerText);
check('塔罗：让 TA 用语言模型解读', /歇歇/.test(rd) && /沈之遥/.test(rd), rd);
await page.evaluate(() => gyPmCloseSheet());
await page.waitForTimeout(300);
check('抽过的牌留在小组件上', await page.evaluate(id => !!document.querySelector(`[data-wid="${id}"] .tr-card`) || !!document.querySelector(`[data-wid="${id}"] .trb`), wid));

check('整个过程没有页面报错', errs.length === 0, errs.join(' | ').slice(0, 300));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
