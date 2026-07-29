import { failure, type SignInCredentials, type SignInResult } from '@/modules/auth/domain/auth';
import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';

/**
 * Sign-in use case.
 *
 * Owns orchestration and failure translation so the UI only ever deals with a
 * SignInResult. Unexpected exceptions are converted into a domain failure code —
 * users never see a technical message.
 */
export async function signIn(
  gateway: AuthGateway,
  credentials: SignInCredentials,
): Promise<SignInResult> {
  try {
    return await gateway.signIn(credentials);
  } catch {
    return failure('unknown');
  }
}
