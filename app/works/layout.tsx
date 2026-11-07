import type { ReactNode } from 'react';
import SiteFooter, { type ContactRecord } from '../components/SiteFooter/SiteFooter';
import { getServerPublicData } from '../lib/server-public-data';

export default async function WorksLayout({ children }: { children: ReactNode }) {
  const { data: contacts } = await getServerPublicData<ContactRecord[]>('/contacts');
  return (
    <>
      {children}
      <SiteFooter initialContacts={contacts || []} />
    </>
  );
}
