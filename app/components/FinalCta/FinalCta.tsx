'use client';

import FinalCtaStyles from './FinalCta.module.css';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { RequestButton } from '../RequestModal/RequestModal';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export default function FinalCta() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    const motion = gsap.matchMedia();

    motion.add('(prefers-reduced-motion: no-preference)', () => {
      const timeline = gsap.timeline({
        defaults: { duration: 0.8, ease: 'power3.out' },
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 78%',
          once: true,
        },
      });

      timeline
        .fromTo('.' + FinalCtaStyles['home-final-cta__copy'], { autoAlpha: 0, x: -28 }, { autoAlpha: 1, x: 0 })
        .fromTo(
          '.' + FinalCtaStyles['home-final-cta__equipment'],
          { autoAlpha: 0, y: 42, clipPath: 'inset(100% 0 0 0)' },
          { autoAlpha: 1, y: 0, clipPath: 'inset(0% 0 0 0)', duration: 1 },
          0.1,
        )
        .fromTo('.' + FinalCtaStyles['home-final-cta__action'], { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0 }, 0.42);
    });

    return () => motion.revert();
  }, { scope: sectionRef });

  return (
    <section className={FinalCtaStyles["home-final-cta"]} ref={sectionRef} aria-labelledby="home-final-cta-heading">
      <div className={FinalCtaStyles["home-final-cta__inner"]}>
        <div className={FinalCtaStyles["home-final-cta__copy"]}>
          <h2 id="home-final-cta-heading">Нужно спроектировать или изготовить оборудование?</h2>
          <p>Расскажите о задаче — обсудим проект, изготовление и поставку.</p>
          <RequestButton className={FinalCtaStyles["home-final-cta__action"]}>Обсудить задачу</RequestButton>
        </div>
        <div className={FinalCtaStyles["home-final-cta__visual"]} aria-hidden="true">
          <img className={FinalCtaStyles["home-final-cta__equipment"]} src="/home-final-cta-equipment.webp" alt="" width="1536" height="1024" loading="lazy" decoding="async" />
        </div>
      </div>
    </section>
  );
}
