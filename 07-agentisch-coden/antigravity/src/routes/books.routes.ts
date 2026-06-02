import { Router } from 'express';
import { validate } from '../middleware/validate.ts';
import {
  createBookSchema,
  updateBookSchema,
  getBookParamsSchema,
} from '../schemas/book.schema.ts';
import {
  createBook,
  getAllBooks,
  getBookById,
  updateBook,
  deleteBook,
} from '../controllers/books.controller.ts';

const router = Router();

router.get('/', getAllBooks);
router.post('/', validate(createBookSchema), createBook);
router.get('/:id', validate(getBookParamsSchema), getBookById);
router.put('/:id', validate(updateBookSchema), updateBook);
router.delete('/:id', validate(getBookParamsSchema), deleteBook);

export default router;
