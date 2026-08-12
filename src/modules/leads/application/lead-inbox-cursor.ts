import type { LeadInboxCursor } from '@/modules/leads/domain/lead-inbox-repository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Opaque URL cursor. Invalid or attacker-edited values safely mean page one. */
export function decodeLeadInboxCursor(value: string | string[] | undefined): LeadInboxCursor | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!isRecord(parsed)) return null;

    const receivedAt = parsed.receivedAt;
    const id = parsed.id;
    if (typeof receivedAt !== 'string' || typeof id !== 'string') return null;
    if (!UUID_PATTERN.test(id) || !isCanonicalIsoDate(receivedAt)) return null;

    return { receivedAt, id };
  } catch {
    return null;
  }
}

export function encodeLeadInboxCursor(cursor: LeadInboxCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function isCanonicalIsoDate(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
