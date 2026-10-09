import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Native/server-only packages must not be bundled into route handlers.
  serverExternalPackages: ['postgres', '@node-rs/argon2'],
  // The monorepo root has its own lockfile; pin Turbopack to this package.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
