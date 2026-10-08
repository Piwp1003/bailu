// ==========================================
// ⚙️ 全局角色互动设置与后台定时小剧场引擎
// ==========================================

// 1. 初始化并读取设置
function loadGlobalInteractionSettings() {
    const enabled = localStorage.getItem('settingEnableCharInteraction');
    const notify = localStorage.getItem('settingNotifyCharInteraction');
    // 默认开启互动，默认关闭弹窗
    const cbEnable = document.getElementById('settingEnableCharInteraction');
    const cbNotify = document.getElementById('settingNotifyCharInteraction');
    if (cbEnable) cbEnable.checked = enabled !== 'false'; 
    if (cbNotify) cbNotify.checked = notify === 'true';

    // 这两个都默认开启——"不秒回"和"路人会互相接话"是更像真人的行为，
    // 想要老的即时反馈随时能在这里关掉。
    const cbDelay = document.getElementById('settingCharReplyDelay');
    if (cbDelay) {
        cbDelay.checked = localStorage.getItem('settingCharReplyDelay') !== 'false';
        if (typeof charReplyDelayEnabled !== 'undefined') charReplyDelayEnabled = cbDelay.checked;
    }
    const cbArgue = document.getElementById('settingNpcArgue');
    if (cbArgue) {
        cbArgue.checked = localStorage.getItem('settingNpcArgue') !== 'false';
        if (typeof npcArgueProb !== 'undefined') npcArgueProb = cbArgue.checked ? 0.5 : 0;
    }
    // 流式输出默认开着（逐字显示体验更好）；接口流式不稳的用户可以关掉。
    const cbStream = document.getElementById('settingEnableStreaming');
    if (cbStream) {
        cbStream.checked = localStorage.getItem('settingEnableStreaming') !== 'false';
        if (typeof enableStreaming !== 'undefined') enableStreaming = cbStream.checked;
    }
    // 群聊转私聊默认开着——“有些话不当着大家面说”本来就是真人会做的事，
    // 而且只是多一个选项，不强制角色用。想让群聊安静点的在设置里关掉。
    const cbGmtc = document.getElementById('settingEnableGroupMoveToChat');
    if (cbGmtc) {
        cbGmtc.checked = localStorage.getItem('settingEnableGroupMoveToChat') !== 'false';
        if (typeof enableGroupMoveToChat !== 'undefined') enableGroupMoveToChat = cbGmtc.checked;
    }
}
// 网页加载时自动读取
document.addEventListener("DOMContentLoaded", loadGlobalInteractionSettings);
setTimeout(loadGlobalInteractionSettings, 1000); // 兜底执行

// 2. 保存设置
function saveGlobalInteractionSettings() {
    const cbEnable = document.getElementById('settingEnableCharInteraction');
    const cbNotify = document.getElementById('settingNotifyCharInteraction');
    if (cbEnable) localStorage.setItem('settingEnableCharInteraction', cbEnable.checked);
    if (cbNotify) localStorage.setItem('settingNotifyCharInteraction', cbNotify.checked);
    // 角色评论是否延迟（不秒回）——存进 localStorage 的同时也同步到那个全局变量，
    // 改完立刻生效，不用刷新页面。
    const cbDelay = document.getElementById('settingCharReplyDelay');
    if (cbDelay) {
        localStorage.setItem('settingCharReplyDelay', cbDelay.checked);
        if (typeof charReplyDelayEnabled !== 'undefined') charReplyDelayEnabled = cbDelay.checked;
    }
    const cbArgue = document.getElementById('settingNpcArgue');
    if (cbArgue) {
        localStorage.setItem('settingNpcArgue', cbArgue.checked);
        // 关掉就是概率 0；打开恢复默认的一半概率（每轮都吵会把角色的话刷没）
        if (typeof npcArgueProb !== 'undefined') npcArgueProb = cbArgue.checked ? 0.5 : 0;
    }
    const cbStream = document.getElementById('settingEnableStreaming');
    if (cbStream) {
        localStorage.setItem('settingEnableStreaming', cbStream.checked);
        if (typeof enableStreaming !== 'undefined') enableStreaming = cbStream.checked;
    }
    const cbGmtc = document.getElementById('settingEnableGroupMoveToChat');
    if (cbGmtc) {
        localStorage.setItem('settingEnableGroupMoveToChat', cbGmtc.checked);
        if (typeof enableGroupMoveToChat !== 'undefined') enableGroupMoveToChat = cbGmtc.checked;
    }
}

// 3. 全局状态检查器（供推文、爆料等系统调用）
function isGlobalCharInteractionEnabled() {
    const cb = document.getElementById('settingEnableCharInteraction');
    return cb ? cb.checked : (localStorage.getItem('settingEnableCharInteraction') !== 'false');
}

// ===================== 🎭 小剧场 =====================
// 有关系的两个角色，会在后台自己发生点小事。
// 改造前：演完只更新一下状态气泡、弹个 toast，内容当场蒸发——你永远看不到"到底发生了什么"，
// 角色自己也不记得，等于白花了一次 API。
// 现在：存进 globalTheaterLogs（能在「我们的故事 → Ta们在做什么」里翻），
// 攒够几场就总结成 char.theaterMemory 喂回各功能，所以角色会自然提起一件你不在场的事。
// 保留多少场在「记忆总览」页里自己定：**默认 0 ＝ 不限**（一场都不丢）。
// 觉得存档太大了再去设个上限，超出的从最早的开始丢。
function addTheaterLog(entry) {
    if (typeof globalTheaterLogs === 'undefined' || !Array.isArray(globalTheaterLogs)) globalTheaterLogs = [];
    globalTheaterLogs.push(entry);
    const keep = (typeof theaterLogKeep === 'number' && theaterLogKeep > 0) ? Math.round(theaterLogKeep) : 0;
    if (keep > 0) { while (globalTheaterLogs.length > keep) globalTheaterLogs.shift(); }
    try { if (typeof window.gyDataChanged === 'function') window.gyDataChanged('theater'); } catch (e) {}   // 时间卡的"上一次"跟着变
}

// 真正跑一场。manual=true 是用户在页面上点「现在演一场」。
// 🔌 开关只管**自动**那一路。以前手动点也要先去把开关打开，理由是"别绕过开关偷偷花钱"——
//    但手动点本来就是你自己按的，钱是你主动花的，不存在"偷偷"。结果就是每次想看一场
//    都得先跑去设置里开开关、看完再回去关掉，纯粹添堵。全 app 统一成一条规矩：
//    **点了就生成，开关只决定它会不会自己发生。**
// 🧾 小剧场会读什么，登记到「注入内容管理 → ② 生成时读什么」那一页去，
//    让用户自己勾。登记要在加载时就做，不然那一页要等演过一出才看得见这一组。
(function regTheaterSrc(tries) {
    try {
        if (window.gyInjectSrc && typeof window.gyInjectSrc.def === 'function') {
            window.gyInjectSrc.def({
                feat: 'theater', icon: '🎭', title: '小剧场（两个角色背着你发生的事）',
                note: '每演一出之前，程序会把下面这些素材递给模型。全关掉的话就只剩两个人的人设和关系——'
                    + '演出来的多半是"一起吃饭""线上拌嘴"这种谁都能套的桥段。',
                items: [
                    { k: 'recent',  label: '他们最近已经演过什么', desc: '给了才不会老演同一出。' },
                    { k: 'dress',   label: '换过的头像 / 背景 / 壁纸', desc: '含当时谁说了什么。' },
                    { k: 'phone',   label: '手机被翻过这件事', desc: '' },
                    { k: 'sched',   label: '各自今天的日程', desc: '' },
                    { k: 'wallet',  label: '各自最近一笔账', desc: '', defaultOff: true }
                ]
            });
            return;
        }
    } catch (e) {}
    if ((tries || 0) < 12) setTimeout(() => regTheaterSrc((tries || 0) + 1), 500);
})(0);

