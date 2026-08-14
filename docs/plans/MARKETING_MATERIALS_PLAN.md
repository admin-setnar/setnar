# MARKETING_MATERIALS_PLAN.md

> Plano de investigação — integração nativa dos 21 materiais de divulgação de
> `templates/marketing-materials/` (SET-65)
> Escopo: mapear a biblioteca de referência contra a arquitetura real do
> SETNAR, verificar premissas técnicas no código e registrar as decisões de
> produto já tomadas — nenhuma implementação acontece a partir deste
> documento sozinho.

**Status:** Approved — implementado (21/21 peças portadas, `/app/paginas/marketing` no ar). D0/D1/D2/D3/D4/D5/D6 todos fechados; ver ADR-090 para D1
**Authority:** Non-normative (ver `docs/plans/README.md`)
**Code baseline:** `2253ca4`, branch `set-78-commercial-pages-templates`, 2026-08-14
**Last reviewed:** 2026-08-14 (revisão 3 — implementação concluída após POC de D1; ver ADR-090)
**Superseded by:** —

> **Este plano NÃO é uma especificação final e NÃO autoriza implementação.**
> Toda decisão abaixo marcada `EM ABERTO` continua exigindo escolha do Pedro
> ou evidência de uma POC — nenhuma delas deve ser resolvida por quem só está
> lendo o documento, nem por uma IA. Itens marcados `DECIDIDO` registram uma
> decisão de produto já tomada (nesta revisão ou antes) — não uma dedução
> minha. Mesmo contrato do `COMMERCIAL_PAGE_CONTENT_PLAN.md`.

**Legenda de status usada em todo o documento:** `DECIDIDO` · `EM INVESTIGAÇÃO` (evidência já levantada, aguardando aprovação do Pedro sobre a recomendação) · `EM ABERTO` (exige escolha ou evidência adicional) · `FORA DE ESCOPO` (desta rodada de trabalho, não necessariamente para sempre).

---

# 0. Bandeira de governança — D0 [DECIDIDO]

**Decisão do Product Owner, registrada nesta revisão:** a funcionalidade
mínima de materiais de marketing é antecipada para o Stage 1.

**Justificativa registrada:** os materiais não estão sendo antecipados como
uma "Media Library" completa nem como expansão cosmética do produto — são o
**mecanismo de distribuição das próprias Commercial Pages** que o Stage 1
existe para validar:

```text
Representante → recebe material personalizado → divulga → potencial
cliente acessa → Commercial Page do representante → CTA / lead / conversão
→ SETNAR demonstra geração de resultado
```

Sem um mecanismo simples de distribuição, o risco é medir só a eficácia da
Commercial Page depois que o tráfego já chegou, sem ajudar o representante a
gerar esse tráfego — o que deixaria metade da hipótese do Stage 1 sem teste.
Esta é exatamente a "razão registrada" que `ROADMAP.md` exige para puxar uma
capacidade para frente da ordem normal (§0 da revisão anterior deste plano
já citava a cláusula; agora está preenchida).

## Fronteira explícita — o que esta decisão autoriza e o que não autoriza

**Autorizado conceitualmente para o Stage 1** — as 21 peças já existentes
(7 verticais × 3 formatos: Post, Story/Status, Poster), com:

- personalização com dados reais do representante;
- QR Code da Commercial Page correspondente;
- preview;
- download/exportação;
- disponibilização apenas para produtos/páginas aos quais aquele
  representante realmente tenha acesso/estejam ativos, pela regra que já
  existe hoje (ver § 2.6 — não é uma flag nova).

**Não autorizado por esta decisão**, salvo decisão futura própria: criação
de campanhas, editor visual, geração de novas artes pelo usuário, IA
generativa, biblioteca aberta de templates, favoritos, ranking de materiais,
A/B testing, analytics avançado específico da biblioteca, versionamento
editorial complexo, upload de materiais, marketplace, gestão de campanhas, e
qualquer expansão além do necessário para disponibilizar as 21 peças já
existentes. Essa é a linha entre "mecanismo de distribuição do Stage 1" e a
"Media Library" completa do Stage 2 que `ROADMAP.md` já cataloga — a decisão
de D0 fecha só a primeira.

