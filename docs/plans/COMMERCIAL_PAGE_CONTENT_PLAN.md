# COMMERCIAL_PAGE_CONTENT_PLAN.md

> Plano de investigação — visual on-brand + widget interativo por produto na
> Commercial Page
> Escopo: o que falta entre a Commercial Page mínima que existe hoje
> (identificação + CTA WhatsApp + lead form + aviso de compliance, ADR-055) e
> o conteúdo rico que `templates/commercial-pages/` já tem pronto como
> referência, nunca conectado a runtime nenhum

**Status:** Proposed — parcialmente implementado, com decisões em aberto
**Authority:** Non-normative (ver `docs/plans/README.md`)
**Code baseline:** Not identified na redação original. Estado verificado contra
`23290c4` (branch `develop`) em 2026-08-05.
**Last reviewed:** 2026-08-05
**Superseded by:** —

> **Este plano NÃO é uma especificação final.** Ele contém decisões que
> continuam abertas, e nenhuma delas deve ser escolhida por quem estiver
> apenas lendo o documento — nem por uma IA. Classificação exigida por este
> cabeçalho:
>
> | Item | Classificação | Observação |
> |---|---|---|
> | §3.1 "no distractions" | **Aprovado e superado pelo código** | ADR-056 redefiniu como *CTA único*, não *zero conteúdo*. `DESIGN_SYSTEM.md` foi alinhado. |
> | §3.2 conteúdo variável: schema vs. código | **Aprovado e superado pelo código** | ADR-056: vive em código (`product-content/`). |
> | §3.3 paleta/identidade iGreen | **VALIDADO EM 13/08/2026** | O Product Owner confirmou autorização e revisão de claims para as sete Commercial Pages controladas da SET-78. |
> | §3.4 GA4/Meta Pixel | **EM ABERTO** | Depende de infraestrutura de consentimento que não existe. Precisa de ADR se for adotado. |
> | CP3 (tabs de conteúdo) | **Implementado** | ADR-056, só Conexão Club |
> | CP9 (visual on-brand) | **Aprovado no escopo da SET-78** | ADR-057 — páginas controladas, autoria SETNAR e disclaimer obrigatório |
> | CP4–CP8 | **Implementados pela SET-78** | shell compartilhado, conteúdo e widgets por Produto; ADR-088 |
> | CP10 | **Somente planejado** | nenhum código; GA4/Meta Pixel continuam fora do escopo |
>
> Nenhum item marcado "EM ABERTO" autoriza implementação. §3.3 é uma questão
> de compliance de marca de terceiro, não uma preferência de produto.

Mesmo contrato do `docs/QR_ANALYTICS_PLAN.md`/`docs/SPRINT_D_PLAN.md`: este
documento **investiga e levanta decisões, não fecha nenhuma sozinho**. Onde
há custo de produto, custo de reversão alto, ou risco de compliance de marca,
as opções vêm lado a lado, com prós/contras, e a escolha é do Pedro. Os
passos de implementação são pequenos, revisáveis e testáveis isoladamente. Os
ADRs correspondentes só entram em `docs/adr/` quando cada passo for de fato
implementado.

> ⚠️ **Ponteiros obsoletos:** o texto original dizia "o próximo número livre é
> ADR-056" e apontava o passo 17 do `supabase/README.md` — ambos já
> consumidos. O texto original também dizia que ADRs entram no `README.md` —
> desde 2026-08-05 os ADRs vivem em `docs/adr/` (um arquivo por decisão,
> índice em `docs/adr/README.md`), migrados para fora da raiz. Números de ADR
> e de migration citados em planos envelhecem; confira sempre
> `docs/adr/README.md` e `supabase/migrations/`.

---

# 1. Onde isso se encaixa no que já existe

