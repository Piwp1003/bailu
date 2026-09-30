/* 💌 拆信仪式：TA 寄来的信变成真的信封——火漆印、按一下掰开、信纸滑出来，上面是手写字 */
if (window.__gyxLetter) return; window.__gyxLetter = 1;
X.feat('gyxLetter', { n: '💌 拆信仪式', desc: 'TA 寄来的信变成真的信封：火漆印、掰开、信纸滑出来、手写字' });
const S = X.store('letter');
let C = { every: false, seen: {} };   // every：每次打开都拆一遍；seen：拆过的信
const WAX = ['#9b2335', '#6d2e46', '#264653', '#7a4e2d', '#3a5a40', '#5e3c99', '#b5651d', '#1d3557'];
const waxOf = c => { const n = String((c && c.id) || '').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0); return WAX[n % WAX.length]; };
function show(c, item, done) {
    const col = waxOf(c), init = (X.name(c) || '·')[0];
    const body = X.esc(String(item.content || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\\n/g, '\n')).replace(/\n/g, '<br>');
    const ov = document.createElement('div'); ov.id = 'gyxLtOv'; ov.className = 'lt-ov';
    ov.innerHTML = `<div class="lt-stage"><div class="lt-env"><div class="lt-back"></div>
            <div class="lt-paper"></div>
            <div class="lt-front"><div class="lt-addr gyx-hand">To ${X.esc(X.me(c))}</div><div class="lt-from">From ${X.esc(X.name(c))}</div></div>
            <div class="lt-flap"></div>
            <div class="lt-wax" style="--w:${col}"><span>${X.esc(init)}</span><i class="l"></i><i class="r"></i></div></div>
        <div class="lt-hint">按一下火漆印，拆开</div></div>
        <div class="lt-sheet"><div class="lt-h gyx-hand">${X.esc(item.title || '')}</div><div class="lt-body gyx-hand">${body}</div><div class="lt-sig gyx-hand">—— ${X.esc(X.name(c))}<br><small>${new Date(item.date || Date.now()).toLocaleDateString()}</small></div>
            <div class="lt-done"><button class="gyx-btn lite" onclick="gyxLetterClose()">收好</button></div></div>`;
    document.body.appendChild(ov);
    const wax = ov.querySelector('.lt-wax');
    wax.addEventListener('click', e => {
        e.stopPropagation(); if (ov.classList.contains('open')) return;
        ov.classList.add('crack'); try { navigator.vibrate && navigator.vibrate(30); } catch (er) {}
        snap();
        setTimeout(() => ov.classList.add('open'), 450);
        setTimeout(() => ov.classList.add('read'), 1400);
    });
    window.gyxLetterClose = () => { ov.classList.add('out'); setTimeout(() => { ov.remove(); if (done) done(); }, 400); };
}
function snap() { try { const a = new (window.AudioContext || window.webkitAudioContext)(), n = a.createBufferSource(), b = a.createBuffer(1, a.sampleRate * .08, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); n.buffer = b; const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400; n.connect(f); f.connect(a.destination); n.start(); } catch (e) {} }
window.gyxLetterShow = (cid, item, done) => show(X.char(cid), item, done);
function hook() {
    const f = window.openDiaryDetail; if (typeof f !== 'function' || f.__gyxLt) return;
    const w = function (id) {
        try {
            const tab = typeof currentDiaryTab !== 'undefined' ? currentDiaryTab : '', cid = typeof currentDiaryCharId !== 'undefined' ? currentDiaryCharId : null;
            const c = X.char(cid);
            if (tab === 'letter' && c && c.diaryData) {
                const it = (c.diaryData.letters || []).find(x => x.id === id);
                if (it && it.author !== 'user' && X.on('gyxLetter') && (C.every || !C.seen[id])) {
                    C.seen[id] = Date.now(); S.set('c', C);
                    const args = arguments, self = this;
                    show(c, it, () => f.apply(self, args));
                    return;
                }
            }
        } catch (e) {}
        return f.apply(this, arguments);
    };
    w.__gyxLt = true; window.openDiaryDetail = w;
}
window.gyxLetterOpen = function () {
    X.panel('gyxLtSet', '💌 拆信仪式', `<div class="gyx-tip">TA 寄来的信，第一次打开时会先看到一个封着火漆的信封，按一下火漆印掰开，信纸滑出来。每个角色的火漆颜色不一样。</div>
        <label class="gyx-row"><input type="checkbox" ${C.every ? 'checked' : ''} onchange="gyxLetterCfg(this.checked)"> 每次打开信都拆一遍（不勾＝只有第一次）</label>
        <div class="gyx-row"><button class="gyx-btn" onclick="gyxLetterDemo()">试拆一封</button></div>`);
};
window.gyxLetterCfg = v => { C.every = v; S.set('c', C); };
window.gyxLetterDemo = () => { const c = X.cur(); const ov = document.getElementById('gyxLtSet'); if (ov) ov.remove(); show(c, { title: '给你的信', content: '见字如面。\n\n今天路过一家花店，看到一束很像你的花，就想给你写封信。\n不用回也没关系，我只是想让你知道，我在想你。', date: Date.now() }); };
X.css('gyxLtCss', `
.lt-ov{position:fixed;inset:0;z-index:100001;background:radial-gradient(ellipse at 50% 40%,rgba(60,45,35,.55),rgba(20,15,10,.82));display:flex;align-items:center;justify-content:center;animation:ltIn .4s both;padding:16px;box-sizing:border-box}
.lt-ov.out{opacity:0;transition:opacity .4s}@keyframes ltIn{from{opacity:0}}
.lt-stage{position:relative;width:min(420px,92vw);display:flex;flex-direction:column;align-items:center;gap:22px;transition:transform .8s cubic-bezier(.4,0,.2,1),opacity .6s}
.lt-ov.read .lt-stage{transform:translateY(55vh);opacity:0}
.lt-env{position:relative;width:100%;aspect-ratio:16/10;animation:ltDrop .8s cubic-bezier(.2,1.2,.3,1) both}
@keyframes ltDrop{from{transform:translateY(-40px) rotate(-4deg);opacity:0}to{transform:rotate(-1deg);opacity:1}}
.lt-back{position:absolute;inset:0;border-radius:6px;background:#e6d6b8;box-shadow:0 20px 50px rgba(0,0,0,.35)}
.lt-front{position:absolute;inset:0;border-radius:6px;z-index:3;display:flex;flex-direction:column;justify-content:flex-end;padding:0 18px 12px;background:#efe3cc;clip-path:polygon(0 0,50% 58%,100% 0,100% 100%,0 100%)}
.lt-addr{font-size:22px;color:#5b4632}.lt-from{font-size:11px;color:#8b7355;letter-spacing:.1em}
.lt-flap{position:absolute;left:0;right:0;top:0;height:60%;background:#e2d0ad;clip-path:polygon(0 0,100% 0,50% 100%);transform-origin:top;z-index:4;transition:transform .7s cubic-bezier(.5,0,.3,1),z-index 0s .35s}
.lt-ov.open .lt-flap{transform:rotateX(180deg);z-index:1}
.lt-paper{position:absolute;left:6%;right:6%;top:4%;height:90%;background:#fffdf6;border-radius:3px;z-index:2;background-image:linear-gradient(transparent 21px,#eadfca 22px);background-size:100% 22px;opacity:0;transition:transform 1s cubic-bezier(.3,1,.4,1) .15s,opacity .2s}
.lt-ov.open .lt-paper{opacity:1;transform:translateY(-55%)}
.lt-wax{position:absolute;left:50%;top:58%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--w) 60%,#fff),var(--w) 60%);box-shadow:0 4px 10px rgba(0,0,0,.35),inset 0 -3px 6px rgba(0,0,0,.3);z-index:5;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);font-size:26px;font-family:"Noto Serif SC",serif;animation:ltPulse 2s ease-in-out infinite}
.lt-wax span{text-shadow:0 -1px 0 rgba(0,0,0,.35)}.lt-wax i{position:absolute;inset:0;border-radius:50%;opacity:0}
@keyframes ltPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.lt-ov.crack .lt-wax{animation:none;background:none;box-shadow:none}.lt-ov.crack .lt-wax span{opacity:0}
.lt-ov.crack .lt-wax i{opacity:1;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--w) 60%,#fff),var(--w) 60%);transition:transform .6s cubic-bezier(.3,.7,.4,1),opacity .6s .3s}
.lt-ov.crack .lt-wax i.l{clip-path:polygon(0 0,55% 0,40% 50%,50% 100%,0 100%);transform:translate(-26px,30px) rotate(-40deg);opacity:0}.lt-ov.crack .lt-wax i.r{clip-path:polygon(55% 0,100% 0,100% 100%,50% 100%,40% 50%);transform:translate(26px,34px) rotate(35deg);opacity:0}
.lt-hint{color:#f3e8d6;font-size:13px;letter-spacing:.2em;animation:ltPulse 2s infinite}.lt-ov.crack .lt-hint{opacity:0;transition:opacity .3s}
.lt-sheet{position:absolute;left:50%;top:50%;width:min(440px,90vw);max-height:84vh;overflow:auto;box-sizing:border-box;padding:28px 26px 20px;background:#fffdf6;border-radius:4px;box-shadow:0 30px 70px rgba(0,0,0,.4);color:#3b3024;background-image:linear-gradient(transparent 31px,#eadfca 32px);background-size:100% 32px;background-position:0 18px;transform:translate(-50%,-30%) scale(.9);opacity:0;pointer-events:none;transition:transform .9s cubic-bezier(.2,1,.3,1) .1s,opacity .5s .1s}
.lt-ov.read .lt-sheet{transform:translate(-50%,-50%) rotate(-.6deg);opacity:1;pointer-events:auto}
.lt-h{font-size:26px;text-align:center;margin-bottom:6px}.lt-body{font-size:21px;line-height:32px;word-break:break-all}.lt-sig{text-align:right;font-size:21px;margin-top:12px;line-height:1.4}.lt-sig small{font-size:13px;color:#a09380}
.lt-done{display:flex;justify-content:center;margin-top:16px}
`);
X.mini({ id: 'gyxLetter', icon: '💌', title: '拆信仪式', desc: 'TA 寄来的信变成真的信封：火漆印、掰开、信纸滑出来、手写字', onOpen: () => window.gyxLetterOpen() });
(async () => { C = Object.assign(C, await S.get('c', {})); C.seen = C.seen || {}; hook(); setInterval(hook, 3000); })();
