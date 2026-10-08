/* 🎞️ 回忆放映：TA 把你们的照片、合照和聊天总结挑出来，排成一部小电影——每一幕配一句 TA 写的旁白，TA 念给你听，音乐盒里有歌的话会跟着放。看完能存下来，以后再放 */
if (window.__gyxReel) return; window.__gyxReel = 1;
X.feat('gyxReel', { n: '🎞️ 回忆放映', desc: '照片 + 回忆排成小电影，TA 配旁白念给你听' });
const S = X.store('reel');
let D = { shows: [], cfg: { voice: true, music: true, sec: 6 } };   // [{id, cid, at, title, slides:[{img, text, at}], end}]
let P = null;
function pool(c) {
    const cid = String(c.id), L = [];
    String(c.chatSummary || '').split('\n').forEach(l => { const m = l.match(/^\[([^\]]+)\]\s*(.+)/); if (!m) return; const t = new Date(m[1].replace(/\s*[上下]午/, ' ')).getTime(); L.push({ at: isNaN(t) ? 0 : t, text: m[2].replace(/【[^】]*】/g, '').slice(0, 140) }); });
    try { (window.gyGallery ? window.gyGallery.seenBy(cid) : []).filter(x => x.src).slice(-60).forEach(x => L.push({ at: x.at || 0, img: x.src, text: x.note || x.tag || '' })); } catch (e) {}
    try { (window.gyxDuoData ? window.gyxDuoData().pics : []).filter(x => x.cid === cid).forEach(x => L.push({ at: x.at, img: x.src, text: x.say })); } catch (e) {}
    try { ((window.gyxNotesData ? window.gyxNotesData().notes : {})[cid] || []).filter(x => x.tier === 'pin').forEach(x => L.push({ at: x.at, text: x.text })); } catch (e) {}
    return L.filter(x => x.img || x.text).sort((a, b) => a.at - b.at);
}
async function make(c, theme) {
    const all = pool(c); if (!all.length) return null;
    const imgs = all.filter(x => x.img), txt = all.filter(x => !x.img), n = Math.min(10, all.length), pick = [];
    const step = Math.max(1, Math.floor(all.length / n)); for (let i = 0; i < all.length && pick.length < n; i += step) pick.push(all[i]);
    pick.forEach((s, i) => { if (!s.img && imgs.length) s.img = imgs[i % imgs.length].img; });
    let title = `${X.name(c)} 和 ${X.me(c)}`, end = X.v('未完待续。', '下一幕，还是我们。', '片尾：我还想和你拍很多很多集。');
    if (!X.bailu()) {
        const j = X.json(await X.ask(`${X.who(c)}\n你在给你们的回忆剪一部小电影${theme ? '，主题：' + theme : ''}。下面是按时间排好的 ${pick.length} 幕（序号｜日期｜内容）：\n${pick.map((s, i) => `${i}｜${s.at ? new Date(s.at).toLocaleDateString() : '某天'}｜${s.text || '（一张照片）'}`).join('\n')}\n\n给每一幕写一句旁白（你的口吻，对她说，20~40 字，有画面感，别重复内容原文）；再起个片名、写一句片尾。\n只输出 JSON：{"title":"","lines":["第0幕旁白",...],"end":""}`));
        if (j) { title = j.title || title; end = j.end || end; (j.lines || []).forEach((l, i) => { if (pick[i] && l) pick[i].line = X.plain(l); }); }
    }
    const cards = X.cards(['回忆', '情话'], c, pick.length);
    pick.forEach((s, i) => { if (!s.line) s.line = s.text ? (s.at ? `${new Date(s.at).getMonth() + 1}月${new Date(s.at).getDate()}日，` : '') + s.text : (cards[i] || '这一天，我也记得。'); });
    const sh = { id: 'rl' + Date.now().toString(36), cid: String(c.id), at: Date.now(), title: X.plain(title).slice(0, 24), slides: pick.map(s => ({ img: s.img || '', text: s.line, at: s.at })), end: X.plain(end) };
    D.shows.unshift(sh); if (D.shows.length > 30) D.shows.length = 30; await S.set('d', D); return sh;
}
function show(i) {
    if (!P) return; const box = document.getElementById('gyxReelSc'); if (!box) { stopP(); return; } const sh = P.sh, c = X.char(sh.cid);
    if (i >= sh.slides.length) { box.innerHTML = `<div class="reel-end"><b>${X.esc(sh.title)}</b><div>${X.esc(sh.end)}</div><span class="gyx-btn lite" onclick="gyxReelPlay('${sh.id}')">再放一遍</span></div>`; if (D.cfg.voice) X.speak(c, sh.end); P.done = true; try { if (P.music && window.gymToggle) window.gymToggle(); } catch (e) {} return; }
    const s = sh.slides[i]; P.i = i;
    box.innerHTML = `<div class="reel-sl" style="${s.img ? `background-image:url('${s.img.replace(/'/g, '%27')}')` : ''}"></div><div class="reel-cap"><em>${s.at ? new Date(s.at).toLocaleDateString() : ''}</em>${X.esc(s.text)}</div><div class="reel-dots">${sh.slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>`;
    clearTimeout(P.t); let next = () => { if (!P) return; clearTimeout(P.t); P.t = setTimeout(() => show(i + 1), 900); };
    if (D.cfg.voice) { let ended = false; X.speak(c, s.text, () => { ended = true; next(); }); P.t = setTimeout(() => { if (!ended && P && P.i === i) show(i + 1); }, Math.max(+D.cfg.sec || 6, s.text.length / 4.5) * 1000 + 4000); }
    else P.t = setTimeout(() => show(i + 1), (+D.cfg.sec || 6) * 1000);
}
function stopP() { if (P) { clearTimeout(P.t); X.stopSpeak(); try { if (P.music && !P.done && window.gymToggle) window.gymToggle(); } catch (e) {} } P = null; }
window.gyxReelPlay = id => {
    const sh = D.shows.find(x => x.id === id); if (!sh) return; stopP();
    const ov = X.panel('gyxReelPl', '🎞️ ' + X.esc(sh.title), `<div id="gyxReelSc" class="reel-sc" onclick="gyxReelNext()"></div><div class="gyx-tip" style="text-align:center">点画面跳到下一幕</div>`, 'dark');
    const rm = ov.remove.bind(ov); ov.remove = () => { stopP(); rm(); };
    let music = false; try { const inf = window.gymNowInfo && window.gymNowInfo(); if (D.cfg.music && window.gymToggle && inf && !inf.playing) { window.gymToggle(); music = true; } } catch (e) {}
    P = { sh, i: 0, music }; show(0);
};
window.gyxReelNext = () => { if (P && !P.done) { X.stopSpeak(); show(P.i + 1); } };
window.gyxReelMake = async (cid) => { const c = X.char(cid) || X.cur(); if (!c) return; const th = (document.getElementById('gyxReelTh') || {}).value || ''; const sh = await make(c, th.trim()); if (!sh) { X.toast('🎞️ 还剪不出来', '还没有照片和聊天总结。多聊几天再来。'); window.gyxReelOpen(cid); return; } window.gyxReelPlay(sh.id); };
window.gyxReelDel = async id => { const x = D.shows.find(s => s.id === id); D.shows = D.shows.filter(s => s.id !== id); await S.set('d', D); window.gyxReelOpen(x && x.cid); };
window.gyxReelCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxReelOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), n = pool(c);
    X.panel('gyxReelOv', '🎞️ 回忆放映', `<div class="gyx-row">${X.whoSel(cid, 'gyxReelOpen')}<span class="gyx-tip">素材：${n.filter(x => x.img).length} 张照片 · ${n.filter(x => !x.img).length} 段回忆</span></div>
        <div class="gyx-row"><input id="gyxReelTh" class="gyx-who" style="flex:1" placeholder="主题（可空）：我们的夏天 / 吵过的架 / 第一个月…"><button class="gyx-btn" onclick="this.disabled=true;this.textContent='TA 在剪…';gyxReelMake('${cid}')">${X.v('剪一部新的', '让 TA 剪一部', '开拍')}</button></div>
        <div class="gyx-row gyx-tip"><label><input type="checkbox" ${D.cfg.voice ? 'checked' : ''} onchange="gyxReelCfg('voice',this.checked)"> TA 念旁白</label><label><input type="checkbox" ${D.cfg.music ? 'checked' : ''} onchange="gyxReelCfg('music',this.checked)"> 放音乐盒里的歌</label> 每幕 <input class="gyx-who" type="number" min="2" value="${D.cfg.sec}" style="width:50px" onchange="gyxReelCfg('sec',+this.value)"> 秒</div>
        ${D.shows.filter(x => x.cid === cid).map(x => `<div class="reel-it" onclick="gyxReelPlay('${x.id}')"><div class="reel-th" style="${(x.slides.find(s => s.img) || {}).img ? `background-image:url('${(x.slides.find(s => s.img).img).replace(/'/g, '%27')}')` : ''}"></div><div><b>${X.esc(x.title)}</b><em>${x.slides.length} 幕 · ${new Date(x.at).toLocaleDateString()}</em></div><i onclick="event.stopPropagation();gyxReelDel('${x.id}')">删</i></div>`).join('') || '<div class="gyx-tip">还没剪过。</div>'}`);
};
X.ctx(id => { const x = D.shows.find(s => s.cid === String(id)); return x && Date.now() - x.at < 864e5 ? `【你今天给她剪了一部回忆小电影《${x.title}》】片尾：${x.end}` : ''; }, 'gyxReel');
X.action({ key: 'gyx_reel', label: '剪一部你们的回忆小电影送她', hint: '回忆放映', need: c => pool(c).length >= 5 && !D.shows.some(x => x.cid === String(c.id) && Date.now() - x.at < 14 * 864e5),
    run: async c => { const sh = await make(c, ''); if (!sh) return null; X.notify(c, `<b>${X.esc(X.name(c))}</b> ${X.v('给你剪了一部小电影', '偷偷剪了你们的回忆', '有一部片子想放给你看')}：《${X.esc(sh.title)}》`, '🎞️ 回忆放映', () => window.gyxReelPlay(sh.id)); return (await X.reach(c, `你偷偷把你们的回忆剪成了一部小电影《${sh.title}》，叫她去「🎞️ 回忆放映」里看`)) ? '剪了一部回忆小电影' : null; } }, 'gyxReel');
