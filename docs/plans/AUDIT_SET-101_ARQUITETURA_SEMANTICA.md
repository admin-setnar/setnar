Status: Completed — investigação concluída; decisões de Product Owner aprovadas
Authority: Non-normative
Code baseline: `ebd9d18955ff6fc011013c2a75148743e26d9b98` (`develop`, 2026-08-28T17:26:17-03:00)
Last reviewed: 2026-08-28
Superseded by: —

# AUDIT_SET-101 — Arquitetura de Informação e Semântica Pós-Auditoria de UX

> **Issue investigativa / read-only** (SET-101). Nenhum código, copy, rota,
> schema, evento de analytics ou dado foi alterado para produzir este
> relatório. As únicas leituras contra o banco real (`pedrooswg@gmail.com`,
> a própria conta do dono do produto) foram `SELECT`s de verificação para
> F-04 e F-10 — nenhum `INSERT`/`UPDATE`/`DELETE` foi executado. Este
> documento responde às sete perguntas obrigatórias da issue (F-04,
> F-07/RED-01, F-08/RED-02, F-09, F-10, F-16, F-17) a partir de
> `docs/plans/UX_AUDIT_SETNAR.md` (SET-86) e `docs/plans/MVP_E2E_PRODUCT_AUDIT.md`
> (SET-93).

---

## Product Owner Decision — 2026-08-28

Após a conclusão desta investigação, as decisões de produto foram revisadas
contra o baseline e aprovadas.

Decisões finais:

- F-07 / RED-01 → `DECIDED`
  - manter Materiais e Divulgação como superfícies independentes no MVP;
  - adotar a alternativa A: diferenciar semanticamente os dois JTBDs;
  - não implementar consolidação B ou C neste momento.

- F-08 / RED-02 → `DECIDED`
  - Páginas — Copiar link → `src=direct`;
  - Páginas — Gerar QR Code → `src=qrcode`;
  - Páginas — Abrir site → URL canônica, sem `src`;
  - Materiais — QR Code → `src=qrcode`;
  - Divulgação mantém sua taxonomia atual.

- F-08b → `EXPECTED_BEHAVIOR`
  - `direct` e `qrcode` representam mecanismos de distribuição diferentes;
  - a distinção é intencional e deve ser preservada.

- F-09 → `DECIDED`
  - Visita = acesso à página;
  - Clique no WhatsApp = intenção comercial;
  - Contato = submissão do formulário;
  - Lead permanece nomenclatura técnica/interna no MVP;
  - futuras correções ficam restritas às copies conflitantes identificadas.

- F-04 → `CLOSED / NOT_REPRODUCED`
- F-10 → `CLOSED / NOT_REPRODUCED`
- F-16 → `CLOSED / FALSE_POSITIVE`
- F-17 → `CLOSED / FALSE_POSITIVE`

Nenhuma implementação faz parte da SET-101.

