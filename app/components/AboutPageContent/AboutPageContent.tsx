'use client';

import AboutPageContentStyles from './AboutPageContent.module.css';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import SiteFooter from '../SiteFooter/SiteFooter';
import SiteHeader from '../SiteHeader/SiteHeader';
import FeaturedProducts from '../FeaturedProducts/FeaturedProducts';
import WorksShowcase from '../WorksShowcase/WorksShowcase';

gsap.registerPlugin(useGSAP);

export default function AboutPageContent({ featuredProducts, categories, works, contacts }: { featuredProducts?: import('../ProductCard/ProductCard').ProductRecord[]; categories?: import('../ProductCard/ProductCard').ProductCategory[]; works?: import('../WorksShowcase/WorksShowcase').WorkRecord[]; contacts?: import('../SiteFooter/SiteFooter').ContactRecord[] }) {
  const pageRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    const motion = gsap.matchMedia();

    motion.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .fromTo('[data-about-title-line]',
          { autoAlpha: 0, yPercent: 110 },
          { autoAlpha: 1, yPercent: 0, duration: 0.85, stagger: 0.1 },
        )
        .fromTo('[data-about-intro]',
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.55 },
          '-=0.42',
        )
        .fromTo('[data-about-machine]',
          { autoAlpha: 0, y: 84, scale: 0.93 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 1.1, ease: 'power3.out' },
          '-=0.2',
        );
    });

    return () => motion.revert();
  }, { scope: pageRef });

  return (
    <>
      <main className={AboutPageContentStyles["about-page"]} ref={pageRef}>
        <SiteHeader />

        <div className={AboutPageContentStyles["about-page__inner"]}>
          <section className={"about-hero"} aria-labelledby="about-heading">
            <div className={AboutPageContentStyles["about-hero__copy"]}>
              <h1 id="about-heading"><span data-about-title-line>О компании</span></h1>
              <p data-about-intro>ООО «Уралмаш ГОО» зарегистрировано 4 декабря 2024 года и работает в Екатеринбурге.</p>
            </div>

            <figure className={AboutPageContentStyles["about-hero__stage"]}>
              <div className={AboutPageContentStyles["about-hero__surface"]} aria-hidden="true" />
              <img
                className={AboutPageContentStyles["about-hero__machine"]}
                data-about-machine
                src="/about-crusher-concept.webp"
                alt="Дробилка"
                width="1536"
                height="1024"
                fetchPriority="high"
              />
            </figure>
          </section>

          <section className={AboutPageContentStyles["about-company"]} aria-labelledby="about-company-heading">
            <div>
              <p className={"about-section-label" + " " + AboutPageContentStyles["about-section-label"]}>Направления</p>
              <h2 id="about-company-heading">Проектирование, изготовление, продажа</h2>
            </div>
            <div className={AboutPageContentStyles["about-company__text"]}>
              <p>ООО «Уралмаш ГОО» работает в Екатеринбурге. Компания проектирует, изготавливает и продаёт оборудование, дробильно-сортировочные и обогатительные линии.</p>
              <p>Оборудование применяется на разных этапах подготовки и переработки материала: от дробления до разделения по крупности и обогащения. Выбор машин и состав линии зависят от свойств сырья, требуемой производительности и условий площадки.</p>
              <div className={AboutPageContentStyles["about-company__links"]}>
                <a className={"about-text-link" + " " + AboutPageContentStyles["about-text-link"]} href="/catalog/">Открыть каталог</a>
                <a className={"about-text-link" + " " + AboutPageContentStyles["about-text-link"]} href="/services/">Направления</a>
                <a className={"about-text-link" + " " + AboutPageContentStyles["about-text-link"]} href="/contacts/">Контакты</a>
              </div>
            </div>
          </section>

          <section className={AboutPageContentStyles["about-directions"]} aria-label="Направления работы компании">
            <article><h2>Проектирование</h2><p>Проработка оборудования и компоновки линии с учётом исходных данных и задачи заказчика.</p></article>
            <article><h2>Изготовление</h2><p>Изготовление машин и оборудования по согласованному проекту и комплектации.</p></article>
            <article><h2>Продажа</h2><p>Подбор и поставка оборудования и линий с уточнением характеристик по запросу.</p></article>
          </section>


        </div>
        <WorksShowcase mode="about" initialWorks={works} />
        <FeaturedProducts initialProducts={featuredProducts} initialCategories={categories} />
      </main>

      <SiteFooter initialContacts={contacts} />
    </>
  );
}
