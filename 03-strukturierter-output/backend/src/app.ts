import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import mongoose from 'mongoose';
import z from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod.js';

await mongoose.connect(process.env.MONGO_URI!, { dbName: 'ai-chat' });

const app = express();
const PORT = process.env.PORT || 3000;

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessage;

interface ChatDocument extends mongoose.Document {
  history: ChatMessage[];
}

const chatSchema = new mongoose.Schema<ChatDocument>({
  history: {
    type: [Object],
    default: [],
  },
});

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

app.post('/messages', async (req, res) => {
  const { prompt } = req.body;

  const response = await client.chat.completions.create({
    model: 'claude-haiku-4-5',

    messages: [
      { role: 'system', content: 'Antworte nur in Reimen' },

      { role: 'user', content: 'Warum ist die Banane krumm?' },
      {
        role: 'assistant',
        content:
          "Die Banane wächst zum Licht hinauf,\nund folgt dem Sonnenstrahlenauf,\nsie krümmt sich in die Höhe steil,\nweil Licht bringt ihr Erfolgsanteil.\n\nDie Frucht, sie dreht sich nach der Sonn',\nes ist für sie ein großer Wonn',\nso kriegt sie mehr der warmen Strahlen,\nund kann deshalb so schön gedeihen und prahl'n.",
      },

      { role: 'user', content: prompt },
    ],
  });

  res.json({ prompt, response });
});

const Chat = mongoose.model('Chat', chatSchema);

const systemPrompt = {
  role: 'system',
  content:
    // 'Du bist ein Senior Software Architect und antwortest niemals mit Code auf programmierbezogene Fragen. Außerdem antwortest du nur sehr knapp in maximal 5 Sätzen.',
    'Antworte mit ausführlichen Beispielen. Möglichst auch mit Code, wenn relevant.',
};

const model = 'claude-sonnet-4-6';

app.post('/chat', async (req, res) => {
  const { prompt, chatId } = req.body;

  let chat: ChatDocument;
  if (!chatId) {
    chat = await Chat.create({ history: [systemPrompt as ChatMessage] });
  } else {
    chat = (await Chat.findById(chatId)) as ChatDocument;
  }

  const response = await client.chat.completions.create({
    model,
    messages: [...chat!.history, { role: 'user', content: prompt }],
  });

  const answer = response.choices[0]?.message as ChatMessage;

  chat.history = [
    ...chat!.history,
    { role: 'user', content: prompt } as unknown as ChatMessage,
    answer,
  ];

  await chat.save();

  res.json({ prompt, response, chatId: chat._id });
});

app.post('/chat/streaming', async (req, res) => {
  const { prompt } = req.body;

  const chatId = req.headers['x-chat-id'];

  let chat: ChatDocument;
  if (!chatId) {
    chat = await Chat.create({ history: [systemPrompt as ChatMessage] });
  } else {
    chat = (await Chat.findById(chatId)) as ChatDocument;
  }

  // client.chat.completions.stream() startet eine Streaming-Anfrage an OpenAI.
  // Das SDK sendet uns die Fragmente (Chunks) der Antwort, sobald sie von der KI generiert werden,
  // anstatt auf den kompletten Text zu warten.
  const aiStream = client.chat.completions.stream({
    model,
    messages: [...chat!.history, { role: 'user', content: prompt }],
  });

  res.set({
    'content-type': 'text/plain; charset=utf-8', // einfacher Text als Antwortformat
    'x-chat-id': chat._id.toString(), // die _id, um den Chat in der DB zu finden
    'access-control-expose-headers': 'x-chat-id', // lässt den obigen Custom Header zu
    'cache-control': 'no-cache',
  });

  // 'for await...of' durchläuft den Stream asynchron, sobald neue Daten eintreffen.
  // .toReadableStream() wandelt den SDK-Stream in einen Standard-Web-Stream um,
  // und res.write(chunk) schickt jedes Textfragment sofort live an den Client weiter.
  for await (const chunk of aiStream.toReadableStream()) {
    res.write(chunk);
  }

  // Da wir gestreamt haben, haben wir noch keine fertige Gesamtantwort für unsere Datenbank.
  // .finalMessage() wartet, bis der Stream komplett beendet ist, und liefert uns das
  // vollständige finale Nachrichten-Objekt inklusive des gesamten Texts.
  const answer = await aiStream.finalMessage();
  const { content } = answer;

  console.log({ answer });

  chat.history = [
    ...chat!.history,
    { role: 'user', content: prompt } as unknown as ChatMessage,
    { role: 'assistant', content: content } as unknown as ChatMessage,
  ];

  await chat.save();

  res.end();
});

// --------------------------------------
// STRUKTURIERTER OUTPUT
//
// Zod-Schema, um KI-Output zu definieren
const Recipe = z.object({
  title: z.string().describe('The name of the recipe'), // .describe() fügt genaueren Kontext für dieses Feld hinzu, wenn der Keyname nicht ausreicht

  ingredients: z.array(
    z.object({
      name: z.string().describe('The name of the ingredient'),
      quantity: z.number(),
      unit: z
        .string()
        .describe(
          "The unity of the ingredient's quantity. Use European metric units only."
        ),
    })
  ),
  preparation_description: z
    .string()
    .describe('A short description of the meal preparation'),
  time_in_minutes: z.number(),
});

app.post('/recipes', async (req, res) => {
  const { prompt } = req.body;

  // client.chat.completions.parse() wird für "Structured Outputs" genutzt.
  // Anstatt Freitext liefert die KI ein garantiert valides JSON-Objekt,
  // das exakt unserem übergebenen Zod-Schema ('Recipe') entspricht.
  const recipe = await client.chat.completions.parse({
    model,
    messages: [
      {
        role: 'system',
        content:
          'Du bist ein kreativer, innovativer Chefkoch mit Vorliebe für Pfannkuchen.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: zodResponseFormat(Recipe, 'recipe'),
  });

  // console.log(recipe);

  // Über '.message.parsed' greifen wir direkt auf das bereits fertig
  // validierte und geparste JavaScript-Objekt zu.
  res.json({ recipe: recipe.choices[0]?.message.parsed });
});

// -------------------------------------
// BILDGENERIERUNG

//  Claude-modelle können (momentan) keine Medien erzeugen, daher hier ein extra Client zu Google
const imageClient = new OpenAI({
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

app.post('/images', async (req, res) => {
  const { prompt } = req.body;

  // client.images.generate() triggert die Bildgenerierung.
  // Hier nutzen wir das OpenAI SDK als Schnittstelle, um über die konfigurierte
  // Google-Plattform ein Bild per Imagen-Modell zu erzeugen und als Base64-JSON zu erhalten.
  const result = await imageClient.images.generate({
    prompt,
    model: 'imagen-4.0-generate-001',
    response_format: 'b64_json',
  });

  res.json(result);
});

app.use(((err, _req, res, _next) => {
  console.log(err);
  res.status(err.cause?.status || 500).json({ message: err.message });
}) satisfies ErrorRequestHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
