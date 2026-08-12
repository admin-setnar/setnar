# Runbook — Direitos LGPD do Titular

**SET-48.** Documentação operacional, não normativa — mesmo contrato de
`BACKUP_RECOVERY.md`/`DEPLOYMENT.md`/`OBSERVABILITY.md`/`BILLING_OPERATIONS.md`:
descreve o processo real e o que executar, não decide arquitetura nem
substitui revisão jurídica formal (SET-74, mesma pendência já registrada
para `/termos`/`/privacidade`, SET-45).

Cobre os dois tipos de titular deste produto: **Representative** (tem
conta, é quem se cadastra) e **Lead** (terceiro sem conta, captado pelo
formulário de contato de uma Commercial Page). `/privacidade` §5 já promete
cinco direitos, todos por e-mail — este documento é como atendê-los de
verdade, sem portal self-service (fora de escopo, mesma decisão da issue).

---

## 1. Canal

E-mail (`legal.contactEmail`, já publicado em `/privacidade` §1/§5) — único
canal hoje, nenhum formulário dedicado.

## 2. Verificação de identidade — antes de expor ou alterar qualquer dado

Proporcional ao estágio (piloto, sem portal, sem verificação forte
disponível) e ao dado em jogo:

| Titular | Verificação |
|---|---|
| **Representative** | A solicitação deve vir do e-mail cadastrado na conta (`auth.users.email`) — se vier de outro endereço, pedir confirmação por resposta a partir do e-mail da conta antes de qualquer ação. Nunca expor/alterar dado a partir só do nome alegado. |
| **Lead** | Sem conta, sem senha — o único "segredo" disponível é a combinação dos dados que a própria pessoa forneceu no formulário (nome+telefone+e-mail já gravados em `leads.campos`/`telefone_e164`) mais o contexto (qual página/representante). Pedir que o solicitante informe telefone **e** e-mail usados no formulário; só agir se ambos baterem com a linha encontrada. Limitação conhecida e aceita nesta fase: não há como impedir alguém de citar dados de terceiros que já vazaram por outro canal — não é uma verificação forte, é a proporcional ao que este produto coleta (LGPD pede minimização, não uma prova de identidade mais forte que o próprio dado tratado). |

Toda execução registra o texto exato da verificação em
`lgpd_request_log.identity_verification` — nunca um campo vazio (o script,
§5, recusa rodar sem ele).

## 3. Papéis e autorização

Sem sistema de roles/admin neste projeto (`docs/plans/SPRINT_E_PLAN.md`
§2.4) — mesmo raciocínio já registrado para reconciliação de billing
(`BILLING_OPERATIONS.md`/SET-33) e para backup (`BACKUP_RECOVERY.md`): a
posse de `SUPABASE_SERVICE_ROLE_KEY`, nunca exposta à aplicação, é a própria
autorização. Executor único: **Pedro**.

## 4. Consultas/scripts seguros

`scripts/execute-lgpd-request.ts` (`npm run lgpd:request --`), modelado
diretamente sobre `scripts/reconcile-billing-subscription.ts` (mesma forma:
`--actor`/`--reason` obrigatórios, modo leitura por padrão, `--apply` para
escrever de verdade). Cobre os cinco direitos de `/privacidade` §5:

| `--right` | Representative | Lead |
|---|---|---|
| `acesso` / `portabilidade` | Imprime conta + representative + subscription + contagem de leads/analytics da página + feedback, em JSON estruturado (já é o formato portável) | Imprime todas as linhas de `leads` que batem com o e-mail informado |
| `correcao` | Só os campos sem self-service já existente no `/app` (`phone`/`city`/`display_name`) | Qualquer campo de `campos`/`telefone_e164` |
| `eliminacao` | Ver §6 — nunca um DELETE da linha | `DELETE` direto (sem filhos, sem exceção de retenção — ver §6) |
| `informacao` | Só registra a resposta; aponta para `/privacidade` §1/§3 | Idem |

