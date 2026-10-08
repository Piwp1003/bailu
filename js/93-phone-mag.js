/* ===========================================================================
   js/93 —— 📰 小手机：黑白极简杂志风
   ---------------------------------------------------------------------------
   · 一整套主题：米白纸色、黑色细线、衬线大字、去掉圆角阴影、可选胶片颗粒；图标、Dock、锁屏、小组件、抽屉都跟着换
   · 杂志小组件：封面（刊名 + 期号 + TA 写的封面语）、大日期、引言（TA 说过的话）、目录（今天的几件事）、贴纸
   · 贴纸库：Open Doodles 手绘人物（CC0）、抠好的黑白照片（CC0 / 公共领域，见 img/mag/来源和版权.txt）、
            自己画的星星胶带条形码邮戳……；也能自己传图——自动抠背景（纯色背景不用联网；复杂背景用联网的模型）、
            画笔 / 橡皮修、转黑白、加白边，存进「我的贴纸」
   · 杂志壁纸：深空、发射台、咖啡、纸纹、方格、报纸
   · TA 会自己来：给你的小手机出一期封面（封面语是 TA 写的）、在你桌面上贴一张贴纸
   开关在：小手机 → 美化 → 📰 黑白杂志风。布局还是存在小手机自己那里，这个模块只存主题设置、你的贴纸、TA 写过的封面。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyPmMag) return; window.__gyPmMag = true;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const pad = n => String(n).padStart(2, '0');
    const dayKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []).filter(c => c && !c.members);
    const charOf = id => chars().find(c => String(c.id) === String(id));
    const curChar = () => charOf(window.currentChatSessionId) || chars()[0];
    const plain = t => String(t || '').replace(/<[^>]+>/g, '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    const isB = () => !!window.bailuCards;

    /* ---------------- 设置 ---------------- */
    const K = 'gyPmMag';
    let M = { on: false, grain: true, mast: '', ta: true };
    try { Object.assign(M, JSON.parse(localStorage.getItem(K) || '{}') || {}); } catch (e) {}
    const saveM = () => { try { localStorage.setItem(K, JSON.stringify(M)); } catch (e) {} };
    const LF = (typeof localforage !== 'undefined' && localforage.createInstance) ? localforage.createInstance({ name: 'gyPmMag', storeName: 'kv' }) : null;
    let D = { mine: [], covers: [], taStk: [] };   // mine：你的贴纸 {id, src, at, n, by}；covers：TA 写的封面 {id, cid, at, head, lines}；taStk：TA 贴过的 {id, cid, at, sid, line}
    const ready = (async () => { try { const v = LF && await LF.getItem('d'); if (v) D = Object.assign(D, v); } catch (e) {} D.mine = D.mine || []; D.covers = D.covers || []; D.taStk = D.taStk || []; })();
    const saveD = async () => { try { if (LF) await LF.setItem('d', D); } catch (e) {} };
    // 「TA 自己来」跟「全部开关」里那一行是同一个开关（存在 autoFeatureSwitches.pmMagTa）
    const taOn = () => { try { return typeof isAutoOn === 'function' ? isAutoOn('pmMagTa') : M.ta !== false; } catch (e) { return true; } };
    const mast = () => (M.mast || (isB() ? 'BAILU' : 'GUYU')).slice(0, 14);

    /* ---------------- 素材 ---------------- */
    const BASE = 'img/mag/';
    const svgU = s => 'data:image/svg+xml;utf8,' + encodeURIComponent(s);
    const SV = (vb, body) => svgU(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`);
    // 自己画的（黑白）
    const ORIG = [
        ['o_star', '四角星', SV('0 0 100 100', '<path d="M50 4 C54 40 60 46 96 50 C60 54 54 60 50 96 C46 60 40 54 4 50 C40 46 46 40 50 4Z" fill="#111"/>')],
        ['o_ast', '星号', SV('0 0 100 100', '<g stroke="#111" stroke-width="9" stroke-linecap="round"><path d="M50 10V90M15 30L85 70M85 30L15 70"/></g>')],
        ['o_arrow', '手绘箭头', SV('0 0 160 80', '<path d="M8 58 C40 20 90 18 140 36" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"/><path d="M118 20 L142 37 L116 50" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>')],
        ['o_bar', '条形码', SV('0 0 160 70', '<rect width="160" height="70" fill="#fff"/>' + [6, 3, 2, 5, 2, 7, 3, 2, 4, 6, 2, 3, 5, 2, 6, 3, 2, 4, 7, 2, 3, 5, 2, 4].reduce((a, w, i, A) => { const x = 8 + A.slice(0, i).reduce((s, v) => s + v + 3, 0); return a + (i % 2 ? '' : `<rect x="${x}" y="8" width="${w}" height="44" fill="#111"/>`); }, '') + '<text x="80" y="64" font-family="monospace" font-size="9" text-anchor="middle" fill="#111">0 52 1314 2026</text>')],
        ['o_stamp', '邮戳', SV('0 0 120 120', '<circle cx="60" cy="60" r="52" fill="none" stroke="#111" stroke-width="3"/><circle cx="60" cy="60" r="40" fill="none" stroke="#111" stroke-width="1.5"/><text x="60" y="56" font-family="Georgia,serif" font-size="15" text-anchor="middle" fill="#111" letter-spacing="2">NO.</text><text x="60" y="78" font-family="Georgia,serif" font-size="22" font-weight="700" text-anchor="middle" fill="#111">520</text><path d="M4 60h10M106 60h10" stroke="#111" stroke-width="3"/>')],
        ['o_tape', '胶带', SV('0 0 180 50', '<path d="M6 8 L174 4 L170 46 L10 44 Z" fill="#c9c6bf" opacity=".78"/><path d="M6 8 l4 4 -4 4 4 4 -4 4 4 4 -4 4 4 4 -4 4 M174 4 l-4 4 4 4 -4 4 4 4 -4 4 4 4 -4 4 4 4" fill="none" stroke="#fff" stroke-width="2"/>')],
        ['o_clip', '回形针', SV('0 0 60 140', '<path d="M38 30 V108 a14 14 0 0 1 -28 0 V22 a20 20 0 0 1 40 0 V100 a6 6 0 0 1 -12 0 V36" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"/>')],
        ['o_scrib', '划线', SV('0 0 200 40', '<path d="M6 26 C30 10 50 34 74 20 S120 8 140 24 S180 30 194 14" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"/>')],
        ['o_quote', '引号', SV('0 0 120 100', '<text x="0" y="110" font-family="Georgia,\'Times New Roman\',serif" font-size="170" fill="#111">“</text>')],
        ['o_heart', '空心爱心', SV('0 0 100 90', '<path d="M50 82 C14 58 6 38 12 24 C20 6 42 8 50 26 C58 8 80 6 88 24 C94 38 86 58 50 82Z" fill="none" stroke="#111" stroke-width="5" stroke-linejoin="round"/>')],
        ['o_ticket', '电影票', SV('0 0 200 90', '<path d="M8 8h184v24a13 13 0 0 0 0 26v24H8V58a13 13 0 0 0 0-26Z" fill="#fff" stroke="#111" stroke-width="3"/><path d="M140 10v70" stroke="#111" stroke-width="2" stroke-dasharray="5 5"/><text x="72" y="44" font-family="Georgia,serif" font-size="20" font-weight="700" text-anchor="middle" fill="#111">ADMIT ONE</text><text x="72" y="64" font-family="Georgia,serif" font-size="11" text-anchor="middle" fill="#111" letter-spacing="3">ROW 5 · SEAT 20</text><text x="166" y="50" font-family="Georgia,serif" font-size="14" text-anchor="middle" fill="#111" transform="rotate(-90 166 50)">No.0520</text>')],
        ['o_circle', '圈起来', SV('0 0 200 120', '<path d="M30 70 C10 30 80 8 130 14 C190 22 196 70 150 96 C110 118 40 110 24 84 C14 66 30 44 60 36" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/>')],
        ['o_film', '胶片', SV('0 0 200 90', '<rect width="200" height="90" fill="#111"/>' + Array.from({ length: 10 }, (_, i) => `<rect x="${6 + i * 20}" y="5" width="10" height="7" rx="1.5" fill="#f4f3ef"/><rect x="${6 + i * 20}" y="78" width="10" height="7" rx="1.5" fill="#f4f3ef"/>`).join('') + '<rect x="10" y="18" width="84" height="54" fill="#8a8a8a"/><rect x="106" y="18" width="84" height="54" fill="#c4c4c4"/>')],
        ['o_vol', '期号', SV('0 0 160 60', '<rect x="2" y="2" width="156" height="56" fill="#111"/><text x="80" y="40" font-family="Georgia,serif" font-size="26" font-style="italic" text-anchor="middle" fill="#f4f3ef" letter-spacing="2">Vol. 01</text>')]
    ];
    const DD = [['dd_coffee', '端着咖啡'], ['dd_reading', '盘腿看书'], ['dd_readside', '靠着看书'], ['dd_sitread', '坐椅子上看书'], ['dd_petting', '摸狗'], ['dd_doggie', '和狗坐着'], ['dd_plant', '抱着盆栽'], ['dd_loving', '心里有个爱心'], ['dd_meditate', '打坐'], ['dd_laying', '趴着玩手机'], ['dd_selfie', '自拍'], ['dd_stroll', '散步'], ['dd_icecream', '大冰淇淋'], ['dd_levitate', '飘起来'], ['dd_float', '漂浮'], ['dd_swing', '荡秋千']];
    const PH = [['st_coffee', '一杯咖啡'], ['st_cat', '小猫'], ['st_horse', '马的剪影']];
    function library() {
        return [{ k: 'mine', n: '我的贴纸', L: D.mine.map(x => ({ id: x.id, n: x.n || '我的', src: x.src, mine: 1 })) },
            { k: 'dd', n: '手绘小人（Open Doodles）', L: DD.map(([id, n]) => ({ id, n, src: BASE + id + '.svg' })) },
            { k: 'ph', n: '抠好的黑白照片', L: PH.map(([id, n]) => ({ id, n, src: BASE + id + '.png' })) },
            { k: 'or', n: '小物件', L: ORIG.map(([id, n, src]) => ({ id, n, src })) }];
    }
    const stkSrc = id => { for (const g of library()) { const x = g.L.find(y => y.id === id); if (x) return x.src; } return ''; };
    // 纸纹 / 网点 / 颗粒（全是 CSS / SVG，不占文件）
    const NOISE = svgU('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>');
    const WALLS = [
        ['纸', { color: `#f4f3ef url("${NOISE}")` }], ['白', { color: '#ffffff' }], ['黑', { color: '#111111' }],
        ['方格', { color: '#f4f3ef repeating-linear-gradient(0deg,transparent 0 23px,rgba(17,17,17,.12) 23px 24px),repeating-linear-gradient(90deg,transparent 0 23px,rgba(17,17,17,.12) 23px 24px)' }],
        ['横线', { color: '#f6f5f1 repeating-linear-gradient(180deg,transparent 0 31px,rgba(17,17,17,.14) 31px 32px)' }],
        ['网点', { color: '#f4f3ef radial-gradient(rgba(17,17,17,.22) 1px,transparent 1.4px) 0 0/9px 9px' }],
        ['深空', BASE + 'wp_stars.jpg'], ['发射台', BASE + 'wp_rocket.jpg'], ['咖啡', BASE + 'wp_coffee.jpg']
    ];

    /* ---------------- 主题开关 ---------------- */
    function apply() { const b = document.body.classList; b.toggle('pm-th-mag', !!M.on); b.toggle('pm-mag-grain', !!(M.on && M.grain)); }
    window.gyMagSet = function (k, v) {
        if (k === 'ta') { try { autoFeatureSwitches.pmMagTa = !!v; if (typeof saveAllData === 'function') saveAllData(); } catch (e) {} }
        M[k] = v; saveM(); apply();
        if (k === 'on' && v) { toast(pick(['📰 换成杂志风了', '📰 这一期，黑白', '📰 翻到新的一页']), '美化里还能换杂志壁纸、加封面和贴纸'); }
        try { if (window.__gyPmW && window.__gyPmW.render) window.__gyPmW.render(); } catch (e) {}
        if (document.getElementById('gyPmSheet') && /美化/.test((document.querySelector('#gyPmSheet h4') || {}).textContent || '')) window.gyPmBeauty();
    };
    window.gyMagWall = function (i, lock) { const w = WALLS[i]; if (!w || typeof window.gyPmSetWall !== 'function') return; window.gyPmSetWall(w[1], lock); toast(lock ? '锁屏换好了' : '壁纸换好了', w[0]); };
    // 一键摆一个杂志桌面：在当前这页放封面、大日期、引言、两张贴纸
    window.gyMagLayout = async function () {
        if (!M.on) window.gyMagSet('on', true);
        const add = (k, z, d) => { try { const it = window.gyPmAddW(k, z), W = window.__gyPmW, w = it && W && W.findW(it.id); if (d && w) { w.d = Object.assign({}, w.d || {}, d); W.save(); } } catch (e) {} };
        try { if (typeof window.gyPmNewPage === 'function') { window.gyPmNewPage(); window.gyPmEdit && window.gyPmEdit(false); } } catch (e) {}   // 新开一页摆，原来的桌面不动
        add('magCover', 'l'); add('magDate', 's'); add('magStk', 's', { sid: 'dd_coffee', rot: -4 }); add('magQuote', 'm');
        setTimeout(() => { document.querySelectorAll('#gyPmHome .pm-page,#gyPmHome .pm-pages').forEach(e => { e.scrollTop = 0; }); }, 60);
        try { window.__gyPmW.render(); } catch (e) {}
        toast('杂志桌面摆好了', '新开了一页，原来的桌面没动；长按能拖、能删、能换大小');
    };

    /* ---------------- 美化抽屉里加一节 ---------------- */
    function hookBeauty() {
        const f = window.gyPmBeauty; if (typeof f !== 'function' || f.__mag) return;
        const w = function () {
            const r = f.apply(this, arguments);
            try {
                const box = document.querySelector('#gyPmSheet h4'); if (!box) return r;
                const sec = document.createElement('div'); sec.className = 'pm-magsec';
                sec.innerHTML = `<div class="lbl">📰 黑白杂志风</div><div class="seg"><span class="chip${!M.on ? ' on' : ''}" onclick="gyMagSet('on',false)">不用</span><span class="chip${M.on ? ' on' : ''}" onclick="gyMagSet('on',true)">换成杂志风</span></div>
                    ${M.on ? `<div class="lbl">胶片颗粒</div><div class="seg"><span class="chip${M.grain ? ' on' : ''}" onclick="gyMagSet('grain',true)">有</span><span class="chip${!M.grain ? ' on' : ''}" onclick="gyMagSet('grain',false)">没有</span></div>
                    <div class="lbl">刊名（封面和锁屏上的大字）</div><input class="in" value="${esc(mast())}" maxlength="14" onchange="gyMagSet('mast',this.value.trim())">
                    <div class="lbl">杂志壁纸（点一下换桌面，长按换锁屏）</div><div class="pm-magwl">${WALLS.map(([n, v], i) => `<span title="${n}" style="${typeof v === 'string' ? `background-image:url('${v}')` : `background:${v.color}`}" onclick="gyMagWall(${i})" oncontextmenu="event.preventDefault();gyMagWall(${i},1)"><i>${n}</i></span>`).join('')}</div>
                    <button class="it" onclick="gyMagStickers()">贴纸库（还能自己传图抠图）</button>
                    <button class="it" onclick="gyPmCloseSheet();gyMagLayout()">一键摆一个杂志桌面</button>
                    <div class="lbl">TA 自己来</div><div class="seg"><span class="chip${taOn() ? ' on' : ''}" onclick="gyMagSet('ta',true)">会出封面、贴贴纸</span><span class="chip${!taOn() ? ' on' : ''}" onclick="gyMagSet('ta',false)">不要</span></div>` : ''}`;
                box.insertAdjacentElement('afterend', sec);
            } catch (e) {}
            return r;
        };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__mag = true; window.gyPmBeauty = w;
    }

    /* ---------------- 小组件 ---------------- */
    const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], WDE = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const coverOf = cid => D.covers.find(x => !cid || x.cid === String(cid));
    const avatarUrl = c => { try { const u = c && (c.avatarImg || c.avatar); return u && /^(data:|https?:|blob:|\.?\/|img\/)/.test(u) ? u : ''; } catch (e) { return ''; } };
    function lastTaLine(c) { const H = (c && typeof globalChats !== 'undefined' && globalChats[c.id]) || []; for (let i = H.length - 1; i >= 0; i--) { const m = H[i]; if (String(m.sender) === String(c.id)) { const t = plain(m.text); if (t.length >= 4 && t.length <= 40) return t; } } return ''; }
    function regWidgets() {
        const W = window.__gyPmW; if (!W || !W.WD) return false; const WD = W.WD;
        if (WD.magCover) return true;
        const cOf = w => charOf(w.d && w.d.cid) || curChar();
        WD.magCover = { n: '📰 杂志封面', sizes: ['l', 'm'], pv: 'l', tap: w => window.gyMagCoverSheet(w.id), r(w) {
            const c = cOf(w), cv = c && coverOf(c.id), now = new Date(), img = (w.d && w.d.img) || avatarUrl(c), sid = w.d && w.d.sid;
            const head = (cv && cv.head) || lastTaLine(c) || '今天也想见你', lines = (cv && cv.lines) || [];
            const pic = img ? `<div class="mg-pic" style="background-image:url('${esc(img)}')"></div>` : `<div class="mg-pic st"><img src="${esc(stkSrc(sid || 'dd_reading'))}" alt=""></div>`;
            if (w.size === 'm') return `<div class="mg-cov m">${pic}<div class="tx"><b class="mg-mast">${esc(mast())}</b><em>VOL.${pad(now.getMonth() + 1)} · NO.${pad(now.getDate())}</em><span class="mg-head">${esc(head)}</span>${c ? `<i>—— ${esc(c.remark || c.name)}</i>` : ''}</div></div>`;
            return `<div class="mg-cov l${img ? '' : ' stc'}">${pic}<b class="mg-mast">${esc(mast())}</b><em class="mg-iss">VOL.${pad(now.getMonth() + 1)} · NO.${pad(now.getDate())} · ${now.getFullYear()}</em><div class="mg-cl">${lines.slice(0, 3).map(l => `<span>${esc(l)}</span>`).join('')}</div><div class="mg-foot"><span class="mg-head">${esc(head)}</span>${c ? `<i>${cv ? '封面语' : '摘自'} · ${esc(c.remark || c.name)}</i>` : ''}</div></div>`;
        }, edit: w => `<div class="lbl">谁的封面</div><div class="chips">${chars().map(c => `<span class="chip${String((w.d && w.d.cid) || (curChar() || {}).id) === String(c.id) ? ' on' : ''}" onclick="gyPmWSet('${w.id}','cid','${esc(c.id)}')">${esc(c.remark || c.name)}</span>`).join('')}</div>
            <div class="lbl">封面图</div><div class="chips"><span class="chip${!(w.d && w.d.img) && !(w.d && w.d.sid) ? ' on' : ''}" onclick="gyPmWSet('${w.id}','img','');gyPmWSet('${w.id}','sid','')">TA 的头像</span><label class="chip">换照片<input type="file" accept="image/*" style="display:none" onchange="gyMagCoverImg('${w.id}',this)"></label><span class="chip" onclick="gyMagStickers('${w.id}','sid')">用一张贴纸</span></div>
            <button class="it" onclick="gyMagCoverNow('${w.id}')">请 TA 写这一期的封面语</button>` };
        WD.magDate = { n: '📰 大日期', sizes: ['s', 'm'], tap: () => { try { window.gyPmOpen('calendar'); } catch (e) {} }, r(w) {
            const d = new Date();
            if (w.size === 'm') return `<div class="mg-date m"><b>${d.getDate()}</b><div><em>${MON[d.getMonth()]} ${d.getFullYear()}</em><span>${WDE[d.getDay()]}</span><i>${['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()]}</i></div></div>`;
            return `<div class="mg-date s"><em>${MON[d.getMonth()]}</em><b>${d.getDate()}</b><span>${WDE[d.getDay()].slice(0, 3)}</span></div>`;
        } };
        WD.magQuote = { n: '📰 引言', sizes: ['m', 'l'], tap: w => { const c = cOf(w); if (c && window.gyPmOpenChat) window.gyPmOpenChat(c.id); }, r(w) {
            let m = null; try { m = W.pickSay(w); } catch (e) {}
            const c = m ? charOf(m.cid) : cOf(w), t = m ? m.t : (c ? lastTaLine(c) : '');
            if (!t) return `<div class="mg-q empty"><b>“</b><span>等 TA 说几句话，这里会摘一句</span></div>`;
            return `<div class="mg-q ${w.size}"><b>“</b><span>${esc(t.slice(0, w.size === 'l' ? 90 : 46))}</span><i>—— ${esc(m ? m.name : (c && c.name) || '')}, p.${(new Date().getDate() * 7) % 97 + 3}</i></div>`;
        } };
        WD.magIndex = { n: '📰 目录', sizes: ['m', 'l'], tap: () => { try { window.gyPmOpen('today'); } catch (e) {} }, r(w) {
            const c = curChar(), rows = [];
            let un = 0; try { un = W.G().unread ? W.G().unread() : 0; } catch (e) {}
            rows.push(['等你回', un ? un + ' 条' : '都回完了']);
            if (c && c.lifeState && c.lifeState.activity) rows.push([(c.remark || c.name) + ' 在', c.lifeState.activity]);
            try { const wi = window.gymapWeatherInfo && window.gymapWeatherInfo(); if (wi) rows.push(['天气', `${wi.desc || ''} ${wi.min}~${wi.max}°`]); } catch (e) {}
            const cv = c && coverOf(c.id); if (cv) rows.push(['封面故事', cv.head]);
            try { const L = typeof gyMyDayAll === 'function' ? gyMyDayAll().filter(x => x && x.date === dayKey()) : []; if (L.length) rows.push(['今天要做', L[0].title || L[0].text || '']); } catch (e) {}
            rows.push(['这一页', pick(['慢慢来', '好好吃饭', '记得喝水', '想你'])]);
            return `<div class="mg-idx"><b>CONTENTS</b>${rows.slice(0, w.size === 'l' ? 7 : 4).map((r, i) => `<div><em>${pad(i + 1)}</em><span>${esc(r[0])}</span><i>${esc(String(r[1]).slice(0, 18))}</i></div>`).join('')}</div>`;
        } };
        WD.magStk = { n: '📰 贴纸', sizes: ['s', 'm', 'l'], tap: w => window.gyPmItemSheet(w.id), r(w) {
            const src = (w.d && w.d.src) || stkSrc((w.d && w.d.sid) || 'o_star'), rot = +(w.d && w.d.rot) || 0, by = w.d && w.d.by;
            return `<div class="mg-stk"><img src="${esc(src)}" alt="" style="transform:rotate(${rot}deg)" draggable="false">${by ? `<i>${esc(by)} 贴的</i>` : ''}</div>`;
        }, edit: w => `<div class="lbl">换一张</div><button class="it" onclick="gyMagStickers('${w.id}','sid')">打开贴纸库</button>
            <div class="lbl">歪一点<em class="val" id="gyMagRotV">${+(w.d && w.d.rot) || 0}°</em></div><input class="rg" type="range" min="-30" max="30" step="1" value="${+(w.d && w.d.rot) || 0}" oninput="document.getElementById('gyMagRotV').textContent=this.value+'°';gyPmWSet('${w.id}','rot',+this.value,1)">` };
        return true;
    }
    window.gyMagCoverImg = function (wid, inp) {
        const f = inp && inp.files && inp.files[0]; if (!f) return;
        const go = u => { const W = window.__gyPmW, w = W && W.findW(wid); if (!w) return; w.d = Object.assign({}, w.d || {}, { img: u, sid: '' }); W.save(); W.render(); };
        if (typeof window.gyPmCrop === 'function') window.gyPmCrop(f, 3 / 4, 720, go, { title: '封面照片' }); else { const r = new FileReader(); r.onload = () => go(r.result); r.readAsDataURL(f); }
    };
    window.gyMagCoverNow = async function (wid) {
        const W = window.__gyPmW, w = W && W.findW(wid), c = (w && charOf(w.d && w.d.cid)) || curChar(); if (!c) return;
        toast('📰 ' + (c.remark || c.name) + ' 在写封面…', '');
        const r = await writeCover(c); if (r) { W.render(); toast('新一期出来了', '「' + r.head + '」'); }
    };
    window.gyMagCoverSheet = function (wid) { window.gyPmItemSheet(wid); };

    /* ---------------- TA 写封面 ---------------- */
    async function askTa(c, prompt) {
        try {
            const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
            if (isB() || !api || !api.key || typeof callChatCompletionAPI !== 'function') return null;
            const msgs = (typeof buildStructuredMessages === 'function' && typeof buildBasePrompt === 'function') ? buildStructuredMessages(buildBasePrompt(c, false, ''), [], prompt) : [{ role: 'user', content: prompt }];
            const d = await callChatCompletionAPI(api, msgs);
            let t = String((d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '').trim();
            if (typeof stripReasoningBlocks === 'function') t = stripReasoningBlocks(t);
            return t || null;
        } catch (e) { return null; }
    }
    async function writeCover(c) {
        await ready;
        let head = '', lines = [];
        const t = await askTa(c, '你在给她手机桌面上的「杂志封面」写这一期的封面语：一句主标题（16 字以内，像杂志封面大字，带点只有你们懂的意思），再加 3 条小标题（每条 10 字以内，像「独家：……」「本期：……」）。只输出 JSON：{"head":"","lines":["","",""]}');
        try { const m = String(t || '').match(/\{[\s\S]*\}/); const j = m ? JSON.parse(m[0]) : null; if (j && j.head) { head = plain(j.head).slice(0, 20); lines = (j.lines || []).map(x => plain(x).slice(0, 14)).filter(Boolean).slice(0, 3); } } catch (e) {}
        if (!head) {
            let cards = []; try { cards = window.bailuDraw ? window.bailuDraw('情话', c, 2).filter(Boolean) : []; } catch (e) {}
            head = (cards[0] && plain(cards[0]).slice(0, 20)) || lastTaLine(c) || pick(['本期主角：你', '想你的第 N 天', '今日头条：我很想你', '这一期只写你']);
            lines = [pick(['独家：TA 的小秘密', '本期：一起吃什么', '特别企划：晚安']), pick(['专访：今天的你', '连载：我们的日子', '读者来信：想你']), 'P.' + (new Date().getDate()) + ' 写给你的话'];
        }
        const it = { id: 'cv' + Date.now().toString(36), cid: String(c.id), at: Date.now(), head, lines };
        D.covers.unshift(it); D.covers = D.covers.slice(0, 60); await saveD();
        return it;
    }
    window.gyMagWriteCover = id => writeCover(charOf(id) || curChar());

    /* ---------------- 贴纸库 ---------------- */
    // target：给哪个小组件换（wid + 字段）；不传＝放一张新的到桌面
    window.gyMagStickers = async function (wid, field) {
        await ready;
        const gs = library();
        window.gyPmSheet(`<h4>贴纸库</h4><div class="pm-wg-tip">${wid ? '点一张换上' : '点一张就贴到当前这页'}。手绘小人是 Open Doodles（CC0），照片是 CC0 / 公共领域的，抠好转了黑白。</div>
            <label class="it pri">＋ 传一张图，抠成贴纸<input type="file" accept="image/*" style="display:none" onchange="gyMagCutFile(this)"></label>
            ${gs.map(g => `<div class="lbl">${esc(g.n)}${g.k === 'mine' ? `（${g.L.length}）` : ''}</div><div class="pm-magst">${g.L.map(x => `<span onclick="gyMagPick('${esc(x.id)}','${wid || ''}','${field || ''}')" title="${esc(x.n)}"><img src="${esc(x.src)}" alt="" loading="lazy">${x.mine ? `<i onclick="event.stopPropagation();gyMagDelMine('${x.id}','${wid || ''}','${field || ''}')">×</i>` : ''}</span>`).join('') || '<em class="pm-wg-tip">还没有。点上面「传一张图」试试。</em>'}</div>`).join('')}
            <button class="it muted" onclick="gyPmCloseSheet()">好了</button>`);
    };
    window.gyMagPick = function (sid, wid, field) {
        const W = window.__gyPmW; if (!W) return;
        const mine = D.mine.find(x => x.id === sid);
        if (wid) { const w = W.findW(wid); if (!w) return; w.d = Object.assign({}, w.d || {}, field === 'sid' && w.k === 'magCover' ? { sid, img: '' } : { sid, src: mine ? mine.src : '' }); W.save(); W.G().closeSheet(); W.render(); return; }
        const it = window.gyPmAddW('magStk', 's'), w = it && W.findW(it.id);
        if (w) { w.d = Object.assign({}, w.d || {}, { sid, src: mine ? mine.src : '', rot: Math.round(Math.random() * 12 - 6) }); W.save(); W.render(); }
    };
    window.gyMagDelMine = async function (id, wid, field) { D.mine = D.mine.filter(x => x.id !== id); await saveD(); window.gyMagStickers(wid || undefined, field || undefined); };

    /* ---------------- ✂️ 抠图 ---------------- */
    window.gyMagCutFile = function (inp) {
        const f = inp && inp.files && inp.files[0]; if (!f) return; inp.value = '';
        const r = new FileReader(); r.onload = () => window.gyMagCut(r.result); r.readAsDataURL(f);
    };
    // 编辑器：自动去背景（纯色背景不联网）/ 智能抠图（联网）/ 画笔留 / 橡皮擦 / 黑白 / 白边 → 存成「我的贴纸」
    window.gyMagCut = function (src, done) {
        const img = new Image();
        img.onerror = () => toast('这张图读不出来');
        img.onload = () => {
            try { if (window.gyPmCloseSheet) window.gyPmCloseSheet(); } catch (e) {}
            const sc = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight)), cw = Math.max(1, Math.round(img.naturalWidth * sc)), ch = Math.max(1, Math.round(img.naturalHeight * sc));
            const old = document.getElementById('gyMagCutOv'); if (old) old.remove();
            const ov = document.createElement('div'); ov.id = 'gyMagCutOv'; ov.setAttribute('data-gy-nopage', '1');
            ov.innerHTML = `<div class="mc-hd"><span class="x">取消</span><b>抠成贴纸</b><span class="ok">存起来</span></div>
                <div class="mc-st"><div class="mc-box"><canvas class="pv"></canvas></div></div>
                <div class="mc-tools"><span data-t="flood">去掉纯色背景</span><span data-t="auto">智能抠图（联网）</span><span data-t="keep" class="on">画笔：留</span><span data-t="erase">橡皮：擦</span><span data-t="reset">重来</span></div>
                <div class="mc-row"><span>容差</span><input type="range" class="tol" min="4" max="90" value="28"><span>笔刷</span><input type="range" class="bs" min="6" max="90" value="28"></div>
                <div class="mc-row"><label><input type="checkbox" class="bw" checked> 转黑白</label><label><input type="checkbox" class="bd" checked> 白边</label><input class="nm" placeholder="给它起个名字" maxlength="10"></div>`;
            document.body.appendChild(ov);
            const pv = ov.querySelector('.pv'), st = ov.querySelector('.mc-st'), box = ov.querySelector('.mc-box');
            pv.width = cw; pv.height = ch;
            const base = document.createElement('canvas'); base.width = cw; base.height = ch; const bg = base.getContext('2d'); bg.drawImage(img, 0, 0, cw, ch);
            const px = bg.getImageData(0, 0, cw, ch);
            const mask = new Uint8ClampedArray(cw * ch).fill(255);
            const fit = () => { const r = st.getBoundingClientRect(), k = Math.min((r.width - 20) / cw, (r.height - 16) / ch, 2); box.style.width = cw * k + 'px'; box.style.height = ch * k + 'px'; };
            fit();
            const g = pv.getContext('2d');
            const paint = () => { const o = g.createImageData(cw, ch); for (let i = 0; i < cw * ch; i++) { o.data[i * 4] = px.data[i * 4]; o.data[i * 4 + 1] = px.data[i * 4 + 1]; o.data[i * 4 + 2] = px.data[i * 4 + 2]; o.data[i * 4 + 3] = mask[i]; } g.clearRect(0, 0, cw, ch); g.putImageData(o, 0, 0); };
            paint();
            // 从四条边往里「漫水」：跟边上颜色差不多、连在一起的都当背景
            const flood = tol => {
                const P = px.data, seen = new Uint8Array(cw * ch), q = [];
                const near = (i, r, gg, b) => Math.abs(P[i * 4] - r) + Math.abs(P[i * 4 + 1] - gg) + Math.abs(P[i * 4 + 2] - b) <= tol * 3;
                const seeds = []; for (let x = 0; x < cw; x += 3) { seeds.push(x, (ch - 1) * cw + x); } for (let y = 0; y < ch; y += 3) { seeds.push(y * cw, y * cw + cw - 1); }
                seeds.forEach(i => { if (!seen[i]) { seen[i] = 1; q.push(i, i); } });
                while (q.length) { const ref = q.pop(), i = q.pop(); mask[i] = 0; const x = i % cw, y = (i / cw) | 0, r = P[ref * 4], gg = P[ref * 4 + 1], b = P[ref * 4 + 2];
                    [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(([a, c]) => { if (a < 0 || c < 0 || a >= cw || c >= ch) return; const j = c * cw + a; if (seen[j]) return; if (near(j, r, gg, b)) { seen[j] = 1; q.push(j, i); } }); }
                paint();
            };
            let tool = 'keep', last = null;
            const at = e => { const r = pv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cw / r.width, y: (e.clientY - r.top) * ch / r.height, k: cw / r.width }; };
            const stroke = (a, b) => { const rad = +ov.querySelector('.bs').value * b.k / 2, v = tool === 'erase' ? 0 : 255, n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, rad / 2)));
                for (let s = 0; s <= n; s++) { const cx = a.x + (b.x - a.x) * s / n, cy = a.y + (b.y - a.y) * s / n; for (let y = Math.max(0, Math.floor(cy - rad)); y < Math.min(ch, Math.ceil(cy + rad)); y++) for (let x = Math.max(0, Math.floor(cx - rad)); x < Math.min(cw, Math.ceil(cx + rad)); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) mask[y * cw + x] = v; }
                paint(); };
            pv.addEventListener('pointerdown', e => { if (tool !== 'keep' && tool !== 'erase') return; last = at(e); stroke(last, last); try { pv.setPointerCapture(e.pointerId); } catch (er) {} });
            pv.addEventListener('pointermove', e => { if (!last) return; const p = at(e); stroke(last, p); last = p; });
            ['pointerup', 'pointercancel'].forEach(t => pv.addEventListener(t, () => { last = null; }));
            ov.querySelector('.mc-tools').onclick = async e => {
                const t = e.target.closest('[data-t]'); if (!t) return; const k = t.dataset.t;
                if (k === 'reset') { mask.fill(255); paint(); return; }
                if (k === 'flood') { flood(+ov.querySelector('.tol').value); return; }
                if (k === 'auto') {
                    t.textContent = '抠图中…';
                    try {
                        toast('✂️ 智能抠图', '第一次要下载模型（几十 MB），要联网，稍等一下');
                        const lib = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1/+esm');
                        const blob = await (lib.removeBackground || lib.default)(src);
                        const u = URL.createObjectURL(blob), f = new Image();
                        await new Promise((ok, no) => { f.onload = ok; f.onerror = no; f.src = u; });
                        const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch; const g2 = c2.getContext('2d'); g2.drawImage(f, 0, 0, cw, ch);
                        const a2 = g2.getImageData(0, 0, cw, ch).data; for (let i = 0; i < cw * ch; i++) mask[i] = a2[i * 4 + 3]; paint(); URL.revokeObjectURL(u);
                        toast('抠好了', '哪里不对用画笔 / 橡皮修一下');
                    } catch (er) { toast('智能抠图没成功', '可能没联网；纯色背景点「去掉纯色背景」，或者用橡皮擦'); }
                    t.textContent = '智能抠图（联网）'; return;
                }
                tool = k; ov.querySelectorAll('[data-t="keep"],[data-t="erase"]').forEach(x => x.classList.toggle('on', x === t));
            };
            const close = () => ov.remove();
            ov.querySelector('.x').onclick = close;
            ov.querySelector('.ok').onclick = async () => {
                // 裁到有东西的范围，转黑白，加白边
                let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
                for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (mask[y * cw + x] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
                if (x1 < 0) { toast('全擦掉了', '留一点再存'); return; }
                const bw = ov.querySelector('.bw').checked, bd = ov.querySelector('.bd').checked, B = bd ? 8 : 2;
                const w = x1 - x0 + 1 + B * 2, h = y1 - y0 + 1 + B * 2, o = document.createElement('canvas'); o.width = w; o.height = h; const og = o.getContext('2d');
                const cut = document.createElement('canvas'); cut.width = cw; cut.height = ch; const cg = cut.getContext('2d'); const d2 = cg.createImageData(cw, ch);
                for (let i = 0; i < cw * ch; i++) { let r = px.data[i * 4], gg = px.data[i * 4 + 1], b = px.data[i * 4 + 2]; if (bw) { const l = Math.min(255, Math.max(0, (0.3 * r + 0.59 * gg + 0.11 * b - 128) * 1.25 + 128)); r = gg = b = l; } d2.data[i * 4] = r; d2.data[i * 4 + 1] = gg; d2.data[i * 4 + 2] = b; d2.data[i * 4 + 3] = mask[i]; }
                cg.putImageData(d2, 0, 0);
                if (bd) { const sil = document.createElement('canvas'); sil.width = cw; sil.height = ch; const sg = sil.getContext('2d'); sg.drawImage(cut, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#fff'; sg.fillRect(0, 0, cw, ch);
                    for (let a = 0; a < 16; a++) og.drawImage(sil, -x0 + B + Math.cos(a / 16 * Math.PI * 2) * 6, -y0 + B + Math.sin(a / 16 * Math.PI * 2) * 6); }
                og.drawImage(cut, -x0 + B, -y0 + B);
                const url = o.toDataURL('image/png');
                const it = { id: 'my' + Date.now().toString(36), src: url, at: Date.now(), n: (ov.querySelector('.nm').value || '').trim() || '我的贴纸', by: 'me' };
                D.mine.unshift(it); D.mine = D.mine.slice(0, 80); await saveD(); close();
                toast(pick(['贴纸做好了', '✂️ 抠好了', '收进贴纸库了']), it.n);
                if (typeof done === 'function') done(it); else window.gyMagStickers();
            };
        };
        img.src = src;
    };

    /* ---------------- 自主行动 / 今天 / 记忆总览 ---------------- */
    const NUDGE = {};
    window.__gyMagCtxFor = id => { const n = NUDGE[String(id)]; const cv = D.covers.find(x => x.cid === String(id) && Date.now() - x.at < 2 * 864e5); return (n ? `【这次主动找她的由头】${n}` : '') + (cv && M.on ? `${n ? '\n' : ''}【你刚给她手机桌面的杂志封面写了封面语】「${cv.head}」` : ''); };
    async function reach(c, why) { if (typeof sendProactiveChatMessage !== 'function') return false; NUDGE[String(c.id)] = why; try { await sendProactiveChatMessage(c); return true; } catch (e) { return false; } finally { delete NUDGE[String(c.id)]; } }
    function regMore() {
        try { if (typeof GY_BOX_CTX !== 'undefined' && !GY_BOX_CTX.some(x => x[0] === '__gyMagCtxFor')) GY_BOX_CTX.push(['__gyMagCtxFor', '小手机杂志风']); } catch (e) {}
        try {
            if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || GY_AUTONOMY_ACTIONS.some(a => a.key === 'pm_mag_cover')) return;
            GY_AUTONOMY_ACTIONS.push({ key: 'pm_mag_cover', label: '给她手机桌面的杂志封面写这一期的封面语', hint: '她的小手机是杂志风，封面大字由你来写',
                need: c => M.on && taOn() && !D.covers.some(x => x.cid === String(c.id) && dayKey(new Date(x.at)) === dayKey()),
                run: async c => { const r = await writeCover(c); if (!r) return null; try { window.__gyPmW && window.__gyPmW.render(); } catch (e) {} await reach(c, `你刚给她手机桌面的杂志封面写了这一期的封面语「${r.head}」。可以跟她说一声，也可以只说一句「去看看你的小手机」卖个关子`); return '写了这一期的封面：' + r.head; } });
            GY_AUTONOMY_ACTIONS.push({ key: 'pm_mag_sticker', label: '在她小手机的桌面上偷偷贴一张贴纸', hint: '挑一张像你们的',
                need: c => M.on && taOn() && !!(window.__gyPmW && window.__gyPmW.WD && window.__gyPmW.WD.magStk) && typeof window.gyPmAddW === 'function' && !D.taStk.some(x => Date.now() - x.at < 3 * 864e5),
                run: async c => {
                    const all = library().filter(g => g.k !== 'mine').reduce((a, g) => a.concat(g.L), []), s = pick(all), W = window.__gyPmW;
                    const it = window.gyPmAddW('magStk', 's'), w = it && W.findW(it.id);
                    if (w && w.k === 'magStk') { w.d = Object.assign({}, w.d || {}, { sid: s.id, rot: Math.round(Math.random() * 16 - 8), by: c.remark || c.name }); W.save(); W.render(); }
                    D.taStk.unshift({ id: 'ts' + Date.now().toString(36), cid: String(c.id), at: Date.now(), sid: s.id, n: s.n }); D.taStk = D.taStk.slice(0, 40); await saveD();
                    await reach(c, `你在她手机桌面上偷偷贴了一张贴纸（${s.n}）。可以跟她说一声，或者等她自己发现`);
                    return '在你桌面上贴了一张贴纸：' + s.n;
                } });
        } catch (e) {}
        try {
            if (typeof window.gyMemExAdd === 'function' && !window.__gyMagMem) { window.__gyMagMem = 1;
                window.gyMemExAdd({ k: 'gyMagCover', ico: '📰', n: '小手机杂志封面', d: 'TA 写的封面语（改了封面上就显示改过的）', on: () => true, items: c => D.covers.filter(x => x.cid === String(c.id)), text: x => x.head + (x.lines && x.lines.length ? '｜' + x.lines.join('｜') : ''), edit: (x, v) => { const p = String(v).split('｜'); x.head = p[0].slice(0, 20); x.lines = p.slice(1).map(s => s.slice(0, 14)).filter(Boolean).slice(0, 3); }, del: (c, i) => { const it = D.covers.filter(x => x.cid === String(c.id))[i]; D.covers = D.covers.filter(x => x !== it); }, meta: x => new Date(x.at).toLocaleString(), save: saveD }); }
        } catch (e) {}
    }
    function todayHtml() {
        if (!M.on) return '';
        const L = D.covers.filter(x => dayKey(new Date(x.at)) === dayKey()), S = D.taStk.filter(x => dayKey(new Date(x.at)) === dayKey());
        if (!L.length && !S.length) return '';
        return `<div class="gyt-sec gymag-tsec"><h4>📰 小手机</h4>${L.map(x => `<div class="gyt-row click" onclick="window.gyPmSet&&gyPmSet(true)"><span class="gyt-t">${esc((charOf(x.cid) || {}).name || 'TA')}</span><span class="gyt-x">新封面「${esc(x.head)}」</span></div>`).join('')}${S.map(x => `<div class="gyt-row"><span class="gyt-t">${esc((charOf(x.cid) || {}).name || 'TA')}</span><span class="gyt-x">在你桌面贴了「${esc(x.n)}」</span></div>`).join('')}</div>`;
    }
    function hookToday() {
        const f = window.gyTodayRender; if (typeof f !== 'function' || f.__gyMag) return;
        const w = function () { const r = f.apply(this, arguments); try { ['gyToday', 'gyTodayM'].forEach(id => { const b = document.getElementById(id); if (!b) return; b.querySelectorAll('.gymag-tsec').forEach(n => n.remove()); const h = todayHtml(); if (h) b.insertAdjacentHTML('beforeend', h); }); } catch (e) {} return r; };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyMag = true; window.gyTodayRender = w;
    }
    // 「全部开关」里也有一行
    function hookSwitch() {
        try {
            if (typeof AUTO_FEATURE_DEFS === 'undefined' || AUTO_FEATURE_DEFS.some(f => f.key === 'pmMagTa')) return;
            AUTO_FEATURE_DEFS.push({ key: 'pmMagTa', label: '小手机杂志风：TA 会出封面、贴贴纸', desc: '小手机换成黑白杂志风以后，TA 偶尔给封面写这一期的封面语、在你桌面上偷偷贴一张贴纸。关掉就只是好看，TA 不动。', cost: '写封面一次调用', group: '主动', where: '小手机 → 美化 → 📰 黑白杂志风' });
        } catch (e) {}
    }
    window.gyMagInfo = () => ({ M: Object.assign({}, M), mine: D.mine.length, covers: D.covers.length, lib: library().map(g => [g.k, g.L.length]) });
    window.gyMagData = () => D;

    /* ---------------- 样式 ---------------- */
    const css = document.createElement('style'); css.id = 'gyPmMagCss';
    css.textContent = `
body.gyphm.pm-th-mag{--pm-bg:#f4f3ef;--pm-card:#ffffff;--pm-text:#111111;--pm-sub:#6f6f6b;--pm-hair:#111111;--pm-fill:#ecebe6;--pm-glass:rgba(244,243,239,.88);--pm-shadow:none;--pm-ic-bg:#ffffff;--pm-ic-fg:#111111;--pm-accent:#111111;--pm-accent-fg:#f4f3ef;--pm-red:#111111;
  --pm-num:"Didot","Bodoni 72","Bodoni MT","Playfair Display","Noto Serif SC","Songti SC","STSong",Georgia,serif;--pm-font:"Noto Serif SC","Songti SC","STSong","Source Han Serif SC",Georgia,serif;--mg-serif:"Didot","Bodoni 72","Bodoni MT","Playfair Display",Georgia,"Times New Roman",serif}
body.gyphm.pm-th-mag.pm-dark{--pm-bg:#0e0e0d;--pm-card:#161615;--pm-text:#f2f1ec;--pm-sub:#9a9993;--pm-hair:#f2f1ec;--pm-fill:#20201e;--pm-glass:rgba(14,14,13,.88);--pm-ic-bg:#161615;--pm-ic-fg:#f2f1ec;--pm-accent:#f2f1ec;--pm-accent-fg:#111;--pm-red:#f2f1ec}
body.pm-th-mag #gyPmHome .pm-w,body.pm-th-mag .pm-w{border-radius:3px!important;box-shadow:none!important;border:1px solid var(--pm-hair)}
body.pm-th-mag .pm-ic{border-radius:6px!important;box-shadow:none!important;border:1px solid var(--pm-hair)!important;background:var(--pm-ic-bg)!important;color:var(--pm-ic-fg)!important}
body.pm-th-mag .pm-ic.img{filter:grayscale(1) contrast(1.05)}
body.pm-th-mag .pm-lb{font-family:var(--pm-font);font-weight:500;letter-spacing:1px;font-size:11px}
body.pm-th-mag .pm-dock,body.pm-th-mag #gyPmHome .pm-dock{border-radius:0!important;margin:0 14px 12px!important;background:var(--pm-glass)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important;border-top:1px solid var(--pm-hair);border-bottom:1px solid var(--pm-hair)}
body.pm-th-mag .pm-sb{font-family:var(--mg-serif);letter-spacing:1px}
body.pm-th-mag .pm-lock .lk-t{font-family:var(--mg-serif);font-weight:400;letter-spacing:0;font-size:104px}
body.pm-th-mag .pm-lock .lk-d{font-family:var(--mg-serif);text-transform:uppercase;letter-spacing:4px;font-size:14px;font-weight:400}
body.pm-th-mag .pm-lock .lk-n{border-radius:0!important;background:var(--pm-card)!important;backdrop-filter:none!important;border:1px solid var(--pm-hair);box-shadow:none!important}
body.pm-th-mag .pm-lock .mg-lkmast{position:absolute;bottom:calc(96px + env(safe-area-inset-bottom));left:0;right:0;text-align:center;font-family:var(--mg-serif);font-size:44px;letter-spacing:10px;line-height:1;pointer-events:none;color:inherit}
body:not(.pm-th-mag) .mg-lkmast{display:none}
body.pm-th-mag .pm-lock::after{content:"VOL." attr(data-vol) " — THE ISSUE OF TODAY";position:absolute;bottom:calc(80px + env(safe-area-inset-bottom));left:0;right:0;text-align:center;font-family:var(--mg-serif);font-size:9.5px;letter-spacing:4px;opacity:.65;pointer-events:none}
body.pm-th-mag #gyPmSheet .in,body.pm-th-mag #gyPmSheet .ta{border-radius:0!important;border:1px solid var(--pm-hair)!important;box-shadow:none!important}
body.pm-th-mag #gyPmHome .pm-pg i{border-radius:0;width:14px;height:2px}
body.pm-th-mag .pm-badge{border-radius:0!important;background:#111!important;color:#f4f3ef!important;font-family:var(--mg-serif)}
body.pm-th-mag #gyPmSheet>div,body.pm-th-mag #gyPmSheet .sh{border-radius:0!important}
body.pm-th-mag #gyPmSheet .it,body.pm-th-mag #gyPmSheet .chip,body.pm-th-mag #gyPmSheet .seg{border-radius:0!important;box-shadow:none!important}
body.pm-th-mag #gyPmSheet .it{border:1px solid var(--pm-hair)}
body.pm-th-mag #gyPmSheet .seg{background:transparent;border:1px solid var(--pm-hair);padding:0}
body.pm-th-mag #gyPmSheet .seg .chip.on{background:var(--pm-accent);color:var(--pm-accent-fg)}
body.pm-th-mag #gyPmSheet h4{font-family:var(--mg-serif);font-weight:400;font-size:22px;letter-spacing:1px}
body.pm-th-mag .wg-photo{filter:grayscale(1) contrast(1.08)}
body.pm-mag-grain.gyphm #gyPmHome::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:40;background-image:url("${NOISE}");opacity:.16;mix-blend-mode:multiply}
body.pm-mag-grain.gyphm.pm-dark #gyPmHome::after{mix-blend-mode:screen;opacity:.1}
/* 杂志小组件（主题关着也能用，只是没那么搭） */
.mg-mast{font-family:var(--mg-serif,Georgia,serif);font-weight:400;letter-spacing:.06em;line-height:.9;color:var(--pm-text)}
.mg-cov{position:relative;height:100%;overflow:hidden;color:var(--pm-text)}
.mg-cov .mg-pic{position:absolute;inset:0;background-size:cover;background-position:center;filter:grayscale(1) contrast(1.1)}
.mg-cov .mg-pic.st{display:flex;align-items:flex-end;justify-content:center;background:var(--pm-card)}.mg-cov .mg-pic.st img{max-width:88%;max-height:74%;object-fit:contain;filter:grayscale(1)}
.mg-cov.l .mg-mast{position:absolute;top:8px;left:10px;right:10px;font-size:52px;text-align:center;mix-blend-mode:difference;color:#fff}
.mg-cov.l .mg-iss{position:absolute;top:64px;left:0;right:0;text-align:center;font-style:normal;font-size:9.5px;letter-spacing:3px;color:#fff;mix-blend-mode:difference}
.mg-cov .mg-cl{position:absolute;left:10px;top:92px;display:flex;flex-direction:column;gap:4px;max-width:46%}.mg-cov .mg-cl span{font-size:10.5px;line-height:1.3;background:var(--pm-card);color:var(--pm-text);padding:2px 5px;align-self:flex-start;border:1px solid var(--pm-hair)}
.mg-cov.l.stc .mg-pic.st{inset:auto 0 58px 0;top:84px;background:transparent}.mg-cov.l.stc .mg-pic.st img{max-height:100%}.mg-cov.l.stc .mg-mast,.mg-cov.l.stc .mg-iss{mix-blend-mode:normal;color:var(--pm-text)}.mg-cov.l.stc .mg-foot{background:var(--pm-card);color:var(--pm-text);border-top:1px solid var(--pm-hair);padding:8px 12px}
.mg-cov .mg-foot{position:absolute;left:0;right:0;bottom:0;padding:22px 12px 10px;background:linear-gradient(transparent,rgba(0,0,0,.62));color:#fff}
.mg-cov .mg-foot .mg-head{display:block;font-family:var(--pm-font,serif);font-size:18px;line-height:1.25;font-weight:700}.mg-cov .mg-foot i{font-style:normal;font-size:10px;letter-spacing:2px;opacity:.85}
.mg-cov.m{display:flex}.mg-cov.m .mg-pic{position:relative;inset:auto;width:42%;flex:none}.mg-cov.m .tx{flex:1;padding:8px 10px;display:flex;flex-direction:column;gap:3px;min-width:0}
.mg-cov.m .mg-mast{font-size:30px}.mg-cov.m em{font-style:normal;font-size:9px;letter-spacing:2.5px;color:var(--pm-sub)}.mg-cov.m .mg-head{font-family:var(--pm-font,serif);font-weight:700;font-size:14px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.mg-cov.m i{font-style:normal;font-size:10px;color:var(--pm-sub);margin-top:auto}
.mg-date{height:100%;display:flex;color:var(--pm-text)}.mg-date.s{flex-direction:column;align-items:center;justify-content:center}.mg-date b{font-family:var(--mg-serif,Georgia,serif);font-weight:400;line-height:.9}
.mg-date.s b{font-size:62px}.mg-date.s em{font-style:normal;font-size:11px;letter-spacing:4px}.mg-date.s span{font-size:10px;letter-spacing:3px;color:var(--pm-sub);margin-top:2px}
.mg-date.m{align-items:center;gap:14px;padding:0 6px}.mg-date.m b{font-size:84px}.mg-date.m div{display:flex;flex-direction:column;gap:3px;border-left:1px solid var(--pm-hair);padding-left:12px}.mg-date.m em{font-style:normal;font-family:var(--mg-serif,serif);font-size:17px;letter-spacing:2px}.mg-date.m span{font-size:11px;letter-spacing:4px}.mg-date.m i{font-style:normal;font-size:11px;color:var(--pm-sub)}
.mg-q{height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 6px;color:var(--pm-text);position:relative}.mg-q b{font-family:var(--mg-serif,Georgia,serif);font-size:70px;line-height:.6;height:30px;font-weight:400}
.mg-q span{font-family:var(--pm-font,serif);font-size:15px;line-height:1.5;font-weight:600}.mg-q.l span{font-size:18px}.mg-q i{font-style:italic;font-family:var(--mg-serif,serif);font-size:11px;color:var(--pm-sub);margin-top:6px;align-self:flex-end}.mg-q.empty span{font-size:12px;color:var(--pm-sub);font-weight:400}
.mg-idx{height:100%;display:flex;flex-direction:column;gap:3px;color:var(--pm-text);overflow:hidden}.mg-idx>b{font-family:var(--mg-serif,serif);font-weight:400;font-size:17px;letter-spacing:5px;border-bottom:1px solid var(--pm-hair);padding-bottom:3px;margin-bottom:2px}
.mg-idx div{display:flex;gap:8px;align-items:baseline;font-size:12px;min-width:0}.mg-idx em{font-style:normal;font-family:var(--mg-serif,serif);font-size:13px;width:20px}.mg-idx span{flex:none;font-weight:600}.mg-idx i{font-style:normal;color:var(--pm-sub);margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
#gyPmHome .pm-w.wk-magStk,.pm-w.wk-magStk{background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important}
.mg-stk{height:100%;display:flex;align-items:center;justify-content:center;position:relative}.mg-stk img{max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 3px 5px rgba(0,0,0,.18));pointer-events:none;user-select:none}
.mg-stk i{position:absolute;bottom:-2px;right:2px;font-style:normal;font-size:9.5px;letter-spacing:1px;color:var(--pm-sub);font-family:var(--mg-serif,serif)}
/* 抽屉里 */
.pm-magwl{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.pm-magwl span{position:relative;aspect-ratio:9/16;border:1px solid var(--pm-hair);background-size:cover;background-position:center;cursor:pointer}.pm-magwl i{position:absolute;left:0;right:0;bottom:0;font-style:normal;font-size:10px;text-align:center;background:var(--pm-card);color:var(--pm-text);border-top:1px solid var(--pm-hair)}
.pm-magst{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.pm-magst span{position:relative;aspect-ratio:1;border:1px solid var(--pm-hair);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:4px;box-sizing:border-box}
.pm-magst img{max-width:100%;max-height:100%;object-fit:contain}.pm-magst i{position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#111;color:#fff;font-style:normal;font-size:12px;display:flex;align-items:center;justify-content:center}
/* 抠图 */
#gyMagCutOv{position:fixed;inset:0;z-index:2147483000;background:#111;color:#f4f3ef;display:flex;flex-direction:column;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
#gyMagCutOv .mc-hd{display:flex;justify-content:space-between;align-items:center;padding:calc(12px + env(safe-area-inset-top)) 16px 10px;font-size:15px}#gyMagCutOv .mc-hd span{cursor:pointer;padding:4px 8px}#gyMagCutOv .ok{background:#f4f3ef;color:#111}
#gyMagCutOv .mc-st{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}
#gyMagCutOv .mc-box{background:repeating-conic-gradient(#3a3a3a 0 25%,#2a2a2a 0 50%) 0 0/16px 16px}#gyMagCutOv canvas{width:100%;height:100%;display:block;touch-action:none;cursor:crosshair}
#gyMagCutOv .mc-tools{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:10px 12px}#gyMagCutOv .mc-tools span{padding:7px 12px;border:1px solid #f4f3ef;font-size:13px;cursor:pointer}#gyMagCutOv .mc-tools span.on{background:#f4f3ef;color:#111}
#gyMagCutOv .mc-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;padding:0 12px 10px;font-size:12.5px}#gyMagCutOv .mc-row input[type=range]{width:110px}#gyMagCutOv .nm{background:transparent;border:1px solid #f4f3ef;color:#f4f3ef;padding:6px 8px;width:130px}
#gyMagCutOv .mc-row:last-child{padding-bottom:calc(14px + env(safe-area-inset-bottom))}
`;
    (document.head || document.documentElement).appendChild(css);

    // 锁屏上的刊名
    function mastTag() { const v = pad(new Date().getMonth() + 1) + '.' + pad(new Date().getDate()); document.querySelectorAll('.pm-lock').forEach(el => { if (el.getAttribute('data-mast') !== mast()) el.setAttribute('data-mast', mast()); if (el.getAttribute('data-vol') !== v) el.setAttribute('data-vol', v); let m = el.querySelector(':scope > .mg-lkmast'); if (!m) { m = document.createElement('div'); m.className = 'mg-lkmast'; el.appendChild(m); } if (m.textContent !== mast()) m.textContent = mast(); }); }
    let wOk = false;
    let mq = false; try { new MutationObserver(() => { if (!M.on || mq) return; mq = true; requestAnimationFrame(() => { mq = false; if (document.querySelector('.pm-lock:not([data-mast]),.pm-lock[data-mast]:not(:has(> .mg-lkmast))')) mastTag(); }); }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    function tick() { apply(); hookBeauty(); hookToday(); hookSwitch(); regMore(); if (!wOk) wOk = regWidgets(); if (M.on) mastTag(); }
    tick(); setInterval(tick, 2500);
})();
