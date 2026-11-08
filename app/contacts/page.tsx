import { publicMetadata } from '../lib/seo';
import ContactsPageContent, { type ContactRecord } from '../components/ContactsPageContent/ContactsPageContent';
import { getServerPublicData } from '../lib/server-public-data';

export const metadata = publicMetadata('Контакты | Уралмаш ГОО', 'Контактные данные ООО «Уралмаш ГОО».', '/contacts');

export default async function ContactsPage() {
  const result = await getServerPublicData<ContactRecord[]>('/contacts');
  return <ContactsPageContent initialContacts={result.data || []} initialError={!result.data && result.status !== 200} />;
}
