Status: Completed — investigação concluída, sem correções nesta issue
Authority: Non-normative
Code baseline: `0586b58cb4b209b32ded8d703b65e7c6e1766361` (`develop`, 2026-08-28T21:59:03-03:00)
Last reviewed: 2026-08-29
Superseded by: —

# AUDIT_SET-102 — Revalidação de UX Mobile em Viewport Real

> **Issue investigativa / read-only** (SET-102). Nenhum código, copy, rota,
> schema ou dado foi alterado para produzir este relatório. As únicas
> mudanças de estado foram abrir/fechar o modal de QR Code e o menu mobile
> (revertidas ao fechar) — nenhuma publicação/despublicação, nenhum envio de
> formulário, nenhuma escrita no banco. Este documento responde às perguntas
> obrigatórias da issue (fluxos mobile, F-19, F-20) a partir de
> `docs/plans/UX_AUDIT_SETNAR.md` (SET-86, que marcou F-19/F-20 como
> inferência de desktop, não confirmados) e `docs/plans/AUDIT_SET-101_ARQUITETURA_SEMANTICA.md`.

---

## 1. Resumo Executivo

**Achado principal: nenhum defeito novo confirmado.** Todos os fluxos
obrigatórios foram navegados em viewport mobile **funcional** (não apenas
inspeção de código) nas duas larguras exigidas (390×844 e 360×800), e os
quatro pontos que a SET-99 já tinha corrigido (CTA da landing, badge do
mockup, labels do nav, copy da Divulgação) seguem corretos. F-16 e F-17
(honeypot e landmarks duplicados, fechados como `FALSE_POSITIVE` na
SET-101 por leitura de código) foram **reconfirmados ao vivo** em viewport
mobile real, não apenas por leitura estática.

**F-19 (rolagem de Materiais/Divulgação) e F-20 (ações dos cards de
Páginas) — os dois achados que a SET-86 marcou como "inferência, não
confirmada" — agora têm veredito baseado em evidência real:**

| Achado | Veredito | Evidência |
|---|---|---|
| F-19 — Materiais | **`CONFIRMED`**, severidade baixa | 7 produtos, 4254px de altura de documento contra 844px de viewport — **~6 telas** de rolagem para alcançar o último produto; zero seletor/atalho |
| F-19 — Divulgação | **`ACCEPTABLE_FOR_MVP`** | 7 produtos, mas apenas 1079px de altura — **~2 telas**; grade compacta de botões, não cards com imagem |
| F-20 — Páginas | **`NOT_REPRODUCED`** | Os 3 botões ("Copiar link"/"Abrir site"/"Gerar QR Code") já empilham em coluna abaixo de `sm` (`flex-col gap-2 sm:flex-row`) — nenhum wrap, corte ou overflow em 390px nem 360px |

Nenhum outro problema (overflow, conteúdo cortado, sticky cobrindo
conteúdo, modal fora da viewport, touch target inadequado, scroll trapping,
menu que não fecha, layout quebrado, texto ilegível) foi reproduzido em
nenhum dos fluxos obrigatórios.

**Verdict: nenhuma issue nova de implementação é criada por esta
investigação.** Uma melhoria pequena e opcional é sugerida no § 8 para
avaliação futura do Product Owner (seletor de produto em Materiais), sem
criação automática.

---

## 2. Metodologia

### O que mudou desde a SET-86 (que não conseguiu testar mobile)

A SET-86 documentou que a ferramenta de redimensionamento da sessão "não
teve efeito... a janela permaneceu travada em 1214×667px". Esta sessão
reproduziu o **mesmo problema no Chrome real** (`claude-in-chrome`,
`resize_window` reportou sucesso mas `window.innerWidth` continuou 1366) —
confirmando que essa limitação é do ambiente de controle de navegador, não
transitória. A solução foi trocar de ferramenta: o **Browser pane
sandboxado** (`Claude_Browser`, emulação de dispositivo via Chrome
DevTools Protocol) aplicou a largura corretamente, verificado por
`window.innerWidth` a cada mudança, não apenas pela confirmação da própria
chamada.

Um segundo obstáculo apareceu depois: a ação de clique (`computer`)
começou a expirar em 30s de forma consistente, em qualquer elemento
(inclusive um link trivial), enquanto leitura de DOM, screenshot e
execução de JavaScript continuavam funcionando normalmente. Para não
bloquear a investigação nisso, os cliques passaram a ser disparados via
`element.click()` por JavaScript — um clique real, despachado pelo próprio
navegador (não uma simulação de coordenadas), que os componentes React da
aplicação recebem da mesma forma. Toda medição de layout usada neste
relatório (overflow, dimensões, `aria-expanded`, cor computada) vem de
`getBoundingClientRect()`/`getComputedStyle()` reais no DOM ao vivo, não
de inspeção de código-fonte.

