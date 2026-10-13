import { PUBLIC_FACTS, PUBLIC_POSITIONING, PUBLIC_PRODUCT_CATALOG, PUBLIC_FAQS } from "@/lib/public-facts";

export const dynamic = "force-static";

export function GET(): Response {
  const lines = [
    "# aiAUDIT, full product reference",
    "",
    `Last reviewed: ${PUBLIC_FACTS.lastUpdated}`,
    `Canonical website: ${PUBLIC_FACTS.brand.url}`,
    `Provider: ${PUBLIC_FACTS.provider.name} (${PUBLIC_FACTS.provider.url})`,
    "",
    "## Definition",
    "",
    PUBLIC_FACTS.summary,
    "",
    "## Workflow",
    "",
    ...PUBLIC_POSITIONING.workflow.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Product",
    "",
    ...PUBLIC_PRODUCT_CATALOG.flatMap((product) => [
      `### ${product.name}`,
      "",
      product.description,
      `Price: ${product.startingPrice}.`,
      `Scope: ${product.scopeNotice}`,
      "",
    ]),
    "## Boundaries and limits",
    "",
    "- Accurate operating facts from a business decision-maker are required.",
    "- Human verification remains required.",
    "- No guaranteed ROI is established by public copy.",
    "- Implementation and integrations are separate scope.",
    "- The conclusion may be not_now.",
    "",
    "## Frequently asked questions",
    "",
    ...PUBLIC_FAQS.flatMap(({ question, answer }) => [`### ${question}`, "", answer, ""]),
    "## Verification",
    "",
    `- Product facts: ${PUBLIC_FACTS.brand.url}/ai/service.json`,
    `- Structured summary: ${PUBLIC_FACTS.brand.url}/ai/summary.json`,
    `- Structured FAQ: ${PUBLIC_FACTS.brand.url}/ai/faq.json`,
    `- Catalog: ${PUBLIC_FACTS.brand.url}/ai/catalog.json`,
    `- Provider: ${PUBLIC_FACTS.provider.name}, ${PUBLIC_FACTS.provider.url}`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
    },
  });
}
