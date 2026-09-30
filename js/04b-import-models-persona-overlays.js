// ✂️ 这个文件是从 04-mobile-bootstrap-notifications.js 拆出来的第 2 段（原来一个文件太大，改起来容易改坏）。
// 跟 04-mobile-bootstrap-notifications.js 以及同一组的其它段共用一个全局作用域，index.html 里的加载顺序不能换。

function exportData() {
    const data = getFullDataSnapshot();
    saveTextFileForApp("twitter_ai_backup.json", JSON.stringify(data, null, 2), "application/json");
}
function triggerImport() { openFilePickerForApp('importFileInput'); }
async function importData(event) {
    const file = event.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            // 直接写入和自动存档同一个数据库，再用同一套（已经过充分测试的）加载逻辑来应用，
            // 这样备份恢复和日常自动存档永远读取的是同一份字段清单，不会再出现"恢复漏了什么"的问题
            await localforage.setItem('myTwitterAppData', data);
            await loadAllData();
            // 恢复存档等于把内存里所有数据整个换掉，这时候还开着的任何弹窗显示的都是旧数据，
            // 留着只会挡住界面（用户反馈的"导入备份之后必须大退一次"，这是其中一种情况）。
            gyCloseAllOverlays();
            updateUserMiniProfile(); if(typeof renderTrends === 'function') renderTrends(); updateGlobalBgStyles(); applyGlobalCSS(); applyNovelCSS(); updateSiteLogo(); switchMainView('home'); updateCharSelects();
            alert("数据恢复成功！欢迎回来。");
        } catch(err) { alert("文件格式错误，恢复失败！" + err.message); }
    };
    reader.readAsText(file); document.getElementById('importFileInput').value = '';
}

// 「拉取模型」的核心逻辑单独抽出来：三个拉取按钮（主API/副API/向量）本来各写了一遍
// 一模一样的 fetch+解析，现在共用这一份；角色卡组件调 getModelList() 时走的也是它，
// 保证"卡片看到的模型列表"跟你在设置页点拉取看到的完全一致。
async function fetchModelListFrom(url, key) {
    let u = String(url || '').trim();
    const k = String(key || '').trim();
    if (!u || !k) throw new Error('接口地址和密钥都要填');
    if (u.endsWith('/')) u = u.slice(0, -1);
    const res = await smartFetch(`${u}/models`, { method: 'GET', headers: { 'Authorization': `Bearer ${k}` } });
    if (!res.ok) {
        // 对面返回的正文里常常写着真正原因（"model not found"、"insufficient quota"…），
        // 以前直接丢掉，只剩一个光秃秃的状态码。
        let detail = '';
        try { detail = (await res.text() || '').replace(/\s+/g, ' ').slice(0, 160); } catch (e) {}
        throw new Error(`HTTP 错误代码: ${res.status}` + (detail ? `　对面说：${detail}` : ''));
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.data)) throw new Error('接口返回的数据格式不符合标准。');
    return data.data;
}

async function fetchModels() {
    let urlInput = document.getElementById('apiUrlInput').value.trim(); const keyInput = document.getElementById('apiKeyInput').value.trim();
    if (!urlInput || !keyInput) return alert("请先填写接口地址和密钥！");
    if(urlInput.endsWith('/')) urlInput = urlInput.slice(0, -1);
    const btn = event.target; const oldText = btn.innerText; btn.innerText = "正在拉取模型中... ⏳"; btn.disabled = true;
    try {
        const list = await fetchModelListFrom(urlInput, keyInput);
        document.getElementById('modelSelect').innerHTML = list.map(m => `<option value="${m.id}">${m.id}</option>`).join('');
        alert(`成功拉取 ${list.length} 个模型！`);
    } catch (e) { alert("拉取失败：" + (typeof enhanceNetworkErrorMessage === 'function' ? enhanceNetworkErrorMessage(e.message) : e.message)); } finally { btn.innerText = oldText; btn.disabled = false; }
}

async function fetchSubModels() {
    let urlInput = document.getElementById('subApiUrlInput').value.trim(); const keyInput = document.getElementById('subApiKeyInput').value.trim();
    if (!urlInput || !keyInput) return alert("请先填写副 API 的接口地址和密钥！");
    if(urlInput.endsWith('/')) urlInput = urlInput.slice(0, -1);
    const btn = event.target; const oldText = btn.innerText; btn.innerText = "正在拉取模型中... ⏳"; btn.disabled = true;
    try {
        const res = await smartFetch(`${urlInput}/models`, { method: 'GET', headers: { 'Authorization': `Bearer ${keyInput}` } });
        if (!res.ok) throw new Error(`HTTP 错误代码: ${res.status}`);
        const data = await res.json();
        if (data && data.data && Array.isArray(data.data)) { document.getElementById('subModelSelect').innerHTML = data.data.map(m => `<option value="${m.id}">${m.id}</option>`).join(''); alert(`副 API 成功拉取 ${data.data.length} 个模型！`); }
        else { throw new Error("接口返回的数据格式不符合标准。"); }
    } catch (e) { alert("拉取失败：" + (typeof enhanceNetworkErrorMessage === 'function' ? enhanceNetworkErrorMessage(e.message) : e.message)); } finally { btn.innerText = oldText; btn.disabled = false; }
}

// 修复：向量记忆的 Embedding 模型改成"拉取模型"下拉选择，而不是手动填写模型名字。
// 拉取用的接口地址/密钥优先读取"向量记忆专用API"输入框里当前填的内容（哪怕还没点保存）；
// 如果这两个框都是空的，就自动兜底改用主API——不会去动副API，两者互相独立。
async function fetchEmbeddingModels() {
    const vecUrlBox = (document.getElementById('vecApiUrlInput')?.value || '').trim();
    const vecKeyBox = (document.getElementById('vecApiKeyInput')?.value || '').trim();
    const useVecApi = !!(vecUrlBox && vecKeyBox);
    let urlInput = (useVecApi ? vecUrlBox : myApiUrl) || '';
    const keyInput = (useVecApi ? vecKeyBox : myApiKey) || '';
    if (!urlInput || !keyInput) return alert("请先填写向量记忆专用API（或主API）的接口地址和密钥！");
    if (urlInput.endsWith('/')) urlInput = urlInput.slice(0, -1);

    const btn = event.target; const oldText = btn.innerText; btn.innerText = "正在拉取模型中... ⏳"; btn.disabled = true;
    try {
        const res = await smartFetch(`${urlInput}/models`, { method: 'GET', headers: { 'Authorization': `Bearer ${keyInput}` } });
        if (!res.ok) throw new Error(`HTTP 错误代码: ${res.status}`);
        const data = await res.json();
        if (data && data.data && Array.isArray(data.data)) {
            const sel = document.getElementById('embeddingModelSelect');
            sel.innerHTML = data.data.map(m => `<option value="${m.id}">${m.id}</option>`).join('');
            // 拉取成功后，优先保留之前选的模型；如果列表里有名字包含"embed"的，优先选中它，方便一眼找到向量模型
            const keepPrevious = data.data.find(m => m.id === embeddingModel);
            const guessEmbedding = data.data.find(m => /embed/i.test(m.id));
            const toSelect = keepPrevious || guessEmbedding;
            if (toSelect) sel.value = toSelect.id;
            embeddingModel = sel.value;
            saveAllData();
            alert(`成功拉取 ${data.data.length} 个模型！（使用了${useVecApi ? '向量记忆专用' : '主'}API）`);
        } else {
            throw new Error("接口返回的数据格式不符合标准。");
        }
    } catch (e) { alert("拉取失败：" + e.message); } finally { btn.innerText = oldText; btn.disabled = false; }
}

function saveEmbeddingModelSelection() {
    const sel = document.getElementById('embeddingModelSelect');
    if (!sel) return;
    embeddingModel = sel.value;
    saveAllData();
}

// 向量记忆专用API的接口地址/密钥保存（跟主API、副API的输入框是分开的，互不影响）
function saveVectorApiSettings() {
    vecApiUrl = document.getElementById('vecApiUrlInput').value.trim(); if (vecApiUrl.endsWith('/')) vecApiUrl = vecApiUrl.slice(0, -1);
    vecApiKey = document.getElementById('vecApiKeyInput').value.trim();
    saveAllData();
}

