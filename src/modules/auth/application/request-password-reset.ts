import { failure, type PasswordActionResult } from '@/modules/auth/domain/auth';
import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';

/**
 * Request-password-reset use case.
 *
 * No input validation beyond what the form/schema already does (a
 * well-formed e-mail) — unlike sign-up's terms check, there is no business
 * rule here that would matter if skipped, since the gateway itself is
 * already anti-enumeration by design (see SupabaseAuthGateway).
 */
export async function requestPasswordReset(
  gateway: AuthGateway,
  email: string,
  redirectTo: string,
): Promise<PasswordActionResult> {
  try {
    return await gateway.requestPasswordReset(email, redirectTo);
  } catch {
    return failure('unknown');
  }
}
