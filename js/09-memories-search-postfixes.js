// ===================== 回忆相册/高光时刻收藏 =====================
function isInMemoryAlbum(type, refId) {
    return memoryAlbum.some(m => m.type === type && m.refId == refId);
}

function toggleMemoryStar(event, type, refId) {
    if (event) event.stopPropagation();
    const idx = memoryAlbum.findIndex(m => m.type === type && m.refId == refId);
    let isStarred = false;

    if (idx > -1) {
        memoryAlbum.splice(idx, 1);
    } else if (type === 'post') {
        const post = globalPosts.find(p => p.id === refId); if (!post) return;
        memoryAlbum.unshift({ id: 'mem_' + Date.now(), type: 'post', refId, charId: post.char.id, charName: post.char.name, text: post.text, timestamp: post.timestamp, savedAt: Date.now() });
        isStarred = true;
    }
    
    saveAllData();

    // 🌟 核心修复：直接改变当前点击的那个按钮的文字和颜色，产生瞬间响应的视觉反馈！
    if (event && event.currentTarget) {
        // ⚠️ 修复"Cannot read properties of null (reading 'style')"：event这个原生事件对象只在
        // 事件处理这一轮同步代码里有效，setTimeout的回调是150ms后才异步执行的，那时候event早就
        // 被浏览器/WebView回收清空了，再读event.currentTarget就会是null。要先把按钮元素本身存到一个
        // 普通变量里，setTimeout里用这个变量而不是再去读event，就不受event生命周期的影响了。
        const starBtn = event.currentTarget;
        starBtn.innerHTML = isStarred ? '⭐' : '☆';
        starBtn.style.color = isStarred ? '#ffad1f' : 'inherit';

        // 顺带增加一个漂亮的小动画提示
        starBtn.style.transform = 'scale(1.3)';
        setTimeout(() => { starBtn.style.transform = 'scale(1)'; }, 150);
    }

    // 后台偷偷刷新"收藏"页面数据（现在挂在个人资料的收藏标签下，用户和角色资料页都适用）
    if (document.getElementById('view-profile').style.display !== 'none' && currentProfileTab === 'highlights') renderMemoryAlbum();
}

function removeFromMemoryAlbum(memId) {
    memoryAlbum = memoryAlbum.filter(m => m.id !== memId);
    saveAllData();
    renderMemoryAlbum();
}

function jumpToMemorySource(mem) {
    if (mem.type === 'post') {
        switchMainView('postDetail', mem.refId);
    } else if (mem.type === 'chat') {
        switchMainView('chat');
        switchChatSession(mem.refId);
    }
}

function renderMemoryAlbum() {
    const container = document.getElementById('profileFeedSection');
    const list = currentProfileId === 'me' ? memoryAlbum : memoryAlbum.filter(m => m.charId == currentProfileId);
    if (list.length === 0) {
        container.innerHTML = currentProfileId === 'me'
            ? '<div class="empty-state">还没有收藏任何回忆～聊天消息右键、推文点☆号都可以收藏哦。</div>'
            : '<div class="empty-state">还没有收藏和ta有关的回忆～</div>';
        return;
    }
    container.innerHTML = list.map(m => {
        const char = myCharacters.find(c => c.id == m.charId);
        return `<div class="memory-card" onclick="jumpToMemorySource(${JSON.stringify(m).replace(/"/g, '&quot;')})">
            <div style="display:flex; gap:10px; align-items:flex-start;">
                ${char ? getAvatarHTML(char, 40) : '<div class="avatar" style="width:40px;height:40px;background:#8b98a5;"></div>'}
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:bold; font-size:14px;">${m.charName || '未知'} <span style="font-weight:normal; font-size:11px; color:#8b98a5;">${m.type === 'post' ? '· 推文' : '· 聊天'}</span></div>
                    <div style="font-size:13px; color:#0f1419; margin-top:2px; word-break:break-word;">${m.text}</div>
                    <div style="font-size:11px; color:#8b98a5; margin-top:4px;">${new Date(m.timestamp).toLocaleString('zh-CN', { hour12: false })}</div>
                </div>
                <span style="color:#f91880; cursor:pointer; font-size:18px; flex-shrink:0;" onclick="event.stopPropagation(); removeFromMemoryAlbum('${m.id}')">×</span>
            </div>
        </div>`;
    }).join('');
}

