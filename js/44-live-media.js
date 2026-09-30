/* ============================================================
   js/44 —— 动图和视频（让头像/背景/表情包/配图动起来）
   ------------------------------------------------------------
   开关：设置 → 外观 →「🎞️ 动图和视频」，**默认开**。
   关掉之后立刻退回原样：GIF 还是被压成静止图，视频不让传。

   能动的地方：凡是走「上传图片」那条路的，全都能——
   角色头像、我的头像、群头像、资料页背景图、主页大图、全局背景图、
   表情包、聊天里发的图、帖子配图、故事工坊插图……
   因为这里没有一处一处去改，而是把**两个总入口**包了一层：
     · handleImageCrop()  —— 头像/背景那一路（原来会打开裁剪弹窗）
     · fileToBase64()     —— 表情包/配图那一路（原来会压成 jpeg）
   传的是 GIF 或视频就绕开裁剪/压缩，原样存下来；别的照旧。

   存法（你选的那种）：视频/动图**单独存一个库**（IndexedDB 里的 guyuLiveMedia），
   存档里只留一个 `gylive:<编号>` 的短字符串。所以：
     · 存档不会被撑大，每次保存也不会因为一个 20MB 的视频变慢
     · 导出存档时会自动把用到的媒体一起打包进 json，换设备/恢复不会丢
   视频一律**循环播放、静音、不显示控件**（浏览器只允许静音视频自动播放；
   想要声音可以在设置里打开，但多数浏览器会拒绝自动播，得点一下才响）。

   显示原理：页面里看到 `gylive:xxx` 就现场换掉——
     · GIF：直接换成本地地址，原生就会动
     · 视频：先垫上**第一帧**（上传时抓的封面），再在上面盖一个 <video> 铺满
   所以就算这个模块没跑起来，你看到的也是一张静止的封面图，不会变成裂图。
   ============================================================ */
