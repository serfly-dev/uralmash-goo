import { publicMetadata } from '../lib/seo';
import ServicesPage, { type ServiceRecord } from '../components/ServicesPage/ServicesPage';
import { assertPublicDataAvailable, getServerPublicData } from '../lib/server-public-data';
import type { ProductRecord, ProductCategory } from '../components/ProductCard/ProductCard';
import type { WorkRecord } from '../components/WorksShowcase/WorksShowcase';
import type { ContactRecord } from '../components/SiteFooter/SiteFooter';

export const dynamic = 'force-dynamic';

export const metadata = publicMetadata('Направления | Уралмаш ГОО', 'Проектирование, изготовление и продажа оборудования, дробильно-сортировочных и обогатительных линий.', '/services');

export default async function ServicesRoute() {
  const [services, products, categories, works, contacts] = await Promise.all([
    getServerPublicData<ServiceRecord[]>('/services'),
    getServerPublicData<ProductRecord[]>('/products'),
    getServerPublicData<ProductCategory[]>('/categories'),
    getServerPublicData<WorkRecord[]>('/works'),
    getServerPublicData<ContactRecord[]>('/contacts'),
  ]);
  assertPublicDataAvailable(services, 'services');
  return <ServicesPage initialServices={services.data || []} initialError={!services.data && services.status !== 200} initialProducts={products.data || []} initialCategories={categories.data || []} initialWorks={works.data || []} initialContacts={contacts.data || []} />;
}
