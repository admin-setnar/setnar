### ADR-081 — Recuperação de senha entre dispositivos: `token_hash` + `verifyOtp()` complementa o PKCE `code`, não o substitui (SET-40)

**Status:** Accepted
**Date:** 2026-08-11
**Related:** Corrects a limitation accepted (not fixed) by ADR-022; `app/auth/callback/route.ts` is the same Route Handler ADR-022/ADR-023 already describe; reuses `AuthErrorCode.reset_link_expired` from ADR-022 without changing it.

#### Contexto e problema

O fluxo de redefinição de senha (ADR-022) usa `exchangeCodeForSession(code)`
em `app/auth/callback/route.ts` — o mecanismo de troca do fluxo PKCE, que é
o `flowType` padrão do `@supabase/ssr` instalado (nunca sobrescrito em
nenhum client do repo). A própria documentação do Supabase é explícita: o
verificador do PKCE é criado e guardado localmente quando o fluxo começa, e
a troca do código **precisa acontecer no mesmo navegador e dispositivo**
que iniciou o fluxo.

Na prática: pedir a redefinição no desktop e abrir o e-mail no celular —
cenário comum, não incomum — falha. Pior, falha **silenciosamente**:
`exchangeCodeForSession()` retorna erro, e o handler colapsava esse caso no
mesmo redirect genérico usado para link expirado ou já usado, sem nenhum
parâmetro ou sinal que `/esqueci-senha` pudesse usar para explicar o que
aconteceu — a página renderizava o formulário vazio de sempre, como se
nada tivesse sido tentado.

Essa limitação já estava documentada como conhecida e aceita em
`supabase/README.md` desde antes deste ADR, incluindo a correção que a
própria Supabase recomenda para evitar exatamente esse problema: trocar
para `token_hash` + `verifyOtp({ type: 'recovery', token_hash })`, uma
verificação puramente server-side contra a API do Supabase Auth, sem
nenhum estado local dependente do navegador que originou o pedido.

#### Alternativas consideradas

1. **Substituir `exchangeCodeForSession()` por `verifyOtp()` inteiramente,
   removendo o branch `code`.** Rejeitada por ora: `/auth/callback` é
   alimentado pelo `href` que o template de e-mail "Reset Password" do
   painel Supabase gera, e esse template é configuração de dashboard — não
   existe `config.toml` neste repo, nada versiona essa troca junto do
   deploy do código. Trocar o template e fazer deploy do código são dois
   atos independentes, sem CI/staging separado neste projeto para
   coordená-los. Remover o branch `code` criaria uma janela em que
   qualquer e-mail de reset já enviado (ou o próprio template, se a troca
   no painel atrasar) simplesmente para de funcionar.
2. **Trocar o `flowType` do cliente Supabase para `implicit`.** Rejeitada:
   descontinuado pela própria Supabase para fluxos de reset/magic link
   (menos seguro — expõe o token no fragmento da URL) e afetaria qualquer
   outro uso futuro do mesmo client, não só este fluxo. `verifyOtp()`
   resolve o problema específico sem mexer em nada global.
3. **Adicionar `token_hash`/`verifyOtp()` como branch novo, mantendo `code`
   como fallback.** Escolhida — ver Decisão.

#### Decisão

`app/auth/callback/route.ts` ganha um branch novo, avaliado antes do
existente: se `token_hash` e `type=recovery` estão presentes na query
string, chama `supabase.auth.verifyOtp({ type: 'recovery', token_hash })`.
Sucesso segue o mesmo caminho de sempre (`redirect` para `next`,
revalidado por `safeRedirectTarget` — ADR-023, inalterado). `type` é
restrito ao literal `'recovery'`: esta rota nunca teve outro consumidor, e
qualquer outro `EmailOtpType` (`signup`, `invite`, etc.) é ignorado em vez
de confiado.

O branch `code`/`exchangeCodeForSession()` **permanece**, como fallback —
não é dead code, é a garantia de que nada quebra até o template "Reset
Password" do painel Supabase ser trocado para apontar para
`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha`
em vez do `{{ .ConfirmationURL }}` padrão (passo documentado em
`supabase/README.md`, fora do alcance de qualquer migration ou deploy de
código).

Qualquer falha nos dois branches — ou nenhum parâmetro reconhecido — agora
redireciona para `/esqueci-senha?error=reset_link_expired`, reaproveitando
o `AuthErrorCode` que ADR-022 já definia para "link expirado ou já usado"
(copy já existente em `auth-error-messages.ts`, sem alteração). Nenhum
código ou mensagem novos foram criados — só um sinal novo carregando um
significado que já existia. `/esqueci-senha/page.tsx` lê esse parâmetro e
o valida contra uma allow-list de um único valor literal antes de repassar
ao `ForgotPasswordForm` (via nova prop `initialFailureCode`): a rota é
alcançável por e-mail, logo tão atacável quanto qualquer outra entrada da
aplicação, e nada aqui reflete texto arbitrário da query string de volta
para a página.

#### Consequências

- O critério de aceite central do SET-40 — link funciona em dispositivo
  diferente do que pediu — passa a depender só da troca do template no
  painel Supabase, documentada em `supabase/README.md`; nenhuma mudança
  de schema, RLS ou migration foi necessária.
- Link expirado/já usado deixa de ser silencioso: `/esqueci-senha` agora
  mostra a mesma mensagem "Este link expirou ou já foi usado" que
  `/redefinir-senha` já mostrava para o caso de sessão ausente — os dois
  pontos de entrada do mesmo erro agora têm a mesma cara.
- Reuso de link continua rejeitado sem código novo: tokens de recovery do
  GoTrue são single-use por padrão, então uma segunda tentativa de
  `verifyOtp()` já falha por conta própria e cai no mesmo redirect com
  sinal de erro.
- Débito aceito conscientemente: por algum tempo (até o template do painel
  ser confirmado em produção) a rota mantém dois branches fazendo a mesma
  coisa por dois mecanismos diferentes. Remover o branch `code` fica para
  um follow-up depois dessa confirmação — não faz parte deste ADR.

#### Rollback conceitual

Reversão puramente de aplicação, sem nenhuma migration para desfazer:
remover o branch `token_hash`/`verifyOtp()` de `route.ts`, reverter
`/esqueci-senha/page.tsx` e `ForgotPasswordForm` para não lerem
`initialFailureCode`, e reverter o template "Reset Password" do painel
Supabase para `{{ .ConfirmationURL }}`. O branch `code` legado nunca deixa
de existir neste ADR, então a reversão não depende de nenhuma coordenação
com o painel — o pior caso é voltar exatamente ao comportamento anterior.
