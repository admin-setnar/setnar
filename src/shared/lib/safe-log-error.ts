/**
 * Reduces an unknown caught error to the only two fields safe to log:
 * `code` and `message`. Deliberately drops everything else — in particular
 * a PostgrestError's `details`/`hint`, which is where Postgres embeds the
 * actual failing row value on a unique/check/not-null violation (e.g.
 * `Key (phone)=(+5511999999999) already exists.`), and any other property
 * an upstream caller might have attached. See ADR-084.
 */
export function toSafeLogError(error: unknown): { code?: string; message: string } {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    const code =
      'code' in error && typeof (error as { code: unknown }).code === 'string'
        ? (error as { code: string }).code
        : undefined;
    return code ? { code, message: (error as { message: string }).message } : { message: (error as { message: string }).message };
  }
  return { message: 'Unknown error' };
}
