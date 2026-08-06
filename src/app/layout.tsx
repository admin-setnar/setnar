import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

// The brand typeface is self-hosted rather than fetched from Google Fonts:
// no third-party request at runtime, no build-time network dependency, and
// nothing for a privacy review to flag later.
import '@fontsource-variable/plus-jakarta-sans';
import '@/app/globals.css';

import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { AuthProvider } from '@/modules/auth/presentation/auth-context';
import { AuthModalProvider } from '@/modules/auth/presentation/hooks/use-auth-modal';
import { AuthModals } from '@/modules/auth/presentation/auth-modals';
import { resolveTenant } from '@/modules/tenancy/application/resolve-tenant';
import { toClientView } from '@/modules/tenancy/domain/tenant';
import { BrandTokensStyle } from '@/modules/tenancy/presentation/brand-tokens';
import { TenantProvider } from '@/modules/tenancy/presentation/tenant-context';
import { buildTenantMetadata } from '@/config/seo';

/**
 * Root layout.
 *
 * Resolves the tenant once per request and makes it available to both Server
 * Components (as props) and Client Components (through TenantProvider). This
 * is the only place tenant resolution happens.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await resolveTenant((await headers()).get('host'));
  return buildTenantMetadata(tenant);
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f19' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [tenant, user] = await Promise.all([
    resolveTenant((await headers()).get('host')),
    getCurrentUser(),
  ]);

  return (
    <html lang={tenant.locale} className="scroll-smooth">
      <head>
        <BrandTokensStyle tokens={tenant.brand.tokens} />
      </head>
      <body className="font-sans">
        <a
          href="#conteudo"
          className="sr-only rounded-md bg-brand px-4 py-2 text-brand-contrast focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          Ir para o conteúdo principal
        </a>

        <TenantProvider tenant={toClientView(tenant)}>
          <AuthProvider authenticated={user !== null}>
            <AuthModalProvider>
              {children}
              <AuthModals />
            </AuthModalProvider>
          </AuthProvider>
        </TenantProvider>
      </body>
    </html>
  );
}
