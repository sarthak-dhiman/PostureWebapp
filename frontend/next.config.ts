import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is default in Next.js 16. This silences the warning when
  // running with a webpack config absent. File-change polling in Docker
  // is handled via TURBOPACK_DISABLE_FSNOTIFY=1 in docker-compose.yml
  turbopack: {},
};

export default nextConfig;
