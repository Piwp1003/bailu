// ============================================================================
// 🐛 原生弹窗（alert / confirm / prompt）关掉之后，把键盘焦点抢回来
// ----------------------------------------------------------------------------
// 病根：打包成 exe（Electron）之后，这三个是**系统级的模态窗口**，不是网页里画的。
// 它关闭时，Windows 不保证把键盘焦点还给网页那一层 —— 于是弹窗一关，
// 整个界面就再也打不了字、点了也没反应，非得把窗口切出去再切回来才恢复。
//
// 用户实测出来的触发条件是"导入备份之后"：importData 成功那一支最后会
// alert("数据恢复成功")，就是这一下把焦点弄丢的。但凡走 alert/confirm/prompt 的
// 地方都会中招，不止导入这一处，所以在这里统一包一层，而不是去改某个调用点。
//
// 做两件事：① 让窗口重新激活；② 把焦点还给弹窗之前那个正在用的元素
// （比如你正在聊天框里打字时弹了个确认框，关掉之后光标还在原来那个框里）。
// 普通浏览器里本来就没这个毛病，多做这两步也没有副作用。
// ============================================================================
(function () {
    if (typeof window === 'undefined') return;
    ['alert', 'confirm', 'prompt'].forEach(function (name) {
        const native = window[name];
        if (typeof native !== 'function') return;
        window[name] = function () {
            const prev = document.activeElement;
            try {
                return native.apply(window, arguments);
            } finally {
                // 放到下一个事件循环再抢：弹窗刚关的那一瞬间窗口还没完成激活，立刻调是空操作
                setTimeout(function () {
                    try {
                        window.focus();
                        if (prev && prev !== document.body && typeof prev.focus === 'function' && prev.isConnected) {
                            prev.focus();
                        }
                    } catch (e) {}
                }, 0);
            }
        };
    });
})();

let tempCropResults = {}; // 存储各类裁剪临时 Base64 数据
let pendingImportedGreetings = null; // 角色卡导入时读到的候选开场白，等角色保存后挂到角色身上
// 角色卡导入时顺带识别到的正则脚本（比如状态栏HTML组件），此时角色卡本身还没保存、拿不到真正的角色id，
// 先把这批脚本的id记下来，等saveCharacter()真正生成/确定角色id之后，再回头把charScope绑定成那个角色专属，
// 这样这些角色卡自带的正则默认就只对它自己的角色生效，不会一装上就影响到其它角色的内容。
let pendingImportedRegexScriptIds = [];
let siteLogoImg = null;   // 网站左上角 Logo 数据
let pendingQuotePostId = null; // 用户点击"引用"按钮后，待在发推框里一起提交的被引用推文id；发布/取消后清空

// 通用拖拽调高度手柄：CSS原生的 resize:vertical 拖拽把手在手机触屏上很难精确抓到，体验很差。
// 用 Pointer Events（同一套API自动兼容鼠标拖拽和手指触屏拖拽，不用分别写mousedown/touchstart两套）
// 实现一个真正好按住拖的手柄——用法：在目标文本框/内容框后面紧跟着放一个手柄元素，
// 手柄上写 onpointerdown="startDragResize(event, this)"，函数会去操作它的上一个兄弟元素（previousElementSibling）。
function startDragResize(e, handleEl, minHeight, maxHeight) {
    e.preventDefault();
    const targetEl = handleEl.previousElementSibling;
    if (!targetEl) return;
    const min = minHeight || 60, max = maxHeight || 600;
    const startHeight = targetEl.getBoundingClientRect().height;
    const startY = e.clientY;
    handleEl.setPointerCapture && handleEl.setPointerCapture(e.pointerId);

    function onMove(moveEvent) {
        const dy = moveEvent.clientY - startY;
        targetEl.style.height = Math.max(min, Math.min(max, startHeight + dy)) + 'px';
    }
    function onUp() {
        handleEl.removeEventListener('pointermove', onMove);
        handleEl.removeEventListener('pointerup', onUp);
        handleEl.removeEventListener('pointercancel', onUp);
    }
    handleEl.addEventListener('pointermove', onMove);
    handleEl.addEventListener('pointerup', onUp);
    handleEl.addEventListener('pointercancel', onUp);
}

// 修复安卓App里键盘弹出后，聊天界面因为固定100vh高度不会跟着收缩、
// 底部输入框和键盘之间出现一大截空白的问题。
// 原理：100vh在很多安卓WebView里是"锁死"的初始屏幕高度，键盘弹出并不会让它变小，
// 所以这里改用JS实时量出"当前真正看得见的高度"(visualViewport优先，更准)，
// 写成一个CSS变量--app-vh，样式表里用它代替写死的100vh。
(function () {
    var baseH = 0; // 记下"键盘没弹出来时"的可视高度，用来判断键盘是不是弹出来了

    function setAppVH() {
        var h = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight;
        document.documentElement.style.setProperty('--app-vh', (h * 0.01) + 'px');

        // 键盘检测：可视高度比"正常高度"矮了 15% 以上，就认为软键盘顶上来了。
        // 用比例而不是固定像素，是因为各机型屏幕高度差很多；15% 这个阈值能躲开
        // 浏览器地址栏收起/展开那种几十像素的小变化，只有真键盘才会让高度掉这么多。
        if (h > baseH) baseH = h;
        var kb = baseH > 0 && h < baseH * 0.85;
        document.body.classList.toggle('keyboard-open', kb);
    }

    // 顶栏上方的安全区高度。
    // 🐛 修复"顶部栏上面白了一大条"：CSS 里原来直接吃 env(safe-area-inset-top)，
    // 但打包成 App 之后，5+ 的 WebView 在**非沉浸式**状态栏下本来就已经从状态栏下面开始画了，
    // 这时候 env() 有些机型还会照报一个状态栏高度，于是白边被算了两遍。
    // 5+ 自己有准确答案：isImmersedStatusbar() 告诉我们要不要让位，getStatusbarHeight() 给出真实高度。
    // 拿到就写进 --app-safe-top，CSS 优先用它；网页/PWA 环境没有 plus，回落到 env()，行为不变。
    // 底部导航栏的真实高度。CSS 里它是 56px+安全区，但聊天页和 .main-content 一直按 68px 预留，
    // 差的这 12px 就是"聊天页底下露出一条页面背景"的原因。与其到处写死数字、改一处忘一处，
    // 不如直接量出来写进 --app-nav-h，样式里统一引用。
    function setNavHeight() {
        try {
            const nav = document.getElementById('mobileBottomNav');
            if (!nav) return;
            const h = nav.getBoundingClientRect().height;
            if (h > 0) document.documentElement.style.setProperty('--app-nav-h', h + 'px');
        } catch (e) { /* 量不到就用 CSS 里的默认值 */ }
    }

    function setSafeTop() {
        try {
            if (!window.plus || !plus.navigator) return;
            var immersed = plus.navigator.isImmersedStatusbar ? plus.navigator.isImmersedStatusbar() : false;
            var top = immersed && plus.navigator.getStatusbarHeight ? plus.navigator.getStatusbarHeight() : 0;
            document.documentElement.style.setProperty('--app-safe-top', top + 'px');
        } catch (e) { /* 拿不到就维持 CSS 里 env() 的默认行为 */ }
    }

    setAppVH();
    setSafeTop();
    setNavHeight();
    window.addEventListener('load', setNavHeight); // 首屏样式还没算完时量出来是 0，load 之后再量一次
    window.addEventListener('resize', setAppVH);
    window.addEventListener('orientationchange', function () { setAppVH(); setSafeTop(); setNavHeight(); });
    document.addEventListener('plusready', setSafeTop); // App 环境下 plus 是异步就绪的，这里再补一次
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setAppVH);
        window.visualViewport.addEventListener('scroll', setAppVH);
    }
})();

// ★ 全局适配修复：之前排查"导出没反应"的bug时发现，打包后的安卓App(5+ Runtime)里网页原生的
// alert() 有时候压根不会弹出来（某些机型/安卓版本对WebView里 alert 的支持不稳定），当时是单独给
// 导出功能改用了 plus.nativeUI.alert 才解决。但代码里其它一百多处提示（删除成功、保存成功、各种
// 报错提示等）用的都还是普通 alert()，同样可能在手机上"点了没反应"，静默失败。
// 与其把这一百多处调用一个个改掉（改动面太大、容易漏改也容易改错），这里直接把全局的 window.alert
// 本身替换掉：在打包后的App环境里自动改用更可靠的 plus.nativeUI.alert 弹出，网页版环境完全不受影响、
// 行为和原来一模一样。这样现有代码里所有 alert(...) 调用不用改一个字，都会自动变得可靠。
(function () {
    // 注意：这里不能用"if(window.plus)才覆盖"来做前置判断——window.plus这个对象本身虽然在
    // 5+ Runtime里通常很早就存在，但要严谨起见，判断逻辑放到每次真正调用alert的时候再做（跟
    // appAlert用的是同一个套路），不管此刻plus是否已经就绪，都不影响后面用户点按钮时的判断结果。
    var nativeAlert = window.alert.bind(window);
    window.alert = function (msg) {
        if (window.plus && plus.nativeUI && plus.nativeUI.alert) {
            try { plus.nativeUI.alert(String(msg)); return; } catch (e) {}
        }
        nativeAlert(msg);
    };
})();

// 视图历史栈，用于实现返回上一页功能
let viewHistory = ['home'];
function pushViewHistory(viewId) { if (viewHistory[viewHistory.length - 1] !== viewId) viewHistory.push(viewId); }
function popViewHistory() { if (viewHistory.length > 1) viewHistory.pop(); return viewHistory[viewHistory.length - 1]; }
function goBackToPreviousView() {
    const prevView = popViewHistory();
    switchMainView(prevView);
}

// 核心裁剪逻辑
let cropState = { scale: 1, startX: 0, startY: 0, imgX: 0, imgY: 0, isDragging: false, callback: null, aspect: 1, baseW: 0, baseH: 0 };

