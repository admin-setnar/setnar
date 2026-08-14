### ADR-090 — Materiais de marketing exportam via captura client-side, não renderização server-side (SET-65)

**Status:** Accepted

**Date:** 2026-08-14

**Related:** Depende de ADR-026 (`buildCommercialPageUrl`), ADR-084 (disciplina de log, não aplicável a esta feature); qualifica `MARKETING_MATERIALS_PLAN.md` D1.

#### Contexto

`MARKETING_MATERIALS_PLAN.md` deixou D1 (pipeline de geração do arquivo
final para os 21 materiais de marketing) explicitamente em aberto, exigindo
evidência de uma POC antes de qualquer escolha. As 21 peças, portadas de
`templates/marketing-materials/`, usam CSS Modules com gradients,
`box-shadow`, múltiplos pseudo-elementos (`::before`/`::after`) e `filter:
drop-shadow(...)` — recursos que o modelo de layout do Satori
(`@vercel/og`/`next/og`) não suporta (pseudo-elementos não existem nesse
modelo; teriam que virar nós JSX explícitos em cada uma das 21 peças). Essa
opção (A1 no plano) foi descartada analiticamente, sem implementação, com
essa evidência — grep confirmou `::before`/`::after` presentes nas 21 folhas
de estilo.

Restavam duas famílias plausíveis: renderização server-side via browser
headless (A2 — Playwright, já devDependency do projeto, usado hoje só em
E2E) e captura client-side do DOM real (B1 — `html-to-image`).

#### POC executada

Uma POC comparou A2 e B1 sobre as três peças de Conexão Green (Post, Story,
Poster), incluindo um caso com dados completos e um caso extremo (nome
curto, telefone e cidade ausentes), via um script Playwright que:
navegava até uma rota temporária renderizando as peças reais; tirava um
screenshot nativo do Playwright do elemento (evidência de A2); chamava
`html-to-image` no próprio browser via `page.evaluate` (evidência de B1).

**Resultado, nas 6 combinações testadas:**

| Critério | A2 (Playwright screenshot) | B1 (html-to-image) |
|---|---|---|
| Dimensões exatas (1080×1080 / 1080×1920 / 794×1123) | 6/6 | 6/6 (só depois de passar `width`/`height` explícitos — auto-detecção capturou 1120px de largura em toda peça na primeira tentativa, independente da largura real; corrigido passando as dimensões do formato diretamente para `toPng`) |
| Fidelidade visual (gradients, box-shadow, pseudo-elementos, `filter`, fontes customizadas) | Idêntica ao original, por construção | Idêntica ao original, confirmada por inspeção visual direta dos PNGs exportados — nenhuma diferença encontrada |
| Performance | 102–244ms | 83–324ms — comparável, sem penalidade de UX |
| Tamanho de arquivo | 120–388KB | 228–842KB (~2× maior — diferença do encoder PNG do Canvas vs. o encoder nativo do Chromium, aceito para o MVP) |
| Viewport mobile (iPhone 13 emulado) | não se aplica | dimensões e tamanho idênticos ao teste desktop — a captura usa dimensões explícitas, não o viewport do dispositivo |
| Infraestrutura nova necessária | Sim — processo de browser headless em produção (custo de cold start, memória, tamanho de função, avaliado mas não implementado) | Nenhuma |

#### Decisão

Exportação via captura client-side com `html-to-image`, executada no
navegador do próprio representante (`MaterialPreview`,
`src/modules/marketing-materials/presentation/`). O nó capturado é uma
segunda cópia da peça, fora de tela, no tamanho real — não o nó dentro do
`ScaledFrame` usado para o preview em tela, para não depender de a captura
funcionar corretamente através de um ancestral com `transform: scale()`
(não exercitado pela POC). O arquivo final é entregue como download via
`Blob`/`URL.createObjectURL` (não a `data:` URI direta na âncora), decisão
tomada para reduzir o risco conhecido do Safari iOS de abrir uma `data:`
URI em nova aba em vez de baixar — comportamento não coberto pela POC
automatizada, mas validado manualmente em emulação mobile (Playwright,
`devices['iPhone 13']`) com sucesso.

