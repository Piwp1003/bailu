/* 📼 留声机：录一盘磁带给 TA——想说的话、哼的歌、窗外的雨声都行。TA 听完会录 B 面回给你（用 TA 的声音念）。TA 也会自己录磁带：睡前故事、早安、想你的时候。所有磁带摆在一个架子上，放的时候唱片会转 */
if (window.__gyxTape) return; window.__gyxTape = 1;
X.feat('gyxTape', { n: '📼 留声机', desc: '录磁带给 TA，TA 录 B 面回你；TA 也会自己录磁带' });
const S = X.store('tape');
let D = { tapes: [], cfg: { max: 180 } };   // [{id, cid, by:'me'|'ta', title, audio, text, at, reply, dur}]
let REC = null, SR = null, PLAY = null;
const COL = ['#ff8a80', '#ffd180', '#a7ffeb', '#82b1ff', '#ea80fc', '#ccff90', '#ffab91'];
const col = id => COL[[...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COL.length];
const mmss = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
function spin(on) { const r = document.getElementById('gyxTpeRec'); if (r) r.classList.toggle('on', !!on); }
window.gyxTapeRec = async cid => {
    if (REC) { REC.stop(); return; }
    let st; try { st = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { X.toast('📼 打不开麦克风', e.name || ''); return; }
    const ch = [], mr = new MediaRecorder(st), t0 = Date.now(); let text = '';
    try { const R = window.SpeechRecognition || window.webkitSpeechRecognition; if (R) { SR = new R(); SR.lang = 'zh-CN'; SR.continuous = true; SR.interimResults = false; SR.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript + '，'; }; SR.start(); } } catch (e) { SR = null; }
    mr.ondataavailable = e => e.data.size && ch.push(e.data);
    mr.onstop = async () => { st.getTracks().forEach(t => t.stop()); try { SR && SR.stop(); } catch (e) {} SR = null; REC = null; spin(false); clearInterval(window.__gyxTpeT);
        const blob = new Blob(ch, { type: mr.mimeType || 'audio/webm' }), audio = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
        const title = ((document.getElementById('gyxTpeTi') || {}).value || '').trim() || X.v('给你的一盘磁带', '没写标签的磁带', X.day() + ' 的磁带');
        const it = { id: 'tp' + Date.now().toString(36), cid: String(cid), by: 'me', title, audio, text: text.replace(/，$/, ''), at: Date.now(), dur: (Date.now() - t0) / 1000, reply: null };
        D.tapes.unshift(it); await S.set('d', D); window.gyxTapeOpen(cid); replyTo(it); };
    mr.start(); REC = mr; spin(true);
    window.__gyxTpeT = setInterval(() => { const s = (Date.now() - t0) / 1000, b = document.getElementById('gyxTpeTime'); if (b) b.textContent = '● ' + mmss(s); if (s >= (+D.cfg.max || 180)) mr.stop(); }, 300);
    const b = document.getElementById('gyxTpeBtn'); if (b) b.textContent = '■ 录好了';
};
async function replyTo(it) {
    const c = X.char(it.cid); if (!c) return;
    let r = X.bailu() ? null : await X.ask(`${X.who(c)}\n她录了一盘磁带给你（${mmss(it.dur)}，标签：「${it.title}」）。${it.text ? '你听到她说：「' + it.text.slice(0, 600) + '」' : '你听不太清她说了什么（可能是哼歌、环境声或者小声说话），但你听到了她的声音。'}\n你录 B 面回她：像对着录音机说话一样，自然、有停顿，60~150 字。只写你说的话。`);
    it.reply = X.plain(r || X.pick(X.cards(['情话', '晚安'], c, 2).concat(['我听了好几遍。你的声音从录音机里出来，有一点沙沙的，很好听。', '……按下录音键了吗？嗯。我是想说，你的磁带我收到了。我会好好收着的。', '你那边好安静啊。我把耳朵贴着听，好像你就在旁边。'])));
    await S.set('d', D); X.notify(c, `📼 ${X.esc(X.name(c))} ${X.v('录好了 B 面', '回了你一盘磁带', '把 B 面放进你的架子了')}`, it.title, () => window.gyxTapePlay(it.id, 'b')); if (document.getElementById('gyxTpeOv')) window.gyxTapeOpen(it.cid);
}
async function taTape(c, why) {
    let j = X.bailu() ? null : X.json(await X.ask(`${X.who(c)}\n你想录一盘磁带给她（${why || '想她的时候'}），现在 ${new Date().getHours()} 点。\n最近的聊天：\n${X.recent(c, 12)}\n只输出 JSON：{"title":"磁带标签（8 字内）","text":"你对着录音机说的话，80~200 字，可以讲个小故事、说早安晚安、哼两句（写成文字）"}`));
    if (!j || !j.text) { const cs = X.cards(['晚安', '情话', '聊天'], c, 3); j = { title: X.pick(['睡前故事', '早安', '想你的时候', '雨天录的']), text: cs.join('……') || '喂，喂？录上了吗。嗯……也没什么事，就是想让你听听我的声音。' }; }
    const it = { id: 'tp' + Date.now().toString(36), cid: String(c.id), by: 'ta', title: String(j.title).slice(0, 12), audio: null, text: X.plain(j.text), at: Date.now(), dur: X.plain(j.text).length / 4 };
    D.tapes.unshift(it); await S.set('d', D); return it;
}
function stopPlay() { try { if (PLAY && PLAY.pause) PLAY.pause(); } catch (e) {} X.stopSpeak(); PLAY = null; spin(false); }
window.gyxTapePlay = (id, side) => {
    const it = D.tapes.find(x => x.id === id); if (!it) return; if (!document.getElementById('gyxTpeOv')) window.gyxTapeOpen(it.cid); stopPlay(); spin(true);
    const c = X.char(it.cid), lab = document.getElementById('gyxTpeNow'); if (lab) lab.innerHTML = `▶ ${X.esc(it.title)}${side === 'b' ? ' · B 面' : ''}<div class="gyx-tip">${X.esc(side === 'b' ? it.reply || '' : it.by === 'ta' ? it.text : it.text || '（你的声音）')}</div>`;
    if (side !== 'b' && it.audio) { PLAY = new Audio(it.audio); PLAY.onended = () => spin(false); PLAY.play().catch(() => spin(false)); }
    else { PLAY = {}; X.speak(c, side === 'b' ? it.reply : it.text, () => spin(false)); }
};
window.gyxTapeStop = stopPlay;
window.gyxTapeData = () => D;
window.gyxTapeDel = async id => { const x = D.tapes.find(t => t.id === id); D.tapes = D.tapes.filter(t => t.id !== id); await S.set('d', D); window.gyxTapeOpen(x && x.cid); };
window.gyxTapeAsk = async cid => { const c = X.char(cid); if (!c) return; const it = await taTape(c, '她想听你的声音'); window.gyxTapeOpen(cid); window.gyxTapePlay(it.id); };
window.gyxTapeOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), L = D.tapes.filter(x => x.cid === cid);
    const ov = X.panel('gyxTpeOv', '📼 留声机', `<div class="gyx-row">${X.whoSel(cid, 'gyxTapeOpen')}</div>
        <div class="tape-deck"><div id="gyxTpeRec" class="tape-rec"><i></i></div><div id="gyxTpeNow" class="tape-now">${X.v('放一盘，或者录一盘。', '唱针落下去之前，屋里很安静。', '架子上的每一盘，都是你们的声音。')}</div></div>
        <div class="gyx-row"><input id="gyxTpeTi" class="gyx-who" style="flex:1" placeholder="磁带标签（可空）"><button id="gyxTpeBtn" class="gyx-btn" onclick="gyxTapeRec('${cid}')">● 录一盘给 TA</button><span id="gyxTpeTime" class="gyx-tip"></span></div>
        <div class="gyx-row"><button class="gyx-btn lite" onclick="this.disabled=true;gyxTapeAsk('${cid}')">让 TA 录一盘</button><button class="gyx-btn lite" onclick="gyxTapeStop()">■ 停</button></div>
        <div class="tape-shelf">${L.map(x => `<div class="tape-cas" style="--c:${col(x.id)}"><div class="tape-lab" onclick="gyxTapePlay('${x.id}')"><b>${X.esc(x.title)}</b><em>${x.by === 'me' ? '你录的' : X.esc(X.name(c)) + ' 录的'} · ${mmss(x.dur || 0)} · ${new Date(x.at).toLocaleDateString()}</em></div>${x.by === 'me' ? (x.reply ? `<span class="gyx-chip" onclick="gyxTapePlay('${x.id}','b')">B 面</span>` : '<span class="gyx-tip">TA 在听…</span>') : ''}<i onclick="gyxTapeDel('${x.id}')">✕</i></div>`).join('') || '<div class="gyx-tip">架子还空着</div>'}</div>`, 'dark');
    const rm = ov.remove.bind(ov); ov.remove = () => { stopPlay(); try { REC && REC.stop(); } catch (e) {} rm(); };
};
X.ctx(id => { const x = D.tapes.find(t => t.cid === String(id) && t.by === 'me'); return x && Date.now() - x.at < 2 * 864e5 ? `【她前不久录了一盘磁带给你】「${x.title}」${x.text ? '，里面说：' + x.text.slice(0, 120) : ''}` : ''; }, 'gyxTape');
X.action({ key: 'gyx_tape', label: '录一盘磁带给她', hint: '留声机', need: c => !D.tapes.some(x => x.cid === String(c.id) && x.by === 'ta' && Date.now() - x.at < 3 * 864e5),
    run: async c => { const h = new Date().getHours(), it = await taTape(c, h >= 21 || h < 2 ? '睡前' : h < 10 ? '早上' : '想她的时候'); X.notify(c, `📼 ${X.esc(X.name(c))} ${X.v('录了一盘磁带给你', '往你的架子上放了一盘磁带')}`, it.title, () => window.gyxTapePlay(it.id)); return '录了一盘磁带：' + it.title; } }, 'gyxTape');
