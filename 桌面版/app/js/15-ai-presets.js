// ===================== AI 预设系统（仿 SillyTavern「Chat Completion 预设」） =====================
// 设计说明：
// - 一个"预设"＝一整套可以整体导入/切换/导出的提示词模块（主提示/文风/思维链/NSFW开关等）+ 采样参数，
//   对应 SillyTavern 里 Chat Completion 预设（prompts + prompt_order）这个概念。
// - 和已有的"插件"系统（js/02-databank-plugins-minigames.js 里 type:'prompt' 的插件）是两套独立体系：
//   插件面向"你自己攒的、不管用哪个预设都想要的小工具规则"，预设面向"整份从酒馆导入、成体系的大型提示词方案"。
//   两者互不冲突，生成时会把各自启用的内容都拼进最终 prompt（见 buildBasePrompt 里两个函数都会被调用）。
// - 同一时间只允许一个预设"启用中"（跟酒馆一样，切换预设是互斥单选）；未启用的预设数据完整保留在本地，
//   随时可以切回去，导入多份预设互相比较、切换非常方便。
// - 预设内部的每条提示词模块可以单独勾选启用/禁用、编辑内容、拖拽调整顺序，界面交互仿照酒馆的 Prompt Manager。

let currentEditingPresetId = null; // 当前在"预设"页面上展开查看/编辑的预设——这只是"正在看哪个"，不等于"已启用哪个"
let presetPromptDragSrcIdx = null; // 提示词条目拖拽排序时，记录拖拽起点的下标

function uidGen(prefix) { return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }

const presetRoleLabels = { system: '系统', user: '用户', assistant: 'AI' };

function getActivePresetObj() {
    return (aiPresets || []).find(p => p.enabled);
}

function getCurrentEditingPreset() {
    return (aiPresets || []).find(p => p.id === currentEditingPresetId);
}

// ===================== 🎭 小剧场：预设里常见的一类"番外/彩蛋"提示词模块 =====================
// 不少从酒馆导入的预设里会带一批名字里有"剧场"两个字的模块（比如"💡日常剧场""🔦SCP小剧场""4选1 简约文字小剧场"等），
// 用来在正文之外额外生成一段小番外/互动卡片。这些本质上就是普通的预设提示词模块，只是数量多、名字有规律，
// 酒馆里得去很长的Prompt Manager列表里一个个找出来勾选，这里提供一个按名字识别的专用入口，方便集中管理。
function isTheaterPresetPrompt(p) {
    return !!(p && typeof p.name === 'string' && p.name.indexOf('剧场') !== -1);
}
// 只看"当前启用中"的那份预设（跟实际参与生成的是同一份），不是"设置页面正在查看"的那份——
// 这两个在本app里是两个不同的概念（可以看着A预设，但真正生效的是B预设），小剧场面板要跟"真正生效"的保持一致。
function getTheaterPresetPrompts() {
    const preset = getActivePresetObj();
    if (!preset || !Array.isArray(preset.prompts)) return [];
    return preset.prompts.filter(isTheaterPresetPrompt);
}
// 专门用来切换"当前启用预设"里某条模块的启用状态，不依赖"设置页面正在查看哪份预设"这个状态——
// 这样小剧场面板不管用户有没有打开过"预设"设置页、或者当前正看着别的预设，切换的永远是真正参与生成的那一份。
function toggleActivePresetPromptEnabled(promptId, checked) {
    const preset = getActivePresetObj();
    if (!preset) return;
    const item = (preset.prompts || []).find(x => x.id === promptId);
    if (!item) return;
    item.enabled = checked;
    saveAllData();
    // 如果用户刚好也在"预设"设置页看着这同一份（已启用的）预设，顺手把那边的列表也刷新一下，两处状态保持同步
    if (currentEditingPresetId === preset.id && typeof renderPresetPromptList === 'function') {
        renderPresetPromptList(preset);
    }
}
// 把当前勾选启用的小剧场模块内容拼成一段文本，供小说/续写生成时追加到prompt里。
// char/scopeId 传给 applyMacros 处理 {{setvar}}/{{getvar}}/{{random}} 等宏——scopeId建议传"这本小说的id"，
// 这样"小剧场规范"这类需要跨模块共享的变量，能在同一本小说的历次生成之间保持连续，不同小说互不干扰。
// 报场景：这段生成属于「theater」那一场（soft＝外层已有场景就不抢）
function getTheaterPromptInjection() {
    const a = arguments;
    if (typeof window.gyInjectInSceneSoft === 'function')
        return window.gyInjectInSceneSoft('theater', () => getTheaterPromptInjectionInner.apply(null, a));
    return getTheaterPromptInjectionInner.apply(null, a);
}
function getTheaterPromptInjectionInner(char, scopeId) {
    const enabledOnes = getTheaterPresetPrompts().filter(p => p.enabled !== false && (p.content || '').trim());
    if (enabledOnes.length === 0) return '';
    return enabledOnes.map(p => applyMacros(p.content, char, scopeId)).join('\n');
}

// buildBasePrompt() 里调用：把当前启用预设里勾选的提示词模块，按它们在预设里的顺序拼成一段文本注入prompt。
// excludeDepthEntries=true时，跳过设了"深度注入"(injectionDepth>0)的模块——这些模块要靠 getActivePresetDepthEntries()
// 单独取出来，插到聊天历史的对应深度位置，而不是固定堆在系统提示词这一段里（只有聊天回复主线路会这样处理）。
// positionFilter：每条模块也能各自设置"插入位置"('before_persona'/'after_persona'/'end')，不设置就是默认的'after_persona'
// （老数据都是这样，等价于改造前"预设固定插在人设/世界书/记忆总结/关系那一段之后"的行为）。
// buildBasePrompt 会用三个不同的 positionFilter 分别调用这个函数三次，把各条模块分到它自己要求的位置。
function getActivePresetPromptText(char, excludeDepthEntries, sessionId, positionFilter) {
    const preset = getActivePresetObj();
    if (!preset || !Array.isArray(preset.prompts) || preset.prompts.length === 0) return '';
    const pos = positionFilter || 'after_persona';
    const applicable = preset.prompts.filter(p => p.enabled !== false && (p.content || '').trim() && !(excludeDepthEntries && p.injectionDepth > 0) && (p.position || 'after_persona') === pos);
    if (applicable.length === 0) return '';
    return '\n' + applicable.map(p => applyMacros(p.content, char, sessionId)).join('\n') + '\n';
}

