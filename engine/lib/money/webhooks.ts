import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { providerEvents } from '@/db/schema';
import { log, maskAccount } from '../log';
import type { NormalizedProviderEvent } from '../payments/types';
import { recordIncomingPayment } from './incoming';

export type IngestStatus = 'processed' | 'duplicate' | 'unmatched' | 'ignored';

function summarise(event: NormalizedProviderEvent): Record<string, unknown> {
  switch (event.type) {
    case 'charge.success':
      return {
        amountKobo: event.amountKobo.toString(),
        reference: event.reference,
        account: event.virtualAccountNumber ? maskAccount(event.virtualAccountNumber) : null,
      };
    case 'ignored':
      return { rawType: event.rawType };
    default:
      return { transferReference: event.transferReference, reason: event.reason };
  }
}

/** Audit row for a webhook that failed signature verification. The body is never parsed or stored. */
export async function recordInvalidSignature(provider: string, rawBody: string): Promise<void> {
  const eventId = `invalid:${createHash('sha256').update(rawBody).digest('hex')}`;
  await getDb()
    .insert(providerEvents)
    .values({ provider, eventId, eventType: 'unverified', signatureValid: false, error: 'invalid signature' })
    .onConflictDoNothing();
}

/**
 * THE entry point for provider events. The real webhook route and the demo simulate route both call this,
 * so the demo exercises exactly the production path.
 *
 * - de-duplicates on (provider, event id): a repeated delivery is acknowledged, never re-applied
 * - an event whose earlier attempt failed (processed_at still null) is retried
 * - unexpected errors are recorded on the event row and re-thrown, so the provider retries
 */
export async function ingestProviderEvent(event: NormalizedProviderEvent): Promise<{ status: IngestStatus }> {
  const db = getDb();

  const [inserted] = await db
    .insert(providerEvents)
    .values({
      provider: event.provider,
      eventId: event.eventId,
      eventType: event.type === 'ignored' ? event.rawType : event.type,
      signatureValid: true,
      payloadSummary: summarise(event),
    })
    .onConflictDoNothing({ target: [providerEvents.provider, providerEvents.eventId] })
    .returning({ id: providerEvents.id });

  let rowId = inserted?.id;
  if (!rowId) {
    const [existing] = await db
      .select({ id: providerEvents.id, processedAt: providerEvents.processedAt })
      .from(providerEvents)
      .where(and(eq(providerEvents.provider, event.provider), eq(providerEvents.eventId, event.eventId)));
    if (!existing) throw new Error('provider event vanished');
    if (existing.processedAt) return { status: 'duplicate' };
    rowId = existing.id;
  }

  try {
    let status: IngestStatus;
    let note: string | null = null;

    if (event.type === 'charge.success') {
      const result = await recordIncomingPayment({
        providerEventId: event.eventId,
        virtualAccountNumber: event.virtualAccountNumber ?? '',
        amountKobo: event.amountKobo,
        payerName: event.payerName ?? undefined,
        paidAt: event.paidAt,
        reference: event.reference ?? undefined,
      });
      status = result.status;
      if (result.status === 'unmatched') note = 'unknown virtual account';
    } else if (event.type === 'ignored') {
      status = 'ignored';
    } else {
      // Transfer outcomes are wired up in Phase 4 (drawdowns).
      status = 'ignored';
      note = 'transfer events are not handled yet';
    }

    await db
      .update(providerEvents)
      .set({ processedAt: sql`now()`, error: note })
      .where(eq(providerEvents.id, rowId));
    return { status };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await db.update(providerEvents).set({ error: message.slice(0, 500) }).where(eq(providerEvents.id, rowId));
    log.error('provider_event.failed', { eventId: event.eventId, error: message });
    throw err;
  }
}
