// 在无头浏览器里真正把白露跑起来，验证「续写工作台」这个新功能的完整链路。
// CDN 依赖（localforage / mammoth）离线时用本地桩顶上，AI 请求全部拦截成假响应。
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => {
  const t = m.text();
  // file:// 下 manifest / icon / service-worker 取不到是预期的，不算问题
  if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|favicon|manifest/i.test(t)) errors.push('CONSOLE: ' + t);
});
page.on('dialog', async d => {
  if (d.type() === 'prompt') await d.accept('被编辑过的正文');
  else await d.accept();
});

// —— localforage 桩：内存版，够 saveAllData / loadAllData 用 ——
await page.route('**/localforage*.js', route => route.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=JSON.parse(JSON.stringify(v));return Promise.resolve(v)},
    getItem(k){return Promise.resolve(this._d[k]!==undefined?this._d[k]:null)},
    removeItem(k){delete this._d[k];return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));

// —— 拦截所有对外 AI 请求 ——
let streamReply = '夜风从窗缝里挤进来。**你**握紧了手里的信封，指节泛白。\n\n"还要再等吗？"她问。';
// 白露的 streamCompletionText 在流式请求失败时会自动回落到非流式重试（callChatCompletionAPI 还会再重试 2 次），
// 所以要模拟"这一轮确实失败"，必须让窗口期内的所有请求都失败，只挂掉第一个是测不出回滚的。
let failMode = false;
await page.route('**/chat/completions', async route => {
  if (failMode) {
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"message":"模拟服务端 500"}}' });
  }
  // 续写走流式(streamCompletionText)，重roll 走非流式(callChatCompletionAPI)，两种都要能应答
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
  if (body.stream) {
    const sse = streamReply.match(/[\s\S]{1,10}/g).map(chunk =>
      'data: ' + JSON.stringify({ choices: [{ delta: { content: chunk } }] }) + '\n\n').join('') + 'data: [DONE]\n\n';
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  }
  return route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: streamReply } }] })
  });
});
await page.route('**/v1/messages', route => route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: [DONE]\n\n' }));

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof window.saveAllData === 'function' && typeof window.renderStoryStudio === 'function', { timeout: 15000 });
await page.waitForTimeout(600);

const results = [];
const check = (name, ok, extra = '') => results.push({ name, ok, extra });

// ---------- 1. 启动 & 挂载 ----------
check('白露启动无报错', errors.length === 0, errors.join(' | '));
check('js/16 已加载', await page.evaluate(() => typeof renderStoryStudio === 'function'));
check('storySessions 全局已声明', await page.evaluate(() => Array.isArray(storySessions)));
check('存档快照包含 storySessions', await page.evaluate(() =>
  Object.prototype.hasOwnProperty.call(getFullDataSnapshot(), 'storySessions')));
check('导航栏有「续写」入口', (await page.locator('#nav-storystudio').count()) === 1);
check('mobileViewTitles 已注册', await page.evaluate(() => mobileViewTitles.storyStudio === '续写'));

// ---------- 2. 旧入口确实删干净了 ----------
check('小说编辑器里没有互动续写标签', (await page.locator('#novelModeTabInteractive').count()) === 0);
check('旧的 storyTurnsContainer 已移除', (await page.locator('#storyTurnsContainer').count()) === 0);
check('旧的 sendStoryTurn 已移除', await page.evaluate(() => typeof sendStoryTurn === 'undefined'));
check('旧的 switchNovelMode 已移除', await page.evaluate(() => typeof switchNovelMode === 'undefined'));
check('小说的一键生成模式还在', (await page.locator('#novelOutlineModeBox').count()) === 1);
check('共用的第二人称开关仍保留', await page.evaluate(() => typeof syncNovelSecondPerson === 'function'));

// ---------- 3. 准备一个角色 + API ----------
await page.evaluate(() => {
  myCharacters.push({
    id: 9001, name: '沈之遥', persona: '沉默寡言的旧书店老板。', worldbooks: [],
    firstMessage: '<!-- title: 雨天开场 -->\n<!-- desc: 从一场雨开始 -->\n店门被推开时，{{user}}带进来一身雨气。他没抬头。',
    alternateGreetings: ['冬天的午后，店里只有你们两个人。']
  });
  myApiUrl = 'https://api.test.local/v1'; myApiKey = 'sk-test'; myModel = 'gpt-test';
  subApiUrl = ''; subApiKey = ''; subModel = '';
  saveAllData();
});

