/**
 * Local Postgres for development, no Docker or Supabase needed.
 *   npm run dev:db          (leave running)
 * Then in .env:  DATABASE_URL=postgresql://postgres:postgres@localhost:54329/veriflow
 * Data persists in ./.pgdata between runs.
 */
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { runMigrations } from '../db/migrate';

const PORT = Number(process.env.DEV_DB_PORT ?? 54329);
const dir = path.resolve(process.cwd(), '.pgdata');

async function main() {
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port: PORT, persistent: true, onLog: () => {} });
  if (!fs.existsSync(path.join(dir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();

  const admin = postgres(`postgres://postgres:postgres@localhost:${PORT}/postgres`, { max: 1, onnotice: () => {} });
  const exists = await admin`SELECT 1 FROM pg_database WHERE datname = 'veriflow'`;
  if (exists.length === 0) await admin.unsafe('CREATE DATABASE veriflow');
  await admin.end();

  const url = `postgresql://postgres:postgres@localhost:${PORT}/veriflow`;
  await runMigrations(url);
  console.log(`\nDev database ready (migrations applied).\n  DATABASE_URL=${url}\nPress Ctrl+C to stop.\n`);

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => {}, 1 << 30); // keep the process alive
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