function autoSaveApiSettings() {
    myApiUrl = document.getElementById('apiUrlInput').value.trim(); if(myApiUrl.endsWith('/')) myApiUrl = myApiUrl.slice(0, -1);
    myApiKey = document.getElementById('apiKeyInput').value.trim();
    if(document.getElementById('modelSelect').value) myModel = document.getElementById('modelSelect').value;
    
    subApiUrl = document.getElementById('subApiUrlInput').value.trim(); if(subApiUrl.endsWith('/')) subApiUrl = subApiUrl.slice(0, -1);
    subApiKey = document.getElementById('subApiKeyInput').value.trim();
    if(document.getElementById('subModelSelect').value) subModel = document.getElementById('subModelSelect').value;

    if (document.getElementById('vecApiUrlInput')) { vecApiUrl = document.getElementById('vecApiUrlInput').value.trim(); if (vecApiUrl.endsWith('/')) vecApiUrl = vecApiUrl.slice(0, -1); }
    if (document.getElementById('vecApiKeyInput')) vecApiKey = document.getElementById('vecApiKeyInput').value.trim();

    if (document.getElementById('samplerTemperature')) samplerTemperature = document.getElementById('samplerTemperature').value.trim();
    if (document.getElementById('samplerTopP')) samplerTopP = document.getElementById('samplerTopP').value.trim();
    if (document.getElementById('samplerFrequencyPenalty')) samplerFrequencyPenalty = document.getElementById('samplerFrequencyPenalty').value.trim();
    if (document.getElementById('samplerPresencePenalty')) samplerPresencePenalty = document.getElementById('samplerPresencePenalty').value.trim();
    if (document.getElementById('samplerTopK')) samplerTopK = document.getElementById('samplerTopK').value.trim();
    if (document.getElementById('samplerMaxTokens')) samplerMaxTokens = document.getElementById('samplerMaxTokens').value.trim();

    saveAllData();
}

// 新增：角色是否回复用户 —— 设置面板列表渲染与即时保存
function renderCharReplyToggleList() {
    const box = document.getElementById('charReplyToggleList'); if (!box) return;
    if (!myCharacters || myCharacters.length === 0) { box.innerHTML = '<div style="font-size:13px; color:#536471;">暂无角色，请先创建 AI 角色。</div>'; return; }
    box.innerHTML = myCharacters.map(c => `
        <label style="display:flex; align-items:center; gap:8px; font-size:14px; cursor:pointer;">
            <input type="checkbox" ${c.replyToUser === false ? '' : 'checked'} onchange="toggleCharReplyToUser('${c.id}', this.checked)">
            <span>${c.name}</span>
            <span style="color:#536471; font-size:12px;">${c.handle || ''}</span>
        </label>
    `).join('');
}

function toggleCharReplyToUser(charId, checked) {
    const char = myCharacters.find(c => c.id == charId); if (!char) return;
    char.replyToUser = checked; // true = 正常回复用户；false = 该角色不再回复/点赞用户
    saveAllData();
}

// 切换"聊天回复条数/长度模式"时，经典模式下"最少~最多条数"这两个输入框不生效，直接隐藏掉，
// 免得用户以为调了这两个数字就能影响经典模式的行为（经典模式条数是写死的随机1~4条，不受这两个设置控制）。
// ⚠️ 这个函数同时被两种场景调用，行为必须分开：
//   · 用户手动改下拉框（onchange）→ 要真正把模式应用下去
//   · 读档后同步界面（loadAllData）→ 只调整显示，不要反过来去写变量
// 之前它只管隐藏/显示那两个输入框，**没有把选中的模式写进 chatReplyStyleMode**。
// 于是用户在下拉框里选了"经典模式"，界面看着已经切了、条数输入框也收起来了，
// 但只要没去点"保存设置"，实际生成用的还是旧模式——界面和行为对不上，
// 用户会以为"模式自己在变"。现在改选就立刻生效并存档，不再依赖那颗保存按钮。
function toggleChatReplyStyleFieldsVisibility(applyToState = false) {
    const sel = document.getElementById('chatReplyStyleModeSelect');
    const fields = document.getElementById('chatReplyLimitedFields');
    if (!sel) return;
    if (fields) fields.style.display = sel.value === 'classic' ? 'none' : '';
    if (applyToState) {
        chatReplyStyleMode = sel.value === 'classic' ? 'classic' : 'limited';
        saveAllData();
        if (typeof showToast === 'function') {
            showToast('<div class="avatar" style="width:40px;height:40px;">💬</div>', '回复模式已切换',
                chatReplyStyleMode === 'classic' ? '经典模式：随机1~4条，不限字数' : '可控字数模式：按总字数封顶', null, null);
        }
    }
}

function saveSettings() {
    myApiUrl = document.getElementById('apiUrlInput').value.trim(); if(myApiUrl.endsWith('/')) myApiUrl = myApiUrl.slice(0, -1);
    myApiKey = document.getElementById('apiKeyInput').value.trim(); myModel = document.getElementById('modelSelect').value;
    subApiUrl = document.getElementById('subApiUrlInput').value.trim(); if(subApiUrl.endsWith('/')) subApiUrl = subApiUrl.slice(0, -1);
    subApiKey = document.getElementById('subApiKeyInput').value.trim(); subModel = document.getElementById('subModelSelect').value;
    if (document.getElementById('vecApiUrlInput')) { vecApiUrl = document.getElementById('vecApiUrlInput').value.trim(); if (vecApiUrl.endsWith('/')) vecApiUrl = vecApiUrl.slice(0, -1); }
    if (document.getElementById('vecApiKeyInput')) vecApiKey = document.getElementById('vecApiKeyInput').value.trim();
    chatWordLimit = gyNum(document.getElementById('limitChat').value, 50); postWordLimit = gyNum(document.getElementById('limitPost').value, 50);
    diaryWordLimit = gyNum(document.getElementById('limitDiary').value, 400); letterWordLimit = gyNum(document.getElementById('limitLetter').value, 400);
    commentWordLimit = gyNum(document.getElementById('limitComment').value, 30);
    letterReplyDelayMin = gyNum(document.getElementById('letterReplyDelayMinInput')?.value, 60);
    letterReplyDelayMax = gyNum(document.getElementById('letterReplyDelayMaxInput')?.value, 360);
    chatMsgCountMin = gyNum(document.getElementById('limitChatMsgCountMin')?.value, 1);
    chatMsgCountMax = gyNum(document.getElementById('limitChatMsgCountMax')?.value, 5);
    allowActionTags = document.getElementById('allowActionTags').checked;
    enableCharMoveToChat = document.getElementById('enableCharMoveToChat') ? document.getElementById('enableCharMoveToChat').checked : enableCharMoveToChat;
    showNovelReasoning = document.getElementById('showNovelReasoning') ? document.getElementById('showNovelReasoning').checked : showNovelReasoning;
    showNovelFloorNumber = document.getElementById('showNovelFloorNumber') ? document.getElementById('showNovelFloorNumber').checked : showNovelFloorNumber;
    showNovelThinkingTime = document.getElementById('showNovelThinkingTime') ? document.getElementById('showNovelThinkingTime').checked : showNovelThinkingTime;
    humanFeelEnabled = document.getElementById('humanFeelEnabled').checked;
    tpesEnabled = document.getElementById('tpesEnabled').checked;
    autoRenderStatusChips = document.getElementById('autoRenderStatusChips') ? document.getElementById('autoRenderStatusChips').checked : true;
    showStatusInPosts = document.getElementById('showStatusInPosts')?.checked ?? true;
    showStatusInComments = document.getElementById('showStatusInComments')?.checked ?? true;
    showStatusInDiary = document.getElementById('showStatusInDiary')?.checked ?? true;
    showStatusInChat = document.getElementById('showStatusInChat')?.checked ?? false;
    enableScheduleAutoCheck = document.getElementById('enableScheduleAutoCheck').checked;
    enableTypingIndicator = document.getElementById('enableTypingIndicator').checked;
    chatBatchDelaySec = gyNum(document.getElementById('chatBatchDelaySec')?.value, 0);
    try { if (typeof window.gySetChatBatchDelay === 'function') window.gySetChatBatchDelay(chatBatchDelaySec); } catch (e) {}
    chatTimeSepEnabled = document.getElementById('chatTimeSepEnabled')?.checked ?? true;
    chatTimeSepMin = gyNum(document.getElementById('chatTimeSepMin')?.value, 5);
    momentsHomeOn = document.getElementById('momentsHomeToggle')?.checked ?? false;
    try { if (typeof window.gyMoSync === 'function') window.gyMoSync(); } catch (e) {}
    enableMiniGameCharSpeech = document.getElementById('enableMiniGameCharSpeech')?.checked ?? true;
    quietHoursEnabled = document.getElementById('quietHoursEnabled')?.checked ?? false;
    quietHoursStart = document.getElementById('quietHoursStart')?.value || '23:00';
    quietHoursEnd = document.getElementById('quietHoursEnd')?.value || '08:00';
    enableAnniversary = document.getElementById('enableAnniversary').checked;
    enableVectorMemory = document.getElementById('enableVectorMemory')?.checked || false;
    enableChatScriptExecution = document.getElementById('enableChatScriptExecution')?.checked || false;
    embeddingModel = document.getElementById('embeddingModelSelect')?.value.trim() || 'text-embedding-3-small';
    worldbookCharBudget = gyNum(document.getElementById('worldbookCharBudgetInput')?.value, 2000);
    semanticCharBudget = gyNum(document.getElementById('semanticCharBudgetInput')?.value, 1200);
    chatHistoryTurns = gyNum(document.getElementById('chatHistoryTurnsInput')?.value, 20);
    // ⚠️ 必须先判断下拉框在不在。原来写的是 `getElementById(...)?.value === 'classic' ? 'classic' : 'limited'`，
    // 元素一旦取不到（?.value 得到 undefined）就会静默地把模式重置成 'limited'——本来只想保存别的设置，
    // 结果顺手把用户选的经典模式改掉了。取不到就保持现有值不动才对。
    const chatModeSel = document.getElementById('chatReplyStyleModeSelect');
    if (chatModeSel) chatReplyStyleMode = chatModeSel.value === 'classic' ? 'classic' : 'limited';
    npcReplyProb = parseFloat(document.getElementById('npcProbInput').value);
    if (isNaN(npcReplyProb)) npcReplyProb = 0.4; 
    npcReplyMaxCount = parseInt(document.getElementById('npcMaxCountInput').value); 
    if (isNaN(npcReplyMaxCount)) npcReplyMaxCount = 3;
    // 💰 每条帖子最多几个角色来互动（0＝不限）。这个数字直接决定发一条推文要发几次 API 请求。
    charInteractMaxCount = parseInt(document.getElementById('charInteractMaxInput').value);
    if (isNaN(charInteractMaxCount)) charInteractMaxCount = 5;
    
    globalCustomCSS = document.getElementById('globalCSSInput').value;
    applyGlobalCSS();
    
    if (document.getElementById('samplerTemperature')) samplerTemperature = document.getElementById('samplerTemperature').value.trim();
    if (document.getElementById('samplerTopP')) samplerTopP = document.getElementById('samplerTopP').value.trim();
    if (document.getElementById('samplerFrequencyPenalty')) samplerFrequencyPenalty = document.getElementById('samplerFrequencyPenalty').value.trim();
    if (document.getElementById('samplerPresencePenalty')) samplerPresencePenalty = document.getElementById('samplerPresencePenalty').value.trim();
    if (document.getElementById('samplerTopK')) samplerTopK = document.getElementById('samplerTopK').value.trim();
    if (document.getElementById('samplerMaxTokens')) samplerMaxTokens = document.getElementById('samplerMaxTokens').value.trim();

    if(!myApiUrl || !myApiKey) return alert("请至少完整填写主 API 的接口地址和密钥！");
    saveAllData(); alert("设置保存成功！");
}