## 5. Registro mínimo

`lgpd_request_log` (migration `20260907000000`, corrigida por
`20260907000001` — ver §8): mesma forma de `billing_reconciliation_log`
(SET-33) — `actor`, `reason`, `right_exercised`, `subject_type`,
referência ao sujeito, `identity_verification`, `retention_exception`,
`outcome`, `detail` (só campo estruturado, nunca o dado pessoal em si).
RLS habilitada, zero policies — só `service_role` alcança, mesma postura de
`billing_events`/`billing_reconciliation_log`.

## 6. Exceções de retenção — respeitadas por desenho, não por checagem manual

| Dado | Exceção aplicada em `eliminacao`? | Razão |
|---|---|---|
| `subscriptions`, `billing_events` de um Representative | **Sim — nunca apagados** | Questão fiscal/contábil ainda não decidida (`DATA_RETENTION_DECISIONS_PLAN.md` §3) — apagar antes dessa decisão poderia destruir um registro exigido por obrigação legal (LGPD Art. 16, I permite retenção para "cumprimento de obrigação legal ou regulatória") |
| `leads`/`analytics_events` **da página** de um Representative eliminado | **Sim — nunca apagados por essa via** | Já é uma decisão de produto aprovada e independente do status da conta (`DATA_RETENTION_DECISIONS_PLAN.md` §2, `DOMAIN_MODEL.md` §8.1/§8.2: desativar/eliminar o Representative não apaga o histórico de Leads/Analytics — janela própria de 24/12 meses continua valendo) |
| `feedback_responses` de um Representative eliminado | Não — apagado junto | Dado pessoal dele mesmo (texto livre), sem base de retenção própria — seguia o ciclo da conta por decisão já aprovada |
| A linha de `leads` do **próprio Lead** que pediu eliminação | Não — apagada de imediato | A janela de 24 meses é um teto, não um piso; um pedido do próprio titular é honrado na hora, `leads` não tem filhos, delete é seguro |

## 7. "Eliminação" de um Representative não é um DELETE — achado real, verificado ao vivo

Confirmado contra o banco real (`information_schema`/`pg_constraint`),
não hipótese: as seis FKs que apontam para `representatives`
(`analytics_events`, `billing_reconciliation_log`, `feedback_responses`,
`leads`, `product_activations`, `subscriptions`) são todas `NO ACTION` —
igual `representatives.profile_id → profiles.id`. Ou seja, **hoje é
fisicamente impossível apagar a linha de um Representative** que já
recebeu qualquer lead, clique, assinatura ou feedback (ou seja, qualquer
Representative real do piloto) — a operação falharia com violação de FK,
mesmo via `service_role`.

Mesmo que fosse possível, seria incorreto: apagaria dado retido por
política própria (§6). A operação real que `eliminacao` executa sobre um
Representative é: `status = 'suspended'` (já usado hoje para tirar a página
pública de circulação — `representative-repository.ts`), mais redação dos
campos de identificação pessoal (`display_name`, `phone`, `city`,
`avatar_url` em `representatives`; `full_name`, `phone` em `profiles`).

## 8. Achados reais de execução — dois bugs corrigidos ao vivo, não hipotéticos

Só apareceram rodando o ensaio (§10) contra dado sintético de verdade — a
razão de a SET-48 exigir um ensaio, não só um documento:

1. **`representatives.phone` não pode ser nulado.** Um trigger
   (`20260818000000_require_professional_profile_phone.sql`) rejeita
   qualquer escrita que zere o campo — inclusive via `service_role`
   (triggers não são ignorados por `BYPASSRLS`, só policies são). A
   primeira tentativa de `eliminacao` falhou com
   `representatives.phone is required for new phone writes`. Corrigido no
   próprio script: em vez de `null`, grava um sentinel sintaticamente
   válido e claramente falso (`+10000000000`, `REDACTED_PHONE_SENTINEL`).
