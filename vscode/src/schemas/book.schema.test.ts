import { test } from 'node:test';
import assert from 'node:assert';
import { createBookSchema, updateBookSchema } from './book.schema.ts';

const validObjectId = '507f1f77bcf86cd799439011';

test('createBookSchema requires title and authorId', () => {
  const result = createBookSchema.safeParse({});
  assert.strictEqual(result.success, false);
  const paths = result.error.errors.map((e) => e.path[0]);
  assert.ok(paths.includes('title'));
  assert.ok(paths.includes('authorId'));
});

test('createBookSchema accepts valid data', () => {
  const result = createBookSchema.safeParse({ title: 'The Trial', authorId: validObjectId });
  assert.strictEqual(result.success, true);
});

test('createBookSchema rejects invalid ObjectId', () => {
  const result = createBookSchema.safeParse({ title: 'The Trial', authorId: 'not-an-id' });
  assert.strictEqual(result.success, false);
  assert.ok(result.error.errors.some((e) => e.path[0] === 'authorId'));
});

test('updateBookSchema makes all fields optional', () => {
  const result = updateBookSchema.safeParse({});
  assert.strictEqual(result.success, true);
});
