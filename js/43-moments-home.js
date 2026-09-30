/* ============================================================
   js/43 —— 主页顶上那张大图（朋友圈那种封面）
   ------------------------------------------------------------
   设置 → 外观 →「📷 主页顶上放一张大图」，**默认关**，不开就一个节点都不加，
   项目原来什么样还是什么样。

   开了之后，在主页时间线最上面挂一块：
   · 一张大图，用的就是**你资料页的背景图**（currentUser.bgImg）；
     没设背景图就用你的主题色拉个渐变兜底，不会空着。
   · 图的右下角：昵称 + 头像。头像**往下挪、半个身子探出图外**（照朋友圈那样），
     而且**不描边、不投影**。
   · 个人简介（资料页那条签名）放在**图的下面**，不盖在图上——
     压在照片上的字一多就看不清照片了。
   · 点大图 = 去自己的资料页（背景图和签名都在那儿改）。

   ⚠️ 这里**故意不做相机**：发帖还是项目原来那颗悬浮按钮。
      配上「微信风」那张 CSS 皮肤的话，那颗按钮本来就被挪到右上角、变成相机了，
      正好压在这张大图的右上角——跟微信朋友圈一个样，不用多一颗按钮。

   ⚠️ 写过一次的坑，记这儿：开关变量在 js/01 里是顶层 `let momentsHomeOn`，
      **顶层的 let 不会挂到 window 上**（跟 var / function 不一样），
      所以下面读的时候只能写裸名字 + typeof 兜底，千万别写 window.momentsHomeOn。
   ============================================================ */
