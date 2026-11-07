'use client';

import SiteFooterStyles from './SiteFooter.module.css';
import { useEffect, useState } from 'react';
import { publicApi } from '../../lib/api';
import SocialLinks from '../SocialLinks/SocialLinks';
const defaultPhone = '+7 (922) 150-23-11';

export type ContactRecord = {
  id: number;
  title?: string;
  payload?: {
    phone?: string;
    email?: string;
    address?: string;
    workHours?: string;
    max?: string;
    vk?: string;
    telegram?: string;
    legalName?: string;
    inn?: string;
    ogrn?: string;
    legalAddress?: string;
  };
};

export default function SiteFooter({ initialContacts }: { initialContacts?: ContactRecord[] }) {
  const [contacts, setContacts] = useState<ContactRecord[]>(initialContacts || []);

  useEffect(() => {
    if (initialContacts !== undefined) return;
    const controller = new AbortController();

    fetch(`${publicApi}/contacts`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить контакты.');
        return response.json();
      })
      .then((rows: ContactRecord[]) => {
        setContacts(Array.isArray(rows)
          ? rows.filter((row) => Boolean(
            row.payload?.phone?.trim()
            || row.payload?.email?.trim()
            || row.payload?.address?.trim()
            || row.payload?.workHours?.trim()
            || row.payload?.max?.trim()
            || row.payload?.vk?.trim()
            || row.payload?.telegram?.trim()
            || row.payload?.legalName?.trim()
            || row.payload?.inn?.trim()
            || row.payload?.ogrn?.trim()
            || row.payload?.legalAddress?.trim(),
          ))
          : []);
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== 'AbortError') setContacts([]);
      });

    return () => controller.abort();
  }, [initialContacts]);

  const hasManagedPhone = contacts.some((contact) => Boolean(contact.payload?.phone?.trim()));

  return (
    <footer className={SiteFooterStyles["site-footer"]} id="contacts" aria-labelledby="site-footer-heading">
      <div className={SiteFooterStyles["site-footer__inner"]}>
        <div className={SiteFooterStyles["site-footer__main"]}>
          <div className={SiteFooterStyles["site-footer__brand"]}>
            <a className={SiteFooterStyles["site-footer__brand-link"]} href="/" aria-label="Уралмаш ГОО — главная">
              <img src="/logo-reference.png" alt="" width="64" height="64" />
              <span id="site-footer-heading">Уралмаш ГОО</span>
            </a>
            <p>Проектирование, изготовление и продажа оборудования и линий для горно-обогатительной отрасли.</p>
          </div>

          <nav className={SiteFooterStyles["site-footer__nav"]} aria-label="Навигация в подвале">
            <h2>Разделы</h2>
            <ul>
              <li><a href="/catalog">Оборудование</a></li>
              <li><a href="/services">Направления</a></li>
              <li><a href="/works/">Проекты</a></li>
              <li><a href="/about">О компании</a></li>
              <li><a href="/contacts">Контакты</a></li>
              <li><a href="/privacy-policy">Политика обработки персональных данных</a></li>
            </ul>
          </nav>

          <div className={SiteFooterStyles["site-footer__directions"]}>
            <h2>Оборудование</h2>
            <ul>
              <li>Дробилки</li>
              <li>Грохоты</li>
              <li>Мельницы</li>
              <li>Сепарационное оборудование</li>
              <li>Питатели</li>
            </ul>
          </div>

          <div className={SiteFooterStyles["site-footer__contacts"]}>
            <h2>Связаться с нами</h2>
            <p>Обсудите проектирование, изготовление или поставку оборудования.</p>
            <address>
              {!hasManagedPhone && <a className={"site-footer__phone"} href="tel:+79221502311">{defaultPhone}</a>}
              {contacts.map((contact) => {
                const payload = contact.payload || {};
                return (
                  <div className={SiteFooterStyles["site-footer__contact-entry"]} key={contact.id}>
                    {contact.title?.trim() && <strong>{contact.title.trim()}</strong>}
                    {payload.phone?.trim() && (
                      <a className={"site-footer__phone"} href={`tel:${payload.phone.trim().replace(/[^\d+]/g, '')}`}>
                        {payload.phone.trim()}
                      </a>
                    )}
                    {payload.email?.trim() && <a href={`mailto:${payload.email.trim()}`}>{payload.email.trim()}</a>}
                    {payload.address?.trim() && <span>{payload.address.trim()}</span>}
                    {payload.workHours?.trim() && <span>Режим работы: {payload.workHours.trim()}</span>}
                  </div>
                );
              })}
            </address>
            <SocialLinks contacts={contacts} />
          </div>
        </div>

        {contacts.map((contact) => {
          const { legalName, inn, ogrn, legalAddress } = contact.payload || {};
          if (![legalName, inn, ogrn, legalAddress].some((value) => value?.trim())) return null;
          return (
            <div className={SiteFooterStyles["site-footer__legal"]} key={contact.id}>
              {legalName?.trim() && <span>{legalName.trim()}</span>}
              {inn?.trim() && <span>ИНН {inn.trim()}</span>}
              {ogrn?.trim() && <span>ОГРН {ogrn.trim()}</span>}
              {legalAddress?.trim() && <span>Юридический адрес: {legalAddress.trim()}</span>}
            </div>
          );
        })}

        <div className={SiteFooterStyles["site-footer__bottom"]}>
          <span>© {new Date().getFullYear()} Уралмаш ГОО</span>
          <a href="/">На главную</a>
          <a className={SiteFooterStyles["site-footer__credit"]} href="https://chertezh-studio.ru/">
            Сделано в
            <img src="/chertezh-logo.png" alt="ЧЕРТЁЖ" width="150" height="34" />
          </a>
        </div>
      </div>
    </footer>
  );
}
