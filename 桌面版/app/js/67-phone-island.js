/* ===========================================================================
   js/67 —— 🏝 小手机的灵动岛
   ---------------------------------------------------------------------------
   只在小手机模式里出现。平时藏着（电脑、手机都是），有事才从顶上冒出来。
   · 在放歌：岛变宽，左边封面、右边跳动的音浪；点一下展开成播放器（上一首 / 暂停 / 下一首 / 进度）
   · 来通知（TA 发消息、发推、写信……）：岛展开几秒，显示是谁、说了什么；点一下直接跳过去
   · 锁屏 / 解锁、省电模式开关：岛上闪一下小图标
   · 展开的时候点别处 / 往上划 就收回去
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyPmIslandLoaded) return;
    window.__gyPmIslandLoaded = true;

    const G = () => window.__gyPm || {};
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const on = () => document.body.classList.contains('gyphm');
    const I = { mode: 'idle', exp: false, alert: null, alertT: null, flash: null, flashT: null, lastN: null, music: null };
    const SV = {
        prev: '<svg viewBox="0 0 24 24"><path d="M7 6v12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M18 6.5v11L9 12z" fill="currentColor"/></svg>',
        next: '<svg viewBox="0 0 24 24"><path d="M17 6v12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M6 6.5v11L15 12z" fill="currentColor"/></svg>',
        play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13L19 12z" fill="currentColor"/></svg>',
        pause: '<svg viewBox="0 0 24 24"><rect x="6.5" y="5.5" width="3.8" height="13" rx="1.2" fill="currentColor"/><rect x="13.7" y="5.5" width="3.8" height="13" rx="1.2" fill="currentColor"/></svg>',
        lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9.5" rx="2.4"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
        unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9.5" rx="2.4"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7"/></svg>',
        bat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7.5" width="16" height="9" rx="2.4"/><path d="M21 10.5v3" stroke-linecap="round"/><rect x="5" y="9.5" width="7" height="5" rx="1" fill="currentColor" stroke="none"/></svg>',
        bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>'
    };
    const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const music = () => { try { return typeof window.gymNowInfo === 'function' ? window.gymNowInfo() : null; } catch (e) { return null; } };

    function el() {
        let d = document.getElementById('gyPmIsl');
        if (!d) {
            d = document.createElement('div'); d.id = 'gyPmIsl';
            document.body.appendChild(d);
            d.addEventListener('click', onTap);
            let t = null, y0 = null;
            d.addEventListener('pointerdown', e => { y0 = e.clientY; clearTimeout(t); t = setTimeout(() => { if (I.mode === 'music' && !I.exp) { I.exp = true; paint(); } }, 480); });
            d.addEventListener('pointermove', e => { if (y0 == null) return; if (e.clientY - y0 < -18 && I.exp) { I.exp = false; y0 = null; paint(); } else if (e.clientY - y0 > 40 && !I.exp) { y0 = null; clearTimeout(t); hideAlert(); try { window.gyPmNC && window.gyPmNC(true); } catch (er) {} } });   // 从岛上往下拉也能拉出通知中心
            ['pointerup', 'pointercancel'].forEach(k => d.addEventListener(k, () => { clearTimeout(t); y0 = null; }));
            document.addEventListener('pointerdown', e => { if (I.exp && !e.target.closest('#gyPmIsl')) { I.exp = false; paint(); } }, true);
        }
        return d;
    }
    function onTap(e) {
        const c = e.target.closest('[data-ic]');
        if (c) {
            e.stopPropagation();
            try { ({ prev: window.gymPrev, next: window.gymNext, toggle: window.gymToggle }[c.dataset.ic] || (() => {}))(); } catch (er) {}
            setTimeout(paint, 250); setTimeout(paint, 900); return;
        }
        if (I.alert) { const a = I.alert; hideAlert(); try { if (a.go) a.go(); } catch (er) {} return; }
        if (I.mode === 'music') { if (!I.exp) { I.exp = true; paint(); } else if (!e.target.closest('.ib-ctl,.ib-bar')) { try { window.gyPmOpen && window.gyPmOpen('music'); } catch (er) {} I.exp = false; paint(); } return; }
        // 空着的时候点一下：打开通知中心
        try { window.gyPmNC && window.gyPmNC(true); } catch (er) {}
    }

    function paint() {
        if (!on()) return;
        const d = el(), m = music();
        I.mode = I.alert ? 'alert' : I.flash ? 'flash' : (m && (m.playing || I.exp)) ? 'music' : 'idle';
        const cls = ['gy-isl', 'm-' + I.mode];
        let h = '';
        if (I.mode === 'alert') {
            const a = I.alert;
            h = `<div class="ib-al"><span class="av">${a.av || `<i class="ic">${SV.bell}</i>`}</span><div class="tx"><b>${esc(a.title)}</b><span>${esc(a.text)}</span></div><em>${esc(a.tag || '现在')}</em></div>`;
            cls.push('big');
        } else if (I.mode === 'flash') {
            const f = I.flash;
            h = `<div class="ib-fl"><i class="${f.cls || ''}">${f.icon}</i><span>${esc(f.text)}</span></div>`;
            cls.push('wide');
        } else if (I.mode === 'music') {
            const cov = m.cover ? `style="background-image:url('${esc(m.cover)}')"` : '';
            if (I.exp) {
                const pct = m.d ? Math.min(100, m.t / m.d * 100) : 0;
                h = `<div class="ib-mx"><div class="top"><span class="cv${cov ? '' : ' e'}" ${cov}></span><div class="tt"><b>${esc(m.title || '在听歌')}</b><span>${esc(m.artist || '')}</span></div><span class="wv${m.playing ? ' on' : ''}"><i></i><i></i><i></i><i></i></span></div>
                    <div class="ib-bar"><em>${fmt(m.t)}</em><i><u style="width:${pct}%"></u></i><em>${fmt(m.d)}</em></div>
                    <div class="ib-ctl"><span data-ic="prev">${SV.prev}</span><span data-ic="toggle" class="pp">${m.playing ? SV.pause : SV.play}</span><span data-ic="next">${SV.next}</span></div></div>`;
                cls.push('exp');
            } else {
                h = `<div class="ib-mc"><span class="cv${cov ? '' : ' e'}" ${cov}></span><span class="wv${m.playing ? ' on' : ''}"><i></i><i></i><i></i><i></i></span></div>`;
                cls.push('wide');
            }
        }
        d.className = cls.join(' ');
        if (d.__h !== h) { d.innerHTML = h; d.__h = h; }
    }
    function showAlert(a) {
        I.alert = a; I.exp = false; clearTimeout(I.alertT);
        I.alertT = setTimeout(hideAlert, a.ms || 4200);
        paint();
    }
    function hideAlert() { clearTimeout(I.alertT); I.alert = null; paint(); }
    function flash(icon, text, cls, ms) {
        if (!on()) return;
        I.flash = { icon, text, cls }; clearTimeout(I.flashT);
        I.flashT = setTimeout(() => { I.flash = null; paint(); }, ms || 1300);
        paint();
    }
    window.gyPmIsland = { alert: showAlert, flash, paint, hide: hideAlert };

    /* ---------- 看着通知：来了新的就在岛上弹 ---------- */
    const plain = s => String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    function watch() {
        try { if (typeof window.gyNotifEnsureIds === 'function') window.gyNotifEnsureIds(); } catch (e) {}
        let n = null; try { n = (globalNotifications || [])[0]; } catch (e) {}
        const key = n ? (n.id || '') + '|' + (n.timestamp || '') + '|' + String(n.text || '').slice(0, 20) : null;
        if (I.lastN === undefined || I.lastN === null || !on()) { I.lastN = key || ''; return; }   // 刚打开 / 没在小手机模式：已经有的不算新的
        if (key && key !== I.lastN) {
            I.lastN = key;
            if (n.timestamp && Date.now() - n.timestamp > 5 * 60000) return;
            let title = '通知', av = '', text = plain(n.text).slice(0, 80);
            try {
                const cid = n.chatCharId || (n.jump && n.jump.charId) || n.charId;
                const c = cid != null && (G().chars ? G().chars() : []).find(x => String(x.id) === String(cid));
                if (c) { title = c.remark || c.name; av = G().av ? G().av(c, 36) : ''; if (text.startsWith(title)) text = text.slice(title.length).replace(/^[:：\s]+/, ''); }
            } catch (e) {}
            // 记住是哪一条（按 id）——点岛的时候可能又来了新通知，不能再按"第 0 条"去找
            const nid = n.id != null ? String(n.id) : null;
            showAlert({ title, text: text || '有新动静', av, nid, go: () => { try { if (nid != null && window.gyPmNCGo) window.gyPmNCGo(nid); else window.gyPmNC(true); } catch (e) {} } });
        } else if (!key) I.lastN = '';
    }
    setInterval(() => { try { watch(); } catch (e) {} }, 1000);
    setTimeout(() => { try { watch(); } catch (e) {} }, 300);
    setInterval(() => { try { const m = music(); if (m && m.playing || I.mode === 'music') paint(); } catch (e) {} }, 1000);

    /* ---------- 锁屏、解锁、省电：闪一下 ---------- */
    function wrap(name, fn) {
        const o = window[name]; if (typeof o !== 'function' || o.__isl) return false;
        const w = function () { const r = o.apply(this, arguments); try { fn.apply(this, arguments); } catch (e) {} return r; };
        w.__isl = true; window[name] = w; return true;
    }
    function hook() {
        let ok = true;
        ok = wrap('gyPmUnlock', () => flash(SV.unlock, '', 'lk', 900)) && ok;
        ok = wrap('gyPmLockNow', () => { if (document.querySelector('#gyPmHome .pm-lock')) flash(SV.lock, '', 'lk', 900); }) && ok;
        ok = wrap('gyPmSaver', () => { const s = window.gyPmSaverOn && window.gyPmSaverOn(); flash(SV.bat, s ? '省电模式 开' : '省电模式 关', s ? 'sv' : '', 1500); }) && ok;
        return ok;
    }
    let tries = 0; const iv = setInterval(() => { if (hook() || ++tries > 60) clearInterval(iv); }, 200);
    // 模式切换 / 刷新：岛跟着出现
    setInterval(() => { const d = document.getElementById('gyPmIsl'); if (on()) { if (!d) paint(); } else if (d) d.className = 'gy-isl off'; }, 800);

    const CSS = `
#gyPmIsl{display:none}
body.gyphm #gyPmIsl{display:block;position:fixed;z-index:2025;left:calc(var(--pm-sl) + var(--pm-sw) / 2);top:calc(var(--pm-st) + 11px);transform:translateX(-50%);width:112px;height:32px;border-radius:20px;background:#000;color:#fff;overflow:hidden;cursor:pointer;transition:width .5s cubic-bezier(.3,1.35,.45,1),height .5s cubic-bezier(.3,1.35,.45,1),border-radius .5s cubic-bezier(.3,1.35,.45,1),top .4s,opacity .3s,transform .4s;font-family:var(--pm-font);-webkit-font-smoothing:antialiased;box-shadow:0 0 0 .5px rgba(255,255,255,.06)}
body.gyphm #gyPmIsl.off{display:none}
body.gyphm .pm-isl{opacity:0}
body.gyphm #gyPmIsl.wide{width:208px}
body.gyphm #gyPmIsl.big{width:calc(min(var(--pm-sw), 100vw) - 22px);height:74px;border-radius:30px}
body.gyphm #gyPmIsl.exp{width:calc(min(var(--pm-sw), 100vw) - 22px);height:164px;border-radius:40px}
/* 手机上：平时藏起来，有事才冒出来 */
body.gyphm-mob #gyPmIsl{left:50%;top:calc(env(safe-area-inset-top) + 6px)}
/* 平时（没在放歌、没来通知）不显示——电脑、手机都一样，有事才从顶上冒出来 */
body.gyphm #gyPmIsl.m-idle{opacity:0;transform:translateX(-50%) scale(.6);pointer-events:none}
body.gyphm-mob #gyPmIsl.big,body.gyphm-mob #gyPmIsl.exp{width:calc(100vw - 20px)}
/* 放歌：小 */
.ib-mc{height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 12px 0 6px}
#gyPmIsl .cv{width:22px;height:22px;border-radius:7px;background:#333 center/cover;flex-shrink:0}
#gyPmIsl .cv.e{background:linear-gradient(135deg,#ff6b8a,#ffb86b)}
#gyPmIsl .wv{display:flex;gap:2.5px;align-items:center;height:16px}
#gyPmIsl .wv i{width:3px;height:5px;border-radius:2px;background:#ff9f5a;display:block}
#gyPmIsl .wv.on i{animation:gyIslWv .9s ease-in-out infinite}
#gyPmIsl .wv.on i:nth-child(2){animation-delay:-.3s}#gyPmIsl .wv.on i:nth-child(3){animation-delay:-.6s}#gyPmIsl .wv.on i:nth-child(4){animation-delay:-.15s}
@keyframes gyIslWv{0%,100%{height:4px}50%{height:15px}}
/* 放歌：展开 */
.ib-mx{padding:16px 20px 14px;display:flex;flex-direction:column;gap:12px;height:100%;box-sizing:border-box}
.ib-mx .top{display:flex;align-items:center;gap:12px}
.ib-mx .cv{width:48px!important;height:48px!important;border-radius:12px!important}
.ib-mx .tt{flex:1;min-width:0}.ib-mx .tt b{display:block;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ib-mx .tt span{font-size:12.5px;color:#9a9aa0}
.ib-bar{display:flex;align-items:center;gap:8px;font-size:10.5px;color:#9a9aa0;font-family:var(--pm-num)}
.ib-bar em{font-style:normal}.ib-bar i{flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.2);overflow:hidden}.ib-bar u{display:block;height:100%;background:#fff}
.ib-ctl{display:flex;justify-content:center;gap:40px;align-items:center}
.ib-ctl span{display:flex;cursor:pointer}.ib-ctl svg{width:24px;height:24px}.ib-ctl .pp svg{width:30px;height:30px}
/* 通知 */
.ib-al{height:100%;display:flex;align-items:center;gap:11px;padding:0 18px 0 14px;box-sizing:border-box}
.ib-al .av{width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#1c1c1e}
.ib-al .av>*{width:100%!important;height:100%!important;border-radius:50%!important;margin:0!important;border:none!important}
.ib-al .av .ic{display:flex;align-items:center;justify-content:center;color:#fff}.ib-al .av .ic svg{width:22px;height:22px}
.ib-al .tx{flex:1;min-width:0}.ib-al .tx b{display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ib-al .tx span{display:block;font-size:13px;color:#c7c7cc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.ib-al em{font-style:normal;font-size:11px;color:#8e8e93;flex-shrink:0}
/* 闪一下 */
.ib-fl{height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 14px}
.ib-fl i{display:flex}.ib-fl svg{width:17px;height:17px}.ib-fl i.sv{color:#ffd60a}.ib-fl span{font-size:12.5px;font-weight:600}
.ib-fl i.lk{animation:gyIslLk .5s ease}
@keyframes gyIslLk{30%{transform:rotate(-12deg)}60%{transform:rotate(10deg)}}
`;
    function css() { if (document.getElementById('gyPmIslCss')) return; const s = document.createElement('style'); s.id = 'gyPmIslCss'; s.textContent = CSS; document.head.appendChild(s); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', css); else css();
})();
