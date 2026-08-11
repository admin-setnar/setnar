import type { Metadata } from 'next';

import type { AnalyticsPeriodDays } from '@/modules/analytics/domain/analytics-metrics-repository';
import { getAnalyticsMetricsRepository } from '@/modules/analytics/infrastructure/analytics-metrics-repository-factory';
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

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  // SET-37: sent as a query string, so it is exactly as attacker-reachable
  // as any other entry point — allow-listed to the two literals a caller may
  // request, mirroring the `?error=` allow-list `/esqueci-senha` already
  // uses (SET-40). Anything else silently falls back to the 7-day default.
  const { periodo } = await searchParams;
  const periodDays: AnalyticsPeriodDays = periodo === '30' ? 30 : 7;

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
  const analyticsRepository = await getAnalyticsMetricsRepository();
  // The value-perception signals read and the SET-37 analytics summary only
  // need `representative.id` — neither depends on `catalog`, so both run in
  // the same batch instead of waiting on it first (a prior version awaited
  // value-perception only after the first-publication check, serializing a
  // read that did not need to be).
  const [catalog, subscriptionActive, valuePerceptionEligible, analyticsByProduct] = await Promise.all([
    catalogRepository.listOwnCatalog(user.id),
    catalogRepository.isSubscriptionActive(representative.id),
    resolveValuePerceptionFeedbackEligibility(representative.id),
    analyticsRepository.listOwnSummaryByProduct(representative.id, periodDays),
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
        analyticsByProduct={analyticsByProduct}
        periodDays={periodDays}
      />
    </div>
  );
}
