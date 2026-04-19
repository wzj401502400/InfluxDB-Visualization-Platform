// server/middleware/auth.js

/*
Read the user's login session (typically based on the 'sid' cookie, using the cookieParser middleware).
The session object should contain the required fields: token, influxUrl (possibly also userId, org, etc.). */
import { getSession } from '../services/session.js';

export function requireAuth(req, res, next) {
  const sess = getSession(req);   // Use req directly in REST scenarios
  if (!sess || !sess.token || !sess.influxUrl) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });// 'ok' is a custom field indicating success/failure
  }
  req.auth = sess; // Make session available to subsequent route handlers
  /*
  req.auth is a custom property we attach manually.
  Any middleware or route handler later in the same request can access the session via req.auth.
  sess is an object (e.g. { sid:'abc', token:'xxx', influxUrl:'http://...', userId:123 }),
  so req.auth holds the full session info for business logic, not just a boolean. */
  next();
}