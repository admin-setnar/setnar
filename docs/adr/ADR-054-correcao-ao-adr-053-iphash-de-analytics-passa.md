### ADR-054 — Correção ao ADR-053: `ip_hash` de analytics passa a ter salt próprio (`ANALYTICS_IP_SALT`), não mais `LOGIN_ATTEMPT_SALT` reaproveitado

**O ADR-053 (acima) decidiu errado nesse ponto específico.** Ele reaproveitou
`LOGIN_ATTEMPT_SALT` para o `ip_hash` de `analytics_events`, apresentando
isso como "a decisão menor, mais consistente" — mas essa era exatamente uma
das duas opções que `docs/QR_ANALYTICS_PLAN.md` §3.4 tinha deixado
deliberadamente em aberto ("reaproveitar `LOGIN_ATTEMPT_SALT` ... ou um salt
novo ... ambas as opções existem, não decido qual aqui"), e foi escolhida
sem confirmação do Pedro. Mesma convenção de correção já usada para o gap do
`is_bot_user_agent` (ADR-052): a entrada original não é reescrita, esta é a
correção registrada.

**Por que reaproveitar o salt era o erro.** Nenhuma das tabelas
(`analytics_events`, `login_attempts`, `lead_submission_attempts`) guarda IP
em texto puro — mas com o **mesmo** salt, o mesmo IP produz o **mesmo**
`ip_hash` nas três. Isso torna possível correlacionar uma linha de
`analytics_events` (visita/clique, em princípio anônimo) com uma tentativa
de login ou um lead identificável (nome, telefone, e-mail) que compartilhe
o mesmo IP — exatamente o tipo de correlação que a postura conservadora de
LGPD já fechada em §3.4 existe para impedir ("Analytics data must never
expose personally identifying Visitor information", regra 14 do
`DOMAIN_MODEL.md`, citada pelo próprio ADR-050). Um salt compartilhado não
é neutro aqui: é a única coisa que tornaria essa correlação possível.

**Decisão.** `ANALYTICS_IP_SALT`, variável de ambiente nova, mesma forma de
`LOGIN_ATTEMPT_SALT` (server-only, string aleatória longa, nunca commitada —
ver `supabase/README.md` §5). `supabase-analytics-gateway.ts`'s `hash()` lê
`ANALYTICS_IP_SALT` em vez de `LOGIN_ATTEMPT_SALT`; a função de hash em si
não muda (`sha256(salt:ip)`, mesma forma das outras duas). Nenhuma migration:
`analytics_events.ip_hash` já era só `text`, sem CHECK de formato — trocar o
salt que a alimenta é puramente um detalhe do adapter.

**Por que agora é de graça, e por que essa janela fecha.** `analytics_events`
foi criada em `20260810000000` (AN1) e as funções que escrevem nela em
`20260811000000`/`20260812000000` (AN2/AN4) — o wiring do app (AN3/AN5,
ADR-053) é o primeiro código que de fato as invoca. Confirmado contra o
projeto real do Pedro antes desta troca: `select count(*) from
analytics_events` (chave anon, portanto sujeito à mesma policy own-row que
`analytics_events_select_own` já aplica) devolveu `0`. **Essa contagem não é
prova definitiva** — a chave anon nunca enxerga linha nenhuma dessa tabela
por RLS, com ou sem dado real presente, então uma leitura por essa via
sempre devolveria `0` mesmo que existissem linhas. O double-check
verdadeiramente conclusivo (`select count(*)` pelo SQL Editor, que ignora
RLS) fica pendente de confirmação do Pedro antes deste ADR ser considerado
totalmente fechado. Se alguma linha de verificação manual anterior já tiver
sido gravada com o salt antigo, ela fica órfã (hash calculado com um salt
que o app não lê mais) — aceitável, é dado de teste, não dado real, e não
há como re-hashear retroativamente (o IP original nunca foi persistido, por
design). A partir desta mudança, toda linha nova é gravada com
`ANALYTICS_IP_SALT`. Esta é a única janela em que a troca não tem custo:
uma vez que exista tráfego real, qualquer salt novo tornaria as linhas
antigas não-comparáveis entre si por IP (mesma consequência que já se aplica
a rotacionar `LOGIN_ATTEMPT_SALT`, documentada em `supabase/README.md` §5) —
mas aqui, ao contrário de uma rotação de manutenção, essa perda de
comparabilidade é precisamente o objetivo, não um efeito colateral aceito.

**Custo de reversão.** Baixo enquanto a tabela seguir vazia (que é o estado
confirmado, com a ressalva acima); alto depois que existir tráfego real —
outro motivo para fechar isto agora, antes do primeiro deploy com visitas de
verdade.
