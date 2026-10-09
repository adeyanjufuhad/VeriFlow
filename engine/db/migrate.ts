import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Applies all pending migrations from db/migrations. Use a DIRECT (non-pooler) connection URL. */
export async function runMigrations(url: string): Promise<void> {
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: path.resolve(__dirname, 'migrations') });
  } finally {
    await client.end({ timeout: 5 });
  }
}