async function runTheaterScene(manual, forChar) {
    // 🎬 报一下场景：自主模式调过来的时候外面已经定了场景，这里不抢（Soft）。
    //    所以"自动跑"和"你手动点这一次"能在注入页里分开设。
    if (typeof window.gyInjectInSceneSoft === 'function')
        return window.gyInjectInSceneSoft('theater', () => runTheaterSceneInner(manual, forChar));
    return runTheaterSceneInner(manual, forChar);
}
async function runTheaterSceneInner(manual, forChar) {
    if (!manual && typeof isAutoOn === 'function' && !isAutoOn('charTheater')) return { blocked: 'switch' };
    if (!isGlobalCharInteractionEnabled()) return { blocked: 'interaction' };
    if (!manual) {
        if (Math.random() > 0.3) return null;   // 低概率触发，避免太频繁显得不真实
    }
    const api = getApiConfig(true);
    if (!api.key) return null;

    // 寻找存在人物关系的角色对
    // ⚠️ 关系数据在全局 charRelationships 数组里（fromId/toId/label）
    let relatedPairs = [];
    for (let rel of charRelationships) {
        let charA = myCharacters.find(c => c.id == rel.fromId);
        let charB = myCharacters.find(c => c.id == rel.toId);
        if (charA && charB && charA.id !== charB.id) {
            // 关系是有方向的（A 暗恋 B ≠ B 暗恋 A）：两个方向都写上，对调 A/B 也不会把意思弄反
            const back = charRelationships.find(r2 => r2 !== rel && r2.fromId == rel.toId && r2.toId == rel.fromId);
            const relation = `${charA.name}→${charB.name}：${rel.label || '认识'}` + (back ? `；${charB.name}→${charA.name}：${back.label || '认识'}` : '');
            if (!relatedPairs.some(p => (p.charA === charB && p.charB === charA))) relatedPairs.push({ charA, charB, relation });
        }
    }
    // 自主模式里 TA 自己选了"去找关系网里的某个人"：以前这里还是全员随便抽一对，
    // 结果常常演的是另外两个人的事。现在只在跟 TA 有关系的那几对里抽。
    if (forChar) {
        const mine = relatedPairs.filter(p => String(p.charA.id) === String(forChar.id) || String(p.charB.id) === String(forChar.id))
            .map(p => String(p.charA.id) === String(forChar.id) ? p : { charA: p.charB, charB: p.charA, relation: p.relation });
        if (mine.length) relatedPairs = mine; else return null;
    }
    if (relatedPairs.length === 0) return null;

    const pair = relatedPairs[Math.floor(Math.random() * relatedPairs.length)];
    const charA = pair.charA, charB = pair.charB;

    // 最近他俩已经演过什么，别老演同一出
    const recent = (typeof globalTheaterLogs !== 'undefined' ? globalTheaterLogs : [])
        .filter(l => l && ((String(l.charAId) === String(charA.id) && String(l.charBId) === String(charB.id))
                        || (String(l.charAId) === String(charB.id) && String(l.charBId) === String(charA.id))))
        .slice(-5).map(l => '- ' + (l.summary || '')).join('\n');

    // 🎀📱 这两个人身上最近真发生过的事（换了头像被谁看见、谁的手机被翻过）——
    //      不给这些，小剧场永远只能演"一起吃饭""线上拌嘴"这类无根之谈。
    //      读哪几样由用户定：设置 → 🧾 注入内容管理 → ② 生成时读什么 → 🎭 小剧场
    const thSrc = k => { try { return !window.gyInjectSrc || window.gyInjectSrc.on('theater', k); } catch (e) { return true; } };
    let realBits = '';
    try {
        const bits = [];
        if (thSrc('dress') && typeof window.gyDressBetween === 'function')
            window.gyDressBetween(charA.id, charB.id, 3).forEach(x => bits.push('- ' + x.text));
        [charA, charB].forEach(c => {
            if (thSrc('dress') && typeof window.gyDressRecent === 'function')
                window.gyDressRecent(c.id, 2).forEach(x => bits.push(`- ${c.name}：${x.text.replace(/^你/, '')}`));
            if (thSrc('phone') && typeof window.gyPhoneSeen === 'function')
                (window.gyPhoneSeen(c.id) || []).slice(0, 2).forEach(x => bits.push(`- ${c.name} 的手机被用户翻过：${x.gist || x.name}`));
            if (thSrc('sched') && c.schedule && c.schedule.text)
                bits.push(`- ${c.name} 今天：${String(c.schedule.text).replace(/\s+/g, ' ').slice(0, 40)}`);
            if (thSrc('wallet') && window.gyWallet && typeof window.gyWallet.log === 'function')
                (window.gyWallet.log(c.id) || []).slice(0, 1).forEach(x => bits.push(`- ${c.name} 最近一笔账：${x.why}`));
        });
        if (bits.length) realBits = `\n【他们身上最近真发生过的事（可以用，也可以不用；用的话别当新闻播报，是他们本来就知道的事）】：\n${bits.slice(0, 8).join('\n')}\n`;
    } catch (e) {}

    const prompt = `现在的真实时间是 ${new Date().toLocaleString('zh-CN', { hour12: false })}。
这两个角色有如下关系：
${charA.name} 的人设：${String(charA.persona || '').slice(0, 800)}
${charB.name} 的人设：${String(charB.persona || '').slice(0, 800)}
他们之间的关系是：${pair.relation}。
${(recent && thSrc('recent')) ? `\n【他们最近已经发生过这些事，这次换点别的，别重复】：\n${recent}\n` : ''}${realBits}
他们现在背着用户正在私下发生一件小事（一起吃饭、线上拌嘴、讨论工作、意外偶遇、互相吐槽某个人等等）。
请根据他们的性格和关系写出来。注意：用户不在场，这是他们两个人之间的事。

严格输出 JSON，不要有任何多余字符：
{"scene": "这件事的经过，120字以内，有画面感，可以带一两句对话", "charA_status": "20字以内，${charA.name}此刻的状态", "charB_status": "20字以内，${charB.name}此刻的状态", "event_summary": "15字以内，一句话概括"}`;

    try {
        // 2500 而不是 900：同上，推理模型的思考被中转塞进正文时会把额度吃光
        let data = await sendChatRequest(api, prompt, { max_tokens: 2500 });
        if (data.error) return null;
        let text = data.choices?.[0]?.message?.content?.trim() || "";
        if (typeof extractAfterFinalMarker === 'function') text = extractAfterFinalMarker(text).trim();
        text = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
        let parsed = (typeof extractJsonObject === 'function') ? extractJsonObject(text) : JSON.parse(text);
        if (!parsed || !parsed.charA_status || !parsed.charB_status) return null;

        if (typeof saveCharLifeState === 'function') {
            saveCharLifeState(charA, parsed.charA_status, '私下互动');
            saveCharLifeState(charB, parsed.charB_status, '私下互动');
        }
        const entry = {
            id: 'th_' + Date.now() + Math.floor(Math.random() * 1000),
            at: Date.now(),
            charAId: charA.id, charBId: charB.id,
            charAName: charA.name, charBName: charB.name,
            relation: pair.relation,
            summary: parsed.event_summary || '两个人碰上了',
            scene: parsed.scene || '',
            statusA: parsed.charA_status, statusB: parsed.charB_status
        };
        addTheaterLog(entry);
        if (typeof saveAllData === 'function') saveAllData();

        // 攒够了就把各自那份记忆更新一下（函数内部判断够不够、开关开没开）
        if (typeof updateTheaterMemoryAsync === 'function') { updateTheaterMemoryAsync(charA); updateTheaterMemoryAsync(charB); }

        const cbNotify = document.getElementById('settingNotifyCharInteraction');
        if (!manual && cbNotify && cbNotify.checked) {
            const msg = `👀 ${charA.name} 和 ${charB.name} ${entry.summary}`;
            if (typeof showToast === 'function') showToast('', '🎭 Ta们在做什么', msg, null, null, false);
        }
        // 页面开着就顺手刷新
        const view = document.getElementById('view-theater');
        if (view && view.style.display !== 'none' && typeof renderTheaterPage === 'function') renderTheaterPage();
        return entry;
    } catch (e) { console.log("后台自动互动生成跳过：", e); return null; }
}

