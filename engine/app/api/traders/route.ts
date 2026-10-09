import { getConfig } from '@/lib/config';
import { errorResponse, hasBearer, json, unauthorized } from '@/lib/http';
import { createTrader } from '@/lib/money/traders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Service route for the WhatsApp bot: create (or fetch, by phone) a trader and her virtual account.
 * Creating a trader moves no money, so the bot token is allowed to call it.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const config = getConfig();
    if (!hasBearer(req, config.BOT_API_TOKEN, config.STAFF_API_TOKEN)) return unauthorized();
    const trader = await createTrader(await req.json());
    return json({
      id: trader.id,
      name: trader.name,
      phone: trader.phone,
      virtualAccountNumber: trader.virtualAccountNumber,
      virtualAccountBank: trader.virtualAccountBank,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
