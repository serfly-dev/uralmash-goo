'use client';

import WorkDetailStyles from './WorkDetail.module.css';
import { useEffect, useState } from 'react';
import { apiOrigin, publicApi } from '../../lib/api';

type WorkMedia = string | { url?: string };
type WorkStage = {
  description?: string;
  image?: WorkMedia;
};

export type WorkRecord = {
  slug: string;
  title: string;
  payload?: {
    description?: string;
    content?: string;
    media?: WorkMedia[];
    stages?: WorkStage[];
  };
};

function getMediaUrl(item: WorkMedia) {
  const url = typeof item === 'string' ? item : item.url || '';
  return url.startsWith('/') ? `${apiOrigin}${url}` : url;
}

function getLegacyStages(content = ''): WorkStage[] {
  return content
    .split(/\r?\n/)
    .map((stage) => stage.replace(/^\s*(?:\d+[.)]|[-*•–—])\s*/, '').trim())
    .filter(Boolean)
    .map((description) => ({ description }));
}

export default function WorkDetail({ slug, initialWork, initialError = false }: { slug: string; initialWork?: WorkRecord | null; initialError?: boolean }) {
  const [work, setWork] = useState<WorkRecord | null>(initialWork ?? null);
  const [loading, setLoading] = useState(initialWork === undefined && !initialError);
  const [hasError, setHasError] = useState(initialError);
  const [mediaIndex, setMediaIndex] = useState(0);

  useEffect(() => {
    if (initialWork !== undefined || initialError) return;
    const controller = new AbortController();
    setWork(null);
    setLoading(true);
    setHasError(false);

    fetch(`${publicApi}/works`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить проекты.');
        return response.json();
      })
      .then((rows: WorkRecord[]) => {
        const selected = Array.isArray(rows) ? rows.find((item) => item.slug === slug) : null;
        if (!selected) throw new Error('Работа не найдена.');
        setWork(selected);
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== 'AbortError') setHasError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [initialError, initialWork, slug]);

  if (loading) {
    return (
      <main className={WorkDetailStyles["work-detail"]}>
        <div className={WorkDetailStyles["work-detail__inner"]}>
          <p className={WorkDetailStyles["work-detail__message"]}>Загружаем страницу проекта…</p>
        </div>
      </main>
    );
  }

  if (hasError || !work) {
    return (
      <main className={WorkDetailStyles["work-detail"]}>
        <div className={WorkDetailStyles["work-detail__inner"]}>
          <a className={WorkDetailStyles["work-detail__back"]} href="/works/">Все проекты</a>
          <h1>{hasError ? 'Не удалось загрузить проект' : 'Работа не найдена'}</h1>
          <p className={WorkDetailStyles["work-detail__message"]}>{hasError ? 'Попробуйте обновить страницу позже.' : 'Откройте список опубликованных работ и выберите другой пример.'}</p>
        </div>
      </main>
    );
  }

  const stages = Array.isArray(work.payload?.stages)
    ? work.payload.stages.filter((stage) => stage.description?.trim() || stage.image)
    : getLegacyStages(work.payload?.content);
  const media = (work.payload?.media || []).map(getMediaUrl).filter(Boolean);
  const currentIndex = mediaIndex % (media.length || 1);

  return (
    <main className={WorkDetailStyles["work-detail"]}>
      <div className={WorkDetailStyles["work-detail__inner"]}>
          <a className={WorkDetailStyles["work-detail__back"]} href="/works/">Все проекты</a>
        <header className={WorkDetailStyles["work-detail__heading"]}>
          <h1>{work.title}</h1>
          {!stages.length && work.payload?.description && <p>{work.payload.description}</p>}
        </header>

        {media.length > 0 && (
          <section className={WorkDetailStyles["work-detail__media"]} aria-label={`Фото и видео: ${work.title}`}>
            {/\.(mp4|webm)(\?|$)/i.test(media[currentIndex])
              ? <video key={media[currentIndex]} src={media[currentIndex]} controls preload="metadata" aria-label={`Видео: ${work.title}`} />
              : <img src={media[currentIndex]} alt={`${work.title} — фото ${currentIndex + 1}`} decoding="async" />}
            {media.length > 1 && <div className={WorkDetailStyles["work-detail__media-controls"]}>
              <button type="button" aria-label="Предыдущее фото или видео" onClick={() => setMediaIndex((currentIndex + media.length - 1) % media.length)}>‹</button>
              <span aria-live="polite">{currentIndex + 1} / {media.length}</span>
              <button type="button" aria-label="Следующее фото или видео" onClick={() => setMediaIndex((currentIndex + 1) % media.length)}>›</button>
            </div>}
          </section>
        )}

        {stages.length > 0 && (
          <section className={WorkDetailStyles["work-detail__stages"]} aria-labelledby="work-stages-heading">
            <h2 id="work-stages-heading">Этапы проекта</h2>
            <ol className={WorkDetailStyles["work-detail__stages-list"]}>
              {stages.map((stage, index) => {
                const image = stage.image ? getMediaUrl(stage.image) : '';
                return (
                  <li className={[WorkDetailStyles["work-detail__stage"], image ? '' : WorkDetailStyles["work-detail__stage--text"]].filter(Boolean).join(' ')} key={`${index}-${stage.description || image}`}>
                    {image && <img className={WorkDetailStyles["work-detail__stage-image"]} src={image} alt={`Этап ${index + 1}: ${work.title}`} loading="lazy" decoding="async" />}
                    <div className={WorkDetailStyles["work-detail__stage-content"]}>
                      <p className={WorkDetailStyles["work-detail__stage-number"]}>Этап {String(index + 1).padStart(2, '0')}</p>
                      {stage.description && <p className={WorkDetailStyles["work-detail__stage-description"]}>{stage.description}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}
