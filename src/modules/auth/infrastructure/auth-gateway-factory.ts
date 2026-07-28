import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';
import { MockAuthGateway } from '@/modules/auth/infrastructure/mock-auth-gateway';

let instance: AuthGateway | null = null;

/**
 * Composition root for authentication.
 *
 * The one place that decides which adapter the application uses. Swapping to a
 * real provider means returning a different implementation here — no consumer
 * changes, because every consumer depends on the AuthGateway port.
 */
export function getAuthGateway(): AuthGateway {
  instance ??= new MockAuthGateway();
  return instance;
}
