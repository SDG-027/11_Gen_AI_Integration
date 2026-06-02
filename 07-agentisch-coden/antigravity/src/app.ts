import express from 'express';
import authorsRouter from './routes/authors.routes.ts';
import booksRouter from './routes/books.routes.ts';
import { errorHandler, AppError } from './middleware/errorHandler.ts';

const app = express();

// Middleware for parsing JSON requests
app.use(express.json());

// API Routes
app.use('/authors', authorsRouter);
app.use('/books', booksRouter);

// Fallback for unhandled routes
app.use((req, res, next) => {
  next(new AppError('Ressource oder Route nicht gefunden.', 404, 'https://api.library.local/errors/route-not-found'));
});

// Global Error Handler (RFC 7807)
app.use(errorHandler);

export default app;
