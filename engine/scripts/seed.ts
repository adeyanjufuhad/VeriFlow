/**
 * Demo data: "Mama Ngozi" with a ₦500,000 credit limit and ₦450,000 already drawn for stock,
 * so the first ₦5,000 payment visibly splits ₦500 to her loan / ₦4,500 to her wallet.
 * Safe to run twice (idempotent).   npm run seed
 */
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../db/client';
import { creditLines } from '../db/schema';
import { getSystemAccountId, getTraderAccountIds, postEntry } from '../lib/ledger';
import { formatNaira, nairaToKobo } from '../lib/money/kobo';
import { createTrader } from '../lib/money/traders';

async function main() {
  const trader = await createTrader({ name: 'Mama Ngozi', phone: process.env.SEED_PHONE ?? '08031234567', businessType: 'food staples' });
  const limit = nairaToKobo('500000');
  const drawn = nairaToKobo('450000');
  await getDb().update(creditLines).set({ limitKobo: limit }).where(eq(creditLines.traderId, trader.id));

  const accounts = await getTraderAccountIds(trader.id);
  const [pending, clearing] = await Promise.all([getSystemAccountId('payouts_pending'), getSystemAccountId('provider_clearing')]);
  // History: an earlier supplier drawdown, approved and paid out.
  await postEntry({
    idempotencyKey: `seed:${trader.id}:drawdown-approved`,
    kind: 'drawdown_approved',
    traderId: trader.id,
    postings: [
      { accountId: accounts.loan, direction: 'debit', amountKobo: drawn },
      { accountId: pending, direction: 'credit', amountKobo: drawn },
    ],
  });
  await postEntry({
    idempotencyKey: `seed:${trader.id}:drawdown-paid`,
    kind: 'drawdown_paid',
    traderId: trader.id,
    postings: [
      { accountId: pending, direction: 'debit', amountKobo: drawn },
      { accountId: clearing, direction: 'credit', amountKobo: drawn },
    ],
  });

  console.log(`Seeded ${trader.name}`);
  console.log(`  trader id        ${trader.id}`);
  console.log(`  virtual account  ${trader.virtualAccountNumber} (${trader.virtualAccountBank})`);
  console.log(`  credit limit     ${formatNaira(limit)}, owes ${formatNaira(drawn)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
