import type { MetadataRoute } from 'next';
import { getSiteUrl } from './lib/server-public-data';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api', '/api/'] },
    ...(siteUrl ? { sitemap: `${siteUrl}/sitemap.xml` } : {}),
  };
}
