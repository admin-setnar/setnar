# Supabase — setup manual

Passos que só podem ser feitos no painel do Supabase ou na Vercel, fora do
alcance do código e das migrations versionadas neste repositório. Nenhum
deles usa a service role key — ela não entra no projeto nesta sprint.

## 1. Aplicar as migrations, nesta ordem, todas as dezesseis

São cumulativas — aplique as dezesseis, em ordem, nunca só a primeira. Cole
cada arquivo no SQL Editor do projeto e execute, ou rode `supabase db push`
se preferir a CLI.

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
12. `supabase/migrations/20260808000000_add_update_representative_profile.sql`
    — passo D5b (`docs/SPRINT_D_PLAN.md` §4/D5b): cria
    `update_representative_profile(p_phone, p_city, p_license_id)`,
    `SECURITY DEFINER`, `grant execute` só para `authenticated` (**nunca**
    `anon`, mesma lógica de concessão dos passos 10/11). Nenhuma policy nova,
    nenhuma tabela, nenhuma coluna. É a primeira escrita em `representatives`
    **fora** do cadastro inicial (passo 10): substitui `phone`/`city`/
    `license_id` do próprio representante autenticado por completo, validando
    a mesma forma que `register_representative` já usa para os mesmos três
    campos (E.164 para `phone`, teto de 500 para `city`, não-vazio e teto de
    100 para `license_id`). `avatar_url` fica de fora — decisão do Pedro, ver
    ADR-047. `slug`/`display_name`/`company_id`/`status` também ficam de
    fora — fora de escopo do D5b, e `slug` em particular não pode ganhar
    caminho de UPDATE aqui sem violar a regra 12 (endereço não muda depois de
    publicado). Ver ADR-047 no `README.md` principal para o raciocínio
    completo, incluindo por que função e não policy de UPDATE por coluna —
    a mesma pergunta que o passo 11 já respondeu, aqui com uma resposta
    diferente pelo motivo lá explicado.
    **Verificação:** o mapeador tem teste unitário
    (`tests/map-update-representative-profile-result.test.ts`), mas **a
    função SQL em si não tem teste automatizado nenhum** — a verificação é
    manual, seção própria mais abaixo neste arquivo (**passo 12**).
13. `supabase/migrations/20260809000000_revoke_anon_execute_leak.sql` —
    **corrige uma vulnerabilidade real, não é opcional**: `anon` tinha EXECUTE
    nas quatro funções dos passos 10/11/12 (`register_representative`,
    `activate_product`, `set_activation_status`,
    `update_representative_profile`), apesar de cada uma delas já ter `revoke
    ... from public` seguido de `grant ... to authenticated`. O `revoke from
    public` nunca foi a causa — a concessão a `anon` vinha de um `ALTER
    DEFAULT PRIVILEGES` do schema `public`, concedendo EXECUTE em funções
    novas diretamente a `anon` no momento da criação, por fora de qualquer
    `create or replace function`. Confirmado por teste manual real contra o
    projeto (RPC HTTP direto, só `apikey`, sem `Authorization`, respondendo
    HTTP 200 com um resultado tipado em vez de erro de permissão) — não por
    revisão de código. Esta migration revoga EXECUTE de `anon`
    explicitamente nas quatro funções existentes e corrige o default
    privilege do schema para que nenhuma função `SECURITY DEFINER` futura
    vaze do mesmo jeito. `submit_lead` não é tocado — seu `grant ... to anon`
    é proposital (ADR-034). Ver ADR-048 no `README.md` principal para o
    achado completo. **Um ambiente que aplicou só os passos 10/11/12 acima
    fica com essa vulnerabilidade aberta**, mesmo que todo o resto deste
    README seja seguido corretamente. **Verificação:** re-rodar o teste
    manual que encontrou o furo — seção própria mais abaixo neste arquivo
    (**passo 13**).
14. `supabase/migrations/20260810000000_add_analytics_events.sql` — AN1
    (`docs/QR_ANALYTICS_PLAN.md` §4), cria só o schema de Analytics (Básico):
    a tabela `analytics_events` (uma linha por visita/clique no WhatsApp,
    `ip_hash` incluído — ver ADR-050 no `README.md` principal para o porquê
    de morar na própria tabela e não numa tabela irmã de rate-limit), RLS
    habilitada com zero policies de escrita, e uma única policy de SELECT
    por dono (`analytics_events_select_own`, via `is_own_representative()`
    do passo 9). **Nenhuma função `SECURITY DEFINER` é criada aqui** —
    `record_page_visit`/`record_whatsapp_click` (AN2/AN4) são passos
    seguintes, ainda não implementados; até lá, não existe NENHUM caminho de
    escrita para esta tabela, nem anônimo nem autenticado. **Verificação:**
    seção própria mais abaixo neste arquivo (**passo 14**).
