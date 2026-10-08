// ==========================================
// 角色对线系统：右键菜单、AI 代打与 NPC 自动反击
// ==========================================

// 1. 覆盖原有的推文/营销号评论右键菜单
window.showReplyContextMenu = function(e, postId, replyIdx) {
    e.preventDefault(); e.stopPropagation();
    replyContextMenuTarget = { postId: postId, replyIdx: replyIdx, type: postId.startsWith('tb_') ? 'tabloid' : 'global' };
    const menu = document.getElementById('chatContextMenu');
    menu.innerHTML = `
        <button class="context-btn" onclick="openCustomCharReplyModal()">滴滴代打</button>
        <button class="context-btn" onclick="contextActionEditReply()">✏️ 修改评论</button>
        <button class="context-btn" style="color:#f91880;" onclick="contextActionDeleteReply()">🗑️ 删除评论</button>
    `;
    menu.style.display = 'flex'; 
    let x = e.pageX, y = e.pageY; 
    if(x + 150 > window.innerWidth) x -= 150; 
    if(y + 100 > window.innerHeight) y -= 100; 
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
};

// 2. 故事论坛专用的评论右键菜单
// （楼主主楼 floor===1 删的是整个帖子含所有回复；其它楼层只删这一条回复，楼层号本来就不要求连续，
// 不用重新排号——引用回复时是按 floor 数字查找的，删掉中间某层不影响别的楼层继续被正确引用到）
window.showForumReplyContextMenu = function(e, threadId, floor) {
    e.preventDefault(); e.stopPropagation();
    replyContextMenuTarget = { threadId: threadId, floor: floor, type: 'forum' };
    const menu = document.getElementById('chatContextMenu');
    const deleteLabel = floor === 1 ? '🗑️ 删除整个帖子' : '🗑️ 删除该楼层';
    menu.innerHTML = `<button class="context-btn" onclick="openCustomCharReplyModal()">滴滴代打</button><button class="context-btn" onclick="contextActionEditReply()">✏️ 修改内容</button><button class="context-btn" style="color:#f91880;" onclick="contextActionDeleteReply()">${deleteLabel}</button>`;
    menu.style.display = 'flex';
    let x = e.pageX, y = e.pageY; 
    if(x + 150 > window.innerWidth) x -= 150; 
    if(y + 100 > window.innerHeight) y -= 100; 
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
};

// 3. 匿名论坛专用的评论右键菜单
window.showAnonReplyContextMenu = function(e, postId, replyIdx) {
    e.preventDefault(); e.stopPropagation();
    replyContextMenuTarget = { postId: postId, replyIdx: replyIdx, type: 'anon' };
    const menu = document.getElementById('chatContextMenu');
    // 匿名论坛的评论以前右键只有"滴滴代打"——改不了也删不了。补上。
    menu.innerHTML = `<button class="context-btn" onclick="openCustomCharReplyModal()">滴滴代打</button><button class="context-btn" onclick="contextActionEditReply()">✏️ 修改评论</button><button class="context-btn" style="color:#f91880;" onclick="contextActionDeleteReply()">🗑️ 删除评论</button>`;
    menu.style.display = 'flex';
    let x = e.pageX, y = e.pageY; 
    if(x + 150 > window.innerWidth) x -= 150; 
    if(y + 100 > window.innerHeight) y -= 100; 
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
};

// 4. 打开回复面板并渲染数据 (防错加强版 + 随机选项)
window.openCustomCharReplyModal = function() {
    document.getElementById('chatContextMenu').style.display = 'none';
    if (!replyContextMenuTarget) return;

    if (!myCharacters || myCharacters.length === 0) return alert("请先创建至少一个角色！");

    const modal = document.getElementById('customCharReplyModal');
    if (!modal) return alert("⚠️ 找不到弹窗界面，请确保 index.html 中已经正确添加了对应代码！");

    const t = replyContextMenuTarget;
    let targetName = '未知', targetText = '';

    try {
        if (t.type === 'global' || t.type === 'tabloid') {
            const post = t.type === 'tabloid' ? tabloidPosts.find(p => p.id == t.postId) : globalPosts.find(p => p.id == t.postId);
            if (!post) throw new Error("找不到原帖数据");
            const reply = post.replies[t.replyIdx];
            if (!reply) throw new Error("找不到原评论数据");
            targetName = t.type === 'tabloid' ? (reply.name || '未知') : (reply.char ? reply.char.name : '未知');
            targetText = reply.text || reply.content || '';
        } else if (t.type === 'forum') {
            const thread = forumThreads.find(th => th.id === t.threadId);
            if (!thread) throw new Error("找不到原论坛帖");
            const reply = thread.replies.find(r => r.floor === t.floor);
            if(reply) { targetName = reply.author || '未知'; targetText = reply.content || ''; }
            else { targetName = thread.author || '未知'; targetText = thread.content || ''; }
        } else if (t.type === 'anon') {
            const post = anonPosts.find(p => p.id === t.postId);
            if (!post) throw new Error("找不到匿名帖");
            const reply = post.replies[t.replyIdx];
            if (!reply) throw new Error("找不到匿名评论");
            targetName = reply.anonName || '匿名者';
            targetText = reply.text || reply.content || '';
        }

        document.getElementById('ccrTargetInfo').innerHTML = `<b>正在回复 ${targetName}：</b><br>${targetText.substring(0, 80)}...`;
        
        // 渲染选项，加入“随机角色”
        let optionsHtml = '<option value="random">随机角色</option>';
        optionsHtml += myCharacters.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        document.getElementById('ccrCharSelect').innerHTML = optionsHtml;
        
        // 清空并设置占位符提示 AI 代打
        const inputEl = document.getElementById('ccrInput');
        inputEl.value = '';
        inputEl.placeholder = "请输入文本...\n(留空则召唤角色自动代打)";
        
        openModal('customCharReplyModal');
    } catch(e) {
        console.error("打开回复面板出错:", e);
        alert("获取数据失败: " + e.message);
    }
};

