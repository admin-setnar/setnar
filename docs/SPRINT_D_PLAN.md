# SPRINT_D_PLAN.md

> Plano de implementação — fechar o elo entre Autenticação (Sprint A/B) e
> Commercial Page/Leads (Sprint C)
> Status: **proposta, não implementada** — nenhum código deste documento existe
> Escopo: seed do catálogo iGreen, provisionamento de Representative, ativação
> de produto no `/app`, e o que falta pra uma Commercial Page realmente publicar

Este documento é um plano, não um ADR. Ele **levanta** uma decisão de
arquitetura (§3) em vez de fechá-la, e propõe passos pequenos o bastante pra
serem auditados, revisados e implementados um de cada vez — mesmo processo do
lead capture (ADR-034/ADR-036). Os ADRs correspondentes só devem ser escritos
no `README.md` quando cada passo for de fato implementado, não agora.

---

# 1. Correção ao briefing, antes de tudo

**Os 7 arquivos de FAQ/produto citados no briefing não existem neste
repositório.** Procurei por `FAQ_Conexão_Green.md`, `Conexão_Solar.md`,
`Conexão_Placas.md`, `Conexão_Club.md`, `Conexão_Livre_FAQ.md`,
`Green_Seguros.md` e `Telecom.md` — por nome exato, por padrão
(`find . -iname "*Conex*" -o -iname "*FAQ*"`), e varrendo todos os `.md`
rastreados e não-rastreados. Os únicos `.md` do projeto são: `README.md`,
`docs/{ARCHITECTURE,DESIGN_SYSTEM,DOMAIN_MODEL,ENGINEERING_GUIDELINES,PRODUCT,ROADMAP}.md`,
`src/shared/ui/README.md`, `supabase/README.md` e
`templates/commercial-pages/README.md`.

Isso muda de onde o seed pode tirar dado, então não é um detalhe: **as fontes
reais de verdade sobre os 7 produtos, dentro do repositório, são três**, e o
plano abaixo usa só elas:

| Fonte | O que ela é autoridade | Onde |
|---|---|---|
| Comentário do `products` na migration | Os **7 slugs**, literalmente | `supabase/migrations/20260731000000_create_representative_domain.sql:199-201` |
| Os 7 diretórios de template | O **nome comercial** e a cópia aprovada por compliance de cada produto | `templates/commercial-pages/*/index.html` (`<title>`) |
| `DOMAIN_MODEL.md` §3/§8.3 | O vocabulário do Catalog e o exemplo iGreen | `docs/DOMAIN_MODEL.md:59, 336` |

Se aqueles 7 arquivos de FAQ existem em algum lugar (Drive, Notion, outra
pasta fora do repo), eles podem valer como fonte de *descrição* de produto —
mas veja §4.1: **`products` hoje não tem coluna de descrição nenhuma**, então
nada além de `slug` e `name` teria onde ser semeado. Trazer descrição pro banco
é uma migration de schema separada, não parte deste plano.

---

# 2. Investigação — o que está realmente no repositório

Tudo abaixo foi verificado direto nos arquivos, não herdado do briefing.

## 2.1 Schema (confirmado, `20260731000000_create_representative_domain.sql`)

```
companies             (id, name, slug UNIQUE, created_at, updated_at)
products              (id, company_id→companies, slug, name, ..., UNIQUE(company_id, slug))
representatives       (id, profile_id→profiles UNIQUE, company_id→companies,
                       slug UNIQUE + CHECK '^[a-z0-9]+(-[a-z0-9]+)*$',
                       display_name NOT NULL, license_id NOT NULL,
                       phone NULL, city NULL, avatar_url NULL,
                       status DEFAULT 'active' CHECK IN ('active','suspended'))
product_activations   (id, representative_id, product_id,
                       status DEFAULT 'draft' CHECK IN ('draft','published','unpublished'),
                       activated_at, published_at NULL, UNIQUE(representative_id, product_id))
subscriptions         (id, representative_id UNIQUE, status, provider DEFAULT 'manual', ...)
leads                 (id, representative_id, product_id NULL, telefone_e164, campos jsonb, ...)
```

Confirmado também: **sem seed data** (o cabeçalho da migration diz isso
explicitamente, linha 4: *"Schema only — no seed data"*), e nenhuma linha de
`companies`/`products` existe em ambiente nenhum.

