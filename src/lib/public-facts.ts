import { getAiNowHomeCopy } from "@/features/home/components/ainow/AiNowHomeCopy";

/**
 * Product-owned public facts for the isolated aiAUDIT candidate.
 *
 * These values intentionally describe only what the public aiAUDIT source and
 * the 2026-10-07 product-facts receipt support. UNKNOWN is a first-class value:
 * it prevents a machine-readable surface from inventing a price, model, limit,
 * or delivery promise merely to fill a template field.
 */
export const PUBLIC_FACTS = {
  brand: {
    name: "aiAUDIT",
    legalName: "შპს ეი აი ნაუ",
    slogan: "Diagnose first. Decide clearly.",
    url: "https://aiaudit.ge",
    type: "AI business diagnostics",
  },
  provider: { name: "aiNOW", url: "https://ainow.ge", location: "Tbilisi, Georgia" },
  description:
    "aiAUDIT examines a real business workflow, separates evidence from assumptions, and recommends a measurable pilot or an honest not_now conclusion.",
  summary:
    "aiAUDIT assesses whether AI is justified for a defined business process. It requires accurate operating facts, keeps human verification visible, and does not force implementation.",
  // Company founding data belongs to aiNOW's organization record and is not
  // evidence about aiAUDIT.
  brandEstablished: "UNKNOWN",
  founded: "UNKNOWN",
  foundingDate: "UNKNOWN",
  lastUpdated: "2026-10-07",
  founder: {
    name: "Andrew Altair",
    id: "https://andrewaltair.ge/#person",
    url: "https://andrewaltair.ge/about",
    sameAs: ["https://andrewaltair.ge/about"],
  },
  site: {
    locales: ["ka", "en", "ru"],
    routeLocales: ["ka", "en", "ru", "de", "tr", "fa", "zh"],
    indexedLocales: ["ka", "en", "ru"],
    localeTags: ["ka-GE", "en-US", "ru-RU", "de-DE", "tr-TR", "fa-IR", "zh-CN"],
  },
  service: { languages: ["ka", "en", "ru"], languageNames: ["Georgian", "English", "Russian"] },
  proof: {
    // Company review destination, not proof of an aiAUDIT outcome.
    googleReviewsUrl:
      "https://maps.google.com/?cid=15533558721751972154&g_mp=CiVnb3VnbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA",
  },
  location: { city: "Tbilisi", country: "Georgia", countryCode: "GE", coordinates: { lat: 41.7151, lng: 44.8271 } },
  areaServed: ["Georgia", "Armenia", "Azerbaijan"],
  contact: {
    email: "CONTACT@aiNOW.GE",
    telegram: "https://t.me/ainow_ge",
    contactUrl: "https://aiaudit.ge/contact",
    startUrl: "https://aiaudit.ge/#cta",
  },
  companySameAs: [
    "https://maps.google.com/?cid=15533558721751972154",
    "https://www.facebook.com/ainow.ge",
    "https://www.instagram.com/ainow.ge/",
    "https://t.me/ainow_ge",
    "https://www.linkedin.com/company/ainowgeorgia",
    "https://github.com/ainowgeorgia",
  ],
} as const;

export const PUBLIC_POSITIONING = {
  model: "evidence_bound_diagnostic",
  statement:
    "aiAUDIT starts with one real business workflow, tests whether AI is justified, and writes a bounded next step or not_now conclusion.",
  buyer: "Business owners and operations leaders who need an evidence-backed AI-fit decision for a real process.",
  workflow: [
    "Describe the current workflow, volume, bottleneck, owner, and decision.",
    "Separate observed facts from hypotheses and identify evidence gaps.",
    "Compare value, implementation boundary, risk, and human verification.",
    "Recommend a bounded measurable pilot, a measurement step, or not_now.",
  ],
  standaloneProducts: "aiAUDIT is a diagnostic service; implementation is a separate scope and is not included by implication.",
  timing: {
    audit: "UNKNOWN; timing is agreed after scope and evidence are reviewed.",
    pilot: "UNKNOWN; pilot timing is scoped separately after the diagnostic.",
    implementation: "UNKNOWN; no universal delivery promise is published.",
  },
} as const;

export const TIKTOK_PRODUCT_ROADMAP = [
  {
    product: "aiAUDIT",
    domain: "https://aiaudit.ge",
    relation: "optional_public_source_context",
    status: "planned",
    availableNow: false,
    launchDate: null,
    scope: "No TikTok API capability is available through this audit preview. Do not treat a generic service-resource roadmap as an aiAUDIT capability.",
    requirements: ["TikTok application approval", "Approved scopes for the selected TikTok API", "Customer account authorization and eligibility"],
    officialSources: ["https://developers.tiktok.com/", "https://business-api.tiktok.com/portal"],
  },
] as const;

