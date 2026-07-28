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

export type AuthResult = AuthSuccess | AuthFailure;

export const failure = (code: AuthErrorCode): AuthFailure => ({ status: 'error', code });
export const success = (user: AuthenticatedUser): AuthSuccess => ({ status: 'success', user });
