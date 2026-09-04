/**
 * SITE CONFIGURATION — aiAUDIT.ge
 */

export const SITE = {
  /** Machine key. Lands on <html data-product> and is the deploy smoke-test hook. */
  key: "aiaudit",

  domain: "aiaudit.ge",
  baseUrl: "https://aiaudit.ge",

  /** Rendered as <prefix><mark> by the nav, hero, footer and wordmark band. */
  wordmark: { prefix: "ai", mark: "AUDIT" },

  /** The product colour. `brand.css` is generated from this; keep them in step. */
  brandHex: "#059669",

  /** Three hexes the hero grainient shader interpolates: light, brand, mid. */
  shader: ["#a7f3d0", "#059669", "#34d399"] as [string, string, string],

  /** i18n settings */
  defaultLocale: "ka",
  locales: ["ka", "en", "ru"],

  /** PWA manifest */
  manifest: {
    name: "aiAUDIT",
    short: "aiAUDIT",
    description: "AI Business Diagnostics & Readiness Audit by aiNOW",
    background: "#fbfcfc",
    theme: "#18181b",
  },

  /** Machine-readable SEO & LLM Metadata */
  seo: {
    disambiguating: "aiAUDIT diagnoses business processes and identifies measurable AI opportunities; it is not a generic chatbot or an unverified product selector.",
    serviceType: "AI Business Audit & Diagnostics",
    audienceName: "Business Owners, CEOs, and Operations Managers",
    areaServed: "GE",
    knowsAbout: [
      "Artificial Intelligence",
      "Business Process Optimization",
      "AI Feasibility Analysis",
      "Customer Support Automation",
      "Marketing ROI Optimization",
      "Workflow Automation",
      "AI Readiness Assessment"
    ],
    features: [
      "Interactive conversational audit of actual business operations and workflows",
      "Evidence-backed causal analysis of bottlenecks in communication, marketing, and operations",
      "Feasibility and ROI ranking for AI implementation without artificial sales pressure",
      "Bounded, measurable pilot project roadmap for verified opportunities",
      "Objective recommendation of zero to three suitable AI solutions or explicit rejection when AI is not justified"
    ],
    boundary: "aiAUDIT diagnoses where AI delivers value; sibling platforms like aiSTAFF, aiADS, and aiDOCS execute the respective specialized implementations.",
    limits: [
      "Does not guarantee automatic ROI without human verification and actual process data",
      "Will explicitly decline to recommend AI when current process volume or economics do not warrant automation",
      "Requires accurate operational facts from the business decision-maker"
    ],
    commitment: "We only recommend AI solutions where there is a clear, evidence-backed business case and a measurable first pilot.",
    summary: "aiAUDIT is the diagnostic platform of the aiNOW ecosystem, helping business owners discover where AI can genuinely improve customer support, marketing, and internal operations.",
  },
} as const;
