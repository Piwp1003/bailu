/* ===========================================================================
   js/73 —— ↩️ 返回：系统返回键 / 从屏幕左边缘往右滑 / 鼠标侧键（后退）
   ---------------------------------------------------------------------------
   三种方式都走同一个「退一步」，按顺序：
     ① 有弹窗 / 底部面板 / 浮层开着 → 先关掉最上面那个
     ② 小手机模式 → 小手机自己的返回（退一层；最外层回桌面）
     ③ 微信模式（手机）→ 从子页退回、从聊天退回、从别的页面回微信首页
     ④ 聊天里 → 回联系人列表
     ⑤ 别的页面 → 回上一页
     ⑥ 已经在最外层 → 系统返回键第一次提示「再按一次退出」，第二次才真的放行
   系统返回键：网页里靠浏览器的历史记录来接（在历史里垫一格，按返回时拦下来自己处理，再垫回去）。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyBackNavLoaded) return;
    window.__gyBackNavLoaded = true;

    const vis = el => { if (!el) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };

    // ① 最上面那个弹窗
    function closeTopOverlay() {
        // 小手机底部面板
        const sh = document.getElementById('gyPmSheet');
        if (sh && sh.classList.contains('on')) { try { window.gyPmCloseSheet(); } catch (e) { sh.classList.remove('on'); } return true; }
        // 动态建的浮层（小玩法、字卡库、神秘学、立绘……）和 .modal-overlay 类弹窗：挑 z-index 最高、看得见的那个
        const cands = [...document.querySelectorAll('.modal-overlay, #gyMysOv, [data-gy-overlay], .gy-aspage')].filter(vis);
        if (!cands.length) return false;
        const z = el => parseInt(getComputedStyle(el).zIndex, 10) || 0;
        cands.sort((a, b) => z(b) - z(a) || (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1));
        return closeEl(cands[0]);
    }
    // 关掉指定的一个浮层（「做成页面」那条顶栏上的 ‹ 也走这里）
    function closeEl(top) {
        if (!top) return false;
        // 动态建出来的浮层（xxxOv）：直接拿掉
        if (/Ov$/.test(top.id || '') || top.dataset.gyOverlay != null) { top.remove(); return true; }
        // 有自己的关闭按钮就点它（它可能还要顺手存东西）
        const x = top.querySelector('[data-close], .modal-close, .close-btn, .bl-hd > span, .bp-hd > span, .gysp-hd > span');
        if (x) { x.click(); if (!vis(top)) return true; }
        if (top.id && typeof closeModal === 'function' && top.classList.contains('modal-overlay') && top.parentNode === document.body && document.querySelector('#' + CSS.escape(top.id)) && !/^(bailu|gyMys|gySprite)/.test(top.id)) {
            try { closeModal(top.id); } catch (e) {}
            if (!vis(top)) return true;
        }
        if (/Ov$/.test(top.id || '') || top.dataset.gyOverlay != null) top.remove(); else top.style.display = 'none';
        return true;
    }
    window.gyCloseOverlayEl = closeEl;
    function inChat() { const a = document.getElementById('chatInputArea'); const vc = document.getElementById('view-chat'); return !!(a && a.style.display !== 'none' && vc && vis(vc)); }
    function atRoot() {
        if (document.body.classList.contains('gyphm')) return !document.body.classList.contains('gyphm-app');
        if (document.body.classList.contains('gywx') && window.innerWidth <= 900) { const st = window.gyWxState ? window.gyWxState() : {}; return !document.body.classList.contains('gywx-away') && !st.sub; }
        if (inChat()) return false;
        return !(typeof viewHistory !== 'undefined' && viewHistory.length > 1);
    }
    // 退一步。返回 true＝真的退了；false＝已经在最外层
    function back() {
        if (closeTopOverlay()) return true;
        const b = document.body.classList;
        // 通话界面开着：缩成小窗（不挂断）
        const call = document.getElementById('gyCallModal');
        if (call && vis(call) && typeof window.gyCallMin === 'function') { try { window.gyCallMin(); return true; } catch (e) {} }
        if (b.contains('gyphm')) {
            if (typeof window.gyPmPipOn === 'function' && window.gyPmPipOn() && !b.contains('gyphm-app')) { window.gyPmPipClose && window.gyPmPipClose(); return true; }
            if (b.contains('gyphm-app')) { try { window.gyPmBack(); } catch (e) {} return true; }
            return false;
        }
        if (b.contains('gywx') && window.innerWidth <= 900) {
            const st = window.gyWxState ? window.gyWxState() : {};
            if (b.contains('gywx-away')) { if (inChat() && typeof window.gyChatBack === 'function') { window.gyChatBack(); if (!b.contains('gywx-away')) return true; } try { window.gyWxHome(); } catch (e) {} return true; }
            if (st.sub) { window.gyWxSub(null); return true; }
            return false;
        }
        if (inChat()) { try { if (typeof window.gyChatBack === 'function') window.gyChatBack(); else backToContactList(); } catch (e) {} return true; }
        if (typeof viewHistory !== 'undefined' && viewHistory.length > 1 && typeof goBackToPreviousView === 'function') { goBackToPreviousView(); return true; }
        return false;
    }
    let lastBack = 0;
    window.gyBack = function (src) {
        const now = Date.now();
        if (now - lastBack < 350) return true;   // 滑动和系统手势同时触发时只算一次
        lastBack = now;
        return back();
    };

    /* ---------- 系统返回键：历史记录里垫一格 ---------- */
    const TAG = { gyBack: 1 };
    let exitArmed = 0;
    function arm() { try { if (!history.state || !history.state.gyBack) history.pushState(TAG, ''); } catch (e) {} }
    window.addEventListener('popstate', () => {
        const did = window.gyBack('sys');
        if (did || !atRoot()) { arm(); return; }
        // 已经在最外层：第一次提示，第二次放行（真的退出 / 回到浏览器上一页）
        if (Date.now() - exitArmed < 2200) { exitArmed = 0; try { history.back(); } catch (e) {} return; }
        exitArmed = Date.now(); toast('再按一次返回就退出'); arm();
    });

    /* ---------- 从左边缘往右滑 ---------- */
    let sw = null;
    const EDGE = 26;
    document.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) { sw = null; return; }
        const t = e.touches[0];
        sw = t.clientX <= EDGE ? { x: t.clientX, y: t.clientY, t: Date.now(), ind: null } : null;
    }, { passive: true });
    document.addEventListener('touchmove', e => {
        if (!sw) return; const t = e.touches[0], dx = t.clientX - sw.x, dy = Math.abs(t.clientY - sw.y);
        if (dy > 60 && dy > dx) { hideInd(); sw = null; return; }
        if (dx > 12) showInd(Math.min(1, dx / 90), t.clientY);
    }, { passive: true });
    document.addEventListener('touchend', e => {
        if (!sw) return; const t = e.changedTouches[0], dx = t.clientX - sw.x, dy = Math.abs(t.clientY - sw.y);
        const ok = dx > 80 && dy < dx * 0.8 && Date.now() - sw.t < 900;
        hideInd(); sw = null;
        if (ok) window.gyBack('swipe');
    }, { passive: true });
    document.addEventListener('touchcancel', () => { hideInd(); sw = null; }, { passive: true });
    // 滑的时候左边冒一个小箭头，告诉你「松手就返回」
    let ind = null;
    function showInd(p, y) {
        if (!ind) { ind = document.createElement('div'); ind.id = 'gyBackInd'; ind.innerHTML = '‹'; document.body.appendChild(ind); }
        ind.style.display = 'flex'; ind.style.top = (y - 22) + 'px'; ind.style.transform = `translateX(${-44 + p * 56}px) scale(${.7 + p * .3})`; ind.style.opacity = String(.3 + p * .7);
        ind.classList.toggle('go', p >= 1);
    }
    function hideInd() { if (ind) ind.style.display = 'none'; }

    /* ---------- 鼠标侧键（后退键） ---------- */
    window.addEventListener('mouseup', e => { if (e.button === 3) { e.preventDefault(); window.gyBack('mouse'); } });
    window.addEventListener('mousedown', e => { if (e.button === 3) e.preventDefault(); });

    const st = document.createElement('style');
    st.textContent = `#gyBackInd{position:fixed;left:0;z-index:2147483000;width:44px;height:44px;border-radius:50%;background:rgba(30,30,32,.72);color:#fff;font-size:28px;display:none;align-items:center;justify-content:center;pointer-events:none;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:background .15s}#gyBackInd.go{background:#1d9bf0}`;
    (document.head || document.documentElement).appendChild(st);
    // 等页面起来再垫第一格（太早 push 有的浏览器不认）
    const start = () => setTimeout(arm, 600);
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
    window.gyBackArm = arm;
})();
