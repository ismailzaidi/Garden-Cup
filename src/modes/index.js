import league from "./league.jsx";
import knockout from "./knockout.jsx";
import king from "./king.jsx";
import chaos from "./chaos.jsx";
import goldenboot from "./goldenboot.jsx";
import survivor from "./survivor.jsx";
import penalties from "./penalties.jsx";
import worldcup from "./worldcup.jsx";
import horror from "./horror.jsx";

export const MODES = [league, knockout, king, chaos, goldenboot, survivor, penalties, worldcup, horror];
export const getMode = (key) => MODES.find((m) => m.key === key) ?? MODES[0];

/* Modes that used to exist. Nothing can start one, but History still holds
   tournaments played in them, so their names have to keep resolving — and
   the server's allow-list (api/_lib/modes.js) keeps their stages so an old
   record can still be imported. Retire a mode by moving its key here.
   A half-played tournament in one is handled on load: see retireMode in
   engine/persistence.js. */
export const RETIRED_MODES = {
  roundrobin: { label: "Pure League", stages: ["group"] },
  bestofn: { label: "Best of N", stages: ["bestofn"] },
  leaguechaos: { label: "League + Chaos", stages: ["lcgroup", "lcfinal"] },
};

export const modeLabel = (key) => MODES.find((m) => m.key === key)?.label ?? RETIRED_MODES[key]?.label ?? key;
