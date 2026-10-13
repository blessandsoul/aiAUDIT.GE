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
    title: "Security and human control | aiAUDIT",
    description: "How aiAUDIT keeps access, evidence and human review visible during a business workflow diagnosis.",
    alternates: buildAlternates("/security", locale),
    robots: previewRobots({ index: ["ka", "en", "ru"].includes(locale), follow: true }),
  };
}

export default function SecurityPage() {
  return (
    <main>
      <AiNowSectionFrame id="security-intro" className="ainow-blueprint-bg" containerClassName="px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-headline text-3xl font-semibold text-slate-950 dark:text-white sm:text-5xl">Security starts with the boundary</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">aiAUDIT requires an agreed data boundary, names the responsible process owner and keeps uncertain or sensitive decisions with a person. Public copy does not establish certification, runtime coverage or legal compliance.</p>
      </AiNowSectionFrame>
      <AiNowDivider />
      <AiNowSectionFrame id="security-controls" className="ainow-blueprint-bg" containerClassName="px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["Source access", "Use the minimum agreed material. Private access is never assumed."],
            ["Actions", "The diagnostic recommends; it does not silently mutate systems or send customer messages."],
            ["Approval", "A named person validates evidence, scope and the next measurement."],
            ["Not_now", "Weak fit, insufficient evidence or unacceptable risk can stop the next step."],
          ].map(([title, body]) => <article key={title} className="dodo-glass-card p-5"><h2 className="font-headline text-xl font-semibold text-slate-950 dark:text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p></article>)}
        </div>
        <Link href="/#cta" className="ainow-btn-primary mt-8 inline-flex">Describe a workflow</Link>
      </AiNowSectionFrame>
    </main>
  );
}
