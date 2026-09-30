// 🎲 自主模式能做的事：各个小功能都接上了（看电影 / 读书 / 游戏 / 转账 / 外卖 / 商城 / 照片 / 自己听歌看剧…）
import { chromium } from 'playwright';
import { launchBrowser, fileUrl } from './_launch.mjs';
import path from 'path';

const root = process.cwd();
const browser = await launchBrowser(chromium);
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('dialog', d => d.accept());
let DECIDE = { plan: [], nextIn: 60 };
const prompts = [];
await page.route(/^https?:\/\//, async r => {
  const u = r.request().url();
  if (!/chat\/completions/.test(u)) return r.abort();
  let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
  const all = JSON.stringify(body.messages || body.prompt || '');
  prompts.push(all);
  const content = all.includes('【你能做的事】') ? JSON.stringify(DECIDE) : 'NO';
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
});
const results = [];
const check = (n, ok, extra = '') => results.push({ n, ok: !!ok, extra });

await page.goto(fileUrl(path.join(root, 'index.html')));
await page.waitForFunction(() => window.__guyuBooted && window.GY_MORE_ACTS && GY_AUTONOMY_ACTIONS.some(a => a.key === 'phone_peek') && GY_AUTONOMY_ACTIONS.some(a => a.key === 'dress_change'), { timeout: 20000 });
await page.waitForTimeout(1000);
await page.evaluate(() => {
  myApiKey = 'sk-test'; myApiUrl = 'https://api.test.local/v1'; myModel = 'm';
  myCharacters.length = 0;
  myCharacters.push({ id: 8201, name: '沈之遥', handle: '@shen', persona: '旧书店老板', worldbooks: [], actMode: 'auto' });
  setAutoFeature('charAutonomy', true, true);
});

// ---------- 一、都接进了自主模式 ----------
const keys = await page.evaluate(() => GY_AUTONOMY_ACTIONS.map(a => a.key));
const want = ['film_invite', 'read_invite', 'game_invite', 'money_user', 'takeout_user', 'gift_user', 'photo_user', 'shop_self', 'sell_self', 'takeout_self', 'listen_self', 'watch_self', 'read_self', 'play_self'];
check('新接上的事都在自主模式的动作表里', want.every(k => keys.includes(k)), want.filter(k => !keys.includes(k)).join(' '));
check('原来就有的（听歌邀请 / 约出去 / 打电话 / 换装 / 上网 / 群聊…）也还在', ['music_invite', 'invite_user', 'call_invite', 'dress_change', 'web_explore', 'group_talk', 'diary', 'letter'].every(k => keys.includes(k)));
check('「什么都不做」还在', keys.includes('nothing'));

// 开关没开的不摆上桌；开了就摆上
await page.evaluate(() => { setAutoFeature('walletOn', false, true); setAutoFeature('takeoutOn', false, true); });
let rows = await page.evaluate(() => (gyTaRhythm(myCharacters[0]) || []).map(r => r.gk));
check('钱包 / 外卖没开：转账、点外卖的卡不出现', !rows.includes('act:money_user') && !rows.includes('act:takeout_user') && !rows.includes('act:takeout_self'), rows.join(' '));
await page.evaluate(() => { setAutoFeature('walletOn', true, true); setAutoFeature('takeoutOn', true, true); });
rows = await page.evaluate(() => (gyTaRhythm(myCharacters[0]) || []).map(r => r.gk));
check('钱包开了：出现「给你转账」', rows.includes('act:money_user'), rows.join(' '));
check('自己听歌 / 看剧 / 看书 / 打游戏都有卡', ['listen_self', 'watch_self', 'read_self', 'play_self'].every(k => rows.includes('act:' + k)));
check('约你看电影 / 读书都有卡', rows.includes('act:film_invite') && rows.includes('act:read_invite'));
const games = await page.evaluate(() => (typeof registeredMiniGames !== 'undefined' ? registeredMiniGames : []).map(g => g.name));
if (games.length) check('装了小游戏：有「约你玩游戏」的卡', rows.includes('act:game_invite'), games.join('/'));

// 分组
await page.evaluate(() => { gyTodaySet(true); document.querySelectorAll('#gyToday details').forEach(d => d.open = true); });
const html = await page.evaluate(() => { gyTodayRender(); return document.getElementById('gyToday').innerHTML; });
check('时间管理大师按「冲着你的 / 自己的日子」分组', html.includes('冲着你的') && html.includes('自己的日子'));
check('卡片上有新名字（约你看电影、自己听歌）', html.includes('约你看电影') && html.includes('自己听歌'));

// ---------- 二、真的做得成 ----------
DECIDE = { plan: [
  { action: 'film_invite', after: 0, reason: '想跟你看', param: '海上钢琴师' },
  { action: 'listen_self', after: 0, reason: '下雨了', param: '晴天' }
], nextIn: 90 };
const r = await page.evaluate(async () => { const r = await runAutonomyTurn(myCharacters[0], true); return { n: (r.entries || []).length, res: (r.entries || []).map(e => e.result) }; });
const p1 = prompts.filter(p => p.includes('【你能做的事】')).slice(-1)[0] || '';
check('决策菜单里有这些事', p1.includes('film_invite') && p1.includes('listen_self') && p1.includes('takeout_self'));
check('两件都做了', r.n === 2, JSON.stringify(r));
check('约看电影：私聊里真的发了邀请卡', await page.evaluate(() => (globalChats['8201'] || globalChats[8201] || []).some(m => m.invite && m.invite.kind === 'film' && m.invite.title === '海上钢琴师')));
check('自己听歌：状态变成在听「晴天」', await page.evaluate(() => (myCharacters[0].lifeState || {}).activity === '在听「晴天」'), await page.evaluate(() => JSON.stringify(myCharacters[0].lifeState)));

// 给自己点外卖：不往你们的聊天里插"给你点了外卖"
const shops = await page.evaluate(() => { try { return window.gytoCharOrder ? true : false; } catch (e) { return false; } });
if (shops) {
  const before = await page.evaluate(() => (globalChats['8201'] || []).length);
  const o = await page.evaluate(async () => await window.gytoCharOrder(8201, '', true));
  if (o) {
    const after = await page.evaluate(() => (globalChats['8201'] || []).length);
    check('给自己点外卖：不往你们的聊天里插"给你点了外卖"', after === before, before + '→' + after);
  }
}

check('整个过程没有页面报错', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));
await browser.close();
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  ✅' : '  ❌') + ' ' + r.n + (r.ok ? '' : '\n       → ' + r.extra)));
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' 通过');
process.exit(bad.length ? 1 : 0);
