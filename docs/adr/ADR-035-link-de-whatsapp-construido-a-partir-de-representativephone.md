### ADR-035 — Link de WhatsApp construído a partir de `representative.phone`, sem novo campo/formato
**Decisão.** `WhatsappCta`
(`src/modules/representatives/presentation/whatsapp-cta.tsx`) monta um link
`https://wa.me/<dígitos>?text=<mensagem>` a partir de
`representative.phone` — a mesma URL que todo template original já usava
(`https://wa.me/{{REP_WHATSAPP}}?text=...`,
`templates/commercial-pages/ConexaoGreen/index.html`), só trocando o
placeholder pelo dado real. Nenhuma coluna nova: `representatives.phone`
(`20260731000000_create_representative_domain.sql`) já existia e já era
lido por `LicenseeIdentificationBlock` (ADR-033).
**Por que normalizar os dígitos em vez de assumir um formato salvo.**
`representatives.phone` é `text` livre, sem constraint de formato — `wa.me`
exige só dígitos, com código do país, sem `+`/espaços/pontuação. Assume
Brasil (+55), mesma suposição que `formatPhoneToE164` já faz pro telefone
do formulário de lead (ADR-034) e que o resto do projeto já faz em outros
lugares (janela de CGNAT em ADR-012, copy só em português).
**Não depende do endpoint de leads.** É renderizado direto de
`representative.phone`, já disponível em `RepresentativeActivation`
(ADR-031) — nenhuma chamada de rede adicional, nenhuma dependência de
`submit_lead`/ADR-034.
**Consequência.** Se `representative.phone` for `null`, o componente não
renderiza nada (`if (!representative.phone) return null`) — uma página de
representante sem telefone cadastrado simplesmente não mostra o botão, em
vez de mostrar um link quebrado.
**Custo de reversão.** Baixo — um componente sem estado, sem tabela nova.
