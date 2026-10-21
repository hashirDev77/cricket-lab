export type Json = Record<string, unknown>;

export interface ProviderResult {
  status: number;
  body: Json | null;
}

export async function cricketGet(path: string, params?: Record<string, string | number | undefined>): Promise<ProviderResult> {
  const url = new URL(`/msdata/v1/cricket/${path.replace(/^\//, "")}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      "X-Live-Key": import.meta.env.VITE_MSDATA_LIVE_KEY || "",
      "x-apim-key": import.meta.env.VITE_MSDATA_API_KEY || "",
    },
  });

  const text = await response.text();
  let body: Json | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as Json;
    } catch {
      body = null;
    }
  }

  if (!response.ok && response.status !== 404) {
    const message = String(body?.message || body?.error || `Request failed (${response.status})`);
    throw new Error(message);
  }

  return { status: response.status, body: response.status === 404 ? null : body };
}