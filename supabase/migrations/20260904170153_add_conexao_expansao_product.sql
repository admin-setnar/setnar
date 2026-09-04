-- ADR-095: adiciona o oitavo Product ao catálogo `igreen` — `conexao-expansao`
-- — sem reescrever `20260803000000_seed_igreen_catalog.sql` (migration já
-- aplicada, nunca editada, regra do README.md) e sem reabrir a premissa de
-- "catálogo fixo de 7" daquele arquivo: aquele comentário permanece correto
-- sobre o que AQUELA migration inseriu; deixa de ser verdade sobre o
-- catálogo como um todo a partir desta migration, por decisão explícita de
-- produto (ADR-095), não por inferência de código.
--
-- Mesmo padrão de idempotência e resolução de FK do arquivo que esta
-- migration estende: `company_id` vem sempre de um subselect por slug,
-- nunca de um UUID literal da company digitado aqui, pela mesma razão
-- daquele arquivo (a company pode já existir com outro id num ambiente
-- semeado à mão); `on conflict (company_id, slug) do nothing` apoiado na
-- mesma UNIQUE (company_id, slug) de 20260731000000:211.
--
-- ============================================================================
-- UUID literal — contrato igual ao do arquivo original
-- ============================================================================
--
-- `00000000-0000-4000-8000-000000000018` — o próximo da sequência
-- sequencial e não-aleatória que 20260803000000 já usa para products
-- (…0011 a …0017). Mesmo contrato: fixo a partir do momento em que esta
-- migration for aplicada em qualquer ambiente; mudá-lo depois exigiria
-- migrar toda `product_activations`/`leads` que já o referencie.
--
--   00000000-0000-4000-8000-000000000018  products  conexao-expansao
--
-- ============================================================================
-- De onde vem o slug e o nome
-- ============================================================================
--
-- `conexao-expansao` e `Conexão Expansão` são a decisão de produto do
-- Product Owner (ver docs/plans/CONEXAO_EXPANSAO_PLAN_V2.md e ADR-095), não
-- uma escolha desta migration. `products.name` é renderizado publicamente
-- (eyebrow/<h1> da Commercial Page), mesma observação de
-- 20260803000000_seed_igreen_catalog.sql sobre os outros sete nomes.
-- ============================================================================

insert into public.products (id, company_id, slug, name)
select
  '00000000-0000-4000-8000-000000000018'::uuid,
  company.id,
  'conexao-expansao',
  'Conexão Expansão'
from public.companies company
where company.slug = 'igreen'
on conflict (company_id, slug) do nothing;

-- ============================================================================
-- Verificação embutida — escopada a esta migration, não ao catálogo inteiro
--
-- Diferente do guard de 20260803000000 (que exige exatamente 7, porque
-- aquela migration era a única fonte do catálogo inteiro), este guard só
-- confirma que ESTA linha existe — nunca reintroduz uma trava de "total
-- deve ser N", que voltaria a fechar o catálogo por acidente, contrariando
-- ADR-095.
--
-- Checa id e name, não só a existência da slug — "on conflict do nothing"
-- por si só mascararia exatamente o cenário perigoso: um ambiente onde
-- "conexao-expansao" já existisse com um id diferente (semeado à mão) ou um
-- nome incorreto continuaria com `v_found = 1` numa checagem de count(*)
-- ingênua, sem nunca avisar que o contrato de id documentado acima não foi
-- honrado. Uma falha aqui não é uma migration quebrada — é a migration
-- fazendo exatamente o que deveria: recusar-se a passar em silêncio diante
-- de um catálogo que já diverge do que este arquivo assume.
-- ============================================================================

do $$
declare
  v_id   uuid;
  v_name text;
begin
  select p.id, p.name
  into v_id, v_name
  from public.products p
  join public.companies c on c.id = p.company_id
  where c.slug = 'igreen'
    and p.slug = 'conexao-expansao';

  if v_id is null then
    raise exception
      'Falha ao semear o Product "conexao-expansao" para a company "igreen": nenhuma linha encontrada. A company "igreen" existe? Ver ADR-095 e 20260803000000_seed_igreen_catalog.sql.';
  end if;

  if v_id <> '00000000-0000-4000-8000-000000000018'::uuid then
    raise exception
      'Product "conexao-expansao" já existia com id % (esperado 00000000-0000-4000-8000-000000000018) — o "on conflict do nothing" preservou uma linha pré-existente em vez de inserir a desta migration. Isso não é um erro desta migration: é um catálogo que já divergia do contrato de ids antes dela rodar. Reconcilie manualmente (mesmo tratamento que o cabeçalho de 20260803000000 já descreve para esse cenário) antes de prosseguir — não edite este arquivo para "aceitar" o id encontrado.',
      v_id;
  end if;

  if v_name <> 'Conexão Expansão' then
    raise exception
      'Product "conexao-expansao" existe com o id esperado, mas name = % (esperado "Conexão Expansão"). Provável edição manual fora desta migration — reconcilie antes de prosseguir.',
      v_name;
  end if;
end;
$$;
