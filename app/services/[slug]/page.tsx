import { publicMetadata } from '../../lib/seo';
import { notFound } from 'next/navigation';
import ServicesPage, { type ServiceRecord } from '../../components/ServicesPage/ServicesPage';
import { assertPublicDataAvailable, getServerPublicData } from '../../lib/server-public-data';
import type { ProductRecord, ProductCategory } from '../../components/ProductCard/ProductCard';
import type { WorkRecord } from '../../components/WorksShowcase/WorksShowcase';
import type { ContactRecord } from '../../components/SiteFooter/SiteFooter';

export const dynamic = 'force-dynamic';

async function loadServices() {
  return getServerPublicData<ServiceRecord[]>('/services');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await loadServices();
  assertPublicDataAvailable(result, 'services');
  const service = result.data?.find((item) => item.slug === slug);
  if (!service) notFound();
  const title = service ? `${service.title} · Уралмаш ГОО` : 'Направление работы · Уралмаш ГОО';
  const description = service?.payload?.description?.trim() || 'Направления работы компании Уралмаш ГОО.';
  return publicMetadata(title, description, `/services/${encodeURIComponent(slug)}`);
}

export default async function ServiceDetailRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [result, products, categories, works, contacts] = await Promise.all([
    loadServices(),
    getServerPublicData<ProductRecord[]>('/products'),
    getServerPublicData<ProductCategory[]>('/categories'),
    getServerPublicData<WorkRecord[]>('/works'),
    getServerPublicData<ContactRecord[]>('/contacts'),
  ]);
  assertPublicDataAvailable(result, 'services');
  if (!result.data!.some((item) => item.slug === slug)) notFound();
  return <ServicesPage slug={slug} initialServices={result.data} initialError={!result.data && result.status !== 200} initialProducts={products.data || []} initialCategories={categories.data || []} initialWorks={works.data || []} initialContacts={contacts.data || []} />;
}
