// 打包/试跑的实际逻辑。
//
// 为什么不直接写在 .bat 里：cmd 是按字节流解析批处理文件的，文件里只要有中文（UTF-8 多字节），
// 读取指针就可能串位，把后面的命令从中间劈开——典型症状是报
// 「'BINARIES_MIRROR' 不是内部或外部命令」这种把一行 set 劈成两半的错。
// 所以 .bat 保持纯英文当个薄壳，所有中文提示和逻辑都放到这里，由 Node 输出（UTF-8 安全）。
//
// 用法：node tasks.js build   打包成 exe
//       node tasks.js dev     直接跑，不打包
//       node tasks.js doctor  打包完的 exe 打不开时，查死因

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const task = process.argv[2] || 'build';

// 下载源：默认**直连官方源**。
// 之前默认走 npmmirror 镜像，理由是"从 GitHub 拉经常卡住"——但实测反过来了：
// 镜像那边下不下来，直连反而是通的。镜像现在降级成失败之后的备选，不再当默认。
// 想强制走镜像：设环境变量 BAILU_MIRROR=1 再跑。
const USE_MIRROR = process.env.BAILU_MIRROR === '1';
const MIRROR_ENV = {
  ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/',
  ELECTRON_BUILDER_BINARIES_MIRROR: 'https://npmmirror.com/mirrors/electron-builder-binaries/',
};
const env = USE_MIRROR ? { ...process.env, ...MIRROR_ENV } : { ...process.env };
// 备选环境：直连失败时用它再试一次
const envMirror = { ...process.env, ...MIRROR_ENV };

const line = () => console.log('='.repeat(46));
function fail(msg, hint) {
  console.log('');
  console.log('[x] ' + msg);
  if (hint) { console.log(''); console.log(hint); }
  console.log('');
  process.exit(1);
}

