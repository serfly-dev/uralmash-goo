import { publicMetadata } from '../../../../lib/seo';
import { notFound } from 'next/navigation';
import ProductPageContent, { type ProductPageInitialData } from '../../../../components/ProductPageContent/ProductPageContent';
import type { FilterSpecification } from '../../../../components/CatalogPage/CatalogPage';
import { getProductImage, type ProductRecord, type ProductCategory } from '../../../../components/ProductCard/ProductCard';
import { assertPublicDataAvailable, getServerPublicData, getSiteUrl } from '../../../../lib/server-public-data';

export const dynamic = 'force-dynamic';

type ProductResponse = { product: ProductPageInitialData['product']; variant: ProductPageInitialData['variant'] };

async function loadProduct(productSlug: string, variantSlug: string): Promise<ProductPageInitialData | null> {
  const productPath = `/products/${encodeURIComponent(productSlug)}/variants/${encodeURIComponent(variantSlug)}`;
  const [productResult, categoriesResult, productsResult, specificationsResult] = await Promise.all([
    getServerPublicData<ProductResponse>(productPath),
    getServerPublicData<ProductCategory[]>('/categories'),
    getServerPublicData<ProductRecord[]>('/products'),
    getServerPublicData<FilterSpecification[]>('/specifications'),
  ]);
  if (productResult.status === 404) return null;
  assertPublicDataAvailable(productResult, 'product variant');
  return {
    ...productResult.data,
    categories: categoriesResult.data || [],
    products: productsResult.data || [],
    specifications: specificationsResult.data || [],
  };
}

export async function generateMetadata({ params }: { params: Promise<{ productSlug: string; variantSlug: string }> }) {
  const { productSlug, variantSlug } = await params;
  const data = await loadProduct(productSlug, variantSlug);
  if (!data) notFound();
  const title = data ? `${data.product.title}${data.variant.name ? ` — ${data.variant.name}` : ''} · Уралмаш ГОО` : 'Оборудование · Уралмаш ГОО';
  const description = data?.product.description?.trim() || 'Характеристики и варианты промышленного оборудования Уралмаш ГОО.';
  return publicMetadata(title, description, `/catalog/product/${encodeURIComponent(productSlug)}/${encodeURIComponent(variantSlug)}`);
}

export default async function ProductRoute({ params }: { params: Promise<{ productSlug: string; variantSlug: string }> }) {
  const { productSlug, variantSlug } = await params;
  const data = await loadProduct(productSlug, variantSlug);
  if (!data) notFound();
  const siteUrl = getSiteUrl();
  const image = getProductImage(data.product, data.variant);
  const imageUrl = siteUrl && image.startsWith('/media/') ? `${siteUrl}${image}` : image.startsWith('https://') ? image : undefined;
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${data.product.title}${data.variant.name ? ` — ${data.variant.name}` : ''}`,
    ...(data.product.description?.trim() ? { description: data.product.description.trim() } : {}),
    ...(imageUrl ? { image: imageUrl } : {}),
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, '\\u003c') }} />
    <ProductPageContent productSlug={productSlug} variantSlug={variantSlug} initialData={data} />
  </>;
}
