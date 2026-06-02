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
