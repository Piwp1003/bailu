/* =====================================================================
   js/25 —— 🎒 随身物 + 📅 日子 + 🌐 此刻
   原来是插件（白露随身物插件.json / 白露日子插件.json / 白露此刻插件.json），v97 起内置。装过旧插件的可以在「🔌 插件」页删掉。

   ⚠️ 每个各自一个 IIFE，别合并：它们之间有同名的顶层符号。
   ⚠️ 原插件的 `code` 钩子（每次拼 prompt 都跑）内置之后改成统一由
      js/06 的 getBoxPrompt() 调用各自暴露的 window.__gyXxxCtxFor；
      关系账本的 `onResponse` 钩子改由 js/02 的 runBoxResponseHooks() 调用。
   ===================================================================== */

// ============ 随身物 ============
/* ===========================================================================
   🎒 白露随身物 —— 角色身上真的有东西，而且那些东西有来历
   ---------------------------------------------------------------------------
   模型每次都能临时编出一支笔、一条围巾，但那是一次性的：下一轮就没了，
   也没人记得是谁给的。真人不是这样——你送的围巾 TA 会用两年，
   钢笔的笔套掉了会找很久，某样东西一直带着是因为那是谁留下的。

   这里把"身上有什么"做成一份**有历史的清单**：
     · 每件东西记着 谁给的、什么时候、为什么、现在还在不在
     · 你送 TA 的东西会一直在单子上，TA 提起时是真的记得来历
     · 会弄丢、会用坏、会送人——状态变了，prompt 里也跟着变
     · prompt 里明确写"不要凭空多出没在这个单子上的东西"，
       这样模型就不会每轮现编一个新物件

   💰 手动加、改、删完全不花钱。只有两处会调 API，都默认关：
      「让 AI 按人设生成一批随身物」和「TA 自己决定送你东西 / 用掉什么」。
   =========================================================================== */
