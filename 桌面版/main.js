// =====================================================================================
// 白露 桌面版 —— Electron 主进程
//
// 跟以前那个「启动白露(桌面模式).bat」相比，这里解决了三件事：
//   1. 不再依赖用户电脑上装没装 Chrome/Edge —— 浏览器内核跟着 exe 一起走
//   2. 存档不再放在 %TEMP%（清理临时文件就没了），改成放在 exe 旁边的「白露数据」文件夹
//   3. localforage / mammoth 这两个库改成本地打包，断网也能启动
// =====================================================================================

const { app, BrowserWindow, Menu, shell, dialog, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ------------------------------------------------------------------
// 启动日志 —— exe 闪一下就没了的时候，唯一能查的东西
//
// 这类问题在用户机器上没有控制台可看，什么线索都留不下。所以从进程一起来就往
// 文件里记里程碑，任何一步炸了都能从日志看出卡在哪，而不是干瞪眼猜。
// ------------------------------------------------------------------
// 打包后：日志写在 exe 旁边，用户一眼能找到。
// 试跑（先试跑一下.bat / npm start）：app.getPath('exe') 指向 node_modules 里的 electron.exe，
// 日志写到那儿根本没人找得到——所以改成写在 桌面版\ 目录下，跟 main.js 放一起。
const bootDir = app.isPackaged
  ? (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe')))
  : __dirname;
let logPath = path.join(bootDir, '启动日志.txt');

function logBoot(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\r\n`;
  try {
    fs.appendFileSync(logPath, line);
  } catch (e) {
    // exe 旁边写不了（只读目录/权限）就退到系统临时目录，别让记日志本身把程序搞崩
    try {
      logPath = path.join(os.tmpdir(), 'bailu-启动日志.txt');
      fs.appendFileSync(logPath, line);
    } catch (e2) { /* 实在写不了就算了 */ }
  }
}

// 每次启动重置日志，只保留最近一次，免得越滚越大也免得看到旧记录误判
try { fs.writeFileSync(path.join(bootDir, '启动日志.txt'), ''); } catch (e) { /* 忽略 */ }

logBoot('=== 白露启动 ===');
logBoot(`Electron ${process.versions.electron} / Chromium ${process.versions.chrome} / Node ${process.versions.node}`);
logBoot(`exe 目录: ${bootDir}`);
logBoot(`便携模式: ${process.env.PORTABLE_EXECUTABLE_DIR ? '是' : '否'}`);

// 主进程任何没接住的异常，都写日志 + 弹框，而不是让进程无声无息地消失
function fatal(where, err) {
  const detail = (err && err.stack) || String(err);
  logBoot(`!!! 崩溃于 ${where}\r\n${detail}`);
  try {
    dialog.showErrorBox('白露启动失败',
      `出错位置：${where}\n\n${detail}\n\n详细日志：\n${logPath}`);
  } catch (e) { /* 界面还没起来就弹不了框，日志已经写了 */ }
}
process.on('uncaughtException', err => { fatal('uncaughtException', err); app.exit(1); });
process.on('unhandledRejection', err => { logBoot(`未处理的 Promise 拒绝: ${(err && err.stack) || err}`); });

// ------------------------------------------------------------------
// 存档位置：优先放在 exe 旁边，真正做到"拷走整个文件夹＝拷走存档"
// ------------------------------------------------------------------
function resolveDataDir() {
  // 免安装 exe 运行时，electron-builder 会把 exe 所在目录塞进这个环境变量
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  const base = portableDir || path.dirname(app.getPath('exe'));
  // ⚠️ 目录名必须是纯 ASCII。实测中文目录名会让 Chromium 的 IndexedDB 首次打开报
  // "Internal error opening backing store"，表现就是第一次保存弹"硬盘空间可能已满"。
  // 目录里放个说明文件告诉用户这是干嘛的，比给目录起中文名靠谱。
  const target = path.join(base, 'BailuData');
  try {
    fs.mkdirSync(target, { recursive: true });
    // 真写一次再删掉，确认这个位置可写。装在 Program Files 之类只读目录时会失败，
    // 那就老实退回系统默认的 AppData，别让用户开着开着发现存档一直没保存。
    const probe = path.join(target, '.writetest');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    // 放个说明，免得用户看到一个英文文件夹不知道能不能删
    try {
      fs.writeFileSync(path.join(target, '这是白露的存档文件夹_请勿删除.txt'),
        '这个文件夹里是白露的全部数据：角色、聊天记录、推文、续写、世界书、预设等。\r\n' +
        '删掉它 = 存档全没了。\r\n\r\n' +
        '换电脑 / 备份：把整个「白露」文件夹（含 exe 和本文件夹）一起拷走即可。\r\n' +
        '也可以在应用里「设置 → 导出数据」导出一个 json 单独存着。\r\n\r\n' +
        '（文件夹名用英文是有原因的：中文路径会让浏览器内核的数据库偶发打不开。）\r\n', 'utf-8');
    } catch (e) { /* 写不了说明文件不影响主流程 */ }
    return target;
  } catch (e) {
    console.warn('[白露] exe 旁边不可写，存档改用系统默认位置：', e.message);
    return null;
  }
}

let dataDir = null;
try {
  dataDir = resolveDataDir();
  if (dataDir) {
    app.setPath('userData', dataDir);
    logBoot(`存档目录: ${dataDir}`);
  } else {
    logBoot(`存档目录: 退回系统默认 ${app.getPath('userData')}（exe 旁边不可写）`);
  }
} catch (e) {
  // 存档目录设不了不该是致命的——退回系统默认位置继续跑，总比闪退强
  logBoot(`设置存档目录失败，改用系统默认: ${(e && e.message) || e}`);
}

// ------------------------------------------------------------------
// 窗口尺寸/位置记忆
// ------------------------------------------------------------------
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf-8'));
    if (typeof s.width === 'number' && typeof s.height === 'number') return s;
  } catch (e) { /* 第一次运行没有这个文件，正常 */ }
  return { width: 1280, height: 900 };
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const bounds = win.isMaximized() ? (win.__restoreBounds || win.getBounds()) : win.getBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({
      width: bounds.width, height: bounds.height,
      x: bounds.x, y: bounds.y,
      maximized: win.isMaximized(),
    }));
  } catch (e) { console.warn('[白露] 保存窗口状态失败：', e.message); }
}

// ------------------------------------------------------------------
// 主窗口
// ------------------------------------------------------------------
let mainWindow = null;

// ------------------------------------------------------------------
// 🧸 桌面上的 TA（配合插件「桌面上的 TA」）
// 页面里通过 window.gyDesk 控制一个透明、置顶、无边框的小窗口，小 TA 就待在电脑桌面上。
// 小 TA 开着的时候，点主窗口的 × 只是把窗口藏起来（程序还在跑，TA 还能冒泡），
// 要真的退出：右键小 TA →「退出」。
// preload 不单独放文件（打包清单不用改）：启动时写到用户数据目录里。
// ------------------------------------------------------------------
let petWin = null, petOpts = null, quitting = false;
const MAIN_PRELOAD = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('gyDesk', {
  isDesk: true,
  petShow: o => ipcRenderer.send('gy-pet', 'show', o),
  petHide: () => ipcRenderer.send('gy-pet', 'hide'),
  petSay: t => ipcRenderer.send('gy-pet', 'say', String(t || '')),
  onPet: cb => ipcRenderer.on('gy-pet-ev', (e, ev) => { try { cb(ev); } catch (er) {} })
});`;
const PET_PRELOAD = `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pet', {
  moveBy: (dx, dy) => ipcRenderer.send('gy-pet-in', 'move', { dx, dy }),
  done: () => ipcRenderer.send('gy-pet-in', 'moved'),
  click: () => ipcRenderer.send('gy-pet-in', 'click'),
  menu: () => ipcRenderer.send('gy-pet-in', 'menu'),
  hover: on => ipcRenderer.send('gy-pet-in', 'hover', !!on),
  on: cb => ipcRenderer.on('gy-pet-do', (e, a, v) => cb(a, v))
});`;
function writePreloads() {
  const dir = app.getPath('userData');
  const a = path.join(dir, 'gy-preload.js'), b = path.join(dir, 'gy-pet-preload.js');
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(a, MAIN_PRELOAD); fs.writeFileSync(b, PET_PRELOAD); } catch (e) { logBoot('写 preload 失败: ' + e.message); }
  return { main: a, pet: b };
}
let PRELOADS = null;
const PET_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:transparent;overflow:hidden;user-select:none;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
#w{position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;align-items:flex-end}
#b{max-width:230px;padding:8px 12px;margin-bottom:8px;border-radius:16px 16px 4px 16px;background:rgba(255,255,255,.95);color:#1d1d1f;font-size:13px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,.18);opacity:0;transform:translateY(6px) scale(.9);transform-origin:bottom right;transition:all .35s cubic-bezier(.2,1.2,.3,1)}
#b.on{opacity:1;transform:none}
#a{width:var(--s,64px);height:var(--s,64px);border-radius:50%;overflow:hidden;background:#fff center/cover no-repeat;box-shadow:0 8px 20px rgba(0,0,0,.25),0 0 0 3px #fff;cursor:grab;display:flex;align-items:center;justify-content:center;font-size:26px;color:#555;animation:bob 3.2s ease-in-out infinite}
#a.free{border-radius:0;box-shadow:none;background-color:transparent;background-size:contain;filter:drop-shadow(0 6px 10px rgba(0,0,0,.25))}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
</style></head><body><div id="w"><div id="b"></div><div id="a"></div></div><script>
const a=document.getElementById('a'),b=document.getElementById('b');let d=null,mv=false,ht=null;
a.addEventListener('mouseenter',()=>pet.hover(true));document.getElementById('w').addEventListener('mouseleave',()=>{if(!d)pet.hover(false)});
a.addEventListener('pointerdown',e=>{if(e.button===2)return;d={x:e.screenX,y:e.screenY};mv=false;a.setPointerCapture(e.pointerId)});
a.addEventListener('pointermove',e=>{if(!d)return;const dx=e.screenX-d.x,dy=e.screenY-d.y;if(!mv&&Math.abs(dx)+Math.abs(dy)<4)return;mv=true;d={x:e.screenX,y:e.screenY};pet.moveBy(dx,dy)});
a.addEventListener('pointerup',()=>{if(!d)return;d=null;if(mv)pet.done();else pet.click()});
a.addEventListener('contextmenu',e=>{e.preventDefault();pet.menu()});
pet.on((k,v)=>{if(k==='set'){document.body.style.setProperty('--s',(v.size||64)+'px');a.className=v.shape==='free'?'free':'';if(v.img){a.style.backgroundImage='url("'+v.img.replace(/"/g,'%22')+'")';a.textContent=''}else{a.style.backgroundImage='';a.textContent=v.letter||'T'}}
if(k==='say'){b.textContent=v;b.classList.add('on');clearTimeout(ht);ht=setTimeout(()=>b.classList.remove('on'),Math.max(4000,v.length*280))}});
</script></body></html>`;
function petSize(o) { const s = Math.max(36, Math.min(320, +(o && o.size) || 64)); return { w: Math.max(260, s + 40), h: s + 120 }; }
function petShow(o) {
  petOpts = o || {};
  const sz = petSize(petOpts);
  if (!petWin || petWin.isDestroyed()) {
    const wa = screen.getPrimaryDisplay().workArea;
    const x = Number.isFinite(petOpts.x) ? petOpts.x : wa.x + wa.width - sz.w - 20, y = Number.isFinite(petOpts.y) ? petOpts.y : wa.y + wa.height - sz.h - 20;
    petWin = new BrowserWindow({ title: 'TA', width: sz.w, height: sz.h, x, y, transparent: true, frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true, hasShadow: false, focusable: true, show: false, backgroundColor: '#00000000',
      webPreferences: { preload: PRELOADS.pet, contextIsolation: true, nodeIntegration: false } });
    petWin.setAlwaysOnTop(true, 'floating');
    petWin.setIgnoreMouseEvents(true, { forward: true });
    petWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(PET_HTML));
    petWin.webContents.on('did-finish-load', () => { petWin.webContents.send('gy-pet-do', 'set', petOpts); petWin.showInactive(); });
    petWin.on('closed', () => { petWin = null; });
  } else { petWin.setSize(sz.w, sz.h); petWin.webContents.send('gy-pet-do', 'set', petOpts); petWin.showInactive(); }
}
function toMain(ev) { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('gy-pet-ev', ev); }
function showMain() { if (!mainWindow || mainWindow.isDestroyed()) return; if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }
ipcMain.on('gy-pet', (e, what, v) => {
  if (what === 'show') petShow(v);
  if (what === 'hide') { if (petWin && !petWin.isDestroyed()) petWin.close(); petWin = null; }
  if (what === 'say' && petWin && !petWin.isDestroyed()) petWin.webContents.send('gy-pet-do', 'say', v);
});
ipcMain.on('gy-pet-in', (e, what, v) => {
  if (!petWin || petWin.isDestroyed()) return;
  if (what === 'hover') petWin.setIgnoreMouseEvents(!v, { forward: true });
  if (what === 'move') { const [x, y] = petWin.getPosition(); petWin.setPosition(Math.round(x + v.dx), Math.round(y + v.dy)); }
  if (what === 'moved') { const [x, y] = petWin.getPosition(); toMain({ type: 'moved', x, y }); }
  if (what === 'click') { showMain(); toMain({ type: 'click' }); }
  if (what === 'menu') {
    Menu.buildFromTemplate([
      { label: '打开白露', click: () => { showMain(); toMain({ type: 'click' }); } },
      { label: '小 TA 设置', click: () => { showMain(); toMain({ type: 'menu' }); } },
      { label: '先收起小 TA', click: () => { if (petWin) petWin.close(); } },
      { type: 'separator' },
      { label: '退出白露', click: () => { quitting = true; app.quit(); } }
    ]).popup({ window: petWin });
  }
});
app.on('before-quit', () => { quitting = true; });

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 380,
    minHeight: 560,
    title: '白露',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      // ⚠️ 关掉同源策略。原因：白露要直接 fetch 各家 AI 接口（含各种中转），
      // 页面本身是 file:// 起源，开着同源策略这些请求会被浏览器拦掉——
      // 以前那个 bat 用 --disable-web-security 也是同一个道理，这里只是把它挪进了程序内部。
      //
      // 代价：页面里的脚本能读本机文件。所以「设置 → 允许执行注入脚本」这个开关
      // 保持默认关闭，别一边开着它一边导入来路不明的角色卡。
      webSecurity: false,
      // 渲染进程不给 Node 能力，角色卡脚本就算跑起来也碰不到文件系统 API
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      // 🎧「一起听 · 一起看」要在应用里开网易云 / QQ 音乐 / B 站的官方网页（js/75）
      webviewTag: true,
      // 🧸 给页面一个 window.gyDesk（只有控制桌面小 TA 的几个方法）
      preload: (PRELOADS = PRELOADS || writePreloads()).main,
    },
  });

  // 🎧 开进来的官方网页：按普通网页的安全规矩来（开同源策略、没有 Node），登录状态存在 persist:gymedia 里一直留着
  mainWindow.webContents.on('will-attach-webview', (e, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false; prefs.contextIsolation = true; prefs.webSecurity = true;
    if (!/^https?:/i.test(params.src || '')) { e.preventDefault(); return; }
    params.partition = 'persist:gymedia';
  });

  if (state.maximized) mainWindow.maximize();

  const indexPath = path.join(__dirname, 'app', 'index.html');
  logBoot(`加载页面: ${indexPath}`);
  mainWindow.loadFile(indexPath).then(
    () => logBoot('页面加载完成'),
    err => {
      logBoot(`页面加载失败: ${(err && err.message) || err}`);
      dialog.showErrorBox('白露打不开',
        `页面加载失败：\n${indexPath}\n\n${(err && err.message) || err}\n\n` +
        `多半是打包时 app 文件夹没同步进来。\n重新运行一次「一键打包exe.bat」试试。\n\n日志：${logPath}`);
    });

  // 等页面画好再显示，避免先闪一下白屏
  //
  // ⚠️ "exe 里输入框不显示光标"就出在这一段。show:false + 后面 show() 这个写法，
  // 在 Windows 上窗口会出现、看起来也是激活的，但**键盘焦点不一定真的给到了渲染进程**
  // ——网页那边没拿到焦点，浏览器就不画光标（caret 只在获得焦点的文档里闪）。
  // 表现就是：窗口好好的、鼠标能点，光标死活不出来，点一下输入框有时才好。
  // 第一版修法（show 之后调一次 focus + webContents.focus）**没修好**，实测症状照旧：
  // 窗口起来了、鼠标能点，但所有输入框都打不了字，切出去再切回来就正常了。
  // "切回来就好"这条说明 mainWindow.on('focus') 里那句 webContents.focus() 是有效的，
  // 只是首次显示的时候调它等于白调——Windows 那时候还没把前台激活权给到这个窗口，
  // 窗口没被系统激活，webContents.focus() 就是个空操作。
  //
  // 根源是 show:false → 后面手动 show() 这个写法：这次 show 不是用户点出来的，
  // Windows 会拒绝把前台权交给它（防止程序抢焦点的机制）。
  // 所以改成"逐级加码 + 每一级都记日志"：
  //   ① 常规：app.focus({steal:true}) → 窗口 focus → 网页 focus
  //   ② 150ms 后没拿到：blur 再 focus，强制走一遍完整的焦点切换（等价于手动 alt-tab）
  //   ③ 600ms 后还没拿到：置顶一下再取消，Windows 上这招能强行拿到前台激活权
  // 每一级都只在"确实还没拿到"的时候才执行，正常情况下第①级就结束了，不会有闪烁。
  // 日志会写进 启动日志.txt，万一还是不行，看日志就知道卡在哪一级，不用再猜。
  const focusState = () => {
    try {
      return 'win=' + mainWindow.isFocused() + ' web=' + mainWindow.webContents.isFocused();
    } catch (e) { return '(读不到)'; }
  };
  const grabWebFocus = () => { try { mainWindow.webContents.focus(); } catch (e) {} };
  const hasWebFocus = () => { try { return mainWindow.webContents.isFocused(); } catch (e) { return false; } };
  const alive = () => mainWindow && !mainWindow.isDestroyed();

  const showAndFocus = () => {
    if (!alive()) return;
    mainWindow.show();
    // Windows 专用：把前台激活权抢过来。不加这句，下面两个 focus 经常都是空操作。
    if (process.platform === 'win32') { try { app.focus({ steal: true }); } catch (e) {} }
    mainWindow.focus();
    grabWebFocus();
    logBoot('① 显示并请求焦点 → ' + focusState());

    setTimeout(() => {
      if (!alive() || hasWebFocus()) return;
      logBoot('② 网页仍未拿到焦点，强制走一遍焦点切换 → ' + focusState());
      try { mainWindow.blur(); mainWindow.focus(); } catch (e) {}
      grabWebFocus();
    }, 150);

    setTimeout(() => {
      if (!alive() || hasWebFocus()) return;
      logBoot('③ 还是没拿到，用置顶强行激活 → ' + focusState());
      try {
        mainWindow.setAlwaysOnTop(true);
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(false);
      } catch (e) {}
      grabWebFocus();
      setTimeout(() => { if (alive()) logBoot('④ 最终焦点状态 → ' + focusState()); }, 200);
    }, 600);
  };
  mainWindow.once('ready-to-show', () => { logBoot('ready-to-show'); showAndFocus(); });
  // 页面加载完再补一次：ready-to-show 有时早于渲染进程真正就绪
  mainWindow.webContents.on('did-finish-load', () => { if (alive() && mainWindow.isVisible()) grabWebFocus(); });

  // 从任务栏点回来、或者从别的程序切回来时，同样把焦点交还给网页。
  // （这条本来就是对的——你"切出去再切回来就能打字"，靠的就是它。）
  mainWindow.on('focus', () => { grabWebFocus(); });
  mainWindow.on('restore', () => { grabWebFocus(); });
  mainWindow.on('show', () => { grabWebFocus(); });

  // ------------------------------------------------------------------
  // 焦点看门狗
  //
  // 不去猜"焦点会在什么时候丢"，直接盯**结果**：
  // 只要出现「窗口是激活的，但网页那层没有焦点」这种自相矛盾的状态，就把它修回来。
  //
  // 已知会造成这个状态的是原生弹窗（alert/confirm/prompt）——用户实测是导入备份
  // 之后必现，因为那一支最后会 alert 一下。渲染进程那边也包了一层去抢焦点
  // （见 js/01 开头），这里是第二道保险：万一还有别的没想到的路径能弄丢焦点，
  // 最多两秒也会被这条捞回来，不用再靠"把窗口切出去再切回来"。
  //
  // 开销可以忽略：两秒一次，就读两个布尔值。修好时记一次日志，方便回头看它到底救过几次。
  // ------------------------------------------------------------------
  let focusFixCount = 0;
  const focusWatchdog = setInterval(() => {
    if (!alive() || !mainWindow.isVisible()) return;
    try {
      if (mainWindow.isFocused() && !mainWindow.webContents.isFocused()) {
        grabWebFocus();
        focusFixCount++;
        // 只记前几次，别把日志刷爆
        if (focusFixCount <= 5) {
          logBoot(`[焦点看门狗] 窗口是激活的但网页没焦点，已抢回（第 ${focusFixCount} 次）`);
        }
      }
    } catch (e) {}
  }, 2000);
  mainWindow.on('closed', () => clearInterval(focusWatchdog));

  // ------------------------------------------------------------------
  // 把「网页里发生了什么」也记进启动日志
  //
  // 上一轮日志证明了窗口和网页的焦点都拿到了（win=true web=true），
  // 但界面点了没反应 —— 说明问题在网页那一层，不在主进程。
  // 而网页那层的报错平时只有开发者工具能看到，用户不一定会开。
  // 这里把渲染进程的 console 错误、崩溃、卡死、资源加载失败统统转写进同一份
  // 启动日志.txt，用户照旧把那个文件发出来就够了。
  // ------------------------------------------------------------------
  mainWindow.webContents.on('console-message', (...args) => {
    try {
      let level, message, line, sourceId;
      // Electron 新版把这些合进了一个事件对象，老版是分开的参数，两种都兼容
      const a0 = args[0];
      if (a0 && typeof a0 === 'object' && typeof a0.message === 'string') {
        level = a0.level; message = a0.message; line = a0.lineNumber; sourceId = a0.sourceId;
      } else {
        level = args[1]; message = args[2]; line = args[3]; sourceId = args[4];
      }
      const isBad = level === 'error' || level === 'warning' || level === 2 || level === 3;
      if (!isBad) return;
      logBoot(`[网页${(level === 'error' || level === 3) ? '报错' : '警告'}] ${message}` +
              (sourceId ? `   @ ${String(sourceId).split(/[\\/]/).pop()}:${line}` : ''));
    } catch (e) { /* 记日志本身不能出事 */ }
  });
  mainWindow.webContents.on('did-fail-load', (e, code, desc, url) => {
    logBoot(`[资源加载失败] ${code} ${desc} ${url}`);
  });
  mainWindow.webContents.on('render-process-gone', (e, details) => {
    logBoot('!!! 渲染进程没了: ' + JSON.stringify(details));
  });
  // 这两条最值钱：直接告诉我们主线程是不是被卡住了 —— "点了没反应"最常见的成因
  mainWindow.webContents.on('unresponsive', () => logBoot('!!! 页面无响应（主线程被卡住了）'));
  mainWindow.webContents.on('responsive', () => logBoot('页面恢复响应'));

  // 起来 6 秒之后，主动问网页几个问题，把答案写进日志。
  // 这几项基本能定位"点了没反应"到底是哪一类：
  //   启动完成了吗 / 有没有东西盖在最上层 / 样式表加载了没 / 焦点在哪个元素上
  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.executeJavaScript(`(function () {
      try {
        var covers = [];
        var all = document.body ? document.body.querySelectorAll('*') : [];
        for (var i = 0; i < all.length; i++) {
          var el = all[i], cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
          var r = el.getBoundingClientRect();
          if (r.width > innerWidth * 0.8 && r.height > innerHeight * 0.8) {
            covers.push('<' + el.tagName.toLowerCase() + ' id=' + (el.id || '-') +
                        ' class=' + String(el.className || '-').slice(0, 30) + ' z=' + cs.zIndex + '>');
          }
        }
        var mid = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
        return JSON.stringify({
          启动完成: !!window.__guyuBooted,
          文档有焦点: document.hasFocus(),
          焦点元素: document.activeElement ? (document.activeElement.tagName + '#' + (document.activeElement.id || '')) : null,
          样式表数: document.styleSheets.length,
          盖住大半屏的元素: covers,
          屏幕正中点到的是: mid ? ('<' + mid.tagName.toLowerCase() + ' id=' + (mid.id || '-') + '>') : null,
          有没有聊天输入框: !!document.getElementById('chatInput'),
          正文开头: (document.body ? (document.body.innerText || '') : '').replace(/\\s+/g, ' ').slice(0, 100)
        });
      } catch (e) { return 'probe error: ' + (e && e.message); }
    })()`, true).then(
      r => logBoot('页面自检 → ' + r),
      err => logBoot('页面自检失败 → ' + ((err && err.message) || err))
    );
  }, 6000);

  // 兜底：万一 ready-to-show 因为页面异常一直不触发，也要把窗口显示出来，
  // 否则用户看到的就是"进程在跑但没有窗口"，比直接报错还难查。
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      logBoot('ready-to-show 超时未触发，强制显示窗口');
      showAndFocus();
    }
  }, 10000);

  // 最大化前记一下还原尺寸，不然下次启动会以最大化时的尺寸当默认窗口大小
  mainWindow.on('maximize', () => { mainWindow.__restoreBounds = mainWindow.getNormalBounds(); });
  mainWindow.on('close', e => {
    saveWindowState(mainWindow);
    // 🧸 小 TA 在桌面上时：× 只是藏起窗口，程序接着跑（右键小 TA →「退出」才真退出）
    if (!quitting && petWin && !petWin.isDestroyed()) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  // 站外链接一律丢给系统浏览器，不在应用窗口里打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); shell.openExternal(url); }
  });

  // 渲染进程崩了给个明确提示，而不是窗口白着让人以为卡死
  mainWindow.webContents.on('render-process-gone', (e, details) => {
    dialog.showErrorBox('白露崩溃了', `渲染进程异常退出：${details.reason}\n\n存档在：${app.getPath('userData')}\n重启一下试试。`);
  });
}

// ------------------------------------------------------------------
// 菜单
// ------------------------------------------------------------------
function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开存档所在文件夹',
          click: () => shell.openPath(app.getPath('userData')),
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于白露',
              message: '白露 桌面版',
              detail:
                `版本：${app.getVersion()}\n` +
                `Electron：${process.versions.electron}\n` +
                `Chromium：${process.versions.chrome}\n\n` +
                `存档位置：\n${app.getPath('userData')}\n\n` +
                `本应用为 AI 生成，分享内容时请标明。`,
              buttons: ['知道了'],
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ------------------------------------------------------------------
// 生命周期
// ------------------------------------------------------------------

// 只允许开一个实例：开第二个时把已有窗口顶到前面，
// 避免两个窗口同时读写同一份 IndexedDB 把存档写坏。
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // 已经有一个白露在跑，本次直接退出、把已有窗口顶到前面。
  // 注意：如果上一次是崩溃退出、进程还残留在后台（任务管理器里能看到但没有窗口），
  // 之后每次双击都会走到这里、闪一下就没 —— 这正是"打不开"最常见的原因，
  // 所以这里一定要留下日志，诊断脚本会把它读出来。
  logBoot('已有另一个白露实例在运行，本次启动退出。');
  logBoot('如果屏幕上并没有白露窗口，说明后台残留了僵尸进程 —— 到任务管理器结束「白露」再试。');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // 🎧 网页里的播放器不用先点一下才能出声
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  // 🎧 小窗里的网站要开新窗口（比如 QQ 音乐的播放页、登录弹窗）：就在小窗里打开，不另起一个窗口
  app.on('web-contents-created', (e, contents) => {
    if (contents.getType() !== 'webview') return;
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) { contents.loadURL(url); }
      return { action: 'deny' };
    });
  });

  app.whenReady().then(() => {
    logBoot('app ready');
    try {
      buildMenu();
      createWindow();
    } catch (e) {
      fatal('创建窗口', e);
      return;
    }
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }).catch(e => fatal('app.whenReady', e));

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
