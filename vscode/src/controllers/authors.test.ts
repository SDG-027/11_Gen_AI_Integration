import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import supertest from 'supertest';
import { app } from '../app.ts';
import { AuthorModel } from '../models/author.model.ts';

let mongod: MongoMemoryServer;
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
});

test('POST /authors creates an author and returns 201', async () => {
  const res = await request.post('/authors').send({ name: 'Franz Kafka' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.name, 'Franz Kafka');
  assert.ok(res.body._id);
});

test('POST /authors returns 422 if name is missing', async () => {
  const res = await request.post('/authors').send({});
  assert.strictEqual(res.status, 422);
  assert.strictEqual(res.body.type, '/errors/validation');
  assert.ok(Array.isArray(res.body.errors));
});

test('GET /authors returns paginated list', async () => {
  await AuthorModel.insertMany([{ name: 'Kafka' }, { name: 'Goethe' }, { name: 'Schiller' }]);
  const res = await request.get('/authors?page=1&limit=2');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 2);
  assert.strictEqual(res.body.total, 3);
  assert.strictEqual(res.body.page, 1);
  assert.strictEqual(res.body.limit, 2);
  assert.strictEqual(res.body.totalPages, 2);
});

test('GET /authors filters by name (case-insensitive)', async () => {
  await AuthorModel.insertMany([{ name: 'Franz Kafka' }, { name: 'Goethe' }]);
  const res = await request.get('/authors?name=kafka');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 1);
  assert.strictEqual(res.body.data[0].name, 'Franz Kafka');
});

test('GET /authors/:id returns an author', async () => {
  const author = await AuthorModel.create({ name: 'Franz Kafka' });
  const res = await request.get(`/authors/${author._id}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.name, 'Franz Kafka');
});

test('GET /authors/:id returns 404 for unknown id', async () => {
  const res = await request.get('/authors/507f1f77bcf86cd799439011');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.type, '/errors/not-found');
});

test('GET /authors/:id returns 400 for invalid id format', async () => {
  const res = await request.get('/authors/not-an-id');
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.type, '/errors/bad-request');
});

test('PUT /authors/:id updates and returns the author', async () => {
  const author = await AuthorModel.create({ name: 'Franz Kafka' });
  const res = await request.put(`/authors/${author._id}`).send({ name: 'Updated Kafka', bio: 'Writer' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.name, 'Updated Kafka');
  assert.strictEqual(res.body.bio, 'Writer');
});

test('PUT /authors/:id returns 404 for unknown id', async () => {
  const res = await request.put('/authors/507f1f77bcf86cd799439011').send({ name: 'X' });
  assert.strictEqual(res.status, 404);
});

test('DELETE /authors/:id deletes the author and returns 204', async () => {
  const author = await AuthorModel.create({ name: 'Franz Kafka' });
  const res = await request.delete(`/authors/${author._id}`);
  assert.strictEqual(res.status, 204);
  const found = await AuthorModel.findById(author._id);
  assert.strictEqual(found, null);
});

test('DELETE /authors/:id returns 404 for unknown id', async () => {
  const res = await request.delete('/authors/507f1f77bcf86cd799439011');
  assert.strictEqual(res.status, 404);
});