## 2.2 RLS — três lacunas que o briefing não menciona e que bloqueiam o `/app`

Esta é a descoberta mais importante da investigação. As policies existentes são
todas **de leitura pública**; nenhuma serve ao representante autenticado
olhando pros próprios dados.

**Lacuna 1 — um representante não consegue ler a própria linha.**
`representatives_select_public` (linhas 257-267) é a *única* policy de SELECT
em `representatives`, e exige `status = 'active'` **E** existir uma
`product_activations` com `status = 'published'`. Um representante recém-criado
tem zero ativações → **zero linhas retornadas pra ele mesmo**, com sessão
válida. Qualquer tela de `/app` que precise saber "quem sou eu como
representante" não funciona hoje.

**Lacuna 2 — um representante não consegue ler as próprias ativações em
rascunho.** `product_activations_select_published` (linhas 244-246) expõe só
`status = 'published'`. A tela de ativação precisa listar exatamente o que essa
policy esconde (`draft`/`unpublished`).

**Lacuna 3 — não existe caminho de escrita nenhum.** Nenhuma das seis tabelas
tem policy de INSERT, UPDATE ou DELETE. `profiles` também não (o comentário da
`20260728000000`, linhas 31-40, diz que isso foi deliberado e prescreve como
adicionar: `grant update (coluna)` + policy escopada por coluna, nunca por
linha inteira). E o projeto **não tem service role key** — decisão registrada no
cabeçalho da `20260728000000` e reafirmada no `supabase/README.md`. Ou seja:
toda escrita nova precisa ser policy nova ou função `SECURITY DEFINER`, sem
terceira opção.

`companies_select_public` e `products_select_public` são `using (true)` — o
catálogo em si já é legível pelo `/app` sem policy nova. Só isso.

## 2.3 Código de aplicação (confirmado por `grep -rln "representatives" src/`)

Os únicos arquivos que tocam `representatives` são o próprio módulo
`src/modules/representatives/`, `src/app/[productSlug]/page.tsx` e
`src/app/api/leads/route.ts` — **todos de leitura**. Nada em
`src/modules/auth/` cria, referencia ou sabe da existência de um
Representative. Confirmado: hoje só existe linha em `representatives` via SQL
Editor manual.

`SignUpData` (`src/modules/auth/domain/auth.ts:11-16`) carrega
`{ name, email, password, acceptedTerms }` — nada mais. `signUpSchema` confirma
os mesmos quatro campos. **Não há `license_id` nem slug em lugar nenhum do
cadastro** — isso é o eixo da decisão do §3.

## 2.4 O padrão port+factory a reaproveitar (não inventar um novo)

O projeto tem exatamente uma forma, repetida em três módulos:

```
domain/<x>-gateway|repository.ts   ← porta (interface), sem framework
infrastructure/<x>-factory.ts      ← composition root, 'server-only',
                                     constrói cliente por chamada, nunca cacheia
infrastructure/supabase-<x>.ts     ← adaptador
infrastructure/in-memory-<x>.ts    ← adaptador de teste (quando faz sentido)
presentation/actions.ts            ← Server Actions, via safeAuthCall
application/<caso-de-uso>.ts       ← recebe a porta como parâmetro explícito
```

Duas convenções não-óbvias, extraídas dos comentários dos próprios arquivos e
que qualquer código novo tem que respeitar:

- **A factory nunca é cacheada em módulo** (`auth-gateway-factory.ts:12-23`,
  `representative-repository-factory.ts:7-17`): o cliente Supabase é ligado aos
  cookies da requisição; um singleton vaza sessão entre usuários.
  `getCurrentUser` é a exceção, e é `cache()` do React (por requisição), não
  singleton de módulo — com justificativa medida documentada.
- **Casos de uso recebem a porta como parâmetro**
  (`resolve-representative.ts:8-27`), não chamam a factory por dentro — pra
  serem testáveis fora de contexto de requisição. `resolveTenant()` é a exceção
  explicada (adaptador em memória, sem dependência de request).

## 2.5 O padrão de provisionamento por trigger (ADR-011)

`handle_new_user()` (`20260728000000_create_profiles.sql:98-120`) é
`SECURITY DEFINER`, dispara `after insert on auth.users`, e roda **na mesma
transação** do insert em `auth.users`. ADR-011 registra o porquê: sem service
role key, duas chamadas sequenciais deixariam um auth user órfão sem profile se
a segunda falhasse; com o trigger, a falha faz rollback do `auth.users` também
— o estado intermediário não chega a existir.

