# UX AUDIT — SETNAR

Auditoria investigativa de UX, conteúdo, redundâncias e clareza, conduzida via navegação real no ambiente local (`http://localhost:3000`), sessão autenticada como Pedro Henrique Arantes Policeno (pedrooswg@gmail.com). Nenhuma alteração de código, conteúdo ou dados foi feita — as duas únicas ações com efeito de estado (despublicar/publicar "Conexão Club") foram revertidas ao final do teste.

---

## Executive Summary

**Telas/fluxos analisados:** 10 — Landing page (seção a seção), modal de cadastro, modal de login, rota `/app` (raiz autenticada), Páginas, Materiais, Divulgação, Contatos, Conta, e uma página pública de produto publicada (Conexão Club).

**Total de problemas confirmados: 18**

| Severidade | Quantidade | Critério |
|---|---|---|
| P0 — Bloqueador | 0 | — |
| P1 — Alta | 4 | Compromete significativamente um fluxo principal |
| P2 — Média | 7 | Fricção perceptível, redundância ou ambiguidade |
| P3 — Baixa | 7 | Melhoria legítima, impacto limitado |

**Redundâncias problemáticas:** 3 · **Ambiguidades:** 6 · **Inconsistências semânticas/nomenclatura:** 3 · **Problemas exclusivos de mobile confirmados:** 0 (viewport mobile não pôde ser testado nesta sessão — ver nota metodológica abaixo).

### Nota metodológica importante — teste mobile não pôde ser concluído

A tarefa pedia repetição dos fluxos principais em viewport de 390×844px. A ferramenta de redimensionamento de janela do navegador não teve efeito nesta sessão — a janela permaneceu travada em 1214×667px (`outerWidth` real: 1600×852) em todas as tentativas, inclusive em uma aba nova. Isso é uma limitação do ambiente de controle do navegador nesta sessão, não um comportamento do produto.

O que foi possível confirmar por inspeção de DOM, sem depender do redimensionamento: existe um botão de menu hambúrguer (`aria-label="Abrir menu"`, classe `md:hidden`) tanto na landing page quanto no cabeçalho autenticado — ou seja, o produto foi construído com um breakpoint mobile em mente. Não foi possível, no entanto, verificar visualmente como esse menu se comporta, se os cards empilham corretamente, se os toques têm área suficiente, ou se algo quebra — nenhum desses pontos deve ser considerado testado. **Recomenda-se repetir a Seção 13 (mobile) com uma ferramenta de emulação funcional ou dispositivo real antes de tirar qualquer conclusão sobre a experiência mobile.** Abaixo, na Tabela de Achados, os itens de risco mobile estão marcados como "inferência" (deduzidos do comportamento desktop já observado, não confirmados em viewport real).

### Principais conclusões

O problema de maior impacto é que o retorno de um usuário já autenticado ao produto está quebrado: o link "Minha conta" da landing page — a forma óbvia de um representante voltar à própria conta — leva a `/app`, uma rota que renderiza em branco, sem redirecionamento, sem mensagem e sem loading state. O usuário só encontra o painel real se souber clicar em "Páginas" no menu lateral, o que não é óbvio na primeira visita.

Ações de mudança de estado nem sempre refletem na interface: despublicar uma página é confirmado num modal bem escrito, mas a lista continua mostrando "Publicado" até o usuário atualizar a página manualmente — o oposto de "publicar", que atualiza na hora. Isso é o tipo de inconsistência que faz o usuário duvidar se a ação funcionou.

Há também redundância funcional real entre "Materiais" e "Divulgação": os dois menus permitem escolher um produto e obter essencialmente a mesma imagem para baixar, organizados por critérios diferentes (formato vs. canal), sem que os próprios nomes dos menus expliquem a diferença — um representante pode perfeitamente repetir a mesma tarefa sem perceber.

Na página pública do produto (a peça mais importante do funil, pois é o que o cliente final vê), dois botões usam exatamente o mesmo texto — "Quero ativar meu Club" — para duas ações diferentes: um abre o WhatsApp, o outro envia um formulário. Esse é o achado mais claro de "componentes iguais representando ações diferentes" encontrado na auditoria.

Por fim, o painel "Suas páginas" instrui o representante a "ativar produtos", repetindo a mensagem de onboarding da landing page ("Escolha um produto"), mas nenhuma tela do produto autenticado apresenta um botão para ativar um novo produto — o primeiro passo do onboarding não tem um ponto de entrada visível nesta conta.

