import type { Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.ts';
import { BookModel } from '../models/book.model.ts';

export async function listBooks(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (req.query.title) {
    filter.title = { $regex: String(req.query.title), $options: 'i' };
  }
  if (req.query.genre) {
    filter.genre = { $regex: `^${String(req.query.genre)}$`, $options: 'i' };
  }

  const [data, total] = await Promise.all([
    BookModel.find(filter).skip(skip).limit(limit),
    BookModel.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function getBook(req: Request, res: Response): Promise<void> {
  const book = await BookModel.findById(req.params.id);
  if (!book) {
    throw new AppError(404, 'not-found', 'Not Found', `Book with id '${req.params.id}' not found`);
  }
  res.json(book);
}

export async function createBook(req: Request, res: Response): Promise<void> {
  const book = await BookModel.create(req.body);
  res.status(201).json(book);
}

export async function updateBook(req: Request, res: Response): Promise<void> {
  const book = await BookModel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!book) {
    throw new AppError(404, 'not-found', 'Not Found', `Book with id '${req.params.id}' not found`);
  }
  res.json(book);
}

export async function deleteBook(req: Request, res: Response): Promise<void> {
  const book = await BookModel.findByIdAndDelete(req.params.id);
  if (!book) {
    throw new AppError(404, 'not-found', 'Not Found', `Book with id '${req.params.id}' not found`);
  }
  res.status(204).send();
}