// 取出当前启用预设里"深度注入"的模块（injectionDepth>0），按depth从大到小排序（深的先插，浅的后插，
// 这样多条深度注入互相插入时不会互相打乱相对次序）。返回 [{depth, content}]，配合 insertTextAtDepth() 使用。
function getActivePresetDepthEntries(char, sessionId) {
    const preset = getActivePresetObj();
    if (!preset || !Array.isArray(preset.prompts) || preset.prompts.length === 0) return [];
    return preset.prompts
        .filter(p => p.enabled !== false && (p.content || '').trim() && p.injectionDepth > 0)
        .map(p => ({ depth: p.injectionDepth, content: applyMacros(p.content, char, sessionId) }))
        .sort((a, b) => b.depth - a.depth);
}

// 把一段文本以 {role, content} 消息的形式插入到"历史消息数组"里，从末尾往前数第depth个位置
// （depth=1表示插在最后一条消息前面，depth=2插在倒数第二条前面，以此类推），用来实现"在对话进行到一半时
// 插入提醒"这种深度注入效果——酒馆的预设模块（injection_position/depth）、作者注、以及世界书的"[系统/用户/AI]插入深度"
// 这几个位置都用的这同一套机制。role 不传就还是老行为（role:'system'），大多数OpenAI兼容接口允许system角色的
// 消息出现在对话中间，模型也会把它当成较强的指令来对待；传 'user'/'assistant' 则伪装成用户/AI说过的话插进去，
// 适合想让世界书内容看起来像"对话里提过"而不是"系统突然插话"的场景。
function insertTextAtDepth(historyTurns, depth, text, role) {
    if (!text || !Array.isArray(historyTurns)) return;
    const d = Math.max(0, depth || 0);
    const insertPos = Math.max(0, historyTurns.length - d);
    historyTurns.splice(insertPos, 0, { role: role || 'system', content: text });
}

// 把当前预设的采样参数（若有）同步到本app"设置-采样参数"里的全局变量+输入框
// 注意：samplerTemperature 等几个都是顶层用 let 声明的全局变量，不挂在 window 对象上，
// 所以这里必须逐个手动同步到输入框，不能用 window[变量名] 这种取巧写法（已有代码踩过这个坑）。
function applyPresetSamplerParams(preset) {
    const sp = (preset && preset.samplerParams) || {};
    if (sp.temperature !== undefined && sp.temperature !== '') samplerTemperature = sp.temperature;
    if (sp.top_p !== undefined && sp.top_p !== '') samplerTopP = sp.top_p;
    if (sp.top_k !== undefined && sp.top_k !== '') samplerTopK = sp.top_k;
    if (sp.frequency_penalty !== undefined && sp.frequency_penalty !== '') samplerFrequencyPenalty = sp.frequency_penalty;
    if (sp.presence_penalty !== undefined && sp.presence_penalty !== '') samplerPresencePenalty = sp.presence_penalty;
    if (document.getElementById('samplerTemperature')) document.getElementById('samplerTemperature').value = samplerTemperature;
    if (document.getElementById('samplerTopP')) document.getElementById('samplerTopP').value = samplerTopP;
    if (document.getElementById('samplerFrequencyPenalty')) document.getElementById('samplerFrequencyPenalty').value = samplerFrequencyPenalty;
    if (document.getElementById('samplerPresencePenalty')) document.getElementById('samplerPresencePenalty').value = samplerPresencePenalty;
    if (document.getElementById('samplerTopK')) document.getElementById('samplerTopK').value = samplerTopK;
}

// ===================== 页面渲染 =====================

function renderPresetsPage() {
    if (!currentEditingPresetId || !aiPresets.some(p => p.id === currentEditingPresetId)) {
        const fallback = getActivePresetObj() || aiPresets[0];
        currentEditingPresetId = fallback ? fallback.id : null;
    }
    renderPresetTabs();
    renderPresetDetail();
}

function renderPresetTabs() {
    const box = document.getElementById('presetTabsList');
    if (!box) return;
    if (!aiPresets || aiPresets.length === 0) { box.innerHTML = ''; return; }
    box.innerHTML = aiPresets.map(p => {
        const cls = ['preset-tab-chip'];
        if (p.id === currentEditingPresetId) cls.push('active-editing');
        if (p.enabled) cls.push('is-active-preset');
        return `<span class="${cls.join(' ')}" onclick="selectPresetTab('${p.id}')">${p.enabled ? '<span class="preset-tab-star">⭐</span>' : ''}${escapeHtml(p.name || '未命名预设')}</span>`;
    }).join('');
}

function selectPresetTab(id) {
    currentEditingPresetId = id;
    renderPresetTabs();
    renderPresetDetail();
}

function renderPresetDetail() {
    const emptyBox = document.getElementById('presetDetailEmpty');
    const detailBox = document.getElementById('presetDetailBox');
    const preset = getCurrentEditingPreset();
    if (!preset) {
        if (emptyBox) emptyBox.style.display = 'block';
        if (detailBox) detailBox.style.display = 'none';
        return;
    }
    if (emptyBox) emptyBox.style.display = 'none';
    if (detailBox) detailBox.style.display = 'block';

    const nameInput = document.getElementById('presetDetailName');
    if (nameInput) nameInput.value = preset.name || '';
    const badge = document.getElementById('presetActiveBadge');
    if (badge) badge.style.display = preset.enabled ? 'flex' : 'none';
    const activateBtn = document.getElementById('presetActivateBtn');
    if (activateBtn) { activateBtn.disabled = !!preset.enabled; activateBtn.style.opacity = preset.enabled ? '0.5' : '1'; }

    const sp = preset.samplerParams || {};
    const tempEl = document.getElementById('presetParamTemp'); if (tempEl) tempEl.value = sp.temperature ?? '';
    const topPEl = document.getElementById('presetParamTopP'); if (topPEl) topPEl.value = sp.top_p ?? '';
    const topKEl = document.getElementById('presetParamTopK'); if (topKEl) topKEl.value = sp.top_k ?? '';
    const freqEl = document.getElementById('presetParamFreqP'); if (freqEl) freqEl.value = sp.frequency_penalty ?? '';
    const presEl = document.getElementById('presetParamPresP'); if (presEl) presEl.value = sp.presence_penalty ?? '';

    renderPresetPromptList(preset);
}

