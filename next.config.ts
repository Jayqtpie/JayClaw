import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Prevent Next from picking the monorepo root when tracing server files.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
