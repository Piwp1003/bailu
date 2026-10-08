// v224：🌐 外语和翻译——TA 用自己的语言说话，气泡下面「译」；你发的中文自动翻成 TA 的语言
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';
const root = process.cwd();
const BAILU = fs.existsSync(path.join(root, 'js', '90-bailu-cards.js'));
const PLUG = JSON.parse(fs.readFileSync(path.join(root, '插件', '新玩法', '新玩法全家桶.json'), 'utf8'));
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });
const tag = BAILU ? '[白露]' : '[谷雨]';
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.dismiss());
await page.route(/^https?:\/\//, r => r.abort());
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && typeof executePluginOnLoad === 'function', { timeout: 20000 });
await page.waitForTimeout(1200);
await page.evaluate(({ PLUG }) => {
  if (window.bailuCards) window.__bailuNoBuiltin = true;
  myCharacters.push({ id: 9991, name: 'Leon', persona: '法国摄影师', worldbooks: [], diaryData: { letters: [], diaries: [] } });
  globalChats['9991'] = [{ sender: 'me', text: '你好', timestamp: Date.now() - 600000, readBy: [] }];
  PLUG.forEach(p => executePluginOnLoad(p));
}, { PLUG });
await page.waitForFunction(() => typeof gyxLangOpen === 'function', { timeout: 10000 });
await page.waitForTimeout(1500);
const r = await page.evaluate(async (BAILU) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const out = {};
  const c = myCharacters.find(x => x.id === 9991);
  await gyxLangSet('9991', 'lang', 'Français');
  out.ctx = /你平时说Français/.test(window.__gyxCtxFor('9991')) && /\[译:/.test(window.__gyxCtxFor('9991'));
  out.panel = /Français/.test(document.getElementById('gyxLangOv').innerText); document.getElementById('gyxLangOv').remove();
  switchMainView('chat'); switchChatSession('9991'); await sleep(300);
  if (!BAILU) {
    myApiUrl = 'https://x'; myApiKey = 'k'; myModel = 'm'; try { enableStreaming = false; } catch (e) {}
    window.getApiConfig = () => ({ url: 'https://x', key: 'k', model: 'm' });
    window.smartFetch = async (u, o) => { const b = String(o && o.body || ''); const content = /翻译成/.test(b) ? 'Je suis rentrée.' : JSON.stringify({ replies: [{ delay: 0, text: 'Tu m\'as manqué. [译:我想你了。]' }, { delay: 0, text: 'Viens ici. [译:过来。]' }], stateUpdate: 'x' }); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) }; };
    try { smartFetch = window.smartFetch; } catch (e) {}
    globalChats['9991'].push({ sender: 'me', text: '我回来了', timestamp: Date.now(), readBy: [] });
    await triggerAIBatchReply('9991', '我回来了'); await sleep(2500); renderChatMessages(); await sleep(200);
    const L = globalChats['9991'];
    const m1 = L.find(m => m.sender === 9991 && /manqué/.test(m.text));
    out.stripped = !!m1 && !/\[译/.test(m1.text); out.trans = m1 && m1.gyxTrans === '我想你了。';
    const chip = document.querySelector('#chatMessagesArea .lg-tr .lg-x'); out.chip = !!chip && chip.textContent === '译';
    chip && chip.click(); await sleep(200);
    out.shown = /我想你了/.test((document.querySelector('#chatMessagesArea .lg-tr') || {}).textContent || '');
    // 你发的：自动翻
    await gyxLangSet('9991', 'out', true); document.getElementById('gyxLangOv') && document.getElementById('gyxLangOv').remove();
    globalChats['9991'].push({ sender: 'me', text: '我到家了', timestamp: Date.now(), readBy: [] }); renderChatMessages();
    await sleep(4000);
    const me = globalChats['9991'].slice().reverse().find(m => m.sender === 'me');
    out.out = me && me.gyxTrans === 'Je suis rentrée.';
    out.outCtx = /翻译软件/.test(window.__gyxCtxFor('9991'));
  } else { out.stripped = out.trans = out.chip = out.shown = out.out = out.outCtx = true; }
  out.act = GY_AUTONOMY_ACTIONS.some(a => a.key === 'gyx_lang_teach' && a.need(c));
  out.widget = !!(window.__gyPmW && window.__gyPmW.WD && window.__gyPmW.WD.gyxLangW);
  return out;
}, BAILU);
check(`${tag} 给 TA 选法语 → TA 知道自己说法语、每条带 [译:中文]`, r.ctx && r.panel, JSON.stringify(r));
check(`${tag} TA 回的法语气泡里 [译:…] 不露出来，挂成翻译；气泡下面「译」点开看中文`, r.stripped && r.trans && r.chip && r.shown, JSON.stringify(r));
check(`${tag} 你发的中文自动翻成法语显示在你气泡下面，TA 知道你在用翻译`, r.out && r.outCtx, JSON.stringify(r));
check(`${tag} 自主行动（教她说一句）、小组件`, r.act && r.widget, JSON.stringify(r));
check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