// 💡 新增条目的输入框固定放在列表最下面（不再是列表上方一个"+新条目"按钮点一下就插一条空白占位、
// 还得再找铅笔图标点进去编辑）——每次列表刷新都会在最后重新画一遍这个表单，位置始终固定在末尾、不会跑动，
// 添加成功后清空表单内容、光标停在原地，可以连着加好几条。
function renderPresetAddEntryFormHtml() {
    return `
        <div class="preset-prompt-row" style="border-style:dashed; background:rgba(29,155,240,0.04); flex-direction:column; align-items:stretch;">
            <div style="font-size:12px; font-weight:bold; color:#1d9bf0; margin-bottom:6px;">＋ 新增条目（添加到本预设末尾）</div>
            <div style="display:flex; gap:6px; width:100%; flex-wrap:wrap;">
                <input type="text" id="newPresetPromptName" placeholder="模块名称" style="flex:1; min-width:120px; padding:6px; border:1px solid #1d9bf0; border-radius:4px;">
                <select id="newPresetPromptRole" style="padding:6px; border:1px solid #1d9bf0; border-radius:4px;">
                    <option value="system">系统</option>
                    <option value="user">用户</option>
                    <option value="assistant">AI</option>
                </select>
            </div>
            <textarea id="newPresetPromptContent" placeholder="模块内容，支持 {{char}} {{user}} 等宏" rows="3" style="width:100%; margin-top:6px; padding:6px; border:1px solid #1d9bf0; border-radius:4px; font-family:inherit; box-sizing:border-box;"></textarea>
            <div style="display:flex; gap:8px; align-items:center; margin-top:6px; width:100%; flex-wrap:wrap;">
                <label style="font-size:11px; color:#8b98a5; display:flex; align-items:center; gap:4px;">深度注入<input type="number" id="newPresetPromptDepth" min="0" step="1" value="0" style="width:60px; padding:2px 4px;"></label>
                <label style="font-size:11px; color:#8b98a5; display:flex; align-items:center; gap:4px;">插入位置<select id="newPresetPromptPosition" style="padding:2px 4px; border:1px solid #1d9bf0; border-radius:4px;">
                    <option value="before_persona">人设之前</option>
                    <option value="after_persona" selected>人设之后（默认）</option>
                    <option value="end">提示词末尾</option>
                </select></label>
                <button type="button" class="btn-primary" style="margin:0 0 0 auto; padding:6px 16px;" onclick="addPresetPromptEntryFromForm()">＋ 添加到末尾</button>
            </div>
        </div>`;
}

function renderPresetPromptList(preset) {
    const container = document.getElementById('presetPromptList');
    if (!container) return;
    if (!preset.prompts || preset.prompts.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:20px;">还没有提示词模块，用下面的表单添加一条，或从上方导入一份预设 JSON</div>' + renderPresetAddEntryFormHtml();
        return;
    }
    container.innerHTML = preset.prompts.map((item, i) => `
        <div class="preset-prompt-row" draggable="true" data-idx="${i}"
             ondragstart="presetPromptDragStart(event, ${i})"
             ondragover="presetPromptDragOver(event, ${i})"
             ondragleave="presetPromptDragLeave(event)"
             ondrop="presetPromptDrop(event, ${i})"
             ondragend="presetPromptDragEnd(event)">
            <span class="preset-drag-handle" title="按住拖拽调整顺序">⠿</span>
            <input type="checkbox" ${item.enabled !== false ? 'checked' : ''} onchange="togglePresetPromptEnabled('${item.id}', this.checked)" title="启用/禁用这条模块">
            <span class="preset-prompt-name">${escapeHtml(item.name || '未命名模块')}</span>
            <span class="preset-role-badge">${escapeHtml(presetRoleLabels[item.role] || item.role || 'system')}</span>
            <span class="preset-edit-btn" title="编辑内容" onclick="togglePresetPromptEditor(this, '${item.id}')">✏️</span>
            <span class="preset-del-btn" title="删除这条模块" onclick="deletePresetPromptEntry('${item.id}')">🗑️</span>
            <div class="plugin-clamp-wrap" style="width:100%; margin-top:2px;">
                <div class="plugin-clamp-text" style="font-family:monospace; font-size:11px; color:#536471;">${escapeHtml(item.content || '（空）')}</div>
                <span class="plugin-expand-hint" onclick="togglePluginClamp(this)">展开 ▾</span>
            </div>
            <textarea class="preset-prompt-editor" data-prompt-id="${item.id}" style="display:none;" rows="5" placeholder="模块内容，支持 {{char}} {{user}} 等宏" onchange="updatePresetPromptContent('${item.id}', this.value)">${escapeHtml(item.content || '')}</textarea>
            <label class="preset-prompt-editor" data-prompt-id="${item.id}" style="display:none; width:100%; font-size:11px; color:#8b98a5; align-items:center; gap:4px; flex-wrap:wrap;">
                深度注入<input type="number" min="0" step="1" value="${item.injectionDepth || 0}" style="width:60px; padding:2px 4px;" onchange="updatePresetPromptDepth('${item.id}', this.value)">
                （0＝固定放在系统提示词里，>0＝插到聊天记录倒数第N条消息前，仅对聊天回复生效）
            </label>
            <label class="preset-prompt-editor" data-prompt-id="${item.id}" style="display:none; width:100%; font-size:11px; color:#8b98a5; align-items:center; gap:4px;">
                插入位置<select style="padding:2px 4px; border:1px solid #1d9bf0; border-radius:4px;" onchange="updatePresetPromptPosition('${item.id}', this.value)">
                    <option value="before_persona" ${item.position === 'before_persona' ? 'selected' : ''}>人设之前</option>
                    <option value="after_persona" ${(!item.position || item.position === 'after_persona') ? 'selected' : ''}>人设之后（默认）</option>
                    <option value="end" ${item.position === 'end' ? 'selected' : ''}>提示词末尾</option>
                </select>（仅对"深度注入=0"的模块生效，同一位置内仍按上面的拖拽顺序排列）
            </label>
        </div>`).join('') + renderPresetAddEntryFormHtml();
}

// 内容默认折叠成两行预览，点铅笔切换成可编辑的大文本框+深度注入设置（跟展开预览是两码事，编辑时始终能看到全文）
function togglePresetPromptEditor(btnEl, promptId) {
    const row = btnEl.closest('.preset-prompt-row');
    if (!row) return;
    const clampWrap = row.querySelector('.plugin-clamp-wrap');
    const editors = row.querySelectorAll('.preset-prompt-editor');
    if (!editors.length) return;
    const showingEditor = editors[0].style.display !== 'none';
    editors.forEach(el => { el.style.display = showingEditor ? 'none' : (el.tagName === 'LABEL' ? 'flex' : 'block'); });
    if (clampWrap) clampWrap.style.display = showingEditor ? 'block' : 'none';
    if (!showingEditor) editors[0].focus();
}

function updatePresetPromptDepth(promptId, value) {
    const preset = getCurrentEditingPreset(); if (!preset) return;
    const item = preset.prompts.find(x => x.id === promptId); if (!item) return;
    item.injectionDepth = Math.max(0, parseInt(value) || 0);
    saveAllData();
}

