import { connection } from "next/server";
import { getModelInfo, listModels, lowestEffort } from "@/lib/openrouter";

/** Check a model id against OpenRouter's public model list. */
export async function GET(req: Request) {
  await connection();
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  const all = await listModels();
  if (!all.length) return Response.json({ offline: true });
  const info = await getModelInfo(id);
  if (!info) {
    const close = all
      .map((m) => m.id)
      .filter((m) => id && m.includes(id.split("/").pop()!.slice(0, 6)))
      .slice(0, 5);
    return Response.json({ found: false, suggestions: close });
  }
  const per1M = (x?: string) => (x ? Math.round(Number(x) * 1e6 * 1000) / 1000 : null);
  return Response.json({
    found: true,
    name: info.name ?? info.id,
    inputPerMillion: per1M(info.pricing?.prompt),
    outputPerMillion: per1M(info.pricing?.completion),
    structuredOutputs: Boolean(info.supported_parameters?.includes("structured_outputs")),
    reasoningEffort: lowestEffort(info),
  });
}
