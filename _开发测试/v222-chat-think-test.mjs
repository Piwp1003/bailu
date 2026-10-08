// v222：🕐 聊天里的「这一幕」（像电波手机那样：🕐 场景名 ›，点开是场景描写；思考在里面再点开）
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';
const root = process.cwd();
const BAILU = fs.existsSync(path.join(root, 'js', '90-bailu-cards.js'));
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });
const tag = BAILU ? '[白露]' : '[谷雨]';
for (const mob of [false, true]) {
const W = mob ? '手机' : '电脑';
const page = await (await browser.newContext(mob ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 860 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.dismiss());
await page.route(/^https?:\/\//, r => r.abort());
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && window.gyChatThinkSink, { timeout: 20000 });
await page.waitForTimeout(1200);
const r = await page.evaluate(async (BAILU) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const out = {};
  myCharacters.push({ id: 9991, name: '谢云昭', persona: 'x', worldbooks: [], diaryData: { letters: [], diaries: [] } });
  globalChats['9991'] = [{ sender: 'me', text: '🤔', timestamp: Date.now() - 600000, readBy: [] }];
  switchMainView('chat'); switchChatSession('9991'); await sleep(300);
  out.def = AUTO_FEATURE_DEFS.some(f => f.key === 'chatThink' && f.group === '活人感') && gyChatThinkOn();
  if (!BAILU) {
    reasoningVaultOn = false;
    myApiUrl = 'https://x'; myApiKey = 'k'; myModel = 'm'; try { enableStreaming = false; } catch (e) {}
    window.getApiConfig = () => ({ url: 'https://x', key: 'k', model: 'm' });
    window.__bodies = []; window.smartFetch = async (u, o) => { window.__bodies.push(String(o && o.body || '')); return ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '<think>标题：热饮的余温与老街的雨\n月读：老城区的秋雨还在落，青石板路面的积水里倒映着小卖部的暖光。\n天照：两个人刚从街头走进面馆。</think>' + JSON.stringify({ replies: [{ delay: 0, text: '先进去，里面暖和点。' }, { delay: 0, text: '不饿也喝两口热汤，免得受凉。' }], stateUpdate: '在面馆', scene: { title: '热饮的余温与老街的雨', desc: '老城区的秋雨还在落，青石板路面的积水里倒映着小卖部微弱的暖光。两个人刚从街头走进面馆，门帘掀起一股热腾腾的白汤香气。' } }) } }] }) }); };
    try { smartFetch = window.smartFetch; } catch (e) {}
    await triggerAIBatchReply('9991', '🤔'); await sleep(2500);
  } else {
    // 白露没有模型：直接塞一段，验证显示
    globalChats['9991'].push({ sender: 9991, text: '先进去，里面暖和点。', timestamp: Date.now(), readBy: [], reasoningKey: 'rqtest', scene: { title: '热饮的余温与老街的雨', desc: '老城区的秋雨还在落，青石板路面的积水里倒映着小卖部微弱的暖光。' } }, { sender: 9991, text: '不饿也喝两口热汤。', timestamp: Date.now(), readBy: [] });
    gyChatThinkSink({ key: 'rqtest', text: '标题：热饮的余温与老街的雨\n月读：老城区的秋雨还在落。' });
    renderChatMessages(); await sleep(400);
  }
  const L = globalChats['9991'];
  out.key = L.filter(m => m.reasoningKey).length;
  out.text = L.filter(m => m.sender === 9991).map(m => m.text).join('|');
  out.noLeak = !/月读|<think>/.test(out.text);
  const th = document.querySelectorAll('#chatMessagesArea .gyth');
  out.rows = th.length; out.title = th[0] && th[0].querySelector('.gyth-t').textContent;
  out.closed = th[0] && !th[0].querySelector('.gyth-bd');
  out.before = th[0] && th[0].nextElementSibling && th[0].nextElementSibling.classList.contains('chat-msg-row');
  th[0] && th[0].querySelector('.gyth-hd').click(); await sleep(100);
  const th2 = document.querySelector('#chatMessagesArea .gyth');
  out.opened = !!th2 && /老城区的秋雨/.test((th2.querySelector('.gyth-bd') || {}).textContent || '') && !/月读/.test((th2.querySelector('.gyth-bd') || {}).textContent || '');
  const sub = th2 && th2.querySelector('.gyth-sub'); out.sub = !!sub; sub && sub.click(); await sleep(100);
  out.think = /月读|老城区的秋雨还在落。/.test(((document.querySelector('#chatMessagesArea .gyth .gyth-bd.think')) || {}).textContent || '');
  out.prompt = BAILU ? true : /额外字段·这一幕/.test((window.__bodies || []).join(''));
  out.ctx = /【上一幕】热饮的余温与老街的雨/.test(window.__gySceneCtxFor('9991'));
  out.saved = !!globalChats['9991'].find(m => m.scene && m.scene.title === '热饮的余温与老街的雨');
  th2 && th2.querySelector('.gyth-hd').click(); await sleep(100);
  out.reclosed = !document.querySelector('#chatMessagesArea .gyth-bd');
  // 关掉开关：不显示
  autoFeatureSwitches.chatThink = false; autoFeatureSwitches.chatScene = false; renderChatMessages(); await sleep(100);
  out.off = !document.querySelector('#chatMessagesArea .gyth');
  autoFeatureSwitches.chatThink = true; autoFeatureSwitches.chatScene = true; renderChatMessages(); await sleep(100);
  out.mem = typeof window.gyMemExAdd === 'function';
  out.widget = !!(window.__gyPmW && window.__gyPmW.WD && window.__gyPmW.WD.gyThinkW);
  return out;
}, BAILU);
check(`${tag}${W} 开关在活人感那组，默认开着；两个都关掉就不显示`, r.def && r.off, JSON.stringify(r));
check(`${tag}${W} TA 交了「这一幕」→ 这一轮第一条消息上面一行「🕐 热饮的余温与老街的雨 ›」（场景跟着消息存）；思考不进正文`, r.key >= 1 && r.rows === 1 && r.title === '热饮的余温与老街的雨' && r.closed && r.before && r.noLeak && r.saved && r.prompt, JSON.stringify(r));
check(`${tag}${W} 点一下展开的是场景描写；里面「💭 TA 这一轮在想什么」再点开才是思考；再点收起；下一轮 TA 知道上一幕${BAILU ? '（白露没模型，不交场景，只看到那段文字）' : ''}`, BAILU ? r.reclosed : (r.opened && r.sub && r.think && r.reclosed && r.ctx), JSON.stringify(r));
check(`${tag}${W} 小组件登记好了`, r.widget, JSON.stringify(r));
check(`${tag}${W} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
await page.context().close();
}
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
