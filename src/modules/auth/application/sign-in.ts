import { failure, type AuthResult, type SignInCredentials } from '@/modules/auth/domain/auth';
import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';

/**
 * Sign-in use case.
 *
 * Owns orchestration and failure translation so the UI only ever deals with an
 * AuthResult. Unexpected exceptions are converted into a domain failure code —
 * users never see a technical message.
 */
export async function signIn(
  gateway: AuthGateway,
  credentials: SignInCredentials,
): Promise<AuthResult> {
  try {
    return await gateway.signIn(credentials);
  } catch {
    return failure('unknown');
  }
}
