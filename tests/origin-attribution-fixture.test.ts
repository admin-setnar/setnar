import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * Same guard as `tests/lead-submission-fixture.test.ts` (SET-79), applied to
 * `origin-attribution.integration.test.ts`: that suite must build and tear
 * down its own disposable representatives, never discover a real published
 * activation as a write target for analytics_events/leads.
 */
const integrationSuite = readFileSync(
  new URL('./origin-attribution.integration.test.ts', import.meta.url),
  'utf8',
);

describe('origin attribution integration fixture', () => {
  it('never discovers a pre-existing published activation as a write target', () => {
    assert.doesNotMatch(integrationSuite, /findPublishedActivation|pairLookup|requirePair/);
    assert.doesNotMatch(integrationSuite, /\.eq\('status', 'published'\)/);
    assert.match(integrationSuite, /auth\.admin\.createUser/);
    assert.match(integrationSuite, /from\('representatives'\)[\s\S]*?\.insert\(/);
    assert.match(integrationSuite, /from\('subscriptions'\)[\s\S]*?\.insert\(/);
    assert.match(integrationSuite, /from\('product_activations'\)[\s\S]*?\.insert\(/);
  });

  it('removes only rows tied to the two generated fixture identifiers', () => {
    assert.match(
      integrationSuite,
      /from\('analytics_events'\)\.delete\(\)\.eq\('representative_id', fixture\.representativeId\)/,
    );
    assert.match(
      integrationSuite,
      /from\('leads'\)\.delete\(\)\.eq\('representative_id', fixture\.representativeId\)/,
    );
    assert.match(
      integrationSuite,
      /from\('lead_submission_attempts'\)\s*\.delete\(\)\s*\.in\('ip_hash', \[\.\.\.generatedIpHashes\]\)/,
    );
    assert.doesNotMatch(integrationSuite, /delete\(\)\.like\('ip_hash'/);
  });

  it('verifies cleanup by re-querying, the same double-check pattern as the lead-submission fixture', () => {
    assert.match(integrationSuite, /remainingEvents.*=== 0|assert\.equal\(remainingEvents, 0/);
    assert.match(integrationSuite, /assert\.equal\(remainingLeads, 0/);
    assert.match(integrationSuite, /assert\.deepEqual\(cleanupErrors, \[\]/);
  });
});
