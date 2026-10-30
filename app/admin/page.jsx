import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminDashboard from './dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(({ name, value }) => `${name}=${encodeURIComponent(value)}`).join('; ');
  let account;
  try {
    const response = await fetch('http://127.0.0.1:4000/api/auth/me', {
      headers: { cookie: cookieHeader }, cache: 'no-store',
    });
    if (!response.ok) redirect('/admin/login');
    account = await response.json();
  } catch (error) {
    if (error?.digest?.startsWith('NEXT_REDIRECT')) throw error;
    redirect('/admin/login');
  }
  return <AdminDashboard username={account.username} />;
}
