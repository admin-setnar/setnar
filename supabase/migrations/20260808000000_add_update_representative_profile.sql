-- Sprint D, passo D5b (docs/SPRINT_D_PLAN.md §4/D5b, linhas 525-533): a
-- primeira escrita em `representatives` FORA do cadastro inicial —
-- `update_representative_profile()`, SECURITY DEFINER, grava `phone`, `city`
-- e `license_id` do próprio representante autenticado. Nenhuma migration já
-- aplicada é editada aqui — nova migration, uma função nova, nada mais.
-- Nenhum código de aplicação (port, adapter, factory, Zod, Server Action, UI)
-- faz parte deste passo.
--
-- `avatar_url` FICA DE FORA de propósito, decisão do Pedro (auditoria D5/D5b):
-- nada no app renderiza esse campo hoje (mesmo motivo já registrado no
-- cabeçalho de `20260807000000` para excluí-lo do gate de publicação) —
-- editar um campo sem consumidor visual é trabalho sem efeito observável.
-- Volta à mesa quando o passo de upload/Storage existir.
--
-- ============================================================================
-- Função, não policy de UPDATE por coluna — decisão do Pedro, entre as duas
-- opções legítimas levantadas na auditoria D5/D5b
-- ============================================================================
--
-- O comentário de `20260728000000_create_profiles.sql:31-40` (sobre
-- `profiles`, não `representatives`) prescreve `grant update (colunas)` +
-- policy escopada como a receita padrão deste projeto para edição de campo
-- próprio, e essa era uma opção real aqui. Nenhum dos dois motivos que
-- levaram D4 (`20260807000000`) a escolher função em vez de policy se aplica
-- a este caso — não há máquina de estados (é um UPDATE reto, não uma
-- transição draft/published/unpublished), e `representatives.updated_at` já
-- é mantido por um trigger (`representatives_set_updated_at`,
-- `20260731000000:191-194`), então não há timestamp derivado para uma função
-- gerenciar manualmente.
--
-- A razão real para função, mesmo assim: uma policy de UPDATE só decide QUEM
-- pode escrever, não VALIDA o que foi escrito. Um chamador direto do RPC
-- (chave publicável + JWT válido, sem Server Action, sem Zod) conseguiria
-- gravar `phone = 'não é um telefone'` ou `license_id = ''` através de uma
-- policy — nenhuma das duas colunas tem CHECK de formato
-- (`representatives.phone`/`license_id` continuam `text` livre, mesma
-- decisão já registrada para `phone` em ADR-035). `register_representative()`
-- já aplica validação de forma a estes mesmos três campos na escrita inicial;
-- uma policy de UPDATE reabriria esse mesmo caminho sem a validação
-- equivalente na edição. A função fecha esse furo aplicando exatamente as
-- mesmas checagens de forma.
--
-- ============================================================================
-- `grant execute ... to authenticated`, nunca `anon` — mesmo motivo de
-- `register_representative`/`activate_product`
-- ============================================================================
--
-- Toda a lógica depende de `auth.uid()` identificar uma linha real. Sem
-- sessão, `auth.uid()` é null, o UPDATE não casa linha nenhuma, e a função
-- devolve `representative_not_found` — defesa, não caminho suportado; a
-- porta fica fechada na concessão, não numa checagem que poderia ter um furo.
--
-- ============================================================================
-- O que NÃO está aqui, e por quê
-- ============================================================================
--
--   * `slug`/`display_name`/`company_id`/`status` — fora de escopo do D5b
--     (`docs/SPRINT_D_PLAN.md` só lista phone/city/avatar_url/license_id, e
--     avatar_url foi adiado — ver acima). `slug` em particular não deve
--     ganhar caminho de UPDATE aqui: a regra 12 (`DOMAIN_MODEL.md:565`) diz
--     que o slug não muda depois de publicado, e esta função não tem como
--     saber se alguma ativação já foi publicada sem duplicar lógica que não
--     é dela.
--   * Nenhum gate de `representatives.status = 'active'` — diferente do
--     publish gate de `set_activation_status` (`20260807000000`). Um
--     representante suspenso ainda pode corrigir seu próprio telefone ou
--     cidade; suspensão bloqueia PUBLICAR (D4/D6), não EDITAR o próprio
--     cadastro — nada no `DOMAIN_MODEL.md` liga as duas coisas.
--   * Nenhum tratamento de `unique_violation`: `phone`, `city` e `license_id`
--     não têm constraint UNIQUE nenhuma (ao contrário de `slug`/`profile_id`
--     em `register_representative`) — o UPDATE não pode colidir com outra
--     linha, então não há corrida a fechar aqui.
--
-- ============================================================================
-- Validação — mesma forma que `register_representative` já aplica aos
-- mesmos três campos, não reinventada
-- ============================================================================
--
--   p_license_id — não vazio após trim, teto de 100 caracteres. Mesmo aviso
--   de `20260806000000`: validação de FORMA, não de autenticidade — o
--   "BLOQUEADOR DE LANÇAMENTO" registrado lá continua valendo aqui.
--   p_phone — opcional; se presente (não vazio após trim), precisa bater o
--   formato E.164 (`^\+[1-9]\d{6,14}$`), mesmo regex de `submit_lead`/
--   `register_representative`.
--   p_city — opcional; se presente, teto de 500 caracteres.
--
-- Diferente de `register_representative`, os três parâmetros aqui SUBSTITUEM
-- o valor atual por completo — não fazem merge parcial. Isso casa com a UI
-- que D5b vai construir (um formulário que pré-preenche os três campos com os
-- valores atuais, não uma edição campo a campo), então nada é perdido por um
-- campo "não tocado": ele chega de volta com o mesmo valor que já tinha. Um
-- chamador direto do RPC que mande `p_phone := null` está deliberadamente
-- LIMPANDO o telefone (`phone`/`city` são nullable), não "não alterando" —
-- a normalização de string vazia para NULL segue a mesma convenção de
-- `register_representative`.
--
-- ============================================================================
-- Resultado tipado — `returns table (status text)`
-- ============================================================================
--
--   'updated'                  — sucesso.
--   'representative_not_found' — `auth.uid()` não tem linha em `representatives`.
--   'license_id_invalid'       — vazio ou maior que 100 caracteres.
--   'phone_invalid'            — presente e fora do formato E.164.
--   'city_invalid'             — presente e maior que 500 caracteres.
--
-- Validado ANTES do UPDATE, todos os três, para nunca escrever parcialmente:
-- se `p_city` for inválido, `phone`/`license_id` não são tocados mesmo que
-- válidos — mesma disciplina "tudo ou nada" que `register_representative`
-- já aplica ao INSERT.

