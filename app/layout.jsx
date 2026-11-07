import './globals.css';
import RequestModalProvider from './components/RequestModal/RequestModal';
import { getSiteUrl } from './lib/server-public-data';

const siteUrl = getSiteUrl();
export const metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: 'Уралмаш ГОО',
  description: 'Проектирование, изготовление и продажа дробильно-сортировочного оборудования и обогатительных линий.',
  openGraph: { siteName: 'Уралмаш ГОО', locale: 'ru_RU', type: 'website' },
};

export default function RootLayout({ children }) {
  return <html lang="ru"><body><RequestModalProvider>{children}</RequestModalProvider></body></html>;
}
