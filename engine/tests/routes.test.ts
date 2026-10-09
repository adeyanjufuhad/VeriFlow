import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { POST as outboxAck, GET as outboxGet } from '../app/api/outbox/route';
import { POST as simulate } from '../app/api/payments/simulate/route';
import { GET as balancesGet } from '../app/api/traders/[id]/balances/route';
import { POST as createTraderRoute } from '../app/api/traders/route';
import { POST as webhook } from '../app/api/webhooks/payments/route';
import { getDb } from '../db/client';
import { journalEntries, outboxEvents, providerEvents } from '../db/schema';
import { getBalances } from '../lib/ledger';
import { MOCK_SIGNATURE_HEADER, signMockBody } from '../lib/payments';
import { newTrader, uniqueKey } from './helpers';

const SECRET = 'test-webhook-secret';

const chargeBody = (opts: { id: string; account: string; amount: number; currency?: string }) =>
  JSON.stringify({
    event: 'charge.success',
    data: {
      id: opts.id,
      reference: `ref_${opts.id}`,
      amount: opts.amount,
      currency: opts.currency ?? 'NGN',
      paid_at: new Date().toISOString(),
      dedicated_account: { account_number: opts.account },
      customer: { first_name: 'Ada', last_name: 'Customer' },
    },
  });

const signed = (body: string) =>
  webhook(new Request('http://x/api/webhooks/payments', { method: 'POST', body, headers: { [MOCK_SIGNATURE_HEADER]: signMockBody(body, SECRET) } }));

