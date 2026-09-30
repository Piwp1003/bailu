/* ===========================================================================
   js/34 —— 🖼️ 图库：公共的 + 每个角色自己的
   ---------------------------------------------------------------------------
   白露里的图片一直是散的：头像在角色卡里、背景图在资料里、表情包在另一个抽屉、
   手机壁纸是写死的色块。想换一张就得各处翻各处传，而且**角色自己没有图**——
   TA 上网看了半天，一张图都带不回来。

   这一页把图片收成一处，并且分两层：

     🌐 **公共图库**：所有人都看得到。你传的、角色分享出来的都在这儿。
     🔒 **角色个人图库**：只有那个角色自己看得到（TA 手机里的相册就是它）。
        角色联网探索的时候，遇到感兴趣的会往自己这一格里存一张。
        你也可以直接往某个角色的私库里传——那是"你给 TA 的"。

   图库是**换装的图片来源**：换头像、换资料背景、换角色手机壁纸、换你自己的
   app 壁纸，都从这儿挑（见 js/35）。

   ⚠️ 图片存在 localforage 里（base64），不进主存档——主存档本来就大，
      再塞几十张图会直接把它撑爆、导出也导不动。

   💰 不调 API。角色"存一张图"是本地记一条（联网探索那边把图片地址带过来），
      不额外生成、不额外请求。
   =========================================================================== */
