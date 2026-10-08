// 一次把所有测试跑完，最后汇总哪个过了、哪个没过。
// 用法（在项目根目录，也就是 index.html 那一层）：
//   node _开发测试/run-all.mjs
// 或者直接双击 _开发测试/自测.bat
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const TESTS = [
  ['features-0923-test.mjs', '9/23 新功能（版本号/思维链/状态栏/卡片手机/TA定/今天/开关/推文图/角色卡）'],
  ['save-preset-test.mjs',   '增量保存（大图只存一次）+ 一键配置 / 我的配置'],
  ['peer-life-test.mjs',     '角色之间自己来往 + 时间管理大师列出所有功能'],
  ['life-dice-test.mjs',     '生活里的意外 + 今天面板能上下滑'],
  ['more-acts-test.mjs',     '自主模式接上各个小功能'],
  ['today-mobile-test.mjs',  '手机上的「今天」'],
  ['online-notify-test.mjs', '在线找资源 + 第二批动作 + 通知能跳'],
  ['peek-bio-test.mjs',      '偷翻日记 + 过往签名 + 论坛/匿名回帖 + 朋友圈'],
  ['wechat-mode-test.mjs',   '微信模式切换'],
  ['phone-mode-test.mjs',    '小手机模式'],
  ['phone-widgets-test.mjs', '小手机：更多小组件/款式/颜色/裁剪/锁屏'],
  ['phone-extra-test.mjs',   '小手机：灵动岛/随意摆+拉边调大小/字能改/一行5个/打开方式/小窗/景深3D/实况'],
  ['notif-jump-test.mjs',   '点通知 / 弹窗 / 小手机通知中心 / 灵动岛：都能跳到对应页面'],
  ['chat-acts-route-test.mjs', '让 TA 写日记 / 去匿名论坛 / 论坛 / 朋友圈：做的是对的那件事；今天面板跟着更新'],
  ['v197-batch-test.mjs',    '事后反应 / 谁打给谁 / 邀请带上东西 / 塔罗 / 字体 / 弹窗拖大小 / 20个问题收藏'],
  ['v199-test.mjs',         '微信模式通讯录字母索引/资料页/相册；气泡尖尖；空的重新生成；自主模式写信写日记习惯'],
  ['v202-test.mjs',         '小手机神秘学 + 新小组件 + 今日运势再摇 + 角色立绘差分 + 微信滚动条透明'],
  ['v203-test.mjs',         '返回（系统返回键/左边缘右滑/鼠标侧键）+ 经期记录（预测/日历/小组件/提醒/角色记得和照顾）'],
  ['v204-test.mjs',         '一起听 · 一起看（网易云/QQ音乐/B站……放进来，TA 知道在放什么）'],
  ['v206-plugins-test.mjs',  '新玩法插件：桌面上的TA/深夜电台/自习室/梦/涂鸦/交换日记/平行世界/养小生命/时间胶囊/明信片/拆信/小约定/叫醒哄睡/草稿箱'],
  ['v207-plugins-test.mjs',  '新玩法插件第二批：默契问答/纪念日惊喜/熬夜/相册/做饭/来电/小游戏加三款/愿望/一百件小事/树洞/早安简报/存钱罐/抱抱 + 今天面板'],
  ['v208-plugins-test.mjs',  '新玩法插件第三批：一起旅行/吵架和好/情侣头像/追剧进度/给TA过生日/一起记账 + 哄睡故事 + 所有插件的小组件 + 查重'],
  ['v209-fixes-test.mjs',  '这一轮修复：开场预览/钱包闪/语音拉取模型+三种语音条/选文件和文件夹/TA 每天重想节奏/白露一万字卡/桌面TA立绘/记忆总览/小功能整理/换个世界/神秘学加量'],
  ['v210-plugins-test.mjs', '记忆加强（生活小档案/总结滚雪球/番外隔离/好感两层）+ 12 个新玩法（时光机/TA眼中的你/互换身份/星图/心跳/散步/贴贴/合照/回忆放映/漂流瓶/小屋/留声机）'],
  ['v211-plugins-test.mjs', '白露字词字卡（拼句/连发/夹词）+ 口头禅传染/我们的书/你还记得吗/暗号/调查问卷/兑换券/提问箱'],
  ['v212-plugins-test.mjs', '轮到你哄TA/帮我选/恋爱审批/每日一问/寻宝/文字冒险/成就/TA写的歌/周报'],
  ['v213-plugin-manager-test.mjs', '插件管理：多文件导入、同名覆盖、多选批量启用/停用/导出/删除'],
  ['v214-plugins-test.mjs', '备份补全 + 未来的TA/表情包工坊/等级/私教/随机掉落/睡前三件好事/省电模式'],
  ['v215-phone-widget-test.mjs', '手机桌面小组件：安卓 App 广播 / 苹果 Scriptable + 中转站 / 桌面点进来 / TA 留言'],
  ['v216-status-group-test.mjs', '心声/身体 · 分模块备份 · 表情回应 · TA 的备忘录 · 群主管理员/只围观/拼手气红包 · 报错分类/JSON 修复/约定≠已发生'],
  ['v217-polish-test.mjs', '整理过的外观：小功能一格一格 / 开关能展开 / 插件能搜 / 空播放器缩小 / 能关'],
  ['v218-pages-menu-test.mjs', '右键菜单不再闪没 + 弹窗变成页面（‹ 返回 / 系统返回 / 换页收起 / 小弹窗不动 / 能关）'],
  ['v219-time-sense-test.mjs', '感知真实时间总开关：开着跟以前一样，关上发给模型的内容里没有现实时间'],
  ['v220-place-preset-test.mjs', '时间与所在地（自定义时间 / 异地时区）+ 相处模式 / 风格调料 / 别把她写弱'],
  ['v221-prompt-lib-test.mjs', '内置提示词与内置世界书：列出来、能改、能恢复默认、能整体关掉'],
  ['v222-chat-think-test.mjs', '聊天里的「这一幕」：🕐 场景名 ›，点开是场景描写，里面还能看思考'],
  ['v223-npc-recall-test.mjs', '世界里的人：能改、能变成角色 + 撤回：偷看一眼、TA 自己决定撤回'],
  ['v224-lang-test.mjs', '外语和翻译：TA 说自己的语言、点「译」看中文、你的话自动翻'],
  ['bailu-test.mjs',        '白露：字卡代替 API——聊天/写信/日记/自主模式/字卡库/存档和谷雨分开'],
  ['bailu-batch2-test.mjs', '白露第二批：字卡分组/去重/覆盖、真人节奏、表情/引用/拍一拍、格言、来电、心情手账、小玩法'],
  ['bailu-batch3-test.mjs', '白露第三批：字卡条件和关键词、每个角色单独概率、按角色导出、语音库、图片走图库'],
  ['post-regen-test.mjs',    '让 TA 重新写推文'],
  ['memhub-extra-test.mjs',  '记忆总览：其它记忆能改能删'],
  ['boot-test.mjs',          '启动自检'],
  ['binding-test.mjs',       '按钮有没有绑到不存在的函数'],
  ['input-test.mjs',         '输入框永远能打字'],
  ['leak-test.mjs',          'JSON/思维链不外泄 + 流式'],
  ['stream-group-test.mjs',  '聊天流式 + 群聊转私聊'],
  ['retrigger-test.mjs',     '聊天：空着点发送＝重生成'],
  ['recomment-test.mjs',     '评论：空着点回复＝重生成'],
  ['letter-test.mjs',        '写信/回信'],
  ['feed-test.mjs',          '推特流 / 路人 NPC'],
  ['relationship-test.mjs',  '关系网影响回复'],
  ['adaptive-test.mjs',      '名字/时间不写死'],
  ['scrollbar-test.mjs',     '浮层式滚动条'],
  ['tavern-bridge-test.mjs', '助手脚本兼容层'],
  ['run.mjs',                '续写工作台全链路'],
];
// 需要额外素材的：有素材才跑
if (fs.existsSync(path.join(root, '_test', 'card-闻述-状态栏.json'))) TESTS.push(['card-test.mjs', '角色卡状态栏']);

