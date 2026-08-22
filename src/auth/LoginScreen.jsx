import { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { C } from "../lib/theme.js";
import { useAuth } from "./AuthContext.jsx";

const inputStyle = {
  backgroundColor: "#fff",
  border: `2px solid ${C.line}`,
  color: C.ink,
};

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  // The server doesn't tell us up front whether an invite code is required
  // (there's no live endpoint to probe it), so this field is always shown on
  // register and labelled as optional — a server that requires one will
  // simply reject a blank/wrong value with a normal error message below.
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login({ email: email.trim().toLowerCase(), password });
      } else {
        await register({
          email: email.trim().toLowerCase(),
          password,
          displayName: displayName.trim(),
          inviteCode: inviteCode.trim() || undefined,
        });
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

          {mode === "register" && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.sub }}>Invite code (if required)</label>
              <input
                type="text" value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={inputStyle}
              />
            </div>
          )}

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

        <button
          type="button"
          onClick={() => { setMode((m) => (m === "login" ? "register" : "login")); setError(""); }}
          className="mt-4 w-full text-center text-xs font-semibold"
          style={{ color: C.pitch }}
        >
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
