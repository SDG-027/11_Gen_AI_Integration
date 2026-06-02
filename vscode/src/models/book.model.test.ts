import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AuthorModel } from './author.model.ts';
import { BookModel } from './book.model.ts';

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

test('creates book with required fields', async () => {
  const author = await AuthorModel.create({ name: 'Franz Kafka' });
  const book = await BookModel.create({ title: 'The Trial', authorId: author._id });
  assert.strictEqual(book.title, 'The Trial');
  assert.deepStrictEqual(book.authorId, author._id);
  assert.ok(book.createdAt);
});

test('rejects book without title', async () => {
  const author = await AuthorModel.create({ name: 'Franz Kafka' });
  await assert.rejects(
    () => BookModel.create({ authorId: author._id }),
    (err: Error) => err.constructor.name === 'ValidationError'
  );
});

test('rejects book without authorId', async () => {
  await assert.rejects(
    () => BookModel.create({ title: 'The Trial' }),
    (err: Error) => err.constructor.name === 'ValidationError'
  );
});

test('saves all optional fields', async () => {
  const author = await AuthorModel.create({ name: 'Franz Kafka' });
  const book = await BookModel.create({
    title: 'The Trial',
    authorId: author._id,
    isbn: '978-0-7432-7754-2',
    publishedYear: 1925,
    genre: 'Fiction',
    description: 'A novel about bureaucratic absurdity',
  });
  assert.strictEqual(book.isbn, '978-0-7432-7754-2');
  assert.strictEqual(book.publishedYear, 1925);
  assert.strictEqual(book.genre, 'Fiction');
  assert.strictEqual(book.description, 'A novel about bureaucratic absurdity');
});
