// ================= NPC 小报及修罗场核心逻辑 =================
let tabloidPosts = []; 

function renderTabloidCharPicker() {
    const picker = document.getElementById('tabloidCharPicker');
    const allChars = [currentUser, ...myCharacters];
    if (allChars.length === 0) {
        picker.innerHTML = '<span style="color:#888;">暂无角色，请先创建角色！</span>';
        return;
    }
    picker.innerHTML = allChars.map(c => `
        <label style="display:flex; align-items:center; gap:5px; background:rgba(255,255,255,0.8); padding:5px 10px; border-radius:9999px; border:1px solid #1d9bf0; cursor:pointer;">
            <input type="checkbox" class="tabloid-char-check" value="${c.id}">
            ${getAvatarHTML(c, 24)} ${c.name}
        </label>
    `).join('');
    renderTabloidPosts();
}

async function generateTabloidPost() {
    const api = getApiConfig(true);
    if(!api.key) return alert("请先在设置中配置 API Key！");
    const selectedIds = Array.from(document.querySelectorAll('.tabloid-char-check:checked')).map(cb => cb.value);
    if (selectedIds.length === 0) return alert("请至少选择一个角色！");

    const selectedChars = selectedIds.map(id => id === 'me' ? currentUser : myCharacters.find(c => c.id == id));
    const isShura = document.getElementById('shuraCheck').checked;
    const customWordCount = document.getElementById('tabloidWordCount').value || 150;
    const customLikes = document.getElementById('tabloidCustomLikes').value;
    const customComments = document.getElementById('tabloidCustomComments').value;
    const customTopic = document.getElementById('tabloidCustomTopic').value.trim();
    const btn = document.getElementById('btnGenTabloid');
    
    btn.innerText = "营销号正在疯狂编造... ⏳"; btn.disabled = true;

    let charPersonas = selectedChars.map(c => `${c.name}(人设：${c.persona})`).join('；');
    
    // 修复: 优化提示词，防止大模型胡言乱语
    let prompt = buildStructuredMessages('你是一个唯恐天下不乱的娱乐营销号。', [],
        `请根据以下角色生成一条爆料推文：${charPersonas}。
${customTopic ? `要求一定要包含这个主题或情节：${customTopic}。` : ''}
${isShura ? "强制开启修罗场模式：狠狠制造多角恋、矛盾与抓马冲突。" : "语气必须极其夸张、震惊体，充满吃瓜感。"}
目标字数：${customWordCount}字左右。${typeof WORD_LIMIT_PRIORITY_NOTE !== 'undefined' ? WORD_LIMIT_PRIORITY_NOTE : ''}
【重要要求】：请直接输出爆料的推文正文，千万不要加上前缀说明、不要使用任何引号包裹，不要输出任何与爆料无关的内容。`);

    try {
        let data = await callChatCompletionAPI(api, prompt);
        let text = data.choices?.[0]?.message?.content?.trim();
        if (text) {
            let post = { id: 'tb_' + Date.now(), char: { ...tabloidAccount }, text: text, timestamp: Date.now(), replies: [], stats: { likes: customLikes !== '' ? parseInt(customLikes) : Math.floor(Math.random()*10000)+1000, comments: customComments !== '' ? parseInt(customComments) : 0 } };
            tabloidPosts.unshift(post);
            renderTabloidPosts(); saveAllData();
            showToast(`<div class="avatar" style="background:#1d9bf0;color:white;font-size:20px;">📰</div>`, `新的八卦爆料！`, text, post.id, null);
            generateNpcCommentsForTabloid(post.id, isShura);
            selectedChars.filter(c => c && c.id !== 'me').forEach(c => triggerRelatedCharacterReactions(c, text, { type: 'tabloid', id: post.id }));
        }
    } catch(e) { alert("生成失败: " + e.message); } finally { btn.innerText = "✨ AI 智能爆料"; btn.disabled = false; }
}

function manualTabloidPost() {
    const text = document.getElementById('tabloidCustomTopic').value.trim();
    if(!text) return alert("请先填写爆料内容！");
    const customLikes = document.getElementById('tabloidCustomLikes').value;
    const customComments = document.getElementById('tabloidCustomComments').value;

    let post = { id: 'tb_' + Date.now(), char: { ...tabloidAccount }, text: text, timestamp: Date.now(), replies: [], stats: { likes: customLikes !== '' ? parseInt(customLikes) : 100, comments: customComments !== '' ? parseInt(customComments) : 0 } };
    tabloidPosts.unshift(post);
    document.getElementById('tabloidCustomTopic').value = ''; renderTabloidPosts(); saveAllData();
}


async function rollTabloidAIParticipation(postId, contextText, contextName) {
    if (typeof isAutoOn === 'function' && !isAutoOn('tabloidAuto')) return;   // 🔌 设置里关掉了「营销号自动参与」
    if (Math.random() >= 0.5) return;
    const post = tabloidPosts.find(p => p.id === postId); if (!post) return;
    const api = getApiConfig(true); if (!api.key) return;
    const actionStrictRule = allowActionTags ? "" : "不要有任何动作、神态或心理描写，不要用括号()或【】，只输出你要说的话。";
    const prompt = `你是娱乐营销号"${tabloidAccount.name}"，人设：${tabloidAccount.persona}。你发布的爆料下，"${contextName}"刚刚评论道："${contextText}"。请你以营销号的口吻（吃瓜、拱火、玩梗）追加一条简短评论，不超过40字。直接输出内容，不要加引号。${actionStrictRule}`;
    try {
        const data = await sendChatRequest(api, prompt);
        const repText = data.choices?.[0]?.message?.content?.trim();
        if (repText) {
            post.replies.push({ charId: 'tabloid_admin', name: tabloidAccount.name, text: repText, timestamp: Date.now() });
            post.stats.comments++;
            if (document.getElementById('view-post-detail').style.display !== 'none') renderSinglePostDetail(postId);
            if (document.getElementById('view-tabloid').style.display !== 'none') renderTabloidPosts();
            saveAllData();
        }
    } catch (e) {}
}

// 有人（用户手动引用，或角色自动引用）把营销号发的爆料转发/引用成了一条新推文时，营销号自己过来"回应一下这次转发"。
// 跟 rollTabloidAIParticipation 不同：那个是回在"营销号原帖"下面的评论区，这个是回在"引用转发这条新推文"的评论区
// （newPost 本身，营销号不在myCharacters里，不会被别的角色回复流程覆盖到，得单独触发）。
async function triggerTabloidReactToQuote(newPost, quotedPost) {
    if (!newPost || !quotedPost || typeof tabloidAccount === 'undefined' || !tabloidAccount) return;
    const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
    if (!api || !api.key) return;
    try {
        const actionStrictRule = (typeof allowActionTags !== 'undefined' && allowActionTags) ? "" : "不要有任何动作、神态或心理描写，不要用括号()或【】，只输出你要说的话。";
        const quoterName = (newPost.char && newPost.char.name) || '有人';
        const prompt = `你是娱乐营销号"${tabloidAccount.name}"，人设：${tabloidAccount.persona}。你之前发布过一条爆料："${(quotedPost.text || '').slice(0, 200)}"。现在"${quoterName}"把这条爆料转发引用了，配文说："${newPost.text || ''}"。请你以营销号的口吻（吃瓜、拱火、玩梗，也可以顺势蹭一波热度）追加一条简短评论回应这次转发，不超过40字。直接输出内容，不要加引号、不要任何多余说明。${actionStrictRule}`;
        const data = await sendChatRequest(api, prompt);
        let repText = data.choices?.[0]?.message?.content?.trim();
        if (!repText) return;
        repText = repText.replace(/^["""]|["""]$/g, '').trim();
        newPost.replies.push({ id: 'r_' + Date.now() + Math.floor(Math.random() * 1000), parentId: null, char: { ...tabloidAccount }, text: repText, timestamp: Date.now(), likes: 0, liked: false });
        if (newPost.stats) newPost.stats.comments = (newPost.stats.comments || 0) + 1;
        if (typeof saveAllData === 'function') saveAllData();
        if (document.getElementById('view-post-detail') && document.getElementById('view-post-detail').style.display !== 'none' && typeof renderSinglePostDetail === 'function') renderSinglePostDetail(newPost.id);
        if (typeof renderPosts === 'function') renderPosts();
    } catch (e) { console.error('营销号回应转发失败：', e); }
}

