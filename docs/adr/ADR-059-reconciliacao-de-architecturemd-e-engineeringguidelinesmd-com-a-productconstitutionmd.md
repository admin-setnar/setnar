### ADR-059 — Reconciliação de `ARCHITECTURE.md` e `ENGINEERING_GUIDELINES.md` com a PRODUCT_CONSTITUTION.md v1.1

**Decisão.** Passo 5 do plano de reconciliação documental
(`docs/AUDIT_CONSTITUTION_RECONCILIATION.md`, Parte 3) é executado:
`ARCHITECTURE.md` e `ENGINEERING_GUIDELINES.md` passam a referenciar
formalmente `PRODUCT_CONSTITUTION.md` como autoridade superior, e
Compliance é elevada a seção própria em `ARCHITECTURE.md`, irmã de
Security.

**O que mudou.**
- `ARCHITECTURE.md` e `ENGINEERING_GUIDELINES.md` (seção Purpose de cada
  um): adicionada a frase de subordinação — *"This document is subordinate
  to PRODUCT_CONSTITUTION.md. Where a technical decision here appears to
  conflict with a principle stated there, the Constitution prevails and
  this document must be revised."*
- `ARCHITECTURE.md`: nova seção `# Compliance`, irmã de `# Security`,
  declarando compliance como infraestrutura não-negociável (Constitution,
  Core Belief 2) e não uma faceta de Security — referenciando
  `ProductComplianceNotice` (ADR-055) como implementação de referência já
  existente no código.
- `ENGINEERING_GUIDELINES.md`, seção "AI Collaboration": `PRODUCT_CONSTITUTION.md`
  passa a ser o primeiro item da lista de documentos contra os quais toda
  implementação de IA deve ser revisada, explicitamente com prioridade
  sobre os demais (Product Vision, Architecture, Design System, Engineering
  Guidelines, Roadmap).

**Contexto.** Achado M3 da auditoria: os dois documentos já eram altamente
compatíveis com a Constitution em espírito, mas foram escritos antes dela e
não reconheciam formalmente a nova autoridade acima deles;
`ENGINEERING_GUIDELINES.md` também tratava compliance apenas
implicitamente, via Security/OWASP.

**O que este ADR explicitamente não faz.** Não reescreve nenhuma seção
existente além do adicionado acima — nem `# Security`, nem o restante de
"AI Collaboration". Não toca em código, migration ou qualquer outro
documento; os passos 6–8 do plano de reconciliação (vocabulário
`license_id`/"licenciado", planos operacionais) permanecem bloqueados por
um ADR de terminologia ainda não criado.

**Custo de reversão.** Baixo — mudança é aditiva e puramente documental;
reverter é remover as frases e a seção acrescentadas.

---
