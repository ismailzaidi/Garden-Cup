import league from "./league.jsx";
import roundrobin from "./roundrobin.jsx";
import knockout from "./knockout.jsx";
import king from "./king.jsx";
import bestofn from "./bestofn.jsx";
import chaos from "./chaos.jsx";
import goldenboot from "./goldenboot.jsx";
import survivor from "./survivor.jsx";
import penalties from "./penalties.jsx";
import worldcup from "./worldcup.jsx";

export const MODES = [league, knockout, king, roundrobin, bestofn, chaos, goldenboot, survivor, penalties, worldcup];
export const getMode = (key) => MODES.find((m) => m.key === key) ?? MODES[0];
