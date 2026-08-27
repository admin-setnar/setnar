import { expect, test } from '@playwright/test';

import {
  buildE2ERepresentative,
  canRunE2E,
  cleanupRepresentative,
  completeOnboarding,
  e2eSkipReason,
  publicPageOrigin,
  serviceClient,
  signUp,
} from './support/fixtures';

/**
 * SET-84, passo 8 — E2E do fluxo completo de Divulgação, ponta a ponta num
 * navegador real: cadastro → onboarding → ativação/publicação → o
 * representante gera um kit em `/app/divulgacao` para o canal Instagram Post
 * → o link do kit (com `?src=instagram_post`) é o que um visitante real
 * (sessão própria, sem cookie do representante) de fato usa → a visita, o
 * clique no WhatsApp e o lead desse visitante são atribuídos à mesma origem
 * → o hub do representante (`/app/paginas`, D5) reflete isso na seção "De
 * onde vieram seus resultados".
 *
 * Este é literalmente o critério de "Definição de pronto" do plano
 * (`docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md`): "um licenciado consegue
 * entrar na SETNAR, escolher um produto, escolher onde quer divulgar, obter
 * tudo pronto, divulgar usando as ações oferecidas e depois a SETNAR
 * consegue dizer de qual origem vieram as visitas e leads".
 *
 * O que este spec NÃO tenta provar, de propósito, porque já está provado na
 * camada certa:
 * - Que a origem persiste corretamente nas três RPCs, isolamento entre
 *   representantes, degradação de origem inválida —
 *   `tests/origin-attribution.integration.test.ts` (SET-84 passo 3).
 * - O contrato de `resolveDivulgacaoCopy`/`buildMarketingMaterialPropsForOrigin`
 *   — `tests/divulgacao-copy.test.ts`/`tests/marketing-materials-props.test.ts`.
 * - Visita/lead/clique de WhatsApp SEM origem, e o hub em geral —
 *   `tests/e2e/critical-path.spec.ts` (SET-52), que este spec não duplica.
 * Este spec cobre o que só um navegador real prova: o `?src=` que o kit
 * realmente entrega (não reconstruído à mão) é o que um visitante real usa,
 * e a origem sobrevive de ponta a ponta — do clique em "Instagram — Post"
 * até a linha na tela de resultados do representante. O host do link
 * (`publicPageOrigin()`, não o `buildCommercialPageUrl()` de produção que o
 * kit de fato mostra) segue a mesma solução que `critical-path.spec.ts`/
 * `commercial-pages.spec.ts` já usam para navegar localmente — ver o
 * comentário no passo que extrai o link.
 */
