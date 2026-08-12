import type { MetadataRoute } from 'next';

const BASE_URL = 'https://bufoindex.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '/',
    '/tools/paycheck-allocator',
    '/tools/retirement-calculator',
    '/tools/retirement-calculator/methodology',
    '/tools/portfolio-rebalancing-calculator',
    '/demo',
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route === '/' ? '' : route}`,
    lastModified: '2026-08-12',
  }));
}
