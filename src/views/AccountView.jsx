import { useRef, useState } from "react";
import { Download, Upload, LogOut, KeyRound, Trash2, UserRound, LogIn, CheckCircle2 } from "lucide-react";
import { C } from "../lib/theme.js";
import { exportData, importData } from "../lib/exportImport.js";
import { REMOTE_UPDATE_EVENT } from "../lib/syncEngine.js";
import SectionLabel from "../components/SectionLabel.jsx";

const card = { backgroundColor: "#fff", border: `2px solid ${C.line}` };
const inputStyle = { backgroundColor: "#fff", border: `2px solid ${C.line}`, color: C.ink };
const inputClass = "mt-1 w-full px-3 py-2.5 rounded-xl text-sm outline-none";
const labelClass = "text-[10px] font-bold uppercase tracking-wide";
const primaryBtn = "flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-60";
const secondaryBtn = "flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl active:scale-95 transition-transform";

/* Runs an async action with busy/error/done state, so each form below is
   just its fields. */
function useAction() {
  const [state, setState] = useState({ busy: false, error: "", done: "" });
  const run = async (fn, doneMessage) => {
    setState({ busy: true, error: "", done: "" });
    try {
      await fn();
      setState({ busy: false, error: "", done: doneMessage || "" });
      return true;
    } catch (err) {
      setState({ busy: false, error: err?.message || "Something went wrong. Try again.", done: "" });
      return false;
    }
  };
  return [state, run];
}

function Feedback({ state }) {
  if (state.error) return <p className="text-xs font-semibold px-3 py-2 rounded-xl" style={{ backgroundColor: "#FBE3DE", color: C.loss }}>{state.error}</p>;
  if (state.done) return <p role="status" className="text-xs font-semibold px-3 py-2 rounded-xl" style={{ backgroundColor: "#E3F0E1", color: C.pitch }}>{state.done}</p>;
  return null;
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className={labelClass} style={{ color: C.sub }}>{label}</span>
      <input className={inputClass} style={inputStyle} {...props} />
    </label>
  );
}

/* My account: profile, password, this account's data, signing out, and
   deleting the account. Signed out it offers sign-in; in a build with no
   accounts at all it's just the data tools ("My data"). */
export default function AccountView({ auth, resetPassword, onResetDone, banners, onSignIn, onSignedOut }) {
  const { mode, user } = auth;
  const cloud = mode === "cloud";
  const [deleted, setDeleted] = useState(false);

  return (
    <div className="min-h-screen w-full pb-28" style={{ backgroundColor: C.chalk, fontFamily: "'Inter', sans-serif" }}>
      <div className="px-5 pt-8 pb-5"
        style={{ background: `repeating-linear-gradient(90deg, ${C.pitch} 0px, ${C.pitch} 40px, ${C.pitchLight} 40px, ${C.pitchLight} 80px)` }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.6rem", color: "#F7F5EE", letterSpacing: "0.03em", lineHeight: 1 }}>
          {cloud && user ? "MY ACCOUNT" : "MY DATA"}
        </h1>
        {user && <p className="mt-1.5 text-xs font-semibold truncate" style={{ color: "#E4D9A8" }}>{user.email}</p>}
      </div>

      {banners}

      <div className="px-4 py-5 space-y-6">
        {deleted && (
          <div role="status" className="rounded-2xl p-4 flex items-start gap-3" style={card}>
            <CheckCircle2 size={18} color={C.pitch} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm" style={{ color: C.ink }}>
              <strong>Your account has been deleted</strong>, along with everything saved to it. Games kept on this device are still here; clear them from History if you want them gone too.
            </p>
          </div>
        )}

        {cloud && user && resetPassword && <ResetPassword auth={auth} onDone={onResetDone} />}

        {cloud && !user && (
          <div className="rounded-2xl p-4" style={card}>
            <p className="text-sm font-bold" style={{ color: C.ink }}>You're playing on this device</p>
            <p className="text-xs mt-1" style={{ color: C.sub }}>Sign in or create an account to keep your tournaments and history on every device.</p>
            <button onClick={onSignIn} className={`${primaryBtn} mt-3`} style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
              <LogIn size={14} /> Sign in or create an account
            </button>
          </div>
        )}

        {cloud && user && <Profile auth={auth} />}
        {cloud && user && !resetPassword && <ChangePassword auth={auth} />}

        <YourData signedIn={cloud && Boolean(user)} />

        {cloud && user && <SignOut auth={auth} onSignedOut={onSignedOut} />}
        {cloud && user && <DeleteAccount auth={auth} onDeleted={() => setDeleted(true)} />}
      </div>
    </div>
  );
}

function Profile({ auth }) {
  const [name, setName] = useState(auth.user.displayName || "");
  const [state, run] = useAction();
  const changed = name.trim() && name.trim() !== auth.user.displayName;
  return (
    <section>
      <SectionLabel>Profile</SectionLabel>
      <form className="rounded-2xl p-4 space-y-3" style={card}
        onSubmit={(e) => { e.preventDefault(); run(() => auth.updateDisplayName(name.trim()), "Saved."); }}>
        <Field label="Display name" type="text" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Email" type="email" value={auth.user.email} disabled readOnly />
        <Feedback state={state} />
        <button type="submit" disabled={!changed || state.busy} className={primaryBtn} style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
          <UserRound size={14} /> {state.busy ? "Saving…" : "Save"}
        </button>
      </form>
    </section>
  );
}

function ChangePassword({ auth }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, run] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(() => auth.changePassword({ currentPassword: current, newPassword: next }), "Password changed.");
    if (ok) { setCurrent(""); setNext(""); }
  };
  return (
    <section>
      <SectionLabel>Password</SectionLabel>
      <form className="rounded-2xl p-4 space-y-3" style={card} onSubmit={submit}>
        <Field label="Current password" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Field label="New password (10+ characters)" type="password" required minLength={10} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <Feedback state={state} />
        <button type="submit" disabled={state.busy} className={primaryBtn} style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
          <KeyRound size={14} /> {state.busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </section>
  );
}

