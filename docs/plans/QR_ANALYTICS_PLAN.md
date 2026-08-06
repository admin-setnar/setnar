# QR_ANALYTICS_PLAN.md

> Plano de investigação — QR Codes + Analytics (Básico), o resto do Stage 1
> Escopo: `docs/ROADMAP.md`, Stage 1 — "QR Codes" (geração, download, copiar
> link), "Analytics (Básico)" (visitas, cliques no WhatsApp, referrer), e a
> parte do "Dashboard" que ainda falta (QR Code, basic statistics — Products e
> Links já existem no hub)

**Status:** Approved — parcialmente implementado
**Authority:** Non-normative (ver `docs/plans/README.md`)
**Code baseline:** Not identified na redação original. Estado verificado contra
`23290c4` (branch `develop`) em 2026-08-05.
**Last reviewed:** 2026-08-05
**Superseded by:** —

> **Aviso de leitura — este cabeçalho substitui o status original.** A linha
> original dizia *"proposta, não implementada"*, e isso deixou de ser verdade.
> Estado real, verificado no código:
>
> | Passo | Estado | Evidência |
> |---|---|---|
> | QR1 — QR Code client-side | **Implementado** | ADR-049, `qr-code-card.tsx`, dep `qrcode` |
> | AN1 — tabela `analytics_events` | **Implementado** | ADR-050, `20260810000000` |
> | AN2/AN4 — funções de escrita | **Implementado** | ADR-051/052, `20260811000000` |
> | AN3/AN5 — chamadas do app | **Implementado** | ADR-053/054 |
> | AN6 — exibir estatísticas no hub | **Não implementado** | não há caminho de leitura: `AnalyticsGateway` só expõe escrita |
> | AN7 — retenção/purga dos eventos | **Não implementado** | levantado, não bloqueante |
>
> **Consequência que precisa estar clara para qualquer leitor, humano ou IA:**
> o produto **registra** visitas e cliques, mas **não os mostra a ninguém**.
> "Analytics" não é uma capacidade disponível ao representante hoje — só uma
> coleta silenciosa. Ver `PRODUCT.md`, seção *What Exists Today*.
>
> **§3 não está mais em aberto — foi decidido.** A seção 3 abaixo apresenta
> alternativas lado a lado, no tempo presente, como se nada estivesse
> resolvido. **Seis das sete decisões já foram tomadas e implementadas.** Ler
> §3 como um menu de escolhas é o erro mais provável neste documento:
>
> | Decisão | Resolução | Onde |
> |---|---|---|
> | §3.1 QR client-side ou com estado no servidor | **Client-side** | ADR-049 |
> | §3.2 o que conta como "visita"/ruído de bot | **Decidido**, com filtro de bot | ADR-051 |
> | §3.3 mecanismo de registro do clique | **Rota dedicada** | ADR-053 |
> | §3.4 LGPD/consentimento | **Decidido**: `ip_hash` com salt próprio, sem cookie | ADR-050, ADR-054 |
> | §3.5 eventos crus ou contador agregado | **Eventos crus** | ADR-050 |
> | §3.6 função `SECURITY DEFINER` ou policy de INSERT | **`SECURITY DEFINER`** | ADR-051 |
> | §3.7 onde as estatísticas aparecem no hub | **EM ABERTO** — é o único item vivo, e é o que bloqueia AN6 | — |
>
> Só §3.7 continua sendo uma pergunta. Todo o resto de §3 é registro
> histórico do raciocínio que levou às decisões acima.

Mesmo contrato do `docs/plans/archive/SPRINT_D_PLAN.md`: este documento **investiga e
levanta decisões, não fecha nenhuma sozinho**. Onde há custo de produto ou
custo de reversão alto, as opções vêm lado a lado, com prós/contras, e a
escolha é do Pedro. Os passos de implementação são pequenos, revisáveis e
testáveis isoladamente. Os ADRs correspondentes só entram em `docs/adr/`
quando cada passo for de fato implementado.