create or replace function public.update_representative_profile(
  p_phone      text,
  p_city       text,
  p_license_id text
)
returns table (status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone      text;
  v_city       text;
  v_license_id text;
  v_id         uuid;
begin
  -- Normaliza campos opcionais: string vazia (depois de trim) vira NULL,
  -- mesma convenção de register_representative — um chamador direto do RPC
  -- não passa pelo Zod que faria essa conversão antes.
  v_phone := nullif(trim(p_phone), '');
  v_city  := nullif(trim(p_city), '');

  -- phone: opcional; se presente, precisa ser E.164.
  if v_phone is not null and v_phone !~ '^\+[1-9]\d{6,14}$' then
    return query select 'phone_invalid'::text;
    return;
  end if;

  -- city: opcional; se presente, teto de 500 caracteres.
  if v_city is not null and length(v_city) > 500 then
    return query select 'city_invalid'::text;
    return;
  end if;

  -- license_id: obrigatório (a coluna é NOT NULL) — validação de FORMA
  -- apenas, ver aviso no cabeçalho desta migration.
  v_license_id := trim(p_license_id);
  if v_license_id is null or length(v_license_id) = 0 or length(v_license_id) > 100 then
    return query select 'license_id_invalid'::text;
    return;
  end if;

  update public.representatives
  set phone      = v_phone,
      city       = v_city,
      license_id = v_license_id
  where profile_id = auth.uid()
  returning id into v_id;

  if v_id is null then
    return query select 'representative_not_found'::text;
    return;
  end if;

  return query select 'updated'::text;
end;
$$;

revoke execute on function public.update_representative_profile(text, text, text) from public;
grant execute on function public.update_representative_profile(text, text, text) to authenticated;