export type PublicFaq = { readonly id: string; readonly question: string; readonly answer: string };
export type PublicSiteLocale = (typeof PUBLIC_FACTS.site.routeLocales)[number];
export type PublicHomeHeroContent = {
  readonly eyebrow: string;
  readonly h1: string;
  readonly supportingSentence: string;
  readonly decorativeVerbs: readonly string[];
  readonly primaryCta: string;
  readonly proof: string;
  readonly ownerDemoRequest: string;
  readonly demoOutcome: { readonly title: string; readonly body: string };
};
export type PublicHomeContent = {
  readonly metadataTitle: string;
  readonly metadataDescription: string;
  readonly hero: PublicHomeHeroContent;
  readonly faqs: readonly PublicFaq[];
};

const HOME_SEO = {
  ka: {
    metadataTitle: "aiAUDIT — AI-ის შესაბამისობის დიაგნოსტიკა ბიზნესისთვის | aiNOW",
    metadataDescription: "aiAUDIT ამოწმებს რეალურ ბიზნესპროცესს და გირჩევთ გაზომვად პილოტს ან პატიოსან not_now დასკვნას — დანერგვის იძულების გარეშე.",
  },
  en: {
    metadataTitle: "aiAUDIT — Evidence-bound AI-fit diagnostics | aiNOW",
    metadataDescription: "aiAUDIT examines a real business workflow and recommends a measurable pilot or an honest not_now conclusion without forcing implementation.",
  },
  ru: {
    metadataTitle: "aiAUDIT — Диагностика применимости AI по фактам | aiNOW",
    metadataDescription: "aiAUDIT изучает реальный бизнес-процесс и предлагает измеримый пилот или честный вывод not_now, не навязывая внедрение.",
  },
} as const;
const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11", "q12", "q13", "q14", "q15"] as const;

function buildHomeContent(locale: string): PublicHomeContent {
  const contentLocale = locale === "ka" || locale === "ru" ? locale : "en";
  const copy = getAiNowHomeCopy(contentLocale);
  const seo = HOME_SEO[contentLocale];
  return {
    metadataTitle: seo.metadataTitle,
    metadataDescription: seo.metadataDescription,
    hero: {
      eyebrow: copy.hero.titleLine1,
      h1: `${copy.hero.titleLine1} ${copy.hero.titleLine2}`,
      supportingSentence: copy.hero.description,
      decorativeVerbs: ["maps", "checks", "measures", "rejects", "documents"],
      primaryCta: copy.hero.primaryCta,
      proof: "No numeric price or ROI guarantee is published.",
      ownerDemoRequest: copy.hero.hint,
      demoOutcome: { title: copy.process.title, body: copy.process.description },
    },
    faqs: FAQ_KEYS.map((id) => ({ id, ...copy.faq.items[id] })),
  };
}
const KA_HOME = buildHomeContent("ka");
const EN_HOME = buildHomeContent("en");
const RU_HOME = buildHomeContent("ru");
export const PUBLIC_HOME_CONTENT: Readonly<Record<PublicSiteLocale, PublicHomeContent>> = {
  ka: KA_HOME,
  en: EN_HOME,
  ru: RU_HOME,
  // English fallback only; these routes are explicitly noindex.
  de: EN_HOME,
  tr: EN_HOME,
  fa: EN_HOME,
  zh: EN_HOME,
};