// 5. 核心引擎：提交回复 (包含 AI 留空代打、随机角色抓取、NPC 自动反击)
window.submitCustomCharReply = async function() {
    let charId = document.getElementById('ccrCharSelect').value;
    let text = document.getElementById('ccrInput').value.trim();
    if (!charId) return;

    // 解析随机角色
    if (charId === 'random') {
        if (!myCharacters || myCharacters.length === 0) return;
        const randomChar = myCharacters[Math.floor(Math.random() * myCharacters.length)];
        charId = randomChar.id;
    }

    const char = myCharacters.find(c => c.id == charId);
    if (!char) return;

    const t = replyContextMenuTarget;
    const btn = document.getElementById('ccrSubmitBtn');
    btn.innerText = "处理中..."; btn.disabled = true;

    let targetId = '', targetName = '', postId = '', targetText = '';

    // 提取目标信息 (为 AI 代打和反击提供上下文)
    try {
        if (t.type === 'global' || t.type === 'tabloid') {
            postId = t.postId;
            const post = t.type === 'tabloid' ? tabloidPosts.find(p => p.id == t.postId) : globalPosts.find(p => p.id == t.postId);
            const targetReply = post.replies[t.replyIdx];
            targetName = t.type === 'tabloid' ? (targetReply.name || '未知') : (targetReply.char ? targetReply.char.name : '未知');
            targetId = t.type === 'tabloid' ? targetReply.charId : (targetReply.char ? targetReply.char.id : 'npc');
            targetText = targetReply.text || targetReply.content || '';
        } else if (t.type === 'forum') {
            postId = t.threadId;
            const thread = forumThreads.find(th => th.id === t.threadId);
            let targetReply = thread.replies.find(r => r.floor === t.floor);
            targetName = targetReply ? targetReply.author : thread.author;
            targetId = 'npc';
            targetText = targetReply ? targetReply.content : thread.content;
        } else if (t.type === 'anon') {
            postId = t.postId;
            const post = anonPosts.find(p => p.id === t.postId);
            const targetReply = post.replies[t.replyIdx];
            targetName = targetReply.anonName || '匿名者';
            targetId = targetReply.charId || 'npc';
            targetText = targetReply.text || targetReply.content || '';
        }
    } catch(e) {
        console.error("提交时提取目标信息失败", e);
        btn.innerText = "你等着吧我现在就找人弄你"; btn.disabled = false;
        return;
    }

    const api = getApiMain(); 

    // A. 文本框留空 -> 触发 AI 角色自动代打
    if (!text) {
        if (!api.key) {
            alert("请先在设置中配置 API Key，或手动输入文本！");
            btn.innerText = "你等着吧我现在就找人弄你"; btn.disabled = false;
            return;
        }
        
        btn.innerText = "摇人中...";
        let promptStr = "";
        
        // 修复：这三条"代打回复"prompt之前都只塞了人设，没带世界书/关系网/预设，容易OOC——统一换成buildBasePrompt
        if (t.type === 'anon') {
            promptStr = `${buildBasePrompt(char, false, targetText)}你正在逛一个匿名论坛，你的匿名ID是"${char.anonName || '匿名者'}"。
刚刚看到"${targetName}"说："${targetText}"，并且点名回复了你。

【最重要的一条】匿名 = 不署真名，不等于换一个人格。
你还是你——人设、说话习惯、在意的事，全都不变。匿名只是让你敢说平时不方便公开说的话，
不是让你变成一个暴躁发癫的陌生人。该冷淡就冷淡，该懒得理就明说懒得理。
直接输出你的回复内容（不超过${chatWordLimit}字），不要任何前言或解释。`;
        } else if (t.type === 'forum') {
            promptStr = `${buildBasePrompt(char, false, targetText)}你现在在逛中文论坛。\n刚刚看到楼主或层主"${targetName}"说："${targetText}"。\n请结合你的人设，直接输出你要回复的话（不超过50字，不要带引号）。`;
        } else {
            promptStr = `${buildBasePrompt(char, false, targetText)}你正在浏览社交推文。\n刚才网友"${targetName}"评论说："${targetText}"。\n请结合你的人设，直接输出你要回复的话（不超过50字，不要带引号）。`;
        }
        
        try {
            text = (await sendChatRequest(api, promptStr)).choices?.[0]?.message?.content?.trim() || "";
            text = text.replace(/^["“]|["”]$/g, '');
        } catch(e) {
            console.error("生成代打回复失败:", e);
            alert("AI 生成代打失败，请重试或手动输入。");
            btn.innerText = "你等着吧我现在就找人弄你"; btn.disabled = false;
            return;
        }
        if (!text || text.toUpperCase().startsWith("NO")) text = "呃...";
    }

    // B. 将角色生成的回复写入页面
    if (t.type === 'global' || t.type === 'tabloid') {
        const post = t.type === 'tabloid' ? tabloidPosts.find(p => p.id == t.postId) : globalPosts.find(p => p.id == t.postId);
        const targetReply = post.replies[t.replyIdx];

        const newReply = t.type === 'tabloid' 
            ? { id: 'r_' + Date.now(), parentId: targetReply.id, charId: char.id, name: char.name, text: text, timestamp: Date.now() }
            : { id: 'r_' + Date.now(), parentId: targetReply.id, char: char, text: text, timestamp: Date.now(), likes: 0, liked: false, likedBy: [], replyTo: targetName };
        
        post.replies.push(newReply); post.stats.comments++; saveAllData();
        if (document.getElementById('view-post-detail').style.display !== 'none') renderSinglePostDetail(t.postId);
        if (t.type === 'tabloid' && document.getElementById('view-tabloid').style.display !== 'none') renderTabloidPosts();

    } else if (t.type === 'forum') {
        const thread = forumThreads.find(th => th.id === t.threadId);
        let nextFloor = thread.replies.length > 0 ? thread.replies[thread.replies.length - 1].floor + 1 : 2;
        thread.replies.push({ floor: nextFloor, author: char.name, charId: char.id, isOp: false, content: text, quoteFloor: t.floor, likes: 0, timestamp: Date.now() });
        saveAllData();
        if (document.getElementById('current-forum-wrap')) openForumThread(t.threadId);

    } else if (t.type === 'anon') {
        const post = anonPosts.find(p => p.id === t.postId);
        post.replies.push({ charId: char.id, anonName: char.anonName || '匿名者', anonId: char.anonId || 'OP', replyTo: targetName, text: text, timestamp: Date.now() });
        post.stats.comments++; saveAllData(); renderAnonPosts();
    }

    closeModal('customCharReplyModal');
    btn.innerText = "你等着吧我现在就找人弄你"; btn.disabled = false;

    // C. 触发 NPC 自动反击逻辑
    if (!api.key) return;

    if (String(targetId).startsWith('npc') || t.type === 'forum' || targetId === 'tabloid_admin') {
        let p2 = "";
        let npcActionRule2 = allowActionTags ? "" : "不要有任何动作、神态或心理描写，不要用括号()或【】，只输出要说的话。";
        if (t.type === 'anon') {
            p2 = `你是匿名路人网友"${targetName}"。刚才匿名论坛用户(其实是角色)"${char.anonName || '匿名者'}"(人设:${char.persona})针对你的评论回复道："${text}"。请你以暴躁、阴暗、抽象的路人网友身份简短回击，不超过50字。直接输出内容，不要带引号。${npcActionRule2}`;
        } else {
            p2 = `你是路人网友"${targetName}"。刚才论坛/推特用户(角色)"${char.name}"(人设:${char.persona})针对你的评论回复道："${text}"。请你以路人网友的身份（八卦、吃瓜、拱火、或者反击）简短回击，不超过50字。直接输出内容，不要带引号。${npcActionRule2}`;
        }

        try {
            let rep = (await sendChatRequest(api, p2)).choices?.[0]?.message?.content?.trim();
            if (rep && !rep.toUpperCase().startsWith("NO")) {
                rep = unwrapAiEnvelopeText(rep).replace(/^"|"$/g, '');   // 剥思维链/代码围栏，别让原始 JSON 漏进聊天

                // 写入 NPC 的回击
                if (t.type === 'global' || t.type === 'tabloid') {
                    const post = t.type === 'tabloid' ? tabloidPosts.find(p => p.id == t.postId) : globalPosts.find(p => p.id == t.postId);
                    let replyParentId = post.replies[post.replies.length-1].id;
                    
                    post.replies.push(t.type === 'tabloid' 
                        ? { id: 'r_' + Date.now(), parentId: replyParentId, charId: targetId, name: targetName, text: rep, timestamp: Date.now() } 
                        : { id: 'r_' + Date.now(), parentId: replyParentId, char: (typeof getNpcIdentity === 'function' ? getNpcIdentity(targetName) : { id: targetId, name: targetName, handle: '@npc_user', avatarEmoji: '👤', themeColor: '#536471', verified: false }), text: rep, timestamp: Date.now(), likes: 0, liked: false, likedBy: [], replyTo: char.name });
                    post.stats.comments++; saveAllData();
                    if (document.getElementById('view-post-detail').style.display !== 'none') renderSinglePostDetail(t.postId);
                    showToast(getAvatarHTML(typeof getNpcIdentity === 'function' ? getNpcIdentity(targetName) : {name: targetName, avatarEmoji: '👤', themeColor: '#536471'}, 40), `${targetName} 回复了 ${char.name}`, rep, t.postId, null);
                    
                } else if (t.type === 'forum') {
                    const thread = forumThreads.find(th => th.id === t.threadId);
                    let nextFloor = thread.replies.length > 0 ? thread.replies[thread.replies.length - 1].floor + 1 : 2;
                    let quoteFloor = thread.replies[thread.replies.length - 1].floor;
                    
                    thread.replies.push({ floor: nextFloor, author: targetName, isOp: false, content: rep, quoteFloor: quoteFloor, likes: 0, timestamp: Date.now() });
                    saveAllData();
                    if (document.getElementById('current-forum-wrap')) openForumThread(t.threadId);
                    if(typeof showForumToast === 'function') showForumToast(`${targetName} 回击了 ${char.name}`, rep, '👤', t.threadId);
                    
                } else if (t.type === 'anon') {
                    const post = anonPosts.find(p => p.id === t.postId);
                    post.replies.push({ charId: targetId, anonName: targetName, anonId: 'NPC', replyTo: char.anonName || '匿名者', text: rep, timestamp: Date.now() });
                    post.stats.comments++; saveAllData(); renderAnonPosts();
                    showToast(`<div class="avatar" style="background:#555; border:1px solid #777; color:#fff;">?</div>`, `匿名网友 回复了 ${char.anonName || '匿名者'}`, rep, t.postId, null, true);
                }
            }
        } catch(e) { console.error("NPC 反击生成失败:", e); }
    }
};// ==========================================
// 升级版群聊功能：邀请拉人与群成员智能迎新/修罗场
// ==========================================

// 1. 覆盖原有的 openChatOptions，为群聊自动注入“邀请角色”按钮
window.openChatOptions = function(id, event) {
    if (event) event.stopPropagation(); 
    currentSummaryCharId = id; 
    const isGroup = String(id).startsWith('g_'); 
    
    // 隐藏或显示原有的聊天总结按钮
    const summaryBtn = document.getElementById('btnChatSummaryOption');
    if (summaryBtn) summaryBtn.style.display = isGroup ? 'none' : 'block';

    // 一键清空聊天记录：只在群聊里显示（个人聊天已经有"重新开始聊天"，会自动帮你归档旧记录，更安全）
    const clearGroupBtn = document.getElementById('btnClearGroupChatOption');
    if (clearGroupBtn) clearGroupBtn.style.display = isGroup ? 'block' : 'none';

    // 群聊发言顺序设置（顺序/随机/仅@回复）—— 这块之前被本函数的群聊邀请覆盖版本漏掉了，补回来
    const orderSection = document.getElementById('groupSpeakOrderSection');
    if (orderSection) {
        orderSection.style.display = isGroup ? 'block' : 'none';
        if (isGroup) {
            const g = groupChats.find(g => g.id === id);
            const orderSelect = document.getElementById('groupSpeakOrderSelect');
            if (orderSelect) orderSelect.value = (g && g.speakOrder) || 'all';
            renderGroupMuteCheckboxes(g);
        }
    }
    
    // 动态查找或创建邀请按钮
    let inviteBtn = document.getElementById('btnChatInviteOption');
    if (!inviteBtn) {
        const txtModal = document.getElementById('chatTxtModal');
        if (txtModal) {
            const box = txtModal.querySelector('.modal-box');
            inviteBtn = document.createElement('button');
            inviteBtn.id = 'btnChatInviteOption';
            inviteBtn.className = 'btn-primary';
            inviteBtn.style.marginTop = '10px';
            inviteBtn.style.width = '100%';
            inviteBtn.innerHTML = '➕ 邀请新角色进群';
            inviteBtn.onclick = window.openInviteGroupModal;
            
            const cancelBtn = box.querySelector('.btn-cancel');
            if (cancelBtn) box.insertBefore(inviteBtn, cancelBtn);
            else box.appendChild(inviteBtn);
        }
    }
    if (inviteBtn) inviteBtn.style.display = isGroup ? 'block' : 'none';

    // 动态查找或创建"编辑群聊话题总结"按钮（群聊专属，个人聊天用原来的"编辑记忆"）
    let summaryTopicBtn = document.getElementById('btnGroupSummaryOption');
    if (!summaryTopicBtn) {
        const txtModal = document.getElementById('chatTxtModal');
        if (txtModal) {
            const box = txtModal.querySelector('.modal-box');
            summaryTopicBtn = document.createElement('button');
            summaryTopicBtn.id = 'btnGroupSummaryOption';
            summaryTopicBtn.className = 'btn-primary';
            summaryTopicBtn.style.marginTop = '10px';
            summaryTopicBtn.style.width = '100%';
            summaryTopicBtn.innerHTML = '🗨️ 编辑群聊话题总结';
            summaryTopicBtn.onclick = window.openGroupSummaryModal;

            const cancelBtn = box.querySelector('.btn-cancel');
            if (cancelBtn) box.insertBefore(summaryTopicBtn, cancelBtn);
            else box.appendChild(summaryTopicBtn);
        }
    }
    if (summaryTopicBtn) summaryTopicBtn.style.display = isGroup ? 'block' : 'none';

    openModal('chatTxtModal');
};

