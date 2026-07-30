import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';

/**
 * Sign-out use case.
 *
 * No try/catch here, unlike sign-in/sign-up: there is no domain failure
 * shape to translate an exception into (this returns `void`), and letting
 * `gateway.signOut()` throw straight through is exactly what lets
 * `safeAuthCall` (the Server Action's wrapper) treat an unexpected failure
 * as an error instead of silently proceeding to redirect as if signed out.
 */
export async function signOut(gateway: AuthGateway): Promise<void> {
  await gateway.signOut();
}
