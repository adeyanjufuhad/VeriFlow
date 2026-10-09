import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'node_modules/**', 'db/migrations/**', 'next-env.d.ts'] },
  {
    // Rule 8: the AI layer may only use the agent-safe surface of lib/money.
    files: ['lib/agents/**', '../lib/agents/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/lib/ledger/**', '**/lib/ledger', '**/lib/money/internal*', '**/lib/payments/**', '**/db/**'], message: 'Agents must not touch the ledger, payments or DB. Use lib/money (index) only.' },
          ],
        },
      ],
    },
  },
];

export default config;
