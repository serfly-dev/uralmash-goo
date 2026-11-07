'use client';

import ServicesPageStyles from './ServicesPage.module.css';
import { useEffect, useState } from 'react';
import SiteFooter from '../SiteFooter/SiteFooter';
import SiteHeader from '../SiteHeader/SiteHeader';
import WorksShowcase from '../WorksShowcase/WorksShowcase';
import FeaturedProducts from '../FeaturedProducts/FeaturedProducts';
import { apiOrigin, publicApi } from '../../lib/api';
import { RequestButton } from '../RequestModal/RequestModal';

export type ServiceRecord = {
  id: number;
  slug: string;
  title: string;
  payload?: { description?: string; content?: string; media?: Array<string | { url?: string }> };
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function getMediaUrl(item: string | { url?: string }) {
  const url = typeof item === 'string' ? item : item.url || '';
  return url.startsWith('/') ? `${apiOrigin}${url}` : url;
}

export default function ServicesPage({ slug, initialServices, initialError = false, initialProducts, initialCategories, initialWorks, initialContacts }: { slug?: string; initialServices?: ServiceRecord[] | null; initialError?: boolean; initialProducts?: import('../ProductCard/ProductCard').ProductRecord[]; initialCategories?: import('../ProductCard/ProductCard').ProductCategory[]; initialWorks?: import('../WorksShowcase/WorksShowcase').WorkRecord[]; initialContacts?: import('../SiteFooter/SiteFooter').ContactRecord[] }) {
  const [services, setServices] = useState<ServiceRecord[] | null>(initialServices ?? null);
  const [hasError, setHasError] = useState(initialError);

  useEffect(() => {
    if (initialServices !== undefined || initialError) return;
    const controller = new AbortController();
    fetch(`${publicApi}/services`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить направления.');
        return response.json();
      })
      .then((rows: ServiceRecord[]) => setServices(Array.isArray(rows) ? rows : []))
      .catch((error) => {
        if (error instanceof Error && error.name !== 'AbortError') setHasError(true);
      });
    return () => controller.abort();
  }, [initialError, initialServices]);

  const service = slug ? services?.find((item) => item.slug === slug) : undefined;
  const description = service?.payload?.description?.trim() || '';
  const content = service?.payload?.content?.trim() || '';
  const hasDistinctContent = Boolean(content && normalizeText(content) !== normalizeText(description));
  const serviceState = hasError ? 'error' : services === null ? 'loading' : service ? 'ready' : 'missing';

  return (
    <>
      <SiteHeader />
      <main className={slug ? ServicesPageStyles["services-page"] + " " + ServicesPageStyles["services-page--detail"] : ServicesPageStyles["services-page"] + " " + ServicesPageStyles["services-page--index"]}>
        {slug ? (
          serviceState === 'ready' && service ? (
            <>
              <div className={"services-page__detail-wrap"}>
                <a className={"services-page__back" + " " + ServicesPageStyles["services-page__back"]} href="/services/">Все направления</a>
                <section className={"services-page__detail-hero" + " " + ServicesPageStyles["services-page__detail-hero"]} aria-labelledby="services-heading">
                  <p className={"services-page__eyebrow" + " " + ServicesPageStyles["services-page__eyebrow"]}>Направления работы</p>
                  <h1 id="services-heading">{service.title}</h1>
                  {description && <p className={"services-page__lead" + " " + ServicesPageStyles["services-page__lead"]}>{description}</p>}
                </section>

                {hasDistinctContent && <section className={"services-page__detail-content" + " " + ServicesPageStyles["services-page__detail-content"]} aria-labelledby="service-description-heading">
                  <h2 id="service-description-heading">О направлении</h2>
                  <p>{content}</p>
                </section>}

              {service.payload?.media?.length ? <section className={"services-page__media" + " " + ServicesPageStyles["services-page__media"]} aria-label={`Материалы: ${service.title}`}>
                {service.payload.media.map((item, index) => {
                  const src = getMediaUrl(item);
                  if (!src) return null;
                  return /\.(mp4|webm)(\?|$)/i.test(src)
                    ? <video key={`${src}-${index}`} src={src} controls preload="metadata" aria-label={`Видео: ${service.title}`} />
                    : <img key={`${src}-${index}`} src={src} alt={`${service.title}, фото ${index + 1}`} loading="lazy" decoding="async" />;
                })}
              </section> : null}

              </div>
            </>
          ) : (
            <section className={ServicesPageStyles["services-page__unavailable"]} aria-live="polite">
              <a className={"services-page__back" + " " + ServicesPageStyles["services-page__back"]} href="/services/">Все направления</a>
              <h1>{serviceState === 'loading' ? 'Загружаем направление…' : serviceState === 'error' ? 'Не удалось загрузить направление' : 'Направление не найдено'}</h1>
              <p>{serviceState === 'loading'
                ? 'Загружаем опубликованные материалы.'
                : serviceState === 'error'
                  ? 'Не удалось связаться с сервером. Попробуйте позже.'
                  : 'Откройте список направлений и выберите опубликованную запись.'}</p>
              <a className={"services-page__primary" + " " + ServicesPageStyles["services-page__primary"]} href="/services/">К направлениям</a>
            </section>
          )
        ) : (
          <>
            <section className={"services-page__hero" + " " + ServicesPageStyles["services-page__hero"]} aria-labelledby="services-heading">
              <div className={"services-page__hero-inner" + " " + ServicesPageStyles["services-page__hero-inner"]}>
                <h1 id="services-heading">Проектирование и изготовление оборудования</h1>
                <p className={"services-page__lead" + " " + ServicesPageStyles["services-page__lead"]}>Проектируем, изготавливаем и продаём оборудование, дробильно-сортировочные и обогатительные линии.</p>
              </div>
              <img className={"services-page__hero-image" + " " + ServicesPageStyles["services-page__hero-image"]} src="/crusher-cutout.webp" alt="Щёковая дробилка" width="1536" height="1024" />
            </section>

            <section className={"services-page__directions" + " " + ServicesPageStyles["services-page__directions"]} id="service-directions" aria-labelledby="repair-heading">
              <div className={"services-page__section-head" + " " + ServicesPageStyles["services-page__section-head"]}>
                <p className={"services-page__eyebrow" + " " + ServicesPageStyles["services-page__eyebrow"]}>ОТ ЗАДАЧИ ДО ПОСТАВКИ</p>
                <h2 id="repair-heading">Направления работы</h2>
              </div>
              {!hasError && services?.length === 0 && <p>Пока нет опубликованных направлений.</p>}
              <ul className={"services-page__equipment-list" + " " + ServicesPageStyles["services-page__equipment-list"]}>
                {(services || []).map((item, index) => <li className={"services-page__direction-card" + " " + ServicesPageStyles["services-page__direction-card"]} key={item.id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{item.title}</h3>
                  <div>
                    {item.payload?.description && <p>{item.payload.description}</p>}
                    <a className={ServicesPageStyles["services-page__direction-link"]} href={`/services/${encodeURIComponent(item.slug)}/`}>Подробнее о направлении</a>
                  </div>
                </li>)}
              </ul>
            </section>

            <section className={"services-page__request-info" + " " + ServicesPageStyles["services-page__request-info"]} aria-labelledby="service-request-info-heading">
              <h2 id="service-request-info-heading">Что подготовить для обращения</h2>
              <p>Опишите задачу, материал, требуемую производительность и место установки. При наличии укажите состав действующей линии и ограничения по габаритам. Если часть данных пока неизвестна, расскажите о задаче — уточним детали при обсуждении.</p>
            </section>

            {hasError && <p className={ServicesPageStyles["services-page__status"]} role="status">Не удалось загрузить опубликованные направления. Попробуйте позже.</p>}

            <FeaturedProducts showCatalogFallback initialProducts={initialProducts} initialCategories={initialCategories} />
            <WorksShowcase mode="preview" initialWorks={initialWorks} />
            <section className={"services-page__contact" + " " + ServicesPageStyles["services-page__contact"]} aria-labelledby="service-contact-heading">
              <div className={"services-page__contact-inner"}>
                <div className={"services-page__contact-copy"}>
                  <p className={"services-page__eyebrow" + " " + ServicesPageStyles["services-page__eyebrow"]}>СВЯЗАТЬСЯ</p>
                  <h2 id="service-contact-heading">Обсудить проектирование, изготовление или поставку</h2>
                </div>
                <div className={"services-page__contact-actions"}>
                  <RequestButton className={"services-page__request"} intent="project">Оставить заявку</RequestButton>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
      <SiteFooter initialContacts={initialContacts} />
    </>
  );
}
