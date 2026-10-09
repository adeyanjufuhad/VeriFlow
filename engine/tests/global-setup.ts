import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { runMigrations } from '../db/migrate';

const TEMPLATE_DB = 'veriflow_template';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Starts one real (embedded) Postgres for the whole test run, migrates a template database once,
 * and exposes the admin URL. Each test file clones the template (see setup.ts), so files are isolated
 * and can run in parallel while every test still exercises real Postgres locking and triggers.
 */
export default async function setup() {
  // Allow pointing the suite at an existing Postgres instead (e.g. CI service container).
  if (process.env.TEST_PG_ADMIN_URL) {
    await prepareTemplate(process.env.TEST_PG_ADMIN_URL);
    return;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veriflow-pg-'));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(dir, 'data'),
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();

  const adminUrl = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
  process.env.TEST_PG_ADMIN_URL = adminUrl;
  await prepareTemplate(adminUrl);

  return async () => {
    await pg.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  };
}

async function prepareTemplate(adminUrl: string) {
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${TEMPLATE_DB}`);
    await admin.unsafe(`CREATE DATABASE ${TEMPLATE_DB}`);
  } finally {
    await admin.end();
  }
  const templateUrl = new URL(adminUrl);
  templateUrl.pathname = `/${TEMPLATE_DB}`;
  await runMigrations(templateUrl.toString());
}