// 群聊"临时禁言成员"：勾选后该成员这一轮不参与AI回复判断，跟踢出群/删除角色是两码事，随时可取消勾选恢复
function renderGroupMuteCheckboxes(g) {
    const box = document.getElementById('groupMuteCheckboxes');
    if (!box) return;
    if (!g || !g.members || g.members.length === 0) { box.innerHTML = ''; return; }
    const muted = new Set(g.mutedMembers || []);
    box.innerHTML = g.members.map(id => {
        const c = myCharacters.find(ch => ch.id == id);
        if (!c) return '';
        return `<label style="display:flex; align-items:center; gap:4px; font-size:12px; background:white; padding:4px 8px; border-radius:9999px; border:1px solid #eff3f4; cursor:pointer;">
            <input type="checkbox" ${muted.has(id) ? 'checked' : ''} onchange="toggleGroupMuteMember('${g.id}', ${JSON.stringify(id)}, this.checked)"> ${escapeHtml(c.name)}
        </label>`;
    }).join('');
}

function toggleGroupMuteMember(groupId, charId, checked) {
    const g = groupChats.find(x => x.id === groupId);
    if (!g) return;
    if (!g.mutedMembers) g.mutedMembers = [];
    if (checked) {
        if (!g.mutedMembers.includes(charId)) g.mutedMembers.push(charId);
    } else {
        g.mutedMembers = g.mutedMembers.filter(id => id !== charId);
    }
    saveAllData();
}

// 3. 打开/保存群聊话题总结
window.openGroupSummaryModal = function() {
    closeModal('chatTxtModal');
    const group = groupChats.find(g => g.id === currentSummaryCharId);
    if (!group) return;
    document.getElementById('groupSummaryModalTitle').innerText = `🗨️ ${group.name} 的话题总结`;
    document.getElementById('groupSummaryEditArea').value = group.summary || '';
    openModal('groupSummaryModal');
};
window.saveGroupSummary = function() {
    const group = groupChats.find(g => g.id === currentSummaryCharId);
    if (!group) return;
    group.summary = document.getElementById('groupSummaryEditArea').value.trim();
    saveAllData();
    alert('群聊话题总结已保存！');
    closeModal('groupSummaryModal');
};

// 一键清空群聊的全部聊天记录（右键头像 -> 聊天选项里触发）。
// 直接彻底清空、不做归档，操作前用 confirm 二次确认并报出具体消息条数，避免手滑误删。
window.clearGroupChatHistory = async function() {
    const groupId = currentSummaryCharId;
    const group = groupChats.find(g => g.id === groupId);
    if (!group) return;
    const msgCount = (globalChats[groupId] || []).length;
    if (msgCount === 0) { alert(`"${group.name}"目前还没有聊天记录。`); return; }
    const confirmClear = await appConfirm(`确定要清空"${group.name}"的全部聊天记录吗？\n共 ${msgCount} 条消息，清空后无法恢复，请谨慎操作。`);
    if (!confirmClear) return;
    globalChats[groupId] = [];
    saveAllData();
    if (currentChatSessionId === groupId) renderChatMessages();
    alert('已清空该群聊的所有聊天记录。');
};

