Status: Concluída — auditoria final, predominantemente read-only, com uma correção editorial aplicada
Authority: Non-normative (auditoria; não altera nenhuma decisão de produto/domínio/arquitetura)
Code baseline: branch `develop` @ `b1cd1da` (2026-08-27) — nenhum código mudou desde SET-87
Doc baseline: branch `admin/set-92-...` @ `d154a76`, empilhada sobre SET-87→91
Last reviewed: 2026-08-27
Superseded by: n/a

# SET-92 — Auditoria final cross-document e prova de consistência normativa

**Pergunta**: os oito documentos essenciais, lidos na ordem de autoridade, levam um desenvolvedor humano ou um agente de IA a uma interpretação única e plausível sobre o que o SETNAR é, o que existe, o que o MVP valida, e o que é futuro/não autorizado?

**Método**: releitura completa dos 8 documentos (`README.md`, `PRODUCT_CONSTITUTION.md`, `PRODUCT.md`, `ROADMAP.md`, `DOMAIN_MODEL.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `ENGINEERING_GUIDELINES.md`) após as reconciliações da SET-87 a SET-91, mais `docs/README.md` (o mapa de autoridade, indispensável para julgar hierarquia mesmo não estando na lista literal da issue). Busca dirigida por citações entre documentos (`grep` por `"X.md's ..."`) para achar o tipo de deriva que uma revisão documento-por-documento não pega. Construção da matriz cross-document abaixo para os 20 conceitos exigidos.

---

## Achado único desta auditoria (corrigido, não bloqueante)

`DOMAIN_MODEL.md` citava, entre aspas, quatro trechos atribuídos a `PRODUCT.md`:
1. `"validate whether independent representatives are willing to pay for a Digital Office"` (§4) — a formulação **antiga** do MVP Goal, substituída na SET-87 e nunca atualizada aqui porque a SET-89 não tinha motivo para caçar citações de `PRODUCT.md` fora do seu próprio escopo (Commercial Page/QR/Material/Analytics/Billing).
2. `"self-service and automatic activation"` (§8.2, §12) — citação que **não existe literalmente** em `PRODUCT.md` na versão atual (2.0); provavelmente sobrevivente de uma versão anterior do documento.
3. `"automatic generation" e "automatic activation"` (§8.6) — mesmo problema.
4. `"helping professionals generate more business opportunities"` (§4) — paráfrase apresentada como citação exata; o texto real de `PRODUCT.md` § *Product Philosophy* é "Does this help our users generate more business opportunities?".

**Corrigido nesta auditoria** (commit `d154a76`): as quatro citações foram substituídas por referências corretas à seção-fonte, sem inventar nova redação normativa. É uma correção editorial inequívoca — não muda nenhum fato, apenas para de atribuir a `PRODUCT.md` palavras que ele não contém hoje. Não bloqueia o `GO`.

---

## Matriz cross-document

| Conceito | Fonte canônica | Docs de apoio | Status atual | Contradições | Risco de redundância |
|---|---|---|---|---|---|
| Missão/visão | `PRODUCT_CONSTITUTION.md` §2–4 | `PRODUCT.md` Vision/Mission; `DOMAIN_MODEL.md` §2 | Consistente — paráfrases fiéis, sem citação quebrada | Nenhuma | Baixo (paráfrase, não citação exata) |
| Proposta de valor | `PRODUCT.md` § *Core Value Proposition* | `PRODUCT_CONSTITUTION.md` Core Belief 5; `DOMAIN_MODEL.md` §2/§4 | Consistente após correção desta auditoria | Nenhuma restante | Baixo |
| Stage 1 / MVP | `PRODUCT.md` § *MVP Goal* (hipótese); `ROADMAP.md` Stage 1 (sequenciamento) | `DOMAIN_MODEL.md` §4 (corrigido aqui) | Consistente | Nenhuma restante | Era alto (3 descrições independentes, uma desatualizada) — agora baixo, as duas dependentes referenciam em vez de repetir |
| Tenant / Company / Representative | `DOMAIN_MODEL.md` §3 (vocabulário); `ARCHITECTURE.md` § *Multi-Tenant Strategy* (estrutura); `PRODUCT_CONSTITUTION.md` Core Belief 8 (princípio) | — | Consistente — mesma distinção Tenant≠Company≠Representative em todos | Nenhuma | Baixo — cada doc fala da sua própria altitude, conforme a própria hierarquia autoriza |
| Commercial Page | `DOMAIN_MODEL.md` §8.6 (entidade/cardinalidade) | `PRODUCT.md` *What Exists Today*; `ROADMAP.md`; `ARCHITECTURE.md`; `DESIGN_SYSTEM.md` | Consistente — exatamente um Product por Page (ADR-029), sete árvores independentes (ADR-089) | Nenhuma restante (era o maior cluster de contradições pré-SET-89) | Baixo |
| Product | `DOMAIN_MODEL.md` §8.4/§3 | `PRODUCT.md`; `ARCHITECTURE.md` (hierarquia) | Consistente | Nenhuma | Baixo |
| URL / host / subdomínio | ADR-092 (e ADR-001/026/031) | `PRODUCT.md` *What Exists Today*; `ROADMAP.md`; `ARCHITECTURE.md`; `DOMAIN_MODEL.md` | Consistente — formato `<representative>.<company>.setnar.com[/<product>]` | Nenhuma | **Baixo-médio** — ver Achado de acompanhamento 2 abaixo (`ARCHITECTURE.md` omite o segmento `/<product-slug>`, não é contradição, é escopo diferente) |
| Publicação/unpublish | `DOMAIN_MODEL.md` §14.1 (state machine); ADR-091 (UX) | `PRODUCT.md`; `ROADMAP.md`; `DESIGN_SYSTEM.md` | Consistente — 4 precondições ordenadas, unpublish manual ou por assinatura vencida (leitura, não transição ativa) | Nenhuma | Baixo |
| Materiais de divulgação | `PRODUCT.md` *What Exists Today* + *Product Capabilities* | `ROADMAP.md`; `DOMAIN_MODEL.md` §8.11; `ARCHITECTURE.md`; `DESIGN_SYSTEM.md` | Consistente — 21 peças (SET-65/ADR-090) existem hoje, distintas da futura Material Library | Nenhuma | Médio, mas **sem risco de deriva** — repetido em 5 documentos, todos citam a mesma fonte (SET-65/ADR-090) e concordam; não recomendo consolidar, é reforço, não deriva |
| QR Code atual | `DOMAIN_MODEL.md` §8.7 | `ARCHITECTURE.md`; `DESIGN_SYSTEM.md`; `PRODUCT.md` | Consistente — representação derivada, sem persistência, sem lifecycle próprio | Nenhuma restante (era o segundo maior cluster de contradições pré-SET-89) | Baixo |
| Analytics | `PRODUCT.md` *What Exists Today* | `DOMAIN_MODEL.md` §7.6/§8.9; `ROADMAP.md` | Consistente — visitas/cliques/leads mostrados por Produto, sem breakdown por origem/dispositivo/cidade | Nenhuma restante | Baixo |
| Source attribution | `PRODUCT.md` *What Exists Today*; `DOMAIN_MODEL.md` §9 (Referrer Source) | `ROADMAP.md` | Consistente — só Referer HTTP bruto no baseline; SET-84 confirmada fora do baseline por três investigações independentes (87/88/89) | Nenhuma | Baixo |
| Leads / WhatsApp / CTA | `DOMAIN_MODEL.md` §8.12/§7.8 | `PRODUCT.md`; `DESIGN_SYSTEM.md` (CTA único) | Consistente — captura + inbox somente-leitura, sem CRM | Nenhuma | Baixo |
| PWA | — (ausente de todos os 8 documentos) | — | **Ausente, não implementada, nem sequer modelada como conceito futuro em nenhum dos 8 documentos** | Nenhuma (nada afirma o contrário em lugar nenhum) | N/A |
| Campaigns futuras | `ROADMAP.md` Stage 2 | `DOMAIN_MODEL.md` §7.7/§8.10; `PRODUCT.md` | Consistente — Conceptual/candidata em todos, fronteira com attribution atual explícita | Nenhuma | Baixo |
| CRM futuro | `ROADMAP.md` Stage 3 | `DOMAIN_MODEL.md` §7.8; `PRODUCT.md` Non-Goals | Consistente — inbox atual explicitamente "not a CRM" em todos os lugares que mencionam | Nenhuma | Baixo |
| AI futura | `ROADMAP.md` Stage 4 | `DOMAIN_MODEL.md` §7.9; `PRODUCT_CONSTITUTION.md` Core Belief 4; `PRODUCT.md` | Consistente | Nenhuma | Baixo |
| Multi-company operations futuras | `ARCHITECTURE.md` § *Multi-Tenant Strategy* | `ROADMAP.md` Stage 5; `DOMAIN_MODEL.md`; `PRODUCT_CONSTITUTION.md` Core Belief 8 | Consistente — arquitetura já multi-tenant hoje ≠ produto multi-organização futuro, distinção idêntica nos 4 documentos | Nenhuma | Baixo |
| Princípios mobile-first | `DESIGN_SYSTEM.md` § *Responsive Design* | — | Consistente, fonte única, ninguém mais restabelece a regra | Nenhuma | Baixo |
| Limites de implementação p/ agentes de IA | `docs/README.md` § *Documents do not authorize implementation* | `ENGINEERING_GUIDELINES.md` § *Before writing code* (referencia, não repete); `DOMAIN_MODEL.md` §3.1 | Consistente — regra centralizada corretamente | Nenhuma | Baixo |

---

## Respostas às perguntas obrigatórias

- **O SETNAR é apenas um site builder?** Não — `PRODUCT.md` § *Core Value Proposition* ("SETNAR is not a website builder") e `PRODUCT_CONSTITUTION.md` § *Purpose/Rationale* (rejeita explicitamente "generate commercial pages" como definição). Inequívoco.
- **iGreen é dependência estrutural ou primeiro contexto de validação?** Primeiro contexto de validação — `PRODUCT.md` § *Relationship with iGreen*, `PRODUCT_CONSTITUTION.md` Core Belief 6/8, `ARCHITECTURE.md`/`DOMAIN_MODEL.md` (multi-tenancy arquitetural). Inequívoco.
- **Materiais existem hoje ou são visão futura?** Existem hoje (21 peças, SET-65/ADR-090), distintos da futura Material Library. Inequívoco, e consistente nos 5 documentos que tocam o assunto.
- **Analytics são exibidos ou apenas coletados?** Exibidos (visitas/cliques/leads, por Produto, 7/30 dias) — coleta sem breakdown de origem/dispositivo/cidade continua futura. Inequívoco.
- **Source attribution atual equivale a Campaign?** Não — atribuição atual é só o header `Referer` bruto; Campaign continua Conceptual, com fronteira explícita em `ROADMAP.md`/`DOMAIN_MODEL.md`. Inequívoco.
- **QR Code atual é entidade persistida ou representação derivada?** Derivada — sem persistência, sem lifecycle, recomputada a cada render. Inequívoco.
- **Qual é o formato canônico de endereço público e onde é definido?** ADR-092 (`<representative>.<company>.setnar.com/<product>`), citado consistentemente por `PRODUCT.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DOMAIN_MODEL.md`.
- **Commercial Page atual representa um ou vários Products?** Exatamente um (ADR-029, "no hub") — corrigido na SET-89, consistente em todos os documentos agora.
- **PWA está implementada, planejada ou ausente?** Ausente — e nem sequer aparece como conceito futuro em nenhum dos 8 documentos.
- **CRM/Campaigns/AI estão autorizados para implementação agora?** Não, inequivocamente, em todos os documentos que tocam o assunto — nenhuma mudança formal no roadmap os promoveu.

---

## Achados de acompanhamento (não bloqueantes, `GO_WITH_FOLLOWUPS`)

1. **Já registrado, não corrigido nesta auditoria** — `docs/README.md` Outstanding Documentation Debt **D14** (adicionado na SET-91): `PRODUCT.md` atribui "business hours" ao Stage 1 do `ROADMAP.md`, mas o `ROADMAP.md` atual lista em Stage 2. Ambos concordam que a capacidade não existe — a única divergência é de qual estágio a menciona, o que não induz implementação incorreta. Correção proposta: uma linha em `PRODUCT.md`, fora do escopo desta issue (que não edita `PRODUCT.md`).
2. **Novo, registrado aqui pela primeira vez** — `ARCHITECTURE.md` § *Multi-Tenant Strategy* descreve o endereço público como `<representative>.<company>.setnar.com`, sem o segmento `/<product-slug>` que `PRODUCT.md`/`DOMAIN_MODEL.md` incluem. Não é contradição — `ARCHITECTURE.md` fala especificamente de resolução de tenant/representative, não do roteamento completo da Commercial Page — mas é uma diferença de completude que vale alinhar na próxima vez que `ARCHITECTURE.md` for tocado.

Nenhum dos dois envolve uma decisão de produto, domínio ou arquitetura ainda não tomada — ambos são, na pior hipótese, uma frase a ajustar. Nenhuma issue nova é necessária além do que D14 já cobre; o item 2 fica registrado aqui para quem tocar `ARCHITECTURE.md` de novo.

---

## Critérios de aceite — checagem

- [x] Os 8 documentos foram lidos integralmente após as revisões anteriores.
- [x] Matriz cross-document produzida para todos os 20 conceitos exigidos.
- [x] Não existem duas fontes concorrentes para um mesmo fato normativo mutável sem hierarquia explícita (a repetição de materiais é reforço consistente, não concorrência).
- [x] `What Exists Today` está coerente com os documentos técnicos que o suportam.
- [x] Stage 1 e Stage 2+ não se contradizem.
- [x] Domínio implementado e arquitetura não possuem cardinalidades/entidades incompatíveis (Commercial Page×Product e QR Code, os dois clusters que existiam, foram corrigidos na SET-89/90).
- [x] Futuro conceitual não pode ser confundido com autorização de implementação.
- [x] Redundâncias de alto risco foram removidas ou justificadas (materiais: justificada; URL: registrada como observação menor).
- [x] Veredito emitido abaixo, com evidências.

---

## Veredito final

**`GO_WITH_FOLLOWUPS`**

Não há contradição normativa crítica entre os oito documentos — a série SET-87 a SET-91 resolveu os dois maiores clusters (cardinalidade de Commercial Page/QR Code, e o estado real de billing/analytics/materiais), e esta auditoria encontrou e corrigiu um terceiro problema menor (citações desatualizadas/fabricadas de `PRODUCT.md` dentro de `DOMAIN_MODEL.md`) sem precisar de nenhuma decisão nova. Os dois itens de acompanhamento listados acima (D14, já registrado; e a observação sobre `ARCHITECTURE.md`) são melhorias não bloqueantes, claramente registradas, que não arriscam induzir uma implementação incorreta.

A documentação normativa está seguro para orientar desenvolvimento.
