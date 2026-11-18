import { test } from 'node:test';
import assert from 'node:assert/strict';
import errorHandler from '../middleware/errorHandler.js';

function handle(nodeEnv, err) {
  const previous = process.env.NODE_ENV;
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;

  const calls = [];
  const original = console.error;
  console.error = (...args) => {
    calls.push(args);
  };

  const res = {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  try {
    errorHandler(err, {}, res, () => {});
    return { res, calls };
  } finally {
    console.error = original;
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

test('production status 500 returns Internal Server Error and logs the real message', () => {
  const secret = 'connect ECONNREFUSED db.internal';
  const err = new Error(secret);
  err.status = 500;
  const { res, calls } = handle('production', err);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Internal Server Error' });
  assert.deepEqual(calls[0], ['Error:', secret]);
});

test('production missing status is a 500 and hides the real message', () => {
  const secret = 'missing-status-secret';
  const err = new Error(secret);
  const { res, calls } = handle('production', err);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Internal Server Error' });
  assert.deepEqual(calls[0], ['Error:', secret]);
});

test('production status 400 still returns err.message and logs it', () => {
  const message = 'name is required';
  const err = new Error(message);
  err.status = 400;
  const { res, calls } = handle('production', err);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: message });
  assert.deepEqual(calls[0], ['Error:', message]);
});

test('unset NODE_ENV status 500 still returns err.message and logs it', () => {
  const message = 'debug-only detail';
  const err = new Error(message);
  err.status = 500;
  const { res, calls } = handle(undefined, err);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: message });
  assert.deepEqual(calls[0], ['Error:', message]);
});
