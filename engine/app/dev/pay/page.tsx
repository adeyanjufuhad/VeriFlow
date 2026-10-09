import { desc } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { outboxEvents, traders } from '@/db/schema';
import { devPagesEnabled, getConfig } from '@/lib/config';
import { safeEqual } from '@/lib/http';
import { getBalances } from '@/lib/ledger';
import { formatNaira, nairaToKobo } from '@/lib/money/kobo';
import { createTrader } from '@/lib/money/traders';
import { ingestProviderEvent } from '@/lib/money/webhooks';
import { getProvider } from '@/lib/payments';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

/**
 * UNSTYLED TEST PAGE (Teammate 3 builds the real UI). Lets you create a demo trader and "pay" her virtual
 * account through the same code path as a real webhook, then see the split, balances and queued WhatsApp events.
 */

async function createDemoTrader(formData: FormData) {
  'use server';
  if (!devPagesEnabled()) notFound();
  let msg: string;
  try {
    const trader = await createTrader({ name: String(formData.get('name') ?? ''), phone: String(formData.get('phone') ?? '') });
    msg = `Trader ready. Virtual account ${trader.virtualAccountNumber} (${trader.virtualAccountBank})`;
  } catch (e) {
    msg = `Could not create trader: ${e instanceof Error ? e.message : 'error'}`;
  }
  redirect(`/dev/pay?msg=${encodeURIComponent(msg)}`);
}

async function pay(formData: FormData) {
  'use server';
  if (!devPagesEnabled()) notFound();
  const config = getConfig();
  let msg: string;
  const token = String(formData.get('token') ?? '');
  if (!config.DEMO_ADMIN_TOKEN || !safeEqual(token, config.DEMO_ADMIN_TOKEN)) {
    msg = 'Wrong demo admin token';
  } else {
    try {
      const amountKobo = nairaToKobo(String(formData.get('amount') ?? ''));
      const result = await ingestProviderEvent({
        type: 'charge.success',
        provider: getProvider().name,
        eventId: `charge.success:sim_${randomUUID()}`,
        amountKobo,
        virtualAccountNumber: String(formData.get('account') ?? ''),
        reference: null,
        payerName: 'Dev page customer',
        paidAt: new Date(),
      });
      msg = `Payment of ${formatNaira(amountKobo)}: ${result.status}`;
    } catch (e) {
      msg = `Payment failed: ${e instanceof Error ? e.message : 'error'}`;
    }
  }
  redirect(`/dev/pay?msg=${encodeURIComponent(msg)}`);
}

export default async function PayPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  if (!devPagesEnabled()) notFound();
  const { msg } = await searchParams;
  const db = getDb();
  const all = await db.select().from(traders).orderBy(desc(traders.createdAt)).limit(20);
  const rows = await Promise.all(all.map(async (t) => ({ trader: t, balances: await getBalances(t.id) })));
  const events = await db.select().from(outboxEvents).orderBy(desc(outboxEvents.id)).limit(8);

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 760, margin: '1rem auto', padding: '0 1rem' }}>
      <h1>Dev: pay a trader</h1>
      <p>
        Provider: <b>{getProvider().name}</b>. This is a test page, not the real UI.
      </p>
      {msg ? <p style={{ background: '#eef', padding: 8 }}>{msg}</p> : null}

      <h2>1. Create a trader</h2>
      <form action={createDemoTrader}>
        <input name="name" placeholder="Name" defaultValue="Mama Ngozi" required />{' '}
        <input name="phone" placeholder="Phone e.g. 08031234567" defaultValue="08031234567" required />{' '}
        <button>Create</button>
      </form>

      <h2>2. Customer pays ₦X to this trader</h2>
      <form action={pay}>
        <select name="account" required>
          {all.map((t) => (
            <option key={t.id} value={t.virtualAccountNumber ?? ''}>
              {t.name} · {t.virtualAccountNumber}
            </option>
          ))}
        </select>{' '}
        <input name="amount" placeholder="Naira, e.g. 5000" defaultValue="5000" required />{' '}
        <input name="token" type="password" placeholder="Demo admin token" required />{' '}
        <button>Pay</button>
      </form>

      <h2>Traders</h2>
      <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Trader</th>
            <th>Wallet</th>
            <th>Loan owed</th>
            <th>Savings</th>
            <th>Limit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ trader, balances }) => (
            <tr key={trader.id}>
              <td>{trader.name}</td>
              <td>{formatNaira(balances.walletKobo)}</td>
              <td>{formatNaira(balances.loanOutstandingKobo)}</td>
              <td>{formatNaira(balances.savingsKobo)}</td>
              <td>{formatNaira(balances.creditLimitKobo)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Latest outbox events (what the WhatsApp bot will send)</h2>
      <ul>
        {events.map((e) => (
          <li key={e.id.toString()}>
            #{e.id.toString()} <b>{e.type}</b> {e.deliveredAt ? '(delivered)' : '(waiting)'}
            <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(e.payload)}</pre>
          </li>
        ))}
      </ul>
    </main>
  );
}
