// Self-hosted fonts, scoped to Commercial Pages only via `.page` in the CSS
// module — see `commercial-page-base.module.css`'s header comment.
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';

import local from '@/modules/representatives/presentation/commercial-pages/conexao-expansao/conexao-expansao.module.css';
import { ExpansionHeroWidget } from '@/modules/representatives/presentation/commercial-pages/conexao-expansao/expansion-hero-widget';
import { CareerLadderStrip } from '@/modules/representatives/presentation/commercial-pages/conexao-expansao/career-ladder-strip';
import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';
import { CommercialPageHeader } from '@/modules/representatives/presentation/commercial-pages/commercial-page-header';
import { HeroSection } from '@/modules/representatives/presentation/commercial-pages/hero-section';
import { ConsultorSection } from '@/modules/representatives/presentation/commercial-pages/consultor-section';
import { CommercialLeadForm } from '@/modules/representatives/presentation/commercial-pages/commercial-lead-form';
import { LeadSection, CardsSection, CheckedListSection } from '@/modules/representatives/presentation/commercial-pages/content-sections';
import { StepsSection } from '@/modules/representatives/presentation/commercial-pages/steps-section';
import { FaqSection } from '@/modules/representatives/presentation/commercial-pages/faq-section';
import { CtaFinalSection } from '@/modules/representatives/presentation/commercial-pages/cta-final-section';
import { CommercialPageFooter } from '@/modules/representatives/presentation/commercial-pages/commercial-page-footer';
import { FloatingWhatsapp } from '@/modules/representatives/presentation/commercial-pages/floating-whatsapp';
import type { OriginId } from '@/modules/analytics/domain/origin';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';

/**
 * The 8th Commercial Page (ADR-095) — its own independent presentation tree
 * per ADR-089, exactly like the other seven. Unlike those seven, there is no
 * `templates/commercial-pages/ConexaoExpansao/index.html` reference: this
 * content was authored directly for this implementation from
 * `docs/igreen/conexao-expansao.txt` (reference material supplied by the
 * Product Owner, NOT independently verified against iGreen's authenticated
 * Academy — see `docs/plans/CONEXAO_EXPANSAO_PLAN_V2.md` §3), filtered
 * through the Product Owner's explicit instruction that this be an
 * acquisition/conversion page, not a transcription of the source
 * regulation.
 *
 * By product decision (not a technical constraint): no exact R$/% figures,
 * no royalty tables, no qualification point thresholds, no income
 * projection or calculator appear on this page. What appears is confirmed
 * by `docs/igreen/conexao-expansao.txt` only for its *structure* (direct/
 * indirect bonus + royalties by qualification; Connect Plus vs Connect
 * Full; a 5-tier career ladder) — never for a specific value, which stays
 * behind "consulte as regras vigentes" / a conversation with the
 * Representative, matching what iGreen's own public site and independent
 * Representatives' own sites already do (CONEXAO_EXPANSAO_PLAN_V2.md §3).
 */
