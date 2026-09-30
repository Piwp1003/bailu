/* ===========================================================================
   js/30 —— 📦 包裹卡片：下单 / 到货 / 收货，全在私聊里
   ---------------------------------------------------------------------------
   以前商城这条线是"闷着头跑"的：你下个单，聊天里什么都没有；包裹到了，弹一个
   toast，八秒之后就没了；东西送给角色，系统直接替 TA 收下——TA 本人一句话都没说。
   于是"我送了你一样东西"这件挺重要的事，聊天记录里翻不到，角色回头也不记得。

   v108 起做成**私聊里的一张包裹卡**：

     下单  → 一张卡（运单号 / 商品 / 谁买给谁 / 进度条）
     物流  → 系统提示一句（"仓库已发出"这种，一句话，不是卡片）
     到货  → 同一张卡翻到"到货"这一面
     收货  → 翻到"已收"，东西这时才真的进随身物

   ⚠️ 送礼跟自己买不一样：**到货 ≠ 收下**。
      角色送你 / 你送角色 / 角色互送，都要收件人**真的收了**才算收货。
      · 送给你的：卡上两个按钮，你自己点「收下」还是「先不收」
      · 送给角色的：TA 按人设决定收不收，答案和那句话写在同一张卡上
      不收也留在卡上，是一条真发生过的事，不会消失。

   卡片是自己画的（.gypk-*）：快递面单的样子——左边一条码带、上面一行运单号、
   中间四格进度轨。**跟邀请卡（.gyiv-*，两个头像＋中间一条线）刻意不一样**，
   在聊天里一眼能分出这是包裹不是邀请。

   到货之后角色说的那句话**收进卡里**，卡默认是收起来的，点一下展开看全文——
   不然一个包裹在聊天里要占三四条消息。

   同一批卡片在三个地方都看得到：私聊 / 商城的「包裹」页 / 记忆总览。

   💰 花钱的地方只有一处：送给角色时问 TA 收不收（一次调用，开关 parcelAccept）。
      下单、物流、到货、你自己收货，一次都不调。
   =========================================================================== */