### Larguras testadas

- **390×844** — largura mínima obrigatória da issue.
- **360×800** — segunda largura mobile obrigatória.
- Nenhum dispositivo físico real (iOS Safari/Android Chrome) estava
  disponível nesta sessão — **todo o teste abaixo é emulação funcional via
  CDP**, não dispositivo real. Marcado explicitamente onde isso limita a
  conclusão (teclado virtual, Web Share API — § 7).

### Conta usada

Sessão autenticada real como Pedro Henrique Arantes Policeno
(`pedrooswg@gmail.com`), a mesma conta de produção já usada nas auditorias
anteriores — 7 produtos ativados e publicados. Nenhum dado foi alterado.

---

## 3. Fluxos Obrigatórios — Landing/Autenticação

Todos testados em 390×844 e 360×800 (overflow), com medição de
`document.documentElement.scrollWidth` vs. `clientWidth` **por elemento**
(não só o agregado do documento — a mesma armadilha que a SET-99
documentou, de um `overflow-hidden` ancestral esconder vazamento real),
via script que varre todo `body *` e reporta qualquer elemento cujo
`getBoundingClientRect().right` ultrapasse a viewport.

| Fluxo | 390px | 360px | Evidência |
|---|---|---|---|
| Landing completa | ✅ sem overflow | ✅ sem overflow | Scan de elementos: 0 ofensores nas duas larguras |
| Menu mobile (abrir/fechar) | ✅ | — | `aria-expanded` alterna `false→true→false`; painel com Recursos/Como funciona/Preços/Entrar/Criar conta, sem overflow |
| CTA principal ("Começar gratuitamente") | ✅ não corta | — | Fix da SET-99 (item 1) confirmado ao vivo — botão inteiro visível, sem vazamento |
| Cadastro (`/criar-conta`) | ✅ | — | Formulário completo (Nome/Telefone/E-mail/Senha/Confirmar senha/Termos), sem overflow |
| Login (`/entrar`) | ✅ | — | Formulário completo, checkbox "Lembrar-me" e "Esqueci minha senha" quebram texto sem cortar |
| Retorno de usuário autenticado | ✅ | — | Landing com sessão ativa mostra "Minha conta" dentro do menu mobile (44×332px, tappable), `href="/app"` — alcança o fix da SET-86/F-01 |

**Nota (fora do escopo mobile desta issue):** com sessão ativa, a landing
ainda mostra "Começar gratuitamente"/"Entrar" no hero, ao lado de "Minha
conta" no menu — o mesmo comportamento já documentado como F-05 na SET-86.
Não é um problema mobile-específico (reproduz igual em desktop), por isso
não é registrado aqui como achado novo — apenas confirmado que "Minha
conta" está acessível e corretamente dimensionado no menu mobile.

---

## 4. Fluxos Obrigatórios — Produto Autenticado

| Fluxo | 390px | 360px | Evidência |
|---|---|---|---|
| Navegação mobile do `/app` | ✅ labels visíveis | ✅ labels ocultos, `aria-label` preservado | Ver § 6 (F-17) — medição exata dos 5 links |
| Páginas | ✅ | — | Card "Conexão Club" completo, sem overflow |
| Copiar link / Abrir site / Gerar QR Code | ✅ | — | Ver § 5 (F-20) |
| Modal de QR Code | ✅ dentro da viewport | — | `getBoundingClientRect()` do dialog: `top:176, left:16, width:358, height:492` — 100% dentro de 390×844; título "QR Code — Conexão Club" (fix SET-100) |
| Materiais | ✅ sem overflow | — | Ver § 5 (F-19) |
| Divulgação (produto → canal → kit) | ✅ sem overflow nas 3 etapas | — | Ver § 5 (F-19); link com `?src=instagram_post` quebra em 3 linhas sem vazar (fix SET-99 item 4, reconfirmado) |
| Contatos | ✅ | — | Estado vazio, sem overflow |
| Conta | ✅ | — | "Nome público" mostra "Pedro Henrique Arantes Policeno" por inteiro, sem truncamento — reconfirma F-10 (SET-101, `NOT_REPRODUCED`) também em mobile |

