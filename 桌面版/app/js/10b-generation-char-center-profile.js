// ✂️ 这个文件是从 10-comments-npc-forum-reply.js 拆出来的第 2 段（原来一个文件太大，改起来容易改坏）。
// 跟 10-comments-npc-forum-reply.js 以及同一组的其它段共用一个全局作用域，index.html 里的加载顺序不能换。

function toggleMainPostLike(postId, event) {
    let isTabloid = postId.startsWith('tb_');
    let post = isTabloid ? tabloidPosts.find(p => p.id === postId) : globalPosts.find(p => p.id == postId);
    if (!post) return;
    if (!post.likedBy) post.likedBy = [];
    const pinkLikeSVG = likeSVGFilled;   // v107：命名保留，颜色已交给 CSS（.x-icon.liked 跟主题走）
    // event.currentTarget 只在事件真正派发的过程中才有值：从 setTimeout 里、
    // 或者别的代码直接调这个函数时它是 null，接着 el.style 就抛
    // "Cannot read properties of null"，界面上表现为"点了没反应"。
    // 这里退一步用 target 往上找那个按钮；再找不到就只更新数据、不动样式，
    // 至少点赞这件事本身要成功。
    const el = (event && (event.currentTarget
        || (event.target && event.target.closest && event.target.closest('[onclick*="toggleMainPostLike"]')))) || null;
    const paint = (color, svg) => {
        if (!el) return;
        el.style.color = color;
        const wrap = el.querySelector('.like-icon-wrap');
        if (wrap) wrap.innerHTML = svg;
    };

    if (post.userLiked) {
        post.userLiked = false;
        post.stats.likes = Math.max(0, parseStat(post.stats.likes) - 1);
        post.likedBy = post.likedBy.filter(id => id !== 'me');
        paint('inherit', likeSVG);
    } else {
        post.userLiked = true;
        post.stats.likes = parseStat(post.stats.likes) + 1;
        if (!post.likedBy.includes('me')) post.likedBy.push('me');
        paint('#f91880', pinkLikeSVG);
    }
    if (el) {
        const cnt = el.querySelector('.like-count');
        if (cnt) cnt.innerText = formatStat(post.stats.likes);
    }

    let statsLikeEl = document.getElementById(`detail-stats-likes-${postId}`);
    if (statsLikeEl) statsLikeEl.innerText = formatStat(post.stats.likes);

    saveAllData();
}

async function executeGeneration(charsToPost, storyContext = null, customWordLimit = null) {
    isGenerating = true;
    // ⚠️ 防御修复：之前这几处直接 document.getElementById('loadingStatus').style... 没做空值检查，
    // 一旦这个元素在某次调用时还没渲染出来（比如从和主页不同的视图/时机触发生成），
    // 就会直接抛 "Cannot read properties of null (reading 'style')" 把整个生成流程炸掉。
    // 加个变量存一次查找结果、每次用之前判断一下是否存在，找不到就跳过界面提示，不影响生成本身。
    const loadingStatusEl = document.getElementById('loadingStatus');
    if (loadingStatusEl) loadingStatusEl.style.display = 'block';

    // 动态显示：(角色名) 正在发布推文...
    let charNames = charsToPost.map(c => c.name).join('、');
    if (loadingStatusEl) loadingStatusEl.innerText = `${charNames} 正在发布推文... `;

    // ⚠️ 关键防御修复（"点了发推没反应/一直转圈"的根因）：这个函数末尾的 isGenerating = false 和
    // 隐藏loading状态的代码，之前完全没有 try/finally 保护。只要循环体里任何一步（哪怕只是拼装
    // prompt 阶段，比如 buildBasePrompt 内部读到某条格式异常的世界书/预设条目）意外抛出了没被
    // 内层 try/catch 接住的异常，这个 async 函数就会直接整个中断退出——isGenerating 永远卡在
    // true、loading提示永远不消失，所有角色的推文/manual触发/自动定时器此后全部被"已有生成任务
    // 正在进行"这条静默判断挡死，且没有任何弹窗提示到底是哪里出的错。这里用 try/finally 把
    // "收尾"这一步锁死成无论如何都会执行，外层再兜底catch一次意外错误并打印到控制台，方便定位。
    try {
        await executeGenerationInner(charsToPost, storyContext, customWordLimit, loadingStatusEl, charNames);
    } catch (e) {
        console.error('[发推流程异常中断]', e);
    } finally {
        isGenerating = false;
        if (loadingStatusEl) loadingStatusEl.style.display = 'none';
    }
}

