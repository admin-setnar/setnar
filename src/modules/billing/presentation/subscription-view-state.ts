import type { OwnSubscriptionView } from '@/modules/billing/domain/subscription-repository';

/**
 * Vista mínima para `/app/conta` decidir entre mostrar o formulário de
 * checkout, um estado de espera, ou a assinatura ativa. Cobertura completa
 * dos estados nuançados (ex.: `past_due` exposto como estado próprio) fica
 * para SET-31, que estende este mesmo arquivo em vez de reescrevê-lo.
 *
 * `payment_failed` é separado de `checkout_incomplete` porque as duas
 * situações exigem UX opostas, e não são o mesmo estado só "mais cedo" ou
 * "mais tarde" no mesmo caminho: `checkout_incomplete` é "nunca pagou, a
 * linha nasce assim em `reserve_billing_checkout_slot()` e ainda não tem
 * `external_subscription_id`"; `payment_failed` só é alcançável depois que o
 * webhook (SET-29/30) já gravou um `external_subscription_id` real — ou
 * seja, sempre representa uma cobrança POSTERIOR que esgotou as tentativas
 * do gateway (política SET-25), nunca um primeiro pagamento pendente.
 * Tratar as duas como o mesmo estado escondia o caminho de retry de quem já
 * pagou pelo menos uma vez.
 */
export type SubscriptionViewState =
  | { readonly kind: 'none' }
  | { readonly kind: 'checkout_incomplete' }
  | { readonly kind: 'payment_failed' }
  | { readonly kind: 'active' }
  | { readonly kind: 'active_until'; readonly currentPeriodEnd: string }
  | { readonly kind: 'inactive' }
  | { readonly kind: 'trialing'; readonly trialEndsAt: string }
  | { readonly kind: 'trial_expired' };

export function getSubscriptionViewState(view: OwnSubscriptionView | null): SubscriptionViewState {
  if (!view) return { kind: 'none' };

  if (view.status === 'active') return { kind: 'active' };

  if (view.status === 'canceled') {
    if (view.currentPeriodEnd && new Date(view.currentPeriodEnd) > new Date()) {
      return { kind: 'active_until', currentPeriodEnd: view.currentPeriodEnd };
    }
    return { kind: 'inactive' };
  }

  // SET-67: `trial_ends_at` mora na mesma coluna `current_period_end` — a
  // linha nunca deixa de ser `trialing` sozinha na expiração (mesmo padrão
  // de `canceled` acima); só uma conversão real escreve `active`.
  if (view.status === 'trialing') {
    if (view.currentPeriodEnd && new Date(view.currentPeriodEnd) > new Date()) {
      return { kind: 'trialing', trialEndsAt: view.currentPeriodEnd };
    }
    return { kind: 'trial_expired' };
  }

  // status === 'suspended' (ou 'past_due', reservado e sem uso real — ver
  // migration 20260823000000).
  return view.hasExternalSubscription ? { kind: 'payment_failed' } : { kind: 'checkout_incomplete' };
}

export interface SubscriptionPanelBanner {
  readonly tone: 'success' | 'error';
  readonly title: string;
  readonly description?: string;
}

export interface SubscriptionPanelState {
  readonly banner: SubscriptionPanelBanner | null;
  readonly showCheckoutForm: boolean;
  /** SET-32: verdadeiro só para `active`/`payment_failed` — há uma assinatura no Asaas para cancelar e ela ainda não foi cancelada. */
  readonly canCancel: boolean;
}

interface KindPanel extends SubscriptionPanelState {
  /**
   * Verdadeiro somente para `active`/`active_until` — os únicos `kind`s que
   * já refletem um pagamento confirmado. Decidido AQUI, dentro do switch
   * exaustivo, e não como uma segunda condição escrita à mão em
   * `getSubscriptionPanelState`: é o que faz o override de
   * `checkoutParam === 'success'` logo abaixo derivar do mesmo lugar
   * compilador-verificado que decide o banner/formulário, em vez de manter
   * sua própria lista de exceções que um novo `kind` (SET-31) poderia
   * herdar silenciosamente sem ser adicionado a ela.
   */
  readonly confirmedActive: boolean;
}

