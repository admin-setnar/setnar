# Supabase — setup manual

Passos que só podem ser feitos no painel do Supabase ou na Vercel, fora do
alcance do código e das migrations versionadas neste repositório. Nenhum
deles usa a service role key — ela não entra no projeto nesta sprint.

## 1. Aplicar as migrations, nesta ordem, todas as três

São cumulativas — aplique as três, em ordem, nunca só a primeira. Cole cada
arquivo no SQL Editor do projeto e execute, ou rode `supabase db push` se
preferir a CLI.

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
