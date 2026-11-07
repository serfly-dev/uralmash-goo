import { publicMetadata } from '../../lib/seo';
import { notFound } from 'next/navigation';
import SiteHeader from '../../components/SiteHeader/SiteHeader';
import WorkDetail, { type WorkRecord } from '../../components/WorkDetail/WorkDetail';
import { assertPublicDataAvailable, getServerPublicData } from '../../lib/server-public-data';

export const dynamic = 'force-dynamic';

async function loadWorks() {
  return getServerPublicData<WorkRecord[]>('/works');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await loadWorks();
  assertPublicDataAvailable(result, 'works');
  const work = result.data?.find((item) => item.slug === slug);
  if (!work) notFound();
  const title = work ? `${work.title} · Проекты Уралмаш ГОО` : 'Проект · Уралмаш ГОО';
  const description = work?.payload?.description?.trim() || 'Описание проекта и изготовленного оборудования Уралмаш ГОО.';
  return publicMetadata(title, description, `/works/${encodeURIComponent(slug)}`);
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await loadWorks();
  assertPublicDataAvailable(result, 'works');
  const work = result.data!.find((item) => item.slug === slug) || null;
  if (!work) notFound();
  return <><SiteHeader /><WorkDetail slug={slug} initialWork={work} initialError={!result.data && result.status !== 200} /></>;
}
