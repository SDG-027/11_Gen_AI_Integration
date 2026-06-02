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
