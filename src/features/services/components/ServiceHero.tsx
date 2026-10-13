'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { FadeIn } from '@/components/common/FadeIn';

interface ServiceHeroProps {
  namespace: string;
  backgroundSlot?: ReactNode;
}

export const ServiceHero = ({ namespace, backgroundSlot }: ServiceHeroProps) => {
  const t = useTranslations(namespace);

  return (
    <section className="relative overflow-hidden px-6 py-12 md:py-20">
      {backgroundSlot}
      <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-blue-500/5 blur-3xl dark:bg-blue-400/10" aria-hidden="true" />

      <div className="container relative z-10 mx-auto">
        <FadeIn>
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow mb-5 text-xs uppercase tracking-[0.3em] text-slate-600 dark:text-slate-300">
              {t('eyebrow')}
            </p>
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-slate-950 dark:text-white md:text-4xl lg:text-5xl">
              {t('title')} <span className="text-slate-600 dark:text-slate-300">{t('titleAccent')}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              {t('subtitle')}
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
};
