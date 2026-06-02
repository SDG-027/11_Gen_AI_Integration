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
