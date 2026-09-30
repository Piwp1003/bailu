// ✂️ 这个文件是从 08-diary-novel.js 拆出来的第 2 段（原来一个文件太大，改起来容易改坏）。
// 跟 08-diary-novel.js 以及同一组的其它段共用一个全局作用域，index.html 里的加载顺序不能换。
function renderProfMore(charId) {
    const btn = document.getElementById('profMoreBtn');
    const menu = document.getElementById('profMoreMenu');
    if (!btn || !menu) return;
    const items = (window.GY_PROFILE_MENU || []).filter(x => {
        try { return typeof x.show !== 'function' || x.show(charId); } catch (e) { return false; }
    });
    if (!items.length) { btn.style.display = 'none'; menu.classList.remove('on'); return; }
    btn.style.display = '';
    menu.innerHTML = items.map(x => `<button type="button" onclick="gyProfMenuRun('${x.id}')">
        <span class="pm-i">${x.icon || '·'}</span>
        <span class="pm-b"><b>${escapeHtml(x.label || '')}</b>${x.sub ? `<em>${escapeHtml(x.sub)}</em>` : ''}</span></button>`).join('');
}
window.gyProfMenuRun = function (id) {
    const it = (window.GY_PROFILE_MENU || []).find(x => x.id === id);
    const menu = document.getElementById('profMoreMenu');
    if (menu) menu.classList.remove('on');
    if (it && typeof it.run === 'function') { try { it.run(typeof currentProfileId !== 'undefined' ? currentProfileId : null); } catch (e) {} }
};
/* ⋮ 聊天输入框左边那个 —— 开着的时候点别处就关，跟资料页那个一个脾气 */
window.gyChatMoreToggle = function (ev) {
    if (ev) ev.stopPropagation();
    const m = document.getElementById('chatMoreMenu');
    if (!m) return;
    // 「跟 TA 一起」那一排是按当前聊的是谁现画的（js/28）
    try { if (typeof window.gyChatActsRender === 'function') window.gyChatActsRender(); } catch (e) {}
    m.classList.toggle('on');
    if (m.classList.contains('on')) {
        setTimeout(() => document.addEventListener('click', function off(e) {
            if (m.contains(e.target)) return;          // 在菜单里点东西不算"点别处"
            m.classList.remove('on'); document.removeEventListener('click', off);
        }), 0);
    }
};
window.gyProfMoreToggle = function (ev) {
    if (ev) ev.stopPropagation();
    const menu = document.getElementById('profMoreMenu');
    if (!menu) return;
    menu.classList.toggle('on');
    if (menu.classList.contains('on')) {
        setTimeout(() => document.addEventListener('click', function off() {
            menu.classList.remove('on'); document.removeEventListener('click', off);
        }), 0);
    }
};

