/* ===========================================================================
   js/66 —— 📱 小手机：更多小组件 + 每个小组件的款式
   ---------------------------------------------------------------------------
   只在小手机模式的桌面上出现，不动白露原来的任何页面。
   · 老的几个多了款式：时钟（细体/翻页/竖排/文字）、指针时钟（白/黑/极简）、
     日历（照片/大日期/撕页、月历/今天的安排）、音乐（卡片/黑胶/细条）、
     相片（满版/拍立得/心形/圆形/胶片，可以随机轮换）、电量（圆环/横条）
   · 新的：今日一句、今日运势、今天吃什么、我和 TA、TA 的动态、搜索条、
     胶囊标签、今天心情、年度进度
   · 能随机的都能随机：点一下换一句 / 再摇一次 / 换一条动态 / 相片随机换
   颜色（白/黑/灰/玻璃/奶油/玫瑰/雾蓝/鼠尾草/摩卡/墨绿）是 js/63 统一做的，这里只管款式。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyPmWidgetsLoaded) return;
    window.__gyPmWidgetsLoaded = true;

    function boot() {
        const X = window.__gyPmW;
        if (!X) return false;
        const { WD, T, esc, pad, dial, MSV, fmtT, plain, charOf, firstChar, lastOf, WK, WKE, MON, G } = X;
        const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
        const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
        const rng = seed => { let a = hash(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
        const pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];
        const V = w => (w.d && w.d.v) || '';
        const set = (w, k, v) => { w.d = Object.assign({}, w.d || {}, { [k]: v }); X.save(); };
        // 只重画这一个小组件（摇骰子、换一句的时候不整页闪）
        function paint(w) {
            document.querySelectorAll(`#gyPmHome [data-wid="${w.id}"]`).forEach(el => {
                const del = el.querySelector('.pm-del'); el.innerHTML = ''; if (del) el.appendChild(del);
                let h = ''; try { h = WD[w.k].r(w); } catch (e) {}
                el.insertAdjacentHTML('beforeend', h);
            });
        }
        const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };
        const chars = () => (G().chars ? G().chars() : []);
        const chipsFor = (w, key, list, dflt) => `<div class="chips">${list.map(([v, n]) => `<span class="chip${String((w.d && w.d[key]) || dflt || '') === String(v) ? ' on' : ''}" onclick="gyPmWSet('${w.id}','${key}','${esc(v)}')">${n}</span>`).join('')}</div>`;

        /* ============ 老小组件：加款式 ============ */
        const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
        const cnNum = n => n <= 10 ? CN[n] : n < 20 ? '十' + (n % 10 ? CN[n % 10] : '') : CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
        const period = h => h < 5 ? '凌晨' : h < 8 ? '清晨' : h < 11 ? '上午' : h < 13 ? '中午' : h < 18 ? '下午' : h < 20 ? '傍晚' : '晚上';
        const clk0 = WD.clock.r;
        WD.clock.vars = [['', '常规'], ['thin', '细体'], ['flip', '翻页'], ['stack', '竖排'], ['word', '文字']];
        WD.clock.r = function (w) {
            const v = V(w), d = new Date(), H = pad(d.getHours()), M = pad(d.getMinutes()), big = w.size !== 's';
            if (v === 'thin') return `<div class="wx-ck thin${big ? ' m' : ''}"><b class="pm-hf">${H}<i>:</i>${M}</b><span>${d.getMonth() + 1}月${d.getDate()}日 · 星期${WK[d.getDay()]}</span></div>`;
            if (v === 'flip') return `<div class="wx-ck flip${big ? ' m' : ''}"><div class="fc"><b>${H}</b></div><div class="fc"><b>${M}</b></div>${big ? `<span>${WKE[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}</span>` : ''}</div>`;
            if (v === 'stack') return `<div class="wx-ck stack${big ? ' m' : ''}"><b class="pm-hf">${H}</b><b class="pm-hf">${M}</b><span>${WKE[d.getDay()]}<br>${d.getMonth() + 1}.${d.getDate()}</span></div>`;
            if (v === 'word') { const h = d.getHours(), h12 = h % 12 || 12, m = d.getMinutes(); return `<div class="wx-ck word${big ? ' m' : ''}"><span>${T(w, 'pre', '现在是')}</span><b class="pm-hf">${period(h)}${cnNum(h12)}点${m === 0 ? '整' : m === 30 ? '半' : cnNum(m) + '分'}</b><span>${d.getMonth() + 1}月${d.getDate()}日 星期${WK[d.getDay()]}</span></div>`; }
            return clk0.call(this, w);
        };
        // 指针时钟：白 / 黑 / 极简（只有四个刻度）
        const ac0 = WD.aclock.r;
        WD.aclock.vars = [['', '白'], ['black', '黑'], ['mini', '极简']];
        function miniDial(size) {
            const d = new Date(), h = d.getHours() % 12, m = d.getMinutes(), ha = (h + m / 60) * 30 * Math.PI / 180, ma = m * 6 * Math.PI / 180;
            return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="dial mini"><circle cx="50" cy="50" r="48" fill="var(--pm-card)" stroke="var(--pm-hair)"/>${[0, 90, 180, 270].map(a => { const r = a * Math.PI / 180; return `<line x1="${50 + 40 * Math.sin(r)}" y1="${50 - 40 * Math.cos(r)}" x2="${50 + 46 * Math.sin(r)}" y2="${50 - 46 * Math.cos(r)}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`; }).join('')}<line x1="50" y1="50" x2="${50 + 22 * Math.sin(ha)}" y2="${50 - 22 * Math.cos(ha)}" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><line x1="50" y1="50" x2="${50 + 36 * Math.sin(ma)}" y2="${50 - 36 * Math.cos(ma)}" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="50" cy="50" r="3" fill="var(--pm-red)"/></svg>`;
        }
        WD.aclock.r = function (w) {
            const v = V(w);
            if (w.size === 's' && v === 'black') return `<div class="wg-ac s">${dial('', true, 118)}</div>`;
            if (w.size === 's' && v === 'mini') return `<div class="wg-ac s">${miniDial(118)}</div>`;
            if (w.size === 'm' && v === 'mini') { const d = new Date(); return `<div class="wx-acm">${miniDial(112)}<div><b class="pm-hf">${pad(d.getHours())}:${pad(d.getMinutes())}</b><span>${d.getMonth() + 1}月${d.getDate()}日<br>星期${WK[d.getDay()]}</span></div></div>`; }
            return ac0.call(this, w);
        };
        WD.aclock.edit = null;
        // 日历
        const cal0 = WD.cal.r;
        WD.cal.vars = [['', '照片', ['s']], ['big', '大日期', ['s']], ['tear', '撕页', ['s']], ['', '月历', ['m']], ['list', '今天的安排', ['m']]];
        WD.cal.r = function (w) {
            const v = V(w), d = new Date();
            if (w.size === 's' && v === 'big') return `<div class="wx-cb"><em>${WKE[d.getDay()]}</em><b class="pm-hf">${d.getDate()}</b><span>${d.getFullYear()} · ${MON[d.getMonth()]}</span></div>`;
            if (w.size === 's' && v === 'tear') return `<div class="wx-ct"><div class="hd"><i></i><i></i></div><em>${d.getMonth() + 1}月</em><b class="pm-hf">${d.getDate()}</b><span>星期${WK[d.getDay()]}</span></div>`;
            if (w.size === 'm' && v === 'list') {
                let x = { mine: [], anniv: [], birth: [] }; try { if (window.gyMyCalDay) x = window.gyMyCalDay(today()); } catch (e) {}
                const rows = [...x.mine.map(i => [i.time || '', i.text || '']), ...x.anniv.map(t => ['纪念日', t]), ...x.birth.map(t => ['生日', t + ' 的生日'])];
                return `<div class="wx-cl"><div class="l"><em>${WKE[d.getDay()]}</em><b class="pm-hf">${d.getDate()}</b></div><div class="r">${rows.length ? rows.slice(0, 3).map(r => `<div class="ev"><i></i><div><b>${esc(r[1])}</b>${r[0] ? `<span>${esc(r[0])}</span>` : ''}</div></div>`).join('') : `<div class="none">${T(w, 'none', '今天没有安排')}<br><small>${T(w, 'none2', '点一下去日历记一条')}</small></div>`}</div></div>`;
            }
            return cal0.call(this, w);
        };
        const calEdit0 = WD.cal.edit;
        WD.cal.edit = w => (w.size === 's' && V(w) ? '' : calEdit0(w));
        // 音乐：多一个小号（黑胶）和长条
        const mu0 = WD.music.r;
        WD.music.sizes = ['s', 'm', 'x'];
        WD.music.vars = [['', '卡片', ['m']], ['vinyl', '黑胶', ['s', 'm']], ['bar', '细条', ['x']]];
        WD.music.r = function (w) {
            const m = typeof window.gymNowInfo === 'function' ? window.gymNowInfo() : null, v = V(w);
            const pp = `<span data-mc="toggle" class="pp">${m && m.playing ? MSV.pause : MSV.play}</span>`;
            const cov = m && m.cover ? `style="background-image:url('${esc(m.cover)}')"` : '';
            if (w.size === 'x') return `<div class="wx-mx"><div class="cv${cov ? '' : ' e'}" ${cov}>${cov ? '' : MSV.note}</div><div class="tt"><b>${m ? esc(m.title) : T(w, 'none', '没有在放歌')}</b><span>${m ? esc(m.artist || '') : T(w, 'none2', '轻点去音乐盒')}</span></div>${pp}<span data-mc="next">${MSV.next}</span></div>`;
            if (w.size === 's' || v === 'vinyl') {
                const disc = `<div class="disc${m && m.playing ? ' on' : ''}"><i ${cov}></i></div>`;
                if (w.size === 's') return `<div class="wx-mv s">${disc}<b>${m ? esc(m.title) : T(w, 'none', '没有在放歌')}</b><span>${m ? esc(m.artist || '') : T(w, 'none2', '轻点去音乐盒')}</span></div>`;
                const pct = m && m.d ? Math.min(100, m.t / m.d * 100) : 0;
                return `<div class="wx-mv m">${disc}<div class="rt"><b>${m ? esc(m.title) : T(w, 'none', '没有在放歌')}</b><span>${m ? esc(m.artist || '未知歌手') : T(w, 'none2', '轻点去音乐盒挑一首')}</span><div class="bar"><i><u style="width:${pct}%"></u></i><em>${fmtT(m && m.t)}</em></div><div class="ctl"><span data-mc="prev">${MSV.prev}</span>${pp}<span data-mc="next">${MSV.next}</span></div></div></div>`;
            }
            return mu0.call(this, w);
        };
        // 相片：款式 + 随机轮换
        const ph0 = WD.photo.r, phTap0 = WD.photo.tap, phEdit0 = WD.photo.edit;
        WD.photo.vars = [['', '满版'], ['polaroid', '拍立得'], ['heart', '心形'], ['circle', '圆形'], ['film', '胶片']];
        WD.photo.r = function (w) {
            const v = V(w); if (!v) return ph0.call(this, w);
            const L = X.photosOf(w), img = L.length ? L[(w.d.i || 0) % L.length] : null;
            const bg = img ? `style="background-image:url('${img}')"` : '';
            const empty = img ? '' : '<span class="cam">＋</span>';
            const cap = w.d && w.d.cap ? esc(w.d.cap) : '';
            if (v === 'polaroid') return `<div class="wx-pol"><div class="im${img ? '' : ' e'}" ${bg}>${empty}</div><span class="pm-hf">${cap || (img ? today().replace(/-/g, '.') : '放一张照片')}</span></div>`;
            if (v === 'heart') return `<div class="wx-sh heart"><div class="im${img ? '' : ' e'}" ${bg}>${empty}</div>${cap ? `<span class="pm-hf">${cap}</span>` : ''}</div>`;
            if (v === 'circle') return `<div class="wx-sh circle"><div class="im${img ? '' : ' e'}" ${bg}>${empty}</div>${cap ? `<span class="pm-hf">${cap}</span>` : ''}</div>`;
            if (v === 'film') { const n = Math.max(1, Math.min(L.length, w.size === 's' ? 1 : 3)), st = w.d.i || 0; return `<div class="wx-film"><i class="h"></i><div class="fr">${L.length ? Array.from({ length: n }, (_, k) => `<div class="im" style="background-image:url('${L[(st + k) % L.length]}')"></div>`).join('') : '<div class="im e"><span class="cam">＋</span></div>'}</div><i class="h"></i></div>`; }
            return ph0.call(this, w);
        };
        WD.photo.tap = function (w) {
            const L = X.photosOf(w);
            if (L.length > 1 && w.d.rand) { let n; do { n = Math.floor(Math.random() * L.length); } while (n === (w.d.i || 0) % L.length); w.d.i = n; X.save(); paint(w); return; }
            return phTap0.call(this, w);
        };
        WD.photo.edit = w => phEdit0(w) + `<div class="lbl">点一下怎么换</div>${chipsFor(w, 'rand', [['', '按顺序'], ['1', '随机']])}`;
        // 电量：横条
        const bt0 = WD.battery.r;
        WD.battery.sizes = ['s', 't'];
        WD.battery.vars = [['', '圆环', ['s']], ['bar', '横条', ['s', 't']]];
        WD.battery.r = function (w) {
            if (w.size !== 't' && V(w) !== 'bar') return bt0.call(this, w);
            const b = typeof window.gyPmBattery === 'function' ? window.gyPmBattery() : null, lv = b ? b.lv : 100, sv = X.saverOn();
            const col = sv ? '#ffcc00' : (lv <= 20 ? 'var(--pm-red)' : 'var(--pm-text)');
            return `<div class="wx-bb${w.size === 't' ? ' t' : ''}"><div class="top"><b>${b ? lv + '%' : '—'}</b><span>${sv ? '省电模式 · 开' : (b && b.ch ? '充电中' : T(w, 'tip', '点一下省电'))}</span></div><div class="cell"><i style="width:${lv}%;background:${col}"></i></div></div>`;
        };
        // TA 说过的话：右上角换一句
        const say0 = WD.say.r;
        WD.say.r = w => say0(w).replace('<div class="wg-say">', `<div class="wg-say"><em class="wx-rf" data-act="rf">↻</em>`);
        WD.say.act = (w, a) => { if (a === 'rf') { set(w, 'sh', ((w.d && w.d.sh) || 0) + 1); paint(w); } };
        const pickSay0 = X.pickSay;

        /* ============ 新小组件 ============ */
        // ① 今日一句：每天一句，点一下随机换
        const QUOTES = ['慢慢来，也是一种很快的速度。', '今天的风很好，适合想你。', '把日子过得软一点。', '不用每天都发光，偶尔当一颗安静的石头也很好。', '好好吃饭，比什么都重要。', '你值得被认真对待，包括被你自己。', '热水、早睡、晒太阳，是最便宜的魔法。', '今天也在认真生活呢。', '把喜欢的歌单循环到发烫。', '世界很吵，你可以小声一点。', '允许一切发生，也允许自己停一停。', '有些路要慢慢走，才看得清风景。', '今天没有好消息，也是一种好消息。', '愿你的烦恼像头发一样，越来越少。', '晚一点睡的人，记得给月亮留盏灯。', '给自己买一束花，不需要理由。', '你已经很棒了，真的。', '难过的时候就吃点甜的。', '明天的事，明天的我会处理。', '要像猫一样，困了就睡，饿了就吃。', '每一个普通的日子，都藏着一点点闪光。', '别急，你的时区刚刚好。', '收藏好今天的晚霞。', '想见的人，要早点去见。', '心里有光的人，走夜路也不怕。', '今天就当一只快乐的小狗吧。', '把温柔留给值得的人，包括自己。', '偶尔发呆，是给脑袋放个小假。', '你走过的每一步都算数。', '累了就靠一靠，没关系的。', '保持好奇，保持可爱。', '有人在等你回消息哦。'];
        const quoteOf = w => { const n = (w.d && w.d.day === today() && w.d.qi != null) ? w.d.qi : Math.floor(rng('q' + today() + w.id)() * QUOTES.length); return QUOTES[n % QUOTES.length]; };
        WD.quote = {
            n: '今日一句', sizes: ['s', 'm', 't', 'x'], pv: 'm',
            vars: [['', '衬线'], ['hand', '手写'], ['mono', '打字机'], ['big', '大字']],
            tap: w => { let n; const cur0 = QUOTES.indexOf(quoteOf(w)); do { n = Math.floor(Math.random() * QUOTES.length); } while (n === cur0); w.d = Object.assign({}, w.d || {}, { qi: n, day: today() }); X.save(); paint(w); },
            r: w => { const q = (w.d && w.d.text) || quoteOf(w), d = new Date(); return `<div class="wx-q ${V(w) || 'serif'} sz${w.size}">${w.size === 's' || w.size === 'm' ? `<em>${MON[d.getMonth()]} ${pad(d.getDate())} · ${T(w, 'h', 'TODAY')}</em>` : ''}<p>${esc(q)}</p>${w.size === 'm' ? `<span>${T(w, 'tip', '轻点换一句 ↻')}</span>` : ''}</div>`; },
            edit: w => `<div class="lbl">想固定一句自己的话（空着就每天随机）</div><input class="in" value="${esc((w.d && w.d.text) || '')}" oninput="gyPmWSet('${w.id}','text',this.value,1)">`
        };
        // ② 今日运势：按日期 + 你的名字算，一天一个样
        const YI = ['早睡', '喝热水', '给 TA 发消息', '出门晒太阳', '吃甜的', '整理房间', '听一首老歌', '散步', '写日记', '拍照', '买花', '穿喜欢的衣服', '夸自己', '看一部电影', '早点起床', '洗个热水澡', '换新壁纸', '慢慢吃饭'];
        const JI = ['熬夜', '空腹喝咖啡', '想太多', '翻旧账', '冲动消费', 'emo 太久', '赖床', '已读不回', '自我怀疑', '吃太撑', '跟自己较劲'];
        const LUCK = [['雾霾蓝', '#8fa3b8'], ['奶油白', '#f1e7d0'], ['樱花粉', '#f3c9d0'], ['薄荷绿', '#bfe3d0'], ['燕麦色', '#d9c7a7'], ['经典黑', '#222'], ['香芋紫', '#c9b6de'], ['橘子汽水', '#ffb56b'], ['天空蓝', '#9cc8f0'], ['柠檬黄', '#f6e27f']];
        const fortune = w => { const r = rng('f' + today() + ((typeof currentUser !== 'undefined' && currentUser.name) || '') + ((w.d && w.d.roll) || '')); const y = [...YI].sort(() => r() - .5).slice(0, 2), j = pick(JI, r), c = pick(LUCK, r), n = 1 + Math.floor(r() * 9), s = 3 + Math.floor(r() * 3); return { y, j, c, n, s }; };
        /* 🔮 塔罗：78 张全牌（22 张大阿尔卡那 + 56 张小阿尔卡那），正位 / 逆位；
           抽出来先给「牌义」，想听更多就点「让 TA 解读」——用你设好的语言模型，按角色自己的口吻、结合你们最近的事来讲。 */
        const MAJ = [
            ['愚者', '0', '🃏', '新的开始、冒险、天真、自由', '冲动、犹豫不决、不计后果'],
            ['魔术师', 'I', '✨', '创造力、行动力、资源都在手上', '空有想法、分心、被人糊弄'],
            ['女祭司', 'II', '🌙', '直觉、秘密、静下来听内心', '忽视直觉、心事藏太深'],
            ['皇后', 'III', '🌸', '丰盛、被爱、温柔、滋养', '过度依赖、停滞、宠过头'],
            ['皇帝', 'IV', '👑', '稳定、掌控、规则、安全感', '控制欲、固执、太强硬'],
            ['教皇', 'V', '📜', '传统、信念、贵人指点', '打破常规、不愿被说教'],
            ['恋人', 'VI', '💞', '心动、选择、彼此吸引', '犹豫、失衡、价值观不合'],
            ['战车', 'VII', '🏇', '意志力、前进、赢下来', '失控、方向乱、用力过猛'],
            ['力量', 'VIII', '🦁', '温柔的勇气、耐心、自信', '自我怀疑、情绪压不住'],
            ['隐者', 'IX', '🏮', '独处、反思、找答案', '孤僻、钻牛角尖'],
            ['命运之轮', 'X', '🎡', '转机、好运、顺势而为', '时机不对、反复、低谷'],
            ['正义', 'XI', '⚖️', '公平、真相、做决定', '不公、逃避责任'],
            ['倒吊人', 'XII', '🙃', '换个角度、暂停、放下', '白白牺牲、拖延'],
            ['死神', 'XIII', '🥀', '结束与重生、翻篇', '抗拒改变、放不下'],
            ['节制', 'XIV', '🍷', '平衡、调和、慢慢来', '失衡、过度、急躁'],
            ['恶魔', 'XV', '⛓️', '欲望、诱惑、执念', '挣脱束缚、清醒过来'],
            ['高塔', 'XVI', '⚡', '突变、打破旧的', '躲过一劫、害怕改变'],
            ['星星', 'XVII', '⭐', '希望、治愈、被祝福', '失望、没信心'],
            ['月亮', 'XVIII', '🌕', '不安、幻想、看不清', '迷雾散开、真相浮出'],
            ['太阳', 'XIX', '☀️', '快乐、成功、坦诚', '小阴天、开心打折扣'],
            ['审判', 'XX', '📯', '觉醒、重来一次、回应召唤', '自责、错过机会'],
            ['世界', 'XXI', '🌍', '圆满、完成、到达', '差一点、没收尾']
        ];
        const SUITS = [['权杖', '🔥', '行动、热情、事业'], ['圣杯', '💧', '感情、关系、心情'], ['宝剑', '🗡️', '思考、沟通、冲突'], ['星币', '🪙', '金钱、身体、现实']];
        const RANKS = [['王牌', '新的机会刚冒头'], ['二', '要做选择 / 两边平衡'], ['三', '合作、初见成果'], ['四', '稳住、休整'], ['五', '小摩擦、失去一点'], ['六', '回暖、被帮助'], ['七', '坚持、考验'], ['八', '加速、投入'], ['九', '快到了、有点累'], ['十', '一个阶段到头'], ['侍从', '消息、学习、小惊喜'], ['骑士', '行动派、马上来'], ['皇后', '温柔成熟的力量'], ['国王', '掌控与责任']];
        const DECK = MAJ.map((m, i) => ({ id: 'M' + i, name: m[0], num: m[1], ic: m[2], up: m[3], rv: m[4], major: true }))
            .concat(...SUITS.map((su, si) => RANKS.map((r, ri) => ({ id: 'S' + si + '_' + ri, name: su[0] + r[0], num: r[0], ic: su[1], up: `${su[2]}：${r[1]}`, rv: `${su[2]}：${r[1]}——但卡住了 / 用力过度 / 来得晚一点`, major: false }))));
        const cardOf = id => DECK.find(c => c.id === id);
        const drawN = n => { const pool = DECK.slice(), out = []; for (let k = 0; k < n && pool.length; k++) { const c = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; out.push({ id: c.id, rv: Math.random() < .35 }); } return out; };
        const SPREADS = { one: ['今天'], three: ['过去', '现在', '未来'], love: ['你', 'TA', '你们之间'], choice: ['选 A', '选 B', '建议'] };
        const tarotOf = w => (w.d && w.d.tarot && w.d.tarot.day === today()) ? w.d.tarot : null;
        const cardHtml = (x, pos, big) => { const c = cardOf(x.id); if (!c) return ''; return `<div class="tr-card${x.rv ? ' rv' : ''}${big ? ' big' : ''}"><em>${esc(pos || '')}</em><div class="face"><i>${c.num}</i><b>${c.ic}</b><span>${esc(c.name)}</span></div><small>${x.rv ? '逆位' : '正位'}</small></div>`; };
        window.gyPmTarot = function (wid, spread) {
            const w = X.findW(wid); if (!w) return;
            let t = tarotOf(w);
            if (spread || !t) {   // 抽新的一组
                const sp = spread || 'one';
                t = { day: today(), spread: sp, cards: drawN(SPREADS[sp].length), read: '', by: '' };
                set(w, 'tarot', t); paint(w);
            }
            const pos = SPREADS[t.spread] || SPREADS.one;
            const meaning = t.cards.map((x, k) => { const c = cardOf(x.id); return c ? `<div class="tr-m"><b>${esc(pos[k] || '')} · ${esc(c.name)}${x.rv ? '（逆位）' : '（正位）'}</b><span>${esc(x.rv ? c.rv : c.up)}</span></div>` : ''; }).join('');
            const cs = chars();
            window.gyPmSheet(`<h4>🔮 塔罗</h4>
                <div class="tr-row">${t.cards.map((x, k) => cardHtml(x, pos[k], t.cards.length === 1)).join('')}</div>
                <div class="lbl">牌义</div>${meaning}
                <div class="lbl">解析</div>
                <div class="tr-read" id="gyPmTrRead">${t.read ? esc(t.read).replace(/\n/g, '<br>') + (t.by ? `<div class="by">—— ${esc(t.by)}</div>` : '') : '<span class="muted">点下面让人给你解读这一组牌（会用你设置里的语言模型）</span>'}</div>
                <div class="chips">${cs.map(c => `<span class="chip" onclick="gyPmTarotRead('${w.id}','${esc(c.id)}')">让 ${esc(c.remark || c.name)} 解读</span>`).join('')}<span class="chip" onclick="gyPmTarotRead('${w.id}','')">占卜师来解读</span></div>
                <div class="lbl">再抽一组</div>
                <div class="chips"><span class="chip" onclick="gyPmTarot('${w.id}','one')">单张</span><span class="chip" onclick="gyPmTarot('${w.id}','three')">过去 · 现在 · 未来</span><span class="chip" onclick="gyPmTarot('${w.id}','love')">感情牌阵</span><span class="chip" onclick="gyPmTarot('${w.id}','choice')">二选一</span></div>
                <button class="it muted" onclick="gyPmCloseSheet()">好了</button>`);
        };
        window.gyPmTarotRead = async function (wid, cid) {
            const w = X.findW(wid), t = w && tarotOf(w); if (!t) return;
            const box = document.getElementById('gyPmTrRead');
            const hasApi = typeof sendChatRequest === 'function' && typeof myApiKey !== 'undefined' && myApiKey;
            if (!hasApi) { if (box) box.innerHTML = '<span class="muted">还没配 API（设置 → API 与模型），先看上面的牌义吧</span>'; return; }
            const c = cid ? charOf(cid) : null;
            const pos = SPREADS[t.spread] || SPREADS.one;
            const list = t.cards.map((x, k) => { const cd = cardOf(x.id); return `${pos[k]}：${cd.name}（${x.rv ? '逆位' : '正位'}，牌义：${x.rv ? cd.rv : cd.up}）`; }).join('\n');
            const uname = typeof currentUser !== 'undefined' && currentUser.name ? currentUser.name : '对方';
            if (box) box.innerHTML = `<span class="muted">${c ? esc(c.remark || c.name) + ' 在看你的牌…' : '占卜师在看牌…'}</span>`;
            let p;
            if (c) {
                const base = typeof buildBasePrompt === 'function' ? buildBasePrompt(c, false, '') : `你是${c.name}。${c.persona || ''}`;
                const hist = typeof getRecentChatContext === 'function' ? getRecentChatContext(c.id) : '';
                p = `${base}\n${hist ? '【你们最近的聊天】\n' + hist + '\n' : ''}${uname}刚刚抽了塔罗牌，拿给你看，让你帮忙解读：\n${list}\n请你完全用你自己的性格和说话方式，结合你们俩最近的事，给${uname}解读这组牌。可以认真、可以嘴硬、可以借题发挥说点想说的话，像你本人在跟${uname}聊天，不要写成算命网站的腔调。\n只输出你要说的话，不要 JSON，不要引号。`;
            } else {
                p = `你是一位温柔又一针见血的塔罗占卜师。${uname}抽到的牌是：\n${list}\n请结合牌阵位置逐张解读，再给一段整体的建议。语气温暖、具体，不要故弄玄虚。只输出解读正文。`;
            }
            try {
                const data = await sendChatRequest({ url: myApiUrl, key: myApiKey, model: myModel }, p);
                if (data && data.error) throw new Error(data.error.message || String(data.error));
                let txt = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
                if (c && typeof applyRegexScripts === 'function') txt = applyRegexScripts(txt, 'ai_output', c.id);
                txt = txt.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                if (!txt) throw new Error('没写出东西来');
                t.read = txt; t.by = c ? (c.remark || c.name) : '占卜师'; set(w, 'tarot', t);
                if (box) box.innerHTML = esc(txt).replace(/\n/g, '<br>') + `<div class="by">—— ${esc(t.by)}</div>`;
            } catch (e) { if (box) box.innerHTML = `<span class="muted">没解读成：${esc(String(e && e.message || e).slice(0, 80))}</span>`; }
        };
        WD.fortune = {
            n: '今日运势', sizes: ['s', 'm', 'l'],
            vars: [['', '签'], ['tarot', '塔罗']],
            act: (w, a) => { if (a === 'tarot') window.gyPmTarot(w.id); },
            tap: w => {
                if (V(w) === 'tarot' || w.size === 'l') { window.gyPmTarot(w.id); return; }
                if (w.size === 's') { set(w, 'flip', !(w.d && w.d.flip)); paint(w); } else window.gyPmTarot(w.id);
            },
            r: w => {
                const f = fortune(w), stars = '★'.repeat(f.s) + '☆'.repeat(5 - f.s), t = tarotOf(w);
                const tcard = t ? t.cards.slice(0, w.size === 's' ? 1 : 3).map((x, k) => cardHtml(x, (SPREADS[t.spread] || [])[k], false)).join('') : '';
                if (V(w) === 'tarot') {
                    if (!t) return `<div class="wx-tr empty"><div class="back"></div><em>${T(w, 'th', '今日塔罗')}</em><b>${T(w, 'tp', '点我抽一张')}</b></div>`;
                    const c0 = cardOf(t.cards[0].id);
                    return `<div class="wx-tr ${w.size}"><div class="cards">${tcard}</div>${w.size !== 's' ? `<div class="tx"><em>${T(w, 'th', '今日塔罗')}</em><b>${esc(c0.name)}${t.cards[0].rv ? ' · 逆位' : ''}</b><span>${esc(t.cards[0].rv ? c0.rv : c0.up)}</span><i>${t.read ? '已解读 · 点开看' : '点一下看解析'}</i></div>` : ''}</div>`;
                }
                if (w.size === 's' && w.d && w.d.flip) return `<div class="wx-ft s back"><em>${T(w, 'lc', '幸运色')}</em><i class="sw" style="background:${f.c[1]}"></i><b>${f.c[0]}</b><em>${T(w, 'ln', '幸运数字')} <b>${f.n}</b></em></div>`;
                if (w.size === 's') return `<div class="wx-ft s"><em>${T(w, 'h', '今日运势')}</em><span class="st">${stars}</span><div class="yj"><p><i>宜</i>${f.y[0]}</p><p><i>宜</i>${f.y[1]}</p><p class="j"><i>忌</i>${f.j}</p></div></div>`;
                const main = `<div class="l"><em>${T(w, 'h', '今日运势')}</em><span class="st">${stars}</span><div class="yj"><p><i>宜</i>${f.y.join(' · ')}</p><p class="j"><i>忌</i>${f.j}</p></div></div><div class="r"><i class="sw" style="background:${f.c[1]}"></i><b>${f.c[0]}</b><span>${T(w, 'ln', '幸运数字')} ${f.n}</span></div>`;
                if (w.size === 'l') return `<div class="wx-ft l"><div class="wx-ft m">${main}</div><div class="tl"><em>${T(w, 'th', '今日塔罗')}</em>${t ? `<div class="cards">${tcard}</div>` : `<span class="draw" data-act="tarot">🔮 ${T(w, 'tp', '抽一张塔罗')}</span>`}</div></div>`;
                return `<div class="wx-ft m">${main}<em class="wx-rf trb" data-act="tarot" title="抽塔罗">🔮</em></div>`;
            }
        };
        // ③ 今天吃什么：点一下摇一次
        const FOOD = ['麻辣烫', '螺蛳粉', '寿司', '火锅', '煲仔饭', '牛肉面', '披萨', '沙拉', '饺子', '炸鸡', '黄焖鸡', '米线', '烤肉', '汉堡薯条', '轻食', '番茄炒蛋盖饭', '酸菜鱼', '咖喱饭', '拉面', '煎饼果子', '凉皮', '云吞面', '自己做饭', '冒菜', '烧烤', '小笼包', '石锅拌饭', '麻辣香锅'];
        const foodList = w => { const t = String((w.d && w.d.list) || '').split(/[\n,，、]/).map(x => x.trim()).filter(Boolean); return t.length ? t : FOOD; };
        WD.food = {
            n: '今天吃什么', sizes: ['s', 't'],
            tap: w => {
                const L = foodList(w); if (w.__roll) return; w.__roll = 1; let k = 0;
                const iv = setInterval(() => {
                    w.d = Object.assign({}, w.d || {}, { pick: pick(L, Math.random), day: today(), rolling: 1 }); paint(w);
                    if (++k > 11) { clearInterval(iv); w.__roll = 0; w.d.rolling = 0; X.save(); paint(w); }
                }, 70 + k * 6);
            },
            r: w => { const p = w.d && w.d.day === today() && w.d.pick; const cls = w.d && w.d.rolling ? ' roll' : ''; if (w.size === 't') return `<div class="wx-fd t${cls}"><span>${T(w, 'h2', '今天吃')}</span><b>${esc(p || '？')}</b><em>🎲</em></div>`; return `<div class="wx-fd${cls}"><em>${T(w, 'h', '今天吃什么')}</em><b class="pm-hf">${p ? esc(p) : T(w, 'e', '点我摇一摇')}</b><span>${p ? T(w, 'again', '不满意？再摇一次') : T(w, 'sub', '选择困难就交给它')}</span><i class="dice">🎲</i></div>`; },
            edit: w => `<div class="lbl">候选（一行一个，空着就用默认的 ${FOOD.length} 个）</div><textarea class="ta" rows="5" oninput="gyPmWSet('${w.id}','list',this.value,1)">${esc((w.d && w.d.list) || '')}</textarea>`
        };
        // ④ 我和 TA：认识第几天
        const firstTs = cid => { const m = ((typeof globalChats !== 'undefined' && globalChats[cid]) || []).find(x => x && x.timestamp); return m ? m.timestamp : null; };
        WD.us = {
            n: '我和 TA', sizes: ['s', 'm'],
            tap: w => { const id = (w.d && w.d.cid) || firstChar(); if (id != null) window.gyPmOpenChat(id); },
            r: w => {
                const id = (w.d && w.d.cid) || firstChar(), c = charOf(id);
                if (!c) return `<div class="wg-empty pm-hf">还没有角色</div>`;
                const t0 = (w.d && w.d.since) ? new Date(w.d.since + 'T00:00:00').getTime() : firstTs(c.id);
                const n = t0 ? Math.max(1, Math.floor((Date.now() - t0) / 864e5) + 1) : 1;
                const me = G().av(typeof currentUser !== 'undefined' ? currentUser : { name: '我' }, 46), ta = G().av(c, 46);
                const cnt = ((typeof globalChats !== 'undefined' && globalChats[c.id]) || []).length;
                if (w.size === 's') return `<div class="wx-us s"><div class="avs"><span>${me}</span><i>♥</i><span>${ta}</span></div><em>${T(w, 'pre', '和')} ${esc(c.remark || c.name)}</em><b class="pm-hf">${T(w, 'd1', '第')} ${n} ${T(w, 'd2', '天')}</b></div>`;
                const lm = lastOf(c.id);
                return `<div class="wx-us m"><div class="avs"><span>${me}</span><i>♥</i><span>${ta}</span></div><div class="rt"><em>${T(w, 'pre2', '我和')} ${esc(c.remark || c.name)}</em><b class="pm-hf">${T(w, 'm1', '认识的第')} ${n} ${T(w, 'd2', '天')}</b><span>一共说了 ${cnt} 句话${lm ? ' · 最近：' + esc(plain(lm.text, c.id).slice(0, 14) || '[图片]') : ''}</span></div></div>`;
            },
            edit: w => `<div class="lbl">和谁</div>${chipsFor(w, 'cid', chars().map(c => [c.id, esc(c.remark || c.name)]), firstChar())}<div class="lbl">从哪天开始算（空着就从第一句话算）</div><input class="in" type="date" value="${esc((w.d && w.d.since) || '')}" onchange="gyPmWSet('${w.id}','since',this.value,1)">`
        };
        // ⑤ TA 的动态：随机一条角色发的推文，右上角换一条
        const postsOf = w => (typeof globalPosts !== 'undefined' ? globalPosts : []).filter(p => p && p.char && String(p.char.id) !== 'me' && (!w.d || !w.d.cid || String(p.char.id) === String(w.d.cid)) && p.text);
        const postOf = w => { const L = postsOf(w).slice(0, 80); if (!L.length) return null; const n = (w.d && w.d.pi != null) ? w.d.pi : Math.floor(rng('p' + Math.floor(Date.now() / 36e5) + w.id)() * L.length); return L[n % L.length]; };
        WD.feed = {
            n: 'TA 的动态', sizes: ['m', 'l'],
            act: (w, a) => { if (a === 'rf') { const L = postsOf(w); if (L.length) { set(w, 'pi', Math.floor(Math.random() * Math.min(80, L.length))); paint(w); } } },
            tap: w => { const p = postOf(w); if (!p) { window.gyPmOpen('home'); return; } try { const g = G(); window.gyPmOpen('home'); setTimeout(() => { try { switchMainView('postDetail', p.id); window.gyPmSyncNav && window.gyPmSyncNav(); } catch (e) {} }, 60); } catch (e) {} },
            r: w => {
                const p = postOf(w);
                if (!p) return `<div class="wg-empty pm-hf">等 TA 发了推文，这里会随机挑一条</div>`;
                const c = charOf(p.char.id) || p.char, txt = plain(p.text, p.char.id).replace(/\s+/g, ' ');
                const img = (p.images && p.images[0]) || p.image || '';
                const pic = w.size === 'l' && img && /^(data:|https?:|blob:)/.test(img) ? `<div class="pic" style="background-image:url('${esc(img)}')"></div>` : '';
                return `<div class="wx-fe ${w.size}"><div class="hd"><span class="av">${G().av(c, 30)}</span><b>${esc(c.remark || c.name || '')}</b><span>${esc(X.ago(p.timestamp))}</span><em class="wx-rf" data-act="rf">↻</em></div><p>${esc(txt.slice(0, w.size === 'l' ? 160 : 70))}${txt.length > (w.size === 'l' ? 160 : 70) ? '…' : ''}</p>${pic}<div class="ft">♡ ${p.likes || 0}　💬 ${(p.comments || []).length || p.replies || 0}</div></div>`;
            },
            edit: w => `<div class="lbl">看谁的</div>${chipsFor(w, 'cid', [['', '谁都行'], ...chars().map(c => [c.id, esc(c.remark || c.name)])])}`
        };
        // ⑥ 搜索条：点开搜 App 和角色
        WD.search = {
            n: '搜索', sizes: ['x'], vars: [['', '胶囊'], ['line', '下划线']],
            tap: () => window.gyPmSearch(),
            r: w => `<div class="wx-se ${V(w)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><span>${T(w, 'ph', '搜索 App、角色')}</span></div>`
        };
        window.gyPmSearch = function () {
            window.gyPmSheet(`<h4>搜索</h4><label class="pm-lib-s">⌕<input id="gyPmSeIn" placeholder="App 名字 / 角色名字" oninput="gyPmSearchQ(this.value)"></label><div id="gyPmSeRes"></div><button class="it muted" onclick="gyPmCloseSheet()">好了</button>`);
            window.gyPmSearchQ(''); setTimeout(() => { const i = document.getElementById('gyPmSeIn'); if (i) i.focus(); }, 80);
        };
        window.gyPmSearchQ = function (q) {
            const box = document.getElementById('gyPmSeRes'); if (!box) return; q = String(q || '').trim();
            const apps = (G().APPS || []).filter(a => !q || a[1].includes(q)).slice(0, q ? 12 : 8);
            const cs = chars().filter(c => q && ((c.name || '').includes(q) || (c.remark || '').includes(q))).slice(0, 8);
            box.innerHTML = `${cs.length ? `<div class="lbl">角色</div>${cs.map(c => `<div class="pm-se-row" onclick="gyPmCloseSheet();gyPmOpenChat('${esc(c.id)}')"><span class="av">${G().av(c, 34)}</span><b>${esc(c.remark || c.name)}</b><em>聊天 ›</em></div>`).join('')}` : ''}
                <div class="lbl">${q ? 'App' : '常用'}</div>${apps.map(a => `<div class="pm-se-row" onclick="gyPmCloseSheet();gyPmOpen('${a[0]}')"><span class="ic">${G().svg(a[2], 1.6)}</span><b>${esc(a[1])}</b><em>打开 ›</em></div>`).join('') || '<div class="pm-lib-tip">没找到</div>'}`;
        };
        // ⑦ 胶囊标签（ins 风的一排小药丸）
        const TAGS = ['慢慢来', '今天也要开心', '☁ 多云转晴', '在听歌', '想见你', '好好吃饭', 'not today', '晚安', '✦ 小确幸', '周末快乐', '在路上', '勿扰模式'];
        const tagsOf = w => { const t = String((w.d && w.d.tags) || '').split(/[\n,，、/]/).map(x => x.trim()).filter(Boolean); if (t.length) return t; const r = rng('t' + today() + w.id); return [...TAGS].sort(() => r() - .5).slice(0, 4); };
        WD.tags = {
            n: '胶囊标签', sizes: ['x', 't'], vars: [['', '描边'], ['fill', '实心'], ['mix', '混搭']],
            tap: w => { if (!(w.d && w.d.tags)) { set(w, 'seed', Math.random()); } paint(w); },
            r: w => { let t = tagsOf(w); if (w.d && w.d.seed && !(w.d && w.d.tags)) { const r = rng('t' + w.d.seed); t = [...TAGS].sort(() => r() - .5).slice(0, 4); } return `<div class="wx-tg ${V(w)}">${t.slice(0, w.size === 't' ? 2 : 4).map((x, i) => `<span class="k${i % 3}">${esc(x)}</span>`).join('')}</div>`; },
            edit: w => `<div class="lbl">写自己的标签（用逗号或换行隔开；空着就每天随机）</div><textarea class="ta" rows="3" oninput="gyPmWSet('${w.id}','tags',this.value,1)">${esc((w.d && w.d.tags) || '')}</textarea>`
        };
        // ⑧ 今天心情：点一下换一个
        const MOOD = [['开心', '(๑˃̵ᴗ˂̵)', '#ffe08a'], ['平静', '( ˘ω˘ )', '#d8e6d2'], ['有点累', '(－ω－) zzZ', '#dcd6ea'], ['想 TA', '(｡•́︿•̀｡)', '#f6d3da'], ['元气满满', 'ᕦ(ò_óˇ)ᕤ', '#ffd2a6'], ['emo', '( ._. )', '#cfd8e3'], ['被爱着', '(づ｡◕‿‿◕｡)づ', '#f7c9c9'], ['摸鱼中', '( ´-ω･)▄︻┻┳══━', '#d7eef0']];
        WD.mood = {
            n: '今天心情', sizes: ['s', 't'],
            tap: w => { const i = (w.d && w.d.day === today() && w.d.m != null) ? (w.d.m + 1) % MOOD.length : 0; w.d = Object.assign({}, w.d || {}, { m: i, day: today() }); X.save(); paint(w); },
            r: w => { const set0 = w.d && w.d.day === today() && w.d.m != null, m = MOOD[set0 ? w.d.m : 0]; const dot = set0 ? `<i class="dt" style="background:${m[2]}"></i>` : ''; if (w.size === 't') return `<div class="wx-md t">${dot}<b>${set0 ? m[1] : '(・_・)'}</b><span>${set0 ? m[0] : T(w, 'e2', '今天心情？')}</span></div>`; return `<div class="wx-md"${set0 ? ` style="--md:${m[2]}"` : ''}><em>${T(w, 'h', '今天心情')}</em><b>${set0 ? m[1] : '(・_・) ?'}</b><span>${set0 ? m[0] : T(w, 'e', '点一下选一个')}</span></div>`; }
        };
        // ⑨ 年度进度
        WD.year = {
            n: '年度进度', sizes: ['t', 's', 'x'],
            r: w => {
                const d = new Date(), y = d.getFullYear(), a = new Date(y, 0, 1), b = new Date(y + 1, 0, 1), pct = (d - a) / (b - a) * 100, left = Math.ceil((b - d) / 864e5);
                if (w.size === 's') return `<div class="wx-yr s"><em>${y}</em><div class="mo">${Array.from({ length: 12 }, (_, i) => `<i class="${i < d.getMonth() ? 'on' : i === d.getMonth() ? 'now' : ''}"></i>`).join('')}</div><b class="pm-hf">${pct.toFixed(1)}%</b><span>${T(w, 'left', '还剩')} ${left} ${T(w, 'd', '天')}</span></div>`;
                return `<div class="wx-yr ${w.size}"><div class="top"><b>${y}</b><span>${T(w, 'past', '已经过去')} ${pct.toFixed(w.size === 'x' ? 1 : 0)}%${w.size === 'x' ? ` · ${T(w, 'left', '还剩')} ${left} ${T(w, 'd', '天')}` : ''}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
            },
            tap: () => window.gyPmCalendar()
        };
        return true;
    }
    if (!boot()) { let n = 0; const iv = setInterval(() => { if (boot() || ++n > 60) clearInterval(iv); }, 100); }

    const CSS = `
.wx-rf{position:absolute;top:10px;right:12px;font-style:normal;width:24px;height:24px;border-radius:50%;background:var(--pm-fill);display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--pm-sub);cursor:pointer;z-index:2}
/* 时钟款式 */
.wx-ck{height:100%;display:flex;flex-direction:column;justify-content:center;gap:4px}
.wx-ck.thin b{font-family:var(--pm-num);font-size:54px;font-weight:100;letter-spacing:-2px;line-height:1}
.wx-ck.thin b i{font-style:normal;opacity:.4;margin:0 1px}
.wx-ck.thin.m{align-items:center}.wx-ck.thin.m b{font-size:76px}
.wx-ck span{font-size:12px;color:var(--pm-sub)}
.wx-ck.flip{flex-direction:row;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}
.wx-ck.flip .fc{flex:1;max-width:120px;aspect-ratio:1/1.1;border-radius:14px;background:var(--pm-accent);color:var(--pm-accent-fg);display:flex;align-items:center;justify-content:center;position:relative;box-shadow:0 6px 14px rgba(0,0,0,.14)}
.wx-ck.flip .fc::after{content:"";position:absolute;left:0;right:0;top:50%;height:1.5px;background:var(--pm-card);opacity:.55}
.wx-ck.flip .fc b{font-family:var(--pm-num);font-size:40px;font-weight:700;letter-spacing:-1px}
.wx-ck.flip.m .fc{max-width:none;aspect-ratio:auto;height:92px}.wx-ck.flip.m .fc b{font-size:58px}
.wx-ck.flip.m span{flex-basis:100%;text-align:center;letter-spacing:2px;font-weight:600;font-size:10.5px}
.wx-ck.stack{align-items:flex-start;gap:0;position:relative}
.wx-ck.stack b{font-family:var(--pm-num);font-size:50px;font-weight:800;line-height:.92;letter-spacing:-2px}
.wx-ck.stack b+b{color:var(--pm-sub)}
.wx-ck.stack span{position:absolute;right:0;bottom:2px;text-align:right;font-size:10.5px;letter-spacing:1.5px;font-weight:600;line-height:1.4}
.wx-ck.stack.m{flex-direction:row;align-items:center;gap:10px}.wx-ck.stack.m b{font-size:70px}
.wx-ck.word{gap:6px}.wx-ck.word b{font-size:22px;font-weight:600;line-height:1.35}
.wx-ck.word.m b{font-size:30px}.wx-ck.word>span:first-child{font-size:11px;letter-spacing:2px}
.wx-acm{height:100%;display:flex;align-items:center;gap:18px;padding-left:6px}
.wx-acm b{font-family:var(--pm-num);font-size:40px;font-weight:300;display:block}.wx-acm span{font-size:12px;color:var(--pm-sub);line-height:1.5}
.dial.mini{color:var(--pm-text)}
/* 日历款式 */
.wx-cb{height:100%;display:flex;flex-direction:column;justify-content:space-between}
.wx-cb em{font-style:normal;font-size:12px;font-weight:700;letter-spacing:2px;color:var(--pm-red)}
.wx-cb b{font-family:var(--pm-num);font-size:78px;font-weight:200;line-height:.9;letter-spacing:-3px}
.wx-cb span{font-size:11px;color:var(--pm-sub);letter-spacing:1.5px;font-weight:600}
.wx-ct{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(var(--pm-red) 0 30px,transparent 30px);padding-top:26px;box-sizing:border-box}
#gyPmHome .wk-cal.sz-s.v-big{padding:14px 16px}
.wx-ct .hd{position:absolute;top:8px;left:0;right:0;display:flex;justify-content:center;gap:52px}.wx-ct .hd i{width:8px;height:8px;border-radius:50%;background:var(--pm-card)}
.wx-ct em{font-style:normal;font-size:12px;color:var(--pm-sub);margin-top:4px}
.wx-ct b{font-family:var(--pm-num);font-size:58px;font-weight:600;line-height:1}
.wx-ct span{font-size:12px;color:var(--pm-sub)}
.wx-cl{height:100%;display:flex;gap:16px}
.wx-cl .l{flex:0 0 28%;display:flex;flex-direction:column;justify-content:center;border-right:.5px solid var(--pm-hair)}
.wx-cl .l em{font-style:normal;font-size:11px;font-weight:700;color:var(--pm-red);letter-spacing:1.5px}.wx-cl .l b{font-family:var(--pm-num);font-size:48px;font-weight:300;line-height:1.05}
.wx-cl .r{flex:1;display:flex;flex-direction:column;justify-content:center;gap:7px;min-width:0}
.wx-cl .ev{display:flex;gap:8px;min-width:0}.wx-cl .ev>i{width:3px;border-radius:2px;background:var(--pm-accent);flex-shrink:0}
.wx-cl .ev b{display:block;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wx-cl .ev span{font-size:11px;color:var(--pm-sub)}
.wx-cl .none{font-size:13px;color:var(--pm-sub);line-height:1.5}.wx-cl small{font-size:11px;opacity:.8}
/* 音乐款式 */
.wx-mx{height:100%;display:flex;align-items:center;gap:10px}
.wx-mx .cv{width:40px;height:40px;border-radius:10px;background:var(--pm-fill) center/cover;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--pm-sub)}.wx-mx .cv svg{width:20px}
.wx-mx .tt{flex:1;min-width:0}.wx-mx .tt b{display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wx-mx .tt span{font-size:11.5px;color:var(--pm-sub)}
.wx-mx>span{width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer}.wx-mx>span svg{width:22px;height:22px}
.wx-mv .disc{border-radius:50%;background:repeating-radial-gradient(circle,#111 0 2px,#1d1d1f 2px 4px);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(0,0,0,.22);flex-shrink:0}
.wx-mv .disc i{width:42%;height:42%;border-radius:50%;background:var(--pm-red) center/cover;box-shadow:0 0 0 3px rgba(255,255,255,.08)}
.wx-mv .disc.on{animation:pmSpin 6s linear infinite}
@keyframes pmSpin{to{transform:rotate(360deg)}}
.wx-mv.s{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center;min-width:0}
.wx-mv.s .disc{width:88px;height:88px;margin-bottom:4px}
.wx-mv.s b{font-size:13px;font-weight:600;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wx-mv.s span{font-size:11px;color:var(--pm-sub)}
.wx-mv.m{height:100%;display:flex;align-items:center;gap:16px}
.wx-mv.m .disc{width:118px;height:118px}
.wx-mv.m .rt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.wx-mv.m b{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wx-mv.m .rt>span{font-size:12px;color:var(--pm-sub)}
.wx-mv.m .bar{display:flex;align-items:center;gap:6px;margin-top:6px}.wx-mv.m .bar i{flex:1;height:3px;border-radius:2px;background:var(--pm-fill);overflow:hidden}.wx-mv.m .bar u{display:block;height:100%;background:var(--pm-text)}.wx-mv.m .bar em{font-style:normal;font-size:10px;color:var(--pm-sub);font-family:var(--pm-num)}
.wx-mv.m .ctl{display:flex;gap:18px;align-items:center;margin-top:6px}.wx-mv.m .ctl span{cursor:pointer;display:flex}.wx-mv.m .ctl svg{width:20px;height:20px}.wx-mv.m .ctl .pp svg{width:26px;height:26px}
/* 相片款式 */
.wx-pol{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px;background:#fff;padding:10px 10px 6px;box-sizing:border-box;color:#333}
.wx-pol .im{flex:1;background:#eee center/cover;display:flex;align-items:center;justify-content:center}
.wx-pol span{font-size:13px;text-align:center;font-family:"LXGW WenKai","霞鹜文楷","KaiTi",cursive;color:#555}
.wx-sh{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.wx-sh .im{height:80%;aspect-ratio:1;background:var(--pm-fill) center/cover;display:flex;align-items:center;justify-content:center}
.wx-sh.circle .im{border-radius:50%;box-shadow:0 0 0 4px var(--pm-card),0 0 0 5px var(--pm-hair)}
.wx-sh.heart .im{-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 22'%3E%3Cpath d='M12 21.6 10.3 20C4.2 14.5 0 10.7 0 6.1 0 2.7 2.7 0 6.1 0 8 0 9.9.9 12 3.1 14.1.9 16 0 17.9 0 21.3 0 24 2.7 24 6.1c0 4.6-4.2 8.4-10.3 13.9z'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 22'%3E%3Cpath d='M12 21.6 10.3 20C4.2 14.5 0 10.7 0 6.1 0 2.7 2.7 0 6.1 0 8 0 9.9.9 12 3.1 14.1.9 16 0 17.9 0 21.3 0 24 2.7 24 6.1c0 4.6-4.2 8.4-10.3 13.9z'/%3E%3C/svg%3E") center/contain no-repeat}
.wx-sh span{font-size:13px;font-weight:600}
.wx-sh .cam,.wx-pol .cam,.wx-film .cam{font-size:26px;color:var(--pm-sub)}
.wx-film{position:absolute;inset:0;display:flex;flex-direction:column;background:#111;padding:0 8px;box-sizing:border-box}
.wx-film .h{height:12px;flex-shrink:0;background:radial-gradient(circle at 7px 6px,#f5f5f7 2.4px,transparent 2.8px) 0 0/16px 12px repeat-x;opacity:.85}
.wx-film .fr{flex:1;display:flex;gap:6px;min-height:0}
.wx-film .im{flex:1;background:#333 center/cover;border-radius:2px;display:flex;align-items:center;justify-content:center}
/* 电量横条 */
.wx-bb{height:100%;display:flex;flex-direction:column;justify-content:center;gap:10px}
.wx-bb .top{display:flex;justify-content:space-between;align-items:baseline}.wx-bb .top b{font-family:var(--pm-num);font-size:30px;font-weight:600}.wx-bb .top span{font-size:11px;color:var(--pm-sub)}
.wx-bb .cell{height:22px;border-radius:7px;box-shadow:inset 0 0 0 2px var(--pm-sub);padding:3px;box-sizing:border-box;position:relative}
.wx-bb .cell::after{content:"";position:absolute;right:-5px;top:7px;width:3px;height:8px;border-radius:0 2px 2px 0;background:var(--pm-sub)}
.wx-bb .cell i{display:block;height:100%;border-radius:4px}
.wx-bb.t{flex-direction:row;align-items:center;gap:10px}.wx-bb.t .top{flex-direction:column;gap:0}.wx-bb.t .top b{font-size:20px}.wx-bb.t .top span{font-size:10px}.wx-bb.t .cell{flex:1;height:18px}.wx-bb.t .cell::after{top:5px;height:6px}
/* 今日一句 */
.wx-q{height:100%;display:flex;flex-direction:column;justify-content:center;gap:8px;position:relative}
.wx-q em{font-style:normal;font-size:10.5px;letter-spacing:2px;color:var(--pm-sub);font-weight:600}
.wx-q p{margin:0;font-size:17px;line-height:1.55;font-weight:500}
.wx-q>span{font-size:11px;color:var(--pm-sub);align-self:flex-end}
.wx-q.serif p{font-family:"Songti SC","STSong","Noto Serif SC","Source Han Serif SC",Georgia,serif}
.wx-q.hand p{font-family:"LXGW WenKai","霞鹜文楷","KaiTi","STKaiti",cursive;font-size:18px}
.wx-q.mono p{font-family:"SF Mono",Menlo,Consolas,"Courier New",monospace;font-size:14.5px;letter-spacing:.5px}
.wx-q.mono p::after{content:"▍";animation:pmBlink 1s steps(1) infinite;margin-left:2px}
@keyframes pmBlink{50%{opacity:0}}
.wx-q.big p{font-size:22px;font-weight:800;letter-spacing:-.5px;line-height:1.3}
.wx-q.szs p{font-size:15px}.wx-q.big.szs p{font-size:19px}
.wx-q.szt p,.wx-q.szx p{font-size:13.5px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* 今日运势 */
.wx-ft{height:100%;display:flex;flex-direction:column;justify-content:center;gap:6px}
.wx-ft em{font-style:normal;font-size:11px;letter-spacing:1.5px;color:var(--pm-sub);font-weight:600}
.wx-ft .st{font-size:15px;letter-spacing:2px;color:#ffb300}
.wx-ft .yj p{margin:3px 0;font-size:13px;display:flex;align-items:center;gap:6px}
.wx-ft .yj i{font-style:normal;font-size:11px;width:18px;height:18px;border-radius:5px;background:var(--pm-accent);color:var(--pm-accent-fg);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.wx-ft .yj .j i{background:var(--pm-red);color:#fff}
.wx-ft .sw{width:46px;height:46px;border-radius:50%;box-shadow:0 0 0 .5px var(--pm-hair),0 6px 14px rgba(0,0,0,.1)}
.wx-ft.back{align-items:center;text-align:center}.wx-ft.back b{font-size:16px}.wx-ft.back em b{font-size:14px;color:var(--pm-text)}
.wx-ft.m{flex-direction:row;align-items:center;justify-content:space-between}.wx-ft.m .l{display:flex;flex-direction:column;gap:4px}
.wx-ft.m .r{display:flex;flex-direction:column;align-items:center;gap:5px}.wx-ft.m .r b{font-size:14px}.wx-ft.m .r span{font-size:11px;color:var(--pm-sub)}
/* 塔罗 */
.tr-card{display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0}
.tr-card em{font-style:normal;font-size:10px;color:var(--pm-sub);min-height:12px}
.tr-card .face{width:46px;height:74px;border-radius:7px;background:linear-gradient(160deg,#fbf6ea,#efe3c6);color:#4a3b22;box-shadow:inset 0 0 0 1.5px #c9a55c,inset 0 0 0 4px #fbf6ea,inset 0 0 0 5px #c9a55c,0 4px 10px rgba(0,0,0,.12);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:6px 2px 5px;box-sizing:border-box;transition:transform .4s}
.tr-card .face i{font-style:normal;font-size:9px;font-family:Georgia,serif;letter-spacing:.5px}
.tr-card .face b{font-size:18px;line-height:1}
.tr-card .face span{font-size:8.5px;font-weight:600;white-space:nowrap;transform:scale(.92)}
.tr-card.rv .face{transform:rotate(180deg)}
.tr-card small{font-size:9.5px;color:var(--pm-sub)}
.tr-card.big .face{width:88px;height:142px;border-radius:12px;padding:10px 4px 8px}.tr-card.big .face i{font-size:13px}.tr-card.big .face b{font-size:38px}.tr-card.big .face span{font-size:13px;transform:none}
.wx-tr{height:100%;display:flex;align-items:center;gap:14px}
.wx-tr .cards{display:flex;gap:6px}
.wx-tr .tx{display:flex;flex-direction:column;gap:3px;min-width:0}.wx-tr .tx em{font-style:normal;font-size:11px;letter-spacing:1.5px;color:var(--pm-sub);font-weight:600}
.wx-tr .tx b{font-size:17px}.wx-tr .tx span{font-size:12px;color:var(--pm-sub);line-height:1.45}.wx-tr .tx i{font-style:normal;font-size:11px;color:var(--pm-accent);margin-top:2px}
.wx-tr.s{justify-content:center}
.wx-tr.empty{flex-direction:column;justify-content:center;gap:5px;text-align:center}
.wx-tr.empty .back{width:48px;height:76px;border-radius:7px;background:repeating-linear-gradient(45deg,#2b2350 0 6px,#3a3070 6px 12px);box-shadow:inset 0 0 0 2px #c9a55c,0 6px 14px rgba(0,0,0,.18)}
.wx-tr.empty em{font-style:normal;font-size:11px;color:var(--pm-sub);letter-spacing:1.5px}.wx-tr.empty b{font-size:13px}
.wx-ft .trb{font-size:14px;background:transparent}
.wx-ft.l{height:100%;display:flex;flex-direction:column;gap:12px}.wx-ft.l>.wx-ft.m{height:auto}
.wx-ft.l .tl{flex:1;display:flex;flex-direction:column;gap:6px;border-top:.5px solid var(--pm-hair);padding-top:10px}
.wx-ft.l .tl .cards{display:flex;gap:10px}
.wx-ft.l .draw{align-self:flex-start;padding:8px 14px;border-radius:999px;background:var(--pm-accent);color:var(--pm-accent-fg);font-size:13px;font-weight:600;cursor:pointer}
#gyPmSheet .tr-row{display:flex;justify-content:center;gap:14px;margin:6px 0 4px}
#gyPmSheet .tr-row .tr-card .face{width:70px;height:112px}#gyPmSheet .tr-row .tr-card .face b{font-size:28px}#gyPmSheet .tr-row .tr-card .face span{font-size:11px}
#gyPmSheet .tr-row .tr-card.big .face{width:100px;height:160px}
#gyPmSheet .tr-m{background:var(--pm-card);border-radius:12px;padding:10px 12px;margin-bottom:6px;box-shadow:0 0 0 .5px var(--pm-hair)}
#gyPmSheet .tr-m b{display:block;font-size:14px}#gyPmSheet .tr-m span{font-size:13px;color:var(--pm-sub)}
#gyPmSheet .tr-read{background:var(--pm-card);border-radius:14px;padding:12px 14px;font-size:14.5px;line-height:1.7;margin-bottom:10px;box-shadow:0 0 0 .5px var(--pm-hair);white-space:normal}
#gyPmSheet .tr-read .muted{color:var(--pm-sub);font-size:13px}#gyPmSheet .tr-read .by{text-align:right;color:var(--pm-sub);font-size:12px;margin-top:6px}
/* 今天吃什么 */
.wx-fd{height:100%;display:flex;flex-direction:column;justify-content:center;gap:6px;position:relative}
.wx-fd em{font-style:normal;font-size:11px;letter-spacing:1.5px;color:var(--pm-sub);font-weight:600}
.wx-fd b{font-size:26px;font-weight:700;line-height:1.2}.wx-fd span{font-size:11.5px;color:var(--pm-sub)}
.wx-fd .dice{position:absolute;right:0;top:0;font-style:normal;font-size:22px}
.wx-fd.roll b{opacity:.55;filter:blur(.4px)}.wx-fd.roll .dice{animation:pmSpin .3s linear infinite}
.wx-fd.t{flex-direction:row;align-items:center;justify-content:space-between;gap:8px}.wx-fd.t span{font-size:11px}.wx-fd.t b{font-size:16px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wx-fd.t em{font-size:18px;letter-spacing:0}
.wx-fd.t.roll em{animation:pmSpin .3s linear infinite}
/* 我和 TA */
.wx-us .avs{display:flex;align-items:center}
.wx-us .avs span{width:46px;height:46px;border-radius:50%;overflow:hidden;display:flex;box-shadow:0 0 0 3px var(--pm-card)}
.wx-us .avs span>*{width:100%!important;height:100%!important;border-radius:50%!important;margin:0!important;border:none!important}
.wx-us .avs span+i+span{margin-left:-10px}
.wx-us .avs i{font-style:normal;color:var(--pm-red);font-size:14px;z-index:2;margin:0 -6px;width:22px;height:22px;border-radius:50%;background:var(--pm-card);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.1)}
.wx-us.s{height:100%;display:flex;flex-direction:column;justify-content:center;gap:6px}
.wx-us em{font-style:normal;font-size:12px;color:var(--pm-sub)}.wx-us b{font-size:22px;font-weight:700}
.wx-us.m{height:100%;display:flex;align-items:center;gap:16px}.wx-us.m .rt{display:flex;flex-direction:column;gap:3px;min-width:0}.wx-us.m .rt span{font-size:11.5px;color:var(--pm-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wx-us.m .avs span{width:56px;height:56px}
/* TA 的动态 */
.wx-fe{height:100%;display:flex;flex-direction:column;gap:6px;min-height:0}
.wx-fe .hd{display:flex;align-items:center;gap:7px;padding-right:28px}.wx-fe .hd .av{width:30px;height:30px;border-radius:50%;overflow:hidden;display:flex;flex-shrink:0}.wx-fe .hd .av>*{width:100%!important;height:100%!important;border-radius:50%!important;margin:0!important}
.wx-fe .hd b{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wx-fe .hd>span{font-size:11px;color:var(--pm-sub);flex-shrink:0}
.wx-fe p{margin:0;font-size:13.5px;line-height:1.5;flex:1;overflow:hidden}
.wx-fe.m p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.wx-fe .pic{height:44%;border-radius:12px;background:var(--pm-fill) center/cover;flex-shrink:0}
.wx-fe .ft{font-size:11px;color:var(--pm-sub)}
/* 搜索条 */
.wx-se{height:100%;display:flex;align-items:center;gap:8px;border-radius:999px;background:var(--pm-fill);padding:0 16px;margin:0 -4px;color:var(--pm-sub);font-size:14.5px}
.wx-se svg{width:18px;height:18px;flex-shrink:0}
.wx-se.line{background:none;border-radius:0;border-bottom:1.5px solid var(--pm-text);color:var(--pm-text);margin:0}
#gyPmHome .pm-w.wk-search{padding:14px 4px;background:transparent;box-shadow:none}
#gyPmHome .pm-w.wk-search .wx-se:not(.line){background:var(--pm-glass);backdrop-filter:blur(20px) saturate(1.5);-webkit-backdrop-filter:blur(20px) saturate(1.5);box-shadow:0 0 0 .5px var(--pm-hair),0 6px 18px rgba(0,0,0,.06)}
#gyPmHome .pm-w.wk-search[class*=" th-"] .wx-se:not(.line){background:var(--pm-card);backdrop-filter:none}
.pm-se-row{display:flex;align-items:center;gap:12px;padding:9px 6px;border-bottom:.5px solid var(--pm-hair);cursor:pointer}
.pm-se-row .av{width:34px;height:34px;border-radius:50%;overflow:hidden;display:flex}.pm-se-row .av>*{width:100%!important;height:100%!important;border-radius:50%!important;margin:0!important}
.pm-se-row .ic{width:34px;height:34px;border-radius:9px;background:var(--pm-ic-bg);color:var(--pm-ic-fg);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 .5px var(--pm-hair)}.pm-se-row .ic svg{width:19px;height:19px}
.pm-se-row b{flex:1;font-size:15px;font-weight:500}.pm-se-row em{font-style:normal;font-size:12px;color:var(--pm-sub)}
/* 胶囊标签 */
.wx-tg{height:100%;display:flex;align-items:center;gap:6px;flex-wrap:nowrap;overflow:hidden}
.wx-tg span{flex-shrink:0;padding:6px 12px;border-radius:999px;font-size:12.5px;box-shadow:inset 0 0 0 1.2px var(--pm-text);white-space:nowrap}
.wx-tg.fill span{box-shadow:none;background:var(--pm-accent);color:var(--pm-accent-fg)}
.wx-tg.mix .k0{background:var(--pm-accent);color:var(--pm-accent-fg);box-shadow:none}.wx-tg.mix .k1{background:var(--pm-fill);box-shadow:none}
#gyPmHome .pm-w.wk-tags{background:transparent;box-shadow:none;padding:10px 2px}
#gyPmHome .pm-w.wk-tags[class*=" th-"]{background:var(--pm-card);padding:10px 12px}
/* 心情 */
.wx-md{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;text-align:center;background:radial-gradient(circle at 50% 42%,var(--md,transparent) 0 40%,transparent 41%)}
.wx-md em{font-style:normal;font-size:11px;letter-spacing:1.5px;color:var(--pm-sub);font-weight:600}
.wx-md b{font-size:20px;font-weight:600;white-space:nowrap}.wx-md span{font-size:12px;color:var(--pm-sub)}
.wx-md.t{position:static;height:100%;flex-direction:row;background:none;gap:8px;justify-content:flex-start}.wx-md.t b{font-size:15px}.wx-md.t .dt{width:10px;height:10px;border-radius:50%;flex-shrink:0}
/* 年度进度 */
.wx-yr{height:100%;display:flex;flex-direction:column;justify-content:center;gap:8px}
.wx-yr .top{display:flex;justify-content:space-between;align-items:baseline;gap:6px}.wx-yr .top b{font-family:var(--pm-num);font-size:17px;font-weight:700}.wx-yr .top span{font-size:11.5px;color:var(--pm-sub)}
.wx-yr .bar{height:8px;border-radius:4px;background:var(--pm-fill);overflow:hidden}.wx-yr .bar i{display:block;height:100%;background:var(--pm-accent);border-radius:4px}
.wx-yr.s{gap:6px}.wx-yr.s em{font-style:normal;font-size:12px;font-weight:700;letter-spacing:2px;color:var(--pm-sub)}
.wx-yr.s .mo{display:grid;grid-template-columns:repeat(6,1fr);gap:5px}.wx-yr.s .mo i{height:14px;border-radius:4px;background:var(--pm-fill)}.wx-yr.s .mo i.on{background:var(--pm-accent)}.wx-yr.s .mo i.now{background:var(--pm-red)}
.wx-yr.s b{font-family:var(--pm-num);font-size:30px;font-weight:300}.wx-yr.s span{font-size:11px;color:var(--pm-sub)}
.wx-yr.t .top b{font-size:15px}
`;
    function css() { if (document.getElementById('gyPmWgCss')) return; const s = document.createElement('style'); s.id = 'gyPmWgCss'; s.textContent = CSS; document.head.appendChild(s); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', css); else css();
})();
