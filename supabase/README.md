# Supabase — setup manual

Passos que só podem ser feitos no painel do Supabase ou na Vercel, fora do
alcance do código e das migrations versionadas neste repositório. Nenhum
deles usa a service role key — ela não entra no projeto nesta sprint.

## 1. Aplicar as migrations, nesta ordem, todas as onze

São cumulativas — aplique as onze, em ordem, nunca só a primeira. Cole cada
arquivo no SQL Editor do projeto e execute, ou rode `supabase db push` se
preferir a CLI.

> **Parar no passo 8 deixa o banco quebrado, não incompleto.** A `20260804000000`
> fecha um ciclo de RLS entre `representatives` e `product_activations` que faz
> as duas tabelas responderem `42P17 infinite recursion detected in policy` para
> **qualquer** chamador da chave publicável — anônimo inclusive. O passo 9 é a
> correção; não é opcional e não é uma melhoria. Detalhes no item 9 abaixo.

1. `supabase/migrations/20260728000000_create_profiles.sql` — cria
   `profiles`, `login_attempts`, as funções `current_terms_version()`,
   `handle_new_user()`, `is_login_blocked()`, `record_login_failure()`,
   `clear_login_attempts()`, e os triggers/policies associados.
2. `supabase/migrations/20260729000000_fix_login_attempts_cleanup.sql` —
   **corrige uma vulnerabilidade real, não é opcional.** A versão de
   `record_login_failure()` criada no passo 1 usa
   `now() - make_interval(secs => p_window_seconds)` — vindo direto do
   parâmetro do chamador — como corte de limpeza da tabela inteira, sem
   filtrar por `email_hash`/`ip_hash`. Chamar a RPC com `p_window_seconds =
   0` (ou negativo) colapsa esse corte para "agora", apagando **todas as
   linhas de `login_attempts`, de todo mundo**, numa única chamada. A função
   é `grant execute to anon`: qualquer portador da chave publicável (que é
   pública por natureza) pode zerar o rate limiter de login de todos os
   usuários do SETNAR sem autenticação nenhuma. Reproduzido pelos autores da
   migration contra um projeto descartável antes de escrever a correção —
   ver o cabeçalho do próprio arquivo. **Um ambiente que aplicar só o passo
   1 acima fica com essa vulnerabilidade aberta**, mesmo que todo o resto
   deste README seja seguido corretamente.
3. `supabase/migrations/20260730000000_scope_login_attempts_cleanup_by_identity.sql`
   — hygiene, não é uma correção de vulnerabilidade (o próprio cabeçalho do
   arquivo diz isso explicitamente): a limpeza da migration anterior já
   usava uma retenção fixa de 1 dia, independente de entrada do chamador;
   esta migration só restringe quais linhas cada chamada varre/apaga (por
   identidade, em vez da tabela inteira), reduzindo I/O desnecessário. Não
   corrige nada que a `20260729` já não tivesse fechado — mas como a `create
   or replace function` de uma substitui inteiramente a anterior, pular
   direto para esta sem passar pela `20260729` deixaria a vulnerabilidade
   real aberta de novo (a `20260730` não reintroduz o parâmetro
   caller-controlled, mas assume a correção anterior como base — aplique-as
   em ordem, não isoladamente).
4. `supabase/migrations/20260731000000_create_representative_domain.sql` —
   cria as tabelas do domínio do Representante (Sprint C, ver
   `docs/DOMAIN_MODEL.md` §7): `companies`, `representatives`, `products`,
   `product_activations`, `subscriptions`, `leads`. Schema apenas — sem seed
   data, sem código de aplicação. Todas as seis tabelas têm RLS habilitado,
   sem exceção; `companies` e `products` têm SELECT público (`using
   (true)`) — nome/slug sem sensibilidade por request. `representatives` só
   expõe via SELECT público as linhas com `status = 'active'` **e** que
   tenham ao menos uma `product_activations` com `status = 'published'` —
   nunca a tabela inteira, para não permitir um único `GET` sem sessão
   vazando telefone/cidade/license_id de representantes que ainda não têm
   página pública. `product_activations` segue o mesmo princípio, expondo
   só `status = 'published'`, nunca `draft`/`unpublished`. `subscriptions`
   fica com RLS habilitado e **zero policies** — mesmo padrão de
   `login_attempts` (passo 1 acima): só alcançável por uma função
   `SECURITY DEFINER` futura, ainda não escrita nesta migration. `leads` tem
   SELECT restrito ao representante dono (via `profile_id = auth.uid()`,
   mesmo formato de `profiles_select_own`) e nenhuma policy de INSERT — a
   captura de lead é trabalho futuro, via API route com rate limiting. Ver
   o comentário no topo do próprio arquivo para o raciocínio completo de
   cada policy, incluindo por que `representatives_select_public` só pôde
   ser criada depois de `product_activations` existir no arquivo.