// 2. 打开邀请弹窗
window.openInviteGroupModal = function() {
    closeModal('chatTxtModal');
    const group = groupChats.find(g => g.id === currentSummaryCharId);
    if (!group) return;
    
    // 找出还不在群里的角色
    const availableChars = myCharacters.filter(c => !group.members.includes(c.id));
    if (availableChars.length === 0) {
        return alert("你创建的所有角色都已经在这个群里了！");
    }
    
    const select = document.getElementById('inviteGroupCharSelect');
    if (select) {
        select.innerHTML = availableChars.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    openModal('inviteGroupModal');
};

// 3. 确认邀请并触发 AI 连环反应
window.confirmInviteToGroup = async function() {
    const select = document.getElementById('inviteGroupCharSelect');
    const charId = select ? parseInt(select.value) : null;
    // 静默 return 是"点了没反应"的头号来源，一律改成把原因说出来
    if (!charId) {
        const msg = select ? '还没选要请谁进来。' : '邀请框没打开好，关掉重新点一次试试。';
        if (typeof appAlert === 'function') appAlert(msg); else alert(msg);
        return;
    }
    
    const group = groupChats.find(g => g.id === currentSummaryCharId);
    const newChar = myCharacters.find(c => c.id === charId);
    if (!group || !newChar) {
        const msg = !group ? '没找到这个群聊，关掉重新进一次。' : '没找到这个角色（可能刚被删了）。';
        if (typeof appAlert === 'function') appAlert(msg); else alert(msg);
        return;
    }
    
    // ⚠️ 这里以前是裸的 btn.innerText，元素不在就直接 TypeError 把整个邀请流程炸掉，
    // 而用户看到的只是"点了没反应"。
    const btn = document.getElementById('btnConfirmInvite');
    if (btn) { btn.innerText = "成员拉取中..."; btn.disabled = true; }
    
    // 将角色加入群数据
    group.members.push(charId);
    saveAllData();
    
    closeModal('inviteGroupModal');
    if (btn) { btn.innerText = "立即邀请"; btn.disabled = false; }
    
    // 写入系统消息
    if (!globalChats[group.id]) globalChats[group.id] = [];
    globalChats[group.id].push({ sender: 'system', text: `"${newChar.name}" 被邀请加入了群聊`, timestamp: Date.now() });
    
    renderChatCharList();
    if (currentChatSessionId === group.id) renderChatMessages();
    
    // 触发连环 AI 反应机制
    await triggerGroupWelcomeSequence(group.id, newChar.id);
};

// 4. 核心引擎：老成员表态 -> 新成员回应
window.triggerGroupWelcomeSequence = async function(groupId, newCharId) {
    const api = getApiMain();
    if (!api.key) return;
    
    const group = groupChats.find(g => g.id === groupId);
    const newChar = myCharacters.find(c => c.id === newCharId);
    if (!group || !newChar) return;

    // 抓取目前在群里的老成员（排除本人和刚进来的新人）
    let existingMembers = group.members
        .filter(id => id !== newCharId && id !== 'me')
        .map(id => myCharacters.find(c => c.id == id))
        .filter(Boolean);

    // 为了防止群太大导致 API 报错或时间过长，随机挑选最多 3 个活跃老成员来表态
    if (existingMembers.length > 3) {
        existingMembers = existingMembers.sort(() => 0.5 - Math.random()).slice(0, 3);
    }

    let welcomeContext = ""; // 用于记录老成员说的话，发给新人看
    const indicator = document.getElementById('chatTypingIndicator');
    const typingNameEl = document.getElementById('typingCharName');
    
    // A. 老成员依次表态
    for (let member of existingMembers) {
        if (indicator) { indicator.style.display = 'block'; typingNameEl.innerText = member.name; }
        
        let prompt = `${buildBasePrompt(member, false, newChar.name + ' ' + newChar.persona)}\n【系统强制事件】：新成员 "${newChar.name}" (人设: ${newChar.persona}) 刚刚被拉入了本群。\n请严格结合你自身的人设，直接输出你在群里对新人的第一句话（可以热烈欢迎、高冷无视、阴阳怪气、或者敌意，必须符合你的性格）。不超过50字。不要带引号。`;
        
        try {
            let rep = (await sendChatRequest(api, prompt)).choices?.[0]?.message?.content?.trim();
            if (rep && !rep.toUpperCase().startsWith("NO")) {
                rep = unwrapAiEnvelopeText(rep).replace(/^"|"$/g, '');   // 同上
                // 这句表态也是走 buildBasePrompt 拼出来的完整人设+预设，角色卡挂的预设一样可能强制要求带状态栏JSON块，
                // 跟主聊天流程一样过一遍正则脚本+MVU剥离，不然新人入群这几句话会漏网。
                rep = applyRegexScripts(rep, 'ai_output', member.id);
                const mvuResult = processMvuPatchInText(rep, groupId);
                rep = mvuResult.cleanText;
                globalChats[groupId].push({ sender: member.id, text: rep, timestamp: Date.now(), readBy: [], mvuSnapshot: mvuResult.snapshot });
                welcomeContext += `${member.name} 对新人的态度：${rep}\n`;
                if (currentChatSessionId === groupId) renderChatMessages();
                saveAllData();
            }
        } catch(e) { console.error("老成员表态失败:", e); }
    }

    // B. 新人看完态度后给出回应
    if (indicator) { indicator.style.display = 'block'; typingNameEl.innerText = newChar.name; }
    
    let newCharPrompt = `${buildBasePrompt(newChar, false, welcomeContext)}\n【系统强制事件】：你刚刚被邀请加入了一个新群聊。\n群里的其他老成员对你的到来做出了如下表态：\n${welcomeContext ? welcomeContext : '(大家似乎都在冷场，没有说话)'}\n请结合你的人设和别人对你的态度，直接输出你在群里的第一句回应（不超过50字）。不要带引号。`;
    
    try {
        let rep2 = (await sendChatRequest(api, newCharPrompt)).choices?.[0]?.message?.content?.trim();
        if (rep2 && !rep2.toUpperCase().startsWith("NO")) {
            rep2 = unwrapAiEnvelopeText(rep2).replace(/^"|"$/g, '');   // 同上
            rep2 = applyRegexScripts(rep2, 'ai_output', newChar.id);
            const mvuResult2 = processMvuPatchInText(rep2, groupId);
            rep2 = mvuResult2.cleanText;
            globalChats[groupId].push({ sender: newChar.id, text: rep2, timestamp: Date.now(), readBy: [], mvuSnapshot: mvuResult2.snapshot });
            if (currentChatSessionId === groupId) renderChatMessages();
            saveAllData();
        }
    } catch(e) { console.error("新成员回应失败:", e); }

    if (indicator) indicator.style.display = 'none';
};


// ===================== 关系网功能（势力分组 + 角色关系图）=====================
let currentRelationsFactionName = null; // 记录当前正在浏览的势力，供角色关系页返回时使用
let currentRelationCharId = null;

// 单值版：只在"必须给一个代表色/代表标签"的地方用（比如关系网连线的颜色），取主势力。
// 要判断"属不属于某个势力"一律用 charInFaction，别再拿 c.group === 名字 去比——
// 那样多势力角色只有主势力那一条能命中，其它势力页里会凭空少人。
function getCharFaction(c) { return c.group && c.group.trim() ? c.group : '势力不明'; }

function renderFactionNetworkGrid() {
    const grid = document.getElementById('factionNetworkGrid');
    const unknownCount = myCharacters.filter(c => getCharFactions(c).length === 0).length;
    const cards = characterGroups.map(g => {
        const count = myCharacters.filter(c => charInFaction(c, g)).length;
        return { name: g, count, color: getFactionColor(g), deletable: true };
    });
    cards.push({ name: '势力不明', count: unknownCount, color: getFactionColor(null), deletable: false });
    if (cards.every(c => c.count === 0)) {
        grid.innerHTML = '<div class="empty-state">暂无角色，请先去"角色中心"创建角色，再来这里分配势力吧！</div>';
        return;
    }
    grid.innerHTML = cards.map(c => `
        <div class="faction-card" style="border-color:${c.color};" onclick="switchMainView('factionMembers', '${c.name.replace(/'/g,"\\'")}')">
            <div class="faction-card-badge" style="background:${c.color};"></div>
            <div class="faction-card-name">${c.name}</div>
            <div class="faction-card-count">${c.count} 位角色</div>
        </div>
    `).join('');
}

function renderFactionMembersGrid(factionName) {
    currentRelationsFactionName = factionName;
    document.getElementById('factionMembersTitle').innerText = factionName;
    document.getElementById('factionMembersColorDot').style.background = getFactionColor(factionName === '势力不明' ? null : factionName);
    // 「势力不明」＝一个势力都没加入的；其余按"是否属于这个势力"算（多势力角色会同时出现在几个势力页里）
    const members = (factionName === '势力不明')
        ? myCharacters.filter(c => getCharFactions(c).length === 0)
        : myCharacters.filter(c => charInFaction(c, factionName));
    const grid = document.getElementById('factionMembersGrid');
    if (members.length === 0) { grid.innerHTML = '<div class="empty-state">该势力暂无角色。</div>'; return; }
    // v108：好感度开着的话，成员卡上直接带出 💗 分数和阶段名——
    // 以前只有点进某个角色的关系图、而且手动建过一条"跟我"的关系线才看得到，
    // 等于账本里改了数在关系网这边基本没有体现。
    grid.innerHTML = members.map(c => {
        const a = Number(c.affinity || 0);
        const stage = (window.gyRel && typeof window.gyRel.stage === 'function')
            ? (function () { try { return window.gyRel.stage(c.id); } catch (e) { return ''; } })() : '';
        const badge = enableAffinitySystem
            ? `<div class="faction-member-aff" style="color:${a >= 0 ? 'var(--gy-ok)' : 'var(--gy-bad)'};">💗${a > 0 ? '+' : ''}${a}${stage ? ' · ' + escapeHtml(stage) : ''}</div>` : '';
        return `
        <div class="faction-member-card" onclick="switchMainView('charRelations', '${c.id}')">
            ${getAvatarHTML(c, 64)}
            <div class="faction-member-name">${c.name}</div>
            ${badge}
        </div>`;
    }).join('');
}

function backFromCharRelations() {
    if (currentRelationsFactionName) switchMainView('factionMembers', currentRelationsFactionName);
    else switchMainView('factionNetwork');
}

function renderCharRelationsView(charId) {
    currentRelationCharId = charId;
    const centerChar = myCharacters.find(c => c.id == charId);
    if (!centerChar) { switchMainView('factionNetwork'); return; }

    const edges = charRelationships.filter(r => r.fromId == charId || r.toId == charId);
    const relatedChars = edges.map(r => {
        const otherId = r.fromId == charId ? r.toId : r.fromId;
        const other = otherId === 'me' ? currentUser : myCharacters.find(c => c.id == otherId);
        return { char: other, isUser: otherId === 'me', edge: r };
    }).filter(x => x.char);
    // v108：好感度开着、但你没手动建过"TA 跟我"这条关系线时，
    // 自动补一个「你」的节点上去。以前少了这条线，💗 徽章和线粗细就永远画不出来——
    // 关系账本里改了分，关系网这边一点反应都没有，看着像没联动。
    if (enableAffinitySystem && !relatedChars.some(x => x.isUser)) {
        const stage = (window.gyRel && typeof window.gyRel.stage === 'function')
            ? (function () { try { return window.gyRel.stage(charId); } catch (e) { return ''; } })() : '';
        relatedChars.push({
            char: currentUser, isUser: true,
            edge: { fromId: charId, toId: 'me', label: stage || '好感度', color: '#f91880', __auto: true }
        });
    }

    const wrap = document.getElementById('relationsGraphWrap');
    const nodesEl = document.getElementById('relationsGraphNodes');
    const svg = document.getElementById('relationsGraphSvg');
    const w = wrap.clientWidth || 600, h = 380;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const cx = w / 2, cy = h / 2;

    let nodesHtml = `<div class="relation-node relation-node-center" style="left:${cx}px; top:${cy}px;">${getAvatarHTML(centerChar, 72)}<div class="relation-node-name">${centerChar.name}</div></div>`;
    let linesHtml = '';
    const radius = Math.min(w, h) / 2 - 70;
    const n = relatedChars.length;
    relatedChars.forEach((item, i) => {
        const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
        const nx = cx + radius * Math.cos(angle);
        const ny = cy + radius * Math.sin(angle);
        const color = item.edge.color || '#1d9bf0';
        const nodeClick = item.isUser ? `openUserProfileModal()` : `switchMainView('charRelations','${item.char.id}')`;
        const affinityBadge = (item.isUser && enableAffinitySystem) ? `<div style="font-size:11px; color:${(centerChar.affinity||0) >= 0 ? '#17bf63' : '#f91880'};">💗${(centerChar.affinity||0) > 0 ? '+' : ''}${centerChar.affinity||0}</div>` : '';
        nodesHtml += `<div class="relation-node" style="left:${nx}px; top:${ny}px;" onclick="${nodeClick}">${getAvatarHTML(item.char, 56)}<div class="relation-node-name">${item.char.name}</div>${affinityBadge}</div>`;
        // 箭头线：从中心指向对方
        const dx = nx - cx, dy = ny - cy, dist = Math.sqrt(dx*dx + dy*dy);
        const shrink = 40; // 避免箭头戳进头像里
        const ex = cx + dx * (1 - shrink / dist), ey = cy + dy * (1 - shrink / dist);
        const sx = cx + dx * (shrink / dist), sy = cy + dy * (shrink / dist);
        const midX = (sx + ex) / 2, midY = (sy + ey) / 2;
        // 好感度开启时，线的粗细随好感度绝对值变化，更直观地体现关系深浅
        const strokeWidth = (item.isUser && enableAffinitySystem) ? Math.max(1.5, Math.min(7, 2 + Math.abs(centerChar.affinity || 0) / 20)) : 2.5;
        linesHtml += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${color}" stroke-width="${strokeWidth}" marker-end="url(#relArrow${i})"></line>
            <text x="${midX}" y="${midY - 6}" fill="${color}" font-size="12" text-anchor="middle">${item.edge.label}</text>`;
    });
    // marker 定义（每条线独立颜色需要各自的 marker）
    let defs = '<defs>' + relatedChars.map((item, i) => `<marker id="relArrow${i}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="${item.edge.color || '#1d9bf0'}"></path></marker>`).join('') + '</defs>';

    svg.innerHTML = defs + linesHtml;
    nodesEl.innerHTML = nodesHtml;

    if (edges.length === 0) {
        document.getElementById('relationsListArea').innerHTML = '<div class="empty-state">暂无关系，点击右上角"＋ 添加关系"来建立吧！</div>';
    } else {
        document.getElementById('relationsListArea').innerHTML = '<div style="font-weight:bold; margin-bottom:8px; color:#536471;">关系列表</div>' + edges.map(r => {
            const otherId = r.fromId == charId ? r.toId : r.fromId;
            const other = otherId === 'me' ? currentUser : myCharacters.find(c => c.id == otherId);
            return `<div class="rel-chip" style="border-color:${r.color};">
                <span style="color:${r.color}; font-weight:bold;">${r.label}</span>
                <span>与 ${other ? other.name : '未知角色'}${otherId === 'me' ? '（用户）' : ''}</span>
                <button type="button" class="rel-chip-del" onclick="deleteRelationship('${r.id}')" title="删除这条关系">🗑 删除</button>
            </div>`;
        }).join('');
    }
}

function openAddRelationshipModal() {
    const targetSel = document.getElementById('relTargetCharSelect');
    const others = myCharacters.filter(c => c.id != currentRelationCharId);
    const userOptionHtml = `<option value="me">${currentUser.name}（用户）</option>`;
    if (others.length === 0) { targetSel.innerHTML = userOptionHtml; }
    else { targetSel.innerHTML = userOptionHtml + others.map(c => `<option value="${c.id}">${c.name}</option>`).join(''); }
    const typeSel = document.getElementById('relTypeSelect');
    typeSel.innerHTML = relationshipTypePresets.map((t, i) => `<option value="${i}">${t.label}</option>`).join('') + '<option value="custom">自定义...</option>';
    onRelTypeChange();
    openModal('addRelationshipModal');
}
function onRelTypeChange() {
    const val = document.getElementById('relTypeSelect').value;
    document.getElementById('relCustomFields').style.display = val === 'custom' ? 'block' : 'none';
}
function submitAddRelationship() {
    const targetId = document.getElementById('relTargetCharSelect').value;
    if (!targetId) return;
    const typeVal = document.getElementById('relTypeSelect').value;
    let label, color;
    if (typeVal === 'custom') {
        label = document.getElementById('relCustomLabel').value.trim();
        color = document.getElementById('relCustomColor').value;
        if (!label) return alert('请填写自定义标签！');
        // 用户自定义的新关系类型顺带存进预设列表，方便下次直接选用
        if (!relationshipTypePresets.some(t => t.label === label)) relationshipTypePresets.push({ label, color });
    } else {
        const preset = relationshipTypePresets[Number(typeVal)];
        label = preset.label; color = preset.color;
    }
    charRelationships.push({ id: 'rel_' + Date.now() + Math.floor(Math.random()*1000), fromId: currentRelationCharId, toId: targetId, label, color });
    saveAllData();
    closeModal('addRelationshipModal');
    renderCharRelationsView(currentRelationCharId);
}
async function deleteRelationship(relId) {
    if (!(await appConfirm('确定删除这条关系吗？'))) return;
    charRelationships = charRelationships.filter(r => r.id !== relId);
    saveAllData();
    renderCharRelationsView(currentRelationCharId);
}

// 👤 势力级的用户人设绑定：这个势力里的所有角色，默认都按这份人设认识你。
// 角色自己单独绑了的话，角色那条优先（见 js/01 resolveUserPersonaFor 的优先级说明）。
function factionPersonaOptions(selectedId) {
    const list = (typeof userPersonas !== 'undefined' && Array.isArray(userPersonas)) ? userPersonas : [];
    return '<option value="">跟随当前资料</option>'
        + list.map(p => `<option value="${p.id}"${p.id === selectedId ? ' selected' : ''}>${escapeHtml(p.label || '未命名人设')}</option>`).join('');
}
function setFactionUserPersona(factionName, personaId) {
    if (!factionName) return;
    if (personaId) factionUserPersona[factionName] = personaId;
    else delete factionUserPersona[factionName];
    if (typeof saveAllData === 'function') saveAllData();
    if (typeof appToast === 'function') {
        const p = (userPersonas || []).find(x => x && x.id === personaId);
        appToast(personaId ? `「${factionName}」里你是「${p ? (p.label || '未命名人设') : ''}」` : `「${factionName}」改回跟随当前资料`);
    }
}

// ---- 势力总览（CRUD 管理页）----
function renderFactionOverviewList() {
    const container = document.getElementById('factionOverviewList');
    let html = characterGroups.map(g => {
        const members = myCharacters.filter(c => charInFaction(c, g));
        return `
        <div class="faction-overview-row">
            <div class="faction-overview-row-head">
                <span class="faction-overview-del" onclick="deleteFactionOverview('${g.replace(/'/g,"\\'")}')">×</span>
                <input type="text" value="${g}" class="faction-overview-name-input" style="border-left:4px solid ${getFactionColor(g)};"
                    onblur="renameFactionOverview('${g.replace(/'/g,"\\'")}', this.value)">
                <span style="font-size:12px; color:#536471;">${members.length} 人</span>
            </div>
            <div class="faction-persona-row">
                <span>👤 在这个势力里，我是</span>
                <select onchange="setFactionUserPersona(${JSON.stringify(g).replace(/"/g, '&quot;')}, this.value)">
                    ${factionPersonaOptions(factionUserPersona[g] || '')}
                </select>
            </div>
            <div class="faction-overview-members">
                ${members.map(c => {
                    const others = getCharFactions(c).filter(x => x !== g);
                    const tip = others.length ? `点击移出「${g}」（还属于：${others.join('、')}）` : '点击移出该势力';
                    return `<div class="faction-overview-member" title="${escapeHtml(tip)}" onclick="removeCharFromFaction('${c.id}', ${JSON.stringify(g).replace(/"/g, '&quot;')})">${getAvatarHTML(c, 48)}<div class="faction-overview-member-name">${c.name}${others.length ? `<span style="color:#8b98a5;"> +${others.length}</span>` : ''}</div></div>`;
                }).join('')}
                <div class="faction-overview-add" onclick="openFactionCharPicker('${g.replace(/'/g,"\\'")}')">＋</div>
            </div>
        </div>`;
    }).join('');

    // 势力不明：不可删除
    const unknownMembers = myCharacters.filter(c => getCharFactions(c).length === 0);
    html += `
        <div class="faction-overview-row">
            <div class="faction-overview-row-head">
                <span style="width:20px; display:inline-block;"></span>
                <div class="faction-overview-name-input" style="border-left:4px solid ${getFactionColor(null)}; display:flex; align-items:center; color:#536471;">势力不明</div>
                <span style="font-size:12px; color:#536471;">${unknownMembers.length} 人</span>
            </div>
            <div class="faction-overview-members">
                ${unknownMembers.map(c => `<div class="faction-overview-member">${getAvatarHTML(c, 48)}<div class="faction-overview-member-name">${c.name}</div></div>`).join('')}
            </div>
        </div>`;
    container.innerHTML = html;
}

async function addFactionOverview() {
    const name = await appPrompt('请输入新势力的名称：'); if (!name || !name.trim()) return;
    const val = name.trim();
    if (characterGroups.includes(val)) return alert('该势力已存在！');
    if (val === '势力不明') return alert('该名称已被保留，请换一个名字。');
    characterGroups.push(val); getFactionColor(val); saveAllData(); renderFactionOverviewList();
}
function renameFactionOverview(oldName, newVal) {
    newVal = newVal.trim();
    if (!newVal || newVal === oldName) { renderFactionOverviewList(); return; }
    if (newVal === '势力不明' || characterGroups.includes(newVal)) { alert('名称无效或已存在'); renderFactionOverviewList(); return; }
    const idx = characterGroups.indexOf(oldName); if (idx === -1) return;
    characterGroups[idx] = newVal;
    if (factionColors[oldName]) { factionColors[newVal] = factionColors[oldName]; delete factionColors[oldName]; }
    renameFactionEverywhere(oldName, newVal);
    saveAllData(); renderFactionOverviewList();
}
async function deleteFactionOverview(name) {
    if (!(await appConfirm(`确定删除势力"${name}"吗？该势力下的角色将归入"势力不明"，角色本身不会被删除。`))) return;
    removeFactionEverywhere(name);
    characterGroups = characterGroups.filter(g => g !== name);
    delete factionColors[name];
    saveAllData(); renderFactionOverviewList();
}
// 🏴 只把这个角色移出**这一个**势力，它属于的其它势力不受影响。
// （以前是 c.group='' 一刀切清空，多势力之后那样会把别的势力也一起抹掉。）
function removeCharFromFaction(charId, factionName) {
    const c = myCharacters.find(x => x.id == charId); if (!c) return;
    if (factionName) setCharFactions(c, getCharFactions(c).filter(g => g !== factionName));
    else setCharFactions(c, []);
    saveAllData(); renderFactionOverviewList();
}
let factionPickerTarget = null;
function openFactionCharPicker(factionName) {
    factionPickerTarget = factionName;
    const list = document.getElementById('factionCharPickerList');
    const candidates = myCharacters.filter(c => !charInFaction(c, factionName));
    if (candidates.length === 0) { list.innerHTML = '<div style="color:#536471; font-size:13px;">已经没有其他角色可以添加了。</div>'; }
    else {
        list.innerHTML = candidates.map(c => `
            <div style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; cursor:pointer;" onmouseover="this.style.background='#f7f9f9'" onmouseout="this.style.background='transparent'" onclick="assignCharToFaction('${c.id}')">
                ${getAvatarHTML(c, 36)}<span>${c.name}</span><span style="margin-left:auto; font-size:12px; color:#536471;">${getCharFactions(c).join('、') || '势力不明'}</span>
            </div>`).join('');
    }
    openModal('factionCharPickerModal');
}
function assignCharToFaction(charId) {
    const c = myCharacters.find(x => x.id == charId); if (!c || !factionPickerTarget) return;
    // 🏴 追加而不是覆盖：加进新势力不会把它原来的势力挤掉
    setCharFactions(c, getCharFactions(c).concat([factionPickerTarget]));
    saveAllData(); closeModal('factionCharPickerModal'); renderFactionOverviewList();
}
// ====== 手机端长按呼出菜单专用代码 ======
let avatarTouchTimer = null;
function avatarTouchStart(e, charId) {
    if (avatarTouchTimer) clearTimeout(avatarTouchTimer);
    const touch = e.touches ? e.touches[0] : e;
    const pageX = touch.pageX, pageY = touch.pageY;
    avatarTouchTimer = setTimeout(() => {
        // 修复：showAvatarContextMenu 内部还会调用 e.stopPropagation()，这里伪造的事件对象之前只给了
        // preventDefault，手机长按触发时就会报"e.stopPropagation is not a function"，补上这个空函数即可
        showAvatarContextMenu({ preventDefault: () => {}, stopPropagation: () => {}, pageX, pageY }, charId);
        avatarTouchTimer = null;
    }, 600); // 触控按住 0.6秒 后呼出菜单
}
function avatarTouchEnd(e) {
    if (avatarTouchTimer) {
        clearTimeout(avatarTouchTimer);
        avatarTouchTimer = null;
    }
}

// 群聊头像长按 → 打开聊天选项（发言顺序等），修复移动端无法长按呼出群聊选项的问题
let groupAvatarTouchTimer = null;
function groupAvatarTouchStart(e, groupId) {
    if (groupAvatarTouchTimer) clearTimeout(groupAvatarTouchTimer);
    const touch = e.touches ? e.touches[0] : e;
    const pageX = touch.pageX, pageY = touch.pageY;
    groupAvatarTouchTimer = setTimeout(() => {
        showGroupAvatarContextMenu({ preventDefault: () => {}, stopPropagation: () => {}, pageX, pageY }, groupId);
        groupAvatarTouchTimer = null;
    }, 600);
}
function groupAvatarTouchEnd(e) {
    if (groupAvatarTouchTimer) {
        clearTimeout(groupAvatarTouchTimer);
        groupAvatarTouchTimer = null;
    }
}

// 🔄 侧滑/回档等聊天气泡长按菜单：修复移动端触屏无法呼出右键菜单的问题
let chatBubbleTouchTimer = null;
function chatBubbleTouchStart(e, msgIdx) {
    if (chatBubbleTouchTimer) clearTimeout(chatBubbleTouchTimer);
    const touch = e.touches ? e.touches[0] : e;
    const pageX = touch.pageX, pageY = touch.pageY;
    chatBubbleTouchTimer = setTimeout(() => {
        // 同步补上 stopPropagation，跟 showAvatarContextMenu 那处是一样的隐患，防止以后改动触发同类报错
        showChatContextMenu({ preventDefault: () => {}, stopPropagation: () => {}, pageX, pageY }, msgIdx);
        chatBubbleTouchTimer = null;
    }, 500); // 触控按住 0.5秒 后呼出菜单（含侧滑重新生成、重新编辑、开辟分支等操作）
}
function chatBubbleTouchEnd(e) {
    if (chatBubbleTouchTimer) {
        clearTimeout(chatBubbleTouchTimer);
        chatBubbleTouchTimer = null;
    }
}
// ====== 1. 角色专属纪念日：添加逻辑 ======
function addCharAnniversaryWithSync() {
    const dateInput = document.getElementById('newAnniversaryDate');
    const eventInput = document.getElementById('newAnniversaryEvent');
    const dateVal = dateInput ? dateInput.value : '';
    const eventVal = eventInput ? eventInput.value.trim() : '';

    if (!dateVal || !eventVal) return alert("请先点击日历选择日期，并填写纪念日名称！");

    let charId = currentCalendarCharId || currentProfileId || currentChatSessionId || null;
    let char = null;
    
    if (charId) char = myCharacters.find(c => c.id == charId);
    else {
        const nameEl = document.getElementById('characterCenterName') || document.getElementById('profileName');
        if (nameEl) char = myCharacters.find(c => c.name === nameEl.innerText.trim());
        if (!char && myCharacters.length > 0) char = myCharacters[0]; 
    }

    if (!char) return alert("未能定位当前角色，请重新打开资料页重试。");
    if (!char.anniversaries) char.anniversaries = [];

    char.anniversaries.push({
        id: "anniv_" + Date.now().toString(),
        date: dateVal,
        event: eventVal
    });

    if (typeof saveAllData === 'function') saveAllData();
    dateInput.value = "";
    eventInput.value = "";

    // 🌟 添加后瞬间刷新画面 🌟
    renderCharCalendarModalContent(char.id);
}


// ====== 2. 智能显示列表（修复计算Bug + 提取AI记忆） ======
function renderCharCalendarModalContent(charId) {
    const char = myCharacters.find(c => c.id == charId);
    if (!char) return;

    const listDiv = document.getElementById('charCalendarAnniversary');
    if (!listDiv) return;

    let allAnniversaries = [];
    if (char.anniversaries && char.anniversaries.length > 0) allAnniversaries = [...char.anniversaries];

    if (char.memories && char.memories.length > 0) {
        char.memories.forEach(m => {
            const titleMatch = m.title && (m.title.includes('纪念') || m.title.includes('天') || m.title.includes('相识'));
            if ((m.dateStr || titleMatch) && !allAnniversaries.find(a => a.id === m.id)) {
                let dStr = m.dateStr;
                if (!dStr) {
                    const d = new Date(m.timestamp || Date.now());
                    dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                }
                if (!allAnniversaries.find(a => a.date === dStr && a.event.includes(m.title.replace(/🗓️.*：/, '').trim()))) {
                    allAnniversaries.push({ id: m.id, date: dStr, event: m.title.replace(/🗓️.*：/, '').trim() || m.title, isAiMemory: true });
                }
            }
        });
    }

    // --- 天数一律走 annBaseInfo（js/05）---
    // 以前这里自己算一套、checkAndAnnounceAnniversary 又自己算一套（从聊天记录第一条起算），
    // 同一天两个数对不上。现在两边共用一个函数。
    const _ann = (typeof annBaseInfo === 'function') ? annBaseInfo(char) : null;
    const displayDays = _ann ? _ann.days : 1;
    const baseLabel = _ann ? _ann.label : '我们相识';
    const baseDateStr = _ann ? _ann.dateStr : '';

    let htmlStr = `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-radius:6px; background:linear-gradient(to right, #e8f5fd, #f0f8ff); color:#0f1419; margin-bottom:8px; border-left:4px solid #1d9bf0;">
        <div style="flex:1; font-size:13px; color:#1d9bf0;">
            ⏳ <strong>${baseDateStr}</strong> — ${baseLabel}的第 <strong style="font-size:16px; color:#f91880;">${displayDays}</strong> 天！
        </div>
    </div>`;

    if (allAnniversaries.length > 0) {
        allAnniversaries.sort((a, b) => new Date(a.date) - new Date(b.date));
        allAnniversaries.forEach(a => {
            const aiBadge = a.isAiMemory ? `<span style="font-size:10px; background:#e8f5fd; color:#1d9bf0; padding:2px 6px; border-radius:4px; margin-left:6px;">🤖 AI记忆</span>` : '';
            htmlStr += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed #eff3f4; color:#0f1419;">
                <div style="flex:1; font-size:13px;">🗓️ <strong>${a.date}</strong> — ${a.event} ${aiBadge}</div>
                ${a.isAiMemory ? '' : `<button onclick="deleteCharAnniversary('${char.id}', '${a.id}')" style="background:#fff0f4; border:1px solid #f91880; color:#f91880; border-radius:4px; cursor:pointer; font-size:12px; padding:4px 8px; margin-left:10px; transition:0.2s;">🗑️ 删除</button>`}
            </div>`;
        });
    } else {
        htmlStr += '<div style="color:#8b98a5; font-size:12px; text-align:center; margin-top:10px;">暂无其他纪念日，在上方添加吧~</div>';
    }

    listDiv.innerHTML = htmlStr;
}