15. `supabase/migrations/20260811000000_add_analytics_write_functions.sql`
    — AN2 + AN4 (`docs/QR_ANALYTICS_PLAN.md` §4), cria o único caminho de
    escrita em `analytics_events`: `record_page_visit`/
    `record_whatsapp_click`, funções `SECURITY DEFINER` no formato de
    `submit_lead` (resolvem por slug+slug, nunca confiam em id vindo do
    chamador; retorno `boolean` anti-enumeration; limiares de rate limit
    fixos dentro da função). Cria também `is_bot_user_agent(text)`, helper
    do filtro de ruído (§3.2), não concedido a `anon`/`authenticated` de
    propósito — só é chamado de dentro das duas funções acima. Ver ADR-051
    no `README.md` principal para o raciocínio completo, incluindo por que
    `record_whatsapp_click` reusa deliberadamente o mesmo limiar de
    `submit_lead` (5/3600s) e por que um par (slug, slug) inválido não
    consome o rate limit aqui, ao contrário de `submit_lead`. **O wiring no
    app ([productSlug]/page.tsx, WhatsappCta) NÃO está nesta migration** —
    são os passos AN3/AN5, ainda não implementados; até lá, estas duas
    funções existem e são chamáveis por RPC direto, mas nada no app as
    invoca ainda. **Verificação:** seção própria mais abaixo neste arquivo
    (**passo 15**) — inclui o double-check obrigatório do ADR-048 (grants +
    RPC HTTP cru sem `Authorization`), desta vez confirmando que `anon`
    aparece de propósito, não por vazamento.
