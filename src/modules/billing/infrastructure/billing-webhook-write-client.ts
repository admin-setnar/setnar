import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Minimal privileged client for the Asaas webhook RPC only — same shape as
 * `lead-write-client.ts`/`analytics-write-client.ts`, its own file per
 * module rather than a shared factory (no shared service-role client exists
 * in this codebase; each module owns its own boundary).
 */
export function createBillingWebhookWriteClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Billing webhook persistence requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