export function ConexaoExpansaoPage({
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
  const firstName = representative.name.split(' ')[0];

  return (
    <main id="conteudo" className={styles.page}>
      <CommercialPageHeader
        representative={representative}
        product={product}
        productName="Conexão Expansão"
        headerMessage="Olá! Quero saber mais sobre a Conexão Expansão."
        origin={origin}
      />

      <HeroSection
        representative={representative}
        product={product}
        eyebrow="Oportunidade de expansão"
        headline="Construa sua própria rede. Expanda sua atuação com a iGreen."
        subhead="Apresente a Conexão Expansão para novas pessoas e participe da estrutura de bonificações prevista pelo programa, conforme sua rede se desenvolve."
        ctaMessage="Olá! Quero conhecer a Conexão Expansão."
        ctaLabel="Quero conhecer a Conexão Expansão"
        heroNote="Bonificações sujeitas às condições vigentes do programa · Sem garantia de renda ou resultado"
        widget={<ExpansionHeroWidget />}
        origin={origin}
      />

      <div className={styles.container}>
        <div className={local.heroSecondaryCta}>
          <a href="#como-funciona">Ver como funciona ↓</a>
        </div>
      </div>

      <ConsultorSection representative={representative} product={product} origin={origin} />

      <LeadSection>
        <CommercialLeadForm
          productSlug={productSlug}
          representativeId={representative.id}
          title="Quer saber mais sobre a Conexão Expansão?"
          description={`Deixe seus dados e ${firstName} poderá entrar em contato para explicar como funciona.`}
          submitLabel="Quero saber mais"
          privacyNote="Seus dados são usados apenas para contato sobre a Conexão Expansão. Nada de spam."
          successDescription="Nossa equipe entra em contato para explicar como a Conexão Expansão funciona, sem compromisso."
          disabled={leadFormDisabled}
          origin={origin}
        />
      </LeadSection>

      <CardsSection
        id="o-que-e"
        title="O que é a Conexão Expansão"
        intro="A oportunidade de apresentar a iGreen para novas pessoas e construir sua própria rede."
      >
        <p>
          A Conexão Expansão é a forma de você apresentar a iGreen para novas pessoas, que podem se tornar
          licenciados autorizados e desenvolver sua própria equipe — além de trabalhar os produtos iGreen, você
          participa da estrutura de bonificações prevista para quem expande a rede.
        </p>
        <p>Funciona em duas modalidades de licença, Connect Plus e Connect Full — veja a diferença mais abaixo.</p>
      </CardsSection>

      <StepsSection
        title="Como funciona"
        intro="Do primeiro contato até a estrutura de bonificações da sua rede."
        steps={[
          { title: 'Você apresenta a oportunidade', description: 'A pessoa conhece a Conexão Expansão através de você.' },
          { title: 'Ela decide participar', description: 'O interessado segue o processo aplicável para se tornar licenciado.' },
          { title: 'A conexão pode gerar bonificação', description: 'Conforme a modalidade escolhida e as regras vigentes.' },
          { title: 'Sua rede pode crescer', description: 'A evolução da rede e da sua qualificação pode habilitar outras formas de remuneração previstas pelo programa.' },
        ]}
      />

      <CardsSection
        id="plus-x-full"
        title="Connect Plus × Connect Full"
        intro="As duas modalidades de licença para a Conexão Expansão."
        alt
      >
        <p>
          As duas modalidades seguem a mesma estrutura de bonificação — a diferença está nos valores, maiores na
          Connect Full. As condições completas de cada modalidade podem ser explicadas por {firstName}.
        </p>
      </CardsSection>

      <CardsSection
        id="formas-de-bonificacao"
        title="Formas de bonificação"
        intro="Três formas de participar da estrutura de bonificações da Conexão Expansão."
      >
        <div className={local.bonusGrid}>
          <article className={local.bonusCard}>
            <h3>Conexão direta</h3>
            <p>Conexões realizadas diretamente por você.</p>
          </article>
          <article className={local.bonusCard}>
            <h3>Conexão indireta</h3>
            <p>Conexões originadas da sua equipe, sujeitas às condições aplicáveis.</p>
          </article>
          <article className={local.bonusCard}>
            <h3>Royalties</h3>
            <p>Remuneração adicional vinculada à sua qualificação e ao desenvolvimento da sua rede, conforme as regras vigentes.</p>
          </article>
        </div>
        <p className={local.proNote}>
          Algumas dessas bonificações dependem de você manter a atividade e o status previstos nas regras vigentes do
          programa.
        </p>
      </CardsSection>

      <CardsSection id="evolucao" title="Evolução" intro="Conforme sua rede cresce, você pode avançar de nível." alt>
        <CareerLadderStrip />
        <p className={local.proNote}>
          Cada nível possui critérios próprios de qualificação, disponíveis nas regras vigentes da Conexão Expansão.
        </p>
      </CardsSection>

      <CheckedListSection
        id="transparencia"
        title="Antes de conversar com a gente"
        intro="O que preferimos deixar claro logo de início."
        icons={['i', 'i', 'i']}
        items={[
          'As regras, critérios e condições da Conexão Expansão seguem as condições vigentes definidas pela iGreen e podem ser atualizadas.',
          <>
            Consulte as regras oficiais ou converse com <strong>{firstName}</strong> para entender os detalhes
            completos.
          </>,
          'Resultados individuais dependem da sua própria atuação e da sua rede — não há garantia de renda ou resultado.',
        ]}
      />

      <FaqSection
        intro="As dúvidas que mais recebemos, respondidas direto."
        items={[
          {
            question: 'O que é a Conexão Expansão?',
            answer:
              'É a forma de apresentar a oportunidade de se tornar licenciado iGreen para novas pessoas, participando da estrutura de bonificações prevista pelo programa.',
          },
          {
            question: 'Como funciona?',
            answer:
              'Você apresenta a oportunidade, a pessoa decide participar e segue o processo de ativação da licença. Conforme a estrutura da sua rede evolui, outras formas de bonificação previstas pelo programa podem ser habilitadas.',
          },
          {
            question: 'Quem pode participar?',
            answer: 'Licenciados autorizados iGreen que queiram apresentar a oportunidade para novas pessoas.',
          },
          {
            question: 'Como funcionam as bonificações?',
            answer:
              'Existem bonificações por conexão direta, por conexão indireta (feita pela sua equipe) e royalties conforme sua qualificação. Os valores e as condições completas seguem as regras vigentes da Conexão Expansão.',
          },
          {
            question: 'Preciso montar uma equipe?',
            answer:
              'Não necessariamente — a conexão direta já participa da estrutura de bonificações. Formar e desenvolver uma equipe pode habilitar formas adicionais de remuneração, conforme as regras vigentes.',
          },
          {
            question: 'Qual a diferença entre Connect Plus e Connect Full?',
            answer: (
              <>
                As duas modalidades seguem a mesma estrutura de bonificação, com valores maiores na Connect Full. As
                condições completas de cada uma podem ser explicadas por <strong>{firstName}</strong>.
              </>
            ),
          },
          {
            question: 'Onde vejo as regras completas?',
            answer: (
              <>
                Fale com <strong>{firstName}</strong> ou consulte as regras oficiais da Conexão Expansão.
              </>
            ),
          },
        ]}
      />

      <CtaFinalSection
        representative={representative}
        product={product}
        title="Quer entender como a Conexão Expansão funciona na prática?"
        description="Sem compromisso — é só chamar no WhatsApp."
        message="Olá! Quero entender como a Conexão Expansão funciona na prática."
        buttonLabel={`Falar com ${firstName}`}
        origin={origin}
      />

      <CommercialPageFooter
        representative={representative}
        productSlug={productSlug}
        disclaimer={EXPANSAO_DISCLAIMER}
        dataCollectedNote="Seus dados (nome, WhatsApp, cidade e e-mail) são usados apenas para contato sobre a Conexão Expansão, em conformidade com a LGPD (Lei nº 13.709/2018), e não são compartilhados com terceiros."
      />

      <FloatingWhatsapp
        representative={representative}
        product={product}
        message="Olá! Quero saber mais sobre a Conexão Expansão."
        origin={origin}
      />
    </main>
  );
}

/**
 * `COMPLIANCE DISCLAIMER SOURCE: UNRESOLVED` — CONEXAO_EXPANSAO_PLAN_V2.md
 * §1/§12/§14. No approved compliance source exists for recruiting/
 * compensation-plan content, the way `product-compliance-notice.ts` has one
 * per category for the other seven products (and that mechanism is not, in
 * practice, wired into any of those seven pages either — each carries its
 * own literal `disclaimer` string here, exactly like this one). This text
 * makes no claim beyond what the rest of the page already states (no
 * figures, no guarantees) and is NOT reviewed by iGreen's legal team — do
 * not treat it as compliance-equivalent to a reviewed notice. This is a
 * publish gate, not an implementation gate (task instructions item 17):
 * safe to ship to a non-production environment for review; must not go to
 * production until this is resolved or the Product Owner explicitly accepts
 * the same risk already accepted for Club/Telecom's own unreviewed
 * `GENERIC_NOTICE`.
 */
const EXPANSAO_DISCLAIMER =
  'Conexão Expansão — apresentação da oportunidade de tornar-se licenciado autorizado iGreen Energy, divulgada por licenciados autorizados iGreen Energy. Bonificações, royalties, qualificações e demais condições seguem as regras vigentes da Conexão Expansão, definidas pela iGreen e sujeitas a atualização. Não há garantia de renda ou resultado; os valores dependem das condições vigentes e da atividade de cada licenciado.';
