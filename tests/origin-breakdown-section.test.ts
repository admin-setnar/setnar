import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

/**
 * SET-84 D5 — `OriginBreakdownSection` inside `representative-hub.tsx`.
 * Source-text assertions, same style as `tests/authenticated-app-consolidation.test.ts`:
 * `RepresentativeHub` transitively renders `ProductActivationCard` →
 * `MaterialPreview`'s sibling tree in other flows, and this module already
 * has no existing render test to extend — this checks the contract without
 * standing up a React renderer this project doesn't otherwise use.
 */
const hub = readFileSync(resolve(process.cwd(), 'src/modules/representatives/presentation/representative-hub.tsx'), 'utf8');
const page = readFileSync(resolve(process.cwd(), 'src/app/app/paginas/page.tsx'), 'utf8');

describe('OriginBreakdownSection (SET-84 D5)', () => {
  it('is wired from /app/paginas via listOwnBreakdownByOrigin, same period as the per-product summary', () => {
    assert.match(page, /listOwnBreakdownByOrigin\(representative\.id, periodDays\)/);
    assert.match(page, /originBreakdown=\{originBreakdown\}/);
  });

  it('shows visits and leads side by side per origin — not two separate lists', () => {
    const sectionStart = hub.indexOf('function OriginBreakdownSection');
    assert.ok(sectionStart > 0);
    const section = hub.slice(sectionStart);
    assert.match(section, /Visitas/);
    assert.match(section, /Leads/);
    assert.match(section, /entry\.visits/);
    assert.match(section, /entry\.leads/);
  });

  it('derives the conversion rate in the component, never a stored field', () => {
    const sectionStart = hub.indexOf('function OriginBreakdownSection');
    const section = hub.slice(sectionStart);
    assert.match(section, /entry\.leads \/ entry\.visits/);
    assert.doesNotMatch(section, /conversionRate|conversion_rate/);
  });

  it('labels a null origin instead of hiding or crashing on it', () => {
    assert.match(hub, /entry\.origin \? ORIGIN_LABELS\[entry\.origin\] : UNKNOWN_ORIGIN_LABEL/);
  });
});
