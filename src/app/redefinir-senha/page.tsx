import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { ResetPasswordForm } from '@/modules/auth/presentation/reset-password-form';
import { resolveTenant } from '@/modules/tenancy/application/resolve-tenant';
import { Container } from '@/shared/layout/container';
import { Footer } from '@/shared/layout/footer';
import { Navbar } from '@/shared/layout/navbar';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Redefinir senha' };

/**
 * Standalone `/redefinir-senha` route — step 2 (final) of the reset flow.
 * Only reachable with a real effect via `app/auth/callback/route.ts`'s
 * `redirect()`, which is what establishes the session this page's form
 * depends on; opening it directly without that session just means
 * `updatePasswordAction` returns `reset_link_expired` on submit.
 */
export default async function ResetPasswordPage() {
  const tenant = await resolveTenant((await headers()).get('host'));
  const { marketing, brand } = tenant;

  return (
    <>
      <Navbar brandName={brand.name} items={marketing.navigation} />

      <main id="conteudo" className="pt-28 pb-20 sm:pt-32 lg:pt-40">
        <Container width="narrow">
          <Text as="h1" variant="heading" className="text-center">
            Redefinir senha
          </Text>
          <Text as="p" variant="body" className="mt-2 text-center">
            Escolha uma nova senha para a sua conta.
          </Text>

          <Card variant="raised" padding="lg" className="mt-8">
            <ResetPasswordForm />
          </Card>
        </Container>
      </main>

      <Footer brandName={brand.name} legalName={brand.legalName} content={marketing.footer} />
    </>
  );
}
