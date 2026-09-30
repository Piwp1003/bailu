// ✂️ 这个文件是从 13-charreply-groupchat-faction-cardimport.js 拆出来的第 2 段（原来一个文件太大，改起来容易改坏）。
// 跟 13-charreply-groupchat-faction-cardimport.js 以及同一组的其它段共用一个全局作用域，index.html 里的加载顺序不能换。
function confirmCardSplit() {
    const picked = Array.from(document.querySelectorAll('.gyCardSplitPick:checked')).map(c => Number(c.value));
    const parts = window.__gyCardSplitParts || [], data = window.__gyCardSplitData || {}, b64Image = window.__gyCardSplitB64;
    const m = document.getElementById('gyCardSplitModal'); if (m) m.remove();
    const chosen = picked.map(i => parts[i]).filter(Boolean);
    if (!chosen.length) return;
    pendingCharImportQueue = buildSplitQueue(chosen, data, b64Image);
    advanceCharImportQueue();
}

// 把拆好的几个人做成导入队列：
// 世界书/正则脚本只跟着第一个人导入一次（不然 21 条词条会被导两遍），
// 后面几个人靠 shareWb 标记，等表单开好之后把同一批世界书自动勾上。
function buildSplitQueue(chosen, data, b64Image) {
    return chosen.map((p, i) => {
        const one = Object.assign({}, data);
        one.name = p.name;
        one.description = (p.shared ? p.shared + '\n\n' : '') + p.persona;
        if (i > 0) { delete one.character_book; one.extensions = Object.assign({}, one.extensions); delete one.extensions.regex_scripts; }
        return { type: 'card', data: one, b64Image, shareWb: i > 0 };
    });
}

// 🤖 结构拆不出来时的兜底：让 AI 照着正文把人分开（手动点才跑，一次调用）
async function gyCardSplitAi(data, b64Image) {
    const api = getApiMain();
    if (!api || !api.key) { alert('没配 API，没法让 AI 帮忙拆。'); return; }
    const desc = String((data && data.description) || '');
    if (!desc.trim()) { alert('这张卡的正文是空的，没什么可拆的。'); return; }
    alert('正在让 AI 看这张卡里到底有几个人…（正文长的话要等十几秒）');
    try {
        const prompt = `下面是一张角色卡的正文。请判断它写的是**几个角色**。
要求：
1. 只有确实写了不止一个人才拆；如果通篇就是一个角色（哪怕提到了别人的名字），返回 {"count":1,"chars":[]}。
2. 拆的时候把属于每个角色的设定**原样搬过去**，不要改写、不要概括、不要补充你自己的话。
3. 世界观、时代背景、通用规则这类大家共用的内容放进 shared，不要重复塞进每个人。
只输出合法 JSON：
{"count":数字,"shared":"公共设定（没有就空字符串）","chars":[{"name":"角色名","persona":"这个角色的全部设定原文"}]}

【卡片正文】
${desc.slice(0, 6000)}`;
        const res = await callChatCompletionAPI(api, prompt, 1);
        if (res && res.error) { alert('拆分失败：' + (res.error.message || '未知错误')); return; }
        const parsed = parseModelJson(res && res.choices?.[0]?.message?.content || '');
        const chars = parsed && Array.isArray(parsed.chars) ? parsed.chars.filter(c => c && c.name && c.persona) : [];
        if (!parsed || chars.length < 2) { alert('AI 看下来这张卡就是一个角色，没拆。'); return; }
        openCardSplitModal(chars.map(c => ({ name: c.name, persona: String(c.persona), shared: String(parsed.shared || '') })), data, b64Image);
    } catch (e) {
        alert('拆分失败：' + (e && e.message || e));
    }
}