// Windows 上 npm/npx 实际是 .cmd 脚本，必须走 shell 才找得到。
// 但 shell:true 的时候**不能再把 args 数组分开传** —— Node 会把它们直接拼在命令行后面、
// 不做任何转义，所以从 Node 22 起会警告 DEP0190（打包日志末尾那行 DeprecationWarning 就是它）。
// 正确写法是自己拼成一整条命令、参数各自加引号，只传这一个字符串。
function quoteArg(a) {
  const s = String(a);
  return /[\s"&|<>^]/.test(s) ? '"' + s.replace(/"/g, '\\"') + '"' : s;
}
function spawnLine(cmd, args, useEnv) {
  const line = [cmd].concat(args || []).map(quoteArg).join(' ');
  return spawnSync(line, { stdio: 'inherit', env: useEnv, cwd: HERE, shell: true });
}
function run(cmd, args, extraEnv) {
  const useEnv = extraEnv ? { ...env, ...extraEnv } : env;
  return spawnLine(cmd, args, useEnv).status === 0;
}
// 先直连，不行再走镜像。两条路都试过才算真失败。
function runWithFallback(cmd, args, label) {
  if (run(cmd, args)) return true;
  if (USE_MIRROR) return false;   // 本来就在走镜像，没有别的路了
  console.log('');
  console.log('      ' + label + '：直连没成功，换国内镜像再试一次...');
  console.log('');
  return spawnLine(cmd, args, envMirror).status === 0;
}

// ==================================================================
// doctor：exe 闪退时用。main.js 从进程一起来就往「启动日志.txt」写里程碑，
// 这里负责把它读出来，并顺手排掉最常见的那个坑（后台残留的僵尸进程）。
// ==================================================================
if (task === 'doctor') {
  line();
  console.log('  白露 桌面版 - 闪退诊断');
  line();
  console.log('');

  // exe 可能在两个地方：
  //   dist\白露.exe                单文件免安装版（打包完全成功时才有）
  //   dist\win-unpacked\白露.exe   文件夹版，最后一步 NSIS 失败时也会有，一样能跑
  const portableExe = path.join(HERE, 'dist', '白露.exe');
  const unpackedExe = path.join(HERE, 'dist', 'win-unpacked', '白露.exe');
  let exe = null;
  if (fs.existsSync(portableExe)) {
    exe = portableExe;
    console.log('[1/3] 找到单文件版：' + exe);
  } else if (fs.existsSync(unpackedExe)) {
    exe = unpackedExe;
    console.log('[1/3] 单文件版没生成，但找到了文件夹版：');
    console.log('      ' + exe);
    console.log('');
    console.log('      => 说明打包卡在最后一步（NSIS 压成单文件）。');
    console.log('         但这个文件夹版本身是完整可用的，双击就能玩，');
    console.log('         只是分享时要把整个 win-unpacked 文件夹一起打包。');
  } else {
    fail('dist 里没找到白露.exe。',
      '    两个位置都查过了：\n' +
      '      ' + portableExe + '\n' +
      '      ' + unpackedExe + '\n' +
      '\n' +
      '    先双击「一键打包exe.bat」打包，再回来跑这个。');
  }
  console.log('      体积 ' + (fs.statSync(exe).size / 1024 / 1024).toFixed(0) + ' MB');

  // —— 僵尸进程 ——
  // 上次崩溃退出但进程还挂在后台时，main.js 的单实例锁会让之后每次双击都立刻退出，
  // 表现就是"闪一下就没了"。这是这类问题里最常见的一种，先排掉。
  console.log('');
  console.log('[2/3] 检查后台有没有残留的白露进程...');
  if (process.platform === 'win32') {
    const q = spawnSync('tasklist /FI "IMAGENAME eq 白露.exe" /NH', { encoding: 'utf8', shell: true });
    const out = (q.stdout || '');
    if (/白露\.exe/.test(out)) {
      console.log('      发现残留进程，正在结束：');
      console.log('      ' + out.trim().split('\n')[0].trim());
      spawnSync('taskkill /F /IM "白露.exe"', { stdio: 'inherit', shell: true });
      console.log('      已结束。这很可能就是打不开的原因 —— 单实例锁会让后来的每次');
      console.log('      启动都直接退出，看起来就是闪一下就没。');
    } else {
      console.log('      没有残留进程');
    }
  } else {
    console.log('      （非 Windows，跳过）');
  }

  // —— 启动日志 ——
  console.log('');
  console.log('[3/3] 启动一次，然后读日志...');
  console.log('');
  // 日志写在 exe 旁边，所以要按实际用的是哪个 exe 去找
  const logFile = path.join(path.dirname(exe), '启动日志.txt');
  try { fs.unlinkSync(logFile); } catch (e) {}

  spawnSync(exe, [], { cwd: path.dirname(exe), shell: false, detached: true, stdio: 'ignore' });
  // 给它几秒钟把日志写出来
  spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},6000)'], { stdio: 'ignore' });

  line();
  if (fs.existsSync(logFile)) {
    console.log('  启动日志（' + logFile + '）：');
    line();
    console.log('');
    console.log(fs.readFileSync(logFile, 'utf8').trim());
    console.log('');
    line();
    console.log('');
    console.log('  怎么看：');
    console.log('    - 日志停在「加载页面」之后没有「页面加载完成」');
    console.log('        => app 文件夹没打进 exe，重新打包一次');
    console.log('    - 出现「已有另一个白露实例在运行」');
    console.log('        => 后台有残留进程，本脚本上一步已经帮你结束了，再双击 exe 试试');
    console.log('    - 出现「!!! 崩溃于 ...」');
    console.log('        => 把那段贴出来，能直接定位');
    console.log('    - 日志是空的 / 根本没生成');
    console.log('        => 进程压根没起来，八成被杀毒软件拦了（360、火绒常见），');
    console.log('           去杀毒软件的拦截记录里把「白露.exe」加白名单');
  } else {
    console.log('  没有生成启动日志。');
    line();
    console.log('');
    console.log('  说明 exe 的进程根本没跑起来，最可能的两种：');
    console.log('');
    console.log('    1. 被杀毒软件拦了 —— 未签名的 exe 很常见，尤其 360 和火绒。');
    console.log('       去杀毒软件的「拦截记录 / 隔离区」看看有没有「白露.exe」，');
    console.log('       加到白名单再试。');
    console.log('');
    console.log('    2. 打包不完整 —— 重新双击一次「一键打包exe.bat」。');
  }
  console.log('');
  process.exit(0);
}

line();
console.log(task === 'dev' ? '  白露 桌面版 - 试跑（不打包）' : '  白露 桌面版 - 打包成免安装 exe');
line();
console.log('');

// —— 位置检查：这个文件夹必须在白露源码目录里 ——
const srcIndex = path.join(HERE, '..', 'index.html');
if (!fs.existsSync(srcIndex)) {
  fail('在上一层没找到 index.html。',
    '    「桌面版」这个文件夹必须放在白露源码目录里面，也就是：\n' +
    '\n' +
    '      克劳德神了\\\n' +
    '      ├─ index.html\n' +
    '      ├─ js\\\n' +
    '      └─ 桌面版\\      <- 本文件夹\n' +
    '\n' +
    '    现在它在：' + HERE);
}
console.log('[1/4] 位置正确，源码在上一层');
console.log('      Node.js ' + process.version);
console.log(USE_MIRROR ? '      下载源：国内镜像（BAILU_MIRROR=1）' : '      下载源：官方直连（失败会自动换镜像重试）');