5. `supabase/migrations/20260801000000_add_lead_submission.sql` — cria
   `lead_submission_attempts` (RLS habilitado, zero policies) e a função
   `submit_lead()`, `SECURITY DEFINER`, mesmo padrão de
   `is_login_blocked`/`record_login_failure` (passo 1 acima): checa o
   rate limit por IP, valida que existe uma `product_activations`
   `published` pro par (representative, product) recebido, insere em
   `leads` e registra a tentativa — tudo numa função só, atomicamente. Não
   introduz uma segunda variável de salt: reaproveita `LOGIN_ATTEMPT_SALT`
   (seção "Variáveis de ambiente na Vercel" abaixo) pro hash do IP. Ver
   ADR-034 no `README.md` principal
   para o raciocínio completo, incluindo por que é uma função só (não três,
   como no login) e por que só IP é limitado (não um segundo eixo de
   identidade). **A versão criada aqui tem uma vulnerabilidade real, corrigida
   no próximo passo — não pare nesta migration.**
6. `supabase/migrations/20260802000000_fix_submit_lead_rate_limit.sql` —
   **corrige uma vulnerabilidade real, não é opcional**, mesma classe da
   corrigida no passo 2 acima: a versão de `submit_lead()` criada no passo 5
   aceitava `p_max_attempts_ip`/`p_window_seconds` como parâmetros do
   chamador, e a função é `grant execute to anon`. Qualquer portador da chave
   publicável podia chamar o RPC direto (sem passar por `/api/leads`, sem o
   Zod, sem o honeypot) com um threshold inflado (`p_max_attempts_ip:
   999999`) e inserir em `leads` sem limite nenhum — pior que o bug do passo
   2 porque, além de burlar um limite, insere dados de negócio direto.
   Reproduzido pelos autores da migration contra um projeto descartável antes
   de escrever a correção: 8 chamadas diretas seguidas, mesma origem, 8
   inserções bem-sucedidas — ver o cabeçalho do próprio arquivo e ADR-036 no
   `README.md` principal para o repro completo, incluindo um segundo achado
   (nenhuma validação de formato/tamanho a nível SQL) corrigido na mesma
   migration. **Um ambiente que aplicar só o passo 5 acima fica com essa
   vulnerabilidade aberta**, mesmo que todo o resto deste README seja seguido
   corretamente. `supabase-lead-gateway.ts` foi atualizado no mesmo commit
   para a assinatura nova (9 parâmetros, sem os dois removidos) — nenhum
   outro chamador de `submit_lead` existe.
7. `supabase/migrations/20260803000000_seed_igreen_catalog.sql` — **a única
   migration deste diretório que insere dado, não schema.** Semeia a Company
   iGreen Energy (slug `igreen`) e os 7 Products do Stage 1 (`conexao-green`,
   `conexao-club`, `conexao-livre`, `conexao-placas`, `conexao-solar`,
   `green-seguros`, `telecom`) — as linhas que a `20260731000000` (passo 4)
   deliberadamente não criou ("Schema only — no seed data"). Sem isso, **o
   catálogo está vazio e nenhuma Commercial Page pode existir**: tanto
   `[productSlug]/page.tsx` quanto `submit_lead` dependem de uma linha de
   `products` existir. É seed por migration, e não por script, porque
   `companies`/`products` não têm policy de INSERT e este projeto não tem
   service role key — um script precisaria de uma chave que ignore RLS; o SQL
   Editor já conecta como dono das tabelas. Ver ADR-037 no `README.md`
   principal para o raciocínio completo, incluindo por que os 8 UUIDs são
   literais fixos (documentados no cabeçalho da própria migration) e por que
   `green-seguros` foi semeado como "iGreen Seguros" e não "iGreen Auto
   Mensal". Reaplicar é seguro: `on conflict ... do nothing` nos dois inserts.
   A migration termina com um bloco `do $$` que levanta exceção se a contagem
   final não for exatamente 7 produtos — se você vir esse erro, a Company não
   foi semeada antes dos produtos; releia o cabeçalho do arquivo.
   **Verificação:** `select p.slug, p.name from products p join companies c on
   c.id = p.company_id where c.slug = 'igreen' order by p.slug;` — devem vir
   as 7 linhas acima, e nenhuma a mais.
8. `supabase/migrations/20260804000000_add_own_row_select_policies.sql` — só
   policies, nenhum dado, nenhuma tabela. Cria `representatives_select_own` e
   `product_activations_select_own`, fechando uma lacuna real: **antes desta
   migration, um representante autenticado não conseguia ler a própria linha
   de `representatives`.** A única policy de SELECT daquela tabela
   (`representatives_select_public`, passo 4) exige `status = 'active'` **e**
   uma ativação já `published` — um representante recém-criado não satisfaz
   isso, então a consulta devolvia zero linhas para ele mesmo. O mesmo vale
   para as próprias ativações em `draft`. Não afrouxa nada do que já era
   público: policies permissivas se somam com OR, e sem sessão `auth.uid()` é
   null, então nenhuma das duas casa com linha nenhuma para o visitante
   anônimo. Ver ADR-038 no `README.md` principal. **Verificação manual
   obrigatória — as duas pontas, na seção própria mais abaixo neste arquivo.**
   **Não pare aqui: aplicada sozinha, esta migration quebra as duas tabelas —
   ver o passo 9.**