// 🃏 白露：下面这些是谷雨原来的测试，测的是「接 API 时提示词怎么写、请求怎么发」——它们自己假装成 API 返回固定内容。
//    白露不接 API（回复都从字卡来），这些断言在白露里本来就不成立，默认跳过。想硬跑：node _开发测试/run-all.mjs --all
const API_ONLY = new Set(['features-0923-test.mjs', 'peer-life-test.mjs', 'life-dice-test.mjs', 'more-acts-test.mjs', 'online-notify-test.mjs', 'peek-bio-test.mjs',
  'post-regen-test.mjs', 'leak-test.mjs', 'stream-group-test.mjs', 'retrigger-test.mjs', 'recomment-test.mjs', 'letter-test.mjs', 'feed-test.mjs', 'relationship-test.mjs', 'adaptive-test.mjs', 'run.mjs']);
const ALL = process.argv.includes('--all');
if (!ALL) { const n0 = TESTS.length; for (let i = TESTS.length - 1; i >= 0; i--) if (API_ONLY.has(TESTS[i][0])) TESTS.splice(i, 1); console.log(`（白露：跳过了 ${n0 - TESTS.length} 组只对接 API 有意义的测试）\n`); }
const only = process.argv.slice(2).filter(a => a !== '--all');
const list = only.length ? TESTS.filter(t => only.some(o => t[0].includes(o))) : TESTS;
const out = [];
const t0 = Date.now();
for (const [file, label] of list) {
  process.stdout.write(`▶ ${label}（${file}）… `);
  const s = Date.now();
  const r = spawnSync(process.execPath, [path.join('_开发测试', file)], { cwd: root, encoding: 'utf8', timeout: 5 * 60000 });
  const txt = (r.stdout || '') + (r.stderr || '');
  const sum = (txt.match(/(\d+)\/(\d+)\s*通过/) || [])[0] || (/全部通过/.test(txt) ? '全部通过' : '');
  const ok = r.status === 0;
  console.log(`${ok ? '✅' : '❌'} ${sum}  ${((Date.now() - s) / 1000).toFixed(0)}s`);
  if (!ok) console.log(txt.split('\n').filter(l => /❌|→|Error|错误/.test(l)).slice(0, 12).map(l => '     ' + l.trim()).join('\n'));
  out.push({ file, label, ok, sum });
}
const bad = out.filter(x => !x.ok);
console.log(`\n${out.length - bad.length}/${out.length} 组通过，用时 ${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
if (bad.length) console.log('没过的：' + bad.map(b => b.label).join('、'));
fs.writeFileSync(path.join(here, '自测结果.txt'),
  `白露自测 ${new Date().toLocaleString('zh-CN')}\n\n` + out.map(x => `${x.ok ? '✅' : '❌'} ${x.label}  ${x.sum}`).join('\n') + '\n', 'utf8');
process.exit(bad.length ? 1 : 0);