// ====== 3. 纪念日删除功能 ======
async function deleteCharAnniversary(charId, annivId) {
    if (!(await appConfirm("确定要删除这条记录吗？"))) return;
    const char = myCharacters.find(c => c.id == charId);
    if (!char) return;
    if (char.anniversaries) char.anniversaries = char.anniversaries.filter(a => a.id !== annivId);
    if (char.memories) char.memories = char.memories.filter(m => m.id !== annivId);
    if (typeof saveAllData === 'function') saveAllData();
    renderCharCalendarModalContent(charId);
}


// ====== 4. 终极防洗屏监听器：只要弹窗一出来，立刻夺回画面控制权 ======
if (typeof window.hasInjectedCalendarObserver === 'undefined') {
    window.hasInjectedCalendarObserver = true;
    
    // 我们派一个“暗哨”盯着纪念日弹窗
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'style') {
                const modal = document.getElementById('charCalendarModal');
                if (modal && window.getComputedStyle(modal).display !== 'none') {
                    // 当发现弹窗从隐藏变成显示时，延迟50毫秒（等原系统把错误数据画完），我们再强行用正确数据覆盖
                    setTimeout(() => {
                        let charId = currentCalendarCharId || currentProfileId || currentChatSessionId || null;
                        if (!charId) {
                            const nameEl = document.getElementById('characterCenterName') || document.getElementById('profileName');
                            if (nameEl) {
                                let c = myCharacters.find(x => x.name === nameEl.innerText.trim());
                                if (c) charId = c.id;
                            }
                        }
                        if (charId) renderCharCalendarModalContent(charId);
                    }, 50);
                }
            }
        });
    });

    // 页面加载完成后立刻开始盯梢
    document.addEventListener("DOMContentLoaded", () => {
        const modal = document.getElementById('charCalendarModal');
        if (modal) observer.observe(modal, { attributes: true });
    });
    
    // 如果网页没刷新就跑了这段代码，也直接挂上盯梢
    const modal = document.getElementById('charCalendarModal');
    if (modal) observer.observe(modal, { attributes: true });
}
// ==========================================
// 📥 智能导入同类软件角色卡引擎 (支持 PNG/WEBP/JSON)
// ==========================================
async function handleCharCardImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 清空 input 允许重复选择同一个文件
    event.target.value = '';

    const fileName = file.name.toLowerCase();
    let charData = null;
    let b64Image = null;

    try {
        if (fileName.endsWith('.json')) {
            const text = await file.text();
            charData = JSON.parse(text);
        } 
        else if (fileName.endsWith('.png')) {
            b64Image = await fileToBase64(file);
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            
            // 深入解析 PNG 的 tEXt 数据块
            if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
                let offset = 8;
                while (offset < bytes.length) {
                    const length = (bytes[offset] << 24) | (bytes[offset+1] << 16) | (bytes[offset+2] << 8) | bytes[offset+3];
                    const type = String.fromCharCode(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7]);
                    if (type === 'tEXt') {
                        let i = offset + 8;
                        let keyword = "";
                        while (bytes[i] !== 0 && i < offset + 8 + length) {
                            keyword += String.fromCharCode(bytes[i]);
                            i++;
                        }
                        if (keyword === 'chara') {
                            i++; // 跳过 Null 分隔符
                            const textBytes = bytes.slice(i, offset + 8 + length);
                            const textStr = new TextDecoder('utf-8').decode(textBytes);
                            try {
                                // 处理 Base64 解码中的 UTF-8 中文乱码
                                const binaryString = atob(textStr);
                                const binBytes = new Uint8Array(binaryString.length);
                                for (let j = 0; j < binaryString.length; j++) {
                                    binBytes[j] = binaryString.charCodeAt(j);
                                }
                                const jsonString = new TextDecoder('utf-8').decode(binBytes);
                                charData = JSON.parse(jsonString);
                            } catch(e) { console.error("PNG 数据解析失败", e); }
                            break;
                        }
                    }
                    offset += 8 + length + 4;
                }
            }
        } 
        else if (fileName.endsWith('.webp') || fileName.endsWith('.jpg')) {
            b64Image = await fileToBase64(file);
            const text = await file.text();
            // 暴力提取引擎：通过正则表达式在图片二进制文本中寻找被 Base64 编码的 JSON
            // (JSON 开头都是 {"name" -> 对应 Base64 的 eyJ)
            const base64Regex = /(eyJ[A-Za-z0-9+/=]+)/g;
            let matches = text.match(base64Regex);
            if (matches) {
                for (let m of matches) {
                    if (m.length > 200) { 
                        try {
                            const decoded = new TextDecoder('utf-8').decode(Uint8Array.from(atob(m), c => c.charCodeAt(0)));
                            if (decoded.includes('"name"') && (decoded.includes('"description"') || decoded.includes('"data"'))) {
                                charData = JSON.parse(decoded);
                                break;
                            }
                        } catch(e) {}
                    }
                }
            }
        }
    } catch(e) {
        console.error("读取文件异常:", e);
    }

    // 🆕 一张卡/一份 JSON 里可能打包了不止一个角色（少数导出工具会这样），
    // 这种情况不该只认第一个——弹个勾选框让你自己挑要导入哪几个，一个个走完整流程排队导入。
    if (charData) {
        const multiList = detectMultiCharList(charData);
        if (multiList) {
            openMultiCardPickerModal(multiList, b64Image);
            return;
        }
    }

    if (!charData) {
        // 没读到内嵌的角色卡数据，但如果拖进来的是一张图（没嵌同类软件数据的普通插画/照片），
        // 直接判定"失败"太不友好了——多半是想拿这张图当新角色的头像用。顺手帮你把图放进新建表单，
        // 名字/人设留空让你自己填（或者用"照着人设补全空白资料"）。
        if (b64Image) {
            openFormForCreate();
            tempCropResults.charAvatar = b64Image;
            const preview = document.getElementById('charAvatarPreview');
            if (preview) { preview.src = b64Image; preview.style.display = 'block'; }
            alert('ℹ️ 这张图里没读到内嵌的角色卡数据（应该是张普通插画/照片），已经先当头像放进新角色表单里了——自己填个名字和人设就行，也可以用下面的「✨ 照着人设补全空白资料」。');
            gyMaybeDetectMultiChar(b64Image, { manual: false });
            return;
        }
        alert("⚠️ 未能从该文件中读取到有效的角色卡数据！\n目前支持自带设定的同类软件角色卡(PNG/WEBP) 或 原生 JSON 文件。");
        return;
    }

    // 兼容 V1 和 V2 格式规范
    const data = charData.data || charData;

    // 🆕 已经有同名角色：先问一声，别不小心导两遍（js/55）
    if (typeof window.gyCardDupCheck === 'function') {
        let names = [data.name];
        try { if (isAutoOn('cardSplitAsk')) { const ps = splitCardPersonaByCharacter(data); if (ps && ps.length > 1) names = ps.map(x => x.name); } } catch (e) {}
        if (!(await window.gyCardDupCheck(names))) return;
    }

    // 🆕 真正常见的"一张卡好几个人"：卡本身是合规的单卡（一个 name、一份 description），
    // 但 description 正文里其实写了两个甚至更多角色（双人卡/CP卡，名字往往写成"A&B"）。
    // 以前这种卡导进来就是一个叫"清衍&淮安"的角色，5000 字人设里塞着两兄弟，
    // 程序完全不知道那是两个人——聊天、推文、关系网全都当一个人处理。
    // 现在先按正文结构把人拆开（纯本地，不花一次调用），拆得出来就问你要不要分开导入。
    if (isAutoOn('cardSplitAsk')) {
        // ① 正文里就写了好几个人（双人卡/CP卡）
        const parts = splitCardPersonaByCharacter(data);
        if (parts && parts.length > 1) {
            openCardSplitModal(parts, data, b64Image);
            return;
        }
        // ② 正文空/很短，人全在世界书里（世界卡、剧情卡）——这种卡照老办法导，
        //    只会得到一个人设空白、名字叫"时间病症"的角色，等于没导。
        const wbFound = findCharsInWorldbook(data);
        if (wbFound.length) {
            openCardSplitModal(wbCharsToParts(wbFound, data), data, b64Image, {
                fromWorldbook: true,
                sure: wbFound.map(c => !!c.sure),
                meta: wbFound.map(c => `${c.entries.length} 条词条`)
            });
            return;
        }
    }

    await fillCharFormFromCardData(data, b64Image);
    gyMaybeDetectMultiChar(b64Image, { manual: false });
}

