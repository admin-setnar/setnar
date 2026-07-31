import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/config/site';

/**
 * The gateway plus the two mandatory legal pages — every other route is
 * either a utility/auth page (`/entrar`, `/criar-conta`, `/esqueci-senha`,
 * `/redefinir-senha`, `/app`) with nothing distinct for a search result to
 * show, or already excluded from indexing (`robots: { index: false }` on
 * `/app`/`/esqueci-senha`/`/redefinir-senha`; `disallow: ['/api/']` in
 * `robots.ts`). Add a route here only when it has real, indexable content
 * of its own.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/termos`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacidade`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
