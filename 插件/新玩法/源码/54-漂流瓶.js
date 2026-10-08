/* 🍾 漂流瓶：把一句话装进瓶子扔进海里——过几个小时，会被某个角色捡到、写回信（TA 不知道是你写的，说不定还会跟你提起「我捡到一个瓶子」）。你也能去海边捡瓶子：里面可能是 TA 匿名写下的、不好意思当面说的心里话 */
if (window.__gyxBottle) return; window.__gyxBottle = 1;
X.feat('gyxBottle', { n: '🍾 漂流瓶', desc: '扔瓶子给陌生的 TA 们回信，捡到 TA 匿名写下的心里话' });
const S = X.store('bottle');
let D = { out: [], got: [], cfg: { per: 3 } };   // out = [{id, text, at, to, due, reply, rat}]；got = [{id, from, text, at, kept}]
const H = () => Math.floor(X.rnd(1, 7) * 36e5);
async function answer(b) {
    const c = X.char(b.to); if (!c) return;
    let r = X.bailu() ? null : await X.ask(`你是${X.name(c)}。${X.persona(c)}\n你在海边捡到一个漂流瓶，里面是一个陌生人写的话（你不知道是谁）：\n「${b.text}」\n按你的性格写一封简短的回信，放回瓶子里扔回海里（50~120 字）。`);
    b.reply = X.plain(r || X.pick(X.cards(['漂流瓶', '心事', '情话'], c, 2).concat(['捡到你的瓶子了。不知道你是谁，但希望你今天过得好一点。', '你的字我读了三遍。海很大，别怕。', '我也有过这样的时候。会好的。'])));
    b.rat = Date.now(); await S.set('d', D);
    X.notify(c, `🍾 ${X.v('你的瓶子漂回来了', '有人捡到了你的漂流瓶', '海浪把回信送回来了')}`, `${X.esc(X.name(c))} 写了回信`, () => window.gyxBottleOpen('out'));
}
async function pick() {
    const today = X.day(), n = D.got.filter(x => X.day(new Date(x.at)) === today).length; if (n >= (+D.cfg.per || 3)) return { msg: X.v('今天的海很安静，明天再来吧。', '浪退下去了，今天捡不到了。', '你今天已经捡了好几个了，留点给别人。') };
    const cs = X.chars(); if (!cs.length) return { msg: '海里还没有人。' };
    const cur = X.cur(), c = Math.random() < .55 && cur ? cur : X.pick(cs);
    let t = X.bailu() ? null : await X.ask(`你是${X.name(c)}。${X.persona(c)}\n你在写一个匿名漂流瓶扔进海里，没人知道是你写的，也不知道谁会捡到。写一段平时不好意思当面说出口的心里话（${c === cur ? '关于你喜欢的那个人——她叫' + X.me(c) + '，但别写名字' : '关于你自己、你的日子，或者你在意的人'}），40~120 字，只写瓶子里的话。`);
    t = X.plain(t || X.pick(X.cards(['漂流瓶', '心事', '情话'], c, 3).concat(['今天又没敢说出口。其实我每天都在等那个人的消息。', '有时候会想，如果哪天我不在了，会不会有人记得我说过的话。', '我好像越来越离不开一个人了。这算不算一种软弱？'])));
    const it = { id: 'bt' + Date.now().toString(36), from: String(c.id), text: t, at: Date.now() }; D.got.unshift(it); await S.set('d', D); return { it };
}
window.gyxBottleThrow = async () => {
    const inp = document.getElementById('gyxBtlIn'), t = (inp && inp.value || '').trim(); if (!t) return; const cs = X.chars(); if (!cs.length) return;
    const sel = (document.getElementById('gyxBtlTo') || {}).value, to = sel && sel !== 'rand' ? sel : X.pick(cs).id;
    D.out.unshift({ id: 'bo' + Date.now().toString(36), text: t, at: Date.now(), to: String(to), due: Date.now() + H(), reply: null }); await S.set('d', D);
    const b = document.getElementById('gyxBtlSea'); if (b) { b.classList.add('throw'); setTimeout(() => window.gyxBottleOpen('out'), 1400); } else window.gyxBottleOpen('out');
};
window.gyxBottlePick = async () => { const b = document.getElementById('gyxBtlSea'); if (b) b.classList.add('wave'); const r = await pick(); const box = document.getElementById('gyxBtlGot'); if (!box) return; if (r.msg) { box.innerHTML = `<div class="gyx-tip">${r.msg}</div>`; return; } box.innerHTML = `<div class="btl-pap gyx-hand">${X.esc(r.it.text)}</div><div class="gyx-row" style="justify-content:center"><button class="gyx-btn lite" onclick="gyxBottleKeep('${r.it.id}')">收着</button><button class="gyx-btn lite" onclick="gyxBottleWho('${r.it.id}')">猜猜是谁写的</button></div>`; };
window.gyxBottleKeep = async id => { const x = D.got.find(g => g.id === id); if (x) { x.kept = true; await S.set('d', D); X.toast('🍾 收好了', ''); } };
window.gyxBottleWho = id => { const x = D.got.find(g => g.id === id); if (!x) return; const c = X.char(x.from); X.toast('🍾 ' + X.v('瓶底刻着一个名字', '字迹好眼熟', '你认出来了'), X.name(c)); x.known = true; S.set('d', D); };
window.gyxBottleDel = async (k, id) => { D[k] = D[k].filter(x => x.id !== id); await S.set('d', D); window.gyxBottleOpen(k); };
window.gyxBottleOpen = function (tab) {
    tab = tab || 'sea'; const T = [['sea', '🌊 海边'], ['out', '我扔的'], ['got', '我捡的']];
    let body = '';
    if (tab === 'sea') body = `<div id="gyxBtlSea" class="btl-sea"><div class="btl-b">🍾</div></div>
        <textarea id="gyxBtlIn" class="gyx-in" rows="3" placeholder="${X.v('写一句不知道该对谁说的话…', '装进瓶子里的话，没人知道是你写的。', '今天想对大海说什么？')}"></textarea>
        <div class="gyx-row"><select id="gyxBtlTo" class="gyx-who"><option value="rand">随便漂到谁那儿</option>${X.chars().map(c => `<option value="${X.esc(c.id)}">漂向 ${X.esc(X.name(c))}</option>`).join('')}</select><button class="gyx-btn" onclick="gyxBottleThrow()">扔出去</button><button class="gyx-btn lite" onclick="this.disabled=true;gyxBottlePick()">去捡一个</button></div><div id="gyxBtlGot"></div>
        <div class="gyx-tip">捡到的瓶子是角色们匿名写的——可能就是 TA。捡到的人不知道瓶子是你扔的。</div>`;
    if (tab === 'out') body = D.out.map(x => `<div class="gyx-card"><div>${X.esc(x.text)}</div>${x.reply ? `<div class="btl-pap gyx-hand">${X.esc(x.reply)}<div class="gyx-tip">—— ${X.esc(X.name(X.char(x.to)))}（TA 不知道是你）</div></div>` : `<div class="gyx-tip">还在海上漂……${x.due > Date.now() ? '大概 ' + Math.ceil((x.due - Date.now()) / 36e5) + ' 小时后有回音' : ''}</div>`}<span class="gyx-chip" onclick="gyxBottleDel('out','${x.id}')">删</span></div>`).join('') || '<div class="gyx-tip">还没扔过</div>';
    if (tab === 'got') body = D.got.map(x => `<div class="gyx-card"><div class="btl-pap gyx-hand">${X.esc(x.text)}</div><div class="gyx-tip">${new Date(x.at).toLocaleString()}${x.known ? ' · ' + X.esc(X.name(X.char(x.from))) + ' 写的' : ''}${x.kept ? ' · 收着' : ''}</div><span class="gyx-chip" onclick="gyxBottleWho('${x.id}')">是谁</span><span class="gyx-chip" onclick="gyxBottleDel('got','${x.id}')">扔回海里</span></div>`).join('') || '<div class="gyx-tip">还没捡过</div>';
    X.panel('gyxBtlOv', '🍾 漂流瓶', `<div class="gyx-row">${T.map(([k, n]) => `<span class="gyx-chip${k === tab ? ' on' : ''}" onclick="gyxBottleOpen('${k}')">${n}</span>`).join('')}</div>${body}`);
};
window.gyxBottleData = () => D;
window.gyxBottleTick = () => tick();
async function tick() { if (!X.on('gyxBottle')) return; for (const b of D.out) if (!b.reply && b.due <= Date.now()) await answer(b); }
X.ctx(id => { const b = D.out.find(x => x.to === String(id) && x.reply && Date.now() - x.rat < 3 * 864e5); return b ? `【你前阵子在海边捡到一个漂流瓶】里面写着「${b.text}」，你回了信。你不知道是谁写的（其实是她，但你不知道）。可以随口提起这件事。` : ''; }, 'gyxBottle');
X.action({ key: 'gyx_bottle', label: '匿名写个漂流瓶扔进海里', hint: '心里话', need: c => !D.got.some(x => x.from === String(c.id) && Date.now() - x.at < 864e5),
    run: async c => { X.notify(c, '🍾 ' + X.v('海边漂来一个新瓶子', '浪打上来一个瓶子', '有人刚扔了一个漂流瓶'), '去海边看看？', () => window.gyxBottleOpen('sea')); return '扔了一个漂流瓶'; } }, 'gyxBottle');