setInterval(() => { runTheaterScene(false); }, 5 * 60000); // 5分钟 = 300,000毫秒
// ===================== 旧聊天归档弹窗与阅览功能（含一键复活线功能） =====================
function ensureArchivedChatsModals() {
    if (!document.getElementById('archivedChatsListModal')) {
        const div1 = document.createElement('div');
        div1.className = 'modal-overlay';
        div1.id = 'archivedChatsListModal';
        div1.style.zIndex = '3000';
        div1.innerHTML = `
            <div class="modal-box" style="width: 400px; max-height:80vh; display:flex; flex-direction:column;">
                <h3 style="margin-top:0; color:#1d9bf0;" id="archivedChatsListTitle">📜 历史聊天记录</h3>
                <div id="archivedChatsListContent" style="flex:1; overflow-y:auto; margin-bottom:15px; padding-right:5px;"></div>
                <button class="btn-cancel" onclick="closeModal('archivedChatsListModal')">关闭</button>
            </div>
        `;
        document.body.appendChild(div1);
    }
    if (!document.getElementById('archivedChatViewModal')) {
        const div2 = document.createElement('div');
        div2.className = 'modal-overlay';
        div2.id = 'archivedChatViewModal';
        div2.style.zIndex = '3005';
        div2.innerHTML = `
            <div class="modal-box" style="width: 500px; height: 85vh; max-height: 85vh; display:flex; flex-direction:column; padding:0; overflow:hidden;">
                <div style="padding:15px; border-bottom:1px solid #eff3f4; display:flex; justify-content:space-between; align-items:center; z-index:10;">
                    <div class="back-btn" onclick="closeModal('archivedChatViewModal'); openModal('archivedChatsListModal')" style="margin:0; background:rgba(29,155,240,0.1);">←</div>
                    <h3 style="margin:0; color:#1d9bf0; font-size:16px;" id="archivedChatViewTitle">旧聊天</h3>
                    <!-- 💡 新增：一键恢复并继续聊天的复活按钮 -->
                    <button class="btn-edit-small" id="btnRestoreArchivedChat" style="margin:0; background:#17bf63; color:white; border:none;">⚡ 恢复此线</button>
                </div>
                <div id="archivedChatViewContent" class="chat-messages" style="flex:1; overflow-y:auto; padding:15px; background:transparent;"></div>
            </div>
        `;
        document.body.appendChild(div2);
    }
}

function openArchivedChatsListModal(charId) {
    ensureArchivedChatsModals();
    const char = myCharacters.find(c => c.id == charId);
    // 一条存档都没有的时候原来是直接 return——点了完全没反应，用户只会以为按钮坏了。
    if (!char) { if (typeof appAlert === 'function') appAlert('没找到这个角色。'); return; }
    if (!char.archivedChats || char.archivedChats.length === 0) {
        const msg = `${char.name} 还没有历史聊天存档。\n\n存档是在你「归档当前聊天」之后才产生的：归档会把现在这段聊天收起来存好、聊天框清空重新开始，之后就能在这里翻回去看，也能一键恢复。`;
        if (typeof appAlert === 'function') appAlert(msg); else alert(msg);
        return;
    }
    
    document.getElementById('archivedChatsListTitle').innerText = `📜 ${char.name} 的历史聊天`;
    const listHtml = [...char.archivedChats].reverse().map((arc, rIdx) => {
        const trueIdx = char.archivedChats.length - 1 - rIdx;
        return `<div class="wb-card" style="min-width:0; max-width:none; width:100%; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div style="flex:1; min-width:0; cursor:pointer;" onclick="closeModal('archivedChatsListModal'); viewArchivedChat('${charId}', ${trueIdx})">
                <div style="font-weight:bold; font-size:14px; color:#1d9bf0;">📅 ${arc.timeStr}</div>
                <div style="font-size:12px; color:#8b98a5;">共 ${arc.messages.length} 条消息</div>
            </div>
            <button class="btn-edit-small" style="color:#f91880; border-color:#f91880; margin:0 0 0 10px; padding:4px 8px; flex-shrink:0;" onclick="deleteArchivedChat('${charId}', ${trueIdx}, event)">删除</button>
        </div>`;
    }).join('');
    
    document.getElementById('archivedChatsListContent').innerHTML = listHtml;
    openModal('archivedChatsListModal');
}

function viewArchivedChat(charId, idx) {
    ensureArchivedChatsModals();   // 正常流程是从列表弹窗点进来的（那边已经 ensure 过），但被直接调用时也不能白屏
    const char = myCharacters.find(c => c.id == charId);
    if (!char || !char.archivedChats || !char.archivedChats[idx]) return;
    const arc = char.archivedChats[idx];
    document.getElementById('archivedChatViewTitle').innerText = `📅 ${arc.timeStr}`;
    
    // 💡 新增：动态绑定“恢复此线”按钮的点击事件
    const restoreBtn = document.getElementById('btnRestoreArchivedChat');
    restoreBtn.onclick = () => {
        restoreArchivedChatToActive(charId, idx);
    };

    const container = document.getElementById('archivedChatViewContent');
    container.innerHTML = arc.messages.map((msg, i) => {
        if (msg.sender === 'system') return `<div class="chat-system-msg"><span>${msg.text}</span></div>`;
        let isMe = msg.sender === 'me';
        let senderChar = isMe ? currentUser : char;
        let timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let avatarHtml = getAvatarHTML(senderChar, 36);
        
        return `
            <div class="chat-msg-row ${isMe ? 'me' : 'other'}" style="margin-bottom:15px;">
                ${!isMe ? avatarHtml : ''}
                <div class="chat-bubble-wrapper" style="align-items: ${isMe ? 'flex-end' : 'flex-start'};">
                    <div class="chat-sender-name" style="font-size:10px;">${timeStr}</div>
                    <div class="chat-bubble ${isMe ? 'me' : 'other'}" style="pointer-events:none;">${msg.quote ? `<div class="chat-quote-bubble${msg.quote.type === 'tweet' ? ' tweet-quote-card' : ''}">${msg.quote.type === 'tweet' ? '<div class="tweet-quote-label">🐦 分享的推文</div>' : ''}<b>${msg.quote.name}</b>: ${renderMarkdownLite(msg.quote.text)}</div>` : ''}${renderMarkdownLite(msg.text)}${msg.mediaUrl ? `<img src="${msg.mediaUrl}" style="max-width:100%; border-radius:8px; margin-top:5px;">` : ''}</div>
                </div>
                ${isMe ? avatarHtml : ''}
            </div>`;
    }).join('');
    
    openModal('archivedChatViewModal');
}

// 💡 新增核心函数：把选中的旧聊天恢复为当前的主流聊天，同时把目前的聊天打包置换进档案库
async function restoreArchivedChatToActive(charId, idx) {
    const char = myCharacters.find(c => c.id == charId);
    if (!char || !char.archivedChats || !char.archivedChats[idx]) return;

    const confirmRestore = await appConfirm(`确定要恢复这条历史时间线吗？\n\n温馨提示：你【目前正在聊】的这段对话会自动打包存入历史档案库，绝不会丢失。两边时间线会完成互换。`);
    if (!confirmRestore) return;

    // 1. 抓取被选中的旧会话数据
    const targetSnapshot = JSON.parse(JSON.stringify(char.archivedChats[idx]));
    
    // 2. 将当前正在聊的活跃会话做成一个新归档
    const currentActiveMessages = globalChats[charId] || [];
    const currentActiveSnapshot = {
        id: Date.now(),
        timeStr: new Date().toLocaleString('zh-CN') + "（切线前留在主窗口的记录）",
        messages: JSON.parse(JSON.stringify(currentActiveMessages))
    };

    // 3. 时间线大互换：把旧线的消息砸回当前主窗口，把目前的消息塞进原本的档案位置
    globalChats[charId] = targetSnapshot.messages;
    char.archivedChats[idx] = currentActiveSnapshot;

    // 4. 保存并刷新页面
    saveAllData();
    closeModal('archivedChatViewModal');
    
    // 5. 让聊天窗口重新刷新，并震憾提示
    if (currentChatSessionId == charId) {
        renderChatMessages();
    } else {
        switchChatSession(charId);
    }
    alert(`⚡ 时间线跳转成功！已切回至【${targetSnapshot.timeStr}】的聊天记录，你可以直接在这里继续输入消息和 TA 畅聊了！`);
}