`docs/DOMAIN_MODEL.md` já registra a Commercial Page como o Core Domain do
produto (§ "The Core Domain is Commercial Presence & Representative
Enablement"). `ROADMAP.md` lista, para "Commercial Pages" (Stage 1): "Public
profile, Product pages, Responsive design, WhatsApp CTA" — sem citar
calculadora, FAQ ou vídeo. O que existe hoje (`src/app/[productSlug]/page.tsx`)
entrega literalmente essa lista, mais o aviso de compliance que ADR-055 já
fechou. O gap que este documento investiga é o que separa "atende ao
ROADMAP.md" de "converte tão bem quanto o material que já foi validado antes
deste projeto existir como código".

Este plano assume que a investigação anterior (histórico desta conversa) já
está correta e não a repete: os templates nunca foram conectados a runtime;
isso é deliberado e parcialmente documentado (`DESIGN_SYSTEM.md`,
`templates/commercial-pages/README.md`); e a lacuna real está em duas coisas
de tamanho bem diferente — o aviso de compliance (já fechado, ADR-055) e o
conteúdo rico por produto (o que resta, meu foco aqui).

---

# 2. Investigação — o que está realmente no repositório

## 2.1 As 7 lógicas de widget, uma por uma — são 3 padrões, não 7 problemas

Li o `<script>` de cada um dos 7 `index.html`. O resultado surpreende para
melhor: **não são 7 problemas diferentes, são 3 padrões de UI reaproveitáveis,
aplicados a conteúdo diferente por produto** — mais barato de portar do que
"7 builds" sugere.

| Produto | Padrão | O que faz, exatamente |
|---|---|---|
| **ConexaoGreen** | Calculadora numérica | Único produto com simulação de verdade: lê um valor de conta de luz (`bill-input`), aplica dedução de iluminação pública (R$25 fixo) e carga tributária (27% fixo), calcula uma faixa de desconto (5%-15%) sobre a base resultante, exibe economia mensal e anual estimadas com barra de progresso animada. Constantes de negócio hardcoded no `<script>` (`DESCONTO_MIN/MAX`, `CARGA_TRIBUTARIA`, `ILUMINACAO_PUBLICA`, `CUSTO_DISPONIBILIDADE`) — o próprio comentário do template diz "CONFIRMAR COM A IGREEN: faixa de desconto vigente". |
| **ConexaoClub** | Tabs de conteúdo | 5 categorias estáticas (mercado/farmácia/viagem/lazer/combustível) — clicar troca só um parágrafo de descrição, sem cálculo nenhum. |
| **ConexaoPlacas** | Tabs de conteúdo | 4 formas de pagamento (financiamento iGreen/próprio/à vista/cartão) — clicar troca a descrição **e** o texto da mensagem do WhatsApp CTA. |
| **GreenSeguros** | Tabs de conteúdo | 2 planos (Compreensivo/Furto e Roubo) — clicar troca uma lista de itens cobertos **e** o texto do CTA. Único template com Meta Pixel além de GA4 (`fbq('track', 'Contact')` no clique do WhatsApp). |
| **Telecom** | Tabs de conteúdo (mais simples ainda) | 2 grades de planos já renderizadas como HTML estático (`data-modo`); o toggle só mostra/esconde uma das duas com `hidden`, sem gerar nada em JS — o próprio comentário do template justifica isso por SEO ("bons para SEO e funcionam sem JS"). |
| **ConexaoLivre** | Quiz de elegibilidade | 3 perguntas sim/não sequenciais; se as 3 forem "sim", mostra mensagem de elegibilidade "Grupo A" com CTA de WhatsApp com texto A; senão, mensagem alternativa com CTA de texto B. É uma árvore binária pequena, não uma calculadora. |
| **ConexaoSolar** | **Nenhum** | O card equivalente ao "bill-card" dos outros é uma lista estática ("O que você recebe") — sem JS de widget algum, só o boilerplate de máscara de telefone/GA4 que todos os 7 compartilham. |

Consequência prática: **um único componente "tabs de conteúdo" (grupo de
botões → troca um bloco de texto + o `href`/texto de um CTA) cobre 4 dos 7
produtos** (ConexaoClub, ConexaoPlacas, GreenSeguros, Telecom) com dados
diferentes, não lógica diferente. A calculadora (ConexaoGreen) e o quiz
(ConexaoLivre) são, cada um, um componente próprio — únicos no conjunto.
ConexaoSolar não precisa de nada novo além do card estático que já dá pra
montar com o design system atual.

## 2.2 Marca/paleta — achado que muda a pergunta original

Os 7 `style.css` usam a mesma paleta (`--verde-profundo:#07311D`,
`--verde-vivo:#00B359`, `--verde-vivo-escuro:#00893F`) — é a identidade
visual da iGreen, igual nos 7, não uma cor por produto.

**A Commercial Page real não herda paleta nenhuma da iGreen hoje — nem
teria como, do jeito que o app está montado.** `src/app/layout.tsx` chama
`resolveTenant(host)` uma vez por request e injeta `tenant.brand.tokens`
via `BrandTokensStyle` (`:root{--palette-900:...}` no `<head>`). Para um
subdomínio de representante (`teste-a.setnar.com`), `resolveTenant`
(`modules/tenancy/application/resolve-tenant.ts:12-23`) não encontra esse
host cadastrado como tenant — só `setnar.com`/`www.setnar.com`/`localhost`
estão (`setnar.tenant.ts:16`) — e cai no fallback `DEFAULT_TENANT_ID`, que É
o próprio SETNAR. **Toda Commercial Page hoje renderiza com a paleta do
SETNAR** (`--palette-900: 20 33 61`, azul-marinho), nunca com o verde da
iGreen — não porque alguém escolheu isso conscientemente para a Commercial
Page, mas porque não existe, no código, nenhum conceito de "marca por
Company/vertical" — só "marca por Company tenant" (SETNAR), e há uma Company
só. Isso explica tecnicamente por que a página "não tem nada a ver" com os
templates: não é falta de CSS, é que a página nunca teve de onde puxar a cor
da iGreen.

**E aqui mora a pergunta que muda tudo — não é só técnica, é de
compliance de marca.** O próprio `README.md` (seção "Compliance", que eu já
tinha lido como escopo só da página de marketing do SETNAR) registra uma
política real da iGreen:

> "iGreen's *Política de Uso da Marca* expressly prohibits licensees from
> creating advertising material using the iGreen brand (*'Fica expressamente
> PROIBIDA a criação de qualquer peça publicitária utilizando a marca iGreen
> Energy'*)."

Essa é uma política da iGreen sobre o que **licenciados** podem produzir — não
é escopada à página do SETNAR, é sobre qualquer peça publicitária. Os 7
templates usam a paleta verde da iGreen e, presumivelmente, foram
aprovados pela iGreen quando produzidos originalmente (o próprio README dos
templates diz "cópia aprovada por compliance") — mas isso não significa
automaticamente que o SETNAR, como plataforma, tem autorização pra reproduzir
essa mesma identidade visual em massa, para qualquer licenciado, via
software. **Não decido isso — mas não posso deixar de registrar que "deixar a
Commercial Page on-brand com a iGreen" não é só uma escolha de CSS: pode
exigir confirmação, com quem administra essa relação, de que replicar a
paleta/identidade visual da iGreen programaticamente ainda está dentro do que
a Política de Uso da Marca permite.** Ver §3.3.

## 2.3 `DESIGN_SYSTEM.md` — "No distractions" é literalmente a primeira versão do sistema

Rodei `git log --follow -p -- docs/DESIGN_SYSTEM.md`. O arquivo tem exatamente
dois commits na história: `1e1a86c "Primeira versão do sistema"` (28/07,
commit fundador do repositório inteiro — junto com `README.md`,
`ARCHITECTURE.md`, `DOMAIN_MODEL.md`, etc., antes de qualquer Sprint) e um
commit posterior só de tipografia (Inter vs. Plus Jakarta Sans), que não toca
a seção de Commercial Page. A seção "Commercial Page Components" ("No
distractions. No unnecessary navigation. The page exists to convert visitors
into conversations.") está lá, sem alteração, desde o commit fundador.

**Não há nenhum comentário, ADR ou nota indicando que isso era uma regra só
para uma fase inicial (MVP mínimo).** Está escrita como afirmação
incondicional, no mesmo documento e no mesmo tom que define WCAG AA como
"minimum standard" logo abaixo — ou seja, lida ao pé da letra, tem o mesmo
peso normativo que os requisitos de acessibilidade que o projeto de fato
trata como inegociáveis. Isso não significa que é uma regra permanente
pretendida — só que **nada no repositório sinaliza o contrário**. É
literalmente uma decisão de produto que o Pedro escreveu (ou aprovou) antes
de qualquer Commercial Page existir, nunca revisitada depois de ver o produto
funcionando de verdade. Ver §3.1 — a revisão consciente é decisão do Pedro,
não algo que eu deva reverter por conta própria.

## 2.4 Schema — nada mudou desde a investigação anterior, e o histórico do ADR-055 já é o precedente mais relevante

`products` continua só `id, company_id, slug, name` (`20260731000000`, sem
alteração — a migration mais recente é `20260812000000`, de analytics). A
única policy de leitura é `products_select_public` (`using (true)`) — leitura
pública já é irrestrita hoje, então uma coluna nova não precisaria de policy
nova, só existir. **Não existe policy de escrita nenhuma em `products`** —
nem para `authenticated`, nem função `SECURITY DEFINER` alguma. O catálogo
inteiro é seedado por migration (`20260803000000`, ADR-037) porque, no
raciocínio já registrado naquele arquivo, não há service role key neste
projeto para um script bypassar RLS.

Isso importa diretamente para a decisão de §3.2: **hoje, uma coluna nova em
`products` não compraria "editável em produção sem deploy" nenhuma** — só
teria um caminho de escrita via migration (mesmo commit/PR que editar um
arquivo `.ts`) ou via SQL Editor direto (fora de qualquer revisão de código).
Não existe, em lugar nenhum do `ROADMAP.md`, um item de "administração de
catálogo" antes do Stage 5 ("White Label" → "Administration": "User
management, Company settings, Billing") — ou seja, mesmo que o Pedro quisesse
dar a alguém de marketing acesso pra editar a calculadora sem mexer em
código, isso pede uma superfície de admin que não existe e não está no
roadmap próximo.

O precedente mais direto já existe: **ADR-055 já resolveu essa mesma
pergunta, para o aviso de compliance, escolhendo código, não coluna.** O
raciocínio registrado lá — "texto legal revisável por diff/PR, não editável
em runtime" — se aplica quase palavra por palavra ao conteúdo da calculadora
(também precisa de revisão humana antes de publicar, também não muda com
frequência).

## 2.5 GA4/Meta Pixel — tensiona com uma decisão já fechada, não é neutro

Os 7 templates carregam GA4 inline no `<head>` (`gtag('config', GA4_ID, {
representative_id, produto })`), e o GreenSeguros também carrega Meta Pixel
(`fbq('init', 'SEU_PIXEL_ID')` — **literalmente o placeholder, nunca
preenchido com um Pixel ID real**, o que sugere que isso nunca chegou a rodar
de verdade em produção, era aspiracional/copiado do template original antes
de existir uma conta Meta configurada).

Isso **não é redundante** com `analytics_events` (AN1-AN5) — são coisas
diferentes por natureza: `analytics_events` é uma contagem agregada, interna,
sem cookie, sem identificador persistente, para o representante ver "quantas
visitas/cliques" no próprio hub. GA4/Meta Pixel são **rastreadores de
terceiros** — cookies, pixels, dados enviados pra fora do Supabase, servindo
outro propósito (remarketing, otimização de campanha paga, audiências
lookalike). Um não substitui o outro.

**E aqui a tensão real:** `docs/QR_ANALYTICS_PLAN.md` §3.4 (já fechado,
2026-08-03) escolheu a postura conservadora de LGPD especificamente **porque**
não há cookie, não há fingerprint, não há identificador persistente — e essa
ausência é o argumento central pelo qual o projeto concluiu que **não precisa
de banner de consentimento**. Adicionar GA4/Meta Pixel introduz exatamente
os dois ingredientes que essa decisão diz que o projeto não tem. Não decido
isso — só registro que "adicionar GA4/Pixel" não é uma tarefa isolada, é
reabrir §3.4 do plano de analytics e possivelmente precisar de um banner de
consentimento que hoje não existe em lugar nenhum do produto.

## 2.6 Conteúdo/copy do meu conhecimento importado — disponível, mas não acessível por mim nesta sessão

Você me pediu para sinalizar, não copiar sozinho. Registro o que encontrei:
**ADR-055 já cita, com precisão de seção, "Green Seguros.md, §9.3/§10.3"**
como fonte da nota de compliance de seguros — ou seja, em algum momento
anterior deste projeto, esse arquivo foi de fato consultado. Nesta sessão
específica (ferramentas de terminal/filesystem), busquei por esse nome e por
`Telecom.md`/`Conexão Club.md` etc. em todo o disco acessível a mim — **não
encontrei nenhum desses arquivos**, nem no repositório (confirmado via `git
ls-files`) nem fora dele. `docs/SPRINT_D_PLAN.md` §1 já registrou o mesmo
problema para os 7 FAQs de produto do briefing original.

Não tenho, agora, acesso de leitura a esse conteúdo — só sei que ele existe
porque o ADR-055 já provou isso ao citá-lo. Se esses arquivos existem fora do
repositório (Drive, Notion, outra sessão de chat), a forma mais barata de eu
usá-los pros próximos passos (FAQ, textos de tabs, roteiro da calculadora) é
você colar o conteúdo relevante numa próxima conversa, ou trazer os arquivos
pro repositório (ex.: `docs/product-content/`, versionado, com o mesmo
tratamento de "fonte de verdade" que os templates HTML já recebem).

## 2.7 O que já funciona e não pode regredir

Levantamento direto do `README.md`/estado atual, pra qualquer implementação
futura confirmar contra isto:

- **Identificação do licenciado** (`LicenseeIdentificationBlock`, ADR-033).
- **CTA do WhatsApp com tracking de clique** (`WhatsappCta` → `/api/track-click`
  → `record_whatsapp_click`, ADR-053, best-effort, `keepalive`, nunca
  bloqueia a navegação).
- **Formulário de lead** (`LeadForm` → `/api/leads` → `submit_lead`, com
  máscara de telefone progressiva já aplicada em ambos os formulários do
  produto).
- **QR Code client-side** (`QrCodeCard`, ADR-049, renderizado no hub, não na
  Commercial Page em si).
- **Registro de visita** (`record_page_visit` via `after()`, ADR-053, nunca
  bloqueia a renderização).
- **Aviso "Antes de contratar" + "não é canal oficial"** (`ComplianceNotice`,
  ADR-055, por categoria de produto).

Todo trabalho novo deste plano é **aditivo** — nenhum passo abaixo deve
alterar a assinatura de `WhatsappCta`/`LeadForm`/`ComplianceNotice` nem tocar
nas migrations já aplicadas de analytics/leads. Onde um widget novo precisar
de um CTA de WhatsApp próprio (ex.: o quiz do ConexaoLivre gera uma mensagem
diferente por resultado), a forma mais segura é o widget calcular só o texto
da mensagem e continuar usando `WhatsappCta` (ou uma pequena variação dele)
como o único lugar que efetivamente monta a URL `wa.me` e dispara o
tracking — para não duplicar a lógica de tracking em cada widget novo.

---

# 3. Decisões em aberto — cada uma com o custo real, não fechadas aqui

## 3.1 Reabrir "No distractions" (`DESIGN_SYSTEM.md`)?

**Opção A — manter como está.** A Commercial Page continua mínima
(identificação + CTA + lead form + compliance). Nenhum widget novo é
construído; o conteúdo dos templates permanece só como referência.

A favor: zero trabalho, zero risco, consistente com o único documento que já
existia antes de qualquer Sprint.
Contra: os templates existem porque, presumivelmente, alguém validou (ou
pelo menos apostou) que aquele nível de conteúdo converte melhor — mantendo
a página mínima, essa aposta nunca é testada.

**Opção B — revisar conscientemente, registrar a nova decisão como ADR.**
`DESIGN_SYSTEM.md` ganha uma nota (ou é reescrito) explicando que "no
distractions" era o piso do Stage 1, não uma proibição permanente de conteúdo
de conversão — e o trabalho deste documento prossegue.

A favor: reconhece a lacuna real; abre caminho pros passos §4 abaixo.
Contra: é uma reversão de uma decisão de produto documentada desde o dia 1 —
merece ser uma escolha consciente, não um efeito colateral de "construir a
calculadora porque parecia óbvio".

**Não decido aqui.** Todo o §4 (implementação) depende desta decisão vir
primeiro — nenhum widget deveria ser construído antes dela, ou o trabalho
corre o risco de ser revertido.

## 3.2 Onde mora o conteúdo variável por produto — schema ou código

**Opção A — colunas novas em `products`** (ex.: `widget_type text`,
`widget_config jsonb`).

A favor: single source of truth em Postgres, consistente com o resto do
domínio (Company/Product/Representative todos vivem lá).
Contra (levantado em §2.4, não hipotético): hoje não compra editabilidade
real nenhuma — não há policy de escrita, não há service role key, não há
superfície de admin no roadmap antes do Stage 5. Precisaria de uma migration
por mudança de conteúdo (mesmo atrito de revisão que um arquivo `.ts`, só que
sem o benefício de tipagem forte do TypeScript) ou, pior, edição direta via
SQL Editor, fora de qualquer PR. Validação de forma de um `jsonb` (garantir
que cada `widget_type` tem as chaves certas) exigiria ou um `CHECK`
complexo em SQL ou validação na própria aplicação de qualquer forma — não
elimina a necessidade de código, só desloca onde.

**Opção B — arquivo de configuração por produto em código**
(`src/modules/representatives/domain/product-content/*.ts`), mesmo padrão
que `product-compliance-notice.ts` (ADR-055) já estabeleceu.

A favor: já é o precedente deste projeto para exatamente este tipo de
conteúdo (texto/estrutura que muda pouco, precisa de revisão antes de
publicar); tipagem TypeScript (um `type CalculatorConfig`/`type TabsConfig`
por padrão de widget) dá validação de forma em tempo de compilação, de graça;
zero migration; nunca fica dessincronizado do componente que consome (mesmo
deploy).
Contra: só quem tem acesso ao repositório edita — nenhum caminho pra alguém
de marketing sem acesso a código mexer sozinho.

**A pergunta que decide entre as duas, no seu enunciado: quem vai editar
esse conteúdo no futuro?** Se for sempre você (ou alguém com acesso ao
repo), B é estritamente mais barato hoje e já tem precedente direto. Se a
expectativa é que alguém de marketing edite sem depender de deploy, nem A
nem B resolvem isso sozinhas de verdade — A precisaria de uma superfície de
admin construída por cima (trabalho real, não coberto por este plano), e só
nesse cenário a coluna nova compensa o custo de migration.

**Inclinação, sem fechar:** Opção B, pelo mesmo motivo do ADR-055 e porque
constrói sobre um precedente já testado — mas é decisão sua, especialmente
pela pergunta de "quem edita" acima.

## 3.3 Paleta/identidade visual da iGreen na Commercial Page

**Separo esta pergunta da §3.1 de propósito** — "conteúdo mais rico"
(calculadora, FAQ, quiz) e "visual on-brand com a iGreen" (paleta verde,
`--verde-vivo`) são decisões independentes. Dá pra ter a primeira sem a
segunda: os widgets do §4 abaixo podem ser construídos com o design system
genérico do SETNAR (mesma paleta que a Commercial Page já usa hoje,
`Card`/`Button`/`Text`), sem herdar nenhuma cor da iGreen.

**Opção A — manter a paleta genérica do SETNAR.** Nenhuma mudança de
`BrandTokensStyle`/`resolveTenant`. Widgets novos usam os tokens que já
existem.

A favor: zero risco de compliance de marca (§2.2); zero infraestrutura nova
(não precisa inventar um conceito de "marca por vertical/Company" que não
existe hoje).
Contra: a página continua parecendo menos "iGreen" que os templates
originais — a parte estética da observação original do Pedro continua sem
resposta.

**Opção B — introduzir tokens de marca por vertical/Company**, aplicados só
nas Commercial Pages daquela Company (não no SETNAR).

A favor: fecha a lacuna estética de verdade; tecnicamente é uma extensão
natural do que `BrandTokensStyle` já faz (o mecanismo de injeção de CSS
custom properties já existe, só precisa de uma segunda fonte de tokens).
Contra: **depende de confirmar antes que replicar a paleta/identidade visual
da iGreen por software não infringe a Política de Uso da Marca da iGreen**
(§2.2) — isto não é uma dúvida técnica, é uma dúvida de compliance de marca
que só quem administra essa relação com a iGreen consegue responder. Fazer
isso sem confirmar é o tipo de risco alto que este documento existe pra não
fechar sozinho.

**Não decido, e marco como a decisão mais sensível deste documento
inteiro** — recomendo resolver esta pergunta específica (confirmação sobre a
Política de Uso da Marca) antes de qualquer outra coisa deste plano, mesmo
que o resto (§3.1/§3.2, os widgets do §4) avance em paralelo.

**Nota de revisão (2026-08-04).** CP1 continua **sem confirmação da
iGreen** — não decidido, exatamente como registrado acima. O que mudou:
Pedro decidiu implementar CP9 mesmo assim, como protótipo interno não
aprovado, para usar como peça de apresentação ao pedir essa mesma
confirmação — ver [`ADR-057`](../adr/ADR-057-mecanismo-de-tokens-de-marca-por-verticalcompany-aplicado.md) e a nota no início de §4/CP9 abaixo.
Isso não fecha esta decisão; só muda a ordem em que o risco foi assumido.

## 3.4 GA4/Meta Pixel

**Opção A — não adicionar.** `analytics_events` continua sendo o único
tracking da Commercial Page.

A favor: mantém a postura de LGPD já fechada em `QR_ANALYTICS_PLAN.md` §3.4
intacta, sem reabri-la.
Contra: sem GA4/Pixel, não há como alimentar campanhas pagas (Google
Ads/Meta Ads) com eventos de conversão — se o Pedro ou os representantes
pretendem rodar tráfego pago pra essas páginas, isso é uma lacuna real, não
cosmética.

**Opção B — adicionar, com banner de consentimento novo.** Reabre §3.4 do
plano de analytics, constrói a infraestrutura de consentimento que o próprio
`QR_ANALYTICS_PLAN.md` já registrou como "não existe em lugar nenhum" —
trabalho de tamanho comparável ao que este documento inteiro propõe pros
widgets, só que numa área diferente (consentimento/privacidade, não
conversão).

**Não decido.** Registro como pergunta em aberto, independente do resto — só
levantar, como o enunciado pediu.

---

# 4. Plano de implementação, em passos pequenos

Cada passo é revisável e testável isoladamente, mesmo processo de sempre:
**auditar → Pedro revisa → implementar → `npm run verify` → ADR em
`docs/adr/` (a partir de ADR-056) + verificação manual documentada.**

## CP1 — Confirmar a Política de Uso da Marca da iGreen (§3.3)

**Concluído em 13/08/2026 para o escopo controlado da SET-78.** A validação
não autoriza materiais livres nem remove a identificação do representante,
a autoria SETNAR ou o aviso de canal não oficial. O texto abaixo permanece
como registro da investigação que antecedeu a decisão.

*Não é código.* Antes de qualquer trabalho visual, confirmar com quem
administra a relação com a iGreen se replicar a paleta/identidade visual
(`--verde-vivo` etc.) numa Commercial Page gerada por software está dentro
do que a Política de Uso da Marca permite. Sem isso, §4 CP7 (visual on-brand)
não deveria prosseguir — o resto (CP2-CP6) não depende desta resposta.

## CP2 — Decidir §3.1 (reabrir "no distractions") e §3.2 (schema vs. código)

*Não é código.* Duas decisões de produto que bloqueiam tudo abaixo. Uma vez
fechadas, registrar como ADR-056 (ou dois ADRs, um por decisão) antes de CP3.

## CP3 — Componente "Tabs de conteúdo" + 1 produto (prova de conceito)

**Implementado — ver [`ADR-056`](../adr/ADR-056-no-distractions-passa-a-significar-cta-unico-nao.md).** Descrição abaixo mantida como
registro do plano original; não repete o que o ADR já documenta em detalhe.

*Depende de CP2.*

- Um Client Component novo (`src/modules/representatives/presentation/`),
  recebendo um array de `{ chave, rotulo, descricao, mensagemWhatsapp }` como
  prop — a mesma forma que já cobre ConexaoClub/ConexaoPlacas/GreenSeguros/
  Telecom, variando só o dado.
  Conteúdo de cada produto (§3.2, Opção B): novo arquivo em
  `product-content/`, mesmo padrão de `product-compliance-notice.ts`.
- Escolher **1 produto só** pra provar o padrão antes de rolar pros outros 3
  — ConexaoClub é o mais simples (sem CTA por aba, só troca de texto).
- Zero mudança em `WhatsappCta`/`LeadForm`/`ComplianceNotice`.
- Teste: função pura de "qual conteúdo está ativo dado uma chave selecionada"
  no mesmo nível de `product-compliance-notice.test.ts`; sem infraestrutura
  de teste de render React (mesmo limite já documentado no ADR-055).

## CP4 — Rolar "Tabs de conteúdo" pros outros 3 produtos

*Depende de CP3 provar o padrão.* ConexaoPlacas, GreenSeguros, Telecom — só
dado novo por arquivo `product-content/`, componente inalterado.

## CP5 — Calculadora de desconto (ConexaoGreen)

*Depende de CP2. Pode ser feito em paralelo com CP3/CP4 — padrão
independente.*

- Client Component próprio (não reaproveita o de CP3 — é matemática, não
  troca de texto). Estado local (`useState`) pro valor digitado; recalcula a
  cada `onChange`, sem round-trip de rede — mesmo princípio do `QrCodeCard`
  (client-side, instantâneo).
- Constantes de negócio (`DESCONTO_MIN/MAX`, `CARGA_TRIBUTARIA`,
  `ILUMINACAO_PUBLICA`, `CUSTO_DISPONIBILIDADE`) precisam de confirmação da
  iGreen antes de publicar — o próprio template original já sinalizava isso
  como pendente ("CONFIRMAR COM A IGREEN"), não é uma lacuna nova que este
  plano introduz.
- Teste: função pura do cálculo (`baseCompensavel`, faixa de economia),
  cobrindo os casos de borda (conta abaixo do custo de disponibilidade,
  etc.) — mesmo nível dos testes de `lead-rules.ts`.

## CP6 — Quiz de elegibilidade (ConexaoLivre)

*Depende de CP2. Pode ser feito em paralelo com CP3-CP5.*

- Client Component com estado local (3 respostas), lógica de elegibilidade
  como função pura testável isoladamente (dado um conjunto de respostas,
  qual o resultado e qual mensagem de WhatsApp).

## CP7 — ConexaoSolar

*Depende de CP2, mas é o menor passo do plano.* Confirmar que o card estático
("O que você recebe") não precisa de nenhum componente novo — cabe no design
system atual (`Card` + lista), sem widget interativo nenhum.

## CP8 — FAQ / "Como funciona" / vídeo / trust strip

*Depende de CP2. Conteúdo por produto — mesma decisão de schema/código de
§3.2, reaproveitando a mesma forma de arquivo em `product-content/`.*

- FAQ: componente de acordeão (`<details>`/`<summary>`, mesmo elemento
  nativo que os templates já usam — sem dependência nova).
- "Como funciona": lista de passos, componente genérico reaproveitável pelos
  7 produtos.
- Vídeo: embed do YouTube (`youtube-nocookie.com`, já a escolha
  privacy-conscious dos templates originais) — decisão separada, cada
  produto tem (ou não) um vídeo próprio; nenhum é obrigatório.
- Trust strip: lista curta de badges de confiança, mesma forma pros 7.

## CP9 — Visual on-brand (paleta iGreen)

**Implementado inicialmente como protótipo e aprovado em 13/08/2026 no escopo
controlado da SET-78 — ver [`ADR-057`](../adr/ADR-057-mecanismo-de-tokens-de-marca-por-verticalcompany-aplicado.md).**
Descrição abaixo mantida como registro do plano original.

*Depende de CP1 (confirmação de marca) — não prossiga sem isso.* Se
confirmado: token de marca por vertical/Company, aplicado só nas Commercial
Pages daquela Company, seguindo o mecanismo que `BrandTokensStyle` já
implementa. Tamanho real só dá pra estimar depois da resposta de CP1 — pode
ser pequeno (reaproveita a mesma injeção de CSS custom properties) ou exigir
desenho novo (se a resposta for "sim, mas com regras", não um "sim" simples).

## CP10 — GA4/Meta Pixel (§3.4)

*Decisão separada (§3.4), não bloqueia nem é bloqueada pelo resto deste
plano.* Se decidido que sim: escopo real inclui reabrir a infraestrutura de
consentimento do `QR_ANALYTICS_PLAN.md` — tratar como sub-plano próprio, não
um passo pequeno dentro deste documento.

---

# 5. Tabela de precondições

| Passo | Depende de | Toca schema? | Depende de decisão do Pedro? |
|---|---|---|---|
| CP1 — confirmar Política de Uso da Marca | — | não | Sim — pergunta de compliance, não técnica |
| CP2 — reabrir DESIGN_SYSTEM.md + schema vs. código | — | não | Sim — §3.1 e §3.2 |
| CP3 — tabs, 1 produto | CP2 | não (Opção B) / sim (Opção A) | não, já decidido em CP2 |
| CP4 — tabs, +3 produtos | CP3 | mesma de CP3 | não |
| CP5 — calculadora ConexaoGreen | CP2 | mesma de CP2 | Confirmação das constantes com a iGreen |
| CP6 — quiz ConexaoLivre | CP2 | mesma de CP2 | não |
| CP7 — ConexaoSolar | CP2 | não | não |
| CP8 — FAQ/como funciona/vídeo/trust strip | CP2 | mesma de CP2 | Fonte do conteúdo (§2.6) |
| CP9 — visual on-brand iGreen | **CP1** | não | Sim — resultado de CP1 |
| CP10 — GA4/Meta Pixel | — | eventualmente (consentimento) | Sim — §3.4, sub-plano próprio |

---

# 6. Ordem sugerida

**Pode começar hoje, sem esperar nada de código:**
- **CP1** — é a mais barata de resolver (uma conversa/e-mail, não uma
  linha de código) e a mais arriscada de deixar para depois — quanto mais
  widgets/conteúdo forem construídos sem essa resposta, maior o retrabalho
  se a resposta vier "não" mais tarde.
- **CP2** — as duas decisões de produto que abrem todo o resto.

**Depois de CP2, o menor passo de maior alcance:**
- **CP3** (tabs, 1 produto) — prova o padrão que cobre 4 dos 7 produtos com
  o menor código novo possível.

**Em paralelo entre si, depois de CP2:**
- **CP4** (rolar tabs pros outros 3), **CP5** (calculadora), **CP6** (quiz),
  **CP7** (Solar) — cada um isolado, revisável separadamente.

**Pode andar em paralelo com tudo acima, mesma dependência (CP2):**
- **CP8** (FAQ/como funciona/vídeo/trust strip) — mas só depois de resolver
  §2.6 (de onde vem o conteúdo real, já que inventar copy de FAQ sem fonte
  não é uma boa ideia pra conteúdo que toca compliance/objeções reais de
  venda).

**Só depois de CP1 responder "sim":**
- **CP9** (paleta iGreen) — tamanho real só dá pra estimar depois da
  resposta.

**Registrado, separado, não bloqueante:**
- **CP10** (GA4/Meta Pixel) — sub-plano próprio se decidido que sim.

Cada passo: `npm run verify`, ADR novo em `docs/adr/` (a partir de ADR-056),
e — pra qualquer passo que toque conteúdo legal/de compliance/promessa de
desconto (a calculadora em particular) — confirmação explícita de que o
texto/número não é uma alegação de resultado que o `README.md` já proíbe
("No claim about earnings, results, or price", seção Compliance) sem
sign-off.

**Não coberto por este plano, de propósito:** metadados por página
(`generateMetadata`/OG image por produto — já adiado no ADR-055,
independente deste documento), AN6/AN7 do `QR_ANALYTICS_PLAN.md`
(estatísticas agregadas/retenção — já despriorizados por você em favor
deste plano), e qualquer superfície de administração de catálogo (Stage 5).
