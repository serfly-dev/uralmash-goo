import { isIP } from 'node:net';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiOrigin } from '../lib/api';
import AdminDashboard from './dashboard';

export const dynamic = 'force-dynamic';

function isLoopbackHost(host) {
  const value = host.replace(/^\[|\]$/g, '').toLowerCase();
  return value === 'localhost' || value === '::1' || (isIP(value) === 4 && Number(value.split('.')[0]) === 127);
}

export default async function AdminPage() {
  const cookieStore = await cookies();
  const adminSession = cookieStore.get('uralgoo_admin');
  const cookieHeader = adminSession ? `uralgoo_admin=${encodeURIComponent(adminSession.value)}` : '';
  let account;
  try {
    const configuredOrigin = process.env.API_INTERNAL_URL || apiOrigin || 'http://localhost:4000';
    const internalApi = new URL(configuredOrigin);
    const validOrigin = ['http:', 'https:'].includes(internalApi.protocol)
      && !internalApi.username && !internalApi.password
      && internalApi.pathname === '/' && !internalApi.search && !internalApi.hash;
    if (!validOrigin || (process.env.NODE_ENV === 'production' && internalApi.protocol !== 'https:' && !isLoopbackHost(internalApi.hostname))) {
      throw new Error('API_INTERNAL_URL must be an HTTPS origin or a loopback URL in production.');
    }
    const response = await fetch(`${internalApi.origin}/api/auth/me`, {
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
