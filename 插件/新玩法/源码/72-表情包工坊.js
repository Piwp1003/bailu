/* 🎨 表情包工坊：拿 TA 的立绘、头像、你们的合照，或者你自己的图，配上字，做成表情包——一键存进「表情包」库，聊天里 TA 和你都能发。TA 也会自己做两张来跟你斗图 */
if (window.__gyxMeme) return; window.__gyxMeme = 1;
X.feat('gyxMeme', { n: '🎨 表情包工坊', desc: '用 TA 的立绘 / 合照配字做表情包，存进表情包库，TA 也会做来斗图' });
const S = X.store('meme');
let D = { list: [] };   // [{id, cid, src(合成后的图), text, by:'me'|'ta', at, emo(表情包库里的 id)}]
const PHR = ['在吗', '想你了', '哼', '不理你了', '抱抱', '你好可爱', '我错了', '收到', '好耶', '晚安', '早安', '就这？', '委屈', '亲亲', '呜呜呜', '盯——', '在忙', '饿了', '快夸我', '你说得对', '我先睡了', '再说一遍', '摸摸头', '不许走', '冲鸭', '笑死', '救命', '乖', '好的老婆', '拿捏了'];
const ST = { img: '', top: '', bottom: '想你了', size: 44, color: '#ffffff', stroke: '#222222', font: 'sans', shape: 'sq', bg: '#ffffff' };
const FONTS = { sans: '"PingFang SC","Microsoft YaHei",sans-serif', hand: '"Ma Shan Zheng","Long Cang","KaiTi",cursive', bold: '"Noto Sans SC","Heiti SC","SimHei",sans-serif' };
const imgOf = c => { try { return (window.gyxPetImgOf && window.gyxPetImgOf(c)) || c.avatarImg || ''; } catch (e) { return (c && c.avatarImg) || ''; } };
function sources(c) {
    const L = []; const a = imgOf(c); if (a) L.push(['立绘', a]); if (c.avatarImg && c.avatarImg !== a) L.push(['头像', c.avatarImg]);
    try { (window.gyxDuoData ? window.gyxDuoData().pics : []).filter(x => x.cid === String(c.id)).slice(0, 6).forEach((x, i) => L.push(['合照' + (i + 1), x.src])); } catch (e) {}
    try { (window.gyGallery ? window.gyGallery.seenBy(String(c.id)) : []).slice(-6).forEach((x, i) => L.push(['图库' + (i + 1), x.src])); } catch (e) {}
    return L;
}
const load = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
async function render(o) {
    const W = 320, H = o.shape === 'wide' ? 240 : 320, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    g.fillStyle = o.bg || '#fff'; g.fillRect(0, 0, W, H);
    if (o.img) { try { const im = await load(o.img); const k = Math.min(W / im.width, (H - (o.bottom ? 40 : 0) - (o.top ? 40 : 0)) / im.height) * 1; const w = im.width * k, h = im.height * k; g.drawImage(im, (W - w) / 2, (o.top ? 40 : 0) + ((H - (o.bottom ? 40 : 0) - (o.top ? 40 : 0)) - h) / 2, w, h); } catch (e) {} }
    const txt = (t, y) => { if (!t) return; let fs = +o.size || 44; g.font = `900 ${fs}px ${FONTS[o.font] || FONTS.sans}`; while (g.measureText(t).width > W - 16 && fs > 14) { fs -= 2; g.font = `900 ${fs}px ${FONTS[o.font] || FONTS.sans}`; } g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = Math.max(3, fs / 7); g.strokeStyle = o.stroke; g.strokeText(t, W / 2, y); g.fillStyle = o.color; g.fillText(t, W / 2, y); };
    txt(o.top, 28); txt(o.bottom, H - 28);
    try { return cv.toDataURL('image/png'); } catch (e) { if (o.img) { X.toast('🎨 这张图是网络图片，浏览器不让合成', '先存到本地再上传就行'); return render(Object.assign({}, o, { img: '' })); } return ''; }
}
async function save(c, src, text, by) {
    const it = { id: 'mm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), cid: String(c.id), src, text, by, at: Date.now() };
    try { if (typeof globalEmoticons !== 'undefined') { const id = 'emo_' + Date.now() + '_' + Math.floor(Math.random() * 1e4); globalEmoticons.push({ id, url: src, desc: (by === 'ta' ? X.name(c) + '做的：' : '') + text }); it.emo = id; saveAllData(); } } catch (e) {}
    D.list.unshift(it); await S.set('d', D); return it;
}
function sendMsg(c, it, who) { try { const sid = String(c.id); globalChats[sid] = globalChats[sid] || []; globalChats[sid].push({ sender: who === 'me' ? 'me' : c.id, text: '', mediaUrl: it.src, timestamp: Date.now(), readBy: [], gyx: 1 }); saveAllData(); if (typeof renderChatMessages === 'function' && String(currentChatSessionId) === sid) renderChatMessages(); } catch (e) {} }
async function paint() { const b = document.getElementById('gyxMmPrev'); if (!b) return; b.src = await render(ST); }
window.gyxMemeSet = (k, v) => { ST[k] = v; paint(); if (k === 'img') document.querySelectorAll('.mm-src img').forEach(e => e.classList.toggle('on', e.getAttribute('data-s') === String(v).slice(0, 60))); };
window.gyxMemeUp = inp => { const f = inp.files && inp.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => window.gyxMemeSet('img', fr.result); fr.readAsDataURL(f); };
window.gyxMemeSave = async (cid, send) => { const c = X.char(cid); if (!c) return null; const src = await render(ST); const it = await save(c, src, [ST.top, ST.bottom].filter(Boolean).join(' '), 'me'); if (send) { sendMsg(c, it, 'me'); X.toast('🎨 发出去了', ''); } else X.toast('🎨 存进表情包库了', '聊天里点表情就能找到'); window.gyxMemeOpen(cid, 'mine'); return it; };
async function taMake(c, why) {
    let t = X.bailu() ? null : X.plain(await X.ask(`${X.who(c)}\n你要用自己的照片做一张表情包${why ? '（' + why + '）' : '来跟她斗图'}，配一句很短的字（2~8 个字，有梗、像你会说的）。\n最近的聊天：\n${X.recent(c, 8)}\n只输出那句字。`) || '');
    t = (t || X.pick(X.cards(['表情', '字词'], c, 2).filter(x => x.length <= 8).concat(PHR))).replace(/["「」]/g, '').slice(0, 10);
    const src = await render(Object.assign({}, ST, { img: imgOf(c), top: '', bottom: t, color: X.pick(['#ffffff', '#ffe066', '#ffb3c7']), font: X.pick(['sans', 'hand', 'bold']) }));
    return save(c, src, t, 'ta');
}
window.gyxMemeTa = async cid => { const c = X.char(cid) || X.cur(); const it = await taMake(c, ''); sendMsg(c, it, 'ta'); window.gyxMemeOpen(c.id, 'mine'); return it; };
window.gyxMemeSend = id => { const it = D.list.find(x => x.id === id), c = it && X.char(it.cid); if (c) { sendMsg(c, it, 'me'); X.toast('🎨 发出去了', ''); } };
window.gyxMemeDel = async id => { const it = D.list.find(x => x.id === id); D.list = D.list.filter(x => x.id !== id); try { if (it && it.emo && typeof globalEmoticons !== 'undefined') { const i = globalEmoticons.findIndex(e => e.id === it.emo); if (i >= 0) globalEmoticons.splice(i, 1); saveAllData(); } } catch (e) {} await S.set('d', D); window.gyxMemeOpen(it && it.cid, 'mine'); };
window.gyxMemeData = () => D;
window.gyxMemeOpen = function (who, tab) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), src = sources(c); if (!ST.img && src[0]) ST.img = src[0][1];
    if (tab === 'mine') { X.panel('gyxMmOv', '🎨 表情包工坊', `<div class="gyx-row">${X.whoSel(cid, 'gyxMemeOpen')}<span class="gyx-chip" onclick="gyxMemeOpen('${cid}')">‹ 去做新的</span><button class="gyx-btn lite" onclick="this.disabled=true;gyxMemeTa('${cid}')">让 TA 做一张来斗图</button></div><div class="mm-grid">${D.list.filter(x => x.cid === cid).map(x => `<div><img src="${x.src}"><em>${x.by === 'ta' ? 'TA 做的' : '我做的'}</em><span><a onclick="gyxMemeSend('${x.id}')">发送</a><a onclick="gyxMemeDel('${x.id}')">删</a></span></div>`).join('') || '<div class="gyx-tip">还没做过</div>'}</div>`); return; }
    X.panel('gyxMmOv', '🎨 表情包工坊', `<div class="gyx-row">${X.whoSel(cid, 'gyxMemeOpen')}<span class="gyx-chip" onclick="gyxMemeOpen('${cid}','mine')">我们的表情包（${D.list.filter(x => x.cid === cid).length}）</span></div>
        <div class="mm-wrap"><img id="gyxMmPrev" class="mm-prev"><div class="mm-ctl">
        <div class="mm-src">${src.map(([n, s]) => `<img src="${s}" title="${n}" data-s="${X.esc(s.slice(0, 60))}" class="${ST.img === s ? 'on' : ''}" onclick="gyxMemeSet('img',this.src)">`).join('')}<label class="mm-up">＋<input type="file" accept="image/*" style="display:none" onchange="gyxMemeUp(this)"></label></div>
        <input class="gyx-in" placeholder="上面的字（可空）" value="${X.esc(ST.top)}" oninput="gyxMemeSet('top',this.value)"><input class="gyx-in" style="margin-top:6px" placeholder="下面的字" value="${X.esc(ST.bottom)}" oninput="gyxMemeSet('bottom',this.value)">
        <div class="mm-phr">${PHR.map(p => `<span class="gyx-chip" onclick="this.closest('.mm-ctl').querySelectorAll('input.gyx-in')[1].value='${p}';gyxMemeSet('bottom','${p}')">${p}</span>`).join('')}</div>
        <div class="gyx-row">字 <input type="range" min="18" max="72" value="${ST.size}" oninput="gyxMemeSet('size',+this.value)" style="flex:1"><input type="color" value="${ST.color}" onchange="gyxMemeSet('color',this.value)" title="字的颜色"><input type="color" value="${ST.stroke}" onchange="gyxMemeSet('stroke',this.value)" title="描边"><input type="color" value="${ST.bg}" onchange="gyxMemeSet('bg',this.value)" title="底色"></div>
        <div class="gyx-row">${[['sans', '圆体'], ['bold', '粗黑'], ['hand', '手写']].map(([k, n]) => `<span class="gyx-chip${ST.font === k ? ' on' : ''}" onclick="gyxMemeSet('font','${k}');this.parentNode.querySelectorAll('.gyx-chip').forEach(e=>e.classList.remove('on'));this.classList.add('on')">${n}</span>`).join('')}${[['sq', '方'], ['wide', '扁']].map(([k, n]) => `<span class="gyx-chip" onclick="gyxMemeSet('shape','${k}')">${n}</span>`).join('')}</div>
        <div class="gyx-row"><button class="gyx-btn" onclick="gyxMemeSave('${cid}')">存进表情包库</button><button class="gyx-btn lite" onclick="gyxMemeSave('${cid}',1)">存好直接发</button></div></div></div>`);
    paint();
};
X.ctx(id => { const L = D.list.filter(x => x.cid === String(id) && x.by === 'me').slice(0, 4); return L.length ? `【她用你的照片做过表情包】配字：${L.map(x => '「' + x.text + '」').join('')}。` : ''; }, 'gyxMeme');
X.action({ key: 'gyx_meme', label: '用自己的照片做一张表情包发给她', hint: '斗图', need: c => !!imgOf(c) && !D.list.some(x => x.cid === String(c.id) && x.by === 'ta' && Date.now() - x.at < 2 * 864e5),
    run: async c => { const it = await taMake(c, '想逗逗她'); sendMsg(c, it, 'ta'); return '做了张表情包：' + it.text; } }, 'gyxMeme');
X.today(() => ({ title: '🎨 表情包', rows: D.list.filter(x => X.day(new Date(x.at)) === X.day()).slice(0, 4).map(x => ({ t: x.by === 'ta' ? 'TA 做的' : '我做的', x: X.esc(x.text), go: `gyxMemeOpen('${x.cid}','mine')` })) }), 'gyxMeme');
X.widget('gyxMemeW', { n: '表情包工坊', sizes: ['s', 'm'], tap: () => window.gyxMemeOpen(), r: w => { const x = D.list[0]; if (!x) return X.gw(w, '🎨', '表情包工坊', ['做一张？']); return `<div class="gw-x ${w.size === 's' ? 's' : 'm'}" style="background:#fff url(${x.src}) center/contain no-repeat;border-radius:inherit"></div>`; } }, 'gyxMeme');
X.memArr({ k: 'gyxMeme', ico: '🎨', n: '表情包工坊', d: '做过的表情包（改的是配字的记录，图不变）', arr: () => D.list, field: 'text', text: x => x.text, meta: x => (x.by === 'ta' ? 'TA 做的' : '我做的') + ' · ' + new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxMeme');
X.css('gyxMmCss', `.mm-wrap{display:flex;gap:14px;flex-wrap:wrap}.mm-prev{width:200px;height:200px;object-fit:contain;border-radius:14px;background:repeating-conic-gradient(#f3f3f3 0 25%,#fff 0 50%) 0 0/16px 16px;flex:none;margin:0 auto}.mm-ctl{flex:1;min-width:220px}.mm-src{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.mm-src img{width:46px;height:46px;object-fit:cover;border-radius:10px;cursor:pointer;border:2px solid transparent}.mm-src img.on{border-color:#ff7aa2}.mm-up{width:46px;height:46px;border-radius:10px;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;color:#aaa;cursor:pointer;font-size:20px}.mm-phr{max-height:74px;overflow:auto;margin:6px 0}.mm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}.mm-grid>div{text-align:center}.mm-grid img{width:100%;border-radius:12px;background:#f7f7f7}.mm-grid em{display:block;font-style:normal;font-size:11px;color:#999}.mm-grid span a{font-size:12px;margin:0 4px;cursor:pointer;color:#1d9bf0}`);
X.mini({ id: 'gyxMeme', icon: '🎨', title: '表情包工坊', desc: '用 TA 的照片做表情包', cat: '一起做', onOpen: () => window.gyxMemeOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.list = D.list || []; })();
