import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import supertest from 'supertest';
import { app } from '../app.ts';
import { AuthorModel } from '../models/author.model.ts';
import { BookModel } from '../models/book.model.ts';

let mongod: MongoMemoryServer;
let authorId: string;
const request = supertest(app);

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
  const author = await AuthorModel.create({ name: 'Franz Kafka' });
  authorId = String(author._id);
});

test('POST /books creates a book and returns 201', async () => {
  const res = await request.post('/books').send({ title: 'The Trial', authorId });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.title, 'The Trial');
  assert.ok(res.body._id);
});

test('POST /books returns 422 if title is missing', async () => {
  const res = await request.post('/books').send({ authorId });
  assert.strictEqual(res.status, 422);
  assert.strictEqual(res.body.type, '/errors/validation');
});

test('POST /books returns 422 if authorId is invalid ObjectId', async () => {
  const res = await request.post('/books').send({ title: 'The Trial', authorId: 'bad-id' });
  assert.strictEqual(res.status, 422);
  assert.strictEqual(res.body.type, '/errors/validation');
});

test('GET /books returns paginated list', async () => {
  await BookModel.insertMany([
    { title: 'Book A', authorId },
    { title: 'Book B', authorId },
    { title: 'Book C', authorId },
  ]);
  const res = await request.get('/books?page=1&limit=2');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 2);
  assert.strictEqual(res.body.total, 3);
  assert.strictEqual(res.body.totalPages, 2);
});

test('GET /books filters by title (case-insensitive)', async () => {
  await BookModel.insertMany([
    { title: 'The Trial', authorId },
    { title: 'The Castle', authorId },
  ]);
  const res = await request.get('/books?title=trial');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 1);
  assert.strictEqual(res.body.data[0].title, 'The Trial');
});

test('GET /books filters by genre (case-insensitive)', async () => {
  await BookModel.insertMany([
    { title: 'Book A', authorId, genre: 'Fiction' },
    { title: 'Book B', authorId, genre: 'Non-Fiction' },
  ]);
  const res = await request.get('/books?genre=fiction');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 1);
  assert.strictEqual(res.body.data[0].genre, 'Fiction');
});

test('GET /books/:id returns a book', async () => {
  const book = await BookModel.create({ title: 'The Trial', authorId });
  const res = await request.get(`/books/${book._id}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.title, 'The Trial');
});

test('GET /books/:id returns 404 for unknown id', async () => {
  const res = await request.get('/books/507f1f77bcf86cd799439011');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.type, '/errors/not-found');
});

test('GET /books/:id returns 400 for invalid id format', async () => {
  const res = await request.get('/books/not-an-id');
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.type, '/errors/bad-request');
});

test('PUT /books/:id updates and returns the book', async () => {
  const book = await BookModel.create({ title: 'The Trial', authorId });
  const res = await request.put(`/books/${book._id}`).send({ title: 'Updated Title', authorId });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.title, 'Updated Title');
});

test('PUT /books/:id returns 404 for unknown id', async () => {
  const res = await request.put('/books/507f1f77bcf86cd799439011').send({ title: 'X', authorId });
  assert.strictEqual(res.status, 404);
});

test('DELETE /books/:id deletes the book and returns 204', async () => {
  const book = await BookModel.create({ title: 'The Trial', authorId });
  const res = await request.delete(`/books/${book._id}`);
  assert.strictEqual(res.status, 204);
  const found = await BookModel.findById(book._id);
  assert.strictEqual(found, null);
});

test('DELETE /books/:id returns 404 for unknown id', async () => {
  const res = await request.delete('/books/507f1f77bcf86cd799439011');
  assert.strictEqual(res.status, 404);
});
