// server/middleware/auth.js

/*读取用户的登录会话（通常基于 cookie 里的 sid，结合你之前的 cookieParser 中间件）
这个会话对象里至少应包含你需要的业务字段：token、influxUrl（也可能还有 userId、org 等）。 */
import { getSession } from '../services/session.js';

export function requireAuth(req, res, next) {
  const sess = getSession(req);   // REST 场景下直接用 req
  if (!sess || !sess.token || !sess.influxUrl) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });//ok是自定义的，看看有没有成功
  }
  req.auth = sess; // 给后续路由使用
  /*默认没有 auth 这个属性，是手动加的。
加了以后，在同一次请求的后续处理中，任何中间件或路由都能通过 req.auth 访问到这个会话对象。
sess 本身不是布尔值，而是一个对象（例如 { sid:'abc', token:'xxx', influxUrl:'http://...', userId:123 }）。
所以 req.auth 里存的就是完整的 session 信息，方便业务逻辑使用，而不是一个 true/false。 */
  next();
}