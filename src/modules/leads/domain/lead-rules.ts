import {
  BR_PHONE_PATTERN as SHARED_BR_PHONE_PATTERN,
  formatPhoneToE164 as sharedFormatPhoneToE164,
  maskBRPhone as sharedMaskBRPhone,
} from '@/shared/domain/br-phone';

/**
 * Lead capture business rules.
 *
 * The IP rate-limit threshold (5 attempts / 3600s) is NOT here — unlike
 * `auth-rules.ts` (ADR-012), it does not live in application code at all as
 * of `20260802000000_fix_submit_lead_rate_limit.sql`. It is a fixed literal
 * inside `submit_lead` itself, because the function both decides and writes:
 * a caller-supplied threshold (as it briefly was — see that migration's
 * header) lets its caller opt out of the limit entirely, not just misread it.
 * As of `20260820000000_secure_lead_submission_boundary.sql`, only the trusted
 * service-role adapter may execute the RPC, but the SQL literal remains the
 * single source of truth for the database-enforced threshold.
 */
export const LEAD_NAME_MIN_LENGTH = 2;
export const LEAD_NAME_MAX_LENGTH = 80;
export const LEAD_CITY_MAX_LENGTH = 120;

/**
 * Matches the mask `templates/commercial-pages/ConexaoGreen/index.html`'s
 * own `telefone` input already validates client-side
 * (`pattern="\(\d{2}\)\s\d{4,5}-\d{4}"`) — ported, not reinvented, so the
 * form UX matches the original template.
 */
export const BR_PHONE_PATTERN = SHARED_BR_PHONE_PATTERN;

/**
 * Honeypot field name — mirrors the hidden `empresa` input every
 * commercial-pages template ships (`aria-hidden="true"`, `tabindex="-1"`,
 * `templates/commercial-pages/ConexaoGreen/index.html:165`): invisible and
 * unreachable by tab order for a real visitor, but a bot that fills every
 * field in a scraped form trips it.
 */
export const LEAD_HONEYPOT_FIELD = 'empresa';

/**
 * Converts the masked BR phone the form collects ("(11) 98888-7777") into
 * the E.164 shape `leads.telefone_e164` requires. Assumes Brazil (+55) — the
 * same assumption the rest of this project already makes (CGNAT reasoning in
 * ADR-012, Portuguese-only copy throughout); revisit if a non-Brazilian
 * tenant ever needs this form.
 */
export function formatPhoneToE164(rawPhone: string): string {
  return sharedFormatPhoneToE164(rawPhone);
}

/**
 * Progressive BR phone mask for the `telefone` input's `onChange` —
 * reformats digits as they're typed so the input ends up in
 * `BR_PHONE_PATTERN`'s shape by the time the visitor finishes. Only inserts
 * the `-` once there are enough digits for a fixed line (10 total) or mobile
 * (11 total) number; anything shorter renders as just `(DD) rest` so partial
 * input never looks broken mid-type.
 *
 * Not wired to `formatE164ToBRPhone` (`representatives/domain/representative-rules.ts`)
 * on purpose: that function only ever reverses this project's OWN
 * `formatPhoneToE164` output (always exactly 10 or 11 digits, already
 * grouped), while this one must handle every partial length a visitor can be
 * mid-typing (0 to 11 digits) — a genuinely different job, not a duplicate.
 */
export function maskBRPhone(rawValue: string): string {
  return sharedMaskBRPhone(rawValue);
}
