import { test } from 'node:test';
import assert from 'node:assert';
import { z } from 'zod';
import { validate } from './validate.ts';

function makeReqRes(body: unknown) {
  const req = { body } as import('express').Request;
  let _status = 200;
  let _body: unknown;
  let _nextCalled = false;
  const res = {
    status(code: number) { _status = code; return this; },
    json(b: unknown) { _body = b; return this; },
    get _status() { return _status; },
    get _body() { return _body; },
  } as unknown as import('express').Response & { _status: number; _body: unknown };
  const next = () => { _nextCalled = true; };
  return { req, res, next, isNextCalled: () => _nextCalled };
}

const schema = z.object({ name: z.string().min(1) });

test('valid body calls next()', () => {
  const { req, res, next, isNextCalled } = makeReqRes({ name: 'Alice' });
  validate(schema)(req, res, next);
  assert.strictEqual(isNextCalled(), true);
});

test('invalid body returns 422 RFC 7807', () => {
  const { req, res, next } = makeReqRes({});
  validate(schema)(req, res, next);
  assert.strictEqual(res._status, 422);
  const body = res._body as Record<string, unknown>;
  assert.strictEqual(body.status, 422);
  assert.strictEqual(body.type, '/errors/validation');
  assert.ok(Array.isArray(body.errors));
});

test('parsed data is assigned to req.body (strips unknown fields)', () => {
  const strictSchema = z.object({ name: z.string().trim() });
  const { req, res, next } = makeReqRes({ name: '  Alice  ', extra: 'stripped' });
  validate(strictSchema)(req, res, next);
  assert.strictEqual(req.body.name, 'Alice');
  assert.strictEqual(req.body.extra, undefined);
});
