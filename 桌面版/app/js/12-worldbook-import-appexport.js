// ==========================================
// 世界书：TXT / JSON 自动导入逻辑（不再调用AI，读到什么就直接添加）
// ==========================================

let wbImportPendingList = []; // 待确认的世界书导入条目：解析完先放这里，用户在弹窗里编辑确认后才真正写入 worldbooks

async function handleWbFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const btn = document.getElementById('btnWbImport');
    const originalText = btn.innerText;
    btn.innerText = "读取文件中... ⏳";
    btn.disabled = true;

    const ext = file.name.split('.').pop().toLowerCase();
    // 如果当前正在某个标签组筛选下导入，条目默认带上这个分类。
    // ⚠️ 必须排除 '__uncategorized__'：那是"未分类"这个虚拟筛选项的哨兵值，不是真分类名
    //（见 06 文件里 activeWbCategoryFilter 的注释）。漏掉它的话，在"未分类"筛选下导入的条目
    // 会被打上字面量分类 "__uncategorized__"，这个内部字符串还会被 confirmWbImportAll()
    // 当成真分类塞进 worldbookCategories 显示在分类栏里；而且这些条目因为 category 非空，
    // 反而从"未分类"里消失了，跟用户的直觉正好相反。
    const defaultCategory = (activeWbCategoryFilter && activeWbCategoryFilter !== '__uncategorized__') ? activeWbCategoryFilter : '';

    try {
        let parsedList = [];

        if (ext === 'json') {
            const rawText = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = e => reject(e);
                reader.readAsText(file, 'UTF-8');
            });

            let parsed;
            try { parsed = JSON.parse(rawText); } catch (e) { throw new Error("不是合法的 JSON 文件"); }

            let list;
            if (Array.isArray(parsed)) list = parsed;
            else if (parsed.entries && Array.isArray(parsed.entries)) list = parsed.entries;
            else if (parsed.entries && typeof parsed.entries === 'object') list = Object.values(parsed.entries);
            else list = [parsed];

            list.forEach(item => {
                if (!item || typeof item !== 'object') return;
                if (item.disable === true) return; // SillyTavern世界书里被禁用的条目（disable:true）不导入，本app没有"禁用但保留"这个状态
                const title = (item.title || item.comment || item.name || item.key || '未命名设定').toString().trim() || '未命名设定';
                const content = (item.content || item.text || item.value || item.entry || '').toString().trim();
                if (!content) return;
                const keywordsRaw = item.keywords || (Array.isArray(item.keys) ? item.keys.join(',') : (Array.isArray(item.key) ? item.key.join(',') : ''));
                const category = (item.category || '').toString().trim() || defaultCategory;
                // 酒馆世界书条目常见的"次要关键词+触发节奏"字段：keysecondary(次要关键词数组)、selectiveLogic(0=AND_ANY 3=AND_ALL 2=NOT_ANY，
                // 1=NOT_ALL没有完全对应的模式，就近按not_any处理)、probability(概率触发)、sticky/cooldown/delay(触发节奏，单位是"消息数"，
                // 跟本app的"轮"概念一致，直接原样搬过来)。没有这些字段的老式世界书文件，以下全部取默认值，行为完全不变。
                const secondaryKeywordsRaw = Array.isArray(item.keysecondary) ? item.keysecondary.join(',') : '';
                const logicMap = { 0: 'and_any', 3: 'and_all', 2: 'not_any', 1: 'not_any' };
                parsedList.push({
                    title,
                    content,
                    isGlobal: !!(item.isGlobal || item.constant),
                    weight: typeof item.weight === 'number' ? item.weight : 50,
                    keywords: (keywordsRaw || '').toString(),
                    priority: typeof item.priority === 'number' ? item.priority : 0,
                    group: (item.group || '').toString(),
                    recursive: !!item.recursive,
                    category,
                    secondaryKeywords: secondaryKeywordsRaw,
                    secondaryLogic: logicMap[item.selectiveLogic] || 'and_any',
                    probability: typeof item.probability === 'number' ? item.probability : 100,
                    stickyTurns: typeof item.sticky === 'number' ? item.sticky : 0,
                    cooldownTurns: typeof item.cooldown === 'number' ? item.cooldown : 0,
                    delayTurns: typeof item.delay === 'number' ? item.delay : 0
                });
            });

            if (parsedList.length === 0) throw new Error("JSON 里没有找到可用的世界书条目（至少需要 title/content 或等价字段）");

        } else if (ext === 'txt') {
            const text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = e => reject(e);
                reader.readAsText(file, 'UTF-8');
            });
            if (!text || !text.trim()) throw new Error("文件内容为空！");

            const title = file.name.replace(/\.txt$/i, '').trim() || '导入的设定';
            parsedList.push({
                title,
                content: text.trim(),
                isGlobal: false,
                weight: 50,
                keywords: '',
                priority: 0,
                group: '',
                recursive: false,
                category: defaultCategory
            });

        } else {
            throw new Error("只支持导入 .txt 或 .json 格式文件");
        }

        wbImportPendingList = parsedList;
        openWbImportPreviewModal();

    } catch (err) {
        alert("导入失败：" + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
        event.target.value = '';
    }
}

