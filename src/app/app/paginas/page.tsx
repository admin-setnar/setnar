import type { Metadata } from 'next';

import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { resolveFirstPublicationFeedbackEligibility } from '@/modules/feedback/presentation/resolve-first-publication-eligibility';
import { resolveValuePerceptionFeedbackEligibility } from '@/modules/feedback/presentation/resolve-value-perception-eligibility';
import { getRepresentativeAccountRepository } from '@/modules/representatives/infrastructure/representative-account-repository-factory';
import { getRepresentativeCatalogRepository } from '@/modules/representatives/infrastructure/representative-catalog-repository-factory';
import { OnboardingForm } from '@/modules/representatives/presentation/onboarding-form';
import { RepresentativeHub } from '@/modules/representatives/presentation/representative-hub';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Páginas' };

export default async function PagesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const representative = await (await getRepresentativeAccountRepository()).findByProfileId(user.id);

  if (!representative) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <Text as="h1" variant="heading">Crie sua presença profissional</Text>
          <Text as="p" variant="body">Confirme seus dados para acessar o catálogo e publicar suas páginas.</Text>
        </div>
        <Card variant="raised" padding="lg">
          <OnboardingForm initialDisplayName={user.name} initialPhone={user.phone} />
        </Card>
      </div>
    );
  }

  const catalogRepository = await getRepresentativeCatalogRepository();
  // The value-perception signals read only needs `representative.id` — it
  // has no dependency on `catalog`, so it runs in the same batch instead of
  // waiting on it first (a prior version awaited it only after the
  // first-publication check, serializing a read that did not need to be).
  const [catalog, subscriptionActive, valuePerceptionEligible] = await Promise.all([
    catalogRepository.listOwnCatalog(user.id),
    catalogRepository.isSubscriptionActive(representative.id),
    resolveValuePerceptionFeedbackEligibility(representative.id),
  ]);

  // SET-61's own check needs `catalog`, so it cannot join the batch above.
  const showFirstPublicationFeedback = await resolveFirstPublicationFeedbackEligibility(catalog);
  // SET-62: never shown alongside SET-61's own prompt.
  const showValuePerceptionFeedback = !showFirstPublicationFeedback && valuePerceptionEligible;

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <Text as="h1" variant="heading">Suas páginas</Text>
        <Text as="p" variant="body">Ative produtos, publique páginas e compartilhe seus links.</Text>
      </div>
      <RepresentativeHub
        representative={representative}
        catalog={catalog}
        subscriptionActive={subscriptionActive}
        showFirstPublicationFeedback={showFirstPublicationFeedback}
        showValuePerceptionFeedback={showValuePerceptionFeedback}
      />
    </div>
  );
}