/* After a "forgot password" link: the email has been proven, so no current
   password is asked for (the server allows this for an hour). */
function ResetPassword({ auth, onDone }) {
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [state, run] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    if (next !== again) return run(async () => { throw new Error("The two passwords don't match."); });
    const ok = await run(() => auth.changePassword({ newPassword: next }), "");
    if (ok) onDone();
  };
  return (
    <section>
      <SectionLabel>Set a new password</SectionLabel>
      <form className="rounded-2xl p-4 space-y-3" style={{ ...card, borderColor: C.gold }} onSubmit={submit}>
        <p className="text-xs" style={{ color: C.sub }}>You're signed in from the reset link. Choose a new password to finish.</p>
        <Field label="New password (10+ characters)" type="password" required minLength={10} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <Field label="New password again" type="password" required minLength={10} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        <Feedback state={state} />
        <button type="submit" disabled={state.busy} className={primaryBtn} style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
          <KeyRound size={14} /> {state.busy ? "Saving…" : "Save new password"}
        </button>
      </form>
    </section>
  );
}

function YourData({ signedIn }) {
  const fileInputRef = useRef(null);
  const [state, setState] = useState({ error: "", done: "" });

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const bundle = await importData(file);
      window.dispatchEvent(new CustomEvent(REMOTE_UPDATE_EVENT, {
        detail: { current: bundle.current, history: bundle.history || [] },
      }));
      setState({ error: "", done: "Imported." });
    } catch (err) {
      setState({ error: err?.message || "Couldn't import that file.", done: "" });
    }
  };

  return (
    <section>
      <SectionLabel>Your data</SectionLabel>
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <p className="text-xs" style={{ color: C.sub }}>
          {signedIn
            ? "Download a copy of everything: the tournament in progress and your whole history, as a file you can keep or import on another device."
            : "Everything is kept on this device. Download a copy to keep it safe or move it to another device."}
        </p>
        <Feedback state={state} />
        <div className="flex flex-wrap gap-2">
          <button onClick={exportData} className={primaryBtn} style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
            <Download size={14} /> Download my data
          </button>
          <button onClick={() => fileInputRef.current?.click()} className={secondaryBtn} style={{ backgroundColor: "#EAE6D9", color: C.ink }}>
            <Upload size={14} /> Import a file
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" aria-label="Import a file" onChange={handleImportFile} />
        </div>
      </div>
    </section>
  );
}

function SignOut({ auth, onSignedOut }) {
  const out = async (everywhere) => {
    await auth.logout({ everywhere });
    onSignedOut();
  };
  return (
    <section>
      <SectionLabel>Sign out</SectionLabel>
      <div className="rounded-2xl p-4 flex flex-wrap gap-2" style={card}>
        <button onClick={() => out(false)} className={secondaryBtn} style={{ backgroundColor: "#EAE6D9", color: C.ink }}>
          <LogOut size={14} /> Sign out
        </button>
        <button onClick={() => out(true)} className={secondaryBtn} style={{ backgroundColor: "#EAE6D9", color: C.ink }}>
          <LogOut size={14} /> Sign out of all devices
        </button>
      </div>
    </section>
  );
}

const CONFIRM_WORD = "DELETE";

function DeleteAccount({ auth, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [password, setPassword] = useState("");
  const [state, run] = useAction();
  const ready = word.trim().toUpperCase() === CONFIRM_WORD && password;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    const ok = await run(() => auth.deleteAccount(password));
    if (ok) onDeleted();
  };

  return (
    <section>
      <SectionLabel>Delete account</SectionLabel>
      <div className="rounded-2xl p-4 space-y-3" style={{ ...card, borderColor: "#F2C4BE" }}>
        <p className="text-xs" style={{ color: C.sub }}>
          Permanently deletes your account and everything saved to it: the tournament in progress and your whole history. This can't be undone. Download your data first if you want a copy.
        </p>
        {!open ? (
          <button onClick={() => setOpen(true)} className={secondaryBtn} style={{ backgroundColor: "#FBE3DE", color: C.loss }}>
            <Trash2 size={14} /> Delete my account…
          </button>
        ) : (
          <form className="space-y-3" onSubmit={submit}>
            <Field label={`Type ${CONFIRM_WORD} to confirm`} type="text" autoComplete="off" value={word} onChange={(e) => setWord(e.target.value)} />
            <Field label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Feedback state={state} />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={!ready || state.busy} className={primaryBtn} style={{ backgroundColor: C.loss, color: "#fff" }}>
                <Trash2 size={14} /> {state.busy ? "Deleting…" : "Delete my account"}
              </button>
              <button type="button" onClick={() => { setOpen(false); setWord(""); setPassword(""); }} className={secondaryBtn} style={{ backgroundColor: "#EAE6D9", color: C.ink }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