Detalhe que importa pro §3: o trigger só lê `full_name` do
`raw_user_meta_data`. `tenant_id`, `terms_accepted_at` e `terms_version` são
**decididos pelo banco**, nunca aceitos do cliente — precisamente porque uma
requisição forjada direto contra a API do Supabase não pode mentir sobre eles.

## 2.6 O que o `/app` é hoje

`src/app/app/page.tsx`, 53 linhas: nome, e-mail, botão de sair. O comentário do
arquivo (linhas 12-24) diz que a minimalidade é de propósito. ADR-029 confirma
que **é aqui que o hub cresce** ("o hub é o `/app` privado"), então o passo 3
deste plano não contraria uma decisão anterior — ele executa uma.

---

# 3. A decisão a fechar — como o Representative nasce a partir do User

**Esta seção não decide. Ela expõe as duas opções com o custo real de cada
uma.** A decisão é do Pedro.

## 3.0 O fato que domina a escolha

`representatives` tem **duas colunas `NOT NULL` sem fonte nenhuma no cadastro
atual**:

| Coluna | Fonte no signup de hoje | O que ela é |
|---|---|---|
| `display_name` | ✅ `full_name` | Nome público na página |
| `license_id` | ❌ **nenhuma** | ID de licenciado iGreen, impresso literalmente na página: *"Licenciado Autorizado iGreen Energy · ID {licenseId}"* (`licensee-identification-block.tsx:40`, cópia portada de compliance) |
| `slug` | ❌ **nenhuma** | O subdomínio público (`<slug>.setnar.com`, ADR-026), único, e que a regra 12 do `DOMAIN_MODEL` diz pra **não mudar depois de publicado** |
| `company_id` | ❌ **nenhuma** | FK obrigatória; hoje nem existe linha em `companies` |

Qualquer opção tem que dizer o que faz com essas três. Não existe caminho em
que elas se resolvam sozinhas.

## 3.1 Opção A — trigger `SECURITY DEFINER` no signup (espelhando ADR-011)

Um segundo trigger em `auth.users` (ou uma extensão do `handle_new_user()`,
via nova migration — a antiga não se edita) insere a linha de
`representatives` na mesma transação.

**A favor:**
- Atomicidade real: nunca existe User sem Representative. Mesmo argumento que
  ADR-011 já validou e que este projeto já confia.
- Zero código de aplicação novo. Nenhuma tela, nenhuma Server Action, nenhuma
  policy de escrita — o trigger roda como owner.
- Todo consumidor de `/app` pode assumir que a linha existe, sem estado
  "ainda não é representante" espalhado pela UI.
- Custo de reversão baixo em código: dropar um trigger é uma migration de uma
  linha (o próprio ADR-011 diz isso).

**Contra — e aqui está o peso real:**
1. **`license_id` não tem como ser inventado.** As saídas são: (a) o trigger
   grava um placeholder (`''`, `'PENDENTE'`) e a página pública passa a exibir
   *"Licenciado Autorizado iGreen Energy · ID PENDENTE"* — texto de compliance
   com valor falso, o oposto do que o bloco existe pra fazer; (b) uma migration
   torna a coluna nullable, alterando o contrato de uma tabela da Sprint C e
   forçando a página a tratar null nesse bloco; ou (c) o campo entra no
   formulário de cadastro, e aí o signup deixa de ser "nome, e-mail, senha" e
   vira um formulário específico de representante iGreen — decisão de produto,
   não de implementação.
2. **`slug` é URL pública permanente gerada sem o dono ver.** Derivar de
   `full_name` dentro do Postgres exige, em plpgsql: normalizar acentos (a
   extensão `unaccent` **não está instalada**), lidar com colisão (dois "João
   Silva" → laço de sufixo), e ainda assim entrega ao representante um endereço
   que a regra 12 diz pra não trocar depois. O comentário da própria migration
   (linhas 136-139) já avisa que validar palavra reservada (`www`, `api`,
   `app`, `admin`) é *"a self-service-registration concern (validate at the
   application layer when that flow is built)"* — este é exatamente esse fluxo,
   e o trigger é a camada onde essa validação não existe.
