import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isNextControlFlowError } from '@/shared/lib/next-control-flow-error';

describe('isNextControlFlowError', () => {
  it('recognises a NEXT_REDIRECT digest', () => {
    const error = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/app;307;' });
    assert.equal(isNextControlFlowError(error), true);
  });

  it('recognises a NEXT_HTTP_ERROR_FALLBACK digest', () => {
    const error = Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK'), {
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
    assert.equal(isNextControlFlowError(error), true);
  });

  it('recognises a DYNAMIC_SERVER_USAGE digest — reproduced from a real next build log for /app', () => {
    const error = Object.assign(new Error('Dynamic server usage: cookies'), {
      digest: 'DYNAMIC_SERVER_USAGE',
    });
    assert.equal(isNextControlFlowError(error), true);
  });

  it('does not mistake an unrelated error carrying an unrelated digest for Next control flow', () => {
    const error = Object.assign(new Error('unrelated'), { digest: 'SOME_OTHER_CODE' });
    assert.equal(isNextControlFlowError(error), false);
  });

  it('does not mistake a plain Error with no digest at all', () => {
    assert.equal(isNextControlFlowError(new Error('boom')), false);
  });

  it('handles non-Error values without throwing', () => {
    assert.equal(isNextControlFlowError(null), false);
    assert.equal(isNextControlFlowError(undefined), false);
    assert.equal(isNextControlFlowError('a string'), false);
  });
});
