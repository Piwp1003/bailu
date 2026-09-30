/* ===========================================================================
   js/72 —— 🧍 角色立绘（透明底）+ 差分：聊天时跟着 TA 的心情换表情
   ---------------------------------------------------------------------------
   · 每个角色可以上传好几张立绘，每张标一个表情（默认 / 开心 / 害羞 / 生气 / 难过 / 惊讶……，也能自己加）。
   · 聊天时立绘站在聊天区里（左 / 右 / 中间，大小、透明度、在消息前面还是后面都能调），不挡点击。
   · 换哪张：
       ① TA 这一轮自己说的表情（会请 TA 在回复 JSON 里多写一个 "face" 字段，只对有立绘的角色）；
       ② 没写就看 TA 说的话里的字眼和表情符号（哈哈 / 哼 / 呜呜 / 😳 ……）；
       ③ 还看不出来就参考 TA 这轮的情绪分数（活人感里的 mood）。
     没有这个表情的立绘时，退到最接近的那张（得意→开心、哭→难过……），再没有就用「默认」。
   · 图片自己上传，或者用「📷 角色发图片」里配好的生图接口现画一张；纯色背景可以一键抠掉。
   这个文件同时也能当插件用：设置 → 插件 → 导入「插件/角色立绘差分.json」（里面就是这份代码），
   两边都装了也不会重复（开头有防重复加载）。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gySpriteLoaded) return;
    window.__gySpriteLoaded = true;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };
    const LF = (typeof localforage !== 'undefined' && localforage.createInstance) ? localforage.createInstance({ name: 'gySprite', storeName: 's' }) : null;
    const DEF_MOODS = ['默认', '开心', '害羞', '生气', '难过', '惊讶', '得意', '困', '担心', '温柔', '认真', '哭'];
    // 找不到这个表情的立绘时往哪退
    const FALL = { '哭': '难过', '得意': '开心', '温柔': '开心', '害羞': '开心', '担心': '难过', '困': '默认', '认真': '默认', '惊讶': '默认', '生气': '默认', '难过': '默认', '开心': '默认' };
    // 从 TA 说的话里看表情：字眼 + 表情符号，按命中次数打分
    const KEYS = {
        '开心': ['哈哈', '嘻嘻', '好耶', '太好了', '开心', '高兴', '笑', '好棒', '耶', '😄', '😊', '😆', '🥳', '😁', '^_^', '(＾▽＾)'],
        '害羞': ['害羞', '脸红', '才没有', '不好意思', '讨厌啦', '别看', '羞', '😳', '☺️', '🙈', '///'],
        '生气': ['哼', '生气', '气死', '烦死', '滚', '闭嘴', '讨厌', '不理你', '可恶', '😠', '😡', '💢', '😤'],
        '难过': ['难过', '伤心', '对不起', '唉', '失落', '委屈', '心疼', '好累', '😔', '😞', '🥺'],
        '哭': ['呜呜', '哭', '眼泪', '泪', '😭', '😢', 'QAQ', 'TAT'],
        '惊讶': ['什么？', '啊？', '诶？', '真的假的', '不会吧', '天哪', '居然', '竟然', '！？', '?!', '😮', '😲', '😱'],
        '得意': ['嘿嘿', '那当然', '厉害吧', '哼哼', '夸我', '不愧是我', '😏', '😎'],
        '困': ['困', '晚安', '睡觉', '好累啊', '打哈欠', '睡了', '😪', '😴', '💤'],
        '担心': ['担心', '没事吧', '小心', '还好吗', '注意安全', '别逞强', '要不要紧', '😟'],
        '温柔': ['乖', '抱抱', '想你', '喜欢你', '爱你', '摸摸', '陪你', '宝贝', '❤', '🫶', '💕', '🥰'],
        '认真': ['听好', '认真', '我是说真的', '说正经的', '记住', '必须', '重要']
    };

    let D = { chars: {}, moods: [] };   // chars[id] = { on, pos, size, opacity, layer, sprites:[{id, mood, src}], face }
    let loaded = false;
    async function load() { try { const d = LF && await LF.getItem('cfg'); if (d && typeof d === 'object') D = Object.assign({ chars: {}, moods: [] }, d); } catch (e) {} loaded = true; }
    async function save() { try { if (LF) await LF.setItem('cfg', D); } catch (e) { toast('立绘没存上', String(e && e.message || e)); } }
    const ready = load();
    const cfgOf = id => { id = String(id); if (!D.chars[id]) D.chars[id] = { on: true, pos: 'right', size: 62, opacity: 100, layer: 'back', sprites: [], face: '默认' }; return D.chars[id]; };
    const moods = () => DEF_MOODS.concat((D.moods || []).filter(m => !DEF_MOODS.includes(m)));
    const hasSprites = id => { const c = D.chars[String(id)]; return !!(c && c.on && c.sprites && c.sprites.length); };

    // 这个表情用哪张：同一个表情有好几张就随机一张（每次换表情才重抽，不会一直闪）
    function spriteFor(id, face) {
        const c = D.chars[String(id)]; if (!c || !c.sprites.length) return null;
        let f = face || '默认', guard = 0;
        while (guard++ < 5) {
            const L = c.sprites.filter(s => s.mood === f);
            if (L.length) return L[Math.floor(Math.random() * L.length)];
            f = FALL[f] || '默认';
            if (f === '默认' && !c.sprites.some(s => s.mood === '默认')) break;
        }
        return c.sprites.find(s => s.mood === '默认') || c.sprites[0];
    }
    // 从一段话里看出表情
    function faceFromText(t, known) {
        t = String(t || ''); if (!t) return null;
        let best = null, score = 0;
        Object.keys(KEYS).forEach(m => {
            if (known && !known.includes(m) && !known.includes(FALL[m])) return;
            const s = KEYS[m].reduce((n, k) => n + (t.split(k).length - 1), 0);
            if (s > score) { score = s; best = m; }
        });
        // 自己加的表情：名字本身出现在话里就算
        (D.moods || []).forEach(m => { if (t.includes(m) && score < 1) { best = m; score = 1; } });
        return best;
    }
    window.gySpriteFaceFromText = faceFromText;
    window.gySpriteData = () => D;

    function setFace(id, face, why) {
        if (!face) return;
        const c = cfgOf(id); if (c.face === face && !why) return;
        c.face = face; c.faceAt = Date.now();
        save(); paint(true);
    }
    window.gySpriteSetFace = (id, face) => setFace(id, face, 'manual');

    /* ---------- 让 TA 自己说表情（只对有立绘的角色加这一段） ---------- */
    window.__gySpriteCtxFor = function (charId) {
        if (!hasSprites(charId)) return '';
        const have = [...new Set(cfgOf(charId).sprites.map(s => s.mood))];
        return `【立绘表情】：在你回复的那个 JSON 里再多写一个字段 "face"，从这些里挑一个最贴合这一轮结束时你脸上表情的：${have.join('、')}。只写这个词，比如 "face":"${have[0]}"。`;
    };
    function hookCtx() {
        try { if (typeof GY_BOX_CTX !== 'undefined' && Array.isArray(GY_BOX_CTX) && !GY_BOX_CTX.some(x => x[0] === '__gySpriteCtxFor')) GY_BOX_CTX.push(['__gySpriteCtxFor', '角色立绘表情']); } catch (e) {}
    }
    /* ---------- TA 回完一轮：看表情 ---------- */
    function onReply(char, sessionId, response) {
        try {
            if (!char || !hasSprites(char.id) || !response) return;
            const c = cfgOf(char.id), have = [...new Set(c.sprites.map(s => s.mood))];
            let f = response.face || response.expression || response['表情'];
            if (f && !moods().includes(f)) f = faceFromText(f, null) || null;
            if (!f) {
                const txt = (Array.isArray(response.replies) ? response.replies.map(r => (r && (r.text || r.content)) || r).join(' ') : '') + ' ' + (response.stateUpdate || '') + ' ' + (response.statusTypeLabel || '');
                f = faceFromText(txt, null);
            }
            if (!f && typeof response.mood === 'number') f = response.mood >= 3 ? '开心' : response.mood <= -3 ? '生气' : response.mood < 0 ? '难过' : null;
            if (f) setFace(char.id, f);
            void have;
        } catch (e) { console.warn('[立绘] 看表情出错：', e); }
    }
    function hookReply() {
        if (typeof window.runBoxResponseHooks !== 'function' || window.runBoxResponseHooks.__gySprite) return;
        const f0 = window.runBoxResponseHooks;
        window.runBoxResponseHooks = function (char, sessionId, response) { const r = f0.apply(this, arguments); onReply(char, sessionId, response); return r; };
        window.runBoxResponseHooks.__gySprite = true;
    }
    // 兜底：别的路子来的消息（字卡、旧存档、插件发的）——看最新一条 TA 说的话
    let lastSeen = {};
    function scanLatest(id) {
        try {
            const arr = (typeof globalChats !== 'undefined' && globalChats[id]) || [];
            for (let i = arr.length - 1; i >= 0 && i >= arr.length - 4; i--) {
                const m = arr[i]; if (!m || String(m.sender) !== String(id)) continue;
                const key = m.timestamp + ':' + String(m.text).length;
                if (lastSeen[id] === key) return;
                lastSeen[id] = key;
                // 这一轮 TA 已经自己说了表情（或你刚手动换过）：不再按字眼改
                if (Date.now() - (cfgOf(id).faceAt || 0) < 8000) return;
                const f = faceFromText(m.text, null); if (f) setFace(id, f);
                return;
            }
        } catch (e) {}
    }

    /* ---------- 画在聊天区里 ---------- */
    let shownKey = '';
    function curChat() {
        const inp = document.getElementById('chatInputArea');
        const id = (typeof currentChatSessionId !== 'undefined' && currentChatSessionId) ? String(currentChatSessionId) : '';
        const vc = document.getElementById('view-chat');
        if (!id || !inp || inp.style.display === 'none' || !vc || getComputedStyle(vc).display === 'none') return null;
        return id;
    }
    function paint(force) {
        const vc = document.getElementById('view-chat'), area = document.getElementById('chatMessagesArea');
        let el = document.getElementById('gySprite');
        const id = curChat();
        if (!vc || !area || !id || !hasSprites(id) || (typeof window.gySpriteHidden === 'boolean' && window.gySpriteHidden)) { if (el) el.style.display = 'none'; document.body.classList.remove('gysp-back'); return; }
        if (!el) { el = document.createElement('div'); el.id = 'gySprite'; el.innerHTML = '<img alt=""><img alt="" class="old">'; vc.appendChild(el); }
        if (el.parentNode !== vc) vc.appendChild(el);
        if (getComputedStyle(vc).position === 'static') vc.style.position = 'relative';
        const c = cfgOf(id);
        scanLatest(id);
        const s = spriteFor(id, c.face);
        el.style.display = s ? '' : 'none'; if (!s) return;
        // 贴着聊天记录那一块：上沿到输入框上面
        const top = area.offsetTop, h = area.offsetHeight;
        Object.assign(el.style, { top: top + 'px', height: h + 'px', opacity: String(Math.max(5, Math.min(100, +c.opacity || 100)) / 100) });
        el.className = 'p-' + (c.pos || 'right') + ' l-' + (c.layer || 'back');
        document.body.classList.toggle('gysp-back', c.layer !== 'front');
        const im = el.querySelector('img:not(.old)'), old = el.querySelector('img.old');
        im.style.height = Math.max(10, Math.min(100, +c.size || 62)) + '%';
        old.style.height = im.style.height;
        const key = id + '|' + s.id;
        if (key !== shownKey || force) {
            if (shownKey && key !== shownKey && im.src) { old.src = im.src; old.classList.remove('fade'); void old.offsetWidth; old.classList.add('fade'); }
            if (key !== shownKey) { im.src = s.src; im.classList.remove('pop'); void im.offsetWidth; im.classList.add('pop'); }
            shownKey = key;
            el.dataset.face = c.face || '默认';
        }
    }
    window.gySpritePaint = () => paint(true);

    /* ---------- 抠掉纯色背景（从四个角往里找颜色相近的连通区域） ---------- */
    async function cutBg(src, tol) {
        tol = tol == null ? 38 : tol;
        const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
        const W = img.naturalWidth, H = img.naturalHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
        let data; try { data = g.getImageData(0, 0, W, H); } catch (e) { throw new Error('这张图不让读像素（跨域），先存到本地再上传'); }
        const p = data.data, seen = new Uint8Array(W * H), q = [];
        const ref = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].map(([x, y]) => { const i = (y * W + x) * 4; return [p[i], p[i + 1], p[i + 2]]; });
        const near = i => ref.some(r => Math.abs(p[i] - r[0]) + Math.abs(p[i + 1] - r[1]) + Math.abs(p[i + 2] - r[2]) < tol * 3);
        for (let x = 0; x < W; x++) { q.push(x, (H - 1) * W + x); } for (let y = 0; y < H; y++) { q.push(y * W, y * W + W - 1); }
        while (q.length) {
            const k = q.pop(); if (seen[k]) continue; seen[k] = 1;
            const i = k * 4; if (p[i + 3] === 0 || near(i)) { p[i + 3] = 0; const x = k % W, y = (k / W) | 0; if (x > 0) q.push(k - 1); if (x < W - 1) q.push(k + 1); if (y > 0) q.push(k - W); if (y < H - 1) q.push(k + W); }
        }
        g.putImageData(data, 0, 0);
        return cv.toDataURL('image/png');
    }
    window.gySpriteCutBg = cutBg;
    const fileToUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

    /* ---------- 设置面板 ---------- */
    let SEL = null;
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []).filter(c => c && !c.members);
    window.gySpriteOpen = async function (charId) {
        await ready;
        SEL = String(charId || SEL || (typeof currentChatSessionId !== 'undefined' && currentChatSessionId && chars().some(c => String(c.id) === String(currentChatSessionId)) ? currentChatSessionId : (chars()[0] || {}).id) || '');
        let ov = document.getElementById('gySpriteOv'); if (ov) ov.remove();
        ov = document.createElement('div'); ov.id = 'gySpriteOv'; ov.className = 'modal-overlay';
        ov.innerHTML = '<div class="modal-box gysp-box" id="gySpriteBox"></div>';
        document.body.appendChild(ov); ov.style.display = 'flex';
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        render();
    };
    function render() {
        const box = document.getElementById('gySpriteBox'); if (!box) return;
        const cs = chars(); const ch = cs.find(c => String(c.id) === SEL);
        if (!ch) { box.innerHTML = '<div class="gysp-hd"><b>🧍 角色立绘</b><span onclick="document.getElementById(\'gySpriteOv\').remove()">✕</span></div><div class="gysp-tip">还没有角色</div>'; return; }
        const c = cfgOf(ch.id);
        const tile = m => {
            const L = c.sprites.filter(s => s.mood === m);
            return `<div class="gysp-tile${c.face === m ? ' cur' : ''}"><div class="pics">${L.map(s => `<div class="pic" style="background-image:url('${esc(s.src)}')"><i onclick="gySpriteDel('${s.id}')" title="删掉">✕</i><u onclick="gySpriteCut('${s.id}')" title="抠掉纯色背景">抠底</u></div>`).join('') || '<div class="pic e">没有</div>'}</div>
                <b>${esc(m)}</b><div class="ops"><label>上传<input type="file" accept="image/*" multiple style="display:none" onchange="gySpriteUp(this,'${esc(m)}')"></label><span onclick="gySpriteGen('${esc(m)}')">生图</span><span onclick="gySpriteSetFace('${esc(ch.id)}','${esc(m)}');gySpriteRender()">换成这个</span></div></div>`;
        };
        const sel = (k, opts) => `<select onchange="gySpriteCfg('${k}',this.value)">${opts.map(([v, n]) => `<option value="${v}"${String(c[k]) === String(v) ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
        box.innerHTML = `<div class="gysp-hd"><b>🧍 角色立绘</b><span onclick="document.getElementById('gySpriteOv').remove()">✕</span></div>
            <div class="gysp-tip">上传透明底（PNG）的立绘，每张标一个表情。聊天时 TA 的心情一变，立绘就跟着换。同一个表情放好几张，会随机挑一张。</div>
            <div class="gysp-row"><select onchange="gySpriteSel(this.value)">${cs.map(x => `<option value="${esc(x.id)}"${String(x.id) === SEL ? ' selected' : ''}>${esc(x.remark || x.name)}</option>`).join('')}</select>
                <label class="gysp-sw"><input type="checkbox" ${c.on ? 'checked' : ''} onchange="gySpriteCfg('on',this.checked)"> 在聊天里显示</label></div>
            <div class="gysp-row">位置 ${sel('pos', [['right', '右边'], ['left', '左边'], ['center', '中间']])} 层 ${sel('layer', [['back', '在消息后面'], ['front', '在消息前面']])}</div>
            <div class="gysp-row">大小 <input type="range" min="20" max="100" value="${+c.size || 62}" oninput="gySpriteCfg('size',this.value)"> 透明度 <input type="range" min="10" max="100" value="${+c.opacity || 100}" oninput="gySpriteCfg('opacity',this.value)"></div>
            <div class="gysp-row"><span class="gysp-cur">现在的表情：<b>${esc(c.face || '默认')}</b></span><label class="gysp-btn">一次传好几张（文件名里带表情词会自动归类）<input type="file" accept="image/*" multiple style="display:none" onchange="gySpriteUp(this,'')"></label></div>
            <div class="gysp-grid">${moods().map(tile).join('')}</div>
            <div class="gysp-row"><span class="gysp-link" onclick="gySpriteAddMood()">＋ 自己加一个表情</span><span class="gysp-link" onclick="gySpriteGenAll()">用生图把缺的表情都画一张</span></div>
            <div class="gysp-tip">生图用的是「小功能 → 📷 角色发图片」里配的画图接口和 TA 的形象词；画出来一般是白底，会自动帮你抠一次底，不满意可以再点「抠底」或自己换图。</div>`;
    }
    window.gySpriteRender = render;
    window.gySpriteSel = v => { SEL = String(v); render(); };
    window.gySpriteCfg = async function (k, v) { const c = cfgOf(SEL); c[k] = (k === 'on') ? !!v : v; await save(); paint(true); if (k !== 'size' && k !== 'opacity') render(); };
    const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const guessMood = name => { const n = String(name || ''); const hit = moods().filter(m => m !== '默认').find(m => n.includes(m)); if (hit) return hit; const en = { happy: '开心', smile: '开心', shy: '害羞', blush: '害羞', angry: '生气', sad: '难过', cry: '哭', surprise: '惊讶', smug: '得意', sleepy: '困', worry: '担心', gentle: '温柔', serious: '认真', normal: '默认', default: '默认' }; const k = Object.keys(en).find(k => n.toLowerCase().includes(k)); return k ? en[k] : '默认'; };
    window.gySpriteUp = async function (inp, mood) {
        const files = [...(inp.files || [])]; inp.value = ''; if (!files.length) return;
        const c = cfgOf(SEL);
        for (const f of files) { const src = await fileToUrl(f); c.sprites.push({ id: uid(), mood: mood || guessMood(f.name), src }); }
        await save(); render(); paint(true); toast(`🧍 加了 ${files.length} 张立绘`);
    };
    window.gySpriteDel = async function (sid) { const c = cfgOf(SEL); c.sprites = c.sprites.filter(s => s.id !== sid); await save(); render(); paint(true); };
    window.gySpriteCut = async function (sid) {
        const c = cfgOf(SEL), s = c.sprites.find(x => x.id === sid); if (!s) return;
        try { s.src = await cutBg(s.src); await save(); render(); shownKey = ''; paint(true); toast('抠好了'); } catch (e) { toast('没抠成', String(e && e.message || e)); }
    };
    window.gySpriteAddMood = async function () {
        const ask = typeof appPrompt === 'function' ? appPrompt : (m, d) => Promise.resolve(prompt(m, d));
        const m = await ask('新表情叫什么？（比如：吃醋、撒娇、无语）', ''); if (!m || !String(m).trim()) return;
        D.moods = (D.moods || []).concat(String(m).trim()); await save(); render();
    };
    async function genOne(ch, mood) {
        if (typeof window.gyPhotoGet !== 'function') throw new Error('没有生图功能（小功能 → 📷 角色发图片）');
        const look = (typeof window.gyPhotoLookOf === 'function' && (window.gyPhotoLookOf(ch.id) || {}).desc) || '';
        const desc = `${look ? look + '，' : ''}${ch.name}的全身立绘，站姿，${mood === '默认' ? '平常的表情' : mood + '的表情'}，纯白背景，干净的边缘，二次元立绘风格`;
        const got = await window.gyPhotoGet(ch.id, desc, true, 'gen');
        if (!got || !got.src) throw new Error('画图接口没给图（去「小功能 → 📷 角色发图片」看看配没配好）');
        let src = got.src; try { src = await cutBg(src); } catch (e) {}
        cfgOf(ch.id).sprites.push({ id: uid(), mood, src, gen: true });
    }
    window.gySpriteGen = async function (mood) {
        const ch = chars().find(c => String(c.id) === SEL); if (!ch) return;
        toast('🎨 在画「' + mood + '」…', '要等一会儿');
        try { await genOne(ch, mood); await save(); render(); paint(true); toast('画好了', mood); } catch (e) { toast('没画成', String(e && e.message || e)); }
    };
    window.gySpriteGenAll = async function () {
        const ch = chars().find(c => String(c.id) === SEL); if (!ch) return;
        const c = cfgOf(ch.id), miss = moods().filter(m => !c.sprites.some(s => s.mood === m));
        if (!miss.length) { toast('每个表情都有立绘了'); return; }
        toast(`🎨 开始画 ${miss.length} 张`, '一张一张来');
        for (const m of miss) { try { await genOne(ch, m); await save(); render(); } catch (e) { toast('「' + m + '」没画成', String(e && e.message || e)); break; } }
        paint(true);
    };
    // 聊天工具栏上的开关：点一下临时藏起来 / 放出来；长按（右键）打开设置
    window.gySpriteToggle = function () { window.gySpriteHidden = !window.gySpriteHidden; paint(true); toast(window.gySpriteHidden ? '立绘先藏起来了' : '立绘出来了'); };

    function entries() {
        const row = document.getElementById('chatToolIconsRow');
        if (row && !document.getElementById('gySpriteBtn')) {
            const b = document.createElement('button'); b.className = 'btn-edit-small'; b.id = 'gySpriteBtn'; b.title = '立绘（右键 / 长按打开设置）'; b.textContent = '🧍';
            b.onclick = () => { const id = curChat(); if (id && hasSprites(id)) window.gySpriteToggle(); else window.gySpriteOpen(id); };
            b.oncontextmenu = e => { e.preventDefault(); window.gySpriteOpen(curChat()); };
            let t = null; b.addEventListener('touchstart', () => { t = setTimeout(() => { t = null; window.gySpriteOpen(curChat()); }, 550); }, { passive: true }); b.addEventListener('touchend', () => { if (t) clearTimeout(t); });
            row.appendChild(b);
        }
        try { if (typeof registerMiniFeature === 'function' && !(typeof GY_MINI_FEATURES !== 'undefined' && GY_MINI_FEATURES.some(f => f.id === 'charSprite'))) registerMiniFeature({ id: 'charSprite', icon: '🧍', title: '角色立绘', desc: '聊天时 TA 的立绘站在旁边，心情一变就换一张差分。图片自己上传或用生图', onOpen: () => window.gySpriteOpen() }); } catch (e) {}
    }

    const CSS = `
#gySprite{position:absolute;left:0;right:0;pointer-events:none;z-index:0;display:flex;align-items:flex-end;overflow:hidden}
#gySprite.l-front{z-index:6}
#gySprite.p-right{justify-content:flex-end}#gySprite.p-left{justify-content:flex-start}#gySprite.p-center{justify-content:center}
#gySprite img{max-width:70%;object-fit:contain;object-position:bottom;filter:drop-shadow(0 6px 14px rgba(0,0,0,.12));position:relative}
#gySprite img.old{position:absolute;bottom:0;opacity:0}#gySprite.p-right img.old{right:0}#gySprite.p-left img.old{left:0}#gySprite.p-center img.old{left:50%;transform:translateX(-50%)}
#gySprite img.old.fade{animation:gyspOut .35s ease forwards}
#gySprite img.pop{animation:gyspIn .38s cubic-bezier(.34,1.56,.64,1)}
@keyframes gyspIn{from{opacity:.2;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}
@keyframes gyspOut{from{opacity:1}to{opacity:0}}
body.gysp-back #chatMessagesArea{position:relative;z-index:1}
#gySpriteOv{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:14px}
#gySpriteOv .gysp-box{background:#fff;color:#111;border-radius:18px;width:min(680px,100%);max-height:90vh;overflow:auto;padding:16px 18px;box-sizing:border-box}
.gysp-hd{display:flex;justify-content:space-between;font-size:18px;margin-bottom:6px}.gysp-hd span{cursor:pointer;color:#888}
.gysp-tip{font-size:12.5px;color:#888;line-height:1.6;margin:6px 0}
.gysp-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0;font-size:13.5px}.gysp-row select{padding:6px 8px;border-radius:9px;border:1px solid #ddd;background:#fafafa}
.gysp-sw{display:flex;gap:6px;align-items:center;cursor:pointer}.gysp-cur b{color:#1d9bf0}
.gysp-btn{padding:7px 12px;border-radius:10px;background:#f2f2f4;cursor:pointer;font-size:13px}
.gysp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin:10px 0}
.gysp-tile{border:1px solid #eee;border-radius:14px;padding:8px;text-align:center}.gysp-tile.cur{border-color:#1d9bf0;box-shadow:0 0 0 2px rgba(29,155,240,.2)}
.gysp-tile .pics{display:flex;gap:4px;overflow-x:auto;justify-content:center}
.gysp-tile .pic{width:70px;height:96px;flex-shrink:0;border-radius:8px;background:#f4f4f6 center bottom/contain no-repeat;background-image:linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%),linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%);position:relative}
.gysp-tile .pic[style]{background-size:contain;background-position:center bottom;background-repeat:no-repeat}
.gysp-tile .pic.e{display:flex;align-items:center;justify-content:center;font-size:12px;color:#bbb;background-image:none}
.gysp-tile .pic i{position:absolute;right:2px;top:2px;font-style:normal;font-size:11px;background:rgba(0,0,0,.5);color:#fff;border-radius:50%;width:16px;height:16px;line-height:16px;cursor:pointer}
.gysp-tile .pic u{position:absolute;left:2px;bottom:2px;text-decoration:none;font-size:10px;background:rgba(0,0,0,.5);color:#fff;border-radius:6px;padding:0 4px;cursor:pointer}
.gysp-tile b{display:block;margin:6px 0 4px;font-size:14px}.gysp-tile .ops{display:flex;gap:8px;justify-content:center;font-size:12px;color:#576b95}.gysp-tile .ops>*{cursor:pointer}
.gysp-link{color:#576b95;cursor:pointer;font-size:13px}
`;
    function boot() {
        if (!document.getElementById('gySpriteCss')) { const st = document.createElement('style'); st.id = 'gySpriteCss'; st.textContent = CSS; document.head.appendChild(st); }
        ready.then(() => { hookCtx(); hookReply(); entries(); paint(); });
        setInterval(() => { hookCtx(); hookReply(); entries(); paint(); }, 1200);
        window.addEventListener('resize', () => paint());
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
