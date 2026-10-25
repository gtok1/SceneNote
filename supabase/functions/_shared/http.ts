export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

export function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

export function jsonError(status: number, code: string, message: string, extra?: object): Response {
  return json({ error: code, message, ...(extra ?? {}) }, status);
}

export async function parseJson<T extends object>(
  req: Request
): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  try {
    const value: unknown = await req.json();
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, message: "JSON body must be an object" };
    }
    return { ok: true, value: value as T };
  } catch {
    return { ok: false, message: "Invalid JSON body" };
  }
}
