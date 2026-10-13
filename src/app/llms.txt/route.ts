import { PUBLIC_FACTS, PUBLIC_POSITIONING, PUBLIC_PRODUCT_CATALOG, buildAiTxt } from "@/lib/public-facts";

export const dynamic = "force-static";
const FAMILY_LINKS = ["ainow.ge", "aichats.ge", "aicall.ge", "aicontent.ge", "aiads.ge", "aistaff.ge", "aibrain.ge", "aioffice.ge", "aidocs.ge", "aiweb.ge", "aiapp.ge", "vibecoding.ge", "aijurist.ge", "aimusic.ge", "airadar.ge", "aitaxi.ge"];

export function GET(): Response {
  const productLines = PUBLIC_PRODUCT_CATALOG.flatMap((product) => [
    `- ${product.name}: ${product.description}`,
    `  Price: ${product.startingPrice}; model: ${product.pricingModelLabel}.`,
  ]);
  const familyLines = FAMILY_LINKS.map((domain) => `- ${domain}: https://${domain}`);
  const body = [
    buildAiTxt(),
    "",
    "## What aiAUDIT does",
    "",
    ...PUBLIC_POSITIONING.workflow.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Product catalog",
    "",
    ...productLines,
    "",
    "## What aiAUDIT does not claim",
    "",
    "- No guaranteed ROI or universal delivery time.",
    "- No autonomous legal, medical, financial, or implementation decision.",
    "- No public numeric price until scope is agreed in writing.",
    "- Public descriptions are not runtime verification.",
    "",
    "## Machine-readable references",
    "",
    `- ${PUBLIC_FACTS.brand.url}/ai/summary.json`,
    `- ${PUBLIC_FACTS.brand.url}/ai/service.json`,
    `- ${PUBLIC_FACTS.brand.url}/ai/faq.json`,
    `- ${PUBLIC_FACTS.brand.url}/ai/catalog.json`,
    `- ${PUBLIC_FACTS.brand.url}/ai/cases.json`,
    `- ${PUBLIC_FACTS.brand.url}/llms-full.txt`,
    "",
    "## aiNOW family",
    "",
    "aiAUDIT is one product by aiNOW. Family links are navigation, not claims that this product performs every family service.",
    ...familyLines,
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
    },
  });
}
