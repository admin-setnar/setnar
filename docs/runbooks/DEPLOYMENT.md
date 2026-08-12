# Runbook — Deploy de Produção, DNS, SSL e Variáveis

**SET-53.** Documentação operacional, não normativa — mesmo contrato de
`BILLING_OPERATIONS.md`/`PILOT_METRICS.md`/`OBSERVABILITY.md`: descreve o
estado real validado e o que fazer, não decide arquitetura.

---

## 1. Estado validado em 2026-08-12 — contra a Vercel e o domínio reais

| Critério (SET-53) | Resultado | Como foi validado |
|---|---|---|
| Wildcard resolve representante correto | ✅ | `*.setnar.com` "Valid Configuration" na Vercel; testado ao vivo contra `pedro-policeno.setnar.com/conexao-green` (representante real, publicado) — renderizou os dados corretos |
| SSL cobre raiz/www/subdomínios | ✅ | `setnar.com`, `www.setnar.com` e o subdomínio de teste acima carregaram via HTTPS sem nenhum aviso do navegador |
| Variáveis públicas/privadas separadas e rotacionáveis | ✅ (após limpeza) | Ver §2 — integração nativa Vercel↔Supabase removida, ambiente de env vars restrito às 8 variáveis que o código realmente usa (`.env.example`) |
| Preview não contamina analytics de produção | ✅ | Preview não tem nenhuma credencial do Supabase configurada (decisão confirmada por Pedro) — não há como uma Preview deployment escrever em `leads`/`analytics_events`/etc., em nenhum projeto |
| Migrations aplicadas por processo controlado | ⚠️ Documentado, não seguido à risca hoje | `supabase/README.md` §1/§363: fluxo oficial é `supabase migration list --linked` → `supabase db push --linked`, nunca SQL parcial pelo Dashboard. Ver §4 — desvio real registrado |
| Rollback e smoke pós-deploy ensaiados | ✅ | Ensaio real e completo em produção, ver §3 |

## 2. Limpeza de variáveis de ambiente

**Achado:** o projeto Vercel tinha a integração nativa "Supabase" (marketplace)
conectada, injetando um segundo conjunto paralelo de credenciais que o código
da aplicação nunca lê (`POSTGRES_URL`, `POSTGRES_PASSWORD`,
`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_USER`,
`POSTGRES_HOST`, `POSTGRES_DATABASE`, `SUPABASE_SECRET_KEY`,
`SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`)
— puro ruído/superfície extra, não um vetor ativo, já que nada no código lê
essas chaves (`.env.example` é o contrato real).

**Ação (aprovada por Pedro):** integração removida via
**Vercel → Settings → Integrations → Supabase → Settings → Remove Supabase**.
Todas as variáveis acima desapareceram junto.

**Incidente real durante a limpeza, corrigido no mesmo momento:**
`SUPABASE_SERVICE_ROLE_KEY` — a chave que os adaptadores de Analytics/Leads
realmente usam — **também estava marcada como pertencente a essa
integração** e foi removida junto, sem aviso. Produção ficou momentaneamente
sem conseguir gravar `record_page_visit`/`record_whatsapp_click`/`submit_lead`
(nenhuma indisponibilidade da página em si — essas escritas são best-effort
e falham silenciosamente, ver `OBSERVABILITY.md` §2 — mas nada era
persistido). Corrigido recriando a variável manualmente (Production apenas,
Sensitive), seguido de **redeploy obrigatório** (variável de ambiente na
Vercel só se aplica a deployments novos — o deployment já rodando continua
com o snapshot de env vars do momento em que foi construído). Verificado
depois do redeploy: nova visita registrada em `analytics_events` para
`pedro-policeno` com timestamp posterior ao redeploy.

**Lição para a próxima vez que mexer em Integrations:** antes de remover
qualquer integração do marketplace, checar em
**Environment Variables → filtrar por "Production" → ícone de raio verde**
quais variáveis são gerenciadas por ela — pode incluir uma variável que o
código depende de verdade, coincidentemente com o mesmo nome/propósito de
uma configurada manualmente.

