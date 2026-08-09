import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ApplyBillingEventInput,
  ApplyBillingEventResult,
  BillingWebhookGateway,
} from '@/modules/billing/domain/billing-webhook-gateway';
import { mapApplyBillingEventResult } from '@/modules/billing/infrastructure/map-apply-billing-event-result';

export class SupabaseBillingWebhookGateway implements BillingWebhookGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async applyEvent(input: ApplyBillingEventInput): Promise<ApplyBillingEventResult> {
    const { data, error } = await this.supabase.rpc('apply_billing_event', {
      p_event_id: input.eventId,
      p_event_type: input.eventType,
      p_asaas_subscription_id: input.asaasSubscriptionId,
      p_asaas_customer_id: input.asaasCustomerId,
      p_external_reference: input.externalReference,
      p_next_due_date: input.nextDueDate,
      p_payload: input.payload,
    });
    return mapApplyBillingEventResult(data, error);
  }
}
