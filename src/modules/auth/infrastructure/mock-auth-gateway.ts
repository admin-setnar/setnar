import {
  failure,
  success,
  type AuthResult,
  type SignInCredentials,
  type SignInResult,
  type SignUpData,
  type SocialProvider,
} from '@/modules/auth/domain/auth';
import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';
import { hasLetterAndDigit, PASSWORD_MIN_LENGTH } from '@/modules/auth/domain/auth-rules';

const NETWORK_DELAY_MS = 900;

/**
 * In-memory adapter used until a real identity provider is wired in.
 *
 * It exists so the modals can be built, reviewed and tested against every
 * state — loading, error, success — before any backend exists. Deterministic
 * triggers keep those states reproducible in review:
 *
 *   sign in  · senha-invalida@setnar.com  → invalid_credentials
 *   sign in  · bloqueado@setnar.com       → rate_limited
 *   sign up  · existente@setnar.com       → email_already_registered
 *   social   · any provider               → provider_unavailable
 *   anything else                         → success
 *
 * Replacing this file with a Clerk/Supabase adapter is the entire migration.
 */
export class MockAuthGateway implements AuthGateway {
  async signIn(credentials: SignInCredentials): Promise<SignInResult> {
    await delay();
    const email = credentials.email.trim().toLowerCase();

    if (email === 'senha-invalida@setnar.com') return failure('invalid_credentials');
    if (email === 'bloqueado@setnar.com') return failure('rate_limited');

    return success({
      id: 'usr_mock_signin',
      name: nameFromEmail(email),
      email,
      tenantId: 'setnar',
    });
  }

  async signUp(data: SignUpData): Promise<AuthResult> {
    await delay();
    const email = data.email.trim().toLowerCase();

    if (email === 'existente@setnar.com') return failure('email_already_registered');
    if (data.password.length < PASSWORD_MIN_LENGTH || !hasLetterAndDigit(data.password)) {
      return failure('weak_password');
    }

    return success({
      id: 'usr_mock_signup',
      name: data.name.trim(),
      email,
      tenantId: 'setnar',
    });
  }

  async signInWithProvider(_provider: SocialProvider): Promise<SignInResult> {
    await delay(400);
    return failure('provider_unavailable');
  }
}

function delay(ms: number = NETWORK_DELAY_MS): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function nameFromEmail(email: string): string {
  const [localPart = 'Representante'] = email.split('@');
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}