// ===================== 全站搜索 =====================
function renderSearchPosts(keyword) {
    const kw = (keyword || '').toLowerCase().trim();
    const container = document.getElementById('searchFeedSection');
    if (!kw) { container.innerHTML = '<div class="empty-state">输入关键词试试吧～</div>'; return; }

    // 1. 推文（含营销号爆料）
    const postRes = globalPosts.filter(p => p.text.toLowerCase().includes(kw) || p.char.name.toLowerCase().includes(kw) || (p.char.handle || '').toLowerCase().includes(kw));
    const tabloidRes = (tabloidPosts || []).filter(p => p.text.toLowerCase().includes(kw));

    // 2. 聊天记录（跨所有角色/群聊会话）
    let chatRes = [];
    Object.keys(globalChats || {}).forEach(sessionId => {
        (globalChats[sessionId] || []).forEach((m, idx) => {
            if (m.sender !== 'system' && m.text && m.text.toLowerCase().includes(kw)) {
                const senderName = m.sender === 'me' ? currentUser.name : (myCharacters.find(c => c.id == m.sender)?.name || '未知');
                chatRes.push({ sessionId, msgIdx: idx, senderName, text: m.text, timestamp: m.timestamp });
            }
        });
    });
    chatRes.sort((a, b) => b.timestamp - a.timestamp);

    // 3. 日记与信件（存在每个角色的 diaryData 里）
    let diaryRes = [];
    myCharacters.forEach(c => {
        if (!c.diaryData) return;
        ['letters', 'diaries'].forEach(kind => {
            (c.diaryData[kind] || []).forEach(item => {
                if ((item.title || '').toLowerCase().includes(kw) || (item.content || '').toLowerCase().includes(kw)) {
                    diaryRes.push({ charId: c.id, charName: c.name, kind, id: item.id, title: item.title, content: item.content, date: item.date });
                }
            });
        });
    });
    diaryRes.sort((a, b) => b.date - a.date);

    // 4. 小说
    const novelRes = (globalNovels || []).filter(n => (n.title || '').toLowerCase().includes(kw) || (n.outline || '').toLowerCase().includes(kw) || (n.chapters || []).some(ch => (ch.content || '').toLowerCase().includes(kw)));

    // 5. 论坛
    const forumRes = (typeof forumThreads !== 'undefined' ? forumThreads : []).filter(t => (t.title || '').toLowerCase().includes(kw) || (t.content || '').toLowerCase().includes(kw) || (t.replies || []).some(r => (r.content || '').toLowerCase().includes(kw)));

    const totalCount = postRes.length + tabloidRes.length + chatRes.length + diaryRes.length + novelRes.length + forumRes.length;
    if (totalCount === 0) { container.innerHTML = '<div class="empty-state">全站范围内都没有找到相关内容...</div>'; return; }

    let html = `<div style="padding:10px 15px; color:#536471; font-size:13px;">共找到 ${totalCount} 条相关结果</div>`;

    if (postRes.length > 0) {
        html += `<div class="search-section-title">📝 推文 (${postRes.length})</div>` + generatePostHTML(postRes);
    }
    if (tabloidRes.length > 0) {
        html += `<div class="search-section-title">📰 营销号爆料 (${tabloidRes.length})</div>` + tabloidRes.map(p => `
            <div class="post-placeholder" onclick="switchMainView('postDetail', '${p.id}')">
                <div class="post-content" style="min-width:0; flex:1;">
                    <div class="post-body">${namespaceInjectedIds(formatPostText(p.text, p.char && p.char.id, { statusContext: 'post' }), p.id)}</div>
                </div>
            </div>`).join('');
    }
    if (chatRes.length > 0) {
        html += `<div class="search-section-title">💬 聊天记录 (${chatRes.length})</div>` + chatRes.slice(0, 30).map(r => `
            <div class="search-result-card" onclick="switchMainView('chat'); switchChatSession('${r.sessionId}');">
                <div style="font-weight:bold; font-size:13px;">${r.senderName}</div>
                <div style="font-size:13px; color:#536471; margin-top:2px;">${r.text}</div>
                <div style="font-size:11px; color:#8b98a5; margin-top:4px;">${new Date(r.timestamp).toLocaleString('zh-CN', { hour12: false })}</div>
            </div>`).join('');
    }
    if (diaryRes.length > 0) {
        html += `<div class="search-section-title">📔 日记与信件 (${diaryRes.length})</div>` + diaryRes.map(r => `
            <div class="search-result-card" onclick="openDiaryFromSearch('${r.charId}', '${r.kind}', '${r.id}')">
                <div style="font-weight:bold; font-size:13px;">${r.charName} · ${r.kind === 'letters' ? '信件' : '日记'}：${r.title}</div>
                <div style="font-size:13px; color:#536471; margin-top:2px; max-height:3em; overflow:hidden;">${r.content}</div>
            </div>`).join('');
    }
    if (novelRes.length > 0) {
        html += `<div class="search-section-title">📖 故事 (${novelRes.length})</div>` + novelRes.map(n => `
            <div class="search-result-card" onclick="switchMainView('novel'); openNovelDetail('${n.id}');">
                <div style="font-weight:bold; font-size:13px;">${n.title || '未命名故事'}</div>
                <div style="font-size:13px; color:#536471; margin-top:2px;">${(n.outline || '').slice(0, 60)}</div>
            </div>`).join('');
    }
    if (forumRes.length > 0) {
        html += `<div class="search-section-title">💭 论坛 (${forumRes.length})</div>` + forumRes.map(t => `
            <div class="search-result-card" onclick="openForumThread('${t.id}')">
                <div style="font-weight:bold; font-size:13px;">${t.title}</div>
                <div style="font-size:13px; color:#536471; margin-top:2px; max-height:3em; overflow:hidden;">${t.content}</div>
            </div>`).join('');
    }

    container.innerHTML = html;
    if (typeof enableChatScriptExecution !== 'undefined' && enableChatScriptExecution) { try { executeInjectedScripts(container); } catch (e) { console.error('执行搜索结果注入脚本时出错：', e); } }
}

function openDiaryFromSearch(charId, kind, itemId) {
    currentDiaryCharId = charId;
    switchMainView('diary');
    switchDiaryTab(kind === 'letters' ? 'letter' : 'diary');
    setTimeout(() => { if (typeof openDiaryDetail === 'function') openDiaryDetail(itemId); }, 100);
}

