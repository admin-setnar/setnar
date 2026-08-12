export const LEAD_INBOX_PAGE_SIZE = 20;

export interface LeadInboxCursor {
  readonly receivedAt: string;
  readonly id: string;
}

export interface LeadInboxContact {
  readonly id: string;
  readonly name: string;
  readonly phoneE164: string;
  readonly email: string | null;
  readonly city: string | null;
  readonly productName: string;
  readonly receivedAt: string;
}

export interface LeadInboxPage {
  readonly contacts: readonly LeadInboxContact[];
  readonly nextCursor: LeadInboxCursor | null;
}

/**
 * Read port for the authenticated representative's minimal contact inbox.
 * This is deliberately separate from `LeadGateway`: that port writes from an
 * anonymous public page through a trusted server boundary, while this one is
 * a read-only, owner-scoped use case backed by the caller's Supabase session.
 */
export interface LeadInboxRepository {
  listOwnContacts(
    representativeId: string,
    cursor: LeadInboxCursor | null,
    limit?: number,
  ): Promise<LeadInboxPage>;
}
