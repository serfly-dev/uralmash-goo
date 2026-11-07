import { publicMetadata } from '../lib/seo';
import AboutPageContent from '../components/AboutPageContent/AboutPageContent';
import { getServerPublicData } from '../lib/server-public-data';
import type { ProductRecord, ProductCategory } from '../components/ProductCard/ProductCard';
import type { WorkRecord } from '../components/WorksShowcase/WorksShowcase';
import type { ContactRecord } from '../components/SiteFooter/SiteFooter';

export const metadata = publicMetadata('О компании · Уралмаш ГОО', 'ООО «Уралмаш ГОО» проектирует, изготавливает и продаёт оборудование, дробильно-сортировочные и обогатительные линии.', '/about');

export default async function AboutPage() {
  const [products, categories, works, contacts] = await Promise.all([
    getServerPublicData<ProductRecord[]>('/products'),
    getServerPublicData<ProductCategory[]>('/categories'),
    getServerPublicData<WorkRecord[]>('/works'),
    getServerPublicData<ContactRecord[]>('/contacts'),
  ]);
  return <AboutPageContent featuredProducts={products.data || []} categories={categories.data || []} works={works.data || []} contacts={contacts.data || []} />;
}
