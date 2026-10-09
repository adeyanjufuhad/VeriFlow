import { runMigrations } from '../db/migrate';

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL_DIRECT (or DATABASE_URL) to run migrations.');
  process.exit(1);
}

runMigrations(url)
  .then(() => console.log('Migrations applied.'))
  .catch((err) => {
    console.error('Migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
