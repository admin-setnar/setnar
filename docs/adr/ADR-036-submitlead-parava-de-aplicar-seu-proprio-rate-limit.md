### ADR-036 — `submit_lead` parava de aplicar seu próprio rate limit para qualquer chamador direto do RPC; corrigido removendo os parâmetros, não flooram com `greatest()`
**Decisão.** `20260802000000_fix_submit_lead_rate_limit.sql` remove
`p_max_attempts_ip` e `p_window_seconds` da assinatura de `submit_lead`
(`supabase/migrations/20260801000000_add_lead_submission.sql`, ADR-034) — os
dois números (5 tentativas / 3600s) viram literais fixos dentro da própria
função, sem parâmetro nenhum governando-os. Adicionalmente, `submit_lead`
ganhou validação mínima de formato/tamanho (telefone, e-mail, nome) — ver
"Validação adicionada" abaixo. Nenhuma outra migration já aplicada foi
editada (regra do README, acima); esta é uma migration nova.
**A vulnerabilidade, e por que o texto original do ADR-034 não a pegou.**
ADR-034 documentou uma verificação manual real (curl, rate limit 429 na 6ª
tentativa) — mas contra `POST /api/leads`, que sempre chamava `submit_lead`
com `p_max_attempts_ip: LEAD_MAX_SUBMISSIONS_PER_IP` e `p_window_seconds:
LEAD_RATE_LIMIT_WINDOW_MS / 1000` fixos (`supabase-lead-gateway.ts`). Essa
verificação nunca testou o que acontece quando o CHAMADOR escolhe esses dois
valores — e `submit_lead` é `grant execute to anon`, então qualquer portador
da chave publicável (pública por natureza) pode chamar o RPC direto, sem
passar por `/api/leads`, sem o Zod de `leadSubmissionSchema`, sem o
honeypot. Mesma classe de bug que `20260729000000_fix_login_attempts_cleanup.sql`
já corrigiu em `record_login_failure` — um parâmetro controlado pelo
chamador governando um limite dentro de uma função `SECURITY DEFINER`
concedida a `anon` — mas aqui pior: `submit_lead` também faz o `insert` em
`leads`, então bypassar o rate limit aqui não é só "ler um estado errado", é
inserir dados de negócio ilimitadamente.
**Reproduzido contra o projeto de teste antes de escrever a correção**
(mesmo processo que `20260729000000` documenta no próprio cabeçalho, agora
repetido para este caso): chamando `submit_lead` direto via
`@supabase/supabase-js` com a chave anon, `p_window_seconds: 1,
p_max_attempts_ip: 999999` em toda chamada, de um `p_ip_hash` fixo, contra um
par (representative_id, product_id) real com ativação publicada — 8
chamadas seguidas, 8 `data: true` (linha inserida todas as vezes). O piso
`greatest(p_window_seconds, 1)`/`greatest(p_max_attempts_ip, 1)` que
`submit_lead` já tinha (espelhando `is_login_blocked`) não ajuda aqui: ele só
rejeita valor zero/negativo, e este ataque nunca precisou de um valor
degenerado, só de um valor grande — que `greatest()` não limita por cima.
Ver o cabeçalho da migration para o repro completo, incluindo o segundo
achado abaixo.
**Por que remover o parâmetro, não flooram com `greatest()` como
`is_login_blocked` (ADR-012/ADR-018).** `is_login_blocked` é só leitura — um
chamador direto pode, no máximo, ler "não bloqueado" para si mesmo com um
threshold inflado, um risco já aceito e documentado (ADR-012: "a defesa fina
continua sendo o rate limiter por e-mail"). `submit_lead` não é só leitura:
decide E grava, na mesma chamada, numa tabela de negócio (`leads`). Um
threshold inflado aqui não engana uma leitura, ele desliga a escrita
protegida. `auth-rules.ts` continua sendo a fonte de verdade pros
thresholds de login (leitura, ADR-012) — mas não existe justificativa
equivalente para `submit_lead` aceitar um threshold do chamador, já que
ninguém legítimo tem motivo pra querer escolher o próprio limite numa função
que insere em nome dele. `LEAD_MAX_SUBMISSIONS_PER_IP`/
`LEAD_RATE_LIMIT_WINDOW_MS` (`lead-rules.ts`) foram removidas no mesmo commit
— nada mais as lia depois que `supabase-lead-gateway.ts` parou de passar
esses dois parâmetros — deixar as constantes órfãs no lugar seria o mesmo
risco de duas-fontes-de-verdade que esta correção existe para fechar.
**Validação adicionada — segundo achado do mesmo repro, defesa em
profundidade.** Mesma sessão de teste: uma chamada direta com
`p_telefone_e164` = string de 200+ caracteres sem formato de telefone,
`p_nome`/`p_cidade` = 5000 caracteres, `p_email` sem `@`: `data: true`,
linha inserida como veio. `leadSubmissionSchema`
(`modules/leads/presentation/schemas/lead.schema.ts`) rejeitaria tudo isso,
mas um chamador direto do RPC nunca passa por ali. `submit_lead` ganhou
checagem de formato/tamanho própria — deliberadamente NÃO uma cópia dos
limites exatos do Zod (`LEAD_NAME_MIN_LENGTH`/`MAX_LENGTH`/
`LEAD_CITY_MAX_LENGTH`), pra não recriar a mesma duas-fontes-de-verdade que
acabou de ser fechada no rate limit: telefone precisa bater o formato E.164
em si (padrão externo, `^\+[1-9]\d{6,14}$`), e-mail precisa ter `@`/`.` e
caber no limite do RFC 5321 (320 caracteres, também um padrão externo), nome
não pode ser vazio e tem um teto largo de 500 caracteres — acima de qualquer
bound de negócio real, só pra barrar payload patológico, não pra duplicar
regra de negócio que já vive no Zod. Ver o cabeçalho da migration para o
raciocínio completo.
**Verificado de novo, depois da correção, contra o mesmo projeto de teste.**
As mesmas 8 chamadas do repro acima, agora contra a versão corrigida:
chamadas 1–5 retornaram `true`, chamadas 6–8 retornaram `false` — o limite de
5 é aplicado independente do que o chamador tentar passar (a assinatura nem
aceita mais `p_max_attempts_ip`/`p_window_seconds`; uma chamada usando o
formato antigo falha com erro de função inexistente, não silenciosamente
ignora os parâmetros extras). O payload malformado do segundo achado agora
retorna `false` sem inserir.
**Teste automatizado.** `tests/lead-submission.integration.test.ts` — não
existia teste nenhum pro módulo `leads` antes desta correção. Cobre: a
assinatura antiga falhando (não apenas ignorando os parâmetros removidos), o
limite de 5/hora sendo respeitado com um `ip_hash` fresco a cada chamada,
uma origem não afetar outra, o caminho feliz, e os três formatos malformados
(telefone/e-mail/nome) sendo rejeitados mesmo com um par
representative/product válido. Descobre um par (representative, product)
publicado em tempo de execução via as mesmas policies de SELECT público
(ADR-030) em vez de fixar IDs do projeto de teste no código — a chave anon
não tem como criar esse fixture (sem policy de INSERT em `representatives`/
`product_activations`), então os testes que precisam de um par real
pulam-se sozinhos (não falham) quando nenhum existe no projeto configurado.
**O que NÃO foi feito.** Uma segunda variável de ambiente ou segredo — não
precisava, nada aqui envolve salt/hash, só remoção de parâmetro e validação
adicional. Reintroduzir os parâmetros com `greatest()` como piso (o padrão
de `is_login_blocked`) — rejeitado pelo raciocínio acima: o piso não fecha o
ataque real, que usa um valor grande, não degenerado. Espelhar exatamente os
bounds do Zod na validação SQL — rejeitado para não recriar duas fontes de
verdade duplicadas sobre o mesmo número.
**Custo de reversão.** Baixo — mesma tabela e mesma função de antes, só a
assinatura e o corpo mudaram; nenhum outro chamador de `submit_lead` existe
além de `supabase-lead-gateway.ts`, já atualizado no mesmo commit.
