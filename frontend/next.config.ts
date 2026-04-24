import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is default in Next.js 16. This silences the warning when
  // running with a webpack config absent. File-change polling in Docker
  // is handled via TURBOPACK_DISABLE_FSNOTIFY=1 in docker-compose.yml
  turbopack: {},
  async rewrites() {
    const apiBaseUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    return [
      {
        source: '/api/v1/:path*',
        // Append a trailing slash so Django APPEND_SLASH doesn't issue a 301 redirect
        // which conflicts with Next.js stripping trailing slashes via 308 redirects.
        destination: `${apiBaseUrl}/api/v1/:path*/`,
      },
    ];
  },
};

export default nextConfig;
