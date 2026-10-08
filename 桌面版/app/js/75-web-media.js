/* ===========================================================================
   js/75 —— 🎧 一起听 · 一起看：把网易云 / QQ 音乐 / B 站……这些网站放进来，边听边跟 TA 聊
   ---------------------------------------------------------------------------
   三种环境，能做到的不一样（网站自己决定能不能被别的页面装进去）：
   · 桌面版 exe：真的把官方网页整个开在一个小窗里（你自己登录，VIP 按你账号的权限），
     我们读「正在放什么、放到哪儿」，能暂停 / 继续 / 下一首。登录状态会一直留着。
   · 手机 APK（HBuilderX 打包的）：用系统的网页窗口叠在小窗那块位置上开官方网页，同样能登录。
   · 浏览器 / 手机网页版：网站不让被装进别的页面，所以改用各家「官方外链播放器」——
     贴网易云歌曲 / 歌单、B 站视频、YouTube、腾讯视频、优酷、Spotify、Apple Music 的链接就能放；
     放不了的网站给你一个「在新窗口打开」，再手动告诉 TA 你在听 / 看什么。
   和 TA 的联动：选一个「和谁一起」，TA 就知道你们正在一起听 / 看什么（聊天时会提），
   换歌时聊天里记一笔，TA 偶尔会主动说两句；点「让 TA 说说」就马上说。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyWebMediaLoaded) return;
    window.__gyWebMediaLoaded = true;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []).filter(c => c && !c.members);
    const charOf = id => chars().find(c => String(c.id) === String(id));
    const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
    const ENV = /Electron/i.test(navigator.userAgent) ? 'desk' : (window.plus && window.plus.webview ? 'apk' : 'web');
    window.gyWmEnv = () => ENV;

    const SITES = [
        ['netease', '网易云音乐', '🎵', 'music', 'https://music.163.com/', 'https://y.music.163.com/m/'],
        ['qq', 'QQ 音乐', '🎶', 'music', 'https://y.qq.com/', 'https://i.y.qq.com/n2/m/index.html'],
        ['kugou', '酷狗音乐', '🐶', 'music', 'https://www.kugou.com/', 'https://m.kugou.com/'],
        ['kuwo', '酷我音乐', '🎧', 'music', 'https://www.kuwo.cn/', 'https://m.kuwo.cn/'],
        ['migu', '咪咕音乐', '🎼', 'music', 'https://music.migu.cn/', 'https://m.music.migu.cn/'],
        ['spotify', 'Spotify', '🟢', 'music', 'https://open.spotify.com/', 'https://open.spotify.com/'],
        ['apple', 'Apple Music', '🍎', 'music', 'https://music.apple.com/', 'https://music.apple.com/'],
        ['ytm', 'YouTube Music', '▶️', 'music', 'https://music.youtube.com/', 'https://music.youtube.com/'],
        ['bili', '哔哩哔哩', '📺', 'video', 'https://www.bilibili.com/', 'https://m.bilibili.com/'],
        ['txv', '腾讯视频', '🐧', 'video', 'https://v.qq.com/', 'https://m.v.qq.com/'],
        ['iqiyi', '爱奇艺', '🥝', 'video', 'https://www.iqiyi.com/', 'https://m.iqiyi.com/'],
        ['youku', '优酷', '🎞️', 'video', 'https://www.youku.com/', 'https://m.youku.com/'],
        ['mgtv', '芒果 TV', '🥭', 'video', 'https://www.mgtv.com/', 'https://m.mgtv.com/'],
        ['yt', 'YouTube', '🔴', 'video', 'https://www.youtube.com/', 'https://m.youtube.com/'],
        ['douyin', '抖音', '🎵', 'video', 'https://www.douyin.com/', 'https://www.douyin.com/'],
        ['netflix', 'Netflix', '🍿', 'video', 'https://www.netflix.com/', 'https://www.netflix.com/']
    ];
    const siteOfUrl = u => SITES.find(s => { try { const h = new URL(u).hostname; return h.endsWith(new URL(s[4]).hostname.replace(/^www\./, '')) || h.endsWith(new URL(s[5]).hostname.replace(/^(www|m|i|y)\./, '')); } catch (e) { return false; } });
    const mobileUA = () => /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || window.innerWidth < 700;

    /* ---------- 官方外链播放器（浏览器 / 手机网页版用） ---------- */
    function embedOf(u) {
        u = String(u || '').trim(); let m;
        if ((m = u.match(/music\.163\.com.*?(song|playlist|album|program|djradio)\?id=(\d+)/)) || (m = u.match(/music\.163\.com.*?\/(song|playlist|album)\/(\d+)/))) {
            const t = { song: 2, playlist: 0, album: 1, program: 3, djradio: 4 }[m[1]]; const h = t === 2 ? 66 : 430;
            return { src: `https://music.163.com/outchain/player?type=${t}&id=${m[2]}&auto=1&height=${h}`, h: h + 20, site: 'netease', kind: 'music' };
        }
        if ((m = u.match(/bilibili\.com\/video\/(BV[\w]+)/i)) || (m = u.match(/\b(BV1[\w]{9})\b/))) { const p = (u.match(/[?&]p=(\d+)/) || [])[1] || 1; return { src: `https://player.bilibili.com/player.html?bvid=${m[1]}&page=${p}&high_quality=1&autoplay=1`, h: 0, site: 'bili', kind: 'video' }; }
        if ((m = u.match(/bilibili\.com\/video\/av(\d+)/i))) return { src: `https://player.bilibili.com/player.html?aid=${m[1]}&high_quality=1&autoplay=1`, h: 0, site: 'bili', kind: 'video' };
        if ((m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/))) return { src: `https://www.youtube.com/embed/${m[1]}?autoplay=1`, h: 0, site: 'yt', kind: 'video' };
        if ((m = u.match(/v\.qq\.com\/x\/(?:cover\/[\w]+\/|page\/)([\w]+)\.html/))) return { src: `https://v.qq.com/txp/iframe/player.html?vid=${m[1]}`, h: 0, site: 'txv', kind: 'video' };
        if ((m = u.match(/youku\.com\/v_show\/id_([\w=]+)\.html/))) return { src: `https://player.youku.com/embed/${m[1]}`, h: 0, site: 'youku', kind: 'video' };
        if ((m = u.match(/open\.spotify\.com\/(track|album|playlist|episode)\/(\w+)/))) return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, h: m[1] === 'track' ? 172 : 400, site: 'spotify', kind: 'music' };
        if ((m = u.match(/music\.apple\.com\/(.+)/))) return { src: `https://embed.music.apple.com/${m[1]}`, h: 180, site: 'apple', kind: 'music' };
        if ((m = u.match(/y\.qq\.com\/n\/ryqq\/songDetail\/(\w+)/)) || (m = u.match(/songmid=(\w+)/))) return { src: `https://i.y.qq.com/v8/playsong.html?songmid=${m[1]}`, h: 0, site: 'qq', kind: 'music', maybe: true };
        return null;
    }
    window.gyWmEmbedOf = embedOf;
    // 分享文案里带着歌名：「分享周杰伦的单曲《晴天》: https://...」
    function titleFromShare(t) {
        t = String(t || ''); const m = t.match(/《([^》]+)》/); if (!m) return null;
        const a = t.match(/分享(.+?)的(单曲|歌曲|专辑|歌单)/);
        return { title: m[1], artist: a ? a[1] : '' };
    }
    const urlIn = t => (String(t || '').match(/https?:\/\/[^\s，。）)]+/) || [])[0] || '';

    /* ---------- 状态 ---------- */
    const W = Object.assign({ open: false, min: false, url: '', site: '', with: '', x: null, y: null, w: 420, h: 560, react: 30 }, LS.get('gyWm', {}));
    let NOW = { title: '', artist: '', cover: '', playing: false, t: 0, d: 0, kind: '', manual: false };
    W.withs = Array.isArray(W.withs) ? W.withs.map(String) : (W.with ? [String(W.with)] : []);
    const saveW = () => LS.set('gyWm', { url: W.url, site: W.site, withs: W.withs, x: W.x, y: W.y, w: W.w, h: W.h, react: W.react });
    const withChars = () => W.withs.map(id => charOf(id)).filter(Boolean);
    window.gyWmNow = () => (W.open || NOW.manual) && NOW.title ? Object.assign({}, NOW) : null;
    const fmt = s => { s = Math.max(0, Math.floor(+s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const siteName = k => (SITES.find(s => s[0] === k) || [0, '网页'])[1];

    /* ---------- 窗口 ---------- */
    function mount() {
        let el = document.getElementById('gyWm');
        if (el) return el;
        el = document.createElement('div'); el.id = 'gyWm';
        el.innerHTML = `<div class="hd"><b class="t">🎧 一起听 · 一起看</b><span class="who" onclick="gyWmWhoPanel()">和谁一起？</span>
            <span class="ic" title="网站" onclick="gyWmHome()">⌂</span><span class="ic" title="后退" onclick="gyWmNav('back')">‹</span><span class="ic" title="刷新" onclick="gyWmNav('reload')">↻</span>
            <span class="ic" title="缩小" onclick="gyWmMin(true)">▁</span><span class="ic" title="关掉" onclick="gyWmClose()">✕</span></div>
            <div class="bar"><input class="url" placeholder="网址 / 分享链接，回车打开" onkeydown="if(event.key==='Enter')gyWmGo(this.value)"><span class="ic" onclick="gyWmGo(this.previousElementSibling.value)">→</span></div>
            <div class="whos" id="gyWmWhos" style="display:none"></div>
            <div class="bd" id="gyWmBody"></div>
            <div class="ft"><span class="np" id="gyWmNp">还没在放</span><span class="ctl"><i onclick="gyWmCtl('toggle')" title="暂停 / 继续">⏯</i><i onclick="gyWmCtl('next')" title="下一首">⏭</i></span><b onclick="gyWmTalk()">让 TA 说说</b></div>
            <i class="rz" title="拖动改大小"></i>`;
        document.body.appendChild(el);
        drag(el); resize(el);
        const pill = document.createElement('div'); pill.id = 'gyWmPill'; pill.onclick = () => window.gyWmMin(false);
        document.body.appendChild(pill);
        return el;
    }
    function place() {
        const el = document.getElementById('gyWm'); if (!el) return;
        const vw = innerWidth, vh = innerHeight, w = Math.min(W.w, vw - 16), h = Math.min(W.h, vh - 24);
        if (W.x == null) { W.x = vw - w - 16; W.y = Math.max(12, vh - h - 90); }
        W.x = Math.max(4, Math.min(vw - 60, W.x)); W.y = Math.max(4, Math.min(vh - 60, W.y));
        Object.assign(el.style, { left: W.x + 'px', top: W.y + 'px', width: w + 'px', height: h + 'px' });
        apkPlace();
    }
    function drag(el) {
        const hd = el.querySelector('.hd'); let d = null;
        hd.addEventListener('pointerdown', e => { if (e.target.closest('.ic,select,.who')) return; d = { x: e.clientX - W.x, y: e.clientY - W.y, id: e.pointerId }; el.classList.add('drag'); try { hd.setPointerCapture(e.pointerId); } catch (er) {} });
        hd.addEventListener('pointermove', e => { if (!d || e.pointerId !== d.id) return; W.x = e.clientX - d.x; W.y = e.clientY - d.y; place(); });
        const up = () => { if (!d) return; d = null; el.classList.remove('drag'); saveW(); };
        hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
    }
    function resize(el) {
        const g = el.querySelector('.rz'); let d = null;
        g.addEventListener('pointerdown', e => { d = { x: e.clientX, y: e.clientY, w: el.offsetWidth, h: el.offsetHeight, id: e.pointerId }; el.classList.add('drag'); try { g.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault(); });
        g.addEventListener('pointermove', e => { if (!d || e.pointerId !== d.id) return; W.w = Math.max(160, d.w + e.clientX - d.x); W.h = Math.max(120, d.h + e.clientY - d.y); place(); });
        const up = () => { if (!d) return; d = null; el.classList.remove('drag'); saveW(); };
        g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    }
    function whoSel() {
        const s = document.querySelector('#gyWm .who'); if (!s) return;
        const L = withChars();
        s.textContent = L.length ? '和 ' + L.map(c => c.remark || c.name).join('、') + ' ▾' : '和谁一起？▾';
        const p = document.getElementById('gyWmWhos');
        if (p) p.innerHTML = `<div class="ch">${chars().map(c => `<span class="${W.withs.includes(String(c.id)) ? 'on' : ''}" onclick="gyWmWith('${esc(c.id)}')">${esc(c.remark || c.name)}</span>`).join('')}</div>
            <label class="rc">换歌 / 换视频时 TA 们搭话的概率 <input type="range" min="0" max="100" value="${+W.react || 0}" oninput="gyWmReact(this.value)"><b id="gyWmReactV">${+W.react || 0}%</b></label>`;
    }
    window.gyWmWhoPanel = function (on) { const p = document.getElementById('gyWmWhos'); if (!p) return; p.style.display = (on != null ? on : p.style.display === 'none') ? '' : 'none'; whoSel(); };
    window.gyWmReact = v => { W.react = Math.max(0, Math.min(100, +v || 0)); const b = document.getElementById('gyWmReactV'); if (b) b.textContent = W.react + '%'; saveW(); };
    window.gyWmOpen = function (url, withId) {
        const el = mount(); W.open = true; W.min = false;
        if (withId != null) { if (!W.withs.includes(String(withId))) W.withs.push(String(withId)); }
        else if (!W.withs.length && typeof currentChatSessionId !== 'undefined' && charOf(currentChatSessionId)) W.withs.push(String(currentChatSessionId));
        el.style.display = 'flex'; document.getElementById('gyWmPill').style.display = 'none';
        whoSel(); place();
        if (url) window.gyWmGo(url); else if (W.url) window.gyWmGo(W.url, true); else window.gyWmHome();
        saveW();
    };
    window.gyWmClose = function () {
        W.open = false; const el = document.getElementById('gyWm'); if (el) el.style.display = 'none';
        const p = document.getElementById('gyWmPill'); if (p) p.style.display = 'none';
        apkClose(); const b = document.getElementById('gyWmBody'); if (b) b.innerHTML = '';   // 关掉就停（网页里的声音跟着停）
        if (!NOW.manual) NOW = { title: '', artist: '', playing: false };
    };
    window.gyWmMin = function (on) {
        W.min = !!on; const el = document.getElementById('gyWm'), p = document.getElementById('gyWmPill'); if (!el) return;
        el.classList.toggle('mini', W.min);   // 缩小只是藏起来，网页照样在放
        p.style.display = W.min ? 'flex' : 'none'; paintPill();
        if (ENV === 'apk') { if (W.min) apkHide(); else { apkShow(); apkPlace(); } }
    };
    // 点一下加进来 / 再点一下拿掉；想几个人一起都行
    window.gyWmWith = v => {
        v = String(v || ''); if (!v) return;
        const i = W.withs.indexOf(v); if (i >= 0) W.withs.splice(i, 1); else { W.withs.push(v); if (NOW.title) noteToChat(true, [v]); }
        saveW(); whoSel();
    };
    window.gyWmHome = function () {
        const b = document.getElementById('gyWmBody'); if (!b) return;
        apkHide();
        const grid = kind => SITES.filter(s => s[3] === kind).map(s => `<span class="st" onclick="gyWmGo('${s[0]}')"><b>${s[2]}</b>${esc(s[1])}</span>`).join('');
        const tip = ENV === 'desk' ? '开的是官方网页，自己登录就行（登录会一直留着）。放什么我们都能看到，TA 也知道。'
            : ENV === 'apk' ? '用手机自己的网页窗口开官方网页，能登录。'
                : '浏览器里这些网站不让被装进别的页面：贴<b>歌曲 / 歌单 / 视频的分享链接</b>，用官方的小播放器放（网易云、B 站、YouTube、腾讯视频、优酷、Spotify、Apple Music）；别的网站点了会在新窗口打开。';
        b.innerHTML = `<div class="home"><div class="tip">${tip}</div><div class="lbl">听歌</div><div class="grid">${grid('music')}</div><div class="lbl">看视频</div><div class="grid">${grid('video')}</div>
            <div class="lbl">手动告诉 TA 你在听 / 看什么</div><div class="man"><input id="gyWmManT" placeholder="比如：晴天 - 周杰伦"><span onclick="gyWmManual(document.getElementById('gyWmManT').value)">告诉 TA</span></div></div>`;
        const u = document.querySelector('#gyWm .url'); if (u) u.value = '';
    };
    window.gyWmManual = function (t) {
        t = String(t || '').trim(); if (!t) return;
        const [a, b] = t.split(/\s*[-–—]\s*/);
        NOW = { title: a || t, artist: b || '', playing: true, t: 0, d: 0, kind: '', manual: true, site: '' };
        paintNp(); noteToChat(true); toast('🎧 告诉 TA 了', t);
    };
    // 打开：站点 key / 网址 / 分享文案
    window.gyWmGo = function (x, quiet) {
        x = String(x || '').trim(); if (!x) return;
        const s = SITES.find(q => q[0] === x);
        let url = s ? (ENV === 'desk' ? s[4] : (mobileUA() ? s[5] : s[4])) : (urlIn(x) || (/^[\w.-]+\.\w{2,}(\/|$)/.test(x) ? 'https://' + x : ''));
        if (!url) { toast('认不出网址', '贴完整链接，或者点上面的网站'); return; }
        const sh = titleFromShare(x); if (sh) { NOW = Object.assign(NOW, sh, { manual: true, playing: true }); paintNp(); }
        W.url = url; W.site = s ? s[0] : ((siteOfUrl(url) || [])[0] || ''); saveW();
        const u = document.querySelector('#gyWm .url'); if (u) u.value = url;
        const b = document.getElementById('gyWmBody'); if (!b) return;
        if (ENV === 'desk') {
            let wv = b.querySelector('webview');
            if (!wv) { b.innerHTML = ''; wv = document.createElement('webview'); wv.setAttribute('partition', 'persist:gymedia'); wv.setAttribute('allowpopups', ''); wv.style.cssText = 'width:100%;height:100%;display:flex'; b.appendChild(wv); wv.addEventListener('did-navigate', e => { W.url = e.url; const uu = document.querySelector('#gyWm .url'); if (uu) uu.value = e.url; saveW(); }); }
            wv.setAttribute('src', url); return;
        }
        if (ENV === 'apk') { b.innerHTML = '<div class="apkph">网页在这一块打开…</div>'; apkOpen(url); return; }
        const em = embedOf(url);
        if (em) {
            b.innerHTML = `<iframe src="${esc(em.src)}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="no-referrer-when-downgrade" style="width:100%;${em.h ? 'height:' + em.h + 'px' : 'height:100%'};border:0;border-radius:10px;background:#000"></iframe>
                ${em.maybe ? '<div class="tip">QQ 音乐的外链不一定放得出来；放不了就点下面在新窗口打开。</div>' : ''}
                <div class="tip">${NOW.title ? '' : '小播放器里的歌名我们读不到：在下面告诉 TA 你在听什么就好（分享文案里带《歌名》的会自动认出来）。'}</div>
                <div class="man"><input id="gyWmManT" placeholder="正在放：歌名 - 歌手" value="${esc(NOW.manual ? [NOW.title, NOW.artist].filter(Boolean).join(' - ') : '')}"><span onclick="gyWmManual(document.getElementById('gyWmManT').value)">告诉 TA</span><span onclick="window.open('${esc(url)}','_blank')">新窗口打开</span></div>`;
            W.kind = em.kind;
            if (!quiet && NOW.title) noteToChat(true);
            return;
        }
        b.innerHTML = `<div class="home"><div class="tip">这个网站不让被装进别的页面里（浏览器拦的）。<br>点下面在新窗口打开，回来在这里告诉 TA 你在听 / 看什么。<br><small>想直接放在这里：用桌面版 exe 或手机 APK；或者贴一首歌 / 一个视频的分享链接。</small></div>
            <div class="man"><span class="big" onclick="window.open('${esc(url)}','_blank')">在新窗口打开 ${esc(siteName(W.site))}</span></div>
            <div class="man"><input id="gyWmManT" placeholder="正在放：歌名 - 歌手"><span onclick="gyWmManual(document.getElementById('gyWmManT').value)">告诉 TA</span></div></div>`;
    };
    window.gyWmNav = function (a) {
        const b = document.getElementById('gyWmBody'); if (!b) return;
        const wv = b.querySelector('webview');
        if (wv) { try { if (a === 'back' && wv.canGoBack()) wv.goBack(); else if (a === 'reload') wv.reload(); } catch (e) {} return; }
        if (ENV === 'apk' && APK.wv) { try { if (a === 'back') APK.wv.back(); else APK.wv.reload(); } catch (e) {} return; }
        const f = b.querySelector('iframe'); if (f && a === 'reload') f.src = f.src; if (a === 'back') window.gyWmHome();
    };

    /* ---------- 读「正在放什么」 ---------- */
    const PROBE = `(() => { try {
        const md = navigator.mediaSession && navigator.mediaSession.metadata;
        const els = [...document.querySelectorAll('video,audio')];
        const m = els.find(e => !e.paused) || els.find(e => e.currentTime > 0) || els[0];
        const q = s => { const e = document.querySelector(s); return e ? (e.getAttribute('title') || e.textContent || '').trim() : ''; };
        let title = (md && md.title) || '', artist = (md && md.artist) || '';
        const h = location.hostname;
        if (!title && /163\\.com/.test(h)) { title = q('.m-playbar .words .name'); artist = q('.m-playbar .words .by'); }
        if (!title && /y\\.qq\\.com/.test(h)) { title = q('.player_music__info a') || q('.song_info__name'); artist = q('.player_music__info .playlist__author') || q('.song_info__singer'); }
        if (!title && /kugou/.test(h)) { title = q('.audioName') || q('.songName'); artist = q('.singerName'); }
        if (!title && /kuwo/.test(h)) { title = q('.player_info .name') || q('.song_name'); artist = q('.player_info .artist') || q('.song_artist'); }
        if (!title && /bilibili/.test(h)) { title = q('h1.video-title') || q('.video-title'); artist = q('.up-name'); }
        if (!title) title = (document.title || '').replace(/\\s*[-_|–—]\\s*(网易云音乐|QQ音乐.*|哔哩哔哩.*|bilibili.*|腾讯视频.*|爱奇艺.*|优酷.*|芒果TV.*|YouTube.*|抖音.*|酷狗.*|酷我.*|咪咕.*|Spotify.*|Netflix.*)$/i, '').replace(/^[▶❚ ]+/, '').trim();
        const cover = md && md.artwork && md.artwork.length ? md.artwork[md.artwork.length - 1].src : '';
        return { title, artist, cover, playing: !!(m && !m.paused), t: m ? m.currentTime : 0, d: m && isFinite(m.duration) ? m.duration : 0, kind: m ? m.tagName.toLowerCase() : '' };
    } catch (e) { return null; } })()`;
    const CTL = {
        toggle: `(() => { const els=[...document.querySelectorAll('video,audio')]; const m=els.find(e=>!e.paused)||els.find(e=>e.currentTime>0)||els[0]; if(m){ if(m.paused) m.play(); else m.pause(); return true;} const b=document.querySelector('.m-playbar .ply,.btn_big_play,.play,.icon-player-play,.bpx-player-ctrl-play'); if(b){b.click();return true;} return false; })()`,
        next: `(() => { const b=document.querySelector('.m-playbar .nxt,.btn_big_next,.next,.icon-player-next,.bpx-player-ctrl-next,[aria-label="下一首"],[aria-label="Next"],[data-testid="control-button-skip-forward"]'); if(b){b.click();return true;} return false; })()`
    };
    window.__gyWmProbeSrc = PROBE; window.__gyWmCtlSrc = CTL;
    async function probe() {
        if (!W.open || NOW.manual && ENV === 'web') return;
        let r = null;
        const wv = document.querySelector('#gyWmBody webview');
        if (wv) { try { r = await wv.executeJavaScript(PROBE); } catch (e) {} }
        else if (ENV === 'apk' && APK.wv) { try { APK.wv.evalJS(`(function(){var r=${PROBE};try{plus.webview.getLaunchWebview().evalJS('window.__gyWmCb&&__gyWmCb('+JSON.stringify(JSON.stringify(r))+')')}catch(e){}})()`); } catch (e) {} return; }
        if (r) got(r);
    }
    window.__gyWmCb = s => { try { got(JSON.parse(s)); } catch (e) {} };
    let lastKey = '', lastTalk = 0;
    function got(r) {
        if (!r || !r.title) return;
        const key = r.title + '|' + r.artist;
        NOW = Object.assign({}, r, { manual: false, site: W.site });
        paintNp();
        if (key !== lastKey) { const first = !lastKey; lastKey = key; if (!first || W.withs.length) noteToChat(false); }
    }
    window.gyWmCtl = async function (a) {
        const wv = document.querySelector('#gyWmBody webview');
        if (wv) { try { await wv.executeJavaScript(CTL[a]); } catch (e) {} setTimeout(probe, 600); return; }
        if (ENV === 'apk' && APK.wv) { try { APK.wv.evalJS(CTL[a]); } catch (e) {} return; }
        toast('网页版控制不了小播放器', '直接点小播放器上的按钮');
    };
    function paintNp() {
        const np = document.getElementById('gyWmNp');
        if (np) np.innerHTML = NOW.title ? `${NOW.playing ? '▶' : '❚❚'} <b>${esc(NOW.title)}</b>${NOW.artist ? ' · ' + esc(NOW.artist) : ''}${NOW.d ? ` <em>${fmt(NOW.t)} / ${fmt(NOW.d)}</em>` : ''}` : '还没在放';
        paintPill();
    }
    function paintPill() { const p = document.getElementById('gyWmPill'); if (p) p.innerHTML = `<i>${NOW.playing ? '🎧' : '⏸'}</i><span>${esc(NOW.title || '一起听 · 一起看')}</span>`; }

    /* ---------- 和 TA 的联动 ---------- */
    const kindWord = () => (NOW.kind === 'video' || (SITES.find(s => s[0] === (NOW.site || W.site)) || [])[3] === 'video') ? '看' : '听';
    window.__gyWebMediaCtxFor = function (charId) {
        if (!NOW.title || !W.withs.includes(String(charId)) || !(W.open || NOW.manual)) return '';
        const who = (() => { const c = charOf(charId); return typeof userDisplayName === 'function' && c ? userDisplayName(c) : '对方'; })();
        const others = withChars().filter(c => String(c.id) !== String(charId)).map(c => c.remark || c.name);
        return `【你们正在一起${kindWord()}${others.length ? '（一起的还有 ' + others.join('、') + '）' : ''}】${siteName(NOW.site || W.site) !== '网页' ? siteName(NOW.site || W.site) + '上的' : ''}《${NOW.title}》${NOW.artist ? '（' + NOW.artist + '）' : ''}，${NOW.playing ? '正在放' : '暂停着'}${NOW.d ? '，放到 ' + fmt(NOW.t) + ' / ' + fmt(NOW.d) : ''}。你和${who}一边${kindWord()}一边聊天，可以自然地聊到它（喜不喜欢、想起了什么、接下来想${kindWord()}什么），别每句都提。`;
    };
    function hookCtx() { try { if (typeof GY_BOX_CTX !== 'undefined' && Array.isArray(GY_BOX_CTX) && !GY_BOX_CTX.some(x => x[0] === '__gyWebMediaCtxFor')) GY_BOX_CTX.push(['__gyWebMediaCtxFor', '一起听 · 一起看']); } catch (e) {} }
    // 换歌：聊天里记一笔；隔一阵 TA 会主动说两句
    function noteToChat(force, only) {
        if (!NOW.title || typeof globalChats === 'undefined') return;
        (only ? only.map(charOf).filter(Boolean) : withChars()).forEach(c => {
            const sid = String(c.id); if (!globalChats[sid]) globalChats[sid] = [];
            globalChats[sid].push({ sender: 'system', text: `🎧 一起${kindWord()}：《${NOW.title}》${NOW.artist ? ' - ' + NOW.artist : ''}`, timestamp: Date.now() });
            try { if (String(currentChatSessionId) === sid) renderChatMessages(); } catch (e) {}
            if (force || Math.random() * 100 < (+W.react || 0)) talk(c, false);
        });
        try { saveAllData(); } catch (e) {}
    }
    const NUDGE = {};
    const nudgeCtx = charId => NUDGE[String(charId)] ? `\n【这次主动开口的由头】${NUDGE[String(charId)]}` : '';
    window.__gyWebMediaNudgeFor = nudgeCtx;
    function hookNudge() { try { if (typeof GY_BOX_CTX !== 'undefined' && !GY_BOX_CTX.some(x => x[0] === '__gyWebMediaNudgeFor')) GY_BOX_CTX.push(['__gyWebMediaNudgeFor', '一起听 · 由头']); } catch (e) {} }
    async function talk(c, manual) {
        if (typeof sendProactiveChatMessage !== 'function') return;
        NUDGE[String(c.id)] = manual ? `${uname()}让你说说正在一起${kindWord()}的《${NOW.title}》` : `刚刚换到了《${NOW.title}》，你想说两句`;
        try { await sendProactiveChatMessage(c); } catch (e) {} finally { delete NUDGE[String(c.id)]; }
    }
    const uname = () => (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '对方';
    window.gyWmTalk = function () {
        const L = withChars(); if (!L.length) { toast('先选「和谁一起」'); window.gyWmWhoPanel(true); return; }
        if (!NOW.title) { toast('还不知道在放什么', '放起来，或者手动告诉 TA'); return; }
        L.forEach(c => talk(c, true)); toast('🎧 ' + L.map(c => c.remark || c.name).join('、') + ' 在想怎么说…');
    };
    // 小岛 / 音乐小组件：音乐盒没在放的时候，显示网站里正在放的
    function hookNowInfo() {
        if (typeof window.gymNowInfo !== 'function' || window.gymNowInfo.__gyWm) return;
        const f0 = window.gymNowInfo;
        window.gymNowInfo = function () { const r = f0.apply(this, arguments); if (r && r.playing) return r; const n = window.gyWmNow(); return n && n.playing ? { title: n.title, artist: n.artist || siteName(n.site), cover: n.cover || '', playing: true, t: n.t || 0, d: n.d || 0, web: true } : r; };
        window.gymNowInfo.__gyWm = true;
    }

    /* ---------- APK：系统网页窗口叠在小窗那一块 ---------- */
    const APK = { wv: null };
    function apkOpen(url) {
        try {
            const b = document.getElementById('gyWmBody'); const r = b.getBoundingClientRect();
            if (!APK.wv) { APK.wv = plus.webview.create(url, 'gyWmWeb', { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px', position: 'absolute', plusrequire: 'normal' }); plus.webview.currentWebview().append(APK.wv); }
            else APK.wv.loadURL(url);
            APK.wv.show();
        } catch (e) { toast('没开成', String(e && e.message || e)); }
    }
    function apkPlace() { if (!APK.wv) return; try { const r = document.getElementById('gyWmBody').getBoundingClientRect(); APK.wv.setStyle({ top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' }); } catch (e) {} }
    const apkHide = () => { try { if (APK.wv) APK.wv.hide(); } catch (e) {} };
    const apkShow = () => { try { if (APK.wv) APK.wv.show(); } catch (e) {} };
    function apkClose() { try { if (APK.wv) { APK.wv.close(); APK.wv = null; } } catch (e) {} }

    /* ---------- 入口 ---------- */
    function entries() {
        const row = document.getElementById('chatToolIconsRow');
        if (row && !document.getElementById('gyWmBtn')) {
            const b = document.createElement('button'); b.className = 'btn-edit-small'; b.id = 'gyWmBtn'; b.title = '一起听 · 一起看（网易云 / QQ 音乐 / B 站……）'; b.textContent = '🎧';
            b.onclick = () => { const sid = typeof currentChatSessionId !== 'undefined' ? currentChatSessionId : null; window.gyWmOpen(null, charOf(sid) ? sid : null); };
            row.appendChild(b);
        }
        try { if (typeof registerMiniFeature === 'function' && !(typeof GY_MINI_FEATURES !== 'undefined' && GY_MINI_FEATURES.some(f => f.id === 'webMedia'))) registerMiniFeature({ id: 'webMedia', icon: '🎧', title: '一起听 · 一起看', desc: '网易云、QQ 音乐、酷狗、B 站、腾讯视频……放进来，边听边跟 TA 聊', onOpen: () => window.gyWmOpen() }); } catch (e) {}
    }

    const CSS = `
#gyWm{position:fixed;z-index:9000;display:none;flex-direction:column;background:#fff;color:#111;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28),0 0 0 1px rgba(0,0,0,.06);overflow:hidden}
#gyWm.mini{display:none!important}#gyWm.drag webview,#gyWm.drag iframe{pointer-events:none}
#gyWm .hd{display:flex;align-items:center;gap:6px;padding:8px 10px;background:#f6f6f8;cursor:grab;touch-action:none;user-select:none}
#gyWm .hd .t{font-size:13px;white-space:nowrap}#gyWm .hd .who{margin-left:auto;font-size:12px;padding:3px 8px;border-radius:8px;border:1px solid #ddd;background:#fff;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
#gyWm .whos{padding:6px 10px;border-bottom:1px solid #eee;font-size:12.5px}#gyWm .whos .ch{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px}#gyWm .whos .ch span{padding:3px 10px;border-radius:999px;background:#f2f2f4;cursor:pointer}#gyWm .whos .ch span.on{background:#111;color:#fff}#gyWm .whos .rc{display:flex;align-items:center;gap:6px;color:#666}#gyWm .whos .rc input{flex:1}
#gyWm .ic{cursor:pointer;width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#555}#gyWm .ic:hover{background:#e9e9ee}
#gyWm .bar{display:flex;gap:6px;padding:6px 10px;border-bottom:1px solid #f0f0f0}#gyWm .bar .url{flex:1;min-width:0;border:1px solid #e5e5e5;border-radius:9px;padding:5px 9px;font-size:12.5px}
#gyWm .bd{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:0}
#gyWm .bd webview{flex:1}
#gyWm .home{padding:12px}#gyWm .tip{font-size:12px;color:#888;line-height:1.6;padding:0 10px}#gyWm .home .tip{padding:0}
#gyWm .lbl{font-size:11.5px;color:#999;margin:12px 0 6px;font-weight:600;letter-spacing:.5px}
#gyWm .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px}
#gyWm .st{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;border-radius:12px;background:#f6f6f8;font-size:12px;cursor:pointer}#gyWm .st b{font-size:20px}#gyWm .st:hover{background:#ececf1}
#gyWm .man{display:flex;gap:6px;align-items:center;padding:0 10px}#gyWm .home .man{padding:0}#gyWm .man input{flex:1;min-width:0;border:1px solid #e5e5e5;border-radius:9px;padding:6px 9px;font-size:13px}
#gyWm .man span{padding:6px 10px;border-radius:9px;background:#111;color:#fff;font-size:12.5px;cursor:pointer;white-space:nowrap}#gyWm .man span.big{flex:1;text-align:center;padding:10px}
#gyWm .apkph{flex:1;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:13px}
#gyWm .ft{display:flex;align-items:center;gap:8px;padding:7px 10px;border-top:1px solid #f0f0f0;font-size:12.5px}
#gyWm .ft .np{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#555}#gyWm .ft .np em{font-style:normal;color:#999;margin-left:4px}
#gyWm .ft .ctl i{font-style:normal;cursor:pointer;padding:2px 5px}#gyWm .ft>b{cursor:pointer;color:#1d9bf0;white-space:nowrap}
#gyWm .rz{position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;touch-action:none;background:linear-gradient(135deg,transparent 55%,rgba(0,0,0,.25) 55%,rgba(0,0,0,.25) 62%,transparent 62%,transparent 72%,rgba(0,0,0,.25) 72%,rgba(0,0,0,.25) 79%,transparent 79%)}
#gyWmPill{position:fixed;right:14px;bottom:96px;z-index:9001;display:none;align-items:center;gap:8px;max-width:220px;padding:8px 14px 8px 10px;border-radius:999px;background:rgba(20,20,22,.86);color:#fff;font-size:12.5px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25)}
#gyWmPill span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#gyWmPill i{font-style:normal}
`;
    function boot() {
        if (!document.getElementById('gyWmCss')) { const st = document.createElement('style'); st.id = 'gyWmCss'; st.textContent = CSS; document.head.appendChild(st); }
        const loop = () => { hookCtx(); hookNudge(); hookNowInfo(); entries(); };
        loop(); setInterval(loop, 2500);
        setInterval(probe, 3000);
        window.addEventListener('resize', () => { if (W.open) place(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
