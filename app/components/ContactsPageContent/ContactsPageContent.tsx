'use client';

import ContactsPageContentStyles from './ContactsPageContent.module.css';
import { useEffect, useState } from 'react';
import SiteHeader from '../SiteHeader/SiteHeader';
import SiteFooter from '../SiteFooter/SiteFooter';
import { publicApi } from '../../lib/api';
import SocialLinks from '../SocialLinks/SocialLinks';

const knownAddress = 'екатеринбург машиностроителей 29';
const knownCoordinates = '60.5853705423277,56.8847347463588';

function getMapHref(address: string) {
  const normalized = address.toLocaleLowerCase('ru').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const matchesKnownLocation = normalized.includes(knownAddress)
    || (normalized.includes('екатеринбург')
      && normalized.includes('машиностроителей')
      && /(?:^|\s)29(?:\s|$)/.test(normalized));

  if (matchesKnownLocation) {
    return `https://yandex.ru/maps/?ll=${encodeURIComponent(knownCoordinates)}&z=17&pt=${encodeURIComponent(`${knownCoordinates},pm2rdm`)}`;
  }

  return `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`;
}

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

export default function ContactsPage({ initialContacts, initialError = false }: { initialContacts?: ContactRecord[]; initialError?: boolean }) {
  const [contacts, setContacts] = useState<ContactRecord[]>(initialContacts || []);
  const [loaded, setLoaded] = useState(initialContacts !== undefined || initialError);
  const [loadError, setLoadError] = useState(initialError);

  useEffect(() => {
    if (initialContacts !== undefined || initialError) return;
    const controller = new AbortController();

    fetch(`${publicApi}/contacts`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить контакты.');
        return response.json();
      })
      .then((rows: ContactRecord[]) => {
        setContacts(Array.isArray(rows) ? rows.filter((row) => Boolean(
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
        )) : []);
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== 'AbortError') setLoadError(true);
      })
      .finally(() => setLoaded(true));

    return () => controller.abort();
  }, [initialContacts, initialError]);

  const mapAddress = contacts.find((contact) => contact.payload?.address?.trim())?.payload?.address?.trim();
  const mapEmbedHref = mapAddress && getMapHref(mapAddress).replace('https://yandex.ru/maps/', 'https://yandex.ru/map-widget/v1/');

  return (
    <>
      <SiteHeader />
      <main className={ContactsPageContentStyles["contacts-page"]}>
        <section className={ContactsPageContentStyles["contacts-page__hero"]} aria-labelledby="contacts-page-title">
          <div className={ContactsPageContentStyles["contacts-page__hero-copy"]}>
            <p className={ContactsPageContentStyles["contacts-page__eyebrow"]}>Уралмаш ГОО</p>
            <h1 id="contacts-page-title">Контакты</h1>
          </div>
          <img
            className={ContactsPageContentStyles["contacts-page__hero-equipment"]}
            src="/contacts-crusher.webp"
            alt="Конусная дробилка для горно-обогатительного производства"
            width="1312"
            height="1199"
            fetchPriority="high"
          />
        </section>

        <section className={ContactsPageContentStyles["contacts-page__content"]} aria-label="Контактные данные компании">
          <div className={ContactsPageContentStyles["contacts-page__layout"]}>
          <div className={ContactsPageContentStyles["contacts-page__information"]}>
          <div className={ContactsPageContentStyles["contacts-page__section-heading"]}>
            <h2>Свяжитесь с нами</h2>
            <p>Для консультаций, сотрудничества и запросов на продукцию Уралмаш ГОО</p>
          </div>
          {!loaded ? (
            <p className={ContactsPageContentStyles["contacts-page__status"]} role="status">Загружаем контактные данные…</p>
          ) : loadError ? (
            <p className={ContactsPageContentStyles["contacts-page__status"]} role="alert">Не удалось загрузить контакты. Попробуйте обновить страницу.</p>
          ) : contacts.length ? (
            <div className={ContactsPageContentStyles["contacts-page__details"]}>
              {contacts.map((contact) => {
                const payload = contact.payload || {};
                return (
                  <div className={ContactsPageContentStyles["contacts-page__group"]} key={contact.id}>
                    {contacts.length > 1 && contact.title?.trim() && <h2>{contact.title.trim()}</h2>}
                    <div className={ContactsPageContentStyles["contacts-page__items"]}>
                      {payload.phone?.trim() && (
                        <div className={ContactsPageContentStyles["contacts-page__item"]}>
                          <svg className={ContactsPageContentStyles["contacts-page__icon"]} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 2.8a2 2 0 0 1-.6 1.8L7.7 9.6a16 16 0 0 0 6.7 6.7l1.3-1.3a2 2 0 0 1 1.8-.6l2.8.5a2 2 0 0 1 1.7 2Z" /></svg>
                          <span>Телефон</span>
                          <a href={`tel:${payload.phone.trim().replace(/[^\d+]/g, '')}`}>{payload.phone.trim()}</a>
                        </div>
                      )}
                      {payload.email?.trim() && (
                        <div className={ContactsPageContentStyles["contacts-page__item"]}>
                          <svg className={ContactsPageContentStyles["contacts-page__icon"]} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 6 10 7L22 6" /></svg>
                          <span>Электронная почта</span>
                          <a href={`mailto:${payload.email.trim()}`}>{payload.email.trim()}</a>
                        </div>
                      )}
                      {payload.address?.trim() && (
                        <div className={ContactsPageContentStyles["contacts-page__item"]}>
                          <svg className={ContactsPageContentStyles["contacts-page__icon"]} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
                          <span>Адрес</span>
                          <address>{payload.address.trim()}</address>
                          <a
                            className={"contacts-page__map-link"}
                            href={getMapHref(payload.address.trim())}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Показать на карте
                          </a>
                        </div>
                      )}
                      {payload.workHours?.trim() && (
                        <div className={ContactsPageContentStyles["contacts-page__item"]}>
                          <svg className={ContactsPageContentStyles["contacts-page__icon"]} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                          <span>Режим работы</span>
                          <p>{payload.workHours.trim()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={ContactsPageContentStyles["contacts-page__status"]}>Контактные данные пока не опубликованы.</p>
          )}
          <div className={ContactsPageContentStyles["contacts-page__social"]}>
            <span>Социальные сети</span>
            <SocialLinks contacts={contacts} />
          </div>
          </div>
          {mapEmbedHref && (
            <div className={ContactsPageContentStyles["contacts-page__map"]}>
              <iframe src={mapEmbedHref} title={`Карта: ${mapAddress}`} loading="lazy" />
            </div>
          )}
          </div>
        </section>
      </main>
      <SiteFooter initialContacts={contacts} />
    </>
  );
}