// —— 依赖 ——
if (!fs.existsSync(path.join(HERE, 'node_modules'))) {
  console.log('');
  console.log('[2/4] 第一次运行，安装依赖中...');
  console.log('      要下 100MB 左右的浏览器内核，慢一点是正常的，别关窗口');
  console.log('');
  // 先直连官方 npm，失败再换国内 registry
  if (!run('npm', ['install', '--no-audit', '--no-fund'])
      && !run('npm', ['install', '--no-audit', '--no-fund', '--registry=https://registry.npmmirror.com'])) {
    fail('依赖安装失败。',
      '    官方源和国内镜像都试过了，两边都没成。多半是网络问题，\n' +
      '    换个网或挂个梯子再双击一次本文件。');
  }
} else {
  console.log('');
  console.log('[2/4] 依赖已就位，跳过安装');
}

// —— Electron 包 / 内核本体检查 ——
//
// ⚠️ 这里必须分清两样东西，我上一版就是没分清，把用户的打包搞坏了：
//
//   ① node_modules/electron 这个 **npm 包**（很小，就是几个 js + package.json）
//      → **打包必须要它**。electron-builder 靠读它的 package.json 才知道打哪个版本的内核。
//      → 绝对不能删。上一版"装不上就删掉重装"，删完装不上，打包也跟着废了。
//
//   ② node_modules/electron/dist/electron.exe 这个 **内核本体**（~100MB）
//      → 只有「试跑」需要它。**打包不需要**——electron-builder 用的是它自己缓存里的那份。
//      → 所以"能打包、不能试跑"是完全正常的一种状态，不用去修。
//
// 于是分成两段：包缺了必须补（两个任务都要），内核缺了只在试跑时才管。
const elecDir = path.join(HERE, 'node_modules', 'electron');
const elecPkg = path.join(elecDir, 'package.json');
const elecExe = path.join(elecDir, 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');

// ① 包本身：打包和试跑都要
if (!fs.existsSync(elecPkg)) {
  console.log('');
  console.log('      electron 这个包不在了，先把它装回来');
  console.log('      （只装包，跳过那 100MB 的内核下载，很快）');
  console.log('');
  // ELECTRON_SKIP_BINARY_DOWNLOAD=1：只装包、不下内核。
  // 打包只需要包里的 package.json，这样能秒装成功，不受网络影响。
  const ok = run('npm', ['install', 'electron@^38.0.0', '--no-audit', '--no-fund'],
                 { ELECTRON_SKIP_BINARY_DOWNLOAD: '1' })
          || run('npm', ['install', 'electron@^38.0.0', '--no-audit', '--no-fund',
                 '--registry=https://registry.npmmirror.com'], { ELECTRON_SKIP_BINARY_DOWNLOAD: '1' });
  if (!ok || !fs.existsSync(elecPkg)) {
    fail('electron 这个包装不回来。',
      '    在「桌面版」文件夹里开个命令行，手动跑这两行：\n' +
      '\n' +
      '      set ELECTRON_SKIP_BINARY_DOWNLOAD=1\n' +
      '      npm install electron@^38.0.0\n' +
      '\n' +
      '    这一步只下几百 KB，不下那 100MB 的内核，正常几秒就好。\n' +
      '    装好之后打包就能用了。');
  }
  console.log('      装回来了');
}

// ② 内核本体：只有试跑要
if (task === 'dev' && !fs.existsSync(elecExe)) {
  console.log('');
  console.log('      试跑需要 Electron 内核本体（~100MB），现在没有，去下');
  console.log('      先走官方直连，不行再换镜像');
  console.log('');
  runWithFallback('node', [path.join('node_modules', 'electron', 'install.js')], '下载内核');
  if (!fs.existsSync(elecExe)) {
    fail('Electron 内核下不下来，试跑用不了。',
      '    但这**不影响打包**——打包用的是 electron-builder 自己的缓存，\n' +
      '    你直接双击「一键打包exe.bat」照常能出 exe，只是每次慢一点。\n' +
      '\n' +
      '    想把试跑修好的话，在「桌面版」文件夹开命令行跑：\n' +
      '      node node_modules\\electron\\install.js\n' +
      '    看它具体报什么错。挂个梯子通常就能过。');
  }
  console.log('      内核就位');
}

// —— 同步源码 ——
console.log('');
console.log('[3/4] 同步源码到 app/ ...');
console.log('');
if (!run('node', ['sync.js'])) {
  fail('源码同步失败，看上面报的是缺哪个文件。');
}

// —— 干活 ——
if (task === 'dev') {
  console.log('');
  console.log('[4/4] 启动中... 关掉窗口即退出');
  console.log('');
  console.log('      提示：试跑时的存档跟正式 exe 的存档是分开的两份，');
  console.log('            随便折腾不会动到你正式在用的数据。');
  console.log('');
  run('npx', ['electron', '.']);
  process.exit(0);
}

const exe = path.join(HERE, 'dist', '白露.exe');
const unpacked = path.join(HERE, 'dist', 'win-unpacked', '白露.exe');
const backupExe = path.join(HERE, '上一个能用的白露.exe');
const mb = f => (fs.statSync(f).size / 1024 / 1024).toFixed(0);

// —— 先把上一次打好的 exe 挪出去保管 ——
// electron-builder 一开工就把 dist 清空。要是这次打包在半路挂了（比如最后压单文件那步
// 联网失败），你就同时失去了新 exe **和**上一次那个能用的——手上一个能跑的都不剩，
// 这正是"打不开了，我没招了"那种处境。
// 所以打包前先把它重命名挪到 dist 外面：成功了就删掉，失败了原样还回去。
// 用重命名不是复制，几百 MB 也是瞬间完成，不占时间。
let hadBackup = false;
try {
  if (fs.existsSync(exe)) {
    try { fs.rmSync(backupExe, { force: true }); } catch (e) {}
    fs.renameSync(exe, backupExe);
    hadBackup = true;
    console.log('');
    console.log('      （已先把上一次的 exe 挪到「上一个能用的白露.exe」保管，');
    console.log('        这次要是打包失败，还能用它顶着）');
  }
} catch (e) { /* 备份失败不影响打包本身 */ }

console.log('');
console.log('[4/4] 打包中... 要几分钟，别关窗口');
console.log('');
const builderOk = run('npx', ['electron-builder', '--win', 'portable']);

// —— 打包结束，处置备份 ——
if (fs.existsSync(exe)) {
  // 新的出来了，备份就没用了
  try { fs.rmSync(backupExe, { force: true }); } catch (e) {}
} else if (hadBackup) {
  console.log('');
  console.log('  ⚠️ 这次没打出新的 白露.exe，上一次那个已经帮你还回 dist 了。');
  try { fs.renameSync(backupExe, exe); } catch (e) {}
}

console.log('');
line();

if (fs.existsSync(exe)) {
  console.log('  打包完成！');
  line();
  console.log('');
  console.log('  产物：' + exe);
  console.log('  体积：约 ' + mb(exe) + ' MB');
  console.log('');
  console.log('  这个 exe 可以直接拷给别人用，对方不需要装任何东西。');

} else if (fs.existsSync(unpacked)) {
  // 最常见的"打了但没打完"：应用本体已经生成，只是最后一步压成单文件失败了。
  // 这时候千万别报个笼统的"打包失败"就完事——用户手上其实已经有能跑的东西了。
  console.log('  打包只完成了一半（但你已经有能用的了）');
  line();
  console.log('');
  console.log('  ✅ 能用的：' + unpacked);
  console.log('     体积约 ' + mb(unpacked) + ' MB，双击就能玩，功能完全一样。');
  console.log('');
  console.log('  ❌ 没生成的：dist\\白露.exe（单文件免安装版）');
  console.log('');
  console.log('  卡在最后一步：把应用压成单个 exe 要用到 NSIS 工具，');
  console.log('  它需要联网下载，这一步失败了。');
  console.log('');
  console.log('  怎么办：');
  console.log('    1. 重新双击一次「一键打包exe.bat」—— 直连失败时脚本会');
  console.log('       自动换国内镜像再试一遍，多试一次经常就过了');
  console.log('    2. 还不行就挂个梯子再试'); 
  console.log('    3. 不想折腾的话，直接用上面那个文件夹版：分享时把整个');
  console.log('       win-unpacked 文件夹压缩发出去（记得用 7-Zip，别用');
  console.log('       Windows 右键压缩，不然中文名会乱码）');
  console.log('');

} else {
  fail('打包失败，应用本体都没生成出来。',
    '    往上翻看看红字报的是什么。最常见的两种：\n' +
    '      - 网络问题，依赖没下全   => 重新双击一次本文件\n' +
    '      - 杀毒软件拦了写文件     => 临时关掉再试\n' +
    '\n' +
    '    electron-builder 退出码：' + (builderOk ? '0（但没产物，很反常）' : '非 0'));
}

console.log('');
console.log('  首次运行会在 exe 旁边生成 BailuData 文件夹存数据，');
console.log('  拷贝或备份时要连它一起带走。');
console.log('');
console.log('  ⚠ 浏览器版的存档不会自动搬过来。先在浏览器里');
console.log('    「设置 → 导出数据」存一个 json，再到 exe 里导入。');
console.log('');

// 打开产物文件夹
if (process.platform === 'win32' && fs.existsSync(path.join(HERE, 'dist'))) {
  spawnSync('explorer "' + path.join(HERE, 'dist') + '"', { shell: true });
}
