'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  failure,
  type AuthFailure,
  type AuthPendingConfirmation,
  type PasswordActionResult,
  type SocialProvider,
} from '@/modules/auth/domain/auth';
import { requestPasswordReset } from '@/modules/auth/application/request-password-reset';
import { signIn } from '@/modules/auth/application/sign-in';
import { signInWithProvider } from '@/modules/auth/application/sign-in-with-provider';
import { signOut } from '@/modules/auth/application/sign-out';
import { signUp } from '@/modules/auth/application/sign-up';
import { updatePassword } from '@/modules/auth/application/update-password';
import { getAuthGateway } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { safeAuthCall } from '@/modules/auth/presentation/safe-auth-call';
import { safeRedirectTarget } from '@/modules/auth/presentation/safe-redirect-target';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/modules/auth/presentation/schemas/forgot-password.schema';
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '@/modules/auth/presentation/schemas/reset-password.schema';
import { signInSchema, type SignInFormValues } from '@/modules/auth/presentation/schemas/sign-in.schema';
import { signUpSchema, type SignUpFormValues } from '@/modules/auth/presentation/schemas/sign-up.schema';

/**
 * Server Actions — the only entry point Client Components use to reach
 * authentication. Re-validates with the same Zod schemas the forms already
 * use client-side: client validation is for feedback, this is the one that
 * actually guarantees nothing malformed reaches the gateway.
 *
 * `signInAction`/`signUpAction`/`signInWithProviderAction` no longer return
 * `AuthSuccess` on the happy path (Sprint B): success now navigates via
 * `redirect(safeRedirectTarget(next))`, called *inside* the `safeAuthCall`
 * callback so its `NEXT_REDIRECT` throw is recognised and re-thrown, not
 * swallowed — see `safe-auth-call.ts` and ADR-020. A normal return from any
 * of the three is therefore always a failure (or, for sign-up,
 * `AuthPendingConfirmation` — the dead-but-kept seam for when Confirm email
 * is re-enabled, see ADR-016 and the README's Confirm-email decision note).
 */

export async function signInAction(
  values: SignInFormValues,
  next?: string,
): Promise<AuthFailure> {
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return failure('unknown');

  return safeAuthCall(async () => {
    const result = await signIn(await getAuthGateway(), parsed.data);
    if (result.status === 'error') return result;
    redirect(safeRedirectTarget(next));
  });
}

export async function signUpAction(
  values: SignUpFormValues,
  next?: string,
): Promise<AuthFailure | AuthPendingConfirmation> {
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return failure('unknown');

  return safeAuthCall(async () => {
    const result = await signUp(await getAuthGateway(), {
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      acceptedTerms: parsed.data.acceptedTerms,
    });
    if (result.status === 'error' || result.status === 'pending_confirmation') return result;
    redirect(safeRedirectTarget(next));
  });
}

export async function signInWithProviderAction(
  provider: SocialProvider,
  next?: string,
): Promise<AuthFailure> {
  return safeAuthCall(async () => {
    const result = await signInWithProvider(await getAuthGateway(), provider);
    if (result.status === 'error') return result;
    redirect(safeRedirectTarget(next));
  });
}

export async function signOutAction(): Promise<AuthFailure> {
  return safeAuthCall(async () => {
    await signOut(await getAuthGateway());
    redirect('/');
  });
}

export async function requestPasswordResetAction(
  values: ForgotPasswordFormValues,
): Promise<PasswordActionResult> {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return failure('unknown');

  return safeAuthCall(async () =>
    requestPasswordReset(await getAuthGateway(), parsed.data.email, await resolveResetCallbackUrl()),
  );
}

/**
 * On success, redirects to `/app` rather than returning `{ status: 'ok' }`
 * — same reasoning as `signInAction`/`signUpAction`/`signOutAction`: a fresh
 * password already comes with a valid session (established by
 * `app/auth/callback/route.ts`), so there is somewhere real to send the
 * user, and every other "auth succeeded" path in this app already means
 * "navigate", not "render an inline success state".
 */
export async function updatePasswordAction(values: ResetPasswordFormValues): Promise<AuthFailure> {
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) return failure('unknown');

  return safeAuthCall(async () => {
    const result = await updatePassword(await getAuthGateway(), parsed.data.password);
    if (result.status === 'error') return result;
    redirect('/app');
  });
}

/**
 * Absolute URL for the e-mail link's callback (`app/auth/callback/route.ts`)
 * — Supabase requires a full origin, not a path, to build the link it sends.
 * `x-forwarded-proto` is what Vercel sets in production; falls back to
 * `http` for local dev, where that header is absent and the host is
 * `localhost`.
 */
async function resolveResetCallbackUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get('host') ?? 'localhost:3000';
  const protocol = headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}/auth/callback?next=/redefinir-senha`;
}
