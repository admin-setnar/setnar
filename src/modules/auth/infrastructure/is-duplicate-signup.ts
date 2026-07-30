/**
 * Detects a Supabase `signUp()` response for an e-mail that already has an
 * account — the case Supabase itself can answer with no `error` at all (see
 * the JSDoc on `signUp()` in `@supabase/auth-js`'s `GoTrueClient.ts`: an
 * existing confirmed user gets back an "obfuscated/fake user object").
 *
 * Kept as a pure function, separate from SupabaseAuthGateway (which has
 * `import 'server-only'` at the top and can't be imported by a `tsx --test`
 * unit test — that runs in plain Node, with no Next.js runtime).
 *
 * Known limitation, left unresolved on purpose: an empty `identities` array
 * also shows up in some GoTrue versions for an existing account that is
 * still awaiting its own confirmation e-mail, not only for an existing
 * *confirmed* one — so this function cannot tell those two "already exists"
 * sub-cases apart. That is acceptable for now because both sub-cases get the
 * user the same response today ("this e-mail already has an account");
 * telling them apart would need a second query and only matters if the
 * product ever needs to show two different messages for them.
 */
export function isDuplicateSignUp(user: { identities?: unknown[] }): boolean {
  return !user.identities || user.identities.length === 0;
}