function openWbImportPreviewModal() {
    if (wbImportPendingList.length === 0) return;
    renderWbImportPreviewList();
    openModal('wbImportPreviewModal');
}

function renderWbImportPreviewList() {
    const container = document.getElementById('wbImportPreviewList');
    if (!container) return;
    const catOptions = '<option value="">-- 无分类 --</option>' + worldbookCategories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
    container.innerHTML = wbImportPendingList.map((item, i) => `
        <div class="wb-import-preview-item" style="border:1px solid #1d9bf0; border-radius:8px; padding:10px; margin-bottom:10px; background:rgba(29,155,240,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-size:12px; color:#8b98a5;">第 ${i + 1} 条</span>
                <button style="background:none; border:none; color:#f91880; cursor:pointer; font-size:16px;" title="不导入这一条" onclick="removeWbImportPreviewItem(${i})">×</button>
            </div>
            <input type="text" value="${escapeHtml(item.title)}" placeholder="标题" style="width:100%; margin-bottom:6px; padding:6px; border:1px solid #1d9bf0; border-radius:4px; font-size:13px; color:#1d9bf0; box-sizing:border-box;" oninput="wbImportPendingList[${i}].title = this.value">
            <textarea rows="3" placeholder="内容" style="width:100%; padding:6px; margin-bottom:6px; border:1px solid #1d9bf0; border-radius:4px; font-size:13px; font-family:inherit; box-sizing:border-box;" oninput="wbImportPendingList[${i}].content = this.value">${escapeHtml(item.content)}</textarea>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12px;">
                <label style="color:#536471;">🏷️ 分类</label>
                <select data-wb-import-cat-select style="padding:4px; border:1px solid #1d9bf0; border-radius:4px; font-size:12px; color:#1d9bf0;" onchange="wbImportPendingList[${i}].category = this.value">${catOptions}</select>
                <label style="color:#536471; display:flex; align-items:center; gap:3px;">
                    <input type="checkbox" ${item.isGlobal ? 'checked' : ''} onchange="wbImportPendingList[${i}].isGlobal = this.checked"> 全局生效
                </label>
                <label style="color:#536471;">关键词</label>
                <input type="text" value="${escapeHtml(item.keywords || '')}" placeholder="留空则无条件生效" style="flex:1; min-width:100px; padding:4px; border:1px dashed #1d9bf0; border-radius:4px; font-size:12px; color:#f91880; box-sizing:border-box;" oninput="wbImportPendingList[${i}].keywords = this.value">
            </div>
        </div>`).join('');
    container.querySelectorAll('[data-wb-import-cat-select]').forEach((sel, i) => { sel.value = wbImportPendingList[i]?.category || ''; });
}

function removeWbImportPreviewItem(i) {
    wbImportPendingList.splice(i, 1);
    if (wbImportPendingList.length === 0) { closeModal('wbImportPreviewModal'); return; }
    renderWbImportPreviewList();
}