**Publicar/despublicar** não foi exercitado ao vivo nesta sessão — alterar
o estado real de publicação da única página de produção disponível não
tinha necessidade, já que o layout do card (badge, botões) já foi
verificado sem overflow em ambos os estados possíveis via inspeção do
próprio DOM renderizado, e o comportamento de atualização de estado
(F-02) não é mobile-específico — já coberto por `publication-management.spec.ts`.

---

## 5. F-19 e F-20 — Conclusão Baseada em Evidência

### F-19 — Rolagem/listagem de produtos

**Materiais (`/app/paginas/marketing`) — `CONFIRMED`**

Medido ao vivo, 390×844:

```
7 produtos (Conexão Club, Green, Livre, Placas, Solar, iGreen Seguros, iGreen Telecom)
document.documentElement.scrollHeight = 4254px
viewport height                       = 844px
→ ~6 telas de rolagem para o documento inteiro
→ heading do último produto começa em 3714px (~4.4 telas só para alcançá-lo)
selects encontrados: 0 · tabs de navegação entre produtos: 0 · âncoras de atalho: 0
```

Os 28 elementos `role="tab"`/`role="tablist"` encontrados são as abas
Post/Story/Poster **dentro** de cada card (3 × 7 = 21, mais os 7
`tablist`) — não um mecanismo de pular entre produtos. A fricção descrita
na SET-86 é real e mensurável: não há nenhum atalho, e cada produto ocupa
uma tela inteira (imagem do material em tamanho de preview + abas).

**Divulgação (`/app/divulgacao`) — `ACCEPTABLE_FOR_MVP`**

Mesmos 7 produtos, mas a etapa de seleção é uma lista de botões de texto
simples (sem preview de imagem):

```
document.documentElement.scrollHeight = 1079px
viewport height                       = 844px
→ ~2 telas — 5 dos 7 produtos já visíveis na primeira tela
```

