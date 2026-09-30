// 增量保存（大图只存一次）+ 一键配置 / 我的配置 的回归测试。
// 用真的 IndexedDB（无头浏览器每次都是全新空白的，不会碰你电脑上的存档）。
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('dialog', d => d.accept());
await page.route(/^https?:\/\//, r => r.abort());

const results = [];
const check = (n, ok, extra = '') => { results.push({ n, ok: !!ok, extra }); if (process.env.GYDBG) console.log((ok?'ok ':'XX ')+n); };

async function boot() {
  await page.waitForFunction(() => window.__guyuBooted && typeof saveAllData === 'function', { timeout: 20000 });
  await page.waitForTimeout(800);
}
await page.goto(fileUrl(path.join(root, 'index.html')));
await boot();

// 项目自己的弹窗：可选先填输入框，再点确认
async function answerDialog(text) {
  for (let i = 0; i < 20; i++) {
    const hit = await page.evaluate((text) => {
      const o = [...document.querySelectorAll('.gy-dialog-overlay')].find(m => getComputedStyle(m).display !== 'none');
      if (!o) return false;
      const inp = o.querySelector('input, textarea');
      if (inp && text != null) inp.value = text;
      const bs = [...o.querySelectorAll('button')];
      (bs.find(b => /确定|换|覆盖|删|好/.test(b.textContent)) || bs[bs.length - 1]).click();
      return true;
    }, text);
    if (hit) { await page.waitForTimeout(250); return true; }
    await page.waitForTimeout(100);
  }
  return false;
}

// ================= 一、增量保存 =================
const IMG_A = await page.evaluate(() => 'data:image/png;base64,' + 'QUFB'.repeat(15000) + 'a');
const IMG_B = await page.evaluate(() => 'data:image/png;base64,' + 'QkJC'.repeat(15000) + 'b');
const IMG_E = await page.evaluate(() => 'data:image/gif;base64,' + 'RUVF'.repeat(4000) + 'e');

await page.evaluate(async ({ IMG_A, IMG_E }) => {
  myCharacters.length = 0;
  const c = { id: 7001, name: '沈之遥', handle: '@shen', persona: '旧书店老板', worldbooks: [], avatarImg: IMG_A };
  myCharacters.push(c);
  globalPosts.length = 0;
  globalPosts.push({ id: 'p1', char: c, text: '共用同一个对象', timestamp: Date.now(), replies: [], stats: {} });
  globalEmoticons.length = 0;
  globalEmoticons.push({ name: '小猫', url: IMG_E }, { name: '小猫2', url: IMG_E });
  await saveAllData({ immediate: true });
}, { IMG_A, IMG_E });

const raw1 = await page.evaluate(async () => {
  const r = await localforage.getItem('myTwitterAppData');
  const keys = await localforage.createInstance({ name: 'gyImgStore', storeName: 'imgs' }).keys();
  return { refs: r.__gyImgRefs, av: String(r.myCharacters[0].avatarImg).slice(0, 12), size: JSON.stringify(r).length, keys, same: r.globalPosts[0].char === r.myCharacters[0] };
});
check('存档打上了新格式标记', raw1.refs === 1, JSON.stringify(raw1).slice(0, 200));
check('主存档里的大图换成了小引用', raw1.av.startsWith('⁣gyimg:'), raw1.av);
check('主存档变得很小（图不在里面了）', raw1.size < 20000, '主存档大小 ' + raw1.size);
check('两张不同的图各存一份；同一张表情包用两次也只存一份', raw1.keys.length === 2, JSON.stringify(raw1.keys));
check('共用的对象存下去还是共用（帖子里的角色 = 角色列表里的那个）', raw1.same);

// 再存一次什么都没变：图库不多东西
const keys2 = await page.evaluate(async () => {
  myCharacters[0].persona = '旧书店老板，爱猫';
  await saveAllData({ immediate: true });
  return (await localforage.createInstance({ name: 'gyImgStore', storeName: 'imgs' }).keys()).length;
});
check('图没变时再存，图库不会多出东西', keys2 === 2, '图库里有 ' + keys2);

// 重新打开：图全回来，内容一模一样
await page.reload(); await boot();
const back = await page.evaluate(({ IMG_A, IMG_E }) => ({
  av: myCharacters[0] && myCharacters[0].avatarImg === IMG_A,
  persona: myCharacters[0] && myCharacters[0].persona,
  emo: globalEmoticons.length === 2 && globalEmoticons.every(e => e.url === IMG_E),
  same: globalPosts[0] && globalPosts[0].char === myCharacters[0],
  noflag: !('__gyImgRefs' in window)
}), { IMG_A, IMG_E });
check('重开后头像原样回来', back.av);
check('重开后文字改动也在', back.persona === '旧书店老板，爱猫', back.persona);
check('重开后表情包原样回来', back.emo);
// （读档后帖子里的 char 和角色列表不再是同一个对象——老格式也是这样，不是这次改出来的，不测）

// 换头像 → 新图存进去；旧图在清理后被删
const gc = await page.evaluate(async (IMG_B) => {
  myCharacters[0].avatarImg = IMG_B;
  globalPosts.forEach(p => { if (p.char) p.char.avatarImg = IMG_B; });   // 帖子里存的那份角色信息也换掉，旧图才真没人用
  await saveAllData({ immediate: true });
  const st = localforage.createInstance({ name: 'gyImgStore', storeName: 'imgs' });
  const before = (await st.keys()).length;
  gyImgScheduleGc(0);
  await new Promise(r => setTimeout(r, 800));
  const after = (await st.keys()).length;
  return { before, after };
}, IMG_B);
check('换了头像：新图存进去了', gc.before === 3, JSON.stringify(gc));
check('没人用的旧头像被清理掉，还在用的表情包留着', gc.after === 2, JSON.stringify(gc));

// 老存档（整份、没有引用）照样能读
const oldOk = await page.evaluate(async (IMG_A) => {
  const snap = JSON.parse(JSON.stringify(getFullDataSnapshot()));
  delete snap.__gyImgRefs;
  snap.myCharacters[0].avatarImg = IMG_A; snap.myCharacters[0].name = '老存档里的名字';
  await localforage.setItem('myTwitterAppData', snap);
  await loadAllData();
  return myCharacters[0].avatarImg === IMG_A && myCharacters[0].name === '老存档里的名字';
}, IMG_A);
check('老格式的存档（或导入的备份）照样能读', oldOk);

// 页面正要关的时候有新图：这一次整份存，保证不丢
const leave = await page.evaluate(async () => {
  const img = 'data:image/png;base64,' + 'WldX'.repeat(9000) + 'z';
  myCharacters[0].avatarImg = img;
  __gyUnloading = true;
  try { await saveAllData({ immediate: true }); } finally { __gyUnloading = false; }
  const r = await localforage.getItem('myTwitterAppData');
  return { refs: !!r.__gyImgRefs, full: r.myCharacters[0].avatarImg === img };
});
check('关页面那一刻有没存过的新图：整份存，图直接在主存档里', !leave.refs && leave.full, JSON.stringify(leave));

// 图库里找不到的图：置空，不显示成乱码
const miss = await page.evaluate(async () => {
  await saveAllData({ immediate: true });
  await localforage.createInstance({ name: 'gyImgStore', storeName: 'imgs' }).clear();
  const o = { a: '⁣gyimg:nope_1', b: 'hi' };
  await gyResolveImgRefs(o);
  return o;
});
check('图库里丢了的图换成空字符串，不会露出引用', miss.a === '' && miss.b === 'hi', JSON.stringify(miss));

// ================= 二、一键配置 / 我的配置 =================
await page.evaluate(() => { switchMainView('settings'); openSettingsPanel('auto'); });
await page.waitForTimeout(500);
const ui = await page.evaluate(() => ({
  btns: document.querySelectorAll('#gyswPresets .gysw-pre-btn').length,
  save: !!document.querySelector('#gyswPresets .gysw-op'),
}));
check('全部开关页顶上有三套现成配置', ui.btns === 3, JSON.stringify(ui));
check('有「把现在的开关存成一套」按钮', ui.save);

const kinds = await page.evaluate(() => {
  const k = key => __gyswPresetKind(AUTO_FEATURE_DEFS.find(d => d.key === key));
  return { postReactions: k('postReactions'), walletOn: k('walletOn'), phoneAiPeople: k('phoneAiPeople'), relLedger: k('relLedger'), autoPost: k('autoPost') };
});
check('分类对：后台自动花钱的 / 不花钱的 / 手动点才花的',
  kinds.postReactions === 'auto' && kinds.autoPost === 'auto' && kinds.walletOn === 'free' && kinds.relLedger === 'free' && kinds.phoneAiPeople === 'manual',
  JSON.stringify(kinds));

// 先把几个"不该被碰"的开关设成特定值
await page.evaluate(() => { setAutoFeature('walletOn', true, true); setAutoFeature('phoneAiPeople', true, true); setAutoFeature('autoPost', true, true); });
await page.evaluate(() => { gyswApplyBuiltin('save'); });
const dlgText = await page.evaluate(() => { const o = [...document.querySelectorAll('.gy-dialog-overlay')].find(m => getComputedStyle(m).display !== 'none'); return o ? o.innerText : ''; });
check('换之前先说清楚会打开/关掉哪些', /关掉 \d+ 项/.test(dlgText) && dlgText.includes('角色自动发帖'), dlgText.slice(0, 200));
await answerDialog();
await page.waitForTimeout(300);
const s1 = await page.evaluate(() => ({
  autoPost: isAutoOn('autoPost'), letterReply: isAutoOn('letterReply'), chatSummary: isAutoOn('chatSummary'),
  postReactions: isAutoOn('postReactions'), walletOn: isAutoOn('walletOn'), phoneAiPeople: isAutoOn('phoneAiPeople'),
  cur: (document.querySelector('#gyswPresets .gysw-pre-btn.cur b') || {}).textContent || ''
}));
check('🌱 省钱：后台发帖、发帖后互动都关了', !s1.autoPost && !s1.postReactions, JSON.stringify(s1));
check('🌱 省钱：回信、聊天总结留着', s1.letterReply && s1.chatSummary, JSON.stringify(s1));
check('🌱 省钱：不花钱的（钱包）、手动点的（通讯录）都没被碰', s1.walletOn && s1.phoneAiPeople, JSON.stringify(s1));
check('当前是哪一套会标出来', s1.cur === '省钱', s1.cur);

await page.evaluate(() => gyswUndo());
await page.waitForTimeout(200);
check('撤销：回到换之前', await page.evaluate(() => isAutoOn('autoPost') && isAutoOn('postReactions')));

// 全都要 → 默认关的后台功能（小剧场）也开了
await page.evaluate(() => { gyswApplyBuiltin('all'); }); await answerDialog();
check('🔥 全都要：连默认关的后台小剧场也打开', await page.evaluate(() => isAutoOn('charTheater') && isAutoOn('webExplore')));

// 我的配置：存 → 乱改 → 一点换回来
await page.evaluate(() => { setAutoFeature('charTheater', false, true); setAutoFeature('proactiveChat', false, true); });
const modKey = await page.evaluate(() => typeof window.gyrelGet === 'function' ? window.gyrelGet('showNumber') : null);
if (modKey !== null) await page.evaluate(() => window.gyrelSet('showNumber', true));
await page.evaluate(() => { gyswSaveMine(); }); await answerDialog('上班省钱');
await page.waitForTimeout(300);
const saved = await page.evaluate(() => (window.gySwitchPresets || []).map(p => ({ name: p.name, n: Object.keys(p.auto).length, mod: Object.keys(p.mod || {}).length })));
check('存成一套：名字是我起的', saved.length === 1 && saved[0].name === '上班省钱', JSON.stringify(saved));
check('存的是全部自动功能开关', saved[0] && saved[0].n > 40, JSON.stringify(saved));
check('小功能的开关也一起存了', saved[0] && saved[0].mod > 0, JSON.stringify(saved));

await page.evaluate(() => { setAutoFeature('charTheater', true, true); setAutoFeature('proactiveChat', true, true); setAutoFeature('walletOn', false, true); });
if (modKey !== null) await page.evaluate(() => window.gyrelSet('showNumber', false));
const pid = await page.evaluate(() => window.gySwitchPresets[0].id);
await page.evaluate((id) => { gyswApplyMine(id); }, pid); await answerDialog();
await page.waitForTimeout(300);
const s2 = await page.evaluate(() => ({ th: isAutoOn('charTheater'), pc: isAutoOn('proactiveChat'), w: isAutoOn('walletOn'),
  rel: typeof window.gyrelGet === 'function' ? window.gyrelGet('showNumber') : null }));
check('点一下「上班省钱」：自动功能全换回存的样子', !s2.th && !s2.pc && s2.w, JSON.stringify(s2));
if (modKey !== null) check('小功能开关也换回来了', s2.rel === true, JSON.stringify(s2));

// 跟着存档走：重开还在
await page.evaluate(() => saveAllData({ immediate: true }));
await page.waitForTimeout(300);
await page.reload(); await boot();
const kept = await page.evaluate(() => (window.gySwitchPresets || []).map(p => p.name));
check('我的配置存进了存档，重开还在', kept.includes('上班省钱'), JSON.stringify(kept));
check('导出的备份里也有我的配置', await page.evaluate(() => (getFullDataSnapshot().gySwitchPresets || []).length === 1));

// 删
await page.evaluate(() => { switchMainView('settings'); openSettingsPanel('auto'); });
await page.waitForTimeout(400);
await page.evaluate(() => { gyswDelMine(window.gySwitchPresets[0].id); }); await answerDialog();
check('能删', await page.evaluate(() => (window.gySwitchPresets || []).length === 0));

check('整个过程没有页面报错', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));

await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