function cancelWbImportPreview() {
    wbImportPendingList = [];
    closeModal('wbImportPreviewModal');
}

function confirmWbImportAll() {
    let addedCount = 0;
    wbImportPendingList.forEach(item => {
        const title = (item.title || '').toString().trim();
        const content = (item.content || '').toString().trim();
        if (!title || !content) return;
        const category = (item.category || '').toString().trim();
        if (category && !worldbookCategories.includes(category)) worldbookCategories.push(category);
        worldbooks.push({
            id: Date.now() + Math.floor(Math.random() * 100000),
            title,
            content,
            isGlobal: !!item.isGlobal,
            weight: typeof item.weight === 'number' ? item.weight : 50,
            keywords: (item.keywords || '').toString(),
            priority: typeof item.priority === 'number' ? item.priority : 0,
            group: (item.group || '').toString(),
            recursive: !!item.recursive,
            category,
            secondaryKeywords: (item.secondaryKeywords || '').toString(),
            secondaryLogic: item.secondaryLogic || 'and_any',
            probability: typeof item.probability === 'number' ? item.probability : 100,
            stickyTurns: typeof item.stickyTurns === 'number' ? item.stickyTurns : 0,
            cooldownTurns: typeof item.cooldownTurns === 'number' ? item.cooldownTurns : 0,
            delayTurns: typeof item.delayTurns === 'number' ? item.delayTurns : 0
        });
        addedCount++;
    });

    wbImportPendingList = [];
    closeModal('wbImportPreviewModal');

    if (addedCount === 0) { alert("没有可导入的条目（标题或内容为空）"); return; }

    refreshWbCategorySelect();
    renderWorldbookCards();
    saveAllData();
    alert(`✅ 已确认导入 ${addedCount} 条世界书设定！`);
}
// 📥 导入 SillyTavern 预设（Chat Completion Preset）的逻辑已经搬到独立的"预设"页面，
// 具体实现见 js/15-ai-presets.js（handlePresetFileUpload 等函数）。

