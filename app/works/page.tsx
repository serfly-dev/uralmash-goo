import { publicMetadata } from '../lib/seo';
import SiteHeader from '../components/SiteHeader/SiteHeader';
import WorksShowcase from '../components/WorksShowcase/WorksShowcase';
import type { WorkRecord } from '../components/WorksShowcase/WorksShowcase';
import { assertPublicDataAvailable, getServerPublicData } from '../lib/server-public-data';

export const dynamic = 'force-dynamic';

export const metadata = publicMetadata('Проекты · Уралмаш ГОО', 'Проекты по проектированию и изготовлению дробильно-сортировочного оборудования и обогатительных линий.', '/works');

export default async function WorksPage() {
  const result = await getServerPublicData<WorkRecord[]>('/works');
  assertPublicDataAvailable(result, 'works');
  return (
    <>
      <SiteHeader />
      <WorksShowcase mode="page" initialWorks={result.data} initialError={!result.data && result.status !== 200} />
    </>
  );
}
