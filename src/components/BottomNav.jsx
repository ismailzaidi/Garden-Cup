import { Home, Trophy, CircleUser, LogIn } from "lucide-react";
import { C } from "../lib/theme.js";

/* The app's three screens, thumb-reachable at the bottom like a phone app.
   The account tab reads "Sign in" until someone is, when sign-in exists at
   all (local-only builds have no accounts, so it's just "My data"). */
export default function BottomNav({ screen, onChange, inProgress, signedIn, cloud }) {
  const accountLabel = !cloud ? "My data" : signedIn ? "My account" : "Sign in";
  const items = [
    { key: "home", label: "Home", Icon: Home },
    { key: "play", label: "Play", Icon: Trophy, dot: inProgress },
    { key: "account", label: accountLabel, Icon: cloud && !signedIn ? LogIn : CircleUser },
  ];
  return (
    <nav aria-label="Main" className="fixed bottom-0 inset-x-0 z-40"
      style={{ backgroundColor: "#fff", borderTop: `1px solid ${C.line}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex max-w-lg mx-auto">
        {items.map(({ key, label, Icon, dot }) => {
          const active = screen === key;
          return (
            <button key={key} onClick={() => onChange(key)} aria-current={active ? "page" : undefined}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 relative">
              <span className="relative">
                <Icon size={20} color={active ? C.pitch : C.mute} />
                {dot && <span aria-label="tournament in progress" className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full" style={{ backgroundColor: C.gold }} />}
              </span>
              <span className="text-[10px] font-bold" style={{ color: active ? C.pitch : C.mute }}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