function downloadTxt(text, filename) {
    // 过滤掉文件名中可能导致错误的非法字符
    const safeFilename = filename.replace(/[\\/:*?"<>|]/g, "_");
    saveTextFileForApp(safeFilename, text, "text/plain;charset=utf-8");
}

// 通用文件保存：兼容普通浏览器 和 HBuilderX 打包后的 APK（5+ Runtime）。
// HBuilderX 的 WebView 壳子不一定支持 <a download>，所以检测到 window.plus 时改用 plus.io 写入手机公共文档目录。
// ★ 打包成App后"导出/导入JSON没反应"的修复（配合下面几处 accept="*/*" 的改动一起看）：
// 1）导出这边：之前只试了 PUBLIC_DOCUMENTS 一条路，写之前也没申请存储权限，一旦某台手机/某个安卓版本
//    权限没给到或者这个目录写入失败，就直接掉进 fallbackBrowserDownload——但那个方案在打包app的
//    WebView里基本等于没反应（没有浏览器那种"下载文件"的系统能力），所以看起来就是"点了导出啥也没有"。
// 2）现在改成：先补一次存储权限申请（跟 openFilePickerForApp 一样的套路）；PUBLIC_DOCUMENTS 写失败
//    就退一步写到 PRIVATE_DOC（应用私有目录，不受安卓分区存储限制，基本一定能写成功，不会再彻底失败）；
//    写成功后不仅弹出真实的绝对路径（用 convertLocalFileSystemURL 转换，不再是含糊的"文档目录"），
//    还会尝试用 plus.runtime.openFile 弹出系统"打开方式"选择框，用户可以直接选个文件管理器/网盘/聊天软件
//    把这个文件转存或分享出去，不用自己去手机里翻文件夹找。
// ★ 补充发现：打包app里标准的 alert() 有时候压根不会弹出来（5+ Runtime某些机型/版本对网页里
// 原生 alert/confirm 的支持不稳定），这会让上面那套"至少会弹提示"的兜底看起来还是"什么反应都没有"。
// plus.nativeUI.alert/toast 是走系统原生对话框，不经过网页的 alert 机制，显示更可靠，这里统一改用它，
// 网页版环境（没有 window.plus）还是用普通 alert，行为不变。
function appAlert(msg) {
    if (window.plus && plus.nativeUI && plus.nativeUI.alert) {
        try { plus.nativeUI.alert(msg); return; } catch (e) {}
    }
    alert(msg);
}
function appToast(msg) {
    if (window.plus && plus.nativeUI && plus.nativeUI.toast) {
        try { plus.nativeUI.toast(msg); return; } catch (e) {}
    }
}
// ★ 全面适配补充：跟 alert() 同理，普通网页的 confirm()/prompt() 在打包后的安卓WebView(5+ Runtime)里
// 同样不保证一定弹得出来（尤其是 prompt()，安卓WebView默认经常直接不响应，点了跟没点一样）。
// 这里同样改用 plus.nativeUI.confirm/prompt（系统原生对话框，走的是原生UI而不是网页层，靠谱得多）。
// 这两个原生API都是"非阻塞"的（回调式，不能直接同步拿到返回值），所以封装成返回Promise的写法，
// 调用的地方改成 await appConfirm(...) / await appPrompt(...) 即可，网页版环境行为完全不变。
// ============================================================================
// 🐛🐛 页面内的输入框/确认框 —— 不再用浏览器原生的 prompt()/confirm()
//
// 病根（打包成 exe 之后才暴露）：**Electron 根本不支持 window.prompt()**，
// 调用它直接抛 "Error: prompt() is not supported."。
// 而 appPrompt 里是 resolve(prompt(...))，异常一抛，promise 变成 rejected，
// 调用方 `await appPrompt(...)` 直接中断——表现就是**点了完全没反应，连报错都看不见**。
// 用户实测的"新建预设点击没反应"就是这么来的（js/15 那个入口正是走 appPrompt）。
// 受影响的不止一处：重命名人设、编辑消息、开分支、改标签、新建势力、重命名续写…… 全是死的。
//
// confirm() 在 Electron 里能用，但它是**系统级模态窗口**，关掉之后不保证把键盘焦点
// 还给网页（就是"导入备份之后打不了字"那个毛病）。既然要动，一并换掉。
//
// 所以改成自己画一个页面内的弹窗：
//   · 不依赖任何浏览器原生对话框，Electron / 安卓 WebView / 普通浏览器行为一致
//   · 不抢系统焦点，关掉之后光标自己回到原来的位置
//   · 返回 Promise，调用点全都已经是 await 了，一行都不用改
//   · 长文本自动用多行输入框（编辑消息正文这类场景原来挤在一行里很难用）
// 打包成安卓 App（window.plus）时仍然优先走原生对话框——那条路在那个环境里是好的。
// ============================================================================
function gyInPageDialog(opts) {
    const o = opts || {};
    return new Promise((resolve) => {
        let done = false;
        const finish = (val) => {
            if (done) return; done = true;
            document.removeEventListener('keydown', onKey, true);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            // 把焦点还给弹窗之前那个元素，接着打字不用重新点
            try { if (prevFocus && prevFocus.isConnected && prevFocus.focus) prevFocus.focus(); } catch (e) {}
            resolve(val);
        };
        const prevFocus = document.activeElement;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay gy-dialog-overlay';
        overlay.style.cssText = 'display:flex; z-index:100000;';

        const box = document.createElement('div');
        box.className = 'modal-box';
        box.style.cssText = 'width:min(460px, 92vw); max-height:80vh; display:flex; flex-direction:column; gap:14px;';

        const msg = document.createElement('div');
        msg.style.cssText = 'font-size:15px; line-height:1.6; white-space:pre-wrap; word-break:break-word;';
        msg.textContent = String(o.message == null ? '' : o.message);
        box.appendChild(msg);

        let field = null;
        if (o.withInput) {
            const val = (o.defaultValue === undefined || o.defaultValue === null) ? '' : String(o.defaultValue);
            // 内容长或者本来就有换行，就用多行框；短的用单行，回车直接确定
            const multiline = val.length > 60 || val.indexOf('\n') !== -1;
            field = document.createElement(multiline ? 'textarea' : 'input');
            field.className = 'gy-dialog-input';
            if (!multiline) field.type = 'text';
            field.value = val;
            field.style.cssText = 'width:100%; box-sizing:border-box; padding:10px 12px; font-size:15px;'
                + 'border:2px solid #1d9bf0; border-radius:10px; outline:none; font-family:inherit;'
                + (multiline ? ' min-height:160px; resize:vertical; line-height:1.6;' : '');
            box.appendChild(field);
        }

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex; gap:10px; justify-content:flex-end;';
        const mkBtn = (text, primary, onClick) => {
            const b = document.createElement('button');
            b.textContent = text;
            // 带上固定的 class，方便测试脚本定位，也方便以后写样式
            b.className = (primary ? 'btn-post gy-dialog-ok' : 'btn-secondary gy-dialog-cancel');
            b.style.cssText = 'padding:9px 22px; font-size:15px; margin:0; cursor:pointer;';
            b.addEventListener('click', onClick);
            return b;
        };
        if (o.showCancel) btnRow.appendChild(mkBtn(o.cancelText || '取消', false, () => finish(o.cancelValue)));
        btnRow.appendChild(mkBtn(o.okText || '确定', true, () => finish(o.withInput ? field.value : true)));
        box.appendChild(btnRow);

        overlay.appendChild(box);
        // 点空白处 = 取消
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) finish(o.cancelValue); });
        document.body.appendChild(overlay);

        // Esc 取消 / Enter 确定。用捕获阶段并且拦下来，免得被全局那个"Esc 关最上层弹窗"的
        // 监听器抢先关掉——那样关掉的话这个 promise 就永远悬着不 resolve 了。
        function onKey(e) {
            if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); finish(o.cancelValue); return; }
            if (e.key === 'Enter' && (!field || field.tagName !== 'TEXTAREA' || e.ctrlKey || e.metaKey)) {
                e.stopPropagation(); e.preventDefault(); finish(o.withInput ? field.value : true);
            }
        }
        document.addEventListener('keydown', onKey, true);

        setTimeout(() => {
            try { if (field) { field.focus(); field.select && field.select(); } } catch (e) {}
        }, 30);
    });
}

