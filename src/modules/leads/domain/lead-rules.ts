/**
 * Lead capture business rules.
 *
 * The IP rate-limit threshold (5 attempts / 3600s) is NOT here — unlike
 * `auth-rules.ts` (ADR-012), it does not live in application code at all as
 * of `20260802000000_fix_submit_lead_rate_limit.sql`. It is a fixed literal
 * inside `submit_lead` itself, because `submit_lead` is `grant execute` to
 * `anon` and both decides and writes: a caller-supplied threshold (as it
 * briefly was — see that migration's header) lets any direct RPC caller opt
 * itself out of the limit entirely, not just misread it. There is no shared
 * constant to keep in sync — the SQL literal is the only place this number
 * lives now.
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
export const BR_PHONE_PATTERN = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;

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
  const digits = rawPhone.replace(/\D/g, '');
  return `+55${digits}`;
}
