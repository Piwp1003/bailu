/* =====================================================================
   js/23 —— 🗺️ 行程与天气（势力地图）
   原来是插件（白露行程与天气插件.json），v97 起内置。装过旧插件的可以在「🔌 插件」页删掉。

   ⚠️ 每个各自一个 IIFE，别合并：它们之间有同名的顶层符号。
   ⚠️ 原插件的 `code` 钩子（每次拼 prompt 都跑）内置之后改成统一由
      js/06 的 getBoxPrompt() 调用各自暴露的 window.__gyXxxCtxFor；
      关系账本的 `onResponse` 钩子改由 js/02 的 runBoxResponseHooks() 调用。
   ===================================================================== */

// ============ 行程与天气 ============
/* ===========================================================================
   🗺️ 白露行程与天气 —— 势力地图 + 角色行程 + 天气
   ---------------------------------------------------------------------------
   地图三种形式，每个势力自己选：
     · 底图模式 image —— 你传一张图当底图，在上面点一下就加个地点
     · 自由摆点 free  —— 空白画布上拖出地点，点之间可以连线（走路 10 分钟）
     · 纯列表   list  —— 不要图，就是一份地点清单
   角色怎么移动，四种都做，各自独立开关：
     · 跟日程联动：地点清单会进日程生成的 prompt，日程里写到哪儿就自动挪过去
     · 自主模式里多一个「去某个地方」
     · 两个有关系的角色在同一个地点 → 触发小剧场
     · 手动拖：地图上直接把头像拖到别的点
   天气：真实（Open-Meteo，免费不用 key）+ 虚构（AI 按世界观编），可以同时看
     你那边和角色那边的天气；一个小弹窗，下面选角色让 TA 说一句提醒。
   ⚠️ 自动定位在 file:// 下会被浏览器禁用（要求 HTTPS 或 localhost），
      所以手填城市是主路，自动定位只是个"试试看"的按钮，失败会说清楚原因。
   =========================================================================== */
(function () {
    if (window.__gyMapLoaded) { try { gymapOpen(); } catch (e) {} return; }
    window.__gyMapLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyMapBox', 'maps')          // 带兜底的存档口：localforage 用不了就退 localStorage，两条都断才报错
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyMapBox', storeName: 'maps' })
            : null);
    const KEY = 'gyMap_state';

    let S = {
        // 🗺️ 一个势力可以有好几张地图：{ 势力名: { cur: 0, list: [ 地图 ] } }
        //    一张地图 = { id, name, mode:'image'|'free'|'list', bg, share:[别的势力名] 或 'all',
        //                spots:[{id,name,desc,cat,x,y}] }
        mapSets: {},
        cats: null,          // 地点分类，null＝还没初始化，load 完给一份默认的
        catFilter: '',       // 地图上按分类筛选，''＝全部
        maps: {},            // ⚠️ 旧版存档结构，只用来迁移，迁完就空着
        charLoc: {},         // { 角色id: 地点id }
        move: { bySchedule: true, byAutonomy: true, meetTheater: false, manual: true },
        user: { city: '', lat: null, lon: null, tz: '' },
        weather: {
            mode: 'both',    // real 只看真实 | fiction 只看虚构 | both 都看
            real: null,      // {code,tmax,tmin,tnow,day}
            fic: {},         // { 势力名: {text, day} } —— AI 按世界观编的
            remind: true,    // 角色主动提醒
            lastRemindDay: '',
            lastFetchDay: ''
        },
        curFaction: '',
        // 🪟 悬浮窗：跟音乐盒同一套视觉（白圆角卡 + 柔和投影 + 细线图标 + 黑色圆主键）
        // src：这个悬浮窗显示谁那边的天气。'me' = 你自己（真实天气），
        //      填角色 id 就是看那个角色所在地的天气（按 TA 站的点走，不是"属于的第一个势力"）。
        //      以前写死只显示你自己的，角色在下雪你这儿大晴天，完全对不上。
        // size：拖边缘改过的大小（{w,h}）。没改过就是 null，走皮肤自带的尺寸。
        float: { on: false, skin: 'w-card', pos: null, faction: '', src: 'me', size: null },
        // 🤝 约着一起去某个地方
        date: {
            decide: 'ask',   // me 我说了算 | char TA说了算 | ask 每次问我
            keep: 0,         // 记录保留多少条，0 ＝ 不限
            logs: []         // [{id,charId,charName,spot,faction,by:'me'|'char',mins,act,line,reply,ok,at}]
        }
    };
    let dragSpot = null, dragChar = null, editingSpot = null;

    const DEF_CATS = [
        { id: 'work', name: '工作', icon: '💼' },
        { id: 'life', name: '生活', icon: '🏠' },
        { id: 'eat', name: '吃饭', icon: '🍜' },
        { id: 'fun', name: '消遣', icon: '🎐' },
        { id: 'quiet', name: '躲清静', icon: '🌙' },
        { id: 'meet', name: '碰面', icon: '🤝' }
    ];
    const cats = () => (Array.isArray(S.cats) && S.cats.length) ? S.cats : DEF_CATS;
    const catOf = id => cats().find(c => c.id === id) || null;
    const catIcon = id => (catOf(id) || {}).icon || '📍';

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const today = () => new Date().toDateString();
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const factions = () => (typeof characterGroups !== 'undefined' ? characterGroups : []).filter(Boolean);

    async function save() { if (LF) { try { await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) { console.warn('[行程] 存档失败', e); } } }
    async function load() {
        if (!LF) { migrate(); return; }
        try { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } catch (e) {}
        migrate();
    }

    const uid = p => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    function newMap(name) { return { id: uid('m'), name: name || '新地图', mode: 'list', bg: '', share: [], spots: [] }; }
    function setOf(f) {
        if (!S.mapSets[f]) S.mapSets[f] = { cur: 0, list: [] };
        const st = S.mapSets[f];
        if (!Array.isArray(st.list)) st.list = [];
        if (!st.list.length) st.list.push(newMap('主地图'));
        if (!(st.cur >= 0 && st.cur < st.list.length)) st.cur = 0;
        return st;
    }
    const mapsOf = f => setOf(f).list;
    function mapOf(f) { const st = setOf(f); return st.list[st.cur]; }
    function mapById(id) {
        for (const f of Object.keys(S.mapSets)) {
            const m = (S.mapSets[f].list || []).find(x => x.id === id);
            if (m) return { f, m };
        }
        return null;
    }
    // 这张图哪些势力能用：自己的势力 + 共享给谁；share:'all' ＝ 全世界通用
    function mapUsers(f, m) {
        if (m.share === 'all') return factions().slice();
        return [f].concat(Array.isArray(m.share) ? m.share : []);
    }
    function allSpots() {
        const out = [];
        Object.keys(S.mapSets).forEach(f => (S.mapSets[f].list || []).forEach(m => {
            const use = mapUsers(f, m);
            (m.spots || []).forEach(sp => out.push(Object.assign({ faction: f, mapId: m.id, mapName: m.name, use }, sp)));
        }));
        return out;
    }
    // 这个角色能不能去这个点：TA 的势力里有一个在这张图的"能用"名单里就行
    function spotOpenTo(sp, c) {
        const fs = facOf(c);
        return (sp.use || [sp.faction]).some(x => fs.indexOf(x) >= 0);
    }
    const spotsFor = c => allSpots().filter(sp => spotOpenTo(sp, c));

    // 旧存档：{势力:{mode,bg,spots}} → 新的多地图结构
    function migrate() {
        if (!S.mapSets || typeof S.mapSets !== 'object') S.mapSets = {};
        const old = S.maps;
        if (old && typeof old === 'object' && Object.keys(old).length && !Object.keys(S.mapSets).length) {
            Object.keys(old).forEach(f => {
                const o = old[f] || {};
                S.mapSets[f] = { cur: 0, list: [{ id: uid('m'), name: '主地图', mode: o.mode || 'list',
                                                  bg: o.bg || '', share: [], spots: (o.spots || []).map(sp => Object.assign({ cat: '' }, sp)) }] };
            });
            S.maps = {};
            console.info('[行程] 旧地图已经迁到"一个势力可以有多张图"的新结构');
        }
        if (!Array.isArray(S.cats) || !S.cats.length) S.cats = DEF_CATS.map(c => Object.assign({}, c));
        if (!S.date) S.date = { decide: 'ask', keep: 0, logs: [] };
        if (!Array.isArray(S.date.logs)) S.date.logs = [];
    }
    const spotById = id => allSpots().find(s => s.id === id) || null;
    function charsAt(spotId) {
        return chars().filter(c => S.charLoc[String(c.id)] === spotId);
    }
    // 角色属于哪些势力（复用主程序的多势力逻辑）
    function facOf(c) {
        if (typeof getCharFactions === 'function') return getCharFactions(c);
        return c.group ? [c.group] : [];
    }

    // ---------- 天气 ----------
    const WCODE = {
        0: ['晴', '☀️'], 1: ['大致晴朗', '🌤️'], 2: ['多云', '⛅'], 3: ['阴', '☁️'],
        45: ['雾', '🌫️'], 48: ['雾凇', '🌫️'], 51: ['毛毛雨', '🌦️'], 53: ['小雨', '🌦️'], 55: ['中雨', '🌧️'],
        61: ['小雨', '🌦️'], 63: ['中雨', '🌧️'], 65: ['大雨', '🌧️'], 66: ['冻雨', '🌧️'], 67: ['冻雨', '🌧️'],
        71: ['小雪', '🌨️'], 73: ['中雪', '❄️'], 75: ['大雪', '❄️'], 77: ['米雪', '❄️'],
        80: ['阵雨', '🌦️'], 81: ['阵雨', '🌧️'], 82: ['暴雨', '⛈️'], 85: ['阵雪', '🌨️'], 86: ['暴雪', '❄️'],
        95: ['雷阵雨', '⛈️'], 96: ['雷阵雨伴冰雹', '⛈️'], 99: ['强雷暴', '⛈️']
    };
    const wDesc = c => (WCODE[c] || ['未知', '🌡️'])[0];
    const wIcon = c => (WCODE[c] || ['未知', '🌡️'])[1];

    // ---------- 悬浮窗用的细线图标（跟音乐盒一套：stroke-width 2，单色，跟随文字颜色）----------
    const SV = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}${extra || ''}</svg>`;
    const CLOUD = '<path d="M7 18.5h9.2a3.8 3.8 0 0 0 .4-7.6 5.3 5.3 0 0 0-10.2-.7A3.75 3.75 0 0 0 7 18.5Z"/>';
    const FSVG = {
        sun: SV('<circle cx="12" cy="12" r="4.3"/><path d="M12 2.2v2M12 19.8v2M4.4 4.4l1.4 1.4M18.2 18.2l1.4 1.4M2.2 12h2M19.8 12h2M4.4 19.6l1.4-1.4M18.2 5.8l1.4-1.4"/>'),
        part: SV('<circle cx="8.5" cy="7.5" r="3"/><path d="M8.5 1.8v1.5M3.3 7.5H1.8M4.5 3.5 3.5 2.5M13.5 3.5l1-1"/>' + CLOUD),
        cloud: SV(CLOUD),
        rain: SV('<path d="M7 15.5h9.2a3.8 3.8 0 0 0 .4-7.6 5.3 5.3 0 0 0-10.2-.7A3.75 3.75 0 0 0 7 15.5Z"/><path d="M9 18.4l-.8 2.2M13 18.4l-.8 2.2M17 18.4l-.8 2.2"/>'),
        snow: SV('<path d="M7 15.5h9.2a3.8 3.8 0 0 0 .4-7.6 5.3 5.3 0 0 0-10.2-.7A3.75 3.75 0 0 0 7 15.5Z"/><path d="M9 19h.01M13 19h.01M17 19h.01M11 21.4h.01M15 21.4h.01"/>'),
        storm: SV('<path d="M7 14.5h9.2a3.8 3.8 0 0 0 .4-7.6 5.3 5.3 0 0 0-10.2-.7A3.75 3.75 0 0 0 7 14.5Z"/><path d="M13.4 16.6 10 20h3.4L11.4 22.6"/>'),
        fog: SV('<path d="M4 8.5h16M6 12.5h13M4 16.5h16M8 20.5h9"/>'),
        na: SV('<path d="M10 13.8V5.2a2 2 0 1 1 4 0v8.6a4 4 0 1 1-4 0Z"/><circle cx="12" cy="17.6" r="1.2" fill="currentColor" stroke="none"/>')
    };
    const FI = {
        say: SV('<path d="M20.5 12.2a7.7 7.7 0 0 1-8.3 7.7c-.7 0-1.4-.1-2-.3L4.5 21l1.5-4.2a7.4 7.4 0 0 1-1.5-4.6 7.7 7.7 0 0 1 8-7.7 7.7 7.7 0 0 1 8 7.7Z"/>'),
        refresh: SV('<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.6 4.2v4.4h-4.4"/>'),
        map: SV('<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>'),
        skin: SV('<rect x="3.2" y="4.2" width="17.6" height="15.6" rx="3"/><path d="M3.2 9.6h17.6M9 9.6v10.2"/>'),
        list: SV('<path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01"/>'),
        who: SV('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M17 10.5h4M19 8.5v4"/>')
    };
    function fIcoKey(code) {
        if (code == null) return 'na';
        if (code === 0) return 'sun';
        if (code === 1 || code === 2) return 'part';
        if (code === 3) return 'cloud';
        if (code === 45 || code === 48) return 'fog';
        if ([71, 73, 75, 77, 85, 86].indexOf(code) >= 0) return 'snow';
        if ([82, 95, 96, 99].indexOf(code) >= 0) return 'storm';
        return 'rain';
    }

    const fetcher = (u) => (typeof smartFetch === 'function') ? smartFetch(u) : fetch(u);

    // 只读：你这边的天气（小手机的「天气」小组件用）。没设城市 / 还没拉到就是 null
    window.gymapWeatherInfo = function () {
        try {
            const r = S.weather && S.weather.real; if (!r) return null;
            return { city: S.user.city || '', now: r.tnow, max: r.tmax, min: r.tmin, rain: r.rain, desc: wDesc(r.code), icon: FSVG[fIcoKey(r.code)] };
        } catch (e) { return null; }
    };

    // 城市名 → 经纬度
    async function geocode(name) {
        const u = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(name) + '&count=5&language=zh&format=json';
        const res = await fetcher(u);
        const j = await res.json();
        return (j && j.results) || [];
    }
    // 经纬度 → 今天的天气
    async function fetchWeather(lat, lon) {
        const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon
            + '&current=temperature_2m,weather_code'
            + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
            + '&timezone=auto&forecast_days=1';
        const res = await fetcher(u);
        const j = await res.json();
        if (!j || !j.daily) throw new Error('返回的数据看不懂');
        return {
            code: j.daily.weather_code[0],
            tmax: Math.round(j.daily.temperature_2m_max[0]),
            tmin: Math.round(j.daily.temperature_2m_min[0]),
            tnow: j.current ? Math.round(j.current.temperature_2m) : null,
            rain: j.daily.precipitation_probability_max ? j.daily.precipitation_probability_max[0] : null,
            day: today()
        };
    }

    window.gymapSearchCity = async function () {
        const q = (document.getElementById('gymapCity') || {}).value || '';
        const box = document.getElementById('gymapCityHits');
        if (!q.trim()) return;
        if (box) box.innerHTML = '<div class="gymap-hint">搜索中…</div>';
        try {
            const list = await geocode(q.trim());
            if (!list.length) { if (box) box.innerHTML = '<div class="gymap-hint">没搜到这个地方，换个写法试试（比如只填「杭州」）。</div>'; return; }
            if (box) box.innerHTML = list.map(r =>
                `<button class="gymap-hit" onclick="gymapPickCity(${r.latitude},${r.longitude},'${esc(r.name)}','${esc([r.admin1, r.country].filter(Boolean).join(' · '))}')">
                    <b>${esc(r.name)}</b> <span>${esc([r.admin1, r.country].filter(Boolean).join(' · '))}</span></button>`).join('');
        } catch (e) {
            if (box) box.innerHTML = `<div class="gymap-hint" style="color:#f91880">搜不了：${esc(e.message || e)}<br>
                网页版直接双击 index.html 打开时，浏览器可能会拦掉这个跨域请求；打包成 APK 后走原生通道就没这个问题。
                实在不行也可以只用「虚构天气」，那个不联网。</div>`;
        }
    };
    window.gymapPickCity = async function (lat, lon, name, sub) {
        S.user = { city: name + (sub ? '（' + sub + '）' : ''), lat, lon, tz: '' };
        S.weather.real = null; S.weather.lastFetchDay = '';
        await save();
        renderPanel();
        gymapRefreshWeather();
    };
    // file:// 下浏览器不给定位权限，这里只是"试一下"，失败要说清楚为什么
    window.gymapAutoLocate = function () {
        const box = document.getElementById('gymapCityHits');
        const proto = location.protocol;
        if (!navigator.geolocation) {
            if (box) box.innerHTML = '<div class="gymap-hint" style="color:#f91880">这个浏览器没有定位功能，手填城市吧。</div>';
            return;
        }
        if (box) box.innerHTML = '<div class="gymap-hint">正在问浏览器要位置…（弹权限框的话点允许）</div>';
        navigator.geolocation.getCurrentPosition(async pos => {
            const { latitude, longitude } = pos.coords;
            S.user = { city: `定位到的位置（${latitude.toFixed(2)}, ${longitude.toFixed(2)}）`, lat: latitude, lon: longitude, tz: '' };
            S.weather.real = null; S.weather.lastFetchDay = '';
            await save(); renderPanel(); gymapRefreshWeather();
        }, err => {
            const why = proto === 'file:'
                ? '你现在是用 file:// 直接打开网页的，浏览器在这个协议下<b>一律禁用定位</b>（规范要求 HTTPS 或 localhost），这不是权限没给，是根本不让问。'
                : (err.code === 1 ? '你拒绝了定位权限。' : err.code === 2 ? '拿不到位置（可能没开定位服务）。' : '等太久超时了。');
            if (box) box.innerHTML = `<div class="gymap-hint" style="color:#f91880">自动定位没成功：${why}<br>直接在上面填城市名就行，效果一样。</div>`;
        }, { timeout: 8000 });
    };

    window.gymapRefreshWeather = async function () {
        if (!S.user.lat && S.user.lat !== 0) return;
        const st = document.getElementById('gymapWStatus');
        if (st) st.innerText = '正在拿天气…';
        try {
            S.weather.real = await fetchWeather(S.user.lat, S.user.lon);
            S.weather.lastFetchDay = today();
            await save();
            renderPanel(); renderWeatherPop();
            if (st) st.innerText = '';
        } catch (e) {
            if (st) st.innerHTML = `<span style="color:#f91880">拿不到天气：${esc(e.message || e)}</span>`;
        }
    };

    // 虚构天气：让 AI 按这个势力的世界观编今天的天气
    window.gymapGenFicWeather = async function (fac) {
        if (typeof getApiConfig !== 'function') return;
        const api = getApiConfig(true);
        if (!api || !api.key) return alert('还没配 API Key。');
        const someone = chars().find(c => facOf(c).includes(fac));
        const spots = (mapOf(fac).spots || []).map(s => s.name).join('、');
        const st = document.getElementById('gymapWStatus');
        if (st) st.innerText = '正在编天气…';
        try {
            const ask = `现在是 ${new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}。
请按这个世界的设定，写一句「${fac}」今天的天气。${spots ? `这一带有这些地方：${spots}。` : ''}
要求：一句话 25 字以内，像天气预报但带点这个世界的味道；只输出这句话，不要解释。`;
            const messages = someone && typeof buildBasePrompt === 'function'
                ? buildStructuredMessages(buildBasePrompt(someone, true, ''), [], ask)
                : buildStructuredMessages('你是一个虚构世界的天气播报。', [], ask);
            const data = await callChatCompletionAPI(api, messages);
            const txt = (data.choices?.[0]?.message?.content || '').trim();
            if (txt) { S.weather.fic[fac] = { text: txt.slice(0, 80), day: today() }; await save(); renderPanel(); renderWeatherPop(); }
            if (st) st.innerText = '';
        } catch (e) { if (st) st.innerHTML = `<span style="color:#f91880">${esc(e.message || e)}</span>`; }
    };

    // 供 prompt 钩子用：角色会知道自己在哪、那儿什么天气、你那儿什么天气
    window.__gyMapCtxFor = function (charId) {
        try {
            let out = '';
            const c = chars().find(x => String(x.id) === String(charId));
            if (!c) return '';
            const sp = spotById(S.charLoc[String(c.id)]);
            if (sp) out += `\n【你现在在哪】${sp.name}${sp.desc ? '（' + sp.desc + '）' : ''}${sp.faction ? '，属于' + sp.faction : ''}。`;
            const myFacs = facOf(c);
            const near = spotsFor(c);
            if (near.length) out += `\n【你常去的地方】${near.map(s => s.name).join('、')}。`;
            // 同一个地点还有谁
            if (sp) {
                const others = charsAt(sp.id).filter(x => String(x.id) !== String(c.id)).map(x => x.name);
                if (others.length) out += `\n【此刻和你在同一个地方的】${others.join('、')}。`;
            }
            // 天气
            const w = S.weather;
            if ((w.mode === 'real' || w.mode === 'both') && w.real && S.user.city) {
                out += `\n【${(typeof userDisplayName === 'function') ? userDisplayName(c) : '对方'}那边今天的天气】${S.user.city}：${wDesc(w.real.code)}，${w.real.tmin}~${w.real.tmax}℃${w.real.rain != null ? `，降水概率 ${w.real.rain}%` : ''}。`;
            }
            if (w.mode === 'real' || w.mode === 'both') { /* 真实天气已给 */ }
            if ((w.mode === 'fiction' || w.mode === 'both') && myFacs.length) {
                const f = myFacs.find(f => w.fic[f] && w.fic[f].day === today());
                if (f) out += `\n【你那边今天的天气】${w.fic[f].text}`;
            }
            // 🤝 约着一起出去的事
            const cur = activeDate(c.id);
            if (cur) out += `\n【你此刻正跟${(typeof userDisplayName === 'function') ? userDisplayName(c) : '对方'}在一起】在「${cur.spot}」${cur.act ? '，' + cur.act : ''}，说好待 ${fmtMin(cur.mins)}，还剩 ${fmtMin(Math.max(1, Math.round((cur.until - nowMs()) / 60000)))}。别写成你们不在一块儿。`;
            const past = logsOf(c.id).filter(l => l.ok && (!cur || l.id !== cur.id)).slice(-6);
            if (past.length) {
                out += `\n【你们一起去过的地方】` + past.map(l => {
                    const d = new Date(l.at);
                    return `${d.getMonth() + 1}月${d.getDate()}日 在「${l.spot}」${l.act ? '，' + l.act : ''}（${l.by === 'me' ? '对方约的' : '你约的'}）`;
                }).join('；') + '。';
            }
            const said = logsOf(c.id).filter(l => !l.ok).slice(-2);
            if (said.length) out += `\n【你回绝过的约】` + said.map(l => `「${l.spot}」`).join('、') + '。';
            return out ? out + '\n' : '';
        } catch (e) { return ''; }
    };

    // ---------- 样式 ----------
    const CSS = `
