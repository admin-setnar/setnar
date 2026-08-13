### ADR-088 — Commercial Pages profissionais compartilham shell tipado e widgets isolados (SET-78)

**Status:** Accepted

**Date:** 2026-08-13

**Related:** ADR-029, ADR-032, ADR-055, ADR-056, ADR-057, ADR-071 e ADR-080.

#### Contexto

Os sete pacotes de `templates/commercial-pages` repetem estrutura, estilos,
formulário, identificação, FAQ, CTA, rodapé e agradecimento, mas trazem copy e
interações próprias por Produto. Servir os arquivos estáticos ou portar sete
árvores de JSX criaria duas fontes de runtime e divergência entre página pública
e preview privado.

#### Decisão

O conteúdo aprovado vive em um registro tipado no domínio de `representatives`,
indexado pelo slug exato do Produto. Um único `CommercialPageContent` compõe
cabeçalho, hero, faixa de confiança, identificação autorizada, formulário,
passos, oferta, FAQ, CTA e rodapé. Página pública e preview continuam consumindo
esse mesmo componente, conforme ADR-080.

Interações que não cabem na configuração ficam em ilhas Client Component
isoladas: categorias do Club, calculadora Green, elegibilidade Livre, pagamento
de Placas, benefícios da Solar, cobertura de Seguros e modalidade/planos de
Telecom. O restante permanece Server Component. Todos convergem para o mesmo
WhatsApp e para o formulário comum já existente.

O `LeadForm` mantém seu payload e sua fronteira de segurança; recebe apenas copy
de botão e agradecimento. Não há campo contextual, alteração de RPC, schema ou
migration. A metadata e a imagem Open Graph dinâmicas do ADR-071 permanecem
inalteradas. `/privacidade` continua canônica, e o rodapé mantém autoria SETNAR,
identificação do representante e aviso de canal não oficial.

A fidelidade visual também pertence ao shell compartilhado: o escopo iGreen
redefine tokens semânticos de superfície, conteúdo, borda, ação e foco, além dos
tons de paleta. Assim, componentes reutilizados não herdam azul ou branco do App
Shell SETNAR. Espaçamento, raios, sombras, faixas, cards e CTAs são portados para
React/Tailwind a partir dos templates, que permanecem somente como referência.
O verde escuro substitui o verde vivo em botões com texto branco para preservar
contraste WCAG AA; o verde vivo continua como acento.

A autorização de marca e a revisão dos claims foram confirmadas pelo Product
Owner em 13/08/2026 para este escopo controlado. Isso não autoriza edição livre
por representantes nem transforma a SETNAR em canal oficial da iGreen.

#### Consequências

- Um novo Produto sem configuração aprovada falha fechado em vez de receber copy
  genérica inventada.
- Alterações no shell afetam público e preview juntas.
- JavaScript fica restrito aos widgets e ao formulário; seções editoriais são
  renderizadas no servidor.
- Os sete conteúdos são revisáveis por diff e não dependem de banco ou editor.
- O E2E verifica os tokens e as cores computadas no navegador em desktop e
  mobile, prevenindo regressão para a identidade do App Shell.
- O custo aceito é um registro de conteúdo extenso, preferível a sete árvores de
  JSX/CSS independentes.

#### Rollback conceitual

Reverter o registro, as seções e widgets compartilhados e restaurar a composição
mínima anterior. Não existe rollback de banco porque nenhuma migration foi criada.
