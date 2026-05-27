import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";

// McpServer ist der zentrale Einstiegspunkt des MCP-Protokolls,
// ähnlich zu `const app = express()`.
// Name und Version werden dem verbundenen Client (z.B. Claude Desktop, Postman)
// beim Handshake mitgeteilt — sie erscheinen dort in der Server-Übersicht.
const server = new McpServer({
  name: "MCP Test Server",
  version: "0.0.1",
});

// --- TOOLS ---
// Ein MCP-Tool ist eine Funktion, die der Client (LLM) aktiv aufrufen kann.
// Der erste Parameter ist der maschinenlesbare Name — den schickt das LLM,
// wenn es das Tool aufrufen will.
server.registerTool(
  "greet",
  {
    title: "Greeting Tool",
    // description erklärt dem LLM, wozu das Tool gut ist.
    // Aus dieser Beschreibung entscheidet das Modell, ob und wann es das Tool einsetzt.
    description: "Greet a user",
    // inputSchema definiert, welche Parameter der Client mitschicken muss.
    // Das SDK leitet daraus automatisch ein JSON-Schema ab, das dem LLM übergeben wird,
    // damit es weiß, wie es den Tool-Aufruf strukturieren soll.
    inputSchema: z.object({
      username: z.string(),
    }),
  },
  // Der Handler wird ausgeführt, sobald das LLM das Tool aufruft.
  // Die validierten Parameter kommen direkt als destrukturiertes Objekt an.
  async ({ username }) => {
    // Jedes Tool muss ein content-Array zurückgeben.
    // Das ist das standardisierte MCP-Antwortformat — type:"text" ist der häufigste Fall.
    // Daneben gibt es auch type:"image" oder type:"resource".
    return { content: [{ type: "text", text: `Hello, ${username || "World"}` }] };
  },
);

server.registerTool(
  "add",
  {
    title: "Addition Tool",
    description: "Add two numbers",
    inputSchema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  },
  async ({ a, b }) => {
    const sum = a + b;
    return { content: [{ type: "text", text: JSON.stringify(sum) }] };
  },
);

server.registerTool(
  "search_artworks",
  {
    title: "Search Artworks",
    description: "Retrieve artworks based on a search query and a page number for pagination.",
    // inputSchema kann auch als Objekt aus Zod-Feldern (ohne z.object()) geschrieben werden —
    // das SDK wickelt es intern gleich ab. .describe() liefert dem LLM Hinweise zur Bedeutung
    // der einzelnen Parameter, was die Qualität der Tool-Aufrufe verbessert.
    inputSchema: {
      query: z.string().describe("Search query for artworks"),
      page: z.number().int().min(1).default(1).describe("Page number for pagination"),
    },
  },
  async ({ query, page = 1 }) => {
    try {
      const size = 10;
      const from = (page - 1) * size;
      const baseUrl = "https://api.artic.edu/api/v1/artworks/search";
      const params = new URLSearchParams({
        q: query,
        size: size.toString(),
        from: from.toString(),
      });
      const response = await fetch(`${baseUrl}?${params}`);
      if (!response.ok)
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      const data = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      // Fehler werden im MCP-Protokoll nicht als Exceptions weitergereicht,
      // sondern als normaler text-Content zurückgegeben — der Client (LLM)
      // bekommt die Fehlermeldung als Ergebnis und kann darauf reagieren.
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
          },
        ],
      };
    }
  },
);

// --- RESOURCES ---
// Eine MCP-Resource ist kein aktiver Tool-Aufruf, sondern ein lesbares Dokument.
// Resources eignen sich für statische oder selten wechselnde Inhalte (Docs, Konfiguration, …),
// die das LLM als Kontext laden kann — ohne dass es dafür einen Tool-Call initiieren muss.
server.registerResource(
  "documentation",
  // ResourceTemplate definiert das URI-Muster, unter dem die Resource erreichbar ist.
  // Das Schema (hier "docs://") ist frei wählbar; es muss nur innerhalb des Servers eindeutig sein.
  // { list: undefined } bedeutet: diese Resource kann nicht als Liste aufgezählt werden.
  new ResourceTemplate("docs://art-institute-of-chicago", { list: undefined }),
  {
    title: "Documentation AIC",
    description: "Returns full OpenAPI documentation for the Art Institute of Chicago API.",
  },
  // Der Handler erhält die aufgerufene URI und gibt ein contents-Array zurück —
  // analog zu content bei Tools, aber mit uri-Pflichtfeld pro Eintrag.
  async (uri) => {
    try {
      const res = await fetch("https://api.artic.edu/api/v1/openapi.json");
      if (!res.ok)
        throw new Error(`Failed to fetch documentation: ${res.status} ${res.statusText}`);
      const doc = await res.json();
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(doc, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
          },
        ],
      };
    }
  },
);

// --- TRANSPORT ---
// Der Transport bestimmt, wie Server und Client (VSCode, Claude Desktop, Figma...) miteinander kommunizieren.
// StdioServerTransport nutzt stdin/stdout — der Client startet den Server als child process.
// Alternativ gibt es SSEServerTransport (HTTP + Server-Sent Events) für netzwerkbasierte Clients.
const transport = new StdioServerTransport();

// connect() startet den MCP-Handshake: Server und Client tauschen Capabilities aus
// (welche Tools, Resources, Prompts sind verfügbar?) und der Server beginnt, auf Aufrufe zu warten.
await server.connect(transport);

// Testen in Postman:
// -> Neuer Request -> MCP statt HTTP
// -> STDIO /pfad/zu/node /pfad/zum/mcp.js
// z.B. /home/stephan/.vite-plus/bin/node /home/stephan/coding/sdg27/11_Gen_AI_Integration/mcp-aic-server/dist/app.js

// In VSCode oder anderem Client in der mcp.json (globale Konfig-Datei) hinzufügen - z.B.:
// "servers": {
// 	"mcp-aic": {
// 		"command": "node",
// 		"args": ["/home/stephan/coding/sdg27/11_Gen_AI_Integration/mcp-aic-server/dist/app.js"]
// 	}
// }
// -> Braucht auch absoluten Pfad zur *gebauten* JS-Datei.
