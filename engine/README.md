# VeriFlow financial engine

Double-entry ledger, payments, loan repayment split, supplier drawdowns. Next.js (TypeScript) + Postgres + Drizzle.
Full API contract for teammates: `docs/money-engine.md` (written in the last phase).

## Run it locally (no Docker, no Supabase needed)

```bash
cd engine
npm install
cp .env.example .env     # then set DATABASE_URL and the tokens (see below)
npm run dev:db           # terminal 1: local Postgres on :54329, applies migrations, leave running
npm run seed             # terminal 2: demo trader "Mama Ngozi" (limit ₦500,000, owes ₦450,000)
npm run dev              # terminal 2: http://localhost:3000
```

Minimal `.env` for local use:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:54329/veriflow
PAYMENT_PROVIDER=mock
DEMO_ADMIN_TOKEN=pick-a-long-random-value
STAFF_API_TOKEN=pick-a-long-random-value
BOT_API_TOKEN=pick-a-long-random-value
```

Then open <http://localhost:3000/dev/pay> to create a trader and pay her virtual account, or call the API:

```bash
curl -X POST localhost:3000/api/payments/simulate \
  -H 'content-type: application/json' -H 'x-demo-admin-token: <DEMO_ADMIN_TOKEN>' \
  -d '{"virtualAccountNumber":"<seeded account>","amountNaira":"5000"}'
```

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Vitest against a real embedded Postgres (needs no setup) |
| `npm run typecheck` / `npm run lint` | TypeScript strict check / ESLint |
| `npm run db:generate` | Generate a migration after editing `db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL_DIRECT` (or `DATABASE_URL`) |

## Money rules (enforced in code and tests)

All amounts are integer **kobo** (`bigint`). Every movement is a balanced journal entry; the ledger is append-only
(database triggers); balances are derived from postings; every entry has an idempotency key; per-trader row locks
stop overspending; PINs, BVN/NIN, account numbers and secrets never reach logs; live payment keys are refused.
