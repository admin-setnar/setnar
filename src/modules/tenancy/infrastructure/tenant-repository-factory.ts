import type { TenantRepository } from '@/modules/tenancy/domain/tenant-repository';
import { InMemoryTenantRepository } from '@/modules/tenancy/infrastructure/in-memory-tenant-repository';

let instance: TenantRepository | null = null;

/**
 * Composition root for tenancy.
 *
 * The application layer asks for a TenantRepository and gets whichever adapter
 * is configured here. When tenants move to a database (Stage 5, White Label),
 * this function returns a different implementation and nothing else changes.
 */
export function getTenantRepository(): TenantRepository {
  instance ??= new InMemoryTenantRepository();
  return instance;
}
