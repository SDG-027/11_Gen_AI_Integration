import type { Request, Response, NextFunction } from 'express';
import { Author } from '../models/author.model.ts';
import { Book } from '../models/book.model.ts';
import { AppError } from '../middleware/errorHandler.ts';

export const createAuthor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { name, bio, birthYear } = req.body;
  const author = new Author({ name, bio, birthYear });
  await author.save();
  res.status(201).json(author);
};

export const getAllAuthors = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authors = await Author.find().sort({ name: 1 });
  res.status(200).json(authors);
};

export const getAuthorById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const author = await Author.findById(id);
  if (!author) {
    throw new AppError('Autor nicht gefunden.', 404, 'https://api.library.local/errors/author-not-found');
  }
  res.status(200).json(author);
};

export const updateAuthor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const { name, bio, birthYear } = req.body;

  const author = await Author.findByIdAndUpdate(
    id,
    { $set: { name, bio, birthYear } },
    { new: true, runValidators: true }
  );

  if (!author) {
    throw new AppError('Autor nicht gefunden.', 404, 'https://api.library.local/errors/author-not-found');
  }

  res.status(200).json(author);
};

export const deleteAuthor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;

  // Check if author exists
  const author = await Author.findById(id);
  if (!author) {
    throw new AppError('Autor nicht gefunden.', 404, 'https://api.library.local/errors/author-not-found');
  }

  // Check if author is still linked to any books
  const associatedBooksCount = await Book.countDocuments({ authorIds: id });
  if (associatedBooksCount > 0) {
    throw new AppError(
      `Autor kann nicht gelöscht werden, da er noch mit ${associatedBooksCount} Buch/Büchern verknüpft ist.`,
      409,
      'https://api.library.local/errors/author-has-books'
    );
  }

  await Author.findByIdAndDelete(id);
  res.status(204).end();
};
