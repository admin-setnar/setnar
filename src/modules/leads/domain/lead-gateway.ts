export interface SubmitLeadInput {
  readonly representativeId: string;
  readonly productId: string;
  readonly telefoneE164: string;
  readonly nome: string;
  readonly cidade: string | null;
  readonly email: string | null;
  readonly origem: string | null;
  readonly referrer: string | null;
  readonly ip: string | null;
}

/**
 * `'rejected'` covers both a rate-limited call and an invalid
 * representative/product pair — deliberately not distinguished, same
 * anti-enumeration principle already applied elsewhere in this app
 * (ADR-018, ADR-030). `'error'` is a real infrastructure failure (network,
 * database down) and must be presented to the caller differently — never as
 * `'rejected'`.
 */
export type SubmitLeadResult = 'submitted' | 'rejected' | 'error';

/**
 * Port. `app/api/leads/route.ts` depends on this and on `getLeadGateway()`
 * (`infrastructure/lead-gateway-factory.ts`) only — never on
 * `SupabaseLeadGateway` directly, same DI shape as `AuthGateway`.
 */
export interface LeadGateway {
  submitLead(input: SubmitLeadInput): Promise<SubmitLeadResult>;
}
