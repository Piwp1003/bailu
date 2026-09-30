// ======== 移动端 / 安卓网页端 交互逻辑 (界面适配，功能与桌面端一致) ========
function initMobileUI() {
    // 抽屉菜单项点击后自动收起抽屉
    document.querySelectorAll('.mdrawer-item, .mdrawer-profile').forEach(el => {
        el.addEventListener('click', closeDrawer);
    });
}

function toggleDrawer() {
    const isOpen = document.getElementById('mobileDrawer').classList.contains('open');
    if (isOpen) closeDrawer(); else openDrawer();
}
function openDrawer() {
    document.getElementById('mobileDrawer').classList.add('open');
    document.getElementById('mobileDrawerOverlay').classList.add('open');
}
function closeDrawer() {
    document.getElementById('mobileDrawer').classList.remove('open');
    document.getElementById('mobileDrawerOverlay').classList.remove('open');
}

function openMobileTrendsView() {
    hideAllViews();
    closeDrawer();
    // 同 switchMainView：id 是 mtbCenterTitle，不是 mobileTopTitle（写错的那个恒为 null）
    const mtEl = document.getElementById('mtbCenterTitle');
    if (mtEl) { mtEl.innerText = '话题'; mtEl.style.display = 'flex'; }
    document.getElementById('view-mobile-trends').style.display = 'block';
    const m = document.getElementById('mnav-search'); if (m) m.className = 'mnav-item active';
    renderMobileTrends();
}
let mobileTrendManageMode = false;
function toggleMobileTrendManage() {
    mobileTrendManageMode = !mobileTrendManageMode;
    const bar = document.getElementById('mobileTrendManageBar');
    if (bar) bar.style.display = mobileTrendManageMode ? 'flex' : 'none';
    renderMobileTrends();
}
function addMobileCustomTrend() {
    const input = document.getElementById('mobileCustomTrendInput');
    let val = input.value.trim();
    if (val) {
        if (!val.startsWith('#')) val = '#' + val;
        trendingTags.unshift(val);
        renderMobileTrends();
        saveAllData();
        input.value = '';
    }
}
async function deleteMobileTrend(idx, event) {
    if (event) event.stopPropagation();
    if (!(await appConfirm('删除该话题标签？'))) return;
    trendingTags.splice(idx, 1);
    renderMobileTrends();
    saveAllData();
}
let mobileTrendPressTimer = null;
let mobileTrendLongPressed = false;
function mobileTrendPressStart(idx) {
    mobileTrendLongPressed = false;
    mobileTrendPressTimer = setTimeout(() => { mobileTrendLongPressed = true; editMobileTrend(idx); }, 550);
}
function mobileTrendPressEnd() {
    if (mobileTrendPressTimer) { clearTimeout(mobileTrendPressTimer); mobileTrendPressTimer = null; }
}
function mobileTrendClick(idx, tag) {
    if (mobileTrendLongPressed) { mobileTrendLongPressed = false; return; }
    switchMainView('tag', tag);
}
async function editMobileTrend(idx) {
    const oldVal = trendingTags[idx];
    const newVal = await appPrompt('编辑话题标签（清空并确定则删除该标签）：', oldVal);
    if (newVal === null) return;
    let val = newVal.trim();
    if (val) {
        if (!val.startsWith('#')) val = '#' + val;
        trendingTags[idx] = val;
    } else {
        trendingTags.splice(idx, 1);
    }
    renderMobileTrends();
    saveAllData();
}
function renderMobileTrends() {
    const c = document.getElementById('mobileTrendsListContainer');
    if (!c) return;
    if (!trendingTags || trendingTags.length === 0) { c.innerHTML = '<div class="empty-state">暂无话题标签</div>'; return; }
    c.innerHTML = trendingTags.map((t, i) => `
        <div class="mobile-trend-item" onclick="mobileTrendClick(${i}, '${String(t).replace(/'/g, "\\'")}')" ontouchstart="mobileTrendPressStart(${i})" ontouchend="mobileTrendPressEnd()" ontouchmove="mobileTrendPressEnd()" onmousedown="mobileTrendPressStart(${i})" onmouseup="mobileTrendPressEnd()" onmouseleave="mobileTrendPressEnd()">
            <div style="flex:1; min-width:0;">
                <div class="mobile-trend-tag">${t}</div>
                <div class="mobile-trend-hint">查看相关推文${mobileTrendManageMode ? ' · 长按可编辑' : ''}</div>
            </div>
            ${mobileTrendManageMode ? `<div class="mtb-icon-btn" style="color:#f91880; flex-shrink:0;" onclick="deleteMobileTrend(${i}, event)">✕</div>` : ''}
        </div>
    `).join('');
}

function toggleMobileSearch() {
    const titleEl = document.getElementById('mtbCenterTitle');
    const searchEl = document.getElementById('mtbCenterSearch');
    const showingSearch = searchEl.style.display !== 'none';
    if (showingSearch) {
        searchEl.style.display = 'none'; titleEl.style.display = 'flex';
    } else {
        titleEl.style.display = 'none'; searchEl.style.display = 'flex';
        const input = document.getElementById('mobileSearchInput'); input.value = ''; setTimeout(() => input.focus(), 50);
    }
}


function formatStat(num) { if(typeof num === 'string') return num; if(num>=10000) return(num/10000).toFixed(1)+'万'; if(num>=1000) return(num/1000).toFixed(1)+'k'; return num; }
function parseStat(val) { if(typeof val === 'number') return val; let str=String(val).toLowerCase(); if(str.includes('k')) return parseFloat(str)*1000; if(str.includes('万')) return parseFloat(str)*10000; return parseInt(str)||0; }
function getRandomStat(max) { return Math.floor(Math.random() * max); }
// 🎨 套用配色主题。黑白那一套整个是 CSS 里的 body.theme-mono，
// 所以这里只负责挂/摘那个 class——不遍历 DOM、不改任何行内样式（行内那批由属性选择器接管）。
function applyUiTheme() {
    try {
        const mono = (typeof uiTheme !== 'undefined') && uiTheme === 'mono';
        document.body.classList.toggle('theme-mono', mono);
        const sel = document.getElementById('uiThemeSelect');
        if (sel && typeof uiTheme !== 'undefined') sel.value = uiTheme;
    } catch (e) {}
}
function setUiTheme(v) {
    uiTheme = (v === 'mono') ? 'mono' : 'blue';
    applyUiTheme();
    if (typeof saveAllData === 'function') saveAllData();
}

