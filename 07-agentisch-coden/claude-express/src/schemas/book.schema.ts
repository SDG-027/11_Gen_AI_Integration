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