---

## Tabela de Achados

| ID | Sev. | Categoria | Página/Rota | Problema | Evidência | Impacto | Recomendação |
|---|---|---|---|---|---|---|---|
| F-01 | P1 | Navegação | `/app` | Rota raiz autenticada renderiza `<main>` completamente vazio — sem redirecionamento, sem loading, sem mensagem. | Naveguei para `/app` (via clique em "Minha conta" na landing, usuário já logado). Sidebar carrega, área de conteúdo fica em branco indefinidamente. Confirmado por `read_page`: `main [ref_39]` sem filhos. | Usuário que clica em "Minha conta" — o caminho mais óbvio de retorno — cai numa tela morta e pode achar que o app quebrou ou que a conta sumiu. | Redirecionar `/app` para `/app/paginas` (ou uma tela de boas-vindas), nunca deixar em branco. |
| F-02 | P1 | Feedback / Estado | `/app/paginas` | Ao confirmar "Despublicar página" no modal, a página fica indisponível no servidor, mas o card na lista continua mostrando badge "Publicado" e botão "Despublicar" até um reload manual completo. | Testado em "Conexão Club": modal confirmado → screenshot imediato ainda mostra "Publicado"; após `navigate` (reload) para a mesma URL, badge muda para "Despublicado" e botões mudam para "Publicar"/"Ver prévia". A ação inversa ("Publicar") atualiza a UI instantaneamente, sem reload. | Usuário não sabe se a despublicação funcionou; pode clicar de novo, ou ficar em dúvida se a página do cliente ainda está no ar. Ação e feedback claramente assimétricos entre publicar/despublicar. | Atualizar o estado do card localmente (otimista ou via refetch) assim que o modal confirma, igual já acontece ao publicar. Adicionar toast de confirmação. |
| F-03 | P1 | CTA / Ambiguidade | Página pública `/conexao-club` | Dois botões com o texto idêntico "Quero ativar meu Club" executam ações diferentes: um é link para WhatsApp (`wa.me/...`), o outro é `submit` de formulário que salva Nome/Telefone/Cidade/E-mail. | `read_page`: `link "Quero ativar meu Club" href="https://wa.me/5541920028525?..."` (herói) vs. `button "Quero ativar meu Club" type="submit"` (form "Prefere que a gente te chame?"). Mesmo texto, mesmo estilo visual (pílula verde), destinos totalmente diferentes. | Cliente final não consegue prever o resultado do clique pelo texto do botão — pode esperar "deixar contato" e ser redirecionado ao WhatsApp (saindo do site), ou vice-versa. Isso é a página que gera leads e cliques pagos pelo representante; ambiguidade aqui tem custo direto. | Diferenciar o texto: manter "Quero ativar meu Club" só no CTA de WhatsApp e usar algo como "Quero que me chamem" ou "Enviar meus dados" no botão do formulário. |
| F-04 | P1 | Conteúdo / Fluxo | `/app/paginas` | O subtítulo da tela ("Ative produtos, publique páginas e compartilhe seus links") descreve ativar um produto como a ação principal, mas não existe nenhum botão de "Ativar produto" visível em nenhuma tela autenticada (Páginas, Materiais, Divulgação, Contatos, Conta). | `read_page` (filter interactive) na tela Páginas: apenas links de navegação, "7 dias/30 dias", e por card "Copiar link/Abrir site/Gerar QR Code/Despublicar". Nenhum controle de criação/ativação de produto em nenhuma das 5 telas do app. | O primeiro passo do onboarding descrito na própria landing page ("01 Escolha um produto") não tem ponto de entrada visível para um usuário desta conta — não dá para saber se a função existe e está escondida, ou não existe nesta versão. | Adicionar CTA explícito de "Ativar novo produto" na tela Páginas, ou confirmar/documentar onde essa ação deveria estar. |
| F-05 | P2 | CTA / Estado | Landing page (todas as seções) | Usuário já autenticado (sessão ativa) continua vendo "Começar gratuitamente", "Entrar" e "Criar minha conta" — CTAs de novo cadastro — em vez de algo como "Ir para o painel". | Com sessão ativa (pedrooswg@gmail.com), a landing renderiza normalmente hero/preços/CTA final com os mesmos textos de cadastro; apenas "Minha conta" no header distingue o estado logado (e leva à tela em branco do F-01). | Representante que já é cliente pode clicar "Criar minha conta" por engano, achando que precisa recadastrar, ou fica em dúvida se está de fato logado. | Detectar sessão ativa e trocar os CTAs principais por "Ir para o painel"/"Minhas páginas". |
| F-06 | P2 | Feedback | `/app/*` (Páginas, Materiais, Divulgação, Contatos) | Transições entre itens do menu lateral não mostram indicador de carregamento; o conteúdo da tela anterior permanece visível e estático por ~1–2s após o clique antes de trocar. | Reproduzido em 3 transições diferentes (Páginas→Materiais, Materiais→Divulgação, Divulgação→Contatos): clique registra a navegação (URL muda, confirmado via `window.location.href`), mas o conteúdo renderizado só atualiza após espera adicional; sem skeleton/spinner nesses casos (ao contrário de "Contatos", que mostrou skeleton). | Usuário pode achar que o clique não funcionou e clicar de novo, ou navegar para outro item achando que travou. | Padronizar um estado de carregamento (skeleton ou spinner) em todas as transições de rota do app, não só em algumas. |
| F-07 | P2 | Redundância funcional | `/app/paginas/marketing` (Materiais) vs. `/app/divulgacao` | "Materiais" e "Divulgação" resolvem a mesma tarefa (obter uma imagem/link para divulgar um produto) por dois caminhos diferentes, sem que os nomes dos menus deixem clara a diferença de propósito. | Em Materiais → Conexão Club → aba "Poster com QR Code": mesma imagem PNG e mesmo botão "Baixar PNG" encontrados em Divulgação → Conexão Club → canal "Link direto/QR Code". Em Divulgação → canal "Instagram — Post", a imagem é idêntica à aba "Post para redes sociais" de Materiais, com o acréscimo de um texto de legenda e link rastreado. | Representante pode repetir a mesma tarefa duas vezes sem perceber que já tinha o material, ou não saber qual dos dois menus usar da próxima vez. | Unificar em um único fluxo ("escolha o produto → escolha o formato/canal") ou renomear os menus para deixar a diferença de propósito explícita (ex.: "Materiais" = biblioteca de artes; "Divulgação" = passo a passo guiado com texto pronto). |
| F-08 | P2 | Redundância / Ambiguidade | Páginas, Materiais(Poster), Divulgação(Link direto) | O link/QR Code do produto pode ser copiado em 3 lugares diferentes, e pelo menos um deles adiciona parâmro de rastreio (`?src=instagram_post`) sem explicação em nenhuma tela. | Card "Conexão Club" em Páginas: `link "Abrir site" href=".../conexao-club"` (sem parâmetros). Divulgação → Instagram Post: texto copiável contém `.../conexao-club?src=instagram_post`. Nenhuma tela explica a existência ou a finalidade desse parâmetro. | Representante que compara os dois links pode achar que estão quebrados/diferentes por engano, ou perder a atribuição por copiar sempre o link "errado" para o canal. | Adicionar uma nota curta explicando que o link de Divulgação inclui rastreio por canal, ou unificar os pontos de cópia de link em um único componente reutilizado. |
| F-09 | P2 | Nomenclatura | Páginas (contadores), Contatos, Landing page | "Contato", "Lead" e "Clique no WhatsApp" são usados como conceitos relacionados mas distintos, sem nenhuma tela que explique a diferença. | Cards de página mostram "Visitas · Cliques no WhatsApp · Leads" como 3 métricas separadas. Tela "Contatos" define lead como "quando alguém preencher o formulário de uma página publicada". A landing page, porém, anuncia "Contato direto: fala com você, não com um formulário genérico" e ilustra "lead" com um toast de "chamou você no WhatsApp agora" — sugerindo que clique no WhatsApp também é um tipo de "contato". | Representante pouco técnico pode não entender por que o número de "Leads" é diferente do de "Cliques", ou esperar que toda mensagem de WhatsApp apareça na tela "Contatos" (ela não aparece — só quem preenche o formulário aparece lá). | Adicionar um tooltip/legenda curta nos contadores explicando a diferença, e alinhar a copy da landing page para não sugerir que WhatsApp é "contato" no mesmo sentido da tela Contatos. |
| F-10 | P2 | Inconsistência de dados | Conta → Perfil profissional vs. página pública | O campo "Nome público" em Conta está preenchido com "Pedro Henrique Arantes Policeno" ("Como você aparece nas suas páginas"), mas a página pública publicada exibe o nome abreviado "Pedro Policeno". | Conta: campo "Nome público" = "Pedro Henrique Arantes Policeno". Página pública `/conexao-club`: cabeçalho e seção "Quem vai te atender" mostram "Pedro Policeno". | O texto de ajuda promete controle total sobre o nome exibido publicamente, mas o valor exibido diverge do configurado — pode gerar desconfiança sobre o que mais na página não reflete as configurações da conta. | Investigar se há uma regra de truncamento não documentada e, se sim, explicitar isso no campo (ex.: "seu nome pode ser abreviado nas páginas"); caso seja bug, corrigir a renderização. |
| F-11 | P2 | Redundância de dados | Conta | Nome completo e E-mail aparecem duplicados em cards diferentes da mesma tela, ambos pré-preenchidos com o mesmo valor, sem explicação da diferença de propósito. | Card "Perfil profissional": campo "Nome público" = nome completo. Card "Assinatura": campo "Nome completo" = mesmo valor (para dados de cobrança). "E-mail" aparece de novo em "Assinatura" e novamente (somente leitura) em "Dados de acesso". | Usuário pode se perguntar se precisa manter os dois campos sincronizados manualmente, ou por que preencheu a mesma informação duas vezes. | Adicionar rótulos que expliquem a distinção (“nome exibido no site” vs. “nome para nota fiscal/cobrança”) ou usar o mesmo valor automaticamente com opção de editar só quando necessário. |
| F-12 | P3 | Conteúdo | Conta | Não há nenhuma opção visível de alterar senha — a seção "Dados de acesso" só mostra e-mail e o botão "Sair". | Rolagem completa da tela Conta; último elemento antes do rodapé lateral é o botão "Sair". Nenhum link/botão de "Alterar senha" encontrado. | Usuário que quer trocar a senha não tem onde fazer isso dentro da conta (pode existir apenas via "Esqueci minha senha" no login, o que não é óbvio). | Adicionar opção de alteração de senha na seção "Dados de acesso", ou linkar explicitamente para o fluxo de redefinição. |
| F-13 | P3 | Hierarquia / Affordance | Páginas | O título do produto em cada card (ex. "Conexão Club") tem aparência de link/cabeçalho clicável (negrito, destaque), mas não é interativo — não existe editor de página acessível a partir daí. | Clique no texto "Conexão Club" no card: URL permanece `/app/paginas`, nenhuma mudança de estado ou navegação. | Usuário vindo de outros SaaS pode tentar clicar no nome do produto esperando editar a página, sem sucesso e sem feedback do porquê. | Se não houver edição de conteúdo prevista, considerar reduzir o peso visual do título ou adicionar `cursor: default` claro; se houver edição prevista futuramente, é um gap a mapear. |
| F-14 | P3 | Estado / Ambiguidade | Páginas → modal "Gerar QR Code" | O título do modal é genérico ("QR Code da sua página"), sem repetir o nome do produto ao qual pertence. | Modal aberto a partir do card "Conexão Club" mostra apenas "QR Code da sua página" / "Escaneie para acessar sua página." — nenhuma menção a "Conexão Club" no modal. | Ao abrir QR Codes de produtos diferentes em sequência, é fácil perder a referência de qual QR pertence a qual produto sem reler o QR visualmente. | Incluir o nome do produto no título do modal (ex.: "QR Code — Conexão Club"). |
| F-15 | P3 | Acessibilidade | Página pública `/conexao-club` | O nome acessível do botão de WhatsApp no cabeçalho ("Falar agora no WhatsApp") não corresponde ao texto visível ("Falar no WhatsApp"). | `read_page`: `link "Falar agora no WhatsApp" [ref_3]`; texto renderizado na tela: "Falar no WhatsApp". | Viola a boa prática de "Label in Name" (WCAG 2.5.3) — usuários de comando de voz/leitor de tela que citam o texto visível podem não ativar o controle corretamente. | Igualar o texto visível e o `aria-label`. |
| F-16 | P3 | Acessibilidade | Página pública `/conexao-club` (formulário) | Um campo "honeypot" anti-spam ("Não preencha isto:") aparece na extração de texto/acessibilidade da página, sugerindo que pode não estar oculto corretamente para leitores de tela. | `get_page_text` no formulário "Prefere que a gente te chame?" retornou a linha "Não preencha isto:" entre os campos do formulário. | Usuário de leitor de tela pode ouvir um campo sem propósito claro e tentar preenchê-lo, quebrando a proteção anti-spam ou causando confusão. | Confirmar que o campo honeypot usa técnica acessível (ex.: `aria-hidden="true"` + `tabindex="-1"`, não apenas oculto visualmente). |
| F-17 | P3 | Acessibilidade | `/app` (todas as telas autenticadas) | A árvore de acessibilidade expõe dois landmarks de navegação idênticos ("Navegação da conta") simultaneamente — um dentro de `complementary` (sidebar) e outro dentro de `banner` (provavelmente o cabeçalho mobile). | `read_page` (filter all) em `/app`: dois blocos `navigation "Navegação da conta"` com os mesmos 5 links, um sob `complementary [ref_11]`, outro sob `banner [ref_26]`. | Usuários de leitor de tela navegando por landmarks ouvem "Navegação da conta" duas vezes sem diferenciação, dificultando saber qual usar. | Dar nomes acessíveis distintos aos dois landmarks (ex.: "Navegação principal" vs. "Menu mobile") ou garantir que apenas um esteja no DOM/exposto por vez conforme o breakpoint. |
| F-18 | P3 | Conteúdo / Posicionamento | Landing page (hero, recursos, footer) | O produto é descrito com três metáforas diferentes em pontos próximos da mesma página: "escritório digital" (eyebrow do hero), "página de vendas profissional" (H1) e "ferramentas de presença digital e organização comercial" (tagline do rodapé). | Textos extraídos via `get_page_text`: "ESCRITÓRIO DIGITAL PARA REPRESENTANTES INDEPENDENTES" (topo) vs. "Sua página de vendas profissional, pronta hoje." (H1) vs. "Ferramentas de presença digital e organização comercial para profissionais que vendem por conta própria." (rodapé). | Não impede a tarefa, mas dificulta formar um modelo mental único do que é o Setnar logo na primeira leitura — é uma página, um escritório, ou um conjunto de ferramentas? | Escolher uma metáfora principal (ex.: "sua página comercial") e usá-la de forma consistente no eyebrow, H1 e rodapé. |
| F-19* | — | Mobile (inferência, não confirmada) | Materiais, Divulgação | Ambas as telas empilham verticalmente um card completo (imagem + 3 abas + botão) por produto ativo — 7 cards no total nesta conta — sem seletor/atalho para pular entre produtos. | Confirmado em desktop (1214px): rolagem de ~6 "ticks" de scroll só para passar de um produto ao próximo. Nenhum índice, busca ou dropdown de produto encontrado nas duas telas. | Em viewport mobile, essa mesma estrutura deve exigir rolagem consideravelmente maior para o mesmo resultado, agravando o problema já presente no desktop. | Adicionar seletor de produto (dropdown/abas) no topo das telas Materiais e Divulgação, em vez de empilhar todos os produtos. Confirmar severidade real em teste mobile genuíno. |
| F-20* | — | Mobile (inferência, não confirmada) | Páginas (cards de produto) | Cada card tem uma linha de 3 botões lado a lado ("Copiar link", "Abrir site", "Gerar QR Code") que já ocupa quase toda a largura útil do conteúdo em desktop. | Medido visualmente: a linha de botões ocupa ~366px de um container de ~868px de largura útil em desktop, com textos e ícones, sem indício de wrap configurado. | Em 390px de largura, essa linha de 3 botões tende a quebrar de forma não controlada ou exigir textos cortados — não confirmado, mas é um candidato de alto risco para o teste mobile pendente. | Priorizar este componente no teste mobile real; considerar empilhar ou reduzir para ícones com rótulo em telas estreitas. |

