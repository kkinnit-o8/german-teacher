/**
 * Minimal OpenRouter client. Server-side only: the API key is read from
 * OPENROUTER_API_KEY and never sent to the browser.
 */

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

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
}

export interface CompletionResult {
  text: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
  model?: string;
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly kind: "no-key" | "auth" | "rate-limit" | "bad-request" | "network" | "server",
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
    const res = await fetch(OPENROUTER_MODELS_URL, { signal: AbortSignal.timeout(15000) });
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

/**
 * Chat completion. Uses structured outputs (json_schema) when the model
 * supports them, otherwise asks for a JSON object. Reasoning models are run
 * at their lowest effort.
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
  if (params.has("reasoning")) {
    // lowest reasoning effort the model allows; reasoning text is not needed
    body.reasoning = { effort: "minimal", exclude: true };
  }
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
  let res: Response;
  try {
    res = await doFetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "German Teacher (personal app)",
      },
      body: JSON.stringify(body),
      signal: opts.signal ?? AbortSignal.timeout(90000),
    });
  } catch (e) {
    throw new OpenRouterError(`Could not reach OpenRouter: ${(e as Error).message}`, "network");
  }
  const raw = await res.text();
  if (!res.ok) {
    let msg = raw.slice(0, 300);
    try {
      msg = JSON.parse(raw)?.error?.message ?? msg;
    } catch {}
    // retry once without reasoning/response_format if the provider rejects them
    if (res.status === 400 && (body.reasoning || body.response_format) && !opts.fetchImpl) {
      const retryBody = { ...body };
      delete retryBody.reasoning;
      if (retryBody.response_format) retryBody.response_format = { type: "json_object" };
      const r2 = await doFetch(OPENROUTER_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(retryBody),
        signal: AbortSignal.timeout(90000),
      });
      if (r2.ok) return parseCompletion(await r2.text());
    }
    if (res.status === 401 || res.status === 403)
      throw new OpenRouterError(`OpenRouter rejected the API key (${res.status}): ${msg}`, "auth", res.status);
    if (res.status === 402)
      throw new OpenRouterError(`OpenRouter: not enough credits (${msg})`, "auth", res.status);
    if (res.status === 429) throw new OpenRouterError(`OpenRouter rate limit: ${msg}`, "rate-limit", res.status);
    if (res.status >= 500) throw new OpenRouterError(`OpenRouter server error ${res.status}: ${msg}`, "server", res.status);
    throw new OpenRouterError(`OpenRouter error ${res.status}: ${msg}`, "bad-request", res.status);
  }
  return parseCompletion(raw);
}

function parseCompletion(raw: string): CompletionResult {
  const json = JSON.parse(raw);
  if (json.error) throw new OpenRouterError(`OpenRouter error: ${json.error.message ?? "unknown"}`, "server");
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
