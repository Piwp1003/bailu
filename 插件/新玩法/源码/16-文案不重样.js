/* 💬 文案不重样：弹窗、提示的字不再每次都一模一样——同一个意思换着花样说，还能挑语气、加颜文字；关掉就是原来的字 */
if (window.__gyxVary) return; window.__gyxVary = 1;
X.feat('gyxVary', { n: '💬 文案不重样', desc: '弹窗提示换着说法、可选语气和颜文字', auto: false });
const S = X.store('vary');
let C = { tone: 'mix', kao: 30, emo: true };
// 意思 → 几种说法（温柔 / 俏皮 / 简洁 各一组）
const R = [
    [/^(已?保存(了|成功)?|保存好了|存好了)[!！。~～]*$/, { soft: ['帮你存好啦', '记下来了', '好好收着了'], cute: ['存档完毕 ✓', '收进小本本了', '稳稳存住啦'], short: ['已保存', '存好了', '✓ 保存'] }],
    [/^(已?发送(成功)?|发过去了|已发出)[!！。~～]*$/, { soft: ['送到啦', '已经交到 TA 手里了', 'TA 会看到的'], cute: ['嗖——送达！', '快递小哥已签收', '发射成功 🚀'], short: ['已发送', '发出去了', '✓ 已送达'] }],
    [/^(复制成功|已复制)[!！。~～]*$/, { soft: ['复制好了，去粘贴吧', '已经放进剪贴板了'], cute: ['Ctrl+C 成功 ✓', '偷偷复制好了'], short: ['已复制', '✓ 复制'] }],
    [/^(已?删除(了|成功)?)[!！。~～]*$/, { soft: ['已经拿走了', '清掉了'], cute: ['咻，没了', '扔进垃圾桶了'], short: ['已删除', '删掉了'] }],
    [/^(导入成功|✅ ?导入成功|已导入)[!！。~～]*$/, { soft: ['都搬进来了', '导进来了，去看看吧'], cute: ['搬家完成 📦', '全部入住 ✓'], short: ['导入成功', '✓ 已导入'] }],
    [/^(✅ ?)?导出成功[!！。~～]*$/, { soft: ['导出好了，记得收好', '打包好了'], cute: ['打包带走 📦', '导出完成 ✓'], short: ['导出成功', '✓ 已导出'] }],
    [/^(生成中|正在生成|生成中\.\.\.|正在生成…*)$/, { soft: ['TA 在想……', '稍等，马上好', '在写了在写了'], cute: ['脑子转起来了……', '加载灵感中……', '咕噜咕噜……'], short: ['生成中…', '稍等…'] }],
    [/^(接口报错|请求失败|网络错误|出错了)[!！。~～]*$/, { soft: ['刚刚没连上，再试一次吧', '网络打了个盹', '没成功，别着急'], cute: ['呜，掉线了', '信号被外星人截走了', '网线打结了'], short: ['请求失败', '没连上', '出错了'] }],
    [/^(还没有角色)[!！。~～]*$/, { soft: ['先请一位 TA 来吧', '这里还空着，等一个人'], cute: ['角色库空空如也', '主角还没登场'], short: ['还没有角色', '先建一个角色'] }],
    [/^(这次没写出内容)[!！。~～]*$/, { soft: ['TA 这次卡壳了，再来一次？', '没写出来，换个时间试试'], cute: ['TA 大脑一片空白', '灵感离家出走了'], short: ['没写出内容', '生成为空'] }],
    [/^(设置没存住)[!！。~～]*$/, { soft: ['设置好像没存上，再点一次', '刚才没存住'], cute: ['设置溜走了', '存档君罢工了'], short: ['保存失败'] }],
    [/^(回复模式已切换)[!！。~～]*$/, { soft: ['换好了', '切过去了'], cute: ['模式切换 ✓', '咔哒，换好了'], short: ['已切换'] }]
];
const KAO = ['(｡･ω･｡)', '(๑•̀ㅂ•́)و✧', '(ง •̀_•́)ง', '(*/ω＼*)', '(｡♥‿♥｡)', 'ヾ(≧▽≦*)o', '(´▽`ʃ♡ƪ)', '( •̀ ω •́ )✧', '(っ´ω`c)', '(=^･ω･^=)'];
function vary(t) {
    if (!t || typeof t !== 'string' || !X.on('gyxVary')) return t;
    const plain = t.replace(/<[^>]+>/g, '').trim();
    for (const [re, v] of R) if (re.test(plain)) { const tone = C.tone === 'mix' ? X.pick(['soft', 'cute', 'short']) : C.tone; t = X.pick(v[tone] || v.soft); break; }
    if (C.kao && Math.random() * 100 < C.kao && !/[☀-➿]|[\uD83C-\uDBFF]/.test(t.slice(-2))) t += ' ' + X.pick(KAO);
    return t;
}
window.gyxVaryText = vary;
function hook() {
    const f = window.showToast; if (typeof f !== 'function' || f.__gyxV) return;
    const w = function (av, title, content) { const a = [].slice.call(arguments); try { a[1] = vary(title); if (typeof content === 'string' && content) a[2] = content; } catch (e) {} return f.apply(this, a); };
    w.__gyxV = true; window.showToast = w;
}
window.gyxVaryOpen = function () {
    X.panel('gyxVrOv', '💬 文案不重样', `<div class="gyx-tip">打开之后，「已保存」「发过去了」「接口报错」这类提示会换着说法；关掉（功能开关里）就是原来的字。</div>
        <div class="gyx-row">语气：${[['mix', '随机'], ['soft', '温柔'], ['cute', '俏皮'], ['short', '简洁']].map(([k, n]) => `<span class="gyx-chip ${C.tone === k ? 'on' : ''}" onclick="gyxVarySet('tone','${k}')">${n}</span>`).join('')}</div>
        <div class="gyx-row">加颜文字的概率 <input type="range" min="0" max="100" value="${C.kao}" onchange="gyxVarySet('kao',+this.value)"> ${C.kao}%</div>
        <div class="gyx-row"><button class="gyx-btn lite" onclick="showToast('', '保存成功', '')">试一下</button></div>`);
};
window.gyxVarySet = (k, v) => { C[k] = v; S.set('c', C); window.gyxVaryOpen(); };
X.mini({ id: 'gyxVary', icon: '💬', title: '文案不重样', desc: '弹窗提示换着说法，可选温柔 / 俏皮 / 简洁，还能加颜文字', onOpen: () => window.gyxVaryOpen() });
(async () => { C = Object.assign(C, await S.get('c', {})); hook(); setInterval(hook, 3000); })();