#gymapModal,#gymapWPop,#gymapDatePop{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;padding:16px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;}
#gymapModal.on,#gymapWPop.on,#gymapDatePop.on{display:flex;}
#gymapWPop{z-index:2700;}
#gymapDatePop{z-index:2750;}
.gymap-box{background:#fff;border-radius:16px;width:760px;max-width:100%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;}
body.dark-theme .gymap-box{background:#16181c;color:#e7e9ea;}
.gymap-hd{padding:15px 18px 9px;font-size:17px;font-weight:700;color:#1d9bf0;display:flex;align-items:center;gap:8px;}
.gymap-tabs{display:flex;gap:4px;padding:0 18px;border-bottom:1px solid rgba(128,128,128,.2);flex-wrap:wrap;}
.gymap-tab{border:none;background:none;padding:9px 12px;font-size:13.5px;cursor:pointer;color:#8b98a5;border-bottom:2px solid transparent;font-family:inherit;}
.gymap-tab.on{color:#1d9bf0;border-bottom-color:#1d9bf0;font-weight:700;}
.gymap-bd{padding:14px 18px 16px;overflow-y:auto;flex:1 1 auto;}
.gymap-sec{margin-bottom:16px;}
.gymap-sec>h4{margin:0 0 8px;font-size:13px;color:#1d9bf0;}
.gymap-hint{font-size:12px;color:#8b98a5;line-height:1.7;margin-bottom:8px;}
.gymap-in{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cfd9de;border-radius:8px;font-size:13px;background:transparent;color:inherit;outline:none;margin-bottom:8px;font-family:inherit;}
.gymap-in:focus{border-color:#1d9bf0;}
.gymap-btn{border:1px solid #1d9bf0;background:#1d9bf0;color:#fff;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer;margin:0 6px 6px 0;font-family:inherit;}
.gymap-btn.ghost{background:transparent;color:#1d9bf0;}
.gymap-btn.danger{background:transparent;border-color:#f91880;color:#f91880;}
.gymap-mini{border:none;background:rgba(128,128,128,.12);border-radius:6px;padding:4px 9px;font-size:11px;cursor:pointer;color:inherit;font-family:inherit;margin:0 4px 4px 0;}
.gymap-mini.on{background:#1d9bf0;color:#fff;}
.gymap-modes{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
/* 画布 */
.gymap-canvas{position:relative;width:100%;height:420px;border:1px solid #cfd9de;border-radius:12px;overflow:hidden;
  background:#f4f6f7 center/contain no-repeat;cursor:crosshair;}
body.dark-theme .gymap-canvas{background-color:#22252a;}
.gymap-canvas.free{background-image:linear-gradient(rgba(128,128,128,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(128,128,128,.10) 1px,transparent 1px);background-size:28px 28px;background-position:0 0;}
.gymap-spot{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:3px;cursor:grab;z-index:3;}
.gymap-spot.drag{cursor:grabbing;z-index:9;}
.gymap-pin{width:26px;height:26px;border-radius:50%;background:#1d9bf0;color:#fff;display:flex;align-items:center;
  justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.28);border:2px solid #fff;}
.gymap-pname{font-size:11px;background:rgba(255,255,255,.94);border-radius:8px;padding:1px 7px;white-space:nowrap;
  box-shadow:0 1px 4px rgba(0,0,0,.16);color:#0f1419;max-width:120px;overflow:hidden;text-overflow:ellipsis;}
body.dark-theme .gymap-pname{background:rgba(22,24,28,.94);color:#e7e9ea;}
.gymap-who{display:flex;gap:2px;margin-top:1px;}
.gymap-av{width:20px;height:20px;border-radius:50%;background:#0f1419;color:#fff;font-size:10px;display:flex;
  align-items:center;justify-content:center;border:2px solid #fff;background-size:cover;background-position:center;cursor:grab;}
body.dark-theme .gymap-av{border-color:#16181c;}
.gymap-wbadge{position:absolute;top:8px;right:8px;background:rgba(255,255,255,.94);border-radius:10px;padding:4px 10px;
  font-size:11.5px;box-shadow:0 2px 8px rgba(0,0,0,.14);z-index:5;color:#0f1419;}
body.dark-theme .gymap-wbadge{background:rgba(22,24,28,.94);color:#e7e9ea;}
/* 列表模式 */
.gymap-row{display:flex;align-items:center;gap:9px;padding:9px 0;border-bottom:1px dashed rgba(128,128,128,.25);}
.gymap-row:last-child{border-bottom:none;}
.gymap-row-m{flex:1 1 auto;min-width:0;}
.gymap-row-m b{display:block;font-size:13.5px;}
.gymap-row-m span{font-size:11.5px;color:#8b98a5;}
.gymap-edit{border:1px solid #1d9bf0;border-radius:12px;padding:12px;margin:8px 0;background:rgba(29,155,240,.05);}
.gymap-hit{display:block;width:100%;text-align:left;border:1px solid #cfd9de;background:transparent;color:inherit;
  border-radius:8px;padding:7px 10px;margin-bottom:5px;font-size:12.5px;cursor:pointer;font-family:inherit;}
.gymap-hit:hover{border-color:#1d9bf0;background:rgba(29,155,240,.07);}
.gymap-hit span{color:#8b98a5;font-size:11px;}
/* 天气弹窗 */
.gymap-wbox{background:#fff;border-radius:18px;width:360px;max-width:100%;max-height:88vh;overflow-y:auto;padding:18px;}
body.dark-theme .gymap-wbox{background:#16181c;color:#e7e9ea;}
.gymap-wmain{text-align:center;padding:6px 0 12px;}
.gymap-wicon{font-size:52px;line-height:1;}
.gymap-wtemp{font-size:34px;font-weight:700;margin-top:4px;}
.gymap-wsub{font-size:12.5px;color:#8b98a5;margin-top:3px;line-height:1.7;}
.gymap-wcard{border:1px solid rgba(128,128,128,.25);border-radius:12px;padding:10px 12px;margin-bottom:9px;font-size:12.5px;line-height:1.7;}
.gymap-wcard b{color:#1d9bf0;}
.gymap-say{background:rgba(29,155,240,.07);border-radius:12px;padding:11px 13px;margin-top:10px;font-size:13px;line-height:1.7;}
.gymap-say b{color:#1d9bf0;font-size:11.5px;display:block;margin-bottom:3px;}
.gymap-picks{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;}
.gymap-pick{display:flex;align-items:center;gap:5px;border:1px solid #cfd9de;background:transparent;color:inherit;
  border-radius:16px;padding:4px 10px 4px 4px;font-size:12px;cursor:pointer;font-family:inherit;}
.gymap-pick.on{border-color:#1d9bf0;background:rgba(29,155,240,.1);}
@media (max-width:600px){ .gymap-canvas{height:300px;} .gymap-box{max-height:92vh;} }`;

    // ---------- 悬浮窗样式（和音乐盒同一套：白圆角卡 / 柔和投影 / 细线图标 / 黑色圆主键）----------
    const FCSS = `
#gymapFloat{position:fixed;z-index:2500;left:auto;bottom:auto;right:22px;top:88px;display:none;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;-webkit-user-select:none;user-select:none;}
#gymapFloat.on{display:block;}
#gymapFloat.gf-drag{opacity:.92;cursor:grabbing;}
.gf-box{background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);position:relative;overflow:hidden;
  box-sizing:border-box;color:#0f1419;}
body.dark-theme .gf-box{background:#16181c;color:#e7e9ea;box-shadow:0 8px 32px rgba(0,0,0,.5);}
.gf-box > *{flex:0 0 auto;}
.gf-hd{position:absolute;top:0;left:0;right:0;height:20px;cursor:grab;z-index:3;}
.gf-x{position:absolute;top:6px;right:8px;z-index:5;width:20px;height:20px;border-radius:50%;border:none;
  background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);color:#536471;font-size:13px;line-height:1;cursor:pointer;padding:0;}
.gf-x:hover{background:#eff3f4;}
body.dark-theme .gf-x{background:#2f3336;color:#e7e9ea;box-shadow:0 1px 4px rgba(0,0,0,.5);}
.gf-ico{color:#0f1419;line-height:0;}
body.dark-theme .gf-ico{color:#e7e9ea;}
.gf-ico svg{display:block;}
.gf-temp{font-weight:700;font-variant-numeric:tabular-nums;line-height:1;white-space:nowrap;}
.gf-city{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;line-height:1.3;}
.gf-sub{color:#8b98a5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;line-height:1.3;}
.gf-line{height:1px;background:#eff3f4;width:100%;}
body.dark-theme .gf-line{background:#2f3336;}
.gf-avs{display:flex;align-items:center;gap:6px;overflow:hidden;max-width:100%;}
.gf-av{width:28px;height:28px;border-radius:50%;background:#e6e9ea;color:#0f1419;font-size:12px;display:flex;
  align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;background-size:cover;background-position:center;
  border:2px solid transparent;box-sizing:border-box;padding:0;font-family:inherit;}
.gf-av.on{border-color:#0f1419;}
body.dark-theme .gf-av{background:#2f3336;color:#e7e9ea;}
body.dark-theme .gf-av.on{border-color:#e7e9ea;}
.gf-say{font-size:12px;line-height:1.6;color:#0f1419;overflow:hidden;width:100%;}
body.dark-theme .gf-say{color:#e7e9ea;}
.gf-say b{display:block;font-size:10.5px;color:#8b98a5;font-weight:400;margin-bottom:1px;}
.gf-ctl{display:flex;align-items:center;gap:14px;}
.gf-b{border:none;background:none;padding:0;cursor:pointer;color:#0f1419;display:flex;align-items:center;
  justify-content:center;flex:0 0 auto;width:20px;height:20px;font-family:inherit;}
.gf-b svg{width:18px;height:18px;display:block;}
.gf-b:hover{opacity:.6;}
body.dark-theme .gf-b{color:#e7e9ea;}
.gf-box .gf-b.gf-main{background:#0f1419;color:#fff;border-radius:50%;width:38px;height:38px;}
body.dark-theme .gf-box .gf-b.gf-main{background:#e7e9ea;color:#16181c;}
.gf-box .gf-b.gf-main:hover{opacity:.85;}
.gf-mid{display:flex;flex-direction:column;justify-content:center;min-width:0;}
.gf-tp{display:flex;align-items:center;gap:8px;width:100%;font-size:12px;}
.gf-tp .gf-n{font-weight:700;flex:0 0 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:96px;}
.gf-tp .gf-w{color:#8b98a5;flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;}
.gf-chip{display:flex;align-items:center;gap:4px;background:#eff3f4;border-radius:14px;padding:4px 10px;font-size:11.5px;flex:0 0 auto;}
body.dark-theme .gf-chip{background:#22252a;}
.gf-chip svg{width:14px;height:14px;display:block;}

/* ===== 天气卡 ===== */
.gf-box[data-skin="w-card"],.gf-box[data-skin="w-tall"]{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;}
.gf-box[data-skin="w-card"]{width:260px;height:330px;padding:26px 18px 14px;}
.gf-box[data-skin="w-tall"]{width:280px;height:380px;padding:28px 20px 16px;}
.gf-box[data-skin="w-card"] .gf-ico svg,.gf-box[data-skin="w-tall"] .gf-ico svg{width:54px;height:54px;}
.gf-box[data-skin="w-card"] .gf-temp{font-size:32px;}
.gf-box[data-skin="w-tall"] .gf-temp{font-size:36px;}
.gf-box[data-skin="w-card"] .gf-city,.gf-box[data-skin="w-tall"] .gf-city{font-size:14px;}
.gf-box[data-skin="w-card"] .gf-sub,.gf-box[data-skin="w-tall"] .gf-sub{font-size:11.5px;}
.gf-box[data-skin="w-card"] .gf-say,.gf-box[data-skin="w-tall"] .gf-say{flex:1 1 auto;min-height:0;
  display:flex;flex-direction:column;justify-content:center;}
.gf-box[data-skin="w-card"] .gf-ctl,.gf-box[data-skin="w-tall"] .gf-ctl{margin-top:auto;}

/* ===== 天气卡·简洁（不带对话）===== */
.gf-box[data-skin="w-glass"]{width:240px;height:250px;display:flex;flex-direction:column;align-items:center;
  text-align:center;gap:10px;padding:30px 18px 16px;}
.gf-box[data-skin="w-glass"] .gf-ico svg{width:62px;height:62px;}
.gf-box[data-skin="w-glass"] .gf-temp{font-size:40px;}
.gf-box[data-skin="w-glass"] .gf-city{font-size:14px;}
.gf-box[data-skin="w-glass"] .gf-sub{font-size:11.5px;}
.gf-box[data-skin="w-glass"] .gf-ctl{margin-top:auto;}

/* ===== 天气条 ===== */
.gf-box[data-skin="w-bar"]{width:320px;height:64px;border-radius:32px;display:flex;align-items:center;gap:10px;padding:0 13px 0 18px;}
.gf-box[data-skin="w-bar"] .gf-hd{height:12px;}
.gf-box[data-skin="w-bar"] .gf-x{top:3px;right:4px;width:16px;height:16px;font-size:11px;}
.gf-box[data-skin="w-bar"] .gf-ico svg{width:26px;height:26px;}
.gf-box[data-skin="w-bar"] .gf-temp{font-size:19px;}
.gf-box[data-skin="w-bar"] .gf-mid{flex:1 1 auto;}
.gf-box[data-skin="w-bar"] .gf-city{font-size:12.5px;}
.gf-box[data-skin="w-bar"] .gf-sub{font-size:10.5px;}
.gf-box[data-skin="w-bar"] .gf-b.gf-main{width:34px;height:34px;}

/* ===== 天气宽卡 ===== */
.gf-box[data-skin="w-wide"]{width:340px;height:140px;display:flex;align-items:center;gap:16px;padding:0 18px;}
.gf-box[data-skin="w-wide"] .gf-lft{display:flex;flex-direction:column;align-items:center;gap:6px;flex:0 0 auto;}
.gf-box[data-skin="w-wide"] .gf-ico svg{width:44px;height:44px;}
.gf-box[data-skin="w-wide"] .gf-temp{font-size:24px;}
.gf-box[data-skin="w-wide"] .gf-rgt{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:6px;}
.gf-box[data-skin="w-wide"] .gf-rgt > *{flex:0 0 auto;}
.gf-box[data-skin="w-wide"] .gf-city{font-size:14px;}
.gf-box[data-skin="w-wide"] .gf-sub{font-size:11px;}
.gf-box[data-skin="w-wide"] .gf-say{font-size:11.5px;height:36px;}
.gf-box[data-skin="w-wide"] .gf-ctl{gap:10px;justify-content:space-between;width:100%;}
.gf-box[data-skin="w-wide"] .gf-av{width:26px;height:26px;font-size:11px;}
.gf-box[data-skin="w-wide"] .gf-b.gf-main{width:32px;height:32px;}

/* ===== 行程卡 ===== */
.gf-box[data-skin="w-trip"]{width:280px;height:310px;display:flex;flex-direction:column;gap:9px;padding:26px 16px 14px;}
.gf-box[data-skin="w-trip"] .gf-whd{display:flex;align-items:center;gap:7px;font-size:12px;width:100%;}
.gf-box[data-skin="w-trip"] .gf-whd .gf-ico svg{width:20px;height:20px;}
.gf-box[data-skin="w-trip"] .gf-whd .gf-temp{font-size:15px;margin-left:auto;}
.gf-box[data-skin="w-trip"] .gf-rows{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:10px;width:100%;}
.gf-box[data-skin="w-trip"] .gf-rows > *{flex:0 0 auto;}
.gf-box[data-skin="w-trip"] .gf-av{width:26px;height:26px;font-size:11px;}
.gf-box[data-skin="w-trip"] .gf-ctl{margin-top:auto;}

/* ===== 行程一行 ===== */
.gf-box[data-skin="w-line"]{width:300px;height:72px;display:flex;align-items:center;gap:10px;padding:0 14px;}
.gf-box[data-skin="w-line"] .gf-hd{height:12px;}
.gf-box[data-skin="w-line"] .gf-x{top:3px;right:4px;width:16px;height:16px;font-size:11px;}
.gf-box[data-skin="w-line"] .gf-av{width:34px;height:34px;font-size:14px;}
.gf-box[data-skin="w-line"] .gf-mid{flex:1 1 auto;}
.gf-box[data-skin="w-line"] .gf-city{font-size:13px;}
.gf-box[data-skin="w-line"] .gf-sub{font-size:11px;}

/* ===== 胶囊款 ===== */
.gf-box[data-skin="w-dot"]{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
.gf-box[data-skin="w-dot"] .gf-hd{display:none;}
.gf-box[data-skin="w-dot"] .gf-x{top:0;right:0;width:16px;height:16px;font-size:10px;}
.gf-box[data-skin="w-dot"] .gf-ico{cursor:pointer;}
.gf-box[data-skin="w-dot"] .gf-ico svg{width:26px;height:26px;}
.gf-box[data-skin="w-pill"]{width:150px;height:48px;border-radius:24px;display:flex;align-items:center;gap:7px;padding:0 9px 0 14px;}
.gf-box[data-skin="w-pill"] .gf-hd{height:10px;}
.gf-box[data-skin="w-pill"] .gf-x{top:1px;right:2px;width:15px;height:15px;font-size:10px;}
.gf-box[data-skin="w-pill"] .gf-ico svg{width:22px;height:22px;}
.gf-box[data-skin="w-pill"] .gf-temp{font-size:15px;flex:1 1 auto;}
.gf-box[data-skin="w-pill"] .gf-b.gf-main{width:30px;height:30px;}
.gf-box[data-skin="w-pill"] .gf-b.gf-main svg{width:15px;height:15px;}

/* ===== 📍 IP属地：你这边 / TA 那边，各算各的 ===== */
.gf-tag{font-size:10.5px;color:#8b98a5;line-height:1.2;}
.gf-two{display:flex;align-items:stretch;gap:10px;width:100%;}
.gf-two > *{flex:0 0 auto;}
.gf-half{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;text-align:center;}
.gf-half > *{flex:0 0 auto;}
.gf-vline{width:1px;background:#eff3f4;}
body.dark-theme .gf-vline{background:#2f3336;}
/* —— 三种新的「你和TA」版式 —— */
/* 上下叠卡：两张卡错开摞着 */
.gf-box[data-skin="w-ip-card"]{width:260px;height:300px;display:flex;flex-direction:column;gap:8px;padding:26px 14px 12px;}
.gf-box[data-skin="w-ip-card"] .gf-stack{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:10px;}
.gf-pc{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.07);}
.gf-pc.me{background:linear-gradient(135deg,#eaf4ff,#f7fbff);margin-right:16px;}
.gf-pc.ta{background:linear-gradient(135deg,#fff2e8,#fffaf6);margin-left:16px;}
.gf-pc-l{flex:1;min-width:0;}
.gf-pc-big{font-size:22px;font-weight:800;line-height:1.2;}
.gf-pc .gf-ico svg{width:30px;height:30px;}
body.dark-theme .gf-pc.me{background:linear-gradient(135deg,#16283a,#101b26);}
body.dark-theme .gf-pc.ta{background:linear-gradient(135deg,#3a2a1a,#241a10);}

/* 温差对照：中间一条轴，两个点标在各自冷热的位置上 */
.gf-box[data-skin="w-ip-vs"]{width:300px;height:170px;display:flex;flex-direction:column;justify-content:center;padding:24px 16px 12px;}
.gf-vs{display:flex;flex-direction:column;gap:8px;}
.gf-vs-row{display:flex;align-items:baseline;gap:8px;}
.gf-vs-row b{font-size:19px;font-weight:800;}
.gf-vs-row .gf-sub{flex:1;text-align:right;}
.gf-axis{position:relative;height:6px;border-radius:3px;
  background:linear-gradient(90deg,#7ec8ff,#cfe9d0,#ffd9a0,#ff9d7a);}
.gf-pin{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;transform:translate(-50%,-50%);
  border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);}
.gf-pin.me{background:#1d9bf0;}
.gf-pin.ta{background:#f9a825;}

/* 双胶囊：最省地方的一种。
   ⚠️ 右上角那三个按钮会盖住第二个胶囊（截图里压得死死的），
   所以这一款把按钮单独放一行，胶囊排在下面。 */
.gf-box[data-skin="w-ip-mini"]{width:200px;height:72px;display:flex;align-items:flex-end;padding:0 6px 7px;}
.gf-box[data-skin="w-ip-mini"] .gf-corner{top:4px;right:6px;}
.gf-caps{display:flex;gap:6px;width:100%;}
.gf-cap{flex:1;min-width:0;display:flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;background:rgba(128,128,128,.1);}
.gf-cap .gf-ico svg{width:18px;height:18px;}
.gf-cap-t{display:flex;flex-direction:column;min-width:0;line-height:1.15;}
.gf-cap-t b{font-size:13px;font-weight:800;}
.gf-cap-t i{font-size:10px;font-style:normal;color:#8b98a5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

.gf-box[data-skin="w-ip"]{width:300px;height:250px;display:flex;flex-direction:column;gap:10px;padding:24px 16px 14px;}
.gf-box[data-skin="w-ip"] .gf-two{flex:1 1 auto;min-height:0;}
.gf-box[data-skin="w-ip"] .gf-ico svg{width:34px;height:34px;}
.gf-box[data-skin="w-ip"] .gf-temp{font-size:20px;}
.gf-half .gf-temp{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.gf-half .gf-temp.gf-place{font-size:16px;}
.gf-box[data-skin="w-ip"] .gf-two{min-height:104px;}
.gf-box.gf-picking[data-skin="w-ip"]{height:318px;}
.gf-box[data-skin="w-ip"] .gf-half .gf-sub{font-size:11px;white-space:normal;line-height:1.45;max-height:32px;}
.gf-box[data-skin="w-ip"] .gf-say{font-size:11.5px;text-align:center;}
.gf-box[data-skin="w-ip"] .gf-ctl{margin-top:auto;}
.gf-box[data-skin="w-ip-bar"]{width:340px;height:84px;display:flex;align-items:center;gap:10px;padding:0 12px 0 14px;}
.gf-box[data-skin="w-ip-bar"] .gf-hd{height:12px;}
.gf-box[data-skin="w-ip-bar"] .gf-x{top:3px;right:4px;width:16px;height:16px;font-size:11px;}
.gf-box[data-skin="w-ip-bar"] .gf-two{flex:1 1 auto;min-width:0;}
.gf-box[data-skin="w-ip-bar"] .gf-ico svg{width:24px;height:24px;}
.gf-box[data-skin="w-ip-bar"] .gf-temp{font-size:15px;}
.gf-box[data-skin="w-ip-bar"] .gf-half{gap:2px;}
.gf-box[data-skin="w-ip-bar"] .gf-half .gf-sub{font-size:10.5px;}
.gf-box[data-skin="w-ip-bar"] .gf-half .gf-temp.gf-place{font-size:13px;}
.gf-box[data-skin="w-ip-bar"] .gf-b.gf-main{width:34px;height:34px;}
.gf-box[data-skin="w-ips"]{width:300px;height:320px;display:flex;flex-direction:column;gap:9px;padding:26px 16px 14px;}
.gf-box[data-skin="w-ips"] .gf-whd{display:flex;align-items:center;gap:7px;width:100%;font-size:12px;}
.gf-box[data-skin="w-ips"] .gf-whd .gf-chip{margin-left:auto;}
.gf-box[data-skin="w-ips"] .gf-rows{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:10px;width:100%;}
.gf-box[data-skin="w-ips"] .gf-rows > *{flex:0 0 auto;}
.gf-box[data-skin="w-ips"] .gf-av{width:26px;height:26px;font-size:11px;}
.gf-box[data-skin="w-ips"] .gf-tp .gf-w{text-align:left;}
.gf-box[data-skin="w-ips"] .gf-chip{padding:3px 8px;font-size:10.5px;max-width:96px;overflow:hidden;white-space:nowrap;}
.gf-box[data-skin="w-ips"] .gf-say{font-size:11.5px;}
.gf-box[data-skin="w-ips"] .gf-ctl{margin-top:auto;}

/* ===== 🎫 时间款：报纸 / 车票 / 大字钟 / 日历条 / 深色条 ===== */
.gf-serif{font-family:Georgia,"Times New Roman","Songti SC","SimSun",serif;}
.gf-mono{font-family:"SFMono-Regular",Menlo,Consolas,"Courier New",monospace;}
.gf-script{font-family:"Snell Roundhand","Brush Script MT","Segoe Script","Kaiti SC",cursive;font-style:italic;}
.gf-up{letter-spacing:.18em;text-transform:uppercase;}
.gf-rule{height:1px;background:#0f1419;width:100%;opacity:.85;}
body.dark-theme .gf-rule{background:#e7e9ea;}
.gf-rule.thin{opacity:.28;}
.gf-dash{width:100%;border-top:1px dashed #0f1419;opacity:.4;}
body.dark-theme .gf-dash{border-top-color:#e7e9ea;}
.gf-kv{display:flex;align-items:center;width:100%;font-size:11px;line-height:1.5;}
.gf-kv b{font-weight:400;color:#8b98a5;}
.gf-kv span{margin-left:auto;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.gf-bars{display:flex;align-items:stretch;gap:1.5px;flex:0 0 auto;}
.gf-bars i{display:block;background:#0f1419;}
body.dark-theme .gf-bars i{background:#e7e9ea;}
.gf-vtxt{writing-mode:vertical-rl;font-size:9px;letter-spacing:.12em;color:#8b98a5;flex:0 0 auto;}

/* 报纸卡 */
.gf-box[data-skin="t-paper"]{width:360px;height:136px;display:flex;flex-direction:column;gap:6px;
  padding:16px 16px 12px;background:#f7f7f5;border-radius:4px;}
body.dark-theme .gf-box[data-skin="t-paper"]{background:#1b1d21;}
.gf-box[data-skin="t-paper"]::after{content:"";position:absolute;right:0;top:0;bottom:0;width:9px;background:#0f1419;}
body.dark-theme .gf-box[data-skin="t-paper"]::after{background:#e7e9ea;}
.gf-box[data-skin="t-paper"] .gf-x{right:16px;}
.gf-box[data-skin="t-paper"] .gf-top{display:flex;align-items:baseline;width:100%;font-size:10.5px;color:#536471;padding-right:26px;box-sizing:border-box;}
.gf-box[data-skin="t-paper"] .gf-top span{margin-left:auto;letter-spacing:.06em;}
.gf-box[data-skin="t-paper"] .gf-big{display:flex;align-items:flex-end;width:100%;}
.gf-box[data-skin="t-paper"] .gf-clock{font-size:40px;line-height:1;letter-spacing:.01em;}
.gf-box[data-skin="t-paper"] .gf-sig{margin-left:auto;text-align:right;line-height:1.25;}
.gf-box[data-skin="t-paper"] .gf-sig i{display:block;font-size:19px;}
.gf-box[data-skin="t-paper"] .gf-sig u{display:block;text-decoration:none;font-size:11px;letter-spacing:.22em;color:#536471;}
.gf-box[data-skin="t-paper"] .gf-bot{font-size:10.5px;letter-spacing:.26em;color:#8b98a5;width:100%;text-align:center;}

/* 车票 / 小票 */
.gf-box[data-skin="t-ticket"]{width:380px;height:150px;display:flex;align-items:stretch;gap:10px;padding:14px 12px 12px 16px;border-radius:6px;}
.gf-box[data-skin="t-ticket"] .gf-x{right:auto;left:5px;top:4px;width:16px;height:16px;font-size:11px;}
.gf-box[data-skin="t-ticket"] .gf-tk{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:5px;}
.gf-box[data-skin="t-ticket"] .gf-tk > *{flex:0 0 auto;}
.gf-box[data-skin="t-ticket"] .gf-hi{font-size:15px;font-weight:800;letter-spacing:.04em;}
.gf-box[data-skin="t-ticket"] .gf-kv{font-size:11px;}
.gf-box[data-skin="t-ticket"] .gf-kv.last b,.gf-box[data-skin="t-ticket"] .gf-kv.last span{font-weight:700;color:#0f1419;}
body.dark-theme .gf-box[data-skin="t-ticket"] .gf-kv.last b,body.dark-theme .gf-box[data-skin="t-ticket"] .gf-kv.last span{color:#e7e9ea;}
.gf-box[data-skin="t-ticket"] .gf-code{display:flex;align-items:stretch;gap:5px;flex:0 0 auto;}
.gf-box[data-skin="t-ticket"] .gf-bars{width:38px;flex-direction:column;}
.gf-box[data-skin="t-ticket"] .gf-bars i{width:100%;}

/* 大字钟（透明，没有卡片） */
.gf-box[data-skin="t-hero"]{width:340px;height:132px;box-shadow:none;
  background:radial-gradient(ellipse 70% 60% at 50% 45%,rgba(255,255,255,.78) 0%,rgba(255,255,255,.5) 55%,rgba(255,255,255,0) 100%);
  display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 0 0;
  text-shadow:0 1px 3px rgba(255,255,255,.95),0 0 14px rgba(255,255,255,.9);}
body.dark-theme .gf-box[data-skin="t-hero"]{box-shadow:none;
  background:radial-gradient(ellipse 70% 60% at 50% 45%,rgba(0,0,0,.72) 0%,rgba(0,0,0,.45) 55%,rgba(0,0,0,0) 100%);
  text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 14px rgba(0,0,0,.9);}
.gf-box[data-skin="t-hero"] .gf-place svg{filter:drop-shadow(0 1px 3px rgba(255,255,255,.95));}
body.dark-theme .gf-box[data-skin="t-hero"] .gf-place svg{filter:drop-shadow(0 1px 3px rgba(0,0,0,.95));}
.gf-box[data-skin="t-hero"] .gf-x{background:rgba(255,255,255,.9);}
.gf-box[data-skin="t-hero"] .gf-hrow{display:flex;align-items:center;gap:14px;}
.gf-box[data-skin="t-hero"] .gf-clock{font-size:54px;line-height:.92;font-weight:200;letter-spacing:-.01em;}
.gf-box[data-skin="t-hero"] .gf-vline{width:1px;align-self:stretch;margin:6px 0;background:currentColor;opacity:.35;}
.gf-box[data-skin="t-hero"] .gf-hcol{display:flex;flex-direction:column;gap:2px;}
.gf-box[data-skin="t-hero"] .gf-hcol b{font-size:19px;font-weight:400;letter-spacing:.16em;}
.gf-box[data-skin="t-hero"] .gf-hcol span{font-size:13px;color:#8b98a5;letter-spacing:.1em;}
.gf-box[data-skin="t-hero"] .gf-place{display:flex;align-items:center;gap:5px;font-size:14px;color:#536471;}
body.dark-theme .gf-box[data-skin="t-hero"] .gf-place{color:#b3bcc4;}
.gf-box[data-skin="t-hero"] .gf-place svg{width:15px;height:15px;}

/* 毛玻璃日历条 */
.gf-box[data-skin="t-glass"]{width:336px;height:92px;display:flex;align-items:stretch;border-radius:18px;
  background:rgba(255,255,255,.88);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);}
body.dark-theme .gf-box[data-skin="t-glass"]{background:rgba(24,27,32,.88);}
.gf-box[data-skin="t-glass"] .gf-hd{height:12px;}
.gf-box[data-skin="t-glass"] .gf-x{top:3px;right:5px;width:16px;height:16px;font-size:11px;}
.gf-box[data-skin="t-glass"] .gf-cal{width:112px;flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:0 10px;
  border-right:1px solid rgba(128,128,128,.28);}
.gf-box[data-skin="t-glass"] .gf-day{text-align:center;flex:0 0 auto;}
.gf-box[data-skin="t-glass"] .gf-day u{display:block;text-decoration:none;font-size:11px;color:#8b98a5;}
.gf-box[data-skin="t-glass"] .gf-day b{display:block;font-size:24px;line-height:1.05;}
.gf-box[data-skin="t-glass"] .gf-yj{display:flex;flex-direction:column;gap:3px;font-size:10px;}
.gf-box[data-skin="t-glass"] .gf-yj i{display:flex;align-items:center;gap:4px;font-style:normal;color:#536471;}
body.dark-theme .gf-box[data-skin="t-glass"] .gf-yj i{color:#b3bcc4;}
.gf-box[data-skin="t-glass"] .gf-yj em{font-style:normal;width:15px;height:15px;border-radius:4px;display:flex;
  align-items:center;justify-content:center;font-size:9.5px;color:#fff;flex:0 0 auto;}
.gf-box[data-skin="t-glass"] .gf-yj em.y{background:#2f9e79;}
.gf-box[data-skin="t-glass"] .gf-yj em.j{background:#d0455f;}
.gf-box[data-skin="t-glass"] .gf-rt{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:1px;padding:0 10px;}
.gf-box[data-skin="t-glass"] .gf-rt > *{flex:0 0 auto;max-width:100%;}
.gf-box[data-skin="t-glass"] .gf-loc{font-size:11px;color:#8b98a5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.gf-box[data-skin="t-glass"] .gf-clock{font-size:30px;line-height:1.05;font-weight:300;}
.gf-box[data-skin="t-glass"] .gf-wx{font-size:11px;color:#536471;white-space:nowrap;}
body.dark-theme .gf-box[data-skin="t-glass"] .gf-wx{color:#b3bcc4;}

/* 深色条 */
.gf-box[data-skin="t-dark"]{width:350px;height:92px;display:flex;align-items:center;gap:12px;padding:0 14px;
  border-radius:14px;background:#111318;color:#e7e9ea;}
body.dark-theme .gf-box[data-skin="t-dark"]{background:#0c0e12;}
.gf-box[data-skin="t-dark"] .gf-x{background:#2f3336;color:#e7e9ea;top:5px;right:6px;width:17px;height:17px;font-size:11px;}
.gf-box[data-skin="t-dark"] .gf-hd{height:14px;}
.gf-box[data-skin="t-dark"] .gf-tl{display:flex;flex-direction:column;gap:7px;flex:0 0 auto;width:104px;}
.gf-box[data-skin="t-dark"] .gf-tl > *{flex:0 0 auto;}
.gf-box[data-skin="t-dark"] .gf-tli{display:flex;align-items:flex-start;gap:7px;font-size:10.5px;line-height:1.3;color:#aeb6bf;}
.gf-box[data-skin="t-dark"] .gf-tli o{width:6px;height:6px;border-radius:50%;margin-top:3px;flex:0 0 auto;display:block;}
.gf-box[data-skin="t-dark"] .gf-tli o.f{background:#5b7fff;}
.gf-box[data-skin="t-dark"] .gf-tli o.e{border:1px solid #5f6773;background:transparent;}
.gf-box[data-skin="t-dark"] .gf-tli u{text-decoration:none;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gf-box[data-skin="t-dark"] .gf-rt{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px;align-items:flex-end;}
.gf-box[data-skin="t-dark"] .gf-rt > *{flex:0 0 auto;}
.gf-box[data-skin="t-dark"] .gf-dt{font-size:10.5px;color:#8b98a5;letter-spacing:.06em;}
.gf-box[data-skin="t-dark"] .gf-clock{font-size:28px;line-height:1;font-weight:700;color:#3f4a63;letter-spacing:.02em;}
.gf-box[data-skin="t-dark"] .gf-week{display:flex;align-items:center;gap:5px;font-size:10px;color:#8b98a5;}
.gf-box[data-skin="t-dark"] .gf-week i{font-style:normal;width:16px;height:16px;line-height:16px;text-align:center;
  border-radius:50%;flex:0 0 auto;box-sizing:border-box;}
.gf-box[data-skin="t-dark"] .gf-week i.on{border:1px solid #aeb6bf;color:#e7e9ea;}

@media (max-width:600px){
  #gymapFloat{right:10px;top:72px;}
  .gf-box{max-width:calc(100vw - 24px);}
}`;

    // ---------- DOM ----------
    function mount() {
        const st = document.createElement('style'); st.id = 'gymapStyle'; st.textContent = CSS + FCSS;
        document.head.appendChild(st);
        const m = document.createElement('div');
        m.id = 'gymapModal';
        m.innerHTML = `<div class="gymap-box">
            <div class="gymap-hd">🗺️ 行程与天气<button class="gymap-btn ghost" style="margin-left:auto" onclick="gymapClose()">关闭</button></div>
            <div class="gymap-tabs">
              <button class="gymap-tab" id="gymapTab-map" onclick="gymapTab('map')">地图</button>
              <button class="gymap-tab" id="gymapTab-move" onclick="gymapTab('move')">行程规则</button>
              <button class="gymap-tab" id="gymapTab-date" onclick="gymapTab('date')">🤝 约出去</button>
              <button class="gymap-tab" id="gymapTab-weather" onclick="gymapTab('weather')">天气</button>
            </div>
            <div class="gymap-bd" id="gymapBody"></div></div>`;
        m.addEventListener('click', e => { if (e.target === m) gymapClose(); });
        document.body.appendChild(m);

        const w = document.createElement('div');
        w.id = 'gymapWPop';
        w.innerHTML = '<div class="gymap-wbox" id="gymapWBox"></div>';
        w.addEventListener('click', e => { if (e.target === w) gymapCloseW(); });
        document.body.appendChild(w);

        const dm = document.createElement('div');
        dm.id = 'gymapDatePop';
        dm.innerHTML = '<div class="gymap-wbox" id="gymapDateBox"></div>';
        dm.addEventListener('click', e => { if (e.target === dm) gymapCloseDate(); });
        document.body.appendChild(dm);

        // 🪟 悬浮窗
        const f = document.createElement('div');
        f.id = 'gymapFloat';
        f.innerHTML = '<div class="gf-box" id="gymapFBox"></div>';
        document.body.appendChild(f);
        if (S.float.pos) { f.style.left = S.float.pos.x + 'px'; f.style.top = S.float.pos.y + 'px'; f.style.right = 'auto'; f.style.bottom = 'auto'; }
        if (S.float.on) f.classList.add('on');
        bindFloatDrag(f);
        paintFloat();
    }

    // ---------- 悬浮窗 ----------
    const FSKIN_CATS = [
        { cat: 'card', icon: '🗂️', name: '天气卡', variants: [
            { k: 'w-card', n: '标准', d: '260×330' },
            { k: 'w-tall', n: '加高', d: '280×380' },
            { k: 'w-glass', n: '简洁', d: '240×290' } ] },
        { cat: 'bar', icon: '▬', name: '天气条', variants: [
            { k: 'w-bar', n: '圆条', d: '320×64' },
            { k: 'w-wide', n: '宽卡', d: '340×140' } ] },
        { cat: 'trip', icon: '🧭', name: '行程款', variants: [
            { k: 'w-trip', n: '行程卡', d: '280×340' },
            { k: 'w-line', n: '一行', d: '300×72' } ] },
        { cat: 'clock', icon: '🎫', name: '时间款', variants: [
            { k: 't-paper', n: '报纸卡', d: '360×136' },
            { k: 't-ticket', n: '车票', d: '380×150' },
            { k: 't-hero', n: '大字钟', d: '340×132' },
            { k: 't-glass', n: '日历条', d: '336×92' },
            { k: 't-dark', n: '深色条', d: '350×92' } ] },
        { cat: 'ip', icon: '📍', name: '你和TA', variants: [
            { k: 'w-ip', n: '左右分屏', d: '300×250' },
            { k: 'w-ip-bar', n: '对照条', d: '340×84' },
            { k: 'w-ip-card', n: '上下叠卡', d: '260×300' },
            { k: 'w-ip-vs', n: '温差对照', d: '300×170' },
            { k: 'w-ip-mini', n: '双胶囊', d: '200×72' },
            { k: 'w-ips', n: '一群人', d: '300×320' } ] },
        { cat: 'capsule', icon: '⚪', name: '胶囊款', variants: [
            { k: 'w-dot', n: '圆点', d: '56×56' },
            { k: 'w-pill', n: '药丸', d: '150×48' } ] }
    ];
    const FALL = FSKIN_CATS.reduce((a, c) => a.concat(c.variants.map(v => Object.assign({ cat: c.cat }, v))), []);
    const fSkinInfo = k => FALL.find(v => v.k === k) || FALL[0];

    let fdragging = false;
    // 拖窗 + 拖边缘改大小。
    // ⚠️ 没有单独的"拖动条"——那玩意儿挂在角上很丑，而且这些窗小的才 56×56，
    //    再挂个手柄基本没地方放。改成"鼠标靠近边缘 8px 就变成缩放"，
    //    跟系统窗口一个手感；靠近哪条边就往哪个方向拉，四个角能同时改宽高。
    const F_EDGE = 8;
    // ⚠️ 外层 #gymapFloat 只是个定位壳，真正有宽高的是里面的 .gf-box。
    //    边缘检测和改尺寸都得对准 box，对着壳算的话永远命中不到边（实测拖了没反应）。
    const fBox = root => root.querySelector('.gf-box') || root;
    function fEdgeOf(root, px, py) {
        const r = fBox(root).getBoundingClientRect();
        const l = px - r.left, t = py - r.top, rr = r.right - px, bb = r.bottom - py;
        let e = '';
        if (t <= F_EDGE) e += 'n'; else if (bb <= F_EDGE) e += 's';
        if (l <= F_EDGE) e += 'w'; else if (rr <= F_EDGE) e += 'e';
        return e;   // '' | 'n' | 'se' | ...
    }
    const F_CUR = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
                    ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };

    function bindFloatDrag(root) {
        let sx = 0, sy = 0, ox = 0, oy = 0, ow = 0, oh = 0, edge = '';
        const down = e => {
            const p = e.touches ? e.touches[0] : e;
            if (e.target.closest('button,.gf-ico')) return;
            edge = fEdgeOf(root, p.clientX, p.clientY);
            fdragging = true; root.classList.add('gf-drag');
            const r = fBox(root).getBoundingClientRect();
            ox = r.left; oy = r.top; ow = r.width; oh = r.height;
            sx = p.clientX; sy = p.clientY;
            root.style.left = ox + 'px'; root.style.top = oy + 'px';
            root.style.right = 'auto'; root.style.bottom = 'auto';
            e.preventDefault();
        };
        // 没按下的时候，靠近边缘就把鼠标指针换掉——不然用户根本不知道这儿能拉
        const hover = e => {
            if (fdragging) return;
            const p = e.touches ? e.touches[0] : e;
            const ed = fEdgeOf(root, p.clientX, p.clientY);
            fBox(root).style.cursor = ed ? F_CUR[ed] : 'move';
        };
        const move = e => {
            if (!fdragging) return;
            const p = e.touches ? e.touches[0] : e;
            const dx = p.clientX - sx, dy = p.clientY - sy;
            if (edge) {
                // 缩放。左/上边要一边改大小一边挪位置，否则会看着"往右下跑"
                let w = ow, h = oh, x = ox, y = oy;
                if (edge.includes('e')) w = ow + dx;
                if (edge.includes('w')) { w = ow - dx; x = ox + dx; }
                if (edge.includes('s')) h = oh + dy;
                if (edge.includes('n')) { h = oh - dy; y = oy + dy; }
                w = Math.max(56, Math.min(window.innerWidth - 8, w));
                h = Math.max(48, Math.min(window.innerHeight - 8, h));
                // 缩到最小之后再往回拉，位置不能继续跟着跑
                if (edge.includes('w')) x = ox + (ow - w);
                if (edge.includes('n')) y = oy + (oh - h);
                const bx = fBox(root);
                bx.style.width = w + 'px'; bx.style.height = h + 'px';
                root.style.left = Math.max(4, x) + 'px'; root.style.top = Math.max(4, y) + 'px';
            } else {
                const bx0 = fBox(root);
                const w = bx0.offsetWidth, h = bx0.offsetHeight;
                let x = ox + dx, y = oy + dy;
                x = Math.max(4, Math.min(window.innerWidth - w - 4, x));
                y = Math.max(4, Math.min(window.innerHeight - h - 4, y));
                root.style.left = x + 'px'; root.style.top = y + 'px';
            }
        };
        const up = () => {
            if (!fdragging) return;
            fdragging = false; root.classList.remove('gf-drag');
            S.float.pos = { x: parseInt(root.style.left) || 0, y: parseInt(root.style.top) || 0 };
            if (edge) { const bx = fBox(root); S.float.size = { w: Math.round(bx.offsetWidth), h: Math.round(bx.offsetHeight) }; }
            edge = '';
            save();
        };
        root.addEventListener('mousemove', hover);
        root.addEventListener('mousedown', down); root.addEventListener('touchstart', down, { passive: false });
        window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('mouseup', up); window.addEventListener('touchend', up);
    }

    // 换皮肤时把手动调过的大小清掉——每个皮肤的版式差很多，
    // 拿"报纸卡"的尺寸套到"圆点"上会难看得离谱
    function fResetSize() { S.float.size = null; const b = document.getElementById('gymapFBox'); if (b) { b.style.width = ''; b.style.height = ''; } }
    function fApplySize() {
        const b = document.getElementById('gymapFBox');
        if (!b) return;
        const z = S.float.size;
        if (z && z.w && z.h) { b.style.width = z.w + 'px'; b.style.height = z.h + 'px'; }
        else { b.style.width = ''; b.style.height = ''; }
    }

    // 悬浮窗要显示的那份数据
    function fdata() {
        // 🧭 先看这个窗被设成"看谁那边"。选了角色的话走角色所在地那一套（charIP 会按
        //    TA 站着的点算势力，多势力角色不会再拿错另一边的天气）。
        const src = S.float.src || 'me';
        if (src !== 'me') {
            const c = chars().find(x => String(x.id) === String(src));
            if (c) {
                const ip = charIP(c);
                // ⚠️ 名字一定要露出来。以前这里只写地点，角色没设位置时两个人显示的字
                //    一模一样（都是"不知道在哪儿"），换来换去看不出换没换，
                //    实际状态是变了的——看着像"切了人悬浮窗没反应"。
                return {
                    showReal: false, r: null, fac: ip.fac, fics: [],
                    ficTxt: ip.wtxt, forChar: c, ip,
                    ico: ip.ico,
                    temp: ip.wshort,
                    city: c.name + ((ip.place && ip.place !== '不知道在哪儿') ? ' · ' + ip.place : ''),
                    sub: ip.wtxt || (ip.fac ? ip.fac + '　这边今天还没设天气' : '还没告诉过 app ' + c.name + ' 在哪儿')
                };
            }
        }
        const w = S.weather, r = w.real;
        const showReal = (w.mode !== 'fiction') && !!r;
        const fics = (w.mode !== 'real') ? Object.keys(w.fic).filter(f => w.fic[f] && w.fic[f].day === today()) : [];
        const fac = (S.float.faction && fics.indexOf(S.float.faction) >= 0) ? S.float.faction : (fics[0] || '');
        return {
            showReal, r, fac, fics,
            ficTxt: fac ? w.fic[fac].text : '',
            ico: FSVG[showReal ? fIcoKey(r.code) : 'na'],
            temp: showReal ? ((r.tnow != null ? r.tnow : r.tmax) + '°') : '—',
            city: showReal ? (S.user.city || '你这边') : (fac || '还没设天气'),
            sub: showReal
                ? (wDesc(r.code) + '　' + r.tmin + '~' + r.tmax + '℃' + (r.rain != null ? '　降水' + r.rain + '%' : ''))
                : (fac ? w.fic[fac].text : '去「行程与天气 → 天气」填个城市')
        };
    }
    let fPickOpen = false;

    // 虚构天气那句话里猜个图标出来
    function ficIcoKey(t) {
        if (!t) return 'na';
        if (/雷|暴/.test(t)) return 'storm';
        if (/雪/.test(t)) return 'snow';
        if (/雨/.test(t)) return 'rain';
        if (/雾|霾|沙/.test(t)) return 'fog';
        if (/晴|艳阳|烈日/.test(t)) return 'sun';
        if (/阴/.test(t)) return 'cloud';
        if (/云/.test(t)) return 'part';
        return 'na';
    }
    const WSHORT = { sun: '晴', part: '多云', cloud: '阴', rain: '雨', snow: '雪', storm: '雷雨', fog: '雾', na: '—' };
    const wShort = t => WSHORT[ficIcoKey(t)] || '—';

    // 一个角色"本来的所在地"——按 TA 自己站的那个点走，跟当前在看哪张地图无关
    function charIP(c) {
        const sp = spotById(S.charLoc[String(c.id)]);
        const facs = facOf(c);
        // 🌦️ 天气按**角色当前所在地**算，不是"TA 属于的第一个势力"。
        //    一个角色可以同时属于好几个势力（比如既是医院的也是某家族的），
        //    以前直接取 facs[0]，结果人明明在临安，显示的却是另一边的天气。
        //    优先级：站着的那个点所属势力 > 资料页 location 能对上的点 > 正在看的这张地图（前提是 TA 属于这一边）> facs[0]
        let fac = sp ? sp.faction : '';
        if (!fac) {
            const loc = String(c.location || '').trim();
            if (loc) {
                const hit = allSpots().find(x => x.name && (loc.includes(x.name) || x.name.includes(loc)));
                if (hit) fac = hit.faction;
            }
        }
        if (!fac && S.curFaction && facs.indexOf(S.curFaction) >= 0) fac = S.curFaction;
        if (!fac) fac = facs[0] || '';
        const fw = (fac && S.weather.fic[fac] && S.weather.fic[fac].day === today()) ? S.weather.fic[fac].text : '';
        return {
            fac, spot: sp ? sp.name : '',
            place: sp ? sp.name : (fac || '不知道在哪儿'),
            full: sp ? (sp.name + (fac ? ' · ' + fac : '')) : (fac || '不知道在哪儿'),
            wtxt: fw, wshort: fw ? wShort(fw) : '—', ico: FSVG[fw ? ficIcoKey(fw) : 'na']
        };
    }
    function fAvBtn(c, cls) {
        const on = String(c.id) === saidBy ? ' on' : '';
        const t = `class="gf-av${on}${cls ? ' ' + cls : ''}" onclick="gymapFloatSay('${c.id}')" title="${esc(c.name)}"`;
        return c.avatarImg
            ? `<button ${t} style="background-image:url('${c.avatarImg}')"></button>`
            : `<button ${t}>${esc(c.avatarEmoji || (c.name || '?')[0])}</button>`;
    }
    const fChars = () => chars().filter(c => c.isFollowing !== false);
    // 头像那一行平时收着，点主键才展开
    function fPickBlock() {
        if (!fPickOpen) return '';
        const cs = fChars().slice(0, 6);
        if (!cs.length) return '<div class="gf-line"></div><div class="gf-avs"><span style="font-size:11px;color:#8b98a5">还没有角色</span></div>';
        return '<div class="gf-line"></div><div class="gf-avs">' + cs.map(c => fAvBtn(c)).join('') + '</div>';
    }
    // 这句话只在生成过之后才占位置
    function fSayBlock() {
        if (!saidText) return '<div class="gf-say"></div>';
        const c = chars().find(x => String(x.id) === saidBy) || {};
        return `<div class="gf-say"><b>${esc(c.name || '')}</b><span>${esc(saidText)}</span></div>`;
    }
    const fMainBtn = (mode) => `<button class="gf-b gf-main" onclick="gymapFloat${mode === 'say' ? 'Say' : 'Pick'}()" title="${mode === 'say' ? '让角色说一句' : '让角色说一句（选人）'}">${FI.say}</button>`;
    const fCtl = (mode) => `<div class="gf-ctl">
        <button class="gf-b" onclick="gymapRefreshWeather()" title="刷新天气">${FI.refresh}</button>
        ${fMainBtn(mode)}
        <button class="gf-b" onclick="gymapOpen()" title="打开行程与天气">${FI.map}</button>
        <button class="gf-b" onclick="gymapFloatNextSkin()" title="换个样式">${FI.skin}</button>
    </div>`;
    // 🎛️ 头部那一排：每个皮肤都会渲染 fHead()，所以按钮放这儿等于 16 种皮肤全都有。
    //    以前只有 5 个皮肤调了 fCtl()，剩下 11 个连"换个样式"都点不到，只能去设置页翻。
    const fHead = () => `<div class="gf-hd"></div>
        <div class="gf-corner">
          <button class="gf-mini" onclick="event.stopPropagation();gymapFloatSrcCycle()" title="换成看谁那边的天气">${FI.who}</button>
          <button class="gf-mini" onclick="event.stopPropagation();gymapFloatNextSkin()" title="换个样式">${FI.skin}</button>
          <button class="gf-x" onclick="event.stopPropagation();gymapFloatHide()" title="收起">×</button>
        </div>`;

    // ---- 时间款要的那点数据 ----
    const W_EN = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const W_CN = ['日', '一', '二', '三', '四', '五', '六'];
    const YI = ['祈福', '出行', '会友', '开市', '纳采', '沐浴', '裁衣', '求医', '安床', '纳财'];
    const JI = ['伐木', '动土', '远行', '词讼', '破土', '掘井', '嫁娶', '安葬', '开仓', '合帐'];
    function clockData() {
        const d = new Date();
        const p2 = n => String(n).padStart(2, '0');
        const off = -d.getTimezoneOffset(), sg = off >= 0 ? '+' : '-', ab = Math.abs(off);
        const h = d.getHours();
        const seq = Math.floor(d.getTime() / 86400000);
        return {
            hhmm: p2(h) + ':' + p2(d.getMinutes()),
            ampm: h < 12 ? 'AM' : 'PM',
            wEn: W_EN[d.getDay()], wCn: W_CN[d.getDay()], dow: d.getDay(),
            ymd: d.getFullYear() + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate()),
            ymd2: String(d.getFullYear()).slice(2) + '/' + p2(d.getMonth() + 1) + '/' + p2(d.getDate()),
            mo: p2(d.getMonth() + 1), da: p2(d.getDate()),
            code: '' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()),
            tz: 'GMT' + sg + p2(Math.floor(ab / 60)) + ':' + p2(ab % 60),
            hello: h < 5 ? 'GOOD NIGHT' : h < 11 ? 'GOOD MORNING' : h < 14 ? 'GOOD NOON' : h < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING',
            yi: YI[seq % YI.length], ji: JI[(seq * 7) % JI.length]
        };
    }
    // 显示谁的地点：明确点过某个角色就跟着 TA，否则用你自己所在的城市
    function locData() {
        const c = fChars().find(x => String(x.id) === saidBy);
        if (c) {
            const ip = charIP(c);
            return { who: c.name, place: ip.place + (ip.fac ? ' · ' + ip.fac : ''), short: ip.place,
                     temp: ip.wshort,
                     desc: ip.wtxt ? ip.wtxt.replace(/[，。,.].*$/, '').slice(0, 8) : (ip.fac || '—'),
                     full: ip.wtxt || ip.fac || '', ico: ip.ico, isChar: true };
        }
        const d = fdata();
        const city = (S.user.city || '').split('（')[0];
        return { who: '你', place: d.showReal ? (city || '还没填城市') : (d.city || '还没填城市'), short: city || '这儿',
                 temp: d.showReal ? (d.r.tnow != null ? d.r.tnow : d.r.tmax) + '℃' : '—',
                 desc: d.showReal ? wDesc(d.r.code) : (d.sub || '—').slice(0, 8),
                 full: d.showReal ? (wDesc(d.r.code) + '　' + d.r.tmin + '~' + d.r.tmax + '℃') : d.sub,
                 ico: d.ico, isChar: false };
    }
    // 条形码：同一天画出来一样，不会每次重绘都跳
    function barsHtml(seed, n, vertical) {
        let h = 0; for (let i = 0; i < String(seed).length; i++) h = (h * 31 + String(seed).charCodeAt(i)) >>> 0;
        let out = '';
        for (let i = 0; i < n; i++) {
            h = (h * 1103515245 + 12345) >>> 0;
            const w = 1 + (h >>> 16) % 4;
            out += `<i style="${vertical ? 'height' : 'width'}:${w}px"></i>`;
        }
        return out;
    }

    function paintFloat() {
        const box = document.getElementById('gymapFBox');
        if (!box) return;
        const k = fSkinInfo(S.float.skin).k;
        S.float.skin = k;
        box.dataset.skin = k;
        box.classList.toggle('gf-picking', !!fPickOpen);
        const d = fdata();
        const cs = fChars();
        let inner = '';

        if (k === 'w-card' || k === 'w-tall') {
            inner = `<div class="gf-ico">${d.ico}</div>
                <div class="gf-temp">${d.temp}</div>
                <div class="gf-city">${esc(d.city)}</div>
                <div class="gf-sub">${esc(d.sub)}</div>
                ${fPickBlock()}
                ${fSayBlock()}
                ${fCtl()}`;
        } else if (k === 'w-glass') {
            inner = `<div class="gf-ico">${d.ico}</div>
                <div class="gf-temp">${d.temp}</div>
                <div class="gf-city">${esc(d.city)}</div>
                <div class="gf-sub">${esc(d.sub)}</div>
                ${fCtl('say')}`;
        } else if (k === 'w-bar') {
            const c = chars().find(x => String(x.id) === saidBy);
            inner = `<div class="gf-ico">${d.ico}</div>
                <div class="gf-temp">${d.temp}</div>
                <div class="gf-mid">
                  <div class="gf-city">${esc(saidText && c ? c.name : d.city)}</div>
                  <div class="gf-sub">${esc(saidText || d.sub)}</div>
                </div>
                ${fMainBtn('say')}`;
        } else if (k === 'w-wide') {
            inner = `<div class="gf-lft"><div class="gf-ico">${d.ico}</div><div class="gf-temp">${d.temp}</div></div>
                <div class="gf-rgt">
                  <div class="gf-city">${esc(d.city)}</div>
                  <div class="gf-sub">${esc(d.sub)}</div>
                  ${fSayBlock()}
                  <div class="gf-ctl">${fPickOpen ? `<div class="gf-avs">${cs.slice(0, 4).map(c => fAvBtn(c)).join('')}</div>` : '<span class="gf-sub" style="font-size:10.5px">点右边让角色说一句</span>'}${fMainBtn()}</div>
                </div>`;
        } else if (k === 'w-trip') {
            // ⚠️ 每个人按 TA 自己站的那个点算，不是"当前这张地图"
            const rows = cs.slice(0, 5).map(c => {
                const ip = charIP(c);
                return `<div class="gf-tp">${fAvBtn(c)}<span class="gf-n">${esc(c.name)}</span>
                    <span class="gf-w">${esc(ip.full)}</span></div>`;
            }).join('') || '<div style="font-size:11.5px;color:#8b98a5">还没有角色。</div>';
            inner = `<div class="gf-whd"><div class="gf-ico">${d.ico}</div><span class="gf-sub">${esc(d.city)}　${esc(d.sub)}</span><span class="gf-temp">${d.temp}</span></div>
                <div class="gf-line"></div>
                <div class="gf-rows">${rows}</div>
                ${saidText ? fSayBlock() : ''}
                ${fCtl()}`;
        } else if (k === 'w-line') {
            const c = cs.find(x => String(x.id) === saidBy) || cs[0];
            const ip = c ? charIP(c) : null;
            inner = (c ? fAvBtn(c) : '')
                + `<div class="gf-mid"><div class="gf-city">${c ? esc(c.name) : '还没有角色'}</div>
                     <div class="gf-sub">${saidText ? esc(saidText) : (ip ? esc(ip.full) : '不知道在哪儿')}</div></div>
                   <div class="gf-chip"><span class="gf-ico">${d.ico}</span>${d.temp}</div>`;
        } else if (k === 'w-dot') {
            inner = `<div class="gf-ico" onclick="gymapFloatSkin('w-card')" title="${esc(d.city + ' ' + d.sub)}">${d.ico}</div>`;
        } else if (k === 'w-pill') {
            inner = `<div class="gf-ico">${d.ico}</div><div class="gf-temp">${d.temp}</div>${fMainBtn('say')}`;
        } else if (k === 'w-ip' || k === 'w-ip-bar') {
            // 📍 你这边 vs TA 那边：两边各按各自的所在地和天气
            const c = cs.find(x => String(x.id) === saidBy) || cs[0];
            const ip = c ? charIP(c) : null;
            const meIco = d.showReal ? d.ico : FSVG.na;
            const half = (tag, ico, big, sub, small) => `<div class="gf-half">
                <div class="gf-tag">${esc(tag)}</div><div class="gf-ico">${ico}</div>
                <div class="gf-temp${small ? ' gf-place' : ''}">${esc(big)}</div><div class="gf-sub">${esc(sub)}</div></div>`;
            inner = `<div class="gf-two">
                  ${half('你', meIco, d.showReal ? d.temp : '—',
                         d.showReal ? ((S.user.city || '').split('（')[0] || '还没填城市') + '　' + wDesc(d.r.code) : '还没填城市')}
                  <div class="gf-vline"></div>
                  ${half(c ? c.name : '角色', ip ? ip.ico : FSVG.na,
                         ip ? ip.place : '—',
                         ip ? (((ip.fac || '') + (ip.wtxt ? '　' + ip.wshort : '')) || '不知道在哪儿') : '还没有角色', true)}
                </div>
                ${k === 'w-ip' ? fSayBlock() + fPickBlock() + fCtl() : fMainBtn('say')}`;
        } else if (k === 'w-ip-card') {
            // 上下叠卡：两张卡错开叠着，上面是你、下面是 TA，像两张明信片摞在一起
            const c = cs.find(x => String(x.id) === saidBy) || cs[0];
            const ip = c ? charIP(c) : null;
            const card = (tag, ico, big, sub, cls) => `<div class="gf-pc ${cls}">
                <div class="gf-pc-l"><div class="gf-tag">${esc(tag)}</div>
                  <div class="gf-pc-big">${esc(big)}</div><div class="gf-sub">${esc(sub)}</div></div>
                <div class="gf-ico">${ico}</div></div>`;
            inner = `<div class="gf-stack">
                  ${card('你', d.showReal ? d.ico : FSVG.na, d.showReal ? d.temp : '—',
                         (S.user.city || '还没填城市').split('（')[0], 'me')}
                  ${card(c ? c.name : '角色', ip ? ip.ico : FSVG.na, ip ? ip.wshort : '—',
                         ip ? (ip.place || '不知道在哪儿') : '还没有角色', 'ta')}
                </div>${fSayBlock()}${fCtl()}`;

        } else if (k === 'w-ip-vs') {
            // 温差对照：中间一条横轴，两个点标在各自温度的位置上，差多少一眼看出来
            const c = cs.find(x => String(x.id) === saidBy) || cs[0];
            const ip = c ? charIP(c) : null;
            const meT = d.showReal && d.r ? (d.r.tnow != null ? d.r.tnow : d.r.tmax) : null;
            // 虚构天气没有度数，用天气类型排个序当"冷热"：雪0 雨1 阴2 多云3 晴4
            const ORD = { snow: 0, rain: 1, fog: 1, storm: 1, cloud: 2, part: 3, sun: 4, na: 2 };
            const taOrd = ip && ip.wtxt ? ORD[ficIcoKey(ip.wtxt)] : null;
            const mePct = meT == null ? 50 : Math.max(6, Math.min(94, (meT + 10) / 50 * 100));
            const taPct = taOrd == null ? 50 : (10 + taOrd * 20);
            inner = `<div class="gf-vs">
                  <div class="gf-vs-row"><span class="gf-tag">你</span>
                    <b>${d.showReal ? d.temp : '—'}</b>
                    <span class="gf-sub">${esc((S.user.city || '还没填城市').split('（')[0])}</span></div>
                  <div class="gf-axis">
                    <i class="gf-pin me" style="left:${mePct}%" title="你"></i>
                    <i class="gf-pin ta" style="left:${taPct}%" title="${esc(c ? c.name : '')}"></i>
                  </div>
                  <div class="gf-vs-row"><span class="gf-tag">${esc(c ? c.name : '角色')}</span>
                    <b>${ip ? ip.wshort : '—'}</b>
                    <span class="gf-sub">${esc(ip ? (ip.place || '不知道在哪儿') : '还没有角色')}</span></div>
                </div>${fCtl('say')}`;

        } else if (k === 'w-ip-mini') {
            // 双胶囊：最省地方的一种，两个小胶囊并排
            const c = cs.find(x => String(x.id) === saidBy) || cs[0];
            const ip = c ? charIP(c) : null;
            const pill = (ico, a2, b2) => `<div class="gf-cap"><span class="gf-ico">${ico}</span>
                <span class="gf-cap-t"><b>${esc(a2)}</b><i>${esc(b2)}</i></span></div>`;
            inner = `<div class="gf-caps">
                  ${pill(d.showReal ? d.ico : FSVG.na, d.showReal ? d.temp : '—', (S.user.city || '你').split('（')[0])}
                  ${pill(ip ? ip.ico : FSVG.na, ip ? ip.wshort : '—', c ? c.name : '角色')}
                </div>`;

        } else if (k === 't-paper') {
            const t = clockData(), L = locData();
            inner = `<div class="gf-top gf-up">${t.wEn}<span>${esc(L.temp)} / ${esc(L.desc || L.place)}</span></div>
                <div class="gf-rule"></div>
                <div class="gf-big"><div class="gf-clock gf-serif" style="font-style:italic">${t.hhmm}</div>
                  <div class="gf-sig"><i class="gf-script">${esc(L.short)}</i><u>${esc(L.isChar ? L.who : '气象局')}</u></div></div>
                <div class="gf-rule thin"></div>
                <div class="gf-bot">${t.ymd} — ${t.wEn.slice(0, 3).charAt(0) + t.wEn.slice(1, 3).toLowerCase()}.</div>`;
        } else if (k === 't-ticket') {
            const t = clockData(), L = locData();
            inner = `<div class="gf-tk">
                  <div class="gf-hi">${t.hello}</div>
                  <div class="gf-dash"></div>
                  <div class="gf-kv gf-mono"><b>${t.tz}</b><span>${t.hhmm} ${t.ampm}</span></div>
                  <div class="gf-kv gf-mono"><b>${t.wEn.charAt(0) + t.wEn.slice(1).toLowerCase()}</b><span>${t.ymd}</span></div>
                  <div class="gf-kv gf-mono"><b>${esc(L.temp)}</b><span>${esc(L.desc || '—')}</span></div>
                  <div class="gf-kv last"><b>Location</b><span>${esc(L.place)}</span></div>
                </div>
                <div class="gf-code"><div class="gf-bars">${barsHtml(t.code, 22, true)}</div>
                  <div class="gf-vtxt gf-mono">${t.code} ${t.wEn.slice(0, 3).charAt(0) + t.wEn.slice(1, 3).toLowerCase()}.</div></div>`;
        } else if (k === 't-hero') {
            const t = clockData(), L = locData();
            inner = `<div class="gf-hrow"><div class="gf-clock">${t.hhmm}</div>
                  <div class="gf-vline"></div>
                  <div class="gf-hcol"><b class="gf-up">${t.wEn}</b><span>${t.ymd2}</span></div></div>
                <div class="gf-place">${FI.map}${esc(L.place)}</div>`;
        } else if (k === 't-glass') {
            const t = clockData(), L = locData();
            inner = `<div class="gf-cal">
                  <div class="gf-day"><u>${t.mo}</u><b>${t.da}</b></div>
                  <div class="gf-yj"><i><em class="y">宜</em>${t.yi}</i><i><em class="j">忌</em>${t.ji}</i></div>
                </div>
                <div class="gf-rt">
                  <div class="gf-loc">${esc(L.place)}</div>
                  <div class="gf-clock">${t.hhmm}</div>
                  <div class="gf-wx"><b>${esc(L.temp)}</b>　${esc(L.full || L.desc || '—')}</div>
                </div>`;
        } else if (k === 't-dark') {
            const t = clockData(), L = locData();
            inner = `<div class="gf-tl">
                  <div class="gf-tli"><o class="f"></o><u>${esc(L.short)}<br>${esc(L.isChar ? L.who : '气象局')}</u></div>
                  <div class="gf-tli"><o class="e"></o><u>${esc(L.temp)} ${esc(L.desc || '')}</u></div>
                </div>
                <div class="gf-rt">
                  <div class="gf-dt gf-mono">${t.ymd}</div>
                  <div class="gf-clock gf-mono">${t.hhmm}</div>
                  <div class="gf-week">${W_CN.map((w, i) => `<i class="${i === t.dow ? 'on' : ''}">${w}</i>`).join('')}</div>
                </div>`;
        } else if (k === 'w-ips') {
            // 📍 一群人各自的属地：谁在哪儿、那边什么天，各算各的
            const rows = cs.slice(0, 5).map(c => {
                const ip = charIP(c);
                return `<div class="gf-tp">${fAvBtn(c)}<span class="gf-n">${esc(c.name)}</span>
                    <span class="gf-w">${esc(ip.place)}</span>
                    <span class="gf-chip" title="${esc(ip.wtxt || '这边还没编天气')}"><span class="gf-ico">${ip.ico}</span>${esc(ip.wshort)}</span></div>`;
            }).join('') || '<div style="font-size:11.5px;color:#8b98a5">还没有角色。</div>';
            inner = `<div class="gf-whd"><div class="gf-tag">你</div><span class="gf-n">${esc(d.showReal ? ((S.user.city || '').split('（')[0] || '还没填城市') : '还没填城市')}</span>
                  <span class="gf-chip"><span class="gf-ico">${d.showReal ? d.ico : FSVG.na}</span>${d.showReal ? d.temp : '—'}</span></div>
                <div class="gf-line"></div>
                <div class="gf-rows">${rows}</div>
                ${saidText ? fSayBlock() : ''}
                ${fCtl()}`;
        }
        box.innerHTML = fHead() + inner;
        fApplySize();   // 拖边缘调过大小的话，重画之后套回去
    }

    window.gymapFloatShow = function () {
        const f = document.getElementById('gymapFloat'); if (!f) return;
        S.float.on = true; f.classList.add('on'); save(); paintFloat(); renderPanel();
    };
    window.gymapFloatHide = function () {
        const f = document.getElementById('gymapFloat'); if (!f) return;
        S.float.on = false; fPickOpen = false; f.classList.remove('on'); save(); renderPanel();
        if (typeof showToast === 'function') showToast('<div class="avatar" style="width:40px;height:40px;background:#1d9bf0;color:#fff;font-size:19px;">🗺️</div>', '悬浮窗收起来了', '想再打开：设置 → 行程与天气 → 天气 → 悬浮窗。', null, null, false);
    };
    window.gymapFloatToggle = function () { S.float.on ? gymapFloatHide() : gymapFloatShow(); };
    // 🧭 轮着换"看谁那边的天气"：你自己 → 挨个角色 → 转回你自己
    window.gymapFloatSrcCycle = function () {
        const list = ['me'].concat(chars().map(c => String(c.id)));
        const i = list.indexOf(String(S.float.src || 'me'));
        S.float.src = list[(i + 1) % list.length];
        save(); paintFloat(); renderPanel();
        const c = chars().find(x => String(x.id) === String(S.float.src));
        if (typeof showToast === 'function')
            showToast('', '现在看的是', c ? (c.name + ' 那边的天气') : '你自己这边的天气', null, null, false);
    };
    window.gymapFloatSrc = function (v) { S.float.src = v; save(); paintFloat(); renderPanel(); };

    window.gymapFloatSkin = function (k) { S.float.skin = fSkinInfo(k).k; fResetSize(); save(); paintFloat(); renderPanel(); };
    window.gymapFloatCat = function (cat) {
        const c = FSKIN_CATS.find(x => x.cat === cat); if (!c) return;
        const cur = fSkinInfo(S.float.skin);
        const i = cur.cat === cat ? (c.variants.findIndex(v => v.k === cur.k) + 1) % c.variants.length : 0;
        gymapFloatSkin(c.variants[i].k);
    };
    window.gymapFloatNextSkin = function () {
        const i = FALL.findIndex(v => v.k === fSkinInfo(S.float.skin).k);
        gymapFloatSkin(FALL[(i + 1) % FALL.length].k);
    };
    // 点主键：只有一个角色就直接说；多个角色才把头像那行展开让你挑
    window.gymapFloatPick = function () {
        const cs = fChars();
        if (!cs.length) { if (typeof showToast === 'function') showToast('', '还没有角色', '先建个角色，TA 才能跟你说天气。', null, null, false); return; }
        if (cs.length === 1) return gymapFloatSay(cs[0].id);
        fPickOpen = !fPickOpen; paintFloat();
    };
    window.gymapFloatSay = function (cid) {
        let id = cid;
        if (!id) {
            const cs = fChars();
            if (!cs.length) { if (typeof showToast === 'function') showToast('', '还没有角色', '先建个角色，TA 才能跟你说天气。', null, null, false); return; }
            id = (cs.find(c => String(c.id) === saidBy) || cs[0]).id;
        }
        fPickOpen = false;
        return gymapAskSay(id);
    };

    let tab = 'map';
    window.gymapOpen = function () { document.getElementById('gymapModal').classList.add('on'); renderPanel(); };
    window.gymapClose = function () { document.getElementById('gymapModal').classList.remove('on'); editingSpot = null; };
    window.gymapTab = function (t) { tab = t; editingSpot = null; renderPanel(); };
    window.gymapOpenW = function () { document.getElementById('gymapWPop').classList.add('on'); renderWeatherPop(); };
    window.gymapCloseW = function () { document.getElementById('gymapWPop').classList.remove('on'); };

    function renderPanel() {
        try { paintFloat(); } catch (e) {}
        const box = document.getElementById('gymapModal');
        if (!box || !box.classList.contains('on')) return;
        ['map', 'move', 'date', 'weather'].forEach(t => {
            const el = document.getElementById('gymapTab-' + t);
            if (el) el.className = 'gymap-tab' + (t === tab ? ' on' : '');
        });
        const b = document.getElementById('gymapBody');
        b.innerHTML = tab === 'map' ? tabMap() : tab === 'move' ? tabMove() : tab === 'date' ? tabDate() : tabWeather();
        if (tab === 'map') bindCanvas();
    }

    // ===== 地图页 =====
    function tabMap() {
        const facs = factions();
        if (!facs.length) return '<div class="gymap-hint" style="padding:20px 0;text-align:center;">还没有势力。<br>先去「势力总览」建一个势力，再回来给它画地图。</div>';
        if (!S.curFaction || !facs.includes(S.curFaction)) S.curFaction = facs[0];
        const f = S.curFaction, st = setOf(f), M = mapOf(f);

        const facBtns = facs.map(x => `<button class="gymap-mini ${x === f ? 'on' : ''}" onclick="gymapPickFaction('${esc(x)}')">${esc(x)}</button>`).join('');
        const mapBtns = st.list.map((m, i) => `<button class="gymap-mini ${i === st.cur ? 'on' : ''}" onclick="gymapPickMap(${i})">${esc(m.name)}${m.share === 'all' ? ' 🌍' : (m.share && m.share.length ? ' 🤝' : '')}</button>`).join('');
        const modeBtns = [['image', '🖼️ 底图模式', '传一张图，在图上点一下加地点'],
                          ['free', '🧭 自由摆点', '空白网格上摆位置，不用找图'],
                          ['list', '📋 纯列表', '不要图，就一份地点清单']]
            .map(([k, n, d]) => `<button class="gymap-mini ${M.mode === k ? 'on' : ''}" onclick="gymapSetMode('${k}')" title="${d}">${n}</button>`).join('');

        // 这张图共享给谁——解决"角色分在不同势力、但其实是同一个世界"的情况
        const shareBtns = `<button class="gymap-mini ${M.share === 'all' ? 'on' : ''}" onclick="gymapShareAll()">🌍 全世界通用</button>`
            + facs.filter(x => x !== f).map(x => {
                const on = M.share !== 'all' && (M.share || []).indexOf(x) >= 0;
                return `<button class="gymap-mini ${on ? 'on' : ''}" onclick="gymapShareTo('${esc(x)}')">${esc(x)}</button>`;
            }).join('');

        // 分类筛选
        const used = new Set((M.spots || []).map(sp => sp.cat).filter(Boolean));
        const catBtns = `<button class="gymap-mini ${!S.catFilter ? 'on' : ''}" onclick="gymapCatFilter('')">全部</button>`
            + cats().map(c => `<button class="gymap-mini ${S.catFilter === c.id ? 'on' : ''}" onclick="gymapCatFilter('${c.id}')">${c.icon} ${esc(c.name)}${used.has(c.id) ? '' : ' ·'}</button>`).join('');
        const shown = (M.spots || []).filter(sp => !S.catFilter || sp.cat === S.catFilter);

        let body = '';
        if (M.mode === 'list') {
            body = shown.length ? shown.map(sp => spotRow(sp, f)).join('')
                : `<div class="gymap-hint">${(M.spots || []).length ? '这个分类下没有地点。' : '这张图还没有地点。下面加一个。'}</div>`;
        } else {
            const wf = S.weather.fic[f];
            const wr = S.weather.real;
            const badge = (S.weather.mode !== 'real' && wf && wf.day === today())
                ? `<div class="gymap-wbadge">${esc(wf.text)}</div>`
                : (S.weather.mode !== 'fiction' && wr && S.user.city ? `<div class="gymap-wbadge">${wIcon(wr.code)} ${S.user.city.split('（')[0]} ${wr.tmin}~${wr.tmax}℃</div>` : '');
            body = `<div class="gymap-canvas ${M.mode === 'free' ? 'free' : ''}" id="gymapCanvas"
                      style="${M.mode === 'image' && M.bg ? `background-image:url('${M.bg}')` : ''}">
                    ${badge}
                    ${shown.map(sp => `
                      <div class="gymap-spot" data-spot="${sp.id}" style="left:${sp.x}%;top:${sp.y}%">
                        <div class="gymap-pin">${catIcon(sp.cat)}</div>
                        <div class="gymap-pname">${esc(sp.name)}</div>
                        <div class="gymap-who">${charsAt(sp.id).map(c => avatar(c)).join('')}</div>
                      </div>`).join('')}
                  </div>
                  <div class="gymap-hint" style="margin-top:8px;">
                    ${M.mode === 'image' && !M.bg ? '还没传底图。传一张之后就能在图上点了。<br>' : ''}
                    在空白处<b>点一下</b>加地点；<b>拖</b>地点图标可以挪位置；<b>拖角色头像</b>可以把 TA 移到别的地点；点地点名字能改。
                  </div>
                  ${shown.map(sp => spotRow(sp, f)).join('')}`;
        }

        return `
        <div class="gymap-sec">
          <h4>🏳️ 哪个势力</h4>
          <div class="gymap-modes">${facBtns}</div>
          <h4>🗺️ 这个势力的地图（${st.list.length}）</h4>
          <div class="gymap-modes">${mapBtns}</div>
          <input class="gymap-in" id="gymapNewMap" placeholder="再加一张图，叫什么？比如「医院内部」「临安全城」" onkeydown="if(event.key==='Enter')gymapAddMap()">
          <button class="gymap-btn" onclick="gymapAddMap()">＋ 新建地图</button>
          <button class="gymap-btn ghost" onclick="gymapRenameMap()">重命名</button>
          ${st.list.length > 1 ? `<button class="gymap-btn danger" onclick="gymapDelMap()">删掉这张图</button>` : ''}
          <h4 style="margin-top:12px;">🤝 这张图谁能用</h4>
          <div class="gymap-hint">角色分在不同势力、但其实是同一个世界的时候，把这张图<b>共享</b>给那几个势力（或者直接设成全世界通用），
            他们就能站到同一张图上、也能在这儿碰面、互相约。</div>
          <div class="gymap-modes">${shareBtns}</div>
          <h4 style="margin-top:12px;">🗂️ 这张图的形式</h4>
          <div class="gymap-modes">${modeBtns}</div>
          ${M.mode === 'image' ? `<button class="gymap-btn ghost" onclick="gymapPickBg()">${M.bg ? '换一张底图' : '📁 传一张底图'}</button>
            ${M.bg ? '<button class="gymap-btn danger" onclick="gymapClearBg()">去掉底图</button>' : ''}
            ${M.bg ? '<button class="gymap-btn" onclick="gymapReadBg()">🔍 让 AI 看图标点</button>' : ''}
            <div id="gymapVisionStatus" style="font-size:12px;color:#8b98a5;margin-top:6px;"></div>
            ${M.bg ? '<div class="gymap-hint">把这张底图直接发给模型，让它认出图上写的地名/建筑，按位置自动打点。<b>要用支持识图的模型</b>（GPT-4o、Claude、Gemini、通义 VL 之类）；纯文本模型会说看不到图。</div>' : ''}` : ''}
        </div>
        ${editingSpot ? editForm(editingSpot, f) : ''}
        <div class="gymap-sec">
          <h4>📍 地点（${shown.length}${S.catFilter ? ' / 共 ' + (M.spots || []).length : ''}）</h4>
          <div class="gymap-modes">${catBtns}</div>
          ${body}
          <div style="margin-top:10px;">
            <input class="gymap-in" id="gymapNewSpot" placeholder="新地点叫什么？比如「临安中心医院·普外科」">
            <button class="gymap-btn" onclick="gymapAddSpot()">＋ 加地点</button>
          </div>
        </div>

        <div class="gymap-sec">
          <h4>🏷️ 地点分类</h4>
          <div class="gymap-hint">自己定分类，加完之后每个地点都能选一类，上面那排就能点着筛。</div>
          ${cats().map(c => `<span class="gymap-mini" style="cursor:default">${c.icon} ${esc(c.name)}
            <b style="color:#f91880;cursor:pointer;margin-left:4px;" onclick="gymapDelCat('${c.id}')">×</b></span>`).join('')}
          <div style="margin-top:8px;">
            <input class="gymap-in" id="gymapNewCat" placeholder="新分类，可以在前面带个 emoji，比如「🏥 医疗」" onkeydown="if(event.key==='Enter')gymapAddCat()">
            <button class="gymap-btn" onclick="gymapAddCat()">＋ 加分类</button>
          </div>
        </div>

        <div class="gymap-sec">
          <h4>🤖 让 AI 按世界观生成地图</h4>
          <div class="gymap-hint">读这个势力里角色的人设 + TA 们挂的世界书（还有全局世界书，<b>不截断，有多少发多少</b>），一次生成一批地点，并且自动归类。
            下面<b>不填就完全按这些来</b>；填了就按你说的来。已有的同名地点不会被覆盖。</div>
          <textarea class="gymap-in" id="gymapGenReq" rows="2" placeholder="有什么要求？比如「以医院为中心，要有住院部、天台、停车场、对面那家便利店」——不填就按人设和世界书自己生成"></textarea>
          <button class="gymap-btn" onclick="gymapGenMap()">🤖 生成地点</button>
          <button class="gymap-btn ghost" onclick="gymapGenMap(true)">再生成一批（不动已有的）</button>
          <div id="gymapGenStatus" style="font-size:12px;color:#8b98a5;margin-top:6px;"></div>
        </div>`;
    }
    function avatar(c) {
        if (c.avatarImg) return `<div class="gymap-av" draggable="true" data-char="${c.id}" title="${esc(c.name)}（拖到别的地点）" style="background-image:url('${c.avatarImg}')"></div>`;
        return `<div class="gymap-av" draggable="true" data-char="${c.id}" title="${esc(c.name)}（拖到别的地点）">${esc(c.avatarEmoji || (c.name || '?')[0])}</div>`;
    }
    function spotRow(sp, f) {
        const who = charsAt(sp.id);
        const ct = catOf(sp.cat);
        return `<div class="gymap-row">
            <div class="gymap-pin" style="position:static;flex:0 0 auto;">${catIcon(sp.cat)}</div>
            <div class="gymap-row-m" onclick="gymapEditSpot('${sp.id}')" style="cursor:pointer">
              <b>${esc(sp.name)}</b>
              <span>${ct ? esc(ct.name) + ' · ' : ''}${sp.desc ? esc(sp.desc) + ' · ' : ''}${who.length ? '此刻在这儿：' + esc(who.map(c => c.name).join('、')) : '没人'}</span>
            </div>
            <button class="gymap-mini" onclick="gymapAskDate('${sp.id}')">🤝 约</button>
            <button class="gymap-mini" onclick="gymapEditSpot('${sp.id}')">编辑</button>
            <button class="gymap-mini" onclick="gymapDelSpot('${sp.id}')">删</button>
        </div>`;
    }
    function editForm(id, f) {
        const sp = (mapOf(f).spots || []).find(s => s.id === id);
        if (!sp) return '';
        const here = charsAt(id).map(c => String(c.id));
        const catBtns = `<button class="gymap-mini ${!sp.cat ? 'on' : ''}" onclick="gymapSetSpotCat('${id}','')">不分类</button>`
            + cats().map(c => `<button class="gymap-mini ${sp.cat === c.id ? 'on' : ''}" onclick="gymapSetSpotCat('${id}','${c.id}')">${c.icon} ${esc(c.name)}</button>`).join('');
        // 这张图共享给了谁，谁家的角色就都能站上来
        const M = mapOf(f), can = mapUsers(f, M);
        const pickable = chars().filter(c => facOf(c).some(x => can.indexOf(x) >= 0));
        return `<div class="gymap-edit">
            <h4 style="margin-top:0;color:#1d9bf0;font-size:13px;">✏️ 编辑「${esc(sp.name)}」</h4>
            <input class="gymap-in" id="gymapEName" value="${esc(sp.name)}" placeholder="地点名">
            <input class="gymap-in" id="gymapEDesc" value="${esc(sp.desc || '')}" placeholder="一句话描述（会告诉角色这是个什么地方）">
            <div class="gymap-hint" style="margin:2px 0 6px;">属于哪一类：</div>
            <div class="gymap-modes">${catBtns}</div>
            <div class="gymap-hint" style="margin:2px 0 6px;">谁在这儿（点头像切换）：</div>
            <div class="gymap-picks">${pickable.map(c => `
                <button class="gymap-pick ${here.includes(String(c.id)) ? 'on' : ''}" onclick="gymapPutChar('${c.id}','${id}')">
                  ${avatar(c).replace('draggable="true"', '')}${esc(c.name)}</button>`).join('') || '<span class="gymap-hint">这张图还没有能站上来的角色（可以在上面把图共享给别的势力）</span>'}</div>
            <div style="margin-top:10px;">
              <button class="gymap-btn" onclick="gymapSaveSpot('${id}')">保存</button>
              <button class="gymap-btn ghost" onclick="gymapCancelEdit()">取消</button>
            </div>
        </div>`;
    }

    // ---- 多地图 / 共享 / 分类 ----
    window.gymapPickMap = function (i) { setOf(S.curFaction).cur = i; editingSpot = null; save(); renderPanel(); };
    window.gymapAddMap = function () {
        const el = document.getElementById('gymapNewMap');
        const name = ((el && el.value) || '').trim() || ('地图 ' + (mapsOf(S.curFaction).length + 1));
        const st = setOf(S.curFaction);
        st.list.push(newMap(name)); st.cur = st.list.length - 1;
        if (el) el.value = '';
        save(); renderPanel();
    };
    window.gymapRenameMap = function () {
        const el = document.getElementById('gymapNewMap');
        const name = ((el && el.value) || '').trim();
        if (!name) { const s2 = document.getElementById('gymapGenStatus'); if (s2) s2.innerText = '在上面那个框里写新名字，再点重命名。'; return; }
        mapOf(S.curFaction).name = name;
        if (el) el.value = '';
        save(); renderPanel();
    };
    window.gymapDelMap = function () {
        const st = setOf(S.curFaction);
        if (st.list.length <= 1) return;
        const gone = st.list.splice(st.cur, 1)[0];
        st.cur = 0; editingSpot = null;
        // 站在这张图上的角色得挪走，不然就"人在一个不存在的地方"
        (gone.spots || []).forEach(sp => Object.keys(S.charLoc).forEach(k => { if (S.charLoc[k] === sp.id) delete S.charLoc[k]; }));
        save(); renderPanel();
    };
    window.gymapShareAll = function () {
        const M = mapOf(S.curFaction);
        M.share = (M.share === 'all') ? [] : 'all';
        save(); renderPanel();
    };
    window.gymapShareTo = function (fac) {
        const M = mapOf(S.curFaction);
        if (M.share === 'all') M.share = [];
        if (!Array.isArray(M.share)) M.share = [];
        const i = M.share.indexOf(fac);
        if (i >= 0) M.share.splice(i, 1); else M.share.push(fac);
        save(); renderPanel();
    };
    window.gymapCatFilter = function (id) { S.catFilter = id; save(); renderPanel(); };
    window.gymapAddCat = function () {
        const el = document.getElementById('gymapNewCat');
        let raw = ((el && el.value) || '').trim();
        if (!raw) return;
        // 开头那个 emoji 当图标，剩下的当名字
        const m = raw.match(/^(\S{1,3})\s+(.+)$/);
        let icon = '📍', name = raw;
        if (m && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(m[1])) { icon = m[1]; name = m[2]; }
        if (!Array.isArray(S.cats)) S.cats = DEF_CATS.map(c => Object.assign({}, c));
        S.cats.push({ id: uid('c'), name: name.trim(), icon });
        if (el) el.value = '';
        save(); renderPanel();
    };
    window.gymapDelCat = function (id) {
        if (!Array.isArray(S.cats)) return;
        S.cats = S.cats.filter(c => c.id !== id);
        allSpots().forEach(sp => { if (sp.cat === id) { const r = findSpotRaw(sp.id); if (r) r.cat = ''; } });
        if (S.catFilter === id) S.catFilter = '';
        save(); renderPanel();
    };
    window.gymapSetSpotCat = function (spId, catId) {
        const r = findSpotRaw(spId); if (!r) return;
        r.cat = catId; save(); renderPanel();
    };
    // 在所有地图里找这个点的"原始对象"（allSpots 返回的是拷贝，改它没用）
    function findSpotRaw(id) {
        for (const f of Object.keys(S.mapSets)) {
            for (const m of (S.mapSets[f].list || [])) {
                const sp = (m.spots || []).find(x => x.id === id);
                if (sp) return sp;
            }
        }
        return null;
    }

    window.gymapPickFaction = function (f) { S.curFaction = f; editingSpot = null; save(); renderPanel(); };
    window.gymapSetMode = function (m) { mapOf(S.curFaction).mode = m; save(); renderPanel(); };
    window.gymapPickBg = function () {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = () => {
            const f = inp.files && inp.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = () => { mapOf(S.curFaction).bg = r.result; save(); renderPanel(); };
            r.readAsDataURL(f);
        };
        inp.click();
    };
    window.gymapClearBg = function () { mapOf(S.curFaction).bg = ''; save(); renderPanel(); };
    window.gymapAddSpot = function (x, y) {
        const el = document.getElementById('gymapNewSpot');
        let name = (el && el.value || '').trim();
        if (!name) { if (typeof x !== 'number') return alert('先给这个地点起个名字。'); name = '新地点'; }
        const M = mapOf(S.curFaction);
        M.spots.push({ id: uid('sp'), name, desc: '', cat: S.catFilter || '',
                       x: typeof x === 'number' ? x : 50, y: typeof y === 'number' ? y : 50 });
        if (el) el.value = '';
        save(); renderPanel();
    };

    // ---------- 🤖 按人设 + 世界书生成地图 ----------
    // 这个势力挂到的世界书：全局的 + 势力里角色各自挂的，按预算截断
    // ⚠️ 不做预算截断：有多少世界书就发多少，宁可贵一点也别把设定砍掉
    function wbFor(cs) {
        if (typeof worldbooks === 'undefined' || !Array.isArray(worldbooks)) return '';
        const ids = new Set();
        cs.forEach(c => (c.worldbooks || []).forEach(i => ids.add(i)));
        return worldbooks.filter(w => w && (w.isGlobal || ids.has(w.id)))
            .map(w => '【' + (w.title || '无题') + '】' + String(w.content || '')).join('\n');
    }
    // 新点摆在哪儿：错开排布，别叠在一起，也别贴边
    function spotXY(i, total) {
        const cols = Math.max(3, Math.ceil(Math.sqrt(total || 1)));
        const rows = Math.ceil((total || 1) / cols);
        const cx = i % cols, cy = Math.floor(i / cols);
        return {
            x: Math.round((12 + (76 / Math.max(1, cols - 1 || 1)) * cx + (cy % 2 ? 5 : 0)) * 10) / 10,
            y: Math.round((14 + (72 / Math.max(1, rows - 1 || 1)) * cy) * 10) / 10
        };
    }
    // ---------- 🔍 看图标点：把底图直接发给多模态模型，让它认图上的地名 ----------
    // 底图可能很大（用户随手传一张 4000px 的世界地图），先缩到 1280 再发，省钱也快
    function shrink(dataUrl, max) {
        return new Promise(resolve => {
            try {
                const img = new Image();
                img.onload = () => {
                    const sc = Math.min(1, max / Math.max(img.width, img.height));
                    if (sc >= 1) return resolve(dataUrl);
                    const cv = document.createElement('canvas');
                    cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
                    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                    resolve(cv.toDataURL('image/jpeg', 0.85));
                };
                img.onerror = () => resolve(dataUrl);
                img.src = dataUrl;
            } catch (e) { resolve(dataUrl); }
        });
    }
    let reading = false;
    window.gymapReadBg = async function () {
        const st = () => document.getElementById('gymapVisionStatus');
        const tell = m => { const e = st(); if (e) e.innerText = m; else if (typeof showToast === 'function') showToast('', '看图标点', m, null, null, false); };
        if (reading) { tell('还在看，等一下。'); return; }
        const f = S.curFaction, M = mapOf(f);
        if (!M.bg) { tell('这张图还没传底图。'); return; }
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { tell('还没配 API Key。'); return; }

        reading = true; tell('正在把底图缩小…');
        try {
            const img = await shrink(M.bg, 1280);
            const have = (M.spots || []).map(x => x.name);
            const cs = chars().filter(c => facOf(c).includes(f));
            const ask = `这是「${f}」的地图底图。请看图，把图上能认出来的地点标出来。
要求：
1. 只标图上<真的画了或者写了>的地方——图上有字就用图上的字，没字但明显是个建筑/区域就用一个贴切的名字。看不出来就别编。
2. x、y 是这个地点在图上的位置，用百分比，0 到 100：x 是从左边算的横向百分比，y 是从上边算的纵向百分比。要尽量准。
3. 能认出来的都标上，挑角色真的会去的。
4. cat 从这几个里挑一个：${cats().map(c => c.id + '(' + c.name + ')').join('、')}。
${have.length ? '5. 这些已经有了，别重复：' + have.join('、') + '\n' : ''}${cs.length ? '这张图上活动的角色：' + cs.map(c => c.name).join('、') + '\n' : ''}
只输出 JSON 数组，不要解释、不要 markdown 围栏：
[{"name":"地点名","desc":"一句话","cat":"分类id","x":34.5,"y":61.2}]
如果这张图上一个地点也认不出来（比如它其实是张风景照/纯底纹），就只输出 []`;

            tell('AI 正在看图…（识图比纯文字慢，等十几秒）');
            const data = await callChatCompletionAPI(api, ask, 2, [img]);
            const raw = (data.choices?.[0]?.message?.content || '');
            if (data.error) { tell('模型报错：' + (data.error.message || '未知')); return; }
            let list = (typeof parseModelJson === 'function') ? parseModelJson(raw) : JSON.parse(raw);
            if (list && !Array.isArray(list) && Array.isArray(list.spots)) list = list.spots;
            if (!Array.isArray(list)) { tell('模型没按格式回，可能这个模型不支持识图。它说：' + String(raw).slice(0, 60)); return; }
            if (!list.length) { tell('这张图上没认出地点——可能它不是地图，或者图上没写字。可以手动点着加。'); return; }

            const exist = new Set(have);
            let n = 0;
            list.forEach(it => {
                const name = String((it && (it.name || it.地点)) || '').trim().slice(0, 24);
                if (!name || exist.has(name)) return;
                exist.add(name);
                const cid = String((it && it.cat) || '').trim();
                const cx = Math.max(2, Math.min(98, parseFloat(it && it.x)));
                const cy = Math.max(2, Math.min(98, parseFloat(it && it.y)));
                M.spots.push({ id: uid('sp'), name, desc: String((it && it.desc) || '').trim().slice(0, 60),
                               cat: catOf(cid) ? cid : '',
                               x: isNaN(cx) ? 50 : cx, y: isNaN(cy) ? 50 : cy });
                n++;
            });
            await save();
            renderPanel();
            const e2 = st(); if (e2) e2.innerText = n ? ('图上认出并标了 ' + n + ' 个地点。位置不准的话直接拖。') : '认出来的都已经有了，没重复加。';
        } catch (err) {
            tell('看图失败：' + (err.message || err));
        } finally {
            reading = false;
        }
    };

    let genning = false;
    window.gymapGenMap = async function (more) {
        const st = () => document.getElementById('gymapGenStatus');
        const tell = m => { const e = st(); if (e) e.innerText = m; else if (typeof showToast === 'function') showToast('', '生成地图', m, null, null, false); };
        if (genning) { tell('还在生成，等一下。'); return; }
        const f = S.curFaction;
        if (!f) { tell('先选一个势力。'); return; }
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { tell('还没配 API Key，生成不了。'); return; }

        const M = mapOf(f);
        const cs = chars().filter(c => facOf(c).includes(f));
        const req = (document.getElementById('gymapGenReq') || {}).value || '';
        const have = (M.spots || []).map(s => s.name);

        genning = true; tell('正在读人设和世界书…');
        try {
            const personas = cs.map(c =>
                `· ${c.name}${c.persona ? '：' + String(c.persona).replace(/\s+/g, ' ') : ''}`).join('\n');
            const wb = wbFor(cs);
            const ask = `下面是一个叫「${f}」的势力，以及属于它的角色。
${personas ? '【这个势力里的角色】\n' + personas + '\n' : ''}${wb ? '【相关世界书设定】\n' + wb + '\n' : ''}${have.length ? '【已经有的地点，不要重复】\n' + have.join('、') + '\n' : ''}
${req.trim() ? '【我的要求（以这个为准）】\n' + req.trim() + '\n' : '（我没有额外要求，就完全按上面的人设和世界书来推。）'}

请给「${f}」列出 ${have.length ? 6 : 8} 个这些角色日常真的会去的具体地点。
要求：
1. 必须落在这个世界观里——现代都市就别出现城门客栈，古代江湖就别出现写字楼。
2. 要具体到一个"能站人"的地方：不是"医院"而是"普外科住院部三楼"，不是"公司"而是"顶楼办公室"。
3. 生活和工作都要有：上班的地方、住的地方、吃饭的地方、一个人躲清静的地方、会碰见别人的地方。
4. desc 一句话，写清楚这地方什么样、谁常在那儿。
5. 每个地点归一类，cat 只能从这几个里选：${cats().map(c => c.id + '(' + c.name + ')').join('、')}。
只输出 JSON 数组，不要任何解释、不要 markdown 围栏：
[{"name":"地点名","desc":"一句话","cat":"分类id"}]`;

            const base = cs[0] ? buildBasePrompt(cs[0], false, '') : '你是一个熟悉这个世界观的设定师。';
            const messages = buildStructuredMessages(base, [], ask);
            tell('AI 正在想这个世界里有哪些地方…');
            const data = await callChatCompletionAPI(api, messages);
            const raw = (data.choices?.[0]?.message?.content || '');
            let list = (typeof parseModelJson === 'function') ? parseModelJson(raw) : JSON.parse(raw);
            if (list && !Array.isArray(list) && Array.isArray(list.spots)) list = list.spots;
            if (!Array.isArray(list) || !list.length) { tell('AI 这次没给出能用的地点，再点一次试试。'); return; }

            const exist = new Set(have);
            const add = [];
            list.forEach(it => {
                const name = String((it && (it.name || it.地点 || it.title)) || '').trim().slice(0, 24);
                if (!name || exist.has(name)) return;
                exist.add(name);
                const cid = String((it && (it.cat || it.分类)) || '').trim();
                add.push({ name, desc: String((it && (it.desc || it.描述 || '')) || '').trim().slice(0, 60),
                           cat: catOf(cid) ? cid : '' });
            });
            if (!add.length) { tell('生成出来的地点这儿都已经有了，没重复添加。'); return; }

            const start = (M.spots || []).length;
            const total = start + add.length;
            add.forEach((it, i) => {
                const pos = spotXY(start + i, total);
                M.spots.push({ id: uid('sp'), name: it.name, desc: it.desc, cat: it.cat || '', x: pos.x, y: pos.y });
            });
            await save();
            tell('加了 ' + add.length + ' 个地点：' + add.map(a => a.name).join('、'));
            renderPanel();
            const e = st(); if (e) e.innerText = '加了 ' + add.length + ' 个地点：' + add.map(a => a.name).join('、');
        } catch (err) {
            tell('生成失败：' + (err.message || err));
        } finally {
            genning = false;
        }
    };
    window.gymapEditSpot = function (id) { editingSpot = id; renderPanel(); };
    window.gymapCancelEdit = function () { editingSpot = null; renderPanel(); };
    window.gymapSaveSpot = function (id) {
        const M = mapOf(S.curFaction);
        const sp = M.spots.find(s => s.id === id); if (!sp) return;
        const n = document.getElementById('gymapEName'), d = document.getElementById('gymapEDesc');
        if (n) sp.name = n.value.trim() || sp.name;
        if (d) sp.desc = d.value.trim();
        editingSpot = null; save(); renderPanel();
    };
    window.gymapDelSpot = function (id) {
        const M = mapOf(S.curFaction);
        M.spots = M.spots.filter(s => s.id !== id);
        Object.keys(S.charLoc).forEach(k => { if (S.charLoc[k] === id) delete S.charLoc[k]; });
        if (editingSpot === id) editingSpot = null;
        save(); renderPanel();
    };
    window.gymapPutChar = function (cid, sid) {
        cid = String(cid);
        if (S.charLoc[cid] === sid) delete S.charLoc[cid]; else S.charLoc[cid] = sid;
        save(); renderPanel();
    };

    // 画布上的点击加点 / 拖动
    function bindCanvas() {
        const cv = document.getElementById('gymapCanvas');
        if (!cv) return;
        cv.addEventListener('click', e => {
            if (e.target.closest('.gymap-spot')) return;
            const r = cv.getBoundingClientRect();
            const x = Math.round((e.clientX - r.left) / r.width * 100);
            const y = Math.round((e.clientY - r.top) / r.height * 100);
            const el = document.getElementById('gymapNewSpot');
            const name = (el && el.value || '').trim();
            if (!name) { if (el) { el.focus(); el.placeholder = '先在这里写个名字，再到图上点位置'; } return; }
            gymapAddSpot(x, y);
        });
        // 拖地点
        cv.querySelectorAll('.gymap-spot').forEach(el => {
            el.addEventListener('mousedown', ev => {
                if (ev.target.closest('.gymap-av')) return;
                dragSpot = el.dataset.spot; el.classList.add('drag'); ev.preventDefault();
            });
        });
        const move = ev => {
            if (!dragSpot) return;
            const r = cv.getBoundingClientRect();
            const x = Math.max(2, Math.min(98, (ev.clientX - r.left) / r.width * 100));
            const y = Math.max(4, Math.min(96, (ev.clientY - r.top) / r.height * 100));
            const el = cv.querySelector(`.gymap-spot[data-spot="${dragSpot}"]`);
            if (el) { el.style.left = x + '%'; el.style.top = y + '%'; }
        };
        const up = () => {
            if (!dragSpot) return;
            const el = cv.querySelector(`.gymap-spot[data-spot="${dragSpot}"]`);
            const sp = (mapOf(S.curFaction).spots || []).find(s => s.id === dragSpot);
            if (el && sp) { sp.x = parseFloat(el.style.left); sp.y = parseFloat(el.style.top); save(); }
            if (el) el.classList.remove('drag');
            dragSpot = null;
        };
        cv.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        // 拖角色头像到别的地点
        cv.querySelectorAll('.gymap-av').forEach(av => {
            av.addEventListener('dragstart', ev => { dragChar = av.dataset.char; ev.dataTransfer.effectAllowed = 'move'; });
        });
        cv.querySelectorAll('.gymap-spot').forEach(el => {
            el.addEventListener('dragover', ev => ev.preventDefault());
            el.addEventListener('drop', ev => {
                ev.preventDefault();
                if (!dragChar) return;
                S.charLoc[String(dragChar)] = el.dataset.spot;
                dragChar = null; save(); renderPanel();
            });
        });
    }

    // ===== 行程规则页 =====
    function tabMove() {
        const M = S.move;
        const rows = [
            ['bySchedule', '跟日程联动', '生成日程时把地点清单告诉 AI，让它把「几点在哪儿」写进日程；时间到了角色自动挪过去。<b>每 10 分钟对一次表，不额外花钱</b>（只是读已经生成好的日程文本）。'],
            ['byAutonomy', '自主模式里多一个「去某个地方」', 'TA 自己决定要不要换个地方待着，并说为什么去。需要自主模式开着。'],
            ['meetTheater', '同一个地点碰上就触发小剧场', '两个有关系的角色刚好在同一个地点，就可能撞上，直接进「Ta们在做什么」。<b>需要小剧场开关开着</b>（那个默认关）。'],
            ['manual', '允许我手动拖', '地图上直接拖角色头像换地方，或者在地点编辑里勾选。不花钱。']
        ];
        return `
        <div class="gymap-sec">
          <h4>🚶 角色怎么移动（四种都在，各自独立开关）</h4>
          ${rows.map(([k, n, d]) => `
            <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;margin-bottom:11px;">
              <input type="checkbox" ${M[k] ? 'checked' : ''} onchange="gymapSetMove('${k}',this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;">
              <span><b>${n}</b><br><span style="font-size:11.5px;color:#8b98a5;">${d}</span></span>
            </label>`).join('')}
        </div>
        <div class="gymap-sec">
          <h4>📌 现在谁在哪儿</h4>
          ${chars().length ? chars().map(c => {
            const sp = spotById(S.charLoc[String(c.id)]);
            return `<div class="gymap-row"><div class="gymap-row-m"><b>${esc(c.name)}</b>
              <span>${sp ? '在 ' + esc(sp.name) + (sp.faction ? '（' + esc(sp.faction) + '）' : '') : '还没定位置'}</span></div>
              ${sp ? `<button class="gymap-mini" onclick="gymapPutChar('${c.id}','${sp.id}')">拿掉</button>` : ''}</div>`;
          }).join('') : '<div class="gymap-hint">还没有角色。</div>'}
          <button class="gymap-btn ghost" style="margin-top:8px;" onclick="gymapSyncNow()">🔄 按现在的日程对一次位置</button>
          <div class="gymap-hint" style="margin-top:4px;">读每个角色今天的日程文本，看这个点该在哪个地点，然后挪过去。不调用 API。</div>
        </div>`;
    }
    window.gymapSetMove = function (k, v) { S.move[k] = !!v; save(); renderPanel(); };
    // 🎛️ 给「全部开关」页读当前状态用（js/54）
    window.gymapGetMove = k => !!(S.move && S.move[k]);

    // 按日程文本把角色挪到对应地点：找出日程里"当前时间段"那一行，看里面提到了哪个地点名
    function syncBySchedule() {
        if (!S.move.bySchedule) return 0;
        let moved = 0;
        const now = new Date(), curMin = now.getHours() * 60 + now.getMinutes();
        chars().forEach(c => {
            const sch = c.schedule && c.schedule.text;
            if (!sch) return;
            const mine = allSpots().filter(s => facOf(c).includes(s.faction));
            if (!mine.length) return;
            // 日程按行，每行开头通常是 08:00 这种时间
            let best = null, bestMin = -1;
            String(sch).split('\n').forEach(line => {
                const m = line.match(/(\d{1,2})[:：](\d{2})/);
                if (!m) return;
                const t = parseInt(m[1]) * 60 + parseInt(m[2]);
                if (t <= curMin && t > bestMin) { bestMin = t; best = line; }
            });
            if (!best) return;
            // 这一行里提到了哪个地点（取名字最长的那个，避免"医院"盖过"临安中心医院"）
            const hit = mine.filter(s => best.includes(s.name)).sort((a, b) => b.name.length - a.name.length)[0];
            if (hit && S.charLoc[String(c.id)] !== hit.id) { S.charLoc[String(c.id)] = hit.id; moved++; }
        });
        if (moved) save();
        return moved;
    }
    window.gymapSyncNow = function () {
        const n = syncBySchedule();
        renderPanel();
        if (typeof showToast === 'function') showToast('<div class="avatar" style="width:40px;height:40px;background:#1d9bf0;color:#fff;font-size:19px;">🗺️</div>',
            n ? `挪了 ${n} 个人` : '没人需要挪', n ? '按今天的日程对上了。' : '要么日程里没写地点名，要么大家已经在对的位置上了。', null, null, false);
    };

    // 同一个地点碰上 → 小剧场
    async function checkMeet() {
        if (!S.move.meetTheater) return;
        if (typeof runTheaterScene !== 'function') return;
        if (typeof isAutoOn === 'function' && !isAutoOn('charTheater')) return;   // 小剧场开关关着就不动
        const rels = (typeof charRelationships !== 'undefined' ? charRelationships : []);
        if (!rels.length) return;
        const pairs = rels.filter(r => {
            const a = S.charLoc[String(r.fromId)], b = S.charLoc[String(r.toId)];
            return a && b && a === b;
        });
        if (!pairs.length) return;
        try { await runTheaterScene(true); } catch (e) {}
    }

    // ===== 天气页 =====
    function tabWeather() {
        const w = S.weather;
        const modes = [['real', '只看真实天气'], ['fiction', '只看虚构天气'], ['both', '两个都看']]
            .map(([k, n]) => `<button class="gymap-mini ${w.mode === k ? 'on' : ''}" onclick="gymapSetWMode('${k}')">${n}</button>`).join('');
        const facs = factions();
        return `
        <div class="gymap-sec">
          <h4>🌤️ 要哪种天气</h4>
          <div class="gymap-modes">${modes}</div>
          <div class="gymap-hint">「真实」是你所在城市的实际天气（联网拿，免费不用注册）；「虚构」是让 AI 按你的世界观编——两个可以同时开，弹窗里会分开显示。</div>
        </div>

        <div class="gymap-sec">
          <h4>📍 你在哪儿</h4>
          ${S.user.city ? `<div class="gymap-hint">现在设的是：<b>${esc(S.user.city)}</b>　<button class="gymap-mini" onclick="gymapRefreshWeather()">刷新天气</button></div>` : ''}
          <input class="gymap-in" id="gymapCity" placeholder="填城市名，比如 杭州 / 临安 / Tokyo" onkeydown="if(event.key==='Enter')gymapSearchCity()">
          <button class="gymap-btn" onclick="gymapSearchCity()">搜索</button>
          <button class="gymap-btn ghost" onclick="gymapAutoLocate()">试试自动定位</button>
          <div class="gymap-hint" style="margin-top:2px;">
            ⚠️ 你要是双击 index.html（<code>file://</code>）打开的，浏览器<b>一律禁用自动定位</b>，这是规范硬限制不是权限问题；手填城市效果一样。
          </div>
          <div id="gymapCityHits"></div>
          <div id="gymapWStatus" style="font-size:12px;margin-top:6px;"></div>
          ${w.real ? `<div class="gymap-wcard" style="margin-top:8px;"><b>${esc(S.user.city)}</b>　${wIcon(w.real.code)} ${wDesc(w.real.code)}　${w.real.tmin}~${w.real.tmax}℃${w.real.tnow != null ? `　此刻 ${w.real.tnow}℃` : ''}${w.real.rain != null ? `　降水 ${w.real.rain}%` : ''}<br><span style="color:#8b98a5;font-size:11px;">${w.real.day === today() ? '今天拿的' : '不是今天的数据，点上面刷新'}</span></div>` : ''}
        </div>

        <div class="gymap-sec">
          <h4>🏳️ 各个势力那边的天气（虚构）</h4>
          ${facs.length ? facs.map(f => {
            const fw = w.fic[f];
            return `<div class="gymap-row"><div class="gymap-row-m"><b>${esc(f)}</b>
              <span>${fw ? esc(fw.text) + (fw.day === today() ? '' : '（不是今天的）') : '还没编'}</span></div>
              <button class="gymap-mini" onclick="gymapGenFicWeather('${esc(f)}')">${fw ? '重编' : '让 AI 编一个'}</button></div>`;
          }).join('') : '<div class="gymap-hint">还没有势力。</div>'}
        </div>

        <div class="gymap-sec">
          <h4>🔔 角色主动提醒</h4>
          <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" ${w.remind ? 'checked' : ''} onchange="gymapSetRemind(this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;">
            <span><b>每天最多一次，让角色提醒你今天的天气</b><br>
            <span style="font-size:11.5px;color:#8b98a5;">"今天降温五度，你那件外套记得穿"——按人设说话。一天一次，关掉就完全不主动花钱。</span></span>
          </label>
        </div>

        <div class="gymap-sec">
          <h4>🪟 悬浮窗</h4>
          <div class="gymap-hint">跟音乐盒一套样式的小窗，一直挂在屏幕上：天气、角色现在在哪儿，点头像让 TA 说一句。可以拖着放，位置会记住。</div>
          <button class="gymap-btn" onclick="gymapFloatToggle()">${S.float.on ? '收起悬浮窗' : '显示悬浮窗'}</button>
          <button class="gymap-btn ghost" onclick="gymapOpenW()">还是用老弹窗</button>
          <div class="gymap-hint" style="margin-top:8px;">点款式在同一类的几个样子之间轮换：</div>
          <div class="gymap-modes">${FSKIN_CATS.map(c => {
            const on = fSkinInfo(S.float.skin).cat === c.cat;
            return `<button class="gymap-mini ${on ? 'on' : ''}" onclick="gymapFloatCat('${c.cat}')">${c.icon} ${c.name}</button>`;
          }).join('')}</div>
          ${FSKIN_CATS.map(c => `<div style="margin-top:6px;"><b style="font-size:11.5px;color:#8b98a5;">${c.name}</b><div style="margin-top:4px;">${
            c.variants.map(v => `<button class="gymap-mini ${v.k === S.float.skin ? 'on' : ''}" onclick="gymapFloatSkin('${v.k}')">${v.n} ${v.d}</button>`).join('')
          }</div></div>`).join('')}
        </div>`;
    }
    window.gymapSetWMode = function (m) { S.weather.mode = m; save(); renderPanel(); };
    window.gymapSetRemind = function (v) { S.weather.remind = !!v; save(); renderPanel(); };
    // 🎛️ 给「全部开关」页读当前状态用（js/54）
    window.gymapGetRemind = () => !!(S.weather && S.weather.remind);

    // ===== 天气弹窗 =====
    let saidBy = null, saidText = '';
    function renderWeatherPop() {
        try { paintFloat(); } catch (e) {}
        const box = document.getElementById('gymapWBox');
        const pop = document.getElementById('gymapWPop');
        if (!box || !pop || !pop.classList.contains('on')) return;
        const w = S.weather;
        const r = w.real;
        const showReal = (w.mode !== 'fiction') && r;
        const ficList = (w.mode !== 'real') ? Object.keys(w.fic).filter(f => w.fic[f] && w.fic[f].day === today()) : [];

        let main = '';
        if (showReal) {
            main = `<div class="gymap-wmain">
                <div class="gymap-wicon">${wIcon(r.code)}</div>
                <div class="gymap-wtemp">${r.tnow != null ? r.tnow : r.tmax}℃</div>
                <div class="gymap-wsub"><b>${esc(S.user.city)}</b><br>${wDesc(r.code)}　${r.tmin}~${r.tmax}℃${r.rain != null ? `　降水概率 ${r.rain}%` : ''}</div>
            </div>`;
        } else if (ficList.length) {
            main = `<div class="gymap-wmain"><div class="gymap-wicon">🗺️</div>
                <div class="gymap-wsub" style="margin-top:8px;">${esc(w.fic[ficList[0]].text)}<br><b>${esc(ficList[0])}</b></div></div>`;
        } else {
            main = `<div class="gymap-wmain"><div class="gymap-wicon">🌡️</div>
                <div class="gymap-wsub" style="margin-top:8px;">还没有天气数据。<br>去「行程与天气 → 天气」填个城市，或者让 AI 编一个虚构天气。</div></div>`;
        }

        const others = ficList.filter((f, i) => !(showReal ? false : i === 0))
            .map(f => `<div class="gymap-wcard"><b>${esc(f)}</b>　${esc(w.fic[f].text)}</div>`).join('');

        // 下面选角色让 TA 说一句
        const picks = chars().map(c => {
            const sp = spotById(S.charLoc[String(c.id)]);
            return `<button class="gymap-pick ${saidBy === String(c.id) ? 'on' : ''}" onclick="gymapAskSay('${c.id}')">
                ${avatar(c).replace('draggable="true"', '')}${esc(c.name)}${sp ? `<span style="color:#8b98a5;font-size:10.5px;">·${esc(sp.name)}</span>` : ''}</button>`;
        }).join('');

        box.innerHTML = `
            <div style="display:flex;align-items:center;">
              <b style="color:#1d9bf0;font-size:15px;">🌤️ 今天的天气</b>
              <button class="gymap-btn ghost" style="margin-left:auto;padding:4px 10px;" onclick="gymapCloseW()">关闭</button>
            </div>
            ${main}${others}
            ${showReal && r.day !== today() ? '<div class="gymap-hint" style="text-align:center">这不是今天的数据 <button class="gymap-mini" onclick="gymapRefreshWeather()">刷新</button></div>' : ''}
            <div style="font-size:12px;color:#8b98a5;margin-top:10px;">让谁说一句：</div>
            <div class="gymap-picks">${picks || '<span class="gymap-hint">还没有角色</span>'}</div>
            ${saidText ? `<div class="gymap-say"><b>${esc((chars().find(c => String(c.id) === saidBy) || {}).name || '')}</b>${esc(saidText)}</div>` : ''}
            <div id="gymapSayStatus" style="font-size:11.5px;color:#8b98a5;margin-top:6px;"></div>`;
    }

    window.gymapAskSay = async function (cid) {
        const c = chars().find(x => String(x.id) === String(cid));
        if (!c) return;
        saidBy = String(cid); saidText = ''; renderWeatherPop();
        const st = document.getElementById('gymapSayStatus');
        // 弹窗关着的时候（比如从悬浮窗点的），状态直接写进悬浮窗那句话的位置
        const say = (msg) => {
            if (st) st.innerText = msg;
            const fs = document.querySelector('#gymapFBox .gf-say');
            if (fs) { fs.style.color = '#8b98a5'; fs.innerText = msg; }
            else if (!st && typeof showToast === 'function') showToast('', c.name, msg, null, null, false);
        };
        say('正在想…');
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { say('还没配 API Key。'); return; }
        try {
            const w = S.weather, r = w.real;
            let ctx = '';
            if ((w.mode !== 'fiction') && r && S.user.city)
                ctx += `${(typeof userDisplayName === 'function') ? userDisplayName(c) : '对方'}所在的${S.user.city}今天：${wDesc(r.code)}，${r.tmin}~${r.tmax}℃${r.rain != null ? `，降水概率${r.rain}%` : ''}。\n`;
            const myFac = facOf(c).find(f => w.fic[f] && w.fic[f].day === today());
            if ((w.mode !== 'real') && myFac) ctx += `你这边（${myFac}）今天：${w.fic[myFac].text}\n`;
            const sp = spotById(S.charLoc[String(c.id)]);
            if (sp) ctx += `你现在在${sp.name}。\n`;
            if (!ctx) { say('还没有天气数据，先去填个城市或者让 AI 编一个。'); return; }

            const ask = `${ctx}
就着今天的天气，跟对方说一句话。
要求：一句话 30 字以内，像随口说的关心或吐槽，按你自己的性格来——冷淡的人就冷淡地说，别硬装体贴。
不要复述温度数字，对方看得见；只输出这句话，不要引号、不要旁白。`;
            const messages = buildStructuredMessages(buildBasePrompt(c, false, ''), [], ask);
            const data = await callChatCompletionAPI(api, messages);
            let txt = (data.choices?.[0]?.message?.content || '').trim().replace(/^["'“”「」]+|["'“”「」]+$/g, '');
            if (typeof applyRegexScripts === 'function') { try { txt = applyRegexScripts(txt, 'ai_output', c.id); } catch (e) {} }
            saidText = txt || '（TA 这会儿没什么想说的）';
            renderWeatherPop();
        } catch (e) {
            say('出错了：' + (e.message || e));
        }
    };

    // 每天一次的主动提醒
    async function maybeRemind() {
        const w = S.weather;
        if (!w.remind) return;
        if (w.lastRemindDay === today()) return;
        if (!w.real && !Object.keys(w.fic).length) return;
        const cs = chars().filter(c => c.isFollowing !== false);
        if (!cs.length) return;
        w.lastRemindDay = today(); await save();
        const c = cs[Math.floor(Math.random() * cs.length)];
        await gymapAskSay(c.id);
        if (saidText && typeof addNotification === 'function') {
            addNotification(`<b>${c.name}</b> 提醒你今天的天气 🌤️`, null, c.id, c, saidText);
        }
        if (saidText && typeof showToast === 'function') {
            if (typeof addNotification === 'function') addNotification(`<b>${c.name}</b> 说了句天气 🗺️`, null, null, c, saidText, { feature: 'map' });
            else showToast(typeof getAvatarHTML === 'function' ? getAvatarHTML(c, 40) : '', c.name + ' 说', saidText, null, null, false);
        }
    }

    // ============================================================
    // 🤝 约着一起去某个地方
    //    两个方向都能发起：你约 TA、TA 约你。
    //    "待多久 / 干什么" 由谁定，在下面这个开关里选：我定 / TA 定 / 每次问我。
    // ============================================================
    const DATE_KEEP_MIN = 1;
    const nowMs = () => Date.now();
    const fmtMin = m => (m >= 60 ? (Math.round(m / 6) / 10) + ' 小时' : m + ' 分钟');
    function dateLogs() { if (!Array.isArray(S.date.logs)) S.date.logs = []; return S.date.logs; }
    function logsOf(charId) { return dateLogs().filter(l => String(l.charId) === String(charId)); }
    // 正在一起待着的那一场（还没到点、而且当时是答应了的）
    function activeDate(charId) {
        return dateLogs().find(l => l.ok && l.until && l.until > nowMs()
            && (charId == null || String(l.charId) === String(charId))) || null;
    }
    async function pushLog(entry) {
        const list = dateLogs();
        list.push(entry);
        const keep = parseInt(S.date.keep) || 0;
        if (keep > 0 && list.length > keep) list.splice(0, list.length - keep);
        await save();
        try { renderMemHub(); } catch (e) {}
    }

    let dateDraft = null;   // {spotId, charId, decide, mins, act}
    window.gymapCloseDate = function () { const p = document.getElementById('gymapDatePop'); if (p) p.classList.remove('on'); };
    function openDatePop(html) {
        const p = document.getElementById('gymapDatePop'), b = document.getElementById('gymapDateBox');
        if (!p || !b) return;
        b.innerHTML = html; p.classList.add('on');
    }

    // ---- 你约 TA ----
    window.gymapAskDate = function (spotId, charId) {
        const sp = spotById(spotId);
        if (!sp) return;
        const who = chars().filter(c => spotOpenTo(sp, c));
        if (!who.length) { openDatePop(`<div class="gymap-hint">这张图还没有能来的角色。可以在地图页把它共享给别的势力。</div>
            <button class="gymap-btn ghost" onclick="gymapCloseDate()">知道了</button>`); return; }
        dateDraft = { spotId, charId: charId ? String(charId) : String(who[0].id),
                      decide: S.date.decide === 'ask' ? 'me' : S.date.decide, mins: 60, act: '' };
        renderDateForm();
    };
    function renderDateForm() {
        const d = dateDraft; if (!d) return;
        const sp = spotById(d.spotId); if (!sp) return;
        const who = chars().filter(c => spotOpenTo(sp, c));
        const picks = who.map(c => `<button class="gymap-pick ${String(c.id) === d.charId ? 'on' : ''}" onclick="gymapDateSet('charId','${c.id}')">
            ${avatar(c).replace('draggable="true"', '')}${esc(c.name)}</button>`).join('');
        const decide = [['me', '我说了算'], ['char', '让 TA 定']]
            .map(([k, n]) => `<button class="gymap-mini ${d.decide === k ? 'on' : ''}" onclick="gymapDateSet('decide','${k}')">${n}</button>`).join('');
        const quick = [30, 60, 120, 240]
            .map(m => `<button class="gymap-mini ${d.mins === m ? 'on' : ''}" onclick="gymapDateSet('mins',${m})">${fmtMin(m)}</button>`).join('');
        openDatePop(`
            <div style="display:flex;align-items:center;">
              <b style="color:#1d9bf0;font-size:15px;">🤝 约去「${esc(sp.name)}」</b>
              <button class="gymap-btn ghost" style="margin-left:auto;padding:4px 10px;" onclick="gymapCloseDate()">关闭</button>
            </div>
            <div class="gymap-hint" style="margin-top:6px;">${esc(sp.faction)}${sp.desc ? ' · ' + esc(sp.desc) : ''}</div>
            <div class="gymap-hint" style="margin-top:8px;">约谁：</div>
            <div class="gymap-picks">${picks}</div>
            <div class="gymap-hint" style="margin-top:10px;">待多久、去干嘛，谁说了算：</div>
            <div class="gymap-modes">${decide}</div>
            ${d.decide === 'me' ? `
              <div class="gymap-hint">待多久：</div>
              <div class="gymap-modes">${quick}</div>
              <input class="gymap-in" id="gymapDateMins" type="number" min="1" value="${d.mins}" placeholder="自己填分钟数">
              <input class="gymap-in" id="gymapDateAct" value="${esc(d.act)}" placeholder="去那儿做什么？比如「坐着聊会儿天」「陪我把班上完」——不填就让 TA 自己想">
            ` : '<div class="gymap-hint">TA 会自己决定待多久、做什么——按 TA 的性格和此刻的处境来。</div>'}
            <div style="margin-top:12px;">
              <button class="gymap-btn" onclick="gymapSendDate()">发出邀请</button>
              <button class="gymap-btn ghost" onclick="gymapCloseDate()">算了</button>
            </div>
            <div id="gymapDateStatus" style="font-size:12px;color:#8b98a5;margin-top:8px;"></div>`);
    }
    window.gymapDateSet = function (k, v) {
        if (!dateDraft) return;
        // 换选项之前先把已经填的留住，不然一点按钮输入框就白填了
        const mi = document.getElementById('gymapDateMins'); if (mi) dateDraft.mins = gyNum(mi.value, 60);
        const ai = document.getElementById('gymapDateAct'); if (ai) dateDraft.act = ai.value;
        dateDraft[k] = v;
        renderDateForm();
    };
    // 你约 TA：v105 起走邀请卡片（js/28）。谈成之后 settleDate 照常落地，
    // 只是"问 TA 去不去"这一步的呈现从"行程页上的一个小状态"变成了私聊里的一张卡。
    window.gymapSendDate = async function () {
        const d = dateDraft; if (!d) return;
        const mi = document.getElementById('gymapDateMins'); if (mi) d.mins = gyNum(mi.value, 60);
        const ai = document.getElementById('gymapDateAct'); if (ai) d.act = ai.value.trim();
        const sp = spotById(d.spotId), c = chars().find(x => String(x.id) === d.charId);
        const st = document.getElementById('gymapDateStatus');
        const tell = m => { if (st) st.innerText = m; };
        if (!sp || !c) { tell('地点或者角色找不到了。'); return; }
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { tell('还没配 API Key，发不出去。'); return; }
        tell('正在等 TA 回话…');
        try {
            const mine = d.decide === 'me';
            const ask = `${(typeof userDisplayName === 'function') ? userDisplayName(c) : '对方'}想约你去「${sp.name}」${sp.desc ? '（' + sp.desc + '）' : ''}。
${mine
    ? `对方已经定好了：待 ${fmtMin(d.mins)}${d.act ? '，去那儿' + d.act : ''}。你只要决定去不去。`
    : `对方没定时间也没定做什么，让你自己安排——你要是答应，就自己说个待多久（分钟数）、去那儿做什么。`}
${(() => { const cur = activeDate(c.id); return cur ? `注意：你这会儿正跟对方在「${cur.spot}」${cur.act ? '，' + cur.act : ''}。` : ''; })()}
按你自己的性格决定去还是不去——忙、烦、不熟、闹别扭，都可以直接拒绝，不用勉强自己迎合。
只输出 JSON，不要解释、不要 markdown 围栏：
{"ok": true 或 false, "line": "你要说的一句话，30字以内，像人说话，不要引号不要旁白"${mine ? '' : ', "mins": 数字（分钟）, "act": "去那儿做什么，10字以内"'}}`;
            if (typeof window.gyInviteSend === 'function') {
                gymapCloseDate();
                let got = null;
                await window.gyInviteSend({
                    char: c, kind: 'date', title: sp.name,
                    sub: (sp.faction ? sp.faction + '　' : '') + (mine ? `待 ${fmtMin(d.mins)}${d.act ? '，' + d.act : ''}` : '待多久、干什么由 TA 定'),
                    ask,
                    onYes: r2 => { got = r2; },
                    onNo:  r2 => { got = r2; }
                });
                // gyInviteSend 里问的那一次已经拿到答案了，这里只负责落地
                const okk = !!(got && got.ok);
                const line2 = (got && got.line) || (okk ? '好啊。' : '这次算了。');
                await settleDate({ char: c, sp, by: 'me', ok: okk, line: line2,
                                   mins: mine ? d.mins : 60, act: mine ? d.act : '' });
                return;
            }
            const messages = buildStructuredMessages(buildBasePrompt(c, false, ''), [], ask);
            const data = await callChatCompletionAPI(api, messages);
            const raw = (data.choices?.[0]?.message?.content || '');
            let r = (typeof parseModelJson === 'function') ? parseModelJson(raw) : null;
            if (Array.isArray(r)) r = r[0];
            if (!r || typeof r !== 'object') r = { ok: true, line: String(raw).trim().slice(0, 40) };
            let line = String(r.line || '').trim().replace(/^["'“”「」]+|["'“”「」]+$/g, '');
            if (typeof applyRegexScripts === 'function') { try { line = applyRegexScripts(line, 'ai_output', c.id); } catch (e) {} }
            const ok = r.ok !== false;
            const mins = mine ? d.mins : Math.max(1, gyNum(r.mins, 60));
            const act = mine ? (d.act || String(r.act || '').trim()) : String(r.act || '').trim();
            await settleDate({ char: c, sp, by: 'me', ok, line, mins, act });
        } catch (e) {
            tell('出错了：' + (e.message || e));
        }
    };

    // 谈成/谈崩之后统一落地：记录 + 挪位置 + 通知 + 弹窗
    async function settleDate({ char, sp, by, ok, line, mins, act }) {
        const entry = {
            id: uid('d'), charId: char.id, charName: char.name, spot: sp.name, spotId: sp.id,
            faction: sp.faction || '', by, ok: !!ok, mins: mins || 0, act: act || '', line: line || '',
            at: nowMs(), until: ok ? nowMs() + (mins || 60) * 60000 : 0
        };
        if (ok) { S.charLoc[String(char.id)] = sp.id; }
        // 💳 出门可能要花钱（js/31，开关 walletOuting）：花没花、花在哪儿、谁掏的
        //    全是随机的——三成的可能就是出去走走一分钱没花。钱包没开就什么都不发生。
        if (ok) {
            try {
                if (window.gyWallet && typeof window.gyWallet.outing === 'function') {
                    await window.gyWallet.outing({ charId: char.id, spot: sp.name, mins: entry.mins, by });
                }
            } catch (e) { console.warn('[行程] 记出行开销失败：', e); }
        }
        await pushLog(entry);
        renderPanel();
        if (typeof addNotification === 'function') {
            addNotification(ok ? `你和 <b>${char.name}</b> 约在了「${sp.name}」🤝` : `<b>${char.name}</b> 婉拒了你的邀约`, null, char.id, char, line);
        }
        // 📨 你约 TA 的那一次，把邀请和回话都写进私聊并跳过去（js/28）。
        //    TA 约你的那一次（by==='char'）本来就走私聊投递，不用再记一遍。
        //    跳走了就不再弹那个结果框了——人已经在聊天页，背后弹一个看不见的框没意义；
        //    约成了的细节改成聊天里的一条系统消息，跟邀请挨着，翻记录时是连着的。
        // ⚠️ 邀请那一来一回现在由卡片承担（js/28），这里**不能再补一遍两条文字消息**，
        //    否则聊天里会是"卡片 + 一模一样的两条气泡"。只在约成时补一条系统消息说细节。
        if (by === 'me') {
            if (ok) {
                try {
                    const sid = String(char.id);
                    if (typeof globalChats !== 'undefined') {
                        if (!globalChats[sid]) globalChats[sid] = [];
                        globalChats[sid].push({ sender: 'system', timestamp: Date.now(),
                            text: `说定了：${sp.name}${entry.faction ? '（' + entry.faction + '）' : ''}　待 ${fmtMin(entry.mins)}${entry.act ? '　' + entry.act : ''}` });
                        if (typeof saveAllData === 'function') saveAllData();
                        if (typeof renderChatMessages === 'function' && String(currentChatSessionId) === sid) renderChatMessages();
                    }
                } catch (e) {}
            }
            if (typeof switchMainView === 'function') { switchMainView('chat'); if (typeof switchChatSession === 'function') switchChatSession(char.id); }
            return;
        }
        openDatePop(`
            <div style="display:flex;align-items:center;">
              <b style="color:#1d9bf0;font-size:15px;">${ok ? '🤝 说定了' : '🙃 这次没约上'}</b>
              <button class="gymap-btn ghost" style="margin-left:auto;padding:4px 10px;" onclick="gymapCloseDate()">关闭</button>
            </div>
            <div class="gymap-say" style="margin-top:10px;"><b>${esc(char.name)}</b>${esc(line || '（没说什么）')}</div>
            ${ok ? `<div class="gymap-wcard" style="margin-top:10px;">
                <b>${esc(sp.name)}</b>${entry.faction ? '　' + esc(entry.faction) : ''}<br>
                待 ${fmtMin(entry.mins)}${entry.act ? '　·　' + esc(entry.act) : ''}<br>
                <span style="color:#8b98a5;font-size:11px;">这段时间里聊天、发帖都会知道你俩在一起。记录在「记忆总览 → 一起去过的地方」。</span>
              </div>` : ''}
            <div style="margin-top:12px;"><button class="gymap-btn" onclick="gymapCloseDate()">好</button></div>`);
    }

    // ---- TA 约你 ----
    let inviting = false;
    window.gymapCharInvite = async function (charId) {
        if (inviting) return null;
        const c = chars().find(x => String(x.id) === String(charId));
        if (!c) return null;
        const mine = spotsFor(c);
        if (!mine.length) return null;
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) return null;
        inviting = true;
        try {
            const letChar = S.date.decide !== 'me';
            const ask = `你想约${(typeof userDisplayName === 'function') ? userDisplayName(c) : '对方'}一起去个地方。
你能去的地方（只能从这里挑一个，写原名）：
${mine.map(sp => '· ' + sp.name + (sp.desc ? '（' + sp.desc + '）' : '') + ' —— ' + (sp.faction || '')).join('\n')}
${letChar ? '待多久、去干什么，你自己定。' : '待多久和干什么让对方来定，你只管开口约。'}
挑一个符合你此刻处境和性格的地方，跟对方说一句话把人约出来。
一句话 30 字以内，像人说话，别写旁白别加引号。
只输出 JSON，不要解释、不要 markdown 围栏：
{"spot":"地点原名","line":"那一句话"${letChar ? ',"mins":数字（分钟）,"act":"去那儿做什么，10字以内"' : ''}}`;
            const messages = buildStructuredMessages(buildBasePrompt(c, false, ''), [], ask);
            const data = await callChatCompletionAPI(api, messages);
            let r = (typeof parseModelJson === 'function') ? parseModelJson(data.choices?.[0]?.message?.content || '') : null;
            if (Array.isArray(r)) r = r[0];
            if (!r || !r.spot) return null;
            const want = String(r.spot).trim();
            const sp = mine.find(x => x.name === want) || mine.find(x => want.indexOf(x.name) >= 0 || x.name.indexOf(want) >= 0);
            if (!sp) return null;
            let line = String(r.line || '').trim().replace(/^["'“”「」]+|["'“”「」]+$/g, '');
            if (typeof applyRegexScripts === 'function') { try { line = applyRegexScripts(line, 'ai_output', c.id); } catch (e) {} }
            const mins = letChar ? Math.max(1, gyNum(r.mins, 60)) : 60;
            const act = letChar ? String(r.act || '').trim() : '';
            showInvitePop(c, sp, line, mins, act, letChar);
            if (typeof addNotification === 'function') addNotification(`<b>${c.name}</b> 约你去「${sp.name}」🤝`, null, c.id, c, line);
            return sp.name;
        } catch (e) { console.warn('[行程] TA 约你失败：', e); return null; }
        finally { inviting = false; }
    };
    let invitePending = null;
    function showInvitePop(c, sp, line, mins, act, decided) {
        invitePending = { charId: c.id, spotId: sp.id, mins, act, decided };
        // 📨 v105：TA 约你**也发在私聊里**，卡片上两个按钮由你来点（js/28）。
        //    以前是一个盖在行程页上的弹窗——不在那一页就看不见，关掉就没了，
        //    聊天记录里也留不下"TA 约过你"这件事。
        if (typeof window.gyInviteFromChar === 'function') {
            window.gyInviteFromChar({
                char: c, kind: 'date',
                title: sp.name,
                // 落地要用的都存在卡上：刷新之后回调没了，你再点「好啊」照样能约成（见 gymapInviteAnswered）
                data: { spotId: sp.id, mins: mins || 60, act: act || '', decided: !!decided },
                sub: (sp.faction ? sp.faction + '　' : '') + (decided ? `TA 想待 ${fmtMin(mins)}${act ? '，' + act : ''}` : '待多久、去干什么由你定'),
                line,
                onYes: async () => {
                    invitePending = null;
                    await settleDate({ char: c, sp, by: 'char', ok: true, line: '（你答应了）', mins: mins || 60, act: act || '' });
                },
                onNo: async () => {
                    invitePending = null;
                    await pushLog({ id: uid('d'), charId: c.id, charName: c.name, spot: sp.name, spotId: sp.id,
                        faction: sp.faction || '', by: 'char', ok: false, mins: 0, act: '', line: '（你说改天）', at: nowMs(), until: 0 });
                }
            });
            return;
        }
        openDatePop(`
            <div style="display:flex;align-items:center;">
              <b style="color:#1d9bf0;font-size:15px;">🤝 ${esc(c.name)} 约你出去</b>
              <button class="gymap-btn ghost" style="margin-left:auto;padding:4px 10px;" onclick="gymapCloseDate()">关闭</button>
            </div>
            <div class="gymap-say" style="margin-top:10px;"><b>${esc(c.name)}</b>${esc(line)}</div>
            <div class="gymap-wcard" style="margin-top:10px;">
              <b>${esc(sp.name)}</b>${sp.faction ? '　' + esc(sp.faction) : ''}${sp.desc ? '<br>' + esc(sp.desc) : ''}
              <br>${decided ? `TA 想待 ${fmtMin(mins)}${act ? '，' + esc(act) : ''}` : '待多久、干什么由你定：'}
            </div>
            ${decided ? '' : `<div class="gymap-modes" style="margin-top:8px;">
                ${[30, 60, 120, 240].map(m => `<button class="gymap-mini ${m === 60 ? 'on' : ''}" onclick="gymapInviteMins(${m},this)">${fmtMin(m)}</button>`).join('')}
              </div>
              <input class="gymap-in" id="gymapInviteAct" placeholder="去那儿做什么？不填就随意">`}
            <div style="margin-top:12px;">
              <button class="gymap-btn" onclick="gymapInviteYes()">去</button>
              <button class="gymap-btn ghost" onclick="gymapInviteNo()">改天吧</button>
            </div>`);
    }
    // 邀请卡的「好啊 / 算了」在页面刷新之后点的：按卡上存的数据落地（js/28 KINDS.date.answer 调这里）
    window.gymapInviteAnswered = async function (inv, yes) {
        try {
            const d = (inv && inv.data) || {};
            const c = chars().find(x => String(x.id) === String(inv.charId));
            const sp = spotById(d.spotId) || allSpots().find(x => x.name === inv.title);
            if (!c || !sp) return;
            invitePending = null;
            if (yes) await settleDate({ char: c, sp, by: 'char', ok: true, line: '（你答应了）', mins: d.mins || 60, act: d.act || '' });
            else await pushLog({ id: uid('d'), charId: c.id, charName: c.name, spot: sp.name, spotId: sp.id,
                faction: sp.faction || '', by: 'char', ok: false, mins: 0, act: '', line: '（你说改天）', at: nowMs(), until: 0 });
        } catch (e) { console.warn('[行程] 按邀请卡落地失败：', e); }
    };
    window.gymapInviteMins = function (m, el) {
        if (invitePending) invitePending.mins = m;
        try { el.parentElement.querySelectorAll('.gymap-mini').forEach(b => b.classList.remove('on')); el.classList.add('on'); } catch (e) {}
    };
    window.gymapInviteYes = async function () {
        const p = invitePending; if (!p) return gymapCloseDate();
        const c = chars().find(x => String(x.id) === String(p.charId));
        const sp = spotById(p.spotId);
        if (!c || !sp) return gymapCloseDate();
        const ai = document.getElementById('gymapInviteAct');
        const act = p.decided ? p.act : (ai ? ai.value.trim() : '');
        invitePending = null;
        await settleDate({ char: c, sp, by: 'char', ok: true, line: '（你答应了）', mins: p.mins, act });
    };
    window.gymapInviteNo = async function () {
        const p = invitePending; if (!p) return gymapCloseDate();
        const c = chars().find(x => String(x.id) === String(p.charId));
        const sp = spotById(p.spotId);
        invitePending = null;
        gymapCloseDate();
        if (c && sp) await pushLog({ id: uid('d'), charId: c.id, charName: c.name, spot: sp.name, spotId: sp.id,
            faction: sp.faction || '', by: 'char', ok: false, mins: 0, act: '', line: '（你说改天）', at: nowMs(), until: 0 });
    };

    // ---- 约出去这一页 ----
    function tabDate() {
        const on = (typeof isAutoOn === 'function') ? isAutoOn('gymapDate') : false;
        const decide = [['me', '我说了算'], ['char', '让 TA 定'], ['ask', '每次问我']]
            .map(([k, n]) => `<button class="gymap-mini ${S.date.decide === k ? 'on' : ''}" onclick="gymapDateDecide('${k}')">${n}</button>`).join('');
        const cur = activeDate();
        const logs = dateLogs().slice().reverse().slice(0, 30);
        const spots = allSpots();
        return `
        <div class="gymap-sec">
          <h4>🤝 约着一起去</h4>
          <div class="gymap-hint">你可以在地图页每个地点后面点「🤝 约」把角色约出来；角色也会自己开口约你（那个要在下面打开）。
            答应之后这段时间里，聊天和发帖都会知道"你俩正在哪儿、在干嘛"。</div>
          ${cur ? `<div class="gymap-wcard"><b>正在一起</b>　${esc(cur.charName)} · ${esc(cur.spot)}${cur.act ? '　' + esc(cur.act) : ''}<br>
            <span style="color:#8b98a5;font-size:11px;">还剩 ${fmtMin(Math.max(1, Math.round((cur.until - nowMs()) / 60000)))}</span>
            <button class="gymap-mini" style="margin-left:6px;" onclick="gymapEndDate('${cur.id}')">提前结束</button></div>` : ''}
          <h4 style="margin-top:12px;">⏱️ 待多久、干什么，谁说了算</h4>
          <div class="gymap-modes">${decide}</div>
          <div class="gymap-hint">「每次问我」＝ 每次发起邀约时在弹窗里现选。</div>
          <h4 style="margin-top:12px;">🔔 让角色主动约你</h4>
          <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" ${on ? 'checked' : ''} onchange="gymapDateAuto(this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;">
            <span><b>角色会自己开口约你出去</b><br>
            <span style="font-size:11.5px;color:#8b98a5;">在「设置 → AI 增强功能」里也是同一个开关。默认关着，不打开一次 API 都不会调。
            打开之后，自主模式里会多一个「约你出去」的动作。</span></span>
          </label>
          <div style="margin-top:8px;">
            <select class="gymap-in" id="gymapInviteWho" style="max-width:200px;display:inline-block;">
              ${chars().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') || '<option value="">还没有角色</option>'}
            </select>
            <button class="gymap-btn ghost" onclick="gymapTestInvite()">让 TA 现在约我一次</button>
          </div>
          <div id="gymapInviteStatus" style="font-size:12px;color:#8b98a5;margin-top:6px;"></div>
        </div>

        <div class="gymap-sec">
          <h4>📓 一起去过的地方（${dateLogs().length}）</h4>
          <div class="gymap-hint">这些也会出现在「记忆总览」里，可以在那儿改保留条数。</div>
          ${logs.length ? logs.map(l => `<div class="gymap-row">
              <div class="gymap-row-m">
                <b>${l.ok ? '🤝' : '🙃'} ${esc(l.charName)} · ${esc(l.spot)}</b>
                <span>${new Date(l.at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                　${l.by === 'me' ? '你约的' : 'TA 约的'}${l.ok ? '　' + fmtMin(l.mins) + (l.act ? ' · ' + esc(l.act) : '') : '　没去成'}
                ${l.line ? '<br>「' + esc(l.line) + '」' : ''}</span>
              </div>
              <button class="gymap-mini" onclick="gymapDelDate('${l.id}')">删</button>
            </div>`).join('') : '<div class="gymap-hint">还没有记录。</div>'}
          ${dateLogs().length ? '<button class="gymap-btn danger" style="margin-top:8px;" onclick="gymapClearDates()">清空全部记录</button>' : ''}
        </div>`;
    }
    window.gymapDateDecide = function (k) { S.date.decide = k; save(); renderPanel(); };
    window.gymapDateAuto = function (v) {
        if (typeof setAutoFeature === 'function') setAutoFeature('gymapDate', !!v);
        else if (typeof autoFeatureSwitches !== 'undefined') { autoFeatureSwitches['gymapDate'] = !!v; if (typeof saveAllData === 'function') saveAllData(); }
        renderPanel();
    };
    window.gymapTestInvite = async function () {
        const sel = document.getElementById('gymapInviteWho');
        const st = document.getElementById('gymapInviteStatus');
        const id = sel && sel.value;
        if (!id) { if (st) st.innerText = '还没有角色。'; return; }
        if (st) st.innerText = '正在让 TA 想约你去哪儿…';
        const r = await gymapCharInvite(id);
        if (st) st.innerText = r ? '' : 'TA 这次没约成——可能是没有 API Key、TA 能去的地方是空的，或者模型没按格式回。';
    };
    window.gymapEndDate = async function (id) {
        const l = dateLogs().find(x => x.id === id);
        if (l) { l.until = nowMs(); l.endedEarly = true; await save(); renderPanel(); checkDateEnds(); }
    };
    // 💬 约出去的那段时间到了（或者提前结束了）：TA 像真人一样回头在私聊里再说两句（js/28 gyAfterActivity）。
    //    每一场只触发一次（l.afterDone）；太久以前就结束的（比如这个功能上线之前的旧记录）悄悄标掉，不补发。
    function checkDateEnds() {
        try {
            const now = nowMs();
            let dirty = false;
            dateLogs().forEach(l => {
                if (!l || !l.ok || !l.until || l.until > now || l.afterDone) return;
                l.afterDone = true; dirty = true;
                if (now - l.until > 6 * 3600000) return;
                if (typeof window.gyAfterActivity !== 'function') return;
                const c = chars().find(x => String(x.id) === String(l.charId));
                if (!c) return;
                const mins = Math.max(1, Math.round((l.until - l.at) / 60000));
                const summary = `一起去了「${l.spot}」${l.faction ? '（' + l.faction + '）' : ''}${l.act ? '，' + l.act : ''}，待了 ${fmtMin(mins)}${l.endedEarly ? '（提前散了）' : ''}。${l.line && !/^（/.test(l.line) ? '\n当时约的时候你说：' + l.line : ''}`;
                window.gyAfterActivity(c.id, '约出去', summary, { by: l.by === 'char' ? 'char' : 'me', mins });
            });
            if (dirty) save();
        } catch (e) { console.warn('[行程] 检查约会结束失败：', e); }
    }
    window.__gymapCheckDateEnds = checkDateEnds;
    window.gymapDelDate = async function (id) {
        S.date.logs = dateLogs().filter(x => x.id !== id);
        await save(); renderPanel(); try { renderMemHub(); } catch (e) {}
    };
    window.gymapClearDates = async function () {
        S.date.logs = [];
        await save(); renderPanel(); try { renderMemHub(); } catch (e) {}
    };

    // ---------- 🧠 记忆总览里的那一块 ----------
    function memHubHtml(charId) {
        const list = logsOf(charId).slice().reverse();
        const cur = activeDate(charId);
        const keep = parseInt(S.date.keep) || 0;
        return `
          <label style="font-size:15px;">🗺️ 一起去过的地方</label>
          <div style="font-size:12px; color:#536471; margin-bottom:8px;">
            你和 TA 约着出去的记录。会进 TA 的 prompt——聊天、发推、写信的时候 TA 记得"我们前几天一起去过哪儿、做了什么"。
          </div>
          ${cur ? `<div style="background:#e8f5fe;border-radius:8px;padding:9px 11px;font-size:13px;margin-bottom:8px;">
            <b>正在一起</b>：${esc(cur.spot)}${cur.act ? ' · ' + esc(cur.act) : ''}，还剩 ${fmtMin(Math.max(1, Math.round((cur.until - nowMs()) / 60000)))}</div>` : ''}
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:12px;color:#536471;">保留最近</span>
            <input id="gymapMemKeep" type="number" min="0" value="${keep}" style="width:80px;padding:6px;border:1px solid #cfd9de;border-radius:6px;font-size:13px;">
            <span style="font-size:12px;color:#536471;">条，0 ＝ 不限</span>
            <button type="button" class="btn-edit-small" onclick="gymapSaveMemKeep()">保存</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto;">
          ${list.length ? list.map(l => `
            <div style="display:flex;align-items:flex-start;gap:8px;background:white;padding:8px;border-radius:6px;border:1px solid #eff3f4;">
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:bold;">${l.ok ? '🤝' : '🙃'} ${esc(l.spot)}
                  <span style="font-weight:normal;color:#536471;">${new Date(l.at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  · ${l.by === 'me' ? '你约的' : 'TA 约的'}${l.ok ? ' · ' + fmtMin(l.mins) : ' · 没去成'}</span></div>
                <div style="font-size:12px;color:#536471;">${l.act ? esc(l.act) : ''}${l.line ? '　「' + esc(l.line) + '」' : ''}</div>
              </div>
              <span style="color:#f91880;cursor:pointer;flex-shrink:0;" onclick="gymapDelDate('${l.id}')">删除</span>
            </div>`).join('') : '<div style="color:#8b98a5;font-size:13px;">还没有一起去过的地方</div>'}
          </div>`;
    }
    window.gymapSaveMemKeep = async function () {
        const el = document.getElementById('gymapMemKeep');
        const v = el ? parseInt(el.value) : 0;
        S.date.keep = (isNaN(v) || v <= 0) ? 0 : v;
        const list = dateLogs();
        if (S.date.keep > 0 && list.length > S.date.keep) list.splice(0, list.length - S.date.keep);
        await save(); renderMemHub();
        if (typeof showToast === 'function') showToast('', '保存了', '一起去过的地方，保留 ' + (S.date.keep || '不限') + ' 条。', null, null, false);
    };
    function renderMemHub() {
        const host = document.getElementById('memoryHubContent');
        if (!host) return;
        const id = (typeof currentMemoryHubTargetId !== 'undefined') ? currentMemoryHubTargetId : null;
        let box = document.getElementById('gymapMemHubBox');
        if (String(id || '').startsWith('g_') || !id) { if (box) box.remove(); return; }   // 群聊没有"一起出去"
        if (!box) {
            box = document.createElement('div');
            box.id = 'gymapMemHubBox';
            box.className = 'input-group';
            box.style.cssText = 'margin-top:20px; border-top:1px dashed #1d9bf0; padding-top:15px;';
            host.appendChild(box);
        }
        box.innerHTML = memHubHtml(id);
    }

    // ---------- 入口 & 钩子 ----------
    function addEntries() {
        const menu = document.querySelector('#setIndex .set-menu');
        if (menu && !document.getElementById('gymapSetEntry')) {
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = 'set-entry'; btn.id = 'gymapSetEntry';
            btn.onclick = () => gymapOpen();
            btn.innerHTML = '<span class="set-entry-ico">🗺️</span><span class="set-entry-main"><span class="set-entry-title">行程与天气</span><span class="set-entry-desc">势力地图、角色在哪儿、今天的天气</span></span><span class="set-entry-arrow">›</span>';
            const sep = menu.querySelector('.set-menu-sep');
            if (sep) menu.insertBefore(btn, sep); else menu.appendChild(btn);
        }
        // 势力总览页上加一个「🗺️ 地图」按钮
        const fo = document.getElementById('factionOverviewList');
        if (fo && !document.getElementById('gymapFacBtn')) {
            const b = document.createElement('button');
            b.id = 'gymapFacBtn'; b.className = 'btn-secondary';
            b.style.cssText = 'width:auto;padding:8px 18px;margin:0 0 12px;';
            b.innerText = '🗺️ 打开势力地图';
            b.onclick = () => gymapOpen();
            fo.parentElement.insertBefore(b, fo);
        }
    }

    function hookAutonomy() {
        try {
            if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || !Array.isArray(GY_AUTONOMY_ACTIONS)) return;
            if (GY_AUTONOMY_ACTIONS.some(a => a.key === 'go_place')) return;
            GY_AUTONOMY_ACTIONS.splice(GY_AUTONOMY_ACTIONS.length - 1, 0, {
                key: 'invite_user',
                label: '约对方出去',
                hint: '挑个地方，开口把对方约出来见一面',
                need: (char) => ((typeof isAutoOn === 'function') ? isAutoOn('gymapDate') : false)
                    && !activeDate(char.id) && spotsFor(char).length > 0,
                run: async (char) => {
                    const r = await gymapCharInvite(char.id);
                    return r ? ('约对方去了' + r) : null;
                }
            });
            GY_AUTONOMY_ACTIONS.splice(GY_AUTONOMY_ACTIONS.length - 1, 0, {
                key: 'go_place',
                label: '换个地方待着',
                hint: '去某个地方——办事、躲清静、或者想碰见谁',
                need: (char) => S.move.byAutonomy && allSpots().some(s => facOf(char).includes(s.faction)),
                run: async (char) => {
                    const mine = allSpots().filter(s => facOf(char).includes(s.faction));
                    if (!mine.length) return null;
                    const now = S.charLoc[String(char.id)];
                    const cand = mine.filter(s => s.id !== now);
                    if (!cand.length) return null;
                    const pick = cand[Math.floor(Math.random() * cand.length)];
                    S.charLoc[String(char.id)] = pick.id;
                    await save();
                    try { await checkMeet(); } catch (e) {}
                    return '去了' + pick.name;
                }
            });
        } catch (e) { console.warn('[行程] 挂自主模式失败：', e); }
    }

    // 在「设置 → AI 增强功能」那张表里加一项，跟别的自动功能一个待遇
    function hookSwitch() {
        try {
            if (typeof AUTO_FEATURE_DEFS === 'undefined' || !Array.isArray(AUTO_FEATURE_DEFS)) return;
            if (AUTO_FEATURE_DEFS.some(f => f.key === 'gymapDate')) return;
            AUTO_FEATURE_DEFS.push({
                key: 'gymapDate', label: '角色主动约你出去',
                desc: '角色会自己挑一个地方，开口把你约出来——邀请直接发在私聊里，你决定去不去。待多久、干什么由谁定，在 🧩 小功能 → 行程与天气 →「🤝 约出去」页里选。默认关着，不打开一次 API 都不会调。',
                cost: '开口约一次一次调用', defaultOff: true,
                // ⚠️ 这一条是运行时 push 进来的，以前**没写 group**——分组渲染时它掉进了"没有组"的那一堆，
                //    在开关页里孤零零挂在最后，看不出跟什么有关。
                group: '主动', where: '设置 → 🧩 小功能 → 行程与天气 → 🤝 约出去'
            });
            if (typeof renderAutoFeatureList === 'function') { try { renderAutoFeatureList(); } catch (e) {} }
        } catch (e) { console.warn('[行程] 挂开关失败：', e); }
    }
    // 记忆总览页：切角色的时候把"一起去过的地方"那块重画一遍
    function hookMemHub() {
        try {
            ['selectMemoryHubTarget', 'renderMemoryHubContent'].forEach(fn => {
                const orig = window[fn];
                if (typeof orig !== 'function' || orig.__gymapPatched) return;
                window[fn] = function () {
                    const r = orig.apply(this, arguments);
                    try { setTimeout(renderMemHub, 0); } catch (e) {}
                    return r;
                };
                window[fn].__gymapPatched = true;
            });
        } catch (e) { console.warn('[行程] 挂记忆总览失败：', e); }
    }

    (async function init() {
        await load();
        mount();
        addEntries();
        hookAutonomy();
        hookSwitch();
        hookMemHub();
        const sw = window.switchMainView;
        if (typeof sw === 'function' && !sw.__gymapPatched) {
            window.switchMainView = function () {
                const r = sw.apply(this, arguments);
                try { setTimeout(addEntries, 0); } catch (e) {}
                return r;
            };
            window.switchMainView.__gymapPatched = true;
        }
        // 每 10 分钟按日程对一次位置（纯本地，不花钱），顺带看看有没有人碰上
        setInterval(async () => {
            try { if (syncBySchedule()) { renderPanel(); } await checkMeet(); } catch (e) {}
        }, 10 * 60000);
        // ⏰ 时间款上的钟得会走
        setInterval(() => {
            try { if (S.float.on && fSkinInfo(S.float.skin).cat === 'clock') paintFloat(); } catch (e) {}
        }, 20000);
        // 打开 app 后过一会儿看看今天要不要提醒天气
        setTimeout(() => { try { maybeRemind(); } catch (e) {} }, 25000);
        // 约出去的那段时间到没到：每分钟看一眼（纯本地，不花钱；到了才会问 TA 一次）
        setTimeout(checkDateEnds, 8000);
        setInterval(checkDateEnds, 60000);
        const nMaps = Object.keys(S.mapSets).reduce((a, f) => a + (S.mapSets[f].list || []).length, 0);
        console.info('[行程与天气] 已加载：' + nMaps + ' 张地图，' + allSpots().length + ' 个地点');
    })();
})();
