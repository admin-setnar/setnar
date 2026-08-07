import type { Metadata } from 'next';
import Link from 'next/link';

import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { LogoutButton } from '@/modules/auth/presentation/logout-button';
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
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Conta' };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const representative = await (await getRepresentativeAccountRepository()).findByProfileId(user.id);

  // SET-62: `/app/conta` is the second of the two screens the trigger
  // allows the prompt on (`/app/paginas` is the other). Also checks
  // `first_publication`'s own eligibility here — not to render SET-61's
  // prompt (that stays `/app/paginas`-only), but because a representative
  // could otherwise see SET-61 on `/app/paginas` and SET-62 on `/app/conta`
  // within the same session, which ADR-070 documents as never allowed. No
  // cancellation flow exists yet to guard against overlapping (SET-32/
  // SET-63) — when it ships, that work is responsible for excluding this
  // prompt from its own screen, same as this check does not need to know
  // about a screen that does not exist today.
  let showValuePerceptionFeedback = false;
  if (representative) {
    const catalog = await (await getRepresentativeCatalogRepository()).listOwnCatalog(user.id);
    const [firstPublicationEligible, valuePerceptionEligible] = await Promise.all([
      resolveFirstPublicationFeedbackEligibility(catalog),
      resolveValuePerceptionFeedbackEligibility(representative.id),
    ]);
    showValuePerceptionFeedback = !firstPublicationEligible && valuePerceptionEligible;
  }

  return (
    <div className="space-y-8">
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
