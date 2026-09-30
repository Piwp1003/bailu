// 量「对面一发消息就卡住打不了字」到底卡在哪：把主线程被占住的时间直接测出来。
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('dialog', d => d.accept());

await page.route(/^https?:\/\//, r => r.abort());
// 真 IndexedDB：结构化克隆的开销必须算进来，用内存桩会把问题测没了
await page.route('**/localforage*.js', r => r.fulfill({
  contentType: 'application/javascript',
  body: `window.localforage={
    _db:null,
    _open(){ if(this._db) return this._db; this._db=new Promise((res,rej)=>{const q=indexedDB.open('gyTest',1);
      q.onupgradeneeded=()=>q.result.createObjectStore('kv');q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);}); return this._db; },
    async setItem(k,v){const db=await this._open();return new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');
      t.objectStore('kv').put(v,k);t.oncomplete=()=>res(v);t.onerror=()=>rej(t.error);});},
    async getItem(k){const db=await this._open();return new Promise((res,rej)=>{const t=db.transaction('kv','readonly');
      const q=t.objectStore('kv').get(k);q.onsuccess=()=>res(q.result===undefined?null:q.result);q.onerror=()=>rej(q.error);});},
    async removeItem(k){const db=await this._open();return new Promise(res=>{const t=db.transaction('kv','readwrite');
      t.objectStore('kv').delete(k);t.oncomplete=()=>res();});},
    config(){}};`
}));
await page.route('**/mammoth*.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.mammoth={};' }));

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => typeof window.saveAllData === 'function', { timeout: 15000 });
await page.waitForTimeout(500);

// 造一份「真实体量」的存档：表情包是 base64，最占地方，正好是结构化克隆最慢的部分
const size = await page.evaluate(() => {
  const blob = 'data:image/png;base64,' + 'A'.repeat(120 * 1024); // 单张 ~120KB
  globalEmoticons.length = 0;
  for (let i = 0; i < 30; i++) globalEmoticons.push({ id: 'emo_' + i, url: blob, desc: '表情' + i });
  myCharacters.length = 0;
  for (let i = 0; i < 8; i++) myCharacters.push({ id: 9000 + i, name: '角色' + i, persona: '设定'.repeat(200), avatarImg: blob, worldbooks: [] });
  myApiUrl = 'https://api.test.local/v1'; myApiKey = 'sk-test'; myModel = 'gpt-test';
  globalChats['9000'] = [];
  for (let i = 0; i < 120; i++) {
    globalChats['9000'].push({ sender: i % 2 ? 'me' : 9000, text: '消息内容'.repeat(20), timestamp: Date.now() - (120 - i) * 60000, readBy: ['me'] });
  }
  switchMainView('chat'); switchChatSession('9000');
  return JSON.stringify(getFullDataSnapshot()).length;
});
console.log('  存档体量约 ' + (size / 1024 / 1024).toFixed(1) + ' MB');
await page.waitForTimeout(600);

// 主线程阻塞测量：每 10ms 打一次点，看最长的一次间隔有多久没打上
async function measureBlocking(action) {
  await page.evaluate(() => {
    window.__gaps = []; window.__last = performance.now();
    window.__tick = setInterval(() => { const n = performance.now(); window.__gaps.push(n - window.__last); window.__last = n; }, 10);
  });
  await page.waitForTimeout(120);
  await action();
  await page.waitForTimeout(1200);
  return await page.evaluate(() => { clearInterval(window.__tick); return Math.round(Math.max(...window.__gaps)); });
}

// 场景 A：对面连发 3 条（模型一次返回 3 条 replies，就是截图里那种）
const gapA = await measureBlocking(async () => {
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) {
      globalChats['9000'].push({ sender: 9000, text: '刚做好饭，要过来吗？' + i, timestamp: Date.now(), readBy: [] });
      renderChatMessages();
      saveAllData();
    }
  });
});
console.log('  【对面连发3条】主线程最长卡住 ' + gapA + ' ms');

// 场景 B：一屏 60 条未读（导入备份之后就是这个情形）
const gapB = await measureBlocking(async () => {
  await page.evaluate(() => {
    for (let i = 0; i < 60; i++) {
      globalChats['9000'].push({ sender: 9000, text: '未读消息 ' + i, timestamp: Date.now(), readBy: [] });
    }
    renderChatMessages();
  });
});
console.log('  【60条未读渲染一次】主线程最长卡住 ' + gapB + ' ms');

// 场景 C：只调一次 saveAllData 的基准开销
const gapC = await measureBlocking(async () => { await page.evaluate(() => saveAllData()); });
console.log('  【单次 saveAllData】主线程最长卡住 ' + gapC + ' ms');

await browser.close();
const worst = Math.max(gapA, gapB, gapC);
console.log('\n  最坏情况 ' + worst + ' ms' + (worst > 300 ? '  ❌ 这段时间里键盘输入是丢的' : '  ✅ 感知不到'));
process.exit(worst > 300 ? 1 : 0);