// ---------- 4. 进入续写工作台 ----------
await page.click('#nav-storystudio');
await page.waitForTimeout(400);
check('续写视图已显示', await page.evaluate(() =>
  document.getElementById('view-story-studio').style.display === 'block'));
check('导航项高亮', await page.evaluate(() =>
  document.getElementById('nav-storystudio').className.includes('active')));
check('空态提示显示', (await page.locator('#storyStudioList .ss-empty').count()) === 1);

// ---------- 5. 新建会话 ----------
await page.click('button:has-text("＋ 新建续写")');
await page.waitForTimeout(300);
check('新建后进入工作台', await page.evaluate(() =>
  document.getElementById('storyStudioWorkView').style.display === 'block'));
check('会话已入库', await page.evaluate(() => storySessions.length === 1));
check('默认停在续写页', await page.evaluate(() =>
  document.getElementById('ssPane-write').style.display === 'block'));

// ---------- 6. 设定页 ----------
await page.click('#ssTab-set');
await page.waitForTimeout(200);
check('设定页可见', await page.evaluate(() => document.getElementById('ssPane-set').style.display === 'block'));
check('角色勾选框渲染出来', (await page.locator('.ss-char-check').count()) >= 2);
await page.fill('#ssTitle', '旧书店的第七天');
await page.fill('#ssOutline', '主角在旧书店打工的第七天，发现一本没有书名的册子。');
await page.fill('#ssExtraChars', '常来的老太太，姓周。');
await page.fill('#ssWordCount', '450');
await page.check('.ss-char-check[value="9001"]');
await page.waitForTimeout(150);
await page.click('#ssPane-set button:has-text("💾 保存设定")');
await page.waitForTimeout(250);
check('标题已保存', await page.evaluate(() => storySessions[0].title === '旧书店的第七天'));
check('大纲已保存', await page.evaluate(() => storySessions[0].outline.includes('第七天')));
check('字数已保存', await page.evaluate(() => storySessions[0].wordCount === 450));
check('出场角色已保存', await page.evaluate(() => storySessions[0].chars.includes(9001)));
check('诊断面板有内容', await page.evaluate(() =>
  document.getElementById('ssDiag').innerHTML.includes('候选世界书')));

// ---------- 7. 提示词组装 ----------
const prompt = await page.evaluate(() => buildSsSystemPrompt(storySessions[0], '测试上下文'));
check('提示词带上标题', prompt.includes('旧书店的第七天'));
check('提示词带上大纲', prompt.includes('发现一本没有书名的册子'));
check('提示词带上角色人设', prompt.includes('沉默寡言的旧书店老板'));
check('提示词带上补充人物', prompt.includes('姓周'));
check('提示词按设定写了字数', prompt.includes('450字'));
check('提示词含第二人称要求', prompt.includes('第二人称视角'));

// 宏替换：applyMacros 应该把 {{char}} 换掉
await page.evaluate(() => { storySessions[0].extraChars = '这里有个宏：{{char}}'; });
const macroPrompt = await page.evaluate(() => buildSsSystemPrompt(storySessions[0], ''));
check('提示词过了宏替换（{{char}} 被换掉）', !macroPrompt.includes('{{char}}') && macroPrompt.includes('沈之遥'));
await page.evaluate(() => { storySessions[0].extraChars = '常来的老太太，姓周。'; });

// ---------- 7.5 开场白开局 ----------
await page.click('#ssTab-write');
check('续写页有开场白按钮', (await page.locator('#ssPane-write button:has-text("用角色开场白开个头")').count()) === 1);
await page.click('#ssPane-write button:has-text("用角色开场白开个头")');
await page.waitForTimeout(400);
check('开场白弹窗打开', await page.evaluate(() =>
  document.getElementById('greetingPickerModal').style.display === 'flex'));
check('弹窗标题说明是第一轮', (await page.textContent('#greetingPickerTitle')).includes('续写第一轮'));
check('列出了 2 个候选（firstMessage + alternate）',
  (await page.locator('#greetingPickerList > div').count()) === 2);
check('picker mode 是 storyStudio', await page.evaluate(() => window.__greetingPickerMode === 'storyStudio'));

