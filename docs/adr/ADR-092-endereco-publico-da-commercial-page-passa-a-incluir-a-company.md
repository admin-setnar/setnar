### ADR-092 — Endereço público da Commercial Page passa a incluir a Company: `<representative>.<company>.setnar.com`, sem transformar Company em Tenant (SET-83)

**Status:** Accepted

**Date:** 2026-08-19

**Related:** Estende ADR-026 (forma do endereço) e ADR-031 (`RepresentativeRepository` como port distinto); não altera a ordem de resolução de ADR-001. Qualifica `DOMAIN_MODEL.md` §8.6 (Commercial Page). Implementa SET-83; relacionada a SET-76 (que descreve uma arquitetura-alvo diferente — domínio separado `*.setnar.app` — não implementada por esta decisão; SET-76 permanece em aberto).

#### Contexto

O esquema de endereço público decidido em ADR-026 (`<representative>.setnar.com`)
nunca incluiu a Company que autoriza o representante — a Company de uma
página era resolvida inteiramente pelo dado (`product.company_id`), nunca
pelo `Host`. Uma investigação em três rodadas (não registrada como plano
formal, mas conduzida com a mesma disciplina — hipóteses comparadas,
premissas verificadas contra o código, uma POC de infraestrutura executada
antes de qualquer decisão) avaliou se e como uma segunda Company deveria
aparecer na URL pública, antes de uma segunda Company existir de fato.

O Product Owner decidiu que a Company deve aparecer explicitamente no
endereço público — `pedro-policeno.igreen.setnar.com`, não
`pedro-policeno.setnar.com` — para comunicar ao cliente final a relação
comercial entre o representante e a organização que o autoriza, e para
sustentar uma futura demonstração B2B (`joao.igreen.setnar.com` ao lado de
`alberto.ademicom.setnar.com`). A decisão foi tomada com uma restrição
explícita: isso não deveria transformar Company em Tenant, nem exigir
`representatives.slug` deixar de ser globalmente único.

Um fato de produto mudou o escopo da decisão em relação à investigação
inicial: **não existe usuário em produção hoje**, e portanto nenhum QR
Code, cartão físico ou link já distribuído depende do esquema de um label
(`<representative>.setnar.com`). Isso removeu o requisito de
retrocompatibilidade que, em qualquer outro momento, teria exigido um
esquema de transição (alias, redirect, canonicalização) — o formato de dois
labels nasce como o único formato oficial, não como uma migração de um
esquema anterior.

#### Decisão

O endereço público canônico de uma Commercial Page passa a ser
`https://<representative-slug>.<company-slug>.setnar.com/<product-slug>`.
Não existe forma de um label — um Host com um único label antes do domínio
raiz (`<representative>.setnar.com`) é tratado como qualquer host inválido,
não como uma forma legada suportada.

**Mecanismo — extensão, não substituição, de ADR-031.**
`extractRepresentativeSlug` (que resolvia um único label) foi substituído
por `parseCommercialPresenceHost`
(`src/modules/representatives/application/resolve-representative.ts`), que
exige **exatamente dois** labels antes de um hostname de Tenant conhecido —
mesma ordem de precedência de ADR-001/031 (Tenant resolvido primeiro, por
construção, via o mesmo `TenantRepository`), mesma lista de exclusões
(`*.vercel.app`, hosts de Tenant conhecidos), mesmo formato de slug
(`REPRESENTATIVE_SLUG_PATTERN`, reaplicado também ao label de Company).
Nenhuma mudança na ordem de resolução Tenant → Representative; a única
mudança é que a extração do label de Representative agora também captura o
label de Company logo em seguida.

**Company nunca se torna um Tenant.** `TenantRepository`/
`InMemoryTenantRepository` não ganharam nenhuma entrada nova. O
`companySlug` extraído do Host é validado — nunca usado para procurar um
Tenant — contra o dado que `RepresentativeRepository.findPublishedActivation`
já carrega (`product.company.slug`, o mesmo join que ADR-057 já usa para
branding). `representatives.slug` continua uma coluna `unique` simples, sem
migration: a unicidade global é exatamente o que torna essa validação
barata (o Representative é localizado pelo slug sozinho; o label de Company
só confirma, nunca desempata).

