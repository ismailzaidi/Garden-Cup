/* ---------- MariaDB connection pool ----------
 * One pool per warm Node process, reused across invocations (Vercel keeps a
 * function instance alive between requests when traffic is frequent enough).
 * connectionLimit stays small on purpose: each concurrent serverless
 * instance gets its own pool, so the real ceiling is
 * (concurrent instances * DB_POOL_SIZE) against whatever connection cap the
 * database host enforces — verify that cap before raising this.
 */
import mariadb from "mariadb";

let pool;

export function getPool() {
  if (!pool) {
    pool = mariadb.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      connectionLimit: Number(process.env.DB_POOL_SIZE || 3),
      acquireTimeout: 8000,
      idleTimeout: 30,
      charset: "utf8mb4",
      bigIntAsNumber: true,
      // Force every session to UTC. Without this the connector leaves the
      // server's default session zone in place (often the host OS's local
      // zone), which silently breaks any query that compares a DATETIME
      // column against UTC_TIMESTAMP() — e.g. the login rate-limit window in
      // api/_lib/auth.js. "Z" makes the driver issue SET time_zone='+00:00'
      // per connection.
      timezone: "Z",
      ssl: process.env.DB_SSL === "false"
        ? undefined
        : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" },
    });
  }
  return pool;
}

export async function withConnection(fn) {
  const conn = await getPool().getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}

export async function withTransaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    try { await conn.rollback(); } catch { /* connection may already be gone */ }
    throw e;
  } finally {
    conn.release();
  }
}
