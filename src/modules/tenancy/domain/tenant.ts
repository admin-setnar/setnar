import type { MarketingContent } from '@/modules/marketing/domain/marketing-content';

/**
 * A Tenant is the platform-level embodiment of the Company boundary defined in
 * DOMAIN_MODEL.md. SETNAR itself is the first tenant; iGreen is the first
 * vertical served *inside* it. Nothing about any single company may leak into
 * types, components or styles — only into tenant configuration data.
 */
export type TenantId = string;

/**
 * Design tokens a tenant may override, expressed as raw RGB channels
 * ("20 33 61") so Tailwind's alpha modifiers keep working.
 * Any subset may be provided; unspecified tokens fall back to the defaults in
 * globals.css.
 */
export type BrandTokens = Readonly<Record<string, string>>;

export interface TenantBrand {
  /** Product name shown in the UI. */
  readonly name: string;
  /** Legal entity, used in the copyright line. */
  readonly legalName: string;
  readonly tagline: string;
  readonly tokens: BrandTokens;
}

export interface TenantLegal {
  readonly termsUrl: string;
  readonly privacyUrl: string;
  readonly contactEmail: string;
}

/**
 * Capability flags. The gateway renders from these instead of from
 * hardcoded conditions, so enabling SSO for one tenant is a data change.
 */
export interface TenantFeatures {
  readonly googleAuth: boolean;
  readonly microsoftAuth: boolean;
  readonly selfServiceSignUp: boolean;
}

/**
 * The vertical whose representatives this tenant serves.
 *
 * `displayName` is intentionally optional and OFF by default: a third-party
 * brand may only be named on a public page under that brand owner's own usage
 * policy. See README, "Compliance".
 */
export interface TenantVertical {
  readonly id: string;
  readonly internalName: string;
  readonly displayName?: string;
}

export interface Tenant {
  readonly id: TenantId;
  /** Hostnames routed to this tenant. Matching is exact and case-insensitive. */
  readonly hostnames: readonly string[];
  readonly locale: string;
  readonly brand: TenantBrand;
  readonly legal: TenantLegal;
  readonly features: TenantFeatures;
  readonly vertical: TenantVertical;
  readonly marketing: MarketingContent;
}

/** The slice of tenant data that is safe and useful to hand to Client Components. */
export interface TenantClientView {
  readonly id: TenantId;
  readonly brandName: string;
  readonly legal: TenantLegal;
  readonly features: TenantFeatures;
}

export function toClientView(tenant: Tenant): TenantClientView {
  return {
    id: tenant.id,
    brandName: tenant.brand.name,
    legal: tenant.legal,
    features: tenant.features,
  };
}
