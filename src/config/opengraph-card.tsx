import type { Tenant } from '@/modules/tenancy/domain/tenant';

const OUTER_STYLE = {
  height: '100%',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  backgroundColor: '#14213D',
  color: '#FFFFFF',
  padding: 80,
} as const;

const HEADLINE_STYLE = {
  fontSize: 68,
  fontWeight: 600,
  letterSpacing: -2.5,
  lineHeight: 1.1,
} as const;

/**
 * The typographic social-sharing card frame — one `ImageResponse` layout
 * (logo + wordmark, two-line headline, caption), shared by every route that
 * renders an `opengraph-image` special file. Extracted out of
 * `app/opengraph-image.tsx` (SET-11) so `[productSlug]/opengraph-image.tsx`
 * can reuse the exact same visual system instead of a hand-copied second
 * version that could drift from this one.
 *
 * `brandName` is a parameter, not read from `Tenant` inside this file: the
 * Commercial Page's own card (`[productSlug]/opengraph-image.tsx`)
 * deliberately does not import tenancy, same reasoning as `SITE_NAME` in
 * `modules/representatives/presentation/commercial-page-metadata.ts` — this
 * frame stays usable by a caller that passes a literal instead.
 */
export function OpenGraphCardFrame({
  brandName,
  headline,
  headlineAccent,
  caption,
}: {
  brandName: string;
  headline: string;
  headlineAccent: string;
  caption: string;
}) {
  return (
    <div style={OUTER_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width="48" height="32" viewBox="0 0 100 66">
          <path
            fill="#FFFFFF"
            fillRule="evenodd"
            d="M0 0 H96 L100 4 V66 H4 L0 62 Z M24 15 H28 V19 H100 V27 H24 Z M0 39 H76 V51 H72 V47 H0 Z"
          />
        </svg>
        <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.5 }}>{brandName}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={HEADLINE_STYLE}>{headline}</span>
        <span style={{ ...HEADLINE_STYLE, color: '#8FA0BF' }}>{headlineAccent}</span>
      </div>

      <span style={{ fontSize: 26, color: '#A9B6CC' }}>{caption}</span>
    </div>
  );
}

/**
 * The generic card every tenant renders at its own root `/opengraph-image`.
 * Also the fallback `[productSlug]/opengraph-image.tsx` renders for a
 * `null` (unresolvable) Commercial Page — bad host, unpublished, or
 * suspended must render the identical image every other generic page on
 * that host already does, same anti-enumeration reasoning as
 * `resolveCommercialPageMetadata` returning `{}` for the same case
 * (ADR-030).
 */
export function TenantOpenGraphCard({ tenant }: { tenant: Tenant }) {
  return (
    <OpenGraphCardFrame
      brandName={tenant.brand.name}
      headline={tenant.marketing.hero.headline}
      headlineAccent={tenant.marketing.hero.headlineAccent}
      caption={tenant.brand.tagline}
    />
  );
}
