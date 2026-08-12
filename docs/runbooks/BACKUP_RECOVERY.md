# Runbook — Backup, Recuperação e Rollback do MVP

**SET-55.** Documentação operacional, não normativa — mesmo contrato de
`DEPLOYMENT.md`/`OBSERVABILITY.md`/`BILLING_OPERATIONS.md`: descreve o
estado real validado e o que fazer, não decide arquitetura.

---

## 1. Estado encontrado em 2026-08-12 — sem backup nenhum hoje

O projeto Supabase conectado a este repositório (`setnar-db-test`,
`smspbjmqhpjcjilzoexr`) está no **plano Free**. Verificado ao vivo nas três
telas de **Database → Backups** do Dashboard:

| Mecanismo | Estado no Free | Custo para habilitar |
|---|---|---|
| Scheduled backups (diário) | "Free Plan does not include project backups." | Plano Pro |
| Point in Time Recovery | "Point in Time Recovery is a Pro Plan add-on" | Pro + US$100/mês |
| Restore to new project | "requires Pro Plan and above" | Plano Pro |

Isto é mais grave do que a hipótese registrada na issue ("backup existente
mas irrestaurável") — **não existe nenhum backup gerenciado hoje**, de
nenhum tipo, neste projeto.

**Atualizado em 2026-08-12 — banco de produção criado, backup e restore
ensaiados de verdade.** `setnar-db` (`xiysyzauoifbcoviqblf`) é o projeto
Supabase de produção real, separado de `setnar-db-test`. Também no **plano
Free** — mesma ausência de backup gerenciado do §1 acima, verificado na
mesma tela. Migrations aplicadas até `20260907000001`, em dia com `develop`.

## 2. Decisão (Pedro, 2026-08-12) e desvio real de método

**Backup manual**, não o mecanismo gerenciado do Supabase — mesma lógica de
"não pagar por infraestrutura antes de o produto provar que vale a pena" já
registrada em `OBSERVABILITY.md` §6 e `DEPLOYMENT.md` §2 para o Asaas
sandbox.

**`pg_dump`/`supabase db dump` não funcionaram nesta máquina**, achado
tentando executar de verdade: `supabase db dump` roda o `pg_dump` real
dentro de um container Docker — e o Docker Desktop não estava rodando, com
só ~1,3 GB de RAM livre numa máquina de 8 GB (mesma restrição já registrada
como conhecida para este ambiente de desenvolvimento). Subir o Docker
Desktop nessas condições arriscava travar a máquina — decisão explícita de
não tentar. Não há `pg_dump.exe` standalone instalado à parte.

**Solução adotada, real e testada:** backup dos dados via
`@supabase/supabase-js` (já uma dependência do projeto, sem instalar nada
novo) — um script lê cada tabela `public.*` com `service_role` e grava o
conteúdo em JSON local, tabela por tabela. **Cobre dado, não schema/DDL** —
o schema já vive inteiramente versionado em `supabase/migrations/`
(reaplicável em qualquer projeto novo via `supabase db push --linked`), que
é o ativo realmente exposto a perda irreversível num incidente. Backup
`pg_dump` completo (schema+dados via Docker) fica registrado como melhoria
futura, não bloqueante — revisitar quando houver uma máquina com mais RAM
livre ou um runner de CI dedicado para isso.

## 3. Procedimento de backup — testado ao vivo, 2026-08-12

Script lê a lista de tabelas de negócio (`companies`, `products`,
`profiles`, `representatives`, `product_activations`, `subscriptions`,
`leads`, `analytics_events`, `feedback_responses`, `billing_events`,
`billing_reconciliation_log`, `lgpd_request_log`, `login_attempts`,
`lead_submission_attempts`) via `service_role`, grava cada uma como um
`.json` local. Roda com as credenciais de **Production** (`.env.production.local`,
nunca commitado — `.gitignore` cobre `.env*`).

**Executado contra `setnar-db` real, 2026-08-12T20:27:34Z →
2026-08-12T20:27:36Z: 2 segundos.** Banco de produção ainda no início do
piloto (1 empresa, 7 produtos do catálogo, 1 representante, 1 assinatura,
1 tentativa de login) — o tempo cresce com o volume real conforme o piloto
avança; esta é a medição real de hoje, não uma garantia permanente.

**Responsável:** Pedro, mesmo padrão de responsabilidade única de
`OBSERVABILITY.md` §5 e `BILLING_OPERATIONS.md` §7.

**Cadência:** um dump antes de qualquer migration ou deploy de risco (mesmo
gatilho do rollback de deploy em `DEPLOYMENT.md` §3), mais uma cadência
periódica fixa durante o piloto (ex.: semanal) enquanto não há automação —
nenhum `pg_cron`/GitHub Action agenda isso hoje, é uma ação manual,
registrada aqui como tal em vez de fingir que é automática (mesma postura
de `OBSERVABILITY.md` §5).

### Restauração — ensaiada ao vivo, em ambiente isolado de verdade

**Alvo:** `setnar-db-test` — um projeto Supabase genuinamente separado do
de origem (`setnar-db`), não uma simulação. Cada linha dumpada foi inserida
numa tabela-rascunho isolada (`_set55_restore_drill`, criada só para o
ensaio, sem relação com o schema real — evita qualquer colisão com o dado
de teste já existente nesse projeto), depois apagada ao final.

**Executado 2026-08-12T20:28:10Z → 2026-08-12T20:28:12Z: 2 segundos.**
Contagem restaurada bateu exatamente com a contagem dumpada em toda tabela
com dado (companies:1, products:7, profiles:1, representatives:1,
subscriptions:1, login_attempts:1). **Fidelidade de conteúdo confirmada**,
não só contagem — verificado por SQL direto que `companies.slug='igreen'`,
`representatives.slug='pedro-policeno'`/`status='active'`,
`subscriptions.status='trialing'` vieram corretos, incluindo a própria
linha real do Pedro como representante. Tabela-rascunho removida depois.

## 4. RPO/RTO — aprovado por Pedro com números reais, 2026-08-12

| Métrica | Valor | Base |
|---|---|---|
| **RPO** (perda de dado aceitável) | Até a cadência do dump manual (§3) — pior caso, o intervalo entre dois dumps agendados | Backup é manual, não contínuo (sem PITR no plano Free) |
| **RTO** (tempo até religar) | ~2 segundos medidos hoje, para o volume atual do piloto | Ensaio real §3 — cresce com o volume; revisitar a medição periodicamente conforme o piloto avança, não tratar como teto fixo |

**Achado operacional real, à parte:** durante este ensaio, uma tentativa
inicial de montar a connection string do Postgres via `source` num script
bash expôs um fragmento da senha do banco no output de um comando (a senha
tinha um caractere que quebrou o parser do bash). Pedro optou por não
resetar a senha na hora (avaliou o fragmento exposto como não sendo risco
real) — mas o método foi corrigido: nunca mais usar `source`/`.` num
arquivo de env com segredo em bash; usar `node --env-file-if-exists=...`
(o parser de dotenv do próprio Node, que este projeto já usa em todo
script) para carregar e consumir o valor sem expô-lo em nenhum output.

## 5. Segredos e configuração — recuperáveis com segurança

Diferente do dado do banco, a configuração/segredos deste projeto **não
dependem de um backup dedicado** — cada valor tem uma fonte de verdade
recuperável pelo próprio painel do serviço dono, sem que ninguém precise
guardar uma cópia paralela:

| Segredo/config | Fonte de verdade recuperável |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, chave publicável | Supabase → Project Settings → API |
| `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` | Painel do Asaas (Sandbox e Production têm telas próprias de chave/token) |
| `LOGIN_ATTEMPT_SALT`, `ANALYTICS_IP_SALT` | **Não recuperáveis se perdidos** — são segredos gerados localmente (não vêm de um painel externo). Se perdidos sem cópia, o efeito é apenas invalidar hashes existentes (rate-limit/IP hashing recomeçam do zero) — não é um dado de negócio, não bloqueia o produto. Aceito como está; não requer backup dedicado. |
| Lista completa das variáveis exigidas | `.env.example` (rastreado no repositório) |

**Precedente real desta mesma sessão:** o incidente da SET-53 (remoção
acidental de `SUPABASE_SERVICE_ROLE_KEY` ao limpar a integração Vercel↔
Supabase, `DEPLOYMENT.md` §2) foi corrigido exatamente assim — o valor foi
recuperado do painel do Supabase, colado manualmente por Pedro (nunca pelo
assistente, por política), e a aplicação voltou ao normal após um redeploy.
Não foi necessário nenhum backup de segredos para isso.

## 6. Rollback de deploy/configuração

Já ensaiado de verdade em produção — ver `DEPLOYMENT.md` §3 (Instant
Rollback → smoke → Promote/undo → smoke final). Não repetido aqui.

## 7. Rollback forward-only de migration — ensaiado de verdade nesta sessão

Rodado ao vivo contra o projeto Supabase real conectado
(`setnar-db-test`), via a CLI oficial (`supabase db push --linked`, não a
ferramenta MCP — seguindo a recomendação registrada em `DEPLOYMENT.md` §4),
em 2026-08-12:

1. **Migration "com bug" aplicada:**
   `20260906000000_set55_rollback_drill_add_scratch_marker.sql` — cria uma
   tabela isolada e sem uso nenhum no código de aplicação
   (`_set55_rollback_drill_marker`), só para o drill.
2. **Correção aplicada como nova migration forward** (nunca editando ou
   fazendo `DROP` fora de uma migration na já aplicada):
   `20260906000001_set55_rollback_drill_revert_scratch_marker.sql` — remove
   a tabela.
3. **Verificado por SQL direto** (`information_schema.tables`) que a tabela
   não existe mais depois da segunda migration.
4. **Tempo do ciclo completo** (aplicar a migration "com bug" → escrever e
   aplicar a correção → confirmar o resultado): **22 segundos**
   (`2026-08-12T17:44:27Z` → `2026-08-12T17:44:49Z`) — migrations neste
   projeto são DDL direto, sem dado de produção migrado junto, então o
   tempo real de um incidente de migration depende do tamanho da correção
   em si, não do mecanismo.
5. **Ledger consistente**: `supabase migration list --linked` mostrou as
   duas novas entradas com `local`/`remote` batendo, sem a inconsistência
   manual que aconteceu no início desta sessão (`DEPLOYMENT.md` §4) — a CLI
   real não teve esse problema.

Este drill prova o **mecanismo** (escrever e aplicar uma migration
corretiva funciona, é rápido, e o ledger fica consistente). Não prova
recuperação de **dado perdido** por um `DROP`/`DELETE` real em produção —
isso depende do backup (§2/§3), ainda pendente do banco de produção.

## 8. Status consolidado dos critérios de aceite (SET-55)

| Critério | Status |
|---|---|
| Política de backup e responsável documentados | ✅ §2/§3 |
| RPO/RTO do piloto aprovados | ✅ §4, com números reais medidos |
| Restauração em ambiente isolado executada e medida | ✅ §3, ao vivo, contra `setnar-db-test`, fidelidade de conteúdo verificada |
| Rollback forward-only de migration crítica ensaiado | ✅ §7, ao vivo, medido |
| Segredos/configuração recuperáveis com segurança | ✅ §5 |

**Todos os cinco critérios da SET-55 satisfeitos, 2026-08-12.**
