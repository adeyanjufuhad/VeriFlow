import { getConfig } from '@/lib/config';
import { errorResponse, json } from '@/lib/http';
import { log } from '@/lib/log';
import { ingestProviderEvent, recordInvalidSignature } from '@/lib/money/webhooks';
import { dispatchOutbox } from '@/lib/money/outbox';
import { getProvider } from '@/lib/payments';
import { after } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Payment provider webhooks (charge + transfer events).
 *  1. read the RAW body, verify the signature against it BEFORE parsing
 *  2. de-duplicate on the provider event id; duplicates still get a 200
 *  3. a genuine processing failure returns 500 so the provider retries
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const rawBody = await req.text();
    const provider = getProvider();

    if (!provider.verifyWebhook(rawBody, req.headers)) {
      await recordInvalidSignature(provider.name, rawBody);
      log.warn('webhook.invalid_signature', { provider: provider.name });
      return json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } }, { status: 401 });
    }

    let event;
    try {
      event = provider.parseWebhook(rawBody);
    } catch (err) {
      // Authentic but unusable: acknowledge so the provider stops retrying something we cannot process.
      log.warn('webhook.unparseable', { error: err instanceof Error ? err.message : 'unknown' });
      return json({ status: 'ignored' });
    }

    const result = await ingestProviderEvent(event);

    if (result.status === 'processed' && getConfig().OUTBOX_WEBHOOK_URL) {
      after(() => dispatchOutbox().catch((e) => log.warn('outbox.dispatch_error', { error: String(e) })));
    }
    return json({ status: result.status });
  } catch (err) {
    return errorResponse(err);
  }
}
