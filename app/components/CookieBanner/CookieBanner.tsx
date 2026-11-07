'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from './CookieBanner.module.css';

export default function CookieBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem('cookie-notice-dismissed') !== '1');
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible || pathname === '/admin' || pathname.startsWith('/admin/')) return null;

  function dismiss() {
    try { localStorage.setItem('cookie-notice-dismissed', '1'); } catch {}
    setVisible(false);
  }

  return <aside className={styles.banner} aria-label="Уведомление о файлах cookie">
    <p>На сайте используются файлы cookie и подключён сервис для веб-мастеров. Подробнее — в <a href="/privacy-policy">политике обработки персональных данных</a>.</p>
    <button type="button" onClick={dismiss}>Понятно</button>
  </aside>;
}
