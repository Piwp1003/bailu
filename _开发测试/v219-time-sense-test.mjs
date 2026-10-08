// v219：🕰️ 感知真实时间（总开关）——开着跟以前一样；关上以后发给模型的内容里没有现实时间
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
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.dismiss());
await page.route(/^https?:\/\//, r => r.abort());
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && window.gyTimeSenseSet, { timeout: 20000 });
await page.waitForTimeout(1500);

const base = await page.evaluate(async () => {
  openSettingsPanel && openSettingsPanel('chat');
  const def = AUTO_FEATURE_DEFS.find(f => f.key === 'timeSense');
  return { def: !!def && def.group === '活人感', on: gyTimeSenseOn(), row: !!document.querySelector('#gyTimeSenseRow .gyts-sw') || !!document.getElementById('tpesEnabled') === false };
});
check(`${tag} 「感知真实时间」开关在活人感那组，默认开着；设置里 TPES 上面有总开关`, base.def && base.on && base.row, JSON.stringify(base));

if (!BAILU) {
  const run = async () => page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    if (!myCharacters.find(c => c.id === 9991)) myCharacters.push({ id: 9991, name: '顾言', persona: '温柔的医生', worldbooks: [], actMode: 'fixed', diaryData: { letters: [], diaries: [] } });
    const c = myCharacters.find(x => x.id === 9991);
    c.lifeState = { activity: '在医院值夜班', updatedAt: Date.now() - 3 * 864e5 };
    c.schedule = { text: '08:00 查房\n14:00 门诊\n22:00 值夜班', date: '' };
    c.todos = [{ text: '给她买伞', date: '2020-01-01', done: false }];
    const T = Date.now();
    globalChats['9991'] = [
      { sender: 'me', text: '在吗', timestamp: T - 3 * 864e5, readBy: [] },
      { sender: 9991, text: '在的', timestamp: T - 3 * 864e5 + 60000, readBy: [] },
      { sender: 'me', text: '我回来啦', timestamp: T, readBy: [] }];
    currentChatSessionId = '9991';
    myApiUrl = 'https://x'; myApiKey = 'k'; myModel = 'm'; try { enableStreaming = false; } catch (e) {}
    window.getApiConfig = () => ({ url: 'https://x', key: 'k', model: 'm' });
    window.__bodies = [];
    window.smartFetch = async (url, opt) => { window.__bodies.push(String(opt && opt.body || '')); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ replies: [{ delay: 0, text: '嗯，回来就好' }], stateUpdate: '在看书' }) } }] }) }; };
    try { smartFetch = window.smartFetch; } catch (e) {}
    await triggerAIBatchReply('9991', '我回来啦'); await sleep(1500);
    const all = window.__bodies.map(b => { try { return JSON.parse(b).messages.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n'); } catch (e) { return b; } }).join('\n=====\n');
    // 别的功能自己拼的「现在是…」也会被抹掉
    window.__bodies.length = 0;
    await sendChatRequestRaw({ url: 'https://x', key: 'k', model: 'm' }, `现在是 ${new Date().toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' })}。按你的性子想一想要不要发消息。`);
    const other = window.__bodies.map(b => { try { return JSON.parse(b).messages[0].content; } catch (e) { return b; } }).join('\n');
    const yr = String(new Date().getFullYear());
    return {
      sent: window.__bodies.length >= 0 && all.length > 100,
      tags: /\[3天前\]|\[刚刚\]|\[\d+天前\]/.test(all), gap: /中间过去了约/.test(all),
      now: /现在的真实时间|【当前真实时间】/.test(all), year: all.includes(yr + '-') || new RegExp(yr + '\\/').test(all),
      tpes: /时间感知协议 TPES/.test(all), rule: /不按现实时间走/.test(all),
      sched: /你今天的日程安排/.test(all), todo: /给她买伞/.test(all), todoDate: /2020-01-01/.test(all),
      state: /在医院值夜班/.test(all), stateUpd: /stateUpdate/.test(all),
      other: other.slice(0, 80), otherHasTime: other.includes(yr), otherKeep: /按你的性子/.test(other)
    };
  });
  const a = await run();
  check(`${tag} 开着：跟以前一样（聊天记录带时间标记、隔了多久、现在几点、TPES、今天的日程都在）`, a.sent && a.tags && a.gap && a.now && a.tpes && a.sched && !a.rule && a.otherHasTime, JSON.stringify(a));
  await page.evaluate(() => gyTimeSenseSet(false));
  const b = await run();
  check(`${tag} 关上：聊天记录不带「3天前 / 中间过去了约」，也不告诉 TA 现在几点、隔了多久`, b.sent && !b.tags && !b.gap && !b.now && !b.year, JSON.stringify(b));
  check(`${tag} 关上：TPES 换成「不按现实时间走」的规矩；今天的日程不发，待办留着但去掉日期`, !b.tpes && b.rule && !b.sched && b.todo && !b.todoDate, JSON.stringify(b));
  check(`${tag} 关上：状态延续和 stateUpdate 还在（TA 不会断片）`, b.state && b.stateUpd, JSON.stringify(b));
  check(`${tag} 关上：别的功能自己拼的「现在是 2026/… 星期…」发出去前被抹掉，后面的话留着`, !b.otherHasTime && b.otherKeep, JSON.stringify(b));
  await page.evaluate(() => gyTimeSenseSet(true));
  const c = await run();
  check(`${tag} 再打开：恢复原样`, c.tags && c.now && !c.rule, JSON.stringify(c));
} else {
  const r = await page.evaluate(() => {
    // 白露：写了时间条件的字卡，关上以后不抽
    const h = new Date().getHours();
    const known = typeof bailuCondKnown === 'function' && bailuCondKnown('晚上');
    gyTimeSenseSet(false);
    const off = !!window.gyTimeSenseOn && !gyTimeSenseOn();
    gyTimeSenseSet(true);
    return { known, off };
  });
  check(`${tag} 关上后开关状态正确（时间条件字卡跳过，见下一条）`, r.off, JSON.stringify(r));
  const src = fs.readFileSync(path.join(root, 'js', '90-bailu-cards.js'), 'utf8');
  check(`${tag} 字卡条件判断里接上了「感知真实时间」`, /gyTimeSenseOn/.test(src), '');
}
check(`${tag} 整个过程没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 600));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