\* F-19 e F-20 são riscos inferidos do comportamento em desktop, não problemas confirmados em viewport mobile real — ver nota metodológica. Não contam nos totais de severidade do resumo executivo.

---

## Redundancy Map

**RED-01**
Onde aparece: Materiais (por produto → Post/Story/Poster) · Divulgação (por produto → canal → resultado)
Informação/ação repetida: Mesma arte final (PNG) e mesmo botão "Baixar PNG" para o mesmo produto, alcançáveis por dois caminhos de navegação diferentes.
Classificação: **PROBLEMÁTICA**
Justificativa: Os nomes dos menus ("Materiais" vs. "Divulgação") não comunicam a diferença real de propósito (biblioteca por formato vs. fluxo guiado por canal com texto pronto). Um usuário pode não perceber que já obteve o material equivalente pelo outro caminho.
Recomendação: **Consolidar** em um único fluxo com duas etapas claras (produto → "o que você quer: baixar a arte, ou preparar um post pronto com texto e link?"), ou **renomear** os menus para deixar o critério de organização explícito.

**RED-02**
Onde aparece: Páginas (botão "Abrir site"/"Copiar link") · Materiais (aba "Poster com QR Code") · Divulgação (canal "Link direto/QR Code")
Informação/ação repetida: Obter o link/QR Code de um produto — em três lugares, com uma das versões incluindo parâmetro de rastreio não explicado.
Classificação: **PROBLEMÁTICA**
Justificativa: A duplicação em si poderia ser NEUTRA (manter o link acessível em vários contextos é conveniente), mas a diferença silenciosa entre um link "limpo" e um link rastreado, sem nenhuma explicação em nenhuma das três telas, é o que torna o caso problemático.
Recomendação: **Reposicionar/documentar** — manter os pontos de acesso, mas adicionar uma nota curta em Divulgação explicando que aquele link inclui rastreio por canal.

