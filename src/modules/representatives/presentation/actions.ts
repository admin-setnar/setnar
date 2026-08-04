'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { registerRepresentative } from '@/modules/representatives/application/register-representative';
import type { ProductActivationStatus } from '@/modules/representatives/domain/product-activation-gateway';
import { formatPhoneToE164 } from '@/modules/representatives/domain/representative-rules';
import { getProductActivationGateway } from '@/modules/representatives/infrastructure/product-activation-gateway-factory';
import { getRepresentativeOnboardingGateway } from '@/modules/representatives/infrastructure/representative-onboarding-gateway-factory';
import { getRepresentativeProfileGateway } from '@/modules/representatives/infrastructure/representative-profile-gateway-factory';
import type {
  ActivateProductFailure,
  SetActivationStatusFailure,
} from '@/modules/representatives/presentation/activation-error-messages';
import type { RegisterRepresentativeFailure } from '@/modules/representatives/presentation/representative-onboarding-error-messages';
import type { UpdateRepresentativeProfileFailure } from '@/modules/representatives/presentation/representative-profile-error-messages';
import { safeRepresentativeWriteCall } from '@/modules/representatives/presentation/safe-representative-write-call';
import { safeOnboardingCall } from '@/modules/representatives/presentation/safe-onboarding-call';
import {
  representativeOnboardingSchema,
  type RepresentativeOnboardingFormValues,
} from '@/modules/representatives/presentation/schemas/representative-onboarding.schema';
import {
  representativeProfileSchema,
  type RepresentativeProfileFormValues,
} from '@/modules/representatives/presentation/schemas/representative-profile.schema';

/**
 * Server Action — the only entry point `OnboardingForm` uses to reach
 * `register_representative`. Re-validates with the same Zod schema the form
 * already uses client-side: client validation is for feedback, this is the
 * one that actually guarantees nothing malformed reaches the gateway — same
 * split `modules/auth/presentation/actions.ts` already uses.
 *
 * D3.B.5: success now navigates via `redirect('/app')`, called *inside* the
 * `safeOnboardingCall` callback so its `NEXT_REDIRECT` throw is recognised
 * and re-thrown, not swallowed — see `safe-onboarding-call.ts` and ADR-020,
 * same care `signUpAction`/`signInAction` already take. A normal return is
 * therefore always a failure (`'rejected'` or `'error'`) — same convention
 * every auth Server Action already establishes: a normal return means
 * failure, success means navigation. `/app` itself (not this action) is what
 * now decides whether to render the onboarding form or the hub, based on
 * whether the signed-in User already has a Representative
 * (`RepresentativeAccountRepository`).
 */
export async function registerRepresentativeAction(
  values: RepresentativeOnboardingFormValues,
): Promise<RegisterRepresentativeFailure> {
  const parsed = representativeOnboardingSchema.safeParse(values);
  if (!parsed.success) return { status: 'error' };

  return safeOnboardingCall(async () => {
    const gateway = await getRepresentativeOnboardingGateway();
    const result = await registerRepresentative(gateway, {
      slug: parsed.data.slug,
      displayName: parsed.data.displayName,
      authorizationId: parsed.data.authorizationId,
      phone: parsed.data.phone ? formatPhoneToE164(parsed.data.phone) : null,
      city: parsed.data.city ? parsed.data.city : null,
    });
    if (result.status === 'rejected' || result.status === 'error') return result;
    redirect('/app');
  });
}

/**
 * D5.2 — activates `productId` (creates a `draft` Product Activation, or
 * resolves successfully if one already exists) for the signed-in
 * Representative. Called by the hub's "Ativar" control on a
 * `'not_activated'` catalog entry.
 *
 * `productId` is never validated with Zod here: it is not free text a human
 * types, it is one of the ids the hub itself rendered from
 * `RepresentativeCatalogRepository.listOwnCatalog()` moments earlier — the
 * same trust level `set_activation_status`'s own migration header already
 * grants a request carrying a value this Server Action didn't originate
 * (`activate_product` re-derives the Representative from `auth.uid()` and
 * re-checks Catalog membership itself; a forged id fails there, typed, not
 * here).
 *
 * `revalidatePath('/app')` on success — not a `redirect()`: unlike onboarding
 * (a one-time account-creation step that navigates on success), activation is
 * a repeatable in-place action the hub itself stays on. The Server Component
 * re-renders with the updated catalog on the next request.
 *
 * Return type is `ActivateProductFailure | null`, `null` meaning success —
 * not the "normal return is always failure" convention `registerRepresentativeAction`
 * uses, because that convention only works when success ends in a `redirect()`
 * throw (so the function body never actually returns a success value to type
 * against). This action does not redirect, so it needs an explicit,
 * type-honest way to say "worked" without smuggling the excluded `'activated'`
 * variant back through a type that says it can't happen.
 */
export async function activateProductAction(productId: string): Promise<ActivateProductFailure | null> {
  const result = await safeRepresentativeWriteCall(async () => {
    const gateway = await getProductActivationGateway();
    return gateway.activate(productId);
  });

  if (result.status === 'activated') {
    revalidatePath('/app');
    return null;
  }
  return result;
}

/**
 * D5.2 — transitions `productId`'s activation to `'published'` or
 * `'unpublished'` for the signed-in Representative. Called by the hub's
 * "Publicar"/"Despublicar" controls. Same `productId` trust note as
 * `activateProductAction` above, and the same `null`-means-success return
 * shape, for the same reason.
 */
export async function setActivationStatusAction(
  productId: string,
  status: ProductActivationStatus,
): Promise<SetActivationStatusFailure | null> {
  const result = await safeRepresentativeWriteCall(async () => {
    const gateway = await getProductActivationGateway();
    return gateway.setStatus(productId, status);
  });

  if (result.status === 'updated') {
    revalidatePath('/app');
    return null;
  }
  return result;
}

/**
 * D5b — saves `phone`/`city`/`authorizationId` for the signed-in Representative.
 * Re-validates with the same Zod schema `RepresentativeProfileForm` already
 * uses client-side, same split every other form action in this file
 * establishes.
 *
 * `phone` is formatted to E.164 before reaching the gateway, same as
 * `registerRepresentativeAction` does for the same field — the form collects
 * the BR mask (`(11) 98888-7777`), `update_representative_profile` expects
 * E.164. An empty string means "clear the field", passed through as `null`
 * (the SQL function's own `nullif(trim(...), '')` would do the same
 * normalization for a raw RPC caller, but a Server Action call always
 * carries a parsed, already-typed value, not a string the function needs to
 * trim).
 *
 * `null`-means-success, same reasoning as `activateProductAction`/
 * `setActivationStatusAction`: this action never `redirect()`s, it updates
 * the hub in place via `revalidatePath`.
 */
export async function updateRepresentativeProfileAction(
  values: RepresentativeProfileFormValues,
): Promise<UpdateRepresentativeProfileFailure | null> {
  const parsed = representativeProfileSchema.safeParse(values);
  if (!parsed.success) return { status: 'error' };

  const result = await safeRepresentativeWriteCall(async () => {
    const gateway = await getRepresentativeProfileGateway();
    return gateway.update({
      phone: parsed.data.phone ? formatPhoneToE164(parsed.data.phone) : null,
      city: parsed.data.city ? parsed.data.city : null,
      authorizationId: parsed.data.authorizationId,
    });
  });

  if (result.status === 'updated') {
    revalidatePath('/app');
    return null;
  }
  return result;
}
