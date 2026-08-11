import type { Metadata } from 'next';
import { headers } from 'next/headers';

import type { AuthErrorCode } from '@/modules/auth/domain/auth';
import { ForgotPasswordForm } from '@/modules/auth/presentation/forgot-password-form';
import { resolveTenant } from '@/modules/tenancy/application/resolve-tenant';
import { Container } from '@/shared/layout/container';
import { Footer } from '@/shared/layout/footer';
import { Navbar } from '@/shared/layout/navbar';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = {
  title: 'Esqueci minha senha',
  robots: { index: false, follow: false },
};

/**
 * Standalone `/esqueci-senha` route — step 1 of the reset flow (see the
 * README's password-reset ADR). Linked from `SignInForm`.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const tenant = await resolveTenant((await headers()).get('host'));
  const { marketing, brand } = tenant;

  // `app/auth/callback/route.ts` (SET-40) redirects here with
  // `?error=reset_link_expired` when the e-mail link couldn't be used —
  // wrong device, expired, or already used. Allow-listed to that one
  // literal value on purpose: this is a query string sent over e-mail, so
  // it's exactly as attacker-reachable as any other entry point, and
  // nothing here should reflect arbitrary text back into the page.
  const { error } = await searchParams;
  const initialFailureCode: AuthErrorCode | null = error === 'reset_link_expired' ? error : null;

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
            <ForgotPasswordForm initialFailureCode={initialFailureCode} />
          </Card>
        </Container>
      </main>

      <Footer brandName={brand.name} legalName={brand.legalName} content={marketing.footer} />
    </>
  );
}