function updatePresetPromptPosition(promptId, value) {
    const preset = getCurrentEditingPreset(); if (!preset) return;
    const item = preset.prompts.find(x => x.id === promptId); if (!item) return;
    item.position = (value === 'before_persona' || value === 'end') ? value : 'after_persona';
    saveAllData();
}

// ===================== 模块（单条提示词）的增删改查 =====================

function togglePresetPromptEnabled(promptId, checked) {
    const preset = getCurrentEditingPreset(); if (!preset) return;
    const item = preset.prompts.find(x => x.id === promptId); if (!item) return;
    item.enabled = checked;
    saveAllData();
}

function updatePresetPromptContent(promptId, value) {
    const preset = getCurrentEditingPreset(); if (!preset) return;
    const item = preset.prompts.find(x => x.id === promptId); if (!item) return;
    item.content = value;
    saveAllData();
    renderPresetPromptList(preset); // 刷新折叠预览文本
}

function deletePresetPromptEntry(promptId) {
    const preset = getCurrentEditingPreset(); if (!preset) return;
    preset.prompts = preset.prompts.filter(x => x.id !== promptId);
    saveAllData();
    renderPresetPromptList(preset);
}

// 从列表最下面那个固定表单读取内容，插入到当前预设的末尾（永远加在最后一条，不会插到中间打乱已有顺序）
function addPresetPromptEntryFromForm() {
    const preset = getCurrentEditingPreset();
    if (!preset) { appAlert('请先新建或选中一个预设'); return; }
    const nameEl = document.getElementById('newPresetPromptName');
    const roleEl = document.getElementById('newPresetPromptRole');
    const contentEl = document.getElementById('newPresetPromptContent');
    const depthEl = document.getElementById('newPresetPromptDepth');
    const positionEl = document.getElementById('newPresetPromptPosition');
    const name = (nameEl?.value || '').trim() || '新条目';
    const content = (contentEl?.value || '').trim();
    if (!content) { appAlert('请填写模块内容'); return; }
    if (!preset.prompts) preset.prompts = [];
    const positionVal = positionEl?.value;
    preset.prompts.push({
        id: uidGen('pp'), name, role: (roleEl?.value) || 'system', content, enabled: true,
        injectionDepth: Math.max(0, parseInt(depthEl?.value) || 0),
        position: (positionVal === 'before_persona' || positionVal === 'end') ? positionVal : 'after_persona'
    });
    saveAllData();
    renderPresetPromptList(preset); // 重新渲染会把表单重新画一遍在最下面（自动清空），方便连续添加
}

// ===================== 拖拽排序（原生 HTML5 drag & drop，仿酒馆 Prompt Manager 可拖拽列表） =====================

function presetPromptDragStart(ev, idx) {
    presetPromptDragSrcIdx = idx;
    try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', String(idx)); } catch (e) {}
    ev.currentTarget.classList.add('dragging');
}
function presetPromptDragOver(ev) {
    ev.preventDefault();
    try { ev.dataTransfer.dropEffect = 'move'; } catch (e) {}
    const row = ev.currentTarget;
    const rect = row.getBoundingClientRect();
    const isAfter = (ev.clientY - rect.top) > rect.height / 2;
    row.classList.toggle('drag-over-bottom', isAfter);
    row.classList.toggle('drag-over-top', !isAfter);
}
function presetPromptDragLeave(ev) {
    ev.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
}
function presetPromptDrop(ev, idx) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
    const preset = getCurrentEditingPreset(); if (!preset) return;
    const from = presetPromptDragSrcIdx;
    presetPromptDragSrcIdx = null;
    if (from === null || from === undefined) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const isAfter = (ev.clientY - rect.top) > rect.height / 2;
    let to = isAfter ? idx + 1 : idx;
    if (from === to || from === to - 1) return;
    const [moved] = preset.prompts.splice(from, 1);
    if (from < to) to -= 1; // 移除元素后，后面的下标会整体往前挪一位，插入目标要相应修正
    preset.prompts.splice(to, 0, moved);
    saveAllData();
    renderPresetPromptList(preset);
}
function presetPromptDragEnd(ev) {
    ev.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.preset-prompt-row').forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
    presetPromptDragSrcIdx = null;
}

// ===================== 预设本身的增删改查/启用切换 =====================

async function createBlankPreset() {
    const name = ((await appPrompt('给新预设起个名字：', '新预设')) || '').trim();
    if (!name) return;
    const preset = { id: uidGen('preset'), name, enabled: aiPresets.length === 0, prompts: [], samplerParams: {} };
    aiPresets.push(preset);
    currentEditingPresetId = preset.id;
    if (preset.enabled) applyPresetSamplerParams(preset);
    saveAllData();
    renderPresetsPage();
}

function renamePresetFromInput() {
    const preset = getCurrentEditingPreset(); if (!preset) return;
    const input = document.getElementById('presetDetailName');
    const val = input ? input.value.trim() : '';
    preset.name = val || preset.name;
    saveAllData();
    renderPresetTabs();
}

function duplicatePreset(id) {
    const src = aiPresets.find(p => p.id === id); if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uidGen('preset');
    copy.name = (src.name || '预设') + ' 副本';
    copy.enabled = false;
    copy.prompts = (copy.prompts || []).map(p => Object.assign({}, p, { id: uidGen('pp') }));
    aiPresets.push(copy);
    currentEditingPresetId = copy.id;
    saveAllData();
    renderPresetsPage();
}

async function deletePreset(id) {
    const preset = aiPresets.find(p => p.id === id); if (!preset) return;
    if (!(await appConfirm(`确定删除预设「${preset.name}」？此操作不可恢复！`))) return;
    aiPresets = aiPresets.filter(p => p.id !== id);
    if (currentEditingPresetId === id) currentEditingPresetId = null;
    saveAllData();
    renderPresetsPage();
}

// 切换"当前使用的预设"——跟酒馆一样是互斥单选，切换的同时把这份预设自带的采样参数同步应用到全局设置
function setActivePreset(id) {
    const preset = aiPresets.find(p => p.id === id); if (!preset) return;
    aiPresets.forEach(p => { p.enabled = (p.id === id); });
    applyPresetSamplerParams(preset);
    saveAllData();
    renderPresetTabs();
    renderPresetDetail();
    appToast('✅ 已切换为使用「' + (preset.name || '') + '」');
}

