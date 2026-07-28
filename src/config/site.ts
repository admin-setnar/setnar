/**
 * Environment-derived configuration. Never read `process.env` anywhere else.
 */
export const SITE_URL = normalizeUrl(
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://setnar.com',
);

export const DEFAULT_TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT ?? 'setnar';

/** Anchor ids shared by the navbar, the sections and the sitemap. */
export const SECTION_IDS = {
  howItWorks: 'como-funciona',
  benefits: 'recursos',
  pricing: 'precos',
  cta: 'criar-conta',
} as const;

function normalizeUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