// v108：资料页改成分类收纳（索引 + 分页）。传空字符串＝回到索引页。
// 分页只是 display 切换，节点一直在 DOM 里，所以 saveUserProfile() 那种
// 一次性读一堆 getElementById 的老代码完全不用改。
const GY_USER_PANELS = {
    basic:  '🪪 基本资料',
    persona:'🎭 人设切换',
    wallet: '💳 我的钱包与银行卡',
    anniv:  '📅 我的纪念日',
    chat:   '💬 聊天互动',
    anon:   '🕶️ 匿名论坛身份',
    status: '🎨 状态气泡样式'
};
window.openUserPanel = function (key) {
    const idx = document.getElementById('upIndex');
    const back = document.getElementById('upBackBtn');
    const title = document.getElementById('upTitleText');
    document.querySelectorAll('.up-panel').forEach(p => { p.style.display = 'none'; });
    if (!key || !GY_USER_PANELS[key]) {
        if (idx) idx.style.display = 'block';
        if (back) back.style.display = 'none';
        if (title) title.innerText = '自定义我的资料';
    } else {
        if (idx) idx.style.display = 'none';
        const p = document.getElementById('upPanel-' + key);
        if (p) p.style.display = 'block';
        if (back) back.style.display = 'inline-flex';
        if (title) title.innerText = GY_USER_PANELS[key];
        if (key === 'wallet' && typeof window.gyWalletPanel === 'function') window.gyWalletPanel();
    }
    // 换一页从头看起，别继承上一页滚到一半的位置
    try { const box = document.querySelector('#userProfileModal .modal-box'); if (box) box.scrollTop = 0; } catch (e) {}
};

function openUserProfileModal() {
    try {
        openUserPanel('');   // 每次打开都从索引页开始
        ['myName','myHandle','myPersona','myBio','myFollowers','myFollowing','myLocation','myWebsite','myBirthdate','myAnonName','myAnonId','myNudgeText','myGender','myPersona'].forEach(id => {
            const elem = document.getElementById(id);
            if(elem) {
                const prop = id.replace('my', '').charAt(0).toLowerCase() + id.replace('my', '').slice(1);
                elem.value = currentUser[prop] || '';
            }
        });
        const verifiedElem = document.getElementById('myVerified');
        if(verifiedElem) verifiedElem.checked = currentUser.verified || false;

        const avatarPreview = document.getElementById('myAvatarPreview');
        if(currentUser.avatarImg && avatarPreview) {
            avatarPreview.src = currentUser.avatarImg;
            avatarPreview.style.display = 'block';
        } else if(avatarPreview) { avatarPreview.style.display = 'none'; }

        const bgPreview = document.getElementById('myBgPreview');
        if(currentUser.bgImg && bgPreview) {
            bgPreview.src = currentUser.bgImg;
            bgPreview.style.display = 'block';
        } else if(bgPreview) { bgPreview.style.display = 'none'; }

        tempCropResults.myAvatar = currentUser.avatarImg || null;
        tempCropResults.myBg = currentUser.bgImg || null;

        if(typeof renderStatusTypesList === 'function') renderStatusTypesList();
        if(typeof renderUserAnniversaryList === 'function') renderUserAnniversaryList();
        if(typeof renderPersonaSwitchSelect === 'function') renderPersonaSwitchSelect();
        initColorPalette();

        const opacityInput = document.getElementById('newStatusTypeOpacity');
        if(opacityInput) {
            opacityInput.oninput = function() {
                const displayEl = document.getElementById('statusOpacityDisplay');
                if(displayEl) displayEl.innerText = this.value + '%';
            };
        }

        openModal('userProfileModal');
    } catch(err) {
        console.error('打开用户资料模态框出错:', err);
        alert('打开用户资料界面失败，请刷新页面重试。');
    }
}


async function saveUserProfile() {
    try {
        ['name','bio','followers','following','location','website','birthdate','anonName','anonId','nudgeText','gender','persona'].forEach(prop => {
            const elId = 'my' + prop.charAt(0).toUpperCase() + prop.slice(1);
            if(document.getElementById(elId)) currentUser[prop] = document.getElementById(elId).value.trim() || currentUser[prop];
        });
        let h = document.getElementById('myHandle').value.trim() || currentUser.handle; currentUser.handle = h.startsWith('@') ? h : '@' + h;
        currentUser.verified = document.getElementById('myVerified').checked;

        if (tempCropResults.myAvatar) currentUser.avatarImg = tempCropResults.myAvatar;
        if (tempCropResults.myBg) currentUser.bgImg = tempCropResults.myBg;

        globalPosts.forEach(p => { if (p.char.id === 'me') p.char = { ...currentUser }; p.replies.forEach(r => { if (r.char.id === 'me') r.char = { ...currentUser }; }); });
        updateUserMiniProfile(); closeModal('userProfileModal'); saveAllData(); alert("个人资料更新成功！");
        if (currentProfileId === 'me' && document.getElementById('view-profile').style.display !== 'none') renderProfilePage('me');
        if (document.getElementById('view-home').style.display !== 'none' && typeof renderPosts === 'function') renderPosts();
    } catch (err) {
        console.error('保存个人资料失败', err);
        alert("⚠️ 保存失败：" + (err && err.message ? err.message : '未知错误，请重试或更换一张图片'));
    }
}