function updatePresetSamplerField(key, value) {
    const preset = getCurrentEditingPreset(); if (!preset) return;
    if (!preset.samplerParams) preset.samplerParams = {};
    if (value === '' || value === null || value === undefined) {
        delete preset.samplerParams[key];
    } else {
        const num = parseFloat(value);
        preset.samplerParams[key] = isNaN(num) ? value : num;
    }
    saveAllData();
    // 如果正在编辑的刚好是当前启用中的预设，实时同步到全局采样参数，体验上更接近酒馆"改了立刻生效"
    if (preset.enabled) applyPresetSamplerParams(preset);
}

// 导出成 SillyTavern 能直接识别的 Chat Completion 预设格式，方便反向导回酒馆或分享给用其他工具的朋友
function exportPreset(id) {
    const preset = aiPresets.find(p => p.id === id); if (!preset) return;
    const sp = preset.samplerParams || {};
    const order = (preset.prompts || []).map(p => ({ identifier: p.id, enabled: p.enabled !== false }));
    const promptsOut = (preset.prompts || []).map(p => Object.assign(
        { identifier: p.id, name: p.name || '未命名模块', role: p.role || 'system', content: p.content || '' },
        p.injectionDepth > 0 ? { injection_position: 1, injection_depth: p.injectionDepth } : { injection_position: 0 }
    ));
    const out = {
        temperature: sp.temperature ?? 1,
        top_p: sp.top_p ?? 1,
        top_k: sp.top_k ?? 0,
        frequency_penalty: sp.frequency_penalty ?? 0,
        presence_penalty: sp.presence_penalty ?? 0,
        prompts: promptsOut,
        prompt_order: [{ character_id: 100001, order }]
    };
    const safeFilename = (preset.name || 'preset').replace(/[\\/:*?"<>|]/g, '_') + '.json';
    saveTextFileForApp(safeFilename, JSON.stringify(out, null, 2), 'application/json');
}

// ===================== 导入 SillyTavern 预设 JSON =====================

let presetImportPendingList = []; // 待确认的模块清单：[{id, name, role, content, enabled}]
let presetImportSourceName = '';
let presetImportSamplerParams = null; // 预设里检测到的采样参数：{temperature, top_p, frequency_penalty, presence_penalty, top_k}，键存在即代表检测到了
let presetImportPendingRegexList = []; // 预设自带的正则脚本：[{id, name, find, flags, replace, isRegex, target, enabled}]，导入预设时默认自动一并挂上
let presetImportIncompatNote = ''; // 导入时发现的"跟本app不完全适配、但仍全部原样导入了"的模块说明（marker占位符/空内容），确认导入前弹窗告知

// 酒馆预设文件的 extensions.regex_scripts 里经常还附带一批"配套正则"（比如清理思维链标签、格式化输出等），
// 这些脚本跟提示词模块是配套设计的，缺了正则很多预设的输出格式会不对，所以要一起解析出来。
// 转换逻辑跟"导入角色卡时顺带识别正则脚本"(js/13-charreply-groupchat-faction-cardimport.js)完全一致，
// 复用同一套 target 判定规则（placement: 1=用户输入, 2=AI输出）和字段映射，保持两处行为一致。
// 🩹 自动修复："状态栏"这类角色卡自带正则脚本，经常是一整条从头串到尾的大正则，要求AI必须严格输出到
// 某个收尾标签（比如 </闻述状态> 或 [/STATUS_END]）才算匹配成功。但AI在内容比较长、字段比较多的时候，
// 经常会漏写这最后一个收尾标签——只要结尾这一小段对不上，前面写得再工整、字段再完整，整条正则依然
// 判定为"没匹配上"，于是完全不转换，原样展示一大段裸文本模板（比如 <角色状态>\n地点：xxx\n... 这种），
// 而不是设计好的HTML卡片。这里在导入的时候就自动探测"pattern末尾是不是这种字面量收尾标签"，如果是，
// 就把它改成"可有可无"（正则里加 (?:...)?，末尾补上$），这样AI哪怕漏写收尾标签，前面已经写好的字段
// 照样能正常转换成卡片；AI乖乖写了收尾标签也完全不受影响。只处理"整条pattern的最末尾"这一种情况，
// 不动中间穿插的标签，并且要求pattern里至少出现过一次"(.*?)"这类非贪婪捕获组才处理——只有这种"结构化
// 字段提取"模板才会有"结尾对不上就整体作废"的风险，避免误伤跟这个问题完全无关的普通替换脚本。
// 判断一条pattern是不是"[TAG](.*?)[/TAG]"或"<xxx>...(.*?)..."这类结构化多字段提取模板——
// 只有这种模板才会有"某个环节对不上就整体作废"的脆弱性，下面两个自动修复都只对这类pattern生效，
// 避免误伤跟状态栏完全无关的普通替换脚本。
function looksLikeFieldExtractionPattern(pattern) {
    return !!pattern && /\(\.\*\??\)|\(\[\\s\\S\]\*\??\)/.test(pattern);
}

// 🐛🐛 关键修复（这一个坑影响面极大，几乎所有酒馆正则都中招）：
// 下面三处"宽松收尾"改写都是把 `收尾标签` 换成 `(?:收尾标签|$)`——意思是"标签写了就在标签处停，
// 标签没写就一直吃到末尾"。问题在于：酒馆导出的 findRegex 绝大多数带 **m 标志**（`/.../gm`），
// 而在 m 模式下 `$` 匹配的是**每一行的行尾**，不是整段文本的末尾。
// 于是 `([\s\S]*?)\s*(?:</Tag>|$)` 里那个**惰性**捕获组，在第一个换行处就能用 `$` 收工——
// 结果只捕获到第一行，标签块剩下的内容全部漏在外面。
//
// 症状就是谢云霄那张卡：<Theater> 里整段私信对话本该被塞进「卷宗纪要」那个折叠框里，
// 实际只吃进了第一行，剩下的对话全露在折叠框外面，看起来就是"状态栏没完全收起来"。
// 多字段状态栏更普遍——最后一个字段永远只剩第一行。
//
// 用 `(?![\s\S])`（后面再没有任何字符了）代替 `$`：这是无歧义的"整段真末尾"断言，
// 不受 m 标志影响，也不需要去猜/改调用方的 flags。
const RX_TRUE_END = '(?![\\s\\S])';

// 存档里已经存着一批用旧写法（`...|$)`）改写过的脚本——它们是在导入那一刻就被改写并存下来的，
// 光改上面的函数只对"以后新导入的"生效，已经导入的卡照样是坏的。启动读档时原地修一遍。
// 只动"整条 pattern 正好以 |$) 结尾"这一种形态——那是上面那三处改写唯一会产出的形状，
// 作者自己手写的 $ 不会长这样（会在别的位置、或者不带这个收尾括号），不会误伤。
function migrateRegexScriptTrueEnd(list) {
    if (!Array.isArray(list)) return list;
    list.forEach(s => {
        if (!s || typeof s.find !== 'string' || !s.isRegex) return;
        if (!s.find.endsWith('|$)')) return;
        s.find = s.find.slice(0, -3) + '|' + RX_TRUE_END + ')';
    });
    return list;
}
function relaxTrailingClosingTagInPattern(pattern) {
    if (!pattern || typeof pattern !== 'string') return pattern;
    if (!looksLikeFieldExtractionPattern(pattern)) return pattern; // 没有"字段捕获组"特征，大概率不是状态栏类模板，跳过

    // 🩹 修复我们自己早前那版"宽松收尾"方案本身还带的一个bug：之前把收尾标签处理成 (?:标签)?$ ——
    // 这要求"要么标签紧贴着字符串真正的末尾、要么干脆没写标签也贴着末尾"。但AI经常习惯在状态栏标签块
    // 后面还接着写一段话题标签（比如#见面前夜）之类的内容，只要标签后面还跟了别的文字，$就永远够不着，
    // 这条正则又会变回"整体作废"。已经是这种旧写法的脚本，这里先原地升级成新写法，不用等重新导入才生效。
    let m = pattern.match(/^([\s\S]*?)\(\?:([\s\S]+?)\)\?\$$/);
    if (m) return `${m[1]}(?:${m[2]}|${RX_TRUE_END})`;

    if (pattern.endsWith('$')) return pattern; // 除了上面那种旧写法，其它自己带$收尾的一律不动，避免误伤

    // 情况1：<xxx>风格的收尾标签，比如 <\/闻述状态> 或 </闻述状态>，前面可能带一个换行转义 \n
    m = pattern.match(/^([\s\S]*?)((?:\\n)?<\\?\/?[^<>\\]+>)$/);
    // 用"标签命中就在那停，标签压根没写就退到字符串末尾"这种两选一写法，而不是"标签可选、然后必须正好是末尾"——
    // 这样即使标签后面还跟着别的文字（话题标签、AI多说的几句话等），也只影响标签之外的部分，不会连累前面
    // 已经正常捕获到的字段内容，也不会导致整条替换因为凑不齐"贴着末尾"这个条件而彻底失效。
    if (m) return `${m[1]}(?:${m[2]}|${RX_TRUE_END})`;

    // 情况2：[/XXX] 或 [XXX_END] 风格的收尾标记（方括号可能被转义成 \[...\]），前面可能带一个换行转义 \n
    m = pattern.match(/^([\s\S]*?)((?:\\n)?\\?\[\\?\/?[A-Za-z_][A-Za-z0-9_]*\\?\])$/);
    if (m) return `${m[1]}(?:${m[2]}|${RX_TRUE_END})`;

    return pattern;
}

// 酒馆单条正则脚本对象 -> 本app正则脚本格式，预设内嵌的regex_scripts和独立导出的正则脚本JSON文件用的是同一套单条字段结构，
// 所以两个导入入口（预设导入 / Git链接导入独立正则脚本文件）共用这一份映射逻辑，不用各写一遍。
function mapStRegexScriptItem(rs) {
    if (!rs || !rs.findRegex) return null;
    const placements = Array.isArray(rs.placement) ? rs.placement : [];
    const target = placements.length === 0 ? 'both' : (placements.includes(1) && placements.includes(2) ? 'both' : (placements.includes(1) ? 'user_input' : 'ai_output'));
    let { pattern, flags } = parseRegexLiteral(rs.findRegex);
    // 只对会处理"AI输出"的脚本（ai_output/both）做这两层容错，用户自己发的消息不存在这些"AI输出不稳定"的问题。
    if (target !== 'user_input' && looksLikeFieldExtractionPattern(pattern)) {
        try { pattern = relaxTrailingClosingTagInPattern(pattern); } catch (e) { /* 探测失败就用原始pattern，不影响导入 */ }
        // 🩹 补充修复（多字段模板最常踩的坑）：[TAG](.*?)[/TAG] 这种写法里，"."默认不跨行匹配——只要某个
        // 字段的内容和它的闭合标签之间被AI多打了一个换行（内容自动换行、或AI随手多敲了个回车，
        // 在多字段、长内容的状态栏格式里几乎必然会遇到），从这个字段起整条正则就彻底匹配失败，
        // 前面写得再工整也全部原样露出裸文本。这里默认打开dotall(s)标志，让"."也能匹配换行，
        // 一次性堵掉这整类"字段边界多了个回车就导致整体转换失败"的问题。
        if (!flags.includes('s')) flags += 's';
    }
    // markdownOnly/promptOnly 对应本app"正则脚本作用位置"里的 displayOnly(仅影响界面显示)/promptOnly(仅影响发给AI的内容)，
    // 两者都没标的走默认行为（跟target一起在生成/发送那一刻处理并存档），和手动新建的正则脚本完全同一套语义。
    return {
        id: 'rx_' + Date.now() + Math.floor(Math.random() * 1000000),
        name: rs.scriptName || '导入的正则脚本',
        find: pattern,
        flags,
        replace: rs.replaceString || '',
        isRegex: true,
        target,
        enabled: rs.disabled !== true, // 预设作者没主动关掉的，导入后就直接是启用状态，不用用户再手动开
        displayOnly: !!rs.markdownOnly,
        promptOnly: !rs.markdownOnly && !!rs.promptOnly,
        // 酒馆原生的"深度范围"限定：只对发给AI的历史记录里、距离最新消息第几条以内/以外的消息生效
        // （比如"远楼层消息"这种脚本专门用来隐藏很久以前的历史，避免占用token，但不影响最近几条）。
        // 只有promptOnly的脚本才有意义用这个字段，但导入时不管三七二十一都原样带过来，免得以后改成promptOnly时又要重新导入一次。
        minDepth: (typeof rs.minDepth === 'number') ? rs.minDepth : null,
        maxDepth: (typeof rs.maxDepth === 'number') ? rs.maxDepth : null
    };
}
function parsePresetRegexScripts(parsed) {
    const raw = parsed && parsed.extensions && parsed.extensions.regex_scripts;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map(mapStRegexScriptItem).filter(Boolean);
}

async function handlePresetFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    let rawText;
    try {
        rawText = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e);
            reader.readAsText(file, 'UTF-8');
        });
    } catch (e) {
        appAlert('导入失败：读取文件出错');
        event.target.value = '';
        return;
    }

    let parsed;
    try { parsed = JSON.parse(rawText); } catch (e) { appAlert('导入失败：不是合法的 JSON 文件'); event.target.value = ''; return; }

    if (!parsed || !Array.isArray(parsed.prompts)) {
        appAlert('导入失败：这不是 SillyTavern 预设格式（没有找到 prompts 数组）。世界书/角色卡请用世界书页面或角色导入功能导入。');
        event.target.value = '';
        return;
    }

    // 预设顶层通常还带着采样参数（sampler），跟本app"设置-采样参数"是同一批字段，能对上的就顺手识别出来，
    // 存进这份预设自己的 samplerParams 里；"设为当前使用"时会自动同步应用（不是每个字段预设里都一定有，只收集实际存在且是数字的）
    const samplerParams = {};
    if (typeof parsed.temperature === 'number') samplerParams.temperature = parsed.temperature;
    if (typeof parsed.top_p === 'number') samplerParams.top_p = parsed.top_p;
    if (typeof parsed.frequency_penalty === 'number') samplerParams.frequency_penalty = parsed.frequency_penalty;
    if (typeof parsed.presence_penalty === 'number') samplerParams.presence_penalty = parsed.presence_penalty;
    if (typeof parsed.top_k === 'number') samplerParams.top_k = parsed.top_k;
    presetImportSamplerParams = Object.keys(samplerParams).length > 0 ? samplerParams : null;

    // prompt_order：只用来查每个模块"默认是否启用 + 深度注入设置"，不再用它来决定显示顺序——
    // 💡 修复：以前是按 order 数组排出一份顺序、order 里没提到的模块再拼在最后，容易导致"文件里明明排在
    // 中间的某个模块，导入后跑到最后面去了"。现在统一按 parsed.prompts 数组本身在文件里出现的原始顺序来排，
    // 不重排、也不再跳过任何一条——对应用户的要求"按预设原有顺序导入不要变动，所有都要导入"。
    const orderGroups = Array.isArray(parsed.prompt_order) ? parsed.prompt_order : [];
    let bestGroup = null;
    orderGroups.forEach(g => { if (g && Array.isArray(g.order) && (!bestGroup || g.order.length > bestGroup.order.length)) bestGroup = g; });
    const orderInfoById = {};
    if (bestGroup) bestGroup.order.forEach(o => { if (o && o.identifier !== undefined && o.identifier !== null) orderInfoById[o.identifier] = o; });

    // 酒馆原生的 injection_position===1 代表"深度注入"（插入到聊天记录中间第injection_depth层），
    // 对应本app预设模块的 injectionDepth 字段；injection_position===0（或没有）就是普通固定顺序，depth记0。
    const readInjectionDepth = (p) => (p.injection_position === 1 && typeof p.injection_depth === 'number') ? p.injection_depth : 0;

    // 💡 修复"所有都要导入"：以前 marker占位符（世界书/聊天记录/人设这类酒馆内置插槽，本app是通过别的机制
    // 自动注入等效内容的，不靠这些占位符）和内容为空的模块会被直接跳过、完全不出现在导入列表里，用户根本
    // 看不出"这份预设其实还有几条没导进来"。现在全部原样纳入列表——marker类默认禁用（本app本来就会在别处
    // 自动处理这部分内容，同时启用容易变成重复注入），内容为空的也原样导入（可能是作者故意留白等你自己填），
    // 两类都会计数，在打开确认导入的预览框之前先弹窗说明各有多少条、为什么这样处理。
    let markerCount = 0, emptyCount = 0;
    const list = parsed.prompts.filter(p => p && typeof p === 'object').map(p => {
        const identifier = p.identifier;
        const orderInfo = (identifier !== undefined && identifier !== null) ? orderInfoById[identifier] : null;
        const content = (p.content || '').toString().trim();
        const isMarker = !!p.marker;
        if (isMarker) markerCount++;
        else if (!content) emptyCount++;
        return {
            id: uidGen('pp'),
            name: (p.name || (identifier !== undefined && identifier !== null ? String(identifier) : '') || '未命名模块').toString().trim(),
            role: p.role || 'system',
            content,
            enabled: isMarker ? false : (orderInfo ? !!orderInfo.enabled : false),
            injectionDepth: readInjectionDepth(p),
            isMarker,
            isEmpty: !isMarker && !content
        };
    });

    if (list.length === 0) { appAlert('导入失败：预设文件里没有找到任何模块条目'); event.target.value = ''; return; }

    presetImportPendingList = list;
    presetImportPendingRegexList = parsePresetRegexScripts(parsed); // 预设自带的配套正则脚本，默认自动一并导入并启用
    presetImportSourceName = file.name.replace(/\.json$/i, '');
    presetImportIncompatNote = (markerCount > 0 || emptyCount > 0)
        ? `⚠️ 这份预设里有 ${markerCount + emptyCount} 个模块跟本app不完全适配，但已经全部原样导入了，不会漏掉：\n`
            + (markerCount > 0 ? `· ${markerCount} 个是酒馆内置占位符（世界书/聊天记录/人设等插槽），本app是通过其它机制自动处理这部分内容的，不靠这些占位符——已默认禁用，避免重复注入，需要的话你可以自己看着改成启用。\n` : '')
            + (emptyCount > 0 ? `· ${emptyCount} 个模块内容是空的（可能是预设作者故意留白、等你自己填），已原样导入，默认禁用。\n` : '')
        : '';
    openPresetImportPreviewModal();
    event.target.value = '';
}

