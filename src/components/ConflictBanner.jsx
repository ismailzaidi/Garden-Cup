import { useEffect, useState } from "react";
import { C } from "../lib/theme.js";
import { CONFLICT_EVENT, getConflictBackup, restoreConflictBackup, dismissConflictBackup } from "../lib/syncEngine.js";

/* Shown after a sync conflict: another device saved first, so this device's
   tournament was replaced by the server's copy. The replaced version was kept
   (syncEngine.js), and this offers to put it back. Reads localStorage on
   mount too, so it survives a reload. */
export default function ConflictBanner() {
  const [backup, setBackup] = useState(() => getConflictBackup());

  useEffect(() => {
    const refresh = () => setBackup(getConflictBackup());
    window.addEventListener(CONFLICT_EVENT, refresh);
    return () => window.removeEventListener(CONFLICT_EVENT, refresh);
  }, []);

  if (!backup) return null;
  return (
    <div role="alert" className="mx-4 mt-4 rounded-2xl p-4 flex items-start justify-between gap-3" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
      <div>
        <p className="text-sm font-bold" style={{ color: C.ink }}>Another device saved a newer tournament</p>
        <p className="text-xs mt-1" style={{ color: C.sub }}>
          Your changes on this device were replaced by that version. Your version is still saved —
          restore it to replace the other device's version with yours.
        </p>
      </div>
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button onClick={restoreConflictBackup} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>Restore my version</button>
        <button onClick={dismissConflictBackup} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: "#EAE6D9", color: C.ink }}>Keep theirs</button>
      </div>
    </div>
  );
}