async function executeGenerationInner(charsToPost, storyContext, customWordLimit, loadingStatusEl, charNames) {
    let newPosts = [];
    let emoPrompt = getEmoticonPrompt();

    // ⚠️ 第四次修复：之前虽然让AI"可以自己现想标签"了，但完全没告诉它别的角色最近都用过什么标签——
    // 每个角色各想各的，同一个话题永远凑不出"多个不同角色用过同一个标签"，趋势榜自动收录机制就没法触发。
    // 这里从最近的帖子里提取一批"最近还在用的标签"，喂给AI，明确告诉它优先沿用而不是另造新词。
    const recentTags = getRecentActiveTags();

    for (let char of charsToPost) {
        const storyPart = storyContext ? `\n【当前故事背景】：${storyContext}\n请结合故事背景从你的视角发表看法。` : '';
        const chatPart = `\n【最近对话上下文】：\n${getRecentChatContext(char.id)}`;

        let finalWordLimit = customWordLimit ? customWordLimit : postWordLimit;

        try {
            // ⚠️ 关键修复：prompt 拼装（尤其 buildBasePrompt，涉及世界书/预设的插入位置分桶逻辑）
            // 之前是写在这个 try 外面的——一旦某个角色的世界书/预设数据里有格式异常的条目导致这里
            // 抛出异常，就会直接跳出整个 for 循环、中断整个生成流程（配合上面新加的外层 try/finally，
            // 现在即使这里出错，也只会跳过"这一个角色"，不影响同批次里其他角色，也不会让
            // isGenerating 卡死。
            // 🆕 AI自主引用别人的推文：给一份候选列表（带真实post.id），AI自己判断要不要引用、引用哪条
            const quotableCandidates = typeof getQuotableCandidatePosts === 'function' ? getQuotableCandidatePosts(char.id) : [];
            const quotableText = quotableCandidates.length > 0
                ? `\n【可引用的最近推文（可选功能，大部分时候不需要用）】：如果这条新推文是想转发/回应/吐槽某条别人发的推文，可以引用它——引用不是必须的，大多数时候直接发原创内容就好：\n${quotableCandidates.map(p => `- id:"${p.id}" ${p.name}: ${p.text}`).join('\n')}\n`
                : '';

            // ⚠️ 第八次修复：之前七轮全在改"标签规则"这段自然语言描述的措辞，但标签本身一直是让AI
            // 顺手写进text正文里的——这种"顺带决定"很容易在一大段人设/上下文/格式要求中被模型直接忽略，
            // 不管措辞多准确，都只是"建议"而不是"强制"。这次把标签改成JSON里单独的一个字段（tag），
            // 跟text分开：模型每次都必须显式填这个字段（够格填标签、不够格必须显式填null），
            // 而不是"要不要在文字里顺便加个#号"这种容易被跳过的隐性决定，结构化字段通常比自然语言
            // 描述更能保证AI真的执行到。生成后再由代码把tag拼接回text末尾，显示效果不变。
            let p = `${buildBasePrompt(char, true, (storyContext || '') + chatPart)}${storyPart}${chatPart}${emoPrompt}${quotableText}
发一条推文，分享你的见闻或看法，不超过${finalWordLimit}字（这段纯文字，不要在里面写"#标签"，标签单独填在下面JSON的tag字段里）。${WORD_LIMIT_PRIORITY_NOTE}
【tag字段怎么填，按顺序判断】：
1. 内容如果能提炼出一个简短贴切的词就算够格——不需要是大事件，具体的活动、场景、心情、小兴趣点都算，比如"在咖啡馆写稿""被猫吵醒""通宵改方案"。够格的话，先看是否和"最近活跃标签"（${recentTags.length>0 ? recentTags.join('、') : '目前没有'}）里某一个相关，相关就直接把tag填成那一个；都不相关就自己现想一个贴切、有个性的新标签填进tag。
2. 内容确实空泛、提炼不出任何具体的词（比如纯抒情感慨、单纯回应别人），tag就填null，不要硬凑。
3. 不能为了蹭热度把tag填成和内容不相关的词，也不要不同角色反复填同一个和内容无关的标签。${trendingTags.length>0 ? `实在想不出来又想蹭热点，可以把tag填成${trendingTags[0]}，但这是最后备选，不要每条都用。` : ''}
即使这次发的是推文而不是对话，如果你的世界观设定/正则脚本里要求每次输出固定附带某种格式标签或HTML（比如状态栏、卡片等），也请照常写进text字段里（换行用\n转义），不要因为是推文就省略，这也不违反下面"只返回JSON"的要求。
${getFinalAnswerMarkerPromptNote()}
【强制要求】：请严格以如下JSON格式返回，不要有任何其他说明，tag字段必须显式给出（字符串或null，不能省略这个字段）：
{"text":"你的推文正文（不含#标签）","tag":"符合上面规则就填'#标签'字符串，不符合就填null","image":false,"location":"当前所在的具体地点，若没有可填空字符串","emoticonId":"如果有合适的可用表情包，可以填入其ID，若不需要表情包则填null","quotePostId":"如果决定引用上面候选列表里的某条推文，把它的id原样填在这里；不引用就填null"}
如果内容非常适合真实配图，可以返回：
{"text":"推文正文（不含#标签）","tag":"同上规则","image":true,"imageKeyword":"配图关键词英文","location":"具体地点","emoticonId":null,"quotePostId":null}`;

            let data = await sendChatRequest({ url: myApiUrl, key: myApiKey, model: myModel }, p);
            if(data.error) { console.error(`[发推失败] ${char.name}:`, data.error.message || data.error); continue; }
            let raw = data.choices?.[0]?.message?.content?.trim() || "";
            if(!raw) continue;
            let parsed = extractJsonObject(raw);
            if(parsed && parsed.text) {
                // 去掉AI偶尔自己加的首尾引号，再跑一遍该角色的"生成后处理"正则脚本——
                // 角色卡自带的状态栏/格式化HTML卡片就是靠这批脚本烘焙进正文的，推文也不例外。
                parsed.text = parsed.text.replace(/^["“]|["”]$/g, '').trim();
                parsed.text = applyRegexScripts(parsed.text, 'ai_output', char.id);
                // tag是独立字段，这里拼回text末尾，显示效果跟以前"标签写在正文里"一样；
                // 顺手兼容一下AI万一没听话、还是把#标签直接写进了text正文里的情况（那就不用重复拼接了）。
                if (parsed.tag && typeof parsed.tag === 'string') {
                    let tag = parsed.tag.trim();
                    if (tag && tag.toLowerCase() !== 'null') {
                        if (!tag.startsWith('#')) tag = '#' + tag;
                        if (!parsed.text.includes(tag)) parsed.text = `${parsed.text}\n${tag}`;
                    }
                }
                let mediaUrl = null;
                if(parsed.emoticonId) {
                    let emo = globalEmoticons.find(e => e.id === parsed.emoticonId);
                    if(emo) mediaUrl = emo.url;
                } else if(parsed.image && parsed.imageKeyword) {
                    // ⚠️ 修复："每次都要刷新才能把旧版Unsplash图片换成新接口"这个问题的根源在这里：
                    // loadAllData()里有一段"存档清洗"逻辑，会把存档里所有 source.unsplash.com 的旧链接
                    // 换成 image.pollinations.ai 的新接口（Unsplash那个免登录随机取图的source接口已经不稳定/
                    // 经常打不开），但那段清洗只在刷新页面、重新读取存档时跑一次——这里新发的推文每次
                    // 还是现生成一条 source.unsplash.com 的旧链接，所以看起来就是"不刷新就一直是旧的、坏的"。
                    // 直接在生成的这一步就换成新接口，新发的推文从一开始就是能用的链接，不用再等刷新清洗。
                    mediaUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(parsed.imageKeyword)}?nologo=true&width=800&height=400`;
                }
                // 🆕 AI选了要引用的推文id：校验一下这条id当前确实存在（防止AI瞎编/引用了后来被删掉的帖子），
                // 存在才真的挂上quotedPostId，不存在就当没引用，不影响正文正常发布。
                let quotedPostId = null;
                if (parsed.quotePostId && typeof parsed.quotePostId === 'string' && globalPosts.some(p => p.id === parsed.quotePostId)) {
                    quotedPostId = parsed.quotePostId;
                }
                let post = {
                    id: 'p_' + Date.now() + Math.floor(Math.random()*1000), char: char, text: parsed.text, timestamp: Date.now(),
                    replies: [], mediaUrl: mediaUrl, quotedPostId: quotedPostId,
                    stats: { retweets: getRandomStat(1000), likes: getRandomStat(5000), views: getRandomStat(50000), comments: 0 },
                    isStory: !!storyContext, location: parsed.location || ""
                };
                newPosts.push(post);
                char.postCount = (char.postCount || 0) + 1;
                if(char.postCount % (postMemoryInterval || 20) === 0) updateCharMemoryAsync(char);
                saveCharLifeState(char, parsed.text); // 顺手用推文内容记录角色当下状态，不额外耗费一次AI调用
            }
        } catch(e) { console.error(`[发推失败] ${char.name}:`, e); }
    }
    
    if (newPosts.length > 0) {
        globalPosts = [...newPosts, ...globalPosts];
        // 检查这次新发的标签有没有凑够"多个不同角色都用过"的热度，够了就自动收进趋势榜；
        // 扫描全部globalPosts而不只是这次新发的，是为了让标签能跨多次发推、慢慢攒够热度被收录，
        // 而不是必须同一批里凑齐才行。
        autoPromoteTrendingTagsFromPosts(globalPosts);
        saveAllData();
        const viewHomeEl = document.getElementById('view-home');
        if (!viewHomeEl || viewHomeEl.style.display !== 'none') renderPosts();

        // 后台发推通知逻辑
        newPosts.forEach(post => {
            let isFollowed = post.char.isFollowing;
            let isSpecialFollowed = post.char.isSpecialFollow;
            let shouldNotify = (isFollowed || isSpecialFollowed) ? true : Math.random() < 0.00;
            
            if (shouldNotify) {
                let notifText = isSpecialFollowed ? `⭐ 特别关注 <b>${post.char.name}</b> 发了新推文` : `<b>${post.char.name}</b> 发了新推文`;
                let avatarHtml = getAvatarHTML(post.char, 80);
                showToast(avatarHtml, notifText, post.text, post.id, null);
                globalNotifications.unshift({ text: notifText, postId: post.id, chatCharId: null, timestamp: Date.now() });
                unreadNotifs++;
                updateNotifBadge();
            }
            spawnNpcComments(post.id, false, { triggerName: post.char.name, triggerText: post.text });
            triggerRelatedCharacterReactions(post.char, post.text, { type: 'post', id: post.id });
        });
        renderChatCharList();
    }
    // isGenerating 复位 / loading提示隐藏已经交给外层 executeGeneration 的 try/finally 统一处理，
    // 这样不管这里是正常走完、还是中途抛出异常，都保证一定会执行到，不会再出现"卡在转圈"的情况。
}

function renderCenterCharList() {
    const container = document.getElementById('centerCharListContainer');
    if(myCharacters.length === 0) { container.innerHTML = '<div class="empty-state">目前还没有创建任何角色。</div>'; return; }
    let charsToShow = activeGroupFilter ? myCharacters.filter(c => charInFaction(c, activeGroupFilter)) : myCharacters;
    if(charsToShow.length === 0) { container.innerHTML = '<div class="empty-state">该分组下没有角色。</div>'; return; }

    container.innerHTML = charsToShow.map(char => `
        <div class="center-char-item">
            <div class="char-info-wrapper" onclick="openFormForEdit('${char.id}')" style="cursor:pointer; flex:1;">
                ${getAvatarHTML(char, 40)}
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:bold; font-size:15px; display:flex; align-items:center; gap:6px;">
                        ${escapeHtml(char.name)} ${char.verified ? verifiedSVG : ''}
                        ${char.group ? `<span class="group-tag" onclick="event.stopPropagation(); filterByGroup('${escapeJsArg(char.group)}')">${escapeHtml(char.group)}</span>` : ''}
                    </div>
                    <div style="color:#536471; font-size:13px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${char.persona}</div>
                    ${char.lifeState && char.lifeState.activity ? `<div style="color:#8b98a5; font-size:12px; font-style:italic; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">💭 ${char.lifeState.activity}</div>` : ''}
                </div>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-edit-small" style="color:#536471; border-color:#cfd9de;" onclick="event.stopPropagation(); openMemoryHub('${char.id}')">🧠 记忆</button>
                <button class="btn-edit-small" style="color:#1d9bf0; border-color:#1d9bf0;" onclick="event.stopPropagation(); exportCharacterCard('${char.id}')">📤 导出</button>
                <button class="btn-edit-small" style="color:#f91880; border-color:#f91880;" onclick="deleteCharacter('${char.id}')">删除</button>
            </div>
        </div>`).join('');
}

function openCharacterCenter() { switchMainView('characterCenter'); }
function showRoleList() { renderCenterCharList(); document.getElementById('characterListView').style.display = 'block'; document.getElementById('characterFormView').style.display = 'none'; }

function clearForm() {
    editingCharId = null;
    document.getElementById('formTitle').innerText = "创建新 AI 角色";
    ['charName', 'charHandle', 'charPersona', 'charBio', 'charFollowers', 'charFollowing', 'charLocation', 'charWebsite', 'charBirthdate', 'charAutoReply', 'charBusyAutoReply', 'charAnonName', 'charAnonId', 'charNudgeText', 'charFirstMessage'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('charVerified').checked = false;
    document.getElementById('charAvatar').value = '';
    document.getElementById('charBg').value = '';
    document.getElementById('charAvatarPreview').style.display = 'none';
    document.getElementById('charBgPreview').style.display = 'none';
    tempCropResults.charAvatar = null; tempCropResults.charBg = null;

    if (typeof refreshGroupSelect === 'function') refreshGroupSelect([]);   // 新建角色：一个势力都不勾
    if (typeof refreshCharUserPersonaSelect === 'function') refreshCharUserPersonaSelect('');
    document.getElementById('freqInterval').value = 1; document.getElementById('freqUnit').value = 'day'; document.getElementById('freqCount').value = 1;
    // 新建角色默认走"固定频率"：自主模式是要用户主动选的，不能默认替 TA 做主
    const nActMode = document.getElementById('charActMode'); if (nActMode) nActMode.value = 'fixed';
    const nAmin = document.getElementById('autonomyMinMinutes'); if (nAmin) nAmin.value = 30;
    const nAmax = document.getElementById('autonomyMaxHours'); if (nAmax) nAmax.value = 8;
    ['charWebMode', 'charOwnDaysMode'].forEach(id => { const e = document.getElementById(id); if (e) e.value = 'default'; });
    ['charWebGap', 'charWebPerDay'].forEach(id => { const e = document.getElementById(id); if (e) e.value = 0; });
    if (typeof onCharActModeChange === 'function') onCharActModeChange();
    document.getElementById('chatFreqInterval').value = 0; document.getElementById('chatFreqUnit').value = 'hour';
    document.getElementById('letterFreqInterval').value = 0; document.getElementById('letterFreqUnit').value = 'day';
    document.getElementById('forumFreqInterval').value = 0; document.getElementById('forumFreqUnit').value = 'hour';
    document.getElementById('anonFreqInterval').value = 0; document.getElementById('anonFreqUnit').value = 'hour';

    charFormWbCategoryFilter = null;
    charFormWbPendingSelection = new Set();
    renderCharFormWbCheckboxes();
    const dbBox = document.getElementById('charDataBankList');
    if (dbBox) dbBox.innerHTML = '<span style="color:#536471; font-size:13px;">请先保存角色，再回来上传专属资料库</span>';
}

function openFormForCreate() { clearForm(); document.getElementById('characterListView').style.display = 'none'; document.getElementById('characterFormView').style.display = 'block'; renderStatusTypesList(); }

function openFormForEdit(charId) {
    editingCharId = charId; let char = charId === 'tabloid_admin' ? tabloidAccount : myCharacters.find(c => c.id == charId); if (!char) return;
    document.getElementById('formTitle').innerText = "修改角色资料";
    document.getElementById('charName').value = char.name; document.getElementById('charHandle').value = char.handle; document.getElementById('charPersona').value = char.persona;
    document.getElementById('charBio').value = char.bio; document.getElementById('charFollowers').value = char.followers; document.getElementById('charFollowing').value = char.following;
    document.getElementById('charLocation').value = char.location || ''; document.getElementById('charWebsite').value = char.website || ''; document.getElementById('charBirthdate').value = char.birthdate || '';
    document.getElementById('charVerified').checked = char.verified || false;
    if (typeof refreshGroupSelect === 'function') refreshGroupSelect(getCharFactions(char));
    if (typeof refreshCharUserPersonaSelect === 'function') refreshCharUserPersonaSelect(charUserPersona[String(char.id)] || '');
    document.getElementById('charAutoReply').value = char.autoReplyText || '';
    document.getElementById('charBusyAutoReply').value = char.busyAutoReplyText || '';
    document.getElementById('charAnonName').value = char.anonName || '';
    document.getElementById('charAnonId').value = char.anonId || '';
    document.getElementById('charNudgeText').value = char.nudgeText || '';
    if (document.getElementById('charFirstMessage')) document.getElementById('charFirstMessage').value = char.firstMessage || '';
    renderStatusTypesList();
    
    if (char.avatarImg) { document.getElementById('charAvatarPreview').src = char.avatarImg; document.getElementById('charAvatarPreview').style.display = 'block'; } else { document.getElementById('charAvatarPreview').style.display = 'none'; }
    if (char.bgImg) { document.getElementById('charBgPreview').src = char.bgImg; document.getElementById('charBgPreview').style.display = 'block'; } else { document.getElementById('charBgPreview').style.display = 'none'; }
    
    tempCropResults.charAvatar = char.avatarImg || null;
    tempCropResults.charBg = char.bgImg || null;

    charFormWbCategoryFilter = null;
    charFormWbPendingSelection = new Set(char.worldbooks || []);
    renderCharFormWbCheckboxes();
    renderCharDataBankList();
    
    if (char.postFreq) { document.getElementById('freqInterval').value = char.postFreq.interval; document.getElementById('freqUnit').value = char.postFreq.unit; document.getElementById('freqCount').value = char.postFreq.count; }
    if (char.chatFreq) { document.getElementById('chatFreqInterval').value = char.chatFreq.interval || 0; document.getElementById('chatFreqUnit').value = char.chatFreq.unit || 'hour'; } else { document.getElementById('chatFreqInterval').value = 0; document.getElementById('chatFreqUnit').value = 'hour'; }
    if (char.letterFreq) { document.getElementById('letterFreqInterval').value = char.letterFreq.interval || 0; document.getElementById('letterFreqUnit').value = char.letterFreq.unit || 'day'; } else { document.getElementById('letterFreqInterval').value = 0; document.getElementById('letterFreqUnit').value = 'day'; }
    if (char.forumPostFreq) { document.getElementById('forumFreqInterval').value = char.forumPostFreq.interval || 0; document.getElementById('forumFreqUnit').value = char.forumPostFreq.unit || 'hour'; } else { document.getElementById('forumFreqInterval').value = 0; document.getElementById('forumFreqUnit').value = 'hour'; }
    if (char.anonPostFreq) { document.getElementById('anonFreqInterval').value = char.anonPostFreq.interval || 0; document.getElementById('anonFreqUnit').value = char.anonPostFreq.unit || 'hour'; } else { document.getElementById('anonFreqInterval').value = 0; document.getElementById('anonFreqUnit').value = 'hour'; }
    // 🎲 行为模式：老存档没有 actMode 字段，一律回落到"按固定频率"，
    //    不能让升级一下所有角色突然都开始自作主张。
    const actModeEl = document.getElementById('charActMode');
    if (actModeEl) {
        actModeEl.value = (char.actMode === 'auto') ? 'auto' : 'fixed';
        // 自主模式的节奏是 TA 自己定的，这两个框只是给那个随机数划范围
        const amin = document.getElementById('autonomyMinMinutes'); if (amin) amin.value = char.autonomyMinMinutes || 30;
        const amax = document.getElementById('autonomyMaxHours'); if (amax) amax.value = char.autonomyMaxHours || 8;
        const wm = document.getElementById('charWebMode'); if (wm) wm.value = char.webMode || 'default';
        const wg = document.getElementById('charWebGap'); if (wg) wg.value = char.webGapMin || 0;
        const wd = document.getElementById('charWebPerDay'); if (wd) wd.value = char.webPerDay || 0;
        const dm = document.getElementById('charOwnDaysMode'); if (dm) dm.value = char.ownDaysMode || 'default';
        if (typeof onCharActModeChange === 'function') onCharActModeChange();
    }

    document.getElementById('characterListView').style.display = 'none'; document.getElementById('characterFormView').style.display = 'block';
}

async function deleteCharacter(charId) {
    if (!(await appConfirm('确定要删除这个角色吗？相关的推文也会被全部清理！'))) return;
    myCharacters = myCharacters.filter(c => c.id != charId);
    globalPosts = globalPosts.filter(p => p.char.id != charId);
    groupChats.forEach(g => { g.members = g.members.filter(m => m != charId); });
    groupChats = groupChats.filter(g => g.members.length >= 2);
    charRelationships = charRelationships.filter(r => r.fromId != charId && r.toId != charId); // 同步清理关系网中的连线
    saveAllData(); renderCenterCharList(); renderPosts();
    if (currentProfileId == charId && document.getElementById('view-profile').style.display !== 'none') switchMainView('home');
    if (currentChatSessionId == charId && document.getElementById('view-chat').style.display !== 'none') switchChatSession(myCharacters.length > 0 ? myCharacters[0].id : null);
}

// ===== 角色资料自动补全 =====
// 需求：除了"人设"以外，用户名 / 账号ID / 简介 / 生日这些字段留空的时候，应该能像简介那样
// 由AI照着人设自己生成，不用一个个手填。生日则优先直接从人设文本里认——人设里常常
// 明写着"生日：3月14日"，能白捡的就别浪费一次API调用。

// 从人设文本里认生日。认得出就返回 yyyy-mm-dd（<input type="date"> 只收这个格式），认不出返回 ''。
// 支持这几种常见写法：1998年3月14日 / 生日3月14日 / 生日：1998-03-14 / 出生于 1998/3/14
function extractBirthdateFromPersona(persona) {
    if (!persona) return '';
    const text = String(persona);
    // 优先找"生日/出生"附近的日期，避免把人设里别的年份（入学、出道时间等）当成生日
    const near = text.match(/(?:生日|出生日期|出生于|生于)[^\n]{0,12}?((?:\d{4}\s*[年\-\/\.]\s*)?\d{1,2}\s*[月\-\/\.]\s*\d{1,2}\s*日?)/);
    const raw = near ? near[1] : null;
    if (!raw) return '';
    const nums = raw.match(/\d+/g);
    if (!nums) return '';
    let y, mo, d;
    if (nums.length >= 3) { [y, mo, d] = nums.map(Number); }
    else if (nums.length === 2) {
        // 人设里只写了月日（"生日3月14日"）。<input type="date"> 必须有年份，
        // 这里填一个中性的 2000 年占位，并在提示里告诉用户可以自己改——
        // 总比因为缺年份就整个不填要好。
        y = 2000; mo = Number(nums[0]); d = Number(nums[1]);
    } else return '';
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100)) return '';
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 让AI照着人设，把表单里还空着的资料字段补出来。只补空的，用户已经填过的一律不动。
// 返回一个对象，键就是字段名；失败返回 null（调用方自己决定要不要拦下保存）。
// 返回值：成功时是解析好的对象；失败时是 { __error: '给用户看的原因' }，
// 让调用方能说清楚到底哪儿不行，而不是笼统一句"失败了"。
async function aiCompleteCharProfile(persona, blanks) {
    if (blanks.length === 0) return null;
    // ⚠️ 以前这里只认主 API（!myApiKey 就直接返回 null），只配了副 API 的用户
    // 点补全永远是"失败了，可能是API没配好"——但他明明配了。改成走 getApiConfig，
    // 跟 app 里其它功能一致：主 API 没配就用副 API。
    // getApiConfig(false) 只会给主 API，主 API 空着时不会自动退到副 API，
    // 所以这里显式地退一步：补全资料这种小活儿用哪个都行，没道理因为主 API 没填就不给用。
    let api = { url: myApiUrl, key: myApiKey, model: myModel };
    if (!api.key && typeof getApiConfig === 'function') api = getApiConfig(true);
    if (!api || !api.key) return { __error: '还没配置 API，去「设置 → 🌟 API 与模型」填一个（主 API 或副 API 都行）。' };
    const fieldDesc = {
        // 🆕 名字不再要求"就叫本名"：社交平台上大家用的是网名。让 AI 按人设想一个"这个人会给自己起的名字"——
        // 高冷的人可能就用本名或一个字，中二的会起花名，公众人物会用本名+身份。原名只是可选项之一。
        name: '这个角色在社交平台上会给自己起的显示名（网名）。不一定要用本名——按ta的性格、身份、审美来想：内敛的人可能就用本名或本名里的一个字，跳脱的会起个花名/梗名，公众人物一般用本名。10个字以内，别带@',
        handle: '账号ID（英文小写字母/数字/下划线，别带@，要像真人会取的ID，不要用拼音全拼堆砌）',
        bio: '个人简介（一到两句，第一人称或中性描述，符合人设气质，40字以内）',
        location: '所在地（一个地名，虚构世界就用人设里的地名）',
        // ⚠️ 这一条原来写的是"没有合适的就返回空字符串"，配上下面那句"拿不准就留空"，
        // 结果模型对绝大多数角色都判断成"一个医生哪来的个人网站"，于是网站这一栏永远是空的。
        // 真实的社交主页上这一栏其实很少空着——挂的多半是科室页、专栏、音乐主页、店铺、社交小号。
        // 所以改成"默认要给一个"，只有世界观里根本没有互联网时才留空。
        website: '主页上挂的那个链接。按ta的身份想一个ta真的会往这儿放的东西：医生可能是科室主页或科普专栏，乐手是音乐主页，写东西的是连载页/博客，做生意的是店铺页，学生或普通人放个人社交小号也很正常。写成常见的网址样子即可（不需要真实可访问），虚构世界就用那个世界里的站点名。除非这个世界观里压根没有互联网（古代/修真/架空低魔那种），否则都要给一个，不要留空',
        birthdate: '出生日期，格式必须是 yyyy-mm-dd。人设里没提到生日就返回空字符串，不要瞎编',
        // ⚠️ 这两个对应的是 <input type="number">，塞"1.2万"这种带单位的字符串进去会被浏览器
        // 静默丢弃（值仍然是空），所以这里必须要求纯整数。展示的时候 formatStat() 自己会
        // 把 12000 显示成"1.2万"，不需要 AI 来凑这个格式。
        followers: '粉丝数，只要纯阿拉伯数字整数，不要带"万""k"等单位（例如 12000）',
        following: '关注数，只要纯阿拉伯数字整数（例如 180）',
        // 蓝V：只看人设本身够不够"公众人物"。写死成 true/false 两个值，方便代码直接用。
        verified: '是否有官方认证蓝V标志。只有当人设明显是公众人物（明星/名人/大企业高管/官方账号/知名从业者等）时才给 true，普通人一律 false。只返回 true 或 false 这两个词之一',
        // 🆕 下面这几个以前只能手填，现在一起让 AI 按人设生成
        autoReply: '自动回复文案：ta没空细看消息时会随手回的那一句，要像ta本人的说话方式（例如"嗯。"/"在忙，晚点找你"/"说。"）。15字以内，不要引号',
        busyAutoReply: '忙碌时的自动回复文案：明确表示现在抽不开身、稍后再聊的一句话，同样要像ta本人的语气。20字以内，不要引号',
        nudgeText: '被"拍一拍"时显示的后缀，会拼成「XX 拍了拍 YY ___」。要贴合这个角色的身份/特征（例如"的肩膀"/"的白大褂口袋"/"的猫耳"）。必须以"的"开头，8个字以内',
        anonName: '这个角色在匿名论坛上会用的马甲昵称，跟上面的网名要不一样，更随意、更藏得住身份。10个字以内',
        anonId: '匿名论坛的短ID，4到6位大写字母数字混合（例如 K7F2Q）'
    };
    const want = blanks.filter(k => fieldDesc[k]);
    if (want.length === 0) return null;

    // 💰⏱️ 修"角色简介生成特别慢"：导入的角色卡人设动辄四五千字，整份发过去既慢又贵，
    // 而补全这几个字段（名字/ID/简介/所在地/生日/粉丝数）只需要知道这个人大概是谁，
    // 开头那一段就足够了。超长的截断到 1200 字，实测生成时间大幅缩短、结果质量没有可感知的下降。
    const personaForFill = String(persona || '').length > 1200
        ? String(persona).slice(0, 1200) + '\n（人设后面还有更多内容，这里只截取开头用于补全资料）'
        : persona;
    // ⚠️ 这里的提示词换过一版。以前的写法（"根据人设补全资料字段"）会让模型
    //    **把人设复述一遍填进去**——简介变成人设第一段的缩写、网名就是人设里的本名、
    //    自动回复像旁白。那不是这个人在写自己的资料，那是旁观者在做摘要。
    //    现在明确要求：**你就是这个人，在自己手机上填这几栏**。
    //    这一句改动带来的差别比换模型还大。
    const prompt = `你现在**就是**下面这个人。你正在自己的手机上，填社交平台的个人资料。

【你是谁】
${personaForFill}

要填的几栏：
${want.map(k => `- ${k}：${fieldDesc[k]}`).join('\n')}

【怎么填 —— 这是最重要的部分】
· 你是在**填自己的资料**，不是在给自己写简介、更不是复述你的设定。
  想一想：以你的性格，你会怎么在这几栏里介绍自己？会不会避重就轻？会不会写句玩笑？
  会不会干脆写点跟正事无关的（"今天也没睡好"）？
· **不要照抄人设里的句子**，也不要把人设浓缩成一段。人设是"别人怎么描述你"，
  资料栏是"你怎么呈现自己"，这两件事经常不一样，有时甚至是相反的：
  设定上很惨的人，简介里可能特别轻松；很厉害的人，可能一个字都不提自己的成就。
· 内敛的人会写得短、含糊、留白；张扬的人会写得满；不在乎这些的人会随便写点什么。
  照着这个人的性格来，别所有人都写成一样工整的自我介绍。
· 这些是主页上公开展示的东西，正常人不会大片留空。人设里没直说的，按ta的身份和生活
  合理推断一个——这不算瞎编，这叫补全。
· 唯一例外是 birthdate：生日是硬事实，人设里没提到就必须留空，绝对不要编一个日期。

严格只返回一个JSON对象，不要有任何其它文字、不要Markdown代码块。键名就用上面的英文字段名。
示例：{${want.map(k => `"${k}": "..."`).join(', ')}}
不要写任何思考过程、解释或前后缀，第一个字符就是 { ，最后一个字符就是 }。`;

    try {
        // ⚠️ max_tokens 曾经是 400，本意是"只要一小段 JSON，别让模型长篇大论"。
        // 但碰上推理模型（deepseek-reasoner / QwQ / 各种带 thinking 的中转）就是灾难：
        // 400 个 token 全被 <think> 吃掉，正文一个字都没输出，于是每次点补全都失败，
        // 而且报的是"可能是API没配好"，跟真实原因八竿子打不着。
        // 现在给到 1500：够思考几句，也够把这十来个字段的 JSON 写完；非推理模型本来就用不到这么多，
        // 按实际输出计费，不会平白变贵。
        const data = await sendChatRequest(api, prompt, { max_tokens: 1500 });
        if (data && data.error) return { __error: 'API 返回了错误：' + (data.error.message || data.error) };
        const raw = data.choices?.[0]?.message?.content || '';
        if (!raw.trim()) return { __error: '模型这次什么都没返回（可能是被服务商截断了）。' };
        const parsed = (typeof parseModelJson === 'function') ? parseModelJson(raw) : extractJsonObject(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        // 只吐了思考过程、没给结果：这是推理模型最典型的失败，要单独说清楚，
        // 不然用户只会觉得"这个按钮是坏的"。
        if (/<(think|thinking|reasoning|thought)\b/i.test(raw)) {
            return { __error: '模型只输出了思考过程就被截断了，没给出结果。换一个非推理模型（或在服务商那边关掉 thinking）再试。' };
        }
        return { __error: '模型返回的内容不是 JSON，没法用：' + raw.replace(/\s+/g, ' ').slice(0, 60) + '…' };
    } catch (e) {
        console.warn('[角色资料自动补全] 失败：', e);
        return { __error: '请求出错了：' + (e.message || e) };
    }
}

// 把表单里空着的字段补上。manual=true 表示是用户手动点了"自动补全"按钮（会给出提示反馈）。
async function autoFillCharProfile(manual = false) {
    const $ = id => document.getElementById(id);
    const persona = ($('charPersona')?.value || '').trim();
    if (!persona) { if (manual) alert('请先填写「角色人设」，自动补全是照着人设来的。'); return false; }

    // 先白捡：生日能直接从人设里认出来就不劳烦AI了
    const filledLocally = [];
    if ($('charBirthdate') && !$('charBirthdate').value) {
        const bd = extractBirthdateFromPersona(persona);
        if (bd) { $('charBirthdate').value = bd; filledLocally.push('生日'); }
    }

    const map = { charName: 'name', charHandle: 'handle', charBio: 'bio', charLocation: 'location',
                  charWebsite: 'website', charBirthdate: 'birthdate', charFollowers: 'followers', charFollowing: 'following',
                  charAutoReply: 'autoReply', charBusyAutoReply: 'busyAutoReply', charNudgeText: 'nudgeText',
                  charAnonName: 'anonName', charAnonId: 'anonId' };
    const blanks = Object.keys(map).filter(id => $(id) && !String($(id).value).trim());
    // 蓝V是个复选框，没有"空/非空"的概念，所以单独处理：只要这次要请求 AI，就顺带让它判断一下
    // （不额外多花一次调用）。用户自己已经勾上了就尊重用户的选择，不去动它。
    const verifiedEl = $('charVerified');
    const wantVerified = !!(verifiedEl && !verifiedEl.checked);
    if (blanks.length === 0) {
        if (manual) alert(filledLocally.length ? `已从人设里认出：${filledLocally.join('、')}` : '资料都填好了，没有需要补全的空白项。');
        return true;
    }

    const btn = $('autoFillCharBtn');
    const oldText = btn ? btn.innerText : '';
    if (btn) { btn.innerText = '正在照着人设补全...'; btn.disabled = true; }

    const askFields = blanks.map(id => map[id]);
    if (wantVerified) askFields.push('verified');
    const result = await aiCompleteCharProfile(persona, askFields);

    if (btn) { btn.innerText = oldText; btn.disabled = false; }

    if (!result || result.__error) {
        const why = (result && result.__error) || '这次请求没成功。';
        // 手动点的一定要告诉用户为什么；自动触发的（保存角色时顺带补全）只记日志，不打断保存
        if (manual) { if (typeof appAlert === 'function') appAlert('没能补全：' + why); else alert('没能补全：' + why); }
        else console.warn('[角色资料自动补全] ' + why);
        return false;
    }

    const filled = [];
    blanks.forEach(id => {
        const key = map[id];
        let v = result[key];
        if (v === undefined || v === null) return;
        v = String(v).trim();
        if (!v) return;
        if (key === 'handle') v = v.replace(/^@+/, ''); // 保存时会统一加@，这里先去掉免得变成@@
        if (key === 'birthdate' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return; // 格式不对就不填，免得日期控件报错
        // 拍一拍后缀会被直接拼进「A 拍了拍 B ___」这句话里，不以"的"开头会读不通（"拍了拍 肩膀"）。
        // AI 偶尔会漏掉这个字，这里补上；带句读标点的不像后缀，宁可不填。不限长度。
        if (key === 'nudgeText') {
            v = v.replace(/^[的]?/, '的');
            if (/[。！？!?,，、\n]/.test(v)) return;
        }
        if (key === 'anonId') v = v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
        // 保险：AI 仍然返回"1.2万"这类写法时，用项目里现成的 parseStat 换算成整数，
        // 否则 number 输入框会静默吃掉这个值，最后落到默认的"1万"。
        if ((key === 'followers' || key === 'following') && $(id).type === 'number' && !/^\d+$/.test(v)) {
            const n = typeof parseStat === 'function' ? parseStat(v) : parseInt(v);
            if (!n || isNaN(n)) return;
            v = String(Math.round(n));
        }
        $(id).value = v;
        filled.push(id);
    });
    // 蓝V：AI 认为这个人设是公众人物才勾上
    if (wantVerified && verifiedEl) {
        const vv = result.verified;
        const on = (vv === true) || (typeof vv === 'string' && /^(true|是|yes|1)$/i.test(vv.trim()));
        if (on) { verifiedEl.checked = true; filled.push('charVerified'); }
    }

    if (manual) {
        const label = { charName: '用户名', charHandle: '账号ID', charBio: '简介', charLocation: '所在地',
                        charWebsite: '网站', charBirthdate: '生日', charFollowers: '粉丝数', charFollowing: '关注数',
                        charVerified: '官方认证标志', charAutoReply: '自动回复', charBusyAutoReply: '忙碌自动回复',
                        charNudgeText: '拍一拍后缀', charAnonName: '匿名昵称', charAnonId: '匿名ID' };
        const all = filledLocally.concat(filled.map(id => label[id]));
        alert(all.length ? `已补全：${all.join('、')}\n\n都可以再手动改。` : '这次没能补出什么，可以手动填一下。');
    }
    return true;
}

async function saveCharacter() {
    let persona = document.getElementById('charPersona').value;
    // 现在只有「人设」是必填的。用户名/账号ID/简介/生日这些留空的话，下面会照着人设自动补全，
    // 不用再逼着用户把表单填满才能保存。
    if (!persona.trim()) return alert('「角色人设」是必填项——其它资料留空的话，会照着人设自动补全。');

    // 🆕 多角色排队导入时，这次保存完还要不要自动接着填下一个——存在这，函数末尾读
    const wasCreatingNew = !editingCharId;

    const btn = document.getElementById('saveCharBtn');

    // ⚠️ 这里以前会**在保存时顺手调一次 API 去补全空白项**。两个毛病：
    //   ① 点「保存」要等好几秒，还悄悄花一次钱，而你只是想改个名字；
    //   ② 补全是整表回填，实际用起来经常把你刚敲进去的内容顶掉。
    // 现在保存就是保存：**点了立刻存，一个字都不动，一次 API 都不调**。
    // 想补全就点表单里那颗「✨ 照着人设补全空白资料」，那才是补全的入口。

    let name = document.getElementById('charName').value.trim();
    let handle = document.getElementById('charHandle').value.trim();
    // 补全也可能没补出来（没配API、请求失败、AI返回空）——这时候给个能用的兜底，
    // 而不是把用户卡在这里不让保存。
    // 名字/账号留空的兜底：本地生成，不调 API（想要像样的就去点那颗补全按钮）
    if (!name) name = persona.trim().slice(0, 6).replace(/[\s\n]/g, '') || '新角色';
    if (!handle) handle = 'user_' + Math.random().toString(36).slice(2, 8);
    if (!handle.startsWith('@')) handle = '@' + handle;
    document.getElementById('charName').value = name;
    document.getElementById('charHandle').value = handle;

    btn.innerText = "保存中..."; btn.disabled = true;

    let selectedWbs = Array.from(charFormWbPendingSelection);

    let freqInterval = parseInt(document.getElementById('freqInterval').value) || 1;
    let freqUnit = document.getElementById('freqUnit').value;
    let freqCount = parseInt(document.getElementById('freqCount').value) || 1;
    let chatFreqInterval = parseInt(document.getElementById('chatFreqInterval').value) || 0;
    let chatFreqUnit = document.getElementById('chatFreqUnit').value;
    let letterFreqInterval = parseInt(document.getElementById('letterFreqInterval').value) || 0;
    let letterFreqUnit = document.getElementById('letterFreqUnit').value;
    let forumFreqInterval = parseInt(document.getElementById('forumFreqInterval').value) || 0;
    let forumFreqUnit = document.getElementById('forumFreqUnit').value;
    let anonFreqInterval = parseInt(document.getElementById('anonFreqInterval').value) || 0;
    let anonFreqUnit = document.getElementById('anonFreqUnit').value;

    if (editingCharId) {
        let char = myCharacters.find(c => c.id == editingCharId);
        if (char) {
            char.name = name; char.handle = handle; char.persona = persona;
            { const __oldBio = char.bio; char.bio = document.getElementById('charBio').value; if (typeof window.gyBioRemember === 'function') window.gyBioRemember(char, __oldBio); } char.followers = document.getElementById('charFollowers').value || char.followers;
            char.following = document.getElementById('charFollowing').value || char.following; char.location = document.getElementById('charLocation').value;
            char.website = document.getElementById('charWebsite').value; char.birthdate = document.getElementById('charBirthdate').value;
            char.verified = document.getElementById('charVerified').checked; setCharFactions(char, readCharFormFactions());
            // 👤 绑定表存在 charUserPersona 里（不写进角色对象），选"跟随当前资料"就删掉这条绑定
            {
                const pv = document.getElementById('charUserPersonaSelect')?.value || '';
                if (pv) charUserPersona[String(char.id)] = pv; else delete charUserPersona[String(char.id)];
            }
            
            if (tempCropResults.charAvatar) char.avatarImg = tempCropResults.charAvatar;
            if (tempCropResults.charBg) char.bgImg = tempCropResults.charBg;

            char.postFreq = { interval: freqInterval, unit: freqUnit, count: freqCount };
            char.chatFreq = { interval: chatFreqInterval, unit: chatFreqUnit };
            char.letterFreq = { interval: letterFreqInterval, unit: letterFreqUnit };
            char.forumPostFreq = { interval: forumFreqInterval, unit: forumFreqUnit };
            char.anonPostFreq = { interval: anonFreqInterval, unit: anonFreqUnit };
            char.actMode = (document.getElementById('charActMode')?.value === 'auto') ? 'auto' : 'fixed';
            char.autonomyMinMinutes = gyNum(document.getElementById('autonomyMinMinutes')?.value, 30);
            char.autonomyMaxHours = gyNum(document.getElementById('autonomyMaxHours')?.value, 8);
            char.webMode = document.getElementById('charWebMode')?.value || 'default';
            char.webGapMin = gyNum(document.getElementById('charWebGap')?.value, 0);
            char.webPerDay = gyNum(document.getElementById('charWebPerDay')?.value, 0);
            char.ownDaysMode = document.getElementById('charOwnDaysMode')?.value || 'default';
            // 刚切到自主模式：现在就给 TA 掷一个"下次什么时候"，而不是立刻就动
            if (char.actMode === 'auto' && !char.nextAutonomyAt && typeof gyRollAutonomyGap === 'function') {
                char.nextAutonomyAt = Date.now() + gyRollAutonomyGap(char);
            }
            char.autoReplyText = document.getElementById('charAutoReply').value;
            char.busyAutoReplyText = document.getElementById('charBusyAutoReply').value;
            char.anonName = document.getElementById('charAnonName').value || '匿名者';
            char.anonId = document.getElementById('charAnonId').value || Math.random().toString(36).substr(2,6).toUpperCase();
            char.nudgeText = document.getElementById('charNudgeText').value;
            char.firstMessage = document.getElementById('charFirstMessage')?.value.trim() || '';
            if (pendingImportedGreetings) { char.alternateGreetings = pendingImportedGreetings; pendingImportedGreetings = null; }
            char.worldbooks = selectedWbs;

            globalPosts.forEach(p => { if (p.char.id == char.id) { Object.assign(p.char, char); } p.replies.forEach(r => { if (r.char.id == char.id) { Object.assign(r.char, char); } }); });
        }
    } else {
        let newId = Date.now();
        window.__gyLastNewCharId = newId;   // 下面绑定导入正则用：newId 出了这个块就看不见了
        let newChar = {
            id: newId, name: name, handle: handle, persona: persona, bio: document.getElementById('charBio').value,
            followers: document.getElementById('charFollowers').value || "1万", following: document.getElementById('charFollowing').value || "100",
            location: document.getElementById('charLocation').value, website: document.getElementById('charWebsite').value, birthdate: document.getElementById('charBirthdate').value,
            isFollowing: true, isSpecialFollow: false, verified: document.getElementById('charVerified').checked, avatarEmoji: name[0] || 'A', themeColor: "#1d9bf0",
            avatarImg: tempCropResults.charAvatar || null, bgImg: tempCropResults.charBg || null,
            group: readCharFormFactions()[0] || '', groups: readCharFormFactions(),
            postFreq: { interval: freqInterval, unit: freqUnit, count: freqCount }, lastPostTime: Date.now(),
            chatFreq: { interval: chatFreqInterval, unit: chatFreqUnit }, lastChatProactiveTime: Date.now(),
            letterFreq: { interval: letterFreqInterval, unit: letterFreqUnit }, lastLetterProactiveTime: Date.now(),
            forumPostFreq: { interval: forumFreqInterval, unit: forumFreqUnit }, lastForumPostTime: Date.now(),
            anonPostFreq: { interval: anonFreqInterval, unit: anonFreqUnit }, lastAnonPostTime: Date.now(),
            actMode: (document.getElementById('charActMode')?.value === 'auto') ? 'auto' : 'fixed',
            autonomyMinMinutes: gyNum(document.getElementById('autonomyMinMinutes')?.value, 30),
            autonomyMaxHours: gyNum(document.getElementById('autonomyMaxHours')?.value, 8),
            webMode: document.getElementById('charWebMode')?.value || 'default',
            webGapMin: gyNum(document.getElementById('charWebGap')?.value, 0),
            webPerDay: gyNum(document.getElementById('charWebPerDay')?.value, 0),
            ownDaysMode: document.getElementById('charOwnDaysMode')?.value || 'default',
            lastAutonomyTime: Date.now(), nextAutonomyAt: 0, autonomyLog: [], todos: [],
            autoReplyText: document.getElementById('charAutoReply').value, busyAutoReplyText: document.getElementById('charBusyAutoReply').value,
            memorySummary: "", chatSummary: "", diaryData: { letters: [], diaries: [] }, pendingLetterReplies: [],
            anonName: document.getElementById('charAnonName').value || '匿名者', anonId: document.getElementById('charAnonId').value || Math.random().toString(36).substr(2,6).toUpperCase(), nudgeText: document.getElementById('charNudgeText').value,
            firstMessage: document.getElementById('charFirstMessage')?.value.trim() || '',
            alternateGreetings: pendingImportedGreetings || [],
            worldbooks: selectedWbs, postCount: 0
        };
        pendingImportedGreetings = null;
        myCharacters.push(newChar);
        // 👤 新建角色时选的"在这个角色面前我是谁"
        {
            const pv = document.getElementById('charUserPersonaSelect')?.value || '';
            if (pv) charUserPersona[String(newChar.id)] = pv;
        }
    }

    // 🆕 角色卡导入时顺带识别到的正则脚本，此时角色id才刚确定下来，回头把charScope绑定成这个角色专属
    // （编辑已有角色时用editingCharId，新建角色时用刚生成的newId——两个分支互斥，用哪个都行）
    if (pendingImportedRegexScriptIds && pendingImportedRegexScriptIds.length > 0) {
        // 🐛 以前这里写的是 typeof newId——newId 是上面 else 块里的 let，这里永远看不见，
        //    结果角色卡自带的正则从来没绑上角色，所有角色都在用。
        const savedCharId = editingCharId || window.__gyLastNewCharId || null;
        if (savedCharId) {
            regexScripts.forEach(rs => { if (pendingImportedRegexScriptIds.includes(rs.id)) { const cur = Array.isArray(rs.charScope) ? rs.charScope.map(String) : []; rs.charScope = cur.includes(String(savedCharId)) ? rs.charScope : (rs.charScope || []).concat([savedCharId]); } });
        }
        pendingImportedRegexScriptIds = [];
    }
    window.__gyLastNewCharId = null;

    saveAllData();
    if (document.getElementById('view-home').style.display !== 'none') renderPosts();
    btn.innerText = "保存并生成角色"; btn.disabled = false;
    renderDiaryCharList();
    updateCharSelects();
    // 🆕 多角色排队导入：这一个刚存完，队列里还有没导完的，直接接着填下一个，
    // 不回角色列表页——省得你自己再点一次"创建新角色"重新走一遍导入流程。
    if (wasCreatingNew && typeof pendingCharImportQueue !== 'undefined' && pendingCharImportQueue.length > 0) {
        advanceCharImportQueue();
        return;
    }
    showRoleList();
}