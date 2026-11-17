/**
 * Minimal OpenRouter client. Server-side only: the API key is read from
 * OPENROUTER_API_KEY and never sent to the browser.
 */

/** OPENROUTER_BASE_URL is only for tests (a local mock server). */
export function baseUrl(): string {
  return (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelInfo {
  id: string;
  name?: string;
  supported_parameters?: string[];
  pricing?: { prompt?: string; completion?: string };
  context_length?: number;
  reasoning?: { mandatory?: boolean; default_enabled?: boolean; supported_efforts?: string[]; default_effort?: string };
}

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  /** cost in USD, when OpenRouter reports it */
  cost?: number;
}

export interface CompletionResult {
  text: string;
  usage?: Usage;
  model?: string;
}

export type OpenRouterErrorKind = "no-key" | "auth" | "credits" | "rate-limit" | "bad-request" | "network" | "server";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly kind: OpenRouterErrorKind,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export function getApiKey(): string | null {
  const k = process.env.OPENROUTER_API_KEY?.trim();
  return k ? k : null;
}

let modelsCache: { at: number; models: ModelInfo[] } | null = null;

/** Model list from OpenRouter (cached for 6 hours). Returns [] when offline. */
export async function listModels(): Promise<ModelInfo[]> {
  if (modelsCache && Date.now() - modelsCache.at < 6 * 3600 * 1000) return modelsCache.models;
  try {
    const res = await fetch(`${baseUrl()}/models`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return modelsCache?.models ?? [];
    const json = (await res.json()) as { data: ModelInfo[] };
    modelsCache = { at: Date.now(), models: json.data ?? [] };
    return modelsCache.models;
  } catch {
    return modelsCache?.models ?? [];
  }
}

export async function getModelInfo(id: string): Promise<ModelInfo | null> {
  const models = await listModels();
  return models.find((m) => m.id === id) ?? null;
}

const EFFORT_ORDER = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

/** The lowest reasoning effort a model accepts ("none" turns reasoning off where allowed). */
export function lowestEffort(info: ModelInfo | null): string | null {
  if (!info?.supported_parameters?.includes("reasoning")) return null;
  const supported = info.reasoning?.supported_efforts;
  if (!supported?.length) return "minimal";
  const allowed = EFFORT_ORDER.filter((e) => supported.includes(e) && !(e === "none" && info.reasoning?.mandatory));
  return allowed[0] ?? null;
}

export interface CompleteOptions {
  model: string;
  messages: ChatMessage[];
  /** JSON schema for structured outputs; a json_object fallback is used if unsupported */
  schema?: { name: string; schema: Record<string, unknown> };
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** inject fetch for tests */
  fetchImpl?: typeof fetch;
  apiKey?: string;
}

function errorFor(status: number, msg: string): OpenRouterError {
  if (status === 401 || status === 403) return new OpenRouterError(`OpenRouter rejected the API key: ${msg}`, "auth", status);
  if (status === 402) return new OpenRouterError(`Your OpenRouter account is out of credits: ${msg}`, "credits", status);
  if (status === 429) return new OpenRouterError(`OpenRouter rate limit: ${msg}`, "rate-limit", status);
  if (status >= 500) return new OpenRouterError(`OpenRouter server error ${status}: ${msg}`, "server", status);
  return new OpenRouterError(`OpenRouter error ${status}: ${msg}`, "bad-request", status);
}

/**
 * Chat completion. Uses structured outputs (json_schema) when the model
 * supports them, otherwise asks for a JSON object. Reasoning models run at
 * their lowest effort. If the provider rejects those options, the request is
 * retried once with a plain JSON-object request.
 */
export async function complete(opts: CompleteOptions): Promise<CompletionResult> {
  const key = opts.apiKey ?? getApiKey();
  if (!key) throw new OpenRouterError("No OpenRouter API key. Put OPENROUTER_API_KEY in .env.local.", "no-key");
  const info = opts.fetchImpl ? null : await getModelInfo(opts.model);
  const params = new Set(info?.supported_parameters ?? []);

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 1200,
    usage: { include: true },
  };
  if (opts.temperature !== undefined && (!info || params.has("temperature"))) body.temperature = opts.temperature;
  const effort = lowestEffort(info);
  if (effort) body.reasoning = { effort, exclude: true };
  if (opts.schema) {
    if (!info || params.has("structured_outputs")) {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: opts.schema.name, strict: true, schema: opts.schema.schema },
      };
    } else if (params.has("response_format")) {
      body.response_format = { type: "json_object" };
    }
  }

  const doFetch = opts.fetchImpl ?? fetch;
  const send = async (b: Record<string, unknown>) => {
    try {
      return await doFetch(`${baseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "X-Title": "German Teacher (personal app)",
        },
        body: JSON.stringify(b),
        signal: opts.signal ?? AbortSignal.timeout(90000),
      });
    } catch (e) {
      throw new OpenRouterError(`Could not reach OpenRouter: ${(e as Error).message}`, "network");
    }
  };

  let res = await send(body);
  if (res.status === 400 && (body.reasoning || (body.response_format as { type?: string })?.type === "json_schema")) {
    // some providers reject reasoning settings or strict schemas: retry without them
    const retry: Record<string, unknown> = { ...body, response_format: opts.schema ? { type: "json_object" } : undefined };
    delete retry.reasoning;
    res = await send(retry);
  }
  const raw = await res.text();
  if (!res.ok) {
    let msg = raw.slice(0, 300);
    try {
      msg = JSON.parse(raw)?.error?.message ?? msg;
    } catch {}
    throw errorFor(res.status, msg);
  }
  return parseCompletion(raw);
}

function parseCompletion(raw: string): CompletionResult {
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new OpenRouterError("OpenRouter sent an unreadable response.", "server");
  }
  if (json.error) {
    const code = Number(json.error.code) || 500;
    throw errorFor(code, json.error.message ?? "unknown error");
  }
  const text: string = json.choices?.[0]?.message?.content ?? "";
  return { text, usage: json.usage, model: json.model };
}

/** Extract a JSON object from model text (handles ```json fences and leading prose). */
export function extractJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {}
  }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {}
  }
  return undefined;
}
