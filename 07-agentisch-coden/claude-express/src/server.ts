import mongoose from 'mongoose';
import { app } from './app.ts';

const PORT = process.env.PORT ?? 3000;
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/books-authors';

mongoose
  .connect(String(MONGODB_URI))
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(Number(PORT), () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err: unknown) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
