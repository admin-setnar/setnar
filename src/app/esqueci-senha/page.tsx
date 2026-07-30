import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { ForgotPasswordForm } from '@/modules/auth/presentation/forgot-password-form';
import { resolveTenant } from '@/modules/tenancy/application/resolve-tenant';
import { Container } from '@/shared/layout/container';
import { Footer } from '@/shared/layout/footer';
import { Navbar } from '@/shared/layout/navbar';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Esqueci minha senha' };

/**
 * Standalone `/esqueci-senha` route — step 1 of the reset flow (see the
 * README's password-reset ADR). Linked from `SignInForm`.
 */
export default async function ForgotPasswordPage() {
  const tenant = await resolveTenant((await headers()).get('host'));
  const { marketing, brand } = tenant;

  return (
    <>
      <Navbar brandName={brand.name} items={marketing.navigation} />

      <main id="conteudo" className="pt-28 pb-20 sm:pt-32 lg:pt-40">
        <Container width="narrow">
          <Text as="h1" variant="heading" className="text-center">
            Esqueci minha senha
          </Text>
          <Text as="p" variant="body" className="mt-2 text-center">
            Informe o e-mail da sua conta para receber um link de redefinição.
          </Text>

          <Card variant="raised" padding="lg" className="mt-8">
            <ForgotPasswordForm />
          </Card>
        </Container>
      </main>

      <Footer brandName={brand.name} legalName={brand.legalName} content={marketing.footer} />
    </>
  );
}
