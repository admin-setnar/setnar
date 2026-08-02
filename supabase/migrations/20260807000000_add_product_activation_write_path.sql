-- Sprint D, passo D4 (docs/SPRINT_D_PLAN.md §4/D4, linhas 486-509): o caminho
-- de escrita de `product_activations` — `activate_product()` (cria a ativação
-- em `draft`) e `set_activation_status()` (transiciona entre
-- `published`/`unpublished`). Duas funções `SECURITY DEFINER`, nenhuma policy
-- nova, nenhuma tabela nova, nenhuma coluna nova. Nenhuma migration já
-- aplicada é editada. Nenhum código de aplicação faz parte deste passo — a
-- Server Action, o schema Zod e a UI de ativação são D5.1/D5.2/D5.3, prompts
-- separados.
--
-- Sem isto, ninguém que completou o onboarding (D3.B) consegue colocar uma
-- página pública no ar: `product_activations` tem RLS habilitado e SOMENTE
-- policies de SELECT (`product_activations_select_published`,
-- 20260731000000:244-246; `product_activations_select_own`, recriada em
-- 20260805000000:182-184). Não existe INSERT, UPDATE nem DELETE por caminho
-- nenhum, e este projeto não tem service role key.
--
-- ============================================================================
-- O que é uma "Commercial Page" NESTE schema — leia antes de procurar a
-- entidade que falta
-- ============================================================================
--
-- `docs/DOMAIN_MODEL.md` descreve dois ciclos de vida que parecem concorrentes,
-- e o schema materializa um só. Registrado aqui porque a leitura errada leva a
-- desenhar checagem que não existe:
--
--   * §8.5 "Product Activation" (DOMAIN_MODEL.md:357) tem ciclo
--     "Activated → (optionally) Deactivated". NÃO é draft/published/unpublished.
--   * §8.6 "Commercial Page" (DOMAIN_MODEL.md:368) e §14.1 (639-650) é que têm
--     Draft → Published → Unpublished.
--
-- Ou seja: `product_activations.status` materializa a máquina de estados da
-- **Commercial Page** sobre a linha da **Product Activation**. Não existe
-- tabela `commercial_pages`, e `findPublishedActivation`
-- (`supabase-representative-repository.ts`) resolve a página pública direto de
-- UMA linha desta tabela. **Neste código, uma Commercial Page É uma linha de
-- `product_activations` com `status = 'published'`.**
--
-- Consequência que economiza uma checagem: a precondição de §8.6
-- (DOMAIN_MODEL.md:371) e a regra 10 — "ao menos um Product ativado" — são
-- satisfeitas POR CONSTRUÇÃO. A linha que está sendo publicada É a ativação.
-- Não há segunda entidade a satisfazer, e `set_activation_status` abaixo
-- deliberadamente não procura por uma.
--
-- ============================================================================
-- Por que duas funções `SECURITY DEFINER`, e não policies de INSERT/UPDATE
-- ============================================================================
--
-- O plano (SPRINT_D_PLAN.md:500-503) inclinava pela policy, "porque o caso não
-- tem o motivo que gerou as funções anteriores (acesso anônimo)". Isso é razão
-- para a função não ser OBRIGATÓRIA — não é razão para a policy ser MELHOR. A
-- decisão fechada é função, e o motivo principal é este:
--
--   **Quem nomeia o representante.** Com policy, o cliente TEM que enviar
--   `representative_id` no corpo do INSERT, e a correção depende inteiramente
--   de o `WITH CHECK` pegar um valor forjado. Com função, a assinatura é
--   `activate_product(p_product_id uuid)` — o representante é derivado de
--   `auth.uid()` por dentro, e o chamador NÃO TEM COMO sequer nomear outro.
--   Mesmo princípio de `tenant_id` em `handle_new_user()` (ADR-011) e de
--   `company_id` em `register_representative()` (ADR-040): o dado que decide a
--   quem a linha pertence nunca vem do chamador.
--
-- Três motivos secundários, todos verificados e não hipotéticos:
--
--   1. Policy não expressa transição. Em RLS de UPDATE, `USING` avalia a linha
--      ANTIGA e `WITH CHECK` a NOVA, como expressões independentes — nenhuma
--      enxerga os dois estados. Logo "draft → unpublished é proibido" é
--      inexprimível numa policy; exigiria trigger.
--   2. Policy não mantém `published_at`. Ou o cliente manda o valor (parâmetro
--      de chamador governando campo de negócio — exatamente o que ADR-036
--      existe para proibir) ou entra um `BEFORE UPDATE` trigger. Mecanismo a
--      mais.
--   3. Ler `representatives` de dentro de uma policy de `product_activations` é
--      a forma que a regra operacional do ADR-039 proíbe — `representatives`
--      TEM policy que consulta `product_activations` de volta
--      (`representatives_select_public`, 20260731000000:257-267). Provavelmente
--      não daria 42P17 hoje (a cadeia termina desde 20260805000000), mas
--      "termina hoje" não é propriedade que alguém re-verifique quando a
--      próxima policy chegar — foi assim que o 42P17 nasceu. Na rota policy as
--      checagens acabariam roteadas por funções `SECURITY DEFINER` de qualquer
--      jeito, e aí a policy não é mais simples: é a função MAIS duas policies,
--      um trigger e grants por coluna.
--
-- Dentro destas funções o problema não é mitigado, é INEXISTENTE: `SECURITY
-- DEFINER` roda como o dono, o dono não está sujeito a RLS (nenhuma tabela usa
-- `force row level security`), então as leituras abaixo não expandem policy
-- nenhuma e não podem formar ciclo.
--
-- ============================================================================
-- `grant execute ... to authenticated`, nunca `anon`
-- ============================================================================
--
-- Mesma razão de `register_representative` (ADR-040) e oposta à de
-- `submit_lead`: toda a lógica aqui depende de `auth.uid()` ser uma identidade
-- real. Sem sessão, `auth.uid()` é null, a resolução do representante não acha
-- linha nenhuma e as duas funções devolvem `representative_not_found` — mas
-- isso é defesa, não caminho suportado: a porta fica fechada na CONCESSÃO
-- (`revoke ... from public` + `grant ... to authenticated`), não numa checagem
-- que poderia ter um furo.
--
-- ============================================================================
-- Regra 6 (Catalog) — checada só no INSERT, e por quê
-- ============================================================================
--
-- Regra 6 / constraint 6 do DOMAIN_MODEL: "uma Product Activation referenciando
-- um Product fora do Catalog da própria Company do Representative nunca deve
-- existir". Checada dentro de `activate_product` com um `exists` comum cruzando
-- `products` e `representatives` — sem RLS envolvida, sem função auxiliar.
--
-- `is_own_representative()` (20260805000000) NÃO serve para isto: ela responde
-- só "esta linha de `representatives` é minha?" e não expõe `company_id`. Ela
-- continua sendo a ferramenta certa para policies (e continua em uso em
-- `product_activations_select_own`), mas dentro de uma função `SECURITY
-- DEFINER` a checagem é SQL comum e não precisa dela.
--
-- Só o INSERT precisa checar: `unique (representative_id, product_id)`
-- (20260731000000:239) mais o fato de `set_activation_status` escrever APENAS
-- `status`/`published_at` tornam o par imutável depois da criação. Nenhuma
-- transição de status pode reintroduzir a violação. (Numa policy de UPDATE isso
-- NÃO seria automático — o cliente poderia reescrever `representative_id` junto
-- com `status`, a menos que houvesse `grant update (status)` escopado por
-- coluna; mais um ponto da decisão acima.)
--
-- Cenário único que violaria a regra 6 retroativamente, registrado e não
-- tratado: `representatives.company_id` mudar (representante troca de empresa,
-- Stage 5). Nada escreve essa coluna depois da criação hoje —
-- `register_representative` a define uma vez e não existe caminho de UPDATE em
-- lugar nenhum do projeto. Quando existir, esta invariante volta à mesa.
--
-- ============================================================================
-- Regra 4 (Retired Product) — INAPLICÁVEL hoje, não invente a coluna
-- ============================================================================
--
-- DOMAIN_MODEL.md:348 diz "a retired Product cannot be newly activated". Isso é
-- inexequível neste schema: `products` NÃO TEM coluna de status, e
-- 20260731000000:70-77 registra que o ciclo Draft/Active/Retired do §8.4 foi
-- deliberadamente não modelado ("deferred to whichever future migration
-- actually introduces it"). `activate_product` abaixo, portanto, não checa
-- retirada de produto — não porque foi esquecido, mas porque não há o que
-- checar. Adicionar a coluna é decisão de outra migration, não efeito colateral
-- desta.
--
-- ============================================================================
-- Máquina de transições — o que cada função aceita
-- ============================================================================
--
-- `activate_product` é o ÚNICO caminho que cria linha, e ela nasce sempre em
-- `draft` (o default da coluna, 20260731000000:233-234). `draft` nunca é alvo
-- de transição explícita: `set_activation_status` só aceita `p_status` em
-- ('published', 'unpublished').
--
--   draft       -> published    permitida, passa pelo gate de publicação
--   unpublished -> published    permitida, passa pelo gate de publicação
--   published   -> unpublished  permitida, sempre (nunca passa pelo gate)
--   draft       -> unpublished  REJEITADA -> 'invalid_transition'
--   qualquer    -> draft        REJEITADA -> 'invalid_status'
--   mesmo estado -> mesmo estado  SUCESSO IDEMPOTENTE, sem escrita
--
-- Nota para quem procurar `published -> draft` / `unpublished -> draft` na
-- lógica abaixo e não achar: elas SÃO rejeitadas, pelo branch de
-- `invalid_status` (p_status nunca pode ser 'draft'), não pelo de
-- `invalid_transition`. Não foram esquecidas.
--
-- `draft -> unpublished` é rejeitada seguindo DOMAIN_MODEL.md:649, que a define
-- como sem sentido ("an unpublished page must have been published at some
-- point"). Registro honesto do peso disso: externamente os dois estados são
-- indistinguíveis, e `published_at is not null` já registra "já foi pública
-- alguma vez" — rejeitar não é a única coisa preservando a distinção. A escolha
-- é por legibilidade (uma tabela de transições explícita torna a §14.1 legível
-- dentro do código) e custa um branch, não por correção.
--
-- Mesmo-estado é sucesso idempotente, não erro: mesma razão do trabalho de
-- TOCTOU em `register_representative` (20260806000000) — duplo clique e retry
-- de rede são comuns, e publicar duas vezes não deve dar erro ao usuário.
--
-- ============================================================================
-- Gate de publicação (`* -> published`) — granular, não genérico
-- ============================================================================
--
-- Três precondições, verificadas em ordem, e a PRIMEIRA que falhar é a
-- reportada:
--
--   1. `representatives.status = 'active'`  -> 'representative_not_active'
--   2. `display_name` não vazio após trim   -> 'display_name_required'
--   3. `phone` não vazio após trim          -> 'phone_required'
--
-- Cada falha tem razão própria em vez de um "não é possível publicar" genérico
-- porque a UI do D5.2 precisa saber exatamente o que pedir ao representante
-- para corrigir — mesma disciplina de resultado tipado granular que
-- `register_representative` já aplica.
--
-- A ORDEM é deliberada: um representante suspenso não deve receber "preencha
-- seu telefone" como orientação — a condição que ele precisa resolver primeiro
-- é a suspensão, e mandá-lo mexer no perfil seria conselho errado.
--
-- `phone` é exigido porque sem ele `WhatsappCta` (ADR-035) simplesmente não
-- renderiza: `if (!representative.phone) return null`. Uma Commercial Page sem
-- CTA não é uma Commercial Page.
--
-- `display_name` já é `NOT NULL` desde 20260731000000:175 e
-- `register_representative` já rejeita vazio — a checagem aqui é para uma linha
-- criada à mão pelo SQL Editor, que pode conter só espaço em branco. É de graça.
--
-- DELIBERADAMENTE FORA DO GATE, os dois registrados como desvio consciente:
--   * `avatar_url` — a regra 7 do DOMAIN_MODEL pede foto no perfil completo.
--     NÃO é exigida: não existe Storage, não existe upload, e NADA renderiza
--     esse campo hoje (`grep` em src/ confirma). Exigir uma foto que ninguém
--     consegue enviar e ninguém mostra tornaria a publicação impossível. Desvio
--     explícito da regra 7, registrado aqui e não descoberto depois.
--   * Subscription ativa — regra 21 / DOMAIN_MODEL.md:650. Fora deste elo (D7).
--     `subscriptions` tem RLS e ZERO policies, `is_subscription_active()` não
--     existe, e nada cria linha de subscription. Lacuna já documentada em
--     `representative-repository.ts:8-21`; publicar aqui ignora cobrança por
--     completo, e isso é o estado conhecido de hoje, não uma regressão desta
--     migration.
--
-- ============================================================================
-- `published_at` — primeira publicação, nunca sobrescrito, nunca anulado
-- ============================================================================
--
--   * Setado na PRIMEIRA transição para `published` (`coalesce`, abaixo).
--   * Republicar (unpublished -> published de novo) NÃO o atualiza.
--   * Despublicar NÃO o anula.
--
-- Por quê, já que não há precedente no projeto: isso torna
-- `published_at is not null` um fato durável — "esta ativação já foi pública
-- alguma vez". Nada mais no schema registra isso, e a regra 12
-- (DOMAIN_MODEL.md:565, o slug não deve mudar depois de publicado) precisa
-- exatamente desse fato para algum dia ser exequível. Sobrescrever destruiria
-- informação de forma irreversível; manter perde apenas um "no ar desde X", que
-- uma migration futura pode adicionar como coluna própria se alguma UI
-- precisar. Entre uma escolha reversível e uma irreversível, sem consumidor
-- hoje para nenhuma das duas, a reversível ganha. Também é coerente com
-- `activated_at` ao lado (`not null default now()`, nunca atualizada — carimbo
-- de criação): `published_at` é o carimbo paralelo "quando foi ao ar pela
-- primeira vez".
--
-- ============================================================================
-- Nota de implementação: colunas SEMPRE qualificadas
-- ============================================================================
--
-- As duas funções são `returns table (status text, ...)`, e `status` é também
-- nome de coluna em `representatives` E em `product_activations`. Em plpgsql o
-- parâmetro OUT sombreia o nome, e uma referência NÃO qualificada a `status`
-- dentro de uma consulta levanta "column reference is ambiguous" em tempo de
-- execução. Por isso toda coluna abaixo aparece qualificada por alias
-- (`r.status`, `pa.status`, ...) e nenhum valor é atribuído aos parâmetros OUT
-- diretamente — todo retorno passa por `return query select ...`, mesmo formato
-- de `register_representative`. Não "limpe" essas qualificações.
--
-- ============================================================================
-- O que um chamador direto do RPC (chave publicável + JWT válido) consegue
-- ============================================================================
--
-- CONSEGUE: ativar qualquer produto do catálogo da PRÓPRIA company; publicar e
-- despublicar as próprias ativações; sondar quais produtos existem (já é
-- público — `products_select_public` é `using (true)`).
-- NÃO CONSEGUE: nomear outro representante (não há parâmetro para isso);
-- ativar produto de outra company (regra 6); publicar sem satisfazer o gate;
-- levar uma ativação a `draft`; escrever `published_at`, `activated_at`,
-- `representative_id` ou `product_id` com valor próprio (nenhum é parâmetro);
-- criar ativação duplicada (a UNIQUE, mais o tratamento de corrida abaixo).

-- ============================================================================
-- activate_product
--
-- Idempotência, decidida e registrada em vez de deixada implícita: se o par
-- (representante, produto) JÁ existir, esta função devolve `'activated'` com o
-- id da linha existente — sucesso, indistinguível de ter acabado de criar.
--
-- Por quê um único status de sucesso, e não um `'already_activated'` separado:
-- a operação é "garanta que este produto está ativado para mim", e a
-- pós-condição é idêntica nos dois casos (existe uma ativação daquele par,
-- pertencente ao chamador). Distinguir obrigaria todo chamador a tratar dois
-- status de sucesso para um desfecho sobre o qual ele não consegue agir de
-- forma diferente. É o mesmo raciocínio que faz mesmo-estado ser sucesso simples
-- em `set_activation_status`.
--
-- CRÍTICO, e o motivo de o UPDATE não existir aqui: quando a linha já existe,
-- esta função NÃO TOCA em `pa.status`. Reativar um produto já `published` não
-- pode rebaixá-lo para `draft` — isso tiraria uma página do ar por causa de um
-- clique em "ativar".
-- ============================================================================

create or replace function public.activate_product(p_product_id uuid)
returns table (status text, activation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_company_id        uuid;
  v_activation_id     uuid;
  v_constraint        text;
begin
  -- Representante do chamador. Sem RLS aqui (SECURITY DEFINER roda como dono),
  -- então isto enxerga a linha independentemente de `representatives_select_own`
  -- e sem expandir policy nenhuma. Sem sessão, `auth.uid()` é null e nada casa.
  select r.id, r.company_id
  into v_representative_id, v_company_id
  from public.representatives r
  where r.profile_id = auth.uid();

  if v_representative_id is null then
    return query select 'representative_not_found'::text, null::uuid;
    return;
  end if;

  -- Produto inexistente e produto fora do catálogo são razões distintas: a
  -- primeira é um id errado, a segunda é a regra 6. Colapsá-las esconderia da
  -- UI qual das duas aconteceu.
  if p_product_id is null or not exists (
    select 1 from public.products p where p.id = p_product_id
  ) then
    return query select 'product_not_found'::text, null::uuid;
    return;
  end if;

  -- Regra 6 / constraint 6 — ver cabeçalho. `exists` comum cruzando as duas
  -- tabelas; nenhuma função auxiliar, nenhuma RLS.
  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.company_id = v_company_id
  ) then
    return query select 'product_not_in_catalog'::text, null::uuid;
    return;
  end if;

  -- Pré-checagem de idempotência. A corrida real é fechada pelo bloco
  -- exception abaixo, não por esta checagem sozinha.
  select pa.id
  into v_activation_id
  from public.product_activations pa
  where pa.representative_id = v_representative_id
    and pa.product_id = p_product_id;

  if v_activation_id is not null then
    -- Linha já existe: devolve como está. Nada é escrito — ver o aviso
    -- CRÍTICO no cabeçalho deste bloco sobre não rebaixar um `published`.
    return query select 'activated'::text, v_activation_id;
    return;
  end if;

  begin
    insert into public.product_activations (representative_id, product_id)
    values (v_representative_id, p_product_id)
    returning id into v_activation_id;
  exception
    when unique_violation then
      -- Duas chamadas concorrentes do mesmo representante para o mesmo produto
      -- (duplo clique, retry). Mesmo padrão de `register_representative`
      -- (20260806000000): a pré-checagem acima não basta, e a exceção crua não
      -- pode escapar pelo RPC. `product_activations_representative_id_product_id_key`
      -- é o nome auto-gerado da `unique (representative_id, product_id)`
      -- declarada em 20260731000000:239.
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'product_activations_representative_id_product_id_key' then
        select pa.id
        into v_activation_id
        from public.product_activations pa
        where pa.representative_id = v_representative_id
          and pa.product_id = p_product_id;

        return query select 'activated'::text, v_activation_id;
        return;
      else
        -- Qualquer outra unique_violation não é esperada pelo schema atual —
        -- relança em vez de esconder atrás de um sucesso.
        raise;
      end if;
  end;

  return query select 'activated'::text, v_activation_id;
end;
$$;

revoke execute on function public.activate_product(uuid) from public;
grant execute on function public.activate_product(uuid) to authenticated;

-- ============================================================================
-- set_activation_status
--
-- `for update` na leitura da ativação: serializa duas transições concorrentes
-- da mesma linha, para que a máquina de estados seja decidida sobre um estado
-- que não pode mudar debaixo da função entre o `select` e o `update`. Barato
-- (uma linha, escopo da transação) e evita depender de sorte no READ COMMITTED.
-- ============================================================================

create or replace function public.set_activation_status(
  p_product_id uuid,
  p_status     text
)
returns table (status text, activation_id uuid, published_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_representative_id uuid;
  v_rep_status        text;
  v_display_name      text;
  v_phone             text;
  v_activation_id     uuid;
  v_current_status    text;
  v_published_at      timestamptz;
  v_new_published_at  timestamptz;
begin
  -- Alvo válido antes de qualquer coisa: `draft` nunca é destino de transição
  -- explícita, e qualquer outra string é rejeitada com resultado tipado em vez
  -- de virar violação crua do CHECK da coluna (20260731000000:233-234).
  if p_status is null or p_status not in ('published', 'unpublished') then
    return query select 'invalid_status'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select r.id, r.status, r.display_name, r.phone
  into v_representative_id, v_rep_status, v_display_name, v_phone
  from public.representatives r
  where r.profile_id = auth.uid();

  if v_representative_id is null then
    return query select 'representative_not_found'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select pa.id, pa.status, pa.published_at
  into v_activation_id, v_current_status, v_published_at
  from public.product_activations pa
  where pa.representative_id = v_representative_id
    and pa.product_id = p_product_id
  for update;

  if v_activation_id is null then
    -- O par nunca foi ativado. Distinto de `product_not_found`: aqui o produto
    -- pode existir perfeitamente — o que falta é `activate_product` ter sido
    -- chamado antes.
    return query select 'not_activated'::text, null::uuid, null::timestamptz;
    return;
  end if;

  -- Mesmo estado: sucesso idempotente, sem escrita e sem passar pelo gate —
  -- republicar algo já publicado não pode falhar por um perfil que mudou depois
  -- da publicação original.
  if v_current_status = p_status then
    return query select 'updated'::text, v_activation_id, v_published_at;
    return;
  end if;

  if p_status = 'unpublished' then
    -- Só `published -> unpublished` chega aqui: mesmo-estado já retornou acima,
    -- e o único outro estado possível é `draft`.
    if v_current_status = 'draft' then
      return query select 'invalid_transition'::text, v_activation_id, v_published_at;
      return;
    end if;

    update public.product_activations
    set status = 'unpublished'
    where id = v_activation_id;

    -- `published_at` preservado de propósito — ver cabeçalho.
    return query select 'updated'::text, v_activation_id, v_published_at;
    return;
  end if;

  -- p_status = 'published', vindo de `draft` ou de `unpublished`. Gate na ordem
  -- do cabeçalho: a primeira precondição que falhar é a reportada.
  if v_rep_status <> 'active' then
    return query select 'representative_not_active'::text, v_activation_id, v_published_at;
    return;
  end if;

  if v_display_name is null or length(trim(v_display_name)) = 0 then
    return query select 'display_name_required'::text, v_activation_id, v_published_at;
    return;
  end if;

  if v_phone is null or length(trim(v_phone)) = 0 then
    return query select 'phone_required'::text, v_activation_id, v_published_at;
    return;
  end if;

  -- Primeira publicação carimba; republicação preserva o carimbo original.
  v_new_published_at := coalesce(v_published_at, now());

  update public.product_activations
  set status = 'published',
      published_at = v_new_published_at
  where id = v_activation_id;

  return query select 'updated'::text, v_activation_id, v_new_published_at;
end;
$$;

revoke execute on function public.set_activation_status(uuid, text) from public;
grant execute on function public.set_activation_status(uuid, text) to authenticated;