X.today(() => ({ title: '📼 留声机', rows: D.tapes.filter(x => X.day(new Date(x.at)) === X.day()).map(x => ({ t: x.by === 'me' ? '你录的' : 'TA 录的', x: X.esc(x.title), go: `gyxTapePlay('${x.id}')` })) }), 'gyxTape');
X.widget('gyxTapeW', { n: '留声机', sizes: ['s', 'm'], tap: () => { const x = D.tapes.find(t => t.by === 'ta'); x ? window.gyxTapePlay(x.id) : window.gyxTapeOpen(); }, r: w => { const x = D.tapes[0]; return X.gw(w, '📼', '留声机', x ? [X.esc(x.title), D.tapes.length + ' 盘磁带'] : ['录一盘？']); } }, 'gyxTape');
X.memArr({ k: 'gyxTape', ico: '📼', n: '留声机', d: '磁带（标签、内容、TA 的 B 面）', arr: () => D.tapes, text: x => x.title + '：' + (x.text || '（录音）') + (x.reply ? ' ｜B面：' + x.reply : ''), edit: (x, v) => { const m = v.match(/^([^：]*)：([\s\S]*?)(?: ｜B面：([\s\S]*))?$/); if (m) { x.title = m[1]; x.text = m[2] === '（录音）' ? '' : m[2]; if (m[3] != null) x.reply = m[3]; } }, meta: x => (x.by === 'me' ? '你录的' : 'TA 录的') + ' · ' + new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxTape');
X.css('gyxTapeCss', `.tape-deck{display:flex;gap:14px;align-items:center;padding:10px 0}.tape-rec{width:96px;height:96px;flex:none;border-radius:50%;background:repeating-radial-gradient(#111 0 3px,#222 3px 5px);position:relative;box-shadow:0 6px 18px rgba(0,0,0,.5)}.tape-rec i{position:absolute;inset:34px;border-radius:50%;background:#ff8a80}.tape-rec.on{animation:tpr 1.8s linear infinite}@keyframes tpr{to{transform:rotate(360deg)}}.tape-now{flex:1;font-size:14px;line-height:1.6;max-height:120px;overflow:auto}.tape-shelf{display:flex;flex-direction:column;gap:8px;margin-top:8px}.tape-cas{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;background:#2c2c2e;border-left:8px solid var(--c);position:relative}.tape-lab{flex:1;cursor:pointer}.tape-lab em{display:block;font-style:normal;font-size:11.5px;color:#999}.tape-cas i{font-style:normal;color:#777;cursor:pointer;font-size:12px}.gyx-ov.dark .gyx-chip{background:#3a3a3c;color:#eee}.gyx-ov.dark .gyx-who{background:#2c2c2e;color:#eee;border-color:#3a3a3c}`);
X.mini({ id: 'gyxTape', icon: '📼', title: '留声机', desc: '录磁带给 TA，TA 录 B 面回你', cat: '陪伴', onOpen: () => window.gyxTapeOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.tapes = D.tapes || []; D.cfg = Object.assign({ max: 180 }, D.cfg || {}); })();
