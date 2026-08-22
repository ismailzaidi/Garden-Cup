/* ---------- opaque 26-character server-side IDs ----------
 * A ULID-shaped id (10-char millisecond timestamp + 16 chars of randomness,
 * Crockford base32) sized to fit the CHAR(26) primary keys in
 * migrations/001_init.sql. Not a strict, spec-exact ULID implementation
 * (no monotonic-within-the-same-ms guarantee), just an opaque sortable-ish
 * identifier — nothing in this app relies on ULID's stricter properties.
 */
import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(time) {
  let out = "";
  let t = time;
  for (let i = 0; i < 10; i++) {
    out = ALPHABET[t % 32] + out;
    t = Math.floor(t / 32);
  }
  return out;
}

function encodeRandom() {
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += ALPHABET[bytes[i] % 32];
  return out;
}

export function ulid() {
  return encodeTime(Date.now()) + encodeRandom();
}