function openPresetImportPreviewModal() {
    if (presetImportPendingList.length === 0) return;
    if (presetImportIncompatNote) appAlert(presetImportIncompatNote);
    const nameInput = document.getElementById('presetImportSourceName');
    if (nameInput) nameInput.value = presetImportSourceName || '导入的预设';
    const countEl = document.getElementById('presetImportCount'); if (countEl) countEl.innerText = presetImportPendingList.length;
    renderPresetImportSamplerBlock();
    renderPresetImportRegexBlock();
    renderPresetImportPreviewList();
    openModal('presetImportPreviewModal');
}

function renderPresetImportRegexBlock() {
    const box = document.getElementById('presetImportRegexBlock');
    if (!box) return;
    if (!presetImportPendingRegexList || presetImportPendingRegexList.length === 0) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const targetLabel = { ai_output: 'AI输出', user_input: '用户输入', both: '双向' };
    const rows = presetImportPendingRegexList.map(rs => {
        const scopeTag = rs.displayOnly ? '👁️仅显示' : (rs.promptOnly ? '🤖仅发AI' : (targetLabel[rs.target] || rs.target));
        return `<span style="display:inline-block; margin:2px 6px 2px 0; padding:2px 8px; border-radius:9999px; background:rgba(29,155,240,0.1); color:#1d9bf0; font-size:12px;">${escapeHtml(rs.name)}${rs.enabled ? '' : '（默认关闭）'} · ${scopeTag}</span>`;
    }).join('');
    box.style.display = 'block';
    box.innerHTML = `<div style="border:1px dashed #1d9bf0; border-radius:8px; padding:8px 10px; margin-bottom:10px; background:rgba(29,155,240,0.03);">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; color:#1d9bf0; font-weight:bold; margin-bottom:4px;">
            <input type="checkbox" id="presetImportApplyRegex" checked> 🧩 这份预设自带 ${presetImportPendingRegexList.length} 条配套正则脚本，确认导入时自动一并添加并按预设设定的开关状态启用（可在"设置 → AI增强功能"里查看/调整）
        </label>
        <div>${rows}</div>
    </div>`;
}