// 📥 把单个角色的卡片数据（JSON已解析好的 data 对象）真正填进新建角色表单——
// 原来这段逻辑是写死在 handleCharCardImport 里的，现在拆出来单独成一个函数，
// 这样"一份文件里打包了好几个角色"的排队导入也能一个个复用它，不用把逻辑抄两遍。
async function fillCharFormFromCardData(data, b64Image) {
    // 记一下这张卡的原始数据：万一结构没认出来是双人卡，你还可以在表单里手动点「让 AI 拆开」，
    // 那时候世界书/开场白这些还能顺着这份原始数据一起带过去。
    gyLastImportedCardData = data;
    // 1. 打开新建角色表单
    openFormForCreate();

    // 2. 自动填入名字
    document.getElementById('charName').value = data.name || '';
    
    // 3. 智能拼接人设 (Persona)
    let personaArr = [];
    if (data.description) personaArr.push(`【背景描述】\n${data.description}`);
    if (data.personality) personaArr.push(`【性格特点】\n${data.personality}`);
    if (data.scenario) personaArr.push(`【当前情景】\n${data.scenario}`);
    if (data.system_prompt) personaArr.push(`【角色专属系统指令】\n${data.system_prompt}`);
    if (data.post_history_instructions) personaArr.push(`【行为准则/后置指令】\n${data.post_history_instructions}`);
    if (data.extensions?.depth_prompt?.prompt) personaArr.push(`【重要提醒事项】\n${data.extensions.depth_prompt.prompt}`);
    if (data.mes_example) personaArr.push(`【对话风格范例】\n${data.mes_example}`);
    if (data.creator_notes) personaArr.push(`【作者备注】\n${data.creator_notes}`);
    
    const fullPersona = personaArr.join('\n\n');
    document.getElementById('charPersona').value = fullPersona;

    // 🌟 独家新增：让 AI 自动为你浓缩“短简介”、起好“匿名昵称”和“拍一拍文案” 🌟
    const api = getApiMain(); 
    if (api.key && fullPersona.length > 10) {
        const bioInput = document.getElementById('charBio');
        if (bioInput) bioInput.placeholder = "AI正在根据几千字人设，疯狂为您提炼短简介中... ⏳";
        
        const prompt = `你是一个出色的设定提取助手。请根据下面这段长篇角色人设，提炼出以下三项精简内容：
1. 一段适合放在社交平台主页的“个人简介（Bio）”，要求符合角色的性格特征与说话语气，千万不要超过 40 个字。
2. 一个适合该角色在匿名论坛发帖用的“马甲昵称”（如：魔法少女、暴躁老哥、打工人，2-6字）。
3. 当别人在微信里“拍了拍”该角色时，显示的动作或部位（必须以“的”字开头，如：的肩膀、的机械臂，不超过6字）。

【角色人设】：
${fullPersona.substring(0, 1500)}

必须且只能返回合法的 JSON 格式，不要加任何废话和前缀：
{"bio": "提取的短简介", "anonName": "提取的昵称", "nudgeText": "拍一拍文本"}`;

        sendChatRequest(api, prompt).then(resData => {
            let text = resData.choices?.[0]?.message?.content?.trim() || "";
            text = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
            try {
                let parsed = JSON.parse(text);
                // 等AI想好了，瞬间自动填入格子中！
                if (parsed.bio && !bioInput.value) bioInput.value = parsed.bio;
                if (parsed.anonName && !document.getElementById('charAnonName').value) document.getElementById('charAnonName').value = parsed.anonName;
                if (parsed.nudgeText && !document.getElementById('charNudgeText').value) document.getElementById('charNudgeText').value = parsed.nudgeText;
            } catch(e) {}
        }).catch(e => console.log("AI提炼资料失败", e));
    }
    // 4. 将第一句话(First Message)完美无损提取
    // 有些卡的 first_mes 只是个占位标签（比如字面意思就是"【开场白】"这几个字），
    // 真正的开场白正文其实放在 alternate_greetings 里——不加判断直接用 first_mes 会导致
    // 聊天里显示的是这个占位文字本身，而不是真正的开场白。
    function looksLikePlaceholder(text) {
        if (!text) return true;
        const stripped = text.replace(/[【】\[\]()（）\s：:]/g, '');
        return stripped.length <= 6; // 去掉括号/空白后几乎没剩什么字，大概率只是个标签
    }
    let fm = data.first_mes || '';
    const altGreetings = Array.isArray(data.alternate_greetings) ? data.alternate_greetings.filter(g => g && g.trim()) : [];
    let usedAlternateFallback = false;
    if (looksLikePlaceholder(fm) && altGreetings.length > 0) {
        fm = altGreetings[0];
        usedAlternateFallback = true;
    }
    if (fm && fm.trim()) {
        // 智能探测你网页中实际使用的“开场白”输入框 ID
        const targetEl = document.getElementById('charGreeting') 
                      || document.getElementById('charFirstMessage') 
                      || document.getElementById('charFirstMes') 
                      || document.getElementById('charOpening')
                      || document.getElementById('charAutoReply');
                      
        if (targetEl) {
            targetEl.value = fm;
        } else {
            // 💡 终极兜底：如果你发现自己的编辑界面根本没有“开场白”这个格子，
            // 它会自动把开场白拼接到“人设/Persona”框的最下面，保证数据绝对不丢失！
            const personaEl = document.getElementById('charPersona');
            if (personaEl) {
                personaEl.value += `\n\n【角色开场白 / First Message】\n${fm}`;
            }
        }
    }
    // 保存全部候选开场白（哪怕这次用的是兜底逻辑选出来的那条），角色存好后可以在聊天里长按头像切换
    if (altGreetings.length > 0) {
        pendingImportedGreetings = altGreetings;
        if (usedAlternateFallback && altGreetings.length > 1) {
            setTimeout(() => alert(`💡 这张角色卡的"开场白"字段只是个占位标签，已自动改用卡里的候选开场白之一（一共有${altGreetings.length}个）。保存角色后，长按ta的头像可以随时切换成其它候选开场白重新开始。`), 400);
        }
    }

    // 5. 自动将读取到的图片做成头像！
    if (b64Image) {
        tempCropResults.charAvatar = b64Image;
        const preview = document.getElementById('charAvatarPreview');
        if (preview) { preview.src = b64Image; preview.style.display = 'block'; }
    }

    // 6. 智能侦测并挂载【世界书 Lorebook】—— 每条词条单独导入一本世界书，保留各自的关键词/优先级/递归设置，
    //    而不是把所有条目合并成一大坨（合并会丢失"哪条关键词触发哪段内容"的精确对应关系，还容易被字数上限截断）。
    let importedWbCount = 0, importedWbIds = [];
    if (data.character_book && data.character_book.entries && data.character_book.entries.length > 0) {
        const totalEntries = data.character_book.entries.length;
        if (await appConfirm(`🎉 角色读取成功！\n系统检测到该角色卡内嵌了 ${totalEntries} 条世界观设定(Lorebook)。\n是否自动将其逐条导入到白露的世界书中，并统一归到"${data.name || '导入角色'}"这个分组里？`)) {
            // 📁 角色卡自带的世界书统一归到"该角色名字"这个分组下，而不是沿用卡片原始的 extensions.group
            // （原卡那个字段是SillyTavern自己的分类习惯，导过来的意义不大；按角色名分组更符合"这是TA的专属设定"
            // 这个直觉，同一张卡再导入一次/别的角色卡也不会互相混在一起）。分组名不存在就顺手建一个。
            const charGroupName = (data.name || '导入角色').trim() || '导入角色';
            if (charGroupName && !worldbookCategories.includes(charGroupName)) worldbookCategories.push(charGroupName);
            data.character_book.entries.forEach(entry => {
                if (!entry.content) return; // 空内容的词条没有导入的意义，跳过
                // 注意：enabled:false 的词条不再跳过，而是照样导入并标记 enabled:false ——
                // 常见于"仅供插件按标题精确查询(getwi)"的高级卡片写法（比如按好感度分档的文案，
                // 关掉自动触发、只留标题给脚本按条件取用），完全跳过会导致这类卡片的核心玩法哑火。
                const keys = Array.isArray(entry.keys) ? entry.keys.filter(Boolean) : [];
                const wbId = Date.now() + Math.floor(Math.random() * 1000000);
                worldbooks.push({
                    id: wbId,
                    title: entry.comment || (keys[0] ? `关于"${keys[0]}"` : `${data.name || '导入角色'}的设定`),
                    content: entry.content,
                    isGlobal: false,
                    weight: typeof entry.insertion_order === 'number' ? Math.max(0, Math.min(100, entry.insertion_order)) : 50,
                    keywords: entry.constant ? '' : keys.join(','), // constant=true 代表原卡里就是"无条件生效"
                    priority: entry.insertion_order || 0,
                    category: charGroupName, // 🐛 修复：之前误写成了 group（那是"互斥分组"字段，会导致同一张卡的词条互相排斥、大部分永远不触发），
                                              // category 才是世界书列表左侧筛选栏实际用来分类展示的字段
                    recursive: entry.extensions ? !entry.extensions.exclude_recursion : false,
                    enabled: entry.enabled !== false // false=卡片作者主动关掉了自动触发，但仍可被按标题精确查询到
                });
                importedWbIds.push(wbId);
                importedWbCount++;
            });
        }
    }

    // 7. 智能侦测并导入【正则脚本 Regex Scripts】—— 部分角色卡/导出工具会把正则脚本一起塞进 data.extensions.regex_scripts
    let importedRegexCount = 0;
    const embeddedRegex = data.extensions?.regex_scripts;
    if (Array.isArray(embeddedRegex) && embeddedRegex.length > 0) {
        if (await appConfirm(`🎉 还检测到该角色卡内嵌了 ${embeddedRegex.length} 条正则脚本（多半是配合状态栏/HTML小组件用的）。\n是否一并导入？导入后会自动绑定成"只在这个角色自己发帖/评论/续写/日记/小说/论坛时才生效"，不会影响你其它角色的内容。`)) {
            // 🐛 修复：这里原来是照抄的一份简化版映射，漏掉了 displayOnly/promptOnly/minDepth/maxDepth 几个字段——
            // 这几个字段不填就是 undefined，而 applyDisplayOnlyRegex/applyPromptOnlyRegex 是严格按
            // "displayOnly===true"/"promptOnly===true" 来筛选生效范围的，undefined 两边都对不上，
            // 导致角色卡自带的正则脚本导入后哪怕显示是"已启用"，实际上也永远不会真正生效。
            // 改成复用 mapStRegexScriptItem（跟"导入预设"用的是完全同一套映射逻辑），字段给全，
            // 同时也保留了"按角色卡自己标记的disabled状态导入，而不是不管三七二十一全部打开"这个行为。
            //
            // 🆕 这批脚本先记下id存进 pendingImportedRegexScriptIds，此时角色卡还只是填在表单里、
            // 还没真正保存出一个角色id——等 saveCharacter() 里角色真正确定id之后，再回过头把这些脚本的
            // charScope 绑定成那一个角色专属，默认就不会影响其它角色（跟这批脚本本来的设计意图一致）。
            embeddedRegex.forEach(rs => {
                const mapped = mapStRegexScriptItem(rs);
                if (!mapped) return;
                regexScripts.push(mapped);
                pendingImportedRegexScriptIds.push(mapped.id);
                importedRegexCount++;
            });
            // 双人卡拆开导入：后面几个人也要用上这批正则（状态栏往往是两个人写在一起的）
            window.__gyLastImportedRegexIds = pendingImportedRegexScriptIds.slice();
            // 卡片里引用的网络图片顺手存到本地（后台慢慢下，不耽误你填表）
            try { if (typeof window.gyLocalizeRegexAssets === 'function') window.gyLocalizeRegexAssets(pendingImportedRegexScriptIds.slice(), true); } catch (e) {}
        }
    }

    if (importedWbCount > 0 || importedRegexCount > 0) {
        saveAllData();
        // 🆕 记下这一批世界书的 id：一张双人卡拆开导入时，世界书只在第一个人那儿导入一次，
        // 后面几个人靠这个记录把同一批世界书自动勾上（他们本来就住在同一个世界里）。
        gyLastImportedWbIds = importedWbIds.slice();
        // 自动在多选框里把这些新诞生的世界书勾选上
        setTimeout(() => {
            // 合并进已有的勾选集合，而不是整个覆盖——避免把角色卡导入前用户已经手动勾好的其它世界书冲掉
            importedWbIds.forEach(id => charFormWbPendingSelection.add(id));
            if (typeof renderCharFormWbCheckboxes === 'function') renderCharFormWbCheckboxes();
            if (typeof renderRegexScriptsList === 'function') renderRegexScriptsList();
        }, 300);
        alert(`✅ 导入成功：${importedWbCount > 0 ? `${importedWbCount} 条世界书词条` : ''}${importedWbCount > 0 && importedRegexCount > 0 ? '、' : ''}${importedRegexCount > 0 ? `${importedRegexCount} 条正则脚本` : ''}。\n世界书已自动为这个角色勾选；正则脚本在"设置 → AI增强功能"里能看到。\n请浏览下方表格，没问题后点击最底部的【保存并生成角色】即可。`);
        return;
    }
    
    alert("🎉 角色卡读取成功！请浏览下方表格，没问题后点击最底部的【保存并生成角色】即可。");
}

