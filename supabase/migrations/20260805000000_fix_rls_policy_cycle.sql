-- Corrige um ciclo de RLS entre `representatives` e `product_activations`
-- introduzido por 20260804000000_add_own_row_select_policies.sql (passo D2).
-- Migration nova; 20260804000000 não é editada (regra do README.md) — ela já
-- foi aplicada no projeto de teste, e foi lá que o erro abaixo apareceu.
--
-- ============================================================================
-- O bug, reproduzido antes de qualquer linha desta migration ser escrita
-- ============================================================================
--
-- Depois de aplicar 20260803000000 + 20260804000000 no projeto de teste,
-- consultas via PostgREST com a chave publicável (RLS de verdade — nunca o
-- SQL Editor, que conecta como dono das tabelas e ignora RLS) retornaram:
--
--   GET /rest/v1/representatives?select=id,slug,display_name,status
--   HTTP 500
--   {"code":"42P17","details":null,"hint":null,
--    "message":"infinite recursion detected in policy for relation
--               \"representatives\""}
--
--   GET /rest/v1/product_activations?select=id,representative_id,status
--   HTTP 500
--   {"code":"42P17", ... "message":"infinite recursion detected in policy for
--               relation \"product_activations\""}
--
-- Reproduzido nas DUAS pontas, não só na autenticada:
--   - ANÔNIMO (sem sessão, só a chave publicável): as duas consultas acima e
--     também o `select` embutido que
--     `SupabaseRepresentativeRepository.findPublishedActivation()` monta
--     (`product_activations?select=status,representative:representatives
--     !inner(...),product:products!inner(...)&status=eq.published`) → 42P17.
--   - AUTENTICADO (JWT real de um usuário criado pelo fluxo de signup, chave
--     publicável): as mesmas duas consultas → 42P17. Controles na mesma
--     sessão continuaram 200: `profiles` (profiles_select_own),
--     `products`/`companies` (`using (true)`) — ou seja, o erro é do ciclo,
--     não da sessão nem da chave.
--   - `leads` → 42P17 em `representatives` também, por tabela vizinha:
--     `leads_select_own` consulta `representatives`, que arrasta o ciclo
--     inteiro junto.
--
-- ============================================================================
-- O ciclo
-- ============================================================================
--
--   representatives_select_public   (20260731000000:257-267)
--       exists (select 1 from public.product_activations pa ...)
--                              │
--                              ▼
--   product_activations_select_own  (20260804000000:83-92)  ← fechou o ciclo
--       exists (select 1 from public.representatives r ...)
--                              │
--                              └────────► volta para representatives
--
-- Cada tabela passou a ter uma policy de SELECT que consulta a outra. Ao
-- expandir a policy de A, o Postgres expande as policies de B, que voltam a
-- referenciar A — e ele aborta com 42P17 em vez de recursar para sempre.
--
-- `representatives_select_public` é de 20260731000000, já está em produção e
-- funcionava sozinha; `product_activations_select_own` é a metade nova. Logo é
-- esta que sai do caminho — não a que já está em produção.
--
-- ============================================================================
-- CORREÇÃO DE DOCUMENTAÇÃO — 20260804000000, linhas 76-80, está ERRADA
-- ============================================================================
--
-- Aquele comentário afirma:
--
--   "Isto NÃO depende de `representatives_select_own` acima: RLS não se aplica
--    dentro do `exists` de uma policy (a subconsulta roda com os privilégios
--    da própria policy, não como uma segunda consulta do usuário) [...]"
--
-- Isso é falso, e o 42P17 acima é a prova direta: a única maneira de a
-- expansão da policy de `representatives` alcançar a policy de
-- `product_activations` (e voltar) é RLS SENDO aplicada dentro da subconsulta.
-- Se a premissa do comentário valesse, não existiria ciclo nenhum para o
-- Postgres detectar. RLS se aplica a toda tabela referenciada na expressão de
-- uma policy, recursivamente, para qualquer papel sem BYPASSRLS — a policy não
-- roda "com privilégios próprios".
--
-- Consequência de segunda ordem, registrada porque é real e não hipotética:
-- `leads_select_own` (20260731000000:314-323) nunca funcionou como o mesmo
-- comentário supõe. Sua subconsulta em `representatives` sempre esteve sujeita
-- às policies de `representatives` — ou seja, antes de 20260804000000 um
-- representante SEM ativação publicada não satisfazia
-- `representatives_select_public` e por isso não conseguia ler os PRÓPRIOS
-- leads. `representatives_select_own` (20260804000000) fechou essa lacuna de
-- lado, por acidente. Nada é alterado em `leads` aqui — fica registrado, não
-- corrigido, porque hoje o comportamento resultante já é o desejado.
--
-- Este cabeçalho é a correção registrada daquele comentário; 20260804000000
-- continua exatamente como foi aplicada.
--
-- ============================================================================
-- Por que uma função SECURITY DEFINER quebra o ciclo
-- ============================================================================
--
-- `SECURITY DEFINER` faz a função rodar como o dono dela (o mesmo papel dono
-- das tabelas), e o dono não está sujeito a RLS — nenhuma tabela aqui usa
-- `force row level security`. Então a checagem em `representatives` deixa de
-- ser uma referência a `representatives` DENTRO da expressão da policy de
-- `product_activations`: some do plano da consulta, e com ela o ciclo. É o
-- mesmo mecanismo de ADR-011/ADR-012, usado deliberadamente, não contornado.
--
-- Quebrar UM dos dois lados basta — o ciclo precisa das duas arestas:
--   representatives → product_activations → (função, sem aresta de volta).
--
-- Sobre `language plpgsql` em vez de `language sql`: plpgsql é o que este
-- projeto já usa em `submit_lead` e em `handle_new_user`, e é a escolha aqui
-- pela mesma razão — consistência com o padrão existente. Deliberadamente NÃO
-- se registra aqui a justificativa de que uma função `language sql` seria
-- "inlined" pelo planner e perderia o efeito de bypass do SECURITY DEFINER:
-- essa afirmação não se sustenta neste próprio repositório. `is_login_blocked`
-- (20260728000000:159-184) é `language sql` + `security definer` e lê
-- `login_attempts`, uma tabela com RLS habilitada e ZERO policies; se o inline
-- anulasse o bypass, ela contaria sempre zero e o rate limiter de login nunca
-- bloquearia ninguém — e os testes de integração de ADR-017/ADR-018 provam,
-- contra este mesmo banco, que ele bloqueia. (O planner do Postgres recusa
-- inline de função `prosecdef`; é por isso que `is_login_blocked` funciona.)
-- A escolha de plpgsql segue de pé; só a justificativa errada é que não entra
-- na documentação de uma migration deste projeto.
--
-- ============================================================================
-- is_own_representative(uuid)
--
-- Encapsula exatamente o `exists` que hoje está inline em
-- `product_activations_select_own` — mesma junção, mesma pergunta, mesma
-- resposta, nada acrescentado nem afrouxado.
--
-- `stable` porque só lê (permite ao planner reaproveitar o resultado dentro da
-- mesma consulta, que é precisamente o padrão de uso numa policy avaliada por
-- linha). `set search_path = public` é o mesmo cuidado das outras quatro
-- funções SECURITY DEFINER deste projeto. `auth.uid()` é qualificada por
-- schema, então não depende do search_path, e continua lendo o JWT do CHAMADOR
-- (é um GUC da sessão) — SECURITY DEFINER troca o papel de execução, não a
-- identidade autenticada.
--
-- Não vaza nada ao ser concedida a anon: recebe um id e devolve true só quando
-- aquela linha pertence ao próprio chamador. Sem sessão, `auth.uid()` é null,
-- a comparação nunca casa, e o retorno é sempre false.
-- ============================================================================

