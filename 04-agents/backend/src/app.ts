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

const Chat = mongoose.model('Chat', chatSchema);

const client = new OpenAI({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com/v1/',
});

app.use(cors());

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ msg: 'Server running' });
});

app.use(((err, _req, res, _next) => {
  console.log(err);
  res.status(err.cause?.status || 500).json({ message: err.message });
}) satisfies ErrorRequestHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