// ==========================================
// ✂️ 把"一张卡里写了好几个角色"的正文按角色拆开
// 判断依据全部来自卡片正文本身的结构，纯本地、不调 API：
//   ① <character_information character="季清衍">…</character_information>（中文卡里最常见的写法）
//   ② <character name="X">/ <char name="X"> 这类变体
//   ③ 正文里重复出现 char_name: / CharacterName: / 姓名： 且后面跟着不同的名字
// 拆不出来就返回 null（这时候不自动弹窗，留给你手动点「让 AI 帮忙拆」）。
// 块外面的文字（开头的世界观、结尾的通用规则）算"公共部分"，每个人都带一份。
// ==========================================
function splitCardPersonaByCharacter(data) {
    const desc = String((data && data.description) || '');
    if (desc.length < 400) return null;   // 太短的正文不折腾，多半就是一个人

    // ① / ② 带名字属性的成对标签
    const tagRe = /<(?:character_information|character|char)\b[^>]*\b(?:character|name)\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:character_information|character|char)>/gi;
    let m, blocks = [], lastEnd = 0, head = '', tails = [];
    while ((m = tagRe.exec(desc)) !== null) {
        if (blocks.length === 0) head = desc.slice(0, m.index);
        else tails.push(desc.slice(lastEnd, m.index));
        blocks.push({ name: String(m[1]).trim(), body: String(m[2]).trim() });
        lastEnd = m.index + m[0].length;
    }
    if (blocks.length > 1) {
        const tail = desc.slice(lastEnd);
        // 块之间/前后的零碎文字：只有真有内容（不只是空行）才当公共部分带上
        const sharedBits = [head, ...tails, tail].map(s => String(s).trim()).filter(s => s.length > 30);
        const shared = sharedBits.join('\n\n');
        return blocks.map(b => ({ name: b.name, persona: b.body, shared }));
    }

    // ③ 重复的 char_name: / CharacterName: / 姓名： 标记
    const markRe = /(?:^|\n)\s*(?:<[^>\n]*>\s*)?(?:CharacterName\s*[:：]\s*)?(?:char_name|角色名|姓名|名字)\s*[:：]\s*(?:name\s*[:：]\s*)?([^\n\r]{1,24})/gi;
    const marks = [];
    while ((m = markRe.exec(desc)) !== null) {
        const nm = String(m[1]).replace(/["'|>]/g, '').trim();
        if (nm && nm.length <= 20) marks.push({ name: nm, at: m.index });
    }
    // 名字去重后至少两个不同的人，且每段都有点分量，才认为是多角色卡
    const uniq = [];
    marks.forEach(x => { if (!uniq.some(u => u.name === x.name)) uniq.push(x); });
    if (uniq.length > 1) {
        const head2 = desc.slice(0, uniq[0].at).trim();
        const out = uniq.map((u, i) => ({
            name: u.name,
            persona: desc.slice(u.at, i + 1 < uniq.length ? uniq[i + 1].at : desc.length).trim(),
            shared: head2.length > 30 ? head2 : ''
        }));
        if (out.every(o => o.persona.length > 200)) return out;
    }
    return null;
}

// ==========================================
// 🌍 世界卡：正文是空的，人全住在世界书里
// 很多剧情卡/世界卡的 description 压根没内容（0 字），26~35 条世界书里才是真东西：
//   角色/白宴山基础信息、角色/白琛三面性、_24岁林秋壬、【NPC】林忆佑、季景行人设……
// 这种卡按老逻辑导进来，就是一个叫"时间病症"的角色，人设一个字都没有，等于白导。
// 这里按词条标题和 keys 认出"世界书里住着哪几个人"，纯本地判断，不调 API。
// ==========================================
const GY_WBC = (function () {
    // 一看就不是人名的词
    const NOT_NAME = /^(npc|nsfw|sfw|cot|ooc|user|char|性爱|操逼|做爱|亲吻|抚摸|床|性癖|性交|性行为|性事|情欲|剧情|场景|催眠|家人|朋友|兄弟|哥哥|弟弟|姐姐|妹妹|父亲|母亲|爸爸|妈妈|三人|修罗场|新人|体验师|新npc|故事|故事背景|禁止剧透|世界观|状态栏|时间线|设定|规则|总纲|简介|背景|系统|地图|流程|目录|玩法|图鉴|随机|通用|其他|其它)$/i;
    // 地点/玩法/机制类词条名——世界卡里这类最多，不挡掉会刷一屏假人
    const NOT_PERSON = /(区$|区域|项目|服务|生成|流程|规则|系统|图鉴|随机|状态栏|界面|总纲|花名册|时间线|地图|目录|玩法|模式|设置|选开|if$|nsfw$|sfw$)/i;
    // 机构/地名/机制：世界卡里这些词条跟角色词条长得一模一样，只能靠词本身认
    const NOT_PLACE = /(学院|学校|王国|帝国|公国|教会|公会|商会|军团|拍卖|委托|任务|副本|山脉|森林|沙漠|湖泊|岛$|城$|镇$|村$|国$|港$|街$|殿$|楼$|塔$)/;
    // 名字里带标点的基本是句子/标题（"色情，什么的"、"给我活起来！"）
    const PUNCT_IN_NAME = /[，,。！!？?：:；;、…—\-（）()【】\[\]"'“”‘’]/;
    const TITLE_STRIP = [
        /^[_\-\s]*/, /^【[^】]*】\s*/, /^\[[^\]]*\]\s*/, /^（[^）]*）\s*/, /^\([^)]*\)\s*/,
        /^角色[\/／:：]\s*/, /^人物[\/／:：]\s*/, /^NPC[_\-\s:：]*/i, /^\d+岁\s*/, /^第?[一二三四五六七八九十]+[、.]\s*/
    ];
    const SUFFIX_STRIP = [
        /[_\-\s]*人设(强调)?$/, /[_\-\s]*基础信息$/, /[_\-\s]*性格调色盘$/, /[_\-\s]*NSFW调色盘$/i,
        /[_\-\s]*NSFW指导$/i, /[_\-\s]*三面性$/, /[_\-\s]*二次解释$/, /[_\-\s]*档案$/, /[_\-\s]*设定$/,
        /[_\-\s]*简介$/, /[_\-\s]*补充$/, /[_\-\s]*详细$/, /[_\-\s]*说明$/, /的sex档案$/i
    ];
    function stripTitle(t) {
        let s = String(t || '').replace(/[\r\n]+/g, ' ').trim(), prev;
        do { prev = s; TITLE_STRIP.forEach(re => { s = s.replace(re, ''); }); } while (s !== prev);
        do { prev = s; SUFFIX_STRIP.forEach(re => { s = s.replace(re, ''); }); } while (s !== prev);
        return s.trim();
    }
    function looksLikeName(s) {
        if (!s) return false;
        const t = String(s).trim();
        if (t.length < 2 || t.length > 8) return false;
        if (NOT_NAME.test(t) || NOT_PERSON.test(t) || NOT_PLACE.test(t) || PUNCT_IN_NAME.test(t)) return false;
        if (/\d/.test(t)) return false;   // 带数字的基本是玩法/期数（"游乐30日"、"D30"）
        // ⚠️ 不能用 \W 判断"全是符号"——JS 里中文算 \W，一用就把中文名字全毙了
        if (!/[一-龥぀-ヿA-Za-z]/.test(t)) return false;
        return true;
    }
    return { stripTitle, looksLikeName };
})();