> ⚠️ **Ponteiros obsoletos, corrigidos.** O texto original dizia "o próximo
> número livre é ADR-049" e "o próximo passo livre do `supabase/README.md` é o
> 14". Ambos foram consumidos. O texto original também dizia que ADRs entram
> no `README.md` — desde 2026-08-05 os ADRs vivem em `docs/adr/` (um arquivo
> por decisão, índice em `docs/adr/README.md`). **Não use números de ADR ou de
> migration citados em qualquer plano** — eles envelhecem no instante em que o
> passo seguinte é implementado. A única fonte confiável é `docs/adr/README.md`
> (último ADR) e a pasta `supabase/migrations/` (último timestamp).

---

# 1. Onde isso se encaixa no que já existe

A Sprint D fechou o elo Auth → Commercial Page. O que falta do Stage 1, lido
direto do `ROADMAP.md`:

> ⚠️ **Tabela histórica — descrevia o estado em que este plano foi escrito, não o estado atual.** Mantida como registro do ponto de partida. O estado verificado em 2026-08-05 está no cabeçalho deste documento.

| Item do ROADMAP | Estado quando este plano foi escrito | Estado em 2026-08-05 |
|---|---|---|
| QR Codes: geração automática, download, copiar link | ❌ nada implementado | ✅ implementado (ADR-049) |
| Analytics (Básico): visitas, cliques no WhatsApp, origem/referrer | ❌ nada implementado | ⚠️ gravado, **nunca exibido** (ADR-050/051/053) |
| Dashboard: Products, Links, QR Codes, basic statistics | Products/Links ✅; QR Codes e statistics ❌ | Products/Links/QR Codes ✅; **statistics ❌** |

Importante: **isto não é modelagem nova.** `docs/DOMAIN_MODEL.md` já define o
vocabulário inteiro — `QR Code` (§8.7), `Visitor` (§8.8), `Metric Aggregate`
(§8.9), o "Analytics Context" (§7.6) — e três regras de negócio explícitas
(§11):

> 11. A Commercial Page has exactly one QR Code at any time; regenerating
>     creates a new QR Code and invalidates the previous one. *[Inferred]*
> 13. Every Analytics/Visitor Event must reference exactly one Commercial
>     Page or exactly one Campaign — never neither, never both.
> 14. Analytics data must never expose personally identifying Visitor
>     information.

Este plano implementa esse modelo, não inventa um novo. Uma nuance da regra 11
importa para §3.1 abaixo: ela fala de "regenerar" um QR Code como se fosse um
evento discreto — isso faz mais sentido para o "Smart QR Code" de Campanha do
Stage 2 (que aponta para um link curto que pode mudar de alvo) do que para o
Stage 1, onde o link encodado é `<slug>.<domínio>/<produto>` — estável por
construção (regra 12: "não deve mudar silenciosamente depois de publicado").
Vale ler essa nuance como parte da decisão de §3.1, não como algo já
resolvido pelo `DOMAIN_MODEL.md`.

---

# 2. Investigação — o que está realmente no repositório

## 2.1 O link público já está resolvido, sem leitura nova

`RepresentativeHub` (`src/modules/representatives/presentation/representative-hub.tsx:46,74`)
já monta `https://${representative.slug}.${rootHost}/${entry.product.slug}`
a partir de `SITE_URL` (`config/site.ts`) para cada ativação `published`. Um
QR Code não precisa resolver hostname nenhum — o texto a encodar já existe no
componente que vai exibi-lo.

## 2.2 Nenhuma lib de QR Code instalada

`package.json` não tem `qrcode` nem equivalente. `docs/ENGINEERING_GUIDELINES.md`
é direto sobre isso: *"Before adding a package ask: Can this be solved with
native APIs? If yes, do not install another dependency."* Gerar QR Code
(correção de erro Reed-Solomon, matriz de módulos) não tem API nativa no
browser nem no Node — uma dependência é justificada de qualquer forma. O que
muda entre as opções de §3.1 não é a dependência (a mesma lib serve nos dois
ambientes, ex.: `qrcode` roda em browser e em Node), é onde ela roda e se
algo fica persistido.

