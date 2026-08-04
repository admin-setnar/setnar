-- Passo E1 (docs/SPRINT_E_PLAN.md §3.2, Opção A, confirmada pelo Pedro): fecha
-- o enforcement de LEITURA da regra 21 (`docs/DOMAIN_MODEL.md:595`, "A
-- Representative's [...] Subscription must be Active for their Commercial
-- Page(s) to remain Published"). `set_activation_status`
-- (20260807000000) já tem um gate de publicação de 4 precondições, mas
-- ele só roda no momento da ESCRITA — uma Subscription que cai DEPOIS de já
-- publicado não é revista por ninguém, e a regra 21 diz "remain Published",
-- não só "be published". Este passo é só a metade de leitura; a 4ª
-- precondição no gate de escrita é o passo E2, separado (SPRINT_E_PLAN.md
-- §5, ordem deliberada).
--
-- ============================================================================
-- Por que aqui não existe o ciclo 42P17 do ADR-039/20260805000000
-- ============================================================================
--
-- O ciclo daquela migration era representatives ⇄ product_activations, as
-- duas com policy de SELECT consultando a outra. Esta função lê só
-- `subscriptions`, que tem RLS habilitado e ZERO policies
-- (20260731000000:270-287) — não há policy nenhuma para expandir dentro do
-- `exists` desta função, logo não há aresta de volta para
-- `product_activations` nem para `representatives`. Mesmo raciocínio do
-- ADR-039, mesmo mecanismo (`security definer` roda como dono, que não está
-- sujeito a RLS), aplicado a um par de tabelas que nunca teve o problema.
--
-- ============================================================================
-- is_subscription_active(uuid)
-- ============================================================================
--
-- `stable`: só lê, permite ao planner reaproveitar o resultado dentro da
-- mesma consulta — mesmo raciocínio de `is_own_representative`
-- (20260805000000), avaliada por linha dentro de uma policy.
-- `language plpgsql`: mesmo padrão de `is_own_representative`, a função mais
-- próxima em papel (SECURITY DEFINER usada dentro de uma policy de leitura).
-- `set search_path = public`: mesmo cuidado das outras cinco funções
-- SECURITY DEFINER deste projeto.
--
-- Ausência de linha em `subscriptions` para o `representative_id` recebido
-- retorna `false` — decisão do Pedro em SPRINT_E_PLAN.md §3.1 (Opção B):
-- nenhuma linha nasce no onboarding, então "nunca assinou" e "assinou e foi
-- suspenso" são indistinguíveis por design, e os dois devem se comportar
-- exatamente igual aqui (nenhum dos dois é Active). `exists` já produz esse
-- comportamento sem precisar de um `coalesce`.
--
-- `grant ... to anon`: precisa valer para o visitante anônimo, porque é
-- chamada de dentro de `product_activations_select_published`, uma policy
-- de leitura PÚBLICA — mesmo padrão de concessão de `is_bot_user_agent`
-- (20260811000000) e `is_login_blocked` (20260728000000), chamadas fora de
-- sessão.
-- ============================================================================

create or replace function public.is_subscription_active(p_representative_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.subscriptions s
    where s.representative_id = p_representative_id
      and s.status = 'active'
  );
end;
$$;

revoke execute on function public.is_subscription_active(uuid) from public;
grant execute on function public.is_subscription_active(uuid) to anon, authenticated;

-- ============================================================================
-- product_activations_select_published — recriada somando o predicado
--
-- `drop` + `create`, não `alter policy`: mesmo padrão de
-- `product_activations_select_own` em 20260805000000. O nome permanece o
-- mesmo — é o nome que `20260731000000:244-246` criou e que
-- `SupabaseRepresentativeRepository.findPublishedActivation` depende
-- implicitamente (via RLS, não por nome direto). Policies permissivas se
-- somam com OR entre si, mas esta é a ÚNICA policy pública de SELECT desta
-- tabela — não há uma segunda para "absorver" o afrouxamento; estreitar
-- esta é o único jeito de a regra valer.
--
-- Efeito: uma linha só é publicamente visível quando `status = 'published'`
-- **e** `is_subscription_active(representative_id)` — as duas, não uma OU
-- outra. `status` da linha em si NÃO muda quando a subscription cai
-- (decisão do Pedro em SPRINT_E_PLAN.md §3.2, coerente com a semântica de
-- `published_at` do ADR-043: destruir "isto já foi publicado" é
-- irreversível e nada exige isso aqui) — a linha só some da visibilidade
-- pública, sem reescrever estado algum.
--
-- `representatives_select_public` (20260731000000:257-267) não é tocada
-- nesta migration: ela já depende de existir uma `product_activations` com
-- `status = 'published'` via `exists`, e o `exists` de uma policy roda com
-- os privilégios da policy que ele expande, não da policy de SELECT da
-- tabela referenciada — não herda este novo predicado automaticamente. Se
-- a única ativação publicada de um representante ficar invisível por
-- assinatura inativa, a página dele para de resolver de qualquer forma
-- (product_activations_select_published bloqueia a leitura que
-- `findPublishedActivation` precisa), então o efeito prático já é o
-- desejado sem mexer em `representatives_select_public` — mas isso é uma
-- observação, não uma prova, e fica registrado para o roteiro de
-- verificação abaixo confirmar contra o banco real.
-- ============================================================================

drop policy if exists "product_activations_select_published" on public.product_activations;

create policy "product_activations_select_published"
  on public.product_activations for select
  using (
    status = 'published'
    and public.is_subscription_active(product_activations.representative_id)
  );
