import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it, type TestContext } from 'node:test';

import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Integration tests for `record_page_visit`/`record_whatsapp_click`
 * (`supabase/migrations/20260811000000_add_analytics_write_functions.sql`,
 * AN2 + AN4) — the RPCs, not the (not-yet-built) app wiring (AN3/AN5).
 * Same shape as `tests/lead-submission.integration.test.ts`: a real
 * integration suite against the configured Supabase project, self-skipping
 * when it isn't configured, because the logic under test lives in Postgres.
 *
 * Data footprint, deliberately asymmetric between the two functions. This
 * project has no service role key, so rows created here are never cleaned
 * up (same accepted tradeoff `lead-submission.integration.test.ts` already
 * makes). `record_whatsapp_click`'s rate limit (5/3600s, deliberately equal
 * to `submit_lead`'s own) is cheap to saturate exactly like that suite
 * already does (6 calls). `record_page_visit`'s rate limit (60/60s) is NOT
 * saturated here on purpose: doing so would insert 60 real rows just to
 * re-prove a `count(*) >= threshold` cutoff mechanism that is already
 * exercised, at a smaller and cheaper threshold, by both
 * `record_whatsapp_click`'s own test below and by
 * `lead-submission.integration.test.ts`'s pre-existing coverage — the SQL
 * shape is identical, only the literal numbers differ. What IS specific to
 * `record_page_visit` and therefore worth its own proof is the bot filter
 * (below), which costs zero rows regardless of how many times it runs,
 * since a filtered call never reaches the insert.
 *
 * Bot-filter proof, and why it doesn't need a real row to be conclusive.
 * `is_bot_user_agent(...)`-matched calls return `true` WITHOUT touching the
 * rate limit counter at all (see the migration's own header). Calling
 * `record_page_visit` with a bot User-Agent MORE times than the real 60/60s
 * limit would ever allow, all on one fresh `ip_hash`, and asserting every
 * single call still returns `true`, is a real (not just plausible) proof
 * that those calls never reached the counting query — if they had, the
 * 61st+ call would have returned `false`, exactly like the real rate-limit
 * test elsewhere in this suite demonstrates the counter does trip.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const canRun = Boolean(SUPABASE_URL && SUPABASE_KEY);
const skipReason =
  'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, with the migration already applied, to run this suite.';

const supabase = canRun ? createClient(SUPABASE_URL!, SUPABASE_KEY!) : null;

function freshIpHash(label: string): string {
  return `analytics-write-test-${label}-${randomUUID()}`;
}

const REAL_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

type ValidPair = { representativeSlug: string; productSlug: string };
type EmbeddedActivationRow = {
  status: string;
  representative: { slug: string; status: string } | null;
  product: { slug: string } | null;
};

/**
 * Same technique as `lead-submission.integration.test.ts`'s own
 * `findPublishedActivation`, adapted to return slugs instead of ids —
 * `record_page_visit`/`record_whatsapp_click` resolve by slug+slug, never
 * by id (see the migration's own header for why). Discovers a real pair
 * through the same public SELECT policies
 * (`product_activations_select_published` / `representatives_select_public`)
 * a real Commercial Page relies on, rather than hardcoding ids/slugs from
 * whichever project happens to be configured.
 */
async function findPublishedActivation(supabase: SupabaseClient): Promise<ValidPair | null> {
  const { data } = await supabase
    .from('product_activations')
    .select(
      `
      status,
      representative:representatives!inner ( slug, status ),
      product:products!inner ( slug )
    `,
    )
    .eq('status', 'published')
    .limit(1);

  const row = data?.[0] as EmbeddedActivationRow | undefined;
  if (!row?.representative || !row.product) return null;
  if (row.representative.status !== 'active') return null;

  return { representativeSlug: row.representative.slug, productSlug: row.product.slug };
}

const pairSkipReason =
  'No published (representative, product) pair found in the configured Supabase project — ' +
  'these tests cannot provision one with the anon key. Create one manually (see supabase/README.md) to run them.';

let pairLookup: Promise<ValidPair | null> | null = null;
async function requirePair(t: TestContext): Promise<ValidPair | null> {
  if (!supabase) return null;
  pairLookup ??= findPublishedActivation(supabase);
  const pair = await pairLookup;
  if (!pair) {
    t.skip(pairSkipReason);
  }
  return pair;
}

async function recordPageVisit(args: Record<string, unknown>): Promise<{ data: boolean | null; error: PostgrestError | null }> {
  const { data, error } = await supabase!.rpc('record_page_visit', args);
  return { data: data as boolean | null, error };
}

async function recordWhatsappClick(
  args: Record<string, unknown>,
): Promise<{ data: boolean | null; error: PostgrestError | null }> {
  const { data, error } = await supabase!.rpc('record_whatsapp_click', args);
  return { data: data as boolean | null, error };
}

describe('record_page_visit RPC (Postgres, integration)', { skip: !canRun && skipReason }, () => {
  it('rejects an unknown (representative, product) slug pair without needing real fixture data', async () => {
    const { data, error } = await recordPageVisit({
      p_representative_slug: `no-such-representative-${randomUUID()}`,
      p_product_slug: `no-such-product-${randomUUID()}`,
      p_referrer: null,
      p_ip_hash: freshIpHash('unknown-pair'),
      p_user_agent: REAL_UA,
    });
    assert.equal(error, null);
    assert.equal(data, false);
  });

  it('rejects a null/empty ip_hash cleanly (typed false, not a raw NOT NULL constraint error)', async () => {
    const { data, error } = await recordPageVisit({
      p_representative_slug: 'irrelevant',
      p_product_slug: 'irrelevant',
      p_referrer: null,
      p_ip_hash: null,
      p_user_agent: REAL_UA,
    });
    assert.equal(error, null);
    assert.equal(data, false);
  });

  it('a bot-flagged User-Agent returns true without ever being rate-limited — proves it never reaches the counter, not just that one call happened to succeed', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const ipHash = freshIpHash('bot-filter');
    // One more than the real 60/60s limit: if these calls were actually being
    // counted, the 61st would return false, exactly like the real rate-limit
    // test below demonstrates for record_whatsapp_click's own counter.
    const callCount = 61;
    const results: boolean[] = [];
    for (let i = 0; i < callCount; i++) {
      const { data, error } = await recordPageVisit({
        p_representative_slug: pair.representativeSlug,
        p_product_slug: pair.productSlug,
        p_referrer: 'https://example.invalid/bot-test',
        p_ip_hash: ipHash,
        p_user_agent: BOT_UA,
      });
      assert.equal(error, null);
      results.push(data === true);
    }

    assert.ok(
      results.every((r) => r === true),
      `expected all ${callCount} bot-flagged calls to return true (never rate-limited); got ${JSON.stringify(results)}`,
    );
  });

  it('a well-formed visit is accepted (happy path)', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const { data, error } = await recordPageVisit({
      p_representative_slug: pair.representativeSlug,
      p_product_slug: pair.productSlug,
      p_referrer: 'https://example.invalid/happy-path',
      p_ip_hash: freshIpHash('happy-path'),
      p_user_agent: REAL_UA,
    });
    assert.equal(error, null);
    assert.equal(data, true);
  });

  it('a fresh origin is unaffected by another origin making several calls', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const busyIp = freshIpHash('busy-origin');
    for (let i = 0; i < 3; i++) {
      await recordPageVisit({
        p_representative_slug: pair.representativeSlug,
        p_product_slug: pair.productSlug,
        p_referrer: null,
        p_ip_hash: busyIp,
        p_user_agent: REAL_UA,
      });
    }

    const { data, error } = await recordPageVisit({
      p_representative_slug: pair.representativeSlug,
      p_product_slug: pair.productSlug,
      p_referrer: null,
      p_ip_hash: freshIpHash('fresh-origin'),
      p_user_agent: REAL_UA,
    });
    assert.equal(error, null);
    assert.equal(data, true, 'a different ip_hash must not be affected by another origin making several calls');
  });
});

