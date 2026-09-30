// 扫描所有内联事件绑定（onclick / onchange / ...），确认它们调用的函数**真的存在**。
// 按钮绑了个不存在的函数，点下去只在控制台报一句 "xxx is not defined"，
// 界面上什么反应都没有 —— 这类"点了没反应"最难自己发现，只能靠扫。
//
// 扫两处：
//   ① index.html 里写死的内联事件
//   ② js/*.js 里用模板字符串拼出来的 HTML（列表项、卡片按钮那些都是这么生成的）
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';

const root = process.cwd();

// —— 从一段 HTML 文本里把内联事件调用的函数名抠出来 ——
const EVENT_ATTR = /\bon(?:click|dblclick|change|input|keypress|keydown|keyup|contextmenu|mouseover|mouseout|mousedown|mouseup|touchstart|touchend|touchmove|submit|focus|blur|wheel|paste)\s*=\s*(["'])([\s\S]*?)\1/gi;
// JS 关键字和语句开头，不是函数调用
const NOT_FUNCS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'new',
  'function', 'do', 'else', 'delete', 'void', 'in', 'of', 'await', 'case', 'try']);

function collectCalls(text, where, out) {
  let m;
  EVENT_ATTR.lastIndex = 0;
  while ((m = EVENT_ATTR.exec(text)) !== null) {
    // ${…} 是拼 HTML 时就求值掉的（比如 onclick="open('${esc(id)}')" 里的 esc），不是点按钮时才调的函数
    const code = m[2].replace(/\$\{[^}]*\}/g, '§');
    // 找 「标识符(」，且前面不是点号（排除 document.getElementById 这种方法调用）
    const callRe = /(^|[^.\w$'"`])([A-Za-z_$][\w$]*)\s*\(/g;
    let c;
    while ((c = callRe.exec(code)) !== null) {
      const name = c[2];
      if (NOT_FUNCS.has(name)) continue;
      if (!out.has(name)) out.set(name, new Set());
      out.get(name).add(where);
    }
  }
}

const calls = new Map();   // 函数名 -> 出现在哪些文件
collectCalls(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), 'index.html', calls);
for (const f of fs.readdirSync(path.join(root, 'js')).filter(x => x.endsWith('.js'))) {
  collectCalls(fs.readFileSync(path.join(root, 'js', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''), 'js/' + f, calls);
}

const names = [...calls.keys()].sort();
console.log('  扫到 ' + names.length + ' 个被内联事件调用的函数名\n');

const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('dialog', d => d.accept());
await page.route(/^https?:\/\//, r => r.abort());
await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=v;return Promise.resolve(v)},getItem(k){return Promise.resolve(this._d[k]??null)},removeItem(k){return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted === true, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(600);

const missing = await page.evaluate((list) => {
  const bad = [];
  for (const n of list) {
    let t = 'undefined';
    try { t = typeof window[n]; } catch (e) {}
    // 内联事件里的名字是在全局作用域解析的，所以必须挂在 window 上才点得动
    if (t !== 'function') bad.push(n + '  (typeof=' + t + ')');
  }
  return bad;
}, names);

console.log(missing.length === 0
  ? '  ✅ 全部都能在全局找到，没有点了没反应的按钮'
  : '  ❌ 下面这些函数不存在，绑了它们的按钮点下去毫无反应：\n');
for (const b of missing) {
  const name = b.split('  ')[0];
  console.log('     ' + b);
  console.log('       出现在：' + [...calls.get(name)].join('、'));
}

// —— 顺带查一条已知的坑：Electron 不支持 window.prompt() ——
const promptCalls = [];
for (const f of ['index.html', ...fs.readdirSync(path.join(root, 'js')).filter(x => x.endsWith('.js')).map(x => 'js/' + x)]) {
  const txt = fs.readFileSync(path.join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  txt.split('\n').forEach((line, i) => {
    if (/(^|[^.\w$])prompt\s*\(/.test(line) && !/appPrompt|nativeUI|gyInPageDialog/.test(line)) {
      promptCalls.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 80));
    }
  });
}
console.log('');
console.log(promptCalls.length === 0
  ? '  ✅ 没有直接调用原生 prompt()（Electron 不支持它，调了会抛异常，表现就是点了没反应）'
  : '  ❌ 这些地方还在直接用原生 prompt()，打包成 exe 之后一定是死的：\n     ' + promptCalls.join('\n     '));

await browser.close();
const failed = missing.length + promptCalls.length;
console.log('\n' + (failed === 0 ? '全部通过' : failed + ' 处有问题'));
process.exit(failed ? 1 : 0);