function generateAutoNpcReaction(postId, triggerName, triggerText, triggerId) {
    spawnNpcComments(postId, true, { triggerName, triggerText, triggerId });
}

function generateNpcCommentsForTabloid(postId, isShura) {
    spawnNpcComments(postId, true, { isShura });
}

function renderTabloidPosts() {
    const container = document.getElementById('tabloidFeedSection');
    if (tabloidPosts.length === 0) { container.innerHTML = '<div class="empty-state">目前还没有爆料。</div>'; return; }
    container.innerHTML = tabloidPosts.map(post => `
        <div class="post-placeholder" style="cursor:pointer;" onclick="switchMainView('postDetail', '${post.id}')">
            <div style="flex-shrink:0;">${getAvatarHTML(post.char, 40)}</div>
            <div class="post-content">
                <div class="post-header">
                    <div class="post-header-info"><div class="post-name">${post.char.name}</div><div class="post-handle">@tabloid_news</div></div>
                    <span style="background:#1d9bf0; color:white; font-size:10px; padding:2px 6px; border-radius:4px;">小报爆料</span>
                </div>
                <div class="post-body">${namespaceInjectedIds(formatPostText(post.text, null, { statusContext: 'post' }), post.id)}</div>
                <div class="post-footer"><div class="post-stats-group" style="gap:40px;"><div>${commentSVG} ${post.stats.comments}</div><div class="like-stat-item" style="cursor:pointer; display:flex; align-items:center; gap:4px;" onclick="event.stopPropagation(); toggleMainPostLike('${post.id}', event)"><span class="like-icon-wrap">${post.userLiked ? likeSVGFilled : likeSVG}</span> <span class="like-count">${post.stats.likes}</span></div></div></div>
            </div>
        </div>`).join('');
    if (typeof enableChatScriptExecution !== 'undefined' && enableChatScriptExecution) { try { executeInjectedScripts(container); } catch (e) { console.error('执行小报注入脚本时出错：', e); } }
}

function openTabloidProfileModal() {
    document.getElementById('tbName').value = tabloidAccount.name || ''; document.getElementById('tbHandle').value = tabloidAccount.handle || '';
    document.getElementById('tbPersona').value = tabloidAccount.persona || ''; document.getElementById('tbBio').value = tabloidAccount.bio || '';
    
    if (tabloidAccount.avatarImg) { document.getElementById('tbAvatarPreview').src = tabloidAccount.avatarImg; document.getElementById('tbAvatarPreview').style.display = 'block'; } else { document.getElementById('tbAvatarPreview').style.display = 'none'; }
    if (tabloidAccount.bgImg) { document.getElementById('tbBgPreview').src = tabloidAccount.bgImg; document.getElementById('tbBgPreview').style.display = 'block'; } else { document.getElementById('tbBgPreview').style.display = 'none'; }
    
    tempCropResults.tbAvatar = tabloidAccount.avatarImg || null;
    tempCropResults.tbBg = tabloidAccount.bgImg || null;

    openModal('tabloidProfileModal');
}

async function saveTabloidProfile() {
    tabloidAccount.name = document.getElementById('tbName').value.trim() || tabloidAccount.name;
    tabloidAccount.handle = document.getElementById('tbHandle').value.trim();
    tabloidAccount.persona = document.getElementById('tbPersona').value.trim();
    tabloidAccount.bio = document.getElementById('tbBio').value.trim();
    
    if (tempCropResults.tbAvatar) tabloidAccount.avatarImg = tempCropResults.tbAvatar;
    if (tempCropResults.tbBg) tabloidAccount.bgImg = tempCropResults.tbBg;

    saveAllData(); closeModal('tabloidProfileModal'); alert("保存成功！");
}
// 评论下面那一行：跟推文操作栏同一套排法（.post-actions/.pa-item），
// 回复 · 转发 · 赞 · 浏览 四个均分，分享顶到最右。收藏收进右键菜单里，
// 不再单独占一个没人认得出的五角星。
function getActionIconsHTML(likes, isLiked, replyIdx, postId, isSubReply, isFavorited) {
    const cur = isLiked ? likeSVGFilled : likeSVG;   // v107：不再注入粉色，颜色交给 .x-icon.liked（跟主题走）
    return `
        <div class="post-actions${isSubReply ? ' sub' : ''}">
            <div class="pa-item" onclick="event.stopPropagation(); toggleInlineReply(${replyIdx}, '${postId}')" title="回复">${commentSVG}<span>回复</span></div>
            <div class="pa-item rt" onclick="event.stopPropagation(); gyReplyQuote(${replyIdx}, '${postId}')" title="引用这条评论">${retweetSVG}</div>
            <div class="pa-item like ${isLiked ? 'on' : ''}" onclick="event.stopPropagation(); likeReply(${replyIdx}, '${postId}', event)" title="喜欢"><span class="like-icon-wrap">${cur}</span><span class="reply-like-count">${likes || 0}</span></div>
            <div class="pa-item pa-share" onclick="event.stopPropagation(); gyReplyMenu(event, ${replyIdx}, '${postId}')" title="更多">${moreDotsSVG}</div>
        </div>
    `;
}

// 评论的「引用」：把这条评论的内容带进回复框，跟论坛的引用回复一个意思
window.gyReplyQuote = function (replyIdx, postId) {
    try {
        if (typeof toggleInlineReply === 'function') toggleInlineReply(replyIdx, postId);
        const post = String(postId).startsWith('tb_')
            ? (typeof tabloidPosts !== 'undefined' ? tabloidPosts : []).find(p => p.id == postId)
            : globalPosts.find(p => p.id == postId);
        const r = post && post.replies && post.replies[replyIdx];
        if (!r) return;
        const name = (r.char && r.char.name) || r.name || '';
        setTimeout(() => {
            // 输入框的真实 id 是 inline-input-<postId>-<replyIdx>（见 js/10 的 toggleInlineReply）
            const box = document.getElementById(`inline-input-${postId}-${replyIdx}`);
            if (box) { box.value = `//@${name}：${String(r.text || '').slice(0, 40)}　`; box.focus(); }
        }, 60);
    } catch (e) {}
};

// 评论的 ⋮：收藏、修改、删除都在这儿（右键菜单同样能开，这个是给手机用的）
window.gyReplyMenu = function (e, replyIdx, postId) {
    if (typeof showReplyContextMenu === 'function') showReplyContextMenu(e, postId, replyIdx);
};

