import { formatE164ToBRPhone } from '@/shared/domain/br-phone';
import { generateQrCodeDataUrl } from '@/shared/lib/generate-qr-code-data-url';
import type { OriginId } from '@/modules/analytics/domain/origin';
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
  product: Pick<RepresentativeProduct, 'slug' | 'companySlug'>,
  qrCodeDataUrl: string,
  // SET-84: optional 4th param, defaults to the canonical derivation every
  // existing caller already got — `/app/paginas/marketing` (SET-65) is
  // unaffected. Only the Divulgação flow passes an explicit `?src=`-tagged
  // URL here, so a material's embedded link/QR match the channel the
  // representative picked, not the bare canonical URL.
  publicUrl: string = buildCommercialPageUrl(representative, product),
): MarketingMaterialProps {
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
  product: Pick<RepresentativeProduct, 'slug' | 'companySlug'>,
): Promise<MarketingMaterialProps> {
  const publicUrl = buildCommercialPageUrl(representative, product);
  const qrCodeDataUrl = await generateQrCodeDataUrl(publicUrl);
  return buildMarketingMaterialProps(representative, product, qrCodeDataUrl);
}

/**
 * SET-84 D3/D4 (docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md) — same shape as
 * `buildMarketingMaterialPropsWithQrCode`, but the link/QR carry `?src=<origin>`
 * instead of the bare canonical URL. Only the Divulgação flow calls this: the
 * origin comes from the channel the representative picked in that flow, never
 * from anywhere persisted, so it cannot live in `buildMarketingMaterialPropsWithQrCode`
 * itself without changing that function's existing contract for
 * `/app/paginas/marketing` (SET-65), which stays exactly as it is (D4).
 */
export async function buildMarketingMaterialPropsForOrigin(
  representative: Pick<Representative, 'slug' | 'name' | 'authorizationId' | 'phone' | 'city'>,
  product: Pick<RepresentativeProduct, 'slug' | 'companySlug'>,
  origin: OriginId,
): Promise<MarketingMaterialProps> {
  const publicUrl = `${buildCommercialPageUrl(representative, product)}?src=${origin}`;
  const qrCodeDataUrl = await generateQrCodeDataUrl(publicUrl);
  return buildMarketingMaterialProps(representative, product, qrCodeDataUrl, publicUrl);
}