## 2.3 `WhatsappCta` é um `<a>` estático — não intercepta clique nenhum

`src/modules/representatives/presentation/whatsapp-cta.tsx` **não é** um
Client Component (`'use client'` ausente), não tem `onClick`, é só
`<a href="https://wa.me/...">`. Isso significa: **hoje não existe nenhum
ponto de interceptação de clique.** Registrar um clique no WhatsApp exige
transformar este componente (ou envolvê-lo) em Client Component — não é um
ajuste cosmético, é a pré-condição de infraestrutura para "cliques no
WhatsApp" existir (§3.3).

## 2.4 O precedente de escrita anônima: `submit_lead`, não `activate_product`

O visitante da Commercial Page é sempre anônimo — a mesma categoria de
chamador do lead capture, não a das funções autenticadas
(`register_representative`/`activate_product`/`set_activation_status`/
`update_representative_profile`). `submit_lead`
(`20260801000000_add_lead_submission.sql`, corrigido em
`20260802000000_fix_submit_lead_rate_limit.sql`) já resolveu, e deve ser
copiado sem reinventar:

- Uma tabela só alcançável através da função (`RLS enabled`, zero policies) —
  mesmo padrão de `login_attempts`/`lead_submission_attempts`.
- `ip_hash` calculado **fora** do Postgres com `sha256(LOGIN_ATTEMPT_SALT:ip)`
  (`supabase-lead-gateway.ts:16-22`) — nunca IP em texto puro.
- Rate limit e validação de formato **dentro** da função, contra literais
  fixos, nunca parâmetros do chamador — ADR-036 é a lição direta: uma versão
  anterior de `submit_lead` aceitava `p_max_attempts_ip`/`p_window_seconds`
  do chamador, e um RPC direto (sem `/api/leads`, sem Zod) usava isso pra
  desativar o próprio rate limit. Qualquer função nova de analytics **não
  pode repetir esse erro**: os limiares ficam como literais dentro da
  função.
- Retorno anti-enumeração: `boolean`, sem distinguir rate-limited de
  inválido.
- `revoke ... from public` + `grant execute to anon, authenticated` **explícito**,
  nunca dependendo de `ALTER DEFAULT PRIVILEGES`.

## 2.5 `ADR-048` — a lição mais recente e mais cara, aplicar sem falta

A migration mais recente do projeto (`20260809000000_revoke_anon_execute_leak.sql`)
documenta um vazamento real, confirmado contra o Supabase de verdade: quatro
funções que deveriam ser só `authenticated` tinham `EXECUTE` vazado para
`anon` — não por causa de um `grant` errado, mas por um
`ALTER DEFAULT PRIVILEGES` no schema `public` concedendo a `anon`
automaticamente toda função nova. `revoke ... from public` (que as quatro
migrations já tinham) não pega esse caso, porque a concessão nunca passou
por `public`.

Isso importa duas vezes para este plano:

1. Qualquer função `SECURITY DEFINER` nova (§4, AN2/AN4) precisa do mesmo
   double-check **depois** de criada: `select grantee, privilege_type from
   information_schema.role_routine_grants where routine_name = '<nome>'` **e**
   uma chamada RPC HTTP crua sem header `Authorization`. Não confiar que
   `revoke`/`grant` fizeram o que parecem fazer.
2. Ao contrário das quatro funções que vazaram, as funções de analytics
   **devem mesmo** ter `EXECUTE` para `anon` — o mesmo double-check serve
   para confirmar o oposto: que a concessão pretendida realmente está lá, não
   só que a indesejada não está.

## 2.6 `/api/leads/route.ts` — o padrão de resolução a copiar

