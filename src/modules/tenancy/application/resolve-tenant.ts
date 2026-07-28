import { toClientView, type Tenant, type TenantClientView } from '@/modules/tenancy/domain/tenant';
import { getTenantRepository } from '@/modules/tenancy/infrastructure/tenant-repository-factory';
import { DEFAULT_TENANT_ID } from '@/config/site';

/**
 * Resolves which tenant a request belongs to.
 *
 * Falls back to the default tenant rather than throwing: an unmapped preview
 * domain should render the product, not a 500. A genuinely missing default is a
 * configuration error and does throw.
 */
export async function resolveTenant(hostname: string | null): Promise<Tenant> {
  const repository = getTenantRepository();

  const byHostname = hostname ? await repository.findByHostname(hostname) : null;
  if (byHostname) return byHostname;

  const fallback = await repository.findById(DEFAULT_TENANT_ID);
  if (!fallback) {
    throw new Error(`Default tenant "${DEFAULT_TENANT_ID}" is not registered.`);
  }
  return fallback;
}

export async function resolveTenantClientView(
  hostname: string | null,
): Promise<TenantClientView> {
  return toClientView(await resolveTenant(hostname));
}
