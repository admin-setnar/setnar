import type {
  AuthResult,
  PasswordActionResult,
  SignInCredentials,
  SignInResult,
  SignUpData,
  SocialProvider,
} from '@/modules/auth/domain/auth';

/**
 * Port for every identity provider.
 *
 * The application layer depends on this interface only; the concrete adapter
 * (mock today, Clerk / Auth.js / Supabase tomorrow) is chosen in
 * infrastructure. Implementations must resolve with an AuthResult (or the
 * narrower SignInResult, for the two methods that can't create an account)
 * and reserve exceptions for genuinely unexpected failures.
 *
 * `signOut()` returns `void`, not a result type, but implementations must
 * still surface an unexpected provider failure by throwing rather than
 * swallowing it — a logout that silently fails and is then treated as
 * successful leaves the browser still authenticated while the UI claims
 * otherwise, on a control the user relies on to actually end their session
 * (e.g. on a shared device).
 */
export interface AuthGateway {
  signIn(credentials: SignInCredentials): Promise<SignInResult>;
  signUp(data: SignUpData): Promise<AuthResult>;
  signInWithProvider(provider: SocialProvider): Promise<SignInResult>;
  signOut(): Promise<void>;
  /**
   * `redirectTo` is an absolute URL to the callback that exchanges the
   * e-mail link's code for a session (see `app/auth/callback/route.ts` and
   * its ADR). Threaded in from the caller — which has request context via
   * `next/headers` — rather than assumed here, since the port has none.
   */
  requestPasswordReset(email: string, redirectTo: string): Promise<PasswordActionResult>;
  updatePassword(newPassword: string): Promise<PasswordActionResult>;
}