function renderSinglePostDetail(postId) {
    // 🐛 修复：详情页开着的时候，很多地方（云同步/群聊/私聊收到新消息等后台事件）会顺手调用
    // "如果帖子详情页当前开着，就刷新一下" 这类兜底逻辑——但那些事件本身跟"当前正打开的这条帖子"
    // 毫无关系，只是复用了同一个变量名占位，实际传进来的 postId 是 undefined/null。之前没有提前
    // 判空就直接调用 .startsWith，一遇到这种情况就会直接崩溃报错（Cannot read properties of null）。
    // 这里提前判空并安全跳过：不是"这条帖子"的更新，本来就不需要刷新，什么都不做即可。
    if (!postId) return;
    let isTabloid = postId.startsWith('tb_');
    let post = isTabloid ? tabloidPosts.find(p => p.id === postId) : globalPosts.find(p => p.id == postId);
    if(!post) return;
    let char = post.char || { name: '未知' };

    let actionAttr = isTabloid ? '' : `ondblclick="editPost('${post.id}', this); event.stopPropagation();" title="双击可直接修改此帖子"`;
    let followBtnHTML = (!isTabloid && char.id !== 'me') ? `<button class="${char.isFollowing ? "follow-btn following" : "follow-btn"} btn-follow-${char.id}" style="padding:4px 16px; min-height:32px; background:${char.isFollowing?'transparent':'#0f1419'}; color:${char.isFollowing?'#0f1419':'white'}; border:1px solid ${char.isFollowing?'#cfd9de':'transparent'};" onclick="toggleFollow('${char.id}', event)">${char.isFollowing ? "已关注" : "关注"}</button>` : '';
    
    // === 楼中楼树状结构核心逻辑 ===
    let repliesHTML = '';
    if (post.replies && post.replies.length > 0) {
        let replyMap = {};
        let roots = [];

        // 1. 初始化并建立索引
        post.replies.forEach((r, idx) => {
            if (!r.id) r.id = 'r_' + idx + '_' + Date.now(); // 兼容老数据
            r.originalIdx = idx; // 保存原始索引用于点赞和回复操作
            replyMap[r.id] = { ...r, children: [] };
        });

        // 2. 区分根评论和子评论
        post.replies.forEach(r => {
            if (r.parentId && replyMap[r.parentId]) {
                replyMap[r.parentId].children.push(replyMap[r.id]);
            } else {
                roots.push(replyMap[r.id]);
            }
        });

        // 3. 一级评论严格按时间倒序排列 (最新发布的在最上面)
        roots.sort((a, b) => b.timestamp - a.timestamp);

        // 4. 递归渲染函数 (限制最大可见树深 3 层)
        function buildReplyHTML(node, depth) {
            let r = node;
            let idx = r.originalIdx;
            let isMe = isTabloid ? (r.charId === 'me') : (r.char && r.char.id === 'me');
            let rChar = isTabloid ? (isMe ? currentUser : (typeof getNpcIdentity === 'function' ? getNpcIdentity(r.name || '网友') : { name: r.name || '网友', handle: '@npc_user', avatarEmoji: '👤' })) : (r.char || { name: '未知' });

            let indentClass = depth > 0 ? 'reply-nested' : '';
            // 嵌套左侧缩进计算：前3层正常缩进，超过3层后不再继续向右无限缩进缩短空间
            // 缩进改成用 CSS 变量给出层级，具体每层缩多少交给 style.css 按屏幕宽度决定
            // （手机上 35px/层太狠，三层就吃掉 105px，名字和内容都没地方站了）
            let depthStyle = depth > 0 ? `--reply-depth: ${Math.min(depth, 3)};` : '';
            
            // 获取用户当前对该条评论的点赞和收藏状态
            let isLiked = r.likedBy ? r.likedBy.includes('me') : (r.liked || false);
            let isFavorited = r.favorited || false;

            let html = `
            <div class="reply-item ${indentClass}" style="${depthStyle}" data-reply-idx="${idx}" data-post-id="${postId}" oncontextmenu="showReplyContextMenu(event, '${postId}', ${idx})">
                ${depth > 0 ? '<div class="reply-thread-line"></div>' : ''}
                <div class="reply-avatar-link" onclick="switchMainView('profile', '${rChar.id}')">
                    ${getAvatarHTML(rChar, depth > 0 ? 28 : 36)}
                </div>
                <div class="reply-content-box" style="flex: 1; min-width: 0;">
                    <div class="reply-header-row">
                        <span class="reply-user-name" onclick="switchMainView('profile', '${rChar.id}')">${escapeHtml(rChar.name)}</span>
                        <span class="reply-user-handle">${escapeHtml(rChar.handle || '')}</span>
                        <span class="reply-dot">·</span>
                        <span class="time-updater" data-timestamp="${r.timestamp}">${timeAgo(r.timestamp)}</span>
                    </div>
                    ${r.replyTo ? `<div class="reply-to-line">回复给 <b>@${escapeHtml(r.replyTo)}</b></div>` : ''}
                    <div class="reply-text-body">
                        ${namespaceInjectedIds(formatPostText(r.text, r.charId || (r.char && r.char.id) || null, { statusContext: 'comment' }), r.id || (postId + '_' + idx))}
                    </div>
                    ${r.mediaUrl ? `<div class="post-media" style="margin-top:8px;"><img src="${r.mediaUrl}" style="max-height:200px; border-radius:8px;"></div>` : ''}
                    ${getActionIconsHTML(r.likes || 0, isLiked, idx, postId, depth > 0, isFavorited)}
                </div>
            </div>`;

            // 递归向下处理子回复：不管在第几层，同一个节点下的子回复都只先显示前2条，
            // 第3条开始收进"显示更多回复"折叠栏，点开后可再点收起——跟层级深度无关，每一层都是这个规则。
            if (node.children && node.children.length > 0) {
                // 子回复内部按正常时间正序（旧到新）排列，符合正常的对话阅读流
                node.children.sort((a, b) => a.timestamp - b.timestamp);

                const visibleChildren = node.children.slice(0, 2);
                const hiddenChildren = node.children.slice(2);
                visibleChildren.forEach(child => { html += buildReplyHTML(child, depth + 1); });
                if (hiddenChildren.length > 0) {
                    html += `
                    <div class="view-more-replies" data-count="${hiddenChildren.length}" style="--reply-depth: ${Math.min(depth + 1, 3)};" onclick="toggleExpandHiddenReplies(this)">
                        显示更多回复 (${hiddenChildren.length}条)
                    </div>
                    <div class="hidden-replies-container" style="display:none;">
                        ${hiddenChildren.map(child => buildReplyHTML(child, depth + 1)).join('')}
                    </div>`;
                }
            }
            return html;
        }

        // 5. 顶层（父）评论全部展示，不折叠——折叠规则只适用于子回复
        repliesHTML = `<div class="replies-container">` + roots.map(root => buildReplyHTML(root, 0)).join('') + `</div>`;
    }
    
    let mediaHTML = post.mediaUrl ? `<div class="post-media" style="margin: 12px 0;"><img src="${post.mediaUrl}"></div>` : '';
    // v108：定位跟时间**并排一行、同一基线**（不是各占一行，也不上名字那一排）。
    let locationHTML = '';
    let quotedHTML = typeof renderQuotedPostPreviewHTML === 'function' ? renderQuotedPostPreviewHTML(post.quotedPostId) : '';
    // 时间按发帖时间走，点一下在「3小时前」和「上午9:13 · 2018年3月19日」之间来回切。
    let dateStr = `<span class="time-updater" data-fmt="post" data-timestamp="${post.timestamp}" onclick="gyToggleTimeFmt(event)" title="点一下换一种时间写法">${fmtPostTime(post.timestamp)}</span>`
        + (post.location ? `<span class="post-loc-inline">${locationSVG}<span>${escapeHtml(post.location)}</span></span>` : '');

    let quotesCount = Math.floor(parseStat(post.stats.retweets) * 0.15) || 0;
    let bookmarksCount = Math.floor(parseStat(post.stats.likes) * 0.12) || 0;
    
    const imgIcon = `<svg viewBox="0 0 24 24" class="reply-toolbar-icon"><path d="M3 5.5C3 4.119 4.119 3 5.5 3h13C19.881 3 21 4.119 21 5.5v13c0 1.381-1.119 2.5-2.5 2.5h-13C4.119 21 3 19.881 3 18.5v-13zM5.5 5c-.276 0-.5.224-.5.5v9.086l3-3 3 3 5-5 3 3V5.5c0-.276-.224-.5-.5-.5h-13zM19 15.414l-3-3-5 5-3-3-3 3V18.5c0 .276.224.5.5.5h13c.276 0 .5-.224.5-.5v-3.086zM9.75 7C8.784 7 8 7.784 8 8.75s.784 1.75 1.75 1.75 1.75-.784 1.75-1.75S10.716 7 9.75 7z"></path></svg>`;
    const gifIcon = `<svg viewBox="0 0 24 24" class="reply-toolbar-icon"><path d="M3 5.5C3 4.119 4.119 3 5.5 3h13C19.881 3 21 4.119 21 5.5v13c0 1.381-1.119 2.5-2.5 2.5h-13C4.119 21 3 19.881 3 18.5v-13zM5.5 5c-.276 0-.5.224-.5.5v13c0 .276.224.5.5.5h13c.276 0 .5-.224.5-.5v-13c0-.276-.224-.5-.5-.5h-13zM7.5 14V9.5h3v1.5h-1.5v1.5h2v1.5h-3.5zm4.5 0V9.5h1.5v4.5H12zm3 0V9.5h3v1.5h-1.5v1h1v1.5h-2.5z"></path></svg>`;
    const locIcon = `<svg viewBox="0 0 24 24" class="reply-toolbar-icon"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path></svg>`;

    document.getElementById('postDetailSection').innerHTML = `
        <div style="padding: 12px 16px 80px 16px; position: relative; min-height: 100vh;">
            <div class="post-detail-header-flex" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="display:flex; gap:12px; align-items:center; cursor:pointer;" onclick="switchMainView('profile', '${isTabloid ? 'tabloid_admin' : char.id}');">
                    ${getAvatarHTML(char, 44)}
                    <div>
                        <div class="detail-author-name">${char.name}</div>
                        <div class="detail-author-handle">${isTabloid ? '@tabloid_news' : char.handle}</div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                    ${followBtnHTML}
                    <button class="post-more-btn" onclick="gyPostMenu(event, '${postId}')" title="更多">${typeof moreDotsSVG !== 'undefined' ? moreDotsSVG : '⋮'}</button>
                </div>
            </div>
            <div class="post-body detail-post-body" ${actionAttr}>${namespaceInjectedIds(formatPostText(post.text, isTabloid ? null : char.id, { statusContext: 'post' }), post.id)}</div>
            ${locationHTML}
            ${mediaHTML}
            ${quotedHTML}
            <div class="detail-time-row">${dateStr}</div>

            <div class="post-detail-stats-row">
                <span><b>${formatStat(post.stats.retweets)}</b> 转帖</span>
                <span><b>${formatStat(quotesCount)}</b> 引用</span>
                <span><b>${formatStat(post.stats.likes)}</b> 喜欢</span>
                <span><b>${formatStat(bookmarksCount)}</b> 书签</span>
            </div>

            <!-- v107：详情页也用信息流那条操作栏。
                 引用 / 收藏 / 分享到私聊 / 修改 / 删除 全部收进右上角的 ⋮，
                 这里只留四个高频的 + 最右边一个分享。 -->
            <div class="post-actions detail-post-actions">
                <div class="pa-item" onclick="document.getElementById('myCommentInput') && document.getElementById('myCommentInput').focus()" title="回复">${commentSVG}<span>${formatStat(post.stats.comments)}</span></div>
                <div class="pa-item rt" onclick="openQuoteComposer('${postId}')" title="转发 / 引用">${retweetSVG}<span>${formatStat(post.stats.retweets)}</span></div>
                <div class="pa-item like ${post.userLiked ? 'on' : ''}" onclick="toggleDetailLike('${postId}')" title="喜欢">${post.userLiked ? likeSVGFilled : likeSVG}<span>${formatStat(post.stats.likes)}</span></div>
                <div class="pa-item" title="浏览量">${viewsBarSVG}<span>${formatStat(post.stats.views)}</span></div>
                <div class="pa-item pa-share" onclick="openShareToChatModal('${postId}')" title="分享到私聊">${shareOutSVG}</div>
            </div>

            ${repliesHTML}

            <div class="twitter-reply-box">
                <div id="replyAttachmentPreview" class="emo-preview-box" style="display:none; padding:0; margin-bottom:10px;"></div>
                <input type="text" id="myCommentInput" placeholder="${(post.replies || []).some(r => (r.charId === 'me') || (r.char && r.char.id === 'me')) ? '发布你的回复（留空点回复＝让角色重新评论一次）' : '发布你的回复'}" onkeypress="if(event.key === 'Enter') postUserComment('${postId}')">
                <div class="toolbar-divider"></div>
                <div class="toolbar-actions">
                    <div class="toolbar-icons">
                        <span onclick="openEmoticonPicker('reply')">${imgIcon}</span>
                        <input type="file" id="replyAttachmentInput" accept="image/*" style="display:none;" onchange="handleDirectImageUpload(this, 'reply')">
                        <span onclick="document.getElementById('replyAttachmentInput').click()" title="上传图片" style="cursor:pointer;">📷</span>
                        <span>${gifIcon}</span>
                        <span>${locIcon}</span>
                    </div>
                    <button class="btn-reply-send" onclick="postUserComment('${postId}')">回复</button>
                </div>
            </div>
        </div>`;
    if (typeof enableChatScriptExecution !== 'undefined' && enableChatScriptExecution) { try { executeInjectedScripts(document.getElementById('postDetailSection')); } catch (e) { console.error('执行帖子详情注入脚本时出错：', e); } }
}

