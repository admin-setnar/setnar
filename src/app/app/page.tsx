import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { LogoutButton } from '@/modules/auth/presentation/logout-button';
import { getRepresentativeAccountRepository } from '@/modules/representatives/infrastructure/representative-account-repository-factory';
import { getRepresentativeCatalogRepository } from '@/modules/representatives/infrastructure/representative-catalog-repository-factory';
import { OnboardingForm } from '@/modules/representatives/presentation/onboarding-form';
import { RepresentativeHub } from '@/modules/representatives/presentation/representative-hub';
import { Card } from '@/shared/ui/card';
import { Container } from '@/shared/layout/container';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Sua conta', robots: { index: false, follow: false } };

/**
 * `/app` — Sprint B's one protected route.
 *
 * Content is deliberately minimal: the authenticated user's name/e-mail, a
 * way to sign out, and (D3.B.5) one of two states below the fold depending
 * on whether the signed-in User already has a Representative. No catalogue,
 * no product pages, no full dashboard — that is D5 (the real hub), out of
 * scope here. This page exists to prove the middleware-refreshed session +
 * redirect-with-`?next=` flow end to end, and now the onboarding/hub branch
 * itself, not to ship the authenticated product surface.
 *
 * No session → `redirect('/entrar?next=/app')`, the real path of this
 * route, not a literal duplicated elsewhere — if this route ever moves, the
 * redirect target moves with it automatically.
 *
 * D3.B.5: `getRepresentativeAccountRepository().findByProfileId(user.id)`
 * decides the branch below — `null` (no Representative row yet) renders
 * `OnboardingForm` (D3.B.4); a resolved `Representative` renders
 * `RepresentativeHub` (D5), which replaced `RepresentativeHubPlaceholder`.
 *
 * D5.1: the catalog read (`RepresentativeCatalogRepository.listOwnCatalog()`)
 * only runs in the "has a Representative" branch — it needs the caller's own
 * Representative row to resolve a `company_id` to filter Products by, so
 * fetching it before knowing `representative` is non-null would be wasted
 * work on the onboarding path.
 */
export default async function AppHomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/entrar?next=/app');
  }

  const representative = await (await getRepresentativeAccountRepository()).findByProfileId(user.id);
  const catalogRepository = representative ? await getRepresentativeCatalogRepository() : null;
  const [catalog, subscriptionActive] = representative && catalogRepository
    ? await Promise.all([
        catalogRepository.listOwnCatalog(user.id),
        catalogRepository.isSubscriptionActive(representative.id),
      ])
    : [[], false];

  return (
    <main id="conteudo" className="pt-16 pb-20">
      <Container width="narrow">
        <Text as="h1" variant="heading">
          Sua conta
        </Text>

        <Card variant="raised" padding="lg" className="mt-8 space-y-1">
          <Text as="p" variant="body">
            <strong className="text-content">{user.name}</strong>
          </Text>
          <Text as="p" variant="caption">
            {user.email}
          </Text>
        </Card>

        <div className="mt-6">
          <LogoutButton />
        </div>

        {representative ? (
          <RepresentativeHub
            representative={representative}
            catalog={catalog}
            subscriptionActive={subscriptionActive}
          />
        ) : (
          <Card variant="raised" padding="lg" className="mt-8">
            <Text as="h2" variant="title" className="mb-4">
              Criar sua página de representante
            </Text>
            <OnboardingForm />
          </Card>
        )}
      </Container>
    </main>
  );
}
