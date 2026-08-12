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

**Contexto adicional confirmado por Pedro nesta sessão:** `setnar-db-test` é
o banco de **teste/desenvolvimento** compartilhado (o mesmo usado pela
suíte de integração e E2E, SET-52) — ainda não é o banco de produção real do
piloto. O banco de produção ainda não foi criado.

## 2. Decisão (Pedro, 2026-08-12)

**Backup manual via `pg_dump`**, não o mecanismo gerenciado do Supabase —
mesma lógica de "não pagar por infraestrutura antes de o produto provar que
vale a pena" já registrada em `OBSERVABILITY.md` §6 e `DEPLOYMENT.md` §2
para o Asaas sandbox. `pg_dump` funciona contra qualquer plano (é um
recurso do Postgres, não um produto do Supabase) — a connection string já é
usada nesta sessão para aplicar migrations.

**Por ora, apenas documentado.** A execução real de um backup e o restore
drill em ambiente isolado (critério de aceite da SET-55) ficam **pendentes
até o banco de produção existir** — rodar o drill contra `setnar-db-test`
validaria o mecanismo, mas não o RPO/RTO real do piloto, que é o que a
issue pede. Assim que o banco de produção for criado, repetir este
procedimento contra ele é o próximo passo (não coberto por este documento
ainda).

## 3. Procedimento de backup — a executar quando o banco de produção existir

```bash
# Dump completo (schema + dados), formato custom (permite restore seletivo)
pg_dump "postgresql://postgres:[SENHA]@[HOST]:5432/postgres" \
  --format=custom \
  --file="setnar-backup-$(date +%Y%m%d-%H%M%S).dump"
```

A connection string (`Session pooler` ou `Direct connection`) está em
**Supabase → Project Settings → Database → Connection string** — a mesma
tela usada para configurar `supabase link`.

**Responsável:** Pedro, mesmo padrão de responsabilidade única de
`OBSERVABILITY.md` §5 e `BILLING_OPERATIONS.md` §7.

**Cadência proposta (rascunho, a confirmar com o RPO/RTO abaixo quando o
banco de produção existir):** um dump antes de qualquer migration ou deploy
de risco (mesmo gatilho do rollback de deploy em `DEPLOYMENT.md` §3), mais
uma cadência periódica fixa durante o piloto (ex.: semanal) enquanto não há
automação — nenhum `pg_cron`/GitHub Action agenda isso hoje, é uma ação
manual, registrada aqui como tal em vez de fingir que é automática (mesma
postura de `OBSERVABILITY.md` §5).

### Restauração (a ensaiar contra o banco de produção)

```bash
# Contra um projeto Supabase novo e isolado — nunca contra o projeto de origem
pg_restore "postgresql://postgres:[SENHA]@[HOST-NOVO]:5432/postgres" \
  --clean --if-exists \
  setnar-backup-XXXXXXXX-XXXXXX.dump
```

## 4. RPO/RTO — rascunho, pendente de aprovação final contra dado real

Não é possível aprovar um RTO medido sem o restore drill real (§2) — os
valores abaixo são a proposta de Pedro para o piloto, a confirmar/ajustar
depois que o drill contra o banco de produção acontecer e o tempo real for
medido:

| Métrica | Proposta | Base |
|---|---|---|
| **RPO** (perda de dado aceitável) | Até a cadência do dump manual (§3) — pior caso, o intervalo entre dois dumps agendados | Backup é manual, não contínuo (sem PITR) |
| **RTO** (tempo até religar) | A medir no drill real | Estimativa não confiável sem execução — não incluída aqui para não ser tratada como validada |

**Este critério da SET-55 ("RPO/RTO do piloto foram aprovados") fica em
aberto até essa medição real acontecer.**

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
| RPO/RTO do piloto aprovados | ⚠️ Rascunho proposto (§4), aprovação final pendente do drill real |
| Restauração em ambiente isolado executada e medida | ⏳ Pendente — banco de produção ainda não existe |
| Rollback forward-only de migration crítica ensaiado | ✅ §7, ao vivo, medido |
| Segredos/configuração recuperáveis com segurança | ✅ §5 |
