/* 📲 手机桌面小组件：把项目里的小组件（TA 的心情、每日一问、等级、倒数日、星图……）放到你真手机的桌面上——安卓装一个「谷雨小组件」小 App，谷雨把数据推给它；苹果用免费的 Scriptable App，经过你自己的小中转站去读。点桌面上的卡片会打开谷雨并直接跳到那个功能。TA 还能在你桌面上留言 */
if (window.__gyxPhoneW) return; window.__gyxPhoneW = 1;
X.feat('gyxPhoneW', { n: '📲 手机桌面小组件', desc: '把小组件放到真手机桌面：安卓用「谷雨小组件」App，苹果用 Scriptable' });
const S = X.store('phonew');
const APPN = () => window.GY_APP_NAME || '谷雨';
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
let D = { cfg: { off: {}, theme: 'light', every: 15, relay: '', token: '', web: '' }, msgs: [], last: 0, lastErr: '', lastN: 0 };
const hm = ts => { const t = new Date(ts); return ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2); };
const isAndroidApp = () => !!(window.plus && plus.android);
// 把一个小组件的 HTML 读成纯文字：图标、标题、几行字
function textOf(k, def) {
    let h = ''; try { h = def.r({ k, id: 'gyxpw_' + k, size: 'm', d: {} }) || ''; } catch (e) { return null; }
    if (!h || /关着）/.test(h)) return null;
    const box = document.createElement('div'); box.innerHTML = h;
    const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
    let ico = clean((box.querySelector('.h b') || box.querySelector('b') || {}).textContent); if (ico.length > 4) ico = '';
    const title = clean((box.querySelector('.h span') || {}).textContent) || def.n || k;
    let lines = [...box.querySelectorAll('em')].map(e => clean(e.textContent)).filter(Boolean);
    if (!lines.length) { const t = clean(box.textContent).replace(title, '').replace(ico, '').trim(); if (t) lines = [t]; }
    lines = lines.slice(0, 3).map(l => l.slice(0, 40));
    if (!lines.length) return null;
    return { k, ico: ico || '🌸', n: title.slice(0, 16), lines };
}
function collect() {
    const W = window.__gyPmW, out = [];
    if (D.msgs[0]) { const m = D.msgs[0], c = X.char(m.cid); out.push({ k: 'gyxTaMsg', ico: '💌', n: X.name(c) + ' 的留言', lines: [m.text.slice(0, 40), new Date(m.at).toLocaleString().slice(5, -3)] }); }
    if (W && W.WD) Object.keys(W.WD).forEach(k => { if (D.cfg.off[k] || k === 'gyxPhoneWW') return; const t = textOf(k, W.WD[k]); if (t) out.push(t); });
    return out;
}
async function push(why) {
    if (!X.on('gyxPhoneW')) return null;
    const cards = collect(), data = { app: APPN(), at: Date.now(), theme: D.cfg.theme, cards, web: D.cfg.web || (location.protocol.startsWith('http') ? location.origin + location.pathname : '') };
    let ok = [], err = [];
    if (isAndroidApp()) {
        try { const main = plus.android.runtimeMainActivity(); data.pkg = main.getPackageName(); const Intent = plus.android.importClass('android.content.Intent'); const it = new Intent('com.guyu.widget.UPDATE'); it.setPackage('com.guyu.widget'); it.putExtra('data', JSON.stringify(data)); main.sendBroadcast(it); ok.push('安卓'); } catch (e) { err.push('安卓：' + (e.message || e)); }
    }
    if (D.cfg.relay && D.cfg.token) {
        try { const r = await fetch(D.cfg.relay.replace(/\/+$/, '') + '/w/' + D.cfg.token, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (r.ok) ok.push('中转站'); else err.push('中转站：HTTP ' + r.status); } catch (e) { err.push('中转站：' + (e.message || e)); }
    }
    D.last = Date.now(); D.lastN = cards.length; D.lastOk = ok.join('、'); D.lastErr = err.join('；'); await S.set('d', D);
    return { n: cards.length, ok, err, data };
}
window.gyxPhoneWPush = async () => { const r = await push('手动'); X.toast(r && r.ok.length ? `📲 同步好了（${r.n} 张卡片 → ${r.ok.join('、')}）` : '📲 没同步出去', r && r.err.length ? r.err.join('；') : (isAndroidApp() || D.cfg.relay ? '' : '这里既不是安卓 App，也没填中转站地址')); if (document.getElementById('gyxPwOv')) window.gyxPhoneWOpen(); return r; };
window.gyxPhoneWCollect = collect;
// 从桌面点进来：打开对应的功能
let pending = null;
function openKey(k, tries) {
    if (!k) return; tries = tries || 0;
    if (k === 'gyxTaMsg') { window.gyxPhoneWOpen('msg'); return; }
    const W = window.__gyPmW, def = W && W.WD && W.WD[k];
    if (!def) { if (tries < 40) setTimeout(() => openKey(k, tries + 1), 500); return; }
    try { if (def.tap) def.tap({ k, id: 'gyxpw_' + k, size: 'm', d: {} }); else X.toast('📲 ' + (def.n || k), '这个小组件没有可以打开的页面'); } catch (e) {}
}
window.gyxPhoneWOpenKey = openKey;
window.gyxPhoneWReadLaunch = readLaunch;
function readLaunch() {
    try { const u = new URL(location.href), k = u.searchParams.get('open'); if (k) { u.searchParams.delete('open'); history.replaceState(null, '', u.toString()); openKey(k); return; } } catch (e) {}
    if (!isAndroidApp()) return;
    try { const a = plus.runtime.arguments; if (a) { let k = null; try { k = JSON.parse(a).gyx_open; } catch (e) {} if (k) { plus.runtime.arguments = ''; openKey(k); return; } } } catch (e) {}
    try { const main = plus.android.runtimeMainActivity(), it = main.getIntent(), k = it && it.getStringExtra('gyx_open'); if (k) { it.removeExtra('gyx_open'); it.removeExtra('arguments'); openKey(k); } } catch (e) {}
}
function scriptable() {
    const relay = (D.cfg.relay || '').replace(/\/+$/, ''), web = D.cfg.web || (location.protocol.startsWith('http') ? location.origin + location.pathname : '');
    return `// ${APPN()} · 桌面小组件（Scriptable 用）
// 1. App Store 装「Scriptable」→ 右上角 ＋ 新建脚本 → 把这整段粘进去，名字随便起
// 2. 回桌面长按 → 左上角 ＋ → 找 Scriptable → 选大小 → 添加 → 长按小组件「编辑小组件」→ Script 选这个脚本
// 3. Parameter（参数）可以填一张卡片的名字，比如：每日一问；空着就每次换一张；大号小组件会一次显示好几张
const RELAY = ${JSON.stringify(relay)}
const TOKEN = ${JSON.stringify(D.cfg.token || '')}
const WEB = ${JSON.stringify(web)}   // 点小组件打开的网址（你的${APPN()}网页版地址）
const THEMES = { light: ['#FFFFFF', '#1D1D1F', '#6E6E73'], dark: ['#1C1C1E', '#F5F5F7', '#A1A1A6'], pink: ['#FFF0F5', '#7A2948', '#B0647F'], cream: ['#FFF8EC', '#4A3A28', '#8A7660'], sky: ['#EEF5FF', '#1F3A5F', '#5B7699'] }
async function load() {
  const fm = FileManager.local(), cache = fm.joinPath(fm.documentsDirectory(), 'guyu-widget.json')
  try { const r = new Request(RELAY + '/w/' + TOKEN); r.timeoutInterval = 10; const d = await r.loadJSON(); if (d && d.cards) { fm.writeString(cache, JSON.stringify(d)); return d } } catch (e) {}
  try { return JSON.parse(fm.readString(cache)) } catch (e) { return { cards: [] } }
}
function pick(cards, want) {
  if (want) { const c = cards.find(x => x.n.includes(want) || x.k === want); if (c) return c }
  const slot = Math.floor(Date.now() / 1800000); return cards[slot % Math.max(1, cards.length)]
}
function card(w, c, T, big) {
  const h = w.addStack(); h.centerAlignContent()
  const i = h.addText(c.ico || '🌸'); i.font = Font.systemFont(big ? 20 : 16)
  h.addSpacer(6)
  const t = h.addText(c.n); t.font = Font.boldSystemFont(big ? 14 : 12); t.textColor = new Color(T[1]); t.lineLimit = 1
  w.addSpacer(big ? 8 : 3)
  ;(c.lines || []).slice(0, big ? 3 : 1).forEach((l, k) => { const x = w.addText(l); x.font = k === 0 ? Font.boldSystemFont(big ? 16 : 13) : Font.systemFont(13); x.textColor = new Color(k === 0 ? T[1] : T[2]); x.lineLimit = 2; w.addSpacer(2) })
}
const d = await load(), T = THEMES[d.theme] || THEMES.light, fam = config.widgetFamily || 'medium', want = (args.widgetParameter || '').trim()
const w = new ListWidget(); w.backgroundColor = new Color(T[0]); w.setPadding(14, 14, 12, 14)
if (!d.cards || !d.cards.length) { const t = w.addText('打开${APPN()}，在「📲 手机桌面小组件」里点「现在同步」'); t.textColor = new Color(T[2]); t.font = Font.systemFont(13) }
else if (fam === 'large' && !want) { d.cards.slice(0, 4).forEach((c, i) => { card(w, c, T, false); if (i < 3) w.addSpacer(10) }); w.url = WEB }
else { const c = pick(d.cards, want); card(w, c, T, fam !== 'small'); if (WEB) w.url = WEB + (WEB.includes('?') ? '&' : '?') + 'open=' + encodeURIComponent(c.k) }
w.addSpacer()
if (d.at) { const f = w.addText((t => ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2))(new Date(d.at)) + ' 同步'); f.font = Font.systemFont(9); f.textColor = new Color(T[2]); f.rightAlignText() }
w.refreshAfterDate = new Date(Date.now() + 15 * 60000)
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium()
Script.complete()
`;
}
const WORKER = `// 谷雨小组件中转站（Cloudflare Worker）
// 作用：网页版 / 苹果手机把小组件数据存在这里，Scriptable 小组件来读。数据只放一份最新的，不存聊天记录。
// 部署：Cloudflare 后台 → Workers 和 Pages → 创建 Worker → 把这整段粘进去部署
//      → 再建一个 KV 命名空间（名字随便），回到这个 Worker 的「设置 → 绑定」里添加 KV，变量名必须写 WIDGET
//      → 把 Worker 的网址（https://xxx.workers.dev）填进谷雨「📲 手机桌面小组件」的「中转站地址」
export default {
  async fetch(req, env) {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const m = new URL(req.url).pathname.match(/^\\/w\\/([A-Za-z0-9_-]{16,64})$/);
    if (!m) return new Response('谷雨小组件中转站在运行 ✓', { headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } });
    if (!env.WIDGET) return new Response('还没绑定 KV（变量名要叫 WIDGET）', { status: 500, headers: cors });
    const key = 'w:' + m[1];
    if (req.method === 'POST') {
      const body = await req.text();
      if (body.length > 300000) return new Response('太大了', { status: 413, headers: cors });
      try { JSON.parse(body); } catch (e) { return new Response('不是 JSON', { status: 400, headers: cors }); }
      await env.WIDGET.put(key, body, { expirationTtl: 60 * 60 * 24 * 30 });
      return new Response('ok', { headers: cors });
    }
    const v = await env.WIDGET.get(key);
    return new Response(v || '{"cards":[]}', { headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
};
`;
window.gyxPhoneWDownload = what => { try { if (what === 'scriptable') saveTextFileForApp(`${APPN()}桌面小组件-Scriptable.js`, scriptable(), 'text/javascript'); else saveTextFileForApp('谷雨小组件中转站-worker.js', WORKER, 'text/javascript'); } catch (e) { X.toast('📲 下载失败', String(e.message || e)); } };
window.gyxPhoneWCopy = async what => { const t = what === 'scriptable' ? scriptable() : WORKER; try { await navigator.clipboard.writeText(t); X.toast('📋 复制好了', what === 'scriptable' ? '去 Scriptable 新建脚本粘进去' : '去 Cloudflare 粘进 Worker'); } catch (e) { X.toast('📋 复制不了', '用「下载」吧'); } };
window.gyxPhoneWCfg = async (k, v) => { if (k === 'off') { D.cfg.off[v[0]] = !v[1]; } else D.cfg[k] = v; await S.set('d', D); if (k === 'theme' || k === 'off') push('设置'); };
window.gyxPhoneWScript = scriptable;
window.gyxPhoneWWorker = () => WORKER;
window.gyxPhoneWData = () => D;
async function taMsg(c) {
    let t = X.bailu() ? null : X.plain(await X.ask(`${X.who(c)}\n你可以在她手机桌面的小组件上留一句话，她每次解锁手机都会看到。写一句（20 字以内，像便利贴）。`) || '');
    t = (t || X.pick(X.cards(['情话', '字词'], c, 3).filter(x => x.length <= 24).concat(['今天也要好好吃饭。', '想你了，就这一句。', '解锁一次，想我一次。', '别熬夜，我盯着呢。']))).slice(0, 40);
    D.msgs.unshift({ id: 'pm' + Date.now().toString(36), cid: String(c.id), text: t, at: Date.now() }); D.msgs = D.msgs.slice(0, 100); await S.set('d', D); await push('留言'); return t;
}
window.gyxPhoneWMsg = async cid => { const c = X.char(cid) || X.cur(); const t = await taMsg(c); window.gyxPhoneWOpen('msg'); return t; };
window.gyxPhoneWOpen = function (tab) {
    tab = tab || 'main'; const cards = collect(), T = [['main', '同步'], ['cards', '卡片（' + cards.length + '）'], ['android', '🤖 安卓'], ['ios', '🍎 苹果'], ['msg', '💌 留言']];
    let body = '';
    if (tab === 'main') body = `<div class="pw-st"><div><b>${D.last ? '上次同步 ' + new Date(D.last).toLocaleString() : '还没同步过'}</b><span>${D.lastN ? D.lastN + ' 张卡片' : ''}${D.lastOk ? ' → ' + X.esc(D.lastOk) : ''}</span>${D.lastErr ? `<em>${X.esc(D.lastErr)}</em>` : ''}</div><button class="gyx-btn" onclick="this.disabled=true;gyxPhoneWPush()">现在同步</button></div>
        <div class="gyx-tip">${isAndroidApp() ? '✅ 你现在在安卓 App 里：装好「谷雨小组件」就能直接收到。' : '你现在在网页里：要填下面的「中转站地址」，苹果 / 网页才能同步出去。'}</div>
        <div class="gyx-row">卡片颜色 ${[['light', '白'], ['dark', '黑'], ['pink', '粉'], ['cream', '奶油'], ['sky', '天空']].map(([k, n]) => `<span class="gyx-chip${D.cfg.theme === k ? ' on' : ''}" onclick="gyxPhoneWCfg('theme','${k}');gyxPhoneWOpen()">${n}</span>`).join('')}</div>
        <div class="gyx-row gyx-tip">每 <input class="gyx-who" type="number" min="5" value="${D.cfg.every}" style="width:56px" onchange="gyxPhoneWCfg('every',+this.value)"> 分钟自动同步一次（切到后台时也会同步）</div>
        <div class="gyx-card"><div class="gyx-tip">中转站地址（苹果 / 网页版要用，安卓 App 不用填）</div><input class="gyx-in" placeholder="https://xxx.workers.dev" value="${X.esc(D.cfg.relay)}" onchange="gyxPhoneWCfg('relay',this.value.trim())"><div class="gyx-tip">口令（自动生成的，Scriptable 脚本里会带上）：<code>${X.esc(D.cfg.token)}</code> <a style="cursor:pointer;color:#1d9bf0" onclick="gyxPhoneWCfg('token','${rid()}');gyxPhoneWOpen()">换一个</a></div><div class="gyx-tip">点桌面小组件要打开的网址（网页版地址，空着就用现在这个）：</div><input class="gyx-in" placeholder="${X.esc(location.protocol.startsWith('http') ? location.origin + location.pathname : 'https://你的网页版地址/')}" value="${X.esc(D.cfg.web)}" onchange="gyxPhoneWCfg('web',this.value.trim())"></div>`;
    if (tab === 'cards') body = `<div class="gyx-tip">勾上的才会出现在手机桌面上（谷雨这边的小组件都能选）。</div>${(() => { const W = window.__gyPmW; const ks = W && W.WD ? Object.keys(W.WD).filter(k => k !== 'gyxPhoneWW') : []; const map = {}; cards.forEach(c => map[c.k] = c); return ks.map(k => { const c = map[k] || textOf(k, W.WD[k]); return `<label class="pw-c"><input type="checkbox" ${D.cfg.off[k] ? '' : 'checked'} onchange="gyxPhoneWCfg('off',['${k}',this.checked])"><span>${X.esc((c && c.ico) || '▫️')}</span><div><b>${X.esc((c && c.n) || W.WD[k].n || k)}</b><em>${c ? X.esc(c.lines.join(' · ')) : '（现在没内容）'}</em></div></label>`; }).join(''); })()}`;
    if (tab === 'android') body = `<ol class="pw-steps"><li>「谷雨小组件」是一个单独的小 App，源码在项目的 <b>手机桌面小组件/安卓App</b> 文件夹里。</li><li>把这个文件夹里的东西传到 GitHub 一个新仓库（网页上「Add file → Upload files」拖进去就行）。</li><li>再点仓库上方 <b>Actions</b> →「set up a workflow yourself」→ 把文件夹里 <b>自动打包配置.yml</b> 的内容整个粘进去 → Commit。</li><li>GitHub 就会自动打包：仓库页面 → <b>Actions</b> → 点最新那次 → 最下面 <b>Artifacts</b> 下载「谷雨小组件-apk」，解压出 .apk 传到手机安装。</li><li>打开谷雨 App → 这里点「现在同步」。</li><li>回到桌面，长按空白处 → 小组件 → 「谷雨小组件」拖出来，选要显示哪张（或者轮播）。可以放好几个，各显示各的。</li><li>点桌面上的卡片会打开谷雨，直接跳到那个功能。</li></ol><div class="gyx-tip">谷雨和白露都装了的话，两边的卡片都能选。只有打包好的安卓 App 能推给它；在手机浏览器里打开的网页版推不过去，那种情况用「苹果」那套中转站的方法。</div>`;
    if (tab === 'ios') body = `<ol class="pw-steps"><li><b>先搭一个中转站</b>（只要弄一次，免费）：Cloudflare 后台 → Workers 和 Pages → 创建 Worker，把下面的「中转站代码」粘进去部署；再建一个 KV，绑定到这个 Worker，变量名写 <code>WIDGET</code>。</li><li>把 Worker 的网址填进「同步」页的「中转站地址」，点「现在同步」。</li><li>iPhone 上 App Store 装 <b>Scriptable</b>（免费），新建脚本，把下面的「Scriptable 脚本」粘进去。</li><li>桌面长按 → 左上角 ＋ → Scriptable → 选大小添加 → 长按它「编辑小组件」→ Script 选刚才的脚本；Parameter 可以填卡片名（比如「每日一问」），空着就轮播，大号会一次显示四张。</li><li>点小组件会用 Safari 打开网页版，直接跳到那个功能。</li></ol>
        <div class="gyx-row"><button class="gyx-btn lite" onclick="gyxPhoneWCopy('worker')">复制中转站代码</button><button class="gyx-btn lite" onclick="gyxPhoneWDownload('worker')">下载</button></div>
        <div class="gyx-row"><button class="gyx-btn lite" onclick="gyxPhoneWCopy('scriptable')">复制 Scriptable 脚本</button><button class="gyx-btn lite" onclick="gyxPhoneWDownload('scriptable')">下载</button></div>
        <div class="gyx-tip">${D.cfg.relay ? '脚本里已经填好了你的中转站地址和口令。' : '⚠️ 先填中转站地址再复制脚本，不然脚本里是空的。'}苹果的小组件大概 15 分钟刷新一次（系统决定的，可能更久）。网页版只有打开着的时候才会同步。</div>`;
    if (tab === 'msg') { const c = X.cur(); body = `<div class="gyx-tip">TA 留在你手机桌面上的话（显示在「💌 TA 的留言」那张卡片上）。</div>${c ? `<button class="gyx-btn lite" onclick="this.disabled=true;gyxPhoneWMsg('${c.id}')">让 ${X.esc(X.name(c))} 留一句</button>` : ''}${D.msgs.slice(0, 30).map(m => `<div class="gyx-card"><b>${X.esc(m.text)}</b><div class="gyx-tip">${X.esc(X.name(X.char(m.cid)))} · ${new Date(m.at).toLocaleString()}</div></div>`).join('') || '<div class="gyx-tip">还没有留言</div>'}`; }
    X.panel('gyxPwOv', '📲 手机桌面小组件', `<div class="gyx-row">${T.map(([k, n]) => `<span class="gyx-chip${k === tab ? ' on' : ''}" onclick="gyxPhoneWOpen('${k}')">${n}</span>`).join('')}</div>${body}`);
};
X.ctx(id => { const m = D.msgs.find(x => x.cid === String(id) && Date.now() - x.at < 864e5); return m ? `【你在她手机桌面的小组件上留了一句话】「${m.text}」` : ''; }, 'gyxPhoneW');
X.action({ key: 'gyx_phonew', label: '在她手机桌面的小组件上留一句话', hint: '手机桌面小组件', need: c => (isAndroidApp() || !!D.cfg.relay) && !D.msgs.some(x => x.cid === String(c.id) && Date.now() - x.at < 864e5), run: async c => '在你手机桌面留了一句：' + (await taMsg(c)) }, 'gyxPhoneW');
X.today(() => ({ title: '📲 手机桌面小组件', rows: [{ t: D.last ? hm(D.last) : '没同步', x: D.last ? `${D.lastN} 张卡片${D.lastErr ? ' · 有问题' : ''}` : '放到真手机桌面上？', go: 'gyxPhoneWOpen()' }] }), 'gyxPhoneW');
X.widget('gyxPhoneWW', { n: '手机桌面同步', sizes: ['s', 'm'], tap: () => window.gyxPhoneWOpen(), r: w => X.gw(w, '📲', '手机桌面', [D.last ? hm(D.last) + ' 同步' : '还没同步', D.msgs[0] ? '💌 ' + X.esc(D.msgs[0].text) : '']) }, 'gyxPhoneW');
X.memArr({ k: 'gyxPhoneW', ico: '📲', n: '桌面留言', d: 'TA 留在你手机桌面小组件上的话', arr: () => D.msgs, field: 'text', text: x => x.text, save: () => S.set('d', D) }, 'gyxPhoneW');
X.css('gyxPwCss', `.pw-st{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:16px;background:#f4f7fb;margin:6px 0}.pw-st>div{flex:1}.pw-st b{display:block}.pw-st span{font-size:12px;color:#888}.pw-st em{display:block;font-style:normal;font-size:12px;color:#e5484d}.pw-c{display:flex;gap:10px;align-items:center;padding:7px 2px;border-bottom:1px solid #f2f2f2;cursor:pointer}.pw-c span{font-size:20px;width:26px;text-align:center}.pw-c div{flex:1;min-width:0}.pw-c em{display:block;font-style:normal;font-size:11.5px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pw-steps{padding-left:20px;line-height:1.8;font-size:14px}.pw-steps code,.gyx-tip code{background:#f2f2f4;padding:1px 6px;border-radius:6px;font-size:12px}`);
X.mini({ id: 'gyxPhoneW', icon: '📲', title: '手机桌面小组件', desc: '把小组件放到真手机的桌面上', cat: '生活', onOpen: () => window.gyxPhoneWOpen() });
(async () => {
    D = Object.assign(D, await S.get('d', {})); D.cfg = Object.assign({ off: {}, theme: 'light', every: 15, relay: '', token: '', web: '' }, D.cfg || {}); D.msgs = D.msgs || [];
    if (!D.cfg.token) { D.cfg.token = rid(); await S.set('d', D); }
    setTimeout(readLaunch, 1500);
    document.addEventListener('newintent', () => setTimeout(readLaunch, 300), false);
    document.addEventListener('resume', () => setTimeout(readLaunch, 300), false);
    document.addEventListener('visibilitychange', () => { if (document.hidden) push('后台'); });
    setTimeout(() => push('启动'), 25000);
    setInterval(() => { if (Date.now() - D.last >= Math.max(5, +D.cfg.every || 15) * 60000) push('定时'); }, 60000);
})();
