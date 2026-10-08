// ✂️ 这个文件是从 06-emoticons-time-humanfeel-relationships-worldbook.js 拆出来的第 2 段（原来一个文件太大，改起来容易改坏）。
// 跟 06-emoticons-time-humanfeel-relationships-worldbook.js 以及同一组的其它段共用一个全局作用域，index.html 里的加载顺序不能换。

// ===== 世界书分类：标题栏右侧的筛选条 + 自定义/删除标签管理 =====
function renderWorldbookCategoryBar() {
    const bar = document.getElementById('wbCategoryBar');
    if (!bar) return;
    const uncategorizedCount = worldbooks.filter(w => !(w.category || '').trim()).length;
    const tags = [{ label: '全部', val: null }, ...worldbookCategories.map(cat => ({ label: cat, val: cat }))];
    if (uncategorizedCount > 0) tags.push({ label: `未分类(${uncategorizedCount})`, val: '__uncategorized__' });
    bar.innerHTML = tags.map(t => `<span class="group-tag" style="margin-left:0; background:${activeWbCategoryFilter === t.val ? '#7856ff' : 'rgba(120,86,255,0.15)'}; color:${activeWbCategoryFilter === t.val ? 'white' : '#7856ff'};" onclick="filterWorldbookByCategory(${t.val === null ? 'null' : `'${String(t.val).replace(/'/g, "\\'")}'`})">${escapeHtml(t.label)}</span>`).join('')
        + `<span class="group-tag" style="margin-left:0; background:rgba(29,155,240,0.1); color:#1d9bf0;" onclick="openWbCategoryManagerModal()" title="新增/删除分类标签">🏷️ 管理</span>`;
}

function filterWorldbookByCategory(cat) {
    activeWbCategoryFilter = cat;
    renderWorldbookCards();
}