// 🆕 头像识图检测的开关：挂进"设置 → 后台自动功能"总控页，跟别的功能同一套规矩——
// 有额外调用成本的自动检测都默认关着，手动按钮不受限制随时能查。
(function registerCardImportSwitches() {
    try {
        if (typeof AUTO_FEATURE_GROUPS !== 'undefined' && Array.isArray(AUTO_FEATURE_GROUPS)
            && !AUTO_FEATURE_GROUPS.some(g => g.key === '角色卡')) {
            AUTO_FEATURE_GROUPS.push({ key: '角色卡', icon: '🪪', title: '导入角色卡 / 头像',
                note: '导入角色卡、上传头像图片时，要不要顺手多花一次调用去检测点什么。默认关着，导入照样能用，只是少几个智能提示；旁边手动按钮不受这个限制，随时能查。' });
        }
        if (typeof AUTO_FEATURE_DEFS !== 'undefined' && Array.isArray(AUTO_FEATURE_DEFS)
            && !AUTO_FEATURE_DEFS.some(d => d.key === 'charImgMultiDetect')) {
            AUTO_FEATURE_DEFS.push({
                key: 'charImgMultiDetect',
                label: '导入头像时自动检测是否不止一个角色',
                desc: '选头像图片、或者导入角色卡图片没读到内嵌数据时，顺手识图问一眼"这张图是不是画了不止一个角色"，是的话弹出来问你要不要拆成几个角色分别导入（自己拆 / AI帮忙写草稿 两种都能选）。默认关，不打开就不会多花这次调用；旁边一直有个手动按钮可以随时查，不受这个开关限制。',
                cost: '每次触发一次识图调用',
                defaultOff: true,
                group: '角色卡',
                where: '角色中心 → 创建/编辑角色 → 头像上传旁边'
            });
        }
        if (typeof AUTO_FEATURE_DEFS !== 'undefined' && Array.isArray(AUTO_FEATURE_DEFS)
            && !AUTO_FEATURE_DEFS.some(d => d.key === 'cardSplitAsk')) {
            AUTO_FEATURE_DEFS.push({
                key: 'cardSplitAsk',
                label: '双人卡/多人卡自动问"要不要拆开"',
                desc: '不少角色卡名字写成"A&B"，正文里其实是两个人的完整设定。不拆的话他们会被当成同一个人导进来——一个账号、一套人设、关系网里也只有一个点。打开之后，导入时先按正文结构认一下有几个人（纯本地判断，一次 API 都不调），认出来不止一个就问你要不要分开导入。默认开着，因为它不花钱，而且不问的话你根本不会发现导错了。',
                cost: '不调 API（纯本地读正文结构）',
                group: '角色卡',
                where: '角色中心 → 导入角色卡时自动弹'
            });
        }
    } catch (e) {}
})();

