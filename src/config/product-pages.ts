import type { ProductPagesConfig } from '@/features/product-pages/types';

/**
 * Product-owned publication facts.
 *
 * This is the secondary-page equivalent of site.ts: shared components may read
 * it, but the family sync tool never overwrites it. Do not put JSX, CSS, prices
 * or prose fragments here. Commercial records and translated copy are added by
 * the product-specific data adapters in the page implementation.
 */
export const PRODUCT_PAGES: ProductPagesConfig = {
  pricing: {
    status: 'off',
    mode: 'project',
  },
  contact: {
    status: 'public',
  },
  blog: {
    status: 'public',
  },
  integrations: {
    status: 'off',
    records: [
      {
        id: 'website',
        name: 'Website',
        icon: 'solar:global-bold-duotone',
        category: 'businessSystems',
        connection: 'custom',
        status: 'customSetup',
        dataFlow: 'websiteEvents',
      },
      {
        id: 'forms',
        name: 'Forms',
        icon: 'solar:document-text-bold-duotone',
        category: 'businessSystems',
        connection: 'custom',
        status: 'customSetup',
        dataFlow: 'forms',
      },
      {
        id: 'tiktok-roadmap',
        name: 'TikTok API',
        icon: 'solar:videocamera-record-bold-duotone',
        category: 'contentAndAdvertising',
        connection: 'planned',
        status: 'planned',
        dataFlow: 'websiteEvents',
        machineDescription:
          'Official TikTok API connection is planned and is not currently available.',
        requirements: [
          'TikTok application approval',
          'Approved API scopes',
          'Eligible customer account and regional availability',
        ],
        officialSources: [
          'https://developers.tiktok.com/',
          'https://business-api.tiktok.com/portal',
        ],
      },
    ],
  },
  security: {
    status: 'public',
  },
  privacy: {
    status: 'public',
  },
  terms: {
    status: 'public',
  },
  cookies: {
    status: 'off',
  },
  solutions: {
    status: 'off',
    slugs: [],
  },
  localeNamespaces: {
    ka: [
      'productPages.common',
      'productPages.pricing',
      'productPages.contact',
      'productPages.integrations',
      'productPages.security',
      'productPages.privacy',
      'productPages.terms',
    ],
    en: [
      'productPages.common',
      'productPages.pricing',
      'productPages.contact',
      'productPages.integrations',
      'productPages.security',
      'productPages.privacy',
      'productPages.terms',
    ],
    ru: [
      'productPages.common',
      'productPages.pricing',
      'productPages.contact',
      'productPages.integrations',
      'productPages.security',
      'productPages.privacy',
      'productPages.terms',
    ],
  },
} as const satisfies ProductPagesConfig;
