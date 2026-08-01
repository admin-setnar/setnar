-- Sprint D, passo D2 (docs/SPRINT_D_PLAN.md §4/D2): duas policies de SELECT
-- que faltavam para um representante autenticado conseguir ler as PRÓPRIAS
-- linhas. Só policies — nenhuma tabela, nenhuma coluna, nenhuma função,
-- nenhum dado. Migration nova; nada já aplicado é editado (regra do
-- README.md).
--
-- ============================================================================
-- A lacuna que isto fecha
-- ============================================================================
--
-- Todas as policies criadas por 20260731000000_create_representative_domain.sql
-- em `representatives` e `product_activations` são de leitura PÚBLICA — feitas
-- para o visitante anônimo de uma Commercial Page. Nenhuma delas serve ao
-- representante autenticado olhando para o próprio cadastro, e o efeito disso
-- é mais forte do que "faltou uma policy":
--
--   1. `representatives_select_public` (20260731000000:257-267) é a ÚNICA
--      policy de SELECT em `representatives`, e exige `status = 'active'`
--      **E** existir ao menos uma `product_activations` com
--      `status = 'published'`. Um representante recém-criado não tem ativação
--      nenhuma — logo não satisfaz a policy — logo `select * from
--      representatives` com a sessão dele devolve ZERO linhas, inclusive a
--      dele mesmo. Qualquer tela de `/app` que precise saber "quem sou eu como
--      representante" é impossível até esta migration.
--   2. `product_activations_select_published` (20260731000000:244-246) expõe
--      só `status = 'published'`. A tela de ativação de produto precisa listar
--      exatamente o que essa policy esconde: `draft` e `unpublished`.
--
-- Por que isto é uma migration própria, aplicada antes de existir qualquer
-- tela: é adição pura e revisável sozinha, e vale independentemente de como o
-- Representative passa a ser criado (docs/SPRINT_D_PLAN.md §3 — decidido:
-- onboarding explícito, passo D3, ainda não implementado).
--
-- ============================================================================
-- Por que adicionar não afraca a leitura pública
-- ============================================================================
--
-- Policies permissivas (o padrão; nenhuma aqui é `as restrictive`) se somam
-- com OR: uma linha é visível se QUALQUER policy de SELECT da tabela a
-- permitir. As duas abaixo, portanto, não relaxam nem alteram
-- `representatives_select_public` / `product_activations_select_published` —
-- elas acrescentam um segundo caminho, disjunto, para o dono da linha.
--
-- E não abrem nada para o anônimo: sem sessão, `auth.uid()` é null, então
-- `profile_id = auth.uid()` é NULL — nunca true — e o `exists (...)` da
-- segunda policy não casa com linha nenhuma. Um visitante com a chave
-- publicável continua enxergando exatamente o que enxergava antes desta
-- migration: representantes ativos com ao menos uma ativação publicada, e só
-- as ativações publicadas.

-- ============================================================================
-- representatives_select_own
--
-- `profile_id = auth.uid()` — o mesmo formato de `profiles_select_own`
-- (20260728000000:27-29). `representatives.profile_id` é UNIQUE e referencia
-- `profiles(id)`, que por sua vez referencia `auth.users(id)`
-- (20260728000000:16), então esta comparação é sempre contra a identidade
-- autenticada, nunca contra um valor vindo do cliente.
-- ============================================================================

create policy "representatives_select_own"
  on public.representatives for select
  using (profile_id = auth.uid());

-- ============================================================================
-- product_activations_select_own
--
-- Mesmo formato de `leads_select_own` (20260731000000:314-323), copiado de
-- propósito em vez de inventado: a pergunta é idêntica ("esta linha pertence
-- ao representante da sessão atual?") e a resposta atravessa a mesma junção,
-- `representatives.profile_id = auth.uid()`. `product_activations` não tem
-- `profile_id` próprio — e não deve ter: duplicar a identidade aqui criaria
-- uma segunda fonte de verdade sobre a quem a ativação pertence, que poderia
-- divergir de `representative_id`.
--
-- Isto NÃO depende de `representatives_select_own` acima: RLS não se aplica
-- dentro do `exists` de uma policy (a subconsulta roda com os privilégios da
-- própria policy, não como uma segunda consulta do usuário), exatamente como
-- já acontece em `leads_select_own` e em `representatives_select_public`, que
-- lê `product_activations` sem depender das policies dela.
-- ============================================================================

create policy "product_activations_select_own"
  on public.product_activations for select
  using (
    exists (
      select 1
      from public.representatives r
      where r.id = product_activations.representative_id
        and r.profile_id = auth.uid()
    )
  );