// ===== 新增：详情页专用的点赞和删除功能 =====
function toggleDetailLike(postId) {
    let isTabloid = postId.startsWith('tb_');
    let post = isTabloid ? tabloidPosts.find(p => p.id === postId) : globalPosts.find(p => p.id == postId);
    if (!post) return;
    
    // 切换点赞状态，并更新点赞数
    post.userLiked = !post.userLiked;
    post.stats.likes = Math.max(0, parseStat(post.stats.likes) + (post.userLiked ? 1 : -1));
    
    saveAllData(); // 保存数据
    renderSinglePostDetail(postId); // 重新渲染页面，刷新红心状态和数字
}

async function deleteDetailPost(postId) {
    if (!(await appConfirm('确定要彻底删除这条推文吗？该操作不可逆！'))) return;
    
    let isTabloid = postId.startsWith('tb_');
    if (isTabloid) {
        tabloidPosts = tabloidPosts.filter(p => p.id != postId);
    } else {
        globalPosts = globalPosts.filter(p => p.id != postId);
    }
    
    saveAllData(); // 保存数据
    switchMainView('home'); // 删除后自动弹回主页
    if (typeof renderPosts === 'function') renderPosts(); // 刷新主页列表
}
function likeReply(replyIdx, postId, event) {
    if (event) event.stopPropagation();

    let isTabloid = postId.startsWith('tb_');
    let post = isTabloid ? tabloidPosts.find(p => p.id === postId) : globalPosts.find(p => p.id == postId);

    if (post && post.replies && post.replies[replyIdx]) {
        let reply = post.replies[replyIdx];
        if (!reply.likedBy) reply.likedBy = [];

        let hasLiked = reply.likedBy.includes('me');
        if (hasLiked) {
            reply.liked = false;
            reply.likedBy = reply.likedBy.filter(id => id !== 'me');
            reply.likes = Math.max(0, (reply.likes || 1) - 1);
        } else {
            reply.liked = true;
            if (!reply.likedBy.includes('me')) reply.likedBy.push('me');
            reply.likes = (reply.likes || 0) + 1;
        }

        saveAllData();
        if (document.getElementById('view-post-detail').style.display !== 'none') {
            renderSinglePostDetail(postId);
        }
    }
}

function favoriteReply(replyIdx, postId, event) {
    if (event) event.stopPropagation();

    let isTabloid = postId.startsWith('tb_');
    let post = isTabloid ? tabloidPosts.find(p => p.id === postId) : globalPosts.find(p => p.id == postId);

    if (post && post.replies && post.replies[replyIdx]) {
        let reply = post.replies[replyIdx];
        reply.favorited = !reply.favorited;

        saveAllData();
        if (document.getElementById('view-post-detail').style.display !== 'none') {
            renderSinglePostDetail(postId);
        }
    }
}
// ==========================================
// 核心引擎：故事与论坛双模式切换及渲染 (终极完整版)
// ==========================================

// 1. 防冲突变量声明
var currentNovelTab = 'novel';
var forumThreads = typeof forumThreads !== 'undefined' ? forumThreads : []; 
var currentForumFilter = 'all'; 
var currentQuoteFloor = null;

// 2. 辅助功能：劫持顶部标题栏返回键，实现层级后退
function initNovelHeader() {
    const novelHeader = document.querySelector('#view-novel .header-title');
    if (novelHeader && !novelHeader.dataset.bound) {
        novelHeader.innerHTML = `<div class="back-btn" onclick="handleGlobalNovelBack()">←</div> 我们的故事`;
        novelHeader.dataset.bound = "true";
    }
}

function handleGlobalNovelBack() {
    if (document.getElementById('current-forum-wrap')) {
        // 如果在论坛详情页 -> 返回论坛列表
        renderForumList();
    } else if (document.getElementById('novelEditorWrapper') && document.getElementById('novelEditorWrapper').style.display !== 'none') {
        // 如果在故事编辑页 -> 返回故事列表
        closeNovelEditor();
    } else if (document.getElementById('novelReaderWrapper') && document.getElementById('novelReaderWrapper').style.display !== 'none') {
        // 如果在沉浸阅读页 -> 返回故事编辑页
        closeNovelReader();
    } else {
        // 如果在列表页 -> 返回首页
        switchMainView('home');
    }
}

// 3. 辅助功能：论坛真实头像获取器
function getForumAvatar(authorName) {
    if (authorName === currentUser.name || authorName === '楼主') return getAvatarHTML(currentUser, 36);
    let char = myCharacters.find(c => c.name === authorName);
    if (char) return getAvatarHTML(char, 36);
    return getAvatarHTML({name: authorName, avatarEmoji: '👤', themeColor: '#536471'}, 36);
}

// 4. 动态插入顶部 Tab 标签
function initNovelTabsIfNeeded() {
    initNovelHeader(); // 绑定返回键
    const viewNovel = document.getElementById('view-novel');
    if (!document.getElementById('novelTabContainer')) {
        const tabsHTML = `
        <div id="novelTabContainer" class="novel-top-tabs">
            <div id="tab-novel" class="novel-tab active" onclick="switchNovelTab('novel')">故事</div>
            <div id="tab-forum" class="novel-tab" onclick="switchNovelTab('forum')">论坛</div>
        </div>
        <div id="novelForumWrapper" style="display:none;"></div>`;
        
        // 确保标签栏紧紧贴在标题栏的正下方
        const header = viewNovel.querySelector('.header-title');
        if (header) {
            header.insertAdjacentHTML('afterend', tabsHTML);
        } else {
            viewNovel.insertAdjacentHTML('afterbegin', tabsHTML);
        }
    }
}

// 5. 标签切换逻辑
function switchNovelTab(tab) {
    currentNovelTab = tab;
    document.getElementById('tab-novel').className = tab === 'novel' ? 'novel-tab active' : 'novel-tab';
    document.getElementById('tab-forum').className = tab === 'forum' ? 'novel-tab active' : 'novel-tab';
    
    if (tab === 'novel') {
        document.getElementById('novelForumWrapper').style.display = 'none';
        if (typeof currentEditingNovelId !== 'undefined' && currentEditingNovelId && document.getElementById('novelEditorWrapper') && document.getElementById('novelEditorWrapper').style.display !== 'none') {
            // 保持编辑器开启
        } else if (document.getElementById('novelReaderWrapper') && document.getElementById('novelReaderWrapper').style.display !== 'none') {
            // 保持阅读器开启
        } else {
            renderNovelListBase();
        }
    } else {
        if(document.getElementById('novelListWrapper')) document.getElementById('novelListWrapper').style.display = 'none';
        if(document.getElementById('novelEditorWrapper')) document.getElementById('novelEditorWrapper').style.display = 'none';
        if(document.getElementById('novelReaderWrapper')) document.getElementById('novelReaderWrapper').style.display = 'none';
        
        document.getElementById('novelForumWrapper').style.display = 'block';
        renderForumList();
    }
}

// 6. 重写原先的入口函数
function renderNovelList() {
    initNovelTabsIfNeeded();
    switchNovelTab('novel');
}

function renderNovelListBase() {
    document.getElementById('novelListWrapper').style.display = 'block';
    if(document.getElementById('novelEditorWrapper')) document.getElementById('novelEditorWrapper').style.display = 'none';
    if(document.getElementById('novelReaderWrapper')) document.getElementById('novelReaderWrapper').style.display = 'none';
    
    const container = document.getElementById('novelCardsContainer');
    if (typeof globalNovels === 'undefined' || globalNovels.length === 0) {
        container.innerHTML = '<div class="empty-state" style="width:100%;">还未开启我们的旅程</div>'; return;
    }
    container.innerHTML = globalNovels.map(n => {
        let outlinePrev = n.outline ? n.outline.substring(0, 55) + '...' : '暂无大纲';
        return `
        <div class="diary-card novel-card" onclick="openNovelDetail('${n.id}')" oncontextmenu="showNovelContextMenu(event, '${n.id}')">
            <div class="diary-card-title" style="font-size:18px;">${n.title || '未命名故事'}</div>
            <div class="diary-card-date" style="color:#f91880; font-weight:bold;">已写 ${n.chapters ? n.chapters.length : 0} 章</div>
            <div class="diary-card-excerpt" style="color:#536471;">${outlinePrev}</div>
        </div>`;
    }).join('');
}

