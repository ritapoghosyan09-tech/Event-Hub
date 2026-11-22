// Applies prisma/migrations/*/migration.sql in order, once each, tracked in "_eh_migrations".
// Works anywhere Node and DATABASE_URL exist (local, Render/Vercel build step).
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const dir = join(process.cwd(), "prisma", "migrations");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(`CREATE TABLE IF NOT EXISTS "_eh_migrations" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
const done = new Set((await client.query(`SELECT name FROM "_eh_migrations"`)).rows.map((r) => r.name));
for (const name of readdirSync(dir).filter((d) => !d.startsWith(".")).sort()) {
  if (done.has(name)) continue;
  const sql = readFileSync(join(dir, name, "migration.sql"), "utf8");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(`INSERT INTO "_eh_migrations"(name) VALUES ($1)`, [name]);
    await client.query("COMMIT");
    console.log(`applied ${name}`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`failed ${name}: ${e.message}`);
    process.exit(1);
  }
}
await client.end();
console.log("database is up to date");