2. **A trilha de auditoria podia bloquear a própria eliminação que
   audita.** `lgpd_request_log.lead_id`/`representative_id` nasceram sem
   `on delete`, ou seja `NO ACTION` — depois de logar um `acesso` sobre um
   Lead, o `DELETE` desse mesmo Lead falhava com violação de FK contra o
   próprio log. Corrigido com uma migration forward
   (`20260907000001_fix_lgpd_request_log_fk_on_delete.sql`, `on delete set
   null` nas duas FKs) — e mesmo com o `on delete set null`, o script
   original ainda tentava inserir uma nova linha de log **referenciando o
   id que acabou de apagar**, o que também falha (a FK relaxada só protege
   linhas já existentes quando o alvo é apagado depois, não uma inserção
   nova apontando para um alvo já ausente). Corrigido de novo no script:
   para `eliminacao` de Lead, `lead_id` fica `null` no log e os ids
   apagados vão em `detail` (campo sem FK).

## 9. Prazos — proposta, pendente da mesma revisão jurídica formal da SET-45

A LGPD (Art. 18 §5) exige resposta imediata ou em prazo razoável, sem fixar
um número de dias fechado — regulamentação complementar da ANPD trata de
formas simplificadas de atendimento. Sem revisão jurídica formal ainda
feita (mesmo estado que `/termos`/`/privacidade`, SET-45/SET-74), a
proposta operacional para o piloto é:

- **Confirmação de recebimento:** em até 2 dias úteis.
- **Resposta/execução completa:** em até 15 dias úteis, mesma referência de
  mercado usada por controladores de porte comparável — **não é uma
  garantia jurídica validada**, só o prazo operacional que este runbook
  assume até uma revisão formal dizer o contrário.

## 10. Resposta ao solicitante

Depois de rodar o script (§4) com `--apply`, responder por e-mail:
confirmando o direito exercido, o resultado (dado enviado / corrigido /
eliminado ou motivo da exceção de retenção quando aplicável, citando
`/privacidade` §4), e o prazo em que foi atendido.

## 11. Ensaio executado — dado sintético, ao vivo, 2026-08-12

Contra o projeto Supabase real (`setnar-db-test`), representante e lead
100% sintéticos (`set48-drill-*@example.invalid`), criados e depois
completamente removidos ao final (representatives/profiles/leads voltaram
à contagem exata de antes: 43/36/238 linhas).

| Passo | `--right` | Sujeito | Resultado |
|---|---|---|---|
| 1 | `acesso` | Representative sintético | `completed` — JSON com conta/representative/subscription(null)/1 lead/0 analytics/feedback vazio |
| 2 | `eliminacao` | Representative sintético | `partially_completed_retention_exception` — suspenso e redigido, `feedback_responses` apagado, `subscriptions`/`leads`/`analytics_events` preservados com motivo registrado |
| 3 | `acesso` | Lead sintético | `completed` — JSON com a linha de `leads` |
| 4 | `eliminacao` | Lead sintético | `completed` — linha apagada, id registrado em `detail` |

Janela total do ensaio (criação da massa de teste → confirmação final por
SQL de que tudo foi removido): `2026-08-12T17:52:45Z` →
`2026-08-12T17:57:11Z` (≈ 4 min e meio, incluindo o tempo de achar e
corrigir os dois bugs do §8 — não só de rodar o caminho feliz).

## 12. Status consolidado dos critérios de aceite (SET-48)

| Critério | Status |
|---|---|
| Processo cobre acesso, correção, eliminação quando aplicável e informação | ✅ §4 |
| Identidade é validada antes de expor/alterar dados | ✅ §2, campo obrigatório em toda execução |
| Operações são autorizadas e auditáveis | ✅ §3/§5 |
| Exceções de retenção são respeitadas | ✅ §6/§7, por desenho no script |
| Um ensaio com dados de teste foi registrado | ✅ §11, com dois bugs reais achados e corrigidos no processo |
