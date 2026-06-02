import { z } from 'zod';

export const createAuthorSchema = z.object({
  name: z.string().min(1),
  bio: z.string().optional(),
  birthYear: z.number().int().optional(),
});

export const updateAuthorSchema = createAuthorSchema.partial();

export type CreateAuthorInput = z.infer<typeof createAuthorSchema>;
export type UpdateAuthorInput = z.infer<typeof updateAuthorSchema>;