// === 新增辅助函数：控制折叠栏目的实时展开与合拢 ===
function toggleExpandHiddenReplies(btnEl) {
    const container = btnEl.nextElementSibling;
    if (container && container.classList.contains('hidden-replies-container')) {
        if (container.style.display === 'none') {
            container.style.display = 'block';
            btnEl.innerText = '收起回复';
            btnEl.classList.add('expanded');
        } else {
            container.style.display = 'none';
            btnEl.innerText = `显示更多回复 (${btnEl.dataset.count}条)`;
            btnEl.classList.remove('expanded');
        }
    }
}

// 修复："有的角色怎么都不来互动"的问题之一：之前只要人设文本里【任何位置】出现过一个关键词
// （哪怕是"表面高冷但其实很粘人""小时候有点独来独往，长大后开朗多了"这种一笔带过、甚至被后文
// 反转掉的描述），就会被整体判定为"高冷"角色，从而在别人发帖时几乎只点赞不回复。
// 现在改成要求命中至少2个关键词，减少被单个偶然出现的词误伤的情况；真正高冷的人设通常会
// 不止一处强调这种气质，命中多个关键词更能反映这是角色的主要性格特征而不是背景故事里的一笔带过。
function isCoolPersona(persona) {
    if (!persona) return false;
    const coolKeywords = ['高冷', '内向', '冷淡', '寡言', '沉默寡言', '冷漠', '不善言辞', '独来独往', '不爱说话', '惜字如金', '话很少'];
    const hitCount = coolKeywords.filter(kw => persona.includes(kw)).length;
    return hitCount >= 2;
}

