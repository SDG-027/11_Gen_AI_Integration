import { Schema, model, type Document } from 'mongoose';

export interface IBook extends Document {
  title: string;
  authorIds: Schema.Types.ObjectId[];
  isbn?: string;
  publishedYear?: number;
  genre?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookSchema = new Schema<IBook>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    authorIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Author' }],
      required: true,
      validate: {
        validator: function (v: any[]) {
          return v && v.length > 0;
        },
        message: 'Ein Buch muss mindestens einen Autor (authorIds) haben.',
      },
    },
    isbn: {
      type: String,
      trim: true,
    },
    publishedYear: {
      type: Number,
    },
    genre: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Book = model<IBook>('Book', BookSchema);
