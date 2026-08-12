import type { LeadInboxContact } from '@/modules/leads/domain/lead-inbox-repository';

export interface LeadInboxRow {
  readonly id: string;
  readonly telefone_e164: string;
  readonly campos: unknown;
  readonly created_at: string;
  readonly product: { readonly name: string } | null;
}

/** Maps persistence details (`campos` JSON and snake_case) to the read model. */
export function mapLeadInboxRow(row: LeadInboxRow): LeadInboxContact {
  const fields = isRecord(row.campos) ? row.campos : {};

  return {
    id: row.id,
    name: optionalText(fields.nome) ?? 'Contato',
    phoneE164: row.telefone_e164,
    email: optionalText(fields.email),
    city: optionalText(fields.cidade),
    productName: optionalText(row.product?.name) ?? 'Página não identificada',
    receivedAt: row.created_at,
  };
}

export function buildLeadWhatsappUrl(contact: Pick<LeadInboxContact, 'name' | 'phoneE164' | 'productName'>): string {
  const phone = contact.phoneE164.replace(/\D/g, '');
  const message = `Olá, ${contact.name}! Vi seu contato sobre ${contact.productName} na minha página.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function formatLeadReceivedAt(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