// 7. 渲染论坛帖子列表
function renderForumList() {
    let wrapper = document.getElementById('novelForumWrapper');
    // ⚠️ 判空：这个容器只有在"故事→论坛"这个 Tab 打开时才存在。
    // 角色后台自动发帖、或者用户在别的页面上让角色代笔发帖时，页面上根本没有这个元素，
    // 之前会直接在最后 wrapper.innerHTML = html 那一行抛
    // "Cannot set properties of null"——帖子其实已经存进 forumThreads 了，
    // 但调用方收到的是"失败"，于是给用户弹一个假的失败提示。
    // 没这个容器就说明用户压根没在看论坛，不用渲染，安静返回即可。
    if (!wrapper) return;
    let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 16px; background:#f7f9f9; border-bottom:1px solid #eff3f4;">
        <span style="font-size:14px; font-weight:bold; color:#536471;">热点讨论</span>
        <button onclick="openCreateForumModal()" style="padding:6px 16px; background:#1d9bf0; color:white; border:none; border-radius:9999px; cursor:pointer; font-size:14px; font-weight:bold;">发布新帖</button>
    </div>`;

    if (forumThreads.length === 0) {
        html += '<div class="empty-state">当前没有任何帖子，快来抢首杀吧！</div>';
    } else {
        forumThreads.forEach(thread => {
            let authorName = thread.author || '楼主';
            let avatarHtml = getForumAvatar(authorName);
            let replyCount = thread.replies ? thread.replies.length : 0;
            let totalLikes = (thread.likes || 0) + (thread.replies ? thread.replies.reduce((sum, r) => sum + (r.likes || 0), 0) : 0);
            let timeStr = timeAgo(thread.timestamp || Date.now());

            html += `
            <div class="forum-card-v2" onclick="openForumThread('${thread.id}')" oncontextmenu="showForumReplyContextMenu(event, '${thread.id}', 1)">
                <div class="forum-card-header">
                    ${avatarHtml}
                    <span class="forum-card-author">${authorName}</span>
                    <span class="forum-card-time">${timeStr}</span>
                </div>
                <div class="forum-card-title">${thread.title}</div>
                <div class="forum-card-preview">${thread.content}</div>
                <div class="forum-card-footer">
                    <div class="forum-card-icon">👍 ${totalLikes}</div>
                    <div class="forum-card-icon">💬 ${replyCount}</div>
                </div>
            </div>`;
        });
    }
    wrapper.innerHTML = html;
}

// 8. 渲染帖子详情页
function openForumThread(threadId) {
    let thread = forumThreads.find(t => t.id === threadId);
    if (!thread) return;

    let wrapper = document.getElementById('novelForumWrapper');
    let repliesToShow = thread.replies || [];
    
    if (currentForumFilter === 'op') repliesToShow = repliesToShow.filter(r => r.isOp);
    else if (currentForumFilter === 'hot') repliesToShow = [...repliesToShow].sort((a, b) => b.likes - a.likes);

    let allFloors = [];
    if (currentForumFilter !== 'hot') {
        allFloors.push({ floor: 1, author: thread.author || '楼主', isOp: true, content: thread.content, likes: thread.likes || 0, timestamp: thread.timestamp || Date.now(), isMainPost: true });
    }
    allFloors = allFloors.concat(repliesToShow);

    let html = `
    <div style="background:rgba(255,255,255,0.95); backdrop-filter:blur(12px); border-bottom:1px solid #eff3f4; padding:10px 16px; position:sticky; top:96px; z-index:40; display:flex; justify-content:flex-end;">
        <div style="display:flex; gap:6px;">
            <button style="padding:4px 8px; border:1px solid #ccc; border-radius:4px; font-size:12px; cursor:pointer; background:${currentForumFilter==='all'?'#1d9bf0':'white'}; color:${currentForumFilter==='all'?'white':'#333'};" onclick="setForumFilter('${threadId}', 'all')">全部</button>
            <button style="padding:4px 8px; border:1px solid #ccc; border-radius:4px; font-size:12px; cursor:pointer; background:${currentForumFilter==='op'?'#1d9bf0':'white'}; color:${currentForumFilter==='op'?'white':'#333'};" onclick="setForumFilter('${threadId}', 'op')">只看楼主</button>
            <button style="padding:4px 8px; border:1px solid #ccc; border-radius:4px; font-size:12px; cursor:pointer; background:${currentForumFilter==='hot'?'#1d9bf0':'white'}; color:${currentForumFilter==='hot'?'white':'#333'};" onclick="setForumFilter('${threadId}', 'hot')">热评</button>
        </div>
    </div>
    
    <div class="forum-detail-v2" id="current-forum-wrap">
        <div class="forum-detail-title-box">
            <div class="forum-detail-title editable-text" data-type="title" style="cursor:text;" title="双击/长按修改">${thread.title}</div>
        </div>
    `;

    allFloors.forEach(r => {
        let opTag = r.isOp ? `<span class="forum-op-badge">楼主</span>` : '';
        let avatarHtml = getForumAvatar(r.author); 
        let timeStr = timeAgo(r.timestamp);
        
        let quoteHtml = '';
        if (r.quoteFloor) {
            let quoteTarget = thread.replies.find(x => x.floor === r.quoteFloor) || { author: thread.author || '楼主', content: thread.content };
            quoteHtml = `<div class="forum-quote-box"><span style="font-weight:bold; color:#0f1419;">${r.quoteFloor}楼 ${quoteTarget.author}：</span>${quoteTarget.content}</div>`;
        }

        html += `
        <div class="forum-floor" oncontextmenu="showForumReplyContextMenu(event, '${threadId}', ${r.floor})">
            <div class="forum-floor-header">
                <div class="forum-floor-userinfo">
                    ${avatarHtml}
                    <div>
                        <div class="forum-floor-name">${r.author} ${opTag}</div>
                        <div class="forum-floor-time">${timeStr}</div>
                    </div>
                </div>
                <div class="forum-floor-meta">#${r.floor}</div>
            </div>
            ${quoteHtml}
            <div class="forum-floor-content editable-text" data-floor="${r.floor}" style="cursor:text;">${r.content}</div>
            <div class="forum-floor-actions">
                <span onclick="likeForumReply('${threadId}', ${r.floor}, ${r.isMainPost})" style="cursor:pointer;">👍 ${r.likes || 0}</span>
                <span onclick="replyForumFloor('${threadId}', ${r.floor})" style="cursor:pointer;">💬 引用回复</span>
                <span onclick="gyForumEditFloor('${threadId}', ${r.floor})" style="cursor:pointer;">✏️ 修改</span>
                ${r.isMainPost ? '' : `<span onclick="gyForumDelFloor('${threadId}', ${r.floor})" style="cursor:pointer;color:#f91880;">🗑️ 删除</span>`}
            </div>
        </div>`;
    });

    html += `
    <div class="forum-reply-box-wrapper">
        <input type="text" id="forumReplyInput" placeholder="发布回复 (@角色名 可召唤回复)..." style="flex:1; padding:10px 16px; border:1px solid #cfd9de; border-radius:9999px; outline:none; font-size:15px; background:#f7f9f9;">
        <button onclick="submitForumReply('${threadId}')" style="background:#1d9bf0; color:white; border:none; padding:8px 20px; border-radius:9999px; margin-left:12px; font-weight:bold; font-size:15px; cursor:pointer;">发送</button>
    </div>
    </div>`;

    wrapper.innerHTML = html;
    window.scrollTo(0, 0); 
    bindEditableEvents(threadId);
}

// 💬 引用回复某一楼。
// ⚠️ 这个函数原来**根本不存在**——楼层上那个"💬 引用回复"绑的就是它，点下去只在控制台
// 报一句 replyForumFloor is not defined，界面上毫无反应。周边零件其实都齐了：
// currentQuoteFloor 变量在、submitForumReply 会把它存成 quoteFloor、渲染那边也会画引用框，
// 就缺中间这一下把楼层号记下来。
// 再点一次同一楼 = 取消引用。
function replyForumFloor(threadId, floor) {
    const input = document.getElementById('forumReplyInput');
    if (!input) return;
    if (currentQuoteFloor === floor) {
        currentQuoteFloor = null;
        input.placeholder = '发布回复 (@角色名 可召唤回复)...';
    } else {
        currentQuoteFloor = floor;
        input.placeholder = `正在引用 ${floor} 楼（再点一次取消）…`;
    }
    input.focus();
}

function setForumFilter(threadId, type) { currentForumFilter = type; openForumThread(threadId); }

function bindEditableEvents(threadId) {
    const els = document.querySelectorAll('#novelForumWrapper .editable-text');
    els.forEach(el => {
        let pressTimer;
        el.addEventListener('touchstart', (e) => { pressTimer = setTimeout(() => triggerEdit(el, threadId), 800); });
        el.addEventListener('touchend', () => clearTimeout(pressTimer));
        el.addEventListener('touchmove', () => clearTimeout(pressTimer));
        el.addEventListener('dblclick', (e) => { e.stopPropagation(); triggerEdit(el, threadId); });
    });
}

// ✏️ 楼层改内容 / 🗑️ 删楼。
// 以前只能双击或者长按那段文字才能改——没有任何提示，等于没有。现在楼层操作栏里直接给按钮。
window.gyForumEditFloor = async function (threadId, floor) {
    const thread = forumThreads.find(t => t.id === threadId);
    if (!thread) return;
    const isMain = floor === 1;
    const cur = isMain ? thread.content : ((thread.replies.find(r => r.floor === floor) || {}).content || '');
    const next = await appPrompt('修改这一楼的内容：', cur);
    if (next === null || next.trim() === '' || next === cur) return;
    if (isMain) thread.content = next;
    else { const rp = thread.replies.find(r => r.floor === floor); if (rp) rp.content = next; }
    saveAllData(); openForumThread(threadId);
};
window.gyForumDelFloor = async function (threadId, floor) {
    if (!(await appConfirm('删掉这一楼？楼层号不会重排，引用它的楼会显示原文。'))) return;
    const thread = forumThreads.find(t => t.id === threadId);
    if (!thread) return;
    thread.replies = (thread.replies || []).filter(r => r.floor !== floor);
    saveAllData(); openForumThread(threadId);
};

async function triggerEdit(el, threadId) {
    let oldText = el.innerText;
    let newText = await appPrompt("修改内容：", oldText);
    if (newText !== null && newText !== oldText && newText.trim() !== '') {
        let thread = forumThreads.find(t => t.id === threadId);
        let type = el.getAttribute('data-type');
        let floor = parseInt(el.getAttribute('data-floor'));
        
        if (type === 'title') thread.title = newText;
        else if (floor === 1) thread.content = newText;
        else {
            let reply = thread.replies.find(r => r.floor === floor);
            if (reply) reply.content = newText;
        }
        saveAllData(); openForumThread(threadId);
    }
}


// 9. 用户回复与 AI 推演逻辑 (@角色回复核心)
async function submitForumReply(threadId) {
    const input = document.getElementById('forumReplyInput');
    const text = input.value.trim();
    if(!text) return;

    let thread = forumThreads.find(t => t.id === threadId);
    let nextFloor = thread.replies.length > 0 ? thread.replies[thread.replies.length - 1].floor + 1 : 2;

    thread.replies.push({ floor: nextFloor, author: currentUser.name || '楼主', isOp: true, content: text, quoteFloor: currentQuoteFloor, likes: 0, timestamp: Date.now() });

    input.value = ''; currentQuoteFloor = null; input.placeholder = "发布回复 (@角色名 可召唤回复)...";
    saveAllData(); openForumThread(threadId);

    const btn = input.nextElementSibling;
    let oldTxt = btn.innerText; btn.innerText = "生成中..."; btn.disabled = true;

    // 强化艾特检测
    let mentionedChars = myCharacters.filter(c => text.includes('@' + c.name) || text.includes('＠' + c.name));
    
    if (mentionedChars.length > 0) {
        let lastRepText = text;
        for (let char of mentionedChars) {
            // 让角色进行回复，并记录角色回复的文本
            lastRepText = await triggerForumCharReply(thread, char, text) || lastRepText;
        }
        // 🎯 核心修改：角色回复完毕后，继续召唤路人NPC对角色的发言跟帖推进！
        await generateNpcForumReplies(thread, nextFloor, lastRepText);
    } else {
        // 没有艾特角色时，直接触发路人NPC跟帖
        await generateNpcForumReplies(thread, nextFloor, text);
    }

    btn.innerText = oldTxt; btn.disabled = false;
}

// ==========================================
// 11. 论坛专属新消息弹窗提醒器 (居中滑下、支持点击跳转)
// ==========================================
function showForumToast(title, content, avatarHtml, threadId) {
    // 使用专属的容器，避免与原先推特风格右上角弹窗冲突
    let container = document.getElementById('forumToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'forumToastContainer';
        document.body.appendChild(container);
    }
    
    // 强制位于页面顶部水平居中
    container.style.position = 'fixed';
    container.style.top = '65px'; 
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.zIndex = '999999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center'; // 内部卡片居中
    container.style.pointerEvents = 'none';

    let toast = document.createElement('div');
    toast.style.cssText = `
        background: rgba(255, 255, 255, 0.98);
        backdrop-filter: blur(10px);
        border-left: 4px solid #1d9bf0;
        border-radius: 8px;
        padding: 14px 18px;
        margin-bottom: 12px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        display: flex;
        gap: 12px;
        align-items: center;
        width: calc(100vw - 32px); /* 手机端自适应占满屏 */
        max-width: 680px; /* 电脑端和详情页主流宽度一致 */
        transform: translateY(-150%); /* 动画初始位置：从上方视口外 */
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
        pointer-events: auto;
        box-sizing: border-box;
        cursor: ${threadId ? 'pointer' : 'default'};
    `;
    
    // 核心跳转逻辑：如果传入了 threadId，点击则直接跳转并打开帖子
    if (threadId) {
        toast.onclick = () => {
            switchMainView('novel'); // 强制跳转到大板块
            switchNovelTab('forum'); // 切到论坛 Tab
            openForumThread(threadId); // 渲染详情页
            
            // 点击后立即消失
            toast.style.transform = 'translateY(-150%)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        };
    }

    let avatarPart = '';
    if (avatarHtml) {
        if (avatarHtml.startsWith('<')) avatarPart = `<div style="flex-shrink:0;">${avatarHtml}</div>`;
        else avatarPart = `<div style="font-size:24px; flex-shrink:0;">${avatarHtml}</div>`;
    }

    toast.innerHTML = `
        ${avatarPart}
        <div style="flex:1; min-width:0;">
            <div style="font-size:15px; font-weight:bold; color:#0f1419; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</div>
            <div style="font-size:14px; color:#536471; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.4;">${content}</div>
        </div>
    `;
    
    container.appendChild(toast);
    
    // 触发向下浮现动画 (translateY)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });
    });
    
    // 5秒后自动向上滑出并销毁
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.transform = 'translateY(-150%)';
            toast.style.opacity = '0';
            setTimeout(() => { if (toast.parentElement) toast.remove(); }, 400);
        }
    }, 5000);
}


// === 专属角色在论坛收到 @ 时的回复 ===
async function triggerForumCharReply(thread, char, userText) {
    const api = getApiConfig(true);
    if (!api.key) { alert("⚠️ 请先在设置中配置 API Key！"); return null; }

    let recentReplies = thread.replies.slice(-5).map(r => `${r.floor}楼 [${r.author}]: ${r.content}`).join('\n');
    // 修复：之前这里是手写的极简prompt（只有人设一句话），完全没走 buildBasePrompt，漏了世界书/关系网/预设/记忆这些上下文，
    // 角色在论坛里@回复容易OOC、也感知不到"这个人我到底认不认识"（关系网里的陌生人规则）。换成buildBasePrompt统一走一遍完整上下文。
    let prompt = buildStructuredMessages(buildBasePrompt(char, false, recentReplies) + '你正在逛中文论坛。', [],
        `【主帖标题】：《${thread.title}》
    【最近讨论】：\n${recentReplies}

    刚刚楼主(用户)艾特了你："${userText}"。
    请结合你的人设，直接输出你要回复的话（不超过${typeof commentWordLimit !== 'undefined' ? commentWordLimit : 30}字，不要带引号，符合论坛互动语气）。即使这只是一条论坛回帖而不是完整对话，如果你的世界观设定/正则脚本里要求每次输出固定附带某种格式标签、状态栏或HTML卡片，也请照常带上，不要因为是论坛场景就省略。警告：既然用户主动@了你，你【必须】立刻进行回复，绝对不能忽略或输出"NO"。
    ${getFinalAnswerMarkerPromptNote()}`);

    try {
        let data = await callChatCompletionAPI(api, prompt);

        let repText = data.choices?.[0]?.message?.content?.trim();
        // 去掉可能混进来的思维链前缀（比如<think>...</think>），回复只应该显示真正的内容。
        if (repText) repText = stripLeadingReasoningBlocks(repText).rest.trim();
        if (repText) repText = stripUndelimitedReasoningIfOverLength(repText, typeof commentWordLimit !== 'undefined' ? commentWordLimit : 30);
        if (repText && !repText.toUpperCase().startsWith("NO")) {
            repText = repText.replace(/^["“]|["”]$/g, '').trim();
            // 烘焙该角色的生成后正则脚本，让状态栏/卡片等HTML跟推文/日记/论坛保持一致地生效。
            repText = applyRegexScripts(repText, 'ai_output', char.id);
            let nextFloor = thread.replies.length > 0 ? thread.replies[thread.replies.length - 1].floor + 1 : 2;
            thread.replies.push({
                floor: nextFloor, author: char.name, charId: char.id, isOp: false, content: repText, quoteFloor: null, likes: 0, timestamp: Date.now()
            });
            saveAllData();
            if (document.getElementById('current-forum-wrap')) openForumThread(thread.id);
            
            // 🎯 触发弹窗并传入 thread.id 支持点击跳转
            showForumToast(`收到 ${char.name} 的回复`, repText, getForumAvatar(char.name), thread.id);
            triggerRelatedCharacterReactions(char, repText, { type: 'forum', thread: thread });
            return repText;
        }
    } catch(e) { 
        console.error("角色回复失败", e); 
    }
    return null;
}

// === AI 生成普通 NPC 论坛言论 ===
async function generateNpcForumReplies(thread, targetFloor, userText) {
    const api = getApiConfig(true);
    if (!api.key) { console.warn('[论坛NPC跟帖] 未配置API Key，跳过生成'); return; }

    let recentReplies = thread.replies.slice(-6).map(r => `${r.floor}楼 [${r.author}]: ${r.content}`).join('\n');
    // 🐛 修复：这里之前引用的 globalWorldbook 这个变量在整个项目里根本不存在（typeof永远是'undefined'），
    // wbContext 实际上一直是空字符串，世界书设定从来没真正传给过论坛NPC跟帖的生成——现在改成跟其它地方一样，
    // 读全局世界书条目（isGlobal且启用）拼成文本。
    let wbContext = (typeof worldbooks !== 'undefined' ? worldbooks.filter(w => w.isGlobal && w.enabled !== false).map(w => `${w.title}：${w.content}`).join('\n') : '');
    let txtContext = thread.txtContext ? `【附加参考背景】：${thread.txtContext.substring(0, 1500)}` : '';

    let prompt = `你现在是一个活跃在中文互联网论坛的资深吃瓜网友群体。请结合以下背景，生成 2 到 4 条路人网友跟帖。
    【背景设定】：${wbContext} ${txtContext}
    【主帖】标题：《${thread.title}》
    【最近跟帖】：\n${recentReplies}
    ${userText ? `【刚刚前排回复了】：${userText}` : ''}

    要求：
    1. 语气贴近真实论坛网民（使用吃瓜、离谱、楼主等口癖），每条不超过${typeof commentWordLimit !== 'undefined' ? commentWordLimit : 30}字。
    2. 可以引用之前的楼层（quoteFloor填数字，如不引用填null）。
    3. **重要**：这几条跟帖里至少要有一条是在回复上面某位网友（不是回复楼主）——网友之间互相抬杠、附和、
       纠正对方是论坛最常见的样子。回谁就把 quoteFloor 填成那一楼的楼层号，内容里也自然地带上对方的观点。
       不要几个人各说各的、都只对着楼主说话，那样看起来像一堆机器人排队发言。
    必须且只能返回纯 JSON 数组格式：
    [{"author": "网友ID", "content": "回复文本", "quoteFloor": null, "likes": 23}]
    ${getFinalAnswerMarkerPromptNote()}`;

    try {
        let rawText = (await sendChatRequest(api, prompt)).choices?.[0]?.message?.content?.trim() || "[]";
        // 优先按"正式输出标记"精确切割，彻底避开思考过程里可能出现的草稿/示例JSON片段。
        rawText = extractAfterFinalMarker(rawText);
        // 🐛 修复"论坛没人回复"的一大来源：不少模型即使明确要求"只返回JSON"，还是习惯用```json代码块包一层，
        // 或者在JSON前后加几句寒暄——之前直接找第一个'['和最后一个']'截取，代码块标记本身不影响截取，
        // 但下面加一道保险：先去掉代码块围栏，减少截取范围里混入围栏文字导致JSON.parse失败的情况。
        rawText = rawText.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
        let startIndex = rawText.indexOf('['); let endIndex = rawText.lastIndexOf(']');
        if (startIndex === -1 || endIndex === -1) {
            console.warn('[论坛NPC跟帖] AI没有返回可识别的JSON数组，跳过这次生成。原始返回：', rawText);
            return;
        }
        let jsonArr;
        try {
            jsonArr = JSON.parse(rawText.substring(startIndex, endIndex + 1));
        } catch (parseErr) {
            // 之前这里的失败会被最外层catch(e){}完全吞掉，用户只会看到"论坛没人回复"、但根本不知道为什么，
            // 也没法反馈。现在至少把原始文本打进控制台，方便定位是模型输出格式的问题还是别的问题。
            console.warn('[论坛NPC跟帖] JSON解析失败，原始返回：', rawText, parseErr);
            return;
        }
        if (!Array.isArray(jsonArr) || jsonArr.length === 0) {
            console.warn('[论坛NPC跟帖] AI返回的不是有效的非空数组：', jsonArr);
            return;
        }

        let newRepliesCount = 0;
        jsonArr.forEach(npcReply => {
            let currentMaxFloor = thread.replies.length > 0 ? thread.replies[thread.replies.length - 1].floor : 1;
            thread.replies.push({
                floor: currentMaxFloor + 1, author: npcReply.author || '热心网友',
                isOp: false, content: npcReply.content || '...', quoteFloor: npcReply.quoteFloor || null,
                likes: npcReply.likes || Math.floor(Math.random() * 50), timestamp: Date.now()
            });
            newRepliesCount++;
        });
        saveAllData();
        if (document.getElementById('current-forum-wrap')) openForumThread(thread.id);

        // 🎯 触发弹窗并传入 thread.id 支持点击跳转
        if (newRepliesCount > 0) {
            showForumToast('论坛新动态', `新增了 ${newRepliesCount} 条路人跟帖，快去看看吧！`, '💬', thread.id);
            // 🆕 路人NPC跟帖之后，不只是楼主本人（如果是角色发的帖），其它角色也各自判断要不要主动插一嘴，
            // 跟推文/小报/匿名论坛共用同一套 maybeCharsReactToNpcComments（js/10），逻辑保持一致。
            if (typeof maybeCharsReactToNpcComments === 'function') {
                const authorChar = thread.authorCharId ? (myCharacters.find(c => c.id == thread.authorCharId) || null) : null;
                maybeCharsReactToNpcComments(jsonArr, { kind: 'forum', thread, postText: thread.content, authorChar, authorName: thread.author });
            }
        }
    } catch (e) {
        console.error('[论坛NPC跟帖] 生成失败：', e);
    }
}


