### ADR-049 — QR Code renderizado no cliente, a partir da URL já resolvida; zero migration (QR1, `docs/QR_ANALYTICS_PLAN.md` §3.1)
**Decisão.** `QrCodeCard` (`src/modules/representatives/presentation/qr-code-card.tsx`),
um Client Component novo, renderiza o QR Code de cada ativação `published`
dentro de `RepresentativeHub`, chamando `toDataURL` da lib `qrcode` sobre a
mesma URL que o hub já compõe (`SITE_URL` + slug do representante + slug do
produto, `representative-hub.tsx:46,74` — nenhuma leitura de hostname nova).
"Baixar" e "copiar link" não precisam de nenhuma infraestrutura própria: o
`data:` URI retornado por `toDataURL` serve tanto de `src` da `<img>` quanto
de `href` de um `<a download>` (um `data:` URI é aceito diretamente pelo
atributo `download`); "copiar link" é `navigator.clipboard.writeText` sobre a
mesma string de URL já exibida na tela.
**Alternativas.** Geração server-side (rota ou Server Action gerando
PNG/SVG via a API Node da mesma lib) foi levantada e não escolhida — ver
`docs/QR_ANALYTICS_PLAN.md` §3.1 para o custo completo de cada opção. O fator
decisivo: o link atrás do QR é estável por construção (regra 12 do
`DOMAIN_MODEL.md` — não muda silenciosamente depois de publicado), então não
há evento de "geração" que precise ficar registrado no servidor no Stage 1;
a regra 11 do `DOMAIN_MODEL.md` ("regenerating creates a new QR Code and
invalidates the previous one") descreve um ciclo de vida que só passa a ter
efeito prático quando o Stage 2 introduzir Smart QR Code apontando para um
link de Campanha que pode mudar de alvo — não é ignorada aqui, só ainda não
tem nada para invalidar.
**Dependência nova.** `qrcode`/`@types/qrcode` — `docs/ENGINEERING_GUIDELINES.md`
pede para preferir API nativa antes de adicionar dependência; gerar QR Code
(correção de erro Reed-Solomon, matriz de módulos) não tem equivalente nativo
no browser nem no Node, então a dependência é justificada independente de
qual das duas opções acima fosse escolhida — a lib roda nos dois ambientes.
**Custo de reversão.** Baixo — nenhuma migration, nenhuma RLS, nenhuma
Server Action. Trocar para geração server-side depois é trocar o componente,
não desfazer schema.