function getKindPanel(state: SubscriptionViewState): KindPanel {
  switch (state.kind) {
    case 'active':
      return {
        banner: { tone: 'success', title: 'Sua assinatura está ativa.' },
        showCheckoutForm: false,
        confirmedActive: true,
        canCancel: true,
      };
    case 'active_until':
      return {
        banner: {
          tone: 'success',
          title: 'Assinatura cancelada',
          description: `Você mantém acesso até ${new Date(state.currentPeriodEnd).toLocaleDateString('pt-BR')}.`,
        },
        showCheckoutForm: false,
        confirmedActive: true,
        // Já cancelada — nada a repetir. `prepare_own_subscription_cancellation()`
        // devolveria `already_canceled` de qualquer forma; esconder o botão
        // aqui evita a viagem ao servidor para descobrir isso.
        canCancel: false,
      };
    case 'payment_failed':
      return {
        banner: {
          tone: 'error',
          title: 'Não conseguimos confirmar seu pagamento',
          // SET-58: antes só dizia "reative sua assinatura" — não deixava
          // claro que a página pública já ficou indisponível nesse meio
          // tempo, mesmo padrão que 'inactive'/'trial_expired' já usam.
          description:
            'As tentativas automáticas de cobrança falharam e sua página pública ficou indisponível. Tente novamente para reativar sua assinatura.',
        },
        showCheckoutForm: true,
        confirmedActive: false,
        // Cobrança já falhou, acesso já perdido (SET-25) — cancelar aqui só
        // formaliza que o representante não quer mais tentar regularizar
        // (DOMAIN_MODEL.md §14.3, "Active/Suspended→Canceled").
        canCancel: true,
      };
    case 'inactive':
      return {
        banner: {
          tone: 'error',
          title: 'Sua assinatura não está ativa',
          description: 'Assine novamente para voltar a publicar suas páginas.',
        },
        showCheckoutForm: true,
        confirmedActive: false,
        canCancel: false,
      };
    case 'checkout_incomplete':
    case 'none':
      return { banner: null, showCheckoutForm: true, confirmedActive: false, canCancel: false };
    case 'trialing':
      return {
        banner: {
          tone: 'success',
          title: 'Seu período de teste está ativo.',
          description: `Grátis até ${new Date(state.trialEndsAt).toLocaleDateString('pt-BR')}. Assine quando quiser continuar depois disso.`,
        },
        showCheckoutForm: true,
        // Já tem entitlement real agora (SET-67) — mas, ao contrário de
        // `active`/`active_until`, nada foi cobrado ainda, então o
        // formulário de checkout continua visível para permitir converter
        // a qualquer momento durante o trial.
        confirmedActive: true,
        // Nada agendado no Asaas para cancelar — o trial só expira sozinho.
        canCancel: false,
      };
    case 'trial_expired':
      return {
        banner: {
          tone: 'error',
          title: 'Seu período de teste acabou',
          description: 'Assine para voltar a publicar suas páginas.',
        },
        showCheckoutForm: true,
        confirmedActive: false,
        canCancel: false,
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

/**
 * Decisão única de UI para a seção "Assinatura" de `/app/conta` — banner e
 * formulário de checkout derivados de um único switch exaustivo sobre
 * `SubscriptionViewState['kind']` (`getKindPanel`), em vez de duas
 * expressões booleanas separadas (`checkoutJustSucceeded`/`showCheckoutForm`)
 * que podiam divergir silenciosamente. O `never` no `default` de
 * `getKindPanel` faz um novo `kind` não tratado ali falhar o `typecheck`,
 * não produzir uma UI inconsistente em runtime — importante porque SET-31
 * vai estender `SubscriptionViewState` com estados mais nuançados neste
 * mesmo arquivo.
 *
 * `checkoutParam === 'success'` tem prioridade sobre o `kind` persistido,
 * exceto quando `getKindPanel` já marcou o estado como `confirmedActive`: o
 * redirect do Asaas chega antes do webhook (SET-29/30) gravar o pagamento,
 * então o dado local ainda pode estar `inactive`/`payment_failed`/
 * `checkout_incomplete` por um instante. Confiar no redirect o suficiente
 * para mostrar "aguardando confirmação" em vez do estado obsoleto, mas nunca
 * o suficiente para afirmar `active` — essa afirmação sempre espera o
 * webhook, mesmo princípio de `BILLING_DECISIONS_PLAN.md`, "redirect não
 * concede entitlement".
 */
export function getSubscriptionPanelState(
  state: SubscriptionViewState,
  checkoutParam: string | undefined,
): SubscriptionPanelState {
  const kindPanel = getKindPanel(state);

  if (checkoutParam === 'success' && !kindPanel.confirmedActive) {
    return {
      banner: {
        tone: 'success',
        title: 'Aguardando confirmação de pagamento',
        description: 'Assim que o pagamento for confirmado, sua assinatura é ativada automaticamente.',
      },
      showCheckoutForm: false,
      canCancel: false,
    };
  }

  return { banner: kindPanel.banner, showCheckoutForm: kindPanel.showCheckoutForm, canCancel: kindPanel.canCancel };
}
