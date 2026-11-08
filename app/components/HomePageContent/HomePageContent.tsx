'use client';

import HomePageContentStyles from './HomePageContent.module.css';
import SiteHeaderStyles from '../SiteHeader/SiteHeader.module.css';
import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import FeaturedProducts from '../FeaturedProducts/FeaturedProducts';
import FinalCta from '../FinalCta/FinalCta';
import ReviewsShowcase from '../ReviewsShowcase/ReviewsShowcase';
import SiteFooter from '../SiteFooter/SiteFooter';
import WorksShowcase from '../WorksShowcase/WorksShowcase';
import SiteHeader, { siteNavigation } from '../SiteHeader/SiteHeader';
import { RequestButton } from '../RequestModal/RequestModal';

gsap.registerPlugin(useGSAP);

const equipmentSlides = [
  { src: '/crusher-cutout.webp', alt: 'Синяя промышленная щёковая дробилка', title: 'Щёковая дробилка' },
  { src: '/cone-crusher.webp', alt: 'Синяя промышленная конусная дробилка', title: 'Конусная дробилка' },
  { src: '/vibrating-screen.webp', alt: 'Промышленный виброгрохот для сортировки руды', title: 'Виброгрохот' },
  { src: '/ball-mill.webp', alt: 'Промышленная шаровая мельница для измельчения руды', title: 'Шаровая мельница' },
];