(function () {
    'use strict';

    const LSK = 'gy_live_media_cfg';
    const S = { on: true, sound: false, maxMB: 30 };
    try { Object.assign(S, JSON.parse(localStorage.getItem(LSK) || '{}') || {}); } catch (e) {}
    const saveCfg = () => { try { localStorage.setItem(LSK, JSON.stringify(S)); } catch (e) {} };

    const store = (typeof localforage !== 'undefined' && localforage.createInstance)
        ? localforage.createInstance({ name: 'guyuLiveMedia', storeName: 'media' }) : null;

    // 编号 → { mime, url(本地地址), poster(第一帧), bytes }
    const MAP = Object.create(null);
    const TOKRE = /gylive:([A-Za-z0-9]+)/;
    const isVideo = mime => /^video\//.test(String(mime || ''));
    const isLiveFile = f => !!f && (/^video\//.test(f.type || '') || /^image\/gif$/i.test(f.type || ''));

    // ⚠️ showToast 的签名是 (头像, 标题, 正文, …)——只传一个参数弹出来会是"undefined"
    const toast = m => { try { if (typeof showToast === 'function') showToast('', '🎞️ 动图视频', m, null, null, false); else console.info(m); } catch (e) {} };
    const alertBox = m => { try { if (typeof appAlert === 'function') appAlert(m); else alert(m); } catch (e) {} };

    /* ---------- 抓视频第一帧当封面 ---------- */
    function firstFrame(file) {
        return new Promise(resolve => {
            let url = '';
            try { url = URL.createObjectURL(file); } catch (e) { resolve(''); return; }
            const v = document.createElement('video');
            v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = url;
            const done = (r) => { try { URL.revokeObjectURL(url); } catch (e) {} resolve(r); };
            const grab = () => {
                try {
                    const w = Math.min(480, v.videoWidth || 480);
                    const h = Math.round((v.videoHeight || 270) * (w / (v.videoWidth || 480)));
                    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
                    cv.getContext('2d').drawImage(v, 0, 0, w, h);
                    done(cv.toDataURL('image/jpeg', 0.7));
                } catch (e) { done(''); }
            };
            v.onloadeddata = () => { try { v.currentTime = Math.min(0.1, (v.duration || 1) / 10); } catch (e) { grab(); } };
            v.onseeked = grab;
            v.onerror = () => done('');
            setTimeout(() => done(''), 8000);       // 再慢也不能一直挂着
        });
    }

    /* ---------- 存一份，拿回一个短字符串 ---------- */
    async function put(file, opt) {
        opt = opt || {};
        if (!store) { alertBox('这个浏览器不支持本地媒体库，动图/视频存不下。'); return null; }
        // 文件大小不设上限（以前超过 maxMB 就报错不收；maxMB 这个设置项还留着，只是不再拦）
        const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const poster = isVideo(file.type) ? await firstFrame(file) : '';
        const live = !!opt.live && isVideo(file.type);
        await store.setItem(id, { mime: file.type, blob: file, poster, bytes: file.size, at: Date.now(), live });
        MAP[id] = { mime: file.type, url: URL.createObjectURL(file), poster, bytes: file.size, live };
        return 'gylive:' + id;
    }
    window.gyLivePut = put;

    /* ---------- 选了视频：问一下当「循环视频」还是「实况」 ----------
       实况 = 平时是一张照片，按住（电脑上鼠标移上去）才动一下，跟 iPhone 的实况照片一样 */
    function askMode(file) {
        return new Promise(resolve => {
            const old = document.getElementById('gyLiveAsk'); if (old) old.remove();
            const d = document.createElement('div'); d.id = 'gyLiveAsk';
            const url = URL.createObjectURL(file);
            d.innerHTML = '<div class="bx"><video src="' + url + '" muted autoplay loop playsinline></video>' +
                '<b>这段视频要怎么放？</b>' +
                '<button data-m="loop">🔁 循环视频<small>一直在动（静音）</small></button>' +
                '<button data-m="live">◎ 实况<small>平时是照片，按住 / 鼠标移上去才动一下</small></button>' +
                '<button data-m="" class="no">算了</button></div>';
            document.body.appendChild(d);
            d.addEventListener('click', e => {
                const b = e.target.closest('button'); if (!b && e.target !== d) return;
                const m = b ? b.dataset.m : '';
                try { URL.revokeObjectURL(url); } catch (er) {}
                d.remove(); resolve(m || null);
            });
        });
    }
    // 统一入口：照片以外的（动图 / 视频 / 实况）都走这里，返回 gylive:编号
    async function take(file) {
        if (!S.on) { toast('「动图和视频」关着：设置 → 外观 里打开'); return null; }
        try {
            if (isVideo(file.type)) { const m = await askMode(file); if (!m) return null; const tok = await put(file, { live: m === 'live' }); kick(); if (tok) toast(m === 'live' ? '实况设好了：按住或者鼠标移上去就会动' : '视频设好了，循环播放中'); return tok; }
            const tok = await put(file); kick(); return tok;
        } catch (err) { alertBox(String(err && err.message || err)); return null; }
    }
    window.gyLiveTake = take;

    /* ---------- 把 gylive: 换成真东西 ---------- */
    function mkVideo(rec) {
        const v = document.createElement('video');
        v.className = 'gylive-v' + (rec.live ? ' live' : '');
        if (rec.live) { v.src = rec.url; v.loop = false; v.autoplay = false; v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto'; if (rec.poster) v.poster = rec.poster; v.onended = () => liveStop(v); return v; }
        v.src = rec.url; v.loop = true; v.autoplay = true; v.controls = false;
        v.muted = !S.sound; v.playsInline = true;
        v.setAttribute('playsinline', ''); v.setAttribute('loop', '');
        if (!S.sound) v.setAttribute('muted', '');
        return v;
    }
    // ⚠️ play() 必须**挂进页面之后**再叫，脱离文档的 <video> 调 play 会被直接拒掉——
    //    这就是之前"视频盖上了但一直不动"的原因。
    const kickPlay = v => { try { const r = v.play(); if (r && r.catch) r.catch(() => {}); } catch (e) {} };
    // 带声音时浏览器多半不让自动播，用户第一次点页面的时候补一次
    let unlocked = false;
    function unlock() {
        if (unlocked) return; unlocked = true;
        document.querySelectorAll('.gylive-v').forEach(kickPlay);
    }
    try { ['pointerdown', 'keydown', 'touchstart'].forEach(e => document.addEventListener(e, unlock, { once: true, passive: true })); } catch (e) {}
    function mountVideo(host, id) {
        const rec = MAP[id]; if (!rec) return;
        const old = host.querySelector(':scope > .gylive-v');
        if (old) { if (old.dataset.gyid === id) return; old.remove(); }
        try {
            const cs = getComputedStyle(host);
            if (cs.position === 'static') host.style.position = 'relative';
            if (cs.overflow === 'visible') host.style.overflow = 'hidden';
        } catch (e) {}
        const v = mkVideo(rec); v.dataset.gyid = id;
        host.appendChild(v);
        if (rec.live) {
            // 实况：角上一个小标（地方够大才显示），刚出现时自己动一下
            const r = host.getBoundingClientRect();
            if (r.width >= 110 && !host.querySelector(':scope > .gylive-badge')) { const b = document.createElement('span'); b.className = 'gylive-badge'; b.textContent = '◎ 实况'; host.appendChild(b); }
            if (!liveSeen.has(id)) { liveSeen.add(id); setTimeout(() => livePlay(v), 400); }   // 第一次出现时自己动一下；之后重画不再动
            return;
        }
        kickPlay(v);
        unlocked = false;   // 新盖上的这颗要是被拦了，下次点页面再补一次
        try { ['pointerdown', 'keydown', 'touchstart'].forEach(e => document.addEventListener(e, unlock, { once: true, passive: true })); } catch (e) {}
    }
    /* 实况：按住 / 鼠标停在上面就从头播一遍，松开 / 移走就回到照片 */
    const liveSeen = new Set();
    function livePlay(v) { if (!v || !v.isConnected) return; v.classList.add('on'); try { v.currentTime = 0; } catch (e) {} kickPlay(v); }
    function liveStop(v) { if (!v) return; v.classList.remove('on'); try { v.pause(); } catch (e) {} setTimeout(() => { try { if (!v.classList.contains('on')) v.currentTime = 0; } catch (e) {} }, 320); }
    const liveAt = (x, y) => [...document.querySelectorAll('.gylive-v.live')].filter(v => { const r = (v.parentElement || v).getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && r.width > 0; });
    let pressT = null, pressed = [], hovered = [];
    document.addEventListener('pointerdown', e => { clearTimeout(pressT); const L = liveAt(e.clientX, e.clientY); if (!L.length) return; pressT = setTimeout(() => { pressed = L; L.forEach(livePlay); }, 220); }, true);
    const release = () => { clearTimeout(pressT); pressed.forEach(liveStop); pressed = []; };
    document.addEventListener('pointerup', release, true); document.addEventListener('pointercancel', release, true);
    let hvT = 0;
    document.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch') return;
        if (!hovered.length && Date.now() - hvT < 60) return; hvT = Date.now();   // 没东西在播的时候才省着点查
        const L = liveAt(e.clientX, e.clientY).filter(v => (v.parentElement || v).getBoundingClientRect().width < 300);   // 大的（壁纸）要按住才动，小的（头像、配图）鼠标移上去就动
        hovered.filter(v => !L.includes(v) && !pressed.includes(v)).forEach(liveStop);
        L.filter(v => !hovered.includes(v)).forEach(livePlay);
        hovered = L;
    }, { passive: true });
    function fixBg(el) {
        const st = el.getAttribute('style') || '';
        const m = st.match(TOKRE); if (!m) return;
        const id = m[1], rec = MAP[id];
        // 媒体已经被清掉了：把地址抹掉，免得每次扫描都撞上它
        if (!rec) { el.setAttribute('style', st.replace('gylive:' + id, '')); return; }
        if (isVideo(rec.mime)) {
            el.setAttribute('style', st.replace('gylive:' + id, rec.poster || ''));
            mountVideo(el, id);
        } else {
            el.setAttribute('style', st.replace('gylive:' + id, rec.url));
        }
    }
    function fixImg(img) {
        const m = String(img.getAttribute('src') || '').match(TOKRE); if (!m) return;
        const id = m[1], rec = MAP[id];
        if (!rec) { img.removeAttribute('src'); return; }
        if (!isVideo(rec.mime)) { img.src = rec.url; return; }
        img.src = rec.poster || '';
        // 视频盖在原来那张 img 上：包一层壳，img 留着（别的代码还会读它）
        let wrap = img.parentNode;
        if (!wrap || !wrap.classList || !wrap.classList.contains('gylive-wrap')) {
            wrap = document.createElement('span');
            wrap.className = 'gylive-wrap';
            img.parentNode.insertBefore(wrap, img);
            wrap.appendChild(img);
        }
        mountVideo(wrap, id);
    }
    function sweep() {
        if (!S.on) return;
        widenInputs();   // 后来才出现的上传框（回复框、相册、小手机里的）也放行视频
        try {
            document.querySelectorAll('[style*="gylive:"]').forEach(fixBg);
            document.querySelectorAll('img[src*="gylive:"]').forEach(fixImg);
        } catch (e) {}
    }
    window.gyLiveSweep = sweep;

    let t = null;
    const kick = () => { if (t) return; t = setTimeout(() => { t = null; sweep(); }, 120); };

    /* ---------- 文件选择框也得放行视频 ---------- */
    const ACCEPT = 'image/*,image/gif,video/*';
    function widenInputs() {
        try {
            document.querySelectorAll('input[type="file"][accept]').forEach(i => {
                const a = i.getAttribute('accept') || '';
                if (!/^image\//.test(a) || (S.on && /video/.test(a))) return;
                if (S.on) { if (a !== ACCEPT) { i.dataset.gyAccept0 = i.dataset.gyAccept0 || a; i.setAttribute('accept', ACCEPT); } }
                else if (i.dataset.gyAccept0) i.setAttribute('accept', i.dataset.gyAccept0);
            });
        } catch (e) {}
    }

    /* ---------- 两个总入口包一层 ---------- */
    const crop0 = window.handleImageCrop;
    if (crop0 && crop0.call && !crop0.__gyLive) {
        window.handleImageCrop = function (file, aspect, callback) {
            if (S.on && isLiveFile(file)) {
                take(file).then(tok => {
                    if (!tok) return;
                    try { callback(tok); } catch (e) { console.error('[动图视频] 回调出错', e); }
                    kick();
                    if (!/^video\//.test(file.type)) toast('动图设好了');
                });
                return;
            }
            return crop0.apply(this, arguments);
        };
        window.handleImageCrop.__gyLive = true;
    }
    const f2b0 = window.fileToBase64;
    if (f2b0 && f2b0.call && !f2b0.__gyLive) {
        window.fileToBase64 = function (file) {
            if (S.on && isLiveFile(file)) {
                return take(file);
            }
            return f2b0.apply(this, arguments);
        };
        window.fileToBase64.__gyLive = true;
    }

    /* ---------- 导出存档时把用到的媒体一起打包 ---------- */
    const blobToB64 = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(null); fr.readAsDataURL(b); });
    const ex0 = window.exportData;
    if (ex0 && ex0.call && !ex0.__gyLive) {
        window.exportData = async function () {
            if (!store) return ex0.apply(this, arguments);
            try {
                const data = getFullDataSnapshot();
                const used = new Set();
                (JSON.stringify(data).match(/gylive:[A-Za-z0-9]+/g) || []).forEach(x => used.add(x.slice(7)));
                const pack = {};
                for (const id of used) {
                    const rec = await store.getItem(id);
                    if (rec && rec.blob) pack[id] = { mime: rec.mime, poster: rec.poster || '', live: !!rec.live, b64: await blobToB64(rec.blob) };
                }
                if (Object.keys(pack).length) data.__gyLiveMedia = pack;
                saveTextFileForApp('twitter_ai_backup.json', JSON.stringify(data, null, 2), 'application/json');
                if (Object.keys(pack).length) toast('存档里带上了 ' + Object.keys(pack).length + ' 个动图/视频');
                return;
            } catch (e) { console.error('[动图视频] 打包失败，退回普通导出', e); }
            return ex0.apply(this, arguments);
        };
        window.exportData.__gyLive = true;
    }
    // 恢复存档之后：把随存档带过来的媒体收进本地库
    async function absorb() {
        if (!store || typeof localforage === 'undefined') return;
        let rec = null;
        try { rec = await localforage.getItem('myTwitterAppData'); } catch (e) { return; }
        if (!rec || !rec.__gyLiveMedia) return;
        const pack = rec.__gyLiveMedia; let n = 0;
        // 增量保存会把大段 base64 换成引用：只把这一块换回原图，存档其余部分保持原样写回
        try { if (typeof window.gyResolveImgRefs === 'function') await window.gyResolveImgRefs(pack); } catch (e) {}
        for (const id of Object.keys(pack)) {
            try {
                if (MAP[id]) continue;
                const blob = await (await fetch(pack[id].b64)).blob();
                await store.setItem(id, { mime: pack[id].mime, blob, poster: pack[id].poster || '', bytes: blob.size, at: Date.now(), live: !!pack[id].live });
                MAP[id] = { mime: pack[id].mime, url: URL.createObjectURL(blob), poster: pack[id].poster || '', bytes: blob.size, live: !!pack[id].live };
                n++;
            } catch (e) {}
        }
        try { delete rec.__gyLiveMedia; await localforage.setItem('myTwitterAppData', rec); } catch (e) {}
        if (n) { toast('从存档里恢复了 ' + n + ' 个动图/视频'); kick(); }
    }
    const load0 = window.loadAllData;
    if (load0 && load0.call && !load0.__gyLive) {
        window.loadAllData = async function () {
            const r = await load0.apply(this, arguments);
            try { await absorb(); } catch (e) {}
            kick();
            return r;
        };
        window.loadAllData.__gyLive = true;
    }

    /* ---------- 设置里那一块 ---------- */
    window.gyLiveSet = function (k, v) {
        S[k] = v; saveCfg();
        if (k === 'on') {
            widenInputs();
            if (!v) { document.querySelectorAll('.gylive-v').forEach(x => x.remove()); }
            else kick();
        }
        if (k === 'sound') document.querySelectorAll('.gylive-v').forEach(x => { x.muted = !v; });
        gyLiveStatus();
    };
    window.gyLiveRead = () => ({ on: S.on, sound: S.sound, maxMB: S.maxMB });

    window.gyLiveStatus = async function () {
        const el = document.getElementById('gyLiveStat'); if (!el || !store) return;
        let n = 0, bytes = 0;
        try { await store.iterate(v => { n++; bytes += (v && v.bytes) || 0; }); } catch (e) {}
        el.innerText = n ? ('本地媒体库：' + n + ' 个，占 ' + (bytes / 1048576).toFixed(1) + ' MB') : '本地媒体库：还是空的';
    };
    // 清掉没人用的：把整份存档搜一遍，没被引用的就删
    window.gyLiveClean = async function () {
        if (!store) return;
        let used = new Set();
        try { (JSON.stringify(getFullDataSnapshot()).match(/gylive:[A-Za-z0-9]+/g) || []).forEach(x => used.add(x.slice(7))); } catch (e) {}
        const dead = [];
        try { await store.iterate((v, k) => { if (!used.has(k)) dead.push(k); }); } catch (e) {}
        for (const k of dead) { try { await store.removeItem(k); } catch (e) {} delete MAP[k]; }
        toast(dead.length ? ('清掉了 ' + dead.length + ' 个没在用的' ) : '没有可清的，全都在用');
        gyLiveStatus();
    };

    /* ---------- 样式 ---------- */
    try {
        const st = document.createElement('style');
        st.id = 'gyLiveCss';
        st.textContent =
            '.gylive-v{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' +
            'border-radius:inherit;pointer-events:none;z-index:0;display:block;background:transparent;}' +
            '.gylive-wrap{position:relative;display:inline-block;line-height:0;max-width:100%;}' +
            '.gylive-wrap>img{display:block;max-width:100%;}' +
            '.gylive-v.live{opacity:0;transition:opacity .3s}.gylive-v.live.on{opacity:1}' +
            '.gylive-badge{position:absolute;left:8px;top:8px;z-index:1;font-size:10.5px;line-height:1;padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.72);color:#333;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none;font-weight:600;letter-spacing:.5px}' +
            '#gyLiveAsk{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:20px}' +
            '#gyLiveAsk .bx{background:#fff;color:#111;border-radius:20px;padding:16px;width:min(320px,100%);display:flex;flex-direction:column;gap:9px;box-shadow:0 20px 50px rgba(0,0,0,.25);font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}' +
            '#gyLiveAsk video{width:100%;max-height:180px;object-fit:cover;border-radius:12px;background:#000}' +
            '#gyLiveAsk b{font-size:16px;text-align:center;margin:4px 0}' +
            '#gyLiveAsk button{border:none;border-radius:14px;padding:11px 14px;background:#f2f2f4;font-size:15px;font-weight:600;cursor:pointer;text-align:left;color:#111;font-family:inherit}' +
            '#gyLiveAsk button small{display:block;font-size:12px;font-weight:400;color:#8e8e93;margin-top:2px}' +
            '#gyLiveAsk button.no{text-align:center;background:none;color:#8e8e93;font-weight:500}';
        document.head.appendChild(st);
    } catch (e) {}

    // 设置页里那三个控件回填（刷新之后也得是你上次选的样子）
    function fillUI() {
        try {
            const a = document.getElementById('gyLiveOn'); if (a) a.checked = !!S.on;
            const b = document.getElementById('gyLiveSound'); if (b) b.checked = !!S.sound;
            const c = document.getElementById('gyLiveMaxMB'); if (c) c.value = S.maxMB;
        } catch (e) {}
        gyLiveStatus();
    }
    const op0 = window.openSettingsPanel;
    if (op0 && op0.call && !op0.__gyLive) {
        window.openSettingsPanel = function (k) {
            const r = op0.apply(this, arguments);
            if (k === 'appearance') setTimeout(fillUI, 60);
            return r;
        };
        window.openSettingsPanel.__gyLive = true;
    }

    /* ---------- 起飞 ---------- */
    async function boot() {
        if (store) {
            try {
                await store.iterate((v, k) => {
                    try { MAP[k] = { mime: v.mime, url: URL.createObjectURL(v.blob), poster: v.poster || '', bytes: v.bytes || 0, live: !!v.live }; } catch (e) {}
                });
            } catch (e) {}
        }
        widenInputs();
        fillUI();
        sweep();
        try {
            new MutationObserver(kick).observe(document.body,
                { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'src'] });
        } catch (e) {}
        gyLiveStatus();
    }
    if (document.readyState === 'complete') setTimeout(boot, 900);
    else window.addEventListener('load', () => setTimeout(boot, 900));

    console.info('[动图视频] 已加载。开关：设置 → 外观 →「🎞️ 动图和视频」（默认开）');
})();