// ==========================================
// 📦 多角色导入队列 —— 一次导入里可能要接连建好几个角色
// （一份卡文件本身打包了多个角色 / 一张图里拆出了多个角色），
// 存好一个之后自动接着填下一个，不用你自己一遍遍点"创建新角色"再重新走一遍导入。
// ==========================================
let pendingCharImportQueue = [];
let gyLastImportedWbIds = [];   // 拆开导入时，第一个人导进来的那批世界书 id，后面几个人照着勾
let gyLastImportedCardData = null;  // 最近一次导入的那张卡的原始数据（手动让 AI 拆的时候要用）

// 表单里那颗「✂️ 让 AI 拆开」：拿当前人设框里的文字去拆（所以手动粘进去的长人设也能拆），
// 如果这段人设是从卡片导进来的，世界书/开场白这些还会顺着原卡数据一起带过去。
function gyCardSplitAiFromForm() {
    const persona = (document.getElementById('charPersona') || {}).value || '';
    if (!persona.trim()) { alert('人设框是空的，没什么可拆的。'); return; }
    if (persona.length < 300) { alert('这段人设才 ' + persona.length + ' 个字，不太像塞了好几个人。真要拆的话，先把完整设定贴进去。'); return; }
    const base = gyLastImportedCardData || {};
    const name = (document.getElementById('charName') || {}).value || base.name || '';
    const data = Object.assign({}, base, { name, description: persona });
    // 先本地试一次结构拆分（免费），拆得出来就不花那次调用了
    const local = splitCardPersonaByCharacter(data);
    if (local && local.length > 1) { openCardSplitModal(local, data, tempCropResults.charAvatar || null); return; }
    gyCardSplitAi(data, tempCropResults.charAvatar || null);
}

