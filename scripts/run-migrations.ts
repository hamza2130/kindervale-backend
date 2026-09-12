/**
 * Applies every .sql file in scripts/migrations, in filename order.
 *
 * The files were already written to be idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS),
 * but re-running the whole folder on every deploy is still wasteful and makes it impossible to
 * tell what has actually been applied. This records each filename in a _migrations table and
 * skips the ones already there.
 *
 * Each file runs inside a transaction, so a file that fails part-way leaves nothing behind and
 * is not recorded as applied.
 *
 *   npm run db:migrate
 *
 * Reads DATABASE_URL from the environment (or .env). Render's free plan has no shell, so this
 * is the way to apply schema changes to the hosted database from a local machine.
 */
import "dotenv/config";
import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const MIGRATIONS_DIR = join(__dirname, "migrations");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required — set it in .env or the environment");
  }

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  if (!files.length) {
    console.log("No migrations found.");
    return;
  }

  // Render's hosted Postgres requires TLS, and its certificate is not in the local trust store.
  const needsSsl = /render\.com|amazonaws\.com/.test(databaseUrl);
  const client = new Client({
    connectionString: databaseUrl,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {})
  });

  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        "name"       text PRIMARY KEY,
        "applied_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    const { rows } = await client.query<{ name: string }>(`SELECT name FROM "_migrations"`);
    const applied = new Set(rows.map((r) => r.name));

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip   ${file}`);
        continue;
      }

      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(`INSERT INTO "_migrations" (name) VALUES ($1)`, [file]);
        await client.query("COMMIT");
        console.log(`  applied ${file}`);
        count += 1;
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }

    console.log(count ? `\nApplied ${count} migration(s).` : "\nEverything already up to date.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
