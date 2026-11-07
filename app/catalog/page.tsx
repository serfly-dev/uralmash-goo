import { publicMetadata } from '../lib/seo';
import CatalogPage, { type CatalogInitialData } from '../components/CatalogPage/CatalogPage';
import { getProductImage } from '../components/ProductCard/ProductCard';
import { assertPublicDataAvailable, getServerPublicData } from '../lib/server-public-data';

export const dynamic = 'force-dynamic';

export const metadata = publicMetadata('Каталог оборудования · Уралмаш ГОО', 'Каталог дробильно-сортировочного и обогатительного оборудования Уралмаш ГОО.', '/catalog');

export default async function CatalogRoute() {
  const [products, categories, specifications] = await Promise.all([
    getServerPublicData<CatalogInitialData['products']>('/products'),
    getServerPublicData<CatalogInitialData['categories']>('/categories'),
    getServerPublicData<CatalogInitialData['specifications']>('/specifications'),
  ]);
  assertPublicDataAvailable(products, 'catalog products');
  const initialData: CatalogInitialData | undefined = products.data ? {
    products: products.data.filter((product) => Boolean(getProductImage(product))),
    categories: categories.data || [],
    specifications: specifications.data || [],
  } : undefined;
  return <CatalogPage initialData={initialData} initialError={!products.data && products.status !== 200} />;
}
