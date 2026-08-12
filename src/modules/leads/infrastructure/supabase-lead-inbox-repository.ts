import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { mapLeadInboxRow, type LeadInboxRow } from '@/modules/leads/application/lead-inbox-contact';
import {
  LEAD_INBOX_PAGE_SIZE,
  type LeadInboxCursor,
  type LeadInboxPage,
  type LeadInboxRepository,
} from '@/modules/leads/domain/lead-inbox-repository';
import { toSafeLogError } from '@/shared/lib/safe-log-error';

/** Authenticated, request-scoped adapter. Postgres RLS is the isolation boundary. */
export class SupabaseLeadInboxRepository implements LeadInboxRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listOwnContacts(
    representativeId: string,
    cursor: LeadInboxCursor | null,
    limit = LEAD_INBOX_PAGE_SIZE,
  ): Promise<LeadInboxPage> {
    const pageSize = Math.min(Math.max(Math.trunc(limit), 1), LEAD_INBOX_PAGE_SIZE);
    let query = this.supabase
      .from('leads')
      .select('id, telefone_e164, campos, created_at, product:products(name)')
      .eq('representative_id', representativeId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize + 1);

    if (cursor) {
      // Both values were strictly parsed before reaching this adapter. The
      // two-column predicate matches the deterministic ORDER BY exactly.
      query = query.or(
        `created_at.lt.${cursor.receivedAt},and(created_at.eq.${cursor.receivedAt},id.lt.${cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) {
      console.error('Lead inbox read failed.', toSafeLogError(error));
      throw new Error('Lead inbox unavailable.');
    }

    const rows = (data ?? []) as unknown as LeadInboxRow[];
    const visibleRows = rows.slice(0, pageSize);
    const last = visibleRows.at(-1);

    return {
      contacts: visibleRows.map(mapLeadInboxRow),
      nextCursor:
        rows.length > pageSize && last
          ? { receivedAt: last.created_at, id: last.id }
          : null,
    };
  }
}
