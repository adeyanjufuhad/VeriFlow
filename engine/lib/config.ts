import { z } from 'zod';

/** Blank values in .env files (e.g. `STAFF_API_TOKEN=`) count as unset. */
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const flag = z
  .string()
  .optional()
  .transform((v) => (v ?? 'false').trim().toLowerCase() === 'true');

const intWithDefault = (def: number, min: number, max: number) =>
  z.preprocess((v) => (v === undefined || v === '' ? def : Number(v)), z.number().int().min(min).max(max));

const koboWithDefault = (def: bigint) =>
  z.preprocess(
    (v) => (v === undefined || v === '' ? def : /^\d+$/.test(String(v)) ? BigInt(String(v)) : v),
    z.bigint().nonnegative(),
  );

const ConfigSchema = z.object({
  DATABASE_URL: optionalString,
  PAYMENT_PROVIDER: z.enum(['mock', 'paystack']).default('mock'),
  PAYSTACK_SECRET_KEY: optionalString,
  ALLOW_LIVE_KEYS: flag,
  APP_URL: z.string().default('http://localhost:3000'),
  DEMO_ADMIN_TOKEN: optionalString,
  CRON_SECRET: optionalString,
  STAFF_API_TOKEN: optionalString,
  /** Token for the WhatsApp bot / AI service calling our service routes. */
  BOT_API_TOKEN: optionalString,
  PIN_PEPPER: optionalString,
  DRAWDOWN_FEE_BPS: intWithDefault(100, 0, 10_000),
  DEFAULT_SWEEP_RATE_BPS: intWithDefault(1000, 0, 10_000),
  SWEEP_BUFFER_KOBO: koboWithDefault(0n),
  /** Optional push of outbox events to the WhatsApp service. */
  OUTBOX_WEBHOOK_URL: optionalString,
  OUTBOX_WEBHOOK_SECRET: optionalString,
  /** Enables the unstyled /dev test pages. Always on outside production. */
  ENABLE_DEV_PAGES: flag,
  MOCK_WEBHOOK_SECRET: z.string().default('mock-webhook-secret'),
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Parses an env object. Pure, so tests can pass their own. Refuses live payment keys (rule 10). */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ConfigError(`Invalid environment: ${issue?.path.join('.')} ${issue?.message}`);
  }
  const config = parsed.data;
  if (config.PAYSTACK_SECRET_KEY?.startsWith('sk_live_') && !config.ALLOW_LIVE_KEYS) {
    throw new ConfigError('Refusing to start: a live Paystack key (sk_live_) is configured. Use a test key, or set ALLOW_LIVE_KEYS=true deliberately.');
  }
  if (config.PAYMENT_PROVIDER === 'paystack' && !config.PAYSTACK_SECRET_KEY) {
    throw new ConfigError('PAYMENT_PROVIDER=paystack requires PAYSTACK_SECRET_KEY');
  }
  return config;
}

export const getConfig = (): Config => loadConfig(process.env);

export function devPagesEnabled(config: Config = getConfig()): boolean {
  return config.ENABLE_DEV_PAGES || process.env.NODE_ENV !== 'production';
}
