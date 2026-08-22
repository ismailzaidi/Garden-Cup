/* ---------- small HTTP helpers shared by every route ----------
 * Vercel's Node runtime augments `res` with Express-like .status()/.json()
 * helpers and auto-parses a JSON body into req.body — these helpers only
 * add what that doesn't already give us: a consistent error shape, a method
 * guard, a request-size cap, and a place that never leaks exception detail
 * to the client.
 */
export function sendJson(res, status, body) {
  res.status(status).json(body ?? {});
}

export function sendError(res, status, code, message) {
  sendJson(res, status, { error: code, message });
}

export function methodGuard(req, res, allowed) {
  if (!allowed.includes(req.method)) {
    res.setHeader("Allow", allowed.join(", "));
    sendError(res, 405, "method_not_allowed", `Use ${allowed.join(" or ")}`);
    return false;
  }
  return true;
}

const MAX_BODY_BYTES = 512 * 1024;

export function bodyTooLarge(req) {
  const len = Number(req.headers["content-length"] || 0);
  return len > MAX_BODY_BYTES;
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || null;
}

// Wraps a route handler so an unexpected exception (a PDO-equivalent driver
// error, a bad query, anything) becomes a generic 500 instead of leaking a
// stack trace or a database error string to the client. Real detail goes to
// the function log via console.error.
export function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) sendError(res, 500, "server_error", "Something went wrong");
    }
  };
}
