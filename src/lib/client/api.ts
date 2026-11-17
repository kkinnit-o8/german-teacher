"use client";

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(json.error ?? `Request failed (${r.status})`), { status: r.status, body: json });
  return json as T;
}

export async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(json.error ?? `Request failed (${r.status})`), { status: r.status, body: json });
  return json as T;
}