async function deleteArchivedChat(charId, idx, e) {
    if (e) e.stopPropagation();
    if (!(await appConfirm('确定要删除这份历史聊天记录吗？删除后无法恢复！'))) return;
    const char = myCharacters.find(c => c.id == charId);
    if (!char) return;
    char.archivedChats.splice(idx, 1);
    saveAllData();
    if (char.archivedChats.length === 0) {
        closeModal('archivedChatsListModal');
    } else {
        openArchivedChatsListModal(charId);
    }
}
// ============================================================================
// 🎲 自主模式：由角色自己决定要做什么
// ----------------------------------------------------------------------------
// 跟原来那一堆"固定频率"最大的区别：原来是每个动作各自有一个闹钟，到点就机械地做那一件事
// （发帖闹钟响了就发帖，写信闹钟响了就写信），角色本人没有"选择"这回事。
// 这里改成先花一次调用问 TA："现在这个点、你今天这个日程、清单上这些还没办的事、
// 前几天跟别人发生的那些、跟用户最近聊到哪儿了——你现在想干嘛？"，TA 从下面这张动作表里挑一个，
// 然后才真的去做那件事。所以最贵的情况是两次调用（决定 + 动作本身），而"什么都不做"只花一次。
//
// ⚠️ 这个功能整体默认关（AUTO_FEATURE_DEFS 里 charAutonomy 带 defaultOff），
// 而且还要在角色的「行为模式」里单独把这个角色切到「由 TA 自己决定」才算数——两道门都开了才会跑。
// ============================================================================

// 动作表。每一项：key（模型要返回的标识）、label（给人看的）、need（这个动作要具备什么条件才轮得到它）、
// run（真正去做那件事）。想加新动作就往这个数组里加一项，决策提示词和派发都会自动带上它。
const GY_AUTONOMY_ACTIONS = [
    {
        key: 'post', label: '发一条推文', hint: '想说点什么、想记录一下、想阴阳怪气一句，都算',
        need: () => typeof executeGeneration === 'function',
        run: async (char) => { await executeGeneration([char]); return '发了条推文'; }
    },
    {
        key: 'chat', label: '私聊用户', hint: '直接给用户发条消息',
        need: () => typeof sendProactiveChatMessage === 'function',
        run: async (char) => { await sendProactiveChatMessage(char); return '给你发了条消息'; }
    },
    {
        key: 'letter', label: '写一封信寄给用户', hint: '有些话不适合发消息说，适合写信',
        need: () => typeof generateProactiveLetter === 'function',
        run: async (char) => { await generateProactiveLetter(char); return '给你写了封信'; }
    },
    {
        key: 'diary', label: '写一篇自己的日记', hint: '不给任何人看的那种，只写给自己',
        need: () => typeof autonomyWriteDiary === 'function',
        run: async (char, param) => { const r = await autonomyWriteDiary(char, param || ''); return r || null; }
    },
    {
        key: 'forum', label: '在小说论坛发个帖', hint: '实名，跟兴趣/正事有关的长一点的帖子',
        need: () => typeof autoGenerateForumThreadForChar === 'function',
        run: async (char, param) => { const r = await autoGenerateForumThreadForChar(char, param || ''); return (r && r.success === false) ? null : '在论坛发了个帖'; }
    },
    {
        key: 'anon', label: '去匿名论坛发一条', hint: '实名说不出口的话，匿名说',
        need: () => typeof autoGenerateAnonPostForChar === 'function',
        run: async (char, param) => { const r = await autoGenerateAnonPostForChar(char, param || ''); return (r && r.success === false) ? null : '在匿名区发了一条'; }
    },
    {
        key: 'comment', label: '去评论别人的帖子', hint: '刷到了别人的推文，忍不住说两句',
        need: () => typeof autonomyCommentOnSomePost === 'function' && Array.isArray(globalPosts) && globalPosts.length > 0,
        run: async (char) => await autonomyCommentOnSomePost(char)
    },
    {
        key: 'like', label: '默默点个赞', hint: '看到了，但不想说话，只点个赞',
        need: () => Array.isArray(globalPosts) && globalPosts.length > 0,
        run: async (char) => await autonomyLikeSomePost(char)
    },
    {
        key: 'nudge', label: '拍一拍用户', hint: '没什么正事，就是想戳一下',
        need: () => true,
        run: async (char) => await autonomyNudgeUser(char)
    },
    {
        key: 'status', label: '换一下自己此刻的状态', hint: '手头的事换了、心情变了',
        need: () => typeof saveCharLifeState === 'function',
        run: async (char, param) => {
            const txt = String(param || '').trim();
            if (!txt) return null;
            saveCharLifeState(char, txt, null);
            if (typeof saveAllData === 'function') saveAllData();
            gyAutonomyRefreshViews(char, 'status');
            return '状态变成了「' + txt + '」';
        }
    },
    {
        key: 'todo_done', label: '把待办里的一条办掉', hint: '终于把那件事办了',
        need: (char) => (char.todos || []).some(t => t && !t.done),
        run: async (char, param) => await autonomyFinishTodo(char, param)
    },
    {
        key: 'todo_add', label: '往待办里记一件新的事', hint: '刚想起来 / 刚答应了别人 / 突然想做',
        need: () => true,
        run: async (char, param) => await autonomyAddTodo(char, param)
    },
    {
        key: 'theater', label: '去找关系网里的某个人', hint: '约人、堵人、偶遇，会记进「Ta们在做什么」',
        // 小剧场有自己的开关，那边关着就不该出现在选项里——不然模型选了它，
        // 结果被拦下来，白白浪费一次决策调用。
        need: () => typeof runTheaterScene === 'function'
            && (typeof isAutoOn !== 'function' || isAutoOn('charTheater'))
            && (typeof isGlobalCharInteractionEnabled !== 'function' || isGlobalCharInteractionEnabled())
            && Array.isArray(charRelationships) && charRelationships.length > 0,
        run: async (char) => {
            const r = await runTheaterScene(true, char);   // 是 TA 自己去找人，所以这一场里一定有 TA
            if (!r || r.blocked) return null;
            return '跟人碰了个面';
        }
    },
    {
        key: 'tabloid', label: '给营销号递个料', hint: '把某件事捅出去，让八卦号去写',
        need: () => typeof autonomyFeedTabloid === 'function' && Array.isArray(myCharacters) && myCharacters.length > 1,
        run: async (char, param) => await autonomyFeedTabloid(char, param)
    },
    {
        key: 'nothing', label: '什么都不做', hint: '就是没什么想做的，或者正忙着抽不开身',
        need: () => true,
        run: async () => null
    }
];

function gyAutonomyLog(char, entry) {
    if (!char) return;
    if (!Array.isArray(char.autonomyLog)) char.autonomyLog = [];
    char.autonomyLog.push(entry);
    // 以前只留最近 50 条——这是给你翻"TA 都自己干了啥"的记录，不再悄悄删；
    // 写进决策提示词的只取最近几条（runAutonomyTurn 里 slice(-6)），存多少都不影响 prompt 长短。
    gyAutonomyRefreshViews(char, 'autonomy');
}

// 🔄 后台改了数据之后，把正开着、跟这件事有关的那几页重画一下（不开着的不动）
function gyAutonomyRefreshViews(char, what) {
    try { if (typeof window.gyDataChanged === 'function') window.gyDataChanged(what || 'autonomy'); } catch (e) {}
    const shown = id => { const v = document.getElementById(id); return !!(v && v.style.display !== 'none' && (v.offsetParent !== null || v.getClientRects().length)); };
    // 自主日志那一页
    try { const box = document.getElementById('autonomyLogList'); if (box && (box.offsetParent !== null) && typeof renderAutonomyPage === 'function') renderAutonomyPage(); } catch (e) {}
    // 通知页（动作会加通知）
    try { if (shown('view-notifications') && typeof renderNotifications === 'function') renderNotifications(); } catch (e) {}
    if (!char) return;
    const w = String(what || '');
    // 日记页正开着这个角色（信 / 日记）
    try {
        if (/diary|letter|autonomy/.test(w) && shown('view-diary') && typeof currentDiaryCharId !== 'undefined' && String(currentDiaryCharId) === String(char.id)) {
            if (typeof currentDiaryTab !== 'undefined' && currentDiaryTab === 'mydiary') { if (typeof renderMyDiaryArea === 'function') renderMyDiaryArea(); }
            else if (typeof renderDiaryContent === 'function') renderDiaryContent();
        }
    } catch (e) {}
    // 角色主页正开着这个角色（状态 / 待办 / 推文）：只在「帖子」那一栏时重画，重画会把栏目切回帖子
    try {
        if (/status|todo|post|autonomy/.test(w) && shown('view-profile') && typeof currentProfileId !== 'undefined' && String(currentProfileId) === String(char.id)
            && (typeof currentProfileTab === 'undefined' || currentProfileTab === 'posts') && typeof renderProfilePage === 'function') renderProfilePage(char.id);
    } catch (e) {}
    // 待办清单
    try { if (/todo/.test(w) && typeof renderCharTodoList === 'function' && document.getElementById('charTodoList')) renderCharTodoList(); } catch (e) {}
}
window.gyAutonomyRefreshViews = gyAutonomyRefreshViews;