## Consequência documental, registrada e não executada

`docs/PRODUCT.md` § *Future vision* e `docs/ROADMAP.md` § Stage 2 §
*Material Library* vão ficar desatualizados assim que a primeira peça for
implementada — o mesmo tipo de gap que `docs/plans/AUDIT_MVP_LAUNCH.md` (Achado 2)
já registrou para o gateway de pagamento. `docs/README.md` § *Documentation
Definition of Done* exige que `PRODUCT.md` § *What Exists Today* reflita a
capacidade assim que ela existir para o cliente. **Esta tarefa não altera
nenhum documento normativo** — só registra aqui que essa atualização será
necessária quando (e não antes) a primeira peça for implementada de verdade.

---

# 1. Onde isso se encaixa no que já existe

`docs/DOMAIN_MODEL.md` não define "marketing material" como entidade — o
termo aparece em `PRODUCT.md` (Future vision) e em `docs/ARCHITECTURE.md` §
*Modules*, cuja lista aspiracional já inclui **"Media Library"** como módulo
próprio, separado de "Commercial Pages". Sinal de intenção arquitetural
pré-existente, não uma decisão tomada — a mesma lista inclui "CRM" e "AI",
que não existem.

O precedente mais próximo é `templates/commercial-pages/` → sete árvores
React reais (SET-78/ADR-089): uma biblioteca de referência (HTML estático
com `{{TOKEN}}`) portada produto a produto, com um dispatcher único
(`dispatch-commercial-page.tsx`) selecionando a árvore certa por
`product.slug`. `templates/marketing-materials/` já nasce mais perto do
destino — é React + CSS Modules, não HTML estático.

---

# 2. Investigação — premissas técnicas reverificadas no código

## 2.1 Estrutura da biblioteca de referência

`templates/marketing-materials/` — não commitada (`git status` mostra `??`),
54 arquivos: **7 verticais × 3 formatos** (post 1080×1080, story 1080×1920,
poster A4 794×1123) + `shared/`. As 7 verticais são as mesmas 7 do catálogo
iGreen já seedado.

**Duas referências penduradas confirmadas** — `types.ts` cita *"ENGINEERING_GUIDELINES
do projeto principal, seção de materiais de marketing"* e cada `fonts.ts`
cita *"Guideline do projeto (seção 17)"*. Busquei as duas em
`ENGINEERING_GUIDELINES.md`: **nenhuma existe.** Ver D5.

## 2.2 Correção de premissa — o registry NÃO tem peças faltando `[EM INVESTIGAÇÃO → resolvido]`

A leitura anterior deste plano afirmou que `shared/registry.tsx` tinha
`Component: null` para peças não implementadas. **Isso estava errado.**
Reli o arquivo: a única ocorrência de `Component: null` é a assinatura de
tipo da interface `MaterialSlot` (`Component: ComponentType<...> | null`) —
uma permissão de tipo para um cenário de rollout incremental que não está em
uso. **Todas as 21 entradas do array `MATERIALS_REGISTRY` apontam para um
componente real, importado e existente.** Verificado: `find . -name
"*.tsx" ! -path "./shared/*"` retorna exatamente os 21 arquivos que o
registry importa.

**Não existe, em nenhum lugar do repositório, uma página que consuma esse
registry.** `shared/ScaledFrame.tsx` (utilitário de preview em escala) e
`shared/registry.tsx` são infraestrutura pronta para uma galeria de preview,
mas nenhuma rota, componente ou script os importa — busquei por
`marketing-materials`, `MATERIALS_REGISTRY`, `MarketingMaterial` em `src/` e
por qualquer `page`/`gallery`/`preview`/`index` dentro da própria pasta
`templates/marketing-materials/`: zero resultados nos dois casos. O registry
é metadata pronta, não uma implementação desacoplada de propósito — só nunca
foi conectada a nada.

## 2.3 Matriz real de uso de props nos 21 componentes `[verificado por grep, não assumido]`

Contagem de arquivos que realmente referenciam cada campo do contrato
`MarketingMaterialProps`, por formato:

