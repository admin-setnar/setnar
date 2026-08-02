import type { Representative } from '@/modules/representatives/domain/representative';

/**
 * Port for a signed-in User to read their OWN Representative row, if one
 * exists — the read `/app` needs to decide between the D3.B.4 onboarding
 * form and the D3.B.5 hub.
 *
 * Deliberately separate from `RepresentativeRepository`
 * (`domain/representative-repository.ts`), not an extra method on it — same
 * reasoning ADR-031 already used to justify `RepresentativeRepository` as
 * its own port instead of folding it into `TenantRepository`, and the same
 * reasoning ADR-041 already used for `RepresentativeOnboardingGateway`
 * instead of extending this port's sibling with a write method.
 * `RepresentativeRepository`'s own doc comment frames it as the PUBLIC
 * resolution port — anonymous reads, no session, for rendering a Commercial
 * Page. `findByProfileId()` below is the opposite in the dimension that
 * matters here: authenticated, scoped to the caller's own row, one lookup
 * per `/app` visit rather than one per public page view. Folding it into
 * `RepresentativeRepository` would force `InMemoryRepresentativeRepository`
 * (`infrastructure/in-memory-representative-repository.ts`, used by
 * `resolve-representative.test.ts`) to implement a method it never uses —
 * the exact objection already raised against extending that port with
 * `register()` in D3.B.2.
 *
 * No new migration backs this: `representatives_select_own`
 * (`profile_id = auth.uid()`,
 * `supabase/migrations/20260804000000_add_own_row_select_policies.sql:61-63`)
 * already covers exactly this read.
 */
export interface RepresentativeAccountRepository {
  /**
   * Resolves the Representative row owned by the given `profile_id`, or
   * `null` if the signed-in User has not registered one yet — a normal,
   * expected outcome (not an error), same as `RepresentativeRepository`
   * returning `null` for a Commercial Page that doesn't resolve.
   */
  findByProfileId(profileId: string): Promise<Representative | null>;
}
