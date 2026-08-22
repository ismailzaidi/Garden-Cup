/* ---------- password hashing + session cookies ----------
 * Standard primitives, composed the standard way — no custom crypto:
 *   - passwords: scrypt (Node's built-in crypto.scrypt), random salt per
 *     password, timing-safe comparison on verify.
 *   - sessions: 32 random bytes as the bearer value; only its SHA-256 hash
 *     is ever stored, so a leaked database dump doesn't hand out live
 *     sessions. The raw value lives only in an httpOnly, Secure, SameSite=Lax
 *     cookie — never in localStorage, never readable by JS.
 */
import { randomBytes, createHash, timingSafeEqual, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import * as cookie from "cookie";
import { withConnection } from "./db.js";
import { sendError } from "./http.js";

const scrypt = promisify(scryptCb);
// N=2^17 is OWASP's current floor for scrypt (2^14, the Node default, is
// roughly 8x too cheap for what a stolen password_hash column deserves).
// scrypt's memory use is ~128*N*r bytes, so N=2^17 needs a raised maxmem too
// — without it, scrypt throws "Invalid scrypt params: memory limit exceeded".
const SCRYPT_N = 131072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 192 * 1024 * 1024;
const KEYLEN = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scrypt(password, salt, expected.length, {
    N: Number(nStr), r: Number(rStr), p: Number(pStr), maxmem: SCRYPT_MAXMEM,
  });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// Constant-time string comparison for secrets that aren't password hashes
// (e.g. an invite code) — timingSafeEqual requires equal-length buffers, so
// pad both sides to a fixed size first rather than leaking length up front.
export function safeEqual(a, b) {
  const pad = (s) => Buffer.concat([Buffer.from(String(s ?? ""), "utf8"), Buffer.alloc(256)]).subarray(0, 256);
  return timingSafeEqual(pad(a), pad(b));
}

// A hash minted with today's target params never needs to change; anything
// else (an older cost factor from a prior version of this file) gets
// silently upgraded on next successful login.
export function needsRehash(stored) {
  const parts = String(stored || "").split("$");
  return !(parts[0] === "scrypt" && Number(parts[1]) === SCRYPT_N && Number(parts[2]) === SCRYPT_R && Number(parts[3]) === SCRYPT_P);
}

// Used as the "wrong password" comparison target when the email doesn't
// exist, so an unknown-email login takes the same code path (and roughly
// the same time) as a wrong-password one — the API must not reveal which.
export const DUMMY_HASH = `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${"00".repeat(16)}$${"00".repeat(KEYLEN)}`;

const COOKIE_NAME = "gc_session";

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}
export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

// Secure by default; the only exception is `vercel dev`/plain `node` on
// localhost over http, where a Secure cookie would silently never be sent
// or accepted. Keyed off the Host header (not a forwarded-proto header,
// which a client could in principle set) — and only ever *adds* the Secure
// flag's absence for a request that is unambiguously to localhost, never
// removes it for anything else.
function wantsSecureCookie(req) {
  const host = String(req.headers.host || "");
  const isLocalhost = host === "localhost" || host === "127.0.0.1"
    || host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
  return !isLocalhost;
}

function appendSetCookie(res, serialized) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) res.setHeader("Set-Cookie", serialized);
  else res.setHeader("Set-Cookie", Array.isArray(existing) ? [...existing, serialized] : [existing, serialized]);
}

export function setSessionCookie(res, req, token) {
  const days = Number(process.env.TOKEN_TTL_DAYS || 90);
  appendSetCookie(res, cookie.serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: wantsSecureCookie(req),
    sameSite: "lax",
    path: "/",
    maxAge: days * 24 * 60 * 60,
  }));
}

export function clearSessionCookie(res, req) {
  appendSetCookie(res, cookie.serialize(COOKIE_NAME, "", {
    httpOnly: true,
    secure: wantsSecureCookie(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  }));
}

export function getSessionToken(req) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const parsed = cookie.parse(raw);
  return parsed[COOKIE_NAME] || null;
}

// Returns {id, email, displayName} on success. On failure it has already
// written the 401 response, so the caller just needs to check for null and
// return without writing anything else.
export async function requireAuth(req, res) {
  const token = getSessionToken(req);
  if (!token) {
    sendError(res, 401, "unauthorized", "Sign in required");
    return null;
  }
  const tokenHash = hashToken(token);
  const row = await withConnection(async (conn) => {
    const rows = await conn.query(
      `SELECT u.id, u.email, u.display_name, t.expires_at
       FROM auth_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? LIMIT 1`,
      [tokenHash]
    );
    return rows[0];
  });
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    sendError(res, 401, "unauthorized", "Session expired");
    return null;
  }
  withConnection((conn) => conn.query("UPDATE auth_tokens SET last_used_at = UTC_TIMESTAMP() WHERE token_hash = ?", [tokenHash]))
    .catch(() => {});
  if (Math.random() < 0.02) {
    withConnection((conn) => conn.query("DELETE FROM auth_tokens WHERE expires_at < UTC_TIMESTAMP()")).catch(() => {});
  }
  return { id: row.id, email: row.email, displayName: row.display_name };
}

// 8 *failed* attempts per email per 15 minutes. Counting successes too would
// lock someone out for signing in from a phone, a tablet, and a laptop in
// the same sitting — the limiter exists to slow down guessing, not to cap
// how often the right password can be used.
export async function checkEmailRateLimit(conn, email) {
  const rows = await conn.query(
    "SELECT COUNT(*) AS n FROM login_attempts WHERE email = ? AND succeeded = 0 AND attempted_at > (UTC_TIMESTAMP() - INTERVAL 15 MINUTE)",
    [email]
  );
  return Number(rows[0].n) < 8;
}

// A per-email limit alone does nothing against spraying one guessed password
// across many different email addresses — this catches that by capping
// attempts (successful or not; a burst of 30 logins from one IP is unusual
// regardless of outcome) from a single source address in the same window.
// Threshold is looser than the per-email one on purpose: one IP can
// legitimately be several real people (a household, a shared network).
export async function checkIpRateLimit(conn, ip) {
  if (!ip) return true;
  const rows = await conn.query(
    "SELECT COUNT(*) AS n FROM login_attempts WHERE ip = INET6_ATON(?) AND attempted_at > (UTC_TIMESTAMP() - INTERVAL 15 MINUTE)",
    [ip]
  );
  return Number(rows[0].n) < 30;
}

export async function recordLoginAttempt(conn, email, ip, succeeded) {
  await conn.query(
    "INSERT INTO login_attempts (email, ip, succeeded, attempted_at) VALUES (?, INET6_ATON(?), ?, UTC_TIMESTAMP())",
    [email, ip || null, succeeded ? 1 : 0]
  );
  // Opportunistic cleanup, mirroring requireAuth's expired-token sweep —
  // this table has no other pruning and would otherwise grow forever. Uses
  // its own connection (like requireAuth's sweep does) rather than `conn`,
  // which the caller's withConnection() may release before a fire-and-forget
  // query on it would finish — two overlapping queries on one connection is
  // not safe.
  if (Math.random() < 0.02) {
    withConnection((c) => c.query("DELETE FROM login_attempts WHERE attempted_at < (UTC_TIMESTAMP() - INTERVAL 1 DAY)")).catch(() => {});
  }
}
