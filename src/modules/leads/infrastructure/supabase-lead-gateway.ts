import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { LeadGateway, SubmitLeadInput, SubmitLeadResult } from '@/modules/leads/domain/lead-gateway';
import { toSafeLogError } from '@/shared/lib/safe-log-error';

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
 * Supabase adapter for `LeadGateway`. A fresh instance is created per request
 * by `getLeadGateway()` around a lead-only privileged client. The browser
 * never receives that credential or the RPC payload containing `p_ip_hash`.
 *
 * Calls `submit_lead` (`supabase/migrations`), which checks the IP rate
 * limit, validates the (representative, product) pair still has a
 * published activation, and inserts — all inside one `SECURITY DEFINER`
 * function, atomically. The rate-limit threshold (5 attempts / 3600s) is a
 * fixed literal inside `submit_lead` itself as of
 * `20260802000000_fix_submit_lead_rate_limit.sql` — not passed from here —
 * `20260820000000_secure_lead_submission_boundary.sql` restricts that RPC to
 * service_role and serializes each bucket, so browser callers cannot choose a
 * hash and concurrent calls cannot overrun the threshold.
 */
export class SupabaseLeadGateway implements LeadGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async submitLead(input: SubmitLeadInput): Promise<SubmitLeadResult> {
    // Without an IP from the trusted edge there is no trustworthy rate-limit
    // identity. Do not collapse such traffic into an `unknown` bucket or write
    // a lead without enforceable throttling.
    if (!input.ip) {
      return 'rejected';
    }

    const { data, error } = await this.supabase.rpc('submit_lead', {
      p_representative_id: input.representativeId,
      p_product_id: input.productId,
      p_telefone_e164: input.telefoneE164,
      p_nome: input.nome,
      p_cidade: input.cidade,
      p_email: input.email,
      p_origem: input.origem,
      p_referrer: input.referrer,
      p_ip_hash: hash(input.ip),
      p_origin: input.origin,
    });

    if (error) {
      console.error('submit_lead RPC failed', toSafeLogError(error));
      return 'error';
    }
    return data === true ? 'submitted' : 'rejected';
  }
}
