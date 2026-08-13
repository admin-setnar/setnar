import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { getCurrentTermsVersion } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { resolveTenant } from '@/modules/tenancy/application/resolve-tenant';
import { Container } from '@/shared/layout/container';
import { Footer } from '@/shared/layout/footer';
import { Navbar } from '@/shared/layout/navbar';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Termos de uso' };

/**
 * Terms of use.
 *
 * Written to be accurate about what the product actually does today — no
 * aspirational claims about features that do not exist yet. Published as the
 * MVP/pilot version approved without formal legal counsel (SET-45); a formal
 * review is tracked separately for before commercial scale-up (SET-74).
 */
export default async function TermsPage() {
  const tenant = await resolveTenant((await headers()).get('host'));
  const { marketing, brand, legal } = tenant;
  const version = await getCurrentTermsVersion();

  return (
    <>
      <Navbar brandName={brand.name} items={marketing.navigation} />

      <main id="conteudo" className="pt-28 pb-20 sm:pt-32 lg:pt-40">
        <Container width="narrow">
          <Text as="h1" variant="heading">
            Termos de uso
          </Text>
          <Text as="p" variant="caption" className="mt-2">
            {version ? `Versão ${version}` : 'Versão indisponível no momento'}
          </Text>
          <Text as="p" variant="caption" className="mt-1">
            Documento válido para a fase piloto do {brand.name}, redigido para descrever com
            precisão o que o produto faz hoje.
          </Text>

          <div className="mt-8 space-y-8">
            <section>
              <Text as="h2" variant="title">
                1. O que é o {brand.name}
              </Text>
              <Text as="p" variant="body" className="mt-3">
                O {brand.name} é uma plataforma de presença comercial digital para
                profissionais de vendas independentes. Ao criar uma conta, você passa a
                poder acessar a área autenticada da plataforma com o e-mail e a senha
                informados no cadastro.
              </Text>
            </section>

            <section>
              <Text as="h2" variant="title">
                2. Conta e responsabilidade pelo acesso
              </Text>
              <Text as="p" variant="body" className="mt-3">
                Você é responsável por manter sua senha em sigilo e por toda atividade
                realizada com a sua conta. Avise-nos imediatamente pelo e-mail{' '}
                <a href={`mailto:${legal.contactEmail}`} className="underline underline-offset-4">
                  {legal.contactEmail}
                </a>{' '}
                se suspeitar de acesso não autorizado.
              </Text>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>
                  <Text as="span" variant="body">
                    O cadastro exige nome completo, e-mail e senha, além do aceite destes
                    termos e da política de privacidade.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    Um único e-mail corresponde a uma única conta.
                  </Text>
                </li>
              </ul>
            </section>

            <section>
              <Text as="h2" variant="title">
                3. Uso aceitável
              </Text>
              <Text as="p" variant="body" className="mt-3">
                Você concorda em não tentar contornar os limites de segurança da
                plataforma (incluindo o bloqueio de tentativas de login repetidas), não
                usar a conta de outra pessoa, e não usar o {brand.name} para qualquer
                finalidade ilícita.
              </Text>
            </section>

            <section>
              <Text as="h2" variant="title">
                4. Mudanças no serviço e nestes termos
              </Text>
              <Text as="p" variant="body" className="mt-3">
                O {brand.name} está em desenvolvimento incremental. Funcionalidades podem
                ser adicionadas ao longo do tempo. Alterações relevantes a estes termos
                serão refletidas numa nova versão, identificada pela data acima.
              </Text>
            </section>

            <section>
              <Text as="h2" variant="title">
                5. Legislação aplicável
              </Text>
              <Text as="p" variant="body" className="mt-3">
                Estes termos são regidos pela legislação brasileira. Dúvidas podem ser
                enviadas para{' '}
                <a href={`mailto:${legal.contactEmail}`} className="underline underline-offset-4">
                  {legal.contactEmail}
                </a>
                .
              </Text>
            </section>
          </div>
        </Container>
      </main>

      <Footer brandName={brand.name} legalName={brand.legalName} content={marketing.footer} />
    </>
  );
}