function appConfirm(message, okText, cancelText) {
    okText = okText || '确定'; cancelText = cancelText || '取消';
    if (window.plus && plus.nativeUI && plus.nativeUI.confirm) {
        try {
            return new Promise((resolve) => {
                plus.nativeUI.confirm(message, (e) => resolve(e.index === 0), '', [okText, cancelText]);
            });
        } catch (e) {}
    }
    return gyInPageDialog({ message, okText, cancelText, showCancel: true, cancelValue: false });
}
function appPrompt(message, defaultValue) {
    if (window.plus && plus.nativeUI && plus.nativeUI.prompt) {
        try {
            return new Promise((resolve) => {
                plus.nativeUI.prompt(message, (e) => resolve(e.index === 0 ? e.value : null), '',
                    (defaultValue === undefined || defaultValue === null) ? '' : String(defaultValue), ['确定', '取消']);
            });
        } catch (e) {}
    }
    return gyInPageDialog({ message, defaultValue, withInput: true, showCancel: true, cancelValue: null });
}
// ★ "Coding error"排查：两边目录都同样报编码错误，说明跟写哪个目录无关，问题出在内容本身——
// 常见两个诱因：1）内容里混进了"孤立代理项"（复制粘贴/输入法产生的半个emoji之类的残缺字符），
// 5+ Runtime把JS字符串转成原生编码时遇到这种非法字符会直接报编码错误；2）内容太大，通过JS桥
// 一次性传给原生层写入，超过桥接的单次传输上限也会失败。这里做两件事：写入前清洗掉孤立代理项；
// 内容太大时分成小块、排队依次写入（而不是一次性整个塞过去），双管齐下排除这两种可能。
function sanitizeForFileWrite(str) {
    if (!str) return str;
    // 匹配"没有配对的高位代理项"（第一种情况，整个匹配就是那个非法字符，直接删掉）
    // 或"前面跟着没有配对的低位代理项"（第二种情况，匹配包含了前一个正常字符，替换时要把这个正常字符原样保留，只删掉后面那个非法字符）
    return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|([^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, function (match, precedingChar) {
        return precedingChar !== undefined ? precedingChar : '';
    });
}
function writeContentToWriter(writer, content, onDone, onError, chunkSize) {
    chunkSize = chunkSize || 200000; // 20万字符一块，避免一次性传输过大内容
    writer.onerror = onError;
    if (content.length <= chunkSize) {
        writer.onwrite = onDone;
        writer.write(content);
        return;
    }
    let pos = 0;
    const writeNext = () => {
        if (pos >= content.length) { onDone(); return; }
        const chunk = content.slice(pos, pos + chunkSize);
        pos += chunk.length;
        writer.onwrite = writeNext;
        writer.write(chunk);
    };
    writeNext();
}
function saveTextFileForApp(filename, content, mimeType) {
    if (window.plus && plus.io) {
        content = sanitizeForFileWrite(content);
        appToast('正在导出…');
        const finishOk = (localUrl) => {
            let realPath = localUrl;
            try { realPath = plus.io.convertLocalFileSystemURL(localUrl) || localUrl; } catch (e) {}
            appAlert(`✅ 已保存：${filename}\n真实路径：${realPath}\n接下来可能会弹出"打开方式"选择框，可以选一个文件管理器/网盘/聊天软件App把它转存或分享出去；如果没弹出来，也可以用手机自带的文件管理器按上面这个路径手动找到它。`);
            try { plus.runtime.openFile(localUrl, {}, function () { /* 没有App能直接打开json很正常，忽略 */ }); } catch (e) {}
        };
        // ★ 真正的病根找到了：resolveLocalFileSystemURL 的第一个参数要求是字符串路径（比如"_doc/"），
        // 之前一直传的是 plus.io.PUBLIC_DOCUMENTS / plus.io.PRIVATE_DOC 这两个数字常量（那是 requestFileSystem
        // 要用的参数，两个是完全不同的API，参数类型不能混用）——传一个数字进去，原生那边按URL字符串解析
        // 自然会报编码错误，而且不管传哪个数字、写不写内容都会在第一步就失败，这正好解释了之前不管怎么改
        // 内容清洗/分块都没用，因为代码根本没走到写入那一步。这里直接改成传字符串路径，不再传数字常量。
        // 每一步失败都打上具体是在哪个阶段失败的标签，方便以后再出问题时能一眼定位，不用再靠瞎猜。
        const tryWrite = (localUrlPrefix, onFail) => {
            try {
                plus.io.resolveLocalFileSystemURL(localUrlPrefix, (entry) => {
                    entry.getFile(filename, { create: true }, (fileEntry) => {
                        fileEntry.createWriter((writer) => {
                            writeContentToWriter(writer, content, () => finishOk(localUrlPrefix + filename), (e) => onFail(e, 'write写入'));
                        }, (e) => onFail(e, 'createWriter建写入器'));
                    }, (e) => onFail(e, 'getFile建文件'));
                }, (e) => onFail(e, 'resolveLocalFileSystemURL定位目录'));
            } catch (e) { onFail(e, 'catch同步异常'); }
        };
        const describeErr = (e, stage) => {
            let codePart = (e && e.code !== undefined) ? `代码${e.code} ` : '';
            let msgPart = (e && e.message) ? e.message : (e ? (function () { try { return JSON.stringify(e); } catch (e2) { return String(e); } })() : '未知错误');
            return `[${stage || '未知阶段'}] ${codePart}${msgPart}`;
        };
        const doWrite = () => {
            tryWrite('_documents/', (err1, stage1) => {
                // 公共文档目录写失败（权限/分区存储限制等），退一步写应用私有目录，基本不会再失败
                tryWrite('_doc/', (err2, stage2) => {
                    // 两种app内写入方式都失败了——不再悄悄掉进在打包app里基本无效的浏览器下载，
                    // 而是把两边的真实错误信息都亮出来（带具体阶段+错误代码），方便精确定位问题
                    appAlert(`❌ 导出失败（两种保存方式都没成功）\n公共目录：${describeErr(err1, stage1)}\n私有目录：${describeErr(err2, stage2)}\n可以把这条提示截图发给开发者看看。`);
                });
            });
        };
        if (plus.android) {
            try {
                plus.android.requestPermissions(
                    ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'],
                    doWrite, doWrite // 拒绝了也照样尝试写（PRIVATE_DOC本来就不需要这个权限）
                );
            } catch (e) { doWrite(); }
        } else {
            doWrite();
        }
    } else {
        fallbackBrowserDownload(filename, content, mimeType);
    }
}
function fallbackBrowserDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}// ==========================
// 📥 导出日记与信件
// ==========================
function exportCurrentDiary() {
    // 获取详情弹窗中的内容
    const title = document.getElementById('diaryDetailTitle').innerText || '未命名信件';
    const date = document.getElementById('diaryDetailDate').innerText || '';
    const content = document.getElementById('diaryDetailContent').innerText || '';

    // 拼接成适合阅读的文本格式
    const textToSave = `【${title}】\n${date}\n\n${content}`;

    // 调用下载
    downloadTxt(textToSave, `${title}.txt`);
}

