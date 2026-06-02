import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AuthorModel } from './author.model.ts';

let mongod: MongoMemoryServer;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

test('creates author with required name', async () => {
  const author = await AuthorModel.create({ name: 'Franz Kafka' });
  assert.strictEqual(author.name, 'Franz Kafka');
  assert.ok(author._id);
  assert.ok(author.createdAt);
  assert.ok(author.updatedAt);
});

test('rejects author without name', async () => {
  await assert.rejects(
    () => AuthorModel.create({}),
    (err: Error) => err.constructor.name === 'ValidationError'
  );
});

test('saves optional bio and birthYear', async () => {
  const author = await AuthorModel.create({
    name: 'Goethe',
    bio: 'German writer and polymath',
    birthYear: 1749,
  });
  assert.strictEqual(author.bio, 'German writer and polymath');
  assert.strictEqual(author.birthYear, 1749);
});
