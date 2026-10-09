import { getConfig } from '../config';
import { ProviderError } from '../money/errors';
import { MockProvider } from './mock';
import type { PaymentProvider } from './types';

export * from './types';
export { MockProvider, MOCK_SIGNATURE_HEADER, signMockBody } from './mock';

let cached: { key: string; provider: PaymentProvider } | undefined;

/** Chosen by PAYMENT_PROVIDER. The Paystack implementation arrives in Phase 3. */
export function getProvider(): PaymentProvider {
  const config = getConfig();
  const key = `${config.PAYMENT_PROVIDER}:${config.MOCK_WEBHOOK_SECRET}`;
  if (cached?.key === key) return cached.provider;

  let provider: PaymentProvider;
  switch (config.PAYMENT_PROVIDER) {
    case 'mock':
      provider = new MockProvider(config.MOCK_WEBHOOK_SECRET);
      break;
    case 'paystack':
      throw new ProviderError('The Paystack provider is not implemented yet (Phase 3). Use PAYMENT_PROVIDER=mock.');
  }
  cached = { key, provider };
  return provider;
}
