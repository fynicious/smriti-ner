// @ts-check
import withPWAInit from 'next-pwa';
import defaultRuntimeCache from 'next-pwa/cache.js';

const runtimeCaching = defaultRuntimeCache.map((entry) => {
  if (entry?.options?.cacheName === 'apis') {
    return {
      urlPattern: /\/api\/.*/i,
      handler: 'NetworkOnly',
      options: {},
    };
  }
  return entry;
});

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching,
});

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com",
  "media-src 'self' data: blob:",
  "connect-src 'self' https://api.open-meteo.com",
  "font-src 'self' data:",
  "frame-ancestors 'self'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, no-cache, must-revalidate' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self)' },
          { key: 'Content-Security-Policy', value: cspDirectives },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
