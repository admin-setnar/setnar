### ADR-056 — "No distractions" passa a significar CTA único, não zero conteúdo; conteúdo variável por Produto vive em código; Tabs de conteúdo do Conexão Club como prova de conceito (CP3)

**Contexto.** `docs/COMMERCIAL_PAGE_CONTENT_PLAN.md` investigou o gap entre a
Commercial Page mínima que ADR-055 deixou (identificação + CTA + lead form +
compliance) e o conteúdo rico que `templates/commercial-pages/` já tem pronto
como referência, nunca conectado a runtime. O documento levantou duas
decisões de produto que bloqueavam qualquer widget novo (§3.1, §3.2) sem
fechar nenhuma sozinho — este ADR registra as duas decisões e a primeira
implementação sobre elas.

**Decisão §3.1 — reabertura consciente do "No distractions" de `DESIGN_SYSTEM.md`.**
A seção "Commercial Page Components" ("No distractions. No unnecessary
navigation. The page exists to convert visitors into conversations.") está
inalterada desde o commit fundador do repositório, sem nenhum comentário
indicando que fosse regra só do MVP. Lida ao pé da letra, ela proibiria
qualquer conteúdo além do mínimo — mas o valor que ela protege não é
"zero conteúdo", é "um caminho só até a conversão": nenhuma navegação nova,
nenhum CTA concorrente, nenhuma saída da página. **Todo widget de conteúdo
novo deve terminar no mesmo CTA único que já existe** — `WhatsappCta` (ou
uma variação dele que só monta um texto de mensagem diferente, nunca uma URL
diferente) ou `LeadForm`. Isso não é uma reversão da regra original, é a
leitura que sobrevive ao ganho real de conteúdo mais rico sem abrir mão do
que "no distractions" de fato protegia.

**Decisão §3.2 — conteúdo variável por Produto em código, não em coluna.**
Mesmo raciocínio já registrado em ADR-055 para o aviso de compliance:
`products` continua só `id, company_id, slug, name`
(`20260731000000_create_representative_domain.sql`), sem policy de escrita
para `authenticated`/`anon` e sem superfície de admin de catálogo no roadmap
antes do Stage 5. Uma coluna nova hoje não compraria "editável sem deploy"
nenhuma — só trocaria uma revisão por diff/PR num arquivo `.ts` por uma
revisão por diff/PR numa migration, perdendo a tipagem forte do TypeScript
no caminho. Conteúdo por produto passa a viver em
`src/modules/representatives/domain/product-content/*.ts`, um arquivo por
Produto, mesmo padrão que `product-compliance-notice.ts` já estabeleceu.

**Implementação — CP3, prova de conceito com 1 produto só.**
`src/modules/representatives/domain/product-content/conexao-club.ts` exporta
`ProductContentTab` (`{ chave, rotulo, descricao }`) e `CONEXAO_CLUB_TABS`,
as 5 categorias extraídas literalmente de
`templates/commercial-pages/ConexaoClub/index.html`'s `CATEGORIAS`
(mercado/farmácia/viagem/lazer/combustível) — a mesma cópia já aprovada por
compliance que o template estático usa. Sem `mensagemWhatsapp` por aba:
confirmado no `<script>` do template que o CTA (`id="cat-cta"`) usa sempre o
mesmo texto fixo ao trocar de categoria, ao contrário de ConexaoPlacas/
GreenSeguros (CP4, não coberto por este passo). Uma função pura,
`getActiveTab(tabs, chave)`, resolve qual aba está ativa — `null` para uma
chave fora do array, nunca a primeira aba como fallback silencioso, mesmo
princípio de `getProductComplianceNotice`.

`src/modules/representatives/presentation/product-content-tabs.tsx` é o
Client Component novo: um grupo de botões (`role="tablist"`) que troca só o
parágrafo de descrição visível, compondo `Card`/`Text` do design system —
nenhuma peça visual nova. Zero chamada de rede, zero estado além de "qual
aba está selecionada". `src/app/[productSlug]/page.tsx` renderiza
`<ProductContentTabs tabs={CONEXAO_CLUB_TABS} />` entre `WhatsappCta` e o
`Card` do lead form, condicionado a `product.slug === 'conexao-club'` — os
outros 6 produtos não ganham esse bloco. **Zero mudança em
`WhatsappCta`/`LeadForm`/`ComplianceNotice`** — nenhuma das três precisa
saber que tabs existem.

**Teste — mesmo nível de `product-compliance-notice.test.ts`.**
`tests/product-content-tabs.test.ts` testa `CONEXAO_CLUB_TABS`/`getActiveTab`
diretamente (`node:test`/`assert`, sem infraestrutura de render React — o
mesmo limite que ADR-055 já documentou: o risco real, a descrição errada
aparecendo para a categoria errada, mora no lookup, não no JSX).

**Verificação.** `npm run typecheck`/`lint`/`test`/`build` passam limpos
(253/253 testes, incluindo os 6 novos deste passo). Verificação manual via
`curl -H "Host: teste-novo-a.setnar.com" localhost:3000/conexao-green`
confirma que o produto publicado existente renderiza idêntico a antes —
nenhum marcador de tabs (`role="tablist"`, `cat-tabs`) no HTML servido,
título do produto e aviso de compliance presentes como sempre.

**Limitação registrada, não resolvida neste passo.** Nenhum representante de
teste no banco atual tem `conexao-club` como Product Activation publicada
(só `conexao-green` está publicado, para `teste-novo-a`/`teste-a`) — sem uma
service-role key neste projeto (por design, ver ADR-037) e sem credenciais de
um usuário autenticado para chamar `activate_product`/`set_activation_status`
nesta sessão, não foi possível confirmar por HTTP real o HTML servido de
`/conexao-club` ponta a ponta. A prova disponível para este passo é indireta:
compilação real pelo bundler do Next (`next build`, zero erros, exercitando o
mesmo SWC/JSX que produção usa) e os testes de unidade da lógica de
resolução de aba — não uma captura de tela ou HTML servido do produto em si.
**Próximo passo de verificação, fora do escopo deste ADR:** publicar
`conexao-club` para um representante de teste e repetir o mesmo roteiro de
`curl` acima apontando para `/conexao-club`.

**Custo de reversão.** Baixo — um arquivo de conteúdo, um componente client
sem estado além de "aba selecionada", e uma condicional em `page.tsx`;
nenhuma migration, nenhuma tabela, nenhuma coluna.

**Não coberto por este passo, de propósito.** CP4 (rolar o mesmo padrão de
tabs para ConexaoPlacas/GreenSeguros/Telecom, que variam o texto do CTA por
aba além da descrição), CP5-CP8 (calculadora, quiz, FAQ), CP9 (paleta
on-brand da iGreen — depende de confirmação de marca própria, CP1) e CP10
(GA4/Meta Pixel) — cada um permanece como próximo passo isolado em
`docs/COMMERCIAL_PAGE_CONTENT_PLAN.md`.

---
