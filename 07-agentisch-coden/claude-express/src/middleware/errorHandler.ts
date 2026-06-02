import type { NextFunction, Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

export class AppError extends Error {
  status: number;
  type: string;
  title: string;
  detail: string;

  constructor(status: number, type: string, title: string, detail: string) {
    super(detail);
    this.status = status;
    this.type = type;
    this.title = title;
    this.detail = detail;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      type: `/errors/${err.type}`,
      title: err.title,
      status: err.status,
      detail: err.detail,
    });
    return;
  }

  if (err instanceof MongooseError.CastError) {
    res.status(400).json({
      type: '/errors/bad-request',
      title: 'Bad Request',
      status: 400,
      detail: `Invalid value for field '${err.path}': ${err.value}`,
    });
    return;
  }

  if (err instanceof MongooseError.ValidationError) {
    res.status(422).json({
      type: '/errors/validation',
      title: 'Unprocessable Entity',
      status: 422,
      detail: 'Document validation failed',
      errors: Object.values(err.errors).map((e) => ({
        path: e.path,
        message: e.message,
      })),
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    type: '/errors/internal',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred',
  });
}