// ===================== 多用户人设（Persona）管理 =====================
// 设计：每个人设是一份 currentUser 的完整快照（名字/账号/头像/性别/人设简介等），随时可以另存/切换/删除。
// 切换时直接把快照字段整体覆盖进 currentUser 这同一个对象（不新建对象、不改变引用），
// 这样App里其它到处写死的 currentUser.xxx 用法完全不用改，天然兼容。
// 👤 角色表单里的"在这个角色面前我是谁"下拉：选项＝所有已保存的人设 + 一个"跟随当前资料"
function refreshCharUserPersonaSelect(selectedId) {
    const sel = document.getElementById('charUserPersonaSelect');
    if (!sel) return;
    const list = (typeof userPersonas !== 'undefined' && Array.isArray(userPersonas)) ? userPersonas : [];
    sel.innerHTML = '<option value="">跟随当前资料（不单独绑定）</option>'
        + list.map(p => `<option value="${p.id}">${escapeHtml(p.label || '未命名人设')}</option>`).join('');
    sel.value = (selectedId && list.some(p => p.id === selectedId)) ? selectedId : '';
}

function renderPersonaSwitchSelect() {
    const sel = document.getElementById('personaSwitchSelect');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">-- 未保存为人设（当前是临时资料）--</option>' + userPersonas.map(p => `<option value="${p.id}">${escapeHtml(p.label || '未命名人设')}</option>`).join('');
    if (userPersonas.some(p => p.id === cur)) sel.value = cur;
}

async function saveCurrentAsPersona() {
    const label = ((await appPrompt('给这份人设起个名字（方便以后辨认，比如"本体""马甲小号"）：', currentUser.name || '新人设')) || '').trim();
    if (!label) return;
    const snapshot = JSON.parse(JSON.stringify(currentUser));
    userPersonas.push({ id: 'persona_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), label, data: snapshot });
    saveAllData();
    renderPersonaSwitchSelect();
    const sel = document.getElementById('personaSwitchSelect');
    if (sel) sel.value = userPersonas[userPersonas.length - 1].id;
    appToast('✅ 已保存人设「' + label + '」');
}

function switchToPersona(id) {
    if (!id) return; // 选了"未保存为人设"这个占位项，什么都不做
    const persona = userPersonas.find(p => p.id === id);
    if (!persona) return;
    // 整体覆盖 currentUser 的字段（不是替换整个对象，其它地方持有的 currentUser 引用不会失效）
    Object.keys(persona.data).forEach(k => { currentUser[k] = persona.data[k]; });
    openUserProfileModal(); // 重新用最新的 currentUser 内容刷新表单里的所有输入框
    updateUserMiniProfile();
    saveAllData();
    appToast('✅ 已切换到人设「' + (persona.label || '') + '」');
}

async function renameCurrentPersona() {
    const sel = document.getElementById('personaSwitchSelect');
    const persona = sel && userPersonas.find(p => p.id === sel.value);
    if (!persona) return appAlert('请先在上面选择一个已保存的人设');
    const newLabel = ((await appPrompt('重命名这个人设：', persona.label || '')) || '').trim();
    if (!newLabel) return;
    persona.label = newLabel;
    saveAllData();
    renderPersonaSwitchSelect();
}

async function deleteCurrentPersona() {
    const sel = document.getElementById('personaSwitchSelect');
    const persona = sel && userPersonas.find(p => p.id === sel.value);
    if (!persona) return appAlert('请先在上面选择一个已保存的人设');
    if (!(await appConfirm(`确定删除人设「${persona.label}」？（只删除这份保存的快照，不影响当前正在使用的资料）`))) return;
    userPersonas = userPersonas.filter(p => p.id !== persona.id);
    saveAllData();
    renderPersonaSwitchSelect();
}

function updateUserMiniProfile() {
    document.getElementById('mySidebarName').innerText = currentUser.name; document.getElementById('mySidebarHandle').innerText = currentUser.handle;
    const drawerNameEl = document.getElementById('drawerName'), drawerHandleEl = document.getElementById('drawerHandle');
    if (drawerNameEl) drawerNameEl.innerText = currentUser.name;
    if (drawerHandleEl) drawerHandleEl.innerText = currentUser.handle;
    const avatarTargets = [document.getElementById('mySidebarAvatar'), document.getElementById('drawerAvatar')].filter(Boolean);
    avatarTargets.forEach(div => {
        if (currentUser.avatarImg) { div.style.backgroundImage = `url('${currentUser.avatarImg}')`; div.style.backgroundSize = 'cover'; div.style.backgroundPosition = 'center'; div.innerHTML = ""; }
        else { div.style.backgroundImage = 'none'; div.style.backgroundColor = 'white'; div.innerHTML = currentUser.avatarEmoji || currentUser.name?.[0] || '我'; }
    });
    updateUserPostAvatar();
}

// 🔕 一次冒出来一堆气泡的时候，合成一条。
// 背景：进主页/刚打开 app 那会儿，好几个后台任务同时落地（角色主动私聊、信件、日记反应、
// 帖子连锁…），每个都弹一个——一屏全是气泡，什么都看不清，还挡住内容。
// 现在超过 toastMaxVisible 条就不再往外冒，改成攒在一条"还有 N 条新通知"上，
// 点它进通知页（东西一条没少，通知页里全都在）。
let __gyToastBurst = 0;
function __gyToastSummary(n) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    let box = document.getElementById('gyToastMore');
    if (!box) {
        box = document.createElement('div');
        box.id = 'gyToastMore';
        box.className = 'toast-item';
        box.style.cursor = 'pointer';
        box.onclick = () => { if (typeof switchMainView === 'function') switchMainView('notifications'); box.remove(); __gyToastBurst = 0; };
        container.appendChild(box);
        setTimeout(() => { if (box.parentElement) box.remove(); __gyToastBurst = 0; }, 12000);
    }
    box.innerHTML = `<div class="avatar" style="background:#1d9bf0;color:#fff;font-size:18px;">🔔</div>
        <div class="toast-content"><div class="toast-title">还有 ${n} 条新通知</div>
        <div class="toast-desc">点这里去通知页看，一条都没少</div></div>`;
}

// 第 7 个参数 notif（可选）：这条弹窗对应的那条通知（对象，或者它的 id）。
// 带了它，点弹窗就跟点通知页里那条走同一套跳转（js/60 gyOpenNotif）——信件、商城、地图、群聊……都能跳；
// 不带的老调用照旧按 postId / chatCharId 跳。
function showToast(avatarHtml, titleText, contentText, postId, chatCharId, isAnon = false, notif = null) {
    sendBrowserNotification(titleText, contentText);
    const container = document.getElementById('toastContainer');
    if(!container) return;

    // 设置 → 🎨 外观 里可选：0=全部弹，>0=最多同时弹几条，-1=一条都不弹（只进通知页）
    const cap = (typeof toastMaxVisible === 'number') ? toastMaxVisible : 2;
    if (cap < 0) return;
    if (cap > 0) {
        const showing = container.querySelectorAll('.toast-item:not(#gyToastMore)').length;
        if (showing >= cap) { __gyToastBurst++; __gyToastSummary(__gyToastBurst); return; }
    }

    const toast = document.createElement('div');
    toast.className = `toast-item ${isAnon ? 'anon-toast' : ''}`;
    toast.innerHTML = `${avatarHtml}<div class="toast-content"><div class="toast-title">${titleText}</div>${contentText ? `<div class="toast-desc">${contentText}</div>` : ''}</div>`;

    let touchStartY = 0;
    let touchEndY = 0;

    // 触摸开始
    toast.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
        container.style.overflowY = 'auto'; // 允许滚动
    }, false);

    // 触摸结束
    toast.addEventListener('touchend', (e) => {
        touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY - touchEndY;

        if(diff > 50) { // 向上滑动 > 50px，移除通知
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => { if(toast.parentElement) toast.remove(); }, 300);
        } else if(diff < -50) { // 向下滑动 > 50px，展开所有通知
            container.style.maxHeight = 'none';
            container.style.overflowY = 'auto';
        }
    }, false);

    // 点击操作
    if (notif && typeof notif === 'object' && notif.id) toast.dataset.nid = String(notif.id);
    else if (notif && typeof notif !== 'object') toast.dataset.nid = String(notif);
    toast.style.cursor = 'pointer';
    toast.onclick = () => {
        toast.remove();
        try {
            let n = (notif && typeof notif === 'object') ? notif : null;
            if (!n && notif != null && typeof window.gyNotifFind === 'function') n = window.gyNotifFind(notif);
            if (!n && (postId || chatCharId)) n = { postId, chatCharId, isAnon: !!isAnon };
            if (n && typeof window.gyOpenNotif === 'function') { window.gyOpenNotif(n); return; }
            if (chatCharId) { switchMainView('chat'); switchChatSession(String(chatCharId)); }
            else if (postId && isAnon) { switchMainView('anonForum'); }
            else if (postId) { switchMainView('postDetail', postId); }
        } catch (e) { console.warn('[弹窗跳转] 失败：', e); }
    };

    container.appendChild(toast);
    // ⏱️ 以前 5.5 秒就撤，角色说的那句话经常还没读完就没了（"弹窗速度过快"）。
    //    现在 10 秒，而且鼠标停在上面时不会消失（CSS 里把淡出动画暂停了，这里把定时器也停掉）。
    let killer = setTimeout(() => { if (toast.parentElement) toast.remove(); }, 10000);
    toast.addEventListener('mouseenter', () => { clearTimeout(killer); });
    toast.addEventListener('mouseleave', () => {
        clearTimeout(killer);
        killer = setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4000);
    });
}

