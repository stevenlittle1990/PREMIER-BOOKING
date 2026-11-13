// After export: write sitemap.xml and robots.txt so search engines find every area and listing page.
import { readFileSync, writeFileSync } from 'node:fs';

const site = (process.env.EXPO_PUBLIC_SITE_URL || process.env.URL || 'https://premier-booking.netlify.app').replace(/\/$/, '');
const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const paths = ['/', '/search', '/guides', ...catalog.areas.map((a) => `/areas/${a.slug}`),
  ...catalog.listings.map((l) => (l.kind === 'stay' ? `/stays/${l.slug}` : `/trips/${l.slug}`))];
const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${site}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
writeFileSync(new URL('../dist/sitemap.xml', import.meta.url), xml);
writeFileSync(new URL('../dist/robots.txt', import.meta.url),
  `User-agent: *\nAllow: /\nDisallow: /host\nDisallow: /account\nDisallow: /join\nDisallow: /guide/\nDisallow: /waiver\nDisallow: /sign-in\nSitemap: ${site}/sitemap.xml\n`);
console.log(`sitemap: ${paths.length} pages`);
