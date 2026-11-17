// A small stand-in for the OpenRouter API, used by the end-to-end tests
// (OPENROUTER_BASE_URL=http://localhost:3799/api/v1). It answers like the
// teacher and like the City Adventures game master, deterministically.
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 3799);
let badJsonServed = new Set();

const TEACHER_LINES = [
  ["Schön! Was isst du gern?", "Nice! What do you like to eat?", "Ich esse gern Brot."],
  ["Toll! Und was trinkst du gern?", "Great! And what do you like to drink?", "Ich trinke gern Kaffee."],
  ["Sehr gut. Kochst du gern?", "Very good. Do you like to cook?", "Ja, ich koche gern."],
  ["Interessant! Was machst du heute Abend?", "Interesting! What are you doing tonight?", "Ich lese ein Buch."],
  ["Super. Hast du ein Lieblingsessen?", "Great. Do you have a favourite food?", "Mein Lieblingsessen ist Pizza."],
  ["Das klingt lecker! Isst du oft im Restaurant?", "That sounds tasty! Do you often eat at a restaurant?", "Nein, nicht oft."],
  ["Verstehe. Wer kocht bei dir zu Hause?", "I see. Who cooks at your home?", "Meine Mutter kocht."],
  ["Wie schön! Und am Wochenende?", "How nice! And at the weekend?", "Am Wochenende koche ich."],
  ["Prima. Was kaufst du im Supermarkt?", "Great. What do you buy at the supermarket?", "Ich kaufe Milch und Brot."],
  ["Gut! Trinkst du lieber Tee oder Kaffee?", "Good! Do you prefer tea or coffee?", "Ich trinke lieber Tee."],
];

function teacherReply(body) {
  const system = body.messages.find((m) => m.role === "system")?.content ?? "";
  // ignore the app's "That was not valid JSON" follow-up when finding the learner's message
  const users = body.messages.filter((m) => m.role === "user" && !/^That was not valid JSON/.test(m.content));
  const last = users[users.length - 1]?.content ?? "";
  const turn = users.length - 1; // the opening request is the first user turn
  if (/RAWTEXT/.test(last)) return "Entschuldigung, ich kann das nicht im richtigen Format schreiben.";
  if (/BADJSON/.test(last) && !badJsonServed.has(turn)) {
    badJsonServed.add(turn);
    return "Hier ist meine Antwort: reply = Hallo";
  }
  if (turn === 0 && /opened today's chat/.test(last)) {
    return JSON.stringify({
      reply: "Hallo! Wie geht es dir heute?",
      translation: "Hello! How are you today?",
      correction: null,
      hint: "Mir geht es gut, danke.",
    });
  }
  let correction = null;
  if (/die tisch/i.test(last))
    correction = { explanation: "Tisch is masculine, so it is der Tisch.", corrected: "Der Tisch ist groß." };
  else if (/ich bin gehen/i.test(last))
    correction = { explanation: "Use the verb in the right form: ich gehe.", corrected: "Ich gehe nach Hause." };
  if (/This is the LAST message/.test(system)) {
    return JSON.stringify({
      reply: "Super, das war toll! Bis morgen!",
      translation: "Great, that was great! See you tomorrow!",
      correction,
      hint: "Tschüss, bis morgen!",
    });
  }
  const [reply, translation, hint] = TEACHER_LINES[(turn - 1) % TEACHER_LINES.length];
  return JSON.stringify({ reply, translation, correction, hint });
}

function gameReply(body) {
  // the game master's prompt describes the mission; the test drives it with fixed lines
  const system = body.messages.find((m) => m.role === "system")?.content ?? "";
  const users = body.messages.filter((m) => m.role === "user");
  const last = users[users.length - 1]?.content ?? "";
  const goals = [...system.matchAll(/^- \[(\w+)\]/gm)].map((m) => m[1]);
  const speaker = (system.match(/SPEAKERS: ([\w-]+)/) ?? [])[1] ?? "lena";
  if (/START THE SCENE/.test(last)) {
    return JSON.stringify({
      lines: [{ speaker, de: "Hallo! Was darf es sein?", en: "Hello! What can I get you?", expression: "happy" }],
      goals_completed: [],
      correction: null,
      hint: "Ich möchte einen Kaffee, bitte.",
      rude: false,
      formality_slip: false,
      mission_complete: false,
    });
  }
  const n = users.length - 1;
  const done = goals.slice(0, Math.min(goals.length, n * 2));
  const complete = done.length >= goals.length;
  return JSON.stringify({
    lines: [
      {
        speaker,
        de: complete ? "Danke schön, einen schönen Tag noch!" : "Gerne! Sonst noch etwas?",
        en: complete ? "Thank you, have a nice day!" : "Sure! Anything else?",
        expression: complete ? "happy" : "neutral",
      },
    ],
    goals_completed: done,
    correction: null,
    hint: "Was kostet das?",
    rude: /idiot/i.test(last),
    formality_slip: false,
    mission_complete: complete,
  });
}

http
  .createServer((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.url?.endsWith("/models")) {
        res.end(
          JSON.stringify({
            data: [
              {
                id: "anthropic/claude-haiku-5.5",
                supported_parameters: ["structured_outputs", "response_format", "reasoning", "max_tokens"],
                reasoning: { mandatory: false, supported_efforts: ["low", "none"] },
                pricing: { prompt: "0.0000001", completion: "0.0000005" },
              },
            ],
          }),
        );
        return;
      }
      if (req.url?.endsWith("/chat/completions")) {
        if (req.headers.authorization !== "Bearer test-key") {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: { message: "Invalid API key", code: 401 } }));
          return;
        }
        const body = JSON.parse(data || "{}");
        const system = body.messages?.find((m) => m.role === "system")?.content ?? "";
        const content = /game master/i.test(system) ? gameReply(body) : teacherReply(body);
        res.end(
          JSON.stringify({
            id: "mock",
            model: body.model,
            choices: [{ message: { role: "assistant", content } }],
            usage: { prompt_tokens: 1200, completion_tokens: 60, total_tokens: 1260, cost: 0.00015 },
          }),
        );
        return;
      }
      res.statusCode = 404;
      res.end("{}");
    });
  })
  .listen(PORT, () => console.log(`mock OpenRouter on ${PORT}`));
