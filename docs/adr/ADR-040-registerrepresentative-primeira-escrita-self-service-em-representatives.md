### ADR-040 — `register_representative()`, primeira escrita self-service em `representatives`; grant só a `authenticated`, nunca a `anon`
**Decisão.** `supabase/migrations/20260806000000_add_register_representative.sql`
cria `register_representative(p_slug, p_display_name, p_license_id, p_phone,
p_city)`, `security definer`, `set search_path = public`, `language
plpgsql`, `returns table (status text, representative_id uuid)`, mais a
CHECK constraint `representatives_slug_not_reserved` sobre
`representatives.slug`. Passo D3.B.1 de `docs/SPRINT_D_PLAN.md`
(Opção B do §3, onboarding explícito pós-login, fechada em 2026-08-01).
Nenhuma migration já aplicada foi editada.
**A lacuna que fecha.** Até aqui, a única forma de criar uma linha em
`representatives` era o SQL Editor manual (`representatives`/
`product_activations` não têm policy de INSERT, e este projeto não tem
service role key). Esta função é o primeiro caminho de escrita self-service
do domínio do Representative — o passo que faz "criar conta" e "ter uma
página comercial" deixarem de exigir intervenção manual entre os dois.
**Por que `grant execute ... to authenticated`, nunca `anon` — ao contrário
de `submit_lead`.** `submit_lead` é `anon` porque o chamador real é um
visitante sem sessão. Aqui a lógica inteira depende de `auth.uid()` ser uma
identidade real: "este usuário já tem representante?" e "a quem pertence a
nova linha?" não fazem sentido sem uma. Concedida a `anon`, uma chamada sem
sessão teria `auth.uid()` nulo — a pré-checagem de "já registrado" nunca
casaria, e o INSERT bateria de frente na constraint `not null` de
`representatives.profile_id`, vazando um erro cru de Postgres pelo RPC em
vez de um resultado tipado. Não há caminho anônimo legítimo; a porta fica
fechada na concessão (`revoke ... from public` + `grant ... to
authenticated`), não numa checagem que poderia ter um furo.
**Dois desvios do plano original de `docs/SPRINT_D_PLAN.md` §4/D3.B.1,
registrados aqui porque são desvios, não uma leitura literal do plano:**
1. **`p_display_name` é um quinto parâmetro**, não previsto na assinatura
   original (`p_slug, p_license_id, p_phone, p_city`). O plano previa copiar
   `display_name` de `profiles.full_name` dentro da função — descartado
   porque `signUpSchema` só exige `NAME_MIN_LENGTH = 2` caracteres
   (`auth-rules.ts:10`, "João" passa no cadastro) e a política de uso da
   marca da iGreen exige "nome e sobrenome" no bloco de identificação
   (`licensee-identification-block.tsx:40`). A alternativa — copiar de
   `full_name` e rejeitar quando tiver menos de duas palavras — empurraria
   esse usuário para um beco sem saída: `docs/SPRINT_D_PLAN.md`'s D5b (tela
   de edição de perfil) nem lista `full_name` entre os campos que ganharão
   UI de escrita. `p_display_name` chega pré-preenchido no formulário de
   onboarding (D3.B.4) com `full_name`, mas é validado e gravado como o
   valor que o usuário efetivamente confirmou — que pode divergir do nome de
   cadastro. **Isto estende ADR-027**, não só o cita por analogia: aquele
   ADR justifica `display_name` viver numa coluna própria em vez de um join
   com `profiles.full_name`, mas assumia implicitamente que o valor seria
   uma CÓPIA; esta migration aceita também DIVERGÊNCIA DE CONTEÚDO entre os
   dois, uma extensão do precedente, não uma aplicação direta dele.
2. **A correção de TOCTOU no INSERT** (ver abaixo) não estava prevista na
   investigação original (Task 1, item 1.6, que listou a corrida como lacuna
   conhecida e não resolvida) — o Pedro pediu explicitamente para fechá-la
   nesta migration, não deixá-la para depois.
