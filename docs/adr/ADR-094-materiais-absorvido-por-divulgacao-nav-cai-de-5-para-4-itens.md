### ADR-094 — Materiais é absorvido por Divulgação; navegação autenticada cai de 5 para 4 itens (reverte SET-104)

**Status:** Accepted
**Date:** 2026-08-31
**Related:** Reverte a decisão de
[SET-104](https://linear.app/setnar/issue/SET-104/diferenciar-semanticamente-materiais-e-divulgacao-sem-consolidar-f-07)
(PR #65, Alternativa A de `AUDIT_SET-101_ARQUITETURA_SEMANTICA.md` §7);
implementa a Alternativa C do mesmo §7 (não a B — ver Contexto); reusa
`MarketingMaterialsPage`/`ProductMaterialsCard`/`MaterialPreview`
(`marketing-materials/presentation/*`) sem alteração de comportamento;
depende de ADR-090 (mecanismo de export client-side, inalterado) e de
SET-105 (origem `qrcode` no QR de Materiais, que já tornava Divulgação um
superset funcional dos ativos de Materiais antes desta ADR).

#### Contexto e problema

`AUDIT_SET-101_ARQUITETURA_SEMANTICA.md` §7 (F-07/RED-01) confirmou que
"Materiais" (`/app/paginas/marketing`) e "Divulgação" (`/app/divulgacao`)
não são domínios separados — ambos vivem em
`src/modules/marketing-materials/`, reaproveitando o mesmo registry, os
mesmos 3 formatos e, desde SET-105, a mesma atribuição de origem no QR.
Divulgação já era um superset funcional dos ativos de Materiais; o que
Materiais ainda tinha de exclusivo era (1) navegar os 7 produtos de uma vez
numa biblioteca plana, e (2) um link/QR sem `?src=`.

O Product Owner aprovou, em 2026-08-28, a Alternativa A (manter as duas
rotas, só diferenciar a copy — SET-104) por ser a de menor custo/risco.
Revisitando os mesmos achados numa investigação de código posterior, o
Product Owner reverteu essa decisão e aprovou consolidar num único item de
menu.

#### Alternativas consideradas

1. **Manter a Alternativa A (status quo).** Rejeitada — é a decisão sendo
   revertida por esta ADR.
2. **Alternativa B literal do §7 — "Consolidar totalmente": um único
   fluxo, escolher produto primeiro, depois escolher "biblioteca completa"
   ou "kit por canal".** Rejeitada: regride uma capacidade real — hoje
   Materiais mostra os 7 produtos numa tela só, navegação em lote; a B
   literal exigiria escolher 1 produto antes de poder ver qualquer
   biblioteca, perdendo a visão de conjunto.
3. **Alternativa C — "Aninhar Materiais dentro de Divulgação": Divulgação
   ganha uma sub-rota "ver biblioteca completa"; `/app/paginas/marketing`
   deixa de ser item de menu de topo, mas pode continuar existindo como
   destino interno/deep link.** Escolhida. Preserva 100% do comportamento
   observável de Materiais (mesmo componente, zero regressão), alcança o
   objetivo real da consolidação — um único item de menu, sem domínio
   duplicado — com o menor risco entre as três.

A issue que motivou este trabalho nomeou informalmente "Alternativa B";
esta ADR registra que a forma implementada é, tecnicamente, a Alternativa C
do documento original — a diferença de rótulo importa para quem ler este
histórico depois.

#### Decisão

- `/app/divulgacao` (rota existente, `DivulgacaoFlow` inalterado) ganha um
  link secundário em `ProductStep`: "Ver biblioteca completa".
- `/app/divulgacao/biblioteca` (rota nova) é `/app/paginas/marketing`
  movida para cá — mesmo `MarketingMaterialsPage`, mesma
  `selectAvailableProductsWithMaterials`, mesmo fallback de perfil
  incompleto — mais um link "Voltar para Divulgação". Nenhuma mudança de
  comportamento, só de endereço.
- `/app/paginas/marketing` vira um `redirect('/app/divulgacao/biblioteca')`
  puro — seguro barato contra bookmarks/deep links antigos; nenhuma outra
  referência in-app a essa rota existia.
- `app-navigation.tsx` perde a entrada "Materiais": nav cai de 5 para 4
  itens (Páginas, Divulgação, Contatos, Conta); grid mobile `grid-cols-5` →
  `grid-cols-4`.
- `buildMarketingMaterialPropsWithQrCode` (`material-props.ts`), que já
  estava órfã desde SET-105 (Materiais passou a chamar
  `buildMarketingMaterialPropsForOrigin(..., 'qrcode')`, não mais o
  builder de link sem atribuição), foi removida nesta mesma passagem — não
  havia mais nenhum chamador em produção.

#### Consequências

- Nenhum domínio novo nasce (`src/modules/marketing-materials/` continua
  sendo o único módulo); nenhuma migration; nenhum dado persistido muda.
- `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md` e
  `docs/ROADMAP.md` foram atualizados para descrever a estrutura pós-merge.
  `docs/plans/AUDIT_SET-101_ARQUITETURA_SEMANTICA.md`,
  `docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md` e
  `docs/plans/MARKETING_MATERIALS_PLAN.md` permanecem como registros
  históricos, não editados.
- `tests/e2e/marketing-materials.spec.ts` passa a navegar para
  `/app/divulgacao/biblioteca`; `tests/authenticated-app-consolidation.test.ts`
  perde a asserção da entrada de nav de Materiais e ganha uma cobrindo o
  redirect; `tests/e2e/divulgacao.spec.ts` não muda.
- Todo link/QR de material passa a carregar `?src=` sempre — não existe
  mais nenhum ponto de distribuição de material sem atribuição de origem.

#### Rollback conceitual

Reversão é aditiva-inversa: restaurar a entrada de nav removida (e o
`grid-cols-5`), remover o redirect e devolver `MarketingMaterialsPage` como
conteúdo direto de `/app/paginas/marketing`, apagar a sub-rota
`/app/divulgacao/biblioteca` e o link "Ver biblioteca completa" em
`ProductStep`. Nenhuma migration para reverter — nenhum dado persistido
depende desta decisão.