const post = (url: string, headers: Record<string, string>, body: unknown) =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('POST /api/webhooks/payments', () => {
  it('rejects a bad signature with 401, posts nothing, and leaves an audit row', async () => {
    const t = await newTrader();
    const body = chargeBody({ id: uniqueKey('w'), account: t.virtualAccountNumber, amount: 500_000 });
    const res = await webhook(new Request('http://x', { method: 'POST', body, headers: { [MOCK_SIGNATURE_HEADER]: 'deadbeef' } }));
    expect(res.status).toBe(401);
    expect((await getBalances(t.id)).walletKobo).toBe(0n);
    const audit = await getDb().select().from(providerEvents).where(eq(providerEvents.signatureValid, false));
    expect(audit.length).toBeGreaterThan(0);
    expect(JSON.stringify(audit)).not.toContain(t.virtualAccountNumber); // raw body is never stored
  });

  it('rejects a missing signature and a signature made over a different body', async () => {
    const t = await newTrader();
    const body = chargeBody({ id: uniqueKey('w'), account: t.virtualAccountNumber, amount: 500_000 });
    expect((await webhook(new Request('http://x', { method: 'POST', body }))).status).toBe(401);
    const tampered = new Request('http://x', {
      method: 'POST',
      body: body.replace('500000', '900000'),
      headers: { [MOCK_SIGNATURE_HEADER]: signMockBody(body, SECRET) },
    });
    expect((await webhook(tampered)).status).toBe(401);
    expect((await getBalances(t.id)).walletKobo).toBe(0n);
  });

  it('processes a valid charge: split, ledger and outbox', async () => {
    const t = await newTrader({ limitKobo: 100_000_000n, loanKobo: 45_000_000n });
    const res = await signed(chargeBody({ id: uniqueKey('w'), account: t.virtualAccountNumber, amount: 500_000 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'processed' });
    const b = await getBalances(t.id);
    expect(b.walletKobo).toBe(450_000n);
    expect(b.loanOutstandingKobo).toBe(44_950_000n);
    expect(await getDb().select().from(outboxEvents).where(eq(outboxEvents.traderId, t.id))).toHaveLength(1);
  });

  it('ignores a duplicate delivery with a 200 (never a 500) and counts the money once', async () => {
    const t = await newTrader();
    const body = chargeBody({ id: uniqueKey('w'), account: t.virtualAccountNumber, amount: 500_000 });
    const first = await signed(body);
    const second = await signed(body);
    const third = await signed(body);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    expect(await second.json()).toEqual({ status: 'duplicate' });
    expect((await getBalances(t.id)).walletKobo).toBe(500_000n);
    const entries = await getDb().select().from(journalEntries).where(eq(journalEntries.traderId, t.id));
    expect(entries).toHaveLength(1);
  });

  it('acknowledges (200) a payment to an unknown account and records why', async () => {
    const id = uniqueKey('w');
    const res = await signed(chargeBody({ id, account: '0000000001', amount: 123_400 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'unmatched' });
    const [row] = await getDb().select().from(providerEvents).where(eq(providerEvents.eventId, `charge.success:${id}`));
    expect(row?.error).toBe('unknown virtual account');
    expect(row?.processedAt).not.toBeNull();
  });

  it('acknowledges authentic but irrelevant or unusable events without error', async () => {
    const other = JSON.stringify({ event: 'customeridentification.success', data: { id: 5 } });
    expect(await (await signed(other)).json()).toEqual({ status: 'ignored' });
    const nonNaira = chargeBody({ id: uniqueKey('w'), account: '1', amount: 100, currency: 'USD' });
    expect(await (await signed(nonNaira)).json()).toEqual({ status: 'ignored' });
    const junk = 'not json at all';
    expect(await (await signed(junk)).json()).toEqual({ status: 'ignored' });
  });
});

describe('POST /api/payments/simulate', () => {
  const url = 'http://x/api/payments/simulate';

  it('requires the demo admin token', async () => {
    const t = await newTrader();
    const body = { virtualAccountNumber: t.virtualAccountNumber, amountNaira: '5000' };
    expect((await simulate(post(url, {}, body))).status).toBe(401);
    expect((await simulate(post(url, { 'x-demo-admin-token': 'wrong' }, body))).status).toBe(401);
    expect((await getBalances(t.id)).walletKobo).toBe(0n);
  });

  it('runs the same path as a webhook: ₦5,000 is split and queued', async () => {
    const t = await newTrader({ limitKobo: 100_000_000n, loanKobo: 45_000_000n });
    const res = await simulate(post(url, { 'x-demo-admin-token': 'test-demo-token' }, { virtualAccountNumber: t.virtualAccountNumber, amountNaira: '5000' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'processed', amountKobo: '500000' });
    const b = await getBalances(t.id);
    expect(b.walletKobo).toBe(450_000n);
    expect(b.loanOutstandingKobo).toBe(44_950_000n);
    expect(await getDb().select().from(outboxEvents).where(eq(outboxEvents.traderId, t.id))).toHaveLength(1);
  });

  it('replaying the same eventId is a duplicate', async () => {
    const t = await newTrader();
    const headers = { 'x-demo-admin-token': 'test-demo-token' };
    const body = { virtualAccountNumber: t.virtualAccountNumber, amountKobo: 250_000, eventId: uniqueKey('replay') };
    expect((await (await simulate(post(url, headers, body))).json()).status).toBe('processed');
    expect((await (await simulate(post(url, headers, body))).json()).status).toBe('duplicate');
    expect((await getBalances(t.id)).walletKobo).toBe(250_000n);
  });

  it('validates input: exactly one amount field, whole kobo only', async () => {
    const headers = { 'x-demo-admin-token': 'test-demo-token' };
    const both = await simulate(post(url, headers, { virtualAccountNumber: '1', amountKobo: 1, amountNaira: '1' }));
    const none = await simulate(post(url, headers, { virtualAccountNumber: '1' }));
    const float = await simulate(post(url, headers, { virtualAccountNumber: '1', amountKobo: 10.5 }));
    const neg = await simulate(post(url, headers, { virtualAccountNumber: '1', amountNaira: '-5' }));
    expect([both.status, none.status, float.status, neg.status]).toEqual([400, 400, 400, 400]);
  });
});

describe('service routes', () => {
  it('GET /api/traders/:id/balances needs a staff or bot token and returns kobo strings', async () => {
    const t = await newTrader({ limitKobo: 1_000_000n, loanKobo: 300_000n });
    const call = (headers: Record<string, string>) =>
      balancesGet(new Request('http://x', { headers }), { params: Promise.resolve({ id: t.id }) });
    expect((await call({})).status).toBe(401);
    expect((await call({ authorization: 'Bearer nope' })).status).toBe(401);
    const ok = await call({ authorization: 'Bearer test-staff-token' });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ loanOutstandingKobo: '300000', creditLimitKobo: '1000000', availableCreditKobo: '700000' });
    const bad = await balancesGet(new Request('http://x', { headers: { authorization: 'Bearer test-staff-token' } }), { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(bad.status).toBe(400);
    const missing = await balancesGet(new Request('http://x', { headers: { authorization: 'Bearer test-staff-token' } }), {
      params: Promise.resolve({ id: crypto.randomUUID() }),
    });
    expect(missing.status).toBe(404);
  });

  it('POST /api/traders is idempotent on phone and needs the bot token', async () => {
    const phone = `0803${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    const bot = { authorization: 'Bearer test-bot-token' };
    expect((await createTraderRoute(post('http://x', {}, { name: 'Ada', phone }))).status).toBe(401);
    const a = await (await createTraderRoute(post('http://x', bot, { name: 'Ada', phone }))).json();
    const b = await (await createTraderRoute(post('http://x', bot, { name: 'Ada Again', phone }))).json();
    expect(a.id).toBe(b.id);
    expect(a.virtualAccountNumber).toMatch(/^9\d{9}$/);
    expect((await createTraderRoute(post('http://x', bot, { name: 'Ada', phone: '123' }))).status).toBe(400);
  });

  it('outbox: bot polls undelivered events and acknowledges them', async () => {
    const t = await newTrader();
    await simulate(post('http://x', { 'x-demo-admin-token': 'test-demo-token' }, { virtualAccountNumber: t.virtualAccountNumber, amountNaira: '100' }));
    const bot = { authorization: 'Bearer test-bot-token' };
    expect((await outboxGet(new Request('http://x/api/outbox'))).status).toBe(401);
    const list = await (await outboxGet(new Request('http://x/api/outbox?limit=500', { headers: bot }))).json();
    const mine = list.events.filter((e: { traderId: string }) => e.traderId === t.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].type).toBe('payment.received');
    const ack = await (await outboxAck(post('http://x/api/outbox', bot, { ids: [mine[0].id] }))).json();
    expect(ack.delivered).toBe(1);
    const after = await (await outboxGet(new Request('http://x/api/outbox?limit=500', { headers: bot }))).json();
    expect(after.events.filter((e: { traderId: string }) => e.traderId === t.id)).toHaveLength(0);
  });
});
