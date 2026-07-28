import type { Metadata } from 'next';
import { headers } from 'next/headers';

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
 * session (both land on `/app` — Sprint B), and for anyone who opens the link
 * directly instead of clicking "Entrar" on the gateway page.
 */
export default async function SignInPage() {
  const tenant = await resolveTenant((await headers()).get('host'));
  const { marketing, brand } = tenant;

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
            <SignInForm />
          </Card>
        </Container>
      </main>

      <Footer brandName={brand.name} legalName={brand.legalName} content={marketing.footer} />
    </>
  );
}