X.today(() => ({ title: '🎞️ 回忆放映', rows: D.shows.filter(x => X.day(new Date(x.at)) === X.day()).map(x => ({ t: '新片', x: '《' + X.esc(x.title) + '》', go: `gyxReelPlay('${x.id}')` })) }), 'gyxReel');
X.widget('gyxReelW', { n: '回忆放映', sizes: ['s', 'm'], tap: () => D.shows[0] ? window.gyxReelPlay(D.shows[0].id) : window.gyxReelOpen(), r: w => { const x = D.shows[0]; return X.gw(w, '🎞️', '回忆放映', x ? ['《' + X.esc(x.title) + '》', x.slides.length + ' 幕 · 点开放映'] : ['剪一部？']); } }, 'gyxReel');
X.memArr({ k: 'gyxReel', ico: '🎞️', n: '回忆放映', d: 'TA 剪过的回忆小电影（改片名）', arr: () => D.shows, field: 'title', text: x => x.title, meta: x => x.slides.length + ' 幕 · ' + new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxReel');
X.css('gyxReelCss', `.reel-sc{position:relative;width:100%;aspect-ratio:4/5;max-height:70vh;background:#000;border-radius:16px;overflow:hidden;cursor:pointer}.reel-sl{position:absolute;inset:0;background:#222 center/cover;animation:rlkb 9s ease-out forwards;opacity:.9}@keyframes rlkb{from{transform:scale(1.02);opacity:0}12%{opacity:.9}to{transform:scale(1.14) translate(-2%,-2%)}}.reel-cap{position:absolute;left:0;right:0;bottom:0;padding:40px 18px 26px;background:linear-gradient(transparent,rgba(0,0,0,.75));color:#fff;font-size:16px;line-height:1.7;animation:rlup 1.2s}.reel-cap em{display:block;font-style:normal;font-size:12px;opacity:.7}@keyframes rlup{from{opacity:0;transform:translateY(12px)}}.reel-dots{position:absolute;top:10px;left:10px;right:10px;display:flex;gap:3px}.reel-dots i{flex:1;height:2px;background:rgba(255,255,255,.3)}.reel-dots i.on{background:#fff}.reel-end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#fff;text-align:center;padding:20px}.reel-end b{font-size:22px}.reel-it{display:flex;gap:10px;align-items:center;padding:8px 2px;border-bottom:1px solid #f2f2f2;cursor:pointer;position:relative}.reel-th{width:56px;height:56px;border-radius:10px;background:#eee center/cover;flex:none}.reel-it em{display:block;font-style:normal;font-size:12px;color:#888}.reel-it i{position:absolute;right:4px;font-style:normal;font-size:11px;color:#aaa}`);
X.mini({ id: 'gyxReel', icon: '🎞️', title: '回忆放映', desc: '照片和回忆剪成小电影，TA 念旁白', cat: '回忆', onOpen: () => window.gyxReelOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.shows = D.shows || []; D.cfg = Object.assign({ voice: true, music: true, sec: 6 }, D.cfg || {}); })();
