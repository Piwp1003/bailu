// 验证启动自检：正常启动不打扰，出问题时把原因画到屏幕上
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
const root = process.cwd();
const browser = await launchBrowser(chromium);
const results = [];
const check = (n, ok, extra='') => results.push({n, ok, extra});

async function boot(mutate) {
  const page = await browser.newPage({ viewport:{width:420,height:820} });
  page.on('dialog', d=>d.accept());
  if (mutate) await mutate(page);
  await page.goto(fileUrl(path.join(root,'index.html')));
  await page.waitForTimeout(2000);
  return page;
}

// ---- 1. 正常启动：不该弹自检面板，且离线也能起来 ----
let page = await boot(async p => {
  // 断网：确认不再依赖 cdnjs
  await p.route('**cdnjs.cloudflare.com**', r => r.abort());
});
check('离线也能启动（不再依赖 cdnjs）', await page.evaluate(()=>window.__guyuBooted === true));
check('localforage 是本地加载的', await page.evaluate(()=>typeof localforage !== 'undefined'));
check('正常启动时不弹自检面板', !(await page.evaluate(()=>document.body.innerText.includes('白露启动失败'))));
check('侧边栏渲染出来了', (await page.locator('#nav-home').count()) === 1);   // 续写入口已经并进「故事」页顶上，所以看主页那一项
await page.close();

// ---- 2. 关键脚本 404：自检要报出是哪个文件 ----
page = await boot(async p => {
  await p.route('**/js/01-core-state-infra.js*', r => r.abort());   // 带着 ?v=版本号，所以末尾要有 *
});
const t404 = await page.evaluate(()=>document.body.innerText);
check('脚本丢失时弹出自检面板', t404.includes('白露启动失败'), t404.slice(0,120));
check('自检面板指出了缺哪个文件', t404.includes('01-core-state-infra.js'), t404.slice(0,200));
await page.close();

// ---- 3. 启动时抛异常：自检要报出堆栈 ----
// 注意错误必须真的发生在"启动完成之前"——面板现在只管启动阶段，
// 启动完成之后的报错一律只进控制台（见下面第 6、7 项）。
page = await boot(async p => {
  await p.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => { throw new Error('模拟启动异常'); });
  });
});
const tErr = await page.evaluate(()=>document.body.innerText);
check('启动异常时弹出自检面板', tErr.includes('白露启动失败'), tErr.slice(0,120));
check('自检面板带上了报错内容', tErr.includes('模拟启动异常'), tErr.slice(0,220));
await page.close();

// ---- 5. 远程图片挂掉：绝不能因此说"启动失败" ----
// 真实事故：用户存档里有一张图床上的图，图床取不到，
// 打包好的 exe 一开就是满屏"白露启动失败 / 打包时可能漏了这个文件"，整个 app 用不了。
page = await boot(async p => {
  await p.route('**img.heliar.top**', r => r.abort());
  await p.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const img = document.createElement('img');
      img.src = 'https://img.heliar.top/file/1781770726397_IMG_1030.jpeg';
      document.body.appendChild(img);
    });
  });
});
let t5 = await page.evaluate(()=>document.body.innerText);
check('远程图片加载失败不弹自检面板', !t5.includes('白露启动失败'), t5.slice(0,200));
check('图挂了 app 照常启动', await page.evaluate(()=>window.__guyuBooted === true));
await page.close();

// ---- 6. 启动完成之后再挂图 / 再报错：同样不能糊住界面 ----
page = await boot();
await page.evaluate(() => {
  const img = document.createElement('img');
  img.src = './这个文件不存在.png';
  document.body.appendChild(img);
});
await page.waitForTimeout(400);
let t6 = await page.evaluate(()=>document.body.innerText);
check('用到一半本地图片挂了也不弹面板', !t6.includes('白露启动失败'), t6.slice(0,200));

await page.evaluate(() => { setTimeout(()=>{ throw new Error('角色卡脚本报错'); }, 0); });
await page.waitForTimeout(400);
t6 = await page.evaluate(()=>document.body.innerText);
check('启动之后的脚本报错只进控制台，不弹面板', !t6.includes('白露启动失败'), t6.slice(0,200));

await page.evaluate(() => { Promise.reject(new Error('接口超时')); });
await page.waitForTimeout(400);
t6 = await page.evaluate(()=>document.body.innerText);
check('启动之后的 promise 失败也不弹面板', !t6.includes('白露启动失败'), t6.slice(0,200));
await page.close();

// ---- 7. PWA manifest 改名后不再占用 manifest.json ----
page = await boot();
const manifestHref = await page.evaluate(()=>{
  const l = document.querySelector('link[rel="manifest"]');
  return l ? l.getAttribute('href') : '(file:// 下不挂，符合预期)';
});
check('PWA manifest 不再叫 manifest.json', !String(manifestHref).endsWith('/manifest.json'), manifestHref);
await page.close();

await browser.close();
const bad = results.filter(r=>!r.ok);
results.forEach(r=>console.log((r.ok?'  ✅':'  ❌')+' '+r.n+(r.ok?'':'\n       → '+r.extra)));
console.log('\n'+(results.length-bad.length)+'/'+results.length+' 通过');
process.exit(bad.length?1:0);
