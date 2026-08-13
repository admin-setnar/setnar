import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const integrationSuite = readFileSync(
  new URL('./lead-submission.integration.test.ts', import.meta.url),
  'utf8',
);

describe('lead submission integration fixture', () => {
  it('never discovers a pre-existing published activation as a write target', () => {
    assert.doesNotMatch(integrationSuite, /findPublishedActivation|pairLookup|requirePair/);
    assert.match(integrationSuite, /auth\.admin\.createUser/);
    assert.match(integrationSuite, /from\('representatives'\)[\s\S]*?\.insert\(/);
    assert.match(integrationSuite, /from\('subscriptions'\)[\s\S]*?\.insert\(/);
    assert.match(integrationSuite, /from\('product_activations'\)[\s\S]*?\.insert\(/);
  });

  it('removes only rows tied to the generated fixture identifiers', () => {
    assert.match(
      integrationSuite,
      /from\('leads'\)\.delete\(\)\.eq\('representative_id', fixtureRepresentativeId\)/,
    );
    assert.match(
      integrationSuite,
      /from\('lead_submission_attempts'\)\.delete\(\)\.in\('ip_hash', \[\.\.\.generatedIpHashes\]\)/,
    );
    assert.doesNotMatch(integrationSuite, /delete\(\)\.like\('ip_hash'/);
  });
});