test.describe('fluxo completo de Divulgação com atribuição de origem (E2E, desktop)', () => {
  test.skip(!canRunE2E, e2eSkipReason);

  const fixture = buildE2ERepresentative('divulgacao');
  const service = canRunE2E ? serviceClient() : null;

  test.afterAll(async () => {
    if (service) await cleanupRepresentative(service, fixture.email);
  });

  test('kit de Instagram Post gera um link atribuído, e a origem chega até o hub', async ({ page, browser }) => {
    await test.step('cadastro e onboarding', async () => {
      await signUp(page, fixture);
      await completeOnboarding(page, fixture);
      await expect(page.getByRole('heading', { name: 'Suas páginas' })).toBeVisible();
    });

    await test.step('ativa e publica o primeiro produto do catálogo', async () => {
      await page.getByRole('button', { name: 'Ativar' }).first().click();
      await expect(page.getByRole('button', { name: 'Publicar' })).toBeEnabled({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Publicar' }).click();
      await expect(page.getByRole('button', { name: 'Despublicar' })).toBeVisible({ timeout: 15_000 });
    });

    const { representativeId, productId, productSlug, productName } = await test.step('resolve o produto publicado via banco', async () => {
      const { data: rep } = await service!.from('representatives').select('id').eq('slug', fixture.slug).single();
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
        .select('slug, name')
        .eq('id', activation!.product_id as string)
        .single();
      expect(product).toBeTruthy();
      return {
        representativeId: rep!.id as string,
        productId: activation!.product_id as string,
        productSlug: product!.slug as string,
        productName: product!.name as string,
      };
    });

    let visitorUrl = '';

    await test.step('/app/divulgacao: escolhe o produto, o canal Instagram Post, e o kit sai com ?src= no link', async () => {
      await page.goto('/app/divulgacao');
      await page.getByRole('button', { name: productName }).click();
      await page.getByRole('button', { name: 'Instagram — Post' }).click();

      const copyBlock = page.getByText(/Chama no link da bio/);
      await expect(copyBlock).toBeVisible({ timeout: 15_000 });
      const copyText = await copyBlock.textContent();
      const match = copyText?.match(/https:\/\/\S+/);
      expect(match, `esperava um link no texto do kit, recebi: ${copyText}`).toBeTruthy();
      const taggedLink = match![0];
      expect(taggedLink).toContain(`/${productSlug}?src=instagram_post`);

      // buildCommercialPageUrl() sempre deriva de NEXT_PUBLIC_SITE_URL
      // (`https://setnar.com` neste projeto — commercial-page-url.ts), nunca
      // do host da requisição, então o link real do kit não é navegável a
      // partir do `next dev` local. Mesma solução que todo outro spec desta
      // suíte já usa (`publicPageOrigin()`): o host muda para
      // `localhost:3000`, mas o `?src=` — a única parte que este teste
      // precisa provar — é extraído do link real que o kit gerou, não
      // reconstruído à mão.
      const query = taggedLink.slice(taggedLink.indexOf('?'));
      expect(query).toBe('?src=instagram_post');
      visitorUrl = `${publicPageOrigin(fixture)}/${productSlug}${query}`;

      // D2: qrcode/direct não têm bloco de copy — Instagram Post tem, e o
      // botão "Copiar link" deve estar presente para qualquer canal.
      await expect(page.getByRole('button', { name: 'Copiar texto' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Copiar link' })).toBeVisible();
    });

    // Contexto novo, sem nenhum cookie do representante — é o que garante que
    // isViewerOwner() avalie como visitante externo, não como o próprio dono
    // conferindo a página (owner-view exclusion, ADR-053), e que este spec
    // prove o caminho de um visitante real, não o do representante logado.
    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();

    await test.step('um visitante real (sem sessão) abre a página com a mesma origem que o kit gerou', async () => {
      await visitorPage.goto(visitorUrl);
      await expect(visitorPage.getByRole('link', { name: 'Falar no WhatsApp' }).first()).toBeVisible();
      await expect(visitorPage.locator('#quero-simular').getByRole('button')).toBeVisible();
    });

    await test.step('o visitante envia um lead', async () => {
      await visitorPage.getByLabel('Nome').fill('Visitante Divulgação E2E');
      await visitorPage.getByLabel('Telefone').fill('(21) 97777-6666');
      await visitorPage.locator('#quero-simular').getByRole('button').click();
      await expect(visitorPage.getByText('Recebemos seus dados')).toBeVisible({ timeout: 10_000 });
    });

    await test.step('o visitante clica no WhatsApp — a navegação real para wa.me não é seguida', async () => {
      const [popup] = await Promise.all([
        visitorContext.waitForEvent('page'),
        visitorPage.getByRole('link', { name: 'Falar no WhatsApp' }).first().click(),
      ]);
      await popup.close();
    });

    await test.step('visita, lead e clique de WhatsApp foram gravados com origin = instagram_post', async () => {
      await expect
        .poll(
          async () => {
            const { count } = await service!
              .from('analytics_events')
              .select('id', { count: 'exact', head: true })
              .eq('representative_id', representativeId)
              .eq('product_id', productId)
              .eq('event_type', 'visit')
              .eq('origin', 'instagram_post');
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
              .eq('event_type', 'whatsapp_click')
              .eq('origin', 'instagram_post');
            return count ?? 0;
          },
          { timeout: 10_000 },
        )
        .toBeGreaterThan(0);

      const { data: lead } = await service!
        .from('leads')
        .select('origem, origin')
        .eq('representative_id', representativeId)
        .eq('product_id', productId)
        .single();
      expect(lead).toBeTruthy();
      // As duas colunas convivem sem se sobrescrever (§0/§1 do plano): origem
      // é a superfície de captura, origin é o canal de divulgação.
      expect(lead!.origem).toBe('commercial_page');
      expect(lead!.origin).toBe('instagram_post');
    });

    await visitorContext.close();

    await test.step('/app/paginas mostra "De onde vieram seus resultados" com a linha de Instagram Post', async () => {
      await page.goto('/app/paginas');
      const row = page.getByRole('row').filter({ hasText: 'Instagram Post' });
      await expect(row).toBeVisible({ timeout: 15_000 });
      // 1 visita, 1 lead → 100% — confirma que o breakdown por origem (D5)
      // realmente contou a visita e o lead deste visitante, não só que a
      // linha "Instagram Post" apareceu vazia.
      await expect(row).toContainText('100%');
    });
  });
});
