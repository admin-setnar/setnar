/**
 * "Antes de contratar" — the mandatory pre-contract consumer notice iGreen's
 * Manual de Conduta requires (item 19.3, "Obrigação de prestar todas as
 * informações ao consumidor antes da contratação"). Legal content, versioned
 * as code for the same reason `representative-rules.ts`'s constants are: a
 * change here goes through a diff/PR, never a runtime edit — there is no new
 * column on `products` for this, on purpose (ADR-055).
 *
 * One text per Product category, not per Product row: the 7 seeded slugs
 * (`20260803000000_seed_igreen_catalog.sql`) group into 3 regulatory
 * baselines, and this map is keyed by slug only because that is what
 * `RepresentativeProduct.slug` gives the presentation layer to look up with
 * — the underlying text is shared within each category.
 *
 * Sources, recorded here because ADR-055 is where the decision is explained,
 * not where the citation lives day to day:
 *   - Energia: Manual de Conduta iGreen, item 19.3.
 *   - Seguros: "Green Seguros.md", §9.3/§10.3 (BP Seguradora S.A., SUSEP,
 *     Tabela FIPE).
 *   - Telecom/Club: no product-specific source exists in the Manual de
 *     Conduta for either. Generic CDC-based copy, approved by Pedro as a
 *     provisional placeholder — NOT reviewed by iGreen's legal team. Do not
 *     treat this text as compliance-equivalent to the other two.
 */

const ENERGY_NOTICE =
  'Antes de contratar, é importante que você saiba: a iGreen atua no segmento de geração compartilhada de energia; não possui vínculo com a concessionária ou distribuidora de energia da sua região; a adesão não é um programa governamental nem benefício público; a compensação dos créditos de energia segue as regras da geração distribuída; você pode receber cobranças distintas, conforme o modelo contratual; os descontos e condições aplicáveis constam no contrato assinado.';

const INSURANCE_NOTICE =
  'Antes de contratar, é importante que você saiba: a iGreen Seguros atua como representante da BP Seguradora S.A., responsável pela apólice e regulamentada pela SUSEP; o iGreen Auto Mensal é um seguro por assinatura, sem fidelidade e sem multa de cancelamento; em caso de perda total, roubo ou furto não recuperado, a indenização segue a Tabela FIPE vigente na data do sinistro — não no valor da contratação; nenhum sinistro é aprovado antes da análise da seguradora.';

/**
 * Generic CDC-based copy — see this file's header. Used for Telecom and
 * Conexão Club only because neither has a category-specific source the way
 * Energia and Seguros do, not because the two products are otherwise alike.
 */
const GENERIC_NOTICE =
  'Antes de contratar, é importante que você saiba: quem atende você é um Licenciado independente da iGreen, não um funcionário da empresa; os valores, prazos e condições específicas do serviço constam sempre no contrato assinado; você tem os direitos garantidos pelo Código de Defesa do Consumidor, incluindo informação clara sobre o serviço antes da contratação; qualquer promessa de resultado ou desconto deve ser confirmada por escrito no contrato antes de você assinar.';

/**
 * Keyed by the exact 7 slugs `20260803000000_seed_igreen_catalog.sql` seeds
 * — not derived from a "category" field on `Product`, because no such field
 * exists (ADR-028: Catalog is conceptual, not its own table). If Stage 5
 * ever adds a Company other than iGreen, this map does not generalize; it is
 * iGreen-specific compliance copy, same scope as this whole seed migration.
 */
export const PRODUCT_COMPLIANCE_NOTICE: Record<string, string> = {
  'conexao-green': ENERGY_NOTICE,
  'conexao-solar': ENERGY_NOTICE,
  'conexao-livre': ENERGY_NOTICE,
  'conexao-placas': ENERGY_NOTICE,
  'green-seguros': INSURANCE_NOTICE,
  telecom: GENERIC_NOTICE,
  'conexao-club': GENERIC_NOTICE,
};

/**
 * `null` for any slug outside the map above — a Product this codebase does
 * not know about yet should never fall back to a guessed notice; the caller
 * decides what "no notice" means (today: render nothing for that paragraph).
 */
export function getProductComplianceNotice(productSlug: string): string | null {
  return PRODUCT_COMPLIANCE_NOTICE[productSlug] ?? null;
}

/**
 * "Não é canal oficial" — the same disclaimer `marketing-content.ts`'s
 * `FooterContent.legalNotice` carries for SETNAR's own page
 * (`setnar.tenant.ts`), duplicated here rather than imported: the Commercial
 * Page resolves through `RepresentativeRepository` (ADR-031), never through
 * `resolveTenant`/`MarketingContent` — importing across that boundary for one
 * string would couple `representatives` to `marketing`/`tenancy` the same way
 * `BR_PHONE_PATTERN` in `representative-rules.ts` explains this project
 * already avoids. Keep the two in sync by hand if the wording ever changes.
 * README.md's "Compliance" section anticipated this exact addition ("When
 * commercial pages ship, that per-page identification becomes a publication
 * precondition, not a template detail").
 */
export const NOT_OFFICIAL_CHANNEL_NOTICE =
  'O Setnar é uma plataforma independente de ferramentas de vendas. Não é canal oficial das empresas cujos produtos seus usuários representam, e toda página publicada identifica de forma clara o representante responsável por ela.';