create or replace function public.is_own_representative(p_representative_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.representatives r
    where r.id = p_representative_id
      and r.profile_id = auth.uid()
  );
end;
$$;

revoke execute on function public.is_own_representative(uuid) from public;
grant execute on function public.is_own_representative(uuid) to anon, authenticated;

-- ============================================================================
-- product_activations_select_own — recriada sobre a função
--
-- `drop` + `create` e não `alter policy`: o nome permanece o mesmo, e é o nome
-- que o roteiro de verificação do supabase/README.md e o cabeçalho de
-- 20260804000000 citam. O efeito pretendido é idêntico ao daquela migration —
-- o dono da linha enxerga as próprias ativações, inclusive `draft` e
-- `unpublished`; `product_activations_select_published` continua intacta e
-- somando com OR para o visitante anônimo.
--
-- `if exists` no drop pelo mesmo motivo que 20260803000000 usa `on conflict do
-- nothing` e 20260802000000 usa `drop function if exists`: reaplicar o arquivo
-- inteiro tem que ser seguro, inclusive num ambiente onde ele já rodou.
-- `representative_id` é qualificado pela tabela, como no original — dentro de
-- uma policy a coluna nua já resolveria, mas a forma explícita é a que
-- 20260804000000 usava e é a que não muda de sentido se a função ganhar um
-- segundo parâmetro algum dia.
-- ============================================================================

drop policy if exists "product_activations_select_own" on public.product_activations;

create policy "product_activations_select_own"
  on public.product_activations for select
  using (public.is_own_representative(product_activations.representative_id));
