import type { MetadataRoute } from 'next';
import { assertPublicDataAvailable, getServerPublicData, getSiteUrl } from './lib/server-public-data';

export const dynamic = 'force-dynamic';

type Product = { slug: string; updatedAt?: string; variants?: Array<{ slug: string }> };
type PublishedContent = { slug: string; updated_at?: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  if (!siteUrl) throw new Error('A public HTTPS site origin is required to generate the sitemap.');
  const [products, services, works] = await Promise.all([
    getServerPublicData<Product[]>('/products'),
    getServerPublicData<PublishedContent[]>('/services'),
    getServerPublicData<PublishedContent[]>('/works'),
  ]);
  assertPublicDataAvailable(products, 'sitemap products');
  assertPublicDataAvailable(services, 'sitemap services');
  assertPublicDataAvailable(works, 'sitemap works');
  const fixedRoutes = ['', '/about', '/catalog', '/services', '/works', '/contacts', '/privacy-policy'];
  return [
    ...fixedRoutes.map((path) => ({ url: `${siteUrl}${path}`, changeFrequency: 'monthly' as const })),
    ...products.data!.flatMap((product) => (product.variants?.length ? product.variants : [{ slug: 'default' }]).map((variant) => ({
      url: `${siteUrl}/catalog/product/${encodeURIComponent(product.slug)}/${encodeURIComponent(variant.slug)}`,
      ...(product.updatedAt ? { lastModified: product.updatedAt } : {}),
      changeFrequency: 'monthly' as const,
    }))),
    ...services.data!.map((service) => ({
      url: `${siteUrl}/services/${encodeURIComponent(service.slug)}`,
      ...(service.updated_at ? { lastModified: service.updated_at } : {}),
      changeFrequency: 'monthly' as const,
    })),
    ...works.data!.map((work) => ({
      url: `${siteUrl}/works/${encodeURIComponent(work.slug)}`,
      ...(work.updated_at ? { lastModified: work.updated_at } : {}),
      changeFrequency: 'monthly' as const,
    })),
  ];
}
