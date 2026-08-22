import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { C } from "../lib/theme.js";

const DISMISSED_KEY = "gardenCup:installDismissed";

/* Chrome fires beforeinstallprompt and shows its own mini-infobar unless we
   preventDefault() it — stashing the event lets us re-trigger install from
   a banner we control instead, positioned at the bottom like the rest of
   the app's overlays. Safari never fires this event, so on iOS the banner
   simply never appears — there's no programmatic install prompt there. */
export default function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "1");
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredEvent(e);
    };
    const onAppInstalled = () => setDeferredEvent(null);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const isStandalone = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;
  if (!deferredEvent || dismissed || isStandalone) return null;

  const handleInstall = async () => {
    if (installing) return; // prompt() may only be called once per stashed event
    setInstalling(true);
    await Promise.resolve(deferredEvent.prompt()).catch(() => {});
    await deferredEvent.userChoice.catch(() => {});
    setDeferredEvent(null);
    setInstalling(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-30 mx-4 mb-4 rounded-2xl p-4 flex items-center justify-between gap-3"
      style={{ backgroundColor: "#fff", border: `2px solid ${C.line}`, paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: C.pitch }}>
          <Download size={16} color={C.gold} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: C.ink }}>Add Garden Cup to your home screen</p>
          <p className="text-xs" style={{ color: C.sub }}>Launch it like an app, works offline.</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={handleInstall} disabled={installing} className="text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-60" style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
          Install
        </button>
        <button onClick={handleDismiss} aria-label="Dismiss" className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "#EAE6D9" }}>
          <X size={12} strokeWidth={3} color={C.ink} />
        </button>
      </div>
    </div>
  );
}