(function () {
    if (window.__gyKitLoaded) { try { gykitOpen(); } catch (e) {} return; }
    window.__gyKitLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyKitBox', 'items')          // 带兜底的存档口：localforage 用不了就退 localStorage，两条都断才报错
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyKitBox', storeName: 'items' })
            : null);
    const KEY = 'gyKit_state';

    const STATES = [
        { k: 'have', n: '还在身上', ico: '✅' },
        { k: 'home', n: '放在家里', ico: '🏠' },
        { k: 'lost', n: '弄丢了', ico: '❓' },
        { k: 'broken', n: '用坏了', ico: '💔' },
        { k: 'given', n: '送人了', ico: '🎁' },
        { k: 'used', n: '用完了', ico: '🕳️' }
    ];
    const stName = k => (STATES.find(s => s.k === k) || STATES[0]).n;
    const stIco = k => (STATES.find(s => s.k === k) || STATES[0]).ico;

    let S = {
        items: [],       // [{id, ownerId, name, desc, from, fromName, at, state, note, close}]
        inject: 8,       // 注进 prompt 的最多几件
        keep: 0,         // 每人最多存几件，0 ＝ 不限
        strict: true,    // 告诉模型"不要凭空多出单子上没有的东西"
        showGone: true,  // 弄丢/坏掉的也注入（"你还记得那件东西"）
        autoGen: false,  // 让 AI 生成一批（点一次花一次）
        autoAct: false   // 自主模式里多一个"送东西 / 用掉东西"
    };

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const uid = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const uname = c => (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
    const ago = t => { const d = Math.floor((Date.now() - t) / 86400000);
        return d <= 0 ? '今天' : d === 1 ? '昨天' : d < 30 ? d + ' 天前' : d < 400 ? Math.round(d / 30) + ' 个月前' : Math.round(d / 365) + ' 年前'; };

    async function save() { if (LF) { try { await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) { console.warn('[随身物] 存档失败', e); } } }
    async function load() {
        if (LF) { try { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } catch (e) {} }
        if (!Array.isArray(S.items)) S.items = [];
    }

    const of = id => S.items.filter(i => String(i.ownerId) === String(id));
    async function addItem(ownerId, o) {
        const it = Object.assign({
            id: uid(), ownerId, name: '', desc: '', from: 'self', fromName: '',
            at: Date.now(), state: 'have', note: '', close: false
        }, o || {});
        it.name = String(it.name || '').trim();   // 不截字数
        if (!it.name) return null;
        it.desc = String(it.desc || '').trim();
        S.items.push(it);
        const keep = parseInt(S.keep) || 0;
        if (keep > 0) {
            const mine = of(ownerId);
            if (mine.length > keep) {
                const drop = new Set(mine.slice(0, mine.length - keep).map(x => x.id));
                S.items = S.items.filter(x => !drop.has(x.id));
            }
        }
        await save();
        try { renderPanel(); renderMemHub(); } catch (e) {}
        return it;
    }
    // 对外：别的插件/脚本可以塞一件东西进来
    window.gyKit = {
        add: (ownerId, name, desc, from, fromName) => addItem(ownerId, { name, desc, from: from || 'self', fromName: fromName || '' }),
        list: id => of(id).slice()
    };

    // ---------- 注进 prompt ----------
    window.__gyKitCtxFor = function (charId) {
        try {
            const c = charOf(charId);
            if (!c) return '';
            // 🧑 对方（用户）身上带着的东西——单独算一段，
            //    不能被"这个角色自己什么都没有"挡在门外（原来 mine.length 一为 0 就整段 return 了）
            let yoursOut = '';
            try {
                const yours = of('me').filter(i => i.close && (i.state === 'have' || i.state === 'home')).slice(-5);
                if (yours.length) yoursOut = `\n【${uname(c)}身上带着的东西】\n` + yours.map(i =>
                    `· ${i.name}${i.desc ? '（' + i.desc + '）' : ''}${i.from && i.from.indexOf('char:') === 0 ? ' —— ' + (i.fromName || '别人') + '送的' : ''}`).join('\n')
                    + `\n这是你见过、知道的——不用刻意提，但聊到的时候你是认得的。\n`;
            } catch (e) {}
            const mine = of(charId);
            if (!mine.length) return yoursOut;
            const n = Math.max(0, Math.round(gyNum(S.inject, 8)));
            const here = mine.filter(i => i.state === 'have' || i.state === 'home').slice(-n);
            const gone = S.showGone ? mine.filter(i => ['lost', 'broken', 'given', 'used'].indexOf(i.state) >= 0).slice(-4) : [];
            if (!here.length && !gone.length) return '';
            const line = i => {
                const src = i.from === 'user' ? `${uname(c)}${i.at ? ago(i.at) : ''}送的`
                          : i.from && i.from.indexOf('char:') === 0 ? `${i.fromName || '别人'}给的`
                          : '';
                return `· ${i.name}${i.desc ? '（' + i.desc + '）' : ''}${src ? ' —— ' + src : ''}${i.close ? '［贴身带着］' : ''}${i.state === 'home' ? '［放在家里，不随身］' : ''}`;
            };
            let out = '';
            if (here.length) out += `\n【你身上/家里真的有的东西】\n` + here.map(line).join('\n') + '\n';
            if (gone.length) {
                out += `【已经不在了的】\n` + gone.map(i =>
                    `· ${i.name} —— ${stName(i.state)}${i.at ? '，' + ago(i.at) + '的事' : ''}${i.note ? '，' + i.note : ''}`).join('\n') + '\n';
            }
            out += yoursOut;
            const mineFromUser = here.filter(i => i.from === 'user');
            if (mineFromUser.length) out += `${uname(c)}送的那几样你还留着——这件事本身是有分量的，别把它说得像顺手拿的。\n`;
            out += `这些东西是真的在你身上，用到、提到、被问到的时候你记得它们的来历和样子。\n`;
            if (S.strict) out += `⚠️ 不要凭空多出这个单子上没有的随身物件。需要一样这里没有的东西时，说你没有、或者要去找去买，而不是直接从兜里掏出来。\n`;
            return out;
        } catch (e) { return ''; }
    };

    // ---------- 你送 TA 东西（花一次调用）----------
    let busy = false;
    const tell = m => { const e = document.getElementById('gykitStatus'); if (e) e.innerText = m;
        else if (typeof showToast === 'function') showToast('', '随身物', m, null, null, false); };

    window.gykitGive = async function (charId) {
        const c = charOf(charId); if (!c) return;
        const nEl = document.getElementById('gykitGiveName'), dEl = document.getElementById('gykitGiveDesc');
        const name = ((nEl && nEl.value) || '').trim();
        if (!name) { tell('先写东西叫什么。'); return; }
        const desc = ((dEl && dEl.value) || '').trim();
        if (busy) { tell('还在等上一条，等一下。'); return; }
        // 东西先给出去——就算 API 挂了，这件东西也确实到 TA 手上了
        const it = await addItem(charId, { name, desc, from: 'user', fromName: (typeof currentUser !== 'undefined' && currentUser.name) || '你', close: true });
        if (nEl) nEl.value = ''; if (dEl) dEl.value = '';
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { tell('东西已经记上了。没配 API Key，所以 TA 没当场说话。'); return; }
        busy = true; tell(`正在等 ${c.name} 的反应…`);
        try {
            const ask = `${uname(c)}把一样东西给了你：${name}${desc ? '（' + desc + '）' : ''}。
按你的性格反应——高兴、别扭、推辞、意外、觉得对方乱花钱、或者只是"嗯"一声收下，都行，不要一律感动。
如果这东西正好戳到你什么（缺过、想要过、讨厌过），可以带出来。
一到两句话，用你自己的说话方式，别写旁白别加引号。只输出这几句话。`;
            const messages = buildStructuredMessages(buildBasePrompt(c, false, ''), [], ask);
            const data = await callChatCompletionAPI(api, messages);
            let a = (data.choices?.[0]?.message?.content || '').trim().replace(/^["'“”「」]+|["'“”「」]+$/g, '');
            if (typeof stripReasoningBlocks === 'function') a = stripReasoningBlocks(a);
            if (typeof applyRegexScripts === 'function') { try { a = applyRegexScripts(a, 'ai_output', c.id); } catch (e) {} }
            if (a) {
                it.note = a.slice(0, 60);
                await save();
                // 通知里的这一条点了进那个人的私聊（送东西这件事跟人相关，比跳去随身物页有用）
                if (typeof addNotification === 'function') addNotification(`你把「${name}」给了 <b>${c.name}</b> 🎁`, null, c.id, c, a);
                else if (typeof showToast === 'function') showToast(typeof getAvatarHTML === 'function' ? getAvatarHTML(c, 40) : '', c.name + ' 说', a, null, null, false);
            }
            tell('');
            renderPanel();
        } catch (e) { tell('东西记上了，但 TA 的反应没拿到：' + (e.message || e)); }
        finally { busy = false; }
    };

    // ---------- 让 AI 按人设生成一批（花一次调用）----------
    window.gykitGen = async function (charId) {
        const c = charOf(charId); if (!c) return;
        if (busy) { tell('还在等上一条。'); return; }
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { tell('还没配 API Key。'); return; }
        busy = true; tell(`正在想 ${c.name} 兜里会有什么…`);
        try {
            const have = of(charId).map(i => i.name);
            const ask = `想一想你身上、包里、口袋里**真的会有**的东西。
${have.length ? '这些已经有了，别重复：' + have.join('、') + '\n' : ''}
要求：
1. 必须符合你的身份、习惯和这个世界观——现代都市就别有火折子，古代就别有充电宝。
2. 要具体、要有个人痕迹：不是"一支笔"，是"笔帽上有个牙印的旧钢笔"。
3. 至少有一两样是**带来历的**（谁给的、哪年买的、为什么一直留着），来历写进 desc。
4. 生活气要够：钱包里塞的东西、口袋里的零碎、包底的旧东西，都算。
5. 6 到 8 样。
只输出 JSON 数组，不要解释、不要 markdown 围栏：
[{"name":"东西叫什么（12字以内）","desc":"什么样 / 什么来历（40字以内）","close":true 或 false}]
close 表示这样东西是不是真的贴身带着（钥匙钱包是，家里那本相册不是）。`;
            const messages = buildStructuredMessages(buildBasePrompt(c, false, ''), [], ask);
            const data = await callChatCompletionAPI(api, messages);
            const raw = (data.choices?.[0]?.message?.content || '');
            let list = (typeof parseModelJson === 'function') ? parseModelJson(raw) : JSON.parse(raw);
            if (list && !Array.isArray(list) && Array.isArray(list.items)) list = list.items;
            if (!Array.isArray(list) || !list.length) { tell('这次没给出能用的东西，再点一次。'); return; }
            const exist = new Set(have);
            let n = 0;
            for (const o of list) {
                const nm = String((o && (o.name || o.名称)) || '').trim();
                if (!nm || exist.has(nm)) continue;
                exist.add(nm);
                await addItem(charId, { name: nm, desc: String((o && (o.desc || o.描述)) || ''), from: 'self', close: !!(o && o.close) });
                n++;
            }
            tell(n ? `给 ${c.name} 加了 ${n} 样。` : '生成出来的都已经有了。');
            renderPanel();
        } catch (e) { tell('生成失败：' + (e.message || e)); }
        finally { busy = false; }
    };

    // ---------- 样式 ----------
    const CSS = `
#gykitModal{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;padding:16px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;}
#gykitModal.on{display:flex;}
.gykit-box{background:#fff;border-radius:16px;width:720px;max-width:100%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;}
body.dark-theme .gykit-box{background:#16181c;color:#e7e9ea;}
.gykit-hd{padding:15px 18px 9px;font-size:17px;font-weight:700;color:#c47b1a;display:flex;align-items:center;gap:8px;}
.gykit-tabs{display:flex;gap:4px;padding:0 18px;border-bottom:1px solid rgba(128,128,128,.2);flex-wrap:wrap;}
.gykit-tab{border:none;background:none;padding:9px 12px;font-size:13.5px;cursor:pointer;color:#8b98a5;border-bottom:2px solid transparent;font-family:inherit;}
.gykit-tab.on{color:#c47b1a;border-bottom-color:#c47b1a;font-weight:700;}
.gykit-bd{padding:14px 18px 16px;overflow-y:auto;flex:1 1 auto;}
.gykit-sec{margin-bottom:16px;}
.gykit-sec>h4{margin:0 0 8px;font-size:13px;color:#c47b1a;}
.gykit-hint{font-size:12px;color:#8b98a5;line-height:1.7;margin-bottom:8px;}
.gykit-in{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cfd9de;border-radius:8px;font-size:13px;background:transparent;color:inherit;outline:none;margin-bottom:8px;font-family:inherit;}
.gykit-in:focus{border-color:#c47b1a;}
.gykit-btn{border:1px solid #c47b1a;background:#c47b1a;color:#fff;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer;margin:0 6px 6px 0;font-family:inherit;}
.gykit-btn.ghost{background:transparent;color:#c47b1a;}
.gykit-btn.danger{background:transparent;border-color:#8b98a5;color:#8b98a5;}
.gykit-mini{border:none;background:rgba(128,128,128,.12);border-radius:6px;padding:4px 9px;font-size:11px;cursor:pointer;color:inherit;font-family:inherit;margin:0 4px 4px 0;}
.gykit-mini.on{background:#c47b1a;color:#fff;}
.gykit-c{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px dashed rgba(128,128,128,.25);cursor:pointer;}
.gykit-av{width:36px;height:36px;border-radius:50%;background:#e6e9ea;color:#0f1419;font-size:15px;display:flex;align-items:center;
  justify-content:center;flex:0 0 auto;background-size:cover;background-position:center;}
body.dark-theme .gykit-av{background:#2f3336;color:#e7e9ea;}
.gykit-c-m{flex:1 1 auto;min-width:0;}
.gykit-c-m b{display:block;font-size:14px;}
.gykit-c-m span{font-size:11.5px;color:#8b98a5;}
.gykit-i{display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px dashed rgba(128,128,128,.2);font-size:13px;}
.gykit-i.gone{opacity:.55;}
.gykit-i-m{flex:1 1 auto;min-width:0;}
.gykit-i-m b{font-size:13.5px;}
.gykit-i-m span{display:block;font-size:11.5px;color:#8b98a5;margin-top:2px;line-height:1.6;}
.gykit-src{display:inline-block;font-size:10.5px;padding:1px 7px;border-radius:9px;background:rgba(196,123,26,.14);color:#c47b1a;margin-left:5px;}
.gykit-src.u{background:rgba(249,24,128,.12);color:#f91880;}
@media (max-width:600px){ .gykit-box{max-height:92vh;} }`;

    function mount() {
        const st = document.createElement('style'); st.id = 'gykitStyle'; st.textContent = CSS;
        document.head.appendChild(st);
        const m = document.createElement('div');
        m.id = 'gykitModal';
        m.innerHTML = `<div class="gykit-box">
            <div class="gykit-hd">🎒 随身物<button class="gykit-btn ghost" style="margin-left:auto" onclick="gykitClose()">关闭</button></div>
            <div class="gykit-tabs">
              <button class="gykit-tab" id="gykitTab-list" onclick="gykitTab('list')">谁身上有什么</button>
              <button class="gykit-tab" id="gykitTab-rule" onclick="gykitTab('rule')">规则</button>
            </div>
            <div class="gykit-bd" id="gykitBody"></div></div>`;
        m.addEventListener('click', e => { if (e.target === m) gykitClose(); });
        document.body.appendChild(m);
    }

    let tab = 'list', openChar = null;
    window.gykitOpen = function (charId) { if (charId) { openChar = String(charId); tab = 'list'; }
        document.getElementById('gykitModal').classList.add('on'); renderPanel(); };
    window.gykitClose = function () { document.getElementById('gykitModal').classList.remove('on'); };
    window.gykitTab = function (t) { tab = t; renderPanel(); };
    window.gykitPick = function (id) { openChar = (openChar === String(id)) ? null : String(id); renderPanel(); };

    function renderPanel() {
        const box = document.getElementById('gykitModal');
        if (!box || !box.classList.contains('on')) return;
        ['list', 'rule'].forEach(t => {
            const el = document.getElementById('gykitTab-' + t);
            if (el) el.className = 'gykit-tab' + (t === tab ? ' on' : '');
        });
        document.getElementById('gykitBody').innerHTML = tab === 'list' ? tabList() : tabRule();
    }
    function avatar(c) {
        return c.avatarImg ? `<div class="gykit-av" style="background-image:url('${c.avatarImg}')"></div>`
                           : `<div class="gykit-av">${esc(c.avatarEmoji || (c.name || '?')[0])}</div>`;
    }
    function itemRow(i) {
        const gone = ['lost', 'broken', 'given', 'used'].indexOf(i.state) >= 0;
        const src = i.from === 'user' ? `<span class="gykit-src u">${esc((typeof currentUser !== 'undefined' && currentUser.name) || '你')}送的</span>`
                  : (i.from && i.from.indexOf('char:') === 0) ? `<span class="gykit-src">${esc(i.fromName || '别人')}给的</span>` : '';
        return `<div class="gykit-i ${gone ? 'gone' : ''}">
            <span style="flex:0 0 auto;font-size:15px;">${stIco(i.state)}</span>
            <div class="gykit-i-m">
              <b>${esc(i.name)}</b>${i.close ? '<span class="gykit-src">贴身</span>' : ''}${src}
              <span>${i.desc ? esc(i.desc) + '　' : ''}${ago(i.at)}${i.note ? '　·　「' + esc(i.note) + '」' : ''}</span>
              <div style="margin-top:5px;">
                ${STATES.map(s => `<button class="gykit-mini ${i.state === s.k ? 'on' : ''}" onclick="gykitState('${i.id}','${s.k}')">${s.ico} ${s.n}</button>`).join('')}
                <button class="gykit-mini" onclick="gykitClose2('${i.id}')">${i.close ? '取消贴身' : '设为贴身'}</button>
                <button class="gykit-mini" onclick="gykitDel('${i.id}')">删</button>
              </div>
            </div>
        </div>`;
    }
    /* 🧑 你自己的随身物
       以前这一页只有角色，可"随身物"这件事本来是双向的——
       角色送你的东西、你自己带在身上的东西，同样是真发生过的。
       数据结构本来就是按 ownerId 存的，用 'me' 当 ownerId 就行，不用另起一套。
       角色那边的 prompt 里会带上"对方身上有什么"（只带贴身/常带的那几样，
       不然等于把你兜里所有东西都念一遍）。 */
    const meName = () => (typeof currentUser !== 'undefined' && currentUser.name) || '我';
    function tabMine() {
        const mine = of('me');
        const here = mine.filter(i => i.state === 'have' || i.state === 'home');
        const fromC = mine.filter(i => i.from && i.from.indexOf('char:') === 0).length;
        const open = openChar === 'me';
        return `<div class="gykit-sec" style="margin-bottom:8px;">
          <div class="gykit-c" onclick="gykitPick('me')">
            <div class="gykit-av">${esc(meName()[0] || '我')}</div>
            <div class="gykit-c-m"><b>${esc(meName())}（我自己）</b>
              <span>身上 ${here.length} 样${fromC ? '，其中 ' + fromC + ' 样是角色送的' : ''}${mine.length - here.length ? '　·　' + (mine.length - here.length) + ' 样已经不在了' : ''}</span></div>
            <span style="color:#8b98a5;font-size:12px;">${open ? '收起' : '展开'}</span>
          </div>
          ${open ? `<div style="padding:6px 0 0 46px;">
            <div style="margin-bottom:10px;">
              <input class="gykit-in" id="gykitMineName" placeholder="我身上有一样东西：叫什么？" style="margin-bottom:6px;">
              <input class="gykit-in" id="gykitMineDesc" placeholder="什么样 / 哪来的（可不填）" style="margin-bottom:6px;">
              <button class="gykit-btn" onclick="gykitAddMine()">＋ 记下来</button>
            </div>
            <div class="gykit-hint" style="margin-bottom:8px;">角色会知道你身上有什么——只带<b>贴身</b>的那几样进 prompt，
              不然等于把你兜里所有东西念一遍。在下面把要让 TA 知道的设成「贴身」。</div>
            ${mine.length ? mine.slice().reverse().map(itemRow).join('')
                          : '<div class="gykit-hint">还什么都没记。角色送你的东西收下之后也会自动进这儿。</div>'}
          </div>` : ''}
        </div>`;
    }
    window.gykitAddMine = async function () {
        const n = document.getElementById('gykitMineName'), d = document.getElementById('gykitMineDesc');
        const name = ((n && n.value) || '').trim();
        if (!name) return tell('先写个名字。');
        await addItem('me', { name, desc: ((d && d.value) || '').trim(), from: 'self' });
        if (n) n.value = ''; if (d) d.value = '';
        renderPanel();
    };
    function tabList() {
        const cs = chars();
        if (!cs.length) return `<div id="gykitStatus" style="font-size:12px;color:#8b98a5;margin-bottom:8px;"></div>`
            + tabMine() + '<div class="gykit-hint" style="padding:20px 0;text-align:center;">还没有角色。</div>';
        return `<div id="gykitStatus" style="font-size:12px;color:#8b98a5;margin-bottom:8px;"></div>` + tabMine() + cs.map(c => {
            const mine = of(c.id);
            const here = mine.filter(i => i.state === 'have' || i.state === 'home');
            const fromU = mine.filter(i => i.from === 'user' && (i.state === 'have' || i.state === 'home')).length;
            const open = openChar === String(c.id);
            return `<div class="gykit-sec" style="margin-bottom:8px;">
              <div class="gykit-c" onclick="gykitPick('${c.id}')">
                ${avatar(c)}
                <div class="gykit-c-m"><b>${esc(c.name)}</b>
                  <span>身上 ${here.length} 样${fromU ? '，其中 ' + fromU + ' 样是你送的' : ''}${mine.length - here.length ? '　·　${}'.replace('${}', (mine.length - here.length) + ' 样已经不在了') : ''}</span></div>
                <span style="color:#8b98a5;font-size:12px;">${open ? '收起' : '展开'}</span>
              </div>
              ${open ? `<div style="padding:6px 0 0 46px;">
                <div style="margin-bottom:10px;">
                  <input class="gykit-in" id="gykitGiveName" placeholder="送 TA 一样东西：叫什么？" style="margin-bottom:6px;">
                  <input class="gykit-in" id="gykitGiveDesc" placeholder="什么样 / 为什么送（可不填）" style="margin-bottom:6px;">
                  <button class="gykit-btn" onclick="gykitGive('${c.id}')">🎁 送给 TA</button>
                  <button class="gykit-btn ghost" onclick="gykitAddPlain('${c.id}')">只登记，不用 TA 反应</button>
                  ${S.autoGen ? `<button class="gykit-btn ghost" onclick="gykitGen('${c.id}')">🤖 让 AI 想一批 TA 兜里有什么</button>` : ''}
                </div>
                ${mine.length ? mine.slice().reverse().map(itemRow).join('')
                              : '<div class="gykit-hint">还什么都没有。上面送一样，或者去「规则」里打开 AI 生成。</div>'}
              </div>` : ''}
            </div>`;
        }).join('');
    }
    function tabRule() {
        const sw = (k, title, desc) => `<label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;padding:9px 0;">
            <input type="checkbox" ${S[k] ? 'checked' : ''} onchange="gykitSet('${k}',this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;">
            <span><b>${title}</b><br><span style="font-size:11.5px;color:#8b98a5;line-height:1.7;">${desc}</span></span></label>`;
        return `
        <div class="gykit-sec">
          <h4>📝 怎么注进 prompt</h4>
          ${sw('strict', '不许凭空多出单子上没有的东西',
              '这是这个插件最有用的一条。打开之后 prompt 里会写明"需要一样这里没有的东西时，说你没有、或者要去找去买，而不是直接从兜里掏出来"——模型就不会每轮现编一个新物件了。')}
          ${sw('showGone', '弄丢/用坏的也告诉 TA',
              '"那只钢笔的笔套三个月前掉了，你找了很久"——不在了的东西也是记忆的一部分。最多带最近 4 件。')}
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;">
            <span style="font-size:13px;color:#8b98a5;min-width:140px;">最多注入几件</span>
            <input class="gykit-in" id="gykitInject" type="number" min="1" value="${S.inject}" style="max-width:80px;margin:0;">
            <span style="font-size:12px;color:#8b98a5;">件（只算还在身上的）</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <span style="font-size:13px;color:#8b98a5;min-width:140px;">每人最多存几件</span>
            <input class="gykit-in" id="gykitKeep" type="number" min="0" value="${S.keep}" style="max-width:80px;margin:0;">
            <span style="font-size:12px;color:#8b98a5;">0 ＝ 不限</span>
          </div>
          <button class="gykit-btn" onclick="gykitSaveNums()">💾 保存</button>
        </div>

        <div class="gykit-sec">
          <h4>💰 会花钱的两处（都默认关）</h4>
          <div class="gykit-hint">手动加、改状态、删，全都不花钱。送东西给 TA 时会调一次（想听 TA 的反应），不想花就点「只登记」。</div>
          ${sw('autoGen', '让 AI 按人设生成一批随身物',
              '打开之后每个角色下面会多一个按钮，点一次调用一次，一次生成 6~8 样带来历的东西。生成完就是永久的，不会反复花钱。')}
          ${sw('autoAct', '自主模式里多一个「送东西 / 用掉东西」',
              '角色自己决定要做什么的时候，可能会送你一样东西、或者把身上某样东西用掉/弄丢。需要先在「设置 → AI 增强功能」里打开「角色自己决定要做什么」。')}
        </div>

        <div class="gykit-sec">
          <h4>📄 现在注给角色的是什么样</h4>
          <select class="gykit-in" id="gykitPreviewWho" onchange="gykitPreview()" style="max-width:220px;display:inline-block;">
            ${chars().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') || '<option value="">还没有角色</option>'}
          </select>
          <button class="gykit-btn ghost" onclick="gykitPreview()">看看</button>
          <pre id="gykitPreview" style="white-space:pre-wrap;word-break:break-all;font-size:12px;color:#8b98a5;background:rgba(128,128,128,.06);border-radius:8px;padding:10px;margin-top:8px;max-height:280px;overflow:auto;font-family:inherit;"></pre>
        </div>`;
    }

    window.gykitSet = function (k, v) { S[k] = !!v; save(); renderPanel(); if (k === 'autoAct') hookAutonomy(); };
    // 🎛️ 给「全部开关」页读当前状态用（js/54）
    window.gykitGet = k => !!S[k];
    window.gykitSaveNums = function () {
        const g = id => { const e = document.getElementById(id); return e ? parseInt(e.value) : NaN; };
        const i = g('gykitInject'), k = g('gykitKeep');
        if (!isNaN(i)) S.inject = Math.max(1, i);   // 不设上限
        if (!isNaN(k)) S.keep = Math.max(0, k);
        save(); renderPanel();
    };
    window.gykitAddPlain = async function (charId) {
        const nEl = document.getElementById('gykitGiveName'), dEl = document.getElementById('gykitGiveDesc');
        const name = ((nEl && nEl.value) || '').trim();
        if (!name) { tell('先写东西叫什么。'); return; }
        await addItem(charId, { name, desc: (dEl && dEl.value) || '', from: 'user', close: true });
        if (nEl) nEl.value = ''; if (dEl) dEl.value = '';
        renderPanel();
    };
    window.gykitState = async function (id, st) {
        const it = S.items.find(x => x.id === id); if (!it) return;
        it.state = st; await save(); renderPanel(); renderMemHub();
    };
    window.gykitClose2 = async function (id) {
        const it = S.items.find(x => x.id === id); if (!it) return;
        it.close = !it.close; await save(); renderPanel();
    };
    window.gykitDel = async function (id) {
        S.items = S.items.filter(x => x.id !== id); await save(); renderPanel(); renderMemHub();
    };
    window.gykitPreview = function () {
        const sel = document.getElementById('gykitPreviewWho'), out = document.getElementById('gykitPreview');
        if (!out) return;
        const id = sel && sel.value;
        out.innerText = id ? (window.__gyKitCtxFor(id) || '（这个角色身上还什么都没有，不会注入任何东西）') : '还没有角色。';
    };

    // ---------- 记忆总览 ----------
    function memHubHtml(charId) {
        const mine = of(charId);
        const fromU = mine.filter(i => i.from === 'user');
        return `
          <label style="font-size:15px;">🎒 随身物</label>
          <div style="font-size:12px; color:#536471; margin-bottom:8px;">
            TA 身上真的有的东西。会进 prompt——用到、提到、被问到的时候 TA 记得来历。
            ${fromU.length ? `其中 <b>${fromU.length}</b> 样是你送的。` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;">
          ${mine.length ? mine.slice().reverse().map(i => `
            <div style="display:flex;align-items:flex-start;gap:8px;background:white;padding:8px;border-radius:6px;border:1px solid #eff3f4;${['lost','broken','given','used'].indexOf(i.state)>=0?'opacity:.6;':''}">
              <span>${stIco(i.state)}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:bold;">${esc(i.name)}
                  <span style="font-weight:normal;color:${i.from === 'user' ? '#f91880' : '#536471'};">${i.from === 'user' ? '（你送的）' : ''}</span></div>
                <div style="font-size:12px;color:#536471;">${esc(i.desc || '')}${i.note ? '　「' + esc(i.note) + '」' : ''}</div>
                <div style="font-size:11px;color:#8b98a5;">${stName(i.state)}　${ago(i.at)}</div>
              </div>
              <span style="color:#f91880;cursor:pointer;flex-shrink:0;" onclick="gykitDel('${i.id}')">删除</span>
            </div>`).join('') : '<div style="color:#8b98a5;font-size:13px;">TA 身上还什么都没有</div>'}
          </div>
          <button type="button" class="btn-edit-small" style="margin-top:8px;" onclick="gykitOpen('${charId}')">打开随身物</button>`;
    }
    function renderMemHub() {
        const host = document.getElementById('memoryHubContent');
        if (!host) return;
        const id = (typeof currentMemoryHubTargetId !== 'undefined') ? currentMemoryHubTargetId : null;
        let box = document.getElementById('gykitMemHubBox');
        if (String(id || '').startsWith('g_') || !id) { if (box) box.remove(); return; }
        if (!box) {
            box = document.createElement('div');
            box.id = 'gykitMemHubBox'; box.className = 'input-group';
            box.style.cssText = 'margin-top:20px; border-top:1px dashed #c47b1a; padding-top:15px;';
            host.appendChild(box);
        }
        box.innerHTML = memHubHtml(id);
    }

    // ---------- 自主模式：送东西 / 用掉东西 ----------
    function hookAutonomy() {
        try {
            if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || !Array.isArray(GY_AUTONOMY_ACTIONS)) return;
            if (GY_AUTONOMY_ACTIONS.some(a => a.key === 'kit_move')) return;
            GY_AUTONOMY_ACTIONS.splice(GY_AUTONOMY_ACTIONS.length - 1, 0, {
                key: 'kit_move',
                label: '送样东西 / 弄丢样东西',
                hint: '把身上一样东西送给对方，或者用掉、弄丢一样',
                need: (char) => S.autoAct && of(char.id).some(i => i.state === 'have'),
                run: async (char) => {
                    const mine = of(char.id).filter(i => i.state === 'have');
                    if (!mine.length) return null;
                    const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
                    if (!api || !api.key) return null;
                    const ask = `你身上有这些东西：
${mine.map((i, n) => `${n + 1}. ${i.name}${i.desc ? '（' + i.desc + '）' : ''}`).join('\n')}
这会儿你想对其中某一样做点什么——送给${uname(char)}、用掉、或者不小心弄丢了。
挑一样，挑一个动作，说一句话。要符合你此刻的处境和性格；没什么特别想做的就选 "no"。
只输出 JSON：{"n":序号, "act":"give"或"use"或"lose"或"no", "line":"你要说的一句话，25字以内"}`;
                    const messages = buildStructuredMessages(buildBasePrompt(char, false, ''), [], ask);
                    const data = await callChatCompletionAPI(api, messages);
                    let r = (typeof parseModelJson === 'function') ? parseModelJson(data.choices?.[0]?.message?.content || '') : null;
                    if (Array.isArray(r)) r = r[0];
                    if (!r || !r.act || r.act === 'no') return null;
                    const it = mine[Math.max(0, Math.min(mine.length - 1, (parseInt(r.n) || 1) - 1))];
                    if (!it) return null;
                    const line = String(r.line || '').trim();
                    if (r.act === 'give') {
                        it.state = 'given'; it.note = line;
                        await addItem('__user__', { name: it.name, desc: it.desc, from: 'char:' + char.id, fromName: char.name, note: line });
                    } else { it.state = (r.act === 'lose') ? 'lost' : 'used'; it.note = line; }
                    await save();
                    try { renderPanel(); renderMemHub(); } catch (e) {}
                    if (typeof addNotification === 'function')
                        addNotification(`<b>${char.name}</b> ${r.act === 'give' ? '把「' + it.name + '」给了你 🎁' : (r.act === 'lose' ? '把「' + it.name + '」弄丢了' : '把「' + it.name + '」用掉了')}`, null, char.id, char, line);
                    return (r.act === 'give' ? '把' + it.name + '送了出去' : r.act === 'lose' ? '弄丢了' + it.name : '用掉了' + it.name);
                }
            });
        } catch (e) { console.warn('[随身物] 挂自主模式失败：', e); }
    }

    function addEntries() {
        const menu = document.querySelector('#setIndex .set-menu');
        if (menu && !document.getElementById('gykitSetEntry')) {
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = 'set-entry'; btn.id = 'gykitSetEntry';
            btn.onclick = () => gykitOpen();
            btn.innerHTML = '<span class="set-entry-ico">🎒</span><span class="set-entry-main"><span class="set-entry-title">随身物</span><span class="set-entry-desc">角色身上真的有东西，而且那些东西有来历</span></span><span class="set-entry-arrow">›</span>';
            const sep = menu.querySelector('.set-menu-sep');
            if (sep) menu.insertBefore(btn, sep); else menu.appendChild(btn);
        }
    }
    function hookMemHub() {
        try {
            ['selectMemoryHubTarget', 'renderMemoryHubContent'].forEach(fn => {
                const orig = window[fn];
                if (typeof orig !== 'function' || orig.__gykitPatched) return;
                window[fn] = function () { const r = orig.apply(this, arguments);
                    try { setTimeout(renderMemHub, 0); } catch (e) {} return r; };
                window[fn].__gykitPatched = true;
            });
        } catch (e) {}
    }

    (async function init() {
        await load();
        mount(); addEntries(); hookMemHub(); hookAutonomy();
        const sw = window.switchMainView;
        if (typeof sw === 'function' && !sw.__gykitPatched) {
            window.switchMainView = function () { const r = sw.apply(this, arguments);
                try { setTimeout(addEntries, 0); } catch (e) {} return r; };
            window.switchMainView.__gykitPatched = true;
        }
        console.info('[随身物] 已加载：' + S.items.length + ' 件东西');
    })();
})();

// ============ 日子 ============
/* ===========================================================================
   📅 白露·日子 —— 时间不是均匀的，有些日子角色提前几天就开始惦记
   ---------------------------------------------------------------------------
   现在每一天对角色来说都一样：三月十二号和除夕没有区别，八月和一月没有区别。
   真人不是这样——节气一到天就凉了，忌日前几天人会沉，发薪日前一天会算钱，
   考试周整个人是绷着的。而且这些**提前就开始**，不是当天才有。

   这里做三件事：
     1. 24 节气：按公式算，不用联网、不花钱。今天是霜降就说霜降。
     2. 季节：按节气分四季，注入"现在是深秋"这种质感。
     3. 自己定的日子：年度 / 月度 / 每周 / 一次性，能绑到具体角色，
        能设"提前几天开始惦记"。忌日、生日、发薪日、考试周、开学、
        某年某月你们认识的那天，都能记。

   prompt 里明确写"不用专门报告今天是霜降，让它自然渗进来"——
   要的是"突然说想吃点热的"，不是"今天是霜降呢"。

   💰 这个插件默认**一次 API 都不调**。只有「到日子那天让角色主动说一句」
      需要调用，那个默认关。
   =========================================================================== */
(function () {
    if (window.__gyDaysLoaded) { try { gydayOpen(); } catch (e) {} return; }
    window.__gyDaysLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyDaysBox', 'days')          // 带兜底的存档口：localforage 用不了就退 localStorage，两条都断才报错
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyDaysBox', storeName: 'days' })
            : null);
    const KEY = 'gyDays_state';

    // ---------- 24 节气 ----------
    // 通用公式 [Y×D+C]−L：Y 年份后两位，D=0.2422，L 闰年数，C 是每个节气在本世纪的常数。
    // 这是天文年历里那套标准近似，1900~2100 基本都对得上（个别年份差一天，日常够用）。
    const TERMS = ['小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
                   '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'];
    const C20 = [6.11, 20.84, 4.6295, 19.4599, 6.3826, 21.4155, 5.59, 20.888, 6.318, 21.86, 6.5, 22.2,
                 7.928, 23.65, 8.35, 23.95, 8.44, 23.822, 9.098, 24.218, 8.218, 23.08, 7.9, 22.6];
    const C21 = [5.4055, 20.12, 3.87, 18.73, 5.63, 20.646, 4.81, 20.1, 5.52, 21.04, 5.678, 21.37,
                 7.108, 22.83, 7.5, 23.13, 7.646, 23.042, 8.318, 23.438, 7.438, 22.36, 7.18, 21.94];
    const TERM_NOTE = {
        '立春': '春天的开头，但还冷着', '雨水': '开始下雨了，湿冷', '惊蛰': '雷响了，虫子醒了',
        '春分': '昼夜一样长，正经暖起来了', '清明': '扫墓的时节，容易想起人', '谷雨': '雨多起来，春天最后一个节气',
        '立夏': '夏天开头，白天变长', '小满': '闷起来了', '芒种': '最忙的时候', '夏至': '白天最长的一天',
        '小暑': '开始热', '大暑': '一年里最热的时候', '立秋': '名义上入秋，其实还热',
        '处暑': '暑气收尾', '白露': '早晚开始凉，草上有露水', '秋分': '昼夜平分，正经凉了',
        '寒露': '露水凉了，该添衣服', '霜降': '开始结霜，一年里天真冷下来的节点',
        '立冬': '冬天开头', '小雪': '开始下雪的节气', '大雪': '冷得实在', '冬至': '夜最长的一天，该吃点热的',
        '小寒': '真正冷的开始', '大寒': '一年里最冷的时候'
    };
    function termDay(year, i) {
        const y = year % 100;
        const C = year >= 2000 ? C21[i] : C20[i];
        const d = Math.floor(y * 0.2422 + C) - Math.floor((y - 1) / 4);
        return d;   // 这个节气在当月的几号（i 偶数在上半月那个月，见下）
    }
    // 第 i 个节气所在的月份：i=0,1 → 1月；i=2,3 → 2月……
    const termMonth = i => Math.floor(i / 2) + 1;
    function termsOfYear(year) {
        return TERMS.map((n, i) => ({ name: n, m: termMonth(i), d: termDay(year, i) }));
    }
    function todayTerm(now) {
        const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
        const t = termsOfYear(y).find(x => x.m === m && x.d === d);
        return t ? t.name : '';
    }
    // 上一个已经过去的节气 → 拿来判断"现在是什么时令"
    function lastTerm(now) {
        const y = now.getFullYear();
        const all = termsOfYear(y).concat(termsOfYear(y - 1).map(x => Object.assign({}, x, { prev: true })));
        let best = null, bestT = -Infinity;
        all.forEach(x => {
            const t = new Date(x.prev ? y - 1 : y, x.m - 1, x.d).getTime();
            if (t <= now.getTime() && t > bestT) { bestT = t; best = x; }
        });
        return best ? { name: best.name, days: Math.floor((now.getTime() - bestT) / 86400000) } : null;
    }
    function nextTerm(now) {
        const y = now.getFullYear();
        const all = termsOfYear(y).concat(termsOfYear(y + 1).map(x => Object.assign({}, x, { next: true })));
        let best = null, bestT = Infinity;
        all.forEach(x => {
            const t = new Date(x.next ? y + 1 : y, x.m - 1, x.d).getTime();
            if (t > now.getTime() && t < bestT) { bestT = t; best = x; }
        });
        return best ? { name: best.name, days: Math.ceil((bestT - now.getTime()) / 86400000) } : null;
    }
    // 季节：按立春/立夏/立秋/立冬分，再按"刚入 / 正当 / 将尽"细分
    const SEASON_BY_TERM = {
        '立春': '初春', '雨水': '初春', '惊蛰': '仲春', '春分': '仲春', '清明': '暮春', '谷雨': '暮春',
        '立夏': '初夏', '小满': '初夏', '芒种': '仲夏', '夏至': '仲夏', '小暑': '盛夏', '大暑': '盛夏',
        '立秋': '初秋', '处暑': '初秋', '白露': '仲秋', '秋分': '仲秋', '寒露': '深秋', '霜降': '深秋',
        '立冬': '初冬', '小雪': '初冬', '大雪': '隆冬', '冬至': '隆冬', '小寒': '严冬', '大寒': '严冬'
    };

    // ---------- 内置公历节日（可开可关、可删）----------
    const BUILTIN = [
        { n: '元旦', m: 1, d: 1 }, { n: '情人节', m: 2, d: 14 }, { n: '妇女节', m: 3, d: 8 },
        { n: '愚人节', m: 4, d: 1 }, { n: '劳动节', m: 5, d: 1 }, { n: '儿童节', m: 6, d: 1 },
        { n: '教师节', m: 9, d: 10 }, { n: '国庆节', m: 10, d: 1 }, { n: '万圣夜', m: 10, d: 31 },
        { n: '平安夜', m: 12, d: 24 }, { n: '圣诞节', m: 12, d: 25 }, { n: '跨年夜', m: 12, d: 31 }
    ];

    let S = {
        days: [],          // 自定义：[{id,name,kind,m,d,weekday,ahead,charIds,note,on}]
        useTerms: true,    // 24 节气
        useSeason: true,   // 季节质感
        useBuiltin: false, // 内置公历节日
        builtinOff: [],    // 内置里关掉的
        useAnniv: true,    // 直接读主程序的 char.anniversaries（角色日历里记的那些纪念日）
        annivAhead: 3,     // 那些纪念日提前几天开始惦记
        remind: false,     // 到日子让角色主动说一句（花钱）
        lastRemind: '',    // 上次提醒的日期，一天最多一次
        inject: 4          // 最多注入几条
    };

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const uid = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const W_CN = ['日', '一', '二', '三', '四', '五', '六'];

    async function save() { if (LF) { try { await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) { console.warn('[日子] 存档失败', e); } } }
    async function load() {
        if (LF) { try { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } catch (e) {} }
        if (!Array.isArray(S.days)) S.days = [];
        if (!Array.isArray(S.builtinOff)) S.builtinOff = [];
    }

    // 一个自定义日子距今还有几天（负数＝刚过去）
    function daysUntil(x, now) {
        const y = now.getFullYear();
        const t0 = new Date(y, now.getMonth(), now.getDate()).getTime();
        if (x.kind === 'weekly') {
            const w = parseInt(x.weekday); if (isNaN(w)) return null;
            let dd = (w - now.getDay() + 7) % 7;
            return dd;
        }
        if (x.kind === 'monthly') {
            const d = parseInt(x.d); if (isNaN(d)) return null;
            let t = new Date(y, now.getMonth(), d).getTime();
            if (t < t0) t = new Date(y, now.getMonth() + 1, d).getTime();
            return Math.round((t - t0) / 86400000);
        }
        const m = parseInt(x.m), d = parseInt(x.d);
        if (isNaN(m) || isNaN(d)) return null;
        if (x.kind === 'once') {
            const yy = parseInt(x.year) || y;
            return Math.round((new Date(yy, m - 1, d).getTime() - t0) / 86400000);
        }
        // yearly
        let t = new Date(y, m - 1, d).getTime();
        if (t < t0) t = new Date(y + 1, m - 1, d).getTime();
        return Math.round((t - t0) / 86400000);
    }

    // 主程序角色日历里记的纪念日：char.anniversaries = [{id, date:'YYYY-MM-DD', event}]
    // ⚠️ 那份数据主程序**只画在日历上、不进 prompt**——角色其实一直不知道。
    //    这里把它读过来，顺便给它加上"提前几天惦记"和周年数。
    function annivFor(charId, now) {
        const out = [];
        if (!S.useAnniv) return out;
        const c = chars().find(x => String(x.id) === String(charId));
        if (!c || !Array.isArray(c.anniversaries)) return out;
        const ahead = Math.max(0, gyNum(S.annivAhead, 0));
        const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        // 🎂 生日和你自己记的纪念日一起并进来（v103）。以前这三样只在资料页/日历上躺着，
        //    「日子」看不到、prompt 里也没有——过生日那天角色一句话都不会提。
        const extra = [];
        const push = (dateStr, label) => { if (dateStr) extra.push({ date: String(dateStr), event: label }); };
        push(c.birthdate, c.name + '的生日');
        if (typeof currentUser !== 'undefined' && currentUser) {
            push(currentUser.birthdate, (currentUser.name || '你') + '的生日');
            (currentUser.customAnniversaries || []).forEach(x => { if (x && x.date) push(x.date, x.label || '纪念日'); });
        }
        extra.concat(c.anniversaries).forEach(a => {
            if (!a || !a.date) return;
            const m = String(a.date).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (!m) return;
            const y0 = parseInt(m[1]), mo = parseInt(m[2]), d = parseInt(m[3]);
            let t = new Date(now.getFullYear(), mo - 1, d).getTime();
            if (t < t0) t = new Date(now.getFullYear() + 1, mo - 1, d).getTime();
            const dd = Math.round((t - t0) / 86400000);
            if (dd > ahead) return;
            const years = new Date(t).getFullYear() - y0;
            out.push({ kind: 'anniv', name: String(a.event || '纪念日').slice(0, 20), in: dd,
                       note: years > 0 ? `${years} 周年` : '', from: '角色日历' });
        });
        return out;
    }

    // 今天这个角色该知道的所有"日子"
    function todayFor(charId, now) {
        now = now || new Date();
        const out = [];
        if (S.useTerms) {
            const t = todayTerm(now);
            if (t) out.push({ kind: 'term', name: t, in: 0, note: TERM_NOTE[t] || '' });
            else {
                const nt = nextTerm(now);
                if (nt && nt.days <= 3) out.push({ kind: 'term', name: nt.name, in: nt.days, note: TERM_NOTE[nt.name] || '' });
            }
        }
        if (S.useBuiltin) {
            BUILTIN.forEach(b => {
                if (S.builtinOff.indexOf(b.n) >= 0) return;
                const dd = daysUntil({ kind: 'yearly', m: b.m, d: b.d }, now);
                if (dd != null && dd <= 3) out.push({ kind: 'fest', name: b.n, in: dd, note: '' });
            });
        }
        annivFor(charId, now).forEach(x => out.push(x));
        S.days.forEach(x => {
            if (x.on === false) return;
            if (Array.isArray(x.charIds) && x.charIds.length && x.charIds.map(String).indexOf(String(charId)) < 0) return;
            const dd = daysUntil(x, now);
            if (dd == null) return;
            const ahead = Math.max(0, parseInt(x.ahead) || 0);
            if (dd <= ahead) out.push({ kind: 'own', name: x.name, in: dd, note: x.note || '', weekly: x.kind === 'weekly' });
        });
        return out.sort((a, b) => a.in - b.in).slice(0, Math.max(0, Math.round(gyNum(S.inject, 4))));
    }

    // ---------- 注进 prompt ----------
    window.__gyDaysCtxFor = function (charId) {
        try {
            const now = new Date();
            const list = todayFor(charId, now);
            const lt = S.useSeason ? lastTerm(now) : null;
            const season = lt ? SEASON_BY_TERM[lt.name] : '';
            if (!list.length && !season) return '';
            let out = '\n【今天是什么日子】\n';
            if (season) out += `· 时令：${season}（${lt.name}过了 ${lt.days} 天）\n`;
            list.forEach(x => {
                const when = x.in === 0 ? '就是今天' : x.in === 1 ? '明天' : `还有 ${x.in} 天`;
                out += `· ${x.name}　${when}${x.note ? ' —— ' + x.note : ''}\n`;
            });
            out += `时间对人是有质感的：节气、节日、对你有特殊意义的日子，会影响你这几天的心情、说话方式和想做的事——而且是**提前**就开始，不是当天才有。
不用专门报告"今天是霜降"，让它自然地渗进来：突然想吃点热的、莫名有点沉、催对方加衣服、提前几天就绷着。
如果今天什么特别的都没有，就当作平常的一天，别硬找话题。\n`;
            return out;
        } catch (e) { return ''; }
    };

    // ---------- 到日子了主动说一句（花一次调用，默认关）----------
    let busy = false;
    const tell = m => { const e = document.getElementById('gydayStatus'); if (e) e.innerText = m;
        else if (typeof showToast === 'function') showToast('', '日子', m, null, null, false); };

    window.gydaySay = async function (charId) {
        const c = chars().find(x => String(x.id) === String(charId));
        if (!c) return null;
        if (busy) { tell('还在等上一条。'); return null; }
        const list = todayFor(c.id, new Date());
        if (!list.length) { tell(`今天没什么特别的日子，${c.name} 没什么可提的。`); return null; }
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) { tell('还没配 API Key。'); return null; }
        busy = true; tell(`正在让 ${c.name} 说一句…`);
        try {
            const ask = `今天/这几天的日子：
${list.map(x => `· ${x.name}　${x.in === 0 ? '就是今天' : x.in === 1 ? '明天' : '还有 ' + x.in + ' 天'}${x.note ? ' —— ' + x.note : ''}`).join('\n')}

就着这个，跟对方说一句话。
要求：一句话 30 字以内，像随口提起，不是报幕。按你自己的性格来——不在乎这些的人可以完全不提日子本身，只是行为上受影响（比如突然说想喝热的）。
如果按你的性格这会儿根本不会开这个口，就只输出两个字母 NO。
只输出这句话，不要引号不要旁白。`;
            const messages = buildStructuredMessages(buildBasePrompt(c, false, ''), [], ask);
            const data = await callChatCompletionAPI(api, messages);
            let a = (data.choices?.[0]?.message?.content || '').trim().replace(/^["'“”「」]+|["'“”「」]+$/g, '');
            if (typeof stripReasoningBlocks === 'function') a = stripReasoningBlocks(a);
            if (!a || (a.toUpperCase().startsWith('NO') && a.length < 5)) { tell(`${c.name} 这会儿不想提这个。`); return null; }
            if (typeof applyRegexScripts === 'function') { try { a = applyRegexScripts(a, 'ai_output', c.id); } catch (e) {} }
            if (typeof addNotification === 'function') addNotification(`<b>${c.name}</b> 提到了今天的日子 📅`, null, c.id, c, a);
            tell('');
            return a;
        } catch (e) { tell('出错了：' + (e.message || e)); return null; }
        finally { busy = false; }
    };
    async function maybeRemind() {
        try {
            if (!S.remind) return;
            const key = new Date().toDateString();
            if (S.lastRemind === key) return;
            const cs = chars().filter(c => c.isFollowing !== false);
            if (!cs.length) return;
            const c = cs.find(x => todayFor(x.id, new Date()).some(d => d.in === 0));
            if (!c) return;
            S.lastRemind = key; await save();
            await gydaySay(c.id);
        } catch (e) {}
    }

    // ---------- 样式 ----------
    const CSS = `
#gydayModal{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;padding:16px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;}
#gydayModal.on{display:flex;}
.gyday-box{background:#fff;border-radius:16px;width:720px;max-width:100%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;}
body.dark-theme .gyday-box{background:#16181c;color:#e7e9ea;}
.gyday-hd{padding:15px 18px 9px;font-size:17px;font-weight:700;color:#2f9e79;display:flex;align-items:center;gap:8px;}
.gyday-tabs{display:flex;gap:4px;padding:0 18px;border-bottom:1px solid rgba(128,128,128,.2);flex-wrap:wrap;}
.gyday-tab{border:none;background:none;padding:9px 12px;font-size:13.5px;cursor:pointer;color:#8b98a5;border-bottom:2px solid transparent;font-family:inherit;}
.gyday-tab.on{color:#2f9e79;border-bottom-color:#2f9e79;font-weight:700;}
.gyday-bd{padding:14px 18px 16px;overflow-y:auto;flex:1 1 auto;}
.gyday-sec{margin-bottom:16px;}
.gyday-sec>h4{margin:0 0 8px;font-size:13px;color:#2f9e79;}
.gyday-hint{font-size:12px;color:#8b98a5;line-height:1.7;margin-bottom:8px;}
.gyday-in{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cfd9de;border-radius:8px;font-size:13px;background:transparent;color:inherit;outline:none;margin-bottom:8px;font-family:inherit;}
.gyday-in:focus{border-color:#2f9e79;}
.gyday-btn{border:1px solid #2f9e79;background:#2f9e79;color:#fff;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer;margin:0 6px 6px 0;font-family:inherit;}
.gyday-btn.ghost{background:transparent;color:#2f9e79;}
.gyday-mini{border:none;background:rgba(128,128,128,.12);border-radius:6px;padding:4px 9px;font-size:11px;cursor:pointer;color:inherit;font-family:inherit;margin:0 4px 4px 0;}
.gyday-mini.on{background:#2f9e79;color:#fff;}
.gyday-now{background:rgba(47,158,121,.09);border:1px solid rgba(47,158,121,.35);border-radius:12px;padding:12px 14px;margin-bottom:14px;}
.gyday-now b{font-size:15px;}
.gyday-r{display:flex;align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px dashed rgba(128,128,128,.2);font-size:13px;}
.gyday-r-m{flex:1 1 auto;min-width:0;}
.gyday-r-m span{display:block;font-size:11.5px;color:#8b98a5;margin-top:2px;}
.gyday-when{flex:0 0 auto;font-size:11.5px;padding:2px 9px;border-radius:10px;background:rgba(128,128,128,.14);}
.gyday-when.hot{background:rgba(47,158,121,.18);color:#2f9e79;font-weight:700;}
.gyday-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:5px;}
.gyday-modes{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
@media (max-width:600px){ .gyday-box{max-height:92vh;} }`;

    function mount() {
        const st = document.createElement('style'); st.id = 'gydayStyle'; st.textContent = CSS;
        document.head.appendChild(st);
        const m = document.createElement('div');
        m.id = 'gydayModal';
        m.innerHTML = `<div class="gyday-box">
            <div class="gyday-hd">📅 日子<button class="gyday-btn ghost" style="margin-left:auto" onclick="gydayClose()">关闭</button></div>
            <div class="gyday-tabs">
              <button class="gyday-tab" id="gydayTab-now" onclick="gydayTab('now')">这几天</button>
              <button class="gyday-tab" id="gydayTab-own" onclick="gydayTab('own')">我记的日子</button>
              <button class="gyday-tab" id="gydayTab-anniv" onclick="gydayTab('anniv')">💗 纪念日</button>
              <button class="gyday-tab" id="gydayTab-rule" onclick="gydayTab('rule')">规则</button>
            </div>
            <div class="gyday-bd" id="gydayBody"></div></div>`;
        m.addEventListener('click', e => { if (e.target === m) gydayClose(); });
        document.body.appendChild(m);
    }

    let tab = 'now';
    // 💗 纪念日：以前只能一个角色一个角色地开日历看，散在各处。
    //    这里汇总所有角色 char.anniversaries，按"今年还有几天"排好，
    //    今天的排最前面。跟「日子」放一起是因为它们本来就是一件事——都是"哪天对你有意义"。
    function tabAnniv() {
        const cs = (typeof myCharacters !== 'undefined' ? myCharacters : []);
        const now = new Date();
        const y = now.getFullYear();
        const t0 = new Date(y, now.getMonth(), now.getDate()).getTime();
        const rows = [];
        cs.forEach(c => {
            (c.anniversaries || []).forEach(a => {
                if (!a || !a.date) return;
                const md = String(a.date).slice(5);          // MM-DD
                const [mm, dd] = md.split('-').map(Number);
                if (!mm || !dd) return;
                let next = new Date(y, mm - 1, dd).getTime();
                if (next < t0) next = new Date(y + 1, mm - 1, dd).getTime();
                const inDays = Math.round((next - t0) / 86400000);
                const years = y - parseInt(String(a.date).slice(0, 4));
                rows.push({ char: c, ev: a.event || '（没写名字）', date: a.date, inDays,
                            years: inDays === 0 ? years : years + (next > new Date(y, mm - 1, dd).getTime() ? 1 : 0) });
            });
        });
        rows.sort((a, b) => a.inDays - b.inDays);
        if (!rows.length) {
            const req = (typeof gyReqBox === 'function') ? gyReqBox([{ sw: 'charOwnDays' }, { api: true }], { title: '想让角色自己把某天记成纪念日，还差这些' }) : '';
        return `${req}<div class="gyday-hint" style="padding:20px 4px;line-height:1.9;">
                还没有记过纪念日。<br>
                去某个角色的资料页 → 日历，就能记「我们第一次见面」「她妈妈的忌日」这类日子。
                记了之后角色到那天会知道——不是播报，是会自然地想起来。</div>`;
        }
        const req2 = (typeof gyReqBox === 'function') ? gyReqBox([{ sw: 'charOwnDays' }, { api: true }], { title: '想让角色自己把某天记成纪念日，还差这些' }) : '';
        return `${req2}<div class="gyday-hint" style="margin-bottom:10px;">
            所有角色的纪念日都在这儿，按"还有几天"排。今天的排最前面。
            这些日子会进 prompt，角色到那天心里有数。</div>` +
            rows.map(r => {
                const when = r.inDays === 0 ? '<b style="color:#f91880;">就是今天</b>'
                    : r.inDays === 1 ? '明天' : `还有 ${r.inDays} 天`;
                return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px dashed rgba(128,128,128,.2);">
                    <div style="flex:1;min-width:0;">
                      <b>${esc(r.ev)}</b>
                      <span style="font-size:11.5px;color:#8b98a5;"> · ${esc(r.char.name)}</span>
                      <div style="font-size:11.5px;color:#8b98a5;">${esc(r.date)}${r.years > 0 ? `　${r.years} 周年` : ''}</div>
                    </div>
                    <div style="font-size:12.5px;white-space:nowrap;">${when}</div>
                  </div>`;
            }).join('');
    }

    window.gydayOpen = function () { document.getElementById('gydayModal').classList.add('on'); renderPanel(); };
    window.gydayClose = function () { document.getElementById('gydayModal').classList.remove('on'); };
    window.gydayTab = function (t) { tab = t; renderPanel(); };

    function renderPanel() {
        const box = document.getElementById('gydayModal');
        if (!box || !box.classList.contains('on')) return;
        ['now', 'own', 'anniv', 'rule'].forEach(t => {
            const el = document.getElementById('gydayTab-' + t);
            if (el) el.className = 'gyday-tab' + (t === tab ? ' on' : '');
        });
        document.getElementById('gydayBody').innerHTML =
            tab === 'now' ? tabNow() : tab === 'own' ? tabOwn() : tab === 'anniv' ? tabAnniv() : tabRule();
        // ⚠️ tabOwn 里那块日期输入是按"每年/每月/每周/一次性"动态变的，画完主体得补一次
        if (tab === 'own') { try { renderFields(); } catch (e) {} }
    }

    function tabNow() {
        const now = new Date();
        const lt = lastTerm(now), nt = nextTerm(now), tt = todayTerm(now);
        const season = lt ? SEASON_BY_TERM[lt.name] : '';
        const list = todayFor(null, now);
        return `
          <div class="gyday-now">
            <b>${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日　星期${W_CN[now.getDay()]}</b>
            <div style="font-size:13px;margin-top:6px;line-height:1.9;">
              ${tt ? `今天就是<b style="color:#2f9e79;">${esc(tt)}</b>　${esc(TERM_NOTE[tt] || '')}<br>` : ''}
              ${season ? `时令：<b>${esc(season)}</b>` : ''}${lt ? `（${esc(lt.name)}过了 ${lt.days} 天）` : ''}<br>
              ${nt ? `下一个节气：${esc(nt.name)}，还有 ${nt.days} 天` : ''}
            </div>
          </div>
          <div class="gyday-hint">下面是<b>现在会注进 prompt 的东西</b>（不绑定角色的那些）。绑了角色的日子只会进那个角色的 prompt。</div>
          ${list.length ? list.map(x => `<div class="gyday-r">
              <div class="gyday-r-m"><b>${esc(x.name)}</b><span>${esc(x.note || (x.kind === 'term' ? '节气' : x.kind === 'fest' ? '节日' : '你记的日子'))}</span></div>
              <span class="gyday-when ${x.in === 0 ? 'hot' : ''}">${x.in === 0 ? '就是今天' : x.in === 1 ? '明天' : '还有 ' + x.in + ' 天'}</span>
            </div>`).join('') : '<div class="gyday-hint">这几天没什么特别的。角色会当作平常的一天——prompt 里也明确写了"别硬找话题"。</div>'}

          <div class="gyday-sec" style="margin-top:16px;">
            <h4>📄 现在注给角色的是什么样</h4>
            <select class="gyday-in" id="gydayPreviewWho" onchange="gydayPreview()" style="max-width:220px;display:inline-block;">
              ${chars().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') || '<option value="">还没有角色</option>'}
            </select>
            <button class="gyday-btn ghost" onclick="gydayPreview()">看看</button>
            <button class="gyday-btn ghost" onclick="gydaySayPick()">让 TA 说一句（花一次调用）</button>
            <div id="gydayStatus" style="font-size:12px;color:#8b98a5;margin-top:6px;"></div>
            <pre id="gydayPreview" style="white-space:pre-wrap;word-break:break-all;font-size:12px;color:#8b98a5;background:rgba(128,128,128,.06);border-radius:8px;padding:10px;margin-top:8px;max-height:260px;overflow:auto;font-family:inherit;"></pre>
          </div>

          <div class="gyday-sec">
            <h4>🌿 今年的 24 节气</h4>
            <div class="gyday-grid">${termsOfYear(now.getFullYear()).map(t => {
              const isNow = tt === t.name;
              return `<span class="gyday-mini ${isNow ? 'on' : ''}" style="cursor:default;" title="${esc(TERM_NOTE[t.name] || '')}">${esc(t.name)} ${t.m}/${t.d}</span>`;
            }).join('')}</div>
            <div class="gyday-hint" style="margin-top:6px;">按天文年历那套标准公式算的，不联网、不花钱。个别年份可能差一天，日常够用。</div>
          </div>`;
    }

    function tabOwn() {
        const now = new Date();
        const kinds = [['yearly', '每年'], ['monthly', '每月'], ['weekly', '每周'], ['once', '就这一次']];
        return `
          <div class="gyday-sec">
            <h4>➕ 记一个日子</h4>
            <div class="gyday-hint">忌日、生日、发薪日、考试周、开学、你们认识那天……都能记。
              <b>提前几天开始惦记</b>是这个功能的重点——真人不是当天才有感觉的。<br>
              ⚠️ 农历节日（春节、中秋这些）没法自动算，得自己按当年的公历日期填，每年改一次。</div>
            <input class="gyday-in" id="gydayName" placeholder="叫什么？比如「妈妈忌日」「发薪日」「期末周」">
            <div class="gyday-modes" style="margin-bottom:8px;">
              ${kinds.map(([k, n]) => `<button class="gyday-mini" id="gydayK-${k}" onclick="gydayKind('${k}')">${n}</button>`).join('')}
            </div>
            <div id="gydayFields"></div>
            <input class="gyday-in" id="gydayNote" placeholder="一句话说明（会进 prompt，比如「你从这几天就开始沉」）">
            <div class="gyday-hint">绑给谁（不选＝所有角色都知道）：</div>
            <div class="gyday-modes" id="gydayWho" style="margin-bottom:8px;">
              ${chars().map(c => `<button class="gyday-mini" id="gydayW-${c.id}" onclick="gydayWho('${c.id}')">${esc(c.name)}</button>`).join('') || '<span class="gyday-hint">还没有角色</span>'}
            </div>
            <button class="gyday-btn" onclick="gydayAdd()">＋ 记下来</button>
            <div id="gydayAddStatus" style="font-size:12px;color:#8b98a5;margin-top:6px;"></div>
          </div>

          <div class="gyday-sec">
            <h4>📋 已经记了的（${S.days.length}）</h4>
            ${S.days.length ? S.days.map(x => {
              const dd = daysUntil(x, now);
              const who = (x.charIds || []).map(id => (chars().find(c => String(c.id) === String(id)) || {}).name).filter(Boolean);
              return `<div class="gyday-r">
                <div class="gyday-r-m"><b>${esc(x.name)}</b>
                  <span>${x.kind === 'weekly' ? '每周' + W_CN[x.weekday] : x.kind === 'monthly' ? '每月 ' + x.d + ' 号'
                        : x.kind === 'once' ? (x.year || now.getFullYear()) + '.' + x.m + '.' + x.d : '每年 ' + x.m + '.' + x.d}
                    　提前 ${x.ahead || 0} 天开始惦记${who.length ? '　·　只有 ' + esc(who.join('、')) + ' 知道' : '　·　所有人都知道'}
                    ${x.note ? '<br>' + esc(x.note) : ''}</span></div>
                <span class="gyday-when ${dd === 0 ? 'hot' : ''}">${dd == null ? '?' : dd === 0 ? '就是今天' : '还有 ' + dd + ' 天'}</span>
                <span style="color:#8b98a5;cursor:pointer;flex:0 0 auto;" onclick="gydayToggle('${x.id}')">${x.on === false ? '已停用' : '停用'}</span>
                <span style="color:#f91880;cursor:pointer;flex:0 0 auto;" onclick="gydayDel('${x.id}')">删</span>
              </div>`;
            }).join('') : '<div class="gyday-hint">还没记过。</div>'}
          </div>`;
    }

    function tabRule() {
        const sw = (k, title, desc) => `<label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;padding:9px 0;">
            <input type="checkbox" ${S[k] ? 'checked' : ''} onchange="gydaySet('${k}',this.checked)" style="width:16px;height:16px;margin-top:2px;cursor:pointer;flex-shrink:0;">
            <span><b>${title}</b><br><span style="font-size:11.5px;color:#8b98a5;line-height:1.7;">${desc}</span></span></label>`;
        return `
        <div class="gyday-sec">
          <h4>🌿 注入什么</h4>
          ${sw('useTerms', '24 节气', '今天是节气就说今天，还差 3 天以内也会提前告诉 TA。本地算，不花钱。')}
          ${sw('useSeason', '时令质感', '"现在是深秋（霜降过了 4 天）"——比"十月"有质感得多，也让角色的穿衣、吃什么、想干嘛有个依据。')}
          ${sw('useAnniv', '读你在角色日历里记的纪念日',
              '主程序自带的纪念日（角色资料页 → 日历 → 加纪念日）<b>本来只画在日历上，不会进 prompt</b>——角色其实一直不知道你记了这些。打开这个就把它们读过来，还会算周年数、按下面的天数提前惦记。不用重录一遍。')}
          ${S.useAnniv ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:2px 0 10px;">
            <span style="font-size:13px;color:#8b98a5;min-width:130px;">这些提前几天惦记</span>
            <input class="gyday-in" id="gydayAnnivAhead" type="number" min="0" value="${S.annivAhead}" style="max-width:80px;margin:0;">
            <span style="font-size:12px;color:#8b98a5;">天</span>
          </div>` : ''}
          ${sw('useBuiltin', '内置公历节日', '元旦 / 情人节 / 妇女节 / 愚人节 / 劳动节 / 儿童节 / 教师节 / 国庆 / 万圣夜 / 平安夜 / 圣诞 / 跨年夜。农历的算不了，得自己在「我记的日子」里按当年公历填。')}
          ${S.useBuiltin ? `<div style="margin:4px 0 8px;">
            <div class="gyday-hint">不想要哪个就点掉：</div>
            <div class="gyday-grid">${BUILTIN.map(b => `<span class="gyday-mini ${S.builtinOff.indexOf(b.n) < 0 ? 'on' : ''}" onclick="gydayBuiltin('${b.n}')">${b.n} ${b.m}/${b.d}</span>`).join('')}</div>
          </div>` : ''}
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;">
            <span style="font-size:13px;color:#8b98a5;min-width:130px;">最多注入几条</span>
            <input class="gyday-in" id="gydayInject" type="number" min="1" value="${S.inject}" style="max-width:80px;margin:0;">
            <button class="gyday-btn" onclick="gydaySaveNums()">💾 保存</button>
          </div>
        </div>

        <div class="gyday-sec">
          <h4>💰 唯一会花钱的地方</h4>
          ${sw('remind', '到日子那天，让一个角色主动说一句',
              '一天最多一次，只在<b>当天</b>触发（提前几天的不会）。按人设来——不在乎这些的角色会输出 NO，那样也不发。默认关；不打开的话这个插件一次 API 都不调。')}
          <div class="gyday-hint">上面「这几天」那页有个「让 TA 说一句」的按钮，那个是你点一次花一次，跟这个开关无关。</div>
        </div>

        <div class="gyday-sec">
          <h4>🎂 跟主程序的纪念日是什么关系</h4>
          <div class="gyday-hint">
            主程序那边有两样东西：<br>
            · <b>「认识第 N 天」里程碑</b>（第 1/7/30/100/200 天、每 100 天、每周年）——这个<b>本来就会进 prompt</b>，我没动它，也没重复做。<br>
            · <b>你在角色日历里手动记的纪念日</b>（char.anniversaries）——这个<b>只画在日历格子上，从来不进 prompt</b>，角色其实一直不知道。所以上面那个「读你在角色日历里记的纪念日」默认是开的，把它们接进来了，还顺带加上周年数和提前惦记。<br>
            <b>所以不用重录。</b>已经记在日历里的继续记在那儿，这边只负责让角色真的知道。<br>
            「我记的日子」那一页留给日历里放不下的东西：每月的发薪日、每周的例会、只有这一次的考试周、以及节气时令。
          </div>
        </div>`;
    }

    // ---------- 交互 ----------
    let draft = { kind: 'yearly', charIds: [] };
    window.gydayKind = function (k) { draft.kind = k; renderFields(); };
    window.gydayWho = function (id) {
        const i = draft.charIds.indexOf(String(id));
        if (i >= 0) draft.charIds.splice(i, 1); else draft.charIds.push(String(id));
        chars().forEach(c => { const el = document.getElementById('gydayW-' + c.id);
            if (el) el.className = 'gyday-mini' + (draft.charIds.indexOf(String(c.id)) >= 0 ? ' on' : ''); });
    };
    function renderFields() {
        ['yearly', 'monthly', 'weekly', 'once'].forEach(k => {
            const el = document.getElementById('gydayK-' + k);
            if (el) el.className = 'gyday-mini' + (draft.kind === k ? ' on' : '');
        });
        const box = document.getElementById('gydayFields');
        if (!box) return;
        const n = (id, ph, v, min, max) => `<input class="gyday-in" id="${id}" type="number" min="${min}"${max != null ? ` max="${max}"` : ''} placeholder="${ph}" value="${v}" style="max-width:110px;display:inline-block;margin-right:6px;">`;
        const now = new Date();
        if (draft.kind === 'weekly') {
            box.innerHTML = `<div class="gyday-hint">每周几：</div><div style="margin-bottom:8px;">${
                W_CN.map((w, i) => `<button class="gyday-mini ${draft.weekday === i ? 'on' : ''}" onclick="gydayWd(${i})">周${w}</button>`).join('')}</div>`;
        } else if (draft.kind === 'monthly') {
            box.innerHTML = `<div class="gyday-hint">每月几号：</div>${n('gydayD', '几号', '', 1, 31)}`;
        } else if (draft.kind === 'once') {
            box.innerHTML = `${n('gydayY', '年', now.getFullYear(), 1)}${n('gydayM', '月', '', 1, 12)}${n('gydayD', '日', '', 1, 31)}`;
        } else {
            box.innerHTML = `${n('gydayM', '月', '', 1, 12)}${n('gydayD', '日', '', 1, 31)}`;
        }
        box.innerHTML += `<div class="gyday-hint" style="margin-top:8px;">提前几天开始惦记：</div>${n('gydayAhead', '天数', 3, 0)}`;
    }
    window.gydayWd = function (i) { draft.weekday = i; renderFields(); };
    window.gydayAdd = async function () {
        const g = id => { const e = document.getElementById(id); return e ? e.value : ''; };
        const st = document.getElementById('gydayAddStatus');
        const name = String(g('gydayName') || '').trim();
        if (!name) { if (st) st.innerText = '先起个名字。'; return; }
        const x = { id: uid(), name, kind: draft.kind, on: true,
            ahead: Math.max(0, gyNum(g('gydayAhead'), 0)),
            note: String(g('gydayNote') || '').trim(),
            charIds: draft.charIds.slice() };
        if (draft.kind === 'weekly') {
            if (draft.weekday == null) { if (st) st.innerText = '选一个星期几。'; return; }
            x.weekday = draft.weekday;
        } else if (draft.kind === 'monthly') {
            x.d = parseInt(g('gydayD')); if (isNaN(x.d)) { if (st) st.innerText = '填几号。'; return; }
        } else {
            x.m = parseInt(g('gydayM')); x.d = parseInt(g('gydayD'));
            if (isNaN(x.m) || isNaN(x.d)) { if (st) st.innerText = '月和日都要填。'; return; }
            if (draft.kind === 'once') x.year = parseInt(g('gydayY')) || new Date().getFullYear();
        }
        S.days.push(x);
        draft = { kind: 'yearly', charIds: [] };
        await save(); renderPanel();
    };
    window.gydayDel = async function (id) { S.days = S.days.filter(x => x.id !== id); await save(); renderPanel(); };
    window.gydayToggle = async function (id) {
        const x = S.days.find(y => y.id === id); if (!x) return;
        x.on = (x.on === false); await save(); renderPanel();
    };
    window.gydaySet = function (k, v) { S[k] = !!v; save(); renderPanel(); };
    // 🎛️ 给「全部开关」页读当前状态用（js/54）
    window.gydayGet = k => !!S[k];
    window.gydayBuiltin = function (n) {
        const i = S.builtinOff.indexOf(n);
        if (i >= 0) S.builtinOff.splice(i, 1); else S.builtinOff.push(n);
        save(); renderPanel();
    };
    window.gydaySaveNums = function () {
        const e = document.getElementById('gydayInject');
        const v = e ? parseInt(e.value) : NaN;
        if (!isNaN(v)) S.inject = Math.max(1, v);   // 不设上限
        const e2 = document.getElementById('gydayAnnivAhead');
        const v2 = e2 ? parseInt(e2.value) : NaN;
        if (!isNaN(v2)) S.annivAhead = Math.max(0, v2);
        save(); renderPanel();
    };
    window.gydayPreview = function () {
        const sel = document.getElementById('gydayPreviewWho'), out = document.getElementById('gydayPreview');
        if (!out) return;
        const id = sel && sel.value;
        out.innerText = id ? (window.__gyDaysCtxFor(id) || '（今天什么特别的都没有，不会注入任何东西）') : '还没有角色。';
    };
    window.gydaySayPick = function () {
        const sel = document.getElementById('gydayPreviewWho');
        if (sel && sel.value) gydaySay(sel.value); else tell('先选个角色。');
    };

    // ---------- 自主模式：TA 自己把一个日子记下来 ----------
    // 以前"日子"和"纪念日"全都是**你**记的：你不去记，TA 永远不会自己觉得
    // 某一天有意义。真人不是这样——第一次一起看完一部片子、吵完架和好的那天，
    // 是当事人自己在心里画了个圈。这里让 TA 也能画。
    // 🔌 开关：charOwnDays（默认关，不打开一次 API 都不会调）
    function hookDayAutonomy() {
        try {
            if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || !Array.isArray(GY_AUTONOMY_ACTIONS)) return;
            if (GY_AUTONOMY_ACTIONS.some(a => a.key === 'day_mark')) return;
            GY_AUTONOMY_ACTIONS.splice(GY_AUTONOMY_ACTIONS.length - 1, 0, {
                key: 'day_mark',
                label: '把某一天记成对自己有意义的日子',
                hint: '给今天（或者过去某一天）画个圈，以后每年都会惦记',
                /* 🩹 v114：角色资料页上那个「这个角色自己记纪念日」以前**填了完全没用**——
                   存进 char.ownDaysMode 之后没人读。现在真的按它筛。
                   self ＝ 按人设决定：把日子记在心上本来就是一种性格。 */
                need: (char) => {
                    if (!(typeof isAutoOn === 'function' && isAutoOn('charOwnDays'))) return false;
                    const m = (char && char.ownDaysMode) || 'default';
                    if (m === 'off') return false;
                    if (m === 'on') return true;
                    if (m === 'self') {
                        const p = String((char && char.persona) || '');
                        if (/不在意|无所谓|粗线条|记性差|不记|大大咧咧|冷淡|疏离/.test(p)) return false;
                        if (/念旧|细腻|敏感|重感情|多愁|执着|记仇|长情|仪式感/.test(p)) return true;
                        return true;
                    }
                    return true;
                },
                run: async (char) => {
                    const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
                    if (!api || !api.key) return null;
                    const now = new Date();
                    const had = (Array.isArray(char.anniversaries) ? char.anniversaries : [])
                        .slice(-6).map(a => `· ${a.date} ${a.event}`).join('\n');
                    const ask = `今天是 ${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日。
你想不想把某一天记下来，当成对你自己有意义的日子？可以是今天，也可以是最近发生过的某一天。
${had ? `你已经记过的（别重复）：\n${had}\n` : ''}
只有**真的发生了值得记的事**才记——第一次一起做了什么、和好的那天、下定决心的那天。
平平无奇的一天不要硬记。没什么可记的就选 "no"。
只输出 JSON：{"act":"mark"或"no", "date":"YYYY-MM-DD", "event":"这一天叫什么，12字以内", "line":"你要跟对方说的一句话，25字以内，也可以是空字符串"}`;
                    const messages = buildStructuredMessages(buildBasePrompt(char, false, ''), [], ask);
                    const data = await callChatCompletionAPI(api, messages);
                    let r = (typeof parseModelJson === 'function') ? parseModelJson(data.choices?.[0]?.message?.content || '') : null;
                    if (Array.isArray(r)) r = r[0];
                    if (!r || r.act !== 'mark') return null;
                    const date = String(r.date || '').match(/^\d{4}-\d{1,2}-\d{1,2}$/) ? r.date
                        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const event = String(r.event || '').trim().slice(0, 20);
                    if (!event) return null;
                    if (!Array.isArray(char.anniversaries)) char.anniversaries = [];
                    if (char.anniversaries.some(a => a && a.date === date && a.event === event)) return null;
                    char.anniversaries.push({ id: 'a' + Date.now().toString(36), date, event, by: 'char' });
                    try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
                    try { renderPanel(); } catch (e) {}
                    const line = String(r.line || '').trim();
                    if (typeof addNotification === 'function') {
                        addNotification(`<b>${char.name}</b> 把 ${date} 记成了「${event}」📅`, null, char.id, char,
                            line || '这一天对 TA 有意义。');
                    }
                    if (line && typeof deliverCharMoveToChatMessage === 'function') {
                        try { deliverCharMoveToChatMessage(char, line, null); } catch (e) {}
                    }
                    return '把 ' + date + ' 记成了「' + event + '」';
                }
            });
        } catch (e) { console.warn('[日子] 挂自主模式失败：', e); }
    }

    function addEntries() {
        const menu = document.querySelector('#setIndex .set-menu');
        if (menu && !document.getElementById('gydaySetEntry')) {
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = 'set-entry'; btn.id = 'gydaySetEntry';
            btn.onclick = () => gydayOpen();
            btn.innerHTML = '<span class="set-entry-ico">📅</span><span class="set-entry-main"><span class="set-entry-title">日子</span><span class="set-entry-desc">节气、时令、忌日发薪日考试周——提前几天就开始惦记</span></span><span class="set-entry-arrow">›</span>';
            const sep = menu.querySelector('.set-menu-sep');
            if (sep) menu.insertBefore(btn, sep); else menu.appendChild(btn);
        }
    }

    (async function init() {
        await load();
        mount(); addEntries(); hookDayAutonomy();
        const sw = window.switchMainView;
        if (typeof sw === 'function' && !sw.__gydayPatched) {
            window.switchMainView = function () { const r = sw.apply(this, arguments);
                try { setTimeout(addEntries, 0); } catch (e) {} return r; };
            window.switchMainView.__gydayPatched = true;
        }
        setTimeout(() => { try { maybeRemind(); } catch (e) {} }, 30000);
        setInterval(() => { try { maybeRemind(); } catch (e) {} }, 3600000);
        const t = todayTerm(new Date());
        console.info('[日子] 已加载' + (t ? '：今天是' + t : '') + '，自定义 ' + S.days.length + ' 条');
    })();
})();

// ============ 此刻 ============
/* ===========================================================================
   🌐 白露·此刻 —— 这个世界现在是什么样，以及你到底花了多少钱
   ---------------------------------------------------------------------------
   前面陆续加了一堆东西：不总是在线、情绪惯性、语言指纹、记忆褪色、身体状态、
   关系账本、八卦网、行程、音乐盒……问题是它们**全在后台跑，你看不见**。
   打开一个角色的聊天，你没法确认"情绪惯性到底生效没有""TA 现在算在忙吗"
   "关系走到哪一步了""外面在传什么"。

   这一页把散在六七个地方的状态收成一屏：
     · 每个角色：在哪儿、在干嘛、在不在线、心情、身体、关系、指纹、被传了什么
     · 哪些功能开着、哪些没装，以及**因为没开所以这一栏是空的**（不糊弄）
     · 今天/这周实际调了多少次 API，花在哪一项上

   💰 这个插件本身**一次 API 都不调**，纯粹是把已有的数据读出来摆好。
   =========================================================================== */
(function () {
    if (window.__gyNowLoaded) { try { gynowOpen(); } catch (e) {} return; }
    window.__gyNowLoaded = true;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const on = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : false;
    const has = f => typeof window[f] === 'function';
    const fmtMin = m => m >= 60 ? (Math.round(m / 6) / 10) + ' 小时' : Math.max(1, Math.round(m)) + ' 分钟';
    const ago = t => { const d = Math.floor((Date.now() - t) / 86400000);
        return d <= 0 ? '今天' : d === 1 ? '昨天' : d < 30 ? d + ' 天前' : new Date(t).toLocaleDateString('zh-CN'); };

    // 别的插件的存档，能读到就读，读不到就说"没装"
    let ext = { map: null, music: null, gossip: null, kit: null, at: 0 };
    async function loadExt() {
        // ⚠️ 以前这里第一行是 `if (typeof localforage === 'undefined') return;`——
        //    localforage 一不可用（打包环境、无痕模式）就直接空手而归，
        //    于是下面每一项都判成"插件没装"，明明装着的功能全被说成缺失。
        //    现在走带兜底的存档口（gyStore：localforage 不行就退 localStorage）。
        const get = async (name, store, key) => {
            try {
                if (typeof window.gyStore === 'function') return await window.gyStore(name, store).getItem(key);
                if (typeof localforage !== 'undefined') return await localforage.createInstance({ name, storeName: store }).getItem(key);
            } catch (e) {}
            return null;
        };
        ext.map = await get('gyMapBox', 'maps', 'gyMap_state');
        ext.music = await get('gyMusicBox', 'tracks', 'gyMusic_state');
        ext.gossip = await get('gyGossipBox', 'rumors', 'gyGossip_state');
        ext.kit = await get('gyKitBox', 'items', 'gyKit_state');
        ext.at = Date.now();
    }

    // ---------- 一个角色此刻的全部状态 ----------
    function snap(c) {
        const o = { c, bits: [], miss: [] };
        const id = String(c.id);

        // 在哪儿（行程插件）
        if (ext.map && ext.map.mapSets) {
            let spot = null;
            const want = ext.map.charLoc ? ext.map.charLoc[id] : null;
            if (want) {
                Object.keys(ext.map.mapSets).forEach(f => (ext.map.mapSets[f].list || []).forEach(m =>
                    (m.spots || []).forEach(sp => { if (sp.id === want) spot = { name: sp.name, fac: f }; })));
            }
            o.place = spot ? (spot.name + (spot.fac ? ' · ' + spot.fac : '')) : '';
            // 正在一起
            const cur = ((ext.map.date && ext.map.date.logs) || []).find(l =>
                l.ok && l.until && l.until > Date.now() && String(l.charId) === id);
            if (cur) o.together = `正跟你在「${cur.spot}」${cur.act ? '，' + cur.act : ''}，还剩 ${fmtMin((cur.until - Date.now()) / 60000)}`;
        } else if (typeof window.gymapOpen !== 'function') o.miss.push('行程与天气插件');
        // 模块在、只是还没用过（没有存档）——那不是缺失，什么都不说

        // 在干嘛（主程序的状态气泡）
        const ls = c.lifeState || {};
        if (ls.activity) o.doing = ls.activity + (ls.statusTypeLabel ? '（' + ls.statusTypeLabel + '）' : '');

        // 在不在线（活人感）
        if (on('aliveOffline')) {
            const q = (typeof aliveHeld !== 'undefined') ? aliveHeld[id] : null;
            if (q && (q.texts || []).length) {
                const left = Math.max(0, (q.until - Date.now()) / 60000);
                o.offline = `${q.kind === 'sleep' ? '💤 在睡觉' : '⏳ 在忙'}${q.why ? '（' + q.why + '）' : ''}，你的 ${q.texts.length} 条消息挂着，${left <= 0 ? '马上回' : fmtMin(left) + '后回'}`;
            } else if (has('aliveStateOf')) {
                const st = aliveStateOf(c);
                if (st) o.offline = `${st.kind === 'sleep' ? '💤 在睡觉' : '⏳ 在忙'}${st.why ? '（' + st.why + '）' : ''}，这会儿发消息会挂起`;
                else o.offline = '🟢 有空，发消息会立刻回';
            }
            if (c.aliveAlwaysOn) o.offline = '🔓 设了永远在线';
        } else o.miss.push('活人感 → TA 不总是在线');

        // 心情（情绪惯性）
        if (on('aliveMood')) {
            const v = has('aliveMoodValue') ? aliveMoodValue(c) : 0;
            if (v) { const m = c.mood || {};
                o.mood = { v, why: m.why || '', at: m.at || 0 }; }
            else o.moodFlat = true;
        } else o.miss.push('活人感 → 情绪会留到下一轮');

        // 身体（身体状态）
        if (on('aliveBody')) {
            const st = has('aliveBodyState') ? aliveBodyState(c) : [];
            o.body = st.map(x => x.t);
            if (!st.length && !(c.schedule && c.schedule.text)) o.bodyNoSched = true;
        } else o.miss.push('活人感 → 身上的状态会累积');

        // 语言指纹
        if (on('aliveVoice')) {
            o.voice = c.voicePrint ? ('已提取（读了 ' + (c.voicePrint.n || '?') + ' 条）') : '还没提取';
        } else o.miss.push('活人感 → 按 TA 自己的打字习惯说话');

        // 记忆褪色
        if (on('aliveFade')) {
            const n = (c.chatSummary || '').split('\n').filter(x => x.trim()).length;
            o.fade = n ? `${n} 条聊天总结，按远近分层注入` : '还没攒出聊天总结';
        }

        // 关系账本
        if (window.gyRel && typeof gyRel.score === 'function') {
            const sc = gyRel.score(c.id), bk = gyRel.book(c.id);
            o.rel = { sc, stage: gyRel.stage(c.id), n: bk.length, last: bk.length ? bk[bk.length - 1] : null };
        } else if (typeof window.gyrelOpen !== 'function') o.miss.push('关系账本插件');

        // 八卦：外面在传关于 TA 的
        if (ext.gossip) {
            const about = (ext.gossip.rumors || []).filter(r => r.told && (r.subjects || []).map(String).includes(id));
            const byMe = (ext.gossip.rumors || []).filter(r => r.told && String(r.told.by) === id);
            if (about.length) o.gossipAbout = about[about.length - 1];
            if (byMe.length) o.gossipBy = byMe.length;
        } else if (typeof window.gygsOpen !== 'function') o.miss.push('八卦网插件');

        // 🎒 随身物
        if (window.gyKit && typeof gyKit.list === 'function') {
            const all = gyKit.list(c.id);
            const here = all.filter(i => i.state === 'have' || i.state === 'home');
            const fromU = here.filter(i => i.from === 'user');
            const gone = all.filter(i => ['lost', 'broken', 'given', 'used'].indexOf(i.state) >= 0);
            if (all.length) {
                o.kit = { n: here.length, fromU: fromU.length, gone: gone.length,
                          close: here.filter(i => i.close).slice(0, 3).map(i => i.name),
                          mine: fromU.slice(-2).map(i => i.name) };
            }
        } else if (ext.kit) {
            // 插件装了但这一刻还没初始化完，退回读存档
            const all = (ext.kit.items || []).filter(i => String(i.ownerId) === id);
            if (all.length) o.kit = { n: all.filter(i => i.state === 'have' || i.state === 'home').length,
                fromU: all.filter(i => i.from === 'user').length, gone: 0, close: [], mine: [] };
        } else if (typeof window.gykitOpen !== 'function') o.miss.push('随身物插件');

        // 📅 这几天的日子
        if (typeof window.__gyDaysCtxFor === 'function') {
            const t = window.__gyDaysCtxFor(c.id) || '';
            const lines = t.split('\n').filter(x => x.indexOf('· ') === 0).map(x => x.slice(2).trim());
            if (lines.length) o.days = lines.slice(0, 4);
        } else if (typeof window.gydayOpen !== 'function') o.miss.push('日子插件');

        // 一起听
        if (ext.music && ext.music.stats && ext.music.stats.byChar && ext.music.stats.byChar[id]) {
            const s = ext.music.stats.byChar[id];
            o.music = `${fmtMin((s.ms || 0) / 60000)}，${s.songs || 0} 首`;
        }
        return o;
    }

    // ---------- 花了多少 ----------
    function costData() {
        const st = (typeof gyTokenStats !== 'undefined' && gyTokenStats) ? gyTokenStats : null;
        if (!st || !st.total) return null;
        const dayKey = new Date().toLocaleDateString('sv');   // YYYY-MM-DD
        const byDay = st.byDay || {};
        const days = Object.keys(byDay).sort();
        const today = byDay[dayKey] || null;
        const last7 = days.slice(-7).map(d => ({ d, v: byDay[d] }));
        const feats = Object.keys(st.byFeature || {}).map(k => ({ k, v: st.byFeature[k] }))
            .sort((a, b) => (b.v.calls || 0) - (a.v.calls || 0));
        return { total: st.total, today, last7, feats, since: st.since };
    }
    const num = n => (n == null ? '—' : (n >= 10000 ? (Math.round(n / 100) / 100) + ' 万' : String(n)));

    // ---------- 样式 ----------
    const CSS = `
#gynowModal{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;padding:16px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;}
#gynowModal.on{display:flex;}
.gynow-box{background:#fff;border-radius:16px;width:780px;max-width:100%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;}
body.dark-theme .gynow-box{background:#16181c;color:#e7e9ea;}
.gynow-hd{padding:15px 18px 9px;font-size:17px;font-weight:700;color:#17bf63;display:flex;align-items:center;gap:8px;}
.gynow-tabs{display:flex;gap:4px;padding:0 18px;border-bottom:1px solid rgba(128,128,128,.2);flex-wrap:wrap;}
.gynow-tab{border:none;background:none;padding:9px 12px;font-size:13.5px;cursor:pointer;color:#8b98a5;border-bottom:2px solid transparent;font-family:inherit;}
.gynow-tab.on{color:#17bf63;border-bottom-color:#17bf63;font-weight:700;}
.gynow-bd{padding:14px 18px 16px;overflow-y:auto;flex:1 1 auto;}
.gynow-hint{font-size:12px;color:#8b98a5;line-height:1.7;margin-bottom:8px;}
.gynow-btn{border:1px solid #17bf63;background:#17bf63;color:#fff;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer;margin:0 6px 6px 0;font-family:inherit;}
.gynow-btn.ghost{background:transparent;color:#17bf63;}
/* 顶部一排小统计 */
.gynow-top{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;}
.gynow-kpi{flex:1 1 120px;min-width:110px;background:rgba(128,128,128,.07);border-radius:10px;padding:10px 12px;}
.gynow-kpi b{display:block;font-size:20px;line-height:1.2;font-variant-numeric:tabular-nums;}
.gynow-kpi span{font-size:11.5px;color:#8b98a5;}
/* 角色卡 */
.gynow-c{border:1px solid rgba(128,128,128,.25);border-radius:12px;padding:12px;margin-bottom:10px;}
.gynow-c-hd{display:flex;align-items:center;gap:9px;margin-bottom:8px;}
.gynow-av{width:38px;height:38px;border-radius:50%;background:#e6e9ea;color:#0f1419;font-size:16px;display:flex;align-items:center;
  justify-content:center;flex:0 0 auto;background-size:cover;background-position:center;}
body.dark-theme .gynow-av{background:#2f3336;color:#e7e9ea;}
.gynow-c-hd b{font-size:15px;}
.gynow-c-hd .gynow-tag{margin-left:auto;font-size:11.5px;padding:3px 9px;border-radius:12px;background:rgba(128,128,128,.14);flex:0 0 auto;}
.gynow-row{display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.7;padding:3px 0;}
.gynow-row i{font-style:normal;width:74px;flex:0 0 auto;color:#8b98a5;font-size:12px;}
.gynow-row s{text-decoration:none;flex:1 1 auto;min-width:0;}
.gynow-row s.dim{color:#8b98a5;}
.gynow-mood{font-weight:700;}
.gynow-mood.p{color:#f91880;}
.gynow-mood.n{color:#5b7fff;}
.gynow-off{display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;background:rgba(120,86,255,.12);color:#7856ff;}
/* 没开的功能 */
.gynow-miss{background:rgba(255,173,31,.10);border:1px solid rgba(255,173,31,.4);border-radius:10px;padding:10px 12px;margin-top:10px;font-size:12.5px;line-height:1.8;}
.gynow-miss b{color:#e0900f;}
/* 花钱那页 */
.gynow-bar{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:5px 0;}
.gynow-bar u{text-decoration:none;width:112px;flex:0 0 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gynow-bar div{flex:1 1 auto;height:8px;border-radius:4px;background:rgba(128,128,128,.14);overflow:hidden;min-width:0;}
.gynow-bar div i{display:block;height:100%;background:#17bf63;border-radius:4px;}
.gynow-bar span{width:56px;text-align:right;flex:0 0 auto;font-variant-numeric:tabular-nums;color:#8b98a5;}
@media (max-width:600px){ .gynow-box{max-height:92vh;} .gynow-row i{width:60px;} .gynow-bar u{width:80px;} }`;

    function mount() {
        const st = document.createElement('style'); st.id = 'gynowStyle'; st.textContent = CSS;
        document.head.appendChild(st);
        const m = document.createElement('div');
        m.id = 'gynowModal';
        m.innerHTML = `<div class="gynow-box">
            <div class="gynow-hd">🌐 此刻<button class="gynow-btn ghost" style="margin-left:auto" onclick="gynowClose()">关闭</button></div>
            <div class="gynow-tabs">
              <button class="gynow-tab" id="gynowTab-now" onclick="gynowTab('now')">这个世界现在什么样</button>
              <button class="gynow-tab" id="gynowTab-cost" onclick="gynowTab('cost')">💰 花了多少</button>
            </div>
            <div class="gynow-bd" id="gynowBody"></div></div>`;
        m.addEventListener('click', e => { if (e.target === m) gynowClose(); });
        document.body.appendChild(m);
    }

    let tab = 'now', timer = null;

    // ⏱️ 自动刷新间隔：以前写死 30 秒，现在自己存一份让用户调。
    //    这一页一次 API 都不调，所以刷得勤也不花钱——纯粹是"想多久看一次新数据"。
    //    这个模块本来是纯只读、什么都不存，所以单开一个最小的库放它。
    const NOWDB = (typeof localforage !== 'undefined') ? localforage.createInstance({ name: 'gyNowBox' }) : null;
    let nowCfg = { sec: 30 };     // 0 = 不自动刷新
    async function loadCfg() { try { if (NOWDB) { const d = await NOWDB.getItem('cfg'); if (d) nowCfg = Object.assign(nowCfg, d); } } catch (e) {} }
    async function saveCfg() { try { if (NOWDB) await NOWDB.setItem('cfg', nowCfg); } catch (e) {} }
    // 说人话：30 秒 / 2 分钟 / 不自动刷新
    function nowEvery() {
        const s = +nowCfg.sec || 0;
        if (!s) return '不自动刷新';
        if (s < 60) return s + ' 秒';
        const m = Math.round(s / 60);
        return m < 60 ? m + ' 分钟' : Math.round(m / 60) + ' 小时';
    }
    function armTimer() {
        if (timer) { clearInterval(timer); timer = null; }
        const s = +nowCfg.sec || 0;
        if (!s) return;                       // 用户选了"不自动刷新"
        timer = setInterval(async () => {
            const box = document.getElementById('gynowModal');
            if (!box || !box.classList.contains('on')) return;
            await loadExt(); render();
        }, s * 1000);
    }
    window.gynowSetSec = async function (v) {
        nowCfg.sec = Math.max(0, gyNum(v, 0));
        await saveCfg(); armTimer(); render();
    };

    window.gynowOpen = async function () {
        document.getElementById('gynowModal').classList.add('on');
        await loadCfg();
        await loadExt(); render();
        armTimer();
    };
    window.gynowClose = function () {
        document.getElementById('gynowModal').classList.remove('on');
        if (timer) { clearInterval(timer); timer = null; }
    };
    window.gynowTab = function (t) { tab = t; render(); };
    window.gynowRefresh = async function () { await loadExt(); render(); };

    function render() {
        const box = document.getElementById('gynowModal');
        if (!box || !box.classList.contains('on')) return;
        ['now', 'cost'].forEach(t => {
            const el = document.getElementById('gynowTab-' + t);
            if (el) el.className = 'gynow-tab' + (t === tab ? ' on' : '');
        });
        document.getElementById('gynowBody').innerHTML = tab === 'now' ? tabNow() : tabCost();
    }

    function avatar(c) {
        return c.avatarImg
            ? `<div class="gynow-av" style="background-image:url('${c.avatarImg}')"></div>`
            : `<div class="gynow-av">${esc(c.avatarEmoji || (c.name || '?')[0])}</div>`;
    }
    const row = (label, val, dim) => val ? `<div class="gynow-row"><i>${label}</i><s class="${dim ? 'dim' : ''}">${val}</s></div>` : '';

    function tabNow() {
        const cs = chars();
        if (!cs.length) return '<div class="gynow-hint" style="padding:20px 0;text-align:center;">还没有角色。</div>';

        // 顶上四个数
        const autoN = (typeof AUTO_FEATURE_DEFS !== 'undefined') ? AUTO_FEATURE_DEFS.filter(f => on(f.key)).length : 0;
        const autoAll = (typeof AUTO_FEATURE_DEFS !== 'undefined') ? AUTO_FEATURE_DEFS.length : 0;
        const heldN = (typeof aliveHeld !== 'undefined') ? Object.keys(aliveHeld).filter(k => aliveHeld[k] && (aliveHeld[k].texts || []).length).length : 0;
        const plugN = (typeof plugins !== 'undefined') ? plugins.filter(p => p.enabled !== false).length : 0;
        const cost = costData();
        const todayCalls = cost && cost.today ? (cost.today.calls || 0) : 0;

        const snaps = cs.map(snap);
        const allMiss = [...new Set(snaps.reduce((a, s) => a.concat(s.miss), []))];

        const cards = snaps.map(o => {
            const c = o.c;
            const m = o.mood;
            return `<div class="gynow-c">
              <div class="gynow-c-hd">${avatar(c)}<b>${esc(c.name)}</b>
                ${o.rel ? `<span class="gynow-tag" style="color:${o.rel.sc >= 0 ? '#f91880' : '#5b7fff'}">${esc(o.rel.stage)} ${o.rel.sc > 0 ? '+' : ''}${o.rel.sc}</span>` : ''}
              </div>
              ${o.together ? row('🤝 一起', `<b style="color:#17bf63">${esc(o.together)}</b>`) : ''}
              ${row('📍 在哪儿', o.place ? esc(o.place) : '', false) || row('📍 在哪儿', '没放到地图上', true)}
              ${row('🎬 在干嘛', o.doing ? esc(o.doing) : '', false) || row('🎬 在干嘛', '状态气泡还是空的', true)}
              ${o.offline ? row('📶 在不在', `<span class="gynow-off">${esc(o.offline)}</span>`) : ''}
              ${m ? row('🌡️ 心情', `<span class="gynow-mood ${m.v > 0 ? 'p' : 'n'}">${m.v > 0 ? '+' : ''}${m.v.toFixed(1)}</span>　${esc(m.why || '（没记原因）')}${m.at ? '　<span style="color:#8b98a5;font-size:11.5px;">' + ago(m.at) + '留下的</span>' : ''}`)
                    : (o.moodFlat ? row('🌡️ 心情', '挺平静的，没有没散的情绪', true) : '')}
              ${o.body && o.body.length ? row('🥱 身上', esc(o.body.join('；')))
                    : (o.bodyNoSched ? row('🥱 身上', '还没有日程，推不出来', true) : '')}
              ${o.rel && o.rel.last ? row('💗 最近一笔', `<b style="color:${o.rel.last.d > 0 ? '#f91880' : '#5b7fff'}">${o.rel.last.d > 0 ? '+' : ''}${o.rel.last.d}</b>　${esc(o.rel.last.why || '')}　<span style="color:#8b98a5;font-size:11.5px;">${ago(o.rel.last.at)} · ${esc(o.rel.last.src || '')}</span>`) : ''}
              ${o.gossipAbout ? row('🗣️ 外面在传', `${esc(o.gossipAbout.told.byName)} 说：「${esc(o.gossipAbout.told.text)}」`) : ''}
              ${o.gossipBy ? row('🗣️ TA 传过', `跟你说过 ${o.gossipBy} 件别人的事`, true) : ''}
              ${o.kit ? row('🎒 身上带着', `${o.kit.n} 样${o.kit.close.length ? '（贴身：' + esc(o.kit.close.join('、')) + '）' : ''}${o.kit.fromU ? `　<b style="color:#f91880">${o.kit.fromU} 样是你送的</b>${o.kit.mine.length ? '：' + esc(o.kit.mine.join('、')) : ''}` : ''}${o.kit.gone ? `　<span style="color:#8b98a5">${o.kit.gone} 样已经不在了</span>` : ''}`) : ''}
              ${o.days && o.days.length ? row('📅 这几天', o.days.map(x => esc(x)).join('　·　')) : ''}
              ${o.voice ? row('✍️ 打字习惯', esc(o.voice), !c.voicePrint) : ''}
              ${o.fade ? row('🧠 记忆', esc(o.fade), true) : ''}
              ${o.music ? row('🎧 一起听', esc(o.music), true) : ''}
            </div>`;
        }).join('');

        return `
          <div class="gynow-top">
            <div class="gynow-kpi"><b>${cs.length}</b><span>个角色</span></div>
            <div class="gynow-kpi"><b>${autoN}<span style="font-size:13px;color:#8b98a5;"> / ${autoAll}</span></b><span>自动功能开着</span></div>
            <div class="gynow-kpi"><b style="color:${heldN ? '#7856ff' : ''}">${heldN}</b><span>人有消息挂着</span></div>
            <div class="gynow-kpi"><b>${todayCalls}</b><span>今天调了几次</span></div>
          </div>
          <div class="gynow-hint">
            此界面只展示数据不做调用，开启时每隔 <b>${nowEvery()}</b> 自动刷新数据。
            <span style="display:inline-flex;align-items:center;gap:6px;margin-left:8px;flex-wrap:wrap;">
              <select onchange="gynowSetSec(this.value)" style="padding:3px 8px;border:1px solid #cfd9de;border-radius:6px;font-size:12px;">
                ${[['10','10 秒'],['30','30 秒'],['60','1 分钟'],['120','2 分钟'],['300','5 分钟'],['600','10 分钟'],['1800','30 分钟'],['0','不自动刷新']]
                  .map(([v, n]) => `<option value="${v}" ${String(nowCfg.sec) === v ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
              <button class="gynow-btn ghost" style="padding:3px 10px;font-size:12px;" onclick="gynowRefresh()">立刻刷新</button>
            </span></div>
          ${cards}
          ${allMiss.length ? `<div class="gynow-miss"><b>⚠️ 上面有几栏是空的，因为这些还没开 / 没装：</b><br>
            ${allMiss.map(x => '· ' + esc(x)).join('<br>')}<br>
            <span style="color:#8b98a5;">开关在「设置 → 🫀 活人感」和「设置 → 🔌 自动功能开关」；插件在「设置 → 插件」里导入。</span></div>` : ''}`;
    }

    function tabCost() {
        const d = costData();
        if (!d) return '<div class="gynow-hint" style="padding:20px 0;text-align:center;">还没有用量记录。</div>';
        const t = d.total;
        const max = Math.max(1, ...d.feats.map(f => f.v.calls || 0));
        const days7 = d.last7;
        const maxDay = Math.max(1, ...days7.map(x => x.v.calls || 0));
        const autoOn = (typeof AUTO_FEATURE_DEFS !== 'undefined') ? AUTO_FEATURE_DEFS.filter(f => on(f.key)) : [];
        const autoOff = (typeof AUTO_FEATURE_DEFS !== 'undefined') ? AUTO_FEATURE_DEFS.filter(f => !on(f.key)) : [];
        return `
          <div class="gynow-top">
            <div class="gynow-kpi"><b>${num(t.calls)}</b><span>总共调用次数</span></div>
            <div class="gynow-kpi"><b>${num(t.in)}</b><span>输入 token</span></div>
            <div class="gynow-kpi"><b>${num(t.out)}</b><span>输出 token</span></div>
            <div class="gynow-kpi"><b style="color:#17bf63">${num(t.cached)}</b><span>命中缓存（省下的）</span></div>
          </div>
          <div class="gynow-hint">${d.since ? '从 ' + new Date(d.since).toLocaleDateString('zh-CN') + ' 开始统计。' : ''}
            这是<b>调用次数和 token</b>，不是钱——真实花费还要乘上你那家服务商的单价。</div>

          <div style="margin-top:14px;"><b style="font-size:13.5px;">📅 最近 7 天</b>
            ${days7.length ? days7.map(x => `<div class="gynow-bar"><u>${x.d.slice(5)}</u>
              <div><i style="width:${Math.round((x.v.calls || 0) / maxDay * 100)}%"></i></div>
              <span>${x.v.calls || 0} 次</span></div>`).join('') : '<div class="gynow-hint">还没有按天的记录。</div>'}
          </div>

          <div style="margin-top:16px;"><b style="font-size:13.5px;">🔍 哪一项最费</b>
            <div class="gynow-hint">按调用次数排。想省钱就从最上面那几项下手——去「🔌 自动功能开关」里关掉不需要的。</div>
            ${d.feats.length ? d.feats.slice(0, 14).map(f => `<div class="gynow-bar"><u title="${esc(f.k)}">${esc(f.k)}</u>
              <div><i style="width:${Math.round((f.v.calls || 0) / max * 100)}%"></i></div>
              <span>${f.v.calls || 0} 次</span></div>`).join('') : '<div class="gynow-hint">还没有按功能的记录。</div>'}
          </div>

          <div style="margin-top:16px;"><b style="font-size:13.5px;">🔌 现在开着的自动功能（${autoOn.length}）</b>
            <div class="gynow-hint">这些是<b>不用你点、自己会去调 API</b> 的。</div>
            <div class="gynow-hint" style="margin-top:2px;">每一条都能点，点了直接跳到那个开关。</div>
            ${autoOn.length ? autoOn.map(f => `<div class="gynow-jump" onclick="gynowJump('${f.key}')">
                <b>${esc(f.label)}</b> <span style="color:#1d9bf0;font-size:11px;">去看看 ›</span>
                <br><span style="font-size:11.5px;color:#8b98a5;">💰 ${esc(f.cost || '')}</span></div>`).join('')
              : '<div class="gynow-hint">一个都没开——那就完全不会有后台自动花钱的事。</div>'}
          </div>

          <div style="margin-top:16px;"><b style="font-size:13.5px;">😴 关着的（${autoOff.length}）</b>
            <div class="gynow-hint" style="margin-top:6px;">点一下就能去打开。</div>
            <div style="margin-top:4px;">${autoOff.map(f =>
                `<span class="gynow-chip" onclick="gynowJump('${f.key}')">${esc(f.label)}</span>`).join('') || '<span class="gynow-hint">（全开着）</span>'}</div>
          </div>`;
    }

    // 点开关名字跳到「设置 → 自动功能开关」并把那一行高亮出来
    window.gynowJump = function (key) {
        try { gynowClose(); } catch (e) {}
        if (typeof gyJumpToSwitch === 'function') gyJumpToSwitch(key);
    };

    const nowJumpCss = document.createElement('style');
    nowJumpCss.textContent = `
      .gynow-jump { font-size:13px; padding:7px 8px; margin:2px -8px; border-radius:8px; cursor:pointer;
        border-bottom:1px dashed rgba(128,128,128,.2); }
      .gynow-jump:hover { background:rgba(29,155,240,.1); }
      .gynow-chip { display:inline-block; font-size:12px; padding:4px 10px; margin:3px 4px 3px 0;
        border:1px solid #cfd9de; border-radius:999px; cursor:pointer; color:#536471; }
      .gynow-chip:hover { border-color:#1d9bf0; color:#1d9bf0; background:rgba(29,155,240,.08); }`;
    document.head.appendChild(nowJumpCss);

    // ---------- 入口 ----------
    function addEntries() {
        const menu = document.querySelector('#setIndex .set-menu');
        if (menu && !document.getElementById('gynowSetEntry')) {
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = 'set-entry'; btn.id = 'gynowSetEntry';
            btn.onclick = () => gynowOpen();
            btn.innerHTML = '<span class="set-entry-ico">🌐</span><span class="set-entry-main"><span class="set-entry-title">此刻</span><span class="set-entry-desc">谁在哪、什么心情、关系到哪一步了，以及你花了多少</span></span><span class="set-entry-arrow">›</span>';
            const first = menu.querySelector('.set-entry');
            if (first) menu.insertBefore(btn, first); else menu.appendChild(btn);
        }
    }

    (async function init() {
        mount();
        addEntries();
        const sw = window.switchMainView;
        if (typeof sw === 'function' && !sw.__gynowPatched) {
            window.switchMainView = function () {
                const r = sw.apply(this, arguments);
                try { setTimeout(addEntries, 0); } catch (e) {}
                return r;
            };
            window.switchMainView.__gynowPatched = true;
        }
        console.info('[此刻] 已加载（这个插件不调 API，只读已有数据）');
    })();
})();
