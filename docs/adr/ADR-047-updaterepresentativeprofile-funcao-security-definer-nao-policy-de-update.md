### ADR-047 — `update_representative_profile`, função `SECURITY DEFINER`, não policy de UPDATE por coluna; `avatar_url` adiado (D5b)
**Decisão.**
`supabase/migrations/20260808000000_add_update_representative_profile.sql`
cria `update_representative_profile(p_phone, p_city, p_license_id)`,
`security definer`, `grant ... to authenticated` (nunca `anon`), validando os
três campos com a mesma forma que `register_representative` já usa.
`avatar_url` fica de fora — decisão do Pedro, tomada na auditoria D5/D5b
antes de qualquer código: nada no app renderiza esse campo hoje (mesmo
motivo já registrado no cabeçalho de `20260807000000` para excluí-lo do gate
de publicação).
**A escolha real, entre duas opções legítimas.** A auditoria levantou duas
formas válidas: `grant update (colunas)` + policy escopada (a receita que o
comentário de `20260728000000:31-40` já prescreve, ali para `profiles`) ou
uma função. Nenhum dos dois motivos que levaram D4 (ADR-043) a escolher
função por cima de policy se aplica aqui — não há máquina de estados, e
`representatives.updated_at` já é mantido por um trigger existente. A razão
real é outra: uma policy de UPDATE decide QUEM escreve, não VALIDA o que foi
escrito — um chamador direto do RPC conseguiria gravar `phone`/`license_id`
fora de forma através de uma policy, porque nenhuma das duas colunas tem
CHECK. `register_representative` já valida forma na escrita inicial; deixar
a edição sem a mesma validação reabriria exatamente esse furo. Decisão do
Pedro, confirmada explicitamente na auditoria que precedeu este passo.
**Sexta porta do módulo.** `RepresentativeProfileGateway`
(`domain/representative-profile-gateway.ts`), separada de
`RepresentativeOnboardingGateway` — mesmo raciocínio já usado quatro vezes:
`register()` é uma escrita única, antes de a linha existir, com 8 motivos de
rejeição; `update()` é uma escrita repetível contra uma linha que já existe,
com 4 motivos de rejeição, sem sobreposição.
**Substituição total, não merge parcial.** Os três parâmetros SUBSTITUEM o
valor atual — a UI (`RepresentativeProfileForm`) pré-preenche os três com os
valores vigentes, então "não editar um campo" e "reenviar o valor atual" são
a mesma coisa a partir da Server Action para baixo. `formatE164ToBRPhone`
(`domain/representative-rules.ts`), inversa de `formatPhoneToE164`, existe só
para esse pré-preenchimento — converte o E.164 salvo de volta para a máscara
BR que o input espera.
**Teste.** `tests/map-update-representative-profile-result.test.ts` cobre o
mapeador (mesmo formato dos outros três: sucesso, cada rejeição, status
desconhecido, `data`/`error` nulos, não aceita o status de sucesso de outra
RPC). `tests/representative-profile-schema.test.ts` cobre o Zod.
`tests/representative-rules.test.ts` ganha os casos de
`formatE164ToBRPhone`. A função SQL em si não tem teste automatizado — mesma
lacuna aceita nas outras três, verificação manual em `supabase/README.md`.
**Custo de reversão.** Baixo — `drop function`; nenhuma coluna, tabela ou
linha existente é tocada.
