import { formatE164ToBRPhone } from '@/shared/domain/br-phone';
import { generateQrCodeDataUrl } from '@/shared/lib/generate-qr-code-data-url';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { buildCommercialPageUrl } from '@/modules/representatives/presentation/commercial-page-url';

/**
 * Contract every ported marketing-material piece renders from. Trimmed from
 * the reference library's `MarketingMaterialProps`
 * (`templates/marketing-materials/shared/types.ts`) after verifying actual
 * usage across all 21 pieces (`MARKETING_MATERIALS_PLAN.md` §2.3):
 * `representativeFirstName` (0/21) and `representativeAvatarUrl` (0/21) are
 * dropped — nothing renders them, and the domain has no populated avatar
 * source today. If a future piece needs either, add it back deliberately,
 * not speculatively.
 */
export interface MarketingMaterialProps {
  readonly representativeName: string;
  readonly representativeId: string;
  readonly representativePhone: string | null;
  readonly representativeCity: string | null;
  readonly publicUrl: string;
  readonly qrCodeDataUrl: string;
}

/**
 * The only real transformation this feature has: existing domain data in,
 * the flat prop shape the ported pieces expect out. No persistence, no
 * lifecycle, no invariant of its own — see `MARKETING_MATERIALS_PLAN.md` D4
 * for why this stays one pure function instead of a
 * domain/application/infrastructure split.
 *
 * `representativePhone` collapses both "no phone on file" (`null`) and "a
 * legacy value `formatE164ToBRPhone` can't parse" (`''`) to `null` — every
 * ported piece already treats `null` as "hide the phone line", so a
 * malformed value never risks rendering an empty phone (plan §2.3).
 */
export function buildMarketingMaterialProps(
  representative: Pick<Representative, 'slug' | 'name' | 'authorizationId' | 'phone' | 'city'>,
  product: Pick<RepresentativeProduct, 'slug'>,
  qrCodeDataUrl: string,
): MarketingMaterialProps {
  const publicUrl = buildCommercialPageUrl(representative, product);
  const formattedPhone = representative.phone ? formatE164ToBRPhone(representative.phone) || null : null;

  return {
    representativeName: representative.name,
    representativeId: representative.authorizationId,
    representativePhone: formattedPhone,
    representativeCity: representative.city,
    publicUrl,
    qrCodeDataUrl,
  };
}

/** Thin wrapper so callers never call `generateQrCodeDataUrl` against the wrong URL by mistake. */
export async function buildMarketingMaterialPropsWithQrCode(
  representative: Pick<Representative, 'slug' | 'name' | 'authorizationId' | 'phone' | 'city'>,
  product: Pick<RepresentativeProduct, 'slug'>,
): Promise<MarketingMaterialProps> {
  const publicUrl = buildCommercialPageUrl(representative, product);
  const qrCodeDataUrl = await generateQrCodeDataUrl(publicUrl);
  return buildMarketingMaterialProps(representative, product, qrCodeDataUrl);
}
