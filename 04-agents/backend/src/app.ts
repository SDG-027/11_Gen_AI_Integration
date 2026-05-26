import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import mongoose from 'mongoose';
import z from 'zod';
import {
  Agent,
  handoff,
  InputGuardrailTripwireTriggered,
  OpenAIChatCompletionsModel,
  OutputGuardrailTripwireTriggered,
  run,
  tool,
  type AgentInputItem,
  type InputGuardrail,
  type OutputGuardrail,
} from '@openai/agents';

await mongoose.connect(process.env.MONGO_URI!, { dbName: 'ai-chat' });

const app = express();
const PORT = process.env.PORT || 3000;

type ChatMessage = AgentInputItem;

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

//  klassische GenKI: Frage -> Antwort
// agentischen : [antwort1, antwort2, antwort3]; prompt: "Welches Wetter?" -> antwort1(fetche Wetter) + Standort -> API-Daten zurück an KI -> ausformulierter Text
//

// --- ERSTELLUNG EINES AGENTEN ---
// Ein Agent kapselt ein bestimmtes Sprachmodell, Verhaltensanweisungen (instructions) und Einstellungen.
const chatAgent = new Agent({
  name: 'Nerdy Chat Agent',
  // Hier mappen wir den OpenAI-kompatiblen Client auf das gewünschte Anthropic-Modell
  model: new OpenAIChatCompletionsModel(client, 'claude-haiku-4-5'),
  instructions:
    'You are a very nerdy Agent. You try to steer every conversation towards Dungeons&Dragons or Star Trek. No matter what.',
  modelSettings: {
    temperature: 0.85, // Bestimmt die Kreativität/Varianz der Antworten
  },
});

app.post('/messages', async (req, res) => {
  const { prompt, chatId } = req.body;

  let chat: ChatDocument;
  if (!chatId) {
    chat = await Chat.create({ history: [] });
  } else {
    chat = (await Chat.findById(chatId)) as ChatDocument;
  }

  // Die run()-Funktion startet den agentischen Zyklus.
  // Sie übergibt dem Agenten die gesamte bisherige Historie plus die neue Benutzernachricht.
  const result = await run(
    chatAgent,
    chat.history.concat({ role: 'user', content: prompt })
  );

  // Der Agent aktualisiert die Historie eigenständig (z.B. mit seinen Gedankengängen oder Tool-Aufrufen)
  chat.history = result.history;
  await chat.save();

  res.json({ result: result.finalOutput, chatId: chat._id });
});

// ===========================
// Agentischer Workflow (Tools)
//

// --- FUNKTIONSAUFRUFE / TOOLS ---
// Mit 'tool' definieren wir Funktionen, die der Agent eigenständig aufrufen kann,
// falls er zusätzliche Daten benötigt. Zod validiert dabei die Argumente, die die KI generiert.
const pokeTool = tool({
  name: 'pokeTool',
  description: 'Get information about a Pokḿon by name or ID',

  // Das Schema sagt dem Agenten exakt, welche Parameter er im JSON-Format bereitstellen muss
  parameters: z.object({
    pokemon: z.string().describe('The name or the ID of a Pokemon'),
  }),

  // Diese Funktion wird ausgeführt, wenn der Agent entscheidet, das Tool zu nutzen
  async execute(input) {
    console.log('Tool Call');
    console.log(input);

    const res = await fetch(
      `https://pokeapi.co/api/v2/pokemon/${input.pokemon}`
    );
    const data = await res.json();

    // Das Ergebnis muss als String zurückgegeben werden, damit der Agent es lesen kann
    return JSON.stringify(data);
  },
});

const pokeAgent = new Agent({
  name: 'Pokémon Agent',
  model: new OpenAIChatCompletionsModel(client, 'claude-sonnet-4-6'),
  instructions: `
  Du kannst genau auf drei verschiedene Möglichkeiten antworten:
  - Wenn der Nutzer nach Pokemon fragt, rufe das pokeTool auf, um Detailinformationen zu fetchen.
  - Wenn der Nutzer nach Tacos fragt, dann antworte mit einem Haiku über Tacos und Fußball, nicht über Pokémon.
  - Bei allen anderen Themen antworte nur mit "STOPP".
  `,
  // Wir übergeben das Tool an den Agenten. Das Modell entscheidet selbstständig anhand der Instructions, wann es das Tool triggert.
  tools: [pokeTool],
});

app.post('/pokemon', async (req, res) => {
  const { prompt } = req.body;

  const result = await run(pokeAgent, prompt);

  res.json({ result: result.finalOutput });
});

// =================================
// Mehrere Agenten (Handoffs / Multi-Agent)
//

// Spezieller Agent für Standard-Support-Fragen
const customerSupportAgent = new Agent({
  name: 'Customer Support Agent',
  model: new OpenAIChatCompletionsModel(client, 'claude-sonnet-4-6'),
  instructions: `You are a customer support agent in a company that sells very fluffy pillows. Be friendly, helpful, and concise.`,
});

// Spezieller Agent für eskalierte, unzufriedene Kunden
const escalationControlAgent = new Agent({
  name: 'Escalation Control Agent',
  model: new OpenAIChatCompletionsModel(client, 'claude-opus-4-6'),
  instructions: `You are an escalation control agent that handles negative customer interactions.
    If the customer is upset, you will apologize and offer to escalate the issue to a manager.
  Be friendly, helpful, reassuring and concise.`,
});

