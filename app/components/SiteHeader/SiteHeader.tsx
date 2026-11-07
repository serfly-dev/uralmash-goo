'use client';

import SiteHeaderStyles from './SiteHeader.module.css';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export const siteNavigation = [
  ['Главная', '/'],
  ['Каталог', '/catalog'],
  ['Направления', '/services'],
  ['Проекты', '/works/'],
  ['О компании', '/about'],
  ['Контакты', '/contacts'],
] as const;

type SiteHeaderProps = {
  visible?: boolean;
};

const SiteHeader = forwardRef<HTMLElement, SiteHeaderProps>(function SiteHeader({ visible = true }, ref) {
  const pathname = usePathname() || '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };
    const desktopQuery = window.matchMedia('(min-width: 1025px)');
    document.addEventListener('keydown', closeOnEscape);
    desktopQuery.addEventListener('change', closeOnDesktop);

    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      desktopQuery.removeEventListener('change', closeOnDesktop);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!visible) setMenuOpen(false);
  }, [visible]);

  return (
    <header
      ref={ref}
      className={[SiteHeaderStyles["continuation-header"], visible ? "continuation-header--visible" + " " + SiteHeaderStyles["continuation-header--visible"] : ''].filter(Boolean).join(' ')}
      aria-hidden={!visible}
      inert={!visible}
    >
      <a className={"hero-brand" + " " + SiteHeaderStyles["hero-brand"]} href="/" aria-label="Уралмаш ГОО — главная">
        <img src="/logo-reference.png" alt="" />
      </a>
      <nav className={SiteHeaderStyles["continuation-header__nav"]} aria-label="Основная навигация">
        {siteNavigation.map(([label, href]) => {
          const path = href === '/' ? '/' : href.replace(/\/$/, '');
          const active = path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
          return <a href={href} key={label} aria-current={active ? 'page' : undefined}>{label}</a>;
        })}
      </nav>
      <button
        ref={menuButtonRef}
        className={SiteHeaderStyles["continuation-header__menu-toggle"]}
        type="button"
        aria-expanded={menuOpen}
        aria-controls="site-mobile-navigation"
        aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      <nav
        id="site-mobile-navigation"
        className={[SiteHeaderStyles["continuation-header__mobile-nav"], menuOpen ? SiteHeaderStyles["continuation-header__mobile-nav--open"] : ''].filter(Boolean).join(' ')}
        aria-label="Основная навигация"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        {siteNavigation.map(([label, href]) => {
          const path = href === '/' ? '/' : href.replace(/\/$/, '');
          const active = path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
          return <a href={href} key={label} aria-current={active ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{label}</a>;
        })}
      </nav>
      <a className={SiteHeaderStyles["continuation-header__phone"]} href="tel:+79221502311">+7 (922) 150-23-11</a>
    </header>
  );
});

export default SiteHeader;
