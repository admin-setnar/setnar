import type { Tenant, TenantId } from '@/modules/tenancy/domain/tenant';
import type { TenantRepository } from '@/modules/tenancy/domain/tenant-repository';
import { setnarTenant } from '@/modules/tenancy/infrastructure/tenants/setnar.tenant';

const TENANTS: readonly Tenant[] = [setnarTenant];

/**
 * Tenants live in code while there is exactly one of them. When Stage 5 (White
 * Label) makes tenants user-managed, only this adapter is replaced — the port
 * and every consumer stay untouched.
 */
export class InMemoryTenantRepository implements TenantRepository {
  async findByHostname(hostname: string): Promise<Tenant | null> {
    const normalized = normalizeHostname(hostname);
    return (
      TENANTS.find((tenant) =>
        tenant.hostnames.some((candidate) => normalizeHostname(candidate) === normalized),
      ) ?? null
    );
  }

  async findById(id: TenantId): Promise<Tenant | null> {
    return TENANTS.find((tenant) => tenant.id === id) ?? null;
  }
}

/** Strips the port and casing so `LocalHost:3000` matches `localhost`. */
function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().trim().split(':')[0] ?? '';
}
