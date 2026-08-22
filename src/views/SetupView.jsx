import { Plus, X, Target } from "lucide-react";
import { C } from "../lib/theme.js";
import { MODES } from "../modes/index.js";
import SectionLabel from "../components/SectionLabel.jsx";

export default function SetupView({ players, nameInput, mode, config, matches, activeMode, actions }) {
  const atMaxPlayers = activeMode.maxPlayers && players.length >= activeMode.maxPlayers;

  return (
    <>
      <div>
        <SectionLabel>Game mode</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.key;
            return (
              <button key={m.key} onClick={() => matches.length === 0 && actions.setMode(m.key)} disabled={matches.length > 0}
                className="rounded-xl p-3 text-left disabled:opacity-60 active:scale-[0.98] transition-transform"
                style={{ backgroundColor: active ? C.pitch : "#fff", border: `2px solid ${active ? C.pitch : C.line}` }}>
                <Icon size={16} color={active ? C.gold : C.pitch} />
                <p className="text-[13px] font-bold mt-1.5 leading-tight" style={{ color: active ? "#F7F5EE" : C.ink }}>{m.label}</p>
                <p className="text-[10px] mt-0.5 leading-snug" style={{ color: active ? "#D8E8D3" : C.mute }}>{m.desc}</p>
              </button>
            );
          })}
        </div>
        {matches.length > 0 && <p className="text-[10px] mt-2" style={{ color: C.mute }}>Tap "New" up top to change mode.</p>}
      </div>

      {matches.length === 0 && Object.entries(activeMode.config || {}).map(([key, spec]) => {
        const value = config[key] ?? spec.default;
        return (
          <div key={key}>
            <SectionLabel>{spec.label}</SectionLabel>
            <div className="flex gap-2">
              {spec.options.map((opt) => (
                <button key={opt} onClick={() => actions.setConfigValue(key, opt)} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ backgroundColor: value === opt ? C.pitch : "#fff", color: value === opt ? "#F7F5EE" : C.ink, border: `2px solid ${value === opt ? C.pitch : C.line}` }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div>
        <SectionLabel>Add a player</SectionLabel>
        <div className="flex gap-2">
          <input value={nameInput} onChange={(e) => actions.setNameInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && actions.addPlayer()}
            placeholder="Player name" maxLength={24} disabled={atMaxPlayers}
            className="flex-1 min-w-0 rounded-xl px-4 py-3 text-sm font-medium outline-none disabled:opacity-50"
            style={{ backgroundColor: "#fff", border: `2px solid ${C.line}`, color: C.ink }} />
          <button onClick={actions.addPlayer} disabled={atMaxPlayers} className="w-12 h-12 rounded-xl flex items-center justify-center active:scale-95 transition-transform flex-shrink-0 disabled:opacity-50"
            style={{ backgroundColor: C.pitch }}>
            <Plus color="#F7F5EE" size={20} strokeWidth={3} />
          </button>
        </div>
        {atMaxPlayers && <p className="text-[10px] mt-2" style={{ color: C.mute }}>This mode needs exactly {activeMode.maxPlayers} players.</p>}
      </div>

      {players.length > 0 && (
        <div>
          <SectionLabel>Players ({players.length})</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-semibold max-w-full"
                style={{ backgroundColor: "#fff", border: `2px solid ${C.line}`, color: C.ink }}>
                <span className="truncate max-w-[150px]">{p.name}</span>
                <button onClick={() => actions.removePlayer(p.id)} className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#EAE6D9" }}>
                  <X size={12} strokeWidth={3} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {players.length >= 2 && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "#fff", border: `2px solid ${C.line}` }}>
          <p className="text-sm flex items-start gap-2" style={{ color: C.sub }}>
            <Target size={15} className="flex-shrink-0 mt-0.5" color={C.pitch} />
            <span>{activeMode.summary({ players, config })}</span>
          </p>
        </div>
      )}

      <button onClick={actions.handleGenerate} disabled={players.length < activeMode.minPlayers}
        className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide disabled:opacity-40 active:scale-[0.98] transition-transform"
        style={{ backgroundColor: C.gold, color: C.ink }}>
        {matches.length > 0 ? "REGENERATE (CLEARS SCORES)" : activeMode.generateLabel}
      </button>
      {players.length < activeMode.minPlayers && (
        <p className="text-xs text-center" style={{ color: C.mute }}>Add at least {activeMode.minPlayers} players to start</p>
      )}
    </>
  );
}
