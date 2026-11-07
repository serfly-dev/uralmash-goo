import './admin.css';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Админ-панель · Уралмаш ГОО', robots: { index: false, follow: false } };

export default function AdminLayout({ children }) {
  return <div className="admin-root">{children}</div>;
}
