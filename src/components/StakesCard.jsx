import { Gift, Sparkles } from "lucide-react";
import { C } from "../lib/theme.js";

const joinNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}` : names[0]);

// What the tournament is played for (engine/stakes.js), shown by the shell
// above every mode's own view. While it's still being played this is a
// reminder of the stakes; once there's a champion it names who gets what.
export default function StakesCard({ stakes, champion, lastPlace }) {
  const prize = stakes.prize.trim();
  const chore = stakes.chore.trim();
  if (!prize && !chore) return null;
  const lastNames = lastPlace.map((p) => p.name);

  return (
    <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: "#fff", border: `2px solid ${champion ? C.gold : C.line}` }}>
      {prize && (
        <p className="text-sm flex items-start gap-2" style={{ color: C.sub }}>
          <Gift size={15} className="flex-shrink-0 mt-0.5" color={C.gold} />
          <span>
            {champion
              ? <><b style={{ color: C.ink }}>{champion.name}</b> wins the trophy and the prize: </>
              : "Champion's prize: "}
            <b style={{ color: C.ink }}>{prize}</b>
          </span>
        </p>
      )}
      {chore && (
        <p className="text-sm flex items-start gap-2" style={{ color: C.sub }}>
          <Sparkles size={15} className="flex-shrink-0 mt-0.5" color={C.pitch} />
          <span>
            {lastNames.length > 0
              ? <>Last place forfeit for <b style={{ color: C.ink }}>{joinNames(lastNames)}</b>: </>
              : "Last place forfeit: "}
            <b style={{ color: C.ink }}>{chore}</b>
          </span>
        </p>
      )}
    </div>
  );
}