await page.locator('#greetingPickerList > div').first().click();
await page.waitForTimeout(500);
check('开场白落成第一轮', await page.evaluate(() => storySessions[0].turns.length === 1));
check('第一轮是 AI 角色的', await page.evaluate(() =>
  storySessions[0].turns[0].role === 'ai' && storySessions[0].turns[0].charId === 9001));
check('开场白打了来源标记', await page.evaluate(() => storySessions[0].turns[0].fromGreeting === true));
check('title/desc 元数据被剥掉', await page.evaluate(() =>
  storySessions[0].turns[0].text.indexOf('<!--') === -1 &&
  storySessions[0].turns[0].text.indexOf('雨天开场') === -1));
check('开场白过了宏替换（{{user}} 被换掉）', await page.evaluate(() =>
  storySessions[0].turns[0].text.indexOf('{{user}}') === -1));
check('开场白正文保留', await page.evaluate(() =>
  storySessions[0].turns[0].text.includes('一身雨气')));
check('弹窗已关闭', await page.evaluate(() =>
  document.getElementById('greetingPickerModal').style.display === 'none'));
check('开场白气泡渲染出来', (await page.locator('#ssTurns .ss-turn.other').count()) === 1);

// 清掉开场白，回到干净状态继续后面的用例
await page.evaluate(() => { storySessions[0].turns = []; renderSsTurns(); saveAllData(); });

// 没勾角色时要给出明确提示，而不是弹个空框
await page.evaluate(() => { window.__ssAlerts = []; storySessions[0].chars = []; });
await page.evaluate(() => {
  window.__origAlert = window.alert;
  window.alert = m => window.__ssAlerts.push(String(m));
});
await page.evaluate(() => showSsGreetingPicker());
await page.waitForTimeout(600);
check('没有可用开场白时给出提示', await page.evaluate(() =>
  (window.__ssAlerts || []).some(m => m.includes('开场白'))));
await page.evaluate(() => {
  if (window.__origAlert) window.alert = window.__origAlert;
  storySessions[0].chars = [9001];
});

// ---------- 8. 发送一轮（真流式）----------
await page.click('#ssTab-write');
await page.fill('#ssInput', '我推开旧书店的门。');
await page.click('#ssSend');
await page.waitForTimeout(1500);

check('生成后有 2 层剧情', await page.evaluate(() => storySessions[0].turns.length === 2),
  '实际 ' + (await page.evaluate(() => storySessions[0].turns.length)));
check('用户轮次内容正确', await page.evaluate(() => storySessions[0].turns[0].text === '我推开旧书店的门。'));
check('AI 轮次拿到正文', await page.evaluate(() => storySessions[0].turns[1].text.includes('夜风')));
check('AI 轮次记了角色 id', await page.evaluate(() => storySessions[0].turns[1].charId === 9001));
check('AI 轮次记了耗时', await page.evaluate(() => storySessions[0].turns[1].genTimeMs > 0));
check('气泡渲染出来', (await page.locator('#ssTurns .ss-turn').count()) === 2);
check('正文过了 markdown 渲染', await page.evaluate(() =>
  !!document.querySelector('#ssTurns .ss-turn.other .ss-bubble b, #ssTurns .ss-turn.other .ss-bubble strong')));
check('楼层号显示', (await page.locator('#ssTurns .ss-meta').first().textContent()).includes('#1楼'));
check('输入框已清空', (await page.inputValue('#ssInput')) === '');
check('已写进存档', await page.evaluate(async () => {
  const d = await localforage.getItem('myTwitterAppData');
  return d && d.storySessions && d.storySessions[0].turns.length === 2;
}));

// ---------- 9. 隐藏楼层不进 prompt ----------
await page.evaluate(() => { storySessions[0].turns[0].hidden = true; });
const hist = await page.evaluate(() => buildSsHistory(storySessions[0]));
check('隐藏楼层被排除出历史', hist.length === 1 && hist[0].role === 'assistant');
await page.evaluate(() => { storySessions[0].turns[0].hidden = false; });
const hist2 = await page.evaluate(() => buildSsHistory(storySessions[0]));
check('取消隐藏后回到历史', hist2.length === 2);