A rota nunca confia em `representative_id`/`product_id` vindos do corpo da
requisição — ela resolve de novo `resolveRepresentativeActivation(repository,
host, productSlug)` a partir do próprio `Host` da requisição
(`src/app/api/leads/route.ts:48-54`), e usa `getClientIp()`
(`src/shared/lib/get-client-ip.ts`) já existente. Uma rota de tracking nova
reaproveita exatamente essa forma — nenhuma infraestrutura nova de resolução
de tenant/produto é necessária.

## 2.7 `login_attempts`/`lead_submission_attempts` — o precedente de retenção curta

Ambas as tabelas de rate-limit purgam suas próprias linhas depois de uma
janela fixa e curta (1 dia), escopado à própria identidade
(`20260730000000_scope_login_attempts_cleanup_by_identity.sql`). Isso é
relevante para a pergunta de LGPD em §3.4: o projeto já tem o hábito de não
guardar hash de IP por mais tempo que o necessário.

## 2.8 Sem infraestrutura de consentimento/cookies em lugar nenhum

Busquei por "cookie", "consentimento", "LGPD", "GDPR" em `README.md` e
`docs/DOMAIN_MODEL.md` — a única menção de "Compliance" no `README.md` (linha
198) é sobre a política de marca da iGreen e o rodapé legal, não sobre
tratamento de dado de navegação de visitante. **Não existe banner de
consentimento, nem decisão registrada de que ele seja ou não necessário.**
Se Analytics precisar de um, é infraestrutura nova inteira, não um toggle.

## 2.9 Onde isso apareceria no hub

`RepresentativeHub`/`ProductActivationCard`
(`src/modules/representatives/presentation/`) já usam `Card`/`Badge`/`Text`
do design system. Nenhum componente novo de design system é necessário para
exibir um contador — mesmo princípio dos passos D5.

---

# 3. Decisões em aberto — cada uma com o custo real, não fechadas aqui

## 3.1 QR Code: client-side ou com estado no servidor?

**Opção A — client-side, sem tocar em schema.** Um Client Component recebe a
URL pública já calculada (§2.1) como prop e renderiza um `<canvas>`/SVG com
uma lib (`qrcode` ou equivalente).

A favor:
- Zero migration, zero RLS, zero função nova, zero Server Action.
- "Baixar" é `canvas.toBlob()` + `<a download>`; "copiar link" é
  `navigator.clipboard.writeText(url)` — a mesma string que já está na tela,
  nada novo a resolver.
- Funciona instantaneamente, sem round-trip de rede.

Contra:
- Não existe registro de "quando o QR foi gerado" — a regra 11 do
  `DOMAIN_MODEL.md` fala de um ciclo de vida (Generated → Active →
  Regenerated) que fica implícito, não persistido.
- O KPI do próprio `ROADMAP.md` ("QR Codes Generated", seção Product KPIs)
  fica sem uma definição operacional clara se nada é registrado — ver nota
  abaixo.

