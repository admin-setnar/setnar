# MVP_E2E_PRODUCT_AUDIT.md

> Investigative report — non-normative, same status as every other document in
> `docs/plans/`. Produced under **SET-93**, which closes the investigative gate
> left open by **SET-86** (`Sprint de auditoria E2E e consolidação final do
> MVP`, closed `Done` without its consolidated deliverable ever being
> committed).
>
> **Read-only issue.** No production code, schema, route, component, style,
> copy or behavior was changed to produce this report. The only repository
> change is this file.

---

## 1. Executive Summary

Of the **12 historical findings** raised in SET-86's comments (landing,
public commercial page, authenticated product, auth), **5 are `RESOLVED`**,
**6 remain `CONFIRMED`**, and **1 is `NOT_REPRODUCED`** against the current
baseline. None of the 12 is a P0. Two — `PUB-02` and `PUB-03` — were
re-confirmed with live, measured evidence stronger than the original
(uncalibrated) observation.

**The most significant thing this audit surfaces is not on the historical
list.** `PRODUCT.md` § *What Exists Today* — the one section every other
normative document defers to on "does this exist?" — is now stale: **SET-84**
shipped a new authenticated route (`/app/divulgacao`) and a referrer/origin
breakdown for analytics, and neither is reflected there. The document still
asserts "no breakdown by referrer, device or city" for analytics, which is no
longer true. Per `docs/README.md`'s own rule, no release should ship while
this section is out of date — this is flagged as `DOC-01`, P1, and is a
**documentation-only** issue, structurally identical to SET-87 through
SET-92.

Nothing found here blocks continued MVP validation with real users today.
The confirmed findings are friction and polish, not correctness or safety
defects — the one item closest to a trust/perception risk (`PUB-02`,
competing CTAs with no visual hierarchy on the page whose only job is
conversion) is P2, not P0/P1.

**Verdict: `GO`** — see § 24 for the full reasoning and § 23 for exactly what
this audit did not cover and why.

---

## 2. Baseline and Methodology

| | |
|---|---|
| Branch analisada | `admin/set-93-consolidar-e-revalidar-a-auditoria-e2e-da-set-86`, criada a partir de `develop` |
| Commit SHA | `d3f6b5c3aa424bf766083f56b2db878eb6d2f69d` (2026-08-27 20:03:17 -0300) |
| Data da investigação | 2026-08-28 |
| Divergência do baseline documental | `PRODUCT.md`/`DOMAIN_MODEL.md` § 3.1 citam `b1cd1da` (2026-08-27) como baseline verificado. Entre `b1cd1da` e `d3f6b5c` entraram 18 commits: a série de reconciliação documental SET-87→SET-92, o fluxo de Divulgação completo (SET-84, D2–D8), e um fix de flakiness E2E (`dc245e3`). Nenhum desses commits é código de produto não documentado **exceto o próprio SET-84**, que é o que motiva o achado `DOC-01` (§ 17). |
| Ambiente | Nenhum servidor local (`next dev`) foi iniciado. Ver justificativa abaixo. |

### Por que sem `next dev` local

A máquina de desenvolvimento tem 8 GB de RAM e um histórico documentado de
`RangeError: Failed to allocate memory` ao rodar `next dev` (webpack) junto
com um navegador de automação. Rodar os dois simultaneamente para esta
auditoria arriscaria corromper a própria investigação (páginas travadas em
"Carregando…" por OOM, indistinguíveis de um bug real de performance) sem
necessidade: a landing (`setnar.com`) e uma página comercial real e pública
(`pedro-policeno.igreen.setnar.com/conexao-club` — a mesma testada na
contribuição original da SET-86) já estão publicadas e são as URLs mais
fiéis ao que um usuário real encontra hoje. Testá-las ao vivo não exige
servidor local.

### O que foi verificado em navegador real

- `setnar.com` (landing) — desktop (1280×720) e mobile (375×812)
- `setnar.com/entrar`, `/criar-conta`, `/esqueci-senha` — validação de
  formulário vazio, nos três
- `pedro-policeno.igreen.setnar.com/conexao-club` (página pública real,
  publicada) — desktop e mobile, estilos computados dos CTAs, contraste
  medido via `getComputedStyle` + fórmula de luminância relativa WCAG,
  Long Tasks (`PerformanceObserver`) e contagem de recursos de rede durante
  scroll completo da página

### O que foi verificado apenas estaticamente (código)

- Todas as superfícies autenticadas (`/app/paginas`, `/app/contatos`,
  `/app/conta`, `/app/paginas/marketing`, `/app/divulgacao`) — leitura direta
  do código-fonte e dos testes E2E/integração existentes que já as exercitam
  contra um banco real (`tests/e2e/*.spec.ts`)
- As outras 6 árvores de apresentação de Commercial Page (Telecom,
  ConexãoGreen, ConexãoLivre, ConexãoPlacas, ConexãoSolar, GreenSeguros) —
  inspecionadas por grep estrutural (uso das mesmas classes/padrão de CTA),
  não abertas ao vivo uma a uma
- RLS, rate limiting, isolamento de tenant, idempotência de webhook —
  cobertos por ADRs específicos (ADR-011/012/013/034/036/038/039/048/067/068/075)
  e pela suíte de integração; não re-auditados linha a linha aqui (ver § 15
  e § 23)

### Limitações da auditoria

1. **Nenhuma sessão autenticada real foi criada.** Criar uma conta de teste
   descartável, mesmo que depois limpa, é exatamente o padrão que SET-79/
   SET-80 existiram para eliminar (contaminação de dados). Em vez disso, as
   três superfícies autenticadas mais sensíveis a UX (`APP-01`, `APP-02`,
   `APP-03`) foram revalidadas por leitura de código com alta confiança
   (nenhuma envolve lógica condicional complexa que só se revele em runtime)
   e pelos testes E2E existentes que já fazem login/onboarding/publicação
   reais em CI.