**RED-03**
Onde aparece: Conta → card "Perfil profissional" (Nome público) e card "Assinatura" (Nome completo, E-mail) e card "Dados de acesso" (E-mail)
Informação/ação repetida: Nome completo do representante e e-mail cadastrado, exigidos/exibidos em campos separados dentro da mesma tela.
Classificação: **NEUTRA** (com potencial de virar problemática)
Justificativa: Nome público (exibição) e nome de cobrança são conceitos legitimamente diferentes (o segundo pode divergir para razão social/CPF/CNPJ), e mostrar o e-mail de acesso ao lado do botão "Sair" é razoável. O problema não é a duplicação em si, mas a ausência de qualquer texto explicando por que os campos existem separadamente.
Recomendação: **Manter os campos**, mas **renomear/adicionar texto de apoio** que explique a diferença de propósito entre "nome público" e "nome para cobrança".

**RED-04**
Onde aparece: Landing page — CTA "Começar gratuitamente" (hero) e "Criar minha conta" (seção Preços e seção final)
Informação/ação repetida: Abrir o mesmo modal de cadastro.
Classificação: **BENÉFICA**
Justificativa: CTA repetido ao longo do scroll é uma prática reconhecida para reduzir a distância até a conversão; os textos variam de forma coerente com o contexto (energia/urgência no hero, reforço direto no final) e sempre levam ao mesmo modal, sem ambiguidade.
Recomendação: **Manter.**

