// 谷雨小组件中转站（Cloudflare Worker）
// 作用：网页版 / 苹果手机把小组件数据存在这里，Scriptable 小组件来读。数据只放一份最新的，不存聊天记录。
// 部署：Cloudflare 后台 → Workers 和 Pages → 创建 Worker → 把这整段粘进去部署
//      → 再建一个 KV 命名空间（名字随便），回到这个 Worker 的「设置 → 绑定」里添加 KV，变量名必须写 WIDGET
//      → 把 Worker 的网址（https://xxx.workers.dev）填进谷雨「📲 手机桌面小组件」的「中转站地址」
export default {
  async fetch(req, env) {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const m = new URL(req.url).pathname.match(/^\/w\/([A-Za-z0-9_-]{16,64})$/);
    if (!m) return new Response('谷雨小组件中转站在运行 ✓', { headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } });
    if (!env.WIDGET) return new Response('还没绑定 KV（变量名要叫 WIDGET）', { status: 500, headers: cors });
    const key = 'w:' + m[1];
    if (req.method === 'POST') {
      const body = await req.text();
      if (body.length > 300000) return new Response('太大了', { status: 413, headers: cors });
      try { JSON.parse(body); } catch (e) { return new Response('不是 JSON', { status: 400, headers: cors }); }
      await env.WIDGET.put(key, body, { expirationTtl: 60 * 60 * 24 * 30 });
      return new Response('ok', { headers: cors });
    }
    const v = await env.WIDGET.get(key);
    return new Response(v || '{"cards":[]}', { headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
};