function handleImageCrop(file, aspect, callback) {
    if (!file) return;
    const reader = new FileReader();
    // ⚠️ 防御修复：之前这整条 FileReader→Image→打开裁剪弹窗 的链路完全没有错误处理，
    // 中间任何一步失败（读文件失败、图片解码失败、或者取裁剪相关DOM元素时出意外）都会
    // 直接静默卡死在半路——裁剪弹窗自然就"根本不出现"，而且完全没有任何提示或报错，
    // 没法判断到底卡在哪一步。这里给读取失败、图片加载失败都加上可见提示，
    // 并把打开弹窗前的逻辑包一层try/catch，出问题至少能看到具体报错，而不是死一样的沉默。
    reader.onerror = () => { console.error('[图片裁剪] 文件读取失败', reader.error); appAlert('图片读取失败，换一张图片再试试？'); };
    reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => { console.error('[图片裁剪] 图片解码失败'); appAlert('这张图片打不开（可能格式不支持或文件损坏），换一张试试？'); };
        img.onload = () => {
            try {
                const cW = 300; const cH = 300;
                let cutW = 260; let cutH = 260 / aspect;
                if(cutH > 260) { cutH = 260; cutW = 260 * aspect; }

                const cutout = document.getElementById('cropCutout');
                cutout.style.width = cutW + 'px'; cutout.style.height = cutH + 'px';
                cutout.style.left = (cW - cutW)/2 + 'px'; cutout.style.top = (cH - cutH)/2 + 'px';

                const scaleX = cutW / img.width; const scaleY = cutH / img.height;
                const minScale = Math.max(scaleX, scaleY);

                cropState.baseW = img.width * minScale; cropState.baseH = img.height * minScale;
                cropState.scale = 1;
                cropState.imgX = (cW - cropState.baseW)/2; cropState.imgY = (cH - cropState.baseH)/2;
                cropState.aspect = aspect; cropState.callback = callback;

                const cropImgElem = document.getElementById('cropImg');
                cropImgElem.src = img.src;

                document.getElementById('cropZoom').value = 1;
                updateCropView();
                openModal('cropModal');
            } catch (err) {
                console.error('[图片裁剪] 打开裁剪弹窗失败', err);
                appAlert('打开裁剪窗口失败：' + (err && err.message ? err.message : err));
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function updateCropView() {
    const cropImgElem = document.getElementById('cropImg');
    cropImgElem.style.width = (cropState.baseW * cropState.scale) + 'px';
    cropImgElem.style.height = (cropState.baseH * cropState.scale) + 'px';
    cropImgElem.style.left = cropState.imgX + 'px';
    cropImgElem.style.top = cropState.imgY + 'px';
}

document.addEventListener('DOMContentLoaded', () => {
    const cropZoom = document.getElementById('cropZoom');
    if(cropZoom) {
        cropZoom.addEventListener('input', function(e) {
            let oldScale = cropState.scale; cropState.scale = parseFloat(this.value);
            let centerX = 150, centerY = 150;
            cropState.imgX = centerX - (centerX - cropState.imgX) * (cropState.scale / oldScale);
            cropState.imgY = centerY - (centerY - cropState.imgY) * (cropState.scale / oldScale);
            updateCropView();
        });
    }
    const cropContainer = document.getElementById('cropContainer');
    if(cropContainer) {
        const startDrag = (clientX, clientY) => { cropState.isDragging = true; cropState.startX = clientX - cropState.imgX; cropState.startY = clientY - cropState.imgY; };
        const moveDrag = (clientX, clientY) => { if(!cropState.isDragging) return; cropState.imgX = clientX - cropState.startX; cropState.imgY = clientY - cropState.startY; updateCropView(); };
        const endDrag = () => { cropState.isDragging = false; };
        cropContainer.addEventListener('mousedown', e => startDrag(e.clientX, e.clientY)); window.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY)); window.addEventListener('mouseup', endDrag);
        cropContainer.addEventListener('touchstart', e => { if(e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY); }); window.addEventListener('touchmove', e => { if(e.touches.length === 1) moveDrag(e.touches[0].clientX, e.touches[0].clientY); }, {passive: false}); window.addEventListener('touchend', endDrag);
    }
});

function confirmCrop() {
    const cutout = document.getElementById('cropCutout');
    const cW = parseInt(cutout.style.width); const cH = parseInt(cutout.style.height);
    const cLeft = parseInt(cutout.style.left); const cTop = parseInt(cutout.style.top);
    
    const canvas = document.createElement('canvas');
    canvas.width = cW * 2; canvas.height = cH * 2; // 提升清晰度
    const ctx = canvas.getContext('2d'); ctx.scale(2, 2);
    
    const imgEl = document.getElementById('cropImg');
    const drawX = cropState.imgX - cLeft; const drawY = cropState.imgY - cTop;
    const drawW = cropState.baseW * cropState.scale; const drawH = cropState.baseH * cropState.scale;
    
    ctx.drawImage(imgEl, drawX, drawY, drawW, drawH);
    
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    closeModal('cropModal');
    if(cropState.callback) cropState.callback(base64);
}

function updateSiteLogo() {
    const container = document.getElementById('siteLogoContainer');
    const signatureHTML = `<div class="app-signature" style="margin:0;">由 林 制作</div>`;
    // onerror：logo 图片取不到时把自己藏掉，只留下面那行署名。
    // 打包进 App / 拷到别的目录时 icons/ 偶尔会漏带，少一张装饰图不该留个裂图占位，
    // 也不该在控制台里反复刷"资源加载失败"。自定义 logo 同理（用户可能删了那张图）。
    // 高度：原来是 126px，比两行导航还高，把整条侧边栏顶得装不下（15 行时内容 1175px、
    // 窗口才 1000px，刷新和设置得滚动才看得见）。缩到 40px，署名那行保留。
    const imgStyle = `height:40px; width:auto; display:block; object-fit:contain; cursor:pointer;`;
    const onErr = `this.style.display='none'`;
    const src = siteLogoImg || './icons/icon-192.png';
    container.innerHTML = `<img src="${src}" alt="白露" style="${imgStyle}" onerror="${onErr}">${signatureHTML}`;
}


// 蓝V：以前是个"描边五角星 + 勾"，缩到 15px 就是一坨看不清的线，很多人以为是收藏。
// 换成 X 那种实心花瓣底 + 白色勾，小尺寸下也认得出来。
const verifiedSVG = `<svg class="verified-badge" viewBox="0 0 24 24" aria-label="已认证"><path fill="#1d9bf0" d="M12 1.5l2.3 2.05 3.05-.36 1.06 2.9 2.9 1.06-.36 3.05L23 12l-2.05 2.3.36 3.05-2.9 1.06-1.06 2.9-3.05-.36L12 22.5l-2.3-2.05-3.05.36-1.06-2.9-2.9-1.06.36-3.05L1 12l2.05-2.3-.36-3.05 2.9-1.06 1.06-2.9 3.05.36L12 1.5z"></path><path fill="#fff" d="M10.9 15.6l-3-3 1.27-1.27 1.73 1.73 4.03-4.03 1.27 1.27-5.3 5.3z"></path></svg>`;
/* ===== 🐦 推文操作栏的图标：换成 X 那一套实心图形 =====
   以前用的是通用线框图标（对话框、循环箭头、心、眼睛），缩到 18px 之后几个都糊成一团，
   而且"眼睛"很容易被当成"可见性/隐私"。X 那套是**实心路径**，小尺寸下形状还认得出来。
   这些用 fill:currentColor（.x-icon），不是 stroke，所以别再套 .blue-line-icon。 */
const commentSVG = `<svg class="stat-icon x-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path></svg>`;
const retweetSVG = `<svg class="stat-icon x-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path></svg>`;
const likeSVG = `<svg class="stat-icon x-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></svg>`;
const likeSVGFilled = `<svg class="stat-icon x-icon liked" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.505.29-.505-.29C7.117 18.31 4.467 15.67 3.116 13.19c-1.376-2.53-1.415-5.01-.255-6.86 1.16-1.85 3.13-2.83 5.07-2.83 1.55 0 3.09.62 4.07 1.94.98-1.32 2.52-1.94 4.07-1.94 1.94 0 3.91.98 5.07 2.83 1.16 1.85 1.12 4.33-.256 6.86z"></path></svg>`;
// 浏览量：X 用的是三根柱子，不是眼睛（眼睛容易被当成"隐私/可见性"）
const viewSVG = `<svg class="stat-icon x-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"></path></svg>`;
const viewsBarSVG = viewSVG;
// 分享：截图里那个是**三个点用两条线连起来**的那种（安卓/Material 的 share），
// 不是"方框+上箭头"。这里按截图来。
const shareOutSVG = `<svg class="stat-icon x-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"></path></svg>`;
// ⋮ 更多
const moreDotsSVG = `<svg class="stat-icon x-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="19" r="1.8"></circle></svg>`;
// ⚠️ 这一条是 v107 换图标时被误删过一次的（推文带定位时整页报 locationSVG is not defined）。
const locationSVG = `<svg class="blue-line-icon" style="width:18px;height:18px;" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
const quoteSVG = `<svg class="stat-icon blue-line-icon" viewBox="0 0 24 24"><path d="M9 7H4v6h3l-2 4h3l3-6V7zm10 0h-5v6h3l-2 4h3l3-6V7z"></path></svg>`;
const websiteSVG = `<svg class="blue-line-icon" style="width:18px;height:18px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;

// API配置
let myApiUrl = "https://api.deepseek.com", myApiKey = "", myModel = "deepseek-chat"; 
let subApiUrl = "", subApiKey = "", subModel = "";
let vecApiUrl = "", vecApiKey = ""; // 🎯 v107 起：主 API / 副 API 按「重要 / 不重要」分（方案 A）
//   主 API（贵的好模型）：私聊、群聊、故事章节、续写、日记、信件、日记反应
//        —— 这些是你会**逐字读**的内容，值得用好模型
//   副 API（便宜的小模型）：其余全部——评论区、路人、状态、日程、记忆总结、
//        游戏决策、小功能里的各种一句话，这些多半是扫一眼就过
//
// 以前全项目 60 多处取 API，56 处传 true（= 副 API 优先），
// 结果副 API 一填全就接管了几乎一切，主 API 只剩四件事在用。
// 现在"重要"的那批改走 getApiMain()。
//
// ⚠️ 两边都会兜底：主的没配全就用副的，副的没配全就用主的，
//    只填一个 API 的用户完全无感。
function getApiMain() {
    if (myApiKey && myApiUrl && myModel) return { url: myApiUrl, key: myApiKey, model: myModel, isSub: false };
    return getApiConfig(true);
}

// 向量记忆专用API（选填）：填了就专用于 /embeddings 请求（跟主API、副API完全独立），不填则自动走主API
let lastWorkingModel = "", lastWorkingSubModel = ""; // 主/副API各自最近一次成功用过的模型，供"模型不可用自动兜底"使用
let quietHoursEnabled = false, quietHoursStart = "23:00", quietHoursEnd = "08:00"; // 休息时间段：这段时间内不触发主动消息（本地+云端）
// 采样参数（sampler）：全部留空字符串＝不发送该字段，使用服务商默认值；用户在设置页填了才会真的带上。
let samplerTemperature = "", samplerTopP = "", samplerFrequencyPenalty = "", samplerPresencePenalty = "", samplerTopK = "";
let samplerMaxTokens = "";   // 单次输出上限；留空＝不发送这个参数，用服务商默认
// 把当前设置里的采样参数拼成请求体要合并的对象；forAnthropic=true时只带temperature/top_p/top_k（Anthropic /v1/messages 支持的），
// 不带 frequency_penalty/presence_penalty（Anthropic 接口不认识这两个字段，带了大概率会直接报错）。
function getSamplerExtraBody(forAnthropic) {
    const body = {};
    const t = parseFloat(samplerTemperature); if (!isNaN(t)) body.temperature = t;
    const tp = parseFloat(samplerTopP); if (!isNaN(tp)) body.top_p = tp;
    if (forAnthropic) {
        const tk = parseInt(samplerTopK); if (!isNaN(tk)) body.top_k = tk;
    } else {
        const fp = parseFloat(samplerFrequencyPenalty); if (!isNaN(fp)) body.frequency_penalty = fp;
        const pp = parseFloat(samplerPresencePenalty); if (!isNaN(pp)) body.presence_penalty = pp;
    }
    // 用户在设置里填了输出上限就带上。注意这里放在 body 里、会被调用点自己的 extraBody 覆盖
    // （比如日程记忆总结那种明确只要 600 token 的短任务），那是有意的：
    // 用户设的是"通用上限"，个别短任务自己更清楚要多少。
    const mt = parseInt(samplerMaxTokens);
    if (!isNaN(mt) && mt > 0) body.max_tokens = mt;
    return body;
}

// ✂️ 撞上 max_tokens 被硬切断时给一条明确提示。
// 不提示的话用户只能看到一句写到一半的话，完全不知道是模型的问题还是 app 的问题——
// "为什么一直截断"就是这么来的。同一分钟内只提醒一次，免得连着几条都断时刷屏。
let __gyLastTruncateNotice = 0;
function gyNoticeIfTruncated(data) {
    try {
        const fr = data && data.choices && data.choices[0] && data.choices[0].finish_reason;
        if (fr !== 'length') return;
        const now = Date.now();
        if (now - __gyLastTruncateNotice < 60000) return;
        __gyLastTruncateNotice = now;
        const cur = parseInt(samplerMaxTokens);
        const where = (!isNaN(cur) && cur > 0)
            ? `你把「单次输出上限」设成了 ${cur}，这次写满就被切断了。调大一点（比如 ${Math.min(65536, cur * 2)}）再试。`
            : '这次写到服务商的默认上限就被切断了。去「设置 → 🎚️ 生成参数 → 单次输出上限 max_tokens」填个大一点的值（比如 8192）。';
        console.warn('[输出被截断] finish_reason=length');
        if (typeof showToast === 'function') {
            showToast('<div class="avatar" style="width:40px;height:40px;background:#ffad1f;color:#fff;font-size:20px;">✂️</div>',
                '这条被截断了', where + '（用推理模型时，思考过程也可能占掉这个额度）', null, null, false);
        }
    } catch (e) { /* 提示失败不影响正文 */ }
}

// 设置及字数限制
let allowActionTags = false; // 控制是否允许动作描写
// 🖐️ 聊天回复模式：auto = 消息发出去 TA 就回（一直以来的行为）
//                 manual = 发完不自动回，想让 TA 回的时候点输入框右边那颗「回复」
let gyChatReplyMode = 'auto';
let chatBatchDelaySec = 0;   // 自动模式点发送后等几秒再回（0＝点了就回）
// 关闭（默认）=现有逻辑：角色对用户评论/推文互动必须按原有规则回应（评论/点赞/NO等）。
// 开启后：角色在这些场景下多一个选择——可以自主判断"这事儿更适合私下聊"，转而主动发一条私聊消息去找用户聊，
// 而不是老老实实在推文底下评论。目前接入了"用户评论互动"和"角色对用户新帖子的反应"这两个最主要的场景。
let enableCharMoveToChat = false;
// 小说功能展示项开关：默认都开，关掉哪项就不显示对应内容。三项各自独立，互不影响。
let showNovelReasoning = true; // 是否把AI输出里识别到的思维链渲染成可折叠区块（关掉=不管全局思维链设置，续写/章节这边一律直接剥掉不展示）
let showNovelFloorNumber = true; // 互动续写每一轮是否显示"第N层"楼层号（论坛楼层式编号）
let showNovelThinkingTime = true; // 是否显示这一轮/这一章从发起请求到生成完毕耗费的时间
// "用已有内容生成小说"弹窗的临时勾选状态，只在弹窗打开期间使用，不需要持久化存档，每次打开弹窗都会重置。
// key是分类，value是Set：continuation/memory/chat存的是id（小说id/角色id/角色id），diary存"charId::kind::entryId"，
// tweet存postId，comment存"postId::replyId"。
let novelSourceSelection = { continuation: new Set(), diary: new Set(), chat: new Set(), tweet: new Set(), comment: new Set(), memory: new Set() };
let humanFeelEnabled = true; // 人味强化协议：反套路/反回声/情绪校准，注入所有角色生成的系统提示词最前面
let tpesEnabled = true; // TPES 时间感知增强系统：让角色对真实时间流逝有感知
let autoRenderStatusChips = true; // 通用方括号状态栏识别：把 [标签|值...] 格式的AI输出自动渲染成好看的状态行，不区分具体标签名
// 状态栏分场景开关：总开关 autoRenderStatusChips 之下，再按「推文 / 评论」分别控制。
// 有些角色卡的状态栏字段特别多（脑内、想舔哪、搜索记录……），刷在时间线上太挤，
// 但在聊天/日记里又想留着，所以拆成三个开关而不是一刀切。
let showStatusInPosts = true;     // 推文正文里是否渲染状态栏
let showStatusInComments = true;  // 评论/跟帖里是否渲染状态栏
let showStatusInDiary = true;     // 日记/信件里是否渲染状态栏
// 聊天气泡里的状态栏（[STATUS_START]…[STATUS_END] 这类）：
// 关（默认）= 从气泡里摘掉不显示（聊天气泡是纯文本，这一坨原样糊在气泡里本来就是没剥干净）；
// 开 = 摘出来渲染成气泡下方一张可折叠的小状态卡。只影响显示，存档和发给 AI 的内容都不动。
let showStatusInChat = false;
// 故事功能 / 角色专属世界书选择列表：各自独立的"当前分类筛选值"+"待保存勾选集合"。
// 用Set单独跟踪勾选状态而不是直接读DOM的:checked，是因为这两处列表现在也能像世界书主页一样按分类筛选，
// 切换分类会重新渲染列表、把不在当前分类下的世界书从DOM里隐藏掉——如果还是保存时才去读DOM :checked，
// 那些"已经勾选但因为切换了分类筛选而暂时不在页面上"的世界书就会被当成没勾选，保存时就会丢失选择。
let novelWbCategoryFilter = null, novelWbPendingSelection = new Set();
let novelViewMode = 'outline'; // 故事编辑器当前子模式：'outline'=一键生成模式，'interactive'=互动续写模式（类酒馆聊天）
let charFormWbCategoryFilter = null, charFormWbPendingSelection = new Set();

let memoryAlbum = []; // 回忆相册/高光时刻收藏：[{id, type:'chat'|'post', charId, charName, text, timestamp, note}]
let regexScripts = []; // 正则替换脚本：[{id, name, find, replace, flags, isRegex, target:'ai_output'|'user_input'|'both', enabled}]
let enableVectorMemory = false; // 向量记忆：语义检索历史聊天，而不是只看最近N条
let enableChatScriptExecution = false; // 允许聊天消息里的<script>标签真正执行（有安全风险，默认关闭）
let embeddingModel = 'text-embedding-3-small'; // 向量记忆/资料库共用的 embedding 模型名
let dataBank = []; // 角色专属资料库(RAG)：[{id, charId, title, chunks:[{text, embVec}], createdAt}]
let plugins = []; // 插件系统：[{id, name, description, type:'prompt'|'action'|'macro'|'script', scope:'global'|charId, enabled, promptText, actionLabel, actionPrompt, macroName, macroValue, code}]
// AI预设系统（仿SillyTavern的"Chat Completion 预设"）：每个预设是一整套可整体切换的提示词模块+采样参数。
// [{id, name, enabled(同一时间只有一个预设enabled=true，切换时互斥), prompts:[{id,name,role,content,enabled}], samplerParams:{temperature?,top_p?,frequency_penalty?,presence_penalty?,top_k?}}]
let aiPresets = [];
// 多用户人设（仿SillyTavern的Persona管理）：保存多份"我"的资料快照，可随时另存/切换，
// 切换时会把快照里的字段整体覆盖进 currentUser（跟原有到处使用 currentUser.xxx 的代码完全兼容，不用改任何引用点）。
// [{id, label, data:{name,handle,persona,bio,gender,avatarImg,bgImg,...currentUser的其它字段}}]
let userPersonas = [];
// 路人NPC的身份表：{ 昵称: {id, name, handle, avatarEmoji, themeColor} }
// 存起来是为了让同一个路人在不同帖子、不同天里都是**同一个账号**——
// 评论区才像个有熟脸的地方，而不是每次刷出一堆一次性的陌生人。见 js/10 的 getNpcIdentity。
let npcIdentities = {};
let enableBrowserNotifications = false; // 浏览器系统级推送通知
let darkTheme = false; // 深色模式
// ====== 云端主动消息唤醒（网页锁屏/关闭后，靠Cloudflare Worker代为检测+推送ntfy通知）======
let cloudSyncEnabled = false; // 总开关
let cloudWorkerUrl = ''; // 你部署的 Cloudflare Worker 地址，例如 https://xxx.workers.dev
let cloudAuthToken = ''; // 与Worker约定的共享密钥（同一个字符串要填在Worker的Secret里）
let ntfyTopic = ''; // ntfy.sh 的推送topic名（建议用一长串随机字符，越难猜越安全）
let lastCloudSyncTime = 0; // 节流：避免同步请求发得太频繁
const CLOUD_SYNC_MIN_INTERVAL = 3 * 60000; // 两次同步之间至少间隔3分钟
// ⚡ 上下文预算管理：功能越加越多，prompt容易越滚越大，这几个数字用来控制每次请求塞给AI的字数上限，省token省钱
let worldbookCharBudget = 2000;   // 世界书正文最多占用的字数（超过预算的低优先级条目会被自动跳过，不影响关键设定）
let semanticCharBudget = 1200;    // 向量记忆 + 资料库检索结果最多占用的字数
// 🫀 活人感的各项参数（开关本身在 AUTO_FEATURE_DEFS / autoFeatureSwitches 里）
let aliveSettings = {
    sleepStart: 1,        // 几点之后算睡着了（没日程的角色按这个）
    sleepEnd: 8,          // 几点算醒
    minDelay: 5,          // 忙完之后再随机等 minDelay~maxDelay 分钟才回，别掐着秒回
    maxDelay: 30,
    urgentWords: '急,出事,救命,医院,别不理我',  // 消息里带这些词就立刻回，不挂起
    moodHalfLife: 8,      // 情绪多少小时衰减一半
    maxHold: 12,          // 最多挂多久（小时），超了强制回，防止日程写错把人锁死
    // 🫀 记忆褪色
    fadeClear: 3,         // 几天之内算"记得清楚"（全文给）
    fadeBlur: 14,         // 几天之内算"大概记得"（压到 60 字），再往前只剩印象（26 字）
    fadeDepth: 8,         // 往回翻几条总结（老的压过，比原来的 5 条全文还省）
    // 🔗 补齐"存了但一直没接上"的那几块（默认都开，这是补洞不是加功能）
    knowProfile: true,    // 角色知道自己资料页上写了什么
    knowFaction: true,    // 角色知道自己属于哪个势力
    knowDiary: true,      // 角色记得自己写过的日记
    useBusyReply: true,   // 消息被挂起时，用角色资料页里那句"忙碌自动回复"
    knowAnniv: true       // 角色知道今天是你记在日历里的什么日子
};
let aliveHeld = {};       // { sessionId: {charId, texts:[], since, until, kind, why} } 挂起的消息
let scheduleHistoryKeep = 14;     // 🗓️ 日程归档保留天数（记忆总览页里可调）：留得多能往回翻得更远、总结素材更全，存档也更大
let chatHistoryTurns = 20;        // 每次请求带入的最近聊天轮数（原来10条太短，跟每20条自动总结一次的周期对不上，容易在10条左右出现"原始上下文刚断层、总结里的旧话题却还杵在prompt里"导致话题跳回旧内容的问题，调大到20缓解断层）
// 💰 每条帖子最多让几个角色来互动。0 = 不限（改造前的行为）。
// 这是整个app里最影响 API 花费的一个数字：发推/发论坛贴那条路以前是 `for (let char of myCharacters)`，
// 角色库里有几个角色就发几次请求，每次都要带上那个角色的完整人设+世界书+预设（实测单次约 5900 字）。
// 27 个角色时，发一条推文＝30 次调用、约 9 万 token，其中 98% 花在这个循环上，而且角色越多越贵、线性增长。
let charInteractMaxCount = 5;

// 从候选角色里按"跟这条内容的相关度"挑最多 n 个出来互动。
// 排序思路是"谁最该出现在这条帖子的评论区"：
//   1) 正文里点名/@到的（名字或handle出现在文本里）—— 明确被叫到的人绝对不能被挤掉
//   2) 关系网里跟发帖人有连线的 —— 有关系的人才会关注彼此的动态
//   3) 最近跟用户聊过天的 —— 正在热络的人自然更活跃
//   4) 已关注的
//   5) 其余随机（每次随机，保证冷门角色也轮得到，不会永远是同几个人刷屏）
// 同一档次内部随机打散，避免每次都是角色列表里靠前的那几个。
function pickInteractingChars(candidates, contextText, authorId) {
    const list = (candidates || []).filter(Boolean);
    // 🎲 互动人数设成「TA 定」：不按数字砍，谁来由各自的关系和性子决定（js/53）
    if (typeof gyTaPickInteracting === 'function' && typeof gyTaGlobalOn === 'function' && (gyTaGlobalOn('charInteractMaxInput') || (typeof gyTaAllAuto === 'function' && gyTaAllAuto()))) return gyTaPickInteracting(list, contextText, authorId);
    const n = (typeof charInteractMaxCount === 'number') ? charInteractMaxCount : 0;
    if (!n || n <= 0 || list.length <= n) return list;   // 0＝不限；本来就不超额也不用挑
    const text = String(contextText || '');
    const now = Date.now();
    const scored = list.map(c => {
        let score = 0;
        try {
            const handle = String(c.handle || '').replace('@', '');
            if (c.name && text.indexOf(c.name) !== -1) score += 1000;
            if (handle && text.toLowerCase().indexOf('@' + handle.toLowerCase()) !== -1) score += 1000;
            if (typeof charRelationships !== 'undefined' && Array.isArray(charRelationships) && authorId !== undefined) {
                if (charRelationships.some(r => (String(r.fromId) === String(c.id) && String(r.toId) === String(authorId))
                                             || (String(r.toId) === String(c.id) && String(r.fromId) === String(authorId)))) score += 300;
            }
            const chat = (typeof globalChats !== 'undefined' && globalChats) ? globalChats[c.id] : null;
            if (chat && chat.length) {
                const last = chat[chat.length - 1].timestamp || 0;
                const days = (now - last) / 86400000;
                if (days < 1) score += 200; else if (days < 3) score += 120; else if (days < 7) score += 60;
            }
            if (c.isFollowing) score += 40;
            if (c.isSpecialFollow) score += 30;
        } catch (e) { /* 单个角色数据异常不影响整体挑选 */ }
        return { c, score, r: Math.random() };
    });
    scored.sort((a, b) => (b.score - a.score) || (a.r - b.r));
    return scored.slice(0, n).map(x => x.c);
}
let enableScheduleAutoCheck = true; // 日程每日自动检测过期并提醒续写
let enableAffinitySystem = false; // 好感度数值系统（现在由"好感度系统"插件驱动，这个变量仍会被插件读写）
let enableTypingIndicator = true; // 正在输入提示/已读状态
// 💬 聊天里的时间分隔条（微信那种居中灰字）：隔太久就插一条，点一下展开成完整日期
let chatTimeSepEnabled = true, chatTimeSepMin = 5;
// 📷 主页顶上那张大图（朋友圈那种封面）。默认关：不开就一个节点都不加，项目原样。
// ⚠️ 顶层 let 不会挂到 window 上，js/43 里只能写裸名字读它，别写 window.momentsHomeOn。
let momentsHomeOn = false;
let enableMiniGameCharSpeech = true; // 小游戏中角色是否发言的总开关（关闭后玩游戏时全程只有系统状态消息，角色不再评论/吐槽）
let chatListViewMode = 'row'; // 聊天联系人展示模式：'row'=横向头像条（原样式），'list'=竖排列表（头像+名字+最后消息预览+时间）
let pinnedSessionIds = []; // 置顶的角色/群聊会话id列表（可置顶多个）
let chatListShowingList = true; // 仅在 list 视图模式下有意义：true=正在浏览联系人列表，false=正在查看某个聊天内容
let enableAnniversary = true; // 纪念日系统
let chatWordLimit = 50, postWordLimit = 50, diaryWordLimit = 400, letterWordLimit = 400, commentWordLimit = 30;
// ✉️🗒️ 用户写信收到回信、日记被偷看后角色反应，这两处"随机等多久才有动静"的范围（单位：分钟），用户可以在设置里自己调；
// 到点前也可以直接点"立即回复"跳过等待。
let letterReplyDelayMin = 60, letterReplyDelayMax = 360;
// 🗒️ "我写日记选角色偷看"这个新玩法的数据：跟角色自己写的日记(char.diaryData.diaries，用户偷看那种)是完全独立的两套数据，
// 一条记录 {id, title, content, date, targetCharIds:[...], reactions:[{charId, status:'pending'|'peeked'|'not_peeked', dueAt, resultText}]}
let globalUserDiaries = [];
// 标记"旧版Unsplash链接清洗"是否已经彻底跑过一遍——只需要跑一次，跑过之后要跟着存档持久化下来，
// 否则每次 saveAllData() 都会把这个标记连同其它数据一起原样存回去，标记没了，下次打开app又会重新
// 触发一遍整个存档的 JSON.stringify+全局正则扫描，白白多占内存（详见 loadAllData 里的清洗逻辑）。
let unsplashCleaned = false;
// 💡 聊天多段回复的"条数"范围：AI一次回复可能拆成好几条消息分开发（模拟真人连发微信），
// 之前这个范围写死是"1到5条"，现在开放成可以自己调——chatWordLimit 同时也从"每条的上限"
// 改成了"这几条加起来的总字数预算"，由AI自己在这个总预算里，按 chatMsgCountMin~chatMsgCountMax
// 条的范围内自行决定要发几条、每条怎么分配字数。
let chatMsgCountMin = 1, chatMsgCountMax = 5;
// 💬 聊天回复条数/长度模式：'limited'=现在这套（chatMsgCountMin~Max条范围+chatWordLimit总字数硬上限，默认），
// 'classic'=旧版本聊天体验（条数固定随机1~4条、单条不限字数，没有总字数上限）——有用户喜欢现在这套省字数/更可控，
// 也有用户觉得被总字数卡得不自然、更喜欢旧版本那种想写多长写多长的聊天感觉，所以做成可以随时切换，不用二选一锁死。
let chatReplyStyleMode = 'limited';

// 💡 自动总结触发频率：以前"每聊几条消息自动总结一次"是写死的（单聊20条/群聊50条/推文记忆20条），
// 现在开放成可以自己调——数字越小总结越勤（更省心但更耗token/请求），越大越省但可能有段时间的
// 空窗期没被总结进去。这几个数字同时也决定"每次总结时截取最近多少条素材"（跟触发间隔保持一致）。
let chatSummaryInterval = 20;   // 单聊：每N条消息自动总结一次
let groupSummaryInterval = 50;  // 群聊：每N条消息自动总结一次
let postMemoryInterval = 20;    // 推文记忆：每N条帖子自动总结一次

// 💡 字数要求优先级声明：预设(AI预设系统)里的提示词模块可能自带自己的字数要求（比如某些酒馆预设的
// "文风模块"会写"控制在300-500字"），这段文字会跟着预设一起被塞进系统提示词里；而这里（聊天/推文/
// 日记/信件/续写/论坛等）用户自己设置的字数上限，是在那之后另外拼接、发给AI的。两条字数指令同时出现在
// 同一次请求里时，模型不一定100%听更靠后那条——这里统一加一句明确的优先级声明，附在每处"硬性字数上限"
// 提示词后面，把"听谁的"直接挑明说给AI听，避免被预设自带的字数描述带偏。
const WORD_LIMIT_PRIORITY_NOTE = '如果前文人设、世界书或预设内容里提到了不同的字数要求，一律以这里的字数要求为准。';

// 🐛 经典模式专用的同款声明。
// 上面那句只挂在"有字数上限"的场景后面，于是经典模式（本来就不设上限）反而成了唯一没人把话挑明的地方：
// prompt 里前面还留着预设/世界书自带的"控制在xxx字"，后面只有一句"单条不限制字数"跟它对着干，
// 模型每轮自己挑一个听——这轮听预设的写得又短又碎（看着就像切回了可控字数模式），下轮听经典的又放开写。
// 用户的体感就是"正常聊天时模式自己在新旧之间来回跳"，而且因为世界书是按关键词触发的，
// 有时候还真的是聊到某个话题才开始跳，更像"聊着聊着变了"。
// 这里给经典模式补上对称的一句，把"谁说了算"同样挑明。
const NO_WORD_LIMIT_PRIORITY_NOTE = '如果前文人设、世界书或预设内容里提到了任何字数要求或字数上限，在这里一律不适用、不要遵守——本条指令优先，这一轮回复不设任何字数上限。';

// 聊天"多段回复指令"文案：主聊天(js/05 triggerAIBatchReply)和角色主动发消息(js/07 sendProactiveChatMessage)
// 两处原来是各自复制一份几乎一样的长文案，现在收成这一个共享函数——顺便借这个机会实现"回复条数/长度模式"切换：
// 'classic' 分支的文案是直接照搬旧版本script.js里 triggerAIBatchReply 的原文（条数固定随机1~4条、单条不限字数、
// 没有总字数上限，还带着旧版本那段"打破机械化段落结构/替换平淡词汇"的人性化文风要求），一个字都没改，
// 保证选了经典模式的用户拿到的确实是他们怀念的那个版本的行为，不是我自己按理解重新写的一份。
function getChatMultiReplyBlock() {
    if (chatReplyStyleMode === 'classic') {
        // 🐛 修复"切换经典模式后回复里混进别的角色人设"：旧版原文里"保留原文核心信息与核心意图"这类措辞，
        // 本意是"让AI自己的话别写得太规整机械"，但字面上很像"改写/复述某段既有原文"的指令——而prompt里
        // 世界书/关系网经常会附带其它角色的人设简介作为背景信息，模型偶尔会把"离这段指令最近的一段人物描述"
        // 误当成要"保留/复述"的那个"原文"，导致回复里混进别的角色人设（1对1和群聊都会中招，因为关系网/世界书
        // 描述其他角色这件事跟是不是群聊无关）。这里在旧版原文前面加一句身份锚点澄清，不改动原文一个字，
        // 只是明确"要保留意图的是你自己想说的话，不是别人的设定"。
        return `【多段回复指令】\n你自始至终只以你自己的人设身份来回复，不要代入或复述聊天记录、世界书、人物关系网里提到的任何其他角色的人设/口吻/设定——下面这些关于"怎么把话写得自然"的要求，指的是把你自己要说的内容写得更真实自然，不是要你改写、复述或代入别的什么"原文"。\n回复条数随机不固定，单条不限制字数。${NO_WORD_LIMIT_PRIORITY_NOTE}动作描写必须真实详尽，回复贴近人类自然表达，并保留原文核心信息与核心意图，减少过于规整的完美句式，适当加入不规则表达；融入个性化语言风格，穿插少量口语化表述；打破机械化的段落结构，让整体读起来更真实自然。替换平淡词汇，选用更精准、生动的表达；调整句式结构，让行文更流畅自然，同时强化语言韵律感；统一语言风格并契合使用场景；修正语法、拼写等细节错误，全程保留原文核心信息与核心意图。模仿真实的微信聊天，通过多条消息（随机发送1到4条）和随机的时间间隔发送。\n输出格式【必须严格遵守JSON】，不要包含任何 Markdown 语法、不要带有 \`\`\`json 前缀，不要有任何其他的说明文字；text字段内部如果要出现双引号（比如引用/复述一句话），必须写成转义的 \\" ，不能直接写裸的 " ，否则JSON会解析失败、导致整段代码原样显示出来。如果决定不回复，请直接返回 {"replies": []}。\n格式示例：\n{\n  "replies": [\n    {"delay": 2, "text": "你要这么说的话..."},\n    {"delay": 3, "text": "我可就不困了啊[EMO:emo_123]"}\n  ],\n  "stateUpdate": "打算回去继续睡回笼觉", "statusTypeLabel": "睡觉"\n}`;
    }
    return `【多段回复指令】\n回复条数在${chatMsgCountMin}到${chatMsgCountMax}条之间自己决定（不固定，别每次都卡最大值），这几条加起来的总字数不超过${chatWordLimit}字（这是硬性上限，不是必须写满）——自己按内容需要把这个总字数分配到每一条里，可以有长有短，不要求条条都写满。${WORD_LIMIT_PRIORITY_NOTE}模仿真实的微信聊天，通过多条简短消息和随机的时间间隔发送。\n输出格式【必须严格遵守JSON】，不要包含任何 Markdown 语法、不要带有 \`\`\`json 前缀，不要有任何其他的说明文字；text字段内部如果要出现双引号（比如引用/复述一句话），必须写成转义的 \\" ，不能直接写裸的 " ，否则JSON会解析失败、导致整段代码原样显示出来。如果决定不回复，请直接返回 {"replies": []}。\n格式示例：\n{\n  "replies": [\n    {"delay": 2, "text": "你要这么说的话..."},\n    {"delay": 3, "text": "我可就不困了啊[EMO:emo_123]"}\n  ],\n  "stateUpdate": "打算回去继续睡回笼觉", "statusTypeLabel": "睡觉"\n}`;
}

// 「🔄 侧滑重新生成」单条回复用的指令。它和 getChatMultiReplyBlock 一样，必须跟着
// "聊天回复条数/长度模式"走。
// 🐛 修复"聊着聊着模式自己在新旧之间来回跳"：这段文案以前不管什么模式都写死
// "回复字数不超过 chatWordLimit 字"，于是选了经典模式的用户会看到——正常聊天是旧版那种
// 想写多长写多长，一旦侧滑重新生成，这一条突然被砍成几十字的短回复，再发下一条又变回旧版。
// 用户感受到的就是"模式自己在切换"，其实是这一条路径漏掉了模式判断。
// 注意：重新生成替换的是**一条**气泡，所以这里不套用经典模式"随机发1~4条"的分条要求，
// 只把"不限字数、写得自然"这部分对齐（真返回多条的话，调用处会用 \n 合并进同一条，不会出错）。
function getChatRegenReplyBlock() {
    const lengthRule = chatReplyStyleMode === 'classic'
        ? NO_WORD_LIMIT_PRIORITY_NOTE + '这一条不限制字数，想写多长写多长；动作描写真实详尽，贴近人类自然表达，少用过于规整的完美句式，适当加入不规则表达和少量口语化表述。'
        : `回复字数不超过${chatWordLimit}字（这是硬性上限，不是必须写满）。${WORD_LIMIT_PRIORITY_NOTE}`;
    return `\n【回复指令】\n${lengthRule}输出格式【必须严格遵守JSON】，不要包含任何 Markdown 语法。格式示例：\n{\n  "replies": [\n    {"text": "你想回复的对话或动作"}\n  ],\n  "stateUpdate": "你的内部状态", "statusTypeLabel": "闲"\n}`;
}

let npcReplyProb = 0.4, npcReplyMaxCount = 3;
// 路人之间互相接话/吵架的概率。评论区里网友互相搭话本来就比"各说各的"常见得多，
// 但也不能每轮都吵，不然角色的话会被路人吵架刷没。
let npcArgueProb = 0.5;
// 角色回应是否延迟（不秒回）。关掉就是老行为——测试和"我就想立刻看到效果"时有用。
let charReplyDelayEnabled = true;
// 流式输出（边生成边显示）开关。开着更有"正在写"的实时感；
// 关掉就整段生成完再一次性显示——有些中转服务商的流式通道不稳定（吞字、卡住、直接报错），
// 遇到这种情况关掉它更省心。
//
// 这个开关现在管三个地方：
//   1. 续写工作台（互动续写/小说）—— 逐字往正文里贴，最细的那种流式。
//   2. 酒馆桥接的 generate（给角色卡里的脚本用）—— 同上，逐字回调。
//   3. 聊天 / 群聊 —— **按气泡**流式，不是按字。原因是聊天要求模型返回一整段
//      {"replies":[...]} 的JSON，半截JSON贴到气泡里就是一堆乱码；但"数组里已经写完的
//      那几条"是可以提前发出来的。所以这里一边收一边扫，扫到一个闭合的 {...} 就立刻发一条，
//      模型还在写第二条的时候第一条气泡已经出来了（见 extractStreamingReplies）。
//      关掉就退回老行为：整段收完再一条条发，功能完全一样，只是第一条要多等一会儿。
// 表情包/图片/引用/转私聊这些标记的解析在两条路上是同一段代码，不会因为开不开流式而不一样。
let enableStreaming = true;
// 群聊转私聊：角色看完群里的对话，可以自己决定要不要私下来找用户说。
// 跟推特评论区那个"转私聊"是同一套机制（[MOVETOCHAT] 标记 + deliverCharMoveToChatMessage），
// 但开关分开——群里当着大家的面不好说的话转私聊，跟评论区那个场景是两回事，
// 有人想要群聊安静点、只在评论区用，得能分别关。
let enableGroupMoveToChat = true;
let globalBgImage = null, globalBgOpacity = 1;

/* ============================================================
   💾 gyStore —— 小功能模块统一的存档口（带兜底 + 存不上会说话）
   ------------------------------------------------------------
   踩过的坑：各个小功能模块都是这么写的——
       const LF = (typeof localforage !== 'undefined') ? localforage.createInstance(...) : null;
       async function save() { try { if (LF) await LF.setItem(KEY, S); } catch (e) {} }
   两个问题，而且都是**静默**的：
     ① localforage 拿不到时 LF 是 null，于是 `if (LF)` 直接跳过——**什么都没存，一声不吭**；
     ② 真写失败了（无痕模式、配额满、打包环境里 IndexedDB 被限制），
        catch 把错误吞掉，用户只看到"我改的设置怎么又变回去了"，连个提示都没有。
   现在统一走这里：先 localforage，不行就退到 localStorage（小数据才镜像，
   免得把几十兆的图片音乐塞爆 5MB 的配额），两条路都失败才算真失败——
   真失败会弹一次提示告诉你，而不是假装存上了。
   ============================================================ */
window.gyStore = function (name, storeName) {
    let lf = null;
    try {
        if (typeof localforage !== 'undefined') lf = localforage.createInstance({ name, storeName });
    } catch (e) { lf = null; }
    const lsKey = k => 'gyfs:' + name + ':' + storeName + ':' + k;
    const MIRROR_MAX = 300 * 1024;      // 超过这个大小就不往 localStorage 镜像了
    let told = false;
    const complain = (err) => {
        if (told) return; told = true;
        const msg = '「' + name + '」的设置存不下来（' + (err && err.message || err || '存储不可用') +
                    '）。改动这次能用，但一刷新就没了。';
        console.warn('[存档]', msg);
        try { if (typeof showToast === 'function') showToast('', '设置没存住', msg, null, null, false); } catch (e) {}
    };
    return {
        _lf: lf,
        async getItem(k) {
            if (lf) { try { const v = await lf.getItem(k); if (v !== null && v !== undefined) return v; } catch (e) {} }
            try { const raw = localStorage.getItem(lsKey(k)); if (raw != null) return JSON.parse(raw); } catch (e) {}
            return null;
        },
        async setItem(k, v) {
            let ok = false, lastErr = null;
            if (lf) { try { await lf.setItem(k, v); ok = true; } catch (e) { lastErr = e; } }
            try {
                const raw = JSON.stringify(v);
                if (raw.length <= MIRROR_MAX) { localStorage.setItem(lsKey(k), raw); ok = true; }
            } catch (e) { lastErr = lastErr || e; }
            if (!ok) complain(lastErr);
            return ok;
        },
        async removeItem(k) {
            if (lf) { try { await lf.removeItem(k); } catch (e) {} }
            try { localStorage.removeItem(lsKey(k)); } catch (e) {}
        },
        async keys() { if (lf) { try { return await lf.keys(); } catch (e) {} } return []; },
        async iterate(fn) { if (lf) { try { return await lf.iterate(fn); } catch (e) {} } }
    };
};

/* ============================================================
   📣 接口出错要说话 —— 全局兜底
   ------------------------------------------------------------
   查下来有 12 个小功能模块（一起看电影、八卦、随身物、日子、商城、邀请、
   包裹、钱包、外卖、手机、换装、冷落、NPC）**从来不看接口返回里的 error**：
       const d = await callChatCompletionAPI(...);
       const t = d.choices?.[0]?.message?.content || '';
       if (!t) return;            ← key 过期 / 限流 / 模型名写错，全在这一行悄悄没了
   结果就是"角色怎么不说话了"、"点了没反应"，而你永远不知道是接口报错。
   与其去改十二个文件（还会漏、以后新增的又得记得写），不如在**唯一的出口**上
   兜一次：返回里带 error 就弹一次提示，说清是哪一场、什么错。
   只提示、不改返回值——各模块原来的逻辑一行都不用动。
   ============================================================ */
(function wrapApiErrorNotice() {
    const SCENE_NAME = {
        chat: '私聊', group: '群聊', post: '发推文', comment: '评论', forum: '论坛',
        diary: '写日记', letter: '写信', react: '看日记反应', novel: '小说/续写',
        proactive: '主动找你', schedule: '排日程', autonomy: '自主模式',
        theater: '小剧场', web: '联网探索', silence: '很久没回消息',
        phoneTalk: '手机里那些人', dress: '换装', invite: '邀请', film: '一起看电影',
        read: '一起阅读', music: '音乐盒', map: '行程与天气', gossip: '八卦网',
        kit: '随身物', days: '日子', mall: '商城', wallet: '钱包', takeout: '外卖',
        phoneAct: '手机', game: '桌游', custom: '指定回复', welcome: '群欢迎'
    };
    let lastMsg = '', lastAt = 0;
    function notice(d) {
        try {
            if (!d || !d.error) return;
            const raw = d.error.message || d.error.type || String(d.error);
            let where = '';
            try {
                const k = (typeof window.gyInjectScene === 'function') ? window.gyInjectScene() : '';
                if (k && SCENE_NAME[k]) where = '「' + SCENE_NAME[k] + '」那边';
            } catch (e) {}
            const msg = where + '接口报错：' + String(raw).slice(0, 120);
            const now = Date.now();
            if (msg === lastMsg && now - lastAt < 30000) return;   // 同一个错 30 秒内只说一次
            lastMsg = msg; lastAt = now;
            const full = (typeof enhanceNetworkErrorMessage === 'function') ? enhanceNetworkErrorMessage(msg) : msg;
            console.warn('[接口]', full);
            if (typeof showToast === 'function') showToast('', '接口报错', full.split('\n')[0], null, null, false);
        } catch (e) {}
    }
    ['callChatCompletionAPI', 'sendChatRequest'].forEach(name => {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__gyErrNotice) return;
        const w = async function () {
            const r = await orig.apply(this, arguments);
            notice(r);
            return r;
        };
        w.__gyErrNotice = true; w.__gyOrig = orig;
        window[name] = w;
    });
})();

