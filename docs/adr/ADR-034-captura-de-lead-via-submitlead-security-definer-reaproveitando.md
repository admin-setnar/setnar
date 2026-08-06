### ADR-034 — Captura de lead via `submit_lead` (SECURITY DEFINER), reaproveitando o padrão e o salt de `login_attempts` — não um novo esquema
**Decisão.** `submit_lead`
(`supabase/migrations/20260801000000_add_lead_submission.sql`), uma função
`SECURITY DEFINER` sobre uma tabela nova `lead_submission_attempts` (RLS
habilitado, zero policies) — o mesmo formato de `is_login_blocked`/
`record_login_failure`/`clear_login_attempts` sobre `login_attempts`
(ADR-012), reaproveitado deliberadamente, não reinventado: essa era
exatamente a lacuna que a nota de design de RLS no topo de
`20260731000000_create_representative_domain.sql` já deixava documentada
("a captura de lead é trabalho futuro, via API route com rate limiting").
`POST /api/leads` (`src/app/api/leads/route.ts`) é a única porta de entrada
— `leads` continua sem policy de INSERT, como antes.
**Por que uma função só, não três.** Login separa leitura
(`is_login_blocked`) de escrita (`record_login_failure`) porque só
tentativas *falhas* contam contra o limite — um login bem-sucedido não pode
ser penalizado. Uma submissão de lead não tem essa distinção: toda
submissão (aceita ou rejeitada) é o próprio evento sendo limitado, então
`submit_lead` checa e grava atomicamente numa função só — o que também
fecha a janela de corrida check-then-act que o split em duas chamadas do
login deixa aberta (uma lacuna já aceita e documentada lá; aqui nem existe,
por construção).
**Por que só IP, sem um segundo eixo de identidade.** Login tem limite por
e-mail *e* por IP porque credential stuffing mira uma conta a partir de
várias origens. Lead não tem um eixo equivalente antes da submissão — o
telefone é o payload sendo enviado, não uma identidade (um visitante real
pode legitimamente submeter o telefone de um familiar a partir do próprio
dispositivo) — então só IP é limitado.
**Reaproveitar `LOGIN_ATTEMPT_SALT`, não criar um segundo salt.** O hash do
IP usa o mesmo `sha256(salt:valor)` de `login-rate-limiter.ts`, lendo a
mesma variável `LOGIN_ATTEMPT_SALT` — nenhuma variável de ambiente nova foi
introduzida. **Consequência aceita conscientemente.** Rotacionar
`LOGIN_ATTEMPT_SALT` no futuro invalida os dois rate limiters ao mesmo
tempo, não só o de login (mesmo efeito que ADR-018 já registra pra
`login_attempts` isoladamente, agora compartilhado). A função de hash em si
não foi extraída pra um util compartilhado — duplicada como uma função
privada de 5 linhas em `supabase-lead-gateway.ts`, pra não acoplar o módulo
de leads ao de auth por tão pouco código; extrair vira a decisão certa se
um terceiro chamador aparecer.
**`representative_id`/`product_id` nunca vêm do corpo da requisição.**
`app/api/leads/route.ts` resolve o representante a partir do header `Host`
da própria requisição, reaproveitando `resolveRepresentativeActivation`
— a mesma função que `[productSlug]/page.tsx` já usa (ADR-031) — em vez de
confiar em IDs enviados pelo cliente. Sem isso, qualquer chamador direto da
rota poderia atribuir um lead a um representante arbitrário. `submit_lead`
ainda valida de novo, no banco, que existe uma `product_activations`
`published` ligando o par (defesa em profundidade, não confiança cega no
resultado da rota).
**Anti-enumeração no retorno.** `submit_lead` retorna `boolean` — `false`
tanto pra "rate limited" quanto pra "representante/produto inválido", sem
distinguir os dois casos, mesmo princípio já aplicado em ADR-018 e ADR-030.
Um par inválido também consome uma unidade do limite por IP (grava em
`lead_submission_attempts` mesmo quando rejeita por esse motivo), pra que
sondar pares válidos não seja um oráculo de tentativas ilimitadas.
**Honeypot reaproveitado do template original, não inventado.** O campo
oculto `empresa` (`aria-hidden`, `tabindex="-1"`,
`templates/commercial-pages/ConexaoGreen/index.html:165`) virou
`LEAD_HONEYPOT_FIELD` — se vier preenchido, a rota responde exatamente como
sucesso (`200 { ok: true }`), sem nunca chamar `submit_lead`, pra não dar
sinal a um bot de que foi pego.
**Threshold escolhido.** 5 submissões por IP a cada 60 minutos — janela mais
longa e limite mais apertado que o de login, porque preencher o mesmo
formulário várias vezes rápido é comportamento de spam, não o
compartilhamento de IP por CGNAT que motivou o limite de 30/15min do login
(ADR-012) — um lead não tem o mesmo risco de bloquear usuários legítimos
vizinhos. **Correção ao texto original, ver ADR-036.** Este parágrafo
originalmente apontava `LEAD_MAX_SUBMISSIONS_PER_IP`/`LEAD_RATE_LIMIT_WINDOW_MS`
(`modules/leads/domain/lead-rules.ts`) como a fonte desses dois números,
passados por `submit_lead` como parâmetros do chamador. `20260802000000_fix_submit_lead_rate_limit.sql`
removeu essa passagem — os dois números acima são hoje literais fixos dentro
da própria função, sem parâmetro nenhum governando-os; as duas constantes em
`lead-rules.ts` foram removidas. O valor do threshold não mudou, só onde ele
vive — ver ADR-036 para o porquê.
**Verificado manualmente contra o projeto de teste, não só com testes
automatizados.** Uma submissão real inseriu uma linha em `leads` (`ok:true`
— só alcançável depois do `insert` bem-sucedido dentro de `submit_lead`,
confirmado lendo a própria função); a 6ª submissão da mesma origem em menos
de uma hora voltou `429`; uma origem diferente não foi afetada pelo mesmo
limite; o honeypot preenchido voltou `200` sem inserir; um representante
inexistente voltou `404`. Rodado via `curl` com `Host` forjado, não pelo
navegador do sandbox de preview — esse não resolve subdomínios
`*.localhost`, limitação do ambiente de teste, não do código. **Essa
verificação, como ADR-036 documenta, provou o comportamento de `POST
/api/leads`, não de `submit_lead` chamado direto — a distinção importa, ver
ADR-036.**
**Alternativas rejeitadas.** Uma segunda variável de ambiente de salt
(`LEAD_SUBMISSION_SALT` ou similar) — rejeitada por criar um segundo
segredo pra rotacionar/vazar sem necessidade, quando reaproveitar
`LOGIN_ATTEMPT_SALT` cobre o mesmo objetivo (nunca guardar IP em texto
puro) sem esse custo. Separar `is_lead_blocked`/`record_lead_submission`
em duas chamadas, espelhando login literalmente — rejeitada porque lead não
tem a distinção sucesso/falha que motiva esse split em login (ver acima).
**Custo de reversão.** Baixo — uma função e uma tabela novas, sem tocar
`leads`/`login_attempts`; removível sem afetar nenhum outro fluxo.
