### ADR-068 — `submit_lead` passa a consumir a regra canônica de acesso público

**Status:** Accepted
**Date:** 2026-08-07
**Related:** Consolidates with ADR-065; follows ADR-067

#### Contexto e problema

Desde o ADR-065, `private.is_page_publicly_accessible(rep, product)` é a
única regra que decide se uma página (Representative × Product) está
publicamente acessível: ativação exata, mesma Company, representante ativo,
Subscription ativa, nome válido e telefone E.164. `set_activation_status`, as
policies públicas de `product_activations`/`representatives` e as duas RPCs
de Analytics já consomem esse conceito.

`submit_lead` nunca foi migrado. Seu predicado de elegibilidade permanecia o
original (`product_activations.status = 'published' and representatives.status
= 'active'`), anterior à consolidação — o ADR-067 (fronteira confiável e
atomicidade de `submit_lead`) deliberadamente não antecipou essa mudança e
registrou a lacuna como escopo da SET-21. Na prática, uma página que deixasse
de ser publicamente acessível por qualquer outro motivo — Subscription
suspensa, perfil legado incompleto (nome de uma palavra, telefone inválido) —
continuava aceitando leads normalmente, mesmo com a Commercial Page
correspondente já invisível para qualquer visitante real.

#### Alternativas consideradas

1. Duplicar as checagens de Subscription/perfil diretamente em `submit_lead`.
   Rejeitada: recria exatamente o problema que o ADR-065 eliminou nas outras
   superfícies — duas fontes de verdade para "esta página está acessível?"
   que podem divergir de novo a cada mudança futura de uma precondição.
2. Criar uma terceira função combinando o predicado antigo com as novas
   checagens. Rejeitada: sem ganho sobre reusar o helper já testado e usado
   por quatro superfícies distintas.
3. Chamar `private.is_page_publicly_accessible` diretamente de dentro de
   `submit_lead`, no lugar do predicado antigo. Escolhida; é o mesmo padrão
   estrutural que `record_page_visit`/`record_whatsapp_click` já usam desde o
   ADR-065.

#### Decisão

O bloco `not exists (...)` em `submit_lead` (join manual entre
`product_activations` e `representatives`, checando apenas
`status = 'published'` e `status = 'active'`) foi substituído por
`if not private.is_page_publicly_accessible(p_representative_id,
p_product_id) then`. `submit_lead` continua `SECURITY DEFINER`, de forma que
a chamada aninhada ao helper — que só concede `EXECUTE` a `anon` e
`authenticated` — executa com os privilégios do dono da função, sem exigir
grant novo; é o mesmo mecanismo que já sustenta a chamada equivalente dentro
das duas RPCs de Analytics.

A posição do gate no corpo da função não muda: segue depois do lock
consultivo, da checagem de rate limit e da validação de payload, antes do
`insert` em `leads` — preservando exatamente a ordem e a serialização por
bucket decididas no ADR-067. Uma rejeição pela regra canônica grava uma
tentativa e retorna `false`, o mesmo formato genérico de qualquer outra
rejeição; a resposta continua sem revelar se a causa foi rate limit, payload
inválido, par inexistente, Subscription suspensa ou perfil inválido.

Nenhuma migration de schema além da própria `create or replace function` foi
necessária: `private.is_page_publicly_accessible` já existe desde o
ADR-065 e nenhuma precondição canônica foi alterada.

#### Consequências

- uma página que não deveria estar acessível publicamente também deixa de
  aceitar leads pelo mesmo motivo, sem exceção;
- `submit_lead` para de manter uma segunda definição de "página acessível" —
  qualquer precondição futura adicionada a `page_publication_blocker` passa a
  valer automaticamente para leads também, sem uma segunda migration;
- nenhuma chamada direta ao RPC (já restrito a `service_role` desde o
  ADR-067) contorna a regra;
- rate limit, salt, threshold, tabela de tentativas e a fronteira
  `service_role`-only do ADR-067 permanecem inalterados;
- nenhum dado de negócio é reescrito por esta migration.

#### Rollback conceitual

Migrations são forward-only. Uma reversão seria outra migration restaurando o
predicado `product_activations.status = 'published' and
representatives.status = 'active'` — reabrindo a lacuna que este ADR fecha, e
só aceitável como contenção temporária explícita.