// 全局自定义CSS
let globalCustomCSS = "";
// 这段CSS会被注入到<head>里的<style>标签，对整个App所有界面生效（不是只对某一页）。
// 页面里大量元素直接写了内联 style="..."，内联样式的优先级天生比这里的任何选择器都高，
// 想覆盖那些效果，规则后面加 !important 就行。留空则用默认外观。

// 🖱️ 自定义点击特效：点击页面任意位置弹出一个小动画（爪印/爱心/星星/自定义图片...），纯装饰，默认关闭。
// clickEffectStyle 可选值：'paw'(爪印) / 'heart'(爱心) / 'sparkle'(星星) / 'custom'(用户自己上传的图片)
let clickEffectEnabled = false;
let clickEffectStyle = 'paw';
let clickEffectCustomImage = null; // 'custom' 模式下用的自定义图片，base64 dataURL

// 🧮 聊天变量存储（兼容SillyTavern的 {{getvar::x}}/{{setvar::x::y}} 系列宏，以及EJS模板里调用的getvar/setvar函数）：
// 按"作用域key"分桶——正常聊天传sessionId（角色id或群聊id"g_xxx"），没有sessionId的场景（比如群聊拉新人的欢迎语、
// 评论区回复这类一次性生成）就退化用char.id兜底，保证宏至少有个稳定落点，不会每次生成都读到空值。
let chatVariables = {}; // { [scopeId]: { 变量名: 值 } }
// 全局变量（跨聊天共享），对应ST里的 {{getglobalvar::x}}/{{setglobalvar::x::y}}
let globalVariables = {};