// ---------- 10. 重roll → swipes ----------
streamReply = '这一次她没有抬头，只把那本册子往柜台里推了推。';
await page.click('button:has-text("🔄 重roll 最后一轮")');
await page.waitForTimeout(1200);
check('重roll 后攒出 2 个版本', await page.evaluate(() => storySessions[0].turns[1].swipes.length === 2));
check('重roll 后正文换成新版本', await page.evaluate(() => storySessions[0].turns[1].text.includes('没有抬头')));
check('侧滑控件出现', (await page.locator('#ssTurns .ss-swipe').count()) === 1);
await page.locator('#ssTurns .ss-swipe .nav').first().click();
await page.waitForTimeout(250);
check('◀ 翻回旧版本', await page.evaluate(() => storySessions[0].turns[1].text.includes('夜风')));

// ---------- 11. 右键菜单 ----------
await page.locator('#ssTurns .ss-turn.other .ss-bubble').last().click({ button: 'right' });
await page.waitForTimeout(200);
check('右键菜单弹出', await page.evaluate(() =>
  document.getElementById('ssTurnContextMenu').style.display === 'flex'));
check('菜单 5 个动作', (await page.locator('#ssTurnContextMenu button').count()) === 5);
await page.click('#ssTurnContextMenu button:has-text("🙈")');
await page.waitForTimeout(300);
check('隐藏动作生效', await page.evaluate(() => storySessions[0].turns[1].hidden === true));
check('隐藏楼层视觉变淡', (await page.locator('#ssTurns .ss-turn.hidden-turn').count()) === 1);
await page.evaluate(() => { storySessions[0].turns[1].hidden = false; renderSsTurns(); });

// ---------- 12. 生成失败要回滚 ----------
const before = await page.evaluate(() => storySessions[0].turns.length);
failMode = true;
await page.fill('#ssInput', '这一轮会失败');
await page.click('#ssSend');
await page.waitForTimeout(4000);   // 要等它把流式失败 + 非流式重试全部走完
failMode = false;
check('失败后轮次数回滚', await page.evaluate(n => storySessions[0].turns.length === n, before),
  '前 ' + before + ' 后 ' + (await page.evaluate(() => storySessions[0].turns.length)));
check('失败后输入被还回', (await page.inputValue('#ssInput')) === '这一轮会失败');
await page.fill('#ssInput', '');

// ---------- 13. 章节存档 ----------
await page.click('button:has-text("💾 存为新章节")');
await page.waitForTimeout(500);
check('存档后剧情清空', await page.evaluate(() => storySessions[0].turns.length === 0));
check('章节已入库', await page.evaluate(() => storySessions[0].chapters.length === 1));
check('章节只收 AI 正文', await page.evaluate(() =>
  storySessions[0].chapters[0].content.indexOf('我推开旧书店的门') === -1));
await page.click('#ssTab-arc');
await page.waitForTimeout(250);
check('章节页渲染出 1 章', (await page.locator('#ssChapters .ss-card').count()) === 1);
await page.click('#ssChapters .ss-card-ops span[title="阅读"]');
await page.waitForTimeout(250);
check('阅读弹窗打开', await page.evaluate(() =>
  document.getElementById('ssReaderModal').style.display === 'flex'));
check('弹窗里有正文', (await page.textContent('#ssReaderContent')).includes('夜风'));
await page.click('#ssReaderModal button:has-text("关闭")');

// ---------- 14. 返回列表 & 多会话 ----------
await page.click('#storyStudioWorkView .back-btn');
await page.waitForTimeout(300);
check('返回会话列表', await page.evaluate(() =>
  document.getElementById('storyStudioListView').style.display === 'block'));
check('列表卡片渲染', (await page.locator('#storyStudioList .ss-card').count()) === 1);
check('卡片显示标题', (await page.textContent('#storyStudioList .ss-card-title')).includes('旧书店'));

await page.click('button:has-text("＋ 新建续写")');
await page.waitForTimeout(300);
await page.click('#storyStudioWorkView .back-btn');
await page.waitForTimeout(300);
check('第二个会话独立存在', await page.evaluate(() => storySessions.length === 2));
check('两个会话设定互不影响', await page.evaluate(() =>
  storySessions.find(s => s.title === '旧书店的第七天').wordCount === 450 &&
  storySessions.find(s => s.title !== '旧书店的第七天').wordCount === 300));

// ---------- 15. 旧数据迁移 ----------
await page.evaluate(() => {
  globalNovels.push({
    id: 777, title: '被遗忘的旧稿', outline: '旧大纲', chars: [9001], chapters: [],
    storyTurnWordCount: 600, secondPerson: false,
    storyTurns: [
      { id: 'old_u', role: 'user', text: '旧的用户输入' },
      { id: 'old_a', role: 'ai', text: '旧的AI续写', charId: 9001 }
    ]
  });
  saveAllData();
});
await page.click('#nav-storystudio');
await page.waitForTimeout(600);
check('旧 storyTurns 已迁移成会话', await page.evaluate(() =>
  storySessions.some(s => s.id === 'ss_migrated_777' && s.turns.length === 2)));
