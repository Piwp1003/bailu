// v215：📲 手机桌面小组件（安卓「谷雨小组件」App 广播 / 苹果 Scriptable + Cloudflare 中转站 / 从桌面点进来跳到功能 / TA 桌面留言）
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';
import vm from 'vm';

const root = process.cwd();
const BAILU = fs.existsSync(path.join(root, 'js', '90-bailu-cards.js'));
const PLUG = JSON.parse(fs.readFileSync(path.join(root, '插件', '新玩法', '新玩法全家桶.json'), 'utf8'));
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.accept());
const relayHits = [];
await page.route(/^https?:\/\//, r => {
  const u = r.request().url();
  if (u.startsWith('https://relay.test/w/')) { relayHits.push({ url: u, method: r.request().method(), body: r.request().postData() }); return r.fulfill({ status: 200, body: 'ok', headers: { 'Access-Control-Allow-Origin': '*' } }); }
  return r.abort();
});
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && typeof executePluginOnLoad === 'function' && window.__gyPmW, { timeout: 20000 });
await page.waitForTimeout(1500);
const tag = BAILU ? '[白露]' : '[谷雨]';

await page.evaluate(({ PLUG, BAILU }) => {
  if (BAILU) window.__bailuNoBuiltin = true;
  myCharacters.length = 0;
  myCharacters.push({ id: 9991, name: '顾言', persona: '温柔的医生', worldbooks: [], actMode: 'fixed', diaryData: { letters: [], diaries: [] } });
  globalChats['9991'] = [{ sender: 'me', text: '今天好累呀', timestamp: Date.now() - 60000 }, { sender: 9991, text: '辛苦啦', timestamp: Date.now() - 30000 }];
  currentChatSessionId = '9991';
  window.__sent = []; window.sendProactiveChatMessage = async c => { window.__sent.push(c.id); };
  if (!BAILU) {
    window.getApiConfig = () => ({ url: 'https://x', key: 'k', model: 'm' });
    window.sendChatRequest = async (api, p) => ({ choices: [{ message: { content: /便利贴/.test(p) ? '解锁一次想我一次' : '好呀' } }] });
  }
  PLUG.forEach(p => executePluginOnLoad(p));
}, { PLUG, BAILU });
await page.waitForFunction(() => typeof gyxPhoneWPush === 'function' && gyxPhoneWData().cfg.token, { timeout: 10000 });
await page.waitForTimeout(1200);

// 注册了：开关、自主行动、小组件、小程序
const reg = await page.evaluate(() => ({ act: !!GY_AUTONOMY_ACTIONS.find(x => x.key === 'gyx_phonew'), w: !!(__gyPmW.WD.gyxPhoneWW), tok: gyxPhoneWData().cfg.token }));
check(`${tag} 插件注册好了（自主行动 / 小组件 / 自动生成口令）`, reg.act && reg.w && /^[a-z0-9]{18}$/.test(reg.tok), JSON.stringify(reg));

// 把小组件读成纯文字卡片
const col = await page.evaluate(() => { const c = gyxPhoneWCollect(); return { n: c.length, bad: c.filter(x => !x.k || !x.n || !x.lines || !x.lines.length || x.lines.some(l => /</.test(l))).length, self: c.some(x => x.k === 'gyxPhoneWW'), sample: c.slice(0, 3) }; });
check(`${tag} 项目里的小组件都能读成「图标 + 标题 + 几行字」的卡片`, col.n >= 15 && col.bad === 0 && !col.self, JSON.stringify(col).slice(0, 400));

// 不在 App 也没填中转站：不会假装同步成功
const none = await page.evaluate(async () => { const r = await gyxPhoneWPush(); return { ok: r.ok.length, n: r.n }; });
check(`${tag} 网页里没填中转站时不会假装同步成功`, none.ok === 0 && none.n > 0, JSON.stringify(none));

