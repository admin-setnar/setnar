-- Passo 7b do plano de reconciliação documental
-- (docs/AUDIT_CONSTITUTION_RECONCILIATION.md, Parte 3 item 7), segunda e
-- última metade da dívida técnica rastreada pelo ADR-060 e iniciada pelo
-- ADR-061 (7a, coluna). Este passo (7b) fecha o resto: o contrato externo
-- das duas funções `SECURITY DEFINER` — `register_representative` e
-- `update_representative_profile` — agora também troca de vocabulário.
-- Migration nova; nenhuma migration já aplicada (nem `20260813000000`) é
-- editada.
--
-- Mudam nesta migration, nas duas funções:
--   - Parâmetro `p_license_id` → `p_authorization_id`.
--   - Variável local `v_license_id` → `v_authorization_id`.
--   - Status de retorno `'license_id_invalid'` → `'authorization_id_invalid'`.
-- O corpo (ordem de validação, limites, mensagens de status para os demais
-- campos) não muda — só nomes. Ver ADR-062 (README.md) para o restante do
-- rename (domínio TypeScript, componente, código de aplicação).
--
-- ============================================================================
-- Por que isto é seguro para os call sites existentes
-- ============================================================================
--
-- `create or replace function` com uma assinatura DIFERENTE (nomes de
-- parâmetro mudam) não é compatível a nível de PostgREST/`supabase-js`: uma
-- chamada `.rpc('register_representative', { p_license_id: ... })` feita por
-- código ainda não atualizado pararia de casar a assinatura nova. Por isso
-- esta migration é aplicada JUNTO com a mudança de
-- `supabase-representative-onboarding-gateway.ts`/
-- `supabase-representative-profile-gateway.ts` (ambos atualizados no mesmo
-- commit que esta migration, ver ADR-062) — não há uma janela de deploy em
-- que schema novo e código de aplicação antigo convivem. `grant`s são
-- reconcedidos explicitamente abaixo (mesmo padrão de `20260813000000`) por
-- clareza, não porque `create or replace function` os revogue — eles já
-- sobrevivem automaticamente a uma troca de nome de parâmetro, contanto que
-- o NOME DA FUNÇÃO e a ORDEM/TIPO dos parâmetros não mudem, o que é o caso
-- aqui.
--
-- ============================================================================
-- Reversão
-- ============================================================================
--
-- Baixo custo: reaplicar `20260813000000` re-cria as duas funções com a
-- assinatura anterior (`p_license_id`/`v_license_id`/`'license_id_invalid'`),
-- e não precisa desfazer nenhum rename de coluna — `authorization_id`
-- (7a) não muda nesta migration. Precisa reverter junto o código de
-- aplicação que chama a RPC (mesmo motivo do parágrafo acima).

-- ============================================================================
-- register_representative — parâmetros/variável/status renomeados
-- ============================================================================

