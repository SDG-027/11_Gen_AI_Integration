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
Lowlight.registerLanguage('bash', bash);

const renderer = {
  code(snippet: string, lang: string) {
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
      const res = await fetch('http://localhost:3000/chat/streaming', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, chatId }),
      });

      if (!res.body) throw new Error('Request failed');
      const reader = res.body.getReader();

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        let chunk = decoder.decode(value);

        if (chunk.startsWith('data: ')) {
          chunk = chunk.slice(6);
          const parsedText = JSON.parse(chunk);
          setAiResponse((p) => p + parsedText);
        } else if (chunk.startsWith('info: ')) {
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