**TOCTOU fechado no INSERT, não só na pré-checagem.** A pré-checagem "já
tenho representante" e a pré-checagem de slug livre têm uma janela de
corrida real entre duas chamadas concorrentes da mesma conta (duplo clique,
retry de rede) — comum, não exótico. O INSERT roda dentro de um bloco
`begin/exception` que captura `unique_violation`, usa `get stacked
diagnostics ... constraint_name` para disambiguar QUAL das duas constraints
UNIQUE de `representatives` foi violada (`representatives_profile_id_key`
vs. `representatives_slug_key` — auto-geradas pelas duas colunas `unique`
inline, `20260731000000:160,162`), e traduz cada uma para o status tipado
correto (`already_registered` vs. `slug_taken`). Colapsar as duas num status
genérico estaria errado: uma corrida de slug entre duas contas diferentes
não é a mesma coisa que "você já tem representante", e reportar a causa
errada confundiria quem perdeu a corrida de slug. Qualquer outra
`unique_violation` (inesperada pelo schema atual) é relançada, nunca
escondida atrás de um status genérico — mesmo espírito de "nunca vazar
exceção não tratada" que `safeAuthCall`/ADR-020 já aplicam na camada de
Server Actions.
**Resultado tipado, não booleano.** Diferente de `submit_lead` (anti-
enumeração deliberada, ADR-018/ADR-030/ADR-036), aqui o chamador já precisa
estar autenticado — uma barra mais alta — e o dado mais sensível que uma
rejeição poderia vazar (que um slug já existe) tem destino público por
construção (regra 12, `DOMAIN_MODEL.md:565`; `representatives_select_public`
já expõe publicamente o slug de todo representante ativo com ativação
publicada). Vocabulário: `created`, `company_not_found`,
`already_registered`, `slug_invalid` (formato ou palavra reservada — uma
propriedade do INPUT), `slug_taken` (uma propriedade do ESTADO do banco),
`display_name_invalid`, `license_id_invalid`, `phone_invalid`,
`city_invalid`. `slug_invalid` e `slug_taken` são deliberadamente estados
diferentes, não colapsados — ver o cabeçalho da migration.
**Palavras reservadas — lista auditada, não a lista de exemplo do comentário
original.** `20260731000000:136-139` citava "www, api, app, admin" como
EXEMPLO. A lista real, auditada contra `src/app/*` e `setnar.tenant.ts`:
`www, app, api, auth, admin, entrar, criar-conta, esqueci-senha,
redefinir-senha, termos, privacidade, setnar, igreen`. Só `www` tem colisão
FUNCIONAL (`www.setnar.com` já é hostname literal do tenant SETNAR —
`extractRepresentativeSlug` nunca chegaria a resolver esse slug, então sem a
reserva o INSERT teria sucesso mesmo assim, deixando um registro
permanentemente inalcançável); o resto é prudência de marca/confusão
(`app`/`api`/`auth` são rotas reais do domínio raiz sem colisão técnica —
hosts diferentes —, mas confusas; `admin` não tem rota real hoje, reserva
preventiva alinhada ao Stage 5; `setnar`/`igreen` são a marca do tenant e da
Company semeada, e um representante com esses slugs resolveria em
`setnar.setnar.com`/`igreen.setnar.com`, nada bloqueia isso hoje na
resolução). Implementada como CHECK constraint (backstop de qualquer escrita
futura, inclusive SQL Editor manual) **e** checagem redundante dentro da
função — nunca como parâmetro do chamador (ADR-036). A função ADICIONALMENTE
checa `p_slug` contra `companies.slug` dinamicamente, mais ampla que o CHECK
(que não pode fazer subquery entre tabelas): cobre qualquer Company futura
do Stage 5 sem exigir uma migration nova só para atualizar a lista estática.
**`p_license_id` — BLOQUEADOR DE LANÇAMENTO, decisão do Pedro.** Validação
só de FORMATO (não vazio, teto de 100 caracteres, sem regex de
dígitos/checksum/prefixo) porque não existe, neste repositório, fonte
confirmada do formato real do ID de licenciado exigido pela política de uso
da marca da iGreen. Abrir cadastro público antes de confirmar esse formato
com a iGreen arrisca publicar "Licenciado Autorizado iGreen Energy · ID
{qualquer string}" sem garantia de correspondência a uma licença real — a
exata falha de compliance que a política existe para evitar. Registrado em
destaque no cabeçalho da migration; não resolvido, nem resolvível dentro de
uma função Postgres (não há registro externo da iGreen para confirmar
autenticidade).
**`p_phone`/`p_city` — validação de forma, formato já precedente na camada
SQL.** Telefone reaproveita o E.164 que `submit_lead` já valida
(`^\+[1-9]\d{6,14}$`), não `BR_PHONE_PATTERN` (`lead-rules.ts`, máscara de
input HTML, nunca antes aplicada a nível de banco) — escolhido por já ser o
padrão estabelecido nesta camada (funções SQL) para o mesmo conceito de
campo, em vez de inventar um terceiro formato.
`representatives.phone` continua `text` livre sem CHECK de coluna (ADR-035
é deliberado sobre isso); a validação vive só dentro da função. Cidade usa o
mesmo teto de 500 caracteres que `submit_lead` já usa para `p_cidade` — sem
formato externo, só um teto contra payload patológico. Ambos opcionais,
string vazia normalizada para `null`.
**Teste automatizado, e o que ele NÃO cobre.**
`tests/register-representative.integration.test.ts` automatiza só a
rejeição anônima — a função é autenticada por natureza, e sem service role
key não há forma de criar uma conta descartável por rodada de CI e depois
apagá-la (`representatives` não tem policy de DELETE). O caminho
autenticado é um roteiro manual (`supabase/README.md`, passo 10): caminho
feliz, colisão de slug entre duas contas reais, rejeição de palavra
reservada, "já registrado" numa segunda chamada da mesma conta, e uma
simulação (não uma prova real) de concorrência via `Promise.all` — o próprio
roteiro documenta que duas chamadas "quase juntas" no mesmo processo não
garantem sobreposição real de transações no Postgres; um teste de
concorrência de verdade fica fora do escopo do D3.B.1.
**Custo de reversão.** Baixo enquanto nenhum representante real existir —
`drop function` mais `alter table ... drop constraint` desfazem; médio
depois que houver linhas reais em `representatives` criadas por este
caminho (mesma classe de custo que ADR-037 já registra para os UUIDs
literais do catálogo).
