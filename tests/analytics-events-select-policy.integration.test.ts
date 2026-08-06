import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const canRun = Boolean(url && key);
const anon = canRun ? createClient(url!, key!) : null;

describe('analytics_events anonymous privileges (Postgres, integration)', { skip: !canRun }, () => {
  it('denies even safe-column reads to anon', async () => {
    const { error } = await anon!.from('analytics_events').select('id').limit(1);
    assert.ok(error, 'anon unexpectedly retained SELECT on analytics_events');
    assert.match(error.message, /permission denied/i);
  });

  it('denies ip_hash reads to anon explicitly', async () => {
    const { error } = await anon!.from('analytics_events').select('ip_hash').limit(1);
    assert.ok(error, 'anon unexpectedly read ip_hash');
    assert.match(error.message, /permission denied/i);
  });

  for (const operation of ['update', 'delete'] as const) {
    it(`denies direct ${operation.toUpperCase()} to anon`, async () => {
      const query = anon!.from('analytics_events');
      const { error } = operation === 'update'
        ? await query.update({ referrer: 'https://attacker.invalid' }).eq('id', -1)
        : await query.delete().eq('id', -1);
      assert.ok(error, `anon unexpectedly retained ${operation.toUpperCase()}`);
      assert.match(error.message, /permission denied/i);
    });
  }
});