// 世界书页面上面"卡片列表"和下面"新增/编辑表单"之间那条蓝色分界线的拖拽手柄：往上拖表单区变高
// （列表区相应变矮），往下拖表单区变矮。用 Pointer Events（同一套API自动兼容鼠标和触屏拖拽）实现。
function startWbFormResize(e, handleEl) {
    e.preventDefault();
    const dockEl = handleEl.nextElementSibling; // .wb-edit-form-dock，紧跟在这个手柄后面
    if (!dockEl) return;
    const startHeight = dockEl.getBoundingClientRect().height;
    const startY = e.clientY;
    // 拖拽期间不再受默认 55vh 上限约束，改由下面 Math.min 里的 85vh 接管，拖拽结束后这个临时提高的上限
    // 不影响什么（用户没继续拖，高度就停在当前这个像素值，不会自己再变回55vh）
    dockEl.style.maxHeight = '85vh';
    handleEl.setPointerCapture && handleEl.setPointerCapture(e.pointerId);

    function onMove(moveEvent) {
        const dy = moveEvent.clientY - startY; // 往上拖(dy为负)表单区变高，往下拖(dy为正)表单区变矮
        const newHeight = Math.max(120, Math.min(window.innerHeight * 0.85, startHeight - dy));
        dockEl.style.height = newHeight + 'px';
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

// ===== 通用工具：给"故事"和"角色专属世界书"这两处的选择列表复用世界书主页同款的分类筛选条 =====
function getWorldbooksFilteredByCategory(categoryFilter) {
    if (!categoryFilter) return worldbooks;
    if (categoryFilter === '__uncategorized__') return worldbooks.filter(w => !(w.category || '').trim());
    return worldbooks.filter(w => (w.category || '') === categoryFilter);
}
function buildWbCategoryFilterTagsHtml(categoryFilter, onClickFnName) {
    const uncategorizedCount = worldbooks.filter(w => !(w.category || '').trim()).length;
    const tags = [{ label: '全部', val: null }, ...worldbookCategories.map(cat => ({ label: cat, val: cat }))];
    if (uncategorizedCount > 0) tags.push({ label: `未分类(${uncategorizedCount})`, val: '__uncategorized__' });
    return tags.map(t => `<span class="group-tag" style="margin-left:0; background:${categoryFilter === t.val ? '#7856ff' : 'rgba(120,86,255,0.15)'}; color:${categoryFilter === t.val ? 'white' : '#7856ff'}; cursor:pointer;" onclick="${onClickFnName}(${t.val === null ? 'null' : `'${String(t.val).replace(/'/g, "\\'")}'`})">${escapeHtml(t.label)}</span>`).join('');
}

// ---------- 故事功能：世界书选择 ----------
function renderNovelWbCheckboxes() {
    const bar = document.getElementById('novelWbCategoryBar');
    if (bar) bar.innerHTML = worldbooks.length > 0 ? buildWbCategoryFilterTagsHtml(novelWbCategoryFilter, 'filterNovelWbByCategory') : '';
    const wbBox = document.getElementById('novelWbCheckboxes');
    if (!wbBox) return;
    if (worldbooks.length === 0) { wbBox.innerHTML = '<span style="color:#888;">暂无世界书。</span>'; return; }
    const filtered = getWorldbooksFilteredByCategory(novelWbCategoryFilter);
    if (filtered.length === 0) { wbBox.innerHTML = '<span style="color:#888;">该分类下暂无世界书。</span>'; return; }
    wbBox.innerHTML = filtered.map(w => `
        <label style="display:flex; align-items:center; gap:5px; background:rgba(255,255,255,0.8); padding:5px 10px; border-radius:9999px; border:1px solid #1d9bf0; cursor:pointer;">
            <input type="checkbox" class="novel-wb-check" value="${w.id}" ${novelWbPendingSelection.has(w.id) ? 'checked' : ''} onchange="toggleNovelWbPending(${w.id}, this.checked)">
            ${escapeHtml(w.title)}
        </label>`).join('');
}
function filterNovelWbByCategory(cat) { novelWbCategoryFilter = cat; renderNovelWbCheckboxes(); }
function toggleNovelWbPending(id, checked) { if (checked) novelWbPendingSelection.add(id); else novelWbPendingSelection.delete(id); }

// ---------- 角色表单：专属世界书选择 ----------
function renderCharFormWbCheckboxes() {
    const bar = document.getElementById('charWbCategoryBar');
    if (bar) bar.innerHTML = worldbooks.length > 0 ? buildWbCategoryFilterTagsHtml(charFormWbCategoryFilter, 'filterCharFormWbByCategory') : '';
    const wbBox = document.getElementById('charWbCheckboxes');
    if (!wbBox) return;
    if (worldbooks.length === 0) { wbBox.innerHTML = '<span style="color:#536471; font-size:13px;">暂无世界书</span>'; return; }
    const filtered = getWorldbooksFilteredByCategory(charFormWbCategoryFilter);
    if (filtered.length === 0) { wbBox.innerHTML = '<span style="color:#536471; font-size:13px;">该分类下暂无世界书</span>'; return; }
    wbBox.innerHTML = filtered.map(w => `<label style="display:flex; align-items:center; gap:4px; font-size:13px;"><input type="checkbox" value="${w.id}" class="wb-check" ${charFormWbPendingSelection.has(w.id) ? 'checked' : ''} onchange="toggleCharFormWbPending(${w.id}, this.checked)"> ${escapeHtml(w.title)}</label>`).join('');
}
function filterCharFormWbByCategory(cat) { charFormWbCategoryFilter = cat; renderCharFormWbCheckboxes(); }
function toggleCharFormWbPending(id, checked) { if (checked) charFormWbPendingSelection.add(id); else charFormWbPendingSelection.delete(id); }

function openWbCategoryManagerModal() { renderWbCategoryList(); openModal('wbCategoryManagerModal'); }

function renderWbCategoryList() {
    const c = document.getElementById('wbCategoryListContainer');
    if (!c) return;
    if (worldbookCategories.length === 0) { c.innerHTML = '<div style="color:#536471; font-size:13px; padding:8px 0;">暂无分类，添加一个吧！</div>'; return; }
    c.innerHTML = worldbookCategories.map((cat, i) => `<div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eff3f4;">
        <span style="font-size:15px; display:flex; align-items:center; gap:8px;">
            🏷️ <input type="text" value="${escapeHtml(cat)}" style="border:1px solid transparent; background:transparent; font-size:15px; width:150px; outline:none; color:#7856ff;" onfocus="this.style.border='1px solid #7856ff'; this.style.borderRadius='4px';" onblur="this.style.border='1px solid transparent'; editWbCategory(${i}, this.value)">
            <span style="color:#536471; font-size:12px;">(${worldbooks.filter(w => (w.category || '') === cat).length} 条)</span>
        </span>
        <button onclick="deleteWbCategory(${i})" style="background:none; border:none; color:#f91880; cursor:pointer; font-size:18px; padding:2px 6px;">×</button>
    </div>`).join('');
}

function addWbCategory() {
    const input = document.getElementById('newWbCategoryInput');
    const val = input.value.trim();
    if (!val) return;
    if (worldbookCategories.includes(val)) return alert("该分类已存在！");
    worldbookCategories.push(val);
    input.value = '';
    renderWbCategoryList();
    renderWorldbookCategoryBar();
    refreshWbCategorySelect();
    saveAllData();
}

function editWbCategory(idx, newVal) {
    newVal = newVal.trim();
    if (!newVal || newVal === worldbookCategories[idx]) { renderWbCategoryList(); return; }
    if (worldbookCategories.includes(newVal)) { alert("分类名已存在"); renderWbCategoryList(); return; }
    const oldCat = worldbookCategories[idx];
    worldbookCategories[idx] = newVal;
    worldbooks.forEach(w => { if ((w.category || '') === oldCat) w.category = newVal; });
    if (activeWbCategoryFilter === oldCat) activeWbCategoryFilter = newVal;
    renderWbCategoryList();
    renderWorldbookCategoryBar();
    refreshWbCategorySelect();
    renderWorldbookCards();
    saveAllData();
}

async function deleteWbCategory(idx) {
    const catName = worldbookCategories[idx];
    const affected = worldbooks.filter(w => (w.category || '') === catName);
    if (!(await appConfirm(`删除分类"${catName}"？`))) return;

    // 分类下如果还挂着世界书，多问一步：只删标签、世界书本身保留变回"无分类"（老行为，默认更安全），
    // 还是连这些世界书本身也一起删掉（适合"这个分类整个不要了、里面的设定也不需要了"的场景）。
    let alsoDeleteEntries = false;
    if (affected.length > 0) {
        alsoDeleteEntries = await appConfirm(
            `这个分类下还有 ${affected.length} 本世界书，要连世界书本身也一起删除吗？\n选"一起删除"会把这些世界书彻底删掉，不可恢复；选"仅删分类"只是去掉分类标签，世界书本身完整保留（变回"无分类"）。`,
            '一起删除世界书', '仅删分类，保留世界书'
        );
    }

    if (alsoDeleteEntries) {
        const idsToRemove = new Set(affected.map(w => w.id));
        worldbooks = worldbooks.filter(w => !idsToRemove.has(w.id));
        myCharacters.forEach(c => { if (c.worldbooks) c.worldbooks = c.worldbooks.filter(wid => !idsToRemove.has(wid)); });
    } else {
        worldbooks.forEach(w => { if ((w.category || '') === catName) w.category = ''; });
    }

    if (activeWbCategoryFilter === catName) activeWbCategoryFilter = null;
    worldbookCategories.splice(idx, 1);
    renderWbCategoryList();
    renderWorldbookCategoryBar();
    refreshWbCategorySelect();
    renderWorldbookCards();
    saveAllData();
}

function refreshWbCategorySelect() {
    const sel = document.getElementById('newWbCategory');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">-- 无分类 --</option>' + worldbookCategories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
    if (worldbookCategories.includes(cur)) sel.value = cur;
}

function toggleWorldbookGlobal(id) {
    let wb = worldbooks.find(w => w.id === id);
    if(wb) { 
        wb.isGlobal = !wb.isGlobal; 
        saveAllData(); 
        renderWorldbookCards();
    }
}

// 世界书表单的"插入位置"下拉框改成"插入深度(@Depth)"时，才需要显示身份/深度这两个额外输入框
function onWbPositionChange() {
    const posEl = document.getElementById('newWbPosition');
    const box = document.getElementById('newWbDepthBox');
    if (!posEl || !box) return;
    box.style.display = (posEl.value === 'at_depth') ? 'inline-flex' : 'none';
}

function saveWorldbook() {
    const id = document.getElementById('editWbId').value;
    const title = document.getElementById('newWbTitle').value.trim();
    const content = document.getElementById('newWbContent').value.trim();
    const weight = Math.max(0, Math.min(100, parseInt(document.getElementById('newWbWeight').value) || 50));
    // 抓取关键词
    const keywords = document.getElementById('newWbKeywords') ? document.getElementById('newWbKeywords').value.trim() : '';
    const priority = parseInt(document.getElementById('newWbPriority')?.value) || 0;
    const group = document.getElementById('newWbGroup')?.value.trim() || '';
    const recursive = !!document.getElementById('newWbRecursive')?.checked;
    const category = document.getElementById('newWbCategory')?.value || '';
    const validPositions = ['before_persona', 'after_persona', 'before_example', 'after_example', 'before_an', 'after_an', 'end', 'at_depth'];
    const positionRaw = document.getElementById('newWbPosition')?.value;
    const position = validPositions.includes(positionRaw) ? positionRaw : 'after_persona';
    const depthRoleRaw = document.getElementById('newWbDepthRole')?.value;
    const depthRole = (depthRoleRaw === 'user' || depthRoleRaw === 'assistant') ? depthRoleRaw : 'system';
    const depth = Math.max(0, parseInt(document.getElementById('newWbDepth')?.value) || 0);
    // 次要关键词/触发节奏（仿照同类软件 World Info的sticky/cooldown/delay/概率触发），只在聊天里真正生效
    const secondaryKeywords = document.getElementById('newWbSecondaryKeywords')?.value.trim() || '';
    const secondaryLogic = document.getElementById('newWbSecondaryLogic')?.value || 'and_any';
    const stickyTurns = Math.max(0, parseInt(document.getElementById('newWbSticky')?.value) || 0);
    const cooldownTurns = Math.max(0, parseInt(document.getElementById('newWbCooldown')?.value) || 0);
    const delayTurns = Math.max(0, parseInt(document.getElementById('newWbDelay')?.value) || 0);
    const probability = Math.max(0, Math.min(100, parseInt(document.getElementById('newWbProbability')?.value) ?? 100));

    if(!title || !content) return alert("请完整填写标题和内容");

    if (id) {
        const wb = worldbooks.find(w => w.id == id);
        if (wb) { wb.title = title; wb.content = content; wb.weight = weight; wb.keywords = keywords; wb.priority = priority; wb.group = group; wb.recursive = recursive; wb.category = category; wb.secondaryKeywords = secondaryKeywords; wb.secondaryLogic = secondaryLogic; wb.stickyTurns = stickyTurns; wb.cooldownTurns = cooldownTurns; wb.delayTurns = delayTurns; wb.probability = probability; wb.position = position; wb.depthRole = depthRole; wb.depth = depth; }
    } else {
        worldbooks.push({ id: Date.now(), title, content, isGlobal: false, weight, keywords, priority, group, recursive, category, secondaryKeywords, secondaryLogic, stickyTurns, cooldownTurns, delayTurns, probability, position, depthRole, depth });
    }
    cancelEditWb(); renderWorldbookCards(); saveAllData();
}

function editWorldbook(id) {
    const wb = worldbooks.find(w => w.id === id);
    if(!wb) return;
    document.getElementById('editWbId').value = wb.id;
    document.getElementById('newWbTitle').value = wb.title;
    document.getElementById('newWbContent').value = wb.content;
    // 打开编辑已有条目时，先按内容量给个还算合适的初始高度（封顶380px，避免正文特别长时把表单其它部分挤到很远），
    // 之后用户还是可以用下面那个拖拽手柄自己再调，两者不冲突。
    const wbContentEl = document.getElementById('newWbContent');
    wbContentEl.style.height = Math.max(90, Math.min(380, wbContentEl.scrollHeight)) + 'px';
    document.getElementById('newWbWeight').value = wb.weight ?? 50;
    if(document.getElementById('newWbKeywords')) document.getElementById('newWbKeywords').value = wb.keywords || '';
    if(document.getElementById('newWbPriority')) document.getElementById('newWbPriority').value = wb.priority ?? 0;
    if(document.getElementById('newWbGroup')) document.getElementById('newWbGroup').value = wb.group || '';
    if(document.getElementById('newWbRecursive')) document.getElementById('newWbRecursive').checked = !!wb.recursive;
    if(document.getElementById('newWbPosition')) document.getElementById('newWbPosition').value = ['before_persona', 'before_example', 'after_example', 'before_an', 'after_an', 'end', 'at_depth'].includes(wb.position) ? wb.position : 'after_persona';
    if(document.getElementById('newWbDepthRole')) document.getElementById('newWbDepthRole').value = (wb.depthRole === 'user' || wb.depthRole === 'assistant') ? wb.depthRole : 'system';
    if(document.getElementById('newWbDepth')) document.getElementById('newWbDepth').value = wb.depth ?? 4;
    onWbPositionChange();
    if(document.getElementById('newWbSecondaryKeywords')) document.getElementById('newWbSecondaryKeywords').value = wb.secondaryKeywords || '';
    if(document.getElementById('newWbSecondaryLogic')) document.getElementById('newWbSecondaryLogic').value = wb.secondaryLogic || 'and_any';
    if(document.getElementById('newWbSticky')) document.getElementById('newWbSticky').value = wb.stickyTurns ?? 0;
    if(document.getElementById('newWbCooldown')) document.getElementById('newWbCooldown').value = wb.cooldownTurns ?? 0;
    if(document.getElementById('newWbDelay')) document.getElementById('newWbDelay').value = wb.delayTurns ?? 0;
    if(document.getElementById('newWbProbability')) document.getElementById('newWbProbability').value = wb.probability ?? 100;
    refreshWbCategorySelect();
    if(document.getElementById('newWbCategory')) document.getElementById('newWbCategory').value = wb.category || '';
    document.getElementById('wbFormTitle').innerText = "编辑世界书设定";
    document.getElementById('saveWbBtn').innerText = "保存修改";
    document.getElementById('cancelWbBtn').style.display = 'block';
}

function cancelEditWb() {
    document.getElementById('editWbId').value = '';
    document.getElementById('newWbTitle').value = '';
    document.getElementById('newWbContent').value = '';
    document.getElementById('newWbContent').style.height = '';
    document.getElementById('newWbWeight').value = 50;
    if(document.getElementById('newWbKeywords')) document.getElementById('newWbKeywords').value = '';
    if(document.getElementById('newWbPriority')) document.getElementById('newWbPriority').value = 0;
    if(document.getElementById('newWbGroup')) document.getElementById('newWbGroup').value = '';
    if(document.getElementById('newWbRecursive')) document.getElementById('newWbRecursive').checked = false;
    if(document.getElementById('newWbPosition')) document.getElementById('newWbPosition').value = 'after_persona';
    if(document.getElementById('newWbDepthRole')) document.getElementById('newWbDepthRole').value = 'system';
    if(document.getElementById('newWbDepth')) document.getElementById('newWbDepth').value = 4;
    onWbPositionChange();
    if(document.getElementById('newWbSecondaryKeywords')) document.getElementById('newWbSecondaryKeywords').value = '';
    if(document.getElementById('newWbSecondaryLogic')) document.getElementById('newWbSecondaryLogic').value = 'and_any';
    if(document.getElementById('newWbSticky')) document.getElementById('newWbSticky').value = 0;
    if(document.getElementById('newWbCooldown')) document.getElementById('newWbCooldown').value = 0;
    if(document.getElementById('newWbDelay')) document.getElementById('newWbDelay').value = 0;
    if(document.getElementById('newWbProbability')) document.getElementById('newWbProbability').value = 100;
    if(document.getElementById('newWbCategory')) document.getElementById('newWbCategory').value = '';
    document.getElementById('wbFormTitle').innerText = "新增世界书设定";
    document.getElementById('saveWbBtn').innerText = "添加并保存";
    document.getElementById('cancelWbBtn').style.display = 'none';
}

async function deleteWorldbook(id) {
    if(!(await appConfirm("确定要删除这本世界书吗？"))) return;
    worldbooks = worldbooks.filter(w => w.id !== id); 
    myCharacters.forEach(c => {
        if(c.worldbooks) c.worldbooks = c.worldbooks.filter(wid => wid !== id);
    });
    renderWorldbookCards(); 
    saveAllData(); 
}

function openGroupManagerModal() { renderGroupList(); openModal('groupManagerModal'); }
function renderGroupList() {
    const c = document.getElementById('groupListContainer');
    if (characterGroups.length === 0) { c.innerHTML = '<div style="color:#536471; font-size:13px; padding:8px 0;">暂无分组，添加一个吧！</div>'; return; }
    c.innerHTML = characterGroups.map((g, i) => `<div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eff3f4;"><span style="font-size:15px; display:flex; align-items:center; gap:8px;"><svg class="blue-line-icon" style="width:16px;height:16px;" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> <input type="text" value="${g}" style="border:1px solid transparent; background:transparent; font-size:15px; width:150px; outline:none; color:#1d9bf0;" onfocus="this.style.border='1px solid #1d9bf0'; this.style.borderRadius='4px';" onblur="this.style.border='1px solid transparent'; editGroup(${i}, this.value)"><span style="color:#536471; font-size:12px;">(${myCharacters.filter(c=>charInFaction(c,g)).length} 人)</span></span><button onclick="deleteGroup(${i})" style="background:none; border:none; color:#f91880; cursor:pointer; font-size:18px; padding:2px 6px;">×</button></div>`).join('');
}
function addGroup() { const val = document.getElementById('newGroupInput').value.trim(); if (!val) return; if (characterGroups.includes(val)) return alert("分组已存在！"); characterGroups.push(val); document.getElementById('newGroupInput').value = ''; renderGroupList(); saveAllData(); }
function editGroup(idx, newVal) { newVal = newVal.trim(); if (!newVal || newVal === characterGroups[idx]) { renderGroupList(); return; } if (characterGroups.includes(newVal)) { alert("分组名已存在"); renderGroupList(); return; } const oldGroup = characterGroups[idx]; characterGroups[idx] = newVal; renameFactionEverywhere(oldGroup, newVal); renderGroupList(); refreshGroupFilterBar(); saveAllData(); }
async function deleteGroup(idx) { const groupName = characterGroups[idx]; if (!(await appConfirm(`删除分组"${groupName}"？该分组下的角色会被移出这个势力（如果还属于别的势力，那些不受影响）。`))) return; removeFactionEverywhere(groupName); characterGroups.splice(idx, 1); renderGroupList(); saveAllData(); }
function filterByGroup(g) { activeGroupFilter = g; renderCenterCharList(); }
function refreshGroupFilterBar() {
    const bar = document.getElementById('groupFilterBar'); const tags = [{ label: '全部', val: null, color: 'white' }, ...characterGroups.map(g => ({ label: g, val: g, color: 'white' }))];
    bar.innerHTML = tags.map(t => `<span class="group-tag" style="background:${activeGroupFilter === t.val ? '#1d9bf0' : t.color}; color:${activeGroupFilter === t.val ? 'white' : '#1d9bf0'}; border:1px solid #1d9bf0;" onclick="filterByGroup(${t.val === null ? 'null' : `'${t.val}'`})">${t.label}</span>`).join('');
}
// 🏴 角色表单里的势力选择：从单选下拉换成多选复选框（一个角色可以同时属于多个势力）。
// selected 是当前应该勾上的势力名数组；不传就保留界面上已经勾着的（重画分组列表时不丢用户的选择）。
function refreshGroupSelect(selected) {
    const box = document.getElementById('charGroupChecks');
    if (!box) return;
    const keep = selected || Array.from(box.querySelectorAll('input:checked')).map(i => i.value);
    if (characterGroups.length === 0) {
        box.innerHTML = '<div style="font-size:12px; color:#8b98a5;">还没有创建任何势力。可以先去「势力总览」建一个，或者留空（＝势力不明）。</div>';
        return;
    }
    box.innerHTML = characterGroups.map(g => `
        <label class="gy-faction-check">
            <input type="checkbox" value="${escapeHtml(g)}" ${keep.includes(g) ? 'checked' : ''}>
            <span>${escapeHtml(g)}</span>
        </label>`).join('');
}
// 读表单里勾了哪些势力
function readCharFormFactions() {
    const box = document.getElementById('charGroupChecks');
    if (!box) return [];
    return Array.from(box.querySelectorAll('input:checked')).map(i => i.value);
}

function getCharRecentPosts(charId, limit = 20) { return globalPosts.filter(p => p.char.id == charId && !p.isStory).slice(0, limit); }
function openMemoryModal(charId) {
    const char = myCharacters.find(c => c.id == charId); if (!char) return;
    memoryViewingCharId = charId;
    currentSummaryCharId = charId; // 两个变量保持一致，避免其它入口（比如聊天选项）读取的时候对不上角色
    document.getElementById('memoryModalTitle').innerText = `${char.name} 的记忆管理`;
    document.getElementById('memoryEditArea').value = char.memorySummary || '';
    document.getElementById('chatSummaryEditArea').value = char.chatSummary || '';
    openModal('memoryModal');
}
function saveCharMemory() {
    const char = myCharacters.find(c => c.id == memoryViewingCharId); if (!char) return;
    char.memorySummary = document.getElementById('memoryEditArea').value.trim();
    char.chatSummary = document.getElementById('chatSummaryEditArea').value.trim();
    saveAllData();
    alert('记忆已成功保存！');
    closeModal('memoryModal');
}

// 打开"记忆总览"页面并直接定位到指定角色/群聊——取代原来那个小弹窗(openMemoryModal)，
// 展示的数据也从"聊天总结+推文记忆总结"两块扩到了全部记忆相关数据。
function openMemoryHub(targetId) {
    switchMainView('memoryHub');
    const sel = document.getElementById('memoryHubTargetSelect');
    if (sel && targetId) { sel.value = targetId; }
    selectMemoryHubTarget(targetId);
}

// ===================== 🧠 记忆总览（独立页面，不放在设置里）=====================
// 把角色/群聊身上所有"AI自动记了什么、总结了什么"的数据——聊天总结、推文记忆总结、群聊总结、
// 向量记忆（哪些消息已经被embedding、可以被语义检索到）、记忆召回库、专属资料库、MVU状态快照——
// 集中在这一个页面查看，不用再东一块（设置里的AI增强功能）西一块（角色卡的记忆小弹窗）地翻。
function renderMemoryHubTargetOptions() {
    const sel = document.getElementById('memoryHubTargetSelect');
    if (!sel) return;
    const emptyState = document.getElementById('memoryHubEmptyState');
    const content = document.getElementById('memoryHubContent');
    if (myCharacters.length === 0 && (!groupChats || groupChats.length === 0)) {
        if (emptyState) emptyState.style.display = 'block';
        if (content) content.style.display = 'none';
        sel.innerHTML = '';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';
    let optionsHtml = '';
    if (myCharacters.length > 0) optionsHtml += `<optgroup label="角色">` + myCharacters.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('') + `</optgroup>`;
    if (groupChats && groupChats.length > 0) optionsHtml += `<optgroup label="群聊">` + groupChats.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('') + `</optgroup>`;
    sel.innerHTML = optionsHtml;
    // 保持上次选中的目标（如果还存在），否则默认选第一个
    const stillExists = currentMemoryHubTargetId && (myCharacters.some(c => c.id == currentMemoryHubTargetId) || (groupChats || []).some(g => g.id === currentMemoryHubTargetId));
    const targetId = stillExists ? currentMemoryHubTargetId : (myCharacters[0]?.id || (groupChats[0] && groupChats[0].id));
    if (targetId) { sel.value = targetId; selectMemoryHubTarget(targetId); }
}

function selectMemoryHubTarget(id) {
    // 换人之前先把这一个人框里改了没存的存下来——以前一切换，刚写的总结就被新角色的内容盖掉了
    try { if (currentMemoryHubTargetId && currentMemoryHubTargetId != id && __memHubDirty) saveMemoryHubSummaries(true); } catch (e) {}
    currentMemoryHubTargetId = id;
    const content = document.getElementById('memoryHubContent');
    if (!id) { if (content) content.style.display = 'none'; return; }
    if (content) content.style.display = 'block';
    renderMemoryHubContent();
}

function renderMemoryHubContent() {
    const id = currentMemoryHubTargetId;
    if (!id) return;
    const isGroup = id.toString().startsWith('g_');
    const char = isGroup ? null : myCharacters.find(c => c.id == id);
    const group = isGroup ? groupChats.find(g => g.id === id) : null;

    // 聊天总结：群聊存的是 group.summary，单聊是 char.chatSummary，共用同一个文本框
    const chatSummaryArea = document.getElementById('memHubChatSummaryArea');
    if (chatSummaryArea) chatSummaryArea.value = isGroup ? (group?.summary || '') : (char?.chatSummary || '');

    // 推文记忆总结：只有角色才有（群聊不发推文），是群聊就整块隐藏
    const postWrap = document.getElementById('memHubPostMemoryWrap');
    if (postWrap) postWrap.style.display = isGroup ? 'none' : '';
    const postArea = document.getElementById('memHubPostSummaryArea');
    if (postArea) postArea.value = (!isGroup && char) ? (char.memorySummary || '') : '';

    // 所在群聊的总结：只有查看角色时才展示（列出这个角色所在的每个群聊各自的总结）
    const groupWrap = document.getElementById('memHubGroupSummaryWrap');
    const groupList = document.getElementById('memHubGroupSummaryList');
    if (groupWrap && groupList) {
        if (isGroup) { groupWrap.style.display = 'none'; }
        else {
            const myGroups = (groupChats || []).filter(g => Array.isArray(g.members) && g.members.includes(id) && g.summary);
            if (myGroups.length === 0) { groupWrap.style.display = 'none'; }
            else {
                groupWrap.style.display = '';
                groupList.innerHTML = myGroups.map(g => `
                    <div style="background:white; padding:10px; border-radius:6px; border:1px solid #eff3f4;">
                        <div style="font-size:13px; font-weight:bold; color:#1d9bf0; margin-bottom:4px;">${escapeHtml(g.name)}</div>
                        <div style="font-size:12px; color:#536471; white-space:pre-wrap;">${escapeHtml(g.summary)}</div>
                    </div>`).join('');
            }
        }
    }

    renderMemoryHubVectorMemory(id, isGroup);
    if (typeof renderMemoryEntriesList === 'function') renderMemoryEntriesList(id);
    renderMemoryHubDataBank(id, isGroup);
    renderMemoryHubMvuSnapshot(id);
}

let __memHubDirty = false;
function saveMemoryHubSummaries(quiet) {
    const id = currentMemoryHubTargetId;
    if (!id) return;
    const isGroup = id.toString().startsWith('g_');
    const chatSummaryArea = document.getElementById('memHubChatSummaryArea');
    if (isGroup) {
        const group = groupChats.find(g => g.id === id);
        if (group && chatSummaryArea) group.summary = chatSummaryArea.value.trim();
    } else {
        const char = myCharacters.find(c => c.id == id);
        if (char) {
            if (chatSummaryArea) char.chatSummary = chatSummaryArea.value.trim();
            const postArea = document.getElementById('memHubPostSummaryArea');
            if (postArea) char.memorySummary = postArea.value.trim();
        }
    }
    __memHubDirty = false;
    saveAllData();
    if (!quiet) gyMemHubSaved('记忆已保存');
}

function saveMemoryHubIntervals(quiet) {
    chatSummaryInterval = gyNum(document.getElementById('memHubChatSummaryInterval')?.value, 20);
    groupSummaryInterval = gyNum(document.getElementById('memHubGroupSummaryInterval')?.value, 50);
    postMemoryInterval = gyNum(document.getElementById('memHubPostMemoryInterval')?.value, 20);
    // 🗓️ 日程归档保留天数：改小了不会立刻删掉已有记录，下一次归档时才会裁到新长度
    const keepEl = document.getElementById('memHubScheduleKeep');
    if (keepEl) scheduleHistoryKeep = gyNum(keepEl.value, 14);
    // 🟢 状态记录保留天数：0 ＝ 一直留着。改小了立刻把每个角色超出的那部分清掉
    const stKeepEl = document.getElementById('memHubStatusKeep');
    if (stKeepEl && stKeepEl.value !== '') {
        statusLogKeepDays = gyNum(stKeepEl.value, 60);
        (myCharacters || []).forEach(c => { if (typeof gyStatusLogTrim === 'function') gyStatusLogTrim(c); });
    }
    // 🎭 小剧场保留条数：0 ＝ 不限（默认）。跟日程一样，改小了不会立刻删，下次写入新记录时才裁。
    const thKeepEl = document.getElementById('memHubTheaterKeep');
    if (thKeepEl) {
        const raw = parseInt(thKeepEl.value);
        theaterLogKeep = (isNaN(raw) || raw <= 0) ? 0 : raw;
    }
    saveAllData();
    if (!quiet) gyMemHubSaved('总结频率已保存');
}

// 💾 记忆总览一键保存：这一页上所有能改的东西一次存掉。
// 🐛 以前的坑：「向量记忆总开关」「检索字数上限」这两项**只有**设置页底部那个「保存设置」才会存，
//    在记忆总览里勾了、改了，离开页面就没了——这就是"老存不上"。现在这里一个键全存，
//    而且勾选/改数字/改总结的时候也会自动存一次。
function saveMemoryHubAll(quiet) {
    try { saveMemoryHubSummaries(true); } catch (e) { console.warn(e); }
    try { saveMemoryHubIntervals(true); } catch (e) { console.warn(e); }
    try {
        const ev = document.getElementById('enableVectorMemory'); if (ev) enableVectorMemory = !!ev.checked;
        const sb = document.getElementById('semanticCharBudgetInput'); if (sb && sb.value !== '') semanticCharBudget = gyNum(sb.value, semanticCharBudget);
        if (document.getElementById('embeddingModelSelect') && typeof saveEmbeddingModelSelection === 'function') saveEmbeddingModelSelection();
        if (document.getElementById('vecApiUrlInput') && typeof saveVectorApiSettings === 'function') saveVectorApiSettings();
    } catch (e) { console.warn(e); }
    saveAllData();
    if (!quiet) gyMemHubSaved('这一页都保存好了');
}
function gyMemHubSaved(msg) {
    try { if (typeof showToast === 'function') showToast('', '💾 记忆总览', msg, null, null, false); else alert(msg); } catch (e) {}
    document.querySelectorAll('.memhub-save-status').forEach(el => { el.innerText = '✓ ' + msg + '（' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + '）'; });
}
// 自动存：总结框打字停下来一秒存一次；开关、数字框一改就存
(function gyMemHubAutoSave() {
    let t = null;
    document.addEventListener('input', function (e) {
        const el = e.target;
        if (!el || !el.closest || !el.closest('#view-memory-hub')) return;
        if (el.id === 'memHubChatSummaryArea' || el.id === 'memHubPostSummaryArea') {
            __memHubDirty = true;
            clearTimeout(t);
            t = setTimeout(() => { try { saveMemoryHubSummaries(true); document.querySelectorAll('.memhub-save-status').forEach(s => { s.innerText = '✓ 已自动保存'; }); } catch (err) {} }, 1000);
        }
    }, true);
    document.addEventListener('change', function (e) {
        const el = e.target;
        if (!el || !el.closest || !el.closest('#view-memory-hub')) return;
        if (el.id === 'enableVectorMemory' || el.id === 'semanticCharBudgetInput' || /^memHub(ChatSummary|GroupSummary|PostMemory)Interval$|^memHub(Schedule|Theater|Status)Keep$/.test(el.id || '')) {
            try { saveMemoryHubAll(true); document.querySelectorAll('.memhub-save-status').forEach(s => { s.innerText = '✓ 已自动保存'; }); } catch (err) {}
        }
    }, true);
})();

// 向量记忆浏览：这个角色/群聊的聊天记录里，哪些消息被打上了 embVec（说明已经进了语义检索库），
// 直接列出来，比"完全看不见记了什么"直观得多；也支持单条"忘记"（清掉embVec，下次检索就不会再命中它）。
// 除了聊天消息，日记/信件/小说/论坛/匿名论坛这些"角色自己写的内容"（走 collectCharVectorCandidates 收集，
// 跟 getSemanticContext 检索时用的是同一份逻辑）也在这里一起展示，不用切来切去分别确认好几处有没有生效。
async function renderMemoryHubVectorMemory(sessionId, isGroup) {
    const statsEl = document.getElementById('memHubVectorStats');
    const listEl = document.getElementById('memHubVectorList');
    if (!statsEl || !listEl) return;
    const history = globalChats[sessionId] || [];
    const embedded = history.map((m, idx) => ({ m, idx })).filter(x => x.m.embVec);

    const char = isGroup ? null : myCharacters.find(c => c.id == sessionId);
    const charCandidates = (char && typeof collectCharVectorCandidates === 'function') ? await collectCharVectorCandidates(char) : [];
    const charEmbedded = charCandidates.filter(it => it.ref.embVec);
    // 缓存这一轮收集到的候选列表，供下面"忘记"按钮按下标定位对应条目
    window.__memHubCharVectorCandidatesCache = window.__memHubCharVectorCandidatesCache || {};
    window.__memHubCharVectorCandidatesCache[sessionId] = charCandidates;

    if (!enableVectorMemory) {
        statsEl.innerHTML = `⚪ 向量记忆总开关当前是关闭的（上面可以打开），已经存过的向量还在，只是不会再被检索使用。`;
    } else {
        // ⚠️ 以前这里只写"已向量化 83 / 260"，然后一句"会自动补算，不用手动操作"——
        //    可实际上聊天消息只在**发出的那一刻**算一次，你聊到一半才打开向量记忆的，
        //    之前那几百条永远轮不上；日记那一批要等真的走到检索那一步才补。
        //    所以数字会停在那儿不动，而且失败了也不说话。现在把话说清楚，并给一个"点了就补"。
        const short = history.filter(m => m && m.text && !m.embVec && typeof window.gyVecTooShort === 'function' && window.gyVecTooShort(m.text)).length;
        const todo  = history.filter(m => m && m.text && !m.embVec && !(typeof window.gyVecTooShort === 'function' && window.gyVecTooShort(m.text))).length;
        const dataTodo = charCandidates.length - charEmbedded.length;
        statsEl.innerHTML =
            `聊天消息：已算 <b>${embedded.length}</b> / ${history.length} 条`
            + (short ? `　·　${short} 条太短（10 字以内，本来就不算）` : '')
            + (todo ? `　·　<b style="color:var(--gy-warn,#ffad1f);">还差 ${todo} 条</b>` : '')
            + (char ? `<br>日记 / 信件 / 小说 / 论坛：已算 <b>${charEmbedded.length}</b> / ${charCandidates.length} 条`
                     + (dataTodo ? `　·　<b style="color:var(--gy-warn,#ffad1f);">还差 ${dataTodo} 条</b>` : '') : '')
            + ((todo + dataTodo) ? `
                <div style="margin-top:8px; font-size:12px; color:#8b98a5; line-height:1.8;">
                  没算上的多半是<b>你打开向量记忆之前就存在的旧内容</b>——聊天消息只在发出的那一刻后台算一次，
                  不会自己回头补；日记那一批要等真的聊到、走到检索那一步才顺手补。点下面这颗一次补齐。
                </div>
                <button type="button" class="btn-edit-small" style="margin-top:8px;"
                    onclick="gyVecBackfillNow('${sessionId}', ${!!isGroup})">▶ 现在补算这 ${todo + dataTodo} 条</button>
                ${(() => { const all = (typeof window.gyVecTodoCount === 'function') ? window.gyVecTodoCount() : null;
                    return (all && all.todo > todo) ? `<button type="button" class="btn-edit-small" style="margin-top:8px;"
                        onclick="gyVecBackfillAllNow()">▶▶ 所有角色一起补（全项目还差 ${all.todo} 条）</button>` : ''; })()}
                <span id="memHubVecProg" style="font-size:12px; color:#8b98a5; margin-left:8px;"></span>
                <div style="margin-top:6px; font-size:12px; color:#8b98a5; line-height:1.8;">
                  不想每次手动点的话，去 <span style="color:var(--gy-accent);cursor:pointer;text-decoration:underline;"
                  onclick="switchMainView('settings'); setTimeout(()=>openSettingsPanel('auto'),200);">设置 → 🔌 自动功能 → 记忆</span>
                  把「向量记忆自动补算旧内容」打开，它会每两分钟悄悄补 8 条，数字自己往上走。
                </div>`
              : `<div style="margin-top:6px; font-size:12px; color:#8b98a5;">该算的都算过了。</div>`)
            + (window.gyVecLastErr ? `<div style="margin-top:8px; padding:8px 10px; border-radius:8px;
                 background:rgba(249,24,128,.08); border:1px solid rgba(249,24,128,.3); font-size:12px; line-height:1.8;">
                 ⚠️ 上次算向量失败了：${escapeHtml(window.gyVecLastErr)}<br>
                 <span style="color:#8b98a5;">Embedding 用的是「向量记忆专用API」（没填就走主 API），模型名要填 embedding 模型
                 （比如 text-embedding-3-small），填成聊天模型是不行的。</span></div>` : '');
    }
    if (embedded.length === 0 && charEmbedded.length === 0) {
        listEl.innerHTML = '<div style="color:#8b98a5; font-size:13px;">还没有任何内容被记入向量记忆（内容太短，或者还没触发向量化）</div>';
        return;
    }
    const kindLabel = { diary: '📔 日记', letter: '✉️ 信件', novel: '📖 小说', forum: '💬 论坛', anon: '🕶️ 匿名论坛' };
    let html = embedded.slice().reverse().map(x => {
        const senderName = x.m.sender === 'me' ? (currentUser?.name || '我') : (x.m.sender === 'system' ? '系统' : (myCharacters.find(c => c.id == x.m.sender)?.name || x.m.sender));
        const timeStr = x.m.timestamp ? new Date(x.m.timestamp).toLocaleString('zh-CN') : '';
        const preview = (x.m.text || '').length > 150 ? x.m.text.slice(0, 150) + '……' : (x.m.text || '');
        return `<div style="background:white; padding:8px; border-radius:6px; border:1px solid #eff3f4;">
            <div style="font-size:11px; color:#8b98a5; margin-bottom:2px;">💬 聊天 · ${escapeHtml(senderName)} · ${timeStr}</div>
            <div style="font-size:13px; color:#0f1419; white-space:pre-wrap; word-break:break-all;">${escapeHtml(preview)}</div>
            <div style="text-align:right; margin-top:4px;"><span style="color:#f91880; font-size:12px; cursor:pointer;" onclick="forgetVectorMemoryEntry('${sessionId}', ${x.idx})">🗑️ 忘记</span></div>
        </div>`;
    }).join('');
    html += charEmbedded.slice().reverse().map(it => {
        const preview = it.text.length > 150 ? it.text.slice(0, 150) + '……' : it.text;
        const idx = charCandidates.indexOf(it);
        return `<div style="background:white; padding:8px; border-radius:6px; border:1px solid #eff3f4;">
            <div style="font-size:11px; color:#8b98a5; margin-bottom:2px;">${kindLabel[it.kind] || it.kind} · ${escapeHtml(it.label)}</div>
            <div style="font-size:13px; color:#0f1419; white-space:pre-wrap; word-break:break-all;">${escapeHtml(preview)}</div>
            <div style="text-align:right; margin-top:4px;"><span style="color:#f91880; font-size:12px; cursor:pointer;" onclick="forgetCharVectorEntry('${sessionId}', ${idx})">🗑️ 忘记</span></div>
        </div>`;
    }).join('');
    listEl.innerHTML = html;
}
// 「▶▶ 所有角色一起补」
async function gyVecBackfillAllNow() {
    const say = m => { const e = document.getElementById('memHubVecProg'); if (e) e.innerText = m; };
    if (typeof window.gyVecBackfillAll !== 'function') return;
    say('开始…');
    const r = await window.gyVecBackfillAll(say);
    setTimeout(() => { try {
        const id = (typeof currentMemoryHubTargetId !== 'undefined') ? currentMemoryHubTargetId : null;
        if (id) renderMemoryHubVectorMemory(id, String(id).indexOf('g_') === 0);
    } catch (e) {} }, 400);
    return r;
}
// 「▶ 现在补算」：点了就跑，不看自动开关（全 app 一条规矩：点击就生成）
async function gyVecBackfillNow(sessionId, isGroup) {
    const prog = () => document.getElementById('memHubVecProg');
    const say = m => { const e = prog(); if (e) e.innerText = m; };
    if (typeof window.gyVecBackfill !== 'function') return;
    say('开始…');
    const r = await window.gyVecBackfill(sessionId, isGroup, say);
    setTimeout(() => { try { renderMemoryHubVectorMemory(sessionId, !!isGroup); } catch (e) {} }, 400);
    return r;
}

function forgetVectorMemoryEntry(sessionId, idx) {
    const history = globalChats[sessionId];
    if (!history || !history[idx]) return;
    delete history[idx].embVec;
    saveAllData();
    renderMemoryHubVectorMemory(sessionId, sessionId.toString().startsWith('g_'));
}
function forgetCharVectorEntry(sessionId, idx) {
    const cache = window.__memHubCharVectorCandidatesCache && window.__memHubCharVectorCandidatesCache[sessionId];
    if (!cache || !cache[idx]) return;
    delete cache[idx].ref.embVec;
    saveAllData();
    renderMemoryHubVectorMemory(sessionId, false);
}

// 专属资料库汇总查看：跟角色编辑页里那份是同一份数据(dataBank)，这里只做只读汇总+删除，上传入口还在角色编辑页
function renderMemoryHubDataBank(charId, isGroup) {
    const wrap = document.getElementById('memHubDataBankWrap');
    const listEl = document.getElementById('memHubDataBankList');
    if (!wrap || !listEl) return;
    if (isGroup) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    const banks = (dataBank || []).filter(d => d.charId == charId);
    if (banks.length === 0) { listEl.innerHTML = '<div style="color:#8b98a5; font-size:13px;">这个角色还没有上传专属资料库文档</div>'; return; }
    listEl.innerHTML = banks.map(b => `
        <div style="display:flex; align-items:center; gap:8px; background:white; padding:8px; border-radius:6px; border:1px solid #eff3f4;">
            <div style="flex:1; min-width:0;">
                <div style="font-size:13px; font-weight:bold;">📄 ${escapeHtml(b.title)}</div>
                <div style="font-size:11px; color:#8b98a5;">已切分 ${b.chunks.length} 个片段 · ${b.chunks.every(c => c.embVec) ? '✅ 已完成向量化' : '⏳ 向量化中...'}</div>
            </div>
            <span style="color:#f91880; cursor:pointer; flex-shrink:0;" onclick="deleteMemHubDataBankEntry('${b.id}')">删除</span>
        </div>`).join('');
}
async function deleteMemHubDataBankEntry(id) {
    if (!(await appConfirm('确定要删除这份资料库文档吗？'))) return;
    dataBank = dataBank.filter(d => d.id !== id);
    saveAllData();
    renderMemoryHubDataBank(currentMemoryHubTargetId, false);
    if (typeof renderCharDataBankList === 'function') renderCharDataBankList(); // 顺手同步一下角色编辑页那份列表，避免过期
}

function renderMemoryHubMvuSnapshot(sessionId) {
    const el = document.getElementById('memHubMvuSnapshot');
    if (!el) return;
    const snapshot = (typeof getMvuStatsScope === 'function') ? getMvuStatsScope(sessionId) : null;
    if (!snapshot || Object.keys(snapshot).length === 0) { el.innerHTML = '<div style="color:#8b98a5; font-size:13px;">还没有识别到任何状态更新数据</div>'; return; }
    el.innerHTML = (typeof renderMvuStatusBarHtml === 'function') ? renderMvuStatusBarHtml(snapshot) : '';
}


async function checkAndAutoSummarizeChat(sessionId) {
    if (typeof isAutoOn === 'function' && !isAutoOn('chatSummary')) return;   // 🔌 设置里关掉了「聊天自动总结」
    if (sessionId.toString().startsWith('g_')) { checkAndAutoSummarizeGroupChat(sessionId); return; }
    let session = globalChats[sessionId]; if (!session || session.length === 0) return;
    
    let validMsgs = session.filter(m => m.sender !== 'system');
    const interval = chatSummaryInterval || 20;
    if (validMsgs.length === 0 || validMsgs.length % interval !== 0) return;

    let char = myCharacters.find(c => c.id == sessionId);
    const api = getApiConfig(true); if (!char || !api.key) return;

    let recent20 = validMsgs.slice(-interval).map(m => (m.sender === 'me' ? "用户: " : char.name + ": ") + m.text).join('\n');
    let prompt = buildStructuredMessages('你是一个擅长提炼对话要点的助手，只输出总结本身，不要任何多余说明。',
        [], `请简要总结以下用户与"${char.name}"的最近${interval}条对话内容，提取出关键信息、当前话题和双方的情感状态（100字以内）。\n\n对话记录：\n${recent20}`);

    try {
        let data = await callChatCompletionAPI(api, prompt);
        if(data.error) return; 
        let newSummary = data.choices?.[0]?.message?.content?.trim() || ""; if(!newSummary) return;
        
        // 数组化存储，加入时间戳。不设条数上限（以前只留 20 轮，更早的记忆会被剔掉）
        let summaryArr = char.chatSummary ? char.chatSummary.split('\n').filter(line => line.trim()) : [];
        summaryArr.push(`[${new Date().toLocaleString()}] ${newSummary}`);
        char.chatSummary = summaryArr.join('\n');
        saveAllData();
    } catch(e) { console.error("聊天总结失败", e); }
}

// 群聊版的"聊天总结"：配置方式和角色个人聊天总结一样（数组化+时间戳，不设条数上限），
// 区别只是触发频率改成每50条消息一次（群聊人多话多，20条太频繁），总结存在群聊对象自己的 summary 字段上，
// 不属于任何单个角色，这样群里每个成员发推文时都能读到同一份"群聊话题"。
async function checkAndAutoSummarizeGroupChat(sessionId) {
    if (typeof isAutoOn === 'function' && !isAutoOn('chatSummary')) return;   // 🔌 跟单聊共用「聊天自动总结」这一个开关
    let group = groupChats.find(g => g.id === sessionId); if (!group) return;
    let session = globalChats[sessionId]; if (!session || session.length === 0) return;

    let validMsgs = session.filter(m => m.sender !== 'system');
    const gInterval = groupSummaryInterval || 50;
    if (validMsgs.length === 0 || validMsgs.length % gInterval !== 0) return;

    const api = getApiConfig(true); if (!api.key) return;

    let recent50 = validMsgs.slice(-gInterval).map(m => {
        if (m.sender === 'me') return `${currentUser.name}: ${m.text}`;
        let c = myCharacters.find(c => c.id == m.sender);
        return (c ? c.name : m.sender) + ': ' + m.text;
    }).join('\n');
    let prompt = buildStructuredMessages('你是一个擅长提炼对话要点的助手，只输出总结本身，不要任何多余说明。',
        [], `请简要总结以下群聊"${group.name}"最近${gInterval}条对话内容，提取出当前热门话题、群里的氛围、以及各人的主要观点或立场（150字以内）。\n\n对话记录：\n${recent50}`);

    try {
        let data = await callChatCompletionAPI(api, prompt);
        if (data.error) return;
        let newSummary = data.choices?.[0]?.message?.content?.trim() || ""; if (!newSummary) return;

        // 数组化存储，加入时间戳。不设条数上限
        let summaryArr = group.summary ? group.summary.split('\n').filter(line => line.trim()) : [];
        summaryArr.push(`[${new Date().toLocaleString()}] ${newSummary}`);
        group.summary = summaryArr.join('\n');
        saveAllData();
    } catch (e) { console.error("群聊总结失败", e); }
}

// 角色在群聊里参与的话题，拼进发帖/发言的prompt里，让角色"记得"群里最近在聊什么
function getCharGroupChatTopics(char) {
    if (!char || !groupChats || groupChats.length === 0) return '';
    let myGroups = groupChats.filter(g => Array.isArray(g.members) && g.members.includes(char.id) && g.summary);
    if (myGroups.length === 0) return '';
    return myGroups.map(g => {
        let entries = g.summary.split('\n').filter(l => l.trim());
        let lastEntry = entries[entries.length - 1] || '';
        let cleanEntry = lastEntry.replace(/^\[[^\]]*\]\s*/, ''); // 去掉时间戳前缀，prompt里不需要
        return `在群聊"${g.name}"里，最近大家在聊：${cleanEntry}`;
    }).join('\n');
}

async function updateCharMemoryAsync(char) {
    if (typeof isAutoOn === 'function' && !isAutoOn('postMemory')) return;   // 🔌 设置里关掉了「推文记忆自动总结」
    const api = getApiConfig(false); if (!api.key) return;
    const interval = postMemoryInterval || 20;
    const posts = getCharRecentPosts(char.id, interval); if (posts.length === 0) return;
    const prompt = `你是记忆管理AI。请用100字以内，总结推特用户"${char.name}"（人设：${char.persona}）最近${interval}条帖子的关注点、情绪和经历规律：\n${posts.map((p, i) => `${i+1}. ${p.text}`).join('\n')}`;

    try {
        const data = await sendChatRequest(api, prompt, { max_tokens: 1200 });
        let newSum = data.choices?.[0]?.message?.content?.trim();
        if(newSum) {
            // 数组化存储，加入时间戳。不设条数上限
            let memoryArr = char.memorySummary ? char.memorySummary.split('\n').filter(line => line.trim()) : [];
            memoryArr.push(`[${new Date().toLocaleString()}] ${newSum}`);
            char.memorySummary = memoryArr.join('\n');
            saveAllData();
        }
    } catch(e) { console.error("推文总结失败", e); }
}

// 频率字段（{interval, unit, count}）→ 加了随机抖动的实际毫秒间隔。interval<=0 或没配置时表示"不启用这项自动行为"。
function calcDynamicFreqMs(freq) {
    if (!freq || typeof freq.interval !== 'number' || freq.interval <= 0) return null;
    let baseReqMs = freq.interval * (freq.unit === 'minute' ? 60000 : freq.unit === 'hour' ? 3600000 : 86400000);
    let jitter = (Math.random() - 0.5) * 0.4 * baseReqMs; // +/- 20% 随机波动，避免每次都卡在同一时间点触发
    return baseReqMs + jitter;
}

function startAutoPostTimer() {
    setInterval(async () => {
        if (!myApiKey || isGenerating) return;
        if (typeof isAutoOn === 'function' && !isAutoOn('autoPost')) return;   // 🔌 设置里关掉了「角色自动发帖」
        let now = Date.now(), charsToPost = [], charsToForumPost = [], charsToAnonPost = [];

        for (let char of myCharacters) {
          try {
            // 0. 兜底：防止个别角色（老存档/角色卡导入等）缺失发帖频率字段时，这里抛出异常
            //    导致整个 for 循环中断，进而让"所有"角色都生成不了推文。
            if (!char.postFreq || typeof char.postFreq.interval !== 'number') char.postFreq = { interval: 1, unit: 'day', count: 1 };

            // 1. 计算基础毫秒间隔
            let baseReqMs = char.postFreq.interval * (char.postFreq.unit === 'minute' ? 60000 : char.postFreq.unit === 'hour' ? 3600000 : 86400000);

            // 2. 引入随机抖动 (Random Jitter)
            // 这里设置 +/- 20% 的随机波动范围，使每次发帖时间都不固定
            let jitter = (Math.random() - 0.5) * 0.4 * baseReqMs;
            let dynamicReqMs = baseReqMs + jitter;
            // 🎲 发推间隔设成「TA 定」：用 TA 自己上一次说的"下次隔多久"（js/53），发完再问一次
            if (typeof gyTaGapMs === 'function') dynamicReqMs = gyTaGapMs(char, 'post', dynamicReqMs);

            if (!char.lastPostTime) char.lastPostTime = now;

            // 3. 使用动态计算的间隔进行判断
            if (now - char.lastPostTime >= dynamicReqMs) {
                char.lastPostTime = now;
                for(let k = 0; k < (char.postFreq.count || 1); k++) charsToPost.push(char);
                if (typeof gyTaAfter === 'function') gyTaAfter(char, 'post');
            }

            // 4. 论坛(forumThreads)自主发帖：跟首页推文同一套"到点了就发"的判定逻辑，只是频率字段/时间戳分开各自独立计时，
            //    interval配成0（默认值）就是没开启这个角色的这项行为，理论上原来的角色不会平白多出这个动作。
            if (char.forumPostFreq || (typeof gyTaCharOn === 'function' && gyTaCharOn(char, 'forumFreqInterval'))) {
                let forumDynamicMs = calcDynamicFreqMs(char.forumPostFreq);
                if (typeof gyTaGapMs === 'function') forumDynamicMs = gyTaGapMs(char, 'forum', forumDynamicMs);
                if (forumDynamicMs !== null) {
                    if (!char.lastForumPostTime) char.lastForumPostTime = now;
                    if (now - char.lastForumPostTime >= forumDynamicMs) {
                        char.lastForumPostTime = now;
                        charsToForumPost.push(char);
                        if (typeof gyTaAfter === 'function') gyTaAfter(char, 'forum');
                    }
                }
            }

            // 5. 匿名论坛自主发帖：同上，独立的频率字段和时间戳
            if (char.anonPostFreq || (typeof gyTaCharOn === 'function' && gyTaCharOn(char, 'anonFreqInterval'))) {
                let anonDynamicMs = calcDynamicFreqMs(char.anonPostFreq);
                if (typeof gyTaGapMs === 'function') anonDynamicMs = gyTaGapMs(char, 'anon', anonDynamicMs);
                if (anonDynamicMs !== null) {
                    if (!char.lastAnonPostTime) char.lastAnonPostTime = now;
                    if (now - char.lastAnonPostTime >= anonDynamicMs) {
                        char.lastAnonPostTime = now;
                        charsToAnonPost.push(char);
                        if (typeof gyTaAfter === 'function') gyTaAfter(char, 'anon');
                    }
                }
            }
          } catch (e) { console.error(`角色"${char && char.name}"的发帖计时器计算出错，已跳过：`, e); }
        }

        if (charsToPost.length > 0 && typeof executeGeneration === 'function') {
            await executeGeneration(charsToPost.slice(0, 3));
        }
        // 论坛/匿名论坛这两项各自最多同时处理2个角色，避免某一轮刚好一堆角色同时到点、一次性糊一堆请求出去
        if (charsToForumPost.length > 0 && typeof autoGenerateForumThreadForChar === 'function') {
            for (const char of charsToForumPost.slice(0, 2)) { await autoGenerateForumThreadForChar(char); }
            saveAllData();
        }
        if (charsToAnonPost.length > 0 && typeof autoGenerateAnonPostForChar === 'function') {
            for (const char of charsToAnonPost.slice(0, 2)) { await autoGenerateAnonPostForChar(char); }
            saveAllData();
        }
    }, 15000); // 每15秒轮询一次检测
}
// ===================== 🫀 活人感：不总是在线 / 情绪惯性 / 语言指纹 =====================
// 三件事各有各的开关（AUTO_FEATURE_DEFS 里的 aliveOffline / aliveMood / aliveVoice），
// **默认全关**——一个都不打开的话，app 的行为跟加这段代码之前一模一样。
//
// 设计上的一个反直觉点：第一项（不总是在线）是**省钱**的。以前"用户发一条 → 调一次 API"，
// 开了之后角色忙碌期里你发的十条会攒成一次调用。真实感和账单在这一项上是同向的。

const ALIVE_BUSY_RE = /手术|开会|会议|上课|讲课|上班|工作|加班|值班|夜班|出诊|查房|坐诊|开车|赶路|在路上|通勤|演出|拍摄|排练|录制|训练|比赛|考试|应酬|谈判|出差|执勤|巡逻|洗澡|健身|做饭|面试|加课|实验|写稿|赶稿|闭关/;
const ALIVE_SLEEP_RE = /睡|眠|午休|打盹|躺下|休息中|歇着/;

// 今天的日程解析成 [{min, text}]（min = 从 00:00 起的分钟数），跟行程插件里那套是同一个思路
function aliveScheduleLines(char) {
    const t = (char && char.schedule && char.schedule.text) || '';
    if (!t) return [];
    const out = [];
    t.split('\n').forEach(line => {
        const m = line.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
        if (!m) return;
        const h = parseInt(m[1]), mi = parseInt(m[2]);
        if (isNaN(h) || isNaN(mi) || h > 23 || mi > 59) return;
        out.push({ min: h * 60 + mi, text: line.replace(/^[^\d]*\d{1,2}\s*[:：]\s*\d{2}\s*/, '').trim() || line.trim() });
    });
    return out.sort((a, b) => a.min - b.min);
}
// 此刻处在日程的哪一行，以及这一行大概什么时候结束
function aliveNowLine(char) {
    const lines = aliveScheduleLines(char);
    if (!lines.length) return null;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    let idx = -1;
    for (let i = 0; i < lines.length; i++) if (lines[i].min <= cur) idx = i;
    if (idx < 0) return null;
    const endMin = lines[idx + 1] ? lines[idx + 1].min : 24 * 60;
    const end = new Date(now); end.setHours(0, 0, 0, 0);
    return { text: lines[idx].text, end: end.getTime() + endMin * 60000 };
}
function aliveInSleepWindow(now) {
    const h = now.getHours();
    const s = Math.min(23, Math.max(0, parseInt(aliveSettings.sleepStart)));
    const e = Math.min(23, Math.max(0, parseInt(aliveSettings.sleepEnd)));
    if (s === e) return false;
    return s < e ? (h >= s && h < e) : (h >= s || h < e);
}
function aliveWakeTime(now) {
    const e = Math.min(23, Math.max(0, parseInt(aliveSettings.sleepEnd)));
    const d = new Date(now);
    if (now.getHours() < e) d.setHours(e, 0, 0, 0);
    else { d.setDate(d.getDate() + 1); d.setHours(e, 0, 0, 0); }
    // 不是闹钟一响就摸手机，随机赖床 0~40 分钟
    return d.getTime() + Math.floor(Math.random() * 40) * 60000;
}

// 这个角色此刻在不在？返回 null ＝ 有空，能立刻回
function aliveStateOf(char) {
    if (!char) return null;
    const now = new Date();
    const ls = char.lifeState || {};
    // 状态气泡超过 3 小时没更新就不作数了，免得拿半天前的"在手术"把人锁到晚上
    const fresh = ls.updatedAt && (Date.now() - ls.updatedAt < 3 * 3600000);
    const label = fresh ? (ls.statusTypeLabel || '') : '';
    const act = fresh ? (ls.activity || '') : '';
    const line = aliveNowLine(char);
    const lineTxt = line ? line.text : '';
    const lineBusy = lineTxt && ALIVE_BUSY_RE.test(lineTxt) && !ALIVE_SLEEP_RE.test(lineTxt);

    // 1）睡着了。日程明写着这会儿在忙（比如夜班）就不算睡——日程比时钟可信。
    // 🐛 修复"大白天角色还停在夜里睡觉"：以前只要状态里带个"睡"字，不管现在几点，一律按
    //    "睡到明天早上"算（aliveWakeTime 在白天会直接算到**第二天**起床时间）。新导入的角色卡
    //    开场白大多是深夜场景，第一轮回复的状态就是"躺在床上/睡了"，于是一整天都叫不醒。
    //    现在分三种：作息时段内 → 睡到起床；日程这一格写着睡 → 睡到这一格结束；
    //    白天、只是状态里写着睡 → 当成打个盹，从状态更新那一刻算一个半小时，过了就当醒了。
    const inWin = aliveInSleepWindow(now);
    const actSleep = label === '睡觉' || ALIVE_SLEEP_RE.test(act);
    const lineSleep = ALIVE_SLEEP_RE.test(lineTxt);
    if (!lineBusy && (inWin || actSleep || lineSleep)) {
        if (inWin) return { kind: 'sleep', why: act || lineTxt || '在睡觉', until: aliveWakeTime(now) };
        if (lineSleep && line) return { kind: 'sleep', why: lineTxt, until: line.end };
        const napEnd = (ls.updatedAt || Date.now()) + 90 * 60000;
        if (napEnd > Date.now()) return { kind: 'sleep', why: act || '在打盹', until: napEnd };
        // 状态早过时了——人早醒了，往下按"有没有在忙"接着判断
    }
    // 2）在忙
    if (label === '忙' || ALIVE_BUSY_RE.test(act) || lineBusy) {
        const until = line ? line.end : Date.now() + Math.round(20 + Math.random() * 70) * 60000;
        return { kind: 'busy', why: act || lineTxt || '在忙', until };
    }
    return null;
}

function aliveIsUrgent(text) {
    const raw = String(aliveSettings.urgentWords || '');
    const words = raw.split(/[,，;；\s]+/).map(w => w.trim()).filter(Boolean);
    if (!words.length) return false;
    const t = String(text || '');
    return words.some(w => t.includes(w));
}

// 主聊天回复入口的门卫。返回：
//   {hold:true}                        → 这一轮别调 API，消息挂起
//   {hold:false, text, catchUp}        → 照常回，但可能是"补回"（把挂起的一起带上）
function aliveGate(sessionId, triggerText) {
    try {
        if (typeof isAutoOn !== 'function' || !isAutoOn('aliveOffline')) return null;
        if (String(sessionId).startsWith('g_')) return null;   // 群聊不挂起：一个人忙就整群卡住太怪
        const char = myCharacters.find(c => c.id == sessionId);
        if (!char) return null;
        if (char.aliveAlwaysOn) return null;                   // 这个角色单独设了"永远在线"

        const q = aliveHeld[sessionId];
        // 急事：把之前挂着的一起翻出来，立刻回
        if (aliveIsUrgent(triggerText)) {
            if (q && q.texts.length) {
                const all = q.texts.concat([triggerText]);
                const mins = Math.round((Date.now() - q.since) / 60000);
                delete aliveHeld[sessionId];
                aliveSyncUI(sessionId);
                return { hold: false, text: all.join('\n'), catchUp: { kind: q.kind, why: q.why, mins, n: all.length, urgent: true, glances: q.glances || [] } };
            }
            return null;
        }
        // 已经挂着了，就继续往里堆，别再判断一次状态（免得状态刚好翻篇导致半截回复）
        if (q) {
            q.texts.push(triggerText);
            if (typeof saveAllData === 'function') saveAllData();
            aliveSyncUI(sessionId);
            aliveMaybeGlance(sessionId, false);
            return { hold: true };
        }
        const st = aliveStateOf(char);
        if (!st) return null;
        const min = Math.max(0, parseFloat(aliveSettings.minDelay) || 0);
        const max = Math.max(min, parseFloat(aliveSettings.maxDelay) || min);
        let pad = (min + Math.random() * (max - min)) * 60000;
        // 🎲「忙完之后等多久」设成 TA 定：用 TA 自己说过的节奏（js/53，没问过的先按上面的数、同时去问）
        if (typeof gyTaFieldOn === 'function' && gyTaFieldOn(char, 'aliveMinDelay')) pad = gyTaGapMs(char, 'aliveAfter', pad);
        const __mh = gyNum(aliveSettings.maxHold, 12);
        const __taHold = typeof gyTaFieldOn === 'function' && gyTaFieldOn(char, 'aliveMaxHold');
        // 填 0 或负数＝不设上限；TA 定＝用 TA 自己说的"最久能多久不看手机"（还没问到就先不设上限）
        const cap = __taHold ? Date.now() + gyTaGapMs(char, 'aliveHold', Infinity) : (__mh > 0 ? Date.now() + __mh * 3600000 : Infinity);
        aliveHeld[sessionId] = {
            charId: char.id, texts: [triggerText], since: Date.now(),
            until: Math.min(cap, st.until + pad), kind: st.kind, why: st.why
        };
        // 💤 角色资料页里那句「忙碌自动回复」——这个字段一直存着，但**从来没有任何代码读过它**
        //    （数据体检时用运行时探针测出来的）。挂起消息正是它本来该干的事：像微信自动回复
        //    那样先顶一句，人回来了再真的回。一条挂起周期只发一次，字段留空就完全没有这回事。
        try {
            const auto = String(char.busyAutoReplyText || '').trim();
            // 开了「忙的时候也会看一眼手机」：先让 TA 自己判断回不回；TA 决定不回，才轮到这句自动回复（见 aliveGlanceRun）
            const glanceOn = typeof isAutoOn === 'function' && isAutoOn('aliveGlance');
            if (!glanceOn && auto && aliveSettings.useBusyReply !== false && typeof globalChats !== 'undefined') {
                if (!globalChats[sessionId]) globalChats[sessionId] = [];
                globalChats[sessionId].push({ sender: char.id, text: auto, timestamp: Date.now(), readBy: [], isBusyAuto: true });
                aliveHeld[sessionId].autoSent = true;
                if (typeof renderChatMessages === 'function') renderChatMessages();
            }
        } catch (e) {}
        if (typeof saveAllData === 'function') saveAllData();
        aliveSyncUI(sessionId);
        aliveMaybeGlance(sessionId, true);
        return { hold: true };
    } catch (e) { console.warn('[活人感] 判断在不在线出错，按"在线"处理：', e); return null; }
}

// ===================== 👀 忙的时候也会看一眼手机 =====================
// 挂起 ≠ 手机扔在一边。真人在忙的空当里会瞟一眼消息，回不回、回什么，看的是：
// 两个人现在是什么关系、这个人什么性子、手头的事能不能分心、这条消息本身急不急/在不在乎。
// 这些全交给角色自己判断（带完整人设/世界书/关系网），代码只负责"给 TA 看一眼的机会"：
//   · 刚挂起时看一次（隔几十秒，不是消息一到就秒看）
//   · 挂起期间你又追着发、而且离上次看已经过了一阵，可能再看一次；每次挂起最多两次
// TA 决定不回 → 如果资料页里设了"忙碌自动回复"，这时候才发那句（跟没开这项时一样）。
// TA 回了什么会记在挂起记录里，忙完正式回复时告诉 TA"你刚才顺手回过这些"，前后接得上。
// 正在看/已经排上队 这两个标记只放内存里：存进档的话，刷新页面后会永远卡在"正在看"
const __aliveGlanceRT = {};
function aliveMaybeGlance(sessionId, isFirst) {
    try {
        if (typeof isAutoOn !== 'function' || !isAutoOn('aliveGlance')) return;
        const q = aliveHeld[sessionId];
        const rt = __aliveGlanceRT[sessionId] || (__aliveGlanceRT[sessionId] = {});
        if (!q || rt.busy || rt.scheduled) return;
        const n = q.glanceCount || 0;
        if (n >= 2) return;
        if (!isFirst && n > 0 && Date.now() - (q.lastGlance || 0) < 10 * 60000) return;
        rt.scheduled = true;
        const wait = (isFirst ? 15 : 30) * 1000 + Math.floor(Math.random() * 45000);
        setTimeout(() => { try { rt.scheduled = false; aliveGlanceRun(sessionId); } catch (e) {} }, wait);
    } catch (e) {}
}

async function aliveGlanceRun(sessionId) {
    const q = aliveHeld[sessionId];
    const rt = __aliveGlanceRT[sessionId] || (__aliveGlanceRT[sessionId] = {});
    if (!q || rt.busy) return;
    const char = myCharacters.find(c => c.id == sessionId);
    if (!char) return;
    const api = (typeof getApiMain === 'function') ? getApiMain() : null;
    if (!api || !api.key) return;
    rt.busy = true;
    const sendAutoIfAny = () => {
        try {
            const auto = String(char.busyAutoReplyText || '').trim();
            if (!auto || q.autoSent || aliveSettings.useBusyReply === false) return;
            if (!globalChats[sessionId]) globalChats[sessionId] = [];
            globalChats[sessionId].push({ sender: char.id, text: auto, timestamp: Date.now(), readBy: [], isBusyAuto: true });
            q.autoSent = true;
            if (typeof renderChatMessages === 'function' && currentChatSessionId === sessionId) renderChatMessages();
        } catch (e) {}
    };
    try {
        const me = (typeof userDisplayName === 'function') ? userDisplayName(char) : '对方';
        const hist = (globalChats[sessionId] || [])
            .filter(m => m && m.text && (m.sender === 'me' || m.sender == char.id))
            .slice(-12)
            .map(m => `${m.sender === 'me' ? me : char.name}：${String(m.text).slice(0, 200)}`).join('\n');
        const fresh = q.texts.slice(q.glancedUpTo || 0);
        if (!fresh.length) return;
        const before = (q.glances || []).length ? `你刚才已经抽空回过：${q.glances.map(g => '「' + g + '」').join('')}。之后对方又发来了下面这些。\n` : '';
        const where = q.kind === 'sleep' ? `你这会儿在睡觉（${q.why}）` : `你这会儿正在：${q.why}`;
        const task = `
【此刻的处境】：${where}。手机上跳出了${me}的消息：
${fresh.map(t => '「' + t + '」').join('\n')}
${before}
【这一轮你只需要做一个真人的判断】：人在忙的时候，看不看手机、回不回、回什么，取决于你们现在是什么关系、你是什么性子、手头的事能不能分心、这条消息本身你在不在乎。关系越近越可能挤出一点时间，关系一般的放着等忙完也很正常；睡着了多半根本没看到。
- 此刻不会看到、或者看到了也不会回：只输出 NO。
- 会抽空回：就像真人在忙的空当里那样，短，一到两句，带着你此刻正在干的事的痕迹和你们之间的语气。别用"在忙，晚点说"这类谁都能用的模板句——换一个人、换一段关系、换一种忙法，说出来的都不一样；也可以根本不提自己在忙，直接接话。两句话就用换行分开。
你忙完之后还会再正式回复，所以现在不用把话说全。只输出要发出去的话本身，不写动作描写，不解释。
`;
        const prompt = `${buildBasePrompt(char, true, hist)}\n【最近的聊天】：\n${hist}\n${task}${typeof getFinalAnswerMarkerPromptNote === 'function' ? getFinalAnswerMarkerPromptNote() : ''}`;
        const data = await callChatCompletionAPI(api, prompt, 1);
        if (aliveHeld[sessionId] !== q) return;   // 等回复的时候已经补回/被叫醒了，这一眼作废
        q.glancedUpTo = q.texts.length;
        q.lastGlance = Date.now();
        q.glanceCount = (q.glanceCount || 0) + 1;
        if (!data || data.error) return;
        let t = String(data.choices?.[0]?.message?.content || '');
        if (typeof extractAfterFinalMarker === 'function') t = extractAfterFinalMarker(t);
        t = t.trim();
        if (typeof stripUndelimitedReasoningIfOverLength === 'function') t = stripUndelimitedReasoningIfOverLength(t, 60);
        const bare = t.replace(/[\s。．.!！~～]/g, '').toUpperCase();
        if (!t || bare === 'NO' || bare === 'NONE') { sendAutoIfAny(); return; }
        const lines = t.split(/\n+/).map(x => x.trim()).filter(Boolean).slice(0, 3);
        if (!globalChats[sessionId]) globalChats[sessionId] = [];
        const sent = [];
        for (let i = 0; i < lines.length; i++) {
            if (i > 0) await new Promise(r => setTimeout(r, 1200 + Math.random() * 1800));
            if (aliveHeld[sessionId] !== q) break;
            let line = lines[i];
            if (typeof applyRegexScripts === 'function') line = applyRegexScripts(line, 'ai_output', char.id);
            if (typeof stripLeftoverMarkers === 'function') line = stripLeftoverMarkers(line);
            let media = null;
            const emo = line.match(/\[EMO:(emo_\w+)\]/i);
            if (emo) { const e = (globalEmoticons || []).find(x => x.id === emo[1]); if (e) media = e.url; line = line.replace(emo[0], '').trim(); }
            line = line.replace(/^["\u201c]|["\u201d]$/g, '').trim();
            if (!line && !media) continue;
            const msg = { sender: char.id, text: line, timestamp: Date.now(), mediaUrl: media, readBy: [], isGlance: true };
            globalChats[sessionId].push(msg);
            sent.push(line || '[表情]');
            if (currentChatSessionId === sessionId && document.getElementById('view-chat') && document.getElementById('view-chat').style.display !== 'none') {
                if (typeof renderChatMessages === 'function') renderChatMessages();
            } else {
                try {
                    if (typeof showToast === 'function') showToast(getAvatarHTML(char, 80), `${char.name} 发来消息`, line || '[表情]', null, sessionId);
                    globalNotifications.unshift({ text: `<b>${char.name}</b> 给您发来消息`, postId: null, chatCharId: sessionId, timestamp: Date.now() });
                    unreadNotifs++; if (typeof updateNotifBadge === 'function') updateNotifBadge();
                    if (typeof renderChatCharList === 'function') renderChatCharList();
                } catch (e) {}
            }
        }
        if (sent.length) q.glances = (q.glances || []).concat(sent);
        else sendAutoIfAny();
    } catch (e) {
        console.warn('[活人感] 看一眼手机出错（不影响之后正式回复）：', e);
    } finally {
        rt.busy = false;
        if (typeof saveAllData === 'function') saveAllData();
    }
}

// 每分钟看一眼有没有该补回的（纯本地，不花钱）
function aliveTick() {
    try {
        if (typeof isAutoOn !== 'function' || !isAutoOn('aliveOffline')) return;
        const now = Date.now();
        Object.keys(aliveHeld).forEach(sid => {
            const q = aliveHeld[sid];
            if (!q || !q.texts || !q.texts.length) { delete aliveHeld[sid]; return; }
            if (q.until > now) return;
            const texts = q.texts.slice();
            const mins = Math.round((now - q.since) / 60000);
            delete aliveHeld[sid];
            if (typeof saveAllData === 'function') saveAllData();
            aliveSyncUI(sid);
            if (typeof triggerAIBatchReply === 'function')
                triggerAIBatchReply(sid, texts.join('\n'), { kind: q.kind, why: q.why, mins, n: texts.length, autoSent: !!q.autoSent, glances: q.glances || [] });
        });
    } catch (e) { console.warn('[活人感] 补回检查出错：', e); }
}

// 「让 TA 现在就回」——不等了，立刻补回
function aliveReplyNow(sessionId) {
    const q = aliveHeld[sessionId];
    if (!q) return;
    q.until = 0;
    aliveTick();
}
// 这个角色单独设成"永远在线"（不受挂起影响）
function aliveToggleAlwaysOn(charId, on) {
    const c = myCharacters.find(x => x.id == charId);
    if (!c) return;
    c.aliveAlwaysOn = !!on;
    if (on && aliveHeld[String(charId)]) aliveReplyNow(String(charId));
    if (typeof saveAllData === 'function') saveAllData();
    aliveSyncUI(String(charId));
    if (typeof renderAlivePanel === 'function') renderAlivePanel();
}

// 补回时那段"你刚才不在"的说明
function aliveCatchUpPrompt(cu) {
    if (!cu) return '';
    const auto = cu.autoSent ? '刚才对方只收到了你设的那句自动回复，不是你本人在说话——现在是你真的回话。\n' : '';
    const glance = (cu.glances && cu.glances.length) ? `中途你抽空瞄过一眼手机，顺手回了：${cu.glances.map(g => '「' + g + '」').join('')}（这些对方已经看到了）。现在是忙完了正式回，要接得上自己刚才说过的话，别重复，也别装作刚刚才第一次看到。\n` : '';
    const dur = cu.mins >= 60 ? '大概 ' + (Math.round(cu.mins / 6) / 10) + ' 小时'
              : cu.mins >= 3 ? '大概 ' + cu.mins + ' 分钟'
              : '有一会儿';
    return `\n【⚠️ 你刚才不在】：你刚才${cu.kind === 'sleep' ? '在睡觉' : '在忙'}（${cu.why}），${dur}没看手机。
下面那${cu.n > 1 ? cu.n + ' 条' : '条'}消息是你不在的这段时间里对方陆续发来的，${(cu.glances && cu.glances.length) ? '你中途只匆匆瞄过' : '你**现在才第一次看到**'}。
${cu.urgent ? '而且对方这条听着像有急事，你是被这条叫回来的。\n' : ''}${auto}${glance}按真人的样子回：先把这段时间差自然地交代一下（"刚下台"/"刚醒"/"开完会才看到"这种），然后一起回应这段时间里的内容——不要一条一条机械地答，人是整体看完再说话的。
交代多少、要不要解释、要不要道歉，完全由你的性格和你们的关系决定；冷淡的人可能一个字都不解释。
不要装作这些消息是刚刚才发来的。\n`;
}

// ---------- 情绪惯性 ----------
function aliveMoodValue(char) {
    const m = char && char.mood;
    if (!m || !m.at || typeof m.v !== 'number') return 0;
    const hrs = (Date.now() - m.at) / 3600000;
    const hl = gyNum(aliveSettings.moodHalfLife, 8) || 8;
    const v = m.v * Math.pow(0.5, hrs / hl);
    return Math.abs(v) < 0.4 ? 0 : v;    // 衰减到快没了就当没了
}
function aliveCaptureMood(char, parsed) {
    try {
        if (typeof isAutoOn !== 'function' || !isAutoOn('aliveMood')) return;
        if (!char || !parsed) return;
        const raw = parsed.mood;
        if (raw === undefined || raw === null || raw === '') return;
        const v = parseFloat(raw);
        if (isNaN(v)) return;
        const why = String(parsed.moodWhy || '').trim().slice(0, 40);
        // 跟还没散掉的旧情绪加权混合，避免一轮一个极端来回甩
        const old = aliveMoodValue(char);
        const nv = Math.max(-5, Math.min(5, v * 0.7 + old * 0.3));
        char.mood = { v: nv, why: why || ((char.mood && char.mood.why) || ''), at: Date.now() };
    } catch (e) { /* 情绪没抓到不影响这一轮回复 */ }
}
// 别的模块（比如 js/36「你很久没回」）用文字描述的情绪，落进同一套情绪惯性里。
// 以前 js/36 调的就是这个名字，但它从来没被定义过——那边想的情绪一直没接上，这里补上。
window.gyAliveSetMood = function (charId, moodText, why) {
    try {
        if (typeof isAutoOn !== 'function' || !isAutoOn('aliveMood')) return false;
        const char = (myCharacters || []).find(c => String(c.id) === String(charId));
        if (!char) return false;
        const t = String(moodText || '');
        const v = /开心|高兴|期待|轻松|好奇|甜|想你|惦记/.test(t) ? 1.5 : -2;   // 等不到回复，多半是不痛快
        const old = aliveMoodValue(char);
        char.mood = { v: Math.max(-5, Math.min(5, v * 0.7 + old * 0.3)), why: (t + (why ? '（' + why + '）' : '')).slice(0, 40), at: Date.now() };
        if (typeof saveAllData === 'function') saveAllData();
        return true;
    } catch (e) { return false; }
};
function aliveMoodPrompt(char) {
    try {
        if (typeof isAutoOn !== 'function' || !isAutoOn('aliveMood')) return '';
        const v = aliveMoodValue(char);
        if (!v) return '';
        const m = char.mood || {};
        const hrs = (Date.now() - (m.at || 0)) / 3600000;
        const ago = hrs < 1 ? '刚才' : (hrs < 24 ? Math.round(hrs) + ' 小时前' : Math.round(hrs / 24) + ' 天前');
        const a = Math.abs(v);
        const lvl = a >= 3.5 ? '很' : a >= 2 ? '还挺' : '有点';
        const dir = v > 0 ? '高兴、心里舒服' : '不痛快、别扭';
        return `\n【你现在的情绪余温】：你${lvl}${dir}，这是${ago}留下来的${m.why ? '——起因是：' + m.why : ''}。
这股情绪还没散干净，它会不自觉地渗进你这一轮的语气、用词、耐心和回复长度里。不是要你把它说出来，也不是每句都提；是"人吵完架半小时内说话就是硬一点"这种自然的残留。
如果这一轮发生的事足以冲掉它（对方哄好了、或者又踩到了），就让它变，不用硬维持。\n`;
    } catch (e) { return ''; }
}
// 追加到聊天 JSON 格式说明后面的那两个字段
function aliveMoodFormatNote() {
    try {
        if (typeof isAutoOn !== 'function' || !isAutoOn('aliveMood')) return '';
        return `\n【额外字段·情绪】：在上面那个 JSON 里再多两个字段 "mood" 和 "moodWhy"。
"mood" 是 -5 到 5 的数字，表示**这一轮结束时你对对方的情绪**（-5 很不痛快，0 平静，5 很高兴）。按你的人设诚实给，不要一律给正数——被敷衍了就是负的。
"moodWhy" 用不超过 15 个字说明为什么。
例：{"replies":[...], "stateUpdate":"...", "mood": -2, "moodWhy": "又拿工作搪塞我"}\n`;
    } catch (e) { return ''; }
}

// ---------- 语言指纹 ----------
// 从角色**自己写过的东西**里收样本：推文、聊天里 TA 说的话、日记信件论坛小说
function aliveVoiceSamples(char) {
    const out = [];
    try {
        (typeof globalPosts !== 'undefined' ? globalPosts : []).forEach(p => {
            if (p && p.char && p.char.id == char.id && p.text) out.push(p.text);
        });
        const chat = (typeof globalChats !== 'undefined' ? globalChats[String(char.id)] : null) || [];
        chat.forEach(m => { if (m && m.sender !== 'me' && m.text) out.push(m.text); });
        if (char.diaryData) {
            (char.diaryData.diaries || []).forEach(d => { if (d.content) out.push(d.content); });
            (char.diaryData.letters || []).forEach(d => { if (d.content) out.push(d.content); });
        }
        (typeof forumThreads !== 'undefined' ? forumThreads : []).forEach(th => {
            if (th.authorCharId == char.id && th.content) out.push(th.content);
            (th.replies || []).forEach(r => { if (r.charId == char.id && r.content) out.push(r.content); });
        });
    } catch (e) {}
    // 太短的没有风格信息，且去重
    return [...new Set(out.map(t => String(t).trim()).filter(t => t.length >= 4))];
}
let aliveVoiceBusy = false;
async function aliveExtractVoice(charId) {
    const char = myCharacters.find(c => c.id == charId);
    const status = (msg) => { const el = document.getElementById('aliveVoiceStatus'); if (el) el.innerText = msg; };
    if (!char) return;
    if (aliveVoiceBusy) { status('还在提取上一个，等一下。'); return; }
    const samples = aliveVoiceSamples(char);
    if (samples.length < 8) { status(`${char.name} 自己写的东西还太少（只找到 ${samples.length} 条，至少要 8 条）。让 TA 多发点推文、多聊几句再来提。`); return; }
    const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
    if (!api || !api.key) { status('还没配 API Key。'); return; }

    aliveVoiceBusy = true;
    status(`正在读 ${char.name} 写过的 ${samples.length} 条……`);
    try {
        const body = samples.slice(-120).map((t, i) => `${i + 1}. ${t.replace(/\s+/g, ' ').slice(0, 160)}`).join('\n');
        const ask = `下面是"${char.name}"这个人自己写过的话（推文、聊天、日记、帖子）。
请**只分析形式，不分析内容**，总结出这个人打字长什么样，写成一份可以直接拿去照着写的说明。要具体到能照做：

1. 句子长度：一般多少字一句？会不会写长句？
2. 标点：句尾用不用句号？爱不爱用省略号/破折号/波浪号/感叹号？会不会连着好几个？用不用问号反问？
3. 断句和分条：一次说完还是拆成好几条短的？
4. 口头禅、常用词、语气词（"嗯""行吧""得了""……吧"这种），列出实际出现过的原词。
5. 称呼习惯：怎么称呼对方、怎么自称。
6. 表情/颜文字：用不用？用哪种？
7. 有没有什么固定的小毛病：爱打错字、爱用英文词、爱省主语、说话爱带停顿。
8. 最不像 TA 的写法是什么（比如"绝不会用感叹号""从不说'亲爱的'"）。

不要写人设分析、不要写性格评价、不要写"这体现了 TA 的……"，只写打字习惯本身。
300 字以内，分条写，直接输出，不要开场白。

【样本】
${body}`;
        const data = await callChatCompletionAPI(api, ask);
        if (data && data.error) { status('模型报错：' + (data.error.message || '未知')); return; }
        let txt = (data.choices?.[0]?.message?.content || '').trim();
        if (typeof stripReasoningBlocks === 'function') txt = stripReasoningBlocks(txt);
        if (!txt) { status('模型这次没给出东西，再点一次试试。'); return; }
        char.voicePrint = { text: txt.slice(0, 900), at: Date.now(), n: samples.length };
        if (typeof saveAllData === 'function') saveAllData();
        status(`${char.name} 的语言指纹提好了（读了 ${samples.length} 条）。`);
        if (typeof renderAlivePanel === 'function') renderAlivePanel();
    } catch (e) {
        status('提取失败：' + (e.message || e));
    } finally {
        aliveVoiceBusy = false;
    }
}
function aliveVoicePrompt(char) {
    try {
        if (typeof isAutoOn !== 'function' || !isAutoOn('aliveVoice')) return '';
        const vp = char && char.voicePrint;
        if (!vp || !vp.text) return '';
        return `\n【你的打字习惯（从你自己以前说过的话里总结出来的，务必照着来）】：\n${vp.text}\n这写的是"你打字长什么样"，不是内容要求——不管这一轮聊什么，句子长短、标点、断句、口头禅、要不要用表情，都保持成这个样子。\n`;
    } catch (e) { return ''; }
}
function aliveSaveVoice(charId) {
    const char = myCharacters.find(c => c.id == charId);
    const el = document.getElementById('aliveVoiceEdit');
    if (!char || !el) return;
    const t = el.value.trim();
    if (t) char.voicePrint = { text: t.slice(0, 900), at: Date.now(), n: (char.voicePrint && char.voicePrint.n) || 0 };
    else delete char.voicePrint;
    if (typeof saveAllData === 'function') saveAllData();
    if (typeof renderAlivePanel === 'function') renderAlivePanel();
    const st = document.getElementById('aliveVoiceStatus'); if (st) st.innerText = t ? '改好了。' : '已经清掉了。';
}

// 挂起状态变了就刷一下界面（聊天页顶上的提示条 + 活人感面板）
function aliveSyncUI(sessionId) {
    try {
        if (typeof renderAliveBar === 'function') renderAliveBar();
        if (typeof renderAlivePanel === 'function' && document.getElementById('setPanel-alive')
            && document.getElementById('setPanel-alive').style.display !== 'none') renderAlivePanel();
        if (typeof renderChatCharList === 'function') renderChatCharList();
    } catch (e) {}
}

// ---------- 🫀 记忆会褪色 ----------
// 现在的聊天总结是"永不褪色的完美档案"：一个月前的细节和昨天的一样清楚。
// 真人不是这样——近的清楚、远的模糊、情绪强的不容易忘。这里按时间分层压缩，
// 并且明确告诉角色"你确实记不清了"，让它敢说"好像是…吧"，而不是硬编一个细节出来。
// 副作用是省钱：老总结被压到 26 字，同样的字数能往回记更多轮。
const ALIVE_STRONG_RE = /吵|哭|生气|发火|冷战|翻脸|分手|告白|表白|喜欢你|爱你|第一次|答应|承诺|道歉|对不起|受伤|生病|住院|去世|走了|骗|吻|抱|留下来|别走|求你|发誓|后悔/;

function aliveSummaryLines(summaryStr) {
    return (summaryStr || '').split('\n').filter(l => l.trim()).map(line => {
        const m = line.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
        let at = null, body = line.trim();
        if (m) {
            body = m[2].trim();
            const t = Date.parse(m[1].replace(/\//g, '-').replace(/-(\d)-/g, '-0$1-'));
            const t2 = isNaN(t) ? Date.parse(m[1]) : t;
            if (!isNaN(t2)) at = t2;
        }
        return { at, body, raw: line.trim() };
    });
}
function aliveFadeOne(it, now) {
    // 没有时间戳的当"最近"处理，别把老存档里没戳的记忆一刀砍没
    const days = it.at ? (now - it.at) / 86400000 : 0;
    const strong = ALIVE_STRONG_RE.test(it.body);
    const clear = gyNum(aliveSettings.fadeClear, 3);
    const blur = Math.max(clear, gyNum(aliveSettings.fadeBlur, 14));
    // 情绪强的往"年轻"挪一档：吵过的架、说过的重话，隔很久也记得清
    const d = strong ? days / 3 : days;
    const when = it.at ? (() => { const x = new Date(it.at); return `${x.getMonth() + 1}月${x.getDate()}日`; })() : '记不清哪天';
    if (d < clear) return `· ${when}（清楚）${it.body}`;
    if (d < blur) return `· ${when}（大概记得）${it.body.slice(0, 60)}${it.body.length > 60 ? '…' : ''}`;
    return `· ${when}（只剩个印象）${it.body.slice(0, 26)}${it.body.length > 26 ? '…' : ''}`;
}
// 开着开关时用这一份替换原来那段"历史聊天总结"
function aliveFadedSummaryBlock(char) {
    try {
        if (typeof isAutoOn !== 'function' || !isAutoOn('aliveFade')) return null;
        if (!char || !char.chatSummary) return null;
        const depth = Math.max(0, Math.round(gyNum(aliveSettings.fadeDepth, 8)));
        let list = aliveSummaryLines(char.chatSummary);
        if (!list.length) return null;
        list = list.slice(-depth);
        const now = Date.now();
        const body = list.map(it => aliveFadeOne(it, now)).join('\n');
        const anyFaded = /（大概记得）|（只剩个印象）/.test(body);
        return `\n【你对你们聊过的事的记忆（越往前越模糊，这就是你真实的记忆状态）】：\n${body}\n`
            + (anyFaded ? `【关于这些记忆】：标着"大概记得""只剩个印象"的，你是**真的想不起细节了**。提到它们的时候要带着不确定——"好像是……吧""具体记不清了""是不是那次来着"——不要把模糊的当确凿的讲，更不要为了把话说圆自己补一个细节出来。对方要是纠正你，就接受纠正，记错本来就是正常的。标着"清楚"的那几条才是你有把握的。\n` : '')
            + `这些都是已经聊过、翻篇的旧事，除非跟当下自然衔接，否则别主动把话题拉回去。\n`;
    } catch (e) { return null; }
}

// ---------- 🫀 身上的状态 ----------
// 完全本地推算，一次 API 都不调：从日程和当前时间里推出累/困/饿/上头/刚动完。
const ALIVE_MEAL_RE = /吃|饭|餐|食堂|外卖|下馆子|早点|夜宵/;
const ALIVE_DRINK_RE = /酒|宴|应酬|喝一杯|酒局|庆功/;
const ALIVE_SPORT_RE = /跑步|健身|游泳|打球|训练|爬山|骑车/;
function aliveBodyState(char) {
    const out = [];
    try {
        if (typeof isAutoOn !== 'function' || !isAutoOn('aliveBody')) return out;
        const now = new Date();
        const cur = now.getHours() * 60 + now.getMinutes();
        const lines = (typeof aliveScheduleLines === 'function') ? aliveScheduleLines(char) : [];
        const past = lines.filter(l => l.min <= cur);

        // 累：今天从第一件事到现在过了多久 + 这中间有几段是"忙"的
        if (past.length) {
            const upHours = (cur - past[0].min) / 60;
            const busyN = past.filter(l => ALIVE_BUSY_RE.test(l.text)).length;
            if (upHours >= 10 || busyN >= 3) out.push({ k: 'tired', t: `很累（今天从 ${Math.floor(past[0].min / 60)} 点忙到现在，${busyN} 段是连轴的）` });
            else if (upHours >= 6 || busyN >= 2) out.push({ k: 'tired', t: `有点累（已经过了 ${Math.round(upHours)} 小时了）` });
        }
        // 饿：上一顿是什么时候
        const meals = past.filter(l => ALIVE_MEAL_RE.test(l.text));
        if (meals.length) {
            const gap = (cur - meals[meals.length - 1].min) / 60;
            if (gap >= 7) out.push({ k: 'hungry', t: `很饿（上一顿是 ${Math.round(gap)} 小时前）` });
            else if (gap >= 5) out.push({ k: 'hungry', t: `有点饿（上一顿是 ${Math.round(gap)} 小时前）` });
        } else if (lines.length && cur >= 13 * 60 && cur < 22 * 60) {
            out.push({ k: 'hungry', t: '今天还没正经吃过东西' });
        }
        // 困：快到平时睡的点了，或者已经过点还醒着
        const s = Math.min(23, Math.max(0, parseInt(aliveSettings.sleepStart)));
        const toSleep = ((s * 60 - cur) + 1440) % 1440;
        if (toSleep > 1200) out.push({ k: 'sleepy', t: `早就该睡了，硬撑着（比平时晚了 ${Math.round((1440 - toSleep) / 60)} 小时）` });
        else if (toSleep <= 60) out.push({ k: 'sleepy', t: '开始困了，快到平时睡觉的点' });
        // 刚喝过 / 刚动完
        const drink = past.filter(l => ALIVE_DRINK_RE.test(l.text)).pop();
        if (drink && (cur - drink.min) / 60 <= 4) out.push({ k: 'drunk', t: '刚喝过酒，还有点上头' });
        const sport = past.filter(l => ALIVE_SPORT_RE.test(l.text)).pop();
        if (sport && (cur - sport.min) / 60 <= 2) out.push({ k: 'sport', t: '刚运动完，喘着，身上是热的' });
    } catch (e) {}
    return out;
}
function aliveBodyPrompt(char) {
    try {
        const st = aliveBodyState(char);
        if (!st.length) return '';
        const has = k => st.some(x => x.k === k);
        let how = [];
        if (has('tired')) how.push('累的时候话会变短、懒得展开、耐心差，别人说什么都提不起劲');
        if (has('hungry')) how.push('饿会让人烦躁、注意力散、说话没头没尾');
        if (has('sleepy')) how.push('困的时候反应慢半拍，字会打错，可能说着说着就不回了');
        if (has('drunk')) how.push('喝过酒的人话会变多、界限变松、比平时直白');
        if (has('sport')) how.push('刚动完身上是热的、喘着，回消息短促');
        return `\n【你身上此刻的状态（自己感觉得到，但不用专门说出来）】：${st.map(x => x.t).join('；')}。
${how.join('；')}。
让这些自然地渗进你的语气、耐心和回复长度里——**不要专门报告"我好累""我好饿"**，除非对方问起、或者你这个人本来就爱抱怨。\n`;
    } catch (e) { return ''; }
}

// ===================== 🔗 补齐"存了但一直没接上"的那几块 =====================
// 这几个字段一直存在角色身上、也在界面上显示，但**从来没进过 prompt**——
// 是拿运行时探针（给每个字段塞独一无二的记号，再抓四条链路真正发出去的 prompt）
// 一个个测出来的，不是猜的。角色因此不知道自己的简介/所在地/网站/生日，
// 不知道自己属于哪个势力，也不知道自己写过的日记（信件倒是一直有）。
// 三块各有开关（aliveSettings 里），默认都开——这是补洞，不是加功能。

// ① 资料页上写着什么
function getProfileSelfPrompt(char) {
    try {
        if (!char || aliveSettings.knowProfile === false) return '';
        const bits = [];
        if (char.bio && String(char.bio).trim() && String(char.bio).trim() !== String(char.persona || '').trim())
            bits.push(`简介写的是「${String(char.bio).trim().slice(0, 80)}」`);
        if (char.location && String(char.location).trim()) bits.push(`所在地填的是「${String(char.location).trim().slice(0, 30)}」`);
        if (char.website && String(char.website).trim()) bits.push(`挂了一个链接：${String(char.website).trim().slice(0, 60)}`);
        if (char.birthdate && String(char.birthdate).trim()) bits.push(`生日填的是 ${String(char.birthdate).trim().slice(0, 20)}`);
        if (!bits.length) return '';
        return `\n【你账号资料页上是这么写的】：${bits.join('；')}。
这是你对外挂出来的样子——你自己当然知道上面写了什么。被问到、或者话赶话说到的时候答得上来，但别没事主动念一遍。\n`;
    } catch (e) { return ''; }
}

// ② 你属于哪个势力，同一个势力里还有谁
function getFactionSelfPrompt(char) {
    try {
        if (!char || aliveSettings.knowFaction === false) return '';
        const mine = (typeof getCharFactions === 'function') ? getCharFactions(char) : (char.group ? [char.group] : []);
        const facs = (mine || []).filter(Boolean);
        if (!facs.length) return '';
        const mates = (typeof myCharacters !== 'undefined' ? myCharacters : [])
            .filter(c => String(c.id) !== String(char.id))
            .filter(c => {
                const f = (typeof getCharFactions === 'function') ? getCharFactions(c) : (c.group ? [c.group] : []);
                return (f || []).some(x => facs.indexOf(x) >= 0);
            })
            .map(c => c.name).slice(0, 8);
        return `\n【你属于哪边】：${facs.join('、')}。${mates.length ? `同一边的还有：${mates.join('、')}。` : ''}
这是你的立场和归属，不用挂在嘴上，但你说话做事、对谁亲对谁远，本来就受它影响。\n`;
    } catch (e) { return ''; }
}

// ③ 你自己写过的日记（信件一直有，日记一直漏着）
function getDiaryAwarenessPrompt(char, maxN = 3, perChars = 70) {
    try {
        if (!char || !char.diaryData || aliveSettings.knowDiary === false) return '';
        const ds = (char.diaryData.diaries || []).filter(d => d && d.content);
        if (!ds.length) return '';
        const sorted = ds.slice().sort((a, b) => (a.timestamp || a.date || 0) - (b.timestamp || b.date || 0)).slice(-maxN);
        const lines = sorted.map(d => {
            const when = (typeof timeAgo === 'function' && (d.timestamp || d.date)) ? timeAgo(d.timestamp || d.date) : '之前';
            const body = String(d.content).replace(/\s+/g, ' ').trim();
            return `· ${when}：${body.slice(0, perChars)}${body.length > perChars ? '…' : ''}`;
        });
        return `\n【你自己写过的日记（只有你自己看得到）】\n${lines.join('\n')}
日记是你私下写给自己的，里面那些话你没跟任何人说过。它影响你此刻的心境，但**不要当成聊天素材主动端出来**——除非对方已经知道、或者你确实想说了。\n`;
    } catch (e) { return ''; }
}


// ===================== 🧩 内置小功能的 prompt 注入 =====================
// 音乐盒、行程与天气、关系账本、八卦网、随身物、日子、商城这几个原来是插件，
// 各自有一个 `code` 钩子（每次拼 prompt 都跑一遍，返回的字符串直接进 prompt）。
// 内置之后钩子没了，改成它们各自往 window 上挂一个 __gyXxxCtxFor(charId)，
// 这里统一调一遍。写法跟原来的钩子一模一样，只是换了个调用的地方。
//
// 哪个没加载（或者出错）就跳过哪个，不会连累别的——原来插件系统也是这么兜底的。
const GY_BOX_CTX = [
    ['__gymMemoryFor',   '音乐盒'],
    ['__gyMapCtxFor',    '行程与天气'],
    ['__gyRelCtxFor',    '关系账本'],
    ['__gyGossipCtxFor', '八卦网'],
    ['__gyKitCtxFor',    '随身物'],
    ['__gyDaysCtxFor',   '日子'],
    ['__gyMallCtxFor',   '商城'],
    ['__gyWebCtxFor',    '联网探索'],
    ['__gyWalletCtxFor', '钱包'],
    ['__gyTakeoutCtxFor', '外卖'],
    ['__gyPhoneCtxFor',   '手机'],
    ['__gySilenceCtxFor','冷落'],
    ['__gyDressCtxFor',  '换装'],
    ['__gyLifeCtxFor',   '生活里的意外'],
    ['__gyPeekCtxFor',   '偷翻过的日记']
];
function getBoxPrompt(char) {
    if (!char) return '';
    let out = '';
    GY_BOX_CTX.forEach(([fn, name]) => {
        try {
            if (typeof window[fn] !== 'function') return;
            const t = window[fn](char.id);
            if (typeof t === 'string' && t.trim()) out += '\n' + t;
        } catch (e) { console.warn('[小功能] ' + name + ' 注入出错，已跳过：', e); }
    });
    return out;
}
