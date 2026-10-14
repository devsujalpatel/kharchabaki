import { mock, test } from 'node:test';
import assert from 'node:assert/strict';

const fakeDb = {};
mock.module(new URL('../dist/database/client.js', import.meta.url).href, {
  namedExports: { db: fakeDb },
});

const { addInterval } = await import('../dist/modules/recurring/recurring.route.js');
const { errorHandler } = await import('../dist/middleware/error.middleware.js');
const { ApiError } = await import('../dist/utils/api-error.js');

const utcDate = (year, month, day) => new Date(Date.UTC(year, month - 1, day));

test('monthly recurring dates preserve their anchor across short months', () => {
  assert.equal(addInterval(utcDate(2024, 1, 31), 'monthly', 1, 31).toISOString(), utcDate(2024, 2, 29).toISOString());
  assert.equal(addInterval(utcDate(2024, 2, 29), 'monthly', 1, 31).toISOString(), utcDate(2024, 3, 31).toISOString());
  assert.equal(addInterval(utcDate(2023, 1, 31), 'monthly', 2, 31).toISOString(), utcDate(2023, 3, 31).toISOString());
  assert.equal(addInterval(utcDate(2024, 1, 30), 'monthly', 1, 30).toISOString(), utcDate(2024, 2, 29).toISOString());
});

function invokeErrorHandler(error) {
  const result = { statusCode: 0, body: null };
  const response = {
    status(statusCode) {
      result.statusCode = statusCode;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
  errorHandler(error, { method: 'POST', originalUrl: '/test' }, response, () => {});
  return result;
}

test('error handler preserves safe API errors and maps malformed JSON to 400', () => {
  assert.deepEqual(invokeErrorHandler(new ApiError(409, 'Already exists')), {
    statusCode: 409,
    body: { success: false, message: 'Already exists' },
  });

  const malformed = new SyntaxError('parser internals');
  malformed.status = 400;
  assert.deepEqual(invokeErrorHandler(malformed), {
    statusCode: 400,
    body: { success: false, message: 'Invalid request body' },
  });

  assert.deepEqual(invokeErrorHandler(Object.assign(new Error('body too large'), { status: 413 })), {
    statusCode: 413,
    body: { success: false, message: 'Invalid request' },
  });
});

test('error handler redacts and logs unexpected server failures', () => {
  const original = mock.method(console, 'error', () => {});
  try {
    const result = invokeErrorHandler(new Error('database password leaked'));
    assert.deepEqual(result, {
      statusCode: 500,
      body: { success: false, message: 'An unexpected error occurred.' },
    });
    assert.equal(original.mock.calls.length, 1);
    assert.deepEqual(original.mock.calls[0].arguments[1], {
      method: 'POST',
      path: '/test',
      error: original.mock.calls[0].arguments[1].error,
    });
  } finally {
    original.mock.restore();
  }
});
