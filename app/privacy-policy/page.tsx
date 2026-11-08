import SiteHeader from '../components/SiteHeader/SiteHeader';
import SiteFooter from '../components/SiteFooter/SiteFooter';
import { getServerPublicData } from '../lib/server-public-data';
import { publicMetadata } from '../lib/seo';
import styles from './privacy-policy.module.css';

export const metadata = publicMetadata('Политика обработки персональных данных | Уралмаш ГОО', 'Политика обработки персональных данных ООО «Уралмаш ГОО».', '/privacy-policy');

export default async function PrivacyPolicyPage() {
  const result = await getServerPublicData<{ text: string }>('/privacy-policy');
  return <>
    <SiteHeader />
    <main className={styles.page}>
      <h1>Политика обработки персональных данных</h1>
      {result.data?.text ? <div className={styles.text}>{result.data.text}</div> : <p>{result.status === 200 ? 'Текст политики пока не опубликован.' : 'Не удалось загрузить текст политики. Попробуйте позже.'}</p>}
    </main>
    <SiteFooter />
  </>;
}
