import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getConfig } from '@/lib/config';
import { errorResponse, json, safeEqual, unauthorized } from '@/lib/http';
import { log } from '@/lib/log';
import { nairaToKobo, parseKobo } from '@/lib/money/kobo';
import { dispatchOutbox } from '@/lib/money/outbox';
import { ingestProviderEvent } from '@/lib/money/webhooks';
import { getProvider } from '@/lib/payments';
import { after } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    virtualAccountNumber: z.string().min(1),
    amountKobo: z.union([z.string(), z.number()]).optional(),
    amountNaira: z.string().optional(),
    payerName: z.string().max(120).optional(),
    /** Optional, so a test can replay the same simulated payment and prove idempotency. */
    eventId: z.string().min(1).max(100).optional(),
  })
  .refine((b) => (b.amountKobo === undefined) !== (b.amountNaira === undefined), {
    message: 'Provide exactly one of amountKobo or amountNaira',
  });

/**
 * DEMO / DEV BACKUP ONLY. Behaves like a customer paying a trader's virtual account, but goes through the
 * very same ingestProviderEvent path as a real webhook, so the live demo still works if the sandbox or the
 * venue internet fails. Guarded by the x-demo-admin-token header.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const config = getConfig();
    const given = req.headers.get('x-demo-admin-token');
    if (!config.DEMO_ADMIN_TOKEN || !given || !safeEqual(given, config.DEMO_ADMIN_TOKEN)) return unauthorized();

    const body = BodySchema.parse(await req.json());
    const amountKobo = body.amountNaira !== undefined ? nairaToKobo(body.amountNaira) : parseKobo(body.amountKobo);

    const provider = getProvider();
    const result = await ingestProviderEvent({
      type: 'charge.success',
      provider: provider.name,
      eventId: `charge.success:${body.eventId ?? `sim_${randomUUID()}`}`,
      amountKobo,
      virtualAccountNumber: body.virtualAccountNumber,
      reference: null,
      payerName: body.payerName ?? 'Demo customer',
      paidAt: new Date(),
    });

    log.info('payment.simulated', { status: result.status, amountKobo });
    if (result.status === 'processed' && config.OUTBOX_WEBHOOK_URL) {
      after(() => dispatchOutbox().catch((e) => log.warn('outbox.dispatch_error', { error: String(e) })));
    }
    return json({ status: result.status, amountKobo });
  } catch (err) {
    return errorResponse(err);
  }
}
