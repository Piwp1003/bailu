// 状态栏诊断：拿 8 张真实角色卡里自带的正则脚本，走白露真正的渲染链路跑一遍，
// 看每一条"状态栏/开场白"类脚本渲染出来到底长什么样、有没有出问题。
//
// 用法：node _test/card-diag.mjs
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';
import fs from 'fs';
import RandExp from 'randexp';

const root = process.cwd();
const CARD_DIR = process.env.CARD_DIR || '/home/claude/work/cards2';
const files = fs.readdirSync(CARD_DIR).filter(f => f.endsWith('.json')).sort();

function sampleFor(findRegex) {
  // findRegex 可能是 /pat/flags 也可能是裸串
  const m = String(findRegex).match(/^\/([\s\S]*)\/([a-z]*)$/);
  const pattern = m ? m[1] : String(findRegex);
  const flags = (m ? m[2] : '').replace(/[gmy]/g, '');
  try {
    const re = new RegExp(pattern, flags);
    const rx = new RandExp(re);
    rx.max = 3;
    // ⚠️ 关键：只能限制"通配部分"生成的字符，绝对不能事后对整串做替换——
    // 事后替换会把正则里写死的 <status_panel> 这种标签一起改掉，样例就再也匹配不上了，
    // 于是所有脚本都报"正则没命中"，实际上是测试自己把样例弄坏了。
    // 这里改成收窄 randexp 的取值范围，让 . 和 [\s\S] 只生成安全的字母数字。
    rx.defaultRange.subtract(0, 65535);
    rx.defaultRange.add(97, 122);   // a-z
    rx.defaultRange.add(48, 57);    // 0-9
    return rx.gen();
  } catch (e) {
    return null;
  }
}

function selfMatches(findRegex, sample) {
  const m = String(findRegex).match(/^\/([\s\S]*)\/([a-z]*)$/);
  try {
    const re = new RegExp(m ? m[1] : String(findRegex), (m ? m[2] : '').replace(/g/g, ''));
    return re.test(sample);
  } catch (e) { return false; }
}

const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('frameattached', () => {});

await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={_d:{},setItem(k,v){this._d[k]=JSON.parse(JSON.stringify(v));return Promise.resolve(v)},getItem(k){return Promise.resolve(this._d[k]!==undefined?this._d[k]:null)},removeItem(k){delete this._d[k];return Promise.resolve()},config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));
// 卡片里的 @import url(fonts.googleapis...) 断网会拖很久，直接掐掉
await page.route('**fonts.googleapis.com**', r => r.abort());
await page.route('**fonts.gstatic.com**', r => r.abort());

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted === true, { timeout: 20000 });

// 先记下"干净页面"的基线：body 背景、app 容器宽度，用来检测卡片 CSS 有没有漏出来污染全局
const baseline = await page.evaluate(() => ({
  bodyBg: getComputedStyle(document.body).backgroundColor,
  bodyFont: getComputedStyle(document.body).fontFamily,
  bodyMargin: getComputedStyle(document.body).margin,
}));

const report = [];

