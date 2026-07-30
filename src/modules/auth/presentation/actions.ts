'use server';

import {
  failure,
  type AuthResult,
  type SignInResult,
  type SocialProvider,
} from '@/modules/auth/domain/auth';
import { signIn } from '@/modules/auth/application/sign-in';
import { signInWithProvider } from '@/modules/auth/application/sign-in-with-provider';
import { signUp } from '@/modules/auth/application/sign-up';
import { getAuthGateway } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { signInSchema, type SignInFormValues } from '@/modules/auth/presentation/schemas/sign-in.schema';
import { signUpSchema, type SignUpFormValues } from '@/modules/auth/presentation/schemas/sign-up.schema';

/**
 * Server Actions — the only entry point Client Components use to reach
 * authentication. Re-validates with the same Zod schemas the forms already
 * use client-side: client validation is for feedback, this is the one that
 * actually guarantees nothing malformed reaches the gateway.
 */

export async function signInAction(values: SignInFormValues): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return failure('unknown');

  return signIn(await getAuthGateway(), parsed.data);
}

export async function signUpAction(values: SignUpFormValues): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return failure('unknown');

  return signUp(await getAuthGateway(), {
    name: parsed.data.name,
    email: parsed.data.email,
    password: parsed.data.password,
    acceptedTerms: parsed.data.acceptedTerms,
  });
}

export async function signInWithProviderAction(provider: SocialProvider): Promise<SignInResult> {
  return signInWithProvider(await getAuthGateway(), provider);
}