// 🐛🐛 「角色跟用户是情侣，但因为人设写着高冷，就永远只会点个赞」——这才是"不活人"的硬病根。
//
// isCoolPersona 只数人设里的关键词，命中两个就把这个角色**锁死**在"只能输出 LIKE"那条分支上，
// 代码层面直接剥夺了它说话的资格。一个"沉默寡言的旧书店老板"哪怕是用户的恋人，
// 在评论区也永远只能点赞——这不是性格，这是被代码判了哑。
//
// 关系网里有跟用户的关系记录时，就不再走那条死路。注意**不是强迫它说话**：
// 普通分支里"随手点赞"照样是个选项，它想只点赞完全可以。区别只是这个选择权
// 从代码手里还给了角色自己——高冷是对外人的，对亲近的人应该体现成回得短、嘴硬，
// 而不是永远只有一个赞。
function hasBondWithUser(char) {
    if (!char || typeof charRelationships === 'undefined' || !Array.isArray(charRelationships)) return false;
    return charRelationships.some(r =>
        (r.fromId == char.id && r.toId === 'me') || (r.toId == char.id && r.fromId === 'me'));
}
function isCoolTowardUser(char) {
    if (!char || !isCoolPersona(char.persona)) return false;
    return !hasBondWithUser(char);
}

