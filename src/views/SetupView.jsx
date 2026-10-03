import { useState } from "react";
import { Plus, X, Target } from "lucide-react";
import { C } from "../lib/theme.js";
import { MODES } from "../modes/index.js";
import { parseMembers } from "../engine/teams.js";
import { PRIZE_IDEAS, CHORE_IDEAS } from "../engine/stakes.js";
import SectionLabel from "../components/SectionLabel.jsx";

const inputStyle = { backgroundColor: "#fff", border: `2px solid ${C.line}`, color: C.ink };
const inputClass = "w-full min-w-0 rounded-xl px-4 py-3 text-sm font-medium outline-none disabled:opacity-50";

/* One line of what's being played for (engine/stakes.js): free text, with a
   row of one-tap ideas. Locked once fixtures exist, like the mode pickers —
   the stakes are agreed before kick-off, not renegotiated at 3-0 down. */
function StakeField({ label, value, placeholder, ideas, locked, onChange }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={40} disabled={locked}
        aria-label={label} className={inputClass} style={inputStyle} />
      {!locked && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {ideas.map((idea) => (
            <button key={idea} onClick={() => onChange(value === idea ? "" : idea)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: value === idea ? C.pitch : "#EAE6D9", color: value === idea ? "#F7F5EE" : C.ink }}>
              {idea}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SetupView({ players, nameInput, mode, config, matches, activeMode, stakes, knownNames = [], actions }) {
  const atMaxPlayers = activeMode.maxPlayers && players.length >= activeMode.maxPlayers;
  const overMaxPlayers = activeMode.maxPlayers && players.length > activeMode.maxPlayers;

  // Adding a team (engine/teams.js): a name for the table, plus the people
  // in it, who are who the Wins tab credits. Form state only — the team
  // itself lands in `players` through actions.addTeam.
  const [entry, setEntry] = useState("player");
  const [teamName, setTeamName] = useState("");
  const [membersText, setMembersText] = useState("");
  const members = parseMembers(membersText);
  const canAddTeam = teamName.trim() && members.length > 0 && !atMaxPlayers;

  const addTeam = () => {
    if (!actions.addTeam(teamName, members)) return;
    setTeamName("");
    setMembersText("");
  };

  // People this device already knows — past players and anyone on the
  // roster — offered as one-tap chips so a name is spelt the same way twice
  // and lands on the same Wins row.
  const taken = new Set(members.map((m) => m.toLowerCase()));
  const suggestions = [...new Set([...players.filter((p) => !p.members).map((p) => p.name), ...knownNames])]
    .filter((n) => !taken.has(n.toLowerCase())).slice(0, 12);
  const addMember = (name) => setMembersText(members.length ? `${members.join(", ")}, ${name}` : name);

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
                  {spec.format ? spec.format(opt) : opt}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <StakeField label="Champion's prize" value={stakes.prize} placeholder="e.g. No homework tonight" ideas={PRIZE_IDEAS}
        locked={matches.length > 0} onChange={(v) => actions.setStake("prize", v)} />
      <StakeField label="Last place job" value={stakes.chore} placeholder="e.g. Set the table" ideas={CHORE_IDEAS}
        locked={matches.length > 0} onChange={(v) => actions.setStake("chore", v)} />

      <div>
        <SectionLabel right={(
          <div className="flex gap-1">
            {[["player", "Player"], ["team", "Team"]].map(([key, label]) => (
              <button key={key} onClick={() => setEntry(key)} aria-pressed={entry === key} className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                style={{ backgroundColor: entry === key ? C.pitch : "#EAE6D9", color: entry === key ? "#F7F5EE" : C.ink }}>
                {label}
              </button>
            ))}
          </div>
        )}>{entry === "team" ? "Add a team" : "Add a player"}</SectionLabel>
        {entry === "team" ? (
          <div className="space-y-2">
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team name" maxLength={24} disabled={atMaxPlayers}
              className={inputClass} style={inputStyle} />
            <input value={membersText} onChange={(e) => setMembersText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTeam()}
              placeholder="Who's in it? e.g. Sam, Ali" disabled={atMaxPlayers} className={inputClass} style={inputStyle} />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((n) => (
                  <button key={n} onClick={() => addMember(n)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: "#EAE6D9", color: C.ink }}>
                    + {n}
                  </button>
                ))}
              </div>
            )}
            <button onClick={addTeam} disabled={!canAddTeam} className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: C.pitch, color: "#F7F5EE" }}>
              {members.length > 0 ? `ADD TEAM (${members.length} ${members.length === 1 ? "PLAYER" : "PLAYERS"})` : "ADD TEAM"}
            </button>
            <p className="text-[10px]" style={{ color: C.mute }}>A team plays as one side. Its wins count for every player in it on the Wins tab.</p>
          </div>
        ) : (
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
        )}
        {atMaxPlayers && !overMaxPlayers && <p className="text-[10px] mt-2" style={{ color: C.mute }}>This mode needs exactly {activeMode.maxPlayers} players.</p>}
      </div>

      {players.length > 0 && (
        <div>
          <SectionLabel>Players ({players.length})</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-semibold max-w-full"
                style={{ backgroundColor: "#fff", border: `2px solid ${C.line}`, color: C.ink }}>
                <span className="truncate max-w-[150px]">{p.name}</span>
                {p.members && <span className="truncate max-w-[150px] text-[11px] font-medium" style={{ color: C.mute }}>{p.members.join(", ")}</span>}
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

      <button onClick={actions.handleGenerate} disabled={players.length < activeMode.minPlayers || overMaxPlayers}
        className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide disabled:opacity-40 active:scale-[0.98] transition-transform"
        style={{ backgroundColor: C.gold, color: C.ink }}>
        {matches.length > 0 ? "REGENERATE (CLEARS SCORES)" : activeMode.generateLabel}
      </button>
      {players.length < activeMode.minPlayers && (
        <p className="text-xs text-center" style={{ color: C.mute }}>Add at least {activeMode.minPlayers} players to start</p>
      )}
      {overMaxPlayers && (
        <p className="text-xs text-center" style={{ color: C.mute }}>This mode needs exactly {activeMode.maxPlayers} players — remove {players.length - activeMode.maxPlayers} to start</p>
      )}
    </>
  );
}
