import { Schema, model, Types } from 'mongoose';

interface IBook {
  title: string;
  authorId: Types.ObjectId;
  isbn?: string;
  publishedYear?: number;
  genre?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<IBook>(
  {
    title: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'Author', required: true },
    isbn: String,
    publishedYear: Number,
    genre: String,
    description: String,
  },
  { timestamps: true }
);

export const BookModel = model<IBook>('Book', bookSchema);
