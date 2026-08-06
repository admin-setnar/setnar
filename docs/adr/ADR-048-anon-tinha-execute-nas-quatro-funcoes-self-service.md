### ADR-048 — `anon` tinha EXECUTE nas quatro funções self-service; `revoke ... from public` nunca foi a causa, um `ALTER DEFAULT PRIVILEGES` era
**Achado, confirmado contra o projeto Supabase real por teste manual, não por
revisão de código.** `select routine_name, grantee, privilege_type from
information_schema.role_routine_grants where routine_name in
('activate_product', 'set_activation_status', 'register_representative',
'update_representative_profile', 'submit_lead')` mostrou `anon` com EXECUTE
nas cinco funções — incluindo as quatro que ADR-040/ADR-043/ADR-047 afirmam,
cada um, ser `grant ... to authenticated` **apenas**, nunca `anon`. Confirmado
de forma mais direta ainda: um RPC HTTP contra `activate_product`, com só o
header `apikey` e **sem** `Authorization` (nenhuma sessão), respondeu HTTP 200
com `{status: 'representative_not_found', ...}` — um resultado TIPADO da
função, não `42501`. Uma concessão correta teria barrado a chamada antes do
corpo da função rodar; aqui o corpo rodou.
**Os quatro ADRs anteriores estavam errados na prática, apesar do SQL parecer
certo à primeira vista.** ADR-040/ADR-043/ADR-047 (e as migrations
`20260806000000`/`20260807000000`/`20260808000000` que documentam) todos
incluem `revoke execute on function ... from public` seguido de `grant
execute ... to authenticated`. Esse padrão é o mesmo já usado, corretamente,
desde ADR-011 — mas aqui não teve efeito nenhum, porque revogava de um papel
(`public`) que nunca foi a origem da concessão vazada.
**Causa raiz.** O projeto tem um `ALTER DEFAULT PRIVILEGES` configurado no
schema `public`, concedendo EXECUTE em funções novas diretamente a `anon` no
momento da criação — uma concessão direta ao papel, não via `public`, e que
roda automaticamente toda vez que `create or replace function` cria uma
função nova. `revoke ... from public` nunca alcança essa concessão porque ela
nunca passou por `public`. Confirmável com `select nspname,
defaclrole::regrole, defaclobjtype, defaclacl from pg_default_acl join
pg_namespace on pg_namespace.oid = pg_default_acl.defaclnamespace where
nspname = 'public'` — um `defaclacl` com `anon=X/...` para
`defaclobjtype = 'f'` confirma.
**Decisão — dois passos, `20260809000000_revoke_anon_execute_leak.sql`.**
1. Revoga EXECUTE de `anon`, explicitamente, por assinatura exata, nas quatro
   funções já existentes — o `alter default privileges` do passo 2 não
   alcança funções já criadas, só as futuras, então este passo continua
   necessário sozinho. 2. `alter default privileges in schema public revoke
   execute on functions from anon` — fecha a causa raiz para qualquer função
   `SECURITY DEFINER` futura (D7/subscription, por exemplo), sem tocar
   `authenticated`.
**`submit_lead` não é tocado.** Seu `grant execute ... to anon` é proposital
(ADR-034). Um grant explícito posterior sobrepõe um default privilege
anterior — a mudança de default do passo 2 não desfaz esse grant explícito
já existente.
**Por que os roteiros manuais dos passos 10/11/12 não pegaram isto antes.**
Os roteiros de verificação de `activate_product`/`set_activation_status`
(passo 11) e `update_representative_profile` (passo 12) já têm, como
primeiro item, exatamente a checagem que teria revelado este furo — "sem
sessão nenhuma, a chamada deve falhar". Mas nenhum dos dois roteiros tinha
sido de fato executado contra um projeto real ainda (`supabase/README.md`
registrava as duas datas de confirmação em branco); a checagem existia no
papel, sem nunca ter rodado. `register_representative` (passo 10) tinha, sim,
verificação de rejeição anônima — mas via teste automatizado
(`tests/register-representative.integration.test.ts`), que exercita a função
via `supabase-js` com uma sessão anônima real, não via RPC HTTP puro sem
nenhum header de sessão — uma diferença que não deveria importar em teoria
(as duas formas passam pela mesma concessão do Postgres), mas que este achado
prova que importava na prática, contra este projeto específico. Novo roteiro
combinado em `supabase/README.md`, "passo 13", fecha as duas lacunas: reroda
o teste "sem sessão" das quatro funções via RPC HTTP direto, contra o projeto
real, depois de aplicar esta migration.
**Custo de reversão.** Baixo — `revoke`/`alter default privileges` na
migration nova; nenhuma tabela, coluna ou linha é tocada. Reverter a migration
reabriria o furo, não vice-versa.