create or replace function public.register_representative(
  p_slug              text,
  p_display_name      text,
  p_authorization_id  text,
  p_phone             text,
  p_city              text
)
returns table (status text, representative_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id       uuid;
  v_display_name     text;
  v_authorization_id text;
  v_phone            text;
  v_city             text;
  v_new_id           uuid;
  v_constraint       text;
begin
  -- Normaliza campos opcionais: string vazia (depois de trim) vira NULL, do
  -- mesmo jeito que um formulário poderia enviar '' para "não informado" em
  -- vez de omitir o campo — um chamador direto do RPC não passa pelo Zod que
  -- faria essa conversão antes.
  v_phone := nullif(trim(p_phone), '');
  v_city  := nullif(trim(p_city), '');

  -- Formato do slug — mesmo regex do CHECK representatives_slug_format
  -- (20260731000000:164).
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return query select 'slug_invalid'::text, null::uuid;
    return;
  end if;

  -- Palavra reservada — lista estática, ver 20260806000000.
  if p_slug = any (array[
    'www', 'app', 'api', 'auth', 'admin',
    'entrar', 'criar-conta', 'esqueci-senha', 'redefinir-senha',
    'termos', 'privacidade',
    'setnar', 'igreen'
  ]) then
    return query select 'slug_invalid'::text, null::uuid;
    return;
  end if;

  -- display_name: não vazio, teto de 80 caracteres, pelo menos duas palavras.
  v_display_name := trim(p_display_name);
  if v_display_name is null
    or length(v_display_name) = 0
    or length(v_display_name) > 80
    or array_length(regexp_split_to_array(v_display_name, '\s+'), 1) < 2
  then
    return query select 'display_name_invalid'::text, null::uuid;
    return;
  end if;

  -- authorization_id (ex-license_id): validação de FORMA apenas — ver
  -- "BLOQUEADOR DE LANÇAMENTO" em 20260806000000, ainda não resolvido, fora
  -- de escopo desta migration. O status de rejeição também muda de nome
  -- nesta migration: 'license_id_invalid' → 'authorization_id_invalid'.
  v_authorization_id := trim(p_authorization_id);
  if v_authorization_id is null or length(v_authorization_id) = 0 or length(v_authorization_id) > 100 then
    return query select 'authorization_id_invalid'::text, null::uuid;
    return;
  end if;

  -- phone: opcional; se presente, precisa ser E.164.
  if v_phone is not null and v_phone !~ '^\+[1-9]\d{6,14}$' then
    return query select 'phone_invalid'::text, null::uuid;
    return;
  end if;

  -- city: opcional; se presente, teto de 500 caracteres.
  if v_city is not null and length(v_city) > 500 then
    return query select 'city_invalid'::text, null::uuid;
    return;
  end if;

  -- company_id: resolvido no servidor, nunca aceito do chamador.
  select id into v_company_id from public.companies where slug = 'igreen';
  if v_company_id is null then
    return query select 'company_not_found'::text, null::uuid;
    return;
  end if;

  -- Checagem dinâmica contra Companies reais — cobre qualquer Company futura
  -- sem depender da lista estática de palavras reservadas.
  if exists (select 1 from public.companies where slug = p_slug) then
    return query select 'slug_invalid'::text, null::uuid;
    return;
  end if;

  -- Pré-checagem "já tenho representante" — a corrida real é fechada pelo
  -- bloco exception no INSERT abaixo, não por esta checagem sozinha.
  if exists (select 1 from public.representatives where profile_id = auth.uid()) then
    return query select 'already_registered'::text, null::uuid;
    return;
  end if;

  -- Pré-checagem de slug em uso — mesma ressalva.
  if exists (select 1 from public.representatives where slug = p_slug) then
    return query select 'slug_taken'::text, null::uuid;
    return;
  end if;

  begin
    insert into public.representatives (
      profile_id, company_id, slug, display_name, authorization_id, phone, city
    )
    values (auth.uid(), v_company_id, p_slug, v_display_name, v_authorization_id, v_phone, v_city)
    returning id into v_new_id;
  exception
    when unique_violation then
      -- Disambigua qual das duas UNIQUE de representatives foi violada — ver
      -- "TOCTOU" em 20260806000000.
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'representatives_profile_id_key' then
        return query select 'already_registered'::text, null::uuid;
        return;
      elsif v_constraint = 'representatives_slug_key' then
        return query select 'slug_taken'::text, null::uuid;
        return;
      else
        raise;
      end if;
  end;

  return query select 'created'::text, v_new_id;
end;
$$;

revoke execute on function public.register_representative(text, text, text, text, text) from public;
grant execute on function public.register_representative(text, text, text, text, text) to authenticated;

-- ============================================================================
-- update_representative_profile — parâmetros/variável/status renomeados
-- ============================================================================

create or replace function public.update_representative_profile(
  p_phone             text,
  p_city              text,
  p_authorization_id  text
)
returns table (status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone             text;
  v_city              text;
  v_authorization_id  text;
  v_id                uuid;
begin
  -- Normaliza campos opcionais: string vazia (depois de trim) vira NULL,
  -- mesma convenção de register_representative.
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

  -- authorization_id (ex-license_id): obrigatório (a coluna é NOT NULL) —
  -- validação de FORMA apenas, mesmo aviso de 20260806000000. Status de
  -- rejeição também muda de nome nesta migration.
  v_authorization_id := trim(p_authorization_id);
  if v_authorization_id is null or length(v_authorization_id) = 0 or length(v_authorization_id) > 100 then
    return query select 'authorization_id_invalid'::text;
    return;
  end if;

  update public.representatives
  set phone            = v_phone,
      city             = v_city,
      authorization_id = v_authorization_id
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
