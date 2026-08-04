import { IGREEN_TOKENS } from '@/modules/representatives/domain/company-brand/igreen';
import type { BrandTokens } from '@/modules/tenancy/domain/tenant';

/**
 * Company slugs (DOMAIN_MODEL.md §8.1) that get a Company-specific visual on
 * their Commercial Pages (CP9). PROTOTYPE, NOT APPROVED by iGreen yet
 * (README ADR-057; docs/COMMERCIAL_PAGE_CONTENT_PLAN.md §3.3/CP1) — an
 * internal example built to request that approval, not a closed brand
 * decision. Growing to a second Company is adding an entry here, not
 * touching `resolveCompanyVertical` below.
 */
export const COMPANY_BRAND_TOKENS: Readonly<Record<string, BrandTokens>> = {
  igreen: IGREEN_TOKENS,
};

/** The vertical name plus the tokens it applies — returned together so a caller never re-indexes `COMPANY_BRAND_TOKENS` and risks the two falling out of sync. */
export interface CompanyVertical {
  readonly vertical: string;
  readonly tokens: BrandTokens;
}

/**
 * Decides which vertical (if any) a Commercial Page should visually brand
 * as, from the real `companySlug` DOMAIN_MODEL.md §8.4/§8.1 already ties to
 * the resolved Product — never a hardcoded `if (true)` guess. Returns
 * `undefined` for any Company not in `COMPANY_BRAND_TOKENS`, which the
 * caller (`[productSlug]/page.tsx`) treats as "render the generic SETNAR
 * theme" — the safe default for every Company that isn't iGreen today.
 */
export function resolveCompanyVertical(companySlug: string): CompanyVertical | undefined {
  const tokens = COMPANY_BRAND_TOKENS[companySlug];
  return tokens ? { vertical: companySlug, tokens } : undefined;
}
