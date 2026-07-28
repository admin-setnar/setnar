import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/config/site';

/**
 * Only the gateway exists today. Routes are added here as they ship — the
 * structure is in place so no one has to remember to create it later.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
