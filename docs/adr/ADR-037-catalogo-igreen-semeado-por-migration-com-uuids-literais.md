### ADR-037 — Catálogo iGreen semeado por migration, com UUIDs literais fixos — não por script, não com `gen_random_uuid()`
**Decisão.** `supabase/migrations/20260803000000_seed_igreen_catalog.sql`
insere uma linha em `companies` (iGreen Energy, slug `igreen`) e as 7 de
`products` que `20260731000000_create_representative_domain.sql`
deliberadamente não semeou ("Schema only — no seed data", cabeçalho daquele
arquivo). Passo D1 de `docs/SPRINT_D_PLAN.md`. Nenhuma migration já aplicada
foi editada (regra do topo desta seção); esta é uma migration nova.
**Por que migration, não um script de seed.** Não é preferência de estilo:
`companies` e `products` não têm policy de INSERT nenhuma, e este projeto não
tem service role key (cabeçalho de `20260728000000`, reafirmado no
`supabase/README.md`). Um script Node precisaria de uma chave que ignore RLS
para escrever estas 8 linhas — reabrindo exatamente a superfície que o resto
do projeto foi construído para não ter. O SQL Editor conecta como dono das
tabelas e ignora RLS por construção, que é o caminho que o
`supabase/README.md` já documenta numerado para as outras seis migrations;
este seed entra como passo 7 da mesma lista, sem processo paralelo. Também
não há infra de seed para reaproveitar: a CLI do Supabase não é dependência
do `package.json` e `scripts/` tem um arquivo só
(`require-integration-env.mjs`). **Custo aceito, declarado:** trocar o `name`
de um produto depois vira uma migration nova (`update ... where slug = ...`).
Para um catálogo fixo de 7 linhas isso é barato; se o catálogo virar
editável, isso é superfície de administração (Stage 5), não um script.
**Por que UUIDs literais fixos.** Os 8 ids são literais
(`00000000-0000-4000-8000-000000000001` para a company,
`...011`–`...017` para os produtos, tabela completa no cabeçalho da
migration), não `gen_random_uuid()`: o mesmo produto tem o mesmo id em dev,
no projeto de teste e em produção, então (a) é óbvio, olhando qualquer linha
de `product_activations` ou `leads`, que o produto veio deste seed e não de
código de aplicação, e (b) uma migration futura pode referenciar um produto
por id sem depender de qual ambiente semeou primeiro. O formato é
deliberadamente não-aleatório para que um id semeado nunca seja confundido
com um gerado. **Consequência:** esses ids viram contrato no momento em que
esta migration for aplicada em qualquer ambiente — trocá-los depois exigiria
migrar toda `product_activations`/`leads` que já os referencie.
**Limite conhecido desse contrato, verificado antes de escrever este ADR.**
Ele só vale para linhas que a migration criou. Sondando o projeto de teste de
`.env.local` (read-only, chave publicável): **já existem lá a company `igreen`
e o produto `conexao-green`, ambos com id aleatório**, mais uma
`product_activations` publicada apontando para esse produto — o fixture que
`tests/lead-submission.integration.test.ts` descobre em tempo de execução.
Aplicar o seed naquele projeto não dá erro e não viola o guard de 7 produtos
(o `on conflict` preserva as duas linhas, os outros 6 produtos entram com os
ids literais), mas o resultado é um catálogo **misto**: 6 ids literais, 1 id
aleatório, e uma company com id aleatório. Preservar a linha existente é
deliberado — apagá-la quebraria a activation que a referencia. Alinhar aquele
ambiente exigiria um `update` de id arrastando todas as FKs
(`products.company_id`, `product_activations.product_id`, `leads.product_id`,
`representatives.company_id`), que é exatamente o custo descrito acima: é
decisão de ambiente, não da migration, e por isso ela não tenta fazer isso
sozinha. Em dev e em produção, ambos sem catálogo nenhum hoje, o contrato vale
integralmente.
**Idempotência.** `on conflict (slug) do nothing` na company e
`on conflict (company_id, slug) do nothing` nos produtos, apoiados nas UNIQUE
que `20260731000000` já criou: reaplicar é no-op, não erro. O árbitro é a
UNIQUE, não a primary key — numa reaplicação a linha conflita nela primeiro
e o insert nem é tentado; um conflito apenas de primary key (alguém já usou
um destes ids literais para outra coisa) erra alto de propósito, porque
significaria o contrato de ids quebrado por fora. Os produtos referenciam a
company por subselect no slug, nunca pelo UUID literal digitado de novo: se a
company já existir com outro id (semeada à mão antes), os produtos se ligam à
linha que existe de verdade.
**Verificação embutida.** O `where company.slug = 'igreen'` faz o insert de
produtos ser um no-op silencioso se a company não existir. Um bloco `do $$`
no fim da migration levanta exceção se a contagem final não for exatamente 7
— um seed parcial falha na hora, em vez de virar um catálogo vazio que só
seria notado quando uma página não resolvesse.
**De onde vêm slugs e nomes.** Os 7 slugs não são escolha desta migration:
são os do comentário sobre `products` em `20260731000000`, os mesmos que
`tests/route-collision-guard.test.ts` já parseia e que
`src/app/[productSlug]/page.tsx` resolve. Os nomes vêm do `<title>` de cada
template em `templates/commercial-pages/` (o README daquele diretório é a
fonte de verdade de cópia; nenhum arquivo dele foi tocado). Duas divergências
entre fontes foram decididas antes de semear, não silenciadas: `green-seguros`
virou **iGreen Seguros** (nome do produto no catálogo — `DOMAIN_MODEL.md:59` —
e não "iGreen Auto Mensal", que é uma oferta específica dentro dele, como diz
o `<title>` do template), e `telecom` virou **iGreen Telecom**, com a marca,
igual ao `<title>`. `products.name` é renderizado publicamente
(`src/app/[productSlug]/page.tsx:70,72`), então isto é cópia de face para o
cliente, não rótulo interno.
**Teste.** `tests/catalog-seed.test.ts` afirma igualdade de conjunto nos dois
sentidos entre os slugs inseridos pelo seed e os do comentário de
`20260731000000` — parseando os dois arquivos, nunca re-digitando a lista num
terceiro lugar, mesma técnica de `route-collision-guard.test.ts`. Também
afirma que os 7 ids literais são distintos (um duplicado por copy-paste não
seria pego pelo `on conflict (company_id, slug)`; só apareceria como violação
de primary key na hora de aplicar). O guard foi verificado negativamente
antes de ser dado como pronto: alterando `telecom` para `telecom-errado` no
seed, o teste falha apontando a diferença; revertido em seguida.
**Nota de compliance, não bloqueante.** `companies_select_public` é
`using (true)`, então "iGreen Energy" fica legível pela chave publicável a
partir daqui. Seguro hoje porque **nada no app lê `companies`** — nenhuma tela
exibe esse nome. Se algum dia exibir, é decisão de produto/compliance (seção
"Compliance" acima), não consequência automática deste seed:
`setnar.tenant.ts:53` registra que a marca de terceiro é omitida do site do
SETNAR de propósito.
**Custo de reversão.** Baixo enquanto nada referenciar os ids; médio depois
(ver "Consequência" acima).