function timeAgo(timestamp) { const s = Math.floor((Date.now()-timestamp)/1000); if(s<60) return"刚刚"; const m=Math.floor(s/60); if(m<60) return m+"分钟前"; const h=Math.floor(m/60); if(h<24) return h+"小时前"; const d=Math.floor(h/24); return d+"天前"; }
// 推文头上那一行的时间：跟 X 一样——一天以内给相对时间（3小时前），
// 超过一天就是 05/11，超过一年补上年份。列表里几十条"37天前"根本换算不出是哪天。
function tweetTime(timestamp) {
    const t = Number(timestamp) || 0;
    const diff = Date.now() - t;
    if (diff < 86400000) return timeAgo(t);
    const d = new Date(t), now = new Date();
    const md = String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
    return d.getFullYear() === now.getFullYear() ? md : (d.getFullYear() + '/' + md);
}
// 绝对时间：跟 X 一样写成「上午9:13 · 2018年3月19日」。
// 同一年也照样带年份——推文动辄隔好几年，省掉年份反而要猜。
function absTime(timestamp) {
    const d = new Date(Number(timestamp) || 0);
    let h = d.getHours();
    const ap = h < 12 ? '上午' : '下午';
    let h12 = h % 12; if (h12 === 0) h12 = 12;
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${ap}${h12}:${mm} · ${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
// 一个时间戳该显示成什么，只由 tweetTimeAbs 这一个开关决定，
// 这样点一下任意一处时间，全站所有时间一起翻面，不会一半新一半旧。
function fmtPostTime(ts) { return tweetTimeAbs ? absTime(ts) : timeAgo(ts); }

function updateAllRelativeTimes() {
    document.querySelectorAll('.time-updater').forEach(el => {
        const ts = parseInt(el.getAttribute('data-timestamp'));
        if (!ts) return;
        // data-fmt="tweet" 的那些用 X 的写法（超过一天变 05/11）；
        // data-fmt="post" 的（推文/详情页）跟着 tweetTimeAbs 翻面；其余还是"x分钟前"
        const f = el.getAttribute('data-fmt');
        el.innerText = f === 'tweet' ? tweetTime(ts) : (f === 'post' ? fmtPostTime(ts) : timeAgo(ts));
    });
}
// 点一下推文上的时间 → 相对 / 绝对来回切。存进存档，下次进来还是这个样子。
window.gyToggleTimeFmt = function (e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    tweetTimeAbs = !tweetTimeAbs;
    updateAllRelativeTimes();
    if (typeof showToast === 'function') {
        try { showToast('', tweetTimeAbs ? '时间：显示具体日期' : '时间：显示多久以前', '再点一下时间可以切回来'); } catch (_) {}
    }
    if (typeof saveAllData === 'function') saveAllData();
};

/* ---------------------------------------------------------------------------
   中栏宽度：默认 600px（X 自己就是这个宽度），拖右边那条缝可以自己调。
   宽度写在 <html> 的 --gy-main-w 上，css 里 .main-content 读它。
   --------------------------------------------------------------------------- */
const GY_MAIN_W_MIN = 480, GY_MAIN_W_MAX = 1000, GY_MAIN_W_DEF = 600;
const GY_LEFT_W_MIN = 190, GY_LEFT_W_MAX = 420, GY_LEFT_W_DEF = 275;
const GY_FS_MIN = 12, GY_FS_MAX = 20, GY_FS_DEF = 15;
function applyMainWidth() {
    const w = Math.min(GY_MAIN_W_MAX, Math.max(GY_MAIN_W_MIN, Number(gyMainWidth) || GY_MAIN_W_DEF));
    gyMainWidth = w;
    const lw = Math.min(GY_LEFT_W_MAX, Math.max(GY_LEFT_W_MIN, Number(gyLeftWidth) || GY_LEFT_W_DEF));
    gyLeftWidth = lw;
    // 字号是一个"基准值"，css 里所有正文类字号都写成 calc(var(--gy-fs) * n)，
    // 所以改这一个数字，全站的字一起变——不是只改推文。
    const fs = Math.min(GY_FS_MAX, Math.max(GY_FS_MIN, Number(gyFontSize) || GY_FS_DEF));
    gyFontSize = fs;
    try {
        const r = document.documentElement.style;
        r.setProperty('--gy-main-w', w + 'px');
        r.setProperty('--gy-left-w', lw + 'px');
        r.setProperty('--gy-fs', fs + 'px');
    } catch (e) {}
    const set = (id, v) => { const el = document.getElementById(id); if (el) { if (el.tagName === 'INPUT') el.value = v; else el.innerText = v; } };
    set('gyMainWLabel', w + 'px'); set('gyMainWRange', w);
    set('gyLeftWLabel', lw + 'px'); set('gyLeftWRange', lw);
    set('gyFsLabel', fs + 'px');    set('gyFsRange', fs);
}
window.setMainWidth = function (v) {
    gyMainWidth = Number(v) || GY_MAIN_W_DEF;
    applyMainWidth();
    if (typeof saveAllData === 'function') saveAllData();
};
window.setLeftWidth = function (v) {
    gyLeftWidth = Number(v) || GY_LEFT_W_DEF;
    applyMainWidth();
    if (typeof saveAllData === 'function') saveAllData();
};
window.setFontSize = function (v) {
    gyFontSize = Number(v) || GY_FS_DEF;
    applyMainWidth();
    if (typeof saveAllData === 'function') saveAllData();
};
// 拖宽手柄：中栏右边缘和左栏右边缘各一条 7px 的透明竖条（css 里的 .gy-w-grip）。
// 按住横向拖 = 改宽度，双击 = 恢复默认。触摸走同一套。
function gyMakeGrip(host, id, opt) {
    if (!host || document.getElementById(id)) return;
    const grip = document.createElement('div');
    grip.id = id; grip.className = 'gy-w-grip'; grip.title = '按住左右拖＝调整宽度，双击＝恢复默认';
    host.appendChild(grip);
    let startX = 0, startW = 0, dragging = false;
    const px = ev => (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : ev.clientX;
    const down = ev => {
        dragging = true; startX = px(ev); startW = host.getBoundingClientRect().width;
        document.body.classList.add('gy-w-dragging'); ev.preventDefault();
    };
    const move = ev => {
        if (!dragging) return;
        opt.set(startW + (px(ev) - startX)); applyMainWidth(); ev.preventDefault();
    };
    const up = () => {
        if (!dragging) return;
        dragging = false; document.body.classList.remove('gy-w-dragging');
        if (typeof saveAllData === 'function') saveAllData();
    };
    grip.addEventListener('mousedown', down);
    grip.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    grip.addEventListener('dblclick', () => {
        opt.reset(); applyMainWidth();
        if (typeof saveAllData === 'function') saveAllData();
    });
}
function initMainWidthGrip() {
    gyMakeGrip(document.querySelector('.main-content'), 'gyWGrip',
        { set: v => { gyMainWidth = v; }, reset: () => { gyMainWidth = GY_MAIN_W_DEF; } });
    gyMakeGrip(document.querySelector('.sidebar-left'), 'gyLGrip',
        { set: v => { gyLeftWidth = v; }, reset: () => { gyLeftWidth = GY_LEFT_W_DEF; } });
}

// 角色状态自动流动的后台守护代码
async function checkAndFlowSchedules() {
    // 日程续期跟"状态流动"是两件事、两个开关，所以先无条件走一遍续期（它自己内部判断开关）
    if (typeof checkAndRenewStaleSchedules === 'function') { try { await checkAndRenewStaleSchedules(); } catch (e) { /* 不影响下面的状态流动 */ } }
    if (typeof isAutoOn === 'function' && !isAutoOn('scheduleFlow')) return;   // 🔌 设置里关掉了「角色状态跟日程流动」
    const api = getApiConfig(true); 
    if (!api.key) return;
    const now = Date.now();
    for (let char of myCharacters) {
        if (char.schedule && char.schedule.text) {
            if (!char.lifeState || (now - char.lifeState.updatedAt > 2 * 3600000)) { 
                const prompt = `现在的真实时间是 ${new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long' })}。这是"${char.name}"的今日日程：\n${char.schedule.text}\n请根据现在的真实时间，对照ta的日程表，直接输出ta此刻正在做什么（20字以内，不要加引号）。`;
                try {
                    let text = (await sendChatRequest(api, prompt)).choices?.[0]?.message?.content?.trim();
                    if (text) saveCharLifeState(char, text, char.lifeState?.statusTypeLabel);
                } catch(e) {}
            }
        }
    }
    saveAllData();
}
setInterval(checkAndFlowSchedules, 15 * 60000);
// 🫀 活人感：每分钟看一眼有没有该"忙完补回"的消息。纯本地判断，开关关着的时候直接返回，一分钱不花。
setInterval(function () { try { if (typeof aliveTick === 'function') aliveTick(); } catch (e) {} }, 60000);

function updateCharSelects() {
    const sel = document.getElementById('aiPostCharSelect');
    if(sel) {
        let oldVal = sel.value;
        sel.innerHTML = '<option value="random">随机角色</option>' + myCharacters.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        if (oldVal && sel.querySelector(`option[value="${oldVal}"]`)) sel.value = oldVal;
    }
    const selRole = document.getElementById('userPostRoleSelect');
    if(selRole) {
        let oldVal = selRole.value;
        selRole.innerHTML = '<option value="me">我</option>' + myCharacters.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        if (oldVal && selRole.querySelector(`option[value="${oldVal}"]`)) selRole.value = oldVal;
        updateUserPostAvatar();
    }
    if (typeof populateAnonPostRoleSelect === 'function') populateAnonPostRoleSelect(); // 论坛发帖身份下拉框
    const anonSel = document.getElementById('anonCharSelect');
    if(anonSel) {
        let oldVal = anonSel.value;
        anonSel.innerHTML = '<option value="random">随机角色</option>' + myCharacters.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        if (oldVal && anonSel.querySelector(`option[value="${oldVal}"]`)) anonSel.value = oldVal;
    }
}
function updateUserPostAvatar() {
    let roleId = document.getElementById('userPostRoleSelect')?.value || 'me';
    let char = roleId === 'me' ? currentUser : myCharacters.find(c => c.id == roleId);
    if(char) {
        const div = document.getElementById('homeUserAvatar');
        if (char.avatarImg) { div.style.backgroundImage = `url('${char.avatarImg}')`; div.style.backgroundSize = 'cover'; div.style.backgroundPosition = 'center'; div.innerHTML = ""; }
        else { div.style.backgroundImage = 'none'; div.style.backgroundColor = 'white'; div.innerHTML = char.avatarEmoji || char.name?.[0] || '我'; }
    }
}

// ======== 召唤 AI 在主页随机或指定发帖 ========
function triggerManualAIPost() {
    if(!myApiKey) return alert("请先在左侧【设置】中配置主API Key！");
    if(isGenerating) return alert("已有生成任务正在进行，请稍候...");
    if(myCharacters.length === 0) return alert("请先在【角色中心】创建至少一个角色！");
    
    const selVal = document.getElementById('aiPostCharSelect').value;
    let charsToGen = [];
    if(selVal === 'random') {
        charsToGen = [myCharacters[Math.floor(Math.random() * myCharacters.length)]];
    } else {
        const c = myCharacters.find(x => x.id == selVal);
        if(c) charsToGen = [c];
    }
    
    if(charsToGen.length > 0 && typeof executeGeneration === 'function') {
        let customLimit = document.getElementById('aiPostCustomWordCount').value;
        executeGeneration(charsToGen, null, customLimit);
        closeModal('postCreateModal'); // 提交后自动关闭弹窗
    }
}

// ======== 全局 CSS 应用 ========
// 用户没保存过自定义CSS时就是空字符串，不套用任何默认示例样式，保持最朴素的默认外观。
function applyGlobalCSS() {
    let el = document.getElementById('custom-global-style');
    if(!el) { el = document.createElement('style'); el.id = 'custom-global-style'; document.head.appendChild(el); }
    el.innerHTML = (globalCustomCSS !== undefined && globalCustomCSS !== null) ? globalCustomCSS : '';
}

// ======== 🖱️ 点击特效 ========
// 每次点击页面就在鼠标/手指点到的位置冒出一个小图标，原地停留、慢慢缩小消失（不飞、不飘），纯装饰。
// 用一个"全局只挂一次"的click监听器 + 每次点击时才检查开关状态的写法，而不是"开启时才挂监听器/
// 关闭时再摘掉"，这样切换开关本身不用操心监听器有没有重复挂载/漏摘的问题，逻辑更不容易出错。
const CLICK_EFFECT_EMOJI = { paw: '🐾', heart: '💗', sparkle: '✨' };
function spawnClickEffect(x, y) {
    const el = document.createElement('span');
    el.className = 'click-effect-particle';
    if (clickEffectStyle === 'custom' && clickEffectCustomImage) {
        const img = document.createElement('img');
        img.src = clickEffectCustomImage;
        img.style.cssText = 'width:28px; height:28px; object-fit:cover; border-radius:6px; display:block;';
        el.appendChild(img);
    } else {
        el.textContent = CLICK_EFFECT_EMOJI[clickEffectStyle] || CLICK_EFFECT_EMOJI.paw;
    }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    // 动画放在CSS里跑（见 style.css 的 .click-effect-particle / @keyframes clickEffectPop），
    // 这里只负责动画结束后把这个临时元素清理掉，避免点得越多、DOM里堆的垃圾节点越多
    el.addEventListener('animationend', () => el.remove());
    setTimeout(() => { if (el.parentNode) el.remove(); }, 1200); // 兜底：万一某些环境不触发animationend事件，1.2秒后强制清理
}
document.addEventListener('click', function (e) {
    if (!clickEffectEnabled) return;
    // 点在输入框/文本域/下拉框/按钮上时不弹，减少对正常操作的视觉干扰（尤其是打字时不会一直闪东西）
    const tag = (e.target && e.target.tagName) || '';
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return;
    spawnClickEffect(e.clientX, e.clientY);
});

function saveClickEffectSettings() {
    clickEffectEnabled = document.getElementById('clickEffectEnabledInput').checked;
    clickEffectStyle = document.getElementById('clickEffectStyleSelect').value;
    saveAllData();
}
// 切到"自定义图片"这个选项时把上传框露出来，切到别的预设样式就收起去，不用同时占地方
function onClickEffectStyleChange() {
    updateClickEffectCustomPreview();
    saveClickEffectSettings();
}
function updateClickEffectCustomPreview() {
    const sel = document.getElementById('clickEffectStyleSelect');
    const box = document.getElementById('clickEffectCustomImageBox');
    const preview = document.getElementById('clickEffectCustomPreview');
    if (!sel || !box) return;
    box.style.display = sel.value === 'custom' ? 'flex' : 'none';
    if (preview) preview.style.backgroundImage = clickEffectCustomImage ? `url('${clickEffectCustomImage}')` : 'none';
}

function toggleSettingsCollapse(id) {
    const el = document.getElementById(id);
    const arrow = document.getElementById(id + '-arrow');
    if (!el) return;
    const isOpen = el.style.display === 'block';
    el.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.innerText = isOpen ? '▶' : '▼';
    // 自动功能开关那一块是 JS 动态生成的，展开的时候才画（也保证每次展开看到的都是最新状态）
    if (!isOpen && id === 'collapse-auto-features' && typeof renderAutoFeatureList === 'function') renderAutoFeatureList();
}

// 打包成APK后"只能拍照、选不了相册/文件"的根本原因：Android 6.0+ 光在 manifest 里声明权限是不够的，
// 还需要运行时弹窗让用户授权存储/媒体权限；没有这个授权时，系统的文件选择器弹出的可用选项通常只剩"拍照"这一项
// （因为读取相册/文件管理器都需要存储权限，唯独拍照不需要，所以看起来就是"只能访问相机"）。
// 这里列出全部可能用到的权限：老版本安卓用 READ/WRITE_EXTERNAL_STORAGE，Android 13+（API 33）分区存储改用
// READ_MEDIA_IMAGES/VIDEO/AUDIO 这几个更细分的权限——两套都请求一遍，系统会自动忽略当前版本不认识的权限名，不会报错。
const APP_STORAGE_PERMISSIONS = [
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_MEDIA_AUDIO',
    'android.permission.CAMERA'
];
function openFilePickerForApp(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (window.plus && plus.android) {
        try {
            plus.android.requestPermissions(
                APP_STORAGE_PERMISSIONS,
                function () { input.click(); },
                function () { input.click(); } // 就算授权被拒绝，也还是尝试打开，让系统自己处理弹窗
            );
            return;
        } catch (e) { /* 当前 HBuilderX/Android 版本没有这个API，直接走下面的默认逻辑 */ }
    }
    input.click();
}

// ★ 关键补充：不是所有文件选择器都是通过 openFilePickerForApp() 触发的——像头像/背景图这些
// <input type="file"> 有些直接暴露在页面上让用户点（没有套一层按钮走 openFilePickerForApp），
// 这些地方点击时不会提前申请权限，在没有权限的情况下同样会出现"只能拍照"的问题。
// 与其挨个改造成按钮触发，更省事也更稳妥的做法是：APK启动、进入首页时就主动申请一次全部存储/媒体权限，
// 这样不管用户点的是哪个文件输入框，系统这时候都已经有权限了，行为跟普通网页版一致。
function requestAllAppPermissionsOnLaunch() {
    if (window.plus && plus.android) {
        try { plus.android.requestPermissions(APP_STORAGE_PERMISSIONS, function () {}, function () {}); } catch (e) {}
    }
}

// 🖐️ 切聊天回复模式
function gySetChatReplyMode(v) {
    gyChatReplyMode = (v === 'manual') ? 'manual' : 'auto';
    try { if (typeof gyPaintReplyBtn === 'function') gyPaintReplyBtn(); } catch (e) {}
    try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
}

function applyDarkTheme() {
    document.body.classList.toggle('dark-theme', !!darkTheme);
    if (typeof applyUiTheme === 'function') applyUiTheme();
    // 正文区的底色是 updateGlobalBgStyles 用 JS 拼出来的，不重算一遍它会一直停在上一个模式的颜色
    if (typeof updateGlobalBgStyles === 'function') updateGlobalBgStyles();
}

function toggleDarkTheme() {
    darkTheme = document.getElementById('darkThemeToggle')?.checked || false;
    applyDarkTheme();
    saveAllData();
}

// ===================== 浏览器系统级推送通知 =====================
// 安卓Chrome等移动浏览器规范上不允许网页直接 new Notification() 弹通知（会直接抛错），
// 必须通过注册好的 Service Worker 调 registration.showNotification() 才行。
// 这里在页面加载时尝试注册；file:// 本地文件和普通 http:// 不支持 Service Worker
// （浏览器要求安全上下文：https 或 localhost），注册失败就静默忽略，走后面的兜底方案。
function registerServiceWorkerForNotifications() {
    if (!('serviceWorker' in navigator)) return;
    const secureEnough = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    // 打包成APK（window.plus存在）时也尝试注册一下：不确定 5+Runtime 的 file:// 环境是否允许，
    // 但试一下不会报错也不会有副作用，注册失败会被下面的catch静默吃掉。
    if (!secureEnough && !(window.plus && plus.push)) return;
    navigator.serviceWorker.register('./service-worker.js?v=' + (typeof GY_VERSION !== 'undefined' ? GY_VERSION : '0')).catch(e => console.warn('Service Worker 注册失败（不影响其它功能，但系统通知在部分安卓浏览器/APK上可能无法弹出）：', e));
}

function requestNotificationPermission() {
    const statusEl = document.getElementById('notifPermStatus');
    // HBuilderX 打包的 APK 环境：本地推送通常不需要单独申请网页那种权限弹窗，直接可用
    if (window.plus && plus.push) {
        if (statusEl) statusEl.innerText = '✅ 已在APK环境中就绪（原生推送）';
        return;
    }
    if (typeof Notification === 'undefined') { alert('你的浏览器不支持系统通知！'); return; }
    Notification.requestPermission().then(perm => {
        if (statusEl) statusEl.innerText = perm === 'granted' ? '✅ 已授权' : (perm === 'denied' ? '❌ 已被拒绝（需要去浏览器设置里手动开启）' : '⚠️ 未授权');
    });
}

function toggleBrowserNotifications() {
    enableBrowserNotifications = document.getElementById('enableBrowserNotifications')?.checked || false;
    if (enableBrowserNotifications && !(window.plus && plus.push) && typeof Notification !== 'undefined' && Notification.permission === 'default') requestNotificationPermission();
    saveAllData();
}

// 云端主动消息唤醒设置：勾选/填写后立即保存，并强制触发一次同步（方便你马上测试Worker是否配对成功）
function saveCloudSyncSettings() {
    cloudSyncEnabled = document.getElementById('cloudSyncEnabledToggle')?.checked || false;
    cloudWorkerUrl = (document.getElementById('cloudWorkerUrlInput')?.value || '').trim().replace(/\/$/, '');
    cloudAuthToken = (document.getElementById('cloudAuthTokenInput')?.value || '').trim();
    ntfyTopic = (document.getElementById('ntfyTopicInput')?.value || '').trim();
    saveAllData();
    if (cloudSyncEnabled && cloudWorkerUrl && cloudAuthToken && typeof syncStateToCloud === 'function') {
        syncStateToCloud(true);
    }
}

function sendBrowserNotification(title, body) {
    if (!enableBrowserNotifications) return;
    if (document.visibilityState === 'visible' && document.hasFocus()) return; // 用户正盯着看呢，不用再弹系统通知
    const plainTitle = (title || '').replace(/<[^>]+>/g, '').trim() || '新消息';
    const plainBody = (body || '').replace(/<[^>]+>/g, '').trim().slice(0, 200);

    // HBuilderX 打包的 APK（5+ Runtime）环境：先试一次原生本地推送。
    // 注意：这里不再 return——plus.push.createMessage 如果因为manifest里push渠道没配对（uni-push/个推没弄好）
    // 而"静默不生效"（不报错，就是不显示），我们没法从JS里检测到，所以下面继续尝试 Service Worker 通知
    // 作为并行兜底，两条路都试一遍，只要有一条成功就能收到提醒。
    if (window.plus && plus.push) {
        try { plus.push.createMessage(plainBody, {}, { title: plainTitle, cover: false }); } catch (e) { /* 静默失败，继续往下试其它方式 */ }
    }
    // 普通浏览器环境 / APK内置WebView：走标准 Web Notification API
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const fallbackDirectNotification = () => {
        try {
            new Notification(plainTitle, { body: plainBody, icon: siteLogoImg || undefined });
        } catch (e) {
            // 安卓Chrome等移动浏览器会在这里直接抛"Illegal constructor"——
            // 这就是"开关开了但从来没弹过"的真正原因。打个log方便排查，而不是彻底静默。
            console.warn('系统通知发送失败（安卓浏览器需要Service Worker才能弹通知，请确认注册成功且是https访问）：', e);
        }
    };

    // 优先走 Service Worker 通知：安卓Chrome等移动浏览器强制要求这样才能真正弹出系统通知栏。
    // 注意：navigator.serviceWorker.ready 在"从没成功注册过SW"的情况下会永远pending不resolve也不reject，
    // 所以这里必须先自己判断一下环境是否支持（跟注册时用的判断条件保持一致），不满足就直接走兜底，
    // 不能无脑丢给 .ready 去等，否则会导致通知彻底哑火。
    // window.plus 环境（打包的APK）也放进来一起试——不确定 5+Runtime 的WebView 在 file:// 下是否支持
    // Service Worker，但反正 plus.push 那条路已经不保证成功了，多试一种方式没有坏处。
    const swEnvOk = 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1' || (window.plus && plus.push));
    if (swEnvOk) {
        // 万一SW注册出了什么意外没成功，.ready 可能永远pending——加个超时兜底，别让通知彻底哑火
        const readyOrTimeout = Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => setTimeout(() => reject(new Error('service worker ready超时')), 3000)),
        ]);
        readyOrTimeout.then(reg => {
            reg.showNotification(plainTitle, { body: plainBody, icon: siteLogoImg || undefined }).catch(fallbackDirectNotification);
        }).catch(fallbackDirectNotification);
    } else {
        fallbackDirectNotification();
    }
}

