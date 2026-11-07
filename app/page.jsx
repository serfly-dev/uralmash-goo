import { publicMetadata } from './lib/seo';
import HomePageContent from './components/HomePageContent/HomePageContent';
import { getServerPublicData } from './lib/server-public-data';

export const metadata = publicMetadata('Уралмаш ГОО — горно-обогатительное оборудование', 'Проектирование, изготовление и продажа оборудования и линий для горно-обогатительной отрасли.', '');

export default async function Home() {
  const [products, categories, reviews, works, contacts] = await Promise.all([
    getServerPublicData('/products'),
    getServerPublicData('/categories'),
    getServerPublicData('/reviews'),
    getServerPublicData('/works'),
    getServerPublicData('/contacts'),
  ]);
  return <HomePageContent
    featuredProducts={products.data || []}
    categories={categories.data || []}
    reviews={reviews.data || []}
    works={works.data || []}
    contacts={contacts.data || []}
  />;
}
