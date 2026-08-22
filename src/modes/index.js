import league from "./league.jsx";
import roundrobin from "./roundrobin.jsx";
import knockout from "./knockout.jsx";
import king from "./king.jsx";
import bestofn from "./bestofn.jsx";
import chaos from "./chaos.jsx";
import goldenboot from "./goldenboot.jsx";

export const MODES = [league, knockout, king, roundrobin, bestofn, chaos, goldenboot];
export const getMode = (key) => MODES.find((m) => m.key === key) ?? MODES[0];