As mudanças decorrentes serão tratadas em issues de implementação separadas:
[SET-103](https://linear.app/setnar/issue/SET-103) (F-09), [SET-104](https://linear.app/setnar/issue/SET-104)
(F-07), [SET-105](https://linear.app/setnar/issue/SET-105) (F-08).

---

## 1. Resumo Executivo

Das sete perguntas, **quatro (F-04, F-10, F-16, F-17) fecham como
`NOT_REPRODUCED`/`FALSE_POSITIVE`** com evidência de código e/ou banco de
dados que explica por que a observação original da SET-86 não se sustenta
contra o baseline atual — nenhuma delas exige mudança de produto. **Três
(F-07/RED-01, F-08/RED-02, F-09) são `CONFIRMED`** como fricções reais de
arquitetura de informação/semântica, e nenhuma delas deve ser corrigida sem
decisão explícita de produto — `NEEDS_PRODUCT_DECISION` nas três.

Achado adicional não solicitado explicitamente pela issue, mas descoberto
como efeito colateral direto da investigação de F-08: o próprio canal
"Link direto/QR Code" da Divulgação produz **dois valores de `src` diferentes
para o que a interface apresenta como "a mesma ação"** — o QR embutido usa
`?src=qrcode`, o botão "Copiar link" adjacente usa `?src=direct`. Registrado
como `F-08b` abaixo.

| ID | Pergunta | Veredito | Ação recomendada |
|---|---|---|---|
| F-04 | Botão de ativação de produto existe? | `NOT_REPRODUCED` | Nenhuma — feature existe e funciona; conta auditada tinha 100% do catálogo já ativado |
| F-07 / RED-01 | Materiais × Divulgação | `CONFIRMED` | `NEEDS_PRODUCT_DECISION` — 3 alternativas propostas (§ 5) |
| F-08 / RED-02 | Links simples × rastreados | `CONFIRMED` (+ `F-08b` novo) | `NEEDS_PRODUCT_DECISION` — inventário completo em § 6 |
| F-09 | Contato × Lead × Clique no WhatsApp | `CONFIRMED` | `NEEDS_PRODUCT_DECISION` — colisão real de três camadas de significado (§ 7) |
| F-10 | Nome público divergente | `NOT_REPRODUCED` | Nenhuma — banco prova que nunca houve divergência nesta conta |
| F-16 | Honeypot exposto a leitor de tela | `FALSE_POSITIVE` | Nenhuma — `aria-hidden` + `tabIndex=-1` + offset visual, padrão correto nas 7 árvores |
| F-17 | Landmarks duplicados | `FALSE_POSITIVE` | Nenhuma — `hidden md:flex` / `md:hidden` são mutuamente exclusivos por `display:none` |

**Padrão notável:** os quatro achados que fecham como não-reproduzidos (F-04,
F-10, F-16, F-17) têm uma causa raiz comum plausível — o relatório original
(SET-86) foi produzido com ferramentas de leitura de página (`read_page`,
`get_page_text`) que, por desenho, não aplicam CSS computado
(`display:none`) nem sempre refletem estado de conta específico (catálogo
100% ativado) ou dados exatos do banco no momento exato da leitura. Isso não
invalida o valor da auditoria original — os quatro achados eram hipóteses
razoáveis a partir do que a ferramenta reportou — mas confirma por que a
própria SET-101 existe: **investigar antes de implementar**, exatamente como
pedido.

---

## 2. Metodologia

Mesma restrição estrutural da SET-93 (`MVP_E2E_PRODUCT_AUDIT.md` § 2): esta
sessão não pode autenticar como o representante (entrar senha em qualquer
formulário é uma ação proibida, independente de quem pede — ver regras de
segurança da sessão). Por isso, as superfícies autenticadas (`/app/paginas`,
`/app/divulgacao`, `/app/conta`, `/app/paginas/marketing`) foram investigadas
por:

1. **Leitura direta do código-fonte** — toda conclusão abaixo cita arquivo e
   linha.
2. **Leitura read-only do banco de dados real** (via MCP do Supabase,
   projeto de produção do SETNAR) — usada especificamente para F-04 (contar
   quantos produtos a conta auditada tinha ativado) e F-10 (comparar
   `representatives.display_name` com `profiles.full_name` e checar
   `created_at`/`updated_at` da linha). Apenas `SELECT`, apenas dados da
   própria conta do dono do produto (`pedrooswg@gmail.com`), nenhuma escrita.
3. **ADRs e planos já aprovados** (`SET-84_DIVULGACAO_LEAN_PLAN.md`,
   `MARKETING_MATERIALS_PLAN.md`, `STAGE_1_KPI_SPECIFICATION.md`,
   `DOMAIN_MODEL.md`) como fonte de intenção de produto já registrada — não
   reinventada aqui.

`git status`/`git log` também revelou que o branch local `develop` estava 24
commits atrás de `origin/develop` no início desta investigação — incluindo os
próprios relatórios-base (SET-86, SET-93) e os fixes de SET-94 a SET-100.
Um `git pull --ff-only` (fast-forward limpo, sem mudanças locais perdidas)
trouxe o branch local para o baseline acima antes de qualquer leitura.

---

## 3. F-04 — "Ativar produtos": existe?

**Veredito: `NOT_REPRODUCED`**

### O que o código prova

O botão de ativação existe e está correto:

- `product-activation-card.tsx:202-206` — renderiza um botão **"Ativar"**
  sempre que `state === 'not_activated'` para aquele produto específico.
- `merge-representative-catalog.ts:25-37` — o catálogo exibido em
  `/app/paginas` é **"todo Produto da minha Company"** (`listOwnCatalog`)
  combinado com a própria ativação, se existir; qualquer produto sem linha em
  `product_activations` recebe `state = 'not_activated'` por padrão (linha
  35). Isso é exaustivo: um 8º produto futuro no catálogo da Company
  apareceria automaticamente com seu próprio botão "Ativar", sem mudança de
  código.
- A ativação é por **card de produto**, não um botão global único — é assim
  que o subtítulo "Ative produtos, publique páginas e compartilhe seus
  links" (`src/app/app/paginas/page.tsx:72`) se cumpre: um botão por produto
  ainda não ativado, ao lado dos já ativados.

### Por que a auditoria original não encontrou o botão

Consulta ao banco (read-only, conta `pedro-policeno`):

```
total_products = 7, activation_rows = 7, not_activated_count = 0
```

A conta usada na auditoria (a única conta real do produto) já tinha **100%
do catálogo iGreen (7 de 7 produtos) ativado** no momento da SET-86. Como
`state === 'not_activated'` nunca era verdadeiro para nenhum card daquela
conta, o botão "Ativar" nunca tinha uma linha do catálogo para aparecer —
não porque a funcionalidade esteja ausente ou mal posicionada, mas porque a
conta testada não tinha nenhum produto nesse estado para exibir.

### Achado secundário, de severidade bem menor

O subtítulo "Ative produtos, publique páginas e compartilhe seus links" é
uma instrução genérica sempre visível, mesmo para uma conta com 100% do
catálogo já ativado — que nunca mais verá um botão "Ativar" a menos que a
Company adicione um produto novo ao catálogo. Isso não é o achado original
(botão ausente), é uma nuance de copy: a frase promete um passo que pode não
estar mais disponível para aquele usuário. Severidade P3, não bloqueia nada.
Não vira issue própria por si só — mencionado aqui para registro, decisão de
incluir ou não fica com o Product Owner.

**Recomendação:** nenhuma ação de código. `F-04` fecha sem issue de
implementação.

---

## 4. F-16 — Honeypot exposto a tecnologia assistiva?

**Veredito: `FALSE_POSITIVE`**

### Evidência no código, nas duas variantes usadas pelas 7 árvores

Conexão Club usa `CommercialLeadForm`
(`commercial-lead-form.tsx:127-138`); as outras 6 árvores (Telecom,
ConexãoGreen, ConexãoLivre, ConexãoPlacas, ConexãoSolar, GreenSeguros) usam
o genérico `LeadForm` (`lead-form.tsx:114-119`). As duas implementam o
**mesmo padrão de três camadas**, redundante por desenho:

| Camada | `CommercialLeadForm` | `LeadForm` | Efeito |
|---|---|---|---|
| Ocultação visual | `.hpField` (`commercial-page-base.module.css:940-946`): `position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden` | Tailwind `absolute -left-[9999px]` | Nunca visível para um usuário vidente |
| Ocultação de acessibilidade | `<p aria-hidden="true">` envolvendo o campo inteiro | idêntico | Remove **toda a subárvore** da accessibility tree — um leitor de tela nunca a anuncia, independente de CSS |
| Ocultação de teclado | `tabIndex={-1}` no `<input>` | idêntico | Nunca alcançável por Tab |

`aria-hidden="true"` no elemento pai é normativo (WAI-ARIA/HTML AOM):
remove a subárvore inteira da accessibility tree **por especificação**,
independente de a CSS deixar a caixa "visível" ou não. Este honeypot está
implementado com o padrão correto e redundante (3 barreiras, não 1) —
inclusive mais robusto que a técnica ingênua de só usar `display:none`
(que alguns crawlers de spam já sabem detectar e pular).

### Por que a SET-86 reportou o texto "Não preencha isto:"

`get_page_text` — uma ferramenta de extração de texto renderizado — lê
`innerText`/conteúdo de layout, não a accessibility tree computada. Um
elemento com `position:absolute; left:-9999px` **tem caixa de layout**
(só está fora da viewport), então uma extração de texto ingênua o inclui,
mesmo que nenhum usuário real (vidente ou de leitor de tela) jamais o veja
ou ouça. O achado original observou uma limitação da própria ferramenta de
auditoria, não do produto.

**Recomendação:** nenhuma ação de código. `F-16` fecha sem issue de
implementação, nas 7 árvores.

---

## 5. F-17 — Landmarks duplicados na navegação autenticada?

**Veredito: `FALSE_POSITIVE`**

### Evidência no código

`src/app/app/layout.tsx:18-36` — os dois containers de navegação são
**mutuamente exclusivos por breakpoint**, no mesmo ponto de corte (`md`):

```
<aside class="hidden md:flex ...">      ← visível só em md+ (≥768px)
  <AppNavigation />                      nav aria-label="Navegação da conta"
</aside>
...
<header class="... md:hidden">          ← visível só abaixo de md (<768px)
  <AppNavigation mobile />               nav aria-label="Navegação da conta"
</header>
```

Tailwind `hidden` aplica `display:none`; `md:flex`/`md:hidden` sobrescrevem
exatamente no breakpoint `md`. Como as duas classes usam o **mesmo**
breakpoint (`md`), não existe largura de viewport em que ambos os
containers estejam simultaneamente com `display` diferente de `none`.

Por especificação HTML/accessibility tree, um elemento com `display:none`
computado — e toda sua subárvore — **é removido da accessibility tree**.
Logo, o segundo `<nav aria-label="Navegação da conta">` nunca está
acessível a um leitor de tela ao mesmo tempo que o primeiro, em nenhum
breakpoint real.

### Por que a SET-86 viu os dois simultaneamente

Mesma causa raiz do F-16: a ferramenta `read_page (filter all)` da sessão
original provavelmente lê a árvore de acessibilidade do DOM sem aplicar
computação de layout/CSS responsivo em todos os casos — capturando os dois
`<nav>` presentes no HTML, independentemente de qual estava com
`display:none` no momento. Isso é consistente com a própria nota
metodológica da SET-86 (§ *Nota metodológica*): a ferramenta de
redimensionamento de janela "não teve efeito nesta sessão — a janela
permaneceu travada em 1214×667px... em todas as tentativas" — ou seja, a
sessão original já documentou não confiar na própria capacidade de
observar breakpoints corretamente.

**Recomendação:** nenhuma ação de código. `F-17` fecha sem issue de
implementação.

---

## 6. F-10 — "Nome público" divergente da página pública?

**Veredito: `NOT_REPRODUCED`**

### O que o código prova

Os dois pontos citados no achado original leem exatamente a mesma coluna,
sem transformação:

- **Conta → "Nome público"** (`representative-profile-form.tsx:53,85-98`):
  `defaultValues.displayName = representative.name`, resolvido por
  `SupabaseRepresentativeAccountRepository.findByProfileId`
  (`supabase-representative-account-repository.ts:38-59`) via
  `.select('..., display_name, ...')` → `name: data.display_name`.
- **Cabeçalho da página pública** (`commercial-page-header.tsx:34,37`) e
  **"Quem vai te atender"** (`consultor-section.tsx:33`,
  `authorized-representative-identification-block.tsx:41`): todos renderizam
  `{representative.name}` **por inteiro**, sem `.slice`/`.split`/CSS
  `text-overflow`. O único uso de nome parcial é `firstName =
  representative.name.split(' ')[0]` (`consultor-section.tsx:24`), usado
  apenas no texto do botão "Falar com {firstName}" e na mensagem de
  WhatsApp — nunca no título/cabeçalho. `representative.name` nesse caminho
  vem de `SupabaseRepresentativeRepository.findPublishedActivation()`
  (`supabase-representative-repository.ts:50-73,108-113`) — **a mesma
  coluna** `representatives.display_name`, mesmo padrão de leitura, sem
  join com `profiles.full_name`, sem cache (`grep` por
  `revalidate|unstable_cache|dynamic =` em `src/app` não retornou nenhuma
  ocorrência; Next.js 15 já desabilita cache de `fetch` por padrão).

Não existe, no código atual, nenhum caminho que produza dois valores
diferentes de nome a partir da mesma linha de `representatives` para as
duas superfícies citadas.

### O que o banco prova

```sql
select r.display_name, p.full_name, r.created_at, r.updated_at
from representatives r join profiles p on p.id = r.profile_id
where r.slug = 'pedro-policeno';
```

```
display_name = "Pedro Henrique Arantes Policeno"
full_name    = "Pedro Henrique Arantes Policeno"   -- idêntico
created_at   = 2026-08-13 11:44:10.248838+00
updated_at   = 2026-08-13 11:44:10.248838+00        -- idêntico ao created_at
```

`updated_at` idêntico a `created_at`, ao microssegundo, prova que esta
linha **nunca foi editada** desde a criação da conta (2026-08-13) — quinze
dias antes da auditoria SET-86 (2026-08-27/28). Ou seja: o valor
"Pedro Henrique Arantes Policeno" já era o valor real e único desta conta
durante toda a janela em que a SET-86 rodou. Não há, em nenhum ponto do
histórico desta linha, um valor "Pedro Policeno" gravado.

Também descartada a hipótese de string hardcoded: `grep -r "Policeno" src/`
não retorna nenhuma ocorrência — nenhum componente tem esse nome como
placeholder ou exemplo estático.

### Conclusão honesta sobre a causa

Com código e dados idênticos nas duas superfícies, e a linha do banco
provadamente estável antes, durante e depois da SET-86, esta investigação
**não consegue reconstruir um mecanismo de produto** que explique a
observação original. As hipóteses mais prováveis — nenhuma verificável sem
repetir a sessão ao vivo — são um artefato de navegador (aba/HTML em cache
de uma sessão anterior à criação da conta atual, já que a máquina da SET-86
tem histórico documentado de restrições de memória) ou um erro de
transcrição no relatório original. Nenhuma das duas é um defeito de produto.

**Recomendação:** nenhuma ação de código. `F-10` fecha sem issue de
implementação. Se o problema for percebido de novo por um usuário real,
capturar o HTML exato da resposta do servidor (não uma leitura de DOM já
carregado) antes de reabrir esta investigação.

---

## 7. F-07 / RED-01 — Materiais × Divulgação

**Veredito: `CONFIRMED` — `NEEDS_PRODUCT_DECISION`**

### AS-IS (código, não interpretação)

Os dois módulos **não são domínios separados** — `src/modules/marketing-materials/`
é o único módulo; Divulgação vive dentro dele
(`marketing-materials/presentation/divulgacao-flow.tsx`,
`marketing-materials/divulgacao-copy.ts`), decisão já registrada e citada
literalmente no código: *"a decisão do plano foi: nova superfície de
PRODUTO, não nova arquitetura de domínio... nenhum
`src/modules/divulgacao/*` nasce aqui"* (`divulgacao/page.tsx:26-33`).

```
Painel lateral (5 itens)
 ├─ Páginas ────────► link/QR SEM atribuição
 │                     (buildCommercialPageUrl puro, sem ?src=)
 │
 ├─ Materiais ──────► biblioteca PLANA — 21 peças (7 produtos × 3 formatos:
 │  /app/paginas/         post·story·poster), cada uma um PNG para baixar.
 │  marketing              QR do poster: MESMO link sem atribuição de Páginas.
 │                         Nenhum texto pronto. Nenhuma noção de "canal".
 │                         (material-catalog.ts, materials-page.tsx)
 │
 └─ Divulgação ─────► ASSISTENTE guiado, 3 passos: produto → canal → kit.
    /app/divulgacao       4 canais (Instagram Post, Instagram Story,
                           WhatsApp/Status, Link direto/QR) mapeiam para os
                           MESMOS 3 formatos de Materiais — nenhum formato
                           novo, reuso via getMaterialsForProduct().
                           + texto pronto (3 dos 4 canais, divulgacao-copy.ts)
                           + link/QR COM atribuição (?src=<origin>)
                           + Web Share API
                           (divulgacao-flow.tsx)
```

Em termos de **cobertura de ativos**: os 4 canais de Divulgação cobrem os
mesmos 3 formatos que Materiais tem (WhatsApp/Status reusa `story`, Link
direto/QR reusa `poster`) — nenhum PNG existe em Materiais que Divulgação
não alcance por algum canal. Divulgação é hoje um **superset funcional**
dos ativos de Materiais, mais copy pronta e atribuição — exatamente como
`MVP_E2E_PRODUCT_AUDIT.md` § 10 já registrou (`DOC-02`).

O que Materiais tem que Divulgação não tem: (1) navegação em **biblioteca
plana** — todas as 7×3 peças visíveis de uma vez, sem assistente passo a
passo, útil para quem quer baixar várias artes em lote; (2) link/QR **sem**
`?src=`, para quem não quer um link com parâmetro de rastreio visível.

### Resposta às perguntas obrigatórias da issue

- **JTBD de Materiais:** "me dê a arte pronta deste produto, neste formato,
  para eu postar do meu jeito" — biblioteca de ativos, sem opinião sobre
  canal ou mensagem.
- **JTBD de Divulgação:** "me diga exatamente o que postar neste canal
  específico" — kit guiado por canal, com atribuição.
- **SET-84 tornou Divulgação um superset parcial ou total de Materiais?**
  Total, em termos de ativos visuais (mesmos 3 formatos, via o mesmo
  registry). Parcial, em termos de modo de navegação (Materiais continua
  sendo o único caminho para "ver tudo de uma vez" e para um link
  não-atribuído).
- **Razão válida para manter os dois módulos independentes no MVP?** Sim,
  mas nenhuma das duas telas comunica essa razão ao representante — nem
  Materiais explica "aqui você baixa tudo direto", nem Divulgação explica
  "aqui eu te guio por canal, com texto pronto e atribuição".
- **Dependências:** attribution (`origin`/`?src=`), QR Code
  (`generateQrCodeDataUrl`), analytics (`listOwnBreakdownByOrigin`),
  registry de materiais (`marketing-materials/registry.ts`), documentação
  normativa (`PRODUCT.md` já documenta as duas rotas desde SET-94/DOC-01).

### TO-BE — três alternativas (nenhuma implementada aqui)

**A — Manter e diferenciar (menor custo/risco)**
Manter as duas rotas; ajustar apenas nomes/copy para que a diferença de
propósito fique explícita no próprio menu ou como texto de apoio (ex.:
"Materiais" → subtítulo "biblioteca completa para baixar"; "Divulgação" →
já tem "o material, o texto e o link já saem prontos"). Sem mudança de
rota, domínio ou componente.
*Risco:* baixo. *Custo:* baixo (copy-only). *Custo cognitivo residual:*
médio — o representante ainda decide entre dois menus, só que agora com
mais contexto para escolher certo na primeira tentativa.

**B — Consolidar totalmente**
Fundir em um único fluxo: escolher produto → escolher "quero baixar a
biblioteca completa" ou "quero um kit para um canal específico". Elimina a
duplicação de fato; reduz o menu lateral de 5 para 4 itens.
*Risco:* médio/alto — toca a única rota (`/app/paginas/marketing`) coberta
por `tests/e2e/marketing-materials.spec.ts` e a mais nova
(`/app/divulgacao`) coberta por `tests/e2e/divulgacao.spec.ts`; exige
decidir se a navegação "biblioteca plana" de Materiais sobrevive dentro do
novo fluxo ou é sacrificada. *Custo:* mais alto — mudança de IA real, não
só copy.

**C — Aninhar Materiais dentro de Divulgação**
Divulgação ganha um passo/aba adicional ("ver biblioteca completa") que
mostra as 21 peças de uma vez, sem passar pelo assistente; `/app/paginas/marketing`
deixa de ser item de menu de topo (menu cai de 5 para 4 itens), mas a rota
pode continuar existindo como destino interno (deep link), sem quebrar
`marketing-materials.spec.ts`.
*Risco:* médio — muda navegação, não domínio. *Custo:* médio. Preserva as
duas capacidades e reduz a decisão "qual menu eu uso" a uma escolha dentro
de uma única tela.

**Recomendação desta investigação:** nenhuma das três é escolhida aqui —
por desenho da SET-101. Alternativa A é a mais barata para validar se
renomear/explicar já resolve a confusão antes de comprometer com B ou C,
que exigem decisão de arquitetura de informação e não devem ser feitas sem
aprovação explícita do Product Owner.

---

## 8. F-08 / RED-02 — Link/QR simples × rastreado (+ achado novo F-08b)

**Veredito: `CONFIRMED`, com um refinamento novo (`F-08b`) — `NEEDS_PRODUCT_DECISION`**

### Inventário completo dos 3 pontos de cópia de link (código, não amostragem)

| Ponto | Componente | URL produzida | Parâmetro `?src=` |
|---|---|---|---|
| Páginas | `published-page-actions.tsx` via `buildCommercialPageUrl()` (chamado em `product-activation-card.tsx`) | canônica pura | nenhum — `origin` resolve para `null` |
| Materiais | `buildMarketingMaterialPropsWithQrCode` (`material-props.ts:62-69`) | canônica pura (mesma de Páginas) | nenhum |
| Divulgação — QR embutido no material | `buildMarketingMaterialPropsForOrigin` (`material-props.ts:80-88`) | canônica + `?src=<origin do canal>` | `instagram_post` / `instagram_story` / `whatsapp` / **`qrcode`** (canal Link direto/QR) |
| Divulgação — botão "Copiar link" (mesmo canal Link direto/QR) | `COPY_LINK_ORIGIN.link_qr` (`divulgacao-flow.tsx:45-47,192`) | canônica + `?src=` | **`direct`** |

`origin.ts:30-33` — quando não há `?src=` válido, `resolveOrigin` retorna
`null`, exibido como **"Origem não identificada"** no breakdown
(`ORIGIN_LABELS`/`UNKNOWN_ORIGIN_LABEL`, `origin.ts:42-50`) — uma linha
diferente de "Link direto" (`src=direct`, rotulado "Link direto" no mesmo
breakdown).

### `F-08b` — achado novo, não previsto no relatório original

Dentro do **mesmo canal** "Link direto/QR Code" de Divulgação, a mesma tela
produz **dois valores de atribuição diferentes** para o que parece, aos
olhos do representante, ser "o mesmo link":

- O **QR Code** exibido nessa tela foi gerado com `?src=qrcode`.
- O botão **"Copiar link"**, na mesma tela, copia `?src=direct`.

Um representante que copia o link de texto e também compartilha o QR da
mesma tela — achando que são o mesmo destino de rastreio — vai gerar dois
totais diferentes no breakdown por origem ("QR Code" vs. "Link direto")
para o que ele via como uma única ação. Isso é uma decisão de código
deliberada e documentada (`divulgacao-flow.tsx:25-27,44-47`: "o QR já
embutido no poster carrega `qrcode`... a ação própria 'Copiar link' desse
mesmo card copia `direct`") — não é um bug de implementação, é uma decisão
de produto nunca exposta ao representante nem documentada para ele.

### Resposta às perguntas obrigatórias

- **3 pontos de cópia confirmados**, um deles (Divulgação/Link direto)
  internamente produzindo 2 valores de atribuição — 4 combinações reais de
  URL, não 3.
- **Remover/unificar prejudicaria attribution?** Unificar Páginas/Materiais
  para incluir `?src=direct` (em vez de nenhum `src`) uniformizaria a
  semântica sem perder capacidade — hoje "sem `src`" e "`src=direct`"
  coexistem como dois jeitos de dizer a mesma coisa ("não veio de um canal
  social específico"), o que já é, por si, uma inconsistência de dados
  silenciosa independente da UI.
- **Explicação mínima ao usuário:** nenhuma das 3 telas hoje diz que existe
  rastreio, nem por quê. Uma nota curta em Divulgação ("este link inclui um
  código para você ver depois de onde vieram os cliques") resolveria a
  ambiguidade de UX sem expor `?src=` como termo técnico.

**Recomendação:** `NEEDS_PRODUCT_DECISION` em duas frentes distintas —
(1) se/como comunicar a existência do parâmetro de rastreio nas 3 telas;
(2) se `F-08b` deve ser corrigido (fazer "Copiar link" e QR do mesmo canal
usarem o mesmo `src`) ou é uma distinção intencional que precisa apenas ser
documentada. Nenhuma implementação nesta investigação.

---

## 9. F-09 — "Contato" × "Lead" × "Clique no WhatsApp"

**Veredito: `CONFIRMED` — colisão real entre três camadas de significado — `NEEDS_PRODUCT_DECISION`**

Esta é a pergunta com a causa mais profunda das sete: os próprios documentos
normativos do produto usam "Lead" com **dois escopos deliberadamente
diferentes**, e a copy de marketing usa "contato" de um terceiro jeito,
informal.

### Camada 1 — `DOMAIN_MODEL.md`, visão de futuro (Stage 3, explicitamente)

`DOMAIN_MODEL.md:129-133`:
> "A person who has expressed identifiable interest... **typically by
> initiating WhatsApp contact** or another tracked conversion action...
> **This is the entry point into the Sales/CRM domain (Stage 3)**... A
> Visitor clicks 'Talk on WhatsApp' **and is recorded as a Lead**."

Aqui, "Lead" inclui clique no WhatsApp por definição — mas o próprio texto
rotula isso como Stage 3 (CRM futuro, com Pipeline Status/Won/Lost/Activity
Timeline), **não** o que está implementado hoje. Isso não é um erro de
documentação — é escopo aspiracional, devidamente isolado, e já foi
verificado pela série SET-87→92.

### Camada 2 — implementação e KPI real (Stage 1/MVP, o que existe hoje)

`STAGE_1_KPI_SPECIFICATION.md` KPI 7/8 é explícito e reforçado com um
"Do not interpret as" para cada lado:

> KPI 7 (WhatsApp Clicks) — *"Do not interpret as: 'Lead' — um clique no
> WhatsApp NÃO cria uma linha em `leads`... São eventos paralelos."*
> KPI 8 (Leads) — *"Definition: Uma linha em `leads`, gravada por
> `submit_lead()`... a partir do `CommercialLeadForm`, um formulário
> próprio... separado do botão de WhatsApp."* *"Do not interpret as: um
> estágio posterior a 'WhatsApp Click' — é um evento paralelo e
> independente."*

O código confirma: `lead-inbox.tsx:19-21` — *"Nenhum contato recebido
ainda... Quando alguém **preencher o formulário** de uma página publicada,
os dados aparecerão aqui."* `/app/contatos` só lista submissões de
formulário. Um clique no WhatsApp nunca aparece lá — vira só um contador em
`product-activation-card.tsx:174-176` ("X cliques no WhatsApp"), nunca uma
entrada de "Contato".

### Camada 3 — copy de marketing, uso informal do dia a dia

`setnar.tenant.ts:118-120` — benefício "**Contato direto**": *"Sem
intermediário: quem se interessa fala com você, não com um formulário
genérico de empresa."* `product-preview.tsx:74-76` — mockup da landing
mostra um toast: **"Novo contato" / "chamou você no WhatsApp agora"** — ou
seja, a própria peça de marketing rotula um clique no WhatsApp como
"contato", **exatamente o caso que a Camada 2 (o produto real) proíbe
explicitamente de chamar de "Contato"**.

### Por que isso importa

Um representante lê "Contato direto... fala com você" na landing, associa
"contato" a "alguém falou comigo" (incluindo WhatsApp), depois abre
`/app/contatos` e só encontra ali quem preencheu formulário — os cliques de
WhatsApp, que a própria landing usou para ilustrar "contato", nunca
aparecem naquela tela. A confusão não é um erro de um único texto: é a
colisão de um termo usado com três escopos diferentes e legítimos em três
lugares diferentes (visão de futuro do domínio, definição operacional do
MVP, linguagem de vendas), nenhum dos três errado isoladamente, mas nunca
reconciliados entre si para quem lê os três em sequência como um usuário
real faz.

### Resposta às perguntas obrigatórias

- **O que conta como "lead" oficialmente?** No Stage 1 implementado: só uma
  linha em `leads`, só via formulário (Camada 2). No domínio aspiracional
  (Stage 3, não implementado): também um clique no WhatsApp (Camada 1).
- **Clique no WhatsApp é intenção, conversão ou contato?** No MVP: intenção
  (`KPI 7`, "ação de intenção comercial"), nunca "contato"/"lead". Na copy
  de marketing hoje: tratado como "contato".
- **O que aparece em `/app/contatos`?** Só formulário — confirmado em
  código, sem exceção.
- **Termos técnicos vs. o que deve aparecer ao licenciado:** "Lead" já é
  peça de nomenclatura interna (tabela, módulo, KPI); a UI já usa
  "Contato"/"Contatos" para o representante — isso está correto e
  consistente **dentro do produto**. A inconsistência está entre a UI do
  produto e a copy da landing, não dentro do produto autenticado.
- **Taxonomia hipotética (Visita/Clique/Contato/Lead) proposta pela
  SET-86:** compatível com a Camada 2 tal como já implementada — "Lead"
  já é, de fato, só o termo técnico interno; a mudança necessária não é de
  schema/analytics, é só alinhar a copy de marketing para não usar
  "contato" para descrever um clique de WhatsApp.

**Recomendação:** `NEEDS_PRODUCT_DECISION` restrita à copy de marketing
(`setnar.tenant.ts:118-120`, `product-preview.tsx:74-76`) — ajustar para não
chamar um clique de WhatsApp de "contato", já que o produto real reserva
esse nome para submissão de formulário. Nenhuma mudança de schema, analytics
ou `DOMAIN_MODEL.md` é necessária — a Camada 1 (Stage 3) já está
corretamente isolada como visão de futuro e não precisa reconciliação.

---

## 10. Resumo Final

| ID | Veredito investigativo | Decisão final |
|---|---|---|
| F-04 | `NOT_REPRODUCED` | `CLOSED` — nenhuma implementação |
| F-07 / RED-01 | `CONFIRMED` | `DECIDED` — manter e diferenciar Materiais × Divulgação |
| F-08 / RED-02 | `CONFIRMED` | `DECIDED` — normalizar attribution por mecanismo |
| F-08b | achado adicional | `EXPECTED_BEHAVIOR` — `direct != qrcode` |
| F-09 | `CONFIRMED` | `DECIDED` — alinhar somente a copy comercial conflitante |
| F-10 | `NOT_REPRODUCED` | `CLOSED` — nenhuma implementação |
| F-16 | `FALSE_POSITIVE` | `CLOSED` — nenhuma implementação |
| F-17 | `FALSE_POSITIVE` | `CLOSED` — nenhuma implementação |

A SET-101 está concluída como investigação.

Nenhuma implementação foi realizada nesta issue.

Os trabalhos decorrentes de F-07, F-08 e F-09 devem ser executados em
issues independentes ([SET-104](https://linear.app/setnar/issue/SET-104),
[SET-105](https://linear.app/setnar/issue/SET-105),
[SET-103](https://linear.app/setnar/issue/SET-103), respectivamente),
preservando este documento como registro histórico da investigação e das
decisões de produto.