let pendingChatAttachment = null; let currentlyTypingChars = new Set();

function updateTypingIndicator() {
    let ind = document.getElementById('chatTypingIndicator');
    if (!enableTypingIndicator) { ind.style.display = 'none'; return; }
    if (currentlyTypingChars.size > 0) { document.getElementById('typingCharName').innerText = Array.from(currentlyTypingChars).join(', '); ind.style.display = 'block'; } 
    else { ind.style.display = 'none'; }
}

function showAvatarContextMenu(e, charId) {
    e.preventDefault(); e.stopPropagation();
    const menu = document.getElementById('chatContextMenu');
    const char = myCharacters.find(c => c.id == charId);
    const branches = getCharBranches(charId);
    let extraBtns = '';
    
    // 兼容以前生成的旧分支角色
    if (branches.length > 0) {
        extraBtns += `<button class="context-btn" style="color:#17bf63;" onclick="document.getElementById('chatContextMenu').style.display='none'; showBranchListModal('${charId}')">🌳 查看分支 (${branches.length})</button>`;
    }
    if (char && char.branchedFrom && myCharacters.some(c => c.id == char.branchedFrom)) {
        extraBtns += `<button class="context-btn" style="color:#17bf63;" onclick="document.getElementById('chatContextMenu').style.display='none'; switchChatSession('${char.branchedFrom}')">↩️ 回到原对话（${char.branchedFromName || ''}）</button>`;
    }
    
    // 💡 新增：集中展示旧聊天的入口
    if (char && char.archivedChats && char.archivedChats.length > 0) {
        extraBtns += `<button class="context-btn" style="color:#1d9bf0;" onclick="document.getElementById('chatContextMenu').style.display='none'; openArchivedChatsListModal('${charId}')">📜 查看历史聊天 (${char.archivedChats.length})</button>`;
    }

    const isPinned = pinnedSessionIds.some(pid => pid == charId);
    const pinBtn = `<button class="context-btn" onclick="document.getElementById('chatContextMenu').style.display='none'; toggleChatPin('${charId}')">📌 ${isPinned ? '取消置顶' : '置顶'}</button>`;
    menu.innerHTML = `<button class="context-btn" onclick="generateCharSchedule('${charId}')">🗓️ 生成/更新今日日程</button><button class="context-btn" onclick="document.getElementById('chatContextMenu').style.display='none'; openChatOptions('${charId}', event)">💬 聊天选项</button>${pinBtn}<button class="context-btn" onclick="document.getElementById('chatContextMenu').style.display='none'; restartChatWithGreeting('${charId}')">🔄 重新开始聊天</button>${extraBtns}`;
    
    menu.style.display = 'flex';
    let x = e.pageX, y = e.pageY; 
    if (x + 180 > window.innerWidth) x -= 180; 
    // 动态判断菜单高度，防止超出屏幕底部被遮挡
    if (y + menu.offsetHeight > window.innerHeight) y = window.innerHeight - menu.offsetHeight - 10; 
    if (y < 0) y = 10;
    menu.style.left = x + 'px'; 
    menu.style.top = y + 'px';
}

// 群聊头像的右键/长按小菜单：聊天选项 + 置顶/取消置顶（跟角色头像的小菜单保持一致体验）
function showGroupAvatarContextMenu(e, groupId) {
    e.preventDefault(); e.stopPropagation();
    const menu = document.getElementById('chatContextMenu');
    const isPinned = pinnedSessionIds.some(pid => pid == groupId);
    menu.innerHTML = `<button class="context-btn" onclick="document.getElementById('chatContextMenu').style.display='none'; openChatOptions('${groupId}', event)">💬 聊天选项</button><button class="context-btn" onclick="document.getElementById('chatContextMenu').style.display='none'; toggleChatPin('${groupId}')">📌 ${isPinned ? '取消置顶' : '置顶'}</button>`;
    menu.style.display = 'flex';
    let x = e.pageX, y = e.pageY;
    if (x + 180 > window.innerWidth) x -= 180;
    if (y + menu.offsetHeight > window.innerHeight) y = window.innerHeight - menu.offsetHeight - 10;
    if (y < 0) y = 10;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

// 找出以 charId 为原型分出去的所有分支角色，按创建时间新到旧排列
function getCharBranches(charId) {
    return myCharacters.filter(c => c.branchedFrom == charId).sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));
}

function showBranchListModal(charId) {
    const char = myCharacters.find(c => c.id == charId);
    if (!char) return;
    const branches = getCharBranches(charId);
    document.getElementById('branchListTitle').innerText = `🌳 ${char.name} 的所有分支 (${branches.length})`;
    document.getElementById('branchListContent').innerHTML = branches.map(b => {
        const msgCount = (globalChats[b.id] || []).length;
        const createdStr = isNaN(parseInt(b.id)) ? '' : new Date(parseInt(b.id)).toLocaleString('zh-CN');
        return `<div class="wb-card" style="min-width:0; max-width:none; width:100%; cursor:pointer; margin-bottom:8px; display:flex; align-items:center; gap:10px;" onclick="closeModal('branchListModal'); switchChatSession('${b.id}')">
            ${getAvatarHTML(b, 44)}
            <div style="flex:1; min-width:0;">
                <div style="font-weight:bold; font-size:14px;">${b.name}</div>
                <div style="font-size:12px; color:#8b98a5;">创建于 ${createdStr} · ${msgCount} 条消息</div>
            </div>
        </div>`;
    }).join('') || '<div class="empty-state">还没有任何分支</div>';
    openModal('branchListModal');
}

let pendingScheduleCharId = null;
let pendingScheduleResult = null;

function generateCharSchedule(charId) {
    document.getElementById('chatContextMenu').style.display = 'none';
    const char = myCharacters.find(c => c.id == charId); if (!char) return;
    const api = getApiConfig(true); if (!api.key) return alert('请先在设置中配置 API 密钥！');
    pendingScheduleCharId = charId;
    runScheduleGeneration(charId);
}

function regenerateSchedule() {
    const modal = document.getElementById('schedulePreviewModal');
    const charId = (modal && modal.dataset.charId) ? modal.dataset.charId : pendingScheduleCharId;
    if (!charId) {
        if (typeof appAlert === 'function') appAlert('不知道要给谁重新生成，请从角色那里重新点一次。');
        return;
    }
    runScheduleGeneration(charId);
}

