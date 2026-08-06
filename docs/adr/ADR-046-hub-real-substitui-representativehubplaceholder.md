### ADR-046 — Hub real substitui `RepresentativeHubPlaceholder`; o link público compõe-se de `SITE_URL`, não de uma nova leitura de hostname (D5.3)
**Decisão.** `RepresentativeHub` (`presentation/representative-hub.tsx`)
substitui `RepresentativeHubPlaceholder` em `/app`. Para cada ativação
`published`, mostra `<slug>.<rootHost>/<productSlug>`, onde `rootHost` é
`new URL(SITE_URL).hostname` (`config/site.ts` — `setnar.com` por padrão, ou
`NEXT_PUBLIC_SITE_URL`). Sem QR Code, sem analytics — Stage 1 do ROADMAP,
fora deste elo, conforme o próprio plano.
**A lacuna que fecha.** O comentário do próprio
`RepresentativeHubPlaceholder` já registrava: nada em
`TenantClientView`/`useTenant()` expõe o hostname raiz. `/app` é sempre
visitado no domínio raiz — nunca no subdomínio do próprio representante —
então não existe `Host` de requisição para ler aqui, ao contrário de
`extractRepresentativeSlug` (que resolve a direção oposta, subdomínio →
slug, para uma página pública). A composição usa `SITE_URL` porque esse já é
o único lugar do projeto que define o domínio raiz canônico
(`buildTenantMetadata`/`config/seo.ts` já constroem `openGraph.url` a partir
da mesma constante) — nenhuma abstração nova em `tenancy/` foi criada só
para isto.
**Por que não adicionar um campo a `Tenant`.** Cogitado e descartado: um
`tenant.rootHostname` duplicaria `SITE_URL` como segunda fonte da mesma
informação, sem nenhum consumidor que precise dela por `Tenant`
especificamente — o único uso é este link, e ele já tem `SITE_URL`
disponível sem passar por `resolveTenant()`.
**Custo de reversão.** Baixo — a composição do link é uma linha dentro de
`RepresentativeHub`; removê-la não afeta o resto do hub.
