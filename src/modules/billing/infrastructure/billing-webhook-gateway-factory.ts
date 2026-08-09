import 'server-only';

import type { BillingWebhookGateway } from '@/modules/billing/domain/billing-webhook-gateway';
import { createBillingWebhookWriteClient } from '@/modules/billing/infrastructure/billing-webhook-write-client';
import { SupabaseBillingWebhookGateway } from '@/modules/billing/infrastructure/supabase-billing-webhook-gateway';

/**
 * Composition root for the Asaas webhook's privileged writes. The
 * service-role credential stays inside server-only billing infrastructure —
 * same boundary `getLeadGateway()` already establishes for leads.
 */
export async function getBillingWebhookGateway(): Promise<BillingWebhookGateway> {
  return new SupabaseBillingWebhookGateway(createBillingWebhookWriteClient());
}
