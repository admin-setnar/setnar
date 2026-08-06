### ADR-065 — Fronteira confiável de Analytics e regra única de acesso público

**Status:** Accepted  
**Date:** 2026-08-06  
**Related:** Corrects ADR-051/ADR-053; consolidates ADR-063/ADR-064

#### Contexto e problema

`record_page_visit` e `record_whatsapp_click` eram `SECURITY DEFINER` com
`EXECUTE` para `anon` e `authenticated`. Qualquer cliente podia escolher
`ip_hash`, chamar a persistência diretamente e poluir ou esgotar contadores.
A policy do dono também entregava essa coluna. Além disso, publicação,
resolução pública e Analytics não compartilhavam todas as precondições.

#### Alternativas consideradas

1. Manter RPC pública e assinar payloads: ainda exigiria segredo backend e
   ampliaria o protocolo.
2. Aceitar INSERT por RLS: não resolveria atribuição, hash server-side nem
   rate limit autocontido.
3. Restringir RPCs a um cliente server-only específico e centralizar a
   elegibilidade pública no banco. Escolhida.

#### Decisão

`page_publication_blocker(rep, product)` representa, em ordem tipada, ativação
exata, mesma Company, representante ativo, Subscription ativa, nome válido e
telefone E.164. `is_page_publicly_accessible` compõe esse resultado com
`status = published`. Policies públicas, `set_activation_status` e as duas
RPCs de Analytics consomem esse conceito.

Os três helpers vivem no schema `private`, fora dos schemas expostos pelo
PostgREST. `anon` e `authenticated` recebem somente `USAGE` e os EXECUTEs
booleanos necessários às policies; eles não aparecem como RPCs públicas nem
formam um oráculo de estado por UUID.

As RPCs perdem `EXECUTE` de `public`, `anon` e `authenticated` e recebem grant
somente para `service_role`. Um cliente server-only mínimo e exclusivo do
adaptador Analytics usa essa credencial. O navegador envia somente
`productSlug` e `referrer`; identidade, IP, User-Agent, hash e elegibilidade
são resolvidos no backend/banco.

O `SELECT` amplo de `analytics_events` vira grant de colunas seguras;
`ip_hash` não integra o modelo de leitura. Uma FK composta garante o par em
`product_activations`; `(representative_id, created_at desc)` cobre períodos.

Operacionalmente, `visit` continua significando um carregamento público que
foi aceito pela resolução backend e pelo filtro de bot; `whatsapp_click`
continua significando apenas um clique no CTA aceito pelo endpoint. Não prova
mensagem enviada, lead, venda ou conversão financeira. Ambos são best-effort:
bloqueadores, fechamento da aba e falhas de rede podem produzir subcontagem.

Sem IP fornecido pela borda confiável da Vercel, o evento não é persistido.
Não existe hash global de `unknown`. A aplicação registra no máximo uma
advertência técnica por processo, sem IP, hash, slug ou dado do visitante.
Fora da Vercel, headers encaminhados falham fechados até existir contrato com
outro proxy confiável.

#### Consequências

- tráfego não confiável não persiste eventos nem escolhe hashes;
- página pública e evento deixam de divergir;
- legados incompletos ficam indisponíveis sem reescrever estado ou histórico;
- pares cruzados são impedidos e diagnosticados antes da constraint;
- o deploy exige `SUPABASE_SERVICE_ROLE_KEY` apenas no ambiente server-side;
- inconsistência legada de par faz a migration abortar para investigação, sem
  correção automática.

#### Retenção deliberadamente pendente

Nenhum prazo defensável foi produzido por evidência jurídica, operacional ou
de produto. Hoje `ip_hash` é `text not null`; é consultado pelos limites de 60
segundos (visita) e 1 hora (clique) e também permitiria deduplicação futura de
visitantes. Não foi encontrada infraestrutura de scheduler/cron no projeto.
Torná-lo nulo após 1 hora preservaria os rate limits atuais, mas eliminaria a
possibilidade de métricas históricas de visitantes únicos e exigiria migration
de nulabilidade mais job confiável. Portanto AN7 continua pendente: não há
cron, deleção, anonimização tardia ou janela arbitrária. A decisão futura deve
cobrir finalidade do histórico, necessidade do hash após o rate limit,
exportação e prazo legal.

#### Rollback conceitual

Como o projeto usa migrations forward-only, uma reversão seria outra migration:
remover a FK/índice, restaurar as policies e definições anteriores e voltar o
factory ao cliente publicável. Reabrir `EXECUTE` para `anon`/`authenticated`
restauraria a vulnerabilidade original e só é aceitável como contenção
temporária explícita; dados não precisam ser reescritos em nenhum sentido.
