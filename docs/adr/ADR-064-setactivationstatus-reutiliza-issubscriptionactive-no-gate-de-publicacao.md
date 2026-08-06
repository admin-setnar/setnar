# ADR-064 â€” `set_activation_status` reutiliza `is_subscription_active` no gate de publicaÃ§Ã£o (Passo E2)

**Status:** Accepted
**Date:** 2026-08-05
**Related:** ADR-043, ADR-048, ADR-063

## Contexto e problema corrigido

O ADR-063 implementou o lado de leitura da Regra 21: uma linha
`product_activations.status = 'published'` sÃ³ Ã© exposta publicamente quando
`is_subscription_active(representative_id)` retorna `true`. O caminho de
escrita permaneceu no estado conscientemente registrado pelo ADR-043:
`set_activation_status` ainda permitia `draft/unpublished -> published` sem
consultar a Subscription.

Isso produzia dois conceitos incompatÃ­veis de publicaÃ§Ã£o. O RPC podia confirmar
`updated` e persistir `published`, enquanto a policy pÃºblica ocultava a mesma
linha. Para o representante, a aÃ§Ã£o parecia concluÃ­da; para o visitante, a
Commercial Page nÃ£o existia. O problema nÃ£o Ã© uma funcionalidade nova, mas uma
divergÃªncia entre o estado aceito na escrita e o estado efetivamente servÃ­vel.

## DecisÃ£o

`supabase/migrations/20260816000000_add_subscription_publication_gate.sql`
redefine, por `create or replace function`, somente
`public.set_activation_status(uuid, text)`. Nas transiÃ§Ãµes para `published`, a
funÃ§Ã£o passa a retornar `subscription_not_active` quando
`public.is_subscription_active(v_representative_id)` for falsa.

NÃ£o Ã© criada outra funÃ§Ã£o, nÃ£o hÃ¡ consulta direta a `subscriptions` e nenhuma
regra Ã© duplicada. E1 e E2 dependem da mesma definiÃ§Ã£o executÃ¡vel de
Subscription ativa.

A ordem de primeira falha fica normativa e explÃ­cita:

1. `representative_not_active`;
2. `subscription_not_active`;
3. `display_name_required`;
4. `phone_required`.

O status do Representative vem primeiro porque um bloqueio de autorizaÃ§Ã£o da
pessoa prevalece sobre qualquer outro reparo. Subscription vem em seguida por
ser o segundo bloqueio administrativo: nÃ£o Ã© Ãºtil mandar alguÃ©m corrigir nome
ou telefone quando a assinatura, por si sÃ³, ainda impede a publicaÃ§Ã£o. As
precondiÃ§Ãµes de perfil permanecem por Ãºltimo e conservam sua ordem anterior.
Somente a primeira falha Ã© devolvida, mantendo a orientaÃ§Ã£o da interface
determinÃ­stica e acionÃ¡vel.

`activate_product` nÃ£o muda. Criar uma ativaÃ§Ã£o em `draft` continua permitido
sem Subscription ativa. O gate tambÃ©m nÃ£o Ã© executado em
`published -> unpublished` nem em chamadas idempotentes de mesmo estado; ele
protege exclusivamente `draft/unpublished -> published`.

O contrato TypeScript incorpora `subscription_not_active` em
`SetActivationStatusRejectionReason`, o mapeador reconhece o novo retorno e a
mensagem especÃ­fica orienta o representante a ativar ou regularizar a
assinatura SETNAR. A mensagem nÃ£o usa texto genÃ©rico nem aponta para o WhatsApp
comercial do prÃ³prio representante.

Para cumprir a consequÃªncia visÃ­vel da mesma regra, o hub autenticado consulta
`is_subscription_active(representative.id)` pelo
`RepresentativeCatalogRepository`. O resultado nÃ£o redefine Subscription: ele
apenas apresenta a decisÃ£o canÃ´nica jÃ¡ usada pelo banco. Sem assinatura, o
botÃ£o de publicaÃ§Ã£o fica desabilitado; uma linha armazenada como `published`
recebe o estado â€œIndisponÃ­vel â€” assinatura inativaâ€; link pÃºblico e QR Code nÃ£o
sÃ£o exibidos. Falhas nessa leitura fecham com `false`, evitando falso positivo
de disponibilidade.

