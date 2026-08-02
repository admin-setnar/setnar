import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ActivateProductResult,
  ProductActivationGateway,
  ProductActivationStatus,
  SetActivationStatusResult,
} from '@/modules/representatives/domain/product-activation-gateway';
import {
  mapActivateProductResult,
  mapSetActivationStatusResult,
} from '@/modules/representatives/infrastructure/map-product-activation-result';

/**
 * Supabase adapter for `ProductActivationGateway`. A fresh instance is
 * created per request by `getProductActivationGateway()` — it holds a
 * request-scoped Supabase client, so it must never be cached as a singleton
 * across requests.
 *
 * Calls `activate_product` / `set_activation_status`
 * (`supabase/migrations/20260807000000_add_product_activation_write_path.sql`),
 * both `SECURITY DEFINER` and granted to `authenticated` only. Note what is
 * NOT sent on either call: no `representative_id`, no `published_at`, no
 * `activated_at` — every one of those is decided inside the function from
 * `auth.uid()` and the current row, never by this adapter (ADR-036/ADR-040's
 * principle, and the reason D4 chose functions over RLS write policies).
 *
 * All mapping from the raw RPC response to the domain result lives in
 * `map-product-activation-result.ts`, not here, so that logic stays testable
 * without a Supabase client.
 */
export class SupabaseProductActivationGateway implements ProductActivationGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async activate(productId: string): Promise<ActivateProductResult> {
    const { data, error } = await this.supabase.rpc('activate_product', {
      p_product_id: productId,
    });

    return mapActivateProductResult(data, error);
  }

  async setStatus(
    productId: string,
    status: ProductActivationStatus,
  ): Promise<SetActivationStatusResult> {
    const { data, error } = await this.supabase.rpc('set_activation_status', {
      p_product_id: productId,
      p_status: status,
    });

    return mapSetActivationStatusResult(data, error);
  }
}
