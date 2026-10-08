/* 🎵 TA 写给你的歌：TA 把你们的事写成一首原创的歌——有歌名、有歌词，还会用一台小小的合成器把旋律哼给你听（一个字一个音，歌词跟着一个字一个字亮起来）。写过的歌都收在歌本里，想听就放 */
if (window.__gyxSong) return; window.__gyxSong = 1;
X.feat('gyxSong', { n: '🎵 TA 写给你的歌', desc: 'TA 把你们的事写成原创歌，还会用合成器哼旋律给你听' });
const S = X.store('song');
let D = { list: [], cfg: { wave: 'triangle', vol: 60 } };   // [{id, cid, title, mood, bpm, lyrics:[], seed, at, note}]
const MOODS = { 甜: { s: [0, 2, 4, 7, 9], root: 60, bpm: 96 }, 温柔: { s: [0, 2, 4, 7, 9], root: 57, bpm: 76 }, 欢快: { s: [0, 2, 4, 7, 9], root: 64, bpm: 120 }, 忧伤: { s: [0, 3, 5, 7, 10], root: 57, bpm: 70 } };
const syl = l => [...String(l).replace(/[\s，。！？、,.!?…~～「」“”]/g, '')];
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
// 旋律：每个字一个音，在五声音阶上随机走几步；句尾落在主音或五音上、拖长
function melody(song) {
    const M = MOODS[song.mood] || MOODS['温柔'], r = rng(song.seed), out = []; let deg = 2;
    song.lyrics.forEach((line, li) => { const cs = syl(line); cs.forEach((ch, k) => { const last = k === cs.length - 1; if (last) deg = (li % 2 ? 0 : 3); else { deg += Math.round((r() - .5) * 3); deg = Math.max(0, Math.min(7, deg)); } const oct = Math.floor(deg / 5), pc = M.s[deg % 5]; out.push({ li, k, midi: M.root + 12 * oct + pc, dur: last ? 2 : (r() < .25 ? 1.5 : r() < .3 ? .5 : 1) }); }); out.push({ li, k: -1, midi: null, dur: 1 }); });
    return out;
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
let AC = null, PLAY = null;
function stop() { if (PLAY) { PLAY.stop = true; PLAY.timers.forEach(clearTimeout); try { PLAY.nodes.forEach(n => n.stop()); } catch (e) {} } PLAY = null; document.querySelectorAll('.sg-l i.on').forEach(e => e.classList.remove('on')); }
window.gyxSongPlay = id => {
    const song = D.list.find(x => x.id === id); if (!song) return; stop();
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { X.toast('🎵 这台设备放不了声音', ''); return; }
    const M = MOODS[song.mood] || MOODS['温柔'], beat = 60 / (song.bpm || M.bpm), notes = melody(song), t0 = AC.currentTime + .15, vol = (+D.cfg.vol || 60) / 100 * .22; let t = 0;
    PLAY = { id, timers: [], nodes: [] };
    notes.forEach(n => {
        const at = t0 + t * beat, d = n.dur * beat;
        if (n.midi != null) { const o = AC.createOscillator(), g = AC.createGain(); o.type = D.cfg.wave || 'triangle'; o.frequency.value = hz(n.midi); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + .03); g.gain.exponentialRampToValueAtTime(.0008, at + d * .95); o.connect(g).connect(AC.destination); o.start(at); o.stop(at + d); PLAY.nodes.push(o);
            if (n.k === 0) { const p = AC.createOscillator(), pg = AC.createGain(); p.type = 'sine'; p.frequency.value = hz(M.root - 12 + (n.li % 2 ? 7 : 0)); pg.gain.setValueAtTime(0, at); pg.gain.linearRampToValueAtTime(vol * .45, at + .2); pg.gain.linearRampToValueAtTime(0, at + beat * Math.max(4, syl(song.lyrics[n.li]).length)); p.connect(pg).connect(AC.destination); p.start(at); p.stop(at + beat * Math.max(4, syl(song.lyrics[n.li]).length) + .1); PLAY.nodes.push(p); }
            PLAY.timers.push(setTimeout(() => { if (!PLAY || PLAY.id !== id) return; document.querySelectorAll('.sg-l i.on').forEach(e => e.classList.remove('on')); const e = document.querySelector(`.sg-l[data-l="${n.li}"] i[data-k="${n.k}"]`); if (e) { e.classList.add('on'); e.classList.add('sung'); } }, (at - AC.currentTime) * 1000)); }
        t += n.dur;
    });
    PLAY.timers.push(setTimeout(() => { if (PLAY && PLAY.id === id) { PLAY = null; document.querySelectorAll('.sg-l i').forEach(e => e.classList.remove('on')); } }, (t * beat + .5) * 1000));
    return { notes: notes.length, sec: Math.round(t * beat) };
};
window.gyxSongStop = stop;
async function write(c, theme) {
    let j = null;
    if (!X.bailu()) j = X.json(await X.ask(`${X.who(c)}\n你要给她写一首原创的歌${theme ? '，关于：' + theme : '，写你们之间的事'}。\n最近的聊天：\n${X.recent(c, 16)}\n要求：原创，不要引用任何现成的歌词；8~12 行，每行 5~12 个字，有具体的细节（你们说过的话、做过的事），押一点韵；选一个情绪。\n只输出 JSON：{"title":"歌名","mood":"甜 或 温柔 或 欢快 或 忧伤","lyrics":["第一行","第二行"],"note":"写完想对她说的一句话"}`));
    if (!j || !Array.isArray(j.lyrics) || j.lyrics.length < 4) {
        const cs = X.cards(['情话', '聊天', '晚安'], c, 8).map(t => X.plain(t).replace(/[。！？!?]$/, '').slice(0, 14)).filter(t => t.length >= 3);
        const base = ['今天的风很轻', '我又想起你', '你说晚安的时候', '我还没有睡去', '窗外的灯一盏一盏', '亮在你回来的路上', '如果你累了', '就靠在我肩上'];
        j = { title: X.pick(['给你的歌', '晚安曲', '小日子', '慢慢来', '你在就好']), mood: X.pick(Object.keys(MOODS)), lyrics: base.map((b, i) => cs[i] || b), note: X.v('写得不好，你别笑。', '第一次给人写歌，就写给你了。', '哼给你听。') };
    }
    const song = { id: 'sg' + Date.now().toString(36), cid: String(c.id), title: X.plain(j.title).slice(0, 16), mood: MOODS[j.mood] ? j.mood : '温柔', lyrics: j.lyrics.slice(0, 14).map(l => X.plain(l).slice(0, 18)).filter(Boolean), seed: Math.floor(Math.random() * 1e9), at: Date.now(), note: X.plain(j.note || '') };
    song.bpm = MOODS[song.mood].bpm; D.list.unshift(song); await S.set('d', D); return song;
}
window.gyxSongWrite = async cid => { const c = X.char(cid) || X.cur(); if (!c) return null; const th = ((document.getElementById('gyxSgTh') || {}).value || '').trim(); const s = await write(c, th); window.gyxSongOpen(c.id, s.id); return s; };
window.gyxSongRedo = async id => { const s = D.list.find(x => x.id === id); if (!s) return; s.seed = Math.floor(Math.random() * 1e9); await S.set('d', D); window.gyxSongPlay(id); };
window.gyxSongEdit = async (id, li, v) => { const s = D.list.find(x => x.id === id); if (!s) return; if (li === 'title') s.title = v; else if (li === 'bpm') s.bpm = Math.max(40, Math.min(200, +v || s.bpm)); else s.lyrics[li] = v; await S.set('d', D); };
window.gyxSongDel = async id => { const s = D.list.find(x => x.id === id); stop(); D.list = D.list.filter(x => x.id !== id); await S.set('d', D); window.gyxSongOpen(s && s.cid); };
window.gyxSongCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxSongData = () => D;
window.gyxSongOpen = function (who, sid) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), L = D.list.filter(x => x.cid === cid), s = sid ? D.list.find(x => x.id === sid) : null;
    const ov = X.panel('gyxSgOv', s ? '🎵 ' + X.esc(s.title) : '🎵 TA 写给你的歌', s ? `<div class="sg-sheet"><div class="sg-t" contenteditable="true" onblur="gyxSongEdit('${s.id}','title',this.innerText.trim())">${X.esc(s.title)}</div><div class="gyx-tip" style="text-align:center">词：${X.esc(X.name(c))} · 曲：${X.esc(X.name(c))}（哼的）· ${s.mood} · ♩=${s.bpm}</div>
        ${s.lyrics.map((l, li) => `<div class="sg-l" data-l="${li}">${syl(l).map((ch, k) => `<i data-k="${k}">${X.esc(ch)}</i>`).join('')}</div>`).join('')}
        ${s.note ? `<div class="gyx-tip gyx-hand" style="text-align:center;font-size:15px">「${X.esc(s.note)}」</div>` : ''}</div>
        <div class="gyx-row" style="justify-content:center"><button class="gyx-btn" onclick="gyxSongPlay('${s.id}')">▶ 听 TA 哼</button><button class="gyx-btn lite" onclick="gyxSongStop()">■</button><button class="gyx-btn lite" onclick="gyxSongRedo('${s.id}')">换个旋律</button></div>
        <details class="gyx-tip"><summary>改歌词 / 速度 / 音色</summary>${s.lyrics.map((l, li) => `<input class="gyx-in" style="margin:3px 0" value="${X.esc(l)}" onchange="gyxSongEdit('${s.id}',${li},this.value)">`).join('')}<div class="gyx-row">速度 <input class="gyx-who" type="number" value="${s.bpm}" style="width:70px" onchange="gyxSongEdit('${s.id}','bpm',this.value)"> 音色 <select class="gyx-who" onchange="gyxSongCfg('wave',this.value)">${[['triangle', '柔和'], ['sine', '干净'], ['square', '游戏机'], ['sawtooth', '亮']].map(([k, n]) => `<option value="${k}"${D.cfg.wave === k ? ' selected' : ''}>${n}</option>`).join('')}</select> 音量 <input type="range" min="0" max="100" value="${D.cfg.vol}" onchange="gyxSongCfg('vol',+this.value)"></div><span class="gyx-chip" onclick="gyxSongDel('${s.id}')">删掉这首</span></details>
        <div class="gyx-row"><button class="gyx-btn lite" onclick="gyxSongOpen('${cid}')">‹ 歌本</button></div>`
        : `<div class="gyx-row">${X.whoSel(cid, 'gyxSongOpen')}</div><div class="gyx-row"><input id="gyxSgTh" class="gyx-who" style="flex:1" placeholder="想听关于什么的（可空）：下雨天 / 我们第一次聊天…"><button class="gyx-btn" onclick="this.disabled=true;this.textContent='TA 在写…';gyxSongWrite('${cid}')">${X.v('请 TA 写一首', '让 TA 写首歌', '点歌')}</button></div>
        <div style="font-weight:700;margin:12px 0 4px">歌本（${L.length} 首）</div>${L.map(x => `<div class="sg-it" onclick="gyxSongOpen('${cid}','${x.id}')"><span>🎵</span><div><b>${X.esc(x.title)}</b><em>${x.mood} · ${new Date(x.at).toLocaleDateString()} · ${X.esc(x.lyrics[0] || '')}</em></div></div>`).join('') || '<div class="gyx-tip">还没有歌</div>'}`);
    const rm = ov.remove.bind(ov); ov.remove = () => { stop(); rm(); };
};
X.ctx(id => { const s = D.list.find(x => x.cid === String(id)); return s && Date.now() - s.at < 3 * 864e5 ? `【你前几天给她写了一首歌《${s.title}》】开头两句：${s.lyrics.slice(0, 2).join('，')}。` : ''; }, 'gyxSong');
X.action({ key: 'gyx_song', label: '给她写一首歌', hint: 'TA 写给你的歌', need: c => !D.list.some(x => x.cid === String(c.id) && Date.now() - x.at < 7 * 864e5),
    run: async c => { const s = await write(c, ''); X.notify(c, `🎵 ${X.esc(X.name(c))} ${X.v('给你写了一首歌', '偷偷写了首歌', '想哼首歌给你听')}：《${X.esc(s.title)}》`, s.lyrics[0], () => window.gyxSongOpen(c.id, s.id)); return (await X.reach(c, `你给她写了一首歌《${s.title}》，有点不好意思地告诉她，叫她去「🎵 TA 写给你的歌」里听你哼`)) ? '写了一首歌' : null; } }, 'gyxSong');
