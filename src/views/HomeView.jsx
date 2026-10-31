import { Trophy, Medal, ChevronRight, CheckCircle2, X } from "lucide-react";
import { C, MEDAL_COLORS } from "../lib/theme.js";
import { MODES, modeLabel } from "../modes/index.js";
import { formatDate } from "../engine/format.js";
import SectionLabel from "../components/SectionLabel.jsx";
import EmptyCard from "../components/EmptyCard.jsx";

const RECENT = 5;
const LEADERS = 3;

const card = { backgroundColor: "#fff", border: `2px solid ${C.line}` };
const linkBtn = "flex items-center gap-0.5 text-[11px] font-bold";

/* The dashboard: start a tournament in any mode, the latest results, and
   the top of the all-time Wins table. Everything here is read from History,
   so it works the same signed in or not. */
export default function HomeView({ user, cloud, history, winsTable, confirmed, onDismissConfirmed, banners, onStartMode, onOpenTab, onSignIn }) {
  const greeting = user?.displayName ? `Hi ${user.displayName}` : "Welcome";
  const recent = history.slice(0, RECENT);
  // someone with no titles and no wins isn't leading anything yet
  const leaders = winsTable.filter((r) => r.titles > 0 || (r.hasResults && r.w > 0)).slice(0, LEADERS);

  return (
    <div className="min-h-screen w-full pb-28" style={{ backgroundColor: C.chalk, fontFamily: "'Inter', sans-serif" }}>
      <div className="px-5 pt-8 pb-5"
        style={{ background: `repeating-linear-gradient(90deg, ${C.pitch} 0px, ${C.pitch} 40px, ${C.pitchLight} 40px, ${C.pitchLight} 80px)` }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.6rem", color: "#F7F5EE", letterSpacing: "0.03em", lineHeight: 1 }}>GARDEN CUP</h1>
        <p className="mt-1.5 text-sm font-bold" style={{ color: "#E4D9A8" }}>{greeting}</p>
      </div>

      {banners}

      <div className="px-4 py-5 space-y-6">
        {confirmed && (
          <div role="status" className="rounded-2xl p-4 flex items-start gap-3" style={card}>
            <CheckCircle2 size={18} color={C.pitch} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm flex-1" style={{ color: C.ink }}><strong>Email confirmed.</strong> You're signed in, and your games now sync across your devices.</p>
            <button onClick={onDismissConfirmed} aria-label="Dismiss"><X size={16} color={C.mute} /></button>
          </div>
        )}

        {cloud && !user && (
          <div className="rounded-2xl p-4 flex items-center justify-between gap-3" style={card}>
            <p className="text-xs" style={{ color: C.sub }}>
              <strong style={{ color: C.ink }}>Playing on this device.</strong> Sign in to keep your games and history on every device.
            </p>
            <button onClick={onSignIn} className="text-xs font-bold px-3 py-2 rounded-full flex-shrink-0" style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
              Sign in
            </button>
          </div>
        )}

        <section>
          <SectionLabel>Start a new tournament</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.key} onClick={() => onStartMode(m.key)} aria-label={`Start ${m.label}`}
                  className="rounded-xl p-3 text-left active:scale-[0.98] transition-transform" style={card}>
                  <div className="flex items-center justify-between">
                    <Icon size={16} color={C.pitch} />
                    {m.age && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                        style={{ backgroundColor: m.age === "All ages" ? "#EAE6D9" : "#FDF3D9", color: C.ink }}>
                        {m.age}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-bold mt-1.5 leading-tight" style={{ color: C.ink }}>{m.label}</p>
                  <p className="text-[10px] mt-0.5 leading-snug" style={{ color: C.mute }}>{m.desc}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <SectionLabel right={history.length > 0 && (
            <button onClick={() => onOpenTab("history")} className={linkBtn} style={{ color: C.pitch }}>
              All history <ChevronRight size={13} />
            </button>
          )}>Recent results</SectionLabel>
          {recent.length === 0 ? (
            <EmptyCard>No finished tournaments yet. Champions show up here.</EmptyCard>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={card}>
              {recent.map((h, i) => (
                <div key={h.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid #F0EDE2` : "none" }}>
                  <Trophy size={15} color={C.gold} fill={C.gold} className="flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate" style={{ color: C.ink }}>{h.champion || "No champion"}</p>
                    <p className="text-[10px]" style={{ color: C.mute }}>{modeLabel(h.mode)} · {formatDate(h.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionLabel right={leaders.length > 0 && (
            <button onClick={() => onOpenTab("wins")} className={linkBtn} style={{ color: C.pitch }}>
              Full table <ChevronRight size={13} />
            </button>
          )}>All-time leaders</SectionLabel>
          {leaders.length === 0 ? (
            <EmptyCard>The all-time table starts with your first champion.</EmptyCard>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={card}>
              {leaders.map((row, i) => (
                <div key={row.key} data-testid="leader" className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid #F0EDE2` : "none" }}>
                  <Medal size={16} color={MEDAL_COLORS[i]} fill={MEDAL_COLORS[i]} className="flex-shrink-0" />
                  <p className="text-sm font-bold truncate flex-1" style={{ color: C.ink }}>{row.name}</p>
                  <p className="text-xs whitespace-nowrap" style={{ color: C.sub }}>
                    <strong style={{ color: C.pitch }}>{row.titles}</strong> {row.titles === 1 ? "title" : "titles"}
                    {row.hasResults && <> · {row.w} {row.w === 1 ? "win" : "wins"}</>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
