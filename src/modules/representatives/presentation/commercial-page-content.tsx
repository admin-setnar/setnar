import { LeadForm } from '@/modules/leads/presentation/lead-form';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { resolveCompanyVertical } from '@/modules/representatives/domain/company-brand/resolve-company-vertical';
import { CONEXAO_CLUB_TABS } from '@/modules/representatives/domain/product-content/conexao-club';
import { AuthorizedRepresentativeIdentificationBlock } from '@/modules/representatives/presentation/authorized-representative-identification-block';
import { ComplianceNotice } from '@/modules/representatives/presentation/compliance-notice';
import { ProductContentTabs } from '@/modules/representatives/presentation/product-content-tabs';
import { WhatsappCta } from '@/modules/representatives/presentation/whatsapp-cta';
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

  return (
    <main id="conteudo" data-vertical={companyVertical?.vertical} className="pt-16 pb-20">
      {companyVertical ? (
        <BrandTokensStyle tokens={companyVertical.tokens} scope={companyVertical.vertical} />
      ) : null}
      <Container width="narrow">
        <Text variant="eyebrow">{product.name}</Text>
        <Text as="h1" variant="heading" className="mt-2">
          {product.name}
        </Text>

        <div className="mt-8">
          <AuthorizedRepresentativeIdentificationBlock representative={representative} />
        </div>

        <div className="mt-6">
          <WhatsappCta representative={representative} product={product} />
        </div>

        {product.slug === 'conexao-club' ? (
          <div className="mt-8">
            <ProductContentTabs tabs={CONEXAO_CLUB_TABS} />
          </div>
        ) : null}

        <Card variant="outlined" padding="lg" className="mt-8">
          <Text as="h2" variant="title">
            Prefere que a gente te chame?
          </Text>
          <Text as="p" variant="caption" className="mt-1">
            Deixe seus dados que entramos em contato, sem compromisso.
          </Text>
          <div className="mt-4">
            <LeadForm productSlug={productSlug} disabled={leadFormDisabled} />
          </div>
        </Card>

        <ComplianceNotice productSlug={productSlug} />
      </Container>
    </main>
  );
}
