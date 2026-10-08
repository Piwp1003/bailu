// v213：插件管理——导入可以一次选好几个文件；同名插件直接覆盖（不多出一份、保留启用状态）；列表能多选批量启用 / 停用 / 导出 / 删除
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';
const root = process.cwd();
const BAILU = fs.existsSync(path.join(root, 'js', '90-bailu-cards.js'));
const PLUG = fs.readFileSync(path.join(root, '插件', '新玩法', '新玩法全家桶.json'), 'utf8');
const browser = await launchBrowser(chromium);
const results = []; const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
await page.route(/^https?:\/\//, r => r.abort());
await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && typeof handlePluginImport === 'function', { timeout: 20000 });
await page.waitForTimeout(1200);
const tag = BAILU ? '[白露]' : '[谷雨]';
const r = await page.evaluate(async (PLUG) => {
  window.__confirms = []; window.appConfirm = async m => { window.__confirms.push(m); return false; }; window.alert = m => { window.__alert = m; };
  plugins.length = 0; document.getElementById('view-plugins').style.display = 'block';
  const imp = files => new Promise(res => { const ev = { target: { files, value: 'x' } }; handlePluginImport(ev); setTimeout(res, 600); });
  const F = (name, obj) => new File([JSON.stringify(obj)], name, { type: 'application/json' });
  await imp([F('a.json', [{ name: '甲', type: 'prompt', promptText: '旧的', scope: 'global' }]), F('b.json', { name: '乙', type: 'prompt', promptText: 'b', scope: 'global' })]);
  const n1 = plugins.length, idA = plugins.find(p => p.name === '甲').id;
  plugins.find(p => p.name === '甲').enabled = false;
  await imp([F('a2.json', { name: '甲', type: 'prompt', promptText: '新的', scope: 'global' }), F('c.json', { name: '丙', type: 'prompt', promptText: 'c', scope: 'global' }), F('bad.json', '不是 json')]);
  const A = plugins.find(p => p.name === '甲');
  const r2 = { n2: plugins.length, sameId: A.id === idA, newText: A.promptText, keptOff: A.enabled === false, upd: !!A.updatedAt, askedRefresh: window.__confirms.some(m => /刷新/.test(m)) };
  // 全家桶导两次：第二次全是覆盖，不会翻倍
  const all = JSON.parse(PLUG); await imp([new File([PLUG], 'all.json')]); const k1 = plugins.length; await imp([new File([PLUG], 'all.json')]); const k2 = plugins.length;
  // 多选批量
  renderPluginsList(); pluginSelAll(true); const sel = pluginSel.size; await pluginBatch('off'); const allOff = plugins.every(p => p.enabled === false); await pluginBatch('on'); const allOn = plugins.every(p => p.enabled !== false);
  pluginSelAll(false); pluginSelToggle(plugins[0].id, true); pluginSelToggle(plugins[1].id, true); window.appConfirm = async () => true; window.refreshAppPage = () => { window.__refreshed = 1; }; const before = plugins.length; await pluginBatch('del'); const del = before - plugins.length;
  const bar = !!document.querySelector('.plg-bar'), multi = document.getElementById('pluginImportInput').multiple;
  // 关掉「同名覆盖」：就会多出一份
  setPluginOverwrite(false); const b0 = plugins.length; await imp([F('d.json', { name: plugins[0].name, type: 'prompt', promptText: 'dup', scope: 'global' })]); const dup = plugins.length - b0; setPluginOverwrite(true);
  return { n1, ...r2, all: all.length, k1, k2, sel, allOff, allOn, del, bar, multi, dup };
}, PLUG);
check(`${tag} 一次选好几个文件导入`, r.n1 === 2 && r.multi, JSON.stringify(r));
check(`${tag} 同名插件直接覆盖：不多出一份、id 不变、保留你设的启用状态，换成新内容，问要不要刷新`, r.n2 === 3 && r.sameId && r.newText === '新的' && r.keptOff && r.upd && r.askedRefresh, JSON.stringify(r));
check(`${tag} 全家桶导两次不会翻倍`, r.k2 === r.k1 && r.k1 === 3 + r.all, JSON.stringify(r));
check(`${tag} 列表多选：全选 / 批量停用 / 批量启用 / 批量删除`, r.bar && r.sel === r.k1 && r.allOff && r.allOn && r.del === 2, JSON.stringify(r));
check(`${tag} 关掉「同名覆盖」就照旧新增一份`, r.dup === 1, JSON.stringify(r));
check(`${tag} 没有页面报错`, errs.length === 0, errs.join(' | ').slice(0, 400));
await browser.close();
const bad = results.filter(x => !x.ok);
results.forEach(x => console.log((x.ok ? '  ✅' : '  ❌') + ' ' + x.n + (x.ok ? '' : '\n       → ' + x.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
