# Books & Authors REST API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a REST API for managing books and authors with full CRUD, pagination, search, and RFC 7807 error responses, running on Node 24 + TypeScript + Express 5 + Mongoose.

**Architecture:** Layer-based MVC — Zod schemas and Mongoose models are independent units, controllers contain request handlers (no try/catch: Express 5 auto-catches async throws), routes wire middleware + controllers, and `app.ts` assembles the Express app. `server.ts` is the entry point that connects to MongoDB. No build step; Node 24 runs `.ts` files directly via `--experimental-strip-types`.

**Tech Stack:** Node 24 (`--experimental-strip-types`, `--env-file`), TypeScript 6, Express 5, Mongoose 8, Zod 3, node:test, supertest, mongodb-memory-server

---

## File Map

| File | Responsibility |
|---|---|
| `package.json` | Dependencies, npm scripts |
| `tsconfig.json` | TypeScript config (`noEmit: true` — Node handles transpilation) |
| `.env` | Port + MongoDB URI |
| `src/server.ts` | Entry point — connects MongoDB, starts Express |
| `src/app.ts` | Express setup — JSON middleware, routes, error handler |
| `src/middleware/errorHandler.ts` | Global RFC 7807 error handler + `AppError` class |
| `src/middleware/validate.ts` | Zod validation middleware factory |
| `src/models/author.model.ts` | Author Mongoose schema + model export (no classes) |
| `src/models/book.model.ts` | Book Mongoose schema + model export (no classes) |
| `src/schemas/author.schema.ts` | Zod create/update schemas for Author |
| `src/schemas/book.schema.ts` | Zod create/update schemas for Book |
| `src/controllers/authors.controller.ts` | listAuthors, getAuthor, createAuthor, updateAuthor, deleteAuthor |
| `src/controllers/books.controller.ts` | listBooks, getBook, createBook, updateBook, deleteBook |
| `src/routes/authors.routes.ts` | Express Router for /authors |
| `src/routes/books.routes.ts` | Express Router for /books |

Test files mirror their source: `src/middleware/validate.test.ts`, `src/controllers/authors.test.ts`, etc.

---

### Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "books-authors-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node --env-file=.env src/server.ts",
    "dev": "node --watch --env-file=.env src/server.ts",
    "test": "node --experimental-strip-types --test 'src/**/*.test.ts'"
  },
  "dependencies": {
    "express": "^5.0.0",
    "mongoose": "^8.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/supertest": "^6.0.0",
    "mongodb-memory-server": "^10.0.0",
    "supertest": "^7.0.0",
    "typescript": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

`noEmit: true` — `tsc` is only used for type-checking; Node 24 handles execution.

- [ ] **Step 3: Create .env**

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/books-authors
```

- [ ] **Step 4: Install dependencies and create directory structure**

```bash
npm install
mkdir -p src/routes src/models src/controllers src/schemas src/middleware
```

- [ ] **Step 5: Verify Node can run TypeScript directly**

Create `src/health.ts`:
```typescript
const msg: string = 'TypeScript works';
console.log(msg);
```

Run:
```bash
node --experimental-strip-types src/health.ts
```
Expected output: `TypeScript works`

Delete `src/health.ts`.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json .env
git commit -m "chore: project setup — Node 24 + TypeScript + Express 5 + Mongoose"
```

---

### Task 2: Error Handler Middleware

**Files:**
- Create: `src/middleware/errorHandler.ts`
- Create: `src/middleware/errorHandler.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/middleware/errorHandler.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --test src/middleware/errorHandler.test.ts
```
Expected: Error — `errorHandler.ts` doesn't exist yet.

- [ ] **Step 3: Implement errorHandler.ts**

Create `src/middleware/errorHandler.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';

export class AppError extends Error {
  constructor(
    public status: number,
    public type: string,
    public title: string,
    public detail: string
  ) {
    super(detail);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      type: `/errors/${err.type}`,
      title: err.title,
      status: err.status,
      detail: err.detail,
    });
    return;
  }

  if (err instanceof MongooseError.CastError) {
    res.status(400).json({
      type: '/errors/bad-request',
      title: 'Bad Request',
      status: 400,
      detail: `Invalid value for field '${err.path}': ${err.value}`,
    });
    return;
  }

  if (err instanceof MongooseError.ValidationError) {
    res.status(422).json({
      type: '/errors/validation',
      title: 'Unprocessable Entity',
      status: 422,
      detail: 'Document validation failed',
      errors: Object.values(err.errors).map((e) => ({
        path: e.path,
        message: e.message,
      })),
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    type: '/errors/internal',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred',
  });
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
node --experimental-strip-types --test src/middleware/errorHandler.test.ts
```
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/middleware/errorHandler.ts src/middleware/errorHandler.test.ts
git commit -m "feat: add RFC 7807 error handler middleware and AppError class"
```

---

### Task 3: Validate Middleware

**Files:**
- Create: `src/middleware/validate.ts`
- Create: `src/middleware/validate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/middleware/validate.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --test src/middleware/validate.test.ts
```
Expected: Error — `validate.ts` doesn't exist yet.

- [ ] **Step 3: Implement validate.ts**

Create `src/middleware/validate.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(422).json({
        type: '/errors/validation',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Request body validation failed',
        errors: result.error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
node --experimental-strip-types --test src/middleware/validate.test.ts
```
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/middleware/validate.ts src/middleware/validate.test.ts
git commit -m "feat: add Zod validation middleware"
```

---

### Task 4: Author Mongoose Model

**Files:**
- Create: `src/models/author.model.ts`
- Create: `src/models/author.model.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/models/author.model.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --test src/models/author.model.test.ts
```
Expected: Error — `author.model.ts` doesn't exist yet.

- [ ] **Step 3: Implement author.model.ts**

Create `src/models/author.model.ts`:
```typescript
import { Schema, model } from 'mongoose';

interface IAuthor {
  name: string;
  bio?: string;
  birthYear?: number;
  createdAt: Date;
  updatedAt: Date;
}

const authorSchema = new Schema<IAuthor>(
  {
    name: { type: String, required: true },
    bio: String,
    birthYear: Number,
  },
  { timestamps: true }
);

export const AuthorModel = model<IAuthor>('Author', authorSchema);
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
node --experimental-strip-types --test src/models/author.model.test.ts
```
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/models/author.model.ts src/models/author.model.test.ts
git commit -m "feat: add Author Mongoose model"
```

---

### Task 5: Book Mongoose Model

**Files:**
- Create: `src/models/book.model.ts`
- Create: `src/models/book.model.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/models/book.model.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --test src/models/book.model.test.ts
```
Expected: Error — `book.model.ts` doesn't exist yet.

- [ ] **Step 3: Implement book.model.ts**

Create `src/models/book.model.ts`:
```typescript
import { Schema, model, Types } from 'mongoose';

interface IBook {
  title: string;
  authorId: Types.ObjectId;
  isbn?: string;
  publishedYear?: number;
  genre?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<IBook>(
  {
    title: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'Author', required: true },
    isbn: String,
    publishedYear: Number,
    genre: String,
    description: String,
  },
  { timestamps: true }
);

export const BookModel = model<IBook>('Book', bookSchema);
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
node --experimental-strip-types --test src/models/book.model.test.ts
```
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/models/book.model.ts src/models/book.model.test.ts
git commit -m "feat: add Book Mongoose model"
```

---

### Task 6: Author Zod Schemas

**Files:**
- Create: `src/schemas/author.schema.ts`
- Create: `src/schemas/author.schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/schemas/author.schema.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --test src/schemas/author.schema.test.ts
```
Expected: Error — `author.schema.ts` doesn't exist yet.

- [ ] **Step 3: Implement author.schema.ts**

Create `src/schemas/author.schema.ts`:
```typescript
import { z } from 'zod';

export const createAuthorSchema = z.object({
  name: z.string().min(1),
  bio: z.string().optional(),
  birthYear: z.number().int().optional(),
});

export const updateAuthorSchema = createAuthorSchema.partial();

export type CreateAuthorInput = z.infer<typeof createAuthorSchema>;
export type UpdateAuthorInput = z.infer<typeof updateAuthorSchema>;
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
node --experimental-strip-types --test src/schemas/author.schema.test.ts
```
Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/author.schema.ts src/schemas/author.schema.test.ts
git commit -m "feat: add Author Zod validation schemas"
```

---

### Task 7: Book Zod Schemas

**Files:**
- Create: `src/schemas/book.schema.ts`
- Create: `src/schemas/book.schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/schemas/book.schema.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --experimental-strip-types --test src/schemas/book.schema.test.ts
```
Expected: Error — `book.schema.ts` doesn't exist yet.

- [ ] **Step 3: Implement book.schema.ts**

Create `src/schemas/book.schema.ts`:
```typescript
import { z } from 'zod';

export const createBookSchema = z.object({
  title: z.string().min(1),
  authorId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId'),
  isbn: z.string().optional(),
  publishedYear: z.number().int().optional(),
  genre: z.string().optional(),
  description: z.string().optional(),
});

export const updateBookSchema = createBookSchema.partial();

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
node --experimental-strip-types --test src/schemas/book.schema.test.ts
```
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/book.schema.ts src/schemas/book.schema.test.ts
git commit -m "feat: add Book Zod validation schemas"
```

---

### Task 8: app.ts, server.ts, and Route Stubs

Routes are stubbed here so `app.ts` can be imported by integration tests in Tasks 9 and 10. The stubs are replaced by real implementations in those tasks.

**Files:**
- Create: `src/app.ts`
- Create: `src/server.ts`
- Create: `src/routes/authors.routes.ts` (stub)
- Create: `src/routes/books.routes.ts` (stub)

- [ ] **Step 1: Create stub route files**

Create `src/routes/authors.routes.ts`:
```typescript
import { Router } from 'express';

export const authorsRouter = Router();
```

Create `src/routes/books.routes.ts`:
```typescript
import { Router } from 'express';

export const booksRouter = Router();
```

- [ ] **Step 2: Implement app.ts**

Create `src/app.ts`:
```typescript
import express from 'express';
import { authorsRouter } from './routes/authors.routes.ts';
import { booksRouter } from './routes/books.routes.ts';
import { errorHandler } from './middleware/errorHandler.ts';

export const app = express();

app.use(express.json());

app.use('/authors', authorsRouter);
app.use('/books', booksRouter);

app.use(errorHandler);
```

- [ ] **Step 3: Implement server.ts**

Create `src/server.ts`:
```typescript
import mongoose from 'mongoose';
import { app } from './app.ts';

const PORT = process.env.PORT ?? 3000;
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/books-authors';

mongoose
  .connect(String(MONGODB_URI))
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(Number(PORT), () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err: unknown) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
```

- [ ] **Step 4: Commit**

```bash
git add src/app.ts src/server.ts src/routes/authors.routes.ts src/routes/books.routes.ts
git commit -m "feat: add Express app, server entry point, and route stubs"
```

---

### Task 9: Authors Controller + Routes

**Files:**
- Create: `src/controllers/authors.controller.ts`
- Modify: `src/routes/authors.routes.ts` (replace stub)
- Create: `src/controllers/authors.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/controllers/authors.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --experimental-strip-types --test src/controllers/authors.test.ts
```
Expected: All tests fail with 404 (stub router has no handlers yet).

- [ ] **Step 3: Implement authors.controller.ts**

Create `src/controllers/authors.controller.ts`:
```typescript
import { Request, Response } from 'express';
import { AuthorModel } from '../models/author.model.ts';
import { AppError } from '../middleware/errorHandler.ts';

export async function listAuthors(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (req.query.name) {
    filter.name = { $regex: String(req.query.name), $options: 'i' };
  }

  const [data, total] = await Promise.all([
    AuthorModel.find(filter).skip(skip).limit(limit),
    AuthorModel.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function getAuthor(req: Request, res: Response): Promise<void> {
  const author = await AuthorModel.findById(req.params.id);
  if (!author) {
    throw new AppError(404, 'not-found', 'Not Found', `Author with id '${req.params.id}' not found`);
  }
  res.json(author);
}

export async function createAuthor(req: Request, res: Response): Promise<void> {
  const author = await AuthorModel.create(req.body);
  res.status(201).json(author);
}

export async function updateAuthor(req: Request, res: Response): Promise<void> {
  const author = await AuthorModel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!author) {
    throw new AppError(404, 'not-found', 'Not Found', `Author with id '${req.params.id}' not found`);
  }
  res.json(author);
}

export async function deleteAuthor(req: Request, res: Response): Promise<void> {
  const author = await AuthorModel.findByIdAndDelete(req.params.id);
  if (!author) {
    throw new AppError(404, 'not-found', 'Not Found', `Author with id '${req.params.id}' not found`);
  }
  res.status(204).send();
}
```

Note: No try/catch needed. Express 5 automatically catches errors thrown from async handlers and forwards them to `errorHandler`.

- [ ] **Step 4: Replace stub with real authors.routes.ts**

Overwrite `src/routes/authors.routes.ts`:
```typescript
import { Router } from 'express';
import { validate } from '../middleware/validate.ts';
import { createAuthorSchema, updateAuthorSchema } from '../schemas/author.schema.ts';
import {
  listAuthors,
  getAuthor,
  createAuthor,
  updateAuthor,
  deleteAuthor,
} from '../controllers/authors.controller.ts';

export const authorsRouter = Router();

authorsRouter.get('/', listAuthors);
authorsRouter.get('/:id', getAuthor);
authorsRouter.post('/', validate(createAuthorSchema), createAuthor);
authorsRouter.put('/:id', validate(updateAuthorSchema), updateAuthor);
authorsRouter.delete('/:id', deleteAuthor);
```

- [ ] **Step 5: Run tests and verify they pass**

```bash
node --experimental-strip-types --test src/controllers/authors.test.ts
```
Expected: 11 passing tests.

- [ ] **Step 6: Commit**

```bash
git add src/controllers/authors.controller.ts src/routes/authors.routes.ts src/controllers/authors.test.ts
git commit -m "feat: add authors CRUD endpoints with pagination and search"
```

---

### Task 10: Books Controller + Routes

**Files:**
- Create: `src/controllers/books.controller.ts`
- Modify: `src/routes/books.routes.ts` (replace stub)
- Create: `src/controllers/books.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/controllers/books.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --experimental-strip-types --test src/controllers/books.test.ts
```
Expected: All tests fail with 404 (stub router has no handlers yet).

- [ ] **Step 3: Implement books.controller.ts**

Create `src/controllers/books.controller.ts`:
```typescript
import { Request, Response } from 'express';
import { BookModel } from '../models/book.model.ts';
import { AppError } from '../middleware/errorHandler.ts';

export async function listBooks(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (req.query.title) {
    filter.title = { $regex: String(req.query.title), $options: 'i' };
  }
  if (req.query.genre) {
    filter.genre = { $regex: String(req.query.genre), $options: 'i' };
  }

  const [data, total] = await Promise.all([
    BookModel.find(filter).skip(skip).limit(limit),
    BookModel.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function getBook(req: Request, res: Response): Promise<void> {
  const book = await BookModel.findById(req.params.id);
  if (!book) {
    throw new AppError(404, 'not-found', 'Not Found', `Book with id '${req.params.id}' not found`);
  }
  res.json(book);
}

export async function createBook(req: Request, res: Response): Promise<void> {
  const book = await BookModel.create(req.body);
  res.status(201).json(book);
}

export async function updateBook(req: Request, res: Response): Promise<void> {
  const book = await BookModel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!book) {
    throw new AppError(404, 'not-found', 'Not Found', `Book with id '${req.params.id}' not found`);
  }
  res.json(book);
}

export async function deleteBook(req: Request, res: Response): Promise<void> {
  const book = await BookModel.findByIdAndDelete(req.params.id);
  if (!book) {
    throw new AppError(404, 'not-found', 'Not Found', `Book with id '${req.params.id}' not found`);
  }
  res.status(204).send();
}
```

- [ ] **Step 4: Replace stub with real books.routes.ts**

Overwrite `src/routes/books.routes.ts`:
```typescript
import { Router } from 'express';
import { validate } from '../middleware/validate.ts';
import { createBookSchema, updateBookSchema } from '../schemas/book.schema.ts';
import {
  listBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
} from '../controllers/books.controller.ts';

export const booksRouter = Router();

booksRouter.get('/', listBooks);
booksRouter.get('/:id', getBook);
booksRouter.post('/', validate(createBookSchema), createBook);
booksRouter.put('/:id', validate(updateBookSchema), updateBook);
booksRouter.delete('/:id', deleteBook);
```

- [ ] **Step 5: Run tests and verify they pass**

```bash
node --experimental-strip-types --test src/controllers/books.test.ts
```
Expected: 12 passing tests.

- [ ] **Step 6: Run the full test suite**

```bash
node --experimental-strip-types --test \
  src/middleware/errorHandler.test.ts \
  src/middleware/validate.test.ts \
  src/models/author.model.test.ts \
  src/models/book.model.test.ts \
  src/schemas/author.schema.test.ts \
  src/schemas/book.schema.test.ts \
  src/controllers/authors.test.ts \
  src/controllers/books.test.ts
```
Expected: All tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/controllers/books.controller.ts src/routes/books.routes.ts src/controllers/books.test.ts
git commit -m "feat: add books CRUD endpoints with pagination and search"
```

---

### Task 11: Smoke Test

Verify the full stack works end-to-end with a running MongoDB instance.

- [ ] **Step 1: Start MongoDB**

With Docker (if no local MongoDB):
```bash
docker run -d -p 27017:27017 --name mongo-dev mongo:7
```

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```
Expected output:
```
Connected to MongoDB
Server running on port 3000
```

- [ ] **Step 3: Create an author**

```bash
curl -s -X POST http://localhost:3000/authors \
  -H 'Content-Type: application/json' \
  -d '{"name":"Franz Kafka","birthYear":1883}' | jq .
```
Expected: `201` with `{ _id, name: "Franz Kafka", birthYear: 1883, createdAt, updatedAt }`.

Copy the `_id` value for Step 4.

- [ ] **Step 4: Create a book**

Replace `<AUTHOR_ID>` with the `_id` from Step 3:
```bash
curl -s -X POST http://localhost:3000/books \
  -H 'Content-Type: application/json' \
  -d '{"title":"The Trial","authorId":"<AUTHOR_ID>","genre":"Fiction","publishedYear":1925}' | jq .
```
Expected: `201` with book JSON.

- [ ] **Step 5: List authors with pagination and search**

```bash
curl -s 'http://localhost:3000/authors?page=1&limit=5&name=kafka' | jq .
```
Expected: `{ data: [{ name: "Franz Kafka", ... }], total: 1, page: 1, limit: 5, totalPages: 1 }`.

- [ ] **Step 6: Test validation error**

```bash
curl -s -X POST http://localhost:3000/authors \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .
```
Expected: `422` with `{ type: "/errors/validation", status: 422, errors: [...] }`.

- [ ] **Step 7: Test 404**

```bash
curl -s http://localhost:3000/authors/507f1f77bcf86cd799439011 | jq .
```
Expected: `404` with `{ type: "/errors/not-found", status: 404 }`.

- [ ] **Step 8: Test invalid ObjectId → 400**

```bash
curl -s http://localhost:3000/authors/not-an-id | jq .
```
Expected: `400` with `{ type: "/errors/bad-request", status: 400 }`.

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "chore: complete books & authors REST API implementation"
```
