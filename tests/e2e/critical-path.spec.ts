import { expect, test } from '@playwright/test';

import {
  ASAAS_WEBHOOK_TOKEN,
  buildE2ERepresentative,
  canRunE2E,
  cleanupRepresentative,
  completeOnboarding,
  e2eSkipReason,
  generateSyntheticCPF,
  serviceClient,
  signUp,
} from './support/fixtures';

/**
 * SET-52 — cenário feliz desktop do caminho crítico do MVP, ponta a ponta
 * num navegador real: cadastro → onboarding → ativação → publicação →
 * página pública → lead → clique de WhatsApp → analytics refletidos no hub
 * → reserva de checkout → confirmação de pagamento via webhook.
 *
 * O que este spec NÃO tenta provar, de propósito, porque já está provado na
 * camada certa (integração, contra o mesmo Postgres real, sem a fragilidade
 * de um navegador):
 * - "Sem entitlement não publica" — `publication-follows-entitlement.integration.test.ts`.
 * - "Redirect sem webhook não ativa acesso" — `checkout-redirect-does-not-grant-entitlement.integration.test.ts`.
 * - "Webhook idempotente/autenticado" — `apply-billing-event.integration.test.ts`.
 * Este spec cobre o que só um navegador real prova: formulário → Server
 * Action → RPC → efeito visível na tela, na ordem que um representante de
 * verdade percorre.
 *
 * Checkout: o SET-67 já garante que o trial concede entitlement imediato ao
 * registrar (sem checkout nenhum) — por isso a publicação abaixo acontece
 * ANTES de qualquer checkout. A navegação real até a página hospedada do
 * Asaas não é testável a partir de `localhost` (ver o comentário no passo
 * de checkout abaixo) — este spec prova a reserva local e a confirmação via
 * webhook, os dois pedaços que seguem sob controle deste projeto.
 */
