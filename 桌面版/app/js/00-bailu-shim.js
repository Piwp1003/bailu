/* ============================================================
   js/00 —— 白露和谷雨的存档分开（最先加载，在所有功能之前）
   ------------------------------------------------------------
   白露是从谷雨整套复制出来的，代码里存东西用的名字（localStorage 的键、本地数据库的名字）都一样。
   如果两个在同一个浏览器里打开（比如都是直接双击 index.html），不分开的话会读写同一份存档——
   白露里改了东西，谷雨那边也跟着变。
   这里在最前面给白露自己用的所有存储都套一层「bailu:」前缀：
     · localStorage：键名前面自动加 bailu:
     · localforage（本地数据库）：默认库和每个 createInstance 的库名前面加 bailu_
   其它代码一行都不用改。谷雨那边完全不受影响。
   ============================================================ */
(function () {
    'use strict';
    if (window.__bailuShim) return;
    window.__bailuShim = true;
    window.GY_APP_NAME = '白露';
    const P = 'bailu:';
    try {
        const ls = window.localStorage;
        const proto = Object.getPrototypeOf(ls);
        const g = proto.getItem, s = proto.setItem, r = proto.removeItem, k = proto.key, c = proto.clear;
        const mine = st => st === ls;
        proto.getItem = function (key) { return mine(this) ? g.call(this, P + key) : g.call(this, key); };
        proto.setItem = function (key, v) { return mine(this) ? s.call(this, P + key, v) : s.call(this, key, v); };
        proto.removeItem = function (key) { return mine(this) ? r.call(this, P + key) : r.call(this, key); };
        // 只列出 / 只清掉白露自己的键
        const ownKeys = st => { const out = []; for (let i = 0; i < st.length; i++) { const x = k.call(st, i); if (x && x.indexOf(P) === 0) out.push(x); } return out; };
        proto.key = function (i) { if (!mine(this)) return k.call(this, i); const o = ownKeys(this)[i]; return o == null ? null : o.slice(P.length); };
        proto.clear = function () { if (!mine(this)) return c.call(this); ownKeys(this).forEach(x => r.call(this, x)); };
    } catch (e) { console.warn('[白露] localStorage 分区没套上：', e); }
    try {
        if (typeof localforage !== 'undefined') {
            localforage.config({ name: 'bailu_localforage' });
            const ci = localforage.createInstance.bind(localforage);
            localforage.createInstance = function (opt) {
                opt = Object.assign({}, opt || {});
                opt.name = 'bailu_' + (opt.name || 'localforage');
                return ci(opt);
            };
        }
    } catch (e) { console.warn('[白露] 本地数据库分区没套上：', e); }
})();