| Campo | Post (7) | Story (7) | Poster (7) | Total (21) |
|---|---:|---:|---:|---:|
| `representativeName` | 7 | 7 | 7 | **21** |
| `representativeFirstName` | 0 | 0 | 0 | **0** |
| `representativeId` | 7 | 7 | 7 | **21** |
| `representativePhone` | 7 | 7 | 7 | **21** (100% condicional, ver abaixo) |
| `representativeCity` | 2 | 0 | 0 | **2** |
| `representativeAvatarUrl` | 0 | 0 | 0 | **0** |
| `publicUrl` | 7 | 7 | 7 | **21** |
| `qrCodeDataUrl` | 7 | 7 | 7 | **21** |

**Achados que mudam o contrato mínimo real:**

- **`representativeFirstName` não é usado por nenhuma das 21 peças.** Está
  declarado no contrato (`shared/types.ts`, comentário: "CTAs curtos, ex.
  'Falar com Mariana'") mas nenhum componente atual o consome. Campo morto —
  não precisa entrar no mapper.
- **`representativeCity` só aparece em 2 dos 21** (`conexao-green-post.tsx`,
  `conexao-livre-post.tsx`), sempre como sufixo opcional:
  `{representativeCity ? \` · ${representativeCity}\` : ''}`. Confirma que é
  genuinely opcional, não um campo core.
- **`representativePhone`: as 21 peças tratam a ausência condicionalmente**
  (`grep` confirma o padrão `representativePhone ?` presente em 100% dos
  arquivos) — nenhuma risca de renderizar um número vazio, consistente com o
  que o comentário do contrato já prometia.
- **`representativeAvatarUrl`: zero peças o renderizam.** Ver D3.

## 2.4 QR Code — geração já existe, não duplicar

`src/modules/representatives/presentation/qr-code-card.tsx` já gera o QR
Code via `toDataURL()` do pacote `qrcode` (já é dependência de produção,
`package.json`), hoje acoplado a um componente `'use client'` (chamada
dentro de um `useEffect`, com estado de loading/erro/retry).

`toDataURL` do pacote `qrcode` é **isomórfico** — roda igual em Node
(server) ou browser (client), sem diferença de API. Isso importa
diretamente para D1: **a extração para um utilitário puro (`generateQrCodeDataUrl(url:
string): Promise<string>`, provavelmente em `src/shared/lib/`, mesma casa de
`cn`/`getClientIp`) funcionaria com qualquer renderer escolhido em D1**, sem
duplicar a chamada por peça e sem acoplar a lógica de geração à UI de
`QrCodeCard`. Não fiz a extração nesta tarefa — só registro a recomendação.

## 2.5 Fonte de verdade dos dados — mapeamento completo

| Necessidade do material | Fonte real no SETNAR |
|---|---|
| Nome | `Representative.name` (`src/modules/representatives/domain/representative.ts:19`) |
| Primeiro nome | **Não necessário** — 0/21 peças usam (§2.3) |
| ID do licenciado | `Representative.authorizationId` |
| WhatsApp (exibição) | `Representative.phone` (E.164, canônico — confirmado em `representative-rules.ts`) → `formatE164ToBRPhone()` (`src/shared/domain/br-phone.ts`) para o formato `"(41) 99999-9999"` que as peças esperam. Já usado hoje para pré-preencher o formulário de edição de perfil — não é uma conversão nova |
| Cidade | `Representative.city` |
| Avatar | Campo `Representative.avatarUrl` **existe no tipo de domínio**, mas nunca é populado na prática — `PRODUCT.md` confirma "Profile photo — not implemented", sem UI de upload em lugar nenhum. Consistente com D3: sempre `null` hoje |
| URL pública | `buildCommercialPageUrl(representative, product)` (`presentation/commercial-page-url.ts`) — a mesma função que já gera o link mostrado em `/app/paginas` e o canonical/OG da Commercial Page (SET-11). Uma única derivação, não uma nova |
| QR Code | `toDataURL(publicUrl)`, ver §2.4 |
| Produto/página | `RepresentativeCatalogEntry.product` (`RepresentativeCatalogRepository.listOwnCatalog()`) |
| Ativo/disponível | Ver §2.6 — reaproveita regra existente, nenhuma flag nova |

## 2.6 Produtos ativos e disponibilidade — regra já existe, não inventar `isActive`

`src/modules/representatives/presentation/representative-hub.tsx` (o
componente real de `/app/paginas`) já resolve exatamente este problema hoje:

```text
listOwnCatalog(profileId)                    // RepresentativeCatalogRepository
   → RepresentativeCatalogEntry[] { product, state }
        → getActivationViewState(state, subscriptionActive, profileComplete)
             → ActivationViewState.isPubliclyAvailable: boolean
```

`isPubliclyAvailable = profileComplete && subscriptionActive && state ===
'published'` (`activation-view-state.ts:59`) é a regra exata que decide se o
link público e o QR Code aparecem em `/app/paginas` hoje. **Filtrar o
catálogo de materiais pela mesma condição, para o mesmo representante,
resolve a disponibilidade sem nenhuma flag nova, nenhuma migration, e sem
divergir da regra que já rege a própria Commercial Page.** Isso fecha
diretamente o requisito que D0 e D6 colocam (só mostrar materiais de
produtos realmente disponíveis).

## 2.7 Tenancy e segurança — requisito, não detalhe

Todo o padrão existente (`listOwnCatalog(profileId)`,
`RepresentativeAccountRepository.findByProfileId`, etc.) resolve o
representante **a partir do `auth.uid()` do chamador, nunca de um parâmetro
de rota ou query string** — confirmado em múltiplos testes de integração já
existentes ("derives the target from auth.uid", "never resolves another
representative's activation"). Isso precisa ser um requisito explícito da
futura implementação, não uma suposição: a rota de materiais deve resolver
"quais materiais eu vejo" do mesmo jeito que `/app/paginas` resolve "quais
produtos eu tenho" — nunca aceitando um `representativeId` vindo do cliente.

## 2.8 Tipografia — inventário completo por vertical

| Vertical | Famílias | Pesos usados |
|---|---|---|
| conexao-green | Archivo Black, Space Grotesk, JetBrains Mono | Archivo Black 400 · Space Grotesk 400/500/700 · JetBrains Mono 400/500 |
| conexao-club | Bebas Neue, Space Grotesk, JetBrains Mono | Bebas Neue 400 · Space Grotesk 400/500/700 · JetBrains Mono 400/500 |
| conexao-livre | Space Grotesk, Inter, JetBrains Mono | Space Grotesk 500/700 · Inter 400/600 · JetBrains Mono 400/500 |
| conexao-placas | Bebas Neue, Manrope, JetBrains Mono | Bebas Neue 400 · Manrope 400/600/800 · JetBrains Mono 400/500 |
| conexao-solar | Archivo Black, Manrope, JetBrains Mono | Archivo Black 400 · Manrope 400/600/800 · JetBrains Mono 400/500 |
| green-seguros | Manrope, Inter, JetBrains Mono | Manrope 500/700/800 · Inter 400/600 · JetBrains Mono 400/500 |
| telecom | Sora, Manrope, JetBrains Mono | Sora 600/700/800 · Manrope 400/600 · JetBrains Mono 400/500 |

**Achados relevantes para D2:**

- **6 famílias novas no total** (Archivo Black, Space Grotesk, Bebas Neue,
  Sora, Inter-peso-fixo, Manrope-peso-fixo), não 5 como a leitura anterior
  contou — `Inter`/`Manrope` de peso fixo (`@fontsource/inter`,
  `@fontsource/manrope`) coexistem sem conflito de nome com as variáveis já
  instaladas (`@fontsource-variable/inter`, `@fontsource-variable/manrope`)
  porque são pacotes npm diferentes — só duas estratégias de carregamento em
  paralelo, não uma colisão.
- **`JetBrains Mono` 400/500 é usado nas 7 verticais** — é o único elemento
  tipográfico realmente universal da biblioteca (accent/eyebrow em todas as
  peças).
- **Cada `fonts.ts` já importa só os pesos específicos usados**
  (`@fontsource/space-grotesk/700.css`, não a família inteira) — a
  otimização "carregar só os pesos necessários" que a Decisão 6 do prompt
  pede para investigar **já é a prática em uso na biblioteca de
  referência**, não uma melhoria a fazer.

---

# 3. Decisões

## D0 — Antecipar Material Library mínima para o Stage 1 — `[DECIDIDO]`

Ver § 0.

## D1 — Pipeline de geração do arquivo final — `[DECIDIDO — ver ADR-090]`

**Fechado em 2026-08-14, na implementação.** POC real executada contra as 3
peças de Conexão Green, comparando B1 (`html-to-image`, client-side) e A2
(Playwright, server-side) — não só as opções em tese, código de verdade
rodando. A1 (Satori) foi descartada analiticamente antes da POC: `grep`
confirmou `::before`/`::after` nas 21 folhas de estilo, recurso que o
modelo do Satori não suporta sem reescrever cada peça.

**Resultado:** B1 (`html-to-image`, client-side) escolhida — dimensões
exatas e fidelidade visual idênticas a A2 nas 6 combinações testadas
(3 peças × caso completo/caso extremo), performance comparável (83–324ms),
zero infraestrutura de servidor nova. Evidência completa, alternativas
descartadas e trade-offs aceitos: `docs/adr/ADR-090-materiais-de-marketing-exportam-via-captura-client-side.md`.

Texto original da investigação, preservado abaixo pelo raciocínio, não como
decisão ainda em aberto:

Não escolhido nesta revisão — exige evidência de POC (§4). Opções
tecnicamente plausíveis para este repositório, revisadas para não tratar
"client-side" como sinônimo de uma única biblioteca:

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| **A1. `@vercel/og` / `next/og` (Satori)** | Rota dedicada gera a imagem via `ImageResponse`, JSX server-side | Nativo do Next.js/Vercel, sem dependência de browser headless, rápido | **Satori só entende um subconjunto de CSS (flexbox, sem CSS Grid, sem `@font-face` externo direto — fontes entram como buffer)**. As 21 peças usam CSS Modules com composição livre (gradients, possivelmente grid) — portar para este modelo exige **reescrever cada peça no dialeto do Satori**, não reaproveitar o CSS Modules quase verbatim. Fidelidade visual é a incógnita real aqui |
| **A2. Renderização server-side via browser headless** (Playwright — já é devDependency do projeto, hoje só para E2E — ou uma alternativa mais leve tipo `puppeteer-core` + `@sparticuz/chromium`) | Uma rota/serviço abre um browser real, navega até a peça renderizada com o CSS real, tira screenshot ou gera PDF | **Fidelidade total** — é o CSS Modules e as fontes reais, sem reescrever nada; Playwright já está no projeto (mudaria de devDependency para dependency real, ou um processo separado) | Binário de browser em ambiente serverless é pesado (tempo de cold start, limite de tamanho de função na Vercel); precisa de pesquisa de compatibilidade específica com o plano/infra Vercel atual do projeto |
| **B1. DOM → imagem no cliente, biblioteca de captura** (`html2canvas`, ou alternativas mais novas como `html-to-image`/`dom-to-image-more` — não tratar como equivalentes entre si, cada uma tem trade-offs próprios de fidelidade de fonte/gradiente) | Renderiza o componente real na tela do representante, biblioteca "fotografa" o DOM renderizado para um canvas/PNG | Reaproveita os componentes React exatamente como estão, sem servidor novo | Fidelidade depende do navegador do representante; requer sincronizar o carregamento das fontes antes da captura (`document.fonts.ready`) para não cortar texto com a fonte de fallback; nova dependência client-side |
| **B2. SVG/Canvas nativo** (recompor a peça como desenho vetorial/canvas em vez de HTML+CSS) | Controle total de layout, sem depender de nenhuma biblioteca de captura | Máxima previsibilidade de resultado | **Descarta a maior parte do reaproveitamento do CSS Modules já escrito** — cada peça precisaria ser re-implementada como desenho, custo de engenharia bem mais alto que as outras opções |
| **C. Só tela "printável"** (sem geração de arquivo — print-to-PDF do navegador ou screenshot manual) | Nenhuma dependência nova | Menor custo por larga margem | **Não é equivalente em UX às demais opções** — o objetivo do produto é Preview → Baixar → arquivo pronto, não uma instrução de "como printar a tela". Mantida como baseline de menor complexidade, não como opção de mesmo nível |

**Alvo de formato, a validar na POC, não decidido:** `Post → PNG`, `Story →
PNG`, `Poster → PNG e/ou PDF` (A4 sugere PDF como opção natural para uso
físico, mas isso depende do que a POC mostrar sobre cada pipeline).

## D2 — Estratégia de tipografia — `[DECIDIDO em princípio — impacto a confirmar na POC]`

**Decisão de produto registrada nesta revisão: a preferência é preservar as
fontes originais das artes.** A tipografia faz parte da identidade visual e
da composição de cada peça — não consolidar automaticamente para
Inter/Manrope só porque essas já existem nas Commercial Pages.

```text
Preservar fontes originais → medir impacto na POC → só simplificar se
existir justificativa técnica concreta
```

O que a POC precisa medir, com base no inventário do §2.8: impacto real de
bundle **depende inteiramente de D1** — se a renderização for server-side
isolada (A1/A2), o custo de bundle do app principal é zero ou próximo disso;
se for client-side (B1), as 6 famílias extras entram no orçamento de
carregamento do navegador do representante. `JetBrains Mono` (universal,
7/7 verticais) é a candidata mais segura a ficar, independente do resultado.

## D3 — Campo `representativeAvatarUrl` — `[DECIDIDO]`

**Verificado nos 21 componentes: nenhuma peça renderiza
`representativeAvatarUrl`** (§2.3 — 0/21). Decisão de produto (não
implementar avatar como requisito do MVP dos materiais) confirmada como
segura pela evidência — não há adaptação visual nenhuma a fazer, o campo
simplesmente não precisa entrar no mapper `Representative` →
`MarketingMaterialProps`. Nenhuma proposta de foto de perfil, schema ou
storage nasce daqui.

## D4 — Arquitetura mínima, não cerimonial — `[DECIDIDO — implementado]`

A recomendação abaixo foi implementada quase literalmente, com um ajuste
descoberto durante a implementação: `MaterialSlot.Component` (referência de
função) não pode atravessar a fronteira servidor→cliente do React Server
Components como prop — `materials-page.tsx` (Server Component) por isso
nunca importa os 21 componentes reais; resolve só `productSlug` e delega a
`ProductMaterialsCard` (`'use client'`) resolver o registry do lado cliente.
Isso também separou `material-catalog.ts` (metadata pura — slugs, formatos,
dimensões, sem import de React) de `registry.ts` (a lista real com os
componentes), o que acabou sendo necessário por um segundo motivo:
`node --test` não tem loader de CSS, e qualquer teste que importasse
`registry.ts` (que puxa os 21 componentes → cada `./fonts` → `.css`) travava
no `require`. Ver árvore final implementada em `ADR-090` e no relatório da
tarefa. Nenhuma pasta `infrastructure/`/`application/`/`domain/` foi criada —
D1 não exigiu adapter nenhum.

Texto original da investigação, preservado pelo raciocínio:

Antes de propor camadas, verifiquei se a feature tem as responsabilidades
que justificariam cada uma:

| Pergunta | Resposta |
|---|---|
| Existe entidade de domínio `MarketingMaterial` persistida? | Não — é um catálogo estático conhecido em build-time (7×3 combinações fixas) |
| Existem invariantes próprias? | Não — a única regra real (disponibilidade por produto) já pertence a `representatives` (§2.6), não é nova |
| Regras de negócio independentes? | Não — o "cálculo" inteiro é montar um objeto de props a partir de dados que já existem |
| Persistência? | Não, no MVP — nada é gravado no banco por esta feature |
| Lifecycle/estado próprio? | Não — a peça é sempre re-derivada dos dados atuais do representante, nunca "nasce" ou "expira" |
| Infraestrutura específica (renderer/exporter)? | **Só condicionalmente** — depende inteiramente de D1. Se D1 escolher A1/A2 (server-side), existe um adapter real. Se B1 (client-side puro), pode não haver `infrastructure/` nenhuma |

**Conclusão: não se justifica espelhar a estrutura completa
`domain/application/infrastructure/presentation` que módulos com regra de
negócio real (billing, leads) usam.** Recomendação de estrutura mínima,
para aprovação — não implementada nesta tarefa:

```text
src/modules/materials/
├── registry.ts              # catálogo 7×3 portado de shared/registry.tsx — tipos MaterialFormat/MaterialSlot
├── material-props.ts        # função pura: (Representative, RepresentativeProduct, qrCodeDataUrl) → MarketingMaterialProps
└── presentation/
    ├── materials-page.tsx   # Server Component — resolve catálogo+disponibilidade (§2.6), monta props
    ├── material-preview.tsx # 'use client' — preview e ação de baixar
    └── <produto>/
        ├── <produto>-post.tsx / .module.css
        ├── <produto>-story.tsx / .module.css
        └── <produto>-poster.tsx / .module.css

# infrastructure/ só nasce se D1 exigir um adapter real (ex.: chamada a um
# renderer server-side) — não criar a pasta vazia adiantado.
```

`generateQrCodeDataUrl` (§2.4) fica em `src/shared/lib/`, não dentro de
`materials/` — não é exclusivo desta feature.

## D5 — Referências penduradas — `[DECIDIDO]`

Investiguei a origem: não há evidência de que *"ENGINEERING_GUIDELINES §
materiais de marketing"* e *"§ 17"* tenham existido em algum momento neste
repositório — busca em `ENGINEERING_GUIDELINES.md` não encontra nem o
conteúdo nem numeração de seção compatível. São, com evidência disponível,
comentários herdados do processo de prototipagem que gerou a biblioteca, não
uma regra real do SETNAR sendo referenciada corretamente.

**Decisão: remover/corrigir esses comentários durante o porte, não criar
documentação nova só para validá-los.** Se, durante a POC (D1), surgir uma
regra de engenharia genuinamente nova e reutilizável (ex.: "como este
projeto lida com fontes self-hospedadas para conteúdo gerado"), **essa é
uma decisão separada**, tomada por mérito próprio quando D1 fechar — não
uma justificativa retroativa para o comentário atual.

## D6 — Experiência mínima do usuário — `[DECIDIDO — contrato funcional congelado]`

Novo, incorporado nesta revisão. Contrato funcional mínimo, não uma
especificação visual:

```text
/app/paginas/marketing
    → identificar produtos/páginas disponíveis para o representante (§2.6)
    → mostrar somente materiais correspondentes
    → cada produto disponível expõe Post, Story/Status e Poster
    → preview já personalizado com os dados reais do representante
    → Baixar
```

**Regra dura: o representante nunca digita ou edita manualmente nome,
telefone, URL ou QR Code para baixar um material.** Todos os dados vêm da
fonte de verdade já mapeada em §2.5 — abrir, ver os materiais já
personalizados, baixar.

**Explicitamente não decidido por D6** (fica para a implementação, não é um
bloqueador de arquitetura): cards vs. tabs vs. modal vs. carousel vs. grid,
animações, microinterações, layout definitivo. D6 congela o contrato de
dados e o fluxo funcional, não a UI final.

**Nota de compatibilidade futura, não uma decisão:** como `publicUrl` já
vem de `buildCommercialPageUrl()` centralizado (§2.5), nada nesta arquitetura
impede que uma futura necessidade de atribuição por peça (ex.: distinguir
cliques vindos de um Story vs. um Post) entre como um parâmetro adicional
depois — não é um requisito do Stage 1 (D0 exclui campanhas/smart links
explicitamente), só um cuidado para não fechar essa porta sem necessidade.

---

# 4. POC recomendada — Conexão Green (Post + Story + Poster)

D1 não deve ser fechado sem evidência. Recomendação: implementar a POC
testando **pelo menos duas abordagens contrastantes** de D1 (ex.: uma
server-side — A1 ou A2 — e uma client-side — B1) sobre o mesmo trio Conexão
Green, para gerar comparação real em vez de validar uma escolha única.

A POC deve responder, por abordagem testada:

- **Fidelidade visual**: dimensões, tipografia, backgrounds, gradients,
  borders, QR Code, ícones, CSS Modules, alinhamentos, line-height e
  composição batem com o original?
- **Resolução real**: o arquivo exportado sai em 1080×1080 / 1080×1920 /
  794×1123 de fato, não aproximado?
- **Fontes**: carregam antes da captura/renderização, sem fallback visível?
- **QR Code**: continua legível (escaneável de verdade, não só visualmente
  presente) depois da exportação?
- **Dados reais**: nome e telefone longos não quebram o layout?
- **Campos ausentes**: a peça continua válida sem telefone/cidade?
- **Performance**: quanto tempo leva para gerar uma peça, ponta a ponta?
- **Bundle/runtime**: qual o impacto real medido (não estimado) de cada
  abordagem?
- **Compatibilidade Next.js/Vercel**: a abordagem funciona na infra real do
  projeto, não só localmente?
- **Mobile**: o representante consegue iniciar o download pelo celular,
  nas duas abordagens testadas?

A POC deve produzir uma tabela de evidência comparando as abordagens
testadas contra esses critérios — não a alegação de que "funcionou na
máquina do desenvolvedor".

---

# 5. Sequenciamento proposto

```text
1. Fechar revisão deste plano (esta tarefa)
2. D0 já registrado (§0) — sem novo passo necessário
3. Executar a POC (§4) com Conexão Green, ≥2 abordagens de D1
4. Coletar evidência de D1/D2 a partir da POC
5. Fechar arquitetura mínima (D4, validada/ajustada pela POC)
6. Registrar ADR(s) realmente necessários — só o que a POC decidir, não um
   ADR por decisão
7. Portar as outras 6 verticais
8. Implementar a experiência mínima de D6 (`/app/paginas/marketing` ou rota
   equivalente)
9. QA das 21 peças
10. Revisão de compliance final (§ abaixo)
11. Release
```

---

# 6. Fora de escopo (desta rodada — não necessariamente para sempre)

- Layout visual final de D6 (cards/tabs/modal/carousel/grid, animações) —
  decisão de implementação, não de arquitetura.
- Toda a lista de "não autorizado" de D0 — campanhas, editor visual, IA
  generativa, upload, marketplace, analytics avançado, etc.
- Revisão de compliance do conteúdo das 21 peças (headlines, percentuais de
  desconto, claims comerciais, uso de marca) — **continua uma dependência
  registrada antes de considerar os materiais aptos para produção**, mesma
  categoria de cuidado já aplicada às Commercial Pages
  (`PRODUCT.md` § *Relationship with iGreen*). Nenhuma copy foi alterada
  nesta tarefa.
- Atualização de `PRODUCT.md`/`ROADMAP.md` refletindo D0 — necessária
  quando a primeira peça for implementada (ver §0), não nesta tarefa.
- Extração de `generateQrCodeDataUrl` (§2.4) — recomendação registrada, não
  executada.
- Mover, editar ou portar qualquer arquivo de `templates/marketing-materials/`.
- Instalar qualquer dependência, criar migration, alterar schema, commitar
  ou dar push.

---

# 7. Critérios de não-overengineering para a implementação futura

Registrados aqui para orientar quem implementar, não para decidir nada
agora:

- Não criar banco de dados para os materiais — são catálogo estático.
- Não criar CMS.
- Não criar entidade persistida sem necessidade real.
- Não criar API interna se um import/serviço local resolver com segurança.
- Não duplicar dados de `Representative` — sempre ler da fonte (§2.5).
- Não criar upload de avatar (D3 já fecha isso).
- Não criar editor de materiais.
- Não implementar analytics avançado da biblioteca.
- Não criar pipeline distribuído de renderização sem evidência de
  necessidade (a POC é essa evidência).
- Não substituir os componentes existentes só por preferência estética —
  o objetivo é distribuir os 21 designs já validados, não redesenhá-los.
- Não transformar os 21 templates estáticos num motor de templates genérico
  sem necessidade concreta.
