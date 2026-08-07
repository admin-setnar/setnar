import { failure, type AuthFailure } from '@/modules/auth/domain/auth';
import { isNextControlFlowError } from '@/shared/lib/next-control-flow-error';

/**
 * Converts a client-to-Server-Action transport failure into the same safe,
 * provider-agnostic result used by the server boundary. Validation and known
 * Auth failures still arrive as their specific result; this catch only covers
 * a rejected request (offline, interrupted connection or another transport
 * exception) before the form can receive one.
 */
export async function safeClientAuthCall<T>(call: () => Promise<T>): Promise<T | AuthFailure> {
  try {
    return await call();
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    return failure('unknown');
  }
}