**RED-05**
Onde aparece: Landing page — disclaimer legal na seção final (fundo escuro) e no rodapé
Informação/ação repetida: Aviso de que o Setnar é uma plataforma independente, não canal oficial das marcas representadas.
Classificação: **BENÉFICA**
Justificativa: Reforço de um aviso legal relevante em dois pontos de saída da página (antes de converter e no rodapé) é apropriado e não gera confusão — os textos são ligeiramente diferentes mas consistentes em conteúdo.
Recomendação: **Manter**; opcionalmente unificar a redação exata das duas versões por consistência.

---

## Terminology Map

| Conceito | Termos encontrados | Onde aparecem | Recomendação |
|---|---|---|---|
| A entidade que o representante publica para um produto | "página", "página comercial", "página de vendas profissional", "página pública" | Landing page (H1, subtítulo), menu "Páginas", cards de produto | Adotar **"página"** como termo único e canônico (já é o mais usado e o mais simples de entender); evitar variações como "página de vendas profissional" fora do hero de marketing. |
| O que o Setnar é, como categoria de produto | "escritório digital", "ferramentas de presença digital e organização comercial", "plataforma independente de ferramentas de vendas" | Landing page (eyebrow, rodapé, disclaimer) | Unificar em torno de **"sua página comercial"** ou **"presença digital para representantes"** — evitar a metáfora de "escritório" competindo com a de "página" na mesma leitura. |
| Pessoa que demonstrou interesse preenchendo o formulário | "lead", "contato" | Cards de estatística ("Leads"), menu "Contatos", tela "Contatos" ("pessoas que pediram contato") | Escolher **um** termo — "contato" é mais compreensível para um usuário não técnico do que "lead" (anglicismo). Sugestão: usar "Contatos" em toda a interface e reservar "lead" apenas em contextos internos/técnicos, se necessário. |
| Alguém que clicou no botão do WhatsApp (mas não necessariamente preencheu formulário) | "clique no WhatsApp", "novo contato" (toast da landing) | Estatísticas de página ("Cliques"), toast ilustrativo da landing ("Novo contato: chamou você no WhatsApp agora") | Evitar chamar um clique no WhatsApp de "contato" na landing page, já que "Contato" tem um significado mais específico (formulário) dentro do produto — usar "alguém chamou você no WhatsApp" sem a palavra "contato" para não colidir com o conceito da tela Contatos. |
| O documento com dados de contato preenchido pelo visitante da página pública | "formulário" | Página pública ("Prefere que a gente te chame? Deixe seus dados..."), tela Contatos ("preencher o formulário de uma página publicada") | A landing page evita a palavra "formulário" ao vender o produto ("não com um formulário genérico"), mas o produto usa formulário de fato. Ajustar a copy de marketing para não sugerir a ausência total de formulários — ex.: "fala direto com você, sem intermediário de uma central de atendimento". |
| Materiais para divulgar um produto em redes sociais | "materiais", "divulgação", "post", "story", "poster" | Menu "Materiais", menu "Divulgação", abas dentro de cada um | Ver RED-01 — os dois menus tratam do mesmo domínio de conceito com nomes que não deixam clara a fronteira entre eles. |
| Ligação para a página pública, com ou sem rastreio | "link", "link direto", "copiar link" | Páginas, Materiais, Divulgação | Ver RED-02 — mesmo termo ("link"/"copiar link") usado para uma URL simples e para uma URL com parâmetro de rastreio, sem diferenciação textual. |