// 状态管理
let homeTab = "recommend", pendingReplyAttachment = null, pendingPostAttachment = null, pendingInlineAttachments = {};
let pendingChatQuote = null, chatContextMenuTarget = null, editingCharId = null, unreadNotifs = 0, isGenerating = false;
let contextMenuTargetId = null, currentProfileId = null, currentProfileTab = "posts", activeGroupFilter = null;
let editingPluginId = null; // 当前正在编辑的插件ID（null表示新建）
let activeWbCategoryFilter = null; // 世界书分类筛选：null表示"全部"
// 修复：移动端长按(模拟右键)后，部分浏览器会紧接着补发一次 click 事件，
// 导致刚弹出的关注/星标菜单被外层 onclick 或全局关闭逻辑瞬间吞掉。用时间戳做个短暂的抑制窗口。
let suppressCardClickUntil = 0;
let memoryViewingCharId = null, currentSummaryCharId = null, chatContextMenuMsgIdx = null;
let currentMemoryHubTargetId = null; // "记忆总览"独立页面里当前选中查看的角色/群聊id
let currentDiaryCharId = null, currentDiaryTab = 'letter', tempGeneratedDiary = null, viewingDiaryId = null;

// ⚠️ 这里是**新装时的默认资料**，不是谁的名字写死在这里。
// 以前默认名字是作者本人的名字，别人装上这个网站，一进来自己的账号就叫那个名字，
// 而且所有提示词里都会出现它（"用户XXX给你寄来一封信"…）——等于把作者的名字硬塞给了每一个用户。
// 改成中性的"我"，用户在"编辑资料"里改成自己的名字之后，全站提示词自动跟着变。
let currentUser = {
    id: 'me', name: "我", handle: "@my_account", bio: "这是我的个人签名...",persona: "", followers: 128, following: 50, location: "地球", website: "myblog.com", birthdate: "2000-01-01", verified: false, avatarImg: null, bgImg: null, avatarEmoji: "我", themeColor: "#1d9bf0", anonName: "匿名用户", anonId: Math.random().toString(36).substr(2,8).toUpperCase(), nudgeText: "的聪明脑袋", gender: "未知", customAnniversaries: []
};

