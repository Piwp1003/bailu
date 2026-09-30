// 专测「输入框打不了字」：不看代码猜，直接量输入框在不在可点区域、点下去焦点有没有进去。
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok, extra });

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('dialog', d => d.accept());

await page.route(/^https?:\/\//, r => r.abort());
await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=JSON.parse(JSON.stringify(v));return Promise.resolve(v)},
    getItem(k){return Promise.resolve(this._d[k]!==undefined?this._d[k]:null)},
    removeItem(k){delete this._d[k];return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof window.switchChatSession === 'function', { timeout: 15000 });
await page.waitForTimeout(500);

// 造一个角色 + 一段够长的聊天记录
async function seed(msgCount) {
  await page.evaluate((n) => {
    myCharacters.length = 0;
    myCharacters.push({ id: 9001, name: '沈之遥', persona: '旧书店老板', worldbooks: [] });
    myApiUrl = 'https://api.test.local/v1'; myApiKey = 'sk-test'; myModel = 'gpt-test';
    globalChats['9001'] = [];
    for (let i = 0; i < n; i++) {
      globalChats['9001'].push({
        sender: i % 2 ? 'me' : 9001,
        text: '这是第 ' + i + ' 条消息，随便写点内容凑长度，让聊天区真的能把容器撑起来。',
        timestamp: Date.now() - (n - i) * 60000, readBy: []
      });
    }
    switchMainView('chat');
    switchChatSession('9001');
  }, msgCount);
  await page.waitForTimeout(400);
}

// 输入框「真的能用」的判定：在视口内 + 点它的位置命中的就是它自己 + 点完能拿到焦点 + 能打进字
async function probeInput() {
  return await page.evaluate(() => {
    const el = document.getElementById('chatInput');
    if (!el) return { ok: false, why: '找不到 #chatInput' };
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight, vw = window.innerWidth;
    const inView = r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw && r.width > 0 && r.height > 0;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const hitSelf = hit === el;
    return {
      ok: inView && hitSelf,
      why: (!inView ? `不在视口内 top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} 视口高=${vh}` : '')
         + (!hitSelf ? ` 被挡住了，点到的是 <${hit ? hit.tagName.toLowerCase() : 'null'} id=${hit ? hit.id : ''} class=${hit ? hit.className : ''}>` : ''),
      disabled: el.disabled, readOnly: el.readOnly,
      bottom: Math.round(r.bottom), vh
    };
  });
}

async function canType(word) {
  try {
    await page.click('#chatInput', { timeout: 2000 });
    await page.keyboard.type(word);
    const v = await page.inputValue('#chatInput');
    await page.fill('#chatInput', '');
    return v === word;
  } catch (e) { return false; }
}


// appConfirm / appPrompt 现在是**页面内**的弹窗（原生 prompt 在 Electron 里不支持，
// 原生 confirm 又会抢走键盘焦点），所以不能再靠 Playwright 的 dialog 自动确认了。
async function clickDialogOk() {
  await page.waitForSelector('.gy-dialog-ok', { timeout: 3000 });
  await page.click('.gy-dialog-ok');
  await page.waitForTimeout(200);
}

// ---- 1. 短聊天：基线 ----
await seed(3);
let p = await probeInput();
check('短聊天时输入框可点', p.ok, JSON.stringify(p));
check('短聊天时能打字', await canType('测试一'));

// ---- 2. 长聊天：消息把容器撑高之后 ----
await seed(60);
p = await probeInput();
check('长聊天时输入框仍在视口内且没被挡', p.ok, JSON.stringify(p));
check('长聊天时能打字', await canType('测试二'));

// ---- 3. 对面「发来一条消息」之后 ----
await page.evaluate(() => {
  globalChats['9001'].push({ sender: 9001, text: '刚做好饭，要过来吗？', timestamp: Date.now(), readBy: [] });
  renderChatMessages();
});
await page.waitForTimeout(300);
p = await probeInput();
check('角色发消息后输入框仍可用', p.ok, JSON.stringify(p));
check('角色发消息后能打字', await canType('测试三'));

// ---- 4. 删除一条消息之后 ----
const delDone = page.evaluate(() => {
  chatContextMenuMsgIdx = 5;
  chatContextMenuTarget = { name: 'x', text: 'y' };
  return contextActionDeleteChat();
});
await clickDialogOk();
await delDone;
await page.waitForTimeout(300);
p = await probeInput();
check('删除消息后输入框仍可用', p.ok, JSON.stringify(p));
check('删除消息后能打字', await canType('测试四'));

// ---- 5. 右键菜单开过又关掉之后 ----
await page.evaluate(() => {
  const menu = document.getElementById('chatContextMenu');
  menu.style.display = 'flex';
  menu.style.left = '100px'; menu.style.top = '100px';
  menu.innerHTML = '<button class="context-btn">x</button>';
});
await page.waitForTimeout(150);
await page.evaluate(() => { document.getElementById('chatContextMenu').style.display = 'none'; });
p = await probeInput();
check('右键菜单关掉后输入框仍可用', p.ok, JSON.stringify(p));

