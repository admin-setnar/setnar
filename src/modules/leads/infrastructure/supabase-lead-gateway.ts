import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { LeadGateway, SubmitLeadInput, SubmitLeadResult } from '@/modules/leads/domain/lead-gateway';

/**
 * Same `sha256(salt:value)` scheme as `login-rate-limiter.ts`'s `hash()`,
 * reading the same `LOGIN_ATTEMPT_SALT` — deliberately not a second salt,
 * see the ADR in README.md. Duplicated here as a small private function
 * rather than imported from `login-rate-limiter.ts`, to avoid coupling lead
 * capture to the auth module for four lines of crypto; extract a shared
 * util if a third caller ever needs this.
 */
function hash(value: string): string {
  const salt = process.env.LOGIN_ATTEMPT_SALT;
  if (!salt) {
    throw new Error('LOGIN_ATTEMPT_SALT is not configured.');
  }
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

/**
 * Supabase adapter for `LeadGateway`. A fresh instance is created per
 * request by `getLeadGateway()` — it holds a request-scoped Supabase
 * client, so it must never be cached as a singleton across requests.
 *
 * Calls `submit_lead` (`supabase/migrations`), which checks the IP rate
 * limit, validates the (representative, product) pair still has a
 * published activation, and inserts — all inside one `SECURITY DEFINER`
 * function, atomically. The rate-limit threshold (5 attempts / 3600s) is a
 * fixed literal inside `submit_lead` itself as of
 * `20260802000000_fix_submit_lead_rate_limit.sql` — not passed from here —
 * so a direct RPC caller cannot supply their own threshold to bypass it
 * (see that migration's header for the vulnerability this closed).
 */
export class SupabaseLeadGateway implements LeadGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async submitLead(input: SubmitLeadInput): Promise<SubmitLeadResult> {
    const { data, error } = await this.supabase.rpc('submit_lead', {
      p_representative_id: input.representativeId,
      p_product_id: input.productId,
      p_telefone_e164: input.telefoneE164,
      p_nome: input.nome,
      p_cidade: input.cidade,
      p_email: input.email,
      p_origem: input.origem,
      p_referrer: input.referrer,
      // lead_submission_attempts.ip_hash is NOT NULL, unlike login_attempts'
      // (which tolerates a null IP by skipping the IP-keyed check entirely)
      // — there is no second identity axis here to fall back on (see the
      // migration's own comment on why leads are IP-only), so a missing IP
      // (only possible in local dev without `x-forwarded-for`, per
      // `get-client-ip.ts`; Vercel always sets it in production) hashes a
      // fixed literal instead. Every such request shares one rate-limit
      // bucket, acceptable for a case that should not occur in production.
      p_ip_hash: hash(input.ip ?? 'unknown'),
    });

    if (error) {
      console.error('submit_lead RPC failed', error);
      return 'error';
    }
    return data === true ? 'submitted' : 'rejected';
  }
}