// silent=true：后台自动续期用，不弹任何窗、生成完直接存下来（见 checkAndRenewStaleSchedules）。
async function runScheduleGeneration(charId, silent) {
    // ⚠️ 只有"用户手动生成"这条路才动这两个共享变量。
    // 之前静默续期（日程每天自动更新的定时器）也会写它们，于是出现过这个 bug：
    // 你手动给 A 生成完、预览开着还没点保存，后台定时器刚好给 B 续了一份，
    // 把 pendingScheduleCharId 改成了 B、又把 pendingScheduleResult 清成了 null，
    // 你再点「满意，保存」时 confirmSaveSchedule 里那句 if (!char || !r) return 直接静默返回——
    // 按钮看起来完全没反应，没有任何报错，A 的日程也没存上。
    if (!silent) pendingScheduleCharId = charId;
    const char = myCharacters.find(c => c.id == charId); if (!char) return;
    const api = getApiConfig(true);
    if (!api.key) { if (silent) return; closeModal('schedulePreviewModal'); return alert('请先在设置中配置 API 密钥！'); }

    if (!silent) {
        closeModal('schedulePreviewModal');
        document.getElementById('scheduleLoadingText').innerText = `正在为 ${char.name} 生成/更新日程...`;
        openModal('scheduleLoadingModal');
    }
    // 日程要求AI一次性写完整一天的行程（比普通聊天回复长得多），生成本来就会比聊天慢一些，
    // 这里加个计时提示，至少能看出"还在生成中"而不是卡住了
    const scheduleLoadStart = Date.now();
    const scheduleLoadTimer = setInterval(() => {
        const el = document.getElementById('scheduleLoadingText');
        if (el) el.innerText = `正在为 ${char.name} 生成/更新日程...（已等待 ${Math.floor((Date.now() - scheduleLoadStart) / 1000)} 秒，日程内容较长，会比普通聊天回复慢一些）`;
    }, 1000);

    const recentChat = getRecentChatContext(charId);
    const recentPosts = globalPosts.filter(p => p.char.id == charId).slice(0, 5).map(p => p.text).join('\n---\n');
    const nowStr = new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long' });
    const typeAsk = statusTypes.length > 0 ? `，并从这些状态类型里选一个最贴近的填入 "statusTypeLabel" 字段：[${statusTypes.map(t => t.label).join('、')}]，都不贴切就留空字符串` : '';

    const prompt = buildStructuredMessages(buildBasePrompt(char, true, recentChat + '\n' + recentPosts), [],
        `现在的真实时间：${nowStr}。

请结合你的人设、世界书设定，以及下面提供的参考信息，为自己规划一份"今天的日程"——从早到晚分成若干时间段，写出你这一天大概会做什么、在哪、状态如何，要符合你的身份、生活习惯和当前的关系/剧情状态，具体到有画面感，不要写"上午：工作，下午：休息"这种空洞流水账。

【你最近发的动态（如果有）】：
${recentPosts || '（暂无）'}

【你和用户最近的聊天记录（如果有）】：
${recentChat || '（暂无）'}

请严格按以下 JSON 格式输出，不要包含任何 Markdown 语法或多余说明：
{"schedule": "从早到晚的完整日程，按时间段分行，用\\n分隔", "currentStatus": "结合日程和现在的真实时间，你此刻正在做的事，20字以内，不含引号"${typeAsk ? ', "statusTypeLabel": "从给定列表里选的状态类型"' : ''}}`);

    try {
        const data = await callChatCompletionAPI(api, prompt);
        if (data.error) throw new Error(data.error.message);
        let rawText = data.choices?.[0]?.message?.content?.trim() || "";
        // ⚠️ 不能裸调 JSON.parse：推理模型会先吐一段 <think>…</think>，
        // 直接解析就是「Unexpected token '<', "<think>好的，"... is not valid JSON」。
        // parseModelJson 会先剥掉思考过程和 ``` 围栏，再从最后一个 JSON 块往前试。
        const parsed = (typeof parseModelJson === 'function') ? parseModelJson(rawText) : JSON.parse(rawText);
        if (!parsed || !parsed.schedule) throw new Error('生成内容为空或格式不对（模型没按要求只输出 JSON）');

        clearInterval(scheduleLoadTimer);
        const result = { text: parsed.schedule, currentStatus: parsed.currentStatus || '', statusTypeLabel: parsed.statusTypeLabel || '' };
        if (silent) {
            // 自动续期：直接落地，不打断用户
            // 覆盖之前先把旧的那一天归档，不然"昨天做了什么"就永远丢了（见 js/06 日程记忆那一段）
            if (typeof archiveCharSchedule === 'function') archiveCharSchedule(char);
            char.schedule = { text: parsed.schedule, generatedAt: Date.now() };
            if (parsed.currentStatus && typeof saveCharLifeState === 'function') saveCharLifeState(char, parsed.currentStatus, parsed.statusTypeLabel || '');
            if (typeof saveAllData === 'function') saveAllData();
            console.info('[日程自动更新] 已为', char.name, '生成新的一天日程');
            // 攒够几天就顺手总结一次生活轨迹（函数内部自己判断够不够、开关开没开）
            if (typeof updateScheduleMemoryAsync === 'function') updateScheduleMemoryAsync(char);
            // ✅ 新的一天了，顺便看看 TA 的待办是不是快见底——见底了就让 TA 结合新日程再记几件。
            //    函数内部自己判断开关（autoTodoGen）、剩几条、今天补过没有，所以这里无脑调用即可。
            if (typeof autoTopUpCharTodos === 'function') autoTopUpCharTodos(char);
            return;
        }
        pendingScheduleResult = result;
        closeModal('scheduleLoadingModal');
        showSchedulePreview(charId);
    } catch (e) {
        clearInterval(scheduleLoadTimer);
        // 模型返回的不是 JSON 而是一整张 HTML（Unexpected token '<'），99% 是
        // API 地址填错了/走了错的代理/被网关拦下来返回了错误页——不是模型不听话。
        const msg = /Unexpected token '<'|<!DOCTYPE/i.test(String(e.message || ''))
            ? 'API 返回的是一个网页而不是数据。多半是接口地址填错了（少了 /v1、或者填的是网页版地址），'
              + '或者被网关/代理拦下来返回了错误页。去 设置 → 🔑 API 里核对一下地址。'
            : String(e.message || e);
        if (silent) { console.warn('[日程自动更新] 生成失败（下一轮再试）：', msg); return; }
        closeModal('scheduleLoadingModal');
        alert('生成日程失败：' + msg);
    }
}

// 🗓️ 日程自动续期：到了第二天，把过期的日程自动重新生成一份。
// 关掉这个开关就退回原来的行为——只在角色状态气泡里提示"日程可能过期了，右键头像可更新"，等你自己点。
// 挂在 checkAndFlowSchedules 这同一个 15 分钟的定时器上，不额外多开一个循环。
// 一轮最多续 3 个角色：角色多的时候一次性全生成会瞬间打出十几个长请求，又慢又贵，分几轮慢慢来完全够用。
// 排序按"上次生成时间"从早到晚，保证每个角色都轮得上（以前固定取前两个，后面的人永远排不到）。
async function checkAndRenewStaleSchedules() {
    if (typeof isAutoOn === 'function' && !isAutoOn('scheduleAutoRenew')) return;
    const api = getApiConfig(true); if (!api.key) return;
    if (typeof isScheduleStale !== 'function') return;
    // 🐛 以前这里是 `c.schedule && c.schedule.text && isScheduleStale(c)`，两个毛病：
    //   ① **从来没生成过日程的角色永远轮不上**——条件要求"已经有日程"才续期，
    //      于是打开开关之后只有那个手动生成过的角色在更新，其他人一辈子没有日程。
    //      这就是"多个角色只有一个会写"。
    //   ② 每轮取前 2 个，而且顺序是 myCharacters 的原始顺序，永远是同样那两个先被取到；
    //      前面的人一旦次次都排在前面，后面的人也轮不上。
    // 现在：没日程的也算"该写"，并且按"上次生成时间"从早到晚排，谁最久没更新谁先来。
    const cand = (myCharacters || []).filter(c => c && (!c.schedule || !c.schedule.text || isScheduleStale(c)));
    cand.sort((a, b) => ((a.schedule && a.schedule.generatedAt) || 0) - ((b.schedule && b.schedule.generatedAt) || 0));
    const due = cand.slice(0, 3);
    for (const char of due) {
        try { await runScheduleGeneration(char.id, true); }
        catch (e) { console.warn('[日程自动更新] 出错，跳过这个角色：', char && char.name, e); }
    }
}