**Opção B — geração server-side** (rota ou Server Action gerando
PNG/SVG via a API Node da mesma lib, ex. `qrcode`'s `toBuffer`/`toDataURL`).

A favor:
- Poderia registrar um evento "QR gerado" se o KPI do ROADMAP exigir uma
  contagem real.
- Download funciona mesmo sem JS no cliente.

Contra:
- Precisa de rota nova só para servir uma imagem — infraestrutura por cima
  de uma dependência que já resolveria o problema no client.
- Ainda não resolve sozinho o que "regenerar" significaria no Stage 1 (ver
  §1) — só desloca a pergunta.

**Nota sobre o KPI "QR Codes Generated":** como o link por trás do QR é
estável (regra 12) e sempre existe a partir do momento em que há uma
ativação publicada, uma leitura razoável é que esse KPI, no Stage 1, é
simplesmente "quantidade de Commercial Pages publicadas" — não um evento
discreto de geração por chamada. Isso favoreceria a Opção A. Mas é uma
definição de métrica de produto, não uma consequência técnica automática —
não decido isso aqui.

**Inclinação, sem fechar:** Opção A. O custo de reversão é baixo — trocar de
client-side para server-side depois é trocar um componente, não desfazer uma
migration.

**Decisão fechada (2026-08-03): Opção A.** Confirmado pelo Pedro. QR1
prossegue como client-side, sem migration, seguindo a recomendação acima.

## 3.2 O que conta como "visita" — e o ruído de bot/crawler

A rota candidata a registrar uma visita é o próprio Server Component
(`src/app/[productSlug]/page.tsx`) — toda renderização passa por ali, o que
inclui crawlers (inclusive o próprio crawler do WhatsApp buscando preview de
link quando o representante compartilha a página numa conversa).

- **Opção 1 — aceitar o ruído, documentar a limitação.** Mais barato, mais
  honesto sobre o que Stage 1 realmente mede; "Advanced Analytics" (device,
  cidade, taxa de conversão) já é explicitamente Stage 2 no `ROADMAP.md`.
- **Opção 2 — filtro simples por User-Agent** (substring denylist:
  `bot`, `crawler`, `spider`, `facebookexternalhit`, `whatsapp`, etc.),
  aplicado no mesmo caminho de escrita. Barato, sem dependência nova, mas
  nunca completo — não é um controle de segurança, é só redução de ruído.

**Inclinação:** Opção 2 como filtro mínimo, com a limitação documentada no
ADR — não uma solução definitiva.

**Decisão fechada (2026-08-03): Opção 2 (filtro por User-Agent).**
Confirmado pelo Pedro. AN2 e AN4 aplicam o mesmo denylist de substrings —
não é uma segunda decisão, é a mesma estendida à função irmã, para
consistência entre as duas únicas superfícies de escrita anônima deste
plano.

## 3.3 Mecanismo de registro do clique no WhatsApp

Confirmado em §2.3: `WhatsappCta` hoje é 100% estático. Registrar um clique
exige:

- Virar (ou envolver em) Client Component, com `onClick` disparando
  `fetch('/api/track-click', { keepalive: true })` (ou
  `navigator.sendBeacon`) **sem** `preventDefault` — a navegação para
  `wa.me` segue seu curso normal independente da resposta do beacon.
- Aceitar que isso é best-effort: se a aba fechar antes do request
  completar, o clique pode não ser contado — a mesma imprecisão que todo
  tracker de "outbound click" da web tem, não um bug a resolver.

Alternativa (não recomendada): não instrumentar clique nenhum e inferir
intenção só pelo referrer. Mais barato, mas contraria literalmente o que o
`ROADMAP.md` pede ("WhatsApp clicks").

**Inclinação:** instrumentar com `fetch(..., { keepalive: true })`, é o
único caminho que atende ao item do ROADMAP.

## 3.4 LGPD/compliance — isto precisa de aviso de cookies/consentimento?

**Não decido a resposta legal aqui — só levanto a pergunta e a opção mais
conservadora.**

O visitante da Commercial Page é um terceiro sem conta no SETNAR, que nunca
aceitou termo nenhum (`terms_accepted_at` só existe para `profiles`,
`20260728000000`). "Analytics de visita" é, por natureza, tratamento de dado
de navegação desse terceiro.

A opção mais conservadora, espelhando o que o projeto já faz para
`login_attempts`/`lead_submission_attempts` (§2.7):

- Nenhum cookie, nenhum fingerprint, nenhum identificador persistente no
  browser do visitante.
- IP hasheado (reaproveitando `LOGIN_ATTEMPT_SALT`, mesmo raciocínio já
  usado para `lead_submission_attempts` — ou um salt novo, se a resposta de
  §3.4 exigir separar o domínio de retenção; ambas as opções existem, não
  decido qual aqui).
- Retenção curta: o hash de IP é descartado depois de uma janela pequena
  (o padrão já usado é 1 dia; para analytics, uma janela ainda mais curta é
  defensável, já que aqui o hash não precisa sobreviver além do necessário
  para o rate limit funcionar).
- Contagem agregada, nunca por visitante identificável.

Essa abordagem tende a ficar mais perto de "agregação de log de servidor" do
que de "rastreamento de usuário" — categoria que tipicamente não exige
banner de consentimento sob a LGPD, por não haver cookie nem identificador
persistente. **Mas essa é uma conclusão jurídica, e não posso fechá-la.**
Recomendo confirmar com quem responde por compliance antes de publicar isso
em produção — e revisitar quando o Stage 2 (device, cidade) empurrar ainda
mais para "rastreamento".

**Decisão fechada (2026-08-03): seguir com a abordagem conservadora agora**
(sem cookie, IP hasheado, retenção curta, contagem agregada, sem banner de
consentimento). Confirmado pelo Pedro, ciente de que a conclusão jurídica
não foi validada externamente e pode precisar de revisão antes do Stage 2.

## 3.5 Forma do schema: eventos crus ou contador agregado

**Opção A — tabela de eventos crus** (`representative_id`, `product_id`,
`event_type` check (`'visit'`/`'whatsapp_click'`), `referrer` nullable,
`created_at`), agregação calculada em tempo de leitura (`count(*) group by
...`) quando o hub renderiza.

A favor:
- Espelha literalmente a entidade "Visitor Event" do `DOMAIN_MODEL.md` §8.8.
- Satisfaz a regra 14 (append-only, nunca muta o que mede) trivialmente.
- Volume esperado no Stage 1 é baixo (poucos representantes, tráfego
  inicial) — agregar em tempo de leitura é barato.
- **Sozinho, já permite tudo que o Stage 2 promete** (breakdown por
  referrer, por dia, por device quando esse campo existir) sem reescrever o
  schema.

Contra:
- Uma tabela a mais, cresce sem limite até existir uma política de purga
  (não bloqueante agora — ver AN7).

**Opção B — contadores agregados** (ex.: colunas `visit_count`/
`whatsapp_click_count` em `product_activations`, incrementadas
atomicamente).

A favor:
- Leitura trivial, nenhuma agregação em tempo de leitura.

Contra:
- Não responde "visitas nos últimos 7 dias" nem permite breakdown por
  referrer depois — o próprio Stage 2 do ROADMAP pede exatamente esse tipo
  de corte. Construir B agora significa refazer como A quando o Stage 2
  chegar — trabalho perdido.

**Inclinação:** Opção A, porque é a única que não precisa ser refeita no
Stage 2. Ainda assim é uma tabela a mais do que B — decisão do Pedro.

**Decisão fechada (2026-08-03): Opção A (eventos crus).** Confirmado pelo
Pedro. AN1 prossegue com uma tabela de eventos, não com contadores
agregados.

## 3.6 Caminho de escrita: função `SECURITY DEFINER` ou policy de INSERT para `anon`

Ao contrário de D4 (ativação de produto, chamador autenticado, onde a policy
de INSERT foi a forma escolhida — ADR-043), aqui o chamador é **sempre
anônimo**. Esse é exatamente o caso em que o projeto já decidiu, de forma
consistente, usar função `SECURITY DEFINER` (`submit_lead`), não policy —
policy de INSERT para `anon` reabriria a superfície que as funções
`SECURITY DEFINER` existem para evitar. Listo esta opção mais por
completude do que como decisão genuinamente em aberto — o precedente do
projeto é unânime aqui. O ponto que **de fato** precisa de atenção redobrada
é o double-check de grants do ADR-048 (§2.5), porque desta vez o `grant ...
to anon` é proposital, e confirmar isso corretamente importa tanto quanto
confirmar a ausência dele importou para as quatro funções que vazaram.

## 3.7 Onde as estatísticas aparecem no hub

- **Opção A** — linha/badge extra dentro do `ProductActivationCard` já
  existente ("123 visitas · 12 cliques"). Menor diff, reaproveita o
  componente como está.
- **Opção B** — seção própria de "Estatísticas" na `RepresentativeHub`,
  separada da lista de ativação.

**Inclinação:** Opção A para um primeiro corte — mesmo princípio dos passos
D5 (menor componente que resolve o problema). B é uma evolução natural
quando o Stage 2 trouxer breakdown por referrer/device, que não cabe numa
linha de card. Isto é preferência de apresentação, custo de reversão baixo —
decisão do Pedro, mas sem grande peso.

---

# 4. Plano de implementação, em passos pequenos

Cada passo é revisável e testável isoladamente. Processo por passo, o mesmo
de sempre: **auditar → Pedro revisa → implementar → `npm run verify` → ADR
em `docs/adr/` (a partir de ADR-049) + entrada na lista numerada do
`supabase/README.md` (a partir do passo 14) + roteiro de "Verificação manual
obrigatória".**

## QR1 — Renderização client-side do QR Code

*Depende só de §3.1 — mas o custo de reversão é baixo o bastante para
começar com a inclinação declarada, se o Pedro preferir não esperar.*

- Adicionar `qrcode` (ou lib equivalente mínima) como dependência.
- Novo Client Component (`src/modules/representatives/presentation/`),
  recebendo a URL pública já calculada por `RepresentativeHub` como prop —
  nenhuma leitura nova de hostname/slug.
- "Baixar": `canvas.toBlob()` + `<a download>`. "Copiar link": ícone junto do
  QR chamando `navigator.clipboard.writeText(url)`.
- Zero migration, zero RLS, zero Server Action.
- Teste: não há teste automatizado significativo para renderização de
  canvas; verificação manual (escanear com celular de verdade) + revisão
  visual.

**Não depende de nada além de §3.1. Pode ser implementado e revisado hoje.**

## AN1 — Schema: tabela de eventos de analytics

*Depende de §3.4 (formato exato do ip_hash/retenção) e §3.5 (eventos crus vs
contador) — migration não deve começar antes dessas duas estarem
respondidas, porque mudam o schema.*

- Nova migration: tabela (`page_visits` ou `analytics_events`, nome a
  confirmar), `RLS enabled`, zero policies de escrita — mesmo padrão de
  `lead_submission_attempts`.
- Policy de SELECT por dono, mesma forma de `leads_select_own` (ADR-038):
  o representante lê só os próprios eventos, via `exists (... where
  representative_id = ... and profile_id = auth.uid())`.

## AN2 — `record_page_visit`, função `SECURITY DEFINER`

*Depende de AN1, §3.2 (filtro de bot), §3.6.*

- Mesmo formato de `submit_lead`: valida que a ativação
  (`representative_id`, `product_id`) existe e está `published` (não confia
  no chamador), aplica rate limit por `ip_hash` contra um literal fixo
  (limiar próprio, maior que o de leads — visitas são esperadas em volume
  bem maior), aplica o filtro de bot de §3.2 se essa opção for a escolhida.
- `revoke ... from public` + `grant execute to anon, authenticated`
  explícito.
- **Obrigatório antes de marcar este passo como concluído:** o double-check
  do ADR-048 — `information_schema.role_routine_grants` e uma chamada RPC
  HTTP crua sem `Authorization`, desta vez confirmando que a concessão
  pretendida para `anon` está mesmo presente.

## AN3 — Conectar o registro de visita a `[productSlug]/page.tsx`

*Depende de AN2.*

- Chamar `record_page_visit` a partir do Server Component, sem bloquear a
  renderização da página — uma falha ou lentidão na escrita de analytics
  nunca deve ser visível para o visitante real.
- Teste: manual, uma linha nova aparece na tabela após visitar a página
  publicada.

## AN4 — `record_whatsapp_click`, função `SECURITY DEFINER`

*Depende de AN1, §3.6. Pode ser feita em paralelo com AN2/AN3 — mesma forma,
função irmã.*

- Mesma validação de ativação publicada, rate limit próprio.

## AN5 — Conectar o clique a `WhatsappCta`

*Depende de AN4, §3.3.*

- `WhatsappCta` vira (ou é envolvido por) Client Component; `onClick`
  dispara `fetch('/api/track-click', { keepalive: true })` — uma rota nova
  que resolve representative/product a partir do `Host` + `productSlug`,
  mesmo padrão de `/api/leads/route.ts` (§2.6), nunca confiando em IDs vindos
  do corpo.
- Teste: manual — clicar no botão, confirmar a linha no Supabase, confirmar
  que a navegação para `wa.me` acontece normalmente (o fetch nunca bloqueia).

## AN6 — Exibir estatísticas no hub

*Depende de AN1 (schema + policy de leitura própria). Pode ser feito em
paralelo com AN2–AN5, já que só lê.*

- Estende `RepresentativeCatalogRepository`
  (`src/modules/representatives/domain/representative-catalog-repository.ts`)
  ou um port irmão com a contagem agregada por ativação.
- Renderiza no `ProductActivationCard` ou numa seção própria, conforme §3.7.
- Sem componente novo de design system.

## AN7 — (levantado, não bloqueante) Retenção/purga dos eventos

- Uma tabela de eventos crescendo sem limite eventualmente precisa de uma
  política de purga/retenção — mesma forma da purga de 1 dia já existente
  em `lead_submission_attempts`/`login_attempts`, mas aqui a tabela é o dado
  reportável em si, não um artefato de rate-limit, então a janela deve ser
  bem maior (dias/semanas, não horas). Não decidir agora; registrar para não
  esquecer antes do Stage 2.

---

# 5. Tabela de precondições

| Passo | Depende de | Toca schema? | Depende de decisão do Pedro? |
|---|---|---|---|
| QR1 — QR Code client-side | — | não | §3.1 (recomendação já dada) |
| AN1 — schema de eventos | — | sim (migration) | §3.4, §3.5 |
| AN2 — `record_page_visit` | AN1 | sim (função) | §3.2, §3.6 |
| AN3 — wiring da visita | AN2 | não | — |
| AN4 — `record_whatsapp_click` | AN1 | sim (função) | §3.6 |
| AN5 — wiring do clique | AN4 | sim (app + rota) | §3.3 |
| AN6 — UI de estatísticas no hub | AN1 | não (só leitura) | §3.7 |
| AN7 — retenção/purga | AN1 | eventualmente | não bloqueante, só registrado |

---

# 6. Ordem sugerida

**Pode começar hoje, sem nenhuma decisão pendente:**
- **QR1** — já vem com recomendação (client-side) e custo de reversão baixo.

**Espera decisão do Pedro antes de qualquer migration:**
- **AN1** — a forma exata do `ip_hash`/retenção (§3.4) e eventos-crus-vs-contador
  (§3.5) mudam o schema; começar a migration antes disso arrisca redigitar.

**Depois de AN1 e das decisões de §3.2/§3.3/§3.6:**
- **AN2** e **AN4** — podem ser feitas em paralelo entre si, cada uma
  revisável isoladamente.
- **AN6** — pode ser feita em paralelo com AN2–AN5, já que só lê.

**Por último, dependem das funções:**
- **AN3** (depende de AN2), **AN5** (depende de AN4 e da decisão §3.3).

**Registrado, não agendado:**
- **AN7** — retenção/purga, revisitar antes do Stage 2.

Cada passo: `npm run verify`, ADR novo em `docs/adr/` (a partir de ADR-049),
entrada nova na lista numerada do `supabase/README.md` (a partir do passo
14) com o roteiro de "Verificação manual obrigatória" no formato já usado —
e, para AN2/AN4 especificamente, o double-check de grants do ADR-048 antes
de considerar o passo concluído.

**Não coberto por este plano, de propósito:** Smart QR Code / Campanhas
(Stage 2), breakdown por device/cidade/conversão (Stage 2 "Advanced
Analytics"), Material Library, upload de avatar (gap já conhecido do D5b),
e qualquer alteração em migration já aplicada.