// ---- 6. 导入备份之后（设置弹窗还开着吗？） ----
await page.evaluate(() => { openModal('userProfileModal'); });
await page.waitForTimeout(200);
await page.evaluate(async () => {
  // 复刻 importData 成功那一支：写库 → loadAllData → 切回首页
  const snap = getFullDataSnapshot();
  await localforage.setItem('myTwitterAppData', snap);
  await loadAllData();
  gyCloseAllOverlays();
  updateUserMiniProfile(); updateGlobalBgStyles(); switchMainView('home'); updateCharSelects();
});
await page.waitForTimeout(400);
const blockers = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.modal-overlay').forEach(m => {
    if (getComputedStyle(m).display !== 'none') out.push(m.id || '(无id)');
  });
  return out;
});
check('导入备份后没有弹窗残留挡住界面', blockers.length === 0, '还开着：' + blockers.join(', '));

// 关掉再回聊天，确认还能打字
await page.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); switchMainView('chat'); switchChatSession('9001'); });
await page.waitForTimeout(300);
check('导入备份后回到聊天能打字', await canType('测试五'));

// ---- 7. 手机尺寸下同样要能用 ----
await page.setViewportSize({ width: 420, height: 820 });
await page.waitForTimeout(400);
await seed(60);
p = await probeInput();
check('手机尺寸下输入框可点', p.ok, JSON.stringify(p));
check('手机尺寸下能打字', await canType('测试六'));
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(300);

// ---- 8. Esc 应该能把弹窗关掉（万一哪个弹窗没关干净的逃生口） ----
await page.evaluate(() => openModal('userProfileModal'));
await page.waitForTimeout(200);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('按 Esc 能关掉弹窗', await page.evaluate(() =>
  getComputedStyle(document.getElementById('userProfileModal')).display === 'none'));
await page.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); });

// ---- 9. 原生弹窗关掉之后，焦点要回到原来那个输入框 ----
// 用户实测出来的真凶：exe 里导入备份成功后会 alert 一下，
// 原生弹窗关掉时 Windows 不保证把键盘焦点还给网页，于是整个界面就废了。
await page.evaluate(() => { switchMainView('chat'); switchChatSession('9001'); });
await page.waitForTimeout(300);
await page.click('#chatInput');
const focusBack = await page.evaluate(() => {
  const before = document.activeElement && document.activeElement.id;
  alert('数据恢复成功！欢迎回来。');
  return before;
});
await page.waitForTimeout(200);
check('弹过 alert 之后焦点回到了原来的输入框',
  focusBack === 'chatInput' && await page.evaluate(() => document.activeElement && document.activeElement.id === 'chatInput'),
  '弹窗前焦点在 ' + focusBack);
check('弹过 alert 之后还能继续打字', await canType('测试七'));

// confirm / prompt 同理
await page.click('#chatInput');
await page.evaluate(() => { confirm('确定吗？'); });
await page.waitForTimeout(200);
check('弹过 confirm 之后还能打字', await canType('测试八'));

// ---- 10. 页面内的输入框弹窗（Electron 不支持原生 prompt，全靠它） ----
const promptResult = page.evaluate(() => appPrompt('给新预设起个名字：', '新预设'));
await page.waitForSelector('.gy-dialog-input', { timeout: 3000 });
check('appPrompt 弹出的是页面内的输入框，不是原生 prompt', true);
await page.fill('.gy-dialog-input', '我的预设');
await page.click('.gy-dialog-ok');
check('确定后能拿到输入的内容', (await promptResult) === '我的预设');

const cancelResult = page.evaluate(() => appPrompt('随便问问：', 'x'));
await page.waitForSelector('.gy-dialog-cancel', { timeout: 3000 });
await page.click('.gy-dialog-cancel');
check('取消后返回 null（调用方靠这个判断"用户放弃了"）', (await cancelResult) === null);

const escResult = page.evaluate(() => appPrompt('按 Esc 试试：', 'x'));
await page.waitForSelector('.gy-dialog-input', { timeout: 3000 });
await page.keyboard.press('Escape');
check('按 Esc 也能取消，而且 promise 不会悬着', (await escResult) === null);

await page.waitForTimeout(200);
check('弹窗用完必须从 DOM 里移除（留着会挡住整个界面）',
  await page.evaluate(() => document.querySelectorAll('.gy-dialog-overlay').length === 0));
check('弹窗关掉之后还能打字', await canType('测试九'));

// ---- 11. 光标：caret-color 不能是透明/跟背景同色 ----
const caret = await page.evaluate(() => {
  const el = document.getElementById('chatInput');
  const cs = getComputedStyle(el);
  return { caretColor: cs.caretColor, color: cs.color, background: cs.backgroundColor };
});
check('输入框光标颜色不是透明', caret.caretColor !== 'transparent' && caret.caretColor !== 'rgba(0, 0, 0, 0)', JSON.stringify(caret));

await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