function detectMultiCharList(charData) {
    const looksChar = x => x && typeof x === 'object' && (x.name || (x.data && x.data.name));
    if (Array.isArray(charData)) {
        const items = charData.filter(looksChar);
        return items.length > 1 ? items : null;
    }
    if (charData && typeof charData === 'object') {
        for (const key of ['characters', 'chars', 'cards', 'character_list', 'members']) {
            if (Array.isArray(charData[key])) {
                const items = charData[key].filter(looksChar);
                if (items.length > 1) return items;
            }
        }
    }
    return null;
}

function openMultiCardPickerModal(list, b64Image) {
    const rows = list.map((d, i) => {
        const nm = (d && (d.name || (d.data && d.data.name))) || `角色${i + 1}`;
        const rawDesc = (d && (d.description || (d.data && d.data.description))) || '';
        const desc = String(rawDesc).slice(0, 60) + (String(rawDesc).length > 60 ? '…' : '');
        return `<label style="display:flex; gap:8px; align-items:flex-start; padding:8px 10px; border:1px solid #eee; border-radius:8px; margin-bottom:6px; font-size:13px; cursor:pointer;">
            <input type="checkbox" class="gyMultiCardPick" value="${i}" checked style="margin-top:3px;">
            <span><b>${escapeHtml(nm)}</b><br><span style="color:#536471;">${escapeHtml(desc)}</span></span>
        </label>`;
    }).join('');
    const html = `
    <div id="gyMultiCardModal" style="position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:99999; display:flex; align-items:center; justify-content:center;">
      <div style="background:#fff; border-radius:14px; max-width:420px; width:92%; max-height:80vh; overflow:auto; padding:18px;">
        <h3 style="margin:0 0 8px; color:#1d9bf0;">📦 这份文件里打包了 ${list.length} 个角色</h3>
        <div style="font-size:13px; color:#536471; margin-bottom:10px;">SillyTavern 规范一张卡本该只有一个角色，但这份文件里检测到不止一个。勾选要导入的——存好一个自动接着填下一个：</div>
        ${rows}
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="btn-secondary" style="flex:1;" onclick="document.querySelectorAll('.gyMultiCardPick').forEach(c=>c.checked=!c.checked)">反选</button>
          <button class="btn-post" style="flex:2;" onclick="confirmMultiCardPickerModal()">开始导入选中的</button>
        </div>
        <button class="btn-secondary" style="width:100%; margin-top:8px;" onclick="document.getElementById('gyMultiCardModal').remove()">取消，什么都不导</button>
      </div>
    </div>`;
    const old = document.getElementById('gyMultiCardModal'); if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    window.__gyMultiCardList = list; window.__gyMultiCardB64 = b64Image;
}
function confirmMultiCardPickerModal() {
    const checked = Array.from(document.querySelectorAll('.gyMultiCardPick:checked')).map(c => Number(c.value));
    const list = window.__gyMultiCardList || [];
    const b64Image = window.__gyMultiCardB64;
    const picked = checked.map(i => list[i]).filter(Boolean);
    const modal = document.getElementById('gyMultiCardModal'); if (modal) modal.remove();
    if (!picked.length) return;
    pendingCharImportQueue = picked.map(d => ({ type: 'card', data: (d && d.data) || d, b64Image }));
    advanceCharImportQueue();
}

// 🔍 头像图里是不是画了不止一个角色——检测 + 顺手让AI给每个角色起名字写一版人设草稿（同一次调用一起要，不用多花一次钱）。
// opts.manual=true：手动点按钮触发，不受开关限制、没检测出多个也会弹提示告诉你结果。
// opts.manual=false（默认）：导入头像时顺带自动查一次，受开关 charImgMultiDetect 控制，默认关；查不出来也安安静静，不打扰你。
async function gyMaybeDetectMultiChar(b64Image, opts) {
    opts = opts || {};
    if (!b64Image) { if (opts.manual) alert('还没有头像图，先选一张图再检测。'); return; }
    if (!opts.manual && !(typeof isAutoOn === 'function' && isAutoOn('charImgMultiDetect'))) return;
    const api = getApiMain();
    if (!api || !api.key) { if (opts.manual) alert('没配 API，没法识图检测。'); return; }
    const btn = opts.manual ? document.getElementById('gyMultiCharCheckBtn') : null;
    if (btn) { btn.disabled = true; btn.innerText = '🔍 识图中…'; }
    try {
        const prompt = `这是一张虚构角色的插画/头像图。请判断图里到底画了几个不同的角色——同一个角色的不同角度/局部算1个，纯背景装饰或道具不算角色。
只输出合法 JSON，不要任何其它文字：
{"count": 数字, "chars": [{"pos":"这个角色在图里的位置，简短方位词，比如'左边'/'后面那个'", "name":"给TA起个2-4字的名字，纯靠画风气质猜，别写未知", "hint":"外观特征一两句话，比如发色瞳色服装氛围", "personaDraft":"以此为基础写一段40到80字的角色人设草稿，正经口吻，不要提这是一张图/插画这类话"}]}
如果只有1个角色，chars 给1项，pos 写"整张图"。`;
        const data = await callChatCompletionAPI(api, prompt, 1, [b64Image]);
        const raw = data && data.choices?.[0]?.message?.content || '';
        if (data && data.error) { if (opts.manual) alert('识图失败：' + (data.error.message || '未知错误')); return; }
        const parsed = (typeof parseModelJson === 'function') ? parseModelJson(raw) : JSON.parse(raw);
        const chars = parsed && Array.isArray(parsed.chars) ? parsed.chars : [];
        const count = (parsed && Number(parsed.count)) || chars.length;
        if (!parsed || !count) { if (opts.manual) alert('没识别出来，可能这个接口/模型不支持识图。'); return; }
        if (count <= 1) { if (opts.manual) alert('看着就是一个角色，没检测出别的人。'); return; }
        openMultiImgChoiceModal({ count, chars }, b64Image);
    } catch (e) {
        if (opts.manual) alert('识图失败：' + (e && e.message || e));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = '🔍 这张图像不止一个角色？'; }
    }
}