**Validação de pertencimento — requisito de segurança, não refinamento
opcional.** Sem essa validação, um Host como
`pedro.ademicom.setnar.com` resolveria Pedro (que só pertence à iGreen)
exatamente como se o label de Company nunca estivesse ali. A defesa:
`SupabaseRepresentativeRepository.findPublishedActivation` e
`InMemoryRepresentativeRepository.findPublishedActivation` comparam
`representative.company.slug` contra o `companySlug` recebido, retornando
`null` em caso de divergência — o mesmo `notFound()` genérico de ADR-030,
nunca uma resposta diferenciada (anti-enumeração, aplicada agora também ao
pertencimento de Company).

**`buildCommercialPageUrl`** (`presentation/commercial-page-url.ts`) —
único ponto de composição da URL pública, usado por QR Code, pelos 21
materiais de marketing e por canonical/Open Graph/Twitter — passou a incluir
`product.companySlug` (já carregado por `RepresentativeProduct`, ADR-057),
sem nenhuma reconstrução manual da string em nenhum outro arquivo.

**Contrato de composição renomeado.** O ponto de composição exposto à
Server Component (antes `resolveCommercialPageActivation`) foi renomeado
para `resolveCommercialPresence`, para que o contrato público nomeie o
conceito de negócio que ele resolve — Representative + Company →
Commercial Presence — em vez de deixar a Company ler como um detalhe de
validação incidental. O mecanismo interno (`resolveRepresentativeActivation`)
não mudou de nome: ele genuinamente localiza pelo slug do Representative
primeiro, o que continua sendo verdade.

**Cadastro inalterado.** `register_representative`
(`supabase/migrations/20260806000000_add_register_representative.sql`) não
foi tocado por esta decisão — continua resolvendo `company_id` a partir de
um literal SQL (`where slug = 'igreen'`), a única autoridade sobre essa
associação hoje. Uma segunda função TypeScript fazendo o mesmo papel foi
avaliada e descartada deliberadamente (ver *Alternativas consideradas*): a
única mudança visível no fluxo de cadastro é a prévia de URL em
`onboarding-form.tsx`, puramente de exibição.

#### Alternativas consideradas

1. **Company como Tenant** (`representative.company.setnar.com` resolvido
   por uma segunda camada de `TenantRepository`). Rejeitada: exigiria
   reescrever a lógica de exclusão de host de `extractRepresentativeSlug`
   (que hoje rejeita explicitamente qualquer host mais profundo que um
   nível abaixo de um tenant conhecido) e forçaria
   `representatives.slug` a virar `unique(company_id, slug)` — nenhuma das
   duas foi necessária sob o mecanismo escolhido.
2. **Domínio separado para representantes** (`representative.setnar.app`).
   Rejeitada: custo de um domínio novo, wildcard novo, certificado novo,
   sem necessidade — o domínio já existente (`setnar.com`) já cobre
   subdomínios de dois níveis, comprovado empiricamente (ver *POC de
   infraestrutura*).
3. **Company fora da URL** (`representative.setnar.com`, recomendação de
   uma rodada anterior desta mesma investigação). Superada por decisão
   explícita do Product Owner: a presença da Company na URL tem valor de
   produto (comunicação da relação comercial, demonstração B2B) que a opção
   mais simples de engenharia não entregava.
4. **Um segundo hardcode de Company no lado da aplicação**
   (`resolveOnboardingCompanySlug()` chamado por `registerRepresentativeAction`,
   enquanto o RPC mantinha seu próprio literal). Considerada e descartada:
   criaria duas autoridades independentes dizendo `'igreen'`, sem relação
   entre si — duplicação, não preparação. O literal SQL permanece a única
   autoridade; a única constante nova (`COMPANY_SLUG_PREVIEW` em
   `onboarding-form.tsx`) é explicitamente de exibição, nunca enviada ao
   servidor, documentada como devendo ser mantida em sincronia manual com o
   literal SQL — mesmo trade-off já aceito neste módulo para outros pares
   SQL/TypeScript (`representative-rules.ts`).