export const PUBLIC_PRODUCT_CATALOG = [
  {
    id: "aiaudit",
    name: "aiAUDIT",
    url: "https://aiaudit.ge",
    label: "AI-fit business diagnostics",
    summary: PUBLIC_FACTS.summary,
    description: PUBLIC_FACTS.description,
    pricingModel: "mixed",
    pricingModelLabel: "Free first diagnostic + scoped Deep Audit",
    pricingModelDetail: "The first online diagnostic and recommendations are free with no obligation. Deep Audit pricing remains UNKNOWN until scope is written.",
    startingPrice: "Free first diagnostic",
    decisionPrompt: "When a decision-maker needs to know whether AI is justified for one real workflow.",
    sectionLabel: "AI-fit diagnosis",
    billingLabel: "Individually scoped diagnostic",
    scopeNotice: "The first online diagnostic and recommendations are free with no obligation. Deep Audit pricing is UNKNOWN.",
    rowLabels: [
      { label: "First online diagnostic", icon: "solar:monitor-bold-duotone" },
      { label: "Recommendations", icon: "solar:lightbulb-bolt-bold-duotone" },
      { label: "Deep Audit price", icon: "solar:wallet-money-bold-duotone" },
      { label: "Human review", icon: "solar:user-check-rounded-bold-duotone" },
    ],
    agentFacts: [
      { label: "First step", value: "Online diagnostic and recommendations: free, no obligation.", icon: "solar:checklist-minimalistic-bold-duotone" },
      { label: "Deep Audit", value: "Pricing UNKNOWN until scope, evidence and review depth are agreed.", icon: "solar:document-text-bold-duotone" },
      { label: "Boundary", value: "No ROI guarantee or autonomous implementation decision.", icon: "solar:shield-check-bold-duotone" },
    ],
    plans: [
      { id: "quick", name: "First online diagnostic", price: "Free", cadence: "one-time", note: "Initial diagnostic and recommendations; no obligation.", values: ["Free", "Included", "Not applicable", "Required"] },
      { id: "deep", name: "Deep Audit", price: "UNKNOWN", cadence: "by agreement", note: "Scope, evidence depth, report and price are confirmed in writing.", values: ["Scoped", "Scoped", "UNKNOWN", "Required"] },
    ],
  },
] as const;
export type PublicProduct = (typeof PUBLIC_PRODUCT_CATALOG)[number];
export const AGENT_PRODUCTS = PUBLIC_PRODUCT_CATALOG.map((product) => ({
  id: product.id,
  name: product.name,
  labelKa: "AI-ის შესაბამისობის დიაგნოსტიკა",
  url: product.url,
  summary: product.summary,
}));
export type AgentProduct = (typeof AGENT_PRODUCTS)[number];

function buildVisibleFaqs(locale: string): readonly PublicFaq[] {
  return FAQ_KEYS.map((id) => {
    const item = getAiNowHomeCopy(locale).faq.items[id];
    return { id, question: item.question, answer: item.answer };
  });
}
/** Machine FAQ is the same fifteen-item source rendered by AiNowFaq.tsx. */
export const PUBLIC_FAQS = buildVisibleFaqs("en");
export const PUBLIC_LOCALIZED_FAQS: Readonly<Record<PublicSiteLocale, readonly PublicFaq[]>> =
  Object.fromEntries(PUBLIC_FACTS.site.locales.map((locale) => [locale, buildVisibleFaqs(locale)])) as Readonly<Record<PublicSiteLocale, readonly PublicFaq[]>>;

const SERVICES = [{
  id: "aiaudit",
  name: "aiAUDIT",
  url: "https://aiaudit.ge",
  summary: PUBLIC_FACTS.summary,
  deliverables: ["workflow map", "evidence and assumption separation", "AI-fit conclusion", "bounded measurement plan"],
  limits: ["No guaranteed ROI", "No autonomous implementation", "No public numeric price confirmed"],
}] as const;
const CAPABILITIES = [
  "Conversational workflow audit",
  "Evidence-backed opportunity assessment",
  "Human-review and implementation-boundary definition",
  "Bounded pilot and measurement planning",
  "Explicit rejection when AI is not justified",
] as const;

