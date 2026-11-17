import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <article className="prose-like max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">About German Teacher</h1>
      <p>
        A personal app for learning German every day. Everything runs on your own computer. Only the teacher chat and
        City Adventures talk to an AI model, through your own OpenRouter account.
      </p>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-semibold">Data sources and licences</h2>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <strong>Dictionary, grammar, IPA and inflected forms:</strong> the German entries of{" "}
            <a className="text-accent underline" href="https://en.wiktionary.org/">English Wiktionary</a>, extracted by{" "}
            <a className="text-accent underline" href="https://kaikki.org/dictionary/German/">kaikki.org</a> (
            <a className="text-accent underline" href="https://github.com/tatuylonen/wiktextract">wiktextract</a>, Tatu
            Ylonen: “Wiktextract: Wiktionary as Machine-Readable Structured Data”, LREC 2022). Licensed under{" "}
            <a className="text-accent underline" href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>{" "}
            and the <a className="text-accent underline" href="https://www.gnu.org/licenses/fdl-1.3.html">GFDL</a>. The
            compact dictionary in <code>data/dict/</code> is derived from it and shared under the same licence.
          </li>
          <li>
            <strong>Word frequencies:</strong>{" "}
            <a className="text-accent underline" href="https://github.com/rspeer/wordfreq">wordfreq</a> by Robyn Speer
            (data CC BY-SA 4.0; it includes data from Wikipedia, OpenSubtitles, Reddit, Twitter, Google Books and other
            sources listed in its README). Used to rank the word bank and to estimate how much everyday text you can read.
          </li>
          <li>
            <strong>Word bank meanings, CEFR levels, topics and example sentences:</strong> written by an AI model
            (Claude) and checked automatically with this app’s own lemmatizer. CEFR levels are estimates, not official
            Goethe-Institut lists.
          </li>
          <li>
            <strong>Spaced repetition:</strong>{" "}
            <a className="text-accent underline" href="https://github.com/open-spaced-repetition/ts-fsrs">ts-fsrs</a> (MIT).
          </li>
          <li>
            <strong>Voice:</strong> your browser’s built-in speech synthesis and speech recognition (Web Speech API).
          </li>
        </ul>
      </section>
    </article>
  );
}
