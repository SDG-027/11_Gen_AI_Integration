import { test } from 'node:test';
import assert from 'node:assert';
import { createAuthorSchema, updateAuthorSchema } from './author.schema.ts';

test('createAuthorSchema requires name', () => {
  const result = createAuthorSchema.safeParse({});
  assert.strictEqual(result.success, false);
  assert.ok(result.error.errors.some((e) => e.path[0] === 'name'));
});

test('createAuthorSchema accepts valid data', () => {
  const result = createAuthorSchema.safeParse({ name: 'Goethe', birthYear: 1749 });
  assert.strictEqual(result.success, true);
  assert.deepStrictEqual(result.data, { name: 'Goethe', birthYear: 1749 });
});

test('createAuthorSchema rejects empty name', () => {
  const result = createAuthorSchema.safeParse({ name: '' });
  assert.strictEqual(result.success, false);
});

test('updateAuthorSchema makes all fields optional', () => {
  const result = updateAuthorSchema.safeParse({});
  assert.strictEqual(result.success, true);
});

test('updateAuthorSchema rejects empty name when provided', () => {
  const result = updateAuthorSchema.safeParse({ name: '' });
  assert.strictEqual(result.success, false);
});
