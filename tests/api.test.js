import { describe, it, expect, beforeEach, vi } from "vitest";

/* The api/ routes against a fake Supabase client: what each one sends to
   Supabase, and how it turns the answer into this API's responses. The
   database side (policies, the save function) is tested for real by
   scripts/test-db.sh. */

let fake;
let admin;
const passwordCheck = vi.fn(async () => ({ ok: true }));
vi.mock("../api/_lib/supabase.js", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    createRequestClient: () => fake,
    createAdminClient: () => admin,
    passwordMatches: (...args) => passwordCheck(...args),
  };
});

const { default: current } = await import("../api/tournaments/current.js");
const { default: history } = await import("../api/history/index.js");
const { default: register } = await import("../api/auth/register.js");
const { default: login } = await import("../api/auth/login.js");
const { default: confirm } = await import("../api/auth/confirm.js");
const { default: forgot } = await import("../api/auth/forgot.js");
const { default: logout } = await import("../api/auth/logout.js");
const { default: account } = await import("../api/account.js");
const { cookieMethods } = await import("../api/_lib/supabase.js");
const rateLimitModule = await import("../api/_lib/rateLimit.js");

const USER = { id: "u-1", email: "sam@example.com", user_metadata: { display_name: "Sam" } };

function mockRes() {
  const headers = {};
  const res = {
    statusCode: 200, body: undefined, headersSent: false,
    getHeader: (k) => headers[k.toLowerCase()],
    setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; this.headersSent = true; return this; },
    end() { this.headersSent = true; return this; },
    headers,
  };
  return res;
}
const mockReq = (method, body, extra = {}) => ({ method, body, headers: { host: "gardencup.app", ...extra.headers }, query: extra.query || {} });

/* A chainable stand-in for db.from(...): records every call, resolves to `result`. */
function query(result) {
  const calls = [];
  const q = new Proxy({}, {
    get(_, prop) {
      if (prop === "then") return (ok, bad) => Promise.resolve(result).then(ok, bad);
      if (prop === "calls") return calls;
      return (...args) => { calls.push([prop, ...args]); return q; };
    },
  });
  return q;
}

// what rate_limit_hit answers; tests flip `allowed` to see a 429
let limiter;

function makeFake({ user = USER, from = {}, rpc } = {}) {
  const tables = {};
  return {
    tables,
    auth: {
      getUser: vi.fn(async () => (user ? { data: { user }, error: null } : { data: { user: null }, error: { status: 401 } })),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((name) => { tables[name] = query(from[name] ?? { data: null, error: null }); return tables[name]; }),
    rpc: vi.fn(async (name, args) => {
      if (name === "rate_limit_hit") return limiter(args);
      return (rpc ?? (async () => ({ data: { conflict: false, version: 1 }, error: null })))(name, args);
    }),
  };
}

const state = () => ({
  mode: "league", tournamentId: "t1", schemaVersion: 2, historySaved: false,
  players: [{ id: "p1", name: "Sam" }, { id: "p2", name: "Ali" }],
  matches: [{ id: "m1", stage: "group", leg: 1, p1: "p1", p2: "p2", s1: "2", s2: "1", played: true }],
  goals: [{ id: "g1", matchId: "m1", playerId: "p1", second: 30, duration: 120, stage: "group" }],
  config: { legCount: 1 }, modeState: {}, stakes: { prize: "", chore: "" },
});

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  limiter = vi.fn(async () => ({ data: { allowed: true, retry_after: 1 }, error: null }));
  fake = makeFake();
  admin = { auth: { admin: { deleteUser: vi.fn(async () => ({ error: null })) } } };
  passwordCheck.mockReset();
  passwordCheck.mockResolvedValue({ ok: true });
});

