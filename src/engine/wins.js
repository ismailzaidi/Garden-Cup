import { membersOf } from "./teams.js";

/* One row per distinct person across every finished tournament. A team's
   titles and results are credited to each of its members (see
   engine/teams.js), never to the team's own name.
   History is newest-first, so the first spelling seen is the current one. */
export function computeWinsTable(history) {
  const rows = new Map(); // key: name.trim().toLowerCase() -> row

  const rowFor = (rawName) => {
    const name = String(rawName).trim();
    const key = name.toLowerCase();
    let row = rows.get(key);
    if (!row) {
      row = { key, name, titles: 0, entered: 0, played: 0, w: 0, d: 0, l: 0, hasResults: false };
      rows.set(key, row);
    }
    return row;
  };

  history.forEach((record) => {
    const people = (name) => membersOf(record, name);

    (record.players || []).forEach((name) => {
      if (!name) return;
      people(name).forEach((person) => { rowFor(person).entered++; });
    });

    // ensure a row even if the champion isn't in `players` — defensive,
    // for hand-edited or older imported data
    if (record.champion) people(record.champion).forEach((person) => { rowFor(person).titles++; });

    // step B only: older records have no `results` at all, which is "no
    // data", not "zero wins" — hasResults tells the view the difference
    if (Array.isArray(record.results)) {
      record.results.forEach((r) => {
        if (!r || !r.name) return;
        people(r.name).forEach((person) => {
          const row = rowFor(person);
          row.played += Number(r.played) || 0;
          row.w += Number(r.w) || 0;
          row.d += Number(r.d) || 0;
          row.l += Number(r.l) || 0;
          row.hasResults = true;
        });
      });
    }
  });

  return Array.from(rows.values()).sort((a, b) => {
    if (b.titles !== a.titles) return b.titles - a.titles;
    if (b.w !== a.w) return b.w - a.w;
    if (a.entered !== b.entered) return a.entered - b.entered;
    return a.name.localeCompare(b.name);
  });
}
