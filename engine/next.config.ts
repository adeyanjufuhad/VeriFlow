import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native/server-only packages must not be bundled into route handlers.
  serverExternalPackages: ['postgres', '@node-rs/argon2'],
};

export default nextConfig;
