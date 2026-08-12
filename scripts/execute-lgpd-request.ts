/**
 * SET-48 — execução manual de um direito LGPD (acesso, correção, eliminação,
 * portabilidade ou informação), sobre um Representative (titular com conta)
 * ou um Lead (terceiro sem conta, capturado por uma Commercial Page).
 *
 * "Protegido" (mesmo raciocínio de `reconcile-billing-subscription.ts`,
 * SET-33): este projeto não tem sistema de roles/admin
 * (`docs/plans/SPRINT_E_PLAN.md` §2.4) — a posse de
 * `SUPABASE_SERVICE_ROLE_KEY`, nunca exposta à aplicação, é a própria
 * autorização. `--actor`, `--reason` e `--identity-verification` são
 * exigidos antes de qualquer escrita, nunca opcionais — a verificação de
 * identidade é um critério de aceite explícito da SET-48, não uma
 * formalidade.
 *
 * Roda em modo leitura por padrão (só consulta e imprime o que faria);
 * passar `--apply` para escrever de verdade (a alteração/eliminação real +
 * a linha de auditoria em `lgpd_request_log`). Sem `--apply`, nada é
 * gravado.
 *
 * Exceções de retenção (DATA_RETENTION_DECISIONS_PLAN.md) são respeitadas
 * por desenho, não por checagem manual: `eliminacao` sobre um Representative
 * nunca apaga `subscriptions`/`billing_events` (questão fiscal ainda em
 * aberto, ver o plano) nem `leads`/`analytics_events` que ele é dono como
 * negócio (retenção de 24/12 meses independe do status da conta, já
 * decidido em `DATA_RETENTION_DECISIONS_PLAN.md` §2) — a "eliminação" de um
 * Representative é suspender a conta e redigir os campos de identificação
 * pessoal, nunca apagar a linha. Ver `docs/runbooks/LGPD_RIGHTS.md` §6/§7
 * para o raciocínio completo.
 *
 * Uso:
 *   npm run lgpd:request -- --right=acesso --subject-type=representative \
 *     --email=rep@example.com --identity-verification="e-mail da solicitação bate com auth.users.email" \
 *     --actor="Pedro" --reason="Solicitação recebida em contato@setnar.com em 2026-08-12" [--apply]
 *
 *   npm run lgpd:request -- --right=eliminacao --subject-type=lead \
 *     --email=lead@example.com --identity-verification="..." --actor="Pedro" --reason="..." [--apply]
 */
import { createClient } from '@supabase/supabase-js';

type Right = 'acesso' | 'correcao' | 'eliminacao' | 'portabilidade' | 'informacao';
type SubjectType = 'representative' | 'lead';

interface CliArgs {
  readonly right: Right;
  readonly subjectType: SubjectType;
  readonly email?: string;
  readonly representativeId?: string;
  readonly leadId?: string;
  readonly field?: string;
  readonly value?: string;
  readonly identityVerification: string;
  readonly actor: string;
  readonly reason: string;
  readonly apply: boolean;
}

const RIGHTS: readonly Right[] = ['acesso', 'correcao', 'eliminacao', 'portabilidade', 'informacao'];
const SUBJECT_TYPES: readonly SubjectType[] = ['representative', 'lead'];
const CORRIGIBLE_LEAD_FIELDS = new Set(['nome', 'cidade', 'email', 'telefone_e164']);
const REDACTED = '[eliminado a pedido do titular — LGPD]';
// representatives.phone tem um trigger (20260818000000) que rejeita
// qualquer escrita que zere o campo, mesmo via service_role (triggers não
// são ignorados por RLS/BYPASSRLS, só policies são) — achado real ao rodar
// este script pela primeira vez, ver docs/runbooks/LGPD_RIGHTS.md §8.
// Formato E.164 sintaticamente válido, claramente não-real.
const REDACTED_PHONE_SENTINEL = '+10000000000';

