import { z } from 'zod';
import { getConfig } from '@/lib/config';
import { errorResponse, hasBearer, json, unauthorized } from '@/lib/http';
import { fetchUndeliveredOutbox, markOutboxDelivered } from '@/lib/money/outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Polling interface for the WhatsApp service (the alternative to the OUTBOX_WEBHOOK_URL push).
 *   GET  /api/outbox?limit=50   -> undelivered events, oldest first
 *   POST /api/outbox  { ids }   -> acknowledge (mark delivered) after the message was sent
 * Delivery is at-least-once: de-duplicate on event `id`.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const config = getConfig();
    if (!hasBearer(req, config.BOT_API_TOKEN)) return unauthorized();
    const limit = z.coerce.number().int().min(1).max(500).catch(50).parse(new URL(req.url).searchParams.get('limit') ?? 50);
    return json({ events: await fetchUndeliveredOutbox(limit) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const config = getConfig();
    if (!hasBearer(req, config.BOT_API_TOKEN)) return unauthorized();
    const { ids } = z.object({ ids: z.array(z.string().regex(/^\d+$/)).min(1).max(500) }).parse(await req.json());
    return json({ delivered: await markOutboxDelivered(ids) });
  } catch (err) {
    return errorResponse(err);
  }
}
