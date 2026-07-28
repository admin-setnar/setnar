import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';

import { resolveTenant } from '@/modules/tenancy/application/resolve-tenant';

/**
 * Social sharing card, generated at request time from the resolved tenant.
 *
 * Generated rather than designed as a static asset for one reason: every tenant
 * needs its own card, and nobody should have to open a design tool to add one.
 * Deliberately typographic — no photography, no claims, nothing that would need
 * a compliance review each time the copy changes.
 */
export const alt = 'Setnar';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const tenant = await resolveTenant((await headers()).get('host'));

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#14213D',
          color: '#FFFFFF',
          padding: 80,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="48" height="32" viewBox="0 0 100 66">
            <path
              fill="#FFFFFF"
              fillRule="evenodd"
              d="M0 0 H96 L100 4 V66 H4 L0 62 Z M24 15 H28 V19 H100 V27 H24 Z M0 39 H76 V51 H72 V47 H0 Z"
            />
          </svg>
          <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.5 }}>
            {tenant.brand.name}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 68, fontWeight: 600, letterSpacing: -2.5, lineHeight: 1.1 }}>
            {tenant.marketing.hero.headline}
          </span>
          <span
            style={{
              fontSize: 68,
              fontWeight: 600,
              letterSpacing: -2.5,
              lineHeight: 1.1,
              color: '#8FA0BF',
            }}
          >
            {tenant.marketing.hero.headlineAccent}
          </span>
        </div>

        <span style={{ fontSize: 26, color: '#A9B6CC' }}>{tenant.brand.tagline}</span>
      </div>
    ),
    size,
  );
}
