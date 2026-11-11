/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Nothing in the app uses next/image. Turning the optimizer off keeps the
  // unused /_next/image endpoint, which recent advisories target, from
  // being served.
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
