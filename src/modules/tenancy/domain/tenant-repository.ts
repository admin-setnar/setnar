import type { Tenant, TenantId } from '@/modules/tenancy/domain/tenant';

/**
 * Port. The domain states what it needs; infrastructure decides where tenants
 * actually live (in-memory today, a database in Stage 5's White Label work).
 */
export interface TenantRepository {
  findByHostname(hostname: string): Promise<Tenant | null>;
  findById(id: TenantId): Promise<Tenant | null>;
}