function usageAndExit(): never {
  console.error(
    'Uso: npm run lgpd:request -- --right=<acesso|correcao|eliminacao|portabilidade|informacao> ' +
      '--subject-type=<representative|lead> [--email=... | --representative-id=... | --lead-id=...] ' +
      '--identity-verification="..." --actor="..." --reason="..." [--field=... --value=...] [--apply]\n' +
      '--right, --subject-type, --identity-verification, --actor e --reason são obrigatórios. ' +
      'Um de --email/--representative-id/--lead-id é obrigatório. Sem --apply, roda em modo leitura.',
  );
  process.exit(1);
}

function parseArgs(argv: readonly string[]): CliArgs {
  const flags = new Map<string, string>();
  let apply = false;
  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true;
      continue;
    }
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    const [, key, value] = match ?? [];
    if (key !== undefined && value !== undefined) flags.set(key, value);
  }

  const right = flags.get('right');
  const subjectType = flags.get('subject-type');
  const identityVerification = flags.get('identity-verification');
  const actor = flags.get('actor');
  const reason = flags.get('reason');

  if (
    !right ||
    !RIGHTS.includes(right as Right) ||
    !subjectType ||
    !SUBJECT_TYPES.includes(subjectType as SubjectType) ||
    !identityVerification ||
    !actor ||
    !reason
  ) {
    usageAndExit();
  }

  const email = flags.get('email');
  const representativeId = flags.get('representative-id');
  const leadId = flags.get('lead-id');
  if (!email && !representativeId && !leadId) usageAndExit();

  return {
    right: right as Right,
    subjectType: subjectType as SubjectType,
    email,
    representativeId,
    leadId,
    field: flags.get('field'),
    value: flags.get('value'),
    identityVerification,
    actor,
    reason,
    apply,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.');
    process.exit(1);
  }
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  async function logOutcome(
    outcome: 'completed' | 'partially_completed_retention_exception' | 'no_data_found' | 'denied_identity_unverified',
    detail: Record<string, unknown>,
    representativeId?: string,
    leadId?: string,
    retentionException?: string,
  ) {
    console.log(`outcome=${outcome}`, detail, retentionException ? { retentionException } : '');
    if (!args.apply) {
      console.log('[dry-run, nada gravado]');
      return;
    }
    const { error } = await service.from('lgpd_request_log').insert({
      actor: args.actor,
      reason: args.reason,
      right_exercised: args.right,
      subject_type: args.subjectType,
      representative_id: representativeId ?? null,
      lead_id: leadId ?? null,
      identity_verification: args.identityVerification,
      retention_exception: retentionException ?? null,
      outcome,
      detail,
    });
    if (error) console.error('Falha ao gravar a trilha de auditoria (lgpd_request_log):', error.message);
  }

  async function findRepresentativeByEmail(email: string) {
    // supabase-js admin não tem um "getUserByEmail" direto na versão usada
    // aqui — a base de usuários é pequena o suficiente (dezenas, fase
    // piloto) para paginar e filtrar em memória em vez de introduzir uma
    // RPC nova só para isso.
    const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(`Falha ao listar usuários: ${error.message}`);
    return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  }

  if (args.subjectType === 'representative') {
    let profileId: string | undefined;
    let authUser: Awaited<ReturnType<typeof findRepresentativeByEmail>> = null;
    if (args.email) {
      authUser = await findRepresentativeByEmail(args.email);
      if (!authUser) {
        await logOutcome('no_data_found', { email: args.email });
        return;
      }
      profileId = authUser.id;
    }

    const { data: representative, error: repError } = await service
      .from('representatives')
      .select('id, profile_id, slug, display_name, authorization_id, phone, city, avatar_url, status, created_at')
      .eq(args.representativeId ? 'id' : 'profile_id', args.representativeId ?? profileId)
      .maybeSingle();
    if (repError) throw new Error(`Falha ao ler representatives: ${repError.message}`);
    if (!representative) {
      await logOutcome('no_data_found', { email: args.email, representativeId: args.representativeId });
      return;
    }

    if (args.right === 'acesso' || args.right === 'portabilidade') {
      const { data: profile } = await service
        .from('profiles')
        .select('full_name, phone, terms_accepted_at, terms_version, created_at')
        .eq('id', representative.profile_id)
        .maybeSingle();
      const { data: subscription } = await service
        .from('subscriptions')
        .select('status, provider, current_period_end, amount_cents, currency, created_at')
        .eq('representative_id', representative.id)
        .maybeSingle();
      const { count: leadsCount } = await service
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('representative_id', representative.id);
      const { count: analyticsCount } = await service
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('representative_id', representative.id);
      const { data: feedback } = await service
        .from('feedback_responses')
        .select('context, response, response_detail, answered_at')
        .eq('representative_id', representative.id);

      const report = {
        conta: { email: authUser?.email, ...profile },
        representative,
        subscription,
        leadsRecebidosPelaPagina: leadsCount ?? 0,
        analyticsEventsDaPagina: analyticsCount ?? 0,
        feedback,
        nota:
          'leads/analytics são dado de terceiro capturado pela página comercial deste representante, não dado pessoal dele — exportado aqui só como contagem, não como conteúdo individual.',
      };
      console.log(JSON.stringify(report, null, 2));
      await logOutcome('completed', { fields: Object.keys(report) }, representative.id);
      return;
    }

    if (args.right === 'informacao') {
      await logOutcome(
        'completed',
        { note: 'Respondido apontando para /privacidade §3 (com quem compartilhamos) e §1 (controladora).' },
        representative.id,
      );
      return;
    }

    if (args.right === 'correcao') {
      if (!args.field || !args.value) {
        console.error('correcao exige --field=... --value=... (phone|city|display_name)');
        process.exit(1);
      }
      if (!['phone', 'city', 'display_name'].includes(args.field)) {
        console.error('Campo não suportado por este script — os demais já são self-service no /app.');
        process.exit(1);
      }
      if (!args.apply) {
        console.log(`[dry-run] atualizaria representatives.${args.field} = ${args.value} para ${representative.id}`);
        return;
      }
      const { error } = await service
        .from('representatives')
        .update({ [args.field]: args.value })
        .eq('id', representative.id);
      if (error) throw new Error(`Falha ao corrigir: ${error.message}`);
      await logOutcome('completed', { field: args.field }, representative.id);
      return;
    }

    if (args.right === 'eliminacao') {
      // Nunca um DELETE da linha — FKs NO ACTION em analytics_events/
      // billing_reconciliation_log/feedback_responses/leads/
      // product_activations/subscriptions tornam um DELETE físico
      // impossível (e mesmo se fosse possível, apagaria dado retido por
      // política própria — DATA_RETENTION_DECISIONS_PLAN.md §2). A operação
      // real é suspender + redigir identificação pessoal.
      const retentionException =
        'subscriptions/billing_events preservados (questão fiscal em aberto, DATA_RETENTION_DECISIONS_PLAN.md §3); ' +
        'leads/analytics_events desta página preservados pelo prazo de retenção já aprovado (24/12 meses), independente do status da conta.';
      if (!args.apply) {
        console.log('[dry-run] suspenderia a conta e redigiria full_name/phone/city/display_name/avatar_url');
        console.log(retentionException);
        return;
      }
      const { error: repUpdateError } = await service
        .from('representatives')
        .update({ status: 'suspended', display_name: REDACTED, phone: REDACTED_PHONE_SENTINEL, city: null, avatar_url: null })
        .eq('id', representative.id);
      if (repUpdateError) throw new Error(`Falha ao suspender/redigir representative: ${repUpdateError.message}`);

      const { error: profileUpdateError } = await service
        .from('profiles')
        .update({ full_name: REDACTED, phone: null })
        .eq('id', representative.profile_id);
      if (profileUpdateError) throw new Error(`Falha ao redigir profile: ${profileUpdateError.message}`);

      const { error: feedbackDeleteError } = await service
        .from('feedback_responses')
        .delete()
        .eq('representative_id', representative.id);
      if (feedbackDeleteError) throw new Error(`Falha ao apagar feedback_responses: ${feedbackDeleteError.message}`);

      await logOutcome(
        'partially_completed_retention_exception',
        { redacted: ['representatives.display_name/phone/city/avatar_url', 'profiles.full_name/phone'], deleted: ['feedback_responses'] },
        representative.id,
        undefined,
        retentionException,
      );
      return;
    }
  }

  if (args.subjectType === 'lead') {
    let query = service
      .from('leads')
      .select('id, representative_id, product_id, telefone_e164, campos, origem, referrer, created_at');
    if (args.leadId) query = query.eq('id', args.leadId);
    else if (args.email) query = query.eq('campos->>email', args.email);

    const { data: leads, error: leadsError } = await query;
    if (leadsError) throw new Error(`Falha ao ler leads: ${leadsError.message}`);
    if (!leads || leads.length === 0) {
      await logOutcome('no_data_found', { email: args.email, leadId: args.leadId });
      return;
    }

    if (args.right === 'acesso' || args.right === 'portabilidade') {
      console.log(JSON.stringify(leads, null, 2));
      await logOutcome('completed', { rows: leads.length }, undefined, args.leadId ?? leads[0]?.id);
      return;
    }

    if (args.right === 'informacao') {
      await logOutcome('completed', { note: 'Respondido apontando para /privacidade §3 e §4.' }, undefined, args.leadId ?? leads[0]?.id);
      return;
    }

    if (args.right === 'correcao') {
      if (!args.field || !args.value || !CORRIGIBLE_LEAD_FIELDS.has(args.field)) {
        console.error(`correcao exige --field=<${[...CORRIGIBLE_LEAD_FIELDS].join('|')}> --value=...`);
        process.exit(1);
      }
      if (!args.apply) {
        console.log(`[dry-run] atualizaria ${leads.length} linha(s) de leads: ${args.field} = ${args.value}`);
        return;
      }
      for (const lead of leads) {
        const update =
          args.field === 'telefone_e164'
            ? { telefone_e164: args.value }
            : { campos: { ...(lead.campos as Record<string, unknown>), [args.field as string]: args.value } };
        const { error } = await service.from('leads').update(update).eq('id', lead.id);
        if (error) throw new Error(`Falha ao corrigir lead ${lead.id}: ${error.message}`);
      }
      await logOutcome('completed', { field: args.field, rows: leads.length }, undefined, args.leadId ?? leads[0]?.id);
      return;
    }

    if (args.right === 'eliminacao') {
      // Sem exceção de retenção aqui: a janela de 24 meses
      // (DATA_RETENTION_DECISIONS_PLAN.md §1.2) é um prazo máximo, não um
      // piso — uma eliminação pedida pelo próprio titular é honrada de
      // imediato. `leads` não tem filhos (nenhuma FK aponta para ela), o
      // DELETE é seguro e direto.
      if (!args.apply) {
        console.log(`[dry-run] apagaria ${leads.length} linha(s) de leads`);
        return;
      }
      const ids = leads.map((l) => l.id);
      const { error } = await service.from('leads').delete().in('id', ids);
      if (error) throw new Error(`Falha ao apagar leads: ${error.message}`);
      // lead_id fica de fora do log aqui de propósito: a linha referenciada
      // acabou de ser apagada, e uma FK apontando para um id inexistente
      // falharia no INSERT mesmo com `on delete set null` (esse só relaxa
      // FKs existentes quando o alvo é apagado depois, não uma FK nova
      // apontando para um alvo já ausente) — achado real neste mesmo drill.
      // Os ids apagados vão em `detail`, que não é uma FK.
      await logOutcome('completed', { deletedRows: ids.length, deletedLeadIds: ids });
      return;
    }
  }
}

main().catch((error: unknown) => {
  console.error('Erro inesperado na execução do direito LGPD:', error);
  process.exit(1);
});
