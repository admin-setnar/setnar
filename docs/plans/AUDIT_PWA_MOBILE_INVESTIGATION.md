Status: Proposta — investigação concluída, aguardando decisão do Product Owner (nenhuma implementação foi feita)
Authority: Non-normative (auditoria/investigação da SET-110; não altera nenhuma decisão de produto por si só)
Code baseline: branch `develop` @ `ad783b2` (2026-08-31)
Last reviewed: 2026-09-01 (correção documental — exemplos de URL atualizados para o formato de dois labels; nenhuma alteração de veredito ou de código)
Related: SET-110 (Linear, investigativa/read-only); referencia achados já confirmados por AUDIT_SET-87_PRODUCT_MD_RECONCILIATION.md e MVP_E2E_PRODUCT_AUDIT.md; cruza com SET-9, SET-99, SET-69, SET-102 (mobile) e ADR-001, ADR-026, ADR-092 (tenancy/subdomínio; ADR-092 estende ADR-026 para o endereço público de dois labels, `<representative>.<company>.setnar.com`, SET-83, 2026-08-19)
Superseded by: n/a

# SET-110 — PWA para uso mobile: viabilidade e valor

**Pergunta**: instalabilidade via PWA agregaria valor real para algum uso mobile do SETNAR hoje — app autenticado do representante, Commercial Page pública, ou nenhum dos dois —, com que escopo mínimo e a que custo/risco?

**Método**: confirmação direta no código da ausência de PWA (`Glob`/`Grep` por `manifest.json`, service worker, `next-pwa`/`workbox` em `package.json`); leitura de `docs/PRODUCT_CONSTITUTION.md`, `docs/DESIGN_SYSTEM.md`, `docs/DOMAIN_MODEL.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md` (seções mobile/tenancy); leitura de `ADR-001` (tenant por Host), `ADR-026` e `ADR-092` (subdomínio por representante, estendido para incluir a Company que o autoriza: `<representative>.<company>.setnar.com`) e `ADR-071` (metadata dinâmica por Commercial Page, convenção de arquivo do Next); leitura de `src/app/layout.tsx`, `src/config/seo.ts`, `src/middleware.ts`, `src/app/app/app-navigation.tsx`; leitura das cinco issues mobile já fechadas no Linear (SET-9, SET-99, SET-69, SET-70, SET-102) como única fonte de dor mobile real e verificada, em vez de inferência. Nenhuma alteração de código foi feita.

---

## Veredito

PWA **não existe hoje** no SETNAR — confirmado pela terceira vez (as duas primeiras foram AUDIT_SET-87 e MVP_E2E_PRODUCT_AUDIT), sem `manifest.json`, service worker ou dependência `next-pwa`/`workbox`. Nenhum ADR ou documento normativo já decidiu a favor ou contra.

A investigação não encontrou evidência de que instalabilidade resolveria alguma dor mobile real já registrada: os cinco defeitos mobile confirmados no Linear (SET-9, SET-69, SET-70, SET-99, SET-102) são todos bugs de CSS responsivo/viewport — nenhum é sobre reabrir o app, funcionar offline, ou fricção de "estar no navegador". PWA não teria prevenido nem corrigido nenhum deles.

Ainda assim, existe um caso plausível e tecnicamente barato para a superfície autenticada (`/app`, uso recorrente do representante): a navegação mobile já imita um padrão de app nativo (tab bar inferior com 4 destinos, ícones + labels, `min-h-11`), e o app vive inteiramente sob o domínio raiz — não há complicação de manifest por subdomínio de representante (ver Pergunta 3). Não existe o mesmo caso para a Commercial Page pública, e há um risco de identidade real em oferecê-lo lá (ver Pergunta 1).

**Recomendação consolidada: `DEFER`.** Custo técnico baixo se um dia for decidido, mas não há sinal de demanda real (nenhum representante pediu, nenhum achado de UX aponta para isso) — implementar agora seria construir sobre suposição, o que a própria `PRODUCT_CONSTITUTION.md` (§6, "uma relação comprovada vale mais que muitas presumidas") desaconselha. Ver escopo mínimo pronto em "Recomendação consolidada" caso o PO decida seguir.

---

## Pergunta 1 — Superfície-alvo

**Evidência**: `ADR-026` decide que cada Commercial Page vive em subdomínio próprio do representante, *não* no domínio raiz — precisamente para que a página "carregue a identidade do representante", nunca a da SETNAR (razão de peso 2 do próprio ADR: "credibilidade... representantes que vendem em nome próprio, não da SETNAR"). `ADR-092` (SET-83, 2026-08-19) estendeu esse endereço para incluir também a Company que autoriza o representante — formato atual, único suportado, sem forma de um label: `<representative-slug>.<company-slug>.setnar.com/<product-slug>` (ex.: `pedro-policeno.igreen.setnar.com/conexao-green`). `PRODUCT_CONSTITUTION.md` reforça o mesmo princípio (§ Visão: "carrega a identidade [do representante]... reflete o que ele está de fato autorizado a representar").

