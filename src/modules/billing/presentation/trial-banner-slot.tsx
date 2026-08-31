import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { getSubscriptionRepository } from '@/modules/billing/infrastructure/subscription-repository-factory';
import { getSubscriptionViewState } from '@/modules/billing/presentation/subscription-view-state';
import { TrialBanner } from '@/modules/billing/presentation/trial-banner';
import { getRepresentativeAccountRepository } from '@/modules/representatives/infrastructure/representative-account-repository-factory';

/**
 * SET-108's trial reminder, rendered from `/app/layout.tsx` on every
 * authenticated route so a trialing representative sees the deadline without
 * hunting for it in `/app/conta`. Kept out of the layout file itself — a
 * separate Server Component, one repository call deep — because
 * `authenticated-app-consolidation.test.ts` ("keeps route-specific data
 * outside the shared layout") asserts `RepresentativeAccountRepository`
 * never appears in `layout.tsx`'s own source; that route-specific fetches
 * belong to the feature that needs them (same split `/app/conta`,
 * `/app/paginas` and `/app/contatos` already follow), not the shared shell.
 *
 * Renders nothing for a `representative` still mid-onboarding (no
 * subscription row exists yet — `getSubscriptionViewState(null)` maps to
 * `kind: 'none'`) and for every `kind` other than `trialing`.
 */
export async function TrialBannerSlot() {
  const user = await getCurrentUser();
  if (!user) return null;

  const representative = await (await getRepresentativeAccountRepository()).findByProfileId(user.id);
  const subscriptionView = representative ? await (await getSubscriptionRepository()).getOwnSubscription() : null;
  const subscriptionState = getSubscriptionViewState(subscriptionView);

  if (subscriptionState.kind !== 'trialing') return null;

  return <TrialBanner trialEndsAt={subscriptionState.trialEndsAt} />;
}
