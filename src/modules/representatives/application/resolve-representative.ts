import { getTenantRepository } from '@/modules/tenancy/infrastructure/tenant-repository-factory';

import type { RepresentativeActivation } from '@/modules/representatives/domain/representative';
import type { RepresentativeRepository } from '@/modules/representatives/domain/representative-repository';
import { REPRESENTATIVE_SLUG_PATTERN } from '@/modules/representatives/domain/representative-rules';

/**
 * Resolves the public Commercial Page a request is for, given the raw `Host`
 * header and the product slug from the path (e.g. `/conexao-green`).
 *
 * The repository is an explicit parameter, not resolved internally via a
 * factory — same DI shape as `signIn(gateway, credentials)` in the auth
 * module, not `resolveTenant()`'s own internal `getTenantRepository()` call.
 * `getRepresentativeRepository()` (the Supabase-backed factory) needs a live
 * Next.js request context (`cookies()`, transitively) to build its client;
 * `resolveTenant()` can call its own factory internally only because
 * tenancy's factory is a plain in-memory singleton with no such dependency.
 * Taking the repository as a parameter keeps this function (and its host
 * -parsing precedence logic below) testable with `InMemoryRepresentativeRepository`
 * outside of any request context; the caller (a Server Component, next
 * prompt) is what calls `getRepresentativeRepository()`.
 *
 * KNOWN LIMITATION: does not check Subscription status — see the doc
 * comment on `RepresentativeRepository` for why, and what a non-null result
 * here does NOT guarantee.
 */
export async function resolveRepresentativeActivation(
  repository: RepresentativeRepository,
  hostname: string | null,
  productSlug: string,
): Promise<RepresentativeActivation | null> {
  const host = await parseCommercialPresenceHost(hostname);
  if (!host) return null;
  return repository.findPublishedActivation(host.representativeSlug, host.companySlug, productSlug);
}

/**
 * The two labels a public Commercial Presence resolves by —
 * `<representative>.<company>.<tenant-root>`. Neither field is proof the
 * Representative or the Company exists, or that they are actually
 * affiliated — see `parseCommercialPresenceHost`'s own doc comment.
 */
export interface CommercialPresenceHost {
  readonly representativeSlug: string;
  readonly companySlug: string;
}

/**
 * Parses a `Host` header value into a candidate
 * `{ representativeSlug, companySlug }` pair, or `null` if the host cannot
 * possibly be one. Returning a non-null pair here is NOT proof either label
 * resolves to a real row, or that the Representative actually belongs to
 * that Company — that validation is `RepresentativeRepository`'s job
 * (`findPublishedActivation`); this function only decides what is worth
 * asking the repository about at all.
 *
 * Public address format, decided by product: `<representative>.<company>.setnar.com`
 * (e.g. `pedro-policeno.igreen.setnar.com`) — exactly two labels before a
 * known Tenant hostname, always. There is deliberately no fallback for the
 * earlier one-label form (`<representative>.setnar.com`): no production
 * traffic or distributed QR code/link ever depended on it when the format
 * changed, so this is not a legacy alias to maintain, and a one-label host
 * is simply an invalid Commercial Presence host like any other malformed one.
 *
 * Precedence — decided here, architecturally, not incidentally: a `Host` is
 * tried as a Company tenant (ADR-001) FIRST; it is only ever considered as a
 * candidate two-label Commercial Presence host if that fails. In order of
 * weight:
 *
 * 1. ADR-001 already owns resolution for `setnar.com`, `www.setnar.com` and
 *    `localhost` — the exact hostnames `setnarTenant` claims — and its own
 *    `resolveTenant()` never returns null for them; it falls back to the
 *    default tenant instead. If those hostnames were parsed for a
 *    Commercial Presence host first, a naive split could misread a label
 *    (e.g. `www` from `www.setnar.com`) as part of a representative/company
 *    pair, turning SETNAR's own site into a "not found" response instead of
 *    rendering it. Company tenant hostnames are a small, closed, known set
 *    (ADR-001's own in-memory adapter); Commercial Presence hosts are
 *    open-ended, so checking the closed set first is both the correct order
 *    and the cheaper one.
 * 2. Checking against `getTenantRepository()` — the same port ADR-001
 *    established — keeps the exclusion correct BY CONSTRUCTION, instead of
 *    re-listing `setnar.com` / `www.setnar.com` / `localhost` as string
 *    literals in a second file where they could silently drift out of sync
 *    with `setnar.tenant.ts`. Any future Company tenant (Stage 5, White
 *    Label) is excluded here automatically the moment it's registered in
 *    `InMemoryTenantRepository`, with no change needed in this file.
 *
 * Explicitly excluded, and why:
 * - Any hostname a Company tenant already claims — see above.
 * - `*.vercel.app` — every Vercel preview deployment. Checked explicitly
 *   rather than left to fall out of the "unknown tenant root" branch below,
 *   so a preview's random hash (e.g. `abc123-branch-team.vercel.app`) can
 *   never be mistaken for a representative/company pair, even if a future
 *   Company tenant were ever registered under a `vercel.app` hostname.
 *   `supabase/README.md`'s "URL Configuration" section documents this same
 *   preview-hostname shape showing up elsewhere in this project.
 * - Any host whose remainder after the first two labels is not itself a
 *   known Company tenant hostname — e.g. a stray, unrelated domain pointed
 *   at this deployment, or a host with only one label, or three or more
 *   labels before the tenant root. A Commercial Presence host is always
 *   exactly two labels deep inside a Company's own domain — a host any
 *   shallower or deeper than that is not one.
 * - A representative or company label that doesn't match the slug format
 *   `representatives.slug` is constrained to in
 *   `20260731000000_create_representative_domain.sql`
 *   (`^[a-z0-9]+(-[a-z0-9]+)*$`) — neither could ever be a real slug, so
 *   there is no reason to ask the repository about either.
 */
export async function parseCommercialPresenceHost(
  hostname: string | null,
): Promise<CommercialPresenceHost | null> {
  if (!hostname) return null;

  const normalized = hostname.toLowerCase().trim().split(':')[0] ?? '';
  if (!normalized) return null;

  if (normalized.endsWith('.vercel.app')) return null;

  const tenantRepository = getTenantRepository();
  if (await tenantRepository.findByHostname(normalized)) return null;

  const labels = normalized.split('.');
  if (labels.length < 3) return null;

  // Indexed rather than destructured: `noUncheckedIndexedAccess` (tsconfig)
  // types every array access as possibly `undefined` regardless of the
  // length guard above, same reason `extractRepresentativeSlug` (this
  // function's predecessor) indexed `.split(':')[0] ?? ''` instead of
  // trusting a destructure. The `?? ''` fallbacks below are unreachable at
  // runtime (the length check already guarantees both labels exist) and
  // exist only to satisfy that flow analysis.
  const representativeLabel = labels[0] ?? '';
  const companyLabel = labels[1] ?? '';
  const tenantRoot = labels.slice(2).join('.');

  if (!(await tenantRepository.findByHostname(tenantRoot))) return null;
  if (!REPRESENTATIVE_SLUG_PATTERN.test(representativeLabel)) return null;
  if (!REPRESENTATIVE_SLUG_PATTERN.test(companyLabel)) return null;

  return { representativeSlug: representativeLabel, companySlug: companyLabel };
}
