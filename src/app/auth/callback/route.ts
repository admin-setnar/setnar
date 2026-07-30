import { NextResponse, type NextRequest } from 'next/server';

import { safeRedirectTarget } from '@/modules/auth/presentation/safe-redirect-target';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * First Route Handler in this project — documented in the README as its own
 * ADR. Exists because the password-reset e-mail link cannot land on a
 * Server Component: exchanging the PKCE `code` for a session has a genuine
 * side effect (writing an auth cookie), and only a Route Handler (or a
 * Server Action) can do that, per `@supabase/ssr`'s own constraints — see
 * `shared/lib/supabase/server.ts`.
 *
 * Today's only caller is `requestPasswordResetAction`, which builds the
 * link as `${origin}/auth/callback?next=/redefinir-senha`. `next` is
 * re-validated here with the same `safeRedirectTarget` used everywhere else
 * `?next=` is trusted — this URL is itself sent by e-mail, so it is exactly
 * as attacker-reachable as any other entry point into the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeRedirectTarget(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error(
      'GET /auth/callback: exchangeCodeForSession failed — link expired, already used, or invalid.',
      error,
    );
  }

  // Today's only caller is the password-reset flow — sending the user back
  // to request a fresh link is the correct next step for that flow
  // specifically, not a generic assumption this handler should keep making
  // if a second caller (e.g. e-mail confirmation) is ever added here.
  return NextResponse.redirect(`${origin}/esqueci-senha`);
}
