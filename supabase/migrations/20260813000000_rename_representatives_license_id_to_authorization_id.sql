-- Passo 7a do plano de reconciliação documental
-- (docs/AUDIT_CONSTITUTION_RECONCILIATION.md, Parte 3 item 7), dívida técnica
-- rastreada pelo ADR-060 (README.md): renomeia a coluna
-- `representatives.license_id` para `representatives.authorization_id`.
-- Migration nova; nenhuma migration já aplicada é editada (regra do
-- README.md).
--
-- Este é só o lado de schema/RPC (7a) de um corte 7a/7b. O contrato RPC
-- externo das duas funções `SECURITY DEFINER` abaixo NÃO muda nesta
-- migration: nomes de parâmetro (`p_license_id`), variáveis locais
-- (`v_license_id`) e o status de retorno (`'license_id_invalid'`) continuam
-- exatamente como estão. Só o CORPO das funções muda, para gravar/ler a
-- coluna pelo novo nome. Renomear o contrato RPC, `Representative.licenseId`
-- (domínio/TS) e `LicenseeIdentificationBlock` é 7b, tarefa subsequente
-- separada — ver ADR-061.
--
-- ============================================================================
-- Por que `rename column` é seguro com dados já existentes
-- ============================================================================
--
-- `alter table ... rename column` é uma mudança só de catálogo no Postgres:
-- reescreve `pg_attribute.attname`, não toca em nenhuma página de dado da
-- tabela — não há reescrita de linha, não há lock exclusivo prolongado (só o
-- `ACCESS EXCLUSIVE` breve de qualquer DDL de catálogo), e nenhum valor
-- existente é perdido, convertido ou nulificado. Toda linha de
-- `representatives` já gravada (por `register_representative`,
-- `20260806000000`, ou por `update_representative_profile`, `20260808000000`)
-- continua com o mesmo valor, agora endereçável por `authorization_id` em vez
-- de `license_id`. Tipo (`text`), nullability e o restante da definição da
-- coluna são preservados automaticamente pelo rename — `license_id` nunca
-- teve `unique` nem `check` próprio (`20260731000000`), então não há
-- constraint nomeada por coluna para realinhar.
--
-- ============================================================================
-- Funções SECURITY DEFINER — corpo muda, assinatura não
-- ============================================================================
--
-- `register_representative` e `update_representative_profile` são
-- recriadas via `create or replace function` com a MESMA assinatura externa
-- de hoje (mesmos nomes de parâmetro, mesma ordem, mesmo tipo de retorno) —
-- `create or replace` com assinatura idêntica preserva os `grant`s já
-- concedidos (`to authenticated`) e não quebra os call sites em
-- `supabase-representative-onboarding-gateway.ts` e
-- `supabase-representative-profile-gateway.ts`, nenhum dos dois tocado nesta
-- migration. Só o INSERT/UPDATE interno passa a referenciar
-- `authorization_id` em vez de `license_id` — o parâmetro `p_license_id` e a
-- variável local `v_license_id` continuam com esses nomes (não são o nome da
-- coluna, e renomeá-los é explicitamente 7b).
--
-- ============================================================================
-- Reversão
-- ============================================================================
--
-- Baixo custo: `alter table public.representatives rename column
-- authorization_id to license_id;` desfaz o rename por completo (mesma
-- garantia catálogo-only, mesma ausência de perda de dado), seguido de
-- reaplicar as duas funções abaixo com o corpo anterior (que continua
-- registrado em `20260806000000`/`20260808000000`, nunca editadas). Nenhuma
-- migration já aplicada antes desta precisa ser editada para reverter.

alter table public.representatives
  rename column license_id to authorization_id;

-- ============================================================================
-- register_representative — corpo atualizado, assinatura preservada
-- ============================================================================

create or replace function public.register_representative(
  p_slug         text,
  p_display_name text,
  p_license_id   text,
  p_phone        text,
  p_city         text
)
returns table (status text, representative_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id    uuid;
  v_display_name  text;
  v_license_id    text;
  v_phone         text;
  v_city          text;
  v_new_id        uuid;
  v_constraint    text;
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

  -- license_id: validação de FORMA apenas — ver "BLOQUEADOR DE LANÇAMENTO"
  -- em 20260806000000, ainda não resolvido, fora de escopo desta migration.
  v_license_id := trim(p_license_id);
  if v_license_id is null or length(v_license_id) = 0 or length(v_license_id) > 100 then
    return query select 'license_id_invalid'::text, null::uuid;
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
    -- Único trecho que muda em relação a 20260806000000: a coluna gravada é
    -- `authorization_id`, não `license_id`. O valor gravado (`v_license_id`)
    -- e todo o resto do INSERT permanecem idênticos.
    insert into public.representatives (
      profile_id, company_id, slug, display_name, authorization_id, phone, city
    )
    values (auth.uid(), v_company_id, p_slug, v_display_name, v_license_id, v_phone, v_city)
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
-- update_representative_profile — corpo atualizado, assinatura preservada
-- ============================================================================

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

  -- license_id: obrigatório (a coluna é NOT NULL) — validação de FORMA
  -- apenas, mesmo aviso de 20260806000000.
  v_license_id := trim(p_license_id);
  if v_license_id is null or length(v_license_id) = 0 or length(v_license_id) > 100 then
    return query select 'license_id_invalid'::text;
    return;
  end if;

  -- Único trecho que muda em relação a 20260808000000: a coluna atualizada é
  -- `authorization_id`, não `license_id`. O valor gravado (`v_license_id`) e
  -- todo o resto do UPDATE (phone/city, disciplina tudo-ou-nada, sem
  -- tratamento de unique_violation) permanecem idênticos.
  update public.representatives
  set phone            = v_phone,
      city             = v_city,
      authorization_id = v_license_id
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
