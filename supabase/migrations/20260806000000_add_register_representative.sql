-- Sprint D, passo D3.B.1 (docs/SPRINT_D_PLAN.md §4/D3.B, Opção B — onboarding
-- explícito pós-login, decisão fechada em §3 em 2026-08-01): cria
-- `register_representative()`, a função `SECURITY DEFINER` que grava a
-- primeira linha de `representatives` de um usuário autenticado. Nenhuma
-- migration já aplicada é editada aqui — nova migration, uma função nova, um
-- CHECK constraint novo sobre `representatives`, nada mais. Nenhum código de
-- aplicação (port, adapter, factory, Zod, Server Action, UI) faz parte deste
-- passo — isso é D3.B.2 a D3.B.5, prompts separados.
--
-- Duas decisões de compliance foram fechadas pelo Pedro antes desta migration
-- ser escrita (Task 1, itens 1.7a/1.7b da investigação) e mudam a assinatura
-- em relação ao que `docs/SPRINT_D_PLAN.md` §4/D3.B.1 originalmente descrevia
-- (`register_representative(p_slug, p_license_id, p_phone, p_city)`):
--
--   1. `p_display_name` entra como um QUINTO parâmetro, novo em relação ao
--      plano original — não é copiado de `profiles.full_name` dentro da
--      função. A UI de onboarding (D3.B.4) pré-preenche o campo com
--      `full_name`, mas o valor que chega aqui é o que o usuário confirmou
--      (ou editou). Ver "p_display_name" abaixo para o raciocínio completo —
--      a alternativa (copiar de `profiles.full_name` e rejeitar quando tiver
--      menos de duas palavras) empurraria qualquer usuário cadastrado com
--      `signUpSchema`'s mínimo de 2 caracteres (`NAME_MIN_LENGTH`,
--      `auth-rules.ts`) para um beco sem saída: `docs/SPRINT_D_PLAN.md`'s D5b
--      nem lista `full_name` entre os campos que ganharão uma tela de edição.
--   2. `p_license_id` recebe só validação de FORMATO (não vazio, teto de
--      tamanho) — não existe, neste repositório, uma fonte confirmada do
--      formato real do ID de licenciado iGreen. Ver "p_license_id" abaixo,
--      em destaque: isto é um BLOQUEADOR DE LANÇAMENTO, não resolvido aqui.
--
-- ============================================================================
-- Por que `grant execute ... to authenticated`, nunca `anon` — ao contrário
-- de `submit_lead`
-- ============================================================================
--
-- `submit_lead` (`20260801000000`/`20260802000000`) é `grant ... to anon`
-- porque o chamador real é um visitante anônimo de uma Commercial Page — não
-- há sessão para checar. Aqui é o oposto: toda a lógica de negócio depende de
-- `auth.uid()` ser uma identidade real ("este usuário já tem representante?",
-- "a quem pertence a nova linha?"). Se esta função fosse concedida a `anon`,
-- uma chamada sem sessão teria `auth.uid()` nulo — a pré-checagem de "já
-- registrado" nunca casaria (comparação contra NULL nunca é verdadeira), e o
-- INSERT tentaria `profile_id = null`, o que fere a constraint `not null` de
-- `representatives.profile_id` (`20260731000000:160`) e vazaria um erro cru
-- de Postgres pelo RPC — exatamente o tipo de vazamento técnico que este
-- resultado tipado existe para evitar. Não há caminho anônimo legítimo aqui;
-- `revoke ... from public` seguido de `grant ... to authenticated` fecha essa
-- porta na concessão, não numa checagem que poderia ter um furo.
--
-- ============================================================================
-- Resultado tipado — `returns table (status text, representative_id uuid)`
-- ============================================================================
--
-- `submit_lead` retorna `boolean` de propósito (anti-enumeração, ADR-018/
-- ADR-030/ADR-036: uma rejeição não deve ser distinguível de outra para um
-- chamador anônimo). Aqui o plano pede o oposto — resultado tipado — e o
-- raciocínio de anti-enumeração não se aplica do mesmo jeito: o chamador já
-- precisa estar autenticado (barra mais alta que o RPC anônimo daqueles
-- casos), e o dado mais sensível que uma rejeição poderia vazar — se um slug
-- já existe — tem destino público por construção (regra 12,
-- `DOMAIN_MODEL.md:565`: o slug É o subdomínio; `representatives_select_public`,
-- `20260731000000:257-267`, já expõe publicamente o slug de todo
-- representante `active` com ao menos uma ativação publicada). `returns table`
-- foi escolhido em vez de um `enum text` puro ou de `jsonb`: dá ao adapter da
-- D3.B.2 o `id` da linha recém-criada no mesmo round-trip (sem um segundo
-- SELECT contra `representatives_select_own`, ADR-038, só para descobrir o
-- id que a própria chamada acabou de gerar), e as colunas chegam tipadas no
-- nível do `supabase-js` sem exigir parsing/validação de shape de JSON.
--
-- Vocabulário de `status`, e por que ele distingue "inválido" de "em uso":
--   'created'              — sucesso; representative_id preenchido.
--   'company_not_found'    — catálogo (`companies`, D1) não foi semeado
--                             neste ambiente. Ver "company_id" abaixo.
--   'already_registered'   — `auth.uid()` já tem uma linha em
--                             `representatives` (pré-checagem OU corrida
--                             pega no INSERT — ver "TOCTOU" abaixo).
--   'slug_invalid'         — o valor de `p_slug` nunca poderia ser um slug
--                             válido, independente de quem pergunta: formato
--                             fora do regex, palavra reservada, ou igual ao
--                             slug de uma Company existente. Uma propriedade
--                             do INPUT, não do estado do banco.
--   'slug_taken'           — `p_slug` é bem formado, mas outra linha de
--                             `representatives` já o usa (pré-checagem OU
--                             corrida pega no INSERT). Uma propriedade do
--                             ESTADO do banco, não do input.
--   'display_name_invalid' — vazio, mais de 80 caracteres, ou menos de duas
--                             palavras. Ver "p_display_name" abaixo.
--   'license_id_invalid'   — vazio ou mais de 100 caracteres. Ver
--                             "p_license_id" abaixo — placeholder de forma.
--   'phone_invalid'        — presente e fora do formato E.164.
--   'city_invalid'         — presente e maior que 500 caracteres.
-- A separação entre `slug_invalid` e `slug_taken` existe porque são causas
-- diferentes que uma tela de onboarding trata de formas diferentes (a
-- primeira é "esse endereço nunca vai funcionar, escolha outro formato"; a
-- segunda é "esse endereço específico já foi escolhido por outra pessoa,
-- tente outro") — colapsar as duas custaria exatamente a distinção que o
-- plano pediu em 1.2 da investigação.
--
-- ============================================================================
-- TOCTOU — a lacuna que a investigação (1.6) apontou como conhecida e não
-- resolvida, e que este prompt pediu para fechar
-- ============================================================================
--
-- A pré-checagem "já tenho representante" (`select 1 from representatives
-- where profile_id = auth.uid()`) e a pré-checagem de slug (`select 1 from
-- representatives where slug = p_slug`) têm uma janela de corrida real entre
-- duas chamadas concorrentes — duplo clique, retry de rede — comum, não
-- exótico. A correção: o INSERT roda dentro de um bloco `begin/exception`
-- que captura `unique_violation` e traduz para um resultado tipado, nunca
-- deixando a exceção crua de Postgres escapar pelo RPC — mesmo espírito de
-- "nunca vazar exceção não tratada" que `safeAuthCall`/ADR-020 já aplicam na
-- camada de Server Actions, agora na camada de Postgres.
--
-- Extensão em relação ao que foi pedido, e por quê: `representatives` tem
-- DUAS constraints UNIQUE que o mesmo INSERT pode violar —
-- `representatives_profile_id_key` (auto-gerada pelo `unique` inline em
-- `profile_id`, `20260731000000:160`) e `representatives_slug_key`
-- (auto-gerada pelo `unique` inline em `slug`, `20260731000000:162`).
-- Capturar `unique_violation` genericamente e traduzir tudo para
-- `already_registered` estaria ERRADO no segundo caso: duas contas
-- concorrentes disputando o MESMO slug livre é uma corrida de slug, não uma
-- corrida de "já tenho representante", e reportar a causa errada confundiria
-- quem perdeu a corrida por slug ao ver uma mensagem sobre já ter conta. O
-- bloco `exception` usa `get stacked diagnostics ... constraint_name` para
-- disambiguar as duas constraints e devolver o status certo para cada uma —
-- qualquer outra `unique_violation` (que não deveria existir, dado o schema
-- atual) é relançada (`raise`), não escondida atrás de um status genérico.
--
-- ============================================================================
-- Palavras reservadas de slug — lista definitiva, auditada, não uma lista
-- genérica da internet
-- ============================================================================
--
-- O comentário original (`20260731000000:136-139`) cita "www, api, app,
-- admin" como EXEMPLO, delegando a decisão real para quando este fluxo fosse
-- construído. Esta é essa decisão, auditada contra o código real, não contra
-- a lista de exemplo:
--
-- Auditoria de `src/app/*` (rotas de path no domínio raiz, `setnar.com/*`):
--   app, criar-conta, entrar, esqueci-senha, privacidade, redefinir-senha,
--   termos, auth (via auth/callback), api (via api/leads).
-- Nenhuma dessas colide TECNICAMENTE com um slug de representante — roteamento
-- por host (`src/modules/tenancy`) separa `<slug>.setnar.com` de
-- `setnar.com/<path>` por construção, são hosts diferentes. A reserva é
-- prudência de marca/confusão de usuário (um visitante de `entrar.setnar.com`
-- esperando a tela de login), não uma necessidade de roteamento.
-- `admin` é a única sem rota real hoje — citada no comentário original e
-- alinhada ao Stage 5 do roadmap (administração de Company); reserva
-- preventiva, registrada como tal.
--
-- Auditoria de `setnar.tenant.ts` — dois achados além dos paths:
--   'setnar' (`setnar.tenant.ts:15,20`, o próprio id/marca do tenant) e
--   'igreen' (`setnar.tenant.ts:51`, `vertical.id`, e o slug da Company
--   semeada por `20260803000000`). Nenhum dos dois é excluído por construção
--   hoje: um representante com `slug = 'setnar'` resolveria em
--   `setnar.setnar.com`, e um com `slug = 'igreen'` resolveria em
--   `igreen.setnar.com` — nada em `extractRepresentativeSlug`
--   (`resolve-representative.ts:89-110`) bloqueia isso, porque o bloqueio ali
--   é contra o HOSTNAME INTEIRO já reivindicado (`setnar.com`,
--   `www.setnar.com`, `localhost`), não contra um LABEL igual à marca. Um
--   `igreen.setnar.com` de um representante colidiria semanticamente com a
--   omissão deliberada da marca de terceiro do site do SETNAR
--   (`setnar.tenant.ts:53`) e pareceria, incorretamente, uma página oficial
--   da iGreen ou da própria plataforma.
--
-- Lista final (CHECK constraint + checagem redundante na função — defesa em
-- profundidade, mesmo padrão de `submit_lead` entre CHECK de formato e
-- validação de função):
--   www, app, api, auth, admin, entrar, criar-conta, esqueci-senha,
--   redefinir-senha, termos, privacidade, setnar, igreen
--
-- O que foi considerado e EXCLUÍDO da lista, com o motivo:
--   - `setnar.com` e `localhost` inteiros não entram porque nunca são um
--     LABEL isolado: o host derivado de um slug é sempre `<slug>.setnar.com`,
--     nunca `setnar.com` sozinho, e `localhost` bare só participa como
--     PARENT domain em dev (`extractRepresentativeSlug`), nunca como label
--     candidato. Só `www.setnar.com` tem a forma dupla (label válido E
--     hostname já reivindicado ao mesmo tempo) — por isso só `www` precisa
--     de entrada na lista, mesmo sendo excluído "por construção" na
--     resolução: sem a entrada na lista, o INSERT teria sucesso mesmo assim
--     (a exclusão por construção protege a RESOLUÇÃO da página, não a
--     ESCRITA da linha), deixando um registro permanentemente inalcançável.
--   - Os 7 slugs de produto (`conexao-green`, ...) e a rota dinâmica
--     `[productSlug]` não entram: vivem como PATH sob o subdomínio do
--     PRÓPRIO representante (`<slug>.setnar.com/<produto>`), nunca colidem
--     com o label do slug do representante (hosts diferentes seriam
--     necessários para colidir). Um `slug = 'conexao-green'` é
--     cosmeticamente estranho, não uma colisão técnica, e não foi levantado
--     pela auditoria de `src/app/*` pedida (produtos não são rotas do
--     domínio raiz).
--   - Rotas de asset especiais do Next (`icon.svg`, `opengraph-image`,
--     `robots.txt`, `sitemap.xml`) não entram: são geradas pelo framework,
--     não são páginas navegáveis por humanos, e duas delas nem batem no
--     formato de slug (têm ponto). `opengraph-image` bateria no formato mas
--     não tem superfície de confusão de marca real — excluída
--     deliberadamente, não esquecida.
--   - Companies futuras (Stage 5) além de `igreen` não têm como entrar numa
--     lista ESTÁTICA hoje, porque não existem ainda, e um CHECK constraint
--     não pode fazer subquery contra outra tabela (limitação do Postgres,
--     não deste projeto). Por isso a FUNÇÃO, além de checar a lista estática,
--     também checa `p_slug` contra `companies.slug` dinamicamente — essa
--     checagem é estritamente mais ampla que a do CHECK constraint, não uma
--     cópia dela, e é o que protege qualquer Company futura sem exigir uma
--     migration nova só para atualizar a lista.
--
-- ============================================================================
-- company_id — resolvido no servidor, nunca aceito do chamador
-- ============================================================================
--
-- `(select id from companies where slug = 'igreen')`, nunca um parâmetro —
-- mesmo princípio do `tenant_id` em `handle_new_user()` (ADR-011): uma
-- requisição forjada direto contra a API do Supabase não pode escolher a
-- própria Company. O cabeçalho de `20260803000000` (linhas 59-79) já
-- confirma que este exato subselect por slug funciona no "catálogo misto" do
-- projeto de teste (company/produto pré-existentes com id aleatório,
-- preservados pelo `on conflict do nothing` do seed) — é o mesmo subselect
-- que o próprio insert de produtos daquela migration usa, não um caminho
-- novo e não testado.
--
-- Se o select não achar nada (seed do D1 não aplicado neste ambiente):
-- resultado tipado (`company_not_found`), NUNCA falha crua. Mesmo raciocínio
-- que §3.2 do `docs/SPRINT_D_PLAN.md` já usa para justificar a Opção B
-- inteira ("signup continua funcionando mesmo em ambiente sem catálogo
-- semeado — a falha fica contida na tela de onboarding, visível e
-- recuperável"): deixar a constraint `not null` de `company_id` estourar
-- crua devolveria um erro de Postgres não tratado pelo RPC, em vez de um
-- sinal determinístico que a Server Action da D3.B.4 possa mostrar em
-- português.
--
-- ============================================================================
-- p_display_name — quinto parâmetro, desvio do plano original, decisão do
-- Pedro (Task 1, item 1.7b, opção (i) escolhida)
-- ============================================================================
--
-- O plano original de `docs/SPRINT_D_PLAN.md` §4/D3.B.1 previa copiar
-- `display_name` de `profiles.full_name` dentro da função. Isso foi
-- descartado: `signUpSchema` só exige `NAME_MIN_LENGTH = 2` caracteres
-- (`auth-rules.ts:10`) — "João" passa no cadastro — e a página pública
-- publicaria um bloco de identificação (`licensee-identification-block.tsx`)
-- que a política de uso da marca da iGreen exige conter "nome e sobrenome".
-- Rejeitar com resultado tipado quando `full_name` não tivesse duas palavras
-- (a alternativa considerada) empurraria esse usuário para um beco sem
-- saída: `docs/SPRINT_D_PLAN.md`'s D5b (tela de edição de perfil) nem lista
-- `full_name` entre os campos que ganharão UI de escrita — hoje não existe,
-- e não está planejada, nenhuma tela que deixasse esse usuário corrigir o
-- problema.
--
-- Por isso `p_display_name` é um parâmetro do onboarding, pré-preenchido no
-- formulário (D3.B.4) com `profiles.full_name`, mas validado e gravado como
-- o valor que o usuário efetivamente confirmou — que pode divergir do
-- `full_name` de cadastro. ADR-027 já aceita `display_name` viver numa
-- coluna própria em vez de um join com `profiles.full_name`; esta migration
-- ESTENDE esse precedente para também aceitar DIVERGÊNCIA DE CONTEÚDO entre
-- os dois, não só de localização — ADR-027, sozinho, assumia que o valor
-- seria uma cópia exata. Isso é registrado explicitamente aqui e no ADR-040
-- porque é uma extensão, não uma leitura literal daquele ADR.
--
-- Validação: não vazio, no máximo 80 caracteres (mesmo teto de
-- `NAME_MAX_LENGTH`, `auth-rules.ts`, mas como LITERAL aqui, não import —
-- SQL não importa TypeScript. Os dois números podem divergir com o tempo se
-- um for alterado sem o outro; mesmo risco aceito e já documentado para
-- `LEAD_NAME_MAX_LENGTH` vs. o teto de `p_nome` em `submit_lead`,
-- `20260802000000`), e pelo menos duas palavras separadas por espaço — a
-- forma mínima de "nome e sobrenome" que a política de uso da marca exige.
--
-- ============================================================================
-- p_license_id — placeholder de formato — BLOQUEADOR DE LANÇAMENTO
-- ============================================================================
--
-- ATENÇÃO, LEIA ANTES DE ABRIR CADASTRO PÚBLICO: não existe, neste
-- repositório, nenhuma fonte confirmada do formato real do "ID de
-- identificação" que a política de uso da marca da iGreen exige na página
-- ("Licenciado Autorizado iGreen Energy · ID {licenseId}",
-- `licensee-identification-block.tsx:40`, cópia aprovada por compliance
-- portada verbatim de `templates/commercial-pages/ConexaoGreen/index.html`).
-- A validação abaixo cobre só FORMATO — não vazio após trim, teto de 100
-- caracteres, sem regex de dígitos/checksum/prefixo — porque nenhum formato
-- autoritativo foi confirmado com a iGreen. Abrir cadastro público ANTES
-- dessa confirmação arrisca exatamente a falha de compliance que a política
-- do licenciado existe para evitar: uma página publicando "Licenciado
-- Autorizado iGreen Energy · ID {qualquer string de até 100 caracteres}",
-- sem nenhuma garantia de que aquele ID corresponde a uma licença real. Este
-- teto é um placeholder de forma, nunca uma validação de autenticidade — não
-- existe, e não pode existir dentro de uma função Postgres, uma forma de
-- confirmar contra um registro real da iGreen. Decisão do Pedro, registrada:
-- seguir mesmo assim para D3.B.1, com este aviso explícito, e tratar a
-- confirmação do formato real como item separado antes do lançamento público.
--
-- ============================================================================
-- p_phone / p_city — validação de forma
-- ============================================================================
--
-- Telefone: reaproveita o formato E.164 que `submit_lead` já valida a nível
-- SQL (`^\+[1-9]\d{6,14}$`, `20260802000000`) — não `BR_PHONE_PATTERN`
-- (`lead-rules.ts`), que é a máscara de INPUT do formulário HTML
-- (`(11) 98888-7777`), nunca antes aplicada a nível de banco. E.164 é o
-- padrão externo já precedente NESTA CAMADA (funções SQL), para o mesmo
-- conceito de campo (um telefone que vira link de WhatsApp,
-- `whatsapp-cta.tsx`/ADR-035) — escolher o formato já estabelecido no SQL em
-- vez de inventar um terceiro, como o plano pediu. `representatives.phone`
-- continua `text` livre sem CHECK de coluna (ADR-035 documenta isso como
-- deliberado, porque `toWhatsAppDigits` normaliza o que estiver salvo) —
-- esta validação vive só dentro da função, não vira constraint da coluna,
-- então não quebra nenhuma linha já existente inserida manualmente pelo SQL
-- Editor fora deste formato. Opcional: `null`/string vazia (normalizada para
-- `null`) passam sem checagem — a decisão de exigir telefone para PUBLICAR
-- é do D6, não deste passo de registro.
--
-- Cidade: sem formato externo — mesmo teto de 500 caracteres que
-- `submit_lead` já usa para `p_cidade` (`20260802000000`), generoso o
-- bastante para nunca rejeitar uma cidade real, só payload patológico.
-- Também opcional, mesma normalização de branco-para-null que o telefone.
--
-- ============================================================================
-- O que um chamador direto do RPC (chave publicável + JWT válido, sem Server
-- Action, sem Zod) consegue e não consegue fazer
-- ============================================================================
--
-- Consegue: escolher `p_slug`/`p_display_name`/`p_license_id`/`p_phone`/
-- `p_city` livremente, sujeitos só às validações de forma acima; sondar
-- disponibilidade de slug repetidamente antes de se registrar (ver
-- "Resultado tipado" acima — não é vulnerabilidade dado o destino público do
-- slug, mas uma conta autenticada tem orçamento ilimitado de sondagem antes
-- de completar o próprio onboarding, registrado aqui, não descoberto depois).
-- NÃO consegue: definir `company_id`, `profile_id` ou contornar a checagem
-- de "já tenho representante" — todos resolvidos/checados no servidor,
-- nenhum aceito como parâmetro (ADR-036). NÃO consegue criar um segundo
-- representante para a mesma conta, nem mesmo com duas chamadas concorrentes
-- (ver "TOCTOU" acima). NÃO consegue ler nenhuma linha através desta função —
-- ela só escreve; leitura pós-cadastro passa por `representatives_select_own`
-- (ADR-038).

-- ============================================================================
-- CHECK constraint — backstop de palavras reservadas, protege qualquer
-- caminho de escrita futuro (inclusive SQL Editor manual), não só esta função
--
-- Envolvida num `do $$ ... if not exists ...`  porque `alter table ... add
-- constraint` (ao contrário de `create or replace function` ou `drop policy
-- if exists` + `create policy`) não é idempotente por padrão — rodar este
-- arquivo uma segunda vez sem essa guarda falharia com "constraint already
-- exists", quebrando a regra deste projeto de que reaplicar uma migration
-- inteira tem que ser seguro (mesmo espírito do `on conflict do nothing` de
-- `20260803000000` e do `drop policy if exists` de `20260805000000`).
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'representatives_slug_not_reserved'
      and conrelid = 'public.representatives'::regclass
  ) then
    alter table public.representatives
      add constraint representatives_slug_not_reserved
      check (
        slug <> all (array[
          'www', 'app', 'api', 'auth', 'admin',
          'entrar', 'criar-conta', 'esqueci-senha', 'redefinir-senha',
          'termos', 'privacidade',
          'setnar', 'igreen'
        ])
      );
  end if;
end;
$$;

-- ============================================================================
-- register_representative
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
  -- (20260731000000:164). Checado antes de qualquer consulta ao banco:
  -- barato, e não deve vazar estado do banco (slug livre ou não) para um
  -- valor que nunca poderia ser um slug de qualquer forma.
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return query select 'slug_invalid'::text, null::uuid;
    return;
  end if;

  -- Palavra reservada — lista estática, ver cabeçalho desta migration. Nunca
  -- um parâmetro do chamador (ADR-036).
  if p_slug = any (array[
    'www', 'app', 'api', 'auth', 'admin',
    'entrar', 'criar-conta', 'esqueci-senha', 'redefinir-senha',
    'termos', 'privacidade',
    'setnar', 'igreen'
  ]) then
    return query select 'slug_invalid'::text, null::uuid;
    return;
  end if;

  -- display_name: não vazio, teto de 80 caracteres (mesmo número de
  -- NAME_MAX_LENGTH em auth-rules.ts, literal aqui — ver cabeçalho), e pelo
  -- menos duas palavras separadas por espaço.
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
  -- no cabeçalho desta migration.
  v_license_id := trim(p_license_id);
  if v_license_id is null or length(v_license_id) = 0 or length(v_license_id) > 100 then
    return query select 'license_id_invalid'::text, null::uuid;
    return;
  end if;

  -- phone: opcional; se presente, precisa ser E.164 (mesmo regex de
  -- submit_lead, 20260802000000).
  if v_phone is not null and v_phone !~ '^\+[1-9]\d{6,14}$' then
    return query select 'phone_invalid'::text, null::uuid;
    return;
  end if;

  -- city: opcional; se presente, teto de 500 caracteres (mesmo número de
  -- p_cidade em submit_lead).
  if v_city is not null and length(v_city) > 500 then
    return query select 'city_invalid'::text, null::uuid;
    return;
  end if;

  -- company_id: resolvido no servidor, nunca aceito do chamador — ver
  -- cabeçalho desta migration. Ausência do seed do D1 vira resultado tipado,
  -- não falha crua.
  select id into v_company_id from public.companies where slug = 'igreen';
  if v_company_id is null then
    return query select 'company_not_found'::text, null::uuid;
    return;
  end if;

  -- Checagem dinâmica contra Companies reais — estritamente mais ampla que o
  -- CHECK constraint (que não pode fazer subquery entre tabelas): cobre
  -- qualquer Company futura (Stage 5) sem exigir uma migration nova só para
  -- atualizar a lista estática de palavras reservadas.
  if exists (select 1 from public.companies where slug = p_slug) then
    return query select 'slug_invalid'::text, null::uuid;
    return;
  end if;

  -- Pré-checagem "já tenho representante" — a corrida real (duplo clique,
  -- retry) é fechada pelo bloco exception no INSERT abaixo, não por esta
  -- checagem sozinha.
  if exists (select 1 from public.representatives where profile_id = auth.uid()) then
    return query select 'already_registered'::text, null::uuid;
    return;
  end if;

  -- Pré-checagem de slug em uso — mesma ressalva: o bloco exception abaixo é
  -- a garantia real contra a corrida.
  if exists (select 1 from public.representatives where slug = p_slug) then
    return query select 'slug_taken'::text, null::uuid;
    return;
  end if;

  begin
    insert into public.representatives (profile_id, company_id, slug, display_name, license_id, phone, city)
    values (auth.uid(), v_company_id, p_slug, v_display_name, v_license_id, v_phone, v_city)
    returning id into v_new_id;
  exception
    when unique_violation then
      -- Disambigua qual das duas UNIQUE de representatives foi violada — ver
      -- "TOCTOU" no cabeçalho desta migration para por que as duas precisam
      -- de status diferentes, não um genérico só.
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'representatives_profile_id_key' then
        return query select 'already_registered'::text, null::uuid;
        return;
      elsif v_constraint = 'representatives_slug_key' then
        return query select 'slug_taken'::text, null::uuid;
        return;
      else
        -- Qualquer outra unique_violation não é esperada pelo schema atual —
        -- relança em vez de esconder atrás de um status genérico.
        raise;
      end if;
  end;

  return query select 'created'::text, v_new_id;
end;
$$;

revoke execute on function public.register_representative(text, text, text, text, text) from public;
grant execute on function public.register_representative(text, text, text, text, text) to authenticated;