function renderProfilePage(charId) {
    currentProfileId = charId; currentProfileTab = 'posts'; document.querySelectorAll('#view-profile .top-tabs .tab').forEach(el => el.classList.remove('active')); document.getElementById('prof-tab-posts').classList.add('active');
    let char = charId === 'me' ? currentUser : (charId === 'tabloid_admin' ? tabloidAccount : myCharacters.find(c => c.id == charId)); if (!char) return;
    let charPosts = charId === 'tabloid_admin' ? tabloidPosts : globalPosts.filter(p => p.char.id == charId); document.getElementById('profHeadName').innerHTML = `${char.name} ${char.verified ? verifiedSVG : ''}`; document.getElementById('profHeadPosts').innerText = `${charPosts.length} 帖子`;
    let bgStyle = char.bgImg ? `background-image:url('${char.bgImg}'); background-size:cover; background-position:center;` : `background-color:${char.themeColor || '#f0f8ff'};`;
    document.getElementById('profBanner').style.cssText = bgStyle; document.getElementById('profAvatarWrap').innerHTML = getAvatarHTML(char, 134, 'profile-avatar-large');
    let btn = document.getElementById('profFollowBtn');
    let chatBtn = document.getElementById('profChatBtn');
    if (charId === 'me') { btn.style.display = 'none'; } else { btn.style.display = 'block'; btn.className = char.isFollowing ? `follow-btn following btn-follow-${char.id}` : `follow-btn btn-follow-${char.id}`; btn.innerText = char.isFollowing ? "已关注" : "关注"; btn.onclick = (e) => { if(typeof toggleFollow === 'function') toggleFollow(char.id, e); }; }
    if (chatBtn) { chatBtn.style.display = (charId !== 'me' && charId !== 'tabloid_admin' && myCharacters.some(c => c.id == charId)) ? 'block' : 'none'; }
    // 📅 纪念日那颗按钮已经收进右上角的 ⋮ 里了（见 GY_PROFILE_MENU / renderProfMore）
    try { renderProfMore(charId); } catch (e) {}
    const highlightsTab = document.getElementById('prof-tab-highlights');
    if (highlightsTab) { highlightsTab.style.display = (charId === 'tabloid_admin') ? 'none' : 'block'; }
    document.getElementById('profName').innerHTML = `${char.name} ${char.verified ? verifiedSVG : ''} ${char.isSpecialFollow ? '<span class="special-star"><svg class="blue-line-icon" viewBox="0 0 24 24" style="width:16px;height:16px;vertical-align:middle;margin-top:-2px;"><polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8 12 2"></polygon></svg></span>' : ''}`;
    document.getElementById('profHandle').innerText = char.handle; document.getElementById('profBio').innerText = char.bio || char.persona || "暂无签名";
    // 🕘 过往签名（js/58）：换过签名才出现
    try {
        const bh = (char.bioHistory || []);
        let bhEl = document.getElementById('profBioHist');
        if (!bhEl) { bhEl = document.createElement('div'); bhEl.id = 'profBioHist'; bhEl.style.cssText = 'margin-top:4px;font-size:12.5px;'; document.getElementById('profBio').insertAdjacentElement('afterend', bhEl); }
        bhEl.innerHTML = bh.length ? `<span style="color:var(--gy-accent,#1d9bf0);cursor:pointer;" onclick="gyBioHistory('${char.id}')">🕘 过往签名（${bh.length}）</span>` : '';
    } catch (e) {}
    // v109：各模块往资料页上挂的东西（钱包卡…）。谁想加就往 GY_PROFILE_BLOCKS 里塞一个函数，
    // 返回 html 字符串就行；返回空就当没有。不用每个模块各自去 patch renderProfilePage。
    try {
        const extra = document.getElementById('profExtra');
        if (extra) {
            extra.innerHTML = (window.GY_PROFILE_BLOCKS || []).map(f => {
                try { return f(charId) || ''; } catch (e) { return ''; }
            }).join('');
        }
    } catch (e) {}
    const locEl = document.getElementById('profLocation'); if (char.location) { locEl.style.display = 'flex'; locEl.innerHTML = `${locationSVG}<span>${char.location}</span>`; } else { locEl.style.display = 'none'; locEl.innerHTML = ''; }
    const webEl = document.getElementById('profWebsite'); if (char.website) { webEl.style.display = 'flex'; webEl.innerHTML = `${websiteSVG}<a href="#" style="color:#1d9bf0; text-decoration:none;">${char.website.replace(/^https?:\/\//, '')}</a>`; } else { webEl.style.display = 'none'; webEl.innerHTML = ''; }
    document.getElementById('profBirthdate').innerText = char.birthdate ? char.birthdate.substring(0, 4) + "年" : "未知时间";
    document.getElementById('profFollowing').innerText = char.following || 0; document.getElementById('profFollowers').innerText = char.followers || 0;
    renderProfileFeed();
}
function renderProfileFeed() {
    const container = document.getElementById('profileFeedSection'); let postsToShow = [];
    if (currentProfileId === 'tabloid_admin') { postsToShow = tabloidPosts; }
    else if (currentProfileTab === 'posts') postsToShow = globalPosts.filter(p => p.char.id == currentProfileId);
    else if (currentProfileTab === 'replies') postsToShow = globalPosts.filter(p => p.replies && p.replies.some(r => r.char.id == currentProfileId));
    else if (currentProfileTab === 'highlights') { renderMemoryAlbum(); return; }
    
    // === 核心改造：赞过 混排渲染面板 ===
    else if (currentProfileTab === 'media') {
        let items = [];
        
        // 1. 抓取该用户/角色点赞过的所有主帖子
        globalPosts.forEach(p => {
            if ((p.likedBy && p.likedBy.includes(currentProfileId)) || (currentProfileId === 'me' && p.userLiked)) {
                items.push({ type: 'post', data: p, timestamp: p.timestamp });
            }
        });
        
        // 2. 抓取该用户/角色点赞过的所有评论楼层
        globalPosts.forEach(p => {
            if (p.replies) {
                p.replies.forEach(r => {
                    if ((r.likedBy && r.likedBy.includes(currentProfileId)) || (currentProfileId === 'me' && r.liked)) {
                        items.push({ type: 'reply', data: r, postId: p.id, postText: p.text, postChar: p.char, timestamp: r.timestamp });
                    }
                });
            }
        });
        
        // 3. 混合后按时间由新到旧（倒序）排列
        items.sort((a, b) => b.timestamp - a.timestamp);
        
        if (items.length === 0) {
            container.innerHTML = `<div class="empty-state">还没有点赞过任何内容</div>`;
            return;
        }
        
        let currentProfileChar = currentProfileId === 'me' ? currentUser : (currentProfileId === 'tabloid_admin' ? tabloidAccount : myCharacters.find(c => c.id == currentProfileId));
        let profileName = currentProfileChar ? currentProfileChar.name : '该用户';

        // 4. 高级渲染视图布局
        container.innerHTML = items.map(item => {
            if (item.type === 'post') {
                return `
                <div class="liked-badge-header" style="padding: 10px 16px 0 52px; font-size: 13px; color: #536471; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                    <svg style="width:14px; height:14px; fill:#f91880;" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    <span>${profileName} 赞了该推文</span>
                </div>
                ` + generatePostHTML([item.data]);
            } else {
                let r = item.data;
                let rChar = r.char || (typeof getNpcIdentity === 'function' ? getNpcIdentity(r.name || '网友') : { name: r.name || '网友', handle: '@npc_user', avatarEmoji: '👤' });
                return `
                <div class="liked-comment-card" onclick="switchMainView('postDetail', '${item.postId}')" style="padding: 16px; border-bottom: 1px solid #eff3f4; cursor: pointer; transition: 0.2s; display: flex; flex-direction: column; gap: 4px;">
                    <div class="liked-badge-header" style="font-size: 13px; color: #536471; font-weight: bold; display: flex; align-items: center; gap: 4px; margin-bottom: 4px; padding-left: 40px;">
                        <svg style="width:14px; height:14px; fill:#f91880;" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        <span>${profileName} 赞了该回复</span>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <div>${getAvatarHTML(rChar, 40)}</div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 6px; font-size: 14px; color: #536471;">
                                <span style="font-weight: bold; color: #0f1419;">${rChar.name}</span>
                                <span>${rChar.handle || ''}</span>
                                <span>·</span>
                                <span>${timeAgo(item.timestamp)}</span>
                            </div>
                            <div style="font-size: 16px; color: #0f1419; margin-top: 4px; line-height: 1.5; white-space: pre-wrap; word-break: break-all;">
                                ${r.replyTo ? `<span style="color:#1d9bf0;">回复 @${r.replyTo} </span>` : ''}${formatPostText(r.text, r.charId || (r.char && r.char.id, { statusContext: 'comment' }) || null)}
                            </div>
                            <div style="margin-top: 8px; font-size: 13px; color: #536471; background: rgba(0,0,0,0.03); padding: 8px 12px; border-radius: 8px; border-left: 3px solid #cfd9de; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                                来自 @${item.postChar.name} 的推文: "${item.postText.substring(0, 45)}..."
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }
        }).join('');
        if (typeof enableChatScriptExecution !== 'undefined' && enableChatScriptExecution) { try { executeInjectedScripts(container); } catch (e) { console.error('执行"赞过"面板注入脚本时出错：', e); } }
        return;
    }
    // === 混排结束 ===

    if (postsToShow.length === 0) { 
        container.innerHTML = `<div class="empty-state">这里空空如也</div>`; 
        return; 
    }
    if(typeof generatePostHTML === 'function') {
        container.innerHTML = generatePostHTML(postsToShow);
        if (typeof enableChatScriptExecution !== 'undefined' && enableChatScriptExecution) { try { executeInjectedScripts(container); } catch (e) { console.error('执行主页资料流注入脚本时出错：', e); } }
    }
}

// ===== 「关注」页（v108，照 X 的名单排法重做）=====
// 两个页签：我关注的 / 为你推荐（还没关注的）。
// 一行一个人：头像 · 名字（＋蓝V＋星标）· @账号 · 右边关注键，简介在下面单独一行、
// 跟名字左对齐。以前是横着滚的一排卡片，一屏看不见几个人，简介也没地方放。
let followTab = 'mine';
function setFollowTab(t) {
    followTab = (t === 'sug') ? 'sug' : 'mine';
    const a = document.getElementById('flTabMine'), b = document.getElementById('flTabSug');
    if (a) a.className = 'fl-tab' + (followTab === 'mine' ? ' on' : '');
    if (b) b.className = 'fl-tab' + (followTab === 'sug' ? ' on' : '');
    renderFollowingList();
}
// 简介优先用 bio；没写 bio 就从人设里截一段——总比一片空白强
function followBioText(char) {
    let t = (char.bio || '').trim();
    if (!t) t = (char.persona || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    return t;
}
function renderFollowingList() {
    const container = document.getElementById('followingListContainer');
    if (!container) return; // 防御：容器暂时不在就跳过，别抛错卡住整个渲染
    const all = (myCharacters || []).filter(c => c && c.id && c.id !== 'me');
    let list;
    if (followTab === 'sug') {
        list = all.filter(c => !c.isFollowing);
        if (list.length === 0) {
            container.innerHTML = `<div class="empty-state">没有可推荐的了——角色中心里的人你都关注过了。</div>`;
            return;
        }
    } else {
        list = all.filter(c => c.isFollowing)
                  .sort((a, b) => (b.isSpecialFollow ? 1 : 0) - (a.isSpecialFollow ? 1 : 0));
        if (list.length === 0) {
            container.innerHTML = `<div class="empty-state">还没有关注任何人。点上面的「为你推荐」挑几个。</div>`;
            return;
        }
    }
    // 逐条渲染：单个角色数据坏了只跳过那一条，不会让整份名单不刷新
    container.innerHTML = list.map(char => {
        try {
            const star = char.isSpecialFollow
                ? '<span class="fl-star" title="特别关注"><svg class="blue-line-icon" viewBox="0 0 24 24" style="width:15px;height:15px;"><polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8 12 2"></polygon></svg></span>' : '';
            const bio = followBioText(char);
            const tags = getCharFactions(char).map(g => `<span class="fl-tag">${escapeHtml(g)}</span>`).join('');
            return `<div class="fl-row" oncontextmenu="showFollowingContextMenu(event, '${char.id}')" onclick="handleFollowingCardClick(event, '${char.id}')">
                <div class="fl-av">${getAvatarHTML(char, 40)}</div>
                <div class="fl-main">
                    <div class="fl-top">
                        <div class="fl-id">
                            <div class="fl-name">${escapeHtml(char.name || '')}${char.verified ? verifiedSVG : ''}${star}</div>
                            <div class="fl-handle">${escapeHtml(char.handle || '')}</div>
                        </div>
                        <button class="${char.isFollowing ? 'follow-btn following' : 'follow-btn'} btn-follow-${char.id}" onclick="toggleFollow('${char.id}', event)">${char.isFollowing ? '已关注' : '关注'}</button>
                    </div>
                    ${bio ? `<div class="fl-bio">${escapeHtml(bio)}</div>` : ''}
                    ${tags ? `<div class="fl-tags">${tags}</div>` : ''}
                </div>
            </div>`;
        } catch (e) {
            console.error('渲染关注名单某一条时出错，已跳过：', char && char.id, e);
            return '';
        }
    }).join('');
}

// ===== 右侧「你可能会喜欢」（仿 X 的推荐位）=====
// 只在个人资料页出现，挂在「有什么新鲜事」下面，不占额外宽度，页面尺寸不变。
// 挑的是**还没关注**的角色（关注完这一条就从列表里消失，跟 X 的行为一致）；
// 没关注的都关完了，就退回从全部角色里随机挑，免得这块永远空着。
// forceNew=true 是点「换一批」，会重新洗牌；否则同一次进页面保持稳定，不会每次重绘都跳来跳去。
let suggestedCharIds = [];
function pickSuggestedChars(n) {
    // 正在看谁的主页，就不要再推荐谁了（X 也是这个行为）。
    // 已关注的也照样进池子——这块现在更像"随机逛逛角色"，不只是"拉新关注"，
    // 已关注的会显示成「已关注」按钮，点一下可以取消关注。
    const pool = (myCharacters || []).filter(c => c && c.id && c.id !== 'me' && String(c.id) !== String(currentProfileId));
    // Fisher–Yates 洗牌，取前 n 个
    const arr = pool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, n).map(c => c.id);
}
function renderSuggestedChars(forceNew) {
    const card = document.getElementById('rightPanelSuggest');
    const box = document.getElementById('suggestListContainer');
    if (!card || !box) return;
    if (forceNew || suggestedCharIds.length === 0) suggestedCharIds = pickSuggestedChars(3);
    // 只剔掉"已经不存在"和"正在看他主页"的，关注状态不再影响去留——
    // 关注完那一条会原地变成「已关注」，不会突然消失换一个人上来（那样点着很跳）
    suggestedCharIds = suggestedCharIds.filter(id => {
        const c = (myCharacters || []).find(x => x.id == id);
        return c && String(c.id) !== String(currentProfileId);
    });
    if (suggestedCharIds.length < 3) {
        pickSuggestedChars(6).forEach(id => {
            if (suggestedCharIds.length < 3 && suggestedCharIds.indexOf(id) === -1) suggestedCharIds.push(id);
        });
    }
    const list = suggestedCharIds.map(id => (myCharacters || []).find(c => c.id == id)).filter(Boolean);
    if (list.length === 0) { card.style.display = 'none'; return; }
    box.innerHTML = list.map(char => {
        try {
            const followed = !!char.isFollowing;
            return `<div class="suggest-row" onclick="switchMainView('profile', '${char.id}')">
                ${getAvatarHTML(char, 40)}
                <div class="suggest-meta">
                    <div class="suggest-name">${escapeHtml(char.name || '')}${char.verified ? verifiedSVG : ''}</div>
                    <div class="suggest-handle">${escapeHtml(char.handle || '')}</div>
                </div>
                <button class="follow-btn${followed ? ' following' : ''} btn-follow-${char.id} suggest-follow"
                        onclick="event.stopPropagation(); toggleFollow('${char.id}', event); renderSuggestedChars();">${followed ? '已关注' : '关注'}</button>
            </div>`;
        } catch (e) { console.error('渲染推荐角色某一条时出错，已跳过：', char && char.id, e); return ''; }
    }).join('');
    card.style.display = 'block';
}

// ===== 🎭 「Ta们在做什么」页面 =====
// 数据是 js/14 的小剧场引擎存下来的 globalTheaterLogs，这里只负责显示。
function renderTheaterPage(resetFilter) {
    const list = document.getElementById('theaterLogList');
    const sel = document.getElementById('theaterFilterChar');
    if (!list) return;
    const logs = (typeof globalTheaterLogs !== 'undefined' && Array.isArray(globalTheaterLogs)) ? globalTheaterLogs : [];

    // 筛选下拉：只列出真的在记录里出现过的角色，避免一长串跟这里无关的名字
    if (sel) {
        const cur = resetFilter ? '' : sel.value;
        const ids = [];
        logs.forEach(l => { [[l.charAId, l.charAName], [l.charBId, l.charBName]].forEach(([id, nm]) => {
            if (id != null && !ids.some(x => String(x[0]) === String(id))) ids.push([id, nm]);
        }); });
        sel.innerHTML = '<option value="">全部角色</option>'
            + ids.map(([id, nm]) => `<option value="${id}">${escapeHtml(nm || '未知')}</option>`).join('');
        sel.value = ids.some(x => String(x[0]) === String(cur)) ? cur : '';
    }
    // 开关关着的时候，页面顶部直接说明——比让用户点了「现在演一场」才发现要好
    let offHtml = '';
    const thOn = (typeof isAutoOn === 'function') ? isAutoOn('charTheater') : true;
    const interOn = (typeof isGlobalCharInteractionEnabled === 'function') ? isGlobalCharInteractionEnabled() : true;
    // 前置条件统一列出来（缺什么列什么，都满足就什么都不显示）
    offHtml = (typeof gyReqBox === 'function') ? gyReqBox([
        { api: true }, { interaction: true }, { rel: true }
    ], { title: '「现在演一场」需要先满足这些' }) : '';
    if (interOn && !thOn) {
        // 开关关着 ≠ 不能看：手动点「现在演一场」照样能演，开关只管"会不会自己发生"
        offHtml += `<div class="theater-off-banner">💤 自动演出是关着的，TA 们不会自己演。<br>想看的话直接点上面的「🎬 现在演一场」——<b>手动点不受开关限制</b>。<span class="theater-off-link" onclick="gyJumpToSwitch('charTheater')">要让它自己演 ›</span></div>`;
    }
    const filter = sel ? sel.value : '';
    const shown = (filter ? logs.filter(l => String(l.charAId) === String(filter) || String(l.charBId) === String(filter)) : logs)
        .slice().sort((a, b) => (b.at || 0) - (a.at || 0));

    if (shown.length === 0) {
        list.innerHTML = offHtml + `<div class="empty-state">还没有记录。<br>小剧场需要角色之间<b>先有关系</b>才会发生——去「关系网」给两个角色连一条线，把开关打开，然后等它自己触发，或者点上面的「🎬 现在演一场」。</div>`;
        return;
    }
    // 角色各自的记忆摘要（如果已经总结过），放在最上面
    let memoHtml = '';
    if (filter) {
        const c = (myCharacters || []).find(x => String(x.id) === String(filter));
        if (c && c.theaterMemory) {
            memoHtml = `<div class="theater-memo"><div class="theater-memo-title">🧠 ${escapeHtml(c.name)} 自己记住的部分</div>
                <div>${escapeHtml(c.theaterMemory)}</div>
                <div class="theater-memo-hint">这段会跟着 TA 进聊天/发推/评论/日记信件/论坛，所以 TA 可能会主动提起。</div></div>`;
        }
    }
    list.innerHTML = offHtml + memoHtml + shown.map(l => `
        <div class="theater-card">
            <div class="theater-card-head">
                <span class="theater-who">${escapeHtml(l.charAName || '?')} <span class="theater-rel">×</span> ${escapeHtml(l.charBName || '?')}</span>
                <span class="theater-time">${new Date(l.at).toLocaleString('zh-CN', { hour12: false })}</span>
            </div>
            <div class="theater-summary">${escapeHtml(l.summary || '')}${l.relation ? `<span class="theater-rel-tag">${escapeHtml(l.relation)}</span>` : ''}</div>
            ${l.scene ? `<div class="theater-scene" style="white-space:pre-wrap;">${escapeHtml(l.scene)}</div>` : ''}
            ${(l.statusA || l.statusB) ? `<div class="theater-status">
                <span><i class="gy-dot" style="background:#1d9bf0;"></i>${escapeHtml(l.charAName || '')}：${escapeHtml(l.statusA || '')}</span>
                <span><i class="gy-dot" style="background:#f91880;"></i>${escapeHtml(l.charBName || '')}：${escapeHtml(l.statusB || '')}</span>
            </div>` : ''}
        </div>`).join('');
}
async function manualRunTheater() {
    if (typeof runTheaterScene !== 'function') return;
    const btn = event && event.currentTarget;
    const old = btn ? btn.innerText : '';
    if (btn) { btn.innerText = '正在演...'; btn.disabled = true; }
    try {
        const r = await runTheaterScene(true);
        // runTheaterScene 会在被开关拦下时返回 {blocked:'...'}，这里把具体原因说清楚，
        // 不然用户点了没反应会以为是坏了，实际上是自己没开开关（这功能默认关，绝不偷偷调 API）。
        if (r && r.blocked === 'switch') {
            // 手动点现在不会再被开关拦（runTheaterScene 只在 manual=false 时看开关），这条留着兜底
            if (typeof appAlert === 'function') appAlert('这次被开关拦下了。去「设置 → ⚙️ 自动化功能」看一下「🎭 Ta们在做什么」。');
        } else if (r && r.blocked === 'interaction') {
            if (typeof appAlert === 'function') appAlert('「角色互动总开关」是关着的，角色之间不会有任何互动。\n\n去设置里把角色互动打开再试。');
        } else if (!r) {
            if (typeof appAlert === 'function') appAlert('这次没能演出来。可能是：还没给任何两个角色连过关系（去「关系网」连一条），或者 API 没配好 / 这次请求出错了。');
        }
    } finally {
        if (btn) { btn.innerText = old; btn.disabled = false; }
    }
    renderTheaterPage();
}
// 🎲 行为模式切换时的界面反馈：选了「自己决定」才露出间隔设置，
// 并且把"这会影响哪些原来的设置"直说，避免用户以为下面那堆频率还照旧生效。
function onCharActModeChange() {
    const sel = document.getElementById('charActMode');
    const row = document.getElementById('charAutonomyFreqRow');
    const hint = document.getElementById('charActModeHint');
    if (!sel) return;
    const auto = sel.value === 'auto';
    if (row) row.style.display = auto ? 'block' : 'none';
    if (hint) {
        hint.innerHTML = auto
            ? `由 TA 自己决定：每隔一段时间，TA 会看一眼现在几点、今天日程排了什么、待办上还欠着什么、前几天跟谁发生过什么、跟你聊到哪儿了，然后自己挑<b>一件</b>事去做——发推文 / 私聊你 / 写信 / 写日记 / 发论坛帖 / 发匿名帖 / 评论别人 / 点个赞 / 拍你一下 / 换个状态 / 办掉一条待办 / 记一件新的 / 去找关系网里的人 / 给营销号递料 / 什么都不做。<br>
               <b>连"隔多久做一次"也是 TA 自己定的</b>：每做完一件事，TA 会顺便决定"我大概多久之后会再想起点什么"——正忙着就隔久点，等着谁回话就隔短点，所以是忽长忽短的，不会像闹钟一样准时。下面那两个数字只是给这个随机数划个范围。<br>
               <b style="color:#e0245e;">这个模式整体默认关着</b>，还要去「设置 → 🔌 自动功能开关」把「角色自己决定要做什么」打开才会真的跑。下面那些固定频率在这个模式下不再各自到点触发。`
            : `按固定频率：到点了就发推文 / 主动找你 / 写信，各走各的时间表。`;
    }
}

// 手动让某个角色现在就自己拿一次主意（资料页/开关面板上的按钮用）
async function manualAutonomyTurn(charId) {
    const char = myCharacters.find(c => c.id == (charId != null ? charId : currentProfileId));
    if (!char) return;
    const btn = (typeof event !== 'undefined' && event) ? event.currentTarget : null;
    const old = btn ? btn.innerText : '';
    if (btn) { btn.innerText = '正在想…'; btn.disabled = true; }
    try {
        const r = await runAutonomyTurn(char, true);
        if (r && r.blocked === 'switch') {
            appAlert('这次被开关拦下了。去「设置 → ⚙️ 自动化功能」看一下「角色自己决定要做什么」。');
        } else if (r && r.blocked === 'mode') {
            appAlert(`${char.name} 现在是「按固定频率」模式。\n\n去 TA 的编辑页里，「行为与AI能力设置 → 🎲 行为模式」改成「由 TA 自己决定」。`);
        } else if (r && r.blocked === 'api') {
            appAlert('还没配置 API Key。');
        } else if (r && r.blocked === 'busy') {
            appAlert('已经有一个角色正在拿主意了，等这一个完事再点。');
        } else if (r && r.blocked) {
            appAlert('这次没能进行：' + (r.raw ? `模型返回了看不懂的内容（${r.raw}）` : r.blocked));
        } else if (r && r.entry) {
            const e = r.entry;
            const all = (r.entries && r.entries.length) ? r.entries : [e];
            const title = e.action === 'nothing' ? '想了想，没做什么' : e.action === 'later' ? '打算等会儿再做' : (all.length > 1 ? `一口气做了 ${all.length} 件事` : '自己做了件事');
            const body = e.action === 'later' ? `${e.reason}${e.result ? ' —— ' + e.result : ''}`
                : all.map(x => `${x.result || x.label}${x.reason ? ` —— ${x.reason}` : ''}`).join('；') + (r.queued ? `（还有 ${r.queued} 件打算等会儿做）` : '');
            showToast(getAvatarHTML(char, 40), `${char.name} ${title}`, body, null, null, false);
        }
    } finally {
        if (btn) { btn.innerText = old; btn.disabled = false; }
    }
    if (typeof renderTheaterPage === 'function'
        && document.getElementById('view-theater')?.style.display !== 'none') renderTheaterPage();
}

// 「Ta们在做什么」页的第二个标签：TA 自己决定做过的事
let theaterTab = 'scene';
function switchTheaterTab(tab) {
    theaterTab = tab;
    ['scene', 'auto'].forEach(t => {
        const el = document.getElementById('theaterTab-' + t);
        if (el) el.className = 'tab' + (t === tab ? ' active' : '');
    });
    const sceneBox = document.getElementById('theaterSceneBox');
    const autoBox = document.getElementById('theaterAutoBox');
    if (sceneBox) sceneBox.style.display = tab === 'scene' ? 'block' : 'none';
    if (autoBox) autoBox.style.display = tab === 'auto' ? 'block' : 'none';
    if (tab === 'auto') renderAutonomyPage();
}

const GY_AUTONOMY_ICONS = {
    post: '🐦', chat: '💬', letter: '✉️', diary: '📔', forum: '📋', anon: '🤐',
    comment: '💭', like: '❤️', nudge: '👋', status: '🔄', todo_done: '✅',
    todo_add: '📝', theater: '🎭', tabloid: '📰', nothing: '💤'
};
function renderAutonomyPage() {
    const box = document.getElementById('autonomyLogList');
    if (!box) return;
    const autoChars = (myCharacters || []).filter(c => c.actMode === 'auto');
    const on = (typeof isAutoOn === 'function') ? isAutoOn('charAutonomy') : true;

    let head = '';
    if (!on) {
        head += `<div class="theater-off-banner">⚠️ 「角色自己决定要做什么」开关是关着的，不会调用 API。<br>去「设置 → 🔌 自动功能开关」打开它。</div>`;
    }
    if (autoChars.length === 0) {
        head += `<div class="theater-off-banner" style="border-color:#ffad1f; background:rgba(255,173,31,0.07); color:#a56a00;">
            还没有任何角色切到「由 TA 自己决定」。<br>去角色编辑页 →「⚙️ 行为与AI能力设置」→「🎲 行为模式」里改。</div>`;
    } else {
        head += `<div class="autonomy-who">现在自己拿主意的：${autoChars.map(c => {
            // 下次时间是 TA 自己定的，显示出来才知道"是真没到点"而不是"坏了"
            let when = '还没定';
            if (c.nextAutonomyAt) {
                const left = c.nextAutonomyAt - Date.now();
                if (left <= 0) when = '随时';
                else if (left < 3600000) when = `约 ${Math.max(1, Math.round(left / 60000))} 分钟后`;
                else when = `约 ${(left / 3600000).toFixed(1)} 小时后`;
            }
            return `<span class="autonomy-who-chip">${escapeHtml(c.name)}
             <span class="autonomy-next">${when}</span>
             <button type="button" onclick="manualAutonomyTurn('${c.id}')">现在想一下</button></span>`;
        }).join('')}</div>`;
    }

    const all = [];
    (myCharacters || []).forEach(c => (c.autonomyLog || []).forEach(l => all.push({ ...l, charName: l.charName || c.name, _c: c })));
    all.sort((a, b) => (b.at || 0) - (a.at || 0));
    if (all.length === 0) {
        box.innerHTML = head + `<div class="empty-state">还没有记录。<br>把某个角色切到「由 TA 自己决定」、把开关打开，然后等 TA 自己动，或者点上面的「现在想一下」。</div>`;
        return;
    }
    box.innerHTML = head + all.slice(0, 120).map(l => `
        <div class="theater-card autonomy-card${l.action === 'nothing' ? ' quiet' : ''}">
            <div class="theater-card-head">
                <span class="theater-who">${GY_AUTONOMY_ICONS[l.action] || '·'} ${escapeHtml(l.charName || '?')}</span>
                <span class="theater-time">${new Date(l.at).toLocaleString('zh-CN', { hour12: false })}</span>
            </div>
            <div class="theater-summary">${escapeHtml(l.result || l.label || '')}${l.ok ? '' : `<span class="theater-rel-tag" style="background:rgba(249,24,128,0.1); color:#f91880;">没做成</span>`}</div>
            ${l.reason ? `<div class="autonomy-reason">TA 的理由：${escapeHtml(l.reason)}</div>` : ''}
            ${l.nextIn ? `<div class="autonomy-reason">做完之后 TA 自己定的下一次：约 ${l.nextIn} 分钟后</div>` : ''}
        </div>`).join('');
}
async function clearAutonomyLogs() {
    if (!(await appConfirm('清空所有「TA 自己决定」的记录？\n\n只是清掉这个列表，已经发出去的推文/消息/日记都还在。'))) return;
    (myCharacters || []).forEach(c => { c.autonomyLog = []; });
    saveAllData();
    renderAutonomyPage();
}

async function clearTheaterLogs() {
    if (typeof appConfirm === 'function' && !(await appConfirm('清空所有小剧场记录？\n\n角色已经总结进记忆里的那部分不会跟着删（那是他们"记得"的东西），只是这个列表清空。'))) return;
    globalTheaterLogs = [];
    if (typeof saveAllData === 'function') saveAllData();
    renderTheaterPage(true);
}

// ===== 🔌 自动功能开关面板 =====
// 定义在 js/01 的 AUTO_FEATURE_DEFS，这里只负责画出来 + 存开关状态。
// 开关说明里写了 **重点**，以前是 escapeHtml 完直接塞进去，页面上就露出一串星号。
// 先转义再把成对的 ** 变成 <b>，既不会被注入也能正常加粗。
function autoFeatText(s) {
    return escapeHtml(String(s || '')).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

let autoFeatFilter = 'all';        // all | on | off
function setAutoFeatFilter(v) { autoFeatFilter = v; renderAutoFeatureList(); }

// 整组一起开 / 关，省得一个一个点
function toggleAutoGroup(gkey, on) {
    (AUTO_FEATURE_DEFS || []).filter(f => f.group === gkey).forEach(f => {
        if (typeof setAutoFeature === 'function') setAutoFeature(f.key, on, true);   // true = 不逐条弹 toast
    });
    if (typeof showToast === 'function') {
        const g = (AUTO_FEATURE_GROUPS || []).find(x => x.key === gkey);
        showToast('', on ? '✅ 整组已开' : '🔌 整组已关', `${g ? g.icon + ' ' + g.title : gkey} 下面所有开关`, null, null, false);
    }
    renderAutoFeatureList();
}

function renderAutoFeatureList() {
    const box = document.getElementById('autoFeatureList');
    if (!box || typeof AUTO_FEATURE_DEFS === 'undefined') return;
    const groups = (typeof AUTO_FEATURE_GROUPS !== 'undefined') ? AUTO_FEATURE_GROUPS : [];
    const isOn = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : true;

    const total = AUTO_FEATURE_DEFS.length;
    const onCount = AUTO_FEATURE_DEFS.filter(f => isOn(f.key)).length;

    const chip = (v, txt) => `<span onclick="setAutoFeatFilter('${v}')" style="cursor:pointer; user-select:none; font-size:12px; padding:5px 12px; border-radius:999px; border:1px solid ${autoFeatFilter === v ? '#1d9bf0' : '#cfd9de'}; background:${autoFeatFilter === v ? 'rgba(29,155,240,0.12)' : 'transparent'}; color:${autoFeatFilter === v ? '#1d9bf0' : '#536471'};">${txt}</span>`;

    let html = `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
        <span style="font-size:12px; color:#8b98a5; margin-right:2px;">一共 ${total} 项，开着 <b style="color:#1d9bf0;">${onCount}</b> 项</span>
        ${chip('all', '全部')}${chip('on', '只看开着的')}${chip('off', '只看关着的')}
    </div>`;

    // 没归到任何一组的（以后新增忘了写 group 也不会凭空消失）
    const known = new Set(groups.map(g => g.key));
    const buckets = groups.map(g => ({ g, items: AUTO_FEATURE_DEFS.filter(f => f.group === g.key) }));
    const orphan = AUTO_FEATURE_DEFS.filter(f => !known.has(f.group));
    if (orphan.length) buckets.push({ g: { icon: '🔧', title: '其它', note: '' }, items: orphan });

    buckets.forEach(({ g, items }) => {
        if (!items.length) return;
        const gOn = items.filter(f => isOn(f.key)).length;
        const shown = items.filter(f => autoFeatFilter === 'all' || (autoFeatFilter === 'on') === isOn(f.key));
        if (!shown.length) return;
        html += `<div style="margin:20px 0 0;">
            <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; padding-bottom:6px; border-bottom:2px solid #1d9bf0;">
                <b style="font-size:14.5px; color:inherit;">${g.icon} ${escapeHtml(g.title)}</b>
                <span style="font-size:11.5px; color:#8b98a5;">${gOn}/${items.length} 开着</span>
                <span style="flex:1;"></span>
                ${g.key ? `<span onclick="toggleAutoGroup('${g.key}', true)" style="cursor:pointer; font-size:11.5px; color:#1d9bf0;">全开</span>
                <span onclick="toggleAutoGroup('${g.key}', false)" style="cursor:pointer; font-size:11.5px; color:#8b98a5;">全关</span>` : ''}
            </div>
            ${g.note ? `<div style="font-size:12px; color:#536471; line-height:1.7; margin:8px 0 4px;">${autoFeatText(g.note)}</div>` : ''}
        </div>`;
        html += shown.map(f => {
            const on = isOn(f.key);
            return `<label class="auto-feat-row">
                <input type="checkbox" ${on ? 'checked' : ''} onchange="setAutoFeature('${f.key}', this.checked)">
                <div class="auto-feat-body">
                    <div class="auto-feat-title">${escapeHtml(f.label)}${f.defaultOff ? '<span style="font-size:10.5px; color:#8b98a5; font-weight:normal; margin-left:6px; border:1px solid #cfd9de; border-radius:4px; padding:1px 5px;">默认关</span>' : ''}</div>
                    <div class="auto-feat-desc">${autoFeatText(f.desc)}</div>
                    ${f.where ? `<div class="auto-feat-where">📍 ${autoFeatText(f.where)}</div>` : ''}
                    <div class="auto-feat-cost">💰 ${autoFeatText(f.cost)}</div>
                </div>
            </label>`;
        }).join('');
    });

    // 指个路：还有一组开关不在这张表里（它们不调 API，所以不该混进"自动调用"列表）
    html += `<div style="margin-top:22px; padding:12px 14px; background:rgba(29,155,240,0.05); border:1px dashed #cfd9de; border-radius:8px; font-size:12px; color:#536471; line-height:1.8;">
        <b>🔗 另外还有 5 个开关不在这儿</b>——「角色知道自己资料页写了什么 / 属于哪个势力 / 写过的日记 / 今天是什么日子」和「忙碌自动回复」。
        它们<b>一次 API 都不调</b>（只是把你早就填好的内容接进 prompt），所以没放进这张"会自动花钱"的表里，
        在 <span onclick="openSettingsPanel('alive')" style="color:#1d9bf0; cursor:pointer; text-decoration:underline;">设置 → 🫀 活人感 → 🔗 补齐没接上的数据</span> 里。
    </div>`;

    box.innerHTML = html;
}
function setAutoFeature(key, on, quiet) {
    if (typeof autoFeatureSwitches === 'undefined' || !autoFeatureSwitches) autoFeatureSwitches = {};
    // 只把"关掉"记进存档，打开就是删掉这条记录——这样以后新增的自动功能默认都是开着的，
    // 不会因为存档里存着一份老的全量快照而出现"新功能莫名其妙是关着的"
    // 例外：本来就"默认关"的功能（比如小剧场），打开时必须显式存一个 true，
    // 否则删掉记录后 isAutoOn 又会退回 defaultOff，用户点了开关等于没点。
    const def = (typeof AUTO_FEATURE_DEFS !== 'undefined') ? AUTO_FEATURE_DEFS.find(f => f.key === key) : null;
    if (on) {
        if (def && def.defaultOff) autoFeatureSwitches[key] = true;
        else delete autoFeatureSwitches[key];
    } else {
        autoFeatureSwitches[key] = false;
    }
    if (typeof saveAllData === 'function') saveAllData();
    if (!quiet && typeof showToast === 'function' && def) {   // quiet：整组开关时别刷一串 toast
        showToast('', on ? '✅ 已开启' : '🔌 已关闭', `${def.label}${on ? ' 恢复自动运行' : ' 不会再自动调用 API 了'}`, null, null, false);
    }
}

// ===== 📊 Token 用量面板 =====
// 数据来自 js/01 的 recordTokenUsage（服务商真实返回的 usage）。这里只负责把它摊开给人看。
function gyFmtTok(n) {
    n = n || 0;
    if (n >= 100000000) return (n / 100000000).toFixed(2) + ' 亿';
    if (n >= 10000) return (n / 10000).toFixed(1) + ' 万';
    return String(n);
}
function showTokenStats() {
    const box = document.getElementById('tokenStatsBody');
    if (!box) return;
    const st = (typeof gyTokenStats !== 'undefined' && gyTokenStats && gyTokenStats.total) ? gyTokenStats : null;
    if (!st || !st.total.calls) {
        box.innerHTML = `<div class="empty-state">还没有记录。开始用起来之后，这里会按功能列出每一项花了多少 token。</div>`;
        openModal('tokenStatsModal');
        return;
    }
    const t = st.total;
    const sinceStr = st.since ? new Date(st.since).toLocaleString('zh-CN') : '—';
    const cachePct = t.in > 0 ? Math.round(t.cached / t.in * 100) : 0;

    const rows = Object.entries(st.byFeature)
        .map(([name, v]) => ({ name, v, sum: (v.in || 0) + (v.out || 0) }))
        .sort((a, b) => b.sum - a.sum);
    const maxSum = rows.length ? rows[0].sum : 1;
    const grand = rows.reduce((s, r) => s + r.sum, 0) || 1;

    const featureHtml = rows.map(r => {
        const pct = Math.round(r.sum / grand * 100);
        const bar = Math.max(2, Math.round(r.sum / maxSum * 100));
        const est = r.v.estimated ? `<span title="这部分是按字数估算的（服务商没返回用量）" style="color:#e0245e;">·估${r.v.estimated}</span>` : '';
        return `<div style="margin-bottom:10px;">
            <div style="display:flex; align-items:baseline; gap:8px; font-size:13px;">
                <span style="font-weight:bold; color:#0f1419; flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(r.name)}</span>
                <span style="color:#536471; flex:0 0 auto;">${r.v.calls} 次 · 入 ${gyFmtTok(r.v.in)} / 出 ${gyFmtTok(r.v.out)}${est}</span>
                <span style="color:#1d9bf0; font-weight:bold; flex:0 0 auto; width:38px; text-align:right;">${pct}%</span>
            </div>
            <div style="height:6px; background:rgba(29,155,240,0.12); border-radius:3px; margin-top:3px; overflow:hidden;">
                <div style="height:100%; width:${bar}%; background:#1d9bf0;"></div>
            </div>
            <div style="font-size:11px; color:#8b98a5; margin-top:2px;">平均每次 ${gyFmtTok(Math.round(r.sum / Math.max(1, r.v.calls)))} token</div>
        </div>`;
    }).join('');

    const days = Object.keys(st.byDay).sort().slice(-7).reverse();
    const dayHtml = days.map(d => {
        const v = st.byDay[d];
        return `<div style="display:flex; gap:10px; font-size:13px; padding:4px 0; border-bottom:1px dashed rgba(29,155,240,0.15);">
            <span style="flex:0 0 92px; color:#536471;">${d}</span>
            <span style="flex:0 0 70px; color:#536471;">${v.calls} 次</span>
            <span style="flex:1 1 auto; color:#0f1419;">入 ${gyFmtTok(v.in)} · 出 ${gyFmtTok(v.out)}</span>
        </div>`;
    }).join('') || '<div class="empty-state">暂无</div>';

    box.innerHTML = `
        <div style="background:rgba(29,155,240,0.06); border:1px solid #1d9bf0; border-radius:10px; padding:12px; margin-bottom:16px;">
            <div style="display:flex; flex-wrap:wrap; gap:14px 24px;">
                <div><div style="font-size:11px; color:#536471;">总调用</div><div style="font-size:20px; font-weight:bold; color:#1d9bf0;">${t.calls} 次</div></div>
                <div><div style="font-size:11px; color:#536471;">输入</div><div style="font-size:20px; font-weight:bold; color:#1d9bf0;">${gyFmtTok(t.in)}</div></div>
                <div><div style="font-size:11px; color:#536471;">输出</div><div style="font-size:20px; font-weight:bold; color:#1d9bf0;">${gyFmtTok(t.out)}</div></div>
                <div><div style="font-size:11px; color:#536471;">缓存命中</div><div style="font-size:20px; font-weight:bold; color:${cachePct > 0 ? '#00ba7c' : '#536471'};">${cachePct}%</div></div>
            </div>
            <div style="font-size:11px; color:#536471; margin-top:8px;">统计起点：${sinceStr}</div>
            ${cachePct === 0 ? `<div style="font-size:12px; color:#536471; margin-top:6px;">💡 缓存命中还是 0：可能是这家服务商不返回缓存字段，也可能是每次请求间隔太久（缓存一般只保留几分钟）。输入里能被缓存的那部分越大越省钱。</div>` : ''}
        </div>
        <div style="font-size:15px; font-weight:bold; color:#1d9bf0; margin-bottom:10px;">按功能</div>
        ${featureHtml}
        <div style="font-size:15px; font-weight:bold; color:#1d9bf0; margin:18px 0 6px;">最近 7 天</div>
        ${dayHtml}`;
    openModal('tokenStatsModal');
}
async function resetTokenStats() {
    if (typeof appConfirm === 'function' && !(await appConfirm('把 Token 统计清零重新开始记？已经花掉的钱不会因此退回来，只是这份记录归零。'))) return;
    gyTokenStats = { total: { calls: 0, in: 0, out: 0, cached: 0, estimated: 0 }, byFeature: {}, byDay: {}, since: Date.now() };
    if (typeof saveAllData === 'function') saveAllData();
    showTokenStats();
}

function renderPosts(filterTag = null) {
    const container = filterTag ? document.getElementById('tagFeedSection') : document.getElementById('feedSection');
    let postsToShow = filterTag ? globalPosts.filter(p => p.text.includes(filterTag)) : (homeTab === 'following' ? globalPosts.filter(p => p.char.id !== 'me' && myCharacters.find(c=>c.id==p.char.id)?.isFollowing) : globalPosts);
    if (postsToShow.length === 0) { container.innerHTML = `<div class="empty-state">这里空空如也...</div>`; return; }
    container.innerHTML = generatePostHTML(postsToShow);
    if (typeof enableChatScriptExecution !== 'undefined' && enableChatScriptExecution) { try { executeInjectedScripts(container); } catch (e) { console.error('执行首页信息流注入脚本时出错：', e); } }
}

// ===== "用已有内容生成小说"：从续写/日记信件/聊天/推文/评论/记忆里自选内容，AI总结改写成一章 =====

function openNovelSourceSummaryModal() {
    const novel = globalNovels.find(n => n.id === currentEditingNovelId);
    if (!novel) return;
    // 每次打开都清空上次的勾选，避免"以为没选，其实还带着上次残留的选择"这种误操作
    novelSourceSelection = { continuation: new Set(), diary: new Set(), chat: new Set(), tweet: new Set(), comment: new Set(), memory: new Set() };
    ['Continuation', 'Diary', 'Chat', 'Tweet', 'Comment', 'Memory'].forEach(suffix => {
        const cb = document.getElementById('srcCat' + suffix);
        if (cb) cb.checked = false;
        const list = document.getElementById('srcList' + suffix);
        if (list) { list.classList.remove('open'); list.innerHTML = ''; }
    });
    const extraEl = document.getElementById('novelSourceExtraInstruction');
    if (extraEl) extraEl.value = '';
    openModal('novelSourceSummaryModal');
}

const NOVEL_SRC_CAT_SUFFIX = { continuation: 'Continuation', diary: 'Diary', chat: 'Chat', tweet: 'Tweet', comment: 'Comment', memory: 'Memory' };

function toggleNovelSrcCategory(cat) {
    const suffix = NOVEL_SRC_CAT_SUFFIX[cat];
    const cb = document.getElementById('srcCat' + suffix);
    const list = document.getElementById('srcList' + suffix);
    if (!cb || !list) return;
    if (!cb.checked) {
        list.classList.remove('open');
        // 取消勾选这一整个分类时，把这个分类下已选的具体条目也一并清空，避免"分类没勾选，但底下条目其实还选着"的隐藏状态
        novelSourceSelection[cat] = new Set();
        return;
    }
    list.classList.add('open');
    if (list.dataset.rendered === '1') return; // 已经渲染过内容，不用每次展开都重新生成一遍
    list.dataset.rendered = '1';
    if (cat === 'continuation') renderNovelSrcListContinuation(list);
    else if (cat === 'diary') renderNovelSrcListDiary(list);
    else if (cat === 'chat') renderNovelSrcListChat(list);
    else if (cat === 'tweet') renderNovelSrcListTweet(list);
    else if (cat === 'comment') renderNovelSrcListComment(list);
    else if (cat === 'memory') renderNovelSrcListMemory(list);
}

function toggleNovelSrcItem(cat, key) {
    const set = novelSourceSelection[cat];
    if (!set) return;
    if (set.has(key)) set.delete(key); else set.add(key);
}

// 续写素材现在来自独立的「续写工作台」会话（storySessions），不再是 novel.storyTurns。
// 未存档的剧情楼层和已存档的章节都能当素材，所以两边的量一起算。
function renderNovelSrcListContinuation(container) {
    const sessions = (typeof storySessions !== 'undefined' ? storySessions : [])
        .filter(s => (s.turns && s.turns.length > 0) || (s.chapters && s.chapters.length > 0));
    if (sessions.length === 0) { container.innerHTML = '<div class="novel-src-empty">暂无续写记录（去左边"续写"里开一段）</div>'; return; }
    container.innerHTML = sessions.map(s => {
        const parts = [];
        if (s.turns && s.turns.length) parts.push(`${s.turns.length} 轮剧情`);
        if (s.chapters && s.chapters.length) parts.push(`${s.chapters.length} 章存档`);
        return `<label class="novel-src-item"><input type="checkbox" onchange="toggleNovelSrcItem('continuation','${s.id}')">《${escapeHtml(s.title || '未命名续写')}》· ${parts.join(' / ')}</label>`;
    }).join('');
}

function renderNovelSrcListDiary(container) {
    let items = [];
    (myCharacters || []).forEach(c => {
        if (!c.diaryData) return;
        (c.diaryData.diaries || []).forEach(d => items.push({ charId: c.id, charName: c.name, kind: 'diary', id: d.id, title: d.title, content: d.content, date: d.date }));
        (c.diaryData.letters || []).forEach(d => items.push({ charId: c.id, charName: c.name, kind: 'letter', id: d.id, title: d.title, content: d.content, date: d.date }));
    });
    items.sort((a, b) => (b.date || 0) - (a.date || 0));
    // 全部列出来（以前只显示最近 60 条，更早的选不到）
    if (items.length === 0) { container.innerHTML = '<div class="novel-src-empty">暂无日记/信件</div>'; return; }
    container.innerHTML = items.map(it => {
        const key = `${it.charId}::${it.kind}::${it.id}`;
        const preview = (it.content || '').replace(/\n+/g, ' ').slice(0, 40);
        return `<label class="novel-src-item"><input type="checkbox" onchange="toggleNovelSrcItem('diary','${key}')">【${escapeHtml(it.charName)}】${it.kind === 'letter' ? '✉️' : '📔'} ${escapeHtml(it.title || '无标题')} - ${escapeHtml(preview)}${(it.content || '').length > 40 ? '...' : ''}</label>`;
    }).join('');
}

function renderNovelSrcListChat(container) {
    const chars = (myCharacters || []).filter(c => globalChats[c.id] && globalChats[c.id].length > 0);
    if (chars.length === 0) { container.innerHTML = '<div class="novel-src-empty">暂无聊天记录</div>'; return; }
    container.innerHTML = chars.map(c => `<label class="novel-src-item"><input type="checkbox" onchange="toggleNovelSrcItem('chat','${c.id}')">💬【${escapeHtml(c.name)}】· 共 ${globalChats[c.id].length} 条消息</label>`).join('');
}

function renderNovelSrcListTweet(container) {
    let posts = (globalPosts || []).slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));   // 不再只列 60 条
    if (posts.length === 0) { container.innerHTML = '<div class="novel-src-empty">暂无推文</div>'; return; }
    container.innerHTML = posts.map(p => {
        const preview = (p.text || '').replace(/\n+/g, ' ').slice(0, 40);
        return `<label class="novel-src-item"><input type="checkbox" onchange="toggleNovelSrcItem('tweet','${p.id}')">【${escapeHtml((p.char && p.char.name) || '未知')}】${escapeHtml(preview)}${(p.text || '').length > 40 ? '...' : ''}</label>`;
    }).join('');
}

function renderNovelSrcListComment(container) {
    let comments = [];
    (globalPosts || []).forEach(p => (p.replies || []).forEach(r => comments.push({ postId: p.id, replyId: r.id, name: (r.char && r.char.name) || r.name || '未知', text: r.text, timestamp: r.timestamp })));
    comments.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    // 全部列出来（以前只显示最近 60 条）
    if (comments.length === 0) { container.innerHTML = '<div class="novel-src-empty">暂无评论</div>'; return; }
    container.innerHTML = comments.map(c => {
        const key = `${c.postId}::${c.replyId}`;
        const preview = (c.text || '').replace(/\n+/g, ' ').slice(0, 40);
        return `<label class="novel-src-item"><input type="checkbox" onchange="toggleNovelSrcItem('comment','${key}')">【${escapeHtml(c.name)}】${escapeHtml(preview)}${(c.text || '').length > 40 ? '...' : ''}</label>`;
    }).join('');
}

function renderNovelSrcListMemory(container) {
    const chars = (myCharacters || []).filter(c => c.memorySummary && c.memorySummary.trim());
    if (chars.length === 0) { container.innerHTML = '<div class="novel-src-empty">暂无角色记忆摘要</div>'; return; }
    container.innerHTML = chars.map(c => `<label class="novel-src-item"><input type="checkbox" onchange="toggleNovelSrcItem('memory','${c.id}')">🧠【${escapeHtml(c.name)}】的记忆摘要</label>`).join('');
}

async function generateNovelFromSources() {
    const api = getApiMain();
    if (!api.key) return alert("请先在设置中配置 API Key (主API或副API)！");
    const novel = globalNovels.find(n => n.id === currentEditingNovelId);
    if (!novel) return;

    const sel = novelSourceSelection;
    const totalSelected = sel.continuation.size + sel.diary.size + sel.chat.size + sel.tweet.size + sel.comment.size + sel.memory.size;
    if (totalSelected === 0) return appAlert('至少选一条内容，AI才有素材可以参考～');

    const sections = [];

    if (sel.continuation.size > 0) {
        let block = '';
        sel.continuation.forEach(sessionId => {
            const s = (typeof storySessions !== 'undefined' ? storySessions : []).find(x => x.id === sessionId);
            if (!s) return;
            let body = (s.chapters || []).map((c, i) => `第 ${i + 1} 章：\n${c.content}`).join('\n\n');
            const live = (s.turns || []).map(t => `${t.role === 'user' ? '用户' : '角色'}：${t.text}`).join('\n');
            if (live) body += (body ? '\n\n' : '') + live;
            if (body.trim()) block += `《${s.title || '未命名续写'}》：\n${body.trim()}\n\n`;
        });
        if (block.trim()) sections.push(`【续写内容】\n${block.trim()}`);
    }

    if (sel.diary.size > 0) {
        let block = '';
        sel.diary.forEach(key => {
            const [charId, kind, entryId] = key.split('::');
            const c = myCharacters.find(x => x.id == charId);
            if (!c || !c.diaryData) return;
            const list = kind === 'letter' ? c.diaryData.letters : c.diaryData.diaries;
            const item = (list || []).find(d => d.id === entryId);
            if (!item) return;
            block += `【${c.name}的${kind === 'letter' ? '信' : '日记'}·${item.title || '无标题'}】\n${item.content}\n\n`;
        });
        if (block.trim()) sections.push(`【日记与信件】\n${block.trim()}`);
    }

    if (sel.chat.size > 0) {
        let block = '';
        sel.chat.forEach(charId => {
            const c = myCharacters.find(x => x.id == charId);
            const msgs = globalChats[charId] || [];
            if (!c || msgs.length === 0) return;
            // 太长的聊天记录只取最近80条，避免prompt过大发不出去或者被截断
            const recent = msgs.slice(-80);
            block += `【和${c.name}的聊天】\n` + recent.map(m => `${m.sender === 'me' ? userDisplayName() : c.name}：${m.text || '[图片/表情]'}`).join('\n') + '\n\n';
        });
        if (block.trim()) sections.push(`【聊天记录】\n${block.trim()}`);
    }

    if (sel.tweet.size > 0) {
        let block = '';
        sel.tweet.forEach(postId => {
            const p = globalPosts.find(x => x.id === postId);
            if (!p) return;
            block += `【${(p.char && p.char.name) || '未知'}发的推文】${p.text}\n\n`;
        });
        if (block.trim()) sections.push(`【推文】\n${block.trim()}`);
    }

    if (sel.comment.size > 0) {
        let block = '';
        sel.comment.forEach(key => {
            const [postId, replyId] = key.split('::');
            const p = globalPosts.find(x => x.id === postId);
            const r = p && (p.replies || []).find(x => x.id === replyId);
            if (!p || !r) return;
            block += `【${(r.char && r.char.name) || r.name || '未知'}在"${(p.text || '').slice(0, 20)}..."下的评论】${r.text}\n\n`;
        });
        if (block.trim()) sections.push(`【评论】\n${block.trim()}`);
    }

    if (sel.memory.size > 0) {
        let block = '';
        sel.memory.forEach(charId => {
            const c = myCharacters.find(x => x.id == charId);
            if (!c || !c.memorySummary) return;
            block += `【${c.name}的记忆摘要】${c.memorySummary}\n\n`;
        });
        if (block.trim()) sections.push(`【角色记忆】\n${block.trim()}`);
    }

    if (sections.length === 0) return appAlert('勾选的内容好像都是空的，换一批试试～');

    const extraInstruction = (document.getElementById('novelSourceExtraInstruction').value || '').trim();
    const wordCount = document.getElementById('novelSourceWordCount').value || 1200;
    const secondPersonEl = document.getElementById('novelSecondPerson');
    const secondPerson = secondPersonEl ? secondPersonEl.checked : true;
    const title = document.getElementById('novelTitleInput').value.trim() || novel.title || '未命名故事';
    const currentChapterNum = (novel.chapters ? novel.chapters.length : 0) + 1;

    const prompt = `你是一个才华横溢的网络故事作家。下面这些是真实发生过的互动记录（可能包括聊天、推文、评论、日记信件、角色记忆、之前的互动续写剧情），请你把它们改写、揉合成一段有文采的小说正文，作为故事《${title}》的【第${currentChapterNum}章】。

${sections.join('\n\n')}

【创作要求】：
1. 不是简单罗列或复述以上内容，而是用小说笔法重新组织成完整、连贯、有画面感的叙事，可以适当补充过渡、心理描写、场景细节，但不能违背以上素材里体现出的人物性格与关系，不能凭空捏造素材里没有的重大情节。
2. 目标字数：约 ${wordCount} 字左右，描写细腻，不要过度敷衍跳跃。
3. 请直接输出正文内容，不要输出"第X章"等标题，不要输出任何寒暄、自我解释或Markdown代码块前缀。${extraInstruction ? `\n4. 用户的额外要求：${extraInstruction}` : ''}${secondPerson ? '\n5. 采用第二人称视角写作：把"你"当作故事的主角/视角人物来写，叙述和心理描写都用"你"来指代主角本人，不要用"我"的第一人称、也不要用角色名字或"他/她"的第三人称来写主角视角的内容；其他配角正常按人称描写即可，对话引号内的台词不受此限制。' : ''}`;

    const btn = document.getElementById('btnGenNovelFromSources');
    const originalText = btn.innerText;
    btn.innerText = '正在编织故事...'; btn.disabled = true;
    const genStartTime = Date.now();

    try {
        // 同上：小说这条路保留思维链，交给 extractReasoningForNovel 折叠展示
        let data = await sendChatRequest(api, prompt, { __keepReasoning: true });
        if (data.error) throw new Error(data.error.message || "请求报错");
        let text = data.choices?.[0]?.message?.content?.trim();
        if (!text) throw new Error("生成返回为空，可能是模型拒绝了这段内容，换个说法试试");
        text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
        // 思维链折叠框单独存字段、不拼进content——跟另外两种生成模式保持一致的原因见 generateNovelChapter 里的详细注释
        const { rest: textNoReasoning, reasoningHtml } = extractReasoningForNovel(text);
        text = textNoReasoning;

        tempNovelChapter = { id: 'c_' + Date.now(), index: currentChapterNum, content: text, timestamp: Date.now(), genTimeMs: Date.now() - genStartTime, reasoningHtml: reasoningHtml };
        closeModal('novelSourceSummaryModal');
        const tempArea = document.getElementById('novelTempArea'), tempContentEl = document.getElementById('novelTempContent');
        if (tempContentEl) tempContentEl.value = text;
        if (tempArea) { tempArea.style.display = 'block'; tempArea.scrollIntoView({ behavior: 'smooth' }); }
    } catch (e) {
        appAlert("生成失败：" + e.message);
    } finally {
        btn.innerText = originalText; btn.disabled = false;
    }
}

// ============================================================================
// ⚙️ 设置页：索引 + 分页
// ----------------------------------------------------------------------------
// 原来整个设置页是一条几千像素的长滚动，什么都堆在一起，找一个开关要滚半天。
// 现在第一层只是目录，点一项进一张分页。
// ⚠️ 分页并没有从 DOM 里搬走，只是 display:none —— 这一点很关键：
//    saveSettings() 那类函数一口气读几十个 getElementById，元素只要还在文档里就读得到；
//    真把它们拆成独立 view 反而要改一大堆老代码，风险大得多。
// ============================================================================
const GY_SETTINGS_PANELS = {
    api:         '🌟 API 与模型',
    gen:         '🎚️ 生成参数',
    interaction: '💬 互动与描写',
    alive:       '🫀 活人感',
    auto:        '🔌 自动功能开关',
    appearance:  '🎨 外观与主题',
    notify:      '🔔 通知与云端',
    data:        '💾 数据备份与恢复'
};
let currentSettingsPanel = '';

function openSettingsPanel(key) {
    if (!GY_SETTINGS_PANELS[key]) return;
    currentSettingsPanel = key;
    const idx = document.getElementById('setIndex');
    if (idx) idx.style.display = 'none';
    document.querySelectorAll('.set-panel').forEach(p => { p.style.display = 'none'; });
    const panel = document.getElementById('setPanel-' + key);
    if (panel) panel.style.display = 'block';
    const title = document.getElementById('settingsTitle');
    if (title) title.innerText = GY_SETTINGS_PANELS[key];
    // 开关列表是空壳，进这一页才画（画一次不贵，但没必要在打开设置页时就画）
    if (key === 'auto' && typeof renderAutoFeatureList === 'function') renderAutoFeatureList();
    if (key === 'alive' && typeof renderAlivePanel === 'function') renderAlivePanel();
    // 🔎 美化页里的选择器速查表也是进来才扫（要遍历整棵 DOM，不进这一页就不做）
    if (key === 'appearance') {
        try { if (typeof gyCssMapRender === 'function') gyCssMapRender(); } catch (e) {}
        try { if (typeof gyCssEgRender === 'function') gyCssEgRender(); } catch (e) {}
        try {
            const tv = document.getElementById('toastMaxVisibleSelect');
            if (tv && typeof toastMaxVisible !== 'undefined') tv.value = String(toastMaxVisible);
            const th = document.getElementById('uiThemeSelect');
            if (th && typeof uiTheme !== 'undefined') th.value = uiTheme;
            if (typeof applyMainWidth === 'function') applyMainWidth();   // 把滑块和那个 600px 的数字对上
        } catch (e) {}
    }
    // 手机顶栏中间的标题也跟着走，不然进了分页顶上还写着"系统设置"，分不清在哪一层
    const mt = document.getElementById('mtbCenterTitle');
    if (mt) mt.innerText = GY_SETTINGS_PANELS[key].replace(/^\S+\s*/, '');
    // 进分页从头看起，别继承上一页滚到一半的位置
    try {
        window.scrollTo(0, 0);
        const main = document.querySelector('.main-content');
        if (main) main.scrollTop = 0;
    } catch (e) {}
}

// 设置目录页最下面那行版本号。
// 它的用处很实在：改完代码看不到效果时，先看这里的数字对不对得上——
// 对不上就是浏览器在读缓存里的旧 js（用 file:// 打开时 Service Worker 根本不会注册，
// 只能靠 ?v= 加强制刷新），Ctrl+F5 一下就好；对得上说明代码是新的，那就是别的问题。
function renderSettingsVersion() {
    const el = document.getElementById('setVersionLine');
    if (!el) return;
    const v = (typeof GY_APP_VERSION !== 'undefined') ? GY_APP_VERSION : '未知';
    el.innerHTML = `白露 <b>${v}</b>　<span class="set-version-hint">看不到刚更新的功能？先看这个版本号对不对；不对就 Ctrl+F5 强制刷新一次。</span>`;
}

function closeSettingsPanel() {
    currentSettingsPanel = '';
    document.querySelectorAll('.set-panel').forEach(p => { p.style.display = 'none'; });
    const idx = document.getElementById('setIndex');
    if (idx) idx.style.display = 'block';
    renderSettingsVersion();
    const title = document.getElementById('settingsTitle');
    if (title) title.innerText = '系统设置';
    const mt = document.getElementById('mtbCenterTitle');
    if (mt) mt.innerText = '系统设置';
    try {
        window.scrollTo(0, 0);
        const main = document.querySelector('.main-content');
        if (main) main.scrollTop = 0;
    } catch (e) {}
}

// 左上角那个「←」：在分页里就退回目录，在目录里才是真的离开设置页。
// 这样手机上一路点回去的感觉跟系统设置一致，不会一下子被弹回首页。
function settingsBack() {
    if (currentSettingsPanel) closeSettingsPanel();
    else if (typeof goBackToPreviousView === 'function') goBackToPreviousView();
}

// 手机顶栏那个通用返回键：以前直接 goBackToPreviousView()，在设置分页里点一下会整页弹回上一个页面，
// 跟屏幕里那个「←」行为不一致（那个是退回目录）。统一成：设置分页里先退回目录，其余场合照旧。
function gyGlobalBack() {
    const settingsOpen = document.getElementById('view-settings')
        && document.getElementById('view-settings').style.display !== 'none';
    if (settingsOpen && typeof currentSettingsPanel !== 'undefined' && currentSettingsPanel) {
        closeSettingsPanel();
        return;
    }
    // 正在某个聊天里（竖排列表模式）→ 先退回联系人列表，而不是直接跳出聊天页。
    // 页面顶上那条「← 联系人列表」已经藏了，这个 ‹ 就得担起那个活儿。
    try {
        const chatOpen = document.getElementById('view-chat')
            && document.getElementById('view-chat').style.display !== 'none';
        if (chatOpen && typeof chatListViewMode !== 'undefined' && chatListViewMode !== 'row'
            && typeof chatListShowingList !== 'undefined' && !chatListShowingList
            && typeof backToContactList === 'function') {
            backToContactList();
            return;
        }
    } catch (e) {}
    if (typeof goBackToPreviousView === 'function') goBackToPreviousView();
}

// ===================== 🫀 活人感设置页 =====================
// 三个开关本体在 AUTO_FEATURE_DEFS 里（跟别的自动功能一个待遇，也能在「自动功能开关」页里看到），
// 这一页把它们和各自的参数放在一起，免得"开关在这儿、参数在那儿"。
function aliveSwitchRow(key) {
    const def = (typeof AUTO_FEATURE_DEFS !== 'undefined') ? AUTO_FEATURE_DEFS.find(f => f.key === key) : null;
    if (!def) return '';
    const on = (typeof isAutoOn === 'function') ? isAutoOn(key) : false;
    return `<label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; padding:12px 0;">
        <input type="checkbox" ${on ? 'checked' : ''} onchange="aliveSetSwitch('${key}', this.checked)" style="width:18px; height:18px; margin-top:2px; cursor:pointer; flex-shrink:0;">
        <span style="flex:1; min-width:0;">
          <b style="font-size:14px;">${escapeHtml(def.label)}</b>
          <div style="font-size:12px; color:#536471; line-height:1.7; margin-top:3px;">${autoFeatText(def.desc)}</div>
          ${def.where ? `<div style="font-size:11px; color:#1d9bf0; margin-top:3px; opacity:.85;">📍 ${autoFeatText(def.where)}</div>` : ''}
          <div style="font-size:11px; color:#8b98a5; margin-top:3px;">💰 ${autoFeatText(def.cost || '')}</div>
          <div style="font-size:10.5px; color:#8b98a5; margin-top:4px;">跟「设置 → 🔌 自动功能开关 → 🫀 活人感」里的<b>是同一个开关</b>，在哪儿点都一样。</div>
        </span></label>`;
}
function aliveSetSwitch(key, on) {
    if (typeof setAutoFeature === 'function') setAutoFeature(key, on);
    renderAlivePanel();
    if (typeof renderAliveBar === 'function') renderAliveBar();
}
function aliveNum(id, label, val, min, max, unit) {
    return `<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
        <span style="font-size:13px; color:#536471; min-width:120px;">${label}</span>
        <input id="${id}" type="number" min="${min}" value="${val}" style="width:88px; padding:6px 8px; border:1px solid #cfd9de; border-radius:6px; font-size:13px;">
        <span style="font-size:12px; color:#8b98a5;">${unit}</span></div>`;
}

function renderAlivePanel() {
    const box = document.getElementById('alivePanelBody');
    if (!box) return;
    const offOn = (typeof isAutoOn === 'function') && isAutoOn('aliveOffline');
    const moodOn = (typeof isAutoOn === 'function') && isAutoOn('aliveMood');
    const voiceOn = (typeof isAutoOn === 'function') && isAutoOn('aliveVoice');
    const fadeOn = (typeof isAutoOn === 'function') && isAutoOn('aliveFade');
    const bodyOn = (typeof isAutoOn === 'function') && isAutoOn('aliveBody');
    const sec = (t, body) => `<div style="margin-top:18px; padding:15px; background:rgba(29,155,240,0.05); border-radius:8px; border:1px solid #1d9bf0;">
        <div style="font-size:14px; font-weight:bold; color:#1d9bf0; margin-bottom:8px;">${t}</div>${body}</div>`;

    // —— 挂起中的消息 ——
    const heldKeys = Object.keys(aliveHeld || {}).filter(k => aliveHeld[k] && (aliveHeld[k].texts || []).length);
    const heldHtml = heldKeys.length ? heldKeys.map(sid => {
        const q = aliveHeld[sid];
        const c = myCharacters.find(x => x.id == q.charId);
        const left = Math.max(0, Math.round((q.until - Date.now()) / 60000));
        return `<div style="display:flex; align-items:center; gap:8px; background:white; padding:9px 10px; border-radius:6px; border:1px solid #eff3f4; margin-bottom:6px;">
            <div style="flex:1; min-width:0;">
              <div style="font-size:13px; font-weight:bold;">${q.kind === 'sleep' ? '💤' : '⏳'} ${escapeHtml(c ? c.name : '（角色已删）')}
                <span style="font-weight:normal; color:#536471;">${escapeHtml(q.why || '')}</span></div>
              <div style="font-size:12px; color:#8b98a5;">挂着 ${q.texts.length} 条，${left > 0 ? '大约 ' + (left >= 60 ? Math.round(left / 60) + ' 小时' : left + ' 分钟') + '后回你' : '马上就回'}</div>
            </div>
            <button type="button" class="btn-edit-small" onclick="aliveReplyNow('${sid}')">让 TA 现在就回</button>
        </div>`;
    }).join('') : '<div style="font-size:13px; color:#8b98a5;">现在没有挂起的消息。</div>';

    // —— 每个角色的语言指纹 ——
    const voiceRows = (myCharacters || []).map(c => {
        const vp = c.voicePrint;
        const n = (typeof aliveVoiceSamples === 'function') ? aliveVoiceSamples(c).length : 0;
        return `<div style="display:flex; align-items:center; gap:8px; background:white; padding:9px 10px; border-radius:6px; border:1px solid #eff3f4; margin-bottom:6px;">
            <div style="flex:1; min-width:0;">
              <div style="font-size:13px; font-weight:bold;">${escapeHtml(c.name)}
                <span style="font-weight:normal; color:${vp ? '#17bf63' : '#8b98a5'};">${vp ? '已有指纹' : '还没提'}</span></div>
              <div style="font-size:12px; color:#8b98a5;">TA 自己写过 ${n} 条${vp ? '　·　提取于 ' + new Date(vp.at).toLocaleDateString('zh-CN') : (n < 8 ? '（不够 8 条，提不了）' : '')}</div>
            </div>
            ${vp ? `<button type="button" class="btn-edit-small" onclick="aliveShowVoice(${c.id})">看/改</button>` : ''}
            <button type="button" class="btn-edit-small" onclick="aliveExtractVoice(${c.id})" ${n < 8 ? 'disabled style="opacity:.45;"' : ''}>${vp ? '重提' : '提取'}</button>
        </div>`;
    }).join('') || '<div style="font-size:13px; color:#8b98a5;">还没有角色。</div>';

    // —— 现在各角色的情绪 ——
    const moodRows = (myCharacters || []).map(c => {
        const v = (typeof aliveMoodValue === 'function') ? aliveMoodValue(c) : 0;
        if (!v) return '';
        const m = c.mood || {};
        return `<div style="display:flex; align-items:center; gap:8px; font-size:13px; padding:6px 0; border-bottom:1px dashed #eff3f4;">
            <b style="min-width:70px;">${escapeHtml(c.name)}</b>
            <span style="color:${v > 0 ? '#17bf63' : '#f91880'}; min-width:44px;">${v > 0 ? '+' : ''}${v.toFixed(1)}</span>
            <span style="color:#536471; flex:1; min-width:0;">${escapeHtml(m.why || '')}</span>
            <span style="color:#f91880; cursor:pointer;" onclick="aliveClearMood(${c.id})">消掉</span>
        </div>`;
    }).filter(Boolean).join('');

    box.innerHTML = `
      <div style="font-size:13px; color:#536471; line-height:1.7; padding:4px 2px 0;">
        下面这五项是让角色<b>更像个有自己生活的人</b>，不是加内容量。<b>默认全关</b>——一个都不开的话，行为跟以前完全一样。<br>
        再往下的「🔗 补齐没接上的数据」是另一回事：那几项<b>一次 API 都不调</b>，只是把你早就填好的东西接进去，所以默认是开的。
      </div>

      ${sec('💤 TA 不总是在线', aliveSwitchRow('aliveOffline') + (offOn ? `
        <div style="border-top:1px dashed #cfd9de; padding-top:12px; margin-top:6px;">
          ${aliveNum('aliveSleepStart', '几点之后算睡了', aliveSettings.sleepStart, 0, 23, '点（没日程的角色按这个；有日程的以日程为准）')}
          ${aliveNum('aliveSleepEnd', '几点算醒', aliveSettings.sleepEnd, 0, 23, '点（会随机赖床 0~40 分钟）')}
          ${aliveNum('aliveMinDelay', '忙完之后最少等', aliveSettings.minDelay, 0, 240, '分钟再回')}
          ${aliveNum('aliveMaxDelay', '最多等', aliveSettings.maxDelay, 0, 480, '分钟（在这两个数之间随机）')}
          ${aliveNum('aliveMaxHold', '最长挂多久', aliveSettings.maxHold, 1, 72, '小时（超了强制回，防止日程写错把人锁死）')}
          <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
            <span style="font-size:13px; color:#536471; min-width:120px;">急事豁免词</span>
            <input id="aliveUrgent" value="${escapeHtml(aliveSettings.urgentWords || '')}" style="flex:1; min-width:200px; padding:6px 8px; border:1px solid #cfd9de; border-radius:6px; font-size:13px;">
          </div>
          <div style="font-size:11.5px; color:#8b98a5; margin:-2px 0 10px;">消息里带上面任意一个词，就立刻把 TA 叫起来回你（半夜真有事的时候用），逗号分隔。</div>
          <button type="button" class="btn-edit-small" onclick="aliveSaveSettings()">💾 保存</button>
          <div id="aliveSaveStatus" style="font-size:12px; color:#8b98a5; margin-top:6px;"></div>
          <div style="margin-top:14px;">
            <div style="font-size:13px; font-weight:bold; margin-bottom:6px;">📥 现在挂着的消息</div>
            ${heldHtml}
          </div>
          <div style="margin-top:14px;">
            <div style="font-size:13px; font-weight:bold; margin-bottom:6px;">🔓 这几个角色永远在线（不受挂起影响）</div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              ${(myCharacters || []).map(c => `<button type="button" class="btn-edit-small" style="${c.aliveAlwaysOn ? 'background:#1d9bf0;color:#fff;border-color:#1d9bf0;' : ''}" onclick="aliveToggleAlwaysOn(${c.id}, ${!c.aliveAlwaysOn})">${escapeHtml(c.name)}</button>`).join('') || '<span style="font-size:13px;color:#8b98a5;">还没有角色</span>'}
            </div>
          </div>
        </div>` : ''))}

      ${sec('🌡️ 情绪会留到下一轮', aliveSwitchRow('aliveMood') + (moodOn ? `
        <div style="border-top:1px dashed #cfd9de; padding-top:12px; margin-top:6px;">
          ${aliveNum('aliveHalfLife', '情绪多久淡一半', aliveSettings.moodHalfLife, 0.5, 72, '小时')}
          <button type="button" class="btn-edit-small" onclick="aliveSaveSettings()">💾 保存</button>
          <div style="margin-top:12px;">
            <div style="font-size:13px; font-weight:bold; margin-bottom:6px;">现在各角色心里还剩什么</div>
            ${moodRows || '<div style="font-size:13px; color:#8b98a5;">现在大家都挺平静的。</div>'}
          </div>
        </div>` : ''))}

      ${sec('🧠 久远的记忆会褪色', aliveSwitchRow('aliveFade') + (fadeOn ? `
        <div style="border-top:1px dashed #cfd9de; padding-top:12px; margin-top:6px;">
          ${aliveNum('aliveFadeClear', '几天之内记得清楚', aliveSettings.fadeClear, 0.5, 60, '天（这些给全文）')}
          ${aliveNum('aliveFadeBlur', '几天之内只剩大概', aliveSettings.fadeBlur, 1, 365, '天（压到 60 字，再往前只剩 26 字的印象）')}
          ${aliveNum('aliveFadeDepth', '往回翻几条总结', aliveSettings.fadeDepth, 1, 20, '条（原来固定 5 条全文；老的压过，翻到 8 条也只多一百多字）')}
          <button type="button" class="btn-edit-small" onclick="aliveSaveSettings()">💾 保存</button>
          <div style="font-size:11.5px; color:#8b98a5; margin-top:8px; line-height:1.7;">
            吵架、告白、道歉、生病这类<b>情绪重的记忆衰减慢三倍</b>——隔很久也还记得清，这跟真人一样。<br>
            没有时间戳的老总结一律按"最近"处理，不会因为升级把旧记忆一刀砍没。<br>
            <b>老实说字数：</b>会多一段"你记不清了"的说明。同样 5 条时比原来多 ~70 字，翻到 8 条多 ~160 字——不是省钱功能，是拿一点字数换"记忆有远近、而且知道自己记不清"。
          </div>
          <div style="margin-top:12px;">
            <div style="font-size:13px; font-weight:bold; margin-bottom:6px;">预览：现在注给角色的是什么样</div>
            <select id="aliveFadePick" onchange="alivePreviewFade()" style="padding:6px; border:1px solid #cfd9de; border-radius:6px; font-size:13px; max-width:200px;">
              ${(myCharacters || []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('') || '<option value="">还没有角色</option>'}
            </select>
            <button type="button" class="btn-edit-small" onclick="alivePreviewFade()">看看</button>
            <pre id="aliveFadePreview" style="white-space:pre-wrap; word-break:break-all; font-size:12px; color:#536471; background:white; border:1px solid #eff3f4; border-radius:6px; padding:10px; margin-top:8px; max-height:240px; overflow:auto; font-family:inherit;"></pre>
          </div>
        </div>` : ''))}

      ${sec('🥱 身上的状态会累积', aliveSwitchRow('aliveBody') + (bodyOn ? `
        <div style="border-top:1px dashed #cfd9de; padding-top:12px; margin-top:6px;">
          <div style="font-size:12px; color:#536471; line-height:1.7; margin-bottom:10px;">
            全部按<b>日程</b>在本地推，一次 API 都不调。角色没有日程就推不出来——先去给 TA 生成一份日程。
            "几点睡"用的是上面「不总是在线」里那个作息设置。
          </div>
          ${(myCharacters || []).map(c => {
            const st = (typeof aliveBodyState === 'function') ? aliveBodyState(c) : [];
            return `<div style="display:flex; align-items:center; gap:8px; font-size:13px; padding:7px 0; border-bottom:1px dashed #eff3f4;">
              <b style="min-width:80px;">${escapeHtml(c.name)}</b>
              <span style="color:${st.length ? '#536471' : '#8b98a5'}; flex:1; min-width:0;">${st.length ? escapeHtml(st.map(x => x.t).join('；')) : (c.schedule && c.schedule.text ? '现在挺好的' : '还没有日程，推不出来')}</span>
            </div>`;
          }).join('') || '<div style="font-size:13px; color:#8b98a5;">还没有角色。</div>'}
        </div>` : ''))}

      ${sec('🔗 补齐没接上的数据（这一组一次 API 都不调）', `
        <div style="font-size:12px; color:#536471; line-height:1.8;">
          做了一次数据体检（给每个字段塞记号、再抓真正发出去的 prompt），发现有几样东西<b>你填了、界面上也显示、但从来没进过 prompt</b>——角色其实一直不知道。这里把它们接上了。<br>
          <span style="color:#8b98a5;">这是补洞不是加功能，所以默认都开。它们<b>不会多调一次 API</b>（只是把你早就填好的内容接进去），所以没放进「🔌 自动功能开关」那张"会自动花钱"的表里。加起来大概几十个字。</span>
        </div>
        <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;padding:9px 0;">
          <input type="checkbox" ${aliveSettings.knowProfile !== false ? 'checked' : ''} onchange="aliveSetLink('knowProfile', this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;">
          <span><b>🪪 角色知道自己资料页上写了什么</b><br><span style="font-size:11.5px;color:#8b98a5;line-height:1.7;">简介、所在地、网站、生日——以前这四样只画在资料页上，角色被问到自己是哪儿人都答不上来。</span></span></label>
        <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;padding:9px 0;">
          <input type="checkbox" ${aliveSettings.knowFaction !== false ? 'checked' : ''} onchange="aliveSetLink('knowFaction', this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;">
          <span><b>🏳️ 角色知道自己属于哪个势力</b><br><span style="font-size:11.5px;color:#8b98a5;line-height:1.7;">连同"同一边还有谁"。以前核心程序里<b>一条都没有</b>——除非你写进人设或世界书，否则角色不知道自己是哪派的。</span></span></label>
        <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;padding:9px 0;">
          <input type="checkbox" ${aliveSettings.knowDiary !== false ? 'checked' : ''} onchange="aliveSetLink('knowDiary', this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;">
          <span><b>📔 角色记得自己写过的日记</b><br><span style="font-size:11.5px;color:#8b98a5;line-height:1.7;">信件一直是进 prompt 的，日记一直漏着。注入时会说明"这是私下写给自己的，别当聊天素材主动端出来"。</span></span></label>
        <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;padding:9px 0;">
          <input type="checkbox" ${aliveSettings.useBusyReply !== false ? 'checked' : ''} onchange="aliveSetLink('useBusyReply', this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;">
          <span><b>💤 用上「忙碌自动回复」那个字段</b><br><span style="font-size:11.5px;color:#8b98a5;line-height:1.7;">
            角色资料页里那个"忙碌自动回复"输入框，<b>以前填了完全没用</b>——没有任何代码读它。现在接到上面的「TA 不总是在线」上：消息被挂起时先顶那一句（一个挂起周期只发一次），人回来的时候 prompt 里会说明"刚才只有自动回复顶着，不是你本人在说话"。留空就完全没这回事。</span></span></label>
        <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;padding:9px 0;">
          <input type="checkbox" ${aliveSettings.knowAnniv !== false ? 'checked' : ''} onchange="aliveSetLink('knowAnniv', this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;">
          <span><b>🗓️ 角色知道今天是什么日子</b><br><span style="font-size:11.5px;color:#8b98a5;line-height:1.7;">
            你在日历里手记的纪念日（含周年）<b>一个字都没进过 prompt</b>——今天是你俩相识周年、角色也毫不知情。现在只把"今天这一天"的放进去，并且说明"要不要提看人设，别播报"。跟着总设置里的「纪念日系统」开关走。</span></span></label>
      `)}

      ${sec('✍️ 按 TA 自己的打字习惯说话', aliveSwitchRow('aliveVoice') + (voiceOn ? `
        <div style="border-top:1px dashed #cfd9de; padding-top:12px; margin-top:6px;">
          <div style="font-size:12px; color:#536471; line-height:1.7; margin-bottom:10px;">
            提取是<b>手动点的</b>，只花一次调用；提完之后每次生成都会带上，不再额外花钱。
            角色写的东西越多，提出来的指纹越准——建议聊过几十句、发过一些推文之后再提，之后想更新就点「重提」。
          </div>
          ${voiceRows}
          <div id="aliveVoiceStatus" style="font-size:12px; color:#8b98a5; margin-top:8px;"></div>
          <div id="aliveVoiceEditBox" style="display:none; margin-top:10px;">
            <textarea id="aliveVoiceEdit" rows="9" style="width:100%; box-sizing:border-box; padding:10px; border:1px solid #cfd9de; border-radius:6px; font-size:13px; font-family:inherit;"></textarea>
            <button type="button" class="btn-edit-small" style="margin-top:6px;" onclick="aliveSaveVoice(aliveVoiceEditingId)">💾 保存</button>
            <button type="button" class="btn-edit-small" style="margin-top:6px;" onclick="document.getElementById('aliveVoiceEditBox').style.display='none'">收起</button>
          </div>
        </div>` : ''))}
    `;
}
let aliveVoiceEditingId = null;
function aliveShowVoice(charId) {
    aliveVoiceEditingId = charId;
    const c = myCharacters.find(x => x.id == charId);
    const wrap = document.getElementById('aliveVoiceEditBox');
    const ta = document.getElementById('aliveVoiceEdit');
    if (!c || !wrap || !ta) return;
    ta.value = (c.voicePrint && c.voicePrint.text) || '';
    wrap.style.display = 'block';
    ta.focus();
}
function aliveClearMood(charId) {
    const c = myCharacters.find(x => x.id == charId);
    if (!c) return;
    delete c.mood;
    saveAllData();
    renderAlivePanel();
}
function aliveSaveSettings() {
    const num = (id, def, lo, hi) => {
        const el = document.getElementById(id);
        if (!el) return def;
        const v = parseFloat(el.value);
        return isNaN(v) ? def : v;   // 不设上下限，填多少就是多少（lo/hi 参数只是留着不改调用处）
    };
    // 钟点本身只有 0~23 这 24 个（填 25 就是第二天凌晨 1 点），按 24 取余，不是上下限
    aliveSettings.sleepStart = ((Math.round(num('aliveSleepStart', aliveSettings.sleepStart, 0, 23)) % 24) + 24) % 24;
    aliveSettings.sleepEnd = ((Math.round(num('aliveSleepEnd', aliveSettings.sleepEnd, 0, 23)) % 24) + 24) % 24;
    aliveSettings.minDelay = num('aliveMinDelay', aliveSettings.minDelay, 0, 240);
    aliveSettings.maxDelay = num('aliveMaxDelay', aliveSettings.maxDelay, 0, 480);
    aliveSettings.maxHold = num('aliveMaxHold', aliveSettings.maxHold, 1, 72);
    aliveSettings.moodHalfLife = num('aliveHalfLife', aliveSettings.moodHalfLife, 0.5, 72);
    aliveSettings.fadeClear = num('aliveFadeClear', aliveSettings.fadeClear, 0.5, 60);
    aliveSettings.fadeBlur = num('aliveFadeBlur', aliveSettings.fadeBlur, 1, 365);
    aliveSettings.fadeDepth = Math.round(num('aliveFadeDepth', aliveSettings.fadeDepth, 1, 20));
    const u = document.getElementById('aliveUrgent');
    if (u) aliveSettings.urgentWords = u.value;
    saveAllData();
    const st = document.getElementById('aliveSaveStatus');
    if (st) st.innerText = '保存好了。';
    renderAlivePanel();
}

// 聊天页顶上那条"TA 这会儿不在"的提示
function renderAliveBar() {
    const bar = document.getElementById('aliveBar');
    if (!bar) return;
    const sid = (typeof currentChatSessionId !== 'undefined') ? currentChatSessionId : null;
    const q = sid ? (aliveHeld || {})[sid] : null;
    if (!q || !(q.texts || []).length || (typeof isAutoOn === 'function' && !isAutoOn('aliveOffline'))) {
        bar.style.display = 'none'; bar.innerHTML = ''; return;
    }
    const c = myCharacters.find(x => x.id == q.charId);
    const left = Math.max(0, Math.round((q.until - Date.now()) / 60000));
    const when = left <= 0 ? '马上就回' : (left >= 60 ? '大约 ' + (Math.round(left / 6) / 10) + ' 小时后回你' : '大约 ' + left + ' 分钟后回你');
    bar.style.display = 'block';
    bar.innerHTML = `<div style="display:flex; align-items:center; gap:8px; margin:6px 15px 0; padding:9px 12px; background:rgba(120,86,255,0.10); border:1px solid rgba(120,86,255,0.35); border-radius:10px;">
        <span style="font-size:16px; flex-shrink:0;">${q.kind === 'sleep' ? '💤' : '⏳'}</span>
        <span style="flex:1; min-width:0; font-size:12.5px; line-height:1.6; color:#536471;">
          <b style="color:#7856ff;">${escapeHtml(c ? c.name : 'TA')}</b> 这会儿${q.kind === 'sleep' ? '在睡觉' : '在忙'}${q.why ? '（' + escapeHtml(q.why) + '）' : ''}，
          你的 ${q.texts.length} 条消息先挂着，${when}。
        </span>
        <button type="button" class="btn-edit-small" style="flex-shrink:0;" onclick="aliveReplyNow('${sid}')">现在就回</button>
    </div>`;
}

// 记忆褪色的预览：直接把要注进 prompt 的那一段原样显示出来
function alivePreviewFade() {
    const sel = document.getElementById('aliveFadePick');
    const out = document.getElementById('aliveFadePreview');
    if (!out) return;
    const c = myCharacters.find(x => x.id == (sel && sel.value));
    if (!c) { out.innerText = '还没有角色。'; return; }
    if (!c.chatSummary) { out.innerText = `${c.name} 还没有聊天总结——聊够设定条数之后才会自动攒出来。`; return; }
    const t = (typeof aliveFadedSummaryBlock === 'function') ? aliveFadedSummaryBlock(c) : null;
    out.innerText = t || '（开关没开）';
}

// 🔗 那四个"补洞"开关：不走 AUTO_FEATURE_DEFS（那张表是"会自己调 API 的功能"，这几个不调），
//    直接存在 aliveSettings 里。
function aliveSetLink(key, on) {
    aliveSettings[key] = !!on;
    saveAllData();
    renderAlivePanel();
}

// ===================== 🧩 小功能（设置页收纳）=====================
// 背景：音乐盒、行程与天气、关系账本、八卦网、此刻、随身物、日子这些插件，
// 每一个都往「系统设置」的目录页里塞一个 .set-entry。装了七八个之后，
// 目录页上核心的 8 项和插件的 7 项混在一起，一眼看不出哪个是设置、哪个是功能。
//
// 收纳做法有两种：一是改每个插件让它们改注册到新地方（要重装 7 个插件），
// 二是**核心这边主动去认领**——目录页里凡是没标 data-core 的条目，
// 一律搬进「🧩 小功能」这一页。选了后者：老插件一行都不用改，
// 以后别人写的插件只要还按老办法塞条目，也会自动被收进来。
const GY_MINI_FEATURES = [];

// 内置功能走这个注册（插件不用管，靠下面的认领）
function registerMiniFeature(def) {
    if (!def || !def.id) return;
    const i = GY_MINI_FEATURES.findIndex(f => f.id === def.id);
    if (i >= 0) GY_MINI_FEATURES[i] = def; else GY_MINI_FEATURES.push(def);
}

// 认领来的插件条目**存在这个数组里**，不是存在页面上。
// ⚠️ 踩过的坑：一开始是直接把 DOM 搬进 #miniFeatureAdopted，结果第二次进这一页时
//    renderMiniFeaturePanel 会 innerHTML 重画，把搬进来的按钮连同容器一起清掉——
//    而它们早就从目录页里移走了，于是**永久消失**，插件功能再也点不到。
//    现在节点存在数组里（游离于文档之外也不会被回收），每次重画再挂回去。
const GY_ADOPTED_ENTRIES = [];

// 把目录页里"不是核心设置"的条目认领过来
function harvestMiniFeatureEntries() {
    try {
        const menu = document.querySelector('#setIndex .set-menu');
        if (!menu) return 0;
        let n = 0;
        menu.querySelectorAll('.set-entry').forEach(el => {
            if (el.dataset.core === '1') return;      // 核心那 13 项，留在目录页
            // js/27 已经把这几个做成正式页面并自己注册进小功能了，
            // 这里再认领一遍就会一个功能出现两次（一次是页面、一次是老弹窗）。
            if (window.GY_MINI_TAKEOVER && el.id && window.GY_MINI_TAKEOVER.has(el.id)) { el.remove(); return; }
            el.remove();                               // 从目录页摘下来
            const key = el.id || el.innerText.trim();
            if (!GY_ADOPTED_ENTRIES.some(x => (x.id || x.innerText.trim()) === key)) {
                GY_ADOPTED_ENTRIES.push(el);           // onclick 跟着节点一起带过来
                n++;
            }
        });
        mountAdoptedEntries();
        return n;
    } catch (e) { return 0; }
}

// 把认领到的节点挂回小功能页（重画之后要重新挂）
function mountAdoptedEntries() {
    const box = document.getElementById('miniFeatureAdopted');
    if (!box) return;
    GY_ADOPTED_ENTRIES.forEach(el => { if (el.parentElement !== box) box.appendChild(el); });
}

function renderMiniFeaturePanel() {
    const box = document.getElementById('miniFeatureList');
    if (!box) return;
    const rows = GY_MINI_FEATURES.map(f => `
        <button type="button" class="set-entry" onclick="gyOpenMiniFeature('${f.id}')">
            <span class="set-entry-ico">${f.icon || '🧩'}</span>
            <span class="set-entry-main"><span class="set-entry-title">${escapeHtml(f.title || f.id)}</span><span class="set-entry-desc">${escapeHtml(f.desc || '')}</span></span>
            <span class="set-entry-arrow">›</span>
        </button>`).join('');
    box.innerHTML = `
        <div style="font-size:12.5px; color:#536471; line-height:1.8; margin-bottom:14px;">
            这一页收的是<b>功能</b>，不是设置项——点进去是一个能用的东西（播放器、地图、账本、看板……），
            而不是一堆开关。内置的和你装的插件都会出现在这儿。<br>
            <span style="color:#8b98a5;">游戏不在这儿：游戏跟着聊天走，入口是聊天输入框上方那个 🎮。</span>
        </div>
        <div class="set-menu">${rows}</div>
        <div id="miniFeatureAdopted" class="set-menu" style="margin-top:0;"></div>
        <div id="miniFeatureEmpty" style="display:none; font-size:13px; color:#8b98a5; text-align:center; padding:24px 10px;">
            还没有小功能。装个插件试试，或者在「🔌 插件」页里看看已经装了什么。
        </div>`;
    mountAdoptedEntries();          // 先把以前认领过的挂回来
    harvestMiniFeatureEntries();    // 再看目录页有没有新冒出来的
    const empty = document.getElementById('miniFeatureEmpty');
    if (empty) empty.style.display = (GY_MINI_FEATURES.length + GY_ADOPTED_ENTRIES.length) === 0 ? 'block' : 'none';
}

function gyOpenMiniFeature(id) {
    const f = GY_MINI_FEATURES.find(x => x.id === id);
    if (f && typeof f.onOpen === 'function') { try { f.onOpen(); } catch (e) { console.warn('[小功能] 打开出错：', e); } }
}

// 插件是在 switchMainView 之后才把条目塞进目录页的，而且每次切页都会再塞一次。
// 所以这里盯着目录页：只要有新条目冒出来，就顺手收走。
(function watchSettingsMenu() {
    function attach() {
        const menu = document.querySelector('#setIndex .set-menu');
        if (!menu || menu.__gyMiniWatched) return;
        menu.__gyMiniWatched = true;
        try {
            // ⚠️ 以前这里有个 `if (miniFeatureAdopted 存在)` 的限制——意思是"没进过小功能页就先不收"。
            //    结果是：你不主动点进小功能，那 7 条就一直堆在设置目录页上，收纳等于没做。
            //    现在无条件收：节点先进 GY_ADOPTED_ENTRIES（游离在文档外也不会丢），
            //    等小功能页画出来时 mountAdoptedEntries 再挂回去。
            new MutationObserver(() => harvestMiniFeatureEntries()).observe(menu, { childList: true });
            harvestMiniFeatureEntries();   // 挂上观察者时先收一遍已经在里面的
        } catch (e) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
    setTimeout(attach, 1500);
})();

// ===================== 🔗 跳到某个开关 / 某个功能 =====================
// 用在两个地方：
//  ① 「此刻」页里列出来的那些开关，点一下直接跳过去开/关
//  ② 某个功能需要先开别的开关才能用时，在它正下方给一句提醒 + 一个跳转
// 跳过去之后会把那一行高亮两秒，否则 29 个开关里你还得自己找。
function gyJumpToSwitch(key) {
    try {
        if (typeof switchMainView === 'function') switchMainView('settings');
        if (typeof openSettingsPanel === 'function') openSettingsPanel('auto');
        // 被跳转的那一项如果正好被"只看开着的/只看关着的"过滤掉了，就先切回全部
        if (typeof setAutoFeatFilter === 'function') setAutoFeatFilter('all');
        setTimeout(() => {
            const def = (typeof AUTO_FEATURE_DEFS !== 'undefined') ? AUTO_FEATURE_DEFS.find(f => f.key === key) : null;
            if (!def) return;
            const row = [...document.querySelectorAll('#autoFeatureList .auto-feat-row')]
                .find(r => r.innerText.includes(def.label));
            if (!row) return;
            row.scrollIntoView({ block: 'center', behavior: 'smooth' });
            row.classList.add('gy-flash');
            setTimeout(() => row.classList.remove('gy-flash'), 2200);
        }, 60);
    } catch (e) { console.warn('[跳转] 出错：', e); }
}

// ===================== 🔎 CSS 选择器速查表 =====================
// 「美化」那一页以前只有一句"想知道该改哪个类名就按 F12"。手机上根本没有 F12，
// 电脑上也得会用开发者工具。这里把**每一页、每一块**能用的选择器直接列出来。
//
// 关键：清单是**现场从 DOM 里扫出来的**，不是手写死的——以后加了新页面、新组件，
// 这张表自己就长出来了，不会跟界面对不上（手写清单一定会过期，这是必然的）。
const GY_CSS_PAGE_NAMES = {
    'view-home': '主页时间线', 'view-profile': '个人资料页', 'view-tag': '标签页',
    'view-search': '搜索结果', 'view-notifications': '通知页', 'view-post-detail': '帖子详情',
    'view-following-list': '我的关注', 'view-chat': '聊天页', 'view-anon-forum': '匿名论坛',
    'view-diary': '信件与日记', 'view-novel': '故事', 'view-story-studio': '续写工作台',
    'view-theater': 'Ta们在做什么', 'view-tabloid': '营销号', 'view-grapevine': '日常（三合一）',
    'view-mobile-trends': '手机·话题', 'view-faction-network': '势力关系网',
    'view-faction-members': '势力成员', 'view-char-relations': '角色关系',
    'view-faction-overview': '势力总览', 'view-memory-album': '回忆相册',
    'view-character-center': '角色中心', 'view-settings': '系统设置', 'view-worldbook': '世界书',
    'view-plugins': '插件页', 'view-presets': '预设页', 'view-ai-enhance': 'AI 增强功能',
    'view-memory-hub': '记忆总览', 'view-watch-together': '一起看电影',
    'view-mini-hub': '小功能', 'view-mall': '商城', 'view-feature-page': '小功能内页'
};
// 页面之外的公共部件（它们不在任何 view- 里）
const GY_CSS_GLOBAL_PARTS = [
    ['左侧边栏 / 导航', '.sidebar-left, .nav-menu, .nav-item, .nav-icon, .user-profile-mini'],
    ['手机顶栏 / 底栏 / 抽屉', '.mobile-top-bar, .mnav-item, .mobile-drawer, .mdrawer-item, .mdrawer-footer'],
    ['右侧栏（趋势 / 推荐）', '#rightPanelTrend, #rightPanelSuggest, .trend-item, .suggest-card'],
    ['所有弹窗', '.modal-overlay, .modal-box, .context-menu, .context-btn'],
    ['所有通知气泡', '#toastContainer, .toast-item, .toast-title, .toast-desc'],
    ['所有按钮', '.btn-primary, .btn-secondary, .btn-post, .btn-edit-small, .btn-cancel'],
    ['所有输入框', '.input-group input, .input-group textarea, .input-group select, .form-hint'],
    ['头像', '.avatar, .profile-avatar-large'],
    ['浮动发帖键', '.fab-post']
];

function gyCssMapRender(force) {
    const box = document.getElementById('gyCssMap');
    if (!box) return;
    const kw = ((document.getElementById('gyCssMapSearch') || {}).value || '').trim().toLowerCase();
    const hit = t => !kw || String(t).toLowerCase().includes(kw);

    // 从一个容器里扫出用得上的选择器（按出现次数排序，只留有意义的）
    const scan = root => {
        const cls = new Map(), ids = [];
        root.querySelectorAll('*').forEach(el => {
            if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) ids.push('#' + el.id);
            (el.className && typeof el.className === 'string' ? el.className.split(/\s+/) : []).forEach(c => {
                if (!c || c.length < 3 || !/^[a-zA-Z][\w-]*$/.test(c)) return;
                cls.set(c, (cls.get(c) || 0) + 1);
            });
        });
        return {
            cls: [...cls.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ sel: '.' + c, n })),
            ids: ids.slice(0, 40).map(i => ({ sel: i, n: 1 }))
        };
    };
    const chip = o => `<span class="gy-css-chip${o.sel[0] === '#' ? ' id' : ''}" onclick="gyCssPick('${o.sel}')" title="${o.n > 1 ? o.n + ' 处' : '唯一'}">${escapeHtml(o.sel)}</span>`;

    let html = '';
    // ① 公共部件
    const gRows = GY_CSS_GLOBAL_PARTS.filter(([name, sel]) => hit(name) || hit(sel));
    if (gRows.length) {
        html += `<div class="gy-css-grp"><div class="gy-css-grp-hd">🌐 全局（每一页都有）</div>`;
        gRows.forEach(([name, sel]) => {
            html += `<div class="gy-css-line"><i>${escapeHtml(name)}</i>${sel.split(',').map(x => chip({ sel: x.trim(), n: 2 })).join('')}</div>`;
        });
        html += `</div>`;
    }
    // ② 每一页
    document.querySelectorAll('.main-content > div[id^="view-"]').forEach(view => {
        const name = GY_CSS_PAGE_NAMES[view.id] || view.id;
        const r = scan(view);
        const items = r.ids.concat(r.cls).filter(o => hit(o.sel) || hit(name));
        if (!items.length) return;
        html += `<div class="gy-css-grp">
            <div class="gy-css-grp-hd">${escapeHtml(name)}　<code>#${view.id}</code></div>
            <div class="gy-css-line">${items.map(chip).join('')}</div>
        </div>`;
    });
    box.innerHTML = html || '<div style="color:#8b98a5;font-size:13px;padding:14px 2px;">没有匹配的选择器。</div>';
}

// 点一下把选择器追加进上面的 CSS 输入框（并把光标放进花括号里）
function gyCssPick(sel) {
    const ta = document.getElementById('globalCSSInput');
    if (!ta) return;
    const snippet = (ta.value && !ta.value.endsWith('\n') ? '\n' : '') + sel + ' {\n    \n}\n';
    ta.value += snippet;
    ta.focus();
    const pos = ta.value.length - 3;
    try { ta.setSelectionRange(pos, pos); } catch (e) {}
    if (typeof showToast === 'function') showToast('', '已加进 CSS 框', sel + ' { }', null, null, false);
}

// ===================== 🧷 前置条件检查（统一版）=====================
// 一个功能能不能真的跑起来，往往不止一个开关：可能还要「角色互动总开关」开着、
// 要把角色切到「TA 自己决定」、要配好 API Key、要在关系网里连过线。
// 以前这些都要用户自己猜——点了没反应，也不知道差哪一步。
//
// gyReqBox([...]) 把所有没满足的条件列在一起，每条都带一个点了就跳过去的入口。
// 全部满足时返回空字符串（不唠叨）。
//
// 支持的条件：
//   { sw:'charTheater' }                     开关要开着
//   { api:true }                             要配 API Key
//   { interaction:true }                     「角色互动总开关」要开着
//   { mode:charId }                          这个角色要切到「TA 自己决定」
//   { rel:true }                             关系网里至少连过一条线
//   { ok:布尔, text:'说明', jump:'js代码' }   自定义一条
function gyReqBox(list, opts) {
    try {
        const rows = [];
        (list || []).forEach(r => {
            if (!r) return;
            if (r.sw) {
                if (typeof isAutoOn === 'function' && isAutoOn(r.sw)) return;
                const def = (typeof AUTO_FEATURE_DEFS !== 'undefined') ? AUTO_FEATURE_DEFS.find(f => f.key === r.sw) : null;
                rows.push({ text: `开关「${escapeHtml((def && def.label) || r.sw)}」还关着`, jump: `gyJumpToSwitch('${r.sw}')`, go: '去打开' });
                return;
            }
            if (r.api) {
                const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
                if (api && api.key) return;
                rows.push({ text: '还没配 API Key', jump: `switchMainView('settings'); openSettingsPanel('api')`, go: '去配置' });
                return;
            }
            if (r.interaction) {
                if (typeof isGlobalCharInteractionEnabled !== 'function' || isGlobalCharInteractionEnabled()) return;
                rows.push({ text: '「角色互动总开关」关着，角色之间不会有任何往来', jump: `switchMainView('settings'); openSettingsPanel('auto')`, go: '去打开' });
                return;
            }
            if (r.mode !== undefined && r.mode !== null) {
                const c = (typeof myCharacters !== 'undefined' ? myCharacters : []).find(x => String(x.id) === String(r.mode));
                if (!c) return;
                if (typeof getCharActMode !== 'function' || getCharActMode(c) === 'auto') return;
                rows.push({ text: `${escapeHtml(c.name)} 现在是「按固定频率」，没切到「TA 自己决定」`, jump: `switchMainView('profile','${c.id}')`, go: '去改' });
                return;
            }
            if (r.rel) {
                if (typeof charRelationships !== 'undefined' && Array.isArray(charRelationships) && charRelationships.length) return;
                rows.push({ text: '关系网里还没有任何两个角色连过线', jump: `switchMainView('factionNetwork')`, go: '去连一条' });
                return;
            }
            if (r.ok === false) rows.push({ text: escapeHtml(r.text || '还差一步'), jump: r.jump || '', go: r.go || '去处理' });
        });
        if (!rows.length) return '';
        const head = (opts && opts.title) || '还差这几步才能真的跑起来';
        return `<div class="gy-req-box">
            <div class="gy-req-hd">⚠️ ${escapeHtml(head)}</div>
            ${rows.map(r => `<div class="gy-req-row"><span>${r.text}</span>${r.jump ? `<b onclick="${r.jump}">${escapeHtml(r.go)} ›</b>` : ''}</div>`).join('')}
        </div>`;
    } catch (e) { return ''; }
}

// 功能依赖提醒：某个功能得先打开别的开关才有用，就在它正下方挂一条。
// 返回一段 HTML，直接塞进面板里。已经开着的话返回空字符串——不唠叨。
function gyNeedSwitchHint(key, whatFor) {
    try {
        if (typeof isAutoOn === 'function' && isAutoOn(key)) return '';
        const def = (typeof AUTO_FEATURE_DEFS !== 'undefined') ? AUTO_FEATURE_DEFS.find(f => f.key === key) : null;
        if (!def) return '';
        return `<div class="gy-need-switch" onclick="gyJumpToSwitch('${key}')">
            ⚠️ ${escapeHtml(whatFor || '这个功能')}需要先打开「${escapeHtml(def.label)}」，现在是关着的。<b>点这里去开</b> ›
        </div>`;
    } catch (e) { return ''; }
}

// ===================== 🕸️ 日常：三合一（小剧场 / 八卦网 / 营销号）=====================
// 这三件事本来就是一条链：小剧场演了什么 → 八卦网就传什么 → 营销号跟进什么。
// 以前它们在侧边栏占三个位置，切来切去看不出是一回事。现在一个入口三个 tab。
//
// 实现上这一页只是个**壳**：真正的内容还是 #view-theater / #view-tabloid 这两块原来的
// DOM（里面的 id、事件、渲染函数一个没动），进哪个 tab 就把哪块搬进壳里。
// 八卦网本来就是个弹窗，暂时还开弹窗——它整套渲染都绑在 #gygsModal 上，
// 硬拆成页面风险太大，等"所有小功能都做成页面"那一轮一起改。
let gyGrapevineTab_ = 'theater';

function gyGrapevineTab(t) {
    gyGrapevineTab_ = t || 'theater';
    const body = document.getElementById('grapevineBody');
    if (!body) return;
    document.querySelectorAll('#grapevineTabs .gy-tab').forEach(b =>
        b.classList.toggle('on', b.dataset.tab === gyGrapevineTab_));

    // 先把两块视图都收回 .main-content（并藏起来），再把要用的那块搬进来
    const main = document.querySelector('.main-content') || document.body;
    ['view-theater', 'view-tabloid'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = 'none';
        if (el.parentElement !== main) main.appendChild(el);
    });

    if (gyGrapevineTab_ === 'gossip') {
        body.innerHTML = `<div style="padding:24px 20px;font-size:13px;color:#536471;line-height:1.9;">
            八卦网现在还是个弹窗（它整套渲染都绑在弹窗上，硬拆成页面容易出事）。<br>
            <button type="button" class="btn-edit-small" style="margin-top:10px;" onclick="if(typeof gygsOpen==='function')gygsOpen();else appAlert('八卦网还没加载好，刷新一下试试。')">🗣️ 打开八卦网</button>
        </div>`;
        return;
    }

    const id = gyGrapevineTab_ === 'tabloid' ? 'view-tabloid' : 'view-theater';
    const el = document.getElementById(id);
    if (!el) { body.innerHTML = '<div style="padding:24px;color:#8b98a5;">这一块还没加载好。</div>'; return; }
    body.innerHTML = '';
    body.appendChild(el);
    el.style.display = 'block';
    // 搬进来之后按各自原本的方式刷新一次内容
    try {
        if (id === 'view-theater') {
            if (typeof renderTheaterPage === 'function') renderTheaterPage(true);
            if (typeof switchTheaterTab === 'function') switchTheaterTab(typeof theaterTab !== 'undefined' ? theaterTab : 'scene');
        } else {
            // ⚠️ 这两个函数名别再写错了：营销号页的刷新入口是 renderTabloidCharPicker（它自己会调
            //    renderTabloidPosts），没有 renderTabloidPage 这个函数。写错了也不会报错——
            //    外面套着 typeof 判断，只是这一页永远不刷新，看起来像"内容没更新"。
            if (typeof renderTabloidCharPicker === 'function') renderTabloidCharPicker();
            else if (typeof renderTabloidPosts === 'function') renderTabloidPosts();
        }
    } catch (e) { console.warn('[日常] 刷新内容出错：', e); }
}