O app autenticado (`/app`), por sua vez, é acessado pelo próprio representante, várias vezes ao longo de sua operação (publicar página, ver contatos, baixar materiais) — e já expõe, em `src/app/app/app-navigation.tsx`, uma tab bar mobile de 4 destinos com ícones e `min-h-11` de touch target, o mesmo padrão visual que um app instalado usaria.

**Análise**: oferecer "instalar app" numa Commercial Page pública colide com o próprio motivo do ADR-026 existir — o visitante está numa página que existe para parecer o site profissional do representante, não um produto SETNAR; um prompt de instalação da SETNAR ali quebra essa identidade e pode gerar confusão sobre quem está "por trás" da página (justamente o tipo de ambiguidade que `PRODUCT_CONSTITUTION.md` trata como risco de confiança, não como detalhe cosmético). Não há, além disso, razão de uso recorrente do lado do visitante: o fluxo típico é escanear QR Code → ver página → WhatsApp/formulário, uma visita, não um hábito.

Para o app autenticado, o caso é o oposto: uso recorrente, mesma identidade (SETNAR, não do representante) o tempo todo, e uma navegação que já parece um app.

**Dependências**: nenhuma além do que já existe (`app-navigation.tsx`, `app/layout.tsx`).

**Risco**: instalar na Commercial Page arrisca a confiança/identidade que ADR-026 e a Constitution protegem explicitamente.

**Conclusão**: `/app` (autenticado) é a única superfície defensável. Commercial Page pública: `REJECT`.

---

## Pergunta 2 — Valor de negócio

**Evidência**: os cinco achados mobile confirmados no Linear —
- SET-9 (smoke test mobile do MVP) e SET-102 (revalidação em viewport real) — testes/investigação, sem correção própria;
- SET-99 — overflow de CTA/badge na landing, truncamento de labels na tab bar do `/app`, texto sem `break-words` na Divulgação;
- SET-69 — zoom automático no iOS Safari por `input` com `text-[15px]` (< 16px);
- SET-70 — QR Code com tamanho fixo (120×120px) apesar de `DESIGN_SYSTEM.md` alegar "responsive sizing".

Todos são bugs de layout/CSS responsivo. Nenhum é sobre reabrir o app com mais fricção do que deveria, perder contexto ao trocar de aba, ou precisar de conectividade intermitente.

**Análise**: a hipótese de valor de uma PWA aqui é indireta — ícone na tela inicial reduz a fricção de reabrir o `/app` (vs. digitar a URL ou achar um favorito no navegador), e o modo `standalone` remove a barra de endereço, reforçando a percepção de "ferramenta profissional" que `PRODUCT_CONSTITUTION.md` associa à proposta de valor do produto. É uma hipótese plausível, mas **não validada**: não há pedido de representante, entrevista, ticket de suporte ou métrica de reengajamento no repositório que a sustente. Suporte offline de dados dinâmicos (contatos, status de publicação, preços) é uma categoria de valor diferente e mais cara — e mais arriscada, porque cache desatualizado de preço/disponibilidade de Produto contradiz a necessidade de a Commercial Page e os dados do representante estarem sempre corretos (mesmo risco que `SET-70`/`DESIGN_SYSTEM.md` já mostrou acontecer quando documentação e comportamento divergem).

**Dependências**: nenhuma medição de uso real existe hoje (não há analytics de sessão/retenção do app autenticado além de visita/lead da Commercial Page — `ADR-050`/`ADR-082` cobrem tráfego público, não uso do `/app`).

**Risco**: construir por suposição de valor, sem sinal do usuário real — exatamente o padrão que `PRODUCT_CONSTITUTION.md` (§6) pede para evitar.

**Conclusão**: instalabilidade pura (ícone + `standalone`, sem cache offline de dados) — `NEEDS_PRODUCT_DECISION`, condicionado a algum sinal de demanda real antes de priorizar. Offline de dados dinâmicos — `REJECT` para este produto, dado o custo de estar desatualizado.

---

## Pergunta 3 — Custo e risco técnico

**Evidência**: `src/app/layout.tsx` já resolve `viewport.themeColor` (claro/escuro) e usa `generateMetadata` para montar metadata por tenant via `buildTenantMetadata` (`src/config/seo.ts`). `ADR-071` mostra que o Next.js já suporta, e o projeto já usa, convenções de arquivo por segmento de rota (`opengraph-image.tsx`) para gerar conteúdo dinâmico por Commercial Page — mas a convenção equivalente de manifest (`app/manifest.ts`) do Next.js é documentada como raiz única do app, não por segmento; não há um padrão pronto para "um manifest por rota" no framework hoje.

`src/middleware.ts` não restringe `/app` por host — a distinção de tenant/representante acontece dentro das páginas (`resolveTenant`/`resolveRepresentativeActivation`), não no roteamento. Na prática, hoje só existe um tenant de Company (`setnar.tenant.ts`, single-tenant em memória) — multi-organização/white label é Stage 5 (`PRODUCT_CONSTITUTION.md` linha 585) e não existe.