describe('record_whatsapp_click RPC (Postgres, integration)', { skip: !canRun && skipReason }, () => {
  it('rejects an unknown (representative, product) slug pair without needing real fixture data', async () => {
    const { data, error } = await recordWhatsappClick({
      p_representative_slug: `no-such-representative-${randomUUID()}`,
      p_product_slug: `no-such-product-${randomUUID()}`,
      p_referrer: null,
      p_ip_hash: freshIpHash('unknown-pair'),
      p_user_agent: REAL_UA,
    });
    assert.equal(error, null);
    assert.equal(data, false);
  });

  it('a bot-flagged User-Agent returns true without ever being rate-limited, up to and past the real 5/3600s limit', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const ipHash = freshIpHash('bot-filter');
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const { data, error } = await recordWhatsappClick({
        p_representative_slug: pair.representativeSlug,
        p_product_slug: pair.productSlug,
        p_referrer: null,
        p_ip_hash: ipHash,
        p_user_agent: BOT_UA,
      });
      assert.equal(error, null);
      results.push(data === true);
    }

    assert.ok(
      results.every((r) => r === true),
      `expected all 6 bot-flagged calls to return true (never rate-limited); got ${JSON.stringify(results)}`,
    );
  });

  it('enforces the fixed 5-per-hour limit and cannot be raised by the caller: the 6th call from one origin is rejected', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const ipHash = freshIpHash('rate-limit');
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const { data, error } = await recordWhatsappClick({
        p_representative_slug: pair.representativeSlug,
        p_product_slug: pair.productSlug,
        p_referrer: 'https://example.invalid/rate-limit-test',
        p_ip_hash: ipHash,
        p_user_agent: REAL_UA,
      });
      assert.equal(error, null);
      results.push(data === true);
    }

    assert.deepEqual(
      results,
      [true, true, true, true, true, false],
      'exactly 5 clicks from one origin must succeed before the 6th is rejected — the same threshold submit_lead ' +
        'already enforces, deliberately reused here (see the migration header for why)',
    );
  });

  it('a fresh origin is unaffected by another origin already at its limit', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const exhaustedIp = freshIpHash('exhausted-origin');
    for (let i = 0; i < 5; i++) {
      await recordWhatsappClick({
        p_representative_slug: pair.representativeSlug,
        p_product_slug: pair.productSlug,
        p_referrer: null,
        p_ip_hash: exhaustedIp,
        p_user_agent: REAL_UA,
      });
    }

    const { data, error } = await recordWhatsappClick({
      p_representative_slug: pair.representativeSlug,
      p_product_slug: pair.productSlug,
      p_referrer: null,
      p_ip_hash: freshIpHash('fresh-origin'),
      p_user_agent: REAL_UA,
    });
    assert.equal(error, null);
    assert.equal(data, true, 'a different ip_hash must not be blocked by another origin exhausting its own limit');
  });

  it('a well-formed click is accepted (happy path)', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const { data, error } = await recordWhatsappClick({
      p_representative_slug: pair.representativeSlug,
      p_product_slug: pair.productSlug,
      p_referrer: 'https://example.invalid/happy-path',
      p_ip_hash: freshIpHash('happy-path'),
      p_user_agent: REAL_UA,
    });
    assert.equal(error, null);
    assert.equal(data, true);
  });
});

describe('analytics write functions — controls', { skip: !canRun && skipReason }, () => {
  it('reads the seeded catalog, proving the key and project are reachable', async () => {
    const { data, error } = await supabase!.from('products').select('slug');
    assert.equal(error, null, `products: unexpected error ${error?.code}: ${error?.message}`);
    assert.ok((data?.length ?? 0) > 0, 'expected the D1 catalog seed to be applied');
  });
});
