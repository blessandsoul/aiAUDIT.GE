import { PUBLIC_FACTS } from "@/lib/public-facts";

export const revalidate = 86400;

/** aiAUDIT has no verified public customer case corpus in this candidate. */
export function GET(): Response {
  return Response.json(
    {
      schemaVersion: "aiaudit.public-cases.v1",
      name: "aiAUDIT public case studies",
      url: PUBLIC_FACTS.brand.url,
      provider: PUBLIC_FACTS.provider,
      status: "UNKNOWN",
      count: 0,
      cases: [],
      note: "No public customer case study or measured outcome is claimed by this local candidate.",
    },
    { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600" } },
  );
}