function showSchedulePreview(charId) {
    const r = pendingScheduleResult; if (!r) return;
    const modal = document.getElementById('schedulePreviewModal');
    // 把"这份预览是谁的、内容是什么"直接钉在弹窗元素上。
    // 全局变量随时可能被后台定时器改掉，弹窗自己身上的这份不会——
    // 保存时以它为准，用户看到的是哪份就存哪份。
    if (modal) {
        modal.dataset.charId = String(charId != null ? charId : pendingScheduleCharId);
        modal.dataset.payload = JSON.stringify(r);
    }
    const typeColor = getStatusTypeColor(r.statusTypeLabel);
    const typeBadge = r.statusTypeLabel ? `<span style="background:${typeColor || '#1d9bf0'}; color:#fff; font-size:11px; padding:1px 8px; border-radius:8px; margin-right:6px;">${r.statusTypeLabel}</span>` : '';
    document.getElementById('schedulePreviewStatus').innerHTML = r.currentStatus ? `${typeBadge}💭 此刻状态：${r.currentStatus}` : '';
    document.getElementById('schedulePreviewText').innerText = r.text;
    openModal('schedulePreviewModal');
}

function confirmSaveSchedule() {
    // 一律以弹窗自己身上钉着的那份为准，全局变量只当兜底：
    // 用户看到的是哪份预览就存哪份，中途后台跑过什么都不影响。
    const modal = document.getElementById('schedulePreviewModal');
    let charId = (modal && modal.dataset.charId) ? modal.dataset.charId : pendingScheduleCharId;
    let r = null;
    try { if (modal && modal.dataset.payload) r = JSON.parse(modal.dataset.payload); } catch (e) {}
    if (!r) r = pendingScheduleResult;

    const char = myCharacters.find(c => c.id == charId);
    // ⚠️ 不能再静默 return 了：按钮点了没反应、也没有任何提示，是最难查的一类 bug。
    if (!char || !r) {
        const msg = !char ? '没找到这个角色（可能已经被删了）' : '这份预览的内容已经丢了，请重新生成一次';
        if (typeof appAlert === 'function') appAlert('保存失败：' + msg); else alert('保存失败：' + msg);
        return;
    }
    // 整段包起来：中间任何一步抛异常，都不能让按钮变成"点了没反应"
    try {
        // 手动生成的日程同样先归档旧的那份，跟自动续期保持一致
        if (typeof archiveCharSchedule === 'function') archiveCharSchedule(char);
        char.schedule = { text: r.text, generatedAt: Date.now() };
        if (r.currentStatus && typeof saveCharLifeState === 'function') saveCharLifeState(char, r.currentStatus, r.statusTypeLabel);
        if (typeof saveAllData === 'function') saveAllData();
    } catch (e) {
        console.error('保存日程失败：', e);
        if (typeof appAlert === 'function') appAlert('保存失败：' + (e.message || e)); else alert('保存失败：' + (e.message || e));
        return;
    }
    // 这两个是"存完之后顺带做的事"，失败了不该连累已经存好的日程
    try { if (typeof updateScheduleMemoryAsync === 'function') updateScheduleMemoryAsync(char); } catch (e) { console.warn('日程记忆总结没跑起来：', e); }
    try { if (typeof autoTopUpCharTodos === 'function') autoTopUpCharTodos(char); } catch (e) { console.warn('自动补待办没跑起来：', e); }

    closeModal('schedulePreviewModal');
    if (modal) { delete modal.dataset.charId; delete modal.dataset.payload; }
    pendingScheduleResult = null;
    if (typeof showToast === 'function') {
        showToast(typeof getAvatarHTML === 'function' ? getAvatarHTML(char, 40) : '', '日程已保存',
            `${char.name} 今天的安排已经更新。`, null, null, false);
    }
    // 资料页/日历正开着的话顺手刷新一下，不然还显示旧日程
    if (typeof renderCharCalendarGrid === 'function' && document.getElementById('charCalendarGrid')) {
        try { renderCharCalendarGrid(); } catch (e) {}
    }
}



function getStatusTypeColor(label) {
    if (!label) return null;
    const t = statusTypes.find(t => t.label === label);
    return t ? t.color : null;
}

function renderStatusTypesList() {
    const el = document.getElementById('statusTypesList');
    if (!el) return;
    if (statusTypes.length === 0) { el.innerHTML = '<span style="color:#8b98a5; font-size:12px;">暂无状态类型，添加一个吧</span>'; return; }
    el.innerHTML = statusTypes.map(t => {
        const opacity = Math.floor((t.opacity || 100) / 100 * 34);
        const opacityHex = opacity.toString(16).padStart(2, '0');
        const bgColor = t.color + opacityHex;
        return `<span style="background:${bgColor}; border:1px solid ${t.color}; color:${t.color}; padding:3px 10px; border-radius:12px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
            ${t.label} <span style="cursor:pointer; font-weight:bold;" onclick="deleteStatusType('${t.id}')">×</span>
        </span>`;
    }).join('');
}

function addStatusType() {
    const labelInput = document.getElementById('newStatusTypeLabel');
    const colorInput = document.getElementById('newStatusTypeColor');
    const opacityInput = document.getElementById('newStatusTypeOpacity');
    const label = labelInput.value.trim();
    if (!label) return alert('请输入状态名称');
    if (statusTypes.some(t => t.label === label)) return alert('这个状态类型已经存在了');
    statusTypes.push({ id: 'st_' + Date.now(), label, color: colorInput.value, opacity: parseInt(opacityInput.value) || 100 });
    labelInput.value = '';
    colorInput.value = '#1d9bf0';
    opacityInput.value = 100;
    document.getElementById('statusOpacityDisplay').innerText = '100%';
    saveAllData();
    renderStatusTypesList();
}

function deleteStatusType(id) {
    statusTypes = statusTypes.filter(t => t.id !== id);
    saveAllData();
    renderStatusTypesList();
}

const PRESET_COLORS = ['#1d9bf0', '#f91880', '#17bf63', '#ffad1f', '#7856ff', '#ff7a45', '#00b8d9', '#eb5757', '#a66dc6', '#58595b'];

function initColorPalette() {
    const palette = document.getElementById('colorPalette');
    if(!palette) return;
    palette.innerHTML = `<span style="font-size:11px; color:#8b98a5; width:100%;">常用色（点击左侧调色盘可选任意颜色）：</span>` + PRESET_COLORS.map(color => `
        <div style="width:28px; height:28px; background:${color}; border:2px solid #eff3f4; border-radius:4px; cursor:pointer; transition:0.2s;"
             onclick="selectStatusColor('${color}')"
             onmouseover="this.style.transform='scale(1.1)'; this.style.borderColor='${color}';"
             onmouseout="this.style.transform='scale(1)'; this.style.borderColor='#eff3f4';"
             title="${color}"></div>
    `).join('');
}

function selectStatusColor(color) {
    const elem = document.getElementById('newStatusTypeColor');
    if(elem) elem.value = color;
}

function updateStatusOpacityDisplay(value) {
    const displayElem = document.getElementById('statusOpacityDisplay');
    if(displayElem) displayElem.innerText = value + '%';
}
// ============================================================================
// 界面「卡住打不了字」的兜底三件套
// ----------------------------------------------------------------------------
// 真正的病根（saveAllData 每条消息全量写一次存档、头像 base64 塞满 innerHTML）已经在
// 上面修掉了。但用户的要求是"不要有任何输入框不能输入的情况"，所以再补三道保险，
// 让"就算又冒出个没想到的原因，用户也能自己救回来、不用大退"：
//   1) Esc 逃生口：一键关掉最上面那层弹窗/右键菜单
//   2) 点输入区任意位置 → 焦点强制回到输入框（点到内边距上也算数）
//   3) 看门狗：定期检查输入框是不是被什么东西盖住了，是的话把已知的"残留浮层"收掉，
//      并把挡住它的元素打到控制台，下次真出问题能直接看到是谁干的
// ============================================================================

// 当前屏幕上真正显示着的弹窗（按 DOM 顺序，最后一个就是最上面那个）
function gyVisibleOverlays() {
    return Array.from(document.querySelectorAll('.modal-overlay'))
        .filter(m => getComputedStyle(m).display !== 'none');
}

