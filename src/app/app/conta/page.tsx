import type { Metadata } from 'next';
import Link from 'next/link';

import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { LogoutButton } from '@/modules/auth/presentation/logout-button';
import { CancelSubscriptionPanel } from '@/modules/billing/presentation/cancel-subscription-panel';
import { CheckoutForm } from '@/modules/billing/presentation/checkout-form';
import { getSubscriptionPanelState, getSubscriptionViewState } from '@/modules/billing/presentation/subscription-view-state';
import { getSubscriptionRepository } from '@/modules/billing/infrastructure/subscription-repository-factory';
import {
  CANCELLATION_FEEDBACK_OPTIONS,
  CANCELLATION_FEEDBACK_QUESTION,
  CANCELLATION_OPTIONS_WITH_DETAIL,
} from '@/modules/feedback/presentation/cancellation-feedback-options';
import { resolveCancellationFeedbackEligibility } from '@/modules/feedback/presentation/resolve-cancellation-feedback-eligibility';
import { resolveFirstPublicationFeedbackEligibility } from '@/modules/feedback/presentation/resolve-first-publication-eligibility';
import { resolveValuePerceptionFeedbackEligibility } from '@/modules/feedback/presentation/resolve-value-perception-eligibility';
import {
  VALUE_PERCEPTION_DETAIL_LABEL,
  VALUE_PERCEPTION_FEEDBACK_OPTIONS,
  VALUE_PERCEPTION_FEEDBACK_QUESTION,
  VALUE_PERCEPTION_OPTIONS_WITH_DETAIL,
} from '@/modules/feedback/presentation/value-perception-feedback-options';
import { getRepresentativeAccountRepository } from '@/modules/representatives/infrastructure/representative-account-repository-factory';
import { getRepresentativeCatalogRepository } from '@/modules/representatives/infrastructure/representative-catalog-repository-factory';
import { RepresentativeProfileForm } from '@/modules/representatives/presentation/representative-profile-form';
import { isRepresentativeProfileComplete } from '@/modules/representatives/domain/representative-rules';
import { Card } from '@/shared/ui/card';
import { FeedbackPrompt } from '@/shared/ui/feedback-prompt';
import { FormAlert } from '@/shared/ui/form-alert';
import { ScrollToHash } from '@/shared/ui/scroll-to-hash';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Conta' };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { checkout: checkoutParam } = await searchParams;

  const representative = await (await getRepresentativeAccountRepository()).findByProfileId(user.id);

  const subscriptionView = representative ? await (await getSubscriptionRepository()).getOwnSubscription() : null;
  const subscriptionState = getSubscriptionViewState(subscriptionView);

  // SET-62/63: `/app/conta` renders at most one microfeedback prompt per
  // visit — ADR-070's mutual-exclusion rule, now extended to `cancellation`
  // (the screen ADR-070 itself flagged as not existing yet, and left that
  // work responsible for excluding itself from). Priority order:
  // `first_publication` (checked, never rendered here — `/app/paginas`-only)
  // > `cancellation` > `value_perception`. Cancellation outranks value
  // perception deliberately: a representative on the cancellation
  // confirmation screen has already decided to leave, so asking "is SETNAR
  // helping you promote your work?" in the same breath would read as
  // contradictory noise, not a coherent moment to ask either question.
  let showValuePerceptionFeedback = false;
  let showCancellationFeedback = false;
  if (representative) {
    const catalog = await (await getRepresentativeCatalogRepository()).listOwnCatalog(user.id);
    const [firstPublicationEligible, valuePerceptionEligible, cancellationEligible] = await Promise.all([
      resolveFirstPublicationFeedbackEligibility(catalog),
      resolveValuePerceptionFeedbackEligibility(representative.id),
      resolveCancellationFeedbackEligibility(subscriptionState.kind === 'active_until'),
    ]);
    showCancellationFeedback = !firstPublicationEligible && cancellationEligible;
    showValuePerceptionFeedback = !firstPublicationEligible && !showCancellationFeedback && valuePerceptionEligible;
  }

  // `startCheckoutAction` (modules/billing/presentation/actions.ts) sends the
  // Asaas Checkout callback here with `?checkout=success|canceled|expired` —
  // `getSubscriptionPanelState` folds that redirect signal and the persisted
  // `subscriptionState.kind` into one exhaustive decision (banner +
  // show-the-form-or-not), see its own doc comment for why the two must
  // never be computed as separate, independently-driftable booleans.
  const subscriptionPanel = getSubscriptionPanelState(subscriptionState, checkoutParam);

  return (
    <div className="space-y-8">
      <ScrollToHash targetId="assinatura" />
      <div className="space-y-2">
        <Text as="h1" variant="heading">Conta</Text>
        <Text as="p" variant="body">Mantenha seus dados profissionais e de acesso atualizados.</Text>
      </div>

      {showValuePerceptionFeedback ? (
        <FeedbackPrompt
          context="value_perception"
          question={VALUE_PERCEPTION_FEEDBACK_QUESTION}
          options={VALUE_PERCEPTION_FEEDBACK_OPTIONS}
          optionsWithDetail={VALUE_PERCEPTION_OPTIONS_WITH_DETAIL}
          detailLabel={VALUE_PERCEPTION_DETAIL_LABEL}
        />
      ) : null}

      <section id="perfil-profissional" aria-labelledby="perfil-profissional-titulo" className="scroll-mt-8">
        <Card variant="raised" padding="lg" className="space-y-5">
          <div className="space-y-1">
            <Text id="perfil-profissional-titulo" as="h2" variant="title">Perfil profissional</Text>
            <Text as="p" variant="caption">Esses dados aparecem nas suas páginas públicas.</Text>
          </div>
          {!representative ? (
            <FormAlert
              tone="error"
              title="Conclua primeiro a criação da sua página"
              description="O perfil profissional será disponibilizado depois do onboarding."
            />
          ) : (
            <>
              {!isRepresentativeProfileComplete(representative) ? (
                <FormAlert
                  tone="error"
                  title="Complete seu perfil para publicar"
                  description="Informe um nome público e um telefone comercial válido."
                />
              ) : null}
              <RepresentativeProfileForm representative={representative} />
            </>
          )}
          {!representative ? (
            <Link href="/app/paginas" className="inline-flex min-h-11 items-center font-medium text-brand underline underline-offset-4">
              Ir para o onboarding
            </Link>
          ) : null}
        </Card>
      </section>

      {representative ? (
        <section id="assinatura" aria-labelledby="assinatura-titulo" className="scroll-mt-8">
          <Card variant="outlined" padding="lg" className="space-y-5">
            <div className="space-y-1">
              <Text id="assinatura-titulo" as="h2" variant="title">Assinatura</Text>
              <Text as="p" variant="caption">
                Necessária para publicar suas páginas e mantê-las no ar.
              </Text>
            </div>
            {subscriptionPanel.banner ? (
              <FormAlert
                tone={subscriptionPanel.banner.tone}
                title={subscriptionPanel.banner.title}
                description={subscriptionPanel.banner.description}
              />
            ) : null}
            {showCancellationFeedback ? (
              <FeedbackPrompt
                context="cancellation"
                question={CANCELLATION_FEEDBACK_QUESTION}
                options={CANCELLATION_FEEDBACK_OPTIONS}
                optionsWithDetail={CANCELLATION_OPTIONS_WITH_DETAIL}
              />
            ) : null}
            {checkoutParam === 'canceled' ? (
              <FormAlert tone="error" title="Checkout cancelado" description="Você pode tentar novamente quando quiser." />
            ) : null}
            {checkoutParam === 'expired' ? (
              <FormAlert tone="error" title="O link de pagamento expirou" description="Tente novamente para gerar um novo link." />
            ) : null}
            {subscriptionPanel.showCheckoutForm ? (
              <CheckoutForm defaultName={representative.name} defaultEmail={user.email} />
            ) : null}
            {subscriptionPanel.canCancel ? <CancelSubscriptionPanel /> : null}
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="dados-acesso-titulo">
        <Card variant="outlined" padding="lg" className="space-y-5">
          <div className="space-y-1">
            <Text id="dados-acesso-titulo" as="h2" variant="title">Dados de acesso</Text>
            <Text as="p" variant="caption">Use este e-mail para entrar na sua conta.</Text>
          </div>
          <div>
            <p className="text-sm font-medium text-content">E-mail</p>
            <p className="mt-1 break-all text-sm text-content-muted">{user.email}</p>
          </div>
          <LogoutButton />
        </Card>
      </section>
    </div>
  );
}
