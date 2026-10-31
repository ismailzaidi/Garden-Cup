import { useState } from "react";
import { LogIn, UserPlus, MailCheck, ArrowLeft, Mail } from "lucide-react";
import { C } from "../lib/theme.js";
import { useAuth } from "./AuthContext.jsx";

const inputStyle = {
  backgroundColor: "#fff",
  border: `2px solid ${C.line}`,
  color: C.ink,
};
const inputClass = "mt-1 w-full px-3 py-2.5 rounded-xl text-sm outline-none";
const labelClass = "text-[10px] font-bold uppercase tracking-wide";

const LINK_ERROR = "That link didn't work or has expired. Sign in, or ask for a new one below.";

const SUBTITLE = {
  login: "Sign in to sync your tournaments",
  register: "Create an account to sync across devices",
  forgot: "We'll email you a link to set a new password",
};

/* Sign in, create an account, or ask for a password reset email. Reached
   from Home or the account tab; playing never needs it. `linkError` is set
   when an email link (api/auth/confirm.js) came back bad or expired. */
export default function LoginScreen({ onBack, linkError = false }) {
  const { login, register, forgotPassword } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(linkError ? LINK_ERROR : "");
  // set once an email has gone out: { to, kind: "confirm" | "reset" }
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);

  const switchTo = (next) => { setMode(next); setError(""); };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (mode === "login") {
        await login({ email: cleanEmail, password });
      } else if (mode === "register") {
        const result = await register({ email: cleanEmail, password, displayName: displayName.trim() });
        if (result?.confirmationRequired) setSent({ to: cleanEmail, kind: "confirm" });
      } else {
        await forgotPassword(cleanEmail);
        setSent({ to: cleanEmail, kind: "reset" });
      }
    } catch (err) {
      setError(err?.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-5 py-10" style={{ backgroundColor: C.chalk, fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-sm">
        {onBack && (
          <button type="button" onClick={onBack} className="mb-4 flex items-center gap-1 text-xs font-semibold" style={{ color: C.pitch }}>
            <ArrowLeft size={14} /> Back to the app
          </button>
        )}
        <div className="text-center mb-6">
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.6rem", color: C.pitch, letterSpacing: "0.03em", lineHeight: 1 }}>GARDEN CUP</h1>
          <p className="mt-1.5 text-xs font-semibold" style={{ color: C.sub }}>{SUBTITLE[mode]}</p>
        </div>

        {sent ? (
          <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
            <MailCheck size={28} className="mx-auto" style={{ color: C.pitch }} />
            <p className="mt-2 text-sm font-bold" style={{ color: C.ink }}>Check your email</p>
            <p className="mt-1 text-xs" style={{ color: C.sub }}>
              {sent.kind === "confirm"
                ? <>We sent a link to <strong>{sent.to}</strong>. Open it on this device to finish creating your account.</>
                : <>If <strong>{sent.to}</strong> has an account, a link to set a new password is on its way. It works for an hour.</>}
            </p>
            <button
              type="button"
              onClick={() => { setSent(null); switchTo("login"); setPassword(""); }}
              className="mt-4 text-xs font-semibold" style={{ color: C.pitch }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 rounded-2xl p-5" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
            {mode === "register" && (
              <div>
                <label className={labelClass} style={{ color: C.sub }}>Display name</label>
                <input type="text" required maxLength={60} value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            )}

            <div>
              <label className={labelClass} style={{ color: C.sub }}>Email</label>
              <input type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} className={inputClass} style={inputStyle} />
            </div>

            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between">
                  <label className={labelClass} style={{ color: C.sub }}>Password</label>
                  {mode === "login" && (
                    <button type="button" onClick={() => switchTo("forgot")} className="text-[11px] font-semibold" style={{ color: C.pitch }}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <input type="password" required minLength={mode === "register" ? 10 : undefined}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            )}

            {error && (
              <p className="text-xs font-semibold px-3 py-2 rounded-xl" style={{ backgroundColor: "#FBE3DE", color: C.loss }}>{error}</p>
            )}

            <button type="submit" disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 text-sm font-bold px-4 py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-60"
              style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
              {mode === "login" ? <LogIn size={15} /> : mode === "register" ? <UserPlus size={15} /> : <Mail size={15} />}
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Email me a link"}
            </button>
          </form>
        )}

        {!sent && (
          <button type="button"
            onClick={() => switchTo(mode === "login" ? "register" : "login")}
            className="mt-4 w-full text-center text-xs font-semibold" style={{ color: C.pitch }}>
            {mode === "login" ? "New here? Create an account" : mode === "register" ? "Already have an account? Sign in" : "Back to sign in"}
          </button>
        )}
      </div>
    </div>
  );
}
