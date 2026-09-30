// 冒烟测试：在真的 Electron 里把白露跑起来，验证桌面版关键链路。
// 只用于开发验证，不随桌面版分发。
// 用法（Linux 容器）：xvfb-run -a node_modules/.bin/electron --no-sandbox _smoke.js
//        Windows 上：node_modules\.bin\electron _smoke.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// 模拟免安装 exe 的运行环境：exe 旁边应当出现「白露数据」文件夹
const fakePortableDir = path.join(__dirname, '_smoke-out');
fs.rmSync(fakePortableDir, { recursive: true, force: true });
fs.mkdirSync(fakePortableDir, { recursive: true });
process.env.PORTABLE_EXECUTABLE_DIR = fakePortableDir;

const LOG = path.join(__dirname, '_smoke.log');
try { fs.unlinkSync(LOG); } catch (e) {}
const log = m => fs.appendFileSync(LOG, m + '\n');

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  log((ok ? '  OK  ' : '  FAIL') + ' ' + name + (extra && !ok ? '  -> ' + extra : ''));
};

// 跟 main.js 同一套存档目录逻辑
const dataDir = path.join(fakePortableDir, 'BailuData');
fs.mkdirSync(dataDir, { recursive: true });
app.setPath('userData', dataDir);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280, height: 900, show: false,
    webPreferences: { webSecurity: false, nodeIntegration: false, contextIsolation: true, spellcheck: false },
  });

  const errors = [];
  win.webContents.on('console-message', (...args) => {
    const e0 = args[0] || {};
    const level = e0.level !== undefined ? e0.level : args[1];
    const message = String(e0.message !== undefined ? e0.message : args[2]);
    const isError = level === 'error' || level >= 2;
    if (isError && !/ERR_FILE_NOT_FOUND|favicon|manifest|service-worker/i.test(message)) errors.push(message);
  });
  win.webContents.on('did-fail-load', (e, code, desc, url) => errors.push(`加载失败 ${code} ${desc} ${url}`));

  // 每次求值都带超时。headless 下任何一个没预料到的阻塞（比如 alert）都会把整个测试吊死，
  // 与其等外层 timeout 杀进程、一条输出都拿不到，不如让这一项记成 FAIL 继续往下跑。
  const ev = (js, ms = 6000) => Promise.race([
    win.webContents.executeJavaScript(js, true).catch(e => '__REJECT__' + (e && e.message)),
    new Promise(r => setTimeout(() => r('__TIMEOUT__'), ms)),
  ]);

  await win.loadFile(path.join(__dirname, 'app', 'index.html'));
  await new Promise(r => setTimeout(r, 3000));

  // alert 在无人值守环境里会永久阻塞渲染进程，先换成收集数组
  await ev('window.__alerts=[]; window.alert = m => window.__alerts.push(String(m)); "ok"');

  check('userData 指向 exe 旁边的 BailuData', app.getPath('userData') === dataDir, app.getPath('userData'));
  check('localforage 从本地加载成功（不依赖 CDN）',
    await ev('typeof localforage === "object" && typeof localforage.setItem === "function"') === true);
  check('mammoth 从本地加载成功（不依赖 CDN）', await ev('typeof mammoth === "object"') === true);
  check('ejs 模板引擎可用', await ev('typeof ejs === "object" && typeof ejs.render === "function"') === true);
  check('页面没有残留的 cdnjs 引用',
    await ev('!Array.from(document.scripts).some(s => (s.src||"").includes("cdnjs"))') === true);
  check('白露主逻辑已就绪',
    await ev('typeof saveAllData === "function" && typeof switchMainView === "function"') === true);
  check('续写工作台已挂载',
    await ev('typeof renderStoryStudio === "function" && Array.isArray(storySessions)') === true);
  check('导航栏有续写入口', await ev('!!document.getElementById("nav-storystudio")') === true);
  check('启动流程跑完（window.onload）', await ev('Array.isArray(myCharacters)') === true);

  // —— 存档：真写一次，确认没弹错误框、且文件确实落在 exe 旁边 ——
  const snapKeys = await ev('Object.keys(getFullDataSnapshot()).length');
  check('存档快照能取到', typeof snapKeys === 'number' && snapKeys > 50, String(snapKeys));
  const called = await ev('(()=>{ storySessions=[{id:"smoke",title:"冒烟测试",turns:[],chapters:[]}]; try{ saveAllData(); return "ok"; }catch(e){ return "throw "+e.message; } })()');
  check('saveAllData 不报错', called === 'ok', String(called));
  await new Promise(r => setTimeout(r, 2000));
  const alerts = await ev('window.__alerts.join(" | ")');
  check('保存过程没弹错误框', alerts === '', String(alerts));

  const idbDir = path.join(dataDir, 'IndexedDB');
  check('IndexedDB 落在 exe 旁边的 BailuData 里', fs.existsSync(idbDir), '期望 ' + idbDir);

  // 重新加载页面，走一遍真实的"关掉再打开"路径
  await win.webContents.reload();
  await new Promise(r => setTimeout(r, 3500));
  await ev('window.__alerts=[]; window.alert = m => window.__alerts.push(String(m)); "ok"');
  check('重新打开后存档还在',
    await ev('Array.isArray(storySessions) && storySessions.length === 1 && storySessions[0].title === "冒烟测试"') === true,
    String(await ev('JSON.stringify((storySessions||[]).map(s=>s.title))')));

  // —— 视图切换 ——
  await ev('switchMainView("storyStudio"); "ok"');
  await new Promise(r => setTimeout(r, 600));
  check('能切到续写视图',
    await ev('document.getElementById("view-story-studio").style.display === "block"') === true);

  try {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, '_smoke-shot.png'), img.toPNG());
    check('截图成功', true);
  } catch (e) { check('截图成功', false, e.message); }

  check('页面无报错', errors.length === 0, errors.slice(0, 5).join(' | '));

  const bad = results.filter(r => !r.ok);
  log('\n' + (results.length - bad.length) + '/' + results.length + ' passed');
  app.exit(bad.length ? 1 : 0);
}).catch(e => { log('smoke 崩了：' + (e && e.stack || e)); app.exit(1); });
