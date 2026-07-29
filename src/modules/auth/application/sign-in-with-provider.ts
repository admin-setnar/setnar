import { failure, type SignInResult, type SocialProvider } from '@/modules/auth/domain/auth';
import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';

/** Social sign-in use case. Identical contract to email sign-in by design. */
export async function signInWithProvider(
  gateway: AuthGateway,
  provider: SocialProvider,
): Promise<SignInResult> {
  try {
    return await gateway.signInWithProvider(provider);
  } catch {
    return failure('provider_unavailable');
  }
}
