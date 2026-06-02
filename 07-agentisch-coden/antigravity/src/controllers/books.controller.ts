import type { Request, Response, NextFunction } from 'express';
import { Book } from '../models/book.model.ts';
import { Author } from '../models/author.model.ts';
import { AppError } from '../middleware/errorHandler.ts';

export const createBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { title, authorIds, isbn, publishedYear, genre, description } = req.body;

  // Verify all authors exist in DB
  const uniqueAuthorIds = Array.from(new Set(authorIds));
  const authorsCount = await Author.countDocuments({ _id: { $in: uniqueAuthorIds } });
  
  if (authorsCount !== uniqueAuthorIds.length) {
    throw new AppError(
      'Ein oder mehrere Autoren (authorIds) wurden nicht in der Datenbank gefunden.',
      400,
      'https://api.library.local/errors/invalid-authors'
    );
  }

  const book = new Book({
    title,
    authorIds: uniqueAuthorIds,
    isbn,
    publishedYear,
    genre,
    description,
  });

  await book.save();
  
  // Populate author details for the response
  await book.populate('authorIds');
  
  res.status(201).json(book);
};

export const getAllBooks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const books = await Book.find().populate('authorIds').sort({ title: 1 });
  res.status(200).json(books);
};

export const getBookById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const book = await Book.findById(id).populate('authorIds');
  
  if (!book) {
    throw new AppError('Buch nicht gefunden.', 404, 'https://api.library.local/errors/book-not-found');
  }
  
  res.status(200).json(book);
};

export const updateBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const { title, authorIds, isbn, publishedYear, genre, description } = req.body;

  const updateFields: Record<string, any> = {
    title,
    isbn,
    publishedYear,
    genre,
    description,
  };

  // If authorIds are being updated, verify they exist
  if (authorIds) {
    const uniqueAuthorIds = Array.from(new Set(authorIds));
    const authorsCount = await Author.countDocuments({ _id: { $in: uniqueAuthorIds } });
    
    if (authorsCount !== uniqueAuthorIds.length) {
      throw new AppError(
        'Ein oder mehrere Autoren (authorIds) wurden nicht in der Datenbank gefunden.',
        400,
        'https://api.library.local/errors/invalid-authors'
      );
    }
    updateFields.authorIds = uniqueAuthorIds;
  }

  // Remove undefined fields
  Object.keys(updateFields).forEach(
    (key) => updateFields[key] === undefined && delete updateFields[key]
  );

  const book = await Book.findByIdAndUpdate(
    id,
    { $set: updateFields },
    { new: true, runValidators: true }
  ).populate('authorIds');

  if (!book) {
    throw new AppError('Buch nicht gefunden.', 404, 'https://api.library.local/errors/book-not-found');
  }

  res.status(200).json(book);
};

export const deleteBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;

  const book = await Book.findByIdAndDelete(id);
  if (!book) {
    throw new AppError('Buch nicht gefunden.', 404, 'https://api.library.local/errors/book-not-found');
  }

  res.status(204).end();
};
