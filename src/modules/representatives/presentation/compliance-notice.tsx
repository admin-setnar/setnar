import {
  getProductComplianceNotice,
  NOT_OFFICIAL_CHANNEL_NOTICE,
} from '@/modules/representatives/domain/product-compliance-notice';
import { Text } from '@/shared/ui/typography';

/**
 * The Commercial Page's mandatory consumer notices (ADR-055) — the
 * category-specific "Antes de contratar" text, and the fixed "não é canal
 * oficial" disclaimer every Representative page must carry regardless of
 * Product. Deliberately plain `Text` with no `Card`: `Footer`'s own
 * `legalNotice` (`shared/layout/footer.tsx`) is the precedent for rendering a
 * compliance line as quiet body copy, not an elevated surface — "discreet but
 * always visible", not a warning banner.
 *
 * Renders unconditionally, never `null`: even a `productSlug` outside
 * `PRODUCT_COMPLIANCE_NOTICE` (should not happen for a resolved
 * `RepresentativeActivation`, but this component does not assume that) still
 * owes a visitor the not-official-channel disclaimer.
 */
export function ComplianceNotice({ productSlug }: { productSlug: string }) {
  const notice = getProductComplianceNotice(productSlug);

  return (
    <div className="mt-8 space-y-3">
      {notice ? (
        <Text as="p" variant="caption">
          {notice}
        </Text>
      ) : null}
      <Text as="p" variant="caption">
        {NOT_OFFICIAL_CHANNEL_NOTICE}
      </Text>
    </div>
  );
}