9. `supabase/migrations/20260805000000_fix_rls_policy_cycle.sql` — **corrige um
   bug real introduzido pelo passo 8, não é opcional.** `product_activations_select_own`
   (passo 8) consulta `representatives` dentro do seu `exists`, e
   `representatives_select_public` (passo 4) já consultava `product_activations`
   dentro do dela: cada tabela passou a ter uma policy de SELECT que depende da
   outra. RLS **é** aplicada dentro da subconsulta de uma policy, então o
   Postgres detecta o ciclo e aborta. Reproduzido no projeto de teste com os
   passos 1-8 aplicados, via PostgREST com a chave publicável (nunca o SQL
   Editor, que conecta como dono e ignora RLS): `GET /rest/v1/representatives`
   → HTTP 500 `{"code":"42P17","message":"infinite recursion detected in policy
   for relation \"representatives\""}`, e o mesmo em `product_activations` e em
   `leads` (cuja `leads_select_own` também consulta `representatives`). Vale
   para o visitante **anônimo** tanto quanto para o autenticado — ou seja,
   **toda Commercial Page para de resolver**, e de forma silenciosa:
   `SupabaseRepresentativeRepository` descarta o `error` e
   `[productSlug]/page.tsx` serve um 404 comum, sem erro e sem log (confirmado
   com `curl -H 'Host: joao-silva.setnar.com' localhost:3000/conexao-green` →
   HTTP 404). A correção quebra o ciclo movendo o `exists` do passo 8 para
   `is_own_representative(uuid)`, `security definer` — o mesmo mecanismo de
   ADR-011/ADR-012 — e recria a policy sobre ela; nada do comportamento
   pretendido pelo passo 8 muda. O cabeçalho da migration também registra a
   correção de uma afirmação errada no comentário da `20260804000000` (linhas
   76-80), que dizia que RLS não se aplica dentro do `exists` de uma policy.
   **Verificação:** `tests/rls-policy-cycle.integration.test.ts` (roda em
   `npm run test` com `.env.local` configurado) — vermelho antes desta
   migration, verde depois.
10. `supabase/migrations/20260806000000_add_register_representative.sql` —
    passo D3.B.1 (`docs/SPRINT_D_PLAN.md` §4/D3.B, Opção B): cria
    `register_representative(p_slug, p_display_name, p_license_id, p_phone,
    p_city)`, `SECURITY DEFINER`, `grant execute` só para `authenticated`
    (**nunca** `anon` — ao contrário de `submit_lead`; ver o cabeçalho da
    migration), e a CHECK constraint `representatives_slug_not_reserved`
    sobre `representatives.slug`. É a primeira escrita self-service em
    `representatives`: resolve `company_id` no servidor (nunca aceito do
    chamador), rejeita com resultado tipado se `auth.uid()` já tiver
    representante (pré-checagem e uma corrida de fato coberta por captura de
    `unique_violation`, não só a pré-checagem), valida `p_slug` contra o
    mesmo regex do CHECK `representatives_slug_format` e contra a lista de
    palavras reservadas, e valida forma (não regra de negócio) de
    `p_display_name`/`p_license_id`/`p_phone`/`p_city`. Ver ADR-040 no
    `README.md` principal para o raciocínio completo, incluindo os dois
    desvios do plano original (`p_display_name` como parâmetro novo; o
    aviso de bloqueador de lançamento sobre o formato de `license_id`).
    **Verificação:** `tests/register-representative.integration.test.ts`
    cobre só a rejeição anônima — o caminho autenticado (a maior parte do
    que esta função faz) é só manual, seção própria mais abaixo neste
    arquivo (**passo 10**).
