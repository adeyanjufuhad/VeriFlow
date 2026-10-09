import { createHmac } from 'node:crypto';
import { asc, inArray, isNull, sql } from 'drizzle-orm';
import { getDb, type DbOrTx } from '@/db/client';
import { outboxEvents, type OutboxEvent } from '@/db/schema';
import { getConfig } from '../config';
import { jsonSafe } from '../json';
import { log } from '../log';

/**
 * Outbox: money movements write a row here IN THE SAME TRANSACTION as the movement, so a message is
 * queued if and only if the money actually moved. The WhatsApp service then delivers at-least-once.
 * Consumers must de-duplicate on `id`.
 */

export const OUTBOX_EVENT_TYPES = [
  'payment.received',
  'drawdown.requested',
  'drawdown.approved',
  'drawdown.paid',
  'drawdown.failed',
  'savings.swept',
  'debt.paid',
  'pin.locked',
] as const;
export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[number];

export async function enqueueOutbox(
  tx: DbOrTx,
  event: { traderId: string | null; type: OutboxEventType; payload: Record<string, unknown> },
): Promise<void> {
  await tx.insert(outboxEvents).values({
    traderId: event.traderId,
    type: event.type,
    payload: jsonSafe(event.payload),
  });
}

/** JSON-friendly view of a row (bigint id as string). */
export type OutboxEventDto = { id: string; type: string; traderId: string | null; payload: Record<string, unknown>; createdAt: string };

const toDto = (e: OutboxEvent): OutboxEventDto => ({
  id: e.id.toString(),
  type: e.type,
  traderId: e.traderId,
  payload: e.payload,
  createdAt: e.createdAt.toISOString(),
});

/** Oldest first. Read-only: events stay undelivered until `markOutboxDelivered`. */
export async function fetchUndeliveredOutbox(limit = 50, tx: DbOrTx = getDb()): Promise<OutboxEventDto[]> {
  const rows = await tx
    .select()
    .from(outboxEvents)
    .where(isNull(outboxEvents.deliveredAt))
    .orderBy(asc(outboxEvents.id))
    .limit(Math.min(Math.max(limit, 1), 500));
  return rows.map(toDto);
}

export async function markOutboxDelivered(ids: (string | bigint)[], tx: DbOrTx = getDb()): Promise<number> {
  if (ids.length === 0) return 0;
  const updated = await tx
    .update(outboxEvents)
    .set({ deliveredAt: sql`now()` })
    .where(inArray(outboxEvents.id, ids.map(BigInt)))
    .returning({ id: outboxEvents.id });
  return updated.length;
}

/**
 * Optional push delivery: POSTs undelivered events to OUTBOX_WEBHOOK_URL, signed with an HMAC-SHA256 of
 * the body in `x-veriflow-signature`. Marks an event delivered only after a 2xx response.
 * Safe to call any time (also from a cron as a safety net); returns how many were delivered.
 */
export async function dispatchOutbox(limit = 50): Promise<{ attempted: number; delivered: number }> {
  const { OUTBOX_WEBHOOK_URL: url, OUTBOX_WEBHOOK_SECRET: secret } = getConfig();
  if (!url) return { attempted: 0, delivered: 0 };

  const events = await fetchUndeliveredOutbox(limit);
  let delivered = 0;
  for (const event of events) {
    const body = JSON.stringify(event);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(secret ? { 'x-veriflow-signature': createHmac('sha256', secret).update(body).digest('hex') } : {}),
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        log.warn('outbox.dispatch_rejected', { eventId: event.id, status: res.status });
        break; // keep order; retry later
      }
      await markOutboxDelivered([event.id]);
      delivered++;
    } catch (err) {
      log.warn('outbox.dispatch_failed', { eventId: event.id, error: err instanceof Error ? err.message : 'unknown' });
      break;
    }
  }
  return { attempted: events.length, delivered };
}
