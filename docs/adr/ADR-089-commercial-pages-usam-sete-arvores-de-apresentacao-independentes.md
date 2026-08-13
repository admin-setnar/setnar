### ADR-089 — Commercial Pages usam sete árvores de apresentação independentes (SET-78)

**Status:** Accepted — implementação reaberta e incompleta

**Date:** 2026-08-13

**Related:** Supersedes ADR-088; qualifies ADR-080; preserves ADR-055, ADR-057, ADR-067, ADR-068 e ADR-071.

#### Contexto

A primeira implementação da SET-78 converteu os sete templates de
`templates/commercial-pages` em um registro tipado, um shell React único e
widgets isolados, conforme ADR-088. Embora essa composição reduzisse duplicação,
ela também normalizou estrutura, espaçamento, hierarquia, responsividade e
detalhes visuais que fazem parte da experiência específica de cada Produto.

O Product Owner decidiu priorizar a fidelidade integral e a qualidade percebida
de cada página. Neste conjunto fechado de sete Produtos, o custo de manter
markup e CSS próprios é aceito para evitar que uma abstração comum limite ou
homogeneíze o resultado final.

#### Alternativas consideradas

1. **Manter o shell tipado do ADR-088.** Menor duplicação e mudanças globais
   mais simples, mas preserva o risco já observado de perder detalhes próprios
   dos templates ao acomodá-los em uma composição genérica.
2. **Criar variantes sobre um shell comum.** Permite exceções graduais, mas
   mantém o shell como restrição estrutural e tende a acumular condicionais e
   propriedades apenas para recuperar diferenças que já existem nas referências.
3. **Portar sete árvores de apresentação independentes.** Duplica
   intencionalmente markup e CSS de apresentação, mas deixa cada Produto evoluir
   e ser comparado diretamente com seu template de referência. Escolhida.

#### Decisão

Cada um dos sete slugs possui uma árvore React e estilos próprios dentro de uma
pasta identificada pelo Produto. Cabeçalho, hero, seções editoriais, cards, FAQ,
CTA e rodapé podem ser repetidos e hard coded em cada árvore quando isso for
necessário para reproduzir fielmente o template correspondente. Não existe um
shell visual obrigatório entre Produtos, nem um registro de conteúdo responsável
por compor as sete páginas.

A independência é estritamente de apresentação. Não autoriza duplicar regras de
negócio ou fronteiras de segurança. Permanecem únicos e compartilhados:

- resolução de Company, Representative, Product e publicação por Host/slug;
- contrato e caminho seguro de submissão de Leads, incluindo honeypot, validação,
  rate limit, atomicidade e anti-enumeração;
- registro de analytics e metadata/Open Graph dinâmicos;
- política de privacidade e aviso comum de independência da SETNAR;
- tipos de domínio e utilitários sem conhecimento de layout.

Componentes compartilhados só podem existir quando forem infraestrutura neutra
e não impuserem estrutura, copy, hierarquia visual ou CSS comum às sete páginas.
Uma semelhança visual entre templates, por si só, não justifica abstração.

A rota pública e o preview privado continuam renderizando a mesma árvore do
Produto. O ponto compartilhado entre as rotas passa a ser somente o dispatcher
por slug, que seleciona o componente específico e propaga o estado
`leadFormDisabled`; isso qualifica, sem remover, a garantia de paridade do
ADR-080.

Os HTML/CSS/JS em `templates/commercial-pages` continuam sendo referência e não
são servidos nem importados em runtime. GA4 e Meta Pixel não são portados. O
formulário comum mantém os campos nome, telefone, cidade e e-mail opcional, sem
alterar `submit_lead`, schema ou migrations.

#### Consequências positivas

- Cada Produto pode alcançar fidelidade visual, responsiva e comportamental sem
  negociar suas diferenças com uma API de shell genérica.
- O diff de cada página pode ser revisado diretamente contra seu template.
- Alterações específicas deixam de gerar condicionais ou regressões nos outros
  seis Produtos.
- O custo de abstrações prematuras é removido de um catálogo fechado e conhecido.

#### Consequências negativas e riscos aceitos

- Correções visuais realmente comuns podem exigir sete alterações e sete
  validações.
- Markup e CSS repetidos aumentam o volume de código e o risco de divergência em
  acessibilidade, compliance e responsividade.
- Testes precisam cobrir os sete Produtos individualmente em mobile e desktop;
  validar apenas um deles não é evidência para os demais.
- A fronteira entre duplicação visual permitida e duplicação de regra de negócio
  proibida exige revisão explícita em cada mudança.

#### Salvaguardas

- Todos os sete rodapés preservam os três parágrafos de seu template de
  referência — disclaimer do Produto, identificação autorizada e privacidade —
  e acrescentam somente o aviso comum de que a SETNAR é uma plataforma
  independente das empresas representadas. Avisos regulatórios que já façam
  parte do conteúdo original de uma página permanecem em sua posição original;
  não são repetidos no rodapé.
- Todos os sete formulários reutilizam a mesma operação segura de submissão e a
  mesma experiência técnica de loading, erro e sucesso; apenas a apresentação e
  a copy aprovada podem variar.
- Público e preview são testados contra o mesmo dispatcher e o mesmo componente
  específico por Produto.
- Foco, teclado, contraste, headings, `prefers-reduced-motion` e ausência de
  overflow são validados por Produto, não inferidos a partir de um shell comum.

#### Rollback conceitual

Restaurar o registro tipado e o `CommercialPageContent` do ADR-088 e fazer as
duas rotas consumirem novamente essa composição. Não existe rollback de banco,
pois esta decisão não cria migration nem altera contratos persistidos.