16. `supabase/migrations/20260812000000_revoke_authenticated_from_is_bot_user_agent.sql`
    — **corrige um achado real, encontrado pelo próprio double-check do
    passo 15**: `authenticated` tinha EXECUTE em `is_bot_user_agent`, apesar
    do comentário do passo 15 afirmar o contrário. `anon` estava correto
    (confirmado por RPC HTTP cru sem `Authorization`: `401 42501`). Mesma
    causa do ADR-048 — um default privilege de schema, desta vez para
    `authenticated`, nunca fechado porque para as quatro funções do ADR-048
    `authenticated` era o acesso pretendido. Risco avaliado como baixo
    (`is_bot_user_agent` não lê tabela nem muta nada), corrigido mesmo assim
    pela divergência entre documentação e comportamento real. Ver ADR-052
    no `README.md` principal. **Verificação:** re-rodar a query de grants do
    passo 15 e confirmar que `authenticated` não aparece mais para
    `is_bot_user_agent` (`record_page_visit`/`record_whatsapp_click`
    continuam com `authenticated`, de propósito).

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
ANALYTICS_IP_SALT=
```

As duas primeiras são as chaves públicas do projeto (Settings → API).
`LOGIN_ATTEMPT_SALT` é server-only (sem prefixo `NEXT_PUBLIC_`) — qualquer
string aleatória longa serve, ela só existe para que `login_attempts` nunca
grave e-mail/IP em texto puro. Gere uma vez e não troque depois sem motivo:
trocar invalida silenciosamente o rate limiting de tentativas já registradas
(os hashes antigos deixam de bater com os novos).

`ANALYTICS_IP_SALT` é server-only, mesma forma (qualquer string aleatória
longa) e mesmo motivo (nunca gravar IP em texto puro) — mas é um valor
**diferente** de `LOGIN_ATTEMPT_SALT`, de propósito: ver ADR-054 no
`README.md` principal. Reusar o mesmo salt entre `analytics_events` e
`login_attempts`/`lead_submission_attempts` deixaria um `ip_hash` idêntico
nas duas tabelas para o mesmo IP, permitindo correlacionar um evento de
analytics (visita/clique) a uma tentativa de login/lead identificável —
exatamente o que a postura conservadora de LGPD do
`docs/QR_ANALYTICS_PLAN.md` §3.4 proíbe. Mesma ressalva de rotação do
`LOGIN_ATTEMPT_SALT`: gerar uma vez, não trocar sem motivo (invalida os
hashes já gravados).

## 6. Região das funções na Vercel

Confirmar que o projeto Vercel está configurado para rodar as funções em
`gru1` (São Paulo) — mesma região do projeto Supabase, para latência mínima
entre a aplicação e o banco.

## 7. AN3/AN5 — wiring de analytics no app, sem migration nova

Diferente de todos os itens da lista numerada acima, este passo não aplica
nenhum arquivo em `supabase/migrations/` — `record_page_visit`/
`record_whatsapp_click` (passos 15/16) já existiam no banco; o que faltava
era só código de aplicação chamando-as. Nada a fazer aqui no painel do
Supabase nem na Vercel além do que os passos 1-6 já cobrem. Ver ADR-053 no
`README.md` principal para o código (módulo `analytics` novo, `after()` para
a visita, rota `/api/track-click` para o clique) e a **Verificação manual
obrigatória** própria mais abaixo neste arquivo.

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

**Executado e confirmado em 2026-08-03**, contra o projeto real do Pedro (não
um projeto de teste descartável), com o representante `teste-novo-a`
(onboarded no passo 10) e os produtos `conexao-green`/`conexao-club` como
P1/P2. Os 13 itens passaram sem exceção, incluindo o gate de publicação
(`phone_required` antes de preencher o telefone, `representative_not_active`
com prioridade sobre ele ao suspender), a estabilidade de `published_at`
através de republicar/despublicar/reativar, e a verificação final: a página
pública (`teste-novo-a.setnar.com/conexao-green`, testada via `curl` local
com `Host` forjado) resolveu e renderizou com o CTA do WhatsApp
(`wa.me/5511987654321`) — o elo Auth → Commercial Page fechado de ponta a
ponta com dado criado inteiramente pelo produto.

## Verificação manual obrigatória — edição de perfil (passo 12)

`tests/map-update-representative-profile-result.test.ts` cobre o mapeador de
TypeScript, mas **nenhum teste automatizado exercita
`update_representative_profile` contra um banco real**. Mesma limitação já
registrada nos passos 10/11: toda a lógica só existe para uma sessão
autenticada, e sem service role key não há como criar e depois limpar uma
conta descartável por rodada de CI.

**Fixture**: a mesma conta de teste **R** dos roteiros dos passos 10/11, já
com representante. Todas as chamadas abaixo são RPC pela sessão real da
aplicação (chave publicável), nunca pelo SQL Editor.

1. **Sem sessão nenhuma** (chave publicável, sem login), chame
   `update_representative_profile`.
   **Observar:** a chamada **falha** — a função nunca foi concedida a
   `anon`. Mesma checagem que os passos 10/11 fazem para suas próprias
   funções.
2. Autenticado como **R**, chame `update_representative_profile` com
   `p_phone := '+5511977776666'`, `p_city := 'Curitiba'`,
   `p_license_id := 'ID-NOVO-123'`.
   **Observar:** `status = 'updated'`. Confirme com um SELECT em
   `representatives` (sessão de R, coberto pelo passo 8) que as três colunas
   mudaram para os valores enviados, e que `updated_at` avançou (o trigger
   `representatives_set_updated_at` do passo 4 é automático).
3. Ainda como **R**, chame de novo com `p_license_id := ''`.
   **Observar:** `status = 'license_id_invalid'`, e um SELECT confirma que
   `phone`/`city`/`authorization_id` **não mudaram** — a validação roda antes do
   UPDATE, tudo ou nada, nenhuma escrita parcial.
4. Ainda como **R**, chame com `p_phone := 'não-é-telefone'` (e
   `p_license_id` válido).
   **Observar:** `status = 'phone_invalid'`.
5. Ainda como **R**, chame com `p_city` de mais de 500 caracteres (e os
   outros dois válidos).
   **Observar:** `status = 'city_invalid'`.
6. Ainda como **R**, chame com `p_phone := null` e `p_city := null` (e
   `p_license_id` válido).
   **Observar:** `status = 'updated'`, e o SELECT confirma `phone`/`city`
   **nulos** — limpar os campos opcionais é um resultado válido, não um erro,
   mesma normalização de string vazia para NULL que `register_representative`
   já usa.
7. Autenticado como uma conta **sem** representante (ex.: uma conta nova,
   criada pelo signup, que nunca completou o onboarding do passo 10), chame
   `update_representative_profile` com os três parâmetros válidos.
   **Observar:** `status = 'representative_not_found'`.

**Executado e confirmado em 2026-08-03**, contra o projeto real do Pedro, com
o representante `teste-novo-a` (R) e uma conta extra sem representante
(`teste-sem-rep`) para o item 7. Os 7 itens passaram sem exceção: rejeição
anônima (retestada no passo 13, após o fix do vazamento de EXECUTE),
atualização válida, `license_id_invalid` (vazio), `phone_invalid` (formato),
`city_invalid` (>500 caracteres), limpeza de `phone`/`city` para NULL como
resultado válido, e `representative_not_found` para conta sem representante.

## Verificação manual obrigatória — vazamento de EXECUTE para anon (passo 13)

**Por que este roteiro existe separado dos passos 10/11/12, em vez de só
confiar no item 1 de cada um deles.** Os roteiros dos passos 11 e 12 já têm,
como primeiro item, a checagem "sem sessão nenhuma, a chamada deve falhar" —
exatamente o que este achado (ADR-048 no `README.md` principal) precisava.
Mas nenhum dos dois tinha sido executado de fato contra um projeto real
ainda (as duas linhas "Executado e confirmado em" acima estavam em branco), e
o do passo 10 cobria a rejeição anônima só via teste automatizado
(`tests/register-representative.integration.test.ts`, que usa uma sessão
anônima real do `supabase-js`), não via RPC HTTP puro. O furo real só foi
achado chamando a API REST do Supabase diretamente, com **apenas** o header
`apikey` — sem `Authorization` nenhum. Este roteiro fecha essa lacuna
especificamente: RPC HTTP cru, não `supabase-js`, não SQL Editor (que
conecta como dono e não passa por concessão nenhuma).

**Pré-requisito:** a migration `20260809000000_revoke_anon_execute_leak.sql`
(passo 13 da lista acima) já aplicada.

Para cada uma das quatro funções abaixo, faça um `POST` para
`{SUPABASE_URL}/rest/v1/rpc/{nome_da_funcao}` com header `apikey:
{chave publicável}` e **sem** header `Authorization` — nem mesmo com o valor
da própria chave publicável no lugar do JWT. Corpo JSON com parâmetros
quaisquer sintaticamente válidos (o valor não importa; o que importa é a
função nunca começar a executar):

1. `register_representative` — `{"p_slug": "teste-anon", "p_display_name":
   "Teste Anon", "p_license_id": "x", "p_phone": null, "p_city": null}`.
2. `activate_product` — `{"p_product_id": "00000000-0000-0000-0000-000000000000"}`.
3. `set_activation_status` — `{"p_product_id":
   "00000000-0000-0000-0000-000000000000", "p_status": "published"}`.
4. `update_representative_profile` — `{"p_phone": null, "p_city": null,
   "p_license_id": "x"}`.

**Observar, nas quatro:** a resposta é um erro de permissão (`42501` /
"permission denied for function ..."), nunca HTTP 200 e nunca um `status`
tipado. Se qualquer uma responder 200 com um resultado tipado (ex.
`representative_not_found`, `slug_invalid`), a concessão ainda está errada —
pare aqui e não considere a migration aplicada corretamente.

**Contraprova, no mesmo teste:** repita a chamada 5 (`submit_lead`, com um
`p_representative_id`/`p_product_id` válidos do catálogo e os demais campos
preenchidos) sem `Authorization`. **Observar:** esta, sim, deve responder 200
com um resultado — `anon` continua com EXECUTE nela de propósito (ADR-034).
Se `submit_lead` também passar a falhar, a migration foi longe demais (o
`alter default privileges` não deveria ter afetado um grant explícito já
existente) — investigue antes de considerar o passo 13 concluído.

**Executado e confirmado em 2026-08-03**, contra o projeto real do Pedro. As
quatro funções (`activate_product`, `set_activation_status`,
`register_representative`, `update_representative_profile`), chamadas via RPC
HTTP cru sem header `Authorization`, retornaram `42501 permission denied for
function ...` — nenhuma respondeu com um `status` tipado. Antes da migration
`20260809000000`, `activate_product`/`set_activation_status` haviam
respondido HTTP 200 com `{status: 'representative_not_found', ...}`,
confirmando o furo original. A contraprova de `submit_lead` (mesma chamada,
sem `Authorization`) retornou `true` — `anon` continua com EXECUTE nela, de
propósito, sem regressão.

## Verificação manual obrigatória — `analytics_events` (passo 14)

**Escopo limitado, de propósito.** Diferente dos roteiros 10-13, este passo
não tem NENHUMA função `SECURITY DEFINER` para chamar ainda —
`record_page_visit`/`record_whatsapp_click` são AN2/AN4
(`docs/QR_ANALYTICS_PLAN.md` §4), passos seguintes. Sem elas, não existe
caminho de escrita nenhum para `analytics_events` — nem anônimo, nem
autenticado, nem pelo SQL Editor de propósito (a tabela não tem policy de
INSERT). O que dá para verificar agora é só: (1) a tabela existe e responde
sem erro de política/recursão, e (2) a constraint de `event_type` rejeita
valor fora do conjunto permitido. O isolamento real entre representantes
(R vê só os próprios eventos, nunca os de outro) só é verificável quando
existir pelo menos uma linha real — isso fica para o roteiro de AN2/AN4, não
para este.

1. **Sem sessão nenhuma** (chave publicável, sem login), consulte
   `analytics_events` (`select id from analytics_events limit 1`, via
   `supabase-js` ou RPC REST).
   **Observar:** resposta vazia (`data: []`, `error: null`) — nunca `42P17`
   (ciclo de política) e nunca "relation does not exist"/`PGRST205` (a
   migration não foi aplicada). `tests/analytics-events-select-policy.integration.test.ts`
   automatiza exatamente este item.
2. **Pelo SQL Editor** (conecta como dono da tabela, ignora RLS — mas nunca
   ignora CHECK/FK, então isto testa a constraint, não a policy), com um
   `representative_id`/`product_id` reais já existentes no ambiente (ex.: o
   representante `teste-novo-a`/produto `conexao-green` dos passos
   anteriores), tente:
   ```sql
   insert into analytics_events (representative_id, product_id, event_type, ip_hash)
   values ('<uuid do representante>', '<uuid do produto>', 'algo_invalido', 'teste');
   ```
   **Observar:** rejeitado por violação de `check` (`event_type` fora de
   `'visit'`/`'whatsapp_click'`). Repita trocando só `event_type` para
   `'visit'` e depois para `'whatsapp_click'` — as duas devem ser aceitas
   pela constraint (a linha inserida pode ser apagada depois pelo próprio SQL
   Editor; não há policy de DELETE, mas o dono da tabela não passa por RLS).

**Não coberto por este roteiro, de propósito:** isolamento entre dois
representantes (precisa de linha real, criada por `record_page_visit`/
`record_whatsapp_click` — AN2/AN4, ainda não implementadas); rate limit por
`ip_hash` (mesma dependência); qualquer coisa que passe pela chave
publicável fazendo INSERT (a tabela não tem policy de INSERT nenhuma —
tentar confirmaria só que a policy continua ausente, não a constraint).

**Item 1 confirmado em 2026-08-03**, contra o projeto real do Pedro:
`npm run verify` passou a reportar `tests/analytics-events-select-policy.integration.test.ts`
verde (208/208 no total), inclusive o controle de catálogo — prova que a
migration foi aplicada e que a leitura anônima se comporta como esperado
(zero linhas, sem `42P17`/`PGRST205`). **Item 2 (constraint de `event_type`
via SQL Editor) ainda não tem confirmação registrada aqui** — pendente de
execução manual.

## Verificação manual obrigatória — `record_page_visit`/`record_whatsapp_click` (passo 15)

**Pré-requisito:** a migration `20260811000000_add_analytics_write_functions.sql`
(passo 15 da lista acima) já aplicada.

`tests/analytics-write-functions.integration.test.ts` cobre rejeição de par
inválido, `ip_hash` nulo, o filtro de bot (a fundo, sem custo de dado) e o
rate limit de `record_whatsapp_click` (saturado de verdade, 6 chamadas). O
que aquele teste **não** cobre — porque é exatamente a lição do ADR-048 —
é o double-check de grants contra o projeto real. Isto é esse roteiro,
mesma forma do passo 13.

1. Pelo SQL Editor:
   ```sql
   select routine_name, grantee, privilege_type
   from information_schema.role_routine_grants
   where routine_name in ('record_page_visit', 'record_whatsapp_click', 'is_bot_user_agent');
   ```
   **Observar:** `anon` e `authenticated` aparecem para `record_page_visit`
   e `record_whatsapp_click` — ao contrário do achado do ADR-048, aqui é o
   resultado ESPERADO (§3.6: o chamador é sempre anônimo). `is_bot_user_agent`
   **não deve aparecer para `anon` nem `authenticated`** — é um helper
   interno, só chamado de dentro das duas funções acima (que rodam como
   dono via `security definer`), nunca exposto por RPC direto.
2. RPC HTTP cru, `POST` para `{SUPABASE_URL}/rest/v1/rpc/record_page_visit`,
   header `apikey: {chave publicável}`, **sem** header `Authorization`
   nenhum. Corpo:
   ```json
   {"p_representative_slug": "qualquer-coisa", "p_product_slug": "qualquer-coisa",
    "p_referrer": null, "p_ip_hash": "teste-manual-15", "p_user_agent": "curl/8"}
   ```
   **Observar:** HTTP 200 com `data: false` (par inválido — mas a função
   RODOU, o que é o ponto: uma concessão ausente responderia `42501`, não um
   `boolean` tipado). Repita para `record_whatsapp_click` com o mesmo corpo.
   **Observar:** mesmo resultado.
3. Repita o item 2 com um par (`p_representative_slug`/`p_product_slug`)
   real e publicado (ex.: `teste-novo-a`/`conexao-green`, dos passos
   anteriores) e um `p_ip_hash` novo. **Observar:** `data: true` nas duas —
   e, se a sessão de **R** estiver disponível para conferir depois
   (`analytics_events_select_own`, AN1), a leitura própria deve mostrar as
   linhas inseridas (isolamento entre representantes fica para quando
   houver uma segunda conta com dado próprio para comparar — não coberto
   por este item sozinho).

**Não coberto por este roteiro, de propósito:** o wiring no app (AN3/AN5
ainda não existe — nada em `[productSlug]/page.tsx`/`WhatsappCta` chama
estas funções ainda); isolamento de leitura entre dois representantes reais
(precisa de duas contas com dado próprio para comparar).

**Item 1 executado em 2026-08-03**, contra o projeto real do Pedro:
`record_page_visit`/`record_whatsapp_click` — `anon`/`authenticated` com
EXECUTE, como esperado. `is_bot_user_agent` — **achado real**: `anon`
corretamente ausente, mas `authenticated` presente, contrariando o que o
comentário da migration e o ADR-051 afirmavam. Corrigido pelo passo 16
(`20260812000000`, ADR-052) e **re-confirmado após a correção**: a mesma
query voltou a rodar e `is_bot_user_agent` agora aparece só para
`postgres`/`service_role` — `anon`/`authenticated` corretamente ausentes.
`record_page_visit`/`record_whatsapp_click` inalteradas (`anon`/`authenticated`
continuam presentes, de propósito).

**Item 2 executado em 2026-08-03**, via RPC HTTP cru sem `Authorization`:
`record_page_visit`/`record_whatsapp_click` responderam `200`/`data: false`
para um par inválido — a função rodou, concessão correta. `is_bot_user_agent`
respondeu `401 {"code":"42501","message":"permission denied for function
is_bot_user_agent"}` — confirma que `anon` está corretamente bloqueado
(consistente com o item 1).

**Item 3 (par real, `data: true` nas duas) coberto indiretamente**: com as
duas migrations aplicadas, `npm run verify` passou a exercitar
`tests/analytics-write-functions.integration.test.ts` de ponta a ponta
(219/219 no total) — incluindo o caminho feliz de cada função contra um par
real (`teste-novo-a`/`conexao-green`), o filtro de bot e o rate limit de
`record_whatsapp_click` saturado de verdade. O item 3 propriamente dito
(via RPC HTTP cru, não via `supabase-js`) não foi re-executado à parte —
considerado coberto pela combinação dos itens 1/2 acima com a suíte
automatizada.

## Verificação manual obrigatória — wiring de analytics no app (AN3/AN5)

**Escopo.** Este roteiro prova que o app agora chama as funções do passo 15
— não repete o double-check de grants (isso é o passo 15 acima), nem exercita
o rate limit ou o filtro de bot (já cobertos por
`tests/analytics-write-functions.integration.test.ts`). O que só é
verificável com o app rodando: (1) uma visita real insere uma linha em
`analytics_events`; (2) um clique real no CTA do WhatsApp insere outra, e a
navegação para `wa.me` acontece de qualquer forma. Nenhum dos dois tem teste
automatizado — `npm run verify` cobre typecheck/lint/build e as suítes de
integração das duas funções SQL, não o wiring do app em si.

**Pré-requisito:** um par (representative, product) real e publicado (ex.:
`teste-novo-a`/`conexao-green`, dos passos anteriores), `npm run dev`
rodando local, e `ANALYTICS_IP_SALT` configurada em `.env.local` (ADR-054 —
**não** o mesmo valor de `LOGIN_ATTEMPT_SALT`; ver §5 acima).

0. **Antes de rodar os itens abaixo, confirme pelo SQL Editor** (ignora RLS,
   ao contrário da chave anon) **que `analytics_events` ainda está vazia**:
   `select count(*) from analytics_events;`. Isto é o double-check que o
   ADR-054 deixou pendente — a troca de `LOGIN_ATTEMPT_SALT` para
   `ANALYTICS_IP_SALT` só é "de graça" enquanto nenhuma linha real existir
   com o salt antigo. Se a contagem vier `0`, prossiga. Se vier maior que
   `0`, são linhas de teste de uma verificação manual anterior (dado de
   teste, não real) — aceitável ignorá-las/descartá-las, mas registre aqui
   quantas eram antes de seguir.
1. **Visita (AN3).** Com o servidor local rodando, visite
   `http://teste-novo-a.localhost:3000/conexao-green` (ou o subdomínio real
   em produção). **Observar:** a página renderiza normalmente, sem nenhum
   atraso perceptível e sem nenhum erro visível — mesmo que o RPC falhe ou
   demore, `after()` garante que isso nunca chega à resposta (ver ADR-053).
   Pelo SQL Editor: `select event_type, referrer, created_at from
   analytics_events where representative_id = (select id from
   representatives where slug = 'teste-novo-a') order by created_at desc
   limit 5;` — **observar** uma linha nova `event_type = 'visit'`, com
   `created_at` próximo do momento da visita.
2. **Clique no WhatsApp (AN5).** Na mesma página, clique no botão "Falar no
   WhatsApp". **Observar:** a navegação para `wa.me` acontece normalmente
   (nova aba/janela abre), independente de quando ou se `/api/track-click`
   responde — o `onClick` nunca chama `preventDefault`. Pela aba de Network
   do navegador: uma requisição `POST /api/track-click` com `keepalive`,
   corpo `{"productSlug":"conexao-green","referrer":"..."}`, resposta `200
   {"ok":true}`. Repita a query do item 1 — **observar** uma segunda linha
   nova, `event_type = 'whatsapp_click'`.
3. **Par inexistente ou não publicado**, chame `POST /api/track-click` direto
   (ex. via `curl`) com `{"productSlug": "produto-que-nao-existe"}` e sem
   simular o `Host` de um representante real. **Observar:** `200 {"ok":true}`
   mesmo assim (resposta sempre-200, ADR-053) e nenhuma linha nova em
   `analytics_events`.

**Não coberto por este roteiro, de propósito:** AN6 (exibir as estatísticas
agregadas no hub) — próximo passo do mesmo plano, ainda não implementado;
qualquer verificação que dependa de uma segunda conta representante para
provar isolamento de leitura (já coberto pelo roteiro do passo 14).

**Pendente de execução** — este roteiro ainda não foi rodado contra o
projeto real do Pedro; `npm run verify` (typecheck, lint, as 219 unit/
integration tests existentes, e o build de produção) passou de ponta a
ponta com o código deste passo, mas os itens 0-3 acima exigem o SQL Editor
(item 0) e clicar de verdade na página publicada (itens 1-3). Verificado
apenas por uma leitura via chave anon (`select count(*)`, sujeita à mesma
policy own-row de `analytics_events_select_own`) — `0`, mas essa leitura não
prova nada por si só (a chave anon sempre vê `0` nessa tabela, com ou sem
dado real): o item 0 pelo SQL Editor é quem confirma de verdade antes de
considerar a troca do ADR-054 sem custo.

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