function clearGlobalBg() { globalBgImage = null; document.getElementById('globalBgFileInput').value = ''; updateGlobalBgStyles(); saveAllData(); }
function updateGlobalBgOpacity(val) { globalBgOpacity = parseFloat(val); updateGlobalBgStyles(); saveAllData(); }
function updateGlobalBgStyles() {
    // 🌙 这里以前把 255,255,255 写死了——不管深色模式开没开，正文区一律是纯白。
    //    可是深色模式又把字色翻成了浅色（#e7e9ea），白底浅字＝整页看不见。
    //    实测：开着深色模式进设置页，开关标题几乎是隐形的。现在跟着深色模式换底色。
    const dark = (typeof darkTheme !== 'undefined') && !!darkTheme;
    const base = dark ? '21, 32, 43' : '255, 255, 255';     // 主体面（跟 style.css 里的 #15202b 对齐）
    const card = dark ? '25, 39, 52' : '255, 255, 255';     // 卡片面（#192734）

    if (globalBgImage) { document.body.style.backgroundImage = `url('${globalBgImage}')`; document.body.style.backgroundColor = 'transparent'; }
    else { document.body.style.backgroundImage = 'none'; document.body.style.backgroundColor = dark ? '#15202b' : '#ffffff'; }

    let styleTag = document.getElementById('dynamic-bg-style');
    if(!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'dynamic-bg-style'; document.head.appendChild(styleTag); }
    let a = globalBgOpacity;
    styleTag.innerHTML = `.layout-container { background-color: rgba(${base}, ${a}); } .top-tabs, .header-title { background-color: rgba(${base}, ${Math.min(a + 0.1, 1)}); } #view-anon-forum { background-color: rgba(44, 44, 44, ${a}); } #view-anon-forum .header-title { background-color: rgba(44, 44, 44, ${Math.min(a + 0.1, 1)}); } .info-card, .search-box { background-color: rgba(${card}, ${Math.min(a + 0.2, 1)}); }`;
}

