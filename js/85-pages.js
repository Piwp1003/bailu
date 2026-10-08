/* ============================================================
   📄 弹窗变成页面（v212）
   ------------------------------------------------------------
   以前点开一个功能（插件面板、TA 的状态、语音、相册、心情手账、设置里那些大弹窗……）都是
   一个浮在半透明背景上的框，内容一多就挤在中间、上下滚、和背后的页面叠在一起。
   打开这个以后：
   · 内容多的弹窗 → 变成一页：电脑上占满中间那一栏（左右边栏照常能看到），手机上整屏；
   · 顶上一条「‹ 返回 + 标题」，点 ‹、按系统返回键、从左边缘右滑都能退回去；
   · 原来框里自己的标题和 ✕ 收起来，不重复；
   · 小的确认框、选表情、选人这种一眼就完的，还是小弹窗（不值得占一整页）；
   · 全屏的动画、通话、看大图、右键菜单不动；小手机模式里不动（小手机有自己的样子）。
   · 点左边栏换到别的页面时，开着的「页面」会一起收起来，像真的翻页一样。
   设置 → 🎨 外观与主题 最上面可以关（关掉＝回到弹窗）。不改任何功能本身，只改它出现的样子。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyPages) return;
    window.__gyPages = true;
    const KEY = 'gyPages';
    const on = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } };
    window.gyPagesOn = on;
    window.gyPagesSet = function (v) {
        try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
        document.body.classList.toggle('gy-pages', on());
        if (!v) document.querySelectorAll('.gy-aspage').forEach(unpage); else scan();
        try { showToast('', v ? '📄 功能打开成一页' : '🪟 功能打开成弹窗', v ? '内容多的弹窗会变成一整页，‹ 返回' : '回到以前浮在上面的样子', null, null, false); } catch (e) {}
        const sw = document.getElementById('gyPagesSw'); if (sw) sw.checked = !!v;
    };

    // 不当成页面的：全屏动画 / 通话 / 看图 / 裁剪 / 菜单 / 加载中…
    const DENY = /^(gyWx|gyPm|gyph|chatContextMenu|gyCallModal|gyxHugOv|gyPmSheet|gyBackInd|scheduleLoadingModal|emoticonPickerModal|factionCharPickerModal)$|crop|viewer|lightbox|imgView|loading|splash|toast|intro(?!Ov)|opening/i;
    const SMALL_H = 300;
    const CAND = '.modal-overlay, .gyx-ov, [data-gy-overlay], [id$="Ov"], [id$="Modal"], [id$="Pl"], [id$="Set"], [id$="Res"], [id$="Read"], [id$="Al"]';
    const vis = el => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const coversScreen = el => { const cs = getComputedStyle(el); if (cs.position !== 'fixed' && cs.position !== 'absolute') return false; const r = el.getBoundingClientRect(); return r.width >= innerWidth * .85 && r.height >= innerHeight * .85; };
    function mainBox(ov) {
        const kids = [...ov.children].filter(c => !c.classList.contains('gyp-bar') && c.offsetWidth > 0 && c.offsetHeight > 0 && c.tagName !== 'STYLE' && c.tagName !== 'SCRIPT');
        if (!kids.length) return null;
        return kids.sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0];
    }
    const txt = el => (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim();
    const isX = el => { const t = txt(el); return /^(✕|×|✖|╳|⨯|x|X|关闭|关掉)$/.test(t) || (/(^|[-_ ])(close|x)([-_ ]|$)|close/i.test(String(el.className || '')) && t.length <= 4); };

    function worth(ov, box) {
        if (ov.classList.contains('gyx-ov')) return true;
        if (ov.hasAttribute('data-gy-page')) return true;
        const h = box.offsetHeight, w = box.offsetWidth;
        if (box.scrollHeight > box.clientHeight + 4) return true;    // 框里本来就要滚
        if (h < SMALL_H) return false;                               // 小确认框 / 小表单
        if (w < 340 && h < 440) return false;                        // 小选择器
        return true;
    }

    // 找标题、找框里自己的 ✕
    function findTitle(ov, box) {
        const gh = box.querySelector(':scope > .gyx-hd');
        if (gh) return { text: txt(gh.querySelector('b') || gh).replace(/\s*✕$/, ''), el: gh };
        const first = [...box.children].find(c => c.offsetHeight > 0);
        let h = box.querySelector('h1, h2, h3');
        if (h && box.getBoundingClientRect().top + 120 < h.getBoundingClientRect().top) h = null;   // 太靠下的不是标题
        if (!h && first && /(^|[-_])(hd|head|header|title|top|bar)([-_]|$)/i.test(String(first.className || '')) && txt(first).length <= 40) h = first;
        if (!h) return { text: '', el: null };
        // 标题栏里带的按钮、下拉框（✕、保存、选角色……）不算标题
        const c = h.cloneNode(true); c.querySelectorAll('button, select, input, textarea, .gyx-x, [onclick]').forEach(b => b.remove());
        const t = (c.textContent || '').replace(/\s+/g, ' ').replace(/\s*[✕×✖]\s*$/, '').trim();
        // 能整条收起来的：本身就是框的第一个元素、不含输入框和图片
        const hideable = h === first && !h.querySelector('input, select, textarea, img, canvas');
        // 收不掉（里面有下拉框之类要用的东西）又就在最上面：顶栏就不再写一遍标题
        if (!hideable && h === first) return { text: '', el: null };
        return { text: t.slice(0, 40), el: hideable ? h : null };
    }
    function findX(box) {
        const top = box.getBoundingClientRect().top;
        return [...box.querySelectorAll('span, button, a, div, i, b')].find(e => e.children.length === 0 && e.offsetWidth > 0 && e.offsetWidth < 80 && e.getBoundingClientRect().top - top < 70 && isX(e)) || null;
    }

    function place() {
        let l = 0, w = innerWidth;
        try {
            const m = document.querySelector('.main-content');
            if (m && innerWidth > 760 && !document.body.classList.contains('gyphm')) {
                const r = m.getBoundingClientRect();
                if (r.width >= 420 && r.width < innerWidth * .95) { l = Math.max(0, r.left); w = Math.min(r.width, innerWidth - l); }
            }
        } catch (e) {}
        const s = document.documentElement.style;
        s.setProperty('--gyp-l', l + 'px'); s.setProperty('--gyp-w', w + 'px');
    }

    // 「弹窗拖大小」记下来的尺寸是写在框上的 !important 行内样式，会压过页面的样子：先收起来，变回弹窗时再还回去
    const SZ = ['width', 'height', 'max-width', 'max-height', 'min-width', 'min-height', 'left', 'top', 'transform', 'margin'];
    function stripSize(box) {
        const saved = box.__gypSz || {}; let any = false;
        SZ.forEach(k => { if (box.style.getPropertyPriority(k) === 'important') { saved[k] = box.style.getPropertyValue(k); box.style.removeProperty(k); any = true; } });
        if (any) box.__gypSz = saved;
    }
    function restoreSize(box) { const s = box.__gypSz; if (!s) return; box.__gypSz = null; Object.keys(s).forEach(k => { try { box.style.setProperty(k, s[k], 'important'); } catch (e) {} }); }
    function page(ov) {
        const box = mainBox(ov); if (!box) return;
        if (!worth(ov, box)) return;
        // 已经是全屏的东西（动画、全屏游戏）：不动
        if (box.offsetWidth >= innerWidth * .95 && box.offsetHeight >= innerHeight * .95) return;
        place();
        const bg = getComputedStyle(box).backgroundColor;
        const T = findTitle(ov, box), X = findX(box);
        ov.classList.add('gy-aspage'); box.classList.add('gyp-box'); stripSize(box);
        if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) ov.style.setProperty('--gyp-bg', bg);
        try { ov.style.setProperty('--gyp-fg', getComputedStyle(box).color); } catch (e) {}
        if (T.el) T.el.classList.add('gyp-hide');
        if (X) X.classList.add('gyp-hide');
        ov.__gypX = X; ov.__gypFirst = box.firstElementChild;
        let bar = ov.querySelector(':scope > .gyp-bar');
        if (!bar) { bar = document.createElement('div'); bar.className = 'gyp-bar'; ov.insertBefore(bar, ov.firstChild); }
        bar.innerHTML = `<button type="button" class="gyp-back" aria-label="返回">‹</button><div class="gyp-title"></div>`;
        bar.querySelector('.gyp-title').textContent = T.text || '';
        bar.querySelector('.gyp-back').onclick = ev => { ev.stopPropagation(); closePage(ov); };
        try { box.scrollTop = 0; } catch (e) {}
    }
    function unpage(ov) {
        ov.classList.remove('gy-aspage');
        ov.querySelectorAll(':scope > .gyp-bar').forEach(b => b.remove());
        ov.querySelectorAll('.gyp-box').forEach(b => { b.classList.remove('gyp-box'); restoreSize(b); });
        ov.querySelectorAll('.gyp-hide').forEach(b => b.classList.remove('gyp-hide'));
        ov.style.removeProperty('--gyp-bg'); ov.style.removeProperty('--gyp-fg');
    }
    function closePage(ov) {
        const x = ov.__gypX;
        if (x && x.isConnected) { try { x.click(); } catch (e) {} if (!ov.isConnected || !vis(ov)) return; }
        if (typeof window.gyCloseOverlayEl === 'function') { window.gyCloseOverlayEl(ov); if (!ov.isConnected || !vis(ov)) return; }
        if (/Ov$/.test(ov.id || '') || ov.classList.contains('gyx-ov')) ov.remove(); else ov.style.display = 'none';
    }
    window.gyPageClose = closePage;

    function check(el) {
        if (!el || el.nodeType !== 1 || !el.isConnected) return;
        if (DENY.test(el.id || '') || el.hasAttribute('data-gy-nopage')) return;
        const shown = vis(el) && (el.classList.contains('gy-aspage') || coversScreen(el));   // 变成页面以后它就只占中间一栏了，不能再拿「盖满全屏」来判断
        if (!shown) { if (el.classList.contains('gy-aspage')) unpage(el); return; }
        if (!on() || document.body.classList.contains('gyphm')) return;
        if (el.classList.contains('gy-aspage')) {
            // 框里重新画过（innerHTML 整个换了）：把自己的标题 / ✕ 再收一次
            const box = el.querySelector(':scope > .gyp-box');
            if (!box || !box.isConnected) { unpage(el); page(el); return; }
            stripSize(box);
            if (box.firstElementChild !== el.__gypFirst) {
                el.__gypFirst = box.firstElementChild;
                const T = findTitle(el, box), X = findX(box);
                if (T.el) T.el.classList.add('gyp-hide'); if (X) { X.classList.add('gyp-hide'); el.__gypX = X; }
                const t = el.querySelector(':scope > .gyp-bar .gyp-title'); if (t && T.text && t.textContent !== T.text) t.textContent = T.text;
            }
            return;
        }
        page(el);
    }
    // 只认弹窗那几类（.modal-overlay / 插件面板 / xxxOv / xxxModal…）。以前还会把 body 下面所有盖满屏幕的 fixed 元素都当弹窗，
    // 结果把手机上的整个微信模式（#gyWx）也当成「页面」套了一层，联系人列表一跳就被拉回顶上。
    function scan() { document.querySelectorAll(CAND).forEach(check); }

    // 有东西出现 / 显示 / 换内容：在这一帧画出来之前就处理掉，不会先闪一下弹窗
    const pend = new Set(); let queued = false;
    function flush() { queued = false; const a = [...pend]; pend.clear(); a.forEach(check); }
    const mo = new MutationObserver(ms => {
        for (const m of ms) {
            const t = m.target;
            if (m.type === 'childList') {
                m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.matches(CAND)) pend.add(n); });
                if (t.nodeType === 1 && t.closest) { const ov = t.closest('.gy-aspage'); if (ov) pend.add(ov); }
            } else if (t.nodeType === 1 && t.matches(CAND)) pend.add(t);
        }
        if (pend.size && !queued) { queued = true; Promise.resolve().then(flush); }
    });

    // 左边栏换页：开着的「页面」跟着收掉
    function hookNav() {
        const f = window.switchMainView; if (typeof f !== 'function' || f.__gyPages) return;
        const w = function () { try { if (on()) document.querySelectorAll('.gy-aspage').forEach(ov => { if (vis(ov)) closePage(ov); }); } catch (e) {} return f.apply(this, arguments); };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} });
        w.__gyPages = true; window.switchMainView = w; try { (0, eval)('switchMainView = window.switchMainView'); } catch (e) {}
    }

    function mountToggle() {
        const p = document.getElementById('setPanel-appearance'); if (!p || document.getElementById('gyPagesRow')) return;
        const d = document.createElement('div'); d.id = 'gyPagesRow'; d.className = 'input-group';
        d.style.cssText = 'margin-bottom:15px;display:flex;align-items:center;gap:12px;';
        d.innerHTML = `<div style="flex:1;min-width:0"><label style="font-size:16px;">📄 功能打开成一页</label><div class="form-hint" style="margin:4px 0 0;">插件、TA 的状态、语音、相册这些内容多的，点开是一整页（顶上 ‹ 返回），不再是浮在上面的框；小的确认框还是小弹窗。关掉＝回到弹窗。</div></div><input type="checkbox" class="gypl-sw" id="gyPagesSw" ${on() ? 'checked' : ''} onchange="gyPagesSet(this.checked)">`;
        const after = document.getElementById('gyPolishRow');
        if (after && after.parentNode === p) after.after(d); else p.insertBefore(d, p.firstChild);
    }

    const css = document.createElement('style'); css.id = 'gyPagesCss';
    css.textContent = `
:root{--gyp-bh:52px}
body.gy-pages .gy-aspage.gy-aspage{left:var(--gyp-l,0)!important;width:var(--gyp-w,100vw)!important;right:auto!important;top:0!important;bottom:auto!important;height:100%!important;max-width:none!important;padding:0!important;margin:0!important;background:var(--gyp-bg,#fff)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;overflow:hidden!important;box-shadow:0 0 0 1px rgba(15,20,25,.06),0 0 40px rgba(15,20,25,.08);animation:gypIn .18s ease-out}
@keyframes gypIn{from{opacity:.6;transform:translateX(18px)}to{opacity:1;transform:none}}
body.gy-pages .gy-aspage>.gyp-bar{position:relative;z-index:5;flex:none;height:var(--gyp-bh);box-sizing:border-box;display:flex;align-items:center;gap:6px;padding:0 12px 0 4px;padding-top:env(safe-area-inset-top);height:calc(var(--gyp-bh) + env(safe-area-inset-top));background:var(--gyp-bg,#fff);border-bottom:1px solid rgba(127,127,127,.16);color:var(--gyp-fg,inherit)}
body.gy-pages .gy-aspage>.gyp-bar .gyp-back{flex:none;width:40px;height:40px;border:none;background:transparent;border-radius:50%;font-size:30px;line-height:1;color:var(--gy-accent,#1d9bf0);cursor:pointer;padding:0 0 4px}
body.gy-pages .gy-aspage>.gyp-bar .gyp-back:hover{background:rgba(var(--gy-accent-rgb,29,155,240),.1)}
body.gy-pages .gy-aspage>.gyp-bar .gyp-title{flex:1;min-width:0;font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--gyp-fg,inherit)}
body.gy-pages .gy-aspage .gyp-box{position:relative!important;inset:auto!important;left:auto!important;top:auto!important;transform:none!important;animation:none!important;width:100%!important;max-width:100%!important;min-width:0!important;height:calc(100% - var(--gyp-bh) - env(safe-area-inset-top))!important;max-height:none!important;min-height:0!important;flex:none!important;margin:0!important;border:none!important;border-radius:0!important;box-shadow:none!important;overflow-y:auto!important;overflow-x:hidden!important;box-sizing:border-box!important;padding-bottom:calc(28px + env(safe-area-inset-bottom))!important}
body.gy-pages .gy-aspage .gyp-box.gyx-box,body.gy-pages .gy-aspage .gyp-box>.gyx-bd{padding-left:18px;padding-right:18px}
body.gy-pages .gy-aspage .gyp-box.modal-box{padding-left:20px!important;padding-right:20px!important}
body.gy-pages .gy-aspage .gyp-hide,body.gy-pages .gy-aspage [class*="gy-rz-"]{display:none!important}
body.gy-pages .gy-aspage .gyp-box>.gyx-bd{max-width:820px;margin:0 auto}
@media (max-width:760px){body.gy-pages .gy-aspage{box-shadow:none}}
`;
    (document.head || document.documentElement).appendChild(css);

    function start() {
        document.body.classList.toggle('gy-pages', on());
        mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
        scan(); hookNav(); mountToggle();
        setInterval(() => { hookNav(); mountToggle(); if (on()) scan(); }, 1500);
        window.addEventListener('resize', () => { if (document.querySelector('.gy-aspage')) place(); });
    }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
