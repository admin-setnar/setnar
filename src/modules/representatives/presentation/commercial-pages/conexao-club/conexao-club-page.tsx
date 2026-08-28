// Self-hosted fonts, scoped to Commercial Pages only via `.page` in the CSS module —
// see `commercial-page-base.module.css`'s header comment.
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';

import clubStyles from '@/modules/representatives/presentation/commercial-pages/conexao-club/conexao-club.module.css';
import { ClubCategoryWidget } from '@/modules/representatives/presentation/commercial-pages/conexao-club/club-category-widget';
import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';
import { CommercialPageHeader } from '@/modules/representatives/presentation/commercial-pages/commercial-page-header';
import { HeroSection } from '@/modules/representatives/presentation/commercial-pages/hero-section';
import { TrustStrip } from '@/modules/representatives/presentation/commercial-pages/trust-strip';
import { ConsultorSection } from '@/modules/representatives/presentation/commercial-pages/consultor-section';
import { CommercialLeadForm } from '@/modules/representatives/presentation/commercial-pages/commercial-lead-form';
import { StepsSection } from '@/modules/representatives/presentation/commercial-pages/steps-section';
import { FaqSection } from '@/modules/representatives/presentation/commercial-pages/faq-section';
import { CtaFinalSection } from '@/modules/representatives/presentation/commercial-pages/cta-final-section';
import { CommercialPageFooter } from '@/modules/representatives/presentation/commercial-pages/commercial-page-footer';
import { FloatingWhatsapp } from '@/modules/representatives/presentation/commercial-pages/floating-whatsapp';
import type { OriginId } from '@/modules/analytics/domain/origin';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';

const CATEGORIES = [
  ['🛒', 'Supermercados'],
  ['🍽️', 'Alimentação'],
  ['✈️', 'Viagens'],
  ['🎬', 'Lazer'],
  ['🛍️', 'Compras online'],
  ['⛽', 'Combustível'],
  ['💊', 'Farmácias'],
  ['➕', 'E muito mais'],
] as const;

/**
 * Literal 1:1 port of templates/commercial-pages/ConexaoClub/index.html —
 * see docs/adr/ADR-089 for why this replaced the shared-shell approach
 * (ADR-088) that rendered every product through the same generic
 * Text/Card/Button components.
 */
export function ConexaoClubPage({
  representative,
  product,
  productSlug,
  leadFormDisabled = false,
  origin,
}: {
  representative: Representative;
  product: RepresentativeProduct;
  productSlug: string;
  leadFormDisabled?: boolean;
  origin: OriginId | null;
}) {
  return (
    <main id="conteudo" className={styles.page}>
      <CommercialPageHeader
        representative={representative}
        product={product}
        productName="Conexão Club"
        headerMessage="Olá! Quero saber mais sobre o Conexão Club."
        origin={origin}
      />

      <HeroSection
        representative={representative}
        product={product}
        eyebrow="Clube de benefícios"
        headline="Economize todos os dias em mais de 600 mil produtos e serviços, no Brasil inteiro."
        subhead="Supermercado, farmácia, combustível, viagem e lazer com desconto exclusivo. Você ativa uma vez e usa sempre que quiser."
        ctaMessage="Olá! Quero ativar meu Conexão Club."
        ctaLabel="Quero ativar meu Club"
        heroNote="Ativação rápida pelo app · Valor confirmado no WhatsApp"
        widget={<ClubCategoryWidget representative={representative} product={product} origin={origin} />}
        origin={origin}
      />

      <TrustStrip points={['+600 mil produtos e serviços', 'Ativação rápida pelo app', 'Sem trocar de distribuidora ou operadora']} />

      <ConsultorSection representative={representative} product={product} origin={origin} />

      <section id="quero-simular">
        <div className={styles.container}>
          <CommercialLeadForm
            productSlug={productSlug}
            representativeId={representative.id}
            title="Prefere que a gente te chame?"
            description="Deixe seus dados que entramos em contato, sem compromisso."
            submitLabel="Prefiro que me chamem"
            privacyNote="Seus dados são usados apenas para entrarmos em contato sobre a ativação. Nada de spam."
            successDescription="Nossa equipe entra em contato em breve para ativar seu acesso ao clube de benefícios, sem compromisso."
            disabled={leadFormDisabled}
            origin={origin}
          />
        </div>
      </section>

      <StepsSection
        title="Como funciona, em 4 passos"
        intro="Ativa uma vez, usa sempre que quiser."
        steps={[
          { title: 'Você ativa o Club', description: 'Rápido, direto pelo WhatsApp com seu licenciado.' },
          { title: 'Baixa o app iGreen Club', description: 'Disponível para Android e iOS.' },
          { title: 'Escolhe o parceiro', description: 'Busca por categoria ou pelo estabelecimento mais perto de você.' },
          { title: 'Aproveita o desconto', description: 'Direto na hora da compra, sem burocracia.' },
        ]}
      />

      <section className={styles.sectionAlt}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2>Categorias com desconto</h2>
            <p>Uma pequena amostra do que você encontra no app.</p>
          </div>
          <div className={clubStyles.categoriasGrid}>
            {CATEGORIES.map(([emoji, label]) => (
              <div className={clubStyles.categoriaCard} key={label}>
                <span className={clubStyles.emoji} aria-hidden="true">
                  {emoji}
                </span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FaqSection
        intro="As dúvidas que mais recebemos, respondidas direto."
        items={[
          {
            question: 'Preciso ser cliente de outro produto iGreen para ter o Club?',
            answer: 'Não. O Conexão Club é um clube de benefícios independente, você pode ativá-lo mesmo sem contratar outro produto iGreen.',
          },
          {
            question: 'Quanto custa a assinatura?',
            answer: 'O valor é confirmado direto com seu licenciado no WhatsApp, junto com as formas de pagamento disponíveis.',
          },
          {
            question: 'Posso cancelar quando quiser?',
            answer: 'Sim. As condições exatas de cancelamento são confirmadas no momento da ativação.',
          },
          {
            question: 'Como uso os descontos no dia a dia?',
            answer:
              'Pelo aplicativo iGreen Club: você busca o parceiro mais próximo ou por categoria, e o desconto é aplicado direto na compra, conforme as regras de cada parceiro.',
          },
          {
            question: 'O clube funciona em todo o Brasil?',
            answer: 'Sim, a rede de parceiros está distribuída em todo o território nacional, embora a quantidade de opções possa variar conforme a sua região.',
          },
        ]}
      />

      <CtaFinalSection
        representative={representative}
        product={product}
        title="Fale agora e ative seu Conexão Club em poucos minutos"
        description="É só chamar no WhatsApp. Sem compromisso, sem letras miúdas."
        message="Olá! Quero ativar meu Conexão Club agora."
        origin={origin}
      />

      <CommercialPageFooter
        representative={representative}
        productSlug={productSlug}
        disclaimer="Conexão Club — clube de benefícios comercializado por licenciados autorizados iGreen Energy. Rede de parceiros e condições sujeitas a alteração sem aviso prévio."
        dataCollectedNote="Seus dados (nome, WhatsApp, cidade e e-mail) são usados apenas para contato sobre a ativação do Club, em conformidade com a LGPD (Lei nº 13.709/2018), e não são compartilhados com terceiros."
      />

      <FloatingWhatsapp representative={representative} product={product} message="Olá! Quero saber mais sobre o Conexão Club." origin={origin} />
    </main>
  );
}
