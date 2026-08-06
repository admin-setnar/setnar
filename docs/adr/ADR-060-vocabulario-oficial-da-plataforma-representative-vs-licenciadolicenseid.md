### ADR-060 — Vocabulário oficial da plataforma: `Representative` vs. "licenciado"/`license_id`

**Decisão.** `Representative` é o único termo de domínio válido para nome
de campo, tabela, tipo, componente e código de erro. "Licenciado
Autorizado iGreen Energy" (e qualquer variação de "licenciado"/"licensee")
passa a ser tratado exclusivamente como **string de exibição configurada
por tenant** — nunca como nome de campo, tabela, componente ou tipo. Este
ADR é uma decisão de vocabulário; não executa nenhum rename.

**Contexto.** O achado A4 da auditoria de reconciliação
(`docs/AUDIT_CONSTITUTION_RECONCILIATION.md`) mapeou onde "licenciado"/
"license" vazou do contrato da iGreen para nomenclatura de domínio.
Confirmado por `grep -rn "license_id\|Licensee\|licenseId" src/ supabase/`
nesta data:
- Coluna `representatives.license_id`
  (`supabase/migrations/20260731000000_create_representative_domain.sql:176`,
  também referenciada em `20260806000000_add_register_representative.sql`
  e `20260808000000_add_update_representative_profile.sql`).
- Parâmetros `p_license_id`/`v_license_id` das funções `SECURITY DEFINER`
  `register_representative` e `update_representative_profile`.
- Campo `Representative.licenseId`
  (`src/modules/representatives/domain/representative.ts`), propagado por
  todo o módulo `representatives` (domain, infrastructure, presentation —
  gateways, repositórios, schemas, formulários).
- Código de erro `license_id_invalid`, presente em 6 arquivos:
  `representative-onboarding-gateway.ts`,
  `representative-profile-gateway.ts` (domain),
  `map-register-representative-result.ts`,
  `map-update-representative-profile-result.ts` (infrastructure),
  `representative-onboarding-error-messages.ts`,
  `representative-profile-error-messages.ts` (presentation).
- Componente `LicenseeIdentificationBlock`
  (`src/modules/representatives/presentation/licensee-identification-block.tsx`),
  que renderiza a string fixa "Licenciado Autorizado iGreen Energy · ID
  {licenseId}" — copy compliance-aprovada, portada verbatim de
  `templates/commercial-pages/ConexaoGreen/index.html` (ver ADR-033).

`DOMAIN_MODEL.md` já define "Representative" como termo único da
linguagem ubíqua da SETNAR. "Licenciado"/"licensee" nunca foi um conceito
de domínio — é vocabulário de UM contrato (iGreen), exatamente o tipo de
acoplamento que `PRODUCT_CONSTITUTION.md` eleva a princípio permanente
(Core Belief 8: arquitetura e vocabulário devem descrever uma segunda
organização tão facilmente quanto a primeira). Um segundo cliente que
chame seus representantes de "corretores" herdaria um componente chamado
`LicenseeIdentificationBlock` sem nenhum sentido.

**Dívida técnica rastreada por este ADR (não executada aqui):**
- `representatives.license_id` → `representatives.authorization_id`
  (coluna, via migration futura).
- `Representative.licenseId` → `Representative.authorizationId` (domínio,
  propagado a todo o módulo).
- `license_id_invalid` → `authorization_id_invalid` (código de erro, nos
  6 arquivos listados acima).
- `p_license_id`/`v_license_id` → `p_authorization_id`/`v_authorization_id`
  (parâmetros das funções `SECURITY DEFINER`).
- `LicenseeIdentificationBlock` → `AuthorizedRepresentativeIdentificationBlock`
  (componente; arquivo `licensee-identification-block.tsx` →
  `authorized-representative-identification-block.tsx`).

A string visível "Licenciado Autorizado iGreen Energy · ID {id}" **não
muda** — é copy compliance-aprovada e é exatamente o tipo de dado que deve
ficar configurado por tenant, não removida.

**O que este ADR explicitamente não faz.** Não renomeia nenhuma coluna,
função, tipo, arquivo ou componente — isso é o Passo 7 do plano de
reconciliação, tarefa subsequente dependente deste ADR. Não altera
nenhuma migration já aplicada (`20260731000000`, `20260806000000`,
`20260808000000` permanecem como registradas, pelo mesmo princípio de
"Migration rule" já em vigor neste log). Não toca em
`COMMERCIAL_PAGE_CONTENT_PLAN.md`, `QR_ANALYTICS_PLAN.md` ou
`SPRINT_D_PLAN.md` — isso é o Passo 8, também dependente deste ADR. Não
resolve o bloqueador de lançamento já documentado em
`20260806000000_add_register_representative.sql` (linha ~266) sobre o
formato real de `license_id` — aquele é um problema de validação de
formato, não de nomenclatura, e segue fora de escopo. Não reabre ou
reescreve ADR-033 ou ADR-040 — ambos permanecem registrados como estavam
no momento em que foram decididos; a nomenclatura que documentam é
histórica, não contraditória com a decisão deste ADR, que rege apenas
código futuro.

**Custo de reversão.** Baixo — é só uma decisão registrada; nenhum
código, coluna ou arquivo foi tocado.

---
