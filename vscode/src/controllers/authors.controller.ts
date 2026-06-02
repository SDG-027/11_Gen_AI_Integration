import type { Request, Response } from 'express';
import { AuthorModel } from '../models/author.model.ts';
import { AppError } from '../middleware/errorHandler.ts';

export async function listAuthors(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (req.query.name) {
    filter.name = { $regex: String(req.query.name), $options: 'i' };
  }

  const [data, total] = await Promise.all([
    AuthorModel.find(filter).skip(skip).limit(limit),
    AuthorModel.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function getAuthor(req: Request, res: Response): Promise<void> {
  const author = await AuthorModel.findById(req.params.id);
  if (!author) {
    throw new AppError(404, 'not-found', 'Not Found', `Author with id '${req.params.id}' not found`);
  }
  res.json(author);
}

export async function createAuthor(req: Request, res: Response): Promise<void> {
  const author = await AuthorModel.create(req.body);
  res.status(201).json(author);
}

export async function updateAuthor(req: Request, res: Response): Promise<void> {
  const author = await AuthorModel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!author) {
    throw new AppError(404, 'not-found', 'Not Found', `Author with id '${req.params.id}' not found`);
  }
  res.json(author);
}

export async function deleteAuthor(req: Request, res: Response): Promise<void> {
  const author = await AuthorModel.findByIdAndDelete(req.params.id);
  if (!author) {
    throw new AppError(404, 'not-found', 'Not Found', `Author with id '${req.params.id}' not found`);
  }
  res.status(204).send();
}