// 核心：让一个角色自己拿一次主意
// manual=true 是用户在界面上手动点的：跳过随机概率，**也不受开关限制**（同上，点了就跑）
async function runAutonomyTurn(char, manual) {
    if (!char) return { blocked: 'nochar' };
    if (!manual && typeof isAutoOn === 'function' && !isAutoOn('charAutonomy')) return { blocked: 'switch' };
    if (getCharActMode(char) !== 'auto') return { blocked: 'mode' };
    if (typeof isInQuietHours === 'function' && isInQuietHours() && !manual) return { blocked: 'quiet' };
    const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
    if (!api || !api.key) return { blocked: 'api' };
    if (runAutonomyTurn._busy) return { blocked: 'busy' };
    runAutonomyTurn._busy = true;

    try {
        // 只把此刻真的做得成的动作摆上桌：条件不满足的（比如没有待办可划、小剧场开关关着）
        // 直接不出现在选项里，省得模型选了个做不了的，白花一次调用。
        // 🎲 没有"没到间隔就不许做"这回事：做得成的事全摆上桌，TA 自己掂量。
        //    时间管理大师卡上的数（上次说过大概多久做一次、上次是什么时候）只是附在旁边给 TA 参考。
        const lifeEvs = (typeof window.gyTaEventsFor === 'function') ? window.gyTaEventsFor(char) : [];
        const avail = GY_AUTONOMY_ACTIONS.filter(a => { try { return a.need(char); } catch (e) { return false; } });
        if (avail.length === 0) return { blocked: 'noaction' };

        const openTodos = (char.todos || []).filter(t => t && !t.done).slice(0, 10);
        const recentActs = (char.autonomyLog || []).slice(-6).map(l => l.label).filter(Boolean);
        const nowStr = new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long' });
        const who = (typeof userDisplayName === 'function') ? userDisplayName(char) : '用户';
        const recentChat = (typeof getRecentChatContext === 'function') ? (getRecentChatContext(char.id) || '') : '';

        // 别人最近发了什么——"去评论别人的帖"得知道有什么可评的
        let othersFeed = '';
        if (Array.isArray(globalPosts)) {
            othersFeed = globalPosts.filter(p => p && p.char && String(p.char.id) !== String(char.id))
                .slice(0, 6)
                .map(p => `· ${p.char.name}：${String(p.text || '').replace(/<[^>]+>/g, '').slice(0, 50)}`)
                .join('\n');
        }

        // 📝 写信 / 写日记 / 发帖这类"自己的习惯"：以前夹在几十个选项里、以前提示里还压着 TA 少做事，
        //    模型几乎从来不选，看起来像没接上。这里单独列出来：上一次是什么时候、TA 自己说过多久做一次——
        //    只是摆事实给 TA 看，做不做还是 TA 自己定。
        const HABIT_KEYS = [['letter', '给' + ((typeof userDisplayName === 'function') ? userDisplayName(char) : '对方') + '写信'], ['diary', '写日记'], ['post', '发推文'], ['moment_self', '发朋友圈'], ['forum', '论坛发帖'], ['anon', '匿名区发帖']];
        const habitLines = HABIT_KEYS.filter(([k]) => avail.some(a => a.key === k)).map(([k, n]) => {
            const last = typeof window.gyTaLastAct === 'function' ? window.gyTaLastAct(char, k) : 0;
            const h = typeof window.gyTaHabitOf === 'function' ? window.gyTaHabitOf(char, k) : null;
            const lastTxt = last ? '上一次是' + (window.gyTaAgo ? window.gyTaAgo(last) : new Date(last).toLocaleDateString()) : '还从来没做过';
            let due = '';
            if (h && !h.never && h.ms && Date.now() - (last || h.at || Date.now()) >= h.ms) due = `（你说过大概隔${window.gyTaFmtMs ? window.gyTaFmtMs(h.ms) : Math.round(h.ms / 3600000) + '小时'}一次——按你自己的习惯，差不多到了）`;
            else if (h && !h.never && h.ms) due = `（你说过大概隔${window.gyTaFmtMs ? window.gyTaFmtMs(h.ms) : Math.round(h.ms / 3600000) + '小时'}一次）`;
            return `· ${n}：${lastTxt}${due}`;
        });
        const menu = avail.map(a => `- ${a.key}：${a.label}（${a.hint}${(typeof window.gyTaActNote === 'function') ? window.gyTaActNote(char, a.key) : ''}）`).join('\n');
        const later = (char.autoQueue || []).filter(q => q && q.at > Date.now());

        const ask = `现在的真实时间：${nowStr}。

停一下，想想你自己：这个点，你手头在忙什么，心里搁着什么事，有没有什么想说、想做、想找谁。

【你能做的事】
${menu}

${lifeEvs.length ? `【上次之后，你身上发生了这些事】\n${lifeEvs.slice(-6).map(e => '· ' + e.t).join('\n')}\n\n` : ''}${later.length ? `【你之前打算待会儿做的】\n${later.map(q => '· ' + q.label + '（' + Math.max(1, Math.round((q.at - Date.now()) / 60000)) + ' 分钟后）' + (q.reason ? '：' + q.reason : '')).join('\n')}\n（还想做就不用再写一遍；改主意了也可以不管它）\n\n` : ''}【你还没办完的事】
${openTodos.length ? openTodos.map(t => `· ${t.text}${t.date ? `（${t.date}）` : ''}`).join('\n') : '（清单是空的）'}

【你和${who}最近聊到哪儿了】
${recentChat ? recentChat.slice(-800) : '（最近没怎么说话）'}

【首页上别人刚发的】
${othersFeed || '（没什么新东西）'}

${recentActs.length ? `【你最近做过这些】\n${recentActs.map(a => '· ' + a).join('\n')}\n` : ''}${habitLines.length ? `【你自己的这些习惯】\n${habitLines.join('\n')}\n（写日记、写信、发帖这些本来就是你生活的一部分：心里有事、有话想说、今天有什么值得记下来，就去做，不用等特别大的理由；不想写就不写）\n` : ''}
像个真人一样决定：
1. 做不做、做什么、做几件、什么时候做，全由你自己定，没有规定。
   · 可以什么都不做。
   · 可以只做一件。
   · 也可以好几件：一件事常常会勾出另一件，做哪几件、先后顺序、怎么搭配，都看你此刻的心情和遇到的事，别套固定的组合。
2. 每件事什么时候做也由你定：想到就立刻做（after 填 0），或者先放着，等有空了再做（after 填过多少分钟，多久都行）。
3. 按你的性格和此刻的处境来。理由要具体到"因为刚才/因为待办上那件/因为日程里这一段"，不要写空话。

另外：
· nextIn：这些都做完（或者什么都不做）之后，你大概过多久会再停下来想想要不要做点什么？分钟数，多久都行，按你的性子和今天的安排来，别凑整数。
· 每件事的 nextSame：这件事做完之后，下次再做同一件事大概隔多久（分钟，多久都行；几乎不会再做就填 0）；sameWhy 一句你自己的说法（12 字以内）。

请严格只返回 JSON，不要用 \`\`\` 包裹，不要写别的。什么都不做就让 plan 是空数组：
{"plan":[{"action":"上表里的 key","after":0,"reason":"一句话，为什么要做（20字内）","param":"看情况填：换状态就填新状态；办掉待办就填那条待办的原文；记新待办就填要记的事；写日记/论坛发帖/匿名发帖/递料可以填个话题或方向；其余留空","nextSame":分钟数,"sameWhy":""}],"nextIn":分钟数}`;

        const messages = buildStructuredMessages(buildBasePrompt(char, true, recentChat), [], ask);
        const data = await callChatCompletionAPI(api, messages);
        let raw = (data.choices?.[0]?.message?.content || '').trim();
        raw = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
        let decision = (typeof parseModelJson === 'function') ? parseModelJson(raw) : null;
        if (Array.isArray(decision)) decision = { plan: decision };
        if (!decision || (!Array.isArray(decision.plan) && !decision.action)) return { blocked: 'parse', raw: raw.slice(0, 120) };
        // 老格式（一次只挑一件）也认
        const plan0 = Array.isArray(decision.plan) ? decision.plan : [decision];
        const plan = plan0.filter(x => x && x.action && String(x.action).trim() !== 'nothing')
            .map(x => ({ x, act: avail.find(a => a.key === String(x.action).trim()) }))
            .filter(y => y.act).slice(0, 6);
        if (plan0.some(x => x && x.action && String(x.action).trim() !== 'nothing') && !plan.length)
            return { blocked: 'unknown', raw: String((plan0[0] || {}).action || '').slice(0, 40) };

        // 🎲 下一次什么时候再停下来想：TA 说多久就多久，不设上下限；没说/说得不是个数才用随机兜底
        char.evSeenAt = Date.now();   // 这些事 TA 已经掂量过了，下次只看新发生的
        const gap = gyAutonomyGapFromTA(char, decision.nextIn);
        char.nextAutonomyAt = Date.now() + gap;

        if (!plan.length) {
            const entry = { at: Date.now(), charId: char.id, charName: char.name, action: 'nothing', label: '什么都不做',
                reason: String(decision.reason || (plan0[0] && plan0[0].reason) || ''), result: '什么都没做', ok: true, nextIn: Math.round(gap / 60000) };
            gyAutonomyLog(char, entry);
            if (typeof saveAllData === 'function') saveAllData();
            gyAutonomyRefreshViews(char, 'today');   // 「下次停下来想想」变了
            return { ok: true, entry };
        }

        // 立刻做的按顺序做掉；说了"等会儿"的排进 TA 自己的待办队列，到点了再做（js/14 的定时器）
        const done = [];
        if (!Array.isArray(char.autoQueue)) char.autoQueue = [];
        for (const { x, act } of plan) {
            const after = parseFloat(x.after);
            if (isFinite(after) && after >= 1) {
                char.autoQueue.push({ id: 'aq_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), key: act.key, label: act.label,
                    param: x.param || '', reason: String(x.reason || ''), at: Date.now() + after * 60000, planned: Date.now(),
                    nextSame: x.nextSame, sameWhy: x.sameWhy || '' });
                continue;
            }
            done.push(await gyAutonomyRunItem(char, act, x));
        }
        if (typeof saveAllData === 'function') saveAllData();
        const entry = done[0] || { at: Date.now(), charId: char.id, charName: char.name, action: 'later', label: '打算待会儿做',
            reason: plan.map(p => p.act.label).join('、'), result: '先放着，等会儿再做', ok: true };
        if (!done.length) gyAutonomyLog(char, entry);
        entry.nextIn = Math.round(gap / 60000);
        gyAutonomyRefreshViews(char, 'today');   // 下次时间 / 打算等会儿做的队列变了
        return { ok: done.length ? done.every(e => e.ok) : true, entry, entries: done, queued: plan.length - done.length };
    } finally {
        runAutonomyTurn._busy = false;
    }
}

