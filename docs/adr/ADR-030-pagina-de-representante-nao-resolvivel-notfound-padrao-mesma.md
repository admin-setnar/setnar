### ADR-030 — Página de representante não resolvível: `notFound()` padrão, mesma URL — não redirect cross-origin
**Decisão.** Quando `resolveRepresentativeActivation` retorna null (host
não é subdomínio de representante válido, produto não existe, ou
activation não está `published`), a rota
(`src/app/[productSlug]/page.tsx:58-60`) chama `notFound()` — reaproveita
`src/app/not-found.tsx`, mantém `<slug>.setnar.com/<produto>` na barra.
Mesma resposta genérica pros três motivos, sem diferenciar — mesmo
princípio anti-enumeração já aplicado nas mensagens de erro de login
deste projeto (ADR-018): alguém testando subdomínios não descobre se um
slug existe, nunca foi publicado, ou está suspenso. **Alternativa
rejeitada.** Redirect cross-origin pra `setnar.com` — destoa do resto do
produto, que evita qualquer coisa que pareça sequestrar a navegação de
alguém (mesma cautela do aviso "não é canal oficial" no rodapé dos
templates). **Custo de reversão.** Baixo.
