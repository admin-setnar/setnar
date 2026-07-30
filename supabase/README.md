# Supabase — setup manual

Passos que só podem ser feitos no painel do Supabase ou na Vercel, fora do
alcance do código e das migrations versionadas neste repositório. Nenhum
deles usa a service role key — ela não entra no projeto nesta sprint.

## 1. Aplicar a migration

Cole o conteúdo de `supabase/migrations/20260728000000_create_profiles.sql`
no SQL Editor do projeto e execute, ou rode `supabase db push` se preferir a
CLI. Cria: `profiles`, `login_attempts`, as funções `current_terms_version()`,
`handle_new_user()`, `is_login_blocked()`, `record_login_failure()`,
`clear_login_attempts()`, e os triggers/policies associados.

## 2. Desativar a confirmação de e-mail

**Authentication → Providers → Email → "Confirm email" = desligado.**

Sem isso, `auth.signUp()` não devolve uma sessão ativa na hora — a conta é
criada mas fica pendente de confirmação, e a tela de sucesso do modal não tem
usuário autenticado para mostrar o nome. Esse é o comportamento assumido em
todo o fluxo desta sprint.

## 3. Configurar Authentication → Rate Limits conscientemente

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

## 4. Variáveis de ambiente na Vercel

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

## 5. Região das funções na Vercel

Confirmar que o projeto Vercel está configurado para rodar as funções em
`gru1` (São Paulo) — mesma região do projeto Supabase, para latência mínima
entre a aplicação e o banco.
