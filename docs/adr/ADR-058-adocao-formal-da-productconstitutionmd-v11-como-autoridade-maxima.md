### ADR-058 — Adoção formal da PRODUCT_CONSTITUTION.md v1.1 como autoridade máxima do projeto

**Decisão.** `docs/PRODUCT_CONSTITUTION.md` muda de `Status: Draft` para
`Status: Active`. A partir deste ADR, a v1.1 da Constitution é tratada como
adotada, final, e como o documento de mais alta autoridade do projeto —
exatamente o que sua própria seção "Authority" já declarava enquanto ainda
estava em Draft: *"The Constitution is the highest-authority document in
this project."*

**Contexto.** Uma auditoria de reconciliação documental
(`docs/AUDIT_CONSTITUTION_RECONCILIATION.md`) comparou a Constitution v1.1 ao
restante da documentação (`PRODUCT.md`, `ROADMAP.md`, `DOMAIN_MODEL.md`,
`ARCHITECTURE.md`, `ENGINEERING_GUIDELINES.md`, este log de ADRs) e encontrou
conflitos concentrados principalmente em `PRODUCT.md` e `ROADMAP.md` —
documentos anteriores à Constitution que ainda descrevem a SETNAR nos termos
que a própria Constitution rejeita explicitamente na sua Rationale (ex.:
"Digital Sales Platform" para "sales professionals in Latin America"). O
Product Owner aprovou tratar a v1.1 como adotada antes de reescrever
qualquer documento subordinado: reescrever contra um rascunho é retrabalho
garantido se a Constitution mudar de novo depois.

**Hierarquia documental resultante, formalizada por este ADR.**
```
PRODUCT_CONSTITUTION.md
        ↓
PRODUCT.md
        ↓
ROADMAP.md
        ↓
DOMAIN_MODEL.md
        ↓
ARCHITECTURE.md / ENGINEERING_GUIDELINES.md
        ↓
ADRs (este README)
        ↓
Código
```
Onde qualquer documento entrar em conflito com um princípio da Constitution,
a Constitution prevalece e o documento conflitante deve ser revisado — nunca
o contrário. Essa hierarquia já estava implícita na própria seção "Scope and
complements" da Constitution; este ADR a formaliza como decisão do projeto,
não apenas como intenção de um único documento.

**Consequência — gatilho para uma reconciliação em andamento, não um evento
isolado.** Esta adoção é o marco a partir do qual a reconciliação
documento-por-documento identificada pela auditoria começa a ser executada,
nesta ordem: `PRODUCT.md` em seguida, depois `ROADMAP.md`, depois
`DOMAIN_MODEL.md`, depois `ARCHITECTURE.md`/`ENGINEERING_GUIDELINES.md`. Cada
um desses documentos é tratado em tarefas separadas subsequentes a este ADR,
não nesta mudança.

**O que este ADR explicitamente não faz.** Não reabre, revisa ou reescreve
nenhum ADR fechado anteriormente (ADR-001 a ADR-057) — decisões técnicas já
tomadas permanecem registradas como estavam no momento em que foram tomadas,
pelo mesmo princípio que já rege migrations aplicadas neste projeto (ver
"Migration rule" no início desta seção). Não altera nenhum conteúdo de
`PRODUCT_CONSTITUTION.md` além do campo de status — nenhuma cláusula, crença
ou princípio foi tocado. Não altera `PRODUCT.md`, `ROADMAP.md`,
`DOMAIN_MODEL.md`, `ARCHITECTURE.md` ou `ENGINEERING_GUIDELINES.md` — essas
reconciliações são trabalho futuro, rastreado mas não executado aqui.

**Custo de reversão.** Baixo — reverter é mudar o campo de status de volta
para `Draft` e remover este ADR; nenhum código, schema ou comportamento do
sistema depende do status da Constitution (confirmado: nenhuma leitura
programática do arquivo, ou do seu conteúdo, existe em `src/`).

---