function renderPresetImportSamplerBlock() {
    const box = document.getElementById('presetImportSamplerBlock');
    if (!box) return;
    if (!presetImportSamplerParams) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const labelMap = { temperature: '温度 Temperature', top_p: 'Top P', frequency_penalty: '频率惩罚', presence_penalty: '存在惩罚', top_k: 'Top K' };
    const rows = Object.keys(presetImportSamplerParams).map(k => `<span style="display:inline-block; margin:2px 6px 2px 0; padding:2px 8px; border-radius:9999px; background:rgba(29,155,240,0.1); color:#1d9bf0; font-size:12px;">${labelMap[k] || k}: ${presetImportSamplerParams[k]}</span>`).join('');
    box.style.display = 'block';
    box.innerHTML = `<div style="border:1px dashed #1d9bf0; border-radius:8px; padding:8px 10px; margin-bottom:10px; background:rgba(29,155,240,0.03);">
        <div style="font-size:13px; color:#1d9bf0; font-weight:bold; margin-bottom:4px;">🎚️ 检测到采样参数（会作为这份预设自己的参数保存，"设为当前使用"时自动应用到"设置-采样参数"）</div>
        <div>${rows}</div>
    </div>`;
}

function renderPresetImportPreviewList() {
    const container = document.getElementById('presetImportPreviewList');
    if (!container) return;
    container.innerHTML = presetImportPendingList.map((item, i) => `
        <div style="border:1px solid #1d9bf0; border-radius:8px; padding:8px 10px; margin-bottom:8px; background:rgba(29,155,240,0.03);">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom:4px; flex-wrap:wrap;">
                <input type="checkbox" ${item.enabled ? 'checked' : ''} onchange="presetImportPendingList[${i}].enabled = this.checked">
                <span style="font-weight:bold; color:#1d9bf0; font-size:13px;">${escapeHtml(item.name)}</span>
                <span style="font-size:11px; color:#8b98a5; border:1px solid #8b98a5; border-radius:4px; padding:0 4px;">${escapeHtml(presetRoleLabels[item.role] || item.role)}</span>
                ${item.isMarker ? `<span style="font-size:11px; color:#f91880; border:1px solid #f91880; border-radius:4px; padding:0 4px;" title="酒馆内置占位符，本app通过其它机制自动处理，不需要靠这条">⚠️占位符</span>` : ''}
                ${item.isEmpty ? `<span style="font-size:11px; color:#e0a800; border:1px solid #e0a800; border-radius:4px; padding:0 4px;">⚠️内容为空</span>` : ''}
            </label>
            <div class="plugin-clamp-wrap">
                <div class="plugin-clamp-text" style="font-size:12px; color:#536471; font-family:monospace;">${escapeHtml(item.content)}</div>
                <span class="plugin-expand-hint" onclick="togglePluginClamp(this)">展开 ▾</span>
            </div>
        </div>`).join('');
}

