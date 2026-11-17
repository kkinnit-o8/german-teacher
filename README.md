# German Teacher

A personal web app for learning German, one guided session a day: review old words, learn a few new ones, take a short
quiz, then chat in German with an AI teacher. Words you have learned show as plain German; words you haven't learned
yet are marked, with their English meaning in small text above them. As you learn, the glosses disappear.

Everything runs on your own computer. Only the teacher chat and the City Adventures game use the internet (through your
own [OpenRouter](https://openrouter.ai) key).

> This README grows with the app. The Windows start script and the full setup guide arrive in build phase 7.

## Requirements

- [Node.js](https://nodejs.org) 20.9 or newer (the current LTS version is best).
- An OpenRouter API key for the teacher chat and the game.

## Quick start (developer way)

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3700.

The dictionary database (`data/dictionary.sqlite`) is created automatically from `data/dict/de-en.jsonl.gz` the first
time the app needs it. Your progress lives in `data/progress.sqlite`. Both files are git-ignored.

## The word bank

`data/words.json` (committed) holds about 2,000–2,400 of the most useful German words (CEFR A1–B1), sorted by
frequency. Each word has its lemma, part of speech, short English meanings, CEFR level, frequency rank, topic, IPA,
an example sentence with translation, and grammar: gender, article, plural and genitive for nouns; 3rd person present,
Präteritum, Partizip II, auxiliary, separable prefix, reflexive and irregular flags for verbs; comparative and
superlative for adjectives.

How it was built (`npm run build:words`, resumable):

1. **Candidates.** The German word-frequency list from wordfreq (`data/sources/wordfreq-de.tsv.gz`) is mapped to
   dictionary lemmas through Wiktionary's inflected forms (gehe, ging, gegangen → gehen), with rules for words that
   only differ in capitalisation (essen/Essen). Names, abbreviations and junk are removed.
2. **LLM review.** Each candidate is reviewed by an LLM: keep or drop, short English meanings, CEFR level, topic and an
   example sentence that uses only words ranked before it, as far as possible. Results are cached in
   `data/build/enrich/`. The committed word bank was reviewed by Claude; with your own key the script uses OpenRouter
   for anything missing.
3. **Example validation** with the app's own lemmatizer: the sentence must contain the target word, and a report lists
   words ranked after the target. Failures are regenerated, and the best attempt is kept and flagged.
4. **Assemble** with grammar data from the dictionary into `data/words.json`. Word ids are stable
   (`data/build/ids.json`), so rebuilding never breaks your progress.

To rebuild it yourself, put your key in `.env.local` (see below) and run:

```bash
npm run build:words
```

Useful options: `npm run build:words -- --step assemble` (no LLM calls), `--limit 3000` (how many candidates to
review), `--max-words 2400`, `--model <openrouter model id>`.

### The dictionary

`data/dict/de-en.jsonl.gz` (3.6 MB, committed) is a compact German–English dictionary with about 43,600 entries:
meanings, genders, plurals, verb forms, IPA and every inflected form, which the lemmatizer needs. It was made from the
German section of English Wiktionary as extracted by kaikki.org. The raw download is 1.1 GB, so it is not committed. To
rebuild the compact file:

```bash
npm run build:dict
```

This downloads the raw data into `data/raw/` (git-ignored) and streams it. kaikki.org has marked its per-language file
as deprecated; if it disappears, the script falls back to the full English Wiktionary dump (2.9 GB compressed) and
keeps only the German entries while streaming.

## How unlearned words are shown

The teacher writes normal German. A deterministic renderer (not the AI) decides what to show:

1. **Tokenize** into words, numbers and punctuation; expand contractions (im = in + dem, zum, zur, ins, beim, vom,
   ans, aufs …) and clitic *'s* (geht's = geht + es).
2. **Lemmatize** each word with a form → lemma table from the dictionary (gehe, ging, gegangen → gehen), using
   capitalisation and small, tested context rules: *sein* (to be / his), *Weg/weg*, *Essen/essen*, *Sie/sie*,
   *ihr* (you all / her / their), *meine* (my / I mean), verbs right after their subject (ich weiß), and nouns vs.
   verbs at the start of a sentence.
3. **Separable verbs**: in *Ich rufe dich morgen an*, *rufe … an* is *anrufen*. Both parts count as one word, are
   styled together and open the same popup. Subordinate clauses (*weil ich dich anrufe*), zu-infinitives
   (*anzurufen*) and participles (*angerufen*) work too.
4. **Learned** words (introduced in a Learn step) are plain text. A word that is not in the word bank, such as the
   compound *Kinderzimmer*, counts as known only if it splits completely into learned words (linking -s-, -n-, -en-,
   -e-, -er- allowed).
5. **Unlearned** words get a dotted underline and a short English gloss above them (ruby text). Punctuation, numbers,
   names and English pass through unchanged. Nouns and their articles are coloured by gender.

The code lives in `src/lib/german/` and is covered by unit tests (`npm test`). `npm run validate:words` checks every
example sentence in the word bank with the same lemmatizer.

## Your OpenRouter key

Create a file called `.env.local` in the project folder containing one line:

```
OPENROUTER_API_KEY=sk-or-...
```

The key is read only by the server part of the app. It is never sent to the browser and `.env*` files are never
committed.

## Data sources and licences

- **Dictionary, grammar, IPA and inflected forms:** German entries of
  [English Wiktionary](https://en.wiktionary.org/), extracted by [kaikki.org](https://kaikki.org/dictionary/German/)
  with [wiktextract](https://github.com/tatuylonen/wiktextract) (Tatu Ylonen, “Wiktextract: Wiktionary as
  Machine-Readable Structured Data”, LREC 2022). Licensed under
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and the
  [GFDL](https://www.gnu.org/licenses/fdl-1.3.html). `data/dict/de-en.jsonl.gz` is a derived work under the same
  licence.
- **Word frequencies:** [wordfreq](https://github.com/rspeer/wordfreq) by Robyn Speer, data
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). `data/sources/wordfreq-de.tsv.gz` is an export of
  its German list (`scripts/export-wordfreq.py`).
- **Meanings, CEFR levels, topics and example sentences** in the word bank were written by an AI model and checked
  automatically. CEFR levels are estimates, not official Goethe-Institut lists (those are copyrighted and not used).
- **Libraries:** Next.js, React, Tailwind CSS (MIT), better-sqlite3 (MIT), ts-fsrs (MIT), zod (MIT).