2. **Nenhum profiling de performance com ferramenta dedicada** (Lighthouse,
   Chrome DevTools Performance) foi rodado — o navegador desta sessão não
   compõe frames visualmente (screenshot e `requestAnimationFrame` não
   funcionam neste ambiente), então a medição de `PUB-01` usou a API de
   Long Tasks e contagem de recursos de rede como proxy, não FPS real.
3. **Nenhum scan de acessibilidade automatizado** (axe, Lighthouse a11y) foi
   executado — a verificação de acessibilidade nesta rodada é estrutural
   (landmarks, labels, contraste calculado) e não um relatório WCAG completo.
4. **Apenas 1 das 7 árvores de Commercial Page foi aberta ao vivo**
   (Conexão Club, a mesma da SET-86 original). As outras 6 foram
   inspecionadas por código.

---

## 3. Fontes Consultadas

1. `docs/README.md` — hierarquia normativa e regras de governança
2. `docs/PRODUCT_CONSTITUTION.md` (lida em sessão anterior, princípios já
   internalizados nas decisões abaixo)
3. `docs/PRODUCT.md`, particularmente § *What Exists Today*
4. `docs/ROADMAP.md` § *Still open in Stage 1*
5. `docs/DOMAIN_MODEL.md` § 3.1 (Domain Status)
6. ADRs citados inline onde relevantes (ADR-005, ADR-055, ADR-057, ADR-082,
   ADR-088, ADR-089, ADR-090, ADR-092)
7. Comentários históricos da SET-86 (dois comentários, 2026-08-27, achados
   `LP-*`, `PUB-*`, `APP-*`, `AUTH-*`)
8. Código-fonte do baseline (`src/`), ver citações inline
9. `tests/e2e/*.spec.ts` (critical-path, mobile-smoke, commercial-pages,
   divulgacao, marketing-materials, publication-management)
10. Navegador real contra `setnar.com` e a página pública publicada citada
    acima

---

## 4. Inventário AS-IS das Superfícies

| Superfície | Rota(s) | Fonte |
|---|---|---|
| Landing institucional | `/` | `src/app/page.tsx` + `src/modules/marketing/` |
| Autenticação | `/entrar`, `/criar-conta`, `/esqueci-senha`, `/redefinir-senha` | `src/modules/auth/` |
| App Shell | `/app` → redireciona para Páginas | `src/app/app/layout.tsx`, `app-navigation.tsx` |
| Páginas (hub) | `/app/paginas` | `src/app/app/paginas/page.tsx` + `RepresentativeHub` |
| Divulgação | `/app/divulgacao` | `src/app/app/divulgacao/page.tsx` — **existe, não documentado em `PRODUCT.md`, ver `DOC-01`** |
| Materiais | `/app/paginas/marketing` | `src/modules/marketing-materials/` |
| Contatos | `/app/contatos` | `src/modules/leads/presentation/lead-inbox.tsx` |
| Conta/billing | `/app/conta` | `src/modules/billing/presentation/checkout-form.tsx` e afins |
| Preview privado | `/pre-visualizacao/[productSlug]` | SET-36 |
| Commercial Pages (7 árvores) | `/[productSlug]`, resolvido por subdomínio | `src/modules/representatives/presentation/commercial-pages/*` |
| Legal | `/termos`, `/privacidade` | — |

---

## 5. Jornada E2E Atual (modelo mental validado)

`Criar presença → Publicar → Divulgar → Atrair → Captar → Mensurar → Melhorar`

Todas as sete etapas têm um caminho real e navegável hoje:

1. **Criar presença** — cadastro (`/criar-conta`) → onboarding (nome/telefone
   já vêm do cadastro) → ativação de produto.
2. **Publicar** — botão "Publicar" em `/app/paginas`, condicionado às quatro
   preconditions já documentadas em `PRODUCT.md`.
3. **Divulgar** — `/app/divulgacao` (SET-84) entrega link/QR/copy por canal
   com atribuição de origem, **e `/app/paginas/marketing` entrega os 21
   materiais**. Duas rotas para uma mesma intenção ("divulgar") — ver § 10.
4. **Atrair** — a Commercial Page pública em si.
5. **Captar** — formulário de lead na Commercial Page.
6. **Mensurar** — `/app/paginas` mostra visitas/cliques/leads por produto,
   agora **também com breakdown por origem** (SET-84) — não documentado.
