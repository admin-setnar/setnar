### ADR-061 — Renomeia `representatives.license_id` para `authorization_id` (Passo 7a, schema/RPC)

**Decisão.** A coluna `representatives.license_id` passa a se chamar
`representatives.authorization_id`, via
`supabase/migrations/20260813000000_rename_representatives_license_id_to_authorization_id.sql`.
As duas funções `SECURITY DEFINER` que a escrevem — `register_representative`
e `update_representative_profile` — são recriadas (`create or replace
function`) só para gravar/ler a coluna pelo novo nome; a assinatura externa
das duas (nomes de parâmetro, ordem, tipo de retorno) **não muda** nesta
migration.

**Contexto.** Dívida técnica registrada e rastreada pelo ADR-060, primeira
das duas listadas ali: `representatives.license_id` →
`representatives.authorization_id`. Este ADR executa só essa — é a primeira
metade (7a) do Passo 7 do plano de reconciliação
(`docs/AUDIT_CONSTITUTION_RECONCILIATION.md`, Parte 3, item 7), dividido em
7a (backend/schema) e 7b (domínio/TS/componente) seguindo a seção "Release
Strategy" do `ROADMAP.md` — escopo pequeno, rollback fácil.

**O que este ADR explicitamente não faz.** Não renomeia:
- Os parâmetros das duas funções `SECURITY DEFINER` (`p_license_id`
  continua `p_license_id`, `v_license_id` continua `v_license_id`, nas duas
  funções).
- O status de retorno `'license_id_invalid'` (nenhuma das duas funções
  muda o vocabulário de `status`).
- `Representative.licenseId`, o campo de domínio TypeScript
  (`src/modules/representatives/domain/representative.ts`) — os dois
  repositórios Supabase (`supabase-representative-account-repository.ts`,
  `supabase-representative-repository.ts`) passam a ler
  `data.authorization_id`/`representativeRow.authorization_id` da linha do
  banco, mas continuam mapeando para `licenseId:` no objeto de domínio
  retornado.
- `LicenseeIdentificationBlock` (componente) e o código de erro nos 6
  arquivos que o ADR-060 já mapeou.

Essas cinco mudanças permanecem dívida técnica rastreada — são o Passo 7b,
tarefa subsequente separada, dependente deste ADR só na medida em que a
coluna já estará renomeada quando 7b começar.

**Por que dividir em 7a/7b em vez de uma tarefa só.** 7a é a primeira parte
do plano de reconciliação que toca schema/RPC — as seis anteriores (Passos
1–6) foram só documentação. Separar o rename de coluna (reversível, sem
efeito em nenhum contrato observável por código já escrito) da mudança de
contrato RPC/domínio/componente (que tem call sites reais em
`supabase-representative-onboarding-gateway.ts` e
`supabase-representative-profile-gateway.ts`, e um componente React
publicado) reduz o raio de uma reversão a exatamente uma migration, se
algo em 7a se mostrar errado, sem precisar desfazer nenhuma mudança de
código de aplicação junto.

**Custo de reversão.** Baixo. `alter table public.representatives rename
column authorization_id to license_id;` desfaz o rename por completo — é
uma mudança só de catálogo, sem reescrita de linha, sem perda de dado
existente. Nenhuma migration aplicada antes de `20260813000000` foi
editada para esta mudança.

---
