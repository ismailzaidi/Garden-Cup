import { useEffect, useState } from "react";
import { LogIn, UserPlus, MailCheck } from "lucide-react";
import { C } from "../lib/theme.js";
import { useAuth } from "./AuthContext.jsx";

const inputStyle = {
  backgroundColor: "#fff",
  border: `2px solid ${C.line}`,
  color: C.ink,
};

// The confirmation link (api/auth/confirm.js) comes back to the app with
// ?confirm_error=1 when it was bad or expired. Read here (no side effects,
// so StrictMode's double call is harmless); tidied out of the address bar
// by the effect below so a reload doesn't show it again.
function readLinkError() {
  if (typeof window === "undefined") return "";
  if (!new URLSearchParams(window.location.search).has("confirm_error")) return "";
  return "That confirmation link didn't work or has expired. Sign in to get a new one, or create the account again.";
}

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [linkError] = useState(readLinkError);
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(linkError);
  const [sentTo, setSentTo] = useState(""); // set once sign-up is waiting on the email link
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (linkError) window.history.replaceState(null, "", window.location.pathname);
  }, [linkError]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login({ email: email.trim().toLowerCase(), password });
      } else {
        const result = await register({
          email: email.trim().toLowerCase(),
          password,
          displayName: displayName.trim(),
        });
        if (result?.confirmationRequired) setSentTo(email.trim().toLowerCase());
      }
    } catch (err) {
      setError(err?.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-5" style={{ backgroundColor: C.chalk, fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.6rem", color: C.pitch, letterSpacing: "0.03em", lineHeight: 1 }}>GARDEN CUP</h1>
          <p className="mt-1.5 text-xs font-semibold" style={{ color: C.sub }}>
            {mode === "login" ? "Sign in to sync your tournaments" : "Create an account to sync across devices"}
          </p>
        </div>

        {sentTo ? (
          <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
            <MailCheck size={28} className="mx-auto" style={{ color: C.pitch }} />
            <p className="mt-2 text-sm font-bold" style={{ color: C.ink }}>Check your email</p>
            <p className="mt-1 text-xs" style={{ color: C.sub }}>
              We sent a link to <strong>{sentTo}</strong>. Open it on this device to finish creating your account.
            </p>
            <button
              type="button"
              onClick={() => { setSentTo(""); setMode("login"); setPassword(""); }}
              className="mt-4 text-xs font-semibold" style={{ color: C.pitch }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-3 rounded-2xl p-5" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
          {mode === "register" && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.sub }}>Display name</label>
              <input
                type="text" required maxLength={60} value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.sub }}>Email</label>
            <input
              type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.sub }}>Password</label>
            <input
              type="password" required minLength={10}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={inputStyle}
            />
          </div>

          {error && (
            <p className="text-xs font-semibold px-3 py-2 rounded-xl" style={{ backgroundColor: "#FBE3DE", color: C.loss }}>{error}</p>
          )}

          <button
            type="submit" disabled={busy}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-bold px-4 py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-60"
            style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}
          >
            {mode === "login" ? <LogIn size={15} /> : <UserPlus size={15} />}
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        )}

        {!sentTo && (
        <button
          type="button"
          onClick={() => { setMode((m) => (m === "login" ? "register" : "login")); setError(""); }}
          className="mt-4 w-full text-center text-xs font-semibold"
          style={{ color: C.pitch }}
        >
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        )}
      </div>
    </div>
  );
}
