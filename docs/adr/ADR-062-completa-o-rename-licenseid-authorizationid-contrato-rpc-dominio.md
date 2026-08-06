### ADR-062 — Completa o rename `license_id` → `authorization_id`: contrato RPC, domínio, componente (Passo 7b)

**Decisão.** Os cinco itens que o ADR-061 deixou como dívida técnica
pendente estão executados. Com este ADR, **a dívida técnica registrada
pelo ADR-060 está fechada por completo** — não resta nenhuma ocorrência de
"license"/"licensee"/"licensed" em `src/` ou `tests/`, exceto a string
visível compliance-aprovada (ver abaixo).

**O que muda.**
- `supabase/migrations/20260814000000_rename_representatives_rpc_license_id_to_authorization_id.sql` —
  `register_representative`/`update_representative_profile` recriadas com
  `p_authorization_id`/`v_authorization_id` no lugar de
  `p_license_id`/`v_license_id`, e status de retorno
  `'authorization_id_invalid'` no lugar de `'license_id_invalid'`. Corpo
  (ordem de validação, limites por campo) idêntico — só nomes mudam,
  confirmado por diff estrutural contra `20260813000000`.
- `Representative.licenseId` → `Representative.authorizationId`
  (`domain/representative.ts`), propagado através de
  `RegisterRepresentativeInput`/`UpdateRepresentativeProfileInput`
  (`domain/representative-onboarding-gateway.ts`,
  `domain/representative-profile-gateway.ts`), dos dois repositórios
  Supabase e do fixture em memória
  (`infrastructure/in-memory-representative-repository.ts`).
- `license_id_invalid` → `authorization_id_invalid` nos dois union types de
  rejeição e nos dois mapeadores de resultado RPC
  (`map-register-representative-result.ts`,
  `map-update-representative-profile-result.ts`), nas duas tabelas de
  copy de erro (`representative-onboarding-error-messages.ts`,
  `representative-profile-error-messages.ts` — a MENSAGEM visível ao
  usuário não muda, só a chave).
- `LICENSE_ID_MAX_LENGTH` → `AUTHORIZATION_ID_MAX_LENGTH`
  (`domain/representative-rules.ts`).
- `LicenseeIdentificationBlock` → `AuthorizedRepresentativeIdentificationBlock`;
  arquivo `presentation/licensee-identification-block.tsx` →
  `presentation/authorized-representative-identification-block.tsx`,
  atualizado no único importador real,
  `src/app/[productSlug]/page.tsx` (confirmado por grep — nenhum outro
  módulo referenciava o componente).
- Os dois formulários (`OnboardingForm`, `RepresentativeProfileForm`), os
  dois schemas Zod
  (`schemas/representative-onboarding.schema.ts`,
  `schemas/representative-profile.schema.ts`) e `presentation/actions.ts` —
  campo `licenseId` → `authorizationId` em todo o binding
  `react-hook-form`/Zod/Server Action. Este conjunto não estava listado
  no ADR-060 original (que mapeou 6 arquivos pelo código de erro); uma
  varredura adicional por `licenseId` (não só `license_id_invalid`)
  encontrou 16 arquivos ao todo — este ADR cobre o conjunto completo, não
  só a lista original.
- Todos os 6 arquivos de teste que exercitavam o vocabulário antigo
  (`tests/map-register-representative-result.test.ts`,
  `tests/map-update-representative-profile-result.test.ts`,
  `tests/register-representative.test.ts`,
  `tests/register-representative.integration.test.ts`,
  `tests/representative-onboarding-schema.test.ts`,
  `tests/representative-profile-schema.test.ts`).

**O que não muda.** A string visível "Licenciado Autorizado iGreen Energy
· ID {id}" (copy compliance-aprovada, ADR-033) — inalterada em
`authorized-representative-identification-block.tsx`; só o nome do
componente/arquivo/prop muda, nunca o texto que o visitante vê. Nenhum
label de formulário visível ao usuário muda. Nenhuma migration já
aplicada (nem `20260813000000`) foi editada. O bloqueador de lançamento
sobre o formato real de `authorization_id` (ex-`license_id`) — nenhuma
fonte confirmada do formato real do ID iGreen, registrado desde
`20260806000000` — permanece fora de escopo, como já era.

**Por que o rename de RPC precisa acontecer no mesmo commit que o código
de aplicação.** Ao contrário do rename de coluna (7a, transparente para
qualquer chamador), um `create or replace function` que muda NOME DE
PARÂMETRO quebra qualquer chamada `.rpc(..., { p_license_id: ... })` feita
por código que ainda não foi atualizado — não há uma janela seguro de
deploy parcial aqui. Por isso a migration `20260814000000` e as mudanças em
`supabase-representative-onboarding-gateway.ts`/
`supabase-representative-profile-gateway.ts` (que fazem a chamada RPC) são
parte do mesmo commit deste ADR.

**Validação.** `grep -rniln "license" src/ tests/` retorna zero arquivos
(critério de conclusão explícito) — restam apenas a menção histórica nas
migrations já aplicadas (`20260731000000`, `20260806000000`,
`20260808000000`, imutáveis) e a string visível compliance-aprovada
(grafia "licenciado", não casa com o padrão "license"). `npm run
typecheck`, `npm run lint` e `npm run test` passam (220/220 testes, mesma
contagem de antes — todos atualizados no lugar, nenhum adicionado ou
removido).

**Custo de reversão.** Baixo, mas maior que o do ADR-061: reverter exige
reaplicar `20260813000000` (que já deixa as funções com a assinatura
`p_license_id`/`v_license_id`/`'license_id_invalid'`) **e**, no mesmo
commit, reverter todo o código de aplicação listado acima — o acoplamento
nome-de-parâmetro↔call-site descrito acima nesta ADR é o motivo. Nenhum
dado é perdido em nenhuma direção: `authorization_id` (coluna, 7a) não
muda nesta migration.
