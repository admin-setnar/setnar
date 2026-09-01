// Fixture invoked as a standalone script (never as part of `--test`) by
// `tests/service-role-client-boundary.test.ts`, via a bare `tsx` process
// with no `--import` preload and no npm script involved — this is the exact
// "direct invocation" bypass the boundary in
// `tests/support/service-role-client.ts` exists to close. Prints a single
// marker line ONLY if a client was actually constructed, so the test can
// assert on stdout without depending on supabase-js internals.
import { createIntegrationServiceRoleClient } from '../service-role-client';

const client = createIntegrationServiceRoleClient();
if (client) console.log('SERVICE_ROLE_CLIENT_CONSTRUCTED');
else console.log('SKIPPED_NO_SERVICE_ROLE_KEY');
