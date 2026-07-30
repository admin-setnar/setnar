/**
 * Core authentication types. Framework-free by design: swapping Clerk for
 * Supabase must not touch this file.
 */
export interface SignInCredentials {
  readonly email: string;
  readonly password: string;
  readonly rememberMe: boolean;
}

export interface SignUpData {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly acceptedTerms: boolean;
}

export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly tenantId: string;
}

/** Identity providers the gateway may support. */
export type SocialProvider = 'google' | 'microsoft';

/**
 * Stable, provider-agnostic failure codes. The UI maps these to wording; it
 * never parses provider messages.
 */
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_already_registered'
  | 'weak_password'
  | 'rate_limited'
  | 'email_service_unavailable'
  | 'provider_unavailable'
  | 'unknown';

export interface AuthFailure {
  readonly status: 'error';
  readonly code: AuthErrorCode;
}

export interface AuthSuccess {
  readonly status: 'success';
  readonly user: AuthenticatedUser;
}

/**
 * Sign-up created a real account, but it is not authenticated yet — the
 * project has "Confirm email" enabled, so a session only exists once the
 * user clicks the link sent to `email`. Distinct from `AuthFailure`: nothing
 * went wrong.
 */
export interface AuthPendingConfirmation {
  readonly status: 'pending_confirmation';
  readonly name: string;
  readonly email: string;
}

export type AuthResult = AuthSuccess | AuthFailure | AuthPendingConfirmation;

/**
 * `signIn` and `signInWithProvider` authenticate an existing account or
 * fail — there is no account to create, so they can never produce
 * `AuthPendingConfirmation`. Narrower than `AuthResult` on purpose, so the
 * sign-in UI doesn't need a branch for a state it can't receive.
 */
export type SignInResult = AuthSuccess | AuthFailure;

export const failure = (code: AuthErrorCode): AuthFailure => ({ status: 'error', code });
export const success = (user: AuthenticatedUser): AuthSuccess => ({ status: 'success', user });
export const pendingConfirmation = (name: string, email: string): AuthPendingConfirmation => ({
  status: 'pending_confirmation',
  name,
  email,
});