// 提示词里要写"用户叫什么"的地方统一走这个函数，不要直接拼 currentUser.name。
// 两个作用：
//   1) 名字被清空/存档里没有这个字段时，不会拼出"用户 给你寄来一封信"这种断句；
//   2) 名字还是默认的"我"时，在提示词里写"我给你寄来一封信"会让模型分不清是谁——
//      这种情况下换成"用户"这个中性称呼，模型不会误解，界面上显示的仍然是用户自己设的名字。
function userDisplayName(char) {
    // 传了角色就用"在这个角色面前我是谁"，没传就是当前正在用的那份资料（老调用点行为不变）
    const u = (char && typeof resolveUserPersonaFor === 'function') ? resolveUserPersonaFor(char) : currentUser;
    const n = ((u && u.name) || '').trim();
    if (!n || n === '我') return '用户';
    return n;
}

// ===================== 👤 多人设绑定 =====================
// 你在不同角色、不同势力面前可以是不同的人：在医院同事眼里是"实习生小林"，
// 在匿名论坛马甲那边是"夜猫"，在某个势力里又是另一重身份。
//
// 实现上**只影响拼给 AI 的那段"用户是谁"**，绝不去改 currentUser 本身——
// 全项目有上百处直接读 currentUser.xxx（头像、昵称、界面显示、存档结构），
// 真去切换 currentUser 的话，界面会跟着一起变，那是"换号"不是"换人设"，
// 而且一旦哪条链路漏了还原，所有角色的"你是谁"就会全乱套。
//
// 绑定关系单独存两张表，不动 userPersonas 本身：
//   charUserPersona    = { 角色id: 人设id }
//   factionUserPersona = { 势力名: 人设id }
// 优先级：角色单独绑的 > 它所属势力绑的（按角色的势力列表顺序取第一个命中的）> 当前资料。
let globalTheaterLogs = [];   // 🎭 小剧场记录：角色私下发生的事。默认不限条数，上限在「记忆总览」里可调（见 js/14）
let theaterLogKeep = 0;       // 0 ＝ 不限；填了正数就只保留最近这么多场
let charUserPersona = {};
let factionUserPersona = {};

