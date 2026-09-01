export declare const PRODUCTION_SUPABASE_PROJECT_REF: string;
export declare const ALLOWED_TEST_SUPABASE_PROJECT_REFS: readonly string[];

export interface SupabaseIntegrationTargetInput {
  readonly supabaseUrl?: string | null;
  readonly serviceRoleKey?: string | null;
}

export interface SupabaseIntegrationTargetResult {
  readonly verdict: 'ALLOW' | 'BLOCK' | 'SKIP';
  readonly reason: string;
}

export declare function evaluateSupabaseIntegrationTarget(
  input: SupabaseIntegrationTargetInput,
): SupabaseIntegrationTargetResult;

export declare function assertSupabaseIntegrationTargetIsSafe(
  env?: NodeJS.ProcessEnv,
): SupabaseIntegrationTargetResult;
