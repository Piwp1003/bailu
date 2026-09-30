// 把上级目录的白露源码同步进 app/，并把两个 CDN 依赖换成本地文件。
// 每次打包前自动跑（npm run build 里已经串好了），也可以单独 `node sync.js`。
//
// 之所以不直接让 Electron 加载 ../index.html：electron-builder 只打包项目目录内的文件，
// 引用上级目录会被漏掉。同步一份进来最省事，也顺便保证打进 exe 的是一份干净快照。

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..');      // 白露源码目录
const DST = path.join(__dirname, 'app');     // 打进 exe 的那份

// 要带进桌面版的东西。没列进来的（备份文件、控制台脚本、开发测试、.git 等）一律不打包。
const FILES = ['index.html', 'style.css'];
const DIRS = ['js', 'icons'];
// 有就带上，没有也不影响桌面版跑起来：
//   pwa-manifest.json —— PWA 用的，index.html 只在 http/https 下才挂它，file:// 下根本不会加载
//   liquid-glass-cat-theme.css —— 备用主题，index.html 没引用，留着方便你手动换皮
const OPTIONAL_FILES = ['pwa-manifest.json', 'liquid-glass-cat-theme.css'];

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log('[同步] 清理 app/');
rmrf(DST);
fs.mkdirSync(DST, { recursive: true });

let missing = [];
for (const f of FILES) {
  const s = path.join(SRC, f);
  if (!fs.existsSync(s)) { missing.push(f); continue; }
  fs.copyFileSync(s, path.join(DST, f));
  console.log('[同步] ' + f);
}
for (const d of DIRS) {
  const s = path.join(SRC, d);
  if (!fs.existsSync(s)) { missing.push(d + '/'); continue; }
  copyDir(s, path.join(DST, d));
  console.log('[同步] ' + d + '/  (' + fs.readdirSync(s).length + ' 项)');
}
for (const f of OPTIONAL_FILES) {
  const s = path.join(SRC, f);
  if (!fs.existsSync(s)) { console.log('[同步] - 跳过 ' + f + '（没有，不影响）'); continue; }
  fs.copyFileSync(s, path.join(DST, f));
  console.log('[同步] ' + f);
}

// 两个第三方库现在直接放在源码的 js/vendor/ 里（跟着上面的 DIRS 一起拷过来了），
// 不再从 cdnjs 拉，所以这里也不需要再改写 index.html 的 script 标签了。
// 顺手确认一下它们确实被拷进来了，缺了的话桌面版会起不来。
for (const lib of ['localforage.min.js', 'mammoth.browser.min.js']) {
  if (!fs.existsSync(path.join(DST, 'js', 'vendor', lib))) {
    console.error('[同步] ✗ 缺少 js/vendor/' + lib + '，桌面版会启动失败');
    process.exit(1);
  }
}
console.log('[同步] 第三方库已随 js/vendor/ 一起打包');

const indexPath = path.join(DST, 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

// PWA 的 service worker 在 file:// 下没有意义，注册失败还会在控制台刷错误
html = html.replace(/<script src="\.\/service-worker\.js"><\/script>/i, '');
fs.writeFileSync(indexPath, html);

if (missing.length) {
  console.error('[同步] ✗ 以下文件/目录没找到：' + missing.join('、'));
  console.error('       确认「桌面版」这个文件夹就放在白露源码目录里面（跟 index.html 同级的下一层）。');
  process.exit(1);
}

// 打包前做个基本体检，别等 exe 出来了才发现少文件
const mustExist = ['index.html', 'style.css', 'js/01-core-state-infra.js', 'js/16-story-studio.js', 'js/vendor/localforage.min.js'];
for (const m of mustExist) {
  if (!fs.existsSync(path.join(DST, m))) {
    console.error('[同步] ✗ app/' + m + ' 不存在，打包会失败');
    process.exit(1);
  }
}
const jsCount = fs.readdirSync(path.join(DST, 'js')).filter(f => f.endsWith('.js')).length;
console.log(`[同步] 完成：js 模块 ${jsCount} 个`);