(function () {
    if (window.__gyParcelLoaded) return;
    window.__gyParcelLoaded = true;

    const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(s == null ? '' : s)
        : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const meName = () => (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : '我';
    const nameOf = id => String(id) === 'me' ? meName() : ((charOf(id) || {}).name || '某人');
    const on = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : true;
    const uid = () => 'pk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    // 运单号：看着像真的，其实就是时间戳换个进制——同一个包裹永远是同一串
    const waybill = p => 'GY' + String(p.id || '').replace(/\D/g, '').slice(-9).padStart(9, '0');

    /* ================= 存 / 找 =================
       卡片本身就存在聊天记录里（跟邀请卡一样），不另开一份存档——
       两份数据迟早会对不上，而且聊天记录本来就要存。 */
    function chatOf(charId) {
        if (typeof globalChats === 'undefined') return null;
        const sid = String(charId);
        if (!globalChats[sid]) globalChats[sid] = [];
        return globalChats[sid];
    }
    function pushCard(charId, sender, pk) {
        const arr = chatOf(charId);
        if (!arr) return null;
        // text 是给模型和消息列表预览看的纯文字版，卡片本身不进 prompt
        const msg = {
            sender, type: 'parcel', parcel: pk, timestamp: Date.now(), readBy: [],
            text: `［包裹］${pk.emoji || '📦'}${pk.name}　${nameOf(pk.from)} → ${nameOf(pk.to)}`
        };
        arr.push(msg);
        return msg;
    }
    function findCard(id) {
        if (typeof globalChats === 'undefined') return null;
        for (const sid in globalChats) {
            const arr = globalChats[sid] || [];
            for (let i = arr.length - 1; i >= 0; i--) {
                const m = arr[i];
                if (m && m.type === 'parcel' && m.parcel && m.parcel.id === id) return { sid, idx: i, msg: m, pk: m.parcel };
            }
        }
        return null;
    }
    // 全部包裹（新的在前）。给「商城 → 包裹」页和记忆总览用。
    function allCards(charId) {
        const out = [];
        if (typeof globalChats === 'undefined') return out;
        for (const sid in globalChats) {
            if (charId && String(sid) !== String(charId)) continue;
            (globalChats[sid] || []).forEach(m => {
                if (m && m.type === 'parcel' && m.parcel) out.push(Object.assign({ __sid: sid }, m.parcel));
            });
        }
        return out.sort((a, b) => (b.at || 0) - (a.at || 0));
    }
    function refresh(charId) {
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        try {
            const open = typeof currentChatSessionId !== 'undefined'
                && String(currentChatSessionId) === String(charId)
                && document.getElementById('view-chat')
                && document.getElementById('view-chat').style.display !== 'none';
            if (open && typeof renderChatMessages === 'function') renderChatMessages();
            else if (typeof renderChatCharList === 'function') renderChatCharList();
        } catch (e) {}
        try { renderParcelTab(); renderMemHub(); } catch (e) {}
    }
    // 系统提示一句（物流用的，不是卡片）
    function sysLine(charId, text) {
        const arr = chatOf(charId);
        if (!arr) return;
        arr.push({ sender: 'system', text: esc(text), timestamp: Date.now(), readBy: [] });
    }

    /* ================= 卡片长什么样 ================= */
    const STAGES = ['已下单', '运输中', '到货', '已收货'];
    function stageIdx(pk) {
        if (pk.status === 'received') return 3;
        if (pk.status === 'declined') return 2;
        if (pk.status === 'arrived') return 2;
        return pk.shipped ? 1 : 0;
    }
    // 卡上那句话（角色的反应 / 收不收的理由）有没有内容，决定要不要给展开箭头
    const hasBody = pk => !!(pk.line || pk.desc || pk.note || pk.reason);
    // 到货之后的反应有好几种形态，不是只有"说了一句"
    const REACT_KIND = { say: '说了句', act: '做了个动作', keep: '收起来了', use: '当场用了', mixed: 'TA 的反应' };

    window.gyParcelCardHtml = function (msg) {
        const pk = msg.parcel || {};
        const si = stageIdx(pk);
        const gift = pk.gift && String(pk.from) !== String(pk.to);
        const toMe = String(pk.to) === 'me';
        const openCls = pk.__open ? ' open' : '';
        const st = pk.status;

        const rail = STAGES.map((s, i) => {
            const done = i <= si;
            const dead = (st === 'declined' && i === 3);
            return `<div class="gypk-st${done ? ' on' : ''}${dead ? ' dead' : ''}">
                <i></i><span>${i === 3 && st === 'declined' ? '没收' : s}</span></div>`;
        }).join('');

        // 底下那一条：等谁、谁能点、点什么
        let foot = '';
        if (st === 'arrived' && gift) {
            foot = toMe
                ? `<div class="gypk-acts">
                       <button type="button" class="gypk-btn take" onclick="gyParcelTake('${pk.id}',true)">收下</button>
                       <button type="button" class="gypk-btn drop" onclick="gyParcelTake('${pk.id}',false)">先不收</button>
                   </div>`
                : `<div class="gypk-wait"><span class="gypk-dots"><i></i><i></i><i></i></span>东西到了 ${esc(nameOf(pk.to))} 那儿，等 TA 收…</div>`;
        } else if (st === 'arrived') {
            foot = `<div class="gypk-acts"><button type="button" class="gypk-btn take" onclick="gyParcelTake('${pk.id}',true)">签收</button></div>`;
        } else if (st === 'received') {
            foot = `<div class="gypk-done">✅ ${esc(nameOf(pk.to))}已收货${pk.kitAdded ? '　·　已进随身物' : ''}</div>`;
        } else if (st === 'declined') {
            foot = `<div class="gypk-done no">✕ ${esc(nameOf(pk.to))}没有收下</div>`;
        }

        const body = hasBody(pk) ? `
            <div class="gypk-body">
                ${pk.desc ? `<div class="gypk-desc">${esc(pk.desc)}</div>` : ''}
                ${pk.reason ? `<div class="gypk-note">下单时的说法：${esc(pk.reason)}</div>` : ''}
                ${pk.line ? `<div class="gypk-said${st === 'declined' ? ' no' : ''}">${esc(pk.line)}</div>` : ''}
                ${pk.note ? `<div class="gypk-note"><span class="gypk-kd">${esc(REACT_KIND[pk.noteKind] || '反应')}</span>${esc(pk.note)}</div>` : ''}
                ${foot}
            </div>` : (foot ? `<div class="gypk-body">${foot}</div>` : '');

        return `
        <div class="gypk-row">
          <div class="gypk-card${openCls} s-${esc(st)}" data-id="${esc(pk.id)}">
            <div class="gypk-bar"></div>
            <div class="gypk-head" ${hasBody(pk) || foot ? `onclick="gyParcelToggle('${pk.id}')"` : ''}>
              <div class="gypk-way">${esc(waybill(pk))}</div>
              <div class="gypk-kind">${gift ? '礼物' : '自购'}</div>
              ${hasBody(pk) || foot ? '<div class="gypk-chev">›</div>' : ''}
            </div>
            <div class="gypk-main">
              <div class="gypk-emo">${esc(pk.emoji || '📦')}</div>
              <div class="gypk-info">
                <div class="gypk-name">${esc(pk.name)}${pk.price ? `<em>￥${esc(pk.price)}</em>` : ''}</div>
                <div class="gypk-way2">${esc(nameOf(pk.from))} <b>→</b> ${esc(nameOf(pk.to))}</div>
              </div>
            </div>
            <div class="gypk-rail">${rail}</div>
            ${body}
          </div>
        </div>`;
    };

    window.gyParcelToggle = function (id) {
        const f = findCard(id);
        if (!f) return;
        f.pk.__open = !f.pk.__open;
        refresh(f.sid);
    };

    /* ================= 下单 ================= */
    // gyParcel.order({from,to,name,emoji,price,desc,reason,orderId,gift})
    // from/to 用 'me' 或角色 id。卡片挂在"这件事跟谁有关"的那个私聊里：
    // 送给角色 → 挂那个角色；角色送我 / 角色自己买 → 挂那个角色。
    function hostOf(pk) {
        if (String(pk.to) !== 'me') return String(pk.to);
        if (String(pk.from) !== 'me') return String(pk.from);
        return null;   // 自己买给自己：没有对手方，不进任何私聊
    }
    window.gyParcel = {
        order(o) {
            if (!on('parcelCard')) return null;
            const pk = {
                id: uid(), orderId: o.orderId || '', at: Date.now(),
                name: String(o.name || '一样东西').slice(0, 40),
                emoji: String(o.emoji || '📦').slice(0, 4),
                // 0 元和空的都不显示价签（"手写信 ￥0"看着像标错价）
                price: (o.price == null || String(o.price).trim() === '' || parseFloat(o.price) === 0) ? '' : String(o.price),
                desc: String(o.desc || '').slice(0, 120),
                reason: String(o.reason || '').slice(0, 120),
                from: String(o.from || 'me'), to: String(o.to || 'me'),
                gift: !!o.gift, status: 'shipping', shipped: false,
                line: '', note: '', kitAdded: false, __open: false
            };
            const host = hostOf(pk);
            if (!host) return null;
            pushCard(host, String(pk.from) === 'me' ? 'me' : pk.from, pk);
            refresh(host);
            return pk;
        },
        // 物流走到一半：聊天里系统提示一句（开关 parcelShipLine，默认关）
        ship(id, text) {
            const f = findCard(id);
            if (!f) return;
            f.pk.shipped = true;
            if (on('parcelShipLine') && text) sysLine(f.sid, '📮 ' + text);
            refresh(f.sid);
        },
        // 到货。自己买的直接签收；送礼的停在"到货"等对方收
        async arrive(id, opts) {
            const f = findCard(id);
            if (!f) return null;
            const pk = f.pk;
            if (pk.status === 'received' || pk.status === 'declined') return pk;
            pk.status = 'arrived';
            pk.shipped = true;
            if (opts && opts.line) pk.line = String(opts.line).slice(0, 200);
            pk.__open = true;          // 到货这一下自动展开一次，免得错过
            refresh(f.sid);
            try {
                if (typeof addNotification === 'function') {
                    addNotification('📦 <b>包裹到了</b>', null, f.sid, charOf(f.sid),
                        `${pk.emoji} ${pk.name}　${nameOf(pk.from)} → ${nameOf(pk.to)}`);
                }
            } catch (e) {}
            // 自己买给自己 / 角色买给自己：没有"收不收"这一步，直接签收
            const gift = pk.gift && String(pk.from) !== String(pk.to);
            if (!gift) return await settle(id, true, '');
            // 送给角色的：问 TA 收不收（开关关掉就默认收下，不调 API）
            if (String(pk.to) !== 'me') await askAccept(id);
            return pk;
        },
        /* 角色到货之后的反应收进卡里，不再单发一条消息。
           v113：反应不一定是一句话——也可能是"什么都没说，收进抽屉了"这种
           行为。kind 记下是哪一种，卡上会标出来。 */
        say(id, text, kind) {
            const f = findCard(id);
            if (!f || !text) return;
            f.pk.note = String(text).slice(0, 300);
            f.pk.noteKind = String(kind || 'say').slice(0, 8);
            f.pk.noteAt = Date.now();
            f.pk.__open = true;
            refresh(f.sid);
        },
        // 给记忆注入用：这个人最近收到的东西，以及当时的反应
        reacts(charId, n) {
            return allCards()
                .filter(pk => String(pk.to) === String(charId) && pk.note)
                .sort((a, b) => (b.noteAt || b.at) - (a.noteAt || a.at))
                .slice(0, n || 3)
                .map(pk => ({ name: pk.name, kind: pk.noteKind || 'say', text: pk.note, at: pk.noteAt || pk.at }));
        },
        list: allCards,
        find: id => (findCard(id) || {}).pk || null
    };

    /* ================= 收 / 不收 ================= */
    // 你点的（送给你的包裹）
    window.gyParcelTake = async function (id, yes) {
        await settle(id, !!yes, yes ? '' : '');
    };
    async function settle(id, yes, line) {
        const f = findCard(id);
        if (!f) return null;
        const pk = f.pk;
        if (pk.status === 'received' || pk.status === 'declined') return pk;
        pk.status = yes ? 'received' : 'declined';
        pk.receivedAt = Date.now();
        if (line) pk.line = String(line).slice(0, 200);
        // 收下了才真的进随身物——以前是一到货就塞进去，等于"不收也归你"
        // （v113 起 to === 'me' 也照样进——你自己也有一份随身物了）
        if (yes && window.gyKit && typeof window.gyKit.add === 'function') {
            try {
                const fromTag = String(pk.from) === 'me' ? 'user' : (String(pk.from) === String(pk.to) ? 'self' : 'char:' + pk.from);
                await window.gyKit.add(pk.to, pk.name, pk.desc || '', fromTag, nameOf(pk.from));
                pk.kitAdded = true;
            } catch (e) { console.warn('[包裹] 写进随身物失败：', e); }
        }
        refresh(f.sid);
        return pk;
    }
    // 送给角色：TA 自己决定收不收（开关 parcelAccept）
        // 报一下场景：这段生成属于「mall」那一场，好让「注入内容管理」能单独设它读什么（soft＝外层已经有场景就不抢）
    async function askAccept() {
        const a = arguments;
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('mall', () => askAcceptInner.apply(null, a));
        return askAcceptInner.apply(null, a);
    }
    async function askAcceptInner(id) {
        const f = findCard(id);
        if (!f) return;
        const pk = f.pk;
        const c = charOf(pk.to);
        if (!c) return await settle(id, true, '');
        if (!on('parcelAccept')) return await settle(id, true, '');
        let api = null;
        try { api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null; } catch (e) {}
        if (!api || !api.key) return await settle(id, true, '');
        try {
            const byWho = String(pk.from) === 'me'
                ? ((typeof userDisplayName === 'function') ? userDisplayName(c) : '对方')
                : nameOf(pk.from);
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '')
                : ('你是' + c.name + '，人设：' + (c.persona || ''));
            const ask = `${byWho}送了你一样东西，刚刚送到你手上：${pk.emoji} ${pk.name}${pk.desc ? `（${pk.desc}）` : ''}${pk.reason ? `。对方的说法是："${pk.reason}"` : ''}。
按你自己的性格决定**收不收**——嫌贵、不好意思、跟对方还没熟到这份上、正在闹别扭、
或者单纯不喜欢这东西，都可以不收，不用勉强自己领情。
只输出 JSON，不要 markdown：{"ok": true或false, "line": "你收下/退回时说的一句话，30字以内，像人说话，不要引号"}`;
            const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask)
                : [{ role: 'user', content: base + '\n' + ask }];
            const data = await callChatCompletionAPI(api, msgs);
            let r = (typeof parseModelJson === 'function') ? parseModelJson(data.choices?.[0]?.message?.content || '') : null;
            if (Array.isArray(r)) r = r[0];
            const ok = !r || r.ok !== false;
            const line = String((r && r.line) || '').trim().slice(0, 60) || (ok ? '收下了。' : '这个我不能收。');
            await settle(id, ok, line);
            try {
                if (typeof addNotification === 'function') {
                    addNotification(`<b>${c.name}</b> ${ok ? '收下了' : '没有收'}你送的东西`, null, c.id, c, line);
                }
            } catch (e) {}
        } catch (e) {
            console.warn('[包裹] 问收不收失败：', e);
            await settle(id, true, '');
        }
    }

    /* ================= 商城里的「包裹」页 ================= */
    // 挂在商城页面里，跟订单分开：订单看的是物流，这一页看的是"东西到没到我手上"。
    window.gyParcelTabHtml = function () {
        const all = allCards();
        if (!all.length) {
            return `<div class="gymall-empty">还没有包裹。<br>去「商品」买一样，或者等角色送你点什么。</div>`;
        }
        const one = pk => {
            const si = stageIdx(pk);
            const gift = pk.gift && String(pk.from) !== String(pk.to);
            return `<div class="gypk-lite s-${esc(pk.status)}" onclick="gyParcelJump('${pk.id}')">
                <div class="gypk-lite-emo">${esc(pk.emoji || '📦')}</div>
                <div style="min-width:0;flex:1;">
                    <div class="gypk-lite-name">${esc(pk.name)}<span>${gift ? '礼物' : '自购'}</span></div>
                    <div class="gypk-lite-sub">${esc(nameOf(pk.from))} → ${esc(nameOf(pk.to))}　·　${STAGES[si]}${pk.status === 'declined' ? '（没收）' : ''}</div>
                    ${pk.line ? `<div class="gypk-lite-said">${esc(pk.line)}</div>` : ''}
                </div>
                <div class="gypk-lite-go">›</div>
            </div>`;
        };
        const wait = all.filter(p => p.status === 'arrived');
        const rest = all.filter(p => p.status !== 'arrived');
        return `${wait.length ? `<div class="gypk-sec">等着收（${wait.length}）</div>${wait.map(one).join('')}` : ''}
                ${rest.length ? `<div class="gypk-sec">往来记录</div>${rest.map(one).join('')}` : ''}`;
    };
    window.gyParcelJump = function (id) {
        const f = findCard(id);
        if (!f) return;
        f.pk.__open = true;
        try { if (typeof gymallClose === 'function') gymallClose(); } catch (e) {}
        try { if (typeof switchMainView === 'function') switchMainView('chat'); } catch (e) {}
        try { if (typeof switchChatSession === 'function') switchChatSession(f.sid); } catch (e) {}
    };
    function renderParcelTab() {
        const box = document.getElementById('gyParcelTabBody');
        if (box) box.innerHTML = window.gyParcelTabHtml();
    }

    /* ================= 记忆总览里的那一块 ================= */
    function memHubHtml(charId) {
        const arr = allCards(charId);
        const got = arr.filter(p => p.status === 'received').length;
        return `
          <label style="font-size:15px;">📦 包裹往来</label>
          <div style="font-size:12px; color:#536471; margin-bottom:8px;">
            你们之间寄来寄去的东西。收下的会进随身物，TA 是真的记得这件东西是谁给的。
          </div>
          <div style="display:flex;align-items:center;gap:10px;background:white;padding:10px 12px;border-radius:8px;border:1px solid #eff3f4;margin-bottom:8px;">
            <b style="font-size:18px;color:var(--gy-accent);">${arr.length}</b><span style="font-size:13px;">个包裹　·　收下 ${got} 个</span>
            <button type="button" class="btn-edit-small" style="margin-left:auto;" onclick="gyOpenFeaturePage('mall')">去商城</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;">
          ${arr.length ? arr.slice(0, 30).map(p => `
            <div style="background:white;padding:8px 10px;border-radius:6px;border:1px solid #eff3f4;">
              <div style="font-size:13px;"><span style="color:#f91880;cursor:pointer;float:right;font-size:12px;" onclick="gyParcelForget('${esc(p.__sid)}','${esc(p.id)}')">删除</span><b>${esc(p.emoji || '📦')} ${esc(p.name)}</b>
                <span style="font-size:11px;color:#8b98a5;">　${esc(nameOf(p.from))} → ${esc(nameOf(p.to))}　·　${STAGES[stageIdx(p)]}${p.status === 'declined' ? '（没收）' : ''}</span></div>
              ${p.line ? `<div style="font-size:13px;color:#536471;line-height:1.7;margin-top:2px;">${esc(p.line)}</div>` : ''}
            </div>`).join('') : '<div style="color:#8b98a5;font-size:13px;">还没有包裹往来</div>'}
          </div>`;
    }
    // 🗑️ 记忆总览里删一个包裹：把私聊里那张包裹卡一起删掉（聊天记录里没了，TA 也就不记得了）。
    //    还在路上的也能删，删了就不会再到货。
    window.gyParcelForget = function (sid, pid) {
        const arr = (typeof globalChats !== 'undefined' && globalChats[String(sid)]) || [];
        const i = arr.findIndex(m => m && m.type === 'parcel' && m.parcel && m.parcel.id === pid);
        if (i < 0) return;
        if (!confirm('删掉这个包裹？私聊里那张包裹卡也会一起删掉，TA 就不记得这件事了。')) return;
        arr.splice(i, 1);
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        try { renderParcelTab(); renderMemHub(); } catch (e) {}
        try { if (typeof renderChatMessages === 'function' && String(currentChatSessionId) === String(sid)) renderChatMessages(); } catch (e) {}
    };
    function renderMemHub() {
        const host = document.getElementById('memoryHubContent');
        if (!host) return;
        const id = (typeof currentMemoryHubTargetId !== 'undefined') ? currentMemoryHubTargetId : null;
        let box = document.getElementById('gypkMemHubBox');
        if (String(id || '').startsWith('g_') || !id) { if (box) box.remove(); return; }
        if (!box) {
            box = document.createElement('div');
            box.id = 'gypkMemHubBox'; box.className = 'input-group';
            box.style.cssText = 'margin-top:20px; border-top:1px dashed var(--gy-accent); padding-top:15px;';
            host.appendChild(box);
        }
        box.innerHTML = memHubHtml(id);
    }
    function hookMemHub() {
        try {
            ['selectMemoryHubTarget', 'renderMemoryHubContent'].forEach(fn => {
                const orig = window[fn];
                if (typeof orig !== 'function' || orig.__gypkPatched) return;
                window[fn] = function () {
                    const r = orig.apply(this, arguments);
                    try { setTimeout(renderMemHub, 0); } catch (e) {}
                    return r;
                };
                window[fn].__gypkPatched = true;
            });
        } catch (e) { console.warn('[包裹] 挂记忆总览失败：', e); }
    }

    /* ================= 样式 ================= */
    // 快递面单的样子：左边一条码带、上面一行运单号、中间四格进度轨。
    // 刻意跟邀请卡（两个头像＋中间一条线）拉开距离，聊天里一眼能分出来。
    const CSS = `
    .gypk-row{display:flex;justify-content:center;margin:10px 0;}
    .gypk-card{--pk:#b4652f;--pk2:#e0a273;--pkbg:#fffaf5;--pkfg:#3b2a20;--pkline:rgba(180,101,47,.22);
        position:relative;width:min(330px,86%);background:var(--pkbg);color:var(--pkfg);
        border:1px solid var(--pkline);border-radius:6px;overflow:hidden;
        box-shadow:0 2px 10px rgba(0,0,0,.06);font-size:13px;}
    /* 左边那条"条码带"：纯 CSS 画的等宽竖条 */
    .gypk-card .gypk-bar{position:absolute;left:0;top:0;bottom:0;width:9px;
        background:repeating-linear-gradient(180deg,var(--pk) 0 3px,transparent 3px 6px,var(--pk) 6px 8px,transparent 8px 13px);
        opacity:.55;}
    .gypk-head{display:flex;align-items:center;gap:8px;padding:7px 10px 7px 18px;
        border-bottom:1px dashed var(--pkline);cursor:pointer;user-select:none;}
    .gypk-way{font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;color:var(--pk);}
    .gypk-kind{font-size:10.5px;color:#fff;background:var(--pk);border-radius:3px;padding:1px 6px;}
    .gypk-chev{margin-left:auto;color:var(--pk);font-size:16px;transition:transform .18s;}
    .gypk-card.open .gypk-chev{transform:rotate(90deg);}
    .gypk-main{display:flex;align-items:center;gap:10px;padding:10px 12px 8px 18px;}
    .gypk-emo{font-size:26px;line-height:1;flex-shrink:0;}
    .gypk-info{min-width:0;flex:1;}
    .gypk-name{font-weight:700;font-size:14px;display:flex;align-items:baseline;gap:6px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .gypk-name em{font-style:normal;font-size:11.5px;color:var(--pk);font-weight:600;}
    .gypk-way2{font-size:11.5px;color:#8b7264;margin-top:2px;}
    .gypk-way2 b{color:var(--pk);}
    /* 四格进度轨 */
    .gypk-rail{display:flex;padding:0 12px 10px 18px;gap:2px;}
    .gypk-st{flex:1;text-align:center;position:relative;}
    .gypk-st i{display:block;height:3px;border-radius:2px;background:var(--pkline);margin-bottom:4px;}
    .gypk-st.on i{background:var(--pk);}
    .gypk-st.dead i{background:#c9ccd0;}
    .gypk-st span{font-size:10px;color:#a3907f;}
    .gypk-st.on span{color:var(--pk);font-weight:600;}
    .gypk-st.dead span{color:#98a0a8;}
    /* 展开的那一段：默认收起来 */
    .gypk-body{max-height:0;overflow:hidden;padding:0 12px 0 18px;transition:max-height .22s,padding .22s;}
    .gypk-card.open .gypk-body{max-height:420px;padding:0 12px 12px 18px;}
    .gypk-desc{font-size:12.5px;color:#7a6455;line-height:1.7;}
    .gypk-kd{display:inline-block;font-size:10px;border:1px solid rgba(128,128,128,.35);border-radius:4px;
        padding:0 5px;margin-right:6px;opacity:.75;vertical-align:1px;}
    .gypk-note{font-size:12px;color:#a3907f;line-height:1.7;margin-top:3px;}
    .gypk-said{margin-top:8px;background:rgba(180,101,47,.09);border-left:3px solid var(--pk);
        border-radius:0 6px 6px 0;padding:8px 10px;font-size:13px;line-height:1.7;}
    .gypk-said.no{border-left-color:#9aa0a6;background:rgba(0,0,0,.05);color:#6b7075;}
    .gypk-acts{display:flex;gap:8px;margin-top:10px;}
    .gypk-btn{flex:1;border-radius:5px;padding:7px 0;font-size:12.5px;font-weight:600;cursor:pointer;
        border:1px solid var(--pk);background:transparent;color:var(--pk);transition:.15s;}
    .gypk-btn.take{background:var(--pk);color:#fff;}
    .gypk-btn:hover{opacity:.85;}
    .gypk-wait{margin-top:10px;font-size:12px;color:#a3907f;display:flex;align-items:center;gap:6px;}
    .gypk-dots{display:inline-flex;gap:3px;}
    .gypk-dots i{width:4px;height:4px;border-radius:50%;background:var(--pk);animation:gypkb 1s infinite;}
    .gypk-dots i:nth-child(2){animation-delay:.15s;} .gypk-dots i:nth-child(3){animation-delay:.3s;}
    @keyframes gypkb{0%,60%,100%{opacity:.25;} 30%{opacity:1;}}
    .gypk-done{margin-top:10px;font-size:12.5px;color:var(--pk);font-weight:600;}
    .gypk-done.no{color:#8a9099;}

    /* 深色模式：牛皮纸换成暗一档，字色跟着翻 */
    body.dark-theme .gypk-card{--pkbg:#231a14;--pkfg:#e8ded6;--pk2:#8a5533;--pkline:rgba(224,162,115,.25);--pk:#d99a67;}
    body.dark-theme .gypk-way2,body.dark-theme .gypk-note,body.dark-theme .gypk-st span{color:#a1907f;}
    body.dark-theme .gypk-desc{color:#c3b5a8;}
    /* 黑白主题：整张卡折成灰阶，跟全站一致 */
    body.theme-mono .gypk-card{--pk:var(--gy-accent);--pk2:var(--gy-accent-2);
        --pkbg:var(--gy-accent-soft);--pkfg:inherit;--pkline:var(--gy-accent-line);}
    body.theme-mono .gypk-said{background:var(--gy-accent-soft);}
    body.theme-mono .gypk-way2,body.theme-mono .gypk-note,body.theme-mono .gypk-desc,
    body.theme-mono .gypk-st span,body.theme-mono .gypk-wait{color:#8b98a5;}

    /* 商城「包裹」页里的紧凑版 */
    .gypk-sec{font-size:11.5px;letter-spacing:.1em;color:#8b98a5;margin:14px 2px 6px;text-transform:uppercase;}
    .gypk-lite{display:flex;align-items:center;gap:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;
        border:1px solid rgba(128,128,128,.22);border-left:4px solid #b4652f;border-radius:8px;transition:.15s;}
    .gypk-lite:hover{background:rgba(128,128,128,.07);}
    .gypk-lite.s-arrived{border-left-color:#e0a273;}
    .gypk-lite.s-received{border-left-color:var(--gy-ok);}
    .gypk-lite.s-declined{border-left-color:#9aa0a6;}
    .gypk-lite-emo{font-size:22px;flex-shrink:0;}
    .gypk-lite-name{font-weight:700;font-size:13.5px;display:flex;align-items:center;gap:6px;}
    .gypk-lite-name span{font-size:10px;font-weight:500;color:#8b98a5;border:1px solid rgba(128,128,128,.3);border-radius:3px;padding:0 5px;}
    .gypk-lite-sub{font-size:11.5px;color:#8b98a5;margin-top:2px;}
    .gypk-lite-said{font-size:12px;color:#8b98a5;margin-top:3px;line-height:1.6;}
    .gypk-lite-go{color:#8b98a5;font-size:18px;}
    body.theme-mono .gypk-lite{border-left-color:var(--gy-accent) !important;}
    @media (max-width:600px){ .gypk-card{width:92%;} }
    `;
    function mount() {
        if (document.getElementById('gypkCss')) return;
        const st = document.createElement('style');
        st.id = 'gypkCss'; st.textContent = CSS;
        document.head.appendChild(st);
    }

    /* ================= 开关 ================= */
    function addSwitches() {
        try {
            if (typeof AUTO_FEATURE_DEFS === 'undefined' || !Array.isArray(AUTO_FEATURE_DEFS)) return;
            const defs = [
                { key: 'parcelCard', label: '商城：下单/到货做成聊天里的包裹卡',
                  desc: '下单、到货、收货全在私聊里以一张快递面单的样子出现，点一下展开看详情和 TA 说的话。关掉之后回到老样子：只弹一个提示，聊天记录里什么都不留。',
                  cost: '不额外调 API', group: '购物', where: '私聊里' },
                { key: 'parcelShipLine', label: '商城：物流进度在聊天里提示一句',
                  desc: '包裹发出时在私聊里插一条系统提示（"仓库已发出"这种，一句话，不是卡片）。嫌吵就关掉，卡片上的进度轨照样走。',
                  cost: '不额外调 API', defaultOff: true, group: '购物', where: '私聊里' },
                { key: 'parcelAccept', label: '商城：送给角色的东西，TA 自己决定收不收',
                  desc: '东西送到角色手上时，TA 按人设决定收还是退——嫌贵、不好意思、还没熟到这份上、正闹别扭，都可能不收，那句话写在卡上。关掉的话到货就默认收下。⚠️ 只有收下了东西才进 TA 的随身物。',
                  cost: '每份送给角色的礼物一次调用', group: '购物', where: '私聊里的包裹卡' }
            ];
            defs.forEach(d => { if (!AUTO_FEATURE_DEFS.some(x => x.key === d.key)) AUTO_FEATURE_DEFS.push(d); });
        } catch (e) { console.warn('[包裹] 注册开关失败：', e); }
    }

    (function init() {
        mount();
        addSwitches();
        hookMemHub();
    })();
})();
