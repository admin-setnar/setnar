import { failure, type AuthResult, type SignUpData } from '@/modules/auth/domain/auth';
import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';
import { isValidE164Phone } from '@/shared/domain/br-phone';

/**
 * Sign-up use case.
 *
 * Terms acceptance is enforced here, not only in the form: it is a business
 * rule, and a rule that only exists in the UI is a rule that can be skipped.
 */
export async function signUp(gateway: AuthGateway, data: SignUpData): Promise<AuthResult> {
  if (!data.acceptedTerms || !isValidE164Phone(data.phone)) {
    return failure('unknown');
  }

  try {
    return await gateway.signUp(data);
  } catch {
    return failure('unknown');
  }
}
