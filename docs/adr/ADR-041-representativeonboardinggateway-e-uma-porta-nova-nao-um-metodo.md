### ADR-041 — `RepresentativeOnboardingGateway` é uma porta nova, não um método a mais em `RepresentativeRepository`
**Decisão.** D3.B.2: `register_representative()` (ADR-040) é consumido por
uma porta própria,
`src/modules/representatives/domain/representative-onboarding-gateway.ts`
(`RepresentativeOnboardingGateway.register()`), não por um método novo em
`RepresentativeRepository`. Adapter em
`infrastructure/supabase-representative-onboarding-gateway.ts`, mapeamento
puro do resultado do RPC em `infrastructure/map-register-representative-result.ts`
(mesmo formato de `map-supabase-auth-error.ts` — tipo estrutural estreito, sem
`server-only`, testável com objeto plano), factory em
`infrastructure/representative-onboarding-gateway-factory.ts` (cópia do
padrão de `getLeadGateway()`: `server-only`, cliente novo por chamada, nunca
cacheado).
**Por quê porta nova.** `RepresentativeRepository`'s próprio doc comment se
declara a porta de resolução PÚBLICA (leitura anônima, para a Commercial
Page) — mesmo raciocínio de "naturezas diferentes merecem portas
diferentes" que o ADR-031 já usou para não dobrar `RepresentativeRepository`
dentro de `TenantRepository`. Aqui o eixo é leitura-anônima vs.
escrita-autenticada, não tamanho-da-lista, mas o raciocínio é o mesmo.
Reforça uma convenção de nomenclatura que já existia sem estar documentada:
neste projeto, "Repository" é sempre porta de leitura
(`RepresentativeRepository`, `TenantRepository`) e "Gateway" é sempre porta
de escrita/ação (`AuthGateway`, `LeadGateway`) — estender
`RepresentativeRepository` com um método de escrita quebraria essa
convenção e forçaria `InMemoryRepresentativeRepository` (usado pelos testes
de resolução) a implementar um método de onboarding que nunca usa.
**Resultado tipado, não anti-enumeração.** `RegisterRepresentativeResult`
distingue `'created'` / `'rejected'` (com `reason`, os 8 literais exatos do
`status` SQL, reaproveitados verbatim — não uma segunda tabela de tradução
que pudesse divergir, mesma lição do ADR-036) / `'error'` (falha de
infraestrutura ou uma forma de resposta que o mapeador não reconhece).
Diferente de `SubmitLeadResult`, que colapsa toda rejeição de propósito —
aqui o chamador já é autenticado (barra mais alta) e a Tarefa 1 do D3.B.1 já
pediu a distinção entre os 8 motivos, então colapsá-los desfaria esse
trabalho.
**Teste.** `tests/map-register-representative-result.test.ts` cobre os 8
motivos de rejeição, o caminho de sucesso, `status` desconhecido → `error`
(nunca fabrica um resultado a partir de uma forma inesperada), e `data`
nulo/vazio ou `error` não-nulo → `error`, sem precisar de um Supabase real.
**Custo de reversão.** Baixo — dois arquivos de porta/adapter a mais;
`RepresentativeRepository` não foi tocado.
