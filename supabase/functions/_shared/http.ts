export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
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

export async function parseJson<T>(
  req: Request
): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  try {
    return { ok: true, value: (await req.json()) as T };
  } catch {
    return { ok: false, message: "Invalid JSON body" };
  }
}