**Análise**: como consequência, o app autenticado é, na prática, um único destino lógico (o domínio raiz da SETNAR) — não há hoje um manifest por representante para resolver, porque representantes não acessam `/app` pelo próprio subdomínio. Isso não foi uma decisão de arquitetura deliberada para PWA — é um efeito colateral de como o roteamento já funciona — e deve ser confirmado por um spike técnico antes de qualquer implementação, não assumido como garantia permanente (Stage 5/white label poderia mudar esse quadro no futuro, mas está fora do horizonte atual).

Escopo mínimo tecnicamente viável, caso decidido:
- `app/manifest.ts` (convenção nativa do Next.js) com `scope`/`start_url` limitados a `/app`, `display: 'standalone'`, `theme_color` reaproveitando os valores já existentes em `viewport.themeColor`, e um conjunto de ícones (hoje inexistente — precisa ser produzido).
- Ícones para iOS (`apple-touch-icon`) — iOS Safari não lê `manifest.json` para instalar; usa meta tags próprias, sem exigir service worker.
- Um service worker mínimo pode ser necessário para os critérios de instalabilidade do Chrome/Android (o critério exato varia por versão do Chrome e não foi validado nesta investigação — requer spike, não suposição).

**Dependências**: produção de ícones/assets (inexistentes hoje), validação em dispositivo real (mesma limitação que SET-9/SET-69 já registraram: emulação de viewport mobile não é confiável neste ambiente de automação).

**Risco**: baixo e reversível — é a mesma leitura do "Reversal cost: Low" de `ADR-001` para tenant do domínio raiz. Não introduz migration, não toca dado de negócio, não é per-representante.

**Conclusão**: custo técnico é baixo *desde que o escopo fique restrito a `/app` no domínio raiz*. Esta investigação não estimou o custo técnico de estender PWA à Commercial Page pública (`<representative>.<company>.setnar.com`, ADR-092) — não foi necessário: a rejeição dessa superfície já se sustenta inteiramente no risco de identidade (Pergunta 1, ADR-026/ADR-092) e na ausência de uso recorrente comprovado do lado do visitante (Pergunta 2), não em um custo técnico por subdomínio que este documento nunca chegou a medir.

---

## Pergunta 4 — Decisões anteriores

**Evidência**: nenhum ADR decide sobre PWA. `SET-9` lista "App mobile nativo" explicitamente como fora de escopo — mas PWA não é app nativo (nenhuma loja de aplicativos, nenhum código nativo), então essa exclusão não se aplica automaticamente aqui e não deve ser lida como uma rejeição implícita de PWA. `ROADMAP.md` não menciona PWA, app instalável, nem "mobile" como item de nenhum Stage — é uma lacuna, não uma decisão (nem a favor, nem contra).

**Análise**: não há contradição a resolver nem autorização a revogar. O tema simplesmente nunca foi decidido.

**Conclusão**: campo aberto — decisão cabe ao Product Owner, não a uma leitura de documentação existente.

---

## Recomendação consolidada

**Veredito por escopo:**

| Escopo | Recomendação |
|---|---|
| PWA instalável na Commercial Page pública (qualquer representante) | `REJECT` — colide com a identidade que ADR-026/ADR-092 protegem; sem uso recorrente que justifique |
| Offline de dados dinâmicos (contatos, preços, status) em qualquer superfície | `REJECT` — risco de desatualização inaceitável para este produto |
| PWA instalável (ícone + `standalone`, sem cache de dados) no `/app` autenticado | `NEEDS_PRODUCT_DECISION` — tecnicamente barato, mas sem sinal de demanda real hoje |

**Se o Product Owner decidir seguir**, o escopo mínimo defensável é:
1. `app/manifest.ts` com `scope`/`start_url` restritos a `/app`, reaproveitando `theme_color` de `src/app/layout.tsx`.
2. Ícones (novo asset, não existe hoje) + `apple-touch-icon` para iOS.
3. Spike técnico curto para confirmar critérios reais de instalabilidade do Chrome/Android antes de decidir se um service worker é necessário — não assumir o requisito sem checar a versão vigente da política do navegador.
4. Validação em dispositivo real (não emulação) antes de considerar concluído — mesma lição já registrada por SET-9/SET-69/SET-102.
5. Nenhum cache de dados dinâmicos (contatos, publicação, preço) — apenas o shell estático.

**Se o Product Owner decidir não seguir agora**, nenhuma ação é necessária: a ausência de PWA já está corretamente refletida em `PRODUCT.md` (What Exists Today) — nenhuma edição documental pendente.

---

## Critério de saída

Esta investigação termina aqui: é possível decidir com segurança que Commercial Page pública e offline de dados estão fora de escopo, e que o único caso plausível (`/app`, instalabilidade pura) depende de uma decisão de produto sobre prioridade, não de mais investigação técnica. Nenhuma implementação faz parte deste documento. Uma eventual issue de implementação deve nascer de decisão explícita do Product Owner sobre o escopo mínimo acima, não deste documento por si só.
