import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;
/** A transaction handle. Money functions accept this so callers can compose them atomically. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;

type Cache = { sql?: ReturnType<typeof postgres>; db?: Db; url?: string };
const globalCache = globalThis as unknown as { __veriflowDb?: Cache };
const cache: Cache = (globalCache.__veriflowDb ??= {});

/**
 * Lazy singleton (survives Next.js dev hot-reload). `prepare: false` is required for
 * Supabase's transaction pooler. Row locks (SELECT ... FOR UPDATE) work fine through it
 * because we always take them inside a transaction.
 */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (cache.db && cache.url === url) return cache.db;
  const client = postgres(url, {
    prepare: false,
    max: process.env.NODE_ENV === 'production' ? 5 : 10,
  });
  cache.sql = client;
  cache.db = drizzle(client, { schema });
  cache.url = url;
  return cache.db;
}

export async function closeDb(): Promise<void> {
  await cache.sql?.end({ timeout: 5 });
  cache.sql = undefined;
  cache.db = undefined;
  cache.url = undefined;
}

export { schema };
