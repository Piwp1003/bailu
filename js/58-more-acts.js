/* ===========================================================================
   js/58 —— 🎲 自主模式能做的事：把各个小功能都接上
   ---------------------------------------------------------------------------
   自主模式（「由 TA 自己决定」）原来能挑的事，大多是发推、找你聊天、写信这些"说话"类的。
   可白露里有一大堆小功能：一起看电影、一起听歌、一起读书、小游戏、打电话、钱包、商城、外卖、发照片……
   TA 自己过日子的时候，也会听歌、看剧、看书、打游戏、网购、点外卖。

   这里把它们都接进自主模式的动作表（js/14 的 GY_AUTONOMY_ACTIONS）：
     · 冲着你的：约你看电影 / 读书 / 玩游戏，给你转账发红包、点外卖、买东西、发张照片
     · 自己的日子：给自己网购、点外卖、把东西挂到商城卖，自己听歌、看剧、看书、打游戏，
                   写影评读后感、临时改日程、改签名、刷手机
     · 冲着你的还有：跟你八卦、分享歌给你、拉你进群通话；跟别人的：转发推文、联系身边的 NPC
   每一件都走各自模块现成的入口（邀请卡、钱包、商城、外卖、发图），对应的功能/开关没开就不摆上桌。
   这些事也会出现在「⏳ 时间管理大师」里，各有一张卡。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyMoreActsLoaded) return;
    window.__gyMoreActsLoaded = true;

    const isOn = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : false;
    const num = v => { const m = String(v == null ? '' : v).match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : 0; };
    const parts = p => String(p || '').split(/[|｜]/).map(x => x.trim());
    const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
    const K = k => (window.GY_INVITE_KINDS || {})[k];
    // TA 约你看片 / 读书 / 听歌：如果 TA 点了名，先把那一部 / 那本 / 那首找来导进去（片库 / 书架 / 曲库里有就用，
    // 没有就在线找），邀请卡上带着 id——你点「好啊」打开的就是那一部，而不是一个空的放映厅。
    const inviteKind = (kind) => async (c, param) => {
        if (typeof window.gyInviteFromChar !== 'function') return null;
        const [t, s] = parts(param);
        const title = String(t || '').replace(/\s+/g, ' ').trim();
        let extra = null;
        if (title && /^(film|read|music)$/.test(kind) && typeof window.gyInviteResolveItem === 'function') {
            try { extra = await window.gyInviteResolveItem(kind, title); } catch (e) { extra = null; }
        }
        let inv = null;
        inv = window.gyInviteFromChar(Object.assign({ char: c, kind, title, sub: String(s || '').trim() }, extra || {}, {
            onYes: () => { try { const k = K(kind); if (k && k.accept) k.accept(inv || { charId: String(c.id), from: 'char', title }); } catch (e) {} }
        }));
        return inv ? ((K(kind) ? K(kind).name : '邀请') + (title ? '「' + title + '」' : '')) : null;
    };
    const games = () => (typeof registeredMiniGames !== 'undefined' && Array.isArray(registeredMiniGames)) ? registeredMiniGames : [];
    const setState = (c, text) => {
        const t = clip(text, 30); if (!t) return null;
        if (typeof saveCharLifeState === 'function') saveCharLifeState(c, t, null);
        if (typeof saveAllData === 'function') saveAllData();
        return t;
    };

    /* ---------- 🎮 邀请卡多一种：TA 约你玩小游戏 ---------- */
    (function regGameKind(tries) {
        const KS = window.GY_INVITE_KINDS;
        if (KS && typeof KS === 'object') {
            if (!KS.game) KS.game = {
                ico: '🎮', name: '一起玩游戏', verb: '一起玩', go: '开玩',
                accept(inv) {
                    try {
                        const sid = String(inv.charId);
                        const g = games().find(x => inv.title && (x.name === inv.title || String(inv.title).indexOf(x.name) !== -1)) || games()[0];
                        if (!g) return;
                        if (typeof switchMainView === 'function') switchMainView('chat');
                        if (typeof switchChatSession === 'function') switchChatSession(sid);
                        if (typeof beginMiniGame === 'function') setTimeout(() => { try { beginMiniGame(g, sid, [inv.charId]); } catch (e) {} }, 200);
                    } catch (e) {}
                }
            };
            return;
        }
        if ((tries || 0) < 20) setTimeout(() => regGameKind((tries || 0) + 1), 300);
    })(0);

    /* ---------- 动作表 ---------- */
    // icon / short / desc 给时间管理大师用；cat：you＝冲着你的，self＝自己的日子，others＝跟别人
    const ACTS = [
        { key: 'film_invite', icon: '🎬', short: '约你看电影', cat: 'you', label: '约对方一起看电影',
          hint: '发一张邀请卡，对方点好啊就进放映厅；param 填片名（可不写）',
          desc: '想跟你一起看部片子，发一张邀请卡给你。',
          need: () => typeof window.gyInviteFromChar === 'function', run: inviteKind('film') },
        { key: 'read_invite', icon: '📖', short: '约你读书', cat: 'you', label: '约对方一起读书',
          hint: 'param 填书名（可不写）', desc: '想跟你一起读本书。',
          need: () => typeof window.gyInviteFromChar === 'function', run: inviteKind('read') },
        { key: 'game_invite', icon: '🎮', short: '约你玩游戏', cat: 'you', label: '约对方玩个小游戏',
          hint: () => 'param 填想玩哪个：' + games().map(g => g.name).join(' / '), desc: '手痒了，约你玩一局。',
          need: () => typeof window.gyInviteFromChar === 'function' && games().some(g => !g.minOpponents || g.minOpponents <= 1),
          run: inviteKind('game') },
        { key: 'money_user', icon: '💸', short: '给你转账', cat: 'you', label: '给对方转账或发红包',
          hint: 'param 填「金额|留言」，想发红包就在留言里写"红包"', desc: '转点钱给你：还钱、请客、就是想给。',
          need: () => isOn('walletOn') && !!(window.gyWallet && window.gyWallet.send),
          run: async (c, param) => {
              const [a, note] = parts(param); const amt = num(a) || Math.round((5 + Math.random() * 95) * 100) / 100;
              const red = /红包/.test(String(param || ''));
              const mo = await window.gyWallet.send({ from: String(c.id), to: 'me', amt, note: String((note || '').replace(/红包/g, '')).trim(), kind: red ? 'red' : 'transfer' });
              return mo ? (red ? '发了个红包 ￥' : '转账 ￥') + amt : null;
          } },
        { key: 'takeout_user', icon: '🛵', short: '给你点外卖', cat: 'you', label: '给对方点一份外卖',
          hint: 'param 填想给对方点的吃的（可不写）', desc: '惦记你吃没吃饭，给你点一份。',
          need: () => isOn('takeoutOn') && typeof window.gytoCharOrder === 'function',
          run: async (c, param) => { const r = await window.gytoCharOrder(c.id, parts(param)[0] || ''); return r ? '给你点了「' + r.shop + '」' : null; } },
        { key: 'gift_user', icon: '🎁', short: '给你买东西', cat: 'you', label: '在商城给对方买样东西',
          hint: 'param 填想买的东西（可不写）', desc: '在商城看到个东西，想起你，买下来寄给你。',
          need: () => typeof window.gymallCharBuy === 'function' && typeof window.gymallHasProducts === 'function' && window.gymallHasProducts(),
          run: async (c, param) => { const n = await window.gymallCharBuy(c.id, 'me', parts(param)[0] || ''); return n ? '给你买了「' + n + '」' : null; } },
        { key: 'photo_user', icon: '📷', short: '给你发照片', cat: 'you', label: '拍张照片发给对方',
          hint: 'param 写这张照片拍的是什么（自拍就写"自拍："开头）', desc: '看到什么想让你也看看，或者就是发张自拍。',
          need: c => typeof window.gyPhotoFromReply === 'function' && typeof window.gyPhotoModeOf === 'function' && window.gyPhotoModeOf(c.id) !== 'off',
          run: async (c, param) => {
              const d = clip(param, 80); if (!d) return null;
              const self = /^自拍/.test(d);
              const r = await window.gyPhotoFromReply(c.id, String(c.id), d.replace(/^自拍[:：]?/, ''), self);
              return r ? '发了张照片：' + d.slice(0, 20) : null;
          } },
        { key: 'shop_self', icon: '🛍️', short: '给自己网购', cat: 'self', label: '给自己网购点东西',
          hint: 'param 填想买的东西（可不写）', desc: '逛商城，给自己买点什么。',
          need: () => typeof window.gymallCharBuy === 'function' && typeof window.gymallHasProducts === 'function' && window.gymallHasProducts(),
          run: async (c, param) => { const n = await window.gymallCharBuy(c.id, String(c.id), parts(param)[0] || ''); return n ? '给自己买了「' + n + '」' : null; } },
        { key: 'sell_self', icon: '🏷️', short: '上架卖东西', cat: 'self', label: '把自己的东西挂到商城上卖',
          hint: '闲置的、自己做的、想出手的', desc: '把用不上的、自己做的东西挂到商城卖。',
          need: () => typeof window.gymallCharSell === 'function' && typeof window.gymallOpen === 'function',
          run: async (c) => { const r = await window.gymallCharSell(c.id); return r ? '在商城上架了「' + (r.name || r) + '」' : null; } },
        { key: 'takeout_self', icon: '🍱', short: '给自己点外卖', cat: 'self', label: '给自己点份外卖',
          hint: 'param 填想吃的（可不写）', desc: '懒得做饭 / 忙得顾不上，给自己点一份。',
          need: () => isOn('takeoutOn') && typeof window.gytoCharOrder === 'function',
          run: async (c, param) => { const r = await window.gytoCharOrder(c.id, parts(param)[0] || '', true); return r ? '给自己点了「' + r.shop + '」' : null; } },
        { key: 'listen_self', icon: '🎧', short: '自己听歌', cat: 'self', label: '自己听会儿歌',
          hint: 'param 填在听什么（歌名或类型）', desc: '一个人戴上耳机听会儿歌。',
          need: () => true, run: async (c, param) => { const t = setState(c, '在听' + (clip(param, 20) ? '「' + clip(param, 20) + '」' : '歌')); return t ? t : null; } },
        { key: 'watch_self', icon: '📺', short: '自己看剧', cat: 'self', label: '自己看会儿剧 / 电影 / 视频',
          hint: 'param 填在看什么', desc: '一个人窝着看点什么。',
          need: () => true, run: async (c, param) => { const t = setState(c, '在看' + (clip(param, 20) ? '「' + clip(param, 20) + '」' : '剧')); return t ? t : null; } },
        { key: 'read_self', icon: '📚', short: '自己看书', cat: 'self', label: '自己看会儿书',
          hint: 'param 填在看什么书', desc: '一个人安安静静看会儿书。',
          need: () => true, run: async (c, param) => { const t = setState(c, '在看' + (clip(param, 20) ? '《' + clip(param, 20).replace(/[《》]/g, '') + '》' : '书')); return t ? t : null; } },
        { key: 'play_self', icon: '🕹️', short: '自己打游戏', cat: 'self', label: '自己玩会儿游戏',
          hint: 'param 填在玩什么', desc: '一个人打会儿游戏。',
          need: () => true, run: async (c, param) => { const t = setState(c, '在玩' + (clip(param, 20) || '游戏')); return t ? t : null; } }
    ];
    /* ---------- 第二批：转发、影评读后感、改日程、改签名、刷手机、八卦、分享歌、拉群通话、找 NPC ---------- */
    const api0 = () => (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
    async function say(c, ask, max) {
        const api = api0(); if (!api || !api.key || typeof callChatCompletionAPI !== 'function') return '';
        const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name);
        const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
        const d = await callChatCompletionAPI(api, msgs, 1);
        let t = ((d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '').trim();
        if (typeof extractAfterFinalMarker === 'function') { try { t = extractAfterFinalMarker(t).trim(); } catch (e) {} }
        return t.replace(/^["「“]|["」”]$/g, '').slice(0, max || 400);
    }
    const newPost = (c, text, extra) => {
        const post = Object.assign({ id: 'p_' + Date.now() + Math.floor(Math.random() * 1000), char: c, text, timestamp: Date.now(), replies: [],
            stats: { retweets: 0, likes: 0, views: Math.floor(Math.random() * 300), comments: 0 } }, extra || {});
        if (typeof globalPosts !== 'undefined') globalPosts.unshift(post);
        if (typeof saveAllData === 'function') saveAllData();
        try { const v = document.getElementById('view-home'); if ((!v || v.style.display !== 'none') && typeof renderPosts === 'function') renderPosts(); } catch (e) {}
        return post;
    };
    // TA 最近自己听过 / 看过 / 读过的（给影评读后感当素材）
    const consumed = c => (c.autonomyLog || []).filter(l => l && l.ok !== false && /^(listen_self|watch_self|read_self|film_invite|read_invite|music_invite)$/.test(l.action))
        .slice(-6).map(l => l.result).filter(Boolean);
    const groupsOf = c => (typeof groupChats !== 'undefined' && Array.isArray(groupChats) ? groupChats : []).filter(g => g && Array.isArray(g.members) && g.members.map(String).includes(String(c.id)));
    const npcsOf = c => { try { return typeof window.gyNpcPool === 'function' ? window.gyNpcPool(c.id) : []; } catch (e) { return []; } };
    const rumorsOf = c => { try { return typeof window.gygsRumorsFor === 'function' ? window.gygsRumorsFor(c.id) : []; } catch (e) { return []; } };

    // 🎧 邀请卡再多一种：拉你进群通话
    (function regGroupCall(tries) {
        const KS = window.GY_INVITE_KINDS;
        if (KS && typeof KS === 'object') {
            if (!KS.groupcall) KS.groupcall = { ico: '📞', name: '群通话', verb: '一起进群通话', go: '进通话',
                openOnYes: true,
                accept(inv) { try { const c0 = String(inv.charId); const gs = (typeof groupChats !== 'undefined' ? groupChats : []);
                    const g = (inv.data && inv.data.groupId && gs.find(x => x && String(x.id) === String(inv.data.groupId)))
                        || gs.find(x => x && x.name === inv.title && (x.members || []).map(String).includes(c0));
                    // TA 拉的群通话：发起人是 TA，TA 不用再被问"接不接"，接通后也是 TA 先开口
                    if (g && typeof window.gyGroupCallStart === 'function') window.gyGroupCallStart(g, inv.from === 'me' ? {} : { by: c0 }); } catch (e) {} } };
            return;
        }
        if ((tries || 0) < 20) setTimeout(() => regGroupCall((tries || 0) + 1), 300);
    })(0);

    ACTS.push(
        { key: 'retweet', icon: '🔁', short: '转发推文', cat: 'others', label: '转发别人的推文（带一句自己的话）',
          hint: 'param 填「那条推文里的几个字|转发时你想说的话」', desc: '刷到一条推，转出来，顺便说一句。',
          need: c => typeof globalPosts !== 'undefined' && globalPosts.some(p => p && p.char && String(p.char.id) !== String(c.id) && !p.isStory),
          run: async (c, param) => {
              const [k, words] = parts(param);
              const pool = globalPosts.filter(p => p && p.char && String(p.char.id) !== String(c.id) && !p.isStory).slice(0, 20);
              const target = (k && pool.find(p => String(p.text || '').indexOf(k) !== -1)) || pool[Math.floor(Math.random() * Math.min(6, pool.length))];
              if (!target) return null;
              target.stats = target.stats || {}; target.stats.retweets = (parseInt(target.stats.retweets) || 0) + 1;
              const post = newPost(c, clip(words, 140) || '转发', { quotedPostId: target.id });
              return { text: '转发了 ' + (target.char.name || '') + ' 的推文', jump: { view: 'postDetail', param: post.id } };
          } },
        { key: 'review', icon: '✍️', short: '写影评读后感', cat: 'self', label: '看完 / 读完 / 听完之后写点感想发出来',
          hint: () => 'param 填写的是哪部 / 哪本 / 哪首（可不写）' , desc: '看完一部片、读完一本书、听了首歌，写一段真实的感想发出来。',
          need: c => consumed(c).length > 0 || !!(c.lifeState && /在(看|听|读|玩)/.test(c.lifeState.activity || '')),
          run: async (c, param) => {
              const what = clip(param, 30) || consumed(c).slice(-1)[0] || (c.lifeState && c.lifeState.activity) || '';
              const t = await say(c, `你最近${what ? '「' + what + '」' : '看了 / 读了 / 听了点东西'}。写一段真实的感想发到你的主页上（影评 / 读后感 / 乐评都行，按你的性格，可长可短，80 到 220 字），不要标题、不要引号、不要解释，直接输出正文。`, 400);
              if (!t) return null;
              const post = newPost(c, t);
              return { text: '写了段感想：' + t.slice(0, 20), jump: { view: 'postDetail', param: post.id } };
          } },
        { key: 'schedule_change', icon: '🗓️', short: '改日程', cat: 'self', label: '临时改一下自己今天的安排',
          hint: 'param 填「几点|要做的事」（几点可不写，就是现在）；想取消什么就写"取消某某"', desc: '碰上了事、改了主意，临时加一件事或者不去了。',
          need: () => true,
          run: async (c, param) => {
              let [a, b] = parts(param); if (!b) { b = a; a = ''; }
              b = clip(b, 30); if (!b) return null;
              const now = new Date();
              const hm = /^\d{1,2}[:：]\d{2}$/.test(a || '') ? a.replace('：', ':') : (String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'));
              c.schedule = c.schedule || { text: '', generatedAt: Date.now() };
              c.schedule.text = String(c.schedule.text || '').replace(/\s+$/, '') + '\n' + hm + ' ' + b + '（临时改的）';
              c.schedule.edited = Date.now();
              if (typeof saveAllData === 'function') saveAllData();
              return { text: '改了日程：' + hm + ' ' + b, jump: { view: 'profile', param: String(c.id) } };
          } },
        { key: 'bio_update', icon: '🪪', short: '改签名', cat: 'self', label: '改一下自己主页的签名 / 简介',
          hint: 'param 填新的签名', desc: '心情变了、发生了什么事，换一句签名。',
          need: () => true,
          run: async (c, param) => {
              const t = String(param || '').trim(); if (!t || t === c.bio) return null;
              c.bioHistory = (c.bioHistory || []).concat(c.bio ? [{ at: Date.now(), bio: c.bio }] : []);
              c.bio = t;
              if (typeof saveAllData === 'function') saveAllData();
              return { text: '签名改成了「' + t + '」', jump: { view: 'profile', param: String(c.id) } };
          } },
        { key: 'phone_scroll', icon: '📲', short: '刷手机', cat: 'self', label: '刷会儿手机（小红书、朋友圈、短视频……）',
          hint: 'param 填「刷的什么|看到了什么」', desc: '随手刷会儿手机，看到点什么。',
          need: () => true,
          run: async (c, param) => {
              const [app, saw] = parts(param);
              const t = setState(c, '在刷' + (clip(app, 10) || '手机')); if (!t) return null;
              if (saw && typeof window.gyLifeEvent === 'function') window.gyLifeEvent(c.id, '刷' + (clip(app, 10) || '手机') + '时看到：' + clip(saw, 40), 0.2);
              return { text: t + (saw ? '，看到' + clip(saw, 20) : ''), jump: { fn: 'gyPhoneOpen', args: [String(c.id)] } };
          } },
        { key: 'gossip_tell', icon: '🗣️', short: '跟你八卦', cat: 'you', label: '把听来的八卦讲给对方',
          hint: '从你听说过的传闻里挑一件讲', desc: '听说了点别人的事，忍不住来跟你说。',
          need: c => typeof window.gygsTell === 'function' && rumorsOf(c).length > 0,
          run: async (c) => { const rs = rumorsOf(c); if (!rs.length) return null; const r = rs[Math.floor(Math.random() * rs.length)];
              const t = await window.gygsTell(r.id, c.id); return t ? { text: '跟你八卦了一件事', jump: { chat: String(c.id) }, selfNotified: true } : null; } },
        { key: 'song_share', icon: '🎶', short: '分享歌给你', cat: 'you', label: '分享一首歌给对方',
          hint: 'param 填「歌名|歌手|想说的一句话」', desc: '听到一首歌，想让你也听听。',
          need: () => true,
          run: async (c, param) => {
              const [title, artist, words] = parts(param);
              const t = clip(title, 40); if (!t) return null;
              let found = null;
              try { if (typeof window.gyResSearch === 'function') found = (await window.gyResSearch('music', (t + ' ' + (artist || '')).trim(), { only: 'itunes', limit: 1 }))[0] || null; } catch (e) {}
              let inBox = false;
              if (found && found.url && typeof window.gymAddTrack === 'function') { window.gymAddTrack({ title: found.title, artist: found.artist, cover: found.cover, src: found.url, note: c.name + ' 分享的 · 30 秒试听' }, '💌 TA 分享的'); inBox = true; }
              const sid = String(c.id);
              if (typeof globalChats !== 'undefined') {
                  if (!globalChats[sid]) globalChats[sid] = [];
                  globalChats[sid].push({ sender: c.id, text: `🎵 分享了一首歌：《${found ? found.title : t}》${(found ? found.artist : artist) ? ' — ' + (found ? found.artist : artist) : ''}${words ? '\n' + clip(words, 60) : ''}${inBox ? '\n（已经放进你的音乐盒「💌 TA 分享的」里，能试听）' : ''}`, timestamp: Date.now(), readBy: [] });
                  if (typeof saveAllData === 'function') saveAllData();
                  try { if (typeof currentChatSessionId !== 'undefined' && String(currentChatSessionId) === sid && typeof renderChatMessages === 'function') renderChatMessages(); } catch (e) {}
              }
              return { text: '分享了《' + (found ? found.title : t) + '》', jump: inBox ? { feature: 'music' } : { chat: sid } };
          } },
        { key: 'group_call', icon: '📞', short: '拉群通话', cat: 'you', label: '在群里拉大家一起语音',
          hint: () => 'param 填哪个群（可不写）', desc: '想跟群里的人一起聊会儿，拉个群通话。',
          need: c => typeof window.gyGroupCallStart === 'function' && typeof window.gyInviteFromChar === 'function' && groupsOf(c).length > 0,
          run: async (c, param) => {
              const gs = groupsOf(c); const k = clip(param, 20);
              const g = (k && gs.find(x => String(x.name || '').indexOf(k) !== -1)) || gs[Math.floor(Math.random() * gs.length)];
              if (!g) return null;
              const inv = window.gyInviteFromChar({ char: c, kind: 'groupcall', title: g.name || '群', sub: (g.members || []).length + ' 个人',
                  data: { groupId: String(g.id) },
                  onYes: () => { try { window.gyGroupCallStart(g, { by: String(c.id) }); } catch (e) {} } });
              return inv ? { text: '拉你进「' + (g.name || '群') + '」的群通话', jump: { chat: String(c.id) }, selfNotified: true } : null;
          } },
        { key: 'npc_contact', icon: '👤', short: '找身边的人', cat: 'others', label: '用手机联系身边的人（世界书里的 NPC 熟人）',
          hint: () => 'param 填找谁',
          desc: '家人、同事、朋友、邻居……世界书里那些人，TA 也会联系。聊的内容存在 TA 的手机里。',
          need: c => npcsOf(c).length > 0 && typeof window.gyPhoneIntake === 'function',
          run: async (c, param) => {
              const ns = npcsOf(c); const k = clip(param, 20);
              const n = (k && ns.find(x => x.name && (x.name.indexOf(k) !== -1 || k.indexOf(x.name) !== -1))) || ns[Math.floor(Math.random() * ns.length)];
              if (!n) return null;
              const raw = await say(c, `你拿起手机，想联系「${n.name}」（${[n.who, n.tie].filter(Boolean).join('，')}${n.persona ? '；' + clip(n.persona, 80) : ''}）。按你们的关系写一段你们俩的对话（3 到 8 句，一人一句来回），要具体，接着你最近的生活。
每句一行，格式：说话人名字：内容。只输出对话。`, 800);
              const lines = String(raw || '').split('\n').map(l => l.match(/^\s*([^:：]{1,12})[:：]\s*(.+)$/)).filter(Boolean).slice(0, 10);
              if (!lines.length) return null;
              const tm = new Date(); const hm = String(tm.getHours()).padStart(2, '0') + ':' + String(tm.getMinutes()).padStart(2, '0');
              const packed = lines.map(m => { const who = m[1].trim(); const me = who === c.name || /^(我|自己)$/.test(who);
                  return `<msg>${me ? c.name : n.name}|${me ? n.name : c.name}|${clip(m[2], 120).replace(/\|/g, '｜')}|${hm}</msg>`; }).join('\n');
              const r = window.gyPhoneIntake(c, packed, { phoneOnly: true });
              if (!r || !r.logged || !r.logged.msg) return null;
              if (typeof window.gyLifeEvent === 'function') window.gyLifeEvent(c.id, '跟' + n.name + '聊了几句：' + clip(lines[lines.length - 1][2], 30), 0.2);
              return { text: '跟' + n.name + '聊了几句', jump: { fn: 'gyPhoneOpenApp', args: [String(c.id), 'msg'] } };
          } }
    );

    /* ---------- 第三批：论坛回帖、匿名区回帖、自己发朋友圈、偷翻你的日记 ---------- */
    window.gyOpenForum = function (id) { try { switchMainView('novel'); setTimeout(() => { try { openForumThread(id); } catch (e) {} }, 80); } catch (e) {} };
    window.gyOpenMyDiary = function () { try { switchMainView('diary'); setTimeout(() => { try { switchDiaryTab('mydiary'); } catch (e) {} }, 80); } catch (e) {} };
    const threadsFor = c => (typeof forumThreads !== 'undefined' && Array.isArray(forumThreads) ? forumThreads : [])
        .filter(t => t && String(t.charId || '') !== String(c.id) && t.author !== c.name).slice(0, 12);
    const anonFor = c => (typeof anonPosts !== 'undefined' && Array.isArray(anonPosts) ? anonPosts : [])
        .filter(p => p && String(p.charId) !== String(c.id)).slice(0, 12);
    // 用户没让 TA 看的日记（「谁可以偷看」里没勾 TA）、TA 也还没偷翻过的
    const forbiddenDiaries = c => (typeof globalUserDiaries !== 'undefined' && Array.isArray(globalUserDiaries) ? globalUserDiaries : [])
        .filter(d => d && d.mode !== 'invite' && !(d.reactions || []).some(r => String(r.charId) === String(c.id))
            && !(d.secretPeeks || []).some(p => String(p.charId) === String(c.id))).slice(0, 6);
    const pj = t => { try { const r = (typeof parseModelJson === 'function') ? parseModelJson(t) : JSON.parse(t); return Array.isArray(r) ? r[0] : r; } catch (e) { return null; } };

    ACTS.push(
        { key: 'forum_reply', icon: '💬', short: '论坛回帖', cat: 'others', label: '去小说论坛回别人的帖子',
          hint: 'param 填帖子标题里的几个字（可不写）', desc: '逛论坛，看到感兴趣的帖子回一句。',
          need: c => threadsFor(c).length > 0,
          run: async (c, param) => {
              const ts = threadsFor(c); const k = clip(param, 20);
              const th = (k && ts.find(t => String(t.title || '').indexOf(k) !== -1)) || ts[Math.floor(Math.random() * Math.min(5, ts.length))];
              if (!th) return null;
              const recent = (th.replies || []).slice(-5).map(r => `${r.floor}楼 [${r.author}]：${clip(r.content, 60)}`).join('\n');
              const t = await say(c, `你在逛小说论坛，点进了帖子《${th.title}》。\n主楼：${clip(th.content, 200)}\n${recent ? '最近的回复：\n' + recent + '\n' : ''}按你的人设回一句（不超过 60 字），像真人逛论坛那样，直接输出回复内容。没什么想说的就只输出 NO。`, 200);
              if (!t || /^NO\b/i.test(t)) return null;
              if (!th.replies) th.replies = [];
              const floor = th.replies.length ? th.replies[th.replies.length - 1].floor + 1 : 2;
              th.replies.push({ floor, author: c.name, charId: c.id, isOp: false, content: t, quoteFloor: null, likes: 0, timestamp: Date.now() });
              if (typeof saveAllData === 'function') saveAllData();
              return { text: '在论坛《' + clip(th.title, 14) + '》回了帖', jump: { fn: 'gyOpenForum', args: [th.id] } };
          } },
        { key: 'anon_reply', icon: '🕶️', short: '匿名区回帖', cat: 'others', label: '去匿名区回别人的帖子',
          hint: 'param 填帖子里的几个字（可不写）', desc: '匿名回一句实名不好说的话。',
          need: c => anonFor(c).length > 0,
          run: async (c, param) => {
              const ps = anonFor(c); const k = clip(param, 20);
              const p = (k && ps.find(x => String(x.text || '').indexOf(k) !== -1)) || ps[Math.floor(Math.random() * Math.min(5, ps.length))];
              if (!p) return null;
              const t = await say(c, `你在逛匿名论坛，看到一条帖子：「${clip(p.text, 200)}」。匿名只是不署真名，你还是你。按你的人设回一句（不超过 60 字），直接输出内容；没什么想说的就只输出 NO。`, 200);
              if (!t || /^NO\b/i.test(t)) return null;
              if (!p.replies) p.replies = [];
              p.replies.push({ charId: c.id, anonName: c.anonName || '匿名者', anonId: c.anonId || Math.random().toString(36).slice(2, 8).toUpperCase(), text: t, timestamp: Date.now() });
              p.stats = p.stats || { likes: 0, comments: 0 }; p.stats.comments = (p.stats.comments || 0) + 1;
              if (typeof saveAllData === 'function') saveAllData();
              // 匿名区：通知里不写是谁，只说"有人匿名回了一条"
              return { text: '在匿名区回了一条', jump: { view: 'anonForum' }, anonymous: true };
          } },
        { key: 'moment_self', icon: '🌀', short: '发朋友圈', cat: 'self', label: '发一条朋友圈（只有熟人看得到）',
          hint: 'param 填想发的内容（可不写，写个大概也行）', desc: '不发推，发条只给熟人看的朋友圈；认识的人可能会来评论。存在 TA 的手机里。',
          need: () => typeof window.gyPeerLog !== 'undefined',
          run: async (c, param) => {
              let known = []; try { if (typeof window.gyPeerRelsOf === 'function') known = window.gyPeerRelsOf(c.id); } catch (e) {}
              const raw = await say(c, `你想发一条朋友圈（只有熟人看得到，比推文更私人）。${param ? '大概想发：' + clip(param, 60) + '。' : ''}
${known.length ? '能看到的熟人：' + known.map(k => k.name + (k.back ? '（TA 对你：' + k.back + '）' : '')).join('、') + '。按关系，可能有 0 到 2 个人来评论。' : '暂时没有熟人会来评论。'}
只输出 JSON：{"moment":"朋友圈正文，60字以内","comments":[{"who":"评论的人名字","t":"评论内容"}]}`, 800);
              const r = pj(raw);
              const text = clip((r && r.moment) || '', 200); if (!text) return null;
              const cm = ((r && r.comments) || []).filter(x => x && known.some(k => k.name === x.who)).slice(0, 3).map(x => ({ by: x.who, t: clip(x.t, 60) }));
              if (!Array.isArray(window.gyPeerLog)) window.gyPeerLog = [];
              window.gyPeerLog.push({ id: 'pe_m' + Date.now().toString(36), at: Date.now(), kind: 'moment', aId: c.id, bId: null, aName: c.name, bName: '', summary: '发了条朋友圈', lines: [], moment: text, cm });
              if (typeof saveAllData === 'function') saveAllData();
              return { text: '发了条朋友圈：' + text.slice(0, 18), jump: { fn: 'gyPhoneOpenApp', args: [String(c.id), 'moment'] } };
          } },
        { key: 'diary_peek', icon: '👣', short: '偷翻你的日记', cat: 'you', secret: true, label: '偷偷翻对方没让你看的日记',
          hint: '对方没让你看的那几篇。看不看、看了会不会心虚、会不会留下痕迹，全看你这个人',
          desc: '你没勾 TA 的日记，TA 也可能按自己的性子去偷翻——翻了会留下点痕迹，你能发现，也能去质问；TA 会记得这件事，被问起时按人设应对。',
          need: c => forbiddenDiaries(c).length > 0,
          run: async (c) => {
              const ds = forbiddenDiaries(c); const d = ds[Math.floor(Math.random() * ds.length)];
              if (!d) return null;
              const who = (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
              const raw = await say(c, `${who}有一篇日记《${d.title || '无题'}》放在那儿，**${who}没让你看**。
你现在正好有机会翻开它。按你的性格、你们的关系、你此刻的心情决定：看，还是不看。
如果看了，日记内容是：「${clip(d.content, 500)}」
看了的话，人总会不小心留下点痕迹（比如页角折了、书签挪了、沾了点什么、东西没放回原位……要跟你这个人、你此刻在做的事有关，具体一点，但别直接写出你的名字）。
只输出 JSON：{"look":true或false,"why":"你心里怎么想的，20字以内","trace":"看了的话留下的痕迹，25字以内；没看留空","remember":"看了的话，你记住的内容/感受，30字以内；没看留空"}`, 600);
              const r = pj(raw);
              if (!r) return null;
              if (!r.look) return { text: '犹豫了一下，没翻', selfNotified: true, secret: true };
              const peek = { charId: c.id, at: Date.now(), trace: clip(r.trace, 40) || '好像被人动过', remember: clip(r.remember, 60), why: clip(r.why, 30), found: false };
              if (!Array.isArray(d.secretPeeks)) d.secretPeeks = [];
              d.secretPeeks.push(peek);
              if (!Array.isArray(c.diaryPeeks)) c.diaryPeeks = [];
              c.diaryPeeks.push({ entryId: d.id, title: d.title || '无题', at: peek.at, trace: peek.trace, remember: peek.remember, why: peek.why });
              if (typeof saveAllData === 'function') saveAllData();
              // 🔔 通知不说是谁——只说"好像被人翻过"和那个痕迹，要不要去质问、质问谁，你自己判断
              if (typeof window.gyNotifyJump === 'function') window.gyNotifyJump(null, `👣 你的日记《${d.title || '无题'}》好像被人翻过`, peek.trace, { fn: 'gyOpenMyDiary' });
              try { if (typeof renderMyDiaryArea === 'function' && document.getElementById('myDiaryListContainer')) renderMyDiaryArea(); } catch (e) {}
              return { text: '（这件事 TA 不想让你知道）', selfNotified: true, secret: true };
          } }
    );
    // TA 偷翻过你的日记：记在心里，进 prompt。你问起时按人设应对（承认、狡辩、装傻……）
    window.__gyPeekCtxFor = function (charId) {
        try {
            const c = (typeof myCharacters !== 'undefined' ? myCharacters : []).find(x => String(x.id) === String(charId));
            const ps = (c && c.diaryPeeks) || []; if (!ps.length) return '';
            const who = (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
            const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? m + ' 分钟前' : m < 1440 ? Math.round(m / 60) + ' 小时前' : Math.round(m / 1440) + ' 天前'; };
            return `【你心里清楚、${who}不一定知道的事】\n` + ps.slice(-3).map(p => `· ${ago(p.at)}你偷偷翻过${who}的日记《${p.title}》（${who}没让你看）。${p.remember ? '你记得：' + p.remember + '。' : ''}当时可能留下了痕迹：${p.trace}。`).join('\n')
                + `\n${who}可能已经发现了。如果${who}问起、质问你，按你的人设来：承认、道歉、狡辩、装傻、反问、恼羞成怒都行，但你心里知道这件事真的发生过，别忘了。没被问起就别主动说漏嘴（除非你就是那种藏不住的人）。`;
        } catch (e) { return ''; }
    };

    /* ---------- 🪪 过往签名 ---------- */
    window.gyBioHistory = function (charId) {
        const c = (typeof myCharacters !== 'undefined' ? myCharacters : []).find(x => String(x.id) === String(charId)); if (!c) return;
        const h = (c.bioHistory || []).slice().reverse();
        const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
        const d = t => { const x = new Date(t); return (x.getMonth() + 1) + '月' + x.getDate() + '日 ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };
        let m = document.getElementById('gyBioHistModal'); if (m) m.remove();
        m = document.createElement('div'); m.id = 'gyBioHistModal'; m.className = 'modal-overlay'; m.style.cssText = 'display:flex;z-index:99990;';
        m.onclick = ev => { if (ev.target === m) m.remove(); };
        m.innerHTML = `<div class="modal-box" style="width:min(420px,92vw);max-height:80vh;overflow-y:auto;">
            <h2 style="margin-top:0;">🕘 ${esc(c.name)} 的过往签名</h2>
            <div style="padding:10px 12px;border-radius:12px;background:rgba(29,155,240,.08);margin-bottom:10px;"><div style="font-size:11.5px;opacity:.6;">现在</div><div style="font-size:14.5px;margin-top:2px;">${esc(c.bio || '（没有签名）')}</div></div>
            ${h.length ? h.map(x => `<div style="padding:9px 4px;border-bottom:1px dashed rgba(139,152,165,.35);"><div style="font-size:11.5px;opacity:.55;">换掉于 ${d(x.at)}</div><div style="font-size:14px;margin-top:2px;">${esc(x.bio)}</div></div>`).join('') : '<div style="font-size:13px;opacity:.6;">还没换过签名。</div>'}
            <button type="button" class="btn-cancel" style="margin-top:12px;" onclick="document.getElementById('gyBioHistModal').remove()">好</button></div>`;
        document.body.appendChild(m);
    };
    // 你在角色编辑页改签名，也记一笔
    window.gyBioRemember = function (c, oldBio) {
        try { if (!c || !oldBio || oldBio === c.bio) return; c.bioHistory = (c.bioHistory || []).concat([{ at: Date.now(), bio: oldBio }]); } catch (e) {}
    };

    window.GY_MORE_ACTS = ACTS;

    (function reg(tries) {
        try {
            if (typeof GY_AUTONOMY_ACTIONS !== 'undefined' && Array.isArray(GY_AUTONOMY_ACTIONS)) {
                ACTS.forEach(a => {
                    if (GY_AUTONOMY_ACTIONS.some(x => x.key === a.key)) return;
                    // hint 可以是函数（比如游戏列表要现读）：挂成 getter，决策时读到的是最新的
                    const item = Object.assign({}, a);
                    if (typeof a.hint === 'function') Object.defineProperty(item, 'hint', { get: a.hint, enumerable: true });
                    const at = GY_AUTONOMY_ACTIONS.findIndex(x => x.key === 'nothing');
                    GY_AUTONOMY_ACTIONS.splice(at < 0 ? GY_AUTONOMY_ACTIONS.length : at, 0, item);
                });
                return;
            }
        } catch (e) {}
        if ((tries || 0) < 20) setTimeout(() => reg((tries || 0) + 1), 300);
    })(0);
})();
