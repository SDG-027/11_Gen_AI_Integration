import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: 'Ungültige ObjectId' });

export const createAuthorSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Name ist erforderlich' })
      .trim()
      .min(1, 'Name darf nicht leer sein'),
    bio: z.string().trim().optional(),
    birthYear: z
      .number()
      .int()
      .min(0, 'Geburtsjahr muss positiv sein')
      .max(new Date().getFullYear(), 'Geburtsjahr darf nicht in der Zukunft liegen')
      .optional(),
  }),
});

export const updateAuthorSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Name darf nicht leer sein')
      .optional(),
    bio: z.string().trim().optional(),
    birthYear: z
      .number()
      .int()
      .min(0, 'Geburtsjahr muss positiv sein')
      .max(new Date().getFullYear(), 'Geburtsjahr darf nicht in der Zukunft liegen')
      .optional(),
  }),
});

export const getAuthorParamsSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});
