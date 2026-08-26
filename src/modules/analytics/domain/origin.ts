/**
 * SET-84 D3 (`docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md`) — fonte canônica da
 * allowlist de origem de divulgação. `origin` descreve por qual link/QR uma
 * visita entrou (§1.1 do plano) — não um modelo de campanha/attribution.
 *
 * Único lugar onde os 5 valores são declarados em TypeScript; UI, catálogo de
 * copy (D2) e payloads de RPC devem derivar de `ORIGIN_IDS`, nunca repetir os
 * literais. A constraint SQL equivalente (`is_valid_origin`,
 * `supabase/migrations/20260908000002_add_origin_write_functions.sql`) é
 * barreira de integridade sincronizada com esta lista por
 * `tests/origin-allowlist-sync.test.ts` — não uma segunda fonte de verdade.
 */
export const ORIGIN_IDS = ['instagram_post', 'instagram_story', 'whatsapp', 'qrcode', 'direct'] as const;

export type OriginId = (typeof ORIGIN_IDS)[number];

/**
 * Resolves the `?src=` query value into a validated `OriginId`, or `null`
 * for anything else (missing, repeated, or outside the allowlist) — the
 * same "degrade, never reject" contract `is_valid_origin`
 * (`supabase/migrations/20260908000002_add_origin_write_functions.sql`)
 * enforces server-side in Postgres. This is the client-visible half of that
 * same rule, not a second source of truth: both read `ORIGIN_IDS`.
 *
 * A `?src=` repeated in the URL arrives here as `string[]` (Next.js
 * `searchParams` shape) — treated the same as an invalid value, never the
 * first/last entry, so a caller cannot pad the query string to smuggle a
 * second value past a lenient reading.
 */
export function resolveOrigin(rawSrc: string | readonly string[] | undefined | null): OriginId | null {
  if (typeof rawSrc !== 'string') return null;
  return (ORIGIN_IDS as readonly string[]).includes(rawSrc) ? (rawSrc as OriginId) : null;
}
