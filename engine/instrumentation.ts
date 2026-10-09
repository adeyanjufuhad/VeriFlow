/** Runs once when the Next.js server boots: fail fast on unsafe configuration (e.g. live payment keys). */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getConfig } = await import('./lib/config');
    getConfig();
  }
}
