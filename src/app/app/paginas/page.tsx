import type { Metadata } from 'next';

import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { hasPublishedAtLeastOnce, isFirstPublicationFeedbackEligible } from '@/modules/feedback/domain/first-publication-eligibility';
import { getFeedbackGateway } from '@/modules/feedback/infrastructure/feedback-gateway-factory';
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
  const [catalog, subscriptionActive] = await Promise.all([
    catalogRepository.listOwnCatalog(user.id),
    catalogRepository.isSubscriptionActive(representative.id),
  ]);

  // SET-61: `isFirstPublicationFeedbackEligible` is the tested rule
  // (`modules/feedback/domain/first-publication-eligibility.ts`). The
  // resolved-state read only runs when publishing has happened at least
  // once — no reason to query `feedback_responses` for a representative who
  // could not be eligible regardless of its answer.
  const firstPublicationFeedbackResolved = hasPublishedAtLeastOnce(catalog)
    ? await (await getFeedbackGateway()).isResolved('first_publication')
    : true;

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
        showFirstPublicationFeedback={isFirstPublicationFeedbackEligible(catalog, firstPublicationFeedbackResolved)}
      />
    </div>
  );
}
