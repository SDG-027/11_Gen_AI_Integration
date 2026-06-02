import { Schema, model, type Document } from 'mongoose';

export interface IAuthor extends Document {
  name: string;
  bio?: string;
  birthYear?: number;
  createdAt: Date;
  updatedAt: Date;
}

const AuthorSchema = new Schema<IAuthor>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
    },
    birthYear: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

export const Author = model<IAuthor>('Author', AuthorSchema);
