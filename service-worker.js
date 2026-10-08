// 这个 Service Worker 干两件事：
// 1）系统通知：安卓 Chrome 出于规范限制，禁止网页直接用 new Notification() 弹通知（会直接报错），
//    必须通过一个已注册、已激活的 Service Worker 用 registration.showNotification() 才行。
// 2）PWA 离线缓存：把首页/样式/所有js模块/图标这些"核心文件"缓存下来，断网或者信号不好的时候
//    依然能打开app、看到聊天记录等本地数据（这些数据本身存在 IndexedDB/localForage 里，跟这个SW缓存是两回事，
//    SW缓存缓存的只是"页面骨架代码"）。AI API请求、CDN上的第三方脚本这些不归这个SW管，该怎么样还怎么样。

// 📌 版本号不用在这里改了：index.html 注册的时候会带上 ?v=版本号（跟 index.html 里那个 GY_VERSION 同一个数），
//    这里直接读出来。版本号一变，注册地址就变了，浏览器会自动装上新的这一份、换一个新缓存。
const V = (function () { try { return new URL(self.location.href).searchParams.get('v') || '0'; } catch (e) { return '0'; } })();
const CACHE_VERSION = 'v' + V;

const CACHE_NAME = `bailu-app-cache-${CACHE_VERSION}`;