function findCharsInWorldbook(data) {
    // ⚠️ 只有"正文空着"的卡才按世界卡处理。正文里已经写满人设的（普通单人卡，四五千字那种），
    // 世界书是给这一个人配的背景资料，里面的地名/设定名会被误认成人（"三中"、"丧尸"、"蜂巢"）。
    // 实测：加上这一条，全库 14 张单人卡的误判一次性全没了。
    if (String((data || {}).description || '').trim().length > 800) return [];
    const entries = (((data || {}).character_book || {}).entries || []).filter(e => e && e.content);
    if (entries.length < 3) return [];

    // 一、收候选名字：每条词条贡献 keys[0]（这类卡里几乎总是本名）和标题脱壳后的残留
    const cand = new Map();
    const touch = (name, aliases) => {
        if (!GY_WBC.looksLikeName(name)) return;
        if (!cand.has(name)) cand.set(name, { name, aliases: [], entries: [], chars: 0 });
        const c = cand.get(name);
        (aliases || []).forEach(a => {
            a = String(a || '').trim();
            if (a && a !== name && a.length <= 8 && c.aliases.indexOf(a) < 0) c.aliases.push(a);
        });
    };
    entries.forEach(e => {
        const keys = (e.keys || []).map(k => String(k).trim()).filter(Boolean);
        if (keys.length) touch(keys[0], keys.slice(1));
        touch(GY_WBC.stripTitle(e.comment), []);
    });

    // 二、分词条。只认名字本身，别名只用来显示——keys 后面那几个位置常躺着别人的名字，
    // 拿来匹配会把别人的词条算到这个人头上。
    cand.forEach(c => {
        entries.forEach(e => {
            const t = String(e.comment || '');
            const keys = (e.keys || []).map(k => String(k));
            if (t.indexOf(c.name) >= 0 || keys.indexOf(c.name) >= 0) {
                c.entries.push(e); c.chars += String(e.content).length;
            }
        });
    });

    // 三、真角色总会在好几条词条里被提到（人设/性格/NSFW/时间线各一条）；只出现一次的多半是误认
    let out = [];
    cand.forEach(c => { if (c.entries.length >= 2) out.push(c); });
    // 名字互相包含的（林秋壬 vs 林秋壬nsfw），留短的那个
    out = out.filter(c => !out.some(o => o !== c && o.name.length < c.name.length && c.name.indexOf(o.name) >= 0));
    out.sort((a, b) => b.chars - a.chars);
    // 被更强的人完全盖住的，是蹭出来的，不是独立的人
    out = out.filter(c => !out.some(o => o !== c && o.chars > c.chars * 2 &&
        c.entries.every(e => o.entries.indexOf(e) >= 0)));
    // 相对门槛：主角们的词条数是一个量级，地名/机制蹭出来的是另一个量级。
    // 比如《沉沦法则》八个主角各 21~26 条，而"皇家魔法学院""地下拍卖会"这些只有 2~6 条，
    // 按"不到头名四分之一就不算人"一刀切下去，16 个假人全没了，8 个真角色一个不少。
    if (out.length) {
        const top = out[0].entries.length;
        const floor = Math.max(2, Math.floor(top / 4));
        out = out.filter(c => c.entries.length >= floor);
    }
    out.forEach(c => { c.sure = c.entries.length >= 3 || c.chars >= 3000; });
    return out;
}

