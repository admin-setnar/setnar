### ADR-033 — Identificação do licenciado é componente estrutural; Subscription é tabela própria desde já, gerenciada manualmente até o gateway existir
**Decisão.** `LicenseeIdentificationBlock`
(`src/modules/representatives/presentation/licensee-identification-block.tsx`)
é um componente próprio, não conteúdo inlined na página — o próprio
comentário do arquivo documenta por quê: é o único bloco que os 7
templates de origem repetem (`grep -rn "Quem vai te atender"
templates/commercial-pages/`), então nasce pronto pra virar layout
compartilhado assim que existir mais de uma página de produto, sem
precisar ser tocado — mesmo raciocínio de denormalizar em vez de
duplicar que motivou ADR-027. `subscriptions`
(`supabase/migrations/20260731000000_create_representative_domain.sql:274-292`,
status active/past_due/suspended/canceled, provider,
external_subscription_id, current_period_end) já nasce no vocabulário
que um gateway real usaria — gerenciada manualmente (`provider =
'manual'` por padrão) até a cobrança automatizada existir, sem RLS
policy nenhuma (mesmo padrão de `login_attempts`: acessível só por
função `SECURITY DEFINER` futura, que ainda não existe — ver o
comentário da migration nas linhas 79-91). **Correção ao texto
original.** Não encontrei, no repositório, nenhum bug documentado de "ID
hardcoded" nos templates originais — os 7 templates usam `{{REP_ID}}`
como placeholder (`templates/commercial-pages/ConexaoGreen/index.html`,
linhas 45/61-62/145/164/352/564/587), não um valor fixo. Essa alegação
foi removida; a justificativa de denormalização (ADR-027) já sustenta a
decisão sem depender dela. **Custo de reversão.** Baixo — a tabela já
nasce no formato que o gateway real vai preencher.