3. **`company_id` vira "todo mundo é iGreen", escrito no banco.** O trigger
   teria um `select id from companies where slug = 'igreen'` embutido. Isso
   contraria o `DOMAIN_MODEL` §2 (*"iGreen é o primeiro tenant, não um template
   em volta do qual o negócio foi construído"*) num lugar difícil de auditar. E
   acopla: **se o seed do passo D1 não tiver sido aplicado num ambiente, o
   `select` não acha nada, o insert falha, a transação inteira faz rollback e o
   cadastro para de funcionar** — com um erro de Postgres virando um
   `AuthErrorCode` genérico pro usuário final.
4. **Assa "todo User é Representative" no trigger de `auth.users`.** É a
   suposição que o `DOMAIN_MODEL` §3 ("User") separa de propósito pro Stage 5.
   Dropar o trigger depois é barato; migrar as linhas de representante que não
   deviam ter sido criadas, não.

**Variante A′ (híbrida), honesta sobre o que ela resolve:** trigger cria uma
linha *incompleta* (slug provisório, `license_id` nullable), e uma tela de
onboarding depois preenche e confirma. Isso **não elimina o trabalho da opção
B** — a tela, a validação de slug, o caminho de escrita continuam necessários —
e adiciona por cima o acoplamento dos itens 3 e 4. Vale registrar como
considerada e por que não compensa, não como meio-termo confortável.

## 3.2 Opção B — passo explícito de onboarding pós-login

`/app` detecta a ausência de linha em `representatives` e renderiza um
formulário de onboarding (slug desejado, `license_id`, telefone, cidade). Uma
Server Action grava via função `SECURITY DEFINER` (`register_representative`),
mesmo formato de `submit_lead`.

**A favor:**
- `license_id` e `slug` vêm do humano que sabe os valores. Sem placeholder,
  sem cópia de compliance mentindo.
- A validação de slug (formato, unicidade, palavra reservada) acontece na
  camada que a própria migration diz ser a certa — com Zod, mensagem de erro em
  português e a chance de o representante escolher o próprio endereço antes de
  ele virar permanente.
- `company_id` é uma escolha explícita (hoje: default único; Stage 5: seleção)
  — sem "todo mundo é iGreen" enterrado num trigger.
- User ≠ Representative continua verdadeiro por construção. O admin do Stage 5
  simplesmente não completa o onboarding. Zero migração de dados quando isso
  chegar.
- Signup continua funcionando mesmo em ambiente sem catálogo semeado — a falha
  fica contida na tela de onboarding, visível e recuperável, em vez de derrubar
  a criação de conta.

**Contra:**
- Precisa de caminho de escrita novo (função `SECURITY DEFINER` ou policy de
  INSERT em `representatives` — §2.2, lacuna 3), UI nova, schema Zod novo,
  Server Action nova. É mais código do que a opção A.
- Existe uma janela real "User autenticado sem Representative". Todo consumidor
  de `/app` precisa tratá-la. **Não é o órfão do ADR-011** — lá o órfão era
  corrupção causada por falha entre duas chamadas; aqui é um estado legítimo e
  previsto —, mas ainda é um branch a mais em toda tela nova.
- Um usuário pode criar conta e nunca completar o onboarding. Isso é dado
  parcial no banco (um `profiles` sem `representatives`), aceitável, mas
  precisa ser reconhecido em vez de descoberto depois.

## 3.3 Onde eu chego, sabendo que a inclinação declarada é o trigger

**Recomendo a opção B**, e o motivo é só um: a opção A não elimina a tela de
onboarding — ela só adia. Como `license_id` e `slug` não têm fonte no cadastro,
qualquer versão do trigger cria uma linha que **ainda não pode publicar** até
alguém preencher o resto numa tela. Ou seja, o trabalho da opção B é feito de
qualquer jeito, e a opção A cobra por cima disso o acoplamento "todo User é
iGreen Representative" dentro de um trigger em `auth.users`.

O paralelo com ADR-011 é sedutor mas não fecha: lá, o trigger tinha **todos os
dados de que precisava** (`full_name` do metadata; `tenant_id`/`terms_*`
decididos pelo próprio banco de propósito). Aqui ele não tem — e o que falta é
justamente o campo que a página imprime como identificação legal do
licenciado.

Se a decisão for A mesmo assim, o plano do §4 continua válido: só o passo D3
muda de forma, e D3.A está descrito com o mesmo nível de detalhe que D3.B.

**Decisão fechada (2026-08-01): Opção B.** Confirmado pelo Pedro, seguindo a
recomendação acima. D3 prossegue pelos sub-passos de D3.B (§4) —
`register_representative()` como onboarding explícito pós-login, mesmo
formato `SECURITY DEFINER` do `submit_lead`. D3.A fica registrado como
alternativa não escolhida, não como trabalho pendente.

---

# 4. Plano de implementação, em passos pequenos

Cada passo é revisável e testável isoladamente, na ordem. Nenhum depende de
código de um passo posterior. Processo por passo, o mesmo do lead capture:
**auditar → Pedro revisa → implementar → `npm run verify` → ADR no
`README.md` + entrada em `supabase/README.md`.**

## D1 — Seed do catálogo iGreen (Company + 7 Products)

**Migration nova:** `supabase/migrations/20260803000000_seed_igreen_catalog.sql`.
Nenhuma migration já aplicada é tocada (regra do `README.md:233-237`).

### D1.1 — Migration SQL direta ou script separado? Migration.

Não é preferência, é o que a arquitetura permite:

- `companies` e `products` **não têm policy de INSERT**. Um script Node
  precisaria de service role key pra escrever — e **este projeto deliberadamente
  não tem uma** (`20260728000000` cabeçalho, `supabase/README.md`). Introduzir
  uma só pra semear 8 linhas reabre a superfície que o projeto inteiro foi
  construído pra evitar.
- O `package.json` não tem a CLI do Supabase como dependência; `scripts/` tem um
  arquivo só (`require-integration-env.mjs`). Não há infra de seed pra
  reaproveitar — um script seria infra nova inteira.
- O `supabase/README.md` já é uma lista numerada de "cole este arquivo no SQL
  Editor, nesta ordem". Um seed por migration entra como **passo 7** dessa
  lista, no mesmo fluxo, sem processo paralelo.
- Migration é histórico versionado e ordenado; script é estado que ninguém sabe
  se rodou.

**Custo aceito, declarado:** mudar o `name` de um produto depois vira migration
nova (`update ... where slug = ...`). Pra um catálogo fixo de 7 linhas isso é
barato. Se o catálogo virar editável, isso é superfície de administração
(Stage 5), não um script.

### D1.2 — O dado exato a semear

Company (uma linha):

| coluna | valor | fonte |
|---|---|---|
| `name` | `iGreen Energy` | `DOMAIN_MODEL.md:41, 308`; `setnar.tenant.ts:52` (`vertical.internalName`) |
| `slug` | `igreen` | `setnar.tenant.ts:51` (`vertical.id`) |

Products (7 linhas, `company_id` = a acima). Slugs **não são escolha deste
plano** — são os do comentário da migration (linha 200), os mesmos que
`tests/route-collision-guard.test.ts` já parseia e que
`[productSlug]/page.tsx` resolve. `name` vem do `<title>` de cada template:

| slug | name proposto | template (fonte) |
|---|---|---|
| `conexao-green` | Conexão Green | `ConexaoGreen/index.html` |
| `conexao-club` | Conexão Club | `ConexaoClub/index.html` |
| `conexao-livre` | Conexão Livre | `ConexaoLivre/index.html` |
| `conexao-placas` | Conexão Placas | `ConexaoPlacas/index.html` |
| `conexao-solar` | Conexão Solar | `ConexaoSolar/index.html` |
| `green-seguros` | **⚠ ver abaixo** | `GreenSeguros/index.html` |
| `telecom` | iGreen Telecom | `Telecom/index.html` |

**⚠ Divergência real a decidir antes de semear, não silenciar:** o slug é
`green-seguros`, o `DOMAIN_MODEL.md:59` chama de *"iGreen Seguros"*, e o
`<title>` do template diz *"iGreen Auto Mensal | Seguro de carro por
assinatura"*. São três nomes pra uma linha só. O `name` **é renderizado
publicamente** (`[productSlug]/page.tsx:70,72` — como eyebrow e como `<h1>`),
então é cópia de face pro cliente, não rótulo interno. Proposta: `iGreen
Seguros` (nome do produto no catálogo) e não `iGreen Auto Mensal` (nome de uma
oferta específica dentro dele) — mas isso é chamada do Pedro. Mesma pergunta,
menor, pra `telecom`: `iGreen Telecom` (com marca) vs. `Telecom`.

**Nota de compliance, não bloqueante:** semear "iGreen Energy" numa tabela com
SELECT público é seguro hoje porque **nada no app lê `companies`**. Mas
`setnar.tenant.ts:53` registra que a marca de terceiro é *omitida de propósito*
do site do SETNAR. Se algum dia o `companies.name` for exibido, isso é decisão
de produto/compliance (`README.md` §Compliance), não consequência automática
deste seed.

### D1.3 — Forma da migration

- `insert ... on conflict (slug) do nothing` na company; `on conflict
  (company_id, slug) do nothing` nos produtos — reaplicar é seguro (as
  UNIQUE já existem, linhas 112 e 211).
- Produtos referenciam a company por `(select id from companies where slug =
  'igreen')`, nunca por UUID digitado à mão.
- **Sub-decisão a levantar:** UUID fixo e literal pra company e pros 7 produtos
  (mesmo `id` em dev, staging e prod — facilita depuração e deixa migrations
  futuras referenciarem por id) vs. `gen_random_uuid()` (ids diferentes por
  ambiente). Inclino pra UUID literal, dado que é catálogo fixo. Custo de
  reversão: alto depois que houver `product_activations` apontando pra eles —
  por isso decidir agora, não depois.

### D1.4 — Teste e verificação

- Teste novo (mesma técnica do `route-collision-guard.test.ts`, que já lê os
  slugs do comentário da migration em vez de re-digitá-los): parsear o arquivo
  de seed e afirmar que o conjunto de slugs inseridos é **exatamente** o do
  comentário. Impede que seed e resolvedor de rota divirjam em silêncio.
- Manual: aplicar no SQL Editor, `select slug, name from products` → 7 linhas.
- Docs: passo 7 no `supabase/README.md`; ADR-037 no `README.md`.

**Não depende de nada. Pode ser implementado e revisado sozinho, hoje.**

---

## D2 — Visibilidade das próprias linhas (as lacunas de RLS do §2.2)

**Migration nova**, só policies, zero código de aplicação:

- `representatives_select_own` — `using (profile_id = auth.uid())`.
- `product_activations_select_own` — `using (exists (select 1 from
  representatives r where r.id = product_activations.representative_id and
  r.profile_id = auth.uid()))`, mesmo formato de `leads_select_own`
  (linhas 314-323), que é o precedente exato a copiar.

**Por que separado e antes de D3/D5:** policies permissivas se somam com OR no
Postgres, então nada da leitura pública muda — é adição pura, revisável em
isolamento, e **os dois passos seguintes são impossíveis sem ela** (§2.2,
lacunas 1 e 2). Também vale independentemente de qual opção do §3 vencer.

**Verificação manual:** com sessão de um representante *sem* ativação
publicada, `select * from representatives` retorna a própria linha (hoje
retorna zero); com sessão de outro representante, retorna zero linhas da
primeira. Esse segundo teste é o que prova que a policy não vazou.

---

## D3 — Provisionamento do Representative (forma depende do §3)

### D3.A — se a decisão for o trigger

1. Migration: `handle_new_representative()` `SECURITY DEFINER`, trigger
   `after insert on auth.users` (ordem em relação ao `on_auth_user_created`
   importa — `representatives.profile_id` referencia `profiles(id)`, então o
   profile precisa existir antes; nomes de trigger disparam em ordem
   alfabética no Postgres, o que **precisa ser verificado explicitamente, não
   presumido**).
2. Resolver, dentro da migration e documentado no cabeçalho dela: origem do
   `license_id`, geração e desambiguação do `slug`, e o `select` de
   `company_id` — os três itens do §3.1.
3. Decidir e documentar o comportamento quando o seed do D1 não existe: falha
   dura (rollback do cadastro) ou trigger tolerante.
4. Ainda assim será necessária uma tela de edição de perfil (D5b) pra completar
   o que o trigger não pôde preencher.

### D3.B — se a decisão for onboarding explícito (recomendado)

Sub-passos, cada um revisável:

- **D3.B.1 — Migration:** `register_representative(p_slug, p_license_id,
  p_phone, p_city)` `SECURITY DEFINER`, mesmo formato de `submit_lead`
  (`20260801000000`). Regras dentro da função, não no cliente: `company_id`
  resolvido no banco (nunca aceito do chamador — mesmo princípio do
  `tenant_id` no `handle_new_user`, ADR-011); `display_name` copiado de
  `profiles.full_name` (denormalização do ADR-027, feita no ponto de escrita);
  rejeita se `auth.uid()` já tiver representante; valida formato do slug com o
  mesmo regex do CHECK; retorna resultado tipado (criado / slug em uso /
  já existe) sem vazar qual slug pertence a quem.
  ⚠ **Aprender com ADR-036:** nenhum parâmetro do chamador pode governar
  regra — a função é `grant execute to authenticated`, e ADR-036 é justamente o
  caso em que parâmetro de chamador em função `SECURITY DEFINER` virou
  vulnerabilidade real. Lista de palavras reservadas fica **dentro** da função
  (ou em CHECK), não como argumento.
- **D3.B.2 — Domínio + porta:** estender `RepresentativeRepository` com
  `findByProfileId(profileId)` e `register(...)`, ou criar uma porta separada
  de escrita. **A levantar:** a porta atual tem doc comment dizendo que é a
  porta de *resolução pública*; misturar escrita autenticada nela pode ser
  errado. Inclino por um segundo port (`RepresentativeOnboardingGateway`) pelo
  mesmo raciocínio do ADR-031 (dois ports porque as naturezas diferem:
  leitura anônima pública vs. escrita autenticada).
- **D3.B.3 — Infra + factory:** adaptador Supabase + factory `server-only`,
  cliente por chamada, sem cache de módulo (§2.4).
- **D3.B.4 — Presentation:** schema Zod (regex de slug e limites vindos de um
  `representative-rules.ts` no domínio, nunca literais na tela — mesmo padrão
  de `auth-rules.ts`), Server Action via `safeAuthCall`, formulário de
  onboarding no `/app`.
- **D3.B.5 — `/app` trata os dois estados:** sem representante → onboarding;
  com → o hub (D5).

**Testes:** unitários com adaptador em memória (unicidade de slug, palavra
reservada, dupla submissão); integração atrás de `require-integration-env.mjs`,
como `lead-submission.integration.test.ts` já faz.

---

## D4 — Caminho de escrita da ativação de produto

**Migration nova.** A invariante a garantir é a regra 6 / constraint 6 do
`DOMAIN_MODEL`: *"uma Product Activation referenciando um Product fora do
Catalog da própria Company do Representative nunca deve existir"*.

**A levantar (duas formas legítimas):**

- **Policy de INSERT/UPDATE com `WITH CHECK`** — escopo por
  `auth.uid()` + um `exists` provando que `products.company_id =
  representatives.company_id`. Mantém RLS como ponto único de decisão e é o
  idiomático quando o chamador **é** autenticado (diferente de `submit_lead`,
  que existe porque o chamador é anônimo).
- **Funções `SECURITY DEFINER`** (`activate_product` / `set_activation_status`)
  — mais próximo do que o projeto já escreveu três vezes, e pode fazer
  validações que policy não expressa bem.

Inclino pela **policy**, exatamente porque o caso não tem o motivo que gerou as
funções anteriores (acesso anônimo). Mas a regra 10 ("publicar exige perfil
completo") pode empurrar pra função — decidir junto com D6.

Também aqui: transição `draft`/`published`/`unpublished` deve manter
`published_at` coerente (trigger ou a própria função).

---

## D5 — UI mínima de ativação dentro de `/app`

Depende de D1, D2, D4 (e D3). Sem componente novo de design system —
`Card`, `Button`, `Badge` já existem.

- **D5.1 — Listar catálogo + estado:** Server Component lendo `products` da
  própria company (SELECT público já cobre) e as próprias `product_activations`
  (D2). Renderiza os 7 produtos com estado: não ativado / rascunho / publicado.
- **D5.2 — Ativar/desativar:** Server Actions chamando D4. Feedback de erro em
  português, sem mensagem técnica (`ENGINEERING_GUIDELINES`).
- **D5.3 — Link da página + estado de publicação:** mostrar
  `<slug>.setnar.com/<produto>` de cada ativação publicada. Sem QR Code, sem
  analytics — Stage 1 tem esses itens, mas não são este elo.
- **D5b — Edição de perfil do representante (passo que o briefing não lista e
  sem o qual a cadeia não fecha):** hoje **não existe nenhuma UI que grave
  `phone`, `city`, `avatar_url` ou `license_id`**. Sem isso, mesmo com tudo
  acima pronto, nenhuma página pode satisfazer a regra 7. Precisa de
  `grant update (colunas)` + policy escopada por coluna — a receita que o
  comentário da `20260728000000` (linhas 31-40) já prescreve e que o
  `WhatsappCta` torna obrigatória na prática: **sem `phone`, o botão de
  WhatsApp simplesmente não renderiza** (ADR-035) — uma "Commercial Page" sem
  CTA não é uma Commercial Page.

---

## D6 — O que falta pro Commercial Page realmente "publicar"

Estado real de cada precondição, hoje:

| Precondição | Fonte | Estado | O que falta |
|---|---|---|---|
| Pelo menos uma ativação | Regra 10 | Modelado (`product_activations.status`) | Só o caminho de escrita — D4/D5 |
| Perfil completo: **nome** | Regra 7 | ✅ `display_name` NOT NULL | — |
| Perfil completo: **telefone** | Regra 7 | ⚠ nullable, e sem UI de escrita | D5b + decidir se é obrigatório pra publicar (ADR-035 diz que sem ele não há CTA → na prática é obrigatório) |
| Perfil completo: **foto** | Regra 7 | ❌ `avatar_url` nullable, **sem Storage, sem upload, e nunca renderizado em lugar nenhum** | Decisão: exigir foto pra publicar (aí precisa de bucket + upload, passo próprio, fora deste plano) ou **não** exigir enquanto nada a exibe. Inclino por não exigir agora e registrar o desvio da regra 7 explicitamente |
| Subscription ativa | Regra 21 / ADR-033 | ❌ `subscriptions` tem **zero policies**, `is_subscription_active()` não existe, e **nada cria linha de subscription** pra um representante novo | Lacuna conhecida e já documentada (`representative-repository.ts:8-21`). Passo D7 separado |

**Ou seja:** depois de D1–D5, `[productSlug]/page.tsx` e `/api/leads` passam a
funcionar ponta a ponta com dado criado pelo produto, e não mais só com dado
semeado à mão. **A publicação ainda ignora cobrança por completo** — isso não é
regressão (é o estado documentado de hoje), mas passa a ter consequência real
no dia em que houver representante de verdade. Deve ser dito em voz alta no ADR
do D5, não descoberto depois.

## D7 — (fora do elo, listado pra não sumir) Subscription

`is_subscription_active(uuid)` `SECURITY DEFINER` — a função que a nota de RLS
da `20260731000000` (linhas 79-91) já esboça — mais criar a linha de
`subscriptions` no provisionamento (D3), mais o gate na publicação. Não faz
parte de "fechar o elo"; faz parte de "cobrar por ele".

---

# 5. Ordem, e o que revisar em cada etapa

| Passo | Depende de | Toca app? | Revisável sozinho |
|---|---|---|---|
| D1 — seed do catálogo | — | não | ✅ |
| D2 — RLS de leitura própria | — | não | ✅ |
| D3 — provisionamento | §3 decidido, D1, D2 | A: não / B: sim | ✅ |
| D4 — escrita da ativação | D2 (D3 pra testar) | não | ✅ |
| D5 — UI de ativação | D1–D4 | sim | ✅ |
| D5b — edição de perfil | D2 | sim | ✅ |
| D6 — gate de publicação | D4, D5b | sim | ✅ |
| D7 — subscription | D3 | sim | ✅ (fora de escopo deste elo) |

**D1 e D2 não dependem da decisão do §3** e podem começar assim que este plano
for aprovado.

Por passo: `npm run verify` (typecheck + lint + test + integração + build), ADR
novo no `README.md` (numeração continua em **ADR-037** — o último é ADR-036),
entrada nova na lista numerada do `supabase/README.md` pra cada migration, e um
roteiro de verificação manual no formato que aquele arquivo já usa ("**Observar:**
…"), já que nada aqui é exercitado automaticamente contra um Supabase real.

**Não coberto por este plano, de propósito:** QR Codes, analytics, dashboard de
KPIs, upload de imagem, `templates/commercial-pages/` (intocado), e qualquer
alteração em migration já aplicada.
