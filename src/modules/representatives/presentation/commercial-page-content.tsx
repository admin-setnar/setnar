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
    <main id="conteudo" data-vertical={companyVertical?.vertical}>
      {companyVertical ? (
        <BrandTokensStyle tokens={companyVertical.tokens} scope={companyVertical.vertical} />
      ) : null}
      <CommercialHeader representative={representative} product={product} />
      <CommercialHero template={template} representative={representative} product={product} />
      <TrustStrip points={template.trustPoints} />
      <IdentificationSection representative={representative} />
      <section id="quero-simular" className="pb-14 sm:pb-20">
        <Container width="narrow"><Card variant="outlined" padding="lg">
          <Text as="h2" variant="title">
            Prefere que a gente te chame?
          </Text>
          <Text as="p" variant="caption" className="mt-1">
            Deixe seus dados que entramos em contato, sem compromisso.
          </Text>
          <div className="mt-4">
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
