import { randomInt, randomUUID } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

/**
 * Suporte compartilhado dos specs E2E (SET-52). Mesmo padrão de fixture
 * isolada e limpa via `service_role` que `tests/trial-lifecycle.integration.test.ts`
 * já usa para os testes de integração — a diferença é que aqui a conta e o
 * representante nascem via formulário real no navegador, não via RPC direta,
 * porque o objetivo do E2E é provar o caminho que um visitante real percorre.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

export const canRunE2E = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ASAAS_WEBHOOK_TOKEN);
export const e2eSkipReason =
  'Configure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e ASAAS_WEBHOOK_TOKEN (.env.local) para rodar a suíte E2E.';

export function serviceClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('serviceClient() called without NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY configured.');
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

export interface E2ERepresentative {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly slug: string;
  readonly phone: string;
}

/**
 * Company every E2E-created representative belongs to — self-service
 * registration always resolves `company_id` to `'igreen'`
 * (`register_representative`, `20260806000000_add_register_representative.sql:457`),
 * the only Company that exists in the MVP. Named here, once, so every spec
 * navigating to a fixture's public Commercial Page composes the same
 * `<representative-slug>.<company-slug>.<tenant-root>` host (ADR-092)
 * without repeating the literal.
 */
export const E2E_COMPANY_SLUG = 'igreen';

/**
 * Local-dev origin for a fixture's public Commercial Page —
 * `http://<representative-slug>.<company-slug>.localhost:3000` (ADR-092).
 * Callers append `/<productSlug>`. Never resolves the app's own
 * `SITE_URL`/production root: local E2E runs always navigate through
 * `localhost`, the same Tenant root `parseCommercialPresenceHost` already
 * recognizes for local development.
 */
export function publicPageOrigin(fixture: Pick<E2ERepresentative, 'slug'>): string {
  return `http://${fixture.slug}.${E2E_COMPANY_SLUG}.localhost:3000`;
}

/** Dados determinísticos por execução — únicos o bastante para nunca colidir entre execuções paralelas ou repetidas. */
export function buildE2ERepresentative(prefix: string): E2ERepresentative {
  const unique = randomUUID().slice(0, 8);
  return {
    email: `e2e-${prefix}-${unique}@example.invalid`,
    password: `T3st-${unique}-Aa!`,
    displayName: `Teste E2E ${prefix}`,
    slug: `e2e-${prefix}-${unique}`,
    phone: '(11) 98888-7777',
  };
}

/**
 * CPF sintético com dígito verificador válido, gerado por execução — achado
 * testando o checkout: um CPF fixo (mesmo com formato válido) reutilizado em
 * várias rodadas contra a API real do Asaas Sandbox parece disparar
 * `duplicate_customer` ali (mensagem genérica no formulário, ver
 * `checkout-error-messages.ts`), o mesmo tipo de colisão que já forçou o
 * `x-forwarded-for` em `playwright.config.ts` a virar aleatório em vez de
 * fixo. Nunca um CPF real — apenas 9 dígitos aleatórios com os 2 dígitos
 * verificadores calculados pelo algoritmo padrão.
 */
