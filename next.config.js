/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  }
}

module.exports = nextConfig