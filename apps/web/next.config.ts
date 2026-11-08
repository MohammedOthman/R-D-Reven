import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Single-origin production deploy: when API_INTERNAL_URL is set, the web
// server proxies /api/* to the API process in the same container, so auth
// cookies stay host-only on one domain. Unset in local dev (web and API run
// on separate localhost ports and talk directly).
const apiInternalUrl = process.env.API_INTERNAL_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@revn/ui'],
  async rewrites() {
    if (!apiInternalUrl) return [];
    return [{ source: '/api/:path*', destination: `${apiInternalUrl}/:path*` }];
  },
};

export default withNextIntl(nextConfig);
