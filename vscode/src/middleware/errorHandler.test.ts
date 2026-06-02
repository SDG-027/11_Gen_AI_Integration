import { test } from 'node:test';
import assert from 'node:assert';
import { Error as MongooseError } from 'mongoose';
import { AppError, errorHandler } from './errorHandler.ts';

function makeMockRes() {
  let _status = 200;
  let _body: unknown;
  const res = {
    status(code: number) { _status = code; return this; },
    json(body: unknown) { _body = body; return this; },
    get _status() { return _status; },
    get _body() { return _body; },
  };
  return res as unknown as import('express').Response & { _status: number; _body: unknown };
}

test('AppError sends RFC 7807 response', () => {
  const err = new AppError(404, 'not-found', 'Not Found', 'Resource missing');
  const res = makeMockRes();
  errorHandler(err, {} as never, res, () => {});
  assert.strictEqual(res._status, 404);
  assert.deepStrictEqual(res._body, {
    type: '/errors/not-found',
    title: 'Not Found',
    status: 404,
    detail: 'Resource missing',
  });
});

test('Mongoose CastError returns 400', () => {
  const err = new MongooseError.CastError('ObjectId', 'bad-id', '_id');
  const res = makeMockRes();
  errorHandler(err, {} as never, res, () => {});
  assert.strictEqual(res._status, 400);
  assert.strictEqual((res._body as Record<string, unknown>).status, 400);
  assert.strictEqual((res._body as Record<string, unknown>).type, '/errors/bad-request');
});

test('Unknown error returns 500', () => {
  const err = new Error('boom');
  const res = makeMockRes();
  errorHandler(err, {} as never, res, () => {});
  assert.strictEqual(res._status, 500);
  assert.strictEqual((res._body as Record<string, unknown>).status, 500);
});
