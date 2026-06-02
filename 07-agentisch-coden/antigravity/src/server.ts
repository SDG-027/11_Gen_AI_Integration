import mongoose from 'mongoose';
import app from './app.ts';

const PORT = process.env.PORT || '3000';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/library-db';

async function startServer() {
  try {
    console.log('Verbinde mit MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB-Verbindung erfolgreich hergestellt.');

    app.listen(PORT, () => {
      console.log(`Server läuft auf Port ${PORT}`);
      console.log(`- Autoren-Endpunkt: http://localhost:${PORT}/authors`);
      console.log(`- Bücher-Endpunkt:  http://localhost:${PORT}/books`);
    });
  } catch (error) {
    console.error('Fehler beim Starten des Servers:', error);
    process.exit(1);
  }
}

startServer();