11. `supabase/migrations/20260807000000_add_product_activation_write_path.sql`
    — passo D4 (`docs/SPRINT_D_PLAN.md` §4/D4): cria `activate_product(p_product_id)`
    e `set_activation_status(p_product_id, p_status)`, as duas `SECURITY
    DEFINER` e `grant execute` só para `authenticated` (**nunca** `anon`,
    mesma lógica de concessão do passo 10). Nenhuma policy nova, nenhuma
    tabela, nenhuma coluna. É o caminho de escrita que faltava: até esta
    migration, `product_activations` tinha RLS habilitado e **somente**
    policies de SELECT — nenhum INSERT/UPDATE/DELETE por caminho nenhum —,
    então quem terminava o onboarding do passo 10 **não conseguia colocar
    nenhuma página pública no ar**. `activate_product` cria a ativação em
    `draft` derivando o representante de `auth.uid()` (o chamador nunca nomeia
    `representative_id`) e recusa produto fora do catálogo da própria company
    (regra 6); `set_activation_status` aplica a máquina de transições
    (`draft`/`unpublished` → `published` passam pelo gate de publicação;
    `published` → `unpublished` sempre permitida; `draft` → `unpublished`
    rejeitada; qualquer destino `draft` rejeitado; mesmo-estado é sucesso
    idempotente) e mantém `published_at` (setado só na primeira publicação,
    nunca sobrescrito, nunca anulado). Gate de publicação, na ordem em que é
    avaliado: `representatives.status = 'active'`, `display_name` não vazio,
    `phone` não vazio — cada falha com razão própria, não um erro genérico.
    Ver ADR-043 no `README.md` principal para o raciocínio completo, incluindo
    por que são funções e não policies de INSERT/UPDATE, e os dois desvios
    conscientes do gate (foto não exigida; Subscription não checada — D7).
    **Verificação:** os dois mapeadores têm teste unitário
    (`tests/map-product-activation-result.test.ts`), mas **as funções SQL em
    si não têm teste automatizado nenhum** — a verificação é manual, seção
    própria mais abaixo neste arquivo (**passo 11**).

## 2. Confirm email — decidido: DESLIGADO

**Authentication → Providers → Email → "Confirm email" = desligado.**

Decisão de produto fechada (Sprint B), não mais um "a decidir" — ver ADR-022
no `README.md` principal para o raciocínio completo. Sem isso,
`auth.signUp()` não devolve uma sessão ativa na hora — a conta é criada mas
fica pendente de confirmação — e todo o fluxo pós-cadastro desta sprint
(redirect para `/app`) depende de uma sessão existir imediatamente após o
cadastro.

O estado `AuthPendingConfirmation`/`pending_confirmation` (ADR-016) **continua
no código de propósito**, como seam morto — não foi removido nem
simplificado. Ele volta a ser alcançável no dia em que este projeto tiver
SMTP próprio (o SMTP padrão do Supabase, usado hoje tanto para essa
confirmação quanto para a redefinição de senha — ADR-022 — compartilha um
teto de 2 e-mails/hora do projeto inteiro) e "Confirm email" for religado —
nesse momento o branch `awaitingConfirmation` em `sign-up-form.tsx` volta a
ser exercitável sem nenhuma mudança de código.

## 3. URL Configuration — Site URL e Redirect URLs

