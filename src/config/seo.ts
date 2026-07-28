import type { Metadata } from 'next';

import { SITE_URL } from '@/config/site';
import type { Tenant } from '@/modules/tenancy/domain/tenant';

/**
 * Builds the page metadata from the resolved tenant.
 *
 * Nothing here is hardcoded to one brand: a second tenant gets correct titles,
 * social cards and structured data with no code change.
 */
export function buildTenantMetadata(tenant: Tenant): Metadata {
  const title = `${tenant.brand.name} — ${tenant.brand.tagline}`;
  const description = tenant.marketing.hero.subheadline;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: `%s · ${tenant.brand.name}`,
    },
    description,
    applicationName: tenant.brand.name,
    keywords: [
      'página de vendas',
      'representante independente',
      'presença digital',
      'QR Code',
      'captação de leads',
      'ferramenta comercial',
    ],
    authors: [{ name: tenant.brand.legalName }],
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: tenant.locale.replace('-', '_'),
      url: SITE_URL,
      siteName: tenant.brand.name,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    formatDetection: { telephone: false, address: false, email: false },
  };
}

/**
 * JSON-LD describing the product. Kept minimal and truthful: no ratings, no
 * price, no claims that are not visible on the page itself.
 */
export function buildStructuredData(tenant: Tenant): string {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: tenant.brand.legalName,
        url: SITE_URL,
        description: tenant.marketing.footer.description,
        email: tenant.legal.contactEmail,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: tenant.brand.name,
        inLanguage: tenant.locale,
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        name: tenant.brand.name,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: tenant.marketing.hero.subheadline,
        url: SITE_URL,
      },
    ],
  };

  return JSON.stringify(data);
}