---

## Flow Friction

### Fluxo 1 — Voltar à conta a partir da landing page (usuário já autenticado)

**Objetivo do usuário:** Acessar o próprio painel a partir do site público, por já ter uma conta.

**Caminho atual:** Landing page → clique em "Minha conta" (header) → `/app` → tela em branco (só sidebar) → usuário precisa descobrir e clicar em "Páginas" no menu lateral → `/app/paginas` (painel real).

**Fricções encontradas:** A rota de destino direto (`/app`) não tem conteúdo nem redireciona (F-01). Não há nenhuma indicação visual de que o clique funcionou, além da URL mudar.

**Passos potencialmente desnecessários:** Nenhum passo a mais é exigido do usuário, mas o passo intermediário (tela em branco) não deveria existir — é um destino sem função própria.

**Melhoria sugerida:** Fazer `/app` redirecionar automaticamente para `/app/paginas` (ou para uma tela de boas-vindas/resumo, se uma for criada no futuro).

---

### Fluxo 2 — Divulgar um produto ativo em uma rede social

**Objetivo do usuário:** Conseguir uma imagem pronta com texto e link para postar no Instagram sobre um produto específico.

**Caminho atual (via Materiais):** Páginas → menu "Materiais" → localizar o card do produto (rolagem, sem atalho) → aba "Post para redes sociais" → "Baixar PNG" → (sair do Setnar para escrever a legenda manualmente, pois Materiais não oferece texto pronto).
**Caminho alternativo (via Divulgação), que entrega mais no mesmo lugar:** Páginas → menu "Divulgação" → escolher produto → escolher canal "Instagram — Post" → imagem + legenda pronta + link rastreado + "Copiar texto"/"Baixar PNG"/"Compartilhar".

