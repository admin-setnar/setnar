import { timingSafeEqual } from 'node:crypto';

/**
 * Compara o header `asaas-access-token` da requisição ao token configurado
 * em `ASAAS_WEBHOOK_TOKEN` em tempo constante. Autenticação de webhook do
 * Asaas não usa HMAC/assinatura — é um token estático que o próprio painel
 * do Asaas exige desde fev/2026
 * (`docs.asaas.com/changelog/obrigatoriedade-e-auto-geracao-de-tokens-para-webhooks`),
 * enviado de volta em toda notificação. `timingSafeEqual` exige buffers do
 * mesmo tamanho — a checagem de tamanho abaixo acontece antes dele; o único
 * vazamento por timing aceito é "o tamanho bate ou não", nunca o conteúdo do
 * token, mesmo padrão usado por bibliotecas de auth por token estático em
 * geral.
 */
export function verifyAsaasWebhookToken(receivedToken: string | null, expectedToken: string): boolean {
  if (!receivedToken) return false;

  const received = Buffer.from(receivedToken, 'utf8');
  const expected = Buffer.from(expectedToken, 'utf8');

  if (received.length !== expected.length) return false;

  return timingSafeEqual(received, expected);
}
