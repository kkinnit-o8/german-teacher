# German Teacher

A personal web app for learning German, one guided session a day:

1. **Review** the words that are due (spaced repetition with FSRS),
2. **Learn** a few new words,
3. a **Quick check** on today's words,
4. a **Conversation** in German with an AI teacher,
5. a **Summary** of the day and your streak.

In the chat, words you have learned show as plain German. Words you haven't learned yet are marked, with their English
meaning in small text above them. As you learn more, the glosses disappear and the chat turns into plain German.
There is also **City Adventures**, a side game where you talk your way through everyday places with AI characters.

Everything runs on your own computer. Only the teacher chat and City Adventures use the internet, through your own
[OpenRouter](https://openrouter.ai) key.

---

## Start on Windows (the easy way)

### 1. Install Node.js (once)

Go to [nodejs.org](https://nodejs.org), download the **LTS** version for Windows and install it with the default
options.

### 2. Get the app (once)

Either download it from GitHub as a ZIP (green **Code** button → **Download ZIP**) and unzip it, or, if you use Git,
open PowerShell and run:

```powershell
git clone https://github.com/kkinnit-o8/german-teacher.git
```

### 3. Double-click `start.cmd`

The first start takes a few minutes. The window:

- checks that Node.js is installed (and tells you what to do if it isn't),
- installs the app's packages (`npm install`) when needed,
- asks for your **OpenRouter API key** if there is no `.env.local` file yet, and saves it there,
- builds the app when the code has changed since the last build,
- starts the app on **http://localhost:3700** and opens your browser.

Keep the black window open while you use the app; close it to stop the app. If something goes wrong, the window stays
open with a message.

Windows may ask whether Node.js may use the network: allow **private networks** if you want to use the app on your
phone (see below).

### 4. Desktop shortcut (optional)

Double-click **`add-to-desktop.cmd`**. It creates a **German Teacher** shortcut with the app's icon on your desktop.
From then on, just double-click the shortcut.

### Your OpenRouter key

1. Create an account at [openrouter.ai](https://openrouter.ai) and add a few dollars of credit (a daily session with
   the default model costs well under one cent).
2. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys). It starts with `sk-or-`.
3. `start.cmd` asks for it the first time. Or create the file `.env.local` in the app folder yourself, with one line:

```
OPENROUTER_API_KEY=sk-or-...
```

The key is read only by the app's server. It is never sent to the browser, and `.env*` files are never committed to
Git. To change the key, edit `.env.local` (Notepad is fine) and restart the app.

### Updating

In PowerShell, in the app folder:

```powershell
git pull
```

Then start the app as usual: it notices the changes, reinstalls packages if needed and rebuilds itself. (If you
downloaded a ZIP instead, download the new ZIP, unzip it and copy your `.env.local` and `data\progress.sqlite` into
it.)

### On your phone (same Wi-Fi)

When the app starts, the window shows an address like `http://192.168.1.23:3700`. Open it in your phone's browser
while your computer is on and the app is running. The layout works on a phone (bottom tab bar), and you can add it to
your home screen.

Two limits: the computer must allow Node.js on private networks (Windows asks the first time), and **the microphone
doesn't work on the phone**: browsers only allow the microphone on secure pages (`https://` or `localhost`), and the
app on your Wi-Fi is plain `http://`. Typing (or your phone keyboard's own dictation) works. Audio playback works.

### Your data

- `data\progress.sqlite`: everything you have learned, reviews, chats and game results (git-ignored). Make a copy now
  and then, or use **Settings → Backup → Export my progress**, which saves a JSON file you can import again.
- `data\dictionary.sqlite`: the dictionary, created automatically from `data\dict\de-en.jsonl.gz` (git-ignored).

---

## For developers

Requirements: Node.js 20.9 or newer (LTS recommended). Commands work in PowerShell 5.1 (run them one at a time) as well
as in bash.

```powershell
npm install
```

```powershell
npm run dev
```

Then open http://localhost:3700. Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` then `npm start` | production build and server on port 3700 |
| `npm test` | unit tests (Vitest): lemmatizer, renderer, scheduling, day rollover, streak, quiz, teacher/game parsing, game rules |
| `npm run e2e` | end-to-end tests (Playwright) with OpenRouter mocked and speech faked. The first time: `npx playwright install chromium` |
| `npm run validate:words` | checks the word bank and every example sentence |
| `npm run build:words` | rebuilds the word bank (see below) |
| `npm run build:dict` | rebuilds the compact dictionary from Wiktionary data (see below) |
| `npm run lint`, `npm run typecheck` | ESLint and TypeScript |

Tech: Next.js 16 (App Router, TypeScript), Tailwind CSS 4, SQLite via better-sqlite3, ts-fsrs, zod, the browser's Web
Speech API. Code: `src/lib/german` (tokenizer, lemmatizer, renderer), `src/lib/srs` (scheduling, quiz), `src/lib/teacher`,
`src/lib/game`, `src/lib/server` (database, sessions, chat), `src/app` (pages and API routes), `scripts` (data builds,
start script).

## The word bank

`data/words.json` (committed) holds 2,400 of the most useful German words, CEFR A1–B1, sorted by frequency (A1 555,
A2 789, B1 1,056). Each word has its lemma, part of speech, short English meanings, CEFR level, frequency rank, topic,
IPA, an example sentence with translation, and grammar: gender, article, plural and genitive for nouns; 3rd person
present, Präteritum, Partizip II, auxiliary, separable prefix, reflexive and irregular flags for verbs; comparative and
superlative for adjectives.

Article families count as one word each (all forms of der/die/das, ein, kein, mein, dein …). Personal pronouns are one
word per person (ich/mich/mir, du/dich/dir, er/ihn/ihm, sie/ihr/ihnen, wir/uns, ihr/euch, Sie/Ihnen): beginners learn the
case forms together, and the Learn card shows them all, while each form keeps its own gloss ("mir" → "(to) me").

How it was built (`npm run build:words`, resumable; LLM results are cached in `data/build/enrich/`):

1. **Candidates.** The German word-frequency list from wordfreq (`data/sources/wordfreq-de.tsv.gz`) is mapped to
   dictionary lemmas through Wiktionary's inflected forms (gehe, ging, gegangen → gehen), with rules for words that
   differ only in capitalisation (essen/Essen, Würde/würde) and for ß (wordfreq writes "strasse"). Names, abbreviations
   and junk are removed. Web-based frequencies underrate everyday words (Butter, Gabel, Fahrkarte, numbers), so
   `data/build/supplement.txt` adds about 250 of them after the frequency-ranked words.
2. **LLM review.** Each candidate is reviewed: keep or drop (rare homographs, duplicates, jargon), short English
   meanings, CEFR level, topic and an example sentence that uses only words ranked before it, as far as possible. The
   committed word bank was reviewed by Claude; with your own key the script uses OpenRouter (`--model`) for anything
   missing.
3. **Example validation** with the app's own lemmatizer: the sentence must contain the target word, and words ranked
   after the target are reported. Failures are regenerated (up to 3 times) and the best attempt is kept and flagged.
   Result: 2,338 of 2,400 examples are perfect; the rest are almost all among the first 60 words, where there are not
   enough earlier words to write a sentence.
4. **Assemble** with grammar data from the dictionary into `data/words.json`. Word ids are stable
   (`data/build/ids.json`), so rebuilding never breaks your progress.

To rebuild with your key: `npm run build:words` (options: `-- --step assemble` for no LLM calls, `--limit 3000`,
`--max-words 2400`, `--model <id>`). Then `npm run validate:words`.

## The dictionary

`data/dict/de-en.jsonl.gz` (3.7 MB, committed) is a compact German–English dictionary with about 46,000 entries:
meanings, genders, plurals, verb forms, IPA and every inflected form, which the lemmatizer needs. It lets you look up
any word the teacher uses, also outside the word bank. It was made from the German section of English Wiktionary as
extracted by kaikki.org. The raw download is 1.1 GB, so it isn't committed. To rebuild the compact file:

```powershell
npm run build:dict
```

This downloads the raw data into `data\raw\` (git-ignored) and streams it. kaikki.org has marked its per-language file
as deprecated; if it disappears, the script falls back to the full English Wiktionary dump (2.9 GB compressed) and keeps
only the German entries while streaming.

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

Tap any word for its lemma, forms, IPA, meaning, audio and "add to my learning queue". The header toggle switches
between glosses on new words (default), on all words, and none (challenge mode). The **Reader** on the Words page
renders any German text you paste.

## The AI teacher

The conversation step talks to a model on OpenRouter (default `anthropic/claude-haiku-5.5`; change it in Settings).
Each request sends the list of words you have learned, today's new words (the teacher uses each one at least once),
the topic, how many exchanges are left and a grammar level that grows with your vocabulary (present tense first;
Perfekt, modal verbs and *weil/dass* later; Präteritum and relative clauses after about 800 words). The model answers
in JSON (`reply`, `translation`, `correction`, `hint`) using OpenRouter's structured outputs where the model supports
them; bad JSON is retried once and otherwise shown as plain text. Reasoning models run at their lowest effort. The
approximate cost of each conversation is shown in the chat and on the Chats page.

## Voice

The app uses your browser's Web Speech API: German text-to-speech (voice and speed in Settings) and German speech
recognition. Edge and Chrome support both (their speech recognition is an online service, so it needs internet);
Firefox has no speech recognition. **Speaking mode** makes the chat hands-free; **silent mode** (header) turns off all
sound and replaces listening questions. If no German voice is installed, Settings explains how to add one in Windows.

## City Adventures

**Play** in the menu. Five places (café, Späti, restaurant, train station, weekly market), two missions each: order a
coffee for you and a friend, buy a return ticket to Hamburg, haggle with Oma Hilde over a kilo of apples. Each mission
has a briefing with its goals, key words (marked if you haven't learned them yet) and the characters you'll meet. It
doesn't touch your daily session.

- **Characters** are drawn in code (animated SVG: they breathe, blink, move their mouths while they talk and change
  expression) and each has a personality, a voice (pitch and speed) and du or Sie. **Meet the cast** shows everyone
  with all six expressions.
- **The game master** is an AI model that plays the characters and replies in JSON: who says what (with an
  expression), which goals you just completed, a hint, and whether you were rude. Character lines are rendered like the
  teacher's, with glosses on words you haven't learned.
- **Rules are decided by the app, not the AI.** 3 hearts of patience. English costs a heart (only clear cases: at
  least two English words, most of the message English, at most one German word). Rudeness costs a heart. Saying *du*
  to someone who expects *Sie* gets a warning the first time and costs a heart after that. With no hearts left the
  character gives up and you can try again.
- **Stars:** one for completing the mission, one for losing at most one heart, one for using at most one hint.
- New words from a mission can be added to tomorrow's words with one click.

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
- **Meanings, CEFR levels, topics and example sentences** in the word bank were written by an AI model (Claude) and
  checked automatically. CEFR levels are estimates, not official Goethe-Institut lists (those are copyrighted and not
  used).
- **Libraries:** Next.js, React, Tailwind CSS (MIT), better-sqlite3 (MIT), ts-fsrs (MIT), zod (MIT), Playwright and
  Vitest (tests).

The same information is on the app's About page.
