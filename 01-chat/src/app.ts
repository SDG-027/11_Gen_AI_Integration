import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URI!, { dbName: 'ai-chat' });

const app = express();
const PORT = process.env.PORT || 3000;

// --- KI-Client-Konfiguration ---
// Wir verwenden das OpenAI-SDK — aber nicht für OpenAI selbst.
// Viele KI-Anbieter (Anthropic, Google Gemini, OpenRouter, Ollama) unterstützen dieselbe
// HTTP-Schnittstelle wie OpenAI. Das heißt: Wir können dasselbe SDK mit anderer
// baseURL und anderem API-Key nutzen, um den Anbieter zu wechseln.
const client = new OpenAI({
  apiKey: process.env.ANTHROPIC_API_KEY, // Your Claude API key
  baseURL: 'https://api.anthropic.com/v1/', // Claude API endpoint
  // base_url: "https://generativelanguage.googleapis.com/v1beta/openai/" // GEMINI
  // baseURL: "https://openrouter.ai/api/v1" // OpenRouter
});

// Alternativ: lokales Modell via Ollama — kein API-Key nötig
// const client = new OpenAI({
//   baseURL: 'http://127.0.0.1:11434/v1',
// });

app.use(cors());

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ msg: 'Server running' });
});

// --- POST /messages: Einfacher Prompt ohne Gesprächsverlauf ---
// Dieser Endpunkt zeigt das Grundprinzip: Wir schicken eine Liste von Nachrichten ans Modell
// und bekommen eine Antwort zurück. Jede Anfrage ist unabhängig — es gibt kein "Gedächtnis".
app.post('/messages', async (req, res) => {
  const { prompt } = req.body;

  const response = await client.chat.completions.create({
    // Das Modell, das wir ansprechen wollen. Dieser String wird direkt an die API weitergegeben.
    model: 'claude-haiku-4-5',

    // "messages" ist das Herzstück der KI-Integration.
    // Wir übergeben den gesamten Gesprächskontext als Array — das Modell hat keinen eigenen
    // Speicher, es sieht nur das, was wir hier hineinschreiben.
    messages: [
      // Die "system"-Rolle gibt dem Modell eine Grundinstruktion / Persönlichkeit.
      { role: 'system', content: 'Antworte nur in Reimen' },

      // Mit "user"- und "assistant"-Paaren können wir Few-Shot-Beispiele einbauen:
      // Wir zeigen dem Modell, wie es antworten soll, bevor es die eigentliche Frage bekommt.
      { role: 'user', content: 'Warum ist die Banane krumm?' },
      {
        role: 'assistant',
        content:
          "Die Banane wächst zum Licht hinauf,\nund folgt dem Sonnenstrahlenauf,\nsie krümmt sich in die Höhe steil,\nweil Licht bringt ihr Erfolgsanteil.\n\nDie Frucht, sie dreht sich nach der Sonn',\nes ist für sie ein großer Wonn',\nso kriegt sie mehr der warmen Strahlen,\nund kann deshalb so schön gedeihen und prahl'n.",
      },

      // Der eigentliche User-Prompt aus dem Request-Body kommt als letzte Nachricht rein.
      { role: 'user', content: prompt },
    ],
  });

  res.json({ prompt, response });
});

// --- Typen für Mongoose ---
// ChatCompletionMessage ist der Typ, den das OpenAI-SDK für eine Antwortnachricht verwendet.
// Wir importieren ihn, um TypeScript zu sagen, wie ein Eintrag im Verlauf aussieht.
type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessage;

// ChatDocument erweitert mongoose.Document um unser "history"-Feld.
// So weiß TypeScript, welche Felder ein Dokument aus der "chats"-Collection hat.
interface ChatDocument extends mongoose.Document {
  history: ChatMessage[];
}

// --- Mongoose-Schema & Model ---
// Das Schema beschreibt die Struktur eines Dokuments in der Datenbank.
// "history" ist ein Array aus beliebigen Objekten — wir speichern die Nachrichten-Objekte
// direkt, ohne sie weiter zu zerlegen.
const chatSchema = new mongoose.Schema<ChatDocument>({
  history: {
    type: [Object],
    default: [],
  },
});

const Chat = mongoose.model('Chat', chatSchema);

const systemPrompt = {
  role: 'system',
  content:
    // 'Du bist ein Senior Software Architect und antwortest niemals mit Code auf programmierbezogene Fragen. Außerdem antwortest du nur sehr knapp in maximal 5 Sätzen.',
    'Antworte mit ausführlichen Beispielen. Möglichst auch mit Code, wenn relevant.',
};

const model = 'claude-haiku-4-5';
// const model = 'gemma4'; // in Verbindung mit ollama

// --- POST /chat: Persistenter Gesprächsverlauf ---
// Dieser Endpunkt zeigt das Kern-Pattern für einen echten Chat:
// Der Verlauf wird in MongoDB gespeichert und bei jeder Anfrage wieder mitgeschickt.
// Das Modell "erinnert" sich dadurch an frühere Nachrichten — nicht selbst, sondern weil
// wir ihm den kompletten Verlauf jedes Mal neu übergeben.
app.post('/chat', async (req, res) => {
  const { prompt, chatId } = req.body;

  // --- Chat laden oder neu anlegen ---
  // Wenn keine chatId mitgeschickt wird, starten wir ein neues Gespräch.
  // Das system-Prompt kommt als erste Nachricht in den Verlauf — es ist immer dabei.
  let chat: ChatDocument;
  if (!chatId) {
    chat = await Chat.create({ history: [systemPrompt as ChatMessage] });
  } else {
    // Bestehenden Chat anhand der MongoDB-ID laden.
    // Die gespeicherte history enthält den gesamten bisherigen Gesprächsverlauf.
    chat = (await Chat.findById(chatId)) as ChatDocument;
  }

  // --- Anfrage ans Modell schicken ---
  // Wir hängen den neuen User-Prompt an den bestehenden Verlauf an.
  // Das Modell sieht so den gesamten Kontext und kann kohärent antworten.
  const response = await client.chat.completions.create({
    model,
    messages: [...chat!.history, { role: 'user', content: prompt }],
  });

  // Die Antwort des Modells liegt in choices[0].message.
  // "choices" ist ein Array, weil man theoretisch mehrere Antwort-Varianten anfordern kann.
  const answer = response.choices[0]?.message as ChatMessage;

  // --- Verlauf aktualisieren und speichern ---
  // Wir fügen sowohl die User-Nachricht als auch die Modellantwort zum Verlauf hinzu
  // und speichern alles zurück in die Datenbank. Beim nächsten Aufruf ist der Verlauf komplett.
  chat.history = [
    ...chat!.history,
    { role: 'user', content: prompt } as unknown as ChatMessage,
    answer,
  ];

  await chat.save();

  // Die chatId mitschicken, damit der Client sie für Folgeanfragen verwenden kann.
  res.json({ prompt, response, chatId: chat._id });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