// ==========================================
// 🔗 从Git链接导入（预设 / 世界书 / 角色卡 / 正则脚本）
// ==========================================
// 设计取舍：不做"装任意第三方扩展/执行任意JS"这种高风险功能，而是做安全版本——
// 粘贴一个指向原始文件的直链（GitHub raw、Gitee raw、jsdelivr CDN等），拉取内容后
// 自动识别是预设/世界书/角色卡(JSON或PNG)/独立正则脚本里的哪一种，直接复用app里已有的对应导入逻辑，
// 不会执行来源不明的代码，最多是"数据格式没识别出来"这种失败，不存在安全风险。
function mapStRegexScriptItemsFromRawList(list) {
    return (list || []).map(mapStRegexScriptItem).filter(Boolean);
}
// 独立的"正则脚本JSON文件"导入（跟预设内嵌的regex_scripts是同一套单条字段结构，直接复用映射逻辑）：
// 弹一个简单确认框（不做完整的逐条预览UI，跟世界书/预设导入比起来这个场景更单一、字段更少，直接问一句"导入几条"够用了）。
async function importRegexScriptArray(list) {
    const mapped = mapStRegexScriptItemsFromRawList(list);
    if (mapped.length === 0) { appAlert('导入失败：这份JSON看起来是个数组，但里面没有找到合法的正则脚本（至少需要findRegex字段）。'); return; }
    const ok = await appConfirm(`识别到 ${mapped.length} 条正则脚本，确认导入吗？`);
    if (!ok) return;
    regexScripts = regexScripts.concat(mapped);
    if (typeof renderRegexScriptsList === 'function') renderRegexScriptsList();
    saveAllData();
    appAlert(`成功导入 ${mapped.length} 条正则脚本！`);
}

