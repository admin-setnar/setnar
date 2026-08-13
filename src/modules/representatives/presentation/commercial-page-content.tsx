import { LeadForm } from '@/modules/leads/presentation/lead-form';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { resolveCompanyVertical } from '@/modules/representatives/domain/company-brand/resolve-company-vertical';
import { getCommercialPageTemplate } from '@/modules/representatives/domain/commercial-page-template';
import { CommercialFooter, CommercialHeader, CommercialHero, FaqSection, FinalCta, IdentificationSection, OfferSection, StepsSection, TrustStrip } from '@/modules/representatives/presentation/commercial-page-sections';
import { BrandTokensStyle } from '@/modules/tenancy/presentation/brand-tokens';
import { Container } from '@/shared/layout/container';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

/**
 * The actual content of a Commercial Page — extracted from
 * `src/app/[productSlug]/page.tsx` (SET-36) so the public route and the
 * private preview route (`src/app/pre-visualizacao/[productSlug]/page.tsx`)
 * render identical markup by construction, not by two hand-kept-in-sync
 * copies. Neither route's own concerns (host/analytics resolution for the
 * public one; auth/ownership/preview banner for the private one) belong
 * here — this component only knows how to render an already-resolved
 * (Representative, Product) pair.
 *
 * `leadFormDisabled` (SET-36): true only from the preview route — see
 * `LeadForm`'s own doc comment for why a real submission would 404 from
 * there.
 */
export function CommercialPageContent({
  representative,
  product,
  productSlug,
  leadFormDisabled = false,
}: {
  representative: Representative;
  product: RepresentativeProduct;
  productSlug: string;
  leadFormDisabled?: boolean;
}) {
  const companyVertical = resolveCompanyVertical(product.companySlug);
  const template = getCommercialPageTemplate(product.slug);

  if (!template) {
    return null;
  }

  return (
    <main id="conteudo" data-vertical={companyVertical?.vertical} className="bg-surface text-content">
      {companyVertical ? (
        <BrandTokensStyle tokens={companyVertical.tokens} scope={companyVertical.vertical} />
      ) : null}
      <CommercialHeader representative={representative} product={product} />
      <CommercialHero template={template} representative={representative} product={product} />
      <TrustStrip points={template.trustPoints} />
      <IdentificationSection representative={representative} product={product} />
      <section id="quero-simular" className="border-y border-line bg-brand-subtle py-14 sm:py-20">
        <Container className="max-w-[920px]"><Card variant="outlined" padding="lg" className="grid items-center gap-8 rounded-2xl shadow-[0_8px_24px_rgba(20,67,43,0.08)] md:grid-cols-[.85fr_1.15fr] md:p-10">
          <div>
            <Text variant="eyebrow" className="text-brand">Contato rápido</Text>
            <Text as="h2" variant="title" className="mt-2 text-[clamp(1.65rem,3vw,2.15rem)] font-extrabold leading-tight text-[rgb(var(--palette-900))]">
              Prefere que a gente te chame?
            </Text>
            <Text as="p" variant="body" className="mt-3">
              Deixe seus dados que entramos em contato, sem compromisso.
            </Text>
          </div>
          <div>
            <LeadForm productSlug={productSlug} disabled={leadFormDisabled} submitLabel={template.leadButton} successDescription={template.thankYouDescription} />
          </div>
        </Card></Container>
      </section>
      <StepsSection template={template} />
      <OfferSection template={template} />
      <FaqSection template={template} />
      <FinalCta template={template} representative={representative} product={product} />
      <CommercialFooter template={template} representative={representative} productSlug={productSlug} />
    </main>
  );
}
