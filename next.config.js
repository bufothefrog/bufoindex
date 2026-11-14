// Security headers sent with every response: pages, static files and the
// not-found page. The Content-Security-Policy sets only directives that need
// no list of script or style sources; a script-src policy would have to
// allow the inline theme and RSC payload scripts and is not set here.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Nothing in the app uses next/image. Turning the optimizer off keeps the
  // unused /_next/image endpoint, which recent advisories target, from
  // being served.
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