describe("session cookies", () => {
  it("are always httpOnly, SameSite=Lax and Secure off localhost", () => {
    const res = mockRes();
    cookieMethods(mockReq("GET"), res).setAll([{ name: "sb-x-auth-token", value: "abc", options: { httpOnly: false, maxAge: 60 } }], { "Cache-Control": "no-store" });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Secure/i);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("drop Secure only for localhost over http", () => {
    const res = mockRes();
    cookieMethods(mockReq("GET", undefined, { headers: { host: "localhost:3000" } }), res).setAll([{ name: "a", value: "b", options: {} }]);
    expect(String(res.headers["set-cookie"])).not.toMatch(/Secure/i);
  });

  it("are read from the request's Cookie header", () => {
    const got = cookieMethods(mockReq("GET", undefined, { headers: { cookie: "a=1; sb-x=two" } }), mockRes()).getAll();
    expect(got).toEqual([{ name: "a", value: "1" }, { name: "sb-x", value: "two" }]);
  });
});

describe("signed-in routes", () => {
  it("reply 401 without a valid session and never touch the database", async () => {
    fake = makeFake({ user: null });
    const res = mockRes();
    await current(mockReq("GET"), res);
    expect(res.statusCode).toBe(401);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it("reply 503 when Supabase isn't configured", async () => {
    delete process.env.SUPABASE_URL;
    const res = mockRes();
    await current(mockReq("GET"), res);
    expect(res.statusCode).toBe(503);
  });
});

describe("/api/tournaments/current", () => {
  it("GET returns the active tournament, or version 0 when there is none", async () => {
    fake = makeFake({ from: { tournaments: { data: { version: 3, state: { mode: "league" } }, error: null } } });
    let res = mockRes();
    await current(mockReq("GET"), res);
    expect(res.body).toEqual({ version: 3, state: { mode: "league" } });
    expect(fake.tables.tournaments.calls).toContainEqual(["eq", "status", "active"]);

    fake = makeFake();
    res = mockRes();
    await current(mockReq("GET"), res);
    expect(res.body).toEqual({ version: 0, state: null });
  });

  it("PUT saves the validated state through save_current_tournament", async () => {
    const res = mockRes();
    await current(mockReq("PUT", { expectedVersion: 2, state: state() }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ version: 1 });
    const [fn, args] = fake.rpc.mock.calls.find(([name]) => name !== "rate_limit_hit");
    expect(fn).toBe("save_current_tournament");
    expect(args).toMatchObject({ p_client_id: "t1", p_mode: "league", p_history_saved: false, p_expected_version: 2 });
    expect(args.p_state.matches[0]).toMatchObject({ s1: "2", s2: "1" }); // strings, as the client keeps them
  });

  it("PUT turns a version conflict into 409 with the newer copy", async () => {
    fake = makeFake({ rpc: async () => ({ data: { conflict: true, version: 5, state: { mode: "king" } }, error: null }) });
    const res = mockRes();
    await current(mockReq("PUT", { expectedVersion: 2, state: state() }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: "conflict", version: 5, state: { mode: "king" } });
  });

  it("PUT rejects a bad state with 422 before reaching the database", async () => {
    const bad = state();
    bad.matches[0].p1 = "nobody";
    const res = mockRes();
    await current(mockReq("PUT", { expectedVersion: 0, state: bad }), res);
    expect(res.statusCode).toBe(422);
    expect(fake.rpc.mock.calls.map(([name]) => name)).not.toContain("save_current_tournament");

    const res2 = mockRes();
    await current(mockReq("PUT", { state: state() }), res2);
    expect(res2.statusCode).toBe(422);
  });

  it("a database error is a generic 500, never the error text", async () => {
    fake = makeFake({ rpc: async () => ({ data: null, error: { message: "relation secret does not exist" } }) });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = mockRes();
    await current(mockReq("PUT", { expectedVersion: 0, state: state() }), res);
    spy.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/secret/);
  });
});

describe("/api/history", () => {
  it("GET returns the stored records, newest first", async () => {
    fake = makeFake({ from: { tournament_history: { data: [{ record: { id: "b" } }, { record: { id: "a" } }], error: null } } });
    const res = mockRes();
    await history(mockReq("GET"), res);
    expect(res.body).toEqual({ history: [{ id: "b" }, { id: "a" }] });
    expect(fake.tables.tournament_history.calls).toContainEqual(["order", "played_at", { ascending: false }]);
  });

  it("POST stores a clean copy once, ignoring a duplicate", async () => {
    const res = mockRes();
    const record = { id: "h1", date: "2026-01-02T03:04:05.000Z", mode: "league", players: ["Sam"], champion: "Sam", totalGoals: 3, extra: "dropped" };
    await history(mockReq("POST", { record }), res);
    expect(res.statusCode).toBe(201);
    const [method, row, opts] = fake.tables.tournament_history.calls[0];
    expect(method).toBe("upsert");
    expect(opts).toEqual({ onConflict: "user_id,client_id", ignoreDuplicates: true });
    expect(row).toMatchObject({ user_id: "u-1", client_id: "h1", mode: "league", played_at: "2026-01-02T03:04:05.000Z" });
    expect(row.record.extra).toBeUndefined();
  });
});

describe("/api/auth", () => {
  it("register asks the user to confirm their email when there is no session yet", async () => {
    fake.auth.signUp.mockResolvedValue({ data: { user: USER, session: null }, error: null });
    const res = mockRes();
    await register(mockReq("POST", { email: " Sam@Example.com ", password: "long-enough-pw", displayName: "Sam" }), res);
    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({ confirmationRequired: true });
    expect(fake.auth.signUp).toHaveBeenCalledWith({
      email: "sam@example.com", password: "long-enough-pw", options: { data: { display_name: "Sam" } },
    });
  });

  it("register signs straight in when confirmation is off", async () => {
    fake.auth.signUp.mockResolvedValue({ data: { user: USER, session: {} }, error: null });
    const res = mockRes();
    await register(mockReq("POST", { email: "sam@example.com", password: "long-enough-pw", displayName: "Sam" }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ user: { id: "u-1", email: "sam@example.com", displayName: "Sam" } });
  });

  it("register validates before calling Supabase", async () => {
    const res = mockRes();
    await register(mockReq("POST", { email: "sam@example.com", password: "short", displayName: "Sam" }), res);
    expect(res.statusCode).toBe(422);
    expect(fake.auth.signUp).not.toHaveBeenCalled();
  });

  it("login maps Supabase's errors to readable ones", async () => {
    const cases = [
      [{ code: "invalid_credentials", status: 400 }, 401, "invalid_credentials"],
      [{ code: "email_not_confirmed", status: 400 }, 403, "email_not_confirmed"],
      [{ code: "over_request_rate_limit", status: 429 }, 429, "too_many_attempts"],
      [{ code: "something_new", status: 400, message: "internal detail" }, 400, "auth_failed"],
      [{ status: 500, message: "internal detail" }, 502, "auth_unavailable"],
    ];
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [error, status, code] of cases) {
      fake.auth.signInWithPassword.mockResolvedValue({ data: {}, error });
      const res = mockRes();
      await login(mockReq("POST", { email: "sam@example.com", password: "x" }), res);
      expect([res.statusCode, res.body.error]).toEqual([status, code]);
      expect(res.body.message).not.toMatch(/internal detail/);
    }
    spy.mockRestore();
  });

  it("login returns the user", async () => {
    fake.auth.signInWithPassword.mockResolvedValue({ data: { user: USER, session: {} }, error: null });
    const res = mockRes();
    await login(mockReq("POST", { email: "Sam@example.com", password: "pw" }), res);
    expect(res.body).toEqual({ user: { id: "u-1", email: "sam@example.com", displayName: "Sam" } });
    expect(fake.auth.signInWithPassword).toHaveBeenCalledWith({ email: "sam@example.com", password: "pw" });
  });

  it("confirm verifies the email link and sends the user back to the app", async () => {
    fake.auth.verifyOtp.mockResolvedValue({ error: null });
    let res = mockRes();
    await confirm(mockReq("GET", undefined, { query: { token_hash: "abc", type: "email" } }), res);
    expect(res.statusCode).toBe(303);
    expect(res.headers.location).toBe("/?confirmed=1");
    expect(fake.auth.verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc" });

    res = mockRes();
    await confirm(mockReq("GET", undefined, { query: { token_hash: "abc", type: "recovery" } }), res);
    expect(res.headers.location).toBe("/?reset=1");

    res = mockRes();
    await confirm(mockReq("GET", undefined, { query: { token_hash: "abc", type: "invite" } }), res);
    expect(res.headers.location).toBe("/?confirm_error=1");

    fake.auth.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    res = mockRes();
    await confirm(mockReq("GET", undefined, { query: { token_hash: "abc", type: "recovery" } }), res);
    spy.mockRestore();
    expect(res.headers.location).toBe("/?confirm_error=1");
  });

  it("forgot password replies the same whether or not the account exists", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const error of [null, { status: 400, code: "user_not_found" }]) {
      fake.auth.resetPasswordForEmail.mockResolvedValue({ error });
      const res = mockRes();
      await forgot(mockReq("POST", { email: " Sam@Example.com " }), res);
      expect([res.statusCode, res.body]).toEqual([200, { sent: true }]);
    }
    spy.mockRestore();
    expect(fake.auth.resetPasswordForEmail).toHaveBeenCalledWith("sam@example.com");

    fake.auth.resetPasswordForEmail.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit" } });
    const res = mockRes();
    await forgot(mockReq("POST", { email: "sam@example.com" }), res);
    expect(res.statusCode).toBe(429);
  });

  it("logout ends this device's session, or every session when asked", async () => {
    await logout(mockReq("POST", {}), mockRes());
    expect(fake.auth.signOut).toHaveBeenLastCalledWith({ scope: "local" });
    await logout(mockReq("POST", { everywhere: true }), mockRes());
    expect(fake.auth.signOut).toHaveBeenLastCalledWith({ scope: "global" });
  });
});

