import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { getCurrentTermsVersion } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { resolveTenant } from '@/modules/tenancy/application/resolve-tenant';
import { Container } from '@/shared/layout/container';
import { Footer } from '@/shared/layout/footer';
import { Navbar } from '@/shared/layout/navbar';
import { FormAlert } from '@/shared/ui/form-alert';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Política de privacidade' };

/**
 * Privacy policy.
 *
 * Describes what is actually collected as of this sprint — no more, no less
 * — including the hashed login-attempt log the rate limiter writes, which
 * exists precisely because this page is being published. Draft, pending
 * legal review before real public sign-up opens (see README, A6).
 */
export default async function PrivacyPage() {
  const tenant = await resolveTenant((await headers()).get('host'));
  const { marketing, brand, legal } = tenant;
  const version = await getCurrentTermsVersion();

  return (
    <>
      <Navbar brandName={brand.name} items={marketing.navigation} />

      <main id="conteudo" className="pt-28 pb-20 sm:pt-32 lg:pt-40">
        <Container width="narrow">
          <Text as="h1" variant="heading">
            Política de privacidade
          </Text>
          <Text as="p" variant="caption" className="mt-2">
            {version ? `Versão ${version}` : 'Versão indisponível no momento'}
          </Text>

          <FormAlert
            tone="error"
            title="Rascunho pendente de revisão jurídica"
            description="Este texto foi redigido para descrever com precisão quais dados são coletados hoje. Antes de abrir o cadastro ao público, ele precisa passar por revisão jurídica formal."
            className="mt-6"
          />

          <div className="mt-8 space-y-8">
            <section>
              <Text as="h2" variant="title">
                1. Quem controla estes dados
              </Text>
              <Text as="p" variant="body" className="mt-3">
                {brand.legalName} é a controladora dos dados pessoais tratados nesta
                plataforma, nos termos da Lei Geral de Proteção de Dados (Lei nº
                13.709/2018). Contato para qualquer assunto relacionado a dados
                pessoais:{' '}
                <a href={`mailto:${legal.contactEmail}`} className="underline underline-offset-4">
                  {legal.contactEmail}
                </a>
                .
              </Text>
            </section>

            <section>
              <Text as="h2" variant="title">
                2. Quais dados coletamos e para quê
              </Text>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <Text as="span" variant="body">
                    <strong className="text-content">Nome completo e e-mail:</strong>{' '}
                    para criar e identificar a sua conta, e para comunicação sobre ela.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    <strong className="text-content">Senha:</strong> nunca armazenada em
                    texto puro — o hash é feito pelo Supabase Auth, nosso provedor de
                    autenticação, e nós nunca temos acesso ao valor original.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    <strong className="text-content">Registro do aceite dos termos:</strong>{' '}
                    a data/hora e a versão destes documentos que você aceitou no
                    cadastro, guardadas como prova desse consentimento.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    <strong className="text-content">Identificador do tenant:</strong>{' '}
                    hoje sempre &quot;setnar&quot; — identifica em qual instância da
                    plataforma sua conta existe.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    <strong className="text-content">
                      Registro técnico de tentativas de login:
                    </strong>{' '}
                    para bloquear tentativas repetidas de acesso indevido à sua conta,
                    guardamos temporariamente um hash (não o valor original) do e-mail e
                    do endereço IP usados em cada tentativa de login malsucedida.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    <strong className="text-content">
                      Telefone e cidade do seu perfil profissional:
                    </strong>{' '}
                    se você é representante, esses dados são usados para exibir sua
                    página comercial pública e permitir que clientes entrem em contato.
                    Ficam públicos assim que sua página é publicada.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    <strong className="text-content">
                      Dados enviados por visitantes no formulário de contato (leads):
                    </strong>{' '}
                    quando alguém preenche o formulário na sua página comercial,
                    guardamos o nome, telefone, e-mail e cidade informados, para que
                    você possa atendê-lo.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    <strong className="text-content">Dados de navegação (analytics):</strong>{' '}
                    registramos visitas e cliques no botão de WhatsApp da sua página
                    comercial, junto com um hash irreversível do endereço IP (não o IP
                    em si) e a página de origem do acesso, para gerar métricas de uso.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    <strong className="text-content">Dados de pagamento (billing):</strong>{' '}
                    se você é representante e assina um plano pago, enviamos ao Asaas —
                    nosso operador de pagamentos — seu nome, CPF/CNPJ, e-mail, telefone
                    e endereço, para processar a cobrança. Esses dados ficam
                    armazenados no Asaas, não no nosso banco: nós guardamos apenas o
                    status da sua assinatura e os eventos que o Asaas nos envia sobre
                    ela.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    <strong className="text-content">Feedback qualitativo:</strong>{' '}
                    quando você responde a uma pesquisa rápida dentro do produto,
                    guardamos sua resposta associada à sua conta.
                  </Text>
                </li>
              </ul>
            </section>

            <section>
              <Text as="h2" variant="title">
                3. Com quem compartilhamos
              </Text>
              <Text as="p" variant="body" className="mt-3">
                Usamos o Supabase como operador de dados para autenticação, banco de
                dados e parte da hospedagem, e a Vercel para hospedar a aplicação —
                ambos processam os dados acima em nosso nome, sob instruções nossas. O
                projeto está hospedado na região de São Paulo, no Brasil. Se você é
                representante e assina um plano pago, usamos o Asaas como operador de
                pagamentos: ele recebe diretamente seu CPF/CNPJ, e-mail, telefone e
                endereço para processar a cobrança. Não há transferência internacional
                de dados pessoais nestes tratamentos. Não vendemos nem compartilhamos
                seus dados com terceiros para fins de marketing.
              </Text>
            </section>

            <section>
              <Text as="h2" variant="title">
                4. Por quanto tempo guardamos
              </Text>
              <Text as="p" variant="body" className="mt-3">
                Os dados da sua conta (nome, e-mail, registro de aceite) são mantidos
                enquanto a conta existir. O registro técnico de tentativas de login é
                apagado automaticamente em até 1 dia — a janela de bloqueio por
                tentativas repetidas dura só 15 minutos, mas o registro em si leva mais
                tempo para ser removido. Para os dados enviados por visitantes
                (leads), os dados de navegação (analytics) e os eventos de pagamento
                recebidos do Asaas, ainda não temos um prazo de retenção aprovado —
                isso está em definição.
              </Text>
            </section>

            <section>
              <Text as="h2" variant="title">
                5. Seus direitos como titular dos dados
              </Text>
              <Text as="p" variant="body" className="mt-3">
                Nos termos da LGPD, você pode solicitar, a qualquer momento e pelo
                e-mail{' '}
                <a href={`mailto:${legal.contactEmail}`} className="underline underline-offset-4">
                  {legal.contactEmail}
                </a>
                :
              </Text>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>
                  <Text as="span" variant="body">
                    Confirmação de que tratamos seus dados, e acesso a eles.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    Correção de dados incompletos, inexatos ou desatualizados.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    Eliminação dos dados tratados com o seu consentimento.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    Portabilidade dos seus dados a outro fornecedor de serviço.
                  </Text>
                </li>
                <li>
                  <Text as="span" variant="body">
                    Revogação do seu consentimento e informação sobre com quem
                    compartilhamos seus dados.
                  </Text>
                </li>
              </ul>
            </section>

            <section>
              <Text as="h2" variant="title">
                6. Segurança
              </Text>
              <Text as="p" variant="body" className="mt-3">
                O acesso à sua conta é protegido por senha com hash, sessão em cookie
                que não pode ser lido por JavaScript, e bloqueio automático após
                tentativas repetidas de login malsucedidas. Cada linha da nossa tabela
                de perfis só pode ser lida ou alterada pelo próprio titular da conta.
              </Text>
            </section>
          </div>
        </Container>
      </main>

      <Footer brandName={brand.name} legalName={brand.legalName} content={marketing.footer} />
    </>
  );
}