(function () {
    'use strict';

    const ID = 'gyMoBanner';

    // 开关：顶层 let，只能这么读
    const isOn = () => { try { return typeof momentsHomeOn !== 'undefined' && !!momentsHomeOn; } catch (e) { return false; } };
    const me = () => { try { return (typeof currentUser !== 'undefined' && currentUser) || {}; } catch (e) { return {}; } };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // 没上传过背景图的时候拿主题色兜个底，别让大图空着
    function coverStyle() {
        const u = me();
        if (u.bgImg) return `background-image:url('${String(u.bgImg).replace(/'/g, "\\'")}')`;
        let c = u.themeColor;
        if (!c) { try { c = getComputedStyle(document.documentElement).getPropertyValue('--gy-accent').trim(); } catch (e) {} }
        c = c || '#1d9bf0';
        return `background-image:linear-gradient(135deg, ${c} 0%, rgba(0,0,0,.45) 100%)`;
    }

    function build() {
        const host = document.getElementById('view-home');
        if (!host) return null;
        let box = document.getElementById(ID);
        if (!box) {
            box = document.createElement('div');
            box.id = ID;
            box.className = 'gymo-banner';
            host.insertBefore(box, host.firstChild);
        }
        // 图的右下角：昵称 + 头像（头像**不描边、不投影**，就是一块干净的圆角方块）。
        // 个人简介放在**图的下面**那一条，不盖在图上——压在照片上的字多了就看不清照片。
        // 简介取的就是资料页里那条签名（currentUser.bio）。
        const u = me();
        const bio = String(u.bio || '').trim();
        const av = u.avatarImg
            ? `background-image:url('${String(u.avatarImg).replace(/'/g, "\\'")}'); background-size:cover; background-position:center;`
            : '';
        box.innerHTML =
            `<div class="gymo-cover" style="${coverStyle()}" title="点一下去我的资料页（背景图和签名都在那儿改）">` +
                `<div class="gymo-me">` +
                    `<span class="gymo-name">${esc(u.name || '我')}</span>` +
                    `<span class="gymo-avatar" style="${av}">${av ? '' : esc(u.avatarEmoji || (u.name || '我')[0])}</span>` +
                `</div>` +
            `</div>` +
            (bio ? `<div class="gymo-bio">${esc(bio)}</div>` : '');
        const cover = box.querySelector('.gymo-cover');
        // 点大图 = 去自己的资料页。手动点的，不受任何开关影响。
        cover.onclick = () => { try { switchMainView('profile', 'me'); } catch (e) {} };
        box.querySelector('.gymo-me').onclick = cover.onclick;
        return box;
    }

    // 开着就建/刷新，关了就整块拿走——关掉之后页面上一个节点都不剩
    function sync() {
        const old = document.getElementById(ID);
        if (!isOn()) {
            if (old) old.remove();
            document.body.classList.remove('gymo-on');
            return;
        }
        build();
        document.body.classList.add('gymo-on');
    }
    window.gyMoSync = sync;

    // 开关那颗勾（index.html 的 onchange 调这儿）
    window.gyMoToggle = function (el) {
        try { momentsHomeOn = !!(el && el.checked); } catch (e) {}
        sync();
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
    };

    // 回主页的时候刷一次：换过头像/名字/背景图都能跟上
    const sw0 = window.switchMainView;
    if (typeof sw0 === 'function' && !sw0.__gyMoHook) {
        window.switchMainView = function (viewId) {
            const r = sw0.apply(this, arguments);
            if (viewId === 'home') { try { sync(); } catch (e) {} }
            return r;
        };
        window.switchMainView.__gyMoHook = true;
    }
    // 改完资料（含背景图）立刻反映到大图上
    const up0 = window.updateUserMiniProfile;
    if (up0 && up0.call && !up0.__gyMoHook) {
        window.updateUserMiniProfile = function () {
            const r = up0.apply(this, arguments);
            try { if (document.getElementById(ID)) sync(); } catch (e) {}
            return r;
        };
        window.updateUserMiniProfile.__gyMoHook = true;
    }

    // 自带一份朴素样式：不贴皮肤也能看（贴了「微信风」那张 CSS 会把它压成朋友圈的样子）
    const CSS = `
.gymo-banner { margin: 0 0 6px; }
/* ⚠️ 昵称要贴在**图**的右下角，所以定位基准是 .gymo-cover，不是整块 .gymo-banner——
   写在 banner 上的话，简介那一条也算进高度里，名字会掉到简介上面去。 */
.gymo-cover { position: relative; height: 200px; background-size: cover;
              background-position: center; cursor: pointer; }
/* 照微信朋友圈那样：名字压在图的右下角，**头像往下挪、半个身子掉到图外面**。
   做法是名字位置不动，单给头像一个负的 margin-bottom 让它探出图的下沿。 */
.gymo-me { position: absolute; right: 16px; bottom: 14px; display: flex;
           align-items: flex-end; gap: 10px; cursor: pointer; z-index: 3; max-width: 80%; }
.gymo-name { color: #ffffff; font-weight: 700; font-size: 16px; line-height: 1.2;
             padding-bottom: 6px; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
/* 头像：干净一块圆角方块，**不描边、不投影** */
.gymo-avatar { width: 56px; height: 56px; border-radius: 8px; flex: 0 0 56px; margin-bottom: -28px;
               background-color: #e4e4e4; background-size: cover; background-position: center;
               display: flex; align-items: center; justify-content: center;
               font-size: 22px; font-weight: 700; color: #576b95; overflow: hidden;
               border: 0; box-shadow: none; }
/* 简介在图**下面**，不盖在图上 */
/* 简介在图下面。右边留出一块给探出来的头像，不然右对齐的字会撞上去 */
.gymo-bio { padding: 10px 92px 12px 16px; text-align: right; font-size: 13px; line-height: 1.5;
            min-height: 22px; opacity: .65; word-break: break-word; }
@media (max-width: 900px) { .gymo-cover { height: 170px; } }
`;
    try {
        const st = document.createElement('style');
        st.id = 'gyMoCss'; st.textContent = CSS;
        document.head.appendChild(st);
    } catch (e) {}

    // 启动时按开关状态摆好（存档读完之后）
    const boot = () => { try { sync(); } catch (e) {} };
    if (document.readyState === 'complete') setTimeout(boot, 1200);
    else window.addEventListener('load', () => setTimeout(boot, 1200));

    console.info('[主页大图] 已加载。开关：设置 → 外观 →「📷 主页顶上放一张大图」（默认关）');
})();