describe("/api/account", () => {
  it("PATCH changes the display name", async () => {
    fake.auth.updateUser.mockResolvedValue({ data: { user: { ...USER, user_metadata: { display_name: "Sammy" } } }, error: null });
    const res = mockRes();
    await account(mockReq("PATCH", { displayName: "  Sammy " }), res);
    expect(fake.auth.updateUser).toHaveBeenCalledWith({ data: { display_name: "Sammy" } });
    expect(res.body.user.displayName).toBe("Sammy");

    const res2 = mockRes();
    await account(mockReq("PATCH", { displayName: "  " }), res2);
    expect(res2.statusCode).toBe(422);
  });

  it("POST changes the password only with the right current password", async () => {
    fake.auth.updateUser.mockResolvedValue({ data: {}, error: null });
    let res = mockRes();
    await account(mockReq("POST", { currentPassword: "old-password", newPassword: "new-password-1" }), res);
    expect(res.statusCode).toBe(204);
    expect(passwordCheck).toHaveBeenCalledWith("sam@example.com", "old-password");
    expect(fake.auth.updateUser).toHaveBeenCalledWith({ password: "new-password-1" });

    fake.auth.updateUser.mockClear();
    passwordCheck.mockResolvedValue({ ok: false, error: { code: "invalid_credentials", status: 400 } });
    res = mockRes();
    await account(mockReq("POST", { currentPassword: "wrong", newPassword: "new-password-1" }), res);
    expect([res.statusCode, res.body.error]).toEqual([403, "wrong_password"]);
    expect(fake.auth.updateUser).not.toHaveBeenCalled();

    res = mockRes();
    await account(mockReq("POST", { currentPassword: "x", newPassword: "short" }), res);
    expect(res.statusCode).toBe(422);
  });

  it("POST without the current password works only within an hour of a reset email", async () => {
    fake.auth.updateUser.mockResolvedValue({ data: {}, error: null });
    let res = mockRes();
    await account(mockReq("POST", { newPassword: "new-password-1" }), res);
    expect([res.statusCode, res.body.error]).toEqual([403, "current_password_required"]);

    fake = makeFake({ user: { ...USER, recovery_sent_at: new Date(Date.now() - 2 * 3600e3).toISOString() } });
    res = mockRes();
    await account(mockReq("POST", { newPassword: "new-password-1" }), res);
    expect(res.statusCode).toBe(403);

    fake = makeFake({ user: { ...USER, recovery_sent_at: new Date(Date.now() - 5 * 60e3).toISOString() } });
    fake.auth.updateUser.mockResolvedValue({ data: {}, error: null });
    res = mockRes();
    await account(mockReq("POST", { newPassword: "new-password-1" }), res);
    expect(res.statusCode).toBe(204);
    expect(passwordCheck).not.toHaveBeenCalled();
  });

  it("DELETE removes the account after checking the password, then signs out", async () => {
    let res = mockRes();
    await account(mockReq("DELETE", { password: "pw" }), res);
    expect(res.statusCode).toBe(204);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("u-1");
    expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: "local" });

    admin.auth.admin.deleteUser.mockClear();
    passwordCheck.mockResolvedValue({ ok: false, error: { code: "invalid_credentials", status: 400 } });
    res = mockRes();
    await account(mockReq("DELETE", { password: "wrong" }), res);
    expect(res.statusCode).toBe(403);
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();

    res = mockRes();
    await account(mockReq("DELETE", {}), res);
    expect(res.statusCode).toBe(422);
  });

  it("DELETE says so when the service key isn't set", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = mockRes();
    await account(mockReq("DELETE", { password: "pw" }), res);
    expect([res.statusCode, res.body.error]).toEqual([503, "not_configured"]);
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
});