check('迁移带上了大纲/字数/人称', await page.evaluate(() => {
  const s = storySessions.find(x => x.id === 'ss_migrated_777');
  return s.outline === '旧大纲' && s.wordCount === 600 && s.secondPerson === false;
}));
check('迁移后清空了小说上的 storyTurns', await page.evaluate(() =>
  globalNovels.find(n => n.id === 777).storyTurns.length === 0));
check('迁移只跑一次（打了标记）', await page.evaluate(() =>
  globalNovels.find(n => n.id === 777).__ssMigrated === true));
const cntBefore = await page.evaluate(() => storySessions.length);
await page.evaluate(() => migrateLegacyStoryTurns());
check('重复调用迁移不会重复建会话', await page.evaluate(n => storySessions.length === n, cntBefore));

// ---------- 16. 「用已有内容生成」素材源改指向新会话 ----------
const srcHtml = await page.evaluate(() => {
  const div = document.createElement('div');
  renderNovelSrcListContinuation(div);
  return div.innerHTML;
});
check('素材源列出了续写会话', srcHtml.includes('旧书店的第七天'));
check('素材源不再报"暂无"', !srcHtml.includes('novel-src-empty'));

// ---------- 16.5 小说「一键生成模式」的开场白没被改坏 ----------
await page.evaluate(() => {
  globalNovels.find(x => x.id === 777).chapters = [];
  switchMainView('novel');
  openNovelDetail(777);   // 真正打开编辑器，.novel-char-check 才会被渲染出来
});
await page.waitForTimeout(500);
await page.evaluate(() => {
  document.querySelectorAll('.novel-char-check').forEach(cb => { cb.checked = (cb.value === '9001'); });
  showNovelGreetingPicker(true);
});
await page.waitForTimeout(400);
check('小说开场白 picker mode 仍是 novelOutline', await page.evaluate(() =>
  window.__greetingPickerMode === 'novelOutline'));
check('小说开场白弹窗标题是"作为一章内容"', (await page.textContent('#greetingPickerTitle')).includes('一章内容'));
await page.locator('#greetingPickerList > div').first().click();
await page.waitForTimeout(400);
check('小说开场白进了章节预览区', await page.evaluate(() =>
  document.getElementById('novelTempArea').style.display === 'block' &&
  document.getElementById('novelTempContent').value.includes('一身雨气')));
check('小说开场白不会直接落成章节', await page.evaluate(() =>
  globalNovels.find(x => x.id === 777).chapters.length === 0));

// ---------- 16.8 状态栏（角色专属正则）----------
// 角色卡自带的状态栏卡片，是靠"仅影响显示"(displayOnly) 且绑定了角色(charScope) 的正则脚本
// 把 <状态栏>...</状态栏> 这种标签块替换成一段 HTML 渲染出来的。
await page.evaluate(() => {
  // 模拟从「设置 → AI增强功能」手动添加一条角色专属正则：
  // 这条路径拿到的 charScope 来自 DOM 的 value，一定是字符串
  regexScripts.push({
    id: 'rx_status_ui', name: '状态栏(界面添加)',
    find: '/<状态栏>([\\s\\S]*?)<\\/状态栏>/g',
    replace: '<div class="test-statusbar">$1</div>',
    isRegex: true, target: 'ai_output', enabled: true,
    displayOnly: true, promptOnly: false,
    minDepth: null, maxDepth: null,
    charScope: ['9001'],          // 字符串
  });
  // 再来一条全局的（没绑角色），用来对照
  regexScripts.push({
    id: 'rx_status_global', name: '状态栏(全局)',
    find: '/<全局栏>([\\s\\S]*?)<\\/全局栏>/g',
    replace: '<div class="test-globalbar">$1</div>',
    isRegex: true, target: 'ai_output', enabled: true,
    displayOnly: true, promptOnly: false,
    minDepth: null, maxDepth: null, charScope: null,
  });
});

// 直接验渲染函数：给一段带状态栏标签的正文，看能不能替换成 HTML
const statusHtml = await page.evaluate(() =>
  renderMarkdownLite('正文内容\n<状态栏>好感度:5</状态栏>', 9001));   // charId 是数字
