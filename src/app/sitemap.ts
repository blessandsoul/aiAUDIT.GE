import type { MetadataRoute } from "next";
import { getPosts, getAvailableLocales } from "@/features/blog/lib/api";
import { INDEXED_LOCALES, getPageLocales } from "@/i18n/seo-locales";
import { APP_DOMAIN, SITE_CONTENT_UPDATED } from "@/lib/constants/app.constants";

const BASE_URL = `https://${APP_DOMAIN}`;
// Sitemap advertises only indexed locales. Single source of truth: src/i18n/seo-locales.ts.
// Previously this listed tr/fa/zh (empty) and excluded de, disagreeing with the page-source
// hreflang and feeding the audit's cross-source hreflang conflicts.

// Explicit content revision date; unrelated deployments do not claim fresh copy.
const BUILD_DATE = new Date(SITE_CONTENT_UPDATED);

type StaticPriority = { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] };

const OWNER_AUXILIARY_PATHS = new Set<string>(["/products", "/projects", "/reviews"]);

const OWNER_REFERENCE_PAGE_PATHS = new Set<string>(["/about"]);

const STATIC_PAGES: StaticPriority[] = [
  { path: "", priority: 1.0, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/integrations", priority: 0.8, changeFrequency: "monthly" },
  { path: "/security", priority: 0.8, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.9, changeFrequency: "daily" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.7, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/refund", priority: 0.3, changeFrequency: "yearly" },
];

function buildLanguageAlternates(path: string, locales: readonly string[]): Record<string, string> {
  const base: Record<string, string> = Object.fromEntries(
    locales.map((loc) => [
      loc,
      loc === "ka" ? `${BASE_URL}${path}` : `${BASE_URL}/${loc}${path}`,
    ]),
  );
  // x-default = Georgian (primary market)
  base["x-default"] = `${BASE_URL}${path}`;
  return base;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = STATIC_PAGES.filter(({ path }) => !OWNER_REFERENCE_PAGE_PATHS.has(path)).filter(({ path }) => !OWNER_AUXILIARY_PATHS.has(path)).flatMap(({ path, priority, changeFrequency }) =>
    getPageLocales(path).map((loc) => ({
      url: loc === "ka" ? `${BASE_URL}${path}` : `${BASE_URL}/${loc}${path}`,
      lastModified: BUILD_DATE,
      changeFrequency,
      priority,
      alternates: {
        languages: buildLanguageAlternates(path, getPageLocales(path)),
      },
    })),
  );

  const postsByLocale = new Map(await Promise.all(INDEXED_LOCALES.map(async locale => [locale, await getPosts(locale)] as const)));
  const slugs = [...new Set([...postsByLocale.values()].flatMap(posts => posts.map(post => post.slug)))];
  const blogPages: MetadataRoute.Sitemap = slugs.flatMap((slug) => {
    const locales = getAvailableLocales(slug);
    const languages: Record<string, string> = {};
    for (const loc of locales) {
      languages[loc] =
        loc === "ka"
          ? `${BASE_URL}/blog/${slug}`
          : `${BASE_URL}/${loc}/blog/${slug}`;
    }
    // x-default points to Georgian original
    if (locales.includes("ka")) {
      languages["x-default"] = `${BASE_URL}/blog/${slug}`;
    } else if (locales[0]) {
      languages["x-default"] = languages[locales[0]];
    }

    return locales.map((loc) => {
      const post = postsByLocale.get(loc as typeof INDEXED_LOCALES[number])?.find(post => post.slug === slug);
      const modified = post?.updated || post?.date;
      return {
        url: loc === "ka" ? `${BASE_URL}/blog/${slug}` : `${BASE_URL}/${loc}/blog/${slug}`,
        lastModified: modified ? new Date(modified) : BUILD_DATE,
        changeFrequency: "monthly" as const,
        priority: 0.8,
        alternates: { languages },
        // Next's sitemap serializer inserts image URLs without XML escaping.
        ...(post?.coverImage ? { images: [new URL(post.coverImage, BASE_URL).toString().replaceAll('&', '&amp;')] } : {}),
      };
    });
  });

  // Tag pages are intentionally excluded from the sitemap: they are thin,
  // locale-specific aggregation pages marked noindex. Listing them caused
  // stale-slug 404s and "crawled, not indexed" noise in Search Console.
  return [...staticPages, ...blogPages];
}