X.today(() => ({ title: '🎵 TA 写给你的歌', rows: D.list.filter(x => X.day(new Date(x.at)) === X.day()).map(x => ({ t: '新歌', x: '《' + X.esc(x.title) + '》', go: `gyxSongOpen('${x.cid}','${x.id}')` })) }), 'gyxSong');
X.widget('gyxSongW', { n: 'TA 写给你的歌', sizes: ['s', 'm'], tap: () => { const s = D.list[0]; s ? window.gyxSongOpen(s.cid, s.id) : window.gyxSongOpen(); }, r: w => { const s = D.list[0]; return X.gw(w, '🎵', 'TA 写的歌', s ? ['《' + X.esc(s.title) + '》', X.esc(s.lyrics[0] || '')] : ['点一首？']); } }, 'gyxSong');
X.memArr({ k: 'gyxSong', ico: '🎵', n: 'TA 写给你的歌', d: '歌名和歌词（一行一句，用 / 隔开）', arr: () => D.list, text: x => x.title + '：' + x.lyrics.join(' / '), edit: (x, v) => { const i = v.indexOf('：'); if (i > 0) { x.title = v.slice(0, i); x.lyrics = v.slice(i + 1).split(/\s*\/\s*/).filter(Boolean); } }, meta: x => x.mood + ' · ' + new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxSong');
X.css('gyxSgCss', `.sg-sheet{background:repeating-linear-gradient(#fffdf8 0 35px,#efe8da 35px 36px);border-radius:16px;padding:16px 14px;margin:6px 0}.sg-t{text-align:center;font-size:20px;font-weight:700;outline:none;letter-spacing:2px}.sg-l{text-align:center;font-size:17px;line-height:36px;letter-spacing:1px}.sg-l i{font-style:normal;transition:color .15s,transform .15s;display:inline-block}.sg-l i.sung{color:#c0567a}.sg-l i.on{color:#ff3b6b;transform:translateY(-3px) scale(1.2)}.sg-it{display:flex;gap:10px;align-items:center;padding:8px 2px;border-bottom:1px solid #f2f2f2;cursor:pointer}.sg-it span{font-size:22px}.sg-it em{display:block;font-style:normal;font-size:11.5px;color:#999}`);
X.mini({ id: 'gyxSong', icon: '🎵', title: 'TA 写给你的歌', desc: '原创歌词 + 合成器哼旋律', cat: '回忆', onOpen: () => window.gyxSongOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.list = D.list || []; D.cfg = Object.assign({ wave: 'triangle', vol: 60 }, D.cfg || {}); })();