function getUserPersonaById(id) {
    if (!id) return null;
    const p = (typeof userPersonas !== 'undefined' && Array.isArray(userPersonas))
        ? userPersonas.find(x => x && x.id === id) : null;
    return (p && p.data) ? p.data : null;
}
// 返回一个"用户资料对象"（可能是某份保存的人设快照，也可能就是 currentUser）。
// char 可以传角色对象或角色id；传不出来就退回 currentUser。
function resolveUserPersonaFor(char) {
    try {
        let c = char;
        if (c !== null && typeof c !== 'object') c = (myCharacters || []).find(x => String(x.id) === String(char));
        if (!c) return currentUser;
        const byChar = getUserPersonaById(charUserPersona[String(c.id)]);
        if (byChar) return byChar;
        const factions = (typeof getCharFactions === 'function') ? getCharFactions(c) : (c.group ? [c.group] : []);
        for (const g of factions) {
            const byFaction = getUserPersonaById(factionUserPersona[g]);
            if (byFaction) return byFaction;
        }
        return currentUser;
    } catch (e) { return currentUser; }
}
// 这个角色/势力现在用的是哪份人设（给界面显示用），没绑定返回 null
function getBoundPersonaLabel(char) {
    try {
        let c = char;
        if (c !== null && typeof c !== 'object') c = (myCharacters || []).find(x => String(x.id) === String(char));
        if (!c) return null;
        const pid = charUserPersona[String(c.id)];
        if (pid) {
            const p = userPersonas.find(x => x && x.id === pid);
            if (p) return { label: p.label || '未命名人设', from: 'char' };
        }
        const factions = (typeof getCharFactions === 'function') ? getCharFactions(c) : [];
        for (const g of factions) {
            const fid = factionUserPersona[g];
            if (!fid) continue;
            const p = userPersonas.find(x => x && x.id === fid);
            if (p) return { label: p.label || '未命名人设', from: 'faction', faction: g };
        }
        return null;
    } catch (e) { return null; }
}
let tabloidAccount = {
    id: 'tabloid_admin', name: "X星圈内爆料", handle: "@tabloid_news", persona: "专业狗仔，娱乐圈纪委，看热闹不嫌事大", bio: "掌握全网第一手瓜。欢迎私信爆料。", followers: 99999, following: 0, location: "深渊暗网", website: "", birthdate: "2020-01-01", verified: true, avatarImg: null, bgImg: null, avatarEmoji: "📰", themeColor: "#f91880", isFollowing: false, isSpecialFollow: false
};

let globalPosts = [], globalNotifications = [], anonPosts = []; 
let trendingTags = ["#赛博朋克2026", "#科技改变生活", "#打工人的日常"];
let characterGroups = ["Vtuber", "程序员", "偶像", "校园", "都市"];
// ===================== 🏴 势力（角色分组）=====================
// 一个角色**可以同时属于多个势力**（原来只能填一个 char.group）。
//
// 存储上保留了 char.group 这个老字段当"主势力"：全项目有几十处只需要一个值的地方
// （头像旁边的色点、关注卡上的小标签、导出格式、云端同步……），继续读 char.group 就行，
// 不用一处处改成"取数组第一个"。真正的完整列表在 char.groups 里。
// 两边永远由 setCharFactions 一起写，不会出现"数组里有、主势力却是空"这种半拉状态。
//
// 老存档里只有 char.group 没有 char.groups —— getCharFactions 读的时候顺手补上，
// 不需要专门写一次全量数据迁移（也就不存在"迁移脚本跑一半失败"的风险）。
function getCharFactions(c) {
    if (!c) return [];
    if (!Array.isArray(c.groups)) {
        c.groups = (c.group && String(c.group).trim()) ? [String(c.group).trim()] : [];
    }
    return c.groups;
}
function charInFaction(c, name) {
    if (!c || !name) return false;
    return getCharFactions(c).some(g => g === name);
}
function setCharFactions(c, list) {
    if (!c) return;
    const arr = Array.from(new Set((list || []).map(x => String(x || '').trim()).filter(Boolean)));
    c.groups = arr;
    c.group = arr[0] || '';   // 主势力＝列表第一个，供只认单值的老代码使用
}
// 势力被改名/删除时，把每个角色的列表一起更新（主势力也会跟着重算）
function renameFactionEverywhere(oldName, newName) {
    (myCharacters || []).forEach(c => {
        const arr = getCharFactions(c);
        if (!arr.includes(oldName)) return;
        setCharFactions(c, arr.map(g => (g === oldName ? newName : g)));
    });
}
function removeFactionEverywhere(name) {
    (myCharacters || []).forEach(c => {
        const arr = getCharFactions(c);
        if (!arr.includes(name)) return;
        setCharFactions(c, arr.filter(g => g !== name));
    });
}

let factionColors = {}; // { 势力名: '#hex颜色' }，用户可在"势力总览"里自定义
let charRelationships = []; // [{id, fromId, toId, label, color}] 角色之间的关系连线
let relationshipTypePresets = [ { label: '友好', color: '#17bf63' }, { label: '敌对', color: '#f91880' } ]; // 用户可自定义增删的关系类型（含颜色）
let statusTypes = [
    { id: 'st_busy', label: '忙', color: '#f91880', opacity: 100 },
    { id: 'st_idle', label: '闲', color: '#17bf63', opacity: 100 },
    { id: 'st_sleep', label: '睡觉', color: '#7856ff', opacity: 100 },
    { id: 'st_social', label: '社交中', color: '#ffad1f', opacity: 100 }
]; // 角色状态气泡颜色，所有角色共用，可在用户资料编辑里增删
const FACTION_PALETTE = ['#1d9bf0','#f91880','#17bf63','#ffad1f','#7856ff','#ff7a45','#00b8d9','#eb5757'];
function getFactionColor(name) {
    if (!name) return '#8b98a5'; // 势力不明 固定灰色
    if (!factionColors[name]) factionColors[name] = FACTION_PALETTE[Object.keys(factionColors).length % FACTION_PALETTE.length];
    return factionColors[name];
}
let worldbooks = [{ id: 1, title: "赛博纪元 2026", content: "这是一个高度发达但充满阶级矛盾的赛博朋克城市...", isGlobal: true, category: "" }];
let worldbookCategories = []; // 世界书自定义分类标签，如 ["主线设定","势力","场景"]
let globalEmoticons = [], groupChats = [], globalChats = {}, currentChatSessionId = null;
let myCharacters = [];

// 故事相关数据结构
let globalNovels = [];
let novelCustomCSS = "";
let currentEditingNovelId = null;
let tempNovelChapter = null;

const defaultNovelCSS = `/* 示例代码：您可以修改故事的UI界面 */
#view-novel {
background-color: #faf8f5;
}
.diary-card.novel-card {
background: #ffffff;
border: 1px solid #e0e0e0;
box-shadow: 2px 4px 12px rgba(0,0,0,0.06);
border-radius: 8px;
}
.novel-chapter-item {
background: #ffffff;
border-left: 4px solid #1d9bf0;
padding: 15px;
margin-bottom: 10px;
box-shadow: 0 2px 8px rgba(0,0,0,0.05);
border-radius: 4px;
}
.novel-chapter-title {
font-size: 18px;
font-weight: bold;
color: #1d9bf0;
margin-bottom: 10px;
}`;


// ★ 智能分流API（保证按功能优雅降级）
function getApiConfig(isSubTask = false) {
    if (isSubTask && subApiKey && subApiUrl && subModel) return { url: subApiUrl, key: subApiKey, model: subModel, isSub: true };
    return { url: myApiUrl, key: myApiKey, model: myModel, isSub: false };
}

// 向量记忆专用API：填了就用这个（跟主API、副API完全独立，专门服务 /embeddings 请求），
// 没填就自动兜底回主API——不会自动去用副API，避免"副API"被悄悄挪作它用。
function getVectorApiConfig() {
    if (vecApiUrl && vecApiKey) return { url: vecApiUrl, key: vecApiKey, isVec: true };
    return { url: myApiUrl, key: myApiKey, isVec: false };
}

// ===== 模型不可用兜底：识别"模型不存在/服务商没开通这个模型"这类报错 =====
// 典型报错例子：{"error":{"code":"model_not_found","message":"No available channel for model xxx under group default (distributor)"}}
// 这类报错换个模型基本必现（不是网络抖动，重试原模型没用），所以要单独识别出来，跟"并发超限稍后重试"分开处理。
function isModelUnavailableError(msg) {
    if (!msg) return false;
    return /model_not_found|no available channel|model[^a-z0-9]{0,12}(not[^a-z0-9]{0,4}found|not[^a-z0-9]{0,4}available|does not exist|unavailable)|invalid model|unknown model|该模型(不存在|未开通|不可用)|模型不存在/i.test(String(msg));
}

// ★ 修复"聊天时候代码/JSON原文直接显示在对话里"的bug：
// 之前用一个很粗暴的正则 /\{[\s\S]*\}/ 去从AI原始输出里"抓第一个{到全文最后一个}"，
// 一旦AI输出里字符串内部混进了没转义的真实换行符（很常见的小毛病）、多余的结尾逗号，
// 或者JSON前后跟了别的文字，JSON.parse就会直接报错，导致整段兜底原文（看起来就是一坨JSON）
// 被当成一条聊天气泡原样发出来。这里统一换成"逐字符找到与第一个{真正匹配的}"（识别字符串边界，
// 不会被字符串里的{}干扰），解析失败时再自动修一遍"字符串内裸换行/裸制表符"和"结尾多余逗号"这两种
// AI最常犯的小毛病后重试。全文所有解析AI返回JSON的地方都统一改用这个函数，而不是各自复制一份正则。
// 🐛 修复"部分推理模型不显示HTML/思考过程混进正文"：有些模型（尤其是没有走标准reasoning_content分离、
// 靠prompt自己"想清楚再回答"的模型）会把一整段思维过程原样写在最终JSON前面，中间往往还会顺手写一两个
// 不完整的"草稿JSON"（比如举例子、打草稿），如果只找"第一个{到匹配的}"，抓到的经常是这种草稿/半成品，
// 而不是文本最后那个才是模型真正想返回的完整答案。这里改成：先找出文本里所有"顶层{...}"候选片段，
// 从最后一个往前试解析，第一个能成功解析（且修复常见小毛病后也能解析）的就用它——最后一个通常才是
// 模型思考完之后给出的正式结论，比"第一个"更可靠。
function findTopLevelJsonSpans(text) {
    let spans = [];
    let depth = 0, inStr = false, strCh = '', esc = false, start = -1;
    for (let i = 0; i < text.length; i++) {
        let ch = text[i];
        if (inStr) {
            if (esc) { esc = false; }
            else if (ch === '\\') { esc = true; }
            else if (ch === strCh) { inStr = false; }
            continue;
        }
        if (ch === '"' || ch === "'") { inStr = true; strCh = ch; continue; }
        if (ch === '{') { if (depth === 0) start = i; depth++; }
        else if (ch === '}') { depth--; if (depth === 0 && start !== -1) { spans.push([start, i]); start = -1; } else if (depth < 0) depth = 0; }
    }
    return spans;
}
function tryParseJsonCandidate(candidate) {
    try { return JSON.parse(candidate); } catch (e) {}
    let fixed = '', inStr = false, esc = false;
    for (let j = 0; j < candidate.length; j++) {
        let c = candidate[j];
        if (inStr) {
            if (esc) { fixed += c; esc = false; continue; }
            if (c === '\\') { fixed += c; esc = true; continue; }
            if (c === '"') { inStr = false; fixed += c; continue; }
            if (c === '\n') { fixed += '\\n'; continue; }
            if (c === '\r') { continue; }
            if (c === '\t') { fixed += '\\t'; continue; }
            fixed += c; continue;
        }
        if (c === '"') { inStr = true; fixed += c; continue; }
        fixed += c;
    }
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(fixed); } catch (e2) {}
    // 🆕 再兜底一层，专治"整段JSON原样显示在聊天里没被解析"这个最常见的成因：模型写对话内容时，
    // 引用/复述一句话经常会顺手在text字段值内部再打一对引号（比如 "text": "他说"接收我的指令"。"），
    // 这对人类阅读没问题，但对JSON来说，内部这对没转义的引号会被判定成字符串提前结束，后面的内容
    // 变成裸露在字符串外面的非法字符，直接解析失败。这里重新扫一遍：进入字符串后遇到"，往后跳过空白
    // 看紧跟的下一个字符——是 , : } ] 或者已经到末尾，才当作真正的结束引号；否则判定是文本里没转义的
    // 内部引号，补上转义(\")继续留在字符串里。判断依据是启发式，有极小概率误判，所以放在最后一道兜底，
    // 前面两轮常规修复都失败了才会走到这里。
    try { return JSON.parse(repairUnescapedInnerQuotes(fixed)); } catch (e3) {}
    return null;
}
function repairUnescapedInnerQuotes(candidate) {
    let fixed = '', inStr = false, esc = false;
    for (let i = 0; i < candidate.length; i++) {
        let c = candidate[i];
        if (!inStr) {
            fixed += c;
            if (c === '"') inStr = true;
            continue;
        }
        if (esc) { fixed += c; esc = false; continue; }
        if (c === '\\') { fixed += c; esc = true; continue; }
        if (c === '"') {
            let j = i + 1;
            while (j < candidate.length && /\s/.test(candidate[j])) j++;
            let nextCh = candidate[j];
            if (nextCh === undefined || ',:}]'.includes(nextCh)) { fixed += c; inStr = false; continue; } // 真正的结束引号
            fixed += '\\"'; continue; // 内部没转义的引号，补上转义继续留在字符串里
        }
        fixed += c;
    }
    return fixed;
}

