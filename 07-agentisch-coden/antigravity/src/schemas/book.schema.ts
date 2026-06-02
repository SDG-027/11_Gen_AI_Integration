import { z } from 'zod';
import { objectIdSchema } from './author.schema.ts';

export const createBookSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: 'Titel ist erforderlich' })
      .trim()
      .min(1, 'Titel darf nicht leer sein'),
    authorIds: z
      .array(objectIdSchema, { required_error: 'Mindestens eine authorId ist erforderlich' })
      .min(1, 'Ein Buch muss mindestens einen Autor haben'),
    isbn: z.string().trim().optional(),
    publishedYear: z
      .number()
      .int()
      .min(0, 'Erscheinungsjahr muss positiv sein')
      .max(new Date().getFullYear(), 'Erscheinungsjahr darf nicht in der Zukunft liegen')
      .optional(),
    genre: z.string().trim().optional(),
    description: z.string().trim().optional(),
  }),
});

export const updateBookSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    title: z
      .string()
      .trim()
      .min(1, 'Titel darf nicht leer sein')
      .optional(),
    authorIds: z
      .array(objectIdSchema)
      .min(1, 'Ein Buch muss mindestens einen Autor haben')
      .optional(),
    isbn: z.string().trim().optional(),
    publishedYear: z
      .number()
      .int()
      .min(0, 'Erscheinungsjahr muss positiv sein')
      .max(new Date().getFullYear(), 'Erscheinungsjahr darf nicht in der Zukunft liegen')
      .optional(),
    genre: z.string().trim().optional(),
    description: z.string().trim().optional(),
  }),
});

export const getBookParamsSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});
