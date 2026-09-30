/* ============================================================
   js/70 —— 气泡的小尖尖跟着气泡的颜色走（全站）
   ------------------------------------------------------------
   很多气泡 CSS（比如微信风那份）会用 ::before / ::after 给气泡画一个小尖尖，
   颜色是写死的（绿 / 白 / 灰）。一旦气泡本身的颜色被别的东西改了——
   换了主题、开了小手机 / 微信模式、又装了一份 CSS——尖尖还是原来那个颜色，
   气泡旁边就多出一个颜色不对的小方块。

   这里不管尖尖是哪份 CSS 画的、用什么方法画的（转 45° 的小方块，或者用边框拼的三角），
   每次气泡或样式变了，就量一下气泡现在是什么颜色，把尖尖上有颜色的部分都改成这个颜色。
   尖尖的形状、位置、大小都不动；气泡是透明的就不管（让 CSS 自己决定）。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyBubbleTailLoaded) return;
    window.__gyBubbleTailLoaded = true;

    const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
    const alpha = c => { const m = String(c || '').match(/rgba?\(([^)]+)\)/); if (!m) return c && c !== 'transparent' ? 1 : 0; const p = m[1].split(',').map(x => parseFloat(x)); return p.length > 3 ? p[3] : 1; };
    let last = '';
    function sample(kind) {
        const all = document.querySelectorAll('.chat-bubble.' + kind);
        for (const b of all) if (b.offsetParent !== null && !b.classList.contains('gycard')) return b;
        return null;
    }
    function rulesFor(kind) {
        const b = sample(kind); if (!b) return null;   // 页面上还没有这种气泡：保留上次的
        const bg = getComputedStyle(b).backgroundColor;
        if (!alpha(bg)) return '';
        const out = [];
        ['::before', '::after'].forEach(pe => {
            const cs = getComputedStyle(b, pe);
            if (!cs || cs.content === 'none' || cs.content === 'normal') return;
            // 带字的（比如「✆ 」这种小标记）不是尖尖
            if (!/^["']\s*["']$/.test(cs.content)) return;
            const w = parseFloat(cs.width) || 0, h = parseFloat(cs.height) || 0;
            if (w > 40 || h > 40) return;   // 太大的不是尖尖（可能是装饰底图），不碰
            const decl = [];
            if (alpha(cs.backgroundColor)) decl.push(`background-color:${bg}!important`);
            SIDES.forEach(sd => {
                if ((parseFloat(cs['border' + sd + 'Width']) || 0) > 0 && alpha(cs['border' + sd + 'Color'])) decl.push(`border-${sd.toLowerCase()}-color:${bg}!important`);
            });
            if (decl.length) out.push(`#view-chat .chat-bubble.chat-bubble.${kind}.${kind}${pe},.chat-bubble.chat-bubble.${kind}.${kind}${pe}{${decl.join(';')}}`);
        });
        return out.join('\n');
    }
    const keep = { me: '', other: '' };
    function fix() {
        ['me', 'other'].forEach(k => { const r = rulesFor(k); if (r !== null) keep[k] = r; });
        const css = keep.me + '\n' + keep.other;
        if (css === last) return;
        last = css;
        let st = document.getElementById('gyTailFix');
        if (!st) { st = document.createElement('style'); st.id = 'gyTailFix'; }
        st.textContent = css;
        document.head.appendChild(st);   // 永远放在最后：比别的样式表都晚
    }
    let t = null;
    const kick = () => { clearTimeout(t); t = setTimeout(() => { try { fix(); } catch (e) {} }, 120); };
    window.gyBubbleTailFix = () => { try { fix(); } catch (e) {} };
    function boot() {
        kick();
        // 装了 / 换了 CSS（<style>、<link> 变了）、切了模式（body 的 class 变了）、聊天重画了：都重新量一下
        try {
            new MutationObserver(ms => { if (ms.some(m => !(m.target && m.target.id === 'gyTailFix') && ![...(m.addedNodes || [])].every(n => n.id === 'gyTailFix'))) kick(); })
                .observe(document.head, { childList: true, subtree: true, characterData: true });
            new MutationObserver(kick).observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
            const box = document.getElementById('chatMessages') || document.getElementById('view-chat');
            if (box) new MutationObserver(kick).observe(box, { childList: true, subtree: true });
        } catch (e) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