export default function HomePageContent({ featuredProducts, categories, reviews, works, contacts }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [homeMenuOpen, setHomeMenuOpen] = useState(false);
  const homeMenuButtonRef = useRef(null);
  const scrollTrackRef = useRef(null);
  const heroRef = useRef(null);
  const machineRef = useRef(null);
  const machineNavRef = useRef(null);
  const panelRef = useRef(null);
  const panelHeaderRef = useRef(null);
  const panelNavRef = useRef(null);
  const panelIntroRef = useRef(null);
  const presentationRef = useRef(null);
  const continuationHeaderRef = useRef(null);
  const directionsSectionRef = useRef(null);
  const directionsImageRef = useRef(null);
  const currentEquipment = equipmentSlides[activeSlide];

  useEffect(() => {
    if (!homeMenuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setHomeMenuOpen(false);
        homeMenuButtonRef.current?.focus();
      }
    };
    const closeOnDesktop = (event) => {
      if (event.matches) setHomeMenuOpen(false);
    };
    const desktopQuery = window.matchMedia('(min-width: 1025px)');
    document.addEventListener('keydown', closeOnEscape);
    desktopQuery.addEventListener('change', closeOnDesktop);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      desktopQuery.removeEventListener('change', closeOnDesktop);
    };
  }, [homeMenuOpen]);

  useGSAP(() => {
    gsap.registerPlugin(ScrollTrigger);

    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        directionsImageRef.current,
        { autoAlpha: 0, x: 96, y: 32, scale: 0.94 },
        {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
          duration: 1.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: directionsSectionRef.current,
            start: 'top 78%',
            once: true,
          },
        },
      );
    });

    return () => motion.revert();
  }, { scope: directionsSectionRef });

  useEffect(() => {
    const autoplayQuery = window.matchMedia('(min-width: 1025px) and (hover: hover) and (prefers-reduced-motion: no-preference)');
    let timer = 0;
    const scheduleNextSlide = () => {
      window.clearTimeout(timer);
      if (!autoplayQuery.matches || document.hidden) return;
      timer = window.setTimeout(() => {
        setActiveSlide((current) => (current + 1) % equipmentSlides.length);
      }, 6000);
    };

    scheduleNextSlide();
    document.addEventListener('visibilitychange', scheduleNextSlide);
    autoplayQuery.addEventListener('change', scheduleNextSlide);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', scheduleNextSlide);
      autoplayQuery.removeEventListener('change', scheduleNextSlide);
    };
  }, [activeSlide]);

  useEffect(() => {
    const track = scrollTrackRef.current;
    const hero = heroRef.current;
    const machine = machineRef.current;
    const machineNav = machineNavRef.current;
    const panel = panelRef.current;
    const panelHeader = panelHeaderRef.current;
    const panelNav = panelNavRef.current;
    const panelIntro = panelIntroRef.current;
    const presentation = presentationRef.current;
    const continuationHeader = continuationHeaderRef.current;
    if (!track || !hero || !machine || !machineNav || !panel || !panelHeader || !panelNav || !panelIntro || !presentation || !continuationHeader) return;

    const animationQuery = window.matchMedia('(min-width: 1025px) and (prefers-reduced-motion: no-preference)');
    let frame = 0;
    let continuationVisible = false;

    const update = () => {
      frame = 0;
      const blueBlockGone = track.getBoundingClientRect().bottom <= Math.max(1, window.innerHeight * 0.02);
      continuationVisible = blueBlockGone;
      panelHeader.inert = blueBlockGone;
      panelHeader.setAttribute('aria-hidden', String(blueBlockGone));
      continuationHeader.classList.toggle('continuation-header--visible', continuationVisible);
      continuationHeader.classList.toggle(SiteHeaderStyles['continuation-header--visible'], continuationVisible);
      continuationHeader.inert = !continuationVisible;
      continuationHeader.setAttribute('aria-hidden', String(!continuationVisible));
      if (!animationQuery.matches) {
        panel.style.setProperty('--hero-panel-shift', '0px');
        machine.style.contentVisibility = 'visible';
        machine.inert = false;
        machine.setAttribute('aria-hidden', 'false');
        machineNav.style.opacity = '1';
        machineNav.inert = false;
        machineNav.setAttribute('aria-hidden', 'false');
        panelNav.style.opacity = '1';
        panelNav.inert = false;
        panelNav.setAttribute('aria-hidden', 'false');
        panelIntro.inert = false;
        panelIntro.setAttribute('aria-hidden', 'false');
        presentation.inert = false;
        presentation.setAttribute('aria-hidden', 'false');
        return;
      }

      const scrollOffset = Math.max(0, -track.getBoundingClientRect().top);
      const transitionRange = Math.max(hero.offsetHeight, 1);
      const presentationRange = Math.max(track.offsetHeight - hero.offsetHeight - transitionRange, 1);
      const progress = Math.min(1, Math.max(0, scrollOffset / transitionRange));
      const presentationProgress = Math.min(1, Math.max(0, (scrollOffset - transitionRange) / presentationRange));
      const covered = progress >= 0.995;
      panel.style.setProperty('--hero-panel-shift', `${(1 - progress) * 50}vw`);
      panel.style.setProperty('--hero-panel-width', `${50 + progress * 50}vw`);
      panel.style.setProperty('--hero-intro-progress', String(progress));
      panel.style.setProperty('--presentation-progress', String(presentationProgress));
      machine.style.contentVisibility = covered ? 'hidden' : 'visible';
      machine.inert = covered;
      machine.setAttribute('aria-hidden', String(covered));
      machineNav.style.opacity = String(1 - progress);
      panelNav.style.opacity = String(progress);
      machineNav.inert = progress >= 0.5;
      machineNav.setAttribute('aria-hidden', String(progress >= 0.5));
      panelNav.inert = progress < 0.5;
      panelNav.setAttribute('aria-hidden', String(progress < 0.5));
      panelIntro.inert = progress >= 0.5;
      panelIntro.setAttribute('aria-hidden', String(progress >= 0.5));
      presentation.inert = presentationProgress < 0.5;
      presentation.setAttribute('aria-hidden', String(presentationProgress < 0.5));
    };

    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    animationQuery.addEventListener('change', scheduleUpdate);
    update();

    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      animationQuery.removeEventListener('change', scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <main className={"home-page"}>
      <div className={HomePageContentStyles["hero-scroll"]} ref={scrollTrackRef}>
        <div className={HomePageContentStyles["hero"]} ref={heroRef}>
            <div className={HomePageContentStyles["hero-nav"]} ref={machineNavRef}>
              <nav className={HomePageContentStyles["hero-nav__links"]} aria-label="Основная навигация">
                {siteNavigation.map(([label, href]) => (
                  <a href={href} key={label} aria-current={href === '/' ? 'page' : undefined}>{label}</a>
                ))}
              </nav>
              <button
                ref={homeMenuButtonRef}
                className={HomePageContentStyles["hero-nav__menu-toggle"]}
                type="button"
                aria-expanded={homeMenuOpen}
                aria-controls="home-mobile-navigation"
                aria-label={homeMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
                onClick={() => setHomeMenuOpen((open) => !open)}
              >
                <span aria-hidden="true" />
                <span aria-hidden="true" />
                <span aria-hidden="true" />
              </button>
              <nav
                id="home-mobile-navigation"
                className={[HomePageContentStyles["hero-nav__mobile"], homeMenuOpen ? HomePageContentStyles["hero-nav__mobile--open"] : ''].filter(Boolean).join(' ')}
                aria-label="Основная навигация"
                aria-hidden={!homeMenuOpen}
                inert={!homeMenuOpen}
              >
                {siteNavigation.map(([label, href]) => (
                  <a href={href} key={label} aria-current={href === '/' ? 'page' : undefined} onClick={() => setHomeMenuOpen(false)}>{label}</a>
                ))}
              </nav>
            </div>
          <section className={HomePageContentStyles["hero-machine"]} ref={machineRef} aria-label="Оборудование Уралмаш ГОО">
            <div className={HomePageContentStyles["hero-machine__stage"]} role="group" aria-roledescription="слайд" aria-label={`${currentEquipment.title}, ${activeSlide + 1} из ${equipmentSlides.length}`}>
              <img className={HomePageContentStyles["hero-machine__image"]} key={currentEquipment.src} src={currentEquipment.src} alt={currentEquipment.alt} width="1536" height="1024" fetchPriority={activeSlide === 0 ? 'high' : undefined} decoding="async" />
            </div>
            <div className={HomePageContentStyles["hero-machine__carousel"]}>
              <div>
                <span className={HomePageContentStyles["hero-machine__title"]}>{currentEquipment.title}</span>
                <span className={HomePageContentStyles["hero-machine__notice"]}>Изображение носит иллюстративный характер</span>
              </div>
              <div className={HomePageContentStyles["hero-machine__controls"]} aria-label="Управление изображениями оборудования">
                <button type="button" aria-label="Предыдущее изображение" onClick={() => setActiveSlide((activeSlide + equipmentSlides.length - 1) % equipmentSlides.length)}>‹</button>
                <button type="button" aria-label="Следующее изображение" onClick={() => setActiveSlide((activeSlide + 1) % equipmentSlides.length)}>›</button>
              </div>
            </div>
            <div className={HomePageContentStyles["hero-proof"]} aria-label="Показатели Уралмаш ГОО">
              <div className={HomePageContentStyles["hero-proof__item"]}>
                <strong>10</strong>
                <span>лет опыта</span>
              </div>
              <div className={HomePageContentStyles["hero-proof__item"]}>
                <strong>13 мес</strong>
                <span>гарантия</span>
              </div>
            </div>
          </section>

          <section className={HomePageContentStyles["hero-panel"]} ref={panelRef} aria-label="Уралмаш ГОО">
            <header className={HomePageContentStyles["hero-panel__header"]} ref={panelHeaderRef}>
              <a className={"hero-brand" + " " + SiteHeaderStyles["hero-brand"]} href="/" aria-label="Уралмаш ГОО — главная">
                <img src="/logo-reference.png" alt="" />
              </a>
              <nav className={HomePageContentStyles["hero-panel__nav"]} ref={panelNavRef} aria-label="Основная навигация" aria-hidden="true" inert>
                {siteNavigation.map(([label, href]) => (
                  <a href={href} key={label} aria-current={href === '/' ? 'page' : undefined}>{label}</a>
                ))}
              </nav>
              <a className={HomePageContentStyles["hero-phone"]} href="tel:+79221502311">+7 (922) 150-23-11</a>
            </header>
            <div className={HomePageContentStyles["hero-panel__story"]}>
              <div className={HomePageContentStyles["hero-panel__intro"]} ref={panelIntroRef} aria-hidden="false">
                <div className={HomePageContentStyles["hero-copy"]}>
                  <h1 className={HomePageContentStyles["hero-heading"]}>
                    <span className={HomePageContentStyles["hero-heading__lead"]}>ГОРНО-</span>
                    <span className={"hero-heading__line" + " " + HomePageContentStyles["hero-heading__line"]}>ОБОГАТИТЕЛЬНОЕ</span>
                    <span className={"hero-heading__line" + " " + HomePageContentStyles["hero-heading__line"]}>ОБОРУДОВАНИЕ</span>
                  </h1>
                  <p className={"hero-description" + " " + HomePageContentStyles["hero-description"]}>Проектирование, изготовление и продажа оборудования и линий для горно-обогатительной отрасли.</p>
                </div>
                <RequestButton className={HomePageContentStyles["hero-contact"]}>Связаться</RequestButton>
              </div>
              <div className={HomePageContentStyles["company-presentation__content"]} ref={presentationRef} aria-label="Презентация компании Уралмаш ГОО" aria-hidden="true" inert>
                <div className={HomePageContentStyles["company-presentation__copy"]}>
                  <h2 className={HomePageContentStyles["hero-heading"]}>
                    <span className={"hero-heading__line" + " " + HomePageContentStyles["hero-heading__line"]}>ГОРНО-ОБОГАТИТЕЛЬНОЕ</span>
                    <span className={"hero-heading__line" + " " + HomePageContentStyles["hero-heading__line"]}>ОБОРУДОВАНИЕ</span>
                  </h2>
                  <p className={"hero-description" + " " + HomePageContentStyles["hero-description"]}>Дробильно-сортировочные и обогатительные линии по задачам производства.</p>
                </div>
                <img className={HomePageContentStyles["company-presentation__conveyor"]} src="/conveyor-presentation-v2.webp" alt="Линия из нескольких промышленных конвейерных секций для горно-обогатительной отрасли" width="2172" height="724" loading="lazy" decoding="async" />
              </div>
            </div>
          </section>
        </div>
      </div>
      <section className={HomePageContentStyles["presentation-continuation"]} id="presentation-continuation" aria-label="Выбранные товары после презентации">
        <SiteHeader ref={continuationHeaderRef} visible={false} />
        <FeaturedProducts initialProducts={featuredProducts} initialCategories={categories} />
      </section>
      <section className={HomePageContentStyles["home-repair"]} id="services" aria-labelledby="home-repair-heading" ref={directionsSectionRef}>
        <div className={HomePageContentStyles["home-repair__inner"]}>
          <article className={HomePageContentStyles["home-repair__content"]} aria-labelledby="home-repair-heading">
            <h2 className={HomePageContentStyles["home-repair__heading"]} id="home-repair-heading">От оборудования до производственной линии</h2>
            <p className={HomePageContentStyles["home-repair__description"]}>Проектируем, изготавливаем и продаём дробильно-сортировочное оборудование и обогатительные линии.</p>
            <RequestButton className={HomePageContentStyles["home-repair__action"]} intent="project">Обсудить проект</RequestButton>
            <a className={[HomePageContentStyles["home-repair__action"], HomePageContentStyles["home-repair__link"]].join(' ')} href="/services/">Все направления</a>
          </article>
          <figure className={HomePageContentStyles["home-repair__figure"]}>
            <img
              className={HomePageContentStyles["home-repair__image"]}
              src="/crusher-cutout.webp"
              alt="Щёковая дробилка"
              ref={directionsImageRef}
              width="1024"
              height="1024"
              loading="lazy"
              decoding="async"
            />
          </figure>
        </div>
      </section>
      <WorksShowcase mode="home" initialWorks={works} />
      <ReviewsShowcase initialReviews={reviews} />
      <FinalCta />
      </main>
      <SiteFooter initialContacts={contacts} />
    </>
  );
}