#### POC de infraestrutura

Antes de qualquer código ser escrito, uma POC somente-leitura (`nslookup`,
`curl`, `openssl s_client`) contra `setnar.com` já em produção identificou
que o wildcard de um nível então configurado não cobria um segundo nível —
`*.igreen.setnar.com` falhava o handshake TLS antes de qualquer certificado
ser apresentado. O Product Owner configurou manualmente
`*.igreen.setnar.com` na Vercel; a mesma bateria, reexecutada, confirmou
DNS → TLS → Vercel → aplicação funcionando de ponta a ponta, com um
certificado Let's Encrypt real e dedicado (`CN=*.igreen.setnar.com`).
Nenhuma mudança de DNS/Vercel foi feita por este ADR — a configuração já
existia quando a implementação começou.

#### Consequências positivas

- Nenhuma migration de schema — `representatives.slug` permanece global e
  único, exatamente como já estava desenhado.
- Nenhuma mudança na ordem de resolução Tenant → Representative de
  ADR-001/031 — apenas a extração de labels do Representative mudou de
  forma.
- Nenhuma mudança de UX no cadastro — a única alteração em
  `onboarding-form.tsx` é a prévia de URL exibida, não a lógica de
  registro.
- `buildCommercialPageUrl` continua sendo o único ponto de composição da
  URL pública — QR Code, materiais de marketing e metadata propagam a nova
  forma automaticamente, sem concatenação manual em nenhum outro arquivo.
- A proteção contra colisão de namespace entre slug de Representative e
  slug de Company (lista de palavras reservadas, `20260806000000`) continua
  necessária e válida, agora por um motivo mais estreito (a forma de um
  label, que deixou de ser suportada, era o único caso em que a posição não
  desambiguava tecnicamente).

#### Consequências negativas e riscos aceitos

- A URL de um representante nunca comunicava a Company antes; agora
  comunica sempre — uma escolha de produto explícita (Company tem valor de
  marca na URL), não uma consequência acidental do mecanismo.
- `companies.slug` continua sem CHECK de formato dedicado (diferente de
  `representatives.slug`) — não é um risco para o MVP (só `'igreen'`
  existe, já em formato válido), mas fica registrado como item a fechar
  quando uma segunda Company for criada de verdade.
- Toda Company futura precisará do mesmo passo manual de configuração de
  domínio na Vercel que a iGreen recebeu (`*.<company>.setnar.com`) — não
  existe, hoje, evidência de que o mecanismo generalize automaticamente
  para N Companies sem esse passo por Company.

#### Salvaguardas

- Teste de segurança dedicado
  (`tests/resolve-representative.test.ts`, "SECURITY: never resolves a real
  representative under a Company they do not belong to") cobre
  especificamente o cenário de Host spoofing que motivou a validação de
  pertencimento.
- `parseCommercialPresenceHost` rejeita hosts de um label e de três ou mais
  labels antes de qualquer tentativa de resolução — nenhum deles cai em
  outra rota pública por acidente.
- A resposta pública para Company divergente, Company inexistente,
  Representative inexistente e host malformado é sempre a mesma —
  `notFound()` genérico, mesmo princípio anti-enumeração de ADR-018/030.

#### Rollback conceitual

Reverter `parseCommercialPresenceHost` para `extractRepresentativeSlug`
(um label) e remover a validação de `companySlug` em ambos os adapters de
`RepresentativeRepository` — mudança de código isolada, sem migration para
desfazer (nenhuma foi criada), sem dado a migrar de volta (nenhum dado novo
foi persistido). O custo real de reversão está fora do código: qualquer
link/QR Code já distribuído no formato de dois labels pararia de resolver —
o mesmo tipo de custo que ADR-026 já registrou para o esquema original,
agora anotado para o esquema atual, caso ele precise mudar de novo depois
que usuários reais existirem.