test.describe('caminho crítico do MVP (E2E, desktop)', () => {
  test.skip(!canRunE2E, e2eSkipReason);

  const fixture = buildE2ERepresentative('desktop');
  const service = canRunE2E ? serviceClient() : null;

  test.afterAll(async () => {
    if (service) await cleanupRepresentative(service, fixture.email);
  });

  test('cadastro, onboarding, publicação, lead, WhatsApp, analytics e reserva de checkout', async ({ page, context }) => {
    await test.step('cadastro', async () => {
      await signUp(page, fixture);
      await expect(page).toHaveURL(/\/app$/);
    });

    await test.step('onboarding cria o representante', async () => {
      await completeOnboarding(page, fixture);
      // Não usa getByText(fixture.slug): o fixture deriva slug/e-mail do mesmo
      // sufixo aleatório, então esse texto já era ambíguo por natureza (bate
      // com o e-mail da conta na barra lateral) — e SET-82 acrescentou um
      // segundo lugar (o preview de URL do próprio formulário de onboarding),
      // tornando esse "coincide 1x" ainda mais frágil. O sinal real de que o
      // onboarding terminou é a troca de tela para o hub de páginas.
      await expect(page.getByRole('heading', { name: 'Suas páginas' })).toBeVisible();
    });

    await test.step('ativa o primeiro produto do catálogo', async () => {
      await page.getByRole('button', { name: 'Ativar' }).first().click();
      await expect(page.getByRole('button', { name: 'Publicar' })).toBeEnabled({ timeout: 15_000 });
    });

    await test.step('publica — trial já concede entitlement, sem checkout', async () => {
      await page.getByRole('button', { name: 'Publicar' }).click();
      await expect(page.getByRole('button', { name: 'Despublicar' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Página no ar:')).toBeVisible();
    });

    // A partir daqui a asserção de estado usa o banco real (service_role),
    // mesma fonte de verdade que a UI lê — não faz sentido reimplementar a
    // lógica de resolução de tenant/slug aqui só para montar a URL pública.
    const { representativeId, productId, productSlug } = await test.step('resolve o produto publicado via banco', async () => {
      const { data: rep } = await service!
        .from('representatives')
        .select('id')
        .eq('slug', fixture.slug)
        .single();
      expect(rep).toBeTruthy();
      const { data: activation } = await service!
        .from('product_activations')
        .select('product_id')
        .eq('representative_id', rep!.id as string)
        .eq('status', 'published')
        .single();
      expect(activation).toBeTruthy();
      const { data: product } = await service!
        .from('products')
        .select('slug')
        .eq('id', activation!.product_id as string)
        .single();
      expect(product).toBeTruthy();
      return {
        representativeId: rep!.id as string,
        productId: activation!.product_id as string,
        productSlug: product!.slug as string,
      };
    });

    const publicPage = await context.newPage();

    await test.step('a página pública carrega e registra a visita', async () => {
      await publicPage.goto(`http://${fixture.slug}.localhost:3000/${productSlug}`);
      await expect(publicPage.getByRole('link', { name: 'Falar no WhatsApp' }).first()).toBeVisible();
      await expect(publicPage.locator('#quero-simular').getByRole('button')).toBeVisible();
    });

    await test.step('um visitante envia um lead', async () => {
      await publicPage.getByLabel('Nome').fill('Visitante de Teste E2E');
      await publicPage.getByLabel('Telefone').fill('(21) 97777-6666');
      await publicPage.locator('#quero-simular').getByRole('button').click();
      await expect(publicPage.getByText('Recebemos seus dados')).toBeVisible({ timeout: 10_000 });
    });

    await test.step('um visitante clica no WhatsApp — a navegação real para wa.me não é seguida', async () => {
      const [popup] = await Promise.all([
        context.waitForEvent('page'),
        publicPage.getByRole('link', { name: 'Falar no WhatsApp' }).first().click(),
      ]);
      await popup.close();
    });

    await test.step('visita, lead e clique de WhatsApp foram gravados', async () => {
      await expect
        .poll(
          async () => {
            const { count } = await service!
              .from('analytics_events')
              .select('id', { count: 'exact', head: true })
              .eq('representative_id', representativeId)
              .eq('product_id', productId)
              .eq('event_type', 'visit');
            return count ?? 0;
          },
          { timeout: 10_000 },
        )
        .toBeGreaterThan(0);

      await expect
        .poll(
          async () => {
            const { count } = await service!
              .from('analytics_events')
              .select('id', { count: 'exact', head: true })
              .eq('representative_id', representativeId)
              .eq('product_id', productId)
              .eq('event_type', 'whatsapp_click');
            return count ?? 0;
          },
          { timeout: 10_000 },
        )
        .toBeGreaterThan(0);

      const { count: leadsCount } = await service!
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('representative_id', representativeId)
        .eq('product_id', productId);
      expect(leadsCount).toBeGreaterThan(0);
    });

    await test.step('o hub do representante reflete visita, clique e lead', async () => {
      await page.reload();
      await expect(page.getByText(/1 visita|visitas/)).toBeVisible();
      await expect(page.getByText(/clique/)).toBeVisible();
      await expect(page.getByText(/1 lead|leads/)).toBeVisible();
    });

    // `resolveCallbackBaseUrl()` (`modules/billing/presentation/actions.ts`)
    // monta successUrl/cancelUrl/expiredUrl a partir do `Host` da própria
    // requisição — correto para produção/preview da Vercel (mesmo raciocínio
    // do link de redefinição de senha, `supabase/README.md` §3), mas
    // significa que em `localhost` o Asaas Sandbox real rejeita a criação do
    // checkout (`invalid_object`, "O campo successUrl é inválido.") — a API
    // não aceita um domínio não-público como URL de callback. Achado
    // depurando este spec: não é bug do produto nem deste teste, é uma
    // limitação inerente de testar contra o Asaas real sem um domínio
    // público — por isso este passo verifica o que É observável a partir
    // daqui (a reserva local, que acontece ANTES da chamada ao Asaas: ver
    // `start-checkout.ts`), não a navegação até o Asaas em si.
    await test.step('iniciar checkout reserva a vaga local antes de tentar o Asaas', async () => {
      await page.goto('/app/conta');
      await page.getByLabel('Nome completo').fill(fixture.displayName);
      await page.getByLabel('CPF ou CNPJ').fill(generateSyntheticCPF());
      await page.getByLabel('E-mail').fill(fixture.email);
      await page.getByLabel('CEP').fill('01311-000');
      await page.getByLabel('Número do endereço').fill('100');
      await page.getByRole('button', { name: /Assinar por/ }).click();

      await expect
        .poll(
          async () => {
            const { data } = await service!
              .from('subscriptions')
              .select('provider, amount_cents, status')
              .eq('representative_id', representativeId)
              .single();
            return data;
          },
          { timeout: 15_000 },
        )
        .toMatchObject({ provider: 'asaas', amount_cents: 2790, status: 'trialing' });
    });

    await test.step('confirmação de pagamento via webhook (sem depender da página hospedada do Asaas)', async () => {
      const { data: subscription } = await service!
        .from('subscriptions')
        .select('id, status')
        .eq('representative_id', representativeId)
        .single();
      expect(subscription).toBeTruthy();
      expect(subscription!.status).toBe('trialing');

      const response = await page.request.post('http://localhost:3000/api/billing/asaas-webhook', {
        headers: { 'asaas-access-token': ASAAS_WEBHOOK_TOKEN! },
        data: {
          id: `evt-e2e-${representativeId}`,
          event: 'CHECKOUT_PAID',
          checkout: { id: 'checkout_e2e_test', externalReference: subscription!.id },
        },
      });
      expect(response.ok()).toBe(true);

      const { data: afterPayment } = await service!
        .from('subscriptions')
        .select('status')
        .eq('representative_id', representativeId)
        .single();
      expect(afterPayment!.status).toBe('active');
    });
  });
});
