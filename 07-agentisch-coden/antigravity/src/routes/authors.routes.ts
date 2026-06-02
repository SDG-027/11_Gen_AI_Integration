import { Router } from 'express';
import { validate } from '../middleware/validate.ts';
import {
  createAuthorSchema,
  updateAuthorSchema,
  getAuthorParamsSchema,
} from '../schemas/author.schema.ts';
import {
  createAuthor,
  getAllAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
} from '../controllers/authors.controller.ts';

const router = Router();

router.get('/', getAllAuthors);
router.post('/', validate(createAuthorSchema), createAuthor);
router.get('/:id', validate(getAuthorParamsSchema), getAuthorById);
router.put('/:id', validate(updateAuthorSchema), updateAuthor);
router.delete('/:id', validate(getAuthorParamsSchema), deleteAuthor);

export default router;