// 修复：主页用户发推功能 (userPost)
// ==========================================
// 报场景：这段生成属于「comment」那一场（soft＝外层已有场景就不抢）
async function userPost() {
    const a = arguments;
    if (typeof window.gyInjectInSceneSoft === 'function')
        return window.gyInjectInSceneSoft('comment', () => userPostInner.apply(null, a));
    return userPostInner.apply(null, a);
}
async function userPostInner() {
    let input = document.getElementById('userPostInput'); 
    let text = input.value.trim(); 
    if (!text && !pendingPostAttachment) return;
    if (!myApiKey) return alert("请先在设置中配置密钥！");
    
    let locVal = document.getElementById('advLoc')?.value.trim();
    let rtVal = document.getElementById('advRT')?.value;
    let viewsVal = document.getElementById('advViews')?.value;
    let commentsVal = document.getElementById('advComments')?.value;
    let likesVal = document.getElementById('advLikes')?.value;
    
    let roleId = document.getElementById('userPostRoleSelect')?.value || 'me';
    let postChar = roleId === 'me' ? currentUser : myCharacters.find(c => c.id == roleId);
    if (!postChar) postChar = currentUser;

    let postLoc = postChar.location || '';
    let postStats = { comments: 0, retweets: 0, likes: 0, views: 0 };
    let needAI = (!locVal || !rtVal || !viewsVal || !commentsVal || !likesVal);
    
    if (needAI) {
        document.getElementById('loadingStatus').style.display = 'block';
        document.getElementById('loadingStatus').innerText = "正在分析并生成发帖数据... ";
        
        let prompt = `用户发布了一条推文："${text}"。请为这条推文生成合理的虚拟数据。
严格返回JSON格式，不能有其他文字：
{"location":"根据内容推测的地点，若没有填日常地点或空字符串","retweets":随机整数,"views":随机整数,"comments":随机整数,"likes":随机整数}`;
        try {
            let data = await sendChatRequest({ url: myApiUrl, key: myApiKey, model: myModel }, prompt);
            let aiStats = extractJsonObject(data.choices?.[0]?.message?.content);
            if (aiStats) {
                postLoc = locVal || aiStats.location || postLoc;
                postStats.retweets = rtVal !== '' ? parseInt(rtVal) : (aiStats.retweets || getRandomStat(100));
                postStats.views = viewsVal !== '' ? parseInt(viewsVal) : (aiStats.views || getRandomStat(5000));
                postStats.comments = commentsVal !== '' ? parseInt(commentsVal) : (aiStats.comments || getRandomStat(50));
                postStats.likes = likesVal !== '' ? parseInt(likesVal) : (aiStats.likes || getRandomStat(500));
            }
        } catch(e) { }
    } else {
        postLoc = locVal || postLoc;
        // 用 `parseInt(x) || 随机数` 判空会把用户明确填的 0 当成"没填"（0 是假值）而换成随机数，
        // 于是"0赞0评论"的推文根本发不出来。改成显式判空字符串，跟上面 AI 分支的写法保持一致。
        postStats.retweets = rtVal !== '' ? parseInt(rtVal) : getRandomStat(100);
        postStats.views = viewsVal !== '' ? parseInt(viewsVal) : getRandomStat(5000);
        postStats.comments = commentsVal !== '' ? parseInt(commentsVal) : getRandomStat(50);
        postStats.likes = likesVal !== '' ? parseInt(likesVal) : getRandomStat(500);
    }

    // 最终兜底：只有"真的没算出数来"（undefined/null/NaN）才补随机数，合法的 0 必须原样保留
    const fillStat = (v, max) => (typeof v === 'number' && !isNaN(v)) ? v : getRandomStat(max);
    postStats.retweets = fillStat(postStats.retweets, 100);
    postStats.views = fillStat(postStats.views, 5000);
    postStats.comments = fillStat(postStats.comments, 50);
    postStats.likes = fillStat(postStats.likes, 500);

    let newPostId = 'u_' + Date.now();
    let newPost = { 
        id: newPostId, 
        char: JSON.parse(JSON.stringify(postChar)), 
        text: text, 
        timestamp: Date.now(), 
        replies: [], 
        mediaUrl: pendingPostAttachment, 
        stats: postStats, 
        isStory: false,
        location: postLoc,
        likedBy: [], // 加入点赞记录数组，防止页面出错
        quotedPostId: pendingQuotePostId || null // 手动"引用"按钮带过来的被引用推文id，没有引用就是null
    };

    globalPosts.unshift(newPost);
    // 🐛 补齐："营销号的帖子也可以转发引用，然后营销号人设可以过来回复"：引用的是营销号(tabloidAccount)发的帖子时，
    // 营销号自己不在 myCharacters 里，不会被下面"角色们看用户新帖子"那个循环覆盖到，所以单独触发一次它的反应。
    if (newPost.quotedPostId && typeof tabloidPosts !== 'undefined') {
        const quotedTabloidPost = tabloidPosts.find(p => p.id === newPost.quotedPostId);
        if (quotedTabloidPost && typeof triggerTabloidReactToQuote === 'function') triggerTabloidReactToQuote(newPost, quotedTabloidPost);
    }
    input.value = '';
    clearAttachment('post');
    pendingQuotePostId = null;
    if (typeof renderQuotePreviewInModal === 'function') renderQuotePreviewInModal();

    ['advLoc', 'advRT', 'advViews', 'advComments', 'advLikes'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    if(document.getElementById('advancedPostOptions')) document.getElementById('advancedPostOptions').style.display = 'none';
    closeModal('postCreateModal');
    
    if (typeof renderPosts === 'function') renderPosts();
    document.getElementById('loadingStatus').innerText = "角色们正在看您的帖子... ";
    document.getElementById('loadingStatus').style.display = 'block';
    saveAllData(); 
    
    let emoPrompt = getEmoticonPrompt();
    
    // 💰 以前这里是 `for (let char of myCharacters)`——角色库里有几个角色就发几次请求，
    // 每次都带着那个角色的完整人设+世界书+预设。27 个角色实测一条推文要 30 次调用、约 9 万 token，
    // 其中 98% 花在这个循环上，而且角色越多越贵。现在先按相关度挑出最多 charInteractMaxCount 个
    // （设置里可调，填 0 恢复"全都来"的老行为），评论区照样热闹，请求次数固定住了。
    // 🔌 设置里关掉了「发帖后角色自动来互动」：帖子照常发出去，只是没人自动来评论
    const interactPool = (typeof isAutoOn === 'function' && !isAutoOn('postReactions'))
        ? []
        : myCharacters.filter(c => c.id !== postChar.id && c.replyToUser !== false);
    const interactChars = (typeof pickInteractingChars === 'function')
        ? pickInteractingChars(interactPool, text, postChar.id) : interactPool;
    for (let char of interactChars) {

        const isCool = isCoolTowardUser(char);   // 跟用户有关系的角色不再被锁进"只能点赞"
        let actionStrictRule = allowActionTags ? "" : "\n【严格禁止】：绝对不要包含任何动作、神态或心理描写（不要用括号()或【】），只输出你直接说的话。";

        // 修复："所有角色都要围着用户转"：之前这里给了角色"NO"这个选项，会导致有的角色对用户的
        // 帖子完全零反应、什么都不做。现在不管人设冷不冷淡，都强制至少要有反应（点赞或说一句话），
        // 只是性格影响的是"倾向于只点赞"还是"更愿意多说几句"，而不是"要不要来"。
        // 另外修复：这里之前只拼了世界书+聊天总结+性别上下文，漏了关系网/预设/插件这些buildBasePrompt自带的部分，
        // 换成buildBasePrompt统一走一遍完整上下文，避免OOC。
        let moveToChatOption = (typeof enableCharMoveToChat !== 'undefined' && enableCharMoveToChat)
            ? `\n【额外选项】：如果你觉得这件事更适合私下聊、不想在评论区公开回应，可以输出"[MOVETOCHAT]"，紧跟着写你想在私聊里对用户说的话，这样这段话会私聊发给用户而不是公开评论。这只是众多选项之一，不是必须用。\n`
            : '';
        // 修复：这条推文可能是用户本人发的，也可能是用户"以某个角色身份"发的（发推框里能选身份）——
        // 后一种情况下发帖人其实是 postChar 这个角色，不是"用户"本人，之前无论哪种都写死成"用户XXX发了推文"，
        // 容易让其它角色搞混"这到底是用户亲口说的，还是某个角色账号发的"。这里跟评论区那个修复用同一个思路。
        let postAuthorLabel = postChar.id === 'me' ? `用户（${userDisplayName()}）本人` : `角色"${postChar.name}"`;
        // 🐛 这条链路以前既没要求"状态栏照常带上"，也没给"正式输出标记"——
        //   · 前者导致：用户在设置里打开了「评论显示状态栏」，角色评论里却压根没生成状态栏标签，开关看着像坏的；
        //   · 后者导致：模型把"我该怎么回应"那一大段思考原样当成评论发出来（用户截图里那种"好的，林发了一条动态说……"）。
        // 状态栏那句只在开关真的打开时才加，关着就别白白多花这些 token。
        const wantStatusInComment = (typeof showStatusInComments === 'undefined') ? false : !!showStatusInComments;
        const statusNote = wantStatusInComment
            ? '即使这只是一条评论而不是完整对话，如果你的世界观设定/正则脚本里要求每次输出固定附带某种格式标签、状态栏或HTML卡片，也请照常带上，不要因为是评论场景就省略。\n'
            : '';
        const markerNote = (typeof getFinalAnswerMarkerPromptNote === 'function') ? ('\n' + getFinalAnswerMarkerPromptNote()) : '';
        let prompt = isCool
            ? `${buildBasePrompt(char, true, text)}${moveToChatOption}${postAuthorLabel}发了推文："${text}"。你性格高冷，通常只点赞、很少主动多说话，但这条动态你必须看到并作出反应，绝对不能完全无视。请输出"LIKE"，或者直接输出一句简短的话（不超过${chatWordLimit}字。${WORD_LIMIT_PRIORITY_NOTE}）。只能二选一，不允许输出其他内容（包括"NO"）。${actionStrictRule}\n${statusNote}${markerNote}`
            : `${buildBasePrompt(char, true, text)}${emoPrompt}${moveToChatOption}${postAuthorLabel}发了推文："${text}"。你必须对这条动态作出反应，绝对不能完全无视。如果想认真回复，直接输出内容（不超过${chatWordLimit}字。${WORD_LIMIT_PRIORITY_NOTE}），若要在回复中带表情包，请在文本最后附上 [EMO:对应ID]；如果只是随手点个赞，输出"LIKE"。只能二选一，不允许输出"NO"或保持沉默。${actionStrictRule}\n${statusNote}${markerNote}`;
        try {
            let data = await sendChatRequest({ url: myApiUrl, key: myApiKey, model: myModel }, prompt);
            if (data.error) { console.error(`角色"${char.name}"回复推文失败：`, data.error); continue; }
            // 🐛 思维链跑进评论区的修复：先按"正式输出标记"精确切一刀，标记没写就退回长度启发式剥离。
            // 这两步是项目里其它评论链路早就在做的（js/10、js/11 都有），只有这条推文回复链路一直漏着。
            let repText = data.choices?.[0]?.message?.content?.trim() || "";
            if (typeof extractAfterFinalMarker === 'function') repText = extractAfterFinalMarker(repText).trim();
            if (typeof stripUndelimitedReasoningIfOverLength === 'function') {
                repText = stripUndelimitedReasoningIfOverLength(repText, typeof chatWordLimit !== 'undefined' ? chatWordLimit : 50);
            }

            let moveToChatMatch = repText.match(/^\[MOVETOCHAT\]\s*/i);
            if (moveToChatMatch) {
                let chatMsg = repText.replace(moveToChatMatch[0], '').trim();
                if (chatMsg && typeof deliverCharMoveToChatMessage === 'function') {
                    chatMsg = chatMsg.replace(/^["“]|["”]$/g, '').trim();
                    deliverCharMoveToChatMessage(char, chatMsg, { name: postChar.name, text: text });
                }
                continue;
            }

            let repMediaUrl = null; let emoMatch = repText.match(/\[EMO:(emo_\w+)\]/i);
            if (emoMatch) { let emo = globalEmoticons.find(e => e.id === emoMatch[1]); if (emo) repMediaUrl = emo.url; repText = repText.replace(emoMatch[0], '').trim(); }
            repText = stripLeftoverMarkers(repText); // 上面几种标记都解析完了，漏网的不许显示给用户（见 js/01）
            // 评论不需要状态栏HTML卡片，只去掉AI偶尔自己加的首尾引号
            const isLikeOnly = (typeof looksLikeALikeOnly === 'function') ? looksLikeALikeOnly(repText) : (repText.toUpperCase() === 'LIKE');
            if (!isLikeOnly) repText = repText.replace(/^["“]|["”]$/g, '').trim();

            if (isLikeOnly) {
                newPost.stats.likes = parseStat(newPost.stats.likes) + 1;
                if (!newPost.likedBy) newPost.likedBy = [];
                if (!newPost.likedBy.includes(char.id)) newPost.likedBy.push(char.id); // 记录AI点赞
                if(typeof addNotification === 'function') addNotification(`<b>${char.name}</b> 赞了您的帖子 ❤️`, newPostId, null, char, ""); 
            }
            else if (!repText.toUpperCase().startsWith("NO") && repText !== "") { 
                // 添加标准的楼中楼格式回复
                newPost.replies.push({ 
                    id: 'r_' + Date.now() + Math.floor(Math.random()*100),
                    parentId: null, // 根层级标记
                    char: char, 
                    text: repText, 
                    timestamp: Date.now(), 
                    likes: 0, 
                    liked: false, 
                    likedBy: [],
                    mediaUrl: repMediaUrl 
                }); 
                newPost.stats.comments++; 
                if(typeof addNotification === 'function') addNotification(`<b>${char.name}</b> 评论了您的帖子`, newPostId, null, char, repText); 
            }
            if (document.getElementById('view-home').style.display !== 'none') renderPosts();
        } catch(e) { console.error(`角色"${char.name}"回复推文请求异常：`, e); }
    }
    document.getElementById('loadingStatus').style.display = 'none';
    saveAllData();
    spawnNpcComments(newPostId, false, { triggerName: postChar.name, triggerText: text });
}