for (const f of files) {
  const obj = JSON.parse(fs.readFileSync(path.join(CARD_DIR, f), 'utf-8'));
  const d = obj.data || obj;
  const scripts = (d.extensions && d.extensions.regex_scripts) || [];
  for (const rs of scripts) {
    if (rs.disabled) continue;
    // promptOnly 的脚本本来就只在"拼prompt发给AI"时生效，显示路径不动它是对的，不该算问题
    if (rs.promptOnly && !rs.markdownOnly) continue;
    const sample = sampleFor(rs.findRegex);
    if (!sample) {
      report.push({ card: d.name, script: rs.scriptName, verdict: 'SKIP', note: '无法生成样例' });
      continue;
    }
    // randexp 对带 \s+ / 反向引用 / 嵌套分组的复杂正则，生成的串经常连**原始正则自己**都匹配不上
    // （比如把 <DM\s+name= 生成成 <DMname=）。这种样例是测试的问题，测下去只会得到假的
    // "正则没命中"，必须先自检掉。
    if (!selfMatches(rs.findRegex, sample)) {
      report.push({ card: d.name, script: rs.scriptName, verdict: 'SKIP', note: '样例生成不合格' });
      continue;
    }
    const staged = await page.evaluate(({ rs, sample, baseline }) => {
      // 用 app 真正的导入映射，而不是测试里另写一份
      const mapped = mapStRegexScriptItem(rs);
      if (!mapped) return { verdict: 'MAPFAIL' };
      const charId = 90001;
      mapped.charScope = [String(charId)];
      // 每次只装这一条，避免多条互相干扰
      const saved = regexScripts.slice();
      regexScripts.length = 0;
      regexScripts.push(mapped);
      window.__diagRestore = () => { regexScripts.length = 0; saved.forEach(x => regexScripts.push(x)); };

      let out = {};
      try {
        // 走存档路径 + 渲染路径，跟续写工作台/小说章节里一模一样
        const afterSave = applyRegexScripts(sample, 'ai_output', charId);
        const html = renderMarkdownLite(afterSave, charId, 0);
        window.__diagMatched = (afterSave !== sample || html !== sample);
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:-9999px;top:0;width:390px;white-space:pre-wrap;';
        host.innerHTML = namespaceInjectedIds(html, 'diag');
        document.body.appendChild(host);
        if (typeof mountFrontendFrames === 'function') mountFrontendFrames(host);
        if (typeof pruneCardWhitespace === 'function') pruneCardWhitespace(host);
        window.__diagHost = host;

        return { staged: true };
      } catch (e) { return { verdict: 'THROW', note: e.message }; }
    }, { rs, sample, baseline });

    if (staged && staged.staged) {
      // iframe 里的内容是异步渲染的（样式、图片、卡片自己的脚本都要跑），
      // 高度是量完之后 postMessage 报上来的，必须等一等再看
      await page.waitForTimeout(1200);
    }
    const r = staged && staged.staged ? await page.evaluate(({ baseline, emptyRepl }) => {
      const host = window.__diagHost;
      let out = {};
      try {
        const rect = host.getBoundingClientRect();
        const els = host.querySelectorAll('*');
        const frames = host.querySelectorAll('iframe.gy-frontend-frame').length;
        // iframe 里的东西不算"漏进页面的"，只统计直接内联进来的
        const scriptTags = host.querySelectorAll('script').length;
        const styleTags = host.querySelectorAll('style').length;
        const strayTags = host.querySelectorAll('meta,title,link,head,body,html').length;
        const text = host.textContent || '';
        // 卡片源码有没有以裸文本的形式糊出来（说明正则没命中或者渲染坏了）
        const rawLeak = /<!DOCTYPE|<html|<\/style>|BLOCKPLACEHOLDER|```/i.test(text);
        // 全局污染检测：卡片带的 <style> 是不是把 app 自己的样式改掉了
        const now = {
          bodyBg: getComputedStyle(document.body).backgroundColor,
          bodyFont: getComputedStyle(document.body).fontFamily,
          bodyMargin: getComputedStyle(document.body).margin,
        };
        const polluted = Object.keys(baseline).filter(k => now[k] !== baseline[k]);

        out = {
          verdict: 'OK',
          matched: window.__diagMatched,
          h: Math.round(rect.height),
          elCount: els.length,
          frames,
          scriptTags, styleTags, strayTags,
          rawLeak,
          polluted,
          textHead: text.replace(/\s+/g, ' ').trim().slice(0, 80),
        };
        // iframe 里量出来的真实内容高度，用来确认自动撑高这条链路是通的
        const fr = host.querySelector('iframe.gy-frontend-frame');
        if (fr) {
          try { out.innerH = fr.contentDocument ? fr.contentDocument.body.scrollHeight : null; } catch (e) { out.innerH = 'x-origin'; }
          out.frameH = Math.round(fr.getBoundingClientRect().height);
        }
        out.emptyRepl = emptyRepl;
        host.remove();
        const after = getComputedStyle(document.body).backgroundColor;
        out.stickyPollution = after !== baseline.bodyBg;
      } catch (e) {
        out = { verdict: 'THROW', note: e.message };
      }
      window.__diagRestore && window.__diagRestore();
      return out;
    }, { baseline, emptyRepl: !(rs.replaceString || '').trim() }) : staged;
    if (r) r.bigCard = (rs.replaceString || '').length > 5000;

    report.push({ card: d.name, script: rs.scriptName, ...r });
  }
}

await browser.close();

// ---- 输出 ----
let bad = 0;
const line = (s) => console.log(s);
line('');
line('角色卡状态栏渲染诊断');
line('='.repeat(100));
let lastCard = '';
for (const r of report) {
  if (r.card !== lastCard) { line(''); line('■ ' + r.card); lastCard = r.card; }
  const flags = [];
  if (r.verdict !== 'OK') flags.push(r.verdict + (r.note ? '(' + r.note + ')' : ''));
  if (r.verdict === 'OK') {
    if (!r.matched) flags.push('❌正则没命中');
    if (r.rawLeak) flags.push('❌源码裸露');
    if (r.strayTags) flags.push(`❌残留${r.strayTags}个meta/title/link`);
    if (r.scriptTags) flags.push(`⚠️${r.scriptTags}个<script>不会执行`);
    if (r.frames) flags.push(`📦iframe ${r.frameH}px`);
    if (r.polluted && r.polluted.length) flags.push('❌污染全局:' + r.polluted.join(','));
    if (r.stickyPollution) flags.push('❌污染残留');
    if (r.h === 0 && !r.emptyRepl) flags.push('❌高度0');
    // 高度只要不是卡在 CSS 那个初始值上，就说明"量高度并报上来"这条链路是通的。
    // 卡片本身内容少（浮动按钮、字段没填满的状态栏）渲染得矮，那是卡片自己的事。
    if (r.frames && r.frameH != null && r.frameH === 60) flags.push('❌高度没报上来');
  }
  const realBad = flags.some(f => f[0] === '✗' || f[0] === '❌' || f[0] === '⚠');
  if (realBad) bad++;
  line(`   ${realBad ? '✗' : '✓'} ${String(r.script || '').slice(0, 32).padEnd(34)} h=${String(r.h ?? '-').padStart(5)} el=${String(r.elCount ?? '-').padStart(4)}  ${flags.join(' ')}`);
}
line('');
line('='.repeat(100));
line(`共 ${report.length} 条脚本，${bad} 条有问题`);
if (pageErrors.length) { line('页面报错:'); pageErrors.slice(0, 5).forEach(e => line('  ' + e)); }