**Authentication → URL Configuration**, no painel do Supabase. Necessário
para o fluxo de redefinição de senha (ADR-022): sem isso configurado
corretamente, `resetPasswordForEmail()` ainda retorna sucesso e o e-mail é
enviado, mas o link dentro dele aponta para o lugar errado — silenciosamente,
sem erro em nenhum log, porque quando o `redirectTo` enviado pela aplicação
não bate com a allow-list, o Supabase troca o link pela Site URL sem avisar
([Redirect URLs — Supabase Docs](https://supabase.com/docs/guides/auth/redirect-urls):
*"Should the redirect parameter not fall in the URL allow list, the Site URL
is used"*). O usuário clica, cai na home (`/`), e nada acontece — não é um
bug de código, é a URL Configuration não batendo com o que a aplicação
realmente envia.

**O valor exato que este código envia** vem de `resolveResetCallbackUrl()`
(`modules/auth/presentation/actions.ts`), não de suposição:

```ts
async function resolveResetCallbackUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get('host') ?? 'localhost:3000';
  const protocol = headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}/auth/callback?next=/redefinir-senha`;
}
```

`host` vem do cabeçalho `Host` da requisição recebida — ou seja, o valor
muda conforme o domínio que serviu a página onde o usuário pediu a
redefinição: o domínio de produção numa requisição real, mas qualquer
preview da Vercel numa requisição vinda de lá. Isso significa que **um
único valor exato na allow-list não basta** — previews da Vercel usam um
subdomínio `*.vercel.app` diferente a cada deploy.

**Site URL:**

```
https://setnar.com
```

**Redirect URLs (adicionar todas):**

```
https://setnar.com/auth/callback
https://*-<team-or-account-slug>.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

Substitua `<team-or-account-slug>` pelo slug real do time/conta Vercel deste
projeto (visível na URL de qualquer deployment de preview já existente) — o
padrão com `*` é a forma de wildcard que a própria documentação do Supabase
usa para cobrir previews
([Redirect URLs — Supabase Docs](https://supabase.com/docs/guides/auth/redirect-urls),
exemplo: `https://*-<team-or-account-slug>.vercel.app/**`). Sem essa entrada,
todo teste feito a partir de uma preview branch cai silenciosamente na Site
URL — o mesmo sintoma do parágrafo acima, mas só nos ambientes de preview,
o que pode passar despercebido se a verificação manual (seção abaixo) só for
feita em produção.

## 4. Configurar Authentication → Rate Limits conscientemente

Sem o encaminhamento do IP real do visitante (não implementado nesta sprint —
ver ADR no `README.md` principal: exigiria uma chave de API secreta, fora de
escopo), **todo o tráfego da aplicação chega ao Supabase com o IP de uma
única função da Vercel.** O limite nativo de rate limiting do Supabase é,
hoje, a única defesa restante contra alguém chamando a API do Supabase
diretamente com a chave publicável (que é pública por natureza — o nosso
limiter em `login_attempts` só protege quem passa pelas nossas Server
Actions).

Isso cria uma troca real: um limite alto demais deixa esse caminho direto
pouco protegido; um limite baixo demais faz **todos os usuários legítimos do
SETNAR** — que dividem esse único IP de saída — se bloquearem mutuamente num
pico de tráfego normal. Escolha o valor com essa troca em mente e registre
aqui qual foi escolhido e por quê, para a próxima pessoa que mexer nisso:

Rate limit de sign-in/sign-up: 500/hora por IP. Padrão de 30 é inviável porque todo o tráfego da aplicação sai pelo IP único da função da Vercel — 30/h seria o teto de todos os licenciados somados, não por usuário. Mitigação parcial por construção: um limite que não derruba usuários legítimos também é permissivo com um atacante que bate direto no GoTrue. Defesa fina continua sendo o rate limiter por e-mail (auth-rules.ts, ADR-012). Próxima alavanca se aparecer abuso: CAPTCHA (Turnstile/hCaptcha) nos endpoints de auth, não reduzir este número. Revisitar se: usuários legítimos começarem a receber 429 em uso normal.

**Isso é mitigação PARCIAL, não uma segunda camada independente.** O limite
por IP do painel do Supabase é uma única alavanca compartilhada entre o IP de
saída da Vercel (todo o tráfego legítimo do SETNAR somado) e o IP de um
atacante chamando a API direto — porque, sem o encaminhamento do IP real
(ADR-013), os dois aparecem para o Supabase como a mesma origem. Calibrar
esse valor alto o bastante para não gerar 429 nos usuários legítimos
necessariamente também o torna permissivo para o atacante; não existe um
valor que resolva as duas pontas ao mesmo tempo com essa arquitetura. Se
abuso real aparecer depois de configurado, a próxima alavanca — ainda não
implementada — é CAPTCHA (Turnstile ou hCaptcha) nos endpoints de auth do
Supabase, que muda o custo por tentativa em vez de depender só de contagem
por IP, e também eleva o custo do lockout-por-e-mail descrito na ADR-018.

## 5. Variáveis de ambiente na Vercel

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
LOGIN_ATTEMPT_SALT=
```

As duas primeiras são as chaves públicas do projeto (Settings → API).
`LOGIN_ATTEMPT_SALT` é server-only (sem prefixo `NEXT_PUBLIC_`) — qualquer
string aleatória longa serve, ela só existe para que `login_attempts` nunca
grave e-mail/IP em texto puro. Gere uma vez e não troque depois sem motivo:
trocar invalida silenciosamente o rate limiting de tentativas já registradas
(os hashes antigos deixam de bater com os novos).

## 6. Região das funções na Vercel

Confirmar que o projeto Vercel está configurado para rodar as funções em
`gru1` (São Paulo) — mesma região do projeto Supabase, para latência mínima
entre a aplicação e o banco.

## Verificação manual obrigatória — policies de leitura própria (passo 8)

Nenhum teste automatizado deste repositório exercita RLS contra um banco real
(a chave anon não consegue nem criar o fixture: `representatives` e
`product_activations` não têm policy de INSERT — é a mesma limitação que
`tests/lead-submission.integration.test.ts` já documenta ao pular sozinho
quando não encontra um par publicado). Este roteiro é a verificação real do
passo 8, e **tem duas pontas: a segunda é a que importa.** Uma policy que
funciona para o dono mas vaza para o vizinho passa na primeira ponta sem
problema nenhum.

**Fixture** (SQL Editor, que ignora RLS — é assim que se cria o cenário; o
provisionamento pelo produto é o passo D3 do `docs/SPRINT_D_PLAN.md`, ainda
não implementado): crie duas contas de teste pela aplicação (`/criar-conta`),
e insira uma linha em `representatives` para cada uma — **A** e **B** —,
ambas com `status = 'active'` e **nenhuma** `product_activations`. Anote os
dois `profile_id` e os dois `id`.

**As asserções abaixo são sobre presença/ausência das linhas de A e de B —
nunca sobre contagem total.** Policies permissivas se somam com OR: se o
projeto já tiver algum representante público de verdade (ex.: um fixture
`joao-silva` usado por outro teste, com ativação `published`), ele também
aparece nas consultas abaixo por conta própria — isso é
`representatives_select_public`/`product_activations_select_published`
funcionando, não vazamento das policies novas. Contar linhas só funciona num
projeto onde nada além de A/B é público; a asserção real, que sobrevive a
qualquer estado do projeto, é "a linha de A está presente" e "a linha de B
está ausente".

1. Autenticado como **A** (sessão real da aplicação, chave publicável — não o
   SQL Editor), consulte `representatives`.
   **Observar:** a linha de A está entre as retornadas. Antes desta migration
   este mesmo passo não a retornava **de jeito nenhum** — é isso que ela
   conserta.
2. Ainda como **A**, consulte `representatives` filtrando pelo `id` de **B**.
   **Observar:** **zero linhas.** Esta é a ponta que prova que
   `representatives_select_own` não vazou entre representantes. Se voltar a
   linha de B, a policy está errada — pare aqui.
3. Crie, pelo SQL Editor, uma `product_activations` com `status = 'draft'`
   para **A** e outra para **B** (qualquer produto do passo 7).
4. Como **A**, consulte `product_activations`.
   **Observar:** a ativação de A está entre as retornadas, **mesmo em
   `draft`** (antes desta migration, `product_activations_select_published`
   escondia tudo que não fosse `published`). A de B não aparece em nenhuma
   linha.
5. Sem sessão nenhuma (chave publicável, sem login), consulte as duas tabelas.
   **Observar:** nenhum traço de A nem de B em nenhuma das duas — nem a linha,
   nem o `id`, nem o `slug`. Confirma que as policies novas não abriram
   leitura pública por acidente.

**Executado e confirmado em 2026-08-01**, no projeto de teste, com um
`joao-silva` (representante público real, ativação `published`) já presente —
exatamente o cenário acima: os passos 1 e 5 retornaram linhas extras
pertencentes a `joao-silva`, e as cinco asserções de presença/ausência de A e
B passaram sem exceção. Ver também o item 9 abaixo: foi rodando o passo 1
deste roteiro que o ciclo de RLS entre `representatives` e
`product_activations` foi descoberto, antes de qualquer uma destas policies
chegar a produção.

## Verificação manual obrigatória — registro de representante (passo 10)

`tests/register-representative.integration.test.ts` cobre só a rejeição de
um chamador anônimo — `register_representative` é `grant execute` só para
`authenticated`, e a lógica real (já ter representante, colisão de slug,
palavra reservada, a corrida do TOCTOU) só existe para uma sessão de verdade.
Sem service role key, não há como criar uma conta descartável por rodada de
CI e depois apagá-la (`representatives` não tem policy de DELETE — só as de
SELECT do ADR-038), então este roteiro é a verificação real do passo 10, à
mão, contra contas de teste reais — mesma disciplina do passo 8.

**Fixture**: crie duas contas de teste pela aplicação (`/criar-conta`) que
ainda não tenham representante — **A** e **B**. Nenhum SQL Editor aqui: o
ponto é exercitar a função pela sessão real de cada conta.

1. Autenticado como **A**, chame `register_representative` com um `p_slug`
   livre, `p_display_name` com duas palavras (ex. `"Ana Teste"`),
   `p_license_id` qualquer não-vazio, `p_phone`/`p_city` nulos.
   **Observar:** `status = 'created'`, `representative_id` preenchido.
   Confirme com um SELECT em `representatives` (sessão de A, cobre também o
   passo 8) que a linha existe com os valores enviados.
2. Ainda como **A**, chame `register_representative` de novo, com um `p_slug`
   diferente (livre) mas a mesma sessão.
   **Observar:** `status = 'already_registered'`, `representative_id` nulo —
   é a pré-checagem funcionando, não ainda a corrida do passo 5.
3. Autenticado como **B**, chame `register_representative` com o MESMO
   `p_slug` que A usou no passo 1.
   **Observar:** `status = 'slug_taken'`. Prova que a pré-checagem de slug
   funciona entre contas diferentes, não só a de "já registrado" da mesma
   conta.
4. Ainda como **B** (ainda sem representante), chame `register_representative`
   com `p_slug = 'admin'` (ou qualquer outra da lista em
   `20260806000000`'s cabeçalho).
   **Observar:** `status = 'slug_invalid'`.
5. Ainda como **B**, dispare duas chamadas de `register_representative` "quase
   juntas" (dois `await` em paralelo via `Promise.all`, mesmo `p_slug` livre,
   no console do navegador ou num script) na mesma sessão.
   **Observar:** uma retorna `'created'`, a outra `'already_registered'` — e
   nenhuma das duas trava ou devolve um erro cru de Postgres.
   **Limitação deste passo, registrada e não resolvida:** duas chamadas
   `fetch`/`rpc` disparadas "quase juntas" no mesmo processo Node/browser não
   são uma prova de concorrência de verdade — não há garantia de que as duas
   transações cheguem ao Postgres sobrepostas o bastante para de fato disputar
   a mesma UNIQUE. Este roteiro manual não consegue fazer melhor que isso; um
   teste de concorrência de verdade exigiria dois processos/conexões
   independentes disparados por fora deste roteiro, fora do escopo do
   D3.B.1.

**Executado e confirmado em: 2026-08-01**, contra o projeto de teste, com
três contas reais (A, B reaproveitada de uma tentativa anterior — descartada
do roteiro por já ter representante —, e C usada para os passos 3–5). Os 5
passos passaram sem exceção. Observação registrada: a checagem de palavra
reservada roda antes da checagem de "já registrado" na ordem interna da
função — uma conta já registrada ainda recebe `slug_invalid` para uma
palavra reservada, não `already_registered`.

## Verificação manual obrigatória — ativação de produto (passo 11)

`tests/map-product-activation-result.test.ts` cobre os dois mapeadores de
TypeScript, mas **nenhum teste automatizado exercita `activate_product` ou
`set_activation_status` contra um banco real** — e, ao contrário do passo 10,
aqui nem a rejeição anônima está automatizada. Toda a lógica (regra 6, máquina
de transições, gate de publicação, `published_at`) só existe para uma sessão
autenticada, e sem service role key não há como criar e depois limpar uma
conta descartável por rodada de CI. Este roteiro é a verificação real do
passo 11.

**Fixture**: use uma conta de teste que já tenha completado o onboarding do
passo 10 (representante **R**), e anote o `id` de dois produtos do catálogo do
passo 7 — chame de **P1** e **P2**. Todas as chamadas abaixo são RPC pela
sessão real da aplicação (chave publicável), nunca pelo SQL Editor — o SQL
Editor conecta como dono e ignora tanto RLS quanto a concessão que este passo
existe para verificar.

1. **Sem sessão nenhuma** (chave publicável, sem login), chame
   `activate_product` e depois `set_activation_status`.
   **Observar:** as duas chamadas **falham** — a função nunca foi concedida a
   `anon`. Se qualquer uma responder com um resultado tipado em vez de erro, a
   concessão está errada; pare aqui. Mesma checagem que o passo 10 faz para
   `register_representative`, porque a lógica de concessão é idêntica.
2. Autenticado como **R**, chame `activate_product(P1)`.
   **Observar:** `status = 'activated'`, `activation_id` preenchido. Confirme
   com um SELECT em `product_activations` (sessão de R, coberto pelo passo 8)
   que a linha existe com `status = 'draft'` e `published_at` nulo.
3. Ainda como **R**, chame `activate_product(P1)` de novo.
   **Observar:** `status = 'activated'` com **o mesmo `activation_id`** —
   idempotente, sem linha nova e sem erro.
4. Como **R**, chame `activate_product` com um UUID que não existe em
   `products`.
   **Observar:** `status = 'product_not_found'`. (A regra 6 —
   `product_not_in_catalog` — só é observável com uma segunda Company semeada
   à mão, que este ambiente não tem; **não coberto por este roteiro**, ver a
   nota no fim.)
5. Como **R**, chame `set_activation_status(P2, 'published')` — um produto que
   **não** foi ativado.
   **Observar:** `status = 'not_activated'`, distinto de `product_not_found`.
6. Como **R**, chame `set_activation_status(P1, 'draft')`.
   **Observar:** `status = 'invalid_status'` — nunca um erro cru de violação
   do CHECK da coluna.
7. Como **R**, chame `set_activation_status(P1, 'unpublished')` com P1 ainda
   em `draft`.
   **Observar:** `status = 'invalid_transition'`.
8. **Gate de publicação.** Garanta, pelo SQL Editor, que `R.phone` está nulo
   ou vazio, e chame `set_activation_status(P1, 'published')`.
   **Observar:** `status = 'phone_required'` — a razão exata, não um erro
   genérico. Repita com `R.status = 'suspended'`: **observar**
   `representative_not_active`, e note que ele vem **antes** de
   `phone_required` mesmo com o telefone ainda vazio — é a ordem deliberada do
   gate. Restaure `R.status = 'active'` e preencha `R.phone` antes de seguir.
9. Como **R**, com o perfil já completo, chame
   `set_activation_status(P1, 'published')`.
   **Observar:** `status = 'updated'` e `published_at` **preenchido**. Anote
   esse timestamp.
10. Chame `set_activation_status(P1, 'published')` de novo.
    **Observar:** `status = 'updated'`, `published_at` **idêntico** ao anotado
    — mesmo-estado é idempotente e não recarimba.
11. Chame `set_activation_status(P1, 'unpublished')` e depois
    `set_activation_status(P1, 'published')` outra vez.
    **Observar:** as duas retornam `'updated'`, e `published_at` continua
    **exatamente o mesmo timestamp do passo 9** nas duas — despublicar não
    anula, republicar não sobrescreve. Esta é a asserção que prova a semântica
    de `published_at` do ADR-043; se o valor mudar, a função está errada.
12. Como **R**, chame `activate_product(P1)` com P1 agora `published`.
    **Observar:** `status = 'activated'` e, num SELECT logo em seguida, P1
    **continua `published`** — reativar não pode rebaixar para `draft` e tirar
    a página do ar.
13. Com P1 publicado e o perfil completo, visite a página pública real
    (`<slug-de-R>.setnar.com/<slug-de-P1>`, ou via `curl -H 'Host: ...'` em
    dev).
    **Observar:** a página resolve e renderiza — é o elo inteiro fechando,
    ativação escrita pelo produto virando Commercial Page pública.

**Não coberto por este roteiro, exaustivamente:** `product_not_in_catalog`
(regra 6) exigiria uma segunda Company com produto próprio, que nenhum
ambiente tem hoje; `representative_not_found` exigiria uma conta autenticada
sem representante chamando as RPCs direto (possível, mas é o mesmo tipo de
defesa já exercitado no passo 10); `display_name_required` não é alcançável
por conta criada pelo produto, já que `register_representative` rejeita nome
vazio — só por linha inserida à mão; e concorrência real em `activate_product`
(dois processos disputando a mesma UNIQUE), pela mesma limitação registrada no
passo 5 do roteiro do passo 10.

**Executado e confirmado em:** _(preencher na primeira vez que este roteiro
rodar contra um projeto real — mesmo formato dos passos 8 e 10 acima)_.

## Verificação manual obrigatória — redefinição de senha ponta a ponta

Nenhuma automação neste repositório exercita este fluxo contra um Supabase
real (ver `README.md` principal, "Not yet verified against a real Supabase
project"). Depois de aplicar as três migrations, desligar Confirm email e
configurar URL Configuration acima, rode este roteiro manualmente contra
uma conta de teste real antes de considerar o fluxo pronto.

**Limitação conhecida, aceita por ora, não corrigida neste documento —
leia antes de testar.** O fluxo usa PKCE (`flowType: "pkce"`, padrão do
`@supabase/ssr` instalado) via `exchangeCodeForSession()`
(`app/auth/callback/route.ts`). A própria documentação da Supabase é
explícita sobre a implicação disso: *"The code verifier is created and
stored locally when the Auth flow is first initiated (...) the code
exchange must be initiated on the same browser and device where the flow
was started"*
([PKCE flow — Supabase Docs](https://supabase.com/docs/guides/auth/sessions/pkce-flow)).
Na prática: **o link do e-mail só funciona se aberto no mesmo
navegador/dispositivo** que enviou o formulário "Esqueci minha senha" — abrir
num celular depois de pedir no desktop, ou num app de e-mail com navegador
embutido diferente, falha por design desta implementação, não por
configuração errada. `app/auth/callback/route.ts` hoje trata essa falha
exatamente como um link expirado ou já usado — redireciona silenciosamente
para `/esqueci-senha`, sem diferenciar as duas causas e sem nenhum sinal de
erro visível. Corrigir isso de verdade (trocar para o fluxo `token_hash` +
`verifyOtp()` que a própria Supabase recomenda para evitar este problema)
exige mudança de código e está fora do escopo deste documento — **sempre
teste no mesmo navegador/dispositivo**, ou um teste válido vai parecer
falho.

**Roteiro:**

1. Em `/esqueci-senha`, submeta o e-mail de uma conta de teste real.
   **Observar:** a página deve mostrar a mensagem de sucesso genérica
   ("Se este e-mail tiver uma conta, enviamos um link…") — sem confirmar
   nem negar a existência da conta (ADR-022).
2. Abrir o e-mail recebido. **Observar o link antes de clicar:** deve
   apontar para `<host>/auth/callback?next=/redefinir-senha&code=...` —
   *não* para a raiz do site (`/` ou `/?code=...` sem `/auth/callback`).
   Se o link cair na raiz, a URL Configuration (seção 3 acima) não está
   batendo com o host que serviu o formulário — confira a allow-list antes
   de prosseguir, não é um problema deste roteiro.
3. Clicar no link **no mesmo navegador e dispositivo** usado no passo 1 (ver
   limitação conhecida acima).
   **Observar:** deve redirecionar para `/redefinir-senha` — se cair de
   volta em `/esqueci-senha` silenciosamente, o `exchangeCodeForSession()`
   falhou (link expirado, já usado, ou o mesmo problema de navegador
   descrito acima).
4. Em `/redefinir-senha`, antes de submeter nada, **confirmar que uma
   sessão foi estabelecida** — inspecionar os cookies do navegador (deve
   haver um cookie de sessão do Supabase) e confirmar que a página não
   redireciona para `/entrar`.
5. Submeter uma nova senha. **Observar:** sucesso e redirecionamento para
   `/app` (a senha nova já vem com sessão ativa — ver
   `updatePasswordAction`, `README.md` principal).
6. Fazer logout e tentar entrar em `/entrar` com a **senha nova**.
   **Observar:** login bem-sucedido, confirmando que `updateUser()` de fato
   persistiu a troca.
7. Reabrir o **mesmo link do e-mail** do passo 2 uma segunda vez, ainda no
   mesmo navegador. **Observar:** o formulário de nova senha deve mostrar o
   erro específico `reset_link_expired` (*"peça um novo link"*) — não o
   `unknown` genérico. Isso prova que `updatePassword()` está checando a
   sessão antes de chamar `updateUser()` (ADR-022), não apenas confiando
   num token já consumido.
