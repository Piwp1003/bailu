/* 📺 追剧进度：记下你们在别处一起追的剧/番/综艺——你看到第几集、TA 看到第几集；你每看完一集 TA 来聊（TA 看得比你快就忍着不剧透），TA 自己也会往下追、等你；每集还能写一句短评（原来的「一起看」是在谷雨里放片子，这个是记你们在外面追的剧） */
if (window.__gyxShow) return; window.__gyxShow = 1;
X.feat('gyxShow', { n: '📺 追剧进度', desc: '一起追剧：你到第几集、TA 到第几集，看完一集 TA 来聊，不剧透' });
const S = X.store('show');
let D = { shows: [], cfg: { taPer: 30 } };   // {id, name, total, kind, cid, me, ta, notes:[{ep, by, t, at}], at, done}
const KINDS = ['电视剧', '动漫', '综艺', '美剧', '韩剧', '纪录片'];
async function talk(c, s, ep, mine) {
    const ahead = s.ta > ep;
    let t;
    if (X.bailu()) t = X.cards(['追剧', '聊天'], c, 1)[0] || '这集好看！';
    else t = X.plain(await X.ask(`${X.who(c)}\n你们在一起追《${s.name}》（${s.kind}${s.total ? '，共 ' + s.total + ' 集' : ''}）。她刚看完第 ${ep} 集${mine ? '，她的短评：「' + mine + '」' : ''}。你看到第 ${s.ta} 集${ahead ? '（比她快，绝对不能剧透后面的内容，可以暗示「后面有你受的」之类）' : s.ta < ep ? '（比她慢，她看到前面了，你可以喊她别剧透、或者说你今晚就补）' : ''}。\n你知道这部剧的话就按剧情真实地聊第 ${ep} 集；不了解就聊感受，别瞎编具体剧情。说一段（30~100 字），像你本人一起追剧那样。只输出这段话。`) || '这集好看！');
    s.notes.push({ ep, by: String(c.id), t, at: Date.now() }); await S.set('d', D);
    X.say(c, `📺 《${s.name}》第 ${ep} 集：${t}`); return t;
}
window.gyxShowAdd = async function () {
    const g = id => ((document.getElementById(id) || {}).value || '').trim(); const name = g('gyxShN'); if (!name) { X.toast(X.v('剧名要填', '追的是哪部？')); return null; }
    const c = X.char(window.GYX_SH_WHO) || X.cur(); const s = { id: 'sh' + Date.now(), name, total: +g('gyxShT') || 0, kind: g('gyxShK') || KINDS[0], cid: String((c || {}).id || ''), me: 0, ta: 0, notes: [], at: Date.now() };
    D.shows.unshift(s); await S.set('d', D); if (c) X.reach(c, `她说想和你一起追《${name}》，说说你的想法（看过/没看过/听说过）`); window.gyxShowOpen(); return s;
};
window.gyxShowEp = async function (id, ep) {
    const s = D.shows.find(x => x.id === id); if (!s) return; ep = ep != null ? ep : s.me + 1; if (s.total) ep = Math.min(ep, s.total);
    const mine = ((document.getElementById('gyxShM' + id) || {}).value || '').trim();
    s.me = ep; if (mine) s.notes.push({ ep, by: 'me', t: mine, at: Date.now() }); if (s.total && s.me >= s.total) s.done = Date.now(); await S.set('d', D);
    window.gyxShowOpen(); const c = X.char(s.cid); if (c) { await talk(c, s, ep, mine); window.gyxShowOpen(); }
    if (s.done && c) X.reach(c, `你们一起追完了《${s.name}》！聊聊整部剧，再想想下一部一起追什么`);
};
window.gyxShowTaEp = async function (id) { const s = D.shows.find(x => x.id === id), c = s && X.char(s.cid); if (!c) return; if (s.total && s.ta >= s.total) return; s.ta++; await S.set('d', D); X.say(c, X.v(`偷偷看了《${s.name}》第 ${s.ta} 集`, `《${s.name}》我看到第 ${s.ta} 集了`, `昨晚补了《${s.name}》第 ${s.ta} 集`) + (s.ta > s.me ? X.v('，不剧透！', '，等你', '') : '')); window.gyxShowOpen(); return s.ta; };
window.gyxShowDel = async id => { D.shows = D.shows.filter(x => x.id !== id); await S.set('d', D); window.gyxShowOpen(); };
window.GYX_SH_WHO = ''; window.gyxShowWho = v => { window.GYX_SH_WHO = v; };
window.gyxShowOpen = function () {
    window.GYX_SH_WHO = window.GYX_SH_WHO || String((X.cur() || {}).id || '');
    const bar = (n, t) => t ? `<div class="sh-bar"><i style="width:${Math.min(100, n / t * 100)}%"></i></div>` : '';
    X.panel('gyxShOv', '📺 追剧进度', `${D.shows.map(s => `<div class="sh-it${s.done ? ' done' : ''}"><div class="sh-hd"><b>${X.esc(s.name)}</b><span>${X.esc(s.kind)}${s.total ? ' · ' + s.total + ' 集' : ''} · 和 ${X.esc(X.name(X.char(s.cid)))}</span></div>
        <div class="sh-p"><em>我</em>第 ${s.me} 集${bar(s.me, s.total)}</div><div class="sh-p"><em>TA</em>第 ${s.ta} 集${bar(s.ta, s.total)}${s.ta > s.me ? '<small>TA 比你快，不剧透</small>' : ''}</div>
        ${s.done ? '<div class="gyx-tip">🎉 一起追完了</div>' : `<div class="gyx-row"><input id="gyxShM${s.id}" class="gyx-who" style="flex:1" placeholder="第 ${s.me + 1} 集短评（可空）"><button class="gyx-btn" onclick="this.disabled=true;gyxShowEp('${s.id}')">看完第 ${s.me + 1} 集</button></div>`}
        <details><summary class="gyx-tip">短评 ${s.notes.length} 条 · 改进度 · 删</summary>${s.notes.slice().reverse().slice(0, 30).map(n => `<div class="sh-n"><b>E${n.ep}</b> ${n.by === 'me' ? '我' : X.esc(X.name(X.char(n.by)))}：${X.esc(n.t)}</div>`).join('')}
        <div class="gyx-row">我看到第 <input class="gyx-who" type="number" min="0" value="${s.me}" style="width:64px" onchange="gyxShowSet('${s.id}','me',+this.value)"> 集 · TA 看到第 <input class="gyx-who" type="number" min="0" value="${s.ta}" style="width:64px" onchange="gyxShowSet('${s.id}','ta',+this.value)"> 集 <button class="gyx-btn lite" onclick="gyxShowDel('${s.id}')">删</button></div></details></div>`).join('') || '<div class="gyx-tip">还没在追的剧。</div>'}
        <div class="gyx-card"><div class="gyx-tip">一起追一部</div><div class="gyx-row"><input id="gyxShN" class="gyx-who" placeholder="剧名" style="flex:2"><input id="gyxShT" class="gyx-who" type="number" placeholder="总集数" style="width:80px"><select id="gyxShK" class="gyx-who">${KINDS.map(k => `<option>${k}</option>`).join('')}</select></div><div class="gyx-row">和谁：${X.whoSel(window.GYX_SH_WHO, 'gyxShowWho')}<button class="gyx-btn" onclick="gyxShowAdd()">开追</button></div></div>
        <div class="gyx-row gyx-tip">默认模式的 TA 每天有 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.taPer}" style="width:60px" onchange="gyxShowCfg(+this.value)">% 的可能自己往下看一集；自主模式的 TA 自己决定。</div>`);
};
window.gyxShowSet = async (id, k, v) => { const s = D.shows.find(x => x.id === id); if (!s) return; s[k] = Math.max(0, v); await S.set('d', D); };
window.gyxShowCfg = v => { D.cfg.taPer = v; S.set('d', D); };
window.gyxShowData = () => D;
async function tick() { if (!X.on('gyxShow')) return; const k = X.day(); if (D.last === k) return; const h = new Date().getHours(); if (h < 19) return; D.last = k; await S.set('d', D); for (const s of D.shows.filter(x => !x.done)) { const c = X.char(s.cid); if (!c || X.auto(c)) continue; if (s.ta <= s.me + 2 && Math.random() * 100 < (+D.cfg.taPer || 0)) await window.gyxShowTaEp(s.id); } }
X.action({ key: 'gyx_show', label: '追剧：自己往下看一集 / 问她看到第几集了', hint: '你们在一起追的剧', need: c => D.shows.some(s => !s.done && s.cid === String(c.id)),
    run: async c => { const s = D.shows.find(x => !x.done && x.cid === String(c.id)); if (s.ta <= s.me) { await window.gyxShowTaEp(s.id); return `看了《${s.name}》第 ${s.ta} 集`; } return (await X.reach(c, `你们一起追《${s.name}》，你看到第 ${s.ta} 集了，她才到第 ${s.me} 集。催催她（别剧透）`)) ? '催你追剧' : null; } }, 'gyxShow');