export function getPublicMetadataTitle(locale: string): string { return getPublicHomeContent(locale).metadataTitle; }
export function getPublicMetadataDescription(locale: string): string { return getPublicHomeContent(locale).metadataDescription; }
export function getPublicHomeContent(locale: string): PublicHomeContent {
const selected = (PUBLIC_FACTS.site.locales as readonly string[]).includes(locale) ? locale : "en";
  return PUBLIC_HOME_CONTENT[selected as PublicSiteLocale];
}
export function buildAiCatalog(): Record<string, unknown> {
  return {
    schemaVersion: "aiaudit.public-product-catalog.v1",
    name: PUBLIC_FACTS.brand.name,
    url: PUBLIC_FACTS.brand.url,
    lastUpdated: PUBLIC_FACTS.lastUpdated,
    source: "aiAUDIT public service description and 2026-10-07 product-facts receipt",
    positioning: PUBLIC_POSITIONING,
    products: PUBLIC_PRODUCT_CATALOG,
  };
}
export function serializePublicAiJson(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
export function buildAiSummary(): Record<string, unknown> {
  return {
    schemaVersion: "aiaudit.public-summary.v1",
    name: PUBLIC_FACTS.brand.name,
    description: PUBLIC_FACTS.description,
    summary: PUBLIC_FACTS.summary,
    url: PUBLIC_FACTS.brand.url,
    provider: PUBLIC_FACTS.provider,
    type: PUBLIC_FACTS.brand.type,
    siteLocales: [...PUBLIC_FACTS.site.locales],
    indexedLocales: [...PUBLIC_FACTS.site.indexedLocales],
    serviceLanguages: [...PUBLIC_FACTS.service.languages],
    location: PUBLIC_FACTS.location,
    areaServed: [...PUBLIC_FACTS.areaServed],
    contact: { email: PUBLIC_FACTS.contact.email.toLowerCase() },
    positioning: PUBLIC_POSITIONING,
    productCatalog: PUBLIC_PRODUCT_CATALOG,
    reviewedOn: PUBLIC_FACTS.lastUpdated,
    evidenceBoundary: "Publicly described facts only; runtime feature verification, a binding offer, and owner acceptance are separate.",
  };
}
export function buildAiFaq(): Record<string, unknown> & { faqs: typeof PUBLIC_FAQS; localizedFaqs: typeof PUBLIC_LOCALIZED_FAQS } {
  return {
    name: PUBLIC_FACTS.brand.name,
    url: PUBLIC_FACTS.brand.url,
    sourcePage: PUBLIC_FACTS.brand.url,
    lastUpdated: PUBLIC_FACTS.lastUpdated,
    siteLocales: [...PUBLIC_FACTS.site.locales],
    indexedLocales: [...PUBLIC_FACTS.site.indexedLocales],
    serviceLanguages: [...PUBLIC_FACTS.service.languages],
    faqs: PUBLIC_FAQS,
    localizedFaqs: PUBLIC_LOCALIZED_FAQS,
  };
}
export function buildAiService(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: PUBLIC_FACTS.brand.name,
    description: PUBLIC_FACTS.description,
    url: PUBLIC_FACTS.brand.url,
    provider: PUBLIC_FACTS.provider,
    serviceType: "AI Business Audit & Diagnostics",
    audience: "Business owners, CEOs, and operations managers",
    areaServed: "GE",
    siteLocales: [...PUBLIC_FACTS.site.locales],
    indexedLocales: [...PUBLIC_FACTS.site.indexedLocales],
    serviceLanguages: [...PUBLIC_FACTS.service.languages],
    positioning: PUBLIC_POSITIONING,
    capabilities: CAPABILITIES,
    limits: ["No guaranteed ROI without human verification and actual process data", "AI may be rejected when process volume or economics do not justify it", "Accurate operating facts from the decision-maker are required", "Implementation and integrations require a separate agreed scope"],
    commitment: "Recommend AI only where the evidence supports a measurable first step.",
    services: SERVICES,
    productCatalog: PUBLIC_PRODUCT_CATALOG,
    integrations: TIKTOK_PRODUCT_ROADMAP,
    reviewedOn: PUBLIC_FACTS.lastUpdated,
  };
}
export function buildAiTxt(): string {
  return [
    "# AI Crawler Policy, aiaudit.ge",
    `# Updated: ${PUBLIC_FACTS.lastUpdated}`,
    "",
    "# Product",
    `Name: ${PUBLIC_FACTS.brand.name}`,
    `Type: ${PUBLIC_FACTS.brand.type}`,
    `Positioning: ${PUBLIC_FACTS.summary}`,
    `Provider: ${PUBLIC_FACTS.provider.name} (${PUBLIC_FACTS.provider.url})`,
    `URL: ${PUBLIC_FACTS.brand.url}`,
    `Site-Languages: ${PUBLIC_FACTS.site.locales.join(", ")}`,
    `Indexed-Languages: ${PUBLIC_FACTS.site.indexedLocales.join(", ")}`,
    `Service-Languages: ${PUBLIC_FACTS.service.languages.join(", ")}`,
    `Contact: ${PUBLIC_FACTS.contact.email}`,
    "",
    "# Default policy",
    "User-Agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /admin/",
    "",
    "# Evidence boundary",
    "Public descriptions are not runtime verification, a binding commercial offer, or an ROI guarantee.",
    "The conclusion may be a bounded pilot, a measurement step, or not_now.",
    "",
    "# Structured references",
    `Sitemap: ${PUBLIC_FACTS.brand.url}/sitemap.xml`,
    `LLMs-File: ${PUBLIC_FACTS.brand.url}/llms.txt`,
    `Summary: ${PUBLIC_FACTS.brand.url}/ai/summary.json`,
    `FAQ: ${PUBLIC_FACTS.brand.url}/ai/faq.json`,
    `Services: ${PUBLIC_FACTS.brand.url}/ai/service.json`,
    `Catalog: ${PUBLIC_FACTS.brand.url}/ai/catalog.json`,
    `Cases: ${PUBLIC_FACTS.brand.url}/ai/cases.json`,
  ].join("\n");
}
