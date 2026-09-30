/* ============================================================
   js/69 —— 弹窗大小可以自己拖（全站）
   ------------------------------------------------------------
   哪些算"弹窗"：
     · .modal-box（几乎所有弹窗：.modal-overlay 里面那个白框，HTML 里写死的和 JS 现造的都是它）
     · .mini-game-float-panel（小游戏那种悬浮窗）
     · 任何自己标了 data-gy-resizable 的元素（以后新写的弹窗想要这功能，加个属性就行）
   不管：id 以 gyPm 开头的（手机模式自己的 sheet）、在 #gyPmSheet 里的、
         标了 data-gy-noresize 的、应用内的小提示框（.gy-dialog-overlay，alert/confirm 那种）。

   怎么用：
     · 右下角有个小斜纹把手，按住拖 → 同时改宽和高
     · 右边缘 / 下边缘也能拖（鼠标移上去光标会变），只改一个方向
     · 双击右下角把手 → 恢复原来的大小
     · 大小按弹窗记在 localStorage（key 用外层 overlay 的 id / 自己的 id / 标题文字），
       下次再打开还是你拖好的大小

   为什么把手放在框"里面"再手动跟着滚动条走，而不是 CSS resize: both：
     · resize 只认鼠标，手机上根本拖不动；
     · .modal-box 本身是个滚动容器，绝对定位的子元素会跟着内容滚走，
       所以每次滚动 / 尺寸变化都把把手摆回可见区域的右下角。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyModalResizeLoaded) return;
    window.__gyModalResizeLoaded = true;

    const LSK = 'gyModalSizesV1';
    const MIN_W = 140, MIN_H = 80;       // 比这还小的框（小提示）不给把手；拖的时候也不许拖到比这更小
    const SEL = '.modal-box, .mini-game-float-panel, [data-gy-resizable]';
    let SIZES = {};
    try { SIZES = JSON.parse(localStorage.getItem(LSK) || '{}') || {}; } catch (e) { SIZES = {}; }
    const saveSizes = () => { try { localStorage.setItem(LSK, JSON.stringify(SIZES)); } catch (e) {} };

    function skip(el) {
        if (!el || el.nodeType !== 1) return true;
        if (el.hasAttribute('data-gy-noresize')) return true;
        if (/^gyPm/.test(el.id || '')) return true;
        if (el.closest('#gyPmSheet, [id^="gyPm"], .gy-dialog-overlay, [data-gy-noresize]')) return true;
        return false;
    }
    // 记大小用的名字：外层 overlay 的 id 最稳（innerHTML 每次重写，框本身会换成新元素）
    function keyOf(box) {
        if (box.dataset.gyRzKey) return box.dataset.gyRzKey;
        const ov = box.parentElement && box.parentElement.classList.contains('modal-overlay') ? box.parentElement : null;
        if (ov && ov.id) return 'ov:' + ov.id;
        if (box.id) return 'id:' + box.id;
        const h = box.querySelector('h1, h2, h3, .mini-game-float-title');
        const t = h ? (h.textContent || '').trim().slice(0, 40) : '';   // 只是拿来当 key，截一下不影响显示
        return t ? 'h:' + t : '';
    }

    /* ---------- 大小的读写 ---------- */
    function setSize(box, w, h) {
        const vw = window.innerWidth, vh = window.innerHeight;
        w = Math.max(MIN_W, Math.min(Math.round(w), vw - 4));
        h = Math.max(MIN_H, Math.min(Math.round(h), vh - 4));
        const st = box.style;
        // 用 important：不少地方的 CSS（手机端适配、各弹窗自己的样式）给宽高/最大高度加了 !important
        st.setProperty('width', w + 'px', 'important');
        st.setProperty('height', h + 'px', 'important');
        st.setProperty('max-width', 'calc(100vw - 4px)', 'important');
        st.setProperty('max-height', 'calc(100vh - 4px)', 'important');
        st.setProperty('min-width', '0', 'important');
        st.setProperty('min-height', '0', 'important');
        st.setProperty('box-sizing', 'border-box', 'important');
        st.setProperty('flex', 'none', 'important');
        // 固定了高度，内容多了就得能滚
        const cs = getComputedStyle(box);
        if (cs.overflowY === 'visible') st.setProperty('overflow-y', 'auto', 'important');
        if (cs.overflowX === 'visible') st.setProperty('overflow-x', 'auto', 'important');
        box.dataset.gyRzSized = '1';
        return { w, h };
    }
    function clearSize(box) {
        ['width', 'height', 'max-width', 'max-height', 'min-width', 'min-height', 'box-sizing', 'flex', 'overflow-y', 'overflow-x']
            .forEach(p => box.style.removeProperty(p));
        delete box.dataset.gyRzSized;
    }
    // 设置过的弹窗换了元素（innerHTML 重写）：把记下的大小再套上去
    function restore(box) {
        const k = keyOf(box);
        const s = k && SIZES[k];
        if (s && s.w && s.h) setSize(box, s.w, s.h);
    }

    /* ---------- 把手 ---------- */
    function mkHandle(box, dir) {
        const h = document.createElement('div');
        h.className = 'gy-rz gy-rz-' + dir;
        h.setAttribute('data-gy-rz', dir);
        h.setAttribute('aria-hidden', 'true');
        if (dir === 'se') h.title = '拖动调整大小，双击恢复';
        h.addEventListener('pointerdown', e => startDrag(e, box, dir));
        if (dir === 'se') h.addEventListener('dblclick', e => { e.preventDefault(); e.stopPropagation(); resetBox(box); });
        // 手机上没有双击事件的可靠版本：自己数两次点按
        let lastTap = 0;
        if (dir === 'se') h.addEventListener('pointerup', e => {
            if (e.pointerType !== 'touch') return;
            const now = Date.now();
            if (now - lastTap < 350 && !h.__moved) resetBox(box);
            lastTap = now;
        });
        box.appendChild(h);
        return h;
    }
    function resetBox(box) {
        clearSize(box);
        const k = keyOf(box);
        if (k && SIZES[k]) { delete SIZES[k]; saveSizes(); }
        place(box);
    }
    // 把手摆到"当前能看到的区域"的右下角 / 右边 / 下边
    function place(box) {
        const hs = box.__gyRz;
        if (!hs) return;
        const w = box.offsetWidth, hgt = box.offsetHeight;
        const tooSmall = !box.dataset.gyRzSized && (w < MIN_W || hgt < MIN_H);
        const show = w > 0 && hgt > 0 && !tooSmall;
        const sl = box.scrollLeft, stp = box.scrollTop, cw = box.clientWidth, ch = box.clientHeight;
        hs.forEach(h => {
            if (!show) { h.style.display = 'none'; return; }
            h.style.display = 'block';
            const d = h.getAttribute('data-gy-rz');
            if (d === 'se') { h.style.left = (sl + cw - 18) + 'px'; h.style.top = (stp + ch - 18) + 'px'; }
            else if (d === 'e') { h.style.left = (sl + cw - 6) + 'px'; h.style.top = stp + 'px'; h.style.height = Math.max(0, ch - 20) + 'px'; }
            else if (d === 's') { h.style.left = sl + 'px'; h.style.top = (stp + ch - 6) + 'px'; h.style.width = Math.max(0, cw - 20) + 'px'; }
        });
    }

    let RO = null;
    try { RO = new ResizeObserver(entries => entries.forEach(en => place(en.target))); } catch (e) {}

    function attach(box) {
        if (box.__gyRz || skip(box)) return;
        // 把手是绝对定位的，框自己要是定位容器；static 的改成 relative（fixed/absolute 的本来就是）
        if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
        box.__gyRz = [mkHandle(box, 'e'), mkHandle(box, 's'), mkHandle(box, 'se')];
        box.addEventListener('scroll', () => place(box), { passive: true });
        if (RO) RO.observe(box);
        restore(box);
        place(box);
    }
    // 框里的 innerHTML 被重写时，把手会跟着被清掉——检测到就重新挂
    function reattachIfLost(box) {
        if (box.__gyRz && !box.__gyRz.every(h => h.parentNode === box)) {
            box.__gyRz.forEach(h => { try { h.remove(); } catch (e) {} });
            box.__gyRz = null;
            if (RO) try { RO.unobserve(box); } catch (e) {}
        }
        attach(box);
    }

    /* ---------- 拖 ---------- */
    let DRAG = null;
    function startDrag(e, box, dir) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault(); e.stopPropagation();
        const r = box.getBoundingClientRect();
        const cs = getComputedStyle(box);
        // 固定定位、靠 right/bottom 贴边的悬浮窗（小游戏面板），先换成 left/top，
        // 不然往右下拖时框会往左上长（右下角是钉死的）
        if (cs.position === 'fixed') {
            box.style.left = r.left + 'px'; box.style.top = r.top + 'px';
            box.style.right = 'auto'; box.style.bottom = 'auto';
        }
        // 居中摆放的弹窗（.modal-overlay 是 flex 居中）：框往两边同时长，
        // 所以鼠标挪 1px 框要长 2px，把手才会一直跟着手指
        const par = box.parentElement;
        let fx = 1, fy = 1;
        if (cs.position !== 'fixed' && cs.position !== 'absolute' && par) {
            const ps = getComputedStyle(par);
            if (ps.display.indexOf('flex') >= 0) {
                const row = ps.flexDirection.indexOf('column') < 0;
                const main = ps.justifyContent, cross = ps.alignItems;
                const mainC = main === 'center', crossC = cross === 'center';
                if (row) { fx = mainC ? 2 : 1; fy = crossC ? 2 : 1; } else { fx = crossC ? 2 : 1; fy = mainC ? 2 : 1; }
            }
            // margin:auto 居中的块元素
            if (fx === 1 && cs.marginLeft === cs.marginRight && parseFloat(cs.marginLeft) > 0 && ps.display.indexOf('flex') < 0) fx = 2;
        }
        const h = e.currentTarget; h.__moved = false;
        try { h.setPointerCapture(e.pointerId); } catch (e2) {}
        DRAG = { box, dir, h, x0: e.clientX, y0: e.clientY, w0: r.width, h0: r.height, fx, fy };
        document.documentElement.classList.add('gy-rz-dragging');
        h.addEventListener('pointermove', onMove);
        h.addEventListener('pointerup', onUp);
        h.addEventListener('pointercancel', onUp);
    }
    function onMove(e) {
        if (!DRAG) return;
        e.preventDefault();
        const dx = e.clientX - DRAG.x0, dy = e.clientY - DRAG.y0;
        if (Math.abs(dx) + Math.abs(dy) > 3) DRAG.h.__moved = true;
        const w = DRAG.dir === 's' ? DRAG.w0 : DRAG.w0 + dx * DRAG.fx;
        const hh = DRAG.dir === 'e' ? DRAG.h0 : DRAG.h0 + dy * DRAG.fy;
        setSize(DRAG.box, w, hh);
        place(DRAG.box);
    }
    function onUp(e) {
        if (!DRAG) return;
        const d = DRAG; DRAG = null;
        document.documentElement.classList.remove('gy-rz-dragging');
        try { d.h.releasePointerCapture(e.pointerId); } catch (e2) {}
        d.h.removeEventListener('pointermove', onMove);
        d.h.removeEventListener('pointerup', onUp);
        d.h.removeEventListener('pointercancel', onUp);
        if (!d.h.__moved) return;   // 只是点了一下，不算改大小
        const k = keyOf(d.box);
        const r = d.box.getBoundingClientRect();
        if (k) { SIZES[k] = { w: Math.round(r.width), h: Math.round(r.height) }; saveSizes(); }
    }

    /* ---------- 找弹窗：现有的 + 以后冒出来的 ---------- */
    function scan(root) {
        if (!root || root.nodeType !== 1) return;
        if (root.matches && root.matches(SEL)) reattachIfLost(root);
        if (root.querySelectorAll) root.querySelectorAll(SEL).forEach(reattachIfLost);
        // 改动发生在某个弹窗内部（比如 innerHTML 把把手冲掉了）
        const host = root.closest && root.closest(SEL);
        if (host && host !== root) reattachIfLost(host);
    }
    let pending = new Set(), timer = 0;
    function flush() {
        timer = 0;
        const list = Array.from(pending); pending = new Set();
        list.forEach(n => { try { if (n.isConnected) scan(n); } catch (e) {} });
    }
    function boot() {
        scan(document.body);
        try {
            new MutationObserver(muts => {
                for (const m of muts) {
                    if (m.type === 'childList') {
                        // 自己加/删把手引起的变动不用管
                        const onlyRz = Array.from(m.addedNodes).concat(Array.from(m.removedNodes)).every(n => n.nodeType === 1 && n.hasAttribute && n.hasAttribute('data-gy-rz'));
                        if (onlyRz) continue;
                        m.addedNodes.forEach(n => { if (n.nodeType === 1) pending.add(n); });
                        if (m.target && m.target.nodeType === 1) pending.add(m.target);
                    } else if (m.type === 'attributes' && m.target.nodeType === 1) {
                        // display:none → flex 这种打开方式：只有尺寸变了，ResizeObserver 会管；这里兜底重摆一次
                        const t = m.target;
                        if (t.__gyRz) place(t);
                        else if (t.classList && t.classList.contains('modal-overlay')) pending.add(t);
                    }
                }
                // 合并到下一帧一次性处理，聊天流式输出时 DOM 变得很频繁，不能每次都全量扫
                if (pending.size && !timer) timer = requestAnimationFrame(flush);
            }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
        } catch (e) {}
        window.addEventListener('resize', () => document.querySelectorAll(SEL).forEach(b => { if (b.__gyRz) { if (b.dataset.gyRzSized) { const r = b.getBoundingClientRect(); setSize(b, r.width, r.height); } place(b); } }));
    }

    /* ---------- 样式 ---------- */
    try {
        const st = document.createElement('style');
        st.id = 'gyModalResizeCss';
        st.textContent =
            '.gy-rz{position:absolute;z-index:5;touch-action:none;-webkit-user-select:none;user-select:none;display:none;}' +
            '.gy-rz-se{width:18px;height:18px;cursor:nwse-resize;opacity:.45;border-bottom-right-radius:inherit;' +
            'background:linear-gradient(135deg,transparent 0 45%,currentColor 45% 52%,transparent 52% 64%,currentColor 64% 71%,transparent 71% 83%,currentColor 83% 90%,transparent 90%);' +
            'color:#8b98a5;}' +
            '.gy-rz-se:hover,.gy-rz-se:active{opacity:.9;}' +
            '.gy-rz-e{width:6px;cursor:ew-resize;}' +
            '.gy-rz-s{height:6px;cursor:ns-resize;}' +
            /* 手指比鼠标粗：触屏上把手做大一点 */
            '@media (pointer:coarse){.gy-rz-se{width:26px;height:26px;margin:-8px 0 0 -8px;opacity:.55;}}' +
            'html.gy-rz-dragging, html.gy-rz-dragging *{cursor:nwse-resize !important;-webkit-user-select:none !important;user-select:none !important;}' +
            'body.dark-theme .gy-rz-se{color:#8b98a5;}';
        document.head.appendChild(st);
    } catch (e) {}

    window.gyModalResizeReset = function (key) { if (key) delete SIZES[key]; else SIZES = {}; saveSizes(); document.querySelectorAll(SEL).forEach(b => { if (b.__gyRz && (!key || keyOf(b) === key)) { clearSize(b); place(b); } }); };
    window.gyModalResizeScan = () => scan(document.body);

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
    console.info('[弹窗大小] 已加载：弹窗右下角可以拖，双击恢复');
})();