// 真去做一件事（立刻做的、或者队列里到点了的），记进自主日志，顺便记下"这件事下次大概隔多久"
async function gyAutonomyRunItem(char, act, x, fromQueue) {
    const entry = { at: Date.now(), charId: char.id, charName: char.name, action: act.key, label: act.label,
        reason: String((x && x.reason) || ''), result: '', ok: false, queued: !!fromQueue };
    // 方向：自主模式里做的事都是 TA 自己想做的（聊天里对方让做的走 js/52，那边会标成"对方让你做的"）
    const by0 = window.__gyActBy;
    window.__gyActBy = { by: 'self', charId: String(char.id) };
    try {
        let res = await act.run(char, x && x.param);
        // 动作可以回一个对象：{ text, jump（点通知跳去哪）, selfNotified（自己已经弹过通知了） }
        if (res && typeof res === 'object') { entry.jump = res.jump || null; entry.selfNotified = !!res.selfNotified; entry.anonymous = !!res.anonymous; entry.secret = !!res.secret; res = res.text || act.label; }
        entry.result = res || act.label;
        entry.ok = !!res || res === undefined;
    } catch (e) {
        console.error(`自主行动「${act.label}」执行失败：`, e);
        entry.result = '想做但没做成（' + (e.message || e) + '）';
        entry.ok = false;
    } finally { window.__gyActBy = by0; }
    gyAutonomyLog(char, entry);
    char.lastAutonomyTime = Date.now();
    // 🔔 每件事都弹通知，点一下跳过去（js/60）
    try { if (entry.ok && typeof window.gyActNotify === 'function') window.gyActNotify(char, act, entry); } catch (e) {}
    if (entry.ok && typeof window.gyTaActDone === 'function' && x && x.nextSame != null && x.nextSame !== '')
        window.gyTaActDone(char, act.key, x.nextSame, x.sameWhy);
    gyAutonomyRefreshViews(char, act.key);   // 时间卡的"上一次"、队列、开着的日记页/主页/通知页
    return entry;
}
// 队列里到点了的事：一次做一件（花钱的动作一件一件来）
async function gyAutonomyRunQueue(char) {
    if (!char || !Array.isArray(char.autoQueue) || !char.autoQueue.length) return null;
    const now = Date.now();
    char.autoQueue.sort((a, b) => a.at - b.at);
    const q = char.autoQueue[0];
    if (!q || q.at > now) return null;
    char.autoQueue.shift();
    const act = GY_AUTONOMY_ACTIONS.find(a => a.key === q.key);
    let ok = false; try { ok = !!act && act.need(char); } catch (e) {}
    if (!ok) { if (typeof saveAllData === 'function') saveAllData(); gyAutonomyRefreshViews(char, 'today'); return null; }   // 条件没了（开关关了之类）：这件就算了
    const e = await gyAutonomyRunItem(char, act, q, true);
    if (typeof saveAllData === 'function') saveAllData();
    return e;
}
window.gyAutoQueueOf = c => (c && Array.isArray(c.autoQueue) ? c.autoQueue.slice().sort((a, b) => a.at - b.at) : []);
// TA 说的"多久之后再想"：多久都行，只要是个数；不是数才用随机兜底
function gyAutonomyGapFromTA(char, minutes) {
    const n = parseFloat(minutes);
    if (!isFinite(n) || n < 0) return gyRollAutonomyGap(char);
    return Math.round(n * 60000);
}

// 🎲 掷一个"下次什么时候再想起来做点什么"的间隔（毫秒）。
// 这是兜底用的随机值——正常情况下这个间隔是 TA 自己在决策时说的（见 runAutonomyTurn 的 nextIn），
// 只有在 TA 没说、说得不合理、或者这次请求直接失败的时候才用它。
// 分布故意做成"偏短但偶尔很长"：真人也不是均匀地每隔固定时间做一件事，
// 大多数时候隔不久，偶尔一忙就是大半天没动静。
function gyAutonomyBounds(char) {
    // 🎲 以前这里是"最快/最慢多久一次"的上下限（角色编辑页那两个框）。现在不设限：什么时候做全由 TA 说了算。
    //    这两个数只剩一个用处——TA 没说/说的不是个数的时候，随机兜底掷在这个范围里（偏短，偶尔很长）。
    return { minM: 20, maxM: 8 * 60 };
}
function gyRollAutonomyGap(char) {
    const { minM, maxM } = gyAutonomyBounds(char);
    // 三次方偏置：r^3 让结果大部分落在靠近下限的一侧，偶尔才蹦到上限附近
    const r = Math.pow(Math.random(), 3);
    return Math.round((minM + (maxM - minM) * r) * 60000);
}
// 把 TA 自己说的"多少分钟之后"夹到范围内。说得离谱（负数、几秒、好几天）就当没说，回落到随机。
function gyClampAutonomyGap(char, minutes) {
    const n = parseFloat(minutes);
    if (!isFinite(n) || n <= 0) return gyRollAutonomyGap(char);
    const { minM, maxM } = gyAutonomyBounds(char);
    return Math.round(Math.min(maxM, Math.max(minM, n)) * 60000);
}

