import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { safeRedirectTarget } from '@/modules/auth/presentation/safe-redirect-target';
import { SignUpForm } from '@/modules/auth/presentation/sign-up-form';
import { resolveTenant } from '@/modules/tenancy/application/resolve-tenant';
import { Container } from '@/shared/layout/container';
import { Footer } from '@/shared/layout/footer';
import { Navbar } from '@/shared/layout/navbar';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Criar conta' };

/**
 * Standalone `/criar-conta` route.
 *
 * Renders the exact same `SignUpForm` the modal uses. Exists for the same
 * reason as `/entrar`: a redirect target for a protected route or expired
 * session (`/app`) needs a real URL, not a modal that only opens from
 * within the page.
 *
 * `?next=` — see `/entrar/page.tsx`'s comment; same sanitisation, same
 * caveat that the real enforcement is inside `signUpAction`, not here.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [tenant, { next }] = await Promise.all([
    resolveTenant((await headers()).get('host')),
    searchParams,
  ]);
  const { marketing, brand } = tenant;

  return (
    <>
      <Navbar brandName={brand.name} items={marketing.navigation} />

      <main id="conteudo" className="pt-28 pb-20 sm:pt-32 lg:pt-40">
        <Container width="narrow">
          <Text as="h1" variant="heading" className="text-center">
            Criar conta no {brand.name}
          </Text>
          <Text as="p" variant="body" className="mt-2 text-center">
            Leva menos de dois minutos. Você configura seus produtos logo depois.
          </Text>

          <Card variant="raised" padding="lg" className="mt-8">
            <SignUpForm next={safeRedirectTarget(next)} />
          </Card>
        </Container>
      </main>

      <Footer brandName={brand.name} legalName={brand.legalName} content={marketing.footer} />
    </>
  );
}
