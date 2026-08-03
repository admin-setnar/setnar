/**
 * Representative onboarding business rules.
 *
 * These constants are the single source of truth for the presentation layer
 * (Zod schema, form copy) — no framework imports allowed. Same spirit as
 * `modules/auth/domain/auth-rules.ts`.
 */

/**
 * Slug format — lowercase letters/digits/hyphens, no leading/trailing/
 * consecutive hyphen. The single source of truth for this shape in
 * TypeScript: `application/resolve-representative.ts` imports this constant
 * rather than keeping its own private copy (a real duplication removed by
 * this file's introduction, not a preexisting convention).
 *
 * This is NOT the only place this exact pattern lives — the CHECK constraint
 * `representatives_slug_format` and the same regex inline in
 * `register_representative()`
 * (`supabase/migrations/20260731000000_create_representative_domain.sql`,
 * `20260806000000_add_register_representative.sql`) enforce it again in SQL.
 * That copy is deliberately NOT unified with this one — SQL cannot import
 * TypeScript, same reasoning already recorded in `20260806000000`'s header
 * for why its own literals (E.164 phone, city length, ...) are not imported
 * from this module either. Keep the two in sync by hand if this shape ever
 * changes.
 */
export const REPRESENTATIVE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * "Nome e sobrenome" — the minimum shape the iGreen brand usage policy
 * requires for the licensee identification block
 * (`presentation/licensee-identification-block.tsx`). See ADR-040 for why
 * this is a form field (`p_display_name`) rather than copied unchecked from
 * `profiles.full_name`.
 */
export const DISPLAY_NAME_MIN_WORDS = 2;

/**
 * Same number as `auth-rules.ts`'s `NAME_MAX_LENGTH` (80) — coincidence of
 * ceiling, not a shared source of truth. Declared as its own literal here,
 * not imported from the `auth` module, to avoid coupling `representatives`
 * to `auth` over a number that may drift over time — same reasoning already
 * recorded in `20260806000000_add_register_representative.sql`'s header for
 * why `p_display_name`'s SQL-level ceiling is a literal, not an import.
 */
export const DISPLAY_NAME_MAX_LENGTH = 80;

/**
 * `license_id` — format validation only. No pattern is declared here on
 * purpose: there is no confirmed source, anywhere in this repository, for
 * the real shape of an iGreen licensee id. See the "BLOQUEADOR DE
 * LANÇAMENTO" warning in `20260806000000_add_register_representative.sql`'s
 * header — this ceiling is a placeholder, not a validated format, and must
 * not grow a regex here without that confirmation landing first.
 */
export const LICENSE_ID_MAX_LENGTH = 100;

/** Same ceiling `submit_lead` already uses for `p_cidade` — no external format exists for a city name, just a ceiling against pathological input. */
export const CITY_MAX_LENGTH = 500;

/**
 * Matches the mask `templates/commercial-pages/ConexaoGreen/index.html`'s
 * own `telefone` input already validates client-side
 * (`pattern="\(\d{2}\)\s\d{4,5}-\d{4}"`) — duplicated from
 * `modules/leads/domain/lead-rules.ts`, not imported: `leads` and
 * `representatives` do not import from each other today, and importing one
 * constant across that boundary for a four-character regex would introduce
 * exactly the kind of cross-module coupling this project's port-per-module
 * shape avoids elsewhere. Keep the two definitions in sync by hand if the
 * mask ever changes.
 */
export const BR_PHONE_PATTERN = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;

/**
 * Converts the masked BR phone the form collects ("(11) 98888-7777") into
 * the E.164 shape `register_representative`'s `p_phone` expects. Assumes
 * Brazil (+55) — same assumption `lead-rules.ts`'s own `formatPhoneToE164`
 * makes, duplicated here for the same reason `BR_PHONE_PATTERN` is above.
 */
export function formatPhoneToE164(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  return `+55${digits}`;
}

/**
 * The inverse of `formatPhoneToE164` — turns the E.164 value stored in
 * `representatives.phone` back into the BR mask `BR_PHONE_PATTERN` validates,
 * so D5b's profile edit form can pre-fill an existing phone instead of
 * showing the raw stored value or leaving the field blank. Only ever called
 * with a value this codebase itself wrote (always `formatPhoneToE164`'s
 * output, on `register_representative`/`update_representative_profile`'s
 * write paths) — a phone typed directly into the database via the SQL
 * Editor in some other shape is the one case this can't reverse, and it
 * degrades to `''` (an empty field the representative can just fill in
 * again) rather than showing something malformed.
 */
export function formatE164ToBRPhone(e164Phone: string): string {
  const match = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164Phone);
  if (!match) return '';
  const [, ddd, prefix, suffix] = match;
  return `(${ddd}) ${prefix}-${suffix}`;
}

/**
 * Progressive BR phone mask for `RepresentativeProfileForm`'s `phone` input
 * `onChange` — duplicated from `modules/leads/domain/lead-rules.ts`'s own
 * `maskBRPhone`, not imported, same cross-module boundary reasoning as
 * `BR_PHONE_PATTERN` above. Turns
 * whatever was just typed, pasted or autofilled into `BR_PHONE_PATTERN`'s
 * shape as the visitor goes, capped at 11 digits (DDD + 9-digit mobile).
 * Always re-derives the mask from the raw digits rather than tracking
 * previous cursor/character state, so it is naturally idempotent: re-running
 * it on its own output is a no-op, and deleting a digit anywhere in the
 * middle of an already-masked value just re-masks correctly on the next
 * `onChange`.
 */
export function maskBRPhone(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (rest.length <= 4) return `(${ddd}) ${rest}`;

  const suffix = rest.slice(-4);
  const prefix = rest.slice(0, rest.length - 4);
  return `(${ddd}) ${prefix}-${suffix}`;
}

/**
 * "Nome e sobrenome" in its most permissive shape: at least two
 * whitespace-separated non-empty tokens after trimming. Deliberately does
 * not reject single-character tokens or hyphenated/compound names — this is
 * a shape check for the brand policy's minimum, not a name-validity opinion.
 */
export function hasAtLeastTwoWords(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return trimmed.split(/\s+/).length >= DISPLAY_NAME_MIN_WORDS;
}
