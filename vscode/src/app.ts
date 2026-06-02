import express from 'express';
import { authorsRouter } from './routes/authors.routes.ts';
import { booksRouter } from './routes/books.routes.ts';
import { errorHandler } from './middleware/errorHandler.ts';

export const app = express();

app.use(express.json());

app.use('/authors', authorsRouter);
app.use('/books', booksRouter);

app.use(errorHandler);
