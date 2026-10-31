/* ---------- Supabase Auth errors -> this API's error codes ----------
 * The client shows `message` as is, so each one is written for a person.
 * Anything unrecognised gets a generic reply (and the detail goes to the
 * function log), never Supabase's own wording.
 */
import { sendError } from "./http.js";

const BY_CODE = {
  invalid_credentials: [401, "invalid_credentials", "Invalid email or password"],
  email_not_confirmed: [403, "email_not_confirmed", "Confirm your email first: check your inbox for the link"],
  user_already_exists: [409, "email_taken", "That email is already registered"],
  email_exists: [409, "email_taken", "That email is already registered"],
  weak_password: [422, "invalid_password", "Choose a stronger password"],
  email_address_invalid: [422, "invalid_email", "Enter a valid email address"],
  signup_disabled: [403, "signup_disabled", "New accounts can't be created right now"],
  over_request_rate_limit: [429, "too_many_attempts", "Too many attempts. Try again later."],
  over_email_send_rate_limit: [429, "too_many_attempts", "Too many attempts. Try again later."],
};

export function authErrorResponse(res, error) {
  const known = BY_CODE[error?.code] || (error?.status === 429 ? BY_CODE.over_request_rate_limit : null);
  if (known) return sendError(res, ...known);
  console.error(error);
  if (error?.status && error.status < 500) return sendError(res, 400, "auth_failed", "That didn't work. Check your details and try again.");
  return sendError(res, 502, "auth_unavailable", "Sign-in is unavailable right now. Try again shortly.");
}
