### ADR-083 — CI (GitHub Actions) roda `npm run verify` em todo PR/push para `develop`/`main` (SET-51)
**Status.** Accepted. **Date.** 2026-08-11.

**Contexto.** `README.md` já afirmava "`npm run verify` é o check autoritativo — precisa
estar verde antes de qualquer [merge]", mas nada impunha isso: era disciplina manual,
sem workflow versionado. SET-51 pediu para tornar essa regra executável.

**Decisão.** `.github/workflows/verify.yml`: um job único (`ubuntu-latest`,
`timeout-minutes: 15`) que roda em todo `pull_request` e em `push` para `develop`/`main`,
faz `actions/checkout` + `actions/setup-node` (versão lida de `.nvmrc`, criado por esta
mesma mudança com `24`, a major já em uso na máquina de desenvolvimento) com cache do
`npm`, `npm ci`, e então `npm run verify` — sem reimplementar seus passos
(`typecheck && lint && test && test:integration && build`) na CI; o script continua
sendo a única fonte de verdade sobre o que "verificado" significa.

**Por que passar as oito variáveis de `.env.example` como `secrets.*`, e não
condicionar/pular `test:integration` quando ausentes.** `scripts/require-integration-env.mjs`
(ADR-017) existe especificamente para falhar alto quando `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` estão ausentes —
o objetivo declarado do script é impedir exatamente o padrão "CI verde por engano" que um
`if: secrets.X != ''` reproduziria. Pular a suíte privilegiada quando os secrets faltam
manteria a CI formalmente verde sem nunca ter exercitado RLS/analytics/leads — o mesmo
problema que motivou o script. `LOGIN_ATTEMPT_SALT`, `ANALYTICS_IP_SALT`,
`ASAAS_API_KEY`, `ASAAS_BASE_URL` e `ASAAS_WEBHOOK_TOKEN` entram pelo mesmo caminho por
serem lidos por código exercitado no mesmo `npm run verify` (build inclui rotas que os
importam). `NEXT_PUBLIC_SITE_URL`/`NEXT_PUBLIC_DEFAULT_TENANT` não são segredos —
ficam com valor fixo direto no `env:` do job, iguais ao `.env.example`.

**Consequência operacional, não fechada por esta ADR.** O workflow, sozinho, não torna
`test:integration` executável — precisa que alguém com acesso ao repositório configure
os oito secrets em *Settings → Secrets and variables → Actions*, apontando para um
projeto Supabase **descartável** (nunca produção — `.env.example` já diz isso) com todas
as migrations aplicadas, e para credenciais de sandbox do Asaas. Isso é decisão/provisionamento
de infraestrutura compartilhada, fora do que esta mudança de código faz sozinha; até que
aconteça, os primeiros runs de `verify` falham em `test:integration` por design do próprio
script — não é regressão desta ADR, é o script fazendo o que o ADR-017 já pedia. Achado
relacionado, não corrigido aqui: o branch Supabase `develop` (`smspbjmqhpjcjilzoexr`,
preview branch ligado ao git branch `develop`) está em `MIGRATIONS_FAILED`; pode ser
candidato natural ao projeto descartável acima, mas primeiro precisa ficar saudável.

**"Status obrigatório" (branch protection) também não é feito por esta ADR.** Exigir o
check `verify` antes de merge em `develop`/`main` é uma mudança de regra de colaboração
via GitHub (branch protection rules), não um arquivo de código — decisão explícita de quem
tem acesso admin ao repositório, não algo que este workflow implica sozinho.

**Reversal cost.** Baixo — um workflow e um `.nvmrc`, nenhuma mudança em `package.json`
nem nos scripts que ele chama; remover o arquivo desliga a CI sem afetar `npm run verify`
local.
