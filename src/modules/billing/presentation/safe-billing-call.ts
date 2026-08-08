import { isNextControlFlowError } from '@/shared/lib/next-control-flow-error';

/**
 * Cópia estrutural de `safeRepresentativeWriteCall`
 * (`modules/representatives/presentation/safe-representative-write-call.ts`)
 * para o módulo `billing` — mesmo raciocínio, módulo diferente: cada módulo
 * mantém seu próprio wrapper em vez de importar o de outro, mesma fronteira
 * de "cada módulo dono das próprias regras" que `ARCHITECTURE.md` já
 * estabelece.
 */
export async function safeBillingCall<T extends { readonly status: string }>(
  call: () => Promise<T>,
): Promise<T | { readonly status: 'error' }> {
  try {
    return await call();
  } catch (error) {
    if (isNextControlFlowError(error)) {
      throw error;
    }
    console.error('safeBillingCall: unexpected exception in a billing Server Action', error);
    return { status: 'error' };
  }
}
