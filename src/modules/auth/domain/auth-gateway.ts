import type {
  AuthResult,
  SignInCredentials,
  SignUpData,
  SocialProvider,
} from '@/modules/auth/domain/auth';

/**
 * Port for every identity provider.
 *
 * The application layer depends on this interface only; the concrete adapter
 * (mock today, Clerk / Auth.js / Supabase tomorrow) is chosen in
 * infrastructure. Implementations must resolve with an AuthResult and reserve
 * exceptions for genuinely unexpected failures.
 */
export interface AuthGateway {
  signIn(credentials: SignInCredentials): Promise<AuthResult>;
  signUp(data: SignUpData): Promise<AuthResult>;
  signInWithProvider(provider: SocialProvider): Promise<AuthResult>;
}
