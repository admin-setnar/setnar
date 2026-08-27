import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aggregateOriginBreakdown } from '@/modules/analytics/infrastructure/aggregate-origin-breakdown';

describe('aggregateOriginBreakdown (SET-84 D5)', () => {
  it('groups visits and leads by origin, dropping whatsapp_click on purpose', () => {
    const breakdown = aggregateOriginBreakdown(
      [
        { event_type: 'visit', origin: 'instagram_post' },
        { event_type: 'visit', origin: 'instagram_post' },
        { event_type: 'whatsapp_click', origin: 'instagram_post' },
        { event_type: 'visit', origin: 'whatsapp' },
      ],
      [{ origin: 'instagram_post' }, { origin: 'instagram_post' }, { origin: 'whatsapp' }],
    );

    assert.deepEqual(
      breakdown.find((entry) => entry.origin === 'instagram_post'),
      { origin: 'instagram_post', visits: 2, leads: 2 },
    );
    assert.deepEqual(
      breakdown.find((entry) => entry.origin === 'whatsapp'),
      { origin: 'whatsapp', visits: 1, leads: 1 },
    );
  });

  it('returns an empty array when there are no events or leads', () => {
    assert.deepEqual(aggregateOriginBreakdown([], []), []);
  });

  it('keeps origin: null as its own row, never dropped or merged into another', () => {
    const breakdown = aggregateOriginBreakdown(
      [{ event_type: 'visit', origin: null }],
      [{ origin: null }],
    );

    assert.deepEqual(breakdown, [{ origin: null, visits: 1, leads: 1 }]);
  });

  it('produces an entry from a lead alone, with zeroed visits', () => {
    const breakdown = aggregateOriginBreakdown([], [{ origin: 'qrcode' }]);

    assert.deepEqual(breakdown, [{ origin: 'qrcode', visits: 0, leads: 1 }]);
  });

  it('never counts a whatsapp_click event as a visit, or even as an entry on its own', () => {
    const breakdown = aggregateOriginBreakdown([{ event_type: 'whatsapp_click', origin: 'direct' }], []);

    assert.deepEqual(breakdown, []);
  });
});