function setAllPresetImportChecked(checked) {
    presetImportPendingList.forEach(item => item.enabled = checked);
    renderPresetImportPreviewList();
}

function cancelPresetImportPreview() {
    presetImportPendingList = [];
    presetImportSamplerParams = null;
    presetImportPendingRegexList = [];
    presetImportIncompatNote = '';
    closeModal('presetImportPreviewModal');
}

function confirmPresetImportAll() {
    if (presetImportPendingList.length === 0) { appAlert('没有可导入的提示词模块'); return; }
    const nameInput = document.getElementById('presetImportSourceName');
    const name = (nameInput && nameInput.value.trim()) || presetImportSourceName || '导入的预设';

    const preset = {
        id: uidGen('preset'),
        name,
        enabled: false,
        prompts: presetImportPendingList.map(item => ({ id: item.id, name: item.name, role: item.role, content: item.content, enabled: item.enabled, injectionDepth: item.injectionDepth || 0 })),
        samplerParams: presetImportSamplerParams ? Object.assign({}, presetImportSamplerParams) : {}
    };
    aiPresets.push(preset);
    currentEditingPresetId = preset.id;
    const enabledCount = preset.prompts.filter(p => p.enabled).length;

    // 预设自带的配套正则脚本：默认勾选自动导入，按各自脚本原本的开关状态直接挂到全局正则列表里生效，
    // 不需要用户再手动去"AI增强功能"页面逐条添加/开启——跟酒馆里"导入预设=正则一起生效"的体验保持一致。
    const applyRegexCheckbox = document.getElementById('presetImportApplyRegex');
    const shouldApplyRegex = !!(presetImportPendingRegexList.length > 0 && (!applyRegexCheckbox || applyRegexCheckbox.checked));
    let importedRegexCount = 0;
    if (shouldApplyRegex) {
        presetImportPendingRegexList.forEach(rs => { regexScripts.push(rs); importedRegexCount++; });
    }

    presetImportPendingList = [];
    presetImportSamplerParams = null;
    presetImportPendingRegexList = [];
    presetImportIncompatNote = '';
    closeModal('presetImportPreviewModal');

    setActivePreset(preset.id); // 导入即启用，和酒馆"导入预设=切换到这份预设"的使用习惯保持一致；不想用可以随时在预设页切回其他预设
    if (document.getElementById('view-presets') && document.getElementById('view-presets').style.display !== 'none') renderPresetsPage();
    if (importedRegexCount > 0 && typeof renderRegexScriptsList === 'function') renderRegexScriptsList();
    if (importedRegexCount > 0) saveAllData();

    let msg = `✅ 已导入并启用预设「${preset.name}」，共 ${preset.prompts.length} 条模块（其中 ${enabledCount} 条按预设自带的启用状态默认勾选）。`;
    if (importedRegexCount > 0) msg += `\n🧩 同时自动导入并挂上了 ${importedRegexCount} 条配套正则脚本（在"设置 → AI增强功能"里可查看/调整）。`;
    msg += '\n可以到"预设"页面继续调整每条模块的开关/顺序/内容，或整体切换到其它预设。';
    appAlert(msg);
}
