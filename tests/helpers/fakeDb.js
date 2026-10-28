/* A tiny in-memory stand-in for the mariadb connection, covering exactly the
   statement shapes api/_lib/serializer.js issues (and nothing else). It parses
   the column list out of each INSERT and the select list out of each SELECT,
   so a column that is written but never read back — or a parameter in the
   wrong position — fails a test instead of passing against a looser fake. */

const squash = (sql) => sql.replace(/\s+/g, " ").replace(/`/g, "").trim();
const splitTop = (text) => text.split(",").map((t) => t.trim());

export function createFakeDb() {
  const tables = {};
  const rows = (name) => (tables[name] ??= []);

  const matches = (row, where, params) => {
    // "a = ? AND b = ? AND c='lit' AND d<>?"
    let i = 0;
    return where.split(/ AND /i).every((cond) => {
      const m = cond.trim().match(/^(\w+)\s*(=|<>)\s*(\?|'[^']*')$/);
      if (!m) throw new Error(`fakeDb: cannot parse condition "${cond}"`);
      const want = m[3] === "?" ? params[i++] : m[3].slice(1, -1);
      return m[2] === "=" ? row[m[1]] === want : row[m[1]] !== want;
    });
  };

  return {
    tables,
    async query(rawSql, params = []) {
      const sql = squash(rawSql);
      let m;

      if ((m = sql.match(/^INSERT INTO (\w+) \(([^)]*)\) VALUES \((.*)\)$/s))) {
        const cols = splitTop(m[2]);
        const slots = splitTop(m[3]);
        if (cols.length !== slots.length) throw new Error(`fakeDb: ${m[1]} has ${cols.length} columns but ${slots.length} values`);
        let p = 0;
        const row = {};
        cols.forEach((c, i) => { row[c] = slots[i] === "?" ? params[p++] : slots[i].slice(1, -1); });
        if (p !== params.length) throw new Error(`fakeDb: ${m[1]} got ${params.length} params for ${p} placeholders`);
        rows(m[1]).push(row);
        return { affectedRows: 1 };
      }

      if ((m = sql.match(/^UPDATE (\w+) SET (.*) WHERE (.*)$/s))) {
        let p = 0;
        const sets = splitTop(m[2]).map((s) => {
          const [col, val] = s.split(/\s*=\s*/);
          return [col, val === "?" ? params[p++] : val.slice(1, -1)];
        });
        const where = m[3];
        const rest = params.slice(p);
        let n = 0;
        rows(m[1]).forEach((r) => {
          if (matches(r, where, rest)) { sets.forEach(([c, v]) => { r[c] = v; }); n++; }
        });
        return { affectedRows: n };
      }

      if ((m = sql.match(/^DELETE FROM (\w+) WHERE (.*)$/s))) {
        const keep = rows(m[1]).filter((r) => !matches(r, m[2], params));
        const n = rows(m[1]).length - keep.length;
        tables[m[1]] = keep;
        return { affectedRows: n };
      }

      if ((m = sql.match(/^SELECT (.*) FROM (\w+) WHERE (.*?)(?: ORDER BY (\w+))?(?: LIMIT 1)?(?: FOR UPDATE)?$/s))) {
        const cols = splitTop(m[1]);
        let found = rows(m[2]).filter((r) => matches(r, m[3], params));
        if (m[4]) found = [...found].sort((a, b) => a[m[4]] - b[m[4]]);
        return found.map((r) => Object.fromEntries(cols.map((c) => {
          if (!(c in r)) throw new Error(`fakeDb: ${m[2]}.${c} was never written`);
          return [c, r[c] === undefined ? null : r[c]];
        })));
      }

      throw new Error(`fakeDb: unsupported statement: ${sql}`);
    },
  };
}
