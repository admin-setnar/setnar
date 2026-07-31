import { getTenantRepository } from '@/modules/tenancy/infrastructure/tenant-repository-factory';

import type { RepresentativeActivation } from '@/modules/representatives/domain/representative';
import type { RepresentativeRepository } from '@/modules/representatives/domain/representative-repository';

const REPRESENTATIVE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
  const representativeSlug = await extractRepresentativeSlug(hostname);
  if (!representativeSlug) return null;
  return repository.findPublishedActivation(representativeSlug, productSlug);
}

/**
 * Extracts a candidate Representative slug from a `Host` header value, or
 * `null` if the host cannot possibly be a Representative subdomain.
 * Returning a non-null slug here is NOT proof the Representative exists —
 * that is `RepresentativeRepository`'s job; this function only decides what
 * is worth asking the repository about at all.
 *
 * Precedence — decided here, architecturally, not incidentally: a `Host` is
 * tried as a Company tenant (ADR-001) FIRST; it is only ever considered as a
 * Representative subdomain candidate if that fails. In order of weight:
 *
 * 1. ADR-001 already owns resolution for `setnar.com`, `www.setnar.com` and
 *    `localhost` — the exact hostnames `setnarTenant` claims — and its own
 *    `resolveTenant()` never returns null for them; it falls back to the
 *    default tenant instead. If those hostnames were parsed for a
 *    Representative slug first, a naive split could misread `www` (from
 *    `www.setnar.com`) as a representative's slug label, turning SETNAR's
 *    own site into a "representative not found" response instead of
 *    rendering it. Company tenant hostnames are a small, closed, known set
 *    (ADR-001's own in-memory adapter); Representative slugs are
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
 *   rather than left to fall out of the "unknown parent domain" branch
 *   below, so a preview's random hash (e.g.
 *   `abc123-branch-team.vercel.app`) can never be mistaken for a
 *   representative slug, even if a future Company tenant were ever
 *   registered under a `vercel.app` hostname. `supabase/README.md`'s "URL
 *   Configuration" section documents this same preview-hostname shape
 *   showing up elsewhere in this project.
 * - Any host whose parent domain (everything after the first label) is not
 *   itself a known Company tenant hostname — e.g. a stray, unrelated domain
 *   pointed at this deployment. Representative subdomains only ever exist
 *   one level inside a Company's own domain (ADR-026); a host two levels
 *   deep, or under a domain no Company tenant owns, is not one.
 * - A first label that doesn't match the slug format
 *   `representatives.slug` is constrained to in
 *   `20260731000000_create_representative_domain.sql`
 *   (`^[a-z0-9]+(-[a-z0-9]+)*$`) — it could never be a real representative's
 *   slug, so there is no reason to ask the repository about it.
 */
export async function extractRepresentativeSlug(hostname: string | null): Promise<string | null> {
  if (!hostname) return null;

  const normalized = hostname.toLowerCase().trim().split(':')[0] ?? '';
  if (!normalized) return null;

  if (normalized.endsWith('.vercel.app')) return null;

  const tenantRepository = getTenantRepository();
  if (await tenantRepository.findByHostname(normalized)) return null;

  const dotIndex = normalized.indexOf('.');
  if (dotIndex <= 0) return null;

  const label = normalized.slice(0, dotIndex);
  const parentDomain = normalized.slice(dotIndex + 1);

  if (!(await tenantRepository.findByHostname(parentDomain))) return null;
  if (!REPRESENTATIVE_SLUG_PATTERN.test(label)) return null;

  return label;
}