X.today(() => ({ title: '🍾 漂流瓶', rows: D.out.filter(x => x.reply && X.day(new Date(x.rat)) === X.day()).map(x => ({ t: '回信', x: X.esc(x.reply.slice(0, 24)), go: "gyxBottleOpen('out')" })).concat(D.out.filter(x => !x.reply).length ? [{ t: '漂着', x: D.out.filter(x => !x.reply).length + ' 个瓶子还在海上', go: "gyxBottleOpen('out')" }] : []) }), 'gyxBottle');
X.widget('gyxBottleW', { n: '漂流瓶', sizes: ['s', 'm'], tap: () => window.gyxBottleOpen(), r: w => { const r = D.out.find(x => x.reply); return X.gw(w, '🍾', '漂流瓶', r ? ['有回信', X.esc(r.reply.slice(0, 30))] : ['扔一个？']); } }, 'gyxBottle');
X.mem({ k: 'gyxBottle', ico: '🍾', n: '漂流瓶', d: '你扔的瓶子被 TA 捡到、回的信（TA 不知道是你）', items: c => D.out.filter(x => x.to === String(c.id)), text: x => x.text + (x.reply ? ' → ' + x.reply : ''), edit: (x, v) => { const [a, b] = v.split(' → '); x.text = a; if (b != null) x.reply = b; }, del: (c, i) => { const it = D.out.filter(x => x.to === String(c.id))[i]; D.out = D.out.filter(x => x !== it); }, meta: x => new Date(x.at).toLocaleString(), save: () => S.set('d', D) }, 'gyxBottle');
X.css('gyxBtlCss', `.btl-sea{height:120px;border-radius:18px;background:linear-gradient(#bfe6ff,#5fb4e8 60%,#3a8fcf);position:relative;overflow:hidden;margin:6px 0 10px}.btl-sea::after{content:'';position:absolute;left:-10%;right:-10%;bottom:-20px;height:50px;background:rgba(255,255,255,.35);border-radius:50%;animation:btlw 3s ease-in-out infinite}@keyframes btlw{50%{transform:translateX(5%)}}.btl-b{position:absolute;left:46%;top:40px;font-size:38px;animation:btlf 2.6s ease-in-out infinite}@keyframes btlf{50%{transform:translateY(-6px) rotate(12deg)}}.btl-sea.throw .btl-b{animation:btlt 1.4s forwards}@keyframes btlt{to{transform:translate(160px,30px) rotate(200deg) scale(.3);opacity:0}}.btl-sea.wave .btl-b{animation:btlp 1.2s}@keyframes btlp{from{transform:translate(-160px,30px) scale(.3)}}.btl-pap{background:#fbf6e9;border-radius:12px;padding:12px 14px;font-size:17px;line-height:1.8;margin:8px 0;box-shadow:inset 0 0 20px rgba(180,150,90,.15)}`);
X.mini({ id: 'gyxBottle', icon: '🍾', title: '漂流瓶', desc: '扔瓶子、捡瓶子，捡到 TA 匿名写的心里话', cat: '陪伴', onOpen: () => window.gyxBottleOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.out = D.out || []; D.got = D.got || []; D.cfg = Object.assign({ per: 3 }, D.cfg || {}); setTimeout(tick, 15000); setInterval(tick, 60000); })();
