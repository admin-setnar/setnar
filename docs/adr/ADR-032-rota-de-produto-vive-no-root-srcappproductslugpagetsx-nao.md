### ADR-032 — Rota de produto vive no root (`src/app/[productSlug]/page.tsx`), não atrás de rewrite em middleware
**Decisão.** Rota dinâmica no nível raiz de `src/app/`, resolução dentro
do Server Component — mesmo padrão de `layout.tsx` (ADR-001), sem tocar
`middleware.ts`. Confirmado contra o código-fonte do Next.js instalado
(`node_modules/next/dist/shared/lib/router/utils/sorted-routes.js`,
`_smoosh`): rotas estáticas sempre vencem uma dinâmica irmã pro mesmo
path, em qualquer Host — o router do Next não tem conceito de virtual
host, então não existe risco de uma rota estática existente (`/entrar`,
`/app` etc.) ser "roubada" pela rota dinâmica de produto. **Alternativa
rejeitada.** Path aninhado com rewrite condicional no middleware —
eliminaria por completo o risco (estreito, hipotético) de colisão futura
entre um slug de produto e uma rota estática nova, mas reintroduziria
resolução em middleware numa base que tem o ADR-001 explicitamente
contra isso, só pra mitigar uma colisão que ainda não existe.
**Mitigação do risco aceito.** `tests/route-collision-guard.test.ts` lê
os slugs de produto direto do comentário da migration e falha o CI se
algum colidir com um nome de rota em `src/app/`. **Lacuna conhecida,
documentada, não resolvida aqui.** Rotas estáticas do root continuam
respondendo em qualquer Host, incluindo subdomínio de representante
(`joao-silva.setnar.com/entrar` renderiza o login do próprio Setnar) —
decisão consciente de não bloquear isso agora, não esquecida
(`src/app/[productSlug]/page.tsx:29-35`). **Custo de reversão.** Baixo —
a URL pública não muda; só o arquivo se move internamente se a colisão
virar problema real.