// 10. 发布新帖弹窗
function openCreateForumModal() {
    let modal = document.getElementById('createForumModal');
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'createForumModal';
        modal.className = 'modal-overlay';
        modal.style.zIndex = '9999';
        modal.innerHTML = `
        <div class="modal-box" style="width: 550px;">
            <h2 style="color:#1d9bf0; margin-top:0;">📝 发布新帖</h2>
            <!-- 发帖身份：跟推文/匿名论坛一个思路。选角色时，标题和正文都由 AI 照着那个角色的
                 人设+最近经历写，格式跟你自己发的完全一样，发完同样会被路人和其他角色围观互动。 -->
            <div class="input-group full-width">
                <label>👤 以谁的身份发</label>
                <select id="newForumRoleSelect" onchange="onForumRoleChange()">
                    <option value="me">我（自己写标题和正文）</option>
                    <option value="random">🎲 随机角色（AI 代笔）</option>
                </select>
                <div class="form-hint" id="newForumRoleHint" style="margin-top:6px;">标题和正文自己填。</div>
            </div>
            <div class="input-group full-width">
                <label>帖子标题</label>
                <input type="text" id="newForumTitle" placeholder="输入吸引人的标题...">
            </div>
            <div class="input-group full-width">
                <label>首楼正文</label>
                <textarea id="newForumContent" rows="4" placeholder="说点什么吧..."></textarea>
            </div>
            <div class="input-group full-width">
                <label>📖 故事大纲 / 剧本设定 (选填)</label>
                <textarea id="newForumOutline" rows="2" placeholder="AI将根据此大纲推进后续NPC回帖走向..."></textarea>
            </div>
            <div class="input-group full-width">
                <label>📥 导入 TXT 作为背景参考 (选填)</label>
                <input type="file" id="newForumTxt" accept="*/*" style="display:block; padding:8px 0; font-size: 13px;">
            </div>
            <div class="input-group full-width">
                <label>🎭 重点关注角色 (选填)</label>
                <div class="form-hint" style="margin-bottom:8px;">选中的角色将有极高概率在下方回复中露面与你互动。</div>
                <div id="newForumChars" style="display:flex; gap:10px; flex-wrap:wrap; border:1px solid #1d9bf0; padding:10px; border-radius:8px; max-height:120px; overflow-y:auto;"></div>
            </div>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button class="btn-primary" style="margin-top:0;" onclick="submitCreateForumModal(event)">发布帖子</button>
                <button class="btn-cancel" style="margin-top:0;" onclick="closeModal('createForumModal')">取消</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    }
    
    // 填充"以谁的身份发"
    const roleSel = document.getElementById('newForumRoleSelect');
    if (roleSel && typeof myCharacters !== 'undefined') {
        const old = roleSel.value;
        roleSel.innerHTML = '<option value="me">我（自己写标题和正文）</option>'
            + '<option value="random">🎲 随机角色（AI 代笔）</option>'
            + myCharacters.map(c => `<option value="${c.id}">${c.name}（AI 代笔）</option>`).join('');
        if (old && roleSel.querySelector(`option[value="${old}"]`)) roleSel.value = old;
        onForumRoleChange();
    }

    const charBox = document.getElementById('newForumChars');
    if (typeof myCharacters !== 'undefined') {
        charBox.innerHTML = myCharacters.map(c => `
            <label style="display:flex; align-items:center; gap:5px; background:rgba(255,255,255,0.8); padding:5px 10px; border-radius:9999px; border:1px solid #1d9bf0; cursor:pointer;">
                <input type="checkbox" class="forum-char-check" value="${c.id}">
                ${getAvatarHTML(c, 24)} ${c.name}
            </label>`).join('');
    }
        
    document.getElementById('newForumTitle').value = '';
    document.getElementById('newForumContent').value = '';
    document.getElementById('newForumOutline').value = '';
    document.getElementById('newForumTxt').value = '';
    
    document.getElementById('createForumModal').style.display = 'flex';
}

// 角色自主发新帖到论坛（forumThreads）：跟用户手动发帖(submitCreateForumModal)是同一个板块，唯一的区别是
// 标题+正文由AI以这个角色的口吻生成，发布者身份也是这个角色（不是currentUser）。发完之后同样召唤路人跟帖，
// 体验跟用户自己发帖后的连锁反应保持一致。返回 {success, error?, thread?}，静默失败交给调用方自己决定要不要提示。
async function autoGenerateForumThreadForChar(char, topicHint) {
    if (!char) return { success: false, error: '没有指定角色' };
    const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
    if (!api || !api.key) return { success: false, error: '未配置API Key' };

    try {
        const actionStrictRule = (typeof allowActionTags !== 'undefined' && allowActionTags) ? "" : "\n【严格禁止】：绝对不要包含任何动作、神态或心理描写（不要用括号()或【】），只输出你直接想说的文字内容。";
        const prompt = `${buildBasePrompt(char, false)}${typeof getRecentPostsAwarenessText === 'function' ? getRecentPostsAwarenessText(char) : ''}${typeof getTimeAwarenessPrompt === 'function' ? getTimeAwarenessPrompt(String(char.id), char) : ''}${topicHint ? `\n【这次想聊的方向】：${topicHint}（照这个方向写，但要用你自己的语气和视角，不要照抄这句话）\n` : ''}你现在想去论坛发一个新帖子（用你自己真实的身份/网名发，不是匿名），聊聊最近想聊的话题、吐槽、分享、求助、安利都行，具体聊什么、语气怎么样完全由你的人设决定。
请直接输出一个JSON对象：{"title":"帖子标题（不超过20字，符合论坛标题的风格）","content":"帖子正文（不超过${typeof postWordLimit !== 'undefined' ? postWordLimit : 150}字）"}${typeof WORD_LIMIT_PRIORITY_NOTE !== 'undefined' ? WORD_LIMIT_PRIORITY_NOTE : ''}
即使这次发的是论坛帖子而不是对话，如果你的世界观设定/正则脚本里要求每次输出固定附带某种格式标签或HTML（比如状态栏、卡片等），也请照常写进content字段里（换行用\\n转义），不要因为是论坛帖子就省略，这也不违反"只返回JSON"的要求。
${getFinalAnswerMarkerPromptNote()}
只输出这个JSON对象本身，不要有任何多余文字，不要用Markdown代码块包裹。${actionStrictRule}`;

        const data = await sendChatRequest(api, prompt);
        if (data.error) { console.warn('[角色自动发论坛帖] 生成失败：', data.error); return { success: false, error: data.error.message || 'API报错' }; }
        let rawText = data.choices?.[0]?.message?.content?.trim() || '';
        rawText = rawText.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
        const startIdx = rawText.indexOf('{'), endIdx = rawText.lastIndexOf('}');
        if (startIdx === -1 || endIdx === -1) { console.warn('[角色自动发论坛帖] 没返回可识别的JSON：', rawText); return { success: false, error: 'AI没有返回有效内容' }; }
        let parsed;
        try { parsed = JSON.parse(rawText.substring(startIdx, endIdx + 1)); } catch (e) { console.warn('[角色自动发论坛帖] JSON解析失败：', rawText, e); return { success: false, error: 'JSON解析失败' }; }
        const title = (parsed.title || '').trim();
        let content = (parsed.content || '').trim();
        if (!title || !content) return { success: false, error: 'AI返回的标题或正文为空' };
        // 烘焙该角色的生成后正则脚本，让状态栏/卡片等HTML跟推文/日记/论坛保持一致地生效。
        content = applyRegexScripts(content, 'ai_output', char.id);

        if (typeof forumThreads === 'undefined') forumThreads = [];
        const newThread = {
            id: 'ft_' + Date.now(), title: title, content: content,
            author: char.name, authorCharId: char.id, txtContext: '', replies: [],
            timestamp: Date.now(), likes: 0
        };
        forumThreads.unshift(newThread);
        saveAllData();
        if (typeof renderForumList === 'function') renderForumList();
        if (typeof showForumToast === 'function') showForumToast(`${char.name} 发布了新帖`, title, (typeof getForumAvatar === 'function') ? getForumAvatar(char.name) : '📋', newThread.id);
        // 跟用户手动发帖一样，发完之后召唤路人跟帖
        setTimeout(() => { if (typeof generateNpcForumReplies === 'function') generateNpcForumReplies(newThread, 1, ""); }, 500);
        return { success: true, thread: newThread };
    } catch (e) {
        console.error('[角色自动发论坛帖] 出错：', e);
        return { success: false, error: e.message };
    }
}

// 选了角色代笔时，标题/正文不再必填——它们变成"给角色的方向"，留空就完全由角色自己发挥。
function onForumRoleChange() {
    const sel = document.getElementById('newForumRoleSelect');
    const hint = document.getElementById('newForumRoleHint');
    const titleEl = document.getElementById('newForumTitle');
    const contentEl = document.getElementById('newForumContent');
    if (!sel) return;
    const isMe = sel.value === 'me';
    if (hint) hint.innerText = isMe
        ? '标题和正文自己填。'
        : '标题和正文交给 AI 按角色的人设写。下面两栏可以留空，也可以填一个大概方向（比如"想吐槽今天的会"）。';
    if (titleEl) titleEl.placeholder = isMe ? '输入吸引人的标题...' : '（可留空）想让 TA 聊什么方向';
    if (contentEl) contentEl.placeholder = isMe ? '说点什么吧...' : '（可留空）补充一点方向或情境';
}

async function submitCreateForumModal(event) {
    let title = document.getElementById('newForumTitle').value.trim();
    let content = document.getElementById('newForumContent').value.trim();
    let outline = document.getElementById('newForumOutline').value.trim();
    let fileInput = document.getElementById('newForumTxt');

    // 🆕 角色代笔：整条帖子交给 autoGenerateForumThreadForChar 按人设写，
    // 走的是跟"角色自主发帖"完全同一套逻辑和格式，发完一样会被路人和其他角色围观互动。
    const roleSel = document.getElementById('newForumRoleSelect');
    const roleId = roleSel ? roleSel.value : 'me';
    if (roleId !== 'me') {
        let char = null;
        if (roleId === 'random') {
            const pool = (myCharacters || []).filter(c => c.replyToUser !== false);
            char = pool[Math.floor(Math.random() * pool.length)] || null;
        } else {
            char = (myCharacters || []).find(c => c.id == roleId) || null;
        }
        if (!char) return alert('没有可用的角色，先去【角色中心】建一个。');

        const b = event.target;
        b.innerText = `「${char.name}」正在写…`; b.disabled = true;
        try {
            const hint = [title, content].filter(Boolean).join('；');
            const r = await autoGenerateForumThreadForChar(char, hint || null);
            if (!r || !r.success) alert('角色发帖失败：' + ((r && r.error) || '未知原因'));
            else {
                document.getElementById('createForumModal').style.display = 'none';
                document.getElementById('newForumTitle').value = '';
                document.getElementById('newForumContent').value = '';
            }
        } finally { b.innerText = '发布帖子'; b.disabled = false; }
        return;
    }

    if(!title || !content) return alert("标题和正文为必填项！");
    
    let btn = event.target;
    btn.innerText = "处理中..."; btn.disabled = true;
    
    let txtContext = "";
    if (fileInput.files.length > 0) {
        txtContext = await new Promise(resolve => {
            let reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsText(fileInput.files[0]);
        });
    }
    
    let selectedCharNames = Array.from(document.querySelectorAll('.forum-char-check:checked')).map(cb => {
        let c = myCharacters.find(x => x.id == cb.value);
        return c ? c.name : '';
    }).filter(Boolean);
    
    let finalContext = outline ? `【故事大纲】：${outline}\n` : '';
    finalContext += txtContext ? `【附加TXT背景】：${txtContext.substring(0, 2000)}\n` : '';
    finalContext += selectedCharNames.length > 0 ? `【优先发言角色】：必须安排 ${selectedCharNames.join('、')} 参与回复讨论。\n` : '';
    
    let newThread = {
        id: 'ft_' + Date.now(), title: title, content: content,
        author: currentUser.name || '楼主', txtContext: finalContext, replies: [],
        timestamp: Date.now(), likes: 0 
    };
    
    if(typeof forumThreads === 'undefined') forumThreads = [];
    forumThreads.unshift(newThread);
    saveAllData(); 
    
    document.getElementById('createForumModal').style.display = 'none';
    btn.innerText = "发布帖子"; btn.disabled = false;
    
    renderForumList();
    setTimeout(() => { generateNpcForumReplies(newThread, 1, ""); }, 500);
}

function likeForumReply(threadId, floor, isMainPost = false) {
    let thread = forumThreads.find(t => t.id === threadId);
    if(isMainPost) thread.likes = (thread.likes || 0) + 1;
    else {
        let reply = thread.replies.find(r => r.floor === floor);
        if(reply) reply.likes = (reply.likes || 0) + 1;
    }
    saveAllData(); openForumThread(threadId);
}
// ==========================================
// 11. 论坛专属新消息弹窗提醒器
// ==========================================