// 把认出来的人做成"可以直接导入"的样子。
// ⚠️ 人设不塞全部词条：世界书整本本来就会导入并挂给每个人（按名字关键词自己会触发），
// 全塞一遍等于同样的字存两份，还能把人设撑到五万字。这里按大小取到 8000 字为止，
// 剩下的列个名字说明"在世界书里"。
function wbCharsToParts(found, data) {
    return found.map(c => {
        const sorted = c.entries.slice().sort((a, b) => String(b.content).length - String(a.content).length);
        const take = [], rest = [];
        let budget = 8000;
        sorted.forEach(e => {
            const len = String(e.content).length;
            if (take.length === 0 || budget - len > 0) { take.push(e); budget -= len; }
            else rest.push(e);
        });
        let persona = take.map(e => `【${String(e.comment || '设定').trim()}】\n${e.content}`).join('\n\n');
        if (rest.length) {
            persona += `\n\n【其余设定在世界书里】\n${rest.map(e => String(e.comment || '').trim()).filter(Boolean).join('、')}`;
        }
        if (c.aliases.length) persona = `【也被叫做】${c.aliases.slice(0, 6).join('、')}\n\n` + persona;
        return { name: c.name, persona, shared: String((data && data.description) || '').trim() };
    });
}

// 弹窗：问你这张卡里的几个人要不要分开导入。
// opts.fromWorldbook=true 表示这些人是从世界书里认出来的（世界卡/剧情卡），措辞和默认勾选都不一样：
// 世界书认人没有正文拆分那么确定，所以拿不准的那几个默认不勾上。
function openCardSplitModal(parts, data, b64Image, opts) {
    opts = opts || {};
    const wb = !!opts.fromWorldbook;
    const rows = parts.map((p, i) => {
        const on = wb ? (opts.sure && opts.sure[i] !== false) : true;
        const meta = (opts.meta && opts.meta[i]) ? `${opts.meta[i]} · ` : '';
        return `<label style="display:flex; gap:8px; align-items:flex-start; padding:8px 10px; border:1px solid #eee; border-radius:8px; margin-bottom:6px; font-size:13px; cursor:pointer;">
        <input type="checkbox" class="gyCardSplitPick" value="${i}"${on ? ' checked' : ''} style="margin-top:3px;">
        <span><b>${escapeHtml(p.name)}</b> <span style="color:#536471;">（${meta}${p.persona.length} 字人设）</span><br>
        <span style="color:#536471;">${escapeHtml(p.persona.replace(/\s+/g, ' ').slice(0, 50))}…</span></span>
    </label>`;
    }).join('');
    const wbCount = (data.character_book && data.character_book.entries || []).length;
    const title = wb ? `🌍 这张卡的人都写在世界书里` : `✂️ 这张卡里写了 ${parts.length} 个角色`;
    const intro = wb
        ? `卡名是「${escapeHtml(String(data.name || ''))}」，正文只有 ${String(data.description || '').length} 字——
           这是张世界卡，真正的人都在那 ${wbCount} 条世界书里。照老办法导的话，你只会得到<b>一个</b>叫
           「${escapeHtml(String(data.name || ''))}」、人设一片空白的角色。下面这些是认出来的人，
           拿不准的没帮你勾上，你自己看着挑：`
        : `卡名是「${escapeHtml(String(data.name || ''))}」，但正文里其实是 ${parts.length} 个人的设定。
           不拆的话，他们会被当成<b>同一个人</b>导进来（聊天、推文、关系网全都只有一个账号）。`;
    const note = wb
        ? `导入之后：每人一份自己的人设（太长的部分留在世界书里，靠名字关键词照样会触发），
           那 ${wbCount} 条世界书只导入一次、每个人都挂上，头像图先都放进去，你自己再各裁各的。`
        : `拆开之后：每个人一份自己的人设${wbCount ? `，卡里那 ${wbCount} 条世界书只导入一次、每个人都挂上` : ''}，
           开场白和公共设定每个人都带一份，头像图先都放进去，你自己再各裁各的。`;
    const html = `
    <div id="gyCardSplitModal" style="position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:99999; display:flex; align-items:center; justify-content:center;">
      <div style="background:#fff; border-radius:14px; max-width:430px; width:92%; max-height:82vh; overflow:auto; padding:18px;">
        <h3 style="margin:0 0 8px; color:#1d9bf0;">${title}</h3>
        <div style="font-size:13px; color:#536471; margin-bottom:10px; line-height:1.6;">${intro}</div>
        ${rows}
        <div style="font-size:12px; color:#536471; margin:10px 0; line-height:1.6;">${note}</div>
        <div style="display:flex; gap:8px;">
          <button class="btn-post" style="flex:2;" onclick="confirmCardSplit()">${wb ? '👥 把勾上的建成角色' : '✂️ 拆开分别导入'}</button>
          <button class="btn-secondary" style="flex:1;" onclick="cancelCardSplit()">${wb ? '不用，照老办法导' : '不拆，当一个'}</button>
        </div>
      </div>
    </div>`;
    const old = document.getElementById('gyCardSplitModal'); if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    window.__gyCardSplitParts = parts; window.__gyCardSplitData = data; window.__gyCardSplitB64 = b64Image;
}
function cancelCardSplit() {
    const m = document.getElementById('gyCardSplitModal'); if (m) m.remove();
    const data = window.__gyCardSplitData, b64Image = window.__gyCardSplitB64;
    if (data) fillCharFormFromCardData(data, b64Image);
}
