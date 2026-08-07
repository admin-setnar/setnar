### ADR-067 — Fronteira confiável e atomicidade da submissão de leads

**Status:** Accepted
**Date:** 2026-08-07
**Related:** Corrects ADR-034/ADR-036; follows the trusted-boundary pattern of ADR-065

#### Contexto e problema

`submit_lead` era `SECURITY DEFINER` com `EXECUTE` para `anon` e
`authenticated`. Embora ADR-036 tenha removido os limiares escolhidos pelo
chamador, `p_ip_hash` continuava público: variar o hash criava buckets novos e
contornava o limite. Além disso, a função fazia `count` e depois `insert` na
mesma transação, mas sem serializar transações concorrentes; várias chamadas
do mesmo bucket podiam observar a mesma contagem e ultrapassar cinco aceites.

#### Alternativas consideradas

1. Manter a RPC pública e validar a forma do hash. Rejeitada: forma não prova
   origem, e qualquer valor válido continuaria escolhível pelo cliente.
2. Assinar o hash ou adicionar um token secreto ao protocolo público.
   Rejeitada: ainda exigiria uma fronteira backend e ampliaria o protocolo sem
   benefício sobre restringir a RPC.
3. Restringir a RPC a um cliente server-only específico, derivar o hash apenas
   do IP fornecido pela borda confiável e serializar cada bucket no banco.
   Escolhida; é o mesmo padrão estrutural já aceito para Analytics no ADR-065.

#### Decisão

`submit_lead` perde `EXECUTE` de `public`, `anon` e `authenticated` e recebe
grant somente para `service_role`. Um cliente privilegiado mínimo vive no
adaptador server-only de Leads; a chave não é reutilizada por repositórios
ordinários nem enviada ao navegador. O formulário continua chamando somente
`POST /api/leads`, que resolve Representative/Product e o IP confiável antes
de chegar ao gateway.

O hash continua sendo `sha256(LOGIN_ATTEMPT_SALT:ip)`, preservando ADR-034 e a
compatibilidade dos buckets existentes. Sem IP aceito por
`getTrustedClientIp`, o gateway falha fechado e não chama a RPC; não existe
bucket global `unknown` capaz de persistir Lead sem identidade de limite
confiável.

Dentro da função, `pg_catalog.pg_advisory_xact_lock` sobre
`pg_catalog.hashtextextended(p_ip_hash, 0)` é
adquirido antes da contagem. A decisão inteira — contar, validar, inserir o
Lead e registrar a tentativa — fica serializada por bucket até o fim da
transação. Uma colisão de 64 bits só adiciona contenção entre dois buckets;
não autoriza chamadas extras. A resposta continua `boolean`: rejeição por
limite, payload, par inválido ou ausência de hash não revela a causa. A rota
mantém o mesmo corpo genérico para rejeições.

#### Consequências

- clientes públicos não escolhem mais `ip_hash` nem persistem Leads por RPC;
- chamadas concorrentes do mesmo bucket não ultrapassam cinco aceites/hora;
- o fluxo legítimo exige `SUPABASE_SERVICE_ROLE_KEY` apenas server-side;
- ambientes sem uma borda de IP confiável rejeitam a persistência até terem um
  contrato de proxy explícito;
- o contrato de `submit_lead`, a tabela de tentativas, o threshold, o salt e a
  regra Representative/Product permanecem inalterados;
- a consolidação com a regra canônica de acesso público permanece na SET-21 e
  não é antecipada por esta decisão.

#### Rollback conceitual

O projeto usa migrations forward-only. Uma reversão segura precisaria de nova
migration e de outra forma confiável de fornecer a identidade do bucket;
reabrir `EXECUTE` para `anon`/`authenticated` ou remover a serialização
restauraria as vulnerabilidades e não é um rollback aceitável.
