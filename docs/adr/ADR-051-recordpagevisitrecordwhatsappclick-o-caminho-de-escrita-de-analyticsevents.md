### ADR-051 — `record_page_visit`/`record_whatsapp_click`, o caminho de escrita de `analytics_events`; resolvem por slug+slug, nunca por id (AN2 + AN4, `docs/QR_ANALYTICS_PLAN.md` §3.2/§3.6)
**Decisão.** Uma migration só
(`supabase/migrations/20260811000000_add_analytics_write_functions.sql`)
cria as duas funções `SECURITY DEFINER` que escrevem em `analytics_events`
(AN1) — `record_page_visit` (`event_type = 'visit'`) e
`record_whatsapp_click` (`event_type = 'whatsapp_click'`) — mesma forma de
`submit_lead`: retorno `boolean` anti-enumeration, limiares de rate limit
como literais fixos (nunca parâmetro do chamador — ADR-036), `revoke ...
from public` + `grant execute ... to anon, authenticated` explícito, nunca
dependendo de `ALTER DEFAULT PRIVILEGES` (ADR-048). Uma migration para as
duas, não duas: mesma forma exata, revisadas como uma unidade ("AN2 + AN4"),
compartilhando o helper de bot abaixo — diferente de
`submit_lead`/`20260802000000`, que são a MESMA função em dois momentos no
tempo (criação e correção), não duas funções irmãs nascendo juntas.
**Resolvem por slug+slug, nunca por id — diferente de `submit_lead`.**
`submit_lead` recebe ids porque seu chamador (`/api/leads/route.ts`) já
resolveu a ativação a partir do `Host` antes de chamar o RPC. Aqui a escolha
é `p_representative_slug`/`p_product_slug` — os dois textos públicos que
qualquer visitante já conhece só de estar na página (subdomínio =
`representatives.slug`, ADR-026; segmento de path = `products.slug`) — e a
função faz a resolução inteira sozinha. Não esconde nada que já não fosse
público (`representatives_select_public`/`product_activations_select_published`
já expõem esses ids a qualquer chave publicável); a vantagem é a checagem
ficar autocontida, sem herdar confiança de uma resolução feita em outro
lugar do código.
**Filtro de bot (§3.2) estendido às duas funções — mesma decisão, não uma
segunda.** `is_bot_user_agent(text)`, helper novo (`language sql immutable`,
não `security definer` — não lê tabela nenhuma), com a lista de substrings
do plano (`bot`, `crawler`, `spider`, `facebookexternalhit`, `whatsapp`)
mais três adicionadas aqui (`curl`, `python-requests`, `headlesschrome`).
Uma chamada filtrada retorna `true` sem inserir e sem consumir rate limit —
nunca `false` — mesmo anti-enumeration de `submit_lead`, ao contrário: um
retorno diferente de uma inserção real permitiria a um bot descobrir, por
tentativa, quais substrings a lista contém.
**Dois limiares, motivos distintos.** `record_page_visit`: 60/60s — evento
passivo, volume maior esperado, janela curta cobre navegação rápida
legítima entre produtos do mesmo representante sem esbarrar no limite.
`record_whatsapp_click`: 5/3600s — DELIBERADAMENTE o mesmo par de
`submit_lead` (`20260802000000`), não um número novo: `DOMAIN_MODEL.md`
(Lead Attribution Service) descreve um clique no WhatsApp como um
"conversion-intent Visitor Event", mesma classe de ação deliberada que já
justificou o limiar de leads. Cada limiar conta só dentro do próprio
`event_type`, então navegar bastante nunca consome o orçamento, bem mais
apertado, dos cliques.
**Par inválido não consome rate limit — divergência deliberada de
`submit_lead`, causa é o schema já fechado em AN1.**
`lead_submission_attempts` é uma tabela só de `(ip_hash, attempted_at)`,
sem referência a representative/product — pode registrar "uma tentativa"
sem sujeito válido. `analytics_events` acumula dado reportável E ledger de
rate limit numa peça só (§3.5, já aplicada); `representative_id`/
`product_id` são `not null` com FK, tornando estruturalmente impossível
inserir uma linha "tentativa" sem par já válido. Risco residual avaliado
como baixo: slug é informação pública (é a própria URL); nenhuma linha é
escrita nesse caminho, então não há como poluir dado de um representante
real por essa via — só round-trips rejeitados.
**Sem limpeza dentro destas funções — diferente de `submit_lead`, de
propósito.** `submit_lead` apaga suas próprias linhas de rate-limit >1 dia
porque aquela tabela não tem valor além disso. `analytics_events` É o dado
reportável; apagar aqui destruiria histórico real sob pretexto de limpar
rate limit. Retenção/purga é AN7, ainda em aberto.
**`p_referrer` truncado (`left(..., 2048)`), nunca rejeitado** — diferente
de `nome`/`cidade` em `submit_lead`: o evento (uma visita aconteceu) já é
verdadeiro e valioso independente do tamanho do referrer; descartar o
evento inteiro por um header HTTP atípico jogaria fora dado real por motivo
cosmético.
**`p_ip_hash` nulo/vazio rejeitado explicitamente**, defesa em profundidade:
sem essa checagem, `ip_hash = null` nunca bate na contagem de rate limit
(comparação com NULL nunca é verdadeira em SQL) e o INSERT falharia com um
erro cru de constraint em vez do `boolean` tipado que a função promete.
**Double-check do ADR-048 — obrigatório, feito nas duas funções.**
`select grantee, privilege_type from information_schema.role_routine_grants
where routine_name in ('record_page_visit', 'record_whatsapp_click')` e uma
chamada RPC HTTP crua, sem header `Authorization`, contra as duas —
resultados registrados em `supabase/README.md`, passo 15, quando a migration
for aplicada e o roteiro executado. Ao contrário do achado do ADR-048, aqui
`anon` DEVE aparecer — é o resultado esperado, não um vazamento.
**Teste.** `tests/analytics-write-functions.integration.test.ts`, mesma
forma de `tests/lead-submission.integration.test.ts`. Cobertura assimétrica
deliberada entre as duas funções: o limite de `record_whatsapp_click`
(5/3600s) é saturado de verdade (6 chamadas, mesmo custo de dado que o
teste de leads já aceita); o de `record_page_visit` (60/60s) não é saturado
— faria 60 linhas reais só para reprovar o mesmo mecanismo de corte por
`count(*)` já exercitado, num limiar menor, pela própria suíte de
`record_whatsapp_click` e por `lead-submission.integration.test.ts`. O
filtro de bot, que É específico destas duas funções, é testado a fundo (61
chamadas para visita, 6 para clique, todas retornando `true`) — sem custo de
dado nenhum, já que uma chamada filtrada nunca insere.
**Custo de reversão.** Baixo — duas funções novas, zero alteração em
`analytics_events` (AN1). Dropar as duas fecha o caminho de escrita sem
tocar no schema.
