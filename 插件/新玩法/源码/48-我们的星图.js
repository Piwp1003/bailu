/* ✨ 我们的星图：你们的每一段回忆都是一颗星——聊天总结、记下的约定、小档案、你自己摘的星星。一个月的星连成一个星座，TA 会给它起名字。点星星就能看那天发生了什么 */
if (window.__gyxStar) return; window.__gyxStar = 1;
X.feat('gyxStar', { n: '✨ 我们的星图', desc: '每段回忆是一颗星，每个月连成一个 TA 起名的星座' });
const S = X.store('star');
let D = { names: {}, extra: [], hide: {} };   // names[cid][YYYY-MM] = 名字；extra = [{id, cid, at, text}]
const ym = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
function stars(c) {
    const cid = String(c.id), L = [];
    String(c.chatSummary || '').split('\n').forEach((l, i) => { const m = l.match(/^\[([^\]]+)\]\s*(.+)/); if (!m) return; let t = Date.parse(m[1].replace(/\//g, '-').replace(/\s*[上下]午/, ' ')); if (isNaN(t)) t = new Date(m[1]).getTime(); if (isNaN(t)) return; L.push({ id: 'sum' + i, at: t, text: m[2].replace(/【[^】]*】/g, '').slice(0, 160), k: '回忆' }); });
    try { (window.gyxPromiseData ? window.gyxPromiseData().list || [] : []).filter(x => x.cid === cid && x.done === true).forEach(x => L.push({ id: 'pr' + x.id, at: x.checked || x.at, text: '做到了：' + x.what, k: '约定' })); } catch (e) {}
    try { ((window.gyxNotesData ? window.gyxNotesData().notes : {})[cid] || []).filter(x => x.tier === 'pin').forEach(x => L.push({ id: 'nt' + x.id, at: x.at, text: x.text, k: '小档案' })); } catch (e) {}
    D.extra.filter(x => x.cid === cid).forEach(x => L.push({ id: x.id, at: x.at, text: x.text, k: '摘的星' }));
    const hide = D.hide[cid] || [];
    return L.filter(x => !hide.includes(x.id)).sort((a, b) => a.at - b.at);
}
async function nameIt(c, month, list) {
    const cid = String(c.id); D.names[cid] = D.names[cid] || {}; if (D.names[cid][month]) return D.names[cid][month];
    let n = X.bailu() ? null : await X.ask(`${X.who(c)}\n把你们 ${month} 的回忆连成一个星座，给它起个名字（4~8 个字，像真的星座名，带点只有你们懂的梗）。\n这个月的回忆：\n${list.map(x => '- ' + x.text).join('\n').slice(0, 1200)}\n只输出名字。`);
    n = String(n || '').replace(/["「」『』《》\s。]/g, '').slice(0, 10) || X.pick(['小熊', '纸飞机', '晚安', '奶茶', '雨伞', '小猫', '月亮船', '长椅', '风铃', '灯塔']) + '座';
    D.names[cid][month] = n; await S.set('d', D); return n;
}
let SEL = null;
function draw(c) {
    const cv = document.getElementById('gyxStarCv'); if (!cv) return; const L = stars(c), W = cv.width = cv.clientWidth * 2, Hh = cv.height = cv.clientHeight * 2, g = cv.getContext('2d');
    g.fillStyle = '#0b1026'; g.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${hash('bg' + i) * .5})`; g.fillRect(hash('x' + i) * W, hash('y' + i) * Hh, 2, 2); }
    const months = [...new Set(L.map(x => ym(x.at)))], cols = Math.max(1, Math.ceil(Math.sqrt(months.length))), cw = W / cols, ch = Hh / Math.ceil(months.length / cols || 1);
    cv.__pts = [];
    months.forEach((mo, mi) => {
        const ox = (mi % cols) * cw, oy = Math.floor(mi / cols) * ch, ms = L.filter(x => ym(x.at) === mo), pts = ms.map(x => ({ x: ox + cw * (.12 + .76 * hash(x.id + 'x')), y: oy + ch * (.18 + .64 * hash(x.id + 'y')), s: x }));
        g.strokeStyle = 'rgba(160,190,255,.35)'; g.lineWidth = 2; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
        pts.forEach(p => { const r = 3 + Math.min(7, p.s.text.length / 18), on = SEL && SEL.id === p.s.id; const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4); gr.addColorStop(0, on ? '#ffe28a' : p.s.k === '约定' ? '#ffd0e6' : p.s.k === '摘的星' ? '#b8ffe0' : '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r * 4, 0, 7); g.fill(); cv.__pts.push(p); });
        g.fillStyle = 'rgba(200,215,255,.8)'; g.font = '22px sans-serif'; g.fillText(((D.names[String(c.id)] || {})[mo] || '') + ' · ' + mo, ox + 14, oy + 30);
    });
    if (!L.length) { g.fillStyle = '#9aa'; g.font = '26px sans-serif'; g.fillText('还没有星星。聊着聊着，天上就会亮起来。', 30, Hh / 2); }
}
window.gyxStarTap = (e, cid) => { const cv = e.currentTarget, r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * 2, y = (e.clientY - r.top) * 2; let best = null, bd = 1e9; (cv.__pts || []).forEach(p => { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }); if (!best || bd > 60) return; SEL = best.s; draw(X.char(cid)); const b = document.getElementById('gyxStarInfo'); if (b) b.innerHTML = `<b>${new Date(SEL.at).toLocaleDateString()} · ${X.esc(SEL.k)}</b><div>${X.esc(SEL.text)}</div><span class="gyx-chip" onclick="gyxStarHide('${cid}','${SEL.id}')">把这颗藏起来</span>`; };
window.gyxStarHide = async (cid, id) => { (D.hide[cid] = D.hide[cid] || []).push(id); D.extra = D.extra.filter(x => x.id !== id); SEL = null; await S.set('d', D); window.gyxStarOpen(cid); };
window.gyxStarAdd = async cid => { const t = (document.getElementById('gyxStarIn') || {}).value; if (!t || !t.trim()) return; D.extra.push({ id: 'st' + Date.now().toString(36), cid, at: Date.now(), text: t.trim() }); await S.set('d', D); window.gyxStarOpen(cid); };
window.gyxStarName = async cid => { const c = X.char(cid); if (!c) return; const L = stars(c), ms = [...new Set(L.map(x => ym(x.at)))]; for (const m of ms) await nameIt(c, m, L.filter(x => ym(x.at) === m)); window.gyxStarOpen(cid); };
window.gyxStarOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), n = stars(c).length;
    X.panel('gyxStarOv', '✨ 我们的星图', `<div class="gyx-row">${X.whoSel(cid, 'gyxStarOpen')}<span class="gyx-tip">${n} 颗星</span><button class="gyx-btn lite" onclick="this.disabled=true;gyxStarName('${cid}')">让 TA 给星座起名</button></div>
        <canvas id="gyxStarCv" style="width:100%;height:54vh;border-radius:16px;cursor:pointer" onclick="gyxStarTap(event,'${cid}')"></canvas>
        <div id="gyxStarInfo" class="gyx-card">${X.v('点一颗星看看。', '每颗星都是你们的一天。', '亮的是最近的，暗的是很久以前的。')}</div>
        <div class="gyx-row"><input id="gyxStarIn" class="gyx-in" style="flex:1" placeholder="自己摘一颗：今天发生了什么值得记住的？"><button class="gyx-btn" onclick="gyxStarAdd('${cid}')">挂上去</button></div>`, 'dark');
    setTimeout(() => draw(c), 30);
};
X.action({ key: 'gyx_star', label: '给你们这个月的回忆起个星座名', hint: '你们的星图', need: c => { const m = ym(Date.now()); return stars(c).filter(x => ym(x.at) === m).length >= 3 && !((D.names[String(c.id)] || {})[m]); },
    run: async c => { const m = ym(Date.now()), n = await nameIt(c, m, stars(c).filter(x => ym(x.at) === m)); return (await X.reach(c, `你把你们这个月的回忆连成了一个星座，起名叫「${n}」。告诉她，说说为什么叫这个`)) ? '起了个星座名' : null; } }, 'gyxStar');
X.today(() => { const rows = []; X.chars().forEach(c => { const L = stars(c).filter(x => X.day(new Date(x.at)) === X.day()); if (L.length) rows.push({ t: '+' + L.length + ' ✦', x: `和 ${X.esc(X.name(c))} 的星图亮了 ${L.length} 颗`, go: `gyxStarOpen('${c.id}')` }); }); return { title: '✨ 我们的星图', rows }; }, 'gyxStar');
X.widget('gyxStarW', { n: '我们的星图', sizes: ['s', 'm'], tap: () => window.gyxStarOpen(), r: w => { const c = X.cur(); const L = c ? stars(c) : []; const nm = c && (D.names[String(c.id)] || {})[ym(Date.now())]; return X.gw(w, '✨', '我们的星图', [L.length + ' 颗星', nm ? '这个月：' + X.esc(nm) : L.length ? X.esc(L[L.length - 1].text.slice(0, 30)) : '']); } }, 'gyxStar');
X.memArr({ k: 'gyxStar', ico: '✨', n: '星图·自己摘的星', d: '你挂上去的星星（聊天总结那些星在「聊天总结」里改）', arr: () => D.extra, field: 'text', text: x => x.text, save: () => S.set('d', D) }, 'gyxStar');
X.mini({ id: 'gyxStar', icon: '✨', title: '我们的星图', desc: '每段回忆是一颗星', cat: '回忆', onOpen: () => window.gyxStarOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.names = D.names || {}; D.extra = D.extra || []; D.hide = D.hide || {}; })();
