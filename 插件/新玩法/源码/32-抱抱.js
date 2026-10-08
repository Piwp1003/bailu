/* 🫂 抱抱：不开心的时候点一下——TA 给你一个长长的抱抱，陪你慢慢呼吸（TA 的声音数着节拍），给你写几句话，再陪你做几件让自己好一点的小事 */
if (window.__gyxHug) return; window.__gyxHug = 1;
X.feat('gyxHug', { n: '🫂 抱抱', desc: '不开心时点一下，TA 抱抱你、陪你呼吸、陪你缓一缓' });
const S = X.store('hug');
let D = { log: [], cfg: { voice: true } };
const SMALL = ['去倒一杯温水，慢慢喝完', '把窗户打开一条缝，吹一会儿风', '洗把脸，或者洗个热水澡', '给自己换一件舒服的衣服', '吃一点甜的东西', '把手机放下五分钟，闭上眼睛', '听一首你喜欢的歌', '抱着枕头躺一会儿', '写下三件今天还不错的小事', '出门走一小圈'];
let BR = null;
async function note(c, why) {
    if (X.bailu()) return X.cards(['安慰', '抱抱', '聊天'], c, 3).join('\n') || '我在。不用急着好起来，先让我抱一会儿。';
    return X.plain(await X.ask(`${X.who(c)}\n她现在不太好${why ? '，她说：「' + why + '」' : '（她没说为什么）'}。给她写几句话：先接住她的情绪（不说教、不急着讲道理、不说「别难过」），告诉她你在，然后温柔地陪着。60~150 字，像你本人在她耳边说。只输出这段话。`) || '我在。不用急着好起来，先让我抱一会儿。');
}
window.gyxHugOpen = async function (why) {
    const c = X.cur(); if (!c) return;
    const ov = document.createElement('div'); ov.id = 'gyxHugOv';
    let av = ''; try { av = getAvatarHTML(c, 96); } catch (e) {}
    ov.innerHTML = `<div class="hg-x" onclick="gyxHugClose()">✕</div><div class="hg-c"><div class="hg-arms"><div class="hg-av">${av}</div><i class="l"></i><i class="r"></i></div><div class="hg-t">${X.esc(X.name(c))} 抱住了你</div>
        <div class="hg-why"><input id="gyxHugWhy" class="gyx-in" placeholder="想说说怎么了吗？（不说也可以）" value="${X.esc(why || '')}"><button class="gyx-btn lite" onclick="gyxHugNote()">说给 TA</button></div>
        <div class="hg-note gyx-hand" id="gyxHugNote">……</div>
        <div class="hg-br"><div class="hg-ball" id="gyxHugBall"></div><b id="gyxHugBT">跟着圆圈呼吸</b><button class="gyx-btn lite" onclick="gyxHugBreath()">开始（吸 4 · 停 4 · 呼 6）</button></div>
        <div class="hg-small"><div class="gyx-tip">然后，陪你做一件小事：</div>${X.pick([SMALL.slice(0, 5), SMALL.slice(5)]).map(s => `<label><input type="checkbox" onchange="this.parentElement.classList.toggle('ok',this.checked)"> ${s}</label>`).join('')}</div>
        <div class="gyx-tip hg-foot">如果真的很难受、撑不住，也要记得找身边信任的人，或者专业的心理热线聊一聊。你值得被好好照顾。</div></div>`;
    document.body.appendChild(ov);
    D.log.unshift({ at: Date.now(), cid: String(c.id), why: why || '' }); D.log = D.log.slice(0, 100); await S.set('d', D);
    window.gyxHugNote();
};
window.gyxHugNote = async function () {
    const c = X.cur(), why = ((document.getElementById('gyxHugWhy') || {}).value || '').trim(), el = document.getElementById('gyxHugNote'); if (!el) return;
    el.textContent = '……'; const t = await note(c, why); el.textContent = t; if (D.cfg.voice) X.speak(c, t);
    if (why) { const L = D.log[0]; if (L) { L.why = why; S.set('d', D); } X.reach(c, `她刚刚不太好，点了「抱抱」，跟你说：「${why}」。你已经抱着她、跟她说了几句了，现在在聊天里继续陪着她（温柔、别说教）`); }
    return t;
};
window.gyxHugBreath = function () {
    if (BR) { clearTimeout(BR.t); BR = null; }
    const ball = document.getElementById('gyxHugBall'), tx = document.getElementById('gyxHugBT'), c = X.cur(); if (!ball) return;
    const steps = [['吸气', 4000, 1.6], ['停一下', 4000, 1.6], ['慢慢呼气', 6000, 1]]; let i = 0, round = 0; BR = {};
    const go = () => { if (!BR || !document.getElementById('gyxHugBall')) return; const [w, ms, sc] = steps[i]; tx.textContent = w + (round ? `（第 ${round + 1} 轮）` : ''); ball.style.transition = `transform ${ms}ms ease-in-out`; ball.style.transform = `scale(${sc})`; if (D.cfg.voice && round < 2) X.speak(c, w); i++; if (i >= steps.length) { i = 0; round++; } if (round >= 5) { tx.textContent = '好一点了吗？'; BR = null; return; } BR.t = setTimeout(go, ms); };
    go();
};
window.gyxHugClose = () => { if (BR) { clearTimeout(BR.t); BR = null; } X.stopSpeak(); const o = document.getElementById('gyxHugOv'); if (o) o.remove(); };
window.gyxHugData = () => D;
// 聊天栏放一颗 🫂
function btn() { const row = document.getElementById('chatToolIconsRow'); if (!row || document.getElementById('gyxHugBtn')) return; if (!X.on('gyxHug')) return; const b = document.createElement('button'); b.className = 'btn-edit-small'; b.id = 'gyxHugBtn'; b.title = '抱抱'; b.textContent = '🫂'; b.onclick = () => window.gyxHugOpen(); row.appendChild(b); }
addEventListener('gyx:feat', e => { if (e.detail && e.detail.id === 'gyxHug' && !e.detail.on) { const b = document.getElementById('gyxHugBtn'); if (b) b.remove(); } });
X.action({ key: 'gyx_hug', label: '她好像不太开心，给她一个抱抱', hint: '她最近情绪低落', need: c => { try { const d = window.gyMoodData && window.gyMoodData().days[X.day()]; return !!(d && d.me && ['累', '委屈', '烦', 'emo', '想你'].includes(d.me.m)); } catch (e) { return false; } }, run: async c => (await X.reach(c, '你感觉她今天不太开心，想给她一个抱抱，陪她缓一缓（可以提醒她聊天栏有个 🫂）')) ? '给了你一个抱抱' : null }, 'gyxHug');
X.ctx(() => { const L = D.log[0]; return L && Date.now() - L.at < 6 * 3600000 ? `【她刚才不太好】她几个小时前点了「抱抱」${L.why ? '，说：「' + L.why + '」' : ''}。聊天时温柔一点，多陪着她。` : ''; }, 'gyxHug');
X.today(() => { const L = D.log.filter(x => X.day(new Date(x.at)) === X.day()); return { title: '🫂 抱抱', rows: L.length ? [{ t: L.length + ' 次', x: '今天被抱了抱', go: 'gyxHugOpen()' }] : [] }; }, 'gyxHug');
X.css('gyxHgCss', `#gyxHugOv{position:fixed;inset:0;z-index:100007;background:linear-gradient(170deg,#fde2e4,#e2ece9 60%,#dfe7fd);display:flex;justify-content:center;overflow:auto;animation:hgIn .6s both}@keyframes hgIn{from{opacity:0}}
.hg-x{position:fixed;right:18px;top:14px;font-size:20px;color:#999;cursor:pointer;z-index:2}.hg-c{width:min(440px,92vw);padding:40px 0 30px;display:flex;flex-direction:column;align-items:center;gap:14px;color:#4a3b40}
.hg-arms{position:relative;width:200px;height:150px;display:flex;justify-content:center;align-items:center}.hg-av{animation:hgB 3s ease-in-out infinite}.hg-arms i{position:absolute;top:60px;width:90px;height:34px;border-radius:20px;background:#ffd7c4;box-shadow:0 4px 10px rgba(0,0,0,.08)}.hg-arms i.l{left:-10px;transform:rotate(20deg);animation:hgL 1.2s .3s both}.hg-arms i.r{right:-10px;transform:rotate(-20deg);animation:hgR 1.2s .3s both}
@keyframes hgL{from{transform:translateX(-60px) rotate(40deg);opacity:0}to{transform:translateX(30px) rotate(10deg);opacity:1}}@keyframes hgR{from{transform:translateX(60px) rotate(-40deg);opacity:0}to{transform:translateX(-30px) rotate(-10deg);opacity:1}}@keyframes hgB{50%{transform:scale(1.04)}}
.hg-t{font-size:18px}.hg-why{display:flex;gap:8px;width:100%}.hg-note{font-size:20px;line-height:1.9;padding:16px 18px;border-radius:18px;background:rgba(255,255,255,.7);width:100%;box-sizing:border-box;min-height:80px}
.hg-br{display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px;border-radius:18px;background:rgba(255,255,255,.5);width:100%;box-sizing:border-box}.hg-ball{width:70px;height:70px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#b8d8f8);box-shadow:0 0 30px rgba(150,190,240,.6);margin:20px}
.hg-small{width:100%}.hg-small label{display:block;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.55);margin:5px 0;font-size:14px;cursor:pointer}.hg-small label.ok{text-decoration:line-through;opacity:.6}.hg-foot{text-align:center;font-size:12px}`);
X.mini({ id: 'gyxHug', icon: '🫂', title: '抱抱', desc: '不开心时点一下：TA 抱抱你、陪你呼吸、给你写几句话', onOpen: () => window.gyxHugOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.log = D.log || []; D.cfg = Object.assign({ voice: true }, D.cfg || {}); btn(); setInterval(btn, 3000); })();
X.widget('gyxHugW', { n: '抱抱', sizes: ['s'], tap: () => window.gyxHugOpen(), r: w => X.gw(w, '🫂', '抱抱', [X.v('要抱抱吗', '我在', '过来抱一下')]) }, 'gyxHug');
X.memArr({ k: 'gyxHug', ico: '🫂', n: '不开心的时候', d: '你点「抱抱」时说的话（TA 会记着多陪你）', arr: () => D.log, text: x => x.why || '（没说为什么）', field: 'why', save: () => S.set('d', D) }, 'gyxHug');