// 用拉取到的文本/二进制内容，拼一个真正的 File 对象，喂给已有的"文件选择"导入函数——
// 这样完全复用现成的解析/预览/确认逻辑，不用为"从链接来的内容"另外写一遍。
function buildFakeFileEvent(file) {
    return { target: { files: [file], value: '' } };
}

async function importFromGitLink() {
    const input = document.getElementById('gitImportUrlInput');
    const statusEl = document.getElementById('gitImportStatus');
    const rawUrl = input ? input.value.trim() : '';
    if (!rawUrl) { appAlert('请先粘贴一个指向原始文件的链接（比如 raw.githubusercontent.com 开头的地址，或GitHub网页链接也行）。'); return; }

    // 自动把常见的"GitHub网页链接"转成"原始文件直链"：
    // https://github.com/user/repo/blob/branch/path/file.json -> https://raw.githubusercontent.com/user/repo/branch/path/file.json
    let fetchUrl = rawUrl;
    const githubBlobMatch = rawUrl.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/(.+)$/);
    if (githubBlobMatch) fetchUrl = `https://raw.githubusercontent.com/${githubBlobMatch[1]}/${githubBlobMatch[2]}/${githubBlobMatch[3]}`;

    if (statusEl) statusEl.innerText = '正在拉取链接内容...⏳';

    let resp;
    try {
        resp = await fetch(fetchUrl);
        if (!resp.ok) throw new Error(`服务器返回了 HTTP ${resp.status}`);
    } catch (e) {
        if (statusEl) statusEl.innerText = '';
        appAlert('拉取失败：' + enhanceNetworkErrorMessage(e.message));
        return;
    }

    try {
        const contentType = (resp.headers.get('content-type') || '').toLowerCase();
        const isPng = contentType.includes('image/png') || fetchUrl.toLowerCase().split('?')[0].endsWith('.png');
        const fileName = (fetchUrl.split('/').pop() || 'import').split('?')[0];

        if (isPng) {
            // 角色卡PNG：走现成的角色卡导入引擎（内部会自动解析tEXt数据块里的chara信息）
            const blob = await resp.blob();
            const file = new File([blob], fileName.endsWith('.png') ? fileName : fileName + '.png', { type: 'image/png' });
            await handleCharCardImport(buildFakeFileEvent(file));
            if (statusEl) statusEl.innerText = '';
            if (input) input.value = '';
            return;
        }

        const rawText = await resp.text();
        let parsed;
        try { parsed = JSON.parse(rawText); }
        catch (e) { throw new Error('这不是合法的JSON，也不像PNG图片——目前"Git链接导入"只支持预设/世界书/正则脚本(JSON)或角色卡(JSON/PNG)。'); }

        const jsonFileName = fileName.toLowerCase().endsWith('.json') ? fileName : fileName + '.json';
        const fakeFile = new File([rawText], jsonFileName, { type: 'application/json' });

        if (Array.isArray(parsed.prompts)) {
            // 预设：有 prompts 数组是最明确的特征
            await handlePresetFileUpload(buildFakeFileEvent(fakeFile));
        } else if ((parsed.data && (parsed.data.name || parsed.data.description)) || (typeof parsed.spec === 'string' && parsed.spec.indexOf('chara_card') !== -1) || (parsed.name && parsed.description !== undefined && parsed.first_mes !== undefined)) {
            // 角色卡JSON：v2/v3是 data.name+data.description，老版v1格式是顶层name+description+first_mes
            await handleCharCardImport(buildFakeFileEvent(fakeFile));
        } else if (Array.isArray(parsed) || parsed.entries) {
            // 世界书 或 独立正则脚本数组：都是"一堆条目的列表"，靠条目字段特征区分——
            // 正则脚本条目有 findRegex/scriptName，世界书条目是 title/content/key/keysecondary 这一套
            const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.entries) ? parsed.entries : Object.values(parsed.entries || {}));
            const looksLikeRegexList = list.length > 0 && list.every(x => x && typeof x === 'object' && (x.findRegex !== undefined || x.scriptName !== undefined));
            if (looksLikeRegexList) {
                await importRegexScriptArray(list);
            } else {
                await handleWbFileUpload(buildFakeFileEvent(fakeFile));
            }
        } else {
            throw new Error('识别不出这份JSON是预设/世界书/角色卡/正则脚本里的哪一种，暂时无法自动导入。');
        }
        if (statusEl) statusEl.innerText = '';
        if (input) input.value = '';
    } catch (e) {
        if (statusEl) statusEl.innerText = '';
        appAlert('导入失败：' + e.message);
    }
}