// ⚠️ 这份清单必须和 index.html 里实际 <script src> / <link href> 的路径**逐字一致**
// （包括 ./ 前缀和 ?v= 这种查询参数，?v= 用上面的 V 拼），因为预缓存是按URL字符串存的，差一个字符就命中不了。
// 加了新的 js 模块 / 第三方库之后，记得同步加到这里，否则离线时那个模块会加载失败。
const CORE_ASSETS = [
    './',
    './index.html',
    './style.css?v=' + V,   // ⚠️ 跟 index.html 里的 ?v= 必须完全一致，改一处就要改两处
    './wechat-mode.css?v=' + V,
    './pwa-manifest.json', // 注意是 pwa-manifest.json，不是 manifest.json（后者是HBuilderX打包APK用的应用配置，见index.html开头的注释）
    './icons/icon-192.png',
    './icons/icon-512.png',
    // 第三方库：localforage 是整个App的本地存储底座，没缓存到的话离线直接打不开，务必保留
    './js/vendor/localforage.min.js?v=' + V,
    './js/00-bailu-shim.js?v=' + V,
    './js/vendor/mammoth.browser.min.js?v=' + V,
    './js/vendor/ejs.min.js?v=' + V,
    // 角色卡前端页面（开场白菜单/状态栏）里用到 $ 的那些，会由 js/03 往 iframe 里挂这个 <script src>；
    // 不预缓存的话离线时那些卡片会报 "$ is not defined" 整张卡死掉
    './js/vendor/jquery.min.js?v=' + V,
    './js/01-core-state-infra.js?v=' + V,
    './js/01b-switches-stream-regex-reasoning.js?v=' + V,
    './js/01c-prompt-status-memory-databank.js?v=' + V,
    './js/02-databank-plugins-minigames.js?v=' + V,
    './js/03-markdown-feed-tags.js?v=' + V,
    './js/04-mobile-bootstrap-notifications.js?v=' + V,
    './js/04b-import-models-persona-overlays.js?v=' + V,
    './js/05-anniversary-memory.js?v=' + V,
    './js/05b-greeting-chat-reply-emoticons.js?v=' + V,
    './js/06-emoticons-time-humanfeel-relationships-worldbook.js?v=' + V,
    './js/06b-worldbook-ui-memhub-alive-inject.js?v=' + V,
    './js/07-proactive-cloudsync.js?v=' + V,
    './js/08-diary-novel.js?v=' + V,
    './js/08b-profile-follow-panels-alive-settings.js?v=' + V,
    './js/09-memories-search-postfixes.js?v=' + V,
    './js/10-comments-npc-forum-reply.js?v=' + V,
    './js/10b-generation-char-center-profile.js?v=' + V,
    './js/11-tabloid-story-forum-engine.js?v=' + V,
    './js/12-worldbook-import-appexport.js?v=' + V,
    './js/13-charreply-groupchat-faction-cardimport.js?v=' + V,
    './js/13b-cardsplit-multicard-export.js?v=' + V,
    './js/14-settings-archive.js?v=' + V,
    './js/15-ai-presets.js?v=' + V,
    './js/16-story-studio.js?v=' + V,
    './js/17-tavern-bridge.js?v=' + V,
    './js/18-minigames-board-cards.js?v=' + V,
    './js/19-minigames-party.js?v=' + V,
    './js/20-reading-together.js?v=' + V,
    './js/21-watch-together.js?v=' + V,
    './js/22-box-music.js?v=' + V,
    './js/23-box-map.js?v=' + V,
    './js/24-box-relations.js?v=' + V,
    './js/25-box-life.js?v=' + V,
    './js/26-box-mall.js?v=' + V,
    './js/27-feature-pages.js?v=' + V,
    './js/28-invite-in-chat.js?v=' + V,
    './js/29-web-explore.js?v=' + V,
    './js/30-parcel-cards.js?v=' + V,
    './js/31-wallet.js?v=' + V,
    './js/32-takeout.js?v=' + V,
    './js/33-phone.js?v=' + V,
    './js/34-gallery.js?v=' + V,
    './js/35-dressup.js?v=' + V,
    './js/36-silence.js?v=' + V,
    './js/37-inject-hub.js?v=' + V,
    './js/38-my-days.js?v=' + V,
    './js/39-npcs.js?v=' + V,
    './js/40-nav-groups.js?v=' + V,
    './js/41-site-ctx.js?v=' + V,
    './js/42-char-photo.js?v=' + V,
    './js/43-moments-home.js?v=' + V,
    './js/44-live-media.js?v=' + V,
    './js/45-chat-headbar.js?v=' + V,
    './js/46-today-panel.js?v=' + V,
    './js/47-call.js?v=' + V,
    './js/48-feature-search.js?v=' + V,
    './js/49-chat-plus.js?v=' + V,
    './js/50-skin-box.js?v=' + V,
    './js/51-reasoning-vault.js?v=' + V,
    './js/52-chat-actions.js?v=' + V,
    './js/53-ta-decide.js?v=' + V,
    './js/54-all-switches.js?v=' + V,
    './js/55-card-extras.js?v=' + V,
    './js/56-peer-life.js?v=' + V,
    './js/57-life-dice.js?v=' + V,
    './js/58-more-acts.js?v=' + V,
    './js/59-online-res.js?v=' + V,
    './js/60-act-notify.js?v=' + V,
    './js/61-wechat-mode.js?v=' + V,
    './js/62-phone-mode.js?v=' + V,
    './js/63-phone-home.js?v=' + V,
    './js/64-post-regen.js?v=' + V,
    './js/65-memhub-extra.js?v=' + V,
    './js/66-phone-widgets.js?v=' + V,
    './js/67-phone-island.js?v=' + V,
    './js/68-custom-font.js?v=' + V,
    './js/69-modal-resize.js?v=' + V,
    './js/70-bubble-tail.js?v=' + V,
    './js/71-phone-mystic.js?v=' + V,
    './js/73-back-nav.js?v=' + V,
    './js/74-period.js?v=' + V,
    './js/75-web-media.js?v=' + V,
    './js/90-bailu-cards.js?v=' + V,
    './js/91-bailu-play.js?v=' + V,
    './js/78-file-access.js?v=' + V,
    './js/79-feature-hub.js?v=' + V,
    './js/80-backup-extra.js?v=' + V,
    './js/81-ta-inner.js?v=' + V,
    './js/82-group-plus.js?v=' + V,
    './js/83-api-care.js?v=' + V,
    './js/84-polish.js?v=' + V,
    './js/85-pages.js?v=' + V,
    './js/86-time-sense.js?v=' + V,
    './js/87-time-place.js?v=' + V,
    './js/88-prompt-lib.js?v=' + V,
    './js/89-chat-think.js?v=' + V,
    './js/93-phone-mag.js?v=' + V,
    './js/92-bailu-builtin.js?v=' + V
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // 装上就立刻生效，不用等页面刷新
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // 逐个缓存而不是一次性 cache.addAll()：addAll 是"全部成功才算数"，
            // 万一某一个文件当时网络抖动没抓到，会导致整批预缓存全部失败。
            // 逐个来的话，单个文件失败只影响它自己，不连累其它文件正常缓存。
            // ⚠️ 关键修复：cache.add(url) 内部用的是默认缓存模式的 fetch，如果浏览器自己的HTTP磁盘缓存里
            // 已经存过这个文件的旧版本（本地用 python -m http.server 这类不带 Cache-Control 头的服务器时
            // 特别容易发生——浏览器会按启发式规则自己决定缓存多久），这里就会把那份"过期已久"的旧内容
            // 存进这一版全新的 CACHE_NAME 里，导致版本号已经升级、但实际缓存内容还是老的，改了代码也看不到效果。
            // 显式指定 {cache:'reload'} 强制这次预缓存请求跳过HTTP缓存、直接问网络要最新内容，才能保证版本号一升级、
            // 缓存内容必然也是最新的。
            return Promise.all(CORE_ASSETS.map((url) =>
                fetch(url, { cache: 'reload' })
                    .then((res) => { if (res && res.ok) return cache.put(url, res); })
                    .catch((err) => console.warn('[SW] 预缓存失败（不影响其它文件）：', url, err))
            ));
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

// 缓存策略：stale-while-revalidate —— 有缓存就先用缓存立刻显示（快），同时偷偷去网络上拿最新版本存回缓存，
// 下次打开就是新的了；网络请求失败（真的离线）也完全不影响这次能正常看到（用的是缓存兜底）。
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return; // POST（比如发给AI的API请求）完全不拦截，原样走网络
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // 跨域请求（AI API中转、CDN脚本等）不拦截，避免影响这些动态/第三方请求

    // 🆕 打开页面（index.html）改成「先问网络」：以前首页也是先用缓存，刷新一次拿到的永远是上一版的首页——
    //    上一版首页里写的是旧版本号，注册的也是旧的这个 Service Worker，于是上传了新版、刷新也看不到，要刷两次才换。
    //    现在首页每次先去网络拿（最多等 4 秒），拿不到（离线 / 太慢）才用缓存里的，离线照样能打开。
    const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
    if (isPage) {
        event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
            const net = fetch(new Request(req, { cache: 'reload' })).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
            const timeout = new Promise(r => setTimeout(() => r(null), 4000));
            const res = await Promise.race([net, timeout]);
            if (res && res.ok) return res;
            const cached = await cache.match(req) || await cache.match('./index.html') || await cache.match('./');
            if (cached) return cached;
            const late = await net; if (late) return late;
            return new Response('当前离线，且没有可用的缓存内容。', { status: 503, statusText: 'Offline' });
        }));
        return;
    }
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cached = await cache.match(req);
            // 同样强制跳过HTTP磁盘缓存：这是后台"偷偷去网络上拿最新版本"的那一步，如果这里还是命中HTTP缓存的
            // 旧内容，缓存就永远刷新不到真正的最新版本，跟install阶段是同一个坑。
            const networkFetchPromise = fetch(new Request(req, { cache: 'reload' })).then((res) => {
                if (res && res.ok) cache.put(req, res.clone());
                return res;
            }).catch(() => null);

            if (cached) {
                networkFetchPromise; // 不等它，后台悄悄更新缓存
                return cached;
            }
            const netRes = await networkFetchPromise;
            if (netRes) return netRes;
            // 网络也失败、又没有对应缓存：如果是"打开页面"这种导航请求，退回缓存过的首页兜底，
            // 至少能看到app本身（本地数据仍然在，不会丢），而不是白屏/浏览器报错页
            if (req.mode === 'navigate') {
                const fallback = await cache.match('./index.html');
                if (fallback) return fallback;
            }
            return new Response('当前离线，且没有可用的缓存内容。', { status: 503, statusText: 'Offline' });
        })
    );
});

// 用户点击系统通知时，尝试把已经打开的页面聚焦到前台；没有已打开的页面就新开一个
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow('./');
        })
    );
});
