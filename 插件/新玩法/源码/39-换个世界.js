/* 🎭 换个世界：小剧场换世界观——TA 保持自己的人设，被丢进另一个世界：哈利波特里是哪个学院几年级、魔杖什么样、守护神是什么；修仙界里哪个门派什么灵根……先出一张「设定卡」，再演一段，你可以接着往下演。全是番外，不混进你们的正经记忆（想记也可以勾） */
if (window.__gyxTheater) return; window.__gyxTheater = 1;
X.feat('gyxTheater', { n: '🎭 换个世界', desc: 'TA 保持人设，换到哈利波特、修仙、民国、赛博朋克……等世界观里演一段' });
const S = X.store('theater');
let D = { runs: [], cfg: { mem: false, per: 6 } };   // run: {id, world, custom, cids:[], me:bool, cards:{cid:{f:{}, why}}, scenes:[{by, t, at}], at}
// 世界观：名字、图标、设定卡要填哪几项、白露（不接 API）随机用的候选
const W = {
    hp: { n: '哈利波特', ico: '🪄', f: { 学院: ['格兰芬多', '斯莱特林', '拉文克劳', '赫奇帕奇'], 年级: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级'], 魔杖: ['冬青木·凤凰羽毛·11英寸', '紫杉木·独角兽毛·13英寸', '柳木·龙心弦·10¾英寸', '雪松木·凤凰羽毛·12英寸', '黑胡桃木·龙心弦·12½英寸', '樱桃木·独角兽毛·10英寸'], 守护神: ['银狐', '雪鸮', '水獭', '黑豹', '牡鹿', '白狼', '渡鸦', '野兔'], 最拿手: ['魔药课', '变形术', '黑魔法防御术', '魔咒课', '草药课', '天文课', '保护神奇生物'], 宠物: ['猫头鹰', '猫', '蟾蜍', '没养'], 魁地奇: ['找球手', '追球手', '击球手', '守门员', '只在看台上看'] } },
    xian: { n: '仙侠修真', ico: '⚔️', f: { 门派: ['昆仑剑宗', '青云门', '天机阁', '药王谷', '合欢宗', '散修'], 灵根: ['单灵根·冰', '天灵根·雷', '双灵根·木火', '变异灵根·风', '五灵根（废柴逆袭）'], 境界: ['炼气期', '筑基期', '金丹期', '元婴期', '化神期'], 本命法宝: ['一柄寒铁剑', '一把折扇', '一盏琉璃灯', '一支玉笛', '一方古琴'], 道号: ['清寒', '无涯', '照夜', '惊蛰', '长明'] } },
    gong: { n: '古风宫廷', ico: '🏯', f: { 身份: ['摄政王', '少年将军', '新科状元', '御前侍卫统领', '江湖郎中', '太子太傅'], 住在: ['东宫', '镇北王府', '城西小院', '御史台', '太医院'], 擅长: ['兵法', '诗文', '医术', '轻功', '权谋'], 口头禅: ['放肆', '本王自有分寸', '且慢', '无妨'] } },
    minguo: { n: '民国', ico: '🎩', f: { 身份: ['留洋归来的医生', '报社主编', '督军家少爷', '戏班名角', '码头帮会二当家', '大学教授'], 城市: ['上海', '北平', '天津', '南京', '广州'], 常去: ['百乐门', '咖啡馆', '戏园子', '书局', '跑马场'], 随身带: ['怀表', '钢笔', '一封没寄出的信', '勃朗宁手枪'] } },
    cyber: { n: '赛博朋克', ico: '🌃', f: { 职业: ['黑客', '赏金猎人', '义体医生', '公司特工', '地下酒吧老板'], 义体: ['光学义眼', '机械左臂', '神经接口', '皮下护甲', '一点都没装'], 所属: ['荒坂系企业', '街头帮派', '自由职业', '地下抵抗组织'], 代号: ['夜鸦', '零号', '灰烬', '霓虹', '回声'] } },
    fantasy: { n: '西幻冒险', ico: '🐉', f: { 种族: ['人类', '精灵', '龙裔', '吸血鬼', '半兽人'], 职业: ['骑士', '法师', '游侠', '吟游诗人', '牧师', '盗贼'], 阵营: ['守序善良', '混乱善良', '绝对中立', '守序邪恶'], 武器: ['长剑', '法杖', '长弓', '鲁特琴', '双匕首'] } },
    campus: { n: '校园青春', ico: '🏫', f: { 年级: ['高一', '高二', '高三', '大一', '大三'], 社团: ['篮球队', '学生会', '文学社', '天文社', '乐队'], 座位: ['靠窗最后一排', '你的前桌', '你的同桌', '隔壁班'], 人设: ['学霸', '校草', '转学生', '体育委员', '不良少年其实很温柔'] } },
    doom: { n: '末日废土', ico: '☢️', f: { 身份: ['前特种兵', '流浪医生', '拾荒者', '据点首领', '机械师'], 技能: ['枪法', '急救', '改装车辆', '野外生存', '谈判'], 武器: ['改装霰弹枪', '消防斧', '弩', '自制电棍'], 据点: ['废弃商场', '地铁站', '灯塔', '一辆房车'] } },
    star: { n: '星际', ico: '🚀', f: { 舰船: ['「晨星号」', '「渡鸦号」', '「长夜号」', '「白鲸号」'], 职位: ['舰长', '领航员', '首席工程师', '舰医', '外交官'], 出身: ['火星殖民地', '地球', '小行星带', '某颗冰冻卫星'], 秘密: ['其实是仿生人', '在找失踪的家人', '背负一笔星际债务', '没有秘密'] } },
    detective: { n: '侦探推理', ico: '🔍', f: { 身份: ['私家侦探', '刑警队长', '法医', '推理小说家', '神秘嫌疑人'], 擅长: ['观察细节', '审讯', '验尸', '心理侧写', '开锁'], 怪癖: ['思考时要吃糖', '不穿外套不出门', '只喝黑咖啡', '会在纸上画小人'] } },
    idol: { n: '娱乐圈', ico: '🎤', f: { 身份: ['顶流歌手', '实力派演员', '经纪人', '新人练习生', '金牌制作人'], 人设: ['高冷', '暖男', '综艺感满分', '神秘低调'], 绯闻: ['从来没有', '和你（被拍到了）', '全是营销'] } },
    vamp: { n: '吸血鬼 / 异能', ico: '🦇', f: { 种族: ['古老的吸血鬼', '狼人', '异能者', '猎魔人', '普通人类'], 能力: ['读心', '瞬移', '操控火焰', '预知梦', '没有能力但很能打'], 年龄: ['看着二十多，其实三百岁', '真的二十多', '不记得了'] } },
    custom: { n: '自己写', ico: '✍️', f: {} }
};
const runOf = id => D.runs.find(r => r.id === id);
const wName = r => r.world === 'custom' ? (r.custom || '自定义世界').slice(0, 20) : W[r.world].n;
const wDesc = r => r.world === 'custom' ? r.custom : `「${W[r.world].n}」世界观`;
async function makeCard(c, r) {
    const w = W[r.world] || W.custom, fields = Object.keys(w.f);
    if (X.bailu()) { const f = {}; fields.forEach(k => { f[k] = X.pick(w.f[k]); }); return { f, why: X.cards(['小剧场', '聊天'], c, 1)[0] || '' }; }
    const j = X.json(await X.ask(`${X.who(c)}\n现在来玩一个「换个世界」的番外：你**保持自己的人设**（性格、说话方式、喜好、跟她的关系都不变），被放进${wDesc(r)}里。\n想想按你的性格和经历，你在那个世界会是什么样：${fields.length ? '按这几项填：' + fields.join('、') + '（可以不照常见答案，但要说得通）' : '自己决定填哪几项（身份、能力、住在哪……4~6 项）'}。再用一两句话说说为什么（用你自己的口吻）。\n只输出 JSON：{"f":{"项目":"内容"},"why":"一两句话"}`));
    const f = (j && j.f && typeof j.f === 'object') ? j.f : {}; if (!Object.keys(f).length) fields.forEach(k => { f[k] = X.pick(w.f[k]); });
    return { f, why: X.plain(String((j && j.why) || '')) };
}
async function scene(r, my) {
    const cs = r.cids.map(X.char).filter(Boolean); if (!cs.length) return null;
    let t;
    const last = r.scenes.slice(-4).map(s => (s.by === 'me' ? '她' : '剧情') + '：' + s.t).join('\n');
    if (X.bailu()) t = cs.map(c => `${X.name(c)}：` + (X.cards(['小剧场', '旁白', '聊天'], c, 2).join('') || '……')).join('\n');
    else {
        const cards = cs.map(c => `${X.name(c)}在这个世界里：${Object.entries((r.cards[c.id] || {}).f || {}).map(([k, v]) => k + '·' + v).join('，')}`).join('\n');
        t = X.plain(await X.ask(`${cs.map(c => X.who(c)).join('\n\n')}\n\n这是一个番外小剧场，世界观：${wDesc(r)}。${r.me ? `她（${X.me(cs[0])}）也在这个世界里。` : ''}\n${cards}\n${last ? '前情：\n' + last + '\n' : ''}${my ? '她刚才：' + my + '\n' : ''}\n写${last ? '接下来的' : '开场的'}一段（300~600 字）：第三人称小说体，角色保持各自的人设和说话方式，台词要像本人；世界观的细节要有（地名、术语、日常），但别照抄原作原文、也别让原作人物抢戏；结尾停在一个能接着演的地方。只输出正文。`) || '');
    }
    if (!t) return null;
    r.scenes.push({ by: 'story', t, at: Date.now() }); await S.set('d', D);
    if (D.cfg.mem) { try { if (typeof addTheaterLog === 'function') { const A = cs[0], B = cs[1] || cs[0]; addTheaterLog({ id: 'th_au' + Date.now().toString(36), at: Date.now(), charAId: A.id, charBId: B.id, charAName: X.name(A), charBName: X.name(B), relation: '番外', summary: `🎭 换个世界·${wName(r)}`, scene: t.slice(0, 600), statusA: '', statusB: '' }); if (typeof updateTheaterMemoryAsync === 'function') cs.forEach(c => updateTheaterMemoryAsync(c)); } } catch (e) {} }
    return t;
}
window.gyxTheaterNew = async function (o) {
    o = o || {}; const world = o.world || window.GYX_TH_W || 'hp', custom = o.custom != null ? o.custom : ((document.getElementById('gyxThC') || {}).value || '').trim();
    const cids = (o.cids || (window.GYX_TH_WHO || []).length && window.GYX_TH_WHO || [String((X.cur() || {}).id || '')]).filter(Boolean);
    if (world === 'custom' && !custom) { X.toast(X.v('先写写这个世界是什么样', '世界观还空着')); return null; }
    if (!cids.length) return null;
    const b = document.getElementById('gyxThGo'); if (b) { b.disabled = true; b.textContent = X.v('TA 在想自己会是谁……', '正在穿越……'); }
    const r = { id: 'th' + Date.now(), world, custom, cids, me: o.me != null ? o.me : !!(document.getElementById('gyxThMe') || {}).checked, cards: {}, scenes: [], at: Date.now() };
    for (const id of cids) { const c = X.char(id); if (c) r.cards[id] = await makeCard(c, r); }
    D.runs.unshift(r); await S.set('d', D);
    await scene(r);
    window.gyxTheaterOpen(r.id); return r;
};
window.gyxTheaterGo = async function (id, mine) {
    const r = runOf(id); if (!r) return null; const my = mine != null ? mine : ((document.getElementById('gyxThMy') || {}).value || '').trim();
    if (my) r.scenes.push({ by: 'me', t: my, at: Date.now() });
    const b = document.getElementById('gyxThNext'); if (b) { b.disabled = true; b.textContent = '……'; }
    const t = await scene(r, my); window.gyxTheaterOpen(id); return t;
};
window.gyxTheaterDel = async id => { D.runs = D.runs.filter(r => r.id !== id); await S.set('d', D); window.gyxTheaterOpen(); };
window.GYX_TH_W = 'hp'; window.GYX_TH_WHO = [];
window.gyxTheaterPickW = k => { window.GYX_TH_W = k; window.gyxTheaterOpen(); };
window.gyxTheaterPickWho = (id, on) => { const L = window.GYX_TH_WHO; const i = L.indexOf(id); if (on && i < 0) L.push(id); if (!on && i >= 0) L.splice(i, 1); };
window.gyxTheaterOpen = function (id) {
    const r = id && runOf(id);
    if (!r) {
        if (!window.GYX_TH_WHO.length && X.cur()) window.GYX_TH_WHO = [String(X.cur().id)];
        X.panel('gyxThOv', '🎭 换个世界', `<div class="gyx-tip">TA 保持自己的人设，被丢进另一个世界观里。先出一张设定卡（哪个学院、什么灵根……），再演一段，你可以接着往下演。都是番外，默认不混进正经记忆。</div>
            <div class="th-ws">${Object.entries(W).map(([k, w]) => `<div class="th-w${window.GYX_TH_W === k ? ' on' : ''}" onclick="gyxTheaterPickW('${k}')"><b>${w.ico}</b><span>${w.n}</span></div>`).join('')}</div>
            ${window.GYX_TH_W === 'custom' ? '<textarea id="gyxThC" class="gyx-in" rows="3" placeholder="写写这个世界：时代、地点、规则、大家是什么身份……（比如：大家都是猫的世界；或者某部你喜欢的作品的世界观）"></textarea>' : ''}
            <div class="gyx-tip">谁进去（可以多选，一起演）：</div><div class="gyx-row">${X.chars().map(c => `<label><input type="checkbox" ${window.GYX_TH_WHO.includes(String(c.id)) ? 'checked' : ''} onchange="gyxTheaterPickWho('${c.id}',this.checked)"> ${X.esc(X.name(c))}</label>`).join('　')}</div>
            <label class="gyx-row"><input id="gyxThMe" type="checkbox" checked> 我也在这个世界里</label>
            <div class="gyx-row"><button id="gyxThGo" class="gyx-btn" onclick="gyxTheaterNew()">开演</button></div>
            <label class="gyx-row gyx-tip"><input type="checkbox" ${D.cfg.mem ? 'checked' : ''} onchange="gyxTheaterCfg('mem',this.checked)"> 演完的也记进 TA 的小剧场记忆（不勾＝纯番外，TA 平时不会提）</label>
            ${D.runs.length ? '<div class="gyx-tip">演过的</div>' + D.runs.map(x => `<div class="th-it" onclick="gyxTheaterOpen('${x.id}')"><b>${(W[x.world] || W.custom).ico} ${X.esc(wName(x))}</b><span>${x.cids.map(i => X.esc(X.name(X.char(i)))).join('、')} · ${x.scenes.length} 段 · ${new Date(x.at).toLocaleDateString()}</span></div>`).join('') : ''}`);
        return;
    }
    X.panel('gyxThOv', `${(W[r.world] || W.custom).ico} ${X.esc(wName(r))}`, `<div class="th-cards">${r.cids.map(cid => { const c = X.char(cid), cd = r.cards[cid] || { f: {} }; return `<div class="th-card"><div class="th-ch">${X.esc(X.name(c))}</div>${Object.entries(cd.f).map(([k, v]) => `<div class="th-f"><em>${X.esc(k)}</em><b>${X.esc(v)}</b></div>`).join('')}${cd.why ? `<p class="gyx-hand">「${X.esc(cd.why)}」</p>` : ''}</div>`; }).join('')}</div>
        <div class="th-sc">${r.scenes.map(s => s.by === 'me' ? `<div class="th-me">你：${X.esc(s.t)}</div>` : `<div class="th-st">${X.esc(s.t).replace(/\n/g, '<br>')}</div>`).join('')}</div>
        <div class="gyx-row"><input id="gyxThMy" class="gyx-in" style="flex:1" placeholder="你接下来做什么 / 说什么（可空，空着就让剧情自己往下走）"><button id="gyxThNext" class="gyx-btn" onclick="gyxTheaterGo('${r.id}')">接着演</button></div>
        <div class="gyx-row"><button class="gyx-btn lite" onclick="gyxTheaterOpen()">← 换个世界</button><button class="gyx-btn lite" onclick="gyxTheaterDel('${r.id}')">删掉这场</button></div>`);
};
window.gyxTheaterCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxTheaterData = () => D;
X.action({ key: 'gyx_theater', label: '想跟她玩「换个世界」：如果我们在另一个世界观里……', hint: '突然的脑洞', need: () => true,
    run: async c => { const k = X.pick(Object.keys(W).filter(x => x !== 'custom')); const r = await window.gyxTheaterNew({ world: k, cids: [String(c.id)], me: true }); if (!r) return null; const f = (r.cards[c.id] || {}).f || {}; X.say(c, `🎭 突然想到：如果我们在${W[k].n}的世界里，我大概是${Object.values(f).slice(0, 2).join('、')}吧。去「换个世界」里看看？`); try { document.getElementById('gyxThOv')?.remove(); } catch (e) {} return '跟你玩了一场「换个世界」'; } }, 'gyxTheater');
X.ctx(id => { if (!D.cfg.mem) return ''; const r = D.runs.find(x => x.cids.includes(String(id))); return r ? `【番外】你们玩过「换个世界」：在${wName(r)}里你是${Object.values((r.cards[id] || {}).f || {}).slice(0, 3).join('、')}。` : ''; }, 'gyxTheater');
X.today(() => ({ title: '🎭 换个世界', rows: D.runs.filter(r => X.day(new Date(r.at)) === X.day()).map(r => ({ t: (W[r.world] || W.custom).ico, x: `${r.cids.map(i => X.esc(X.name(X.char(i)))).join('、')} 去了${X.esc(wName(r))}`, go: `gyxTheaterOpen('${r.id}')` })) }), 'gyxTheater');
X.widget('gyxTheaterW', { n: '换个世界', sizes: ['s', 'm'], tap: () => window.gyxTheaterOpen(D.runs[0] && D.runs[0].id), r: w => { const r = D.runs[0]; if (!r) return X.gw(w, '🎭', '换个世界', ['去另一个世界']); const f = (r.cards[r.cids[0]] || {}).f || {}; return X.gw(w, (W[r.world] || W.custom).ico, X.esc(wName(r)), Object.entries(f).slice(0, 3).map(([k, v]) => X.esc(k + '：' + v))); } }, 'gyxTheater');
X.memArr({ k: 'gyxTheater', ico: '🎭', n: '换个世界的番外', d: '演过的世界（删掉就是这场没演过）', arr: () => D.runs, cid: x => x.cids[0], text: x => wName(x), edit: (x, v) => { if (x.world === 'custom') x.custom = v; }, meta: x => x.scenes.length + ' 段 · ' + new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxTheater');
X.css('gyxThCss', `.th-ws{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;margin:8px 0}.th-w{padding:10px 6px;border-radius:14px;background:#f5f5f7;text-align:center;cursor:pointer}.th-w b{display:block;font-size:24px;font-weight:normal}.th-w span{font-size:12.5px}.th-w.on{background:#1d1d1f;color:#fff}
.th-it{padding:10px 12px;border-radius:14px;background:#f7f4ff;margin:6px 0;cursor:pointer}.th-it span{display:block;font-size:12px;color:#888}
.th-cards{display:flex;gap:10px;flex-wrap:wrap}.th-card{flex:1;min-width:200px;padding:14px;border-radius:18px;background:linear-gradient(160deg,#2b2440,#4a3b6b);color:#f5efe0;box-shadow:0 10px 26px rgba(43,36,64,.3)}.th-ch{font-size:18px;font-weight:700;margin-bottom:6px;letter-spacing:.05em}.th-f{display:flex;gap:8px;font-size:13.5px;padding:3px 0;border-bottom:1px dashed rgba(255,255,255,.15)}.th-f em{font-style:normal;opacity:.65;width:64px;flex-shrink:0}.th-card p{font-size:17px;margin:8px 0 0;opacity:.9}
.th-sc{margin:12px 0;display:flex;flex-direction:column;gap:10px}.th-st{padding:14px 16px;border-radius:16px;background:#fbf8f2;line-height:1.85;font-size:15px;color:#3b3024}.th-me{align-self:flex-end;max-width:85%;padding:8px 12px;border-radius:14px;background:#e8f2ff;font-size:14px}`);
X.mini({ id: 'gyxTheater', icon: '🎭', title: '换个世界', desc: 'TA 保持人设，换到哈利波特、修仙、民国、赛博朋克……世界观里演一段', cat: '一起做', onOpen: () => window.gyxTheaterOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.runs = D.runs || []; D.cfg = Object.assign({ mem: false, per: 6 }, D.cfg || {}); })();
