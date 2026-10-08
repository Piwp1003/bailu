/* ============================================================
   🛠️ 出错时的补救 + 「聊天里的约定≠已经发生」（v210）
   ------------------------------------------------------------
   1. 接口报错说人话：以前只翻译 HTTP 状态码，「上下文太长」「内容被拦」「余额不够」
      「模型名不对」「超时」这些看报错文字才认得出的，一律原样甩出来。这里按报错文字分类，
      每类给一句怎么办。
   2. 修一个老 bug：js/01 里那个「接口报错就弹一句提示」的包装，跑的时候 callChatCompletionAPI
      和 sendChatRequest 还没定义（它们在 js/01b），所以从来没生效过。这里在它们定义好之后再套一次。
   3. 回复格式坏了自动修一次：聊天要模型回一段 JSON，有时引号没转义、括号没闭合，
      以前就把整坨原文当一条消息发出来。现在先请模型把那段原样修成合法 JSON 再解析（多一次调用，可关）。
   4. 「聊天里说好的事 ≠ 已经发生」：TA 在聊天里说「明天去接你」，那只是约定；
      写日记、写小说、写推文时不能当成已经接过了。进 prompt 骨架（注入内容管理里能关）。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyApiCare) return;
    window.__gyApiCare = true;
    const on = k => { try { return typeof isAutoOn === 'function' ? isAutoOn(k) : true; } catch (e) { return true; } };
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };

    // ---------- 开关 ----------
    try {
        if (typeof AUTO_FEATURE_GROUPS !== 'undefined' && !AUTO_FEATURE_GROUPS.some(g => g.key === '补救'))
            AUTO_FEATURE_GROUPS.push({ key: '补救', icon: '🛠️', title: '出错时的补救', note: '模型回得不对、接口报错的时候怎么兜底。' });
        if (typeof AUTO_FEATURE_DEFS !== 'undefined' && !AUTO_FEATURE_DEFS.some(f => f.key === 'jsonRepair'))
            AUTO_FEATURE_DEFS.push({ key: 'jsonRepair', label: '聊天回复格式坏了自动修一次', group: '补救',
                desc: '聊天要模型回一段 JSON。模型偶尔会把引号、括号写坏，以前就把整坨原文当成一条消息发出来（满屏 {"replies":…}）。打开后先请模型把那段原样修好再发，内容一个字不改；修不好才按老办法兜底。只在不是流式输出时生效。',
                cost: '只有格式坏了的那一轮多一次调用', where: '私聊 / 群聊回复' });
    } catch (e) {}

    // ---------- 1) 报错分类 ----------
    const RULES = [
        ['上下文太长', /context.?length|maximum context|context_length_exceeded|too many tokens|token limit|prompt is too long|input is too long|reduce the length|上下文.*(长|超)|超出.*(长度|上下文)|413/i,
            '发过去的内容超过了这个模型能装下的长度。在「注入内容管理」里关掉几段、把聊天历史条数或总结条数调小，或者换个上下文更长的模型。'],
        ['内容被拦截', /content.?filter|content_policy|safety|blocked|moderation|prohibited|PROHIBITED_CONTENT|SAFETY|recitation|违规|审核|敏感|不合规|拒绝生成/i,
            '这一轮的内容被模型或中转站的审核拦下了。换个说法再试，或者换个审核没那么严的模型 / 中转。'],
        ['余额或额度不够', /insufficient_quota|quota|余额|balance|credit|billing|欠费|exceeded your current|payment required|402/i,
            '这个 key 的余额或额度用完了。去服务商后台充值或换一个 key。'],
        ['密钥不对', /invalid.?api.?key|incorrect api key|unauthorized|authentication|invalid token|无效的令牌|令牌.*(无效|过期)|api key not valid|401/i,
            '密钥不对或者过期了。重新复制一遍 key（注意别带空格），确认填在对应的那一栏。'],
        ['模型或渠道不对', /model.*(not.?found|does not exist|not exist|unavailable|not supported)|no available channel|无可用渠道|模型.*(不存在|不可用)|unknown model/i,
            '这家中转没有这个模型，或者模型名写错了。点「拉取模型」从列表里选一个。'],
        ['被限流', /rate.?limit|too many requests|concurrency|429|请求过于频繁/i,
            '请求太密被限流了。等一两分钟再试；自动功能开得多的话，关掉几个后台自己跑的。'],
        ['超时', /timeout|timed out|超时|ETIMEDOUT|ESOCKETTIMEDOUT|524|408/i,
            '对面太久没回。换个响应快的模型，或者过一会儿再试；思考型模型本来就慢。'],
        ['回复格式不对', /JSON|格式不对|Unexpected token|Unexpected end|parse/i,
            '接口回了内容，但格式不是要的那样（可能被截断了，或者模型只回了思考过程）。把「最大回复长度」调大一点再试。']
    ];
    function classify(msg) { for (const [n, re, tip] of RULES) if (re.test(msg)) return { n, tip }; return null; }
    window.gyClassifyApiError = m => classify(String(m || ''));
    function hookEnhance() {
        const f = window.enhanceNetworkErrorMessage; if (typeof f !== 'function' || f.__gyCare) return;
        const w = function (raw) {
            const msg = String(raw || '');
            if (/💡/.test(msg)) return msg;
            const c = classify(msg);
            if (c && !/^(Failed to fetch|Load failed)/i.test(msg)) return msg + '\n\n💡【' + c.n + '】' + c.tip;
            return f.apply(this, arguments);
        };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyCare = true; window.enhanceNetworkErrorMessage = w; try { enhanceNetworkErrorMessage = w; } catch (e) {}
    }

    // ---------- 2) 补上「接口报错就提示一句」 ----------
    let lastMsg = '', lastAt = 0;
    function notice(d) {
        try {
            if (!d || !d.error || d.aborted) return;
            let scene = ''; try { scene = typeof window.gyInjectScene === 'function' ? window.gyInjectScene() : ''; } catch (e) {}
            if (scene === 'chat' || scene === 'group') return;   // 私聊 / 群聊自己会弹详细的
            const raw = String(d.error.message || d.error.type || d.error).slice(0, 160);
            const now = Date.now(); if (raw === lastMsg && now - lastAt < 30000) return; lastMsg = raw; lastAt = now;
            const full = typeof window.enhanceNetworkErrorMessage === 'function' ? window.enhanceNetworkErrorMessage(raw) : raw;
            const c = classify(raw);
            console.warn('[接口]', full);
            toast('接口报错' + (c ? ' · ' + c.n : ''), (c ? c.tip : full.split('\n')[0]).slice(0, 120));
        } catch (e) {}
    }
    function hookNotice() {
        ['callChatCompletionAPI', 'sendChatRequest'].forEach(name => {
            const orig = window[name]; if (typeof orig !== 'function' || orig.__gyErrNotice || orig.__gyCare) return;
            const w = async function () { const r = await orig.apply(this, arguments); notice(r); return r; };
            Object.keys(orig).forEach(k => { try { w[k] = orig[k]; } catch (e) {} }); w.__gyErrNotice = true; w.__gyCare = true; w.__gyOrig = orig;
            window[name] = w; try { if (name === 'callChatCompletionAPI') callChatCompletionAPI = w; else sendChatRequest = w; } catch (e) {}
        });
    }

    // ---------- 3) 聊天 JSON 坏了：修一次（js/05b 调这个） ----------
    window.gyRepairChatJson = async function (api, data, char) {
        try {
            if (!on('jsonRepair') || !data || data.error || data.aborted) return data;
            const raw = String((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '').trim();
            if (!raw) return data;
            if (typeof extractJsonObject === 'function') { const p = extractJsonObject(raw); if (p && (Array.isArray(p.replies) || p.stateUpdate)) return data; }
            if (!/"replies"\s*:|^\s*(```(json)?\s*)?\{/.test(raw)) return data;   // 本来就不是 JSON（模型直接说了话）：不修
            const prompt = [{ role: 'system', content: '你是 JSON 修复工具，只输出修好的 JSON 本身。' }, { role: 'user', content:
                `下面这段本来应该是一个 JSON 对象（大致格式：{"replies":[{"delay":秒数,"text":"话"}], 其它字段…}），但格式坏了解析不了。\n把它修成合法的 JSON：字符串里的英文双引号和换行要转义，字段之间用英文逗号，括号都要闭合；如果末尾被截断了，就在最后一个完整的句子处收尾闭合。\n里面的内容一个字都不要改、不要删、不要加，不要解释，不要用 \`\`\` 包起来，只输出修好的 JSON。\n\n原文：\n${raw.slice(0, 12000)}` }];
            const f = window.callChatCompletionAPI;
            const r = await f(api, prompt, 1);
            const fixed = String((r && r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || '').trim();
            const p2 = fixed && typeof extractJsonObject === 'function' ? extractJsonObject(fixed) : null;
            if (p2 && Array.isArray(p2.replies) && p2.replies.length) {
                toast('🔧 回复格式坏了，自动修了一次', (char && char.name ? char.name + ' · ' : '') + '内容没改');
                return Object.assign({}, data, { choices: [{ message: { content: fixed } }], __gyRepaired: true });
            }
        } catch (e) { console.warn('[补救] 修 JSON 失败，按老办法兜底', e); }
        return data;
    };

    // ---------- 4) 约定 ≠ 已经发生 ----------
    const GY_PL_PROMISE = `\n【约定不等于已经发生】手机聊天里说好的事（"明天去接你""周末一起去看海""等下给你打电话"）只是约定和打算。除非后来的记录里写明它真的发生了（一起出去的记录、小剧场、她确认了），否则不要把它当成已经做过的事来写——写日记、推文、信、小说时也一样：可以写期待、惦记、准备，不要写成"今天去接了她"。\n`;
    window.gyPromiseRule = function () {
        return typeof gyPL === 'function' ? gyPL('core.promise', GY_PL_PROMISE) : GY_PL_PROMISE;
    };

    function hookAll() { hookEnhance(); hookNotice(); }
    hookAll(); setInterval(hookAll, 4000);
})();
