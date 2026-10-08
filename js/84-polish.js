/* ============================================================
   ✨ 整理过的外观（v211）
   ------------------------------------------------------------
   功能越加越多，页面越来越乱：到处是蓝色粗边框的框框、一大段一大段说明、
   空着的音乐播放器和桌面小 TA 浮在内容上面。这一层只改样子，不动任何功能：
   · 卡片统一：浅边框 + 轻阴影 + 圆角，蓝色只留给按钮和重点；
   · 设置首页：iOS 那种分组列表，图标放进小方块；
   · 小功能页：一格一格的方块，说明最多两行；上面那段长说明收进「ⓘ 这页是什么」；
   · 全部开关：说明先显示两行，「📍 在哪 / 💰 花不花钱」点「展开」才出来；勾选框换成开关；
   · 插件页：加个搜索框；长说明、「新建插件」收起来；插件卡片不再露出一大坨代码；
   · 右边栏的卡片、搜索框换成同一套样子；
   · 浮在上面的东西：音乐播放器没放歌时缩成一个小圆按钮；桌面小 TA 在手机上进聊天时先藏起来（大小还是按你在插件里设的）。
   设置 → 🎨 外观与主题 最上面可以关掉（关掉＝原来的样子）。深色模式、配色、自定义 CSS 都照常生效。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyPolish) return;
    window.__gyPolish = true;
    const KEY = 'gyPolish';
    const on = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } };
    const apply = () => document.body.classList.toggle('gy-polish', on());
    window.gyPolishOn = on;
    window.gyPolishSet = function (v) {
        try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
        apply(); refreshAll();
        try { showToast('', v ? '✨ 整理过的外观' : '↩️ 回到原来的样子', '', null, null, false); } catch (e) {}
    };

    const css = document.createElement('style'); css.id = 'gyPolishCss';
    css.textContent = `
body.gy-polish{--pl-bg:#f5f6f8;--pl-card:#fff;--pl-line:rgba(15,20,25,.08);--pl-text:#0f1419;--pl-sub:#7b8794;--pl-shadow:0 1px 2px rgba(15,20,25,.05),0 4px 14px rgba(15,20,25,.05);--pl-r:16px}
body.gy-polish.dark-theme{--pl-bg:#0d0f12;--pl-card:#16181c;--pl-line:rgba(255,255,255,.08);--pl-text:#e7e9ea;--pl-sub:#8b98a5;--pl-shadow:0 1px 2px rgba(0,0,0,.4)}

/* ---------- 设置首页 / 小功能：分组列表 ---------- */
body.gy-polish #setIndex .set-menu{background:var(--pl-card);border:1px solid var(--pl-line);border-radius:var(--pl-r);box-shadow:var(--pl-shadow);overflow:hidden;gap:0!important;padding:0}
body.gy-polish #setIndex .set-menu .set-entry{background:transparent;border:none;border-radius:0;border-bottom:1px solid var(--pl-line);padding:12px 16px;color:var(--pl-text)}
body.gy-polish #setIndex .set-menu .set-entry:last-child{border-bottom:none}
body.gy-polish .set-entry:hover{background:rgba(var(--gy-accent-rgb),.06)}
body.gy-polish .set-entry-ico{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;background:rgba(var(--gy-accent-rgb),.1);flex:0 0 34px}
body.gy-polish .set-entry-title{font-weight:600;color:var(--pl-text)}
body.gy-polish .set-entry-desc{color:var(--pl-sub);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
body.gy-polish .set-entry-arrow{color:var(--pl-sub)}
body.gy-polish #setIndex .set-menu-sep{padding:16px 16px 6px;font-size:12px;color:var(--pl-sub);background:var(--pl-bg);border-bottom:1px solid var(--pl-line);margin:0}

/* 小功能：一格一格 */
body.gy-polish #miniFeatureList .set-menu{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px!important;margin-top:4px}
body.gy-polish #miniFeatureList .set-entry{align-items:flex-start;background:var(--pl-card);border:1px solid var(--pl-line);border-radius:var(--pl-r);box-shadow:var(--pl-shadow);padding:14px;min-height:92px;transition:transform .15s,box-shadow .15s}
body.gy-polish #miniFeatureList .set-entry:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(15,20,25,.08)}
body.gy-polish #miniFeatureList .set-entry-arrow{display:none}
body.gy-polish #miniFeatureList .set-entry-title{font-size:14.5px}
body.gy-polish #miniFeatureList .set-entry-desc{font-size:12px;line-height:1.55}
@media (max-width:600px){body.gy-polish #miniFeatureList .set-menu{grid-template-columns:1fr 1fr;gap:10px!important}body.gy-polish #miniFeatureList .set-entry{flex-direction:column;gap:8px;min-height:118px;padding:12px}}
@media (max-width:600px){body.gy-polish #view-mini-hub>.header-title{display:none}}
body.gy-polish.gyphm #view-mini-hub>.header-title{display:none}
body.gy-polish .gyhub-tabs{position:sticky;top:0;z-index:4;background:var(--pl-bg);padding:6px 0 8px}
body.gy-polish #view-mini-hub,body.gy-polish #view-settings{background:var(--pl-bg);min-height:100vh}
body.gy-polish #collapse-auto-features{border:none!important;background:transparent!important;padding:0!important}

/* 「ⓘ 这页是什么」 */
.gypl-about{margin:2px 0 12px;font-size:12.5px;color:var(--pl-sub,#7b8794)}
.gypl-about>summary{cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;background:rgba(var(--gy-accent-rgb),.08);color:var(--gy-accent)}
.gypl-about>summary::-webkit-details-marker{display:none}
.gypl-about[open]>summary{margin-bottom:8px}
.gypl-about>div{line-height:1.75;padding:10px 12px;border-radius:12px;background:var(--pl-card,#fff);border:1px solid var(--pl-line,rgba(0,0,0,.08))}

/* ---------- 全部开关 ---------- */
body.gy-polish .auto-feat-row{background:var(--pl-card);border:1px solid var(--pl-line)!important;border-radius:14px!important;box-shadow:none;margin:8px 0!important;padding:12px 14px!important;align-items:flex-start}
body.gy-polish .auto-feat-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--pl-sub)!important}
body.gy-polish .auto-feat-row:not(.gypl-open) .auto-feat-where,body.gy-polish .auto-feat-row:not(.gypl-open) .auto-feat-cost{display:none}
body.gy-polish .auto-feat-row.gypl-open .auto-feat-desc{-webkit-line-clamp:unset;display:block}
.gypl-more{display:inline-block;margin-top:4px;font-size:11.5px;color:var(--gy-accent);cursor:pointer;user-select:none}
body.gy-polish .auto-feat-row input[type=checkbox],body.gy-polish .gypl-sw{appearance:none;-webkit-appearance:none;flex:0 0 38px;width:38px;height:22px;border-radius:11px;background:#d5dbe0;position:relative;cursor:pointer;margin:2px 4px 0 0;transition:background .2s;order:2}
body.gy-polish .auto-feat-row input[type=checkbox]::after,body.gy-polish .gypl-sw::after{content:'';position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}
body.gy-polish .auto-feat-row input[type=checkbox]:checked,body.gy-polish .gypl-sw:checked{background:#34c759}
body.gy-polish .auto-feat-row input[type=checkbox]:checked::after,body.gy-polish .gypl-sw:checked::after{transform:translateX(16px)}
body.gy-polish .auto-feat-body{flex:1;min-width:0;order:1}

/* ---------- 插件页 ---------- */
body.gy-polish #pluginsList .wb-card{background:var(--pl-card);border:1px solid var(--pl-line);border-radius:14px;box-shadow:none;padding:12px 14px;margin-bottom:8px}
body.gy-polish #pluginsList .wb-card>.plugin-clamp-wrap{display:none}
body.gy-polish #pluginsList .wb-card.gypl-hide{display:none}
.gypl-psearch{width:100%;box-sizing:border-box;margin:6px 0 10px;padding:9px 14px;border-radius:999px;border:1px solid var(--pl-line,rgba(0,0,0,.1));background:var(--pl-card,#fff);font-size:14px;outline:none;color:inherit}
.gypl-psearch:focus{border-color:var(--gy-accent)}
body.gy-polish #pluginFormSection.gypl-folded>*:not(.gypl-fold-h){display:none!important}
.gypl-fold-h{cursor:pointer;font-weight:600;color:var(--gy-accent);padding:10px 0;user-select:none}

/* ---------- 右边栏 ---------- */
body.gy-polish .sidebar-right .info-card{border:1px solid var(--pl-line)!important;border-radius:20px;box-shadow:var(--pl-shadow);background:var(--pl-card)}
body.gy-polish .sidebar-right .info-card h3{font-size:17px}
body.gy-polish .sidebar-right .search-box{border:1px solid var(--pl-line)!important;background:var(--pl-card);box-shadow:var(--pl-shadow)}

/* ---------- 浮在上面的东西 ---------- */
body.gy-polish #gymRoot.gypl-empty .gym-player,body.gy-polish #gymRoot.gypl-empty>*:not(.gypl-mball){display:none!important}
.gypl-mball{display:none}
body.gy-polish #gymRoot.gypl-empty .gypl-mball{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:var(--pl-card,#fff);box-shadow:0 4px 14px rgba(0,0,0,.15);font-size:20px;cursor:pointer;opacity:.85}
body.gy-polish #gymRoot.gypl-empty .gypl-mball:hover{opacity:1}
body.gy-polish #gyxPet{opacity:.92}
@media (max-width:600px){body.gy-polish:has(#view-chat:not([style*="none"])) #gyxPet{display:none!important}}

/* ---------- 聊天：气泡下面挂的东西收紧一点 ---------- */
body.gy-polish .chat-bubble-wrapper>.rx-row{margin-top:2px}
body.gy-polish .chat-bubble-wrapper>div[style*="font-size:10px"]{opacity:.8}
body.gy-polish .gy-chat-status>summary{opacity:.75}
body.gy-polish .gy-chat-status[open]>summary{opacity:1}
`;
    document.head.appendChild(css);

    /* ---------- 小功能页：长说明收进「ⓘ」 ---------- */
    function tidyMini() {
        if (!on()) return;
        const box = document.getElementById('miniFeatureList'); if (!box || box.querySelector('.gypl-about')) return;
        const parts = [];
        const intro = [...box.children].find(el => !el.id && !el.classList.contains('set-menu') && /这一页收的是/.test(el.textContent || ''));
        const bar = document.getElementById('gyHubBar');
        const sw = bar && bar.querySelector('.gyhub-sw'), tip = bar && bar.querySelector('.gyhub-tip');
        [intro, tip, sw].forEach(el => { if (el) parts.push(el); });
        if (!parts.length) return;
        const d = document.createElement('details'); d.className = 'gypl-about';
        d.innerHTML = '<summary>ⓘ 这页是什么</summary><div></div>';
        const inner = d.querySelector('div'); parts.forEach(el => inner.appendChild(el));
        const after = bar && bar.querySelector('.gyhub-tabs');
        if (after) after.after(d); else box.insertBefore(d, box.firstChild);
    }
    /* ---------- 全部开关：「展开」 ---------- */
    function tidyAuto() {
        if (!on()) return;
        const box = document.getElementById('collapse-auto-features');
        const intro = box && [...box.children].find(el => el.id !== 'autoFeatureList' && !el.classList.contains('gypl-about') && /不用你点任何按钮/.test(el.textContent || ''));
        if (intro) { const d = document.createElement('details'); d.className = 'gypl-about'; d.innerHTML = '<summary>ⓘ 这些开关是什么</summary><div></div>'; intro.before(d); d.querySelector('div').appendChild(intro); }
        document.querySelectorAll('#autoFeatureList .auto-feat-row').forEach(row => {
            if (row.querySelector('.gypl-more')) return;
            const body = row.querySelector('.auto-feat-body'); if (!body) return;
            const m = document.createElement('span'); m.className = 'gypl-more'; m.textContent = '展开 ▾';
            m.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); const o = row.classList.toggle('gypl-open'); m.textContent = o ? '收起 ▴' : '展开 ▾'; });
            body.appendChild(m);
        });
    }
    /* ---------- 插件页：搜索 + 收起 ---------- */
    let pq = '';
    window.gyPolishPluginFilter = function (q) {
        pq = String(q || '').trim().toLowerCase();
        document.querySelectorAll('#pluginsList .wb-card').forEach(c => c.classList.toggle('gypl-hide', !!pq && (c.textContent || '').toLowerCase().indexOf(pq) < 0));
    };
    function tidyPlugins() {
        if (!on()) return;
        const list = document.getElementById('pluginsList'); if (!list) return;
        const wrap = list.parentNode;
        if (wrap && !wrap.querySelector('.gypl-about')) {
            const hints = [...wrap.children].filter(el => el.classList && el.classList.contains('form-hint'));
            if (hints.length) {
                const d = document.createElement('details'); d.className = 'gypl-about';
                d.innerHTML = '<summary>ⓘ 插件是什么 / 怎么用</summary><div></div>';
                const inner = d.querySelector('div'); hints[0].before(d); hints.forEach(h => inner.appendChild(h));
            }
        }
        if (!list.querySelector('.gypl-psearch') && list.querySelector('.wb-card')) {
            const s = document.createElement('input'); s.className = 'gypl-psearch'; s.placeholder = '🔍 搜插件（名字、说明）'; s.value = pq;
            s.addEventListener('input', () => window.gyPolishPluginFilter(s.value));
            const bar = list.querySelector('.plg-bar'); if (bar) bar.after(s); else list.insertBefore(s, list.firstChild);
            if (pq) window.gyPolishPluginFilter(pq);
        }
        const form = document.getElementById('pluginFormSection');
        if (form && !form.querySelector('.gypl-fold-h')) {
            const h = document.createElement('div'); h.className = 'gypl-fold-h'; h.textContent = '＋ 自己新建一个插件';
            h.addEventListener('click', () => { const f = form.classList.toggle('gypl-folded'); h.textContent = f ? '＋ 自己新建一个插件' : '－ 收起新建插件'; });
            form.insertBefore(h, form.firstChild); form.classList.add('gypl-folded');
        }
    }
    /* ---------- 音乐播放器：没放歌时缩成小圆按钮 ---------- */
    function tidyMusic() {
        const r = document.getElementById('gymRoot'); if (!r) return;
        if (!r.querySelector('.gypl-mball')) { const b = document.createElement('div'); b.className = 'gypl-mball'; b.title = '音乐盒'; b.textContent = '🎵'; b.addEventListener('click', () => { try { window.gymOpenMgr ? window.gymOpenMgr() : window.gymShow(); } catch (e) {} }); r.appendChild(b); }
        let empty = false; try { empty = typeof window.gymNowInfo === 'function' && !window.gymNowInfo(); } catch (e) {}
        r.classList.toggle('gypl-empty', on() && empty);
    }
    /* ---------- 外观页最上面：开关 ---------- */
    function mountToggle() {
        const p = document.getElementById('setPanel-appearance'); if (!p || document.getElementById('gyPolishRow')) return;
        const d = document.createElement('div'); d.id = 'gyPolishRow'; d.className = 'input-group';
        d.style.cssText = 'margin-bottom:15px;display:flex;align-items:center;gap:12px;';
        d.innerHTML = `<div style="flex:1;min-width:0"><label style="font-size:16px;">✨ 整理过的外观</label><div class="form-hint" style="margin:4px 0 0;">卡片、设置、小功能、开关、插件页统一成一套干净的样子；没放歌时音乐播放器缩成小圆点。关掉＝原来的样子。</div></div><input type="checkbox" class="gypl-sw" id="gyPolishSw" ${on() ? 'checked' : ''} onchange="gyPolishSet(this.checked)">`;
        p.insertBefore(d, p.firstChild);
    }
    function wrap(name, after) {
        const f = window[name]; if (typeof f !== 'function' || f.__gyPolish) return;
        const w = function () { const r = f.apply(this, arguments); try { after(); } catch (e) {} return r; };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} });   // 别的模块的标记一起带上，免得它们以为没包过、又包一层
        w.__gyPolish = true; window[name] = w; try { (0, eval)(name + ' = window.' + name); } catch (e) {}
    }
    function refreshAll() {
        try { if (typeof renderMiniFeaturePanel === 'function' && document.getElementById('miniFeatureList')) renderMiniFeaturePanel(); } catch (e) {}
        try { if (typeof renderAutoFeatureList === 'function' && document.getElementById('autoFeatureList')) renderAutoFeatureList(); } catch (e) {}
        try { if (typeof renderPluginsList === 'function' && document.getElementById('pluginsList')) renderPluginsList(); } catch (e) {}
        tidyMusic(); const sw = document.getElementById('gyPolishSw'); if (sw) sw.checked = on();
    }
    function hookAll() {
        wrap('renderMiniFeaturePanel', tidyMini);
        wrap('renderAutoFeatureList', tidyAuto);
        wrap('renderPluginsList', tidyPlugins);
        mountToggle(); tidyMusic(); tidyMini(); tidyAuto(); tidyPlugins();
    }
    apply(); hookAll(); setInterval(hookAll, 2500);
})();
