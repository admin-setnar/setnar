### ADR-042 — `/app` ramifica entre onboarding e hub por uma terceira porta, `RepresentativeAccountRepository`; sucesso do cadastro passa a navegar, não a renderizar
**Decisão.** D3.B.5: `src/modules/representatives/domain/representative-account-repository.ts`
(`findByProfileId(profileId): Promise<Representative | null>`), adapter
`infrastructure/supabase-representative-account-repository.ts` e factory
`infrastructure/representative-account-repository-factory.ts` (mesmo padrão
`server-only`/cliente-por-chamada das outras duas). `src/app/app/page.tsx`
usa o resultado para escolher entre `OnboardingForm` (null) e
`RepresentativeHubPlaceholder` (não-null) — o hub de verdade (produtos
ativados, link/QR Code, leads) é D5, e este componente é explicitamente um
marcador mínimo, não ele. Nenhuma migration nova: `representatives_select_own`
(`20260804000000:61-63`, ADR-038) já escopa essa leitura por
`profile_id = auth.uid()`.
**Por quê uma terceira porta, e não um método em `RepresentativeRepository`.**
Mesmo raciocínio de ADR-031 e ADR-041, aplicado uma terceira vez:
`RepresentativeRepository` se declara a porta de resolução PÚBLICA/anônima;
`findByProfileId` é leitura autenticada da própria linha. Dobrá-la ali
obrigaria `InMemoryRepresentativeRepository`
(usado por `resolve-representative.test.ts`) a implementar um método que
nunca usa — a mesma objeção que já valeu contra pendurar `register()` naquela
porta. A convenção do módulo se mantém: "Repository" para leitura, "Gateway"
para escrita.
**Sem filtro de `status`, ao contrário da porta pública.**
`findPublishedActivation` esconde representante não-`active` porque serve um
visitante anônimo; aqui é o dono lendo o próprio registro, e um `suspended`
é precisamente o que ele precisa enxergar — esconder seria mentir para o
dono sobre o próprio estado. `.maybeSingle()`, não `.single()`: zero linhas é
o resultado legítimo "ainda não se cadastrou", não um erro.
**`registerRepresentativeAction` passa a `redirect('/app')`.** Com os dois
estados existindo, sucesso tem para onde navegar — então segue a convenção
que toda Server Action de auth já estabelece (retorno normal = falha; sucesso
= navegação), com o `redirect()` DENTRO do callback do `safeOnboardingCall`
para o `NEXT_REDIRECT` ser relançado e não engolido (ADR-020). O branch
`'created'` de `OnboardingForm` morreu junto e foi removido, não deixado
inalcançável.
**Correção de tipo encontrada ao implementar isto, não antes.**
`safeOnboardingCall` declarava `Promise<T | RegisterRepresentativeResult>` —
unindo com o union INTEIRO, incluindo `'created'`. `safeAuthCall` só funciona
como estreitador porque une com `AuthFailure`, que é UMA variante de
`AuthResult`, não o union todo. Com o union inteiro, `'created'` voltava ao
tipo de retorno de qualquer chamador por mais que `T` estreitasse, impedindo
`registerRepresentativeAction` de declarar
`Promise<RegisterRepresentativeFailure>`. Corrigido para
`Promise<T | Extract<RegisterRepresentativeResult, { status: 'error' }>>` —
o shape que o `catch` de fato devolve. Pego pelo `npm run typecheck`, não em
revisão.
**Custo de reversão.** Baixo — uma porta/adapter/factory a mais e um branch
em `/app`; nada existente foi reescrito.

**Evolução em 2026-08-06.** ADR-066 substitui a composição de rota: `/app`
agora redireciona, e a ramificação onboarding/páginas vive em
`/app/paginas` dentro do App Shell autenticado.
