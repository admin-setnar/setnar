import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * Same guard as `tests/lead-submission-fixture.test.ts`/
 * `tests/origin-attribution-fixture.test.ts` (SET-79), applied to
 * `analytics-events-origin-grant.integration.test.ts`: that suite must build
 * and tear down its own disposable representative, never discover a real
 * published activation as a target.
 */
const integrationSuite = readFileSync(
  new URL('./analytics-events-origin-grant.integration.test.ts', import.meta.url),
  'utf8',
);

describe('analytics_events origin grant integration fixture', () => {
  it('never discovers a pre-existing published activation as a target', () => {
    assert.doesNotMatch(integrationSuite, /findPublishedActivation|pairLookup|requirePair/);
    assert.doesNotMatch(integrationSuite, /\.eq\('status', 'published'\)/);
    assert.match(integrationSuite, /auth\.admin\.createUser/);
    assert.match(integrationSuite, /from\('representatives'\)[\s\S]*?\.insert\(/);
    assert.match(integrationSuite, /from\('subscriptions'\)[\s\S]*?\.insert\(/);
    assert.match(integrationSuite, /from\('product_activations'\)[\s\S]*?\.insert\(/);
  });

  it('removes the fixture representative and its analytics_events row, and verifies cleanup', () => {
    assert.match(
      integrationSuite,
      /from\('analytics_events'\)\.delete\(\)\.eq\('representative_id', representativeId\)/,
    );
    assert.match(integrationSuite, /from\('representatives'\)\.delete\(\)\.eq\('id', representativeId\)/);
    assert.match(integrationSuite, /assert\.deepEqual\(cleanupErrors, \[\]/);
  });
});
