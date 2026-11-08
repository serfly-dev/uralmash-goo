'use client';

import ReviewsShowcaseStyles from './ReviewsShowcase.module.css';
import { useEffect, useRef, useState } from 'react';
import { publicApi } from '../../lib/api';

export type ReviewRecord = {
  id: number;
  payload?: {
    authorName?: string;
    text?: string;
  };
};

export default function ReviewsShowcase({ initialReviews }: { initialReviews?: ReviewRecord[] }) {
  const [reviews, setReviews] = useState<ReviewRecord[] | null>(initialReviews === undefined ? null : initialReviews.filter((review) => review.payload?.authorName?.trim() && review.payload?.text?.trim()));
  const [hasError, setHasError] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (initialReviews !== undefined) return;
    const controller = new AbortController();

    fetch(`${publicApi}/reviews`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить отзывы.');
        return response.json();
      })
      .then((rows: ReviewRecord[]) => {
        const publishedReviews = Array.isArray(rows)
          ? rows.filter((review) => review.payload?.authorName?.trim() && review.payload?.text?.trim())
          : [];
        setReviews(publishedReviews);
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== 'AbortError') {
          setHasError(true);
          setReviews([]);
        }
      });

    return () => controller.abort();
  }, [initialReviews]);

  const visibleReviews = reviews ? (showAll ? reviews : reviews.slice(0, 10)) : [];

  return (
    <section className={ReviewsShowcaseStyles["home-reviews"]} aria-labelledby="home-reviews-heading">
      <div className={ReviewsShowcaseStyles["home-reviews__inner"]}>
        <h2 className={ReviewsShowcaseStyles["home-reviews__heading"]} id="home-reviews-heading">Отзывы клиентов</h2>
        {reviews === null ? (
          <p className={ReviewsShowcaseStyles["home-reviews__empty"]}>Загружаем отзывы…</p>
        ) : reviews.length > 0 ? (
          <>
            <ul className={ReviewsShowcaseStyles["home-reviews__list"]} id="home-reviews-list" ref={listRef} tabIndex={visibleReviews.length > 1 ? 0 : undefined} aria-label="Отзывы клиентов">
              {visibleReviews.map((review) => (
                <li className={ReviewsShowcaseStyles["home-reviews__item"]} key={review.id}>
                  <figure>
                    <figcaption>
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
                      {review.payload?.authorName}
                    </figcaption>
                    <blockquote><p>{review.payload?.text}</p></blockquote>
                  </figure>
                </li>
              ))}
            </ul>
            {visibleReviews.length > 1 && (
              <div className={ReviewsShowcaseStyles["home-reviews__controls"]} aria-label="Навигация по отзывам">
                <button type="button" aria-label="Предыдущий отзыв" onClick={() => listRef.current?.scrollBy({ left: -listRef.current.clientWidth })}>‹</button>
                <button type="button" aria-label="Следующий отзыв" onClick={() => listRef.current?.scrollBy({ left: listRef.current.clientWidth })}>›</button>
              </div>
            )}
            {reviews.length > 10 && (
              <div className={ReviewsShowcaseStyles["home-reviews__footer"]}>
                <button
                  className={ReviewsShowcaseStyles["home-reviews__toggle"]}
                  type="button"
                  aria-expanded={showAll}
                  aria-controls="home-reviews-list"
                  onClick={() => setShowAll((current) => !current)}
                >
                  {showAll ? 'Свернуть' : 'Показать все'}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className={ReviewsShowcaseStyles["home-reviews__empty"]}>
            {hasError ? 'Не удалось загрузить отзывы.' : 'Пока нет опубликованных отзывов.'}
          </p>
        )}
      </div>
    </section>
  );
}
