'use client';

import { useState } from 'react';

import { cancelSubscriptionAction } from '@/modules/billing/presentation/actions';
import {
  cancelSubscriptionErrorCopy,
  type CancelSubscriptionFailure,
} from '@/modules/billing/presentation/cancel-subscription-error-messages';
import { Button } from '@/shared/ui/button';
import { FormAlert } from '@/shared/ui/form-alert';
import { Modal } from '@/shared/ui/modal';
import { Text } from '@/shared/ui/typography';

/**
 * Botão + confirmação de cancelamento (SET-32), renderizado só quando
 * `SubscriptionPanelState.canCancel` é verdadeiro (`subscription-view-state.ts`
 * decide isso exaustivamente por `kind`, esta camada não repete a regra).
 *
 * Sem estado de "sucesso" local — `cancelSubscriptionAction` faz
 * `revalidatePath` nos dois casos de sucesso (`canceled`/`already_canceled`)
 * e o Server Component pai re-renderiza com `canCancel: false` no próximo
 * ciclo (o painel já muda de banner sozinho, ex.: "Assinatura cancelada...
 * até DD/MM"), mesmo mecanismo que `ProductActivationCard` já documenta.
 * Este componente só precisa fechar o modal e, em caso de falha, mostrar o
 * motivo — nunca afirmar sucesso que a resposta não confirmou.
 */
export function CancelSubscriptionPanel() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<CancelSubscriptionFailure | null>(null);

  async function handleConfirm() {
    setPending(true);
    setFailure(null);
    try {
      const result = await cancelSubscriptionAction();
      if (result) {
        setFailure(result);
        return;
      }
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {failure ? <FormAlert tone="error" {...cancelSubscriptionErrorCopy(failure)} /> : null}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setFailure(null);
          setOpen(true);
        }}
      >
        Cancelar assinatura
      </Button>

      <Modal
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        title="Cancelar sua assinatura?"
        description="A próxima cobrança não acontece mais. Você continua com acesso e sua página publicada até o fim do período que já pagou — nenhum dado ou configuração é apagado."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Manter assinatura
            </Button>
            <Button type="button" variant="danger" loading={pending} onClick={() => void handleConfirm()}>
              Confirmar cancelamento
            </Button>
          </div>
        }
      >
        <Text as="p" variant="body">
          Se mudar de ideia, você pode assinar novamente a qualquer momento — nenhum crédito ou desconto pelo
          período restante é aplicado.
        </Text>
      </Modal>
    </>
  );
}
