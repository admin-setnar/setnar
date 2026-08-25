### ADR-093 — Calculadora da Conexão Green aplica 10% flat sobre o valor total da conta informado, não sobre uma base compensável deduzida de impostos e taxas

**Status:** Accepted

**Date:** 2026-08-25

**Related:** Substitui parcialmente o comportamento introduzido em SET-78/ADR-088/ADR-089 (`GreenCalculator`, `product-widgets.tsx`); a mudança anterior, no mesmo dia, já havia removido o degrau de 14% para contas acima de R$1.000 (mesmo commit de origem da simplificação para 10% flat), mantendo até então a dedução de base compensável.

#### Contexto

O simulador de desconto da Conexão Green (`GreenCalculator`, usado em
`/conexao-green`, e seu espelho estático em
`templates/commercial-pages/ConexaoGreen/index.html`) não aplicava o
percentual de desconto diretamente sobre o valor da conta informado pelo
usuário. Em vez disso, deduzia primeiro uma "base compensável": subtraía
R$25 de iluminação pública, aplicava 27% de carga tributária (ICMS/PIS/
COFINS) e subtraía R$35 de custo de disponibilidade da distribuidora, para
só então aplicar o percentual de desconto sobre o que restasse. Um
comentário no template estático, escrito pelo próprio Product Owner em
31/07/2026, documentava a razão: "Aplicar o percentual sobre o total da
fatura superestimava a economia entre 48% e 104% conforme a faixa da
conta" — ou seja, a dedução existia para não prometer mais economia do que
o mecanismo real de compensação de energia (Lei nº 14.300/2022) entrega,
já que a compensação incide apenas sobre o consumo de energia, não sobre
impostos e taxas fixas da distribuidora.

Em 2026-08-25, ao testar a página publicada em produção após a remoção do
degrau de 14% (PR #47), o Product Owner reportou que uma conta de R$500
mostrava economia de R$31 — não os R$50 (10% de R$500) esperados. Alertado
de que a diferença vinha da dedução de base compensável (documentada acima,
com histórico de exigir confirmação com a iGreen — ver
`docs/plans/COMMERCIAL_PAGE_CONTENT_PLAN.md` §2.1) e do risco de a
estimativa passar a superestimar a economia real do cliente, o Product
Owner decidiu, ainda assim, remover a dedução e aplicar o percentual
diretamente sobre o valor total informado.

#### Decisão

`GreenCalculator` (`src/modules/representatives/presentation/commercial-pages/product-widgets.tsx`)
e o template estático de referência
(`templates/commercial-pages/ConexaoGreen/index.html`) calculam a economia
como `valor_informado * 10%`, sem nenhuma dedução intermediária de
impostos, iluminação pública ou taxa de disponibilidade. `baseCompensavel`/
`compensable` foram removidos de ambos os arquivos.

O texto de legenda do simulador ("O desconto incide sobre o consumo de
energia — impostos... não entram no cálculo") foi removido por não
descrever mais o cálculo exibido; substituído por uma frase que apenas
descreve o que a tela mostra ("aplicando 10% de desconto sobre o valor
total da sua conta de luz"). O aviso de rodapé da página
(`conexao-green-page.tsx`) foi ajustado no mesmo sentido, mantendo apenas a
remissão geral ao contrato ("Percentual, prazos e condições constam no
contrato assinado.") para os valores reais.

#### Alternativas consideradas

1. **Manter a base compensável** (opção inicialmente recomendada). Rejeitada
   pelo Product Owner: preferiu simplicidade de comunicação (10% do valor
   digitado) à fidelidade ao mecanismo real de compensação.
2. **Aplicar 10% sobre o valor total apenas na exibição, mantendo a base
   compensável em algum cálculo interno.** Não haveria uso para uma base
   compensável calculada e descartada — rejeitada por não corresponder a
   nenhum requisito real.

#### Consequências positivas

- Mensagem mais simples e previsível para o usuário: "sua conta de R$X,
  desconto de 10%, nova conta de R$0,9X" — sem dedução intermediária a
  explicar.
- Um único parâmetro de negócio (`10%`), sem constantes auxiliares
  (`CARGA_TRIBUTARIA`, `ILUMINACAO_PUBLICA`, `CUSTO_DISPONIBILIDADE`) a
  manter sincronizadas entre o widget React e o template estático.

#### Consequências negativas e riscos aceitos

- **A estimativa pode superestimar a economia real do cliente.** O
  comentário original (31/07/2026) estimava essa superestimativa entre 48%
  e 104% dependendo da faixa da conta, na comparação com uma dedução que
  excluía impostos e taxas fixas. Esse risco é aceito explicitamente pelo
  Product Owner nesta decisão, não descoberto e ignorado.
- O rodapé da página não afirma mais, explicitamente, que o desconto real
  incide apenas sobre o consumo de energia — quem quiser esse detalhe
  depende do contrato assinado, não mais do aviso da página.

#### Rollback conceitual

Restaurar `baseCompensavel`/`compensable` (constantes e função) em ambos os
arquivos e reverter a legenda/aviso de rodapé para o texto anterior a esta
ADR — mudança de código isolada, sem migration, sem dado persistido a
reverter.
