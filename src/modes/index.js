import league from "./league.jsx";
import roundrobin from "./roundrobin.jsx";
import knockout from "./knockout.jsx";
import king from "./king.jsx";
import bestofn from "./bestofn.jsx";

export const MODES = [league, knockout, king, roundrobin, bestofn];
export const getMode = (key) => MODES.find((m) => m.key === key) ?? MODES[0];