export function generateSyntheticCPF(): string {
  const digits = Array.from({ length: 9 }, () => randomInt(0, 10));
  const checkDigit = (source: number[]): number => {
    const sum = source.reduce((acc, digit, index) => acc + digit * (source.length + 1 - index), 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const d10 = checkDigit(digits);
  const d11 = checkDigit([...digits, d10]);
  return [...digits, d10, d11].join('');
}

/** Preenche e envia `/criar-conta`. Assume que a página já está aberta lá (ou em uma rota que redireciona para lá). */
export async function signUp(page: Page, fixture: E2ERepresentative): Promise<void> {
  await page.goto('/criar-conta');
  await page.getByLabel('Nome completo').fill(fixture.displayName);
  await page.getByLabel('Telefone comercial').fill(fixture.phone);
  await page.getByLabel('E-mail').fill(fixture.email);
  await page.getByLabel('Senha', { exact: true }).fill(fixture.password);
  await page.getByLabel('Confirmar senha').fill(fixture.password);
  await page.getByLabel(/Li e aceito os/).check();
  // Duas ocorrências de "Criar conta" na página: o botão da navbar (abre o
  // modal) e o submit deste form — escopado a #conteudo para pegar só o
  // segundo, mesmo id que o layout usa como skip-link/main landmark.
  await page.locator('#conteudo').getByRole('button', { name: 'Criar conta' }).click();
  // Sem confirmação de e-mail obrigatória neste projeto (ver README/A6) —
  // sucesso navega direto para /app (onboarding), nunca fica na mesma página.
  await page.waitForURL('**/app');
}

/** Preenche e envia o formulário de onboarding, já em `/app` (sem representative ainda). */
export async function completeOnboarding(page: Page, fixture: E2ERepresentative): Promise<void> {
  await page.getByLabel('Endereço da sua página').fill(fixture.slug);
  await page.getByLabel('Nome público').fill(fixture.displayName);
  await page.getByLabel('Número de identificação').fill(`e2e-${randomUUID().slice(0, 12)}`);
  const phoneField = page.getByLabel('Telefone comercial');
  await phoneField.fill('');
  await phoneField.fill(fixture.phone);
  await page.getByRole('button', { name: 'Criar minha página' }).click();
  await page.waitForURL('**/app/paginas');
}

/**
 * Limpeza via `service_role` — loga (nunca lança) qualquer etapa que falhar,
 * para nunca mascarar um representante órfão como "limpo" quando não foi.
 * Achado rodando esta suíte pela primeira vez: `subscriptions` tem uma FK de
 * `billing_events` apontando pra ela (`billing_events_subscription_id_fkey`)
 * — apagar `subscriptions` antes de `billing_events` falha com violação de
 * FK, e como nenhuma chamada abaixo checava `.error`, isso deixou 22
 * representantes de teste (e os `auth.users` correspondentes) órfãos no
 * banco, sem nenhum aviso.
 */
export async function cleanupRepresentative(service: SupabaseClient, email: string): Promise<void> {
  const { data: usersPage, error: listError } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    console.error(`cleanupRepresentative: listUsers falhou para ${email}:`, listError.message);
    return;
  }
  const user = usersPage?.users.find((candidate) => candidate.email === email);
  if (!user) return;

  const { data: reps } = await service.from('representatives').select('id').eq('profile_id', user.id);
  const repIds = (reps ?? []).map((row) => row.id as string);
  if (repIds.length > 0) {
    const { data: subs } = await service.from('subscriptions').select('id').in('representative_id', repIds);
    const subIds = (subs ?? []).map((row) => row.id as string);

    const steps: Array<[string, () => PromiseLike<{ error: { message: string } | null }>]> = [
      ['leads', () => service.from('leads').delete().in('representative_id', repIds)],
      ['analytics_events', () => service.from('analytics_events').delete().in('representative_id', repIds)],
      ['feedback_responses', () => service.from('feedback_responses').delete().in('representative_id', repIds)],
      ['product_activations', () => service.from('product_activations').delete().in('representative_id', repIds)],
      [
        'billing_events',
        () => (subIds.length > 0
          ? service.from('billing_events').delete().in('subscription_id', subIds)
          : Promise.resolve({ error: null })),
      ],
      ['subscriptions', () => service.from('subscriptions').delete().in('representative_id', repIds)],
      ['representatives', () => service.from('representatives').delete().in('id', repIds)],
    ];
    for (const [table, run] of steps) {
      const { error } = await run();
      if (error) console.error(`cleanupRepresentative: apagar ${table} falhou para ${email}:`, error.message);
    }
  }
  const { error: deleteUserError } = await service.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    console.error(`cleanupRepresentative: deleteUser falhou para ${email}:`, deleteUserError.message);
  }
}
