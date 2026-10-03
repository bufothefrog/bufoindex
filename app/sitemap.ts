import type { MetadataRoute } from 'next';

const BASE_URL = 'https://bufoindex.com';

export default function sitemap(): MetadataRoute.Sitemap {
  // /demo stays publicly reachable as a component catalog, but it is a
  // developer surface rather than a page worth submitting to search engines.
  // The guided-flow steps (/start, /start/choose, /start/<intent>) and
  // /overview are left out too: they set robots noindex, depend on answers
  // saved in the visitor's browser, and the landing page links into them.
  const routes = [
    '/',
    '/tools',
    '/tools/paycheck-allocator',
    '/tools/retirement-calculator',
    '/tools/retirement-calculator/methodology',
    '/tools/portfolio-rebalancing-calculator',
    '/tools/leverage-comparison',
  ];

  // `lastModified` is omitted rather than hardcoded: a frozen date goes stale
  // on the first content change, and self-reported values carry little weight.
  return routes.map((route) => ({
    url: `${BASE_URL}${route === '/' ? '' : route}`,
  }));
}