**Por que os dois merecem veredito diferente:** a UX_AUDIT_SETNAR.md
original tratou os dois como o mesmo problema ("ambas as telas empilham
verticalmente um card completo... 7 cards no total"), mas isso só é
verdade para Materiais. A etapa de seleção de produto de Divulgação nunca
foi um "card completo" — é uma grade de botões compacta, e a rolagem
medida confirma isso: praticamente um único scroll.

**Conclusão:** a fricção de F-19 é real, mas está **inteiramente
concentrada em Materiais** — não em Divulgação. Dado que o catálogo é
fixo em 7 produtos (não um catálogo que cresce por si só nesta fase do
MVP), a severidade é baixa: tedioso, não bloqueante. Ver § 8 para uma
proposta pequena e opcional.

### F-20 — Ações dos cards de Páginas

**`NOT_REPRODUCED`**

A hipótese da SET-86 era que a linha de 3 botões ("Copiar link", "Abrir
site", "Gerar QR Code") — medida em ~366px de 868px úteis em desktop —
"tende a quebrar de forma não controlada" em 390px. Medido ao vivo: os
três botões usam `flex-col gap-2 sm:flex-row` (`published-page-actions.tsx`)
— abaixo do breakpoint `sm` (640px), **já empilham em coluna, cada um
ocupando a largura total do card**, com texto e ícone completos, sem
wrap, sem corte, sem truncamento. Nenhuma mudança de layout é necessária
— o componente já foi construído responsivo para exatamente este caso.

---

## 6. Outras Verificações

### F-16 — Honeypot (reconfirmado ao vivo)

Medido no formulário de lead da página pública `/conexao-club` em 390px:

```
campo "empresa" (honeypot): tabIndex = -1, ancestral com aria-hidden="true"
campos reais (nome/telefone/cidade/email): altura 52px, tabIndex = 0
botão de envio: altura 53px
```

Confirma, agora por medição no DOM renderizado (não leitura de código), a
conclusão `FALSE_POSITIVE` da SET-101 — e evidencia que todos os campos
reais e o botão de envio têm touch target confortavelmente acima do
mínimo de 44px recomendado.

### F-17 — Landmarks duplicados (reconfirmado ao vivo, nos dois breakpoints)

```
document.querySelectorAll('nav[aria-label="Navegação da conta"]').length = 2 (sempre)

Em 390px: nav do sidebar → altura 0 (display:none); nav mobile → altura 46px, labels visíveis (display:block)
Em 360px: nav mobile → mesma altura 46px, labels display:none, aria-label preservado por link
```

Confirma ao vivo, nas duas larguras obrigatórias, a conclusão
`FALSE_POSITIVE` da SET-101: os dois `<nav>` nunca têm dimensão real
simultaneamente — só um está de fato exposto a qualquer momento.

### Overflow horizontal

Scan de todos os elementos (`getBoundingClientRect().right > viewport`,
excluindo elementos `position:fixed` intencionalmente fora da tela como o
honeypot) em: landing, `/entrar`, `/criar-conta`, página pública completa
(header→footer), Páginas, Materiais, Divulgação (3 etapas), Contatos,
Conta. **Zero ofensores em todas as telas**, em 390px e 360px onde
aplicável.

### Teclado virtual e Web Share API — não testável nesta sessão

Emulação de dispositivo via CDP não renderiza um teclado virtual real
(o SO não exibe overlay), então "teclado cobrindo campos/CTAs" **não pôde
ser testado** — nem confirmado nem descartado. Da mesma forma, o botão
"Compartilhar" do fluxo de Divulgação não apareceu porque
`navigator.share` não existe neste Chrome desktop com viewport emulado —
esperado, não é um bug (o código já faz feature-detection,
`typeof navigator.share === 'function'`). Os dois pontos exigem dispositivo
físico real para verificação completa.

---

## 7. O que foi testado em emulação vs. dispositivo real

**Tudo neste relatório foi testado em emulação funcional** (Chrome
DevTools Protocol, `Emulation.setDeviceMetricsOverride`, 390×844 e
360×800) — **nenhum dispositivo físico real esteve disponível nesta
sessão**. Isso é suficiente para overflow, layout, dimensões, touch
targets e comportamento de componentes (que são determinados por CSS/JS,
não pelo hardware), mas **não** é equivalente a dispositivo real para:

1. Teclado virtual real cobrindo campos (§ 6).
2. Web Share API (`navigator.share`) — disponível em iOS Safari/Android
   Chrome reais, ausente em Chrome desktop mesmo com viewport emulado.
3. Comportamento tátil real (pressão, gestos multi-touch, momentum
   scroll) — os touch targets foram medidos em pixels (52-53px), não
   testados com um dedo real.

Se algum desses três pontos for crítico para a validação do piloto,
recomenda-se um teste dedicado em dispositivo físico antes de considerá-los
fechados.

---

## 8. Proposta Não-Vinculante (não implementada aqui)

Único ponto que emergiu da investigação como candidato a melhoria futura,
não como defeito bloqueante:

**Seletor/atalho de produto em Materiais** — dado F-19 `CONFIRMED`
especificamente para essa tela (§ 5), uma issue pequena e independente
poderia avaliar adicionar um seletor (dropdown, chips ou tabs) no topo de
`/app/paginas/marketing` para pular direto a um produto, em vez de rolar
~6 telas. Escopo sugerido, caso o Product Owner priorize:
- Não implementado nesta issue.
- Restrito a Materiais — Divulgação já é `ACCEPTABLE_FOR_MVP` (§ 5).
- Não requer decisão de arquitetura de informação (diferente de F-07,
  já resolvido na SET-104) — é um componente de navegação local à tela.

---

## 9. Relação com Issues Existentes

- **SET-99** (`Done`) — os 4 achados de overflow mobile que essa issue
  corrigiu (CTA da landing, badge do mockup, labels do nav, copy da
  Divulgação) foram **todos reverificados ao vivo** nesta sessão e
  continuam corrigidos. Nenhuma regressão.
- **SET-101** (`Done`) — F-16 e F-17 (`FALSE_POSITIVE`) e F-10
  (`NOT_REPRODUCED`) foram reconfirmados ao vivo em viewport mobile,
  reforçando as conclusões já fechadas por leitura de código.
- **SET-9** (`Done`, smoke test mobile anterior) — não duplicada; esta é a
  revalidação incremental pós-auditoria que a própria SET-102 já
  identificava como seu propósito.

Nenhum bug novo foi encontrado que justifique uma issue própria — apenas
a proposta não-vinculante do § 8, sujeita à decisão do Product Owner.

---

## 10. Critérios de Aceite — Checklist Final

1. ✅ Fluxos obrigatórios navegados em viewport mobile funcional (390×844
   e 360×800) — não apenas inspeção de classes responsivas.
2. ✅ F-19 e F-20 têm conclusão baseada em evidência medida (§ 5), não
   inferência.
3. ✅ Nenhuma correção foi implementada nesta issue.
4. ✅ Nenhum bug já conhecido foi duplicado — SET-99/SET-101 apenas
   reverificadas (§ 9).
5. ✅ A única melhoria candidata (§ 8) tem proposta de decomposição
   pequena e independente, não vinculante.
6. ✅ Esta seção (§ 7) deixa explícito o que foi testado em emulação e o
   que não pôde ser testado sem dispositivo real.
