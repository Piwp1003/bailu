// 9 月 23 日那一批新功能的回归测试：版本号、思维链收纳、聊天状态栏、卡片手机、TA 定、今天面板、
// 全部开关、推文图片、角色卡正则归属、重复导入、聊天里的卡片小界面。
// 跟别的测试一样：无头浏览器真的把 index.html 跑起来，AI 请求全部拦成本地假响应，不联网、不动你的存档。
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('dialog', d => d.accept());

// 假接口：每个用例把下一次要"回"的内容放进 NEXT
let NEXT = '';
await page.route('**/chat/completions', r => r.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ choices: [{ message: { content: NEXT } }] })
}));

const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof window.triggerAIBatchReply === 'function' && window.__guyuBooted, { timeout: 20000 });
await page.waitForTimeout(1500);

// 公共：点掉项目自己的确认框（appConfirm / appAlert）
async function clickDialogs(times = 10) {
  for (let i = 0; i < times; i++) {
    const hit = await page.evaluate(() => {
      const o = [...document.querySelectorAll('.gy-dialog-overlay')].find(m => getComputedStyle(m).display !== 'none');
      if (!o) return false;
      const bs = [...o.querySelectorAll('button')];
      (bs.find(b => /确定|好|是|继续/.test(b.textContent)) || bs[bs.length - 1]).click();
      return true;
    });
    if (!hit) return;
    await page.waitForTimeout(300);
  }
}
// 公共：新建一个角色、开私聊、让 TA 回一轮
async function newChar(extra) {
  return page.evaluate((extra) => {
    const id = 'c' + Math.random().toString(36).slice(2, 8);
    myCharacters.push(Object.assign({ id, name: '测试' + id.slice(1, 4), handle: '@' + id, persona: '一个普通人', worldbooks: [],
      postFreq: { interval: 0, unit: 'day' }, firstMessage: '', alternateGreetings: [] }, extra || {}));
    return id;
  }, extra);
}
async function replyOnce(cid, content) {
  NEXT = content;
  await page.evaluate(async (cid) => {
    myApiKey = 'sk-test'; myApiUrl = 'https://api.test.local/v1'; myModel = 'm'; enableStreaming = false;
    globalChats[cid] = [{ sender: 'me', text: '在吗', timestamp: Date.now() }];
    switchMainView('chat'); switchChatSession(cid);
    await triggerAIBatchReply(cid, '在吗');
  }, cid);
  await page.waitForTimeout(1600);
}

