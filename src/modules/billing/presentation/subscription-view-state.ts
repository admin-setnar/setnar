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
  | { readonly kind: 'inactive' };

export function getSubscriptionViewState(view: OwnSubscriptionView | null): SubscriptionViewState {
  if (!view) return { kind: 'none' };

  if (view.status === 'active') return { kind: 'active' };

  if (view.status === 'canceled') {
    if (view.currentPeriodEnd && new Date(view.currentPeriodEnd) > new Date()) {
      return { kind: 'active_until', currentPeriodEnd: view.currentPeriodEnd };
    }
    return { kind: 'inactive' };
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
      };
    case 'payment_failed':
      return {
        banner: {
          tone: 'error',
          title: 'Não conseguimos confirmar seu pagamento',
          description: 'As tentativas automáticas de cobrança falharam. Tente novamente para reativar sua assinatura.',
        },
        showCheckoutForm: true,
        confirmedActive: false,
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
      };
    case 'checkout_incomplete':
    case 'none':
      return { banner: null, showCheckoutForm: true, confirmedActive: false };
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
    };
  }

  return { banner: kindPanel.banner, showCheckoutForm: kindPanel.showCheckoutForm };
}
