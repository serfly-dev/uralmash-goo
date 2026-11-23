import AdminPage from '../../page';

export const dynamic = 'force-dynamic';

export default async function AdminProductPage({ params }) {
  const { id } = await params;
  return AdminPage({ productId: id });
}
