/* ===========================================================================
   js/79 —— 🧩 小功能整理：分组标签 + 把重复的合进原来的页面
   ---------------------------------------------------------------------------
   你同意的四件事：
     · 照片类合进「🖼️ 图库」：TA 的相册、涂鸦、明信片墙、情侣头像，在图库顶上一排入口
     · 天气出行合进「🗺️ 行程与天气」：早安简报、一起旅行
     · 日子类合成「📅 我们的日子」：原来的「日子」+ 纪念日惊喜、给 TA 过生日、小约定、一百件小事、愿望清单
     · 钱和设置类归位：存钱罐、记账进「钱包」页；声音、皮肤、思维链、统计、开场动画、开关中心、
       文案、来电铃声、拆信、发图方式、手机文件夹……这些「设置类」挪到「设置」目录里的「🧰 功能设置」
   小功能页本身分成几个标签：全部 / 陪伴 / 一起做 / 回忆 / 生活。
   被合进去的功能**一个都没删**：入口挪到了它的「家」里；搜索照样搜得到；
   页面顶上有开关，关掉就回到原来平铺的样子。新装的插件可以在 X.mini 里带 cat:'陪伴' 之类自己归类。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyFeatureHub) return; window.__gyFeatureHub = true;
    const K = 'gyHubOn';
    const on = () => { try { return localStorage.getItem(K) !== '0'; } catch (e) { return true; } };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const CATS = [['all', '全部'], ['陪伴', '💗 陪伴'], ['一起做', '🎈 一起做'], ['回忆', '📚 回忆'], ['生活', '🌆 生活']];
    const CAT = {
        // 陪伴：TA 主动来陪你的
        gyxPet: '陪伴', gyxRadio: '陪伴', gyxWake: '陪伴', gyxNight: '陪伴', gyxHug: '陪伴', gyxDream: '陪伴', gyxDraft: '陪伴', gyxMakeup: '陪伴', gyxSecret: '陪伴', moodbook: '陪伴', period: '陪伴',
        // 一起做
        music: '一起做', webMedia: '一起做', watch_together: '一起做', reading_together: '一起做', gyxStudy: '一起做', gyxCook: '一起做', gyxShow: '一起做', gyxQuiz: '一起做', gyxGrow: '一起做', gyxJournal: '一起做', gyxWorld: '一起做', gyxTheater: '一起做', gyxGame: '一起做',
        // 回忆
        gallery: '回忆', days: '回忆', gyxCapsule: '回忆', emoticon: '回忆', relations: '回忆',
        // 生活
        map: '生活', mall: '生活', now: '生活', kit: '生活', gossip: '生活', grapevine: '生活', factionNetwork: '生活', npc: '生活', web_explore: '生活', gyxMystic: '生活'
    };
    // 合进别人家的：家 → 孩子
    const HUBS = [
        { host: 'gallery', name: '图库', kids: ['gyxAlbum', 'gyxDoodle', 'gyxPost', 'gyxAvatar'], at: () => document.querySelector('#gyGalleryBody') },
        { host: 'map', name: '行程与天气', kids: ['gyxBrief', 'gyxTrip'], at: () => document.querySelector('#gymapModal .gymap-tabs') },
        { host: 'days', name: '我们的日子', kids: ['gyxAnniv', 'gyxBday', 'gyxPromise', 'gyx100', 'gyxWish'], at: () => { const m = document.querySelector('#gydayModal .gyday-box'); return m && m.children[1]; } },
        { host: 'wallet', name: '钱包', kids: ['gyxJar', 'gyxBook'], at: () => { const b = document.getElementById('upWalletBox'); return b && b.firstElementChild; } },
        { host: 'intro', name: '开场动画', kids: ['gyxIntro'], at: () => { const t = document.querySelector('.gymd-tabs'); return t && t.querySelector('span.on') && /开场/.test(t.querySelector('span.on').textContent) ? t.nextElementSibling : null; } }
    ];
    // 设置类：从小功能挪到「设置 → 🧰 功能设置」
    const SET_IDS = ['voice', 'gySkinBox', 'gyReasoningVault', 'chatstat', 'intro', 'charPhoto', 'folder', 'gyxSwitch', 'gyxVary', 'gyxRing', 'gyxLetter'];
    const kidOf = {}; HUBS.forEach(h => h.kids.forEach(k => { kidOf[k] = h; }));
    const feats = () => (typeof GY_MINI_FEATURES !== 'undefined' ? GY_MINI_FEATURES : []);
    const featOf = id => feats().find(f => f.id === id);
    const catOf = f => f.cat || CAT[f.id] || '生活';
    let TAB = 'all';
    try { TAB = localStorage.getItem('gyHubTab') || 'all'; } catch (e) {}

    /* ---------- 小功能页：分组标签 + 隐藏被合并 / 挪走的 ---------- */
    function wrapRender() {
        const r = window.renderMiniFeaturePanel;
        if (typeof r !== 'function' || r.__gyHub) return false;
        const w = function () {
            if (!on()) { const x = r.apply(this, arguments); bar(); return x; }
            // 先把要藏的临时拿掉，原函数画完再放回去（不动注册表本身，别的地方照样找得到）
            const all = feats(), keep = all.slice();
            const shown = all.filter(f => !kidOf[f.id] && !SET_IDS.includes(f.id) && (TAB === 'all' || catOf(f) === TAB));
            all.length = 0; shown.forEach(f => all.push(f));
            let x; try { x = r.apply(this, arguments); } finally { all.length = 0; keep.forEach(f => all.push(f)); }
            bar(); return x;
        };
        w.__gyHub = true; window.renderMiniFeaturePanel = w; try { renderMiniFeaturePanel = w; } catch (e) {}
        return true;
    }
    function bar() {
        const box = document.getElementById('miniFeatureList'); if (!box) return;
        let b = document.getElementById('gyHubBar'); if (b) b.remove();
        b = document.createElement('div'); b.id = 'gyHubBar';
        b.innerHTML = (on() ? `<div class="gyhub-tabs">${CATS.map(([k, n]) => `<span class="${TAB === k ? 'on' : ''}" onclick="gyHubTab('${k}')">${n}</span>`).join('')}</div>` : '')
            + `<label class="gyhub-sw"><input type="checkbox" ${on() ? 'checked' : ''} onchange="gyHubSet(this.checked)"> 整理过的样子（分组、重复的合进原页面、设置类挪去设置）；关掉＝原来平铺</label>`
            + (on() ? `<div class="gyhub-tip">合进去的在这里：📸 照片类 → 🖼️ 图库　🌦️ 早安 / 旅行 → 🗺️ 行程与天气　🎉 纪念日 / 生日 / 约定 / 一百件小事 / 愿望 → 📅 我们的日子　🐷 存钱罐 / 记账 → 钱包　🧰 声音、皮肤、开场等 → 设置 →「功能设置」</div>` : '');
        box.insertBefore(b, box.firstChild);
    }
    window.gyHubTab = k => { TAB = k; try { localStorage.setItem('gyHubTab', k); } catch (e) {} if (typeof renderMiniFeaturePanel === 'function') renderMiniFeaturePanel(); };
    window.gyHubSet = v => { try { localStorage.setItem(K, v ? '1' : '0'); } catch (e) {} if (typeof renderMiniFeaturePanel === 'function') renderMiniFeaturePanel(); setEntries(); rename(); };

    /* ---------- 「家」里的入口条 ---------- */
    function chips() {
        if (!on()) { document.querySelectorAll('.gyhub-in').forEach(e => e.remove()); return; }
        HUBS.forEach(h => {
            const at = h.at(); if (!at || !at.parentNode) return;
            const kids = h.kids.map(featOf).filter(Boolean);
            const cur = at.parentNode.querySelector(':scope > .gyhub-in');
            if (!kids.length) { if (cur) cur.remove(); return; }
            const sig = kids.map(k => k.id).join(',');
            if (cur && cur.dataset.sig === sig) return;
            if (cur) cur.remove();
            const d = document.createElement('div'); d.className = 'gyhub-in'; d.dataset.sig = sig;
            d.innerHTML = `<em>${h.host === 'intro' ? '更多开场' : '这里也有'}</em>` + kids.map(k => `<button type="button" onclick="gyOpenMiniFeature('${k.id}')">${k.icon || '🧩'} ${esc(k.title)}</button>`).join('');
            at.parentNode.insertBefore(d, at);
        });
    }
    // 「日子」改名「我们的日子」
    function rename() {
        const f = featOf('days'); if (!f) return;
        if (on() && f.title === '日子') { f.__t = f.title; f.title = '我们的日子'; f.desc = '认识第几天、纪念日、生日、小约定、一百件小事、愿望清单，都在这儿'; }
        if (!on() && f.__t) { f.title = f.__t; delete f.__t; }
        const hd = document.querySelector('#gydayModal .gyday-hd'); if (hd && hd.firstChild && hd.firstChild.nodeType === 3) { const want = on() ? '📅 我们的日子' : '📅 日子'; if (hd.firstChild.textContent !== want) hd.firstChild.textContent = want; }
    }
    /* ---------- 设置目录：🧰 功能设置 ---------- */
    function setEntries() {
        const menu = document.querySelector('#setIndex .set-menu'); if (!menu) return;
        menu.querySelectorAll('[data-gyhub]').forEach(e => e.remove());
        if (!on()) return;
        const L = SET_IDS.map(featOf).filter(Boolean); if (!L.length) return;
        const sep = document.createElement('div'); sep.className = 'set-menu-sep'; sep.dataset.gyhub = '1'; sep.textContent = '🧰 功能设置（从小功能挪过来的设置类）';
        menu.appendChild(sep);
        L.forEach(f => {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'set-entry'; b.dataset.core = '1'; b.dataset.gyhub = '1';
            b.innerHTML = `<span class="set-entry-ico">${f.icon || '🧩'}</span><span class="set-entry-main"><span class="set-entry-title">${esc(f.title)}</span><span class="set-entry-desc">${esc(f.desc || '')}</span></span><span class="set-entry-arrow">›</span>`;
            b.onclick = () => window.gyOpenMiniFeature(f.id);
            menu.appendChild(b);
        });
    }
    let lastSig = '';
    function tick() {
        wrapRender(); chips(); rename();
        const sig = on() + ':' + SET_IDS.filter(featOf).join(',');
        if (sig !== lastSig || !document.querySelector('#setIndex [data-gyhub]') === on()) { lastSig = sig; setEntries(); }
    }
    const css = document.createElement('style'); css.textContent = `
#gyHubBar{margin-bottom:10px}.gyhub-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.gyhub-tabs span{padding:6px 13px;border-radius:999px;background:rgba(128,128,128,.12);font-size:13px;cursor:pointer}.gyhub-tabs span.on{background:#1d9bf0;color:#fff}
.gyhub-sw{display:block;font-size:12px;color:#8b98a5;margin:4px 0}.gyhub-tip{font-size:11.5px;color:#8b98a5;line-height:1.7;margin:2px 0 6px}
.gyhub-in{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0 10px;padding:8px 10px;border-radius:14px;background:rgba(29,155,240,.07)}.gyhub-in em{font-style:normal;font-size:12px;color:#8b98a5;margin-right:2px}
.gyhub-in button{border:1px solid rgba(128,128,128,.25);background:rgba(255,255,255,.7);color:inherit;border-radius:999px;padding:5px 11px;font-size:12.5px;cursor:pointer;font-family:inherit}.gyhub-in button:hover{border-color:#1d9bf0;color:#1d9bf0}`;
    document.head.appendChild(css);
    window.gyHubInfo = () => ({ on: on(), HUBS: HUBS.map(h => ({ host: h.host, kids: h.kids })), SET_IDS, CAT });
    tick(); setInterval(tick, 800);
})();