check('状态栏·角色专属正则能命中（数字 charId vs 字符串 charScope）',
  statusHtml.includes('test-statusbar'), statusHtml.slice(0, 120));

const statusHtmlStr = await page.evaluate(() =>
  renderMarkdownLite('正文\n<状态栏>好感度:5</状态栏>', '9001'));    // charId 是字符串
check('状态栏·charId 传字符串也能命中', statusHtmlStr.includes('test-statusbar'));

const globalHtml = await page.evaluate(() =>
  renderMarkdownLite('正文\n<全局栏>abc</全局栏>', null));
check('状态栏·全局正则不受影响', globalHtml.includes('test-globalbar'));

const otherCharHtml = await page.evaluate(() =>
  renderMarkdownLite('正文\n<状态栏>好感度:5</状态栏>', 8888));
check('状态栏·别的角色不会误触发', !otherCharHtml.includes('test-statusbar'));

// 端到端：在续写工作台里真的生成一轮带状态栏的正文
await page.click('#nav-storystudio');
await page.waitForTimeout(300);
await page.evaluate(() => {
  const s = storySessions.find(x => x.title === '旧书店的第七天');
  currentStorySessionId = s.id;
  s.chars = [9001];
  s.turns = [];
  openStorySession(s.id);
});
await page.waitForTimeout(300);
streamReply = '他把册子推了过来。\n<状态栏>好感度:12 地点:旧书店</状态栏>';
await page.fill('#ssInput', '我伸手去接。');
await page.click('#ssSend');
await page.waitForTimeout(1600);
check('续写·状态栏卡片渲染出来了',
  (await page.locator('#ssTurns .test-statusbar').count()) === 1,
  '气泡 HTML: ' + (await page.evaluate(() => {
    const b = document.querySelector('#ssTurns .ss-turn.other .ss-bubble');
    return b ? b.innerHTML.slice(0, 200) : '(没有气泡)';
  })));
check('续写·状态栏内容正确', await page.evaluate(() => {
  const el = document.querySelector('#ssTurns .test-statusbar');
  return el ? el.textContent.includes('好感度:12') : false;
}));

// ---------- 16.9 思维链只在小说/续写出现 ----------
await page.evaluate(() => { reasoningDisplayMode = 'collapse'; showNovelReasoning = true; });

const chatSide = await page.evaluate(() =>
  processReasoningInText('<think>我在想事情</think>这是正文'));
check('思维链·聊天等场景一律剥掉，不输出折叠框',
  !chatSide.includes('<details') && !chatSide.includes('我在想事情') && chatSide.includes('这是正文'),
  chatSide);

const novelSide = await page.evaluate(() =>
  extractReasoningForNovel('<think>我在想事情</think>这是正文'));
check('思维链·小说/续写保留可展开折叠框',
  novelSide.reasoningHtml.includes('<details') && novelSide.reasoningHtml.includes('我在想事情'));
check('思维链·折叠框不拼进正文（否则会挡住 ^ 锚定的状态栏正则）',
  novelSide.rest === '这是正文', novelSide.rest);

// 关掉小说思维链开关后，小说这边也不该有
const novelOff = await page.evaluate(() => {
  showNovelReasoning = false;
  const r = extractReasoningForNovel('<think>思考</think>正文');
  showNovelReasoning = true;
  return r;
});
check('思维链·小说开关关掉后不显示但仍剥离',
  novelOff.reasoningHtml === '' && novelOff.rest === '正文');

// ---------- 17. 存档往返 ----------
await page.evaluate(() => saveAllData());
const roundTrip = await page.evaluate(async () => {
  const d = await localforage.getItem('myTwitterAppData');
  storySessions = [];
  if (d.storySessions) storySessions = d.storySessions;
  return storySessions.length;
});
check('storySessions 能从存档还原', roundTrip >= 3, '还原了 ' + roundTrip + ' 个');

await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.name + (r.extra && !r.ok ? '  → ' + r.extra : '')));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
// 故意制造失败的那一步会打出 500，属于预期
const realErrors = errors.filter(e => !/模拟服务端 500|续写失败|status of 500/.test(e));
if (realErrors.length) { console.log('\n页面报错：'); realErrors.forEach(e => console.log('  ' + e)); }
process.exit(bad.length || realErrors.length ? 1 : 0);