// 模拟安卓 5+ App：发广播给 com.guyu.widget
const and = await page.evaluate(async () => {
  const sent = []; let extras = { gyx_open: null };
  function Intent(a) { this.action = a; this.ex = {}; }
  Intent.prototype.setPackage = function (p) { this.pkg = p; }; Intent.prototype.putExtra = function (k, v) { this.ex[k] = v; };
  const main = { getPackageName: () => 'io.dcloud.guyu', sendBroadcast: it => sent.push(it), getIntent: () => ({ getStringExtra: k => extras[k], removeExtra: k => { extras[k] = null; } }) };
  window.plus = { android: { runtimeMainActivity: () => main, importClass: n => n === 'android.content.Intent' ? Intent : null }, runtime: { arguments: '' } };
  const r = await gyxPhoneWPush(); const it = sent[0]; const d = it && JSON.parse(it.ex.data);
  // 从桌面点卡片进来：plus.runtime.arguments 里带 gyx_open
  let opened = []; const W = __gyPmW.WD; const k = Object.keys(W).find(x => x !== 'gyxPhoneWW' && W[x].tap); const old = W[k].tap; W[k].tap = () => opened.push(k);
  plus.runtime.arguments = JSON.stringify({ gyx_open: k }); gyxPhoneWReadLaunch();
  // 第二种：intent 里带 extra
  extras.gyx_open = k; gyxPhoneWReadLaunch();
  const cleared = extras.gyx_open === null && plus.runtime.arguments === '';
  W[k].tap = old; delete window.plus;
  return { ok: r.ok, action: it && it.action, pkg: it && it.pkg, app: d && d.app, from: d && d.pkg, cards: d && d.cards.length, opened: opened.length, cleared };
});
check(`${tag} 在安卓 App 里：把卡片数据广播给「谷雨小组件」(com.guyu.widget)，带上自己的包名`, and.ok.includes('安卓') && and.action === 'com.guyu.widget.UPDATE' && and.pkg === 'com.guyu.widget' && and.from === 'io.dcloud.guyu' && and.cards > 10, JSON.stringify(and));
check(`${tag} 从桌面点卡片进来（启动参数 / intent 两种）都会打开对应功能，用过就清掉`, and.opened === 2 && and.cleared, JSON.stringify(and));

// 中转站：填了地址就 POST 到 /w/<口令>
const rl = await page.evaluate(async () => { await gyxPhoneWCfg('relay', 'https://relay.test/'); await gyxPhoneWCfg('theme', 'pink'); await new Promise(r => setTimeout(r, 300)); const r = await gyxPhoneWPush(); return { ok: r.ok, tok: gyxPhoneWData().cfg.token }; });
await page.waitForTimeout(300);
const last = relayHits[relayHits.length - 1]; let body = null; try { body = JSON.parse(last.body); } catch (e) {}
check(`${tag} 填了中转站：POST 到 /w/口令，带主题和卡片`, rl.ok.includes('中转站') && last && last.method === 'POST' && last.url === 'https://relay.test/w/' + rl.tok && body && body.theme === 'pink' && body.cards.length > 10, JSON.stringify({ rl, url: last && last.url, theme: body && body.theme }));

// 关掉某张卡片后不再推
const off = await page.evaluate(async () => { const k = gyxPhoneWCollect()[0].k; await gyxPhoneWCfg('off', [k, false]); const has = gyxPhoneWCollect().some(x => x.k === k); await gyxPhoneWCfg('off', [k, true]); return { has, back: gyxPhoneWCollect().some(x => x.k === k) }; });
check(`${tag} 卡片可以单独勾掉不推`, !off.has && off.back, JSON.stringify(off));

// ?open= 网址（苹果 Scriptable 点进来）
const url = await page.evaluate(() => { const W = __gyPmW.WD; const k = Object.keys(W).find(x => x !== 'gyxPhoneWW' && W[x].tap); let hit = 0; const old = W[k].tap; W[k].tap = () => hit++; const u = new URL(location.href); u.searchParams.set('open', k); history.replaceState(null, '', u.toString()); gyxPhoneWReadLaunch(); W[k].tap = old; return { hit, clean: !new URL(location.href).searchParams.has('open') }; });
check(`${tag} 网址带 ?open=xxx 进来会打开那个功能，然后把参数去掉`, url.hit === 1 && url.clean, JSON.stringify(url));

// TA 在桌面留言 → 第一张卡片
const msg = await page.evaluate(async () => { const n0 = gyxPhoneWData().msgs.length; const t = await gyxPhoneWMsg('9991'); const c = gyxPhoneWCollect()[0]; document.getElementById('gyxPwOv')?.remove(); const a = GY_AUTONOMY_ACTIONS.find(x => x.key === 'gyx_phonew'); return { t, n: gyxPhoneWData().msgs.length - n0, first: c.k, line: c.lines[0], need: a.need(myCharacters[0]) }; });
check(`${tag} TA 在桌面小组件上留言：排第一张，一天内不重复留`, msg.t && msg.n === 1 && msg.first === 'gyxTaMsg' && msg.line === msg.t.slice(0, 40) && msg.need === false, JSON.stringify(msg));

// 面板各页都能打开
const tabs = await page.evaluate(() => { const o = {}; for (const t of ['main', 'cards', 'android', 'ios', 'msg']) { gyxPhoneWOpen(t); o[t] = document.getElementById('gyxPwOv').innerText.length; } document.getElementById('gyxPwOv').remove(); return o; });
check(`${tag} 面板五页（同步 / 卡片 / 安卓 / 苹果 / 留言）都能打开`, Object.values(tabs).every(n => n > 40), JSON.stringify(tabs));