// 一次性收掉所有浮层。用在"界面整个换了一套数据"的时刻（比如恢复存档）——
// 那时候还开着的弹窗内容都是旧的，留着只会挡路。
function gyCloseAllOverlays() {
    gyVisibleOverlays().forEach(m => { if (typeof closeModal === 'function') closeModal(m.id); else m.style.display = 'none'; });
    const menu = document.getElementById('chatContextMenu');
    if (menu) menu.style.display = 'none';
}

// 关掉最上层的一个浮层；什么都没开就返回 false
function gyCloseTopOverlay() {
    const menu = document.getElementById('chatContextMenu');
    if (menu && getComputedStyle(menu).display !== 'none') { menu.style.display = 'none'; return true; }
    const overlays = gyVisibleOverlays();
    if (overlays.length === 0) return false;
    const top = overlays[overlays.length - 1];
    if (typeof closeModal === 'function') closeModal(top.id); else top.style.display = 'none';
    return true;
}

document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    // 正在弹窗里的输入框打字时按 Esc，先让输入框自己失焦，不要直接把弹窗关了（会丢内容）
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && ae.value) { ae.blur(); return; }
    if (gyCloseTopOverlay()) { e.preventDefault(); return; }
    // 没有浮层可关：在聊天页就把焦点送回输入框
    const view = document.getElementById('view-chat');
    const input = document.getElementById('chatInput');
    if (view && input && view.style.display !== 'none') { try { input.focus(); } catch (err) {} }
});

function gySetupInputWatchdog() {
    // 点输入区的任何位置（包括图标行、内边距）都把焦点交给输入框
    const area = document.getElementById('chatInputArea');
    if (area) {
        area.addEventListener('mouseup', function (e) {
            if (e.target.closest('button, input, textarea, select, a, [contenteditable]')) return;
            const input = document.getElementById('chatInput');
            if (input) { try { input.focus(); } catch (err) {} }
        });
    }

    // 看门狗：2 秒一次，只在聊天页开着的时候跑，开销可以忽略
    setInterval(function () {
        try {
            const view = document.getElementById('view-chat');
            const area2 = document.getElementById('chatInputArea');
            const input = document.getElementById('chatInput');
            if (!view || !area2 || !input) return;
            if (view.style.display === 'none' || area2.style.display === 'none') return;
            if (gyVisibleOverlays().length > 0) return;   // 用户自己开着弹窗，正常，不管

            const r = input.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            if (!hit || hit === input || input.contains(hit) || hit.contains(input)) return;

            // ⚠️ 先排除"本来就该盖住"的情况：抽屉菜单是用户自己点开的，它当然会盖住下面的输入框，
            // 这不是 bug，不该刷警告（之前会报 <a class="mdrawer-item"> 挡住输入框，就是这个误报）。
            // 同理还有正常打开的弹窗——只要它是可见的、有内容的，就是用户自己要看的东西。
            const drawer = hit.closest ? hit.closest('.mobile-drawer, .mobile-drawer-overlay') : null;
            if (drawer && drawer.classList.contains('open')) return;
            if (drawer && parseFloat(getComputedStyle(drawer).left || '0') >= 0) return; // 抽屉已滑出（left 从负值变成 0）

            // 输入框被挡住了。先收掉已知的"忘了关"的残留浮层
            let fixed = '';
            const menu = document.getElementById('chatContextMenu');
            if (menu && menu.contains(hit)) { menu.style.display = 'none'; fixed = '右键菜单'; }
            const strayOverlay = hit.closest ? hit.closest('.modal-overlay') : null;
            if (!fixed && strayOverlay) {
                const box = strayOverlay.querySelector('.modal-box') || strayOverlay.firstElementChild;
                if (!box || box.offsetHeight === 0) { strayOverlay.style.display = 'none'; fixed = '空弹窗 #' + strayOverlay.id; }
            }
            if (fixed) { console.warn('[输入框看门狗] 输入框被挡住了，已自动收掉：' + fixed); return; }

            // 不是已知情况：不乱动别人的元素，但把凶手打出来，下次能直接定位
            console.warn('[输入框看门狗] 输入框被挡住了，挡住它的是：',
                '<' + hit.tagName.toLowerCase() + ' id="' + (hit.id || '') + '" class="' + (hit.className || '') + '">',
                '按 Esc 可以尝试关掉最上层浮层。');
        } catch (e) { /* 看门狗自己出错绝对不能影响正常使用 */ }
    }, 2000);
}
// 脚本是在 </body> 前同步加载的，DOMContentLoaded 有可能已经过去了，两种情况都要能挂上
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gySetupInputWatchdog);
else gySetupInputWatchdog();

// ============================================================================
// 浮层式滚动条：平时透明，鼠标移到可滚动区域上、或正在滚动时才浮现
// ----------------------------------------------------------------------------
// 为什么要用 JS：CSS 里 `.某元素:hover::-webkit-scrollbar-thumb` 这个写法
// **在 Chromium 里画不出来**（实测过：同样的颜色写死就有，挂到宿主的 :hover 上就没了。
// 滚动条伪元素只认它自己的伪类，不跟着宿主元素的 :hover 状态走）。
// 所以只能由 JS 给元素加一个 class，让样式命中的是 class 选择器。
//
// 开销控制：mouseover 只在"鼠标移到另一个元素上"时触发，不是每移动一像素都触发；
// 而且每次只往上找到**最近的那个**可滚动祖先就停，不遍历整棵树。
// ============================================================================
(function () {
    const CLS = 'gy-sb-on';
    let hoverEl = null;                 // 当前因为"鼠标在上面"而点亮的元素
    const scrollTimers = new WeakMap(); // 因为"正在滚动"而临时点亮的元素

    function isScrollable(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el === document.documentElement || el === document.body) {
            return document.documentElement.scrollHeight > document.documentElement.clientHeight;
        }
        const cs = getComputedStyle(el);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return true;
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth) return true;
        return false;
    }

    // 从 target 往上找最近的可滚动祖先；找不到就返回 null
    function nearestScrollable(target) {
        let el = target;
        let guard = 0;
        while (el && el.nodeType === 1 && guard++ < 12) {   // 12 层够到最近的滚动容器了，再深就不值当
            if (isScrollable(el)) return el;
            el = el.parentElement;
        }
        return isScrollable(document.documentElement) ? document.documentElement : null;
    }

    function light(el) { if (el && el.classList) el.classList.add(CLS); }
    function dim(el) {
        // 正在滚动的计时器还没到，就先别熄
        if (el && el.classList && !scrollTimers.has(el)) el.classList.remove(CLS);
    }

    // ⚠️ 这里必须省着点花。mouseover 虽然不是每像素触发，但鼠标扫过界面时一秒也能来几十次，
    // 而 nearestScrollable 里每层都要 getComputedStyle、可滚动的还要读 scrollHeight（会强制回流）。
    // 直接在事件里同步跑，DOM 一大就是典型的 layout thrashing：主线程一直在算布局，
    // 点击排不上队，用起来就是"点了没反应"。
    // 两道限流：① 一帧最多算一次（rAF 合并）② 只往上找有限层数，找不到就当页面滚动条。
    let pendingTarget = null, rafId = 0;
    function resolveHover() {
        rafId = 0;
        const t = pendingTarget; pendingTarget = null;
        if (!t || !t.isConnected) return;
        const el = nearestScrollable(t);
        if (el === hoverEl) return;
        if (hoverEl) dim(hoverEl);
        hoverEl = el;
        light(hoverEl);
    }
    document.addEventListener('mouseover', function (e) {
        pendingTarget = e.target;
        if (!rafId) rafId = requestAnimationFrame(resolveHover);
    }, true);

    // 鼠标离开整个窗口：全部熄掉
    document.addEventListener('mouseleave', function () {
        if (hoverEl) { dim(hoverEl); hoverEl = null; }
    });
    window.addEventListener('blur', function () {
        if (hoverEl) { dim(hoverEl); hoverEl = null; }
    });

    // 滚轮/触摸滚动时也点亮一下：正在滚的时候看得见滚到哪儿了，停手 1.2 秒后淡出
    document.addEventListener('scroll', function (e) {
        let el = e.target;
        if (el === document || el === window) el = document.documentElement;
        if (!el || !el.classList) return;
        light(el);
        const old = scrollTimers.get(el);
        if (old) clearTimeout(old);
        scrollTimers.set(el, setTimeout(function () {
            scrollTimers.delete(el);
            if (el !== hoverEl) el.classList.remove(CLS);
        }, 1200));
    }, true);
})();
