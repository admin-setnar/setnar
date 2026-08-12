### ADR-087 — Caixa mínima de Contatos é uma leitura de Leads, não um CRM (SET-77)

**Status:** Accepted
**Date:** 2026-08-12
**Related:** ADR-034/067/068 (escrita segura de Leads), ADR-066 (App Shell), ADR-082 (leitura autenticada por RLS)

#### Contexto

As Commercial Pages já persistem nome, telefone, cidade, e-mail, Product e data em
`public.leads`, mas o Representative via apenas contagens agregadas. A confirmação do
formulário promete contato posterior sem oferecer ao profissional uma forma normal de
encontrar os dados recebidos. O CRM completo permanece Stage 3 e não está validado.

#### Decisão

`/app/contatos` antecipa somente uma caixa de entrada imutável: lista os Leads próprios,
mais recentes primeiro, e oferece links iniciados pelo usuário para WhatsApp e e-mail.
Não existem status, lido/não lido, notas, busca, edição, exclusão, atribuição ou automação.
“Contatos” é linguagem da interface; domínio e módulo continuam sendo `leads`.

A leitura usa uma porta própria, `LeadInboxRepository`, separada do `LeadGateway` de
escrita pública. O adapter recebe um cliente Supabase autenticado e request-scoped; nunca
usa `service_role`. A rota resolve o Representative pela sessão e passa seu ID como filtro
explícito, mas `leads_select_own` continua sendo a fronteira de isolamento no Postgres.
Erros registram somente `{ code, message }`, conforme ADR-084, sem linhas ou PII.

A projeção seleciona apenas `id`, `telefone_e164`, `campos`, `created_at` e o nome do
Product. `campos` é transformado imediatamente em um modelo de leitura tipado; a UI nunca
recebe ou exibe JSON bruto.

#### Paginação

A ordem é `(created_at desc, id desc)`. O cursor opaco carrega os dois campos e a página
seguinte aplica:

```sql
created_at < cursor.created_at
or (created_at = cursor.created_at and id < cursor.id)
```

Assim empates de data não duplicam nem pulam linhas. Cursor inválido volta de forma segura
à primeira página; ele nunca contém `representative_id`, e manipulá-lo não amplia o que a
RLS permite ler. O lote inicial é limitado a 20 contatos.

#### Índice e migration

Antes da implementação, `EXPLAIN` da consulta real no projeto de teste — então com cerca
de 493 linhas em `leads` — escolheu `Seq Scan` + `Sort` e custo total aproximado de 54,9.
O índice existente em `representative_id` também não foi escolhido pelo planner nesse
volume/distribuição. Portanto SET-77 não cria migration nem índice composto agora: fazê-lo
seria antecipar custo de escrita/armazenamento sem ganho observado. O gatilho para
`(representative_id, created_at desc, id desc)` é latência ou volume real que faça um novo
`EXPLAIN (ANALYZE, BUFFERS)` demonstrar benefício.

#### Consequências

- o profissional consegue agir sobre o interesse já capturado sem contratar notificação externa;
- o contrato `submit_lead`, seu rate limit e sua fronteira privilegiada não mudam;
- a superfície continua somente leitura e não valida a hipótese de CRM da Stage 3;
- página pública, inbox e dados seguem o prazo de retenção de 24 meses do ADR-086;
- reversão é puramente de aplicação/documentação, pois nenhuma migration foi criada.