X.ctx(id => { const L = D.shows.filter(s => s.cid === String(id) && !s.done); return L.length ? '【一起追的剧】' + L.map(s => `《${s.name}》她看到第 ${s.me} 集，你看到第 ${s.ta} 集`).join('；') + '。比她快的部分绝对不能剧透。' : ''; }, 'gyxShow');
X.today(() => ({ title: '📺 追剧', rows: D.shows.filter(s => !s.done).map(s => ({ t: 'E' + s.me + (s.total ? '/' + s.total : ''), x: `《${X.esc(s.name)}》${s.ta > s.me ? ' · TA 已经到 E' + s.ta : ''}`, go: 'gyxShowOpen()' })) }), 'gyxShow');
X.widget('gyxShowW', { n: '追剧', sizes: ['s', 'm'], tap: () => window.gyxShowOpen(), r: w => { const L = D.shows.filter(s => !s.done); if (!L.length) return X.gw(w, '📺', '追剧', ['一起追一部']); return X.gw(w, '📺', '追剧', L.slice(0, 3).map(s => `${X.esc(s.name)} E${s.me}`)); } }, 'gyxShow');
X.css('gyxShCss', `.sh-it{padding:12px 14px;border-radius:18px;background:#f5f3ff;margin:8px 0}.sh-it.done{background:#f0fff4}.sh-hd b{font-size:16px}.sh-hd span{display:block;font-size:12px;color:#888}.sh-p{display:flex;align-items:center;gap:8px;font-size:13.5px;margin:4px 0}.sh-p em{font-style:normal;width:24px;color:#7c5cff}.sh-p small{font-size:11.5px;color:#aaa}.sh-bar{flex:1;height:6px;border-radius:3px;background:#e6e0ff}.sh-bar i{display:block;height:100%;border-radius:3px;background:#7c5cff}.sh-n{font-size:13px;padding:4px 0;border-bottom:1px solid #eee}.sh-n b{color:#7c5cff;margin-right:4px}`);
X.mini({ id: 'gyxShow', icon: '📺', title: '追剧进度', desc: '一起追的剧：你到第几集、TA 到第几集，看完一集 TA 来聊，不剧透', onOpen: () => window.gyxShowOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.shows = D.shows || []; D.cfg = Object.assign({ taPer: 30 }, D.cfg || {}); setTimeout(tick, 45000); setInterval(tick, 30 * 60000); })();
X.memArr({ k: 'gyxShow', ico: '📺', n: '一起追的剧', d: '', arr: () => D.shows, text: x => x.name, field: 'name', meta: x => '你 E' + x.me + ' · TA E' + x.ta + (x.done ? ' · 追完了' : ''), save: () => S.set('d', D) }, 'gyxShow');
