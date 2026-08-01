-- Sprint D, passo D1 (docs/SPRINT_D_PLAN.md §4/D1): seed do catálogo iGreen —
-- uma linha em `companies` e as 7 de `products` que
-- `20260731000000_create_representative_domain.sql` deliberadamente NÃO
-- semeou ("Schema only — no seed data", cabeçalho daquele arquivo, linha 4).
-- Nenhuma migration já aplicada é editada aqui (regra do README.md): esta é
-- uma migration nova, e é a única coisa que ela faz — nenhuma tabela, nenhuma
-- policy, nenhuma função.
--
-- ============================================================================
-- Por que o seed é uma migration, e não um script
-- ============================================================================
--
-- `companies` e `products` não têm policy de INSERT nenhuma
-- (20260731000000), e este projeto não tem service role key — decisão do
-- cabeçalho de 20260728000000, reafirmada no supabase/README.md. Um script
-- Node precisaria de uma chave que ignore RLS pra escrever estas 8 linhas,
-- reabrindo exatamente a superfície que o projeto inteiro foi construído pra
-- não ter. O SQL Editor do Supabase conecta como dono das tabelas e ignora
-- RLS por construção — o mesmo caminho que o supabase/README.md já
-- documenta, passo a passo numerado, para as outras seis migrations. Um seed
-- por migration também é histórico versionado e ordenado; um script é estado
-- que ninguém sabe se rodou.
--
-- Custo aceito, declarado: trocar o `name` de um produto depois vira uma
-- migration nova (`update ... where slug = ...`). Para um catálogo fixo de 7
-- linhas isso é barato. Se o catálogo virar editável, isso é superfície de
-- administração (Stage 5 do docs/ROADMAP.md), não um script de seed.
--
-- ============================================================================
-- UUIDs literais, não gen_random_uuid() — e quais são
-- ============================================================================
--
-- Os 8 ids abaixo são literais fixos de propósito: o mesmo produto tem o
-- mesmo id em dev, no projeto de teste e em produção. Isso (a) torna óbvio,
-- olhando qualquer linha de `product_activations` ou `leads`, que o produto
-- referenciado veio deste seed e não de código de aplicação, e (b) permite
-- que uma migration futura referencie um produto por id sem depender de qual
-- ambiente rodou o seed primeiro. Com `gen_random_uuid()` cada ambiente teria
-- um catálogo com ids diferentes e nada disso valeria.
--
-- O formato é deliberadamente não-aleatório (zeros + um sufixo sequencial),
-- sintaticamente válido como UUID v4, para que seja impossível confundir um
-- id semeado com um id gerado:
--
--   00000000-0000-4000-8000-000000000001  companies  iGreen Energy (slug igreen)
--   00000000-0000-4000-8000-000000000011  products   conexao-green
--   00000000-0000-4000-8000-000000000012  products   conexao-club
--   00000000-0000-4000-8000-000000000013  products   conexao-livre
--   00000000-0000-4000-8000-000000000014  products   conexao-placas
--   00000000-0000-4000-8000-000000000015  products   conexao-solar
--   00000000-0000-4000-8000-000000000016  products   green-seguros
--   00000000-0000-4000-8000-000000000017  products   telecom
--
-- Estes ids são contrato a partir do momento em que esta migration for
-- aplicada em qualquer ambiente: mudá-los depois exigiria migrar toda
-- `product_activations`/`leads` que já os referencie. Trate a tabela acima
-- como a fonte de verdade dela.
--
-- LIMITE REAL DESSE CONTRATO, verificado e não hipotético: ele só vale para
-- linhas que ESTA migration criou. Num ambiente onde a company ou algum
-- produto já tenha sido semeado à mão pelo SQL Editor (com id aleatório de
-- `gen_random_uuid()`), os `on conflict ... do nothing` abaixo preservam a
-- linha existente — de propósito, porque apagá-la quebraria as
-- `product_activations`/`leads` que já a referenciam — e o id literal
-- correspondente simplesmente não é usado ali. O resultado é um catálogo
-- misto: os produtos novos com os ids desta tabela, os pré-existentes com os
-- ids que já tinham.
--
-- O projeto de teste configurado em `.env.local` está exatamente nesse
-- estado hoje (sondado read-only com a chave publicável antes desta migration
-- ser escrita): já existem a company `igreen` e o produto `conexao-green`,
-- ambos com id aleatório, e uma `product_activations` publicada apontando
-- para esse produto. Aplicar esta migration lá NÃO dá erro e NÃO viola o
-- guard de 7 produtos no fim do arquivo — mas produz esse catálogo misto.
-- Alinhar aquele ambiente ao contrato exigiria um `update` de id com todas as
-- FKs junto (`products.company_id`, `product_activations.product_id`,
-- `leads.product_id`, `representatives.company_id`), que é precisamente o
-- custo que este cabeçalho descreve dois parágrafos acima — decisão de
-- ambiente, não desta migration, e por isso ela não tenta fazer isso sozinha.
--
-- ============================================================================
-- De onde vêm os slugs e os nomes
-- ============================================================================
--
-- Os 7 slugs NÃO são escolha desta migration. São, literalmente, os do
-- comentário sobre `products` em
-- 20260731000000_create_representative_domain.sql ("The 7 Stage 1 slugs
-- (conexao-green, conexao-club, ...)") — os mesmos que
-- `tests/route-collision-guard.test.ts` já parseia daquele comentário e os
-- mesmos que `src/app/[productSlug]/page.tsx` resolve como segmento de path.
-- `tests/catalog-seed.test.ts` afirma que o conjunto inserido aqui é
-- exatamente aquele conjunto, nem mais nem menos, parseando os dois arquivos
-- em vez de re-digitar a lista num terceiro lugar.
--
-- Os nomes vêm do `<title>` de cada template em
-- templates/commercial-pages/*/index.html — a fonte de verdade de cópia
-- daquele diretório (ver o README dele). `products.name` é renderizado
-- publicamente (`src/app/[productSlug]/page.tsx:70,72`, como eyebrow e como
-- <h1>), então isto é cópia de face para o cliente, não rótulo interno.
--
-- Duas divergências entre fontes foram decididas antes de semear, não
-- silenciadas:
--   * `green-seguros` — o slug diz "green-seguros", DOMAIN_MODEL.md:59 diz
--     "iGreen Seguros", e o <title> do template diz "iGreen Auto Mensal".
--     Semeado como **iGreen Seguros**: o nome do produto no catálogo, não o
--     de uma oferta específica dentro dele ("Auto Mensal").
--   * `telecom` — semeado como **iGreen Telecom**, com a marca, igual ao
--     <title> do template.
--
-- Nota de compliance, não bloqueante: `companies` tem SELECT público
-- (`companies_select_public`, using (true)), então "iGreen Energy" fica
-- legível pela chave publicável a partir daqui. Isso é seguro hoje porque
-- NADA no app lê `companies` — nenhuma tela exibe esse nome. Se algum dia
-- exibir, é decisão de produto/compliance (README.md, seção "Compliance"),
-- não consequência automática deste seed: `setnar.tenant.ts:53` registra que
-- a marca de terceiro é omitida do site do SETNAR de propósito.

-- ============================================================================
-- companies
--
-- `on conflict (slug) do nothing` — reaplicar esta migration é um no-op, não
-- um erro. A UNIQUE em `companies.slug` (20260731000000:112) é o que torna
-- isso possível.
-- ============================================================================

insert into public.companies (id, name, slug)
values ('00000000-0000-4000-8000-000000000001', 'iGreen Energy', 'igreen')
on conflict (slug) do nothing;

-- ============================================================================
-- products
--
-- `company_id` vem de um subselect por slug, nunca do UUID literal digitado
-- de novo aqui: se a company já existia com outro id (semeada à mão no SQL
-- Editor antes desta migration), os produtos se ligam à linha que existe de
-- verdade, e não a um id que só existe neste arquivo. É por isso que o
-- literal da company aparece uma vez só, no insert acima.
--
-- `on conflict (company_id, slug) do nothing` — mesmo motivo do insert
-- acima, apoiado na UNIQUE (company_id, slug) de 20260731000000:211. O
-- árbitro é essa UNIQUE, não a primary key: numa reaplicação, a linha
-- conflita nela primeiro e o insert nem chega a ser tentado. Um conflito
-- APENAS de primary key (alguém já usou um destes ids literais para outra
-- coisa) não é silenciado — erra alto, que é o comportamento certo, porque
-- significaria que o contrato de ids documentado no topo deste arquivo foi
-- quebrado por fora.
-- ============================================================================

insert into public.products (id, company_id, slug, name)
select
  seed.id::uuid,
  company.id,
  seed.slug,
  seed.name
from public.companies company
cross join (values
    ('00000000-0000-4000-8000-000000000011', 'conexao-green',  'Conexão Green'),
    ('00000000-0000-4000-8000-000000000012', 'conexao-club',   'Conexão Club'),
    ('00000000-0000-4000-8000-000000000013', 'conexao-livre',  'Conexão Livre'),
    ('00000000-0000-4000-8000-000000000014', 'conexao-placas', 'Conexão Placas'),
    ('00000000-0000-4000-8000-000000000015', 'conexao-solar',  'Conexão Solar'),
    ('00000000-0000-4000-8000-000000000016', 'green-seguros',  'iGreen Seguros'),
    ('00000000-0000-4000-8000-000000000017', 'telecom',        'iGreen Telecom')
  ) as seed (id, slug, name)
where company.slug = 'igreen'
on conflict (company_id, slug) do nothing;

-- ============================================================================
-- Verificação embutida — o insert acima pode não inserir nada em silêncio
--
-- O `where company.slug = 'igreen'` significa que, se a company não existir
-- (por exemplo, se alguém rodar só a segunda metade deste arquivo), o select
-- devolve zero linhas e o insert é um no-op sem erro: o catálogo ficaria
-- vazio e nada avisaria. O bloco abaixo transforma esse silêncio numa falha
-- explícita, na hora, e também cobre um seed parcial (uma company duplicada
-- com outro slug, um produto apagado à mão depois).
--
-- Não é um teste — é a última linha de defesa de uma migration que só existe
-- para colocar dado no lugar certo. `tests/catalog-seed.test.ts` cobre a
-- outra ponta (que os slugs deste arquivo batem com os que a aplicação
-- resolve), mas nenhum teste deste repositório roda contra um banco real.
-- ============================================================================

do $$
declare
  v_products int;
begin
  select count(*)
  into v_products
  from public.products p
  join public.companies c on c.id = p.company_id
  where c.slug = 'igreen';

  if v_products <> 7 then
    raise exception
      'Seed do catálogo iGreen incompleto: esperado 7 produtos para a company "igreen", encontrado %. A company foi semeada antes deste insert? Ver o cabeçalho desta migration.',
      v_products;
  end if;
end;
$$;