function toggleAdvancedPostOptions() { const el = document.getElementById('advancedPostOptions'); el.style.display = el.style.display === 'none' ? 'flex' : 'none'; }

function fileToBase64(file) {
    return new Promise((resolve) => {
        if (!file) { resolve(null); return; }
        if (!file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => resolve(null); reader.readAsDataURL(file); return; }
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                if ((file.type === 'image/gif' && file.size < 500 * 1024) || file.size < 100 * 1024) { resolve(e.target.result); return; }
                const img = new Image();
                img.onload = function() {
                    try {
                        const canvas = document.createElement('canvas'); const MAX_WIDTH = 800; const MAX_HEIGHT = 800; let width = img.width; let height = img.height;
                        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                        canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', 0.6));
                    } catch (err) { resolve(e.target.result); }
                };
                img.onerror = () => resolve(e.target.result);
                img.src = e.target.result;
            } catch (err) { resolve(e.target.result); }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

// 🐛 头像 base64 不再往每个 HTML 片段里塞一遍。
// 以前 getAvatarHTML 是把整串 base64 直接写进 style="background-image:url('data:image/png;base64,....')"。
// 一个 120KB 的头像、一屏 60 条消息，拼出来的 innerHTML 就是 7 MB 起步——浏览器解析这坨字符串
// 要几百毫秒，聊天越长越卡，也是"打不了字"的帮凶之一。
// 现在改成：同一张图只在 <style> 里登记一条 CSS 类（.gy-av-N{background-image:url(...)}），
// HTML 里只写类名。显示效果一模一样，7 MB 的 HTML 变成几十 KB。
const __gyAvatarClsMap = new Map();   // key(角色id/群id) -> { url, cls }
let __gyAvatarStyleEl = null;
let __gyAvatarClsSeq = 0;
function gyAvatarBgClass(key, imgUrl) {
    if (!imgUrl || typeof imgUrl !== 'string') return '';
    const cacheKey = String(key == null ? imgUrl.length + ':' + imgUrl.slice(0, 48) : key);
    const hit = __gyAvatarClsMap.get(cacheKey);
    if (hit && hit.url === imgUrl) return hit.cls;   // 同一张图，直接复用
    try {
        if (!__gyAvatarStyleEl || !__gyAvatarStyleEl.isConnected) {
            __gyAvatarStyleEl = document.createElement('style');
            __gyAvatarStyleEl.id = 'gyAvatarStyles';
            document.head.appendChild(__gyAvatarStyleEl);
        }
        // url() 里出现引号/换行会把整条规则弄坏，先清掉；base64 和普通 http 链接都不含这些字符
        const safe = imgUrl.replace(/["'\\\n\r]/g, '');
        const cls = hit ? hit.cls : ('gy-av-' + (++__gyAvatarClsSeq));
        if (hit) {
            // 换头像了：把旧规则替换掉，类名不变，已经渲染出来的节点会自动跟着更新
            const rules = __gyAvatarStyleEl.sheet.cssRules;
            for (let i = rules.length - 1; i >= 0; i--) {
                if (rules[i].selectorText === '.' + cls) { __gyAvatarStyleEl.sheet.deleteRule(i); break; }
            }
        }
        __gyAvatarStyleEl.sheet.insertRule(
            '.' + cls + '{background-image:url("' + safe + '");background-size:cover;background-position:center;}',
            __gyAvatarStyleEl.sheet.cssRules.length);
        __gyAvatarClsMap.set(cacheKey, { url: imgUrl, cls });
        return cls;
    } catch (e) {
        return '';   // 拿不到 sheet（极少数环境）就退回老写法，见下面的调用点
    }
}
function getAvatarHTML(char, size = 40, extraClass = '') {
    if(!char) char = { name:'未知', themeColor:'#1d9bf0', avatarEmoji:'?' };
    const style = `width:${size}px; height:${size}px;`;
    if (char.avatarImg) {
        const bgCls = gyAvatarBgClass(char.id, char.avatarImg);
        if (bgCls) return `<div class="avatar ${extraClass} ${bgCls}" style="${style} border:2px solid transparent;"></div>`;
        return `<div class="avatar ${extraClass}" style="${style} background-image:url('${char.avatarImg}'); background-size:cover; background-position:center; border:2px solid transparent;"></div>`;
    }
    return `<div class="avatar ${extraClass}" style="${style} background-color:rgba(255,255,255,0.8); border:2px solid #1d9bf0; color:#1d9bf0; font-size:${size*0.4}px;">${char.avatarEmoji || char.name?.[0] || '?'}</div>`;
}
function getGroupAvatarHTML(g, size=50, extraClass = '') {
    const style = `width:${size}px; height:${size}px;`;
    if(g && g.avatarImg) {
        const bgCls = gyAvatarBgClass('g:' + g.id, g.avatarImg);
        if (bgCls) return `<div class="avatar ${extraClass} ${bgCls}" style="${style} border:2px solid transparent;"></div>`;
        return `<div class="avatar ${extraClass}" style="${style} background-image:url('${g.avatarImg}'); background-size:cover; background-position:center; border:2px solid transparent;"></div>`;
    }
    return `<div class="avatar ${extraClass}" style="${style} background:rgba(255,255,255,0.8); color:#1d9bf0; font-size:${size*0.4}px; border:2px solid #1d9bf0; display:flex; align-items:center; justify-content:center;">群</div>`;
}
function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    if (id === 'settingsModal' && typeof renderCharReplyToggleList === 'function') renderCharReplyToggleList();
    modal.style.display = 'flex';
    // ⚠️ 找到了"上传头像/背景不弹裁剪框"的真正病根：这里不管modal自己有没有单独设置过z-index，
    // 一律强制盖成2500。像 cropModal 这种需要"叠在其他已经打开的modal上面"的弹窗，HTML里
    // 单独写了 z-index:99999，结果一open就被这行摁回2500，跟其他modal（也都是2500）变成同一层级，
    // 层级一样时按DOM顺序堆叠，而cropModal在HTML里定义得比userProfileModal靠前，就被压在了
    // 后开的userProfileModal下面——看起来就是"选完图片裁剪框没反应"，其实它已经弹出来了，
    // 只是被编辑资料那个弹窗盖住看不见，关掉编辑资料弹窗以后才露出来（还因为编辑资料弹窗已经
    // 关了，没法点保存）。这里改成只在modal没有自己指定过z-index时才用默认值2500，
    // 已经自己指定了（比如cropModal的99999）就尊重它，不要覆盖。
    if (!modal.style.zIndex) modal.style.zIndex = 2500;
    // 确保modal在顶层，防止被其他元素覆盖
    modal.style.position = 'fixed';
}
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

function getFullDataSnapshot() {
    return {
        myApiUrl, myApiKey, myModel, subApiUrl, subApiKey, subModel, vecApiUrl, vecApiKey, lastWorkingModel, lastWorkingSubModel, quietHoursEnabled, quietHoursStart, quietHoursEnd, samplerTemperature, samplerTopP, samplerFrequencyPenalty, samplerPresencePenalty, samplerTopK, samplerMaxTokens,
        myCharacters, globalPosts, anonPosts, characterGroups, factionColors, charRelationships, relationshipTypePresets, statusTypes, globalEmoticons, worldbooks, worldbookCategories, globalChats, groupChats, currentUser, tabloidAccount, trendingTags,
        globalBgImage, globalBgOpacity, allowActionTags, gyChatReplyMode, chatBatchDelaySec, humanFeelEnabled, tpesEnabled, autoRenderStatusChips, showStatusInPosts, showStatusInComments, showStatusInDiary, showStatusInChat, enableScheduleAutoCheck, enableAffinitySystem, enableTypingIndicator, chatTimeSepEnabled, chatTimeSepMin, momentsHomeOn, enableMiniGameCharSpeech, enableAnniversary, memoryAlbum, chatWordLimit, postWordLimit, diaryWordLimit, letterWordLimit, commentWordLimit, chatMsgCountMin, chatMsgCountMax, chatReplyStyleMode, chatSummaryInterval, groupSummaryInterval, postMemoryInterval, chatListViewMode, pinnedSessionIds,
        letterReplyDelayMin, letterReplyDelayMax, globalUserDiaries,
        globalNovels, storySessions, novelCustomCSS, globalCustomCSS, tabloidPosts, siteLogoImg,
        forumThreads,
        npcReplyProb, npcReplyMaxCount,
        regexScripts, enableVectorMemory, enableChatScriptExecution, embeddingModel, dataBank, darkTheme, enableBrowserNotifications, enableCharMoveToChat, showNovelReasoning, showNovelFloorNumber, showNovelThinkingTime,
        worldbookCharBudget, semanticCharBudget, chatHistoryTurns, charInteractMaxCount, scheduleHistoryKeep,
        gyTokenStats, autoFeatureSwitches, gySwitchPresets: (window.gySwitchPresets || []), gyPeerLog: (window.gyPeerLog || []), globalTheaterLogs, theaterLogKeep,
        aliveSettings, aliveHeld,
        plugins, aiPresets, userPersonas, npcIdentities, charUserPersona, factionUserPersona,
        cloudSyncEnabled, cloudWorkerUrl, cloudAuthToken, ntfyTopic,
        clickEffectEnabled, clickEffectStyle, clickEffectCustomImage,
        toastMaxVisible, novelReviewMax, uiTheme, tweetTimeAbs, gyMainWidth, gyLeftWidth, gyFontSize,
        chatVariables, globalVariables,
        reasoningFormats, reasoningDisplayMode, reasoningVaultOn, statusLogKeepDays,
        mvuStats, memoryEntries,
        __unsplashCleaned: unsplashCleaned,
    };
}

// 🐛🐛 "对面一发消息就打不了字 / 导入备份后必须大退" 的真正病根，就在这个函数上。
//
// 病理：saveAllData() 以前是"叫一次就真存一次"。localforage.setItem 把整份存档写进 IndexedDB，
// 写之前浏览器要先做一次**结构化克隆**——这一步是**同步跑在主线程上的**，整份存档多大就克隆多久。
// 存档里最占地方的是 base64 图片（表情包、角色头像、聊天里的图），几十MB很常见。
//
// 而全项目里 saveAllData() 被调用了两百多处，其中好几处是**在循环里**调的：
//   · renderChatMessages 每遇到一条未读消息就调一次（60条未读 = 60次全量克隆）
//   · triggerAIBatchReply 每落地一条回复调一次（模型一次吐3条 = 3次）
// 实测：4.5MB 的存档，"对面连发3条"能把主线程占住 1.4 秒，"60条未读渲染一次"占住 1.7 秒。
// 主线程被占住的这段时间里，键盘敲进去的字**是丢的**，光标也不闪——看起来就是"输入框坏了"。
// 存档越大越明显，用户那边的存档远不止 4.5MB，所以直接卡到要大退。
//
// 治法：合并写入。叫多少次都行，400ms 内的所有调用合并成一次真写。
// 调用点一处都不用改（签名没变），效果是 N 次全量克隆变成 1 次。
// 关键节点（关页面、切后台、导入导出前后）用 saveAllData({ immediate: true }) 立刻落盘，不会丢数据。
const GY_SAVE_DEBOUNCE_MS = 400;
let __gySaveTimer = null;      // 合并窗口的计时器
let __gySavePending = false;   // 窗口期内有没有人叫过存档
let __gySaveLastPromise = null;

// ===================== 💾 增量保存：大图只存一次 =====================
// 合并写入解决了"叫太多次"，但每次真写还是**整份**存档：表情包、头像、聊天图、皮肤这些 base64 图
// 动辄几十 MB，其实几乎不变，却每次都跟着克隆一遍、往硬盘里写一遍。
// 现在：存档时把 ≥8KB 的 data: 图片换成一个小引用（\u2063gyimg:编号），图片本体单独存进 gyImgStore，
// 同一张图只存一次，以后每次存档只写"剩下那点文字"。读档时再把引用换回原图，内存里的数据跟以前一模一样。
//   · 同一张图按内容算编号（长度 + 两个 32 位哈希），换图就是新编号，旧的不会被覆盖
//   · 先把新图写完，再写主存档；任何一步失败，硬盘上的旧存档都完好
//   · 不再被引用的旧图，读档一分钟后再清理（清理前会重新读一遍主存档核对，不会误删）
//   · 老存档（没有引用的）、导入的备份文件照常能读，存一次就自动换成新格式
//   · 环境里没有 localforage.createInstance（极老的浏览器 / 测试桩）就退回整份存
const GY_IMG_MIN = 8192;
const GY_IMG_TAG = '\u2063gyimg:';
let __gyImgStoreInst = null;
function gyImgStore() {
    if (__gyImgStoreInst === null) {
        try {
            __gyImgStoreInst = (typeof localforage !== 'undefined' && typeof localforage.createInstance === 'function')
                ? localforage.createInstance({ name: 'gyImgStore', storeName: 'imgs' }) : false;
        } catch (e) { __gyImgStoreInst = false; }
    }
    return __gyImgStoreInst;
}
let __gyImgIdOf = new Map();     // 图片字符串 -> 编号（只留当前存档里还在用的，删掉的图不会一直占着内存）
const __gyImgSaved = new Set();  // 确认已经在 gyImgStore 里的编号
function gyImgHashId(s) {
    let h1 = 0x811c9dc5, h2 = 5381;
    for (let i = 0, n = s.length; i < n; i++) {
        const c = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 16777619);
        h2 = (Math.imul(h2, 33) + c) | 0;
    }
    return s.length.toString(36) + '_' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
function gyIsBigImg(v) { return typeof v === 'string' && v.length >= GY_IMG_MIN && v.charCodeAt(0) === 100 /* d */ && v.startsWith('data:'); }
// 把快照里的大图换成引用。返回 { lean, fresh:[[id,str]], live:Map }。
// 同一个对象在快照里出现多次（比如帖子里的 char 和角色列表是同一个对象），换完之后也还是同一个对象——
// 跟以前整份存时一样，读回来的"共用关系"不会变。
function gyImgExternalize(snap) {
    const live = new Map(), fresh = [], memo = new Map();
    const conv = (v, depth) => {
        if (typeof v === 'string') {
            if (!gyIsBigImg(v)) return v;
            let id = live.get(v) || __gyImgIdOf.get(v);
            if (!id) id = gyImgHashId(v);
            if (!live.has(v)) {
                live.set(v, id);
                if (!__gyImgSaved.has(id)) fresh.push([id, v]);
            }
            return GY_IMG_TAG + id;
        }
        if (!v || typeof v !== 'object' || depth > 200) return v;
        const isArr = Array.isArray(v);
        if (!isArr) { const pr = Object.getPrototypeOf(v); if (pr !== Object.prototype && pr !== null) return v; }  // Date / Blob 等原样交给存储
        if (memo.has(v)) return memo.get(v);
        const out = isArr ? new Array(v.length) : {};
        memo.set(v, out);
        if (isArr) { for (let i = 0; i < v.length; i++) out[i] = conv(v[i], depth + 1); }
        else { for (const k in v) { if (Object.prototype.hasOwnProperty.call(v, k)) out[k] = conv(v[k], depth + 1); } }
        return out;
    };
    const lean = conv(snap, 0);
    return { lean, fresh, live };
}
// 把对象里（原地）所有引用换回原图。只读用得到的那些，读不到的图换成空字符串（不会显示成一串乱码）。
async function gyResolveImgRefs(root) {
    if (!root || typeof root !== 'object') return root;
    const store = gyImgStore();
    const slots = [], seen = new Set();
    const walk = (o, depth) => {
        if (!o || typeof o !== 'object' || seen.has(o) || depth > 200) return;
        seen.add(o);
        for (const k in o) {
            if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
            const v = o[k];
            if (typeof v === 'string') { if (v.startsWith(GY_IMG_TAG)) slots.push([o, k, v.slice(GY_IMG_TAG.length)]); }
            else if (v && typeof v === 'object') walk(v, depth + 1);
        }
    };
    walk(root, 0);
    if (!slots.length) return root;
    const ids = [...new Set(slots.map(x => x[2]))];
    const got = new Map();
    await Promise.all(ids.map(async id => {
        let s = null;
        try { s = store ? await store.getItem(id) : null; } catch (e) {}
        if (typeof s === 'string') { got.set(id, s); __gyImgSaved.add(id); __gyImgIdOf.set(s, id); }
    }));
    let miss = 0;
    slots.forEach(([o, k, id]) => { const s = got.get(id); if (s == null) miss++; o[k] = s == null ? '' : s; });
    if (miss) console.warn('[增量保存] 有 ' + miss + ' 处图片没找到（可能是别的设备/浏览器清过数据），已置空');
    return root;
}
window.gyResolveImgRefs = gyResolveImgRefs;
// 清理不再用到的旧图：读档后一分钟跑一次。以硬盘上当时的主存档为准再核对一遍，另一个标签页刚存的新图不会被误删。
let __gyImgGcTimer = null;
function gyImgScheduleGc(delay) {
    const store = gyImgStore();
    if (!store || typeof store.keys !== 'function') return;
    if (__gyImgGcTimer) clearTimeout(__gyImgGcTimer);
    __gyImgGcTimer = setTimeout(async function () {
        __gyImgGcTimer = null;
        try {
            await flushPendingSave();
            if (__gySaveLastPromise) { try { await __gySaveLastPromise; } catch (e) {} }
            const rec = await localforage.getItem('myTwitterAppData');
            if (!rec || !rec.__gyImgRefs) return;        // 主存档还不是新格式：一张都不删
            const keep = new Set();
            const txt = JSON.stringify(rec);
            const re = /\u2063gyimg:([a-z0-9_]+)/g; let m;
            while ((m = re.exec(txt))) keep.add(m[1]);
            __gyImgIdOf.forEach(id => keep.add(id));      // 内存里正在用的也留着
            const keys = await store.keys();
            let n = 0;
            for (const k of keys) { if (!keep.has(k)) { try { await store.removeItem(k); __gyImgSaved.delete(k); n++; } catch (e) {} } }
            if (n) console.log('[增量保存] 清掉了 ' + n + ' 张不再用到的旧图');
        } catch (e) { console.warn('[增量保存] 清理旧图失败（不影响存档）', e); }
    }, delay == null ? 60000 : delay);
}
window.gyImgScheduleGc = gyImgScheduleGc;

function __gyDoSaveNow() {
    __gySavePending = false;
    const dataToSave = getFullDataSnapshot();
    const onFail = function (e) {
        console.error("存档失败", e);
        alert("⚠️ 保存失败：设备硬盘空间可能已满！");
    };
    const store = gyImgStore();
    let lean = null, fresh = [], live = null;
    if (store) {
        try { const r = gyImgExternalize(dataToSave); lean = r.lean; fresh = r.fresh; live = r.live; }
        catch (e) { console.warn('[增量保存] 拆图失败，这次整份存', e); lean = null; }
    }
    // 页面正要关 / 切后台时，"先写新图、等写完再写主存档"这第二步可能来不及跑。
    // 这种时候如果恰好有新图没存过，就这一次整份存（读档两种格式都认），下次正常存档再拆开。
    if (lean && fresh.length && __gyUnloading) lean = null;
    if (!lean) {
        __gySaveLastPromise = localforage.setItem('myTwitterAppData', dataToSave).catch(onFail);
        return __gySaveLastPromise;
    }
    lean.__gyImgRefs = 1;
    __gyImgIdOf = live;
    __gySaveLastPromise = Promise.all(fresh.map(([id, s]) =>
        store.setItem(id, s).then(function () { __gyImgSaved.add(id); })
    )).then(function () {
        return localforage.setItem('myTwitterAppData', lean);
    }).catch(onFail);
    return __gySaveLastPromise;
}

function saveAllData(opts) {
    if (opts && opts.immediate) {
        if (__gySaveTimer) { clearTimeout(__gySaveTimer); __gySaveTimer = null; }
        return __gyDoSaveNow();
    }
    __gySavePending = true;
    if (__gySaveTimer) return __gySaveLastPromise;   // 窗口已经开着，搭这趟车就行
    __gySaveTimer = setTimeout(function () {
        __gySaveTimer = null;
        if (__gySavePending) __gyDoSaveNow();
    }, GY_SAVE_DEBOUNCE_MS);
    return __gySaveLastPromise;
}

// 有待写入的存档时立刻落盘。关窗口/切后台/手动导出前调，保证合并窗口里的改动不会丢。
function flushPendingSave() {
    if (__gySaveTimer) { clearTimeout(__gySaveTimer); __gySaveTimer = null; }
    if (__gySavePending) return __gyDoSaveNow();
    return Promise.resolve();
}
var __gyUnloading = false;
function __gyFlushForLeave() {
    __gyUnloading = true;
    try { flushPendingSave(); } catch (e) {}
    __gyUnloading = false;
}
window.addEventListener('beforeunload', __gyFlushForLeave);
window.addEventListener('pagehide', __gyFlushForLeave);
document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') __gyFlushForLeave();
});

async function loadAllData() {
    try {
        // 1. 优先尝试从全新的 IndexedDB 数据库读取
        let parsed = await localforage.getItem('myTwitterAppData');

        // 2. 💡 无缝迁移机制：如果新库没有数据，但旧的 localStorage 爆满的数据还在，就自动搬家！
        if (!parsed) {
            const oldSavedData = localStorage.getItem('myTwitterAppData');
            if (oldSavedData) {
                console.log("正在将您的数据从 localStorage 无缝迁移至大容量 IndexedDB...");
                try {
                    parsed = JSON.parse(oldSavedData);
                    await localforage.setItem('myTwitterAppData', parsed); // 存入新库
                    localStorage.removeItem('myTwitterAppData'); // 🔥 删除旧库，彻底释放那挤爆的 5MB 空间
                    console.log("✅ 迁移成功！浏览器旧内存已释放。");
                } catch (e) {
                    console.error("数据迁移失败:", e);
                }
            }
        }
// 💡 终极修复：全局存档清洗！彻底剿灭数据库中所有隐蔽的 Unsplash 旧链接
        // 🐛 性能/内存修复：这个清洗只需要对"确实还带着旧链接的老存档"做一次，之前完全没有"做过一次就不用再做"
        // 的标记，导致每次刷新/打开app都会：把整个存档 JSON.stringify 成一整条字符串（存档越大，角色/聊天记录/
        // 图片越多，这条字符串可能几十上百MB）、再跑两遍全局正则扫描、经常还要整个 JSON.parse 一次——存档小的时候
        // 感觉不出来，但存档大了之后，这几步在每次加载时都会瞬间占用大量内存，是"浏览器内存不够/卡顿"的一个
        // 常见诱因。这里加一个"洗过一次就打标记"的开关，标记过的存档直接跳过整套清洗流程，不用每次都重新扫一遍。
        // 💾 增量保存格式：把图片引用换回原图（老存档 / 导入的备份没有引用，这一步什么都不做）
        if (parsed && parsed.__gyImgRefs) {
            try { await gyResolveImgRefs(parsed); } catch (e) { console.error('[增量保存] 读图失败', e); }
            delete parsed.__gyImgRefs;
            gyImgScheduleGc();
        }
        if (parsed && parsed.__unsplashCleaned) unsplashCleaned = true;
        if (parsed && !unsplashCleaned) {
            let originalStr = JSON.stringify(parsed);
            let newStr = originalStr;

            // 1. 替换带提示词的链接，例如 /800x400/?cyberpunk 或 /random/?city
            newStr = newStr.replace(/https?:\/\/source\.unsplash\.com\/(?:[a-z]+\/)?(?:(\d+)x(\d+)\/)?\?([^"'\s\>\]\)\\]+)/gi, (match, w, h, keyword) => {
                let url = `https://image.pollinations.ai/prompt/${keyword}?nologo=true`;
                if (w && h) url += `&width=${w}&height=${h}`;
                return url;
            });

            // 2. 兜底替换所有没带提示词的纯随机链接
            newStr = newStr.replace(/https?:\/\/source\.unsplash\.com\/(?:[a-z]+\/)?(?:(\d+)x(\d+))?[^"'\s\>\]\)\\]*/gi, (match, w, h) => {
                let url = `https://image.pollinations.ai/prompt/aesthetic_scenery?nologo=true`;
                if (w && h) url += `&width=${w}&height=${h}`;
                return url;
            });

            parsed = JSON.parse(newStr);
            unsplashCleaned = true; // 不管这次有没有实际替换到内容，都打上标记，保证只彻底扫这一次
            parsed.__unsplashCleaned = true;
            await localforage.setItem('myTwitterAppData', parsed); // 把洗净+打好标记的数据重新存回数据库
            if (originalStr !== newStr) console.log("✅ 存档清洗完成：已将所有旧版 Unsplash 图片替换为新接口！");
        }

        // 3. 开始恢复数据到页面（保持原有逻辑完全不变）
        if (parsed) {
            try {
                if (parsed.myApiUrl) myApiUrl = parsed.myApiUrl;
                if (parsed.myApiKey) myApiKey = parsed.myApiKey;
                if (parsed.myModel) myModel = parsed.myModel;
                if (parsed.subApiUrl !== undefined) subApiUrl = parsed.subApiUrl;
                if (parsed.subApiKey !== undefined) subApiKey = parsed.subApiKey;
                if (parsed.subModel !== undefined) subModel = parsed.subModel;
                if (parsed.vecApiUrl !== undefined) vecApiUrl = parsed.vecApiUrl;
                if (parsed.vecApiKey !== undefined) vecApiKey = parsed.vecApiKey;
                if (parsed.lastWorkingModel !== undefined) lastWorkingModel = parsed.lastWorkingModel;
                if (parsed.lastWorkingSubModel !== undefined) lastWorkingSubModel = parsed.lastWorkingSubModel;
                if (parsed.quietHoursEnabled !== undefined) quietHoursEnabled = parsed.quietHoursEnabled;
                if (parsed.quietHoursStart !== undefined) quietHoursStart = parsed.quietHoursStart;
                if (parsed.quietHoursEnd !== undefined) quietHoursEnd = parsed.quietHoursEnd;
                if (parsed.samplerTemperature !== undefined) samplerTemperature = parsed.samplerTemperature;
                if (parsed.samplerTopP !== undefined) samplerTopP = parsed.samplerTopP;
                if (parsed.samplerFrequencyPenalty !== undefined) samplerFrequencyPenalty = parsed.samplerFrequencyPenalty;
                if (parsed.samplerPresencePenalty !== undefined) samplerPresencePenalty = parsed.samplerPresencePenalty;
                if (parsed.samplerTopK !== undefined) samplerTopK = parsed.samplerTopK;
                if (parsed.samplerMaxTokens !== undefined) samplerMaxTokens = parsed.samplerMaxTokens;
                if (parsed.allowActionTags !== undefined) allowActionTags = parsed.allowActionTags;
                if (parsed.gyChatReplyMode !== undefined) gyChatReplyMode = parsed.gyChatReplyMode === 'manual' ? 'manual' : 'auto';
                if (parsed.chatBatchDelaySec !== undefined) {
                    chatBatchDelaySec = parsed.chatBatchDelaySec;
                    try { if (typeof window.gySetChatBatchDelay === 'function') window.gySetChatBatchDelay(chatBatchDelaySec); } catch (e) {}
                }
                if (parsed.enableCharMoveToChat !== undefined) enableCharMoveToChat = parsed.enableCharMoveToChat;
                if (parsed.showNovelReasoning !== undefined) showNovelReasoning = parsed.showNovelReasoning;
                if (parsed.showNovelFloorNumber !== undefined) showNovelFloorNumber = parsed.showNovelFloorNumber;
                if (parsed.showNovelThinkingTime !== undefined) showNovelThinkingTime = parsed.showNovelThinkingTime;
                if (parsed.humanFeelEnabled !== undefined) humanFeelEnabled = parsed.humanFeelEnabled;
                if (parsed.tpesEnabled !== undefined) tpesEnabled = parsed.tpesEnabled;
                if (parsed.autoRenderStatusChips !== undefined) autoRenderStatusChips = parsed.autoRenderStatusChips;
                if (parsed.showStatusInPosts !== undefined) showStatusInPosts = parsed.showStatusInPosts;
                if (parsed.showStatusInComments !== undefined) showStatusInComments = parsed.showStatusInComments;
                if (parsed.showStatusInDiary !== undefined) showStatusInDiary = parsed.showStatusInDiary;
                if (parsed.showStatusInChat !== undefined) showStatusInChat = parsed.showStatusInChat;
                if (parsed.enableScheduleAutoCheck !== undefined) enableScheduleAutoCheck = parsed.enableScheduleAutoCheck;
                if (parsed.enableAffinitySystem !== undefined) enableAffinitySystem = parsed.enableAffinitySystem;
                // 兼容旧版单开关
                if (parsed.enableTypingIndicator !== undefined) enableTypingIndicator = parsed.enableTypingIndicator;
                if (parsed.chatTimeSepEnabled !== undefined) chatTimeSepEnabled = parsed.chatTimeSepEnabled;
                if (parsed.chatTimeSepMin !== undefined) chatTimeSepMin = parsed.chatTimeSepMin;
                if (parsed.momentsHomeOn !== undefined) momentsHomeOn = parsed.momentsHomeOn;
                if (parsed.enableMiniGameCharSpeech !== undefined) enableMiniGameCharSpeech = parsed.enableMiniGameCharSpeech;
                if (parsed.chatListViewMode !== undefined) chatListViewMode = parsed.chatListViewMode;
                if (parsed.pinnedSessionIds !== undefined) pinnedSessionIds = parsed.pinnedSessionIds;
                if (parsed.enableAnniversary !== undefined) enableAnniversary = parsed.enableAnniversary;
                if (parsed.memoryAlbum) memoryAlbum = parsed.memoryAlbum;
                if (parsed.chatWordLimit !== undefined) chatWordLimit = parsed.chatWordLimit;
                if (parsed.postWordLimit !== undefined) postWordLimit = parsed.postWordLimit;
                if (parsed.diaryWordLimit !== undefined) diaryWordLimit = parsed.diaryWordLimit;
                if (parsed.letterWordLimit !== undefined) letterWordLimit = parsed.letterWordLimit;
                if (parsed.commentWordLimit !== undefined) commentWordLimit = parsed.commentWordLimit;
                if (parsed.letterReplyDelayMin !== undefined) letterReplyDelayMin = parsed.letterReplyDelayMin;
                if (parsed.letterReplyDelayMax !== undefined) letterReplyDelayMax = parsed.letterReplyDelayMax;
                if (parsed.globalUserDiaries !== undefined) globalUserDiaries = parsed.globalUserDiaries;
                if (parsed.chatMsgCountMin !== undefined) chatMsgCountMin = parsed.chatMsgCountMin;
                if (parsed.chatMsgCountMax !== undefined) chatMsgCountMax = parsed.chatMsgCountMax;
                if (parsed.chatReplyStyleMode !== undefined) chatReplyStyleMode = parsed.chatReplyStyleMode;
                if (parsed.chatSummaryInterval !== undefined) chatSummaryInterval = parsed.chatSummaryInterval;
                if (parsed.groupSummaryInterval !== undefined) groupSummaryInterval = parsed.groupSummaryInterval;
                if (parsed.postMemoryInterval !== undefined) postMemoryInterval = parsed.postMemoryInterval;
                if (parsed.npcReplyProb !== undefined) npcReplyProb = parsed.npcReplyProb;
                if (parsed.npcReplyMaxCount !== undefined) npcReplyMaxCount = parsed.npcReplyMaxCount;
                // migrateRegexScriptTrueEnd 定义在 js/15，比这里晚加载，但读档是在 onload 之后跑的，
                // 那时候所有模块都已经就位；万一顺序有变也不能让整个读档挂掉，所以加一层存在性判断。
                if (parsed.regexScripts) regexScripts = (typeof migrateRegexScriptTrueEnd === 'function')
                    ? migrateRegexScriptTrueEnd(parsed.regexScripts) : parsed.regexScripts;
                if (parsed.enableVectorMemory !== undefined) enableVectorMemory = parsed.enableVectorMemory;
                if (parsed.enableChatScriptExecution !== undefined) enableChatScriptExecution = parsed.enableChatScriptExecution;
                if (parsed.embeddingModel) embeddingModel = parsed.embeddingModel;
                if (parsed.dataBank) dataBank = parsed.dataBank;
                if (parsed.darkTheme !== undefined) darkTheme = parsed.darkTheme;
                if (parsed.enableBrowserNotifications !== undefined) enableBrowserNotifications = parsed.enableBrowserNotifications;
                if (parsed.worldbookCharBudget) worldbookCharBudget = parsed.worldbookCharBudget;
                if (parsed.semanticCharBudget) semanticCharBudget = parsed.semanticCharBudget;
                if (parsed.chatHistoryTurns) chatHistoryTurns = parsed.chatHistoryTurns;
                if (parsed.charInteractMaxCount !== undefined) charInteractMaxCount = parsed.charInteractMaxCount;
                if (parsed.scheduleHistoryKeep !== undefined) scheduleHistoryKeep = parsed.scheduleHistoryKeep;
                if (parsed.gyTokenStats && parsed.gyTokenStats.total) gyTokenStats = parsed.gyTokenStats;
                if (parsed.autoFeatureSwitches && typeof parsed.autoFeatureSwitches === 'object') autoFeatureSwitches = parsed.autoFeatureSwitches;
                if (Array.isArray(parsed.gySwitchPresets)) window.gySwitchPresets = parsed.gySwitchPresets;
                if (Array.isArray(parsed.gyPeerLog)) window.gyPeerLog = parsed.gyPeerLog;   // 📨 角色之间的来往（js/56）   // 🎛️ 我存的开关配置（js/54）
                if (parsed.plugins) plugins = parsed.plugins;
                if (parsed.aiPresets) aiPresets = parsed.aiPresets;
                if (parsed.userPersonas) userPersonas = parsed.userPersonas;
                if (Array.isArray(parsed.globalTheaterLogs)) globalTheaterLogs = parsed.globalTheaterLogs;
                if (typeof parsed.theaterLogKeep === 'number') theaterLogKeep = parsed.theaterLogKeep;
                // 🫀 活人感：设置合并（老存档没有的字段保留默认值），挂起的消息原样恢复
                if (parsed.aliveSettings && typeof parsed.aliveSettings === 'object') aliveSettings = Object.assign(aliveSettings, parsed.aliveSettings);
                if (parsed.aliveHeld && typeof parsed.aliveHeld === 'object') aliveHeld = parsed.aliveHeld;
                if (parsed.charUserPersona && typeof parsed.charUserPersona === 'object') charUserPersona = parsed.charUserPersona;
                if (parsed.factionUserPersona && typeof parsed.factionUserPersona === 'object') factionUserPersona = parsed.factionUserPersona;
                if (parsed.npcIdentities) npcIdentities = parsed.npcIdentities;
                if (parsed.cloudSyncEnabled !== undefined) cloudSyncEnabled = parsed.cloudSyncEnabled;
                if (parsed.cloudWorkerUrl !== undefined) cloudWorkerUrl = parsed.cloudWorkerUrl;
                if (parsed.cloudAuthToken !== undefined) cloudAuthToken = parsed.cloudAuthToken;
                if (parsed.ntfyTopic !== undefined) ntfyTopic = parsed.ntfyTopic;
                if (parsed.uiTheme !== undefined) uiTheme = parsed.uiTheme;
                if (parsed.toastMaxVisible !== undefined) toastMaxVisible = parsed.toastMaxVisible;
                if (parsed.novelReviewMax !== undefined) novelReviewMax = parsed.novelReviewMax;
                if (parsed.tweetTimeAbs !== undefined) tweetTimeAbs = !!parsed.tweetTimeAbs;
                if (parsed.gyMainWidth !== undefined) gyMainWidth = parsed.gyMainWidth;
                if (parsed.gyLeftWidth !== undefined) gyLeftWidth = parsed.gyLeftWidth;
                if (parsed.gyFontSize !== undefined) gyFontSize = parsed.gyFontSize;
                if (typeof applyMainWidth === 'function') applyMainWidth();
                applyDarkTheme();   // 里面会顺带 applyUiTheme()
                if (parsed.globalBgImage !== undefined) globalBgImage = parsed.globalBgImage;
                if (parsed.globalBgOpacity !== undefined) globalBgOpacity = parsed.globalBgOpacity;
                if (parsed.siteLogoImg !== undefined) siteLogoImg = parsed.siteLogoImg;

                const uiSyncMap = {
                    apiUrlInput: myApiUrl, apiKeyInput: myApiKey,
                    subApiUrlInput: subApiUrl, subApiKeyInput: subApiKey,
                    vecApiUrlInput: vecApiUrl, vecApiKeyInput: vecApiKey,
                    limitChat: chatWordLimit, limitPost: postWordLimit,
                    limitDiary: diaryWordLimit, limitLetter: letterWordLimit, limitComment: commentWordLimit,
                    limitChatMsgCountMin: chatMsgCountMin, limitChatMsgCountMax: chatMsgCountMax,
                    letterReplyDelayMinInput: letterReplyDelayMin, letterReplyDelayMaxInput: letterReplyDelayMax,
                    globalBgOpacityInput: globalBgOpacity,
                    npcProbInput: npcReplyProb, npcMaxCountInput: npcReplyMaxCount,
                    charInteractMaxInput: charInteractMaxCount,
                    samplerTemperature: samplerTemperature, samplerTopP: samplerTopP,
                    samplerFrequencyPenalty: samplerFrequencyPenalty, samplerPresencePenalty: samplerPresencePenalty,
                    samplerTopK: samplerTopK,
                    samplerMaxTokens: samplerMaxTokens
                };
                Object.keys(uiSyncMap).forEach(id => {
                    const el = document.getElementById(id);
                    if (el && uiSyncMap[id] !== undefined) el.value = uiSyncMap[id];
                });
                if (document.getElementById('allowActionTags')) document.getElementById('allowActionTags').checked = allowActionTags;
                if (document.getElementById('gyChatReplyModeSel')) document.getElementById('gyChatReplyModeSel').value = gyChatReplyMode;
                if (document.getElementById('chatBatchDelaySec')) document.getElementById('chatBatchDelaySec').value = chatBatchDelaySec;
                try { if (typeof gyPaintReplyBtn === 'function') gyPaintReplyBtn(); } catch (e) {}
                if (document.getElementById('enableCharMoveToChat')) document.getElementById('enableCharMoveToChat').checked = enableCharMoveToChat;
                if (document.getElementById('showNovelReasoning')) document.getElementById('showNovelReasoning').checked = showNovelReasoning;
                if (document.getElementById('showNovelFloorNumber')) document.getElementById('showNovelFloorNumber').checked = showNovelFloorNumber;
                if (document.getElementById('showNovelThinkingTime')) document.getElementById('showNovelThinkingTime').checked = showNovelThinkingTime;
                if (document.getElementById('humanFeelEnabled')) document.getElementById('humanFeelEnabled').checked = humanFeelEnabled;
                if (document.getElementById('tpesEnabled')) document.getElementById('tpesEnabled').checked = tpesEnabled;
                if (document.getElementById('autoRenderStatusChips')) document.getElementById('autoRenderStatusChips').checked = autoRenderStatusChips;
                if (document.getElementById('showStatusInPosts')) document.getElementById('showStatusInPosts').checked = showStatusInPosts;
                if (document.getElementById('showStatusInComments')) document.getElementById('showStatusInComments').checked = showStatusInComments;
                if (document.getElementById('showStatusInDiary')) document.getElementById('showStatusInDiary').checked = showStatusInDiary;
                if (document.getElementById('showStatusInChat')) document.getElementById('showStatusInChat').checked = showStatusInChat;
                if (document.getElementById('enableScheduleAutoCheck')) document.getElementById('enableScheduleAutoCheck').checked = enableScheduleAutoCheck;
                if (document.getElementById('enableAffinitySystem')) document.getElementById('enableAffinitySystem').checked = enableAffinitySystem;
                if (document.getElementById('enableTypingIndicator')) document.getElementById('enableTypingIndicator').checked = enableTypingIndicator;
                if (document.getElementById('chatTimeSepEnabled')) document.getElementById('chatTimeSepEnabled').checked = chatTimeSepEnabled;
                if (document.getElementById('chatTimeSepMin')) document.getElementById('chatTimeSepMin').value = chatTimeSepMin;
                if (document.getElementById('momentsHomeToggle')) document.getElementById('momentsHomeToggle').checked = momentsHomeOn;
                try { if (typeof window.gyMoSync === 'function') window.gyMoSync(); } catch (e) {}
                if (document.getElementById('enableMiniGameCharSpeech')) document.getElementById('enableMiniGameCharSpeech').checked = enableMiniGameCharSpeech;
                if (document.getElementById('quietHoursEnabled')) document.getElementById('quietHoursEnabled').checked = quietHoursEnabled;
                if (document.getElementById('quietHoursStart')) document.getElementById('quietHoursStart').value = quietHoursStart;
                if (document.getElementById('quietHoursEnd')) document.getElementById('quietHoursEnd').value = quietHoursEnd;
                if (document.getElementById('enableAnniversary')) document.getElementById('enableAnniversary').checked = enableAnniversary;
                if (document.getElementById('chatReplyStyleModeSelect')) { document.getElementById('chatReplyStyleModeSelect').value = chatReplyStyleMode; if (typeof toggleChatReplyStyleFieldsVisibility === 'function') toggleChatReplyStyleFieldsVisibility(); }
                if (document.getElementById('enableVectorMemory')) document.getElementById('enableVectorMemory').checked = enableVectorMemory;
                if (document.getElementById('enableChatScriptExecution')) document.getElementById('enableChatScriptExecution').checked = enableChatScriptExecution;
                const embeddingModelSelectEl = document.getElementById('embeddingModelSelect');
                if (embeddingModelSelectEl && embeddingModel) {
                    if (!Array.from(embeddingModelSelectEl.options).some(opt => opt.value === embeddingModel)) {
                        embeddingModelSelectEl.innerHTML += `<option value="${embeddingModel}">${embeddingModel}</option>`;
                    }
                    embeddingModelSelectEl.value = embeddingModel;
                }
                if (document.getElementById('darkThemeToggle')) document.getElementById('darkThemeToggle').checked = darkTheme;
                if (document.getElementById('enableBrowserNotifications')) document.getElementById('enableBrowserNotifications').checked = enableBrowserNotifications;
                if (document.getElementById('cloudSyncEnabledToggle')) document.getElementById('cloudSyncEnabledToggle').checked = cloudSyncEnabled;
                if (document.getElementById('cloudWorkerUrlInput')) document.getElementById('cloudWorkerUrlInput').value = cloudWorkerUrl || '';
                if (document.getElementById('cloudAuthTokenInput')) document.getElementById('cloudAuthTokenInput').value = cloudAuthToken || '';
                if (document.getElementById('ntfyTopicInput')) document.getElementById('ntfyTopicInput').value = ntfyTopic || '';
                if (document.getElementById('worldbookCharBudgetInput')) document.getElementById('worldbookCharBudgetInput').value = worldbookCharBudget;
                if (document.getElementById('semanticCharBudgetInput')) document.getElementById('semanticCharBudgetInput').value = semanticCharBudget;
                if (document.getElementById('chatHistoryTurnsInput')) document.getElementById('chatHistoryTurnsInput').value = chatHistoryTurns;
                const modelSelect = document.getElementById('modelSelect');
                if (modelSelect && myModel) { if (!Array.from(modelSelect.options).some(opt => opt.value === myModel)) modelSelect.innerHTML += `<option value="${myModel}">${myModel}</option>`; modelSelect.value = myModel; }
                const subModelSelect = document.getElementById('subModelSelect');
                if (subModelSelect && subModel) { if (!Array.from(subModelSelect.options).some(opt => opt.value === subModel)) subModelSelect.innerHTML += `<option value="${subModel}">${subModel}</option>`; subModelSelect.value = subModel; }
            } catch (e) { console.error("API 设置恢复出错:", e); }

            try { if (parsed.myCharacters) { myCharacters = parsed.myCharacters; myCharacters.forEach(c => { if (c.diaryData && typeof c.diaryData.letter === 'string') { c.diaryData = { letters: c.diaryData.letter ? [{ id: 'old_l', title: '往期信件', date: Date.now(), content: c.diaryData.letter }] : [], diaries: c.diaryData.diary ? [{ id: 'old_d', title: '往期日记', date: Date.now(), content: c.diaryData.diary }] : [] }; }
                // 修复：老存档/异常渠道导入的角色可能缺失发帖频率等字段，导致自动发帖引擎里 char.postFreq.interval 报错、
                // 进而让"所有"角色都生成不了推文。这里统一兜底补全，防止一颗老鼠屎坏了一锅粥。
                if (!c.postFreq || typeof c.postFreq.interval !== 'number') c.postFreq = { interval: 1, unit: 'day', count: 1 };
                if (!c.chatFreq) c.chatFreq = { interval: 0, unit: 'hour' };
                if (!c.lastPostTime) c.lastPostTime = Date.now();
                if (c.replyToUser === undefined) c.replyToUser = true;
            }); } } catch (e) { console.error("角色数据恢复出错:", e); }
            try { if (parsed.globalPosts) globalPosts = parsed.globalPosts; } catch (e) { console.error(e); }
            try { if (parsed.anonPosts) anonPosts = parsed.anonPosts; } catch (e) { console.error(e); }
            try { if (parsed.characterGroups) characterGroups = parsed.characterGroups; } catch (e) { console.error(e); }
            try { if (parsed.factionColors) factionColors = parsed.factionColors; } catch (e) { console.error(e); }
            try { if (parsed.charRelationships) charRelationships = parsed.charRelationships; } catch (e) { console.error(e); }
            try { if (parsed.relationshipTypePresets) relationshipTypePresets = parsed.relationshipTypePresets; } catch (e) { console.error(e); }
            try { if (parsed.statusTypes) statusTypes = parsed.statusTypes; } catch (e) { console.error(e); }
            try { if (parsed.globalEmoticons) globalEmoticons = parsed.globalEmoticons; } catch (e) { console.error(e); }
            try { if (parsed.worldbooks) worldbooks = parsed.worldbooks; } catch (e) { console.error(e); }
            try { if (parsed.worldbookCategories) worldbookCategories = parsed.worldbookCategories; } catch (e) { console.error(e); }
            try { if (parsed.globalChats) globalChats = parsed.globalChats; } catch (e) { console.error(e); }
            try { if (parsed.groupChats) groupChats = parsed.groupChats; } catch (e) { console.error(e); }
            try { if (parsed.currentUser) { currentUser = { ...currentUser, ...parsed.currentUser }; if (!currentUser.gender) currentUser.gender = "未知"; } } catch (e) { console.error(e); }
            try { if (parsed.tabloidAccount) tabloidAccount = { ...tabloidAccount, ...parsed.tabloidAccount }; } catch (e) { console.error(e); }
            try { if (parsed.trendingTags) trendingTags = parsed.trendingTags; } catch (e) { console.error(e); }
            try { if (parsed.globalNovels) globalNovels = parsed.globalNovels; } catch (e) { console.error(e); }
            try { if (parsed.storySessions) storySessions = parsed.storySessions; } catch (e) { console.error(e); }
            try { if (parsed.novelCustomCSS !== undefined) novelCustomCSS = parsed.novelCustomCSS; } catch (e) { console.error(e); }
            try { if (parsed.globalCustomCSS !== undefined) globalCustomCSS = parsed.globalCustomCSS; } catch (e) { console.error(e); }
            try {
                if (parsed.clickEffectEnabled !== undefined) clickEffectEnabled = parsed.clickEffectEnabled;
                if (parsed.clickEffectStyle) clickEffectStyle = parsed.clickEffectStyle;
                if (parsed.clickEffectCustomImage !== undefined) clickEffectCustomImage = parsed.clickEffectCustomImage;
                if (document.getElementById('clickEffectEnabledInput')) document.getElementById('clickEffectEnabledInput').checked = clickEffectEnabled;
                if (document.getElementById('clickEffectStyleSelect')) document.getElementById('clickEffectStyleSelect').value = clickEffectStyle;
                updateClickEffectCustomPreview();
            } catch (e) { console.error(e); }
            try { if (parsed.tabloidPosts) tabloidPosts = parsed.tabloidPosts; } catch (e) { console.error(e); }
            try { if (parsed.chatVariables) chatVariables = parsed.chatVariables; } catch (e) { console.error(e); }
            try { if (parsed.globalVariables) globalVariables = parsed.globalVariables; } catch (e) { console.error(e); }
            try { if (parsed.mvuStats) mvuStats = parsed.mvuStats; } catch (e) { console.error(e); }
            try { if (parsed.memoryEntries) memoryEntries = parsed.memoryEntries; } catch (e) { console.error(e); }
            try {
                if (Array.isArray(parsed.reasoningFormats)) reasoningFormats = parsed.reasoningFormats;
                if (parsed.reasoningDisplayMode) reasoningDisplayMode = parsed.reasoningDisplayMode;
                if (typeof parsed.reasoningVaultOn === 'boolean') reasoningVaultOn = parsed.reasoningVaultOn;
                if (parsed.statusLogKeepDays !== undefined) statusLogKeepDays = parsed.statusLogKeepDays;
                if (document.getElementById('reasoningVaultToggle')) document.getElementById('reasoningVaultToggle').checked = !!reasoningVaultOn;
                if (typeof renderReasoningFormatsList === 'function') renderReasoningFormatsList();
                if (document.getElementById('reasoningDisplayModeSelect')) document.getElementById('reasoningDisplayModeSelect').value = reasoningDisplayMode;
            } catch (e) { console.error(e); }
            try { if (document.getElementById('globalCSSInput')) document.getElementById('globalCSSInput').value = globalCustomCSS || ''; } catch (e) { console.error(e); }
            try { applyNovelCSS(); } catch (e) { console.error(e); }
            try { if (parsed.forumThreads) forumThreads = parsed.forumThreads; else forumThreads = []; } catch (e) { console.error(e); forumThreads = []; }
        }
    } catch (e) {
        console.error("存档解析读取失败:", e);
        alert("⚠️ 存档数据读取失败！");
    }
}
