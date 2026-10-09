import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../lib/config';
import { createTrader, normalizePhone } from '../lib/money/traders';
import { InvalidInput } from '../lib/money/errors';
import { getDb } from '../db/client';
import { creditLines, ledgerAccounts } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('config (rule 10: test mode only)', () => {
  it('refuses a live Paystack key unless ALLOW_LIVE_KEYS=true', () => {
    expect(() => loadConfig({ PAYSTACK_SECRET_KEY: 'sk_live_abc' })).toThrow(ConfigError);
    expect(() => loadConfig({ PAYSTACK_SECRET_KEY: 'sk_live_abc', ALLOW_LIVE_KEYS: 'false' })).toThrow(/live Paystack key/);
    expect(loadConfig({ PAYSTACK_SECRET_KEY: 'sk_live_abc', ALLOW_LIVE_KEYS: 'true' }).PAYSTACK_SECRET_KEY).toBe('sk_live_abc');
    expect(loadConfig({ PAYSTACK_SECRET_KEY: 'sk_test_abc' }).PAYSTACK_SECRET_KEY).toBe('sk_test_abc');
  });

  it('applies defaults and treats blank values as unset', () => {
    const c = loadConfig({ STAFF_API_TOKEN: '', DRAWDOWN_FEE_BPS: '' });
    expect(c.PAYMENT_PROVIDER).toBe('mock');
    expect(c.DRAWDOWN_FEE_BPS).toBe(100);
    expect(c.DEFAULT_SWEEP_RATE_BPS).toBe(1000);
    expect(c.SWEEP_BUFFER_KOBO).toBe(0n);
    expect(c.STAFF_API_TOKEN).toBeUndefined();
    expect(c.ALLOW_LIVE_KEYS).toBe(false);
  });

  it('requires a key for the paystack provider and rejects bad numbers', () => {
    expect(() => loadConfig({ PAYMENT_PROVIDER: 'paystack' })).toThrow(/PAYSTACK_SECRET_KEY/);
    expect(() => loadConfig({ DRAWDOWN_FEE_BPS: '20000' })).toThrow(ConfigError);
    expect(() => loadConfig({ PAYMENT_PROVIDER: 'flutterwave' })).toThrow(ConfigError);
  });
});

describe('createTrader', () => {
  it('normalises Nigerian phone formats to E.164', () => {
    for (const p of ['08031234567', '2348031234567', '+2348031234567', '0803 123 4567', '0803-123-4567']) {
      expect(normalizePhone(p), p).toBe('+2348031234567');
    }
    for (const bad of ['', '123', 'abcdefghijk', '0803123456', '+0123456789']) {
      expect(() => normalizePhone(bad), bad).toThrow(InvalidInput);
    }
  });

  it('creates accounts, a zero-limit credit line and a virtual account, and is idempotent on phone', async () => {
    const phone = `0902${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    const a = await createTrader({ name: 'Mama Put', phone, businessType: 'food' });
    const b = await createTrader({ name: 'Someone Else', phone });
    expect(b.id).toBe(a.id);
    expect(a.virtualAccountNumber).toMatch(/^9\d{9}$/);
    expect(a.virtualAccountBank).toBe('Mock Test Bank');
    expect(a.kycStatus).toBe('mocked');
    expect(a.pinHash).toBeNull();

    const accounts = await getDb().select().from(ledgerAccounts).where(eq(ledgerAccounts.ownerId, a.id));
    expect(accounts.map((x) => x.type).sort()).toEqual(['loan_receivable', 'trader_savings', 'trader_wallet']);
    const [line] = await getDb().select().from(creditLines).where(eq(creditLines.traderId, a.id));
    expect(line?.limitKobo).toBe(0n);
    expect(line?.sweepRateBps).toBe(1000);
    expect(line?.status).toBe('active');
  });

  it('survives two simultaneous creates for the same phone', async () => {
    const phone = `0813${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    const [a, b] = await Promise.all([createTrader({ name: 'Twin', phone }), createTrader({ name: 'Twin', phone })]);
    expect(a.id).toBe(b.id);
  });

  it('rejects an invalid phone or empty name', async () => {
    await expect(createTrader({ name: 'X', phone: '12' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(createTrader({ name: '  ', phone: '08031234567' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('rule 8 boundary: the AI layer cannot reach money-moving code', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

  it('the agent-safe barrel exports no posting, approval, settlement or transfer function', () => {
    const barrel = read('lib/money/index.ts').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const forbidden of ['postEntry', 'recordIncomingPayment', 'approveDrawdown', 'handleTransferResult', 'runSavingsSweep', 'internal', 'ingestProviderEvent', 'initiateTransfer']) {
      expect(barrel, forbidden).not.toContain(forbidden);
    }
  });

  it('nothing under lib/agents imports the ledger, payments, db or lib/money/internal', () => {
    const dir = path.join(root, 'lib/agents');
    if (!fs.existsSync(dir)) return; // the AI layer lives outside this package today; this guards it if it moves here
    const files: string[] = [];
    const walk = (d: string) =>
      fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.join(d, e.name))));
    walk(dir);
    for (const f of files.filter((x) => /\.(ts|tsx|js|mjs)$/.test(x))) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/from\s+['"][^'"]*(lib\/ledger|lib\/payments|lib\/money\/internal|\/db\/)/);
    }
  });
});
