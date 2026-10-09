import { z } from 'zod';
import { getConfig } from '@/lib/config';
import { errorResponse, hasBearer, json, unauthorized } from '@/lib/http';
import { getBalances } from '@/lib/ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Balances for the dashboard (staff token) or the bot (bot token). All amounts are kobo strings. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const config = getConfig();
    if (!hasBearer(req, config.STAFF_API_TOKEN, config.BOT_API_TOKEN)) return unauthorized();
    const { id } = await ctx.params;
    const traderId = z.uuid().parse(id);
    return json({ traderId, ...(await getBalances(traderId)) });
  } catch (err) {
    return errorResponse(err);
  }
}
