/**
 * Baseline security headers (docs/production-audit.md W2). The site has no
 * auth, cookies, iframes or third parties, so these are defense in depth.
 * No CSP is enforced yet: each page carries inline RSC/theme scripts, so a
 * hash-only policy is impossible and nonces would force dynamic rendering.
 */
const securityHeaders = [
  // Two years, no preload (preload is hard to undo).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Share and copy-link buttons use the Web Share API and the clipboard, so
  // those two stay allowed for this origin; everything else is switched off.
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'browsing-topics=()',
      'clipboard-write=(self)',
      'web-share=(self)',
    ].join(', '),
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  poweredByHeader: false,
  // Keep `next dev` from auto-generating AGENTS.md at the repo root; CLAUDE.md
  // and docs/ are the agent guides for this project.
  agentRules: false,
  compiler: {
    // Strip debug logging in production but keep console.error / console.warn
    // so calculation, worker and rendering failures stay diagnosable
    // (docs/production-audit.md W3).
    removeConsole:
      process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // Nothing in the app uses next/image. Turning the optimizer off keeps the
  // unused /_next/image endpoint, which recent advisories target, from
  // being served.
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
