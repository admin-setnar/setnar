import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aggregateAnalyticsSummary } from '@/modules/analytics/infrastructure/aggregate-analytics-summary';

describe('aggregateAnalyticsSummary (SET-37/AN6)', () => {
  it('groups visits, whatsapp clicks and leads by product_id', () => {
    const summary = aggregateAnalyticsSummary(
      [
        { product_id: 'p1', event_type: 'visit' },
        { product_id: 'p1', event_type: 'visit' },
        { product_id: 'p1', event_type: 'whatsapp_click' },
        { product_id: 'p2', event_type: 'visit' },
      ],
      [{ product_id: 'p1' }, { product_id: 'p1' }, { product_id: 'p2' }],
    );

    assert.deepEqual(
      summary.find((entry) => entry.productId === 'p1'),
      { productId: 'p1', visits: 2, whatsappClicks: 1, leads: 2 },
    );
    assert.deepEqual(
      summary.find((entry) => entry.productId === 'p2'),
      { productId: 'p2', visits: 1, whatsappClicks: 0, leads: 1 },
    );
  });

  it('returns an empty array when there are no events or leads', () => {
    assert.deepEqual(aggregateAnalyticsSummary([], []), []);
  });

  it('produces an entry from a lead alone, with zeroed event counts', () => {
    const summary = aggregateAnalyticsSummary([], [{ product_id: 'p1' }]);

    assert.deepEqual(summary, [{ productId: 'p1', visits: 0, whatsappClicks: 0, leads: 1 }]);
  });

  it('skips leads with a null product_id instead of throwing', () => {
    const summary = aggregateAnalyticsSummary([], [{ product_id: null }, { product_id: 'p1' }]);

    assert.deepEqual(summary, [{ productId: 'p1', visits: 0, whatsappClicks: 0, leads: 1 }]);
  });
});
