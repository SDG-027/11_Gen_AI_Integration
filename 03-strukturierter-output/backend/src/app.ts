import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import mongoose from 'mongoose';

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

const model = 'claude-haiku-4-5';
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
  const { prompt, chatId } = req.body;

  let chat: ChatDocument;
  if (!chatId) {
    chat = await Chat.create({ history: [systemPrompt as ChatMessage] });
  } else {
    chat = (await Chat.findById(chatId)) as ChatDocument;
  }

  const aiStream = await client.chat.completions.create({
    model,
    messages: [...chat!.history, { role: 'user', content: prompt }],
    stream: true,
  });

  res.writeHead(200, {
    'content-type': 'text/event-stream',
    connection: 'keep-alive',
    'cache-control': 'no-cache',
  });

  let answer = '';

  for await (const chunk of aiStream) {
    const text = chunk.choices[0]?.delta.content;
    if (!text) continue;

    answer += text;
    res.write(`data: ${JSON.stringify(text)}\n\n`); // SSE
  }

  chat.history = [
    ...chat!.history,
    { role: 'user', content: prompt } as unknown as ChatMessage,
    { role: 'assistant', content: answer } as unknown as ChatMessage,
  ];

  await chat.save();

  res.write(`info: ${JSON.stringify(chat._id)}\n\n`);

  res.end();
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