function openMultiImgChoiceModal(info, b64Image) {
    const list = Array.isArray(info.chars) ? info.chars : [];
    const rows = list.map((c, i) => `<div style="padding:8px 10px; border:1px solid #eee; border-radius:8px; margin-bottom:6px; font-size:13px;">
        <b>${i + 1}. ${escapeHtml(c.name || '角色' + (i + 1))}</b>（${escapeHtml(c.pos || '')}）<br>
        <span style="color:#536471;">${escapeHtml(c.hint || '')}</span>
    </div>`).join('');
    const html = `
    <div id="gyMultiImgModal" style="position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:99999; display:flex; align-items:center; justify-content:center;">
      <div style="background:#fff; border-radius:14px; max-width:420px; width:92%; max-height:80vh; overflow:auto; padding:18px;">
        <h3 style="margin:0 0 8px; color:#1d9bf0;">👀 这张图里好像不止一个角色</h3>
        <div style="font-size:13px; color:#536471; margin-bottom:10px;">AI 大概看出来 ${list.length} 个：</div>
        ${rows}
        <div style="font-size:13px; color:#536471; margin:10px 0;">要拆成 ${list.length} 个角色分别导入吗？同一张图会先放进每个角色的头像格子里，你自己再裁/换图都行。</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <button class="btn-post" onclick="gyMultiImgChoice('manual')">🖐️ 我自己来拆（自己起名写人设，先把图放进去占位）</button>
          <button class="btn-post" style="background:#f91880;" onclick="gyMultiImgChoice('ai')">🤖 AI 帮忙写草稿（名字/人设先猜一版，我再改）</button>
          <button class="btn-secondary" onclick="gyMultiImgChoice('one')">不用，就当一个角色</button>
        </div>
      </div>
    </div>`;
    const old = document.getElementById('gyMultiImgModal'); if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    window.__gyMultiImgInfo = info; window.__gyMultiImgB64 = b64Image;
}
function gyMultiImgChoice(mode) {
    const info = window.__gyMultiImgInfo, b64Image = window.__gyMultiImgB64;
    const modal = document.getElementById('gyMultiImgModal'); if (modal) modal.remove();
    if (mode === 'one' || !info) return;
    const list = Array.isArray(info.chars) ? info.chars : [];
    if (!list.length) return;
    pendingCharImportQueue = list.map(c => ({
        type: 'img',
        b64Image,
        prefillName: mode === 'ai' ? (c.name || '') : '',
        prefillPersona: mode === 'ai' ? (c.personaDraft || '') : '',
        note: c.pos || ''
    }));
    advanceCharImportQueue();
}

// 从队列里取下一个继续填表单；'card'类型复用整套角色卡填表逻辑，'img'类型（图里拆出来的）
// 只是把同一张图先放进头像格子，名字/人设看模式有没有AI草稿可用，没有就留空让你自己写。
function advanceCharImportQueue() {
    if (!pendingCharImportQueue || !pendingCharImportQueue.length) return;
    const item = pendingCharImportQueue.shift();
    const remaining = pendingCharImportQueue.length;
    if (item.type === 'card') {
        fillCharFormFromCardData(item.data, item.b64Image);
        // 同一张双人卡拆出来的第二、第三个人：世界书不再重复导入，
        // 直接把第一个人那批世界书原样勾上——他们本来就在同一个世界里。
        // 同一张卡拆出来的后几个人：卡自带的正则（状态栏/小组件）也一起绑上，不然只有第一个人的状态栏能显示
        if (item.shareWb && Array.isArray(window.__gyLastImportedRegexIds) && window.__gyLastImportedRegexIds.length) {
            try { window.__gyLastImportedRegexIds.forEach(id => { if (!pendingImportedRegexScriptIds.includes(id)) pendingImportedRegexScriptIds.push(id); }); } catch (e) {}
        }
        if (item.shareWb && gyLastImportedWbIds.length) {
            setTimeout(() => {
                try {
                    gyLastImportedWbIds.forEach(id => charFormWbPendingSelection.add(id));
                    if (typeof renderCharFormWbCheckboxes === 'function') renderCharFormWbCheckboxes();
                } catch (e) {}
            }, 350);
        }
    } else {
        openFormForCreate();
        if (item.b64Image) {
            tempCropResults.charAvatar = item.b64Image;
            const preview = document.getElementById('charAvatarPreview');
            if (preview) { preview.src = item.b64Image; preview.style.display = 'block'; }
        }
        if (item.prefillName) document.getElementById('charName').value = item.prefillName;
        if (item.prefillPersona) document.getElementById('charPersona').value = item.prefillPersona;
        setTimeout(() => alert(`📥 继续导入排队里的一个角色${item.note ? '（' + item.note + '）' : ''}。同一张图先帮你放进头像了。${remaining > 0 ? '改完保存，还剩 ' + remaining + ' 个继续排队。' : '这是最后一个了，改完保存就好了。'}`), 300);
    }
    setTimeout(() => {
        const t = document.getElementById('formTitle');
        if (t && remaining > 0) t.innerText += `（还剩 ${remaining} 个排队导入）`;
    }, 60);
}

