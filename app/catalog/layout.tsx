import type { ReactNode } from 'react';
import SiteFooter, { type ContactRecord } from '../components/SiteFooter/SiteFooter';
import SiteHeader from '../components/SiteHeader/SiteHeader';
import { getServerPublicData } from '../lib/server-public-data';

export default async function CatalogLayout({ children }: { children: ReactNode }) {
  const { data: contacts } = await getServerPublicData<ContactRecord[]>('/contacts');
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter initialContacts={contacts || []} />
    </>
  );
}