function getCharActMode(char) {
    // 老存档里没有这个字段，一律当"按固定频率"——不能让升级一下所有角色突然都自作主张了
    return (char && char.actMode === 'auto') ? 'auto' : 'fixed';
}

// ---------- 各个动作的具体做法（能复用现成函数的就复用，不能的在这写一个不碰界面的版本） ----------

// 📔 写一篇自己的日记：generateDiaryContent 那个是绑在日记页界面上的（要读当前选中角色、要改按钮文字），
// 后台跑不能用它，所以这里单独写一份只动数据的。
// topic：想写的方向（可不给）。by：'self' 是 TA 自己想写的；'user' 是对方在聊天里让 TA 写的（js/52）。
// 不传 by 就看此刻是谁在让 TA 做事（js/52 / 自主模式执行时会标 window.__gyActBy）。
async function autonomyWriteDiary(char, topic, by) {
    if (!char) return null;
    const api = getApiConfig(true);
    if (!api || !api.key) return null;
    if (!by) { const d = window.__gyActBy; by = (d && String(d.charId) === String(char.id) && d.by) || 'self'; }
    const who0 = (typeof userDisplayName === 'function') ? userDisplayName(char) : '对方';
    const tp = String(topic || '').trim();
    const why = by === 'user'
        ? `这篇是${who0}在聊天里让你写的——你答应了，现在真的去写。写不写给${who0}看、写多真，按你的性子来。`
        : '这是你自己想写的，没人让你写。';
    if (!char.diaryData) char.diaryData = { letters: [], diaries: [] };
    if (!Array.isArray(char.diaryData.diaries)) char.diaryData.diaries = [];
    const recentChat = (typeof getRecentChatContext === 'function') ? (getRecentChatContext(char.id) || '') : '';
    const limit = (typeof diaryWordLimit !== 'undefined') ? diaryWordLimit : 300;
    const ask = `现在是 ${new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long' })}。
你现在想写点东西给自己看——一篇不打算给任何人看的日记。写今天真实发生的、心里过不去的、或者忽然想明白的那一点事。
${why}${tp ? `\n这次想写的方向：${tp}（照这个方向写，但用你自己的语气和视角，不要照抄这句话）` : ''}
字数 ${limit} 字左右。${typeof WORD_LIMIT_PRIORITY_NOTE !== 'undefined' ? WORD_LIMIT_PRIORITY_NOTE : ''}
不要写成给人看的文章，日记就该有点没头没尾。
${typeof getFinalAnswerMarkerPromptNote === 'function' ? getFinalAnswerMarkerPromptNote() : ''}
严格只返回 JSON，不要用 \`\`\` 包裹：{"title":"标题","content":"正文，换行用\\n"}`;
    const messages = buildStructuredMessages(buildBasePrompt(char, true, recentChat), [], ask);
    const data = await callChatCompletionAPI(api, messages);
    let raw = (data.choices?.[0]?.message?.content || '').trim();
    raw = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    let parsed = (typeof parseModelJson === 'function') ? parseModelJson(raw) : null;
    // 实在解析不出来就当成"整段都是正文"——写了一篇日记总比丢掉强
    if (!parsed || !parsed.content) parsed = { title: '没有标题', content: (typeof stripReasoningBlocks === 'function' ? stripReasoningBlocks(raw) : raw) };
    const content = (typeof applyRegexScripts === 'function')
        ? applyRegexScripts(parsed.content || raw, 'ai_output', char.id) : (parsed.content || raw);
    if (!content) return null;
    char.diaryData.diaries.unshift({
        id: 'd_' + Date.now(), title: parsed.title || '没有标题',
        content, date: Date.now(), author: 'char'
    });
    if (typeof saveAllData === 'function') saveAllData();
    gyAutonomyRefreshViews(char, 'diary');   // 日记页正开着这个人就马上看到这篇；时间卡的"上一次"也跟着变
    return '写了篇日记：' + (parsed.title || '无题');
}

// 💬 去评论别人的推文：挑一条最近的、不是自己发的、自己还没评论过的
async function autonomyCommentOnSomePost(char) {
    const api = getApiConfig(true);
    if (!api.key) return null;
    const cands = (globalPosts || []).filter(p => {
        if (!p || !p.char) return false;
        if (String(p.char.id) === String(char.id)) return false;
        if (Date.now() - (p.timestamp || 0) > 3 * 86400000) return false;   // 太老的帖子不去挖坟
        return !(p.replies || []).some(r => r && r.char && String(r.char.id) === String(char.id));
    }).slice(0, 8);
    if (cands.length === 0) return null;
    const post = cands[Math.floor(Math.random() * cands.length)];
    const plain = String(post.text || '').replace(/<[^>]+>/g, '').slice(0, 300);
    const limit = (typeof commentWordLimit !== 'undefined') ? commentWordLimit : 50;
    const ask = `你刷到了 ${post.char.name} 发的这条：\n「${plain}」\n\n你想在下面说一句。按你跟 ${post.char.name} 的关系和你的性格来说话，${limit} 字以内，就一句，不要加引号、不要解释、不要写"评论："这种前缀。实在不想说就只输出 NO。`;
    const messages = buildStructuredMessages(buildBasePrompt(char, false, plain), [], ask);
    const data = await callChatCompletionAPI(api, messages);
    let text = (data.choices?.[0]?.message?.content || '').trim();
    if (!text || (text.toUpperCase().startsWith('NO') && text.length < 5)) return null;
    if (typeof applyRegexScripts === 'function') text = applyRegexScripts(text, 'ai_output', char.id);
    // 只输出了个"点赞"的，就当真的只是点了个赞，别把"LIKE"两个字发出去
    if (typeof looksLikeALikeOnly === 'function' && looksLikeALikeOnly(text)) {
        post.stats = post.stats || { likes: 0, comments: 0 };
        post.stats.likes = (parseInt(post.stats.likes) || 0) + 1;
        if (!Array.isArray(post.likedBy)) post.likedBy = [];
        if (!post.likedBy.includes(char.id)) post.likedBy.push(char.id);
        if (typeof saveAllData === 'function') saveAllData();
        if (typeof renderPosts === 'function' && document.getElementById('view-home')?.style.display !== 'none') renderPosts();
        return '给 ' + post.char.name + ' 的帖子点了个赞';
    }
    if (!Array.isArray(post.replies)) post.replies = [];
    post.replies.push({
        id: 'r_' + Date.now() + Math.floor(Math.random() * 100),
        parentId: null, char, text, timestamp: Date.now(),
        likes: 0, liked: false, likedBy: []
    });
    post.stats = post.stats || { likes: 0, comments: 0 };
    post.stats.comments = (parseInt(post.stats.comments) || 0) + 1;
    // 评论到用户自己的帖子上时，得发通知，不然用户根本不知道
    if (String(post.char.id) === 'me' && typeof addNotification === 'function') {
        addNotification(`<b>${char.name}</b> 评论了您的帖子`, post.id, null, char, text);
    }
    if (typeof saveAllData === 'function') saveAllData();
    if (typeof renderPosts === 'function' && document.getElementById('view-home')?.style.display !== 'none') renderPosts();
    return '评论了 ' + post.char.name + ' 的帖子';
}

// ❤️ 只点个赞：不花 API，纯本地动作（决策那一次已经花过了）
async function autonomyLikeSomePost(char) {
    const cands = (globalPosts || []).filter(p => p && p.char
        && String(p.char.id) !== String(char.id)
        && !(Array.isArray(p.likedBy) && p.likedBy.includes(char.id))).slice(0, 10);
    if (cands.length === 0) return null;
    const post = cands[Math.floor(Math.random() * cands.length)];
    post.stats = post.stats || { likes: 0, comments: 0 };
    post.stats.likes = (parseInt(post.stats.likes) || 0) + 1;
    if (!Array.isArray(post.likedBy)) post.likedBy = [];
    post.likedBy.push(char.id);
    if (String(post.char.id) === 'me' && typeof addNotification === 'function') {
        addNotification(`<b>${char.name}</b> 赞了您的帖子 ❤️`, post.id, null, char, '');
    }
    if (typeof saveAllData === 'function') saveAllData();
    if (typeof renderPosts === 'function' && document.getElementById('view-home')?.style.display !== 'none') renderPosts();
    return '赞了 ' + post.char.name + ' 的帖子';
}

