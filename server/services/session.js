// server/services/session.js

// Session management using cookie + in-memory Map to store user login state.

import cookieParser from 'cookie-parser';// cookie-parser: Express middleware that parses Cookie header into req.cookies
import crypto from 'crypto';// crypto: built-in Node.js module, used here to generate random session IDs

const sessions = new Map(); // For demo only; use Redis in production

/*
Attach cookieParser middleware to the Express app.
Every request will automatically parse cookies into req.cookies.
e.g. Cookie: sid=123 -> req.cookies.sid === "123" */
export function sessionMiddleware(app) {
  app.use(cookieParser(process.env.COOKIE_SECRET || 'dev-secret'));
}

/*
Create a new session and send the sid cookie to the client.

crypto.randomUUID() -> generates a globally unique string as the session id.
sessions.set(sid, data) -> stores the sid-to-data mapping.
res.cookie('sid', sid, {...}) -> sets a cookie named 'sid' in the response.
  httpOnly: true -> browser JS cannot access it (prevents XSS theft).
  sameSite: 'lax' -> blocks most cross-site request forgery (CSRF) scenarios.
  secure: true (commented out) -> requires HTTPS; recommended for production. */
export function setSession(res, data) {
  const sid = crypto.randomUUID();
  sessions.set(sid, data);
  res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax' /*, secure: true(HTTPS)*/ });
}

/*
Retrieve the user session based on the sid cookie in the request.
Returns the session data if found, otherwise null. */
export function getSession(req) {
  const sid = req.cookies?.sid;
  return sid ? sessions.get(sid) : null;
}

/*
Destroy the session (logout).
Deletes the session from the Map and clears the sid cookie. */
export function clearSession(req, res) {
  const sid = req.cookies?.sid;
  if (sid) sessions.delete(sid);
  res.clearCookie('sid');
}
