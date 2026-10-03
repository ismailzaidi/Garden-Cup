/* ---------- teams ----------
 * A team is an ordinary entry in `players` that also carries `members`, the
 * names of the people in it: { id, name: "Tigers", members: ["Sam", "Ali"] }.
 * Every mode treats it as one player — fixtures, tables and brackets never
 * look at `members`. They matter in exactly one place: the all-time Wins
 * table, which credits a team's titles and match wins to each person in it.
 *
 * Player ids mean nothing across two tournaments, so a finished tournament
 * keeps its teams by name on the history record, as
 * `teams: { "Tigers": ["Sam", "Ali"] }` — which also puts them in the export
 * file, since that file is the history.
 */

const MAX_MEMBERS = 8;
const fold = (name) => String(name).trim().toLowerCase();

/* "Sam, Ali" / "Sam + Ali" / "Sam & Ali" -> ["Sam", "Ali"]. Names are capped
   like a player name, and a name typed twice counts once. */
export function parseMembers(text) {
  const seen = new Set();
  const members = [];
  String(text || "").split(/[,+&\n]/).forEach((raw) => {
    const name = raw.trim().slice(0, 24);
    if (!name || seen.has(fold(name))) return;
    seen.add(fold(name));
    members.push(name);
  });
  return members.slice(0, MAX_MEMBERS);
}

/* The `teams` field of a history record, or null when nobody played as a
   team — a record without the key reads as "all solo players". */
export function teamsOf(players) {
  const teams = {};
  players.forEach((p) => {
    if (Array.isArray(p.members) && p.members.length) teams[p.name] = p.members;
  });
  return Object.keys(teams).length ? teams : null;
}

/* The people a name on a history record stands for. A team resolves to its
   members; anything else is one person. Records from before teams existed
   had the pair typed into the name box as "Sam + Ali", so a "+" in a name
   with no team behind it is read the same way. */
export function membersOf(record, name) {
  const teams = record && record.teams;
  if (teams && typeof teams === "object") {
    const key = Object.keys(teams).find((t) => fold(t) === fold(name));
    if (key && Array.isArray(teams[key]) && teams[key].length) return teams[key];
  }
  if (String(name).includes("+")) {
    const parts = parseMembers(name);
    if (parts.length > 1) return parts;
  }
  return [name];
}
