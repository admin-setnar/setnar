### ADR-066 — App Shell autenticado e invariante do perfil profissional

**Status:** Accepted
**Date:** 2026-08-06
**Related:** Extends ADR-040/047; supersedes the route composition in ADR-042/046

**Emenda — telefone no cadastro.** `profiles.phone` é um snapshot inicial
anulável, copiado pelo `handle_new_user()` da metadata validada e legível só
pelo proprietário. Ele preenche o onboarding e não é usado por login, página
pública, Analytics ou configurações após a criação do Representative. A fonte
canônica profissional continua sendo `representatives.phone`; contas legadas
podem manter o snapshot nulo.

#### Contexto

`/app` concentrava sessão, conta, onboarding, catálogo, ativações, perfil e
logout em uma única página. Telefone era opcional nas duas escritas de perfil,
embora seja necessário para o CTA e já bloqueasse a acessibilidade pública.
Isso permitia criar e depois manter um Representative estruturalmente
incompleto, sem um caminho claro de correção para legados.

#### Decisão

`src/app/app/layout.tsx` passa a ser a fronteira autenticada server-side e o
App Shell responsivo. Ele carrega apenas a identidade necessária à navegação.
`/app/paginas` carrega onboarding, catálogo, ativações, links e QR Codes;
`/app/conta` carrega perfil profissional, e-mail e logout; `/app` apenas
redireciona para `/app/paginas`. A navegação expõe somente Páginas e Conta.

O telefone comercial passa a ser obrigatório no onboarding e em toda edição,
normalizado para E.164 antes do gateway e novamente validado pela RPC. Um
trigger impede INSERT sem telefone e impede limpar um telefone existente. A
constraint de formato entra `NOT VALID`: legados continuam armazenados sem
backfill fictício, mas recebem mensagem e link para
`/app/conta#perfil-profissional`. `SET NOT NULL` fica adiado até o diagnóstico
chegar a zero.

`profiles.full_name` apenas preenche inicialmente o campo de onboarding. O
usuário confirma ou edita antes da persistência. Depois disso,
`representatives.display_name` é editável e independente; atualizar o nome
público nunca altera `profiles.full_name`.

#### Alternativas consideradas

1. Manter `/app` monolítico: descartado por misturar dados e responsabilidades.
2. Proteger somente no middleware: descartado porque renovação de sessão não é
   autorização final.
3. Aplicar `SET NOT NULL` imediatamente: descartado porque existem legados.
4. Inventar telefone para legados: descartado por integridade e compliance.

#### Consequências

- cada rota carrega apenas seus dados e diferencia vazio de falha;
- publicação bloqueada mantém uma ação corretiva visível;
- novos writes não produzem Representative sem telefone;
- o legado continua autenticado e pode se corrigir sem reescrita automática;
- Desempenho, Preview, Materiais, e-mail e senha permanecem deliberadamente
  ausentes desta etapa.

#### Custo e evolução

A remoção do App Shell é barata no código, mas a invariante de novos writes é
uma decisão de domínio. Quando o diagnóstico de telefones legados retornar
zero, uma migration posterior poderá validar a constraint e só então executar
`ALTER COLUMN phone SET NOT NULL`.