// Scriptable 脚本：在假的 Scriptable 环境里跑一遍
await page.evaluate(() => gyxPhoneWCfg('web', 'https://me.test/app/'));
const sc = await page.evaluate(() => ({ s: gyxPhoneWScript(), w: gyxPhoneWWorker(), tok: gyxPhoneWData().cfg.token }));
const runScriptable = async (param, fam, data) => {
  const log = { texts: [], url: null, set: false, req: null }; const TX = () => ({ rightAlignText() {}, leftAlignText() {}, centerAlignText() {} });
  function W() { this.addText = t => { log.texts.push(t); return TX(); }; this.addStack = () => ({ centerAlignContent() {}, addText: t => { log.texts.push(t); return TX(); }, addSpacer() {} }); this.addSpacer = () => {}; this.setPadding = () => {}; Object.defineProperty(this, 'url', { set: v => log.url = v }); }
  const files = {};
  const sb = { ListWidget: W, Color: function () {}, Font: { systemFont: () => 0, boldSystemFont: () => 0 }, config: { runsInWidget: true, widgetFamily: fam }, args: { widgetParameter: param },
    Script: { setWidget: () => log.set = true, complete: () => {} },
    FileManager: { local: () => ({ joinPath: (a, b) => a + '/' + b, documentsDirectory: () => '/d', writeString: (p, s) => files[p] = s, readString: p => { if (!(p in files)) throw new Error('no'); return files[p]; } }) },
    Request: function (u) { log.req = u; this.loadJSON = async () => data; }, console };
  await vm.runInNewContext('(async () => {' + sc.s + '\n})()', sb);
  return log;
};
const fake = { app: '谷雨', at: Date.now(), theme: 'pink', cards: [{ k: 'gyxTaMsg', ico: '💌', n: '顾言 的留言', lines: ['想你了'] }, { k: 'gyxAskW', ico: '❓', n: '每日一问', lines: ['今天的问题', '还没答'] }] };
const s1 = await runScriptable('每日一问', 'medium', fake), s2 = await runScriptable('', 'large', fake), s3 = await runScriptable('', 'small', { cards: [] });
check(`${tag} Scriptable 脚本：填好了中转站和口令，按参数挑卡片，点了带 ?open=，大号显示多张，没数据有提示`,
  s1.set && s1.req === 'https://relay.test/w/' + sc.tok && s1.texts.includes('每日一问') && /open=gyxAskW/.test(s1.url || '') && s2.texts.includes('顾言 的留言') && s2.texts.includes('每日一问') && s3.texts.some(t => /现在同步/.test(t)),
  JSON.stringify({ s1, s2: s2.texts, s3: s3.texts }).slice(0, 500));

// Cloudflare Worker：用假的 KV 跑一遍
const wsrc = sc.w.replace('export default', 'module.exports =');
const mod = { exports: null }; vm.runInNewContext(wsrc, { module: mod, Response, URL, JSON });
const kv = {}; const env = { WIDGET: { put: async (k, v) => kv[k] = v, get: async k => kv[k] || null } };
const T = 'abcdefghijklmnop12';
const p1 = await mod.exports.fetch(new Request('https://w.dev/w/' + T, { method: 'POST', body: JSON.stringify(fake) }), env);
const g1 = await mod.exports.fetch(new Request('https://w.dev/w/' + T), env);
const g0 = await mod.exports.fetch(new Request('https://w.dev/w/zzzzzzzzzzzzzzzzzz'), env);
const bad = await mod.exports.fetch(new Request('https://w.dev/w/' + T, { method: 'POST', body: 'xx' }), env);
const short = await mod.exports.fetch(new Request('https://w.dev/w/abc'), env);
const g1j = await g1.json();
check(`${tag} 中转站 Worker：存 / 取 / 没有时给空 / 不是 JSON 拒收 / 口令太短不认`, p1.status === 200 && g1j.cards.length === 2 && (await g0.json()).cards.length === 0 && bad.status === 400 && /在运行/.test(await short.text()), JSON.stringify(g1j).slice(0, 100));

// 记忆总览 / 今天
const mem = await page.evaluate(() => ({ today: !!document.body, mem: typeof gyxPhoneWData === 'function' && gyxPhoneWData().msgs.length > 0 }));
check(`${tag} 留言进了记忆总览的数据`, mem.mem, JSON.stringify(mem));

check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
await browser.close();
const badR = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - badR.length) + '/' + results.length + ' 通过');
process.exit(badR.length ? 1 : 0);