**Fricções encontradas:** Nada informa ao usuário, a partir do menu lateral, que "Divulgação" entrega um resultado mais completo que "Materiais" para o mesmo objetivo — um usuário pode escolher "Materiais" (o nome mais intuitivo para "quero uma imagem") e sair sem o texto pronto, tendo que voltar e refazer o processo em "Divulgação" para consegui-lo.

**Passos potencialmente desnecessários:** A existência de dois pontos de entrada distintos para o mesmo objetivo final é, em si, uma etapa de decisão desnecessária ("qual menu eu uso?").

**Melhoria sugerida:** Ver RED-01 — consolidar em um fluxo único, ou deixar claro, já no menu lateral ou na tela "Materiais", que "Divulgação" é o caminho recomendado quando se quer texto + link prontos.

---

### Fluxo 3 — Despublicar uma página temporariamente

**Objetivo do usuário:** Tirar uma página do ar (por exemplo, produto fora de estoque) com segurança de que a ação foi concluída.

**Caminho atual:** Páginas → card do produto → "Despublicar" → modal de confirmação ("A página deixará de ficar disponível publicamente...") → "Despublicar página" → modal fecha → card **continua mostrando "Publicado"** → usuário precisa recarregar a página manualmente para ver o novo estado real ("Despublicado").

**Fricções encontradas:** A confirmação em si é exemplar (copy clara, ação reversível explicada, botão destrutivo em vermelho) — o problema é inteiramente pós-confirmação: ausência de atualização de estado e de qualquer toast de sucesso (F-02).

