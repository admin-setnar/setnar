### ADR-091 — Card de página publicada: QR Code sob demanda, URL única, "Despublicar" atrás de confirmação (SET-91)

**Status:** Accepted
**Date:** 2026-08-18
**Related:** Estende `ProductActivationCard`/`RepresentativeHub` (D5.2/D5.3);
reusa `generateQrCodeDataUrl` e a infraestrutura de QR Code do ADR-049
inalteradas; reusa o padrão de confirmação destrutiva de
`CancelSubscriptionPanel` (SET-32); ajusta a regra "Ver prévia" do ADR-080
para o estado `published`.

#### Contexto e problema

O card de uma ativação `published` acumulou, ao longo de vários SETs, mais
informação do que uma tela mobile-first suporta bem: nome, badge, métricas,
"Página no ar: `<url>`", um QR Code sempre renderizado (ADR-049), e — dentro
do próprio `QrCodeCard` — "Baixar", "Copiar link" e um campo "Link público"
repetindo a mesma URL pela terceira vez na tela. Nenhuma peça individual
estava errada; a soma virou ruído, com o problema mais visível em viewports
estreitos (320–430px), onde é o cenário de uso majoritário do SETNAR.

#### Decisão

**QR Code deixa de ser permanente.** `QrCodeCard` vira `QrCodeDialog`
(mesmo arquivo renomeado, mesma lib `qrcode`/`generateQrCodeDataUrl`,
mesmo truque de `data:` URI servindo de `src` e de `href` de download) —
agora um `Modal` (Radix Dialog, já a única abstração de diálogo do projeto)
aberto por um botão "Gerar QR Code". A geração passa a ser preguiçosa (só
roda quando o dialog abre), não mais uma chamada a `toDataURL` disparada
para toda ativação publicada renderizada na tela.

**Três ações de compartilhamento, um componente novo.**
`PublishedPageActions` (`modules/representatives/presentation/`) agrupa
"Copiar link", "Abrir site" e "Gerar QR Code" — um `<div>` que empilha em
coluna até `sm` e vira linha a partir daí, mesmo padrão `fullWidth` +
`className="sm:w-auto"` que `LeadInbox` já usa para o mesmo motivo (ação
confortável de tocar em mobile, compacta em desktop). "Abrir site" é um
`<a target="_blank" rel="noopener noreferrer">` apontando para a mesma
`pageUrl` que os outros dois controles usam — nunca uma URL derivada
separadamente.

**URL pública aparece uma única vez**, como legenda truncada
(`truncate` + `title` para o valor completo no hover) logo abaixo do nome do
produto — não mais como texto solto ("Página no ar:") e de novo dentro de
um campo somente-leitura. `Copiar link`/`Abrir site`/o QR Code continuam
usando a URL completa (`https://…`); só a apresentação omite o protocolo.

**"Ver prévia" (ADR-080) some quando "Abrir site" já cobre o mesmo
propósito.** A regra: `showPreviewLink = state !== 'not_activated' &&
!(state === 'published' && viewState.isPubliclyAvailable)`. Ou seja, o
preview privado continua a única forma de conferir a página para
`draft`/`unpublished`, e também para `published` bloqueado por perfil/
assinatura (onde não existe página pública de verdade para abrir) — a
diferença arquitetural que já motivou o ADR-080 (preview roda com o
formulário de lead desabilitado, fora do domínio do representante) não
mudou; só o estado onde as duas ações coexistiam sem necessidade foi
fechado.

**"Despublicar" ganhou confirmação e perdeu destaque visual.** Antes:
`variant="secondary"` sem diálogo, um clique único e imediato. Agora: o
mesmo botão `secondary`, com `className` sobrepondo cor para `text-danger`/
`border-danger` (nunca preenchimento sólido — ficaria competindo com as
três ações de compartilhamento acima dele), abre um `Modal` cujo rodapé
segue exatamente a forma de `CancelSubscriptionPanel`: "Cancelar"
(`secondary`) e "Despublicar página" (`danger`, sólido — dentro do diálogo a
intenção destrutiva já está contextualizada). `pending`/`failure` continuam
os mesmos estados que já serviam "Ativar"/"Publicar" nesta mesma
`ProductActivationCard`; a única adição foi fechar o diálogo só quando
`setActivationStatusAction` de fato confirma sucesso, nunca antes.

**Nenhuma variante de `Button` nova.** `docs/DESIGN_SYSTEM.md` é explícito
— "never create unnecessary button variants" — e o resultado buscado (borda/
texto vermelho, fundo neutro) já é alcançável compondo `variant="secondary"`
com `className`, o mesmo padrão que `LeadInbox`/outros consumidores já usam
para ajustes pontuais sem tocar em `buttonVariants`.

#### Alternativas consideradas

1. **Nova variante `Button` `danger-outline`.** Rejeitada pelo próprio texto
   do Design System citado acima — uma composição via `className` (resolvida
   corretamente por `cn()`/`tailwind-merge`, que já garante a classe do
   consumidor vencer) entrega o mesmo resultado sem crescer a superfície do
   componente compartilhado.
2. **Continuar gerando o QR Code eagerly, só escondendo visualmente atrás
   de um accordion.** Rejeitada: ainda dispara `toDataURL` para cada
   ativação publicada renderizada, o custo que motivou remover o QR
   permanente já não desaparece; um `Modal` sob demanda é mais barato e mais
   alinhado ao "modais usados com moderação" do próprio Design System.
3. **Manter "Ver prévia" e "Abrir site" juntos em `published`.** Rejeitada
   — para um representante cuja página já está no ar, as duas ações
   resolvem exatamente a mesma pergunta ("como minha página aparece?"),
   e a real (`Abrir site`) é estritamente mais fiel que o preview
   (formulário de lead desabilitado, ADR-080) para esse caso específico.

#### Consequências

- `QrCodeCard`/`qr-code-card.tsx` deixam de existir; `QrCodeDialog`/
  `qr-code-dialog.tsx` é o único consumidor de `generateQrCodeDataUrl` na UI
  do hub (o outro consumidor, `marketing-materials`, é independente e não
  muda).
- `RepresentativeHub` para de computar `viewState`/`isPubliclyAvailable`
  para decidir o que renderizar abaixo do card — essa decisão migrou
  inteira para dentro de `ProductActivationCard`, que já recebia os mesmos
  três insumos (`state`, `subscriptionActive`, `profileComplete`).
  `RepresentativeHub` agora só computa e repassa `pageUrl`/`qrFileName`.
- `tests/authenticated-app-consolidation.test.ts` e
  `tests/e2e/critical-path.spec.ts` foram atualizados para o novo arquivo/
  nova UI observável; um novo spec dedicado,
  `tests/e2e/publication-management.spec.ts`, cobre o fluxo introduzido
  aqui (QR sob demanda, cópia com fallback, "Abrir site", confirmar/
  cancelar despublicação) na mesma suíte Desktop Chrome.

#### Rollback conceitual

Nenhuma migration, nenhuma mudança de schema ou de regra de publicação —
puramente apresentação sobre dados já existentes. Reverter é trocar os três
arquivos de componente de volta (`qr-code-dialog.tsx` → `qr-code-card.tsx`,
remover `published-page-actions.tsx`, desfazer o `Modal` de confirmação em
`ProductActivationCard`) e restaurar as três linhas de `RepresentativeHub`
que compunham "Página no ar:" + `QrCodeCard` inline.
