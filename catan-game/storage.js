import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";
export function fileStore(path) {
  return {
    remote: false,
    async load() {
      try {
        return JSON.parse(readFileSync(path, "utf8"));
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async save(data) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(`${path}.tmp`, JSON.stringify(data), { mode: 0o600 });
      for (let attempt = 0; ; attempt++) {
        try {
          renameSync(`${path}.tmp`, path);
          break;
        } catch (e) {
          if (!["EPERM", "EACCES", "EBUSY"].includes(e.code) || attempt >= 5)
            throw e;
          await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
        }
      }
    },
    async close() {},
  };
}
export async function postgresStore(pool) {
  let revision = 0;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS catan_state (id smallint PRIMARY KEY CHECK (id = 1), revision bigint NOT NULL, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())",
  );
  return {
    remote: true,
    async load() {
      const { rows } = await pool.query(
        "SELECT revision, payload FROM catan_state WHERE id = 1",
      );
      revision = Number(rows[0]?.revision ?? 0);
      return rows[0]?.payload ?? null;
    },
    async save(data) {
      const result = await pool.query(
        "INSERT INTO catan_state (id, revision, payload) VALUES (1, 1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET revision = catan_state.revision + 1, payload = EXCLUDED.payload, updated_at = now() WHERE catan_state.revision = $2 RETURNING revision",
        [JSON.stringify(data), revision],
      );
      if (!result.rows.length) {
        const e = new Error(
          "Saved state changed on another server; retry your action",
        );
        e.code = "CATAN_STATE_CONFLICT";
        throw e;
      }
      revision = Number(result.rows[0].revision);
    },
    async close() {
      await pool.end();
    },
  };
}
export async function openStore({ databaseUrl, dataFile }) {
  if (!databaseUrl) return fileStore(dataFile);
  const { Pool } = await import("pg");
  const connection = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(connection.protocol))
    throw Error("DATABASE_URL must be a PostgreSQL URL");
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    connection.searchParams.delete(key);
  const pool = new Pool({
    connectionString: connection.toString(),
    ssl: { rejectUnauthorized: true },
    max: 2,
    connectionTimeoutMillis: 20000,
    idleTimeoutMillis: 30000,
  });
  pool.on("error", () => console.error("Database connection interrupted"));
  return postgresStore(pool);
}
