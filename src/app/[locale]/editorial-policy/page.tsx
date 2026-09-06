import type { Metadata } from 'next';

import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Link } from '@/i18n/navigation';
import { SITE } from '@/config/site';
import { buildAlternates } from '@/i18n/seo-locales';

type Props = { params: Promise<{ locale: string }> };

const COPY = {
  ka: {
    title: 'სარედაქციო მიდგომა',
    lead: 'როგორ ვამზადებთ, ვამოწმებთ და ვაახლებთ aiAUDIT-ის პრაქტიკულ მასალებს.',
    sections: [
      ['ვინ არის პასუხისმგებელი', 'მასალებს aiNOW აქვეყნებს და მათ სიზუსტეზე სარედაქციო პასუხისმგებლობას იღებს. ავტორის ველში მითითებული გუნდი ორგანიზაციული ავტორია და არა გამოგონილი პიროვნება.'],
      ['როგორ ვიყენებთ AI-ს', 'AI გვეხმარება კვლევის მიმართულებების, საწყისი სტრუქტურისა და შესამოწმებელი საკითხების დალაგებაში. ავტომატურად მიღებული ტექსტი გამოქვეყნების საფუძველი არ არის.'],
      ['რას ვამოწმებთ', 'გამოქვეყნებამდე ცალ-ცალკე მოწმდება წყაროები, ფაქტობრივი მტკიცებები, პროდუქტის რეალური საზღვრები, რეკომენდაციების პირობები და ქართული ტექსტის გასაგებადობა. დაუდასტურებელ შედეგს ფაქტად არ ვწერთ.'],
      ['რატომ ვაქვეყნებთ', 'მიზანია, ბიზნესმა AI აუდიტის, ბიუჯეტის, მონაცემებისა და პილოტის შესახებ გადაწყვეტილება უფრო მკაფიო კითხვებით მიიღოს. ცალკე გვერდი მხოლოდ დამოუკიდებელი პრაქტიკული ამოცანისთვის იქმნება.'],
      ['შესწორებები და განახლებები', 'თუ შეცდომას ან მოძველებულ წყაროს შენიშნავთ, დაგვიკავშირდით. არსებითი ცვლილებისას განახლების თარიღიც იცვლება. მხოლოდ თარიღს ახალი შინაარსის გარეშე არ ვცვლით.'],
    ],
    contact: 'შეცდომის შეტყობინება',
    back: 'ბლოგზე დაბრუნება',
  },
  en: {
    title: 'Editorial approach',
    lead: 'How aiAUDIT practical guides are prepared, checked and updated.',
    sections: [
      ['Who is responsible', 'aiNOW publishes these guides and retains editorial responsibility for their accuracy. A team named in the byline is an organizational author, not a fictional person.'],
      ['How we use AI', 'AI assists with research directions, initial structure and organizing questions that require verification. Automatically produced text is not sufficient for publication.'],
      ['What we check', 'Sources, factual claims, actual product boundaries, conditions attached to recommendations and Georgian-language clarity are checked separately before publication. Unverified outcomes are not presented as facts.'],
      ['Why we publish', 'The purpose is to help businesses make decisions about AI audits, budgets, data and pilots using clearer questions. A separate page is created only for an independent practical task.'],
      ['Corrections and updates', 'Contact us if you notice an error or an outdated source. The updated date changes after a material revision; we do not change dates without new substance.'],
    ],
    contact: 'Report an error',
    back: 'Back to the blog',
  },
  ru: {
    title: 'Редакционный подход',
    lead: 'Как мы готовим, проверяем и обновляем практические материалы aiAUDIT.',
    sections: [
      ['Кто отвечает за материал', 'Материалы публикует aiNOW и несёт редакционную ответственность за их точность. Команда, указанная в строке автора, является организационным автором, а не вымышленным человеком.'],
      ['Как мы используем ИИ', 'ИИ помогает определить направления исследования, подготовить исходную структуру и упорядочить вопросы для проверки. Автоматически полученный текст сам по себе не является основанием для публикации.'],
      ['Что мы проверяем', 'До публикации отдельно проверяются источники, фактические утверждения, реальные границы продукта, условия рекомендаций и ясность грузинского текста. Неподтверждённые результаты не выдаются за факты.'],
      ['Зачем мы публикуем', 'Цель материалов — помочь бизнесу принимать решения об ИИ-аудите, бюджете, данных и пилоте с помощью более точных вопросов. Отдельная страница создаётся только для самостоятельной практической задачи.'],
      ['Исправления и обновления', 'Свяжитесь с нами, если заметили ошибку или устаревший источник. Дата обновления меняется после существенной правки; без нового содержания мы дату не меняем.'],
    ],
    contact: 'Сообщить об ошибке',
    back: 'Вернуться в блог',
  },
} as const;

function copyFor(locale: string) {
  return COPY[locale as keyof typeof COPY] ?? COPY.en;
}

export function generateStaticParams() {
  return SITE.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!(SITE.locales as readonly string[]).includes(locale)) notFound();
  const copy = copyFor(locale);
  return {
    title: copy.title,
    description: copy.lead,
    alternates: buildAlternates('/editorial-policy', locale),
  };
}

export default async function EditorialPolicyPage({ params }: Props) {
  const { locale } = await params;
  if (!(SITE.locales as readonly string[]).includes(locale)) notFound();
  setRequestLocale(locale);
  const copy = copyFor(locale);

  return (
    <main className="mx-auto w-[calc(100%-32px)] max-w-[960px] py-16 text-[#111827] md:w-[calc(100%-48px)] md:py-24 dark:text-white">
      <header className="max-w-[760px]">
        <p className="text-sm font-bold tracking-[0.08em] text-[var(--brand-ink)]">aiAUDIT</p>
        <h1 className="mt-4 font-[family-name:var(--font-bricolage)] text-4xl font-extrabold tracking-[-0.04em] md:text-6xl">{copy.title}</h1>
        <p className="mt-6 text-lg leading-8 text-[#4b5563] dark:text-white/70">{copy.lead}</p>
      </header>

      <div className="mt-14 grid gap-5">
        {copy.sections.map(([title, body]) => (
          <section key={title} className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900 md:p-8">
            <h2 className="font-[family-name:var(--font-bricolage)] text-2xl font-extrabold tracking-[-0.025em]">{title}</h2>
            <p className="mt-3 max-w-[780px] text-base leading-7 text-[#4b5563] dark:text-white/70">{body}</p>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-4">
        <Link href="/contact" className="inline-flex min-h-11 items-center rounded-full bg-[var(--brand)] px-6 font-bold text-[var(--primary-foreground)]">{copy.contact}</Link>
        <Link href="/blog" className="inline-flex min-h-11 items-center rounded-full border border-black/15 px-6 font-bold dark:border-white/20">{copy.back}</Link>
      </div>
    </main>
  );
}
