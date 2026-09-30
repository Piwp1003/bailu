/* 🎶 共享歌单：一张你们俩一起往里加歌的歌单——你加的、TA 加的都写着为什么想分享；TA 会时不时塞一首进来；每天还有一首「今日份」 */
if (window.__gyxList) return; window.__gyxList = 1;
X.feat('gyxList', { n: '🎶 共享歌单', desc: '你们一起往里加歌，TA 会分享歌给你' });
const S = X.store('playlist');
let D = { songs: [], cfg: { per: 20 } };   // {id, t, a, by:'me'|cid, why, at, fav}
const SEED = [['晴天', '周杰伦'], ['小幸运', '田馥甄'], ['可惜没如果', '林俊杰'], ['后来', '刘若英'], ['稻香', '周杰伦'], ['好久不见', '陈奕迅'], ['慢慢喜欢你', '莫文蔚'], ['我怀念的', '孙燕姿'], ['光年之外', '邓紫棋'], ['起风了', '买辣椒也用券'], ['夜空中最亮的星', '逃跑计划'], ['Fly Me to the Moon', 'Frank Sinatra'], ['Perfect', 'Ed Sheeran'], ['A Thousand Years', 'Christina Perri']];
async function taAdd(c) {
    let j;
    if (X.bailu()) { const [t, a] = X.pick(SEED.filter(s => !D.songs.some(x => x.t === s[0]))) || X.pick(SEED); j = { t, a, why: X.cards(['歌', '聊天'], c, 1)[0] || '突然想和你一起听这首。' }; }
    else j = X.json(await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 12)}\n你们歌单里已经有：${D.songs.slice(0, 30).map(s => s.t + '-' + s.a).join('、') || '（空的）'}\n\n你想往你们的共享歌单里加一首歌（真实存在的歌，符合你的口味和此刻的心情，别跟已有的重复），写一句为什么想分享给她。\n只输出 JSON：{"t":"歌名","a":"歌手","why":"为什么"}`)) || { t: X.pick(SEED)[0], a: '', why: '想和你一起听' };
    if (!j || !j.t) return null;
    const it = { id: 'sg' + Date.now(), t: String(j.t), a: String(j.a || ''), by: String(c.id), why: String(j.why || ''), at: Date.now() };
    D.songs.unshift(it); await S.set('d', D);
    X.say(c, `🎶 往我们的歌单里加了一首《${it.t}》${it.a ? ' - ' + it.a : ''}\n${it.why}`);
    return it;
}
window.gyxListTaAdd = id => taAdd(X.char(id) || X.cur());
function todaySong() { if (!D.songs.length) return null; const k = X.day(); let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return D.songs[h % D.songs.length]; }
window.gyxListPlay = function (id) {
    const s = D.songs.find(x => x.id === id); if (!s) return;
    try { const t = window.gymFindTrack && window.gymFindTrack(s.t); if (t && window.gymPlayTrackId) { window.gymPlayTrackId(t.id); X.toast(X.v('音乐盒里放起来了', '正在放'), s.t); return; } } catch (e) {}
    if (window.gyWmOpen) window.gyWmOpen('https://music.163.com/#/search/m/?s=' + encodeURIComponent(s.t + ' ' + s.a) + '&type=1');
    else window.open('https://music.163.com/#/search/m/?s=' + encodeURIComponent(s.t + ' ' + s.a), '_blank');
};
window.gyxListOpen = function () {
    const td = todaySong();
    X.panel('gyxLsOv', '🎶 我们的歌单', `${td ? `<div class="ls-today" onclick="gyxListPlay('${td.id}')"><em>今日份</em><b>${X.esc(td.t)}</b><span>${X.esc(td.a)}</span><i>▶</i></div>` : ''}
        <div class="gyx-row"><input id="gyxLsT" class="gyx-in" placeholder="歌名" style="flex:2"><input id="gyxLsA" class="gyx-in" placeholder="歌手" style="flex:1"></div><div class="gyx-row"><input id="gyxLsW" class="gyx-in" placeholder="为什么想分享给 TA（可空）" style="flex:1"><button class="gyx-btn" onclick="gyxListAdd()">加进去</button></div>
        <div class="gyx-row"><span class="gyx-tip">${D.songs.length} 首 · 你加的 ${D.songs.filter(s => s.by === 'me').length} · TA 加的 ${D.songs.filter(s => s.by !== 'me').length}</span><button class="gyx-btn lite" style="margin-left:auto" onclick="this.disabled=true;gyxListTaAdd().then(()=>gyxListOpen())">让 TA 加一首</button></div>
        ${D.songs.map(s => `<div class="ls-it"><span class="ls-by">${s.by === 'me' ? '我' : X.esc((X.name(X.char(s.by)) || 'TA')[0])}</span><div><b>${X.esc(s.t)}</b><span>${X.esc(s.a)}</span>${s.why ? `<p>${X.esc(s.why)}</p>` : ''}</div><i onclick="gyxListFav('${s.id}')">${s.fav ? '❤️' : '🤍'}</i><i onclick="gyxListPlay('${s.id}')">▶</i><i onclick="gyxListDel('${s.id}')">×</i></div>`).join('') || '<div class="gyx-tip">歌单是空的，先加一首吧。</div>'}
        <div class="gyx-row gyx-tip">默认模式的 TA 每天有 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.per}" style="width:60px" onchange="gyxListCfg(+this.value)">% 的可能往歌单里加一首；自主模式的 TA 自己决定。</div>`);
};
window.gyxListAdd = async function () {
    const t = ((document.getElementById('gyxLsT') || {}).value || '').trim(); if (!t) return;
    const it = { id: 'sg' + Date.now(), t, a: ((document.getElementById('gyxLsA') || {}).value || '').trim(), by: 'me', why: ((document.getElementById('gyxLsW') || {}).value || '').trim(), at: Date.now() };
    D.songs.unshift(it); await S.set('d', D); window.gyxListOpen();
    const c = X.cur(); if (c) X.reach(c, `她往你们的共享歌单里加了一首《${it.t}》${it.a ? '（' + it.a + '）' : ''}${it.why ? '，她说：' + it.why : ''}。说说你对这首歌的感觉`);
};
window.gyxListFav = async id => { const s = D.songs.find(x => x.id === id); if (s) { s.fav = !s.fav; await S.set('d', D); window.gyxListOpen(); } };
window.gyxListDel = async id => { D.songs = D.songs.filter(x => x.id !== id); await S.set('d', D); window.gyxListOpen(); };
window.gyxListCfg = v => { D.cfg.per = v; S.set('d', D); };
window.gyxListData = () => D;
async function tick() { if (!X.on('gyxList')) return; const k = X.day(); if (D.last === k) return; D.last = k; await S.set('d', D); for (const c of X.chars()) { if (X.auto(c)) continue; if (Math.random() * 100 < (+D.cfg.per || 0)) { await taAdd(c); break; } } }
X.action({ key: 'gyx_playlist', label: '往你们的共享歌单里加一首歌', hint: '想分享给她的歌', need: () => true, run: async c => (await taAdd(c)) ? '往歌单里加了一首歌' : null }, 'gyxList');
X.ctx(() => D.songs.length ? `【你们的共享歌单】最近加的：${D.songs.slice(0, 6).map(s => '《' + s.t + '》' + (s.by === 'me' ? '（她加的）' : '')).join('、')}。` : '', 'gyxList');
X.today(() => { const td = todaySong(); return { title: '🎶 今日份', rows: td ? [{ t: '▶', x: `《${X.esc(td.t)}》${X.esc(td.a)}`, go: `gyxListPlay('${td.id}')` }] : [] }; }, 'gyxList');
X.widget('gyxList', { n: '今日份歌曲', sizes: ['s', 'm'], tap: () => window.gyxListOpen(), r: w => { const td = todaySong(); if (!td) return '<div class="gw-ls"><b>🎶</b><em>共享歌单</em></div>'; return `<div class="gw-ls"><b>🎶</b><i>${X.esc(td.t)}</i><em>${X.esc(td.a)}</em></div>`; } });
X.css('gyxLsCss', `.ls-today{display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:18px;background:linear-gradient(135deg,#1d2b53,#7e2553);color:#fff;cursor:pointer;margin-bottom:10px}.ls-today em{font-style:normal;font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.2)}.ls-today b{font-size:18px}.ls-today span{opacity:.7;font-size:13px}.ls-today i{margin-left:auto;font-style:normal;font-size:20px}
.ls-it{display:flex;gap:10px;align-items:center;padding:9px 4px;border-bottom:1px solid #f4f4f4}.ls-it>div{flex:1;min-width:0}.ls-it b{font-weight:500}.ls-it span{font-size:12.5px;color:#999;margin-left:6px}.ls-it p{margin:2px 0 0;font-size:12.5px;color:#8e4ec6}.ls-it>i{font-style:normal;cursor:pointer;color:#bbb}.ls-by{width:28px;height:28px;border-radius:50%;background:#ffe3ec;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.gw-ls{height:100%;display:flex;flex-direction:column;justify-content:center;gap:2px}.gw-ls b{font-size:24px;font-weight:normal}.gw-ls i{font-style:normal;font-size:15px;font-weight:600}.gw-ls em{font-style:normal;font-size:12px;color:var(--pm-sub)}`);
X.mini({ id: 'gyxList', icon: '🎶', title: '共享歌单', desc: '你们一起往里加歌，写着为什么想分享；每天一首今日份', onOpen: () => window.gyxListOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.songs = D.songs || []; D.cfg = Object.assign({ per: 20 }, D.cfg || {}); setTimeout(tick, 45000); setInterval(tick, 30 * 60000); })();
