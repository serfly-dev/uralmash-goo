import './admin.css';

export const metadata = { title: 'Админ-панель · Уралмаш ГОО' };

export default function AdminLayout({ children }) {
  return <div className="admin-root">{children}</div>;
}