#### Alternativas consideradas

1. **A1 — `@vercel/og`/Satori.** Descartada sem implementação: exigiria
   reescrever as 21 peças para o dialeto de layout do Satori (sem
   pseudo-elementos, CSS Modules não suportado), o oposto do objetivo de
   preservar os designs existentes verbatim.
2. **A2 — Browser headless server-side (Playwright).** Testada e funcional,
   fidelidade e performance equivalentes a B1. Não escolhida porque exige
   infraestrutura nova em produção (processo de browser, custo de
   cold start/memória/tamanho de função) sem ganho de fidelidade ou UX sobre
   B1 — viola o princípio de menor arquitetura que resolve o problema atual.
   Registrada como alternativa de fallback caso B1 revele um problema real
   em produção que a POC não capturou.
3. **B2 — SVG/Canvas nativo (recompor as peças como desenho vetorial).**
   Descartada sem implementação: descartaria a maior parte do reaproveitamento
   do CSS Modules já escrito, custo de engenharia desproporcional.
4. **C — Sem geração de arquivo (print-to-PDF manual).** Descartada como
   baseline, não como opção equivalente: não atende ao objetivo de produto
   (Preview → Baixar → arquivo pronto) para Post/Story pensados para redes
   sociais.
5. **B1 — Captura client-side com `html-to-image`.** Escolhida — evidência
   acima.

#### Consequências positivas

- Nenhuma infraestrutura de servidor nova — nenhum processo de browser
  headless, nenhuma rota de renderização dedicada, nenhum custo de
  cold start/memória em produção.
- Reaproveita os 21 componentes React/CSS Modules portados verbatim, sem
  nenhuma adaptação de layout para acomodar o pipeline.
- Fidelidade visual confirmada igual à renderização nativa do navegador,
  porque é exatamente isso que `html-to-image` captura.

#### Consequências negativas e riscos aceitos

- Arquivo exportado ~2× maior que o equivalente nativo do Chromium —
  aceito, ainda bem dentro de um tamanho razoável para download/redes
  sociais (menor que 1MB em todos os casos testados).
- Fidelidade depende do carregamento das fontes antes da captura
  (`document.fonts.ready`, já implementado em `MaterialPreview`) e do
  navegador do representante — diferente de A2, onde o ambiente de captura é
  controlado pelo servidor. Risco aceito: as 21 peças usam fontes
  self-hospedadas via `@fontsource` (não Google Fonts remoto), o que reduz
  a superfície de falha de carregamento de fonte a zero rede externa.
- O comportamento de download em iOS Safari foi validado manualmente em
  emulação, não em hardware real — dívida de QA registrada, não um risco
  desconhecido (mitigado pela decisão de usar `Blob`/`URL.createObjectURL`
  em vez de `data:` URI direta, especificamente por esse motivo).

#### Salvaguardas

- `MaterialPreview` nunca captura o nó visualmente escalado do preview —
  sempre uma cópia real-size dedicada, eliminando a variável não testada de
  captura através de `transform: scale()`.
- `width`/`height`/`canvasWidth`/`canvasHeight` são sempre passados
  explicitamente ao `toPng()`, nunca auto-detectados — a POC confirmou que a
  auto-detecção do `html-to-image` não é confiável neste layout.
- Estado de exportação (`loading`, erro, uma exportação por vez) é
  explícito na UI (`Button` com `loading`/`aria-busy`), evitando cliques
  concorrentes no mesmo botão.

#### Rollback conceitual

Trocar `toPng()` (client-side) por uma chamada a uma rota server-side que
renderiza a mesma peça via Playwright headless (A2, já testada e
funcional na POC) e retorna o PNG pronto — `MaterialPreview` isola essa
troca a uma única função, sem tocar no contrato dos 21 componentes
portados nem no registry. Não existe rollback de banco: esta decisão não
cria migration nem altera contrato persistido.
