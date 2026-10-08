/* 💑 情侣头像：给你和 TA 做一对情侣头像——两张放在一起能拼成一个画面（半颗心、一人一半的月亮、同一片海……）。有生图就用原来「角色发图」里配好的生图（会带上 TA 的形象词），没有就用内置的画风现画；一键换上，随时换回原来的 */
if (window.__gyxAvatar) return; window.__gyxAvatar = 1;
X.feat('gyxAvatar', { n: '💑 情侣头像', desc: '给你和 TA 做一对能拼在一起的情侣头像，一键换上' });
const S = X.store('avatar');
let D = { list: [], backup: {}, cfg: {} };   // list: {id, cid, me, ta, theme, style, by, at, used}; backup[cid] = {me, ta}
const THEMES = [['heart', '💗 半颗心', ['#ff9a9e', '#fecfef']], ['moon', '🌙 日月', ['#2b3a67', '#f6d365']], ['sea', '🌊 同一片海', ['#89f7fe', '#66a6ff']], ['cat', '🐱 两只猫', ['#fbc2eb', '#a6c1ee']], ['star', '✨ 星星连线', ['#1e1b4b', '#6366f1']], ['flower', '🌷 一束花', ['#d4fc79', '#96e6a1']], ['umbrella', '☂️ 同一把伞', ['#a1c4fd', '#c2e9fb']], ['bubble', '💬 对话框', ['#ffecd2', '#fcb69f']]];
const STYLES = ['日系插画', '线稿', '水彩', '像素', 'Q 版', '赛璐璐'];
const PIC = { heart: ['💗', '💗'], moon: ['☀️', '🌙'], sea: ['🐚', '🐟'], cat: ['🐈', '🐈‍⬛'], star: ['⭐', '🌟'], flower: ['🌷', '🌼'], umbrella: ['☂️', '🌧️'], bubble: ['💬', '💭'] };
// 内置画法：同一张渐变底，各拿一半图案，两张并排刚好拼起来
function draw(theme, half, label) {
    const th = THEMES.find(t => t[0] === theme) || THEMES[0], [a, b] = th[2], cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
    const gr = g.createLinearGradient(half === 'l' ? 0 : -512, 0, half === 'l' ? 1024 : 512, 512); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    g.save(); g.translate(half === 'l' ? 512 : 0, 256);
    if (theme === 'heart') { g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(0, 150); g.bezierCurveTo(-260, -20, -150, -230, 0, -110); g.bezierCurveTo(150, -230, 260, -20, 0, 150); g.fill(); }
    else { g.font = '300px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(PIC[theme][half === 'l' ? 0 : 1], half === 'l' ? -240 : 240, 0); }
    g.restore();
    for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.2 + Math.random() * 0.5) + ')'; g.beginPath(); g.arc(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 5, 0, 7); g.fill(); }
    if (label) { g.fillStyle = 'rgba(255,255,255,.92)'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.fillText(label.slice(0, 6), 256, 470); }
    return cv.toDataURL('image/png');
}
async function gen(c, theme, style, by) {
    const th = THEMES.find(t => t[0] === theme) || THEMES[0];
    let me = '', ta = '';
    const canGen = !X.bailu() && window.gyPhotoGet && useGen();
    if (canGen) {
        const look = (window.gyPhotoLookOf && window.gyPhotoLookOf(c.id)) || '';
        const base = `情侣头像，${style}风格，主题「${th[1].replace(/^\S+\s/, '')}」，两张放在一起左右能拼成一个完整的画面，构图对称，头像用的正方形`;
        try { const a = await window.gyPhotoGet(c.id, base + '，左边这张：女生', false, 'gen'); me = a && a.src || ''; } catch (e) {}
        try { const b = await window.gyPhotoGet(c.id, base + '，右边这张' + (look ? '：' + look : ''), true, 'gen'); ta = b && b.src || ''; } catch (e) {}
    }
    if (!me || !ta) { me = draw(theme, 'l', ''); ta = draw(theme, 'r', ''); }
    const it = { id: 'av' + Date.now(), cid: String(c.id), me, ta, theme, style, by: by || 'me', at: Date.now(), used: false };
    D.list.unshift(it); D.list = D.list.slice(0, 30); await S.set('d', D); return it;
}
window.gyxAvatarGen = async function (cid, theme, style) {
    const c = X.char(cid || window.GYX_AV_WHO) || X.cur(); if (!c) return null;
    const b = document.getElementById('gyxAvGo'); if (b) { b.disabled = true; b.textContent = X.v('在画……', '画好马上给你看'); }
    const it = await gen(c, theme || window.GYX_AV_TH || 'heart', style || window.GYX_AV_ST || STYLES[0], 'me');
    window.gyxAvatarOpen(c.id); return it;
};
window.gyxAvatarUse = async function (id) {
    const it = D.list.find(x => x.id === id); if (!it) return; const c = X.char(it.cid); if (!c) return;
    if (!D.backup[it.cid]) D.backup[it.cid] = { me: (typeof currentUser !== 'undefined' && currentUser.avatarImg) || '', ta: c.avatarImg || '' };
    try { if (typeof currentUser !== 'undefined') currentUser.avatarImg = it.me; c.avatarImg = it.ta; if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
    D.list.forEach(x => x.used = x.id === id); await S.set('d', D);
    X.toast(X.v('换好啦', '情侣头像换上了', '现在是一对了'), X.v('聊天里看看', '去看看'));
    X.reach(c, '她刚刚把你们俩的头像换成了一对情侣头像，说说你看到时的反应');
    try { if (typeof renderChatMessages === 'function') renderChatMessages(); } catch (e) {} X.repaint(); window.gyxAvatarOpen(it.cid);
};
window.gyxAvatarBack = async function (cid) {
    const b = D.backup[cid], c = X.char(cid); if (!b || !c) return;
    try { if (typeof currentUser !== 'undefined') currentUser.avatarImg = b.me; c.avatarImg = b.ta; if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
    delete D.backup[cid]; D.list.forEach(x => { if (x.cid === cid) x.used = false; }); await S.set('d', D); X.toast(X.v('换回原来的了', '恢复好了')); window.gyxAvatarOpen(cid);
};
window.GYX_AV_WHO = ''; window.GYX_AV_TH = 'heart'; window.GYX_AV_ST = STYLES[0];
window.gyxAvatarWho = v => { window.gyxAvatarOpen(v); };
window.gyxAvatarOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id); window.GYX_AV_WHO = cid;
    const L = D.list.filter(x => x.cid === cid);
    X.panel('gyxAvOv', '💑 情侣头像', `<div class="gyx-row">${X.whoSel(cid, 'gyxAvatarWho')}</div>
        <div class="gyx-tip">选个主题</div><div class="gyx-row">${THEMES.map(t => `<span class="gyx-chip ${window.GYX_AV_TH === t[0] ? 'on' : ''}" onclick="GYX_AV_TH='${t[0]}';gyxAvatarOpen('${cid}')">${t[1]}</span>`).join('')}</div>
        <div class="gyx-tip">画风（有生图时才用得上）</div><div class="gyx-row">${STYLES.map(s => `<span class="gyx-chip ${window.GYX_AV_ST === s ? 'on' : ''}" onclick="GYX_AV_ST='${s}';gyxAvatarOpen('${cid}')">${s}</span>`).join('')}</div>
        ${X.bailu() ? '' : `<label class="gyx-row gyx-tip"><input type="checkbox" ${useGen() ? 'checked' : ''} onchange="gyxAvatarCfg(this.checked)"> 用生图画（走「角色发图」里配的画图接口，没配就用免费那档；不勾＝用内置画法，马上出来）</label>`}
        <div class="gyx-row"><button id="gyxAvGo" class="gyx-btn" onclick="gyxAvatarGen('${cid}')">做一对</button>${D.backup[cid] ? `<button class="gyx-btn lite" onclick="gyxAvatarBack('${cid}')">换回原来的头像</button>` : ''}</div>
        <div class="av-list">${L.map(x => `<div class="av-pair${x.used ? ' used' : ''}"><div class="av-two"><img src="${x.me}"><img src="${x.ta}"></div><div class="gyx-row"><span class="gyx-tip">${x.by === 'me' ? '你做的' : X.esc(X.name(c)) + ' 挑的'} · ${new Date(x.at).toLocaleDateString()}</span>${x.used ? '<b class="av-on">正在用</b>' : `<button class="gyx-btn lite" onclick="gyxAvatarUse('${x.id}')">换上</button>`}</div></div>`).join('') || '<div class="gyx-tip">还没做过。左边是你，右边是 TA，放在一起是一个画面。</div>'}</div>`);
};
window.gyxAvatarData = () => D;
function useGen() { if (D.cfg.gen != null) return D.cfg.gen; try { return window.gyPhotoCfg && window.gyPhotoCfg().mode === 'gen'; } catch (e) { return false; } }
window.gyxAvatarCfg = v => { D.cfg.gen = v; S.set('d', D); };
X.action({ key: 'gyx_avatar', label: '想和她换一对情侣头像，挑一对给她看', hint: '想让别人一看就知道你们是一对', need: c => !D.list.some(x => x.cid === String(c.id) && Date.now() - x.at < 7 * 86400000), run: async c => { const it = await gen(c, X.pick(THEMES)[0], X.pick(STYLES), String(c.id)); return (await X.reach(c, `你挑了一对情侣头像（主题：${(THEMES.find(t => t[0] === it.theme) || THEMES[0])[1]}）想和她换上，问问她喜不喜欢（在「情侣头像」里能看到、能一键换上）`)) ? '挑了一对情侣头像给你' : null; } }, 'gyxAvatar');
X.ctx(id => { const u = D.list.find(x => x.cid === String(id) && x.used); return u ? '【情侣头像】你们现在用的是一对情侣头像。' : ''; }, 'gyxAvatar');
X.today(() => ({ title: '💑 情侣头像', rows: D.list.filter(x => x.by !== 'me' && !x.used && Date.now() - x.at < 3 * 86400000).map(x => ({ t: '新的', x: `${X.esc(X.name(X.char(x.cid)))} 挑了一对情侣头像给你`, go: `gyxAvatarOpen('${x.cid}')` })) }), 'gyxAvatar');
X.widget('gyxAvatarW', { n: '情侣头像', sizes: ['s', 'm'], tap: () => window.gyxAvatarOpen(), r: w => { const x = D.list.find(i => i.used) || D.list[0]; if (!x) return X.gw(w, '💑', '情侣头像', ['做一对']); return `<div class="av-w"><img src="${x.me}"><img src="${x.ta}"></div>`; } }, 'gyxAvatar');
X.css('gyxAvCss', `.av-list{display:flex;flex-direction:column;gap:12px;margin-top:10px}.av-pair{padding:10px;border-radius:18px;background:#fafafa}.av-pair.used{background:#fff0f5}.av-two{display:flex;justify-content:center}.av-two img{width:42%;aspect-ratio:1;object-fit:cover;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.1)}.av-two img+img{margin-left:-4%}.av-on{color:#ff5c8a;font-size:13px;margin-left:auto}
.av-w{height:100%;display:flex;align-items:center;justify-content:center}.av-w img{height:80%;aspect-ratio:1;border-radius:50%;object-fit:cover;border:2px solid #fff}.av-w img+img{margin-left:-10%}`);
X.mini({ id: 'gyxAvatar', icon: '💑', title: '情侣头像', desc: '做一对能拼在一起的情侣头像，一键换上，随时换回', onOpen: () => window.gyxAvatarOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.list = D.list || []; D.backup = D.backup || {}; })();