**Atualizado em 2026-08-12 — credenciais reais do Asaas configuradas em
Production.** As três variáveis (`ASAAS_API_KEY`, `ASAAS_BASE_URL`,
`ASAAS_WEBHOOK_TOKEN`) foram trocadas pelas credenciais da conta Asaas real
(não mais sandbox), seguidas do redeploy obrigatório (env var só vale para
deployments novos — mesma lição do incidente do §2 acima). Confirmado
diretamente no painel do Asaas real (`www.asaas.com`, conta separada da
sandbox): existe um webhook "Plano Fundador" `Ativado`, apontando para
`https://setnar.com/api/billing/asaas-webhook` (URL correta), **0 eventos
penalizados**. Preview continua em sandbox indefinidamente (Pedro confirmou
que compartilhar sandbox entre os dois ambientes não é um problema) — só
Production usa a conta real agora.

**Teste definitivo confirmado por Pedro, 2026-08-12:** primeiro evento real
de pagamento entregue ao webhook em produção respondeu `200`. Token,
URL e credenciais da conta Asaas real batendo de ponta a ponta — item de
pré-lançamento fechado.

**Achado à parte, na conta sandbox (não afeta produção real):** a conta
Asaas Sandbox tinha seu próprio webhook, também nomeado "Plano fundador -
teste", também apontando para `https://setnar.com/api/billing/asaas-webhook`
— penalizado com `401` (token configurado na Vercel não batia mais com o
token daquele webhook sandbox). Sem impacto em cliente real: o evento
penalizado específico não correspondia a nenhuma `subscription`/`lead` do
banco de produção (checado por SQL), indicando um teste feito direto no
painel do Asaas, não pelo fluxo real do produto. Webhook sandbox
regenerado; como Production agora usa a conta Asaas real, esse webhook
sandbox deixou de ser relevante para o tráfego real do site.

## 3. Ensaio de rollback e smoke pós-deploy — real, em produção

Executado em 2026-08-12, na sequência do redeploy do §2:

1. **Instant Rollback** (Vercel → Overview → Production Deployment →
   Instant Rollback) do deployment corrigido de volta para o anterior
   (`6efb462`, commit idêntico, build anterior à remoção da integração).
2. **Smoke pós-rollback:** `https://setnar.com` visitado ao vivo — carregou
   normalmente, sem erro.
3. **Reversão do ensaio:** `Promote` no deployment corrigido (mensagem da
   própria Vercel: *"This action will undo the current Instant Rollback"*) —
   confirmado que `setnar.com` voltou a apontar pro deployment certo
   (badge "Current" na env Production).
4. **Smoke final:** `https://setnar.com` visitado de novo — ok.

**Nota sobre o plano Hobby:** `Instant Rollback` só oferece o deployment de
Production *imediatamente anterior* — voltar mais do que um passo exige
Pro (`Upgrade to Pro to roll back to an earlier deployment`, mensagem nativa
da Vercel). Aceito por ora, mesma lógica de custo-por-estágio já registrada
em `OBSERVABILITY.md` §6.

## 4. Migrations — desvio do processo documentado, achado nesta sessão

O processo oficial (`supabase/README.md` §1/§363) é
`supabase migration list --linked` → `supabase db push --linked` — nunca
aplicar SQL parcialmente pelo Dashboard. Ao longo de sessões recentes,
migrations foram aplicadas via `mcp__supabase__apply_migration` (ferramenta
MCP do Supabase, não a CLI real) — isso já causou uma inconsistência real no
ledger (`supabase_migrations.schema_migrations` com uma entrada duplicada,
uma delas sem arquivo local correspondente), corrigida manualmente quando
descoberta.

**Recomendação registrada aqui (não decisão, só flag para a próxima
sessão):** preferir `supabase db push --linked` (CLI real) para aplicar
migrations neste projeto daqui pra frente, reservando a ferramenta MCP para
leitura/consulta — mantém o ledger local (`supabase/migrations/`) e o
remoto sempre em sincronia por construção, em vez de depender de conferência
manual depois.

## 5. Domínios e SSL — referência rápida

| Domínio | Ambiente | Status na Vercel |
|---|---|---|
| `setnar.com` | Production | Valid Configuration |
| `*.setnar.com` | Production | Valid Configuration |
| `www.setnar.com` | Coberto pelo wildcard | Testado ao vivo, HTTPS ok |
| `setnar-kappa.vercel.app` | Production (fallback) | Valid Configuration |

Nenhuma ação necessária aqui — tudo já estava correto antes desta sessão.
