import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly type: string;

  constructor(message: string, statusCode: number, type = 'about:blank') {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let title = 'Internal Server Error';
  let detail = err.message || 'Ein unerwarteter Fehler ist aufgetreten.';
  let type = 'about:blank';
  let invalidParams: any[] | undefined = undefined;

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    statusCode = 400;
    title = 'Validation Failed';
    detail = 'Die übergebenen Daten sind ungültig.';
    type = 'https://api.library.local/errors/validation-failed';
    invalidParams = err.errors.map((e) => ({
      name: e.path.join('.'),
      reason: e.message,
    }));
  }
  // Handle Custom App Errors
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    title = getTitleForStatus(err.statusCode);
    detail = err.message;
    type = err.type;
  }
  // Handle Mongoose Cast Errors (e.g. invalid ObjectId)
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    title = 'Bad Request';
    detail = `Ungültiges Format für das Feld '${err.path}': '${err.value}' ist keine gültige ID.`;
    type = 'https://api.library.local/errors/invalid-id';
  }
  // Handle Mongoose Validation Errors
  else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    title = 'Validation Failed';
    detail = 'Datenbank-Validierung fehlgeschlagen.';
    type = 'https://api.library.local/errors/database-validation-failed';
    invalidParams = Object.values(err.errors).map((e: any) => ({
      name: e.path,
      reason: e.message,
    }));
  }

  // RFC 7807 Error Response
  const errorResponse: Record<string, any> = {
    type,
    title,
    status: statusCode,
    detail,
    instance: req.originalUrl,
  };

  if (invalidParams) {
    errorResponse['invalid-params'] = invalidParams;
  }

  // Log 500 errors
  if (statusCode === 500) {
    console.error('Unhandled Server Error:', err);
  }

  res.setHeader('Content-Type', 'application/problem+json');
  res.status(statusCode).json(errorResponse);
};

function getTitleForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 409:
      return 'Conflict';
    default:
      return 'Error';
  }
}