## Alternativas consideradas

- Consultar `subscriptions` diretamente dentro de `set_activation_status`.
  Rejeitada porque duplicaria a definiÃ§Ã£o que o ADR-063 jÃ¡ centralizou em
  `is_subscription_active` e permitiria que leitura e escrita voltassem a
  divergir.
- Fazer a checagem somente na aplicaÃ§Ã£o. Rejeitada porque qualquer chamador
  direto do RPC continuaria capaz de persistir `published`; a precondiÃ§Ã£o Ã© de
  domÃ­nio e pertence ao caminho transacional no banco.
- Alterar `activate_product`. Rejeitada porque `draft` Ã© deliberadamente o
  estado privado disponÃ­vel antes da assinatura; exigir pagamento nessa etapa
  mudaria o comportamento aprovado do Sprint E.

## Impacto arquitetural e compatibilidade

Este ADR completa, sem substituir, o ADR-063. O ADR-063 continua sendo a
decisÃ£o sobre visibilidade pÃºblica e a funÃ§Ã£o canÃ´nica de Subscription; este
ADR reutiliza a funÃ§Ã£o no ponto de escrita. A policy
`product_activations_select_published` nÃ£o Ã© alterada, portanto nÃ£o hÃ¡ mudanÃ§a
no desenho de RLS nem reabertura do ciclo tratado pelo ADR-039.

TambÃ©m resolve especificamente o desvio de Subscription registrado pelo
ADR-043. O outro desvio daquele ADR â€” foto nÃ£o exigida â€” permanece inalterado.
As revogaÃ§Ãµes explÃ­citas de EXECUTE para `public` e `anon`, seguidas do grant a
`authenticated`, preservam o contrato de seguranÃ§a corrigido pelo ADR-048.
Na apresentaÃ§Ã£o, nenhuma regra paralela Ã© calculada: o RPC canÃ´nico fornece o
mesmo booleano que governa policy e gate de escrita.

## ConsequÃªncias

Positivas:

- uma nova publicaÃ§Ã£o sem Subscription ativa Ã© impossÃ­vel pelo RPC;
- leitura e escrita usam exatamente a mesma regra executÃ¡vel;
- o representante recebe uma causa especÃ­fica e orientada Ã  regularizaÃ§Ã£o;
- o hub deixa de apresentar â€œPublicadoâ€, link ou QR Code quando a policy
  pÃºblica torna a pÃ¡gina inacessÃ­vel;
- draft, despublicaÃ§Ã£o, idempotÃªncia e `published_at` preservam a semÃ¢ntica do
  ADR-043.

Negativas e limites:

- a ativaÃ§Ã£o/reativaÃ§Ã£o da Subscription continua manual; E3 permanece aberta;
- a funÃ§Ã£o SQL continua sem teste de integraÃ§Ã£o automatizado contra um banco
  descartÃ¡vel. O repositÃ³rio cobre o contrato da migration e mantÃ©m roteiro
  manual em `supabase/README.md`.

## ValidaÃ§Ã£o

`tests/subscription-publication-gate.test.ts` verifica a reutilizaÃ§Ã£o de
`is_subscription_active`, a ordem da primeira falha, o caminho de publicaÃ§Ã£o
com assinatura ativa, a preservaÃ§Ã£o de draft/despublicaÃ§Ã£o/idempotÃªncia e os
grants. `tests/map-product-activation-result.test.ts` cobre o novo motivo
tipado. `tests/activation-view-state.test.ts` cobre a composiÃ§Ã£o do estado
persistido com a disponibilidade pÃºblica. A matriz manual do passo 18 em
`supabase/README.md` cobre os cinco cenÃ¡rios de dados exigidos contra um projeto
Supabase real e a apresentaÃ§Ã£o do hub.

## Custo de reversÃ£o

Baixo. Uma nova migration pode redefinir `set_activation_status` com o corpo
anterior. Nenhuma tabela, policy, coluna ou linha foi alterada, e nenhuma
migration aplicada foi editada.
