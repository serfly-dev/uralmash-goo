'use client';

import WorksShowcaseStyles from './WorksShowcase.module.css';
import { useEffect, useState } from 'react';
import { apiOrigin, publicApi } from '../../lib/api';

type WorkMedia = string | { url?: string };

export type WorkRecord = {
  id: number;
  slug: string;
  title: string;
  payload?: {
    description?: string;
    content?: string;
    media?: WorkMedia[];
  };
};

function getMediaUrl(item: WorkMedia) {
  const url = typeof item === 'string' ? item : item.url || '';
  return url.startsWith('/') ? `${apiOrigin}${url}` : url;
}

function WorkCard({ work, showDescription, compact = false }: { work: WorkRecord; showDescription: boolean; compact?: boolean }) {
  const media = work.payload?.media?.map(getMediaUrl).find(Boolean);
  const isVideo = Boolean(media && /\.(mp4|webm)(\?|$)/i.test(media));
  const description = work.payload?.description || work.payload?.content;
  const detailHref = `/works/${encodeURIComponent(work.slug)}/`;

  if (compact) {
    return (
      <article className={WorksShowcaseStyles["home-work-card"] + " " + WorksShowcaseStyles["home-work-card--preview"]}>
        <h3><a href={detailHref}>{work.title}</a></h3>
        <a className={"home-work-card__link" + " " + WorksShowcaseStyles["home-work-card__link"]} href={detailHref}>Открыть проект</a>
      </article>
    );
  }

  return (
    <article className={WorksShowcaseStyles["home-work-card"]}>
      {media && (
        <div className={WorksShowcaseStyles["home-work-card__media"]}>
          {isVideo
            ? <video src={media} controls preload="metadata" aria-label={`Видео: ${work.title}`} />
            : <img src={media} alt={work.title} loading="lazy" decoding="async" />}
        </div>
      )}
      <div className={WorksShowcaseStyles["home-work-card__content"]}>
        <h3><a href={detailHref}>{work.title}</a></h3>
        {showDescription && description && <p>{description}</p>}
        <a className={"home-work-card__link" + " " + WorksShowcaseStyles["home-work-card__link"]} href={detailHref}>Подробнее о проекте</a>
      </div>
    </article>
  );
}

export default function WorksShowcase({ mode, initialWorks, initialError = false }: { mode: 'home' | 'page' | 'preview' | 'about'; initialWorks?: WorkRecord[] | null; initialError?: boolean }) {
  const [works, setWorks] = useState<WorkRecord[] | null>(initialWorks ?? null);
  const [hasError, setHasError] = useState(initialError);

  useEffect(() => {
    if (initialWorks !== undefined || initialError) return;
    const controller = new AbortController();

    fetch(`${publicApi}/works`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить проекты.');
        return response.json();
      })
      .then((rows: WorkRecord[]) => setWorks(Array.isArray(rows) ? rows : []))
      .catch((error) => {
        if (error instanceof Error && error.name !== 'AbortError') setWorks([]);
      });

    return () => controller.abort();
  }, [initialError, initialWorks]);

  if ((mode === 'home' || mode === 'preview' || mode === 'about') && !works?.length) return null;

  const displayedWorks = mode === 'home' ? works?.slice(0, 3) : mode === 'about' ? works?.slice(0, 6) : mode === 'preview' ? works?.slice(0, 3) : works;
  const Heading = mode === 'page' ? 'h1' : 'h2';

  return (
    <section className={mode === 'page' ? WorksShowcaseStyles["works-page"] : mode === 'preview' ? WorksShowcaseStyles["home-works"] + " " + "home-works--preview" + " " + WorksShowcaseStyles["home-works--preview"] : WorksShowcaseStyles["home-works"]} id={mode === 'home' ? 'works' : undefined} aria-labelledby="works-heading">
      <div className={WorksShowcaseStyles["home-works__inner"]}>
        <Heading className={"home-works__heading" + " " + WorksShowcaseStyles["home-works__heading"]} id="works-heading">{mode === 'preview' ? 'Проекты' : 'Проекты и изготовленное оборудование'}</Heading>
        {mode === 'about' && <p className={WorksShowcaseStyles["works-page__intro"]}>В разделе проектов собраны опубликованные примеры оборудования и выполненных работ. Откройте карточку, чтобы посмотреть описание и материалы по проекту.</p>}
        {mode === 'page' && <p className={WorksShowcaseStyles["works-page__intro"]}>Здесь собраны опубликованные проекты и изготовленное оборудование. В карточках можно ознакомиться с описанием и фотографиями, если они добавлены для проекта.</p>}
        {displayedWorks?.length ? (
          <div className={"home-works__grid" + " " + WorksShowcaseStyles["home-works__grid"]}>
            {displayedWorks.map((work) => <WorkCard key={work.id} work={work} showDescription={mode === 'home' || mode === 'about'} />)}
          </div>
        ) : mode === 'page' && hasError ? (
          <p className={WorksShowcaseStyles["home-works__empty"]}>Не удалось загрузить опубликованные проекты. Попробуйте позже.</p>
        ) : mode === 'page' && works ? (
          <p className={WorksShowcaseStyles["home-works__empty"]}>Опубликованных проектов пока нет.</p>
        ) : null}
        {(mode === 'home' || mode === 'about' || mode === 'preview') && (
          <div className={"home-works__footer" + " " + WorksShowcaseStyles["home-works__footer"]}>
            <a href="/works/">Все проекты</a>
          </div>
        )}
      </div>
    </section>
  );
}
