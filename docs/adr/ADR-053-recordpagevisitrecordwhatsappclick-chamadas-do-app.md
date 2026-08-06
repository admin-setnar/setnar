### ADR-053 — `record_page_visit`/`record_whatsapp_click` chamadas do app; `after()` para a visita, rota dedicada para o clique (AN3 + AN5, `docs/QR_ANALYTICS_PLAN.md` §4)

**O que muda.** As duas funções `SECURITY DEFINER` do ADR-051 existiam desde
`20260811000000` sem nenhum chamador no app. Este ADR fecha isso: `[productSlug]/page.tsx`
chama `record_page_visit` depois de resolver a ativação; `WhatsappCta` chama
`record_whatsapp_click` através de uma rota nova, `/api/track-click`. Zero
migration — só código de aplicação, mesmo como o plano já previa.

**Módulo novo, `analytics`, em vez de estender `leads`.** `AnalyticsGateway`
(`modules/analytics/domain/analytics-gateway.ts`) é uma porta com dois
métodos (`recordPageVisit`/`recordWhatsappClick`), implementada por
`SupabaseAnalyticsGateway` e resolvida por `getAnalyticsGateway()` — mesma
forma de `LeadGateway`/`getLeadGateway()`, não um método a mais ali. As duas
funções SQL sempre andam juntas (mesmo desenho, mesmo filtro de bot, mesma
migration — ADR-051), então uma porta com dois métodos, não duas portas,
espelha isso; mas o domínio é outro (analytics não é lead capture), então um
módulo próprio, não uma extensão de `leads` — mesmo raciocínio que já levou
a `RepresentativeOnboardingGateway` (ADR-041) a ser uma porta nova em vez de
inchar `RepresentativeRepository`.

**`p_ip_hash`: `LOGIN_ATTEMPT_SALT` reaproveitado, não um salt novo — resposta
concreta ao que §3.4 deixou em aberto.** O plano listava as duas opções sem
decidir qual; a implementação segue o mesmo salt que `login-rate-limiter.ts`
e `supabase-lead-gateway.ts` já leem, pela mesma razão que este último já
documenta: um segundo salt não isola nenhum domínio de retenção que já não
esteja isolado pelo próprio `ip_hash` morar em `analytics_events` (não numa
tabela de rate-limit irmã, decisão já fechada em AN1/ADR-050). `hash()` é
duplicada em `supabase-analytics-gateway.ts` em vez de importada de
`supabase-lead-gateway.ts`, mesma razão que este último já dá para não
importar de `login-rate-limiter.ts`: acoplar dois módulos de domínio por
quatro linhas de crypto não paga o preço.

**AN3 — `after()` (`next/server`), não um `await` bloqueando a renderização.**
O plano exige que uma falha ou lentidão no RPC nunca atrase a página real. Um
`await` dentro de um `try/catch` ainda atrasaria a resposta pelo tempo do
round-trip a Postgres, mesmo capturando o erro; `after()` agenda o callback
para rodar **depois** que a resposta já foi enviada, então nem uma exceção
nem uma latência alta dentro dele pode, por construção, chegar ao visitante.
`headers()`/`cookies()` continuam legíveis dentro do callback (garantia do
próprio Next.js para `after()`), o que é o que permite `getAnalyticsGateway()`
(que precisa de `cookies()` para montar o client Supabase) e `getClientIp()`
funcionarem ali sem reabrir o contexto da requisição por fora dele. Chamado
só depois do `if (!activation) notFound()` — mesma instrução do plano: não
tentar a chamada num caminho que a página já sabe que vai dar 404.

**AN5 — rota dedicada (`/api/track-click`), não uma Server Action.** Mesma
forma de `/api/leads/route.ts` (ADR-034): `productSlug` é o único dado
confiado do corpo, a rota resolve `representative`/`product` de novo a
partir do `Host` da própria requisição
(`resolveRepresentativeActivation`), nunca aceitando um id vindo do
cliente. Uma Server Action não serviria aqui: o disparo é `fetch(...,
{ keepalive: true })` de um `onClick` sem `preventDefault`, desenhado
exatamente para sobreviver ao unload da aba (§3.3 do plano, decisão já
fechada) — isso é o contrato de uma requisição HTTP comum, não o de uma
Server Action.

**`WhatsappCta` vira Client Component — única forma de interceptar o
clique**, confirmado em §2.3 do plano: não havia `onClick` nenhum antes.
`representative`/`product` continuam vindo como props do Server Component
pai (`[productSlug]/page.tsx`) — são dados simples (`string`/`string | null`),
sem nada que um Client Component não possa receber serializado.

**`/api/track-click` sempre responde `200`.** O cliente nunca lê nem espera
essa resposta (a navegação para `wa.me` já começou antes dela chegar), então
não há nenhum consumidor para um código de erro comunicar algo a. Toda falha
(corpo malformado, par inválido, erro no RPC) é capturada e logada,
nunca repassada — mesmo espírito best-effort do AN3, aplicado ao lado da
rota em vez de um `after()`, porque aqui o "atraso" que importa evitar é do
lado do cliente (o `fetch` já é `keepalive`, sem `await` no `onClick`), não
do lado do servidor.

**Não coberto por este ADR, de propósito:** AN6 (exibir as estatísticas no
hub) e AN7 (retenção/purga) — próximos passos do mesmo plano, ainda não
implementados.

**Custo de reversão.** Baixo — nenhuma migration, nenhum schema tocado; um
`AnalyticsGateway` a menos ou uma rota a menos não desfaz nada persistido.