// extractJsonObject 三轮修复全部失败之后的最后一道保险：不追求解析出完整合法的JSON对象了，
// 只用正则单独把某个字段（比如"text"）的字符串值抠出来——很多调用点(日记批注/聊天多段回复等)
// 在彻底解析失败时，此前的兜底做法是把没解析成功的原始JSON/【正式输出开始】标记文字整段甩给用户看，
// 体验很差；能用正则单独抠出目标字段的话，至少能让用户看到"AI本来想说的那句话"，而不是一坨代码。
// 只能处理"字段值是双引号包裹的字符串"这一种最常见情况，抠不出来就返回null，调用方自己决定兜底成什么样。
function extractStringFieldLoose(text, fieldName) {
    if (!text || typeof text !== 'string') return null;
    const re = new RegExp('"' + fieldName + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"');
    const m = text.match(re);
    if (!m) return null;
    try { return JSON.parse('"' + m[1] + '"'); } // 借用JSON.parse本身处理\n \" \\ 这些转义序列，不用自己再写一遍反转义逻辑
    catch (e) { return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\'); } // JSON.parse也失败就退化成手动简单反转义
}

// 🔖 统一的"正式输出"分界标记：部分模型（尤其没有走标准reasoning_content通道的"思考型"模型）会把
// 整段思考过程原样写在最终答案前面，不带任何<think>之类的标签，导致思维链识别/JSON提取都可能认错内容。
// 治本的办法是在prompt里明确要求模型思考完之后用这个标记单独另起一行，标记之后才是真正要用的内容——
// 有了这个标记，不用再靠"猜JSON边界""猜最后一段"这类启发式，直接精确切割。没有出现这个标记时
// （模型没遵循，或者本来就没有思考过程），下面这个函数原样返回全文，不影响任何现有行为。
const FINAL_ANSWER_MARKER = '【正式输出开始】';
function getFinalAnswerMarkerPromptNote() {
    return `如果你需要先想清楚再回答（比如组织措辞、检查设定是否符合），可以在正式内容之前自由思考，但必须在思考结束、正式内容开始之前单独另起一行，写上"${FINAL_ANSWER_MARKER}"这个标记（原样照抄，不要加引号），标记之后紧跟的才是你要真正输出的正式内容；如果你不需要思考，也请直接以这个标记开头再接正式内容。这个标记本身不算正式内容的一部分。`;
}
// 🐛 修复"点赞变成发了'点赞'两个字"：prompt 里让角色"只想点赞就输出 LIKE"，
// 但代码判断写的是 `repText.toUpperCase() === 'LIKE'` —— 严格全等。
// 模型实际会输出 "LIKE。" / "[LIKE]" / "【点赞】" / "[已赞]" / "赞" / "*点赞*" 等等一大堆变体，
// 一个都对不上，于是全都落到"当成一条评论发出去"那条分支，评论区里就出现了「[已赞]」这种东西。
// 这里统一成"宽松识别"：把标点、方括号、书名号、星号、引号都剥掉之后再比。
// 只认**整条内容就是一个点赞**的情况——正文里顺带提到"赞"字的正常评论不会被误判。
function looksLikeALikeOnly(text) {
    if (!text) return false;
    let t = String(text).trim();
    if (t.length > 12) return false;                       // 超过这个长度肯定是在说话，不是点赞
    t = t.replace(/[\s\[\]【】（）()《》"'"'`*_~。．.,，!！]/g, '');
    if (!t) return false;
    return /^(LIKE|LIKED|已赞|点赞|已点赞|赞|赞了|👍|❤️|❤)$/i.test(t);
}
function extractAfterFinalMarker(text) {
    if (!text || typeof text !== 'string') return text;
    const idx = text.lastIndexOf(FINAL_ANSWER_MARKER);
    if (idx === -1) return text;
    return text.slice(idx + FINAL_ANSWER_MARKER.length).replace(/^\s+/, '');
}

// 🧹 剥掉模型的"思考过程"：推理模型（deepseek-reasoner、QwQ、各种带 thinking 的中转）经常在正文前面
// 先吐一段 <think>...</think>。之前好几处是直接 JSON.parse(rawText)，碰上这种就炸：
//     生成日程失败：Unexpected token '<', "<think>好的，"... is not valid JSON
// 这里统一处理三种情况：
//   1) 完整成对的 <think>…</think> / <thinking> / <reasoning> / <thought>：整段删掉
//   2) 只有开标签没有闭标签（流式被截断、或者模型忘了闭）：从标签开始一直删到末尾——
//      但只有在后面还能找到 JSON 的时候才这么干，否则宁可原样返回让上层去猜
//   3) ```json 围栏
function stripReasoningBlocks(text) {
    if (!text || typeof text !== 'string') return text;
    let t = text;
    // 成对的先删（贪婪匹配到最后一个闭标签，避免思考里自己又写了个 <think> 导致只删掉一半）
    t = t.replace(/<(think|thinking|reasoning|thought|reason)\b[^>]*>[\s\S]*<\/\1>/gi, '');
    // 只有开标签的：从它开始砍到末尾，但砍之前确认剩下的还有 { 或 [，不然等于把答案也砍没了
    const openOnly = /<(think|thinking|reasoning|thought|reason)\b[^>]*>/i.exec(t);
    if (openOnly) {
        const head = t.slice(0, openOnly.index);
        if (/[\{\[]/.test(head)) t = head;                    // 答案在前面，后面是思考 → 留前面
        else {
            // 答案在后面：把开标签之后的部分留下来（模型忘了闭标签的典型情况）
            const tail = t.slice(openOnly.index + openOnly[0].length);
            if (/[\{\[]/.test(tail)) t = tail;
        }
    }
    // ⚠️ 顺序很重要：先 trim 再剥 ``` 围栏。
    // 剥完 <think>…</think> 之后开头通常剩一个换行，这时 /^```json/ 是匹配不上的，
    // 围栏留在里面就会让后面的 JSON.parse 全部失败（我第一版就踩了这个）。
    t = t.trim();
    t = t.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '');
    return t.trim();
}

// 统一的"把模型输出解析成 JSON"入口：先剥思考过程，再走 extractJsonObject 那套
// （它会优先看正式输出标记、并从最后一个 JSON 块往前试）。全都失败才返回 null。
// ⚠️ 凡是要 JSON.parse 模型输出的地方都该用这个，不要再裸调 JSON.parse——
//    模型只要多吐一个字符，裸调就是一个用户看得见的报错。
function parseModelJson(rawText) {
    if (!rawText) return null;
    const cleaned = stripReasoningBlocks(String(rawText));
    // 先按最理想的情况直接试一把，省得每次都走扫描
    try {
        const direct = JSON.parse(cleaned);
        if (direct && typeof direct === 'object') return direct;
    } catch (e) { /* 落到下面的容错路径 */ }
    // 先看这段文本整体更像数组还是对象：谁的开括号在前就先试谁。
    // 不判断的话，一个 [{"text":"a"},{"text":"b"}] 会被 extractJsonObject 拆出最后那个
    // {"text":"b"} 当成答案返回——调用方拿到的是个对象，Array.isArray 一判就挂。
    const iArr = cleaned.indexOf('[');
    const iObj = cleaned.indexOf('{');
    const arrayFirst = iArr !== -1 && (iObj === -1 || iArr < iObj);
    const tryArray = () => (typeof extractJsonArray === 'function') ? extractJsonArray(cleaned) : null;
    const tryObject = () => (typeof extractJsonObject === 'function') ? extractJsonObject(cleaned) : null;
    const first = arrayFirst ? tryArray() : tryObject();
    if (first) return first;
    const second = arrayFirst ? tryObject() : tryArray();
    if (second) return second;
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    return null;
}

function extractJsonObject(rawText) {
    if (!rawText) return null;
    // 如果模型遵循了"正式输出标记"的要求，优先只在标记之后的内容里找JSON——比"猜最后一个JSON块"更精确，
    // 彻底避免思考过程里出现的任何草稿/示例JSON片段被误当成正式答案。
    // 先剥掉 <think>…</think> 这类思考过程再找 JSON：不剥的话，思考里随手写的草稿 JSON
    // 会跟正式答案混在一起被当成候选。这样一改，所有用到这两个提取函数的老调用点
    // （日记/信件、角色资料自动填写、状态更新、开场白生成……）都一并对推理模型免疫了。
    let text = String(extractAfterFinalMarker(rawText));
    if (typeof stripReasoningBlocks === 'function') text = stripReasoningBlocks(text);
    text = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
    let spans = findTopLevelJsonSpans(text);
    if (spans.length === 0) return null;
    // 从最后一个候选片段开始试，最后一个解析成功的即为最终答案；全部解析失败时兜底退回"第一个"的老行为。
    for (let k = spans.length - 1; k >= 0; k--) {
        let [s, e] = spans[k];
        let parsed = tryParseJsonCandidate(text.slice(s, e + 1));
        if (parsed !== null) return parsed;
    }
    return null;
}
// 跟 findTopLevelJsonSpans 是同一套思路，只不过找的是顶层"[...]"（JSON数组）而不是"{...}"（JSON对象）——
// 供"AI应该返回一个JSON数组"这类场景使用（比如NPC批量评论）。之前这类地方各自用一个简单粗暴的
// /\[[\s\S]*\]/ 正则（从第一个[贪婪匹配到最后一个]），一旦AI在数组前后多写了任何带方括号的说明文字
// （哪怕只是"参考格式：[...]"这种），就会把不相关的内容也吞进来，拼出语法错误的"JSON"，
// 报错"Unexpected non-whitespace character after JSON"。改成跟对象一样"找出所有顶层候选片段，
// 从最后一个开始试解析"，从根源上避免这个问题，且不需要每个调用点各自维护一份提取逻辑。
function findTopLevelJsonArraySpans(text) {
    let spans = [];
    let depth = 0, inStr = false, strCh = '', esc = false, start = -1;
    for (let i = 0; i < text.length; i++) {
        let ch = text[i];
        if (inStr) {
            if (esc) { esc = false; }
            else if (ch === '\\') { esc = true; }
            else if (ch === strCh) { inStr = false; }
            continue;
        }
        if (ch === '"' || ch === "'") { inStr = true; strCh = ch; continue; }
        if (ch === '[') { if (depth === 0) start = i; depth++; }
        else if (ch === ']') { depth--; if (depth === 0 && start !== -1) { spans.push([start, i]); start = -1; } else if (depth < 0) depth = 0; }
    }
    return spans;
}
function extractJsonArray(rawText) {
    if (!rawText) return null;
    // 先剥掉 <think>…</think> 这类思考过程再找 JSON：不剥的话，思考里随手写的草稿 JSON
    // 会跟正式答案混在一起被当成候选。这样一改，所有用到这两个提取函数的老调用点
    // （日记/信件、角色资料自动填写、状态更新、开场白生成……）都一并对推理模型免疫了。
    let text = String(extractAfterFinalMarker(rawText));
    if (typeof stripReasoningBlocks === 'function') text = stripReasoningBlocks(text);
    text = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
    let spans = findTopLevelJsonArraySpans(text);
    if (spans.length === 0) return null;
    // 跟 extractJsonObject 反过来，这里从第一个候选片段开始试：这类调用点的prompt通常明确要求
    // "只返回一个JSON数组，不要有其它说明文字"，所以真正的答案几乎总是文本里第一个完整的顶层数组，
    // 后面如果还跟着别的方括号内容，大概率是模型自己画蛇添足的举例/备注，不是要用的那份数据。
    for (let k = 0; k < spans.length; k++) {
        let [s, e] = spans[k];
        let parsed = tryParseJsonArrayLoose(text.slice(s, e + 1));
        if (parsed !== null && Array.isArray(parsed)) return parsed;
    }
    return null;
}

// ===================== 统一的底层API发送（同时支持 OpenAI 兼容接口 和 Anthropic 原生接口）=====================
// 全文件所有请求AI的地方，最终都会走到这一个函数——不管你在设置里填的是 DeepSeek/OpenAI/中转 这类
// OpenAI 兼容接口，还是 Anthropic 官方接口（api.anthropic.com），这里会自动识别并使用对应的
// 端点/请求头/请求体格式。不管走哪条路，返回值都统一包装成 OpenAI 那种
// { choices: [{ message: { content: "..." } }] } 或 { error: { message: "..." } } 形状，
// 所以文件里其它所有读 data.choices?.[0]?.message?.content 的代码完全不用改一行。
function isAnthropicApiUrl(url) {
    return /anthropic\.com/i.test(url || '');
}
// 把 OpenAI 格式的多模态 content（[{type:'text',...},{type:'image_url',image_url:{url:'data:...'}}])
// 转成 Anthropic 要求的格式（image 用 source:{type:'base64', media_type, data}，且 data 不能带 data: 前缀）
function convertContentForAnthropic(content) {
    if (!Array.isArray(content)) return content;
    return content.map(part => {
        if (part && part.type === 'image_url') {
            const dataUrl = (part.image_url && part.image_url.url) || '';
            const m = dataUrl.match(/^data:(.+?);base64,(.*)$/);
            if (!m) return null; // 非 base64 dataURL（比如普通图片链接）Anthropic 原生接口不支持，直接丢弃这一张
            return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
        }
        return part;
    }).filter(Boolean);
}
// ★ 打包成App后角色互动/发推全部失效的修复：
// 网页版里 fetch() 请求第三方API是正常的浏览器同源页面发起的，很多API/中转服务器不会拦；
// 但打包成Android App后（HBuilderX / 5+ Runtime），页面通常是以 file:// 方式加载的本地文件，
// 此时 fetch() 发出的请求 Origin 是 "null"，不少API服务商/自建中转会因为校验不到合法来源
// 直接拒绝这个请求（或者干脆连不上），JS这边看到的就是一个笼统的网络错误，界面上表现为
// "转了一下圈就没了、什么都不发生"。5+ Runtime 官方提供了 plus.net.XMLHttpRequest，
// 这是走原生网络层发起的请求，不经过WebView的跨域限制，是这类问题的标准解法。
// 这里做特性检测：只有真的跑在打包后的App环境里（window.plus 存在）才会走这条路，
// 网页版完全不受影响、行为和以前一模一样。
function plusNetRequest(url, options) {
    return new Promise((resolve, reject) => {
        try {
            const xhr = new plus.net.XMLHttpRequest();
            xhr.open(options.method || 'GET', url);
            if (options.headers) {
                Object.keys(options.headers).forEach(k => xhr.setRequestHeader(k, options.headers[k]));
            }
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve({ ok: true, status: xhr.status, json: async () => JSON.parse(xhr.responseText), text: async () => xhr.responseText });
                    } else {
                        reject(new Error(`HTTP ${xhr.status}: ${(xhr.responseText || '').slice(0, 200)}`));
                    }
                }
            };
            xhr.onerror = function () { reject(new Error('plus.net.XMLHttpRequest 网络请求失败（可能是域名不可达、证书问题或网络未连接）')); };
            xhr.ontimeout = function () { reject(new Error('plus.net.XMLHttpRequest 请求超时')); };
            xhr.send(options.body);
        } catch (e) { reject(e); }
    });
}
// ⚠️ 修复"调用某些API/中转站报HTTP 0"：HTTP状态码0一般表示请求在拿到任何服务器响应之前就
// 失败了（DNS解析不到、SSL证书问题、连接被拒绝/超时等），这种情况不一定是plus.net.XMLHttpRequest
// 这条原生网络通道本身有问题——它和WebView自带的fetch()走的是两套完全不同的底层网络实现，
// 对DNS/证书/代理的处理方式可能不一样，很可能出现"这条路走不通、换一条路就通了"的情况。
// 这里改成两条路都试一遍：优先走原生plus.net.XMLHttpRequest（避免file://页面的跨域限制），
// 失败了（不管什么原因，包括HTTP 0）就自动退一步试原生WebView的fetch()兜底；
// 两条路都失败，才把两边真实的错误信息都亮出来，方便判断到底是哪一层的问题。
function smartFetch(url, options) {
    if (typeof window !== 'undefined' && window.plus && plus.net && plus.net.XMLHttpRequest) {
        return plusNetRequest(url, options).catch((err1) => {
            console.error('[smartFetch] plus.net.XMLHttpRequest 失败，尝试改用WebView自带fetch()兜底：', err1);
            return fetch(url, options).catch((err2) => {
                throw new Error(`两种网络请求方式都失败了。\n方式一(原生plus.net)：${err1 && err1.message ? err1.message : err1}\n方式二(WebView fetch)：${err2 && err2.message ? err2.message : err2}`);
            });
        });
    }
    return fetch(url, options);
}
// 浏览器出于安全考虑，遇到跨域(CORS)请求被拦截时，JS这边看到的永远是一个语焉不详的通用报错
// （Chrome是"Failed to fetch"，Safari是"Load failed"，Firefox是"NetworkError when attempting to fetch resource"），
// 规范上就是不允许网页脚本知道"具体是不是CORS、卡在哪一步"，所以这里只能是"像不像"的模糊匹配——
// 命中了就顺手在报错后面加一句人话提示，没命中就原样返回，不影响其它报错信息本身。
// 打包成APK后走的是原生网络通道，不受CORS限制，这种情况不加这段提示，避免误导。
function enhanceNetworkErrorMessage(rawMessage) {
    const msg = String(rawMessage || '');
    const isNativeApp = typeof window !== 'undefined' && window.plus && window.plus.net && window.plus.net.XMLHttpRequest;
    if (!isNativeApp && /Failed to fetch|NetworkError when attempting to fetch|Load failed|network request failed/i.test(msg)) {
        return msg + '\n\n💡这种笼统的网络错误，网页版最常见的原因是CORS跨域被浏览器拦截了（出于安全规范，浏览器不会告诉网页"具体是不是CORS"，看着都一样）。可以打开浏览器控制台（F12→Console）确认报错里是否有"CORS"字样；如果是，换一家支持CORS的API/中转服务商，或者用打包好的APK版本（走手机原生网络通道，不受此限制）。';
    }
    // HTTP 状态码翻译成人话。以前只会甩一句「HTTP 错误代码: 502」，
    // 用户没法判断是自己填错了、还是对面挂了、还是该等一会儿再试。
    const code = (msg.match(/(?:错误代码|status|HTTP)\D{0,3}(\d{3})/i) || [])[1];
    if (code) {
        const tip = {
            '400': '请求本身不合法。多半是模型名填错了，或者这家中转不认这个参数。',
            '401': '密钥不对或者已经失效。重新复制一遍 key，注意别带空格。',
            '402': '余额不够了（或者这个 key 的额度用完了）。',
            '403': '这个 key 没有访问这个模型/接口的权限。',
            '404': '地址不对。多数中转要填到 /v1 为止，检查一下结尾。',
            '408': '对面处理超时了，等一下再试。',
            '413': '发过去的内容太长了。可以在「注入内容管理」里砍掉几段，或者把聊天总结条数调小。',
            '429': '被限流了——请求太密，或者这个 key 的额度用到上限了。等几分钟再试。',
            '500': '对面服务器自己出错了，不是你这边的问题。',
            '502': '中转站到上游那一段断了（网关错误）。**不是你配置的问题**，通常等几分钟就好；一直这样就是这家中转不稳，换一家或换个模型试试。',
            '503': '对面暂时不可用（过载或在维护），等一会儿再试。',
            '504': '中转站等上游超时了。换个响应快的模型，或者过一会儿再试。'
        }[code];
        if (tip) return msg + '\n\n💡 ' + tip;
        if (/^5/.test(code)) return msg + '\n\n💡 5 开头的都是**对面服务器**的问题，不是你配置错了。等一会儿再试，或者换一家中转。';
    }
    return msg;
}
function isStructuredMessages(content) {
    return Array.isArray(content) && content.length > 0 && content.every(m => m && typeof m === 'object' && typeof m.role === 'string');
}

// ===================== 📊 Token 用量统计 =====================
// 记的是**服务商实际返回的 usage**（不是估算），所以跟账单能对得上。
// 没返回 usage 的服务商（少数中转会吞掉这个字段）才退回按字数估算，并在界面上标出来。
//
// 归类靠调用栈：每个功能最终都汇聚到 sendChatRequestRaw / streamCompletionText 这两个出口，
// 在出口处抓一次调用栈、从里面找出是哪个功能函数发起的。好处是不用去改那 50 多个调用点
// （改漏一个就统计不到，而且以后新增功能还得记得加），坏处是压缩/内联可能让函数名对不上——
// 对不上就归到「其它」，不会丢数据、也不会算错总量。
// 📌 当前版本号。跟 index.html 里 <script src="...?v=86"> 和 service-worker.js 的 CACHE_VERSION 是同一个数字。
// 它显示在「设置」目录页最下面——改完代码看不到效果时，先看这里是不是新版本：
// 如果还是旧数字，说明浏览器读的是缓存里的旧 js（file:// 打开时 Service Worker 根本不会注册，
// 只能靠 ?v= 和强制刷新），Ctrl+F5 一下就好。
// 故事点评最多让几个角色说（js/08 的 runNovelReviews 读它）
let novelReviewMax = 3;
// 🔕 同时最多弹几条通知气泡：0=全部弹（老行为），>0=最多这么多条，其余合并成"还有 N 条"，
// -1=一条都不弹，只进通知页。设置 → 🎨 外观里可改。
let toastMaxVisible = 2;
// 🎨 配色主题：'blue' = 原来的蓝白，'mono' = 黑白。深色模式是另一个开关，两者可以叠加。
let uiTheme = 'blue';
// v107 版式：
//   tweetTimeAbs  推文时间显示成绝对时间（上午9:13 · 2018年3月19日）还是相对时间（3小时前）。
//                 点一下时间就来回切，不用进设置。
//   gyMainWidth   中间那一栏的宽度（px）。默认 600 = X 自己的宽度；
//                 拖右边那条缝可以自己调，双击那条缝恢复默认。
//   gyLeftWidth   左边导航栏的宽度（px），默认 275，同样可以拖。
//   gyFontSize    全站正文字号的基准值（px），默认 15。css 里所有正文类字号都写成
//                 calc(var(--gy-fs) * n)，所以改这一个数字整站的字一起变，不是只改推文。
let tweetTimeAbs = false;
let gyMainWidth = 600;
let gyLeftWidth = 275;
let gyFontSize = 15;
// ============================================================================
// 🔄 数据变了 → 通知正开着的面板重画
// ----------------------------------------------------------------------------
// 很多面板（右边「今天」、时间管理大师、日记页、角色主页…）只在切页时才画一次，
// 后台定时器 / 聊天里说到做到 / 自主模式改了数据之后，开着的那一页就一直是旧的。
// 改数据的地方调一下 gyDataChanged('today' / 'letter' / 'diary' …)，
// 80ms 内合并成一次，发一个 window 事件 'gy:data'（detail 是这段时间里变过的东西），
// 各面板自己监听、自己判断"我现在开着没有"再重画。
// ============================================================================
(function () {
    if (typeof window === 'undefined' || window.gyDataChanged) return;
    let timer = null, pending = new Set();
    window.gyDataChanged = function (what) {
        try {
            pending.add(String(what || 'any'));
            if (timer) return;
            timer = setTimeout(function () {
                const list = Array.from(pending); pending = new Set(); timer = null;
                try { window.dispatchEvent(new CustomEvent('gy:data', { detail: list.length === 1 ? list[0] : list })); } catch (e) {}
            }, 80);
        } catch (e) {}
    };
})();