// ==========================================
// 📤 导出角色卡为标准 PNG (兼容 SillyTavern V2 角色卡规范 chara_card_v2)
// 原理：把角色JSON整体 base64 后，塞进PNG文件里一个叫"chara"的 tEXt 数据块。
// 图片本身正常显示不受影响，别的支持这套规范的软件（酒馆等）能读出隐藏的角色数据；
// 我们自己的 handleCharCardImport 也认这种文件，所以能反复导入导出、原样往返。
// ==========================================
const PNG_CRC_TABLE = (function () {
    let table = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
    }
    return table;
})();
function pngCrc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) crc = PNG_CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}
function buildPngChunk(type, dataBytes) {
    const typeBytes = new Uint8Array(4);
    for (let i = 0; i < 4; i++) typeBytes[i] = type.charCodeAt(i);
    const len = dataBytes.length;
    const lenBytes = new Uint8Array([(len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255]);
    const crcInput = new Uint8Array(typeBytes.length + dataBytes.length);
    crcInput.set(typeBytes, 0); crcInput.set(dataBytes, typeBytes.length);
    const crc = pngCrc32(crcInput);
    const crcBytes = new Uint8Array([(crc >>> 24) & 255, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255]);
    const chunk = new Uint8Array(4 + 4 + dataBytes.length + 4);
    chunk.set(lenBytes, 0); chunk.set(typeBytes, 4); chunk.set(dataBytes, 8); chunk.set(crcBytes, 8 + dataBytes.length);
    return chunk;
}
// 把 base64 JSON 字符串以 tEXt("chara", base64) 的形式插进标准 PNG 的字节流里（紧跟在 IHDR 后面）。
// 前提：传入的 pngBytes 必须是"干净"的标准 PNG（签名8字节 + IHDR紧接着），这里统一用 canvas.toBlob 生成，能保证这一点。
function injectCharaChunkIntoPng(pngBytes, base64Json) {
    const headerEnd = 8 + (4 + 4 + 13 + 4); // PNG签名 + 完整IHDR块(len4+type4+data13+crc4)
    const head = pngBytes.slice(0, headerEnd);
    const rest = pngBytes.slice(headerEnd);
    const keyword = 'chara';
    const textData = new Uint8Array(keyword.length + 1 + base64Json.length);
    for (let i = 0; i < keyword.length; i++) textData[i] = keyword.charCodeAt(i);
    textData[keyword.length] = 0;
    for (let i = 0; i < base64Json.length; i++) textData[keyword.length + 1 + i] = base64Json.charCodeAt(i);
    const textChunk = buildPngChunk('tEXt', textData);
    const out = new Uint8Array(head.length + textChunk.length + rest.length);
    out.set(head, 0); out.set(textChunk, head.length); out.set(rest, head.length + textChunk.length);
    return out;
}
// 统一拿到一张"干净"的标准 PNG 字节流做底图：有头像就把头像居中裁剪铺满，没有头像就现画一张占位图（角色名首字+主题色）
function getStandardPngBytes(avatarDataUrl, fallbackName) {
    return new Promise((resolve, reject) => {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');

        function drawPlaceholder() {
            ctx.fillStyle = '#1d9bf0';
            ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 220px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(((fallbackName || 'A').trim()[0]) || 'A', size / 2, size / 2 + 20);
        }
        function finish() {
            canvas.toBlob(blob => {
                if (!blob) return reject(new Error('生成图片底图失败'));
                blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
            }, 'image/png');
        }

        if (avatarDataUrl) {
            const img = new Image();
            img.onload = () => {
                const side = Math.min(img.width, img.height);
                const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
                ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
                finish();
            };
            img.onerror = () => { drawPlaceholder(); finish(); };
            img.src = avatarDataUrl;
        } else {
            drawPlaceholder();
            finish();
        }
    });
}
// 真正拼装角色卡 JSON（走标准 chara_card_v2 结构）、生成 PNG 并触发下载。所有导出入口最终都走这一个函数。
async function buildAndDownloadCharCard(info) {
    const { name, persona, bio, avatarImg, firstMessage, alternateGreetings, wbIds } = info;
    if (!name || !persona) return alert('角色名字和人设不能为空，请先填写完整再导出。');

    const wbEntries = worldbooks.filter(w => (wbIds || []).includes(w.id)).map(w => ({
        keys: (w.keywords || '').split(',').map(s => s.trim()).filter(Boolean),
        content: w.content || '',
        comment: w.title || '',
        enabled: w.enabled !== false,
        constant: !w.keywords,
        insertion_order: w.priority || 0,
        extensions: { group: w.group || '' }
    }));

    const cardData = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
            name: name,
            description: persona,
            personality: '',
            scenario: '',
            first_mes: firstMessage || `你好，我是${name}。`,
            mes_example: '',
            creator_notes: bio || '',
            system_prompt: '',
            post_history_instructions: '',
            alternate_greetings: alternateGreetings || [],
            tags: [],
            creator: '',
            character_version: '1.0',
            extensions: {}
        }
    };
    if (wbEntries.length > 0) cardData.data.character_book = { name: `${name}的世界书`, entries: wbEntries };

    try {
        const jsonStr = JSON.stringify(cardData);
        // 中文/emoji 得先编码成 UTF-8 字节再 base64，直接 btoa(jsonStr) 遇到宽字符会报错
        const utf8Bytes = new TextEncoder().encode(jsonStr);
        let binary = '';
        for (let i = 0; i < utf8Bytes.length; i++) binary += String.fromCharCode(utf8Bytes[i]);
        const base64Json = btoa(binary);

        const pngBytes = await getStandardPngBytes(avatarImg, name);
        const finalBytes = injectCharaChunkIntoPng(pngBytes, base64Json);

        const blob = new Blob([finalBytes], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${name}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);

        if (typeof showToast === 'function') showToast('', '✅ 导出成功', `角色卡已生成：${name}.png，可以分享给别人，也能被 SillyTavern 等同类酒馆软件识别导入。`, null, null, false);
        else alert(`✅ 导出成功：${name}.png`);
    } catch (e) {
        console.error('导出角色卡失败', e);
        alert('导出失败：' + (e.message || e));
    }
}
// 入口①：角色列表里对某个已保存角色直接导出
function exportCharacterCard(charId) {
    const char = myCharacters.find(c => c.id == charId);
    if (!char) return alert('找不到这个角色。');
    buildAndDownloadCharCard({
        name: char.name, persona: char.persona, bio: char.bio, avatarImg: char.avatarImg || null,
        firstMessage: char.firstMessage || '', alternateGreetings: char.alternateGreetings || [], wbIds: char.worldbooks || []
    });
}
// 入口②：正在编辑的表单里直接导出（用表单里最新的内容，哪怕还没点保存）
function exportCurrentFormCharacter() {
    const name = document.getElementById('charName').value.trim();
    const persona = document.getElementById('charPersona').value.trim();
    if (!name || !persona) return alert('角色名字和人设不能为空，请先填写完整再导出。');
    buildAndDownloadCharCard({
        name, persona,
        bio: document.getElementById('charBio')?.value.trim() || '',
        avatarImg: tempCropResults.charAvatar || null,
        firstMessage: document.getElementById('charFirstMessage')?.value.trim() || '',
        alternateGreetings: pendingImportedGreetings || (editingCharId ? (myCharacters.find(c => c.id == editingCharId)?.alternateGreetings || []) : []),
        wbIds: Array.from(charFormWbPendingSelection)
    });
}
// 🩹 一次性修复：以前导入角色卡时，卡自带的正则因为一个变量作用域的 bug **从来没绑到角色上**，
// 结果每张卡的状态栏/小组件正则对所有角色都生效（A 的状态栏样式套到 B 的推文上、互相串）。
// 这里按"正则里认的那个标签（<xx_status>、【xxx】、[Header|…）出现在谁的人设/开场白/世界书里"找回主人，
// 只有能明确找到 1~3 个主人的才绑，找不到或者人人都有的（通用脚本）一律不动。只跑一次。
(function gyRebindCardRegexOnce() {
    const FLAG = 'gy_regex_rebind_v1';
    let tries = 0;
    function run() {
        try {
            if (localStorage.getItem(FLAG)) return;
            if (typeof regexScripts === 'undefined' || typeof myCharacters === 'undefined' || !Array.isArray(myCharacters)) return retry();
            if (!myCharacters.length) return retry();
            const wbs = (typeof worldbooks !== 'undefined' && Array.isArray(worldbooks)) ? worldbooks : [];
            const textOf = c => {
                let t = [c.persona, c.firstMessage, c.bio].concat(c.alternateGreetings || []).join('\n');
                if (Array.isArray(c.worldbooks)) wbs.forEach(w => { if (c.worldbooks.includes(w.id) && !w.isGlobal) t += '\n' + (w.content || ''); });
                return t;
            };
            const texts = myCharacters.map(c => ({ id: c.id, t: textOf(c) }));
            let n = 0;
            const tokOf = rs => {
                const src = String(rs.find || rs.findRegex || '');
                const m = src.match(/<\/?([A-Za-z_一-龥][\w一-龥-]{2,30})>/) || src.match(/【([^】\\]{2,20})】/) || src.match(/\\\[([A-Za-z][A-Za-z0-9_]{2,24})\\\|/);
                if (!m) return '';
                return m[0].indexOf('【') === 0 ? '【' + m[1] + '】' : (m[0].indexOf('<') === 0 ? '<' + m[1] : '[' + m[1] + '|');
            };
            // 好几张卡用了同一个标签（比如都叫【开场白】）：分不清谁是谁的，这种不动
            const seen = {};
            regexScripts.forEach(rs => { if (!rs || (Array.isArray(rs.charScope) && rs.charScope.length)) return; const t = tokOf(rs); if (t) (seen[t] = seen[t] || new Set()).add(String(rs.find || rs.findRegex || '') + '§' + String(rs.replace || '').length); });
            regexScripts.forEach(rs => {
                if (!rs || (Array.isArray(rs.charScope) && rs.charScope.length)) return;
                const tok = tokOf(rs);
                if (!tok || (seen[tok] && seen[tok].size > 1)) return;
                const owners = texts.filter(x => x.t.indexOf(tok) !== -1).map(x => x.id);
                if (owners.length >= 1 && owners.length <= 3 && owners.length < myCharacters.length) { rs.charScope = owners; n++; }
            });
            localStorage.setItem(FLAG, String(Date.now()));
            if (n) { if (typeof saveAllData === 'function') saveAllData(); console.info('[正则归位] 找回了 ' + n + ' 条角色卡正则的主人'); }
        } catch (e) { console.warn('[正则归位] 跳过：', e); }
    }
    function retry() { if (++tries < 20) setTimeout(run, 1500); }
    setTimeout(run, 4000);
})();
