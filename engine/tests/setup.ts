import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { closeDb, getDb } from '../db/client';
import { sql } from 'drizzle-orm';

const TEMPLATE_DB = 'veriflow_template';
let dbName: string | undefined;

function adminUrl(): string {
  const url = process.env.TEST_PG_ADMIN_URL;
  if (!url) throw new Error('TEST_PG_ADMIN_URL missing: global setup did not run');
  return url;
}

// Each test file gets its own database cloned from the migrated template.
beforeAll(async () => {
  dbName = `t_${randomBytes(6).toString('hex')}`;
  const admin = postgres(adminUrl(), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE_DB}`);
  } finally {
    await admin.end();
  }
  const url = new URL(adminUrl());
  url.pathname = `/${dbName}`;
  process.env.DATABASE_URL = url.toString();
});

// Invariant: after every test, all debits across the whole ledger equal all credits.
afterEach(async () => {
  const [row] = (await getDb().execute(sql`
    SELECT COALESCE(SUM(amount_kobo) FILTER (WHERE direction = 'debit'), 0)::text AS debits,
           COALESCE(SUM(amount_kobo) FILTER (WHERE direction = 'credit'), 0)::text AS credits
      FROM postings
  `)) as unknown as { debits: string; credits: string }[];
  expect(row?.debits, 'ledger must net to zero after every test').toBe(row?.credits);
});

afterAll(async () => {
  await closeDb();
  if (!dbName) return;
  const admin = postgres(adminUrl(), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  } finally {
    await admin.end();
  }
});