**Passos potencialmente desnecessários:** Nenhum — o problema não é ter passos demais, é a falta de confirmação visual ao final de um passo que já existe.

**Melhoria sugerida:** Atualizar o card imediatamente após a confirmação (mesmo comportamento já existente no botão "Publicar"), e adicionar um toast curto ("Conexão Club foi despublicada").

---

## Quick Wins

Mudanças pequenas, de baixo risco, com benefício claro, sem exigir mudança arquitetural:

1. **Problema:** `/app` renderiza em branco → **Mudança:** redirecionar `/app` para `/app/paginas` → **Benefício esperado:** elimina o principal ponto morto de navegação encontrado na auditoria (F-01), sem tocar em nenhuma outra tela.

2. **Problema:** Card de página não atualiza após "Despublicar" → **Mudança:** reaproveitar a mesma lógica de atualização já usada em "Publicar" para o botão "Despublicar" → **Benefício esperado:** elimina a principal fonte de dúvida sobre se uma ação funcionou (F-02).

3. **Problema:** Modal de QR Code não identifica o produto → **Mudança:** incluir o nome do produto no título do modal ("QR Code — Conexão Club") → **Benefício esperado:** elimina a chance de confundir QR Codes de produtos diferentes (F-14).

4. **Problema:** `aria-label` do botão de WhatsApp diverge do texto visível → **Mudança:** igualar os dois textos → **Benefício esperado:** conformidade com WCAG 2.5.3 sem qualquer mudança visual (F-15).

5. **Problema:** Dois botões idênticos ("Quero ativar meu Club") levam a ações diferentes na página pública → **Mudança:** trocar o texto do botão do formulário para algo como "Enviar meus dados" → **Benefício esperado:** elimina a ambiguidade de maior risco de conversão encontrada na auditoria (F-03), com uma troca de string.

6. **Problema:** Landing page não distingue visitante novo de usuário já logado → **Mudança:** se houver sessão ativa, trocar "Começar gratuitamente"/"Entrar" por um único CTA "Ir para o painel" → **Benefício esperado:** reduz confusão para representantes que já são clientes e voltam à landing (F-05).

---

## Recommended Next Step

**Implementar primeiro** (achados suficientemente comprovados e de baixo risco):
- F-01 — Redirecionar `/app` para `/app/paginas`.
- F-02 — Corrigir atualização de estado após "Despublicar".
- F-03 — Diferenciar o texto dos dois botões "Quero ativar meu Club" na página pública.
- F-14 — Nomear o produto no título do modal de QR Code.
- F-15 — Igualar `aria-label` e texto visível do botão de WhatsApp.
- F-16 e F-17 — Revisão de acessibilidade do honeypot e dos landmarks duplicados.

**Investigar antes de implementar** (achados reais cuja solução exige decisão de produto/UX):
- F-04 — Confirmar se "ativar novo produto" é uma funcionalidade que existe e está mal posicionada, ou que ainda não foi construída; a resposta muda completamente a prioridade.
- F-07 / RED-01 — Decidir, como time de produto, se "Materiais" e "Divulgação" devem ser unificados ou apenas renomeados/diferenciados — envolve uma decisão de arquitetura de informação, não só de copy.
- F-09 — Alinhar a definição de "contato"/"lead"/"clique" entre marketing (landing) e produto (painel) — decisão de posicionamento, não só de string.
- F-10 — Investigar a causa técnica da divergência entre "Nome público" configurado e o nome exibido na página pública antes de decidir a correção.
- F-11 — Decidir se os campos duplicados de nome/e-mail em Conta devem ser unificados, mesclados automaticamente, ou apenas melhor explicados.
- F-19 / F-20 — Repetir o teste em viewport mobile real antes de priorizar qualquer mudança de layout.

**Não alterar** (redundâncias ou comportamentos que parecem estranhos à primeira vista, mas têm justificativa funcional):
- RED-04 — CTAs de cadastro repetidos ao longo da landing page (prática de conversão válida).
- RED-05 — Disclaimer legal repetido no fim da landing page e no rodapé.
- O modal de confirmação de "Despublicar" em si (copy e padrão visual) — está correto; o problema está apenas no que acontece depois de confirmado (ver F-02).
- A existência de campos de "Nome de cobrança" separados de "Nome público" em Conta — legitimamente podem divergir (ex.: razão social); o que precisa de ajuste é a explicação, não a estrutura (ver RED-03).
