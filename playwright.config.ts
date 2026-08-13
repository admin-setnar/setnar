import { randomInt } from 'node:crypto';

import { defineConfig, devices } from '@playwright/test';

/**
 * IP sintético por execução, não um valor fixo — achado rodando esta suíte
 * repetidamente: um `x-forwarded-for` fixo esgota o rate limit real de leads
 * (SET-20/ADR-036) depois de algumas rodadas, e a suíte passa a falhar por
 * um motivo que não é dela (o formulário mostra "Não foi possível enviar
 * agora", `submit_lead` protegendo contra o que parece spam do mesmo IP).
 * 203.0.113.0/24 é TEST-NET-3 (RFC 5737), reservado para documentação —
 * nunca um IP real; `.2`–`.254` evita `.0`/`.1`/`.255` (rede/gateway/broadcast).
 */
const SYNTHETIC_CLIENT_IP = `203.0.113.${randomInt(2, 255)}`;

// Mesma convenção de `npm run test`/`test:integration` (`--env-file-if-exists=.env.local`)
// — aqui replicada em código porque este arquivo é carregado pelo próprio
// `playwright` CLI, não pelo `node` com essa flag. Ausência do arquivo (CI,
// onde as variáveis já vêm dos secrets do workflow) não é erro.
try {
  process.loadEnvFile('.env.local');
} catch {
  // .env.local não existe — normal em CI.
}

/**
 * SET-52. E2E do fluxo crítico do MVP, contra o mesmo projeto Supabase real
 * usado pelos testes de integração (`tests/*.integration.test.ts`) — não há
 * banco descartável neste projeto (ver `docs/plans/SPRINT_E_PLAN.md` §2.4),
 * mesma postura. `webServer` sobe `next dev` local; cada teste cria seus
 * próprios fixtures isolados (e-mail/slug com `randomUUID()`) e limpa via
 * `service_role` no `afterAll`, mesmo padrão de `tests/trial-lifecycle.integration.test.ts`.
 *
 * Falhas gravam trace/screenshot (nunca variável de ambiente/segredo — o
 * Playwright não captura `process.env` no trace) só na primeira retry em CI,
 * para evidência diagnóstica sem custo em toda execução verde.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // 60s bastava no papel, mas o caminho crítico desktop é sequencial de
  // propósito (cadastro → onboarding → publicação → lead/WhatsApp em outra
  // aba → checkout → webhook, ~13 passos, cada um uma chamada real ao
  // Supabase/Next dev server) — achado rodando esta suíte várias vezes
  // nesta sessão: uma execução real e sem bug nenhum levou 56.8s, quase
  // estourando o timeout sozinha, sem nenhuma lentidão anormal. Sem
  // margem nenhuma, isso vira flake de CI em runners mais lentos, não um
  // sinal real de regressão.
  timeout: 90_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // `getClientIp()`/`getTrustedClientIp()` só confia num IP encaminhado
    // dentro de um runtime Vercel verificado (`shared/lib/trusted-client-ip.ts`)
    // — em `next dev` local isso nunca é verdade, então a visita nunca seria
    // gravada. `VERCEL=1` abaixo (env do `webServer`) mais este header
    // simulam exatamente o contrato que a Vercel real cumpre em produção.
    extraHTTPHeaders: { 'x-forwarded-for': SYNTHETIC_CLIENT_IP },
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['critical-path.spec.ts', 'commercial-pages.spec.ts'],
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 7'] },
      testMatch: 'mobile-smoke.spec.ts',
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...process.env, VERCEL: '1' },
  },
});
