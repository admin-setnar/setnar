import { failure, type PasswordActionResult } from '@/modules/auth/domain/auth';
import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';
import { hasLetterAndDigit, PASSWORD_MIN_LENGTH } from '@/modules/auth/domain/auth-rules';

/**
 * Update-password use case (final step of the reset flow).
 *
 * Re-checks the password rule here, not only in the form's schema — same
 * reasoning as `signUp`'s terms-acceptance check: a rule enforced only in
 * the UI is a rule that can be skipped. Reads `PASSWORD_MIN_LENGTH`/
 * `hasLetterAndDigit` from `auth-rules.ts` rather than restating the rule.
 */
export async function updatePassword(
  gateway: AuthGateway,
  newPassword: string,
): Promise<PasswordActionResult> {
  if (newPassword.length < PASSWORD_MIN_LENGTH || !hasLetterAndDigit(newPassword)) {
    return failure('weak_password');
  }

  try {
    return await gateway.updatePassword(newPassword);
  } catch {
    return failure('unknown');
  }
}
