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
