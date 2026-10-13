import type { Metadata } from "next";
import Link from "next/link";
import { buildAlternates } from "@/i18n/seo-locales";
import { previewRobots } from "@/lib/landing-clone-preview";
import { AiNowDivider } from "@/features/home/components/ainow/AiNowDivider";
import { AiNowSectionFrame } from "@/features/home/components/ainow/AiNowSectionFrame";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Integrations and data boundaries | aiAUDIT",
    description: "aiAUDIT documents what evidence and access a workflow diagnosis may require.",
    alternates: buildAlternates("/integrations", locale),
    robots: previewRobots({ index: ["ka", "en", "ru"].includes(locale), follow: true }),
  };
}

export default function IntegrationsPage() {
  return (
    <main>
      <AiNowSectionFrame id="integrations-intro" className="ainow-blueprint-bg" containerClassName="px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-headline text-3xl font-semibold text-slate-950 dark:text-white sm:text-5xl">Evidence and access boundaries</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">aiAUDIT can review public or private workflow evidence only when the owner grants permission and the boundary is agreed. A public page does not prove a live integration.</p>
      </AiNowSectionFrame>
      <AiNowDivider />
      <AiNowSectionFrame id="integrations-ledger" className="ainow-blueprint-bg" containerClassName="px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Public facts", "Business materials and process examples supplied by the decision-maker."],
            ["Permission", "Private systems, credentials and customer data are out of scope until expressly authorized."],
            ["Human review", "The process owner validates findings before any pilot or implementation decision."],
          ].map(([title, body]) => <article key={title} className="dodo-glass-card p-5"><h2 className="font-headline text-xl font-semibold text-slate-950 dark:text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p></article>)}
        </div>
        <Link href="/#cta" className="ainow-btn-primary mt-8 inline-flex">Describe a workflow</Link>
      </AiNowSectionFrame>
    </main>
  );
}