(function () {
    if (window.__gyGalleryLoaded) return;
    window.__gyGalleryLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyGalleryBox', 'gallery')          // 带兜底的存档口
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyGalleryBox', storeName: 'gallery' })
            : null);
    const KEY = 'gyGallery_state';

    const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(s == null ? '' : s)
        : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const nameOf = id => String(id) === 'me' ? ((typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '我')
        : ((charOf(id) || {}).name || '某人');
    const on = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : true;
    const uid = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const ago = t => { const d = Math.floor((Date.now() - t) / 86400000);
        return d <= 0 ? '今天' : d === 1 ? '昨天' : d < 30 ? d + ' 天前' : Math.round(d / 30) + ' 个月前'; };

    // 一张图：{id, src, tag, by, note, at, owner}
    //   owner ''      = 公共图库
    //   owner 角色id  = 那个角色的私库
    //   by            = 谁放进来的（'me' / 角色id）
    let S = { imgs: [], max: 200 };

    async function save() {
        try {
            if (S.imgs.length > (S.max || 200)) S.imgs = S.imgs.slice(0, S.max || 200);
            if (LF) await LF.setItem(KEY, JSON.parse(JSON.stringify(S)));
        } catch (e) { console.warn('[图库] 存档失败（多半是图太多/太大）', e); }
    }
    async function load() {
        try { if (LF) { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } } catch (e) {}
        if (!Array.isArray(S.imgs)) S.imgs = [];
    }

    /* ---------- 对外 ---------- */
    window.gyGallery = {
        // 公共图库（owner 留空）或某个角色的私库
        list: (owner) => S.imgs.filter(x => String(x.owner || '') === String(owner || '')),
        // 一个角色能看到的全部 = 公共 + 自己的
        seenBy: charId => S.imgs.filter(x => !x.owner || String(x.owner) === String(charId)),
        all: () => S.imgs.slice(),
        get: id => S.imgs.find(x => x.id === id) || null,
        async add({ src, tag = '', by = 'me', owner = '', note = '' } = {}) {
            if (!src) return null;
            const img = { id: uid(), src, tag: String(tag), by: String(by),
                          owner: String(owner || ''), note: String(note), at: Date.now() };
            S.imgs.unshift(img);
            await save(); render();
            return img;
        },
        async remove(id) { S.imgs = S.imgs.filter(x => x.id !== id); await save(); render(); },
        // 角色联网探索时捡到一张图，存进自己的私库（开关 galleryCharSave）
        async charSave(charId, src, tag, note) {
            if (!on('galleryCharSave')) return null;
            if (!src) return null;
            const img = await window.gyGallery.add({ src, tag, by: charId, owner: charId, note });
            try {
                if (img && typeof addNotification === 'function') {
                    const c = charOf(charId);
                    addNotification(`<b>${(c || {}).name || ''}</b> 存了一张图 🖼️`, null, charId, c, tag || note || '在自己的图库里');
                }
            } catch (e) {}
            return img;
        }
    };

    /* ---------- 上传 ---------- */
    // 图片压到 900px 宽再存——原图动不动两三兆，几十张就把 localforage 撑爆了
    function shrink(file, cb) {
        // 动图 / 视频 / 实况：交给「动图和视频」（js/44），原样存，不压
        if (/^video\/|^image\/gif$/i.test(file.type || '') && typeof window.gyLiveTake === 'function') { window.gyLiveTake(file).then(tok => { if (tok) cb(tok); }); return; }
        const r = new FileReader();
        r.onload = () => {
            const im = new Image();
            im.onload = () => {
                const max = 900;
                let w = im.width, h = im.height;
                if (w > max) { h = Math.round(h * max / w); w = max; }
                const cv = document.createElement('canvas');
                cv.width = w; cv.height = h;
                cv.getContext('2d').drawImage(im, 0, 0, w, h);
                try { cb(cv.toDataURL('image/jpeg', 0.82)); } catch (e) { cb(r.result); }
            };
            im.onerror = () => cb(r.result);
            im.src = r.result;
        };
        r.readAsDataURL(file);
    }
    window.gyGalUpload = function (input) {
        const files = [...(input.files || [])];
        input.value = '';
        if (!files.length) return;
        const owner = (document.getElementById('gyGalOwner') || {}).value || '';
        const tag = ((document.getElementById('gyGalTag') || {}).value || '').trim();
        let done = 0;
        // 一次选多少张都收（以前一次只收前 12 张，多的悄悄丢掉）
        files.forEach(f => {
            shrink(f, async src => {
                await window.gyGallery.add({ src, tag, by: 'me', owner });
                if (++done === files.length) {
                    toast('存了 ' + done + ' 张' + (owner ? '到 ' + nameOf(owner) + ' 的私库' : '到公共图库'));
                }
            });
        });
    };
    window.gyGalAddUrl = async function () {
        const u = ((document.getElementById('gyGalUrl') || {}).value || '').trim();
        if (!u) return toast('先填个图片地址');
        const owner = (document.getElementById('gyGalOwner') || {}).value || '';
        const tag = ((document.getElementById('gyGalTag') || {}).value || '').trim();
        await window.gyGallery.add({ src: u, tag, by: 'me', owner });
        const el = document.getElementById('gyGalUrl'); if (el) el.value = '';
        toast('存好了');
    };
    const toast = m => { try { if (typeof showToast === 'function') showToast('', '🖼️ 图库', m, null, null, false); } catch (e) {} };

    /* ---------- 页面 ---------- */
    let tab = '';        // '' 公共；角色 id 就是那个人的私库
    window.gyGalTab = t => { tab = String(t || ''); render(); };
    // 换装设置里改了模式要重画一次（"我来定"那档才显示时长输入框）
    window.gyGalleryRepaint = () => { try { render(); } catch (e) {} };
    window.gyGalDel = async id => { await window.gyGallery.remove(id); };
    window.gyGalMove = async function (id, owner) {
        const im = window.gyGallery.get(id);
        if (!im) return;
        im.owner = String(owner || '');
        await save(); render();
        toast(owner ? '挪到 ' + nameOf(owner) + ' 的私库了' : '挪到公共图库了');
    };
    // 点一张图：给出"拿它去干什么"的几个去处（换装那边 js/35 接管）
    window.gyGalPick = function (id) {
        const im = window.gyGallery.get(id);
        if (!im) return;
        if (typeof window.gyDressPicker === 'function') return window.gyDressPicker(im);
        gyGalPreview(id);
    };
    window.gyGalPreview = function (id) {
        const im = window.gyGallery.get(id);
        if (!im) return;
        let ov = document.getElementById('gyGalView');
        if (!ov) { ov = document.createElement('div'); ov.id = 'gyGalView'; ov.className = 'modal-overlay';
                   ov.onclick = e => { if (e.target === ov) ov.style.display = 'none'; };
                   document.body.appendChild(ov); }
        ov.innerHTML = `<div class="modal-box" style="width:92%;max-width:460px;">
            <img src="${esc(im.src)}" style="width:100%;border-radius:12px;display:block;">
            <div style="font-size:12.5px;color:#8b98a5;margin-top:10px;line-height:1.8;">
                ${im.tag ? '<b>' + esc(im.tag) + '</b><br>' : ''}
                ${esc(im.owner ? nameOf(im.owner) + ' 的私库' : '公共图库')}　·　${esc(nameOf(im.by))}放进来的　·　${esc(ago(im.at))}
                ${im.note ? '<br>' + esc(im.note) : ''}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px;">
                <button type="button" class="btn-edit-small" onclick="document.getElementById('gyGalView').style.display='none'">关掉</button>
                ${typeof window.gyDressPicker === 'function'
                    ? `<button type="button" class="btn-edit-small" onclick="document.getElementById('gyGalView').style.display='none';gyDressPicker(gyGallery.get('${im.id}'))">拿它换点什么</button>` : ''}
                <button type="button" class="btn-edit-small" style="color:var(--gy-bad);" onclick="gyGalDel('${im.id}');document.getElementById('gyGalView').style.display='none'">删掉</button>
            </div></div>`;
        ov.style.display = 'flex';
    };

    window.gyGalleryHtml = function () {
        const cs = chars();
        const list = window.gyGallery.list(tab);
        return `
        <div class="gygal-tabs">
            <span class="gygal-t ${tab === '' ? 'on' : ''}" onclick="gyGalTab('')">🌐 公共图库</span>
            ${cs.map(c => `<span class="gygal-t ${String(tab) === String(c.id) ? 'on' : ''}" onclick="gyGalTab('${c.id}')">🔒 ${esc(c.name)}</span>`).join('')}
        </div>
        <div class="gygal-hint">
            ${tab === ''
                ? '公共图库里的图<b>所有人都看得到</b>——你传的、角色分享出来的都在这儿。'
                : `只有 <b>${esc(nameOf(tab))}</b> 自己看得到。TA 手机里的相册就是这一格；TA 上网遇到感兴趣的图会往这儿存。你也可以直接传给 TA。`}
        </div>
        ${typeof window.gyDressCfg === 'function' ? (() => { const d = window.gyDressCfg(); return `
        <details class="gygal-set">
            <summary>🎀 换装设置（角色多久想换一次 · 换完谁会注意到）</summary>
            <div class="gygal-set-b">
                <div class="gygal-row">
                    <span>角色多久可能想换一次</span>
                    <select onchange="gyDressSet('gapMode',this.value)">
                        <option value="fixed"${(d.gapMode || 'fixed') === 'fixed' ? ' selected' : ''}>我来定一个时长</option>
                        <option value="self"${d.gapMode === 'self' ? ' selected' : ''}>让 TA 按人设自己定</option>
                    </select>
                </div>
                ${(d.gapMode || 'fixed') === 'fixed' ? `<div class="gygal-row">
                    <span>多久一次</span>
                    <input type="number" min="0" value="${d.everyGapH}" onchange="gyDressSet('everyGapH',this.value)">
                    <em>小时（填 0 就关掉这个节拍，交给自主模式让 TA 自己感受）</em>
                </div>` : `<div class="gygal-row"><em style="flex:1;">爱打扮的人两三天就想换一张，冷淡的人半年不动一次——
                    照人设推，同一个人上下浮动一点，不会整齐得像定时器。本地算，不调 API。</em></div>`}
                <div class="gygal-row">
                    <span>换完之后谁会注意到</span>
                    <select onchange="gyDressSet('noticeMode',this.value)">
                        <option value="rel"${d.noticeMode === 'rel' ? ' selected' : ''}>按关系网 + 人设挑人（推荐）</option>
                        <option value="all"${d.noticeMode === 'all' ? ' selected' : ''}>所有人都注意到</option>
                        <option value="none"${d.noticeMode === 'none' ? ' selected' : ''}>谁都别提</option>
                    </select>
                </div>
                <div class="gygal-hint" style="margin:6px 0 0;">
                    「按关系网 + 人设」＝有关系线的、同势力的、跟你熟的更可能先看见，
                    然后各自按性格决定说不说、说什么。最多 3 个人开口。
                </div>
            </div>
        </details>`; })() : ''}
        <div class="gygal-up">
            <select id="gyGalOwner" class="gygal-in">
                <option value=""${tab === '' ? ' selected' : ''}>存进公共图库</option>
                ${cs.map(c => `<option value="${c.id}"${String(tab) === String(c.id) ? ' selected' : ''}>存进 ${esc(c.name)} 的私库</option>`).join('')}
            </select>
            <input type="text" id="gyGalTag" class="gygal-in" placeholder="给它一句说明（选填），例：秋天的巷子">
            <div class="gygal-uprow">
                <input type="file" id="gyGalFile" accept="image/*,video/*" multiple style="display:none;" onchange="gyGalUpload(this)">
                <button type="button" class="gymall-btn solid" onclick="document.getElementById('gyGalFile').click()">📁 从本地传</button>
                <input type="text" id="gyGalUrl" class="gygal-in" style="flex:1;min-width:140px;margin:0;" placeholder="或者贴一个图片地址">
                <button type="button" class="gymall-btn" onclick="gyGalAddUrl()">存</button>
            </div>
        </div>
        ${list.length ? `<div class="gygal-grid">${list.map(im => `
            <div class="gygal-cell" onclick="gyGalPick('${im.id}')" title="${esc(im.tag || '')}">
                <img src="${esc(im.src)}" loading="lazy">
                ${im.tag ? `<span>${esc(im.tag)}</span>` : ''}
                ${String(im.by) !== 'me' ? `<i class="gygal-by">${esc(nameOf(im.by))}存的</i>` : ''}
            </div>`).join('')}</div>`
        : `<div class="gymall-empty">这一格还是空的。<br>${tab ? '传一张给 ' + esc(nameOf(tab)) + '，或者等 TA 自己上网捡一张回来。' : '从上面传几张试试。'}</div>`}`;
    };
    function render() {
        const box = document.getElementById('gyGalleryBody');
        if (box) box.innerHTML = window.gyGalleryHtml();
    }
    window.gyGalleryRender = render;

    /* ---------- 小功能里的入口 ---------- */
    function mountView() {
        if (document.getElementById('gyGalModal')) return;
        const m = document.createElement('div');
        m.id = 'gyGalModal';
        m.innerHTML = `<div class="gygal-box">
            <div class="gygal-hd">🖼️ 图库
                <button type="button" class="gymall-btn ghost" style="margin-left:auto;" onclick="gyGalleryClose()">关闭</button></div>
            <div class="gygal-bd" id="gyGalleryBody"></div>
        </div>`;
        m.addEventListener('click', e => { if (e.target === m) gyGalleryClose(); });
        document.body.appendChild(m);
    }
    window.gyGalleryOpen = function () { mountView(); document.getElementById('gyGalModal').classList.add('on'); render(); };
    window.gyGalleryClose = function () { const m = document.getElementById('gyGalModal'); if (m) m.classList.remove('on'); };

    function addEntry() {
        try {
            if (typeof registerMiniFeature !== 'function') return;
            registerMiniFeature({
                id: 'gallery', icon: '🖼️', title: '图库',
                desc: '公共图库所有人都看得到；每个角色还有只有自己能看的私库。换头像、换背景、换手机壁纸都从这儿挑',
                onOpen: () => window.gyGalleryOpen()
            });
        } catch (e) { console.warn('[图库] 注册小功能入口失败', e); }
    }

    /* ---------- 开关 ---------- */
    function addSwitches() {
        try {
            if (typeof AUTO_FEATURE_DEFS === 'undefined' || !Array.isArray(AUTO_FEATURE_DEFS)) return;
            if (typeof AUTO_FEATURE_GROUPS !== 'undefined' && Array.isArray(AUTO_FEATURE_GROUPS)
                && !AUTO_FEATURE_GROUPS.some(g => g.key === '图片')) {
                AUTO_FEATURE_GROUPS.push({ key: '图片', icon: '🖼️', title: '图库与换装',
                    note: '图片收在一处：公共图库大家都看得到，角色私库只有 TA 自己能看。换头像、换背景、换壁纸都从图库挑。' });
            }
            const defs = [
                { key: 'galleryCharSave', label: '角色上网时会把感兴趣的图存进自己的图库',
                  desc: '联网探索读到带图的页面时，TA 会往**自己的私库**里存一张，带上一句为什么留着它。那一格只有 TA 自己看得到（也是 TA 手机相册里的内容）。',
                  cost: '不额外调 API（蹭联网探索那一次）', group: '图片', where: '小功能 → 🖼️ 图库 → 选那个角色' }
            ];
            defs.forEach(d => { if (!AUTO_FEATURE_DEFS.some(x => x.key === d.key)) AUTO_FEATURE_DEFS.push(d); });
        } catch (e) {}
    }

    const CSS = `
    #gyGalModal{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.45);display:none;
        align-items:center;justify-content:center;padding:16px;font-family:var(--gy-font);}
    #gyGalModal.on{display:flex;}
    .gygal-box{background:#fff;border-radius:16px;width:760px;max-width:100%;max-height:90vh;
        display:flex;flex-direction:column;overflow:hidden;}
    body.dark-theme .gygal-box{background:#16181c;color:#e7e9ea;}
    .gygal-hd{padding:15px 18px 10px;font-size:17px;font-weight:700;display:flex;align-items:center;gap:8px;}
    .gygal-bd{padding:4px 18px 18px;overflow-y:auto;flex:1 1 auto;}
    .gygal-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
    .gygal-t{font-size:12.5px;padding:6px 12px;border-radius:999px;cursor:pointer;
        border:1px solid rgba(128,128,128,.28);color:#8b98a5;transition:.15s;white-space:nowrap;}
    .gygal-t:hover{background:rgba(128,128,128,.08);}
    .gygal-t.on{background:var(--gy-accent);color:var(--gy-accent-fg);border-color:transparent;}
    .gygal-hint{font-size:12px;color:#8b98a5;line-height:1.8;margin-bottom:10px;}
    .gygal-set{border:1px solid rgba(128,128,128,.25);border-radius:12px;margin-bottom:10px;}
    .gygal-set>summary{cursor:pointer;padding:10px 12px;font-size:13px;font-weight:600;list-style:none;}
    .gygal-set>summary::-webkit-details-marker{display:none;}
    .gygal-set>summary::after{content:'▾';float:right;transition:transform .2s;}
    .gygal-set[open]>summary::after{transform:rotate(180deg);}
    .gygal-set-b{padding:0 12px 12px;}
    .gygal-row{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:6px 0;flex-wrap:wrap;}
    .gygal-row>span{min-width:130px;}
    .gygal-row input[type=number]{width:80px;padding:6px 8px;border-radius:7px;background:transparent;
        color:inherit;border:1px solid rgba(128,128,128,.3);}
    .gygal-row select{padding:6px 8px;border-radius:7px;background:transparent;color:inherit;
        border:1px solid rgba(128,128,128,.3);font-family:inherit;}
    .gygal-row em{font-style:normal;font-size:11.5px;color:#8b98a5;}
    .gygal-up{border:1px dashed rgba(128,128,128,.35);border-radius:12px;padding:11px;margin-bottom:12px;}
    .gygal-in{width:100%;padding:8px 10px;margin-bottom:7px;border-radius:9px;background:transparent;
        color:inherit;border:1px solid rgba(128,128,128,.3);box-sizing:border-box;font-family:inherit;}
    .gygal-uprow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
    .gygal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:9px;}
    .gygal-cell{position:relative;border-radius:11px;overflow:hidden;cursor:pointer;
        background:rgba(128,128,128,.1);aspect-ratio:1/1;transition:transform .15s;}
    .gygal-cell:hover{transform:translateY(-2px);}
    .gygal-cell img{width:100%;height:100%;object-fit:cover;display:block;}
    .gygal-cell span{position:absolute;left:0;right:0;bottom:0;padding:14px 7px 5px;font-size:10.5px;color:#fff;
        background:linear-gradient(transparent,rgba(0,0,0,.72));
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .gygal-by{position:absolute;left:5px;top:5px;font-style:normal;font-size:9.5px;color:#fff;
        background:rgba(0,0,0,.5);border-radius:4px;padding:1px 5px;}
    @media(max-width:600px){.gygal-grid{grid-template-columns:repeat(auto-fill,minmax(88px,1fr));}}
    `;
    function mount() {
        if (document.getElementById('gygalCss')) return;
        const st = document.createElement('style'); st.id = 'gygalCss'; st.textContent = CSS;
        document.head.appendChild(st);
    }

    (async function init() {
        mount();
        addSwitches();
        await load();
        setTimeout(addEntry, 800);
    })();
})();