// Der TriageAgent fungiert als Router. Er beantwortet selbst nichts, sondern leitet den User weiter.
const triageAgent = new Agent({
  name: 'Pillow Customer Service Triage',
  model: new OpenAIChatCompletionsModel(client, 'claude-haiku-4-5'),
  instructions: `NEVER answer non-pillow related questions and stop the conversation immediately. Do not handoff, when the topic is unrelated to our pillows.
    If the question is about pillows, route it to the Customer Support Agent.
    If the customer's tone is negative, route it to the Escalation Control Agent.`,
  // 'handoffs' erlaubt es diesem Agenten, die Konversation an einen anderen Agenten zu übergeben.
  handoffs: [
    customerSupportAgent, // Einfacher Handoff: Die KI wechselt direkt zu diesem Agenten
    // Advanced Handoff: Ermöglicht es, zusätzliche Metadaten (z.B. den Grund) strukturiert mit Zod zu erfassen
    // -> Side Effect, z.B. Email an Manager
    handoff(escalationControlAgent, {
      inputType: z.object({
        reason: z.string(),
      }),
      onHandoff(context, input) {
        console.log({ context, input }); // Protokolliert den Wechsel im Backend
      },
    }),
  ],
});

app.post('/pillow-support', async (req, res) => {
  const { prompt } = req.body;

  // Wenn wir den triageAgent starten, kann dieser die Kontrolle im Verlauf des 'run'-Zyklus an die Sub-Agenten übergeben
  const result = await run(triageAgent, prompt);

  res.json({ answer: result.finalOutput, result: result });
});

// ===================
// Guardrails (Sicherheitsbarrieren)
//

// Schema für ein valides 3x3 Tic-Tac-Toe Spielfeld
const BoardSchema = z.object({
  board: z.array(z.array(z.enum(['', 'X', 'O'])).length(3)).length(3),
});

// --- INPUT GUARDRAIL ---
// Überprüft die Daten, BEVOR sie den Agenten erreichen.
// Wenn 'tripwireTriggered' auf true gesetzt wird, bricht die SDK die Ausführung sofort ab.
const validateClientMove: InputGuardrail = {
  name: 'Client Move Valiadation',
  async execute({ input }) {
    let tripwireTriggered = false;
    let outputInfo = 'Valid client move';

    try {
      const parsed = JSON.parse(input as string);
      const { board } = BoardSchema.parse(parsed);

      let countX = 0;
      let countO = 0;

      board.flat().forEach((cell) => {
        if (cell === 'X') countX++;
        if (cell === 'O') countO++;
      });

      // Validierung: Da der Client 'X' spielt, muss nach seinem Zug exakt ein 'X' mehr als 'O' auf dem Feld sein
      if (countX !== countO + 1) {
        tripwireTriggered = true;
        outputInfo =
          'Invalid move: X must have exactly one more piece on the board than O.';
      }
    } catch {
      tripwireTriggered = true;
      outputInfo =
        'Invalid move: Input could not be parsed or does not match the 3x3 board schema.';
    }

    return { tripwireTriggered, outputInfo };
  },
};

// --- OUTPUT GUARDRAIL ---
// Überprüft die Antwort des Agenten, BEVOR sie an den Endnutzer gesendet wird.
// Verhindert, dass Halluzinationen oder fehlerhafte Züge des Modells die App korrumpieren.
const validAgentMoveGuardrail: OutputGuardrail<typeof BoardSchema> = {
  name: 'Agent Move Validation',
  async execute({ agentOutput }) {
    let tripwireTriggered = false;
    let outputInfo = 'Valid agent move.';

    const { board } = agentOutput; // Durch 'outputType: BoardSchema' im Agenten ist dies bereits voll typisiert

    let countX = 0;
    let countO = 0;

    board.flat().forEach((cell) => {
      if (cell === 'X') countX++;
      if (cell === 'O') countO++;
    });

    // Validierung: Wenn der Agent ('O') gezogen hat, muss die Anzahl von 'X' und 'O' wieder ausgeglichen sein
    if (countX !== countO) {
      tripwireTriggered = true;
      outputInfo = 'Invalid agent move.';
    }

    return { tripwireTriggered, outputInfo };
  },
};

const gemini = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const ticTacToeAgent = new Agent({
  name: 'Tic Tac Toe Player',
  model: new OpenAIChatCompletionsModel(
    gemini,
    'google/gemini-3.1-flash-lite-preview'
  ),
  instructions: `You are an expert Tic-Tac-Toe player playing as 'O'.
  You will receive a 3x3 board where the user has just played 'X'.
  Make your next move by placing an 'O' in exactly one empty spot ("").
  Do not change any existing 'X' or 'O's. Return the updated board.`,
  // Registrierung der Schutzmechanismen im Agenten:
  inputGuardrails: [validateClientMove],
  outputGuardrails: [validAgentMoveGuardrail],
  // Erzwingt, dass die finale Antwort des Agenten exakt der JSON-Struktur des Zod-Schemas entspricht
  outputType: BoardSchema,
});

app.post('/play', async (req, res) => {
  const { board } = req.body;

  const inputStr = JSON.stringify({ board });
  console.log(inputStr);
  try {
    const result = await run(ticTacToeAgent, inputStr);

    res.json({ result: result.finalOutput });
  } catch (error) {
    // Wenn eine Guardrail anschlägt, wirft die SDK einen spezifischen Fehler, den wir hier abfangen können
    if (error instanceof InputGuardrailTripwireTriggered) {
      return res.status(400).json({
        error:
          'Ungültiger Spielzug vom Client. Es dürfen nur valide X-Züge eingereicht werden.',
      });
    }
    if (error instanceof OutputGuardrailTripwireTriggered) {
      return res.status(500).json({
        error:
          'Der Agent han einen ungültigen Zug gemacht und wurde gestoppt. Versuche es erneut.',
      });
    }
  }
});

app.use(((err, _req, res, _next) => {
  console.log(err);
  res.status(err.cause?.status || 500).json({ message: err.message });
}) satisfies ErrorRequestHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