describe("rate limits", () => {
  const { bucketOf, clientIp } = rateLimitModule;

  it("refuse with 429 and Retry-After, before Supabase Auth is asked", async () => {
    limiter.mockResolvedValue({ data: { allowed: false, retry_after: 42 }, error: null });
    const res = mockRes();
    await login(mockReq("POST", { email: "sam@example.com", password: "pw" }), res);
    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBe("42");
    expect(fake.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("key sign-in on the real client IP and the email, hashed", async () => {
    fake.auth.signInWithPassword.mockResolvedValue({ data: { user: USER }, error: null });
    await login(mockReq("POST", { email: "Sam@Example.com", password: "pw" }, { headers: { "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "6.6.6.6" } }), mockRes());
    const buckets = limiter.mock.calls.map(([args]) => args.p_bucket);
    expect(buckets).toEqual([bucketOf("loginIp", "203.0.113.9"), bucketOf("loginEmail", "sam@example.com")]);
    expect(buckets.every((b) => /^[0-9a-f]{64}$/.test(b))).toBe(true);
    expect(JSON.stringify(limiter.mock.calls)).not.toMatch(/sam@example|203\.0/);
  });

  it("let requests through if the limiter itself fails", async () => {
    limiter.mockResolvedValue({ data: null, error: { message: "down" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = mockRes();
    await current(mockReq("GET"), res);
    spy.mockRestore();
    expect(res.statusCode).toBe(200);
  });

  it("limit each signed-in user's syncing, and password checks separately", async () => {
    await current(mockReq("GET"), mockRes());
    expect(limiter.mock.calls[0][0]).toMatchObject({ p_bucket: bucketOf("dataUser", "u-1"), p_limit: 600, p_window_seconds: 300 });

    limiter.mockClear();
    await account(mockReq("DELETE", { password: "pw" }), mockRes());
    expect(limiter.mock.calls[0][0].p_bucket).toBe(bucketOf("passwordCheckUser", "u-1"));
  });

  it("send a bad-link redirect, not a JSON error, from the email link", async () => {
    limiter.mockResolvedValue({ data: { allowed: false, retry_after: 5 }, error: null });
    const res = mockRes();
    await confirm(mockReq("GET", undefined, { query: { token_hash: "abc", type: "email" } }), res);
    expect([res.statusCode, res.headers.location]).toEqual([303, "/?confirm_error=1"]);
    expect(fake.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("read the client IP from Vercel's own headers first", () => {
    expect(clientIp({ headers: { "x-vercel-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" } })).toBe("1.1.1.1");
    expect(clientIp({ headers: { "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3, 4.4.4.4" } })).toBe("2.2.2.2");
    expect(clientIp({ headers: { "x-forwarded-for": "3.3.3.3, 4.4.4.4" } })).toBe("3.3.3.3");
  });
});
