import type { Metadata } from 'next';
import { headers } from 'next/headers';

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
 * session (`/app` — Sprint B) needs a real URL, not a modal that only opens
 * from within the page.
 */
export default async function SignUpPage() {
  const tenant = await resolveTenant((await headers()).get('host'));
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
            <SignUpForm />
          </Card>
        </Container>
      </main>

      <Footer brandName={brand.name} legalName={brand.legalName} content={marketing.footer} />
    </>
  );
}