// 👋 角色拍用户：triggerNudge 是"用户拍角色"那个方向的，这里是反过来，
// 所以不能复用——直接往聊天里塞一条系统消息就行，不花 API。
async function autonomyNudgeUser(char) {
    const sessionId = String(char.id);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    const target = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : { name: '你', nudgeText: '' };
    const text = `"${char.name}" 拍了拍 "${(typeof userDisplayName === 'function') ? userDisplayName(char) : target.name}" ${target.nudgeText || '的脑袋'}`;
    globalChats[sessionId].push({ sender: 'system', text, timestamp: Date.now() });
    if (typeof addNotification === 'function') addNotification(`<b>${char.name}</b> 拍了拍你 👋`, null, char.id, char, '');
    if (typeof saveAllData === 'function') saveAllData();
    if (typeof currentChatSessionId !== 'undefined' && currentChatSessionId === sessionId
        && document.getElementById('view-chat')?.style.display !== 'none'
        && typeof renderChatMessages === 'function') renderChatMessages();
    else if (typeof renderChatCharList === 'function') renderChatCharList();
    gyAutonomyRefreshViews(char, 'nudge');
    return '拍了拍你';
}

// ✅ 办掉一条待办：param 是待办原文，模糊匹配（模型很少一字不差地抄回来）
async function autonomyFinishTodo(char, param) {
    const list = (char.todos || []).filter(t => t && !t.done);
    if (list.length === 0) return null;
    const key = String(param || '').trim();
    let hit = null;
    if (key) {
        hit = list.find(t => t.text === key)
           || list.find(t => t.text.includes(key) || key.includes(t.text));
    }
    if (!hit) hit = list[0];
    hit.done = true;
    hit.doneAt = Date.now();
    if (typeof saveAllData === 'function') saveAllData();
    gyAutonomyRefreshViews(char, 'todo');
    return '把「' + hit.text + '」办掉了';
}

// 📝 记一条新待办
async function autonomyAddTodo(char, param) {
    const text = String(param || '').trim();
    if (!text) return null;
    if (!Array.isArray(char.todos)) char.todos = [];
    if (char.todos.some(t => t && t.text === text)) return null;   // 已经记过了就别重复
    char.todos.push({
        id: 'todo_' + Date.now() + Math.floor(Math.random() * 1000),
        text, date: null, done: false, createdAt: Date.now(), doneAt: null, source: 'ai'
    });
    if (typeof saveAllData === 'function') saveAllData();
    gyAutonomyRefreshViews(char, 'todo');
    return '记下了「' + text + '」';
}

// 📰 给营销号递料：生成一条爆料贴进 tabloidPosts，跟手动那个「AI 智能爆料」进的是同一个池子
async function autonomyFeedTabloid(char, param) {
    const api = getApiConfig(true);
    if (!api.key) return null;
    if (typeof tabloidPosts === 'undefined' || !Array.isArray(tabloidPosts)) return null;
    // 挑一个跟 TA 有关系的人当爆料对象，没关系网就随便挑一个别人
    let others = [];
    if (Array.isArray(charRelationships)) {
        charRelationships.forEach(r => {
            if (String(r.fromId) === String(char.id)) others.push(r.toId);
            else if (String(r.toId) === String(char.id)) others.push(r.fromId);
        });
    }
    let target = myCharacters.find(c => others.some(id => String(id) === String(c.id)));
    if (!target) target = myCharacters.find(c => String(c.id) !== String(char.id));
    if (!target) return null;
    const topic = String(param || '').trim();
    const d0 = window.__gyActBy;
    const byUser = !!(d0 && d0.by === 'user' && String(d0.charId) === String(char.id));
    const messages = buildStructuredMessages('你是一个唯恐天下不乱的娱乐营销号。', [],
        `有人给你递了一条料，关于 ${target.name}（人设：${String(target.persona || '').slice(0, 300)}）。递料的人是 ${char.name}。
${topic ? `料的内容大概是：${topic}。` : ''}${byUser ? `（${char.name}是被人撺掇来递这条料的。）` : ''}
请写成一条震惊体的爆料推文，150 字左右，直接输出正文，不要加前缀说明、不要用引号包裹。`);
    const data = await callChatCompletionAPI(api, messages);
    const text = (data.choices?.[0]?.message?.content || '').trim();
    if (!text) return null;
    const post = {
        id: 'tb_' + Date.now(),
        char: { ...(typeof tabloidAccount !== 'undefined' ? tabloidAccount : { name: '吃瓜前线' }) },
        text, timestamp: Date.now(), replies: [],
        stats: { likes: Math.floor(Math.random() * 8000) + 500, comments: 0 }
    };
    tabloidPosts.unshift(post);
    if (typeof saveAllData === 'function') saveAllData();
    if (typeof renderTabloidPosts === 'function') renderTabloidPosts();
    gyAutonomyRefreshViews(char, 'tabloid');
    if (typeof showToast === 'function') {
        showToast(`<div class="avatar" style="background:#1d9bf0;color:white;font-size:20px;">📰</div>`,
            '新的八卦爆料！', text, post.id, null);
    }
    return '给营销号递了一条关于 ' + target.name + ' 的料';
}

// ---------- 定时器 ----------
// 每 3 分钟看一眼有没有到点的角色。真正花不花钱由三件事共同决定：
// 开关开着 + 这个角色切到了自主模式 + 距离上次拿主意超过了 TA 自己的间隔。
function startAutonomyTimer() {
    setInterval(async () => {
        try {
            if (typeof isAutoOn === 'function' && !isAutoOn('charAutonomy')) return;
            if (typeof isGenerating !== 'undefined' && isGenerating) return;
            if (typeof isInQuietHours === 'function' && isInQuietHours()) return;
            const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
            if (!api || !api.key) return;

            // 先把 TA 们之前说"等会儿再做"的、已经到点的事做掉（每人一次一件）
            for (const qc of (myCharacters || [])) {
                if (getCharActMode(qc) !== 'auto') continue;
                try { await gyAutonomyRunQueue(qc); } catch (e) { console.warn('自主队列出错：', e); }
            }
            const now = Date.now();
            let rolled = false;
            const due = (myCharacters || []).filter(c => {
                if (getCharActMode(c) !== 'auto') return false;
                // 没有下次时间的（刚切到自主模式、或者老存档）：现在给 TA 掷一个，这一轮先不动。
                // 不立刻就动是故意的——刚勾上开关就"叮"地跳出来一条，太像机器人了。
                if (!c.nextAutonomyAt) { c.nextAutonomyAt = now + gyRollAutonomyGap(c); rolled = true; return false; }
                return now >= c.nextAutonomyAt;
            });
            if (rolled) gyAutonomyRefreshViews(null, 'today');   // 刚排上「下次停下来想想」
            if (due.length === 0) return;

            // 一轮最多让一个角色行动：这功能一次可能连着两次调用，一次放行好几个角色太凶了
            const char = due[Math.floor(Math.random() * due.length)];
            // 先把下次时间掷出来占上位：万一这次请求失败/超时，也不会下一轮立刻又来一发。
            // 真跑完之后 runAutonomyTurn 里会用 TA 自己说的时间覆盖掉这个随机值。
            char.nextAutonomyAt = now + gyRollAutonomyGap(char);
            char.lastAutonomyTime = now;
            await runAutonomyTurn(char, false);
            gyAutonomyRefreshViews(char, 'today');   // 没跑成（接口出错之类）也要把新排的时间画上
            // 顺手看看 TA 的待办是不是快见底了（走 autoTodoGen 开关，一天最多一次）
            if (typeof autoTopUpCharTodos === 'function') await autoTopUpCharTodos(char);
        } catch (e) { console.error('自主行动定时器出错：', e); }
    }, 3 * 60000);
}
