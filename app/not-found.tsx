import Link from 'next/link';
import SiteHeader from './components/SiteHeader/SiteHeader';
import SiteFooter from './components/SiteFooter/SiteFooter';
import styles from './not-found.module.css';

export const metadata = { title: 'Страница не найдена · Уралмаш ГОО' };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className={styles['not-found']}>
        <div className={styles['not-found__content']}>
          <span className={styles['not-found__code']} aria-hidden="true">404</span>
          <h1>Страница не найдена</h1>
          <p>Возможно, она была удалена или адрес указан неверно.</p>
          <Link className={styles['not-found__link']} href="/">На главную</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
