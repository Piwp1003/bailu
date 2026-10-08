/* 📸 TA 的相册：把聊天里 TA 发过的照片、画给你的涂鸦、寄来的明信片按月份收成一本相册（原来散在聊天记录里）；TA 还会主动拍一张生活碎片发给你——发图走原来的「角色发图」，不另造 */
if (window.__gyxAlbum) return; window.__gyxAlbum = 1;
X.feat('gyxAlbum', { n: '📸 TA 的相册', desc: 'TA 发的照片自动收进相册，TA 还会拍生活碎片' });
const S = X.store('album');
let D = { snaps: [], cfg: { per: 25 } };   // snaps: {id, cid, at, desc, cap, src, emo, bg}
const BGS = [['#ffd6a5', '#fdffb6'], ['#caffbf', '#9bf6ff'], ['#a0c4ff', '#bdb2ff'], ['#ffc6ff', '#fffffc'], ['#f4a261', '#e9c46a'], ['#264653', '#2a9d8f'], ['#1d3557', '#457b9d']];
const IDEA = [['傍晚的天', '🌇☁️'], ['路过的一只猫', '🐈🌿'], ['今天的咖啡', '☕📖'], ['下雨的窗', '🌧️🪟'], ['晚饭', '🍜🥢'], ['加班的桌子', '💻🌙'], ['路边的花', '🌼🌱'], ['地铁上的风景', '🚇🌆'], ['街角的灯', '💡🌃'], ['今天的月亮', '🌙✨']];
async function snap(c) {
    let j;
    if (X.bailu()) { const [d, e] = X.pick(IDEA); j = { desc: d, cap: X.cards(['相册', '聊天'], c, 1)[0] || d, emo: e }; }
    else j = X.json(await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 10)}\n\n你今天随手拍了一张生活里的照片，想放进给她看的相册。拍的是什么（符合你的身份和今天的生活，具体一点）？配一句话。\n只输出 JSON：{"desc":"照片内容（15 字以内，用来生成图片）","cap":"配的一句话","emo":"两个最能代表画面的 emoji"}`)) || { desc: X.pick(IDEA)[0], cap: '今天也想分享给你', emo: '📷✨' };
    let src = '', core = false;
    // 原项目有「角色发图」（js/42）就走它：照片卡片、生图/图库/搜图、形象词、开关和频率都跟原来一样，不另造一套
    try { if (window.gyPhotoFromReply && (!window.gyPhotoModeOf || window.gyPhotoModeOf(c.id) !== 'off')) { X.say(c, `📸 ${j.cap || ''}`); core = !!(await window.gyPhotoFromReply(c.id, c.id, j.desc, false)); } } catch (e) {}
    if (!core) { try { if (window.gyPhotoGet) { const g = await window.gyPhotoGet(c.id, j.desc, false); src = g && g.src || ''; } } catch (e) {} }
    const it = { id: 'sn' + Date.now(), cid: String(c.id), at: Date.now(), desc: String(j.desc || ''), cap: String(j.cap || ''), src, emo: String(j.emo || '📷'), bg: X.pick(BGS), core };
    D.snaps.unshift(it); await S.set('d', D);
    if (!core) X.say(c, `📸 ${it.cap}`, src ? { mediaUrl: src } : {});
    return it;
}
window.gyxAlbumSnap = id => snap(X.char(id) || X.cur());
// 相册里的所有东西：聊天里 TA 发的图 + 生活碎片 + 涂鸦 + 明信片
async function items(cid) {
    const out = [];
    const H = (typeof globalChats !== 'undefined' && globalChats[cid]) || [];
    H.forEach(m => { if (String(m.sender) !== String(cid)) return; if (m.type === 'photo' && m.photo) out.push({ k: 'photo', at: m.timestamp, src: m.photo.src || '', cap: m.photo.desc || '', emo: '📷' }); else if (m.mediaUrl && !/^\[涂鸦\]/.test(m.text || '') && !m.gyx) out.push({ k: 'chat', at: m.timestamp, src: m.mediaUrl, cap: X.plain(m.text).slice(0, 40) }); });
    D.snaps.filter(s => s.cid === cid && !s.core).forEach(s => out.push({ k: 'snap', at: s.at, src: s.src, cap: s.cap, desc: s.desc, emo: s.emo, bg: s.bg }));
    try { const G = await X.store('doodle').get('g', []); G.filter(g => g.cid === cid && g.by !== 'me').forEach(g => out.push({ k: 'doodle', at: g.at, src: g.src, cap: '画给你的：' + (g.title || '') })); } catch (e) {}
    try { const P = window.gyxPostData && window.gyxPostData(); (P && P.list || []).filter(p => p.cid === cid && p.arrived).forEach(p => out.push({ k: 'post', at: p.at, src: '', cap: '明信片 · ' + p.place, emo: '🏞️', bg: ['#a0c4ff', '#caffbf'] })); } catch (e) {}
    return out.sort((a, b) => b.at - a.at);
}
window.gyxAlbumOpen = async function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), L = await items(cid);
    const byM = {}; L.forEach(x => { const d = new Date(x.at), k = d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月'; (byM[k] = byM[k] || []).push(x); });
    window.__gyxAlbumL = L;
    X.panel('gyxAlOv', `📸 ${X.esc(X.name(c))} 的相册`, `<div class="gyx-row">${X.whoSel(cid, 'gyxAlbumOpen')}<span class="gyx-tip">${L.length} 张</span><button class="gyx-btn lite" style="margin-left:auto" onclick="this.disabled=true;this.textContent='TA 在拍……';gyxAlbumSnap('${cid}').then(()=>gyxAlbumOpen('${cid}'))">让 TA 拍一张</button></div>
        ${Object.entries(byM).map(([m, xs]) => `<div class="al-m">${m}</div><div class="al-grid">${xs.map(x => `<div class="al-it" onclick="gyxAlbumView(${L.indexOf(x)})">${x.src ? `<img src="${X.esc(x.src)}" loading="lazy">` : `<div class="al-ph" style="background:linear-gradient(135deg,${(x.bg || BGS[0]).join(',')})"><span>${X.esc(x.emo || '📷')}</span><em>${X.esc(x.desc || '')}</em></div>`}<i>${{ photo: '📷', chat: '💬', snap: '✨', doodle: '🎨', post: '🏞️' }[x.k]}</i></div>`).join('')}</div>`).join('') || '<div class="gyx-tip">相册还是空的。TA 发照片、画画、寄明信片都会自动收进来。</div>'}
        <div class="gyx-row gyx-tip">默认模式的 TA 每天有 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.per}" style="width:60px" onchange="gyxAlbumCfg(+this.value)">% 的可能拍一张生活碎片；自主模式的 TA 自己决定。</div>`);
};
window.gyxAlbumView = function (i) {
    const x = (window.__gyxAlbumL || [])[i]; if (!x) return;
    const ov = document.createElement('div'); ov.className = 'al-view'; ov.onclick = () => ov.remove();
    ov.innerHTML = `<div class="al-pol">${x.src ? `<img src="${X.esc(x.src)}">` : `<div class="al-ph big" style="background:linear-gradient(135deg,${(x.bg || BGS[0]).join(',')})"><span>${X.esc(x.emo || '📷')}</span><em>${X.esc(x.desc || '')}</em></div>`}<p class="gyx-hand">${X.esc(x.cap || '')}</p><small>${new Date(x.at).toLocaleString()}</small></div>`;
    document.body.appendChild(ov);
};
window.gyxAlbumCfg = v => { D.cfg.per = v; S.set('d', D); };
window.gyxAlbumData = () => D;
async function tick() { if (!X.on('gyxAlbum')) return; const k = X.day(); if (D.last === k) return; const h = new Date().getHours(); if (h < 10 || h > 21) return; D.last = k; await S.set('d', D); for (const c of X.chars()) { if (X.auto(c)) continue; if (Math.random() * 100 < (+D.cfg.per || 0)) { await snap(c); break; } } }
X.action({ key: 'gyx_album', label: '拍一张生活碎片放进给她的相册', hint: '今天看到的好看的东西', need: c => !D.snaps.some(s => s.cid === String(c.id) && X.day(new Date(s.at)) === X.day()), run: async c => (await snap(c)) ? '拍了一张生活碎片给你' : null }, 'gyxAlbum');
X.today(() => ({ title: '📸 相册', rows: D.snaps.filter(s => X.day(new Date(s.at)) === X.day()).map(s => ({ t: X.name(X.char(s.cid)), x: '拍了：' + X.esc(s.cap || s.desc), go: `gyxAlbumOpen('${s.cid}')` })) }), 'gyxAlbum');
X.widget('gyxAlbum', { n: 'TA 的相册', sizes: ['s', 'm'], tap: () => window.gyxAlbumOpen(), r: () => { const s = D.snaps[0]; if (!s) return '<div class="gw-al"><b>📸</b><em>TA 的相册</em></div>'; return `<div class="gw-al">${s.src ? `<img src="${X.esc(s.src)}">` : `<div class="al-ph" style="background:linear-gradient(135deg,${s.bg.join(',')})"><span>${X.esc(s.emo)}</span></div>`}<em>${X.esc(s.cap)}</em></div>`; } }, 'gyxAlbum');
X.css('gyxAlCss', `.al-m{font-size:13px;color:#8e8e93;margin:14px 0 6px}.al-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px}.al-it{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;cursor:pointer;background:#f2f2f4}.al-it img{width:100%;height:100%;object-fit:cover;display:block}.al-it>i{position:absolute;right:4px;bottom:4px;font-style:normal;font-size:12px;background:rgba(255,255,255,.8);border-radius:6px;padding:0 3px}
.al-ph{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.al-ph span{font-size:34px}.al-ph em{font-style:normal;font-size:11px;color:rgba(0,0,0,.55);padding:0 6px}.al-ph.big{aspect-ratio:1}.al-ph.big span{font-size:80px}.al-ph.big em{font-size:14px}
.al-view{position:fixed;inset:0;z-index:100006;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px}.al-pol{background:#fff;padding:14px 14px 18px;width:min(420px,90vw);box-shadow:0 20px 50px rgba(0,0,0,.4);transform:rotate(-1.5deg);animation:giPol .6s both}.al-pol img{width:100%;display:block}.al-pol p{font-size:20px;margin:12px 0 4px;color:#3b3024}.al-pol small{color:#aaa}
@keyframes giPol{from{opacity:0;transform:translateY(-40px) rotate(6deg)}to{opacity:1;transform:rotate(-1.5deg)}}
.gw-al{height:100%;display:flex;flex-direction:column;gap:4px}.gw-al img,.gw-al .al-ph{flex:1;min-height:0;width:100%;object-fit:cover;border-radius:12px}.gw-al em{font-style:normal;font-size:11.5px;color:var(--pm-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gw-al b{font-size:34px;font-weight:normal;text-align:center}`);
X.mini({ id: 'gyxAlbum', icon: '📸', title: 'TA 的相册', desc: 'TA 发的照片、涂鸦、明信片都收在这；TA 还会拍生活碎片', onOpen: () => window.gyxAlbumOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.snaps = D.snaps || []; D.cfg = Object.assign({ per: 25 }, D.cfg || {}); setTimeout(tick, 25000); setInterval(tick, 30 * 60000); })();
X.memArr({ k: 'gyxAlbum', ico: '📸', n: 'TA 分享的生活碎片', d: '拍下来给你看的', arr: () => D.snaps, text: x => x.cap || x.desc, field: 'cap', meta: x => new Date(x.at).toLocaleString(), save: () => S.set('d', D) }, 'gyxAlbum');
