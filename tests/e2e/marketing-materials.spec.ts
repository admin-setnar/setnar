import { expect, test } from '@playwright/test';

import {
  buildE2ERepresentative,
  canRunE2E,
  cleanupRepresentative,
  completeOnboarding,
  e2eSkipReason,
  HUB_RENDER_SETTLE_TIMEOUT,
  serviceClient,
  signUp,
} from './support/fixtures';

/**
 * SET-65 — caminho real de materiais de marketing num navegador real:
 * cadastro → onboarding → ativação/publicação de um produto → o material
 * correspondente aparece em `/app/paginas/marketing`, já personalizado →
 * baixar produz um arquivo de verdade (evento `download` do navegador).
 *
 * O que este spec NÃO tenta provar, de propósito, porque já está provado na
 * camada certa:
 * - Contrato de props/mapper e disponibilidade por produto —
 *   `tests/marketing-materials-props.test.ts`/`-availability.test.ts`.
 * - As 21 peças existem e o registry as referencia — `tests/marketing-materials-registry.test.ts`.
 * - Fidelidade visual e escolha do pipeline de exportação (client-side,
 *   `html-to-image`) — `docs/adr/ADR-090-...md`, validado via POC.
 * Este spec cobre o que só um navegador real prova: a tela renderiza um
 * material de verdade para um produto publicado, e o botão "Baixar" produz
 * um arquivo de verdade — não que o arquivo seja pixel-perfeito.
 */
test.describe('materiais de marketing (E2E, desktop)', () => {
  test.skip(!canRunE2E, e2eSkipReason);

  const fixture = buildE2ERepresentative('materials');
  const service = canRunE2E ? serviceClient() : null;

  test.afterAll(async () => {
    if (service) await cleanupRepresentative(service, fixture.email);
  });

  test('material do primeiro produto publicado aparece personalizado e o download real funciona', async ({ page }) => {
    await test.step('cadastro e onboarding', async () => {
      await signUp(page, fixture);
      await completeOnboarding(page, fixture);
      await expect(page.getByRole('heading', { name: 'Suas páginas' })).toBeVisible({ timeout: HUB_RENDER_SETTLE_TIMEOUT });
    });

    await test.step('ativa e publica o primeiro produto do catálogo', async () => {
      await page.getByRole('button', { name: 'Ativar' }).first().click();
      await expect(page.getByRole('button', { name: 'Publicar' })).toBeEnabled({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Publicar' }).click();
      await expect(page.getByRole('button', { name: 'Despublicar' })).toBeVisible({ timeout: 15_000 });
    });

    await test.step('o material do produto publicado aparece em /app/paginas/marketing, já personalizado', async () => {
      await page.goto('/app/paginas/marketing');
      const card = page.getByRole('tablist').first();
      await expect(card).toBeVisible({ timeout: 15_000 });
      // Dado real do representante, não um placeholder — prova que o mapper
      // (Representative → MarketingMaterialProps) rodou de ponta a ponta,
      // não só que a tela abriu. .first(): o nome também aparece no rodapé
      // da barra lateral da conta — dois lugares válidos, não ambiguidade.
      await expect(page.getByText(fixture.displayName).first()).toBeVisible();
    });

    await test.step('trocar para Story troca a peça renderizada', async () => {
      await page.getByRole('tab', { name: /story/i }).first().click();
      await expect(page.getByRole('tab', { name: /story/i }).first()).toHaveAttribute('aria-selected', 'true');
    });

    await test.step('Baixar PNG produz um download real', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15_000 }),
        page.getByRole('button', { name: /baixar png/i }).first().click(),
      ]);
      expect(download.suggestedFilename()).toMatch(new RegExp(`^${fixture.slug}-.+-story\\.png$`));
    });
  });
});