// ============ 1. 版本号只改一处 ============
const ver = await page.evaluate(() => ({
  g: typeof GY_VERSION !== 'undefined' ? String(GY_VERSION) : null,
  app: typeof GY_APP_VERSION !== 'undefined' ? GY_APP_VERSION : null,
  bad: [...document.scripts].filter(s => /\/js\//.test(s.src || '') && !(s.src || '').endsWith('?v=' + GY_VERSION)).map(s => s.src.split('/').pop()),
  css: !!document.querySelector('link[rel="stylesheet"][href*="style.css?v=' + GY_VERSION + '"]')
}));
check('index.html 里有唯一的 GY_VERSION', !!ver.g, JSON.stringify(ver));
check('设置页显示的版本号跟着 GY_VERSION 走', ver.app === 'v' + ver.g, ver.app);
check('所有 js 都带着同一个 ?v=', ver.bad.length === 0, ver.bad.join(', '));
check('style.css 也带着同一个 ?v=', ver.css);
const swSrc = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
check('service-worker.js 里没有写死的版本号', !/\?v=\d+/.test(swSrc) && !/CACHE_VERSION\s*=\s*'v\d+'/.test(swSrc));
const idxSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
check('index.html 里没有漏网的 ?v=数字', !/\?v=\d+/.test(idxSrc));

// ============ 2. 思维链收纳盒 ============
const c1 = await newChar();
await page.evaluate(() => gyVaultSetOn(true));
await replyOnce(c1, '<think>她今天回得很晚，先问问她累不累。</think>{"replies":[{"delay":1,"text":"你终于回我了"}]}');
const v = await page.evaluate((cid) => { const h = globalChats[cid]; const m = h[h.length - 1]; return { text: m.text, key: !!m.reasoningKey, chip: !!document.querySelector('.gyrv-chip') }; }, c1);
check('思维链：正文里没有思考', v.text === '你终于回我了', v.text);
check('思维链：这条消息挂上了取件码', v.key);
check('思维链：气泡下面出现「💭 看 TA 这一轮在想什么」', v.chip);
await replyOnce(c1, '好的，我先想想。她说累了，那我应该先让她休息，别一直追问今天发生了什么事情。{"replies":[{"delay":1,"text":"早点睡"}]}');
const v2 = await page.evaluate(() => JSON.parse(localStorage.getItem('gy_vault_diag') || '[]')[0] || {});
check('思维链：JSON 前面没打标签的思考也能收到', v2.n >= 1, JSON.stringify(v2).slice(0, 200));
await page.evaluate(() => gyVaultSetOn(false));

// ============ 3. 聊天状态栏 ============
await page.evaluate(() => { const cb = document.getElementById('showStatusInChat'); cb.checked = true; cb.dispatchEvent(new Event('change')); });
check('状态栏开关一勾就生效（不用再点保存）', await page.evaluate(() => showStatusInChat === true));
const st = JSON.stringify({ replies: [{ delay: 1, text: '嗯。' }], stateUpdate: '<x_status>\n[Thought|今天有点累]\n[Mood|还行]\n</x_status>' });
await replyOnce(c1, st);
const s3 = await page.evaluate((cid) => { const d = document.querySelector('.gy-chat-status'); const h = globalChats[cid]; return { has: !!d, open: d ? d.open : null, raw: (h.find(m => m.statusRaw) || {}).statusRaw || '' }; }, c1);
check('状态栏：写在 JSON 字段里的也能摘出来', s3.has);
check('状态栏：默认收着，点了才展开', s3.open === false);
check('状态栏：字段里的 \\n 还原成了真换行', s3.raw.includes('\n[Mood') && !s3.raw.includes('\\n'), JSON.stringify(s3.raw));
await page.evaluate(() => { const cb = document.getElementById('showStatusInChat'); cb.checked = false; cb.dispatchEvent(new Event('change')); });

// ============ 4. 卡片手机 ============
await page.evaluate(() => { currentUser.name = '小雨'; setAutoFeature('phoneOn', true, true); });
const c2 = await newChar({ name: '季清衍' });
await replyOnce(c2, JSON.stringify({ replies: [{ delay: 1, text: '到家了吗？\n<msg>清衍|小雨|你到家没呀|09月23日 21:10</msg>\n<msg>清衍|淮安|哥你别装路过了|09月23日 21:12</msg>\n<rednote>a1|清衍|被夸的一天|日常|晒太阳|09-23 21:00|12|3|1</rednote>' }] }));
const p4 = await page.evaluate((cid) => {
  const h = globalChats[cid];
  return { texts: h.map(m => (m.type || '') + ':' + m.text), peek: !!document.querySelector('.gyph-peekcard') };
}, c2);
check('卡片手机：发给我的那条变成了真消息', p4.texts.includes(':你到家没呀'), p4.texts.join(' | '));
check('卡片手机：跟别人的那条没漏进聊天', !p4.texts.some(t => t.includes('别装路过')), p4.texts.join(' | '));
check('卡片手机：聊天里留了一张「TA 刚在手机上」小卡', p4.peek);
check('卡片手机：原始 <msg> 标签没露出来', !p4.texts.some(t => t.includes('<msg>') || t.includes('<rednote>')));
await page.click('.gyph-peekcard');
await page.waitForTimeout(800);
await page.evaluate(() => gyPhoneMode('all'));
await page.evaluate(() => gyPhoneApp('rednote'));
await page.waitForTimeout(300);
check('卡片手机：手机里出现了小红书，帖子在里面', await page.evaluate(() => (document.getElementById('gyphBody') || document.body).innerText.includes('被夸的一天')));

// ============ 5. TA 定 ============
const c3 = await newChar({ actMode: 'auto', chatFreq: { interval: 2, unit: 'hour' } });
const t5 = await page.evaluate((cid) => {
  const c = myCharacters.find(x => x.id === cid);
  setAutoFeature('charAutonomy', false, true);
  const off = gyTaCharOn(c, 'chatFreqInterval');
  setAutoFeature('charAutonomy', true, true);
  const on = gyTaCharOn(c, 'chatFreqInterval');
  chatWordLimit = 120;
  const bp = buildBasePrompt(c, false, '');
  const rw = gyTaRewrite([{ role: 'system', content: bp }, { role: 'user', content: '总字数不超过120字（这是硬性上限，不是必须写满）' }])[1].content;
  return { off, on, rw };
}, c3);
check('TA 定：总开关关着时，自主模式角色也按你的数来', t5.off === false);
check('TA 定：总开关开着 + 自主模式 → 自动交给 TA', t5.on === true);
check('TA 定：自主模式角色的字数规定换成了"长短你自己定"', !t5.rw.includes('120字') && t5.rw.includes('长短由你自己定'), t5.rw);

// ============ 6. 今天面板 ============
await page.evaluate(() => { gyTodaySet(true); switchMainView('home'); });
await page.waitForTimeout(500);
check('今天面板：有「⏳ 时间管理大师」', await page.evaluate(() => (document.getElementById('gyToday') || {}).innerText && document.getElementById('gyToday').innerText.includes('时间管理大师')));
await page.evaluate(() => gyTodaySet(false));

// ============ 7. 全部开关 ============
await page.evaluate(() => { switchMainView('settings'); openSettingsPanel('auto'); });
await page.waitForTimeout(600);
const s7 = await page.evaluate(() => ({ mini: document.body.innerText.includes('小功能的开关'), moved: document.querySelectorAll('#view-settings .gysw-moved').length }));
check('全部开关：只剩自动功能 + 小功能的开关', s7.mini);
check('全部开关：设置各页的开关都在原处（没被藏）', s7.moved === 0, '被藏了 ' + s7.moved + ' 个');

// ============ 8. 推文图片 ============
await page.evaluate((cid) => {
  globalPosts.unshift({ id: 'pimg_t', char: myCharacters.find(c => c.id === cid), text: '测试推文', timestamp: Date.now(), stats: { comments: 0, retweets: 0, likes: 0, views: 1 }, replies: [] });
  switchMainView('home'); renderPosts();
  gyPostMenu({ preventDefault() {}, stopPropagation() {}, pageX: 100, pageY: 100 }, 'pimg_t');
}, c1);
check('推文 ⋮ 里能加/换/删图片', await page.evaluate(() => document.getElementById('chatContextMenu').innerText.includes('图片')));
await page.evaluate(() => { document.getElementById('chatContextMenu').style.display = 'none'; });

// ============ 9 & 10. 导入角色卡：正则绑到角色身上 + 重复导入提醒 ============
const card = { spec: 'chara_card_v2', data: { name: '回归测试卡', description: '一个用来测试的角色。', first_mes: '你好。', alternate_greetings: [],
  extensions: { regex_scripts: [{ scriptName: '测试卡状态栏', findRegex: '/<rt_status>([\\s\\S]*?)<\\/rt_status>/g', replaceString: '<div class="rt-card">$1</div>', placement: [2], markdownOnly: true, promptOnly: false, disabled: false }] } } };
const importCard = () => page.evaluate(async (card) => {
  const f = new File([JSON.stringify(card)], 'card.json', { type: 'application/json' });
  handleCharCardImport({ target: { files: [f], value: '' } });
}, card);
await importCard();
await page.waitForTimeout(800); await clickDialogs(); await page.waitForTimeout(300); await clickDialogs();
await page.evaluate(async () => { await saveCharacter(); });
await page.waitForTimeout(600); await clickDialogs();
const s9 = await page.evaluate(() => {
  const c = myCharacters.find(x => x.name === '回归测试卡');
  const rs = regexScripts.find(r => r.name === '测试卡状态栏');
  return { c: !!c, scope: rs ? (rs.charScope || []).map(String) : null, id: c ? String(c.id) : '' };
});
check('导入角色卡：角色建好了', s9.c);
check('导入角色卡：卡自带的正则绑到了这个角色身上（不再对所有人生效）', s9.scope && s9.scope.includes(s9.id), JSON.stringify(s9));
await page.evaluate(() => { try { clearForm(); } catch (e) {} });
await importCard();
await page.waitForTimeout(800);
const dup = await page.evaluate(() => { const o = [...document.querySelectorAll('.gy-dialog-overlay')].find(m => getComputedStyle(m).display !== 'none'); return o ? o.innerText : ''; });
check('重复导入：先问一声', dup.includes('已经有叫「回归测试卡」的角色了'), dup.slice(0, 80));
await page.evaluate(() => { const o = [...document.querySelectorAll('.gy-dialog-overlay')].find(m => getComputedStyle(m).display !== 'none'); if (o) [...o.querySelectorAll('button')].find(b => /取消/.test(b.textContent)).click(); });
await page.waitForTimeout(500);
check('重复导入：点取消就什么都不导', await page.evaluate(() => myCharacters.filter(x => x.name === '回归测试卡').length === 1));

// ============ 11. 聊天里的卡片小界面 ============
// （[消息-谁] / <msg> 这类手机格式归「卡片手机」管，见第 4 项；这里用一个别的格式）
const c4 = await newChar();
await page.evaluate((cid) => { regexScripts.push({ id: 'rx_w', name: '定位卡', find: '/\\[定位-([^\\]]+)\\]:\\s*([^\\n]+)/g', replace: '<div class="rt-bubble"><b>$1</b> $2</div>', isRegex: true, enabled: true, displayOnly: true, target: 'ai_output', charScope: [cid] }); }, c4);
await replyOnce(c4, JSON.stringify({ replies: [{ delay: 1, text: '刚到。\n[定位-阿明]: 商场三楼' }] }));
const s11 = await page.evaluate(() => ({ w: !!document.querySelector('.gy-chat-widget .rt-bubble'), raw: [...document.querySelectorAll('.chat-bubble')].some(b => b.innerText.includes('[定位-')) }));
check('卡片小界面：按卡片的设计画出来了', s11.w);
check('卡片小界面：原始方括号不再留在气泡里', !s11.raw);

// ============ 收尾 ============
check('整个过程没有页面报错', pageErrors.length === 0, pageErrors.slice(0, 3).join(' / '));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