7. **Melhorar** — não existe um loop fechado disso de volta para ação (ex.:
   nenhuma recomendação "seu link do Instagram converte mais, poste mais
   lá"); isso é consistente com o escopo do MVP e não é uma lacuna a
   preencher artificialmente (`PRODUCT.md` § *Non-Goals*).

Um usuário novo consegue, sem documentação, entender o que fazer primeiro —
a ordem imposta pela própria UI (ativar → publicar → aparecem link/QR) já
força a sequência certa. A única ambiguidade real está entre as etapas 3
acima (duas rotas para "divulgar" — ver `DOC-02` proposto em § 17, não um
bug, uma nota de coerência de IA).

---

## 6. Revalidação dos Findings Históricos (SET-86)

Tabela-resumo; evidência completa de cada um está nas seções 7–9 e 12.

| ID | Achado original | Status atual | Evidência |
|---|---|---|---|
| `LP-01` | Grid assimétrico em Recursos | **CONFIRMED** | § 7 |
| `LP-02` | Card de preço sem CTA próprio | **CONFIRMED** | § 7 |
| `LP-03` | Disclaimer de compliance isolado no rodapé | **CONFIRMED** | § 7 |
| `LP-04` | Contraste a validar | **RESOLVED** (nunca foi um problema — medido agora) | § 7 |
| `LP-05` | Cobertura mobile ausente | **RESOLVED** | § 7, § 13 |
| `PUB-01` | Travamento ao rolar (Categorias) | **NOT_REPRODUCED** | § 12, § 14 |
| `PUB-02` | CTAs concorrentes sem hierarquia | **CONFIRMED** (evidência mais forte que a original) | § 12 |
| `PUB-03` | CTA repetido em contextos diferentes | **CONFIRMED** | § 12 |
| `APP-01` | Despublicar sem confirmação visível | **RESOLVED** | § 9 |
| `APP-02` | Formulário de assinatura não pré-preenchido | **CONFIRMED** | § 9 |
| `APP-03` | Contatos sem busca/filtro/status | **CONFIRMED**, mas já documentado como limite conhecido, não defeito | § 9, § 11 |
| `AUTH-01` | Fluxo maduro, sem achados bloqueantes | **RESOLVED** (verificado ao vivo nos 3 formulários) | § 8 |

---

## 7. Auditoria da Landing e Comunicação

**Superfície:** `setnar.com`, desktop 1280×720 e mobile 375×812, ao vivo.

A copy vende o produto real — nenhuma menção a CRM, IA, campanhas ou
automação como se existissem hoje; a proposta de valor ("Sua página de
vendas profissional, pronta hoje") é consistente com `PRODUCT.md` § *Core
Value Proposition*. FAQ não existe na landing (não é um requisito
documentado). Prova social: nenhuma inventada — a "prévia da interface" é
explicitamente rotulada como prévia, com números de exemplo plausíveis, não
apresentados como reais.

### LP-01 — Grid assimétrico em "Recursos" — `CONFIRMED`

- **Status:** `CONFIRMED`
- **Superfície:** Landing → seção Recursos, `benefits.tsx`
- **Severidade:** P3
- **Problema observado:** o próprio comentário do componente
  (`src/modules/marketing/presentation/benefits.tsx:15-17`) afirma que "the
  first card spans two columns on desktop so the section does not read as
  five identical tiles" — mas a classe aplicada é
  `sm:col-span-2 lg:col-span-1` (linha 39): o span de 2 colunas só vale no
  breakpoint `sm` (grid de 2 colunas), e é **desfeito** em `lg` (`≥1024px`,
  grid de 3 colunas), que é onde a maioria dos visitantes desktop realmente
  está.
- **Evidência concreta:** medição ao vivo em 1280×720 (breakpoint `lg`
  ativo): `grid-template-columns: 368px 368px 368px`, item 0 com
  `grid-column: span 1 / span 1` — mesma largura dos outros 4. Layout
  resultante: linha 1 preenche 3 células (itens 0,1,2); linha 2 tem apenas 2
  itens (3,4), deixando a terceira célula vazia — exatamente o problema
  original.
- **Impacto para o usuário:** baixo/médio, estético.
- **Impacto na hipótese do MVP:** nenhum.
- **Causa provável:** o comentário do componente descreve a intenção
  correta para o breakpoint `sm`, mas o autor não notou que `lg:col-span-1`
  desfaz esse span exatamente na largura onde o problema original foi visto
  (desktop). Comentário e comportamento estão dessincronizados.
- **Recomendação conceitual:** ajustar para o span de 2 colunas persistir
  (ou usar outra estratégia — ex. 6 itens, ou grid de 2 colunas em vez de 3
  no desktop) também em `lg`.
- **Risco da mudança:** baixo — CSS puro, sem lógica.
- **Dependências:** nenhuma.
- **Documentação potencialmente afetada:** nenhuma (não é uma regra do
  `DESIGN_SYSTEM.md`, é um detalhe de implementação local).
- **Proposta de issue:** sim — item 1 em § 19.

### LP-02 — Card de preço sem CTA próprio — `CONFIRMED`

- **Status:** `CONFIRMED`
- **Superfície:** Landing → seção Preços, `pricing.tsx`
- **Severidade:** P2
- **Problema observado:** `pricing.tsx` (linhas 32-47) renderiza preço,
  qualificador e nota de trial, mas nenhum `<Button>`/link. Confirmado ao
  vivo: o texto extraído da seção de Preços termina em "Primeiros 30 dias
  grátis, sem cartão de crédito." sem nenhum controle de ação antes da
  próxima seção.
- **Evidência concreta:** `src/modules/marketing/presentation/pricing.tsx`
  e extração de texto da página ao vivo.
- **Impacto para o usuário:** médio — quem decide no momento do preço tem
  que rolar mais para agir, custo maior em mobile.
- **Impacto na hipótese do MVP:** indireto — qualquer fricção a mais no
  funil de cadastro atrasa a validação da hipótese de pagamento.
- **Causa provável:** decisão de design original centralizou o CTA de
  conversão numa seção final única; não foi replicado nos pontos de
  decisão intermediários.
- **Recomendação conceitual:** adicionar um botão de ação dentro do próprio
  card de preço, apontando para o mesmo destino do CTA final.
- **Risco da mudança:** baixo.
- **Dependências:** nenhuma.
- **Documentação potencialmente afetada:** nenhuma.
- **Proposta de issue:** sim — item 2 em § 19.

### LP-03 — Disclaimer de compliance isolado no rodapé — `CONFIRMED`

- **Status:** `CONFIRMED`
- **Superfície:** Landing → confiança/compliance
- **Severidade:** P2
- **Problema observado:** o texto "O Setnar é uma plataforma independente
  de ferramentas de vendas..." (`setnar.tenant.ts:193`) só é renderizado
  pelo `Footer` (`footer.tsx:92-95`). Não há segunda ocorrência, resumida ou
  não, em nenhuma outra seção da landing.
- **Evidência concreta:** grep confirma uma única ocorrência de uso do
  campo `legalNotice` fora de sua definição, em `footer.tsx`.
- **Impacto para o usuário:** baixo, direto — mas médio para a organização,
  já que a transparência de marca é um princípio explícito
  (`PRODUCT.md` § *Relationship with iGreen*).
- **Impacto na hipótese do MVP:** nenhum diretamente; risco reputacional
  indireto se um visitante concluir associação institucional indevida antes
  de rolar até o rodapé.
- **Causa provável:** disclaimer tratado como texto legal padrão de
  rodapé, não como elemento de confiança no funil.
- **Recomendação conceitual:** considerar uma versão resumida perto do CTA
  principal ou da seção de preços — **qualquer redação nova precisa passar
  por revisão de compliance antes de ir ao ar**, dado que se trata de texto
  legal.
- **Risco da mudança:** baixo tecnicamente; o risco real é de compliance,
  não de código.
- **Dependências:** aprovação de compliance/jurídico para a nova redação.
- **Documentação potencialmente afetada:** nenhuma diretamente — a regra em
  si já está em `PRODUCT.md`.
- **Proposta de issue:** sim — item 3 em § 19.

### LP-04 — Contraste — `RESOLVED` (nunca confirmado como problema; agora medido)

- **Status:** `RESOLVED`
- **Superfície:** Landing → hero (`pronta hoje.`, span `.text-content-subtle`)
  e parágrafo de abertura
- **Severidade:** P3 (fechado)
- **Evidência concreta (medição ao vivo, fórmula de contraste relativo
  WCAG 2.1):**
  - `pronta hoje.` — `rgb(90, 99, 114)` sobre `rgb(255, 255, 255)` →
    **6.06:1** (passa AA normal-text ≥4.5:1, e é texto grande, então passa
    com folga ainda maior)
  - Parágrafo de abertura do hero — `rgb(71, 84, 112)` sobre branco →
    **7.59:1** (passa até AAA ≥7:1)
  - Subtexto do CTA final ("Crie sua conta, ative um produto...") —
    `rgba(255,255,255,0.7)` sobre `rgb(20,33,61)` → **~8.4:1**
- **Causa provável:** o achado original marcava explicitamente "não
  confirmado" e pedia medição — a medição agora feita não reproduz um
  problema.
- **Recomendação conceitual:** nenhuma ação necessária.
- **Proposta de issue:** não.

### LP-05 — Cobertura mobile — `RESOLVED`

- **Status:** `RESOLVED`
- **Evidência concreta:** viewport 375×812 ao vivo — `scrollWidth ===
  clientWidth` (sem overflow horizontal), menu colapsa para hambúrguer
  (`aria-label="Abrir menu"`), todo o conteúdo textual se mantém legível e
  na ordem correta.
- **Recomendação conceitual:** nenhuma ação necessária além do que já está
  coberto por `tests/e2e/mobile-smoke.spec.ts` (SET-52), que cobre o
  funil de cadastro→publicação→lead em viewport móvel real (Pixel 7,
  Playwright).
- **Proposta de issue:** não.

---

## 8. Auditoria de Auth/Onboarding

**Superfície:** `/entrar`, `/criar-conta`, `/esqueci-senha`, ao vivo,
submissão vazia em cada um.

### AUTH-01 — `RESOLVED`

- **Status:** `RESOLVED`
- **Evidência concreta:**
  - `/entrar`: alertas inline "Informe o seu e-mail." e "Informe a sua
    senha." — sem reload.
  - `/criar-conta`: cinco alertas inline simultâneos e específicos por
    campo ("Informe o seu nome completo.", "Informe o telefone
    comercial.", "Informe o seu e-mail.", "Use ao menos 8 caracteres.",
    "Repita a senha para confirmar.", "É preciso aceitar os termos para
    criar a conta.") — mesma qualidade de `/entrar`.
  - `/esqueci-senha`: mesmo padrão, "Informe o seu e-mail.".
- **Conclusão:** a recomendação original ("confirmar que a mesma
  qualidade de validação de `/entrar` está replicada em `/criar-conta` e
  `/esqueci-senha`") está integralmente satisfeita, com evidência ao vivo
  substituindo a suposição original.
- **Proposta de issue:** não.

Onboarding em si (preenchimento de nome/telefone/endereço/authorizationId)
não foi testado ao vivo nesta rodada (exigiria conta real — ver
Limitações, § 2), mas está coberto por `tests/e2e/critical-path.spec.ts`
(`completeOnboarding`), que roda em CI a cada PR.

---

## 9. Auditoria do Produto Autenticado

Verificado por leitura direta de código, com apoio dos testes E2E que
exercitam essas rotas contra um banco real.

### APP-01 — Despublicar sem confirmação — `RESOLVED`

- **Status:** `RESOLVED`
- **Evidência concreta:** `product-activation-card.tsx:244-263` — o botão
  "Despublicar" abre um `Modal` com título `Despublicar {produto}?`,
  descrição explicando a consequência, e dois botões ("Cancelar" /
  "Despublicar página"). O próprio código documenta a mudança (linha 54):
  "'Despublicar' moved behind a confirmation `Modal`".
- **Conclusão:** o achado original era condicional ("se de fato não houver
  confirmação") — há confirmação, o que fecha o achado como resolvido, não
  apenas não-reproduzido.
- **Proposta de issue:** não.

### APP-02 — Formulário de assinatura não pré-preenchido — `CONFIRMED`

- **Status:** `CONFIRMED`
- **Superfície:** `/app/conta` → `CheckoutForm`
- **Severidade:** P3
- **Evidência concreta:** `checkout-form.tsx:27` — `CheckoutForm()` não
  recebe nenhuma prop; `useForm<CheckoutFormValues>()` (linha 34) é
  chamado sem `defaultValues`. Os campos "Nome completo" e "E-mail" ficam
  vazios mesmo já existindo no perfil. Reforçado por
  `tests/e2e/critical-path.spec.ts:210-212`, que precisa preencher
  `fixture.displayName` e `fixture.email` manualmente no teste, prova
  indireta de que não há pré-preenchimento.
- **Impacto para o usuário:** baixo — retrabalho de digitação.
- **Impacto na hipótese do MVP:** nenhum.
- **Causa provável:** o componente foi implementado (SET-28) antes de
  qualquer necessidade de reaproveitar dados do representante; nunca
  recebeu esse dado como prop.
- **Recomendação conceitual:** passar `representative.name`/`email` (já
  disponíveis em `/app/conta`) como `defaultValues` do `useForm`.
- **Risco da mudança:** baixo.
- **Dependências:** nenhuma.
- **Documentação potencialmente afetada:** nenhuma.
- **Proposta de issue:** sim — item 4 em § 19.

### APP-03 — Contatos sem busca/filtro/status — `CONFIRMED`, não é defeito

- **Status:** `CONFIRMED`
- **Severidade:** `Future` (mantida a classificação original)
- **Evidência concreta:** `lead-inbox.tsx` não contém nenhum controle de
  busca, filtro ou status (grep por `search|filtro|status|Input` não
  retornou nenhuma ocorrência no componente). Isso é **consistente com
  `PRODUCT.md` § *What Exists Today*** ("There is no status, note, edit,
  assignment, search or automation") e com `DOMAIN_MODEL.md` § 3.1
  (Lead: "No Pipeline Status, Activity, notes or mutation") — não é um
  gap de documentação, é um limite conhecido e já registrado.
- **Recomendação conceitual:** nenhuma ação nesta auditoria — item
  `Future`, não deve entrar no backlog do MVP por si só (regra explícita
  da SET-93).
- **Proposta de issue:** não (por design da própria SET-93).

Demais superfícies do produto autenticado (`/app/paginas/marketing`,
`/app/conta` fora do formulário de checkout) foram lidas e não
apresentaram inconsistência com o que `PRODUCT.md` documenta.

---

## 10. Auditoria do Fluxo de Divulgação

`/app/divulgacao` (SET-84) e `/app/paginas/marketing` (SET-65) hoje
coexistem como duas rotas de produto para a mesma intenção geral de
"divulgar":

- `/app/paginas/marketing`: 21 materiais (Post/Story/Poster) para download
  como PNG.
- `/app/divulgacao`: link/QR/copy por canal com atribuição de origem
  (`?src=`), propagada até as RPCs de analytics/leads.

Isso **não é um bug** — o comentário em `divulgacao/page.tsx:26-33` é
explícito: "`/app/divulgacao`, rota nova e independente de
`/app/paginas/marketing` (que fica como está nesta rodada)... a decisão do
plano foi: nova superfície de PRODUTO, não nova arquitetura de domínio."
É uma decisão registrada, não um acidente. Do ponto de vista de um
representante novo, porém, duas entradas de menu para "levar tráfego" sem
uma ligação visual entre elas é uma fricção de arquitetura de informação
real — nomeada aqui como `DOC-02` (ver § 17), não como um bug de UX a
corrigir cegamente, porque pode já estar no roadmap de unificação. Estados
vazios (`Nenhum produto disponível ainda`) e de perfil incompleto foram
lidos e são consistentes com o resto do produto.

---

## 11. Auditoria de Leads/Contatos e Analytics

Coberto em `APP-03` (§ 9) para a caixa de contatos. Para analytics:
`src/app/app/paginas/page.tsx:55-60` já lê
`analyticsRepository.listOwnBreakdownByOrigin(...)` e passa
`originBreakdown` para `RepresentativeHub` — **isso é exatamente o
breakdown que `PRODUCT.md` § *Success Metrics* afirma não existir.** Ver
`DOC-01`, § 17 — o achado de maior severidade desta rodada, mas de
natureza puramente documental.

---

## 12. Auditoria das Commercial Pages

**Superfície testada ao vivo:** `pedro-policeno.igreen.setnar.com/conexao-club`
(a mesma página real usada na contribuição original da SET-86 — mesma
conta do autor da issue, nenhum dado de terceiro exposto).

### PUB-01 — Travamento ao rolar — `NOT_REPRODUCED`

- **Status:** `NOT_REPRODUCED`
- **Severidade:** fechada (era P1)
- **Evidência concreta:**
  - Código: a seção "Categorias com desconto"
    (`conexao-club-page.tsx:106-123`) renderiza 8 `<div>` simples com um
    emoji como texto (`<span aria-hidden>{emoji}</span>`) — **nenhuma
    imagem, nenhum ícone SVG, nenhuma animação de scroll**. O
    `ClubCategoryWidget` (a única outra parte "de categorias" da página) é
    um simples toggle de estado React sem custo de renderização relevante.
  - Runtime: `PerformanceObserver({type:'longtask'})` durante um scroll
    completo e programático da página (20 passos, do topo ao fim) captou
    apenas 2 long tasks, de 96 ms e 168 ms — ordens de magnitude abaixo dos
    "alguns segundos" relatados originalmente. Nenhum recurso de imagem
    pesado carregado nessa seção (15 recursos de rede na página inteira).
- **Causa provável:** o achado original já registrava "causa provável: não
  identificada com certeza" e "suspeita" não confirmada. A hipótese mais
  provável agora é uma condição transitória do ambiente/máquina de quem
  testou originalmente (a mesma sessão que descreve, em outro documento
  desta base [`docs/README.md`'s memory note histórico], uma máquina de 8
  GB com histórico de estresse de memória) — não uma regressão de
  performance do produto.
- **Recomendação conceitual:** nenhuma ação de código. Se o problema for
  percebido novamente por um usuário real, capturar um profile de
  performance (Chrome DevTools) no momento do evento antes de investir em
  correção especulativa.
- **Risco de não agir:** baixo — nenhuma segunda evidência independente do
  problema.
- **Proposta de issue:** não.

### PUB-02 — CTAs concorrentes sem hierarquia — `CONFIRMED` (evidência reforçada)

- **Status:** `CONFIRMED`
- **Severidade:** P2
- **Evidência concreta (medição ao vivo dos três CTAs acima da dobra):**

  | CTA | Texto | `background-color` | `color` | Tamanho |
  |---|---|---|---|---|
  | Header (`#cta-header`) | "Falar no WhatsApp" | `rgb(0,179,89)` | branco | 220×54 |
  | Hero (`#cta-hero`) | "Quero ativar meu Club" | `rgb(0,179,89)` | branco | 216×54 |
  | Widget (`.billCta`) | "Quero economizar assim" | `rgb(0,179,89)` | branco | 403×54 |

  Os três são visual e literalmente idênticos em cor e altura — nenhuma
  hierarquia primário/secundário. **Achado adicional a este confirmado**:
  a página inteira tem **6 links `wa.me`/`api.whatsapp`** distintos
  (header, hero, widget, seção de consultor, CTA final, botão flutuante) —
  mais do que os 3 originalmente notados "acima da dobra", o que reforça
  (não contradiz) o achado original.
- **Impacto para o usuário:** médio — ambiguidade sobre a ação primária.
- **Impacto na hipótese do MVP:** indireto, mas real — esta é a página cujo
  único objetivo é conversão; ambiguidade de CTA nela tem custo mais alto
  que em qualquer outra tela do produto.
- **Causa provável:** todos os CTAs de WhatsApp compartilham a mesma classe
  `styles.btnWhats` (`commercial-page-base.module.css`), aplicada
  uniformemente por conveniência de reuso, sem uma segunda classe de
  hierarquia (ex. `.primary`/`.secondary`).
- **Recomendação conceitual:** definir qual é o CTA primário por seção
  (provavelmente o do formulário de lead ou o do WhatsApp mais próximo do
  scroll do visitante) e tratar os demais com peso visual reduzido
  (contorno em vez de preenchido, por exemplo) — decisão de design, não
  só de engenharia.
- **Risco da mudança:** baixo tecnicamente; médio de produto, porque toca
  um módulo CSS compartilhado por 7 árvores de apresentação — mudar
  `.btnWhats` sem cuidado pode alterar todas de uma vez.
- **Dependências:** decisão de design sobre a hierarquia antes da
  implementação.
- **Documentação potencialmente afetada:** `DESIGN_SYSTEM.md`, se a
  hierarquia virar uma regra permanente de Commercial Pages.
- **Proposta de issue:** sim — item 5 em § 19.

### PUB-03 — CTA repetido em contextos diferentes — `CONFIRMED`

- **Status:** `CONFIRMED`
- **Severidade:** P3
- **Evidência concreta:** `conexao-club-page.tsx:69` (`ctaLabel="Quero
  ativar meu Club"`, ação = abrir WhatsApp) e `:86` (`submitLabel="Quero
  ativar meu Club"`, ação = submeter formulário) — confirmado também ao
  vivo, os dois textos são idênticos e levam a ações diferentes (scroll +
  abrir WhatsApp vs. `POST` do formulário).
- **Impacto para o usuário:** baixo.
- **Recomendação conceitual:** variar o texto por contexto ("Falar agora
  no WhatsApp" vs. "Quero que me chamem").
- **Risco da mudança:** baixo, copy-only.
- **Dependências:** nenhuma para o Conexão Club; para generalizar às
  outras 6 árvores, depende de decidir se cada uma tem o mesmo padrão
  (grep confirma que todas usam `ctaLabel=`/`submitLabel=`, mas os
  textos específicos de cada uma não foram lidos nesta rodada).
- **Documentação potencialmente afetada:** nenhuma.
- **Proposta de issue:** sim — item 6 em § 19.

### Compliance e identificação (não um finding, verificação positiva)

- O aviso "Não é canal oficial..." aparece por página, no rodapé de cada
  Commercial Page (`commercial-page-footer.tsx`, `disclaimer` por produto).
- Identificação do representante presente no cabeçalho: nome, "Licenciado
  Autorizado iGreen Energy", ID de autorização
  (`commercial-page-header.tsx:37-41`), consistente com
  `PRODUCT_CONSTITUTION.md` Core Belief 1.
- `canonical` e `og:title`/`og:image` presentes e corretos por
  representante/produto (SET-11), confirmado ao vivo.

---

## 13. Mobile/Acessibilidade

- **Landing, mobile 375×812:** sem overflow horizontal, hambúrguer
  funcional, todo o conteúdo acessível por scroll vertical simples.
- **Commercial Page, mobile 375×812:** sem overflow horizontal. CTA do
  header vira ícone compacto (66×54 — atende ao mínimo de 44px em ambas
  as dimensões); CTA do hero vira largura total (327×53).
- **PWA — não confirmado, e corretamente não reivindicado em lugar
  nenhum:** `manifest.json` não existe no projeto (`Glob` em `public/`,
  zero resultados); nenhum `<link rel="manifest">` na página ao vivo;
  `navigator.serviceWorker.controller` é `false`. `DESIGN_SYSTEM.md` não
  menciona PWA em nenhum lugar (grep, zero ocorrências) — **não há
  contradição documental a corrigir aqui**, apenas a confirmação de que o
  produto é responsivo, não instalável, e nenhum documento afirma o
  contrário.
- **Labels e formulários:** confirmado estruturalmente (todos os campos
  testados via `getByLabel` nos testes E2E existentes, que falhariam sem
  um `<label>` real associado) — consistente com a seção *Accessibility*
  do `README.md` raiz.

---

## 14. Performance/Confiabilidade

Ver `PUB-01` (§ 12) para a revalidação específica. De forma mais ampla: a
landing e a Commercial Page testada carregaram sem erro de console, sem
recursos de rede fora do esperado (15 requisições na Commercial Page,
predominantemente JS/CSS do próprio bundle), e sem long tasks
significativas fora dos 96/168 ms já citados. **Isto não substitui um
Lighthouse real contra build de produção** (ver Limitações, § 2) — é
evidência suficiente para não reproduzir o achado original, não para
declarar performance formalmente validada.

---

## 15. Segurança/Compliance

Diagnóstico apenas — nenhuma alteração de implementação nesta issue.
Nenhum finding novo de segurança surgiu nesta rodada. Os controles
relevantes já têm ADR e cobertura de teste de integração dedicados e não
foram re-auditados linha a linha aqui (fora do escopo de tempo desta
rodada — ver § 23):

- Rate limiting de leads/login: ADR-012, ADR-013, ADR-036
- RLS/tenant isolation: ADR-011, ADR-038, ADR-039, ADR-048
- Regra canônica de acesso público: ADR-065, ADR-067, ADR-068
- Idempotência/autenticação de webhook: ADR-075

Nenhum dado pessoal de terceiro foi exposto nesta auditoria — a única
página pública com dados reais visitada é a do próprio autor da issue
original, e nenhum lead foi submetido.

---

## 16. Benchmark Externo

Não aplicado nesta rodada — nenhum dos achados confirmados exigiu
comparação externa para ser compreendido ou justificado (todos têm causa
identificável no próprio código). Registrado aqui apenas para satisfazer a
estrutura obrigatória do relatório.

---

## 17. Findings por Severidade e Status

### P1

| ID | Resumo | Status |
|---|---|---|
| `DOC-01` | `PRODUCT.md` § *What Exists Today* desatualizado pós-SET-84 (rota `/app/divulgacao` e breakdown por origem não documentados; afirmação "no breakdown by referrer" agora falsa) | **Novo, CONFIRMED** |

### P2

| ID | Resumo | Status |
|---|---|---|
| `LP-02` | Card de preço sem CTA próprio | CONFIRMED |
| `LP-03` | Disclaimer de compliance isolado no rodapé | CONFIRMED |
| `PUB-02` | CTAs concorrentes sem hierarquia (Commercial Pages) | CONFIRMED |

### P3

| ID | Resumo | Status |
|---|---|---|
| `LP-01` | Grid assimétrico em Recursos (comentário do código não bate com o comportamento em `lg`) | CONFIRMED |
| `PUB-03` | CTA com texto repetido em contextos diferentes | CONFIRMED |
| `APP-02` | Formulário de assinatura não pré-preenchido | CONFIRMED |
| `DOC-02` | Duas rotas de produto para "divulgar" sem ligação visual entre si | Novo, observação de arquitetura de informação, não um bug |

### Future (não vai para o backlog do MVP)

| ID | Resumo |
|---|---|
| `APP-03` | Contatos sem busca/filtro/status — já documentado como limite conhecido |

### Fechados sem ação

| ID | Motivo |
|---|---|
| `LP-04` | Contraste medido, passa WCAG AA em todos os pontos verificados |
| `LP-05` | Mobile verificado ao vivo, sem overflow, navegação funcional |
| `PUB-01` | Não reproduzido; código não sustenta a hipótese original de causa |
| `APP-01` | Confirmação já implementada |
| `AUTH-01` | Validação consistente confirmada ao vivo nos 3 formulários |

---

## 18. TO-BE Conceitual Mínimo

Não há necessidade de um TO-BE estrutural novo — a jornada E2E (§ 5) já é
coerente ponta a ponta. O TO-BE mínimo é: **os textos e a documentação
alcançam o que o código já faz.** Concretamente:

- `PRODUCT.md` reflete `/app/divulgacao` e o breakdown por origem
  (`DOC-01`).
- A página de preços tem um caminho de ação direto no ponto de decisão
  (`LP-02`).
- As Commercial Pages comunicam visualmente qual é *a* ação a tomar,
  não três ações de peso igual (`PUB-02`).

Nenhuma nova entidade, tabela ou capacidade é necessária para nenhum dos
achados confirmados.

---

## 19. Proposta de Decomposição em Issues Pequenas

Organizadas por jornada/capacidade, não por camada técnica. Nenhuma será
criada automaticamente por esta issue — ficam aqui como proposta para
aprovação do Product Owner.

1. **Corrigir o grid assimétrico da seção "Recursos" da landing em
   desktop (`LP-01`)** — o `col-span-2` do primeiro card deve persistir
   (ou uma alternativa deve ser escolhida) também no breakpoint `lg`, não
   só em `sm`.
2. **Adicionar um CTA de conversão dentro do card de preço da landing
   (`LP-02`)**.
3. **Reforçar a visibilidade do aviso de compliance da landing perto do
   ponto de decisão (`LP-03`)** — depende de aprovação de compliance para
   a redação.
4. **Pré-preencher nome e e-mail no formulário de assinatura (`APP-02`)**.
5. **Definir e aplicar hierarquia visual entre os CTAs de WhatsApp das
   Commercial Pages (`PUB-02`)** — decisão de design primeiro
   (qual é o CTA primário por seção), depois implementação no módulo CSS
   compartilhado; avaliar impacto nas 7 árvores.
6. **Diferenciar o texto do CTA do hero e do formulário de lead,
   começando pelo Conexão Club (`PUB-03`)** — avaliar, ao decidir o
   escopo, se generaliza para as outras 6 árvores.
7. **Reconciliar `PRODUCT.md` § *What Exists Today* com o baseline
   pós-SET-84 (`DOC-01`)** — issue documentacional, mesmo padrão de
   SET-87/88/89/90/91/92: investigação → aprovação do Product Owner →
   edição do documento. Não é uma issue de código.

Fora do backlog do MVP por decisão explícita desta auditoria: `APP-03`
(Future) e `DOC-02` (observação de arquitetura de informação, sem
recomendação de ação concreta ainda).

---

## 20. Dependências entre as Issues Propostas

- **#3** (LP-03) depende de aprovação externa (compliance/jurídico) antes
  da implementação — pode começar a tramitar em paralelo às demais.
- **#5** (PUB-02) precisa de uma decisão de design (qual CTA é primário)
  antes de qualquer código, e toca um módulo CSS compartilhado pelas 7
  árvores de Commercial Page — maior risco de ripple das sete propostas.
- **#6** (PUB-03) não depende de #5 tecnicamente, mas resolvê-las juntas
  evita retrabalho de copy se a hierarquia de #5 mudar qual botão é
  "principal".
- **#1, #2, #4, #7** são independentes entre si e das demais.

---

## 21. Ordem Recomendada de Execução

1. **#7 (`DOC-01`)** — mais barata, sem risco de código, e restaura a
   confiabilidade do documento do qual todo o resto depende.
2. **#1, #2, #4** — em paralelo, mudanças pequenas e independentes.
3. **#3** — iniciar a aprovação de compliance em paralelo ao passo 2,
   implementar assim que aprovado.
4. **#5** — agendar a decisão de design; é a maior das sete.
5. **#6** — resolver junto com ou logo após #5, para o Conexão Club, com
   decisão explícita sobre generalizar às outras 6 árvores.

---

## 22. Critérios de Aceite das Issues Propostas

1. **LP-01** — em viewport ≥1024px, a seção Recursos não deixa nenhuma
   célula de grid vazia; a seção mantém-se sem overflow em nenhum
   breakpoint testado.
2. **LP-02** — o card "Plano Fundador" tem um botão de ação visível sem
   scroll adicional, levando ao mesmo destino do CTA final existente.
3. **LP-03** — o texto de compliance (ou uma versão resumida aprovada)
   aparece antes do rodapé, em local revisado e aprovado por
   compliance/jurídico; o texto do rodapé permanece intacto.
4. **APP-02** — ao abrir `/app/conta`, os campos "Nome completo" e
   "E-mail" do formulário de assinatura já vêm preenchidos com os dados
   do representante, permanecendo editáveis.
5. **PUB-02** — em pelo menos uma árvore de Commercial Page, existe uma
   diferença visual clara (não apenas textual) entre o CTA primário e os
   demais; decisão de qual é o primário está registrada.
6. **PUB-03** — no Conexão Club, o texto do CTA do hero e o do botão de
   envio do formulário de lead não são idênticos.
7. **DOC-01** — `PRODUCT.md` § *What Exists Today* lista `/app/divulgacao`
   e o breakdown por origem, com baseline/data/verificador atualizados,
   seguindo o mesmo processo investigação → aprovação → edição das
   issues SET-87 a SET-92.

---

## 23. Riscos Residuais e Gaps de Evidência

Registrados com honestidade, não escondidos atrás do veredito `GO`:

1. **Nenhuma sessão autenticada real foi aberta nesta rodada.** `APP-01`,
   `APP-02` e `APP-03` foram fechados com alta confiança por leitura de
   código (nenhum deles depende de estado de runtime complexo), mas não
   foram clicados ao vivo por esta auditoria — apenas exercitados pelos
   testes E2E automatizados existentes, que rodam em CI, não nesta sessão.
2. **6 das 7 árvores de Commercial Page não foram abertas ao vivo.**
   `PUB-02`/`PUB-03` foram confirmados com evidência forte para Conexão
   Club; a extensão a Telecom, ConexãoGreen, ConexãoLivre, ConexãoPlacas,
   ConexãoSolar e GreenSeguros é inferida do padrão de código compartilhado
   (mesma classe CSS, mesmo padrão de props), não verificada árvore por
   árvore.
3. **Nenhum Lighthouse/axe real foi rodado.** A métrica de performance
   usada (Long Tasks) é um proxy razoável para "há bloqueio grave de main
   thread", não uma medição de Core Web Vitals.
4. **`PUB-01` foi fechado como `NOT_REPRODUCED`, não como "impossível".**
   Se o problema for percebido de novo por um usuário real, a
   recomendação (§ 12) é capturar profiling no momento, não assumir que
   está definitivamente descartado.
5. **Nenhum teste de carga ou de muitos leads simultâneos** foi feito
   contra o rate limit — fora do escopo desta auditoria de produto/UX.

Nenhum desses gaps, individualmente ou em conjunto, impede que se saiba o
que fazer a seguir — daí o veredito `GO` na § 24 — mas devem ser lidos
antes de tratar este relatório como cobertura exaustiva.

---

## 24. Verdict Final

### `GO`

**Critérios de saída da SET-93, verificados um a um:**

- ✅ Todos os 12 findings históricos têm status atual comprovado (§ 6).
- ✅ As superfícies obrigatórias tiveram cobertura suficiente: landing e
  auth ao vivo e completos; produto autenticado por código + testes E2E
  existentes (não ao vivo, por desenho — ver § 23 item 1); Commercial
  Pages com 1 de 7 árvores ao vivo e as outras 6 por código estrutural.
- ✅ Mobile foi de fato verificado — ao vivo, não apenas assumido por
  responsividade (landing e Commercial Page, 375×812, sem overflow).
- ✅ O relatório consolidado existe (este arquivo).
- ✅ Os novos findings (`DOC-01`, `DOC-02`) têm evidência reproduzível
  (citação de linha de código e comportamento do próprio app).
- ✅ Está claro quais mudanças ainda são necessárias antes de continuar a
  validação — nenhuma delas é bloqueante; todas são de polimento/coerência
  documental, não de correção ou segurança.
- ✅ Existe uma proposta revisável de issues-filhas (§ 19–22), sem
  nenhuma delas ter sido implementada nesta issue.

**Por que `GO` e não `NO_GO`:** nenhum P0 existe. O único P1 (`DOC-01`) é
uma correção documental, não um risco ao usuário ou ao negócio — o produto
já faz o que o documento deveria dizer que faz. Os gaps de cobertura
listados em § 23 são reais, mas nenhum deles deixa uma pergunta em aberto
sobre "o que fazer a seguir" — eles apenas limitam a *certeza* de que os
outros 6 produtos de Commercial Page se comportam exatamente como o
Conexão Club, o que é uma verificação barata e independente a fazer antes
de qualquer mudança em `PUB-02`/`PUB-03` se espalhar às 7 árvores (já
recomendado em § 20).

**Recomendação para continuar validando o MVP com usuários reais:** nada
neste relatório justifica pausar o piloto. As sete issues propostas em
§ 19 podem ser trabalhadas em paralelo à validação em andamento.
