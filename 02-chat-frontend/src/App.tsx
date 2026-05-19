import { useState } from 'react';
import Markdown from 'marked-react';
import type { SubmitEvent } from 'react';
import './App.css';

import Lowlight from 'react-lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import bash from 'highlight.js/lib/languages/bash';

import 'highlight.js/styles/night-owl.css';

Lowlight.registerLanguage('js', javascript);
Lowlight.registerLanguage('javascript', javascript);
Lowlight.registerLanguage('ts', javascript);
Lowlight.registerLanguage('typescript', javascript);

const renderer = {
  code(snippet, lang) {
    const usedLang = Lowlight.hasLanguage(lang) ? lang : 'bash';
    return (
      <Lowlight key={this.elementId} language={usedLang} value={snippet} />
    );
  },
};

function App() {
  const [pending, setPending] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [chatId, setChatId] = useState('');
  const [aiResponse, setAiResponse] = useState('');

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();

    try {
      setPending(true);
      // TODO: Sendet prompt zum Backend und verarbeitet die Antwort
      // const res = await fetch('http://localhost:3000/chat', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ prompt, chatId }),
      // });

      // if (!res.ok) throw new Error('Request failed');
      // const data = await res.json();
      // console.log(data);

      // const aiRes = data.response.choices[0].message.content;

      // setAiResponse(aiRes);
      // setChatId(data.chatId);

      // STREAMING
      const res = await fetch('http://localhost:3000/chat/streaming', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, chatId }),
      });

      // res.body ist ein ReadableStream — der Browser hat die Verbindung offen gehalten
      // und empfängt die Daten stückweise. Wir brauchen einen "Reader", um daraus lesen zu können.
      if (!res.body) throw new Error('Request failed');
      const reader = res.body.getReader();

      // Der Stream liefert rohe Bytes (Uint8Array), keinen Text.
      // Der TextDecoder wandelt diese Bytes in lesbare Strings um.
      const decoder = new TextDecoder();

      // Wir lesen in einer Endlosschleife, bis der Server die Verbindung schließt (done === true).
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Bytes → String. (Ein einzelner Chunk kann mehrere SSE-Zeilen enthalten,
        // in der Praxis aber meist nur eine.)
        let chunk = decoder.decode(value);

        // Wir unterscheiden anhand der SSE-Vorsilbe, was für ein Event angekommen ist.
        // "data: " enthält einen Textfragment vom Modell — wir hängen ihn an die Antwort an.
        if (chunk.startsWith('data: ')) {
          chunk = chunk.slice(6); // Präfix entfernen, nur den JSON-Inhalt behalten
          const parsedText = JSON.parse(chunk);
          setAiResponse((p) => p + parsedText);
        } else if (chunk.startsWith('info: ')) {
          // "info: " ist unser eigener Event-Typ vom Backend — er enthält die chatId.
          // Er kommt als letztes Event, nachdem der Stream vollständig ist.
          chunk = chunk.slice(6);
          const parsedText = JSON.parse(chunk);
          setChatId(parsedText);
        }
      }
    } catch (error) {
      console.error('Error ', error);
    } finally {
      setPending(false);
    }
  };

  const reset = () => {
    setAiResponse('');
    setPrompt('');
  };

  return (
    <main className="mx-auto flex h-screen w-5xl flex-col items-center p-2">
      <form
        onSubmit={handleSubmit}
        className="flex w-full items-end gap-2"
        inert={pending}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={'State your question...'}
          className="textarea textarea-primary h-40 flex-10/12 resize-none"
        />
        <div className="flex flex-2/12 flex-col gap-2">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? (
              <span className="loading loading-spinner" />
            ) : (
              <span>Send</span>
            )}
          </button>
          <button className="btn btn-secondary" type="reset" onClick={reset}>
            Clear
          </button>
        </div>
      </form>
      <div className="mockup-window my-4 w-full flex-1 overflow-y-auto border px-4 text-start">
        {/* TODO: Setzt User-Frage und AI-Antwort hier ein  */}
        {aiResponse && <Markdown value={aiResponse} renderer={renderer} />}
      </div>
    </main>
  );
}

export default App;
