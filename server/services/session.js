// server/services/session.js

//会话管理（session management），用 cookie + 内存 Map 来保存用户登录状态。

import cookieParser from 'cookie-parser';//cookie-parser：一个 Express 中间件，能把请求头里的 Cookie 字符串解析成 req.cookies 对象
import crypto from 'crypto';//crypto：Node.js 内置的加密模块，这里用来生成随机的 session ID

const sessions = new Map(); // 演示用；生产换 Redis

/*给 Express app 装上 cookieParser 中间件。

这样每个请求都会自动把 cookie 解析到 req.cookies 里。

例如：请求头里有 Cookie: sid=123 → req.cookies.sid === "123"。 */
export function sessionMiddleware(app) {
  app.use(cookieParser(process.env.COOKIE_SECRET || 'dev-secret'));
}

/*创建新会话，并把 sid 发到客户端。

crypto.randomUUID() → 生成一个全局唯一的字符串作为 session id。

sessions.set(sid, data) → 把这个 sid 和用户数据绑定存储在 Map 中。

res.cookie('sid', sid, {...}) → 在响应里设置一个名为 sid 的 cookie。

httpOnly: true → 浏览器 JS 无法读取（防止 XSS 窃取）。

sameSite: 'lax' → 默认禁止跨站请求伪造（CSRF）的大多数情况。

secure: true（注释掉了） → 要求 HTTPS 传输，生产环境建议打开。 */
export function setSession(res, data) {
  const sid = crypto.randomUUID();
  sessions.set(sid, data);
  res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax' /*, secure: true(HTTPS)*/ });
}

/*根据请求带的 sid cookie 找回用户会话。

从请求的 cookie 里拿 sid。

如果有 sid，就到 sessions Map 查对应的数据。

如果没有或没找到，返回 null。 */
export function getSession(req) {
  const sid = req.cookies?.sid;
  return sid ? sessions.get(sid) : null;
}

/*作用：清理会话（登出）。

从 cookie 里取出 sid。

如果存在，就从 sessions Map 里删除。

同时调用 res.clearCookie('sid') 让浏览器把 sid cookie 删除。

典型用法：用户点“登出”时调用它，彻底清除服务端和客户端的登录状态。 */
export function clearSession(req, res) {
  const sid = req.cookies?.sid;
  if (sid) sessions.delete(sid);
  res.clearCookie('sid');
}
