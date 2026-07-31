import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { safeRedirectTarget } from '@/modules/auth/presentation/safe-redirect-target';
import { SignInForm } from '@/modules/auth/presentation/sign-in-form';
import { resolveTenant } from '@/modules/tenancy/application/resolve-tenant';
import { Container } from '@/shared/layout/container';
import { Footer } from '@/shared/layout/footer';
import { Navbar } from '@/shared/layout/navbar';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Entrar' };

/**
 * Standalone `/entrar` route.
 *
 * Renders the exact same `SignInForm` the modal uses. Exists for the cases a
 * modal cannot serve: redirecting here from a protected route or an expired
 * session (both land on `/app`), and for anyone who opens the link directly
 * instead of clicking "Entrar" on the gateway page.
 *
 * `?next=` (Sprint B): sanitised here with the same `safeRedirectTarget` the
 * Server Action itself re-checks before calling `redirect()` — this pass is
 * for correct UX only (so the form never even holds an unsafe value), not
 * the actual security guarantee, which lives server-side in `signInAction`
 * (a Server Action is a callable POST endpoint; a client could invoke it
 * directly with an arbitrary `next` bypassing this page entirely).
 *
 * Already-signed-in visitor: redirected straight to `safeRedirectTarget(next)`
 * without rendering the form — there is no reason to ask someone with a
 * valid session to sign in again, and the same `?next=` this page would
 * otherwise pass to the form is honoured here too. `getCurrentUser()` is
 * `cache()`-wrapped (see its own doc), so this costs nothing extra beyond
 * what `app/layout.tsx` already pays once per request for the Navbar.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [tenant, { next }, user] = await Promise.all([
    resolveTenant((await headers()).get('host')),
    searchParams,
    getCurrentUser(),
  ]);
  const { marketing, brand } = tenant;

  if (user) {
    redirect(safeRedirectTarget(next));
  }

  return (
    <>
      <Navbar brandName={brand.name} items={marketing.navigation} />

      <main id="conteudo" className="pt-28 pb-20 sm:pt-32 lg:pt-40">
        <Container width="narrow">
          <Text as="h1" variant="heading" className="text-center">
            Entrar no {brand.name}
          </Text>
          <Text as="p" variant="body" className="mt-2 text-center">
            Use o e-mail cadastrado para acessar sua conta.
          </Text>

          <Card variant="raised" padding="lg" className="mt-8">
            <SignInForm next={safeRedirectTarget(next)} />
          </Card>
        </Container>
      </main>

      <Footer brandName={brand.name} legalName={brand.legalName} content={marketing.footer} />
    </>
  );
}
