/* ===========================================================================
   js/59 —— 🌐 在线找资源：歌 / 片 / 书，不用自己一个个上传
   ---------------------------------------------------------------------------
   音乐盒、一起看电影、一起阅读以前只能自己上传文件。这里接几个**合法、免费、不用注册**的来源：
     🎵 歌：iTunes 官方试听（30 秒，正版歌几乎都能搜到）
            互联网档案馆（archive.org）里公版 / 开放授权的完整音频
     🎬 片：互联网档案馆里公版 / 开放授权的完整影片（老电影、纪录片、动画短片……）
     📖 书：维基文库（中文古籍、公版作品，按篇/按回）、古登堡计划（外文公版书）、互联网档案馆的文本
   受版权保护的完整歌曲和电影这里找不到——那些只能你自己有文件再导入。

   网络：先直连（exe / APK 里通常直接能用）；被浏览器的跨域拦了，就依次换几个免费代理再试
   （跟「联网探索」用的是同一批）。iTunes 那个走 JSONP，不怕跨域。

   入口：音乐盒管理里「🌐 在线找歌」、一起看电影顶栏「🌐 在线找片」、一起阅读顶栏「🌐 在线找书」。
   别的模块也能用 window.gyResSearch(kind, 关键词) 直接搜（比如 TA 分享歌给你时顺手找个试听）。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyResLoaded) return;
    window.__gyResLoaded = true;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (t, d) => { try { if (typeof showToast === 'function') showToast('', t, d || '', null, null, false); } catch (e) {} };
    const hasCJK = s => /[㐀-鿿]/.test(String(s || ''));
    const PROXIES = ['', 'https://api.allorigins.win/raw?url={U}', 'https://api.codetabs.com/v1/proxy?quest={U}', 'https://corsproxy.io/?{U}', 'https://api.cors.lol/?url={U}'];
    const TIMEOUT = 15000;

    async function tryFetch(url, asJson) {
        let last = null;
        for (const p of PROXIES) {
            const u = p ? p.replace('{U}', encodeURIComponent(url)).replace('{u}', url) : url;
            const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT) : null;
            try {
                const r = await fetch(u, ctl ? { signal: ctl.signal } : {});
                if (!r.ok) throw new Error('HTTP ' + r.status);
                const out = asJson ? await r.json() : await r.text();
                if (timer) clearTimeout(timer);
                return out;
            } catch (e) { last = e; if (timer) clearTimeout(timer); }
        }
        throw last || new Error('连不上');
    }
    window.__gyResFetch = tryFetch;
    let jsonpSeq = 0;
    function jsonp(url) {
        return new Promise((resolve, reject) => {
            const cb = '__gyResCb' + (++jsonpSeq) + Date.now().toString(36);
            const s = document.createElement('script');
            const timer = setTimeout(() => { cleanup(); reject(new Error('超时')); }, TIMEOUT);
            function cleanup() { clearTimeout(timer); try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); }
            window[cb] = data => { cleanup(); resolve(data); };
            s.onerror = () => { cleanup(); reject(new Error('加载失败')); };
            s.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'callback=' + cb;
            document.head.appendChild(s);
        });
    }
    window.__gyResJsonp = jsonp;

    /* ---------- 各个来源 ---------- */
    const IA = 'https://archive.org';
    async function iaSearch(q, extra, rows) {
        const query = `(${q}) AND ${extra}`;
        const url = `${IA}/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&rows=${rows || 12}&page=1&output=json&sort[]=downloads+desc`;
        const d = await tryFetch(url, true);
        return ((d && d.response && d.response.docs) || []).map(x => ({
            src: 'ia', id: x.identifier, title: Array.isArray(x.title) ? x.title[0] : (x.title || x.identifier),
            artist: Array.isArray(x.creator) ? x.creator[0] : (x.creator || ''), year: x.year || '',
            page: `${IA}/details/${x.identifier}`
        }));
    }
    // 互联网档案馆的条目要再查一次文件清单，才知道能直接放的文件叫什么
    async function iaFile(id, re) {
        const d = await tryFetch(`${IA}/metadata/${encodeURIComponent(id)}`, true);
        const files = (d && d.files) || [];
        const f = files.find(x => re.test(x.name || '') && !/_sample|\.ia\./i.test(x.name || '')) || files.find(x => re.test(x.name || ''));
        return f ? `${IA}/download/${encodeURIComponent(id)}/${String(f.name).split('/').map(encodeURIComponent).join('/')}` : '';
    }

    const SOURCES = {
        music: [
            { k: 'itunes', name: 'iTunes 试听（30 秒）', run: async q => {
                const d = await jsonp(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=15&country=${hasCJK(q) ? 'CN' : 'US'}`);
                return ((d && d.results) || []).filter(x => x.previewUrl).map(x => ({
                    src: 'itunes', title: x.trackName, artist: x.artistName, cover: (x.artworkUrl100 || '').replace('100x100', '300x300'),
                    url: x.previewUrl, note: '30 秒试听', page: x.trackViewUrl || ''
                }));
            } },
            { k: 'ia', name: '互联网档案馆（完整，公版 / 开放授权）', run: q => iaSearch(q, 'mediatype:audio', 12) }
        ],
        film: [
            { k: 'ia', name: '互联网档案馆（完整，公版 / 开放授权）', run: q => iaSearch(q, 'mediatype:movies', 15) }
        ],
        book: [
            { k: 'wikisource', name: '维基文库（中文古籍 / 公版，按篇）', run: async q => {
                const d = await tryFetch(`https://zh.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=15&format=json&origin=*`, true);
                return ((d && d.query && d.query.search) || []).map(x => ({ src: 'wikisource', title: x.title, artist: '', note: String(x.snippet || '').replace(/<[^>]+>/g, '').slice(0, 60),
                    page: 'https://zh.wikisource.org/wiki/' + encodeURIComponent(x.title) }));
            } },
            { k: 'gutenberg', name: '古登堡计划（外文公版书）', run: async q => {
                const d = await tryFetch(`https://gutendex.com/books?search=${encodeURIComponent(q)}`, true);
                return ((d && d.results) || []).slice(0, 15).map(x => {
                    const fm = x.formats || {};
                    const txt = fm['text/plain; charset=utf-8'] || fm['text/plain; charset=us-ascii'] || fm['text/plain'] || '';
                    return txt ? { src: 'gutenberg', title: x.title, artist: (x.authors && x.authors[0] && x.authors[0].name) || '', url: txt, note: (x.languages || []).join('/') } : null;
                }).filter(Boolean);
            } },
            { k: 'ia', name: '互联网档案馆（文本）', run: q => iaSearch(q, 'mediatype:texts', 12) }
        ]
    };

    // 一条结果真正能用的地址（互联网档案馆 / 维基文库要现取）
    async function resolve(kind, it) {
        if (it.url && it.src !== 'wikisource') return it.url;
        if (it.src === 'ia') {
            it.url = await iaFile(it.id, kind === 'music' ? /\.mp3$/i : kind === 'film' ? /\.mp4$/i : /_djvu\.txt$|\.txt$/i);
            return it.url;
        }
        return it.url || '';
    }
    async function bookText(it) {
        if (it.src === 'wikisource') {
            const d = await tryFetch(`https://zh.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(it.title)}&prop=text&format=json&origin=*&disabletoc=1`, true);
            const html = (d && d.parse && d.parse.text && (d.parse.text['*'] || d.parse.text)) || '';
            const div = document.createElement('div'); div.innerHTML = String(html);
            div.querySelectorAll('style,script,.mw-editsection,.reference,sup,table.header_notes,.ws-noexport').forEach(x => x.remove());
            return (div.innerText || div.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
        }
        const u = await resolve('book', it);
        if (!u) return '';
        let t = await tryFetch(u, false);
        // 古登堡的书前后有一大段版权说明，去掉
        const a = t.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
        const b = t.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i);
        if (a !== -1) t = t.slice(t.indexOf('\n', a) + 1, b !== -1 ? b : undefined);
        return t.trim();
    }

    // 给别的模块用：搜一下，返回结果（每个来源各自的，挨个试，出错的跳过）
    window.gyResSearch = async function (kind, q, opts) {
        const o = opts || {};
        const out = [];
        for (const s of (SOURCES[kind] || [])) {
            if (o.only && o.only !== s.k) continue;
            try { (await s.run(q)).forEach(x => out.push(Object.assign({ from: s.name }, x))); } catch (e) { console.warn('[在线找资源] ' + s.name + ' 没搜到：', e && e.message); }
            if (o.limit && out.length >= o.limit) break;
        }
        return o.limit ? out.slice(0, o.limit) : out;
    };
    window.gyResResolve = resolve;
    window.gyResBookText = bookText;

    /* ---------- 加进去 ---------- */
    async function addItem(kind, it, openNow) {
        if (kind === 'music') {
            const u = await resolve('music', it);
            if (!u) return toast('这条放不了', '没找到能直接播放的音频文件');
            if (typeof window.gymAddTrack !== 'function') return toast('音乐盒没加载', '');
            const tid = window.gymAddTrack({ title: it.title, artist: it.artist, cover: it.cover, src: u, note: it.note || '' }, '🌐 在线找的');
            toast('🎵 加进音乐盒了', `《${it.title}》${it.note ? '（' + it.note + '）' : ''}，在歌单「🌐 在线找的」里`);
            return tid ? { trackId: tid } : null;
        } else if (kind === 'film') {
            const u = await resolve('film', it);
            if (!u) return toast('这部放不了', '没找到能直接播放的 mp4');
            let f = null;
            if (openNow && typeof window.fbOpenUrl === 'function') {
                closeModal();
                try { if (typeof switchMainView === 'function') switchMainView('watchTogether'); } catch (e) {}
                f = await window.fbOpenUrl(u, it.title, { note: it.from, cover: it.cover });
            } else if (typeof window.fbAddUrl === 'function') {
                f = await window.fbAddUrl(u, it.title, { note: it.from, cover: it.cover });
                toast('🎬 加进片库了', `《${it.title}》，在片库里点「接着看」就能放`);
            }
            return f ? { filmId: f.id } : null;
        } else if (kind === 'book') {
            toast('📖 正在把书拿下来…', it.title);
            const text = await bookText(it);
            if (!text || text.length < 50) return toast('这本拿不下来', '正文是空的或者被拦了，换一条试试');
            const b = typeof window.rtImportText === 'function' ? await window.rtImportText(it.title, text, { src: it.src }) : null;
            if (!b) return toast('这本分不出章节', '');
            toast('📖 放上书架了', `《${b.title}》，${b.chapters.length} 部分`);
            if (openNow) {
                closeModal();
                try { if (typeof window.rtOpenOverlay === 'function') window.rtOpenOverlay(); if (typeof window.rtOpenBook === 'function') window.rtOpenBook(b.id); } catch (e) {}
            }
            return { bookId: b.id };
        }
        return null;
    }
    // 给别的模块用：把一条搜索结果导进对应功能。返回 {trackId} / {filmId} / {bookId}，导不进去返回 null / undefined
    window.gyResAddItem = addItem;

    /* ---------- 弹窗 ---------- */
    const KIND = {
        music: { ico: '🎵', name: '找歌', ph: '歌名 / 歌手，比如：晴天 周杰伦', add: '＋ 放进音乐盒' },
        film: { ico: '🎬', name: '找片', ph: '片名 / 类型，比如：Chaplin、纪录片、动画', add: '＋ 放进片库', open: '▶ 现在看' },
        book: { ico: '📖', name: '找书', ph: '书名 / 作者，比如：红楼梦 第一回、诗经、Pride and Prejudice', add: '＋ 放上书架', open: '📖 现在读' }
    };
    let CUR = { kind: 'music', q: '', items: [], busy: false };
    function closeModal() { const m = document.getElementById('gyResModal'); if (m) m.remove(); try { const a = document.getElementById('gyResAudio'); if (a) a.pause(); } catch (e) {} }
    window.gyResClose = closeModal;
    function paint() {
        let m = document.getElementById('gyResModal');
        if (!m) {
            m = document.createElement('div'); m.id = 'gyResModal'; m.className = 'modal-overlay';
            m.style.cssText = 'display:flex;z-index:99990;';
            m.addEventListener('click', ev => { if (ev.target === m) closeModal(); });
            document.body.appendChild(m);
        }
        const K = KIND[CUR.kind];
        m.innerHTML = `<div class="modal-box gyres-box">
            <div class="gyres-tabs">${Object.entries(KIND).map(([k, v]) => `<button type="button" class="${k === CUR.kind ? 'on' : ''}" onclick="gyResOpen('${k}')">${v.ico} ${v.name}</button>`).join('')}
              <button type="button" class="gyres-x" onclick="gyResClose()">✕</button></div>
            <div class="gyres-row"><input id="gyResQ" type="search" placeholder="${esc(K.ph)}" value="${esc(CUR.q)}" onkeydown="if(event.key==='Enter') gyResGo()">
              <button type="button" onclick="gyResGo()" ${CUR.busy ? 'disabled' : ''}>${CUR.busy ? '在找…' : '🔍 找'}</button></div>
            <div class="gyres-note">只找合法免费的：${(SOURCES[CUR.kind] || []).map(s => s.name).join('、')}。受版权保护的完整歌曲 / 电影这里找不到，那些还是要你自己有文件再导入。</div>
            <audio id="gyResAudio" style="display:none"></audio>
            <div class="gyres-list">${CUR.items.length ? CUR.items.map((it, i) => `
              <div class="gyres-it">
                ${it.cover ? `<img src="${esc(it.cover)}" alt="">` : `<div class="gyres-ph">${K.ico}</div>`}
                <div class="gyres-t"><b>${esc(it.title)}</b><span>${esc([it.artist, it.year].filter(Boolean).join(' · '))}</span><em>${esc(it.from || '')}${it.note ? ' · ' + esc(it.note) : ''}</em></div>
                <div class="gyres-b">
                  ${CUR.kind === 'music' ? `<button type="button" onclick="gyResPlay(${i}, this)">▶ 试听</button>` : ''}
                  ${K.open ? `<button type="button" onclick="gyResAdd(${i}, true, this)">${K.open}</button>` : ''}
                  <button type="button" class="solid" onclick="gyResAdd(${i}, false, this)">${K.add}</button>
                </div>
              </div>`).join('') : `<div class="gyres-empty">${CUR.busy ? '正在找…' : (CUR.q ? '没找到。换个说法，或者换个关键词试试（外文资源用英文搜更准）。' : '输入关键词找找看。')}</div>`}</div>
          </div>`;
        const inp = m.querySelector('#gyResQ'); if (inp && !CUR.busy) setTimeout(() => { try { inp.focus(); } catch (e) {} }, 30);
    }
    window.gyResOpen = function (kind, q) {
        if (kind && KIND[kind] && kind !== CUR.kind) CUR = { kind, q: '', items: [], busy: false };
        if (q != null) CUR.q = q;
        paint();
        if (q) window.gyResGo();
    };
    window.gyResGo = async function () {
        const inp = document.getElementById('gyResQ');
        const q = (inp && inp.value || CUR.q || '').trim();
        if (!q || CUR.busy) return;
        CUR.q = q; CUR.busy = true; CUR.items = []; paint();
        try { CUR.items = await window.gyResSearch(CUR.kind, q); } catch (e) {}
        CUR.busy = false; paint();
    };
    window.gyResPlay = async function (i, btn) {
        const it = CUR.items[i]; if (!it) return;
        const a = document.getElementById('gyResAudio'); if (!a) return;
        if (btn) btn.textContent = '…';
        try {
            const u = await resolve('music', it);
            if (!u) { if (btn) btn.textContent = '放不了'; return; }
            if (a.src === u && !a.paused) { a.pause(); if (btn) btn.textContent = '▶ 试听'; return; }
            a.src = u; await a.play();
            document.querySelectorAll('#gyResModal .gyres-b button').forEach(b => { if (/⏸/.test(b.textContent)) b.textContent = '▶ 试听'; });
            if (btn) btn.textContent = '⏸ 停';
        } catch (e) { if (btn) btn.textContent = '放不了'; }
    };
    window.gyResAdd = async function (i, openNow, btn) {
        const it = CUR.items[i]; if (!it) return;
        const old = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = '…'; }
        try { await addItem(CUR.kind, it, openNow); if (btn && !openNow) btn.textContent = '✓ 加好了'; }
        catch (e) { toast('没加成', String(e && e.message || e)); if (btn) { btn.disabled = false; btn.textContent = old; } }
    };

    try {
        const st = document.createElement('style');
        st.textContent = `
.gyres-box{width:min(560px,94vw);max-height:86vh;display:flex;flex-direction:column;gap:10px;padding:16px;}
.gyres-tabs{display:flex;gap:6px;align-items:center;}
.gyres-tabs button{width:auto;margin:0;padding:7px 14px;border-radius:999px;border:1px solid rgba(139,152,165,.4);background:transparent;color:inherit;cursor:pointer;font-size:13.5px;}
.gyres-tabs button.on{background:var(--gy-accent,#1d9bf0);border-color:var(--gy-accent,#1d9bf0);color:#fff;}
.gyres-tabs .gyres-x{margin-left:auto;border:none;font-size:16px;padding:4px 10px;}
.gyres-row{display:flex;gap:8px;}
.gyres-row input{flex:1;min-width:0;padding:10px 12px;border-radius:10px;border:1px solid var(--gy-accent,#1d9bf0);background:transparent;color:inherit;font-size:14px;}
.gyres-row button{width:auto;margin:0;padding:0 16px;border-radius:10px;border:none;background:var(--gy-accent,#1d9bf0);color:#fff;cursor:pointer;}
.gyres-note{font-size:11.5px;color:#8b98a5;line-height:1.6;}
.gyres-list{overflow-y:auto;flex:1;min-height:120px;display:flex;flex-direction:column;gap:6px;}
.gyres-it{display:flex;gap:10px;align-items:center;padding:8px;border-radius:12px;border:1px solid rgba(139,152,165,.25);}
.gyres-it img,.gyres-ph{width:48px;height:48px;border-radius:8px;object-fit:cover;flex:none;display:grid;place-items:center;background:rgba(139,152,165,.12);font-size:22px;}
.gyres-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}
.gyres-t b{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gyres-t span{font-size:12px;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gyres-t em{font-style:normal;font-size:11px;opacity:.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gyres-b{display:flex;flex-direction:column;gap:4px;flex:none;}
.gyres-b button{width:auto;margin:0;padding:5px 10px;border-radius:999px;border:1px solid rgba(139,152,165,.5);background:transparent;color:inherit;font-size:12px;cursor:pointer;white-space:nowrap;}
.gyres-b button.solid{background:var(--gy-accent,#1d9bf0);border-color:var(--gy-accent,#1d9bf0);color:#fff;}
.gyres-empty{font-size:13px;color:#8b98a5;padding:20px 4px;text-align:center;}
@media (max-width:480px){.gyres-it{flex-wrap:wrap;}.gyres-b{flex-direction:row;width:100%;justify-content:flex-end;}}
`;
        document.head.appendChild(st);
    } catch (e) {}
})();
